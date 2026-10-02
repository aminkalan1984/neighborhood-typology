"""
Evidence Confidence Engine — MVP-2 (engine/confidence.py).

Produces a DOCUMENTED, DETERMINISTIC, factor-decomposable confidence for every value and
every aggregate — never random, never arbitrary (constraint: confidence is traceable).

Factors (each in [0,1], each contribution stored for drill-down):
  source_credibility  — tier in the algo.txt §5 source-of-truth hierarchy
  spatial_granularity — how well the value's spatial scale matches the analysis unit
  completeness        — observed / expected coverage of the input
  quality_check       — QC score / validity from ingestion
  recency             — freshness vs the indicator's expected update cadence
  stream_count        — number of INDEPENDENT evidence streams supporting the value
  proxy_penalty       — 1.0 if a direct measurement, lower if an explicit proxy

Level ladder (exact Persian UI labels): ناکافی < محدود < قابل اتکا < همگرا < آزمون‌شده.
Hard rules:
  * a value with no number (abstained / completeness 0) => ناکافی
  * a SINGLE-stream PROXY value can NEVER exceed محدود (constraint 7)
  * همگرا requires >=2 independent corroborating streams
  * آزمون‌شده requires an experimentally tested / calibrated flag
Evidence streams (objective / spatial-GIS / behavioral / perceptual) are kept SEPARATE
(constraint 6): stream_count counts DISTINCT streams; perceptual never substitutes objective.
"""

LEVELS = ["ناکافی", "محدود", "قابل اتکا", "همگرا", "آزمون‌شده"]
LEVEL_RANK = {name: i for i, name in enumerate(LEVELS)}

# source-of-truth hierarchy tiers (algo.txt §5) — higher = more credible
SOURCE_TIERS = {
    "official_registry": 1.00,          # داده رسمی و معتبر سازمانی
    "official_gis_sdi": 0.92,           # داده GIS رسمی دارای متادیتا
    "scientific_remote_sensing": 0.85,  # داده علمی/سنجش‌ازدور معتبر
    "reproducible_api": 0.78,           # API معتبر و بازتولیدپذیر
    "user_validated": 0.70,             # داده پروژه واردشده و اعتبارسنجی‌شده
    "validated_survey": 0.62,           # پیمایش معتبر
    "field_observation": 0.55,          # مشاهده میدانی دارای شناسنامه
    "auxiliary_proxy": 0.40,            # داده کمکی/پروکسی برچسب‌دار
    "public_osm": 0.35,                 # منابع عمومی مانند OSM (پایین‌ترین حد قابل‌قبول)
}

# spatial-scale rank: finer (smaller) = higher rank number
SCALE_RANK = {"point": 5, "block": 4, "sub_neighborhood": 3, "neighborhood": 2,
              "district": 1, "city": 0, "region": -1, "unknown": 0}

# documented factor weights (sum = 1.0)
FACTOR_WEIGHTS = {
    "source_credibility": 0.25, "spatial_granularity": 0.20, "completeness": 0.15,
    "quality_check": 0.15, "recency": 0.10, "stream_count": 0.10, "proxy_penalty": 0.05,
}


def _granularity_score(value_scale, target_scale):
    v = SCALE_RANK.get(value_scale, 0); t = SCALE_RANK.get(target_scale, 2)
    if v >= t:
        return 1.0, f"scale «{value_scale}» matches/finer than target «{target_scale}»"
    gap = t - v
    score = max(0.0, 1.0 - 0.35 * gap)
    return score, f"scale «{value_scale}» is {gap} level(s) coarser than target «{target_scale}»"


def _recency_score(age_days, expected_days):
    if age_days is None or expected_days is None:
        return 0.5, "no timestamp/expectation → neutral recency"
    if age_days <= expected_days:
        return 1.0, f"age {age_days}d within expected cadence {expected_days}d"
    ratio = expected_days / max(age_days, 1)
    return round(max(0.1, ratio), 4), f"age {age_days}d exceeds expected {expected_days}d"


def _stream_score(n_streams):
    if n_streams <= 0:
        return 0.0, "no evidence stream"
    if n_streams == 1:
        return 0.4, "single evidence stream"
    if n_streams == 2:
        return 0.75, "two independent evidence streams"
    return 1.0, f"{n_streams} independent evidence streams"


class ConfidenceEngine:
    def __init__(self, weights=None, tiers=None):
        self.w = dict(weights or FACTOR_WEIGHTS)
        self.tiers = dict(tiers or SOURCE_TIERS)

    def assess_value(self, *, has_number, source_category, is_proxy, evidence_streams,
                     value_scale="unknown", target_scale="neighborhood", completeness=None,
                     quality_score=None, age_days=None, expected_days=None,
                     n_streams_agree=None, tested=False):
        """Return {level, score, factors:{name:{score,weight,contribution,explain}}, ceiling, reason}."""
        streams = sorted(set(s for s in (evidence_streams or []) if s))
        n_streams = len(streams)
        if n_streams_agree is None:
            n_streams_agree = n_streams

        cred = self.tiers.get(source_category, 0.30)
        gran, gran_ex = _granularity_score(value_scale, target_scale)
        comp = float(completeness) if completeness is not None else 0.5
        qc = float(quality_score) if quality_score is not None else 0.5
        rec, rec_ex = _recency_score(age_days, expected_days)
        stre, stre_ex = _stream_score(n_streams)
        proxy = 1.0 if not is_proxy else 0.3

        raw = {
            "source_credibility": (cred, f"tier «{source_category}» = {cred}"),
            "spatial_granularity": (gran, gran_ex),
            "completeness": (comp, f"completeness={comp}"),
            "quality_check": (qc, f"QC score={qc}"),
            "recency": (rec, rec_ex),
            "stream_count": (stre, stre_ex),
            "proxy_penalty": (proxy, "direct measurement" if not is_proxy else "explicit proxy → penalised"),
        }
        factors = {}
        composite = 0.0
        for k, (sc, ex) in raw.items():
            w = self.w.get(k, 0.0)
            contrib = round(sc * w, 4)
            composite += contrib
            factors[k] = {"score": round(sc, 4), "weight": w, "contribution": contrib, "explain": ex}
        composite = round(composite, 4)

        # base level from composite
        if composite < 0.25:
            base = "ناکافی"
        elif composite < 0.50:
            base = "محدود"
        elif composite < 0.70:
            base = "قابل اتکا"
        elif composite < 0.85:
            base = "همگرا"
        else:
            base = "آزمون‌شده"

        # ceiling rules
        reasons = []
        ceiling = "آزمون‌شده"
        if not has_number:
            ceiling = "ناکافی"; reasons.append("no published number → ناکافی")
        else:
            if not tested and LEVEL_RANK["همگرا"] < LEVEL_RANK[ceiling]:
                pass
            if not tested:
                ceiling = "همگرا"; reasons.append("not experimentally tested/calibrated → cannot reach آزمون‌شده")
            if n_streams_agree < 2 and LEVEL_RANK[ceiling] > LEVEL_RANK["قابل اتکا"]:
                ceiling = "قابل اتکا"; reasons.append("single/uncorroborated stream → cannot reach همگرا")
            if is_proxy and n_streams < 2:
                ceiling = "محدود"; reasons.append("single-stream PROXY → capped at محدود (constraint 7)")

        level = base if LEVEL_RANK[base] <= LEVEL_RANK[ceiling] else ceiling
        return {"level": level, "score": composite, "factors": factors, "ceiling": ceiling,
                "base_level": base, "n_streams": n_streams, "streams": streams,
                "is_proxy": bool(is_proxy), "reason": "؛ ".join(reasons) or "composite within ceiling"}

    def assess_aggregate(self, *, published, member_confidences, coverage=None):
        """Confidence of an aggregate = bounded by its members and its coverage.
        Abstained aggregate (no number) => ناکافی. Otherwise the aggregate can be no more
        confident than the weakest contributing member and is further limited by coverage."""
        if not published:
            return {"level": "ناکافی", "score": 0.0, "reason": "aggregate abstained (no number published)",
                    "n_members": len(member_confidences or [])}
        if not member_confidences:
            return {"level": "ناکافی", "score": 0.0, "reason": "no contributing member confidences",
                    "n_members": 0}
        ranks = [LEVEL_RANK[c["level"]] for c in member_confidences]
        weakest = min(ranks)
        mean_score = round(sum(c["score"] for c in member_confidences) / len(member_confidences), 4)
        level = LEVELS[weakest]
        reason = "aggregate bounded by weakest member"
        if coverage is not None and coverage < 0.75 and LEVEL_RANK[level] > LEVEL_RANK["محدود"]:
            level = "محدود"; reason = f"coverage {coverage:.0%} < 75% → capped at محدود"
        return {"level": level, "score": mean_score, "reason": reason,
                "n_members": len(member_confidences), "weakest_member_level": LEVELS[weakest]}
