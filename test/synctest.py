# Synchronisation: Loop auf Spur 1, andere Datei (anderes Tempo / versetzt) auf Spur 2
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        async def load(slot, path):
            await pg.set_input_files(f'#file{slot}', path)
            for _ in range(80):
                await pg.wait_for_timeout(250)
                if await pg.is_visible('#impDlg'): await pg.click('#impOk')
                st = await pg.inner_text('#loopStatus')
                if st.startswith(f'Spur {slot + 1}:'): return st
            return st
        for a, bb in [('loops/rock_120_2T.wav', 'loops/funk_104_3T.wav'), ('loops/rock_120_2T.wav', 'loops/guitar_only_95_4T.wav'), ('loops/funk_104_3T.wav', 'loops/off_funk_104_2T.wav'), ('loops/shuffle_88_2T.wav', 'loops/rock_97_intro_1T.wav')]:
            await pg.evaluate("for (let i=0;i<3;i++){const b=document.getElementById('clear'+i); b.click(); b.click();}"); await pg.wait_for_timeout(200)
            s1 = await load(0, T + a); s2 = await load(1, T + bb)
            d = await pg.evaluate('Looper.debug()'); sr = d['sr']
            L1, L2 = d['tracks'][0]['L'], d['tracks'][1]['L']
            print(a.split('/')[1], '+', bb.split('/')[1], '| L1', round(L1 / sr, 3), 'L2', round(L2 / sr, 3), 'Vielfaches', L2 % L1 == 0 or L1 % L2 == 0, '|', s2[:150])
        print('Fehler', errs)
        await b.close()
asyncio.run(main())
