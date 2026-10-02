# -*- coding: utf-8 -*-
"""Balance checker over first FRACTION of file."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'parts/ara_js_12_phase3.js'
FRAC = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
raw = open(path, encoding='utf-8').read()
LINES = raw.split('\n')
src = raw[:int(len(raw) * FRAC)]

depth2 = 0
holds = []
ln2 = 1
q2 = None
last2 = '\n'
i2 = 0

while i2 < len(src):
    c2 = src[i2]
    if c2 == '\n':
        ln2 += 1
        last2 = '\n'
        i2 += 1
        continue
    if q2:
        if c2 == '\\':
            i2 += 2
            continue
        if c2 == q2:
            q2 = None
        i2 += 1
        continue
    if c2 == '/' and i2 + 1 < len(src) and src[i2 + 1] == '/':
        while i2 < len(src) and src[i2] != '\n':
            i2 += 1
        continue
    if c2 == '/' and i2 + 1 < len(src) and src[i2 + 1] == '*':
        i2 += 2
        while i2 + 1 < len(src) and not (src[i2] == '*' and src[i2 + 1] == '/'):
            if src[i2] == '\n':
                ln2 += 1
            i2 += 1
        i2 += 2
        continue
    if c2 in '"\'`':
        q2 = c2
        last2 = 's'
        i2 += 1
        continue
    if c2 == '/':
        if last2 in '(,=:[!&|?{};\n+-*%~^<>':
            i2 += 1
            cls2 = False
            while i2 < len(src):
                if src[i2] == '\\':
                    i2 += 2
                    continue
                if src[i2] == '[':
                    cls2 = True
                elif src[i2] == ']':
                    cls2 = False
                elif src[i2] == '/' and not cls2:
                    i2 += 1
                    break
                elif src[i2] == '\n':
                    break
                i2 += 1
            last2 = 'r'
            continue
        last2 = '/'
        i2 += 1
        continue
    if c2 == '{':
        depth2 += 1
        holds.append((ln2, LINES[ln2 - 1][:80]))
    elif c2 == '}':
        depth2 -= 1
        if holds:
            holds.pop()
    if not c2.isspace():
        last2 = c2
    i2 += 1

print('frac %.2f -> line ~%d -> depth %d (q=%s, last=%r)' % (FRAC, ln2, depth2, q2, last2))
for ln0, txt in holds[-4:]:
    print('  open line %-4d %s' % (ln0, txt))
