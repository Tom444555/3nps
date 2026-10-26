# v113: Reiter „Anleitung“ (statt Mastering) – Inhalt mit Grundlagen + Schritt für Schritt, Bilder, Suche nach Begriffen
import asyncio, sys
from playwright.async_api import async_playwright
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 820})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(900)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t=>t.textContent.replace(/\\u00ad/g,''))")
        check('Reiter „Anleitung“ nach „Mitsingen“', 'Anleitung' in tabs and tabs.index('Anleitung') == tabs.index('Mitsingen') + 1, tabs)
        await pg.click('#tab-hilfe'); await pg.wait_for_timeout(500)
        n = await pg.evaluate("Hilfe.count()"); toc = await pg.locator('#hlToc a').count(); art = await pg.locator('.hl-topic').count()
        check('Inhaltsverzeichnis und Themen (≥ 30)', n >= 30 and toc == n and art == n, (n, toc, art))
        first = await pg.evaluate("document.querySelector('.hl-group').textContent")
        check('Zuerst die Grundlagen', first == 'Grundlagen', first)
        check('Schritt-für-Schritt-Listen', await pg.locator('.hl-topic ol').count() >= 25)
        srcs = await pg.evaluate("[...new Set([...document.querySelectorAll('.hl-img')].map(i=>i.getAttribute('src')))]")
        bad = []
        for s in srcs:
            r = await pg.evaluate("(u=>fetch(u).then(r=>r.ok&&r.headers.get('content-type')))('%s')" % s)
            if not r or 'image' not in r: bad.append(s)
        check('alle Bilder vorhanden (%d)' % len(srcs), len(srcs) >= 15 and not bad, bad)
        for q, want in [('latenz', 'latenz'), ('Mastering', 'mastering'), ('fusspedal', 'pedal'), ('takte loopen', 'studio-arrangement'), ('übersicht', 'ueberblick'), ('eingang geht nicht', 'probleme')]:
            await pg.fill('#hlQ', q); await pg.wait_for_timeout(150)
            hit = await pg.evaluate("(document.querySelector('.hl-hit')||{}).dataset ? document.querySelector('.hl-hit').dataset.id : null")
            check('Suche „%s“ → %s' % (q, want), hit == want, hit)
        await pg.fill('#hlQ', 'drums kit'); await pg.press('#hlQ', 'Enter'); await pg.wait_for_timeout(1800)
        top = await pg.evaluate("document.getElementById('hl-drums').getBoundingClientRect().top")
        check('Enter springt zum ersten Treffer', 0 <= top < 300, top)
        img = await pg.evaluate("(()=>{const i=document.querySelector('#hl-drums .hl-img'); return i && i.complete && i.naturalWidth})()")
        check('Bild wird geladen und angezeigt', img and img > 500, img)
        await pg.fill('#hlQ', 'xyzquatsch'); await pg.wait_for_timeout(150)
        check('kein Treffer: Hinweis', 'Nichts gefunden' in await pg.inner_text('#hlRes'))
        await pg.screenshot(path='/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/hilfe.png')
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.click('#hlX'); await pg.evaluate("Hilfe.go('aufnehmen')"); await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/hilfe-phone.png')
        ov = await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 2")
        check('Telefon: nichts ragt seitlich heraus', ov)
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
