"""
Smoke test — kernel/service/kernel_service.py
Boots the service in-process and exercises every /v1 route against the REAL pilot artifacts.
Run:  python kernel/service/test_kernel_service.py
Prints: KERNEL SERVICE TESTS: N/N passed
"""
import json
import os
import sys
import threading
import urllib.request

# ویندوز: کنسول cp1252 است؛ تست باید با UTF-8 اجرا شود (Known issue در kernel/README)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
KROOT = os.path.dirname(HERE)
sys.path.insert(0, KROOT)
sys.path.insert(0, HERE)

import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "kernel_service", os.path.join(HERE, "kernel_service.py"))
ks = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ks)

from http.server import ThreadingHTTPServer  # noqa: E402

BASE = None
_SERVER = None


def _req(method: str, path: str, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def _start():
    global BASE, _SERVER
    _SERVER = ThreadingHTTPServer(("127.0.0.1", 0), ks.Handler)
    threading.Thread(target=_SERVER.serve_forever, daemon=True).start()
    port = _SERVER.server_address[1]
    BASE = f"http://127.0.0.1:{port}"


passed = 0
failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok   {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {detail}")


def main():
    _start()
    print("== kernel service smoke tests ==")

    # ---- health ----
    st, h = _req("GET", "/v1/health")
    check("health 200", st == 200, h)
    check("health lists 16 stages", len(h["engine"]["stages"]) == 16)
    check("health reports gate closed", h["gate_summary"]["numeric_publishing_allowed"] is False)
    check("health pilot gate CONDITIONAL PASS", h["gate_summary"]["pilot_gate_decision"] == "CONDITIONAL PASS")

    # ---- registries ----
    st, r = _req("GET", "/v1/registries")
    check("registries meta 200", st == 200)
    check("weight set W-v1 uncalibrated", r["registries"]["weight_set"]["version"] == "W-v1"
          and r["registries"]["weight_set"]["calibrated"] is False)
    check("threshold set T-v1 uncalibrated", r["registries"]["threshold_set"]["version"] == "T-v1"
          and r["registries"]["threshold_set"]["calibrated" ] is False)

    st, r = _req("GET", "/v1/registries/core_40")
    check("core_40 served", st == 200 and r["registry"] == "core_40")
    st, r = _req("GET", "/v1/registries/registry_419")
    check("registry_419 truncated for responsiveness", st == 200 and r["data"].get("records_truncated") is True)
    st, r = _req("GET", "no-route-check", None) if False else (0, {})
    st, r = _req("GET", "/v1/registries/nope")
    check("unknown registry 404 INVALID_INPUT", st == 404 and r["error"]["code"] == "INVALID_INPUT")

    # ---- boundary ----
    st, b = _req("GET", "/v1/gis/boundaries/IR-THR-D6")
    check("boundary served with proxy label", st == 200 and b["is_proxy"] is True and b["is_official"] is False)
    check("boundary has provenance", bool(b["provenance"]["raw_hash"]))
    check("boundary geometry present", b["geometry_geojson"]["type"] == "Polygon")

    st, b = _req("GET", "/v1/gis/boundaries/UNKNOWN-999")
    check("unknown boundary abstains (no fabrication)", st == 404 and b["error"]["code"] == "SOURCE_UNAVAILABLE")

    # ---- pilot artifacts ----
    st, p = _req("GET", "/v1/pilot/mvp2")
    check("pilot artifacts served", st == 200 and p["gate_report"]["D_gate_decision"] == "CONDITIONAL PASS")
    check("pilot fingerprint present", str(p["neighborhood_result"]["fingerprint"]).startswith("sha256:"))

    # ---- full calculation run on REAL pilot data ----
    st, run = _req("POST", "/v1/calculation-runs", {"data_version": "pilot-D6-2026-09-02", "use_pilot_records": True})
    check("calculation-run 200", st == 200, run.get("error"))
    check("run has fingerprint", str(run.get("fingerprint", "")).startswith("sha256:"))
    check("run has 16-stage engine trace", run["engine"]["count"] == 16)
    check("pilot reproducibility key intact",
          run["reproducibility_key"]["weight_set"] == "W-v1" and run["reproducibility_key"]["threshold_set"] == "T-v1")
    check("gate BLOCKS numeric publishing on uncalibrated pilot",
          run["publish_gate"]["can_publish_numeric_scores"] is False)
    check("gate cites uncalibrated weights",
          any("وزن" in x for x in run["publish_gate"]["reasons"]))

    # determinism: identical input -> identical fingerprint
    st, run2 = _req("POST", "/v1/calculation-runs", {"data_version": "pilot-D CalcRun" and "pilot-D6-2026-09-02", "use_pilot_records": True})
    check("identical input → identical fingerprint (reproducibility)",
          run2["fingerprint"] == run["fingerprint"])

    # ---- drilldown ----
    vid = run["indicators"][0]["raw"]["provenance_value_id"]
    st, dd = _req("GET", f"/v1/calculation-runs/{run['run_id']}/drilldown/{vid}")
    check("drilldown served", st == 200 and dd["drilldown"]["indicator"]["capital"] in ("P", "N", "EC", "S", "C", "H", "G", "R"))
    check("drilldown 10-level chain label present", len(dd["chain_levels"]) == 10)
    check("drilldown confidence attached", bool(dd["drilldown"]["confidence"]))

    st, dd = _req("GET", f"/v1/calculation-runs/{run['run_id']}/drilldown/VAL-99999")
    check("drilldown for unknown value 404", st == 404)

    # ---- weight change mints a NEW calculation version (fingerprint changes) ----
    st, run3 = _req("POST", "/v1/calculation-runs",
                    {"data_version": "pilot-D6-2026-09-02", "use_pilot_records": True,
                     "weight_override": {"PHY-003": 7.0}})
    check("weight change → new fingerprint", run3["fingerprint"] != run["fingerprint"])
    check("weight change → new calculation version id",
          run3["calc_run"]["calculation_version_id"] != run["calc_run"]["calculation_version_id"])

    # ---- ingestion validate (real pipeline incl. registry unit + approval workflow) ----
    st, iv = _req("POST", "/v1/ingestion/validate", {
        "indicator_code": "PHY-001", "raw_value": 42.5,
        "is_proxy": True, "evidence_class": "gis",
        "request_params": {"dataset_id": "smoke", "url": "http://example/park"},
        "data_version": "smoke-dv",
    })
    check("ingestion/validate 200", st == 200, iv.get("error"))
    check("registry unit attached", iv.get("registry_unit") is not None)
    check("proxy record requires manual approval",
          iv["record"]["approval_status"] == "PENDING_APPROVAL")
    check("gate blocks unapproved record", iv["gate"]["allowed"] is False)
    vid2 = iv["record"]["provenance_value_id"]

    # unit mismatch with the registry must be BLOCKING (never silently standardized)
    st, ivu = _req("POST", "/v1/ingestion/validate", {
        "indicator_code": "PHY-001", "raw_value": 42.5, "declared_unit": "count", "data_version": "smoke-dv"})
    check("unit mismatch → INVALID (blocking)", st == 200 and ivu["record"]["measurement"]["status"] == "INVALID",
          ivu.get("record", {}).get("measurement", {}).get("status"))
    check("INVALID record auto-REJECTED", ivu["record"]["approval_status"] == "REJECTED")

    st, iv2 = _req("POST", "/v1/ingestion/validate", {"indicator_code": "PHY-001", "raw_value": "not-a-number"})
    check("non-numeric value flagged INVALID by validators", st == 200 and iv2["record"]["measurement"]["status"] == "INVALID")
    check("INVALID rejected in approval", iv2["record"]["approval_status"] == "REJECTED")

    # ---- ingestion approve: proxy record needs human approval → gate opens for it ----
    st, ap = _req("POST", "/v1/ingestion/approve",
                  {"provenance_value_id": vid2, "decision": "APPROVE",
                   "approver": "smoke-test", "note": "verified against raw file"})
    check("human approval accepted", st == 200 and ap["record"]["approval_status"] == "APPROVED")
    check("approved + usable → gate opens", ap["gate"]["allowed"] is True)

    st, ap3 = _req("POST", "/v1/ingestion/approve", {"provenance_value_id": vid2, "decision": "MAYBE", "approver": "x"})
    check("bad decision 400 INVALID_INPUT", st == 400 and ap3["error"]["code"] == "INVALID_INPUT")

    # ---- boundary POST: provenance guard (constraint 6 — never guess a boundary) ----
    square = {"type": "Polygon", "coordinates": [[[51.0, 35.0], [51.01, 35.0], [51.01, 35.01], [51.0, 35.01], [51.0, 35.0]]]}
    st, bnp = _req("POST", "/v1/gis/boundaries/TEST-N", {"geometry_geojson": square, "crs": "EPSG:4326"})
    check("boundary without provenance REJECTED", st == 422 and bnp["error"]["code"] == "INVALID_INPUT", bnp)

    st, bnp2 = _req("POST", "/v1/gis/boundaries/TEST-N", {
        "geometry_geojson": square, "crs": "EPSG:4326", "is_proxy": True,
        "provenance": {"provenance_ref": "VAL-BOUNDARY-TEST", "source_name": "test OSM extract",
                       "provider": "OpenStreetMap contributors", "dataset_id": "test-rel"}})
    check("boundary with provenance accepted (201)", st == 201 and bnp2["version"]["version_id"] == "v1", bnp2)
    check("boundary version carries provenance ref + hash",
          bnp2["version"]["provenance_ref"] == "VAL-BOUNDARY-TEST" and bnp2["version"]["geometry_hash"].startswith("sha256:"))
    check("boundary provenance value registered", bnp2["provenance_value_id"] == "VAL-BOUNDARY-TEST")

    st, bnp3 = _req("POST", "/v1/gis/boundaries/TEST-N", {
        "geometry_geojson": square, "crs": "EPSG:4326", "is_proxy": True,
        "provenance": {"provenance_ref": "VAL-BOUNDARY-TEST-2"}})
    check("second boundary version is v2 (append-only)", st == 201 and bnp3["version"]["version_id"] == "v2")

    st, bvs = _req("GET", "/v1/gis/boundaries/TEST-N/versions")
    check("boundary versions listed append-only", st == 200 and len(bvs["versions"]) == 2)

    st, bncrs = _req("POST", "/v1/gis/boundaries/TEST-CRS", {
        "geometry_geojson": square, "crs": "", "provenance": {"provenance_ref": "VAL-X"}})
    check("missing CRS rejected", st == 422 and bncrs["error"]["code"] == "INVALID_INPUT")

    # ---- inline provenance: TS-adapter records produce confidence + drilldown ----
    st, inl = _req("POST", "/v1/calculation-runs", {
        "data_version": "ts-adapter-smoke",
        "records": [{
            "indicator_code": "BEH-127", "operationalization": "ts_mapping:H1", "raw_unit": "\u062f\u0631\u0635\u062f",
            "provenance_value_id": "VAL-TS-001",
            "measurement": {"indicator_code": "BEH-127", "value": 72.0, "status": "OBSERVED",
                            "is_proxy": False, "evidence_stream": ["perceptual"]},
            "provenance": {"source_name": "census 1395", "provider": "Statistical Centre of Iran",
                           "formula_id": "share_diploma", "timestamp_acquired": "2025-06-01T00:00:00+00:00",
                           "spatial_scale": "neighborhood", "quality_score": 0.9},
        }],
    })
    check("TS-adapter record accepted by kernel", st == 200 and inl.get("indicators"), inl.get("error"))
    p0 = inl["indicators"][0]
    check("registry metadata attached (capital/stage/title)", p0["capital_code"] == "EC" and p0["title"] != "")
    check("inline confidence assessed", p0["confidence"] is not None and p0["confidence"]["level"] != "")
    check("inline drilldown present", inl["drilldown_index"].get("VAL-TS-001") is not None)
    dd0 = inl["drilldown_index"]["VAL-TS-001"]
    check("inline drilldown cites source", dd0["source"]["source_name"] == "census 1395")

    print(f"\nKERNEL SERVICE TESTS: {passed}/{passed + failed} passed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
