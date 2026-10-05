import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.set_input_files('#file0', T + 'loops/rock_120_2T.wav'); await pg.wait_for_timeout(3500)
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        print('Mikro offen', (await pg.evaluate('Looper.debug()'))['mic'])
        await pg.evaluate('Looper._micDrop()'); await pg.wait_for_timeout(300)
        print('nach Abbruch', (await pg.evaluate('Looper.debug()'))['mic'], '|', await pg.inner_text('#loopStatus'))
        await pg.wait_for_timeout(2500)
        print('wieder offen', (await pg.evaluate('Looper.debug()'))['mic'], '|', await pg.inner_text('#loopStatus'))
        await pg.evaluate('audioCtx.suspend()'); await pg.wait_for_timeout(1200)
        print('Kontext nach Unterbrechung', await pg.evaluate('audioCtx.state'), '| Spur', (await pg.evaluate('Looper.debug()'))['tracks'][0]['state'])
        await pg.evaluate("navigator.mediaDevices.dispatchEvent(new Event('devicechange'))"); await pg.wait_for_timeout(1500)
        print('nach devicechange', (await pg.evaluate('Looper.debug()'))['mic'])
        # Aufnahme danach geht
        await pg.click('#foot1'); await pg.wait_for_timeout(2000); await pg.click('#foot1'); await pg.wait_for_timeout(1500)
        print('Spur 2 nach Wiederverbinden', (await pg.evaluate('Looper.debug()'))['tracks'][1]['state'])
        print('Fehler', errs)
        await b.close()
asyncio.run(main())
