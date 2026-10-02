# -*- coding: utf-8 -*-
"""
extract_geojson_integration.py
==============================
Deep inventory of `geojson/` -> compact, app-ready datasets in `src/data/spatial/`.

Reads raw (and previously-organized) sources and emits four small JSON files
that the Vite app loads via `?url` + fetch (the project's existing pattern):

  1. province-geo-stats.json   — 31-province master (infrastructure by group,
                                 socioeconomic, environmental, satellite NDVI)
  2. health-facilities.json    — per-province x category counts + sampled points
                                 (Healthsites.io, 15,318 features, province assigned
                                 by point-in-polygon against irn_admin1.geojson)
  3. transport-points.json     — airports / sea ports / education / financial /
                                 populated-places point samples + per-province counts
  4. hospital-access.json      — HeiGIT travel-time accessibility per province

Run:
    python scripts/extract_geojson_integration.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "geojson")
OUT = os.path.join(ROOT, "src", "data", "spatial")
os.makedirs(OUT, exist_ok=True)


def load_json(path: str):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# 1. Province master (from the previous extraction's statistics_by_province)
# ---------------------------------------------------------------------------
def build_province_geo_stats() -> tuple[dict, dict]:
    """Returns (dataset, pcode->sci-code map via Persian name)."""
    src = load_json(os.path.join(GEO, "new_data", "iran-provinces", "statistics_by_province.json"))
    by = src.get("by_province", {})
    provinces = {}
    fa_to_code = {}
    for code, s in by.items():
        provinces[code] = {
            "code": code,
            "nameFa": s.get("name_fa", ""),
            "totalFeatures": s.get("total_features"),
            "educationCount": s.get("education_count"),
            "byGroup": s.get("by_group", {}),
            "socioeconomic": s.get("socioeconomic", {}),
            "environmental": s.get("environmental", {}),
            "satellite": s.get("satellite", {}),
        }
        fa_to_code[(s.get("name_fa", "") or "").replace("استان ", "").strip()] = code
    dataset = {
        "generatedAtUtc": now_utc(),
        "source": "geojson/new_data/iran-provinces/statistics_by_province.json "
                  "(OSM Overpass + HOT OSM + SCI + UNDP + satellite proxy, 2026-05)",
        "provinces": provinces,
    }
    return dataset, fa_to_code


# ---------------------------------------------------------------------------
# Point-in-polygon helpers (ray casting over irn_admin1.geojson)
# ---------------------------------------------------------------------------
def _ring_contains(ring, lat, lng) -> bool:
    """Ray-casting test. ring = list of [lng, lat]."""
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        # lat = y (north), lng = x (east)
        if (y1 > lat) != (y2 > lat):
            x_cross = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if x_cross > lng:
                inside = not inside
    return inside


def build_admin1_index() -> list[dict]:
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
        lon, lat = 0.0, 0.0
        for ring in rings:
            for x, y in ring:
                lon += x
                lat += y
        n_pts = sum(len(r) for r in rings) or 1
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
            "centroid": (lon / n_pts, lat / n_pts),
        })
    return idx


def assign_province(admin1: list[dict], lat: float, lng: float):
    """Returns the matching province dict or None."""
    for prov in admin1:
        b = prov["bbox"]
        if lng < b["min_lon"] or lng > b["max_lon"] or lat < b["min_lat"] or lat > b["max_lat"]:
            continue
        for ring in prov["rings"]:
            if _ring_contains(ring, lat, lng):
                return prov
    return None


# ---------------------------------------------------------------------------
# 2. Health facilities (Healthsites.io 15,318 enriched)
# ---------------------------------------------------------------------------
HEALTH_CATEGORY_ORDER = [
    "داروخانه", "کلینیک / درمانگاه", "مطب پزشک", "بیمارستان", "دندانپزشکی",
    "آزمایشگاه", "فیزیوتراپی / توانبخشی", "مراکز اهدای خون", "طب سنتی / جایگزین",
    "بینایی‌سنجی / اپتومتری", "مشاوره", "سایر مراکز درمانی",
]


def build_health_facilities(admin1: list[dict], fa_to_code: dict) -> dict:
    fc = load_json(os.path.join(GEO, "new_data", "iran-healthsites", "categorized", "all_enriched.geojson"))
    feats = fc.get("features", [])
    prov_total = {}
    prov_cat = {}
    matched = 0
    unmatched = 0
    # sample evenly across the full list
    sample_cap = 700
    step = max(1, len(feats) // sample_cap)
    samples = []
    for i, f in enumerate(feats):
        p = f.get("properties", {})
        g = f.get("geometry") or {}
        coords = g.get("coordinates")
        if g.get("type") != "Point" or not coords:
            continue
        lng, lat = coords[0], coords[1]
        prov = assign_province(admin1, lat, lng)
        if prov is None:
            unmatched += 1
            prov_code = "UNK"
        else:
            matched += 1
            prov_code = fa_to_code.get((prov["name_fa"] or "").strip(), prov["pcode"])
        cat = p.get("category_primary_fa") or "سایر مراکز درمانی"
        prov_total[prov_code] = prov_total.get(prov_code, 0) + 1
        prov_cat.setdefault(prov_code, {})
        pc = prov_cat[prov_code].setdefault("categories", {})
        pc[cat] = pc.get(cat, 0) + 1
        if i % step == 0:
            samples.append({
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "type": cat,
                "name": (p.get("name") or "").strip() or None,
            })
    return {
        "generatedAtUtc": now_utc(),
        "source": "Healthsites.io (HDX) — geojson/new_data/iran-healthsites/categorized/all_enriched.geojson (ODbL)",
        "totalFeatures": len(feats),
        "pointFeatures": matched + unmatched,
        "polygonFeatures": len(feats) - (matched + unmatched),
        "assignedToProvince": matched,
        "unassigned": unmatched,
        "categories": HEALTH_CATEGORY_ORDER,
        "byProvince": prov_total,
        "byProvinceCategory": prov_cat,
        "samplePoints": samples,
    }


# ---------------------------------------------------------------------------
# 3. Transport / education / financial / populated-places points
# ---------------------------------------------------------------------------
def _sample(feats, cap: int):
    step = max(1, len(feats) // cap)
    out = []
    for i, f in enumerate(feats):
        if i % step != 0:
            continue
        p = f.get("properties", {}) or {}
        g = f.get("geometry") or {}
        c = g.get("coordinates")
        if g.get("type") != "Point" or not c:
            continue
        name = (p.get("name") or "").strip() or None
        out.append({
            "lat": round(c[1], 5),
            "lng": round(c[0], 5),
            "name": name,
            "type": (p.get("aeroway") or p.get("amenity") or p.get("place") or p.get("port") or None),
        })
    return out


def build_transport_points(admin1: list[dict], fa_to_code: dict) -> dict:
    def load(path: str):
        return load_json(os.path.join(GEO, path)).get("features", [])

    airports = load(os.path.join("new_geo", "hotosm_irn_airports_points_geojson.geojson"))
    sea_ports = load(os.path.join("new_geo", "hotosm_irn_sea_ports_points_geojson.geojson"))
    education = load("hotosm_irn_education_facilities_points_shp.geojson")
    financial = load(os.path.join("new_geo", "hotosm_irn_financial_services_points_geojson.geojson"))
    populated = load(os.path.join("new_geo", "hotosm_irn_populated_places_points_geojson.geojson"))

    def per_province_counts(feats: list[dict]) -> dict:
        counts = {}
        for f in feats:
            g = f.get("geometry") or {}
            c = g.get("coordinates")
            if g.get("type") != "Point" or not c:
                continue
            prov = assign_province(admin1, c[1], c[0])
            if prov:
                counts[fa_to_code.get((prov["name_fa"] or "").strip(), prov["pcode"])] = counts.get(fa_to_code.get((prov["name_fa"] or "").strip(), prov["pcode"]), 0) + 1
        return counts

    return {
        "generatedAtUtc": now_utc(),
        "source": "HOT OSM exports (HDX/S3) — geojson/new_geo/*.geojson + top-level education file (ODbL)",
        "airports": {"total": len(airports), "points": _sample(airports, 585)},
        "seaPorts": {"total": len(sea_ports), "points": _sample(sea_ports, 60)},
        "education": {"total": len(education), "byProvince": per_province_counts(education), "points": _sample(education, 450)},
        "financial": {"total": len(financial), "byProvince": per_province_counts(financial), "points": _sample(financial, 450)},
        "populatedPlaces": {"total": len(populated), "points": _sample(populated, 350)},
    }


# ---------------------------------------------------------------------------
# 3.5 Building footprints per province (streaming over the 364 MB HOT file)
# ---------------------------------------------------------------------------
import re as _re

_BUILDING_RE = _re.compile(r'\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]')


def build_grid_lookup(admin1: list[dict], fa_to_code: dict, step: float = 0.05) -> dict:
    """سلول‌های ~۵ کیلومتری → کد استان؛ برای تخصیص O(1) صدهاهزار عارضه."""
    grid: dict[tuple, str] = {}
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


def build_building_stats(admin1: list[dict], fa_to_code: dict) -> dict:
    """One feature per line (pretty-printed, ~620k). Count buildings per province
    via centroid + grid lookup (~5km cells) — streamed, never fully loaded."""
    path = os.path.join(GEO, "new_geo", "hotosm_irn_buildings_polygons_geojson.geojson")
    grid = build_grid_lookup(admin1, fa_to_code)
    print(f"grid cells: {len(grid)}")
    counts: dict[str, int] = {}
    total = 0
    skipped = 0
    step = 0.05
    with open(path, encoding="utf-8") as f:
        for line in f:
            if '"type": "Feature"' not in line:
                continue
            total += 1
            pairs = _BUILDING_RE.findall(line)
            if len(pairs) < 3:
                skipped += 1
                continue
            lon = sum(float(x) for x, _ in pairs) / len(pairs)
            lat = sum(float(y) for _, y in pairs) / len(pairs)
            code = grid.get((round(lat / step) * step, round(lon / step) * step))
            if code is None:
                skipped += 1
                continue
            counts[code] = counts.get(code, 0) + 1
    return {
        "total": total,
        "assigned": sum(counts.values()),
        "skipped": skipped,
        "byProvince": counts,
        "note": "تخصیص با شبکهٔ ~۵کیلومتری (مرکزیت‌محور) — تقریب مرزی ±۵ کیلومتر",
    }


# ---------------------------------------------------------------------------
# 3.6 Infographic per-province dashboards (IranAtlas charts)
# ---------------------------------------------------------------------------
def _parse_num(v) -> float | None:
    if v is None:
        return None
    s = str(v).replace('%', '').replace(',', '').replace('،', '').strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _norm_name(s: str) -> str:
    """حذف فاصله‌ها برای تطبیق نام استان (مثلاً «بویراحمد» در برابر «بویر احمد»)."""
    return str(s).replace("استان ", "").replace(" ", "").strip()


def build_infographic_charts(fa_to_code: dict) -> dict:
    charts = load_json(os.path.join(GEO, "iran_extracted_charts.json"))
    norm_to_code = {_norm_name(k): v for k, v in fa_to_code.items()}
    by_province: dict[str, dict] = {}
    rankings: list[dict] = []
    for chart_key in sorted(charts.keys()):
        raw = charts[chart_key]
        data = (raw or {}).get("data")
        if not data or not data[0]:
            continue
        rows = data[0]
        if not isinstance(rows, list) or len(rows) < 2:
            continue
        header = rows[0]
        # ── per-province dashboard: ستون اول «منبع» است و نام استان در سرستون (index 5)
        if isinstance(header, list) and len(header) >= 7 and header[0] == 'منبع':
            province_name = header[5]
            code = norm_to_code.get(_norm_name(str(province_name))) if province_name else None
            if not code:
                continue
            indicators = []
            for r in rows[1:]:
                if not isinstance(r, list) or len(r) < 7 or r[0] == 'منبع':
                    continue
                indicators.append({
                    "label": str(r[6]).strip(),
                    "value": str(r[5]).strip() if r[5] is not None else '',
                    "unit": str(r[2]).strip() if r[2] is not None else '',
                    "year": str(r[1]).strip() if r[1] is not None else '',
                    "rank": r[3],
                    "national": str(r[4]).strip() if r[4] is not None else '',
                    "source": str(r[0]).strip(),
                })
            by_province[code] = {"nameFa": str(province_name).strip(), "indicators": indicators}
            continue
        # ── ranking tables: فقط جدول‌هایی که سرستون واقعی دارند (['استان', '<شاخص>'])
        if isinstance(header, list) and len(header) >= 2 and str(header[0]).strip() == 'استان':
            label = str(header[1]).strip() if len(header) > 1 else ''
            rows_out = []
            for r in rows[1:]:
                if not isinstance(r, list) or len(r) < 2:
                    continue
                v = r[1]
                if v in (None, ''):
                    continue
                rows_out.append([str(r[0]).replace('استان ', '').strip(), str(v).strip()])
            if label and rows_out:
                rankings.append({"label": label, "rows": rows_out})
    return {
        "generatedAtUtc": now_utc(),
        "source": "geojson/iran_extracted_charts.json (Infogram IranAtlas — داده‌های رسمی مرکز آمار/وزارت کشور)",
        "byProvince": by_province,
        "rankings": rankings,
    }


# ---------------------------------------------------------------------------
# 4. HeiGIT accessibility per province (hospitals + primary healthcare)
# ---------------------------------------------------------------------------
def build_hospital_access(admin1: list[dict], fa_to_code: dict) -> dict:
    def read_csv(path: str):
        import csv
        with open(path, encoding="utf-8-sig", errors="replace") as f:
            return list(csv.DictReader(f))

    en_to_code = {}
    for prov in admin1:
        code = fa_to_code.get((prov["name_fa"] or "").strip())
        if code:
            en_to_code[prov["name_en"].strip()] = code

    results = {"generatedAtUtc": now_utc(), "source": "HeiGIT/HDX accessibility indicators — geojson/new_data/heigit-*-access (travel time, minutes)", "nameToCode": en_to_code, "provinces": {}}
    for key, folder, fa_label in [
        ("hospitals", "heigit-hospitals-access", "بیمارستان"),
        ("primaryHealthcare", "heigit-primary-healthcare-access", "بهداشت اولیه"),
    ]:
        csv_path = os.path.join(GEO, "new_data", folder, "raw", "access_long.csv")
        if not os.path.exists(csv_path):
            continue
        rows = [r for r in read_csv(csv_path) if r.get("admin_level") == "ADM1" and r.get("population_type") == "total"]
        by_name = {}
        for r in rows:
            name = (r.get("name") or "").strip()
            by_name.setdefault(name, []).append(r)
        for name, rs in by_name.items():
            pop = max(int(x["population"] or 0) for x in rs)
            share_by_range = {}
            for x in rs:
                share_by_range[int(x["range"])] = max(share_by_range.get(int(x["range"]), 0), float(x["population_share"] or 0))
            small = min(share_by_range) if share_by_range else None
            med = sorted(share_by_range)[len(share_by_range) // 2] if share_by_range else None
            entry = results["provinces"].setdefault(name, {"nameEn": name, "code": en_to_code.get(name), "population": pop})
            entry[fa_label] = {
                "withinMin": small,
                "withinSharePct": round(share_by_range.get(small, 0), 1) if small else None,
                "medianRangeMin": med,
                "medianSharePct": round(share_by_range.get(med, 0), 1) if med else None,
            }
    return results


# ---------------------------------------------------------------------------
def main() -> None:
    # ── انتخاب مرحلهٔ بازسازی: `--only <نام فایل>` برای اجرای سریعِ یک خروجی
    #    (مرحلهٔ ساختمان‌ها ~۱۰ دقیقه طول می‌کشد؛ برای تکرار فقط عصارهٔ اینفوگراف را بازسازی کن)
    only = None
    if "--only" in sys.argv:
        i = sys.argv.index("--only")
        only = sys.argv[i + 1] if i + 1 < len(sys.argv) else None

    admin1 = build_admin1_index()
    print(f"admin1 provinces: {len(admin1)}")

    geo_stats, fa_to_code = build_province_geo_stats()
    building_stats = None
    if only is None:
        # افزودن تراکم ساختمانی به اطلس استانی
        building_stats = build_building_stats(admin1, fa_to_code)
        for code, cnt in building_stats["byProvince"].items():
            if code in geo_stats["provinces"]:
                geo_stats["provinces"][code]["buildings"] = cnt
        geo_stats["buildingsTotal"] = building_stats["total"]
        geo_stats["buildingsAssigned"] = building_stats["assigned"]
        print(f"buildings: {building_stats['total']} total, {building_stats['assigned']} assigned")
    datasets = {
        "province-geo-stats.json": geo_stats,
        "health-facilities.json": build_health_facilities(admin1, fa_to_code),
        "transport-points.json": build_transport_points(admin1, fa_to_code),
        "hospital-access.json": build_hospital_access(admin1, fa_to_code),
        "infographic-province.json": build_infographic_charts(fa_to_code),
    }
    if only:
        datasets = {only: datasets[only]} if only in datasets else {}
        if not datasets:
            print(f"unknown --only target: {only}; choose from {list(datasets.keys())}")
            return 1
    for name, data in datasets.items():
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        size_kb = os.path.getsize(path) / 1024
        print(f"  wrote {name} ({size_kb:.1f} KB)")
    print("done")


if __name__ == "__main__":
    sys.exit(main())
