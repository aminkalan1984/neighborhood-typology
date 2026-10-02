# -*- coding: utf-8 -*-
"""
Helper to extract base CSS, fonts, SVG icons, and common logic from the reference file
"""
import re

with open(r'C:\Users\SAM\.cline\data\sessions\session_1790527111855_9kbhl\user-attachments\02588ad8-0c49-4688-a572-9c635f2a8c81-Freight_Forwarding_Motion_Graphic_Phase6_Visual_Themes_FA (1).html', 'r', encoding='utf-8') as f:
    text = f.read()

# Extract fonts from <style> or <head>
fonts_match = re.search(r'(@font-face\s*\{.*?\})', text, re.DOTALL)
if fonts_match:
    print("Found font-face length:", len(fonts_match.group(1)))
else:
    print("No font-face found in ref, checking Google Fonts or font-family...")
    fams = re.findall(r'font-family:[^;}]+', text)
    print("Sample font-families:", fams[:5])

# Extract CSS
style_match = re.search(r'<style>(.*?)</style>', text, re.DOTALL)
if style_match:
    css = style_match.group(1)
    with open('build_scripts/ref_style.css', 'w', encoding='utf-8') as f_out:
        f_out.write(css)
    print("Saved ref_style.css, length:", len(css))
