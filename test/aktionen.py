# Je Aktion 12× ausführen und die Bildzeiten während der Aktion messen (Summe der Zeit über 33 ms = sichtbares Stocken)
import asyncio, sys, json
from playwright.async_api import async_playwright
URL = sys.argv[1]; T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page()
        await pg.goto(URL); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0')
        for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T', 'loops/guitar_only_95_4T']):
            await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(4000)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if await pg.is_visible('#edClose'): await pg.click('#edClose')
        await pg.click('#loopDrums'); await pg.click('#laneDrone'); await pg.click('#loopMonitor'); await pg.wait_for_timeout(2000)
        await pg.evaluate("""() => { window.__ft = []; let last = performance.now(); (function f(t){ window.__ft.push([t, t - last]); last = t; requestAnimationFrame(f); })(performance.now()); }""")
        async def measure(name, fn, n=12):
            tot = 0; worst = 0
            for i in range(n):
                t0 = await pg.evaluate('performance.now()'); await fn(i); await pg.wait_for_timeout(700); t1 = await pg.evaluate('performance.now()')
                st = await pg.evaluate(f"window.__ft.filter(x => x[0] >= {t0} && x[0] <= {t1}).map(x => x[1])")
                tot += sum(max(0, x - 33.4) for x in st); worst = max([worst] + st)
            return name, round(tot / n), round(worst)
        out = []
        async def alle(i): await pg.click('#loopAll')
        out.append(await measure('Alle stoppen/starten', alle))
        async def spur(i): await pg.click(f'#stop{i % 3}') if i % 2 == 0 else await pg.click(f'#foot{(i - 1) % 3}')
        out.append(await measure('Spur stoppen/starten', spur))
        async def od(i):
            await pg.click('#foot1'); await pg.wait_for_timeout(1200); await pg.click('#foot1')
        out.append(await measure('Overdub Spur 2', od, 6))
        async def und(i): await pg.click('#undo1')
        out.append(await measure('Rückgängig', und, 6))
        async def ed(i): await pg.click(f'#edit{i % 3}') if i % 2 == 0 else await pg.click('#edClose')
        out.append(await measure('Editor öffnen/schließen', ed))
        for t in ['quinten', 'solo', 'griffbrett']:
            async def tab(i, t=t): await pg.click('#tab-' + t) if i % 2 == 0 else await pg.click('#tab-looper')
            out.append(await measure('Reiter ' + t + '/Looper', tab))
        async def th(i): await pg.evaluate("(()=>{const p=document.getElementById('optikPop'); if(p) p.hidden=false;})()"); await pg.select_option('#appTheme', ['metal', 'nordic'][i % 2])
        out.append(await measure('Optik wechseln', th, 6))
        print(json.dumps(out, ensure_ascii=False))
        await b.close()
asyncio.run(main())
