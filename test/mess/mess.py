# Gesamtmessung Leistung (wie PRUEFBERICHT-v140.md): Start, Leerlauf, Mitlaufen je Bereich, 1x und 4x gedrosselt, je Geräte-Profil.
# Aufruf:  python3 test/mess/mess.py <URL-der-index.html> <Name> [start|idle|mit|dev ...]   → schreibt test/mess/erg-<Name>.json
# Vergleich zweier Stände: python3 test/mess/vergleich.py erg-v140.json erg-v145.json
# Nur Chromium headless (Software-Rendering) – Näherung, kein iPad. Service Worker ist abgeschaltet (kalter Start vom lokalen Server).
import asyncio, json, os, sys, statistics
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = sys.argv[1]; NAME = sys.argv[2]; WHAT = sys.argv[3:] or ['start', 'idle', 'mit', 'dev']
T = '/home/claude/3nps/test/'
ARGS = ['--autoplay-policy=no-user-gesture-required']
SEK = int(os.environ.get('SEK', '15'))
INIT = """window.__lt=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push([e.startTime,e.duration])}).observe({type:'longtask',buffered:true})}catch(e){}"""
FRAMES = """window.__fr=[];(function f(t){window.__fr.push(t);window.__frId=requestAnimationFrame(f)})(performance.now())"""
met = lambda m: {x['name']: x['value'] for x in m['metrics']}
OUT = os.path.join(os.path.dirname(__file__), 'erg-' + NAME + '.json')
res = json.load(open(OUT)) if os.path.exists(OUT) else {}

async def page(p, dev=None, thr=1, early=True):
    b = await p.chromium.launch(args=ARGS)
    ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, service_workers='block')
    await ctx.add_init_script(INIT)
    if dev: await ctx.add_init_script("try{localStorage.setItem('3nps-device','%s')}catch(e){}" % dev)
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    cdp = await ctx.new_cdp_session(pg); await cdp.send('Performance.enable')
    if early and thr > 1: await cdp.send('Emulation.setCPUThrottlingRate', {'rate': thr})
    return b, pg, cdp, errs

async def window_(pg, cdp, sek):
    await pg.evaluate("window.__lt.length=0;window.__m=0;window.__mo&&window.__mo.disconnect();window.__mo=new MutationObserver(l=>{window.__m+=l.length});window.__mo.observe(document.body,{attributes:true,subtree:true,childList:true,characterData:true});cancelAnimationFrame(window.__frId);" + FRAMES)
    m0 = met(await cdp.send('Performance.getMetrics')); await pg.wait_for_timeout(sek * 1000); m1 = met(await cdp.send('Performance.getMetrics'))
    r = await pg.evaluate("(()=>{const f=window.__fr,d=[];for(let i=1;i<f.length;i++)d.push(f[i]-f[i-1]);const lt=window.__lt;return {n:d.length,span:f[f.length-1]-f[0],g20:d.filter(x=>x>20).length,g50:d.filter(x=>x>50).length,ltN:lt.length,ltMax:Math.max(0,...lt.map(x=>x[1])),mut:window.__m,heap:performance.memory?performance.memory.usedJSHeapSize:0}})()")
    d = lambda k: (m1[k] - m0[k]) / sek
    return {'haupt_ms_s': round(d('TaskDuration') * 1000), 'script_ms_s': round(d('ScriptDuration') * 1000), 'layout_s': round(d('LayoutCount'), 1), 'style_s': round(d('RecalcStyleCount'), 1),
            'mut_s': round(r['mut'] / sek, 1), 'fps': round(r['n'] / (r['span'] / 1000), 1) if r['span'] else 0, 'ueber20_pct': round(100 * r['g20'] / max(1, r['n']), 1), 'ueber50_pct': round(100 * r['g50'] / max(1, r['n']), 1),
            'lange': r['ltN'], 'lange_max_ms': round(r['ltMax']), 'heap_mb': round(r['heap'] / 1e6, 1)}

async def start(p):
    out = {}
    for thr in (1, 4):
        runs = []
        for _ in range(5):
            b, pg, cdp, errs = await page(p, thr=thr)
            await pg.goto(U); await pg.wait_for_timeout(7000)
            r = await pg.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0],lt=window.__lt.filter(x=>x[0]<6500);return {dcl:n.domContentLoadedEventEnd,load:n.loadEventEnd,ltN:lt.length,ltSum:lt.reduce((a,x)=>a+x[1],0),ltMax:Math.max(0,...lt.map(x=>x[1])),ready:Math.max(n.loadEventEnd,...lt.map(x=>x[0]+x[1])),dom:document.querySelectorAll('*').length}})()")
            t0 = await pg.evaluate("performance.now()"); await open_tab(pg, 'lernen'); await pg.evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))"); r['klick'] = await pg.evaluate("performance.now()") - t0
            r['errs'] = len(errs); runs.append(r); await b.close()
        out[str(thr)] = {k: round(statistics.median(x[k] for x in runs)) for k in runs[0]}
    res['start'] = out

async def idle(p):
    out = {}
    b, pg, cdp, errs = await page(p)
    await pg.goto(U); await pg.wait_for_timeout(3000)
    for t in ['looper', 'caged', 'solo', 'jam', 'singen', 'quinten', 'lernen']:
        await open_tab(pg, t); await pg.wait_for_timeout(1500); out[t] = await window_(pg, cdp, 5)
    out['errs'] = errs[:3]; await b.close(); res['idle'] = out

async def szene(pg):
    await open_tab(pg, 'looper'); await pg.select_option('#loopCountIn', '0')
    for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T', 'loops/guitar_only_95_4T']):
        await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(3500)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(500)
    if 'aus' in (await pg.inner_text('#loopDrums')): await pg.click('#loopDrums')
    await pg.wait_for_timeout(500); await open_tab(pg, 'griffbrett'); await pg.click('#droneBtn'); await pg.wait_for_timeout(2500)   # Drone sitzt im Griffbrett

async def mit(p, dev=None, tabs=('looper', 'jam', 'singen', 'quinten', 'lernen'), thrs=(1, 4)):
    out = {}
    for thr in thrs:
        b, pg, cdp, errs = await page(p, dev=dev, early=False)
        await pg.goto(U); await pg.wait_for_timeout(3000); await szene(pg)
        if thr > 1: await cdp.send('Emulation.setCPUThrottlingRate', {'rate': thr})
        for t in tabs:
            await open_tab(pg, t); await pg.wait_for_timeout(2500); out[t + '@' + str(thr)] = await window_(pg, cdp, SEK)
        out['errs@' + str(thr)] = errs[:3]; await b.close()
    return out

async def main():
    async with async_playwright() as p:
        if 'start' in WHAT: await start(p)
        if 'idle' in WHAT: await idle(p)
        if 'mit' in WHAT: res['mit'] = await mit(p)
        if 'hart' in WHAT: res['hart'] = await mit(p, tabs=('looper',), thrs=(8,))   # Looper 8x gedrosselt (schneller Messrechner: 4x ist hier milder als im Bericht v140)
        if 'dev' in WHAT:
            res['dev'] = {}
            for d in ('new', 'old', 'min'): res['dev'][d] = await mit(p, dev=d, tabs=('looper',), thrs=(1, 4, 8))
        json.dump(res, open(OUT, 'w'), indent=1); print('geschrieben', OUT, list(res))
asyncio.run(main())
