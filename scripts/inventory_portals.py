# -*- coding: utf-8 -*-
"""فهرست‌برداری هدفمند: فولدرهای کلیدی + فایل‌های حجیم. xls را فقط با xlrd (سریع‌تر) کاوش می‌کند
و برای xlsx فقط ورق اول. خروجی نمونهٔ نماینده برای تصمیم دسته‌بندی نهایی."""
import os, sys, json, glob

sys.stdout.reconfigure(encoding='utf-8')
ROOT = 'Portals'

KEY_DIRS = [
    '0/Statistics', '2/Statistics', '0/Files', '2/Files', '0/transparency',
    '0/Home', '0/GEO', '0/dataniruyekar', '0/faradade', '0/شاخص های توسعه',
    '0/calendar-file', '0/About', '0/documents',
]

def norm(v):
    return '' if v is None else str(v)[:26]

def probe(path):
    ext = path.rsplit('.', 1)[-1].lower()
    try:
        if ext == 'xls':
            import xlrd
            book = xlrd.open_workbook(path, on_demand=True)
            out = []
            for name in book.sheet_names()[:3]:
                sh = book.sheet_by_name(name)
                rows = [[norm(c) for c in sh.row_values(i)[:6]] for i in range(min(3, sh.nrows))]
                out.append({'name': name, 'dims': [sh.nrows, sh.ncols], 'rows': rows})
            return out
        elif ext == 'xlsx':
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            out = []
            for name in wb.sheetnames[:3]:
                ws = wb[name]
                rows = [[norm(c) for c in row[:6]] for i, row in enumerate(ws.iter_rows(values_only=True)) if i < 3]
                out.append({'name': name, 'rows': rows})
            wb.close()
            return out
    except Exception as e:
        return [{'err': str(e)[:80]}]
    return []

results = []
# نمونهٔ تصادفی تعیین‌شده از هر فولدر کلیدی
for d in KEY_DIRS:
    files = sorted(glob.glob(f'{ROOT}/{d}/**/*.xls*', recursive=True))
    # نمونه: ۲۵ فایل اول + ۱۰ فایل حجیم
    by_size = sorted(files, key=os.path.getsize, reverse=True)
    chosen = files[:25] + [f for f in by_size[:10] if f not in files[:25]]
    for f in chosen:
        rel = f.replace('\\', '/')
        info = probe(f)
        results.append({'path': rel, 'size': os.path.getsize(f), 'probe': info})
    print(f'{d}: {len(files)} files, probed {len(chosen)}')

with open('scripts/portals_sample_inventory.json', 'w', encoding='utf-8') as fh:
    json.dump(results, fh, ensure_ascii=False, indent=1)
print(f'DONE: {len(results)} probed')
