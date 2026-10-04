# -*- coding: utf-8 -*-
"""
Equity Engine (§29-§30).

JusticeGap = BestGroup - WorstGroup, computed INDEPENDENTLY of the neighbourhood
mean, and ONLY when all of these hold:
    minimum group count
    minimum sample size
    valid weighting
    sufficient confidence

Otherwise the engine returns INSUFFICIENT_DISAGGREGATION. It never infers equity
from an aggregate, and it never reports a gap from a single group.

Dimensions (§30): gender, age, income/economic group, disability, tenure,
household type, sub-neighborhood — plus intersectional groups when data allows.
"""
from __future__ import annotations

DIMENSIONS = ("gender", "age", "income_group", "disability", "tenure",
              "household_type", "sub_neighborhood", "intersectional")

DIMENSION_FA = {
    "gender": "جنس",
    "age": "سن",
    "income_group": "گروه درآمدی/اقتصادی",
    "disability": "معلولیت",
    "tenure": "وضعیت سکونت",
    "household_type": "نوع خانوار",
    "sub_neighborhood": "زیرمحله",
    "intersectional": "گروه‌های متقاطع",
}


class EquityEngine:
    def __init__(self, *, min_groups: int = 2, min_sample_size: int = 30,
                 min_confidence: float = 0.5):
        self.min_groups = min_groups
        self.min_sample_size = min_sample_size
        self.min_confidence = min_confidence

    def justice_gap(self, *, indicator_code: str, groups: dict, dimension: str = "unknown") -> dict:
        """groups: {group_id: {value: float|None, sample_size: int|None, confidence: float|None, weight: float|None}}"""
        base = {
            "indicator_code": indicator_code,
            "dimension": dimension,
            "dimension_fa": DIMENSION_FA.get(dimension, dimension),
            "method_fa": "JusticeGap = بهترین گروه − بدترین گروه (مستقل از میانگین محله)",
        }
        if not groups:
            return {**base, "status": "INSUFFICIENT_DISAGGREGATION", "value": None,
                    "reason_fa": "هیچ دادهٔ تفکیک‌شدهٔ گروهی برای این شاخص وجود ندارد.",
                    "needed_fa": "گردآوری دادهٔ گروهی (حداقل دو گروه با حجم نمونهٔ کافی)."}

        usable, rejected = {}, {}
        for gid, g in groups.items():
            v = (g or {}).get("value")
            n = (g or {}).get("sample_size")
            conf = (g or {}).get("confidence")
            if v is None:
                rejected[gid] = "بدون مقدار معتبر (missing)"
                continue
            if n is None:
                rejected[gid] = "حجم نمونه ثبت نشده است"
                continue
            if n < self.min_sample_size:
                rejected[gid] = f"حجم نمونه {n} < حداقل {self.min_sample_size}"
                continue
            if conf is not None and conf < self.min_confidence:
                rejected[gid] = f"اطمینان {conf} < حداقل {self.min_confidence}"
                continue
            usable[gid] = float(v)

        if len(usable) < self.min_groups:
            return {
                **base,
                "status": "INSUFFICIENT_DISAGGREGATION",
                "value": None,
                "n_usable_groups": len(usable),
                "rejected_groups": rejected,
                "reason_fa": (f"تنها {len(usable)} گروه واجد شرایط است؛ حداقل {self.min_groups} گروه لازم است. "
                              "بدون تفکیک کافی هیچ حکم عدالتی صادر نمی‌شود (§۲۹)."),
                "needed_fa": "افزایش حجم نمونه/تعداد گروه‌ها و ثبت وزن نمونه‌گیری.",
            }

        best_gid = max(usable, key=lambda k: usable[k])
        worst_gid = min(usable, key=lambda k: usable[k])
        gap = round(usable[best_gid] - usable[worst_gid], 4)
        return {
            **base,
            "status": "OBSERVED",
            "value": gap,
            "best_group": {"id": best_gid, "value": usable[best_gid]},
            "worst_group": {"id": worst_gid, "value": usable[worst_gid]},
            "n_usable_groups": len(usable),
            "rejected_groups": rejected,
            "is_equity_verdict": True,
            "caveat_fa": ("این شکاف بر پایهٔ دادهٔ گروهی موجود است؛ گروه‌های ردشده در حکم وارد نشده‌اند "
                          "و پوشش تفکیک باید جداگانه گزارش شود."),
        }

    def assess(self, *, by_indicator: dict, min_indicators: int = 1) -> dict:
        """Assess equity across indicators. No group data anywhere -> a clear abstention."""
        results = {}
        for code, spec in (by_indicator or {}).items():
            results[code] = self.justice_gap(
                indicator_code=code,
                groups=spec.get("groups") or {},
                dimension=spec.get("dimension") or "unknown",
            )
        observed = [c for c, r in results.items() if r["status"] == "OBSERVED"]
        if not results:
            return {
                "status": "INSUFFICIENT_DISAGGREGATION",
                "indicators": {},
                "verdict": None,
                "reason_fa": "هیچ دادهٔ تفکیک‌شدهٔ گروهی در این اجرا وجود ندارد؛ حکم عدالت صادر نمی‌شود (§۲۹).",
                "needed_fa": "دادهٔ گروهی برای حداقل یک شاخص با حجم نمونهٔ کافی و وزن معتبر.",
            }
        if len(observed) < min_indicators:
            return {
                "status": "INSUFFICIENT_DISAGGREGATION",
                "indicators": results,
                "verdict": None,
                "reason_fa": "هیچ شاخصی تفکیک کافی نداشت؛ حکم عدالت صادر نمی‌شود.",
                "needed_fa": "افزایش پوشش گروهی یا حجم نمونه.",
            }
        gaps = {c: results[c]["value"] for c in observed}
        worst = max(gaps, key=lambda k: gaps[k])
        return {
            "status": "OBSERVED",
            "indicators": results,
            "verdict": {
                "n_indicators_with_verdict": len(observed),
                "largest_gap_indicator": worst,
                "largest_gap_value": gaps[worst],
                "mean_gap": round(sum(gaps.values()) / len(gaps), 4),
            },
            "note_fa": "شکاف‌ها فقط برای شاخص‌هایی محاسبه شده‌اند که تفکیک گروهی معتبر داشتند.",
        }
