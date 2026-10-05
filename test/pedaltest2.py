import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, has_touch=True, is_mobile=False)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.click('.looper-card h2')
        print('Fokus', await pg.evaluate('document.activeElement.id'), '| Status', await pg.inner_text('#pedalRecvStat'))
        y0 = await pg.evaluate('scrollY')
        await pg.keyboard.press('PageDown'); await pg.wait_for_timeout(2500)
        print('PageDown → Spur 2', await pg.get_attribute('#foot1', 'data-state'), '| scroll', y0, '→', await pg.evaluate('scrollY'), '|', await pg.inner_text('#pedalLast'))
        # Anlernen
        await pg.select_option('#pedalPreset', 'custom'); await pg.wait_for_timeout(200)
        await pg.click('[data-learn="foot2"]')
        print('Fokus nach Anlernen-Tipp', await pg.evaluate('document.activeElement.id'))
        await pg.keyboard.press('PageUp'); await pg.wait_for_timeout(300)
        print('angelernt Spur 3 =', await pg.inner_text('#pedalMap'))
        await pg.keyboard.press('PageUp'); await pg.wait_for_timeout(2500)
        print('PageUp → Spur 3', await pg.get_attribute('#foot2', 'data-state'), '| Wert im Feld', repr(await pg.evaluate('pedalSink.value')))
        await pg.keyboard.type('xy'); print('Tippen →', repr(await pg.evaluate('pedalSink.value')))
        # Textfeld darf weiter normal funktionieren
        await pg.click('#ideaName'); await pg.keyboard.type('Riff'); print('Ideenname', await pg.input_value('#ideaName'), '| Fokus', await pg.evaluate('document.activeElement.id'))
        await pg.select_option('#pedalPreset', 'auto')
        print('Fehler', errs)
        await b.close()
asyncio.run(main())
