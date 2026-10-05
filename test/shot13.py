import asyncio
from playwright.async_api import async_playwright
SP = '/tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366})
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        await pg.set_input_files('#file0', '/home/claude/3nps/test/loops/shuffle_88_2T.wav'); await pg.wait_for_timeout(5000)
        await pg.click('#edClose'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SP + 'v13_look.jpg', type='jpeg', quality=60)
        await b.close()
asyncio.run(main())
