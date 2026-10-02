# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, 'build_scripts')
import scenes_data

print(f"Total scenes: {len(scenes_data.SCENES)}")
for i, s in enumerate(scenes_data.SCENES):
    print(f"{i+1:02d}. [{s['ch']}] {s['ti']} ({s['d']}s) [hot={len(s['hot'])}]")
