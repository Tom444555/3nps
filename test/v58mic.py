# v58: Eingang per Knopf wieder schließen – bleibt zu (Wächter, Tippen, Rückkehr), REC öffnet neu, während Aufnahme gesperrt
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
HID = "window.__hid=false; Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hid});"
ST = "[Looper.debug().mic, document.getElementById('loopMonitor').textContent, (document.getElementById('loopStatus')||{}).textContent||'', document.getElementById('inDevName').textContent]"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(HID)
        await pg.goto(U); await pg.wait_for_timeout(500)
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        s = await pg.evaluate(ST); check('Eingang offen', s[0] and s[1] == 'Eingang offen', s[:2])
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(300)
        s = await pg.evaluate(ST); check('zweites Tippen schließt', not s[0] and s[1] == 'Eingang öffnen' and 'geschlossen' in s[2], s)
        check('Geräteanzeige: kein Eingang', s[3] == 'Kein Eingang offen', s[3])
        await pg.wait_for_timeout(4500)
        s = await pg.evaluate(ST); check('Wächter öffnet nicht neu (4,5 s)', not s[0], s[:2])
        await pg.mouse.click(600, 700); await pg.wait_for_timeout(800)
        s = await pg.evaluate(ST); check('Tippen daneben öffnet nicht neu', not s[0], s[:2])
        await pg.evaluate("window.__hid=true; document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__hid=false; document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(1200)
        s = await pg.evaluate(ST); check('Rückkehr aus Hintergrund öffnet nicht neu', not s[0], s[:2])
        await pg.evaluate("Looper.foot(0)"); await pg.wait_for_timeout(1500)
        s = await pg.evaluate(ST); check('REC öffnet den Eingang wieder', s[0] and s[1] == 'Eingang offen', s[:2])
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(300)
        s = await pg.evaluate(ST); check('während Aufnahme nicht schließbar', s[0] and 'Aufnahme' in s[2], s)
        await pg.wait_for_timeout(1500); await pg.evaluate("Looper.foot(0)"); 
        for _ in range(30):
            if await pg.evaluate("Looper.debug().tracks[0].state") != 'recording': break
            await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(500)
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(300)
        s = await pg.evaluate(ST); check('nach Aufnahme schließbar, Spur bleibt', not s[0] and await pg.evaluate("Looper.debug().tracks[0].state") in ('playing','stopped','overdub','paused'), s[:2])
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
