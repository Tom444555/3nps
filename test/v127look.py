# v127: neuer Look im Reiter Powerchords – Palisander-Griffbrett (träge geladen), Skin in allen Griffbildern, eindeutige IDs, keine Filter,
# Kapitel-Ringe, Schritt-Leiste, große Intervall-Knöpfe, Zitat-Merkkarten, SVG-Symbole, kein Überlauf (quer/hoch/390), nichts springt
import asyncio, os, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '/tmp/v127look')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
OVER = """(sel)=>{const h=document.querySelector(sel),R=h.getBoundingClientRect().right,bad=[];h.querySelectorAll('*').forEach(e=>{if(e.closest('svg')||e.closest('[hidden]')||e.closest('details:not([open])'))return;const r=e.getBoundingClientRect();if(!r.width)return;
 if(r.right>R+1)bad.push(e.tagName+'.'+e.className+' '+Math.round(r.right-R));if(/^(P|LI|SPAN|LABEL|H3|H4|H5|B|DIV|BUTTON)$/.test(e.tagName)&&e.scrollWidth>e.clientWidth+1&&!/hidden|auto|scroll/.test(getComputedStyle(e).overflowX)&&e.clientWidth)bad.push('scroll '+e.tagName+'.'+e.className+' '+(e.textContent||'').slice(0,30));});return bad.slice(0,6);}"""
JT = """()=>{const p=document.getElementById('pcSecKurs');const bad=[];p.querySelectorAll('button,label.check,summary').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||e.closest('[hidden]'))return;if(r.height<43.5||(r.width<43.5&&e.tagName!=='SUMMARY'))bad.push((e.textContent.trim().slice(0,14))+' '+Math.round(r.width)+'x'+Math.round(r.height));});return bad.slice(0,5);}"""
SKIN = "(sel)=>{const s=[...document.querySelectorAll(sel)].filter(x=>!x.closest('.pc-ic'));return [s.length,s.filter(x=>x.querySelector('.pc-skin pattern image, pattern image')&&x.querySelector('.pc-skin')).length]}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1500)
        check('Version ab v127', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 127)
        LD = "performance.getEntriesByType('resource').filter(r=>r.name.includes('palisander')).length"
        check('Holztextur vor dem Öffnen nicht geladen', await pg.evaluate(LD) == 0)
        await open_tab(pg, 'power'); await pg.wait_for_timeout(300)
        for sec in ['schritte', 'brett', 'folgen', 'uebungen']:
            await pg.click('#pcSubs [data-sec=%s]' % sec); await pg.wait_for_timeout(300)
        await pg.evaluate("Powerchords.startProg('looper')"); await pg.wait_for_timeout(600)
        await pg.wait_for_timeout(500)
        sz = await pg.evaluate("(async()=>{const r=await fetch('img/palisander.jpg');return [r.ok,(await r.blob()).size]})()")
        check('Textur geladen, sobald Griffbretter sichtbar; < 150 KB', await pg.evaluate(LD) >= 1 and sz[0] and sz[1] < 150000, sz)
        for nm, sel in [('Schritte', '#pcStBoard svg'), ('Griffbrett', '#pcSecBrett svg.pc-board'), ('Akkordfolgen', '#pcSecFolgen svg.pc-board'), ('Übungs-Loop', '#pcPlayBoard svg')]:
            r = await pg.evaluate(SKIN, sel); check('Skin: ' + nm, r[0] >= 1 and r[0] == r[1], r)
        await pg.evaluate("Powerchords.stop()")
        await pg.click('#pcSubs [data-sec=brett]'); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT + '_brett.png')
        await pg.click('#pcSubs [data-sec=kurs]'); await pg.wait_for_timeout(300)
        check('Kapitel-Ringe 1–15', await pg.evaluate("document.querySelectorAll('#pcKRings .pc-ring svg circle.pc-rfg').length") == 15)
        await pg.evaluate("document.querySelectorAll('#pcSecKurs details.pc-kc').forEach(d=>d.open=true)"); await pg.wait_for_timeout(700)
        r = await pg.evaluate(SKIN, '#pcSecKurs .pc-kgrip svg.pc-board'); check('Skin: alle Kurs-Griffbilder', r[0] > 80 and r[0] == r[1], r)
        r = await pg.evaluate(SKIN, '#pcKC3 svg.pc-wb'); check('Skin: Werkstatt', r == [1, 1], r)
        await pg.click('#pcSecKurs input[data-kx="k2-1-0"]'); await pg.wait_for_timeout(100)
        rg = await pg.evaluate("document.querySelectorAll('#pcKRings .pc-rfg')[1].getAttribute('stroke-dasharray').split(' ').map(Number)")
        check('Ring Kapitel 2 zeigt Fortschritt', 0 < rg[0] < rg[1], rg)
        d = await pg.evaluate("(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);const s=new Set(),dup=[];ids.forEach(i=>{if(s.has(i))dup.push(i);s.add(i)});return dup.slice(0,5)})()")
        check('Eindeutige IDs (auch SVG-Verläufe/Muster)', not d, d)
        check('Keine SVG-Filter, keine Leerlauf-Animation', await pg.evaluate("document.querySelectorAll('#panel-power filter,#panel-power [filter]').length===0 && document.getAnimations().filter(a=>a.playState==='running'&&a.effect.getTiming().iterations===Infinity&&a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('#panel-power')).length===0"))
        check('Schatten unter Punkten, Perlmutt, Sattel, umsponnene Saiten', await pg.evaluate("(()=>{const s=document.querySelector('#pcKC3 svg.pc-wb');return s.querySelectorAll('.pc-msh').length>=2&&s.querySelectorAll('radialGradient').length===1&&s.querySelectorAll('.pc-skin line[stroke-dasharray]').length===3})()"))
        check('SVG-Symbole statt ▶/✎/☐ in Kurs und Werkstatt', await pg.evaluate("(()=>{const t=[...document.querySelectorAll('#pcSecKurs button')].map(b=>b.textContent).join('|');return !/[▶◀✎☐]/.test(t)&&document.querySelectorAll('#pcSecKurs button .pc-ic').length>100})()"))
        check('Große Intervall-Knöpfe (13 gleich breit, ≥ 60 px hoch)', await pg.evaluate("(()=>{const b=[...document.querySelectorAll('#pcKC3 .pc-wivrow .pc-wiv')].map(x=>x.getBoundingClientRect());return b.length===13&&b.every(r=>r.height>=60&&Math.abs(r.width-b[0].width)<1)&&Math.abs(b[12].top-b[0].top)<1})()"))
        check('Zitat-Merkkarten mit Quelle', await pg.evaluate("document.querySelectorAll('#pcKC3 .pc-wcard small').length>=5 && getComputedStyle(document.querySelector('#pcKC3 .pc-wcard'),'::before').content.includes('“')"))
        await pg.evaluate("PcWerk.set({st:2,rs:0,rf:5,n:4})"); await pg.wait_for_timeout(100)
        st = await pg.evaluate("PcWerk.set({st:3});PcWerk.set({st:2});[...document.querySelectorAll('#pcKC3 .pc-wstep')].map(b=>b.className)")
        check('Schritt-Leiste: besuchter Schritt mit Häkchen, aktueller hervorgehoben', 'seen' in st[0] and 'active' in st[1], st[:3])
        hs = []
        for o in ["{n:0}", "{n:6}", "{n:12}", "{lab:'all'}", "{lab:'num'}", "{st:4}", "{st:2}"]:
            await pg.evaluate("PcWerk.set(%s)" % o); hs.append(await pg.evaluate("(()=>{const a=document.querySelector('#pcKC3 .pc-wleft').getBoundingClientRect(),b=document.querySelector('#pcKC3 .pc-wbw').getBoundingClientRect();return [Math.round(b.top-a.top),Math.round(document.querySelector('#pcKC3 .pc-wsingle').getBoundingClientRect().top-a.top)]})()"))
        check('Nichts springt (Griffbrett und Knöpfe an festem Platz)', len(set(map(tuple, hs))) == 1, hs)
        for vw, vh, nm in [(1366, 1024, 'quer'), (820, 1180, 'hoch'), (390, 844, '390')]:
            await pg.set_viewport_size({'width': vw, 'height': vh}); await pg.wait_for_timeout(400)
            o = await pg.evaluate(OVER, '#panel-power'); jt = await pg.evaluate(JT) if vw > 400 else []
            check('%s %d×%d: kein Überlauf, Touch-Ziele ≥ 44 px' % (nm, vw, vh), not o and not jt and await pg.evaluate("document.scrollingElement.scrollWidth-innerWidth") <= 1, (o, jt))
            await pg.evaluate("document.getElementById('pcKC3').scrollIntoView()"); await pg.wait_for_timeout(250); await pg.screenshot(path=SHOT + '_' + nm + '.png')
        await pg.set_viewport_size({'width': 1366, 'height': 1024}); await pg.evaluate("document.getElementById('pcKC2').scrollIntoView()"); await pg.wait_for_timeout(250); await pg.screenshot(path=SHOT + '_kurs.png')
        await pg.evaluate("document.documentElement.dataset.theme='light'"); await pg.wait_for_timeout(200); await pg.evaluate("document.getElementById('pcKRings').scrollIntoView()"); await pg.screenshot(path=SHOT + '_hell.png')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
