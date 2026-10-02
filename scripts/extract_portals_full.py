# -*- coding: utf-8 -*-
"""استخراج جامع تمام داده‌های قابل استفادهٔ Portals → src/data/portals/
دسته‌بندی‌ها:
  divisions/      گازتیر رسمی + خلاصهٔ تقسیمات (از GEO1400 + فهرست ۱۴۰۱)
  development/    شاخص‌های توسعه: ICPD فارسی (۴۵ فایل) + MDG انگلیسی (۲۰۱۴) + شاخص‌های برنامهٔ ششم
  population/     پیش‌بینی/برآورد جمعیت و خانوار (استان‌محور)
  geo/            بلوک‌های سرشماری به تفکیک استان
  statistical/    شناسنامهٔ آمار رسمی (۱۴۰۲/۱۴۰۳/۱۴۰۴) + تقویم محصولات آماری
  classifications/طبقه‌بندی‌های استاندارد (ISCO/ISIC/ISCED/HS/ICATUS)
  agriculture/    دام و طیور و محصولات کشاورزی (استان‌محور)
"""
import os, sys, json, glob, re

sys.stdout.reconfigure(encoding='utf-8')
ROOT = 'Portals'
OUT = 'src/data/portals'
os.makedirs(OUT, exist_ok=True)

def norm(v):
    if v is None:
        return ''
    s = str(v).strip()
    if s in ('ـ', '-', '—', '*', '…', '...', 'nan', 'None', 'N/A', 'N.A'):
        return ''
    return s

def fa_digit(v):
    """نرمال‌سازی ارقام (فارسی/عربی/انگلیسی)، نیم‌فاصله و حروف عربی→فارسی برای کلیدهای متنی."""
    s = norm(v)
    fa = {'۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
          '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'}
    s = ''.join(fa.get(ch, ch) for ch in s).replace('\u200c', ' ')
    return s.replace('ي', 'ی').replace('ك', 'ک').replace('ة', 'ه').replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')

def to_num(v):
    s = fa_digit(v)
    s = s.replace('٬', '').replace(',', '').replace('٫', '.').strip()
    try:
        return float(s)
    except Exception:
        return None

def load_xlsx(f):
    import openpyxl
    wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
    out = {}
    for name in wb.sheetnames:
        ws = wb[name]
        rows = [[c for c in row] for row in ws.iter_rows(values_only=True)]
        out[name] = rows
    wb.close()
    return out

def load_xls(f):
    import xlrd
    book = xlrd.open_workbook(f)
    out = {}
    for name in book.sheet_names():
        sh = book.sheet_by_name(name)
        out[name] = [list(sh.row_values(i)) for i in range(sh.nrows)]
    return out

def load(f):
    return load_xlsx(f) if f.lower().endswith('.xlsx') else load_xls(f)

def clean_rows(rows):
    return [[norm(c) for c in r] for r in rows]

# ════════════════════════════════════════════════════════════════
# ۱) DIVISIONS — گازتیر رسمی (قبلاً استخراج شده؛ فقط تأیید/به‌روزرسانی)
# ════════════════════════════════════════════════════════════════
print('1) divisions ...')
# (گازتیر در استخراج قبلی scripts/extract_portals.py ساخته شده — اینجا فقط اطمینان از وجود)
for f in ['divisions/gazetteer.json', 'divisions/divisions-summary.json']:
    p = os.path.join(OUT, f)
    print('   ', p, 'EXISTS' if os.path.exists(p) else 'MISSING', os.path.getsize(p) if os.path.exists(p) else '')

# ════════════════════════════════════════════════════════════════
# ۲) DEVELOPMENT — شاخص‌های توسعه
# ════════════════════════════════════════════════════════════════
print('2) development ...')
os.makedirs(f'{OUT}/development', exist_ok=True)

# ۲الف) ICPD فارسی — ادغام همهٔ فایل‌های 1..45.ICPD.xlsx
# دو چیدمان: (الف) جدول ۸ ستونهٔ [شاخص|زیرشاخص|سال|سطح|مقدار|...]  (ب) ماتریس استان×سال
icpd_rows = []
icpd_files = sorted(glob.glob(f'{ROOT}/0/Files/Development indicators/*.ICPD.xlsx'))
for f in icpd_files:
    try:
        sheets = load(f)
        for rows in sheets.values():
            rows = clean_rows(rows)
            if not rows:
                continue
            title = norm(rows[0][0]) if rows and norm(rows[0][0]) else (norm(rows[1][0]) if len(rows) > 1 else '')
            # چیدمان (ب): اگر ردیفی شامل نام استان در ستون اول و سال در سرستون باشد
            hdr_idx = None
            for i, r in enumerate(rows[:6]):
                joined = fa_digit(' '.join(str(c) for c in r[:8])).replace(' ', '')
                if 'استان' in joined and any(re.match(r'^13\d{2}', fa_digit(c).replace('.0', '')) for c in r):
                    hdr_idx = i
                    break
            is_matrix = hdr_idx is not None
            if is_matrix:
                years = [fa_digit(c).replace('.0', '').replace('*', '') for c in rows[hdr_idx]]
                prov_col = 0
                # ستون استان: ستونی که در ردیف‌های بعدی نام استان دارد
                for c in range(min(3, len(rows[hdr_idx]))):
                    cnt = sum(1 for r in rows[hdr_idx + 1:hdr_idx + 12] if c < len(r) and fa_digit(r[c]).replace(' ', '') in ('تهران', 'اصفهان', 'فارس', 'مرکزی', 'خراسان رضوی'))
                    if cnt >= 3:
                        prov_col = c
                        break
                for r in rows[hdr_idx + 1:]:
                    prov = fa_digit(r[prov_col])
                    if not prov or prov in ('کل کشور', 'جمع', 'جمع کل', 'نکته:', 'توضیحات'):
                        continue
                    for j in range(1, min(len(r), len(years))):
                        v = norm(r[j])
                        y = years[j]
                        if v and re.match(r'^13\d{2}$', y):
                            icpd_rows.append({
                                'indicator': title,
                                'sub': '',
                                'year': y,
                                'level': prov,
                                'value': v,
                                'metadata': '',
                                'scale': '',
                                'source': os.path.basename(f),
                            })
                continue
            # چیدمان (الف): ۸ ستونه
            for r in rows:
                if not r or r[0] is None:
                    continue
                cells = [norm(c) for c in r[:8]]
                if cells[0] in ('شاخص', 'ردیف', '') and 'زیر شاخص' in cells[1]:
                    continue
                if not cells[0] and not cells[1]:
                    continue
                if fa_digit(cells[0]).startswith('1') and len(cells[0]) < 4 and cells[0] != '1':
                    continue  # شمارهٔ شاخص تنها
                if cells[0] in ('زز',) or fa_digit(cells[0]) in ('رديف', 'ردیف', 'شاخص'):
                    continue
                icpd_rows.append({
                    'indicator': cells[0],
                    'sub': cells[1],
                    'year': cells[2],
                    'level': cells[3],
                    'value': cells[4],
                    'metadata': cells[5],
                    'scale': cells[6],
                    'source': cells[7],
                })
    except Exception as e:
        print('   ICPD ERR', os.path.basename(f), str(e)[:60])
with open(f'{OUT}/development/icpd-indicators.json', 'w', encoding='utf-8') as fh:
    json.dump(icpd_rows, fh, ensure_ascii=False)
print(f'   icpd-indicators.json: {len(icpd_rows)} rows from {len(icpd_files)} files')

# ۲ب) شاخص‌های برنامهٔ ششم توسعه (۱۳۹۷–۱۴۰۱) — فهرست موضوعی + داده
plan6 = []
plan6_files = [f'{ROOT}/0/شاخص های توسعه/NE_Shakhes_Barname_6_Tosee_1397-1401.xlsx']
for f in plan6_files:
    try:
        sheets = load(f)
        for sname, rows in sheets.items():
            if sname == 'فهرست':
                continue
            for r in rows:
                cells = [norm(c) for c in r[:6]]
                if not any(cells):
                    continue
                plan6.append({'sheet': sname, 'cells': cells})
    except Exception as e:
        print('   plan6 ERR', str(e)[:60])
with open(f'{OUT}/development/plan6-indicators.json', 'w', encoding='utf-8') as fh:
    json.dump(plan6, fh, ensure_ascii=False)
print(f'   plan6-indicators.json: {len(plan6)} rows')

# ۲ج) MDG انگلیسی ۲۰۱۴ — ماتریس استان×سال برای هر شاخص
mdg = []
mdg_files = sorted(glob.glob(f'{ROOT}/2/Files/2014/*.xlsx'))
for f in mdg_files:
    try:
        sheets = load(f)
        for rows in sheets.values():
            if not rows:
                continue
            title = norm(rows[1][0]) if len(rows) > 1 and norm(rows[1][0]) else (norm(rows[0][0]) if rows else '')
            if 'Province' not in ' '.join(str(c) for c in (rows[3] if len(rows) > 3 else [])):
                continue
            header = [fa_digit(c) for c in rows[3]]
            for r in rows[4:]:
                prov = norm(r[0])
                if not prov or prov.lower() in ('total',):
                    continue
                for j in range(1, min(len(r), len(header))):
                    v = norm(r[j])
                    if not v:
                        continue
                    mdg.append({
                        'indicator': title,
                        'province_en': prov,
                        'year': header[j] if header[j] else '',
                        'value': v,
                    })
    except Exception as e:
        print('   MDG ERR', os.path.basename(f), str(e)[:60])
with open(f'{OUT}/development/mdg-2014.json', 'w', encoding='utf-8') as fh:
    json.dump(mdg, fh, ensure_ascii=False)
print(f'   mdg-2014.json: {len(mdg)} rows from {len(mdg_files)} files')

# ════════════════════════════════════════════════════════════════
# ۳) POPULATION — جمعیت و خانوار (استان‌محور)
# ════════════════════════════════════════════════════════════════
print('3) population ...')
os.makedirs(f'{OUT}/population', exist_ok=True)

def extract_region_table(f, sheets_ok, out_path):
    """استان × سال‌ها: جدول‌های تاریخی جمعیت/خانوار (ردیف سال‌ها جدا از ردیف استان‌ها).
    ساختار نمونه: [رديف|نام استان|کل|1385*|1386|...] سپس ردیف‌های استان با نام در ستون ۱."""
    try:
        sheets = load(f)
        out = []
        for sname, rows in sheets.items():
            if sheets_ok and sname not in sheets_ok:
                continue
            rows = clean_rows(rows)
            if not rows:
                continue
            # ردیف سال‌ها: اولین ردیفی که حداقل ۲ خانه‌اش الگوی سال (۴ رقم) دارد
            year_idx = None
            year_cols = []
            for i, r in enumerate(rows[:10]):
                cols = [j for j, c in enumerate(r) if re.match(r'^(13\d{2}|14\d{2})', fa_digit(c).replace('.0', ''))]
                if len(cols) >= 2:
                    year_idx = i
                    year_cols = cols
                    break
            if year_idx is None:
                continue
            # ستون نام استان: ستونی که در ردیف‌های بعدی نام‌های استان را دارد (حداقل ۵ ردیف با نام)
            prov_col = 1
            best = 0
            for c in range(min(len(rows[year_idx]), 4)):
                cnt = 0
                for r in rows[year_idx + 1:]:
                    if len(r) > c and fa_digit(r[c]) in ('تهران', 'اصفهان', 'فارس', 'خراسان رضوی', 'آذربایجان شرقی'):
                        cnt += 1
                if cnt > best:
                    best = cnt
                    prov_col = c
            years = {j: fa_digit(rows[year_idx][j]).replace('.0', '').replace('*', '') for j in year_cols}
            for r in rows[year_idx + 1:]:
                prov = fa_digit(r[prov_col])
                if not prov or prov in ('کل کشور', 'جمع کل', 'منابع:', 'ردیف', 'رديف'):
                    continue
                rec = {'province': prov, 'years': {}}
                for j, y in years.items():
                    if j < len(r):
                        v = to_num(r[j])
                        if v is not None:
                            rec['years'][y] = round(v, 3)
                if rec['years']:
                    out.append(rec)
        with open(out_path, 'w', encoding='utf-8') as fh:
            json.dump(out, fh, ensure_ascii=False)
        print(f'   {os.path.basename(out_path)}: {len(out)} provinces')
        return True
    except Exception as e:
        print('   ERR', os.path.basename(f), str(e)[:60])
        return False

# پیش‌بینی جمعیت ۱۳۹۶–۱۴۱۵ (جدول‌های چندگانه در یک شیت)
try:
    sheets = load(f'{ROOT}/0/Statistics/10982/Baravord_Jamiat_1396-1415_v2.xlsx')
    rows = clean_rows(sheets['population'])
    years = []
    i = 0
    while i < len(rows):
        r = rows[i]
        m = re.match(r'^(\d{4}):', fa_digit(r[0]))
        if m:
            year = m.group(1)
            # پیدا کردن ردیف سرستون بعدی
            j = i + 1
            while j < len(rows) and 'استان' not in rows[j][0]:
                j += 1
            if j >= len(rows):
                break
            hdr = rows[j]
            k = j + 1
            while k < len(rows) and not re.match(r'^(\d{4}):', fa_digit(rows[k][0])):
                cells = [norm(c) for c in rows[k]]
                if cells[0] and cells[0] != 'کل کشور':
                    years.append({
                        'year': year,
                        'province': cells[0],
                        'total': to_num(cells[1]),
                        'male': to_num(cells[2]),
                        'female': to_num(cells[3]),
                        'urban_total': to_num(cells[4]),
                        'urban_male': to_num(cells[5]),
                        'urban_female': to_num(cells[6]),
                        'rural_total': to_num(cells[7]),
                        'rural_male': to_num(cells[8]),
                        'rural_female': to_num(cells[9]),
                    })
                k += 1
            i = k
        else:
            i += 1
    with open(f'{OUT}/population/projections-1396-1415.json', 'w', encoding='utf-8') as fh:
        json.dump(years, fh, ensure_ascii=False)
    print(f'   projections-1396-1415.json: {len(years)} province-year rows')
except Exception as e:
    print('   projections ERR', str(e)[:80])

# برآوردهای تاریخی جمعیت/خانوار (استان‌محور)
hist_files = {
    f'{ROOT}/0/Statistics/10984/population90-95.xlsx': 'estimates-1390-1395.json',
    f'{ROOT}/0/Statistics/10985/population _85_95.xls': 'estimates-1385-1395.json',
    f'{ROOT}/0/Statistics/10986/household_85_95.xls': 'households-1385-1395.json',
}
for f, name in hist_files.items():
    extract_region_table(f, None, f'{OUT}/population/{name}')

# برآورد ۷۵–۹۵: سری ملی سال × شهری/روستایی (بدون تفکیک استان)
try:
    sheets = load(f'{ROOT}/0/Statistics/10987/population75-95.xlsx')
    rows = clean_rows(list(sheets.values())[0])
    national = []
    for r in rows[3:]:
        y = fa_digit(r[0]).replace('.0', '')
        if not re.match(r'^13\d{2}$', y):
            continue
        vals = [to_num(c) for c in r[1:6]]
        if any(v is not None for v in vals):
            national.append({
                'year': y,
                'total': vals[0], 'male': vals[1], 'female': vals[2],
                'urban_total': vals[3], 'urban_male': vals[4], 'urban_female': to_num(r[6]) if len(r) > 6 else None,
            })
    with open(f'{OUT}/population/national-1375-1395.json', 'w', encoding='utf-8') as fh:
        json.dump(national, fh, ensure_ascii=False)
    print(f'   national-1375-1395.json: {len(national)} years')
except Exception as e:
    print('   national ERR', str(e)[:80])

# ════════════════════════════════════════════════════════════════
# ۴) GEO — بلوک‌های سرشماری به تفکیک استان
# ════════════════════════════════════════════════════════════════
print('4) geo ...')
os.makedirs(f'{OUT}/geo', exist_ok=True)
try:
    sheets = load(f'{ROOT}/0/GEO/2024/Tedad_Blocks_Ostan_Census95.xlsx')
    rows = clean_rows(list(sheets.values())[0])
    blocks = []
    for r in rows[2:]:
        if len(r) >= 4 and norm(r[2]):
            blocks.append({'code': norm(r[1]), 'province': norm(r[2]), 'blocks': to_num(r[3])})
    with open(f'{OUT}/geo/blocks-per-province.json', 'w', encoding='utf-8') as fh:
        json.dump(blocks, fh, ensure_ascii=False)
    print(f'   blocks-per-province.json: {len(blocks)} provinces')
except Exception as e:
    print('   blocks ERR', str(e)[:80])

# ════════════════════════════════════════════════════════════════
# ۵) STATISTICAL — شناسنامهٔ آمار رسمی + تقویم محصولات
# ════════════════════════════════════════════════════════════════
print('5) statistical ...')
os.makedirs(f'{OUT}/statistical', exist_ok=True)
amarrasmi = []
for f in sorted(glob.glob(f'{ROOT}/0/Home/amarrasmi/*.xlsx')):
    try:
        sheets = load(f)
        for rows in sheets.values():
            rows = clean_rows(rows)
            for r in rows[1:]:
                if not norm(r[1]) and not norm(r[0]):
                    continue
                if fa_digit(r[1]) in ('عنوان', 'عنوان شناسنامه', 'شاخص ملی') and fa_digit(r[2]) in ('دستگاه متولی', 'گروه/زیرگروه'):
                    continue
                amarrasmi.append({
                    'source': os.path.basename(f),
                    'row': norm(r[0]),
                    'title': norm(r[1]),
                    'group': norm(r[2]) if len(r) > 2 else '',
                    'owner': norm(r[3]) if len(r) > 3 else '',
                    'unit': norm(r[4]) if len(r) > 4 else '',
                    'geo_level': norm(r[5]) if len(r) > 5 else '',
                    'status': norm(r[6]) if len(r) > 6 else '',
                })
    except Exception as e:
        print('   amarrasmi ERR', os.path.basename(f), str(e)[:60])
with open(f'{OUT}/statistical/amarrasmi-registry.json', 'w', encoding='utf-8') as fh:
    json.dump(amarrasmi, fh, ensure_ascii=False)
print(f'   amarrasmi-registry.json: {len(amarrasmi)} records')

# تقویم محصولات آماری (transparency PRO_*)
calendar = []
for f in sorted(glob.glob(f'{ROOT}/0/transparency/PRO_*.xlsx')):
    try:
        sheets = load(f)
        for rows in sheets.values():
            rows = clean_rows(rows)
            for r in rows[1:]:
                if not norm(r[0]) or norm(r[0]).startswith('عنوان دفتر'):
                    continue
                calendar.append({
                    'office_file': os.path.basename(f),
                    'product': norm(r[0]),
                    'office': norm(r[1]) if len(r) > 1 else '',
                    'group': norm(r[2]) if len(r) > 2 else '',
                    'kind': norm(r[3]) if len(r) > 3 else '',
                    'start': norm(r[4]) if len(r) > 4 else '',
                    'end': norm(r[5]) if len(r) > 5 else '',
                })
    except Exception as e:
        print('   calendar ERR', os.path.basename(f), str(e)[:60])
with open(f'{OUT}/statistical/product-calendar.json', 'w', encoding='utf-8') as fh:
    json.dump(calendar, fh, ensure_ascii=False)
print(f'   product-calendar.json: {len(calendar)} products')

# ════════════════════════════════════════════════════════════════
# ۶) CLASSIFICATIONS — طبقه‌بندی‌های استاندارد
# ════════════════════════════════════════════════════════════════
print('6) classifications ...')
os.makedirs(f'{OUT}/classifications', exist_ok=True)
cls_files = glob.glob(f'{ROOT}/0/faradade/tabaghabandi/*.xlsx') + glob.glob(f'{ROOT}/0/Statistics/*/ISCO*.xlsx')
seen = set()
for f in cls_files:
    base = os.path.basename(f)
    if base in seen:
        continue
    seen.add(base)
    try:
        sheets = load(f)
        first = clean_rows(list(sheets.values())[0])
        # فقط سرستون‌ها و چند ردیف اول به‌عنوان نمونهٔ ساختار
        out = {'file': base, 'sheets': {}}
        for sname, rows in sheets.items():
            rows = clean_rows(rows)
            out['sheets'][sname] = rows[:12]
        out_path = f'{OUT}/classifications/{re.sub(r"[^A-Za-z0-9_.-]", "_", base).replace(".xlsx", "")}.json'
        with open(out_path, 'w', encoding='utf-8') as fh:
            json.dump(out, fh, ensure_ascii=False)
    except Exception as e:
        print('   cls ERR', base, str(e)[:60])
print(f'   classifications: {len(seen)} files')

# ════════════════════════════════════════════════════════════════
# ۷) AGRICULTURE — دام و طیور و محصولات کشاورزی
# ════════════════════════════════════════════════════════════════
print('7) agriculture ...')
os.makedirs(f'{OUT}/agriculture', exist_ok=True)
agri = []
for f in sorted(glob.glob(f'{ROOT}/2/Statistics/*livestock*.xlsx') + glob.glob(f'{ROOT}/2/Statistics/*Livestock*.xlsx') + glob.glob(f'{ROOT}/2/Statistics/gavdari*.xlsx')):
    try:
        sheets = load(f)
        for rows in list(sheets.values())[:3]:
            rows = clean_rows(rows)
            # نمونهٔ ساختار: فقط سرستون + ۳ ردیف
            agri.append({'file': os.path.basename(f), 'sample': rows[:4]})
    except Exception as e:
        print('   agri ERR', os.path.basename(f), str(e)[:60])
with open(f'{OUT}/agriculture/livestock-surveys.json', 'w', encoding='utf-8') as fh:
    json.dump(agri, fh, ensure_ascii=False)
print(f'   livestock-surveys.json: {len(agri)} surveys')

# ════════════════════════════════════════════════════════════════
# خلاصهٔ نهایی
# ════════════════════════════════════════════════════════════════
total = 0
print('\n=== FINAL ===')
for root, dirs, files in os.walk(OUT):
    for f in files:
        p = os.path.join(root, f)
        sz = os.path.getsize(p)
        total += sz
        print(f'   {os.path.relpath(p, OUT)}  {sz/1024:.0f} KB')
print(f'TOTAL: {total/1024/1024:.1f} MB in {OUT}')
