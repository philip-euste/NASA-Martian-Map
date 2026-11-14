
import rasterio
from rasterio.warp import transform

DEM_URL = (
    "https://astrogeo-ard.s3-us-west-2.amazonaws.com/"
    "mars/mro/hirise/controlled/dtm/"
    "ESP_048842_1985_ESP_048908_1985/"
    "DTEEC_048842_1985_048908_1985_U01.tif"
)

LONGITUDE = 77.52
LATITUDE = 18.46


def test_coordinate():
    remote_path = f"/vsicurl/{DEM_URL}"

    with rasterio.open(remote_path) as dataset:
        # Convert Mars longitude/latitude into raster coordinates.
        coordinates = transform(
            dataset.crs.geodetic_crs,
            dataset.crs,
            [LONGITUDE],
            [LATITUDE],
        )

        x_values = coordinates[0]
        y_values = coordinates[1]

        x = x_values[0]
        y = y_values[0]

        # Convert projected coordinates into pixel indices.
        row, col = dataset.index(x, y)

        print("Input longitude:", LONGITUDE)
        print("Input latitude:", LATITUDE)
        print("Projected X:", x)
        print("Projected Y:", y)
        print("Pixel row:", row)
        print("Pixel column:", col)

        if not (0 <= row < dataset.height and 0 <= col < dataset.width):
            print("FAIL: Coordinate is outside the DEM.")
            return

        # Read only one pixel from the remote raster.
        window = (
            (row, row + 1),
            (col, col + 1),
        )

        elevation = dataset.read(1, window=window, masked=True)[0, 0]

        if elevation is not None and not getattr(elevation, "mask", False):
            print("Elevation:", float(elevation), "metres")
            print("PASS: Coordinate lookup successful.")
        else:
            print("WARNING: Coordinate contains NoData.")


if __name__ == "__main__":
    test_coordinate()
