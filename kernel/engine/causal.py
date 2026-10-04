# -*- coding: utf-8 -*-
"""
Causal Diagnosis Engine (§35-§37).

INDEPENDENT of any LLM. The kernel decides the causal status; an LLM may only
summarize, explain, translate or propose candidate hypotheses — and anything it
proposes enters as `generated_by: llm_candidate` with status INITIAL until the
kernel finds evidence for it.

Causal statuses (§37): INITIAL, CONVERGENT, TESTED, REJECTED, UNRESOLVED.
CONVERGENT is NEVER causal proof.
"""
from __future__ import annotations

CAUSAL_STATUSES = ("INITIAL", "CONVERGENT", "TESTED", "REJECTED", "UNRESOLVED")

STATUS_FA = {
    "INITIAL": "اولیه — فرضیه مطرح است ولی شواهدی بررسی نشده",
    "CONVERGENT": "همگرا — چند شاهد مستقل هم‌جهت‌اند (اثبات علّی نیست)",
    "TESTED": "آزمون‌شده — با طراحی آزمون و داده تأیید شده",
    "REJECTED": "ردشده — شواهد خلاف فرضیه است",
    "UNRESOLVED": "حل‌نشده — شواهد کافی برای هیچ حکمی وجود ندارد",
}

HYPOTHESIS_FAMILIES = {
    "cost": "هزینه",
    "security": "امنیت",
    "quality": "کیفیت",
    "time": "زمان",
    "physical_barrier": "مانع فیزیکی",
    "information": "اطلاعات",
    "norm": "هنجار",
    "governance": "حکمرانی",
    "market": "بازار",
    "institutional": "نهادی",
    "environmental": "محیطی",
}

# §36 — for each problem family, the competing hypotheses the kernel considers.
# This is a registry of *candidate mechanisms*, not a verdict.
# Keys are the chain-gap ids used by the bottleneck/assessment layer, so the
# engine can never look up the wrong transition by accident.
HYPOTHESIS_TEMPLATES = {
    "G_AU": [
        ("cost", "هزینهٔ استفاده از خدمت بالاتر از توان گروه هدف است",
         "هزینهٔ مستقیم/غیرمستقیم استفاده و توان پرداخت گروه"),
        ("information", "گروه هدف از وجود یا شیوهٔ استفاده از خدمت آگاه نیست",
         "دادهٔ اطلاع‌رسانی، آگاهی ادراکی، مسیرهای ارتباطی"),
        ("quality", "کیفیت خدمت باعث عدم‌استفاده می‌شود",
         "کیفیت ادراکی و عینی خدمت، نرخ شکایت"),
        ("physical_barrier", "مانع فیزیکی (فاصله، پله، معبر) استفاده را ناممکن می‌کند",
         "دسترسی شبکه‌ای، ممیزی میدانی موانع"),
        ("norm", "هنجار اجتماعی استفاده را محدود می‌کند",
         "دادهٔ ادراکی هنجار، تفکیک گروهی استفاده"),
    ],
    "G_UE": [
        ("quality", "تجربهٔ استفاده به‌دلیل کیفیت پایین منفی است",
         "رضایت ادراکی، شاخص‌های کیفیت عینی"),
        ("security", "احساس ناامنی تجربه را تخریب می‌کند",
         "دادهٔ امنیت ادراکی/عینی، زمان‌بندی وقوع"),
        ("governance", "نحوهٔ ادارهٔ فضا/خدمت تجربه را کاهش می‌دهد",
         "شاخص‌های حکمرانی، پاسخگویی، نگهداشت"),
    ],
    "G_EO": [
        ("institutional", "ظرفیت نهادی برای تبدیل تجربه به پیامد کافی نیست",
         "ظرفیت اجرا، هماهنگی نهادی، بودجهٔ عملیاتی"),
        ("market", "شرایط بازار پیامد را خنثی می‌کند",
         "دادهٔ بازار کار/کسب‌وکار محلی"),
        ("environmental", "عوامل محیطی پیامد را محدود می‌کنند",
         "دادهٔ محیطی، مخاطرات، اقلیم"),
    ],
    "G_CA": [
        ("governance", "ظرفیت موجود به دسترسی تبدیل نمی‌شود چون حکمرانی/تصمیم‌گیری مانع است",
         "شفافیت، پاسخگویی، اختیارات نهادی محلی"),
        ("physical_barrier", "ظرفیت موجود خارج از دسترس فیزیکی گروه هدف است",
         "دسترسی شبکه‌ای، مرز خدمت"),
        ("institutional", "نهاد متولی خدمت را به سطح محله نمی‌رساند",
         "ساختار نهادی، سند تخصیص خدمت"),
    ],
}


class CausalEngine:
    def __init__(self, templates: dict | None = None):
        self.templates = dict(templates or HYPOTHESIS_TEMPLATES)

    def hypotheses_for(self, *, gap: str, context: dict | None = None) -> list:
        """Rule-generated candidate hypotheses for a chain gap. Deterministic order."""
        templates = self.templates.get(gap, [])
        out = []
        for i, (family, mech, required) in enumerate(templates, start=1):
            out.append({
                "hypothesis_id": f"H-{gap}-{i:02d}",
                "family": family,
                "family_fa": HYPOTHESIS_FAMILIES.get(family, family),
                "hypothesis_fa": mech,
                "mechanism_fa": mech,
                "required_evidence": [required],
                "alternative_explanation_fa": (
                    "شکاف مشاهده‌شده می‌تواند ناشی از خطای اندازه‌گیری، پوشش ناقص داده یا "
                    "تفکیک‌نشدگی گروهی باشد، نه این سازوکار."),
                "evidence_found": [],
                "evidence_missing": [required],
                "test_design_fa": ("آزمون مقایسه‌ای/شبه‌آزمایشی روی گروه هدف با شاهد قابل‌مقایسه "
                                   "و سنجش پیش/پس؛ ثبت روش انتخاب‌شده (§۴۹)."),
                "causal_status": "INITIAL",
                "confidence": None,
                "generated_by": "kernel_rule",
            })
        return out

    def assess(self, *, gaps: dict, evidence_index: dict | None = None,
               rejected: list | None = None) -> dict:
        """gaps: {gap_id: {value, status}}. evidence_index: {gap_id: {family: [evidence...]}}."""
        evidence_index = evidence_index or {}
        rejected = set(rejected or [])
        published_gaps = {g: v for g, v in (gaps or {}).items()
                          if v and v.get("status") == "OBSERVED" and v.get("value") is not None}
        if not published_gaps:
            return {
                "status": "NOT_ASSESSED",
                "hypotheses": [],
                "reason_fa": ("هیچ شکاف زنجیره‌ای معتبری منتشر نشده است؛ تشخیص علّی بدون شکاف معتبر "
                              "ساخته نمی‌شود (§۳۵)."),
                "needed_fa": "نمرهٔ معتبر برای دو سرِ مجاور زنجیره C-A-U-E-O.",
                "ai_boundary_fa": ("هوش مصنوعی اجازهٔ تعیین وضعیت علّی ندارد؛ فقط خلاصه‌سازی، ترجمه، "
                                   "تولید فرضیهٔ نامزد و پیوند شواهد مجاز است (§۵۳)."),
            }

        all_hyp = []
        for gap, val in sorted(published_gaps.items()):
            for h in self.hypotheses_for(gap=gap):
                found = list((evidence_index.get(gap, {}) or {}).get(h["family"], []))
                h["evidence_found"] = found
                h["evidence_missing"] = [e for e in h["required_evidence"] if e not in found]
                if h["hypothesis_id"] in rejected:
                    h["causal_status"] = "REJECTED"
                elif len(found) >= 2:
                    # >=2 independent corroborating streams. Still NOT causal proof.
                    h["causal_status"] = "CONVERGENT"
                elif len(found) == 1:
                    # partial evidence: the hypothesis survives but is not corroborated
                    h["causal_status"] = "UNRESOLVED"
                else:
                    h["causal_status"] = "INITIAL"
                all_hyp.append(h)

        counts = {s: sum(1 for h in all_hyp if h["causal_status"] == s) for s in CAUSAL_STATUSES}
        return {
            "status": "HYPOTHESES_GENERATED",
            "gaps_assessed": sorted(published_gaps.keys()),
            "hypotheses": all_hyp,
            "status_counts": counts,
            "tested_count": counts["TESTED"],
            "causal_claim_fa": ("هیچ فرضیه‌ای به‌عنوان اثبات علّی ارائه نمی‌شود. وضعیت CONVERGENT تنها "
                                "یعنی چند شاهد مستقل هم‌جهت‌اند (§۳۷)."),
            "ai_boundary_fa": ("وضعیت علّی را Kernel تعیین می‌کند. خروجی LLM فقط می‌تواند به‌عنوان "
                               "«فرضیهٔ نامزد» با وضعیت INITIAL وارد شود (§۳۵، §۵۳)."),
        }
