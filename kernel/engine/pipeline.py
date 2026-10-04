# -*- coding: utf-8 -*-
"""
Neighborhood Decision Kernel — the ONE official pipeline (§89, §93).

    run_decision_support(...)

This module is the single computational entry point of the whole product. Every
API route, connector and UI ultimately calls this function; nothing else may
compute an indicator, score, capital, C-A-U-E-O, Q/T/R, bottleneck, priority or
impact (§0, §64, §89).

It ORCHESTRATES the existing kernel engines — it never re-implements their math:

    calc_run.CalcRun        atomic standardization / capital / C-A-U-E-O / Q-T-R
    confidence.ConfidenceEngine     evidence confidence
    bottleneck.detect_bottleneck    rule-based bottleneck detection
    equity.EquityEngine             justice gaps
    risk.RiskEngine/VulnerabilityEngine
    causal.CausalEngine
    intervention.InterventionEngine/PortfolioOptimizer
    evaluation.EvaluationEngine/LearningEngine
    publication_gate.PublicationGate
    uncertainty.UncertaintyEngine
    observation.ObservationLedger/DataQualityGate
    registry.IndicatorRegistry      the single registry accessor

Chain implemented (§1):
    observations -> validation/cleaning/harmonization -> standardization ->
    calibration -> confidence + uncertainty -> 8 capitals x C-A-U-E-O ->
    K/Q/T/R -> equity + vulnerability + risk -> bottleneck -> causal ->
    intervention -> portfolio -> evaluation -> learning
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone

from .calc_engine import METHODOLOGY_VERSION
from .calc_run import CALC_RUN_FAMILY, CalcRun
from .bottleneck import detect_bottleneck
from .causal import CausalEngine
from .confidence import ConfidenceEngine
from .equity import EquityEngine
from .evaluation import EvaluationEngine, LearningEngine
from .intervention import PortfolioOptimizer, InterventionEngine
from .observation import DataQualityGate, Observation, ObservationLedger
from .publication_gate import PublicationGate
from .registry import IndicatorRegistry, USABLE_STATUSES
from .risk import RiskEngine, VulnerabilityEngine
from .uncertainty import UncertaintyEngine

PIPELINE_VERSION = "NDK-pipeline-v1"

HERE = os.path.dirname(os.path.abspath(__file__))
REG_DIR = os.path.join(os.path.dirname(HERE), "registries")

# §23/§24 — the eight capitals and the five chain stages
CAPITAL_CODES = ("H", "S", "EC", "P", "N", "C", "G", "R")
STAGE_CODES = ("C", "A", "U", "E", "O")

STAGE_FA = {
    "C": "ظرفیت (Capacity)", "A": "دسترسی (Access)", "U": "استفاده (Use)",
    "E": "تجربه (Experience)", "O": "پیامد (Outcome)",
}
CAPITAL_FA = {
    "H": "انسانی", "S": "اجتماعی", "EC": "اقتصادی", "P": "کالبدی–زیرساختی",
    "N": "طبیعی–محیطی", "C": "فرهنگی–هویتی", "G": "نهادی–حکمرانی",
    "R": "شبکه‌ای–ارتباطی",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canon(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha(obj) -> str:
    return "sha256:" + hashlib.sha256(canon(obj).encode("utf-8")).hexdigest()


def _weighted_mean(pairs: list) -> float | None:
    """Sum(w*Z)/Sum(w) over qualified (value, weight) pairs."""
    num = sum(w * v for v, w in pairs)
    den = sum(w for _, w in pairs)
    if den == 0:
        return None
    return round(num / den, 4)


class DecisionSupportResult:
    """The structured outcome of one pipeline run."""

    def __init__(self, payload: dict):
        self.payload = payload

    def as_dict(self) -> dict:
        return self.payload


def run_decision_support(
    *,
    observations: list,
    neighborhood: dict | None = None,
    boundary: dict | None = None,
    equity_inputs: dict | None = None,
    risk_inputs: list | None = None,
    vulnerability_inputs: dict | None = None,
    intervention_candidates: list | None = None,
    portfolio_constraints: dict | None = None,
    causal_evidence: dict | None = None,
    data_version: str = "unspecified",
    registries_dir: str | None = None,
    weight_override: dict | None = None,
) -> DecisionSupportResult:
    """Run the full decision-support pipeline. Deterministic for identical input+versions."""
    reg = IndicatorRegistry(registries_dir or REG_DIR)
    created_at = _now()

    # ── 1. Observation Ledger (§9) ────────────────────────────────────────────
    ledger = ObservationLedger()
    for raw in observations or []:
        ledger.add(Observation(**(raw if isinstance(raw, dict) else {})))

    # ── 2. Data Quality Gate (§13) ────────────────────────────────────────────
    gate = DataQualityGate(reg)
    gate_result = gate.apply(ledger)
    admitted = gate_result["admitted"]

    # ── 3. Harmonization + standardization eligibility ────────────────────────
    processed = []
    for row in admitted:
        obs = row["observation"]
        code = obs["indicator_code"]
        rec = reg.get(code) or {}
        cal = reg.calibration_of(code)
        reasons = []
        eligible = True
        if cal is None:
            eligible = False
            reasons.append("no L/U entry for this indicator (not calibratable yet)")
        elif not cal.get("calibrated"):
            eligible = False
            reasons.append(
                f"L/U uncalibrated (status={cal.get('status')}) — §19/§71: "
                "an uncalibrated L/U is not a publishable scale")
        direction = reg.direction(code)
        if direction == "threshold":
            eligible = False
            reasons.append("threshold indicator requires an explicit versioned optimal-band function (§18)")

        standardized = None
        if eligible and isinstance(obs["raw_value"], (int, float)):
            lo, hi = float(cal["L"]), float(cal["U"])
            if hi == lo:
                eligible, reasons = False, ["L == U; scale degenerate"]
            else:
                x = float(obs["raw_value"])
                if direction == "inverse":
                    z = 100.0 * max(0.0, min(1.0, (hi - x) / (hi - lo)))
                else:
                    z = 100.0 * max(0.0, min(1.0, (x - lo) / (hi - lo)))
                standardized = round(z, 4)

        processed.append({
            "indicator_code": code,
            "title": rec.get("name_fa"),
            "capital": reg.capital(code),
            "chain_stage": reg.stage(code),
            "qtr_target": reg.qtr_target(code),
            "role": rec.get("role"),
            "direction": direction,
            "unit": obs["unit"],
            "raw_value": obs["raw_value"],
            "status": obs["status"],
            "is_proxy": obs["proxy"],
            "evidence_stream": obs["evidence_stream"],
            "provenance_value_id": obs["provenance_value_id"],
            "observation_id": obs["observation_id"],
            "standardized": standardized,
            "standardization_status": "STANDARDIZED" if standardized is not None else "PENDING_VALIDATION",
            "standardization_reasons": reasons,
            "weight": reg.weight_of(code),
        })

    n_standardized = sum(1 for p in processed if p["standardized"] is not None)

    # ── 4. Confidence + Uncertainty per value (§21, §22) ──────────────────────
    conf_engine = ConfidenceEngine()
    unc_engine = UncertaintyEngine()
    for p in processed:
        code = p["indicator_code"]
        cal = reg.calibration_of(code)
        p["confidence"] = conf_engine.assess_value(
            has_number=p["standardized"] is not None,
            source_category="official_registry",
            is_proxy=p["is_proxy"],
            evidence_streams=p["evidence_stream"],
            value_scale="unknown",
            target_scale="neighborhood",
            completeness=None,
            quality_score=None,
            age_days=None,
            expected_days=None,
            n_streams_agree=len(set(p["evidence_stream"])),
            tested=False,
        )
        p["uncertainty"] = unc_engine.assess_value(
            has_number=p["standardized"] is not None,
            is_proxy=p["is_proxy"],
            coverage=None,
            sample_size=None,
            calibrated=bool(cal and cal.get("calibrated")),
            source_count=len(set(p["evidence_stream"])),
        )

    # ── 5. 8 Capitals x C-A-U-E-O (§23, §24) ──────────────────────────────────
    n_by_capital = reg.n_by_capital()
    n_by_stage = reg.n_by_stage()

    capitals = {}
    for cap in CAPITAL_CODES:
        members = [p for p in processed if p["capital"] == cap]
        qualified = [p for p in members if p["standardized"] is not None]
        denom = n_by_capital.get(cap, 0)
        coverage = (len(qualified) / denom) if denom else 0.0
        value = _weighted_mean([(p["standardized"], p["weight"]) for p in qualified]) if qualified else None
        status = ("OBSERVED" if value is not None and coverage >= 0.5
                  else ("INSUFFICIENT_COVERAGE" if members or denom else "WAITING_FOR_DATA"))
        capitals[cap] = {
            "capital": cap,
            "capital_name_fa": CAPITAL_FA.get(cap),
            "value": value,
            "status": status,
            "coverage": round(coverage, 4),
            "n_qualified": len(qualified),
            "n_attempted": len(members),
            "n_registry": denom,
            "formula_id": "Kj = Sum(w*Z)/Sum(w) over qualified standardized indicators only",
            "confidence": conf_engine.assess_aggregate(
                published=value is not None,
                member_confidences=[p["confidence"] for p in qualified],
                coverage=coverage),
            "uncertainty": unc_engine.assess_aggregate(
                published=value is not None,
                member_uncertainties=[p["uncertainty"] for p in qualified],
                coverage=coverage),
            "abstention_reason_fa": (None if value is not None else
                                     "هیچ شاخص استانداردشدهٔ معتبری برای این سرمایه وجود ندارد؛ "
                                     "نمره ساخته نمی‌شود (§۲۳)."),
        }

    caueo_stages = {}
    for st in STAGE_CODES:
        members = [p for p in processed if p["chain_stage"] == st]
        qualified = [p for p in members if p["standardized"] is not None]
        denom = n_by_stage.get(st, 0)
        coverage = (len(qualified) / denom) if denom else 0.0
        value = _weighted_mean([(p["standardized"], p["weight"]) for p in qualified]) if qualified else None
        caueo_stages[st] = {
            "stage": st,
            "stage_name_fa": STAGE_FA[st],
            "value": value,
            "status": "OBSERVED" if value is not None and coverage >= 0.5 else
                      ("INSUFFICIENT_COVERAGE" if (members or denom) else "WAITING_FOR_DATA"),
            "coverage": round(coverage, 4),
            "n_qualified": len(qualified),
            "n_registry": denom,
        }

    # §24 — a gap is published ONLY when BOTH endpoints have sufficient coverage
    gaps = {}
    for gid, a, b in (("G_CA", "C", "A"), ("G_AU", "A", "U"), ("G_UE", "U", "E"), ("G_EO", "E", "O")):
        va, vb = caueo_stages[a]["value"], caueo_stages[b]["value"]
        if va is not None and vb is not None:
            gaps[gid] = {"value": round(va - vb, 4), "status": "OBSERVED", "from": a, "to": b}
        else:
            gaps[gid] = {
                "value": None, "status": "INSUFFICIENT_COVERAGE", "from": a, "to": b,
                "reason_fa": "یکی از دو سرِ شکاف پوشش کافی ندارد؛ شکاف منتشر نمی‌شود (§۲۴).",
            }

    # ── 6. K / Q / T / R (§25-§27) ────────────────────────────────────────────
    # Q is built from A, U, E, O — Capacity does NOT enter Q directly (§25).
    q_stages = ("A", "U", "E", "O")
    q_members = [caueo_stages[s] for s in q_stages if caueo_stages[s]["value"] is not None]
    Q = _weighted_mean([(m["value"], 1.0) for m in q_members]) if q_members else None

    # T = 100 - weighted_mean(max(0, gap)) over the four transitions (§26).
    # No hidden governanceBoost: an explicit calibrated_combination would have to
    # come from the methodology registry, which is currently uncalibrated.
    positive_gaps = [max(0.0, g["value"]) for g in gaps.values() if g["value"] is not None]
    T = round(100.0 - (sum(positive_gaps) / len(positive_gaps)), 4) if positive_gaps else None

    # R from reproduction indicators (§27) — requires a registry definition of the
    # reproduction set; until then R abstains rather than becoming mean(G,H,repro).
    r_members = [p for p in processed if p["qtr_target"] == "R" and p["standardized"] is not None]
    R = _weighted_mean([(p["standardized"], p["weight"]) for p in r_members]) if r_members else None

    k_members = [p for p in processed if p["qtr_target"] == "K" and p["standardized"] is not None]
    K = _weighted_mean([(p["standardized"], p["weight"]) for p in k_members]) if k_members else None

    qtr = {}
    for name, value, formula, note in (
        ("K", K, "K = weighted_mean(labelled capacity indicators)",
         "ظرفیت محقق‌شده؛ فقط از شاخص‌های معتبر با برچسب K"),
        ("Q", Q, "Q = weighted_mean(A, U, E, O)",
         "ظرفیت (C) مستقیماً وارد Q نمی‌شود (§۲۵)."),
        ("T", T, "T = 100 - weighted_mean(max(0, C-A), max(0, A-U), max(0, U-E), max(0, E-O))",
         "هیچ governanceBoost ثابت و پنهانی وجود ندارد (§۲۶)."),
        ("R", R, "R = weighted_mean(registry-declared reproduction indicators)",
         "R از شاخص‌های بازتولید/یادگیری/تاب‌آوری ساخته می‌شود؛ mean(G,H,repro) مجاز نیست (§۲۷)."),
    ):
        qtr[name] = {
            "name": name,
            "value": value,
            "status": "OBSERVED" if value is not None else "INSUFFICIENT_COVERAGE",
            "formula_fa": formula,
            "note_fa": note,
            "n_members": len({"K": k_members, "Q": q_members, "T": positive_gaps, "R": r_members}[name]),
        }

    # ── 7. Equity / Vulnerability / Risk (§29-§32) ────────────────────────────
    equity = EquityEngine().assess(by_indicator=equity_inputs or {})
    vulnerability = VulnerabilityEngine().assess(groups=vulnerability_inputs or {})
    risk = RiskEngine().assess(risks=risk_inputs or [])

    # ── 8. Bottleneck (§33, §34) ──────────────────────────────────────────────
    bottleneck = detect_bottleneck(
        {s: {"value": caueo_stages[s]["value"], "status": caueo_stages[s]["status"]} for s in STAGE_CODES},
        base_threshold=60.0,
        disaggregation={
            "capital": any(c["value"] is not None for c in capitals.values()),
            "location": bool((neighborhood or {}).get("sub_units")),
            "group": equity.get("status") == "OBSERVED",
            "time": bool((neighborhood or {}).get("time_series")),
        },
        confidence=None,
    )
    if bottleneck.get("status") != "OBSERVED":
        bottleneck["status"] = "NO_BOTTLENECK_DETERMINABLE" if bottleneck.get("status") == "INSUFFICIENT_COVERAGE" else bottleneck["status"]

    # §34 — five-dimensional address
    address = None
    if bottleneck.get("primary_bottleneck"):
        pb = bottleneck["primary_bottleneck"]
        transition = pb.get("gap") or (f"{pb.get('stage')}" if pb.get("stage") else None)
        worst_cap = min((c for c in capitals.values() if c["value"] is not None),
                        key=lambda c: c["value"], default=None)
        address = {
            "capital": ({"code": worst_cap["capital"], "name_fa": worst_cap["capital_name_fa"],
                         "value": worst_cap["value"]} if worst_cap else None),
            "transition": transition,
            "location": (neighborhood or {}).get("sub_units") or None,
            "group": (equity.get("verdict") or {}).get("largest_gap_indicator") if equity.get("status") == "OBSERVED" else None,
            "time": (neighborhood or {}).get("time_series") or None,
            "note_fa": "نشانی مسئله = سرمایه × گذار × مکان × گروه × زمان (§۳۴).",
        }

    # ── 9. Causal diagnosis (§35-§37) ─────────────────────────────────────────
    causal = CausalEngine().assess(gaps=gaps, evidence_index=causal_evidence or {})

    # ── 10. Interventions + portfolio (§42-§46) ───────────────────────────────
    iv_engine = InterventionEngine()
    portfolio = PortfolioOptimizer().optimize(
        candidates=intervention_candidates or [],
        **(portfolio_constraints or {}))

    # ── 11. Evaluation + learning (§48-§52) ───────────────────────────────────
    evaluation_plan = EvaluationEngine().plan(
        intervention_id="(none-selected)",
        baseline=None, target=None, kpis=None,
        method="NOT_SELECTED",
    )

    # ── 12. Publication Gate (§60, §72) ───────────────────────────────────────
    published_values = [c for c in capitals.values() if c["value"] is not None]
    observed_stages = [s for s in STAGE_CODES if caueo_stages[s]["value"] is not None]
    agg_conf = (conf_engine.assess_aggregate(
        published=bool(published_values),
        member_confidences=[p["confidence"] for p in processed if p["standardized"] is not None],
        coverage=(n_standardized / len(processed)) if processed else 0.0) if processed else {"level": "ناکافی"})
    gate_out = PublicationGate().evaluate(
        boundary_valid=bool(boundary and boundary.get("provenance_ref")),
        boundary_provenance=(boundary or {}).get("provenance_ref"),
        coverage=(n_standardized / len(processed)) if processed else 0.0,
        calibration_complete=bool(reg.calibration_calibrated),
        weight_set_valid=bool(reg.weight_calibrated),
        caueo_stages_observed=observed_stages,
        confidence_level=agg_conf.get("level"),
        critical_qa_failure=gate_result["n_rejected"] > 0 and gate_result["n_admitted"] == 0,
        independently_validated=False,
        n_published_scores=len(published_values),
    )

    # ── 13. Deterministic fingerprint (§61) ───────────────────────────────────
    fingerprint_payload = {
        "pipeline_version": PIPELINE_VERSION,
        "data_version": data_version,
        "indicator_version": reg.version,
        "methodology_version": METHODOLOGY_VERSION,
        "weight_version": reg.weight_version,
        "threshold_version": reg.calibration_version,
        "calculation_version": CALC_RUN_FAMILY,
        "boundary_version": (boundary or {}).get("version_id"),
        "observations": [{"indicator_code": o["indicator_code"], "raw_value": o["raw_value"],
                          "unit": o["unit"], "status": o["status"], "proxy": o["proxy"],
                          "evidence_stream": o["evidence_stream"]}
                         for o in ledger.as_dicts()],
        "standardized": [{"indicator_code": p["indicator_code"], "standardized": p["standardized"],
                          "status": p["standardization_status"]} for p in processed],
        "capitals": {c: v["value"] for c, v in capitals.items()},
        "caueo": {s: v["value"] for s, v in caueo_stages.items()},
        "qtr": {k: v["value"] for k, v in qtr.items()},
    }
    fingerprint = sha(fingerprint_payload)
    run_id = f"{PIPELINE_VERSION}+{fingerprint.split(':')[1][:12]}"

    result = {
        "run_id": run_id,
        "created_at": created_at,
        "pipeline_version": PIPELINE_VERSION,
        "versions": {
            "data_version": data_version,
            "indicator_version": reg.version,
            "methodology_version": METHODOLOGY_VERSION,
            "weight_version": reg.weight_version,
            "threshold_version": reg.calibration_version,
            "calculation_version": CALC_RUN_FAMILY,
            "boundary_version": (boundary or {}).get("version_id"),
        },
        "neighborhood": neighborhood,
        "boundary": boundary,
        "observation_ledger": {
            "count": len(ledger.rows()),
            "status_counts": ledger.status_counts(),
            "observations": ledger.as_dicts(),
        },
        "quality_gate": {
            "n_total": gate_result["n_total"],
            "n_admitted": gate_result["n_admitted"],
            "n_rejected": gate_result["n_rejected"],
            "coverage": gate_result["coverage"],
            "rejected": [{"observation_id": r["observation"]["observation_id"],
                          "indicator_code": r["observation"]["indicator_code"],
                          "status": r["observation"]["status"],
                          "blocking_failures": r["gate"]["blocking_failures"],
                          "decision_fa": r["gate"]["decision_fa"]} for r in gate_result["rejected"]],
        },
        "standardized_values": processed,
        "confidence": {"aggregate": agg_conf},
        "uncertainty": {
            "aggregate": unc_engine.assess_aggregate(
                published=bool(published_values),
                member_uncertainties=[p["uncertainty"] for p in processed if p["standardized"] is not None],
                coverage=(n_standardized / len(processed)) if processed else 0.0),
            "note_fa": "عدم‌قطعیت هر مقدار جدا از نمره ثبت می‌شود (§۲۱، §۲۲).",
        },
        "capital_scores": capitals,
        "caueo": {"stages": caueo_stages, "gaps": gaps},
        "qtr": qtr,
        "equity": equity,
        "vulnerability": vulnerability,
        "risk": risk,
        "bottleneck": bottleneck,
        "bottleneck_address": address,
        "causal_diagnosis": causal,
        "intervention_portfolio": portfolio,
        "evaluation_plan": evaluation_plan,
        "publication_gate": gate_out,
        "fingerprint": fingerprint,
        "engine": {
            "entry_point": "kernel.engine.pipeline.run_decision_support",
            "note_fa": "این تابع تنها مسیر رسمی تولید خروجی است (§۸۹).",
        },
    }
    return DecisionSupportResult(result)


def run_from_service_records(records: list, **kw) -> DecisionSupportResult:
    """Adapter: legacy kernel-service record shape -> canonical observations.

    A record shaped {indicator_code, raw_unit, measurement:{value,status,is_proxy,
    evidence_stream}, provenance_value_id, provenance:{...}} is translated into a
    §9 Observation. No number is created here; a missing value stays missing.
    """
    observations = []
    for r in records or []:
        m = r.get("measurement") or {}
        status = m.get("status") or "MISSING"
        if status not in ("OBSERVED", "ESTIMATED", "PROXY"):
            status = status if status in (
                "MISSING", "SUPPRESSED", "NOT_RECORDED", "PENDING_VALIDATION", "ACCESS_REQUIRED"
            ) else "MISSING"
        streams = m.get("evidence_stream") or ["objective"]
        prov = r.get("provenance") or {}
        observations.append({
            "indicator_code": r.get("indicator_code"),
            "raw_value": m.get("value") if status in ("OBSERVED", "ESTIMATED", "PROXY") else None,
            "unit": r.get("raw_unit"),
            "observed_at": prov.get("timestamp_acquired"),
            "reference_period": prov.get("observation_period"),
            "source_id": prov.get("source_id"),
            "provider": prov.get("provider"),
            "dataset_id": prov.get("dataset_id"),
            "spatial_unit": prov.get("geographic_extent"),
            "evidence_stream": [s for s in streams if s in ("objective", "spatial", "behavioral", "perceptual")] or ["objective"],
            "status": status,
            "proxy": bool(m.get("is_proxy")) and status == "PROXY",
            "proxy_definition": prov.get("proxy_definition"),
            "proxy_reason": prov.get("proxy_reason"),
            "estimated": status == "ESTIMATED",
            "observed": status == "OBSERVED",
            "provenance_value_id": r.get("provenance_value_id"),
        })
    return run_decision_support(observations=observations, **kw)
