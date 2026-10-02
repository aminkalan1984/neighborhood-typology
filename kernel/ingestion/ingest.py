"""Ingestion orchestrator (constraints 1,2,3,4,5,8,9).

Pipeline per dataset:
  detect_format -> infer_schema -> map_fields -> validators -> quality score
  -> register provenance -> STATUS machine -> manual-approval workflow -> GATE

GATE: only records whose status in {OBSERVED, ESTIMATED, PROXY} AND that pass
validators (no blocking failures) AND that are approved may feed calculation.
INVALID / missing / pending records BLOCK calculation. Missing is never 0.
"""
from __future__ import annotations
import os, sys, json, io
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

_KROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../kernel
if _KROOT not in sys.path:
    sys.path.insert(0, _KROOT)
from engine.status import Measurement, STATUS  # noqa: E402
from engine.calc_engine import METHODOLOGY_VERSION  # noqa: E402

from . import validators as V
from .provenance_ext import ProvenanceStore, utc_now

USABLE_STATUSES = ("OBSERVED", "ESTIMATED", "PROXY")


# --- format detection ----------------------------------------------------------
def detect_format(path: str, raw_bytes: Optional[bytes] = None) -> str:
    ext = os.path.splitext(path)[1].lower()
    ext_map = {".csv": "CSV", ".tsv": "CSV", ".xlsx": "XLSX", ".xls": "XLSX",
               ".json": "JSON", ".geojson": "GEOJSON", ".gpkg": "GEOPACKAGE",
               ".parquet": "PARQUET"}
    fmt = ext_map.get(ext)
    # content sniff to disambiguate .json vs .geojson and confirm
    if raw_bytes is not None:
        head = raw_bytes[:4096].decode("utf-8", errors="ignore").lstrip()
        if head[:1] in "{[":
            low = head.lower()
            if '"featurecollection"' in low or '"geometry"' in low or '"coordinates"' in low:
                return "GEOJSON"
            if fmt in (None, "JSON"):
                return "JSON"
    if fmt is None:
        raise ValueError(f"unsupported/undetected format for {path!r} (ext={ext})")
    return fmt


# --- schema inference ----------------------------------------------------------
def infer_schema(rows: List[Dict[str, Any]]) -> Dict[str, str]:
    schema: Dict[str, str] = {}
    cols: List[str] = []
    for r in rows:
        for c in r.keys():
            if c not in cols:
                cols.append(c)
    for c in cols:
        t = "string"
        for r in rows:
            v = r.get(c)
            if v is None or (isinstance(v, str) and v.strip() == ""):
                continue
            if isinstance(v, bool):
                t = "boolean"
            elif isinstance(v, int):
                t = "integer"
            elif isinstance(v, float):
                t = "number"
            else:
                t = "string"
            break
        schema[c] = t
    return schema


# --- field mapping (unmapped are flagged, NOT dropped) -------------------------
def map_fields(schema: Dict[str, str], mapping: Dict[str, str]) -> Dict[str, Any]:
    mapped = {src: tgt for src, tgt in mapping.items() if src in schema}
    unmapped = [c for c in schema if c not in mapping]
    return {"mapped": mapped, "unmapped_columns": unmapped}


@dataclass
class RawObservation:
    dataset_id: str
    record_ref: str
    raw: Dict[str, Any]
    value_field: Optional[str] = None


@dataclass
class IngestionRecord:
    dataset_id: str
    indicator_code: Optional[str]
    measurement: Measurement
    provenance_value_id: Optional[str]
    quality_checks: List[Dict[str, Any]] = field(default_factory=list)
    quality_score: Dict[str, Any] = field(default_factory=dict)
    unmapped_columns: List[str] = field(default_factory=list)
    approval_status: str = "PENDING_APPROVAL"     # PENDING_APPROVAL | APPROVED | REJECTED
    approval_note: str = ""
    def as_dict(self) -> Dict[str, Any]:
        return {"dataset_id": self.dataset_id, "indicator_code": self.indicator_code,
                "measurement": self.measurement.as_dict(),
                "provenance_value_id": self.provenance_value_id,
                "quality_score": self.quality_score,
                "unmapped_columns": self.unmapped_columns,
                "approval_status": self.approval_status,
                "approval_note": self.approval_note,
                "quality_checks": self.quality_checks}


class IngestionService:
    def __init__(self, store: Optional[ProvenanceStore] = None,
                 registries_dir: Optional[str] = None):
        self.store = store or ProvenanceStore()
        self.registries_dir = registries_dir or os.path.join(_KROOT, "registries")
        self._th = None

    def _thresholds(self) -> Dict[str, Any]:
        if self._th is None:
            with open(os.path.join(self.registries_dir, "threshold_registry_v1.json"), encoding="utf-8") as f:
                self._th = json.load(f)
        return self._th

    def indicator_lu(self, indicator_code: str) -> Optional[Dict[str, Any]]:
        return self._thresholds().get("indicator_LU", {}).get(indicator_code)

    # --- core ingest of ONE indicator value -----------------------------------
    def ingest_value(
        self,
        *,
        indicator_code: Optional[str],
        raw_value: Any,
        rows_for_column: List[Dict[str, Any]],
        value_field: str,
        source_id: str,
        request_params: Dict[str, Any],
        declared_unit: Optional[str] = None,
        registry_unit: Optional[str] = None,
        raw_bytes: Optional[bytes] = None,
        raw_file_ref: Optional[str] = None,
        record_ref: Optional[str] = None,
        evidence_class: str = "objective",
        is_proxy: bool = False,
        spatial_scale: Optional[str] = None,
        downscaling_caveat: Optional[str] = None,
        crs: Optional[str] = None,
        geographic_extent: Optional[str] = None,
        timestamp_acquired: Optional[str] = None,
        observation_period: Optional[str] = None,
        spatial_resolution: Optional[str] = None,
        temporal_resolution: Optional[str] = None,
        processing_version: Optional[str] = None,
        expected_type: str = "number",
        formula_id: str = "raw_observation",
        force_manual_approval: bool = False,
        data_version: Optional[str] = None,
        indicator_version: Optional[str] = None,
        weight_v: Optional[str] = None,
        threshold_v: Optional[str] = None,
        calc_v: Optional[str] = None,
    ) -> IngestionRecord:
        checks: List[Dict[str, Any]] = []
        checks.append(V.type_validation(raw_value, expected_type))
        checks.append(V.null_missing_analysis(rows_for_column, value_field))
        checks.append(V.duplicate_detection(rows_for_column, [value_field]))
        checks.append(V.unit_validation(declared_unit, registry_unit))
        if timestamp_acquired is not None:
            checks.append(V.date_validation(timestamp_acquired))
        lu = self.indicator_lu(indicator_code) if indicator_code else None
        checks.append(V.range_validation(raw_value, lu))
        col_vals = [r.get(value_field) for r in rows_for_column]
        checks.append(V.outlier_detection([v for v in col_vals if isinstance(v, (int, float))]))

        qscore = V.data_quality_score(checks)

        # --- STATUS machine --------------------------------------------------
        if not qscore["is_valid"]:
            status = "INVALID"
            value = None
        elif V._is_missing(raw_value):
            status = "MISSING"          # constraint 2: stays None, never 0
            value = None
        else:
            status = "PROXY" if is_proxy else "OBSERVED"
            value = float(raw_value) if isinstance(raw_value, (int, float)) else raw_value

        prov = self.store.register_provenance(
            indicator_code,
            resulting_value=value,
            unit=declared_unit,
            formula_id=formula_id,
            source_id=source_id,
            request_params=request_params,
            raw_bytes=raw_bytes,
            raw_file_ref=raw_file_ref,
            record_ref=record_ref,
            timestamp_acquired=timestamp_acquired or utc_now(),
            observation_period=observation_period,
            geographic_extent=geographic_extent,
            crs=crs,
            spatial_resolution=spatial_resolution,
            temporal_resolution=temporal_resolution,
            spatial_scale=spatial_scale,
            downscaling_caveat=downscaling_caveat,
            processing_version=processing_version or METHODOLOGY_VERSION,
            evidence_class=evidence_class,
            is_proxy=is_proxy,
            methodology_version=METHODOLOGY_VERSION,
            data_version=data_version, indicator_version=indicator_version,
            weight_v=weight_v, threshold_v=threshold_v, calc_v=calc_v,
        )
        for c in checks:
            prov.add_quality_check(c)
        prov.add_transformation_step("ingest_value", {"value_field": value_field, "status": status})

        m = Measurement(
            indicator_code=indicator_code or "UNKNOWN",
            value=value, status=status, is_proxy=is_proxy,
            missing_reason=None if status in USABLE_STATUSES else f"status={status}",
            spatial_scale=spatial_scale, downscaling_caveat=downscaling_caveat,
            evidence_stream=[evidence_class],
        )
        rec = IngestionRecord(
            dataset_id=str(request_params.get("dataset_id", source_id)),
            indicator_code=indicator_code,
            measurement=m,
            provenance_value_id=prov.value_id,
            quality_checks=checks,
            quality_score=qscore,
        )
        # manual-approval workflow: low quality / proxy / invalid / forced -> manual
        if status == "INVALID":
            rec.approval_status = "REJECTED"
            rec.approval_note = f"blocking failures: {qscore['blocking_failures']}"
        elif force_manual_approval or is_proxy or (qscore.get("score") or 0) < 0.75:
            rec.approval_status = "PENDING_APPROVAL"
            rec.approval_note = "manual approval required (proxy/low-quality/sensitive)"
        else:
            rec.approval_status = "APPROVED"
            rec.approval_note = "auto-approved (high quality, non-proxy)"
        return rec

    # --- approval + GATE -------------------------------------------------------
    def approve(self, rec: IngestionRecord, approver: str, note: str = "") -> IngestionRecord:
        if rec.measurement.status == "INVALID":
            raise ValueError("cannot approve an INVALID record (blocked by validators)")
        rec.approval_status = "APPROVED"
        rec.approval_note = f"approved by {approver}. {note}".strip()
        return rec

    def reject(self, rec: IngestionRecord, approver: str, note: str = "") -> IngestionRecord:
        rec.approval_status = "REJECTED"
        rec.approval_note = f"rejected by {approver}. {note}".strip()
        return rec

    def can_feed_calculation(self, rec: IngestionRecord) -> Dict[str, Any]:
        """The GATE (constraint 5)."""
        reasons: List[str] = []
        if rec.measurement.status not in USABLE_STATUSES:
            reasons.append(f"status {rec.measurement.status} not usable")
        if not rec.quality_score.get("is_valid", False):
            reasons.append("validators flagged blocking failure (INVALID)")
        if rec.approval_status != "APPROVED":
            reasons.append(f"approval_status={rec.approval_status}")
        if rec.measurement.value is None:
            reasons.append("no numeric value present")
        return {"allowed": len(reasons) == 0, "reasons": reasons}
