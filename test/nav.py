# v136: Hilfsfunktion für Tests – öffnet einen Unterpunkt über die neue Navigation (Bereich oben, dann Chip in der Unterleiste).
# Unterpunkte (alte Reiter-Namen): looper | lernen power caged quinten griffbrett ueben | jam solo | lied singen | hilfe
AREA = {'looper': 'looper', 'lernen': 'lernen', 'power': 'lernen', 'caged': 'lernen', 'quinten': 'lernen', 'griffbrett': 'lernen', 'ueben': 'lernen',
        'jam': 'jammen', 'solo': 'jammen', 'lied': 'gesang', 'singen': 'gesang'}
async def tab(pg, name):
    if name == 'looper':
        await pg.click('#tab-looper'); return
    if name == 'hilfe':
        if await pg.get_attribute('#tab-hilfe', 'aria-pressed') != 'true': await pg.click('#tab-hilfe')
        return
    await pg.click('#area-' + AREA[name])
    if await pg.get_attribute('#tab-' + name, 'aria-selected') != 'true': await pg.click('#tab-' + name)
