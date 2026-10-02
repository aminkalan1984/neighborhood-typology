# -*- coding: utf-8 -*-
"""Extracts each top-level function of a JS part into tmp_fn_<name>.js for node --check."""
import re
import subprocess
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'parts/ara_js_12_phase3.js'
src = open(path, encoding='utf-8').read()


def scan_spans(text):
    """Returns list of (name, start, end) for depth-1 function bodies."""
    spans = []
    i = 0
    n = len(text)
    depth = 0
    q = None
    last = '\n'
    cur_fn = None
    fstart = None
    while i < n:
        c = text[i]
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
            if depth == 1 and cur_fn is not None and fstart is None:
                fstart = i
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 1 and cur_fn is not None and fstart is not None:
                spans.append((cur_fn, fstart, i + 1))
                cur_fn = None
                fstart = None
        if not c.isspace():
            if depth == 1 and c == 'f' and text[i:i + 9] == 'function ' and cur_fn is None:
                m = re.match(r'function\s+([A-Za-z_$][\w$]*)', text[i:])
                if m:
                    cur_fn = m.group(1)
            last = c
        i += 1
    return spans


spans = scan_spans(src)
print('top-level functions found:', len(spans))
bad = []
for name, a, b in spans:
    body = src[a:b].strip()
    # find the header: look backwards for "function NAME("
    head_m = list(re.finditer(r'function\s+%s\s*\(' % re.escape(name), src[:a]))
    decl = (src[head_m[-1].start():a] if head_m else ('function %s(' % name)) + body
    fn_path = 'tmp_fn.js'
    open(fn_path, 'w', encoding='utf-8').write(decl)
    p = subprocess.run(['node', '--check', fn_path], capture_output=True, text=True)
    status = 'OK' if p.returncode == 0 else 'FAIL'
    print('  %-18s %s' % (name, status))
    if p.returncode != 0:
        bad.append(name)
        err = (p.stderr or '').strip().split('\n')
        print('      ' + ' | '.join(err[:3]))
print('BAD:', bad if bad else 'none')
