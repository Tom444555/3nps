# v99: Drummer (Art Logic) – Hauptansicht/Details/Manuell, Stufen, Komplexität, Becken/Kick-Snare-Schalter, Snare-Spielweisen,
# Tempo, Ghost Notes, Fills, Percussion, Manuell → Drummer übernimmt wieder; drei echte Kits (Jazz, Rock, Besen) + Synthese
import asyncio, re, json
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
cnt = lambda row: sum(1 for v in row if v)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(1000)
        check('Version ≥ v99', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 99)
        await pg.select_option('#loopDrumStyle', 'rock'); await pg.click('#drumEditBtn'); await pg.wait_for_timeout(200)
        D = lambda: pg.evaluate('Rhythm.drummer()')
        d0 = await D()
        check('Hauptansicht sichtbar, Stil „Rock“, Stufen auf Vorlage (4)', await pg.is_visible('.dr-main') and 'Rock' in await pg.inner_text('#drStyle') and d0['dr']['lvC'] == 4 and d0['dr']['lvK'] == 4, d0['dr'])
        await pg.click('#drLvK .dr-lvb[data-l="8"]'); d8 = await D()
        await pg.click('#drLvK .dr-lvb[data-l="1"]'); d1 = await D()
        check('Kick/Snare-Stufe 8 dichter als Stufe 1', cnt(d8['pat']['kick']) > cnt(d1['pat']['kick']) + 2, (cnt(d1['pat']['kick']), cnt(d8['pat']['kick'])))
        await pg.click('#drLvC .dr-lvb[data-l="6"]'); d6 = await D()
        check('Becken-Stufe 6 = Sechzehntel auf der Hi-Hat', cnt(d6['pat']['hhc']) == 16, cnt(d6['pat']['hhc']))
        await pg.focus('#drCx')
        for _ in range(10): await pg.keyboard.press('ArrowUp')
        dc = await D(); check('Komplexität hoch → beide Stufen hoch', dc['dr']['cx'] >= 90 and dc['dr']['lvC'] >= 7 and dc['dr']['lvK'] >= 7, dc['dr'])
        await pg.click('.dr-ic[data-ic="ride"]'); dr_ = await D()
        check('Becken: Ride statt Hi-Hat', cnt(dr_['pat']['ride']) > 4 and cnt(dr_['pat']['hhc']) == 0)
        await pg.click('.dr-ic[data-ic="hh"]'); await pg.click('.dr-ic[data-ic="kick"]'); dk = await D()
        check('Kick aus', cnt(dk['pat']['kick']) == 0 and not dk['dr']['kick']); await pg.click('.dr-ic[data-ic="kick"]')
        await pg.click('.dr-tabs [data-v="det"]'); check('Details-Ansicht', await pg.is_visible('.dr-det') and not await pg.is_visible('.dr-main'))
        await pg.select_option('#drSn', 'rimshot'); ds = await D(); check('Snare: Rimshot auf den Backbeats', cnt(ds['pat']['snrim']) >= 2)
        await pg.select_option('#drSn', 'cross'); ds = await D(); check('Snare: Seitenschlag (Rim) statt Snare', cnt(ds['pat']['rim']) >= 2 and not any(v in (1, 2) for v in ds['pat']['snare']))
        await pg.select_option('#drSn', 'center'); await pg.select_option('#drTp', 'half'); dh = await D()
        acc = [k for k, v in enumerate(dh['pat']['snare']) if v in (1, 2)]
        check('Tempo halb: Backbeat nur auf der 3', acc == [8], acc)
        await pg.select_option('#drTp', 'std')
        await pg.focus('.dr-knob[data-k="ghost"]')
        for _ in range(16): await pg.keyboard.press('ArrowUp')
        dg = await D(); check('Ghost Notes hoch → mehr leise Schläge', dg['pat']['snare'].count(3) >= 4, dg['pat']['snare'])
        await pg.select_option('#drPc', 'cowbell'); dp = await D(); check('Percussion: Kuhglocke an', dp['dr']['perc'] and cnt(dp['pat']['cowbell']) >= 4)
        await pg.focus('.dr-knob[data-k="feel"]'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown')
        df = await D(); check('Feel nach „Pull“', df['dr']['feel'] < 0, df['dr']['feel'])
        await pg.click('.dr-tabs [data-v="main"]')
        await pg.focus('.dr-knob[data-k="fill"]')
        for _ in range(20): await pg.keyboard.press('ArrowUp')
        dfl = await D(); check('Fill-Stärke max → Fill alle 2 Takte', dfl['fills'] == '2', dfl['fills'])
        await pg.click('.dr-swu [data-u="8"]'); check('Swing-Raster 1/8', (await D())['dr']['swu'] == 8)
        k1 = (await D())['pat']['kick']; await pg.click('#drRegen'); k2 = (await D())['pat']['kick']
        check('„Neu würfeln“ ändert die Kick-Variante', k1 != k2)
        # Manuell
        await pg.click('.dr-tabs [data-v="man"]'); await pg.click('.dg-cell[data-i="clap"][data-k="5"]')
        dm = await D(); check('Manuell bearbeitet: Hinweis, Muster bleibt', dm['dr']['manual'] and 'Hand' in await pg.inner_text('#drHint') and dm['pat']['clap'][5] == 1)
        await pg.click('.dr-tabs [data-v="main"]'); await pg.click('#drLvC .dr-lvb[data-l="3"]')
        dm2 = await D(); check('Drummer-Regler übernimmt wieder (Grundlage = bearbeitetes Muster)', not dm2['dr']['manual'] and dm2['pat']['clap'][5] == 1 and await pg.inner_text('#drHint') == '')
        # Stilwechsel setzt Stufen zurück, bleibt nach Neustart
        await pg.select_option('#loopDrumStyle', 'funk'); dfn = await D()
        check('Stilwechsel: Stufen zurück auf Vorlage', dfn['dr']['lvC'] == 4 and dfn['dr']['lvK'] == 4 and dfn['pat']['snare'].count(3) >= 1)
        await pg.click('#drLvK .dr-lvb[data-l="6"]'); before = (await D())['pat']
        await pg.reload(); await pg.wait_for_timeout(1200); after = (await D())['pat']
        check('Drummer-Einstellungen und Muster bleiben nach Neustart', before == after)
        # Wiedergabe mit allen Kits
        for kit in ['jazz', 'rock', 'brush', 'synth']:
            await pg.select_option('#drumKitSel', kit)
            for _ in range(60):
                await pg.wait_for_timeout(200)
                if await pg.evaluate("Rhythm.kitName()") == kit: break
            if not await pg.evaluate("Rhythm.debug().on"): await pg.click('#loopDrums')
            await pg.wait_for_timeout(1500); d = await pg.evaluate("Rhythm.debug()")
            check('Kit „%s“ geladen und spielt (keine verspäteten Schläge)' % kit, await pg.evaluate("Rhythm.kitName()") == kit and d['on'] and d['late'] == 0, d['late'])
        await pg.click('#loopDrums')
        # Session-Zustand enthält den Drummer
        st = await pg.evaluate("Rhythm.getState()"); check('Zustand (Ideen) enthält Drummer + neuen EQ', 'dr' in st and 'eq2' in st and isinstance(st['eq'], list))
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
