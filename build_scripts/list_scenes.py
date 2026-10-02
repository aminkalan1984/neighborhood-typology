# -*- coding: utf-8 -*-
"""
Inspect the 75 scenes in the reference file
"""
import re

with open(r'C:\Users\SAM\.cline\data\sessions\session_1790527111855_9kbhl\user-attachments\02588ad8-0c49-4688-a572-9c635f2a8c81-Freight_Forwarding_Motion_Graphic_Phase6_Visual_Themes_FA (1).html', 'r', encoding='utf-8') as f:
    text = f.read()

sc_pos = text.find('var SCENES=[')
sc_end = text.find('];\nvar SCENE_METRICS', sc_pos)
scenes_code = text[sc_pos+12:sc_end]

# Find matches of ti: and sb:
pattern = re.compile(r"ti:\s*'([^']+)'\s*,\s*sb:\s*'([^']+)'")
matches = pattern.findall(scenes_code)
print(f'Total matches: {len(matches)}')
for i, (ti, sb) in enumerate(matches):
    print(f'{i+1:02d}: {ti}  -->  {sb}')
