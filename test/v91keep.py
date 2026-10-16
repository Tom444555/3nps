# v91: „Takte ergänzen“ ohne Zeiten / „Nur Zeiten erkennen – mein Text bleibt“: Erkennung legt den EIGENEN Text auf den Gesang;
# Mitsingen läuft mit, wenn aus dem Editor (Teil ▶) abgespielt wird
import asyncio, json, re, time
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
LINES = ["Ich fahre auf der Straße", "bis zum Ende,", "und die Nacht ist lang", "danach kommt nichts mehr", "an der Grenze aus Licht"]
async def load(pg, f):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', f)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if re.match(r'^(Spur|Track) 1:', await pg.inner_text('#loopStatus')): break
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(800)
        await load(pg, T + 'sing/lied_de.wav')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(400)
        key = await pg.evaluate("Sing.source(SoloInfo()).id")
        tok = [{"w": w, "b": None, "l": l} for l, ln in enumerate(LINES) for w in ln.split()]
        await pg.evaluate("(([k,t])=>{const d={v:1,f:{},l:{}};d.f[k]={name:'lied_de.wav',tok:t,parts:[{name:'Strophe',b:0}]};localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%s)" % json.dumps([key, tok]))
        await pg.click('#sgToggle'); await pg.wait_for_timeout(400); await pg.select_option('#sgLang', 'de')
        check('ohne Zeiten: Hinweis sagt, dass der Gesang herausgehört wird; Knopf „Nur Zeiten erkennen“ da', 'hört den Gesang heraus' in await pg.inner_text('#sgEdit') and await pg.is_visible('#sgAutoKeep'))
        asked = await pg.evaluate("window._asked=[];window.confirm=m=>{window._asked.push(m);return true};0")
        t0 = time.time(); await pg.click('#sgFill2')
        for _ in range(600):
            await pg.wait_for_timeout(500)
            if not (await pg.evaluate("Sing.rec()"))['busy'] and time.time() - t0 > 2: break
        r = await pg.evaluate("(()=>{const s=Sing.source(SoloInfo());return {w:s.tok.map(t=>t.w),l:s.tok.map(t=>t.l),sec:s.tok.map(t=>t.b==null?null:Sing.b2f(t.b,s.beats)/s.sr),msg:Sing.rec().msg,parts:(Sing.data().f[s.id]||{}).parts,ask:window._asked}})()")
        check('eine Rückfrage vor dem Start', len(r['ask']) == 1 and 'Starten' in r['ask'][0], r['ask'])
        check('Text und Zeilen bleiben genau wie eingegeben', r['w'] == [w for ln in LINES for w in ln.split()] and r['l'] == [t['l'] for t in tok])
        sec = r['sec']; inwin = sum(1 for x in sec if x is not None and (3.5 <= x <= 12.8 or 21.5 <= x <= 30.8))
        check('alle Wörter haben eine Zeit, in Reihenfolge, zusammenhängend in EINEM gesprochenen Durchgang', all(x is not None for x in sec) and all(sec[i] < sec[i + 1] for i in range(len(sec) - 1)) and (all(3.5 <= x <= 12.8 for x in sec) or all(21.5 <= x <= 30.8 for x in sec)), [round(x, 1) for x in sec if x is not None])
        check('Meldung: wie viele aus der Erkennung', 'aus der Erkennung' in r['msg'], r['msg'][:140])
        check('Teile bleiben erhalten', r['parts'] and r['parts'][0]['name'] == 'Strophe', r['parts'])
        hit = int(re.match(r'\D*(\d+)', r['msg']).group(1)) if re.match(r'\D*(\d+)', r['msg']) else 0
        check('die meisten Wörter direkt aus der Erkennung (auch „Straße“/„Ende,“)', hit >= 15, hit)
        # ↶ macht alles rückgängig
        await pg.click('#sgUndo'); await pg.wait_for_timeout(200)
        check('↶ nimmt es zurück', await pg.evaluate("Sing.source(SoloInfo()).tok.every(t=>t.b==null)"))
        await pg.click('#sgRedo'); await pg.wait_for_timeout(200)
        # Mitsingen: Looper läuft und wird pausiert, abgespielt wird über „Teil ▶“ (eigener Player)
        st = sec[0] - 3
        await pg.evaluate("(st=>{const s=Sing.source(SoloInfo()),d=Sing.data();d.f[s.id].parts=[{name:'Strophe',b:Sing.f2b(st*s.sr,s.beats)}];localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%f)" % st)
        await pg.click('#tab-looper')
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.wait_for_timeout(1500); await pg.click('#tab-solo'); await pg.wait_for_timeout(400)
        await pg.click('[data-pplay="0"]'); await pg.wait_for_timeout(300)
        await pg.click('#tab-singen'); await pg.wait_for_timeout(1500)
        cur = lambda: pg.evaluate("(()=>{const r=document.querySelector('#sbList .sb-row.cur');return r?+r.dataset.l:-1})()")
        l0 = await cur(); tr0 = await pg.evaluate("document.getElementById('sbList').style.transform")
        await pg.wait_for_timeout(9000)
        l1 = await cur(); tr1 = await pg.evaluate("document.getElementById('sbList').style.transform")
        check('Mitsingen: am Anfang erste Zeile, später weiter unten und mitgescrollt', l0 == 0 and l1 >= 3 and tr0 != tr1, (l0, l1, tr0, tr1))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
