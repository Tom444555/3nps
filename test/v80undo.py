# v80: Rückgängig/Wiederholen für alle Textänderungen (Ziehen, Tauschen, Löschen), Tastatur ⌘Z; Versionen bei „Lieder mit Text“
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("Hold", 8, 0), ("on", 8.5, 0), ("to", 9, 0), ("the", 9.5, 0), ("nite", 10, 0), ("we", 13, 1), ("were", 13.5, 1), ("young", 14, 1), ("and", 15, 1), ("free", 15.5, 1)]]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
TK = "Object.values(JSON.parse(localStorage.getItem('3nps-sing')).f)[0].tok"
W = lambda t: [(x['w'], x['b']) for x in t]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(700)
        t0 = await pg.evaluate(TK)
        await pg.click('#sgStrip .sg-w[data-i="2"]'); await pg.wait_for_timeout(300)
        check('Fokusleiste: ↶ ↷ da, noch nichts rückgängig zu machen', await pg.is_visible('#sgFUndoE') and await pg.evaluate("document.getElementById('sgFUndoE').disabled"))
        # 1) Feinschritt, 2) Ziehen, 3) Wort löschen
        await pg.click('#sgFNudgeR'); await pg.wait_for_timeout(200); t1 = await pg.evaluate(TK)
        bx = await pg.evaluate("(()=>{const r=document.querySelector('#sgStrip .sg-w[data-i=\"3\"]').getBoundingClientRect();return [r.x+6,r.y+10]})()")
        await pg.mouse.move(*bx); await pg.mouse.down(); await pg.mouse.move(bx[0] + 40, bx[1], steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300); t2 = await pg.evaluate(TK)
        await pg.click('#sgStrip .sg-w[data-i="1"]'); await pg.wait_for_timeout(200); await pg.click('#sgStrip .sg-w[data-i="1"]'); await pg.wait_for_timeout(200)
        await pg.dispatch_event('#sgStrip .sg-inline .sg-del', 'pointerdown'); await pg.wait_for_timeout(300); t3 = await pg.evaluate(TK)
        check('drei Änderungen gemacht', W(t1) != W(t0) and W(t2) != W(t1) and len(t3) == len(t2) - 1)
        await pg.click('#sgFUndoE'); await pg.wait_for_timeout(250); u1 = await pg.evaluate(TK)
        await pg.click('#sgFUndoE'); await pg.wait_for_timeout(250); u2 = await pg.evaluate(TK)
        await pg.click('#sgFUndoE'); await pg.wait_for_timeout(250); u3 = await pg.evaluate(TK)
        check('↶ dreimal: Schritt für Schritt zurück bis zum Anfang', W(u1) == W(t2) and W(u2) == W(t1) and W(u3) == W(t0), (len(u1), len(u2)))
        await pg.click('#sgFRedoE'); await pg.wait_for_timeout(250); r1 = await pg.evaluate(TK)
        check('↷ stellt wieder her', W(r1) == W(t1))
        # Tastatur
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(250)
        check('⌘Z / Strg+Z macht rückgängig', W(await pg.evaluate(TK)) == W(t0))
        await pg.keyboard.press('Control+Shift+z'); await pg.wait_for_timeout(250)
        check('⇧⌘Z wiederholt', W(await pg.evaluate(TK)) == W(t1))
        # Editor-Karte: Tauschen und rückgängig
        await pg.click('#sgFDone'); await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        await pg.click('#sgEdit .sg-chip[data-i="6"]'); await pg.click('#sgSwapR'); await pg.wait_for_timeout(250); s1 = await pg.evaluate(TK)
        await pg.click('#sgUndo'); await pg.wait_for_timeout(250)
        check('Gesangstext-Karte: Tauschen rückgängig', W(await pg.evaluate(TK)) == W(t1) and W(s1) != W(t1))
        await pg.click('#sgToggle')
        # Versionen: speichern, ändern, wieder speichern → 1 Version, zurückholen
        await pg.click('#sgSave'); await pg.wait_for_timeout(800)
        await pg.click('#sgStrip .sg-w[data-i="0"]'); await pg.wait_for_timeout(300); await pg.click('#sgFNudgeR'); await pg.click('#sgFNudgeR'); await pg.wait_for_timeout(300)
        v1 = await pg.evaluate(TK)
        await pg.click('#sgSave'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        if not await pg.evaluate("document.getElementById('lsFold').open"): await pg.click('#lsFold summary')
        await pg.wait_for_timeout(300)
        check('Liste zeigt „Versionen (1)“', 'Versionen (1)' in await pg.inner_text('#lsList'), await pg.inner_text('#lsList'))
        await pg.click('#lsList [data-act="vers"]'); await pg.wait_for_timeout(300); await pg.click('#lsList [data-act="restore"]'); await pg.wait_for_timeout(500)
        check('Version zurückgeholt (Text vor dem 2. Speichern), jetziger Stand als Version behalten', W(await pg.evaluate(TK)) == W(t1) and 'Versionen (2)' in await pg.inner_text('#lsList'), (W(await pg.evaluate(TK))[:2], W(v1)[:2]))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
