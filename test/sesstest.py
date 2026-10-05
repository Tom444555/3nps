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
        async def load(slot, path):
            await pg.set_input_files(f'#file{slot}', path)
            for _ in range(60):
                await pg.wait_for_timeout(250)
                if await pg.is_visible('#impDlg'): await pg.click('#impOk')
                if (await pg.inner_text('#loopStatus')).startswith(f'Spur {slot + 1}:'): return
        await load(0, T + 'loops/rock_120_2T.wav'); await load(1, T + 'loops/funk_104_3T.wav'); await load(2, T + 'loops/guitar_only_95_4T.wav')
        # Eigenes Muster
        if await pg.is_hidden('#drumDesigner'): await pg.click('#drumEditBtn')
        await pg.select_option('#loopDrumStyle', 'kc_shuffle'); await pg.click('.dg-cell[data-i="clap"][data-k="3"]')
        print('nach Änderung', await pg.input_value('#loopDrumStyle'))
        await pg.fill('#drumSaveName', 'Mein KC Shuffle'); await pg.click('#drumSaveBtn')
        k = await pg.input_value('#loopDrumStyle'); print('gespeichert als', k, await pg.inner_text('#drumNote'))
        await pg.click('.dg-cell[data-i="tomh"][data-k="11"]'); print('Änderung bleibt im eigenen Muster', await pg.input_value('#loopDrumStyle') == k)
        await pg.click('#loopDrums')
        # Drone an
        await pg.select_option('#laneDroneStyle', 'v6'); await pg.select_option('#laneDroneRoot', 'A'); await pg.click('#laneDrone'); await pg.wait_for_timeout(800)
        d0 = await pg.evaluate('Looper.debug()'); L0 = [t['L'] for t in d0['tracks']]; bpm0 = d0['bpm']
        await pg.fill('#ideaName', 'Test-Session'); await pg.click('#ideaSave'); await pg.wait_for_timeout(1500)
        print('Status', await pg.inner_text('#loopStatus'))
        # Alles umstellen, dann laden
        for i in range(3): await pg.evaluate(f"document.getElementById('clear{i}').click(); document.getElementById('clear{i}').click();")
        await pg.click('#loopDrums'); await pg.click('#laneDrone'); await pg.select_option('#loopDrumStyle', 'rock'); await pg.wait_for_timeout(1500)
        await pg.click('.idea-row [data-act="load"]'); await pg.wait_for_timeout(2500)
        d1 = await pg.evaluate('Looper.debug()')
        print('Spuren', L0, '→', [t['L'] for t in d1['tracks']], 'Tempo', bpm0, '→', d1['bpm'])
        print('Drums', await pg.evaluate('Rhythm.debug()'), 'Stil', await pg.input_value('#loopDrumStyle'))
        print('Drone', d1['drone'], await pg.inner_text('#laneDroneStatus'))
        print('Status', await pg.inner_text('#loopStatus'))
        print('Liste', await pg.inner_text('#ideaList'))
        # Muster löschen
        await pg.select_option('#loopDrumStyle', k); await pg.click('#drumDelBtn'); await pg.click('#drumDelBtn')
        print('nach Löschen', await pg.input_value('#loopDrumStyle'), await pg.evaluate("[...document.querySelectorAll('#loopDrumStyle option')].some(o => o.value === '" + k + "')"))
        # Leistung
        await pg.select_option('#perfMode', 'lite'); await pg.wait_for_timeout(300); print('lite', await pg.evaluate('window.__lite'), await pg.inner_text('#perfInfo'))
        await pg.select_option('#perfMode', 'auto')
        print('Fehler', errs)
        await b.close()
asyncio.run(main())
