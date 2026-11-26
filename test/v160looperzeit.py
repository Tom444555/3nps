# v160: Looper-Zeit zählt in die Übezeit (nur wenn „Üben“ aus ist und der Looper läuft – nie doppelt).
# Gestellte Uhr (Date.now über sessionStorage, übersteht Neuladen), „Looper läuft“ gestubbt + Ereignis „looperrun“; dazu ein echter Looper-Lauf.
# SHOT=1 → /tmp/shots/v160_*.png
import asyncio, os, re, json
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/'); SHOT = os.environ.get('SHOT')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))

CLOCK = ("(()=>{let t=+sessionStorage.getItem('__T');if(!t){t=Math.ceil(Date.now()/60000)*60000+60000;sessionStorage.setItem('__T',t);}"
         "window.__T=t;Date.now=()=>window.__T;window.__L=false;window.__H=false;"
         "Object.defineProperty(document,'hidden',{configurable:true,get:()=>!!window.__H});})();")
STUB = "Looper.looping=()=>!!window.__L;0"
M = 60

async def ctxpage(b, w=1366, h=1024, init=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h})
    await ctx.add_init_script(CLOCK)
    if init: await ctx.add_init_script("if(!sessionStorage.getItem('i')){sessionStorage.setItem('i',1);" + init + "}")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    return ctx, pg, errs
async def now(pg): return await pg.evaluate("window.__T")
async def adv(pg, sec): await pg.evaluate(f"window.__T+={int(sec * 1000)};sessionStorage.setItem('__T',window.__T)")
async def tick(pg): return await pg.evaluate("Uebezeit._lp()")
async def L(pg, on):
    v = 'true' if on else 'false'
    await pg.evaluate(f"window.__L={v};document.dispatchEvent(new CustomEvent('looperrun',{{detail:{v}}}))")
async def run_for(pg, sec):   # läuft: alle 30 s ein Zwischenstand (wie der echte Zeitgeber)
    while sec > 0:
        st = min(30, sec); await adv(pg, st); await tick(pg); sec -= st
async def wait(pg, sec): await adv(pg, sec); await tick(pg)
async def units(pg): return await pg.evaluate("Uebezeit.load().u")
async def state(pg): return await pg.evaluate("Uebezeit.load()")
async def reset(pg): await pg.evaluate("localStorage.removeItem('3nps-uebezeit');window.__T=Math.ceil(window.__T/60000)*60000;sessionStorage.setItem('__T',window.__T);Uebezeit._lp();0")
def over(us):   # Einheiten überlappen? (nach Ende sortiert; Start = Ende − Dauer)
    return any(us[i][0] > us[i + 1][0] - us[i + 1][1] for i in range(len(us) - 1))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1000)
        check('ab v160', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 160)
        lp = await pg.evaluate("Uebezeit.LP")
        check('Konstanten: < 60 s verworfen, Pausen bis 2 min, Zwischenstand 30 s', lp == {'MIN': 60000, 'GAP': 120000, 'TICK': 30000, 'LOST': 90000}, lp)
        check('Start: nichts gespeichert, kein Laufzustand', await pg.evaluate("localStorage.getItem('3nps-uebezeit')") is None)
        # echter Looper: Ereignis bei Start/Stopp, looping() bildet Wiedergabe ab
        ev = await pg.evaluate("""(async()=>{const ev=[];document.addEventListener('looperrun',e=>ev.push(e.detail));
            const L=48000,x=new Float32Array(L);for(let i=0;i<L;i++)x[i]=0.1*Math.sin(i/20);
            Looper._setTrackRaw(0,x,48000);const se=Looper.getSession();se.baseL=se.tracks[0].L;await Looper.loadSession(se);
            await new Promise(r=>setTimeout(r,300));if(Looper.looping()){Looper.all();await new Promise(r=>setTimeout(r,300));}
            const a=Looper.looping();ev.length=0;Looper.all();await new Promise(r=>setTimeout(r,400));const b=Looper.looping();
            Looper.all();await new Promise(r=>setTimeout(r,300));return {ev,a,b,c:Looper.looping()};})()""")
        check('echter Looper: „Alle starten“ → looperrun an, „Alle stoppen“ → aus', ev['ev'] == [True, False] and not ev['a'] and ev['b'] and not ev['c'], ev)
        t0 = await now(pg); await pg.evaluate(STUB); await reset(pg)

        # ---------- 1. Looper an → aus, Einheit nach 2 min Pause ----------
        await L(pg, True); d = await state(pg)
        check('Looper an (Üben aus): Looper-Einheit beginnt (ein Schreibvorgang)', d['lp'] and d['lp']['r'] == d['lp']['s'] and not d['u'])
        n0 = await pg.evaluate("window.__n=0;const _s=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='3nps-uebezeit')window.__n++;return _s.call(this,k,v)};0")
        for _ in range(10): await L(pg, True)
        await adv(pg, 10); await tick(pg)
        check('Ereignisse ohne Zustandswechsel / unter 30 s: kein Schreiben', await pg.evaluate("window.__n") == 0, await pg.evaluate("window.__n"))
        await run_for(pg, 5 * M - 10); await L(pg, False)
        d = await state(pg)
        check('Zwischenstände: 10 Schreibvorgänge in 5 min (alle 30 s) + Stopp', await pg.evaluate("window.__n") <= 11, await pg.evaluate("window.__n"))
        check('Stopp: Lauf abgeschlossen (5 min), Einheit wartet 2 min auf Weiterspielen', d['lp'] and d['lp']['r'] is None and d['lp']['a'] == 300000 and not d['u'], d['lp'])
        await wait(pg, 2 * M + 1); us = await units(pg)
        check('nach 2 min: eine Einheit 5 min, Herkunft 3 (Looper), Thema „loop“', len(us) == 1 and us[0][1] == 300 and us[0][2] == 3 and us[0][3] == 'loop' and (await state(pg))['lp'] is None, us)

        # ---------- 2. unter 60 s verworfen ----------
        await reset(pg); await L(pg, True); await run_for(pg, 50); await L(pg, False); await wait(pg, 3 * M)
        check('Lauf 50 s → verworfen', await units(pg) == [] and (await state(pg))['lp'] is None)

        # ---------- 3. Zusammenfassen ----------
        await reset(pg); await L(pg, True); await run_for(pg, 3 * M); await L(pg, False); await wait(pg, 100)
        await L(pg, True); await run_for(pg, 2 * M); await L(pg, False); await wait(pg, 2 * M + 5); us = await units(pg)
        check('3 min + Pause 100 s + 2 min → eine Einheit 5 min (Pause zählt nicht)', len(us) == 1 and us[0][1] == 300, us)
        await reset(pg); await L(pg, True); await run_for(pg, 3 * M); await L(pg, False); await wait(pg, 130)
        await L(pg, True); await run_for(pg, 2 * M); await L(pg, False); await wait(pg, 2 * M + 5); us = await units(pg)
        check('Pause 130 s → zwei Einheiten 3 + 2 min', [u[1] for u in us] == [180, 120], us)
        await reset(pg); await L(pg, True); await run_for(pg, 40); await L(pg, False); await wait(pg, 60)
        await L(pg, True); await run_for(pg, 40); await L(pg, False); await wait(pg, 2 * M + 5); us = await units(pg)
        check('40 s + Pause 1 min + 40 s → zusammen 80 s ≥ 1 min → 1 Einheit (1 min)', len(us) == 1 and us[0][1] == 60, us)

        # ---------- 4. „Üben“ an/aus während der Looper läuft – nie doppelt ----------
        await reset(pg); tA = await now(pg)
        await L(pg, True); await run_for(pg, 3 * M)
        await pg.evaluate("Uebezeit.on()"); d = await state(pg)
        check('„Üben“ an bei laufendem Looper: Looper-Einheit endet sofort (3 min), Schalter ab jetzt', len(d['u']) == 1 and d['u'][0][1] == 180 and d['u'][0][2] == 3 and d['run']['s'] == tA + 180000 and d['lp'] is None, d)
        await run_for(pg, 4 * M); d = await state(pg)
        check('während „Üben“ an: keine Looper-Einheit', d['lp'] is None and len(d['u']) == 1)
        await pg.evaluate("Uebezeit.off()"); d = await state(pg)
        check('„Üben“ aus bei laufendem Looper: Üben-Einheit 4 min, Looper-Einheit beginnt jetzt', len(d['u']) == 2 and d['u'][1][1] == 240 and d['u'][1][2] == 0 and d['lp'] and d['lp']['s'] == tA + 420000, d)
        await run_for(pg, 2 * M); await L(pg, False); await wait(pg, 2 * M + 5); us = await units(pg)
        check('danach Looper 2 min → drei Einheiten 3 + 4 + 2 min, Summe = 9 min Spielzeit', [u[1] for u in us] == [180, 240, 120] and [u[2] for u in us] == [3, 0, 3], us)
        check('keine Überlappung (Ende ≤ Beginn der nächsten)', not over(us), us)
        # „Üben“ an vor dem Looper
        await reset(pg); await pg.evaluate("Uebezeit.on()"); await L(pg, True); await run_for(pg, 3 * M)
        check('„Üben“ schon an, Looper startet: nichts Zusätzliches', (await state(pg))['lp'] is None)
        await L(pg, False); await run_for(pg, M); await pg.evaluate("Uebezeit.off()"); await wait(pg, 3 * M); us = await units(pg)
        check('… nur die Üben-Einheit (4 min)', [(u[1], u[2]) for u in us] == [(240, 0)], us)
        # Pause der Looper-Einheit, dann „Üben“ an → Looper-Einheit endet (kein Zusammenfassen über Üben hinweg)
        await reset(pg); await L(pg, True); await run_for(pg, 2 * M); await L(pg, False); await wait(pg, 30)
        await pg.evaluate("Uebezeit.on()"); await run_for(pg, 2 * M); await pg.evaluate("Uebezeit.off()")
        await L(pg, True); await run_for(pg, 2 * M); await L(pg, False); await wait(pg, 3 * M); us = await units(pg)
        check('Looper 2 · Pause · Üben 2 · Looper 2 → drei Einheiten, keine Überlappung', [(u[1], u[2]) for u in us] == [(120, 3), (120, 0), (120, 3)] and not over(us), us)

        # ---------- 5. Schalter „Looper-Zeit mitzählen“ ----------
        await reset(pg); await pg.evaluate("Uebezeit.setLz(false)"); await L(pg, True); await run_for(pg, 5 * M); await L(pg, False); await wait(pg, 3 * M)
        check('Schalter Aus: nichts gezählt', await units(pg) == [] and (await state(pg))['lz'] == 0)
        await pg.evaluate("Uebezeit.setLz(true)"); await L(pg, True); await run_for(pg, 2 * M)
        await pg.evaluate("Uebezeit.setLz(false)"); d = await state(pg)
        check('Ausschalten mitten im Lauf: Einheit bis jetzt (2 min), danach nichts', len(d['u']) == 1 and d['u'][0][1] == 120 and d['lp'] is None, d['u'])
        await run_for(pg, 2 * M)
        await pg.evaluate("Uebezeit.setLz(true)"); d = await state(pg)
        check('Einschalten bei laufendem Looper: Einheit beginnt jetzt; Vorgabe-Schlüssel entfernt', d['lp'] and d['lp']['r'] == await now(pg) and 'lz' not in d)
        await run_for(pg, M); await L(pg, False); await wait(pg, 3 * M)
        check('… 1 min dazu (2 Einheiten)', [u[1] for u in await units(pg)] == [120, 60])

        # ---------- 6. Hintergrund / eingefroren ----------
        await reset(pg); await L(pg, True); await run_for(pg, 3 * M)
        await pg.evaluate("window.__H=true;document.dispatchEvent(new Event('visibilitychange'))")
        d = await state(pg)
        check('App im Hintergrund: Lauf endet jetzt (3 min)', d['lp']['r'] is None and d['lp']['a'] == 180000)
        await adv(pg, 10 * M)
        await pg.evaluate("window.__H=false;document.dispatchEvent(new Event('visibilitychange'))")
        d = await state(pg)
        check('zurück nach 10 min, Looper läuft noch: alte Einheit 3 min gespeichert, neue beginnt jetzt', [u[1] for u in d['u']] == [180] and d['lp'] and d['lp']['s'] == await now(pg), d)
        await run_for(pg, 2 * M); await L(pg, False); await wait(pg, 3 * M)
        check('Hintergrundzeit zählt nicht (3 + 2 min)', [u[1] for u in await units(pg)] == [180, 120])
        await reset(pg); await L(pg, True); await run_for(pg, 2 * M); await adv(pg, 5 * M); await tick(pg); d = await state(pg)
        check('eingefroren (5 min ohne Zwischenstand): Lauf endet beim letzten Zwischenstand → Einheit 2 min; läuft er noch → neue Einheit', [u[1] for u in d['u']] == [120] and d['lp']['a'] == 0 and d['lp']['r'] == await now(pg), d)
        await run_for(pg, M); await L(pg, False); await wait(pg, 3 * M)
        check('… 2 + 1 min (die 5 min ohne Lebenszeichen zählen nicht)', [u[1] for u in await units(pg)] == [120, 60], await units(pg))
        await reset(pg); await L(pg, True); await run_for(pg, 2 * M); await adv(pg, 100); await tick(pg); d = await state(pg)
        check('eingefroren 100 s (Lücke ≤ 2 min): Lauf endet beim letzten Zwischenstand, gleiche Einheit läuft weiter', d['lp']['a'] == 120000 and d['lp']['r'] == await now(pg) and not d['u'], d['lp'])
        await run_for(pg, M); await L(pg, False); await wait(pg, 3 * M)
        check('… Einheit 3 min (2 + 1, die 100 s fehlen)', [u[1] for u in await units(pg)] == [180], await units(pg))

        # ---------- 7. Neuladen / Absturz mitten im Lauf ----------
        await reset(pg); await L(pg, True); await run_for(pg, 3 * M)
        await pg.reload(); await pg.wait_for_timeout(1000); await pg.evaluate(STUB); d = await state(pg)
        check('Neuladen mitten im Lauf: Lauf endet beim Schließen (3 min), wartet', d['lp'] and d['lp']['r'] is None and d['lp']['a'] == 180000 and not d['u'], d['lp'])
        await adv(pg, 60); await L(pg, True); await run_for(pg, M); await L(pg, False); await wait(pg, 3 * M)
        check('innerhalb 2 min weitergespielt → dieselbe Einheit (4 min), nichts doppelt', [u[1] for u in await units(pg)] == [240], await units(pg))
        await reset(pg); await L(pg, True); await run_for(pg, 2 * M); await adv(pg, 20)
        await pg.evaluate("Storage.prototype.setItem=function(){};0")   # Absturz: das Schließen schreibt nichts mehr
        await pg.reload(); await pg.wait_for_timeout(1000); await pg.evaluate(STUB); d = await state(pg)
        check('Absturz: Lauf endet beim letzten Zwischenstand (2 min, die 20 s danach fehlen)', d['lp'] and d['lp']['r'] is None and d['lp']['a'] == 120000, d['lp'])
        await wait(pg, 3 * M)
        check('… Einheit 2 min gespeichert, nicht weitergezählt bis zum Öffnen', [u[1] for u in await units(pg)] == [120], await units(pg))
        await reset(pg); await L(pg, True); await run_for(pg, 2 * M); await pg.evaluate("Storage.prototype.setItem=function(){};0")
        await pg.reload(); await pg.wait_for_timeout(300); await adv(pg, 3 * 3600); await pg.reload(); await pg.wait_for_timeout(1000); await pg.evaluate(STUB)
        check('nach 3 h wieder geöffnet: Einheit 2 min, kein Laufzustand', [u[1] for u in await units(pg)] == [120] and (await state(pg))['lp'] is None, await state(pg))

        # ---------- 8. Liste, Übersicht, Woran geübt, CSV-Rundlauf ----------
        await reset(pg)
        await pg.evaluate("""(()=>{const d=Uebezeit.load(),e=Math.round(window.__T/1000/60)*60;
            d.u=[[e-86400*3,1800,1,'tech',''],[e-86400*2,2400,0,'tl','Box 1'],[e-86400,600,2,'',''],[e-7200,900,3,'loop','']];Uebezeit.save(d);})();0""")
        await L(pg, True); await run_for(pg, 6 * M); await L(pg, False); await wait(pg, 3 * M)
        us = await units(pg)
        check('Looper-Einheit neben Import/Üben/nachgetragen', [u[2] for u in us] == [1, 0, 2, 3, 3] and us[-1][1] == 360, us)
        await open_tab(pg, 'uebezeit'); await pg.wait_for_timeout(600)
        lst = await pg.inner_text('#uzList')
        check('Liste: Kennzeichen „Looper“ und Thema „Looper/Jammen“', 'Looper' in lst and 'Looper/Jammen' in lst, lst[:120])
        if SHOT:
            await pg.evaluate("document.getElementById('uzListCard').scrollIntoView({block:'start'});window.scrollBy(0,-110)"); await pg.wait_for_timeout(200)
            await pg.screenshot(path='/tmp/shots/v160_liste.png')
        th = await pg.inner_text('#uzTh'); sm = await pg.inner_text('#uzSums')
        check('„Woran geübt“: Looper/Jammen 21 min; Insgesamt 1 h 41 min', 'Looper/Jammen' in th and '21' in th and '1 h 41' in sm, (th[:160], sm[:160]))
        sw = await pg.evaluate("(()=>{const b=document.getElementById('uzLz'),r=b.getBoundingClientRect();return {t:b.textContent,h:r.height,p:b.getAttribute('aria-pressed'),x:document.getElementById('uzLzTx').textContent}})()")
        check('Seite „Übezeit“: Schalter „Looper-Zeit mitzählen: An“ (Vorgabe), ≥ 44 px, Erklärung', sw['t'] == 'Looper-Zeit mitzählen: An' and sw['p'] == 'true' and sw['h'] >= 44 and 'Üben' in sw['x'], sw)
        await L(pg, True); await run_for(pg, 90); await pg.wait_for_timeout(100)
        x = await pg.inner_text('#uzLzTx')
        check('läuft: „● Looper läuft – zählt mit · seit … · 1 min“', 'Looper läuft' in x and '1 min' in x, x)
        if SHOT:
            await pg.evaluate("document.querySelector('.uz-sw').scrollIntoView({block:'start'});window.scrollBy(0,-110)"); await pg.wait_for_timeout(200)
            await pg.screenshot(path='/tmp/shots/v160_schalter.png')
        await L(pg, False); await wait(pg, 3 * M)
        await pg.click('#uzLz'); await pg.wait_for_timeout(100)
        check('Schalter antippen → Aus (gespeichert)', await pg.inner_text('#uzLz') == 'Looper-Zeit mitzählen: Aus' and (await state(pg))['lz'] == 0)
        await pg.click('#uzLz'); await pg.wait_for_timeout(100)
        csv = await pg.evaluate("Uebezeit.csv()")
        check('CSV: Looper-Einheit mit „Looper/Jammen … [Looper]“', csv.count('[Looper]') == 3 and 'Looper/Jammen [Looper]' in csv, csv.count('[Looper]'))
        before = await state(pg); bs = await pg.evaluate("Uebezeit.sums(Uebezeit.load(),window.__T)")
        await pg.evaluate("localStorage.removeItem('3nps-uebezeit');0")
        r = await pg.evaluate("(async()=>{const f=new File([%s],'x.csv',{type:'text/csv'});return await Uebezeit.importFile(f)})()" % json.dumps(csv))
        after = await state(pg); as_ = await pg.evaluate("Uebezeit.sums(Uebezeit.load(),window.__T)")
        check('Export → leer → Import: dieselben Einheiten (Ende, Dauer, Herkunft, Thema) und Summen', sorted(map(tuple, [u[:4] for u in before['u']])) == sorted(map(tuple, [u[:4] for u in after['u']])) and bs == as_, (r, bs['gesamt'], as_['gesamt']))
        lu = [u for u in after['u'] if u[2] == 3][-1]
        vl = await pg.evaluate("Uebezeit.merge([{ts:%d,durationSec:300,bpm:90}]).filter(s=>!s.uz)[0].durationSec" % ((lu[0] - lu[1] // 2) * 1000))
        check('Übe-Verlauf: Metronom-Zeit innerhalb einer Looper-Einheit zählt nicht doppelt', vl == 0, vl)
        check('keine Skriptfehler (Abläufe)', not errs, errs[:2])
        await ctx.close()

        # ---------- 9. Hinweis „Übe-Verlauf“, englisch ----------
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(900); await open_tab(pg, 'griffbrett'); await pg.click('#pvFold>summary'); await pg.wait_for_timeout(600)
        nt = await pg.evaluate("(document.querySelector('.pv-note')||{}).textContent||''")
        check('Übe-Verlauf: Hinweis nennt Looper-Zeit und Schalter', 'Looper-Zeit mitzählen' in nt and 'nicht mitgezählt' not in nt, nt[-120:])
        await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500); await open_tab(pg, 'uebezeit'); await pg.wait_for_timeout(500)
        check('englisch: „Count looper time: on“', await pg.inner_text('#uzLz') == 'Count looper time: on', await pg.inner_text('#uzLz'))
        check('keine Skriptfehler (Hinweis/EN)', not errs, errs[:2])
        await ctx.close()

        # ---------- 10. Geräte-Profile + Größen ----------
        for w, hh in [(1366, 1024), (820, 1180), (390, 844)]:
            for dev in ['auto', 'new', 'old', 'min']:
                if w != 1366 and dev not in ('auto', 'min'): continue
                ctx, pg, errs = await ctxpage(b, w, hh, "localStorage.setItem('3nps-device','%s');" % dev)
                await pg.goto(U + 'index.html'); await pg.wait_for_timeout(800); await pg.evaluate(STUB)
                await L(pg, True); await run_for(pg, 2 * M); await L(pg, False); await wait(pg, 3 * M)
                u1 = [u[1] for u in await units(pg)]
                await open_tab(pg, 'uebezeit'); await pg.wait_for_timeout(400)
                g = await pg.evaluate("(()=>{const b=document.getElementById('uzLz'),c=b.closest('.card').getBoundingClientRect(),r=b.getBoundingClientRect(),x=document.getElementById('uzLzTx').getBoundingClientRect();return {h:r.height>=44,in:r.left>=c.left&&r.right<=c.right+1&&x.right<=c.right+1,ov:document.documentElement.scrollWidth<=innerWidth+1}})()")
                if SHOT and w == 390 and dev == 'auto':
                    await pg.evaluate("document.querySelector('.uz-lz').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
                    await pg.screenshot(path='/tmp/shots/v160_schalter_390.png')
                check(f'{w}/{dev}: Looper 2 min gezählt, Schalter ≥ 44 px in der Karte, keine Skriptfehler', u1 == [120] and all(g.values()) and not errs, (u1, g, errs[:1]))
                await ctx.close()
        await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
