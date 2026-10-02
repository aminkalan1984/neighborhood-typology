"""Status/Value model — missing is NEVER zero. Constraint 1,2."""
from dataclasses import dataclass, field
from typing import Optional, List

STATUS = ["OBSERVED","MISSING","NOT_APPLICABLE","INVALID","ESTIMATED","PROXY",
 "INSUFFICIENT_COVERAGE","WAITING_FOR_DATA","SOURCE_UNAVAILABLE","ACCESS_REQUIRED","PENDING_VALIDATION"]

@dataclass
class Measurement:
    indicator_code: str
    value: Optional[float] = None       # number ONLY when status in {OBSERVED,ESTIMATED,PROXY}
    status: str = "WAITING_FOR_DATA"
    is_proxy: bool = False
    missing_reason: Optional[str] = None
    spatial_scale: Optional[str] = None
    downscaling_caveat: Optional[str] = None
    evidence_stream: List[str] = field(default_factory=list)
    group: Optional[str] = None
    def __post_init__(self):
        assert self.status in STATUS, f"bad status {self.status}"
        # HARD GUARD: missing/pending/etc must carry NO number (never coerced to 0)
        if self.status not in ("OBSERVED","ESTIMATED","PROXY"):
            assert self.value is None, f"{self.indicator_code}: status {self.status} must have value=None, not {self.value}"
    def as_dict(self):
        return {"indicator_code":self.indicator_code,"value":self.value,"status":self.status,
                "is_proxy":self.is_proxy,"missing_reason":self.missing_reason,
                "spatial_scale":self.spatial_scale,"downscaling_caveat":self.downscaling_caveat,
                "evidence_stream":self.evidence_stream,"group":self.group}
