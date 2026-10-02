# -*- coding: utf-8 -*-
import re, sys

path = sys.argv[1]
txt = open(path, encoding='utf-8').read()
ids = re.findall(r"\{id:'([a-z0-9_]+)'", txt)
print('count:', len(ids))
print(ids)
