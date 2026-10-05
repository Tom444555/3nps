# Aufnahme über einen Mono-Eingang (wie Safari auf dem iPad): wird einmal gespeichert, Anzeige „mono“
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=/home/claude/3nps/test/corpus/rock_120.wav', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.select_option('#loopBars', '2')
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        await pg.click('#foot0'); await pg.wait_for_timeout(int((2 * 240 / 80 + 1.5) * 1000))
        r = await pg.evaluate('Looper._stereo(0)')
        print('Aufnahme', {k: r[k] for k in ('L', 'shared', 'layers', 'inInfo')}, '| Kennzeichen', await pg.inner_text('#chb0'), '| Fehler', errs)
        await b.close()
asyncio.run(main())
