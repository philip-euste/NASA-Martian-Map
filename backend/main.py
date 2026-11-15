
import csv
import json
import re
import xml.etree.ElementTree as ET

from itertools import islice
from pathlib import Path

import httpx

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from terrain_dem import router as terrain_dem_router
from routers.regions import router as regions_router


# =========================================================
# CONFIGURATION
# =========================================================

BACKEND_DIR = Path(__file__).resolve().parent

MEDA_PROCESSED_DIR = (
    BACKEND_DIR
    / "datasets"
    / "meda"
    / "processed"
)

MEDA_SENSORS = [
    "ATS",
    "RDS",
    "ANC",
    "PS",
    "RHS",
    "TIRS",
    "WS",
]


# =========================================================
# APPLICATION
# =========================================================

app = FastAPI(title="Marswalk API")

# Allow the deployed Cloudflare Pages frontend and local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nasa-martian-map.pages.dev",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoints
app.include_router(terrain_dem_router)
app.include_router(regions_router)


# =========================================================
# NASA LAYER CONFIGURATION
# =========================================================

MARS_GLOBAL_LAYER = {
    "id": "mars_global_mola",
    "name": "MGS MOLA, Global Color Hillshade",
    "source": "NASA Mars Trek",
    "layer_id": "Mars_MGS_MOLA_ClrShade_merge_global_463m",
    "data_type": "imagery",
    "description": "Global Mars color hillshade map",
}


JEZERO_LAYER = {
    "id": "jezero_hirise",
    "name": "Jezero Crater HiRISE Mosaic",
    "source": "NASA Mars Trek",
    "layer_id": (
        "JEZ_hirise_soc_006_orthoMosaic_25cm_"
        "Eqc_latTs0_lon0_first_dd"
    ),
    "data_type": "imagery",
    "description": "High-resolution orbital imagery of Jezero Crater",
}


NASA_LAYERS = [
    MARS_GLOBAL_LAYER,
    JEZERO_LAYER,
]


def get_capabilities_url(layer):
    return (
        "https://trek.nasa.gov/tiles/Mars/EQ/"
        f"{layer['layer_id']}/1.0.0/"
        "WMTSCapabilities.xml"
    )


# =========================================================
# MEDA HELPERS
# =========================================================

def find_meda_report(sensor, sol):

    sensor = sensor.upper()

    if sensor not in MEDA_SENSORS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown MEDA sensor: {sensor}",
        )

    if not re.fullmatch(r"sol_\d{4}", sol):
        raise HTTPException(
            status_code=400,
            detail="Invalid Sol format. Expected sol_0001.",
        )

    product_dir = (
        MEDA_PROCESSED_DIR
        / sensor
        / sol
    )

    if not product_dir.is_dir():
        raise HTTPException(
            status_code=404,
            detail=f"No processed MEDA data found for {sensor}, {sol}.",
        )

    reports = sorted(
        product_dir.glob("*_REPORT.json")
    )

    if not reports:
        raise HTTPException(
            status_code=404,
            detail="MEDA processing report not found.",
        )

    if len(reports) > 1:
        raise HTTPException(
            status_code=409,
            detail="Multiple MEDA products found. Product selection is ambiguous.",
        )

    report_path = reports[0]

    try:
        with open(
            report_path,
            "r",
            encoding="utf-8",
        ) as report_file:

            report = json.load(report_file)

    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to read MEDA report: {error}",
        )

    if report.get("validation") != "passed":
        raise HTTPException(
            status_code=409,
            detail="MEDA product has not passed validation.",
        )

    output_filename = report.get("output_file")

    if not output_filename:
        raise HTTPException(
            status_code=500,
            detail="Output filename missing from MEDA report.",
        )

    if Path(output_filename).name != output_filename:
        raise HTTPException(
            status_code=500,
            detail="Invalid output filename in MEDA report.",
        )

    csv_path = product_dir / output_filename

    if not csv_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Processed MEDA CSV file not found.",
        )

    return report, csv_path


def get_product_summary(report):

    return {
        "sensor": report.get("sensor"),
        "sol": report.get("sol"),
        "title": report.get("title"),
        "logical_identifier": report.get(
            "logical_identifier"
        ),
        "processing_level": report.get(
            "processing_level"
        ),
        "product_version": report.get(
            "product_version"
        ),
        "start_time": report.get("start_time"),
        "stop_time": report.get("stop_time"),
        "record_count": report.get("record_count"),
        "fields": report.get("fields", []),
        "validation": report.get("validation"),
    }


# =========================================================
# GENERAL ENDPOINTS
# =========================================================

@app.get("/")
def home():

    return {
        "message": "Marswalk API is running!"
    }


# =========================================================
# NASA LAYER ENDPOINTS
# =========================================================

@app.get("/api/layers")
def get_layers():

    return NASA_LAYERS


@app.get("/api/layers/{layer_id}")
def get_layer(layer_id: str):

    for layer in NASA_LAYERS:

        if layer["id"] == layer_id:
            return layer

    raise HTTPException(
        status_code=404,
        detail="Layer not found",
    )


@app.get("/api/nasa/layers/{layer_id}/capabilities")
async def get_nasa_capabilities(layer_id: str):

    layer = next(
        (
            item
            for item in NASA_LAYERS
            if item["id"] == layer_id
        ),
        None,
    )

    if layer is None:
        raise HTTPException(
            status_code=404,
            detail="Layer not found",
        )

    try:

        async with httpx.AsyncClient(timeout=30) as client:

            response = await client.get(
                get_capabilities_url(layer)
            )

            response.raise_for_status()

        return {
            "source": layer["source"],
            "status": "connected",
            "content_type": response.headers.get(
                "content-type"
            ),
            "capabilities_xml": response.text,
        }

    except httpx.HTTPError as error:

        raise HTTPException(
            status_code=502,
            detail=f"NASA service request failed: {error}",
        )


@app.get("/api/nasa/layers/{layer_id}/info")
async def get_layer_info(layer_id: str):

    layer_config = next(
        (
            item
            for item in NASA_LAYERS
            if item["id"] == layer_id
        ),
        None,
    )

    if layer_config is None:
        raise HTTPException(
            status_code=404,
            detail="Layer not found",
        )

    try:

        async with httpx.AsyncClient(timeout=30) as client:

            response = await client.get(
                get_capabilities_url(layer_config)
            )

            response.raise_for_status()

        root = ET.fromstring(response.content)

        def find_all(element, tag_name):

            return [
                node
                for node in element.iter()
                if node.tag.split("}")[-1] == tag_name
            ]

        target_id = layer_config["layer_id"]

        layer = next(
            (
                item
                for item in find_all(root, "Layer")
                if any(
                    node.text == target_id
                    for node in find_all(
                        item,
                        "Identifier",
                    )
                )
            ),
            None,
        )

        if layer is None:

            raise HTTPException(
                status_code=404,
                detail="Layer not found in NASA capabilities",
            )

        return {
            "id": layer_config["id"],
            "name": layer_config["name"],
            "layer_id": target_id,
            "formats": [
                node.text
                for node in find_all(layer, "Format")
                if node.text
            ],
            "tile_resources": [
                {
                    "format": item.get("format"),
                    "resource_type": item.get("resourceType"),
                    "template": item.get("template"),
                }
                for item in find_all(
                    layer,
                    "ResourceURL",
                )
            ],
            "tile_matrix_sets": [
                node.text
                for node in find_all(
                    layer,
                    "TileMatrixSet",
                )
                if node.text
            ],
        }

    except httpx.HTTPError as error:

        raise HTTPException(
            status_code=502,
            detail=f"NASA request failed: {error}",
        )

    except ET.ParseError:

        raise HTTPException(
            status_code=502,
            detail="NASA returned invalid XML",
        )


@app.get("/api/nasa/layers/{layer_id}/tile-config")
async def get_tile_config(layer_id: str):

    info = await get_layer_info(layer_id)

    tile = next(
        (
            resource
            for resource in info["tile_resources"]
            if resource["resource_type"] == "tile"
        ),
        None,
    )

    if tile is None:

        raise HTTPException(
            status_code=404,
            detail="No tile template found for this layer",
        )

    return {
        "id": info["id"],
        "layer_id": info["layer_id"],
        "format": tile["format"],
        "tile_matrix_sets": info["tile_matrix_sets"],
        "tile_url_template": tile["template"].replace(
            "/1.0.0//{Style}/",
            "/1.0.0/{Style}/",
        ),
    }


# =========================================================
# MEDA ENDPOINTS
# =========================================================

@app.get("/api/meda/products")
def get_meda_products():

    if not MEDA_PROCESSED_DIR.is_dir():

        return {
            "count": 0,
            "products": [],
        }

    products = []

    for sensor in MEDA_SENSORS:

        sensor_dir = MEDA_PROCESSED_DIR / sensor

        if not sensor_dir.is_dir():
            continue

        report_paths = sorted(
            sensor_dir.glob("sol_*/*_REPORT.json")
        )

        for report_path in report_paths:

            try:

                with open(
                    report_path,
                    "r",
                    encoding="utf-8",
                ) as report_file:

                    report = json.load(report_file)

                if report.get("validation") != "passed":
                    continue

                products.append(
                    get_product_summary(report)
                )

            except (OSError, json.JSONDecodeError):
                continue

    return {
        "count": len(products),
        "products": products,
    }


@app.get("/api/meda/products/{sensor}/{sol}")
def get_meda_observations(
    sensor: str,
    sol: str,
    limit: int = Query(
        default=100,
        ge=1,
        le=1000,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
):

    report, csv_path = find_meda_report(
        sensor,
        sol,
    )

    observations = []

    try:

        with open(
            csv_path,
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as csv_file:

            reader = csv.DictReader(csv_file)

            observations = list(
                islice(
                    reader,
                    offset,
                    offset + limit,
                )
            )

    except OSError as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to read MEDA observations: {error}",
        )

    total_records = report.get(
        "record_count",
        0,
    )

    returned_records = len(observations)

    return {
        "product": get_product_summary(report),
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total_records": total_records,
            "returned_records": returned_records,
            "has_more": (
                offset + returned_records < total_records
            ),
        },
        "observations": observations,
    }


# =========================================================
# PERSEVERANCE ROVER SURFACE IMAGERY
# =========================================================

ROVER_IMAGERY_FILE = (
    BACKEND_DIR
    / "datasets"
    / "rover_imagery"
    / "processed"
    / "perseverance_surface_imagery.json"
)

if not ROVER_IMAGERY_FILE.is_file():
    ROVER_IMAGERY_FILE = (
        BACKEND_DIR.parent
        / "frontend"
        / "public"
        / "data"
        / "perseverance_surface_imagery.json"
    )


@app.get("/api/rover/perseverance/images")
def get_perseverance_surface_images(
    camera: str = Query(default="ALL"),
    sol: str = Query(default="ALL"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=12, ge=1, le=100),
):
    if not ROVER_IMAGERY_FILE.is_file():
        raise HTTPException(
            status_code=404,
            detail="Perseverance surface imagery catalog not found on server.",
        )

    try:
        with open(ROVER_IMAGERY_FILE, "r", encoding="utf-8") as f:
            catalog = json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to load Perseverance surface imagery: {e}",
        )

    items = catalog.get("items", [])

    # Filter by camera
    if camera != "ALL":
        cam_upper = camera.upper()
        items = [
            img for img in items
            if img.get("cameraGroup") == cam_upper or img.get("instrument") == cam_upper
        ]

    # Filter by Sol
    if sol != "ALL":
        try:
            sol_int = int(sol)
            items = [img for img in items if img.get("sol") == sol_int]
        except ValueError:
            pass

    total_matching = len(items)
    total_pages = max(1, (total_matching + per_page - 1) // per_page)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    page_items = items[start_idx:end_idx]

    return {
        "items": page_items,
        "totalMatching": total_matching,
        "page": page,
        "perPage": per_page,
        "totalPages": total_pages,
        "hasMore": page < total_pages,
        "availableSols": catalog.get("availableSols", []),
        "summaryByCamera": catalog.get("summaryByCamera", {}),
        "retrievalMode": "live_backend",
        "retrievalLabel": "FastAPI Marswalk Server",
        "sourceAttribution": "NASA/JPL-Caltech Mars 2020 Raw Images Archive",
    }
