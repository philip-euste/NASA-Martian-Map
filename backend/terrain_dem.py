
import rasterio
from rasterio.warp import transform
from fastapi import APIRouter, HTTPException, Query

DEM_URL = (
    "https://astrogeo-ard.s3-us-west-2.amazonaws.com/"
    "mars/mro/hirise/controlled/dtm/"
    "ESP_048842_1985_ESP_048908_1985/"
    "DTEEC_048842_1985_048908_1985_U01.tif"
)

router = APIRouter(prefix="/api/terrain/dem", tags=["Mars DEM"])

REMOTE_PATH = f"/vsicurl/{DEM_URL}"


def open_dem():
    try:
        return rasterio.open(REMOTE_PATH)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to access remote DEM: {error}",
        )


def project_coordinate(dataset, longitude, latitude):
    coordinates = transform(
        dataset.crs.geodetic_crs,
        dataset.crs,
        [longitude],
        [latitude],
    )

    return coordinates[0][0], coordinates[1][0]


def get_pixel(dataset, longitude, latitude):
    x, y = project_coordinate(dataset, longitude, latitude)
    row, col = dataset.index(x, y)

    if not (
        0 <= row < dataset.height
        and 0 <= col < dataset.width
    ):
        raise HTTPException(
            status_code=404,
            detail="Coordinate is outside this DEM's coverage.",
        )

    return row, col, x, y


@router.get("/info")
def get_dem_info():
    with open_dem() as dataset:
        return {
            "product_id": "DTEEC_048842_1985_048908_1985_U01",
            "width": dataset.width,
            "height": dataset.height,
            "bands": dataset.count,
            "data_type": dataset.dtypes[0],
            "crs": dataset.crs.to_string(),
            "resolution": dataset.res,
            "nodata": dataset.nodata,
            "elevation_unit": "metres",
            "vertical_reference": "Mars 2000",
            "access": "Remote Cloud Optimized GeoTIFF",
        }


@router.get("/elevation")
def get_elevation(
    longitude: float = Query(ge=-180, le=180),
    latitude: float = Query(ge=-90, le=90),
):
    with open_dem() as dataset:
        row, col, x, y = get_pixel(
            dataset, longitude, latitude
        )

        sample = dataset.read(
            1,
            window=((row, row + 1), (col, col + 1)),
            masked=True,
        )

        value = sample[0, 0]

        if value is None or bool(sample.mask[0, 0]):
            raise HTTPException(
                status_code=404,
                detail="No elevation data at this coordinate.",
            )

        return {
            "longitude": longitude,
            "latitude": latitude,
            "projected_x": x,
            "projected_y": y,
            "row": row,
            "column": col,
            "elevation": float(value),
            "unit": "metres",
            "product_id": "DTEEC_048842_1985_048908_1985_U01",
        }


@router.get("/window")
def get_elevation_window(
    longitude: float = Query(ge=-180, le=180),
    latitude: float = Query(ge=-90, le=90),
    width: int = Query(default=32, ge=1, le=128),
    height: int = Query(default=32, ge=1, le=128),
):
    with open_dem() as dataset:
        row, col, x, y = get_pixel(
            dataset, longitude, latitude
        )

        row_start = row - height // 2
        col_start = col - width // 2

        row_end = row_start + height
        col_end = col_start + width

        if (
            row_start < 0
            or col_start < 0
            or row_end > dataset.height
            or col_end > dataset.width
        ):
            raise HTTPException(
                status_code=400,
                detail="Requested window extends outside DEM coverage.",
            )

        sample = dataset.read(
            1,
            window=(
                (row_start, row_end),
                (col_start, col_end),
            ),
            masked=True,
        )

        values = [
            [
                None if bool(sample.mask[r, c])
                else float(sample[r, c])
                for c in range(width)
            ]
            for r in range(height)
        ]

        return {
            "center": {
                "longitude": longitude,
                "latitude": latitude,
                "projected_x": x,
                "projected_y": y,
            },
            "dimensions": {
                "width": width,
                "height": height,
            },
            "pixel_origin": {
                "row": row_start,
                "column": col_start,
            },
            "resolution": dataset.res,
            "elevations": values,
            "unit": "metres",
            "product_id": "DTEEC_048842_1985_048908_1985_U01",
        }
