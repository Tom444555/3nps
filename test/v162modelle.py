# v162: Gitarren aus druckwerk im Reiter „Rig“. Prüft: Start lädt kein Modell, Rig/Gitarren lädt schecter.glb erst beim Öffnen (Strat erst bei Wahl),
# beide Modelle aus Toms druckwerk (Quelle in scene.extras), je Datei < 1 MB, kein altes strat.glb mehr, Les Paul mit gewölbter Decke,
# Profile Automatisch/Neues iPad/Altes iPad/Minimal, Rückfall auf das eigene Schecter-Modell, wenn die Datei fehlt, Zeichenzeit,
# 1366×1024 · 820×1180 · 390×844, EN, keine Skriptfehler.  Aufruf: python3 test/v162modelle.py  (~2 min)
import asyncio, os, re, sys, time
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
WWW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'www')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info)[:300] if info else ''))
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
IGN = ('AudioContext was not allowed', 'GPU stall', 'GL Driver Message', 'WebGL', 'Automatic fallback to software WebGL')
glbreq = lambda reqs: [r.split('/rig/')[1] for r in reqs if '/rig/' in r and r.endswith('.glb')]

async def page(b, w=1366, h=1024, dev=None, route=None):
    ctx = await b.new_context(viewport={'width': w, 'height': h})
    await ctx.add_init_script("if(!sessionStorage.getItem('x')){localStorage.clear();%ssessionStorage.setItem('x','1')}" % (("localStorage.setItem('3nps-device','%s');" % dev) if dev else ''))
    if route: await ctx.route('**/rig/modelle/schecter.glb', lambda r: r.abort())
    pg = await ctx.new_page(); errs = []; reqs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and not any(x in m.text for x in IGN) else None)
    pg.on('request', lambda r: reqs.append(r.url))
    await pg.goto(U); await pg.wait_for_timeout(900)
    return ctx, pg, errs, reqs
async def until(pg, js, t=60000):
    for _ in range(int(t / 100)):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(100)
    raise TimeoutError(js)
async def guit(pg):
    await open_tab(pg, 'rig'); await until(pg, '!!window.Rig', 10000); await pg.wait_for_timeout(250)
    await pg.click('#rg-mainSeg [data-v=guit]'); await pg.wait_for_timeout(200)
async def wait3d(pg, gw):
    await until(pg, "(()=>{const i=Rig.threeInfo();return !!(i&&Rig.three().ready('%s'))})()" % gw); await pg.wait_for_timeout(300)
info = lambda pg: pg.evaluate('Rig.threeInfo()')
async def drawms(pg, n=20):   # Zeit je Bild beim Drehen: jedes Bild neu zeichnen und auf das nächste Bild des Browsers warten (60 Hz = 16,7 ms)
    return await pg.evaluate("async n=>{const v=Rig.three();await new Promise(r=>requestAnimationFrame(r));const t0=performance.now();for(let i=0;i<n;i++){i%2?v.reset():v.body();await new Promise(r=>requestAnimationFrame(r))}return (performance.now()-t0)/n}", n)

async def main():
    # ---------- Dateien ----------
    m = os.path.join(WWW, 'rig', 'modelle')
    gr = {f: os.path.getsize(os.path.join(m, f)) for f in ('schecter.glb', 'strat.glb')}
    check('Modelldateien rig/modelle/schecter.glb + strat.glb, je < 1 MB (Ziel deutlich darunter)', all(v < 900_000 for v in gr.values()), gr)
    check('altes rig/strat.glb (1,7 MB) entfernt', not os.path.exists(os.path.join(WWW, 'rig', 'strat.glb')))
    sw = open(os.path.join(WWW, 'sw.js'), encoding='utf8').read()
    check('sw.js: rig/modelle/ im Rig-Speicher (erst beim Öffnen), nicht im Vorab-Speicher', "includes('/rig/modelle/')" in sw and 'modelle' not in sw[sw.index('const CORE'):sw.index(']', sw.index('const CORE'))], '')
    check('index.html < 2,1 MB', os.path.getsize(os.path.join(WWW, 'index.html')) < 2_100_000, os.path.getsize(os.path.join(WWW, 'index.html')))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        # ---------- Automatisch (Standard) ----------
        ctx, pg, errs, reqs = await page(b)
        check('ab v162', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 162)
        await pg.wait_for_timeout(1200)
        check('Start lädt kein Modell und keinen Rig-Code', not [r for r in reqs if '/rig/' in r])
        await open_tab(pg, 'rig'); await until(pg, '!!window.Rig', 10000); await pg.wait_for_timeout(400)
        check('Rig „Sounds“: noch kein Modell geladen', not glbreq(reqs), glbreq(reqs))
        t0 = time.time(); await pg.click('#rg-mainSeg [data-v=guit]'); await wait3d(pg, 'schecter'); t_sch = time.time() - t0
        i = await info(pg)
        check('Gitarren: Schecter aus druckwerk geladen (nur schecter.glb, Strat noch nicht)', glbreq(reqs) == ['modelle/schecter.glb'] and 'schecter' in i['glb'] and not i['fail'], (glbreq(reqs), i))
        check('Quelle im Modell: Tom444555/druckwerk', i['quelle'][0].startswith('Tom444555/druckwerk@'), i['quelle'])
        check('Neues/Automatisch: Spiegelung + Klarlack', i['env'] and i['cc'] > 0, i)
        tri_s = i['tri']; ms_s = await drawms(pg)
        print(f'      Schecter: geladen+erstes Bild {t_sch:.1f} s, {tri_s} Dreiecke im Bild, {ms_s:.0f} ms je Bild (Software-WebGL)')
        fr = await pg.evaluate('Rig.three().frames'); await pg.wait_for_timeout(1500)
        check('ohne Animationsschleife (Ruhe: kein Bild)', await pg.evaluate('Rig.three().frames') == fr)
        st = await pg.evaluate('Rig.state()')
        check('Schecter-Einblendungen: Tonabnehmer N+B, Regler', sorted(st['lv']['raw'].keys()) == ['B', 'N'], st['lv']['raw'])
        await pg.click('#rg-posBtns [data-pos=N]'); await pg.wait_for_timeout(150)
        check('Schalter Neck: nur Neck aktiv', (await pg.evaluate('Rig.state()'))['lv']['raw']['B'] == 0)
        t0 = time.time(); await pg.click('[data-g2=strat]'); await wait3d(pg, 'strat'); t_str = time.time() - t0; i = await info(pg)
        check('Strat erst bei Wahl: modelle/strat.glb aus druckwerk', 'modelle/strat.glb' in glbreq(reqs) and 'strat' in i['glb'] and i['strat'], (glbreq(reqs), i['glb']))
        ms_t = await drawms(pg); print(f'      Strat: geladen+erstes Bild {t_str:.1f} s, {i["tri"]} Dreiecke, {ms_t:.0f} ms je Bild')
        await pg.click('[data-g2=gibson]'); await wait3d(pg, 'gibson'); i = await info(pg)
        check('Les Paul: eigenes Modell mit gewölbter Decke (kein Download)', i['arch'] and 'gibson' in i['models'] and 'gibson' not in i['glb'] and not any('gibson' in r or 'lespaul' in r.lower() for r in glbreq(reqs)), i)
        ms_g = await drawms(pg); print(f'      Les Paul: {i["tri"]} Dreiecke, {ms_g:.0f} ms je Bild')
        check('Zeit je Bild beim Drehen < 300 ms mit Software-WebGL (v161: Strat ~250)', max(ms_s, ms_t, ms_g) < 300, (round(ms_s), round(ms_t), round(ms_g)))
        await pg.click('#tab-looper'); await pg.wait_for_timeout(400); fr = await pg.evaluate('Rig.three().frames')
        await pg.wait_for_timeout(800); check('Reiter verlassen: 3D zeichnet nicht', await pg.evaluate('Rig.three().frames') == fr)
        # Altes iPad
        await open_tab(pg, 'rig'); await pg.wait_for_timeout(300)
        await pg.evaluate("Geraet.set('old')"); await pg.wait_for_timeout(400)
        await pg.click('[data-g2=schecter]'); await wait3d(pg, 'schecter'); i = await info(pg)
        check('Altes iPad: Schecter-Modell, Pixelverhältnis 1, ohne Spiegelung/Klarlack', i['pr'] == 1 and not i['env'] and i['cc'] == 0 and 'schecter' in i['glb'], i)
        ms_o = await drawms(pg); await pg.click('[data-g2=strat]'); await wait3d(pg, 'strat'); ms_o2 = await drawms(pg)
        print(f'      Altes iPad: {ms_o:.0f} / {ms_o2:.0f} ms je Bild (Schecter/Strat)')
        check('Altes iPad: flüssig (< 150 ms je Bild mit Software-WebGL)', max(ms_o, ms_o2) < 150, (round(ms_o), round(ms_o2)))
        await pg.evaluate("Geraet.set('new')"); await pg.wait_for_timeout(400); await pg.click('[data-g2=schecter]'); await wait3d(pg, 'schecter'); i = await info(pg)
        check('Neues iPad: Spiegelung + Klarlack', i['env'] and i['cc'] > 0, i)
        check('keine Skriptfehler (Automatisch/Alt/Neu)', not errs, errs)
        await ctx.close()
        # ---------- Minimal ----------
        ctx, pg, errs, reqs = await page(b, dev='min'); await guit(pg)
        for gw in ('strat', 'gibson', 'schecter'):
            await pg.click('[data-g2=%s]' % gw); await pg.wait_for_timeout(200)
        check('Minimal: kein three.js und kein Modell', not [r for r in reqs if '/rig/three/' in r or r.endswith('.glb')] and await pg.evaluate('Rig.three()===null'))
        check('Minimal: keine Skriptfehler', not errs, errs); await ctx.close()
        # ---------- Rückfall ohne Modelldatei ----------
        ctx, pg, errs, reqs = await page(b, route=True); await guit(pg); await wait3d(pg, 'schecter'); i = await info(pg)
        check('Schecter-Datei fehlt: eigenes einfaches Modell statt leerer Bühne', 'schecter' in i['fail'] and 'schecter' in i['models'] and 'schecter' not in i['glb'], i)
        check('Rückfall ohne Skriptfehler (nur die gesperrte Datei)', not [e for e in errs if 'Failed to load resource' not in e], errs); await ctx.close()
        # ---------- Größen + EN ----------
        for w, h in ((820, 1180), (390, 844)):
            ctx, pg, errs, reqs = await page(b, w, h); await guit(pg); await wait3d(pg, 'schecter')
            await pg.click('[data-g2=strat]'); await wait3d(pg, 'strat')
            c = await pg.evaluate("(()=>{const c=document.querySelector('#rg-v3d canvas');const r=c.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),sw:document.documentElement.scrollWidth}})()")
            check(f'{w}×{h}: 3D sichtbar, nichts ragt über', c['w'] > 200 and c['h'] > 200 and c['sw'] <= w, c)
            check(f'{w}×{h}: keine Skriptfehler', not errs, errs); await ctx.close()
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); await ctx.add_init_script("if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('3nps-lang','en');sessionStorage.setItem('x','1')}")
        pg = await ctx.new_page(); await pg.goto(U); await pg.wait_for_timeout(900); await guit(pg); await wait3d(pg, 'schecter')
        hint = await pg.inner_text('#rg-v3Hint') if await pg.query_selector('#rg-v3Hint') else ''
        check('EN: Hinweis übersetzt', 'your models from druckwerk' in hint, hint)
        await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
