# v98: echtes Schlagzeug (CC0-Aufnahmen) als Option – laden, spielen, merken, Rückfall auf Synthese
import asyncio, re
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 860}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(1200)
        check('Version ≥ v98', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 98)
        check('Standard: Synthese', await pg.input_value('#drumKitSel') == 'synth' and await pg.evaluate("Rhythm.kitMode()") == 'synth')
        await pg.select_option('#drumKitSel', 'jazz')
        for _ in range(60):
            await pg.wait_for_timeout(200)
            if await pg.evaluate("Rhythm.kitMode()") == 'real': break
        check('echtes Kit geladen', await pg.evaluate("Rhythm.kitMode()") == 'real' and await pg.input_value('#drumKitSel') == 'jazz')
        await pg.click('#loopDrums'); await pg.wait_for_timeout(3000)
        d = await pg.evaluate("Rhythm.debug()")
        check('Drums spielen mit echtem Kit, keine verspäteten Schläge', d['on'] and d['real'] and len(d['steps']) > 4 and d['late'] == 0, {k: d[k] for k in ('on', 'real', 'late')})
        await pg.click('#loopDrums')
        await pg.reload(); await pg.wait_for_timeout(2500)
        check('Wahl bleibt nach Neustart (lädt von selbst)', await pg.evaluate("Rhythm.kitMode()") == 'real')
        await pg.select_option('#drumKitSel', 'synth'); check('zurück auf Synthese', await pg.evaluate("Rhythm.kitMode()") == 'synth')
        # Rückfall: Datei nicht erreichbar → bleibt Synthese, Hinweis im Titel
        pg2 = await ctx.new_page(); e2 = []; pg2.on('pageerror', lambda e: e2.append(str(e)))
        await pg2.route('**/drums/**', lambda r: r.abort())
        await pg2.goto(U + '?x=1'); await pg2.wait_for_timeout(800)
        await pg2.evaluate("localStorage.setItem('3nps-drumkit','synth')")
        await pg2.select_option('#drumKitSel', 'rock'); await pg2.wait_for_timeout(1500)
        t = await pg2.get_attribute('#drumKitSel', 'title')
        check('ohne Datei: Synthese spielt weiter, Hinweis', await pg2.evaluate("Rhythm.kitMode()") == 'synth' and 'nicht geladen' in t and await pg2.input_value('#drumKitSel') == 'synth', t)
        await pg2.click('#loopDrums'); await pg2.wait_for_timeout(1500); d2 = await pg2.evaluate("Rhythm.debug()")
        check('Drums laufen trotzdem (Synthese)', d2['on'] and not d2['real'] and len(d2['steps']) > 2)
        check('keine Skriptfehler', not errs and not e2, errs + e2)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
