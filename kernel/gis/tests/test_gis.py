"""GIS CONTRACT tests — STRUCTURAL fixtures ONLY (not neighborhood results)."""
import os, sys
_KROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _KROOT not in sys.path:
    sys.path.insert(0, _KROOT)

from shapely.geometry import Polygon, Point
from gis.boundary import BoundaryStore, BoundaryProvenanceMissing
from gis import spatial as S

PASS = []
def ok(name, cond):
    assert cond, f"FAIL {name}"
    PASS.append(name); print("PASS", name)

# (a) unknown CRS rejected -----------------------------------------------------
ok("a1 unknown crs rejected", S.validate_crs("EPSG:999999")["status"] == "FAIL")
ok("a2 missing crs rejected", S.validate_crs(None)["status"] == "FAIL")
ok("a3 wgs84 ok", S.validate_crs("EPSG:4326")["status"] == "PASS")

# (b) invalid polygon -> make_valid + logged transformation --------------------
bowtie = Polygon([(0, 0), (1, 1), (1, 0), (0, 1), (0, 0)])   # self-intersecting
ok("b1 bowtie invalid", not bowtie.is_valid)
topo = S.validate_topology(bowtie)
ok("b2 fixed valid", topo["status"] == "PASS" and topo["findings"]["now_valid"])
ok("b3 fix logged", any(s["op"] == "make_valid" for s in topo["transformation_steps"]))

# valid square in WGS84 (a plausible tiny neighborhood footprint, Tehran-ish lon/lat)
square = Polygon([(51.40, 35.70), (51.41, 35.70), (51.41, 35.71), (51.40, 35.71), (51.40, 35.70)])

# (c) boundary v2 does NOT delete v1 (append-only + audit) ---------------------
store = BoundaryStore()
v1 = store.add_version("nb-TEST", square, crs="EPSG:4326", tier="test-fixture",
                       is_official=False, is_proxy=True, provenance_ref="VAL-0001")
square2 = Polygon([(51.40, 35.70), (51.42, 35.70), (51.42, 35.72), (51.40, 35.72), (51.40, 35.70)])
v2 = store.add_version("nb-TEST", square2, crs="EPSG:4326", tier="official",
                       is_official=True, is_proxy=False, provenance_ref="VAL-0002")
versions = store.list_versions("nb-TEST")
ok("c1 two versions kept", [v.version_id for v in versions] == ["v1", "v2"])
ok("c2 v1 still retrievable", store.get_version("nb-TEST", "v1").geometry_hash == v1.geometry_hash)
ok("c3 v1 hash != v2 hash", v1.geometry_hash != v2.geometry_hash)
ok("c4 audit trail 2 entries", len(store.audit_trail) == 2)

# (d) add_version refuses geometry with no provenance --------------------------
refused = False
try:
    store.add_version("nb-TEST", square, crs="EPSG:4326", tier="x",
                      is_official=False, is_proxy=True, provenance_ref=None)
except BoundaryProvenanceMissing:
    refused = True
ok("d1 refuses no-provenance geometry", refused)

# (e) network distance with no network -> NO silent Euclidean ------------------
origin = Point(51.405, 35.705)
targets = [Point(51.408, 35.708), Point(51.402, 35.702)]
net = S.distance_to_nearest(origin, targets, method="network")
ok("e1 no silent fallback", net["status"] == "SOURCE_UNAVAILABLE" and net["value"] is None)
net_proxy = S.distance_to_nearest(origin, targets, method="network", allow_euclidean_proxy=True)
ok("e2 explicit euclidean proxy labeled", net_proxy["is_proxy"] is True and net_proxy["value"] is not None)
euc = S.distance_to_nearest(origin, targets, method="euclidean")
ok("e3 euclidean direct ok", euc["status"] == "OBSERVED" and euc["is_proxy"] is False)

# (f) metric-CRS selection deterministic ---------------------------------------
m1 = S.pick_metric_crs(square)
m2 = S.pick_metric_crs(square)
ok("f1 deterministic", m1["epsg"] == m2["epsg"])
ok("f2 iran utm zone", m1["utm_zone"] in (38, 39, 40, 41) and m1["epsg"].startswith("EPSG:326"))
# reproject round-trip keeps area positive and finite
metric = S.reproject(square, "EPSG:4326", m1["epsg"])
ok("f3 metric area positive", metric.area > 0)

# coverage: a small point-extent inside the boundary
inside_pt_extent = Point(51.405, 35.705).buffer(0.001)
cov = S.spatial_coverage_check(inside_pt_extent, square)
ok("f4 coverage computed", cov["coverage"] > 0)

print(f"\nGIS TESTS: {len(PASS)}/{len(PASS)} passed")
