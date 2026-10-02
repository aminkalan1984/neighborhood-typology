# -*- coding: utf-8 -*-
"""
Assembles the Ara platform motion-graphic into one self-contained HTML file.

Sources:
  build_scripts/ref_style.css   -> base presentation CSS (shared visual language)
  parts/ara_style_add.css       -> Ara-specific CSS additions
  parts/ara_body.html           -> HUD / panels markup
  parts/ara_js_*.js             -> engine sections (in numeric order)
Output:
  ara_dataflow_motion_graphic.html
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = os.path.join(ROOT, 'parts')
OUT = os.path.join(ROOT, 'ara_dataflow_motion_graphic.html')


def read(path):
    with open(path, 'r', encoding='utf-8') as fh:
        return fh.read()


def main():
    base_css = read(os.path.join(ROOT, 'build_scripts', 'ref_style.css'))
    add_css = read(os.path.join(PARTS, 'ara_style_add.css'))
    body = read(os.path.join(PARTS, 'ara_body.html'))

    js_files = sorted(
        f for f in os.listdir(PARTS)
        if re.match(r'^ara_js_\d+_.*\.js$', f)
    )
    if not js_files:
        sys.exit('no js parts found')

    js_parts = []
    for name in js_files:
        js_parts.append('/* ==== %s ==== */\n%s' % (name, read(os.path.join(PARTS, name))))
    js = '\n\n'.join(js_parts)

    html = TEMPLATE.format(css=base_css + '\n\n' + add_css, body=body, js=js)
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('wrote %s (%.1f KB) from %d js parts' % (OUT, len(html) / 1024.0, len(js_files)))


TEMPLATE = '''<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>سامانه آرا — موشن‌گرافیک جریان داده، منابع داده و فرایندهای داخلی پلتفرم</title>
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{js}
</script>
</body>
</html>
'''

if __name__ == '__main__':
    main()
