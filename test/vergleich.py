# Vergleichs-Stresstest: gleiches Zufallsszenario für zwei Fassungen (z. B. stabile v24 gegen aktuelle Version).
# Aufruf: python3 vergleich.py URL MODUS SEKUNDEN SEED  ·  MODUS = gemeinsam (nur Funktionen, die beide haben) | voll (alles inkl. Neues)
# Ausgabe: eine JSON-Zeile mit Messwerten.
import asyncio, random, sys, json, time
from playwright.async_api import async_playwright
URL = sys.argv[1]; MODE = sys.argv[2] if len(sys.argv) > 2 else 'gemeinsam'
SECS = int(sys.argv[3]) if len(sys.argv) > 3 else 240; SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7
T = '/home/claude/3nps/test/'
async def main():
    random.seed(SEED)
    out = {'url': URL, 'mode': MODE, 'secs': SECS, 'seed': SEED}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
        pg.on('console', lambda m: errs.append('console: ' + m.text[:160]) if m.type == 'error' else None)
        t0 = time.time(); await pg.goto(URL); await pg.wait_for_load_state('load')
        out['start_ms'] = round((time.time() - t0) * 1000)
        out['ladezeit_ms'] = await pg.evaluate("Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd)")
        await pg.wait_for_timeout(1000)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t => t.dataset.tab)")
        common = ['looper', 'quinten', 'solo', 'griffbrett']
        use_tabs = tabs if MODE == 'voll' else [t for t in tabs if t in common]
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T', 'loops/guitar_only_95_4T']):
            await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(4000)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        await pg.evaluate("""() => { window.__ft = []; let last = performance.now(); (function f(t){ window.__ft.push(t - last); last = t; requestAnimationFrame(f); })(performance.now());
          window.__lt = { n: 0, ms: 0 }; try { new PerformanceObserver(l => l.getEntries().forEach(e => { window.__lt.n++; window.__lt.ms += e.duration; })).observe({ entryTypes: ['longtask'] }); } catch (e) {}
          window.__a0 = { ac: audioCtx.currentTime, pn: performance.now() }; }""")
        await pg.click('#loopDrums'); await pg.click('#laneDrone')
        if not await pg.evaluate("Looper.debug().mic"): await pg.click('#loopMonitor')
        await pg.wait_for_timeout(500)
        await pg.evaluate('gc()'); heap = [await pg.evaluate('performance.memory.usedJSHeapSize / 1048576')]
        late0 = await pg.evaluate("Rhythm.debug().late || 0")
        presets = await pg.evaluate("[...document.querySelectorAll('#loopDrumStyle option')].map(o => o.value).filter(Boolean)")
        tabms = []; acts = {}; fails = {}; recs = 0
        async def open_tab(t):
            ms = await pg.evaluate("t => new Promise(res => { const a = performance.now(); document.getElementById('tab-' + t).click(); requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - a))); })", t)
            tabms.append(ms)
        start = time.time(); k = 0
        while time.time() - start < SECS:
            names = ['tab', 'drumstil', 'droneton', 'dronestil', 'spur', 'alle', 'overdub', 'undo', 'editor', 'tempo', 'optik', 'blitz']
            if MODE == 'voll': names += ['jam', 'training', 'improvisation', 'wpanhalten', 'song']
            a = random.choice(names)
            try:
                if a == 'tab': await open_tab(random.choice(use_tabs)); await pg.wait_for_timeout(random.choice([200, 600, 1200])); await open_tab('looper')
                elif a == 'drumstil': await pg.click('#tab-looper'); await pg.select_option('#loopDrumStyle', random.choice(presets))
                elif a == 'droneton': await pg.click('#tab-looper'); await pg.select_option('#laneDroneRoot', random.choice(['', 'C', 'D', 'E', 'G', 'A']))
                elif a == 'dronestil': await pg.click('#tab-looper'); await pg.select_option('#laneDroneStyle', random.choice(['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8']))
                elif a == 'spur': await pg.click('#tab-looper'); i = random.randrange(3); await pg.click(f'#stop{i}'); await pg.wait_for_timeout(500); await pg.click(f'#foot{i}')
                elif a == 'alle': await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(500); await pg.click('#loopAll')
                elif a == 'overdub':
                    await pg.click('#tab-looper'); i = random.randrange(3)
                    if await pg.evaluate(f"Looper.debug().tracks[{i}].state") == 'playing':
                        await pg.click(f'#foot{i}'); await pg.wait_for_timeout(random.choice([1500, 3000])); await pg.click(f'#foot{i}'); recs += 1
                elif a == 'undo': await pg.click('#tab-looper'); i = random.randrange(3); await pg.click(f'#undo{i}')
                elif a == 'editor': await pg.click('#tab-looper'); i = random.randrange(3); await pg.click(f'#edit{i}'); await pg.wait_for_timeout(800); await pg.click('#edClose')
                elif a == 'tempo': await pg.evaluate("(() => { const e = document.getElementById('bpm'); e.value = %d; e.dispatchEvent(new Event('input')); })()" % random.randrange(70, 131))
                elif a == 'optik': await pg.select_option('#appTheme', random.choice(['nordic', 'metal', 'amp', 'ice']))
                elif a == 'blitz': await pg.click('#tab-looper'); await pg.click('#loopFlash')
                elif a == 'jam':
                    await open_tab('jam'); await pg.click('#jamPlay'); await pg.wait_for_timeout(150)
                    if not await pg.evaluate("!!Jam.debug()"): await pg.click('#jamPlay')
                    await pg.wait_for_timeout(2500); await pg.click('#jamPlay'); await open_tab('looper'); await pg.click('#loopAll')
                    await pg.wait_for_timeout(300)
                    if not await pg.evaluate("Looper.busy()"): await pg.click('#loopAll')
                elif a == 'training':
                    await open_tab('ueben'); s = random.choice(['tag', 'ohr', 'lick', 'solo']); await pg.click(f'#ubNav [data-s="{s}"]')
                    if s == 'ohr': await pg.click('#ubEarNew')
                    if s == 'lick': await pg.click('#ubLickPlay')
                    await pg.wait_for_timeout(800); await open_tab('looper')
                elif a == 'improvisation':
                    await open_tab('solo'); await pg.click(random.choice(['#sfListen', '#sfNeckMode button[data-m="grip"]', '#sfNeckMode button[data-m="scale"]', '.sf-sc >> nth=1']))
                    await pg.wait_for_timeout(1000); await open_tab('looper')
                elif a == 'song':
                    await pg.click('#tab-looper'); await pg.click('#loopSong'); await pg.wait_for_timeout(200)
                    if await pg.is_visible('#ldDOk'): await pg.click('#ldDOk'); await pg.wait_for_timeout(600)
                    await open_tab('lied'); await pg.click('#ldPlay'); await pg.wait_for_timeout(150)
                    if not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"): await pg.click('#ldPlay')
                    await pg.wait_for_timeout(2500); await pg.click('#ldCheck'); await pg.wait_for_timeout(300)
                    if await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"): await pg.click('#ldPlay')
                    await open_tab('looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(300)
                    if not await pg.evaluate("Looper.busy()"): await pg.click('#loopAll')
                elif a == 'wpanhalten':
                    await pg.click('#tab-looper')
                    if await pg.is_visible('#passtHold'): await pg.click('#passtHold'); await pg.wait_for_timeout(1500); await pg.click('#passtHold')
                acts[a] = acts.get(a, 0) + 1
            except Exception as e:
                fails[a] = fails.get(a, 0) + 1
            await pg.wait_for_timeout(random.randrange(300, 1600))
            k += 1
            if k % 12 == 0: await pg.evaluate('gc()'); heap.append(await pg.evaluate('performance.memory.usedJSHeapSize / 1048576'))
        await pg.click('#tab-looper'); await pg.wait_for_timeout(1500)
        await pg.evaluate('gc()'); heap.append(await pg.evaluate('performance.memory.usedJSHeapSize / 1048576'))
        st = await pg.evaluate("""() => { const f = window.__ft.slice(5).sort((a, b) => a - b), q = x => f[Math.min(f.length - 1, Math.floor(f.length * x))];
          const ac = audioCtx.currentTime - window.__a0.ac, pn = (performance.now() - window.__a0.pn) / 1000;
          return { frames: f.length, med: q(.5), p95: q(.95), p99: q(.99), max: f[f.length - 1], gt50: f.filter(x => x > 50).length, gt100: f.filter(x => x > 100).length,
            lt: window.__lt.n, ltms: Math.round(window.__lt.ms), audio: audioCtx.state, audioGang: ac / pn }; }""")
        d = await pg.evaluate('Looper.debug()')
        out.update({'aktionen': k, 'aktionen_je_art': acts, 'aktion_fehlgeschlagen': fails, 'overdubs': recs,
                    'heap_mb': [round(h, 1) for h in heap], 'heap_start': round(heap[0], 1), 'heap_ende': round(heap[-1], 1), 'heap_max': round(max(heap), 1),
                    'tab_ms_median': round(sorted(tabms)[len(tabms) // 2], 1) if tabms else None, 'tab_ms_max': round(max(tabms), 1) if tabms else None, 'tabwechsel': len(tabms),
                    'drums_spaet': (await pg.evaluate("Rhythm.debug().late || 0")) - late0,
                    'spuren': [t['state'] for t in d['tracks']], 'drums_an': d['drums']['on'], 'drone_an': d['drone'],
                    'fehler': errs[:8], 'fehler_anzahl': len(errs)})
        out.update({k2: (round(v, 2) if isinstance(v, float) else v) for k2, v in st.items()})
        await b.close()
    print(json.dumps(out, ensure_ascii=False))
asyncio.run(main())
