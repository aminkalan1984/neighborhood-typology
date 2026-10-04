# -*- coding: utf-8 -*-
"""
Publication Gate (§21, §60, §72).

No numeric score is published without passing the gate. Four levels:

    EVIDENCE_ONLY  data exists but is not enough for a score
    PROVISIONAL    calculation runs but verification is incomplete
    VERIFIED       evidence, provenance and QC are sufficient
    VALIDATED      method and result confirmed by independent data/evaluation

§72 — a neighbourhood verdict requires ALL of:
    Boundary Valid
    + Data Coverage Sufficient
    + L/U Calibrated
    + Weight Set Valid
    + Required C-A-U-E-O Coverage
    + Confidence Threshold
    + No Critical QA Failure

Otherwise the decision is WITHHELD and reported structurally:
    What is known / What is unknown / Why unknown / What data would unblock it.

The gate NEVER lowers a score to make it publishable (§21).
"""
from __future__ import annotations

LEVELS = ("EVIDENCE_ONLY", "PROVISIONAL", "VERIFIED", "VALIDATED")
LEVEL_RANK = {name: i for i, name in enumerate(LEVELS)}

LEVEL_FA = {
    "EVIDENCE_ONLY": "فقط شواهد — داده هست ولی برای نمره کافی نیست",
    "PROVISIONAL": "آزمایشی — محاسبه اجرا می‌شود ولی تأیید کامل نشده",
    "VERIFIED": "تأییدشده — شواهد، منشأ و کنترل کیفیت کافی است",
    "VALIDATED": "اعتبارسنجی‌شده — روش و نتیجه با داده/ارزیابی مستقل تأیید شده",
}

# §72 minimum C-A-U-E-O stages required before a neighbourhood verdict
REQUIRED_STAGES = ("C", "A", "U", "E", "O")


class PublicationGate:
    def __init__(self, *, min_coverage: float = 0.5, min_stages: int = 5,
                 confidence_floor: str = "قابل اتکا", confidence_levels: list | None = None):
        self.min_coverage = min_coverage
        self.min_stages = min_stages
        self.confidence_floor = confidence_floor
        self.confidence_levels = confidence_levels or ["ناکافی", "محدود", "قابل اتکا", "همگرا", "آزمون‌شده"]

    def evaluate(
        self,
        *,
        boundary_valid: bool,
        boundary_provenance: str | None,
        coverage: float | None,
        calibration_complete: bool,
        weight_set_valid: bool,
        caueo_stages_observed: list,
        confidence_level: str | None,
        critical_qa_failure: bool = False,
        independently_validated: bool = False,
        n_published_scores: int = 0,
    ) -> dict:
        conditions = {
            "boundary_valid": {
                "ok": bool(boundary_valid and boundary_provenance),
                "label_fa": "مرز محله معتبر و دارای منشأ",
                "detail_fa": (f"provenance_ref={boundary_provenance}" if boundary_provenance
                              else "مرز بدون منشأ ثبت‌شده؛ محاسبه با مرز بی‌منشأ ممنوع است (§۱۴)."),
            },
            "data_coverage_sufficient": {
                "ok": coverage is not None and coverage >= self.min_coverage,
                "label_fa": f"پوشش داده ≥ {self.min_coverage:.0%}",
                "detail_fa": (f"پوشش={coverage:.1%}" if coverage is not None
                              else "پوشش قابل محاسبه نیست (داده‌ای وارد نشده)"),
            },
            "lu_calibrated": {
                "ok": bool(calibration_complete),
                "label_fa": "L/U کالیبره است",
                "detail_fa": ("کالیبراسیون کامل است" if calibration_complete
                              else "L/U کالیبره نشده است؛ نمرهٔ ۰–۱۰۰ منتشرنشدنی است (§۱۹، §۷۱)."),
            },
            "weight_set_valid": {
                "ok": bool(weight_set_valid),
                "label_fa": "مجموعهٔ وزن معتبر است",
                "detail_fa": ("وزن‌ها معتبرند" if weight_set_valid
                              else "وزن‌ها کالیبره/معتبر نشده‌اند (W-v1، UNCALIBRATED)."),
            },
            "caueo_coverage": {
                "ok": len(set(caueo_stages_observed or [])) >= self.min_stages,
                "label_fa": f"پوشش مراحل C-A-U-E-O ≥ {self.min_stages} مرحله",
                "detail_fa": ("مراحل مشاهده‌شده: " + (", ".join(sorted(set(caueo_stages_observed or []))) or "هیچ")
                              + f" — لازم: {self.min_stages} از {len(REQUIRED_STAGES)}"),
            },
            "confidence_threshold": {
                "ok": (confidence_level in self.confidence_levels
                       and self.confidence_levels.index(confidence_level)
                       >= self.confidence_levels.index(self.confidence_floor)),
                "label_fa": f"آستانهٔ اطمینان ≥ «{self.confidence_floor}»",
                "detail_fa": f"سطح اطمینان: {confidence_level or 'تعیین‌نشده'}",
            },
            "no_critical_qa_failure": {
                "ok": not critical_qa_failure,
                "label_fa": "بدون خطای بحرانی کنترل کیفیت",
                "detail_fa": ("خطای بحرانی QC ثبت شده است" if critical_qa_failure else "QC بدون خطای بحرانی"),
            },
        }

        failed = [k for k, v in conditions.items() if not v["ok"]]

        # ---- level assignment -------------------------------------------------
        if n_published_scores == 0:
            level = "EVIDENCE_ONLY"
        elif not failed:
            level = "VALIDATED" if independently_validated else "VERIFIED"
        else:
            level = "PROVISIONAL"

        # a score may only be published numerically at VERIFIED or VALIDATED (§60)
        can_publish = level in ("VERIFIED", "VALIDATED")
        withheld = not can_publish

        reasons = [f"{conditions[k]['label_fa']}: {conditions[k]['detail_fa']}" for k in failed]
        if level == "EVIDENCE_ONLY":
            reasons.insert(0, "هیچ نمرهٔ عددی معتبری تولید نشده است؛ فقط شواهد قابل ارائه است.")

        known, unknown, why, unblock = [], [], [], []
        for k, v in conditions.items():
            if v["ok"]:
                known.append(v["label_fa"])
            else:
                unknown.append(v["label_fa"])
                why.append(v["detail_fa"])
        for k in failed:
            unblock.append(_UNBLOCK_FA.get(k, "تکمیل شرط مربوطه"))

        return {
            "level": level,
            "level_fa": LEVEL_FA[level],
            "can_publish_numeric_scores": can_publish,
            "decision_withheld": withheld,
            "conditions": conditions,
            "failed_conditions": failed,
            "reasons": reasons,
            "what_is_known": known,
            "what_is_unknown": unknown,
            "why_unknown": why,
            "what_would_unblock": unblock,
            "rule_fa": ("عدد فقط در سطح VERIFIED/VALIDATED منتشر می‌شود. اگر اطمینان پایین باشد، "
                        "انتشار عدد مسدود می‌شود — نمره مصنوعی کاهش نمی‌یابد (§۲۱)."),
        }


_UNBLOCK_FA = {
    "boundary_valid": "ثبت مرز رسمی محله همراه با منشأ (provenance_ref) و نسخه",
    "data_coverage_sufficient": "گردآوری داده برای شاخص‌های بیشتر تا رسیدن به حداقل پوشش",
    "lu_calibrated": "کالیبراسیون L/U هر شاخص با جمعیت مرجع، دورهٔ مرجع و روش کالیبراسیون ثبت‌شده",
    "weight_set_valid": "اعتبارسنجی و نسخه‌دارکردن وزن‌ها (W-v2) و ثبت روش ترکیب",
    "caueo_coverage": "گردآوری دادهٔ مراحل غایب زنجیره (معمولاً U/E/O پیمایشی یا رفتاری)",
    "confidence_threshold": "افزودن جریان‌های شاهد مستقل یا بهبود کیفیت/تازگی داده",
    "no_critical_qa_failure": "رفع خطای بحرانی کنترل کیفیت در دادهٔ ورودی",
}
