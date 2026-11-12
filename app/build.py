#!/usr/bin/env python3
"""Baut die iPad-App (www/index.html) und die Claude-Vorschau (../preview.html) aus den Einzelteilen."""
import json, glob, re, os

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
A = D + 'app/'
rd = lambda p: open(p, encoding='utf8').read()

head = rd(A + 'head_app.html')
script = rd(D + 'script.part')
tabs = rd(D + 'tabs.js')
storage = rd(A + 'storage.js')
looper = rd(A + 'looper.js')
lhtml = rd(A + 'looper.html')
lcss = rd(A + 'looper.css') + rd(A + 'circle.css') + rd(A + 'solo.css') + rd(A + 'caged.css') + rd(A + 'jam.css') + rd(A + 'uebung.css') + rd(A + 'passt.css') + rd(A + 'lied.css') + rd(A + 'sing.css') + rd(A + 'singen.css') + rd(A + 'master.css') + rd(A + 'hilfe.css') + rd(A + 'powerchords.css') + rd(A + 'lernen.css')
# Früher wurde das persönliche Übungslog beim ersten Start eingespielt. Für die öffentliche App bleibt es leer.
seeds = []

# --- Script: Speicherung aufs Gerät, Audio-Latenz, Drum-Bus ---
a = script.index('async function saveSession'); b = script.index('function computeStats')
c = script.index('async function initDb'); e = script.index('/* ---------- Eigene Musik')
script = script[:a] + script[b:c] + storage + '\n' + script[e:]
script = script.replace("let dbApi = null;", "let dbApi = null;\nconst SEED_SESSIONS = " + json.dumps(seeds, ensure_ascii=False) + ";", 1)
script = script.replace("{ sampleRate: 48000, latencyHint: 'playback' }", "{ latencyHint: 'interactive' }")
for fn in ['playKick(t)', 'playSnare(t)', 'playHihat(t, accent)']:
    i = script.index('function ' + fn + ' {'); j = script.index('\nfunction ', i + 10)
    body = script[i:j].replace('function ' + fn, 'function ' + fn.replace(')', ', bus)'), 1)
    body = body.replace('{\n', '{\n  bus = bus || grooveNodes;\n', 1)
    body = body.replace('grooveNodes.dryGain', 'bus.dryGain').replace('grooveNodes.reverbSend', 'bus.reverbSend')
    script = script[:i] + body + script[j:]
assert script.count('bus = bus || grooveNodes') == 3

# --- v7: Stabilität, Song-Player, Analyse ---
import base64
analysis = rd(A + 'beat.js') + '\n' + rd(A + 'chords.js') + '\n' + rd(A + 'analysis.js') + '\n' + rd(A + 'bass.js')
song = rd(A + 'song.js')
i = script.index('function formatTime(s) {')
script = script[:i] + analysis + '\n' + script[i:]
a1 = script.index("const fileInput = document.getElementById('audioFile');")
b1 = script.index("document.getElementById('playBtn').addEventListener('click'")
script = script[:a1] + song + script[b1:]
# Sättigungsstufe (WaveShaper mit 4-fach Oversampling) aus der Hauptkette nehmen: spart viel Rechenzeit
old = "  input.connect(airShelf);\n  airShelf.connect(saturator);\n  saturator.connect(limiter);"
assert old in script
script = script.replace(old, "  input.connect(airShelf);\n  airShelf.connect(limiter);")
script = script.replace("{ latencyHint: 'interactive' }", "{ latencyHint: window.__audioHint = (function () { try { return /^(lite|stable)$/.test(localStorage.getItem('3nps-perf')) || /^(old|min)$/.test(localStorage.getItem('3nps-device')) ? 'playback' : 'balanced'; } catch (e) { return 'balanced'; } })() }")
assert "'playback' : 'balanced'" in script and '3nps-device' in script
old_k = "function keyMidiNotes() {\n  const rootIdx = NOTES.indexOf(rootSel.value);\n  const intervals = MODES[modeSel.value];"
assert old_k in script
script = script.replace(old_k, "function keyMidiNotes() {\n  const ov = window.droneKeyOverride || null;\n  const rootIdx = NOTES.indexOf(ov && ov.root ? ov.root : rootSel.value);\n  const intervals = MODES[ov && ov.mode ? ov.mode : modeSel.value];")
# Drone-Statuszeile soll die Spur-Tonart zeigen, wenn sie abweicht
script = script.replace("'An — ' + rootSel.value + ' ' + modeSel.value", "'An — ' + droneKeyText()")
script = script.replace("function keyMidiNotes() {", "function droneKeyText() {\n  const ov = window.droneKeyOverride || null;\n  return (ov && ov.root ? ov.root : rootSel.value) + ' ' + (ov && ov.mode ? ov.mode : modeSel.value);\n}\nfunction keyMidiNotes() {", 1)
old_ds = "    stopDrone();\n    setTimeout(startDrone, 950);"
assert old_ds in script
script = script.replace(old_ds, "    stopDrone();\n    clearTimeout(window.__droneRestart);\n    window.__droneRestart = setTimeout(() => { if (!droneOn) startDrone(); }, 950);")
script = script.replace("function startDrone() {\n", "function startDrone() {\n  if (droneOn && droneNodes) return;\n", 1)
script = script.replace("parseInt(document.getElementById('bpm').value)", "parseFloat(document.getElementById('bpm').value)")
old = "document.getElementById('bpm').addEventListener('input', (e) => {\n  document.getElementById('bpmVal').textContent = e.target.value;"
assert old in script
script = script.replace(old, "document.getElementById('bpm').addEventListener('input', (e) => {\n  if (e.isTrusted) e.target.value = Math.round(parseFloat(e.target.value));\n  document.getElementById('bpmVal').textContent = String(Math.round(parseFloat(e.target.value) * 10) / 10).replace('.', ',');")
rust = base64.b64encode(open(A + 'tex/rust.jpg', 'rb').read()).decode()
metal = rd(A + 'metal.css')
import shutil; shutil.copy(A + 'tex/bg-metal.jpg', A + 'www/bg-metal.jpg')
shutil.copy(A + 'tex/panel.jpg', A + 'www/panel.jpg')
for _f in ['panel-dark.jpg', 'runes.png', 'emblem.png', 'corner-tl.png', 'corner-tr.png', 'corner-bl.png', 'corner-br.png',
           'bg-iron.jpg', 'panel-iron.jpg', 'stud-iron.png', 'studs-iron.png', 'emblem-iron.png',
           'tolex.jpg', 'alu.jpg', 'alu-dark.jpg', 'grille.jpg', 'screw.png', 'jewel.png',
           'bg-ice.jpg', 'panel-ice.jpg', 'icicles.png', 'rivet-ice.png', 'emblem-ice.png']: shutil.copy(A + 'tex/' + _f, A + 'www/' + _f)
themecss = rd(A + 'theme-metal.css') + rd(A + 'theme-amp.css') + rd(A + 'theme-ice.css') + rd(A + 'theme-clean.css') + rd(A + 'theme-matrix.css') + rd(A + 'theme-dj.css') + rd(A + 'theme-light.css') + rd(A + 'theme-precise-dark.css') + rd(A + 'theme-ios.css')
appcfg = rd(A + 'appcfg.js') + '\n' + rd(A + 'perf.js') + '\n' + rd(A + 'geraet.js') + '\n' + rd(A + 'lieder.js') + '\n' + rd(A + 'sep.js')
# v145: Schriften als eigene Dateien (fonts/*.woff) statt Base64 im Kopf – der Browser lädt eine Schrift erst, wenn eine Optik sie braucht.
# Die gewählte Optik lädt ihre Schriften per <link rel=preload> (EARLY) gleich mit, font-display:block → nie eine falsche Schrift.
# sw.js legt alle sechs (zus. ≈ 260 KB) im App-Speicher ab, damit der Optik-Wechsel auch offline geht.
os.makedirs(A + 'www/fonts', exist_ok=True)
FONT_FILES = {'Uncial Antiqua': 'uncial.woff', 'Metal Mania': 'metalmania.woff', 'Black Ops One': 'blackopsone.woff',
              'Russo One': 'russoone.woff', 'Michroma': 'michroma.woff', 'Cinzel': 'cinzel700.woff'}
for _fn in FONT_FILES.values(): shutil.copy(A + 'fonts/' + _fn, A + 'www/fonts/' + _fn)
def _ff(fam, fn, w='400', pre=''):
    return "@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:block;src:url(%sfonts/%s) format('woff')}" % (fam, w, pre, fn)
def fonts_css(pre=''):
    return '<style>' + ''.join([_ff('Uncial Antiqua', 'uncial.woff', pre=pre), _ff('Metal Mania', 'metalmania.woff', pre=pre), _ff('Black Ops One', 'blackopsone.woff', pre=pre),
                                _ff('Russo One', 'russoone.woff', pre=pre), _ff('Michroma', 'michroma.woff', pre=pre), _ff('Cinzel', 'cinzel700.woff', '600 700', pre=pre)]) + '</style>'
FONTS = fonts_css()
def _ffb(fam, fn, w='400'):
    b = base64.b64encode(open(A + 'fonts/' + fn, 'rb').read()).decode()
    return "@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff;base64,%s) format('woff')}" % (fam, w, b)
# Vorschau für Claude bleibt eine einzige Datei: Schriften dort weiter eingebettet
FONTS_PV = '<style>' + ''.join([_ffb(k, v, '600 700' if k == 'Cinzel' else '400') for k, v in FONT_FILES.items()]) + '</style>'
# Schriften je Optik (gemessen: alle Reiter besucht) – nordic = Grundoptik (metal.css)
THEME_FONTS = {'nordic': ['uncial.woff'], 'metal': ['metalmania.woff', 'blackopsone.woff'], 'amp': ['russoone.woff', 'michroma.woff'], 'ice': ['cinzel700.woff']}
# Hintergrundbilder je Optik aus den CSS-Dateien (nordic = metal.css). sw.js lädt nur diese vorab (Speicher „optik-1“).
THEME_IMG = {'nordic': sorted(set(re.findall(r'url\("([\w.-]+\.(?:jpg|png))"\)', rd(A + 'metal.css'))))}
for _t in ['metal', 'amp', 'ice', 'clean', 'matrix', 'dj', 'light', 'precise-dark', 'ios']:
    _l = sorted(set(re.findall(r'url\("([\w.-]+\.(?:jpg|png))"\)', rd(A + 'theme-' + _t + '.css'))))
    if _l: THEME_IMG[_t] = _l
ALL_IMG = sorted(set(x for l in THEME_IMG.values() for x in l))
for _f in ALL_IMG: assert os.path.exists(A + 'www/' + _f), _f
_sw = rd(A + 'www/sw.js'); assert sorted(json.loads(re.search(r'const OPTIK_IMG = (\[.*?\]);', _sw).group(1).replace("'", '"'))) == ALL_IMG, 'sw.js OPTIK_IMG passt nicht zu den Optik-CSS'
CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'wasm-unsafe-eval\' blob:; worker-src \'self\' blob:; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; media-src \'self\' blob: data:; connect-src \'self\' blob: data:; manifest-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">'
EARLY = "<script>try{var d=localStorage.getItem('3nps-device'),da=localStorage.getItem('3nps-device-auto');d=/^(new|old|min)$/.test(d)?d:(da==='old'?'old':'new');window.__dev=d;if(d!=='new')document.documentElement.classList.add('dev-old');if(d==='min')document.documentElement.classList.add('dev-min');}catch(e){window.__dev='new'}try{if(localStorage.getItem('3nps-ringe')==='klein')document.documentElement.classList.add('ring-klein');}catch(e){}try{var t=localStorage.getItem('3nps-theme')||'nordic',u=localStorage.getItem('3nps-theme2');if(u&&/^(nordic|metal|amp|ice|clean|matrix|dj|light|precise|precise-dark|ios)$/.test(u)&&(/^(metal|amp|ice|nordic)$/.test(u)?u:'nordic')===t)t=u;if(window.__dev!=='min'&&t!=='nordic'&&/^(metal|amp|ice|clean|matrix|dj|light|precise|precise-dark|ios)$/.test(t)){document.documentElement.dataset.theme=t;}if(window.__dev!=='min'){var F=" + json.dumps(THEME_FONTS, separators=(',', ':')) + "[t]||[];for(var i=0;i<F.length;i++){var l=document.createElement('link');l.rel='preload';l.as='font';l.type='font/woff';l.crossOrigin='anonymous';l.href='fonts/'+F[i];document.head.appendChild(l);}}}catch(e){}window.__OPTIK_IMG=" + json.dumps(THEME_IMG, separators=(',', ':')) + ";</script>\n"

# --- Kopf/Markup ---
ACCEPT = 'audio/*,video/*,.mp3,.wav,.wave,.aif,.aiff,.aifc,.m4a,.m4b,.aac,.caf,.flac,.alac,.ogg,.oga,.opus,.mp4,.mov,.3gp,.webm,.amr'
head = head.replace('</style>', lcss + metal + themecss + rd(A + 'geraet.css') + rd(A + 'bedienung.css') + rd(A + 'design.css') + '</style>', 1)
head = head.replace('step="1" value="80"', 'step="any" value="80"')
# v112: Mastering ist ins Studio umgezogen (master.js liefert weiter window.Master für den Song-Export)
head = head.replace('LOOPER_PANEL', lhtml).replace('CIRCLE_PANEL', rd(A + 'circle.html')).replace('SINGEN_PANEL', rd(A + 'singen.html')).replace('MASTER_PANEL', '').replace('HILFE_PANEL', rd(A + 'hilfe.html')).replace('LERNEN_PANEL', rd(A + 'lernen.html')).replace('POWER_PANEL', rd(A + 'powerchords.html')).replace('SOLO_PANEL', rd(A + 'solo.html')).replace('CAGED_PANEL', rd(A + 'caged.html')).replace('JAM_PANEL', rd(A + 'jam.html')).replace('LIED_PANEL', rd(A + 'lied.html')).replace('UEBEN_PANEL', rd(A + 'uebung.html'))
head = head.replace('AUDIO_ACCEPT', ACCEPT)
assert 'AUDIO_ACCEPT' not in head and 'LOOPER_PANEL' not in head and 'CIRCLE_PANEL' not in head and 'SOLO_PANEL' not in head and 'JAM_PANEL' not in head and 'LIED_PANEL' not in head and 'UEBEN_PANEL' not in head and 'POWER_PANEL' not in head
# Bass kann einem Akkord folgen (Jam): window.bassChordAt() liefert Grundton und Quinte des klingenden Akkords
old_b = "  const rootIdx = NOTES.indexOf(rootSel.value);\n  const intervals = MODES[modeSel.value];\n  const baseMidi = 36 + rootIdx;\n  const midi = deg === 'fifth' ? baseMidi + intervals[4] : baseMidi;"
assert old_b in script
script = script.replace(old_b, "  const ovc = typeof window.bassChordAt === 'function' ? window.bassChordAt(t) : null;\n  const rootIdx = ovc ? ovc.root : NOTES.indexOf(rootSel.value);\n  const intervals = MODES[modeSel.value];\n  const baseMidi = 36 + rootIdx;\n  const midi = deg === 'fifth' ? baseMidi + (ovc ? ovc.fifth : intervals[4]) : baseMidi;", 1)
script = script.replace("'Aus – folgt dem Tempo unten'", "'Aus – folgt dem Tempo oben'")
# v145: Anleitungs-Daten (≈ 88 KB) in einer Funktion – der Browser legt die Objekte erst beim ersten Öffnen an
HILFE_FN = 'function __hilfeDaten() {\n' + rd(A + 'hilfe-daten.js') + '\nreturn HILFE;\n}'
rhythm = rd(A + 'eq.js') + '\n' + rd(A + 'kit.js') + '\n' + rd(A + 'rhythm.js') + '\n' + rd(A + 'drones.js')
body = head + script + '\n<script>\n' + rhythm + '\n</script>\n<script>\n' + looper + '\n</script>\n<script>\n' + appcfg + '\n</script>\n<script>\n' + rd(A + 'circle.js') + '\n</script>\n<script>\n' + rd(A + 'voicings.js') + '\n' + rd(A + 'pitch.js') + '\n' + rd(A + 'solo.js') + '\n' + rd(A + 'passt.js') + '\n' + rd(A + 'caged.js') + '\n' + rd(A + 'sing.js') + '\n' + rd(A + 'singen.js') + '\n</script>\n<script>\n' + rd(A + 'jam.js') + '\n' + rd(A + 'jammen.js') + '\n</script>\n<script>\n' + rd(A + 'licks.js') + '\n' + rd(A + 'uebung.js') + '\n</script>\n<script>\n' + rd(A + 'lied-core.js') + '\n' + rd(A + 'lied-text.js') + '\n' + rd(A + 'lied-pdf.js') + '\n' + rd(A + 'lied-export.js') + '\n' + rd(A + 'lied.js') + '\n</script>\n<script>\n' + rd(A + 'master-dsp.js') + '\n' + rd(A + 'master.js') + '\n</script>\n<script>\n' + HILFE_FN + '\n' + rd(A + 'hilfe.js') + '\n' + rd(A + 'lernen.js') + '\n' + rd(A + 'hoer.js') + '\n</script>\n<script>\n' + rd(A + 'powerchords.js') + '\n' + rd(A + 'powerchords-kurs.js') + '\n' + rd(A + 'powerchords-werkstatt.js') + '\n' + rd(A + 'powerchords-live.js') + '\n' + rd(A + 'powerchords-extra.js') + '\n' + rd(A + 'powerchords-plan.js') + '\n</script>\n' + tabs

top = '''<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Looper</title>
<meta name="theme-color" content="#1b1b1d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Looper">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
''' + CSP + '''
''' + FONTS + '''
''' + EARLY + '''<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)} html,body{-webkit-tap-highlight-color:transparent;touch-action:manipulation} body{-webkit-user-select:none;user-select:none} input,textarea{-webkit-user-select:text;user-select:text}</style>
'''
sw = '''<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
</script>'''
# v145: Englisch-Wörterbuch (≈ 170 KB) als eigene Datei, nur im EN-Modus synchron nachgeladen (Sprachwechsel lädt die Seite neu)
EN_DICT = rd(A + 'i18n-en.js') + '\n' + rd(A + 'i18n-en2.js')
open(A + 'www/i18n-en.js', 'w', encoding='utf8').write(EN_DICT)
I18N = ('<script>try{var q=/[?&]lang=(de|en)\\b/.exec(location.search);if((q?q[1]:localStorage.getItem(\'3nps-lang\'))===\'en\')document.write(\'<script src="i18n-en.js"><\\/script>\');}catch(e){}</script>\n'
        + '<script>\n' + rd(A + 'i18n.js') + '\n</script>\n')
I18N_PV = '<script>\n' + EN_DICT + '\n' + rd(A + 'i18n.js') + '\n</script>\n'   # Vorschau bleibt eine einzige Datei
app = top + body.replace('<header class="control-bar">', '</head>\n<body>\n' + I18N + '<header class="control-bar">', 1) + sw + '\n</body>\n</html>\n'
open(A + 'www/index.html', 'w', encoding='utf8').write(app)

# --- Vorschau für Claude ---
pv = '<title>Looper-Vorschau</title>\n' + FONTS_PV + '\n' + EARLY.replace('document.head.appendChild(l);', '') + I18N_PV + '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>\n' + body
pv = pv.replace("let start = 'griffbrett';", "let start = 'looper';")
old_mic = "setStatus('Kein Zugriff aufs Mikrofon. Erlaube ihn in den iPad-Einstellungen unter Datenschutz → Mikrofon bzw. für die Website in Safari (aA → Website-Einstellungen → Mikrofon).');"
assert old_mic in pv
pv = pv.replace(old_mic, "setStatus('In der Vorschau ist das Mikrofon gesperrt. Nimm den Demo-Loop oben, in der App funktioniert die Aufnahme.');")
banner = '''<div class="card preview-note">
      <h2>Vorschau</h2>
      <p class="pattern-desc">Hier bei Claude ist das Mikrofon gesperrt, deshalb klappt die Aufnahme erst in der installierten App. Lade einen Demo-Loop auf Spur 1 oder eine eigene Audiodatei über ♫ auf eine Spur, um Taktkreise, Drums, Pedal und Ideen-Liste auszuprobieren.</p>
      <button class="toggle-btn active" id="demoLoop" style="align-self:flex-start">Demo-Loop laden</button>
    </div>
    <div class="card looper-card">'''
pv = pv.replace('<div class="card looper-card">', banner, 1)
pv += '''<script>
/* Nur Vorschau: gezupftes Demo-Arpeggio in der aktuellen Skala */
document.getElementById('demoLoop').addEventListener('click', () => {
  ensureAudio();
  const sr = audioCtx.sampleRate, bpm = parseInt(document.getElementById('bpm').value) || 80;
  const eighth = 30 / bpm, len = Math.round(16 * eighth * sr), out = new Float32Array(len);
  const pitches = currentPattern.slice(0, 8).map(n => n.pitch);
  const seq = pitches.concat(pitches.slice(1, 7).reverse()).concat([pitches[0], pitches[2]]);
  function pluck(midi, start, dur, amp) {
    const f = midiToFreq(midi), N = Math.max(2, Math.round(sr / f)), buf = new Float32Array(N);
    for (let i = 0; i < N; i++) buf[i] = Math.random() * 2 - 1;
    const s0 = Math.round(start * sr), n = Math.min(len - s0, Math.round(dur * sr));
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const nxt = (idx + 1) % N, v = buf[idx];
      buf[idx] = 0.4985 * (v + buf[nxt]);
      out[s0 + i] += v * amp * Math.min(1, (n - i) / (0.02 * sr));
      idx = nxt;
    }
  }
  seq.forEach((p, k) => pluck(p, k * eighth, eighth * 1.8, 0.35));
  const root = pitches.find(p => p % 12 === NOTES.indexOf(rootSel.value)) || pitches[0];
  pluck(root - 12, 0, 8 * eighth, 0.4); pluck(root - 12, 8 * eighth, 8 * eighth, 0.4);
  Looper.loadSamples(out);
  document.getElementById('loopStatus').textContent = 'Demo-Loop läuft auf Spur 1 (' + rootSel.value + ' ' + modeSel.value + ', 2 Takte).';
});
</script>
'''
open(D + 'preview.html', 'w', encoding='utf8').write(pv)
print('app', len(app), 'preview', len(pv))

# Texterkennung (v64): Worker neben die Modelle legen (Modelle selbst kommen aus dem Branch „modelle“)
import os, shutil
os.makedirs(A + 'www/asr', exist_ok=True)
shutil.copy(A + 'asr-worker.js', A + 'www/asr/worker.js')
shutil.copy(A + 'sep-worker.js', A + 'www/asr/sep-worker.js')   # v124: Gesang trennen (lädt erst bei Bedarf)
