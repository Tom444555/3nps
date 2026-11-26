# v154: Übezeit (Teil A) – Schalter „Üben: An / Aus“ (Looper-Karte + Lernen › Übezeit), Themen, Import aus Numbers (ZIP/CSV), CSV-Export,
# „Import entfernen“, Letzte Einheiten (Ändern/Löschen), Summen, Übe-Verlauf zählt mit. Zeit über vorbelegten Startzeitpunkt (kein echtes Warten).
# Musterdaten: test/numbers/ (erfunden; ERWARTET.txt: 61 Einheiten, 4507 min, letzte 20.11.2026 12:12). SHOT=1 → /tmp/shots/v154_*.png
import asyncio, os, re, json
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/')
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'numbers')
ZIP, CSV = os.path.join(D, 'Gitarre_ueben_muster.zip'), os.path.join(D, 'Gitarre üben-Tabelle 1.csv')
SHOT = os.environ.get('SHOT')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
L = "JSON.parse(localStorage.getItem('3nps-uebezeit')||'null')"
def setrun(mins, th=''):
    return "(()=>{const d=Object.assign({v:1,run:null,th:'',nt:'',u:[]},%s||{});d.run={s:Date.now()-%d*60000};d.th=%s;localStorage.setItem('3nps-uebezeit',JSON.stringify(d))})()" % (L, mins, json.dumps(th))
async def ctxpage(b, w=1366, h=1024, init=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
    if init: await ctx.add_init_script("if(!sessionStorage.getItem('i')){sessionStorage.setItem('i',1);" + init + "}")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    return ctx, pg, errs
async def imp(pg, path=None, payload=None):
    await pg.evaluate("window.__uzLastImport=null")
    await pg.set_input_files('#uzFile', payload if payload else path)
    for _ in range(50):
        if await pg.evaluate("!!window.__uzLastImport"): break
        await pg.wait_for_timeout(100)
    return await pg.evaluate("window.__uzLastImport"), await pg.inner_text('#uzDataMsg')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        # ---------- Hauptdurchlauf 1366 ----------
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1200)
        check('ab v154', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 154)
        st = await pg.evaluate("({built:Uebezeit.built(),kids:document.getElementById('uzRoot').children.length,btn:!!document.querySelector('.looper-card > .card-head > #uebenBtn'),txt:document.getElementById('uebenBtn').textContent,key:localStorage.getItem('3nps-uebezeit')})")
        check('Start: Seite nicht gebaut, Knopf „Üben“ in der Looper-Karte, nichts gespeichert', not st['built'] and st['kids'] == 0 and st['btn'] and st['txt'] == 'Üben' and st['key'] is None, st)
        await pg.click('#uebenBtn'); await pg.wait_for_timeout(100)
        d = await pg.evaluate(L)
        check('Einschalten speichert sofort den Startzeitpunkt', d and d['run'] and abs(d['run']['s'] - await pg.evaluate('Date.now()')) < 5000 and await pg.get_attribute('#uebenBtn', 'aria-pressed') == 'true', d)
        # vorbelegter Start vor 25 min → Neuladen läuft weiter
        await pg.evaluate(setrun(25)); await pg.reload(); await pg.wait_for_timeout(900)
        check('Weiterlaufen über Neuladen: Knopf zeigt „● 0:25“', (await pg.inner_text('#uebenBtn')).strip() == '● 0:25', await pg.inner_text('#uebenBtn'))
        await open_tab(pg, 'uebezeit'); await pg.wait_for_timeout(200)
        check('Seite gebaut beim Öffnen, „läuft seit HH:MM“, Schalter „Üben: An“',
              await pg.evaluate("Uebezeit.built()") and 'läuft seit' in await pg.inner_text('#uzSince') and await pg.inner_text('#uzBtn') == 'Üben: An' and await pg.inner_text('#uzTime') == '0:25',
              [await pg.inner_text('#uzSince'), await pg.inner_text('#uzTime')])
        # Ausschalten = ein Schreibvorgang (Einheit + Laufzustand weg zusammen)
        await pg.evaluate("(()=>{window.__w=0;const _s=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='3nps-uebezeit')window.__w++;return _s.call(this,k,v)};return 0})()")
        await pg.click('#uzBtn'); await pg.wait_for_timeout(100); d = await pg.evaluate(L)
        check('Ausschalten: Einheit 25 min gespeichert, Laufzustand weg – in genau einem Schreibvorgang', d['run'] is None and len(d['u']) == 1 and d['u'][0][1] == 1500 and d['u'][0][2] == 0 and await pg.evaluate('window.__w') == 1, [d, await pg.evaluate('window.__w')])
        check('Minutenraster: Ende auf volle Minute', d['u'][0][0] % 60 == 0, d['u'][0])
        # < 1 min
        await pg.click('#uzBtn'); await pg.wait_for_timeout(50); await pg.click('#uzBtn'); await pg.wait_for_timeout(100); d = await pg.evaluate(L)
        check('Unter 1 Minute wird nicht gespeichert (Meldung)', len(d['u']) == 1 and d['run'] is None and 'nicht gespeichert' in await pg.inner_text('#uzMsg'), await pg.inner_text('#uzMsg'))
        # > 8 h → Nachfrage, Dauer korrigieren
        await pg.evaluate(setrun(9 * 60 + 5)); await pg.click('#uzBtn'); await pg.wait_for_timeout(150)
        ask = await pg.evaluate("(()=>{const a=document.getElementById('uzAsk');return a&&!a.hidden})()")
        d = await pg.evaluate(L)
        check('Nach > 8 h: Nachfrage, noch nichts gespeichert', ask and d['run'] is not None and len(d['u']) == 1)
        await pg.fill('#uzAskH1', '1'); await pg.fill('#uzAskM1', '30'); await pg.click('#uzAsk [data-a=ok]'); await pg.wait_for_timeout(100); d = await pg.evaluate(L)
        check('Korrigierte Dauer 1 h 30 min gespeichert, Start bleibt', d['run'] is None and len(d['u']) == 2 and any(x[1] == 5400 for x in d['u']), d['u'])
        await pg.evaluate(setrun(9 * 60 + 5)); await pg.click('#uzBtn'); await pg.wait_for_timeout(100); await pg.click('#uzAsk [data-a=keep]'); await pg.wait_for_timeout(50)
        d = await pg.evaluate(L); check('„Weiterlaufen“ lässt die Zeit laufen', d['run'] is not None and len(d['u']) == 2)
        await pg.click('#uzBtn'); await pg.wait_for_timeout(100); await pg.click('#uzAsk [data-a=drop]'); await pg.wait_for_timeout(50)
        d = await pg.evaluate(L); check('„Verwerfen“ speichert nichts und schaltet aus', d['run'] is None and len(d['u']) == 2)
        # Themen
        await pg.evaluate(setrun(40, 'tech')); await pg.evaluate("document.dispatchEvent(new CustomEvent('tabchange',{detail:'uebezeit'}))"); await pg.wait_for_timeout(100)
        await pg.click('#uzChips [data-th=tl]'); await pg.wait_for_timeout(100); d = await pg.evaluate(L)
        seam = d['u'][-1][0] == round(d['run']['s'] / 60000) * 60
        check('Themenwechsel: Abschnitt 40 min „Technik“ gespeichert, neuer läuft nahtlos ab demselben Zeitpunkt', d['u'][-1][1] == 2400 and d['u'][-1][3] == 'tech' and d['th'] == 'tl' and seam, [d['u'][-1], d['run']])
        check('Chip „Tonleitern/Pentatonik“ aktiv', await pg.evaluate("document.querySelector('#uzChips [data-th=tl]').classList.contains('active')"))
        await pg.click('#uzChips #uzThEdit'); await pg.fill('#uzThNew', 'Sweep Picking'); await pg.click('#uzThAdd'); await pg.wait_for_timeout(100)
        cid = await pg.evaluate("(JSON.parse(localStorage.getItem('3nps-uebezeit-themen')).c[0]||[])[0]")
        check('Eigenes Thema angelegt und als Chip wählbar', cid and await pg.evaluate("[...document.querySelectorAll('#uzChips [data-th]')].some(b=>b.textContent==='Sweep Picking')"), cid)
        await pg.fill('#uzNote', 'Lage 5'); await pg.click('#uzChips [data-th="%s"]' % cid); await pg.wait_for_timeout(50)
        await pg.evaluate("(()=>{const d=%s;d.run.s=Date.now()-12*60000;localStorage.setItem('3nps-uebezeit',JSON.stringify(d))})()" % L)
        await pg.click('#uzBtn'); await pg.wait_for_timeout(100); d = await pg.evaluate(L)
        check('Einheit mit eigenem Thema und Notiz gespeichert', d['u'][-1][3] == cid and d['u'][-1][4] == 'Lage 5' and d['u'][-1][1] == 720, d['u'][-1])
        await pg.fill('#uzEdit input[data-ren="%s"]' % cid, 'Sweeps'); await pg.press('#uzEdit input[data-ren="%s"]' % cid, 'Enter'); await pg.wait_for_timeout(50)
        await pg.click('#uzEdit button[data-hide=ges]'); await pg.wait_for_timeout(50)
        ch = await pg.evaluate("[...document.querySelectorAll('#uzChips [data-th]')].map(b=>b.textContent)")
        check('Umbenennen und Ausblenden', 'Sweeps' in ch and 'Gesang' not in ch and 'Sweeps' in await pg.inner_text('#uzList'), ch)
        own = await pg.evaluate("%s.u.filter(u=>u[2]===0).length" % L)
        # Import ZIP
        r, msg = await imp(pg, ZIP)
        u1 = await pg.evaluate("%s.u.filter(u=>u[2]===1)" % L)
        last = await pg.evaluate("(()=>{const u=%s.u.filter(u=>u[2]===1);const t=new Date(u[u.length-1][0]*1000);return t.getDate()+'.'+(t.getMonth()+1)+'.'+t.getFullYear()+' '+t.getHours()+':'+t.getMinutes()})()" % L)
        check('Import Muster-ZIP: 61 Einheiten, 4507 min, letzte 20.11.2026 12:12', len(u1) == 61 and sum(x[1] for x in u1) == 4507 * 60 and last == '20.11.2026 12:12', [len(u1), sum(x[1] for x in u1) / 60, last])
        check('Meldung „61 Einheiten, 75 h 07 min, von … bis … übernommen (0 schon vorhanden)“', msg.startswith('61 Einheiten, 75 h 07 min, von 26.03.2022 bis 20.11.2026 übernommen') and '(0 schon vorhanden)' in msg, msg)
        check('Notiz aus „Übungen“ bleibt erhalten, importiert ohne Thema', any(x[4] == 'Pentatonik Lage 1' and x[3] == '' for x in u1))
        r, msg = await imp(pg, ZIP)
        check('Zweiter Import doppelt nichts', r['n'] == 0 and r['dup'] == 61 and await pg.evaluate("%s.u.length" % L) == own + 61, msg)
        r, msg = await imp(pg, CSV)
        check('Einzelne CSV derselben Daten: 0 neu, 61 schon vorhanden', r['n'] == 0 and r['dup'] == 61, msg)
        sums = await pg.evaluate("[...document.querySelectorAll('#uzSums .uz-sv')].map(x=>x.textContent)")
        check('Summen: 5 Kacheln, Insgesamt passt', len(sums) == 5 and sums[4] == await pg.evaluate("(()=>{const s=%s.u.reduce((a,u)=>a+u[1],0)/60;return Math.floor(s/60)+' h '+String(Math.round(s%%60)).padStart(2,'0')+' min'})()" % L), sums)
        check('Liste seitenweise (höchstens 12 Zeilen im DOM), Import gekennzeichnet', await pg.evaluate("document.querySelectorAll('#uzList .uz-row').length") == 12 and not await pg.evaluate("document.getElementById('uzPg').hidden") and 'Import' in await pg.inner_text('#uzList'))
        await pg.click('#uzOlder'); await pg.wait_for_timeout(50)
        check('„Ältere ›“ blättert', (await pg.inner_text('#uzPgN')).startswith('2 /'))
        await pg.click('#uzNewer')
        # Import entfernen
        await pg.click('#uzRm'); await pg.wait_for_timeout(100); d = await pg.evaluate(L)
        check('„Import entfernen“: nur Importiertes weg, selbst Gezähltes bleibt', len(d['u']) == own and all(x[2] == 0 for x in d['u']), [len(d['u']), own])
        await imp(pg, ZIP)
        # Export → alles löschen → Import
        csv = await pg.evaluate("Uebezeit.csv()")
        before = await pg.evaluate("(()=>{const d=%s;const t={};d.u.forEach(u=>t[u[3]]=(t[u[3]]||0)+u[1]);return {n:d.u.length,s:d.u.reduce((a,u)=>a+u[1],0),t,notes:d.u.map(u=>u[4]).sort()}})()" % L)
        check('Export: Kopfzeile, BOM, Start/Ende-Paare, „Thema – Notiz“', csv.startswith('﻿Datum und Uhrzeit;Start/Ende;Übungszeit;Übungen\n') and csv.count(';Start;!!;') == before['n'] and csv.count(';Ende;') == before['n'] and ';Sweeps – Lage 5' in csv and (';Technik\n' in csv or ';Technik [App]\n' in csv))
        await pg.click('#uzExp'); await pg.wait_for_timeout(300)
        check('„Als CSV exportieren“ liefert eine Datei', await pg.evaluate("!!window.__uzLastExport && window.__uzLastExport.name.endsWith('.csv') && window.__uzLastExport.size>1000"))
        await pg.evaluate("localStorage.removeItem('3nps-uebezeit')")
        r, msg = await imp(pg, payload={'name': 'export.csv', 'mimeType': 'text/csv', 'buffer': csv.encode('utf-8')})
        after = await pg.evaluate("(()=>{const d=%s;const t={};d.u.forEach(u=>t[u[3]]=(t[u[3]]||0)+u[1]);return {n:d.u.length,s:d.u.reduce((a,u)=>a+u[1],0),t,notes:d.u.map(u=>u[4]).sort()}})()" % L)
        check('Export → alles löschen → Import: gleiche Anzahl, Summe, Zeit je Thema und Notizen', before == after, [before['n'], after['n'], before['s'], after['s'], before['t'], after['t']])
        r, msg = await imp(pg, payload={'name': 'export.csv', 'mimeType': 'text/csv', 'buffer': csv.encode('utf-8')})
        check('Eigenen Export nochmals einlesen doppelt nichts', r['n'] == 0, msg)
        # Ändern / Löschen
        await pg.click('#uzList .uz-row'); await pg.wait_for_timeout(50)
        i0 = int(await pg.get_attribute('#uzList .uz-row.open', 'data-i')); u0 = (await pg.evaluate(L))['u'][i0]
        await pg.fill('#uzEdDur', '33'); await pg.select_option('#uzEdTh', 'imp'); await pg.fill('#uzEdNote', 'geändert'); await pg.click('#uzList [data-act=save]'); await pg.wait_for_timeout(100)
        d = await pg.evaluate(L); ch = [x for x in d['u'] if x[4] == 'geändert']
        check('Ändern: Dauer 33 min, Thema, Notiz; Start bleibt', len(ch) == 1 and ch[0][1] == 1980 and ch[0][3] == 'imp' and ch[0][0] - ch[0][1] == u0[0] - u0[1], [u0, ch])
        n0 = len(d['u']); await pg.click('#uzList .uz-row'); await pg.click('#uzList [data-act=del]'); await pg.wait_for_timeout(100)
        check('Löschen mit Rückfrage', len((await pg.evaluate(L))['u']) == n0 - 1)
        # Alles sichern
        hd = await pg.evaluate("AppCfg.backup().then(r=>r.head.local)")
        check('„Alles sichern“ enthält Übezeit und Themen', hd.get('3nps-uebezeit') == await pg.evaluate("localStorage.getItem('3nps-uebezeit')") and '3nps-uebezeit-themen' in hd)
        # 750 Einheiten: Seite aufbauen schnell
        ms = await pg.evaluate("""(()=>{const d=%s;const t0=Date.now()-800*864e5;d.u=[];for(let i=0;i<750;i++)d.u.push([Math.round((t0+i*864e5)/60000)*60,3600,1,'','']);localStorage.setItem('3nps-uebezeit',JSON.stringify(d));
          const a=performance.now();document.dispatchEvent(new CustomEvent('tabchange',{detail:'uebezeit'}));return performance.now()-a})()""" % L)
        check('750 Einheiten: Auffrischen der Seite < 50 ms', ms < 50, round(ms, 1))
        # Übe-Verlauf (v152) zählt mit, keine Doppelzählung mit Metronom-Zeit
        await pg.evaluate("""(async()=>{const all=await AppDB.all('sessions');for(const s of all)await AppDB.del('sessions',s.id);
          const now=Date.now(),e=Math.round((now-3600e3)/60000)*60;localStorage.setItem('3nps-uebezeit',JSON.stringify({v:1,run:null,th:'',nt:'',u:[[e,1800,0,'',''],[e-864e5/1000*2,2700,1,'','']]}));
          await AppDB.put('sessions',{id:'m1',ts:e*1000-600e3,dateStr:'',root:'G',mode:'ionian',position:1,pattern:'3nps',bpm:100,durationSec:300});
          await AppDB.put('sessions',{id:'m2',ts:now-5*864e5,dateStr:'',root:'G',mode:'ionian',position:1,pattern:'3nps',bpm:96,durationSec:600});await refreshLog();})()""")
        await open_tab(pg, 'griffbrett'); await pg.click('#pvFold>summary'); await pg.wait_for_timeout(400); await pg.click('#pvBody [data-pr="1W"]'); await pg.wait_for_timeout(150)
        big = await pg.inner_text('#pvBig')
        check('Übe-Verlauf 1W: 30 + 45 + 10 = 85 min (Metronom innerhalb der Übezeit nicht doppelt)', big == '85 min', big)
        await pg.click('#pvBody [data-pm=tempo]'); await pg.wait_for_timeout(100)
        check('Tempo-Ansicht nutzt weiter die Metronom-Einheiten', await pg.inner_text('#pvBig') == '100 BPM', await pg.inner_text('#pvBig'))
        await pg.click('#pvBody [data-pm=zeit]')
        await pg.evaluate("(()=>{const d=%s;const t0=Date.now()-1100*864e5;for(let i=0;i<40;i++)d.u.push([Math.round((t0+i*27*864e5)/60000)*60,3600,1,'','']);localStorage.setItem('3nps-uebezeit',JSON.stringify(d));UebeVerlauf.refresh()})()" % L)
        await pg.click('#pvBody [data-pr=all]'); await pg.wait_for_timeout(150)
        check('„Alles“ über 3 Jahre je Monat gebündelt', 'je Monat' in await pg.inner_text('#pvSub') and await pg.evaluate("!!document.querySelector('#pvChart .pv-line')"), await pg.inner_text('#pvSub'))
        gb = await pg.evaluate("(()=>{const r=document.getElementById('pvGo').getBoundingClientRect();return [r.width,r.height]})()")
        await pg.click('#pvGo'); await pg.wait_for_timeout(150)
        check('„Ganze Übersicht“ (≥ 44 px) öffnet Lernen › Übezeit', gb[0] >= 44 and gb[1] >= 44 and await pg.evaluate("AppNav.current()") == 'uebezeit', gb)
        check('Anleitung: Thema „uebezeit“, „?“ führt dorthin', await pg.evaluate("AppNav.HELP.uebezeit==='uebezeit'&&JSON.stringify(__hilfeDaten()).includes('\"id\":\"uebezeit\"')"))
        check('Lernen-Übersicht: Kachel „Übezeit“', await pg.evaluate("(()=>{AppNav.show('lernen');return !!document.querySelector('.ln-tile[data-t=uebezeit]')})()"))
        check('Looper unberührt (Drums aus, nichts beschäftigt)', await pg.evaluate("!Rhythm.on()&&!Looper.busy()"))
        check('1366: keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        # ---------- drei Größen × Optiken/Profile: Seite, Knöpfe ≥ 44 px, nichts ragt heraus; Bilder ----------
        for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
            for th, dev in [('nordic', 'new'), ('precise-dark', 'new'), ('ios', 'new'), ('nordic', 'min')]:
                init = "localStorage.setItem('3nps-theme','nordic');localStorage.setItem('3nps-theme2','%s');localStorage.setItem('3nps-device','%s');" % (th, dev)
                ctx, pg, errs = await ctxpage(b, w, h, init)
                await pg.goto(U + 'index.html'); await pg.wait_for_timeout(900)
                lb = await pg.evaluate("(()=>{const b=document.getElementById('uebenBtn').getBoundingClientRect(),i=document.getElementById('loopInfo').getBoundingClientRect();return [Math.round(b.width),Math.round(b.height),b.right<=i.left+1]})()")
                await pg.click('#uebenBtn'); await pg.wait_for_timeout(50)
                on = await pg.get_attribute('#uebenBtn', 'aria-pressed') == 'true'
                await pg.evaluate(setrun(47, 'tl')); await pg.reload(); await pg.wait_for_timeout(700)
                await open_tab(pg, 'uebezeit'); await pg.wait_for_timeout(150); await imp(pg, ZIP)
                await pg.fill('#uzNote', 'Pentatonik Lage 2'); await pg.wait_for_timeout(100)
                g = await pg.evaluate("(()=>{const bs=[...document.querySelectorAll('#uzRoot button')].filter(b=>b.offsetParent);return {small:bs.filter(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44}).map(b=>b.id||b.textContent),ow:document.documentElement.scrollWidth>innerWidth+1}})()")
                check(f'{w}/{th}/{dev}: Looper-Knopf ≥ 44 px (v157: mittig, links von „Kein Loop“), schaltet; Seite ohne Überlauf, Knöpfe ≥ 44 px',
                      lb[0] >= 44 and lb[1] >= 44 and lb[2] and on and not g['small'] and not g['ow'], [lb, on, g])
                check(f'{w}/{th}/{dev}: keine Skriptfehler', not errs, errs[:3])
                if SHOT and dev == 'new' and th in ('ios', 'nordic') and w in (1366, 390):
                    await pg.evaluate("scrollTo(0,0)"); await pg.screenshot(path=f'/tmp/shots/v154_seite_{w}_{th}.png', full_page=True)
                    await open_tab(pg, 'looper'); await pg.wait_for_timeout(200)
                    await pg.screenshot(path=f'/tmp/shots/v154_looper_{w}_{th}.png', clip={'x': 0, 'y': 0, 'width': w, 'height': 520 if w > 500 else 560})
                await ctx.close()
        # ---------- EN ----------
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500); await open_tab(pg, 'uebezeit'); await pg.wait_for_timeout(300)
        t = await pg.evaluate("[document.getElementById('uebenBtn').textContent,document.getElementById('tab-uebezeit').textContent,document.getElementById('uzBtn').textContent,document.querySelector('.uz-lbl').textContent,document.getElementById('uzImp').textContent,document.getElementById('uzExp').textContent,document.querySelector('#uzChips [data-th=\"\"]').textContent]")
        check('EN: Knöpfe und Texte übersetzt', t == ['Practice', 'Practice time', 'Practice: off', 'What am I practising?', 'Import practice time …', 'Export as CSV', 'no topic'], t)
        r, msg = await imp(pg, ZIP)
        check('EN: Import-Meldung englisch', msg.startswith('61 sessions,') and 'imported' in msg and 'already present' in msg, msg)
        check('EN: keine Skriptfehler', not errs, errs[:3])
        await ctx.close(); await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
