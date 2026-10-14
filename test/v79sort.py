# v79: Wörter im Editor umsortieren (Ziehen, ⇠/⇢ tauschen; Zeiten bleiben), Spur zeigt übereinanderliegende Wörter (versetzt, „+n“, antippen = Takt breit)
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("Hold", 8, 0), ("on", 8.5, 0), ("to", 9, 0), ("the", 9, 0), ("nite", 9, 0), ("we", 13, 1), ("young", 13.5, 1), ("were", 14, 1), ("and", 15, 1), ("free", 15.5, 1)]]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
TK = "Object.values(JSON.parse(localStorage.getItem('3nps-sing')).f)[0].tok"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(700)
        # Stapel: „to the nite“ liegen auf Schlag 9
        st = await pg.evaluate("[[...document.querySelectorAll('#sgStrip .sg-stkn')].map(x=>x.textContent), [...document.querySelectorAll('#sgStrip .sg-w.stk')].map(x=>[+x.dataset.i, x.dataset.lvl||'0', x.offsetTop])]")
        check('übereinanderliegende Wörter: „+2“ und versetzt (orange)', st[0] == ['+2'] and sorted(x[0] for x in st[1]) == [2, 3, 4] and len(set(x[2] for x in st[1])) == 3, st)
        await pg.click('#sgStrip .sg-stkn'); await pg.wait_for_timeout(400)
        check('„+2“ antippen: Takt breit, erstes Wort gewählt', await pg.evaluate("SoloFocus.get()") is not None and await pg.evaluate("Sing.ui().sel") == 2)
        await pg.click('#sgFSpread'); await pg.wait_for_timeout(300)
        check('nach „verteilen“ kein Stapel mehr', await pg.evaluate("document.querySelectorAll('#sgStrip .sg-stkn').length") == 0)
        await pg.click('#sgFDone')
        # Editor: tauschen
        await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        t0 = await pg.evaluate(TK)
        await pg.click('#sgEdit .sg-chip[data-i="6"]'); await pg.wait_for_timeout(200)
        await pg.click('#sgSwapR'); await pg.wait_for_timeout(300)
        t1 = await pg.evaluate(TK)
        check('„tauschen ⇢“: Wörter tauschen, Zeiten bleiben', [t['w'] for t in t1[5:8]] == ['we', 'were', 'young'] and [t['b'] for t in t1] == [t['b'] for t in t0], [t['w'] for t in t1])
        # Umsortieren per Ziehen: „free“ (9) auf „and“ (8)
        await pg.click('#sgSort'); await pg.wait_for_timeout(300)
        a = await pg.evaluate("(()=>{const r=document.querySelector('#sgEdit .sg-chip[data-i=\"9\"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        c = await pg.evaluate("(()=>{const r=document.querySelector('#sgEdit .sg-chip[data-i=\"8\"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move((a[0] + c[0]) / 2, a[1], steps=4); await pg.mouse.move(*c, steps=4); await pg.mouse.up(); await pg.wait_for_timeout(400)
        t2 = await pg.evaluate(TK)
        check('Ziehen im Umsortier-Modus: „free“ vor „and“, Zeiten bleiben', [t['w'] for t in t2[8:]] == ['free', 'and'] and [t['b'] for t in t2] == [t['b'] for t in t0], [t['w'] for t in t2])
        # über Zeilen hinweg: „Hold“ (0) auf „we“ (5)
        a = await pg.evaluate("(()=>{const r=document.querySelector('#sgEdit .sg-chip[data-i=\"0\"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        c = await pg.evaluate("(()=>{const r=document.querySelector('#sgEdit .sg-chip[data-i=\"5\"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(a[0], (a[1] + c[1]) / 2, steps=4); await pg.mouse.move(*c, steps=4); await pg.mouse.up(); await pg.wait_for_timeout(400)
        t3 = await pg.evaluate(TK)
        check('auch in eine andere Zeile', t3[5]['w'] == 'Hold' and t3[0]['w'] == 'on' and t3[5]['l'] == 1, [t['w'] for t in t3])
        sp = await pg.evaluate("[...document.querySelectorAll('#sgStrip .sg-w')].sort((a,b)=>a.dataset.i-b.dataset.i).map(x=>x.textContent)")
        check('Spur oben zeigt die neue Reihenfolge sofort', sp[:6] == [t['w'] for t in t3[:6]], sp[:6])
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
