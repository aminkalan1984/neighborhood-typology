# -*- coding: utf-8 -*-
"""Reports lines whose single-quote or double-quote count is odd (string-escape suspects)."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'parts/ara_js_12_phase3.js'
for no, line in enumerate(open(path, encoding='utf-8'), 1):
    # strip escaped quotes and comments crudely
    clean = line.replace("\\'", '').replace('\\"', '')
    single = clean.count("'")
    double = clean.count('"')
    if single % 2 or double % 2:
        print('%4d  sq=%d dq=%d  %s' % (no, single, double, line.rstrip()[:110]))
