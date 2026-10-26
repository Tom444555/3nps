# v115: Editor mit Fingern – hängengebliebener Finger (kein pointerup, wie auf dem iPad) macht aus einem Finger kein Zoomen mehr;
# Tippen in die Zeitleiste springt; ein Finger zieht die Auswahl; zwei Finger zoomen weiterhin
import asyncio, sys
from playwright.async_api import async_playwright
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
EV = """(([type, id, prim, fx, fy]) => { const g = document.getElementById('edWave'), r = g.getBoundingClientRect();
  g.parentNode.dispatchEvent(new PointerEvent(type, { pointerId: id, isPrimary: prim, pointerType: 'touch', clientX: r.left + r.width * fx, clientY: r.top + fy, bubbles: true, cancelable: true })); })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 820}, has_touch=True)).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(900)
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        await pg.evaluate("(sr=>{const l=new Float32Array(sr*8).map((_, i)=>Math.sin(i/20)*0.3*((i%%sr)<sr/4?1:0.1)); Looper._setTrackRaw(0,l); const se=Looper.getSession(); se.baseL=se.tracks[0].L; Looper.loadSession(se)})(%d)" % sr)
        await pg.wait_for_timeout(500); await pg.evaluate("document.querySelector('.track.t1').scrollIntoView({block:'center'})"); await pg.click('#edit0'); await pg.wait_for_timeout(1200)
        st = lambda: pg.evaluate("Looper._ed()")
        e0 = await st()
        # Finger 1 berührt und „verschwindet“ ohne pointerup (iPad-Fall)
        await pg.evaluate(EV, ['pointerdown', 11, True, 0.5, 80])
        # neue Berührung mit einem Finger: Auswahl-Griff ziehen, nicht zoomen
        await pg.evaluate(EV, ['pointerdown', 12, True, 0.30, 80]); await pg.evaluate(EV, ['pointermove', 12, True, 0.25, 80]); await pg.evaluate(EV, ['pointerup', 12, True, 0.25, 80])
        e1 = await st()
        check('ein Finger nach hängendem Finger: Auswahl statt Zoom', e1['zoom'] == e0['zoom'] and abs(e1['s'] - 0.25 * e0['L']) < e0['L'] * 0.08, (e0['zoom'], e1['zoom'], e1['s'], e0['L']))
        # Tippen in die Zeitleiste oben springt
        bar = lambda t: int(t['text'].split('.')[0]) * 10 + int(t['text'].split('.')[1])
        await pg.evaluate(EV, ['pointerdown', 13, True, 0.05, 10]); await pg.evaluate(EV, ['pointerup', 13, True, 0.05, 10]); await pg.wait_for_timeout(120); a = await pg.evaluate("Looper.position()")
        await pg.evaluate(EV, ['pointerdown', 14, True, 0.9, 10]); await pg.evaluate(EV, ['pointerup', 14, True, 0.9, 10]); await pg.wait_for_timeout(120); c = await pg.evaluate("Looper.position()")
        check('Tippen oben in die Zeitleiste springt (vorn → hinten)', a and c and bar(a) <= 12 and bar(c) > bar(a) + 10, (a, c))
        # zwei Finger zoomen
        await pg.evaluate(EV, ['pointerdown', 21, True, 0.4, 80]); await pg.evaluate(EV, ['pointerdown', 22, False, 0.6, 80])
        await pg.evaluate(EV, ['pointermove', 22, False, 0.9, 80]); await pg.evaluate(EV, ['pointerup', 22, False, 0.9, 80]); await pg.evaluate(EV, ['pointerup', 21, True, 0.4, 80])
        e2 = await st()
        check('zwei Finger zoomen weiterhin', e2['zoom'] > e1['zoom'] * 1.5, (e1['zoom'], e2['zoom']))
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
