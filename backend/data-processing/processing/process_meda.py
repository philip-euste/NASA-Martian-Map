
import csv
import json
import xml.etree.ElementTree as ET

from pathlib import Path


# =========================================================
# CONFIGURATION
# =========================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

RAW_DIR = PROJECT_ROOT / "datasets" / "meda" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "datasets" / "meda" / "processed"

SENSORS = [
    "ATS",
    "RDS",
    "ANC",
    "PS",
    "RHS",
    "TIRS",
    "WS",
]

INVALID_SENTINEL = "999999999"

TEMPERATURE_COLUMNS = [
    "ATS_LOCAL_TEMP1",
    "ATS_LOCAL_TEMP2",
    "ATS_LOCAL_TEMP3",
    "ATS_LOCAL_TEMP4",
    "ATS_LOCAL_TEMP5",
]

WIND_MEASUREMENT_COLUMNS = [
    "HORIZONTAL_WIND_SPEED",
    "HORIZONTAL_WIND_SPEED_UNCERTAINTY",
    "VERTICAL_WIND_SPEED",
    "VERTICAL_WIND_SPEED_UNCERTAINTY",
    "WIND_DIRECTION",
    "WIND_DIRECTION_UNCERTAINTY",
]

# Explicit XML-to-CSV naming discrepancies.
# These aliases affect validation only.
# Original CSV column names are preserved.

HEADER_ALIASES = {
    "PS": {
        "PRESSURE UNCERTAINTY": "PRESSURE_UNCERTAINTY",
    },
    "RHS": {
        "LOCAL_TEMP_UNCERTAINTY": (
            "HUMIDITY_LOCAL_TEMP_UNCERTAINTY"
        ),
        "VOLUME_MIXING_RATION_UNCERTAINTY": (
            "VOLUME_MIXING_RATIO_UNCERTAINTY"
        ),
    },
}


# =========================================================
# XML HELPERS
# =========================================================

def local_name(tag):
    return tag.split("}")[-1]


def find_elements(element, name):
    return [
        node
        for node in element.iter()
        if local_name(node.tag) == name
    ]


def get_element_text(element, name, default=None):
    matches = find_elements(element, name)

    if not matches:
        return default

    return matches[0].text


def read_xml_metadata(xml_path):

    root = ET.parse(xml_path).getroot()

    table = next(
        (
            node
            for node in root.iter()
            if local_name(node.tag) == "Table_Delimited"
        ),
        None,
    )

    if table is None:
        raise ValueError(
            "XML does not contain Table_Delimited."
        )

    record_count = get_element_text(
        table,
        "records",
    )

    record_structure = next(
        (
            node
            for node in table
            if local_name(node.tag) == "Record_Delimited"
        ),
        None,
    )

    if record_structure is None:
        raise ValueError(
            "XML does not contain Record_Delimited."
        )

    fields = []

    for field in record_structure:

        if local_name(field.tag) != "Field_Delimited":
            continue

        fields.append({
            "name": get_element_text(field, "name"),
            "unit": get_element_text(field, "unit"),
            "data_type": get_element_text(field, "data_type"),
            "description": get_element_text(
                field,
                "description",
            ),
        })

    return {
        "title": get_element_text(root, "title"),
        "logical_identifier": get_element_text(
            root,
            "logical_identifier",
        ),
        "processing_level": get_element_text(
            root,
            "processing_level",
        ),
        "start_time": get_element_text(
            root,
            "start_date_time",
        ),
        "stop_time": get_element_text(
            root,
            "stop_date_time",
        ),
        "sol": get_element_text(
            root,
            "start_sol_number",
        ),
        "product_version": get_element_text(
            root,
            "version_id",
        ),
        "expected_records": (
            int(record_count)
            if record_count
            else None
        ),
        "fields": fields,
    }


# =========================================================
# CSV VALIDATION
# =========================================================

def validate_csv_header(reader, metadata, sensor):

    expected_columns = [
        field["name"]
        for field in metadata["fields"]
    ]

    actual_columns = reader.fieldnames

    if actual_columns is None:
        raise ValueError(
            "CSV header is missing."
        )

    actual_columns = list(actual_columns)

    aliases = HEADER_ALIASES.get(sensor, {})

    normalized_expected = [
        aliases.get(column, column)
        for column in expected_columns
    ]

    if normalized_expected != actual_columns:

        raise ValueError(
            "CSV header does not match XML field definitions.\n"
            f"Expected XML: {expected_columns}\n"
            f"After aliases: {normalized_expected}\n"
            f"Actual CSV:   {actual_columns}"
        )

    applied_aliases = [
        {
            "xml_name": original,
            "csv_name": replacement,
        }
        for original, replacement in zip(
            expected_columns,
            normalized_expected,
        )
        if original != replacement
    ]

    return actual_columns, applied_aliases


def validate_record_count(actual, expected):

    if expected is None:
        return

    if actual != expected:
        raise ValueError(
            f"Record count mismatch: "
            f"XML expects {expected}, CSV contains {actual}."
        )


# =========================================================
# SENSOR PROCESSORS
# =========================================================

def process_ats(row):

    processed = dict(row)

    invalid_count = 0

    for column in TEMPERATURE_COLUMNS:

        value = row.get(column, "").strip()

        if not value:
            processed[f"{column}_C"] = ""
            continue

        try:
            kelvin = float(value)

            celsius = kelvin - 273.15

            processed[f"{column}_C"] = round(
                celsius,
                2,
            )

        except (ValueError, TypeError):
            processed[f"{column}_C"] = ""
            invalid_count += 1

    return processed, invalid_count


def process_ws(row):

    processed = dict(row)

    invalid_count = 0

    for column in WIND_MEASUREMENT_COLUMNS:

        value = row.get(column, "").strip()

        if value == INVALID_SENTINEL:

            processed[column] = ""
            invalid_count += 1

    return processed, invalid_count


def process_generic(row):

    return dict(row), 0


def process_sensor_row(sensor, row):

    if sensor == "ATS":
        return process_ats(row)

    if sensor == "WS":
        return process_ws(row)

    return process_generic(row)


def get_extra_columns(sensor):

    if sensor == "ATS":
        return [
            f"{column}_C"
            for column in TEMPERATURE_COLUMNS
        ]

    return []


def get_processing_description(sensor):

    descriptions = {
        "ATS": [
            "Original temperature measurements preserved in Kelvin.",
            "Additional Celsius columns generated from Kelvin values.",
            "No averaging performed across temperature sensors.",
        ],
        "RDS": [
            "Original radiation and dust sensor measurements preserved.",
            "Sensor channels and rover-status flags preserved.",
            "No averaging performed across sensor channels.",
        ],
        "ANC": [
            "Original ancillary measurements preserved.",
            "Coordinate, orientation, and timing fields preserved.",
            "No conversion of rover-relative coordinates into latitude/longitude.",
        ],
        "PS": [
            "Original pressure measurements preserved in their source units.",
            "Pressure uncertainty metadata preserved without modification.",
            "Transducer identifiers preserved.",
        ],
        "RHS": [
            "Original relative humidity sensor measurements preserved.",
            "Source units and field definitions preserved.",
        ],
        "TIRS": [
            "Original thermal infrared sensor measurements preserved.",
            "Source units and field definitions preserved.",
        ],
        "WS": [
            "Original wind measurements preserved except invalid sentinel values.",
            "999999999 replaced with an empty value in configured measurement columns.",
            "Rover-status and boom-retrieval flags preserved.",
        ],
    }

    return descriptions.get(
        sensor,
        ["Original measurements preserved without transformation."],
    )


# =========================================================
# FILE PROCESSING
# =========================================================

def process_file(sensor, csv_path):

    xml_path = csv_path.with_suffix(".xml")

    if not xml_path.exists():
        raise FileNotFoundError(
            f"Matching XML label not found: {xml_path}"
        )

    print(
        f"\nProcessing {sensor}: {csv_path.name}"
    )

    metadata = read_xml_metadata(xml_path)

    output_dir = (
        PROCESSED_DIR
        / sensor
        / csv_path.parent.name
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = output_dir / (
        csv_path.stem + "_PROCESSED.CSV"
    )

    total_records = 0
    invalid_values = 0

    with open(
        csv_path,
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as source:

        reader = csv.DictReader(source)

        original_columns, applied_aliases = (
            validate_csv_header(
                reader,
                metadata,
                sensor,
            )
        )

        extra_columns = get_extra_columns(sensor)

        output_columns = (
            original_columns + extra_columns
        )

        with open(
            output_path,
            "w",
            encoding="utf-8",
            newline="",
        ) as destination:

            writer = csv.DictWriter(
                destination,
                fieldnames=output_columns,
            )

            writer.writeheader()

            for row in reader:

                processed_row, invalid = process_sensor_row(
                    sensor,
                    row,
                )

                invalid_values += invalid

                writer.writerow(processed_row)

                total_records += 1

    validate_record_count(
        total_records,
        metadata["expected_records"],
    )

    report = {
        "sensor": sensor,
        "source_file": csv_path.name,
        "source_xml": xml_path.name,
        "output_file": output_path.name,

        "title": metadata["title"],
        "logical_identifier": metadata["logical_identifier"],
        "processing_level": metadata["processing_level"],
        "product_version": metadata["product_version"],

        "sol": metadata["sol"],
        "start_time": metadata["start_time"],
        "stop_time": metadata["stop_time"],

        "record_count": total_records,
        "expected_record_count": metadata["expected_records"],

        "invalid_values_replaced": invalid_values,

        "header_aliases_applied": applied_aliases,

        "processing": get_processing_description(sensor),

        "fields": metadata["fields"],

        "validation": "passed",
    }

    report_path = output_dir / (
        csv_path.stem + "_REPORT.json"
    )

    with open(
        report_path,
        "w",
        encoding="utf-8",
    ) as report_file:

        json.dump(
            report,
            report_file,
            indent=4,
        )

    print(f"Records: {total_records}")
    print(f"Invalid values handled: {invalid_values}")

    if applied_aliases:
        print("Header aliases applied:")

        for alias in applied_aliases:
            print(
                f"  {alias['xml_name']} -> {alias['csv_name']}"
            )

    print("Validation: PASSED")
    print(f"Output: {output_path}")

    return report


# =========================================================
# MAIN
# =========================================================

def main():

    print("=" * 55)
    print("NASA MEDA DATA PROCESSOR")
    print("=" * 55)

    if not RAW_DIR.exists():
        raise FileNotFoundError(
            f"MEDA raw directory not found: {RAW_DIR}"
        )

    reports = []
    failures = []

    for sensor in SENSORS:

        sensor_dir = RAW_DIR / sensor

        if not sensor_dir.exists():

            print(
                f"\nSKIPPED: {sensor} directory not found."
            )

            continue

        csv_files = sorted(
            path
            for path in sensor_dir.rglob("*")
            if path.is_file()
            and path.suffix.lower() == ".csv"
        )

        if not csv_files:

            print(
                f"\nSKIPPED: No CSV files found for {sensor}."
            )

            continue

        for csv_path in csv_files:

            try:

                report = process_file(
                    sensor,
                    csv_path,
                )

                reports.append(report)

            except Exception as error:

                failures.append({
                    "sensor": sensor,
                    "file": str(csv_path),
                    "error": str(error),
                })

                print(
                    f"FAILED: {csv_path.name}"
                )

                print(
                    f"Reason: {error}"
                )

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    summary = {
        "processed_products": len(reports),
        "failed_products": len(failures),
        "reports": reports,
        "failures": failures,
    }

    summary_path = (
        PROCESSED_DIR / "processing_summary.json"
    )

    with open(
        summary_path,
        "w",
        encoding="utf-8",
    ) as summary_file:

        json.dump(
            summary,
            summary_file,
            indent=4,
        )

    print("\n" + "=" * 55)
    print("PROCESSING SUMMARY")
    print("=" * 55)

    print(
        f"Successful products: {len(reports)}"
    )

    print(
        f"Failed products:     {len(failures)}"
    )

    print(
        f"Summary: {summary_path}"
    )


if __name__ == "__main__":
    main()
