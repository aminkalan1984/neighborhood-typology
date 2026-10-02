# -*- coding: utf-8 -*-
"""Bisects a JS part to find where node's brace depth diverges from the tokenizer."""
import os
import re
import subprocess
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'parts/ara_js_12_phase3.js'
lines = open(path, encoding='utf-8').read().split('\n')


def tok_depth(text):
    """Same heuristic as node_depth.cjs: brace depth ignoring strings/comments/regex."""
    d = 0
    i = 0
    n = len(text)
    q = None
    last = '\n'
    while i < n:
        c = text[i]
        if c == '\n':
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
                if text[i] == '\n':
                    last = '\n'
                i += 1
            i += 2
            continue
        if c in '"\'`':
            q = c
            i += 1
            last = 's'
            continue
        if c == '/':
            if last in '' or last in '\n(,=:[!&|?{};\n+-*%~^<>':
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
            d += 1
        elif c == '}':
            d -= 1
        if not c.isspace():
            last = c
        i += 1
    return d


def node_depth(prefix):
    """Asks node how many } are needed to close the prefix."""
    for k in range(1, 24):
        cand = prefix + '\n' + '}' * k + '\n'
        open('tmp_bisect.js', 'w', encoding='utf-8').write(cand)
        p = subprocess.run(['node', '--check', 'tmp_bisect.js'],
                           capture_output=True, text=True, encoding='utf-8')
        if p.returncode == 0:
            return k
        if 'Unexpected end of input' not in (p.stderr or ''):
            return None  # some other error; not a depth question
    return None


prev_ok = 0
step = 25
while prev_ok < len(lines):
    n = min(prev_ok + step, len(lines))
    prefix = '\n'.join(lines[:n])
    nd = node_depth(prefix)
    td = tok_depth(prefix)
    print('line %-4d node_depth=%s tok_depth=%d %s' %
          (n, nd, td, '<<< DIVERGE' if nd is not None and nd != td else ''))
    if nd is None:
        step = max(1, step // 2)
        continue
    if nd == td:
        prev_ok = n
    else:
        step = max(1, step // 2)
    if step <= 1 and prev_ok < len(lines):
        # found the exact boundary
        print('DIVERGENCE near line', prev_ok + 1)
        print('  %s' % lines[prev_ok])
        break
os.path.exists('tmp_bisect.js') and os.remove('tmp_bisect.js')
