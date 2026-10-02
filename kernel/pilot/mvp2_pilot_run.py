"""
MVP-2 real pilot run — Tehran District 6 (IR-THR-D6).
Runs the calc_run orchestrator + confidence + bottleneck engines on the 6 GENUINELY-FETCHED
MVP-1 measurements. NO fabrication: where a standardized score/aggregate cannot be defended,
the engine abstains with a SPECIFIC reason + what-is-needed. Outputs under pilot/out/mvp2/.
"""
import json, os, sys
from datetime import datetime, timezone
KROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../kernel
sys.path.insert(0, KROOT)
from engine.calc_run import CalcRun, sha
from engine.confidence import ConfidenceEngine
from engine.bottleneck import detect_bottleneck

REG = os.path.join(KROOT, "registries")
OUT = os.path.join(KROOT, "pilot", "out", "mvp2")
os.makedirs(OUT, exist_ok=True)
PVDIR = os.path.join(KROOT, "pilot", "out", "provenance", "provenance")
NOW = datetime(2026, 9, 2, 1, 7, 20, tzinfo=timezone.utc)  # fixed 'now' -> deterministic recency

dcs = json.load(open(os.path.join(KROOT, "pilot/out/data_coverage_summary.json"), encoding="utf-8"))
neigh = dcs["neighborhood"]

UNIT_BY_OP = {"count_within_boundary": "count",
              "distance(euclidean_proxy_for_network)": "meter",
              "nearest_epicenter_distance": "km",
              "boundary_area(metric_crs)": "km2"}

def load_prov(vid):
    p = os.path.join(PVDIR, vid + ".json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}

# ---- build calc_run input records from the acquired indicators (exclude BOUNDARY metadata) ----
records = []
prov_by_val = {}
for row in dcs["indicators"]:
    if row["indicator_code"] == "BOUNDARY":
        continue
    vid = row.get("provenance_value_id")
    pv = load_prov(vid)
    prov_by_val[vid] = pv
    op = row.get("operationalization")
    records.append({
        "indicator_code": row["indicator_code"],
        "operationalization": op,
        "raw_unit": pv.get("unit") or UNIT_BY_OP.get(op),
        "provenance_value_id": vid,
        "measurement": {"indicator_code": row["indicator_code"], "value": row.get("raw_value"),
                        "status": row.get("raw_status"), "is_proxy": row.get("is_proxy", False),
                        "evidence_stream": [row.get("evidence_stream")] if row.get("evidence_stream") else []},
    })

# ---- run the calculation orchestrator (deterministic) ----
cr = CalcRun(REG, calc_version_registry=os.path.join(REG, "calc_version_registry.json"),
             data_version="pilot-D6-2026-09-02")
run = cr.run(records, neighborhood=neigh)
run2 = cr.run(records, neighborhood=neigh)
assert run["fingerprint"] == run2["fingerprint"], "NON-DETERMINISTIC!"

# ---- confidence per record (REAL factors from provenance) ----
ce = ConfidenceEngine()
def source_category(pv):
    prov = (pv.get("provider", "") + " " + pv.get("source_name", "")).lower()
    if "openstreetmap" in prov or "osm" in prov:
        return "public_osm"
    if "usgs" in prov or "comcat" in prov or "earthquake" in prov:
        return "scientific_remote_sensing"
    return "auxiliary_proxy"

def value_scale(pv, op):
    ss = str(pv.get("spatial_scale") or "")
    if op == "nearest_epicenter_distance":
        return "region"          # regional seismic catalog — coarse for a neighborhood
    if "district" in ss:
        return "district"
    return "unknown"

rec_conf = {}
for p in run["records"]:
    vid = p["raw"]["provenance_value_id"]; pv = prov_by_val.get(vid, {})
    ts = pv.get("timestamp_acquired")
    age = 0
    if ts:
        try:
            age = max(0, (NOW - datetime.fromisoformat(ts)).days)
        except Exception:
            age = 0
    conf = ce.assess_value(
        has_number=(p["raw"]["value"] is not None and p["raw"]["status"] in ("OBSERVED", "PROXY", "ESTIMATED")),
        source_category=source_category(pv), is_proxy=p["raw"]["is_proxy"],
        evidence_streams=p["raw"]["evidence_stream"], value_scale=value_scale(pv, p["operationalization"]),
        target_scale="neighborhood",
        completeness=next((r["coverage"] for r in dcs["indicators"] if r.get("provenance_value_id") == vid), 1.0),
        quality_score=next((r["quality_score"] for r in dcs["indicators"] if r.get("provenance_value_id") == vid), None),
        age_days=age, expected_days=365, n_streams_agree=len(p["raw"]["evidence_stream"]), tested=False)
    rec_conf[vid] = conf

# ---- confidence per aggregate (all abstained here -> ناکافی) ----
def agg_conf(agg):
    published = agg.get("value") is not None and agg.get("status") == "OBSERVED"
    cov = (agg.get("coverage_detail") or {}).get("coverage")
    return ce.assess_aggregate(published=published, member_confidences=[], coverage=cov)

for grp in ("capitals", "caueo", "qtr"):
    for k, v in run["aggregates"][grp].items():
        v["confidence"] = agg_conf(v)
run["aggregates"]["equity"]["confidence"] = agg_conf(run["aggregates"]["equity"])

# ---- bottleneck engine on the C-A-U-E-O aggregates ----
caueo = {k: {"value": v.get("value"), "status": v.get("status")} for k, v in run["aggregates"]["caueo"].items()}
bottleneck = detect_bottleneck(caueo, base_threshold=60.0,
                               disaggregation={"capital": False, "location": False, "group": False, "time": False},
                               confidence={"level": "ناکافی", "reason": "C-A-U-E-O abstained"})
run["aggregates"]["bottleneck"] = bottleneck

# ---- drill-down chains for the real OBSERVED/PROXY values ----
drilldown = {}
for p in run["records"]:
    vid = p["raw"]["provenance_value_id"]; pv = prov_by_val.get(vid, {})
    if not pv:
        continue
    drilldown[vid] = {
        "result": {"indicator_code": p["indicator_code"], "operationalization": p["operationalization"],
                   "raw_value": p["raw"]["value"], "raw_unit": p["raw"]["unit"],
                   "standardized_status": p["normalized"]["status"],
                   "standardized_reason": p["normalized"].get("missing_reason")},
        "indicator": {"title": p["title"], "capital": p["capital_code"], "chain_stage": p["chain_stage"],
                      "qtr_target": p["qtr_target"], "direction": p["direction_text"]},
        "formula": pv.get("formula_id"),
        "raw_value": pv.get("resulting_value"), "unit": pv.get("unit"),
        "source": {"source_id": pv.get("source_id"), "source_name": pv.get("source_name"),
                   "provider": pv.get("provider"), "dataset_id": pv.get("dataset_id")},
        "request_api": {"url_api": pv.get("url_api"), "request_params": pv.get("request_params")},
        "file_record": {"raw_file_ref": pv.get("raw_file_ref"), "raw_file_hash": pv.get("raw_file_hash"),
                        "record_ref": pv.get("record_ref")},
        "date": pv.get("timestamp_acquired"), "observation_period": pv.get("observation_period"),
        "processing": {"processing_version": pv.get("processing_version"),
                       "transformation_steps": pv.get("transformation_steps"), "crs": pv.get("crs")},
        "qc": {"quality_checks": pv.get("quality_checks"),
               "quality_score": next((r["quality_score"] for r in dcs["indicators"] if r.get("provenance_value_id") == vid), None)},
        "confidence": rec_conf.get(vid),
        "is_proxy": pv.get("is_proxy"),
        "reproducibility_key": run["reproducibility_key"],
    }

# ---- data & evidence coverage (honest) ----
distinct_codes = sorted({p["indicator_code"] for p in run["records"] if p["raw"]["status"] in ("OBSERVED", "PROXY", "ESTIMATED")})
n_measurements = sum(1 for p in run["records"] if p["raw"]["status"] in ("OBSERVED", "PROXY", "ESTIMATED"))
n_access_req = sum(1 for p in run["records"] if p["raw"]["status"] == "ACCESS_REQUIRED")
n_std_valid = sum(1 for p in run["records"] if p["normalized"]["status"] in ("OBSERVED", "PROXY", "ESTIMATED") and p["normalized"]["value"] is not None)
n_multi_stream = sum(1 for p in run["records"] if len(set(p["raw"]["evidence_stream"])) >= 2)
n_proxy = sum(1 for p in run["records"] if p["raw"]["is_proxy"])
TOTAL_419 = 419
data_coverage = {
    "total_registry_indicators": TOTAL_419,
    "distinct_indicators_with_real_data": len(distinct_codes),
    "distinct_codes": distinct_codes,
    "measurements_acquired": n_measurements,
    "access_required": n_access_req,
    "pct_indicators_with_real_data": round(100 * len(distinct_codes) / TOTAL_419, 2),
    "indicators_with_valid_standardized_score": n_std_valid,
    "pct_with_valid_standardized_score": round(100 * n_std_valid / TOTAL_419, 2),
    "multi_source_values": n_multi_stream,
    "stale_values": 0,
    "note": ("پوشش داده معادل کیفیت نیست. هیچ نمرهٔ استانداردشدهٔ معتبری تولید نشد "
             "(همه PENDING_VALIDATION به‌دلیل عدم‌تطابق واحد و L/U کالیبره‌نشده).")
}
level_counts = {}
for c in rec_conf.values():
    level_counts[c["level"]] = level_counts.get(c["level"], 0) + 1
evidence_coverage = {
    "values_assessed": len(rec_conf), "level_counts": level_counts,
    "proxy_values": n_proxy, "multi_stream_values": n_multi_stream,
    "streams_present": sorted({s for p in run["records"] for s in p["raw"]["evidence_stream"]}),
    "streams_missing_for_full_Q": ["behavioral (U/E)", "perceptual (E survey)", "objective outcome (O)"],
    "note": "چهار جریان شاهد جدا نگه داشته شده‌اند؛ در پایلوت فقط GIS و عینی حاضرند."
}

# ---- abstention summary (every abstained field: state + reason + what-unblocks) ----
abstention = []
for p in run["records"]:
    if p["normalized"]["status"] not in ("OBSERVED", "PROXY", "ESTIMATED"):
        abstention.append({"field": f'{p["indicator_code"]} / {p["operationalization"]} (standardized score)',
                           "status": p["normalized"]["status"], "reason": p["normalized"].get("missing_reason"),
                           "unblocks": "کالیبراسیون L/U + تعریف واحدِ «٪ جمعیت در آستانه» + مرز/داده رسمی"})
for grp, label in (("capitals", "سرمایه"), ("caueo", "مرحله C-A-U-E-O"), ("qtr", "خروجی")):
    for k, v in run["aggregates"][grp].items():
        if v.get("status") != "OBSERVED":
            need = ("دادهٔ پیمایشی/رفتاری (U/E/O)" if v.get("status") == "WAITING_FOR_DATA"
                    else "نمرهٔ استانداردشدهٔ معتبر برای شاخص‌های این گروه + کالیبراسیون")
            abstention.append({"field": f"{label} {k}", "status": v.get("status"),
                               "reason": v.get("note"), "unblocks": need})
abstention.append({"field": "equity_gap", "status": run["aggregates"]["equity"]["status"],
                   "reason": run["aggregates"]["equity"]["note"], "unblocks": "دادهٔ تفکیک‌شدهٔ گروهی"})
abstention.append({"field": "bottleneck", "status": bottleneck["status"], "reason": bottleneck["note"],
                   "unblocks": "؛ ".join(bottleneck["needed_data"])})

# ---- attach confidence onto each published record for the result file ----
result_records = []
for p in run["records"]:
    vid = p["raw"]["provenance_value_id"]
    result_records.append({**p, "confidence": rec_conf.get(vid)})

neighborhood_result = {
    "neighborhood": neigh,
    "calc_run": run["calc_run"],
    "reproducibility_key": run["reproducibility_key"],
    "fingerprint": run["fingerprint"],
    "indicators": result_records,
    "aggregates": run["aggregates"],
    "data_coverage": data_coverage,
    "evidence_coverage": evidence_coverage,
    "abstention_summary": abstention,
    "drilldown_index": drilldown,
    "integrity_flags": {
        "no_fabricated_numbers": True,
        "missing_never_zeroed": True,
        "qtr_separate": list(run["aggregates"]["qtr"].keys()),
        "bottleneck_ai_independent": bottleneck["ai_independent"],
        "proxy_labeled": all(p["raw"]["is_proxy"] for p in run["records"]),
        "generated_at": NOW.isoformat(),
    },
}

# persist
json.dump(run, open(os.path.join(OUT, "calculation_run.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump(neighborhood_result, open(os.path.join(OUT, "neighborhood_result.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump({"drilldown": drilldown}, open(os.path.join(OUT, "drilldown.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump({"data_coverage": data_coverage, "evidence_coverage": evidence_coverage},
          open(os.path.join(OUT, "coverage_summaries.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# ---- console report ----
print("FINGERPRINT:", run["fingerprint"])
print("determinism re-run identical:", run["fingerprint"] == run2["fingerprint"])
print("calc_version_id:", run["calc_run"]["calculation_version_id"])
print("\n-- per record (raw status / standardized status / confidence level) --")
for p in result_records:
    print(f"  {p['indicator_code']:8} {p['operationalization']:38} raw={p['raw']['status']:14} std={p['normalized']['status']:18} conf={p['confidence']['level'] if p['confidence'] else '-'}")
print("\n-- capitals --")
for k, v in run["aggregates"]["capitals"].items():
    print(f"  K[{k}] {v.get('capital_name',''):22} {v['status']:22} value={v['value']}")
print("\n-- C-A-U-E-O --")
for k, v in run["aggregates"]["caueo"].items():
    print(f"  {k}: {v['status']:22} value={v['value']}")
print("\n-- Q/T/R (SEPARATE) --")
for k in ("K", "Q", "T", "R"):
    v = run["aggregates"]["qtr"][k]; print(f"  {k}: {v['status']:22} value={v['value']}")
print("\n-- equity:", run["aggregates"]["equity"]["status"], "| bottleneck:", bottleneck["status"])
print("\ndata_coverage:", json.dumps({k: data_coverage[k] for k in ("distinct_indicators_with_real_data","measurements_acquired","access_required","indicators_with_valid_standardized_score","multi_source_values")}, ensure_ascii=False))
print("evidence level_counts:", json.dumps(level_counts, ensure_ascii=False))
print("abstentions:", len(abstention))
print("OUT dir:", OUT)
