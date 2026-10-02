#!/usr/bin/env python3
"""End-to-end validation for the Rasterio COG worker using synthetic rasters."""

from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform_bounds


class SatelliteCogWorkerTest(unittest.TestCase):
    def test_creates_nonempty_cogs_and_masks_clouds(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ara-cog-worker-") as directory:
            root = Path(directory)
            transform = from_origin(500000, 4000000, 10, 10)
            arrays = {
                "blue": np.full((256, 256), 0.1, dtype="float32"),
                "green": np.full((256, 256), 0.2, dtype="float32"),
                "red": np.full((256, 256), 0.2, dtype="float32"),
                "nir": np.full((256, 256), 0.6, dtype="float32"),
                "swir1": np.full((256, 256), 0.25, dtype="float32"),
                "swir2": np.full((256, 256), 0.15, dtype="float32"),
                "scl": np.full((256, 256), 4, dtype="float32"),
            }
            arrays["scl"][:64, :] = 9
            for name, values in arrays.items():
                with rasterio.open(
                    root / f"{name}.tif",
                    "w",
                    driver="GTiff",
                    height=256,
                    width=256,
                    count=1,
                    dtype="float32",
                    crs="EPSG:32639",
                    transform=transform,
                    nodata=-9999,
                ) as dataset:
                    dataset.write(values, 1)

            native_bounds = (500000, 3997440, 502560, 4000000)
            bbox = transform_bounds("EPSG:32639", "EPSG:4326", *native_bounds, densify_pts=21)
            assets = [
                {"logical_name": name, "asset_key": name, "href": str(root / f"{name}.tif")}
                for name in arrays
            ]
            payload = {
                "job_id": "synthetic-validation",
                "metadata_id": "synthetic-item",
                "collection": "sentinel-2-l2a",
                "aoi": {"bbox": bbox},
                "assets": assets,
                "indices": ["ndvi", "ndwi", "mndwi", "ndbi", "ndmi", "nbr"],
                "output_dir": str(root / "output"),
            }
            input_path = root / "worker-input.json"
            input_path.write_text(json.dumps(payload), encoding="utf-8")
            worker = Path(__file__).with_name("satellite_cog_worker.py")
            result = subprocess.run(
                [sys.executable, str(worker), "--input", str(input_path)],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            output = json.loads(result.stdout)
            self.assertTrue(output["validation"]["valid"], output["validation"])
            self.assertIn("qa-mask-valid", output["validation"]["checks"])
            self.assertIn("co-registration-valid", output["validation"]["checks"])
            self.assertIn("aoi-coverage-valid", output["validation"]["checks"])
            self.assertGreater(output["validation"]["qa"]["clear_pixels"], 0)
            self.assertGreater(output["validation"]["aoi_coverage_fraction"], 0.99)
            self.assertEqual(len({tuple(grid["transform"]) for grid in output["validation"]["grids"]}), 1)
            ndvi = next(artifact for artifact in output["artifacts"] if artifact["name"] == "ndvi")
            self.assertTrue(ndvi["is_cog"])
            self.assertGreater(ndvi["valid_pixel_count"], 0)
            self.assertGreater(ndvi["valid_fraction"], 0.65)
            self.assertLess(ndvi["valid_fraction"], 0.85)
            self.assertAlmostEqual(ndvi["statistics"]["mean"], 0.5, places=4)
            with rasterio.open(root / "output" / "index-ndvi.tif") as dataset:
                self.assertEqual(dataset.tags(ns="IMAGE_STRUCTURE").get("LAYOUT"), "COG")
                self.assertTrue(dataset.overviews(1))

            center_lon = (bbox[0] + bbox[2]) / 2
            center_lat = (bbox[1] + bbox[3]) / 2
            zoom = 14
            tile_x = int((center_lon + 180) / 360 * (2**zoom))
            latitude_rad = math.radians(center_lat)
            tile_y = int((1 - math.asinh(math.tan(latitude_rad)) / math.pi) / 2 * (2**zoom))
            tile_path = root / "ndvi-tile.png"
            renderer = Path(__file__).with_name("satellite_tile_renderer.py")
            tile_result = subprocess.run(
                [
                    sys.executable,
                    str(renderer),
                    "--source",
                    str(root / "output" / "index-ndvi.tif"),
                    "--output",
                    str(tile_path),
                    "--z",
                    str(zoom),
                    "--x",
                    str(tile_x),
                    "--y",
                    str(tile_y),
                    "--minimum",
                    "-1",
                    "--maximum",
                    "1",
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(tile_result.returncode, 0, tile_result.stderr)
            with rasterio.open(tile_path) as tile:
                self.assertEqual((tile.width, tile.height, tile.count), (256, 256, 4))
                rgba = tile.read()
                self.assertGreater(np.count_nonzero(rgba[3]), 0)
                self.assertGreater(np.count_nonzero(rgba[:3]), 0)

            viridis_path = root / "ndvi-tile-viridis.png"
            viridis_result = subprocess.run(
                [
                    sys.executable,
                    str(renderer),
                    "--source",
                    str(root / "output" / "index-ndvi.tif"),
                    "--output",
                    str(viridis_path),
                    "--z",
                    str(zoom),
                    "--x",
                    str(tile_x),
                    "--y",
                    str(tile_y),
                    "--minimum",
                    "-1",
                    "--maximum",
                    "1",
                    "--palette",
                    "viridis",
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(viridis_result.returncode, 0, viridis_result.stderr)
            with rasterio.open(viridis_path) as viridis_tile:
                viridis_rgba = viridis_tile.read()
                self.assertEqual(viridis_rgba.shape, rgba.shape)
                self.assertTrue(np.array_equal(viridis_rgba[3], rgba[3]))
                self.assertGreater(np.count_nonzero(viridis_rgba[:3] != rgba[:3]), 0)


if __name__ == "__main__":
    unittest.main()
