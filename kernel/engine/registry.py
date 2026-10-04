# -*- coding: utf-8 -*-
"""
Registry access — the ONE place the kernel reads indicator definitions from.

Master instruction §7: there is exactly one indicator registry
(`registries/indicator_registry.json`). Nothing else may define indicators.
Mapping is EXPLICIT ONLY (§7.5): a code without a declared mapping is UNMAPPED
and its data must not enter calculation.

Calibration values (L/U) live in the separate *calibration* registry
(`threshold_registry_v1.json`) because calibration is methodology, not
indicator definition — but it is read through this same accessor so that there
is a single audit path.
"""
from __future__ import annotations

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
KROOT = os.path.dirname(HERE)
REG_DIR = os.path.join(KROOT, "registries")

INDICATOR_REGISTRY = "indicator_registry.json"
CALIBRATION_REGISTRY = "threshold_registry_v1.json"
WEIGHT_REGISTRY = "weight_registry_v1.json"
METHODOLOGY_REGISTRY = "methodology_registry.json"
SOURCE_REGISTRY = "source_registry.json"
INTERVENTION_REGISTRY = "intervention_registry.json"

# indicator statuses that may carry a number (§10, §12)
USABLE_STATUSES = ("OBSERVED", "ESTIMATED", "PROXY")


def _load(name: str):
    with open(os.path.join(REG_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def _load_if(name: str):
    try:
        return _load(name)
    except Exception:
        return None


class IndicatorRegistry:
    """Read-only view over the single master indicator registry."""

    def __init__(self, registries_dir: str | None = None):
        self.dir = registries_dir or REG_DIR
        with open(os.path.join(self.dir, INDICATOR_REGISTRY), encoding="utf-8") as f:
            reg = json.load(f)
        self.version = reg["version"]
        self.records = reg["records"]
        self.by_code = {r["canonical_id"]: r for r in self.records}
        self.unmapped_codes = set(reg.get("unmapped_codes") or [])
        self.counts = reg.get("counts") or {}
        # calibration (L/U) — separate registry, same accessor
        cal = _load_if(CALIBRATION_REGISTRY) or {}
        self.calibration_version = cal.get("version")
        self.calibration_calibrated = bool(cal.get("calibrated", False))
        self.lu = cal.get("indicator_LU", {}) or {}
        self.status_bands = cal.get("status_bands", []) or []
        # weights — read only, never inlined (§20)
        w = _load_if(WEIGHT_REGISTRY) or {}
        self.weight_version = w.get("version")
        self.weight_scheme = w.get("scheme")
        self.weight_calibrated = bool(w.get("calibrated", False))
        self.weight_status = w.get("status")

    # ---- indicator lookup ----------------------------------------------------
    def get(self, code: str):
        return self.by_code.get(code)

    def is_known(self, code: str) -> bool:
        return code in self.by_code

    def is_unmapped(self, code: str) -> bool:
        """§7.5 — UNMAPPED codes must not enter calculation."""
        rec = self.by_code.get(code)
        if rec is None:
            return True
        return not (rec.get("mapping") or {}).get("explicit", False)

    def direction(self, code: str) -> str:
        rec = self.by_code.get(code)
        if rec is None:
            return "positive"
        return rec.get("direction") or "positive"

    def capital(self, code: str):
        rec = self.by_code.get(code)
        return rec.get("capital") if rec else None

    def stage(self, code: str):
        rec = self.by_code.get(code)
        return rec.get("chain_stage") if rec else None

    def qtr_target(self, code: str):
        rec = self.by_code.get(code)
        return rec.get("qtr_target") if rec else None

    def evidence_streams(self, code: str):
        rec = self.by_code.get(code)
        return list(rec.get("evidence_streams") or []) if rec else []

    def is_core(self, code: str) -> bool:
        rec = self.by_code.get(code)
        return bool(rec and rec.get("core"))

    def indicator_class(self, code: str):
        rec = self.by_code.get(code)
        return rec.get("indicator_class") if rec else None

    # ---- calibration ---------------------------------------------------------
    def calibration_of(self, code: str):
        """Return the L/U entry for an indicator, or None when uncalibrated."""
        entry = self.lu.get(code)
        if not entry:
            return None
        status = entry.get("lu_status")
        # §19/§71: an uncalibrated L/U is NOT a publishable scale.
        calibrated = bool(self.calibration_calibrated) and status in ("CALIBRATED", "VALIDATED")
        return {
            "L": entry.get("L"),
            "U": entry.get("U"),
            "status": status,
            "range_text": entry.get("range_text"),
            "calibrated": calibrated,
        }

    def is_calibrated(self, code: str) -> bool:
        c = self.calibration_of(code)
        return bool(c and c.get("calibrated"))

    # ---- weights -------------------------------------------------------------
    def weight_of(self, code: str) -> float:
        """Effective weight from the versioned weight registry (§20)."""
        if self.weight_scheme == "equal_v1":
            return 1.0
        return 1.0

    def weight_meta(self) -> dict:
        return {
            "version": self.weight_version,
            "scheme": self.weight_scheme,
            "calibrated": self.weight_calibrated,
            "status": self.weight_status,
        }

    # ---- counts --------------------------------------------------------------
    def capital_catalog(self) -> dict:
        """capital code -> Persian name, from the registry only."""
        out = {}
        for r in self.records:
            cap = r.get("capital")
            if cap and cap not in out:
                out[cap] = r.get("capital_name_fa") or cap
        return out

    def n_by_capital(self) -> dict:
        out = {}
        for r in self.records:
            cap = r.get("capital")
            if cap:
                out[cap] = out.get(cap, 0) + 1
        return out

    def n_by_stage(self) -> dict:
        out = {}
        for r in self.records:
            st = r.get("chain_stage")
            if st:
                out[st] = out.get(st, 0) + 1
        return out

    def n_by_qtr(self) -> dict:
        out = {}
        for r in self.records:
            t = r.get("qtr_target")
            if t:
                out[t] = out.get(t, 0) + 1
        return out
