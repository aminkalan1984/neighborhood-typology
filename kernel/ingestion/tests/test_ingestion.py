"""Ingestion CONTRACT tests — STRUCTURAL fixtures ONLY.

None of the bytes below are a neighborhood result. They are contract fixtures
that exercise the pipeline's guarantees: missing != 0, invalid blocks calc,
complete lineage, proxy labeling, duplicate/unit/date detection.
"""
import os, sys
_KROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # .../kernel
if _KROOT not in sys.path:
    sys.path.insert(0, _KROOT)

from engine.status import Measurement
from ingestion.provenance_ext import ProvenanceStore
from ingestion import validators as V
from ingestion.ingest import IngestionService, detect_format, infer_schema, map_fields
from ingestion.loaders import load_records

PASS = []
def ok(name, cond):
    assert cond, f"FAIL {name}"
    PASS.append(name); print("PASS", name)

# ---- structural fixtures (NOT neighborhood results) --------------------------
CSV_CLEAN = (b"feature_id,distance_m,captured_at\n"
             b"f1,120.5,2026-08-01\n"
             b"f2,340.0,2026-08-01\n"
             b"f3,505.0,2026-08-01\n"
             b"f4,88.0,2026-08-01\n")
CSV_MISSING = (b"feature_id,distance_m,captured_at\n"
               b"f1,120.5,2026-08-01\n"
               b"f2,,2026-08-01\n")           # <- missing cell
CSV_DUP = (b"feature_id,distance_m\n"
           b"f1,120.5\n"
           b"f1,120.5\n"
           b"f2,340.0\n")

store = ProvenanceStore()
sid = store.register_source("Structural Test Fixture", provider="unit-test",
                            dataset_id="fixture-ds", url_api=None,
                            tier="test-fixture", is_official=False)
svc = IngestionService(store=store)

# (a) well-formed CSV maps + validates + registers provenance ------------------
fmt, rows = load_records("clean.csv", CSV_CLEAN)
ok("a1 format=CSV", fmt == "CSV")
schema = infer_schema(rows)
mp = map_fields(schema, {"distance_m": "raw_distance"})
ok("a2 mapping", mp["mapped"] == {"distance_m": "raw_distance"} and "captured_at" in mp["unmapped_columns"])
rec_a = svc.ingest_value(
    indicator_code="PHY-003", raw_value=rows[0]["distance_m"],
    rows_for_column=rows, value_field="distance_m",
    source_id=sid, request_params={"dataset_id": "fixture-ds"},
    declared_unit="متر", registry_unit="متر",
    raw_bytes=CSV_CLEAN, raw_file_ref="clean.csv", record_ref="f1",
    timestamp_acquired="2026-08-01", evidence_class="gis")
ok("a3 status OBSERVED", rec_a.measurement.status == "OBSERVED")
ok("a4 value present", rec_a.measurement.value == 120.5)
ok("a5 provenance id", rec_a.provenance_value_id is not None)
ok("a6 quality valid", rec_a.quality_score["is_valid"] is True)

# (b) missing cell -> MISSING, value None, never 0 -----------------------------
_, rows_m = load_records("missing.csv", CSV_MISSING)
rec_b = svc.ingest_value(
    indicator_code="PHY-003", raw_value=rows_m[1]["distance_m"],   # the missing one
    rows_for_column=rows_m, value_field="distance_m",
    source_id=sid, request_params={"dataset_id": "fixture-ds"},
    declared_unit="متر", registry_unit="متر", raw_bytes=CSV_MISSING,
    raw_file_ref="missing.csv", record_ref="f2", timestamp_acquired="2026-08-01",
    evidence_class="gis")
ok("b1 status MISSING", rec_b.measurement.status == "MISSING")
ok("b2 value is None (not 0)", rec_b.measurement.value is None)
nm = [c for c in rec_b.quality_checks if c["check"] == "null_missing_analysis"][0]
ok("b3 missing counted separately", nm["findings"]["missing"] == 1 and nm["findings"]["observed"] == 1)
# hard guard: MISSING + a number must raise
raised = False
try:
    Measurement("PHY-003", value=0.0, status="MISSING")
except AssertionError:
    raised = True
ok("b4 guard blocks MISSING+0", raised)

# (c) duplicate rows detected --------------------------------------------------
_, rows_d = load_records("dup.csv", CSV_DUP)
dchk = V.duplicate_detection(rows_d, ["feature_id"])
ok("c1 duplicate detected", dchk["findings"]["duplicate_count"] == 1)

# (d) bad unit / bad date flagged (blocking) -----------------------------------
uchk = V.unit_validation("km", "متر")
ok("d1 unit mismatch blocking", uchk["status"] == "FAIL" and uchk["blocking"] is True)
dtchk = V.date_validation("not-a-date")
ok("d2 bad date blocking", dtchk["status"] == "FAIL" and dtchk["blocking"] is True)
rec_d = svc.ingest_value(
    indicator_code="PHY-003", raw_value=120.5, rows_for_column=rows,
    value_field="distance_m", source_id=sid,
    request_params={"dataset_id": "fixture-ds"},
    declared_unit="km", registry_unit="متر",   # <- mismatch => blocking
    raw_bytes=CSV_CLEAN, raw_file_ref="clean.csv", record_ref="f1",
    timestamp_acquired="2026-08-01", evidence_class="gis")
ok("d3 invalid record status", rec_d.measurement.status == "INVALID")
ok("d4 invalid value None", rec_d.measurement.value is None)
ok("d5 auto-rejected", rec_d.approval_status == "REJECTED")

# (e) INVALID blocks calculation (gate refuses) --------------------------------
gate_d = svc.can_feed_calculation(rec_d)
ok("e1 gate blocks invalid", gate_d["allowed"] is False and len(gate_d["reasons"]) > 0)
approve_raised = False
try:
    svc.approve(rec_d, "tester")
except ValueError:
    approve_raised = True
ok("e2 cannot approve invalid", approve_raised)
# and an approved OBSERVED record passes the gate
svc.approve(rec_a, "tester", "clean fixture")
gate_a = svc.can_feed_calculation(rec_a)
ok("e3 gate allows approved observed", gate_a["allowed"] is True)

# (f) lineage() returns complete non-empty chain -------------------------------
chain = store.lineage(rec_a.provenance_value_id)
levels = [c["level"] for c in chain]
ok("f1 chain 10 levels", levels == ["result","indicator","formula","raw_value","source",
                                    "request","file_record","date","processing","qc"])
ok("f2 lineage complete", store.is_complete_lineage(rec_a.provenance_value_id) is True)
qc_level = [c for c in chain if c["level"] == "qc"][0]
ok("f3 qc chain non-empty", len(qc_level["quality_checks"]) > 0)
src_level = [c for c in chain if c["level"] == "source"][0]
ok("f4 source drillable", src_level["source_name"] == "Structural Test Fixture")

# (g) proxy input carries is_proxy=true through to Measurement -----------------
rec_g = svc.ingest_value(
    indicator_code="PHY-003", raw_value=505.0, rows_for_column=rows,
    value_field="distance_m", source_id=sid,
    request_params={"dataset_id": "fixture-ds"},
    declared_unit="متر", registry_unit="متر", raw_bytes=CSV_CLEAN,
    raw_file_ref="clean.csv", record_ref="f3", timestamp_acquired="2026-08-01",
    evidence_class="gis", is_proxy=True)
ok("g1 status PROXY", rec_g.measurement.status == "PROXY")
ok("g2 measurement is_proxy", rec_g.measurement.is_proxy is True)
prov_g = store.get(rec_g.provenance_value_id)
ok("g3 provenance is_proxy", prov_g.is_proxy is True)
ok("g4 proxy needs manual approval", rec_g.approval_status == "PENDING_APPROVAL")

print(f"\nINGESTION TESTS: {len(PASS)}/{len(PASS)} passed")
