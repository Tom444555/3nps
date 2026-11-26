# v159: Pedal-Aktionen „Tap (Tempo)“ und Tonleiter-Trainer (Start/Stopp, Weiter, geschafft, langsamer).
# Standard-Belegung unverändert, alte gespeicherte Belegung bleibt; Trainer-Aktionen wirken nur bei offener Seite und laden nichts.
# SHOT=1 → /tmp/shots/v159_*.png
import asyncio, os, re, json
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/'); SHOT = os.environ.get('SHOT')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))

DEF = {'foot0': {'tap': 'foot:0', 'hold': 'undo:0', 'dbl': 'none'}, 'foot1': {'tap': 'foot:1', 'hold': 'undo:1', 'dbl': 'none'},
       'foot2': {'tap': 'foot:2', 'hold': 'undo:2', 'dbl': 'none'}, 'all': {'tap': 'all', 'hold': 'none', 'dbl': 'none'}}
OLD = {'foot0': {'tap': 'foot:0', 'hold': 'undo:0', 'dbl': 'prac'}, 'foot1': {'tap': 'pracNext', 'hold': 'tuner', 'dbl': 'none'},
       'foot2': {'tap': 'sceneNext', 'hold': 'scenePrev', 'dbl': 'amp'}, 'all': {'tap': 'pause', 'hold': 'undo', 'dbl': 'stop:1'}}
NEW = {'foot0': {'tap': 'tl:go', 'hold': 'none', 'dbl': 'none'}, 'foot1': {'tap': 'tl:next', 'hold': 'none', 'dbl': 'none'},
       'foot2': {'tap': 'tap', 'hold': 'tl:slow', 'dbl': 'none'}, 'all': {'tap': 'tl:done', 'hold': 'none', 'dbl': 'none'}}
TL = "localStorage.setItem('3nps-tonleiter',JSON.stringify({v:1,s:{f:'pmin',r:9,l:1,x:'ud',fg:0},t:{a:80,z:120,st:4,n:0,nv:2,vz:0},b:{'pmin.9.1.ud':[96,Math.round(Date.now()/1000)-86400]},h:[]}));"

async def ctxpage(b, w=1366, h=1024, init=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h})
    if init: await ctx.add_init_script("if(!sessionStorage.getItem('i')){sessionStorage.setItem('i',1);" + init + "}")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    return ctx, pg, errs
async def ready(pg):
    for _ in range(80):
        if await pg.evaluate("!!window.Tonleiter && Tonleiter.built() && !!document.getElementById('tlGo')"): return True
        await pg.wait_for_timeout(50)
    return False
async def key(pg, k, wait=150):
    await pg.focus('#pedalSink'); await pg.keyboard.press(k); await pg.wait_for_timeout(wait)
st = lambda pg: pg.evaluate("Tonleiter.state()")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        # ---------- Standard + Listen ----------
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1000)
        check('ab v159', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 159)
        check('Standard-Belegung unverändert', await pg.evaluate("Pedal.acts()") == DEF, await pg.evaluate("Pedal.acts()"))
        check('nichts gespeichert ohne Änderung', await pg.evaluate("localStorage.getItem('3nps-pedal-acts')") is None)
        opts = await pg.evaluate("[...document.querySelectorAll('#pedalActs select')].map(s=>[...s.options].map(o=>o.value))")
        check('alle 12 Auswahllisten haben die neuen Aktionen', len(opts) == 12 and all(all(v in o for v in ['tap', 'tl:go', 'tl:next', 'tl:done', 'tl:slow']) for o in opts))
        check('bisherige Aktionen weiter in den Listen (20)', all(len(o) >= 24 for o in opts), len(opts[0]))
        lbl = await pg.evaluate("[...document.querySelector('#pedalActs select').options].filter(o=>/^(tap|tl:)/.test(o.value)).map(o=>o.text)")
        check('Namen: „Tap (Tempo)“, „Trainer: Start / Stopp“, „Trainer: Weiter …“', lbl[:3] == ['Tap (Tempo)', 'Trainer: Start / Stopp', 'Trainer: Weiter (nächste Lage/Übung)'], lbl)
        # Trainer-Aktion auf der Looper-Seite: nichts geladen, kein Fehler
        await pg.evaluate("Pedal.run('tl:go');Pedal.run('tl:next');Pedal.run('tl:done');Pedal.run('tl:slow')"); await pg.wait_for_timeout(300)
        check('Trainer-Aktion ohne offene Seite: tonleiter.js nicht geladen', await pg.evaluate("!window.Tonleiter && ![...document.scripts].some(s=>/tonleiter/.test(s.src))"))
        # Englisch
        await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500)
        en = await pg.evaluate("[...document.querySelector('#pedalActs select').options].filter(o=>/^(tap|tl:)/.test(o.value)).map(o=>o.text)")
        check('englisch: „Tap (tempo)“, „Trainer: start / stop“', 'Tap (tempo)' in en and 'Trainer: start / stop' in en, en)
        await open_tab(pg, 'tonleiter'); await ready(pg); await pg.wait_for_timeout(200)
        hint = await pg.evaluate("(document.querySelector('.tl-pedal')||{}).textContent||''")
        check('englisch: Hinweis im Trainer', 'Assign switches' in hint, hint[:60])
        check('keine Skriptfehler (Standard)', not errs, errs[:2])
        await ctx.close()

        # ---------- alte gespeicherte Belegung bleibt ----------
        ctx, pg, errs = await ctxpage(b, init="localStorage.setItem('3nps-pedal-acts',%s);" % json.dumps(json.dumps(OLD)))
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(900)
        check('alte gespeicherte Belegung bleibt unverändert', await pg.evaluate("Pedal.acts()") == OLD, await pg.evaluate("Pedal.acts()"))
        sel = await pg.evaluate("[...document.querySelectorAll('#pedalActs select')].map(s=>s.dataset.slot+'.'+s.dataset.w+'='+s.value)")
        check('Auswahllisten zeigen die alte Belegung', all(f'{k}.{w}={v}' in sel for k, d in OLD.items() for w, v in d.items()))
        await pg.evaluate("window.__pn=0;Looper.pracNext=()=>{window.__pn++};0")
        await key(pg, 'ArrowDown', 300)   # Taste B tippen = pracNext (alte Aktion wirkt weiter)
        check('alte Aktion wirkt weiter (Taste B → „Übe-Tempo nächste Stufe“)', await pg.evaluate("window.__pn") == 1, await pg.evaluate("[window.__pn,document.getElementById('pedalLast').textContent,document.activeElement.id]"))
        check('keine Skriptfehler (alte Belegung)', not errs, errs[:2])
        await ctx.close()

        # ---------- Tap per Pedal = Tap per Knopf ----------
        ctx, pg, errs = await ctxpage(b, init="localStorage.setItem('3nps-pedal-acts',%s);" % json.dumps(json.dumps(NEW)) + TL)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(900)
        await pg.evaluate("document.getElementById('bpm').value=80;document.getElementById('bpm').dispatchEvent(new Event('input',{bubbles:true}))")
        for _ in range(4): await key(pg, 'ArrowLeft', 500)
        v1 = await pg.evaluate("+document.getElementById('bpm').value")
        check('Pedal „Tap (Tempo)“ 4× im Abstand 0,5 s → ~120 BPM', abs(v1 - 120) <= 4, v1)
        await pg.wait_for_timeout(2200)
        await pg.evaluate("document.getElementById('bpm').value=80;document.getElementById('bpm').dispatchEvent(new Event('input',{bubbles:true}))")
        for _ in range(4): await pg.dispatch_event('#bpmTap', 'pointerdown'); await pg.wait_for_timeout(500)
        v2 = await pg.evaluate("+document.getElementById('bpm').value")
        check('Knopf „Tap“ gleich schnell getippt → gleiches Tempo (±3)', abs(v1 - v2) <= 3, (v1, v2))
        await pg.wait_for_timeout(2200)
        await pg.evaluate("document.getElementById('bpm').value=80;document.getElementById('bpm').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('bpmTap').disabled=true")
        for _ in range(3): await key(pg, 'ArrowLeft', 400)
        check('gesperrter Knopf „Tap“ → Pedal tut nichts', await pg.evaluate("+document.getElementById('bpm').value") == 80)
        await pg.evaluate("document.getElementById('bpmTap').disabled=false")
        await pg.wait_for_timeout(2200)
        await key(pg, 'ArrowLeft', 300)
        check('ein einzelner Tritt ändert nichts (wie beim Knopf)', await pg.evaluate("+document.getElementById('bpm').value") == 80)
        await pg.wait_for_timeout(2200)

        # ---------- Trainer-Aktionen ----------
        await key(pg, 'ArrowUp', 300)
        check('Looper-Seite: „Trainer: Start / Stopp“ lädt nichts', await pg.evaluate("!window.Tonleiter"))
        await open_tab(pg, 'tonleiter'); await ready(pg); await pg.wait_for_timeout(200)
        hint = await pg.evaluate("(document.querySelector('.tl-pedal')||{}).textContent||''")
        check('Hinweis in der Seite nennt Aktionen und Ort', 'Trainer: Start / Stopp' in hint and 'Tasten belegen' in hint, hint[:80])
        s0 = await st(pg)
        await key(pg, 'ArrowUp', 400); s1 = await st(pg)
        check('„Trainer: Start / Stopp“ startet', not s0['run'] and s1['run'])
        await key(pg, 'ArrowDown', 300); s2 = await st(pg)
        check('„Trainer: Weiter“ → nächste Lage, läuft weiter', s2['sel']['l'] == 2 and s2['sel']['x'] == 'ud' and s2['run'], s2['sel'])
        for _ in range(3): await key(pg, 'ArrowDown', 120)
        s3 = await st(pg)
        check('nach der letzten Lage (5) → Lage 1, nächste Übung', s3['sel']['l'] == 5 and s3['sel']['x'] == 'ud', s3['sel'])
        await key(pg, 'ArrowDown', 200); s4 = await st(pg)
        check('… Lage 1 · 3er-Gruppen', s4['sel']['l'] == 1 and s4['sel']['x'] == 's3', s4['sel'])
        await pg.evaluate("document.querySelector('#tlLage [data-l=\"all\"]').click()"); await pg.wait_for_timeout(150)
        await key(pg, 'ArrowDown', 200); s5 = await st(pg)
        check('bei „Alle“ Lagen → nächste Übung, „Alle“ bleibt', s5['sel']['l'] == 'all' and s5['sel']['x'] == 's4', s5['sel'])
        await pg.evaluate("document.querySelector('#tlLage [data-l=\"1\"]').click()"); await pg.wait_for_timeout(150)
        b0 = (await st(pg))['bpm']
        await key(pg, 'ArrowRight', 200); s6 = await st(pg)
        check('„Trainer: geschafft → schneller“ speichert Bestwert, eine Stufe schneller', s6['bpm'] == min(120, b0 + 4) and 'pmin.9.1.s4' in s6['S']['b'], (b0, s6['bpm']))
        await pg.evaluate("Pedal.run('tl:slow')"); await pg.wait_for_timeout(150); s7 = await st(pg)
        check('„Trainer: zu schnell → langsamer“ eine Stufe langsamer', s7['bpm'] == s6['bpm'] - 4, (s6['bpm'], s7['bpm']))
        await pg.wait_for_timeout(2100)   # Tap-Folge abgelaufen: der Tritt selbst setzt kein Tempo
        await pg.focus('#pedalSink'); await pg.keyboard.down('ArrowLeft'); await pg.wait_for_timeout(900); await pg.keyboard.up('ArrowLeft'); await pg.wait_for_timeout(200)
        s8 = await st(pg)
        check('Halten (Taste C) → langsamer; Halte-Erkennung unverändert', s8['bpm'] == s7['bpm'] - 4, (s7['bpm'], s8['bpm']))
        await pg.evaluate("document.getElementById('tlSlow').disabled=true"); await pg.evaluate("Pedal.run('tl:slow')")
        check('gesperrter Knopf → Pedal tut nichts', (await st(pg))['bpm'] == s8['bpm'])
        await pg.evaluate("document.getElementById('tlSlow').disabled=false")
        if SHOT:
            await pg.evaluate("document.getElementById('tlMet').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(300)
            await pg.screenshot(path='/tmp/shots/v159_trainer_hinweis.png')
        await key(pg, 'ArrowUp', 300)
        check('zweiter Tritt stoppt', not (await st(pg))['run'])
        sv = (await st(pg))['sel']
        await key(pg, 'ArrowUp', 300)
        await open_tab(pg, 'looper'); await pg.wait_for_timeout(300)
        check('Seite verlassen stoppt den Trainer', not (await st(pg))['run'])
        await key(pg, 'ArrowUp', 300); await key(pg, 'ArrowDown', 200)
        s9 = await st(pg)
        check('andere Seite: Trainer-Aktionen tun nichts', not s9['run'] and s9['sel'] == sv and sv['l'] == 1, (sv, s9['sel']))
        if SHOT:
            await pg.evaluate("document.getElementById('pedalActsBox').open=true;document.getElementById('pedalActsBox').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
            await pg.screenshot(path='/tmp/shots/v159_belegung.png')
        check('keine Skriptfehler (Tap + Trainer)', not errs, errs[:2])
        await ctx.close()

        # ---------- Geräte-Profile + Größen ----------
        for w, hh in [(1366, 1024), (820, 1180), (390, 844)]:
            for dev in ['auto', 'new', 'old', 'min']:
                if w != 1366 and dev not in ('auto', 'min'): continue
                ctx, pg, errs = await ctxpage(b, w, hh, "localStorage.setItem('3nps-device','%s');localStorage.setItem('3nps-pedal-acts',%s);" % (dev, json.dumps(json.dumps(NEW))) + TL)
                await pg.goto(U + 'index.html'); await pg.wait_for_timeout(800)
                await open_tab(pg, 'tonleiter'); await ready(pg); await pg.wait_for_timeout(200)
                await key(pg, 'ArrowUp', 300); r1 = (await st(pg))['run']
                await key(pg, 'ArrowDown', 200); l2 = (await st(pg))['sel']['l']
                await key(pg, 'ArrowUp', 200); r2 = (await st(pg))['run']
                g = await pg.evaluate("(()=>{const e=document.querySelector('.tl-pedal');if(!e)return null;const r=e.getBoundingClientRect(),c=e.closest('.card').getBoundingClientRect();return {in:r.left>=c.left-1&&r.right<=c.right+1,vis:r.height>0,ov:document.documentElement.scrollWidth<=innerWidth+1}})()")
                check(f'{w}/{dev}: Start/Weiter/Stopp per Pedal, Hinweis passt in die Karte, keine Skriptfehler', r1 and l2 == 2 and not r2 and g and g['in'] and g['vis'] and g['ov'] and not errs, (r1, l2, r2, g, errs[:1]))
                await ctx.close()
        await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
