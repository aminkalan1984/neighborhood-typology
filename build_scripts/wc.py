# -*- coding: utf-8 -*-
"""Prints line counts for all engine parts (used while authoring them)."""
import os

d = 'parts'
for f in sorted(os.listdir(d)):
    p = os.path.join(d, f)
    if os.path.isfile(p):
        n = sum(1 for _ in open(p, encoding='utf-8'))
        print('%-26s %5d lines  %7d bytes' % (f, n, os.path.getsize(p)))
