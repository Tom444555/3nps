import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper')
        for i, f in enumerate(['rock_120_2T', 'funk_104_3T', 'guitar_only_95_4T']):
            await pg.set_input_files(f'#file{i}', T + f'loops/{f}.wav'); await pg.wait_for_timeout(3500)
        await pg.click('#edClose'); await pg.click('#loopDrums'); await pg.select_option('#laneDroneStyle', 'v4'); await pg.click('#laneDrone')
        cdp = await pg.context.new_cdp_session(pg)
        await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 12})
        await pg.evaluate("document.querySelector('.looper-card').scrollIntoView()")
        await pg.evaluate("window.__ft=[];let l=performance.now();(function f(t){window.__ft.push(t-l);l=t;requestAnimationFrame(f)})(performance.now())")
        for rate in (12, 30):
            await cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
            await pg.evaluate('window.__ft=[]'); await pg.wait_for_timeout(8000)
            st = await pg.evaluate("(()=>{const f=window.__ft.slice(5).sort((a,b)=>a-b);return {n:f.length,med:f[f.length>>1],p90:f[Math.floor(f.length*.9)],bad:f.filter(x=>x>70).length}})()")
            print('Drossel', rate, st, 'lite', await pg.evaluate('window.__lite'))
        print(await pg.inner_text('#loopStatus'))
        print('Fehler', errs)
        await b.close()
asyncio.run(main())
