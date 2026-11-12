# v146: Reiter „Rig“ (Sounds + Gitarren). Prüft: Start lädt keine Rig-Datei (Looper unverändert), 5 Bereiche, Rig lädt erst beim Öffnen,
# Sounds (Kette, Prompt, Ziel, Regler ohne Neubau/Springen, An/Aus, Stereo, eigene Sounds), Gitarren (Schalter, Split, Potis, Zeichnung/3D),
# 3D mit swiftshader (Schecter/Strat/Les Paul, nur bei Änderung gezeichnet, verborgen kein Zeichnen), Geräte-Profile Automatisch/Neu/Alt/Minimal
# (Minimal lädt kein three.js), EN, Telefon, keine fremden Anfragen, keine Skriptfehler.  Aufruf: python3 test/v146rig.py  (~2 min)
import asyncio, os, re, json, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '')   # Ordner für Screenshots (optional)
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info)[:300] if info else ''))
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
IGN = ('AudioContext was not allowed', 'GPU stall', 'GL Driver Message', 'WebGL', 'Automatic fallback to software WebGL')

async def page(b, w=1366, h=1024, dpr=1, init=None, url=U):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page(); errs = []; reqs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and not any(x in m.text for x in IGN) else None)
    pg.on('request', lambda r: reqs.append(r.url))
    await pg.goto(url); await pg.wait_for_timeout(900)
    return ctx, pg, errs, reqs

rigreq = lambda reqs: [r.split('/rig/')[1] for r in reqs if '/rig/' in r]
threereq = lambda reqs: [r for r in reqs if '/rig/three/' in r or r.endswith('strat.glb')]
async def until(pg, js, t=30000):   # eigenes Warten: wait_for_function scheitert gelegentlich an der CSP (kein eval)
    for _ in range(int(t / 100)):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(100)
    raise TimeoutError(js)
async def to_rig(pg):
    await open_tab(pg, 'rig'); await until(pg, '!!window.Rig', 10000); await pg.wait_for_timeout(250)
async def guit(pg):
    await pg.click('#rg-mainSeg [data-v=guit]'); await pg.wait_for_timeout(200)
async def wait3d(pg, gw, t=30000):
    await until(pg, "(()=>{const i=Rig.threeInfo();return !!(i&&i.models.includes('%s')&&Rig.three().ready('%s'))})()" % (gw, gw), t); await pg.wait_for_timeout(300)
info = lambda pg: pg.evaluate('Rig.threeInfo()')
st = lambda pg: pg.evaluate('Rig.state()')
async def shot(pg, name):   # Bühne (Zeichnung/3D) oben im Bild
    await pg.evaluate("scrollTo(0, document.querySelector('#panel-rig .rg-stagecard').getBoundingClientRect().top + scrollY - 120)"); await pg.wait_for_timeout(400)
    await pg.screenshot(path=SHOT + '/' + name)
async def setrange(pg, sel, v):
    await pg.evaluate("([s,v])=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))}", [sel, v])

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        # ---------- Start ohne Rig ----------
        ctx, pg, errs, reqs = await page(b, init="localStorage.clear()")
        check('ab v146', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 146)
        await pg.wait_for_timeout(1500)
        check('Start lädt keine Rig-Datei (weder Code noch three.js/Modell)', not rigreq(reqs), rigreq(reqs))
        check('Rig-Code beim Start nicht ausgeführt, Panel verborgen', await pg.evaluate("!window.Rig && document.getElementById('panel-rig').hidden && !document.querySelector('link[href*=\"rig/\"],script[src*=\"rig/\"]')"))
        areas = await pg.evaluate("[...document.querySelectorAll('.tabs.areas [data-area]')].map(b=>b.textContent.trim())")
        check('5 Bereiche: … Song & Gesang · Rig', areas == ['Looper', 'Lernen', 'Jammen', 'Song & Gesang', 'Rig'], areas)
        geo = await pg.evaluate("(()=>{const n=[...document.querySelectorAll('.tabs.areas .tab')].map(b=>Math.round(b.getBoundingClientRect().top));return new Set(n).size})()")
        check('iPad quer: Bereiche + „?“ in einer Zeile', geo == 1, geo)
        # ---------- Rig öffnen: Sounds ----------
        await to_rig(pg)
        r = rigreq(reqs)
        check('Rig öffnen lädt rig.css + rig.js (noch kein three.js)', 'rig.js' in r and 'rig.css' in r and not threereq(reqs), r)
        v = await pg.evaluate("({cur:AppNav.current(),sub:document.getElementById('subNav').hidden,vis:[...document.querySelectorAll('section.panel')].filter(s=>!s.hidden).map(s=>s.id)})")
        check('Rig allein sichtbar, ohne Unterleiste', v['cur'] == 'rig' and v['sub'] and v['vis'] == ['panel-rig'], v)
        s = await st(pg)
        n = await pg.evaluate("document.querySelectorAll('#rg-chain .rg-blk').length")
        check('Signalkette: 6 Blöcke bei „Clean Funk“, Amp gewählt', n == 6 and await pg.evaluate("document.querySelector('#rg-chain .rg-blk.rg-sel').classList.contains('rg-amp')"), n)
        pr = await pg.inner_text('#rg-prompt')
        check('Prompt englisch + Gitarren-Stichpunkte', pr.startswith('Create a "Clean Funk" guitar tone for a Schecter PT Apocalypse') and 'Signal chain in this order:' in pr and 'Gitarre einstellen:' in pr and '• Coil-Split: Tone-Poti ziehen' in pr, pr[:160])
        await pg.click('[data-p=amb]'); await pg.wait_for_timeout(150); pr = await pg.inner_text('#rg-prompt')
        check('„Ambient Clean (Stereo)“: STEREO-Zeile + [STEREO]-Blöcke', 'STEREO: run the modulation, delay, reverb in stereo' in pr and pr.count('[STEREO]') == 3, pr[:400])
        await pg.click('#rg-tSeg [data-t=reactor]'); await pg.wait_for_timeout(100); pr = await pg.inner_text('#rg-prompt')
        check('Ziel Reactor 50: Hinweis vorn, Badge', pr.startswith('(Reactor 50 – amp knobs on the amp') and await pg.inner_text('#rg-prT') == 'Reactor 50')
        await pg.click('[data-g=strat]'); await pg.wait_for_timeout(100); pr = await pg.inner_text('#rg-prompt')
        check('Gitarre Strat: Prompt + Stellung 4 + Tone-Regler', 'for a Stratocaster ’95 (middle + neck single-coil pickups)' in pr and '• Schalter: 4 M+N' in pr and '• Tone Neck: 6' in pr, pr[-160:])
        # Regler im Amp-Block: Schieberegler bleibt dasselbe Element, Wert landet in Kette und Prompt, nichts springt
        top0 = await pg.evaluate("Math.round(document.getElementById('rg-prompt').getBoundingClientRect().top+scrollY)")
        await pg.evaluate("window.__sl=document.querySelector('#rg-ed input[data-k=Gain]')")
        await setrange(pg, '#rg-ed input[data-k=Gain]', '8.5')
        same = await pg.evaluate("window.__sl===document.querySelector('#rg-ed input[data-k=Gain]')")
        pr = await pg.inner_text('#rg-prompt')
        kv = await pg.evaluate("[...document.querySelectorAll('#rg-chain .rg-blk.rg-sel .rg-kn')].find(k=>k.textContent.endsWith('Gain')).querySelector('b').textContent")
        check('Gain 8,5: Regler nicht neu gebaut, Kette + Prompt aktualisiert', same and 'Gain 8,5/10' in pr and kv == '8,5', (same, kv))
        tops = [top0]
        for i in range(6):
            await pg.click('#rg-chain .rg-blk[data-b="%d"]' % i); await pg.wait_for_timeout(60)
            tops.append(await pg.evaluate("Math.round(document.getElementById('rg-prompt').getBoundingClientRect().top+scrollY)"))
        check('Blöcke wechseln (3–6 Regler): Prompt-Karte springt nicht', len(set(tops)) == 1, tops)
        await pg.click('#rg-chain .rg-blk[data-b="5"]'); await pg.click('#rg-edOn'); await pg.wait_for_timeout(80)
        pr = await pg.inner_text('#rg-prompt'); off = await pg.evaluate("document.querySelector('#rg-chain .rg-blk[data-b=\"5\"]').classList.contains('rg-off')")
        check('Hall aus: Block blass, nicht mehr im Prompt', off and 'Shimmer/Hall' not in pr and await pg.inner_text('#rg-edOn') == 'Aus', pr[-300:])
        await pg.click('#rg-chain .rg-blk[data-b="1"]'); await pg.click('#rg-edSt'); await pg.wait_for_timeout(80); pr = await pg.inner_text('#rg-prompt')
        check('Amp auf Stereo: [STEREO] am Amp', '[STEREO] Clean American' in pr, pr[:500])
        h1 = await pg.evaluate("document.getElementById('rg-prompt').getBoundingClientRect().height")
        await pg.click('[data-p=metal]'); await pg.wait_for_timeout(100)
        h2 = await pg.evaluate("document.getElementById('rg-prompt').getBoundingClientRect().height")
        check('Prompt-Feld feste Höhe (Sounds mit 6 bzw. 7 Zeilen Kette)', abs(h1 - h2) < 1, (h1, h2))
        # eigene Sounds
        await pg.click('#rg-save'); await pg.wait_for_timeout(150)
        m = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-rig-mine')||'[]')")
        chipm = await pg.evaluate("[...document.querySelectorAll('#rg-pChips .toggle-btn')].map(b=>b.textContent)")
        check('Eigenen Sound sichern: 3nps-rig-mine, ★ in der Bibliothek, gewählt', len(m) == 1 and m[0]['name'].startswith('Modern High-Gain (eigen 1)') and any(c.startswith('★Modern') for c in chipm) and (await st(pg))['p'] == m[0]['id'], chipm)
        await pg.evaluate("window.confirm=()=>true;0"); await pg.click('#rg-del'); await pg.wait_for_timeout(150)
        check('Eigenen Sound löschen', await pg.evaluate("JSON.parse(localStorage.getItem('3nps-rig-mine')).length") == 0 and (await st(pg))['p'] == 'funk')
        check('Sounds-Ansicht lädt kein three.js', not threereq(reqs), threereq(reqs))
        # ---------- Gitarren + 3D ----------
        await guit(pg)
        await wait3d(pg, 'schecter')
        i = await info(pg)
        check('Gitarren: 3D-Schecter geladen (three.js lokal), Neues iPad: Spiegelung + Klarlack', i['env'] and i['cc'] > 0 and any('three.module.min.js' in r for r in reqs) and not any(r.endswith('strat.glb') for r in reqs), i)
        fr = await pg.evaluate("Rig.three().frames"); await pg.wait_for_timeout(2000); fr2 = await pg.evaluate("Rig.three().frames")
        check('3D ohne Animationsschleife (2 s Ruhe: kein Bild)', fr2 == fr, (fr, fr2))
        s0 = await st(pg)
        await pg.click('#rg-posBtns [data-pos=B]'); await pg.wait_for_timeout(100); s1 = await st(pg)
        fr3 = await pg.evaluate("Rig.three().frames")
        check('Schalter → Bridge: Zustand, Pegel, 3D neu gezeichnet', s1['st']['pos'] == 'B' and s1['lv']['out'] != s0['lv']['out'] and fr3 > fr2, (s0['st'], s1['st'], fr3))
        lab = await pg.evaluate("[...document.querySelectorAll('#rg-wLeg .rg-legt')].map(e=>e.textContent)")
        check('Verkabelung: nummerierte Kabel mit mV/µA', lab == ['Bridge → Schalter', 'Schalter → Volume', 'Volume → Buchse'] and 'µA' in await pg.inner_text('#rg-wLeg'), lab)
        await pg.click('#rg-splitBtn'); await pg.wait_for_timeout(100); s2 = await st(pg)
        coil = await pg.evaluate("Rig.state().lv.raw.B")
        check('Coil-Split an: 1 Spule (Pegel 230 mV), blaue Split-Linie im Schaltplan', s2['st']['split'] and coil == 230 and '#64d2ff' in await pg.inner_html('#rg-wiring'), coil)
        hb = await pg.evaluate("document.querySelector('#rg-wLeg').getBoundingClientRect().height")
        await setrange(pg, '#rg-potEd input[data-pot=tone]', '3')
        s3 = await st(pg)
        check('Tone 3: Resonanz tiefer, Erklärung „Tone zurückgedreht“', s3['model']['f'] < s2['model']['f'] and 'Tone zurückgedreht' in await pg.inner_text('#rg-expl') and await pg.inner_text('#rg-pv_tone') == '3', (round(s2['model']['f']), round(s3['model']['f'])))
        tops = []
        for act in ["#rg-posBtns [data-pos=N]", "#rg-posBtns [data-pos=NB]", "#rg-splitBtn"]:
            await pg.click(act); await pg.wait_for_timeout(80)
            tops.append(await pg.evaluate("[document.getElementById('rg-wiring').getBoundingClientRect().top+scrollY, document.getElementById('rg-potEd').getBoundingClientRect().top+scrollY].map(Math.round).join()"))
        await setrange(pg, '#rg-potEd input[data-pot=vol]', '6'); await pg.wait_for_timeout(80)
        tops.append(await pg.evaluate("[document.getElementById('rg-wiring').getBoundingClientRect().top+scrollY, document.getElementById('rg-potEd').getBoundingClientRect().top+scrollY].map(Math.round).join()"))
        check('Schalter/Split/Volume: nichts springt (Schaltplan, Regler)', len(set(tops)) == 1, tops)
        await pg.click('#rg-v3Body'); await pg.wait_for_timeout(100); await pg.click('#rg-v3All'); await pg.wait_for_timeout(100)
        await pg.click('#rg-v3Tog'); await pg.wait_for_timeout(150)
        d2 = await pg.evaluate("({svg:getComputedStyle(document.getElementById('rg-body')).display!=='none'&&document.getElementById('rg-body').innerHTML.length>5000,v3:document.getElementById('rg-v3d').hidden,h:Math.round(document.getElementById('rg-stage').getBoundingClientRect().height)})")
        await pg.click('#rg-v3Tog'); await pg.wait_for_timeout(150)
        d3 = await pg.evaluate("({v3:document.getElementById('rg-v3d').hidden,h:Math.round(document.getElementById('rg-stage').getBoundingClientRect().height)})")
        check('Zeichnung ↔ 3D umschalten, gleiche Bühnenhöhe', d2['svg'] and d2['v3'] and not d3['v3'] and d2['h'] == d3['h'], (d2, d3))
        if SHOT: await pg.click('#rg-posBtns [data-pos=B]'); await shot(pg, 'v146_gitarren_schecter.png')
        await pg.click('[data-g2=strat]'); await wait3d(pg, 'strat'); i = await info(pg)
        s = await st(pg)
        check('Strat: Modell rig/strat.glb geladen, Stellung 2, 3 Pickups', i['strat'] and any(r.endswith('rig/strat.glb') for r in reqs) and s['st']['pos'] == '2' and len(await pg.evaluate("Rig.state().lv.raw ? Object.keys(Rig.state().lv.raw) : []")) == 3, i)
        for k in ['1', '3', '5']:
            await pg.click('#rg-posBtns [data-pos="%s"]' % k); await pg.wait_for_timeout(60)
        check('Strat Stellung 5: nur Neck aktiv', (await st(pg))['lv']['raw'] == {'N': 200, 'M': 0, 'B': 0}, (await st(pg))['lv']['raw'])
        if SHOT: await pg.click('#rg-posBtns [data-pos="2"]'); await shot(pg, 'v146_gitarren_strat.png')
        await pg.click('[data-g2=gibson]'); await wait3d(pg, 'gibson'); i = await info(pg)
        n = await pg.evaluate("document.querySelectorAll('#rg-potEd input').length")
        check('Les Paul Studio: 3D prozedural, 4 Regler, kein Split-Knopf', 'gibson' in i['models'] and n == 4 and await pg.evaluate("document.getElementById('rg-splitWrap').classList.contains('rg-none')"), (i, n))
        if SHOT: await shot(pg, 'v146_gitarren_lespaul.png')
        # Reiter verlassen: kein Zeichnen mehr
        fr = await pg.evaluate("Rig.three().frames")
        await open_tab(pg, 'looper'); await pg.wait_for_timeout(200)
        await pg.set_viewport_size({'width': 1200, 'height': 1000}); await pg.wait_for_timeout(500)
        await pg.evaluate("Rig.three().reset()"); await pg.wait_for_timeout(200)
        fr2 = await pg.evaluate("Rig.three().frames")
        await pg.set_viewport_size({'width': 1366, 'height': 1024})
        check('Looper offen: 3D zeichnet nicht (Größe/Kamera geändert)', fr2 == fr, (fr, fr2))
        await to_rig(pg); await pg.wait_for_timeout(400)
        check('Zurück in Rig: Gitarren-Ansicht und Les Paul gemerkt, 3D zeichnet wieder', (await st(pg))['view'] == 'guit' and (await st(pg))['gw'] == 'gibson' and await pg.evaluate("Rig.three().frames") > fr2)
        # ---------- Geräte-Profile ----------
        await pg.evaluate("Geraet.set('old')"); await pg.wait_for_timeout(300); await wait3d(pg, 'gibson'); i = await info(pg)
        check('Altes iPad: 3D mit Pixelverhältnis 1, ohne Spiegelung/Klarlack', i['pr'] == 1 and not i['env'] and i['cc'] == 0, i)
        await pg.click('#rg-v3Tog'); await pg.wait_for_timeout(150)
        f = await pg.evaluate("(()=>{const s=document.getElementById('rg-body').innerHTML;return {f:(s.match(/filter=/g)||[]).length,blur:s.includes('blur(')}})()")
        await pg.click('#rg-v3Tog'); await pg.wait_for_timeout(150)
        check('Altes iPad: Zeichnung ohne SVG-Filter', f['f'] == 0 and not f['blur'], f)
        await pg.evaluate("Geraet.set('min')"); await pg.wait_for_timeout(300)
        m = await pg.evaluate("({t:Rig.three(),svg:getComputedStyle(document.getElementById('rg-body')).display!=='none',dis:document.getElementById('rg-v3Tog').disabled,hint:document.getElementById('rg-v3Hint').textContent})")
        check('Minimal: 3D freigegeben, nur Zeichnung, 3D-Knopf aus', m['t'] is None and m['svg'] and m['dis'] and 'Minimal' in m['hint'], m)
        await pg.evaluate("Geraet.set('auto')"); await pg.wait_for_timeout(300); await wait3d(pg, 'gibson'); i = await info(pg)
        check('Automatisch (headless → Neues iPad): 3D wieder voll', i['env'] and i['cc'] > 0, i)
        await pg.evaluate("Geraet.set('new')"); await pg.wait_for_timeout(300); await wait3d(pg, 'gibson'); i = await info(pg)
        check('Neues iPad: 3D voll', i['env'] and i['cc'] > 0, i)
        ext = [r for r in reqs if not r.startswith('http://localhost:8765/') and not r.startswith('data:') and not r.startswith('blob:')]
        check('keine fremden Anfragen', not ext, ext[:3])
        check('keine Skriptfehler', not errs, errs[:3])
        await ctx.close()

        # ---------- Minimal von Anfang an: kein three.js ----------
        ctx, pg, errs, reqs = await page(b, init="if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('3nps-device','min');sessionStorage.setItem('x','1')}")
        await to_rig(pg); await guit(pg); await pg.wait_for_timeout(1500)
        for gw in ['strat', 'gibson', 'schecter']:
            await pg.click('[data-g2=%s]' % gw); await pg.wait_for_timeout(150)
        check('Profil Minimal: Gitarren öffnen lädt kein three.js/Modell', not threereq(reqs) and await pg.evaluate("Rig.three()===null"), threereq(reqs))
        check('Minimal: keine Skriptfehler', not errs, errs[:3])
        await ctx.close()

        # ---------- Retina (neues iPad), letzte Ansicht nach Neustart, EN ----------
        ctx, pg, errs, reqs = await page(b, w=1366, h=1024, dpr=2, init="if(!sessionStorage.getItem('x')){localStorage.clear();sessionStorage.setItem('x','1')}")
        await to_rig(pg)
        if SHOT: await pg.wait_for_timeout(300); await pg.screenshot(path=SHOT + '/v146_sounds.png')
        await guit(pg); await wait3d(pg, 'schecter'); i = await info(pg)
        check('Neues iPad mit Retina: Pixelverhältnis 2', i['pr'] == 2, i)
        await pg.reload(); await pg.wait_for_timeout(900)
        check('Neustart: Rig + Gitarren wieder offen (3nps-tab, 3nps-rig)', await pg.evaluate("AppNav.current()") == 'rig' and await pg.evaluate("!!window.Rig && Rig.view()") == 'guit')
        check('Retina: keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        ctx, pg, errs, reqs = await page(b, url=U + '?lang=en', init="if(!sessionStorage.getItem('x')){localStorage.clear();sessionStorage.setItem('x','1')}")
        await to_rig(pg); await pg.wait_for_timeout(400)
        t = await pg.inner_text('#panel-rig')
        check('EN: Haupt-Beschriftungen englisch', all(x.lower() in t.lower() for x in ['Guitars', 'Target device', 'Sound library', 'Signal chain', 'Copy prompt', 'Save as my sound', 'On the guitar']) and 'Signalkette' not in t and 'Guitar settings:' in t, t[:200])
        await guit(pg); await pg.wait_for_timeout(400); t = await pg.inner_text('#panel-rig')
        check('EN: Gitarren-Ansicht', all(x.lower() in t.lower() for x in ['Pickup selector', 'What is happening', 'Explanation', 'Wiring']), t[:200])
        check('EN: keine Skriptfehler', not errs, errs[:3])
        await ctx.close()

        # ---------- Telefon + iPad hochkant ----------
        for (w, h) in [(390, 844), (820, 1180)]:
            ctx, pg, errs, reqs = await page(b, w=w, h=h, dpr=2, init="if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('3nps-device','old');sessionStorage.setItem('x','1')}")
            g = await pg.evaluate("(()=>{const n=document.querySelector('.tabs.areas');return {ow:document.documentElement.scrollWidth<=innerWidth+1,h:Math.round(n.getBoundingClientRect().height)}})()")
            await to_rig(pg); await pg.wait_for_timeout(300)
            o1 = await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            await guit(pg); await wait3d(pg, 'schecter'); await pg.wait_for_timeout(300)
            o2 = await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            check('%d×%d: Bereichsleiste einzeilig, Rig ohne seitliches Überlaufen (Sounds + Gitarren)' % (w, h), g['ow'] and g['h'] < 70 and o1 and o2, (g, o1, o2))
            check('%d×%d: keine Skriptfehler' % (w, h), not errs, errs[:3])
            await ctx.close()

        # ---------- Service Worker (Pages-Nachbau 8790, vorher sh test/pages.sh): nicht vorab, beim ersten Öffnen gespeichert, offline, Update ----------
        if os.environ.get('NOSW') != '1':
            PB = 'http://localhost:8790/3nps/index.html'
            REG = "navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => true)"
            CK = """async()=>{const o={};for(const k of await caches.keys()){const c=await caches.open(k);o[k]=(await c.keys()).map(r=>new URL(r.url).pathname.split('/3nps/')[1])}return o}"""
            ctx, pg, errs, reqs = await page(b, url=PB, init="if(!sessionStorage.getItem('x')){localStorage.clear();sessionStorage.setItem('x','1')}")
            await pg.evaluate(REG); await pg.reload(); await pg.wait_for_timeout(1500)
            c = await pg.evaluate(CK); app = [k for k in c if k.startswith('3nps-v')]
            check('SW: Erst-Installation ohne Rig-Dateien, kein Cache rig-1', app and not any(x.startswith('rig/') for x in c[app[0]]) and 'rig-1' not in c, list(c))
            await to_rig(pg); await guit(pg); await wait3d(pg, 'schecter'); await pg.click('[data-g2=strat]'); await wait3d(pg, 'strat'); await pg.wait_for_timeout(800)
            c = await pg.evaluate(CK); app = [k for k in c if k.startswith('3nps-v')][0]
            lib = sorted(c.get('rig-1', []))
            check('SW: beim ersten Öffnen gespeichert (three.js + Modell in rig-1, Rig-Code im App-Speicher)', 'rig/strat.glb' in lib and 'rig/three/three.module.min.js' in lib and len(lib) == 8 and all(x in c[app] for x in ['rig/rig.js', 'rig/rig.css', 'rig/rig3d.js']), (lib, [x for x in c[app] if x.startswith('rig/')]))
            await ctx.set_offline(True); await pg.reload(); await pg.wait_for_timeout(1500)
            await until(pg, '!!window.Rig', 10000)
            await until(pg, "AppNav.current()==='rig' && Rig.view()==='guit'", 5000)
            await wait3d(pg, 'strat'); await pg.click('[data-g2=gibson]'); await wait3d(pg, 'gibson')
            i = await info(pg); check('SW: offline – Rig öffnet, 3D mit Strat-Modell und Les Paul', i['strat'] and 'gibson' in i['models'], i)
            await ctx.set_offline(False)
            # Update simulieren: App-Speicher als „alte Version“ umbenennen, SW neu installieren → keepRig holt den Rig-Code gleich mit
            await pg.evaluate("""async()=>{const ks=await caches.keys();const cur=ks.find(k=>k.startsWith('3nps-v'));const o=await caches.open(cur),n=await caches.open('3nps-v1');for(const r of await o.keys())await n.put(r,await o.match(r));await caches.delete(cur);return true}""")
            SWF = '/tmp/claude-0/pages/3nps/sw.js'; old = open(SWF, encoding='utf8').read()
            try:   # neue sw.js-Bytes wie bei einem echten Update → Installation läuft (keepRig), danach Aktivierung (alter Speicher weg)
                open(SWF, 'w', encoding='utf8').write(old + '\n// Test-Update\n')
                await pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update()).then(() => true)")
                for _ in range(100):
                    ks = await pg.evaluate("caches.keys()")
                    if '3nps-v1' not in ks and any(k.startswith('3nps-v') for k in ks): break
                    await pg.wait_for_timeout(100)
                await pg.wait_for_timeout(500)
            finally:
                open(SWF, 'w', encoding='utf8').write(old)
            c = await pg.evaluate(CK); app = [k for k in c if k.startswith('3nps-v') and k != '3nps-v1']
            check('SW: Update holt Rig-Code nach (wer Rig benutzt hat), rig-1 bleibt', app and all(x in c[app[0]] for x in ['rig/rig.js', 'rig/rig.css', 'rig/rig3d.js']) and '3nps-v1' not in c and len(c.get('rig-1', [])) == 8, (list(c), app and [x for x in c[app[0]] if x.startswith('rig/')]))
            check('SW: keine Skriptfehler', not [e for e in errs if 'Failed to fetch' not in e], errs[:3])
            await ctx.close()
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
