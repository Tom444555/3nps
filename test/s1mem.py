# Studio S1: 16 Spuren × 60 s – Speicher (JS-Heap), Hauptthread und gleichmäßiges Abspielen
import asyncio, sys
from playwright.async_api import async_playwright
S = 'http://localhost:8765/studio/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'])
        pg = await (await b.new_context(viewport={'width': 1366, 'height': 1024}, bypass_csp=True)).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(S); await pg.wait_for_timeout(1200)
        t = await pg.evaluate("""(async () => { const t0 = performance.now(), sr = Engine.sr(), n = sr * 60;
          for (let k = 0; k < 16; k++) { const w = SDB.writer('Spur ' + (k + 1), sr, true), B = 65536;
            for (let a = 0; a < n; a += B) { const m = Math.min(B, n - a), l = new Float32Array(m), r = new Float32Array(m); for (let i = 0; i < m; i++) { const x = Math.sin((a + i) * 0.01 * (k + 1)) * 0.05; l[i] = x; r[i] = x * 0.8; } await w.push(l, r); }
            const meta = await w.done(); Proj.change('regions', q => { const t = Proj.track('audio', 'Spur ' + (k + 1)); q.tracks.push(t); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: meta.id, start: 0, offset: 0, len: meta.frames, gain: 0, fi: 0, fo: 0, name: 'T' + k }); }); }
          Engine.dirty(true); Arr.heads(); Arr.zoomAll(); UI.show('arr'); return performance.now() - t0; })()""")
        check('16 Spuren × 60 s angelegt', await pg.evaluate("Proj.P.tracks.length") == 16, '%.1f s' % (t / 1000))
        await pg.evaluate("gc && gc()"); h0 = await pg.evaluate("performance.memory.usedJSHeapSize/1048576")
        await pg.evaluate("window.__w0=performance.now(); window.__lf=0; window.__fr=0; (function m(){const n=performance.now(); if(window.__lp && n-window.__lp>50) window.__lf++; window.__fr++; window.__lp=n; if(window.__fr<100000) requestAnimationFrame(m)})()")
        t0 = await pg.evaluate("(async()=>{const t=performance.now(); await Engine.play(); return performance.now()-t})()")
        check('Start nach Tippen auf ▶ schnell (< 400 ms)', t0 < 400, '%.0f ms' % t0); UI_ = await pg.evaluate("UI.sync()"); await pg.wait_for_timeout(600)
        p0 = await pg.evaluate("[Engine.st.wpos, Engine.st.wcf/Engine.sr()*1000]")
        await pg.wait_for_timeout(12000)
        p1 = await pg.evaluate("[Engine.st.wpos, Engine.st.wcf/Engine.sr()*1000]")
        sr = await pg.evaluate("Engine.sr()")
        rate = (p1[0] - p0[0]) / sr / ((p1[1] - p0[1]) / 1000)
        check('Abspielen gleichmäßig (Echtzeit)', abs(rate - 1) < 0.03, round(rate, 3))
        lv = await pg.evaluate("Array.from({length:16},(_, i)=>Engine.level(i))")
        check('alle 16 Spuren klingen', min(lv) > 0.01, [round(x, 3) for x in lv])
        await pg.evaluate("gc && gc()"); h1 = await pg.evaluate("performance.memory.usedJSHeapSize/1048576")
        check('JS-Speicher beim Abspielen klein (< 80 MB)', h1 < 80, '%.0f → %.0f MB' % (h0, h1))
        lf = await pg.evaluate("[window.__lf, window.__fr]")
        check('Hauptthread ruhig (Ruckler < 3 %)', lf[0] < lf[1] * 0.03, lf)
        await pg.click('#bPlay')
        u = await pg.evaluate("SDB.usage()"); check('Gerätespeicher ~ 16 × 10 MB', u / 1048576 < 200, '%.0f MB' % (u / 1048576))
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
