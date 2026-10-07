# v34: Optiken umbenannt (Klar, Kühl, Nordisch, Metal, Verstärker, Matrix), zwei neue Optiken, Verträglichkeit mit v24 (/stabil/)
# Braucht den Pages-Nachbau auf Port 8790 (neue Fassung + Ordner stabil/), siehe UEBERGABE Abschnitt 8.
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8790/3nps/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
async def pick(pg, v):
    await pg.click('#optikBtn'); await pg.select_option('#appTheme', v); await pg.wait_for_timeout(250)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1180, 'height': 820}, service_workers='block')
        errs = []; pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(600)
        names = await pg.evaluate("[...document.querySelectorAll('#appTheme option')].map(o=>o.value+'='+o.textContent)")
        check('Namen', names[:6] == ['clean=Klar', 'ice=Kühl', 'nordic=Nordisch', 'metal=Metal', 'amp=Verstärker', 'matrix=Matrix'], names)
        for v in ['clean', 'matrix', 'ice', 'metal', 'amp', 'nordic']:
            await pick(pg, v)
            st = await pg.evaluate("[document.documentElement.dataset.theme||'nordic', getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('.card')).backgroundColor]")
            check('Optik ' + v + ' aktiv', st[0] == v, st)
        await pick(pg, 'matrix')
        bg = await pg.evaluate("getComputedStyle(document.documentElement).backgroundImage")
        check('Matrix-Hintergrund geladen', 'bg-matrix.jpg' in bg)
        r = await pg.evaluate("fetch('bg-matrix.jpg').then(r=>r.status)")
        check('Bild vorhanden', r == 200, r)
        await pg.reload(); await pg.wait_for_timeout(500)
        st = await pg.evaluate("[document.documentElement.dataset.theme, localStorage.getItem('3nps-theme'), localStorage.getItem('3nps-theme2')]")
        check('Matrix bleibt nach Neuladen', st == ['matrix', 'nordic', 'matrix'], st)
        # v24 öffnen: zeigt Nordisch, ohne Fehler, danach bleibt in der neuen App Matrix
        v24 = await ctx.new_page(); e24 = []; v24.on('pageerror', lambda e: e24.append(str(e)))
        await v24.goto(U + 'stabil/index.html'); await v24.wait_for_timeout(800)
        t24 = await v24.evaluate("[document.documentElement.dataset.theme||'nordic', document.getElementById('appTheme').value]")
        check('v24 zeigt Nordisch', t24 == ['nordic', 'nordic'], t24)
        check('v24 ohne Fehler', not e24, e24)
        await pg.reload(); await pg.wait_for_timeout(500)
        st = await pg.evaluate("document.documentElement.dataset.theme")
        check('nach v24 wieder Matrix', st == 'matrix', st)
        # In der v24 umstellen → gilt danach auch in der neuen App
        await v24.select_option('#appTheme', 'metal'); await v24.wait_for_timeout(200)
        await pg.reload(); await pg.wait_for_timeout(500)
        st = await pg.evaluate("[document.documentElement.dataset.theme, document.getElementById('appTheme').value]")
        check('Umstellung in v24 wird übernommen', st == ['metal', 'metal'], st)
        await pick(pg, 'ice'); await v24.reload(); await v24.wait_for_timeout(600)
        t24 = await v24.evaluate("document.documentElement.dataset.theme")
        check('Kühl erscheint in v24 als Eiswand', t24 == 'ice', t24)
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
