# -*- coding: utf-8 -*-
"""Checks selectors by name (ID or class) in the built CSS."""
css = open('build_scripts/ref_style.css', encoding='utf-8').read() + \
      open('parts/ara_style_add.css', encoding='utf-8').read()

names = ['p1Transition', 'p1TermTip', 'p1NarrRibbon', 'p4Head', 'p4Top', 'p1ModePill',
         'openLay', 'endLay', 'live', 'p1Live', 'p4Announce', 'p1MiniDot', 'p1Chapter']
for n in names:
    cls = '.' + n
    idf = '#' + n
    print('%-16s class=%-5s id=%s' % (n, 'Y' if cls in css else '-', 'Y' if idf in css else '-'))

