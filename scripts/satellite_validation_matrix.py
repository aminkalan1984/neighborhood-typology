#!/usr/bin/env python3
"""Offline CI matrix for satellite QA, AOI coverage, and co-registration."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform_bounds


def robust_temporal_anomalies(values: list[float], threshold: float = 3.5, minimum_absolute_deviation: float = 0.05) -> list[int]:
    ordered = sorted(values)
    middle = len(ordered) // 2
    baseline = ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2
    deviations = sorted(abs(value - baseline) for value in values)
    middle = len(deviations) // 2
    mad = deviations[middle] if len(deviations) % 2 else (deviations[middle - 1] + deviations[middle]) / 2
    anomalies: list[int] = []
    for index, value in enumerate(values):
        difference = value - baseline
        robust_z = (0.67448975 * difference / mad) if mad > 1e-9 else (threshold + 1 if abs(difference) >= minimum_absolute_deviation else 0)
        if abs(robust_z) >= threshold:
            anomalies.append(index)
    return anomalies


class SatelliteValidationMatrixTest(unittest.TestCase):
    maxDiff = None

    def run_worker(self, root: Path, assets: list[dict], bbox: tuple[float, float, float, float], suffix: str) -> tuple[int, dict | None, str]:
        payload = {
            "job_id": f"matrix-{suffix}",
            "metadata_id": "matrix-item",
            "collection": "sentinel-2-l2a",
            "aoi": {"bbox": bbox},
            "assets": assets,
            "indices": ["ndvi"],
            "output_dir": str(root / f"output-{suffix}"),
        }
        input_path = root / f"worker-{suffix}.json"
        input_path.write_text(json.dumps(payload), encoding="utf-8")
        result = subprocess.run([sys.executable, str(Path(__file__).with_name("satellite_cog_worker.py")), "--input", str(input_path)], capture_output=True, text=True, check=False)
        return result.returncode, json.loads(result.stdout) if result.returncode == 0 else None, result.stderr

    @staticmethod
    def raster(path: Path, values: np.ndarray, *, transform, crs="EPSG:32639", nodata=-9999) -> None:
        with rasterio.open(path, "w", driver="GTiff", height=values.shape[0], width=values.shape[1], count=1, dtype="float32", crs=crs, transform=transform, nodata=nodata) as dataset:
            dataset.write(values.astype("float32"), 1)

    def test_qa_classes_are_counted_and_masked(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ara-satellite-qa-") as directory:
            root = Path(directory)
            transform = from_origin(500000, 4000000, 10, 10)
            red = np.full((128, 128), 0.2, dtype="float32")
            nir = np.full((128, 128), 0.6, dtype="float32")
            scl = np.full((128, 128), 4, dtype="float32")
            scl[:32, :] = 9
            scl[32:48, :] = 3
            for name, values in {"red": red, "nir": nir, "scl": scl}.items():
                self.raster(root / f"{name}.tif", values, transform=transform)
            bbox = transform_bounds("EPSG:32639", "EPSG:4326", 500000, 3998720, 501280, 4000000, densify_pts=21)
            assets = [{"logical_name": name, "asset_key": name, "href": str(root / f"{name}.tif")} for name in ("red", "nir", "scl")]
            code, output, stderr = self.run_worker(root, assets, bbox, "qa")
            self.assertEqual(code, 0, stderr)
            qa = output["validation"]["qa"]
            self.assertEqual(qa["invalid_class_counts"]["9"], 4096)
            self.assertEqual(qa["invalid_class_counts"]["3"], 2048)
            self.assertLess(qa["clear_pixels"], qa["valid_pixels"])

    def test_output_covers_requested_aoi(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ara-satellite-aoi-") as directory:
            root = Path(directory)
            transform = from_origin(500000, 4000000, 10, 10)
            values = np.full((128, 128), 0.4, dtype="float32")
            for name in ("red", "nir"):
                self.raster(root / f"{name}.tif", values, transform=transform)
            bbox = transform_bounds("EPSG:32639", "EPSG:4326", 500200, 3999000, 501000, 3999800, densify_pts=21)
            assets = [{"logical_name": name, "asset_key": name, "href": str(root / f"{name}.tif")} for name in ("red", "nir")]
            code, output, stderr = self.run_worker(root, assets, bbox, "aoi")
            self.assertEqual(code, 0, stderr)
            self.assertGreaterEqual(output["validation"]["aoi_coverage_fraction"], 0.99)

    def test_mixed_resolution_and_crs_are_co_registered(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ara-satellite-grid-") as directory:
            root = Path(directory)
            red_transform = from_origin(500000, 4000000, 10, 10)
            nir_transform = from_origin(500000, 4000000, 20, 20)
            self.raster(root / "red.tif", np.full((128, 128), 0.2), transform=red_transform)
            self.raster(root / "nir.tif", np.full((64, 64), 0.6), transform=nir_transform)
            bbox = transform_bounds("EPSG:32639", "EPSG:4326", 500100, 3999000, 501000, 3999900, densify_pts=21)
            assets = [{"logical_name": name, "asset_key": name, "href": str(root / f"{name}.tif")} for name in ("red", "nir")]
            code, output, stderr = self.run_worker(root, assets, bbox, "grid")
            self.assertEqual(code, 0, stderr)
            grids = output["validation"]["grids"]
            self.assertEqual(len({(grid["crs"], grid["width"], grid["height"], tuple(grid["transform"])) for grid in grids}), 1)
            self.assertIn("co-registration-valid", output["validation"]["checks"])

    def test_temporal_median_mad_flags_only_material_spikes(self) -> None:
        stable = [0.40, 0.40, 0.41, 0.39, 0.40, 0.40]
        spiked = [0.42, 0.43, 0.41, 0.44, 0.43, 0.05]
        self.assertEqual(robust_temporal_anomalies(stable), [])
        self.assertEqual(robust_temporal_anomalies(spiked), [5])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path)
    args, remaining = parser.parse_known_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SatelliteValidationMatrixTest)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = {
        "schema_version": 1,
        "matrix": ["qa-mask", "aoi-coverage", "co-registration", "temporal-anomaly"],
        "tests_run": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "successful": result.wasSuccessful(),
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
