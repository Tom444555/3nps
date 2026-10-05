import asyncio, random, sys
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
SECS = int(sys.argv[1]) if len(sys.argv) > 1 else 150
async def main():
    random.seed(7)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        for i, f in enumerate(['rock_120_2T', 'funk_104_3T', 'guitar_only_95_4T']):
            await pg.set_input_files(f'#file{i}', T + f'loops/{f}.wav'); await pg.wait_for_timeout(4000)
        await pg.evaluate("""() => { window.__ft = []; let last = performance.now(); (function f(t){ window.__ft.push(t - last); last = t; if (window.__ft.length > 4000) window.__ft.splice(0, 2000); requestAnimationFrame(f); })(performance.now());
          window.__lt = 0; try { new PerformanceObserver(l => { window.__lt += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch (e) {} }""")
        await pg.click('#loopDrums'); await pg.click('#drumEditBtn') if await pg.is_hidden('#drumDesigner') else None
        await pg.click('#laneDrone'); await pg.click('#loopMonitor')
        presets = await pg.evaluate("[...document.querySelectorAll('#loopDrumStyle option')].map(o => o.value)")
        roots = ['', 'C', 'D', 'E', 'G', 'A']
        heap = []; t0 = await pg.evaluate('performance.now()')
        k = 0
        while (await pg.evaluate('performance.now()')) - t0 < SECS * 1000:
            a = random.randrange(15)
            try:
                if a == 0: await pg.select_option('#loopDrumStyle', random.choice(presets))
                elif a == 1: await pg.click(f'.dg-cell[data-i="{random.choice(["kick","snare","hhc","hho","clap","tomh","rim","crash","ride","shaker"])}"][data-k="{random.randrange(12)}"]')
                elif a == 2:
                    if await pg.is_enabled('#drumSwing'): await pg.fill('#drumSwing', str(random.randrange(0, 101, 5))); await pg.dispatch_event('#drumSwing', 'input')
                elif a == 3: await pg.select_option('#laneDroneRoot', random.choice(roots))
                elif a == 4: await pg.select_option('#laneDroneStyle', random.choice(['v1', 'v2']))
                elif a == 5: await pg.click('#loopFlash')
                elif a == 6: await pg.click('#tab-griffbrett'); await pg.wait_for_timeout(600); await pg.click('#tab-looper')
                elif a == 7: i = random.randrange(3); await pg.click(f'#stop{i}'); await pg.wait_for_timeout(500); await pg.click(f'#foot{i}')
                elif a == 8: await pg.click('#loopAll'); await pg.wait_for_timeout(400); await pg.click('#loopAll')
                elif a == 9: await pg.click('.dg-name[data-mute="' + random.choice(['kick','snare','hhc']) + '"]')
                elif a == 10: await pg.click('#laneDrone'); await pg.wait_for_timeout(500); await pg.click('#laneDrone')
                elif a == 11: await pg.select_option('#laneDroneStyle', random.choice(['v1', 'v2', 'v3', 'v4', 'v5', 'v6']))
                elif a == 12: await pg.click('#tab-begleitung'); await pg.wait_for_timeout(300); await pg.click('#btnBass'); await pg.wait_for_timeout(1500); await pg.click('#btnBass'); await pg.click('#tab-looper')
                elif a == 13: await pg.select_option('#drumFills', random.choice(['0', '4', '8', '12']))
                else: await pg.select_option('#drumRes', random.choice(['12', '16']))
            except Exception as e: errs.append('Aktion %d: %s' % (a, str(e)[:100]))
            await pg.wait_for_timeout(random.randrange(400, 2200))
            k += 1
            if k % 15 == 0:
                await pg.evaluate('window.gc && gc()'); heap.append(await pg.evaluate('performance.memory.usedJSHeapSize / 1048576'))
        st = await pg.evaluate("""() => { const f = window.__ft.slice(-1500).sort((a, b) => a - b); return { med: f[f.length >> 1], p99: f[Math.floor(f.length * .99)], max: f[f.length - 1], lt: window.__lt, ctx: audioCtx.state, t: audioCtx.currentTime }; }""")
        d = await pg.evaluate('Looper.debug()')
        print('Aktionen', k, '| Heap MB', [round(h, 1) for h in heap])
        print('Frames ms: Median %.1f, p99 %.1f, max %.0f | lange Tasks %d | Audio %s %.0f s' % (st['med'], st['p99'], st['max'], st['lt'], st['ctx'], st['t']))
        print('Spuren', [t['state'] for t in d['tracks']], '| Drums', d['drums']['on'], '| Drone', d['drone'])
        print('Fehler', errs[:6])
        await b.close()
asyncio.run(main())
