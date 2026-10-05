import asyncio, sys
from playwright.async_api import async_playwright
SP = '/tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/'
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and 'ERR_TUNNEL' not in m.text and errs.append('console: ' + m.text))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        print('presets', await pg.evaluate("[...document.querySelectorAll('#loopDrumStyle option')].length"))
        if await pg.is_hidden('#drumDesigner'): await pg.click('#drumEditBtn')
        await pg.select_option('#loopDrumStyle', 'shuffle_tx'); await pg.click('#loopDrums'); await pg.wait_for_timeout(2500)
        d = await pg.evaluate('Rhythm.debug()'); print('rhythm', {k: d[k] for k in ['on', 'res', 'kit', 'preset']}, 'lit', await pg.evaluate("document.querySelectorAll('.dg-cell.now').length"))
        await pg.click('.dg-cell[data-i="snare"][data-k="5"]'); await pg.click('.dg-cell[data-i="snare"][data-k="5"]'); await pg.click('.dg-cell[data-i="snare"][data-k="5"]')
        print('ghost', await pg.get_attribute('.dg-cell[data-i="snare"][data-k="5"]', 'data-v'), await pg.input_value('#loopDrumStyle'))
        await pg.select_option('#drumRes', '16'); await pg.select_option('#drumFills', '4'); await pg.wait_for_timeout(1500)
        # Begleitung: Lane wandert mit
        await pg.click('#tab-griffbrett'); await pg.wait_for_timeout(300)
        print('lane in begleitung', await pg.evaluate("!!document.querySelector('#beglDrumsHome .lane-drums')"))
        await pg.click('#btnBass'); await pg.wait_for_timeout(1500)
        for st in ['v3', 'v4', 'v1']:
            await pg.select_option('#droneStyle', st); await pg.wait_for_timeout(200)
            if not await pg.evaluate('droneOn'): await pg.click('#droneBtn')
            await pg.wait_for_timeout(2500)
            await pg.evaluate("rootSel.value='E'; rootSel.dispatchEvent(new Event('change'))"); await pg.wait_for_timeout(600)
            print(st, 'drone', await pg.evaluate('droneOn'), await pg.inner_text('#droneStatus'))
            await pg.click('#droneBtn'); await pg.wait_for_timeout(1600)
        await pg.screenshot(path=SP + 'v13_begl.jpg', type='jpeg', quality=55)
        await pg.click('#btnBass'); await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        print('lane back', await pg.evaluate("!!document.querySelector('#loopDrumsHome .lane-drums')"))
        # Datei mit Dialog
        await pg.set_input_files('#file0', T + 'corpus/rock_97_intro.wav'); await pg.wait_for_timeout(1500)
        print('dialog', await pg.is_visible('#impDlg'), await pg.inner_text('#impAna'))
        await pg.wait_for_timeout(2500); print('dialog ana', await pg.inner_text('#impAna'))
        await pg.check('#impDlg input[value="part"]'); await pg.select_option('#impFrom', '3'); await pg.select_option('#impBars', '4'); await pg.click('#impOk'); await pg.wait_for_timeout(1500)
        print('status', await pg.inner_text('#loopStatus'))
        await pg.click('#edZoomIn'); await pg.click('#edZoomIn'); await pg.wait_for_timeout(300); print('zoom', await pg.inner_text('#edZoomInfo'))
        await pg.click('#edPlayFrom'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('.looper-card').scrollIntoView()"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=SP + 'v13_looper.jpg', type='jpeg', quality=55, full_page=True)
        print('errors', errs)
        await b.close()
asyncio.run(main())
