"""Spatial validation + operations (constraints 7, 8, 10).

Key guarantees:
  * validate_crs rejects unknown CRS (no silent assumptions).
  * validate_topology fixes invalid geometry with make_valid and LOGS the fix as
    a transformation step (never a silent repair).
  * distance_to_nearest(method="network") NEVER silently falls back to Euclidean:
    without routable network data it returns a status and requires an explicit
    euclidean-proxy opt-in that stamps is_proxy=True + a caveat.
  * pick_metric_crs chooses the correct Iran UTM zone deterministically.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple

from pyproj import CRS, Transformer
from shapely.geometry.base import BaseGeometry
from shapely.geometry import Point
from shapely.ops import transform as shp_transform

try:
    from shapely import make_valid as _make_valid   # shapely >= 2.0
except Exception:                                    # pragma: no cover
    from shapely.validation import make_valid as _make_valid


# --- CRS -----------------------------------------------------------------------
def validate_crs(crs_str: Optional[str]) -> Dict[str, Any]:
    if not crs_str:
        return {"check": "validate_crs", "status": "FAIL", "blocking": True,
                "detail": "CRS missing", "crs": None}
    try:
        crs = CRS.from_user_input(crs_str)
    except Exception as e:
        return {"check": "validate_crs", "status": "FAIL", "blocking": True,
                "detail": f"unknown/invalid CRS {crs_str!r}: {e}", "crs": crs_str}
    return {"check": "validate_crs", "status": "PASS", "blocking": False,
            "detail": "CRS recognized", "crs": crs.to_string(),
            "epsg": crs.to_epsg(), "is_geographic": crs.is_geographic}


def pick_metric_crs(geom_wgs84: BaseGeometry) -> Dict[str, Any]:
    """Choose the Iran UTM zone (EPSG:326xx) by centroid longitude.
    Iran spans UTM zones 38N-41N -> EPSG:32638..32641."""
    c = geom_wgs84.centroid
    lon, lat = c.x, c.y
    zone = int((lon + 180) // 6) + 1            # standard UTM zone from longitude
    zone = max(38, min(41, zone))               # clamp to Iran's UTM zones
    epsg = 32600 + zone if lat >= 0 else 32700 + zone
    return {"epsg": f"EPSG:{epsg}", "utm_zone": zone, "centroid_lon": round(lon, 6),
            "centroid_lat": round(lat, 6),
            "detail": f"selected UTM {zone}N for centroid lon={lon:.4f}"}


def reproject(geom: BaseGeometry, src_crs: str, dst_crs: str) -> BaseGeometry:
    t = Transformer.from_crs(CRS.from_user_input(src_crs),
                             CRS.from_user_input(dst_crs), always_xy=True)
    return shp_transform(lambda x, y, z=None: t.transform(x, y), geom)


# --- topology ------------------------------------------------------------------
def validate_topology(geom: BaseGeometry) -> Dict[str, Any]:
    steps: List[Dict[str, Any]] = []
    valid = geom.is_valid
    fixed = geom
    if not valid:
        fixed = _make_valid(geom)
        steps.append({"op": "make_valid",
                      "detail": {"reason": "input geometry invalid",
                                 "before_valid": False, "after_valid": fixed.is_valid}})
    area = fixed.area
    checks = {
        "was_valid": valid,
        "now_valid": fixed.is_valid,
        "area_positive": area > 0,
        "empty": fixed.is_empty,
        "geom_type": fixed.geom_type,
    }
    status = "PASS" if (fixed.is_valid and area > 0 and not fixed.is_empty) else "FAIL"
    return {"check": "validate_topology", "status": status,
            "blocking": status == "FAIL", "detail": "topology validated",
            "findings": checks, "transformation_steps": steps, "geometry": fixed}


def spatial_coverage_check(data_extent: BaseGeometry, boundary: BaseGeometry) -> Dict[str, Any]:
    """Report the fraction of the data extent that lies inside the boundary."""
    if data_extent.is_empty or boundary.is_empty:
        return {"check": "spatial_coverage_check", "status": "FAIL", "blocking": True,
                "detail": "empty geometry", "coverage": 0.0}
    inter = data_extent.intersection(boundary)
    frac = (inter.area / data_extent.area) if data_extent.area > 0 else 0.0
    within = data_extent.within(boundary)
    return {"check": "spatial_coverage_check",
            "status": "PASS" if frac > 0 else "WARN", "blocking": False,
            "detail": f"{frac:.1%} of data extent inside boundary",
            "coverage": round(frac, 4), "fully_within": bool(within)}


# --- operations ----------------------------------------------------------------
def buffer(geom_metric: BaseGeometry, meters: float) -> BaseGeometry:
    return geom_metric.buffer(meters)


def spatial_join_within(points: List[BaseGeometry], boundary: BaseGeometry) -> List[int]:
    """Return indices of points that fall inside the boundary (same CRS assumed)."""
    return [i for i, p in enumerate(points) if boundary.contains(p) or boundary.touches(p)]


def distance_to_nearest(
    origin: BaseGeometry, targets: List[BaseGeometry], *, method: str,
    network=None, allow_euclidean_proxy: bool = False,
) -> Dict[str, Any]:
    """Distance (in the geometry's units) from origin to nearest target.

    method='euclidean' -> straight-line distance.
    method='network'   -> requires `network` (routable). If absent:
        - allow_euclidean_proxy=False (DEFAULT): returns status, NO number,
          NO silent Euclidean substitution (constraint 7).
        - allow_euclidean_proxy=True: computes Euclidean but stamps
          is_proxy=True + an explicit caveat.
    """
    if not targets:
        return {"status": "INSUFFICIENT_COVERAGE", "value": None,
                "method": method, "detail": "no target features"}
    if method == "euclidean":
        d = min(origin.distance(t) for t in targets)
        return {"status": "OBSERVED", "value": round(d, 4), "method": "euclidean",
                "is_proxy": False, "detail": "straight-line distance"}
    if method == "network":
        if network is not None:
            # A real routable network would be used here (osmnx/networkx). Not
            # available in this pilot slice -> handled by the branch below.
            raise NotImplementedError("network routing backend not wired in this build")
        if not allow_euclidean_proxy:
            return {"status": "SOURCE_UNAVAILABLE", "value": None, "method": "network",
                    "is_proxy": False,
                    "detail": ("network distance requested but no routable network "
                               "available; refusing silent Euclidean fallback "
                               "(constraint 7). Set allow_euclidean_proxy=True to "
                               "opt into a labeled Euclidean proxy.")}
        d = min(origin.distance(t) for t in targets)
        return {"status": "PROXY", "value": round(d, 4), "method": "euclidean_proxy_for_network",
                "is_proxy": True,
                "caveat": ("Euclidean straight-line used as an EXPLICIT proxy for "
                           "network distance; underestimates real travel distance."),
                "detail": "explicit euclidean-proxy opt-in"}
    return {"status": "INVALID", "value": None, "method": method,
            "detail": f"unknown distance method {method!r}"}
