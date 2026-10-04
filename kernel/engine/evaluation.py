# -*- coding: utf-8 -*-
"""
Impact Evaluation Engine (§48-§50) + Learning Engine (§51) + Living Memory (§52).

Rules:
  * Every intervention must have Baseline, Target, Output/Outcome/Impact/Side-effect
    KPI and a Stop Rule BEFORE execution (§48).
  * Methods are selectable from a documented list; the chosen method is recorded (§49).
  * Q/T/R before/after are computed, but a change without a valid baseline is
    NOT_IDENTIFIABLE — never a silent number (§50).
  * Learning produces a RULE, not a log line (§51).
  * Memory is versioned and no memory becomes a rule without valid evidence (§52).
"""
from __future__ import annotations

import hashlib
import json

METHODS = ("before_after", "difference_in_differences", "matched_comparison",
           "interrupted_time_series", "synthetic_control", "regression",
           "quasi_experimental", "randomized_experiment", "NOT_SELECTED")

METHOD_FA = {
    "before_after": "پیش/پس",
    "difference_in_differences": "تفاضل در تفاضل",
    "matched_comparison": "مقایسهٔ جفت‌شده",
    "interrupted_time_series": "سری زمانی متوقف‌شده",
    "synthetic_control": "کنترل ترکیبی",
    "regression": "رگرسیون",
    "quasi_experimental": "شبه‌آزمایشی",
    "randomized_experiment": "آزمایش تصادفی",
    "NOT_SELECTED": "انتخاب‌نشده",
}

# methods that need a comparison group / counterfactual
NEEDS_COUNTERFACTUAL = ("difference_in_differences", "matched_comparison",
                        "synthetic_control", "randomized_experiment")


class EvaluationEngine:
    def plan(self, *, intervention_id: str, baseline=None, target=None,
             kpis=None, method: str = "NOT_SELECTED",
             method_reason_fa: str | None = None,
             comparison_available: bool | None = None) -> dict:
        kpis = kpis or {}
        required_kpis = ("output", "outcome", "impact", "side_effect", "stop_rule")
        missing_kpis = [k for k in required_kpis if not kpis.get(k)]
        missing = []
        if baseline is None:
            missing.append("baseline")
        if target is None:
            missing.append("target")
        missing.extend(missing_kpis)

        if missing:
            return {
                "intervention_id": intervention_id,
                "status": "PLAN_INCOMPLETE",
                "identifiability": "NOT_IDENTIFIABLE",
                "method": method,
                "method_fa": METHOD_FA.get(method),
                "missing": missing,
                "reason_fa": (f"اجزای غایب طرح ارزیابی: {', '.join(missing)}. بدون خط پایه و KPI "
                              "هیچ ادعای اثری ساخته نمی‌شود (§۴۸، §۵۰)."),
                "needed_fa": "ثبت خط پایه، هدف، و KPI خروجی/پیامد/اثر/اثر جانبی و قاعدهٔ توقف پیش از اجرا.",
            }

        if method not in METHODS or method == "NOT_SELECTED":
            return {
                "intervention_id": intervention_id,
                "status": "METHOD_NOT_SELECTED",
                "identifiability": "NOT_IDENTIFIABLE",
                "method": "NOT_SELECTED",
                "baseline": baseline, "target": target, "kpis": kpis,
                "reason_fa": "روش ارزیابی انتخاب نشده است؛ بدون روش، اثر قابل شناسایی نیست (§۴۹).",
                "available_methods": list(METHODS),
            }

        if method in NEEDS_COUNTERFACTUAL and comparison_available is not True:
            return {
                "intervention_id": intervention_id,
                "status": "COUNTERFACTUAL_MISSING",
                "identifiability": "NOT_IDENTIFIABLE",
                "method": method, "method_fa": METHOD_FA.get(method),
                "baseline": baseline, "target": target, "kpis": kpis,
                "reason_fa": (f"روش «{METHOD_FA.get(method)}» نیازمند گروه مقایسه/پادواقع است و "
                              "در دسترس نیست؛ اثر قابل شناسایی نیست (§۴۹، §۵۰)."),
                "needed_fa": "دادهٔ گروه مقایسه یا انتخاب روش جایگزین با ثبت دلیل.",
            }

        return {
            "intervention_id": intervention_id,
            "status": "PLAN_READY",
            "identifiability": "IDENTIFIABLE",
            "method": method,
            "method_fa": METHOD_FA.get(method),
            "method_selection_reason_fa": method_reason_fa or "روش با ثبت صریح انتخاب شده است (§۴۹).",
            "baseline": baseline, "target": target, "kpis": kpis,
        }

    def delta(self, *, intervention_id: str, before: dict | None, after: dict | None,
              baseline_valid: bool) -> dict:
        """§50 — Q/T/R before/after. No valid baseline => NOT_IDENTIFIABLE."""
        if not baseline_valid or not before or not after:
            return {
                "intervention_id": intervention_id,
                "identifiability": "NOT_IDENTIFIABLE",
                "delta_Q": None, "delta_T": None, "delta_R": None,
                "reason_fa": ("بدون خط پایهٔ معتبر، تغییر قابل شناسایی نیست؛ هیچ ΔQ/ΔT/ΔR گزارش نمی‌شود (§۵۰)."),
                "needed_fa": "ثبت خط پایهٔ معتبر با نسخهٔ مرز و نسخهٔ داده.",
            }
        out = {"intervention_id": intervention_id, "identifiability": "IDENTIFIABLE"}
        for key in ("Q", "T", "R"):
            b, a = before.get(key), after.get(key)
            out[f"{key}_before"] = b
            out[f"{key}_after"] = a
            out[f"delta_{key}"] = (round(float(a) - float(b), 4)
                                   if b is not None and a is not None else None)
        return out


class LearningEngine:
    """§51 — an experience becomes a rule, not a log line."""

    def rule_from_experience(self, *, rule_id: str, context: dict, intervention: dict,
                             observed: dict, evidence: list, confidence: str,
                             failure_fa: str | None = None,
                             success_fa: str | None = None) -> dict:
        if not evidence:
            return {
                "rule_id": rule_id,
                "status": "NO_RULE",
                "reason_fa": "تجربه بدون شاهد معتبر به قاعده تبدیل نمی‌شود (§۵۱، §۵۲).",
                "needed_fa": "ثبت شواهد (سنجش پیش/پس، روش ارزیابی، سطح اطمینان).",
            }
        if confidence in ("ناکافی", "محدود"):
            return {
                "rule_id": rule_id,
                "status": "NO_RULE",
                "confidence": confidence,
                "reason_fa": f"سطح اطمینان «{confidence}» برای تبدیل به قاعده کافی نیست (§۵۲).",
                "needed_fa": "شواهد آزمون‌شده یا همگرا با منبع مستقل.",
            }
        return {
            "rule_id": rule_id,
            "status": "RULE_FORMED",
            "context": context,
            "intervention": intervention,
            "result": observed,
            "failure_fa": failure_fa,
            "success_fa": success_fa,
            "evidence": evidence,
            "confidence": confidence,
            "rule_fa": ("در بافت قابل‌مقایسه، این خانوادهٔ مداخله ابتدا آزمون شود."),
        }

    def living_memory_entry(self, *, rule: dict, created_at: str,
                            supersedes: str | None = None) -> dict:
        """§52 — versioned memory entry with a content hash for auditability."""
        payload = json.dumps({"rule": rule, "created_at": created_at, "supersedes": supersedes},
                             ensure_ascii=False, sort_keys=True)
        mem_id = "MEM-" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
        return {
            "memory_id": mem_id,
            "created_at": created_at,
            "evidence": rule.get("evidence"),
            "context": rule.get("context"),
            "rule_fa": rule.get("rule_fa"),
            "confidence": rule.get("confidence"),
            "applications": 0,
            "failures": 0,
            "superseded_by": None,
            "supersedes": supersedes,
            "note_fa": "هیچ حافظه‌ای بدون شاهد معتبر به قاعده ارتقا نمی‌یابد (§۵۲).",
        }
