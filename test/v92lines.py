# v92: Text ohne Zeilenumbrüche (ganzes Lied = eine Zeile): Mitsingen teilt selbst und scrollt; Editor warnt und teilt dauerhaft
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
L = [("Hold on to the night,", 8), ("we were young and free", 14), ("the river runs so cold", 22), ("and nobody can see", 28),
     ("Hold on to the night,", 40), ("we were young and free", 46), ("the river runs so cold", 54), ("and nobody can see.", 60)]
TOK = [{"w": w, "b": b0 + k * 0.5, "l": 0} for l, (txt, b0) in enumerate(L) for k, w in enumerate(txt.split())]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
SEEK = "(b=>{const s=Sing.source(SoloInfo());Looper.seek(0,Sing.b2f(b,s.beats)-s.origPos)})(%f)"
ST = "[document.querySelectorAll('#sbList .sb-row').length, document.querySelector('#sbList').style.transform, (document.querySelector('#sbList .sb-row.cur .sb-w.on')||{}).textContent||'', +(document.querySelector('#sbList .sb-row.cur')||{dataset:{l:-1}}).dataset.l]"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 820})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        for _ in range(40):
            if await pg.evaluate("!!(window.SoloInfo && Sing.source(SoloInfo()))"): break
            await pg.wait_for_timeout(250)
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(400); await pg.click('#tab-singen')
        res = []
        for bb in (8.1, 15.1, 23.1, 29.1):
            await pg.evaluate(SEEK % bb); await pg.wait_for_timeout(800); res.append(await pg.evaluate(ST))
        check('Mitsingen teilt die eine lange Zeile in mehrere Zeilen', res[0][0] >= 6, res[0][0])
        check('aktuelles Wort stimmt und die aktuelle Zeile wandert weiter', all(r[2] for r in res) and [r[3] for r in res] == [0, 1, 2, 3], [(r[2], r[3]) for r in res])
        check('die Liste scrollt mit', len(set(r[1] for r in res)) == 4, [r[1] for r in res])
        check('gespeicherte Daten unverändert (eine Zeile)', await pg.evaluate("Sing.source(SoloInfo()).tok.every(t=>t.l===0)"))
        await pg.click('#tab-solo'); await pg.wait_for_timeout(300); await pg.click('#sgToggle'); await pg.wait_for_timeout(400)
        w = await pg.evaluate("[...document.querySelectorAll('#sgEdit .sg-warn')].map(x=>x.textContent).join('|')")
        check('Editor warnt: Zeile 1 hat 40 Wörter, Knopf „Zeilen teilen“', 'Zeile 1 hat 38 Wörter' in w and await pg.is_visible('#sgSplit'), w[:80])
        await pg.click('#sgSplit'); await pg.wait_for_timeout(300)
        ls = await pg.evaluate("Sing.source(SoloInfo()).tok.map(t=>t.l)")
        starts = [i for i in range(1, len(ls)) if ls[i] != ls[i - 1]]
        check('dauerhaft geteilt an den Pausen (wie die echten Zeilen)', starts == [5, 10, 15, 19, 24, 29, 34], starts)
        check('Hinweis weg', not await pg.is_visible('#sgSplit'))
        await pg.click('#sgUndo'); await pg.wait_for_timeout(200)
        check('↶ nimmt es zurück', await pg.evaluate("Sing.source(SoloInfo()).tok.every(t=>t.l===0)"))
        tk = await pg.evaluate("Sing.tokenize('a b\\rc d\\r\\ne f\\u2028g h').map(t=>t.l)")
        check('Einfügen erkennt alle Zeilenumbrüche (\\r, \\r\\n, Zeilentrenner)', tk == [0, 0, 1, 1, 2, 2, 3, 3], tk)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
