import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
PATCH = r"""(() => { window.__cb = []; const f = AudioContext.prototype.createBuffer; AudioContext.prototype.createBuffer = function (c, n, sr) { window.__cb.push([c, n, Math.round(c * n * 4 / 1048576)]); return f.call(this, c, n, sr); }; })();"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, has_touch=True)
        pg = await ctx.new_page(); await pg.add_init_script(PATCH)
        cdp = await ctx.new_cdp_session(pg)
        async def mem(tag, wait=0):
            if wait: await pg.wait_for_timeout(wait)
            await pg.evaluate('gc()'); h = await cdp.send('Runtime.getHeapUsage')
            print(f"{tag:34s} {h.get('backingStorageSize', 0) / 1048576:7.1f} MB | createBuffer bisher: {len(await pg.evaluate('__cb'))}")
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper')
        await pg.set_input_files('#file0', T + 'stereo/long_song_st.wav')
        for _ in range(120):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        await mem('geladen', 1500)
        wb = await (await pg.query_selector('#wave0')).bounding_box()
        for k in range(12):
            await pg.touchscreen.tap(wb['x'] + wb['width'] * (0.1 + 0.07 * k), wb['y'] + wb['height'] / 2); await pg.wait_for_timeout(40)
        await mem('12× getippt (sofort)')
        await mem('12× getippt (+3 s)', 3000)
        print(await pg.evaluate('__cb'))
        await b.close()
asyncio.run(main())
