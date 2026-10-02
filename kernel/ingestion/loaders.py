"""File loaders: turn a real file's bytes into a list of row dicts.

Supports CSV, JSON (array or object), GeoJSON (FeatureCollection -> one row per
feature with its properties + geometry). No data is invented; empty cells stay
empty (None), never zero.
"""
from __future__ import annotations
import csv, json, io
from typing import Any, Dict, List, Tuple

from .ingest import detect_format


def _coerce_scalar(s: Any) -> Any:
    if s is None:
        return None
    if not isinstance(s, str):
        return s
    t = s.strip()
    if t == "":
        return None
    for caster in (int, float):
        try:
            return caster(t)
        except ValueError:
            continue
    return s


def load_records(path: str, raw_bytes: bytes) -> Tuple[str, List[Dict[str, Any]]]:
    """Return (format, rows). rows are plain dicts of the source columns/props."""
    fmt = detect_format(path, raw_bytes)
    if fmt == "CSV":
        text = raw_bytes.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        rows = [{k: _coerce_scalar(v) for k, v in r.items()} for r in reader]
        return fmt, rows
    if fmt == "JSON":
        data = json.loads(raw_bytes.decode("utf-8"))
        if isinstance(data, list):
            return fmt, [dict(x) for x in data]
        if isinstance(data, dict):
            # object with a records array, else single-row
            for key in ("records", "data", "rows", "items"):
                if isinstance(data.get(key), list):
                    return fmt, [dict(x) for x in data[key]]
            return fmt, [data]
        raise ValueError("unsupported JSON top-level type")
    if fmt == "GEOJSON":
        data = json.loads(raw_bytes.decode("utf-8"))
        feats = data.get("features", []) if isinstance(data, dict) else []
        rows = []
        for i, ft in enumerate(feats):
            props = dict(ft.get("properties") or {})
            props["_geometry"] = ft.get("geometry")
            props["_feature_index"] = i
            rows.append(props)
        return fmt, rows
    # GEOPACKAGE / PARQUET are read via geopandas/pyarrow in the GIS layer
    raise ValueError(f"loaders.load_records does not handle {fmt} directly; use gis/geo readers")
