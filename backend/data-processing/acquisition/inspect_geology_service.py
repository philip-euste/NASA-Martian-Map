
import json
import sys

import httpx


# =========================================================
# USGS MARS GEOLOGY SERVICE
# =========================================================

SERVICE_URL = (
    "https://services.arcgis.com/nzS0F0zdNLvs7nc8/"
    "ArcGIS/rest/services/Mars_Geology_feature_layer/"
    "FeatureServer"
)

LAYER_ID = 0

LAYER_URL = f"{SERVICE_URL}/{LAYER_ID}"

TIMEOUT = 60


def request_arcgis(url, params=None):
    """Request JSON data from an ArcGIS REST endpoint."""

    try:
        response = httpx.get(
            url,
            params=params or {"f": "json"},
            timeout=TIMEOUT,
            follow_redirects=True,
        )

        response.raise_for_status()

        data = response.json()

    except httpx.HTTPError as error:
        raise RuntimeError(
            f"HTTP request failed: {error}"
        ) from error

    except ValueError as error:
        raise RuntimeError(
            "The service returned invalid JSON."
        ) from error

    if "error" in data:
        raise RuntimeError(
            json.dumps(data["error"], indent=2)
        )

    return data


def inspect_layer_metadata():
    print("\n" + "=" * 65)
    print("USGS MARS GEOLOGY — LAYER METADATA")
    print("=" * 65)

    metadata = request_arcgis(
        LAYER_URL,
        {"f": "json"},
    )

    print(f"Layer name: {metadata.get('name')}")
    print(f"Geometry type: {metadata.get('geometryType')}")
    print(f"Display field: {metadata.get('displayField')}")
    print(f"Maximum record count: {metadata.get('maxRecordCount')}")

    spatial_reference = metadata.get(
        "extent", {}
    ).get(
        "spatialReference",
        metadata.get("spatialReference", {}),
    )

    print(
        "Spatial reference:",
        json.dumps(spatial_reference, indent=2),
    )

    print("\nAvailable fields:")

    for field in metadata.get("fields", []):
        print(
            f"  {field.get('name')} "
            f"({field.get('type')}) "
            f"- {field.get('alias')}"
        )

    return metadata


def inspect_feature_count():
    print("\n" + "=" * 65)
    print("GLOBAL GEOLOGICAL FEATURE COUNT")
    print("=" * 65)

    data = request_arcgis(
        f"{LAYER_URL}/query",
        {
            "where": "1=1",
            "returnCountOnly": "true",
            "f": "json",
        },
    )

    count = data.get("count")

    print(f"Total features: {count}")

    return count


def inspect_sample_features():
    print("\n" + "=" * 65)
    print("SAMPLE GEOLOGICAL FEATURES")
    print("=" * 65)

    data = request_arcgis(
        f"{LAYER_URL}/query",
        {
            "where": "1=1",
            "outFields": "*",
            "returnGeometry": "true",
            "resultRecordCount": 5,
            "outSR": 104971,
            "f": "json",
        },
    )

    features = data.get("features", [])

    print(f"Returned samples: {len(features)}")

    for index, feature in enumerate(features, start=1):
        attributes = feature.get("attributes", {})
        geometry = feature.get("geometry") or {}

        print(f"\n--- FEATURE {index} ---")

        print(
            "Attributes:",
            json.dumps(attributes, indent=2, default=str),
        )

        print(
            "Geometry type:",
            "Polygon" if "rings" in geometry else "Unknown",
        )

        rings = geometry.get("rings", [])

        print(f"Number of rings: {len(rings)}")

        if rings:
            print(
                "First ring coordinate count:",
                len(rings[0]),
            )

            print(
                "First coordinate:",
                rings[0][0] if rings[0] else None,
            )

    return data


def main():
    print("Inspecting the online USGS Mars geology service...")
    print(f"Endpoint: {LAYER_URL}")

    try:
        inspect_layer_metadata()
        inspect_feature_count()
        inspect_sample_features()

    except RuntimeError as error:
        print(f"\nINSPECTION FAILED: {error}")
        sys.exit(1)

    print("\n" + "=" * 65)
    print("INSPECTION COMPLETED")
    print("=" * 65)


if __name__ == "__main__":
    main()
