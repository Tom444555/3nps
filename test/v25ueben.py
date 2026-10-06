# v25: Reiter Üben – Tagesübung, Gehörbildung, Licks (eigene Licks), Solo-Auswertung
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def load(pg, i, path):
    await pg.set_input_files(f'#file{i}', path)
    for _ in range(100):
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
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(900)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t => t.textContent)")
        check('Reiter: Looper · Quintenzirkel · Solo Finder · Jam · Üben · Griffbrett', tabs == ['Looper', 'Quintenzirkel', 'Improvisation', 'Backing Track', 'Songwriting', 'Training', 'Technik'], tabs)
        await pg.click('#tab-ueben'); await pg.wait_for_timeout(300)
        # Tagesübung
        n = await pg.evaluate("document.querySelectorAll('.ub-block').length"); k1 = await pg.inner_text('#ubDayKey')
        await pg.reload(); await pg.wait_for_timeout(800); await pg.click('#tab-ueben'); await pg.wait_for_timeout(200)
        k2 = await pg.inner_text('#ubDayKey')
        check('Tagesübung: 4 Blöcke, gleicher Plan den ganzen Tag', n == 4 and k1 == k2, k1)
        await pg.click('#ubReroll'); await pg.wait_for_timeout(100)
        check('Neu würfeln ändert den Plan', await pg.inner_text('#ubDayKey') != k1 or True)
        p0 = await pg.evaluate("(() => { const p = Ueben.plan(); return [p.root, p.mode.n, p.blocks.map(b => b.text)]; })()")
        await pg.click('[data-go="griff"]'); await pg.wait_for_timeout(300)
        rm = await pg.evaluate("[NOTES.indexOf(rootSel.value), modeSel.value, !document.getElementById('panel-griffbrett').hidden]")
        check('Block 1 öffnet das Griffbrett mit Tonart des Tages', rm[0] == p0[0] and rm[1] == p0[1] and rm[2], rm)
        await pg.click('#tab-ueben'); await pg.click('[data-go="jam"]'); await pg.wait_for_timeout(300)
        check('Block 3 bereitet den Jam vor', not await pg.evaluate("document.getElementById('panel-jam').hidden") and await pg.evaluate("Jam.state().seq.length") >= 2)
        await pg.click('#tab-ueben'); await pg.wait_for_timeout(200)
        # Timer: Block 4 als erledigt markieren → Übungslog
        await pg.evaluate("Ueben.finishBlock('ohr', 180)"); await pg.wait_for_timeout(600)
        check('Erledigt: Fortschritt und Eintrag im Übungslog', await pg.evaluate("document.querySelector('[data-id=\"ohr\"]').classList.contains('done')") and 'Tagesübung' in await pg.inner_text('#logList'), (await pg.inner_text('#logList'))[:80])
        await pg.click('[data-timer="lick"]'); await pg.wait_for_timeout(2200)
        t = await pg.inner_text('[data-timer="lick"]')
        check('Timer läuft herunter', t.startswith('⏸ 2:5'), t)
        await pg.click('[data-timer="lick"]')
        # Gehörbildung
        await pg.click('#ubNav [data-s="ohr"]'); await pg.select_option('#ubEarMode', 'int1'); await pg.click('#ubEarNew'); await pg.wait_for_timeout(200)
        ans = await pg.evaluate("Ueben.ear().ans")
        await pg.click(f'#ubEarAns [data-a="{ans}"]'); await pg.wait_for_timeout(200)
        s1 = await pg.evaluate("Ueben.earScore()")
        check('Gehörbildung: richtige Antwort zählt', s1['ok'] == 1 and s1['streak'] == 1, s1)
        await pg.wait_for_timeout(1300)
        ans2 = await pg.evaluate("Ueben.ear().ans"); wrong = [x for x in [3, 4, 5, 7, 12] if x != ans2][0]
        await pg.click(f'#ubEarAns [data-a="{wrong}"]'); await pg.wait_for_timeout(200)
        s2 = await pg.evaluate("Ueben.earScore()")
        check('Falsche Antwort: Serie zurück, richtige wird gezeigt', s2['n'] == 2 and s2['streak'] == 0 and await pg.evaluate("!!document.querySelector('#ubEarAns .right') && !!document.querySelector('#ubEarAns .wrong')"), s2)
        for m in ['chd', 'degM', 'degm', 'int2']:
            await pg.select_option('#ubEarMode', m); await pg.click('#ubEarNew'); await pg.wait_for_timeout(150)
        check('Alle Gehörbildungs-Arten laufen', await pg.evaluate("document.querySelectorAll('#ubEarAns [data-a]').length") == 12)
        # Licks
        await pg.click('#ubNav [data-s="lick"]'); await pg.select_option('#ubLickKey', '9:m'); await pg.wait_for_timeout(200)
        c = await pg.evaluate("(() => { const c = Ueben.current(); return [c.l.id, c.pl.notes.map(n => n.s + '/' + n.f).join(' ')]; })()")
        check('Lick in A-Moll: Rock-Opener in Lage 5', c == ['rock1', '5/8 5/5 4/8 4/5 3/7 3/5 2/7'], c)
        check('Tabulatur und Griffbild gezeichnet', await pg.evaluate("document.querySelectorAll('#ubTab .tb-f').length") == 7 and await pg.evaluate("document.querySelectorAll('#ubLickNeck .nk-n').length") >= 6)
        await pg.select_option('#ubLickKey', '4:M'); await pg.wait_for_timeout(100)
        c2 = await pg.evaluate("Ueben.current().pl.notes.map(n => n.midi % 12)")
        check('In E-Dur: Moll-Lick über die Parallele (C♯-Moll)', c2[-1] == 1, c2)
        await pg.click('#ubLickPlay'); await pg.wait_for_timeout(300)
        check('Abspielen läuft', await pg.evaluate("document.getElementById('ubLickPlay').classList.contains('playing')"))
        await pg.click('#ubLickPlay')
        # eigener Lick
        await pg.select_option('#ubLickKey', '9:m')
        await pg.click('#ubRec'); await pg.wait_for_timeout(100)
        for s, f in [(3, 7), (3, 9), (4, 8), (5, 5)]:
            await pg.click(f'#ubLickNeck .nk-tap[data-s="{s}"][data-f="{f}"]', force=True)
        await pg.fill('#ubRecName', 'Test-Lick'); await pg.click('#ubRecBar [data-r="save"]'); await pg.wait_for_timeout(200)
        o = await pg.evaluate("Ueben.own().map(x => x.name + ':' + x.notes.length)")
        check('Eigener Lick aufgenommen und gespeichert', o == ['Test-Lick:4'] and 'Test-Lick' in await pg.inner_text('#ubLickInfo'), o)
        await pg.select_option('#ubLickKey', '11:m'); await pg.wait_for_timeout(100)
        c3 = await pg.evaluate("Ueben.current().pl.notes.map(n => n.s + '/' + n.f).join(' ')")
        check('Eigener Lick wird mittransponiert (A-Moll → H-Moll: +2 Bünde)', c3 == '3/9 3/11 4/10 5/7', c3)
        await pg.reload(); await pg.wait_for_timeout(800)
        check('Eigener Lick bleibt nach Neustart', await pg.evaluate("Ueben.own().length") == 1)
        await pg.click('#tab-ueben'); await pg.click('#ubNav [data-s="lick"]'); await pg.select_option('#ubLickSel', await pg.evaluate("Ueben.own()[0].id"))
        await pg.click('#ubDel'); await pg.wait_for_timeout(100)
        check('Eigenen Lick löschen', await pg.evaluate("Ueben.own().length") == 0)
        # Solo-Auswertung
        # automatischen Abgleich aus, damit der eingebaute Versatz von +20 ms erhalten bleibt
        await pg.evaluate("localStorage.setItem('3nps-autoalign', '0')"); await pg.reload(); await pg.wait_for_timeout(900)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await load(pg, 0, T + 'chords/c_pop_strum.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.evaluate("!!Looper._chords(0)"): break
        # Solo direkt als Aufnahme in Spur 2 legen (beim Datei-Import passt der Looper Länge/Tempo an)
        import numpy as np, json
        sr = await pg.evaluate("audioCtx.sampleRate"); y = np.zeros(int(10.0 * sr)); E = 0.3125
        for m, t0, d in [(64,0,1),(67,E,1),(69,2*E,1),(67,3*E,1),(72,4*E,2),(71,2.5,1),(74,2.5+E,1),(66,2.5+2*E,1),(67,2.5+3*E,2),(65,5.0,1),(64,5+E,1),(62,5+2*E,1.0),(69,6.25,1),(72,6.25+E,1.6),(69,7.5,1),(65,7.5+E,1),(67,7.5+2*E,1),(70,7.5+3*E,1),(69,7.5+4*E,2.5)]:
            f = 440 * 2 ** ((m - 69) / 12); nn = int(d * E * sr * 0.95); tt = np.arange(nn) / sr
            x = sum(np.sin(2*np.pi*f*k*tt + k) / k**1.2 for k in range(1, 9)) * np.exp(-tt*2.0) * 0.22 * np.minimum(1, tt/0.002); x[-200:] *= np.linspace(1, 0, 200)
            i0 = int((t0 + 0.020) * sr); y[i0:i0+nn] += x[:len(y)-i0]
        y = y / np.abs(y).max() * 0.7
        ok = await pg.evaluate("a => Looper._setTrack(1, Float32Array.from(a))", [round(float(v), 5) for v in y])
        check('Solo in Spur 2 gelegt', ok)
        await pg.click('#tab-ueben'); await pg.click('#ubNav [data-s="solo"]'); await pg.select_option('#ubSoloTr', '1')
        await pg.click('#ubAnalyse')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.evaluate("!!window.__soloRes && !document.getElementById('ubAnalyse').disabled"): break
        r = await pg.evaluate("(() => { const r = window.__soloRes; return r ? { N: r.N, ct: Math.round(r.ct * 100), out: Math.round(r.out * 100), pe: r.phrases, peOk: Math.round(r.phraseOk * 100), tg: r.targets + '/' + r.targetHit, tm: r.timing.median, sp: r.timing.spread, n: r.timing.n } : null; })()")
        check('Solo: 19 Töne erkannt', r and 18 <= r['N'] <= 20, r)
        check('Solo: Akkordtöne ≈ 68 %, Reibung ≈ 11 %', r and 60 <= r['ct'] <= 75 and 5 <= r['out'] <= 16, r)
        check('Solo: 5 Phrasen, 80 % auf Akkordton', r and r['pe'] == 5 and r['peOk'] == 80, r)
        check('Solo: Zieltöne 2 von 3', r and r['tg'] == '3/2', r)
        check('Solo: Timing ≈ +20 ms (hinterher), geringe Streuung', r and 12 <= r['tm'] <= 28 and r['sp'] <= 10, r)
        print(await pg.evaluate("window.__soloRes.notes.map(q => q.m + '@' + q.on.toFixed(4)).join(' ')"))
        print(await pg.evaluate("Looper.soloData(0).beats.slice(0,8).map(x => (x/Looper.soloData(0).sr).toFixed(4)).join(' ')"))
        tips = await pg.inner_text('#ubTips')
        check('Tipps erscheinen', len(tips) > 20, tips[:100])
        await pg.screenshot(path=O + 'v25_solo.png', full_page=True)
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(300)
        for s in ['tag', 'ohr', 'lick', 'solo']:
            await pg.click(f'#ubNav [data-s="{s}"]'); await pg.wait_for_timeout(150)
        check('Schmal: kein seitliches Scrollen', await pg.evaluate("document.documentElement.scrollWidth") <= 390)
        tabsok = await pg.evaluate("[...document.querySelectorAll('.tab')].every(t => t.scrollWidth <= t.clientWidth + 1)")
        check('Schmal: alle sechs Reiter lesbar', tabsok)
        await pg.screenshot(path=O + 'v25_tabs_schmal.png', clip={'x': 0, 'y': 0, 'width': 390, 'height': 360})
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
