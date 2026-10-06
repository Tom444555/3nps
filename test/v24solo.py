# v24: Solo Finder – Akkordleiste, klingender Akkord, Tonart, mögliche Akkorde, Tonleitern, Griffbild, Wechsel, Ideen
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t => t.textContent)")
        check('Reiter: Looper · Quintenzirkel · Solo Finder · Jam · Üben · Griffbrett', tabs == ['Looper', 'Quintenzirkel', 'Improvisation', 'Backing Track', 'Songwriting', 'Training', 'Technik'], tabs)
        # ohne Loop: Hinweis, Tonart vom Griffbrett, trotzdem bedienbar
        await pg.click('#tab-solo'); await pg.wait_for_timeout(400)
        e0 = await pg.inner_text('#sfStrip'); k0 = await pg.inner_text('#sfKeySrc')
        check('Ohne Loop: Hinweis und Tonart vom Griffbrett', 'Noch keine Akkorde' in e0 and 'Griffbrett' in k0, k0)
        await pg.screenshot(path=O + 'v24_leer.png')
        # Theorie-Stichproben
        s = await pg.evaluate("SoloFinder.suggestions(2, 'm7', 0, true).map(x => x.id + ':' + x.root + ':' + x.tag)")
        check('Dm7 in C-Dur → D Dorisch zuerst', s[0] == 'dor:2:Passt genau', s)
        s = await pg.evaluate("SoloFinder.suggestions(4, '7', 9, false).map(x => x.id + ':' + x.root)")
        check('E7 in A-Moll → Phrygisch-Dominant / Harmonisch Moll', s[0] in ('pd:4',) and 'hm:9' in s, s)
        s = await pg.evaluate("SoloFinder.suggestions(5, '', 0, true).map(x => x.id + ':' + x.root)")
        check('F in C-Dur → F Lydisch', s[0] == 'lyd:5', s)
        s = await pg.evaluate("SoloFinder.suggestions(10, '', 0, true).map(x => x.id + ':' + x.root + ':' + x.tag)")
        check('B♭ in C-Dur (Fremdakkord) → Lydisch/Mixolydisch mit Hinweis', s[0].split(':')[2] == 'Beste Wahl', s)
        r = await pg.evaluate("[SoloFinder.roman(7,'7',0,true), SoloFinder.roman(9,'m',0,true), SoloFinder.roman(10,'',0,true), SoloFinder.roman(11,'dim',0,true), SoloFinder.roman(5,'',9,false), SoloFinder.roman(8,'dim',9,false), SoloFinder.roman(1,'',0,true)]")
        check('Stufen: G7=V7, Am=vi, B♭=♭VII, B°=vii°, F in Am=VI, G♯° in Am=♯vii°, D♭ in C=♭II', r == ['V7', 'vi', '♭VII', 'vii°', 'VI', '♯vii°', '♭II'], r)
        # Loop laden und spielen
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if await pg.evaluate("!!Looper._chords(0)"): break
        await pg.wait_for_timeout(500)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(500)
        if not await pg.evaluate("Looper.debug().tracks[0].state === 'playing'"):
            await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(200); await pg.click('#tab-solo')
        segs = await pg.evaluate("[...document.querySelectorAll('#sfStrip .sf-seg b')].map(b => b.textContent)")
        check('Leiste zeigt die Akkordfolge', segs == ['C', 'G', 'Am', 'F'], segs)
        rom = await pg.evaluate("[...document.querySelectorAll('#sfStrip .sf-seg small')].map(b => b.textContent)")
        check('… mit Stufen', rom == ['I', 'V', 'vi', 'IV'], rom)
        check('Tonart C-Dur aus Spur 1', await pg.inner_text('#sfKey') == 'C-Dur' and 'Spur 1' in await pg.inner_text('#sfKeySrc'))
        ok = 0; seen = set()
        for k in range(36):
            await pg.wait_for_timeout(250)
            a = await pg.evaluate("[document.querySelector('#sfStrip .sf-seg.on b')?.textContent, (Looper.nowChord()||{}).name, document.querySelector('#sfNow b')?.textContent, document.querySelector('.sf-ch.cur b')?.textContent, document.getElementById('sfScaleTitle').textContent]")
            if a[0] and a[0] == a[1] == a[2] and a[4].endswith(a[0]): ok += 1; seen.add(a[0])
            if k == 10: await pg.screenshot(path=O + 'v24_solo.png', full_page=True)
        check('Klingender Akkord eingerahmt, Fokus und Tonleitern folgen', ok >= 30 and len(seen) == 4, f'{ok}/36 · {sorted(seen)}')
        await pg.set_viewport_size({'width': 1366, 'height': 1024}); await pg.wait_for_timeout(500)
        check('Nach Drehen bleibt der klingende Akkord eingerahmt', await pg.evaluate("!!document.querySelector('#sfStrip .sf-seg.on')"))
        await pg.set_viewport_size({'width': 1024, 'height': 1366}); await pg.wait_for_timeout(300)
        ph = await pg.evaluate("getComputedStyle(document.getElementById('sfPh')).transform")
        check('Positionsstrich läuft', ph not in ('none', ''), ph)
        n = await pg.evaluate("document.querySelectorAll('.sf-sc').length"); nk = await pg.evaluate("document.querySelectorAll('#sfNeck .nk-n').length")
        check('Tonleiter-Karten und Griffbild', n >= 4 and nk > 40, f'{n} Karten · {nk} Töne im Griffbild')
        mv = await pg.inner_text('#sfMove')
        check('Nächster Wechsel mit gemeinsamen Tönen und Zielton', 'Gemeinsame Töne' in mv and 'Zielton' in mv, mv[:90])
        # Folgen aus, Akkord antippen → bleibt stehen
        await pg.click('#sfFollow'); await pg.click('.sf-ch:has-text(\"Dm\")'); await pg.wait_for_timeout(500)
        f1 = await pg.evaluate("[document.querySelector('#sfNow b').textContent, document.getElementById('sfScales').querySelector('.sf-sc b').textContent]")
        check('Ohne Folgen: angetippter Akkord bleibt (Dm → D Dorisch)', f1 == ['Dm', 'D Dorisch'], f1)
        await pg.click('.sf-sc:nth-child(2)'); await pg.wait_for_timeout(200)
        check('Tonleiter antippen → Griffbild wechselt', 'Pentatonik' in await pg.inner_text('#sfNeckTitle'), await pg.inner_text('#sfNeckTitle'))
        await pg.click('.sf-sc:nth-child(1) .sf-apply'); await pg.wait_for_timeout(300)
        check('„Ins Griffbrett“ setzt D Dorisch', await pg.evaluate("[rootSel.value, modeSel.value]") == ['D', 'Dorisch'])
        i1 = await pg.inner_text('#sfIdea'); await pg.click('#sfDice'); i2 = await pg.inner_text('#sfIdea')
        check('Ideen-Würfel liefert neue Idee', i1 and i2 and i1 != i2, i2[:60])
        await pg.select_option('#sfKeySel', '9:m'); await pg.wait_for_timeout(300)
        check('Tonart manuell festlegen (A-Moll)', await pg.inner_text('#sfKey') == 'A-Moll' and await pg.evaluate("[...document.querySelectorAll('#sfStrip .sf-seg small')].map(b => b.textContent)") == ['III', 'VII', 'i', 'VI'])
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(400)
        ow = await pg.evaluate("document.documentElement.scrollWidth")
        check('Schmal: kein seitliches Scrollen der Seite', ow <= 390, ow)
        await pg.screenshot(path=O + 'v24_schmal.png', full_page=True)
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
