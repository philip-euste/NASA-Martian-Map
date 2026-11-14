
import httpx

STAC_API = "https://stac.astrogeology.usgs.gov/api"

JEZERO_BBOX = [
    77.2229,
    18.3068,
    77.584,
    18.6693,
]


def discover_collections(client):
    response = client.get(f"{STAC_API}/collections")
    response.raise_for_status()

    collections = response.json().get("collections", [])

    candidates = [
        collection
        for collection in collections
        if "hirise" in (
            collection.get("id", "") + " "
            + collection.get("title", "")
        ).lower()
        and "dtm" in (
            collection.get("id", "") + " "
            + collection.get("title", "")
        ).lower()
    ]

    return candidates


def search_jezero_dtms(client, collections):
    collection_ids = [
        collection["id"]
        for collection in collections
    ]

    response = client.post(
        f"{STAC_API}/search",
        json={
            "collections": collection_ids,
            "bbox": JEZERO_BBOX,
            "limit": 100,
        },
    )

    response.raise_for_status()

    return response.json().get("features", [])


def main():
    print("Connecting to USGS Astrogeology STAC API...")

    try:
        with httpx.Client(timeout=60) as client:
            collections = discover_collections(client)

            if not collections:
                print("No HiRISE DTM collections found.")
                print("Available collections:")
                
                response = client.get(
                    f"{STAC_API}/collections"
                )
                response.raise_for_status()

                for item in response.json().get("collections", []):
                    print(
                        item.get("id"),
                        "-",
                        item.get("title"),
                    )

                return

            print("\nHiRISE DTM collections:")
            for collection in collections:
                print(collection["id"])

            items = search_jezero_dtms(client, collections)

            print(f"\nJezero results: {len(items)}")

            for item in items:
                print("\nProduct:", item.get("id"))
                print("Bounds:", item.get("bbox"))

                for name, asset in item.get("assets", {}).items():
                    print(
                        f"Asset: {name}",
                        f"\nURL: {asset.get('href')}",
                        f"\nType: {asset.get('type')}",
                    )

    except httpx.HTTPError as error:
        print("STAC API request failed:", error)


if __name__ == "__main__":
    main()
