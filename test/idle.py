# Ruhemessung: Loop + Drums + Drone laufen 60 s ohne Bedienung; Bildzeiten und Layout-Verschiebungen
import asyncio, sys, json
from playwright.async_api import async_playwright
URL = sys.argv[1]; ZU = len(sys.argv) > 2 and sys.argv[2] == 'zu'
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366})
        await pg.goto(URL); await pg.wait_for_timeout(800)
        if ZU: await pg.evaluate("localStorage.setItem('3nps-passt-auf', '0')"); await pg.reload(); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0')
        for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T', 'loops/guitar_only_95_4T']):
            await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(4000)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        await pg.click('#loopDrums'); await pg.click('#laneDrone'); await pg.wait_for_timeout(3000)
        await pg.evaluate("""() => { window.__ft = []; let last = performance.now(); (function f(t){ window.__ft.push(t - last); last = t; requestAnimationFrame(f); })(performance.now());
          window.__cls = 0; try { new PerformanceObserver(l => l.getEntries().forEach(e => { window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: false }); } catch (e) {}
          window.__lt = 0; try { new PerformanceObserver(l => { window.__lt += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch (e) {} }""")
        await pg.wait_for_timeout(60000)
        r = await pg.evaluate("(() => { const f = window.__ft.slice(5).sort((a,b)=>a-b); return { frames: f.length, p95: f[Math.floor(f.length*.95)], p99: f[Math.floor(f.length*.99)], gt50: f.filter(x=>x>50).length, gt100: f.filter(x=>x>100).length, max: f[f.length-1], lt: window.__lt, cls: Math.round(window.__cls*1000)/1000 }; })()")
        print(json.dumps(r))
        await b.close()
asyncio.run(main())
