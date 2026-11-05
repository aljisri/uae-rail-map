#!/usr/bin/env python3
"""Download the OpenStreetMap extracts that build_network.py turns into data/network.json.

Writes three files into data/osm/:
  routes.json     route relations (Dubai Metro, Tram, Palm Monorail, Etihad Rail) with geometry
  rail_ways.json  every railway way in the UAE bounding box, with geometry
  stations.json   station / stop nodes and station areas

Data (c) OpenStreetMap contributors, available under the Open Database License (ODbL 1.0).

Usage:  python3 scripts/fetch_osm.py
Public Overpass servers are often busy, so each query retries across a few mirrors.
"""
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "osm"

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# south, west, north, east: the UAE plus the Oman corridor to Sohar.
BBOX = "22.4,51.0,26.3,56.9"

# Route relations we read stop order and line geometry from.
ROUTE_RELATIONS = [
    420297,    # Dubai Metro Red1: Centrepoint -> Expo City Dubai
    12820285,  # Dubai Metro Red2: Centrepoint -> Life Pharmacy (UAE Exchange)
    2767663,   # Dubai Metro Green: e& -> Creek
    7825238,   # Palm Jumeirah Monorail: Atlantis -> Gateway
    7826083,   # Dubai Tram
    21261181,  # Etihad Rail: Abu Dhabi -> Fujairah
    21493966,  # Etihad Rail: Dubai -> Abu Dhabi
]

QUERIES = {
    "routes.json": f"[out:json][timeout:120];relation(id:{','.join(map(str, ROUTE_RELATIONS))});out geom;",
    "rail_ways.json": (
        "[out:json][timeout:240];"
        'way["railway"~"^(rail|subway|light_rail|tram|monorail|construction|proposed|narrow_gauge|disused|abandoned)$"]'
        f"({BBOX});out geom;"
    ),
    "stations.json": (
        "[out:json][timeout:120];("
        f'node["railway"~"^(station|halt|stop|tram_stop)$"]({BBOX});'
        f'node["public_transport"="station"]({BBOX});'
        f'way["railway"="station"]({BBOX});'
        f'way["public_transport"="station"]({BBOX});'
        ");out center tags;"
    ),
}


def in_scope(lat, lon):
    """Drop Qatar, which the bounding box clips."""
    return not (lon < 51.7 and lat > 24.4)


def keep(element):
    if element["type"] == "node":
        return in_scope(element["lat"], element["lon"])
    if element["type"] == "way" and "geometry" in element:
        return any(in_scope(p["lat"], p["lon"]) for p in element["geometry"])
    center = element.get("center")
    return in_scope(center["lat"], center["lon"]) if center else True


def run(query):
    body = urllib.parse.urlencode({"data": query}).encode()
    last_error = None
    for attempt in range(8):
        endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            req = urllib.request.Request(endpoint, data=body, headers={"User-Agent": "uae-rail-map/1.0"})
            with urllib.request.urlopen(req, timeout=300) as resp:
                text = resp.read().decode("utf-8")
            if text.lstrip().startswith("{"):
                return json.loads(text)
            last_error = "server busy"
        except Exception as exc:  # network errors, HTTP 429/504 ...
            last_error = exc
        wait = 6 * (attempt + 1)
        print(f"  attempt {attempt + 1} failed ({last_error}); retrying in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise SystemExit(f"Overpass query failed: {last_error}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, query in QUERIES.items():
        print(f"fetching {name} ...")
        data = run(query)
        data["elements"] = [e for e in data["elements"] if keep(e)]
        (OUT / name).write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
        print(f"  {len(data['elements'])} elements, OSM timestamp {data.get('osm3s', {}).get('timestamp_osm_base')}")


if __name__ == "__main__":
    main()
