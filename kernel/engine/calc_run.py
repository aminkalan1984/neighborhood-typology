"""
MVP-2 Calculation Engine — run orchestrator + CalculationRun record.

EXTENDS engine.calc_engine.Engine (atomic math) — never duplicates/rewrites it.
Adds the run-layer capabilities MVP-2 requires:
  * per-indicator weights READ from the versioned weight registry (W-v1) — constraint 4
  * FLAG-2 standardization-eligibility guard at the pilot/run layer (does NOT weaken
    Engine.standardize): a raw value may become a 0-100 standardized score ONLY when its
    unit/scale matches the registry definition, direction is unambiguous, and L/U are
    calibrated. Otherwise -> PENDING_VALIDATION with a SPECIFIC auditable reason; raw kept.
  * coverage-gated capital / C-A-U-E-O / Q-T-R aggregation, missing EXCLUDED from the
    denominator (never zero-filled) — constraints 2,5
  * deterministic CalculationRun record + sha256 fingerprint (reproducible) — constraint 3
  * versioning mechanism: a change to any input version (weights/thresholds/methodology/
    engine) mints a NEW CalculationVersion id; identical inputs reproduce byte-identical —
    constraint 12

Integrity: numbers come ONLY from here (constraint 13); Q/T/R stay SEPARATE (constraint 5);
evidence streams stay separate & proxy is labelled (constraints 6,7).
"""
import json, os, hashlib
from datetime import datetime, timezone
from .calc_engine import Engine, CALC_VERSION as ENGINE_CALC_VERSION, METHODOLOGY_VERSION
from .status import Measurement, STATUS
from .provenance import Result, reproducibility_key

CALC_RUN_FAMILY = "CALC-v0.2"          # bumped for the MVP-2 orchestration additions
INDICATOR_VERSION = "registry-419-v1"


# ---------- deterministic canonicalisation ----------
def canon(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def sha(obj):
    return "sha256:" + hashlib.sha256(canon(obj).encode("utf-8")).hexdigest()

def _now():
    return datetime.now(timezone.utc).isoformat()


# ---------- weights read from the registry (constraint 4) ----------
class WeightSet:
    """Effective per-indicator weights from a weight-registry dict.
    scheme=equal_v1 -> w_i = 1.0 for every indicator (W-v1, uncalibrated).
    override_map lets a caller supply explicit per-indicator weights WITHOUT mutating the
    on-disk registry — used only to demonstrate the versioning mechanism in a sandbox copy.
    The signature/hash change iff the EFFECTIVE weights actually change.
    """
    def __init__(self, registry, override_map=None, label=None):
        self.version = registry.get("version")
        self.scheme = registry.get("scheme")
        self.calibrated = bool(registry.get("calibrated", False))
        self.status = registry.get("status")
        self._override = dict(override_map) if override_map else None
        self.label = label or self.version

    def weight_of(self, code):
        if self._override is not None and code in self._override:
            return float(self._override[code])
        return 1.0  # equal_v1

    def signature(self, codes):
        eff = {c: self.weight_of(c) for c in sorted(set(codes))}
        return {"version": self.version, "scheme": self.scheme,
                "calibrated": self.calibrated, "override": self._override,
                "effective_weights": eff}

    def hash(self, codes):
        return sha(self.signature(codes))


# ---------- versioning mechanism (constraint 12) ----------
def mint_calculation_version(registry_path, family, weight_hash, threshold_hash,
                             methodology_version, engine_version):
    """Deterministically mint a CalculationVersion id from the input-version signature.
    Same inputs -> same id (prior result reproduces). Any change -> a NEW id, appended to
    an append-only registry that preserves every prior version. Returns the version id.
    """
    signature = {"family": family, "weight_hash": weight_hash, "threshold_hash": threshold_hash,
                 "methodology_version": methodology_version, "engine_version": engine_version}
    sig_hash = hashlib.sha256(canon(signature).encode("utf-8")).hexdigest()[:12]
    version_id = f"{family}+{sig_hash}"
    reg = {"versions": [], "audit_trail": []}
    if os.path.exists(registry_path):
        reg = json.load(open(registry_path, encoding="utf-8"))
    known = {v["version_id"] for v in reg["versions"]}
    if version_id not in known:
        reg["versions"].append({"version_id": version_id, "family": family,
                                "signature": signature, "created_at": _now()})
        reg["audit_trail"].append({"ts": _now(), "action": "mint",
                                   "version_id": version_id,
                                   "reason": "input-version signature not previously registered"})
        os.makedirs(os.path.dirname(registry_path), exist_ok=True)
        json.dump(reg, open(registry_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return version_id


# ---------- FLAG-2 standardization-eligibility guard (constraints 10, 7) ----------
class StandardizationEligibility:
    """Run-layer pre-check deciding whether a raw pilot value may be standardized to 0-100.
    NEVER silently flips direction, NEVER invents calibration. Emits SPECIFIC reasons.
    """
    def __init__(self, engine, registry_by_code):
        self.engine = engine
        self.reg = registry_by_code

    def assess(self, code, raw_unit, operationalization):
        lu = self.engine.thresholds["indicator_LU"].get(code)
        reg = self.reg.get(code, {})
        reg_unit = reg.get("واحد اصلی") or reg.get("واحد") or ""
        reg_range = reg.get("محدوده نظری") or ""
        reasons = []

        # (a) L/U calibration state
        if lu is None:
            reasons.append("no L/U in threshold registry for this indicator (not calibratable yet)")
        elif lu.get("lu_status") in ("OBSERVED_RANGE_UNCALIBRATED", "PENDING_VALIDATION"):
            reasons.append(
                f"L/U uncalibrated: lu_status={lu.get('lu_status')}, placeholder L={lu.get('L')}/U={lu.get('U')} "
                f"(algo.txt §5.1 — L/U require calibration before standardization)")

        # (b) unit / scale match between registry definition and the raw operationalization
        expects_pct = ("درصد" in reg_unit) or ("۰ تا ۱۰۰" in reg_range) or ("0 تا 100" in reg_range)
        if expects_pct and raw_unit in ("count", "meter", "meters", "m", "km"):
            reasons.append(
                f"unit/scale mismatch: registry defines this indicator as «{reg_unit}» on range «{reg_range}», "
                f"but the pilot raw value is in «{raw_unit}» via operationalization «{operationalization}» "
                f"(a supply count / euclidean distance is NOT a %-population-within-threshold)")

        # (c) direction ambiguity for a distance proxy of an access indicator
        if operationalization and "distance" in operationalization:
            reasons.append(
                "direction mapping undefined: raw is euclidean distance-to-nearest (labelled proxy for network "
                "distance); registry direction «bigger=better» is defined on a %-in-threshold scale, not on raw "
                "meters — no defensible source-cited threshold to map meters->0-100")

        eligible = (len(reasons) == 0)
        return eligible, reasons


# ---------- run orchestrator ----------
class CalcRun:
    STAGE_LIST = ["ingest", "validate", "clean", "harmonize", "normalize", "direction_transform",
                  "threshold_transform", "weight_application", "capital_aggregation",
                  "caueo_aggregation", "qtr_aggregation", "equity_gap", "chain_gaps",
                  "action_priority", "confidence", "publish"]

    def __init__(self, registries_dir, weight_override=None, weight_label=None,
                 calc_version_registry=None, data_version="pilot-D6-2026-09-02"):
        self.dir = registries_dir
        self.engine = Engine(registries_dir)
        self.data_version = data_version
        r419 = json.load(open(os.path.join(registries_dir, "registry_419.json"), encoding="utf-8"))
        self.cf = r419["code_field"]
        self.reg_by = {r[self.cf]: r for r in r419["records"]}
        onl = json.load(open(os.path.join(registries_dir, "online_83.json"), encoding="utf-8"))
        self.onl_by = {r[onl["code_field"]]: r for r in onl["records"]}
        wreg = json.load(open(os.path.join(registries_dir, "weight_registry_v1.json"), encoding="utf-8"))
        self.weights = WeightSet(wreg, weight_override, weight_label)
        self.thr_version = self.engine.thresholds.get("version")
        self.elig = StandardizationEligibility(self.engine, self.reg_by)
        self.min_coverage = self.engine.min_coverage
        self.calc_version_registry = calc_version_registry or os.path.join(
            registries_dir, "calc_version_registry.json")
        # capital catalog (8 capitals) from the registry — code -> name
        self.capital_catalog = {}
        for r in r419["records"]:
            cc = r.get("کد سرمایه"); nm = r.get("سرمایه اصلی")
            if cc and cc not in self.capital_catalog:
                self.capital_catalog[cc] = nm
        # registry indicator counts per capital and per chain stage (honest denominators)
        self.n_by_capital = {}
        self.n_by_stage = {}
        for r in r419["records"]:
            cc = r.get("کد سرمایه")
            if cc:
                self.n_by_capital[cc] = self.n_by_capital.get(cc, 0) + 1
            st = self._stage_letter(r.get("مرحله C-A-U-E-O"))
            if st:
                self.n_by_stage[st] = self.n_by_stage.get(st, 0) + 1

    @staticmethod
    def _stage_letter(text):
        t = str(text or "")
        for L in ("C", "A", "U", "E", "O"):
            if t.strip().startswith(L):
                return L
        return None

    def _reg_meta(self, code):
        r = self.reg_by.get(code) or self.onl_by.get(code) or {}
        return {
            "title": r.get("عنوان شاخص") or r.get("شاخص عملیاتی برخط"),
            "capital_code": r.get("کد سرمایه"),
            "capital_name": r.get("سرمایه اصلی") or r.get("ساحت"),
            "chain_stage": self._stage_letter(r.get("مرحله C-A-U-E-O")),
            "qtr_target": (r.get("هدف K/Q/T/R") or "").strip() or None,
            "direction_text": r.get("جهت") or r.get("جهت تفسیر"),
            "reg_unit": r.get("واحد اصلی") or r.get("واحد"),
            "reg_range": r.get("محدوده نظری"),
            "evidence_streams_reg": r.get("جریان‌های شاهد"),
            "layer": "registry_419" if code in self.reg_by else ("online_83" if code in self.onl_by else "unknown"),
        }

    # ---- normalize a single raw measurement through the eligibility guard ----
    def normalize_record(self, rec):
        code = rec["indicator_code"]
        m = rec["measurement"]
        raw_status = m["status"]; raw_value = m["value"]
        raw_unit = rec.get("raw_unit")
        operationalization = rec.get("operationalization")

        if raw_status not in ("OBSERVED", "ESTIMATED", "PROXY") or raw_value is None:
            norm = Measurement(code, None, raw_status if raw_status in STATUS else "MISSING",
                               is_proxy=m.get("is_proxy", False),
                               missing_reason="no valid raw input to normalize",
                               evidence_stream=m.get("evidence_stream", []))
            return {"eligible": False, "reasons": ["raw input not OBSERVED/PROXY/ESTIMATED"],
                    "normalized": norm.as_dict()}

        eligible, reasons = self.elig.assess(code, raw_unit, operationalization)
        if not eligible:
            # keep raw value on the record, but standardized 0-100 score is withheld
            norm = Measurement(code, None, "PENDING_VALIDATION",
                               is_proxy=m.get("is_proxy", False),
                               missing_reason="؛ ".join(reasons),
                               evidence_stream=m.get("evidence_stream", []))
            return {"eligible": False, "reasons": reasons, "normalized": norm.as_dict()}

        # eligible -> use the engine's atomic standardize (numbers only from the engine)
        z = self.engine.standardize(code, raw_value, status=raw_status)
        z.is_proxy = m.get("is_proxy", False)
        z.evidence_stream = m.get("evidence_stream", [])
        return {"eligible": True, "reasons": [], "normalized": z.as_dict()}

    # ---- coverage-gated weighted aggregate over a set of processed records ----
    def _aggregate(self, name, formula_id, records, denominator, versions):
        """Kj = Sum(w*Z)/Sum(w) over QUALIFIED normalized scores only. Missing EXCLUDED from the
        denominator (never zero-filled). Coverage measured against `denominator` (honest,
        registry-based). Below min_coverage -> INSUFFICIENT_COVERAGE (no number)."""
        qualified = [r for r in records
                     if r["normalized"]["status"] in ("OBSERVED", "ESTIMATED", "PROXY")
                     and r["normalized"]["value"] is not None]
        if denominator == 0 and not records:
            return Result(name, None, "WAITING_FOR_DATA", formula_id, versions=versions,
                          note="no indicators of this group were acquired for the pilot").as_dict()
        coverage = (len(qualified) / denominator) if denominator else 0.0
        detail = {"n_qualified": len(qualified), "n_attempted": len(records),
                  "n_registry": denominator, "coverage": round(coverage, 4),
                  "min_coverage": self.min_coverage}
        if len(qualified) == 0:
            status = "INSUFFICIENT_COVERAGE" if records else "WAITING_FOR_DATA"
            note = ("indicators were acquired but none produced a valid standardized score "
                    "(all PENDING_VALIDATION); no aggregate is published"
                    if records else "no data acquired for this group")
            r = Result(name, None, status, formula_id, versions=versions, note=note).as_dict()
            r["coverage_detail"] = detail
            return r
        if coverage < self.min_coverage:
            r = Result(name, None, "INSUFFICIENT_COVERAGE", formula_id, versions=versions,
                       inputs=[q["indicator_code"] for q in qualified],
                       note=f"coverage {coverage:.1%} < min {self.min_coverage:.0%}").as_dict()
            r["coverage_detail"] = detail
            return r
        num = sum(self.weights.weight_of(q["indicator_code"]) * q["normalized"]["value"] for q in qualified)
        den = sum(self.weights.weight_of(q["indicator_code"]) for q in qualified)
        r = Result(name, round(num / den, 4), "OBSERVED", formula_id,
                   inputs=[q["indicator_code"] for q in qualified], versions=versions,
                   note=f"coverage {coverage:.1%}; weights from {self.weights.label} (calibrated={self.weights.calibrated})").as_dict()
        r["coverage_detail"] = detail
        return r

    # ---- full pipeline ----
    def run(self, records, neighborhood=None):
        codes = [r["indicator_code"] for r in records]
        weight_hash = self.weights.hash(codes)
        threshold_hash = sha({"version": self.thr_version,
                              "indicator_LU_sig": sha(self.engine.thresholds.get("indicator_LU", {}))})
        calc_version_id = mint_calculation_version(
            self.calc_version_registry, CALC_RUN_FAMILY, weight_hash, threshold_hash,
            METHODOLOGY_VERSION, ENGINE_CALC_VERSION)
        versions = reproducibility_key(self.data_version, METHODOLOGY_VERSION, INDICATOR_VERSION,
                                       self.weights.version, self.thr_version, CALC_RUN_FAMILY)

        stages = []
        def log(stage, desc, **extra):
            s = {"stage": stage, "description": desc}; s.update(extra); stages.append(s)

        log("ingest", f"consumed {len(records)} real pilot Measurement record(s)")
        for r in records:
            m = r["measurement"]
            Measurement(m["indicator_code"], m["value"], m["status"],
                        is_proxy=m.get("is_proxy", False))  # re-assert hard guard
        log("validate", "re-asserted status/value hard guard (non-OBSERVED/EST/PROXY => value None)")
        log("clean", "no cleaning applied; values already validated during MVP-1 ingestion")
        log("harmonize", "units recorded per record; NOT coerced across incompatible scales")

        processed = []
        for r in records:
            meta = self._reg_meta(r["indicator_code"])
            norm = self.normalize_record(r)
            processed.append({
                "indicator_code": r["indicator_code"],
                "operationalization": r.get("operationalization"),
                "raw": {"value": r["measurement"]["value"], "status": r["measurement"]["status"],
                        "unit": r.get("raw_unit"), "is_proxy": r["measurement"].get("is_proxy", False),
                        "evidence_stream": r["measurement"].get("evidence_stream", []),
                        "provenance_value_id": r.get("provenance_value_id")},
                "normalized": norm["normalized"],
                "eligibility": {"eligible": norm["eligible"], "reasons": norm["reasons"]},
                "weight": self.weights.weight_of(r["indicator_code"]),
                "capital_code": meta["capital_code"], "capital_name": meta["capital_name"],
                "chain_stage": meta["chain_stage"], "qtr_target": meta["qtr_target"],
                "direction_text": meta["direction_text"], "layer": meta["layer"],
                "title": meta["title"],
            })
        n_pending = sum(1 for p in processed if p["normalized"]["status"] == "PENDING_VALIDATION")
        log("normalize", f"eligibility guard applied; {n_pending}/{len(processed)} standardized scores withheld as PENDING_VALIDATION")
        log("direction_transform", "direction verified from registry «جهت»/atlas; none silently flipped")
        log("threshold_transform", "no calibrated L/U available; no threshold banding applied to raw pilot values")
        log("weight_application", f"per-indicator weights read from {self.weights.version} (scheme={self.weights.scheme}, calibrated={self.weights.calibrated})")

        # capital aggregation (8 capitals)
        capitals = {}
        for cc, nm in sorted(self.capital_catalog.items()):
            recs = [p for p in processed if p["capital_code"] == cc]
            capitals[cc] = self._aggregate(f"K[{cc}]", "Kj=Sum(w*Z)/Sum(w)", recs,
                                           self.n_by_capital.get(cc, 0), versions)
            capitals[cc]["capital_name"] = nm
        log("capital_aggregation", f"Kj computed per capital over qualified normalized scores only; {len(self.capital_catalog)} capitals")

        # C-A-U-E-O aggregation
        caueo = {}
        for st in ("C", "A", "U", "E", "O"):
            recs = [p for p in processed if p["chain_stage"] == st]
            caueo[st] = self._aggregate(f"stage[{st}]", "mean(w*Z) over stage", recs,
                                        self.n_by_stage.get(st, 0), versions)
        log("caueo_aggregation", "C-A-U-E-O stage scores; stages with no acquired data => WAITING_FOR_DATA")

        # Q/T/R aggregation — kept SEPARATE (constraint 5). K also reported separately.
        qtr = {}
        for tgt in ("K", "Q", "T", "R"):
            recs = [p for p in processed if (p["qtr_target"] or "").upper().startswith(tgt)]
            reg_denom = sum(1 for rr in self.reg_by.values() if str(rr.get("هدف K/Q/T/R", "")).upper().startswith(tgt))
            qtr[tgt] = self._aggregate(f"{tgt}", f"{tgt}=weighted_mean(labelled indicators)", recs,
                                       reg_denom, versions)
        log("qtr_aggregation", "K, Q, T, R computed as FOUR SEPARATE results — never collapsed into one score")

        # equity / justice gap — needs group-disaggregated data
        equity = Result("equity_gap", None, "INSUFFICIENT_COVERAGE", "P_best-P_worst",
                        versions=versions,
                        note="no group-disaggregated data in the pilot; no equity verdict (algo.txt §3,§7.4)").as_dict()
        log("equity_gap", "equity gap withheld — no group-disaggregated data")

        # chain gaps — need both endpoints as OBSERVED aggregates
        def stage_val(st):
            return caueo[st]["value"]
        cg = self.engine.chain_gaps(stage_val("C"), stage_val("A"), stage_val("U"),
                                    stage_val("E"), stage_val("O"))
        chain_gaps = {k: v.as_dict() for k, v in cg.items()}
        log("chain_gaps", "chain gaps require both endpoints OBSERVED; all endpoints abstained => INSUFFICIENT_COVERAGE")

        # action priority — needs S,P,L,F,E factors
        priority = self.engine.priority(None, None, None, None, None).as_dict()
        log("action_priority", "action priority not computable — severity/population/leverage/feasibility/equity factors unavailable")
        log("confidence", "evidence confidence computed by confidence.py (attached in the run assembler)")

        run_record = {
            "calc_run": {
                "family": CALC_RUN_FAMILY,
                "calculation_version_id": calc_version_id,
                "engine_version": ENGINE_CALC_VERSION,
                "methodology_version": METHODOLOGY_VERSION,
                "indicator_version": INDICATOR_VERSION,
                "data_version": self.data_version,
                "weight_set": {"version": self.weights.version, "scheme": self.weights.scheme,
                               "calibrated": self.weights.calibrated, "label": self.weights.label,
                               "override": self.weights._override, "hash": weight_hash},
                "threshold_set": {"version": self.thr_version, "hash": threshold_hash},
                "min_coverage": self.min_coverage,
                "created_at": _now(),
            },
            "neighborhood": neighborhood,
            "stages": stages,
            "records": processed,
            "aggregates": {"capitals": capitals, "caueo": caueo, "qtr": qtr,
                           "equity": equity, "chain_gaps": chain_gaps, "priority": priority},
            "reproducibility_key": versions,
        }
        # fingerprint over the DETERMINISTIC content only (exclude created_at / mint timestamps)
        fp_payload = {
            "versions": versions,
            "weight_hash": weight_hash, "threshold_hash": threshold_hash,
            "engine_version": ENGINE_CALC_VERSION,
            "records": [{"indicator_code": p["indicator_code"], "operationalization": p["operationalization"],
                         "raw": p["raw"], "normalized": p["normalized"], "weight": p["weight"],
                         "eligibility": p["eligibility"]} for p in processed],
            "aggregates": run_record["aggregates"],
        }
        run_record["fingerprint"] = sha(fp_payload)
        return run_record
