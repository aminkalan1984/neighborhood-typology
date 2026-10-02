# -*- coding: utf-8 -*-
"""Dumps tokenizer depth at every line end for a range."""
import sys

path = sys.argv[1]
lo = int(sys.argv[2])
hi = int(sys.argv[3])
raw = open(path, encoding='utf-8').read()
lines = raw.split('\n')
hi = min(hi, len(lines))


def scan(text):
    depth = 0
    q = None
    last = '\n'
    depths = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c == '\n':
            depths.append(depth)
            last = '\n'
            i += 1
            continue
        if q:
            if c == '\\':
                i += 2
                continue
            if c == q:
                q = None
            i += 1
            continue
        if c == '/' and i + 1 < n and text[i + 1] == '/':
            while i < n and text[i] != '\n':
                i += 1
            continue
        if c == '/' and i + 1 < n and text[i + 1] == '*':
            i += 2
            while i + 1 < n and not (text[i] == '*' and text[i + 1] == '/'):
                i += 1
            i += 2
            continue
        if c in '"\'`':
            q = c
            last = 's'
            i += 1
            continue
        if c == '/':
            if last in '(,=:[!&|?{};\n+-*%~^<>':
                i += 1
                cls = False
                while i < n:
                    if text[i] == '\\':
                        i += 2
                        continue
                    if text[i] == '[':
                        cls = True
                    elif text[i] == ']':
                        cls = False
                    elif text[i] == '/' and not cls:
                        i += 1
                        break
                    elif text[i] == '\n':
                        break
                    i += 1
                last = 'r'
                continue
            last = '/'
            i += 1
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        if not c.isspace():
            last = c
        i += 1
    return depths


depths = scan(raw + '\n')
for no in range(lo, hi + 1):
    print('%4d  d=%d  %s' % (no, depths[no - 1], lines[no - 1][:90]))

