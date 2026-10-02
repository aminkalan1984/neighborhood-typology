#!/usr/bin/env python3
"""Build a compact, reproducible catalog for Portals/ and geojson/.

The raw folders contain many gigabytes of source data.  This command records
every source file, and indexes the already-produced province summaries and
categorized GeoJSON layers without copying raw data into the application.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORTALS = ROOT / "Portals"
GEO = ROOT / "geojson"
OUT = ROOT / "public" / "data" / "typology"


def fingerprint(path: Path, size: int, mtime_ns: int) -> str:
    value = f"{path.as_posix()}|{size}|{mtime_ns}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def theme(path: Path) -> str:
    text = path.as_posix().lower()
    terms = {
        "education": ("education", "school", "دانش", "آموزش"),
        "health": ("health", "hospital", "clinic", "درمان", "بهداشت"),
        "transport": ("transport", "bus", "rail", "road", "airport", "حمل", "راه"),
        "green": ("park", "green", "forest", "vegetation", "ndvi", "سبز", "پارک"),
        "water": ("water", "river", "waterway", "wastewater", "آب"),
        "buildings": ("building", "housing", "sakht", "مسکن", "ساختمان"),
        "population": ("population", "census", "household", "جمعیت", "سرشماری", "خانوار"),
        "employment": ("lfs", "labor", "employment", "نیروی کار", "اشتغال"),
        "environment": ("environment", "air", "climate", "hazard", "محیط", "هوا", "مخاطر"),
        "administrative": ("admin", "province", "county", "division", "تقسیمات", "استان"),
    }
    for label, values in terms.items():
        if any(value in text for value in values):
            return label
    return "other"


def source_entry(path: Path, root_name: str) -> dict:
    stat = path.stat()
    extension = path.suffix.lower().lstrip(".") or "none"
    return {
        "path": rel(path),
        "root": root_name,
        "extension": extension,
        "bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
        "fingerprint": fingerprint(path, stat.st_size, stat.st_mtime_ns),
        "fingerprint_kind": "path-size-mtime",
        "theme": theme(path),
    }


def read_json(path: Path):
    try:
        with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
            return json.load(handle)
    except (OSError, ValueError, UnicodeError):
        return None


def geojson_meta(path: Path) -> dict:
    value = read_json(path)
    result = {"path": rel(path), "feature_count": None, "geometry_types": [], "property_keys": []}
    if not isinstance(value, dict):
        return result
    features = value.get("features")
    if not isinstance(features, list):
        return result
    result["feature_count"] = len(features)
    types = Counter()
    keys = set()
    for feature in features[:5000]:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") or {}
        if isinstance(geometry, dict) and geometry.get("type"):
            types[str(geometry["type"])] += 1
        properties = feature.get("properties") or {}
        if isinstance(properties, dict):
            keys.update(str(key) for key in properties)
    result["geometry_types"] = sorted(types)
    result["property_keys"] = sorted(keys)[:250]
    return result


def province_index() -> list[dict]:
    base = GEO / "new_data" / "iran-provinces" / "provinces"
    rows = []
    if not base.exists():
        return rows
    for directory in sorted(p for p in base.iterdir() if p.is_dir()):
        match = re.match(r"(IR-\d+)_([^/]+)$", directory.name)
        if not match:
            continue
        entry = {"id": match.group(1), "name": match.group(2), "directory": rel(directory), "files": {}}
        for path in sorted(directory.rglob("*")):
            if not path.is_file():
                continue
            key = path.name
            if path.suffix.lower() in {".json", ".csv", ".geojson"} and (
                path.name in {"statistics.json", "socioeconomic_statistics.json", "environmental_statistics.json", "infrastructure_statistics.json"}
                or "satellite_statistics" in path.name
                or "categorized" in path.as_posix()
            ):
                item = {"path": rel(path), "bytes": path.stat().st_size, "fingerprint": fingerprint(path, path.stat().st_size, path.stat().st_mtime_ns)}
                if path.suffix.lower() == ".geojson":
                    item.update(geojson_meta(path))
                else:
                    item["kind"] = "summary"
                entry["files"].setdefault(key, []).append(item)
        rows.append(entry)
    return rows


def registry_links(files: list[dict]) -> dict:
    path = ROOT / "neighborhood_typology" / "indicator_registry_419.csv"
    links = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            text = " ".join(row.get(key, "") for key in ("indicator", "calc_family", "template", "source_requirements")).lower()
            tags = []
            for tag, terms in {
                "education": ("مدرسه", "آموزش", "تحصیل", "education", "school"),
                "health": ("سلامت", "بهداشت", "درمان", "بیمارستان", "health"),
                "transport": ("اتوبوس", "حمل", "ترافیک", "راه", "transport", "bus"),
                "green": ("پارک", "سبز", "فضای باز", "green", "park", "vegetation"),
                "water": ("آب", "فاضلاب", "آبگرفتگی", "water", "wastewater"),
                "buildings": ("ساختمان", "مسکن", "کالبد", "building", "housing"),
                "population": ("جمعیت", "خانوار", "سالمند", "کودک", "population", "household"),
                "employment": ("اشتغال", "بیکاری", "نیروی کار", "employment", "labor"),
                "environment": ("هوا", "آلودگی", "اقلیم", "مخاطره", "environment", "air"),
            }.items():
                if any(term.lower() in text for term in terms):
                    tags.append(tag)
            links[row["code"]] = {
                "source_tags": sorted(set(tags)),
                "direct_local_candidate": row.get("calc_family") in {"network_access", "spatial_statistic", "per_capita_or_density"},
                "registry_formula_version": f"{row['code']}@1.0",
            }
    by_tag = defaultdict(list)
    for item in files:
        by_tag[item["theme"]].append(item["path"])
    local_groups = {"education", "health", "transport", "water", "buildings", "utilities", "industrial"}
    for code, link in links.items():
        candidates = []
        for tag in link["source_tags"]:
            candidates.extend(by_tag.get(tag, []))
        link["candidate_paths"] = sorted(set(candidates))[:24]
        if link["direct_local_candidate"] and any(tag in local_groups for tag in link["source_tags"]):
            link["availability"] = "direct_local_or_boundary_extract"
        elif any(tag in {"population", "environment", "employment", "administrative"} for tag in link["source_tags"]):
            link["availability"] = "province_or_auxiliary_proxy"
        elif link["source_tags"]:
            link["availability"] = "candidate_source_requires_formula_owner"
        else:
            link["availability"] = "no_automatic_local_match"
    return links


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = []
    for root, name in ((PORTALS, "Portals"), (GEO, "geojson")):
        for path in root.rglob("*"):
            if path.is_file():
                files.append(source_entry(path, name))
    extension_counts = Counter(item["extension"] for item in files)
    theme_counts = Counter(item["theme"] for item in files)
    catalog = {
        "schema_version": "typology-data-catalog.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "roots": {"Portals": rel(PORTALS), "geojson": rel(GEO)},
        "file_count": len(files),
        "total_bytes": sum(item["bytes"] for item in files),
        "extension_counts": dict(sorted(extension_counts.items())),
        "theme_counts": dict(sorted(theme_counts.items())),
        "files": files,
        "province_index": province_index(),
        "indicator_links": registry_links(files),
    }
    with (OUT / "source_catalog.json").open("w", encoding="utf-8") as handle:
        json.dump(catalog, handle, ensure_ascii=False, indent=2)
    print(json.dumps({"file_count": len(files), "total_bytes": catalog["total_bytes"], "provinces": len(catalog["province_index"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
