"""CONTRACT tests for the Evidence Confidence Engine (engine/confidence.py).
Synthetic fixtures only; never presented as a neighborhood result."""
import os, sys
KROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, KROOT)
from engine.confidence import ConfidenceEngine, LEVEL_RANK

passed = 0; total = 0
def check(name, cond):
    global passed, total
    total += 1
    print(("PASS " if cond else "FAIL ") + name)
    if cond: passed += 1

ce = ConfidenceEngine()

# (a) single-stream proxy value -> capped at محدود (<= محدود)
a = ce.assess_value(has_number=True, source_category="public_osm", is_proxy=True,
                    evidence_streams=["gis"], value_scale="district", target_scale="neighborhood",
                    completeness=1.0, quality_score=0.857, age_days=0, expected_days=365)
check("(a) single-stream proxy level <= محدود", LEVEL_RANK[a["level"]] <= LEVEL_RANK["محدود"])
check("(a) ceiling is محدود for single-stream proxy", a["ceiling"] == "محدود")
check("(a) factor breakdown present for drill-down", set(a["factors"]) >= {
      "source_credibility", "spatial_granularity", "completeness", "quality_check",
      "recency", "stream_count", "proxy_penalty"})

# (b) multi-stream corroborated, non-proxy, tested -> strictly higher
b = ce.assess_value(has_number=True, source_category="official_registry", is_proxy=False,
                    evidence_streams=["objective", "gis", "behavioral"], value_scale="block",
                    target_scale="neighborhood", completeness=1.0, quality_score=0.95,
                    age_days=10, expected_days=365, n_streams_agree=3, tested=True)
check("(b) multi-stream tested non-proxy > single-stream proxy",
      LEVEL_RANK[b["level"]] > LEVEL_RANK[a["level"]])
check("(b) 3 corroborating streams can reach >= همگرا", LEVEL_RANK[b["level"]] >= LEVEL_RANK["همگرا"])

# (b2) two independent streams (not tested) can reach همگرا but not آزمون‌شده
b2 = ce.assess_value(has_number=True, source_category="official_gis_sdi", is_proxy=False,
                     evidence_streams=["objective", "gis"], value_scale="neighborhood",
                     target_scale="neighborhood", completeness=1.0, quality_score=0.9,
                     age_days=5, expected_days=365, n_streams_agree=2, tested=False)
check("(b2) untested cannot reach آزمون‌شده", b2["level"] != "آزمون‌شده")

# (c) stale timestamp lowers recency factor and composite
fresh = ce.assess_value(has_number=True, source_category="reproducible_api", is_proxy=False,
                        evidence_streams=["objective"], value_scale="neighborhood",
                        target_scale="neighborhood", completeness=1.0, quality_score=0.9,
                        age_days=10, expected_days=30)
stale = ce.assess_value(has_number=True, source_category="reproducible_api", is_proxy=False,
                        evidence_streams=["objective"], value_scale="neighborhood",
                        target_scale="neighborhood", completeness=1.0, quality_score=0.9,
                        age_days=3650, expected_days=30)
check("(c) stale recency factor < fresh recency factor",
      stale["factors"]["recency"]["score"] < fresh["factors"]["recency"]["score"])
check("(c) stale composite <= fresh composite", stale["score"] <= fresh["score"])

# (d) deterministic
d1 = ce.assess_value(has_number=True, source_category="public_osm", is_proxy=True,
                     evidence_streams=["gis"], value_scale="district", target_scale="neighborhood",
                     completeness=1.0, quality_score=0.857, age_days=0, expected_days=365)
d2 = ce.assess_value(has_number=True, source_category="public_osm", is_proxy=True,
                     evidence_streams=["gis"], value_scale="district", target_scale="neighborhood",
                     completeness=1.0, quality_score=0.857, age_days=0, expected_days=365)
check("(d) deterministic (identical inputs -> identical output)", d1 == d2)

# abstained value -> ناکافی
ab = ce.assess_value(has_number=False, source_category="public_osm", is_proxy=True,
                     evidence_streams=["gis"], completeness=0.0, quality_score=0.0)
check("abstained value (no number) -> ناکافی", ab["level"] == "ناکافی")

# aggregate abstained -> ناکافی ; aggregate bounded by weakest member
agg_ab = ce.assess_aggregate(published=False, member_confidences=[])
check("aggregate abstained -> ناکافی", agg_ab["level"] == "ناکافی")
agg_pub = ce.assess_aggregate(published=True, coverage=0.9, member_confidences=[
    {"level": "همگرا", "score": 0.8}, {"level": "محدود", "score": 0.4}])
check("published aggregate bounded by weakest member (محدود)", agg_pub["level"] == "محدود")

print(f"\nCONFIDENCE CONTRACT TESTS: {passed}/{total} passed")
sys.exit(0 if passed == total else 1)
