# -*- coding: utf-8 -*-
"""Structural brace checker for JS parts: strings, comments and regex-aware."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'parts/ara_js_11_phase2.js'
src = open(path, encoding='utf-8').read()

REGEX_PRECEDERS = set('(,=:[!&|?{};\n+-*%~^<>')
depth = 0
i = 0
n = len(src)
line = 1
stack = []
last_sig = ''  # last significant char (for regex heuristic)
report = []
while i < n:
    c = src[i]
    if c == '\n':
        line += 1
        last_sig = '\n'
        i += 1
        continue
    if c == '/' and i + 1 < n and src[i + 1] == '/':
        while i < n and src[i] != '\n':
            i += 1
        continue
    if c == '/' and i + 1 < n and src[i + 1] == '*':
        i += 2
        while i + 1 < n and not (src[i] == '*' and src[i + 1] == '/'):
            if src[i] == '\n':
                line += 1
            i += 1
        i += 2
        continue
    if c in ('"', "'", '`'):
        q = c
        i += 1
        while i < n:
            if src[i] == '\\':
                i += 2
                continue
            if src[i] == '\n':
                line += 1
                if q != '`':
                    break
            if src[i] == q:
                i += 1
                break
            i += 1
        last_sig = '"'
        continue
    if c == '/':
        if last_sig in REGEX_PRECEDERS or last_sig == '' or last_sig == '\n':
            # regex literal
            i += 1
            in_cls = False
            while i < n:
                if src[i] == '\\':
                    i += 2
                    continue
                if src[i] == '[':
                    in_cls = True
                elif src[i] == ']':
                    in_cls = False
                elif src[i] == '/' and not in_cls:
                    i += 1
                    break
                elif src[i] == '\n':
                    break
                i += 1
            last_sig = ')'
            continue
        last_sig = c
        i += 1
        continue
    if c == '{':
        depth += 1
        stack.append(line)
    elif c == '}':
        depth -= 1
        if stack:
            stack.pop()
        if depth < 0:
            report.append('EXTRA } at line %d' % line)
    if not c.isspace():
        last_sig = c
    i += 1

print('\n'.join(report) if report else 'no extra }')
print('FINAL DEPTH =', depth)
if depth > 0:
    print('UNCLOSED opens at lines:', stack)
