# -*- coding: utf-8 -*-
"""
Risk Engine (§32) and Vulnerability Engine (§31).

Risk is computed for a neighbourhood AND for each intervention:
    Probability x Severity x Exposure x Affected Population x Reversibility x Uncertainty
and is always linked to Capital / Chain Stage / Group / Location / Time.

Vulnerability is NOT equity (§31). Equity compares groups; vulnerability combines
    Exposure, Sensitivity, Adaptive Capacity, Access, Dependency
to identify vulnerable groups. A missing component abstains — it never defaults to 0.
"""
from __future__ import annotations

REVERSIBILITY_FA = {
    "reversible": "برگشت‌پذیر",
    "partially_reversible": "تا حدی برگشت‌پذیر",
    "irreversible": "برگشت‌ناپذیر",
}


def _num(x):
    return None if x is None else float(x)


class RiskEngine:
    """Deterministic risk scoring with explicit abstention on missing factors."""

    def risk(self, *, risk_id: str, probability=None, severity=None, exposure=None,
             affected_population=None, reversibility: str | None = None,
             uncertainty: float | None = None, link: dict | None = None) -> dict:
        factors = {
            "probability": _num(probability),
            "severity": _num(severity),
            "exposure": _num(exposure),
            "affected_population": _num(affected_population),
        }
        missing = [k for k, v in factors.items() if v is None]
        base = {
            "risk_id": risk_id,
            "factors": factors,
            "reversibility": reversibility,
            "reversibility_fa": REVERSIBILITY_FA.get(reversibility or "", None),
            "uncertainty": uncertainty,
            "link": link or {},
            "link_fa": "اتصال ریسک به سرمایه × مرحله زنجیره × گروه × مکان × زمان (§۳۲)",
        }
        if missing:
            return {**base, "status": "INSUFFICIENT_DATA", "score": None,
                    "reason_fa": f"عوامل غایب: {', '.join(missing)}؛ بدون همهٔ عوامل هیچ نمرهٔ ریسکی ساخته نمی‌شود.",
                    "needed_fa": "ثبت احتمال، شدت، مواجهه و جمعیت متأثر."}

        # documented multiplicative form; reversibility and uncertainty are penalties
        rev_penalty = {"irreversible": 1.5, "partially_reversible": 1.2, "reversible": 1.0}.get(reversibility or "", 1.0)
        raw = (factors["probability"] * factors["severity"] * factors["exposure"]
               * factors["affected_population"] * rev_penalty)
        unc_penalty = 1.0 + (float(uncertainty) if uncertainty is not None else 0.0)
        return {
            **base,
            "status": "OBSERVED",
            "score": round(raw * unc_penalty, 4),
            "formula_fa": "P × S × E × N × برگشت‌پذیری × (۱ + عدم‌قطعیت)",
            "note_fa": "برگشت‌ناپذیری و عدم‌قطعیت ریسک را بزرگ‌تر می‌کنند، نه کوچک‌تر.",
        }

    def assess(self, *, risks: list) -> dict:
        if not risks:
            return {"status": "NO_RISK_DATA", "risks": [],
                    "reason_fa": "هیچ ریسکی با عوامل کامل ثبت نشده است؛ حکم ریسک صادر نمی‌شود.",
                    "needed_fa": "ثبت ریسک‌ها با احتمال/شدت/مواجهه/جمعیت متأثر و اتصال به سرمایه و مرحله."}
        scored = [r for r in risks if r.get("score") is not None]
        if not scored:
            return {"status": "INSUFFICIENT_DATA", "risks": risks, "top_risks": [],
                    "reason_fa": "هیچ ریسکی عوامل کامل نداشت."}
        ranked = sorted(scored, key=lambda r: r["score"], reverse=True)
        return {
            "status": "OBSERVED",
            "risks": risks,
            "top_risks": ranked[:5],
            "n_scored": len(scored),
            "n_insufficient": len(risks) - len(scored),
            "note_fa": "ریسک‌های با عوامل ناقص جدا نگه داشته می‌شوند و رتبه‌بندی نمی‌شوند.",
        }


class VulnerabilityEngine:
    """Vulnerability = Exposure + Sensitivity − AdaptiveCapacity + Access barrier + Dependency."""

    COMPONENTS = ("exposure", "sensitivity", "adaptive_capacity", "access", "dependency")

    def group_vulnerability(self, *, group_id: str, components: dict, evidence: dict | None = None) -> dict:
        vals = {k: _num((components or {}).get(k)) for k in self.COMPONENTS}
        missing = [k for k, v in vals.items() if v is None]
        base = {
            "group_id": group_id,
            "components": vals,
            "evidence": evidence or {},
            "components_fa": {
                "exposure": "مواجهه", "sensitivity": "حساسیت",
                "adaptive_capacity": "ظرفیت انطباق", "access": "موانع دسترسی",
                "dependency": "وابستگی",
            },
        }
        if missing:
            return {**base, "status": "INSUFFICIENT_DATA", "score": None,
                    "reason_fa": f"مؤلفه‌های غایب: {', '.join(missing)}؛ آسیب‌پذیری بدون همهٔ مؤلفه‌ها ساخته نمی‌شود (§۳۱).",
                    "needed_fa": "ثبت مواجهه، حساسیت، ظرفیت انطباق، موانع دسترسی و وابستگی برای این گروه."}
        score = (vals["exposure"] + vals["sensitivity"] - vals["adaptive_capacity"]
                 + vals["access"] + vals["dependency"])
        return {
            **base,
            "status": "OBSERVED",
            "score": round(score, 4),
            "formula_fa": "مواجهه + حساسیت − ظرفیت انطباق + موانع دسترسی + وابستگی",
            "note_fa": "ظرفیت انطباق آسیب‌پذیری را کاهش می‌دهد؛ سایر مؤلفه‌ها آن را افزایش می‌دهند.",
        }

    def assess(self, *, groups: dict) -> dict:
        results = {gid: self.group_vulnerability(group_id=gid, components=spec.get("components") or {},
                                                 evidence=spec.get("evidence"))
                   for gid, spec in (groups or {}).items()}
        scored = {g: r for g, r in results.items() if r["score"] is not None}
        if not results:
            return {"status": "INSUFFICIENT_DISAGGREGATION", "groups": {},
                    "reason_fa": "هیچ دادهٔ گروهی برای سنجش آسیب‌پذیری وجود ندارد.",
                    "needed_fa": "دادهٔ گروهی برای مؤلفه‌های آسیب‌پذیری."}
        if not scored:
            return {"status": "INSUFFICIENT_DATA", "groups": results, "most_vulnerable": None,
                    "reason_fa": "هیچ گروهی مؤلفه‌های کامل نداشت؛ حکم آسیب‌پذیری صادر نمی‌شود."}
        top = max(scored, key=lambda g: scored[g]["score"])
        return {
            "status": "OBSERVED",
            "groups": results,
            "most_vulnerable": {"group_id": top, "score": scored[top]["score"]},
            "n_scored": len(scored),
            "n_insufficient": len(results) - len(scored),
            "note_fa": "آسیب‌پذیری جدا از عدالت است: عدالت شکاف گروهی را می‌سنجد، آسیب‌پذیری ترکیب مواجهه و ظرفیت را (§۳۱).",
        }
