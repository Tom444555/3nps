# v124: Gesang trennen (Spleeter 2-Stems im Worker, ONNX-Laufzeit aus asr/lib) – Looper (Spur → Gesang/Begleitung, Karaoke, Ideen,
# Gesangsspur im Editor, Mitsingen mit Tonhöhe des Originals), Studio (Region → zwei Spuren, Original stumm), Abbrechen,
# nichts geladen ohne Nutzung, Energieverhältnis der Ergebnisse (> 6 dB), keine Skriptfehler.
# Braucht die Modelle in app/www/asr/models/spleeter/onnx/ (Branch „modelle“, siehe wiederherstellen.sh) und test/gen_sep.py (wird bei Bedarf aufgerufen).
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
from nav import tab
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'; S = 'http://localhost:8765/studio/'
if not os.path.exists(T + 'sep/mix.wav'): subprocess.run([sys.executable, os.path.dirname(os.path.abspath(__file__)) + '/gen_sep.py'], check=True)
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''), flush=True)
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("la", 2, 0), ("la", 3, 0), ("la", 4, 0), ("lu", 6, 1), ("lu", 7, 1), ("lu", 8, 1)]]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"mix.wav|240": {"name": "mix.wav", "tok": TOK}}, "l": {}}))
FILES = {'voice': T + 'sep/voice.wav', 'acc': T + 'sep/acc.wav', 'mix': T + 'sep/mix.wav'}
async def route(r):
    k = r.request.url.rsplit('/', 1)[-1].split('.')[0]
    await r.fulfill(body=open(FILES[k], 'rb').read(), content_type='audio/wav')
# Anteil von Stimme und Begleitung in einem Ergebnis: kleinste Quadrate est ≈ a·Stimme + b·Begleitung → 20·log10(|a|/|b|)
SHARE = """async ([est, off]) => { const ac = %s; const dec = async u => { const b = await ac.decodeAudioData(await (await fetch(u)).arrayBuffer()); return b.getChannelData(0); };
  const v = await dec('/__t/voice.wav'), a = await dec('/__t/acc.wav'), n = Math.min(est.length, v.length - off, a.length - off);
  let vv = 0, aa = 0, va = 0, ev = 0, ea = 0; for (let i = Math.max(0, -off); i < n; i++) { const x = v[i + off], y = a[i + off], e = est[i]; vv += x * x; aa += y * y; va += x * y; ev += e * x; ea += e * y; }
  const det = vv * aa - va * va, cv = (ev * aa - ea * va) / det, ca = (ea * vv - ev * va) / det; return { cv, ca }; }"""
async def load(pg, f):
    await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', f)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if (await pg.inner_text('#loopStatus')).startswith(('Spur 1:', 'Track 1:')): break
async def asr_res(pg):
    return await pg.evaluate("performance.getEntriesByType('resource').map(e => e.name).filter(n => /\\/asr\\//.test(n))")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await ctx.route('**/__t/*', route)
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(1200)
        # --- ohne Nutzung: nichts geladen, Knopf erst bei Inhalt ---
        check('Sep vorhanden, kein Worker/Modell beim Start', await pg.evaluate("!!window.Sep && !Sep.busy()") and not await asr_res(pg), await asr_res(pg))
        check('„Gesang trennen“ verborgen bei leerer Spur', await pg.evaluate("document.getElementById('sepb0').hidden"))
        await load(pg, FILES['mix']); await pg.wait_for_timeout(900)
        check('nach dem Laden einer Datei: Knopf „Gesang trennen“ sichtbar', await pg.is_visible('#sepb0') and (await pg.inner_text('#sepb0')) == 'Gesang trennen', await pg.inner_text('#sepb0'))
        check('Looper ohne Nutzung unverändert: keine Datei aus asr/ geladen', not await asr_res(pg), await asr_res(pg))
        L0 = await pg.evaluate("(() => { const m = Looper._mixOfL(0); return { L: m.length, st: m.r !== m.l, k: Looper.singSrc(0) && Looper.singSrc(0).key } })()")
        check('Datei liegt ganz auf Spur 1 (Stereo)', L0['st'] and L0['k'] == 'mix.wav|240', L0)
        # --- Rückfrage beim ersten Mal (Größe) ---
        await pg.evaluate("window.__asked = []; window.confirm = m => { __asked.push(m); return false; }; 0")
        await pg.click('#sepb0'); await pg.wait_for_timeout(600)
        asked = await pg.evaluate("__asked")
        check('Rückfrage nennt die Größe (79 MB), Nein = nichts geladen', len(asked) == 1 and '79 MB' in asked[0] and not await asr_res(pg) and not await pg.evaluate("Sep.busy()"), asked)
        # --- Abbrechen ---
        await pg.evaluate("window.confirm = m => true; 0")
        await pg.click('#sepb0')
        pmax = 0
        for _ in range(240):
            await pg.wait_for_timeout(250)
            pct = await pg.evaluate("(() => { const d = document.getElementById('sepDlg'); return d && !d.hidden ? parseFloat(document.getElementById('sepPct').textContent) : -1 })()")
            pmax = max(pmax, pct)
            if pct >= 30: break
        txt = await pg.inner_text('#sepTxt')
        check('Fortschrittsfenster mit Prozent und Text', pmax >= 30 and len(txt) > 5, (pmax, txt))
        await pg.click('#sepStop'); await pg.wait_for_timeout(800)
        st = await pg.evaluate("({ busy: Sep.busy(), dlg: document.getElementById('sepDlg').hidden, kara: Looper.kara(0), s: document.getElementById('loopStatus').textContent, t2: Looper.debug().tracks[1].L })")
        check('Abbrechen: Fenster zu, nichts geändert', not st['busy'] and st['dlg'] and st['kara'] is None and 'abgebrochen' in st['s'] and not st['t2'], st)
        # --- vollständige Trennung ---
        n0 = await pg.evaluate("AppDB.all ? AppDB.all('ideas').then(a => a.length) : 0")
        t0 = time.time(); await pg.click('#sepb0')
        for _ in range(1200):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("!!Looper.kara(0) && !Sep.busy()"): break
        dt = time.time() - t0
        k = await pg.evaluate("Looper.kara(0)")
        check('Trennung läuft im Browser vollständig durch (%.0f s für 24 s Audio)' % dt, k is not None and k['on'], k)
        check('Spur 1 spielt jetzt die Begleitung: Knopf „Karaoke ✓“', (await pg.inner_text('#sepb0')) == 'Karaoke ✓', await pg.inner_text('#sepb0'))
        tr = await pg.evaluate("Looper.debug().tracks.map(t => ({ L: t.L, state: t.state }))")
        check('Gesang liegt auf Spur 2 (gleiche Länge, angehalten)', tr[1]['L'] == tr[0]['L'] and tr[1]['state'] == 'stopped', tr)
        ids = await pg.evaluate("AppDB.all('ideas').then(a => a.filter(i => i.sep).map(i => ({ n: i.name, sep: i.sep, wav: !!i.wav, secs: Math.round(i.secs) })))")
        check('Zwei Ideen „mix · Gesang“ und „mix · Begleitung“ gespeichert', sorted(i['sep'] for i in ids) == ['acc', 'voc'] and all(i['wav'] and i['secs'] == 24 for i in ids) and any(i['n'] == 'mix · Gesang' for i in ids), ids)
        await pg.wait_for_timeout(800)
        names = await pg.evaluate("[...document.querySelectorAll('.idea-row')].map(r => r.textContent)")
        check('Ideen-Liste zeigt beide sofort', any('mix · Begleitung' in x for x in names) and any('mix · Gesang' in x for x in names), len(names))
        check('Gesangstext-Editor hat die Gesangsspur (statt Moises)', await pg.evaluate("Sing.hasVox(Sing.source({ track: 0 }))"))
        # --- Energieverhältnis (Ergebnisse auf den Spuren gegen die echten Anteile) ---
        sh = SHARE % 'audioCtx'
        off = await pg.evaluate("Looper.singSrc(0).origPos")
        rv = await pg.evaluate("(async () => { const f = (" + sh + "); return await f([Looper._mixOfL(1).l, " + str(off) + "]) })()")
        ra = await pg.evaluate("(async () => { const f = (" + sh + "); return await f([Looper._mixOfL(0).l, " + str(off) + "]) })()")
        import math
        dbv = 20 * math.log10(abs(rv['cv']) / max(1e-9, abs(rv['ca']))); dba = 20 * math.log10(abs(ra['ca']) / max(1e-9, abs(ra['cv'])))
        check('Gesangsspur: deutlich mehr Stimme als Begleitung (> 6 dB)', dbv > 6, '%.1f dB (Stimme %.2f, Begleitung %.2f)' % (dbv, rv['cv'], rv['ca']))
        check('Begleitspur: deutlich mehr Begleitung als Stimme (> 6 dB)', dba > 6, '%.1f dB (Begleitung %.2f, Stimme %.2f)' % (dba, ra['ca'], ra['cv']))
        sm = await pg.evaluate("(() => { const a = Looper._mixOfL(0).l, v = Looper._mixOfL(1).l, ex = Looper.singAudio(0, 0, 1e9), o = Looper.singSrc(0).origPos; let e = 0, m = 0; for (let i = 0; i < a.length - 1000; i += 7) { const x = ex.l[i + o]; if (x === undefined) continue; e = Math.max(e, Math.abs(a[i] + v[i] - x)); m = Math.max(m, Math.abs(x)); } return { e, m } })()")
        check('Gesang + Begleitung = Original (verlustfrei)', sm['e'] < 1e-4 * max(1, sm['m']), sm)
        # --- Karaoke umschalten ---
        await pg.click('#sepb0'); await pg.wait_for_timeout(300)
        k1 = await pg.evaluate("({ k: Looper.kara(0), same: (() => { const m = Looper._mixOfL(0).l, ex = Looper.singAudio(0, 0, 1e9), o = Looper.singSrc(0).origPos; for (let i = 5000; i < 400000; i += 997) if (Math.abs(m[i] - ex.l[i + o]) > 1e-6) return false; return true })() })")
        check('„Karaoke“ aus: Original mit Gesang', not k1['k']['on'] and k1['same'] and (await pg.inner_text('#sepb0')) == 'Karaoke', k1)
        await pg.click('#sepb0'); await pg.wait_for_timeout(300)
        check('„Karaoke“ wieder an', (await pg.evaluate("Looper.kara(0).on")) and await pg.evaluate("Looper.debug().tracks[0].state") == 'playing')
        # --- Mitsingen: Karaoke-Knopf und Tonhöhe des Originalgesangs ---
        await tab(pg, 'singen'); await pg.wait_for_timeout(600)
        check('Mitsingen: „🎤 Karaoke ✓“ zeigt den Zustand', 'Karaoke ✓' in await pg.inner_text('#sbKara'), await pg.inner_text('#sbKara'))
        hits = 0; tries = []
        for tsec in [0.5, 1.5, 2.5, 4.5, 5.5]:
            await pg.evaluate("t => { const s = Looper.singSrc(0); Looper.seek(0, Math.round(t * s.sr) - s.origPos) }", tsec); await pg.wait_for_timeout(450)
            r = await pg.evaluate("(() => { const s = Sing.source({ track: 0 }); const p = Sing.voxPitch(s); const f = Sing.b2f(s.nowB, s.beats) / s.sr; return { p, f, txt: document.getElementById('sbPitch').textContent } })()")
            if r['p'] is None: tries.append(r); continue
            want = 220 * 2 ** (((int(r['f']) % 5) * 2) / 12); cents = 1200 * math.log2(r['p']['f'] / want)
            tries.append((round(r['f'], 2), r['p']['name'], int(cents), r['txt']))
            if abs(cents) < 60 and r['txt'].startswith('Original: '): hits += 1
        check('Mitsingen zeigt den Ton, den das Original singt (≥ 3 von 5, ±60 ct)', hits >= 3, tries)
        await pg.click('#sbKara'); await pg.wait_for_timeout(400)
        check('Mitsingen: Karaoke aus schaltet die Spur zurück', not (await pg.evaluate("Looper.kara(0).on")) and (await pg.inner_text('#sbPitch')) == '', await pg.inner_text('#sbKara'))
        # --- Englisch ---
        en = await pg.evaluate("(() => { const k = ['Gesang trennen', 'Karaoke ✓', 'Abbrechen', 'Gesang herauslösen (in der App)', 'Spielt die Begleitung ohne Originalgesang (trennt beim ersten Mal den Gesang in der App).']; return k.filter(x => !(window.__EN && __EN[x])) })()")
        check('Englische Texte vorhanden', not en, en)
        check('Looper: keine Skriptfehler', not errs, errs[:4])
        # --- Studio: Region → Gesang/Begleitung, Original stumm ---
        sp = await (await b.new_context(bypass_csp=True, viewport={'width': 1366, 'height': 1024})).new_page(); se = []
        sp.on('pageerror', lambda e: se.append(str(e))); sp.on('console', lambda m: se.append('console: ' + m.text) if m.type == 'error' else None)
        await sp.context.route('**/__t/*', route)
        await sp.goto(S); await sp.wait_for_timeout(1500)
        check('Studio: nichts aus asr/ beim Start', not await asr_res(sp))
        await sp.evaluate("""(async () => { await Proj.newProject('Trennen'); const sr = Engine.sr(); const buf = await Engine.ac().decodeAudioData(await (await fetch('/__t/mix.wav')).arrayBuffer());
          const m = await SDB.putAudio('mix', sr, buf.getChannelData(0).slice(), buf.getChannelData(1).slice()); let tid;
          Proj.change('regions', q => { const t = Proj.track('audio', 'Lied'); tid = t.id; q.tracks.push(t); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: m.id, start: 0, offset: 0, len: m.frames, gain: 0, fi: 0, fo: 0, name: 'mix' }); });
          Engine.dirty(true); UI.show('arr'); Arr.V.sel = Proj.P.regions[0].id; Arr.V.selTrack = tid; UI.inspect(); window.confirm = () => true; return true })()""")
        check('Studio: Region zeigt „Gesang trennen“', await sp.is_visible('#dRegC [data-r="sep"]'))
        await sp.click('#dRegC [data-r="sep"]')
        for _ in range(1200):
            await sp.wait_for_timeout(500)
            if await sp.evaluate("Proj.P.tracks.length >= 3 && !Sep.busy()"): break
        P = await sp.evaluate("({ t: Proj.P.tracks.map(t => t.name), r: Proj.P.regions.map(r => ({ tr: Proj.P.tracks[Proj.tIndex(r.track)].name, m: !!r.muted, len: r.len, start: r.start })), s: document.getElementById('status').textContent })")
        check('Studio: zwei neue Spuren „Gesang“ und „Begleitung“ unter der Spur', P['t'] == ['Lied', 'mix · Gesang', 'mix · Begleitung'], P)
        check('Studio: Original-Region stumm, neue Regionen gleiche Lage/Länge', P['r'][0]['m'] and all(not r['m'] and r['len'] == P['r'][0]['len'] and r['start'] == 0 for r in P['r'][1:]), P['r'])
        sv = await sp.evaluate("(async () => { const f = (" + (SHARE % 'Engine.ac()') + "); const out = []; for (const r of Proj.P.regions.slice(1)) { const d = await SDB.read(r.audio, 0, r.len); out.push(await f([d.l, 0])); } return out })()")
        dv = 20 * math.log10(abs(sv[0]['cv']) / max(1e-9, abs(sv[0]['ca']))); da = 20 * math.log10(abs(sv[1]['ca']) / max(1e-9, abs(sv[1]['cv'])))
        check('Studio: Gesang > 6 dB, Begleitung > 6 dB', dv > 6 and da > 6, '%.1f / %.1f dB' % (dv, da))
        await sp.evaluate("Proj.undo(); 0"); await sp.wait_for_timeout(300)
        u = await sp.evaluate("({ n: Proj.P.tracks.length, m: !!Proj.P.regions[0].muted })")
        check('Studio: ↶ nimmt die Trennung zurück', u['n'] == 1 and not u['m'], u)
        check('Studio: keine Skriptfehler', not se, se[:4])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
