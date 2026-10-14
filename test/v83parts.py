# v83: Akkord von Hand ändern (Halten in der Akkordleiste), Teile markieren (Spur, Karte, Leadsheet), Teil-Schleife mit Tempo-Trainer
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
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []; answer = {'v': 'Bb'}
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept(answer['v']) if d.type == 'prompt' else d.accept()))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(700)
        # 1) Akkord halten → ändern
        n0 = await pg.evaluate("SoloInfo().segs[1].name")
        bx = await pg.evaluate("(()=>{const r=document.querySelector('#sfStrip .sf-seg[data-i=\"1\"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await pg.mouse.move(*bx); await pg.mouse.down(); await pg.wait_for_timeout(800); await pg.mouse.up(); await pg.wait_for_timeout(400)
        s1 = await pg.evaluate("[SoloInfo().segs[1].name, SoloInfo().segs[1].fixed, document.querySelector('#sfStrip .sf-seg[data-i=\"1\"]').classList.contains('fixed'), Looper.chordInfo(0).segs[1].name]")
        check('Akkord gehalten → „Bb“ eingetragen: überall A#, markiert', s1[0] == 'A#' and s1[1] and s1[2] and s1[3] == 'A#', (n0, s1))
        answer['v'] = 'Xy7q'; await pg.mouse.move(*bx); await pg.mouse.down(); await pg.wait_for_timeout(800); await pg.mouse.up(); await pg.wait_for_timeout(300)
        check('unbekannter Akkord wird abgelehnt', await pg.evaluate("SoloInfo().segs[1].name") == 'A#')
        answer['v'] = ''; await pg.mouse.move(*bx); await pg.mouse.down(); await pg.wait_for_timeout(800); await pg.mouse.up(); await pg.wait_for_timeout(400)
        check('leer = wieder erkannt', await pg.evaluate("[SoloInfo().segs[1].name, !!SoloInfo().segs[1].fixed]") == [n0, False])
        # 2) Teile: Takt 3 Refrain, Takt 4 Bridge
        await pg.evaluate("Sing.focus(2)"); await pg.wait_for_timeout(300)
        await pg.select_option('#sgFPartSel', 'Refrain'); await pg.click('#sgFPartAdd'); await pg.wait_for_timeout(200)
        await pg.click('#sgFNext'); await pg.wait_for_timeout(300); await pg.select_option('#sgFPartSel', 'Bridge'); await pg.click('#sgFPartAdd'); await pg.wait_for_timeout(300)
        ps = await pg.evaluate("Sing.parts()"); marks = await pg.evaluate("[...document.querySelectorAll('#sgStrip .sg-part')].map(x=>x.textContent)")
        check('zwei Teile gesetzt, Marken in der Spur', [x['name'] for x in ps] == ['Refrain', 'Bridge'] and marks == ['Refrain', 'Bridge'], (ps, marks))
        await pg.click('#sgFDone'); await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        check('Karte: Teile-Liste mit ▶ und ⟲', await pg.evaluate("document.querySelectorAll('#sgEdit .sg-pitem').length") == 2)
        ls = await pg.evaluate("Sing.leadsheet()")
        check('Leadsheet: Abschnitte nach den Teilen', [s['head'] for s in ls['sections']][:2] == ['Refrain', 'Bridge'], [s['head'] for s in ls['sections']])
        # 3) Teil-Schleife mit Trainer ab 80 %
        await pg.check('#sgTrainer'); await pg.select_option('#sgTrStart', '0.8'); await pg.wait_for_timeout(100)
        await pg.click('#sgEdit [data-ploop="0"]'); await pg.wait_for_timeout(400)
        r0 = await pg.evaluate("[Sing.loopRate(), Looper.running(), Sing.loopNow()]"); rng = await pg.evaluate("Sing.parts().map(p=>p.b)")
        check('Teil-Schleife läuft mit 80 %, im Teil', r0[0] == 0.8 and not r0[1] and rng[0] - 0.01 <= r0[2] <= rng[1] + 0.01, (r0, rng))
        for _ in range(60):
            await pg.wait_for_timeout(300)
            if (await pg.evaluate("Sing.loopRate()") or 0) > 0.8: break
        st = await pg.evaluate("[Sing.loopRate(), Sing.trainerState()]")
        check('nach 2 Durchgängen 85 %', st[0] == 0.85 and st[1] and st[1]['pass'] >= 2, st)
        await pg.click('#sgPStop'); await pg.wait_for_timeout(200)
        check('■ beendet die Teil-Schleife', await pg.evaluate("Sing.loopRate()") is None)
        # Teil-Marke entfernen
        await pg.click('#sgToggle'); await pg.evaluate("Sing.focus(3)"); await pg.wait_for_timeout(300)
        await pg.click('#sgStrip .sg-part'); await pg.wait_for_timeout(300)
        check('Marke antippen → entfernen', len(await pg.evaluate("Sing.parts()")) == 1)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
