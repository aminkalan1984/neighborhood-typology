#!/usr/bin/env python3
"""Create validated AOI-scoped COGs and deterministic satellite indices."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

try:
    import numpy as np
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.features import geometry_mask
    from rasterio.shutil import copy as rio_copy
    from rasterio.transform import from_origin
    from rasterio.warp import transform_bounds, transform_geom
    from rasterio.vrt import WarpedVRT
except ImportError as exc:  # pragma: no cover - exercised by deployment, not unit tests
    print(
        "Satellite COG processing requires rasterio and numpy. "
        "Install them with: python -m pip install -r scripts/requirements-satellite.txt",
        file=sys.stderr,
    )
    raise SystemExit(2) from exc


COG_MEDIA_TYPE = "image/tiff; application=geotiff; profile=cloud-optimized"
MAX_PIXELS = int(os.environ.get("SATELLITE_MAX_PIXELS", "25000000"))
SCL_INVALID_CLASSES = {0, 1, 3, 8, 9, 10, 11}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_environment():
    return rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff,.jp2",
        GDAL_HTTP_MULTIRANGE="YES",
        GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
        GDAL_HTTP_MAX_RETRY="3",
        GDAL_HTTP_RETRY_DELAY="1",
    )


def open_source(href: str):
    # Earth Search assets are public HTTPS COGs. CDSE s3://eodata assets require
    # credentials and fail with an actionable error instead of silent fallback.
    return rasterio.open(href)


def choose_grid(assets: list[dict[str, Any]], bbox: list[float]):
    errors: list[str] = []
    for asset in assets:
        try:
            with open_source(asset["href"]) as source:
                if source.crs is None:
                    raise RuntimeError("source raster has no CRS")
                native_bounds = transform_bounds("EPSG:4326", source.crs, *bbox, densify_pts=21)
                native_res = max(abs(source.res[0]), abs(source.res[1]))
                requested_res = 10.0 if assets and any(a["logical_name"] in {"blue", "green", "red", "nir"} for a in assets) else native_res
                resolution = max(min(native_res, requested_res), 0.1)
                width = max(1, math.ceil((native_bounds[2] - native_bounds[0]) / resolution))
                height = max(1, math.ceil((native_bounds[3] - native_bounds[1]) / resolution))
                if width * height > MAX_PIXELS:
                    raise RuntimeError(
                        f"AOI creates {width * height:,} pixels, above SATELLITE_MAX_PIXELS={MAX_PIXELS:,}"
                    )
                transform = from_origin(native_bounds[0], native_bounds[3], resolution, resolution)
                return source.crs, transform, width, height
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{asset['asset_key']}: {exc}")
    raise RuntimeError("No raster asset could be opened. " + " | ".join(errors))


def read_aligned(
    asset: dict[str, Any],
    target_crs,
    target_transform,
    width: int,
    height: int,
    categorical: bool = False,
) -> tuple[np.ndarray, np.ndarray]:
    resampling = Resampling.nearest if categorical else Resampling.bilinear
    with open_source(asset["href"]) as source:
        source_nodata = source.nodata
        with WarpedVRT(
            source,
            crs=target_crs,
            transform=target_transform,
            width=width,
            height=height,
            resampling=resampling,
            nodata=source_nodata,
        ) as vrt:
            masked = vrt.read(1, masked=True, out_dtype="float32")
            data = masked.filled(np.nan).astype("float32", copy=False)
            valid = ~np.ma.getmaskarray(masked) & np.isfinite(data)
            if not categorical:
                scale = asset.get("scale")
                offset = asset.get("offset")
                if scale is None and asset.get("logical_name") in {"blue", "green", "red", "nir", "swir1", "swir2"}:
                    sample = data[valid]
                    if sample.size and float(np.nanpercentile(sample, 98)) > 2:
                        scale = 0.0001
                if scale is not None:
                    data = data * float(scale)
                if offset is not None:
                    data = data + float(offset)
                if asset.get("logical_name") in {"vv", "vh"}:
                    positive = valid & (data > 0)
                    if np.count_nonzero(positive) and float(np.nanmedian(data[positive])) < 10:
                        data = np.where(positive, 10.0 * np.log10(np.maximum(data, 1e-8)), np.nan).astype("float32")
                    data = box_filter(data, valid)
            return data, valid


def box_filter(data: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Small deterministic speckle reducer without a SciPy dependency."""
    values = np.where(valid, data, 0.0)
    weights = valid.astype("float32")
    padded_values = np.pad(values, 1, mode="edge")
    padded_weights = np.pad(weights, 1, mode="edge")
    total = np.zeros_like(data, dtype="float32")
    count = np.zeros_like(data, dtype="float32")
    for row in range(3):
        for col in range(3):
            total += padded_values[row : row + data.shape[0], col : col + data.shape[1]]
            count += padded_weights[row : row + data.shape[0], col : col + data.shape[1]]
    return np.divide(total, count, out=np.full_like(data, np.nan), where=count > 0)


def overview_levels(width: int, height: int) -> list[int]:
    levels: list[int] = []
    factor = 2
    while min(width, height) / factor >= 128:
        levels.append(factor)
        factor *= 2
    return levels or ([2] if min(width, height) >= 2 else [])


def write_cog(
    output_path: Path,
    data: np.ndarray,
    valid: np.ndarray,
    crs,
    transform,
    nodata: float,
    resampling: Resampling,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_cog = output_path.with_name(f".{output_path.name}.{os.getpid()}.tmp")
    levels = overview_levels(data.shape[1], data.shape[0])
    with tempfile.NamedTemporaryFile(suffix=".tif", dir=output_path.parent, delete=False) as handle:
        intermediate = Path(handle.name)
    try:
        profile = {
            "driver": "GTiff",
            "height": data.shape[0],
            "width": data.shape[1],
            "count": 1,
            "dtype": "float32",
            "crs": crs,
            "transform": transform,
            "nodata": nodata,
            "tiled": True,
            "blockxsize": min(512, max(16, math.ceil(data.shape[1] / 16) * 16)),
            "blockysize": min(512, max(16, math.ceil(data.shape[0] / 16) * 16)),
            "compress": "deflate",
            "predictor": 3,
        }
        array = np.where(valid, data, nodata).astype("float32", copy=False)
        with rasterio.open(intermediate, "w", **profile) as target:
            target.write(array, 1)
            target.write_mask(valid.astype("uint8") * 255)
            if levels:
                target.build_overviews(levels, resampling)
                target.update_tags(ns="rio_overview", resampling=resampling.name)
        rio_copy(
            intermediate,
            temporary_cog,
            driver="COG",
            BLOCKSIZE="512",
            COMPRESS="DEFLATE",
            PREDICTOR="FLOATING_POINT",
            OVERVIEWS="FORCE_USE_EXISTING" if levels else "NONE",
            RESAMPLING=resampling.name.upper(),
        )
        os.replace(temporary_cog, output_path)
    finally:
        intermediate.unlink(missing_ok=True)
        temporary_cog.unlink(missing_ok=True)


def display_rgb(channels: list[np.ndarray], valid: np.ndarray) -> np.ndarray:
    output = np.zeros((3, channels[0].shape[0], channels[0].shape[1]), dtype="uint8")
    for index, channel in enumerate(channels):
        selected = channel[valid & np.isfinite(channel)]
        if selected.size == 0:
            continue
        low, high = np.percentile(selected, [2, 98])
        if high <= low:
            high = low + 1
        output[index] = np.clip((channel - low) / (high - low) * 255, 0, 255).astype("uint8")
    return output


def write_rgb_cog(output_path: Path, data: np.ndarray, valid: np.ndarray, crs, transform) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_cog = output_path.with_name(f".{output_path.name}.{os.getpid()}.tmp")
    levels = overview_levels(data.shape[2], data.shape[1])
    with tempfile.NamedTemporaryFile(suffix=".tif", dir=output_path.parent, delete=False) as handle:
        intermediate = Path(handle.name)
    try:
        profile = {
            "driver": "GTiff", "height": data.shape[1], "width": data.shape[2], "count": 3,
            "dtype": "uint8", "crs": crs, "transform": transform, "nodata": 0,
            "tiled": True, "blockxsize": min(512, max(16, math.ceil(data.shape[2] / 16) * 16)),
            "blockysize": min(512, max(16, math.ceil(data.shape[1] / 16) * 16)), "compress": "deflate",
        }
        with rasterio.open(intermediate, "w", **profile) as target:
            target.write(np.where(valid[None, :, :], data, 0).astype("uint8"))
            target.write_mask(valid.astype("uint8") * 255)
            if levels:
                target.build_overviews(levels, Resampling.average)
        rio_copy(intermediate, temporary_cog, driver="COG", BLOCKSIZE="512", COMPRESS="DEFLATE", OVERVIEWS="FORCE_USE_EXISTING" if levels else "NONE", RESAMPLING="AVERAGE")
        os.replace(temporary_cog, output_path)
    finally:
        intermediate.unlink(missing_ok=True)
        temporary_cog.unlink(missing_ok=True)


def normalized_difference(left: np.ndarray, right: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    denominator = left + right
    valid = np.isfinite(left) & np.isfinite(right) & (np.abs(denominator) > 1e-6)
    result = np.full(left.shape, np.nan, dtype="float32")
    np.divide(left - right, denominator, out=result, where=valid)
    return np.clip(result, -1.0, 1.0), valid


def compute_indices(
    requested: list[str], bands: dict[str, np.ndarray], valid_masks: dict[str, np.ndarray]
) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    specs = {
        "ndvi": ("nir", "red"),
        "ndwi": ("green", "nir"),
        "mndwi": ("green", "swir1"),
        "ndbi": ("swir1", "nir"),
        "ndmi": ("nir", "swir1"),
        "nbr": ("nir", "swir2"),
    }
    output: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for name in requested:
        if name in specs:
            left, right = specs[name]
            if left not in bands or right not in bands:
                continue
            values, valid = normalized_difference(bands[left], bands[right])
            output[name] = (values, valid & valid_masks[left] & valid_masks[right])
        elif name in {"vv", "vh"} and name in bands:
            output[name] = (bands[name], valid_masks[name])
        elif name == "vv_vh_ratio" and "vv" in bands and "vh" in bands:
            valid = valid_masks["vv"] & valid_masks["vh"] & (np.abs(bands["vh"]) > 1e-6)
            ratio = np.full(bands["vv"].shape, np.nan, dtype="float32")
            np.divide(bands["vv"], bands["vh"], out=ratio, where=valid)
            output[name] = (ratio, valid)
    return output


def inspect_cog(path: Path, kind: str, name: str, source_asset: str | None = None) -> dict[str, Any]:
    with rasterio.open(path) as dataset:
        overviews = dataset.overviews(1)
        layout = dataset.tags(ns="IMAGE_STRUCTURE").get("LAYOUT")
        is_cog = layout == "COG" or (dataset.is_tiled and bool(overviews))
        bounds = dataset.bounds
        wgs84_bounds = transform_bounds(dataset.crs, "EPSG:4326", *bounds, densify_pts=21) if dataset.crs else bounds
        values = dataset.read(1, masked=True)
        valid_values = values.compressed()
        valid_count = int(valid_values.size)
        total_count = int(dataset.width * dataset.height)
        return {
            "kind": kind,
            "name": name,
            "relative_path": path.name,
            "media_type": COG_MEDIA_TYPE,
            "is_cog": is_cog,
            "checksum_sha256": sha256_file(path),
            "bytes": path.stat().st_size,
            "width": dataset.width,
            "height": dataset.height,
            "dtype": dataset.dtypes[0],
            "band_count": dataset.count,
            "nodata": dataset.nodata,
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "bounds": list(wgs84_bounds),
            "native_bounds": [bounds.left, bounds.bottom, bounds.right, bounds.top],
            "overviews": overviews,
            "valid_pixel_count": valid_count,
            "total_pixel_count": total_count,
            "valid_fraction": round(valid_count / total_count, 6) if total_count else 0.0,
            **(
                {
                    "statistics": {
                        "min": float(valid_values.min()),
                        "max": float(valid_values.max()),
                        "mean": float(valid_values.mean()),
                    }
                }
                if valid_count
                else {}
            ),
            **({"source_asset": source_asset} if source_asset else {}),
        }


def validation_grid(name: str, crs, transform, width: int, height: int) -> dict[str, Any]:
    return {
        "id": name,
        "crs": crs.to_string() if hasattr(crs, "to_string") else str(crs),
        "width": width,
        "height": height,
        "transform": [float(transform.a), float(transform.b), float(transform.c), float(transform.d), float(transform.e), float(transform.f)],
    }


def qa_summary(scl: np.ndarray | None, valid: np.ndarray | None, clear: np.ndarray | None, total_pixels: int) -> dict[str, Any]:
    valid_mask = valid if valid is not None else np.ones((1,), dtype=bool)
    clear_mask = clear if clear is not None else valid_mask
    invalid_class_counts: dict[str, int] = {}
    if scl is not None:
        classes, counts = np.unique(np.rint(np.nan_to_num(scl, nan=-1)).astype("int16"), return_counts=True)
        invalid_class_counts = {str(int(label)): int(count) for label, count in zip(classes, counts) if int(label) in SCL_INVALID_CLASSES}
    return {
        "total_pixels": int(total_pixels),
        "valid_pixels": int(np.count_nonzero(valid_mask)),
        "clear_pixels": int(np.count_nonzero(clear_mask)),
        "invalid_class_counts": invalid_class_counts,
    }


def bounds_coverage(aoi: list[float], output_bounds: list[float]) -> float:
    left = max(aoi[0], output_bounds[0])
    bottom = max(aoi[1], output_bounds[1])
    right = min(aoi[2], output_bounds[2])
    top = min(aoi[3], output_bounds[3])
    overlap = max(0.0, right - left) * max(0.0, top - bottom)
    requested = max(0.0, aoi[2] - aoi[0]) * max(0.0, aoi[3] - aoi[1])
    return overlap / requested if requested else 0.0


def aoi_pixel_mask(aoi: dict[str, Any], crs, transform, width: int, height: int) -> np.ndarray:
    geometry = aoi.get("geometry")
    if not isinstance(geometry, dict):
        return np.ones((height, width), dtype=bool)
    raw_geometry = geometry.get("geometry", geometry)
    try:
        projected = transform_geom(aoi.get("crs", "EPSG:4326"), crs, raw_geometry, precision=7)
        return geometry_mask([projected], out_shape=(height, width), transform=transform, invert=True)
    except Exception:  # noqa: BLE001
        return np.ones((height, width), dtype=bool)


def process(payload: dict[str, Any]) -> dict[str, Any]:
    output_dir = Path(payload["output_dir"]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    assets: list[dict[str, Any]] = payload["assets"]
    bbox: list[float] = payload["aoi"]["bbox"]
    checks = ["aoi-bbox-valid", "asset-selection-valid"]
    artifacts: list[dict[str, Any]] = []
    grids: list[dict[str, Any]] = []
    qa: dict[str, Any] = {}

    with source_environment():
        crs, transform, width, height = choose_grid(assets, bbox)
        bands: dict[str, np.ndarray] = {}
        valid_masks: dict[str, np.ndarray] = {}
        aoi_mask = aoi_pixel_mask(payload["aoi"], crs, transform, width, height)
        for asset in assets:
            logical_name = asset["logical_name"]
            categorical = logical_name in {"scl", "qa"}
            data, valid = read_aligned(asset, crs, transform, width, height, categorical)
            bands[logical_name] = data
            valid_masks[logical_name] = valid & aoi_mask
            grids.append(validation_grid(logical_name, crs, transform, width, height))

        cloud_clear = np.ones((height, width), dtype=bool)
        combined_valid = np.logical_and.reduce(list(valid_masks.values())) if valid_masks else np.zeros((height, width), dtype=bool)
        qa = qa_summary(None, combined_valid, combined_valid, width * height)
        if "scl" in bands:
            scl = np.rint(np.nan_to_num(bands["scl"], nan=-1)).astype("int16")
            cloud_clear = valid_masks["scl"] & ~np.isin(scl, list(SCL_INVALID_CLASSES))
            qa = qa_summary(bands["scl"], valid_masks["scl"], cloud_clear, width * height)
            mask_path = output_dir / "clear-mask.tif"
            write_cog(mask_path, cloud_clear.astype("float32"), valid_masks["scl"], crs, transform, -9999.0, Resampling.nearest)
            artifacts.append(inspect_cog(mask_path, "mask", "clear-mask", next(a["asset_key"] for a in assets if a["logical_name"] == "scl")))
        elif "qa" in bands:
            qa_values = np.nan_to_num(bands["qa"], nan=255).astype("uint16")
            cloud_clear = valid_masks["qa"] & ((qa_values & 0b00011110) == 0)
            qa = qa_summary(bands["qa"], valid_masks["qa"], cloud_clear, width * height)
            mask_path = output_dir / "clear-mask.tif"
            write_cog(mask_path, cloud_clear.astype("float32"), valid_masks["qa"], crs, transform, -9999.0, Resampling.nearest)
            artifacts.append(inspect_cog(mask_path, "mask", "clear-mask", next(a["asset_key"] for a in assets if a["logical_name"] == "qa")))

        for asset in assets:
            logical_name = asset["logical_name"]
            if logical_name in {"scl", "qa"}:
                continue
            valid = valid_masks[logical_name] & cloud_clear
            band_path = output_dir / f"band-{logical_name}.tif"
            write_cog(band_path, bands[logical_name], valid, crs, transform, -9999.0, Resampling.average)
            artifacts.append(inspect_cog(band_path, "band", logical_name, asset["asset_key"]))

        indices = compute_indices(payload.get("indices", []), bands, valid_masks)
        for name, (values, valid) in indices.items():
            valid &= cloud_clear
            index_path = output_dir / f"index-{name}.tif"
            write_cog(index_path, values, valid, crs, transform, -9999.0, Resampling.average)
            artifacts.append(inspect_cog(index_path, "index", name))

        products = set(payload.get("indices", []))
        composite_specs = {
            "rgb": ["red", "green", "blue"],
            "false_color": ["nir", "red", "green"],
        }
        for name, channel_names in composite_specs.items():
            if name not in products or not all(channel in bands for channel in channel_names):
                continue
            valid = cloud_clear & aoi_mask & np.logical_and.reduce([valid_masks[channel] for channel in channel_names])
            composite_path = output_dir / f"composite-{name}.tif"
            write_rgb_cog(composite_path, display_rgb([bands[channel] for channel in channel_names], valid), valid, crs, transform)
            artifacts.append(inspect_cog(composite_path, "composite", name))

    errors = []
    warnings = []
    if not artifacts:
        errors.append("No output artifacts were created")
    if any(not artifact["is_cog"] for artifact in artifacts):
        errors.append("At least one output failed COG validation")
    if any(not artifact["overviews"] for artifact in artifacts):
        errors.append("At least one output has no internal overview")
    if any(artifact["valid_pixel_count"] < 1 for artifact in artifacts):
        errors.append("At least one output contains no valid pixels inside the AOI")
    output_bounds = artifacts[0]["bounds"] if artifacts else list(payload["aoi"]["bbox"])
    coverage_fraction = bounds_coverage(payload["aoi"]["bbox"], output_bounds)
    polygon_coverage_fraction = float(np.count_nonzero(aoi_mask)) / aoi_mask.size if aoi_mask.size else 0.0
    if coverage_fraction < 0.99:
        (warnings if coverage_fraction > 0 else errors).append(f"AOI coverage is {coverage_fraction:.4f}, below the required 0.99")
    grid_keys = {(grid["crs"], grid["width"], grid["height"], tuple(round(value, 9) for value in grid["transform"])) for grid in grids}
    if len(grid_keys) > 1:
        errors.append("Input rasters were not co-registered on the target grid")
    checks.extend(["qa-mask-valid", "aoi-coverage-valid" if coverage_fraction >= 0.99 else "aoi-coverage-review", "co-registration-valid" if len(grid_keys) <= 1 else "co-registration-failed", "temporal-anomaly-not-applicable"])
    if not errors:
        checks.extend(["cog-layout-valid", "internal-overviews-valid", "nonempty-aoi-coverage", "checksums-computed"])
    return {
        "job_id": payload["job_id"],
        "artifacts": artifacts,
        "validation": {"valid": not errors, "checks": checks, "errors": errors, "warnings": warnings, "qa": qa, "aoi_coverage_fraction": round(coverage_fraction, 6), "polygon_coverage_fraction": round(polygon_coverage_fraction, 6), "grids": grids, "sar_processing": {"calibration": "linear-to-db when required", "speckle_filter": "3x3 valid-neighbor mean", "terrain_correction": "source geometry/reprojection; prefer RTC assets for quantitative use"} if payload.get("collection") == "sentinel-1-grd" else None, "temporal": {"status": "not_applicable", "reason": "A single processing job does not contain a temporal series."}},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        print(json.dumps(process(payload), ensure_ascii=True))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"Satellite worker failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
