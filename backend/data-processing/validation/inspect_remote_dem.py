
import rasterio

DEM_URL = (
    "https://astrogeo-ard.s3-us-west-2.amazonaws.com/"
    "mars/mro/hirise/controlled/dtm/"
    "ESP_048842_1985_ESP_048908_1985/"
    "DTEEC_048842_1985_048908_1985_U01.tif"
)


def inspect_dem():
    remote_path = f"/vsicurl/{DEM_URL}"

    print("Opening remote HiRISE DTM...")

    try:
        with rasterio.open(remote_path) as dataset:
            print("\n--- DEM METADATA ---")
            print("Driver:", dataset.driver)
            print("Width:", dataset.width)
            print("Height:", dataset.height)
            print("Bands:", dataset.count)
            print("Data type:", dataset.dtypes)
            print("CRS:", dataset.crs)
            print("Bounds:", dataset.bounds)
            print("Resolution:", dataset.res)
            print("NoData:", dataset.nodata)
            print("Transform:", dataset.transform)

            print("\n--- VALIDATION ---")

            if dataset.count != 1:
                print("WARNING: Expected a single elevation band.")
            else:
                print("PASS: Single elevation band.")

            if dataset.width > 0 and dataset.height > 0:
                print("PASS: Valid raster dimensions.")
            else:
                print("FAIL: Invalid raster dimensions.")

            print("PASS: Remote raster metadata retrieved.")

            print("\n--- ELEVATION DATA ---")
            
            band = dataset.tags(1)

            print("Band units:", dataset.units)
            print("Band scales:", dataset.scales)
            print("Band offsets:", dataset.offsets)
            print("Band tags:", band)
            print("Dataset tags:", dataset.tags())
            print("Block shapes:", dataset.block_shapes)

            sample = dataset.read(1, window=((1000, 1010), (1000, 1010)))
            valid = sample[sample != dataset.nodata]

            if valid.size:
                print("Sample minimum:", float(valid.min()))
                print("Sample maximum:", float(valid.max()))
                print("Sample mean:", float(valid.mean()))
            else:
                print("WARNING: Sample contains only NoData values.")

    except Exception as error:
        print("FAILED:", error)


if __name__ == "__main__":
    inspect_dem()
