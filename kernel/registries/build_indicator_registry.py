# -*- coding: utf-8 -*-
"""
Builder for the SINGLE master indicator registry.

    kernel/registries/indicator_registry.json

This file is the one and only semantic reference for indicator definitions
(master instruction §7). The former registries become *inputs* to this build and
stop being independent references:

    registry_419.json      -> supporting/context indicators (they self-declare
                              capital, chain stage, role, target, direction, unit)
    core_40.json           -> core decision indicators (core=true). Their mapping
                              to registry_419 is read from the EXPLICIT mapping
                              registry core40_mapping.json — never guessed.
    online_83.json         -> online/evidence layer (online=true)
    questionnaire_15.json  -> perceptual (E) indicators (PERC-*)

Mapping rule (§7.5): EXPLICIT ONLY. No fuzzy matching, no keyword matching, no
guessing. A code with no declared mapping is emitted as UNMAPPED and its data
cannot enter calculation.

Run:  python kernel/registries/build_indicator_registry.py
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "indicator_registry.json")
MAPPING_FILE = os.path.join(HERE, "core40_mapping.json")

REGISTRY_VERSION = "IR-v1"

CAPITAL_CODE_BY_FA = {
    "انسانی": "H", "اجتماعی": "S", "اقتصادی": "EC", "کالبدی–زیرساختی": "P",
    "طبیعی–محیطی": "N", "فرهنگی–هویتی": "C", "نهادی–حکمرانی": "G",
    "شبکه‌ای–ارتباطی": "R",
}
CAPITAL_FA = {v: k for k, v in CAPITAL_CODE_BY_FA.items()}
CAPITAL_EN = {
    "H": "Human", "S": "Social", "EC": "Economic", "P": "Physical",
    "N": "Natural/Environmental", "C": "Cultural/Identity",
    "G": "Institutional/Governance", "R": "Network/Connectivity",
}

ROLE_MAP = {
    "ظرفیت": "capacity", "دسترسی": "access", "استفاده": "use",
    "تجربه": "experience", "پیامد": "outcome", "تبدیل": "conversion",
    "عدالت": "equity", "ریسک": "risk", "بازتولید": "reproduction",
}
ROLE_TO_STAGE = {
    "capacity": "C", "access": "A", "use": "U", "experience": "E", "outcome": "O",
}

STREAM_TOKENS = [
    ("مکانی", "spatial"), ("ادراکی", "perceptual"), ("رفتاری", "behavioral"),
    ("عینی", "objective"),
]


def indicator_class(access_status: str) -> str:
    """§76 AUTO / HYBRID / FIELD_REQUIRED — declared by access status only."""
    a = str(access_status or "")
    if "برخط/باز" in a:
        return "AUTO"
    if "تولید میدانی" in a and "درخواست سازمانی" not in a:
        return "FIELD_REQUIRED"
    if "تولید میدانی" in a:
        return "HYBRID"
    if "درخواست سازمانی" in a:
        return "HYBRID"
    return "HYBRID"


def direction_of(text: str) -> str:
    t = str(text or "")
    if "معکوس" in t:
        return "inverse"
    if "آستانه" in t or "بهینه" in t:
        return "threshold"
    if "خنثی" in t or "زمینه" in t:
        return "neutral"
    return "positive"


def streams_of(text: str) -> list:
    out = []
    for token, name in STREAM_TOKENS:
        if token in str(text or "") and name not in out:
            out.append(name)
    return out


def stage_of(text):
    t = str(text or "").strip()
    for letter in ("C", "A", "U", "E", "O"):
        if t.startswith(letter):
            return letter
    return None


def target_of(text):
    t = str(text or "").strip().upper()
    for letter in ("K", "Q", "T", "R"):
        if t.startswith(letter):
            return letter
    return None


def load(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return json.load(f)


def build() -> dict:
    reg419 = load("registry_419.json")
    core40 = load("core_40.json")
    online83 = load("online_83.json")
    q15 = load("questionnaire_15.json")
    thresholds = load("threshold_registry_v1.json")
    lu = thresholds.get("indicator_LU", {})
    mapping_reg = load("core40_mapping.json")
    declared = mapping_reg["mappings"]

    core_by_code = {r[core40["code_field"]]: r for r in core40["records"]}
    r419_codes = {r["کد"] for r in reg419["records"]}

    # validate the declared mapping: every target must exist in registry_419
    mapping_errors = []
    for core_code, decl in declared.items():
        for kc in decl.get("kernel_codes") or []:
            if kc not in r419_codes:
                mapping_errors.append(f"{core_code} -> {kc} (target not in registry_419)")
    if mapping_errors:
        raise SystemExit("EXPLICIT MAPPING REGISTRY INVALID: " + "; ".join(mapping_errors))

    # registry_419 codes claimed by a declared mapping
    claimed = {}
    for core_code, decl in declared.items():
        for kc in decl.get("kernel_codes") or []:
            claimed.setdefault(kc, core_code)

    records = []

    # ---- canonical records from registry_419 ---------------------------------
    for rec in reg419["records"]:
        code = rec["کد"]
        capital = rec.get("کد سرمایه") or ""
        role = ROLE_MAP.get(str(rec.get("نقش سیستمی")).strip())
        stage = stage_of(rec.get("مرحله C-A-U-E-O")) or (ROLE_TO_STAGE.get(role) if role else None)
        streams = streams_of(rec.get("جریان‌های شاهد"))
        access = rec.get("وضعیت دسترسی")
        core_code = claimed.get(code)
        lu_entry = lu.get(code) or {}
        records.append({
            "code": code,
            "canonical_id": code,
            "name_fa": rec.get("عنوان شاخص"),
            "name_en": None,
            "capital": capital,
            "capital_name_fa": CAPITAL_FA.get(capital, rec.get("سرمایه اصلی")),
            "capital_name_en": CAPITAL_EN.get(capital),
            "secondary_capitals": rec.get("سرمایه‌های ثانویه"),
            "chain_stage": stage,
            "role": role,
            "qtr_target": target_of(rec.get("هدف K/Q/T/R")),
            "definition": rec.get("فرمول محاسبه"),
            "formula": rec.get("فرمول محاسبه"),
            "unit": rec.get("واحد اصلی"),
            "theoretical_range": rec.get("محدوده نظری"),
            "direction": direction_of(rec.get("جهت")),
            "direction_text": rec.get("جهت"),
            "standardization_method": rec.get("روش استانداردسازی"),
            "calculation_family": rec.get("خانواده محاسبه"),
            "evidence_streams": streams,
            "core": core_code is not None,
            "core_code": core_code,
            "online": False,
            "access_status": access,
            "indicator_class": indicator_class(access),
            "proxy_allowed": "spatial" in streams,
            "spatial_resolution": rec.get("مقیاس استفاده") or rec.get("تفکیک مکانی"),
            "temporal_frequency": rec.get("تناوب پیشنهادی"),
            "primary_sources": [rec.get("منبع/داده موردنیاز")] if rec.get("منبع/داده موردنیاز") else [],
            "alternative_sources": [],
            "equity_dimensions": rec.get("تفکیک عدالت"),
            "quality_control": rec.get("کنترل کیفیت"),
            "extraction_steps": rec.get("مراحل استخراج"),
            "reference_procedures": rec.get("رویه‌های مرجع"),
            "driver_10": rec.get("پیشران ۱۰گانه"),
            "registry_layer": "registry_419",
            "calibration_status": lu_entry.get("lu_status") or "NO_LU_ENTRY",
            "calibration": {
                "L": lu_entry.get("L"), "U": lu_entry.get("U"),
                "range_text": lu_entry.get("range_text"),
                "status": lu_entry.get("lu_status") or "NO_LU_ENTRY",
            },
            "mapping": ({"relation": declared[core_code]["relation"],
                         "core_code": core_code,
                         "declared_in": "core40_mapping.json",
                         "version": mapping_reg["version"],
                         "explicit": True} if core_code else
                        {"relation": "SELF_DECLARED", "explicit": True}),
            "version": REGISTRY_VERSION,
        })

    # ---- core_40 decision indicators -----------------------------------------
    for core_code, rec in core_by_code.items():
        decl = declared.get(core_code)
        mapped = bool(decl and decl.get("kernel_codes"))
        entry = {
            "code": core_code,
            "canonical_id": core_code,
            "name_fa": rec.get("شاخص"),
            "name_en": None,
            "capital": CAPITAL_CODE_BY_FA.get(rec.get("سرمایه")),
            "capital_name_fa": rec.get("سرمایه"),
            "capital_name_en": None,
            "secondary_capitals": None,
            "chain_stage": stage_of(rec.get("نقش سیستم")) or ROLE_TO_STAGE.get(
                ROLE_MAP.get(str(rec.get("نقش سیستم")).strip()) or ""),
            "role": ROLE_MAP.get(str(rec.get("نقش سیستم")).strip()),
            "qtr_target": None,
            "definition": rec.get("تعریف/فرمول عملیاتی"),
            "formula": rec.get("تعریف/فرمول عملیاتی"),
            "numerator": rec.get("صورت"),
            "denominator": rec.get("مخرج"),
            "unit": rec.get("واحد"),
            "theoretical_range": None,
            "direction": direction_of(rec.get("جهت")),
            "direction_text": rec.get("جهت"),
            "standardization_method": None,
            "calculation_family": None,
            "evidence_streams": [],
            "core": True,
            "core_code": core_code,
            "online": False,
            "access_status": None,
            "indicator_class": "FIELD_REQUIRED",
            "proxy_allowed": False,
            "spatial_resolution": None,
            "temporal_frequency": rec.get("تناوب پیشنهادی"),
            "primary_sources": [rec.get("منبع اصلی")] if rec.get("منبع اصلی") else [],
            "alternative_sources": [],
            "equity_dimensions": rec.get("تفکیک عدالت"),
            "quality_control": rec.get("کنترل کیفیت"),
            "extraction_steps": None,
            "reference_procedures": None,
            "driver_10": None,
            "registry_layer": "core_40",
            "calibration_status": "NO_LU_ENTRY",
            "calibration": {"L": None, "U": None, "status": "NO_LU_ENTRY"},
            "mapping": ({"relation": decl["relation"],
                         "kernel_codes": decl["kernel_codes"],
                         "declared_in": "core40_mapping.json",
                         "version": mapping_reg["version"],
                         "evidence_fa": decl.get("evidence_fa"),
                         "explicit": True} if mapped else
                        {"relation": "UNMAPPED", "kernel_codes": [],
                         "declared_in": "core40_mapping.json",
                         "version": mapping_reg["version"],
                         "reason_fa": mapping_reg.get("declared_unmapped_reason_fa"),
                         "explicit": False}),
            "version": REGISTRY_VERSION,
        }
        records.append(entry)

    # ---- online_83: operationalizations (evidence / online layer) ------------
    for rec in online83["records"]:
        records.append({
            "code": rec["کد"], "canonical_id": rec["کد"],
            "name_fa": rec.get("شاخص عملیاتی برخط"), "name_en": None,
            "capital": None, "capital_name_fa": rec.get("ساحت"), "capital_name_en": None,
            "secondary_capitals": None, "chain_stage": None, "role": None, "qtr_target": None,
            "definition": rec.get("شیوه محاسبه"), "formula": rec.get("شیوه محاسبه"),
            "unit": rec.get("واحد"), "theoretical_range": None,
            "direction": direction_of(rec.get("جهت تفسیر")),
            "direction_text": rec.get("جهت تفسیر"), "standardization_method": None,
            "calculation_family": None, "evidence_streams": ["spatial", "objective"],
            "core": False, "core_code": None, "online": True,
            "access_status": "برخط/باز", "indicator_class": "AUTO",
            "proxy_allowed": True, "spatial_resolution": rec.get("مقیاس استفاده"),
            "temporal_frequency": None,
            "primary_sources": [rec.get("منبع")] if rec.get("منبع") else [],
            "alternative_sources": [],
            "parent_registry_codes": rec.get("ردیف‌های شاخص مادر"),
            "required_inputs": rec.get("ورودی/باند لازم"),
            "compliance_type": rec.get("نوع انطباق"),
            "equity_dimensions": None, "quality_control": None, "extraction_steps": None,
            "reference_procedures": None, "driver_10": None,
            "registry_layer": "online_83",
            "calibration_status": "EVIDENCE_ONLY",
            "calibration": {"L": None, "U": None, "status": "EVIDENCE_ONLY"},
            "mapping": {"relation": "EVIDENCE_ONLY", "explicit": True,
                        "reason_fa": "سنجهٔ برخط؛ فقط با نگاشت و کالیبراسیون معتبر وارد امتیاز می‌شود (§۸۰)."},
            "version": REGISTRY_VERSION,
        })

    # ---- questionnaire_15: perceptual E-layer indicators ---------------------
    for rec in q15["records"]:
        code = "PERC-" + rec["کد"]
        records.append({
            "code": code, "canonical_id": code,
            "name_fa": rec.get("گویه"), "name_en": None,
            "capital": None, "capital_name_fa": rec.get("لایه"), "capital_name_en": None,
            "secondary_capitals": None, "chain_stage": "E", "role": "experience",
            "qtr_target": "Q",
            "definition": rec.get("محاسبه"), "formula": rec.get("محاسبه"),
            "unit": "score_0_100", "theoretical_range": "۰ تا ۱۰۰",
            "direction": direction_of(rec.get("جهت")),
            "direction_text": rec.get("جهت"),
            "standardization_method": "likert_1_5_to_0_100",
            "calculation_family": "survey_or_assessment",
            "evidence_streams": ["perceptual"],
            "core": False, "core_code": None, "online": False,
            "access_status": "تولید میدانی", "indicator_class": "FIELD_REQUIRED",
            "proxy_allowed": False, "spatial_resolution": "neighborhood",
            "temporal_frequency": None,
            "primary_sources": ["questionnaire_15"], "alternative_sources": [],
            "questionnaire_code": rec["کد"], "skip_logic": rec.get("منطق پرش"),
            "scale": rec.get("مقیاس"), "equity_dimensions": None,
            "quality_control": rec.get("کنترل کیفیت"), "extraction_steps": None,
            "reference_procedures": None, "driver_10": None,
            "registry_layer": "questionnaire_15",
            "calibration_status": "PENDING_VALIDATION",
            "calibration": {"L": 0.0, "U": 100.0, "status": "PENDING_VALIDATION"},
            "mapping": {"relation": "PERCEPTUAL", "explicit": True},
            "version": REGISTRY_VERSION,
        })

    records.sort(key=lambda r: r["canonical_id"])

    unmapped = [r["canonical_id"] for r in records if not r["mapping"].get("explicit")]

    return {
        "registry": "indicator_registry",
        "version": REGISTRY_VERSION,
        "role_fa": "مرجع واحد معنایی همهٔ شاخص‌ها (§۷). هیچ رجیستر شاخص دومی مجاز نیست.",
        "generated_by": "kernel/registries/build_indicator_registry.py",
        "source_layers": {
            "registry_419": {"file": "registry_419.json", "records": len(reg419["records"])},
            "core_40": {"file": "core_40.json", "records": len(core40["records"]),
                        "usage": "شاخص‌های تصمیم core=true؛ نگاشت از core40_mapping.json"},
            "online_83": {"file": "online_83.json", "records": len(online83["records"]),
                          "usage": "لایهٔ شواهد/برخط online=true"},
            "questionnaire_15": {"file": "questionnaire_15.json", "records": len(q15["records"]),
                                 "usage": "شاخص‌های ادراکی PERC-*"},
        },
        "counts": {
            "total": len(records),
            "core": sum(1 for r in records if r["core"]),
            "online": sum(1 for r in records if r["online"]),
            "perceptual": sum(1 for r in records if r["registry_layer"] == "questionnaire_15"),
            "by_capital": {c: sum(1 for r in records if r["capital"] == c) for c in CAPITAL_EN},
            "by_stage": {s: sum(1 for r in records if r["chain_stage"] == s) for s in "CAUEO"},
            "by_class": {k: sum(1 for r in records if r["indicator_class"] == k)
                         for k in ("AUTO", "HYBRID", "FIELD_REQUIRED")},
            "unmapped": len(unmapped),
        },
        "unmapped_codes": unmapped,
        "records": records,
    }


def main() -> int:
    reg = build()
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=1)
    print("wrote " + OUT)
    print(json.dumps(reg["counts"], ensure_ascii=False, indent=2))
    print("unmapped:", reg["unmapped_codes"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
