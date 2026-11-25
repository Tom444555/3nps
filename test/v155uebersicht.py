# v155: Übezeit-Übersicht (Teil B) + „Einheit nachtragen“ + Herkunft im Export.
# Daten: erfundene große Musterdatei aus test/numbers/gen_gross.py (≈ 750 Einheiten, 3,5 Jahre bis gestern), Kennzahlen in Python nachgerechnet.
# SHOT=1 → /tmp/shots/v155_*.png (oben/Mitte/unten, 390×844 und 1366×1024, ios und nordic, Formular)
import asyncio, os, re, sys, json, datetime as dt
from playwright.async_api import async_playwright
from nav import tab as open_tab
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'numbers'))
import gen_gross
U = os.environ.get('U', 'http://localhost:8765/'); SHOT = os.environ.get('SHOT')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
L = "JSON.parse(localStorage.getItem('3nps-uebezeit')||'null')"
GEST = dt.date.today() - dt.timedelta(days=1)
UNITS = gen_gross.einheiten(GEST)
CSVF = '/tmp/v155_gross.csv'; open(CSVF, 'w', encoding='utf-8').write(gen_gross.csv(UNITS))
MUSTER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'numbers', 'Gitarre_ueben_muster.zip')
mins = lambda s, e: int((e - s).total_seconds() // 60)
def fmtHM(sec):
    m = round(sec / 60); h = m // 60
    return '%d h %02d min' % (h, m % 60) if h else '%d min' % m

# ---------- Nachrechnen in Python (lokale Zeit, Zuordnung über das Ende) ----------
def week0(d): return d - dt.timedelta(days=d.weekday())
def shiftM(t, n):
    y, m = t.year, t.month - 1 + n; y += m // 12; m %= 12; m += 1
    import calendar; last = calendar.monthrange(y, m)[1]
    return t.replace(year=y, month=m, day=min(t.day, last))
def expect(now):
    D = dt.datetime(now.year, now.month, now.day); W = dt.datetime.combine(week0(now.date()), dt.time()); M = D.replace(day=1); Y = D.replace(month=1, day=1)
    def S(a, b): return sum(mins(s, e) * 60 for s, e, _, _ in UNITS if a <= e < b)
    end = now + dt.timedelta(milliseconds=1)
    per = [(S(D, end), S(D - dt.timedelta(days=1), now - dt.timedelta(days=1) + dt.timedelta(milliseconds=1))),
           (S(W, end), S(W - dt.timedelta(days=7), now - dt.timedelta(days=7) + dt.timedelta(milliseconds=1))),
           (S(M, end), S(shiftM(M, -1), shiftM(now, -1) + dt.timedelta(milliseconds=1))),
           (S(Y, end), S(Y.replace(year=Y.year - 1), shiftM(now, -12) + dt.timedelta(milliseconds=1)))]
    days = {}
    for s, e, _, _ in UNITS:
        if mins(s, e) > 0: days[e.date()] = days.get(e.date(), 0) + mins(s, e)
    ks = sorted(days); best = run = 0; prev = None
    for k in ks: run = run + 1 if prev and k == prev + dt.timedelta(days=1) else 1; best = max(best, run); prev = k
    cur = 0; t = now.date()
    if t not in days: t -= dt.timedelta(days=1)
    while t in days: cur += 1; t -= dt.timedelta(days=1)
    total = sum(mins(s, e) for s, e, _, _ in UNITS) * 60
    wk = {}
    for s, e, _, _ in UNITS: k = week0(e.date()); wk[k] = wk.get(k, 0) + mins(s, e) * 60
    bw = max(wk.values())
    return {'per': per, 'tot': total, 'days': len(days), 'cur': cur, 'best': best, 'longest': max(mins(s, e) for s, e, _, _ in UNITS) * 60, 'bw': bw, 'avg': total / len(days)}
def rsum(now, ndays, th=None):
    end = dt.datetime.combine(now.date() + dt.timedelta(days=1), dt.time()); a = end - dt.timedelta(days=ndays)
    return sum(mins(s, e) * 60 for s, e, t, _ in UNITS if a <= e < end and (th is None or t == th))

DIALOG = {'mode': 'accept', 'msgs': []}
async def on_dialog(d):
    DIALOG['msgs'].append(d.message)
    await (d.accept() if DIALOG['mode'] == 'accept' else d.dismiss())
async def ctxpage(b, w=1366, h=1024, init=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
    if init: await ctx.add_init_script("if(!sessionStorage.getItem('i')){sessionStorage.setItem('i',1);" + init + "}")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(on_dialog(d)))
    return ctx, pg, errs
async def ready(pg):
    for _ in range(100):
        if await pg.evaluate("!!window.UebezeitAnsicht && document.querySelectorAll('#uzSums .uz-sl').length===5"): return True
        await pg.wait_for_timeout(50)
    return False
async def imp(pg, path=None, payload=None):
    await pg.evaluate("window.__uzLastImport=null")
    await pg.set_input_files('#uzFile', payload if payload else path)
    for _ in range(80):
        if await pg.evaluate("!!window.__uzLastImport"): break
        await pg.wait_for_timeout(100)
    return await pg.evaluate("window.__uzLastImport")
async def add(pg, **f):
    if await pg.evaluate("(()=>{const w=document.getElementById('uzAdd');return !!w&&!w.hidden})()"): await pg.click('#uzAdd [data-a=cancel]')
    await pg.click('#uzAddBtn'); await pg.wait_for_timeout(80)
    for k, sel in [('date', '#uzAdDate'), ('frm', '#uzAdFrom'), ('to', '#uzAdTo'), ('h', '#uzAdH'), ('m', '#uzAdM'), ('nt', '#uzAdNote')]:
        if k in f: await pg.fill(sel, str(f[k]))
    if 'th' in f: await pg.click('#uzAdTh [data-fth="%s"]' % f['th'])
    await pg.click('#uzAdd [data-a=save]'); await pg.wait_for_timeout(120)
    return await pg.evaluate("(()=>{const w=document.getElementById('uzAdd');return {open:!w.hidden,err:document.getElementById('uzAdErr').textContent}})()")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1200)
        check('ab v155', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 155)
        check('Start: Übersicht nicht gebaut', not await pg.evaluate("Uebezeit.built()") and await pg.evaluate("document.getElementById('uzRoot').children.length") == 0)
        check('Übersicht-Code wird erst beim Öffnen geladen', not await pg.evaluate("!!window.UebezeitAnsicht||[...document.scripts].some(s=>/uebezeit-ansicht/.test(s.src))"))
        await open_tab(pg, 'uebezeit')
        check('… und beim Öffnen nachgeladen und gezeichnet', await ready(pg))
        order = await pg.evaluate("[...document.querySelectorAll('#uzRoot > .card')].map(c=>c.id||c.className.split(' ').pop())")
        check('Reihenfolge: Schalter, Überblick, Verlauf, Wann, Monate, Kalender, Woran geübt, Liste, Daten', order == ['uz-sw', 'uzKpiCard', 'uzVerlauf', 'uzWann', 'uzMonate', 'uzKal', 'uzThemen', 'uzListCard', 'uzDaten'], order)
        check('Leerzustand freundlich', 'Noch keine Einheiten' in await pg.inner_text('#uzSumN'))
        r = await imp(pg, CSVF)
        check('Große Musterdatei: %d Einheiten übernommen' % len(UNITS), r['n'] == len(UNITS), r)
        # Aufbau mit 750 Einheiten (frische Seite, Daten schon im Speicher)
        await pg.reload(); await pg.wait_for_timeout(900)
        ms = await pg.evaluate("(()=>{const a=performance.now();AppNav.show('uebezeit');return performance.now()-a})()")
        await ready(pg); ms2 = await pg.evaluate("UebezeitAnsicht.ms()")
        check('Aufbau der Seite mit %d Einheiten < 50 ms (ungedrosselt; Seite + Übersicht)' % len(UNITS), ms + ms2 < 50, [round(ms, 1), round(ms2, 1)])
        await pg.wait_for_timeout(200)
        NOW = await pg.evaluate("Date.now()"); now = dt.datetime.fromtimestamp(NOW / 1000)
        k = await pg.evaluate("(n=>UebezeitAnsicht.kpi(null,n))(%d)" % NOW); x = expect(now)
        check('Kennzahlen Heute/Woche/Monat/Jahr samt Vorzeitraum = nachgerechnet', [[q['v'], q['pv']] for q in k['per']] == [list(t) for t in x['per']], [[[q['v'], q['pv']] for q in k['per']], x['per']])
        check('Insgesamt, Übetage, Ø je Übetag', k['tot'] == x['tot'] and k['days'] == x['days'] and abs(k['avg'] - x['avg']) < 1, [k['tot'], x['tot'], k['days'], x['days']])
        check('Serie aktuell/beste, längste Einheit, beste Woche', k['cur'] == x['cur'] and k['best'] == x['best'] and k['longest']['sec'] == x['longest'] and k['bw']['v'] == x['bw'], [k['cur'], x['cur'], k['best'], x['best'], k['bw']['v'], x['bw']])
        tiles = await pg.evaluate("[...document.querySelectorAll('#uzRoot .uz-sum')].map(t=>[t.querySelector('.uz-sv').textContent,t.querySelector('.uz-sl').textContent,t.querySelector('.uz-chg').textContent,t.querySelector('.uz-chg').className])")
        check('10 Kacheln; Insgesamt-Wert und ▲/▼ mit Farbe', len(tiles) == 10 and tiles[4][0] == fmtHM(x['tot']) and all((('▲' in t[2]) == ('up' in t[3])) and (('▼' in t[2]) == ('down' in t[3])) for t in tiles[:4]), tiles[:5])
        dw = x['per'][1][0] - x['per'][1][1]
        check('Kachel „Diese Woche“: Zahl und Veränderung', tiles[1][0] == fmtHM(x['per'][1][0]) and (abs(dw) < 60 or fmtHM(abs(dw)) in tiles[1][2]), tiles[1])
        # Verlauf: Zeiträume und Bündelung
        res = {}
        for key, nd, binl in [('1W', 7, 'je Tag'), ('1M', 30, 'je Tag'), ('3M', 91, 'je Woche'), ('1J', 365, 'je Woche'), ('3J', 1095, 'je Monat'), ('all', None, 'je Monat')]:
            await pg.click('#uzVl [data-vr="%s"]' % key); await pg.wait_for_timeout(60)
            big, sub = await pg.inner_text('#uzVBig'), await pg.inner_text('#uzVSub')
            want = fmtHM(rsum(now, nd)) if nd else fmtHM(x['tot'])
            res[key] = big == want and binl in sub
            if not res[key]: print('   ', key, big, want, sub)
        check('Verlauf: 1W · 1M · 3M · 1J · 3J · Alles = nachgerechnete Summe, Bündelung Tag/Woche/Monat', all(res.values()), res)
        npts = await pg.evaluate("(document.querySelector('#uzVChart .uz-line').getAttribute('d').match(/[ML]/g)||[]).length")
        check('Alles (3,5 Jahre) je Monat: 40–45 Punkte – lesbar', 40 <= npts <= 45, npts)
        await pg.click('#uzVl [data-vr="1J"]'); await pg.click('#uzVl [data-vm=sum]'); await pg.wait_for_timeout(60)
        check('„aufsummiert“: Gesamtstunden am Ende = Insgesamt', await pg.inner_text('#uzVBig') == fmtHM(x['tot']) and 'Gesamtstunden' in await pg.inner_text('#uzVSub'))
        await pg.click('#uzVl [data-vm=zeit]')
        hl = await pg.evaluate("[document.getElementById('uzVHi').textContent,document.getElementById('uzVLo').textContent]")
        check('Hoch/Tief je Woche angegeben', 'Woche ab' in hl[0] and 'Woche ab' in hl[1], hl)
        ax = await pg.evaluate("[...document.querySelectorAll('#uzVChart .uz-ax')].map(t=>t.textContent)")
        check('Achsen beschriftet (Werte rechts, Daten unten)', len(ax) >= 6 and any(a.endswith(' h') for a in ax), ax)
        # Thema-Filter im Verlauf
        await pg.select_option('#uzVTh', 'tech'); await pg.wait_for_timeout(60)
        check('Verlauf je Thema („Technik“, 1J)', await pg.inner_text('#uzVBig') == fmtHM(rsum(now, 365, 'Technik')), [await pg.inner_text('#uzVBig'), fmtHM(rsum(now, 365, 'Technik'))])
        await pg.select_option('#uzVTh', '*')
        # Woran geübt (Alles)
        await pg.click('#uzTh [data-tr=all]'); await pg.wait_for_timeout(60)
        rows = await pg.evaluate("[...document.querySelectorAll('#uzTh .uz-trow')].map(r=>[r.querySelector('.uz-tn').textContent,r.querySelector('.uz-tv').textContent])")
        ts = {}
        for s, e, t, _ in UNITS: ts[t or 'ohne Thema'] = ts.get(t or 'ohne Thema', 0) + mins(s, e) * 60
        exp = sorted(ts.items(), key=lambda q: -q[1])
        check('Woran geübt: Themen, Stunden und Anteile = nachgerechnet', [r_[0] for r_ in rows] == [e_[0] for e_ in exp] and all(r_[1] == fmtHM(e_[1]) + ' · %d %%' % round(e_[1] / x['tot'] * 100) for r_, e_ in zip(rows, exp)), [rows[:3], exp[:3]])
        await pg.click('#uzTh .uz-trow[data-tth="song"]'); await pg.wait_for_timeout(60)
        check('Thema antippen → Verlauf zeigt nur dieses Thema', await pg.evaluate("UebezeitAnsicht.state().th") == 'song' and await pg.input_value('#uzVTh') == 'song')
        await pg.click('#uzTh .uz-trow[data-tth="song"]')
        # Wann geübt
        await pg.click('#uzWn [data-ar=all]'); await pg.wait_for_timeout(60)
        wn = await pg.evaluate("(n=>UebezeitAnsicht._wann(n))(%d)" % NOW)
        first = min(s for s, _, _, _ in UNITS).date(); cnt = [0] * 7; wd = [0] * 7; d = first
        while d <= now.date(): cnt[d.weekday()] += 1; d += dt.timedelta(days=1)
        for s, e, _, _ in UNITS: wd[e.weekday()] += mins(s, e)
        check('Ø je Wochentag = nachgerechnet', all(abs(wn['wd'][i] - wd[i] / cnt[i]) < 0.01 for i in range(7)), [round(v) for v in wn['wd']])
        check('Tageszeit-Anteile ergeben 100 %', abs(sum(wn['hr']) - 1) < 1e-6 and max(wn['hr']) < 0.5)
        yb = await pg.evaluate("[...document.querySelectorAll('#uzMj svg')][1].querySelectorAll('rect').length")
        check('Je Jahr: ein Balken je Jahr seit Beginn', yb == now.year - first.year + 1, yb)
        mb = await pg.evaluate("document.querySelector('#uzMj svg').querySelectorAll('rect').length")
        check('Je Monat: 12 Balken', mb == 12, mb)
        # Kalender
        yd = {}
        for s, e, _, _ in UNITS:
            if e.year == now.year: yd[e.date()] = yd.get(e.date(), 0) + mins(s, e)
        kc = await pg.evaluate("[document.querySelectorAll('#uzKl rect').length,document.getElementById('uzKSum').textContent,document.getElementById('uzKY').textContent]")
        ndays = (dt.date(now.year, 12, 31) - dt.date(now.year, 1, 1)).days + 1
        check('Kalender laufendes Jahr: je Tag ein Feld, Übetage und Summe', kc[0] == ndays and kc[1] == '%d Übetage · %s' % (len(yd), fmtHM(sum(yd.values()) * 60)) and kc[2] == str(now.year), [kc, len(yd)])
        lv = await pg.evaluate("[0,1,2,3,4].map(l=>document.querySelectorAll('#uzKl rect.l'+l).length)")
        el = [0] * 5
        for v in yd.values(): el[0 if v <= 0 else 1 if v <= 30 else 2 if v <= 60 else 3 if v <= 120 else 4] += 1
        check('Kalender-Helligkeit (Stufen) = nachgerechnet', lv[1:] == el[1:], [lv, el])
        await pg.click('#uzKl [data-ky="-1"]'); await pg.wait_for_timeout(60)
        check('Jahr umschaltbar', await pg.inner_text('#uzKY') == str(now.year - 1))
        await pg.click('#uzKl [data-ky="1"]')
        # ---------- Nachtragen ----------
        g = (now.date() - dt.timedelta(days=2)).isoformat(); n0 = await pg.evaluate("%s.u.length" % L)
        f = await add(pg); check('Nachtragen ohne Angaben: Hinweis, Formular bleibt offen', f['open'] and 'Dauer' in f['err'], f)
        f = await add(pg, date=g, frm='10:00', to='09:00'); check('Ende vor Beginn wird abgelehnt', f['open'] and 'nach dem Beginn' in f['err'], f)
        f = await add(pg, date=g, frm='', to='', h='25', m='0'); check('Dauer > 24 h wird abgelehnt', f['open'] and '24' in f['err'], f)
        fut = (now.date() + dt.timedelta(days=1)).isoformat()
        f = await add(pg, date=fut, frm='10:00', to='11:00', h='', m=''); check('Zukunft wird abgelehnt', f['open'] and 'Zukunft' in f['err'], f)
        old = dt.date(2021, 3, 4).isoformat()
        f = await add(pg, date=old, frm='06:00', to='07:15', h='', m='', th='th', nt='Intervalle')
        d = await pg.evaluate(L); nu = [u for u in d['u'] if u[2] == 2]
        st_ = int(dt.datetime(2021, 3, 4, 6, 0).timestamp())
        check('Nachgetragen (älterer Tag, Beginn+Ende): 1 h 15 min, Thema, Notiz, Herkunft „nachgetragen“', not f['open'] and len(nu) == 1 and nu[0][1] == 4500 and nu[0][0] - nu[0][1] == st_ and nu[0][3] == 'th' and nu[0][4] == 'Intervalle', nu)
        f = await add(pg, date=old, frm='', to='', h='0', m='45', nt='')
        d = await pg.evaluate(L); nu = sorted([u for u in d['u'] if u[2] == 2], key=lambda q: q[1])
        check('Nur Dauer: ab 12:00, 45 min', len(nu) == 2 and nu[0][1] == 2700 and nu[0][0] - nu[0][1] == int(dt.datetime(2021, 3, 4, 12, 0).timestamp()), nu)
        # Überschneidung: erst ablehnen, dann bestätigen
        DIALOG['mode'] = 'dismiss'; DIALOG['msgs'].clear()
        f = await add(pg, date=old, frm='06:30', to='07:00', h='', m='')
        d1 = await pg.evaluate("%s.u.filter(u=>u[2]===2).length" % L)
        check('Überschneidung: Nachfrage, abgelehnt → nicht gespeichert', d1 == 2 and f['open'] and DIALOG['msgs'] and 'Überschneidet sich mit 1' in DIALOG['msgs'][-1], [d1, DIALOG['msgs'][-1:]])
        DIALOG['mode'] = 'accept'; await pg.click('#uzAdd [data-a=save]'); await pg.wait_for_timeout(120)
        check('Überschneidung bestätigt → gespeichert', await pg.evaluate("%s.u.filter(u=>u[2]===2).length" % L) == 3)
        await pg.click('#uzVl [data-vr=all]'); await pg.wait_for_timeout(60)
        check('Nachgetragenes zählt in den Summen', await pg.evaluate("UebezeitAnsicht.kpi().tot") == x['tot'] + 4500 + 2700 + 1800)
        # In der Liste: Datum/Uhrzeit ändern + Kennzeichnung
        await pg.evaluate("(()=>{const d=%s;d.u=d.u.filter(u=>u[2]!==2);d.u.push([Math.round((Date.now()-3600e3)/60000)*60,1800,2,'imp','neu']);localStorage.setItem('3nps-uebezeit',JSON.stringify(d));document.dispatchEvent(new CustomEvent('tabchange',{detail:'uebezeit'}))})()" % L)
        await pg.wait_for_timeout(100)
        check('Liste kennzeichnet „nachgetragen“', 'nachgetragen' in await pg.inner_text('#uzList .uz-row'))
        await pg.click('#uzList .uz-row'); await pg.fill('#uzEdDate', g); await pg.fill('#uzEdTime', '08:05'); await pg.click('#uzList [data-act=save]'); await pg.wait_for_timeout(100)
        d = await pg.evaluate(L); e2 = [u for u in d['u'] if u[4] == 'neu']
        check('Liste: Datum und Beginn änderbar (Dauer bleibt)', len(e2) == 1 and e2[0][0] - e2[0][1] == int(dt.datetime.fromisoformat(g + 'T08:05').timestamp()) and e2[0][1] == 1800, e2)
        if SHOT:
            await pg.set_viewport_size({'width': 1366, 'height': 1024}); await pg.click('#uzAddBtn'); await pg.wait_for_timeout(150)
            await pg.fill('#uzAdFrom', '18:30'); await pg.fill('#uzAdTo', '19:45'); await pg.click('#uzAdTh [data-fth="tl"]'); await pg.fill('#uzAdNote', 'Pentatonik Lage 2')
            await pg.screenshot(path='/tmp/shots/v155_nachtragen_1366.png'); await pg.click('#uzAdd [data-a=cancel]')
        check('1366: keine Skriptfehler', not errs, errs[:3]); await ctx.close()

        # ---------- Herkunft nach Export → leerer Speicher → Import ----------
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(900); await open_tab(pg, 'uebezeit'); await ready(pg)
        await pg.evaluate("localStorage.setItem('3nps-uebezeit',JSON.stringify({v:1,run:{s:Date.now()-50*60000},th:'tech',nt:'Lage 5',u:[]}))"); await pg.click('#uzBtn'); await pg.wait_for_timeout(80)
        await add(pg, date=(now.date() - dt.timedelta(days=1)).isoformat(), frm='09:00', to='09:40', th='ges')
        await imp(pg, MUSTER)
        before = await pg.evaluate("%s.u.map(u=>u.join('|')).sort()" % L)
        csv = await pg.evaluate("Uebezeit.csv()")
        check('Export kennzeichnet App/nachgetragen unauffällig in „Übungen“', ';Technik – Lage 5 [App]\n' in csv and ';Gesang [nachgetragen]\n' in csv and csv.count('[App]') == 1)
        await pg.evaluate("localStorage.removeItem('3nps-uebezeit')")
        await imp(pg, payload={'name': 'Uebezeit.csv', 'mimeType': 'text/csv', 'buffer': csv.encode('utf-8')})
        after = await pg.evaluate("%s.u.map(u=>u.join('|')).sort()" % L)
        check('Export → leerer Speicher → Import: alle Einheiten samt Herkunft, Thema, Notiz gleich', before == after, [len(before), len(after)])
        DIALOG['msgs'].clear(); await pg.click('#uzRm'); await pg.wait_for_timeout(120)
        d = await pg.evaluate(L)
        check('„Import entfernen“ lässt selbst gezählte und nachgetragene Einheiten stehen', sorted(u[2] for u in d['u']) == [0, 2], [u[2] for u in d['u']])
        m = DIALOG['msgs'][-1] if DIALOG['msgs'] else ''
        check('Rückfrage nennt Anzahl, Stunden und Zeitraum', '61 Einheiten, 75 h 07 min, von 26.03.2022 bis 20.11.2026' in m, m)
        check('Herkunft: keine Skriptfehler', not errs, errs[:3]); await ctx.close()

        # ---------- Profile, drei Größen, Optiken; Bilder ----------
        for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
            for th, dev in [('ios', 'new'), ('nordic', 'new'), ('precise-dark', 'new'), ('nordic', 'old'), ('nordic', 'min')]:
                init = "localStorage.setItem('3nps-theme','nordic');localStorage.setItem('3nps-theme2','%s');localStorage.setItem('3nps-device','%s');" % (th, dev)
                ctx, pg, errs = await ctxpage(b, w, h, init)
                await pg.goto(U + 'index.html'); await pg.wait_for_timeout(800); await open_tab(pg, 'uebezeit'); await ready(pg)
                await imp(pg, CSVF)
                await pg.evaluate("(()=>{const d=%s;d.run={s:Date.now()-47*60000};d.th='tl';d.nt='Pentatonik Lage 2';localStorage.setItem('3nps-uebezeit',JSON.stringify(d));document.dispatchEvent(new CustomEvent('tabchange',{detail:'uebezeit'}))})()" % L)
                await pg.wait_for_timeout(150)
                g = await pg.evaluate("""(()=>{const R=document.getElementById('uzRoot'),bs=[...R.querySelectorAll('button,select,input')].filter(b=>b.offsetParent&&b.type!=='file');
                  const small=bs.filter(b=>{const r=b.getBoundingClientRect();return r.height<44||r.width<44}).map(b=>b.id||b.textContent.slice(0,12));
                  const svgOut=[...R.querySelectorAll('svg')].filter(s=>s.getBoundingClientRect().right>s.closest('.card').getBoundingClientRect().right+1).length;
                  const cut=[...R.querySelectorAll('.uz-sv,.uz-sl,.uz-tn')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent);
                  const viz=[...R.querySelectorAll('.uz-viz')].map(c=>getComputedStyle(c).display!=='none'),sh=getComputedStyle(R.querySelector('.uz-sum')).boxShadow;
                  const cols=new Set([...R.querySelectorAll(':scope > .card')].filter(c=>c.offsetParent).map(c=>Math.round(c.getBoundingClientRect().left))).size;
                  return {small,svgOut,cut,viz,sh,cols,ow:document.documentElement.scrollWidth>innerWidth+1,vl:document.getElementById('uzVl').children.length}})()""")
                base = not g['small'] and not g['svgOut'] and not g['cut'] and not g['ow']
                if dev == 'min': c2 = not any(g['viz']) and g['vl'] == 0
                else: c2 = all(g['viz']) and g['vl'] > 0 and (g['cols'] == (2 if w >= 820 else 1))
                if dev == 'old': c2 = c2 and g['sh'] in ('none', '')
                check(f'{w}/{th}/{dev}: Knöpfe ≥ 44 px, nichts ragt heraus/abgeschnitten; ' + ('nur Kennzahlen' if dev == 'min' else 'Diagramme, %s-spaltig' % ('2' if w >= 820 else '1')) + (', ohne Schatten' if dev == 'old' else ''), base and c2, g)
                check(f'{w}/{th}/{dev}: keine Skriptfehler', not errs, errs[:3])
                if SHOT and dev == 'new' and th in ('ios', 'nordic') and w in (1366, 390):
                    for nm, sel in [('oben', None), ('mitte', '#uzWann' if w < 820 else '#uzVerlauf'), ('unten', '#uzThemen' if w >= 820 else '#uzKal')]:
                        if sel: await pg.evaluate("document.querySelector('%s').scrollIntoView({block:'start'});scrollBy(0,-(Math.max(0,document.querySelector('.control-bar').getBoundingClientRect().bottom)+10))" % sel)
                        else: await pg.evaluate("scrollTo(0,0)")
                        await pg.wait_for_timeout(100); await pg.screenshot(path=f'/tmp/shots/v155_{nm}_{w}_{th}.png')
                    if w == 390 and th == 'ios':
                        await pg.click('#uzAddBtn'); await pg.wait_for_timeout(100); await pg.fill('#uzAdH', '1'); await pg.fill('#uzAdM', '30')
                        await pg.screenshot(path='/tmp/shots/v155_nachtragen_390.png')
                await ctx.close()
        # ---------- EN ----------
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500); await open_tab(pg, 'uebezeit'); await ready(pg); await imp(pg, CSVF); await pg.wait_for_timeout(200)
        t = await pg.evaluate("[...document.querySelectorAll('#uzRoot > .card > .card-head h2')].map(h=>h.textContent).concat([document.getElementById('uzAddBtn').textContent.trim()])")
        check('EN: Überschriften und „Add a session“', t == ['Practice time', 'Overview', 'History', 'When practised', 'Months and years', 'Calendar', 'What was practised', 'Recent sessions', 'Data', '＋ Add a session'], t)
        e2 = await pg.evaluate("[...document.querySelectorAll('#uzRoot .uz-sl')].map(x=>x.textContent).join('|')+document.getElementById('uzVSub').textContent")
        check('EN: Kacheln und Verlauf englisch', 'This week' in e2 and 'Practice days' in e2 and 'per' in e2 and 'Woche' not in e2, e2)
        check('EN: keine Skriptfehler', not errs, errs[:3])
        await ctx.close(); await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
