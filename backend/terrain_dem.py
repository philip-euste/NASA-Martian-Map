
from functools import lru_cache
from threading import RLock

import httpx
import rasterio
from rasterio.warp import transform
from fastapi import APIRouter, HTTPException, Query


router = APIRouter(prefix="/api/terrain/dem", tags=["Mars DEM"])


# ---------------------------------------------------------
# DATA SOURCES
# ---------------------------------------------------------

STAC_SEARCH_URL = (
    "https://g6goyz4w56.execute-api.us-west-2.amazonaws.com/"
    "prod/search"
)

HIRISE_COLLECTION = "mro_hirise_socet_dtms"

KNOWN_HIRISE_URL = (
    "https://astrogeo-ard.s3-us-west-2.amazonaws.com/"
    "mars/mro/hirise/controlled/dtm/"
    "ESP_048842_1985_ESP_048908_1985/"
    "DTEEC_048842_1985_048908_1985_U01.tif"
)

MOLA_BASE_URL = (
    "https://pds-geosciences.wustl.edu/mgs/"
    "urn-nasa-pds-mgs_mola_topography_derived/"
)

MOLA_128_DIRECTORY = f"{MOLA_BASE_URL}meg128/"
MOLA_32_DIRECTORY = f"{MOLA_BASE_URL}meg032/"

MOLA_PIXELS_PER_DEGREE = 128
MOLA_GLOBAL_PIXELS_PER_DEGREE = 32

# GDAL configuration values are strings.
# aws_unsigned is a Rasterio Env argument and must be a Boolean.
REMOTE_ENV_OPTIONS = {
    "GDAL_HTTP_MULTIRANGE": "YES",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff,.img,.hdr",
    "aws_unsigned": True,
}

DATASET_LOCK = RLock()


# ---------------------------------------------------------
# REMOTE DATASET ACCESS
# ---------------------------------------------------------

@lru_cache(maxsize=24)
def open_remote_dataset(url: str):
    try:
        with rasterio.Env(**REMOTE_ENV_OPTIONS):
            return rasterio.open(f"/vsicurl/{url}")
    except Exception as error:
        raise RuntimeError(
            f"Unable to open remote elevation dataset: {error}"
        ) from error


def get_band_scale_offset(dataset):
    scale = (
        dataset.scales[0]
        if dataset.scales and dataset.scales[0] is not None
        else 1.0
    )

    offset = (
        dataset.offsets[0]
        if dataset.offsets and dataset.offsets[0] is not None
        else 0.0
    )

    return float(scale), float(offset)


def read_pixel(dataset, row: int, col: int):
    if not (
        0 <= row < dataset.height
        and 0 <= col < dataset.width
    ):
        return None

    with DATASET_LOCK:
        sample = dataset.read(
            1,
            window=((row, row + 1), (col, col + 1)),
            masked=True,
        )

    value = sample[0, 0]

    if bool(sample.mask[0, 0]):
        return None

    scale, offset = get_band_scale_offset(dataset)
    return float(value) * scale + offset


def read_window(dataset, row_start, col_start, width, height):
    row_end = row_start + height
    col_end = col_start + width

    if (
        row_start < 0
        or col_start < 0
        or row_end > dataset.height
        or col_end > dataset.width
    ):
        return None

    with DATASET_LOCK:
        sample = dataset.read(
            1,
            window=(
                (row_start, row_end),
                (col_start, col_end),
            ),
            masked=True,
        )

    scale, offset = get_band_scale_offset(dataset)

    values = []

    for row in range(height):
        row_values = []

        for col in range(width):
            if bool(sample.mask[row, col]):
                row_values.append(None)
            else:
                value = float(sample[row, col]) * scale + offset
                row_values.append(value)

        values.append(row_values)

    return values


# ---------------------------------------------------------
# HIRISE DATA DISCOVERY
# ---------------------------------------------------------

def get_hirise_candidates(longitude: float, latitude: float):
    """
    Search the USGS Astrogeology STAC catalog for HiRISE DTMs
    whose footprints intersect the requested point.
    """

    point = {
        "type": "Point",
        "coordinates": [longitude, latitude],
    }

    try:
        response = httpx.post(
            STAC_SEARCH_URL,
            json={
                "collections": [HIRISE_COLLECTION],
                "intersects": point,
                "limit": 50,
            },
            timeout=20,
        )

        response.raise_for_status()
        payload = response.json()

    except (httpx.HTTPError, ValueError):
        return []

    candidates = []

    for item in payload.get("features", []):
        assets = item.get("assets", {})

        for asset_key, asset in assets.items():
            href = asset.get("href", "")

            if not href:
                continue

            key = asset_key.lower()
            title = str(asset.get("title", "")).lower()
            roles = [
                str(role).lower()
                for role in asset.get("roles", [])
            ]

            is_dtm = (
                "dtm" in key
                or "dtm" in title
                or (
                    "data" in roles
                    and href.lower().endswith((".tif", ".tiff"))
                )
            )

            if not is_dtm:
                continue

            if not href.lower().endswith((".tif", ".tiff")):
                continue

            candidates.append({
                "product_id": item.get("id", "HiRISE DTM"),
                "url": href,
                "source": "HiRISE",
                "resolution_meters": None,
                "vertical_reference": "MOLA areoid",
            })

    candidates.sort(
        key=lambda item: (
            "dtm" not in item["url"].lower(),
            item["product_id"],
        )
    )

    return candidates


def get_known_hirise_candidate():
    return {
        "product_id": "DTEEC_048842_1985_048908_1985_U01",
        "url": KNOWN_HIRISE_URL,
        "source": "HiRISE",
        "resolution_meters": None,
        "vertical_reference": "MOLA areoid",
    }


# ---------------------------------------------------------
# HIRISE COORDINATE SAMPLING
# ---------------------------------------------------------

def project_coordinate(dataset, longitude, latitude):
    if dataset.crs is None:
        raise ValueError(
            "HiRISE dataset has no coordinate reference system."
        )

    geographic_crs = dataset.crs.geodetic_crs

    if geographic_crs is None:
        raise ValueError(
            "HiRISE dataset has no geographic reference system."
        )

    coordinates = transform(
        geographic_crs,
        dataset.crs,
        [longitude],
        [latitude],
    )

    return coordinates[0][0], coordinates[1][0]


def sample_hirise(candidate, longitude, latitude):
    try:
        dataset = open_remote_dataset(candidate["url"])

        x, y = project_coordinate(
            dataset,
            longitude,
            latitude,
        )

        row, col = dataset.index(x, y)

        value = read_pixel(dataset, row, col)

        if value is None:
            return None

        resolution = min(
            abs(float(dataset.res[0])),
            abs(float(dataset.res[1])),
        )

        return {
            "longitude": longitude,
            "latitude": latitude,
            "projected_x": float(x),
            "projected_y": float(y),
            "row": int(row),
            "column": int(col),
            "elevation": value,
            "unit": "metres",
            "product_id": candidate["product_id"],
            "source": "HiRISE",
            "resolution_meters": resolution,
            "vertical_reference": "MOLA areoid",
            "isFallback": False,
        }

    except Exception:
        return None


def find_hirise_elevation(longitude, latitude):
    candidates = get_hirise_candidates(
        longitude,
        latitude,
    )

    candidates.append(get_known_hirise_candidate())

    checked_urls = set()

    for candidate in candidates:
        if candidate["url"] in checked_urls:
            continue

        checked_urls.add(candidate["url"])

        result = sample_hirise(
            candidate,
            longitude,
            latitude,
        )

        if result is not None:
            return result

    return None


# ---------------------------------------------------------
# MOLA GLOBAL DATASET
# ---------------------------------------------------------

def get_mola_128_tile(latitude, longitude):
    """
    MOLA 128 pixels-per-degree data is divided into:
    44-degree latitude bands and 90-degree longitude bands.
    """

    if latitude > 44:
        latitude_top = 88
    elif latitude > 0:
        latitude_top = 44
    elif latitude > -44:
        latitude_top = 0
    else:
        latitude_top = -44

    longitude_360 = longitude % 360
    longitude_left = int(longitude_360 // 90) * 90

    if latitude_top >= 0:
        latitude_code = f"{latitude_top:02d}n"
    else:
        latitude_code = f"{abs(latitude_top):02d}s"

    filename = (
        f"megt{latitude_code}"
        f"{longitude_left:03d}hb.img"
    )

    return {
        "url": f"{MOLA_128_DIRECTORY}{filename}",
        "latitude_top": latitude_top,
        "longitude_left": longitude_left,
        "pixels_per_degree": MOLA_PIXELS_PER_DEGREE,
        "resolution_meters": 463.0,
        "product_id": filename.replace(".img", "").upper(),
    }


def get_mola_global_dataset():
    """
    Lower-resolution global file used near the poles,
    where the 128 pixels-per-degree tiled grid ends.
    """

    filename = "megt90n000fb.img"

    return {
        "url": f"{MOLA_32_DIRECTORY}{filename}",
        "latitude_top": 90,
        "longitude_left": 0,
        "pixels_per_degree": MOLA_GLOBAL_PIXELS_PER_DEGREE,
        "resolution_meters": 1850.0,
        "product_id": "MOLA_MEGDR_32PPD",
    }


def get_mola_location(latitude, longitude):
    if latitude > 88 or latitude < -88:
        return get_mola_global_dataset()

    return get_mola_128_tile(latitude, longitude)


def sample_mola(longitude, latitude):
    """
    Read one numerical elevation value from a remote MOLA tile.
    The image and its ENVI header are read remotely through GDAL.
    """

    source = get_mola_location(
        latitude,
        longitude,
    )

    try:
        dataset = open_remote_dataset(source["url"])

        pixels_per_degree = source["pixels_per_degree"]
        longitude_360 = longitude % 360

        row = int(
            (source["latitude_top"] - latitude)
            * pixels_per_degree
        )

        col = int(
            (longitude_360 - source["longitude_left"])
            * pixels_per_degree
        )

        value = read_pixel(dataset, row, col)

        if value is None:
            raise RuntimeError(
                "MOLA has no valid elevation value at this coordinate."
            )

        return {
            "longitude": longitude,
            "latitude": latitude,
            "projected_x": longitude_360,
            "projected_y": latitude,
            "row": row,
            "column": col,
            "elevation": value,
            "unit": "metres",
            "product_id": source["product_id"],
            "source": "MOLA",
            "resolution_meters": source["resolution_meters"],
            "vertical_reference": "MOLA areoid",
            "isFallback": True,
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=(
                "HiRISE coverage was not available and the remote "
                f"MOLA elevation tile could not be read: {error}"
            ),
        )


# ---------------------------------------------------------
# SOURCE SELECTION
# ---------------------------------------------------------

def get_best_elevation(longitude, latitude):
    hirise_result = find_hirise_elevation(
        longitude,
        latitude,
    )

    if hirise_result is not None:
        return hirise_result

    return sample_mola(
        longitude,
        latitude,
    )


def get_best_dataset(longitude, latitude):
    """
    Returns the selected source and its pixel position.
    Used by the terrain-window endpoint.
    """

    hirise_candidates = get_hirise_candidates(
        longitude,
        latitude,
    )

    hirise_candidates.append(get_known_hirise_candidate())

    checked_urls = set()

    for candidate in hirise_candidates:
        if candidate["url"] in checked_urls:
            continue

        checked_urls.add(candidate["url"])

        try:
            dataset = open_remote_dataset(candidate["url"])

            x, y = project_coordinate(
                dataset,
                longitude,
                latitude,
            )

            row, col = dataset.index(x, y)

            if not (
                0 <= row < dataset.height
                and 0 <= col < dataset.width
            ):
                continue

            if read_pixel(dataset, row, col) is None:
                continue

            resolution = min(
                abs(float(dataset.res[0])),
                abs(float(dataset.res[1])),
            )

            return {
                "dataset": dataset,
                "source": "HiRISE",
                "product_id": candidate["product_id"],
                "resolution_meters": resolution,
                "vertical_reference": "MOLA areoid",
                "row": row,
                "column": col,
                "x": float(x),
                "y": float(y),
            }

        except Exception:
            continue

    source = get_mola_location(latitude, longitude)
    dataset = open_remote_dataset(source["url"])

    pixels_per_degree = source["pixels_per_degree"]
    longitude_360 = longitude % 360

    row = int(
        (source["latitude_top"] - latitude)
        * pixels_per_degree
    )

    col = int(
        (longitude_360 - source["longitude_left"])
        * pixels_per_degree
    )

    return {
        "dataset": dataset,
        "source": "MOLA",
        "product_id": source["product_id"],
        "resolution_meters": source["resolution_meters"],
        "vertical_reference": "MOLA areoid",
        "row": row,
        "column": col,
        "x": longitude_360,
        "y": latitude,
    }


# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------

@router.get("/info")
def get_dem_info():
    return {
        "product_id": "MOLA_MEGDR_128PPD",
        "width": 46080,
        "height": 23040,
        "bands": 1,
        "data_type": "int16",
        "crs": "Mars geographic grid",
        "resolution": [
            1 / MOLA_PIXELS_PER_DEGREE,
            1 / MOLA_PIXELS_PER_DEGREE,
        ],
        "nodata": None,
        "elevation_unit": "metres",
        "vertical_reference": "MOLA areoid",
        "access": "Remote PDS elevation tiles",
        "sources": [
            "HiRISE",
            "MOLA",
        ],
    }


@router.get("/elevation")
def get_elevation(
    longitude: float = Query(ge=-180, le=180),
    latitude: float = Query(ge=-90, le=90),
):
    return get_best_elevation(
        longitude,
        latitude,
    )


@router.get("/window")
def get_elevation_window(
    longitude: float = Query(ge=-180, le=180),
    latitude: float = Query(ge=-90, le=90),
    width: int = Query(default=32, ge=1, le=128),
    height: int = Query(default=32, ge=1, le=128),
):
    selected = get_best_dataset(
        longitude,
        latitude,
    )

    dataset = selected["dataset"]
    row = selected["row"]
    col = selected["column"]

    row_start = row - height // 2
    col_start = col - width // 2

    values = read_window(
        dataset,
        row_start,
        col_start,
        width,
        height,
    )

    if values is None and selected["source"] == "HiRISE":
        source = get_mola_location(latitude, longitude)
        dataset = open_remote_dataset(source["url"])

        pixels_per_degree = source["pixels_per_degree"]
        longitude_360 = longitude % 360

        row = int(
            (source["latitude_top"] - latitude)
            * pixels_per_degree
        )

        col = int(
            (longitude_360 - source["longitude_left"])
            * pixels_per_degree
        )

        row_start = row - height // 2
        col_start = col - width // 2

        values = read_window(
            dataset,
            row_start,
            col_start,
            width,
            height,
        )

        selected = {
            "source": "MOLA",
            "product_id": source["product_id"],
            "resolution_meters": source["resolution_meters"],
            "vertical_reference": "MOLA areoid",
            "x": longitude_360,
            "y": latitude,
        }

    if values is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Requested terrain window extends outside "
                "the selected dataset."
            ),
        )

    return {
        "center": {
            "longitude": longitude,
            "latitude": latitude,
            "projected_x": selected["x"],
            "projected_y": selected["y"],
        },
        "dimensions": {
            "width": width,
            "height": height,
        },
        "pixel_origin": {
            "row": row_start,
            "column": col_start,
        },
        "resolution": [
            selected["resolution_meters"],
            selected["resolution_meters"],
        ],
        "resolution_meters": selected["resolution_meters"],
        "elevations": values,
        "unit": "metres",
        "product_id": selected["product_id"],
        "source": selected["source"],
        "vertical_reference": selected["vertical_reference"],
        "isFallback": selected["source"] == "MOLA",
    }
