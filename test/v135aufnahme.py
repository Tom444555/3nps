# v135: Looper-Aufnahme bricht nach 4 Takten ab (Rückmeldung iPad, v134).
# Ursache: Übe-Loops aus Powerchords (Übungen/Akkordfolgen seit v120, Kurs-„▶ Loop starten“ seit v125, Begleit-Tracks seit v132)
# stellten „Loop-Länge“ auf die Akkordzahl (meist 4) und SPEICHERTEN das dauerhaft → jede spätere freie Aufnahme endete nach 4 Takten.
# Prüft: freie Aufnahme > 4 Takte läuft bis Stopp (auch nach Powerchords-Übung, Kurs-Loop, Begleit-Track, Improvisation),
# Länge stimmt, gespeicherte Einstellung bleibt „Frei“, einmalige Rücksetzung alter „4 Takte“, Akkordleiste Name in der Mitte + Countdown.
import asyncio, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = 'http://localhost:8765/index.html'
WAV = '/home/claude/3nps/test/corpus/rock_120.wav'
BPM = 200; BAR = 240 / BPM
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))

async def setbpm(pg, v):
    await pg.evaluate("(v=>{const b=document.getElementById('bpm');b.value=v;b.dispatchEvent(new Event('input'));b.dispatchEvent(new Event('change'))})(%d)" % v)

async def record_long(pg, label):
    """Spur 1 leer → Aufnahme starten, 6,5 Takte laufen lassen, dann selbst stoppen."""
    await pg.evaluate("Powerchords.stop && Powerchords.stop(); Looper.stopAll(); Looper.clearAll(); 0"); await pg.wait_for_timeout(300)
    await pg.click('#tab-looper'); await setbpm(pg, BPM); await pg.wait_for_timeout(200)
    await pg.click('#foot0'); t0 = await pg.evaluate("performance.now()")
    await pg.wait_for_timeout(int(5.4 * BAR * 1000))
    st = await pg.evaluate("Looper.debug().tracks[0].state")
    check(label + ': nach 5,4 Takten nimmt Spur 1 noch auf', st == 'recording', st)
    await pg.wait_for_timeout(int(1.1 * BAR * 1000))
    await pg.click('#foot0'); t1 = await pg.evaluate("performance.now()")
    for k in range(80):
        if await pg.evaluate("Looper.debug().tracks[0].state") != 'recording': break
        await pg.wait_for_timeout(100)
    await pg.wait_for_timeout(300)
    d = await pg.evaluate("(()=>{const d=Looper.debug();return {L:d.tracks[0].L/d.sr,st:d.tracks[0].state}})()")
    want = (t1 - t0) / 1000
    check(label + ': Länge = bis zum Stopp (≈ %.1f s, nicht 4 Takte = %.1f s)' % (want, 4 * BAR), abs(d['L'] - want) < BAR * 0.75 and d['L'] > 5 * BAR, d)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV, '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e) + ' @' + (e.stack or '')[:300]))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        # Altzustand vom iPad: „4 Takte“ gespeichert (von einem Übe-Loop vor v135)
        await pg.goto(U); await pg.evaluate("localStorage.setItem('3nps-bars','4'); localStorage.removeItem('3nps-bars-v135'); 0")
        await pg.goto(U); await pg.wait_for_timeout(800)
        check('Version ab v135', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 135)
        check('Alte „4 Takte“ (von Übe-Loop gespeichert) einmalig auf „Frei“ zurückgesetzt', await pg.evaluate("document.getElementById('loopBars').value") == 'free' and await pg.evaluate("localStorage.getItem('3nps-bars')") == 'free')
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
        await record_long(pg, 'Frisch')
        # Folgespur (Tom: auch Spur 2 stoppte nach 4 Takten): Spur 2 läuft über die erste Loop-Runde hinaus bis zum Stopp
        L1 = await pg.evaluate("Looper.debug().baseL/Looper.debug().sr")
        await pg.click('#foot1'); await pg.wait_for_timeout(int(L1 * 1.35 * 1000))
        st2 = await pg.evaluate("Looper.debug().tracks[1].state")
        check('Spur 2: nach 1,35 Loop-Runden nimmt sie noch auf', st2 == 'recording', st2)
        await pg.click('#foot1')
        for k in range(120):
            if await pg.evaluate("Looper.debug().tracks[1].state") != 'recording': break
            await pg.wait_for_timeout(100)
        r2 = await pg.evaluate("(()=>{const d=Looper.debug();return {L:d.tracks[1].L/d.baseL,st:d.tracks[1].state}})()")
        check('Spur 2: Länge = 2 Loop-Runden (bis zum Stopp aufgerundet)', abs(r2['L'] - 2) < 0.01, r2)
        # Powerchords-Übung → Looper
        await open_tab(pg, 'power'); await pg.wait_for_timeout(600)
        await pg.evaluate("Powerchords.build && Powerchords.build(); Powerchords.startEx('ex4'); 0"); await pg.wait_for_timeout(800)
        s = await pg.evaluate("({sel:document.getElementById('loopBars').value,pref:localStorage.getItem('3nps-bars'),p:Powerchords.playing()})")
        check('Übe-Loop (4 Akkorde): Länge vorübergehend 4 Takte, gespeichert bleibt „Frei“', s['p'] and s['sel'] == '4' and s['pref'] == 'free', s)
        await record_long(pg, 'Nach Powerchords-Übung')
        check('… danach steht die Länge wieder auf „Frei“', await pg.evaluate("document.getElementById('loopBars').value") == 'free')
        # Kurs „▶ Loop starten“
        await open_tab(pg, 'power'); await pg.wait_for_timeout(300)
        await pg.evaluate("PcKurs.loopNow(['C','Am','F','G'], 90); 0"); await pg.wait_for_timeout(800)
        check('Kurs-Loop läuft, gespeichert bleibt „Frei“', await pg.evaluate("!!Powerchords.playing() && localStorage.getItem('3nps-bars')==='free'"))
        await record_long(pg, 'Nach Kurs-Loop')
        # Begleit-Track im Kurs (Knopf), sonst gleicher Weg über begin()
        await open_tab(pg, 'power'); await pg.wait_for_timeout(300)
        await pg.evaluate("Powerchords.showSec('kurs'); 0"); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelectorAll('details[id^=pcKC]').forEach(d=>d.open=true); 0"); await pg.wait_for_timeout(1200)
        bt = await pg.evaluate("(()=>{const b=document.querySelector('button[data-k=bt]');if(b){b.click();return b.closest('.pc-kbt').querySelector('b').textContent}return false})()")
        print('  Begleit-Track:', bt)
        await pg.wait_for_timeout(800)
        if bt: check('Begleit-Track läuft, gespeichert bleibt „Frei“', await pg.evaluate("!!Powerchords.playing() && localStorage.getItem('3nps-bars')==='free'"))
        else: print('  (kein Begleit-Track-Knopf sichtbar – Kurs-Weg oben deckt begin() ab)')
        # Improvisation öffnen, dann Aufnahme
        await open_tab(pg, 'solo'); await pg.wait_for_timeout(600)
        await record_long(pg, 'Nach Begleit-Track + Improvisation')
        # Neustart: weiterhin frei; eigene Wahl wird weiter gespeichert
        await pg.goto(U); await pg.wait_for_timeout(800)
        check('Nach Neustart: „Frei“', await pg.evaluate("document.getElementById('loopBars').value") == 'free')
        await pg.click('#tab-looper'); await pg.select_option('#loopBars', '8'); await pg.goto(U); await pg.wait_for_timeout(800)
        check('Selbst gewählte Länge (8 Takte) bleibt gespeichert (Rücksetzung nur einmal)', await pg.evaluate("document.getElementById('loopBars').value") == '8')
        await pg.click('#tab-looper'); await pg.select_option('#loopBars', 'free')
        await pg.evaluate("Looper.stopAll(); Looper.clearAll(); 0")
        # ---- Akkordleiste: Name auch in der Mitte, Countdown ----
        await setbpm(pg, 160)
        await pg.evaluate("Jam.setSeq('Cm:8 G:2 Eb F')"); await open_tab(pg, 'jam'); await pg.evaluate("Jam.start()"); await pg.wait_for_timeout(800)
        await open_tab(pg, 'solo'); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#sfZoom [data-z=\"4\"]').click()"); await pg.wait_for_timeout(500)
        G = """(()=>{const on=document.querySelector('#sfStrip .sf-seg.on');if(!on||!on.classList.contains('long'))return null;const m=on.querySelector('.sf-sm'),S=on.getBoundingClientRect();
          if(!m)return {mid:null};const M=m.getBoundingClientRect();return {mid:m.querySelector('b').textContent,dc:Math.round((M.left+M.width/2)-(S.left+S.width/2)),
          l:on.querySelector('.sf-sl b').textContent,r:on.querySelector('.sf-sr b').textContent,nx:on.querySelector('.sf-nx').textContent,cd:on.querySelector('.sf-cd').textContent,
          h:Math.round(S.height),bh:Math.round(document.getElementById('sfBand').getBoundingClientRect().height)}})()"""
        sm = []
        for k in range(30):
            await pg.wait_for_timeout(100); g = await pg.evaluate(G)
            if g: sm.append(g)
        check('Langer Block: Name in der Mitte (wie früher) + links/rechts am Rand', sm and all(s['mid'] == 'Cm' == s['l'] == s['r'] for s in sm), sm[:1])
        check('Mitte bleibt mittig im Block (springt nicht)', sm and all(abs(s['dc']) <= 2 for s in sm), sorted({s['dc'] for s in sm}))
        check('Countdown deutsch „noch n Takte“, „→ G“', sm and all(re.match(r'^noch \d+ Takte?$', s['cd']) and s['nx'] == '→ G' for s in sm), sorted({s['cd'] for s in sm}))
        check('Nichts springt: Höhen konstant', len({(s['h'], s['bh']) for s in sm}) == 1, {(s['h'], s['bh']) for s in sm})
        await pg.evaluate("Jam.stop()")
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(800)
        await pg.evaluate("Jam.setSeq('Cm:8 G:2 Eb F')"); await open_tab(pg, 'jam'); await pg.evaluate("Jam.start()"); await pg.wait_for_timeout(600)
        await open_tab(pg, 'solo'); await pg.wait_for_timeout(1200)
        g = await pg.evaluate(G)
        check('EN: Countdown „n bars left“, Mitte sichtbar', g and g['mid'] == 'Cm' and re.match(r'^\d+ bars? left$', g['cd'] or ''), g)
        await pg.evaluate("Jam.stop()")
        await pg.screenshot(path='/tmp/v135leiste.png')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'\n{ok}/{tot}')
asyncio.run(main())
