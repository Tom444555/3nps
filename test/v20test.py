# v20: selbst erzeugter Bass, Akkorde, automatischer Abgleich, präzise Anzeige
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def load(pg, i, path, wait=60):
    await pg.set_input_files(f'#file{i}', path)
    for _ in range(wait):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        st = await pg.inner_text('#loopStatus')
        if st.startswith(f'Spur {i + 1}:'): return st
    return await pg.inner_text('#loopStatus')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(600)
        # 1) Bass: selbst erzeugt, 20 Töne, keine eingebetteten MP3s mehr
        for _ in range(40):
            if await pg.evaluate('bassSamplesReady'): break
            await pg.wait_for_timeout(250)
        bi = await pg.evaluate("({ ready: bassSamplesReady, n: Object.keys(bassSampleBuffers).length, len: bassSampleBuffers[45] && bassSampleBuffers[45].duration, mp3: typeof BASS_SAMPLES_B64 !== 'undefined' })")
        check('Bass im Hintergrund erzeugt (20 Töne, keine MP3-Daten)', bi['ready'] and bi['n'] == 20 and not bi['mp3'] and abs(bi['len'] - 2.2) < 0.01, bi)
        pk = await pg.evaluate("(() => { const a = bassSampleBuffers[40].getChannelData(0); let m = 0, e = 0; for (let i = 0; i < a.length; i++) { m = Math.max(m, Math.abs(a[i])); if (i < 48000) e += a[i] * a[i]; } return { peak: m, rms: Math.sqrt(e / 48000), first: Math.abs(a[0]) }; })()")
        check('Bass-Ton: Pegel wie bisher, setzt ohne Knackser ein', 0.03 < pk['rms'] < 0.07 and pk['peak'] < 0.5 and pk['first'] < 1e-3, pk)
        # Begleitung mit Bass abspielen: keine Fehler
        await pg.evaluate("ensureAudio(); startGrooveEngine(); playBassNote(audioCtx.currentTime + 0.05, 'root', 400); playBassNote(audioCtx.currentTime + 0.5, 'fifth', 400)")
        await pg.wait_for_timeout(900); await pg.evaluate('stopGrooveEngine && stopGrooveEngine()')
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        # 2) Akkorde: Loop laden, Akkordleiste erscheint
        st = await load(pg, 0, T + 'chords/c_pop_strum.wav')
        names = None
        for _ in range(40):
            await pg.wait_for_timeout(250)
            c = await pg.evaluate('Looper._chords(0)')
            if c: names = [s['name'] for s in c['segs']]; break
        check('Akkorde erkannt (C G Am F)', names == ['C', 'G', 'Am', 'F'], f'{names} · {st[:80]}')
        vis = await pg.is_visible('#chords0'); btns = await pg.evaluate("[...document.querySelectorAll('#chords0 .ch')].map(b => b.textContent)")
        check('Akkordleiste unter der Spur', vis and btns == ['C', 'G', 'Am', 'F'], btns)
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        if not await pg.evaluate("Looper.debug().tracks[0].state === 'playing'"): await pg.click('#loopAll')
        await pg.wait_for_timeout(2700)
        on = await pg.evaluate("[...document.querySelectorAll('#chords0 .ch')].findIndex(b => b.classList.contains('on'))")
        check('Klingender Akkord leuchtet mit', on >= 0, on)
        # Antippen springt zum Akkord
        await pg.click('#chords0 .ch:nth-child(3)'); await pg.wait_for_timeout(250)
        on2 = await pg.evaluate("[...document.querySelectorAll('#chords0 .ch')].findIndex(b => b.classList.contains('on'))")
        check('Akkord antippen springt dorthin', on2 == 2, on2)
        # Editor zeigt Akkorde je Takt
        if not await pg.is_visible('#loopEditor'): await pg.click('#edit0')
        await pg.wait_for_timeout(400)
        edc = await pg.inner_text('#edChords')
        check('Editor: Akkorde je Takt', 'C' in edc and 'Am' in edc and edc.count('|') >= 3, edc)
        y = await pg.evaluate("document.getElementById('loopEditor').getBoundingClientRect().top + scrollY")
        await pg.screenshot(path=O + 'v20_editor.png', full_page=True, clip={'x': 0, 'y': y, 'width': 1024, 'height': 330})
        yt = await pg.evaluate("document.querySelector('.tracks').getBoundingClientRect().top + scrollY")
        await pg.screenshot(path=O + 'v20_tracks.png', full_page=True, clip={'x': 0, 'y': yt, 'width': 1024, 'height': 420})
        if await pg.is_visible('#loopEditor'): await pg.click('#edClose')
        # Export: Akkord-Marker in der MIDI-Datei
        ex = await pg.evaluate("Looper.exportLogic().then(r => { const f = r.files.find(f => f.name.endsWith('.mid')); const s = new TextDecoder('latin1').decode(f.data); const l = r.files.find(f => f.name.endsWith('LIES MICH.txt')); return { mid: ['C','G','Am','F'].map(n => s.includes(n)), txt: new TextDecoder().decode(l.data).split('\\n').find(x => x.startsWith('Akkorde')) || '' }; })")
        check('Logic-Export: Akkorde als Marker und im Text', all(ex['mid']) and 'Am' in ex['txt'], ex)
        # 3) Abgleich: Spur 1 Drums+Bass, Spur 2 Gitarre 18 ms zu früh → beim Laden angeglichen
        await pg.evaluate("[0,1,2].forEach(i => document.getElementById('clear' + i).click()); [0,1,2].forEach(i => document.getElementById('clear' + i).click())")
        await pg.wait_for_timeout(300)
        await load(pg, 0, T + 'align/drums_bass_120.wav')
        st2 = await load(pg, 1, T + 'align/gtr_120_early18.wav')
        a = await pg.evaluate('Looper._align(1)')
        check('Gitarre beim Laden an Spur 1 angeglichen (18 ms zu früh)', 'Feinabgleich' in st2 and abs(a['ms']) < 3, f"{st2[-60:]} · Rest {a['ms']:.1f} ms")
        # Aufnahme-Weg: Spur um +23 ms verschieben (wie spät eingespielt), dann automatischer Abgleich wie nach REC
        await pg.evaluate('Looper._shift(1, 23)')
        a1 = await pg.evaluate('Looper._align(1)'); msg = await pg.evaluate('Looper._alignNew(1)'); a2 = await pg.evaluate('Looper._align(1)')
        check('Neue Aufnahme: 23 ms zu spät → automatisch angeglichen', abs(a1['ms'] - 23) < 2 and 'angeglichen' in msg and abs(a2['ms']) < 2, f"vorher {a1['ms']:.1f} ms → nachher {a2['ms']:.1f} ms · {msg}")
        await pg.evaluate('Looper.undo(1)'); a3 = await pg.evaluate('Looper._align(1)')
        check('↶ nimmt den Abgleich zurück', abs(a3['ms'] - 23) < 2, f"{a3['ms']:.1f} ms")
        await pg.evaluate("document.getElementById('loopAutoAlign').checked = false")
        msg2 = await pg.evaluate('Looper._alignNew(1)')
        check('Abschaltbar (Einstellung „automatisch angleichen“)', msg2 == '', msg2)
        await pg.evaluate("document.getElementById('loopAutoAlign').checked = true")
        # Pad ohne Anschläge: nicht verschieben
        await load(pg, 2, T + 'align/pad_120.wav')
        await pg.evaluate('Looper._shift(2, 15)'); msg3 = await pg.evaluate('Looper._alignNew(2)')
        check('Fläche ohne Anschläge bleibt, wie sie ist', msg3 == '', msg3)
        # 4) Anzeige: hörbare Position liegt hinter der geplanten (Ausgabelatenz), Wellenform in Gerätepixeln
        pf = await pg.evaluate('Looper._playFrame()')
        check('Abspielposition berücksichtigt die Ausgabelatenz', pf['play'] <= pf['now'] + 48 and pf['now'] - pf['play'] < 48000 * 0.5, pf)
        bt = await pg.evaluate('Looper._beats(0)')
        check('Schlagraster der Spur (8 Schläge, gleichmäßig)', len(bt) == 8 and max(abs(bt[i + 1] - bt[i] - bt[1] + bt[0]) for i in range(7)) < 2, bt[:4])
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'\nErgebnis: {sum(res)}/{len(res)} Prüfungen bestanden')
asyncio.run(main())
