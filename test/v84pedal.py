# v84: Fußpedal beim Bearbeiten (1 Schleife, 2/3 Wort zurück/vor, 4 ▶/■, Einklopfen = jedes Pedal ein Tipp), „⋯ Mehr“
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("Hold", 8, 0), ("on", 8.5, 0), ("to", 9, 0), ("the", 9.5, 0), ("nite", 10, 0), ("we", 13, 1), ("were", 13.5, 1), ("young", 14, 1), ("and", 15, 1), ("free", 15.5, 1)]]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
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
        await pg.click('#sgStrip .sg-w[data-i="0"]'); await pg.wait_for_timeout(300)
        tracks0 = await pg.evaluate("Looper.debug().tracks.map(t=>t.state).join()")
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(200)       # Pedal 3: Wort vor
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(200)
        s1 = await pg.evaluate("Sing.prec()")
        check('Pedal 3 (→ Wort vor): zwei Wörter weiter, Wort wird gespielt, Looper-Spuren unberührt', s1['sel'] == 2 and s1['word'] and await pg.evaluate("Looper.debug().tracks.map(t=>t.state).join()") == tracks0, (s1, tracks0))
        await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(200)       # Pedal 2: Wort zurück
        check('Pedal 2 (Wort zurück)', await pg.evaluate("Sing.prec().sel") == 1)
        # über die Taktgrenze: Takt folgt
        k0 = await pg.evaluate("SoloFocus.get()")
        for _ in range(4): await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(150)
        check('über die Taktgrenze hinweg folgt die Ansicht', await pg.evaluate("Sing.prec().sel") == 5 and await pg.evaluate("SoloFocus.get()") != k0)
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(400)          # Pedal 1: Schleife
        check('Pedal 1: Schleife an', await pg.evaluate("Sing.prec().loop"))
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(200)
        check('Pedal 1: Schleife aus', not await pg.evaluate("Sing.prec().loop"))
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(400)       # Pedal 4: ▶ ab hier
        r = await pg.evaluate("[Looper.running(), Sing.prec().word]")
        check('Pedal 4: ▶ ab hier', r[0] or r[1], r)
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(300)
        check('Pedal 4 nochmal: ■', not await pg.evaluate("Looper.running()") and not await pg.evaluate("Sing.prec().word"))
        # Einklopfen: jedes Pedal = genau ein Tipp
        await pg.click('#sgFTapStart'); await pg.wait_for_timeout(1500)
        n0 = await pg.evaluate("Sing.prec().tap.n")
        await pg.keyboard.press(' '); await pg.wait_for_timeout(250); await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(250)
        t = await pg.evaluate("Sing.prec().tap")
        check('beim Einklopfen: Leertaste und Pedal 1 je ein Tipp', t and t['n'] == n0 + 2, (n0, t))
        await pg.click('#sgFStop'); await pg.wait_for_timeout(200)
        # ohne Bearbeitungs-Zoom steuert das Pedal wieder den Looper
        await pg.click('#sgFDone'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(500)
        check('ohne Zoom: Pedal 4 = Looper „Alle starten“', await pg.evaluate("Looper.running()"))
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(300)
        # Mehr
        await pg.click('#sgStrip .sg-w[data-i="0"]'); await pg.wait_for_timeout(300)
        v1 = await pg.is_visible('#sgFLock'); await pg.click('#sgFMore'); await pg.wait_for_timeout(150); v2 = await pg.is_visible('#sgFLock')
        check('„⋯ Mehr“ blendet Vorlage/Teile/Raster ein und aus', v1 != v2 and await pg.is_visible('#sgFNudgeL'), (v1, v2))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
