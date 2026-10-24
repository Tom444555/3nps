# v100: alle echten Kits laden und spielen (inkl. 6 neue), Instrument ohne Aufnahme fällt auf Synthese zurück
import asyncio, json
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(1000)
        kits = await pg.evaluate("[...document.querySelectorAll('#drumKitSel option')].map(o=>o.value)")
        check('9 echte Kits + Synthese in der Auswahl', len(kits) == 10, kits)
        await pg.select_option('#loopDrumStyle', 'funk'); await pg.click('#loopDrums')
        for k in kits[1:]:
            await pg.select_option('#drumKitSel', k)
            for _ in range(80):
                await pg.wait_for_timeout(200)
                if await pg.evaluate("Rhythm.kitName()") == k: break
            await pg.wait_for_timeout(1200); d = await pg.evaluate("Rhythm.debug()")
            check('Kit „%s“ geladen, spielt, keine verspäteten Schläge' % k, await pg.evaluate("Rhythm.kitName()") == k and d['on'] and d['late'] == 0, d['late'])
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
