
"""
Discover HiRISE DTM products for the four Mars simulator environments.

Queries the USGS Astrogeology STAC API, searches regional bounding boxes,
follows pagination links, and saves matching products and their assets.

Usage:
    python discover_hirise_dtm.py
    python discover_hirise_dtm.py --region jezero
    python discover_hirise_dtm.py --region gale
    python discover_hirise_dtm.py --region olympus
    python discover_hirise_dtm.py --region valles-marineris
    python discover_hirise_dtm.py --region all
    python discover_hirise_dtm.py --limit 100

Output:
    backend/data-processing/acquisition/output/hirise_dtm_catalog.json
"""

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import httpx


STAC_API = "https://stac.astrogeology.usgs.gov/api"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
OUTPUT_FILE = OUTPUT_DIR / "hirise_dtm_catalog.json"

# Broad discovery areas in WGS84:
# [west longitude, south latitude, east longitude, north latitude].
# Refine these after inspecting actual product footprints.
REGIONS = {
    "jezero": {
        "name": "Jezero Crater",
        "bbox": [77.2229, 18.3068, 77.5840, 18.6693],
    },
    "gale": {
        "name": "Gale Crater",
        "bbox": [136.5, -6.8, 139.5, -3.8],
    },
    "olympus": {
        "name": "Olympus Mons",
        "bbox": [-138.0, 14.0, -129.0, 23.0],
    },
    "valles-marineris": {
        "name": "Valles Marineris",
        "bbox": [-75.0, -18.0, -45.0, -4.0],
    },
}

PAGE_LIMIT = 100
TIMEOUT = 90


def log(message):
    print(f"[HiRISE Discovery] {message}")


def normalize_text(value):
    """Convert metadata values into searchable lowercase text."""
    if isinstance(value, (dict, list)):
        value = json.dumps(value)
    return str(value or "").lower()


def discover_collections(client):
    """Find HiRISE-related collections, prioritizing DTM collections."""
    response = client.get(f"{STAC_API}/collections")
    response.raise_for_status()

    collections = response.json().get("collections", [])

    hirise_collections = []
    for collection in collections:
        searchable = normalize_text({
            "id": collection.get("id"),
            "title": collection.get("title"),
            "description": collection.get("description"),
        })

        if "hirise" in searchable:
            hirise_collections.append(collection)

    dtm_collections = [
        collection
        for collection in hirise_collections
        if "dtm" in normalize_text({
            "id": collection.get("id"),
            "title": collection.get("title"),
            "description": collection.get("description"),
        })
        or "digital terrain model" in normalize_text({
            "title": collection.get("title"),
            "description": collection.get("description"),
        })
    ]

    # Prefer explicitly identified DTM collections. If none are exposed,
    # search HiRISE collections and filter individual items afterward.
    return dtm_collections or hirise_collections


def is_dtm_product(item):
    """Check whether a STAC item appears to contain a DTM product."""
    searchable = normalize_text({
        "id": item.get("id"),
        "collection": item.get("collection"),
        "properties": item.get("properties", {}),
    })

    asset_text = normalize_text({
        key: {
            "title": asset.get("title"),
            "description": asset.get("description"),
            "type": asset.get("type"),
            "roles": asset.get("roles"),
            "href": asset.get("href"),
        }
        for key, asset in item.get("assets", {}).items()
    })

    combined = searchable + " " + asset_text

    return (
        "dtm" in combined
        or "digital terrain model" in combined
        or "elevation model" in combined
    )


def classify_asset(name, asset):
    """Classify an asset using its key and STAC metadata."""
    searchable = normalize_text({
        "name": name,
        "title": asset.get("title"),
        "description": asset.get("description"),
        "type": asset.get("type"),
        "roles": asset.get("roles"),
    })

    if any(term in searchable for term in ("dtm", "dem", "elevation")):
        return "terrain"

    if any(term in searchable for term in ("ortho", "orthorectified")):
        return "orthophoto"

    if any(term in searchable for term in ("browse", "thumbnail", "preview")):
        return "preview"

    if "metadata" in searchable:
        return "metadata"

    return "other"


def extract_assets(item):
    """Extract useful asset information without downloading files."""
    assets = {}

    for name, asset in item.get("assets", {}).items():
        assets[name] = {
            "category": classify_asset(name, asset),
            "href": asset.get("href"),
            "type": asset.get("type"),
            "title": asset.get("title"),
            "description": asset.get("description"),
            "roles": asset.get("roles", []),
            "file_size": asset.get("file:size"),
            "checksum": asset.get("file:checksum"),
        }

    return assets


def extract_product(item, region_id):
    """Normalize a STAC item for the simulator's future data pipeline."""
    properties = item.get("properties", {})

    return {
        "id": item.get("id"),
        "region": region_id,
        "collection": item.get("collection"),
        "bbox": item.get("bbox"),
        "geometry": item.get("geometry"),
        "datetime": properties.get("datetime"),
        "start_datetime": properties.get("start_datetime"),
        "end_datetime": properties.get("end_datetime"),
        "properties": properties,
        "assets": extract_assets(item),
        "links": [
            {
                "rel": link.get("rel"),
                "href": link.get("href"),
                "type": link.get("type"),
            }
            for link in item.get("links", [])
        ],
    }


def get_next_page(client, current_url, link):
    """Follow a STAC pagination link, including POST-based next pages."""
    href = urljoin(current_url, link["href"])
    method = link.get("method", "GET").upper()

    if method == "POST":
        response = client.post(
            href,
            json=link.get("body", {}),
        )
    else:
        response = client.get(href)

    response.raise_for_status()
    return response, href


def search_region(client, collections, region_id, region, limit):
    """Search all matching HiRISE DTM items intersecting one region."""
    bbox = region["bbox"]
    collection_ids = [collection["id"] for collection in collections]

    log(f"Searching {region['name']}: {bbox}")

    response = client.post(
        f"{STAC_API}/search",
        json={
            "collections": collection_ids,
            "bbox": bbox,
            "limit": limit,
        },
    )
    response.raise_for_status()

    page = response.json()
    current_url = str(response.url)

    products = {}
    pages = 0
    total_returned = 0

    while True:
        pages += 1
        features = page.get("features", [])
        total_returned += len(features)

        for item in features:
            if not is_dtm_product(item):
                continue

            product = extract_product(item, region_id)
            product_id = product["id"]

            if product_id:
                products[product_id] = product

        next_link = next(
            (
                link for link in page.get("links", [])
                if link.get("rel") == "next" and link.get("href")
            ),
            None,
        )

        if not next_link:
            break

        response, current_url = get_next_page(
            client,
            current_url,
            next_link,
        )
        page = response.json()

    log(
        f"{region['name']}: {len(products)} DTM candidates "
        f"from {total_returned} returned items across {pages} page(s)"
    )

    return list(products.values())


def build_catalog(client, selected_regions, limit):
    """Discover collections and build the multi-region catalog."""
    collections = discover_collections(client)

    if not collections:
        raise RuntimeError(
            "No HiRISE collections were found in the STAC catalog."
        )

    log(f"Found {len(collections)} HiRISE collection(s):")

    for collection in collections:
        log(
            f"  {collection.get('id')} — "
            f"{collection.get('title', 'Untitled')}"
        )

    catalog = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "api": STAC_API,
        "search_settings": {
            "collections": [item["id"] for item in collections],
            "page_limit": limit,
            "product_filter": "HiRISE DTM metadata and asset keywords",
        },
        "regions": {},
    }

    for region_id in selected_regions:
        region = REGIONS[region_id]

        products = search_region(
            client,
            collections,
            region_id,
            region,
            limit,
        )

        catalog["regions"][region_id] = {
            "name": region["name"],
            "search_bbox": region["bbox"],
            "product_count": len(products),
            "products": products,
        }

    return catalog


def save_catalog(catalog, output_file):
    """Write the discovery results to JSON."""
    output_file.parent.mkdir(parents=True, exist_ok=True)

    output_file.write_text(
        json.dumps(catalog, indent=2),
        encoding="utf-8",
    )

    log(f"Saved catalog: {output_file}")


def print_summary(catalog):
    """Print a compact summary of the discovery results."""
    print("\n" + "=" * 65)
    print("HiRISE DTM DISCOVERY SUMMARY")
    print("=" * 65)

    total = 0

    for region_id, region in catalog["regions"].items():
        count = region["product_count"]
        total += count

        print(f"\n{region['name']} ({region_id})")
        print(f"  DTM candidates: {count}")

        for product in region["products"]:
            terrain_assets = [
                asset
                for asset in product["assets"].values()
                if asset["category"] == "terrain"
            ]

            ortho_assets = [
                asset
                for asset in product["assets"].values()
                if asset["category"] == "orthophoto"
            ]

            print(f"  Product: {product['id']}")
            print(f"    Bounds: {product['bbox']}")
            print(f"    Terrain assets: {len(terrain_assets)}")
            print(f"    Orthoimage assets: {len(ortho_assets)}")

    print("\n" + "-" * 65)
    print(f"Total DTM candidates: {total}")
    print("=" * 65)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Discover HiRISE DTMs for Mars simulator regions."
    )

    parser.add_argument(
        "--region",
        choices=["all", *REGIONS.keys()],
        default="all",
        help="Region to search. Defaults to all four regions.",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=PAGE_LIMIT,
        help="Maximum STAC items requested per page.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_FILE,
        help="Output JSON catalog path.",
    )

    return parser.parse_args()


def main():
    args = parse_args()

    if args.limit < 1 or args.limit > 10000:
        raise SystemExit("--limit must be between 1 and 10000.")

    selected_regions = (
        list(REGIONS)
        if args.region == "all"
        else [args.region]
    )

    log("Connecting to USGS Astrogeology STAC API...")
    log(f"Regions: {', '.join(selected_regions)}")

    try:
        with httpx.Client(
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "MarsWalk-HiRISE-DTM-Discovery/1.0"},
        ) as client:
            catalog = build_catalog(
                client,
                selected_regions,
                args.limit,
            )

            save_catalog(catalog, args.output)
            print_summary(catalog)

    except httpx.HTTPStatusError as error:
        log(
            f"STAC API returned HTTP {error.response.status_code}: "
            f"{error.request.url}"
        )
        log(error.response.text[:1000])
        raise SystemExit(1)

    except httpx.HTTPError as error:
        log(f"STAC API request failed: {error}")
        raise SystemExit(1)

    except (ValueError, KeyError, RuntimeError) as error:
        log(f"Discovery failed: {error}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
