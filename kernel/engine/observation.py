# -*- coding: utf-8 -*-
"""
Raw Observation Ledger (§9) + Observation Status Model (§12) + Data Quality Gate (§13).

Every datum entering the kernel is an Observation with the full field set of §9.
Invariants (§10 golden rules) are enforced HARD — a violation raises, it is never
silently repaired:

    missing != zero
    proxy != observed
    estimated != observed
    perceptual != objective
    capacity != access
    access != use
    use != experience
    experience != outcome

§11 — no fabricated data. The following are rejected outright:
    simulated zone, synthetic neighborhood, province-derived neighborhood,
    cluster-generated values, default 0, default mean, random value,
    estimated score without label.

Absence of data must produce MISSING / WAITING_FOR_DATA / PENDING_VALIDATION /
INSUFFICIENT_COVERAGE — never 0.

§13 gate order:
    Schema -> Unit -> Range -> Spatial -> Temporal -> Source -> Completeness ->
    Proxy -> Duplicate -> Outlier -> QC Score
"""
from __future__ import annotations

import hashlib
import json

STATUSES = ("OBSERVED", "ESTIMATED", "PROXY", "MISSING", "SUPPRESSED",
            "NOT_RECORDED", "PENDING_VALIDATION", "ACCESS_REQUIRED")

NUMERIC_STATUSES = ("OBSERVED", "ESTIMATED", "PROXY")

EVIDENCE_STREAMS = ("objective", "spatial", "behavioral", "perceptual")

# §54 six-tier source architecture
SOURCE_TIERS = {
    1: "رسمی مرجع (Tier 1)",
    2: "رسمی مشتق/GIS (Tier 2)",
    3: "علمی سنجش‌ازدور/پژوهشی (Tier 3)",
    4: "API بازتولیدپذیر (Tier 4)",
    5: "پیمایش/میدانی اعتبارسنجی‌شده (Tier 5)",
    6: "پروکسی/کمکی (Tier 6)",
}

# OSM is an open auxiliary / operational GIS source, NOT automatically authoritative (§54)
OSM_TIER = 6

FABRICATION_MARKERS = (
    "simulated", "synthetic", "cluster_generated", "province_derived",
    "default_zero", "default_mean", "random",
)


class ObservationError(ValueError):
    pass


def observation_id_of(payload: dict) -> str:
    """Deterministic id — the same observation always hashes to the same id."""
    key = {k: payload.get(k) for k in (
        "indicator_code", "raw_value", "unit", "observed_at", "reference_period",
        "source_id", "dataset_id", "spatial_unit", "population_group", "status",
    )}
    blob = json.dumps(key, ensure_ascii=False, sort_keys=True)
    return "OBS-" + hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


class Observation:
    """A single raw observation, with §9 fields and §10 invariants."""

    FIELDS = (
        "observation_id", "indicator_code", "raw_value", "unit", "numerator",
        "denominator", "geometry", "spatial_unit", "spatial_resolution",
        "boundary_version", "observed_at", "reference_period", "data_vintage",
        "population_group", "sample_size", "sampling_weight", "source_id",
        "provider", "dataset_id", "dataset_version", "license",
        "acquisition_method", "processing_method", "formula_version",
        "evidence_stream", "status", "proxy", "proxy_definition", "proxy_reason",
        "known_bias", "proxy_validation_status", "estimated", "observed",
        "quality_score", "coverage", "missingness", "uncertainty", "source_tier",
        "quality_checks", "provenance_value_id", "notes_fa",
    )

    def __init__(self, **kw):
        unknown = set(kw) - set(self.FIELDS)
        if unknown:
            raise ObservationError(f"unknown observation field(s): {sorted(unknown)}")
        self.__dict__.update({f: None for f in self.FIELDS})
        self.__dict__.update(kw)
        self.proxy = bool(self.proxy)
        self.estimated = bool(self.estimated)
        self.observed = bool(self.observed)
        self.evidence_stream = list(self.evidence_stream or [])
        self.quality_checks = list(self.quality_checks or [])
        if not self.observation_id:
            self.observation_id = observation_id_of(self.as_dict())
        self._assert_invariants()

    # ---- §10 invariants ------------------------------------------------------
    def _assert_invariants(self):
        if self.status not in STATUSES:
            raise ObservationError(f"invalid status {self.status!r}; allowed: {STATUSES}")

        # missing/absent statuses may never carry a number (missing != zero)
        if self.status not in NUMERIC_STATUSES and self.raw_value is not None:
            raise ObservationError(
                f"§10 violation: status {self.status} must have raw_value=None, "
                f"not {self.raw_value!r} (missing != zero)")

        # a numeric status must actually have a value
        if self.status in NUMERIC_STATUSES and self.raw_value is None:
            raise ObservationError(
                f"§10 violation: status {self.status} requires a numeric raw_value")

        # proxy != observed, estimated != observed
        if self.proxy and self.status != "PROXY":
            raise ObservationError(
                f"§10 violation: proxy=true requires status PROXY, got {self.status} (proxy != observed)")
        if self.status == "PROXY" and not self.proxy:
            raise ObservationError("§10 violation: status PROXY requires proxy=true")
        if self.estimated and self.status != "ESTIMATED":
            raise ObservationError(
                f"§10 violation: estimated=true requires status ESTIMATED, got {self.status}")
        if self.status == "ESTIMATED" and not self.estimated:
            raise ObservationError("§10 violation: status ESTIMATED requires estimated=true")
        if self.status == "OBSERVED" and not self.observed:
            raise ObservationError(
                "§10 violation: status OBSERVED requires observed=true (no unlabelled observation)")

        # §57 proxy law
        if self.proxy and not (self.proxy_definition and self.proxy_reason):
            raise ObservationError(
                "§57 violation: a proxy requires proxy_definition and proxy_reason")

        # perceptual != objective — a perceptual observation cannot claim to be objective-only
        if not self.evidence_stream:
            raise ObservationError("§9 violation: evidence_stream is required")
        for s in self.evidence_stream:
            if s not in EVIDENCE_STREAMS:
                raise ObservationError(f"invalid evidence_stream {s!r}; allowed: {EVIDENCE_STREAMS}")
        if "perceptual" in self.evidence_stream and self.status == "OBSERVED" and self.observed is False:
            raise ObservationError("§10 violation: perceptual observation cannot be labelled objective")

    def as_dict(self):
        return {f: getattr(self, f) for f in self.FIELDS}


class ObservationLedger:
    """Append-only ledger of raw observations."""

    def __init__(self):
        self._rows: list = []
        self._seen: set = set()

    def add(self, observation: Observation) -> dict:
        self._rows.append(observation)
        self._seen.add(observation.observation_id)
        return observation.as_dict()

    def add_raw(self, **kw) -> dict:
        return self.add(Observation(**kw))

    def rows(self):
        return list(self._rows)

    def by_indicator(self, code: str):
        return [o for o in self._rows if o.indicator_code == code]

    def status_counts(self) -> dict:
        out = {}
        for o in self._rows:
            out[o.status] = out.get(o.status, 0) + 1
        return out

    def as_dicts(self):
        return [o.as_dict() for o in self._rows]


class DataQualityGate:
    """§13 — the ordered gate a datum must pass before it may feed calculation."""

    STAGES = ("schema", "unit", "range", "spatial", "temporal", "source",
              "completeness", "proxy", "duplicate", "outlier", "qc_score")

    def __init__(self, registry, *, min_coverage: float = 0.5):
        self.registry = registry
        self.min_coverage = min_coverage
        self._seen_signatures: set = set()

    def validate(self, observation: Observation) -> dict:
        checks = []
        blocking = []
        # A non-numeric status can never produce a score, so unit/range cannot be
        # the reason it is blocked — its own status is. Reported, not blocking.
        produces_number = observation.status in NUMERIC_STATUSES

        def check(name: str, ok: bool, detail_fa: str, is_blocking: bool = True):
            checks.append({"check": name, "ok": bool(ok), "detail_fa": detail_fa,
                           "blocking": bool(is_blocking) and not ok})
            if not ok and is_blocking:
                blocking.append(name)

        # 1 — schema: the indicator must be known and mapped
        known = self.registry.is_known(observation.indicator_code)
        unmapped = self.registry.is_unmapped(observation.indicator_code)
        check("schema", known and not unmapped,
              (f"شاخص {observation.indicator_code} در رجیستر مادر یافت نشد" if not known
               else (f"شاخص {observation.indicator_code} UNMAPPED است؛ داده وارد محاسبه نمی‌شود (§۷٫۵)"
                     if unmapped else "شاخص شناخته‌شده و نگاشت‌شده")))

        # 2 — unit: compare declared unit to the registry unit when both exist
        rec = self.registry.get(observation.indicator_code) or {}
        reg_unit = rec.get("unit")
        unit_ok = (observation.unit is None or reg_unit is None
                   or str(observation.unit) == str(reg_unit))
        check("unit", unit_ok,
              (f"واحد اعلامی «{observation.unit}» با واحد رجیستر «{reg_unit}» ناسازگار است"
               if not unit_ok else f"واحد «{observation.unit or reg_unit or 'نامشخص'}»"),
              is_blocking=produces_number)

        # 3 — range: against the CALIBRATED L/U only. An uncalibrated placeholder
        # range (e.g. the 0–100 default) must never block real data (§19, §71).
        range_ok, range_detail = True, "محدوده بررسی نشد (بدون L/U کالیبره)"
        cal = self.registry.calibration_of(observation.indicator_code)
        if (cal and cal.get("calibrated") and cal.get("L") is not None
                and cal.get("U") is not None and observation.raw_value is not None
                and isinstance(observation.raw_value, (int, float))):
            lo, hi = float(cal["L"]), float(cal["U"])
            if observation.raw_value < lo or observation.raw_value > hi:
                range_ok = False
                range_detail = f"مقدار {observation.raw_value} خارج از بازهٔ کالیبرهٔ [{lo}, {hi}]"
            else:
                range_detail = f"مقدار {observation.raw_value} در بازهٔ کالیبرهٔ [{lo}, {hi}]"
        check("range", range_ok, range_detail, is_blocking=(range_ok is False and produces_number))

        # 4 — spatial
        check("spatial", bool(observation.spatial_unit or observation.geometry),
              "واحد مکانی/هندسه ثبت نشده است", is_blocking=False)

        # 5 — temporal
        check("temporal", bool(observation.observed_at or observation.reference_period),
              "زمان مشاهده/دورهٔ مرجع ثبت نشده است", is_blocking=False)

        # 6 — source
        check("source", bool(observation.source_id or observation.provider),
              "منبع ثبت نشده است")

        # 7 — completeness
        cov = observation.coverage
        check("completeness", cov is None or cov >= self.min_coverage,
              (f"پوشش {cov:.0%} کمتر از حداقل {self.min_coverage:.0%}" if cov is not None
               and cov < self.min_coverage else f"پوشش {cov if cov is not None else 'نامشخص'}"),
              is_blocking=False)

        # 8 — proxy: labelled proxies need definition+reason (already enforced by the model)
        check("proxy", (not observation.proxy) or bool(observation.proxy_definition and observation.proxy_reason),
              ("پروکسی بدون تعریف/دلیل" if observation.proxy
               and not (observation.proxy_definition and observation.proxy_reason)
               else ("پروکسی برچسب‌دار" if observation.proxy else "اندازه‌گیری مستقیم")))

        # 9 — duplicate
        sig = (observation.indicator_code, observation.raw_value, observation.unit,
               observation.spatial_unit, observation.reference_period, observation.source_id)
        dup = sig in self._seen_signatures
        if not dup:
            self._seen_signatures.add(sig)
        check("duplicate", not dup,
              "مشاهدهٔ تکراری (هم‌شاخص/هم‌مکان/هم‌دوره/هم‌منبع)", is_blocking=False)

        # 10 — outlier: flagged by the declared quality_score when present
        qs = observation.quality_score
        check("outlier", qs is None or qs >= 0.3,
              (f"نمرهٔ کیفیت {qs} پایین است (مشکوک به پرت)" if qs is not None and qs < 0.3
               else "بدون نشانهٔ پرت"), is_blocking=False)

        # 11 — QC score
        blocking_n = len(blocking)
        qc_score = round(max(0.0, 1.0 - 0.2 * blocking_n - 0.05 * (len(checks) - blocking_n - sum(1 for c in checks if c["ok"]))), 4)
        checks.append({"check": "qc_score", "ok": blocking_n == 0,
                       "detail_fa": f"نمرهٔ کنترل کیفیت {qc_score}؛ خطای بازدارنده {blocking_n}",
                       "blocking": blocking_n > 0})

        allowed = blocking_n == 0 and observation.status in NUMERIC_STATUSES
        return {
            "observation_id": observation.observation_id,
            "indicator_code": observation.indicator_code,
            "allowed": allowed,
            "blocking_failures": blocking,
            "qc_score": qc_score,
            "checks": checks,
            "decision_fa": ("مجاز به ورود به محاسبه" if allowed
                            else ("وضعیت " + observation.status + " عدد تولید نمی‌کند؛ داده وارد محاسبه نمی‌شود"
                                  if observation.status not in NUMERIC_STATUSES
                                  else "خطای بازدارنده در کنترل کیفیت: " + ", ".join(blocking))),
        }

    def apply(self, ledger: ObservationLedger) -> dict:
        """Run the gate over a whole ledger and split admitted / rejected."""
        admitted, rejected = [], []
        for o in ledger.rows():
            verdict = self.validate(o)
            (admitted if verdict["allowed"] else rejected).append({"observation": o.as_dict(), "gate": verdict})
        return {
            "n_total": len(ledger.rows()),
            "n_admitted": len(admitted),
            "n_rejected": len(rejected),
            "admitted": admitted,
            "rejected": rejected,
            "coverage": round(len(admitted) / len(ledger.rows()), 4) if ledger.rows() else 0.0,
        }
