import asyncio
from playwright.async_api import async_playwright
SP = '/tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=/home/claude/3nps/test/hard/h_bluesrock_124.wav', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.click('#loopMonitor'); await pg.wait_for_timeout(2500)
        box = await pg.locator('.meter-field').bounding_box()
        for i in range(3):
            await pg.wait_for_timeout(350)
            await pg.screenshot(path=SP + f'flame{i}.png', clip={'x': box['x'] - 10, 'y': box['y'] - 20, 'width': box['width'] + 20, 'height': box['height'] + 30})
        # Drones 5 und 6 kurz anwerfen
        for st in ['v5', 'v6']:
            await pg.select_option('#laneDroneStyle', st); await pg.wait_for_timeout(200)
            await pg.click('#laneDrone'); await pg.wait_for_timeout(7000)
            print(st, await pg.inner_text('#laneDroneStatus'))
            await pg.evaluate("rootSel.value='D'; rootSel.dispatchEvent(new Event('change'))"); await pg.wait_for_timeout(500)
            await pg.click('#laneDrone'); await pg.wait_for_timeout(1600)
        await pg.click('#meterStyle [data-v="bar"]'); await pg.wait_for_timeout(500)
        print('Balken', await pg.evaluate("document.getElementById('loopMeter').style.width"), 'Flammen-Canvas versteckt', await pg.evaluate("document.getElementById('loopFlame').hidden"))
        await pg.click('#meterStyle [data-v="fire"]')
        print('Fehler', errs)
        await b.close()
asyncio.run(main())
