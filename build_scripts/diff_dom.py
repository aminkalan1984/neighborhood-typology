# -*- coding: utf-8 -*-
"""Reports which DOM ids the reference JS touches, and whether ara_body.html has them."""
import re

body = open('parts/ara_body.html', encoding='utf-8').read()
ref = open('build_scripts/ref_js.js', encoding='utf-8').read()

body_ids = set(re.findall(r"""id=["']([^"']+)["']""", body))
ref_ids = set()
for m in re.finditer(r"""getElementById\(\s*(['"])(.+?)\1\s*\)""", ref):
    ref_ids.add(m.group(2))

missing = sorted(ref_ids - body_ids)
print('ref DOM ids:', len(ref_ids))
print('ara body ids:', len(body_ids))
print('MISSING in ara body (%d):' % len(missing))
for m in missing:
    print('  -', m)

print()
print('EXTRA in ara body (not used by ref):')
for m in sorted(body_ids - ref_ids):
    print('  +', m)
