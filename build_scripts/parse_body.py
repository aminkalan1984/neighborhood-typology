# -*- coding: utf-8 -*-
import re

with open('build_scripts/ref_body.html', 'r', encoding='utf-8') as f:
    text = f.read()

elements = re.findall(r'<([a-zA-Z0-9]+)\s+[^>]*id=["\']([^"\']+)["\']', text)
print(f'Total elements with id: {len(elements)}')
for tag, id_ in elements:
    print(f'<{tag} id="{id_}">')
