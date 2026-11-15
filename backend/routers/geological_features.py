"""IAU approved Mars names from the USGS Gazetteer nightly GIS feed."""

import io
import json
import time
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/api")
FEED_URL = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz"
SNAPSHOT = Path(__file__).resolve().parents[1] / "datasets" / "planetary" / "mars-features.json"
KML_NS = "{http://www.opengis.net/kml/2.2}"
_cache: tuple[float, list[dict]] | None = None


def parse_gazetteer_kmz(blob: bytes) -> list[dict]:
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        kml_name = next(name for name in archive.namelist() if name.lower().endswith(".kml"))
        root = ET.fromstring(archive.read(kml_name))

    grouped: dict[str, list[dict]] = {}
    seen: set[str] = set()
    for placemark in root.iter(f"{KML_NS}Placemark"):
        fields = {
            item.get("name"): item.text or ""
            for item in placemark.iter(f"{KML_NS}SimpleData")
        }
        if fields.get("approval") != "Adopted by IAU":
            continue
        name = placemark.findtext(f"{KML_NS}name") or ""
        if name in {"Jezero", "Gale", "Valles Marineris", "Olympus Mons"}:
            continue
        url = fields.get("link", "").replace("http://", "https://")
        feature_id = url.rsplit("/", 1)[-1]
        if not feature_id.isdigit() or feature_id in seen:
            continue
        try:
            lat = float(fields["center_lat"])
            lon = float(fields["center_lon"])
            diameter = float(fields.get("diameter") or 0)
        except (ValueError, KeyError):
            continue
        if not (-90 <= lat <= 90 and 0 <= lon <= 360):
            continue
        seen.add(feature_id)
        category = fields.get("type") or "Unknown"
        grouped.setdefault(category, []).append({
            "id": f"usgs-{feature_id}",
            "name": name,
            "latitude": lat,
            "longitude": lon if lon <= 180 else lon - 360,
            "classification": category,
            "quadrangle": fields.get("quad_name", ""),
            "diameterKm": diameter,
            "sourceUrl": url,
            "description": "",
        })

    selected: list[dict] = []
    for category, entries in grouped.items():
        limit = 35 if category == "Crater, craters" else 22 if category == "Vallis, valles" else 12
        selected.extend(sorted(entries, key=lambda entry: entry["diameterKm"], reverse=True)[:limit])
    return sorted(selected, key=lambda entry: entry["name"])


@router.get("/geological-features")
async def geological_features():
    global _cache
    now = time.monotonic()
    if _cache and now - _cache[0] < 24 * 60 * 60:
        return {"features": _cache[1], "source": "USGS/IAU Gazetteer feed (cached)"}
    try:
        async with httpx.AsyncClient(timeout=6, follow_redirects=True) as client:
            response = await client.get(FEED_URL)
            response.raise_for_status()
        features = parse_gazetteer_kmz(response.content)
        if not features:
            raise ValueError("Gazetteer feed has no valid Mars features")
        _cache = (now, features)
        return {"features": features, "source": "USGS/IAU Gazetteer feed"}
    except (httpx.HTTPError, ValueError, zipfile.BadZipFile, ET.ParseError, StopIteration):
        features = json.loads(SNAPSHOT.read_text(encoding="utf-8-sig"))
        _cache = (now, features)
        return {"features": features, "source": "USGS/IAU Gazetteer snapshot"}
