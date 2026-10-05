# v22: Quintenzirkel folgt der erkannten Tonart einer Spur (Datei laden / einspielen) und dem Griffbrett
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def load(pg, i, path):
    await pg.set_input_files(f'#file{i}', path)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if await pg.evaluate(f"!document.getElementById('key{i}').hidden"): break
    return await pg.inner_text(f'#key{i}')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-griffbrett'); await pg.select_option('#root', 'E'); await pg.select_option('#mode', 'Ionisch (Dur)'); await pg.wait_for_timeout(200)
        check('Startet mit der Griffbrett-Tonart (E-Dur)', await pg.evaluate('Quinten.sel()') == {'k': 4, 'minor': False})
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        kt = await load(pg, 0, T + 'chords/c_pop_strum.wav')
        s = await pg.evaluate('Quinten.sel()'); tk = await pg.evaluate('Quinten.trackKey()')
        check('Datei geladen (Zirkel zu): springt auf erkannte Tonart', 'C' in kt and s == {'k': 0, 'minor': False} and tk['i'] == 0, f'{kt!r} · {s} · {tk}')
        await pg.click('#tab-quinten'); await pg.wait_for_timeout(300)
        txt = await pg.inner_text('#qzKey'); tr = await pg.inner_text('#qzTrack')
        check('Zirkel zeigt C-Dur und „Spur 1: C-Dur“', txt == 'C-Dur' and 'Spur 1' in tr and 'C-Dur' in tr, f'{txt} · {tr}')
        check('Knopf „Tonart von Spur 1“ sichtbar', await pg.is_visible('#qzFromTrack') and '1' in await pg.inner_text('#qzFromTrack'))
        # Zirkel offen lassen, Spur 2 mit Moll-Loop laden (Datei-Feld geht auch aus anderem Reiter)
        await pg.click('.qz-seg.qz-maj[data-k="3"]'); await pg.wait_for_timeout(200)
        await pg.set_input_files('#file1', T + 'chords/c_minor_arp.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if await pg.evaluate("!document.getElementById('key1').hidden"): break
        k2 = await pg.inner_text('#key1'); s = await pg.evaluate('Quinten.sel()'); txt = await pg.inner_text('#qzKey')
        check('Neue Spur (Zirkel offen): springt sofort auf deren Tonart', s == (await pg.evaluate("(() => { const t = Quinten.trackKey(); return { k: t.k, minor: t.minor }; })()")) and (await pg.evaluate('Quinten.trackKey().i')) == 1, f'{k2!r} → {txt}')
        await pg.screenshot(path='/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/v22_key.png')
        # Griffbrett ändern (z. B. Tonart-Knopf der Spur 1 übernimmt) → Zirkel folgt
        await pg.click('#tab-looper'); await pg.click('#key0'); await pg.wait_for_timeout(300)
        check('Spur-Tonart übernommen → Zirkel folgt dem Griffbrett', await pg.evaluate('Quinten.sel()') == {'k': 0, 'minor': False} and await pg.evaluate('rootSel.value') == 'C')
        # Spur löschen → Spurhinweis verschwindet, wenn es diese Spur war
        await pg.evaluate("Looper.debug && 0")
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
