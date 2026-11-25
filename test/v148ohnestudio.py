# v148: Studio entfernt – keine Studio-Knöpfe an Spur und Idee, Spurkopf-Raster EQ · Hall/Echo · Gesang trennen, Anleitung ohne Studio-Themen,
# Studio-Adresse führt in den Looper, Offline-Liste ohne Studio, Ideen speichern/laden geht weiter, keine Skriptfehler.
import asyncio, os, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
T = '/home/claude/3nps/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1500); await open_tab(pg, 'looper')
            if w == 1366: check('ab v148', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 148)
            check(f'{w}: kein Knopf „Im Studio ↗“', await pg.locator('.studio-btn, [id^=studiob]').count() == 0)
            g = await pg.evaluate("[...document.querySelectorAll('.track-btns')].map(g=>[...g.children].map(b=>b.id.replace(/\\d+$/,'')).join(','))")
            check(f'{w}: Spurkopf-Raster EQ · Hall/Echo · Gesang trennen an jeder Spur', len(g) >= 3 and all(x == 'eqb,fxb,sepb' for x in g), g[:2])
            if w == 1366:
                await pg.select_option('#loopCountIn', '0')
                await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav'); await pg.wait_for_timeout(3500)
                if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(500)
                check('„Gesang trennen“ erscheint bei geladener Spur', await pg.is_visible('#sepb0'))
                r = await pg.evaluate("(()=>{const a=document.getElementById('eqb0').getBoundingClientRect(),s=document.getElementById('sepb0').getBoundingClientRect();return [Math.round(a.height),Math.round(s.height)]})()")
                check('Knöpfe im Spurkopf mindestens 44 px hoch', min(r) >= 44, r)
                # Idee speichern → Liste ohne „Studio“, Laden geht
                det = pg.locator('#panel-looper details', has=pg.locator('#ideaName')).first
                if await det.count() and not await det.evaluate('d=>d.open'): await det.locator('summary').first.click()
                await pg.fill('#ideaName', 'OhneStudio'); await pg.click('#ideaSave'); await pg.wait_for_timeout(1500)
                acts = await pg.evaluate("[...document.querySelectorAll('.idea-actions button')].map(b=>b.dataset.act)")
                check('Ideen-Liste: Laden · Teilen · Löschen, kein „Studio“', 'load' in acts and 'share' in acts and 'del' in acts and 'studio' not in acts, acts[:6])
                await pg.click('.idea-actions [data-act=load]'); await pg.wait_for_timeout(2500)
                check('Idee lädt weiter', 'OhneStudio' in (await pg.input_value('#ideaName')) and await pg.evaluate("Looper.changes()>=0"))
                # Anleitung
                await open_tab(pg, 'hilfe'); await pg.wait_for_timeout(1200)
                ids = await pg.evaluate("[...document.querySelectorAll('.hl-topic')].map(t=>t.id||t.dataset.id||'')")
                txt = await pg.evaluate("document.getElementById('panel-hilfe').innerText")
                check('Anleitung: keine Studio-Themen', not any('studio' in i for i in ids) and 'Loopsmiths Studio' not in txt and 'Im Studio' not in txt, [i for i in ids if 'studio' in i])
                check('Anleitung: Themen noch da (≥ 30)', await pg.evaluate("Hilfe.count()") >= 30)
                # alte Adresse
                await pg.goto(U + 'studio/'); await pg.wait_for_timeout(2500)
                check('Studio-Adresse führt in den Looper', await pg.locator('#tab-looper').count() == 1 and '/studio' not in pg.url, pg.url)
                sw = await pg.evaluate("fetch('sw.js').then(r=>r.text())")
                core = re.search(r'const CORE = \[(.*?)\]', sw, re.S).group(1)
                check('Offline-Liste ohne Studio', 'studio' not in core)
            check(f'{w}: keine Skriptfehler', not errs, errs[:3])
            await ctx.close()
        await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
