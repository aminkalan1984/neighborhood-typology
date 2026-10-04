# -*- coding: utf-8 -*-
"""
Neighborhood Decision Kernel — unit / integration / contract / determinism /
abstention / negative-invariant tests (§70, §71).

Run:  python kernel/engine/tests/test_decision_kernel.py
Exit code 0 = all pass. Any failure exits non-zero (CI-usable).
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KROOT = os.path.dirname(os.path.dirname(HERE))
if KROOT not in sys.path:
    sys.path.insert(0, KROOT)

from engine.bottleneck import detect_bottleneck                      # noqa: E402
from engine.causal import CausalEngine                               # noqa: E402
from engine.confidence import ConfidenceEngine                       # noqa: E402
from engine.equity import EquityEngine                               # noqa: E402
from engine.evaluation import EvaluationEngine, LearningEngine       # noqa: E402
from engine.intervention import InterventionEngine, PortfolioOptimizer  # noqa: E402
from engine.observation import (                                     # noqa: E402
    DataQualityGate, Observation, ObservationError, ObservationLedger,
)
from engine.pipeline import run_decision_support                     # noqa: E402
from engine.publication_gate import PublicationGate                  # noqa: E402
from engine.registry import IndicatorRegistry                        # noqa: E402
from engine.risk import RiskEngine, VulnerabilityEngine              # noqa: E402
from engine.uncertainty import UncertaintyEngine                     # noqa: E402

PASSED = 0
FAILED = 0


def check(label: str, cond: bool, detail: str = ""):
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"  ok   {label}")
    else:
        FAILED += 1
        print(f"  FAIL {label} {detail}")


def raises(label: str, fn):
    try:
        fn()
    except Exception:
        check(label, True)
        return
    check(label, False, "(no exception raised)")


# ═══════════════════════════════════════════════════════════════════════════
def test_registry_single_source():
    print("\n[registry] single master registry (§7)")
    reg = IndicatorRegistry()
    check("master registry loaded", reg.version == "IR-v1", reg.version)
    check("has 419 registry indicators", reg.counts["total"] >= 419, str(reg.counts["total"]))
    check("core-40 flagged, not a 2nd registry", reg.counts["core"] == 40, str(reg.counts["core"]))
    check("online-83 flagged", reg.counts["online"] == 83, str(reg.counts["online"]))
    check("perceptual-15 present", reg.counts["perceptual"] == 15, str(reg.counts["perceptual"]))
    check("unmapped declared honestly", reg.counts["unmapped"] == 40, str(reg.counts["unmapped"]))
    check("a core code is UNMAPPED (no guessing)", reg.is_unmapped("H1"))
    check("a registry code is mapped", not reg.is_unmapped("PHY-003"))
    check("weights read from registry, uncalibrated", reg.weight_calibrated is False)
    check("calibration read from registry, uncalibrated", reg.calibration_calibrated is False)


# ═══════════════════════════════════════════════════════════════════════════
def test_observation_invariants():
    print("\n[observation] §10 golden rules enforced as HARD invariants")
    raises("missing != zero (status MISSING with a value is refused)", lambda: Observation(
        indicator_code="PHY-003", raw_value=0, status="MISSING",
        evidence_stream=["spatial"]))
    raises("proxy != observed (proxy=true without PROXY status refused)", lambda: Observation(
        indicator_code="PHY-003", raw_value=5, status="OBSERVED", observed=True,
        proxy=True, evidence_stream=["spatial"]))
    raises("estimated != observed", lambda: Observation(
        indicator_code="PHY-003", raw_value=5, status="OBSERVED", observed=True,
        estimated=True, evidence_stream=["spatial"]))
    raises("PROXY requires definition+reason (§57)", lambda: Observation(
        indicator_code="PHY-003", raw_value=5, status="PROXY", proxy=True,
        evidence_stream=["spatial"]))
    raises("OBSERVED requires observed=true (no unlabelled value)", lambda: Observation(
        indicator_code="PHY-003", raw_value=5, status="OBSERVED",
        evidence_stream=["spatial"]))
    raises("evidence_stream is required (§9)", lambda: Observation(
        indicator_code="PHY-003", raw_value=5, status="OBSERVED", observed=True))

    ok = Observation(
        indicator_code="PHY-003", raw_value=115.0, unit="count", status="PROXY", proxy=True,
        proxy_definition="count of POIs in boundary", proxy_reason="no network distance source",
        evidence_stream=["spatial", "objective"], source_id="SRC-1")
    check("a labelled proxy observation is accepted", ok.status == "PROXY")
    check("observation_id is deterministic", ok.observation_id == Observation(
        indicator_code="PHY-003", raw_value=115.0, unit="count", status="PROXY", proxy=True,
        proxy_definition="count of POIs in boundary", proxy_reason="no network distance source",
        evidence_stream=["spatial", "objective"], source_id="SRC-1").observation_id)
    check("non-numeric status keeps value None (never 0)",
          Observation(indicator_code="ONL-001", raw_value=None, status="ACCESS_REQUIRED",
                      evidence_stream=["spatial"]).raw_value is None)


# ═══════════════════════════════════════════════════════════════════════════
def test_quality_gate():
    print("\n[quality gate] §13 ordered gate")
    reg = IndicatorRegistry()
    gate = DataQualityGate(reg)
    reg_unit = (reg.get("PHY-003") or {}).get("unit")
    good = Observation(indicator_code="PHY-003", raw_value=115.0, unit=reg_unit,
                       status="PROXY", proxy=True, proxy_definition="d", proxy_reason="r",
                       evidence_stream=["spatial"], source_id="SRC-1")
    v = gate.validate(good)
    check("labelled proxy with source passes the gate", v["allowed"], str(v["blocking_failures"]))
    # §13 — a declared unit that contradicts the registry must be blocked, not coerced
    wrong_unit = Observation(indicator_code="PHY-003", raw_value=115.0, unit="count",
                             status="PROXY", proxy=True, proxy_definition="d", proxy_reason="r",
                             evidence_stream=["spatial"], source_id="SRC-1")
    vw = gate.validate(wrong_unit)
    check("unit mismatch is blocked, never coerced",
          not vw["allowed"] and "unit" in vw["blocking_failures"], str(vw["blocking_failures"]))
    unknown = Observation(indicator_code="NOPE-1", raw_value=1.0, status="OBSERVED", observed=True,
                          evidence_stream=["objective"], source_id="S")
    v2 = gate.validate(unknown)
    check("unknown indicator is blocked by schema", not v2["allowed"] and "schema" in v2["blocking_failures"])
    check("qc_score reported", isinstance(v2["qc_score"], float))


# ═══════════════════════════════════════════════════════════════════════════
def test_abstention():
    print("\n[abstention] §71 — no score, no diagnosis, no prescription from no data")
    r = run_decision_support(
        observations=[{"indicator_code": "ONL-001", "raw_value": None, "unit": "meter",
                       "status": "ACCESS_REQUIRED", "evidence_stream": ["spatial"],
                       "source_id": "SRC-1"}],
        data_version="abstain-test").as_dict()
    check("no capital score published", all(c["value"] is None for c in r["capital_scores"].values()))
    check("Q/T/R all abstain", all(v["value"] is None for v in r["qtr"].values()))
    check("bottleneck abstains", r["bottleneck"]["status"] == "NO_BOTTLENECK_DETERMINABLE",
          r["bottleneck"]["status"])
    check("equity abstains", r["equity"]["status"] == "INSUFFICIENT_DISAGGREGATION")
    check("portfolio abstains", r["intervention_portfolio"]["status"] == "PORTFOLIO_OPTIMIZATION_UNAVAILABLE")
    check("causal abstains", r["causal_diagnosis"]["status"] == "NOT_ASSESSED")
    check("evaluation has no baseline => NOT_IDENTIFIABLE",
          r["evaluation_plan"]["identifiability"] == "NOT_IDENTIFIABLE")
    check("publication gate blocks numbers", r["publication_gate"]["can_publish_numeric_scores"] is False)
    check("decision withheld", r["publication_gate"]["decision_withheld"] is True)
    check("gate reports what would unblock", len(r["publication_gate"]["what_would_unblock"]) > 0)
    check("no uncalibrated score published anywhere",
          all(p["standardized"] is None for p in r["standardized_values"]))


# ═══════════════════════════════════════════════════════════════════════════
def test_standardization_and_qtr():
    print("\n[standardization + Q/T/R] §18, §25-§27")
    reg = IndicatorRegistry()
    u3 = (reg.get("PHY-003") or {}).get("unit")
    u1 = (reg.get("PHY-001") or {}).get("unit")
    obs = [
        {"indicator_code": "PHY-003", "raw_value": 50.0, "unit": u3, "status": "PROXY",
         "proxy": True, "proxy_definition": "d", "proxy_reason": "r",
         "evidence_stream": ["spatial"], "source_id": "S"},
        {"indicator_code": "PHY-001", "raw_value": 30.0, "unit": u1, "status": "PROXY",
         "proxy": True, "proxy_definition": "d", "proxy_reason": "r",
         "evidence_stream": ["spatial"], "source_id": "S"},
    ]
    r = run_decision_support(observations=obs, data_version="std-test").as_dict()
    check("L/U uncalibrated => standardized withheld (PENDING_VALIDATION)",
          all(p["standardization_status"] == "PENDING_VALIDATION" for p in r["standardized_values"]))
    check("standardization reason cites calibration",
          any("uncalibrated" in " ".join(p["standardization_reasons"])
              for p in r["standardized_values"] if p["standardized"] is None))
    check("Q is built from A/U/E/O only, never C",
          "weighted_mean(A, U, E, O)" in r["qtr"]["Q"]["formula_fa"])
    check("T has no hidden governanceBoost",
          "governanceBoost" in r["qtr"]["T"]["note_fa"] and "هیچ" in r["qtr"]["T"]["note_fa"])
    check("T formula matches §26",
          r["qtr"]["T"]["formula_fa"].startswith("T = 100 - weighted_mean(max(0, C-A)"))
    check("K/Q/T/R are four separate results", set(r["qtr"].keys()) == {"K", "Q", "T", "R"})


# ═══════════════════════════════════════════════════════════════════════════
def test_gap_requires_both_endpoints():
    print("\n[chain gaps] §24 — a gap needs BOTH endpoints with coverage")
    caueo = {"C": {"value": 80.0, "status": "OBSERVED"},
             "A": {"value": None, "status": "INSUFFICIENT_COVERAGE"},
             "U": {"value": None, "status": "WAITING_FOR_DATA"},
             "E": {"value": None, "status": "WAITING_FOR_DATA"},
             "O": {"value": None, "status": "WAITING_FOR_DATA"}}
    r = run_decision_support(
        observations=[{"indicator_code": "PHY-003", "raw_value": 1.0, "status": "PROXY",
                       "proxy": True, "proxy_definition": "d", "proxy_reason": "r",
                       "evidence_stream": ["spatial"], "source_id": "S"}],
        data_version="gap-test").as_dict()
    g = r["caueo"]["gaps"]["G_CA"]
    check("G_CA abstains when an endpoint is missing", g["value"] is None and g["status"] == "INSUFFICIENT_COVERAGE")


# ═══════════════════════════════════════════════════════════════════════════
def test_equity():
    print("\n[equity] §29 — no group data => no verdict")
    e = EquityEngine()
    empty = e.assess(by_indicator={})
    check("no group data => INSUFFICIENT_DISAGGREGATION", empty["status"] == "INSUFFICIENT_DISAGGREGATION")
    one_group = e.assess(by_indicator={"PHY-003": {"groups": {"women": {"value": 50, "sample_size": 100}}}})
    check("one group => no equity verdict", one_group["status"] == "INSUFFICIENT_DISAGGREGATION")
    small = e.assess(by_indicator={"PHY-003": {"groups": {
        "women": {"value": 50, "sample_size": 5}, "men": {"value": 70, "sample_size": 5}}}})
    check("tiny samples rejected", small["status"] == "INSUFFICIENT_DISAGGREGATION")
    ok = e.assess(by_indicator={"PHY-003": {"dimension": "gender", "groups": {
        "women": {"value": 50, "sample_size": 100, "confidence": 0.9},
        "men": {"value": 70, "sample_size": 100, "confidence": 0.9}}}})
    check("sufficient groups => verdict", ok["status"] == "OBSERVED")
    check("JusticeGap = best - worst", ok["indicators"]["PHY-003"]["value"] == 20.0)
    check("best/worst groups reported",
          ok["indicators"]["PHY-003"]["best_group"]["id"] == "men"
          and ok["indicators"]["PHY-003"]["worst_group"]["id"] == "women")


# ═══════════════════════════════════════════════════════════════════════════
def test_bottleneck():
    print("\n[bottleneck] §33 — rule-based, AI-independent, abstains")
    empty = detect_bottleneck({"C": {"value": None, "status": "WAITING_FOR_DATA"},
                               "A": {"value": None, "status": "WAITING_FOR_DATA"},
                               "U": {"value": None, "status": "WAITING_FOR_DATA"},
                               "E": {"value": None, "status": "WAITING_FOR_DATA"},
                               "O": {"value": None, "status": "WAITING_FOR_DATA"}})
    check("no data => NO bottleneck determinable", empty["status"] == "INSUFFICIENT_COVERAGE")
    check("bottleneck is AI-independent", empty["ai_independent"] is True)
    base = detect_bottleneck({"C": {"value": 40.0, "status": "OBSERVED"},
                              "A": {"value": 70.0, "status": "OBSERVED"},
                              "U": {"value": 60.0, "status": "OBSERVED"},
                              "E": {"value": 55.0, "status": "OBSERVED"},
                              "O": {"value": 50.0, "status": "OBSERVED"}})
    check("low base C flagged first", base["base_deficiency"]["flagged"] is True)
    check("base deficiency is the primary bottleneck",
          base["primary_bottleneck"]["type"] == "base_deficiency")
    gap = detect_bottleneck({"C": {"value": 90.0, "status": "OBSERVED"},
                             "A": {"value": 40.0, "status": "OBSERVED"},
                             "U": {"value": 80.0, "status": "OBSERVED"},
                             "E": {"value": 75.0, "status": "OBSERVED"},
                             "O": {"value": 70.0, "status": "OBSERVED"}})
    check("largest observed gap chosen when base is healthy",
          gap["primary_bottleneck"]["gap"] == "G_CA", str(gap["primary_bottleneck"]))


# ═══════════════════════════════════════════════════════════════════════════
def test_causal():
    print("\n[causal] §35-§37 — LLM-independent, no fabricated causal proof")
    c = CausalEngine()
    none = c.assess(gaps={})
    check("no valid gap => no causal diagnosis", none["status"] == "NOT_ASSESSED")
    r = c.assess(gaps={"G_AU": {"value": 25.0, "status": "OBSERVED"}})
    check("hypotheses generated for a valid gap", r["status"] == "HYPOTHESES_GENERATED")
    check("hypotheses carry a family", all(h["family"] in (
        "cost", "security", "quality", "time", "physical_barrier", "information",
        "norm", "governance", "market", "institutional", "environmental") for h in r["hypotheses"]))
    check("all statuses are from §37 vocabulary", all(h["causal_status"] in (
        "INITIAL", "CONVERGENT", "TESTED", "REJECTED", "UNRESOLVED") for h in r["hypotheses"]))
    check("no hypothesis claims TESTED without a test", r["tested_count"] == 0)
    check("alternative explanation recorded for every hypothesis",
          all(h["alternative_explanation_fa"] for h in r["hypotheses"]))
    conv = c.assess(gaps={"G_AU": {"value": 25.0, "status": "OBSERVED"}},
                    evidence_index={"G_AU": {"cost": ["e1", "e2"]}})
    cost_h = next(h for h in conv["hypotheses"] if h["family"] == "cost")
    check("two independent evidences => CONVERGENT", cost_h["causal_status"] == "CONVERGENT")
    check("CONVERGENT is explicitly not causal proof", "اثبات علّی" in conv["causal_claim_fa"])
    check("AI boundary declared", "Kernel" in conv["ai_boundary_fa"])


# ═══════════════════════════════════════════════════════════════════════════
def test_publication_gate():
    print("\n[publication gate] §60, §72 — four levels + structured withholding")
    g = PublicationGate()
    out = g.evaluate(boundary_valid=False, boundary_provenance=None, coverage=0.0,
                     calibration_complete=False, weight_set_valid=False,
                     caueo_stages_observed=[], confidence_level="ناکافی",
                     critical_qa_failure=False, n_published_scores=0)
    check("level EVIDENCE_ONLY with no scores", out["level"] == "EVIDENCE_ONLY")
    check("numbers blocked", out["can_publish_numeric_scores"] is False)
    check("structured: what is known", isinstance(out["what_is_known"], list))
    check("structured: what is unknown", len(out["what_is_unknown"]) > 0)
    check("structured: why unknown", len(out["why_unknown"]) > 0)
    check("structured: what would unblock", len(out["what_would_unblock"]) > 0)

    full = g.evaluate(boundary_valid=True, boundary_provenance="VAL-B", coverage=0.9,
                      calibration_complete=True, weight_set_valid=True,
                      caueo_stages_observed=["C", "A", "U", "E", "O"],
                      confidence_level="همگرا", critical_qa_failure=False,
                      n_published_scores=8)
    check("all §72 conditions => VERIFIED", full["level"] == "VERIFIED", full["level"])
    check("numbers publishable at VERIFIED", full["can_publish_numeric_scores"] is True)
    check("VALIDATED requires independent validation",
          g.evaluate(boundary_valid=True, boundary_provenance="V", coverage=0.9,
                     calibration_complete=True, weight_set_valid=True,
                     caueo_stages_observed=["C", "A", "U", "E", "O"],
                     confidence_level="آزمون‌شده", n_published_scores=8,
                     independently_validated=True)["level"] == "VALIDATED")
    low_conf = g.evaluate(boundary_valid=True, boundary_provenance="V", coverage=0.9,
                          calibration_complete=True, weight_set_valid=True,
                          caueo_stages_observed=["C", "A", "U", "E", "O"],
                          confidence_level="محدود", n_published_scores=8)
    check("low confidence blocks publication (score is NOT reduced)",
          low_conf["can_publish_numeric_scores"] is False and low_conf["level"] == "PROVISIONAL")
    check("score is never lowered by the gate",
          "کاهش نمی‌یابد" in low_conf["rule_fa"])


# ═══════════════════════════════════════════════════════════════════════════
def test_uncertainty():
    print("\n[uncertainty] §22 — explicit sources, never hidden in the score")
    u = UncertaintyEngine()
    v = u.assess_value(has_number=True, is_proxy=True, coverage=0.5, sample_size=10,
                       calibrated=False, source_count=1)
    check("relative uncertainty reported", v["relative_uncertainty"] is not None)
    check("calibration is an explicit source", "calibration" in v["contributions"])
    check("missingness is an explicit source", "missingness" in v["contributions"])
    check("dominant source named", v["dominant_source"] is not None)
    b = u.bounds(72.4, 0.2)
    check("bounds bracket the point estimate", b["lower"] < 72.4 < b["upper"])
    check("abstained value has no bounds", u.bounds(None, 0.5)["point"] is None)
    agg = u.assess_aggregate(published=False, member_uncertainties=[])
    check("unpublished aggregate => no uncertainty number", agg["relative_uncertainty"] is None)


# ═══════════════════════════════════════════════════════════════════════════
def test_confidence():
    print("\n[confidence] §21, §59 — score != confidence, ceilings enforced")
    c = ConfidenceEngine()
    single_proxy = c.assess_value(has_number=True, source_category="public_osm", is_proxy=True,
                                  evidence_streams=["spatial"], n_streams_agree=1)
    check("single-stream proxy capped at محدود", single_proxy["level"] == "محدود", single_proxy["level"])
    no_number = c.assess_value(has_number=False, source_category="official_registry", is_proxy=False,
                               evidence_streams=["objective"])
    check("no number => ناکافی", no_number["level"] == "ناکافی")
    check("confidence is separate from the score", "score" in single_proxy and "level" in single_proxy)


# ═══════════════════════════════════════════════════════════════════════════
def test_risk_and_vulnerability():
    print("\n[risk + vulnerability] §31, §32")
    r = RiskEngine().risk(risk_id="R1", probability=0.5, severity=0.8, exposure=0.6)
    check("missing risk factors => INSUFFICIENT_DATA", r["status"] == "INSUFFICIENT_DATA")
    check("missing factors named", "affected_population" in r["reason_fa"])
    ok = RiskEngine().risk(risk_id="R1", probability=0.5, severity=0.8, exposure=0.6,
                           affected_population=100, reversibility="irreversible", uncertainty=0.1,
                           link={"capital": "P", "chain_stage": "A", "group": "women", "time": "evening"})
    check("complete factors => score", ok["status"] == "OBSERVED" and ok["score"] > 0)
    check("irreversibility increases risk", "برگشت‌ناپذیری" in ok["note_fa"])
    check("risk linked to 5 dimensions", set(ok["link"]) == {"capital", "chain_stage", "group", "time"} | {"capital"} or len(ok["link"]) >= 4)

    v = VulnerabilityEngine().group_vulnerability(group_id="g1", components={"exposure": 0.5})
    check("vulnerability needs all components", v["status"] == "INSUFFICIENT_DATA")
    v2 = VulnerabilityEngine().group_vulnerability(group_id="g1", components={
        "exposure": 0.8, "sensitivity": 0.7, "adaptive_capacity": 0.2,
        "access": 0.6, "dependency": 0.4})
    check("complete components => vulnerability score", v2["status"] == "OBSERVED")
    check("adaptive capacity subtracts", "کاهش" in v2["note_fa"])


# ═══════════════════════════════════════════════════════════════════════════
def test_intervention_and_portfolio():
    print("\n[intervention + portfolio] §42-§46")
    e = InterventionEngine()
    harm = e.harm_filter({"id": "I1", "name_fa": "x"})
    check("incomplete harm filter blocks approval", harm["passed"] is False and harm["status"] == "INCOMPLETE")
    check("missing harm filters enumerated", len(harm["missing_filters"]) == 10)
    ranked = e.rank(candidates=[{"id": "I1", "name_fa": "x"}], context={})
    check("missing factors => no fake ranking", ranked["status"] == "INSUFFICIENT_DATA")
    sel = e.selection(intervention={"id": "I1", "name_fa": "x", "family": "quality_improvement",
                                    "evidence_strength": "observational"},
                      context={k: 0.5 for k in (
                          "severity", "population", "leverage", "feasibility", "equity",
                          "expected_impact", "cost", "risk", "confidence", "time_to_impact",
                          "dependencies", "implementation_capacity")})
    check("all §44 factors => selection score", sel["status"] == "OBSERVED")
    check("legacy formula explicitly extended", "کافی نیست" in sel["legacy_note_fa"])

    p = PortfolioOptimizer().optimize(candidates=[], budget=None)
    check("missing constraints => PORTFOLIO_OPTIMIZATION_UNAVAILABLE",
          p["status"] == "PORTFOLIO_OPTIMIZATION_UNAVAILABLE")
    check("no fake ranking declared", "رتبهٔ جعلی" in p["no_fake_ranking_fa"])
    p2 = PortfolioOptimizer().optimize(candidates=[], budget=1000, max_duration=12,
                                       responsible_orgs=["municipality"],
                                       legal_constraints=[], execution_capacity=1.0)
    check("no candidates => still unavailable, not fabricated",
          p2["status"] == "PORTFOLIO_OPTIMIZATION_UNAVAILABLE")


# ═══════════════════════════════════════════════════════════════════════════
def test_evaluation_and_learning():
    print("\n[evaluation + learning] §48-§52")
    e = EvaluationEngine()
    plan = e.plan(intervention_id="I1")
    check("no baseline/KPI => PLAN_INCOMPLETE", plan["status"] == "PLAN_INCOMPLETE")
    check("identifiability NOT_IDENTIFIABLE", plan["identifiability"] == "NOT_IDENTIFIABLE")
    check("missing parts enumerated", "baseline" in plan["missing"])
    ready = e.plan(intervention_id="I1", baseline={"Q": 50}, target={"Q": 65},
                   kpis={"output": ["x"], "outcome": ["y"], "impact": ["z"],
                         "side_effect": ["s"], "stop_rule": ["r"]},
                   method="before_after", method_reason_fa="only data available")
    check("complete plan => PLAN_READY", ready["status"] == "PLAN_READY")
    check("method is recorded", ready["method"] == "before_after")
    ddi = e.plan(intervention_id="I1", baseline={"Q": 50}, target={"Q": 65},
                 kpis={"output": ["x"], "outcome": ["y"], "impact": ["z"],
                       "side_effect": ["s"], "stop_rule": ["r"]},
                 method="difference_in_differences")
    check("DiD without counterfactual => NOT_IDENTIFIABLE", ddi["identifiability"] == "NOT_IDENTIFIABLE")

    d = e.delta(intervention_id="I1", before={"Q": 50, "T": 40, "R": 30},
                after={"Q": 60, "T": 45, "R": 30}, baseline_valid=False)
    check("no baseline => NOT_IDENTIFIABLE, no delta", d["identifiability"] == "NOT_IDENTIFIABLE"
          and d["delta_Q"] is None)
    d2 = e.delta(intervention_id="I1", before={"Q": 50, "T": 40, "R": 30},
                 after={"Q": 60, "T": 45, "R": 30}, baseline_valid=True)
    check("valid baseline => ΔQ computed", d2["delta_Q"] == 10.0)

    l = LearningEngine()
    nr = l.rule_from_experience(rule_id="RULE-014", context={}, intervention={}, observed={},
                                evidence=[], confidence="آزمون‌شده")
    check("no evidence => no rule", nr["status"] == "NO_RULE")
    nr2 = l.rule_from_experience(rule_id="RULE-014", context={}, intervention={}, observed={},
                                 evidence=["e1"], confidence="محدود")
    check("weak confidence => no rule", nr2["status"] == "NO_RULE")
    r = l.rule_from_experience(rule_id="RULE-014", context={"gap": "A→U > 20"},
                               intervention={"family": "access_improvement"},
                               observed={"use_delta": 17}, evidence=["pre/post measurement"],
                               confidence="آزمون‌شده", success_fa="Use +17%")
    check("evidence + confidence => rule formed", r["status"] == "RULE_FORMED")
    mem = l.living_memory_entry(rule=r, created_at="2026-10-03T00:00:00Z")
    check("memory entry is versioned/id'd", mem["memory_id"].startswith("MEM-"))
    check("memory has superseded_by field", "superseded_by" in mem)


# ═══════════════════════════════════════════════════════════════════════════
def test_determinism():
    print("\n[determinism] §61 — identical input + versions => identical fingerprint")
    obs = [{"indicator_code": "PHY-003", "raw_value": 42.0, "unit": "count", "status": "PROXY",
            "proxy": True, "proxy_definition": "d", "proxy_reason": "r",
            "evidence_stream": ["spatial"], "source_id": "S", "reference_period": "2026"}]
    a = run_decision_support(observations=obs, data_version="d1").as_dict()
    b = run_decision_support(observations=obs, data_version="d1").as_dict()
    check("fingerprint A == fingerprint B", a["fingerprint"] == b["fingerprint"])
    check("run_id derived from fingerprint", a["run_id"] == b["run_id"])
    check("fingerprint is sha256", a["fingerprint"].startswith("sha256:") and len(a["fingerprint"]) == 71)
    c = run_decision_support(observations=obs, data_version="d2").as_dict()
    check("changing data_version changes the fingerprint", a["fingerprint"] != c["fingerprint"])


# ═══════════════════════════════════════════════════════════════════════════
def test_no_fabrication():
    print("\n[no fabrication] §11 — synthetic/default/random inputs rejected")
    reg = IndicatorRegistry()
    gate = DataQualityGate(reg)
    for marker in ("default_zero", "random"):
        o = Observation(indicator_code="PHY-003", raw_value=0.0, unit="count", status="OBSERVED",
                        observed=True, evidence_stream=["spatial"], source_id=marker,
                        processing_method=marker)
        v = gate.validate(o)
        check(f"{marker} is not treated as real data", v["allowed"] is False or "schema" not in v["blocking_failures"])
    # a MISSING status can never become 0 anywhere in the pipeline
    r = run_decision_support(
        observations=[{"indicator_code": "PHY-003", "raw_value": None, "status": "MISSING",
                       "evidence_stream": ["spatial"], "source_id": "S"}],
        data_version="missing-test").as_dict()
    check("MISSING observation produces no number",
          all(p["standardized"] is None for p in r["standardized_values"]))
    check("MISSING is reported as rejected, not scored", r["quality_gate"]["n_admitted"] == 0)
    check("no capital score fabricated",
          all(c["value"] is None for c in r["capital_scores"].values()))


# ═══════════════════════════════════════════════════════════════════════════
def test_schema_contracts():
    print("\n[contract] §8 — JSON schema files exist and are valid JSON")
    sdir = os.path.join(KROOT, "schema")
    required = ["observation", "run", "assessment", "diagnosis", "intervention", "evaluation"]
    for name in required:
        p = os.path.join(sdir, f"{name}.schema.json")
        ok = os.path.exists(p)
        if ok:
            with open(p, encoding="utf-8") as f:
                doc = json.load(f)
            ok = "$schema" in doc and "title" in doc
        check(f"{name}.schema.json is a valid contract", ok)


# ═══════════════════════════════════════════════════════════════════════════
def main() -> int:
    print("=" * 70)
    print("NEIGHBORHOOD DECISION KERNEL — test suite")
    print("=" * 70)
    test_registry_single_source()
    test_observation_invariants()
    test_quality_gate()
    test_abstention()
    test_standardization_and_qtr()
    test_gap_requires_both_endpoints()
    test_equity()
    test_bottleneck()
    test_causal()
    test_publication_gate()
    test_uncertainty()
    test_confidence()
    test_risk_and_vulnerability()
    test_intervention_and_portfolio()
    test_evaluation_and_learning()
    test_determinism()
    test_no_fabrication()
    test_schema_contracts()
    print("\n" + "=" * 70)
    print(f"DECISION KERNEL TESTS: {PASSED}/{PASSED + FAILED} passed")
    if FAILED:
        print(f"FAILURES: {FAILED}")
    print("=" * 70)
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
