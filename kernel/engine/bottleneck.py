"""
Bottleneck Detection Engine — MVP-2 (engine/bottleneck.py).

AI-INDEPENDENT and PURE RULE-BASED (constraint 8): a deterministic function of the C-A-U-E-O
stage scores ONLY. It imports NO LLM/model client and makes NO network calls.

Core rules (algo.txt §21):
  1. BASE-DEFICIENCY FIRST (constraint 9): if Capacity (C) is OBSERVED and below the documented
     base threshold, flag «کمبود پایه» (base deficiency) as the primary bottleneck BEFORE
     selecting the largest chain gap — a low base is treated as the root, not the biggest gap.
  2. Otherwise rank the four chain gaps (C-A, A-U, U-E, E-O) by magnitude and take the largest
     OBSERVED gap as the primary bottleneck.
  3. Decompose the bottleneck across 5 dimensions where data allows: capital × chain-stage ×
     location (sub-neighborhood) × group × time.
  4. ABSTENTION GATE: publish NO bottleneck unless there is sufficient stage data + confidence.
     If the C-A-U-E-O stages are abstained (INSUFFICIENT_COVERAGE / WAITING_FOR_DATA), return
     «INSUFFICIENT_COVERAGE — bottleneck not determinable» and list exactly what is needed.
     NEVER fabricate a bottleneck.
"""

STAGE_ORDER = ["C", "A", "U", "E", "O"]
STAGE_NAME_FA = {"C": "ظرفیت (Capacity)", "A": "دسترسی (Access)", "U": "استفاده (Use)",
                 "E": "تجربه (Experience)", "O": "پیامد (Outcome)"}
GAP_DEFS = [("G_CA", "C", "A"), ("G_AU", "A", "U"), ("G_UE", "U", "E"), ("G_EO", "E", "O")]


def _obs(stage_result):
    """Return numeric value iff the stage is an OBSERVED number, else None."""
    if not stage_result:
        return None
    if stage_result.get("status") == "OBSERVED" and stage_result.get("value") is not None:
        return stage_result.get("value")
    return None


def detect_bottleneck(caueo, *, base_threshold=60.0, disaggregation=None, confidence=None):
    """
    caueo: {"C":{value,status}, "A":{...}, "U":{...}, "E":{...}, "O":{...}}  (stage aggregates)
    base_threshold: C below this (documented; default 60 = below «متوسط» band) => base deficiency
    disaggregation: optional {"location":bool,"group":bool,"time":bool} data availability flags
    confidence: optional aggregate-confidence dict to attach
    Returns a deterministic dict; NO model input.
    """
    disaggregation = disaggregation or {}
    stage_vals = {s: _obs(caueo.get(s)) for s in STAGE_ORDER}
    observed_stages = [s for s in STAGE_ORDER if stage_vals[s] is not None]

    # ---- abstention gate ----
    needed = []
    if len(observed_stages) == 0:
        needed = ["حداقل یک مرحله C-A-U-E-O با نمرهٔ استانداردشدهٔ معتبر (اکنون همه PENDING_VALIDATION/بدون‌داده)",
                  "کالیبراسیون L/U و وزن‌ها برای تولید نمرهٔ ۰–۱۰۰",
                  "دادهٔ مراحل U/E/O (پیمایشی/رفتاری) که برای پایلوت اصلاً برداشت نشده",
                  "تفکیک مکانی/گروهی/زمانی برای مکان‌یابی گلوگاه در ۵ بُعد"]
        return {
            "status": "INSUFFICIENT_COVERAGE",
            "primary_bottleneck": None,
            "base_deficiency": {"flagged": False, "reason": "C not observed"},
            "stage_scores": {s: caueo.get(s) for s in STAGE_ORDER},
            "chain_gaps": {g: {"value": None, "status": "INSUFFICIENT_COVERAGE"} for g, _, _ in GAP_DEFS},
            "gap_ranking": [],
            "decomposition": {d: {"available": False, "note": "no observed stage data"}
                              for d in ("capital", "chain_stage", "location", "group", "time")},
            "needed_data": needed,
            "note": "گلوگاه قابل‌تعیین نیست؛ شواهد کافی برای تشخیص وجود ندارد (هیچ مرحله‌ای نمرهٔ معتبر ندارد).",
            "ai_independent": True,
            "confidence": confidence,
        }

    # ---- chain gaps (only where both endpoints observed) ----
    gaps = {}
    for g, a, b in GAP_DEFS:
        if stage_vals[a] is not None and stage_vals[b] is not None:
            gaps[g] = {"value": round(stage_vals[a] - stage_vals[b], 4), "status": "OBSERVED",
                       "from": a, "to": b}
        else:
            gaps[g] = {"value": None, "status": "INSUFFICIENT_COVERAGE", "from": a, "to": b}
    ranking = sorted([{"gap": g, "value": abs(v["value"]), "signed": v["value"], "from": v["from"], "to": v["to"]}
                      for g, v in gaps.items() if v["status"] == "OBSERVED"],
                     key=lambda x: x["value"], reverse=True)

    # ---- base-deficiency check FIRST (constraint 9) ----
    c_val = stage_vals["C"]
    base = {"flagged": False, "value": c_val, "threshold": base_threshold}
    primary = None
    if c_val is not None and c_val < base_threshold:
        base["flagged"] = True
        base["note"] = (f"ظرفیت پایه پایین است (C={c_val} < آستانهٔ {base_threshold})؛ طبق قاعدهٔ الگوریتم، "
                        "«کمبود پایه» به‌عنوان گلوگاه اصلی پیش از انتخاب بزرگ‌ترین شکاف علامت‌گذاری می‌شود.")
        primary = {"type": "base_deficiency", "stage": "C", "stage_name": STAGE_NAME_FA["C"],
                   "value": c_val, "rule": "base-deficiency-first (algo.txt §21, constraint 9)"}
    elif ranking:
        top = ranking[0]
        primary = {"type": "chain_gap", "gap": top["gap"], "from": top["from"], "to": top["to"],
                   "value": top["signed"], "stage_name": f"{STAGE_NAME_FA[top['from']]} → {STAGE_NAME_FA[top['to']]}",
                   "rule": "largest-observed-chain-gap"}
    else:
        # some stages observed but no full gap pair -> cannot rank a transition
        return {
            "status": "INSUFFICIENT_COVERAGE",
            "primary_bottleneck": None,
            "base_deficiency": base,
            "stage_scores": {s: caueo.get(s) for s in STAGE_ORDER},
            "chain_gaps": gaps, "gap_ranking": [],
            "decomposition": {d: {"available": bool(disaggregation.get(d)), "note": "insufficient adjacent-stage pairs"}
                              for d in ("capital", "chain_stage", "location", "group", "time")},
            "needed_data": ["نمرهٔ معتبر برای مراحل مجاورِ زنجیره تا بتوان دست‌کم یک شکاف را رتبه‌بندی کرد"],
            "note": "برخی مراحل نمره دارند اما هیچ جفتِ مجاور کامل نیست؛ گلوگاه گذار قابل رتبه‌بندی نیست.",
            "ai_independent": True, "confidence": confidence,
        }

    decomposition = {
        "capital": {"available": bool(disaggregation.get("capital")),
                    "note": "نیازمند نمرهٔ سرمایه‌های مجزا" if not disaggregation.get("capital") else "ok"},
        "chain_stage": {"available": True, "note": "C-A-U-E-O در دسترس"},
        "location": {"available": bool(disaggregation.get("location")),
                     "note": "نیازمند تفکیک زیرمحله/بلوک" if not disaggregation.get("location") else "ok"},
        "group": {"available": bool(disaggregation.get("group")),
                  "note": "نیازمند دادهٔ تفکیک‌شدهٔ گروهی" if not disaggregation.get("group") else "ok"},
        "time": {"available": bool(disaggregation.get("time")),
                 "note": "نیازمند سری زمانی" if not disaggregation.get("time") else "ok"},
    }
    undetermined_dims = [d for d in ("location", "group", "time") if not decomposition[d]["available"]]

    return {
        "status": "OBSERVED",
        "primary_bottleneck": primary,
        "base_deficiency": base,
        "stage_scores": {s: caueo.get(s) for s in STAGE_ORDER},
        "chain_gaps": gaps,
        "gap_ranking": ranking,
        "decomposition": decomposition,
        "needed_data": ([f"تفکیک {', '.join(undetermined_dims)} برای مکان‌یابی کامل گلوگاه در ۵ بُعد"]
                        if undetermined_dims else []),
        "note": "گلوگاه به‌صورت قاعده‌محور و مستقل از AI تعیین شد.",
        "ai_independent": True,
        "confidence": confidence,
    }
