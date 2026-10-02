# -*- coding: utf-8 -*-
import sys
import os

html = open('ara_dataflow_motion_graphic.html', encoding='utf-8').read()
s = html.find('<script>') + len('<script>')
e = html.rfind('</script>')
js = html[s:e]

with open('debug_bundle.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Saved debug_bundle.js, length:", len(js))
