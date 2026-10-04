# -*- coding: utf-8 -*-
"""
End-to-end test of the canonical Decision Support API (§63, §64).

Boots the kernel service on a test port and exercises every route in the
documented API surface, asserting the abstention and determinism contracts.

Run:  python kernel/service/test_decision_support_api.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

PORT = int(os.environ.get("DS_API_TEST_PORT", "4187"))
BASE = f"http://127.0.0.1:{PORT}"
HERE = os.path.dirname(os.path.abspath(__file__))
SERVICE = os.path.join(HERE, "kernel_service.py")

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


def req(method: str, path: str, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def main() -> int:
    env = dict(os.environ)
    env["KERNEL_SERVICE_PORT"] = str(PORT)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    proc = subprocess.Popen([sys.executable, "-X", "utf8", SERVICE], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ready = False
        for _ in range(50):
            try:
                if req("GET", "/v1/health")[0] == 200:
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(0.4)
        check("kernel service became healthy", ready)
        if not ready:
            return 1

        print("\n[registries] §7 single master registry")
        st, r = req("GET", "/v1/decision-support/registries")
        check("GET registries 200", st == 200, str(st))
        check("single master registry served",
              r["indicator_registry"]["file"] == "indicator_registry.json")
        check("unmapped codes declared honestly",
              len(r["indicator_registry"]["unmapped_codes"]) == 40,
              str(len(r["indicator_registry"]["unmapped_codes"])))
        check("calibration state exposed",
              r["indicator_registry"]["calibration"]["calibrated"] is False)

        print("\n[sources] §54 six-tier source architecture")
        st, r = req("GET", "/v1/decision-support/sources")
        check("GET sources 200", st == 200, str(st))
        check("OSM placed as auxiliary, not authoritative",
              "OSM" in r["source_registry"]["note_fa"])
        check("six tiers declared", len(r["source_registry"]["tiers"]) == 6)

        print("\n[observations] §9, §10, §12")
        st, r = req("POST", "/v1/decision-support/observations", {"observations": [
            {"indicator_code": "PHY-003", "raw_value": 0, "status": "MISSING",
             "evidence_stream": ["spatial"]}]})
        check("missing != zero is refused at the API (422)", st == 422, str(st))

        st, r = req("POST", "/v1/decision-support/observations", {"observations": [
            {"indicator_code": "PHY-003", "raw_value": None, "status": "ACCESS_REQUIRED",
             "evidence_stream": ["spatial"]}]})
        check("valid observation accepted", st == 200 and r["accepted"] is True, str(st))
        check("registering an observation produces no score",
              "عدد فقط از اجرای Kernel" in r["note_fa"])

        st, r = req("POST", "/v1/decision-support/observations", {"observations": []})
        check("empty observation list refused", st == 422)

        print("\n[runs] §62, §63 — one entry point")
        unit = "درصد جمعیت در آستانه؛ دقیقه/متر (کمکی)"
        obs = [{"indicator_code": "PHY-003", "raw_value": 50.0, "unit": unit,
                "status": "PROXY", "proxy": True, "proxy_definition": "d",
                "proxy_reason": "r", "evidence_stream": ["spatial"],
                "source_id": "SRC-1", "reference_period": "2026"}]
        st, run = req("POST", "/v1/decision-support/runs",
                      {"observations": obs, "data_version": "api-test"})
        check("POST runs 200", st == 200, str(st))
        run_id = run["run_id"]
        check("fingerprint is sha256", run["fingerprint"].startswith("sha256:"))
        check("pipeline declares its single entry point",
              run["engine"]["entry_point"] == "kernel.engine.pipeline.run_decision_support")
        check("uncalibrated L/U => numbers blocked",
              run["publication_gate"]["can_publish_numeric_scores"] is False)
        check("decision withheld", run["publication_gate"]["decision_withheld"] is True)
        check("gate lists what would unblock",
              len(run["publication_gate"]["what_would_unblock"]) > 0)

        print("\n[run sections] §63")
        st, a = req("GET", f"/v1/decision-support/runs/{run_id}/assessment")
        check("GET assessment 200", st == 200, str(st))
        check("assessment carries capitals + caueo + qtr",
              all(k in a["data"] for k in ("capital_scores", "caueo", "qtr")))
        check("score and confidence are separate",
              "confidence" in a["data"] and "uncertainty" in a["data"])

        st, d = req("GET", f"/v1/decision-support/runs/{run_id}/diagnosis")
        check("GET diagnosis 200", st == 200, str(st))
        check("bottleneck abstains honestly",
              d["data"]["bottleneck"]["status"] == "NO_BOTTLENECK_DETERMINABLE")
        check("causal diagnosis abstains without a gap",
              d["data"]["causal_diagnosis"]["status"] == "NOT_ASSESSED")

        st, i = req("GET", f"/v1/decision-support/runs/{run_id}/interventions")
        check("GET interventions 200", st == 200, str(st))
        check("portfolio abstains rather than faking a ranking",
              i["data"]["intervention_portfolio"]["status"] == "PORTFOLIO_OPTIMIZATION_UNAVAILABLE")

        st, e = req("GET", f"/v1/decision-support/runs/{run_id}/evaluation")
        check("GET evaluation 200", st == 200, str(st))
        check("evaluation is NOT_IDENTIFIABLE without a baseline",
              e["data"]["evaluation_plan"]["identifiability"] == "NOT_IDENTIFIABLE")

        print("\n[drill-down] §74")
        oid = run["standardized_values"][0]["observation_id"]
        st, dd = req("GET", f"/v1/decision-support/runs/{run_id}/drilldown/{oid}")
        check("GET drilldown 200", st == 200, str(st))
        levels = [c["level"] for c in dd["chain"]]
        check("drill-down walks Q -> capital -> indicator -> standardized -> raw -> observation -> source -> method -> version",
              all(l in levels for l in ("qtr", "capital", "indicator", "standardized",
                                        "raw_value", "observation", "source", "method", "version")),
              str(levels))
        st, dd2 = req("GET", f"/v1/decision-support/runs/{run_id}/drilldown/NOPE")
        check("unknown observation => 404", st == 404, str(st))

        print("\n[boundary] §14 — no boundary without provenance")
        st, b = req("GET", "/v1/decision-support/neighborhoods/IR-THR-D6/boundary")
        check("boundary route answers 200 (real) or 404 (honest abstention)", st in (200, 404), str(st))
        st, b2 = req("GET", "/v1/decision-support/neighborhoods/DOES-NOT-EXIST/boundary")
        check("unknown neighbourhood => 404, never a fabricated boundary", st == 404, str(st))

        print("\n[determinism] §61")
        st, run2 = req("POST", "/v1/decision-support/runs",
                       {"observations": obs, "data_version": "api-test"})
        check("same input => same fingerprint through the API",
              run["fingerprint"] == run2["fingerprint"])
        st, run3 = req("POST", "/v1/decision-support/runs",
                       {"observations": obs, "data_version": "api-test-2"})
        check("changed data_version => different fingerprint",
              run["fingerprint"] != run3["fingerprint"])

        print("\n[legacy] the pilot CalculationRun path still works")
        st, legacy = req("POST", "/v1/calculation-runs",
                         {"data_version": "legacy-check", "use_pilot_records": True})
        check("legacy /v1/calculation-runs 200", st == 200, str(st))
        check("legacy run abstains on uncalibrated L/U",
              legacy["publish_gate"]["can_publish_numeric_scores"] is False)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()

    print("\n" + "=" * 70)
    print(f"DECISION SUPPORT API TESTS: {PASSED}/{PASSED + FAILED} passed")
    print("=" * 70)
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
