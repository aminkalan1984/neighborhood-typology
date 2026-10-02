# -*- coding: utf-8 -*-
import re, json

txt = open('server/sources/manifests.ts', encoding='utf-8').read()
# Extract ids and titles and transports
blocks = re.findall(r"\{\s*\n\s*id:\s*'([^']+)',\s*\n\s*title:\s*'([^']+)',\s*\n\s*registryId:\s*'([^']+)',\s*\n\s*transport:\s*'([^']+)'", txt)
print(f"Total manifests: {len(blocks)}")
for i, (id_, title, reg, transport) in enumerate(blocks):
    print(f"{i+1:02d}. {id_} | {title} | registry={reg} | transport={transport}")
