#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_pbf_layers.py
=====================
Extract thematic layers from an OpenStreetMap .osm.pbf into compact JSON
(consumed by the Vite app via fetch) and, optionally, standard GeoJSON.

One streaming pass over the file:
  * stores every node (delta-coded dense nodes -> compact arrays),
  * keeps only tagged point features that match a theme (places, POIs,
    power plants/substations, railway stations, wells),
  * keeps only ways that match a theme (roads by class, waterways, power
    lines, landuse polygons, admin boundaries, railway), deferring geometry
    resolution until all nodes are in memory (binary search).

Outputs (to public/data/pbf/):
  roads.json / water.json / power.json / places.json / pois.json /
  landuse.json / boundaries.json / railway.json   (compact schema)
  province_stats.json                              (per-province aggregates)
  and, with --geojson, standard .geojson FeatureCollections for QGIS etc.

Province assignment reuses the ~5-km grid approach of
extract_geojson_integration.py (point-in-polygon precomputed per cell).

Usage:
  python scripts/extract_pbf_layers.py iran.pbf [--geojson]
"""
from __future__ import annotations

import bisect
import json
import math
import os
import struct
import sys
from array import array
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze_pbf import (  # noqa: E402
    cumsum,
    decompress_blob,
    info_timestamp,
    message_keys_vals,
    message_latlon,
    parse_blobheader,
    parse_stringtable,
    read_varint,
    skip_wire,
    unpack_sint64,
    unpack_varints,
    zigzag,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "geojson")
OUT = os.path.join(ROOT, "public", "data", "pbf")


# ---------------------------------------------------------------------------
# Theme filters
# ---------------------------------------------------------------------------
HIGHWAYS = {
    "motorway", "trunk", "primary", "secondary",
    "motorway_link", "trunk_link", "primary_link", "secondary_link",
}
WATERWAYS = {"river", "canal", "stream", "drain", "dam", "weir", "waterfall"}
NATURAL_POLYS = {"water", "wetland"}
POWER_LINES = {"line", "minor_line"}
POWER_POINTS = {"substation", "plant", "generator", "transformer"}
PLACES = {
    "city", "town", "village", "hamlet", "suburb", "neighbourhood",
    "district", "isolated_dwelling", "locality", "quarter",
}
LANDUSE = {"industrial", "quarry", "military", "forest", "cemetery", "commercial", "landfill"}
RAILWAYS = {"rail"}
WELLS = {"petroleum_well", "water_well"}

POI_HEALTH = {"hospital", "clinic", "doctors", "dentist", "pharmacy", "nursing_home", "laboratory"}
POI_EDU = {"school", "college", "university", "kindergarten", "library"}
POI_FINANCE = {"bank", "atm"}
POI_TOURISM = {
    "hotel", "guest_house", "hostel", "motel", "apartment", "museum",
    "attraction", "artwork", "viewpoint", "information", "theme_park",
    "zoo", "aquarium",
}


def classify_point(tags):
    """Return (layer, (cls, name, pop, lat, lon)) or None. lat/lon in 1e-7 deg."""
    t = tags.get("place")
    if t in PLACES:
        return ("places", (t, tags.get("name"), tags.get("population")))
    amen = tags.get("amenity")
    if amen in POI_HEALTH:
        return ("pois", (amen, "health", tags.get("name")))
    if amen in POI_EDU:
        return ("pois", (amen, "education", tags.get("name")))
    if amen in POI_FINANCE:
        return ("pois", (amen, "finance", tags.get("name")))
    if amen == "fuel":
        return ("pois", ("fuel", "fuel", tags.get("name")))
    if amen == "place_of_worship":
        return ("pois", ("place_of_worship", "worship", tags.get("name")))
    hc = tags.get("healthcare")
    if hc in ("hospital", "clinic", "doctor", "dentist", "pharmacy", "laboratory"):
        return ("pois", (hc, "health", tags.get("name")))
    tou = tags.get("tourism")
    if tou in POI_TOURISM:
        return ("pois", (tou, "tourism", tags.get("name")))
    if tags.get("historic"):
        return ("pois", (tags["historic"], "heritage", tags.get("name")))
    pw = tags.get("power")
    if pw in POWER_POINTS:
        return ("power_points", (pw, tags.get("name"), None))
    if tags.get("railway") == "station":
        return ("railway_points", ("station", tags.get("name"), None))
    mm = tags.get("man_made")
    if mm in WELLS:
        return ("wells", (mm, None, None))
    return None


def classify_way(tags):
    """Return (layer, cls, name, ref) or None. Layers that are polygons:
    'water_polys' and 'landuse'."""
    hw = tags.get("highway")
    if hw in HIGHWAYS:
        return ("roads", hw, tags.get("name"), tags.get("ref"))
    ww = tags.get("waterway")
    if ww in WATERWAYS:
        return ("water_lines", ww, tags.get("name"), None)
    nat = tags.get("natural")
    if nat in NATURAL_POLYS:
        return ("water_polys", nat, tags.get("name"), None)
    pw = tags.get("power")
    if pw in POWER_LINES:
        return ("power_lines", pw, None, None)
    lu = tags.get("landuse")
    if lu in LANDUSE:
        return ("landuse", lu, tags.get("name"), None)
    bd = tags.get("boundary")
    if bd == "administrative":
        return ("boundaries", "administrative", tags.get("name"), None)
    rw = tags.get("railway")
    if rw in RAILWAYS:
        return ("railway_lines", rw, None, None)
    return None


# ---------------------------------------------------------------------------
# Province assignment helpers (copied from extract_geojson_integration.py)
# ---------------------------------------------------------------------------
def load_json(path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def _ring_contains(ring, lat, lng):
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > lat) != (y2 > lat):
            x_cross = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if x_cross > lng:
                inside = not inside
    return inside


def build_admin1_index():
    fc = load_json(os.path.join(GEO, "irn_admin1.geojson"))
    idx = []
    for f in fc.get("features", []):
        p = f.get("properties", {})
        geom = f.get("geometry", {})
        rings = []
        if geom.get("type") == "Polygon":
            rings = geom.get("coordinates", [])
        elif geom.get("type") == "MultiPolygon":
            for poly in geom.get("coordinates", []):
                rings.extend(poly)
        idx.append({
            "name_en": p.get("adm1_name", ""),
            "name_fa": p.get("adm1_name1", ""),
            "pcode": p.get("adm1_pcode", ""),
            "rings": rings,
            "bbox": {
                "min_lon": min(min(x for x, _ in r) for r in rings),
                "max_lon": max(max(x for x, _ in r) for r in rings),
                "min_lat": min(min(y for _, y in r) for r in rings),
                "max_lat": max(max(y for _, y in r) for r in rings),
            },
        })
    return idx


def assign_province(admin1, lat, lng):
    for prov in admin1:
        b = prov["bbox"]
        if lng < b["min_lon"] or lng > b["max_lon"] or lat < b["min_lat"] or lat > b["max_lat"]:
            continue
        for ring in prov["rings"]:
            if _ring_contains(ring, lat, lng):
                return prov
    return None


def build_grid_lookup(admin1, fa_to_code, step=0.05):
    grid = {}
    lat = 24.5
    while lat <= 40.5:
        lng = 43.5
        while lng <= 64.5:
            prov = assign_province(admin1, lat, lng)
            if prov:
                code = fa_to_code.get((prov["name_fa"] or "").strip(), prov["pcode"])
                grid[(round(lat / step) * step, round(lng / step) * step)] = code
            lng += step
        lat += step
    return grid


def build_fa_to_code():
    src = load_json(os.path.join(GEO, "new_data", "iran-provinces", "statistics_by_province.json"))
    by = src.get("by_province", {})
    fa_to_code = {}
    for code, s in by.items():
        fa_to_code[(s.get("name_fa", "") or "").replace("استان ", "").strip()] = code
    return fa_to_code


# ---------------------------------------------------------------------------
# PBF streaming
# ---------------------------------------------------------------------------
def parse_primitive_block(pb):
    """Split a PrimitiveBlock into (groups, strings, gran, lat_off, lon_off).
    Process groups after reading the whole block so granularity/offsets are
    available regardless of field order."""
    groups = []
    st_payload = None
    gran = 100
    lat_off = 0
    lon_off = 0
    pos = 0
    end = len(pb)
    while pos < end:
        tag, pos = read_varint(pb, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(pb, pos)
            payload = pb[pos:pos + ln]
            pos += ln
            if field == 1:
                st_payload = payload
            elif field == 2:
                groups.append(payload)
        elif wt == 0:
            v, pos = read_varint(pb, pos)
            if field == 17:
                gran = v
            elif field == 19:
                lat_off = zigzag(v)
            elif field == 20:
                lon_off = zigzag(v)
        else:
            pos = skip_wire(pb, pos, wt)
    strings = parse_stringtable(st_payload) if st_payload is not None else []
    return groups, strings, gran, lat_off, lon_off


def collect_ways(group, strings, gran, lat_off, lon_off, store):
    pos = 0
    end = len(group)
    while pos < end:
        tag, pos = read_varint(group, pos)
        field = tag >> 3
        wt = tag & 7
        if wt != 2:
            pos = skip_wire(group, pos, wt)
            continue
        ln, pos = read_varint(group, pos)
        msg = group[pos:pos + ln]
        pos += ln
        if field == 1:  # node
            collect_node(msg, strings, gran, lat_off, lon_off, store)
        elif field == 2:  # dense
            collect_dense(msg, strings, gran, lat_off, lon_off, store)
        elif field == 3:  # way
            collect_way(msg, strings, store)
        # field 4 = relation -> skipped (v1: way-based layers only)


def collect_node(msg, strings, gran, lat_off, lon_off, store):
    keys, vals = message_keys_vals(msg)
    lat, lon = message_latlon(msg)
    nid = None
    pos = 0
    end = len(msg)
    while pos < end:
        tag, pos = read_varint(msg, pos)
        f = tag >> 3
        wt = tag & 7
        if f == 1 and wt == 0:
            v, pos = read_varint(msg, pos)
            nid = zigzag(v)
        else:
            pos = skip_wire(msg, pos, wt)
    if nid is None:
        return
    lat7 = int(round((lat_off + gran * (lat or 0)) / 1e2))  # -> 1e-7 deg
    lon7 = int(round((lon_off + gran * (lon or 0)) / 1e2))
    store.add_node(nid, lat7, lon7)
    if not keys:
        return
    tags = {}
    for k, v in zip(keys, vals):
        if k != 0:
            tags[strings[k]] = strings[v]
    store.add_point(tags, lat7, lon7)


def collect_dense(msg, strings, gran, lat_off, lon_off, store):
    fields = {}
    pos = 0
    end = len(msg)
    while pos < end:
        tag, pos = read_varint(msg, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(msg, pos)
            fields.setdefault(field, []).append(msg[pos:pos + ln])
            pos += ln
        else:
            pos = skip_wire(msg, pos, wt)
    ids = cumsum(unpack_sint64(fields.get(1, [b""])[0])) if 1 in fields else []
    lats = cumsum(unpack_sint64(fields.get(8, [b""])[0])) if 8 in fields else []
    lons = cumsum(unpack_sint64(fields.get(9, [b""])[0])) if 9 in fields else []
    kvs = unpack_varints(fields.get(10, [b""])[0]) if 10 in fields else []

    tags_list = []
    cur = []
    for v in kvs:
        if v == 0:
            tags_list.append(cur)
            cur = []
        else:
            cur.append(v)

    for i, nid in enumerate(ids):
        lat7 = int(round((lat_off + gran * lats[i]) / 1e2)) if i < len(lats) else 0
        lon7 = int(round((lon_off + gran * lons[i]) / 1e2)) if i < len(lons) else 0
        store.add_node(nid, lat7, lon7)
        seg = tags_list[i] if i < len(tags_list) else []
        if not seg:
            continue
        tags = {}
        j = 0
        while j + 1 < len(seg):
            k = seg[j]
            v = seg[j + 1]
            if k != 0:
                tags[strings[k]] = strings[v]
            j += 2
        store.add_point(tags, lat7, lon7)


def collect_way(msg, strings, store):
    keys, vals = message_keys_vals(msg)
    if not keys:
        return
    tags = {}
    for k, v in zip(keys, vals):
        if k != 0:
            tags[strings[k]] = strings[v]
    cls = classify_way(tags)
    if cls is None:
        return
    layer, cname, name, ref = cls
    # decode refs (field 8, packed sint64, DELTA coded)
    refs_payload = None
    pos = 0
    end = len(msg)
    while pos < end:
        tag, pos = read_varint(msg, pos)
        field = tag >> 3
        wt = tag & 7
        if field == 8 and wt == 2:
            ln, pos = read_varint(msg, pos)
            refs_payload = msg[pos:pos + ln]
            pos += ln
        else:
            pos = skip_wire(msg, pos, wt)
    if refs_payload is None or len(refs_payload) < 2:
        return
    refs = array("q", cumsum(unpack_sint64(refs_payload)))
    store.add_way(layer, cname, name, ref, refs)


# ---------------------------------------------------------------------------
# Store / aggregator
# ---------------------------------------------------------------------------
class Store:
    def __init__(self):
        self.ids = array("q")
        self.lats = array("i")
        self.lons = array("i")
        self.ways = []           # (layer, cls, name, ref, refs_array)
        self.points = {k: [] for k in
                       ("places", "pois", "power_points", "railway_points", "wells")}

    def add_node(self, nid, lat7, lon7):
        self.ids.append(nid)
        self.lats.append(lat7)
        self.lons.append(lon7)

    def add_point(self, tags, lat7, lon7):
        r = classify_point(tags)
        if r is None:
            return
        layer, entry = r
        if layer in self.points:
            self.points[layer].append((*entry, lat7, lon7))

    def add_way(self, layer, cls, name, ref, refs):
        self.ways.append((layer, cls, name, ref, refs))

    def resolve(self, refs):
        out = []
        for r in refs:
            i = bisect.bisect_left(self.ids, r)
            if i < len(self.ids) and self.ids[i] == r:
                out.append((self.lons[i] / 1e7, self.lats[i] / 1e7))
            else:
                return None
        return out


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[1]), math.radians(a[0])
    lat2, lon2 = math.radians(b[1]), math.radians(b[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def r4(x):
    return round(x, 4)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    pbf_path = sys.argv[1]
    emit_geojson = "--geojson" in sys.argv

    print("building province grid...")
    admin1 = build_admin1_index()
    fa_to_code = build_fa_to_code()
    grid = build_grid_lookup(admin1, fa_to_code)
    print(f"grid cells: {len(grid)}")

    store = Store()
    n_blobs = 0

    with open(pbf_path, "rb") as f:
        while True:
            hlen_b = f.read(4)
            if not hlen_b:
                break
            (hlen,) = struct.unpack(">I", hlen_b)
            bh = f.read(hlen)
            typ, dsize = parse_blobheader(bh)
            blob = f.read(dsize)
            if typ == "OSMData":
                pb = decompress_blob(blob)
                groups, strings, gran, lat_off, lon_off = parse_primitive_block(pb)
                for g in groups:
                    collect_ways(g, strings, gran, lat_off, lon_off, store)
            n_blobs += 1
            if n_blobs % 3 == 0:
                print(f"  blob {n_blobs}: nodes={len(store.ids):,} kept_ways={len(store.ways):,}", flush=True)

    print(f"pass done: nodes={len(store.ids):,} kept_ways={len(store.ways):,}")
    for k, v in store.points.items():
        print(f"  points[{k}] = {len(v):,}")

    # ----------------------------------------------------------------
    # Resolve geometries + aggregate per-province stats
    # ----------------------------------------------------------------
    os.makedirs(OUT, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()

    layers = {
        "roads": {"lines": []},
        "water": {"lines": [], "polys": []},
        "power": {"lines": [], "points": []},
        "places": {"points": []},
        "pois": {"points": []},
        "landuse": {"polys": []},
        "boundaries": {"lines": []},
        "railway": {"lines": [], "points": []},
    }

    def add_line(layer, cls, name, ref, coords):
        layers[layer]["lines"].append(
            {"t": cls, **({"n": name} if name else {}), **({"r": ref} if ref else {}),
             "c": [[r4(x), r4(y)] for x, y in coords]}
        )

    def add_poly(layer, cls, name, coords):
        layers[layer]["polys"].append(
            {"t": cls, **({"n": name} if name else {}),
             "c": [[[r4(x), r4(y)] for x, y in coords]]}
        )

    def add_point(layer, cls, name, pop, lat7, lon7):
        d = {"t": cls, "c": [r4(lon7 / 1e7), r4(lat7 / 1e7)]}
        if name:
            d["n"] = name
        if pop:
            d["p"] = pop
        layers[layer]["points"].append(d)

    # province stats
    def ensure_stat(code):
        if code not in stats:
            stats[code] = {
                "roadsKm": {}, "railwayKm": 0.0, "waterWays": 0, "dams": 0,
                "powerSubstations": 0, "powerPlants": 0, "generators": 0,
                "wells": 0, "hospitals": 0, "clinics": 0, "schools": 0,
                "banks": 0, "atms": 0, "fuel": 0, "cities": 0, "towns": 0,
                "villages": 0, "hamlets": 0, "neighbourhoods": 0,
                "placesTotal": 0, "poisTotal": 0,
            }
        return stats[code]

    stats = {}
    name_by_code = {}
    for prov in admin1:
        code = fa_to_code.get((prov["name_fa"] or "").strip(), prov["pcode"])
        name_by_code[code] = "استان " + (prov["name_fa"] or "")
        ensure_stat(code)

    def prov_code(lat, lon):
        return grid.get((round(lat / 0.05) * 0.05, round(lon / 0.05) * 0.05))

    target_map = {
        "water_lines": "water", "water_polys": "water",
        "power_lines": "power", "railway_lines": "railway",
    }
    resolved = 0
    unresolved = 0
    for layer, cls, name, ref, refs in store.ways:
        coords = store.resolve(refs)
        if coords is None or len(coords) < 2:
            unresolved += 1
            continue
        resolved += 1
        target = target_map.get(layer, layer)
        if layer in ("landuse", "water_polys"):
            add_poly(target, cls, name, coords)
        else:
            add_line(target, cls, name, ref, coords)

        # stats: vertex-vote province + length (roads/railway/water)
        if layer in ("roads", "railway_lines", "water_lines"):
            total_km = 0.0
            votes = {}
            for a, b in zip(coords, coords[1:]):
                total_km += haversine_km(a, b)
                code = prov_code(a[1], a[0])
                if code:
                    votes[code] = votes.get(code, 0) + 1
            if votes:
                code = max(votes, key=votes.get)
                s = ensure_stat(code)
                if layer == "roads":
                    s["roadsKm"][cls] = s["roadsKm"].get(cls, 0.0) + total_km
                elif layer == "railway_lines":
                    s["railwayKm"] += total_km
                else:
                    s["waterWays"] += 1
                    if cls == "dam":
                        s["dams"] += 1

    # point features -> layers + stats
    def stat_place(s, cls, name):
        s["placesTotal"] += 1
        if cls == "city":
            s["cities"] += 1
        elif cls == "town":
            s["towns"] += 1
        elif cls == "village":
            s["villages"] += 1
        elif cls == "hamlet":
            s["hamlets"] += 1
        elif cls == "neighbourhood":
            s["neighbourhoods"] += 1

    def stat_poi(s, cls, k, name):
        s["poisTotal"] += 1
        if k == "health":
            if cls == "hospital":
                s["hospitals"] += 1
            elif cls in ("clinic", "doctor", "doctors", "dentist", "pharmacy", "laboratory"):
                s["clinics"] += 1
        elif k == "education":
            s["schools"] += 1
        elif k == "finance":
            if cls == "bank":
                s["banks"] += 1
            else:
                s["atms"] += 1
        elif k == "fuel":
            s["fuel"] += 1

    def stat_power(s, cls, name):
        if cls == "substation":
            s["powerSubstations"] += 1
        elif cls == "plant":
            s["powerPlants"] += 1
        elif cls == "generator":
            s["generators"] += 1

    def stat_well(s, cls, name):
        s["wells"] += 1

    # places: (cls, name, pop)
    for cls, name, pop, lat7, lon7 in store.points["places"]:
        lat = lat7 / 1e7
        lon = lon7 / 1e7
        add_point("places", cls, name, pop, lat7, lon7)
        code = prov_code(lat, lon)
        if code:
            stat_place(ensure_stat(code), cls, name)

    # pois: (cls, category, name)
    for cls, k, name, lat7, lon7 in store.points["pois"]:
        lat = lat7 / 1e7
        lon = lon7 / 1e7
        add_point("pois", cls, name, None, lat7, lon7)
        code = prov_code(lat, lon)
        if code:
            stat_poi(ensure_stat(code), cls, k, name)

    # power points: (cls, name, _)
    for cls, name, _pop, lat7, lon7 in store.points["power_points"]:
        lat = lat7 / 1e7
        lon = lon7 / 1e7
        add_point("power", cls, name, None, lat7, lon7)
        code = prov_code(lat, lon)
        if code:
            stat_power(ensure_stat(code), cls, name)

    # railway stations: (cls, name, _)
    for cls, name, _pop, lat7, lon7 in store.points["railway_points"]:
        add_point("railway", cls, name, None, lat7, lon7)

    # wells: (cls, _, _) — stats only
    for cls, _a, _b, lat7, lon7 in store.points["wells"]:
        lat = lat7 / 1e7
        lon = lon7 / 1e7
        code = prov_code(lat, lon)
        if code:
            stat_well(ensure_stat(code), cls, None)

    print(f"resolved ways: {resolved:,}, unresolved: {unresolved:,}")

    # ----------------------------------------------------------------
    # Write compact JSON
    # ----------------------------------------------------------------
    src_note = ("OpenStreetMap (ODbL) — iran.pbf (osmconvert 0.8.11, replication 2026-08-09), "
                "استخراج با scripts/extract_pbf_layers.py")
    for key, obj in layers.items():
        obj["source"] = src_note
        obj["generatedAtUtc"] = now
        path = os.path.join(OUT, f"{key}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        n = sum(len(obj.get(k, [])) for k in ("lines", "polys", "points"))
        print(f"  wrote {key}.json  ({n:,} features, {os.path.getsize(path) / 1e6:.1f} MB)")

    prov_stats = {"provinces": {}, "names": name_by_code}
    for code, s in stats.items():
        prov_stats["provinces"][code] = {
            "name": name_by_code.get(code, ""),
            **s,
        }
    prov_stats["source"] = src_note
    prov_stats["generatedAtUtc"] = now
    prov_stats["note"] = ("تخصیص با شبکهٔ ~۵ کیلومتری (مرکزیت/رأی رئوس) — تقریب مرزی ±۵ کیلومتر؛ "
                          "طول راه‌ها به استانی که اکثر رئوس در آن است نسبت داده شده است.")
    spath = os.path.join(OUT, "province_stats.json")
    with open(spath, "w", encoding="utf-8") as f:
        json.dump(prov_stats, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote province_stats.json ({os.path.getsize(spath) / 1e3:.0f} KB)")

    # ----------------------------------------------------------------
    # Optional standard GeoJSON
    # ----------------------------------------------------------------
    if emit_geojson:
        def to_fc(features, geom_fn, props_fn):
            out = []
            for feats, gfn, pfn in features:
                for f in feats:
                    g = gfn(f)
                    if g:
                        out.append({"type": "Feature", "properties": pfn(f), "geometry": g})
            return {"type": "FeatureCollection", "features": out}

        def fc_points(pts):
            return {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature",
                     "properties": {"class": p["t"], "name": p.get("n"), "population": p.get("p")},
                     "geometry": {"type": "Point", "coordinates": p["c"]}}
                    for p in pts
                ],
            }

        def fc_lines(lines):
            return {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature",
                     "properties": {"class": l["t"], "name": l.get("n"), "ref": l.get("r")},
                     "geometry": {"type": "LineString", "coordinates": l["c"]}}
                    for l in lines
                ],
            }

        def fc_polys(polys):
            return {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature",
                     "properties": {"class": p["t"], "name": p.get("n")},
                     "geometry": {"type": "Polygon", "coordinates": p["c"]}}
                    for p in polys
                ],
            }

        geojson_map = {
            "roads": ("roads.geojson", fc_lines(layers["roads"]["lines"])),
            "water": ("water.geojson", {"type": "FeatureCollection", "features": []}),
            "power": ("power.geojson", {"type": "FeatureCollection", "features": []}),
            "places": ("places.geojson", fc_points(layers["places"]["points"])),
            "pois": ("pois.geojson", fc_points(layers["pois"]["points"])),
            "landuse": ("landuse.geojson", fc_polys(layers["landuse"]["polys"])),
            "boundaries": ("boundaries.geojson", fc_lines(layers["boundaries"]["lines"])),
            "railway": ("railway.geojson", {"type": "FeatureCollection", "features": []}),
        }
        water_fc = {"type": "FeatureCollection", "features": []}
        water_fc["features"] = fc_lines(layers["water"]["lines"])["features"] + \
            fc_polys(layers["water"]["polys"])["features"]
        geojson_map["water"] = ("water.geojson", water_fc)
        power_fc = {"type": "FeatureCollection", "features": []}
        power_fc["features"] = fc_lines(layers["power"]["lines"])["features"] + \
            fc_points(layers["power"]["points"])["features"]
        geojson_map["power"] = ("power.geojson", power_fc)
        rail_fc = {"type": "FeatureCollection", "features": []}
        rail_fc["features"] = fc_lines(layers["railway"]["lines"])["features"] + \
            fc_points(layers["railway"]["points"])["features"]
        geojson_map["railway"] = ("railway.geojson", rail_fc)

        for key, (fname, fc) in geojson_map.items():
            path = os.path.join(OUT, fname)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
            print(f"  wrote {fname} ({os.path.getsize(path) / 1e6:.1f} MB)")

    print("done.")


if __name__ == "__main__":
    main()
