# v136: Hilfsfunktion für Tests – öffnet einen Unterpunkt über die neue Navigation (Bereich oben, dann Chip in der Unterleiste).
# Unterpunkte (alte Reiter-Namen): looper | lernen power caged quinten griffbrett ueben | jam solo | lied singen | hilfe
AREA = {'looper': 'looper', 'lernen': 'lernen', 'power': 'lernen', 'caged': 'lernen', 'quinten': 'lernen', 'griffbrett': 'lernen', 'ueben': 'lernen', 'hoer': 'lernen', 'spick': 'lernen', 'uebezeit': 'lernen', 'tonleiter': 'lernen', 'songbook': 'lernen', 'singlernen': 'lernen', 'songtext': 'gesang',
        'jam': 'jammen', 'solo': 'jammen', 'lied': 'gesang', 'singen': 'gesang', 'rig': 'rig'}
async def _wait(pg, js, ms=8000):   # v167 (CSP verbietet wait_for_function)
    for _ in range(ms // 100):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(100)
    return False
async def tab(pg, name):
    if name == 'songtext' and await pg.query_selector('#swNav'):   # v167: „Songtext schreiben“ = Songwriting › Bereich „Workflow“
        await tab(pg, 'lied')
        await _wait(pg, "!!window.SW")
        if await pg.get_attribute('#swNav [data-sw=wf]', 'aria-selected') != 'true' or await pg.evaluate("!window.Songtext||!Songtext.built()"):
            await pg.click('#swNav [data-sw=wf]')
        await _wait(pg, "!!(window.Songtext && Songtext.built())"); await pg.wait_for_timeout(150); return
    if name in ('looper', 'rig'):   # v146: Rig ist ein eigener Bereich ohne Unterleiste
        await pg.click('#tab-' + name); return
    if name == 'hilfe':
        if await pg.get_attribute('#tab-hilfe', 'aria-pressed') != 'true': await pg.click('#tab-hilfe')
        return
    if not await pg.query_selector('#area-' + AREA[name]):   # ältere Fassung (vor v136, z. B. Vergleich gegen alte index.html): alter Reiter-Knopf
        await pg.click('#tab-' + name); return
    await pg.click('#area-' + AREA[name])
    if await pg.get_attribute('#tab-' + name, 'aria-selected') != 'true': await pg.click('#tab-' + name)
