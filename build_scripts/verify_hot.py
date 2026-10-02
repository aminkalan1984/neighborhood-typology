# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, 'build_scripts')
import re

nodes_raw = open('parts/ara_js_01_world.js', encoding='utf-8').read()
node_ids = set(re.findall(r"id:\s*'([^']+)'", nodes_raw))

edges_raw = open('parts/ara_js_02_edges.js', encoding='utf-8').read()
edge_ids = set(re.findall(r"E\(\s*'([^']+)'", edges_raw))

all_known = node_ids | edge_ids
print(f"Known nodes: {len(node_ids)}, edges: {len(edge_ids)}, total: {len(all_known)}")

import scenes_data
missing = set()
for i, s in enumerate(scenes_data.SCENES):
    for h in s['hot']:
        if h not in all_known:
            missing.add(h)

if missing:
    print(f"WARNING: Missing hot targets in scenes: {missing}")
else:
    print("SUCCESS: All scene hot targets exist in nodes or edges!")
