# v48: Pause am Anfang der ersten Aufnahme wird weggenommen (erster Ton auf Takt 1), ohne hörbaren Sprung; aus mit Drums/Schalter
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
async def take(pg, wait_before=0.6, dur=2300):
    await pg.wait_for_timeout(int(wait_before * 1000))
    await pg.evaluate("Looper.foot(0)"); await pg.wait_for_timeout(dur); await pg.evaluate("Looper.foot(0)")
    await pg.wait_for_timeout(4200)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        errs = []
        # 1) Standard: Pause wird weggenommen
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.select_option('#loopCountIn', '0'); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        check('Schalter standardmäßig an', await pg.is_checked('#loopLeadFix'))
        # Aufnahme so starten, dass sie kurz nach einem Piepton beginnt → Pause am Anfang
        await pg.evaluate("new Promise(r=>{const t0=performance.now(); let hot=false; const iv=setInterval(()=>{const l=Looper.debug().level; if(l>0.05) hot=true; else if(hot&&l<0.004){clearInterval(iv);r()} if(performance.now()-t0>4000){clearInterval(iv);r()}},5)})")
        await take(pg, 0.0)
        sr = await pg.evaluate("audioCtx.sampleRate")
        ft = await pg.evaluate("Looper._firstTone(0)"); st = await pg.inner_text('#loopStatus')
        L = await pg.evaluate("Looper.debug().tracks[0].L")
        check('Erster Ton jetzt am Loopanfang', ft is not None and abs(ft) < 0.015 * sr, (ft, round((ft or 0) / sr * 1000)))
        check('Meldung mit weggenommener Pause', 'Pause am Anfang weggenommen' in st, st[:80])
        check('Spur spielt', await pg.evaluate("Looper.debug().tracks[0].state") == 'playing')
        await pg.click('#undo0'); await pg.wait_for_timeout(300)
        ft2 = await pg.evaluate("Looper._firstTone(0)")
        check('↶ stellt die Pause wieder her', ft2 is not None and ft2 > 0.04 * sr, round(ft2 / sr * 1000))
        await pg.close()
        # 2) Schalter aus: keine Änderung
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.select_option('#loopCountIn', '0'); await pg.click('#loopLeadFix'); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        await pg.evaluate("new Promise(r=>{const t0=performance.now(); let hot=false; const iv=setInterval(()=>{const l=Looper.debug().level; if(l>0.05) hot=true; else if(hot&&l<0.004){clearInterval(iv);r()} if(performance.now()-t0>4000){clearInterval(iv);r()}},5)})")
        await take(pg, 0.0)
        ft = await pg.evaluate("Looper._firstTone(0)"); st = await pg.inner_text('#loopStatus')
        check('Schalter aus: Pause bleibt', ft is not None and ft > 0.04 * sr and 'Pause am Anfang' not in st, round(ft / sr * 1000))
        check('Schalter-Zustand gespeichert', await pg.evaluate("localStorage.getItem('3nps-leadfix')") == '0')
        await pg.evaluate("localStorage.setItem('3nps-leadfix','1')"); await pg.close()
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
