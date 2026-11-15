
from fastapi import APIRouter

from ..services.mars_region_service import (
    MARS_REGIONS,
    build_study_area_geojson,
    get_region,
    get_region_boundary_geojson,
    get_region_geology,
)


router = APIRouter(
    prefix="/api/regions",
    tags=["Mars Regions"],
)


@router.get("")
def list_regions():
    """Return the four configured Mars study regions."""

    regions = []

    for region in MARS_REGIONS.values():
        regions.append({
            **region,
            "boundary_status": (
                "gazetteer_named_feature_geometry"
            ),
            "geology_endpoint": (
                f"/api/regions/{region['id']}/geology"
            ),
            "boundary_endpoint": (
                f"/api/regions/{region['id']}/boundary"
            ),
            "study_area_endpoint": (
                f"/api/regions/{region['id']}/study-area"
            ),
        })

    return {
        "count": len(regions),
        "regions": regions,
    }


@router.get("/{region_id}")
def get_region_details(region_id: str):
    """Return metadata for one study region."""

    region = get_region(region_id)

    return {
        **region,
        "boundary_status": (
            "gazetteer_named_feature_geometry"
        ),
        "boundary_source": (
            "USGS Gazetteer of Planetary Nomenclature"
        ),
    }


@router.get("/{region_id}/boundary")
async def get_region_boundary(region_id: str):
    """
    Return the USGS Gazetteer named-feature polygon.

    This is an approximate named-feature extent,
    not a precise geological delineation.
    """

    return await get_region_boundary_geojson(region_id)


@router.get("/{region_id}/study-area")
def get_region_study_area(region_id: str):
    """
    Return the rectangular investigation/search extent.

    This is not the named-feature boundary.
    """

    region = get_region(region_id)

    return {
        "region_id": region["id"],
        "region_name": region["name"],
        "boundary_status": "approximate_study_extent",
        "spatial_reference": 104971,
        "feature": build_study_area_geojson(region),
    }


@router.get("/{region_id}/geology")
async def get_region_geological_units(region_id: str):
    """Retrieve USGS geological polygons intersecting the study area."""

    return await get_region_geology(region_id)
