#!/usr/bin/env python3
"""Baut Loopsmiths Studio (app/www/studio/index.html) aus den Einzelteilen. Teilt EQ, Mastering-DSP und Song-Bausteine mit dem Looper."""
import os, re, json

S = os.path.dirname(os.path.abspath(__file__)) + '/'
A = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/app/'
OUT = A + 'www/studio/'
SVER = 's1'
rd = lambda p: open(p, encoding='utf8').read()

# EQ-Aussehen wie im Looper: alle Regeln, deren Auswahl mit .eq beginnt (mehrzeilige Regeln vollständig)
css, take, depth = [], False, 0
for ln in rd(A + 'looper.css').split('\n'):
    s = ln.strip()
    if depth == 0: take = s.startswith('.eq')
    if take: css.append(ln)
    depth += ln.count('{') - ln.count('}')
eqcss = '\n'.join(css) + '\n.toggle-btn{appearance:none;padding:5px 10px;border-radius:7px;background:var(--surf2);border:1px solid var(--line);font-size:12px;color:var(--ink)}.toggle-btn.active{border-color:var(--acc);color:var(--acc)}\n'

parts = ['window.__tr = null;'] + [rd(A + f) for f in ['eq.js', 'master-dsp.js', 'lied-core.js', 'lied-text.js', 'lied-export.js']]
for f in ['sdb.js', 'engine.js', 'project.js', 'sched.js', 'imp.js', 'rec.js', 'inst.js', 'drum.js', 'ui-arr.js', 'ui-roll.js', 'ui-mix.js', 'ui-brw.js', 'export.js', 'ui-main.js']:
    if os.path.exists(S + f): parts.append(rd(S + f))
html = rd(S + 'studio.html').replace('EQCSS', eqcss).replace('SVER', SVER)
html = html.replace('SCRIPTS', '<script>\n' + '\n</script>\n<script>\n'.join(parts) + '\n</script>')
os.makedirs(OUT, exist_ok=True)
open(OUT + 'index.html', 'w', encoding='utf8').write(html)
man = {"id": "./", "name": "Loopsmiths Studio", "short_name": "Studio", "description": "Tonstudio für Ideen aus dem Looper: Spuren, Mischpult, Export.", "lang": "de",
       "start_url": "./", "scope": "./", "display": "standalone", "orientation": "landscape", "background_color": "#141416", "theme_color": "#141416",
       "icons": [{"src": "../icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "../icon-512.png", "sizes": "512x512", "type": "image/png"}]}
open(OUT + 'manifest.webmanifest', 'w', encoding='utf8').write(json.dumps(man, ensure_ascii=False, indent=2))
print('Studio:', OUT + 'index.html', round(len(html.encode()) / 1024), 'KB')
