# v158: Tonleiter-Trainer (Lernen › Tonleiter-Trainer) + Anleitungs-Daten als nachgeladene Datei.
# Musik: Lagen gegen HANDTABELLEN (Bünde je Saite, unabhängig aufgeschrieben) und gegen eine eigene Python-Rechnung (Tonvorrat, Reihenfolge) geprüft.
# Metronom: Raster mit gefälschter Uhr (Tonleiter.sim) und echte Klicks im OfflineAudioContext (Abstände ±5 ms).
# SHOT=1 → /tmp/shots/v158_*.png (oben + Fortschritt, 390×844 und 1366×1024, ios und nordic)
import asyncio, os, re, json
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/'); SHOT = os.environ.get('SHOT')
WWW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'www') + '/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))

# ---------- Handtabellen: Bünde je Saite (tiefe E → hohe e) ----------
HAND = {
    ('pmin', 9, 1): [[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]],                        # A-Moll-Pentatonik Box 1
    ('pmin', 9, 2): [[8, 10], [7, 10], [7, 10], [7, 9], [8, 10], [8, 10]],                   # Box 2
    ('pmin', 9, 4): [[0, 3], [0, 3], [0, 2], [0, 2], [1, 3], [0, 3]],                        # Box 4 (offene Lage, E–G)
    ('blues', 9, 1): [[5, 8], [5, 6, 7], [5, 7], [5, 7, 8], [5, 8], [5, 8]],                 # A-Blues Box 1 (E♭ auf A6 und G8)
    ('pmaj', 7, 1): [[3, 5], [2, 5], [2, 5], [2, 4], [3, 5], [3, 5]],                        # G-Dur-Pentatonik ab Grundton
    ('ion', 7, 1): [[3, 5, 7], [3, 5, 7], [4, 5, 7], [4, 5, 7], [5, 7, 8], [5, 7, 8]],        # G-Dur 3nps Lage 1
    ('dor', 2, 1): [[10, 12, 13], [10, 12, 14], [10, 12, 14], [10, 12, 14], [12, 13, 15], [12, 13, 15]],   # D-Dorisch Lage 1
    ('aeo', 9, 1): [[5, 7, 8], [5, 7, 8], [5, 7, 9], [5, 7, 9], [6, 8, 10], [7, 8, 10]],      # A-Moll (Äolisch) Lage 1
    ('ion', 7, 2): [[5, 7, 8], [5, 7, 9], [5, 7, 9], [5, 7, 9], [7, 8, 10], [7, 8, 10]],      # G-Dur Lage 2 (ab A)
}
FING = {('ion', 7, 1): [[1, 2, 4], [1, 2, 4], [1, 2, 4], [1, 2, 4], [1, 3, 4], [1, 3, 4]],
        ('pmin', 9, 1): [[1, 4], [1, 3], [1, 3], [1, 3], [1, 4], [1, 4]]}
NAMES = {('pmin', 9, 1): 'A C D E G A C D E G A C', ('blues', 9, 1): 'A C D E♭ E G A C D E♭ E G A C', ('dor', 2, 1): 'D E F G A B C D E F G A B C D E F G'}
OPEN = [40, 45, 50, 55, 59, 64]
SC = {'pmin': [0, 3, 5, 7, 10], 'pmaj': [0, 2, 4, 7, 9], 'blues': [0, 3, 5, 6, 7, 10], 'ion': [0, 2, 4, 5, 7, 9, 11], 'dor': [0, 2, 3, 5, 7, 9, 10], 'phr': [0, 1, 3, 5, 7, 8, 10],
      'lyd': [0, 2, 4, 6, 7, 9, 11], 'mix': [0, 2, 4, 5, 7, 9, 10], 'aeo': [0, 2, 3, 5, 7, 8, 10], 'loc': [0, 1, 3, 5, 6, 8, 10]}
def pseq(form, n):   # Übungsformen unabhängig nachgebaut
    if form == 'ud': return list(range(n)) + list(range(n - 2, 0, -1))
    if form == 's3': return [j for i in range(n - 2) for j in (i, i + 1, i + 2)] + [j for i in range(n - 1, 1, -1) for j in (i, i - 1, i - 2)]
    if form == 's4': return [j for i in range(n - 3) for j in (i, i + 1, i + 2, i + 3)] + [j for i in range(n - 1, 2, -1) for j in (i, i - 1, i - 2, i - 3)]
    return [j for i in range(n - 2) for j in (i, i + 2)] + [j for i in range(n - 1, 1, -1) for j in (i, i - 2)]

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

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        h = open(WWW + 'index.html', encoding='utf8').read()
        check('index.html < 2,1 MB mit ≥ 20 KB Luft', len(h.encode()) < 2100000 - 20000, len(h.encode()))
        check('Anleitungs-Daten als eigene Datei, Trainer nicht in index.html', 'function __hilfeDaten()' not in h and os.path.exists(WWW + 'hilfe-daten.js') and 'window.Tonleiter = ' not in h and os.path.exists(WWW + 'tonleiter.js'))
        sw = open(WWW + 'sw.js', encoding='utf8').read()
        check('sw.js legt hilfe-daten.js, tonleiter.js/.css vorab ab', all("'%s'" % f in sw.split('const CORE')[1].split('\n')[0] for f in ['hilfe-daten.js', 'tonleiter.js', 'tonleiter.css']))
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1000)
        check('ab v158', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 158)
        check('Start: Trainer und Anleitungs-Daten nicht geladen', await pg.evaluate("!window.Tonleiter && typeof __hilfeDaten!=='function' && ![...document.scripts].some(s=>/tonleiter|hilfe-daten/.test(s.src))"))
        chips = await pg.evaluate("[...document.querySelectorAll('#subNav [data-area=lernen]')].map(c=>c.dataset.tab)")
        check('Eigener Chip „Tonleiter-Trainer“ unter Lernen', chips[-1] == 'tonleiter' and await pg.inner_text('#tab-tonleiter') == 'Tonleiter-Trainer', chips)
        await open_tab(pg, 'lernen'); await pg.wait_for_timeout(200)
        check('Lernen-Übersicht: Kachel „Tonleiter-Trainer“', await pg.evaluate("!!document.querySelector('.ln-tile[data-t=tonleiter]')"))
        await pg.click('.ln-tile[data-t=tonleiter]')
        check('Kachel öffnet den Trainer, Code wird beim Öffnen nachgeladen', await ready(pg) and await pg.evaluate("AppNav.current()") == 'tonleiter')
        st = await pg.evaluate("Tonleiter.state().sel")
        check('Vorgabe aus der Kopfleiste (G Ionisch, Lage 1)', st['f'] == 'ion' and st['r'] == 7 and st['l'] == 1, st)
        # ---------- Musik: Handtabellen ----------
        for (f, r, l), want in HAND.items():
            ns = await pg.evaluate("Tonleiter.pattern('%s',%d,%d)" % (f, r, l))
            got = [[n['fret'] for n in ns if n['string'] == s] for s in range(6)]
            check('Lage %s %d Lage %d = Handtabelle' % (f, r, l), got == want, got)
        for (f, r, l), want in FING.items():
            ns = await pg.evaluate("Tonleiter.pattern('%s',%d,%d)" % (f, r, l))
            got = [[n['finger'] for n in ns if n['string'] == s] for s in range(6)]
            check('Fingersatz %s %d Lage %d' % (f, r, l), got == want, got)
        for (f, r, l), want in NAMES.items():
            got = await pg.evaluate("Tonleiter.pattern('%s',%d,%d).map(n=>Tonleiter.nn(n.pitch,'%s',%d)).join(' ')" % (f, r, l, f, r))
            check('Tonnamen %s %d Lage %d' % (f, r, l), got == want, got)
        tech = await pg.evaluate("buildPattern(7,MODES['Ionisch (Dur)'],0).map(n=>n.finger)")
        check('Technik-Griffbrett: 3nps-Fingersatz berichtigt (G-Dur Lage 1)', tech == [f for s in FING[('ion', 7, 1)] for f in s], tech)
        # alle Grundtöne × Familien × Lagen: nur Töne der Tonleiter, aufsteigend, Lage k beginnt mit Stufe k, 2 bzw. 3 Töne je Saite, ≤ 5 Bünde Spanne je Saite
        allp = await pg.evaluate("(()=>{const o={};['pmin','pmaj','blues','ion','dor','phr','lyd','mix','aeo','loc'].forEach(f=>{for(let r=0;r<12;r++)for(let l=1;l<=(f[0]==='p'||f==='blues'?5:7);l++)o[f+'.'+r+'.'+l]=Tonleiter.pattern(f,r,l).map(n=>[n.string,n.fret,n.pitch,n.finger,n.blue?1:0])});return o})()")
        bad = []
        for k, ns in allp.items():
            f, r, l = k.split('.'); r = int(r); l = int(l); sc = SC[f]
            ps = [n[2] for n in ns]
            base = SC['pmin'] if f == 'blues' else sc
            e = []
            if any((pp - r) % 12 not in sc for pp in ps): e.append('fremder Ton')
            if ps != sorted(ps) or len(set(ps)) != len(ps): e.append('nicht aufsteigend')
            if (ps[0] - r) % 12 != base[l - 1]: e.append('Startstufe')
            if any(n[0] < 0 or n[1] < 0 or n[2] != OPEN[n[0]] + n[1] for n in ns): e.append('Bund/Saite')
            per = [sum(1 for n in ns if n[0] == s and not n[4]) for s in range(6)]
            if per != [3 if f in ('ion', 'dor', 'phr', 'lyd', 'mix', 'aeo', 'loc') else 2] * 6: e.append('Töne je Saite %s' % per)
            sp = [max(n[1] for n in ns if n[0] == s) - min(n[1] for n in ns if n[0] == s) for s in range(6)]
            if max(sp) > 5: e.append('Spanne')
            if any(not (0 <= n[3] <= 4) for n in ns): e.append('Finger')
            if e: bad.append((k, e))
        check('Alle %d Lagen (10 Tonleitern × 12 Grundtöne): Tonvorrat, Reihenfolge, Startstufe, Töne je Saite, Spanne' % len(allp), not bad, bad[:4])
        # ---------- Übungsformen ----------
        sq = await pg.evaluate("Object.fromEntries(['ud','s3','s4','t'].map(f=>[f,[5,12,18].map(n=>Tonleiter.seq(f,n))]))")
        check('Übungsformen auf/ab, 3er, 4er, Terzen = nachgerechnet', all(sq[f][i] == pseq(f, n) for f in sq for i, n in enumerate([5, 12, 18])), {f: sq[f][0] for f in sq})
        # ---------- Raster mit gefälschter Uhr: Vorzähler, Notenwert, Tempo-Treppe, Lagenwechsel ----------
        await pg.evaluate("Tonleiter.set({f:'pmin',r:9,l:1,x:'ud'})")
        await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('3nps-tonleiter'));d.t={a:80,z:92,st:4,n:2,nv:2,vz:1};localStorage.setItem('3nps-tonleiter',JSON.stringify(d))})()")
        await pg.reload(); await pg.wait_for_timeout(900); await ready(pg)
        sim = await pg.evaluate("Tonleiter.sim(60)")
        cl = sim['clicks']; ps = sim['passes']
        check('Vorzähler: 4 Klicks (erster betont) vor dem ersten Ton', [c[2] for c in cl[:5]] == [1, 1, 1, 1, 0] and cl[0][1] == 1 and abs(ps[0][0] - 4 * 60 / 80) < 1e-6, (cl[:5], ps[0]))
        L = 22   # 12 Töne auf + 10 ab
        check('Durchgang A-Moll-Pentatonik Lage 1 auf/ab = 22 Töne, Achtel bei 80 BPM', ps[0][4] == L and abs(ps[1][0] - ps[0][0] - L * 30 / 80) < 1e-6, ps[:2])
        bp = [x[3] for x in ps[:8]]
        check('Tempo-Treppe: nach je 2 Durchgängen +4 bis zum Ziel 92 (80,80,84,84,88,88,92,92)', bp == [80, 80, 84, 84, 88, 88, 92, 92], bp)
        bad = []
        for i in range(1, len(cl)):
            d = cl[i][0] - cl[i - 1][0]
            tb = [x for x in ps if x[0] <= cl[i - 1][0] + 1e-9]
            exp = 60 / (tb[-1][3] if tb else 80)
            if abs(d - exp) > 0.005: bad.append((round(cl[i][0], 3), round(d, 4), round(exp, 4)))
        check('Klicks je Viertel genau im Tempo der Stufe (±5 ms, %d Klicks)' % len(cl), not bad, bad[:3])
        await pg.evaluate("Tonleiter.set({f:'ion',r:7,l:'all',x:'s3'})")
        sim = await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('3nps-tonleiter'));d.t.n=0;localStorage.setItem('3nps-tonleiter',JSON.stringify(d));return Tonleiter.sim(360)})()")
        lg = [x[2] for x in sim['passes'][:9]]
        check('„Alle Lagen nacheinander“: Lage 1…7, dann wieder 1 (je 3er-Gruppen = 96 Töne)', lg == [1, 2, 3, 4, 5, 6, 7, 1, 2] and all(x[4] == 96 for x in sim['passes'][:8]), sim['passes'][:3])
        # ---------- echte Klicks im OfflineAudioContext ----------
        oc = await pg.evaluate("""(async()=>{const sr=48000,oc=new OfflineAudioContext(1,sr*5,sr),bpm=97,on=[];
          const e=Tonleiter.engine({t0:0.05,bpm:()=>bpm,nv:3,vz:0},{click:(t,a,c)=>Tonleiter.clickAt(t,a,c,oc,oc.destination),note:()=>{}});
          for(let t=0;t<=4.8;t+=0.025)e.pump(t);
          const x=(await oc.startRendering()).getChannelData(0);let last=-1e9;
          for(let i=0;i<x.length;i++)if(Math.abs(x[i])>0.02&&i-last>sr*0.2){on.push(i/sr);last=i}
          return {on,exp:60/bpm}})()""")
        d = [oc['on'][i] - oc['on'][i - 1] for i in range(1, len(oc['on']))]
        check('OfflineAudioContext: Klick-Abstände 97 BPM (Triolen je Klick) ±5 ms', len(d) >= 6 and all(abs(x - oc['exp']) < 0.005 for x in d), [round(x, 4) for x in d[:8]])
        # ---------- „geschafft“ speichert Bestwert, Raster, Verlauf, langsamer ----------
        await pg.evaluate("Tonleiter.set({f:'pmin',r:9,l:2,x:'t'})")
        b0 = await pg.evaluate("Tonleiter.state().bpm")
        await pg.click('#tlDone'); await pg.wait_for_timeout(150)
        s = await pg.evaluate("Tonleiter.state()")
        cell = await pg.evaluate("(()=>{const c=document.querySelector('.tl-cell[data-gl=\"2\"][data-gx=\"t\"]');return [c.textContent,c.className]})()")
        check('„geschafft“: Bestwert %d gespeichert (mit Datum), Tempo +4' % b0, s['S']['b'].get('pmin.9.2.t', [0])[0] == b0 and s['S']['b']['pmin.9.2.t'][1] > 1.7e9 and s['bpm'] == b0 + 4, (s['S']['b'], s['bpm']))
        check('Raster zeigt den Bestwert in Lage 2 × Terzen (farbig)', cell[0] == str(b0) and 'lv' in cell[1] and 'lv0' not in cell[1], cell)
        vl = await pg.evaluate("[document.querySelector('#tlVl .uz-big').textContent,!!document.querySelector('#tlVl svg.uz-svg .uz-line')]")
        check('Verlauf im Börsenkurs-Stil zeigt %d BPM' % b0, vl == ['%d BPM' % b0, True], vl)
        nx = await pg.inner_text('#tlNext')
        check('„Als Nächstes üben“ = schwächste Lage zuerst (Lage 1 · Auf und ab, noch nicht geübt)', nx.startswith('Lage 1 · Auf und ab') and 'noch nicht' in nx, nx)
        await pg.click('#tlSlow'); await pg.wait_for_timeout(100)
        check('„zu schnell → langsamer“: −4', await pg.evaluate("Tonleiter.state().bpm") == b0, await pg.evaluate("Tonleiter.state().bpm"))
        await pg.click('.tl-cell[data-gl="3"][data-gx="s4"]'); await pg.wait_for_timeout(100)
        s = await pg.evaluate("Tonleiter.state().sel")
        check('Raster antippen wählt Lage 3 · 4er-Gruppen', s['l'] == 3 and s['x'] == 's4', s)
        # ---------- Looper-Tempo-Sperre ----------
        lk = await pg.evaluate("(()=>{const o=Looper.running;Looper.running=()=>true;document.getElementById('bpm').value=93;const s=Tonleiter.state();Tonleiter.open();const dis=document.getElementById('tlSlow').disabled;Tonleiter.slower();const s2=Tonleiter.state();Looper.running=o;return [s.locked,Math.round(s.cur),dis,s2.bpm===s.bpm]})()")
        check('Looper läuft: Tempo folgt dem Loop (93), „langsamer“ gesperrt', lk == [True, 93, True, True], lk)
        # ---------- Übungslog + Übezeit ohne Doppelzählung ----------
        await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('3nps-tonleiter'));d.t.vz=0;d.t.n=0;localStorage.setItem('3nps-tonleiter',JSON.stringify(d))})()")
        await pg.reload(); await pg.wait_for_timeout(900); await ready(pg)
        await pg.evaluate("Tonleiter.set({f:'dor',r:2,l:1,x:'s3'})")
        hint = await pg.inner_text('#tlUz')
        check('Üben aus: dezenter Hinweis mit „Üben einschalten“, nichts eingeschaltet', 'Üben einschalten' in hint and not await pg.evaluate("!!Uebezeit.load().run"), hint)
        await pg.click('#tlGo'); await pg.wait_for_timeout(1500)
        stt = await pg.inner_text('#tlStat'); on1 = await pg.evaluate("document.querySelectorAll('#tlBoard .tl-n.on').length")
        check('Mitlaufen: Ton für Ton markiert, Text mit Durchgang/Ton/Saite/Bund', on1 == 1 and 'Durchgang 1' in stt and 'Saite' in stt, [on1, stt])
        await pg.wait_for_timeout(4500); await pg.click('#tlGo'); await pg.wait_for_timeout(500)
        e = await pg.evaluate("(async()=>{const a=await AppDB.all('sessions');return a.filter(x=>x.src==='tl')})()")
        check('Lauf ≥ 5 s → Übungslog-Eintrag mit Tonleiter, Lage, BPM, Dauer', len(e) == 1 and e[0]['root'] == 'D' and e[0]['mode'] == 'Dorisch' and e[0]['position'] == 1 and e[0]['bpm'] > 0 and 5 <= e[0]['durationSec'] <= 8 and '3er' in e[0]['pattern'], e)
        check('Übungslog (Technik) zeigt den Eintrag', 'Dorisch' in await pg.evaluate("document.getElementById('logList').textContent"))
        await pg.click('#tlUzOn'); await pg.wait_for_timeout(100)
        u = await pg.evaluate("Uebezeit.load()")
        check('„Üben einschalten“ startet die Übezeit (Thema Tonleitern), Hinweis wechselt', bool(u['run']) and u['th'] == 'tl' and 'läuft' in await pg.inner_text('#tlUz'), u)
        await pg.evaluate("(()=>{const d=Uebezeit.load();d.run.s=Date.now()-10*60000;localStorage.setItem('3nps-uebezeit',JSON.stringify(d))})()")
        await pg.click('#tlGo'); await pg.wait_for_timeout(6000); await pg.click('#tlGo'); await pg.wait_for_timeout(400)
        th0 = await pg.evaluate("Uebezeit.load().th")
        await pg.evaluate("Uebezeit.off()"); await pg.wait_for_timeout(200)
        m = await pg.evaluate("(async()=>{const a=await AppDB.all('sessions'),tl=a.filter(x=>x.src==='tl'),mg=Uebezeit.merge(a);return {n:tl.length,raw:tl.reduce((s,x)=>s+x.durationSec,0),sum:mg.reduce((s,x)=>s+(+x.durationSec||0),0),uz:Uebezeit.load().u.reduce((s,u)=>s+u[1],0)}})()")
        check('Läuft „Üben“: Thema nicht geändert, Trainer-Läufe in der Übezeit zählen nicht doppelt (Summe = Übezeit)', th0 == 'tl' and m['n'] == 2 and m['raw'] >= 10 and m['uz'] >= 600 and m['sum'] == m['uz'], m)
        # ---------- Verlassen stoppt ----------
        await pg.click('#tlGo'); await pg.wait_for_timeout(300)
        await open_tab(pg, 'looper'); await pg.wait_for_timeout(200)
        check('Seite verlassen → Trainer gestoppt', not await pg.evaluate("Tonleiter.state().run"))
        check('Hauptseite: keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        # ---------- Anleitung: Daten nachgeladen, Thema Tonleiter-Trainer ----------
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(900); await open_tab(pg, 'tonleiter'); await ready(pg)
        await pg.click('#tab-hilfe'); await pg.wait_for_timeout(700)
        hl = await pg.evaluate("[Hilfe.count(), !!document.getElementById('hl-tonleiter-trainer'), (document.querySelector('#hlToc a.on')||{}).textContent||'']")
        check('„?“ im Trainer → Anleitung (nachgeladen) springt zu „Tonleiter-Trainer“', hl[0] >= 30 and hl[1] and 'Tonleiter' in hl[2], hl)
        check('Anleitung: keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        # ---------- Größen, Optiken, Profile ----------
        for w, hh in [(1366, 1024), (820, 1180), (390, 844)]:
            for th, dev in [('ios', 'new'), ('nordic', 'new'), ('precise-dark', 'new'), ('nordic', 'old'), ('ios', 'min')]:
                if w == 820 and th != 'ios': continue
                init = "localStorage.setItem('3nps-theme','nordic');localStorage.setItem('3nps-theme2','%s');localStorage.setItem('3nps-device','%s');" % (th, dev) \
                    + "localStorage.setItem('3nps-tonleiter',JSON.stringify({v:1,s:{f:'pmin',r:9,l:1,x:'s3',fg:0},t:{a:80,z:120,st:4,n:0,nv:2,vz:0},b:{'pmin.9.1.s3':[96,Math.round(Date.now()/1000)-20*86400],'pmin.9.2.ud':[120,Math.round(Date.now()/1000)-86400],'pmin.9.3.t':[104,Math.round(Date.now()/1000)-2*86400]},h:[[Math.round(Date.now()/1000)-40*86400,'pmin.9.1.s3',80],[Math.round(Date.now()/1000)-30*86400,'pmin.9.1.s3',88],[Math.round(Date.now()/1000)-20*86400,'pmin.9.1.s3',96],[Math.round(Date.now()/1000)-2*86400,'pmin.9.3.t',104],[Math.round(Date.now()/1000)-86400,'pmin.9.2.ud',120]]}));"
                ctx, pg, errs = await ctxpage(b, w, hh, init)
                await pg.goto(U + 'index.html'); await pg.wait_for_timeout(800); await open_tab(pg, 'tonleiter'); await ready(pg); await pg.wait_for_timeout(150)
                await pg.click('#tlGo'); await pg.wait_for_timeout(1600)
                g = await pg.evaluate("""(()=>{const R=document.getElementById('tlRoot'),bs=[...R.querySelectorAll('button,select,summary')].filter(b=>b.offsetParent);
                  const small=bs.filter(b=>{const r=b.getBoundingClientRect();return r.height<44||r.width<44}).map(b=>b.id||b.textContent.slice(0,14));
                  const cut=[...R.querySelectorAll('.toggle-btn,.uz-sv,.tl-cap,.tl-nx')].filter(e=>e.offsetParent&&(e.scrollWidth>e.clientWidth+1)).map(e=>e.textContent.slice(0,20));
                  const segOut=[...R.querySelectorAll('.tl-seg')].filter(s=>s.offsetParent&&s.getBoundingClientRect().right>s.closest('.card').getBoundingClientRect().right+1).length;
                  const n=R.querySelector('.tl-n'),tr=n?getComputedStyle(n).transitionDuration:'';
                  return {small,cut,segOut,ow:document.documentElement.scrollWidth>innerWidth+1,on:R.querySelectorAll('.tl-n.on').length,stat:document.getElementById('tlStat').textContent,svg:!!R.querySelector('#tlVl svg'),tr}})()""")
                c = not g['small'] and not g['cut'] and not g['segOut'] and not g['ow'] and 'Durchgang' in g['stat']
                if dev == 'min': c = c and g['on'] == 0 and not g['svg']
                else: c = c and g['on'] == 1 and g['svg']
                if dev == 'old': c = c and g['tr'] in ('0s',)
                check(f'{w}/{th}/{dev}: Knöpfe ≥ 44 px, nichts abgeschnitten/ragt heraus; ' + ('nur Text, keine bewegte Markierung, kein Diagramm' if dev == 'min' else 'Markierung + Verlauf') + (', ohne Übergänge' if dev == 'old' else ''), c, g)
                if SHOT and dev == 'new' and th in ('ios', 'nordic') and w in (1366, 390):
                    await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(100)
                    await pg.screenshot(path=f'/tmp/shots/v158_oben_{w}_{th}.png')
                    if w == 390:
                        await pg.evaluate("document.getElementById('tlBoardCard').scrollIntoView({block:'start'});scrollBy(0,-(Math.max(0,document.querySelector('.control-bar').getBoundingClientRect().bottom)+10))")
                        await pg.wait_for_timeout(100); await pg.screenshot(path=f'/tmp/shots/v158_griffbrett_{w}_{th}.png')
                    await pg.evaluate("document.getElementById('tlProg').scrollIntoView({block:'start'});scrollBy(0,-(Math.max(0,document.querySelector('.control-bar').getBoundingClientRect().bottom)+10))")
                    await pg.wait_for_timeout(100); await pg.screenshot(path=f'/tmp/shots/v158_fortschritt_{w}_{th}.png')
                await pg.click('#tlGo')
                check(f'{w}/{th}/{dev}: keine Skriptfehler', not errs, errs[:3])
                await ctx.close()
        # ---------- EN ----------
        ctx, pg, errs = await ctxpage(b)
        await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500); await open_tab(pg, 'tonleiter'); await ready(pg); await pg.wait_for_timeout(200)
        t = await pg.evaluate("[document.getElementById('tab-tonleiter').textContent,...[...document.querySelectorAll('#tlRoot .card-head h2')].map(h=>h.textContent).filter((x,i)=>i!==3),document.getElementById('tlDone').textContent,document.getElementById('tlGo').textContent,document.getElementById('tlCap').textContent]")
        check('EN: Chip, Überschriften, Knöpfe, Titel englisch', t[:7] == ['Scale trainer', 'Scale trainer', 'Metronome', 'History', 'Progress', 'nailed it → faster', '▶ Start'] and 'Position' in t[7] and 'Lage' not in t[7], t)
        tx = await pg.evaluate("document.getElementById('tlRoot').innerText")
        de = [w for w in ['Durchgängen', 'Grundton', 'Übung', 'Als Nächstes', 'geschafft', 'Tonleiter', 'Schritt', 'Ziel erreicht'] if w in tx]
        check('EN: keine deutschen Reste', not de, de)
        check('EN: keine Skriptfehler', not errs, errs[:3])
        await ctx.close(); await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
