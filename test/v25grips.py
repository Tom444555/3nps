# v25: Akkordgriffe im Solo Finder
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
        await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
        await pg.select_option('#sfKeySel', '0:M'); await pg.wait_for_timeout(200)
        check('Start: Griffbild zeigt Tonleiter', 'Tonleiter' in await pg.inner_text('#sfNeckMode .active') and await pg.evaluate("document.getElementById('sfGrips').hidden"))
        await pg.click('.sf-ch:has-text("Am")'); await pg.wait_for_timeout(300)
        t = await pg.inner_text('#sfNeckTitle'); g = await pg.evaluate("[...document.querySelectorAll('#sfGrips button[data-g]')].map(b => b.textContent)")
        check('Akkord antippen → Griffe (Am offen zuerst)', t.startswith('Griff: Am') and 'offen' in t and len(g) >= 2, f'{t} · {g}')
        n = await pg.evaluate("[...document.querySelectorAll('#sfNeck .nk-n')].map(e => e.dataset.m).join(',')")
        check('Am offen: x02210 (A E A C E)', n == '45,52,57,60,64' or sorted(map(int, n.split(','))) == [45, 52, 57, 60, 64], n)
        check('Gedämpfte Saite mit × markiert', await pg.evaluate("document.querySelectorAll('#sfNeck .nk-x').length") == 1)
        await pg.click('#sfGrips button[data-g="1"]'); await pg.wait_for_timeout(200)
        t2 = await pg.inner_text('#sfNeckTitle')
        check('Zweiter Griff (E-Form Bund 5) mit Lagenmarkierung', 'Bund 5' in t2 and await pg.evaluate("!!document.querySelector('#sfNeck .nk-zone')"), t2)
        await pg.click('.sf-colors .sf-ch >> nth=0'); await pg.wait_for_timeout(200)
        t3 = await pg.inner_text('#sfNeckTitle'); f3 = await pg.inner_text('#sfNow b')
        check('Färbung antippen → deren Griff, Fokus bleibt', t3.startswith('Griff: Am7') or t3.startswith('Griff: Am6') or t3.startswith('Griff: Am9'), f'{t3} · Fokus {f3}')
        await pg.click('.sf-sc >> nth=0'); await pg.wait_for_timeout(200)
        check('Tonleiter antippen → zurück zur Tonleiter', (await pg.inner_text('#sfNeckTitle')).startswith('Griffbild:'))
        await pg.click('#sfNeckMode button[data-m="grip"]'); await pg.wait_for_timeout(200)
        check('Umschalter „Griffe“ zeigt Griff des Fokus-Akkords', (await pg.inner_text('#sfNeckTitle')).startswith('Griff: Am'))
        await pg.click('.sf-strum'); await pg.wait_for_timeout(300)
        # Mit laufendem Loop folgen die Griffe dem klingenden Akkord
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if await pg.evaluate("!!Looper._chords(0)"): break
        await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
        if not await pg.evaluate("document.getElementById('sfFollow').checked"): await pg.click('#sfFollow')
        await pg.select_option('#sfKeySel', 'auto')
        await pg.click('#sfNeckMode button[data-m="grip"]')
        ok = 0; seen = set()
        for k in range(28):
            await pg.wait_for_timeout(250)
            a = await pg.evaluate("[document.querySelector('#sfStrip .sf-seg.on b')?.textContent, document.getElementById('sfNeckTitle').textContent]")
            if a[0] and a[1].startswith('Griff: ' + a[0] + ' ') : ok += 1; seen.add(a[0])
            if k == 8: await pg.screenshot(path=O + 'v25_grips.png', full_page=True)
        check('Griffe folgen dem klingenden Akkord', ok >= 22 and len(seen) >= 3, f'{ok}/28 · {sorted(seen)}')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
