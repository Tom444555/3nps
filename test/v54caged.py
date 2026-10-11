# v54: CAGED-Reiter – Formen (Theorie geprüft), Ansichten, Dreiklänge, Lage, Loop folgen, Tabelle, Üben
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
OPEN = [40, 45, 50, 55, 59, 64]; IV = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11]}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('3nps-edfull','0'); localStorage.removeItem('3nps-caged')")
        await pg.goto(U); await pg.wait_for_timeout(600)
        tabs = await pg.eval_on_selector_all('.tab', 'e => e.map(x => x.textContent)')
        check('Reiter CAGED direkt nach Improvisation', tabs[1:3] == ['Improvisation', 'CAGED'], tabs)
        # Theorie: jede Form, jeder Grundton, jede Art – nur Akkordtöne, Grundton dabei, alle 5 Formen vorhanden
        bad = []; missing = []
        for t in IV:
            for r in range(12):
                sh = await pg.evaluate(f"Caged.shapes({r}, '{t}')")
                if sorted(set(x['sh'] for x in sh)) != ['A', 'C', 'D', 'E', 'G']: missing.append((r, t, [x['sh'] for x in sh]))
                for x in sh:
                    pcs = [(OPEN[s] + f) % 12 for s, f in enumerate(x['frets']) if f is not None]
                    want = [(r + i) % 12 for i in IV[t]]
                    if any(q not in want for q in pcs) or r not in pcs or len(set(pcs)) < 3: bad.append((r, t, x['sh'], x['frets']))
        check('Alle Formen enthalten nur Akkordtöne (60 Akkorde)', not bad, bad[:4])
        check('Jeder Akkord hat alle 5 Formen auf dem Griffbrett', not missing, missing[:3])
        tb = []
        for t in IV:
            for r in range(12):
                for s in range(4):
                    tr = await pg.evaluate(f"Caged.triads({r}, '{t}', {s})")
                    if len(tr) < 3: tb.append((r, t, s, len(tr)))
                    for q in tr:
                        pcs = sorted((OPEN[s + i] + f) % 12 for i, f in enumerate(q['frets']))
                        if pcs != sorted((r + i) % 12 for i in IV[t][:3]): tb.append((r, t, s, q['frets']))
        check('Dreiklänge: richtige Töne, je Saitengruppe alle Umkehrungen', not tb, tb[:4])
        await pg.click('#tab-caged'); await pg.wait_for_timeout(400)
        d = await pg.evaluate('Caged.debug()')
        check('Start: C-Dur, alle Formen', d['c'] == {'r': 0, 't': ''} and d['inst'] is None, d['c'])
        await pg.screenshot(path=O + 'cg_alle.png', full_page=True)
        await pg.click('#cgShapes [data-s="A"]'); await pg.wait_for_timeout(200)
        d = await pg.evaluate('Caged.debug()')
        check('A-Form von C: Bund 3', d['inst'] and d['inst']['sh'] == 'A' and d['inst']['lo'] == 3, d['inst'])
        for v in ['arp', 'tri', 'scale']:
            await pg.click(f'#cgViews [data-v="{v}"]'); await pg.wait_for_timeout(200)
            n = await pg.evaluate("document.querySelectorAll('#cgNeck .cg-n').length")
            check(f'Ansicht {v} zeigt Töne', n >= 3, n)
            if v == 'tri':
                nb = await pg.evaluate("document.querySelectorAll('#cgTris button').length")
                check('Dreiklang-Knöpfe in der Form', nb >= 1, nb)
                await pg.screenshot(path=O + 'cg_tri.png', full_page=False)
        await pg.select_option('#cgPos', '5'); await pg.wait_for_timeout(200)
        d = await pg.evaluate('Caged.debug()')
        check('Lage Bund 5: passende Form gewählt', d['inst'] and d['inst']['lo'] <= 8 and d['inst']['hi'] >= 5, d['inst'])
        await pg.select_option('#cgPos', '-1'); await pg.click('#cgViews [data-v="grip"]')
        # Loop laden → folgt den Akkorden
        await pg.click('#tab-looper')
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(3000)
        if await pg.evaluate('!!Looper._ed()'): await pg.click('#edClose')
        if not await pg.evaluate('Looper.running()'): await pg.click('#loopAll')
        await pg.wait_for_timeout(800)
        await pg.click('#tab-caged'); await pg.wait_for_timeout(600)
        d = await pg.evaluate('Caged.debug()')
        check('Folgt dem Loop', d['src'] == 'loop', d['src'])
        check('Loop-Leiste und Tabelle sichtbar', await pg.is_visible('#cgSeq') and await pg.is_visible('#cgTable'))
        rows = await pg.evaluate("document.querySelectorAll('#cgTable tr').length")
        check('Tabelle: je Akkord eine Zeile', rows >= 2, rows)
        await pg.wait_for_timeout(2200)
        d2 = await pg.evaluate('Caged.debug()')
        await pg.screenshot(path=O + 'cg_loop.png', full_page=True)
        check('Akkord wechselt mit dem Loop', d2['c'] != d['c'] or d['next'] is None, (d['c'], d2['c']))
        # Üben
        await pg.click('#cgWalk'); await pg.wait_for_timeout(300)
        i1 = await pg.inner_text('#cgTrainInfo')
        check('Formen-Wanderung läuft', 'Form' in i1, i1)
        await pg.click('#cgWalk'); await pg.click('#cgLadder'); await pg.wait_for_timeout(300)
        check('Dreiklang-Leiter läuft', 'Bünde' in await pg.inner_text('#cgTrainInfo'))
        await pg.click('#cgLadder')
        await pg.click('#cgFollow'); await pg.wait_for_timeout(300)
        d = await pg.evaluate('Caged.debug()')
        check('„folgt dem Loop“ aus: eigener Akkord', d['src'] == 'manual')
        check('Einstellungen gespeichert', await pg.evaluate("JSON.parse(localStorage.getItem('3nps-caged')).follow") == False)
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.click('#tab-caged'); await pg.wait_for_timeout(400)
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        check('Schmal: keine Seitenbreite über den Bildschirm', sw <= 392, sw)
        await pg.screenshot(path=O + 'cg_schmal.png', full_page=True)
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
