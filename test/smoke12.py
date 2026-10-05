import asyncio, sys
from playwright.async_api import async_playwright
SP = '/tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}, device_scale_factor=1)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        print('presets', await pg.evaluate("[...document.querySelectorAll('#loopDrumStyle option')].length"))
        await pg.click('#drumEditBtn'); await pg.click('#loopDrums'); await pg.wait_for_timeout(1500)
        print('lit cells', await pg.evaluate("document.querySelectorAll('.dg-cell.now').length"))
        await pg.click('.dg-cell[data-i="clap"][data-k="4"]'); await pg.wait_for_timeout(200)
        print('style after edit', await pg.input_value('#loopDrumStyle'))
        await pg.select_option('#loopDrumStyle', 'shuffle'); await pg.wait_for_timeout(800)
        await pg.click('#laneDrone'); await pg.wait_for_timeout(1200)
        print('drone', await pg.evaluate('droneOn'), await pg.inner_text('#laneDroneStatus'))
        await pg.select_option('#laneDroneRoot', 'D'); await pg.select_option('#laneDroneMode', 'Äolisch (Moll)'); await pg.wait_for_timeout(300)
        print('drone key', await pg.inner_text('#laneDroneStatus'), '| main:', await pg.inner_text('#droneStatus'))
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        print('mic-on', await pg.evaluate("document.getElementById('panel-looper').classList.contains('mic-on')"), await pg.evaluate("getComputedStyle(document.getElementById('tmeter0')).getPropertyValue('--lv')"))
        await pg.evaluate("document.querySelector('.looper-card').scrollIntoView()"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=SP + 'v12_looper.jpg', type='jpeg', quality=60, full_page=False)
        await pg.click('#laneDrone'); await pg.wait_for_timeout(300); await pg.click('#loopDrums')
        print('errors', errs)
        await b.close()
asyncio.run(main())
