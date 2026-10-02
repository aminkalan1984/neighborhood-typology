#!/usr/bin/env python3
"""Render one 256px Web Mercator PNG tile from a validated COG artifact."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import tempfile

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds


WEB_MERCATOR_HALF = 20037508.342789244
PALETTES: dict[str, tuple[np.ndarray, np.ndarray]] = {
    "ndvi": (
        np.array([0.0, 0.5, 0.75, 0.875, 1.0], dtype=np.float32),
        np.array([[180, 30, 45], [245, 158, 11], [250, 250, 210], [22, 163, 74], [5, 75, 45]], dtype=np.float32),
    ),
    "viridis": (
        np.array([0.0, 0.25, 0.5, 0.75, 1.0], dtype=np.float32),
        np.array([[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]], dtype=np.float32),
    ),
    "magma": (
        np.array([0.0, 0.25, 0.5, 0.75, 1.0], dtype=np.float32),
        np.array([[0, 0, 4], [81, 18, 124], [183, 55, 121], [252, 137, 97], [252, 253, 191]], dtype=np.float32),
    ),
    "gray": (
        np.array([0.0, 1.0], dtype=np.float32),
        np.array([[25, 25, 25], [245, 245, 245]], dtype=np.float32),
    ),
    "water": (
        np.array([0.0, 0.4, 0.6, 1.0], dtype=np.float32),
        np.array([[120, 72, 48], [241, 238, 220], [56, 153, 211], [5, 48, 97]], dtype=np.float32),
    ),
    "change": (
        np.array([0.0, 0.45, 0.5, 0.55, 1.0], dtype=np.float32),
        np.array([[127, 29, 29], [248, 184, 139], [245, 245, 245], [134, 239, 172], [6, 95, 70]], dtype=np.float32),
    ),
}


def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    n = 2**z
    size = 2 * WEB_MERCATOR_HALF / n
    return (
        -WEB_MERCATOR_HALF + x * size,
        WEB_MERCATOR_HALF - (y + 1) * size,
        -WEB_MERCATOR_HALF + (x + 1) * size,
        WEB_MERCATOR_HALF - y * size,
    )


def colorize(
    values: np.ndarray,
    valid: np.ndarray,
    minimum: float,
    maximum: float,
    palette: str,
) -> np.ndarray:
    """Apply a deterministic palette while preserving transparent nodata."""
    span = maximum - minimum
    scaled = np.clip((values - minimum) / span if span > 0 else np.zeros_like(values), 0.0, 1.0)
    positions, stops = PALETTES[palette]
    idx = np.clip(np.searchsorted(positions, scaled, side="right") - 1, 0, len(positions) - 2)
    left = positions[idx]
    right = positions[idx + 1]
    fraction = np.divide(scaled - left, right - left, out=np.zeros_like(scaled), where=(right - left) != 0)
    rgb = stops[idx] * (1 - fraction[..., None]) + stops[idx + 1] * fraction[..., None]
    rgba = np.concatenate([np.clip(rgb, 0, 255), np.where(valid, 235, 0)[..., None]], axis=2).astype("uint8")
    return rgba


def render_bounds(
    source_path: Path,
    output_path: Path,
    bounds_3857: tuple[float, float, float, float],
    width: int,
    height: int,
    minimum: float,
    maximum: float,
    palette: str,
) -> None:
    if palette not in PALETTES:
        raise ValueError(f"unsupported palette: {palette}")
    if width < 1 or height < 1 or width > 2048 or height > 2048:
        raise ValueError("render dimensions must be between 1 and 2048 pixels")
    with rasterio.open(source_path) as source:
        target_transform = from_bounds(*bounds_3857, width, height)
        with WarpedVRT(
            source,
            crs="EPSG:3857",
            transform=target_transform,
            width=width,
            height=height,
            resampling=Resampling.bilinear,
            nodata=source.nodata,
        ) as vrt:
            if source.count >= 3:
                data = vrt.read([1, 2, 3], masked=True)
            else:
                data = vrt.read(1, masked=True)
        if source.count >= 3:
            values = data.filled(0).astype("uint8")
            masks = np.ma.getmaskarray(data)
            valid = ~np.any(masks, axis=0)
            rgb = np.moveaxis(values, 0, 2)
            rgba = np.concatenate([rgb, np.where(valid, 255, 0)[..., None].astype("uint8")], axis=2)
        else:
            values = data.filled(np.nan).astype("float32")
            valid = ~np.ma.getmaskarray(data) & np.isfinite(values)
            rgba = colorize(values, valid, minimum, maximum, palette)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        profile = {
            "driver": "PNG",
            "width": width,
            "height": height,
            "count": 4,
            "dtype": "uint8",
            "photometric": "RGBA",
        }
        with tempfile.NamedTemporaryFile(suffix=".png", dir=output_path.parent, delete=False) as handle:
            temporary = Path(handle.name)
        try:
            with rasterio.open(temporary, "w", **profile) as target:
                target.write(np.moveaxis(rgba, 2, 0))
            os.replace(temporary, output_path)
        finally:
            temporary.unlink(missing_ok=True)


def render(
    source_path: Path,
    output_path: Path,
    z: int,
    x: int,
    y: int,
    minimum: float,
    maximum: float,
    palette: str,
) -> None:
    if z < 0 or z > 24 or x < 0 or y < 0 or x >= 2**z or y >= 2**z:
        raise ValueError("invalid tile coordinates")
    render_bounds(source_path, output_path, tile_bounds(z, x, y), 256, 256, minimum, maximum, palette)


def render_preview(
    source_path: Path,
    output_path: Path,
    bbox_wgs84: tuple[float, float, float, float],
    width: int,
    height: int,
    minimum: float,
    maximum: float,
    palette: str,
) -> None:
    west, south, east, north = bbox_wgs84
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("invalid WGS84 preview bbox")
    bounds_3857 = transform_bounds("EPSG:4326", "EPSG:3857", west, south, east, north, densify_pts=21)
    render_bounds(source_path, output_path, bounds_3857, width, height, minimum, maximum, palette)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--z", type=int)
    parser.add_argument("--x", type=int)
    parser.add_argument("--y", type=int)
    parser.add_argument("--bbox", nargs=4, type=float, metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    parser.add_argument("--width", type=int, default=768)
    parser.add_argument("--height", type=int, default=512)
    parser.add_argument("--minimum", type=float, default=-1.0)
    parser.add_argument("--maximum", type=float, default=1.0)
    parser.add_argument("--palette", choices=sorted(PALETTES), default="ndvi")
    args = parser.parse_args()
    tile_coordinates = (args.z, args.x, args.y)
    if args.bbox is not None:
        if any(value is not None for value in tile_coordinates):
            parser.error("use either --bbox or --z/--x/--y")
        render_preview(args.source.resolve(), args.output.resolve(), tuple(args.bbox), args.width, args.height, args.minimum, args.maximum, args.palette)
    elif all(value is not None for value in tile_coordinates):
        render(args.source.resolve(), args.output.resolve(), args.z, args.x, args.y, args.minimum, args.maximum, args.palette)
    else:
        parser.error("--bbox or all of --z/--x/--y are required")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
