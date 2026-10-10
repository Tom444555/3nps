# v47: Eingang bleibt offen – still beendetes Mikrofon wird erkannt und von selbst wieder geöffnet; Reiterwechsel lässt ihn offen
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
S = "[Looper.debug().mic, document.getElementById('loopMonitor').textContent]"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
        check('Eingang offen', (await pg.evaluate(S))[0])
        for tab in ['quinten', 'solo', 'jam', 'lied', 'ueben', 'griffbrett', 'looper']:
            await pg.click('#tab-' + tab); await pg.wait_for_timeout(300)
        check('Nach allen Reitern noch offen', (await pg.evaluate(S))[0])
        await pg.evaluate("Looper._micKill()"); await pg.wait_for_timeout(800)
        check('Still beendet: zunächst noch „offen“ angezeigt', (await pg.evaluate(S))[0])
        await pg.wait_for_timeout(4500)
        s = await pg.evaluate(S); evs = await pg.evaluate("window.__appEv.map(e=>e[1]).slice(-4)")
        check('Erkannt und von selbst wieder geöffnet', s[0] and any('Eingang zu (beendet)' in e for e in evs) and evs[-1] == 'Eingang offen', (s, evs))
        lv = await pg.evaluate("Looper.debug().level")
        check('Pegel kommt wieder an', lv > 0.001, lv)
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
