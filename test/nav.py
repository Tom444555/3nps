# v136: Hilfsfunktion für Tests – öffnet einen Unterpunkt über die neue Navigation (Bereich oben, dann Chip in der Unterleiste).
# Unterpunkte (alte Reiter-Namen): looper | lernen power caged quinten griffbrett ueben | jam solo | lied singen | hilfe
AREA = {'looper': 'looper', 'lernen': 'lernen', 'power': 'lernen', 'caged': 'lernen', 'quinten': 'lernen', 'griffbrett': 'lernen', 'ueben': 'lernen', 'hoer': 'lernen', 'spick': 'lernen',
        'jam': 'jammen', 'solo': 'jammen', 'lied': 'gesang', 'singen': 'gesang'}
async def tab(pg, name):
    if name == 'looper':
        await pg.click('#tab-looper'); return
    if name == 'hilfe':
        if await pg.get_attribute('#tab-hilfe', 'aria-pressed') != 'true': await pg.click('#tab-hilfe')
        return
    if not await pg.query_selector('#area-' + AREA[name]):   # ältere Fassung (vor v136, z. B. Vergleich gegen alte index.html): alter Reiter-Knopf
        await pg.click('#tab-' + name); return
    await pg.click('#area-' + AREA[name])
    if await pg.get_attribute('#tab-' + name, 'aria-selected') != 'true': await pg.click('#tab-' + name)
