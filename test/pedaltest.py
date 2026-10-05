import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        print('Belegung', await pg.input_value('#pedalPreset'))
        st = lambda i: pg.get_attribute(f'#foot{i}', 'data-state')
        await pg.keyboard.press('PageUp'); await pg.wait_for_timeout(2500)
        print('PageUp →', await st(0), '|', await pg.inner_text('#pedalLast'))
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(1200)
        print('ArrowUp →', await st(0), '|', await pg.inner_text('#pedalLast'))
        await pg.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key: 'UIKeyInputDownArrow', keyCode: 40, bubbles: true}))"); await pg.wait_for_timeout(2500)
        print('UIKeyInputDownArrow →', await st(1), '|', await pg.inner_text('#pedalLast'))
        await pg.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key: 'UIKeyInputDownArrow', keyCode: 40})); window.dispatchEvent(new KeyboardEvent('keyup', {key: 'UIKeyInputDownArrow', keyCode: 40}))"); await pg.wait_for_timeout(800)
        print('nochmal ↓ →', await st(1))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        print('Enter (Alle) →', [await st(i) for i in range(3)], '|', await pg.inner_text('#pedalLast'))
        await pg.keyboard.press('x'); print('x →', await pg.inner_text('#pedalLast'))
        print('Fehler', errs)
        await b.close()
asyncio.run(main())
