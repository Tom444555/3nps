# v88: Wörter in falscher zeitlicher Reihenfolge (z. B. nach dem Einfügen eines ganzen Textes): Warnung, „Reihenfolge reparieren“, Mitsingen beginnt mit der ersten Zeile und hängt nicht
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
L = [("Hold on to the night", 8), ("we were young and free", 14), ("the river runs so cold", 22), ("and nobody can see", 28)]
TOK = [{"w": w, "b": b0 + k * 0.5, "l": l} for l, (txt, b0) in enumerate(L) for k, w in enumerate(txt.split())]
TOK[16]['b'] = 4.0      # „and“ (Zeile 4) liegt zeitlich ganz vorn – wie nach einem missglückten Einfügen
TOK[7]['b'] = 30.5      # „young“ (Zeile 2) liegt weit hinten
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
SEEK = "(b=>{const s=Sing.source(SoloInfo());Looper.seek(0,Sing.b2f(b,s.beats)-s.origPos)})(%f)"
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
        await pg.click('#tab-solo'); await pg.wait_for_timeout(400); await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        w = await pg.evaluate("[document.querySelector('#sgEdit .sg-warn') && document.querySelector('#sgEdit .sg-warn').textContent, Sing.outOfOrder()]")
        check('Warnung: genau die zwei falsch liegenden Wörter erkannt', w[0] and w[1] == [7, 16] and w[0].startswith('⚠ 2'), w)
        # Wort „were“ (13.5) darf nicht „hängen“: nach ihm kommt zeitlich „and“ (15), nicht „young“ (30.5)
        e = await pg.evaluate("(()=>{const s=Sing.source(SoloInfo());return Sing.endOf(s.tok,6)})()")
        check('Wortende nach Zeit (kein Hängen): nach „were“ kommt „and“', abs(e - 15.5) < 0.01, e)
        await pg.click('#sgFixOrder'); await pg.wait_for_timeout(300)
        tk = await pg.evaluate("Sing.source(SoloInfo()).tok.map(t=>t.b)")
        check('repariert: alle Wörter in zeitlicher Reihenfolge, „young“ zwischen „were“ und „and“', all(tk[i] < tk[i + 1] for i in range(len(tk) - 1)) and 14.5 < tk[7] < 15.5 and 28 < tk[16] < 29, tk)
        await pg.click('#sgUndo'); await pg.wait_for_timeout(200)
        check('↶ nimmt die Reparatur zurück', await pg.evaluate("Sing.outOfOrder().length") == 2)
        await pg.click('#sgRedo'); await pg.wait_for_timeout(200)
        # Mitsingen: am Anfang die erste Zeile, dann läuft es mit
        await pg.click('#tab-singen'); await pg.evaluate(SEEK % 2.0); await pg.wait_for_timeout(700)
        l0 = await pg.evaluate("+document.querySelector('#sbList .sb-row.cur').dataset.l")
        await pg.evaluate(SEEK % 14.1); await pg.wait_for_timeout(700)
        l1 = await pg.evaluate("[+document.querySelector('#sbList .sb-row.cur').dataset.l, document.querySelector('#sbList .sb-row.cur .sb-w.on') && document.querySelector('#sbList .sb-row.cur .sb-w.on').textContent]")
        check('Mitsingen: Anfang = erste Zeile, später die richtige Zeile mit dem richtigen Wort', l0 == 0 and l1[0] == 1 and l1[1] and l1[1].replace('+','').strip()[:2] in ('we',), (l0, l1))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
