# Speicherverbrauch und Doppeltippen während Aufnahme/Bearbeitung (Absturzsuche)
import asyncio, sys
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + T + 'stereo/mic_st.wav', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('crash', lambda: errs.append('CRASH'))
        cdp = await ctx.new_cdp_session(pg)
        async def mem(tag):
            await pg.evaluate('window.gc && gc()')
            h = await cdp.send('Runtime.getHeapUsage')
            mb = lambda v: round(v / 1048576, 1)
            print(f"{tag:42s} JS {mb(h['usedSize']):7.1f} MB | Audio-Daten (ArrayBuffer) {mb(h.get('backingStorageSize', 0)):7.1f} MB")
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await mem('Start')
        await pg.set_input_files('#file0', T + 'stereo/long_song_st.wav')
        for _ in range(120):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        await mem('3-min-Stereo-Song geladen')
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(800)
        bpm = (await pg.evaluate('Looper.debug()'))['bpm']; bar = 240 / bpm
        await pg.click('#foot1'); await pg.wait_for_timeout(int((bar * 4 + 0.3) * 1000)); await pg.click('#foot1'); await pg.wait_for_timeout(1500)
        await mem('Spur 2 aufgenommen (Loop = ganzer Song)')
        for k in range(3):
            await pg.click('#foot1'); await pg.wait_for_timeout(int((bar * 2 + 0.3) * 1000)); await pg.click('#foot1'); await pg.wait_for_timeout(1200)
        await mem('3 Overdubs')
        print('Zustand', await pg.evaluate('Looper.debug().tracks.map(t => t.state + "/" + t.layers)'), await pg.evaluate('Looper._mem()'))
        # schnelles Antippen der Wellenform (Springen) – früher jedes Mal neue Kopien aller Spuren
        wb = await (await pg.query_selector('#wave0')).bounding_box()
        for k in range(12):
            await pg.touchscreen.tap(wb['x'] + wb['width'] * (0.1 + 0.07 * k), wb['y'] + wb['height'] / 2); await pg.wait_for_timeout(40)
        await mem('12× auf die Wellenform getippt')
        if await pg.is_enabled('#edit1'): await pg.click('#edit1')
        else: print('edit1 gesperrt', await pg.evaluate('Looper.debug().tracks.map(t => t.state)'))
        await pg.wait_for_timeout(300)
        for k in range(3):
            for bid in ['#edNudgeR', '#edDouble', '#edFit', '#edTrim']:
                if await pg.is_visible(bid) and await pg.is_enabled(bid):
                    await pg.click(bid, timeout=60000); await pg.wait_for_timeout(300)
        await mem('nach Bearbeitungsschritten'); print('   ', await pg.evaluate('Looper._mem()'), await pg.inner_text('#loopStatus'))
        # Doppeltippen überall, während Aufnahme läuft
        await pg.click('#foot2'); await pg.wait_for_timeout(500)
        sel = ['#ring0', '#wave0', '#ring1', '#wave1', '#edWave', '#edOver', '.tracks', '#loopMeterBox', '.looper-card h2', '#tmeter2', '#ring2', '#wave2']
        for s in sel:
            el = await pg.query_selector(s)
            if not el: continue
            bb = await el.bounding_box()
            if not bb: continue
            for _ in range(2):
                await pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); await pg.wait_for_timeout(60)
            await pg.wait_for_timeout(150)
        await pg.wait_for_timeout(int(bar * 2 * 1000))
        st = await pg.evaluate('Looper.debug().tracks.map(t => t.state)')
        await mem('nach Doppeltippen (Aufnahme lief)')
        print('Spuren', st, '| Fehler', errs[:4])
        await b.close()
asyncio.run(main())
