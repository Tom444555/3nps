# v26: Reiternamen, „Was passt“-Box im Looper (unter der aufnehmenden Spur, zuklappbar)
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
BOX = "(() => { const b = document.getElementById('passtBox'), r = b.getBoundingClientRect(), cols = [...document.querySelectorAll('.tracks .track')].map(t => t.getBoundingClientRect()); const under = cols.findIndex(c => Math.abs(c.left - r.left) < 2 && r.top >= c.bottom - 1); return { hidden: b.hidden, open: !b.classList.contains('zu'), under, rec: b.classList.contains('rec'), chord: document.getElementById('passtCh').textContent, sc: document.getElementById('passtSc').textContent, notes: document.getElementById('passtNotes').textContent, x: document.getElementById('passtX').textContent, h: Math.round(r.height) }; })()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t => t.textContent)")
        check('Neue Reiternamen', tabs == ['Looper', 'Quintenzirkel', 'Improvisation', 'Backing Track', 'Training', 'Technik'], tabs)
        b0 = await pg.evaluate(BOX)
        check('Ohne Loop: keine Box', b0['hidden'])
        await pg.select_option('#loopCountIn', '0')
        await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if await pg.evaluate("!!Looper._chords(0)"): break
        if not await pg.evaluate("Looper.debug().tracks[0].state === 'playing'"): await pg.click('#loopAll')
        await pg.wait_for_timeout(600)
        b1 = await pg.evaluate(BOX)
        check('Loop läuft: Box unter der nächsten freien Spur (Spur 2)', not b1['hidden'] and b1['under'] == 1, b1)
        ok = 0; seen = set()
        for k in range(36):
            await pg.wait_for_timeout(250)
            a = await pg.evaluate("[document.getElementById('passtCh').textContent, document.querySelector('#chd0 b')?.textContent, document.getElementById('passtSc').textContent]")
            if a[0] and a[0] == a[1]: ok += 1; seen.add(a[0] + ':' + a[2])
            if k == 6: await pg.screenshot(path=O + 'v26_passt.png', clip={'x': 0, 'y': 150, 'width': 1024, 'height': 760})
        check('Box wechselt mit dem klingenden Akkord, passende Tonleiter', ok >= 32 and seen >= {'C:C Ionisch', 'G:G Mixolydisch', 'Am:A Äolisch', 'F:F Lydisch'}, f'{ok}/36 · {sorted(seen)}')
        check('Inhalt: Töne, Pentatonik, Zielton des nächsten Akkords', 'Pentatonik' in b1['x'] and 'Ziel' in b1['x'] and len(b1['notes']) >= 7, b1)
        # Aufnahme auf Spur 3 → Box springt unter Spur 3
        await pg.click('#foot2'); await pg.wait_for_timeout(1500)
        b2 = await pg.evaluate(BOX)
        check('Aufnahme auf Spur 3: Box steht unter Spur 3, rot markiert', b2['under'] == 2 and b2['rec'], b2)
        await pg.screenshot(path=O + 'v26_passt_rec.png', clip={'x': 0, 'y': 150, 'width': 1024, 'height': 760})
        await pg.click('#foot2'); await pg.wait_for_timeout(1500)
        # zuklappen
        await pg.click('#passtHead .passt-sc'); await pg.wait_for_timeout(200)
        b3 = await pg.evaluate(BOX)
        check('Zuklappen: nur eine Zeile', not b3['open'] and b3['h'] <= 40, b3)
        await pg.reload(); await pg.wait_for_timeout(900)
        check('Zugeklappt bleibt gespeichert', await pg.evaluate("document.getElementById('passtBox').classList.contains('zu')"))
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if await pg.evaluate("!!Looper._chords(0) && !document.getElementById('passtBox').hidden"): break
        await pg.click('#passtHead .passt-sc')
        check('Aufklappen', not await pg.evaluate("document.getElementById('passtBox').classList.contains('zu')"))
        await pg.click('#passtGo'); await pg.wait_for_timeout(300)
        check('„›“ öffnet die Improvisation', not await pg.evaluate("document.getElementById('panel-solo').hidden"))
        await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(500)
        check('Gestoppt: Box verschwindet', await pg.evaluate("document.getElementById('passtBox').hidden"))
        await pg.click('#loopAll'); await pg.wait_for_timeout(500)
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(500)
        w = await pg.evaluate("(() => { const b = document.getElementById('passtBox').getBoundingClientRect(), t = document.querySelector('.tracks').getBoundingClientRect(); return [Math.round(b.width), Math.round(t.width), document.documentElement.scrollWidth]; })()")
        check('Schmal: Box über die ganze Breite, kein seitliches Scrollen', abs(w[0] - w[1]) <= 2 and w[2] <= 390, w)
        tabsok = await pg.evaluate("[...document.querySelectorAll('.tab')].every(t => t.scrollWidth <= t.clientWidth + 1)")
        check('Schmal: Reiter lesbar', tabsok)
        await pg.screenshot(path=O + 'v26_schmal.png', full_page=False)
        for w_ in (768, 1024, 1366):
            await pg.set_viewport_size({'width': w_, 'height': 1024}); await pg.wait_for_timeout(200)
            r = await pg.evaluate("(() => { const t=[...document.querySelectorAll('.tab')]; return [new Set(t.map(x=>Math.round(x.getBoundingClientRect().top))).size, t.every(x => x.scrollWidth <= x.clientWidth + 1)]; })()")
            check(f'{w_} px: Reiter in einer Zeile, lesbar', r == [1, True], r)
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
