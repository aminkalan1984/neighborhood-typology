# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, 'build_scripts')
import scenes_data

s = scenes_data.SCENES[0]
print('scene keys:', sorted(s.keys()))
print()
for k in sorted(s.keys()):
    print('%s: %r' % (k, s[k] if k != 'hot' else s[k][:6]))
print()
print('CH_DEFAULTS keys:', list(scenes_data.CH_DEFAULTS.keys()))
print('CH_DEFAULTS sample:', scenes_data.CH_DEFAULTS['بنیان'])
print()
has_mov = [i + 1 for i, x in enumerate(scenes_data.SCENES) if x.get('mov')]
print('scenes with mov:', has_mov[:20], '...' if len(has_mov) > 20 else '')
print('scenes with fin:', [i + 1 for i, x in enumerate(scenes_data.SCENES) if x.get('fin')])
print('scenes with risk:', [i + 1 for i, x in enumerate(scenes_data.SCENES) if x.get('risk')])
print()
print('FLOW_IDS:', scenes_data.FLOW_IDS)
print()
print('CHAPTERS:')
for k, v in scenes_data.CHAPTERS.items():
    print('  %s -> %s' % (k, v))
