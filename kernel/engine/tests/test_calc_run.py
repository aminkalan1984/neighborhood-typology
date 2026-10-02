"""
CONTRACT tests for the MVP-2 calculation run-orchestrator (engine/calc_run.py).

All inputs here are SYNTHETIC, HAND-COMPUTABLE FIXTURES built to prove the engine math and
the run mechanics. They are labelled FIXTURE_* and written to a throwaway temp registries
dir. They are NEVER presented as a real neighborhood result (algo.txt permits structural
contract fixtures for testing; constraint 1).
"""
import json, os, sys, tempfile, shutil, copy
KROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, KROOT)
from engine.calc_run import CalcRun, WeightSet, mint_calculation_version, sha
from engine.calc_engine import Engine

passed = 0; total = 0
def check(name, cond):
    global passed, total
    total += 1
    print(("PASS " if cond else "FAIL ") + name)
    if cond: passed += 1
    else: print("   ^^^ FAILED")

# ---------- build a synthetic fixture registries dir ----------
def build_fixture_registries():
    d = tempfile.mkdtemp(prefix="FIXTURE_registries_")
    # threshold registry with CALIBRATED fixture indicators (so the math can be exercised)
    thr = {
        "version": "T-FIXTURE", "calibrated": True, "status": "FIXTURE",
        "status_bands": [{"lo": 0, "hi": 39, "label_fa": "بحرانی", "action_fa": "x"},
                         {"lo": 40, "hi": 59, "label_fa": "ضعیف", "action_fa": "x"},
                         {"lo": 60, "hi": 74, "label_fa": "متوسط", "action_fa": "x"},
                         {"lo": 75, "hi": 89, "label_fa": "خوب", "action_fa": "x"},
                         {"lo": 90, "hi": 100, "label_fa": "ممتاز", "action_fa": "x"}],
        "indicator_LU": {
            "FX-POS": {"L": 0.0, "U": 200.0, "lu_status": "CALIBRATED", "direction": "مستقیم (بیشتر=بهتر)"},
            "FX-INV": {"L": 0.0, "U": 100.0, "lu_status": "CALIBRATED", "direction": "معکوس (کمتر=بهتر)"},
            "FX-A1": {"L": 0.0, "U": 100.0, "lu_status": "CALIBRATED", "direction": "مستقیم (بیشتر=بهتر)"},
            "FX-A2": {"L": 0.0, "U": 100.0, "lu_status": "CALIBRATED", "direction": "مستقیم (بیشتر=بهتر)"},
            "FX-A3": {"L": 0.0, "U": 100.0, "lu_status": "CALIBRATED", "direction": "مستقیم (بیشتر=بهتر)"},
        }
    }
    json.dump(thr, open(os.path.join(d, "threshold_registry_v1.json"), "w", encoding="utf-8"), ensure_ascii=False)
    wgt = {"version": "W-FIXTURE", "scheme": "equal_v1", "calibrated": False, "status": "FIXTURE",
           "active_weights": "equal", "reference_only_atlas_coefficients": {}, "audit_trail": []}
    json.dump(wgt, open(os.path.join(d, "weight_registry_v1.json"), "w", encoding="utf-8"), ensure_ascii=False)

    def row(code, cap, cap_name, stage, target, direction="مستقیم (بیشتر=بهتر)"):
        return {"کد": code, "سرمایه اصلی": cap_name, "کد سرمایه": cap,
                "مرحله C-A-U-E-O": stage, "هدف K/Q/T/R": target, "جهت": direction,
                "عنوان شاخص": "FIXTURE " + code, "واحد اصلی": "امتیاز شاخص",
                "محدوده نظری": "بدون‌واحدِ درصدی"}
    recs = [
        row("FX-POS", "FXP", "FIXTURE-Physical", "A — دسترسی", "Q"),
        row("FX-INV", "FXP", "FIXTURE-Physical", "A — دسترسی", "Q", "معکوس (کمتر=بهتر)"),
        row("FX-A1", "FXP", "FIXTURE-Physical", "A — دسترسی", "Q"),
        row("FX-A2", "FXN", "FIXTURE-Nature", "C — ظرفیت", "T"),
        row("FX-A3", "FXR", "FIXTURE-Network", "U — استفاده", "R"),
    ]
    reg = {"layer": "FIXTURE", "code_field": "کد", "headers": list(recs[0].keys()),
           "count": len(recs), "records": recs}
    json.dump(reg, open(os.path.join(d, "registry_419.json"), "w", encoding="utf-8"), ensure_ascii=False)
    onl = {"layer": "FIXTURE", "code_field": "کد", "headers": ["کد"], "count": 0, "records": []}
    json.dump(onl, open(os.path.join(d, "online_83.json"), "w", encoding="utf-8"), ensure_ascii=False)
    return d

FX = build_fixture_registries()

def mk_rec(code, value, status="OBSERVED", unit="score_index", op=None, proxy=False, stream=None):
    return {"indicator_code": code, "operationalization": op, "raw_unit": unit,
            "provenance_value_id": "FIXTURE-VAL",
            "measurement": {"indicator_code": code, "value": value, "status": status,
                            "is_proxy": proxy, "evidence_stream": stream or ["objective"]}}

# ============ (b) positive vs inverse normalization ============
cr = CalcRun(FX, calc_version_registry=os.path.join(FX, "calc_version_registry.json"))
zpos = cr.normalize_record(mk_rec("FX-POS", 50.0))     # 100*(50-0)/(200-0)=25.0
zinv = cr.normalize_record(mk_rec("FX-INV", 30.0))     # 100*(100-30)/(100-0)=70.0
check("(b) positive normalization FX-POS x=50 -> 25.0",
      zpos["eligible"] and abs(zpos["normalized"]["value"] - 25.0) < 1e-9)
check("(b) inverse normalization FX-INV x=30 -> 70.0",
      zinv["eligible"] and abs(zinv["normalized"]["value"] - 70.0) < 1e-9)
check("(b) direction never silently flipped (engine.direction_of)",
      cr.engine.direction_of("معکوس (کمتر=بهتر)") == "inverse" and
      cr.engine.direction_of("مستقیم (بیشتر=بهتر)") == "positive")

# ============ (c) missing indicator EXCLUDED from Kj, not zeroed ============
recs_c = [
    {"indicator_code": "FX-A1", "normalized": {"status": "OBSERVED", "value": 40.0}},
    {"indicator_code": "FX-A2", "normalized": {"status": "OBSERVED", "value": 60.0}},
    {"indicator_code": "FX-A3", "normalized": {"status": "MISSING", "value": None}},
]
agg_c = cr._aggregate("K[FXP]", "Kj=Sum(w*Z)/Sum(w)", recs_c, denominator=3, versions={})
check("(c) missing EXCLUDED not zeroed: Kj=(40+60)/2=50.0 (NOT 33.3)",
      agg_c["value"] == 50.0)
check("(c) coverage_detail counts only qualified (n_qualified=2)",
      agg_c["coverage_detail"]["n_qualified"] == 2 and agg_c["coverage_detail"]["n_registry"] == 3)
check("(c) missing record value stays None (never coerced to 0)",
      recs_c[2]["normalized"]["value"] is None)

# ============ (d) Kj = Sum(w*Z)/Sum(w) exact, incl weighted ============
recs_d = [{"indicator_code": "FX-A1", "normalized": {"status": "OBSERVED", "value": 20.0}},
          {"indicator_code": "FX-A2", "normalized": {"status": "OBSERVED", "value": 40.0}},
          {"indicator_code": "FX-A3", "normalized": {"status": "OBSERVED", "value": 60.0}}]
agg_d = cr._aggregate("K", "Kj", recs_d, denominator=3, versions={})
check("(d) equal-weight Kj=(20+40+60)/3=40.0", agg_d["value"] == 40.0)
cr_w = CalcRun(FX, weight_override={"FX-A3": 3.0}, weight_label="W-FIXTURE-mod",
               calc_version_registry=os.path.join(FX, "calc_version_registry.json"))
agg_dw = cr_w._aggregate("K", "Kj", recs_d, denominator=3, versions={})
# (20*1+40*1+60*3)/(1+1+3) = (20+40+180)/5 = 240/5 = 48.0
check("(d) weighted Kj with w(FX-A3)=3 -> 48.0", agg_dw["value"] == 48.0)

# ============ (e) coverage below threshold -> INSUFFICIENT_COVERAGE (no number) ============
recs_e = [{"indicator_code": "FX-A1", "normalized": {"status": "OBSERVED", "value": 80.0}}]
agg_e = cr._aggregate("K[FXP]", "Kj", recs_e, denominator=10, versions={})
check("(e) coverage 1/10=10% < 50% -> INSUFFICIENT_COVERAGE",
      agg_e["status"] == "INSUFFICIENT_COVERAGE" and agg_e["value"] is None)

# ============ (a),(f),(g) via full pipeline on the fixture ============
records = [mk_rec("FX-POS", 50.0), mk_rec("FX-INV", 30.0), mk_rec("FX-A1", 90.0),
           mk_rec("FX-A2", 70.0), mk_rec("FX-A3", 55.0)]
run1 = cr.run(records)
run1b = cr.run(records)
check("(a) full pipeline deterministic (identical fingerprint on re-run)",
      run1["fingerprint"] == run1b["fingerprint"])

qtr = run1["aggregates"]["qtr"]
check("(f) qtr returns FOUR SEPARATE keys K,Q,T,R",
      set(qtr.keys()) == {"K", "Q", "T", "R"})
check("(f) Q,T,R are distinct Result objects (not one composite)",
      qtr["Q"] is not qtr["T"] and qtr["T"] is not qtr["R"] and
      all("value" in qtr[k] and "status" in qtr[k] for k in ("K", "Q", "T", "R")))

# (g) weight change -> NEW calc version + prior reproduces byte-identical
reg_path = os.path.join(FX, "calc_version_registry.json")
cr_base = CalcRun(FX, calc_version_registry=reg_path)
r_base = cr_base.run(records)
v_base = r_base["calc_run"]["calculation_version_id"]; fp_base = r_base["fingerprint"]
cr_mod = CalcRun(FX, weight_override={"FX-A3": 5.0}, weight_label="W-FIXTURE-mod", calc_version_registry=reg_path)
r_mod = cr_mod.run(records)
v_mod = r_mod["calc_run"]["calculation_version_id"]; fp_mod = r_mod["fingerprint"]
cr_base2 = CalcRun(FX, calc_version_registry=reg_path)
r_base2 = cr_base2.run(records)
v_base2 = r_base2["calc_run"]["calculation_version_id"]; fp_base2 = r_base2["fingerprint"]
check("(g) weight change mints a DIFFERENT CalculationVersion", v_mod != v_base)
check("(g) prior version reproduces byte-identical (same id + same fingerprint)",
      v_base2 == v_base and fp_base2 == fp_base)
creg = json.load(open(reg_path, encoding="utf-8"))
known = {v["version_id"] for v in creg["versions"]}
check("(g) append-only registry preserves BOTH versions", v_base in known and v_mod in known)

# ============ (h) chain_gaps, equity_gap, priority formulas ============
eng = cr.engine
cg = eng.chain_gaps(80.0, 60.0, 50.0, 45.0, 30.0)
check("(h) chain gap G_CA = C-A = 80-60 = 20", cg["G_CA"].value == 20.0)
check("(h) chain gap G_EO = E-O = 45-30 = 15", cg["G_EO"].value == 15.0)
eqg = eng.equity_gap({"g1": 70.0, "g2": 40.0, "g3": 55.0})
check("(h) equity_gap = P_best-P_worst = 70-40 = 30", eqg.value == 30.0)
pri = eng.priority(2.0, 3.0, 1.0, 1.0, 1.0)
check("(h) priority = S*P*L*F*E = 2*3*1*1*1 = 6", pri.value == 6.0)
eqg_ins = eng.equity_gap({"only": 50.0})
check("(h) equity refuses with <2 groups -> INSUFFICIENT_COVERAGE",
      eqg_ins.status == "INSUFFICIENT_COVERAGE" and eqg_ins.value is None)

# ============ integrity: no hard-coded numbers (weights/thresholds read from registry) ============
check("integrity: WeightSet reads version from registry (W-FIXTURE)", cr.weights.version == "W-FIXTURE")
check("integrity: thresholds read from registry (T-FIXTURE)", cr.thr_version == "T-FIXTURE")

shutil.rmtree(FX, ignore_errors=True)
print(f"\nCALC_RUN CONTRACT TESTS: {passed}/{total} passed")
sys.exit(0 if passed == total else 1)
