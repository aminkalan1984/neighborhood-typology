"""Extended provenance / lineage (constraint 3, 4, 8).

Every REAL value ingested by the platform carries a complete lineage record.
`ProvenanceStore.lineage(value_id)` returns the ordered drill-down chain:
    result -> indicator -> formula -> raw value -> source -> request/API
    -> file/record -> date -> processing -> QC

Nothing here fabricates data. If a field is unknown it stays None and is
reported as such; it is never invented.
"""
from __future__ import annotations
import os, sys, json, hashlib, datetime
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any

# --- make the existing engine importable as a top-level package (no duplication)
_KROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../kernel
if _KROOT not in sys.path:
    sys.path.insert(0, _KROOT)
from engine.provenance import reproducibility_key  # noqa: E402

EVIDENCE_CLASSES = ("objective", "gis", "behavioral", "perceptual")


def sha256_bytes(b: bytes) -> str:
    return "sha256:" + hashlib.sha256(b).hexdigest()


def utc_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


@dataclass
class SourceRecord:
    """A registered data source / provider (constraint 3 upper half + hierarchy)."""
    source_id: str
    source_name: str
    provider: Optional[str] = None
    dataset_id: Optional[str] = None
    url_api: Optional[str] = None
    tier: Optional[str] = None                 # source-of-truth hierarchy tier
    is_official: bool = False
    is_proxy: bool = False                     # constraint 8 (labeled proxy source)
    license: Optional[str] = None
    access_method: Optional[str] = None
    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ProvenanceRecord:
    """Full lineage record for ONE ingested value (constraint 3)."""
    value_id: str
    indicator_code: Optional[str]
    # methodology anchor
    formula_id: Optional[str] = None           # e.g. standardization / raw-observation
    resulting_value: Any = None                # the value this provenance backs (raw or standardized)
    unit: Optional[str] = None
    # source linkage
    source_id: Optional[str] = None
    source_name: Optional[str] = None
    provider: Optional[str] = None
    dataset_id: Optional[str] = None
    url_api: Optional[str] = None
    request_params: Dict[str, Any] = field(default_factory=dict)
    # temporal
    timestamp_acquired: Optional[str] = None
    observation_period: Optional[str] = None
    # spatial
    geographic_extent: Optional[str] = None
    crs: Optional[str] = None
    spatial_resolution: Optional[str] = None
    temporal_resolution: Optional[str] = None
    spatial_scale: Optional[str] = None
    downscaling_caveat: Optional[str] = None
    # file / record anchor
    raw_file_ref: Optional[str] = None         # sandbox path or record id
    raw_file_hash: Optional[str] = None         # sha256 of the raw bytes
    record_ref: Optional[str] = None            # row id / feature id within the file
    # processing
    processing_version: Optional[str] = None
    transformation_steps: List[Dict[str, Any]] = field(default_factory=list)
    # quality
    quality_checks: List[Dict[str, Any]] = field(default_factory=list)
    # trust / evidence
    confidence: Optional[float] = None
    evidence_class: Optional[str] = None        # one of EVIDENCE_CLASSES
    is_proxy: bool = False
    methodology_version: Optional[str] = None
    reproducibility_key: Dict[str, Any] = field(default_factory=dict)

    def add_transformation_step(self, op: str, detail: Dict[str, Any] | None = None) -> None:
        self.transformation_steps.append(
            {"op": op, "detail": detail or {}, "at": utc_now()}
        )

    def add_quality_check(self, check: Dict[str, Any]) -> None:
        self.quality_checks.append(check)

    def as_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


class ProvenanceStore:
    """Registers sources + per-value provenance and persists to disk.

    Also builds the drill-down lineage chain for any value_id.
    """

    def __init__(self, out_dir: Optional[str] = None):
        self.sources: Dict[str, SourceRecord] = {}
        self.records: Dict[str, ProvenanceRecord] = {}
        self.out_dir = out_dir
        self._src_seq = 0
        self._val_seq = 0
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

    # ---- source registration -------------------------------------------------
    def register_source(self, source_name: str, **kw) -> str:
        self._src_seq += 1
        sid = kw.pop("source_id", None) or f"SRC-{self._src_seq:04d}"
        rec = SourceRecord(source_id=sid, source_name=source_name, **kw)
        self.sources[sid] = rec
        self._persist("sources", sid, rec.as_dict())
        return sid

    def get_source(self, source_id: str) -> Optional[SourceRecord]:
        return self.sources.get(source_id)

    # ---- value provenance -----------------------------------------------------
    def register_provenance(
        self,
        indicator_code: Optional[str],
        *,
        value_id: Optional[str] = None,
        raw_bytes: Optional[bytes] = None,
        raw_file_ref: Optional[str] = None,
        evidence_class: Optional[str] = None,
        methodology_version: Optional[str] = None,
        data_version: Optional[str] = None,
        indicator_version: Optional[str] = None,
        weight_v: Optional[str] = None,
        threshold_v: Optional[str] = None,
        calc_v: Optional[str] = None,
        **fields_,
    ) -> ProvenanceRecord:
        self._val_seq += 1
        vid = value_id or f"VAL-{self._val_seq:05d}"
        if evidence_class is not None and evidence_class not in EVIDENCE_CLASSES:
            raise ValueError(f"evidence_class must be one of {EVIDENCE_CLASSES}, got {evidence_class}")
        rec = ProvenanceRecord(value_id=vid, indicator_code=indicator_code, **fields_)
        rec.evidence_class = evidence_class
        rec.methodology_version = methodology_version
        rec.raw_file_ref = rec.raw_file_ref or raw_file_ref
        if raw_bytes is not None:
            rec.raw_file_hash = sha256_bytes(raw_bytes)
        # copy source header fields for convenience/drill-down
        if rec.source_id and rec.source_id in self.sources:
            s = self.sources[rec.source_id]
            rec.source_name = rec.source_name or s.source_name
            rec.provider = rec.provider or s.provider
            rec.dataset_id = rec.dataset_id or s.dataset_id
            rec.url_api = rec.url_api or s.url_api
            rec.is_proxy = rec.is_proxy or s.is_proxy
        if any(v is not None for v in (data_version, indicator_version, weight_v, threshold_v, calc_v)):
            rec.reproducibility_key = reproducibility_key(
                data_version, methodology_version, indicator_version,
                weight_v, threshold_v, calc_v)
        self.records[vid] = rec
        self._persist("provenance", vid, rec.as_dict())
        return rec

    def get(self, value_id: str) -> Optional[ProvenanceRecord]:
        return self.records.get(value_id)

    # ---- drill-down chain (constraint 4) --------------------------------------
    def lineage(self, value_id: str) -> List[Dict[str, Any]]:
        r = self.records.get(value_id)
        if r is None:
            raise KeyError(f"no provenance for {value_id}")
        chain: List[Dict[str, Any]] = [
            {"level": "result", "value_id": r.value_id,
             "resulting_value": r.resulting_value, "unit": r.unit,
             "confidence": r.confidence, "is_proxy": r.is_proxy,
             "reproducibility_key": r.reproducibility_key},
            {"level": "indicator", "indicator_code": r.indicator_code,
             "evidence_class": r.evidence_class,
             "methodology_version": r.methodology_version},
            {"level": "formula", "formula_id": r.formula_id},
            {"level": "raw_value", "resulting_value": r.resulting_value, "unit": r.unit},
            {"level": "source", "source_id": r.source_id,
             "source_name": r.source_name, "provider": r.provider,
             "dataset_id": r.dataset_id, "is_proxy": r.is_proxy},
            {"level": "request", "url_api": r.url_api, "request_params": r.request_params},
            {"level": "file_record", "raw_file_ref": r.raw_file_ref,
             "record_ref": r.record_ref, "raw_file_hash": r.raw_file_hash},
            {"level": "date", "timestamp_acquired": r.timestamp_acquired,
             "observation_period": r.observation_period},
            {"level": "processing", "processing_version": r.processing_version,
             "transformation_steps": r.transformation_steps},
            {"level": "qc", "quality_checks": r.quality_checks},
        ]
        return chain

    def is_complete_lineage(self, value_id: str) -> bool:
        """A lineage is 'complete' when the audit-critical anchors are present."""
        r = self.records.get(value_id)
        if r is None:
            return False
        required = [r.indicator_code, r.formula_id, r.source_id, r.source_name,
                    r.timestamp_acquired]
        return all(x is not None for x in required) and len(r.quality_checks) > 0

    # ---- persistence ----------------------------------------------------------
    def _persist(self, kind: str, key: str, payload: Dict[str, Any]) -> None:
        if not self.out_dir:
            return
        d = os.path.join(self.out_dir, kind)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
