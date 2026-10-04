# -*- coding: utf-8 -*-
"""
Intervention Knowledge Base + Selection + Portfolio Optimizer (§42-§46).

Rules:
  * No prescription is generated from LLM text alone (§42). Every intervention
    must be registered in `registries/intervention_registry.json`.
  * The legacy formula Severity x Population x Leverage x Feasibility x Equity is
    NOT sufficient on its own (§44). Expected Impact, Cost, Risk, Confidence,
    Time to Impact, Dependencies and Implementation Capacity are added.
  * If exact optimization is not possible the system must NOT invent a ranking;
    it returns PORTFOLIO_OPTIMIZATION_UNAVAILABLE (§45).
  * Every intervention passes the harm/externality filter before approval (§46).
"""
from __future__ import annotations

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REG_DIR = os.path.join(os.path.dirname(HERE), "registries")

HARM_FILTERS = ("displacement", "rent_increase", "land_value_shock", "traffic_transfer",
                "pollution_transfer", "social_exclusion", "cultural_loss",
                "environmental_damage", "unequal_benefit", "dependency")

# §44 — the selection factors. Legacy five plus the required additions.
SELECTION_FACTORS = (
    "severity", "population", "leverage", "feasibility", "equity",
    "expected_impact", "cost", "risk", "confidence", "time_to_impact",
    "dependencies", "implementation_capacity",
)
LEGACY_FACTORS = ("severity", "population", "leverage", "feasibility", "equity")


def load_registry() -> dict:
    with open(os.path.join(REG_DIR, "intervention_registry.json"), encoding="utf-8") as f:
        return json.load(f)


class InterventionEngine:
    def __init__(self, registry: dict | None = None):
        self.registry = registry if registry is not None else load_registry()
        self.by_id = {i["id"]: i for i in self.registry.get("interventions", [])}

    # ---- §46 harm / externality filter --------------------------------------
    def harm_filter(self, intervention: dict) -> dict:
        declared = intervention.get("harm_assessment") or {}
        missing = [f for f in HARM_FILTERS if f not in declared]
        flagged = [f for f in HARM_FILTERS if declared.get(f) is True]
        if missing:
            return {
                "status": "INCOMPLETE",
                "passed": False,
                "flagged": flagged,
                "missing_filters": missing,
                "reason_fa": ("فیلتر آسیب کامل نیست؛ مداخله پیش از تصویب باید برای همهٔ اثرات جانبی "
                              "ارزیابی شود (§۴۶)."),
            }
        return {
            "status": "ASSESSED",
            "passed": len(flagged) == 0,
            "flagged": flagged,
            "missing_filters": [],
            "reason_fa": ("بدون اثر جانبی شناسایی‌شده" if not flagged
                          else "اثر جانبی شناسایی‌شده: " + ", ".join(flagged)),
        }

    # ---- §44 selection score ------------------------------------------------
    def selection(self, *, intervention: dict, context: dict) -> dict:
        """context supplies the situation factors; intervention supplies its own."""
        factors = {}
        for f in SELECTION_FACTORS:
            v = context.get(f, intervention.get(f))
            factors[f] = None if v is None else float(v)
        missing = [k for k, v in factors.items() if v is None]
        base = {
            "intervention_id": intervention.get("id"),
            "name_fa": intervention.get("name_fa"),
            "family": intervention.get("family"),
            "factors": factors,
            "evidence_strength": intervention.get("evidence_strength"),
        }
        if missing:
            return {**base, "status": "INSUFFICIENT_DATA", "score": None,
                    "reason_fa": (f"عوامل غایب: {', '.join(missing)}؛ بدون همهٔ عوامل هیچ امتیاز "
                                  "انتخاب مداخله ساخته نمی‌شود (§۴۴)."),
                    "needed_fa": "ثبت عوامل غایب همراه با منبع و شاهد."}

        # benefit side (multiplicative, as documented) / cost side (divisive)
        benefit = (factors["severity"] * factors["population"] * factors["leverage"]
                   * factors["feasibility"] * factors["equity"] * factors["expected_impact"]
                   * factors["confidence"] * factors["implementation_capacity"])
        cost_side = (max(factors["cost"], 1e-9) * max(factors["risk"], 1e-9)
                     * max(factors["time_to_impact"], 1e-9)
                     * (1.0 + factors["dependencies"]))
        return {
            **base,
            "status": "OBSERVED",
            "score": round(benefit / cost_side, 6),
            "benefit_component": round(benefit, 6),
            "cost_component": round(cost_side, 6),
            "formula_fa": ("(شدت × جمعیت × اهرم × امکان‌پذیری × عدالت × اثر مورد انتظار × اطمینان × "
                           "ظرفیت اجرا) ÷ (هزینه × ریسک × زمان تا اثر × (۱ + وابستگی‌ها))"),
            "legacy_note_fa": ("فرمول قدیمی Severity×Population×Leverage×Feasibility×Equity به‌تنهایی "
                               "کافی نیست؛ اثر، هزینه، ریسک، اطمینان، زمان، وابستگی و ظرفیت اجرا افزوده شد (§۴۴)."),
        }

    def rank(self, *, candidates: list, context: dict) -> dict:
        scored = [self.selection(intervention=i, context=context) for i in candidates]
        ok = [s for s in scored if s["score"] is not None]
        if not candidates:
            return {"status": "NO_CANDIDATES", "ranked": [], "unranked": [],
                    "reason_fa": "هیچ مداخلهٔ ثبت‌شده‌ای برای این مسئله وجود ندارد.",
                    "needed_fa": "ثبت مداخله در intervention_registry.json با شواهد."}
        if not ok:
            return {"status": "INSUFFICIENT_DATA", "ranked": [], "unranked": scored,
                    "reason_fa": "هیچ مداخله‌ای عوامل کامل نداشت؛ رتبه‌بندی جعلی تولید نمی‌شود (§۴۵)."}
        ok.sort(key=lambda s: s["score"], reverse=True)
        return {
            "status": "OBSERVED",
            "ranked": ok,
            "unranked": [s for s in scored if s["score"] is None],
            "note_fa": "مداخلات با دادهٔ ناقص جدا گزارش می‌شوند و رتبه نمی‌گیرند.",
        }


class PortfolioOptimizer:
    """§45 — produce a portfolio, not a single action; abstain rather than fake."""

    def optimize(self, *, candidates: list, budget=None, max_duration=None,
                 responsible_orgs=None, legal_constraints=None,
                 execution_capacity=None, context: dict | None = None) -> dict:
        context = context or {}
        engine = InterventionEngine()
        missing_inputs = [k for k, v in {
            "budget": budget, "max_duration": max_duration,
            "responsible_orgs": responsible_orgs, "legal_constraints": legal_constraints,
            "execution_capacity": execution_capacity,
        }.items() if v is None]
        if missing_inputs:
            return {
                "status": "PORTFOLIO_OPTIMIZATION_UNAVAILABLE",
                "selected": [],
                "reason_fa": (f"ورودی‌های لازم بهینه‌سازی غایب است: {', '.join(missing_inputs)}. "
                              "بدون بودجه/زمان/سازمان مسئول/قید قانونی/ظرفیت اجرا هیچ سبدی پیشنهاد نمی‌شود (§۴۵)."),
                "needed_fa": "ثبت بودجه، افق زمانی، سازمان‌های مسئول، قیدهای قانونی و ظرفیت اجرا.",
                "no_fake_ranking_fa": "سیستم به‌جای تولید رتبهٔ جعلی، عدم‌امکان بهینه‌سازی را اعلام می‌کند.",
            }

        ranking = engine.rank(candidates=candidates, context=context)
        if ranking["status"] != "OBSERVED":
            return {
                "status": "PORTFOLIO_OPTIMIZATION_UNAVAILABLE",
                "selected": [],
                "ranking_status": ranking["status"],
                "reason_fa": "رتبه‌بندی معتبری برای مداخلات وجود ندارد؛ سبدی ساخته نمی‌شود.",
                "needed_fa": ranking.get("reason_fa"),
            }

        selected, spent, used_orgs, sequence = [], 0.0, [], []
        for cand in ranking["ranked"]:
            iv = engine.by_id.get(cand["intervention_id"], {})
            cost = (iv.get("capex") or 0) + (iv.get("opex") or 0)
            dur = iv.get("duration_months") or 0
            if spent + cost > budget:
                continue
            if max_duration is not None and dur > max_duration:
                continue
            harm = engine.harm_filter(iv)
            if harm["status"] == "INCOMPLETE":
                continue
            selected.append({
                "intervention_id": cand["intervention_id"],
                "name_fa": cand["name_fa"],
                "family": cand["family"],
                "score": cand["score"],
                "cost": cost,
                "duration_months": dur,
                "harm_filter": harm,
                "evidence_strength": cand.get("evidence_strength"),
            })
            spent += cost
            if iv.get("responsible_actor"):
                used_orgs.append(iv["responsible_actor"])
            sequence.append(cand["intervention_id"])

        if not selected:
            return {
                "status": "PORTFOLIO_OPTIMIZATION_UNAVAILABLE",
                "selected": [],
                "reason_fa": ("هیچ مداخله‌ای با قیدهای بودجه/زمان/فیلتر آسیب سازگار نبود؛ "
                              "سبد خالی صادقانه اعلام می‌شود (§۴۵)."),
                "needed_fa": "افزایش بودجه/افق زمانی یا ثبت مداخلات سازگار با قیدها.",
            }

        return {
            "status": "OBSERVED",
            "selected": selected,
            "total_cost": round(spent, 4),
            "remaining_budget": round(budget - spent, 4),
            "responsible_orgs": sorted(set(used_orgs)),
            "implementation_sequence": sequence,
            "constraints": {
                "budget": budget, "max_duration": max_duration,
                "responsible_orgs": responsible_orgs,
                "legal_constraints": legal_constraints,
                "execution_capacity": execution_capacity,
            },
            "note_fa": ("سبد از میان مداخلات ثبت‌شده و دارای فیلتر آسیب کامل انتخاب شده است. "
                        "اثر/عدالت/ریسک هر مداخله باید از رجیستر بیاید، نه از حدس."),
        }
