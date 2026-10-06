# v27: „Was passt“ oben in der Looper-Karte (volle Breite), Beschreibung, Anhalten + Akkordwahl
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
BOX = "(() => { const b = document.getElementById('passtBox'), r = b.getBoundingClientRect(), tr = document.querySelector('.tracks').getBoundingClientRect(), lt = document.querySelector('.looper-top').getBoundingClientRect(), h = document.querySelector('.looper-card .card-head').getBoundingClientRect(); return { hidden: b.hidden, open: !b.classList.contains('zu'), held: b.classList.contains('held'), rec: b.classList.contains('rec'), full: Math.abs(r.width - tr.width) <= 2, between: r.top >= h.bottom - 1 && r.bottom <= lt.top + 1, chord: document.getElementById('passtCh').textContent, chFont: parseFloat(getComputedStyle(document.getElementById('passtCh')).fontSize), sc: document.getElementById('passtSc').textContent, desc: document.getElementById('passtDesc').textContent, mv: document.getElementById('passtMv').textContent, h: Math.round(r.height) }; })()"
async def loadloop(pg):
    await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if await pg.evaluate("!!Looper._chords(0)"): break
    if not await pg.evaluate("Looper.debug().tracks[0].state === 'playing'"): await pg.click('#loopAll')
    await pg.wait_for_timeout(600)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        check('Ohne Loop: keine Box', (await pg.evaluate(BOX))['hidden'])
        await loadloop(pg)
        b1 = await pg.evaluate(BOX)
        check('Loop läuft: Box oben, volle Breite, zwischen Titel und Loop-Länge', not b1['hidden'] and b1['full'] and b1['between'], b1)
        check('Akkord groß (≥ 40 px)', b1['chFont'] >= 40, b1['chFont'])
        check('Beschreibung, Pentatonik, nächster Wechsel', len(b1['desc']) > 40 and 'Pentatonik' in b1['mv'] and 'Zielton' in b1['mv'], b1['mv'][:80])
        ok = 0; seen = set()
        for k in range(36):
            await pg.wait_for_timeout(250)
            a = await pg.evaluate("[document.getElementById('passtCh').textContent, document.querySelector('#chd0 b')?.textContent, document.getElementById('passtSc').textContent]")
            if a[0] and a[0] == a[1]: ok += 1; seen.add(a[0] + ':' + a[2])
            if k == 6: await pg.screenshot(path=O + 'v27_passt.png', clip={'x': 0, 'y': 150, 'width': 1024, 'height': 820})
        check('Wechselt mit dem klingenden Akkord', ok >= 32 and seen >= {'C:C Ionisch', 'G:G Mixolydisch', 'Am:A Äolisch', 'F:F Lydisch'}, f'{ok}/36 · {sorted(seen)}')
        # Anhalten
        await pg.click('#passtHold'); c0 = await pg.inner_text('#passtCh'); await pg.wait_for_timeout(3500)
        b2 = await pg.evaluate(BOX)
        check('Anhalten: Anzeige bleibt stehen, Akkordwahl sichtbar', b2['held'] and b2['chord'] == c0 and await pg.is_visible('#passtPick'), f'{c0} → {b2["chord"]}')
        await pg.click('#passtPick [data-i]:has-text("F")'); await pg.wait_for_timeout(300)
        check('Angehalten: Akkord F gewählt → F Lydisch', (await pg.evaluate(BOX))['sc'] == 'F Lydisch')
        await pg.click('#loopAll'); await pg.wait_for_timeout(800)
        check('Angehalten bleibt die Box auch bei gestopptem Loop', not (await pg.evaluate(BOX))['hidden'])
        await pg.screenshot(path=O + 'v27_held.png', clip={'x': 0, 'y': 150, 'width': 1024, 'height': 820})
        await pg.click('#passtHold'); await pg.wait_for_timeout(400)
        b4 = await pg.evaluate(BOX)
        check('Weiter mitlaufen bei gestopptem Loop: Box bleibt (abgedunkelt, „Gestoppt“), Seite springt nicht', not b4['hidden'] and await pg.evaluate("document.getElementById('passtCap').textContent") == 'Gestoppt')
        await pg.click('#loopAll'); await pg.wait_for_timeout(600)
        await pg.click('#foot2'); await pg.wait_for_timeout(1500)
        check('Beim Aufnehmen rot umrandet', (await pg.evaluate(BOX))['rec'])
        await pg.click('#foot2'); await pg.wait_for_timeout(1500)
        await pg.click('#passtHead'); await pg.wait_for_timeout(200)
        b3 = await pg.evaluate(BOX)
        check('Zuklappen: eine Zeile mit Akkord und Tonleiter', not b3['open'] and b3['h'] <= 56, b3['h'])
        await pg.click('#passtHead')
        await pg.click('#passtGo'); await pg.wait_for_timeout(300)
        check('„Improvisation ›“ öffnet die Improvisation', not await pg.evaluate("document.getElementById('panel-solo').hidden"))
        await pg.click('#tab-looper')
        for c in range(3):
            if await pg.evaluate(f"Looper.debug().tracks[{c}].state") != 'empty': await pg.click(f'#clear{c}'); await pg.wait_for_timeout(200); await pg.click(f'#clear{c}'); await pg.wait_for_timeout(200)
        await pg.wait_for_timeout(500)
        check('Alle Spuren gelöscht: Box weg', (await pg.evaluate(BOX))['hidden'])
        await loadloop(pg)
        for w_, h_ in ((768, 1024), (1366, 1024), (390, 844)):
            await pg.set_viewport_size({'width': w_, 'height': h_}); await pg.wait_for_timeout(500)
            r = await pg.evaluate(BOX); sw = await pg.evaluate("document.documentElement.scrollWidth")
            check(f'{w_} px: volle Breite, kein seitliches Scrollen', r['full'] and sw <= w_, f'Höhe {r["h"]} px')
            await pg.screenshot(path=O + f'v27_{w_}.png', clip={'x': 0, 'y': 150, 'width': w_, 'height': min(900, h_ - 150)})
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
