
import json
import re
from html.parser import HTMLParser
from typing import Any

import httpx

from fastapi import HTTPException
from shapely import wkt
from shapely.geometry import (
    GeometryCollection,
    MultiPolygon,
    Polygon,
    shape,
)
from shapely.ops import transform, unary_union


# =========================================================
# USGS MARS GEOLOGY SERVICE
# =========================================================

GEOLOGY_LAYER_URL = (
    "https://services.arcgis.com/nzS0F0zdNLvs7nc8/"
    "ArcGIS/rest/services/Mars_Geology_feature_layer/"
    "FeatureServer/0"
)

MARS_SPATIAL_REFERENCE = 104971

REQUEST_TIMEOUT = 60

GEOLOGY_FIELDS = "OBJECTID,Unit,UnitDesc,SphArea_km"


# =========================================================
# USGS / IAU GAZETTEER
# =========================================================

GAZETTEER_FEATURE_URL = (
    "https://planetarynames.wr.usgs.gov/Feature"
)

GAZETTEER_SOURCE = (
    "USGS Gazetteer of Planetary Nomenclature"
)

GAZETTEER_COORDINATE_SYSTEM = (
    "Planetocentric, +East, 0-360"
)

# In-memory cache for the lifetime of the backend process.
BOUNDARY_CACHE = {}


# =========================================================
# FOUR STUDY AREAS
# =========================================================

MARS_REGIONS = {
    "jezero": {
        "id": "jezero",
        "name": "Jezero Crater",
        "category": "Impact Crater",
        "feature_id": 14300,
        "center": {
            "latitude": 18.41,
            "longitude": 77.69,
        },
        "extent": {
            "west": 72.0,
            "south": 14.0,
            "east": 83.0,
            "north": 23.0,
        },
        "description": (
            "An ancient impact crater containing evidence "
            "of a former lake and river delta."
        ),
    },
    "gale": {
        "id": "gale",
        "name": "Gale Crater",
        "category": "Impact Crater",
        "feature_id": 2071,
        "center": {
            "latitude": -5.44,
            "longitude": 137.70,
        },
        "extent": {
            "west": 130.0,
            "south": -12.0,
            "east": 145.0,
            "north": 1.0,
        },
        "description": (
            "An impact crater explored by NASA's Curiosity rover."
        ),
    },
    "valles-marineris": {
        "id": "valles-marineris",
        "name": "Valles Marineris",
        "category": "Canyon System",
        "feature_id": 6288,
        "center": {
            "latitude": -13.74,
            "longitude": -59.20,
        },
        "extent": {
            "west": -75.0,
            "south": -20.0,
            "east": -40.0,
            "north": -5.0,
        },
        "description": (
            "A vast equatorial canyon system extending "
            "across the Martian surface."
        ),
    },
    "olympus-mons": {
        "id": "olympus-mons",
        "name": "Olympus Mons",
        "category": "Shield Volcano",
        "feature_id": 4453,
        "center": {
            "latitude": 18.65,
            "longitude": -133.80,
        },
        "extent": {
            "west": -145.0,
            "south": 12.0,
            "east": -120.0,
            "north": 25.0,
        },
        "description": (
            "A giant shield volcano and one of the largest "
            "volcanoes in the Solar System."
        ),
    },
}


# =========================================================
# GENERAL HELPERS
# =========================================================

def get_region(region_id: str):
    region = MARS_REGIONS.get(region_id.lower())

    if region is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown Mars study region: {region_id}",
        )

    return region


class GazetteerTextParser(HTMLParser):
    """Extract readable text from a Gazetteer HTML page."""

    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def get_text(self):
        return " ".join(self.parts)


def extract_wkt_from_html(html: str):
    """Extract the first Polygon or MultiPolygon WKT."""

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
            "No polygon WKT found in the Gazetteer page."
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
    """

    longitude = float(longitude)

    if longitude > 180:
        longitude -= 360

    return longitude


def normalize_geometry_longitudes(geometry):
    def normalize_coordinates(
        x: Any,
        y: Any,
        z: Any = None,
    ) -> tuple[Any, ...]:
        if isinstance(x, (list, tuple)):
            normalized_x = [
                normalize_longitude(value) for value in x
            ]
        else:
            normalized_x = normalize_longitude(x)

        if z is None:
            return normalized_x, y

        return normalized_x, y, z

    return transform(normalize_coordinates, geometry)


# =========================================================
# GEOJSON CONVERSION
# =========================================================

def polygon_to_geojson_coordinates(polygon: Polygon):
    """
    Convert a Shapely Polygon into GeoJSON polygon coordinates.

    Every position is [longitude, latitude].
    """

    rings = []

    exterior = [
        [
            normalize_longitude(longitude),
            float(latitude),
        ]
        for longitude, latitude in polygon.exterior.coords
    ]

    rings.append(exterior)

    for interior in polygon.interiors:
        ring = [
            [
                normalize_longitude(longitude),
                float(latitude),
            ]
            for longitude, latitude in interior.coords
        ]

        rings.append(ring)

    return rings


def geometry_to_geojson(geometry):
    """Convert Shapely Polygon or MultiPolygon to GeoJSON."""

    if isinstance(geometry, Polygon):
        return {
            "type": "Polygon",
            "coordinates": polygon_to_geojson_coordinates(
                geometry
            ),
        }

    if isinstance(geometry, MultiPolygon):
        polygons = [
            polygon_to_geojson_coordinates(polygon)
            for polygon in geometry.geoms
        ]

        return {
            "type": "MultiPolygon",
            "coordinates": polygons,
        }

    raise ValueError(
        f"Unsupported geometry type: {geometry.geom_type}"
    )


# =========================================================
# POLYGON EXTRACTION
# =========================================================

def extract_polygonal_geometry(geometry):
    """
    Extract polygon components from an intersection result.

    Intersection operations can return:
    - Polygon
    - MultiPolygon
    - GeometryCollection

    Lines and points are excluded because this endpoint
    returns geological surface areas.
    """

    if geometry.is_empty:
        return None

    if isinstance(geometry, Polygon):
        return geometry

    if isinstance(geometry, MultiPolygon):
        return geometry

    if isinstance(geometry, GeometryCollection):
        polygons = []

        for part in geometry.geoms:
            polygonal_part = extract_polygonal_geometry(part)

            if polygonal_part is None:
                continue

            if isinstance(polygonal_part, Polygon):
                polygons.append(polygonal_part)

            elif isinstance(polygonal_part, MultiPolygon):
                polygons.extend(polygonal_part.geoms)

        if not polygons:
            return None

        return unary_union(polygons)

    return None


# =========================================================
# STUDY AREA GEOJSON
# =========================================================

def build_study_area_geojson(region):
    """
    Return the rectangular investigation extent.

    This is separate from the Gazetteer feature boundary.
    """

    extent = region["extent"]

    west = extent["west"]
    south = extent["south"]
    east = extent["east"]
    north = extent["north"]

    return {
        "type": "Feature",
        "properties": {
            "region_id": region["id"],
            "region_name": region["name"],
            "geometry_status": "approximate_study_extent",
            "description": (
                "Rectangular investigation extent. "
                "Not an authoritative planetary feature boundary."
            ),
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
            ]],
        },
    }


# =========================================================
# GAZETTEER FEATURE BOUNDARY RETRIEVAL
# =========================================================

async def get_region_boundary_geojson(region_id: str):
    region = get_region(region_id)

    if region["id"] in BOUNDARY_CACHE:
        return BOUNDARY_CACHE[region["id"]]

    feature_id = region["feature_id"]

    feature_url = (
        f"{GAZETTEER_FEATURE_URL}/{feature_id}"
    )

    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        ) as client:

            response = await client.get(feature_url)
            response.raise_for_status()

    except httpx.TimeoutException as error:
        raise HTTPException(
            status_code=504,
            detail="USGS Gazetteer request timed out.",
        ) from error

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"USGS Gazetteer request failed: {error}",
        ) from error

    try:
        geometry_wkt = extract_wkt_from_html(
            response.text
        )

        geometry = wkt.loads(geometry_wkt)

        if not isinstance(geometry, (Polygon, MultiPolygon)):
            raise ValueError(
                f"Unsupported geometry type: {geometry.geom_type}"
            )

        if geometry.is_empty or not geometry.is_valid:
            raise ValueError(
                "Gazetteer returned an empty or invalid polygon."
            )

        geometry = normalize_geometry_longitudes(geometry)

        geometry_geojson = geometry_to_geojson(geometry)

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to parse the USGS Gazetteer "
                f"boundary geometry: {error}"
            ),
        ) from error

    result = {
        "region_id": region["id"],
        "region_name": region["name"],
        "boundary_status": "gazetteer_named_feature_geometry",
        "boundary_accuracy": "approximate_named_feature_extent",
        "source": {
            "name": GAZETTEER_SOURCE,
            "feature_id": feature_id,
            "feature_url": feature_url,
            "coordinate_system": (
                GAZETTEER_COORDINATE_SYSTEM
            ),
            "output_longitude_convention": (
                "-180 to 180 degrees"
            ),
            "geometry_format": "WKT converted to GeoJSON",
        },
        "disclaimer": (
            "The Gazetteer describes these boundaries as "
            "approximate representations of named-feature "
            "locations and rough extents. They should not "
            "be interpreted as precise geological boundaries."
        ),
        "feature": {
            "type": "Feature",
            "properties": {
                "region_id": region["id"],
                "region_name": region["name"],
                "feature_id": feature_id,
                "geometry_status": (
                    "gazetteer_named_feature_geometry"
                ),
                "source": GAZETTEER_SOURCE,
            },
            "geometry": geometry_geojson,
        },
    }

    BOUNDARY_CACHE[region["id"]] = result

    return result


# =========================================================
# GEOLOGICAL UNIT RETRIEVAL AND CLIPPING
# =========================================================

async def get_region_geology(region_id: str):
    """
    Retrieve geological polygons from USGS and clip them
    to the Gazetteer named-feature geometry.

    The rectangular extent is used for the initial service
    query. The Gazetteer geometry is used for the final clip.
    """

    region = get_region(region_id)
    extent = region["extent"]

    # -----------------------------------------------------
    # 1. Retrieve the named-feature boundary
    # -----------------------------------------------------

    boundary_result = await get_region_boundary_geojson(
        region_id
    )

    try:
        boundary_geometry = shape(
            boundary_result["feature"]["geometry"]
        )

        if (
            boundary_geometry.is_empty
            or not boundary_geometry.is_valid
        ):
            raise ValueError(
                "The region boundary is empty or invalid."
            )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to prepare the region boundary "
                f"for geological clipping: {error}"
            ),
        ) from error

    # -----------------------------------------------------
    # 2. Query geological polygons using the search extent
    # -----------------------------------------------------

    query_geometry = {
        "xmin": extent["west"],
        "ymin": extent["south"],
        "xmax": extent["east"],
        "ymax": extent["north"],
        "spatialReference": {
            "wkid": MARS_SPATIAL_REFERENCE,
        },
    }

    params = {
        "where": "1=1",
        "geometry": json.dumps(query_geometry),
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": MARS_SPATIAL_REFERENCE,
        "outFields": GEOLOGY_FIELDS,
        "returnGeometry": "true",
        "resultRecordCount": 2000,
        "f": "geojson",
    }

    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        ) as client:

            response = await client.get(
                f"{GEOLOGY_LAYER_URL}/query",
                params=params,
            )

            response.raise_for_status()
            data = response.json()

    except httpx.TimeoutException as error:
        raise HTTPException(
            status_code=504,
            detail="USGS geology service timed out.",
        ) from error

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"USGS geology request failed: {error}",
        ) from error

    except ValueError as error:
        raise HTTPException(
            status_code=502,
            detail="USGS returned invalid JSON.",
        ) from error

    if data.get("error"):
        raise HTTPException(
            status_code=502,
            detail={
                "message": "USGS rejected the geology query.",
                "source_error": data["error"],
            },
        )

    if data.get("type") != "FeatureCollection":
        raise HTTPException(
            status_code=502,
            detail=(
                "USGS response is not a GeoJSON "
                "FeatureCollection."
            ),
        )

    source_features = data.get("features", [])

    # -----------------------------------------------------
    # 3. Clip every geological feature to the boundary
    # -----------------------------------------------------

    clipped_features = []
    repaired_geometry_count = 0
    excluded_feature_count = 0

    for feature in source_features:
        source_geometry_data = feature.get("geometry")

        if source_geometry_data is None:
            excluded_feature_count += 1
            continue

        try:
            source_geometry = shape(source_geometry_data)

            if source_geometry.is_empty:
                excluded_feature_count += 1
                continue

            # Normalize source longitudes to match the
            # Gazetteer boundary's -180 to 180 convention.
            source_geometry = normalize_geometry_longitudes(
                source_geometry
            )

            # Repair invalid source geometry before intersection.
            if not source_geometry.is_valid:
                source_geometry = source_geometry.buffer(0)
                repaired_geometry_count += 1

            if source_geometry.is_empty:
                excluded_feature_count += 1
                continue

            intersection = source_geometry.intersection(
                boundary_geometry
            )

            polygonal_intersection = extract_polygonal_geometry(
                intersection
            )

            if (
                polygonal_intersection is None
                or polygonal_intersection.is_empty
            ):
                excluded_feature_count += 1
                continue

            if not polygonal_intersection.is_valid:
                polygonal_intersection = (
                    polygonal_intersection.buffer(0)
                )

            if (
                polygonal_intersection.is_empty
                or not polygonal_intersection.is_valid
            ):
                excluded_feature_count += 1
                continue

            clipped_geometry = geometry_to_geojson(
                polygonal_intersection
            )

            # Preserve the original feature and its attributes.
            clipped_feature = dict(feature)
            clipped_feature["geometry"] = clipped_geometry

            properties = dict(
                feature.get("properties") or {}
            )

            properties["clipped_to_region_boundary"] = True
            properties["clip_boundary_feature_id"] = (
                region["feature_id"]
            )

            clipped_feature["properties"] = properties

            clipped_features.append(clipped_feature)

        except Exception as error:
            object_id = (
                (feature.get("properties") or {}).get("OBJECTID")
            )

            raise HTTPException(
                status_code=502,
                detail=(
                    "Failed to clip a geological feature "
                    f"(OBJECTID: {object_id}): {error}"
                ),
            ) from error

    # -----------------------------------------------------
    # 4. Return clipped geological FeatureCollection
    # -----------------------------------------------------

    return {
        "region": {
            "id": region["id"],
            "name": region["name"],
            "category": region["category"],
            "center": region["center"],
            "extent": region["extent"],
            "feature_id": region["feature_id"],
        },
        "source": {
            "name": "USGS Mars Geology Feature Layer",
            "url": GEOLOGY_LAYER_URL,
            "layer": "Geology",
            "spatial_reference": MARS_SPATIAL_REFERENCE,
            "geometry_type": "esriGeometryPolygon",
        },
        "boundary": {
            "source": GAZETTEER_SOURCE,
            "feature_id": region["feature_id"],
            "accuracy": "approximate_named_feature_extent",
            "clipping_method": (
                "Shapely geometric intersection"
            ),
        },
        "geometry_status": (
            "geological_polygons_clipped_to_"
            "approximate_named_feature_boundary"
        ),
        "query": {
            "spatial_relationship": "intersects",
            "geometry_type": "esriGeometryEnvelope",
            "extent": extent,
            "clipping_geometry": (
                "USGS Gazetteer named-feature polygon"
            ),
        },
        "source_count": len(source_features),
        "count": len(clipped_features),
        "clipped_count": len(clipped_features),
        "excluded_count": excluded_feature_count,
        "repaired_source_geometry_count": (
            repaired_geometry_count
        ),
        "features": clipped_features,
    }
