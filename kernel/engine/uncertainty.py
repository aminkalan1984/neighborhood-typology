# -*- coding: utf-8 -*-
"""
Uncertainty Engine (§22).

For every indicator value and every aggregate the kernel records:
    point estimate, lower bound, upper bound, uncertainty source, sensitivity.

Uncertainty is NEVER hidden inside the score (§21: Score != Confidence) and it is
NEVER used to silently shrink a number. Sources are explicit and enumerated:
    Sampling, Measurement, Spatial mismatch, Temporal mismatch, Calibration,
    Source disagreement, Model uncertainty, Missingness.

Everything here is deterministic: the same inputs always produce the same bounds.
"""
from __future__ import annotations

UNCERTAINTY_SOURCES = (
    "sampling", "measurement", "spatial_mismatch", "temporal_mismatch",
    "calibration", "source_disagreement", "model_uncertainty", "missingness",
)

SOURCE_FA = {
    "sampling": "خطای نمونه‌گیری",
    "measurement": "خطای اندازه‌گیری",
    "spatial_mismatch": "ناهم‌ترازی مکانی (مقیاس داده با واحد تحلیل)",
    "temporal_mismatch": "ناهم‌ترازی زمانی (کهنگی/دورهٔ مرجع)",
    "calibration": "کالیبراسیون L/U انجام نشده",
    "source_disagreement": "اختلاف میان منابع مستقل",
    "model_uncertainty": "عدم‌قطعیت مدل/فرمول",
    "missingness": "کمبود پوشش داده",
}

# documented, registry-level weights for combining relative contributions
CONTRIBUTION_WEIGHTS = {
    "sampling": 0.15, "measurement": 0.15, "spatial_mismatch": 0.15,
    "temporal_mismatch": 0.10, "calibration": 0.20, "source_disagreement": 0.10,
    "model_uncertainty": 0.05, "missingness": 0.10,
}


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


class UncertaintyEngine:
    """Deterministic uncertainty bookkeeping."""

    def __init__(self, weights: dict | None = None):
        self.w = dict(weights or CONTRIBUTION_WEIGHTS)

    def assess_value(
        self,
        *,
        has_number: bool,
        is_proxy: bool = False,
        coverage: float | None = None,
        sample_size: int | None = None,
        calibrated: bool = False,
        source_count: int = 1,
        spatial_scale: str | None = None,
        target_scale: str = "neighborhood",
        age_days: int | None = None,
        expected_days: int | None = None,
        declared_uncertainty: float | None = None,
    ) -> dict:
        """Relative uncertainty of ONE value with an explicit source breakdown."""
        contributions: dict[str, dict] = {}

        def add(src: str, score: float, explain: str):
            contributions[src] = {
                "score": round(_clamp01(score), 4),
                "weight": self.w.get(src, 0.0),
                "contribution": round(_clamp01(score) * self.w.get(src, 0.0), 4),
                "explain_fa": explain,
            }

        # sampling — smaller samples are more uncertain; unknown sample is not free
        if sample_size is None:
            add("sampling", 0.5, "حجم نمونه ثبت نشده است (عدم‌قطعیت خنثی)")
        elif sample_size <= 0:
            add("sampling", 1.0, "حجم نمونه صفر/نامعتبر")
        else:
            add("sampling", min(1.0, 30.0 / max(sample_size, 1)),
                f"حجم نمونه {sample_size}")

        # measurement — a labelled proxy carries measurement uncertainty by definition
        add("measurement", 0.6 if is_proxy else 0.25,
            "پروکسی برچسب‌دار (اندازه‌گیری غیرمستقیم)" if is_proxy else "اندازه‌گیری مستقیم")

        # spatial mismatch
        rank = {"point": 5, "block": 4, "sub_neighborhood": 3, "neighborhood": 2,
                "district": 1, "city": 0, "region": -1, "unknown": 0}
        if spatial_scale is None:
            add("spatial_mismatch", 0.5, "مقیاس مکانی داده ثبت نشده است")
        else:
            gap = rank.get(target_scale, 2) - rank.get(spatial_scale, 0)
            add("spatial_mismatch", min(1.0, 0.35 * max(0, gap)),
                f"مقیاس «{spatial_scale}» نسبت به «{target_scale}»")

        # temporal mismatch
        if age_days is None or expected_days is None:
            add("temporal_mismatch", 0.4, "تاریخ مشاهده/تناوب موردانتظار ثبت نشده")
        elif age_days <= expected_days:
            add("temporal_mismatch", 0.05, f"عمر {age_days} روز در تناوب {expected_days} روز")
        else:
            add("temporal_mismatch", min(1.0, age_days / max(expected_days, 1) - 1.0),
                f"عمر {age_days} روز فراتر از تناوب {expected_days} روز")

        # calibration
        add("calibration", 0.0 if calibrated else 0.9,
            "L/U کالیبره است" if calibrated else "L/U کالیبره نشده (§19)")

        # source disagreement — only meaningful with genuinely independent sources
        if source_count >= 2:
            add("source_disagreement", 0.3, f"{source_count} جریان شاهد مستقل")
        else:
            add("source_disagreement", 0.6, "تنها یک جریان شاهد؛ توافق بین‌منبعی قابل سنجش نیست")

        # model uncertainty — declared uncertainty, else a documented floor
        add("model_uncertainty", declared_uncertainty if declared_uncertainty is not None else 0.2,
            "عدم‌قطعیت اعلام‌شدهٔ مدل" if declared_uncertainty is not None else "کف مستند مدل")

        # missingness
        cov = 1.0 if coverage is None else _clamp01(coverage)
        add("missingness", 1.0 - cov, f"پوشش {cov:.0%}")

        relative = round(sum(c["contribution"] for c in contributions.values()), 4)
        dominant = sorted(contributions.items(), key=lambda kv: kv[1]["contribution"], reverse=True)

        return {
            "relative_uncertainty": relative,
            "has_number": bool(has_number),
            "contributions": contributions,
            "dominant_source": dominant[0][0] if dominant and dominant[0][1]["contribution"] > 0 else None,
            "dominant_source_fa": (SOURCE_FA.get(dominant[0][0]) if dominant
                                   and dominant[0][1]["contribution"] > 0 else None),
            "sources_fa": [SOURCE_FA[s] for s in UNCERTAINTY_SOURCES if s in contributions],
            "note_fa": "عدم‌قطعیت جدا از نمره ثبت می‌شود؛ نمره هرگز برای پنهان‌کردن عدم‌قطعیت کاهش نمی‌یابد (§۲۱).",
        }

    def bounds(self, point: float | None, relative: float) -> dict:
        """Symmetric relative bounds around the point estimate (§22)."""
        if point is None:
            return {"point": None, "lower": None, "upper": None}
        delta = abs(float(point)) * float(relative)
        return {
            "point": round(float(point), 4),
            "lower": round(float(point) - delta, 4),
            "upper": round(float(point) + delta, 4),
            "method": "relative_symmetric",
            "relative": round(float(relative), 4),
        }

    def assess_aggregate(self, *, published: bool, member_uncertainties: list, coverage: float | None = None) -> dict:
        """Uncertainty of an aggregate = member mean, worsened by missing coverage."""
        if not published:
            return {
                "relative_uncertainty": None,
                "has_number": False,
                "reason_fa": "تجمیع منتشر نشد؛ عدم‌قطعیت تعریف‌نشده است",
                "n_members": len(member_uncertainties or []),
            }
        vals = [m.get("relative_uncertainty") for m in (member_uncertainties or [])
                if m and m.get("relative_uncertainty") is not None]
        if not vals:
            base = 1.0
        else:
            base = sum(vals) / len(vals)
        cov = 1.0 if coverage is None else _clamp01(coverage)
        # missing coverage widens the band; it never narrows the number
        combined = round(min(1.0, base + (1.0 - cov) * 0.5), 4)
        return {
            "relative_uncertainty": combined,
            "has_number": True,
            "member_mean": round(base, 4),
            "coverage_penalty": round((1.0 - cov) * 0.5, 4),
            "n_members": len(vals),
            "note_fa": "عدم‌قطعیت تجمیع از میانگین اعضا و جریمهٔ پوشش ساخته می‌شود (افزایشی، نه کاهشی).",
        }
