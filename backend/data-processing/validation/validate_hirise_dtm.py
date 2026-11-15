
"""
HiRISE DTM Catalog Validator
============================

Validates the catalog produced by:
    backend/data-processing/acquisition/discover_hirise_dtm.py

Input:
    backend/data-processing/acquisition/output/hirise_dtm_catalog.json

Output:
    backend/data-processing/validation/output/hirise_dtm_validation.json

Regional coverage:
    Uses the same USGS Gazetteer named-feature boundaries as
    backend/services/mars_region_service.py.

Boundary feature IDs:
    Jezero Crater:    14300
    Gale Crater:       2071
    Valles Marineris:  6288
    Olympus Mons:      4453

Important:
    Gazetteer boundaries are approximate named-feature extents,
    not precise geological boundaries.

Optional dependencies:
    pip install shapely httpx

Usage:
    python backend/data-processing/validation/validate_hirise_dtm.py
    python backend/data-processing/validation/validate_hirise_dtm.py --region jezero
    python backend/data-processing/validation/validate_hirise_dtm.py --include-test
    python backend/data-processing/validation/validate_hirise_dtm.py --top 20
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys

from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


# ============================================================
# OPTIONAL DEPENDENCIES
# ============================================================

try:
    import httpx
except ImportError:
    httpx = None

try:
    from shapely import wkt
    from shapely.geometry import (
        GeometryCollection,
        MultiPolygon,
        Polygon,
        shape,
    )
    from shapely.ops import transform, unary_union

except ImportError:
    wkt = None
    GeometryCollection = None
    MultiPolygon = None
    Polygon = None
    shape = None
    transform = None
    unary_union = None


# ============================================================
# PATHS
# ============================================================

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]

DEFAULT_INPUT = (
    PROJECT_ROOT
    / "data-processing"
    / "acquisition"
    / "output"
    / "hirise_dtm_catalog.json"
)

DEFAULT_OUTPUT_DIR = SCRIPT_DIR / "output"
DEFAULT_OUTPUT = DEFAULT_OUTPUT_DIR / "hirise_dtm_validation.json"


# ============================================================
# USGS GAZETTEER CONFIGURATION
# Same source and feature IDs as mars_region_service.py
# ============================================================

GAZETTEER_FEATURE_URL = (
    "https://planetarynames.wr.usgs.gov/Feature"
)

GAZETTEER_SOURCE = (
    "USGS Gazetteer of Planetary Nomenclature"
)

GAZETTEER_COORDINATE_SYSTEM = (
    "Planetocentric, +East, 0-360"
)

GAZETTEER_TIMEOUT = 60

MARS_RADIUS_METERS = 3_396_190.0

BOUNDARY_DISCLAIMER = (
    "The Gazetteer describes these boundaries as approximate "
    "representations of named-feature locations and rough extents. "
    "They should not be interpreted as precise geological boundaries."
)

# Catalog region key -> backend region ID.
#
# The discovery catalog uses "olympus".
# Your FastAPI backend uses "olympus-mons".
#
REGION_DEFINITIONS = {
    "jezero": {
        "name": "Jezero Crater",
        "backend_id": "jezero",
        "feature_id": 14300,
        "center": {
            "latitude": 18.41,
            "longitude": 77.69,
        },
    },
    "gale": {
        "name": "Gale Crater",
        "backend_id": "gale",
        "feature_id": 2071,
        "center": {
            "latitude": -5.44,
            "longitude": 137.70,
        },
    },
    "valles-marineris": {
        "name": "Valles Marineris",
        "backend_id": "valles-marineris",
        "feature_id": 6288,
        "center": {
            "latitude": -13.74,
            "longitude": -59.20,
        },
    },
    "olympus": {
        "name": "Olympus Mons",
        "backend_id": "olympus-mons",
        "feature_id": 4453,
        "center": {
            "latitude": 18.65,
            "longitude": -133.80,
        },
    },
}

REGION_NAMES = {
    key: value["name"]
    for key, value in REGION_DEFINITIONS.items()
}


# ============================================================
# ASSET CLASSIFICATION
# ============================================================

DTM_TERMS = (
    "dtm",
    "dem",
    "digital terrain model",
    "digital elevation model",
    "elevation model",
    "terrain model",
    "height model",
    "elevation",
    "socet",
    "terrain raster",
)

ORTHO_TERMS = (
    "ortho",
    "orthophoto",
    "orthomosaic",
    "orthoimage",
    "orthorectified",
    "image mosaic",
    "image product",
)

PREVIEW_TERMS = (
    "thumbnail",
    "preview",
    "browse",
    "quicklook",
    "quick-look",
    "footprint",
    "small image",
    "overview",
)

METADATA_TERMS = (
    "metadata",
    "label",
    "readme",
    "xml",
    "json",
    "documentation",
    "checksum",
)

RASTER_EXTENSIONS = {
    ".tif", ".tiff", ".img", ".jp2",
    ".vrt", ".cub", ".dem", ".grd",
}

METADATA_EXTENSIONS = {
    ".xml", ".json", ".txt", ".html",
    ".htm", ".md", ".pdf",
}

TEST_COLLECTION_MARKERS = (
    "_test",
    "-test",
    "test_",
    "testing",
)


# ============================================================
# GENERAL UTILITIES
# ============================================================

def safe_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        result = float(value)

        if not math.isfinite(result):
            return None

        return result

    except (TypeError, ValueError):
        return None


def normalize_text(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, dict):
        return " ".join(
            f"{key} {normalize_text(item)}"
            for key, item in value.items()
        )

    if isinstance(value, (list, tuple, set)):
        return " ".join(
            normalize_text(item)
            for item in value
        )

    return (
        str(value)
        .lower()
        .replace("_", " ")
        .replace("-", " ")
    )


def get_file_extension(href: str | None) -> str:
    if not href:
        return ""

    try:
        path = unquote(urlparse(href).path)
        return Path(path).suffix.lower()

    except Exception:
        return ""


def is_test_collection(collection: str | None) -> bool:
    if not collection:
        return False

    value = collection.lower()

    return any(
        marker in value
        for marker in TEST_COLLECTION_MARKERS
    )


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [
            json_safe(item)
            for item in value
        ]

    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    return str(value)


def unique(values: list[str]) -> list[str]:
    result = []
    seen = set()

    for value in values:
        if not value:
            continue

        if value not in seen:
            seen.add(value)
            result.append(value)

    return result


# ============================================================
# GAZETTEER BOUNDARY RETRIEVAL
# ============================================================

class GazetteerTextParser(HTMLParser):
    """Extract readable text from a Gazetteer HTML page."""

    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def get_text(self):
        return " ".join(self.parts)


def extract_wkt_from_html(html: str) -> str:
    """
    Extract the first Polygon or MultiPolygon WKT.

    This follows the same extraction approach as
    mars_region_service.py.
    """

    parser = GazetteerTextParser()
    parser.feed(html)

    page_text = parser.get_text()

    match = re.search(
        r"\b(MULTIPOLYGON|POLYGON)\s*\(",
        page_text,
        flags=re.IGNORECASE,
    )

    if match is None:
        raise ValueError(
            "No Polygon or MultiPolygon WKT found "
            "in the USGS Gazetteer page."
        )

    geometry_type = match.group(1).upper()
    opening = page_text.find("(", match.start())

    depth = 0
    end = None

    for index in range(opening, len(page_text)):
        character = page_text[index]

        if character == "(":
            depth += 1

        elif character == ")":
            depth -= 1

            if depth == 0:
                end = index + 1
                break

    if end is None:
        raise ValueError(
            "Gazetteer WKT has unbalanced parentheses."
        )

    return (
        geometry_type
        + " "
        + page_text[opening:end]
    )

def normalize_longitude(longitude: float) -> float:
    """
    Convert east-positive longitude from 0-360
    into the -180 to 180 convention.

    This matches mars_region_service.py.
    """

    longitude = float(longitude)

    if longitude > 180:
        longitude -= 360

    return longitude


def normalize_geometry_longitudes(geometry: Any) -> Any:
    """Normalize all geometry longitudes to -180..180."""

    if transform is None:
        raise RuntimeError("Shapely transform is unavailable.")

    def normalize_coordinates(
        x: Any,
        y: Any,
        z: Any = None,
    ) -> Any:
        if isinstance(x, (list, tuple)):
            normalized_x = [
                normalize_longitude(value)
                for value in x
            ]
        else:
            normalized_x = normalize_longitude(x)

        if z is None:
            return normalized_x, y

        return normalized_x, y, z

    return transform(normalize_coordinates, geometry)


def retrieve_gazetteer_boundary(region_key: str) -> dict[str, Any]:
    """
    Retrieve the same Gazetteer boundary used by the backend.

    This function intentionally retrieves the source directly
    rather than requiring a locally running FastAPI server.
    """

    if httpx is None:
        raise RuntimeError(
            "The httpx package is required. "
            "Install it with: pip install httpx"
        )

    if shape is None or wkt is None:
        raise RuntimeError(
            "Shapely is required for Gazetteer boundary validation. "
            "Install it with: pip install shapely"
        )

    definition = REGION_DEFINITIONS[region_key]
    feature_id = definition["feature_id"]

    feature_url = f"{GAZETTEER_FEATURE_URL}/{feature_id}"

    try:
        with httpx.Client(
            timeout=GAZETTEER_TIMEOUT,
            follow_redirects=True,
        ) as client:
            response = client.get(feature_url)
            response.raise_for_status()

    except Exception as error:
        raise RuntimeError(
            f"Failed to retrieve Gazetteer boundary for "
            f"{definition['name']} (feature {feature_id}): {error}"
        ) from error

    try:
        geometry_wkt = extract_wkt_from_html(response.text)
        geometry: Any = wkt.loads(geometry_wkt)

        if geometry.geom_type not in ("Polygon", "MultiPolygon"):
            raise ValueError(
                f"Unsupported geometry type: {geometry.geom_type}"
            )

        if geometry.is_empty:
            raise ValueError(
                "Gazetteer returned an empty boundary."
            )

        if not geometry.is_valid:
            geometry = geometry.buffer(0)

        if geometry.is_empty or not geometry.is_valid:
            raise ValueError(
                "Gazetteer boundary is invalid."
            )

        geometry = normalize_geometry_longitudes(geometry)

    except Exception as error:
        raise RuntimeError(
            f"Could not parse Gazetteer boundary for "
            f"{definition['name']}: {error}"
        ) from error

    return {
        "geometry": geometry,
        "metadata": {
            "region_id": definition["backend_id"],
            "region_name": definition["name"],
            "feature_id": feature_id,
            "source": GAZETTEER_SOURCE,
            "feature_url": feature_url,
            "coordinate_system": GAZETTEER_COORDINATE_SYSTEM,
            "output_longitude_convention": "-180 to 180 degrees",
            "geometry_type": geometry.geom_type,
            "boundary_status": "gazetteer_named_feature_geometry",
            "boundary_accuracy": "approximate_named_feature_extent",
            "disclaimer": BOUNDARY_DISCLAIMER,
        },
    }


# ============================================================
# MARS AREA PROJECTION
# ============================================================

def make_mars_projection(region_geometry: Any) -> Any:
    """
    Build a local Mars-centered equirectangular projection.

    Mars is approximated as a sphere with radius 3,396,190 m.

    The projection is centered on the Gazetteer boundary centroid.
    It allows intersection areas to be compared in square metres
    rather than raw square degrees.

    This is a local area approximation, not a replacement for
    a full planetary geodetic workflow.
    """

    centroid = region_geometry.centroid

    center_longitude = float(centroid.x)
    center_latitude = float(centroid.y)

    latitude_factor = math.cos(
        math.radians(center_latitude)
    )

    def project_coordinates(
        x: Any,
        y: Any,
        z: Any = None,
    ) -> Any:

        def project_one(
            longitude: float,
            latitude: float,
        ) -> tuple[float, float]:

            longitude = float(longitude)
            latitude = float(latitude)

            x_meters = (
                MARS_RADIUS_METERS
                * math.radians(longitude - center_longitude)
                * latitude_factor
            )

            y_meters = (
                MARS_RADIUS_METERS
                * math.radians(latitude)
            )

            return x_meters, y_meters

        if isinstance(x, (list, tuple)):
            projected = [
                project_one(longitude, latitude)
                for longitude, latitude in zip(x, y)
            ]

            projected_x = [point[0] for point in projected]
            projected_y = [point[1] for point in projected]

            if z is None:
                return projected_x, projected_y

            return projected_x, projected_y, z

        projected_x, projected_y = project_one(x, y)

        if z is None:
            return projected_x, projected_y

        return projected_x, projected_y, z

    return project_coordinates


def project_geometry(
    geometry: Any,
    projection: Any,
) -> Any:
    if transform is None:
        raise RuntimeError("Shapely transform is unavailable.")

    return transform(projection, geometry)


# ============================================================
# GEOMETRY HELPERS
# ============================================================

def extract_polygonal_geometry(geometry: Any) -> Any | None:
    """Extract Polygon components from an intersection result."""

    if geometry.is_empty:
        return None

    geometry_type = geometry.geom_type

    if geometry_type in ("Polygon", "MultiPolygon"):
        return geometry

    if geometry_type == "GeometryCollection":
        polygons: list[Any] = []

        for part in geometry.geoms:
            extracted = extract_polygonal_geometry(part)

            if extracted is None:
                continue

            if extracted.geom_type == "Polygon":
                polygons.append(extracted)

            elif extracted.geom_type == "MultiPolygon":
                polygons.extend(extracted.geoms)

        if not polygons:
            return None

        if unary_union is None:
            raise RuntimeError("Shapely unary_union is unavailable.")

        return unary_union(polygons)

    return None


def get_product_geometry(product: dict[str, Any]) -> Any | None:
    """Read and normalize a STAC GeoJSON geometry."""

    if shape is None:
        raise RuntimeError("Shapely shape is unavailable.")

    geometry_data = product.get("geometry")

    if not isinstance(geometry_data, dict):
        return None

    try:
        geometry: Any = shape(geometry_data)

        if geometry.is_empty:
            return None

        if not geometry.is_valid:
            geometry = geometry.buffer(0)

        if geometry.is_empty or not geometry.is_valid:
            return None

        return normalize_geometry_longitudes(geometry)

    except Exception:
        return None


def calculate_polygon_coverage(
    product_geometry,
    region_geometry,
    projection,
) -> dict:
    """
    Calculate:
      - Percentage of the region covered by the product.
      - Percentage of the product inside the region.

    Both areas are calculated after projecting to local Mars
    equirectangular coordinates.
    """

    projected_region = project_geometry(
        region_geometry,
        projection,
    )

    projected_product = project_geometry(
        product_geometry,
        projection,
    )

    if not projected_region.is_valid:
        projected_region = projected_region.buffer(0)

    if not projected_product.is_valid:
        projected_product = projected_product.buffer(0)

    if (
        projected_region.is_empty
        or projected_product.is_empty
    ):
        return {
            "region_coverage_fraction": 0.0,
            "product_inside_region_fraction": 0.0,
            "intersection_area_km2": 0.0,
        }

    intersection = projected_product.intersection(
        projected_region
    )

    if intersection.is_empty:
        return {
            "region_coverage_fraction": 0.0,
            "product_inside_region_fraction": 0.0,
            "intersection_area_km2": 0.0,
        }

    region_area = projected_region.area
    product_area = projected_product.area
    intersection_area = intersection.area

    if region_area <= 0 or product_area <= 0:
        raise ValueError(
            "Cannot calculate coverage from zero-area geometry."
        )

    region_coverage = (
        intersection_area / region_area
    )

    product_coverage = (
        intersection_area / product_area
    )

    return {
        "region_coverage_fraction": min(
            max(region_coverage, 0.0),
            1.0,
        ),
        "product_inside_region_fraction": min(
            max(product_coverage, 0.0),
            1.0,
        ),
        "intersection_area_km2": (
            intersection_area / 1_000_000.0
        ),
    }


# ============================================================
# BOUNDING BOX UTILITIES
# Retained for discovery metadata and product-overlap checks.
# They are NOT used for final region coverage.
# ============================================================

def bbox_area(bbox: list[float] | None) -> float:
    if not bbox or len(bbox) < 4:
        return 0.0

    west, south, east, north = bbox[:4]

    if east <= west or north <= south:
        return 0.0

    return (east - west) * (north - south)


def bbox_intersection(
    first: list[float] | None,
    second: list[float] | None,
) -> list[float] | None:

    if not first or not second:
        return None

    if len(first) < 4 or len(second) < 4:
        return None

    west = max(first[0], second[0])
    south = max(first[1], second[1])
    east = min(first[2], second[2])
    north = min(first[3], second[3])

    if east <= west or north <= south:
        return None

    return [west, south, east, north]


# ============================================================
# PROJECTION INSPECTION
# ============================================================

def extract_projection(properties: dict) -> dict:
    projjson = properties.get("proj:projjson")
    wkt_value = properties.get("proj:wkt2")
    epsg = properties.get("proj:epsg")

    projection_name = None
    coordinate_system = None
    ellipsoid = None

    if isinstance(projjson, dict):
        projection_name = projjson.get("name")

        base_crs = projjson.get("base_crs", {})

        if isinstance(base_crs, dict):
            datum = base_crs.get("datum", {})

            if isinstance(datum, dict):
                ellipsoid = datum.get("ellipsoid")

        coordinate_system = projjson.get(
            "coordinate_system"
        )

    if projection_name is None and isinstance(wkt_value, str):
        match = re.search(
            r'PROJCS\["([^"]+)"',
            wkt_value,
        )

        if match:
            projection_name = match.group(1)

    return {
        "epsg": epsg,
        "name": projection_name,
        "wkt_available": bool(wkt_value),
        "projjson_available": isinstance(projjson, dict),
        "coordinate_system": coordinate_system,
        "ellipsoid": ellipsoid,
    }


# ============================================================
# ASSET CLASSIFICATION
# ============================================================

def get_asset_metadata(asset_key: str, asset: dict) -> dict:
    href = asset.get("href")

    title = asset.get("title")
    description = asset.get("description")
    media_type = asset.get("type")

    roles = asset.get("roles", [])

    if not isinstance(roles, list):
        roles = []

    extension = get_file_extension(href)

    searchable_text = normalize_text({
        "key": asset_key,
        "title": title,
        "description": description,
        "roles": roles,
        "media_type": media_type,
        "href": href,
    })

    return {
        "key": asset_key,
        "href": href,
        "title": title,
        "description": description,
        "media_type": media_type,
        "roles": roles,
        "extension": extension,
        "search_text": searchable_text,
        "file_name": (
            Path(unquote(urlparse(href).path)).name
            if href
            else None
        ),
        "file_size": asset.get("file:size"),
        "checksum": asset.get("file:checksum"),
        "gsd": safe_float(asset.get("gsd")),
        "proj:epsg": asset.get("proj:epsg"),
        "proj:wkt2": asset.get("proj:wkt2"),
        "proj:shape": asset.get("proj:shape"),
        "proj:transform": asset.get("proj:transform"),
        "raster:bands": asset.get("raster:bands"),
        "eo:bands": asset.get("eo:bands"),
    }


def classify_asset(asset: dict) -> dict:
    text = asset["search_text"]
    extension = asset["extension"]

    roles = [
        str(role).lower()
        for role in asset.get("roles", [])
    ]

    is_preview = any(
        term in text
        for term in PREVIEW_TERMS
    )

    is_metadata = (
        any(term in text for term in METADATA_TERMS)
        or extension in METADATA_EXTENSIONS
    )

    dtm_score = 0
    ortho_score = 0

    dtm_matches = []
    ortho_matches = []

    for term in DTM_TERMS:
        if term in text:
            dtm_score += 3
            dtm_matches.append(term)

    for term in ORTHO_TERMS:
        if term in text:
            ortho_score += 3
            ortho_matches.append(term)

    if extension in RASTER_EXTENSIONS:
        dtm_score += 1
        ortho_score += 1

    if "data" in roles:
        dtm_score += 1
        ortho_score += 1

    if "thumbnail" in roles or "overview" in roles:
        is_preview = True

    if "metadata" in roles:
        is_metadata = True

    if is_preview:
        return {
            "classification": "preview",
            "confidence": "high",
            "dtm_score": dtm_score,
            "ortho_score": ortho_score,
            "matched_terms": [],
            "warning": None,
        }

    if is_metadata:
        return {
            "classification": "metadata",
            "confidence": "high",
            "dtm_score": dtm_score,
            "ortho_score": ortho_score,
            "matched_terms": [],
            "warning": None,
        }

    if dtm_score >= 3 and dtm_score > ortho_score:
        classification = "dtm"
        confidence = (
            "high"
            if len(dtm_matches) >= 2
            else "medium"
        )
        matches = dtm_matches

    elif ortho_score >= 3 and ortho_score > dtm_score:
        classification = "orthophoto"
        confidence = (
            "high"
            if len(ortho_matches) >= 2
            else "medium"
        )
        matches = ortho_matches

    elif dtm_score > 0 or ortho_score > 0:
        classification = "ambiguous_raster"
        confidence = "low"
        matches = unique(
            dtm_matches + ortho_matches
        )

    else:
        classification = "unknown"
        confidence = "low"
        matches = []

    warning = None

    if classification in {"dtm", "orthophoto"}:
        if extension not in RASTER_EXTENSIONS:
            warning = (
                "The asset name suggests raster data, but its "
                "file extension is not a recognized raster extension."
            )

    if not asset.get("href"):
        warning = "Asset has no href."

    return {
        "classification": classification,
        "confidence": confidence,
        "dtm_score": dtm_score,
        "ortho_score": ortho_score,
        "matched_terms": matches,
        "warning": warning,
    }


# ============================================================
# PRODUCT INSPECTION
# ============================================================

def inspect_product(product: dict) -> dict:
    properties = product.get("properties", {})

    if not isinstance(properties, dict):
        properties = {}

    assets = product.get("assets", {})

    if not isinstance(assets, dict):
        assets = {}

    asset_results = []

    for asset_key, asset in assets.items():
        if not isinstance(asset, dict):
            continue

        metadata = get_asset_metadata(
            asset_key,
            asset,
        )

        classification = classify_asset(metadata)

        asset_results.append({
            **metadata,
            **classification,
        })

    counts = Counter(
        item["classification"]
        for item in asset_results
    )

    dtm_assets = [
        item
        for item in asset_results
        if item["classification"] == "dtm"
    ]

    ortho_assets = [
        item
        for item in asset_results
        if item["classification"] == "orthophoto"
    ]

    ambiguous_assets = [
        item
        for item in asset_results
        if item["classification"] == "ambiguous_raster"
    ]

    gsd = safe_float(
        properties.get("gsd")
    )

    projection = extract_projection(properties)

    bbox = product.get("bbox")

    if not isinstance(bbox, list) or len(bbox) < 4:
        bbox = None

    geometry = product.get("geometry")

    geometry_available = isinstance(geometry, dict)

    warnings = []

    if not assets:
        warnings.append("Product has no assets.")

    if not dtm_assets:
        warnings.append(
            "No asset was confidently classified as a DTM."
        )

    if not ortho_assets:
        warnings.append(
            "No asset was confidently classified as an orthophoto."
        )

    if gsd is None:
        warnings.append("Product-level GSD is missing.")

    if (
        not projection["wkt_available"]
        and not projection["projjson_available"]
    ):
        warnings.append("Projection metadata is unavailable.")

    if not geometry_available:
        warnings.append("STAC product geometry is unavailable.")

    return {
        "id": product.get("id"),
        "collection": product.get("collection"),
        "region": product.get("region"),
        "datetime": (
            properties.get("datetime")
            or product.get("datetime")
        ),
        "bbox": bbox,
        "geometry_available": geometry_available,
        "gsd_m_per_pixel": gsd,
        "projection": projection,
        "asset_summary": {
            "total": len(asset_results),
            "dtm": len(dtm_assets),
            "orthophoto": len(ortho_assets),
            "ambiguous_raster": len(ambiguous_assets),
            "preview": counts.get("preview", 0),
            "metadata": counts.get("metadata", 0),
            "unknown": counts.get("unknown", 0),
        },
        "assets": asset_results,
        "warnings": warnings,
    }


# ============================================================
# REGION VALIDATION
# ============================================================

def evaluate_product_for_region(
    product: dict,
    region_key: str,
    region_data: dict,
    boundary: dict,
) -> dict:
    """Evaluate one STAC product against the Gazetteer polygon."""

    region_geometry = boundary["geometry"]
    projection = boundary["projection"]

    product_geometry = get_product_geometry(product)

    coverage = None

    if product_geometry is not None:
        coverage = calculate_polygon_coverage(
            product_geometry,
            region_geometry,
            projection,
        )

    overlap_ratio = (
        coverage["region_coverage_fraction"]
        if coverage is not None
        else 0.0
    )

    product_coverage = (
        coverage["product_inside_region_fraction"]
        if coverage is not None
        else 0.0
    )

    intersection_area = (
        coverage["intersection_area_km2"]
        if coverage is not None
        else 0.0
    )

    gsd = product.get("gsd_m_per_pixel")

    dtm_count = product["asset_summary"]["dtm"]
    ortho_count = product["asset_summary"]["orthophoto"]

    has_dtm = dtm_count > 0
    has_ortho = ortho_count > 0

    if gsd is not None and gsd > 0:
        resolution_score = min(
            100.0,
            100.0 / max(gsd, 0.01),
        )
    else:
        resolution_score = 0.0

    coverage_score = overlap_ratio * 100.0

    dtm_score = 100.0 if has_dtm else 0.0
    ortho_score = 100.0 if has_ortho else 0.0

    ranking_score = (
        coverage_score * 0.45
        + resolution_score * 0.25
        + dtm_score * 0.25
        + ortho_score * 0.05
    )

    if product_geometry is None:
        status = "missing_or_invalid_geometry"
    elif overlap_ratio <= 0:
        status = "outside_region"
    elif not has_dtm:
        status = "needs_asset_verification"
    elif overlap_ratio < 0.01:
        status = "small_overlap"
    else:
        status = "candidate"

    return {
        "id": product.get("id"),
        "region": region_key,
        "region_name": region_data.get(
            "name",
            REGION_NAMES.get(region_key, region_key),
        ),
        "collection": product.get("collection"),
        "bbox": product.get("bbox"),
        "datetime": product.get("datetime"),
        "gsd_m_per_pixel": gsd,
        "overlap": {
            "region_coverage_fraction": round(
                overlap_ratio,
                8,
            ),
            "region_coverage_percent": round(
                overlap_ratio * 100.0,
                4,
            ),
            "product_inside_region_fraction": round(
                product_coverage,
                8,
            ),
            "intersection_area_km2": round(
                intersection_area,
                6,
            ),
            "method": (
                "shapely_intersection_local_mars_equirectangular"
                if coverage is not None
                else "unavailable"
            ),
        },
        "assets": product["asset_summary"],
        "has_confident_dtm": has_dtm,
        "has_confident_orthophoto": has_ortho,
        "scores": {
            "coverage": round(coverage_score, 2),
            "resolution": round(resolution_score, 2),
            "dtm_evidence": dtm_score,
            "orthophoto_evidence": ortho_score,
            "ranking": round(ranking_score, 2),
        },
        "status": status,
    }


# ============================================================
# PRODUCT OVERLAP DETECTION
# ============================================================

def detect_product_overlaps(
    candidates: list[dict],
) -> list[dict]:
    """
    Detect pairs of products whose STAC bounding boxes intersect.

    This is a preliminary footprint check, not proof of raster
    compatibility or actual pixel overlap.
    """

    results = []

    for index, first in enumerate(candidates):
        first_bbox = first.get("bbox")

        if not first_bbox:
            continue

        for second in candidates[index + 1:]:
            second_bbox = second.get("bbox")

            if not second_bbox:
                continue

            intersection = bbox_intersection(
                first_bbox,
                second_bbox,
            )

            if intersection is None:
                continue

            first_area = bbox_area(first_bbox)
            second_area = bbox_area(second_bbox)
            intersection_area = bbox_area(intersection)

            if first_area <= 0 or second_area <= 0:
                continue

            results.append({
                "product_a": first.get("id"),
                "product_b": second.get("id"),
                "intersection_bbox": intersection,
                "intersection_area_sq_degrees": round(
                    intersection_area,
                    8,
                ),
                "product_a_overlap_fraction": round(
                    intersection_area / first_area,
                    6,
                ),
                "product_b_overlap_fraction": round(
                    intersection_area / second_area,
                    6,
                ),
                "interpretation": (
                    "Potential overlapping bounding boxes. "
                    "Check actual raster footprints and alignment "
                    "before mosaicking."
                ),
            })

    return results


# ============================================================
# COLLECTION FILTERING
# ============================================================

def filter_products(
    products: list[dict],
    include_test: bool,
) -> tuple[list[dict], list[dict]]:

    included = []
    excluded = []

    for product in products:
        collection = product.get("collection", "")

        if (
            not include_test
            and is_test_collection(collection)
        ):
            excluded.append({
                "id": product.get("id"),
                "collection": collection,
                "reason": "Test collection excluded.",
            })
            continue

        included.append(product)

    return included, excluded


# ============================================================
# MAIN VALIDATION
# ============================================================

def validate_catalog(
    catalog: dict,
    selected_region: str | None = None,
    include_test: bool = False,
    top: int = 20,
) -> dict:
    """Validate catalog products using the coded Gazetteer borders."""

    if shape is None or wkt is None:
        raise RuntimeError(
            "Shapely is required for boundary validation. "
            "Install it with: pip install shapely"
        )

    regions = catalog.get("regions", {})

    if not isinstance(regions, dict):
        raise ValueError(
            "Catalog does not contain a valid 'regions' object."
        )

    region_keys = (
        [selected_region]
        if selected_region
        else list(regions.keys())
    )

    unknown_regions = [
        key
        for key in region_keys
        if key not in regions
    ]

    if unknown_regions:
        raise ValueError(
            "Unknown catalog region(s): "
            + ", ".join(unknown_regions)
        )

    unsupported_regions = [
        key
        for key in region_keys
        if key not in REGION_DEFINITIONS
    ]

    if unsupported_regions:
        raise ValueError(
            "No coded Gazetteer boundary is configured for: "
            + ", ".join(unsupported_regions)
        )

    # --------------------------------------------------------
    # Retrieve each exact coded boundary once.
    # --------------------------------------------------------

    boundaries = {}

    for region_key in region_keys:
        print(
            f"Retrieving USGS Gazetteer boundary: "
            f"{REGION_NAMES[region_key]}..."
        )

        retrieved = retrieve_gazetteer_boundary(
            region_key
        )

        geometry = retrieved["geometry"]

        projection = make_mars_projection(
            geometry
        )

        boundaries[region_key] = {
            "geometry": geometry,
            "projection": projection,
            "metadata": retrieved["metadata"],
        }

    # --------------------------------------------------------
    # Collect products.
    # --------------------------------------------------------

    all_products = []

    for region_key in region_keys:
        region_data = regions[region_key]

        products = region_data.get("products", [])

        if not isinstance(products, list):
            continue

        for product in products:
            if isinstance(product, dict):
                all_products.append(product)

    included_products, excluded_products = filter_products(
        all_products,
        include_test,
    )

    inspected_products = [
        inspect_product(product)
        for product in included_products
    ]

    inspected_by_id = {
        item["id"]: item
        for item in inspected_products
    }

    # --------------------------------------------------------
    # Evaluate each region against its Gazetteer polygon.
    # --------------------------------------------------------

    region_reports = {}

    for region_key in region_keys:
        region_data = regions[region_key]
        boundary = boundaries[region_key]

        original_products = region_data.get(
            "products",
            [],
        )

        region_candidates = []

        for original in original_products:
            if not isinstance(original, dict):
                continue

            collection = original.get("collection", "")

            if (
                not include_test
                and is_test_collection(collection)
            ):
                continue

            inspected = inspected_by_id.get(
                original.get("id")
            )

            if inspected is None:
                continue

            evaluated = evaluate_product_for_region(
                {
                    **original,
                    **inspected,
                },
                region_key,
                region_data,
                boundary,
            )

            region_candidates.append(evaluated)

        region_candidates.sort(
            key=lambda item: (
                item["scores"]["ranking"],
                item["overlap"]["region_coverage_fraction"],
                -(
                    item["gsd_m_per_pixel"]
                    if item["gsd_m_per_pixel"] is not None
                    else float("inf")
                ),
            ),
            reverse=True,
        )

        eligible_candidates = [
            item
            for item in region_candidates
            if item["status"] not in {
                "outside_region",
                "missing_or_invalid_geometry",
            }
        ]

        overlap_pairs = detect_product_overlaps(
            eligible_candidates
        )

        boundary_metadata = boundary["metadata"]

        region_reports[region_key] = {
            "name": region_data.get(
                "name",
                REGION_NAMES.get(region_key, region_key),
            ),
            "discovery_search_bbox": region_data.get(
                "search_bbox"
            ),
            "boundary": {
                **boundary_metadata,
                "geometry_area_km2": round(
                    project_geometry(
                        boundary["geometry"],
                        boundary["projection"],
                    ).area / 1_000_000.0,
                    4,
                ),
                "coverage_calculation": (
                    "Product footprint intersection with the "
                    "USGS Gazetteer named-feature polygon."
                ),
            },
            "discovered_product_count": region_data.get(
                "product_count",
                len(original_products),
            ),
            "validated_product_count": len(region_candidates),
            "eligible_candidate_count": len(
                eligible_candidates
            ),
            "products_with_dtm_assets": sum(
                1
                for item in region_candidates
                if item["has_confident_dtm"]
            ),
            "products_with_orthophoto_assets": sum(
                1
                for item in region_candidates
                if item["has_confident_orthophoto"]
            ),
            "top_candidates": region_candidates[:top],
            "all_candidates": region_candidates,
            "potential_mosaic_overlaps": overlap_pairs,
        }

    # --------------------------------------------------------
    # Asset classification totals.
    # --------------------------------------------------------

    total_asset_counts = Counter()

    for product in inspected_products:
        for key, value in product["asset_summary"].items():
            if key == "total":
                continue

            total_asset_counts[key] += value

    return {
        "generated": datetime.now(
            timezone.utc
        ).isoformat(),
        "validator_version": "2.0.0",
        "boundary_source": {
            "name": GAZETTEER_SOURCE,
            "endpoint": GAZETTEER_FEATURE_URL,
            "coordinate_system": GAZETTEER_COORDINATE_SYSTEM,
            "longitude_convention": "-180 to 180 degrees",
            "disclaimer": BOUNDARY_DISCLAIMER,
        },
        "source": {
            "catalog_generated": catalog.get("generated"),
            "api": catalog.get("api"),
            "input_product_filter": catalog.get(
                "search_settings",
                {},
            ).get("product_filter"),
        },
        "settings": {
            "include_test_collections": include_test,
            "selected_regions": region_keys,
            "boundary_method": (
                "USGS Gazetteer named-feature polygon"
            ),
            "area_calculation": {
                "method": "Local Mars-centered equirectangular projection",
                "mars_sphere_radius_m": MARS_RADIUS_METERS,
                "units": "square metres, converted to square kilometres",
            },
            "ranking_weights": {
                "coverage": 0.45,
                "resolution": 0.25,
                "dtm_evidence": 0.25,
                "orthophoto_evidence": 0.05,
            },
            "top_candidates_limit": top,
            "asset_classification": (
                "Heuristic STAC metadata and filename inspection"
            ),
        },
        "summary": {
            "products_inspected": len(inspected_products),
            "products_excluded": len(excluded_products),
            "asset_classification_totals": dict(
                total_asset_counts
            ),
        },
        "excluded_products": excluded_products,
        "regions": region_reports,
        "interpretation_notes": [
            (
                "Regional coverage is calculated against the coded "
                "USGS Gazetteer named-feature polygon, not the "
                "rectangular discovery search extent."
            ),
            (
                "Gazetteer boundaries are approximate named-feature "
                "extents, not precise geological boundaries."
            ),
            (
                "The discovery search bounding boxes remain useful "
                "for product discovery but are not used for final "
                "regional coverage."
            ),
            (
                "Mars area calculations use a local equirectangular "
                "projection centered on each Gazetteer boundary. "
                "Area results are approximate."
            ),
            (
                "STAC and Gazetteer geometries are normalized to "
                "the -180 to 180 longitude convention before "
                "intersection."
            ),
            (
                "Asset classification uses STAC metadata and "
                "filename keywords. It does not verify raster contents."
            ),
            (
                "A DTM classification is a candidate identification, "
                "not proof that the remote file is a valid elevation raster."
            ),
            (
                "Product-level GSD is nominal pixel spacing. It does "
                "not establish effective terrain accuracy."
            ),
            (
                "Overlapping bounding boxes do not guarantee that "
                "products can be mosaicked together."
            ),
            (
                "Orthophoto assets are not automatically paired with "
                "DTM assets. Pairing requires product-specific verification."
            ),
            (
                "No remote raster asset was downloaded or opened "
                "by this validator."
            ),
        ],
    }


# ============================================================
# REPORT OUTPUT
# ============================================================

def write_report(
    report: dict,
    output_path: Path,
) -> None:

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with output_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            json_safe(report),
            file,
            indent=2,
            ensure_ascii=False,
        )


# ============================================================
# TERMINAL SUMMARY
# ============================================================

def print_summary(report: dict) -> None:
    print()
    print("=" * 72)
    print("HiRISE DTM CATALOG VALIDATION")
    print("=" * 72)

    summary = report["summary"]

    print(
        f"Products inspected: "
        f"{summary['products_inspected']}"
    )

    print(
        f"Products excluded:  "
        f"{summary['products_excluded']}"
    )

    print()
    print("ASSET CLASSIFICATION")
    print("-" * 72)

    for name, count in summary[
        "asset_classification_totals"
    ].items():
        print(f"{name:24} {count}")

    for region_key, region in report["regions"].items():
        print()
        print("=" * 72)
        print(region["name"].upper())
        print("=" * 72)

        boundary = region["boundary"]

        print(
            f"Boundary source:     "
            f"{boundary['source']}"
        )

        print(
            f"Gazetteer feature:   "
            f"{boundary['feature_id']}"
        )

        print(
            f"Boundary geometry:   "
            f"{boundary['geometry_type']}"
        )

        print(
            f"Boundary area:       "
            f"{boundary['geometry_area_km2']:.2f} km²"
        )

        print(
            f"Discovered products: "
            f"{region['discovered_product_count']}"
        )

        print(
            f"Validated products:  "
            f"{region['validated_product_count']}"
        )

        print(
            f"Eligible candidates: "
            f"{region['eligible_candidate_count']}"
        )

        print(
            f"Products with DTM:   "
            f"{region['products_with_dtm_assets']}"
        )

        print(
            f"Products with ortho: "
            f"{region['products_with_orthophoto_assets']}"
        )

        print()
        print("TOP CANDIDATES")
        print("-" * 72)

        candidates = region["top_candidates"]

        if not candidates:
            print("No candidates found.")
            continue

        for index, candidate in enumerate(
            candidates,
            start=1,
        ):
            gsd = candidate["gsd_m_per_pixel"]

            gsd_text = (
                f"{gsd:.3f} m/px"
                if gsd is not None
                else "Unknown GSD"
            )

            overlap = candidate["overlap"][
                "region_coverage_percent"
            ]

            print(
                f"{index:2}. {candidate['id']}"
            )

            print(
                f"    Ranking: {candidate['scores']['ranking']:.2f}"
                f" | GSD: {gsd_text}"
                f" | Gazetteer coverage: {overlap:.2f}%"
            )

            print(
                f"    DTM assets: "
                f"{candidate['assets']['dtm']}"
                f" | Ortho assets: "
                f"{candidate['assets']['orthophoto']}"
                f" | Status: {candidate['status']}"
            )

    print()
    print("=" * 72)
    print("VALIDATION COMPLETE")
    print("=" * 72)


# ============================================================
# COMMAND LINE
# ============================================================

def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate discovered HiRISE DTM STAC products "
            "against the coded USGS Gazetteer boundaries."
        )
    )

    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help="Path to hirise_dtm_catalog.json.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Path to validation JSON output.",
    )

    parser.add_argument(
        "--region",
        choices=list(REGION_NAMES.keys()),
        default=None,
        help="Validate only one catalog region.",
    )

    parser.add_argument(
        "--include-test",
        action="store_true",
        help="Include test collections.",
    )

    parser.add_argument(
        "--top",
        type=int,
        default=20,
        help="Number of top candidates displayed per region.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_arguments()

    if args.top < 1:
        print(
            "ERROR: --top must be at least 1.",
            file=sys.stderr,
        )
        return 1

    input_path = args.input.resolve()
    output_path = args.output.resolve()

    print("=" * 72)
    print("HiRISE DTM VALIDATOR")
    print("=" * 72)

    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")

    if not input_path.exists():
        print()
        print("ERROR: Catalog file was not found.")
        print()
        print("Expected location:")
        print(DEFAULT_INPUT)
        print()
        print(
            "Use --input to specify another catalog location."
        )
        return 1

    try:
        with input_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            catalog = json.load(file)

    except json.JSONDecodeError as error:
        print()
        print(f"ERROR: Invalid JSON: {error}")
        return 1

    except OSError as error:
        print()
        print(f"ERROR: Could not read catalog: {error}")
        return 1

    if not isinstance(catalog, dict):
        print()
        print("ERROR: Catalog root must be a JSON object.")
        return 1

    try:
        report = validate_catalog(
            catalog=catalog,
            selected_region=args.region,
            include_test=args.include_test,
            top=args.top,
        )

        write_report(
            report,
            output_path,
        )

        print_summary(report)

        print()
        print(f"Report saved to: {output_path}")

        return 0

    except Exception as error:
        print()
        print(
            f"VALIDATION ERROR: "
            f"{type(error).__name__}: {error}"
        )

        return 1


if __name__ == "__main__":
    raise SystemExit(main())
