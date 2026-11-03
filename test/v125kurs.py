# v125: Powerchords – Bereich „Kurs“ (Power Chord Theory, Kapitel 1–7): träge, Griffe geprüft, Häkchen gespeichert, Anhören/Loop, iPad quer/hoch, EN
import asyncio, os, json
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '/tmp/v125kurs')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
JT = """()=>{const p=document.getElementById('pcSecKurs');const bad=[];p.querySelectorAll('button,label.check,summary').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return;
 if(r.height<43.5||(r.width<43.5&&e.tagName!=='SUMMARY'))bad.push((e.textContent.trim().slice(0,18)||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height));});return bad;}"""
HS = "document.scrollingElement.scrollWidth - innerWidth"
OPENALL = "document.querySelectorAll('#pcSecKurs details.pc-kc').forEach(d=>d.open=true)"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1300)
        v = await pg.evaluate("document.querySelector('meta[name=app-version]')?.content || document.title")
        check('Kurs träge: vor dem Öffnen leer', await pg.evaluate("!!window.PcKurs && document.getElementById('pcSecKurs').children.length===0"))
        await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        check('Andere Bereiche öffnen baut den Kurs nicht', await pg.evaluate("document.getElementById('pcSecKurs').children.length===0"))
        await pg.click('#pcSubs [data-sec=kurs]'); await pg.wait_for_timeout(400)
        info = await pg.evaluate("(()=>{const ds=[...document.querySelectorAll('#pcSecKurs details.pc-kc')];return {n:ds.length,t:ds.map(d=>d.querySelector('summary').textContent),open:ds.map(d=>d.open),filled:ds.map(d=>d.querySelector('.pc-sec-b').children.length>0)}})()")
        check('7 Kapitel, nur Kapitel 1 offen und gebaut', info['n'] == 7 and info['open'][0] and not any(info['open'][1:]) and info['filled'][0] and not any(info['filled'][1:]), info['t'])
        await pg.evaluate(OPENALL); await pg.wait_for_timeout(500)
        st = await pg.evaluate("(()=>{const subs=[...document.querySelectorAll('#pcSecKurs .pc-ksub')];return {subs:subs.length,ex:subs.every(s=>s.querySelector('.pc-kex input')),boards:document.querySelectorAll('#pcSecKurs .pc-kgrip svg').length,grips:document.querySelectorAll('#pcSecKurs .pc-kgrip').length,tn:subs.every(s=>s.querySelector('.pc-kbody[translate=no]')),unsicher:document.getElementById('pcSecKurs').textContent.includes('unsicher')}})()")
        check('Jedes Unterkapitel hat Lehrtext (translate=no) und Übungen', st['subs'] >= 40 and st['ex'] and st['tn'], st)
        check('Jedes Griffbild gezeichnet', st['grips'] > 30 and st['boards'] == st['grips'], st)
        check('Keine [unsicher]-Stellen im Text', not st['unsicher'])
        ck = await pg.evaluate("PcKurs.check()")
        check('Alle Griffe nachgerechnet (Intervalle/Namen/Formel)', ck['n'] > 60 and not ck['bad'], ck)
        ordr = await pg.evaluate("[...document.querySelectorAll('#pcSecKurs .pc-kex')].every(k=>{const s=[...k.querySelectorAll('span')].map(x=>x.innerHTML.startsWith('<i>(ergänzt)'));return s.indexOf(true)<0||s.slice(s.indexOf(true)).every(Boolean)})")
        check('Übungen: zuerst Lehrer, dann (ergänzt)', ordr)
        # Häkchen speichern (nur erweitern), Übungen-Fortschritt bleibt
        before = await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1')||'{}').exercises")
        await pg.click('#pcSecKurs input[data-kx="k2-3-0"]'); await pg.click('#pcSecKurs input[data-kx="k7-1-0"]'); await pg.wait_for_timeout(200)
        sv = await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1'))")
        check('Häkchen in powerchords.progress.v1 (Feld kurs)', sv.get('kurs', {}).get('k2-3-0') and sv['kurs'].get('k7-1-0') and sv['version'] == 1 and (not before or set(before) <= set(sv['exercises'])), sv.get('kurs'))
        check('Fortschrittszeile zählt', '2 von' in await pg.inner_text('#pcKSum'), await pg.inner_text('#pcKSum'))
        # Anhören / Loop
        await pg.evaluate("window.__n=0;const o=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){window.__n++;return o.call(this)};0")
        await pg.click('#pcSecKurs [data-k=play]'); await pg.wait_for_timeout(300)
        check('▶ Anhören spielt Töne', await pg.evaluate("window.__n") > 0)
        lp = await pg.query_selector('#pcSecKurs [data-k=loop]')
        if lp:
            await lp.scroll_into_view_if_needed(); await lp.click(); await pg.wait_for_timeout(900)
            pl = await pg.evaluate("Powerchords.playing()")
            check('▶ Loop starten legt die Folge in den Looper', pl and pl['mode'] == 'looper' and len(pl['names']) >= 3, pl)
            await pg.evaluate("Powerchords.stop()"); await pg.wait_for_timeout(200)
        else: check('▶ Loop starten vorhanden', False)
        bad = await pg.evaluate(JT)
        check('Quer 1366×1024: Touch-Ziele ≥ 44 px, kein Querscrollen', not bad and await pg.evaluate(HS) <= 1, bad[:4])
        await pg.screenshot(path=SHOT + '_quer.png')
        await pg.set_viewport_size({'width': 820, 'height': 1180}); await pg.wait_for_timeout(400)
        bad = await pg.evaluate(JT)
        check('Hoch 820×1180: Touch-Ziele ≥ 44 px, kein Querscrollen', not bad and await pg.evaluate(HS) <= 1, bad[:4])
        await pg.evaluate("document.getElementById('pcK_k4-3')?.scrollIntoView()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=SHOT + '_hoch.png')
        await pg.reload(); await pg.wait_for_timeout(1200); await pg.click('#tab-power'); await pg.wait_for_timeout(400); await pg.evaluate(OPENALL); await pg.wait_for_timeout(300)
        check('Nach Neustart: Kurs-Bereich gemerkt, Häkchen da', await pg.evaluate("!document.getElementById('pcSecKurs').hidden && document.querySelector('#pcSecKurs input[data-kx=\"k2-3-0\"]')?.checked===true"))
        check('Keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        c2 = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await c2.new_page(); e2 = []
        pg.on('pageerror', lambda e: e2.append(str(e)))
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(1200); await pg.click('#tab-power'); await pg.wait_for_timeout(300)
        await pg.click('#pcSubs [data-sec=kurs]'); await pg.wait_for_timeout(400); await pg.evaluate(OPENALL); await pg.wait_for_timeout(400)
        t = await pg.evaluate("[document.querySelector('#pcSubs [data-sec=kurs]').textContent,document.getElementById('pcKSum').textContent,[...new Set([...document.querySelectorAll('#pcSecKurs .toggle-btn, #pcSecKurs h5')].map(b=>b.textContent))].join('|'),document.querySelector('#pcSecKurs .pc-ksteps li').textContent]")
        check('EN: Knöpfe englisch, Lehrtext bleibt deutsch', t[0] == 'Course' and 'exercises ticked' in t[1] and 'Listen' in t[2] and 'Exercises' in t[2] and 'Übungen' not in t[2] and 'Anhören' not in t[2] and 'Kurs' in t[3], t)
        check('EN ohne Skriptfehler', not e2, e2[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
