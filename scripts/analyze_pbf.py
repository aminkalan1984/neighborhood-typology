#!/usr/bin/env python3
"""
analyze_pbf.py — Pure-Python analysis of an OpenStreetMap .osm.pbf file.

No external dependencies (stdlib only: struct, zlib, collections).

Two passes over the blobs:
  * COUNT pass (every blob): exact totals for nodes / ways / relations /
    changesets, how many entities carry tags, header info (bbox, generator,
    replication timestamp). Field-skipping only, no string decoding.
  * SAMPLE pass (every SAMPLE_EVERY-th OSMData blob): full decode with the
    string table — top tag keys, value breakdowns for key dimensions
    (highway, place, natural, landuse, waterway, amenity, boundary, ...),
    entity timestamp range, and example place names with coordinates.

Usage:
  python scripts/analyze_pbf.py iran.pbf [--sample-every N]
"""
import collections
import struct
import sys
import zlib

VALUE_KEYS = [
    "highway", "place", "natural", "landuse", "waterway", "amenity",
    "boundary", "railway", "power", "tourism", "leisure", "shop",
    "man_made", "building", "barrier", "aeroway", "water", "surface",
    "industrial", "historic", "office", "healthcare", "emergency",
    "landcover", "route", "type", "population", "name", "name:fa",
    "name:en", "int_name", "wikidata",
]


def read_varint(buf, pos):
    result = 0
    shift = 0
    while True:
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            return result, pos
        shift += 7


def zigzag(n):
    return (n >> 1) ^ -(n & 1)


def count_varints(buf):
    """Number of varints in a packed buffer == count of bytes < 0x80."""
    return sum(map((128).__gt__, buf))


def unpack_varints(buf):
    vals = []
    pos = 0
    end = len(buf)
    while pos < end:
        v, pos = read_varint(buf, pos)
        vals.append(v)
    return vals


def unpack_sint64(buf):
    return [zigzag(v) for v in unpack_varints(buf)]


def cumsum(vals):
    out = []
    acc = 0
    for v in vals:
        acc += v
        out.append(acc)
    return out


def skip_wire(buf, pos, wt):
    if wt == 0:
        _, pos = read_varint(buf, pos)
        return pos
    if wt == 1:
        return pos + 8
    if wt == 2:
        ln, pos = read_varint(buf, pos)
        return pos + ln
    if wt == 5:
        return pos + 4
    raise ValueError("bad wire type %d" % wt)


# --------------------------------------------------------------------------
# Blob / file plumbing
# --------------------------------------------------------------------------

def parse_blobheader(buf):
    typ = None
    dsize = None
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(buf, pos)
            data = buf[pos:pos + ln]
            pos += ln
            if field == 1:
                typ = data.decode("utf-8", "replace")
        elif field == 3 and wt == 0:
            dsize, pos = read_varint(buf, pos)
        else:
            pos = skip_wire(buf, pos, wt)
    return typ, dsize


def decompress_blob(buf):
    raw = None
    z = None
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(buf, pos)
            data = buf[pos:pos + ln]
            pos += ln
            if field == 1:
                raw = data
            elif field == 3:
                z = data
        else:
            pos = skip_wire(buf, pos, wt)
    if z is not None:
        return zlib.decompress(z)
    if raw is not None:
        return raw
    raise RuntimeError("unsupported blob compression")


# --------------------------------------------------------------------------
# HeaderBlock
# --------------------------------------------------------------------------

def parse_header_block(buf):
    out = {}
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(buf, pos)
            data = buf[pos:pos + ln]
            pos += ln
            if field == 1:
                out["bbox"] = parse_bbox(data)
            elif field in (4, 5):
                out.setdefault("features", []).append(
                    (field, data.decode("utf-8", "replace"))
                )
            elif field == 16:
                out["writingprogram"] = data.decode("utf-8", "replace")
            elif field == 17:
                out["source"] = data.decode("utf-8", "replace")
        elif field == 32 and wt == 0:
            v, pos = read_varint(buf, pos)
            out["replication_timestamp"] = v
        else:
            pos = skip_wire(buf, pos, wt)
    return out


def parse_bbox(buf):
    vals = {}
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 0:
            v, pos = read_varint(buf, pos)
            vals[field] = zigzag(v)
        else:
            pos = skip_wire(buf, pos, wt)
    return {k: v / 1e9 for k, v in vals.items()}  # nano-degrees -> degrees


# --------------------------------------------------------------------------
# COUNT pass (field-skipping)
# --------------------------------------------------------------------------

def msg_has_keys(buf):
    """True if a node/way/relation message carries keys (field 2) or vals (3)."""
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if field in (2, 3) and wt == 2:
            return True
        pos = skip_wire(buf, pos, wt)
    return False


def count_tagged_segments(buf):
    """Dense keys_vals: number of nodes with >= 1 tag."""
    n = 0
    seg_has = 0
    i = 0
    end = len(buf)
    while i < end:
        v = 0
        shift = 0
        while True:
            b = buf[i]
            i += 1
            v |= (b & 0x7F) << shift
            if not (b & 0x80):
                break
            shift += 7
        if v == 0:
            n += 1 if seg_has else 0
            seg_has = 0
        else:
            seg_has = 1
    return n


def scan_dense(dense):
    ids = 0
    tagged = 0
    pos = 0
    end = len(dense)
    while pos < end:
        tag, pos = read_varint(dense, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(dense, pos)
            payload = dense[pos:pos + ln]
            pos += ln
            if field == 1:
                ids += count_varints(payload)
            elif field == 10:
                tagged += count_tagged_segments(payload)
        else:
            pos = skip_wire(dense, pos, wt)
    return ids, tagged


def scan_group_counts(group, stats):
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
            stats["nodes"] += 1
            stats["nodes_tagged"] += 1 if msg_has_keys(msg) else 0
        elif field == 2:  # dense nodes
            ids, tagged = scan_dense(msg)
            stats["nodes"] += ids
            stats["nodes_tagged"] += tagged
        elif field == 3:  # way
            stats["ways"] += 1
            stats["ways_tagged"] += 1 if msg_has_keys(msg) else 0
        elif field == 4:  # relation
            stats["relations"] += 1
            stats["relations_tagged"] += 1 if msg_has_keys(msg) else 0
        elif field == 5:  # changeset
            stats["changesets"] += 1


def scan_block_counts(buf, stats):
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if field == 2 and wt == 2:
            ln, pos = read_varint(buf, pos)
            scan_group_counts(buf[pos:pos + ln], stats)
            pos += ln
        else:
            pos = skip_wire(buf, pos, wt)


# --------------------------------------------------------------------------
# SAMPLE pass (full decode)
# --------------------------------------------------------------------------

def parse_stringtable(buf):
    strings = []
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if field == 1 and wt == 2:
            ln, pos = read_varint(buf, pos)
            strings.append(buf[pos:pos + ln].decode("utf-8", "replace"))
            pos += ln
        else:
            pos = skip_wire(buf, pos, wt)
    return strings


def message_keys_vals(buf):
    keys = None
    vals = None
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(buf, pos)
            payload = buf[pos:pos + ln]
            pos += ln
            if field == 2:
                keys = unpack_varints(payload)
            elif field == 3:
                vals = unpack_varints(payload)
        else:
            pos = skip_wire(buf, pos, wt)
    return keys or [], vals or []


def message_latlon(buf):
    lat = None
    lon = None
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 0:
            if field == 8:
                v, pos = read_varint(buf, pos)
                lat = zigzag(v)
            elif field == 9:
                v, pos = read_varint(buf, pos)
                lon = zigzag(v)
            else:
                pos = skip_wire(buf, pos, wt)
        else:
            pos = skip_wire(buf, pos, wt)
    return lat, lon


def info_timestamp(buf):
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if field == 2 and wt == 0:
            v, pos = read_varint(buf, pos)
            return v
        pos = skip_wire(buf, pos, wt)
    return None


def denseinfo_timestamps(buf):
    deltas = None
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if field == 2 and wt == 2:
            ln, pos = read_varint(buf, pos)
            deltas = unpack_sint64(buf[pos:pos + ln])
            pos += ln
        else:
            pos = skip_wire(buf, pos, wt)
    out = []
    acc = 0
    for d in deltas or []:
        acc += d
        out.append(acc)
    return out


def parse_dense_full(dense, strings, gran, lat_off, lon_off, sample):
    fields = collections.defaultdict(list)
    pos = 0
    end = len(dense)
    while pos < end:
        tag, pos = read_varint(dense, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(dense, pos)
            fields[field].append(dense[pos:pos + ln])
            pos += ln
        else:
            pos = skip_wire(dense, pos, wt)

    # DenseNodes id/lat/lon are DELTA (cumulative) coded in the PBF spec
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
        tag_idx = tags_list[i] if i < len(tags_list) else []
        tags = {}
        j = 0
        while j + 1 < len(tag_idx):
            k = tag_idx[j]
            v = tag_idx[j + 1]
            if k != 0:
                tags[strings[k]] = strings[v]
            j += 2
        lat = (lat_off + gran * lats[i]) / 1e9 if i < len(lats) else None
        lon = (lon_off + gran * lons[i]) / 1e9 if i < len(lons) else None
        ingest_entity(sample, "node", tags, lat, lon, nid)

    if 5 in fields:
        ts = denseinfo_timestamps(fields[5][0])
        if ts:
            sample["tmin"] = min(sample["tmin"], min(ts))
            sample["tmax"] = max(sample["tmax"], max(ts))


def parse_node_full(node, strings, gran, lat_off, lon_off, sample):
    keys, vals = message_keys_vals(node)
    lat, lon = message_latlon(node)
    tags = {}
    for k, v in zip(keys, vals):
        if k != 0:
            tags[strings[k]] = strings[v]
    if lat is not None:
        lat = (lat_off + gran * lat) / 1e9
    if lon is not None:
        lon = (lon_off + gran * lon) / 1e9
    ts = info_timestamp(node)
    if ts is not None:
        sample["tmin"] = min(sample["tmin"], ts)
        sample["tmax"] = max(sample["tmax"], ts)
    ingest_entity(sample, "node", tags, lat, lon, None)


def parse_way_full(way, strings, sample):
    keys, vals = message_keys_vals(way)
    tags = {}
    for k, v in zip(keys, vals):
        if k != 0:
            tags[strings[k]] = strings[v]
    ts = info_timestamp(way)
    if ts is not None:
        sample["tmin"] = min(sample["tmin"], ts)
        sample["tmax"] = max(sample["tmax"], ts)
    ingest_entity(sample, "way", tags, None, None, None)


def ingest_entity(sample, etype, tags, lat, lon, oid):
    sample["entities"][etype] += 1
    if not tags:
        return
    sample["entities_tagged"][etype] += 1
    for k, v in tags.items():
        sample["keys"][k] += 1
        if k in VALUE_KEYS:
            sample["values"][k][v] += 1
    if "name:fa" in tags:
        sample["name_fa"] += 1
    place = tags.get("place")
    if place in ("city", "town", "village", "hamlet") and lat is not None and lon is not None:
        if len(sample["places"][place]) < 6:
            sample["places"][place].append(
                (tags.get("name") or "?", tags.get("population") or "?", lat, lon)
            )


def full_scan_block(buf, strings_out, sample):
    strings = None
    gran = 100
    lat_off = 0
    lon_off = 0
    pos = 0
    end = len(buf)
    while pos < end:
        tag, pos = read_varint(buf, pos)
        field = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, pos = read_varint(buf, pos)
            msg = buf[pos:pos + ln]
            pos += ln
            if field == 1:
                strings = parse_stringtable(msg)
            elif field == 2:
                scan_group_full(msg, strings, gran, lat_off, lon_off, sample)
        elif wt == 0:
            v, pos = read_varint(buf, pos)
            if field == 17:
                gran = v
            elif field == 19:
                lat_off = zigzag(v)
            elif field == 20:
                lon_off = zigzag(v)
        else:
            pos = skip_wire(buf, pos, wt)
    if strings is not None:
        strings_out.append(len(strings))


def scan_group_full(group, strings, gran, lat_off, lon_off, sample):
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
        if field == 1:
            parse_node_full(msg, strings, gran, lat_off, lon_off, sample)
        elif field == 2:
            parse_dense_full(msg, strings, gran, lat_off, lon_off, sample)
        elif field == 3:
            parse_way_full(msg, strings, sample)
        elif field == 4:
            keys, vals = message_keys_vals(msg)
            tags = {}
            for k, v in zip(keys, vals):
                if k != 0:
                    tags[strings[k]] = strings[v]
            sample["entities"]["relation"] += 1
            if tags:
                sample["entities_tagged"]["relation"] += 1
                for k, v in tags.items():
                    sample["keys"][k] += 1
                    if k in VALUE_KEYS:
                        sample["values"][k][v] += 1
                if "name:fa" in tags:
                    sample["name_fa"] += 1


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def fmt_int(n):
    return f"{n:,}"


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    sample_every = 25
    if "--sample-every" in sys.argv:
        sample_every = int(sys.argv[sys.argv.index("--sample-every") + 1])

    stats = collections.Counter()
    sample = {
        "keys": collections.Counter(),
        "values": collections.defaultdict(collections.Counter),
        "entities": collections.Counter(),
        "entities_tagged": collections.Counter(),
        "tmin": None,
        "tmax": None,
        "places": collections.defaultdict(list),
        "name_fa": 0,
    }
    header = {}
    n_blobs = 0
    n_data = 0
    n_sampled = 0
    compressed_bytes = 0

    with open(path, "rb") as f:
        while True:
            hlen_b = f.read(4)
            if not hlen_b:
                break
            (hlen,) = struct.unpack(">I", hlen_b)
            bh = f.read(hlen)
            typ, dsize = parse_blobheader(bh)
            blob = f.read(dsize)
            compressed_bytes += dsize
            if typ == "OSMHeader":
                hb = decompress_blob(blob)
                h = parse_header_block(hb)
                header.update(h)
            elif typ == "OSMData":
                pb = decompress_blob(blob)
                scan_block_counts(pb, stats)
                if n_data % sample_every == 0:
                    full_scan_block(pb, [], sample)
                    n_sampled += 1
                n_data += 1
            n_blobs += 1

    print("=" * 74)
    print("OSM PBF analysis:", path)
    print("=" * 74)

    print("\n[File / header]")
    print(f"  blobs                : {fmt_int(n_blobs)}  (compressed {fmt_int(compressed_bytes)} bytes)")
    print(f"  writing program      : {header.get('writingprogram')}")
    print(f"  source               : {header.get('source')}")
    req = [x[1] for x in header.get("features", []) if x[0] == 4]
    opt = [x[1] for x in header.get("features", []) if x[0] == 5]
    print(f"  required features    : {req}")
    print(f"  optional features    : {opt}")
    if "bbox" in header:
        b = header["bbox"]
        print(f"  bbox (deg)           : S {b.get(4):.4f} W {b.get(1):.4f} N {b.get(3):.4f} E {b.get(2):.4f}")
    if "replication_timestamp" in header:
        import datetime
        ts = header["replication_timestamp"]
        print(f"  replication timestamp: {datetime.datetime.utcfromtimestamp(ts).isoformat()}Z")

    print("\n[Counts — full file]")
    nodes = stats["nodes"]
    ways = stats["ways"]
    rels = stats["relations"]
    print(f"  nodes      : {fmt_int(nodes)}  (tagged: {fmt_int(stats['nodes_tagged'])})")
    print(f"  ways       : {fmt_int(ways)}  (tagged: {fmt_int(stats['ways_tagged'])})")
    print(f"  relations  : {fmt_int(rels)}  (tagged: {fmt_int(stats['relations_tagged'])})")
    print(f"  changesets : {fmt_int(stats['changesets'])}")

    # extrapolation factor
    denom = sum(sample["entities"].values())
    factor = nodes / denom if denom else 1.0

    print(f"\n[Sample — {n_sampled} blobs fully decoded, extrapolation factor x{factor:.2f}]")
    print(f"  sample entities: nodes {fmt_int(sample['entities']['node'])}, "
          f"ways {fmt_int(sample['entities']['way'])}, "
          f"relations {fmt_int(sample['entities']['relation'])})")
    if sample["tmin"] is not None:
        import datetime
        print(f"  entity timestamp range: "
              f"{datetime.datetime.utcfromtimestamp(sample['tmin']).isoformat()}Z"
              f" .. {datetime.datetime.utcfromtimestamp(sample['tmax']).isoformat()}Z")
    print(f"  entities with name:fa: {fmt_int(sample['name_fa'])} (est. {fmt_int(sample['name_fa'] * factor)})")

    print("\n  Top 45 tag keys (sample):")
    for k, c in sample["keys"].most_common(45):
        print(f"    {c:>10,}  {k}")

    for key in VALUE_KEYS:
        if key in sample["values"] and sample["values"][key]:
            print(f"\n  value distribution: {key} (top 12)")
            for v, c in sample["values"][key].most_common(12):
                print(f"    {c:>9,}  {v}")

    print("\n  Example places (name, population, lat, lon):")
    for place, items in sample["places"].items():
        print(f"    [{place}]")
        for name, pop, lat, lon in items:
            print(f"      {name!r} pop={pop} @ {lat:.4f},{lon:.4f}")


if __name__ == "__main__":
    main()
