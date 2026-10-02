# -*- coding: utf-8 -*-
"""Validates that every getElementById target in the JS bundle exists in the body markup."""
import re
import sys

html = open('ara_dataflow_motion_graphic.html', encoding='utf-8').read()

body = html[html.find('<body>'):html.find('<script>')]
js = html[html.find('<script>') + len('<script>'):html.rfind('</script>')]

body_ids = set(re.findall(r"""id=["']([^"']+)["']""", body))

targets = set()
for m in re.finditer(r"""getElementById\(\s*(['"])(.+?)\1\s*\)""", js):
    targets.add(m.group(2))

print('body ids found:', len(body_ids))
print('getElementById targets found:', len(targets))

missing = sorted(t for t in targets if t not in body_ids)
if missing:
    print('MISSING DOM IDS (%d):' % len(missing))
    for m in missing:
        print('  -', m)
    sys.exit(1)
print('OK: every getElementById target exists in markup')

for cls in ['p1Panel', 'p1Tool', 'p1Close', 'p1Tab', 'p2NavBtn', 'p3NavBtn', 'p4NavBtn', 'vtMode']:
    n = len(re.findall(r"""class=["'][^"']*\b""" + cls + r"""\b""", body))
    print('  .%s: %d in markup' % (cls, n))
