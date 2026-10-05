import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}, has_touch=True)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.select_option('#loopBars', 'free')
        await pg.click('#foot0'); await pg.wait_for_timeout(4200); await pg.click('#foot0'); await pg.wait_for_timeout(800)
        d = await pg.evaluate('Looper.debug()'); print('nach Aufnahme', d['tracks'][0], 'bpm', d['bpm'])
        print('edit disabled?', await pg.is_disabled('#edit0'), 'foot', await pg.get_attribute('#foot0', 'data-state'))
        await pg.click('#edit0'); await pg.wait_for_timeout(500)
        print('editor hidden?', await pg.is_hidden('#loopEditor') if await pg.query_selector('#loopEditor') else 'kein #loopEditor', 'errs', errs)
        await pg.evaluate("document.getElementById('edWave').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
        box = await pg.locator('#edWave').bounding_box(); y = box['y'] + box['height'] / 2
        await pg.mouse.move(box['x'] + 5, y); await pg.mouse.down(); await pg.mouse.move(box['x'] + box['width'] * 0.3, y, steps=5); await pg.mouse.up()
        print('info', await pg.inner_text('#edInfo'), 'trim disabled', await pg.is_disabled('#edTrim'))
        await pg.click('#edTrim'); await pg.wait_for_timeout(300)
        d = await pg.evaluate('Looper.debug()'); print('nach Schnitt', d['tracks'][0]['L'], await pg.inner_text('#loopStatus'))
        for bid in ['edCheck', 'edKeyBtn', 'edTake']:
            if await pg.query_selector('#' + bid):
                try: await pg.click('#' + bid, timeout=2000); await pg.wait_for_timeout(1500); print(bid, 'ok', await pg.inner_text('#loopStatus'))
                except Exception as e: print(bid, 'Fehler', str(e)[:80])
        print('errs', errs)
        await b.close()
asyncio.run(main())
