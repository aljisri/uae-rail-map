#!/usr/bin/env python3
"""Build data/fallback.json: a coarse coastline and borders from Natural Earth (public domain).

The map only draws it if the OpenFreeMap tiles cannot be reached, so the rail network never
floats on a blank background.

Usage: python3 scripts/build_fallback.py [path/to/ne_10m_land.geojson path/to/ne_10m_admin_0_boundary_lines_land.geojson]
Without arguments the two files are downloaded from the Natural Earth GitHub mirror.
"""
import json
import pathlib
import sys
import urllib.request

from shapely.geometry import box, mapping, shape

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "fallback.json"
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
BBOX = box(48.5, 20.5, 59.5, 28.5)
TOLERANCE = 0.004  # degrees, roughly 400 m


def load(arg, name):
    if arg:
        return json.loads(pathlib.Path(arg).read_text())
    with urllib.request.urlopen(BASE + name, timeout=120) as resp:
        return json.loads(resp.read())


def rounded(geom):
    def r(c):
        return [round(c[0], 4), round(c[1], 4)] if isinstance(c[0], (int, float)) else [r(x) for x in c]
    g = mapping(geom)
    return {"type": g["type"], "coordinates": r(g["coordinates"])}


def clip(collection):
    out = []
    for f in collection["features"]:
        g = shape(f["geometry"])
        if not g.intersects(BBOX):
            continue
        g = g.intersection(BBOX).simplify(TOLERANCE, preserve_topology=True)
        if not g.is_empty:
            out.append({"type": "Feature", "properties": {}, "geometry": rounded(g)})
    return {"type": "FeatureCollection", "features": out}


def main():
    args = sys.argv[1:] + [None, None]
    land = clip(load(args[0], "ne_10m_land.geojson"))
    borders = clip(load(args[1], "ne_10m_admin_0_boundary_lines_land.geojson"))
    OUT.write_text(json.dumps({"source": "Natural Earth 1:10m (public domain)", "land": land, "borders": borders},
                              separators=(",", ":")))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
