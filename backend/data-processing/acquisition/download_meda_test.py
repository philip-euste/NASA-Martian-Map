
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


# =========================================================
# CONFIGURATION
# =========================================================

BASE_URL = (
    "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/"
    "mars2020_meda"
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]

OUTPUT_DIR = PROJECT_ROOT / "datasets" / "meda" / "raw"

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB per file

# Each entry:
# (sensor, collection, sol, filename)

PRODUCTS = [
    # SOL 1 — Calibrated
    (
        "ATS",
        "calibrated",
        1,
        "WE__0001___________CAL_ATS_________________P01.CSV",
    ),
    (
        "RDS",
        "calibrated",
        1,
        "WE__0001___________CAL_RDS_________________P01.CSV",
    ),

    # SOL 1 — Derived
    (
        "ANC",
        "derived",
        1,
        "WE__0001___________DER_ANCILLARY___________P03.CSV",
    ),
    (
        "PS",
        "derived",
        1,
        "WE__0001___________DER_PS__________________P02.CSV",
    ),
    (
        "RHS",
        "derived",
        1,
        "WE__0001___________DER_RHS_________________P03.CSV",
    ),
    (
        "TIRS",
        "derived",
        1,
        "WE__0001___________DER_TIRS________________P04.CSV",
    ),

    # SOL 36 — Derived
    (
        "WS",
        "derived",
        36,
        "WE__0036___________DER_WS__________________P02.CSV",
    ),
]


# =========================================================
# DOWNLOAD FUNCTION
# =========================================================

def download_file(url: str, destination: Path) -> bool:

    if destination.exists() and destination.stat().st_size > 0:
        print(f"SKIPPED: {destination.name} (already exists)")
        return True

    destination.parent.mkdir(parents=True, exist_ok=True)

    temporary_file = destination.with_name(
        destination.name + ".part"
    )

    request = Request(
        url,
        headers={
            "User-Agent": "NASAMartianMap-MEDA-Downloader/1.0"
        },
    )

    try:
        with urlopen(request, timeout=60) as response:

            expected_size = response.headers.get("Content-Length")

            if expected_size:
                expected_size = int(expected_size)

                if expected_size > MAX_FILE_SIZE:
                    raise ValueError("File exceeds the size limit.")

            downloaded_size = 0
            first_chunk = True

            with open(temporary_file, "wb") as output:

                while True:
                    chunk = response.read(64 * 1024)

                    if not chunk:
                        break

                    if first_chunk:
                        first_chunk = False

                        if chunk.lstrip().lower().startswith(
                            (b"<!doctype html", b"<html")
                        ):
                            raise ValueError(
                                "Server returned HTML instead of a data file."
                            )

                    downloaded_size += len(chunk)

                    if downloaded_size > MAX_FILE_SIZE:
                        raise ValueError("File exceeds the size limit.")

                    output.write(chunk)

            if downloaded_size == 0:
                raise ValueError("Downloaded file is empty.")

            if expected_size and downloaded_size != expected_size:
                raise ValueError("Downloaded size does not match.")

        temporary_file.replace(destination)

        print(
            f"DOWNLOADED: {destination} "
            f"({downloaded_size / 1024:.1f} KB)"
        )

        return True

    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
        ValueError,
    ) as error:

        print(f"FAILED: {destination.name}")
        print(f"       {error}")

        if temporary_file.exists():
            temporary_file.unlink()

        return False


# =========================================================
# MAIN
# =========================================================

def main():

    successful = 0
    failed = 0

    total_files = len(PRODUCTS) * 2

    print("NASA MEDA SELECTIVE DOWNLOADER")
    print("=" * 45)
    print(f"Products: {len(PRODUCTS)}")
    print(f"Files including XML labels: {total_files}")
    print(f"Destination: {OUTPUT_DIR}")
    print("=" * 45)

    for sensor, collection, sol, filename in PRODUCTS:

        sol_folder = f"sol_{sol:04d}"

        archive_folder = (
            f"data_{collection}_env/"
            f"sol_0000_0089/"
            f"{sol_folder}/"
        )

        sensor_folder = OUTPUT_DIR / sensor / sol_folder

        base_url = f"{BASE_URL}/{archive_folder}"

        print(f"\n[{sensor}] Sol {sol}")

        # Download CSV
        csv_path = sensor_folder / filename
        csv_url = base_url + filename

        if download_file(csv_url, csv_path):
            successful += 1
        else:
            failed += 1

        # Download matching XML label
        xml_filename = filename[:-4] + ".xml"

        xml_path = sensor_folder / xml_filename
        xml_url = base_url + xml_filename

        if download_file(xml_url, xml_path):
            successful += 1
        else:
            failed += 1

    print("\n" + "=" * 45)
    print("DOWNLOAD SUMMARY")
    print("=" * 45)
    print(f"Successful: {successful}")
    print(f"Failed:     {failed}")
    print(f"Total:      {total_files}")
    print(f"Location:   {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
