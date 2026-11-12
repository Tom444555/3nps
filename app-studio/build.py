#!/usr/bin/env python3
"""Baut Loopsmiths Studio (app/www/studio/index.html) aus den Einzelteilen. Teilt EQ, Mastering-DSP und Song-Bausteine mit dem Looper."""
import os, re, json

S = os.path.dirname(os.path.abspath(__file__)) + '/'
A = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/app/'
OUT = A + 'www/studio/'
SVER = 's3'
LVER = re.search(r'3nps · (v\d+)', open(A + 'head_app.html', encoding='utf8').read()).group(1)   # v145: Looper-Version im Namen wie im Looper
rd = lambda p: open(p, encoding='utf8').read()

# EQ-Aussehen wie im Looper: alle Regeln, deren Auswahl mit .eq beginnt (mehrzeilige Regeln vollständig)
css, take, depth = [], False, 0
for ln in rd(A + 'looper.css').split('\n'):
    s = ln.strip()
    if depth == 0: take = s.startswith('.eq')
    if take: css.append(ln)
    depth += ln.count('{') - ln.count('}')
# v144: looper.css nutzt Schrift-/Radius-Stufen als Variablen – die Stufen aus design.css mitnehmen
root_vars = re.search(r':root \{[^}]*--fs-xs[^}]*\}', rd(A + 'design.css')).group(0)
eqcss = root_vars + '\n' + '\n'.join(css) + '\n.toggle-btn{appearance:none;padding:5px 10px;border-radius:7px;background:var(--surf2);border:1px solid var(--line);font-size:12px;color:var(--ink)}.toggle-btn.active{border-color:var(--acc);color:var(--acc)}\n'

# v122: Amp-Kette des Loopers (v117) unverändert übernehmen – derselbe Code, aus looper.js herausgeschnitten
lp = rd(A + 'looper.js')
def cut(a, b, src=lp):
    i = src.index(a); j = src.index(b, i); return src[i:j]
amp_types = cut('  const AMP_TYPES = {', '  const AMP_DEF =')
amp_fns = cut('  function ampCurve(type) {', '  function ampApply() {')
gate = cut('class Gate extends AudioWorkletProcessor', "registerProcessor('ampgate',Gate);") + "registerProcessor('ampgate',Gate);"
assert 'ampChain' in amp_fns and 'ampParams' in amp_fns and 'AMP_PRESETS' in amp_types
ampdsp = ('// v122: aus app/looper.js (v117) übernommen – Gate, Drive 4x, Klang, Box, Pegel\nconst AmpDSP = (() => {\n  const amp = { curves: {} };\n' + amp_types + amp_fns +
          '  return { AMP_TYPES, AMP_PRESETS, ampCurve, ampParams, ampChain, GATE: ' + json.dumps('\n' + gate + '\n') + ' };\n})();\nwindow.AmpDSP = AmpDSP;')
# v122: Quelltexte für Analyse-Worker (Tonhöhe YIN, FFT, Akkorderkennung des Loopers) – nur als Text, laufen im Worker
spt = rd(os.path.dirname(A.rstrip('/')) + '/script.part'); i = spt.index('function fft(signal) {'); j = spt.index('\n}\n', i) + 3
srcs = 'window.__SRC = ' + json.dumps({'pitch': rd(A + 'pitch.js'), 'fft': spt[i:j], 'chords': rd(A + 'chords.js')}, ensure_ascii=False).replace('</', '<\\/') + ';'
parts = ['window.__tr = null;'] + [rd(A + f) for f in ['eq.js', 'master-dsp.js', 'lied-core.js', 'lied-text.js', 'lied-export.js', 'sep.js']] + [ampdsp, srcs]
for f in ['sdb.js', 'engine.js', 'project.js', 'sched.js', 'imp.js', 'rec.js', 'inst.js', 'drum.js', 'ui-arr.js', 'ui-roll.js', 'ui-mix.js', 'ui-brw.js', 'export.js', 'ins.js', 'ana.js', 'pkg.js', 'ui-main.js']:
    if os.path.exists(S + f): parts.append(rd(S + f))
parts.append(rd(S + 'mst.js'))
parts.append(rd(A + 'master.js'))   # v112: Mastering-Reiter aus dem Looper (gleicher Code, Quellen aus dem Projekt)
mh = rd(A + 'master.html').replace('<section class="panel" id="panel-master" role="tabpanel" aria-labelledby="tab-master" hidden>', '<div id="panel-master">').replace('</section>', '</div>')
mh = re.sub(r'<select id="msSrc"[^>]*>.*?</select>', '<select id="msSrc" aria-label="Quelle"><option value="mix">Projekt-Mix (ganzes Projekt)</option><option value="cycle">Projekt-Mix (nur Cycle-Bereich)</option><option value="file">Datei laden …</option></select>', mh, flags=re.S)
html = rd(S + 'studio.html').replace('EQCSS', eqcss).replace('MASTERCSS', rd(A + 'master.css')).replace('MASTERHTML', mh).replace('SVER', SVER).replace('LVER', LVER)
html = html.replace('SCRIPTS', '<script>\n' + '\n</script>\n<script>\n'.join(parts) + '\n</script>')
os.makedirs(OUT, exist_ok=True)
open(OUT + 'index.html', 'w', encoding='utf8').write(html)
man = {"id": "./", "name": "Loopsmiths Studio", "short_name": "Studio", "description": "Tonstudio für Ideen aus dem Looper: Spuren, Mischpult, Export.", "lang": "de",
       "start_url": "./", "scope": "./", "display": "standalone", "orientation": "landscape", "background_color": "#141416", "theme_color": "#141416",
       "icons": [{"src": "../icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "../icon-512.png", "sizes": "512x512", "type": "image/png"}]}
open(OUT + 'manifest.webmanifest', 'w', encoding='utf8').write(json.dumps(man, ensure_ascii=False, indent=2))
print('Studio:', OUT + 'index.html', round(len(html.encode()) / 1024), 'KB')
