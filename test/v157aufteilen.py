# v157: Knopf „Üben“ mittig in der Looper-Karte und leuchtend im An-Zustand; Einheit nachträglich aufteilen („Zeit aufteilen“, „Aufteilung aufheben“).
# Lage/Größe in 390/820/1366 × ios/nordic/precise-dark × Profile, Karte nicht höher (An = Aus, Kopf ≤ Titelhöhe), kein Sprung; Leucht-Stil je Profil;
# Aufteilen inkl. Rest, Überschreiten abgelehnt, Aufheben, erneutes Ändern, Summen gleich, Export → leer → Import. Erfundene Daten.
import asyncio, os, re, json
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
L = "JSON.parse(localStorage.getItem('3nps-uebezeit')||'null')"
M = """(()=>{const c=document.querySelector('.looper-card'),h=c.querySelector('.card-head'),b=document.getElementById('uebenBtn'),t=h.querySelector('h2'),i=document.getElementById('loopInfo');
const r=e=>{const x=e.getBoundingClientRect();return {l:x.left,t:x.top,w:x.width,h:x.height,r:x.right,b:x.bottom}};const a=getComputedStyle(b,'::after'),s=getComputedStyle(b);
return {card:r(c),head:r(h),btn:r(b),h2:r(t),info:r(i),bg:s.backgroundColor,bc:s.borderTopColor,txt:b.textContent,an:a.animationName,ad:a.display,ash:a.boxShadow,lh:parseFloat(getComputedStyle(t).lineHeight)||0}})()"""
RUN = "localStorage.setItem('3nps-uebezeit',JSON.stringify({v:1,run:{s:Date.now()-%d*60000},th:'',nt:'',u:[]}))"
LONG = "document.getElementById('loopInfo').textContent='Loop 4 Takte · 12,3 s · Übe-Tempo 85 % · sehr langer Statustext zum Prüfen'"
def unit(end_min_ago, dur_min, k=0, th='', nt=''):
    return "[Math.round((Date.now()-%d*60000)/60000)*60,%d,%d,%s,%s]" % (end_min_ago, dur_min * 60, k, json.dumps(th), json.dumps(nt))

async def lage(b, th, w, h, dev, errs, motion='no-preference'):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, reduced_motion=motion); pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(f"if(!sessionStorage.getItem('i')){{sessionStorage.setItem('i',1);localStorage.setItem('3nps-theme2','{th}');localStorage.setItem('3nps-device','{dev}');localStorage.removeItem('3nps-uebezeit')}}")
    await pg.goto(U + 'index.html'); await pg.wait_for_timeout(800)
    a = await pg.evaluate(M)
    await pg.evaluate(RUN % 754); await pg.reload(); await pg.wait_for_timeout(800); await pg.evaluate(LONG); await pg.wait_for_timeout(50)
    n = await pg.evaluate(M)
    await ctx.close(); return a, n

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        errs = []
        # ---------- Lage, Größe, kein Sprung, Leuchten ----------
        for th in ('ios', 'nordic', 'precise-dark'):
            for w, h in ((390, 844), (820, 1180), (1366, 1024)):
                for dev in (('auto', 'new', 'old', 'min') if w == 820 else ('new',)):
                    a, n = await lage(b, th, w, h, dev, errs)
                    tag = f'{th}/{dev} {w}:'
                    cm = a['card']['l'] + a['card']['w'] / 2
                    check(f'{tag} Knopf waagrecht mittig, ≥ 44 px hoch, auf einer Linie mit Titel und Status',
                          abs(a['btn']['l'] + a['btn']['w'] / 2 - cm) <= 1 and a['btn']['h'] >= 44 and a['btn']['w'] >= 100
                          and abs((a['btn']['t'] + a['btn']['b']) / 2 - (a['head']['t'] + a['head']['b']) / 2) <= 1 and abs((a['h2']['t'] + a['h2']['b']) / 2 - (a['info']['t'] + a['info']['b']) / 2) <= 2.5,
                          (round(a['btn']['l'] + a['btn']['w'] / 2 - cm, 1), a['btn']['w'], a['btn']['h']))
                    check(f'{tag} Aus → An: Karte und Kopf gleich hoch, Knopf an derselben Stelle (kein Sprung)',
                          abs(a['card']['h'] - n['card']['h']) < .5 and abs(a['head']['h'] - n['head']['h']) < .5 and a['head']['h'] <= a['h2']['h'] + .5
                          and all(abs(a['btn'][k] - n['btn'][k]) < .5 for k in 'ltwh') and n['txt'] == '● 12:34',
                          (a['card']['h'], n['card']['h'], a['head']['h'], n['head']['h'], n['txt']))
                    check(f'{tag} langer Status bleibt rechts (kein Überlappen), Titel einzeilig',
                          n['info']['l'] >= n['btn']['r'] + 4 and n['info']['r'] <= n['card']['r'] and n['h2']['r'] <= n['btn']['l'] - 4 and n['h2']['h'] <= a['h2']['h'] + .5,
                          (round(n['info']['l'] - n['btn']['r'], 1), round(n['btn']['l'] - n['h2']['r'], 1)))
                    green = n['bg'] == 'rgb(48, 209, 88)'
                    if dev in ('new', 'auto'):
                        check(f'{tag} An: grün gefüllt, Schein + ruhiges Pulsieren', green and n['an'] == 'uz-glow' and '48, 209, 88' in n['ash'] and n['ad'] != 'none', (n['bg'], n['an'], n['ash'][:40]))
                    elif dev == 'old':
                        check(f'{tag} An (Altes iPad): Füllung + heller Rand, kein Schein, keine Animation', green and n['bc'] == 'rgb(180, 245, 198)' and n['ad'] == 'none', (n['bg'], n['bc'], n['ad']))
                    else:
                        check(f'{tag} An (Minimal): nur Farbe', green and n['bc'] == 'rgb(48, 209, 88)' and n['ad'] == 'none', (n['bg'], n['bc'], n['ad']))
        a, n = await lage(b, 'ios', 820, 1180, 'new', errs, 'reduce')
        check('prefers-reduced-motion: Schein bleibt, kein Pulsieren', n['an'] == 'none' and '48, 209, 88' in n['ash'], (n['an'], n['ash'][:30]))

        # ---------- Looper-Knopf: reines An/Aus ohne Themenwahl; Hinweis „Zeit aufteilen“ ----------
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, accept_downloads=True); pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.add_init_script("if(!sessionStorage.getItem('i')){sessionStorage.setItem('i',1);localStorage.removeItem('3nps-uebezeit');localStorage.removeItem('3nps-uebezeit-themen')}")
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1000)
        check('ab v157', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 157)
        await pg.click('#uebenBtn'); await pg.wait_for_timeout(100)
        d = await pg.evaluate(L)
        check('Looper „Üben“: einschalten ohne Themenwahl (kein Dialog, Thema leer)', d['run'] and d['th'] == '' and await pg.evaluate("![...document.querySelectorAll('.uz-ask')].some(x=>!x.hidden)"), d)
        await pg.evaluate("(()=>{const d=%s;d.run.s=Date.now()-60*60000;localStorage.setItem('3nps-uebezeit',JSON.stringify(d))})()" % L)
        await pg.click('#uebenBtn'); await pg.wait_for_timeout(150)
        d = await pg.evaluate(L); u0 = d['u'][-1]
        check('Looper „Üben“: ausschalten speichert 60 min ohne Thema, kein Dialog', d['run'] is None and u0[1] == 3600 and u0[3] == '' and await pg.evaluate("![...document.querySelectorAll('.uz-ask')].some(x=>!x.hidden)"), u0)
        await open_tab(pg, 'uebezeit')
        for _ in range(40):
            if await pg.evaluate("!!window.UebezeitAnsicht"): break
            await pg.wait_for_timeout(100)
        await pg.wait_for_timeout(200)
        sw = await pg.evaluate("(()=>{Uebezeit.on();const b=document.getElementById('uzBtn'),s=getComputedStyle(b),a=getComputedStyle(b,'::after');const r=[s.backgroundColor,a.animationName,a.boxShadow.slice(0,40)];Uebezeit.off({drop:true});return r})()")
        check('Großer Schalter der Seite „Übezeit“ leuchtet im An-Zustand genauso', sw[0] == 'rgb(48, 209, 88)' and sw[1] == 'uz-glow' and '48, 209, 88' in sw[2], sw)
        check('Hinweis-Knopf „Zeit aufteilen“ bei der gerade beendeten Einheit', await pg.evaluate("(()=>{const b=document.querySelector('#uzList .uz-row[data-i=\"0\"] .uz-splh');return !!b&&b.textContent==='Zeit aufteilen'&&b.getBoundingClientRect().height>=44})()"))
        # Dialog über den Hinweis-Knopf: Rest gleichmäßig, Überschreiten, Speichern
        await pg.click('#uzList .uz-splh'); await pg.wait_for_timeout(150)
        check('Dialog „Zeit aufteilen“: Gesamtdauer oben, noch zu verteilen 60 min', await pg.is_visible('#uzSplit .uz-spbox') and '1 h 00 min' in await pg.inner_text('.uz-sptot') and '60 min' in await pg.inner_text('#uzSpLeft'), await pg.inner_text('#uzSpLeft'))
        await pg.select_option('#uzSpRows [data-k="0"] select', 'tech'); await pg.fill('#uzSpRows [data-k="0"] [data-f="min"]', '70'); await pg.wait_for_timeout(50)
        check('Überschreiten: „zu viel: 10 min“, Speichern gesperrt', 'zu viel: 10 min' in await pg.inner_text('#uzSpLeft') and await pg.is_disabled('#uzSpSave'), await pg.inner_text('#uzSpLeft'))
        await pg.fill('#uzSpRows [data-k="0"] [data-f="min"]', '20')
        await pg.click('#uzSplit [data-a="add"]'); await pg.select_option('#uzSpRows [data-k="1"] select', 'tl')
        await pg.click('#uzSplit [data-a="add"]'); await pg.select_option('#uzSpRows [data-k="2"] select', 'imp'); await pg.fill('#uzSpRows [data-k="2"] [data-f="nt"]', 'Licks Lage 5')
        await pg.click('#uzSplit [data-a="even"]'); await pg.wait_for_timeout(50)
        mins = await pg.evaluate("[...document.querySelectorAll('#uzSpRows [data-f=\"min\"]')].map(x=>+x.value)")
        check('„Rest gleichmäßig verteilen“: 40 min auf 3 Zeilen → 34/13/13, Rest 0', mins == [34, 13, 13] and 'noch zu verteilen: 0 min' in await pg.inner_text('#uzSpLeft'), mins)
        await pg.click('#uzSplit [data-a="save"]'); await pg.wait_for_timeout(150)
        d = await pg.evaluate(L); g = sorted([x for x in d['u'] if len(x) > 5], key=lambda x: x[0])
        s0, e0 = u0[0] - u0[1], u0[0]
        check('Gespeichert: 3 Abschnitte, nahtlos, Beginn/Ende der Einheit unverändert, gemeinsames Kennzeichen, Herkunft bleibt',
              len(g) == 3 and [x[3] for x in g] == ['tech', 'tl', 'imp'] and [x[1] for x in g] == [2040, 780, 780] and g[0][0] - g[0][1] == s0 and g[-1][0] == e0
              and all(g[k][0] == g[k + 1][0] - g[k + 1][1] for k in range(2)) and len({x[5] for x in g}) == 1 and all(x[2] == 0 for x in g) and g[2][4] == 'Licks Lage 5' and len(d['u']) == 3, g)
        check('Dialog zu, Liste zeigt „aufgeteilt“, Hinweis weg', not await pg.is_visible('#uzSplit') and await pg.evaluate("document.querySelectorAll('#uzList .uz-imp').length") >= 3 and not await pg.query_selector('#uzList .uz-splh'))
        tot1 = await pg.evaluate("Uebezeit.sums(%s,Date.now()).gesamt" % L)
        check('Gesamtzeit exakt gleich (60 min)', tot1 == 3600, tot1)
        # Rest bleibt „ohne Thema“ / Ändern der Aufteilung
        r = await pg.evaluate("UebezeitAnsicht.splitUnit(0,[{th:'tech',min:20},{th:'song',min:25}])"); d = await pg.evaluate(L); g = sorted(d['u'], key=lambda x: x[0])
        check('Aufteilung ändern: 20 + 25 min, Rest 15 min bleibt „ohne Thema“, Kennzeichen bleibt',
              r.get('ok') == 3 and [(x[3], x[1]) for x in g] == [('tech', 1200), ('song', 1500), ('', 900)] and len({x[5] for x in g}) == 1 and g[0][0] - g[0][1] == s0 and g[-1][0] == e0, g)
        r = await pg.evaluate("UebezeitAnsicht.splitUnit(0,[{th:'tech',min:61}])"); d2 = await pg.evaluate(L)
        check('Überschreiten wird abgelehnt (Daten unverändert)', 'err' in r and d2['u'] == d['u'], r)
        # „Woran geübt“ / Verlauf rechnen mit den Abschnitten
        thsum = await pg.evaluate("(()=>{const o={};%s.u.forEach(u=>o[u[3]]=(o[u[3]]||0)+u[1]);return o})()" % L)
        txt = await pg.inner_text('#uzTh')
        check('„Woran geübt“ zeigt die Themen der Abschnitte', 'Technik' in txt and 'Songs' in txt, txt[:120])
        vl = await pg.evaluate("(()=>{const s=Uebezeit.merge([]);return s.reduce((a,x)=>a+x.durationSec,0)})()")
        check('Übe-Verlauf: Summe bleibt 60 min', vl == 3600, vl)
        # Aufheben über den Editor
        await pg.click('#uzList .uz-row[data-i="0"]'); await pg.wait_for_timeout(80)
        check('Editor eines Abschnitts: „Aufteilung ändern“ und „Aufteilung aufheben“', await pg.is_visible('[data-act="split"]') and await pg.inner_text('[data-act="split"]') == 'Aufteilung ändern' and await pg.is_visible('[data-act="unsplit"]'))
        await pg.click('[data-act="unsplit"]'); await pg.wait_for_timeout(150); d = await pg.evaluate(L)
        check('„Aufteilung aufheben“: wieder eine Einheit, Beginn/Ende/Dauer wie vorher, kein Kennzeichen', len(d['u']) == 1 and d['u'][0][:3] == [e0, 3600, 0] and len(d['u'][0]) == 5, d['u'])
        # importierte und nachgetragene Einheiten, Export → leer → Import
        await pg.evaluate("(()=>{const d=%s;d.u.push(%s,%s);localStorage.setItem('3nps-uebezeit',JSON.stringify(d));dispatchEvent(new StorageEvent('storage',{key:'3nps-uebezeit'}))})()" % (L, unit(3000, 90, 1), unit(1500, 45, 2, 'ak', 'Strumming')))
        d = await pg.evaluate(L); iI = [k for k, x in enumerate(d['u']) if x[2] == 1][0]; iN = [k for k, x in enumerate(d['u']) if x[2] == 2][0]
        r1 = await pg.evaluate("UebezeitAnsicht.splitUnit(%d,[{th:'tl',min:30},{th:'th',min:30,nt:'Intervalle'}])" % iI)
        d = await pg.evaluate(L); iN = [k for k, x in enumerate(d['u']) if x[2] == 2 and x[3] == 'ak'][0]
        r2 = await pg.evaluate("UebezeitAnsicht.splitUnit(%d,[{th:'ak',min:30}])" % iN)
        d = await pg.evaluate(L)
        check('Importierte (90 → 30/30/30) und nachgetragene Einheit (45 → 30/15) aufteilbar, Herkunft bleibt',
              r1.get('ok') == 3 and r2.get('ok') == 2 and sorted(x[1] for x in d['u'] if x[2] == 1) == [1800, 1800, 1800] and sorted(x[1] for x in d['u'] if x[2] == 2) == [900, 1800], d['u'])
        before = await pg.evaluate("(()=>{const o={};%s.u.forEach(u=>o[u[3]]=(o[u[3]]||0)+u[1]);return o})()" % L)
        await pg.evaluate("window.__uzLastExport=null"); await pg.evaluate("Uebezeit.exportCsv()"); await pg.wait_for_timeout(300)
        csvtxt = await pg.evaluate("window.__uzLastExport ? window.__uzLastExport.text() : ''")
        n_ende = csvtxt.count(';Ende;')
        await pg.evaluate("localStorage.setItem('3nps-uebezeit',JSON.stringify({v:1,run:null,th:'',nt:'',u:[]}))")
        await pg.evaluate("window.__uzLastImport=null")
        await pg.set_input_files('#uzFile', files=[{'name': 'Uebezeit.csv', 'mimeType': 'text/csv', 'buffer': csvtxt.encode('utf-8')}])
        for _ in range(40):
            if await pg.evaluate("!!window.__uzLastImport"): break
            await pg.wait_for_timeout(100)
        after = await pg.evaluate("(()=>{const o={};%s.u.forEach(u=>o[u[3]]=(o[u[3]]||0)+u[1]);return o})()" % L)
        check('CSV: Abschnitte als normale Start/Ende-Zeilen; Export → leerer Speicher → Import ergibt dieselben Summen je Thema', n_ende == 6 and before == after, (n_ende, before, after))
        await ctx.close()

        # ---------- Bilder Dialog (erfundene Daten) ----------
        if os.environ.get('SHOT'):
            for w, h, th in ((390, 844, 'ios'), (1366, 1024, 'nordic')):
                ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if w == 390 else 1); pg = await ctx.new_page()
                await pg.add_init_script(f"if(!sessionStorage.getItem('i')){{sessionStorage.setItem('i',1);localStorage.setItem('3nps-theme2','{th}');localStorage.setItem('3nps-device','new');localStorage.setItem('3nps-uebezeit',JSON.stringify({{v:1,run:null,th:'',nt:'',u:[{unit(30, 75)}]}}))}}")
                await pg.goto(U + 'index.html'); await pg.wait_for_timeout(900); await open_tab(pg, 'uebezeit'); await pg.wait_for_timeout(900)
                await pg.click('#uzList .uz-row[data-i="0"]'); await pg.wait_for_timeout(100); await pg.click('[data-act="split"]'); await pg.wait_for_timeout(300)
                await pg.select_option('#uzSpRows [data-k="0"] select', 'tl'); await pg.fill('#uzSpRows [data-k="0"] [data-f="min"]', '30'); await pg.fill('#uzSpRows [data-k="0"] [data-f="nt"]', 'Pentatonik Lage 1')
                await pg.click('#uzSplit [data-a="add"]'); await pg.select_option('#uzSpRows [data-k="1"] select', 'song'); await pg.fill('#uzSpRows [data-k="1"] [data-f="min"]', '25'); await pg.wait_for_timeout(100)
                await pg.screenshot(path=f'/tmp/shots/v157_dialog_aufteilen_{w}_nach-beispiel.png')
                await ctx.close()
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{ok}/{tot} OK')
asyncio.run(main())
