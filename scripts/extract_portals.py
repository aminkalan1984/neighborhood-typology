# -*- coding: utf-8 -*-
"""
استخراج داده‌های قابل استفادهٔ «مرکز آمار ایران» (پوشهٔ Portals) به
src/data/portals — به‌صورت JSON فشرده و طبقه‌بندی‌شده برای مصرف برنامه.

منابع:
  1) 0/GEO/DOC/Fehrest_Taghsimat_Keshvari_1401.xlsx  → divisions/gazetteer.json
  2) 0/GEO/2024/GEO1400.xlsx                          → macro/blocks-per-subdistrict.json
  3) 0/GEO/2024/Tedad_Blocks_Ostan_Census95.xlsx      → macro/census-blocks95.json
  4) 0/Files/Development indicators/*.ICPD.xlsx       → development/icpd-indicators.json

فایل‌های اصلی در Portals دست‌نخورده می‌مانند؛ این خروجی‌ها نسخهٔ کپی/تبدیل‌شده‌اند.
"""
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTALS = os.path.join(ROOT, "Portals")
OUT = os.path.join(ROOT, "src", "data", "portals")


def norm(s):
    """عادی‌سازی نام فارسی برای جستجو: ی→ی، ك→ک، حذف نیم‌فاصله/فاصله‌های تکراری"""
    if s is None:
        return ""
    s = str(s).strip()
    s = s.replace("\u064a", "\u06cc").replace("\u0643", "\u06a9")
    s = s.replace("\u200c", " ").replace("\u200f", "")
    s = re.sub(r"\s+", " ", s)
    return s


def clean_cell(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s in ("-", "--", "nan", "None") else s


def main():
    os.makedirs(os.path.join(OUT, "divisions"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "macro"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "development"), exist_ok=True)

    # ── ۱) گازتیر رسمی از فهرست تقسیمات کشوری ۱۴۰۱ ───────────────
    src = os.path.join(PORTALS, "0", "GEO", "DOC", "Fehrest_Taghsimat_Keshvari_1401.xlsx")
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = next(rows)  # noqa: F841

    provinces: dict[str, dict] = {}
    gazetteer: list[list] = []  # [ostanCode, ostanName, countyCode, countyName, bakhshCode, bakhshName, dehestanCode, dehestanName, type]
    seen = set()

    for r in rows:
        if not r or not r[0]:
            continue
        o_n, o_c = norm(r[0]), clean_cell(r[1])
        s_n, s_c = norm(r[2]), clean_cell(r[3])
        b_n, b_c = norm(r[4]), clean_cell(r[5])
        d_n, d_c = norm(r[6]), clean_cell(r[7])
        city = norm(r[8])
        if not o_c:
            continue

        provinces.setdefault(o_c, {"code": o_c, "name": o_n, "counties": 0})
        provinces[o_c]["name"] = o_n
        if s_c:
            provinces[o_c]["counties"] += 0

        # شهر (نوع city)
        if city:
            key = ("city", o_c, s_c, b_c, city)
            if key not in seen:
                seen.add(key)
                gazetteer.append([o_c, o_n, s_c, s_n, b_c, b_n, "", city, "city"])
        # دهستان (نوع dehestan) — فقط وقتی کد دهستان موجود باشد
        if d_c:
            key = ("deh", o_c, s_c, b_c, d_c)
            if key not in seen:
                seen.add(key)
                gazetteer.append([o_c, o_n, s_c, s_n, b_c, b_n, d_c, d_n, "dehestan"])
        # شهرستان بی‌بخش (استان‌های بدون تقسیم به بخش)
        elif s_c and b_c:
            key = ("bakhsh", o_c, s_c, b_c)
            if key not in seen:
                seen.add(key)
                gazetteer.append([o_c, o_n, s_c, s_n, b_c, b_n, "", "", "bakhsh"])
    wb.close()

    # شمارش شهرستان/بخش/دهستان هر استان برای خلاصه
    summary = []
    for code, p in sorted(provinces.items()):
        counties = {g[2] for g in gazetteer if g[0] == code and g[2]}
        bakhshs = {g[4] for g in gazetteer if g[0] == code and g[4]}
        dehestans = {g[6] for g in gazetteer if g[0] == code and g[6]}
        cities = {g[7] for g in gazetteer if g[0] == code and g[8] == "city" and g[7]}
        summary.append({
            "code": code,
            "name": p["name"],
            "counties": len(counties),
            "bakhshs": len(bakhshs),
            "dehestans": len(dehestans),
            "cities": len(cities),
        })

    gz_out = os.path.join(OUT, "divisions", "gazetteer.json")
    with open(gz_out, "w", encoding="utf-8") as f:
        json.dump(gazetteer, f, ensure_ascii=False, separators=(",", ":"))
    sum_out = os.path.join(OUT, "divisions", "divisions-summary.json")
    with open(sum_out, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)
    print(f"gazetteer: {len(gazetteer)} entries -> {gz_out}")
    print(f"summary: {len(summary)} provinces -> {sum_out}")

    # ── ۲) بلوک‌های آماری هر دهستان از GEO1400 (سرشماری ۹۵) ──────
    src2 = os.path.join(PORTALS, "0", "GEO", "2024", "GEO1400.xlsx")
    wb2 = openpyxl.load_workbook(src2, read_only=True, data_only=True)
    ws2 = wb2.worksheets[0]
    rows2 = ws2.iter_rows(values_only=True)
    next(rows2)
    blocks: dict[tuple, dict] = {}
    for r in rows2:
        if not r or not r[0]:
            continue
        key = (clean_cell(r[0]), clean_cell(r[2]), clean_cell(r[4]), clean_cell(r[6]))
        if not key[3]:
            continue
        rec = blocks.setdefault(key, {
            "ostan": clean_cell(r[0]), "ostanName": norm(r[1]),
            "county": clean_cell(r[2]), "countyName": norm(r[3]),
            "bakhsh": clean_cell(r[4]), "bakhshName": norm(r[5]),
            "dehestan": key[3], "dehestanName": norm(r[7]),
            "blocks": 0,
        })
        if r[8] and str(r[8]).strip():
            rec["blocks"] += 1
    wb2.close()
    blk_list = sorted(blocks.values(), key=lambda b: (b["ostan"], b["county"], b["dehestan"]))
    blk_out = os.path.join(OUT, "macro", "blocks-per-subdistrict.json")
    with open(blk_out, "w", encoding="utf-8") as f:
        json.dump(blk_list, f, ensure_ascii=False, separators=(",", ":"))
    print(f"blocks-per-subdistrict: {len(blk_list)} -> {blk_out}")

    # ── ۳) بلوک‌های هر استان (سرشماری ۹۵) ───────────────────────
    src3 = os.path.join(PORTALS, "0", "GEO", "2024", "Tedad_Blocks_Ostan_Census95.xlsx")
    wb3 = openpyxl.load_workbook(src3, read_only=True, data_only=True)
    ws3 = wb3.worksheets[0]
    rows3 = ws3.iter_rows(values_only=True)
    next(rows3)  # عنوان
    next(rows3)  # سربرگ
    pblocks = []
    for r in rows3:
        if not r or len(r) < 4 or not r[1]:
            continue
        code = clean_cell(r[1])
        if not code:
            continue
        try:
            n = int(r[3])
        except (TypeError, ValueError):
            continue
        pblocks.append({"code": code, "name": norm(r[2]), "blocks": n})
    wb3.close()
    pb_out = os.path.join(OUT, "macro", "census-blocks95.json")
    with open(pb_out, "w", encoding="utf-8") as f:
        json.dump(pblocks, f, ensure_ascii=False, separators=(",", ":"))
    print(f"census-blocks95: {len(pblocks)} provinces -> {pb_out}")

    # ── ۴) شاخص‌های توسعه (فایل‌های ICPD) ───────────────────────
    dev_dir = os.path.join(PORTALS, "0", "Files", "Development indicators")
    icpd: list[dict] = []
    if os.path.isdir(dev_dir):
        for fn in sorted(os.listdir(dev_dir)):
            if not fn.lower().endswith(".xlsx") or ".icpd" not in fn.lower():
                continue
            try:
                wbi = openpyxl.load_workbook(os.path.join(dev_dir, fn), read_only=True, data_only=True)
                wsi = wbi.worksheets[0]
                rows_i = wsi.iter_rows(values_only=True)
                header_i = next(rows_i)  # noqa: F841
                for r in rows_i:
                    if not r or not r[0]:
                        continue
                    icpd.append({
                        "file": fn,
                        "indicator": clean_cell(r[0]),
                        "sub": clean_cell(r[1]),
                        "year": clean_cell(r[2]),
                        "level": clean_cell(r[3]),
                        "value": clean_cell(r[4]),
                        "metadata": clean_cell(r[5]),
                        "scale": clean_cell(r[6]),
                        "source": clean_cell(r[7]),
                    })
                wbi.close()
            except Exception as e:  # noqa: BLE001
                print(f"  skip {fn}: {e}")
    icpd_out = os.path.join(OUT, "development", "icpd-indicators.json")
    with open(icpd_out, "w", encoding="utf-8") as f:
        json.dump(icpd, f, ensure_ascii=False, separators=(",", ":"))
    print(f"icpd-indicators: {len(icpd)} rows -> {icpd_out}")

    # ── اندازه‌ها ───────────────────────────────────────────────
    for dp, _, fns in os.walk(OUT):
        for fn in fns:
            p = os.path.join(dp, fn)
            print(f"  {os.path.relpath(p, ROOT)}: {os.path.getsize(p) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
