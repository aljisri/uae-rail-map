#!/usr/bin/env python3
"""Build data/network.json from the OpenStreetMap extracts in data/osm/ and scripts/config.py.

Output: lines (with dated track segments), stations, and a journey-time graph that the web
app uses for the timeline, the animated trains and the travel-time explorer.

Requires: shapely>=2, pyproj   (pip install shapely pyproj)
Usage:    python3 scripts/build_network.py
"""
import heapq
import json
import math
import pathlib
import re
import sys

from pyproj import Transformer
from shapely import transform as shp_transform
from shapely.geometry import LineString, Point
from shapely.ops import linemerge, substring

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import config as C  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
OSM = ROOT / "data" / "osm"
OUT = ROOT / "data" / "network.json"

# UTM zone 40N: metres across the UAE and northern Oman.
_fwd = Transformer.from_crs(4326, 32640, always_xy=True)
_inv = Transformer.from_crs(32640, 4326, always_xy=True)


def to_m(geom):
    return shp_transform(geom, lambda xy: _xy(_fwd, xy))


def to_ll(geom):
    return shp_transform(geom, lambda xy: _xy(_inv, xy))


def _xy(tr, xy):
    import numpy as np
    x, y = tr.transform(xy[:, 0], xy[:, 1])
    return np.column_stack([x, y])


def pt_m(lonlat):
    return Point(*_fwd.transform(*lonlat))


def coords_out(line_m, tolerance=4.0):
    """Simplify (metres) and return [[lon, lat], ...] rounded to ~1 m."""
    simple = line_m.simplify(tolerance, preserve_topology=False) if tolerance else line_m
    return [[round(x, 5), round(y, 5)] for x, y in to_ll(simple).coords]


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# --------------------------------------------------------------------------------------
# Load OSM
# --------------------------------------------------------------------------------------
routes = {r["id"]: r for r in json.loads((OSM / "routes.json").read_text())["elements"] if r["type"] == "relation"}
ways = [w for w in json.loads((OSM / "rail_ways.json").read_text())["elements"] if w["type"] == "way"]
osm_stations = json.loads((OSM / "stations.json").read_text())["elements"]
node_tags = {e["id"]: e.get("tags", {}) for e in osm_stations if e["type"] == "node"}


def osm_name(tags):
    return tags.get("name:en") or tags.get("name")


def stitch_relation(rel):
    """Join a route relation's ways, in member order, into one LineString (lon/lat)."""
    parts = [[(p["lon"], p["lat"]) for p in m["geometry"]] for m in rel["members"]
             if m["type"] == "way" and m["role"] in ("", "forward", "backward") and "geometry" in m]
    if not parts:
        raise ValueError(f"relation {rel['id']} has no ways")
    if len(parts) > 1:
        a, b = parts[0], parts[1]
        if min(_d(a[0], b[0]), _d(a[0], b[-1])) < min(_d(a[-1], b[0]), _d(a[-1], b[-1])):
            parts[0] = a[::-1]
    line = list(parts[0])
    for part in parts[1:]:
        if _d(line[-1], part[-1]) < _d(line[-1], part[0]):
            part = part[::-1]
        line.extend(part[1:] if _d(line[-1], part[0]) < 1e-7 else part)
    return LineString(line)


def _d(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2


def relation_stops(rel):
    stops = []
    for m in rel["members"]:
        if m["type"] == "node" and m["role"].startswith("stop"):
            tags = node_tags.get(m["ref"], {})
            stops.append({"name": osm_name(tags), "name_ar": tags.get("name:ar") or tags.get("name"),
                          "lonlat": (m["lon"], m["lat"])})
    return stops


# --------------------------------------------------------------------------------------
# Output containers
# --------------------------------------------------------------------------------------
LINE_META = {l["id"]: l for l in C.LINES}
stations = {}   # id -> station record
segments = []   # {line, coords, km, opened, construction, announced, alignment}
edges = []      # {line, a, b, km, min}
branches = {}   # line -> [[station ids]]


def line_dates(line_id):
    m = LINE_META[line_id]
    return {"opened": m["opened"], "construction": m.get("construction"), "announced": m.get("announced")}


INHERIT = "inherit"


def add_station(sid, name, name_ar, lonlat, line_id, opened=INHERIT, approx=False, note=None, short=None):
    """Create a station, or add a line to an existing one (lonlat may then be None).

    `opened` defaults to the line's opening date; pass None for "not yet announced".
    """
    if sid not in stations:
        stations[sid] = {"id": sid, "name": name, "name_ar": name_ar,
                         "coord": [round(lonlat[0], 5), round(lonlat[1], 5)], "lines": [], "approx": approx}
    st = stations[sid]
    if short and "short" not in st:
        st["short"] = short
    if note and "note" not in st:
        st["note"] = note
    dates = line_dates(line_id)
    if not any(l["id"] == line_id for l in st["lines"]):
        st["lines"].append({"id": line_id, "opened": dates["opened"] if opened in (INHERIT, "") else opened,
                            "construction": dates["construction"], "announced": dates["announced"]})
    return sid


def add_segment(line_id, geom_m, opened=None, construction="line", alignment="osm", tolerance=4.0, status=None):
    dates = line_dates(line_id)
    seg = {"line": line_id, "coords": coords_out(geom_m, tolerance), "km": round(geom_m.length / 1000, 2),
           "opened": opened or dates["opened"],
           "construction": dates["construction"] if construction == "line" else construction,
           "announced": dates["announced"], "alignment": alignment}
    if status:
        seg["status"] = status
    segments.append(seg)


def piece(line_m, pa, pb):
    """Sub-line from distance pa to pb, oriented a -> b."""
    g = substring(line_m, min(pa, pb), max(pa, pb))
    return LineString(list(g.coords)[::-1]) if pb < pa else g


def add_edge(line_id, a, b, geom_m, minutes, km=None):
    km = geom_m.length / 1000 if km is None else km
    edges.append({"line": line_id, "a": a, "b": b, "km": round(km, 2), "min": round(minutes, 2), "_geom": geom_m})


def add_edges_along(line_id, line_m, stop_ids, minutes_per_km):
    """Edges between consecutive stops, with along-track distance and geometry."""
    pos = [line_m.project(pt_m(stations[s]["coord"])) for s in stop_ids]
    for (a, pa), (b, pb) in zip(zip(stop_ids, pos), zip(stop_ids[1:], pos[1:])):
        km = abs(pb - pa) / 1000
        add_edge(line_id, a, b, piece(line_m, pa, pb), km * minutes_per_km, km)


def along_km(line_m, a_lonlat, b_lonlat):
    return abs(line_m.project(pt_m(b_lonlat)) - line_m.project(pt_m(a_lonlat))) / 1000


def cut(line_m, a_lonlat, b_lonlat):
    pa, pb = line_m.project(pt_m(a_lonlat)), line_m.project(pt_m(b_lonlat))
    return substring(line_m, min(pa, pb), max(pa, pb))


def smooth(waypoints, step_m=150):
    """Centripetal Catmull-Rom through lon/lat waypoints -> LineString in metres."""
    pts = [pt_m(w) for w in waypoints]
    P = [(p.x, p.y) for p in pts]
    P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        seg_len = math.dist(p1, p2)
        n = max(2, int(seg_len / step_m))
        for k in range(n):
            t = k / n
            out.append(_catmull(p0, p1, p2, p3, t))
    out.append(P[-2])
    return LineString(out)


def _catmull(p0, p1, p2, p3, t, alpha=0.5):
    def tj(ti, a, b):
        return ti + max(math.dist(a, b), 1e-6) ** alpha
    t0 = 0.0
    t1 = tj(t0, p0, p1)
    t2 = tj(t1, p1, p2)
    t3 = tj(t2, p2, p3)
    tt = t1 + (t2 - t1) * t

    def lerp(a, b, ta, tb):
        if tb - ta < 1e-9:
            return a
        return tuple(((tb - tt) * a[i] + (tt - ta) * b[i]) / (tb - ta) for i in range(2))
    a1, a2, a3 = lerp(p0, p1, t0, t1), lerp(p1, p2, t1, t2), lerp(p2, p3, t2, t3)
    b1, b2 = lerp(a1, a2, t0, t2), lerp(a2, a3, t1, t3)
    return lerp(b1, b2, t1, t2)


# --------------------------------------------------------------------------------------
# Dubai Metro, Tram, Palm Monorail (OSM route relations)
# --------------------------------------------------------------------------------------
def station_id_for(line_id, name):
    prefix = {"red": "dm", "green": "dm", "tram": "tr", "monorail": "pm"}[line_id]
    return f"{prefix}-{slug(name)}"


def opened_lookup(line_id):
    table = {}
    for date, names in C.STATION_OPENED.get(line_id, {}).items():
        if names == "*":
            table["*"] = date
        else:
            for n in names:
                table[n] = date
    return table


def register_stops(line_id, stops):
    opened = opened_lookup(line_id)
    ids = []
    for s in stops:
        name = C.NAME_FIXES.get(s["name"], s["name"])
        sid = station_id_for(line_id, name)
        add_station(sid, name, s["name_ar"], s["lonlat"], line_id, opened.get(s["name"]) or opened.get("*") or INHERIT)
        ids.append(sid)
    return ids


def metro_line(line_id, rel_id, stops_slice=None, geom_until_stop=None):
    rel = routes[rel_id]
    line_ll = stitch_relation(rel)
    stops = relation_stops(rel)
    if stops_slice:
        stops = stops[stops_slice]
    line_m = to_m(line_ll)
    first, last = stops[0]["lonlat"], stops[geom_until_stop if geom_until_stop is not None else -1]["lonlat"]
    line_m = cut(line_m, first, last)
    return line_m, stops


def build_dubai():
    # --- Red Line: trunk Centrepoint -> Life Pharmacy (relation Red2), branch National Paints -> Expo City (Red1)
    trunk_m, trunk_stops = metro_line("red", 12820285)
    red1 = routes[420297]
    red1_m = to_m(stitch_relation(red1))
    red1_stops = relation_stops(red1)
    i_np = next(i for i, s in enumerate(red1_stops) if s["name"] == "National Paints")
    branch_stops = red1_stops[i_np:]
    # OSM's Red1 relation omits Jumeirah Golf Estates; insert it from the station node.
    jge = next(e for e in osm_stations if e["type"] == "node" and node_tags[e["id"]].get("name:en") == "Jumeirah Golf Estates"
               and node_tags[e["id"]].get("railway") == "station")
    jge_stop = {"name": "Jumeirah Golf Estates", "name_ar": node_tags[jge["id"]].get("name:ar"), "lonlat": (jge["lon"], jge["lat"])}
    i_furjan = next(i for i, s in enumerate(branch_stops) if s["name"] == "Al Furjan")
    branch_stops.insert(i_furjan + 1, jge_stop)
    branch_m = cut(red1_m, branch_stops[0]["lonlat"], branch_stops[-1]["lonlat"])

    trunk_ids = register_stops("red", trunk_stops)
    branch_ids = register_stops("red", branch_stops)
    branches["red"] = [trunk_ids, branch_ids]

    # dated track sections
    by_name = {s["name"]: s["lonlat"] for s in trunk_stops + branch_stops}
    by_name.update({C.NAME_FIXES.get(k, k): v for k, v in list(by_name.items())})
    np_ll, ib_ll, lp_ll = by_name["National Paints"], by_name["Ibn Battuta"], by_name["Life Pharmacy"]
    add_segment("red", cut(trunk_m, trunk_stops[0]["lonlat"], np_ll), opened="2009-09-09")
    add_segment("red", cut(trunk_m, np_ll, ib_ll), opened="2010-04-30")
    add_segment("red", cut(trunk_m, ib_ll, lp_ll), opened="2011-03-11")
    fj_ll = by_name["Al Furjan"]
    add_segment("red", cut(branch_m, np_ll, fj_ll), opened="2021-01-01", construction=2016)
    add_segment("red", cut(branch_m, fj_ll, branch_stops[-1]["lonlat"]), opened="2021-06-01", construction=2016)

    # journey times calibrated to Centrepoint -> Expo City Dubai = 74 min
    total_km = along_km(trunk_m, trunk_stops[0]["lonlat"], np_ll) + branch_m.length / 1000
    mpk = 74 / total_km
    add_edges_along("red", trunk_m, trunk_ids, mpk)
    add_edges_along("red", branch_m, branch_ids, mpk)

    # --- Green Line
    green_m, green_stops = metro_line("green", 2767663)
    green_ids = register_stops("green", green_stops)
    branches["green"] = [green_ids]
    dhcc = next(s["lonlat"] for s in green_stops if s["name"] == "Dubai Healthcare City")
    add_segment("green", cut(green_m, green_stops[0]["lonlat"], dhcc), opened="2011-09-09")
    add_segment("green", cut(green_m, dhcc, green_stops[-1]["lonlat"]), opened="2014-03-01")
    add_edges_along("green", green_m, green_ids, 40 / (green_m.length / 1000))

    # --- Dubai Tram: Al Sufouh -> Dubai Marina -> JBR loop -> back to Dubai Marina
    tram = routes[7826083]
    tram_m = to_m(stitch_relation(tram))
    tstops = relation_stops(tram)
    loop_end = next(i for i in range(7, len(tstops)) if tstops[i]["name"] == "Dubai Marina")
    tram_m = substring(tram_m, tram_m.project(pt_m(tstops[0]["lonlat"])), tram_m.project(pt_m(tstops[loop_end]["lonlat"])))
    tram_ids = register_stops("tram", tstops[: loop_end + 1])
    branches["tram"] = [tram_ids]
    add_segment("tram", tram_m)
    # walk the stop list in order along the (loop) geometry
    _edges_in_sequence("tram", tram_m, tstops[: loop_end + 1], tram_ids, 60 / C.SPEED_KMH["tram"])

    # --- Palm Monorail (Atlantis -> Gateway)
    mono_m, mono_stops = metro_line("monorail", 7825238)
    mono_ids = register_stops("monorail", mono_stops)
    branches["monorail"] = [mono_ids]
    add_segment("monorail", mono_m)
    add_edges_along("monorail", mono_m, mono_ids, 60 / C.SPEED_KMH["monorail"])


def _edges_in_sequence(line_id, line_m, stops, ids, minutes_per_km):
    """Edges for a line that revisits a stop (tram loop): project each stop after the previous one."""
    last = 0.0
    pos = []
    for s in stops:
        p = pt_m(s["lonlat"])
        best, best_d = None, float("inf")
        step = 25.0
        d = last
        while d <= line_m.length:
            q = line_m.interpolate(d)
            dist = q.distance(p)
            if dist < best_d - 0.5:
                best, best_d = d, dist
            if best is not None and dist > best_d + 400:
                break
            d += step
        pos.append(best)
        last = best
    for i in range(len(ids) - 1):
        km = (pos[i + 1] - pos[i]) / 1000
        if ids[i] == ids[i + 1]:
            continue
        add_edge(line_id, ids[i], ids[i + 1], piece(line_m, pos[i], pos[i + 1]), km * minutes_per_km, km)


# --------------------------------------------------------------------------------------
# Etihad Rail (track graph from OSM rail ways)
# --------------------------------------------------------------------------------------
def is_uae_rail(w):
    t = w.get("tags", {})
    if t.get("railway") == "rail":
        return True
    return t.get("railway") == "construction" and t.get("construction") == "rail"


def build_etihad():
    rail = [w for w in ways if is_uae_rail(w)]
    coords, adj = {}, {}
    mainline_nodes = set()
    for w in rail:
        t = w["tags"]
        service = t.get("service")
        # Prefer running lines slightly, but never force a detour: some main-line passing
        # loops are tagged as sidings, and a large penalty sent trains 70 km out of their way.
        penalty = 1.15 if service in ("yard", "siding", "spur", "crossover") else 1.0
        nodes, geom = w["nodes"], w["geometry"]
        for n, g in zip(nodes, geom):
            coords[n] = (g["lon"], g["lat"])
            if not service:
                mainline_nodes.add(n)
        for (a, ga), (b, gb) in zip(zip(nodes, geom), zip(nodes[1:], geom[1:])):
            pa, pb = _fwd.transform(ga["lon"], ga["lat"]), _fwd.transform(gb["lon"], gb["lat"])
            d = math.dist(pa, pb)
            adj.setdefault(a, []).append((b, d, d * penalty))
            adj.setdefault(b, []).append((a, d, d * penalty))

    proj = {n: _fwd.transform(*coords[n]) for n in mainline_nodes}

    def snap(lonlat, max_m=15000):
        x, y = _fwd.transform(*lonlat)
        n = min(proj, key=lambda k: (proj[k][0] - x) ** 2 + (proj[k][1] - y) ** 2)
        d = math.dist(proj[n], (x, y))
        if d > max_m:
            raise ValueError(f"no track within {max_m} m of {lonlat}")
        return n, d

    def path(a, b):
        dist = {a: 0.0}
        prev = {}
        heap = [(0.0, a)]
        while heap:
            d, u = heapq.heappop(heap)
            if u == b:
                break
            if d > dist[u]:
                continue
            for v, _, w in adj.get(u, ()):
                nd = d + w
                if nd < dist.get(v, float("inf")):
                    dist[v], prev[v] = nd, u
                    heapq.heappush(heap, (nd, v))
        if b not in dist:
            raise ValueError("track graph is disconnected between stations")
        seq = [b]
        while seq[-1] != a:
            seq.append(prev[seq[-1]])
        seq.reverse()
        return seq

    # stations + junctions. Mapped stations keep their OSM position; estimated ones sit on the track.
    node_of = {}
    for s in C.ETIHAD_STATIONS:
        n, d = snap(s["at"])
        node_of[s["id"]] = n
        where = coords[n] if s["approx"] else s["at"]
        add_station(s["id"], s["name"], s["name_ar"], where, "etihad", s["opened"], s["approx"], s.get("note"), s.get("short"))
        stations[s["id"]]["snap_m"] = round(d)
    for jid, ll in C.ETIHAD_JUNCTIONS.items():
        node_of[jid], _ = snap(ll, 3000)

    # An estimated station between two fixed points must sit on the route between them,
    # not on a parallel track (Al Faya's nearest node is on a loop that rejoins 30 km north).
    approx_ids = {s["id"] for s in C.ETIHAD_STATIONS if s["approx"]}
    by_id = {s["id"]: s for s in C.ETIHAD_STATIONS}
    for p in C.ETIHAD_PATHS:
        anchors = [i for i, x in enumerate(p) if x not in approx_ids]
        for i, x in enumerate(p):
            if x not in approx_ids:
                continue
            before = [a for a in anchors if a < i]
            after = [a for a in anchors if a > i]
            if not before or not after:
                continue
            route = path(node_of[p[before[-1]]], node_of[p[after[0]]])
            tx, ty = _fwd.transform(*by_id[x]["at"])
            n = min(route, key=lambda k: math.dist(_fwd.transform(*coords[k]), (tx, ty)))
            node_of[x] = n
            st = stations[x]
            st["coord"] = [round(coords[n][0], 5), round(coords[n][1], 5)]
            st["snap_m"] = round(math.dist(_fwd.transform(*coords[n]), (tx, ty)))

    station_open = {s["id"]: s["opened"] for s in C.ETIHAD_STATIONS}

    # legs, each opening with the earliest station beyond it on any path that uses it
    legs = {}
    for p in C.ETIHAD_PATHS:
        for i in range(len(p) - 1):
            beyond = [station_open.get(x) for x in p[i + 1:] if station_open.get(x)]
            date = min(beyond) if beyond else None
            key = (p[i], p[i + 1])
            if key not in legs or (date and (legs[key] is None or date < legs[key])):
                legs[key] = date

    leg_geoms = {}
    for (a, b), date in legs.items():
        seq = path(node_of[a], node_of[b])
        pts = [_fwd.transform(*coords[n]) for n in seq]
        # carry the line into stations whose platforms sit off the running line (e.g. Fujairah)
        for sid, end in ((a, 0), (b, -1)):
            st = stations.get(sid)
            if st and not st["approx"] and st.get("snap_m", 0) > 50:
                p = _fwd.transform(*st["coord"])
                pts = [p] + pts if end == 0 else pts + [p]
        geom_m = LineString(pts)
        leg_geoms[(a, b)] = geom_m
        add_segment("etihad", geom_m, opened=date, construction=None, tolerance=12)

    # calibrate minutes-per-km on the eastern main line (published times)
    def chain_km(a, b, p):
        i, j = p.index(a), p.index(b)
        return sum(leg_geoms[(p[k], p[k + 1])].length for k in range(i, j)) / 1000
    trunk = C.ETIHAD_PATHS[0]
    mpk_west = 57 / chain_km("er-mbz", "er-dubai", trunk)
    mpk_east = 48 / chain_km("er-dubai", "er-fuj", trunk)
    for (a, b), g in leg_geoms.items():
        east = trunk.index(a) >= trunk.index("er-dubai") if a in trunk and b in trunk else False
        mpk = mpk_east if east or a == "er-dubai" and b == "jct-sharjah" else mpk_west
        add_edge("etihad", a, b, g, g.length / 1000 * mpk)
        edges[-1]["opened"] = legs[(a, b)]
    branches["etihad"] = [p for p in C.ETIHAD_PATHS]

    # --- full network (freight + passenger track) for the base layer
    stage1, stage2, building = [], [], []
    for w in rail:
        t = w["tags"]
        if t.get("service"):
            continue
        g = to_m(LineString([(p["lon"], p["lat"]) for p in w["geometry"]]))
        if t.get("railway") == "construction":
            building.append(g)
        elif (t.get("name") or "") in C.FREIGHT_STAGE1_NAMES or (t.get("name:en") or "") in C.FREIGHT_STAGE1_NAMES:
            stage1.append(g)
        else:
            stage2.append(g)
    for group, stage in [(stage1, "stage1"), (stage2, "stage2"), (building, "link")]:
        dates = C.FREIGHT_STAGES[stage]
        merged = linemerge(group)
        parts = list(merged.geoms) if merged.geom_type == "MultiLineString" else [merged]
        for part in parts:
            if part.length < 300:
                continue
            add_segment("freight", part, opened=dates["opened"], construction=dates["construction"], tolerance=20)
            segments[-1]["stage"] = stage
    return coords, snap, path, node_of


# --------------------------------------------------------------------------------------
# Blue Line (OSM construction ways)
# --------------------------------------------------------------------------------------
def build_blue():
    blue_ways = [w for w in ways if w["tags"].get("railway") in ("construction", "proposed")
                 and "Blue Line" in (w["tags"].get("name") or w["tags"].get("name:en") or "")
                 and all(p["lon"] > 54 for p in w["geometry"])]
    kept = []
    for w in sorted(blue_ways, key=lambda w: w["id"]):
        g = to_m(LineString([(p["lon"], p["lat"]) for p in w["geometry"]]))
        if any(g.hausdorff_distance(k) < 60 for k in kept):
            continue
        kept.append(g)
    merged = linemerge(kept)
    parts = sorted(merged.geoms, key=lambda g: -g.length) if merged.geom_type == "MultiLineString" else [merged]
    main = parts[0]                         # Creek -> Academic City
    cp = parts[1]                           # Centrepoint -> towards International City
    gap = LineString([_fwd.transform(*p) for p in C.BLUE_GAP])
    # orient the Centrepoint branch to end where the gap begins
    if Point(cp.coords[0]).distance(Point(gap.coords[0])) < Point(cp.coords[-1]).distance(Point(gap.coords[0])):
        cp = LineString(list(cp.coords)[::-1])
    cp_full = LineString(list(cp.coords) + list(gap.coords)[1:])

    sdef = {s["id"]: s for s in C.BLUE_STATIONS}
    for s in C.BLUE_STATIONS:
        if "existing" in s:
            src = next(st for st in stations.values() if st["name"] == s["existing"] and st["id"].startswith("dm-"))
            s["resolved"] = src["id"]
            add_station(src["id"], src["name"], src["name_ar"], src["coord"], "blue", INHERIT)
        else:
            s["resolved"] = s["id"]
            add_station(s["id"], s["name"], s["name_ar"], s["at"], "blue", INHERIT, s["approx"], s.get("note"))
    rid = lambda x: sdef[x]["resolved"]
    creek_branch = [rid(x) for x in C.BLUE_BRANCHES[0]]
    cp_branch = [rid(x) for x in C.BLUE_BRANCHES[1]]
    branches["blue"] = [creek_branch, cp_branch]

    first = stations[creek_branch[0]]["coord"]
    main = cut(main, first, stations[creek_branch[-1]]["coord"])
    cp_full = cut(cp_full, stations[cp_branch[0]]["coord"], stations[cp_branch[-1]]["coord"])
    add_segment("blue", main)
    add_segment("blue", substring(cp_full, 0, cp_full.project(pt_m(C.BLUE_GAP[0]))))
    add_segment("blue", substring(cp_full, cp_full.project(pt_m(C.BLUE_GAP[0])), cp_full.length), alignment="indicative")

    # Creek -> Academic City 25 min; Centrepoint -> Academic City 17 min
    mpk_main = 25 / (main.length / 1000)
    add_edges_along("blue", main, creek_branch, mpk_main)
    ic1 = stations[rid("bl-ic1")]["coord"]
    trunk_min = along_km(main, ic1, stations[creek_branch[-1]]["coord"]) * mpk_main
    mpk_cp = max(0.5, (17 - trunk_min) / (cp_full.length / 1000))
    add_edges_along("blue", cp_full, cp_branch, mpk_cp)


# --------------------------------------------------------------------------------------
# Indicative lines: Gold, HSR, Hafeet (Oman section), Abu Dhabi Tram
# --------------------------------------------------------------------------------------
def snap_station_to(line_m, lonlat):
    p = line_m.interpolate(line_m.project(pt_m(lonlat)))
    return to_ll(p).coords[0]


def build_gold():
    g = C.GOLD
    line_m = smooth(g["waypoints"])
    add_segment("gold", line_m, alignment="indicative", tolerance=8)
    ids = []
    for s in g["stations"]:
        if "existing" in s:
            src = next(st for st in stations.values() if st["name"] == s["existing"] and st["id"].startswith("dm-"))
            add_station(src["id"], src["name"], src["name_ar"], src["coord"], "gold", INHERIT)
            ids.append(src["id"])
        else:
            add_station(s["id"], s["name"], s["name_ar"], snap_station_to(line_m, s["at"]), "gold", INHERIT, s["approx"], s.get("note"))
            ids.append(s["id"])
    branches["gold"] = [ids]
    add_edges_along("gold", line_m, ids, 60 / g["speed_kmh"])


def build_hsr():
    h = C.HSR
    line_m = smooth(h["waypoints"])
    add_segment("hsr", line_m, alignment="indicative", tolerance=10)
    ids = []
    for s in h["stations"]:
        add_station(s["id"], s["name"], s["name_ar"], snap_station_to(line_m, s["at"]), "hsr", INHERIT, s["approx"],
                    s.get("note"), s.get("short"))
        ids.append(s["id"])
    branches["hsr"] = [ids]
    add_edges_along("hsr", line_m, ids, h["minutes"] / (line_m.length / 1000))


def build_hafeet(etihad):
    coords, snap, path, node_of = etihad
    h = C.HAFEET
    uae = next(w for w in ways if w["tags"].get("name") == "Hafeet Rail")
    uae_m = to_m(LineString([(p["lon"], p["lat"]) for p in uae["geometry"]]))
    oman_m = smooth(h["oman_waypoints"], step_m=250)
    add_segment("hafeet", uae_m, tolerance=12)
    add_segment("hafeet", oman_m, alignment="indicative", tolerance=12)
    full = LineString(list(uae_m.coords) + list(oman_m.coords)[1:])

    alain_def, sohar_def = h["stations"]
    alain = snap_station_to(full, alain_def["near"])
    add_station("hf-alain", alain_def["name"], alain_def["name_ar"], alain, "hafeet", INHERIT, True, alain_def["note"])
    add_station("hf-sohar", sohar_def["name"], sohar_def["name_ar"], sohar_def["at"], "hafeet", INHERIT, True, sohar_def["note"])
    # Hafeet trains start at Abu Dhabi (MBZ City) and use Etihad track to the junction
    add_station("er-mbz", None, None, None, "hafeet", INHERIT)
    branches["hafeet"] = [["er-mbz", "hf-alain", "hf-sohar"]]
    # Hafeet trains run on Etihad track from Abu Dhabi to the junction, then on the new line.
    mbz_jct = LineString([_fwd.transform(*coords[n]) for n in path(node_of["er-mbz"], node_of["jct-hafeet"])])
    p_alain = full.project(pt_m(alain))
    to_alain = LineString(list(mbz_jct.coords) + list(piece(full, 0, p_alain).coords)[1:])
    add_edge("hafeet", "er-mbz", "hf-alain", to_alain, 53)
    add_edge("hafeet", "hf-alain", "hf-sohar", piece(full, p_alain, full.length), 47)


def build_adtram():
    t = C.ADTRAM
    geoms = [smooth(br, step_m=60) for br in t["branches"]]
    for g in geoms:
        add_segment("adtram", g, alignment="indicative", tolerance=4)
    for s in t["stations"]:
        add_station(s["id"], s["name"], s["name_ar"], s["at"], "adtram", INHERIT, s["approx"], s.get("note"), s.get("short"))
    branches["adtram"] = t["paths"]
    a, b, minutes = t["minutes"][0]
    mpk = minutes / (geoms[0].length / 1000)
    # each path runs along the branch geometry with the same index
    for p, g in zip(t["paths"], geoms):
        add_edges_along("adtram", g, p, mpk)


# --------------------------------------------------------------------------------------
# Transfers
# --------------------------------------------------------------------------------------
def resolve(ref):
    if ref in stations:
        return ref
    line, name = ref.split(":", 1)
    for st in stations.values():
        if st["name"] == name and any(l["id"] == line for l in st["lines"]):
            return st["id"]
    raise KeyError(ref)


URBAN = {"red", "green", "blue", "gold", "tram", "monorail", "adtram"}


def finalize_edges():
    """Give every edge simplified coordinates and the dates of the track it runs on."""
    seg_geoms = [(s, to_m(LineString(s["coords"]))) for s in segments]
    for e in edges:
        g = e.pop("_geom")
        e["coords"] = coords_out(g, 3 if e["line"] in URBAN else 12)
        meta = LINE_META[e["line"]]
        e["announced"] = meta.get("announced")
        if "opened" in e:               # Etihad legs carry their own date
            e["construction"] = None
            continue
        mid = g.interpolate(0.5, normalized=True)
        _, seg = min(((sg.distance(mid), s) for s, sg in seg_geoms if s["line"] == e["line"]), key=lambda x: x[0])
        e["opened"], e["construction"] = seg["opened"], seg["construction"]


def build_services():
    """Train runs for the animation: ordered stops + one continuous polyline."""
    by_pair = {}
    for e in edges:
        by_pair[(e["line"], e["a"], e["b"])] = (e, False)
        by_pair[(e["line"], e["b"], e["a"])] = (e, True)

    red_trunk, red_branch = branches["red"]
    i_np = red_trunk.index(red_branch[0])
    blue_creek, blue_cp = branches["blue"]
    i_ic1 = blue_creek.index(blue_cp[-1])
    runs = [("red", red_trunk[: i_np + 1] + red_branch[1:]), ("red", red_trunk),
            ("blue", blue_creek), ("blue", blue_cp + blue_creek[i_ic1 + 1:])]
    runs += [("etihad", s) for s in C.ETIHAD_SERVICES]
    for lid in ("green", "gold", "tram", "monorail", "hsr", "hafeet", "adtram"):
        runs += [(lid, b) for b in branches[lid]]

    services = []
    for lid, stops in runs:
        coords, stop_i, stop_t, t = [], [], [], 0.0
        for k, (a, b) in enumerate(zip(stops, stops[1:])):
            e, rev = by_pair[(lid, a, b)]
            pts = e["coords"][::-1] if rev else e["coords"]
            if k == 0:
                stop_i.append(0)
                stop_t.append(0.0)
                coords.extend(pts)
            else:
                coords.extend(pts[1:])
            t += e["min"]
            stop_i.append(len(coords) - 1)
            stop_t.append(round(t, 2))
        services.append({"line": lid, "stops": stops, "coords": coords, "stop_i": stop_i, "stop_t": stop_t})
    return services


def main():
    build_dubai()
    etihad = build_etihad()
    build_blue()
    build_gold()
    build_hsr()
    build_hafeet(etihad)
    build_adtram()
    finalize_edges()
    services = build_services()

    walks = [{"a": resolve(a), "b": resolve(b), "min": m} for a, b, m in C.WALK_LINKS]

    # tidy station records
    for st in stations.values():
        st["lines"].sort(key=lambda l: [x["id"] for x in C.LINES].index(l["id"]))

    lines_out = []
    for meta in C.LINES:
        lid = meta["id"]
        segs = [s for s in segments if s["line"] == lid]
        out = {k: v for k, v in meta.items()}
        out.setdefault("alignment", "osm")
        out["km_drawn"] = round(sum(s["km"] for s in segs), 1)
        out["branches"] = branches.get(lid, [])
        lines_out.append(out)

    data = {
        "as_of": C.AS_OF,
        "attribution": "Track and station data (c) OpenStreetMap contributors (ODbL). Planned lines drawn from public announcements.",
        "lines": lines_out,
        "segments": segments,
        "stations": sorted(stations.values(), key=lambda s: s["id"]),
        "edges": edges,
        "services": services,
        "walks": walks,
        "transfer_min": C.TRANSFER_MIN,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT.relative_to(ROOT)}: {len(lines_out)} lines, {len(segments)} segments, "
          f"{len(stations)} stations, {len(edges)} edges, {OUT.stat().st_size / 1024:.0f} KB")
    for l in lines_out:
        n_st = sum(1 for s in stations.values() if any(x["id"] == l["id"] for x in s["lines"]))
        mins = sum(e["min"] for e in edges if e["line"] == l["id"])
        print(f"  {l['id']:9s} drawn {l['km_drawn']:7.1f} km  stations {n_st:3d}  edge-minutes {mins:6.1f}")


if __name__ == "__main__":
    main()
