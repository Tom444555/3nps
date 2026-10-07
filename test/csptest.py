# Sicherheitsregeln (CSP): alles muss weiter laufen, keine Anfragen an fremde Server, keine Verstöße
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + T + 'stereo/mic_st.wav', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(accept_downloads=True, viewport={'width': 1024, 'height': 1366})
        pg = await ctx.new_page(); errs, msgs, ext = [], [], []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: msgs.append(m.text) if ('Content Security Policy' in m.text or 'Refused' in m.text) else None)
        pg.on('request', lambda r: ext.append(r.url) if not r.url.startswith(('http://localhost', 'data:', 'blob:')) else None)
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        st = await pg.inner_text('#loopStatus')
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        lvl = (await pg.evaluate('Looper.debug()'))['level']
        await pg.click('#loopDrums'); await pg.wait_for_timeout(1500)
        drums = await pg.evaluate('Rhythm.debug()')
        await pg.select_option('#laneDroneStyle', 'v8'); await pg.click('#laneDrone'); await pg.wait_for_timeout(1500)
        async with pg.expect_download() as dl:
            await pg.click('#loopExport')
        d = await dl.value
        for th in ['metal', 'amp', 'ice']:
            await pg.evaluate("(()=>{const p=document.getElementById('optikPop'); if(p) p.hidden=false;})()"); await pg.select_option('#appTheme', th); await pg.wait_for_timeout(300)
        fonts = await pg.evaluate("Promise.all(['Metal Mania', 'Black Ops One', 'Russo One', 'Michroma', 'Cinzel', 'Uncial Antiqua'].map(f => document.fonts.load('700 20px \"' + f + '\"').then(r => f + ':' + r.length)))")
        print('Analyse:', st[:70]); print('Eingang Pegel', round(lvl, 3), '| Drums', drums['kit'], drums['on'], '| Export', d.suggested_filename)
        print('Schriften geladen:', fonts)
        print('Fremde Anfragen:', ext); print('CSP-Meldungen:', msgs[:5]); print('Fehler:', errs[:3])
        await b.close()
asyncio.run(main())
