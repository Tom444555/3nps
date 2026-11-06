# v126: Kurs Kapitel 3 „Intervall-Werkstatt“ – Schritte, Intervalle (Töne nachgerechnet), Akkord-Baukasten (alle Formeln), Quiz, Speicher, kein Überlauf, quer/hoch, EN
import asyncio, os, itertools
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '/tmp/v126werkstatt')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
MIDI0 = [40, 45, 50, 55, 59, 64]; LET = 'CDEFGAB'; LPC = [0, 2, 4, 5, 7, 9, 11]; DEG = [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7, 8]
def pcn(n): return (LPC[LET.index(n[0])] + n[1:].count('#') - n[1:].count('b')) % 12
SEM = {'1': 0, '8': 12, 'b2': 1, '2': 2, '9': 2, 'b3': 3, '3': 4, '4': 5, '11': 5, 'b5': 6, '5': 7, 'b6': 8, '6': 9, 'bb7': 9, 'b7': 10, '7': 11}
OVER = """()=>{const h=document.getElementById('pcSecKurs'),R=h.getBoundingClientRect().right,bad=[];h.querySelectorAll('*').forEach(e=>{if(e.closest('svg'))return;const r=e.getBoundingClientRect();if(!r.width)return;
 if(r.right>R+1)bad.push(e.tagName+'.'+e.className+' '+Math.round(r.right-R));if(/^(P|LI|SPAN|LABEL|H3|H4|H5|B|DIV)$/.test(e.tagName)&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowX!=='hidden'&&e.clientWidth)bad.push('scroll '+e.tagName+'.'+e.className+' '+(e.textContent||'').slice(0,30));});return bad.slice(0,6);}"""
JT = """()=>{const p=document.querySelector('#pcKC3 .pc-w');const bad=[];p.querySelectorAll('button,label.check').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return;if(r.height<43.5||r.width<43.5)bad.push((e.textContent.trim().slice(0,14))+' '+Math.round(r.width)+'x'+Math.round(r.height));});
 const c=p.querySelector('.pc-cell');if(c){const r=c.getBoundingClientRect();if(r.width<43.5||r.height<43.5)bad.push('cell '+Math.round(r.width)+'x'+Math.round(r.height));}return bad;}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1300)
        import re as _re; check('Version ab v126', int(_re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 126)
        await pg.click('#tab-power'); await pg.wait_for_timeout(300); await pg.click('#pcSubs [data-sec=kurs]'); await pg.wait_for_timeout(300)
        check('Werkstatt träge (erst beim Aufklappen von Kapitel 3)', await pg.evaluate("!!window.PcWerk && !document.querySelector('#pcKC3 .pc-w')"))
        await pg.evaluate("document.getElementById('pcKC3').open=true"); await pg.wait_for_timeout(400)
        check('Werkstatt gebaut: Schritte, 13 Intervall-Knöpfe, Merkkarten', await pg.evaluate("(()=>{const w=document.querySelector('#pcKC3 .pc-w');return w&&[...w.querySelectorAll('[data-w=st]')].map(b=>b.textContent).join('|')==='1 Eine Saite|2 Abstand = Intervall|3 Zwei Saiten|4 Powerchord|5 Alles zusammen| Übungen'&&w.querySelectorAll('.pc-wivrow [data-w=iv]').length===13&&w.querySelectorAll('.pc-wcard').length>=5})()"))
        # Notennamen: alle Grundtöne × Intervalle
        sp = await pg.evaluate("[...Array(12).keys()].map(pc=>[PcWerk.rootName(pc),[...Array(13).keys()].map(N=>PcWerk.spell(PcWerk.rootName(pc),N))])")
        bad = []
        for rn, row in sp:
            for N, t in enumerate(row):
                if pcn(t) != (pcn(rn) + N) % 12: bad.append((rn, N, t))
                elif (LET.index(t[0]) - LET.index(rn[0])) % 7 != (DEG[N] - 1) % 7 and len(t) == 1 and False: pass
        letters = sum(1 for rn, row in sp for N, t in enumerate(row) if (LET.index(t[0]) - LET.index(rn[0])) % 7 == (DEG[N] - 1) % 7)
        check('Tonnamen nachgerechnet (12 × 13)', not bad and letters >= 140, (bad[:3], letters))
        pos = await pg.evaluate("(()=>{const o=[];for(let s=0;s<6;s++)for(let f=0;f<=12;f++)for(let N=0;N<=12;N++){o.push([s,f,N,PcWerk.posBox(s,f,N),PcWerk.posTwo(s,f,N)])}return o})()")
        bp = [x for x in pos if MIDI0[x[3]['s']] + x[3]['f'] != MIDI0[x[0]] + x[1] + x[2] or MIDI0[x[4]['s']] + x[4]['f'] != MIDI0[x[0]] + x[1] + x[2] or x[3]['f'] < 0 or x[4]['f'] < 0]
        check('Lagen (Kasten, zwei Saiten) ergeben genau Grundton + N', not bp, bp[:3])
        # Schritte durchklicken, angezeigter Intervallton = Grundton + N
        res = []
        for st in [1, 2, 3, 4, 5]:
            await pg.click('#pcKC3 [data-w=st][data-v="%d"]' % st); await pg.wait_for_timeout(80)
            for N in range(13):
                await pg.evaluate("PcWerk.set({n:%d})" % N); 
                r = await pg.evaluate("(()=>{const w=document.querySelector('#pcKC3 .pc-w'),c=w.querySelector('.pc-wm.cur')||w.querySelector('.pc-wm.root');return [+c.dataset.s,+c.dataset.f,w.querySelector('.pc-winfo .pc-wline').textContent,PcWerk.state()]})()")
                s, f, line, S = r; want = MIDI0[S['rs']] + S['rf'] + N
                if st == 1 and S['rf'] > 12: want -= 12
                if (MIDI0[s] + f) != want and N: res.append((st, N, s, f))
                rn, rest = line.split(' → '); tn = rest.split(' = ')[0]
                if pcn(tn) != (pcn(rn) + N) % 12: res.append((st, N, line))
        check('Schritte 1–5: Punkt und Text „A → … = …“ stimmen für alle 13 Intervalle', not res, res[:3])
        await pg.evaluate("PcWerk.set({st:2,n:4,rs:0,rf:5})")
        line = await pg.inner_text('#pcKC3 .pc-winfo')
        check('Beispiel A → C# = große Terz (3), Grifftipp', 'A → C# = große Terz (3)' in line and 'eine Saite höher, einen Bund vor dem Grundton' in line, line)
        await pg.evaluate("PcWerk.set({st:3,n:4,rs:2,rf:5})")
        check('Schritt 3 zeigt Sonderfall G→H', await pg.evaluate("document.querySelectorAll('#pcKC3 .pc-wm.alt').length===2 && document.querySelector('#pcKC3 .pc-wb').textContent.includes('G→H')"))
        await pg.evaluate("PcWerk.set({st:5,rs:0,rf:5})")
        fam = await pg.evaluate("[...document.querySelectorAll('#pcKC3 .pc-wm[data-n]')].filter(g=>!g.classList.contains('ghost')).map(g=>[+g.dataset.n,g.getAttribute('class')])")
        FAM = lambda n: 'f1' if n % 12 == 0 else 'f5' if n == 7 else 'f3' if n in (3, 4) else 'f4' if n == 5 else 'fx'
        check('Schritt 5: 13 Töne in Familienfarben', len(fam) == 13 and all(FAM(n) in c.split() for n, c in fam), fam[:3])
        check('Andere Lagen des Grundtons gestrichelt', await pg.evaluate("document.querySelectorAll('#pcKC3 .pc-wm.ghost').length>=1"))
        await pg.evaluate("PcWerk.set({st:4})")
        check('Schritt 4: nur 1 · 5 · 8 hell', await pg.evaluate("[...document.querySelectorAll('#pcKC3 .pc-wm[data-n]:not(.ghost):not(.dim)')].map(g=>+g.dataset.n).sort((a,b)=>a-b).join()") == '0,7,12')
        for lab in ['num', 'name', 'ton', 'all']:
            await pg.click('#pcKC3 [data-w=lab][data-v=%s]' % lab); await pg.wait_for_timeout(50)
        t = await pg.evaluate("[...document.querySelector('#pcKC3 .pc-wm[data-n=\"7\"]').querySelectorAll('tspan')].map(x=>x.textContent)")
        check('Beschriftung „Alles“: Zahl, Name, Ton im Punkt', t == ['5', 'Quinte', 'E'], t)
        await pg.click('#pcKC3 [data-w=lab][data-v=num]')
        # Tipp auf Bund ändert den Grundton
        await pg.evaluate("PcWerk.set({st:2,rs:0,rf:5,n:7})")
        await pg.evaluate("document.querySelector('#pcKC3 .pc-cell[data-s=\"1\"][data-f=\"7\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))"); await pg.wait_for_timeout(100)
        st = await pg.evaluate("PcWerk.state()")
        check('Tipp auf Bund = neuer Grundton (A-Saite 7 → E)', st['rs'] == 1 and st['rf'] == 7 and (await pg.inner_text('#pcKC3 .pc-winfo')).startswith('E → B'), st)
        await pg.evaluate("window.__n=0;const o=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){window.__n++;return o.call(this)};0")
        for v in ['root', 'seq', 'both']: await pg.click('#pcKC3 [data-w=play][data-v=%s]' % v)
        await pg.click('#pcKC3 [data-w=step][data-v="1"]'); n1 = (await pg.evaluate("PcWerk.state()"))['n']; await pg.click('#pcKC3 [data-w=step][data-v="-1"]')
        check('▶ Grundton/Nacheinander/Zusammen klingen, größer/kleiner', await pg.evaluate("window.__n") > 4 and n1 == 8 and (await pg.evaluate("PcWerk.state()"))['n'] == 7)
        # Akkord-Baukasten: alle Formeln
        ty = await pg.evaluate("PcWerk.TY.map(t=>({k:t.k,req:t.req,opt:t.opt||[],f:PcWerk.formula(t),nm:PcWerk.cname(t,'A')}))")
        badf = []
        for t in ty:
            for extra in [[]] + [[o] for o in t['opt']] + ([[12]] if t['k'] == '5' else []):
                r = await pg.evaluate("PcWerk.chordOf(new Set(%s)).t?.k" % (t['req'] + extra))
                if r != t['k']: badf.append((t['k'], extra, r))
            labs = [x.strip().strip('()') for x in t['f'].replace('(· 8)', '').split(' · ')]
            if sorted(SEM[l] % 12 for l in labs) != sorted(set(t['req'] + t['opt'])): badf.append(('formel', t['k'], t['f']))
        check('Akkord-Erkennung: alle %d Formeln (mit/ohne optionale Töne)' % len(ty), not badf, badf[:3])
        amb = await pg.evaluate("(()=>{let m=0;for(let x=0;x<8192;x++){const s=new Set([...Array(13).keys()].filter(i=>x>>i&1));const P=new Set([...s].map(n=>n%12));const h=PcWerk.TY.filter(t=>t.req.every(n=>P.has(n))&&[...P].every(n=>t.req.includes(n)||(t.opt||[]).includes(n)));if(h.length>1)m++;}return m})()")
        check('Jede Tonmenge höchstens eine Akkordart', amb == 0, amb)
        await pg.click('#pcKC3 [data-w=multi]'); await pg.evaluate("PcWerk.set({rs:0,rf:5})")
        want = [([0, 7], 'A5'), ([0, 7, 12], 'A5'), ([0, 4, 7], 'A-Dur'), ([0, 3, 7], 'A-Moll'), ([0, 2, 7], 'Asus2'), ([0, 5, 7], 'Asus4'), ([0, 4, 7, 2], 'Aadd9'), ([0, 4, 7, 10], 'A7'), ([0, 4, 7, 11], 'Amaj7'), ([0, 3, 7, 10], 'Am7'), ([0, 3, 6, 10], 'Am7b5'), ([0, 3, 7, 10, 5], 'Am7(11)')]
        bw = []
        for sel, nm in want:
            await pg.evaluate("PcWerk.set({sel:%s})" % sel)
            r = await pg.evaluate("[document.querySelector('#pcKC3 .pc-wbig').textContent,document.querySelector('#pcKC3 .pc-wform').textContent,document.querySelectorAll('#pcKC3 .pc-wm[data-n]:not(.ghost)').length]")
            if r[0] != nm or r[2] != len(sel): bw.append((sel, r))
        check('Baukasten zeigt A5, A-Dur, A-Moll, sus2, sus4, add9, 7, maj7, m7, m7b5, m7(11)', not bw, bw[:3])
        await pg.evaluate("PcWerk.set({sel:[0,4,7]})"); fm = await pg.inner_text('#pcKC3 .pc-wform')
        check('Formel „Dur = 1 · 3 · 5“', fm == 'Dur = 1 · 3 · 5', fm)
        await pg.evaluate("PcWerk.set({sel:[0,4]})"); fm = await pg.inner_text('#pcKC3 .pc-winfo')
        check('Kein Treffer: Hinweis „noch die 5 dazu → A-Dur“', 'kein gängiger Akkord' in fm and 'noch die 5 dazu → A-Dur' in fm, fm)
        await pg.evaluate("PcWerk.set({sel:[0,4,7]})"); n0 = await pg.evaluate("window.__n"); await pg.click('#pcKC3 [data-w=chord]')
        check('▶ Akkord anhören', await pg.evaluate("window.__n") > n0)
        await pg.click('#pcKC3 [data-w=iv][data-n="10"]')
        check('Knöpfe ankreuzbar (aria-pressed)', await pg.evaluate("document.querySelector('#pcKC3 .pc-wivrow [data-n=\"10\"]').getAttribute('aria-pressed')==='true' && document.querySelector('#pcKC3 .pc-wbig').textContent==='A7'"))
        await pg.click('#pcKC3 [data-w=multi]')
        # Quiz
        await pg.click('#pcKC3 [data-w=st][data-v="6"]'); await pg.click('#pcKC3 [data-w=quiz][data-v=find]'); await pg.wait_for_timeout(100)
        okc = 0
        for i in range(10):
            S = await pg.evaluate("PcWerk.state()"); q = S['q']; tgt = MIDI0[S['rs']] + S['rf'] + q['N']
            cell = None
            if i == 0:   # erst falsch
                await pg.evaluate("document.querySelector('#pcKC3 .pc-cell[data-s=\"%d\"][data-f=\"%d\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))" % (S['rs'], S['rf'] + (1 if q['N'] != 1 else 2)))
                fb = await pg.inner_text('#pcKC3 .pc-wfb'); check('Finde: falscher Bund → ✗ mit Erklärung', fb.startswith('✗ Das ist') and 'Halbtöne über' in fb, fb)
            else:
                cells = await pg.evaluate("[...document.querySelectorAll('#pcKC3 .pc-cell')].map(c=>[+c.dataset.s,+c.dataset.f])")
                cell = next((c for c in cells if MIDI0[c[0]] + c[1] == tgt), None)
                await pg.evaluate("document.querySelector('#pcKC3 .pc-cell[data-s=\"%d\"][data-f=\"%d\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))" % tuple(cell))
                fb = await pg.inner_text('#pcKC3 .pc-wfb'); okc += fb.startswith('✓ Richtig!')
            await pg.click('#pcKC3 [data-w=next]') if i < 9 else None
        cnt = await pg.inner_text('#pcKC3 .pc-wcnt'); sv = await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1')).kurs['w-find']")
        check('Finde: 9 richtige ✓, Zähler 10 von 10, Ergebnis gespeichert', okc == 9 and 'Aufgabe 10 von 10 · Treffer: 9' in cnt and sv and sv['last'] == 9 and sv['best'] == 9, (okc, cnt, sv))
        await pg.click('#pcKC3 [data-w=quiz][data-v=name]'); await pg.wait_for_timeout(80)
        S = await pg.evaluate("PcWerk.state()"); await pg.click('#pcKC3 [data-w=qa][data-n="%d"]' % S['q']['N'])
        fb = await pg.inner_text('#pcKC3 .pc-wfb')
        check('Wie heißt das?: Punkt „?“ und richtige Antwort ✓', fb.startswith('✓ Richtig!') and await pg.evaluate("!!document.querySelector('#pcKC3 .pc-wm.fq')"), fb)
        await pg.click('#pcKC3 [data-w=quiz][data-v=hear]'); await pg.wait_for_timeout(300); pool = set()
        for i in range(5):
            S = await pg.evaluate("PcWerk.state()"); pool.add(S['q']['N']); await pg.click('#pcKC3 [data-w=qa][data-n="%d"]' % S['q']['N']); await pg.click('#pcKC3 [data-w=next]'); await pg.wait_for_timeout(60)
        ch = await pg.evaluate("[...document.querySelectorAll('#pcKC3 [data-w=qa]')].map(b=>+b.dataset.n)")
        check('Hör-Quiz: erst 1/5/8, dann mehr', pool <= {0, 7, 12} and len(ch) == 6, (pool, ch))
        sm = await pg.inner_text('#pcKSum')
        check('Quiz-Ergebnisse zählen nicht als Häkchen; Kapitel-3-Häkchen da', sm.startswith('0 von 83') and await pg.evaluate("!!document.querySelector('#pcKC3 input[data-kx=\"k3-3-0\"]')"), sm)
        await pg.click('#pcKC3 input[data-kx="k3-3-0"]'); await pg.wait_for_timeout(100)
        check('Häkchen Kapitel 3 gespeichert', (await pg.inner_text('#pcKSum')).startswith('1 von 83') and await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1')).kurs['k3-3-0']===true"))
        await pg.evaluate("document.querySelectorAll('#pcSecKurs details.pc-kc').forEach(d=>d.open=true)"); await pg.evaluate("PcWerk.set({st:2,n:4,rs:0,rf:5})"); await pg.wait_for_timeout(400)
        o = await pg.evaluate(OVER); bt = await pg.evaluate(JT)
        check('Quer 1366×1024: nichts läuft horizontal über, kein Querscrollen', not o and await pg.evaluate("document.scrollingElement.scrollWidth-innerWidth") <= 1, o)
        check('Quer: Touch-Ziele ≥ 44 px (auch Bünde)', not bt, bt[:4])
        await pg.evaluate("document.getElementById('pcKC3').scrollIntoView()"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT + '_quer.png')
        await pg.set_viewport_size({'width': 820, 'height': 1180}); await pg.wait_for_timeout(400)
        o = await pg.evaluate(OVER); bt = await pg.evaluate(JT)
        check('Hoch 820×1180: nichts läuft über', not o and await pg.evaluate("document.scrollingElement.scrollWidth-innerWidth") <= 1, o)
        check('Hoch: Touch-Ziele ≥ 44 px', not bt, bt[:4])
        check('Hoch: rechte Spalte unter dem Griffbrett', await pg.evaluate("document.querySelector('#pcKC3 .pc-wright').getBoundingClientRect().top>=document.querySelector('#pcKC3 .pc-wleft').getBoundingClientRect().bottom-1"))
        await pg.evaluate("document.querySelector('#pcKC3 .pc-w').scrollIntoView()"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT + '_hoch.png')
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(300)
        o = await pg.evaluate(OVER); check('Schmal 390: nichts läuft über', not o, o)
        check('Keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        c2 = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await c2.new_page(); e2 = []
        pg.on('pageerror', lambda e: e2.append(str(e)))
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(1200); await pg.click('#tab-power'); await pg.wait_for_timeout(300); await pg.click('#pcSubs [data-sec=kurs]'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.getElementById('pcKC3').open=true"); await pg.wait_for_timeout(400)
        t = await pg.evaluate("[[...document.querySelectorAll('#pcKC3 [data-w=st]')].map(b=>b.textContent).join('|'),document.querySelector('#pcKC3 [data-w=iv][data-n=\"4\"]').textContent,document.querySelector('#pcKC3 [data-w=play][data-v=both]').textContent,document.querySelector('#pcKC3 .pc-wcard').textContent]")
        check('EN: Knöpfe englisch, Merkkarten deutsch', t[0].startswith('1 One string') and 'maj. 3rd' in t[1] and t[2] == 'Together' and 'Zahlen' in t[3], t)
        check('EN ohne Skriptfehler', not e2, e2[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
