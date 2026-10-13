# v65: Gesangsspur so hoch wie die Akkordleiste, Raster, Ziehen mit Einrast-Anzeige, Wort in der Spur ändern/löschen/teilen/einfügen, Scroll gekoppelt
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("Hold", 8, 0), ("on", 8.5, 0), ("to", 9, 0), ("the", 9.5, 0), ("nite", 10, 0), ("we", 13, 1), ("were", 13.5, 1), ("young", 14, 1), ("and", 15, 1), ("free", 15.5, 1)]]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
TK = "Object.values(JSON.parse(localStorage.getItem('3nps-sing')).f)[0].tok"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        await pg.click('#tab-looper'); await pg.click('#loopAll') if await pg.evaluate("Looper.debug().tracks[0].state==='playing'") else None
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        h = await pg.evaluate("[document.getElementById('sgStrip').offsetHeight, document.getElementById('sfStrip').offsetHeight]")
        check('Spur so hoch wie die Akkordleiste', h[0] == h[1] and h[0] >= 90, h)
        g = await pg.evaluate("[document.querySelectorAll('#sgStrip .sg-gbar').length, document.querySelectorAll('#sgStrip .sg-gbeat').length, document.querySelectorAll('#sgStrip .sg-g16').length, document.querySelectorAll('#sfStrip .sf-bar').length]")
        check('Raster: Takte wie oben, Schläge, 16tel', g[0] == g[3] and g[1] > g[0] and g[2] >= 3 * (g[0] + g[1]) - 3, g)
        rows = await pg.evaluate("[...document.querySelectorAll('#sgStrip .sg-w')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.top]})")
        ov = sum(1 for i, a in enumerate(rows) for c in rows[i + 1:] if a[2] == c[2] and a[0] < c[1] - 1 and c[0] < a[1] - 1)
        check('Wörter überdecken sich nicht', ov == 0 and len(rows) == 10, (ov, len(rows)))
        # Standard: Rest mitziehen – Wort 5 („we“) um 1 Schlag nach hinten, alle folgenden mit, davor bleibt
        check('Schalter „Rest mitziehen“ standardmäßig an', await pg.evaluate("document.getElementById('sgRipple').classList.contains('active')"))
        t0 = await pg.evaluate(TK)
        bx = await pg.evaluate("(()=>{const r=document.querySelector('#sgStrip .sg-w[data-i=\"5\"]').getBoundingClientRect();return [r.x+6,r.y+10]})()")
        px1 = await pg.evaluate("(()=>{const s=document.getElementById('sgStrip'),ci=SoloInfo(),src=Sing.source(ci);return (src.toCi(14)-src.toCi(13))/ci.L*parseFloat(s.style.width)})()")
        await pg.mouse.move(*bx); await pg.mouse.down(); await pg.mouse.move(bx[0] + px1 / 2, bx[1], steps=4); await pg.mouse.move(bx[0] + px1, bx[1], steps=4); await pg.mouse.up(); await pg.wait_for_timeout(250)
        t1 = await pg.evaluate(TK); d = [round(t1[j]['b'] - t0[j]['b'], 3) for j in range(len(t0))]
        check('Rest wandert mit, Abstände bleiben, davor unverändert', d[:5] == [0] * 5 and len(set(d[5:])) == 1 and d[5] > 0, d)
        # beim Ziehen bleibt jedes Wort in seiner Reihe (kein Rutschen nach unten)
        TOPS = "Object.fromEntries([...document.querySelectorAll('#sgStrip .sg-w')].map(e=>[e.dataset.i, e.offsetTop]))"
        top0 = await pg.evaluate(TOPS); jumps = 0
        bx2 = await pg.evaluate("(()=>{const r=document.querySelector('#sgStrip .sg-w[data-i=\"2\"]').getBoundingClientRect();return [r.x+6,r.y+10]})()")
        await pg.mouse.move(*bx2); await pg.mouse.down()
        for k in range(1, 13):
            await pg.mouse.move(bx2[0] + k * 9, bx2[1]); await pg.wait_for_timeout(60)
            tp = await pg.evaluate(TOPS); jumps += sum(1 for i in tp if top0.get(i) is not None and tp[i] != top0[i])
        await pg.mouse.up(); await pg.wait_for_timeout(250)
        check('beim Ziehen bleiben alle Wörter in ihrer Reihe', jumps == 0, jumps)
        top1 = await pg.evaluate(TOPS)
        check('nach dem Loslassen keine Reihe gewechselt (nichts überdeckt)', all(top1[i] == top0[i] for i in top0), {i: (top0[i], top1[i]) for i in top0 if top1.get(i) != top0[i]})
        await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('3nps-sing'));Object.values(d.f)[0].tok=%s;localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})()" % json.dumps(TOK))
        await pg.wait_for_timeout(300)
        bx = await pg.evaluate("(()=>{const r=document.querySelector('#sgStrip .sg-w[data-i=\"5\"]').getBoundingClientRect();return [r.x+6,r.y+10]})()")
        await pg.mouse.move(bx[0], bx[1]); await pg.mouse.down(); await pg.mouse.move(bx[0] + px1, bx[1], steps=4); await pg.mouse.up(); await pg.wait_for_timeout(250)
        # nicht über das Wort davor hinaus nach vorn
        await pg.mouse.move(bx[0] + px1, bx[1]); await pg.mouse.down(); await pg.mouse.move(bx[0] - px1 * 5, bx[1], steps=8); await pg.mouse.up(); await pg.wait_for_timeout(250)
        t2 = await pg.evaluate(TK)
        check('nach vorn höchstens bis zum Wort davor', t2[5]['b'] >= t2[4]['b'] and [x['w'] for x in t2] == [x['w'] for x in t0], (t2[4]['b'], t2[5]['b']))
        await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('3nps-sing'));Object.values(d.f)[0].tok=%s;localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})()" % json.dumps(TOK))
        await pg.wait_for_timeout(300)
        # Einzelwort-Modus
        await pg.click('#sgRipple'); await pg.wait_for_timeout(150)
        check('Schalter aus und gemerkt', await pg.evaluate("localStorage.getItem('3nps-sing-ripple')") == '0')
        # Ziehen mit Einrast-Anzeige
        box = await pg.evaluate("(()=>{const r=document.querySelector('#sgStrip .sg-w[data-i=\"2\"]').getBoundingClientRect();return [r.x+6,r.y+10]})()")
        b0 = (await pg.evaluate(TK))[2]['b']
        await pg.mouse.move(*box); await pg.mouse.down(); await pg.mouse.move(box[0] + 25, box[1], steps=4); await pg.mouse.move(box[0] + 45, box[1], steps=4)
        gl = await pg.evaluate("(()=>{const g=document.getElementById('sgSnapLine');return g&&!g.hidden?g.textContent:''})()")
        await pg.mouse.up()
        b1 = (await pg.evaluate(TK))[2]['b']
        check('Ziehen: Einrast-Linie mit Takt.Schlag, Zeit gerastet', gl.startswith('Takt ') and b1 > b0 and abs(b1 * 4 - round(b1 * 4)) < 1e-6, (gl, b0, b1))
        await pg.wait_for_timeout(200)
        order = [t['w'] for t in await pg.evaluate(TK)]
        check('über ein Wort gezogen → Reihenfolge folgt der Zeit', order[:5] == ['Hold', 'on', 'the', 'to', 'nite'] or order[:5] == ['Hold', 'on', 'the', 'nite', 'to'], order[:5])
        await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('3nps-sing'));const t=Object.values(d.f)[0].tok;const i=t.findIndex(x=>x.w==='to');const x=t.splice(i,1)[0];x.b=9;t.splice(2,0,x);localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})()")
        await pg.wait_for_timeout(300)
        check('nach dem Ziehen kein Eingabefeld', not await pg.query_selector('#sgStrip .sg-inline'))
        # Tippen auf Wort → direkt ändern
        await pg.click('#sgStrip .sg-w[data-i="4"]'); await pg.wait_for_timeout(200)
        check('Tippen öffnet Eingabefeld in der Spur', await pg.is_visible('#sgStrip .sg-inline input') and await pg.input_value('#sgStrip .sg-inline input') == 'nite')
        await pg.fill('#sgStrip .sg-inline input', 'night'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(250)
        tok = await pg.evaluate(TK)
        check('Wort geändert, Zeit bleibt', tok[4]['w'] == 'night' and tok[4]['b'] == 10, tok[4])
        # teilen
        await pg.click('#sgStrip .sg-w[data-i="7"]'); await pg.fill('#sgStrip .sg-inline input', 'so young'); await pg.click('#sgStrip .sg-inline .sg-ok'); await pg.wait_for_timeout(250)
        tok = await pg.evaluate(TK)
        check('mehrere Wörter = teilen', [t['w'] for t in tok[7:9]] == ['so', 'young'] and tok[7]['b'] < tok[8]['b'], [(t['w'], t['b']) for t in tok[6:10]])
        # löschen mit ✕
        n0 = len(tok)
        await pg.click('#sgStrip .sg-w[data-i="7"]'); await pg.wait_for_timeout(150)
        await pg.dispatch_event('#sgStrip .sg-inline .sg-del', 'pointerdown'); await pg.wait_for_timeout(250)
        tok = await pg.evaluate(TK)
        check('✕ löscht das Wort', len(tok) == n0 - 1 and 'so' not in [t['w'] for t in tok], [t['w'] for t in tok])
        # einfügen an freier Stelle (Takt 4, zwischen „night“ und „we“)
        x = await pg.evaluate("(()=>{const s=document.getElementById('sgStrip'),r=s.getBoundingClientRect(),ci=SoloInfo(),src=Sing.source(ci);return r.left+src.toCi(11.5)/ci.L*parseFloat(s.style.width)})()")
        y = await pg.evaluate("document.getElementById('sgStrip').getBoundingClientRect().y+86")
        await pg.mouse.click(x, y); await pg.wait_for_timeout(250)
        vis = await pg.is_visible('#sgStrip .sg-inline input')
        if vis: await pg.fill('#sgStrip .sg-inline input', 'yeah'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(250)
        tok = await pg.evaluate(TK); y_ = [t for t in tok if t['w'] == 'yeah']
        check('freie Stelle antippen = Wort einfügen (gerastet, richtig einsortiert)', vis and y_ and abs(y_[0]['b'] - 11.5) <= 0.25 and [t['w'] for t in tok].index('yeah') == 5, y_ and y_[0])
        # Escape bricht ab, leere neue Eingabe fügt nichts ein
        await pg.click('#sgStrip .sg-w[data-i="0"]'); await pg.fill('#sgStrip .sg-inline input', 'XX'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        check('Escape bricht ab', (await pg.evaluate(TK))[0]['w'] == 'Hold')
        # Scroll gekoppelt
        await pg.set_viewport_size({'width': 700, 'height': 900}); await pg.wait_for_timeout(600)
        sc = await pg.evaluate("(()=>{const a=document.getElementById('sfBand'),b=document.getElementById('sgBand');a.scrollLeft=200;return new Promise(r=>setTimeout(()=>{const x=b.scrollLeft;b.scrollLeft=60;setTimeout(()=>r([x,a.scrollLeft,a.scrollWidth>a.clientWidth]),300)},300))})()")
        check('Spur und Akkordleiste scrollen gemeinsam', sc[2] and abs(sc[0] - 200) <= 2 and abs(sc[1] - 60) <= 2, sc)
        # Abspielstrich auch in der Spur
        await pg.set_viewport_size({'width': 1180, 'height': 900}); await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        ph = await pg.evaluate("[document.getElementById('sgPh').style.transform, document.getElementById('sfPh').style.transform]")
        check('Abspielstrich in der Spur', ph[0] and ph[0] == ph[1], ph)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
