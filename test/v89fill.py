# v89: Wörter ohne Takt („–“) bekommen einen Takt; komplettes Einfügen behält die Zeiten auch bei großen Verschiebungen
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
L = [("Hold on to the night", 8), ("we were young and free", 14), ("the river runs so cold", 22), ("and nobody can see", 28)]
TOK = [{"w": w, "b": b0 + k * 0.5, "l": l} for l, (txt, b0) in enumerate(L) for k, w in enumerate(txt.split())]
for i in (0, 6, 7, 8, 18): TOK[i]['b'] = None      # erstes Wort, Mitte von Zeile 2, letztes Wort ohne Takt
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK, "parts": [{"name": "Strophe", "b": 8}]}}, "l": {}}))
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
        await pg.click('#tab-solo'); await pg.wait_for_timeout(400); await pg.click('#sgToggle'); await pg.wait_for_timeout(400)
        w = await pg.evaluate("[...document.querySelectorAll('#sgEdit .sg-warn')].map(x=>x.textContent).join('|')")
        check('Hinweis „5 Wörter ohne Takt“ mit Knopf', '⏱ 5' in w and await pg.is_visible('#sgFill'), w)
        await pg.click('#sgFill'); await pg.wait_for_timeout(300)
        tk = await pg.evaluate("Sing.source(SoloInfo()).tok.map(t=>t.b)")
        check('alle Wörter haben einen Takt, in Textreihenfolge', all(x is not None for x in tk) and all(tk[i] < tk[i + 1] for i in range(len(tk) - 1)), tk)
        check('Lücken zwischen den Nachbarn: „were young and“ zwischen „we“ (14) und „free“ (16)', 14 < tk[6] < tk[7] < tk[8] < 16 and tk[0] < 8.5 and tk[18] > 29, (tk[0], tk[6:9], tk[18]))
        chips = await pg.evaluate("[...document.querySelectorAll('#sgEdit .sg-chip small')].filter(x=>x.textContent==='–').length")
        check('unten keine „–“ mehr, Hinweis weg', chips == 0 and not await pg.is_visible('#sgFill'), chips)
        await pg.click('#sgUndo'); await pg.wait_for_timeout(200)
        check('↶ nimmt es zurück', await pg.evaluate("Sing.source(SoloInfo()).tok.filter(t=>t.b==null).length") == 5)
        await pg.click('#sgRedo'); await pg.wait_for_timeout(200)
        # komplettes Einfügen: zwei neue Zeilen vorn verschieben alles um 9 Plätze – Zeiten bleiben trotzdem
        before = await pg.evaluate("Sing.source(SoloInfo()).tok.map(t=>t.b)")
        txt = "Oh oh oh yeah\nhere we go now\n" + "\n".join(x for x, _ in L)
        await pg.evaluate("document.querySelector('#sgEdit details.sg-paste:last-of-type') && (document.querySelectorAll('#sgEdit details.sg-paste').forEach(d=>d.open=true))")
        await pg.fill('#sgText', txt); await pg.click('#sgTake'); await pg.wait_for_timeout(400)
        r = await pg.evaluate("(()=>{const s=Sing.source(SoloInfo());return {b:s.tok.map(t=>t.b),w:s.tok.map(t=>t.w),parts:(Sing.data().f[s.id]||{}).parts,st:document.getElementById('sgStatus').textContent}})()")
        check('alte Wörter behalten ihren Takt trotz 9 Plätzen Verschiebung', r['b'][8:] == before, (r['b'][8:12], before[:4]))
        check('neue Wörter vorn bekommen einen Takt davor, alles in Reihenfolge', all(x is not None for x in r['b']) and all(r['b'][i] < r['b'][i + 1] for i in range(len(r['b']) - 1)), r['b'][:9])
        check('Teile/Einstellungen der Datei bleiben beim Einfügen erhalten', r['parts'] and r['parts'][0]['name'] == 'Strophe', r['parts'])
        check('Meldung nennt behaltene und neue Wörter', '19 Wörter behalten' in r['st'] and '8 neue' in r['st'], r['st'])
        m = await pg.evaluate("Sing.merge([{w:'Hallo,',b:1,l:0},{w:'Welt',b:2,l:0}],[{w:'x',b:null,l:0},{w:'y',b:null,l:0},{w:'z',b:null,l:0},{w:'q',b:null,l:0},{w:'hallo',b:null,l:1},{w:'Welt!',b:null,l:1}]).map(t=>t.b)")
        check('Zuordnung ohne Groß/klein und Satzzeichen, auch weit verschoben', m == [None, None, None, None, 1, 2], m)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
