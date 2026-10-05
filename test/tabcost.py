# Wie lange dauert das Öffnen jedes Reiters (Klick bis gezeichnet), Looper läuft mit 3 Spuren
import asyncio, sys, statistics
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366})
        await pg.goto(URL); await pg.wait_for_timeout(1000)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T', 'loops/guitar_only_95_4T']):
            await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(4000)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t => t.dataset.tab)")
        out = {}
        for r in range(6):
            for t in tabs:
                ms = await pg.evaluate("t => new Promise(res => { const a = performance.now(); document.getElementById('tab-' + t).click(); requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - a))); })", t)
                out.setdefault(t, []).append(ms)
                await pg.wait_for_timeout(150)
        for t, v in out.items(): print(f'{t:12s} Median {statistics.median(v):6.1f} ms  max {max(v):6.1f} ms')
        await b.close()
asyncio.run(main())
