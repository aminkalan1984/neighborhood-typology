# -*- coding: utf-8 -*-
"""Balance checker for braces, parens and brackets with positions."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'parts/ara_js_12_phase3.js'
src = open(path, encoding='utf-8').read()
PAIRS = {'{': '}', '(': ')', '[': ']'}
OPEN = set(PAIRS)
CLOSE = set(PAIRS.values())
MATCH = {v: k for k, v in PAIRS.items()}

stack = []
line = 1
i = 0
n = len(src)
q = None
last = '\n'
while i < n:
    c = src[i]
    if c == '\n':
        line += 1
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
                if src[i] == '\\':
                    i += 2
                    continue
                if src[i] == '[':
                    cls = True
                elif src[i] == ']':
                    cls = False
                elif src[i] == '/' and not cls:
                    i += 1
                    break
                elif src[i] == '\n':
                    break
                i += 1
            last = 'r'
            continue
        last = '/'
        i += 1
        continue
    if c in OPEN:
        stack.append((c, line))
    elif c in CLOSE:
        if stack and stack[-1][0] == MATCH[c]:
            stack.pop()
        else:
            print('MISMATCH: %s at line %d (stack top: %s)' % (c, line, stack[-1] if stack else None))
    if not c.isspace():
        last = c
    i += 1

print('FINAL STACK SIZE =', len(stack))
for c, ln in stack:
    print('  unclosed %s opened at line %d' % (c, ln))
