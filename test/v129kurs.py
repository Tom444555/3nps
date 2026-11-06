# v129: Kurs komplett (15 Kapitel) – Startseite mit Kacheln (4/2/1 Spalten), einheitlicher Aufbau (Ziel, Schritt-Leiste, Bühne mit
# Zahl/Name/Ton und ▶ Grundton/Nacheinander/Zusammen, Übungen, Quiz mit Trefferzählung, Merke, Querverweise), alle Griffe nachgerechnet,
# Loops, Drop-D-Stimmung, nichts springt, kein Überlauf (quer/hoch/390), EN
import asyncio, os, re
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '/tmp/v129kurs')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
OVER = """()=>{const h=document.getElementById('pcSecKurs'),R=h.getBoundingClientRect().right,bad=[];h.querySelectorAll('*').forEach(e=>{if(e.closest('svg')||e.closest('[hidden]'))return;const r=e.getBoundingClientRect();if(!r.width)return;
 if(r.right>R+1)bad.push(e.tagName+'.'+e.className+' '+Math.round(r.right-R));if(/^(P|LI|SPAN|LABEL|H3|H4|H5|B|DIV|BUTTON)$/.test(e.tagName)&&e.scrollWidth>e.clientWidth+1&&!/hidden|auto|scroll/.test(getComputedStyle(e).overflowX)&&e.clientWidth)bad.push('scroll '+e.tagName+'.'+e.className+' '+(e.textContent||'').slice(0,30));});return bad.slice(0,6);}"""
JT = """()=>{const p=document.getElementById('pcSecKurs');const bad=[];p.querySelectorAll('button,label.check,summary').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||e.closest('[hidden]'))return;if(r.height<43.5||(r.width<43.5&&e.tagName!=='SUMMARY'))bad.push((e.textContent.trim().slice(0,14))+' '+Math.round(r.width)+'x'+Math.round(r.height));});
 p.querySelectorAll('.pc-kstage .pc-cell').forEach(c=>{const r=c.getBoundingClientRect();if(r.width&&(r.width<43.5||r.height<43.5))bad.push('cell '+Math.round(r.width)+'x'+Math.round(r.height));});return bad.slice(0,5);}"""
COLS = "(()=>{const t=[...document.querySelectorAll('#pcKRings .pc-tile')].map(x=>Math.round(x.getBoundingClientRect().top));return t.filter(v=>v===t[0]).length})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1300)
        check('Version ab v129', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 129)
        check('Vor dem Öffnen nichts gebaut', await pg.evaluate("document.getElementById('pcSecKurs').children.length===0"))
        await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        t = await pg.evaluate("[...document.querySelectorAll('#pcKRings .pc-tile')].map(x=>[x.querySelector('.pc-tring b').textContent,x.querySelector('.pc-tt b').textContent,x.querySelector('.pc-td').textContent.length,!!x.querySelector('.pc-rfg')])")
        check('Startseite: 15 Kacheln mit Nummer, Titel, Kurzbeschreibung, Ring', len(t) == 15 and all(x[0] == str(i + 1) and x[1] and x[2] > 10 and x[3] for i, x in enumerate(t)), t[:2])
        check('Quer: 4 Kacheln nebeneinander', await pg.evaluate(COLS) == 4)
        check('Kapitel erst beim Antippen gebaut', await pg.evaluate("[...document.querySelectorAll('#pcSecKurs details.pc-kc .pc-sec-b')].every(x=>!x.children.length)"))
        await pg.click('#pcKRings .pc-tile[data-kring="7"]'); await pg.wait_for_timeout(700)
        check('Kachel 8 öffnet Kapitel 8', await pg.evaluate("document.getElementById('pcKC8').open && document.querySelectorAll('#pcKC8 .pc-ksub').length>=6"))
        await pg.evaluate("document.querySelectorAll('#pcSecKurs details.pc-kc').forEach(d=>d.open=true)"); await pg.wait_for_timeout(1500)
        st = await pg.evaluate("""PcKurs.K.map((C,ci)=>{const d=document.getElementById('pcKC'+(ci+1));if(C.w)return {w:1,ok:!!d.querySelector('.pc-w')};
          const subs=d.querySelectorAll('.pc-ksub');return {ziel:!!d.querySelector('.pc-kziel'),steps:d.querySelectorAll('.pc-kstep').length===C.s.length,ex:[...subs].every(s=>s.querySelector('.pc-kex input')),
          quiz:!!d.querySelector('.pc-kquiz [data-kqs]'),merke:d.querySelectorAll('.pc-kmerke .pc-wcard').length,stage:C.s.filter(S=>S.g&&S.g.length).length===d.querySelectorAll('.pc-kstage svg.pc-board').length,tn:[...subs].every(s=>s.querySelector('.pc-kbody[translate=no]'))}})""")
        bad = [i + 1 for i, x in enumerate(st) if not x.get('w') and not (x['ziel'] and x['steps'] and x['ex'] and x['quiz'] and x['merke'] >= 1 and x['stage'] and x['tn'])]
        check('Alle 15 Kapitel einheitlich: Ziel, Schritt-Leiste, Schritte, Bühne, Übungen, Quiz, Merke (Kap. 3 = Werkstatt)', not bad and st[2].get('ok'), (bad, [st[i] for i in [b - 1 for b in bad]][:2]))
        n8 = await pg.evaluate("PcKurs.K.slice(7).reduce((a,C)=>a+C.s.length,0)")
        check('Kapitel 8–15 mit Unterkapiteln (≥ 45)', n8 >= 45, n8)
        ck = await pg.evaluate("PcKurs.check()")
        check('Alle Griffe und Loop-Akkorde nachgerechnet (Intervalle, Formeln, Stimmungen)', ck['n'] > 250 and not ck['bad'], ck)
        un = await pg.evaluate("document.getElementById('pcSecKurs').textContent.includes('unsicher')")
        check('Keine [unsicher]-Stellen im Text', not un)
        ordr = await pg.evaluate("[...document.querySelectorAll('#pcSecKurs .pc-kex')].every(k=>{const s=[...k.querySelectorAll('span')].map(x=>x.innerHTML.startsWith('<i>(ergänzt)'));return s.indexOf(true)<0||s.slice(s.indexOf(true)).every(Boolean)})")
        check('Übungen: zuerst Lehrer, dann (ergänzt)', ordr)
        # Bühne: Beschriftung umschalten, Größe bleibt
        S = '#pcK_k8-3'
        await pg.evaluate("document.querySelector('%s').scrollIntoView()" % S)
        def lab(): return pg.evaluate("[...document.querySelectorAll('%s .pc-kstage .pc-m text')].map(t=>t.textContent).join(',')" % S)
        h0 = await pg.evaluate("document.querySelector('%s .pc-kstage svg').getBoundingClientRect().height" % S)
        l1 = await lab(); await pg.click('%s [data-kl2=name]' % S); l2 = await lab(); await pg.click('%s [data-kl2=ton]' % S); l3 = await lab()
        check('Bühne: Zahl / Name / Ton', '1' in l1 and 'Grundton' in l2 and 'gr.' in l2 and 'C' in l3.split(',') and 'B' in l3.split(','), (l1, l2, l3))
        await pg.click('%s .pc-kgrip[data-kpick$=".3"]' % S); await pg.wait_for_timeout(100)
        h1 = await pg.evaluate("document.querySelector('%s .pc-kstage svg').getBoundingClientRect().height" % S)
        check('Vorschaubild wählt Griff, Bühne springt nicht', (await pg.inner_text('%s .pc-kstn' % S)) == 'Cm7b5' and abs(h0 - h1) < 1, (h0, h1))
        await pg.click('%s [data-kl2=num]' % S)
        check('Farbige Intervall-Punkte (Grundton/Terz/Quinte/Septime)', await pg.evaluate("(()=>{const c=[...document.querySelectorAll('%s .pc-kstage .pc-m')].map(g=>g.getAttribute('class'));return c.some(x=>/f1/.test(x))&&c.some(x=>/f3/.test(x))&&c.some(x=>/f7/.test(x))})()" % S))
        await pg.evaluate("window.__n=0;const o=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){window.__n++;return o.call(this)};0")
        for v in ['root', 'seq', 'all']: await pg.click('%s [data-k=sp][data-v=%s]' % (S, v))
        await pg.evaluate("document.querySelector('%s .pc-kstage .pc-cell[data-s=\"1\"][data-f=\"3\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))" % S)
        check('▶ Grundton / Nacheinander / Zusammen und Tippen klingen', await pg.evaluate("window.__n") >= 10)
        # Loops in Kapitel 8–15
        lp = await pg.evaluate("[...document.querySelectorAll('#pcSecKurs [data-k=loop]')].map(b=>b.dataset.kl).filter(k=>+k.split('.')[0]>=7)")
        okl = 0
        for k in lp:
            await pg.evaluate("document.querySelector('#pcSecKurs [data-kl=\"%s\"]').click()" % k); await pg.wait_for_timeout(250)
            pl = await pg.evaluate("Powerchords.playing()"); okl += bool(pl and len(pl['names']) >= 2)
        await pg.evaluate("Powerchords.stop()")
        check('▶ Loop starten in Kapitel 8–15 (%d Loops)' % len(lp), len(lp) >= 12 and okl == len(lp), (okl, len(lp)))
        # Quiz mit Trefferzählung
        await pg.evaluate("document.querySelector('#pcKC9 [data-kqs]').scrollIntoView()"); await pg.click('#pcKC9 [data-kqs]')
        for i in range(10):
            q = await pg.evaluate("PcKurs.quiz(8)")
            await pg.click('#pcKC9 [data-kqa="%s"]' % q['want'] if i else '#pcKC9 [data-kqa]:not([data-kqa="%s"])' % q['want'])
            if i < 9: await pg.click('#pcKC9 [data-kqn]')
        cnt = await pg.inner_text('#pcKC9 .pc-wcnt'); sv = await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1')).kurs['q-k9']")
        check('Quiz: 10 Aufgaben, Trefferzählung, Ergebnis gespeichert', 'Aufgabe 10 von 10 · Treffer: 9' in cnt and sv and sv['best'] == 9, (cnt, sv))
        await pg.evaluate("document.querySelector('#pcKC1 [data-kqs]').click()"); await pg.wait_for_timeout(100)
        check('Kapitel 1: Stammton-Quiz', (await pg.evaluate("PcKurs.quiz(0)"))['kind'] == 'nt')
        # Querverweis
        await pg.evaluate("document.getElementById('pcKC7').open=false"); await pg.evaluate("document.querySelector('#pcK_k8-2 [data-kref=\"7\"]').click()"); await pg.wait_for_timeout(500)
        check('Querverweis öffnet Kapitel 7', await pg.evaluate("document.getElementById('pcKC7').open"))
        check('Drop D: Saite heißt D, Griff mit einem Finger', await pg.evaluate("(()=>{const t=[...document.querySelectorAll('#pcK_k15-1 .pc-kstage .pc-sn')].map(x=>x.textContent);return t.includes('D')&&!t.includes('E')})()"))
        # Häkchen und Ring
        await pg.evaluate("document.querySelector('#pcKC8 input[data-kx=\"k8-1-0\"]').click()"); await pg.wait_for_timeout(150)
        check('Häkchen Kapitel 8 gespeichert, Ring und Schritt-Leiste aktualisiert', await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1')).kurs['k8-1-0']===true && document.querySelector('#pcKRings .pc-tile[data-kring=\"7\"] .pc-tp').textContent.startsWith('1 /')"))
        for vw, vh, nm, cols in [(1366, 1024, 'quer', 4), (820, 1180, 'hoch', 2), (390, 844, '390', 1)]:
            await pg.set_viewport_size({'width': vw, 'height': vh}); await pg.wait_for_timeout(500)
            o = await pg.evaluate(OVER); jt = await pg.evaluate(JT) if vw > 400 else []
            check('%s %d×%d: %d Kachel(n) je Reihe, kein Überlauf, Touch ≥ 44 px' % (nm, vw, vh, cols), await pg.evaluate(COLS) == cols and not o and not jt and await pg.evaluate("document.scrollingElement.scrollWidth-innerWidth") <= 1, (await pg.evaluate(COLS), o, jt))
            await pg.evaluate("document.getElementById('pcKRings').scrollIntoView()"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT + '_start_' + nm + '.png')
        await pg.set_viewport_size({'width': 1366, 'height': 1024}); await pg.evaluate("document.querySelector('#pcK_k8-3').scrollIntoView()"); await pg.wait_for_timeout(300); await pg.screenshot(path=SHOT + '_kap8.png')
        await pg.evaluate("document.querySelector('#pcKC11 .pc-kziel').scrollIntoView()"); await pg.wait_for_timeout(300); await pg.screenshot(path=SHOT + '_kap11.png')
        check('Keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        c2 = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await c2.new_page(); e2 = []
        pg.on('pageerror', lambda e: e2.append(str(e)))
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(1200); await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        await pg.evaluate("document.getElementById('pcKC10').open=true"); await pg.wait_for_timeout(500)
        t = await pg.evaluate("[document.querySelector('#pcKC10 .pc-kmerke h4').textContent,document.querySelector('#pcKC10 [data-kqs]').textContent,document.querySelector('#pcKC10 [data-kl2=ton]').textContent,document.querySelector('#pcKC10 .pc-ksteps li').textContent]")
        check('EN: Knöpfe englisch, Lehrtext deutsch', t[0] == 'Remember' and 'Start quiz' in t[1] and t[2] == 'Note' and 'machen' in t[3], t)
        check('EN ohne Skriptfehler', not e2, e2[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
