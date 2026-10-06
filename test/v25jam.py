# v25: Reiter Jam – Akkordfolge, Begleitung folgt den Akkorden, Tempo-Trainer, Zusammenspiel mit Looper/Solo Finder/Zirkel
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def setbpm(pg, v): await pg.evaluate(f"(() => {{ const e = document.getElementById('bpm'); e.value = {v}; e.dispatchEvent(new Event('input')); }})()")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t => t.textContent)")
        check('Reiter Backing Track vorhanden', 'Backing Track' in tabs, tabs)
        await pg.click('#tab-jam'); await pg.wait_for_timeout(300)
        check('Drum-Spur wandert in den Jam', await pg.evaluate("!!document.querySelector('#jamDrumsHome .lane-drums')"))
        # Eingabe
        r = await pg.evaluate("[Jam.parse('Am F C G'), Jam.parse('Am7:2 D7 Hm Bb F#m7b5'), Jam.parse('C:½ G:0,5 Xy Fmaj7')].map(x => [x.seq.map(c => c.r + c.t + '/' + c.beats).join(' '), x.bad.join(' ')])")
        check('Eingabe: Am F C G', r[0] == ['9m/4 5/4 0/4 7/4', ''], r[0])
        check('Eingabe: Längen, H, b, m7b5', r[1] == ['9m7/8 2 7/4 11m/4 10/4 6m7b5/4', ''] or r[1][0] == '9m7/8 27/4 11m/4 10/4 6m7b5/4', r[1])
        check('Eingabe: ½ Takt, Unbekanntes gemeldet', r[2] == ['0/2 7/2 5maj7/4', 'Xy'], r[2])
        await pg.select_option('#jamKey', '9:m'); await pg.select_option('#jamPre', '0'); await pg.wait_for_timeout(200)
        seq = await pg.evaluate("[...document.querySelectorAll('#jamSeq .jam-c b')].map(b => b.textContent)")
        check('Vorlage „Episch“ in A-Moll: Am F C G', seq == ['Am', 'F', 'C', 'G'], seq)
        await pg.click('#jamPal .sf-ch:has-text("Dm")'); await pg.wait_for_timeout(100)
        await pg.click('#jamSeq .jam-c >> nth=4'); await pg.click('#jamEdit [data-len="8"]'); await pg.click('#jamEdit [data-act="left"]')
        seq = await pg.evaluate("Jam.state().seq.map(c => c.r + c.t + '/' + c.beats).join(' ')")
        check('Anhängen, Länge 2 Takte, verschieben', seq == '9m/4 5/4 0/4 2m/8 7/4', seq)
        await pg.click('#jamEdit [data-act="del"]'); await pg.wait_for_timeout(100)
        check('Entfernen', await pg.evaluate("Jam.state().seq.length") == 4)
        # Spielen: 120 BPM, Bass an, Bass muss Akkord folgen
        await pg.evaluate("(() => { window.__bass = []; const _p = window.playBassNote; window.playBassNote = function (t, deg, ms) { const o = window.bassChordAt ? window.bassChordAt(t) : null; window.__bass.push([t, o ? o.root : null, deg]); return _p.apply(this, arguments); }; })()")
        await setbpm(pg, 120)
        if not await pg.evaluate("typeof bassOn !== 'undefined' && bassOn"): await pg.click('#jamBass')
        await pg.click('#jamPlay')
        await pg.wait_for_timeout(600)
        t0 = await pg.evaluate("(() => { const d = Jam.debug(); return d && !d.pending; })()")
        ok = 0; seen = []
        for k in range(36):
            await pg.wait_for_timeout(250)
            on = await pg.evaluate("document.querySelector('#jamSeq .jam-c.on b')?.textContent")
            if on and (not seen or seen[-1] != on): seen.append(on)
            if k == 10: await pg.screenshot(path=O + 'v25_jam.png', full_page=True)
        check('Jam läuft, Anzeige wandert Am → F → C → G → Am', seen[:5] in (['Am', 'F', 'C', 'G', 'Am'], ['F', 'C', 'G', 'Am', 'F'], ['C', 'G', 'Am', 'F', 'C'], ['G', 'Am', 'F', 'C', 'G']), seen)
        bass = await pg.evaluate("window.__bass")
        ev = await pg.evaluate("Jam.debug()")
        # erwarteter Akkord je Bass-Ton aus Zeit: Akkordwechsel jede 2 s (1 Takt bei 120 BPM)
        roots = [9, 5, 0, 7]
        firsts = [x for x in bass if x[1] is not None]
        bad = 0
        if firsts:
            t0 = None
            # Anfang der Folge: erster Bass-Ton mit Grundton A
            for x in firsts:
                if x[1] == 9: t0 = x[0]; break
            for x in firsts:
                if t0 is None or x[0] < t0 - 0.01: continue
                exp = roots[int((x[0] - t0 + 0.02) // 2.0) % 4]
                if x[1] != exp: bad += 1
        check('Bass spielt Grundton des jeweiligen Akkords, wechselt genau mit', firsts and bad == 0 and len(firsts) >= 8, f'{len(firsts)} Basstöne · {bad} falsch')
        # Solo Finder und Zirkel folgen
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        segs = await pg.evaluate("[...document.querySelectorAll('#sfStrip .sf-seg b')].map(b => b.textContent)")
        src = await pg.inner_text('#sfKeySrc')
        ok2 = 0
        for k in range(12):
            await pg.wait_for_timeout(250)
            a = await pg.evaluate("[document.querySelector('#sfStrip .sf-seg.on b')?.textContent, Jam.nowChord()?.name]")
            if a[0] and a[1] and a[0] == a[1]: ok2 += 1
        check('Solo Finder zeigt die Jam-Folge, Tonart „aus dem Backing Track“', segs == ['Am', 'F', 'C', 'G'] and src == 'aus dem Backing Track' and ok2 >= 10, f'{segs} · {src} · {ok2}/12')
        await pg.click('#tab-quinten'); await pg.wait_for_timeout(500)
        c3 = await pg.evaluate("document.querySelector('.qz-c3').textContent")
        check('Quintenzirkel zeigt den Jam-Akkord', c3.startswith('♪'), c3)
        # Stopp
        await pg.click('#tab-jam'); await pg.click('#jamPlay'); await pg.wait_for_timeout(400)
        check("Stopp: Jam aus, Bass-Akkordfolge gelöst, eigene Drums aus, Knopf zurück", not await pg.evaluate("document.getElementById('jamPlay').classList.contains('playing')") and not await pg.evaluate("Jam.active()") and await pg.evaluate("window.bassChordAt == null") and not await pg.evaluate("Rhythm.on()"))
        # Tempo-Trainer: 100 → 108, +4 jeden Durchlauf; Folge 1 Takt Am (2,4 s bei 100)
        await pg.evaluate("Jam.setSeq('Am')")
        await pg.click('#jamTr')
        for k, v in (('start', 100), ('target', 108), ('step', 4), ('every', 1)):
            await pg.fill(f'#jamTr_{k}', str(v)); await pg.dispatch_event(f'#jamTr_{k}', 'change')
        await pg.click('#jamPlay')
        await pg.evaluate("window.__st=[]; window.__t0=audioCtx.currentTime+0.35; window.__iv=setInterval(()=>{ Rhythm.debug().steps.forEach(x=>{ if(x[0]>window.__t0 && (!window.__st.length||x[0]>window.__st[window.__st.length-1][0]+1e-4)) window.__st.push([x[0],x[1]]); }); },40)")
        bp = []
        for k in range(32):
            await pg.wait_for_timeout(250)
            bp.append(round(float(await pg.evaluate("document.getElementById('bpm').value"))))
        st = await pg.evaluate("window.__st"); r_ = await pg.evaluate("Rhythm.res()")
        seq_ = [s for t, s in st]; br = [(seq_[i], seq_[i+1]) for i in range(len(seq_)-1) if (seq_[i]+1) % r_ != seq_[i+1]]
        check('Tempo-Trainer: 100 → 104 → 108, dann bleibt es', bp[0] == 100 and 104 in bp and bp[-1] == 108 and max(bp) == 108, sorted(set(bp)))
        check('Tempo-Trainer: Groove ohne Sprung', not br and len(seq_) > 40, f'{len(seq_)} Schritte · Brüche {br}')
        await pg.click('#jamPlay'); await pg.click('#jamTr')
        # Looper hat Vorrang
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if await pg.evaluate("!!Looper._chords(0)"): break
        if not await pg.evaluate("Looper.busy()"): await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        await pg.click('#tab-jam'); await pg.click('#jamPlay'); await pg.wait_for_timeout(300)
        s1 = await pg.inner_text('#jamStatus')
        check('Looper läuft: Jam startet nicht, sagt warum', not await pg.evaluate("Jam.active() || !!Jam.debug()") and 'Looper' in s1, s1)
        await pg.click('#jamPlay'); await pg.wait_for_timeout(2600)
        check('Zweites Tippen: Looper gestoppt, Jam läuft', not await pg.evaluate("Looper.busy()") and await pg.evaluate("Jam.active()"))
        await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(800)
        check('Looper gestartet: Jam stoppt von selbst', await pg.evaluate("Looper.busy()") and not await pg.evaluate("!!Jam.debug()"), await pg.inner_text('#jamStatus'))
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        # gespeichert
        await pg.evaluate("Jam.setSeq('Em C G D:2')"); await pg.reload(); await pg.wait_for_timeout(900)
        check('Folge bleibt nach Neustart erhalten', await pg.evaluate("Jam.state().seq.map(c => c.r + c.t + '/' + c.beats).join(' ')") == '4m/4 0/4 7/4 2/8')
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.click('#tab-jam'); await pg.wait_for_timeout(400)
        check('Schmal: kein seitliches Scrollen', await pg.evaluate("document.documentElement.scrollWidth") <= 390)
        await pg.screenshot(path=O + 'v25_jam_schmal.png', full_page=True)
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
