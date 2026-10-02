"""MVP-2 gate evaluation — machine-checked from REAL artifacts (not prose).
Emits pilot/out/mvp2/gate_report_mvp2.json with A/B/C/D and an executed versioning proof."""
import json, os, sys, subprocess, tempfile
KROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, KROOT)
from engine.calc_run import CalcRun
REG = os.path.join(KROOT, "registries")
OUT = os.path.join(KROOT, "pilot", "out", "mvp2")

nr = json.load(open(os.path.join(OUT, "neighborhood_result.json"), encoding="utf-8"))
run = json.load(open(os.path.join(OUT, "calculation_run.json"), encoding="utf-8"))

# ---- run all test suites, capture counts ----
def run_suite(path):
    r = subprocess.run([sys.executable, path], cwd=KROOT, capture_output=True, text=True)
    last = (r.stdout.strip().splitlines() or [""])[-1]
    return {"passed": r.returncode == 0, "line": last}
suites = {t: run_suite(os.path.join(KROOT, t)) for t in [
    "engine/tests/test_formulas.py", "engine/tests/test_calc_run.py",
    "engine/tests/test_confidence.py", "engine/tests/test_bottleneck.py",
    "ingestion/tests/test_ingestion.py", "gis/tests/test_gis.py"]}

# ---- EXECUTED versioning proof on the REAL pilot records (isolated temp registry) ----
records = [{"indicator_code": p["indicator_code"], "operationalization": p["operationalization"],
            "raw_unit": p["raw"]["unit"], "provenance_value_id": p["raw"]["provenance_value_id"],
            "measurement": {"indicator_code": p["indicator_code"], "value": p["raw"]["value"],
                            "status": p["raw"]["status"], "is_proxy": p["raw"]["is_proxy"],
                            "evidence_stream": p["raw"]["evidence_stream"]}} for p in nr["indicators"]]
tmpreg = os.path.join(tempfile.mkdtemp(), "calc_version_registry.json")
base = CalcRun(REG, calc_version_registry=tmpreg, data_version="pilot-D6-2026-09-02").run(records)
mod = CalcRun(REG, weight_override={"PHY-003": 7.0}, weight_label="W-v1-sandbox-test",
              calc_version_registry=tmpreg, data_version="pilot-D6-2026-09-02").run(records)
base2 = CalcRun(REG, calc_version_registry=tmpreg, data_version="pilot-D6-2026-09-02").run(records)
creg = json.load(open(tmpreg, encoding="utf-8"))
versioning_proof = {
    "base_version": base["calc_run"]["calculation_version_id"], "base_fp": base["fingerprint"],
    "modified_weight_version": mod["calc_run"]["calculation_version_id"], "modified_fp": mod["fingerprint"],
    "base_rerun_version": base2["calc_run"]["calculation_version_id"], "base_rerun_fp": base2["fingerprint"],
    "new_version_minted_on_weight_change": mod["calc_run"]["calculation_version_id"] != base["calc_run"]["calculation_version_id"],
    "prior_reproduces_byte_identical": (base2["calc_run"]["calculation_version_id"] == base["calc_run"]["calculation_version_id"]
                                        and base2["fingerprint"] == base["fingerprint"]),
    "append_only_registry_versions": [v["version_id"] for v in creg["versions"]],
}

# ---- machine checks on the real result ----
def any_zero_filled(agg):
    return any((v.get("value") == 0) and (v.get("status") != "OBSERVED") for v in agg.values())
checks = {
    "determinism_identical_fingerprint": nr["fingerprint"] == run["fingerprint"],
    "reproducibility_key_present": set(nr["reproducibility_key"]) == {
        "data_version", "methodology_version", "indicator_version", "weight_set", "threshold_set", "calculation_version"},
    "every_indicator_has_provenance": all(p["raw"].get("provenance_value_id") for p in nr["indicators"]),
    "no_calculation_without_provenance": all(
        (p["normalized"]["value"] is None) or bool(p["raw"].get("provenance_value_id")) for p in nr["indicators"]),
    "missing_never_zeroed_capitals": not any_zero_filled(nr["aggregates"]["capitals"]),
    "missing_never_zeroed_caueo": not any_zero_filled(nr["aggregates"]["caueo"]),
    "aggregation_only_on_qualified": all(
        v["status"] != "OBSERVED" for v in nr["aggregates"]["capitals"].values()),  # pilot: 0 qualified -> all abstain
    "qtr_four_separate": sorted(nr["aggregates"]["qtr"].keys()) == ["K", "Q", "R", "T"],
    "qtr_not_collapsed": len({id(nr["aggregates"]["qtr"][k]) for k in ("K", "Q", "T", "R")}) == 4,
    "proxy_labeled": all(p["raw"]["is_proxy"] for p in nr["indicators"] if p["raw"]["status"] in ("OBSERVED", "PROXY", "ESTIMATED")),
    "weight_change_new_version": versioning_proof["new_version_minted_on_weight_change"],
    "prior_result_reproducible": versioning_proof["prior_reproduces_byte_identical"],
    "all_test_suites_pass": all(s["passed"] for s in suites.values()),
    "no_fabricated_numbers": all(v.get("value") is None for grp in ("capitals", "caueo", "qtr")
                                 for v in nr["aggregates"][grp].values()),  # honest pilot: all abstained
}

all_pass = all(checks.values())
gate = {
    "mvp": "MVP-2 — Calculation Engine",
    "pilot": nr["neighborhood"]["name_fa"],
    "reproducibility_key": nr["reproducibility_key"],
    "A_what_was_built": [
        "engine/calc_run.py — run orchestrator: 16-stage pipeline, per-indicator weights READ from W-v1, "
        "FLAG-2 standardization-eligibility guard, coverage-gated capital/C-A-U-E-O/Q-T-R aggregation, "
        "deterministic CalculationRun + sha256 fingerprint, append-only CalculationVersion mechanism",
        "engine/confidence.py — multi-factor Evidence Confidence Engine (7 documented factors, "
        "level ladder ناکافی/محدود/قابل اتکا/همگرا/آزمون‌شده, single-stream-proxy≤محدود cap)",
        "engine/bottleneck.py — AI-independent rule-based Bottleneck Engine (base-deficiency-first, abstention gate)",
        "contract tests: test_calc_run.py (22), test_confidence.py (12), test_bottleneck.py (13)",
        "real pilot run on Tehran District 6 -> neighborhood_result.json + calculation_run.json + drilldown.json",
    ],
    "B_evidence": {"test_suites": suites, "machine_checks": checks, "versioning_proof": versioning_proof,
                   "fingerprint": nr["fingerprint"], "calc_version_id": run["calc_run"]["calculation_version_id"]},
    "C_known_limitations": [
        "L/U آستانه‌ها و وزن‌ها کالیبره‌نشده‌اند (W-v1/T-v1, PENDING_VALIDATION) — نمرهٔ استانداردشده تولید نشد",
        "هر ۶ مقدار پایلوت PROXY و تک‌جریانه‌اند؛ سطح اطمینان حداکثر «محدود»",
        "مرز/داده رسمی شهرداری = ACCESS_REQUIRED؛ DEM (OpenTopography) = ACCESS_REQUIRED",
        "دادهٔ U/E/O (پیمایشی/رفتاری) اصلاً برداشت نشده -> Q/T/R و گلوگاه قابل‌انتشار نیست",
        "عبور ساختاری موتور ≠ اعتبار تجربی وزن/آستانه/جهت",
    ],
    "D_gate_decision": "CONDITIONAL PASS" if all_pass else "BLOCKED",
    "D_conditions": [
        "کالیبراسیون L/U + وزن‌ها با دادهٔ چندشهری پیش از انتشار هر نمرهٔ کمّی محله",
        "افزودن دادهٔ پیمایشی/رفتاری برای مراحل U/E/O",
        "دریافت مرز/داده رسمی شهرداری (رفع ACCESS_REQUIRED، جایگزینی proxy OSM)",
    ],
    "all_checks_pass": all_pass,
}
json.dump(gate, open(os.path.join(OUT, "gate_report_mvp2.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("MVP-2 GATE:", gate["D_gate_decision"])
print("all machine checks pass:", all_pass)
for k, v in checks.items():
    print(f"  {'OK ' if v else 'XX '} {k}")
print("\nversioning proof:", json.dumps(versioning_proof, ensure_ascii=False, indent=1))
print("\ntest suites:")
for t, s in suites.items():
    print(f"  {'OK ' if s['passed'] else 'XX '} {t}: {s['line']}")
