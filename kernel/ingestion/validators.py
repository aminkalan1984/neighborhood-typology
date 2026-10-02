"""Data validators (constraints 1,2,3,5,7).

Each validator is a PURE function returning a structured check result:
    {"check": name, "status": PASS|WARN|FAIL, "blocking": bool, "detail": str,
     "findings": {...}}
Results are appended to a provenance record's quality_checks[].

Hard rules enforced here:
  * missing data is COUNTED separately and NEVER coerced to 0 (constraint 2).
  * a FAIL with blocking=True forces the record status to INVALID and blocks
    downstream calculation (constraint 5).
  * an uncalibrated registry range yields PENDING_VALIDATION, NOT INVALID
    (do not punish absence of calibration by fabricating a verdict).
"""
from __future__ import annotations
import math, datetime
from typing import Any, Dict, List, Optional, Sequence

PASS, WARN, FAIL = "PASS", "WARN", "FAIL"


def _r(check: str, status: str, detail: str, findings: Dict[str, Any] | None = None,
       blocking: bool = False) -> Dict[str, Any]:
    return {"check": check, "status": status, "blocking": blocking,
            "detail": detail, "findings": findings or {}}


def _is_missing(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    if isinstance(v, str) and v.strip() == "":
        return True
    return False


# --- 1. schema validation ------------------------------------------------------
def schema_validation(row: Dict[str, Any], required_fields: Sequence[str]) -> Dict[str, Any]:
    present = [f for f in required_fields if f in row]
    missing_fields = [f for f in required_fields if f not in row]
    if missing_fields:
        return _r("schema_validation", FAIL,
                  f"required fields absent: {missing_fields}",
                  {"required": list(required_fields), "present": present,
                   "missing_fields": missing_fields}, blocking=True)
    return _r("schema_validation", PASS, "all required fields present",
              {"required": list(required_fields)})


# --- 2. type validation --------------------------------------------------------
def type_validation(value: Any, expected: str) -> Dict[str, Any]:
    """expected in {number, integer, string, date, geometry}. Missing -> WARN (not fail)."""
    if _is_missing(value):
        return _r("type_validation", WARN, "value missing (not a type error)",
                  {"expected": expected, "observed": None})
    ok = True
    if expected in ("number", "float"):
        ok = isinstance(value, (int, float)) and not isinstance(value, bool)
    elif expected == "integer":
        ok = isinstance(value, int) and not isinstance(value, bool)
    elif expected == "string":
        ok = isinstance(value, str)
    elif expected == "geometry":
        ok = hasattr(value, "geom_type") or (isinstance(value, dict) and "type" in value)
    if not ok:
        return _r("type_validation", FAIL,
                  f"expected {expected}, got {type(value).__name__}",
                  {"expected": expected, "observed": type(value).__name__},
                  blocking=True)
    return _r("type_validation", PASS, f"type {expected} ok",
              {"expected": expected})


# --- 3. null / missing analysis (NEVER coerce missing -> 0) --------------------
def null_missing_analysis(rows: List[Dict[str, Any]], field: str) -> Dict[str, Any]:
    observed = missing = 0
    for row in rows:
        if _is_missing(row.get(field)):
            missing += 1
        else:
            observed += 1
    total = observed + missing
    coverage = (observed / total) if total else 0.0
    status = PASS if missing == 0 else WARN
    return _r("null_missing_analysis", status,
              f"observed={observed} missing={missing} (missing kept separate, never zero)",
              {"field": field, "observed": observed, "missing": missing,
               "total": total, "coverage": round(coverage, 4)})


# --- 4. duplicate detection ----------------------------------------------------
def duplicate_detection(rows: List[Dict[str, Any]], key_fields: Sequence[str]) -> Dict[str, Any]:
    seen: Dict[tuple, int] = {}
    dups: List[Dict[str, Any]] = []
    for i, row in enumerate(rows):
        k = tuple(row.get(f) for f in key_fields)
        if k in seen:
            dups.append({"row_index": i, "duplicate_of": seen[k], "key": list(k)})
        else:
            seen[k] = i
    status = PASS if not dups else WARN
    return _r("duplicate_detection", status,
              f"{len(dups)} duplicate rows on {list(key_fields)}",
              {"duplicate_count": len(dups), "duplicates": dups[:20]})


# --- 5. unit validation (declared vs registry واحد) ----------------------------
def unit_validation(declared_unit: Optional[str], registry_unit: Optional[str]) -> Dict[str, Any]:
    if registry_unit is None:
        return _r("unit_validation", WARN, "registry unit unknown; cannot verify",
                  {"declared": declared_unit, "registry": None})
    if declared_unit is None:
        return _r("unit_validation", WARN, "declared unit missing",
                  {"declared": None, "registry": registry_unit})
    match = str(declared_unit).strip().lower() == str(registry_unit).strip().lower()
    if not match:
        return _r("unit_validation", FAIL,
                  f"unit mismatch: declared '{declared_unit}' vs registry '{registry_unit}'",
                  {"declared": declared_unit, "registry": registry_unit},
                  blocking=True)
    return _r("unit_validation", PASS, "unit matches registry",
              {"declared": declared_unit, "registry": registry_unit})


# --- 6. date validation --------------------------------------------------------
def date_validation(value: Any, min_year: int = 1900, max_year: Optional[int] = None) -> Dict[str, Any]:
    if _is_missing(value):
        return _r("date_validation", WARN, "date missing", {"value": None})
    max_year = max_year or (datetime.datetime.now(datetime.timezone.utc).year + 1)
    dt = None
    try:
        if isinstance(value, (datetime.date, datetime.datetime)):
            dt = value
        else:
            dt = datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return _r("date_validation", FAIL, f"unparseable date: {value!r}",
                  {"value": str(value)}, blocking=True)
    y = dt.year
    if not (min_year <= y <= max_year):
        return _r("date_validation", FAIL,
                  f"date year {y} outside plausible [{min_year},{max_year}]",
                  {"value": str(value), "year": y}, blocking=True)
    return _r("date_validation", PASS, "date parses and is plausible",
              {"value": str(value), "year": y})


# --- 7. range validation (uncalibrated -> PENDING, not INVALID) ----------------
def range_validation(value: Any, lu: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if _is_missing(value):
        return _r("range_validation", WARN, "value missing", {"value": None})
    if lu is None:
        return _r("range_validation", WARN,
                  "no registry L/U for indicator -> range cannot be verified",
                  {"value": value, "lu": None, "verdict": "PENDING_VALIDATION"})
    lu_status = lu.get("lu_status")
    if lu_status in ("PENDING_VALIDATION", "OBSERVED_RANGE_UNCALIBRATED") or lu.get("L") is None or lu.get("U") is None:
        # do NOT flag INVALID just because calibration is missing
        return _r("range_validation", WARN,
                  f"L/U uncalibrated (lu_status={lu_status}); standardized verdict deferred",
                  {"value": value, "L": lu.get("L"), "U": lu.get("U"),
                   "lu_status": lu_status, "verdict": "PENDING_VALIDATION"})
    L, U = lu["L"], lu["U"]
    lo, hi = (L, U) if L <= U else (U, L)
    inside = lo <= value <= hi
    return _r("range_validation", PASS if inside else WARN,
              ("within calibrated range" if inside else "outside calibrated range (flagged, not deleted)"),
              {"value": value, "L": L, "U": U, "inside": inside})


# --- 8. outlier detection (flag only; never delete) ----------------------------
def outlier_detection(values: Sequence[float], k: float = 1.5) -> Dict[str, Any]:
    nums = [v for v in values if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if len(nums) < 4:
        return _r("outlier_detection", WARN, "too few numeric values for IQR",
                  {"n": len(nums)})
    s = sorted(nums)
    n = len(s)
    def q(p):
        idx = p * (n - 1)
        lo = int(math.floor(idx)); hi = int(math.ceil(idx))
        if lo == hi:
            return s[lo]
        return s[lo] + (s[hi] - s[lo]) * (idx - lo)
    q1, q3 = q(0.25), q(0.75)
    iqr = q3 - q1
    lo_f, hi_f = q1 - k * iqr, q3 + k * iqr
    outliers = [v for v in nums if v < lo_f or v > hi_f]
    return _r("outlier_detection", PASS if not outliers else WARN,
              f"{len(outliers)} IQR outliers flagged (not removed)",
              {"q1": q1, "q3": q3, "iqr": iqr, "fence": [lo_f, hi_f],
               "outlier_count": len(outliers), "outliers": outliers[:20]})


# --- aggregate quality score ---------------------------------------------------
def data_quality_score(checks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Deterministic aggregate. PASS=1, WARN=0.5, non-blocking FAIL=0.
    A blocking FAIL sets is_valid=False (record must become INVALID)."""
    if not checks:
        return {"score": 0.0, "coverage": 0.0, "is_valid": False,
                "blocking_failures": [], "detail": "no checks run"}
    weight = {PASS: 1.0, WARN: 0.5, FAIL: 0.0}
    score = sum(weight[c["status"]] for c in checks) / len(checks)
    blocking = [c["check"] for c in checks if c.get("blocking") and c["status"] == FAIL]
    # coverage taken from any null_missing_analysis check present
    coverage = None
    for c in checks:
        if c["check"] == "null_missing_analysis":
            coverage = c["findings"].get("coverage")
    return {"score": round(score, 4),
            "coverage": coverage,
            "is_valid": len(blocking) == 0,
            "blocking_failures": blocking,
            "n_checks": len(checks)}
