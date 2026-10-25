# v109: Studio – Wellenform scharf (Geräte-Pixel, echte Abtastwerte beim Zoomen), Spurhöhe, Takte loopen, „↩ Looper“ immer da
import asyncio, sys, re
from playwright.async_api import async_playwright
S = 'http://localhost:8765/studio/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1366, 'height': 1024}, device_scale_factor=2, bypass_csp=True)).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(S); await pg.wait_for_timeout(1200)
        await pg.evaluate("""(async () => { const sr = Engine.sr(), n = sr * 8, l = new Float32Array(n); for (let i = 0; i < n; i++) l[i] = Math.sin(i * 2 * Math.PI * 110 / sr) * 0.7 * (i % sr < sr / 2 ? 1 : 0.2);
          const m = await SDB.putAudio('Sinus', sr, l, null); Proj.change('regions', q => { const t = Proj.track('audio', 'Sinus'); q.tracks.push(t); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: m.id, start: 0, offset: 0, len: n, gain: 0, fi: 0, fo: 0, name: 'Sinus' }); }); Engine.dirty(true); UI.show('arr'); Arr.heads(); Arr.zoomAll(); })()""")
        await pg.wait_for_timeout(600)
        check('neue Übersicht feiner (128 Bilder)', await pg.evaluate("SDB.meta(Proj.P.regions[0].audio).then(m=>m.pk)") == 128)
        check('„↩ Looper“ immer sichtbar', await pg.is_visible('#bBack'))
        h0 = await pg.evaluate("Arr.V.th"); await pg.click('#tTh1'); await pg.click('#tTh1'); h1 = await pg.evaluate("Arr.V.th")
        check('Spurhöhe größer (↕+)', h1 > h0 * 1.7 and await pg.evaluate("document.querySelector('.th').offsetHeight") == h1, (h0, h1))
        # tief hineinzoomen: Wellenform zeigt echte Schwingung (Linie), bleibt scharf
        await pg.evaluate("Arr.V.fpp = 0.5; Arr.V.x0 = 1000; Arr.kick()"); await pg.wait_for_timeout(700)
        await pg.locator('#lanes').screenshot(path='/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/wave-zoom.png')
        # Pixel einer Spalte: dunkle Linie quer über die Höhe verteilt (Sinus) statt Block
        col = await pg.evaluate("""(() => { const cv = document.getElementById('cv'), c = cv.getContext('2d'), dpr = devicePixelRatio, y0 = Math.round((34 + 5 + 14) * dpr), hh = Math.round((Arr.V.th - 26) * dpr);
          const img = c.getImageData(0, y0, cv.width, hh).data, w = cv.width; let rows = new Set(); for (let x = 0; x < w; x += 7) for (let y = 0; y < hh; y++) { const i = (y * w + x) * 4; if (img[i] < 90 && img[i+1] < 90) { rows.add(y); } } return rows.size / hh; })()""")
        check('nah: echte Schwingung über die ganze Höhe gezeichnet', col > 0.6, round(col, 2))
        await pg.evaluate("Arr.V.fpp = 30; Arr.V.x0 = 0; Arr.kick()"); await pg.wait_for_timeout(700)
        await pg.locator('#lanes').screenshot(path='/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/wave-mid.png')
        # Takte loopen
        await pg.click('#tLoop'); box = await pg.locator('#lanes').bounding_box()
        await pg.evaluate("Arr.zoomAll()"); await pg.wait_for_timeout(300)
        xa = await pg.evaluate("Arr.fx(Proj.bar()*0.5)"); xb = await pg.evaluate("Arr.fx(Proj.bar()*2.5)"); y = 34 + 30
        await pg.mouse.move(box['x'] + xa, box['y'] + y); await pg.mouse.down(); await pg.mouse.move(box['x'] + xb, box['y'] + y, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(200)
        cy = await pg.evaluate("(()=>{const c=Proj.P.cycle,b=Proj.bar();return [c.on, c.a/b, c.b/b]})()")
        check('Takte loopen: Takt 1–3 per Ziehen, Loop an', cy == [True, 0, 3], cy)
        check('Region wurde dabei nicht verschoben', await pg.evaluate("Proj.P.regions[0].start") == 0)
        await pg.click('#bPlay'); await pg.wait_for_timeout(300); await pg.evaluate("Engine.seek(Proj.bar()*2.9)"); await pg.wait_for_timeout(600)
        pos = await pg.evaluate("Engine.curPos()/Proj.bar()"); await pg.click('#bPlay')
        check('spielt in Schleife (springt zurück auf Takt 1)', pos < 1, round(pos, 2))
        await pg.click('#tLoop')
        # zurück zum Looper ohne Idee
        await pg.click('#bBack'); await pg.wait_for_url(re.compile(r'.*:8765/$'), timeout=10000)
        check('„↩ Looper“ öffnet den Looper', '3nps' in await pg.inner_text('.brand'))
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
