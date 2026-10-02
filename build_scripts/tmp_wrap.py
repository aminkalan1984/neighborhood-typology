# -*- coding: utf-8 -*-
"""Strips the trailing })(); and appends } so node --check reports inner errors."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'parts/ara_js_12_phase3.js'
src = open(path, encoding='utf-8').read()
i = src.rstrip().rfind('})();')
open('tmp_check.js', 'w', encoding='utf-8').write(src[:i] + '}\n')
print('wrote tmp_check.js from', path)
