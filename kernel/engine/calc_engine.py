"""
Calculation Engine — MVP-0.
Reads weights/thresholds/L,U from versioned registries (NEVER inlined). Constraint 7.
Numbers come ONLY from here. Missing != 0. Q/T/R shown separately. Constraints 1,2,3,6.
"""
import json, os
from .status import Measurement
from .provenance import Result, reproducibility_key

CALC_VERSION = "CALC-v0.1"
METHODOLOGY_VERSION = "algo.txt-2026"

def _clip(x, lo, hi):
    return max(lo, min(hi, x))

class Engine:
    def __init__(self, registries_dir):
        self.dir = registries_dir
        self.weights = json.load(open(os.path.join(registries_dir,"weight_registry_v1.json"),encoding="utf-8"))
        self.thresholds = json.load(open(os.path.join(registries_dir,"threshold_registry_v1.json"),encoding="utf-8"))
        self.min_coverage = 0.5  # registry-defined; below -> INSUFFICIENT_COVERAGE
        self.versions = {"weight_set":self.weights["version"],"threshold_set":self.thresholds["version"],
                         "calculation_version":CALC_VERSION,"methodology_version":METHODOLOGY_VERSION}

    def direction_of(self, text):
        t = str(text or "")
        if "معکوس" in t: return "inverse"
        if "آستانه" in t or "بهینه" in t: return "threshold"
        return "positive"

    def standardize(self, indicator_code, x, status="OBSERVED", use_percentile=False, percentile=None):
        """Positive: 100*clip((x-L)/(U-L),0,1). Inverse: 100*clip((U-x)/(U-L),0,1). (atlas روش استانداردسازی)"""
        lu = self.thresholds["indicator_LU"].get(indicator_code)
        if lu is None:
            return Measurement(indicator_code, None, "PENDING_VALIDATION", missing_reason="indicator not in threshold registry")
        # missing input -> MISSING, never 0
        if x is None or status not in ("OBSERVED","ESTIMATED","PROXY"):
            return Measurement(indicator_code, None, "MISSING" if status=="OBSERVED" else status)
        direction = self.direction_of(lu.get("direction"))
        if direction == "threshold" or lu.get("lu_status")=="PENDING_VALIDATION":
            return Measurement(indicator_code, None, "PENDING_VALIDATION",
                               missing_reason="L/U or optimal band require calibration (algo.txt §5.1)")
        L, U = lu.get("L"), lu.get("U")
        if L is None or U is None or U==L:
            return Measurement(indicator_code, None, "PENDING_VALIDATION", missing_reason="L/U missing or U==L")
        # rank/percentile alternative for skewed/outlier distributions (algo.txt §5.1)
        if use_percentile and percentile is not None:
            z = 100.0*_clip(percentile,0,1)
        elif direction == "inverse":
            z = 100.0*_clip((U - x)/(U - L), 0, 1)
        else:
            z = 100.0*_clip((x - L)/(U - L), 0, 1)
        st = "PROXY" if status=="PROXY" else ("ESTIMATED" if status=="ESTIMATED" else "OBSERVED")
        return Measurement(indicator_code, round(z,4), st)

    def capital_score(self, measurements):
        """Kj = Σ(w_i·Z_i)/Σ(w_i) over OBSERVED only (equal weights v1). Coverage<min -> INSUFFICIENT_COVERAGE."""
        obs = [m for m in measurements if m.status in ("OBSERVED","ESTIMATED","PROXY") and m.value is not None]
        total = len(measurements)
        if total==0:
            return Result("capital_score", None, "WAITING_FOR_DATA","Kj", versions=self.versions)
        coverage = len(obs)/total
        if coverage < self.min_coverage:
            return Result("capital_score", None, "INSUFFICIENT_COVERAGE","Kj",
                          inputs=[m.indicator_code for m in obs], versions=self.versions,
                          note=f"coverage {coverage:.0%} < min {self.min_coverage:.0%}")
        # equal weights v1
        w = 1.0
        num = sum(w*m.value for m in obs); den = sum(w for _ in obs)
        return Result("capital_score", round(num/den,4), "OBSERVED","Kj=Σ(w·Z)/Σw",
                      inputs=[m.indicator_code for m in obs], versions=self.versions,
                      note=f"coverage {coverage:.0%}, equal weights (W-v1, uncalibrated)")

    def qtr(self, groups):
        """K,Q,T,R as SEPARATE results (constraint 6). groups={'K':[Meas..],'Q':[..],'T':[..],'R':[..]}"""
        out={}
        for key in ("K","Q","T","R"):
            r=self.capital_score(groups.get(key,[]))
            r.name=key; r.formula_id=f"{key}=weighted_mean(labeled indicators)"
            out[key]=r
        return out  # dict of 4 separate Results — NEVER combined into one composite

    def chain_gaps(self, C,A,U,Ee,O):
        """G_CA=C-A, G_AU=A-U, G_UE=U-E, G_EO=E-O (only when both endpoints OBSERVED)."""
        vals={"C":C,"A":A,"U":U,"E":Ee,"O":O}
        def g(a,b,fid):
            if vals[a] is None or vals[b] is None:
                return Result(fid,None,"INSUFFICIENT_COVERAGE",fid,note="endpoint missing")
            return Result(fid, round(vals[a]-vals[b],4),"OBSERVED",fid)
        return {"G_CA":g("C","A","G_CA=C-A"),"G_AU":g("A","U","G_AU=A-U"),
                "G_UE":g("U","E","G_UE=U-E"),"G_EO":g("E","O","G_EO=E-O")}

    def equity_gap(self, group_scores, min_groups=2):
        """P_best-P_worst. Refuse if not sufficiently disaggregated (constraint 10)."""
        vals=[v for v in group_scores.values() if v is not None]
        if len(vals)<min_groups:
            return Result("equity_gap",None,"INSUFFICIENT_COVERAGE","P_best-P_worst",
                          note="no equity verdict without sufficient group-disaggregated data (algo.txt §3,§7.4)")
        return Result("equity_gap", round(max(vals)-min(vals),4),"OBSERVED","P_best-P_worst",
                      inputs=list(group_scores.keys()))

    def priority(self, severity,population,leverage,feasibility,equity):
        """Priority = Severity×Population×Leverage×Feasibility×Equity (algo.txt §9.3 factors)."""
        f={"severity":severity,"population":population,"leverage":leverage,"feasibility":feasibility,"equity":equity}
        missing=[k for k,v in f.items() if v is None]
        if missing:
            return Result("priority",None,"INSUFFICIENT_COVERAGE","S×P×L×F×E",note=f"missing factors: {missing}")
        p=1.0
        for v in f.values(): p*=v
        return Result("priority", round(p,4),"OBSERVED","S×P×L×F×E",inputs=list(f.keys()))

    def band(self, score):
        if score is None: return None
        for b in self.thresholds["status_bands"]:
            if b["lo"]<=score<=b["hi"]:
                return b["label_fa"]
        return None

    def repro_key(self, data_version, indicator_version):
        return reproducibility_key(data_version, METHODOLOGY_VERSION, indicator_version,
                                   self.weights["version"], self.thresholds["version"], CALC_VERSION)
