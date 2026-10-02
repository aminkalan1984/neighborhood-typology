# -*- coding: utf-8 -*-
import json

with open('kernel/registries/sources_23.json', 'r', encoding='utf-8') as f:
    d23 = json.load(f)

print('=== 23 DATA SOURCES ===')
for idx, r in enumerate(d23['records']):
    print(f"{idx+1:02d}. id={r.get('شناسه داخلی')} | name={r.get('منبع')} | org={r.get('تولیدکننده')} | scale={r.get('مقیاس استفاده')}")
