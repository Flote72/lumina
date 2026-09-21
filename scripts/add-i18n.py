#!/usr/bin/env python3
"""Append translation keys to src/i18n/{ko,en}.ts from a pipe-separated file: key|ko|en (one per line)."""
import sys

src = sys.argv[1]
root = 'src/i18n/'
rows = [l.rstrip('\n').split('|') for l in open(src, encoding='utf-8') if l.strip() and not l.startswith('#')]


def esc(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")


for fn, idx in (('ko.ts', 1), ('en.ts', 2)):
    s = open(root + fn, encoding='utf-8').read()
    have = set()
    add = ''
    for r in rows:
        assert len(r) == 3, r
        if f"'{r[0]}'" in s:
            continue
        add += f"  '{r[0]}': '{esc(r[idx])}',\n"
    i = s.rindex('\n}')
    s = s[:i + 1] + add + s[i + 1:]
    open(root + fn, 'w', encoding='utf-8').write(s)
print('added', len(rows))
