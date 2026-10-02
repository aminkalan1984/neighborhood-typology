#!/usr/bin/env python3
"""Deterministic analytics over validated satellite COG artifacts.

Supported operations:
- zonal: polygon/bbox statistics with valid-pixel accounting
- change: co-registered before/after difference COG and summary
- composite: median temporal composite COG
- segment: lightweight reproducible quantile segmentation baseline
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
from typing import Any

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.shutil import copy as rio_copy
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds


COG_MEDIA_TYPE = "image/tiff; application=geotiff; profile=cloud-optimized"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def overview_levels(width: int, height: int) -> list[int]:
    levels: list[int] = []
    factor = 2
    while min(width, height) / factor >= 128:
        levels.append(factor)
        factor *= 2
    return levels or ([2] if min(width, height) >= 2 else [])


def write_cog(path: Path, values: np.ndarray, valid: np.ndarray, profile: dict[str, Any], categorical: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    nodata = 255.0 if categorical else -9999.0
    dtype = "uint8" if categorical else "float32"
    array = np.where(valid, values, nodata).astype(dtype, copy=False)
    levels = overview_levels(array.shape[1], array.shape[0])
    with tempfile.NamedTemporaryFile(suffix=".tif", dir=path.parent, delete=False) as handle:
        intermediate = Path(handle.name)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        output_profile = {
            "driver": "GTiff",
            "height": array.shape[0],
            "width": array.shape[1],
            "count": 1,
            "dtype": dtype,
            "crs": profile["crs"],
            "transform": profile["transform"],
            "nodata": nodata,
            "tiled": True,
            "blockxsize": min(512, max(16, math.ceil(array.shape[1] / 16) * 16)),
            "blockysize": min(512, max(16, math.ceil(array.shape[0] / 16) * 16)),
            "compress": "deflate",
            **({} if categorical else {"predictor": 3}),
        }
        with rasterio.open(intermediate, "w", **output_profile) as target:
            target.write(array, 1)
            target.write_mask(valid.astype("uint8") * 255)
            if levels:
                target.build_overviews(levels, Resampling.nearest if categorical else Resampling.average)
        rio_copy(
            intermediate,
            temporary,
            driver="COG",
            BLOCKSIZE="512",
            COMPRESS="DEFLATE",
            OVERVIEWS="FORCE_USE_EXISTING" if levels else "NONE",
            RESAMPLING="NEAREST" if categorical else "AVERAGE",
        )
        os.replace(temporary, path)
    finally:
        intermediate.unlink(missing_ok=True)
        temporary.unlink(missing_ok=True)


def artifact(path: Path, kind: str, name: str) -> dict[str, Any]:
    with rasterio.open(path) as dataset:
        bounds = dataset.bounds
        wgs84 = transform_bounds(dataset.crs, "EPSG:4326", *bounds, densify_pts=21) if dataset.crs else bounds
        array = dataset.read(1, masked=True)
        valid_values = array.compressed()
        total = dataset.width * dataset.height
        return {
            "kind": kind,
            "name": name,
            "relative_path": path.name,
            "media_type": COG_MEDIA_TYPE,
            "is_cog": dataset.tags(ns="IMAGE_STRUCTURE").get("LAYOUT") == "COG" or (dataset.is_tiled and bool(dataset.overviews(1))),
            "checksum_sha256": sha256_file(path),
            "bytes": path.stat().st_size,
            "width": dataset.width,
            "height": dataset.height,
            "dtype": dataset.dtypes[0],
            "nodata": dataset.nodata,
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "bounds": list(wgs84),
            "native_bounds": [bounds.left, bounds.bottom, bounds.right, bounds.top],
            "overviews": dataset.overviews(1),
            "valid_pixel_count": int(valid_values.size),
            "total_pixel_count": int(total),
            "valid_fraction": round(valid_values.size / total, 6) if total else 0.0,
            **(
                {
                    "statistics": {
                        "min": float(valid_values.min()),
                        "max": float(valid_values.max()),
                        "mean": float(valid_values.mean()),
                    }
                }
                if valid_values.size
                else {}
            ),
        }


def mask_for_aoi(dataset: rasterio.io.DatasetReader, aoi: dict[str, Any] | None) -> np.ndarray:
    if not aoi:
        return np.ones((dataset.height, dataset.width), dtype=bool)
    geometry = aoi.get("geometry")
    if geometry:
        shapes = [geometry.get("geometry", geometry)] if isinstance(geometry, dict) else []
        if shapes:
            return geometry_mask(shapes, out_shape=(dataset.height, dataset.width), transform=dataset.transform, invert=True)
    bbox = aoi.get("bbox")
    if isinstance(bbox, list) and len(bbox) == 4:
        native = transform_bounds("EPSG:4326", dataset.crs, *bbox, densify_pts=21) if dataset.crs else tuple(bbox)
        transform = from_bounds(*native, dataset.width, dataset.height)
        # A full-raster mask using the target bbox; geometry_mask handles clipping.
        polygon = {
            "type": "Polygon",
            "coordinates": [[
                [native[0], native[1]], [native[2], native[1]], [native[2], native[3]],
                [native[0], native[3]], [native[0], native[1]],
            ]],
        }
        return geometry_mask([polygon], out_shape=(dataset.height, dataset.width), transform=dataset.transform, invert=True)
    return np.ones((dataset.height, dataset.width), dtype=bool)


def summary(values: np.ndarray, valid: np.ndarray) -> dict[str, Any]:
    selected = values[valid & np.isfinite(values)]
    total = int(values.size)
    count = int(selected.size)
    if count == 0:
        return {"count": 0, "total_pixels": total, "valid_fraction": 0.0}
    return {
        "count": count,
        "total_pixels": total,
        "valid_fraction": round(count / total, 6) if total else 0.0,
        "min": float(selected.min()),
        "max": float(selected.max()),
        "mean": float(selected.mean()),
        "std": float(selected.std()),
        "median": float(np.median(selected)),
        "p10": float(np.percentile(selected, 10)),
        "p25": float(np.percentile(selected, 25)),
        "p75": float(np.percentile(selected, 75)),
        "p90": float(np.percentile(selected, 90)),
    }


def zonal(payload: dict[str, Any]) -> dict[str, Any]:
    source = Path(payload["source"]).resolve()
    with rasterio.open(source) as dataset:
        array = dataset.read(1, masked=True)
        values = array.filled(np.nan).astype("float32")
        valid = ~np.ma.getmaskarray(array) & np.isfinite(values) & mask_for_aoi(dataset, payload.get("aoi"))
        return {"operation": "zonal", "source": str(source), "statistics": summary(values, valid)}


def read_on_grid(source_path: Path, reference: rasterio.io.DatasetReader) -> tuple[np.ndarray, np.ndarray]:
    with rasterio.open(source_path) as source:
        with WarpedVRT(
            source,
            crs=reference.crs,
            transform=reference.transform,
            width=reference.width,
            height=reference.height,
            resampling=Resampling.bilinear,
            nodata=source.nodata,
        ) as vrt:
            array = vrt.read(1, masked=True)
    values = array.filled(np.nan).astype("float32")
    return values, ~np.ma.getmaskarray(array) & np.isfinite(values)


def change(payload: dict[str, Any]) -> dict[str, Any]:
    before_path = Path(payload["before"]).resolve()
    after_path = Path(payload["after"]).resolve()
    output = Path(payload["output"]).resolve()
    threshold = abs(float(payload.get("threshold", 0.1)))
    with rasterio.open(after_path) as reference:
        after_array = reference.read(1, masked=True)
        after = after_array.filled(np.nan).astype("float32")
        after_valid = ~np.ma.getmaskarray(after_array) & np.isfinite(after)
        before, before_valid = read_on_grid(before_path, reference)
        valid = before_valid & after_valid & mask_for_aoi(reference, payload.get("aoi"))
        difference = np.where(valid, after - before, np.nan).astype("float32")
        write_cog(output, difference, valid, {"crs": reference.crs, "transform": reference.transform})
    stats = summary(difference, valid)
    selected = difference[valid]
    stats.update({
        "increase_fraction": round(float(np.count_nonzero(selected >= threshold)) / selected.size, 6) if selected.size else 0.0,
        "decrease_fraction": round(float(np.count_nonzero(selected <= -threshold)) / selected.size, 6) if selected.size else 0.0,
        "stable_fraction": round(float(np.count_nonzero(np.abs(selected) < threshold)) / selected.size, 6) if selected.size else 0.0,
        "threshold": threshold,
    })
    return {"operation": "change", "statistics": stats, "artifact": artifact(output, "index", payload.get("name", "change"))}


def composite(payload: dict[str, Any]) -> dict[str, Any]:
    sources = [Path(value).resolve() for value in payload["sources"]]
    if len(sources) < 2:
        raise ValueError("composite requires at least two COG sources")
    output = Path(payload["output"]).resolve()
    with rasterio.open(sources[0]) as reference:
        arrays: list[np.ndarray] = []
        for source in sources:
            values, valid = read_on_grid(source, reference)
            arrays.append(np.where(valid, values, np.nan))
        stack = np.stack(arrays)
        with np.errstate(all="ignore"):
            result = np.nanmedian(stack, axis=0).astype("float32")
        valid = np.isfinite(result) & mask_for_aoi(reference, payload.get("aoi"))
        write_cog(output, result, valid, {"crs": reference.crs, "transform": reference.transform})
    return {"operation": "composite", "observations": len(sources), "artifact": artifact(output, "index", payload.get("name", "temporal-composite"))}


def segment(payload: dict[str, Any]) -> dict[str, Any]:
    source = Path(payload["source"]).resolve()
    output = Path(payload["output"]).resolve()
    classes = max(2, min(8, int(payload.get("classes", 4))))
    with rasterio.open(source) as dataset:
        array = dataset.read(1, masked=True)
        values = array.filled(np.nan).astype("float32")
        valid = ~np.ma.getmaskarray(array) & np.isfinite(values) & mask_for_aoi(dataset, payload.get("aoi"))
        selected = values[valid]
        if selected.size < classes:
            raise ValueError("not enough valid pixels for segmentation")
        thresholds = np.unique(np.quantile(selected, np.linspace(0, 1, classes + 1)[1:-1]))
        labels = np.digitize(values, thresholds, right=False).astype("uint8") + 1
        write_cog(output, labels, valid, {"crs": dataset.crs, "transform": dataset.transform}, categorical=True)
    counts = {str(index): int(np.count_nonzero(labels[valid] == index)) for index in range(1, len(thresholds) + 2)}
    return {
        "operation": "segment",
        "model": "deterministic-quantile-baseline-v1",
        "thresholds": [float(value) for value in thresholds],
        "class_counts": counts,
        "artifact": artifact(output, "classification", payload.get("name", "segmentation")),
    }


def process(payload: dict[str, Any]) -> dict[str, Any]:
    operation = payload.get("operation")
    if operation == "zonal":
        return zonal(payload)
    if operation == "change":
        return change(payload)
    if operation == "composite":
        return composite(payload)
    if operation == "segment":
        return segment(payload)
    raise ValueError(f"unsupported operation: {operation}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        print(json.dumps(process(payload), ensure_ascii=True))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"Satellite analysis failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
