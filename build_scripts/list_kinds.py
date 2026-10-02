# -*- coding: utf-8 -*-
import re

raw = open('parts/ara_js_01_world.js', encoding='utf-8').read()
pairs = re.findall(r"id:'([a-z0-9_]+)'[^}]*?kind:'([a-z]+)'", raw)
print('node -> kind:')
for nid, k in pairs:
    print('  %-14s %s' % (nid, k))

kinds = {}
for _, k in pairs:
    kinds[k] = kinds.get(k, 0) + 1
print('\nkind counts:', kinds)

raw2 = open('parts/ara_js_02_edges.js', encoding='utf-8').read()
ek = re.findall(r"E\('([a-z0-9_]+)',\s*'([a-z]+)'", raw2)
print('\nedge -> kind:')
for eid, k in ek:
    print('  %-12s %s' % (eid, k))
ks = {}
for _, k in ek:
    ks[k] = ks.get(k, 0) + 1
print('\nedge kind counts:', ks)
