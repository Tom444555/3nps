# v156: Aufräumen nach dem Studio – keine Studio-Reste im gebauten index.html / Wörterbuch / sw.js, index.html kleiner,
# Looper lädt/spielt/speichert Ideen, Ton-Wiederaufnahme (statechange, versteckt/sichtbar, erstes Tippen) wie vorher,
# ?load= wird ignoriert, alte Studio-Adresse führt online und offline in den Looper, keine Skriptfehler, drei Größen.
import asyncio, os, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/')
W = '/home/claude/3nps-src/app/www/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
T = '/home/claude/3nps/test/'
GONE = ['goStudio', 'hardStop', '__studioHold', '__looperClosed', '__looperBC', '3nps-to-studio', '3nps-audio', 'looper-studio',
        'studiob', 'MasterSource', 'studio-btn', 'Aus dem Studio zurück', 'Looper angehalten – das Studio spielt', 'Im Studio']
GONE_EN = ['Continue in the Studio', 'In the Studio', 'Back from the Studio', 'the Studio is playing', 'Continue all tracks in the Studio']
HIDE = "(h=>{Object.defineProperty(document,'hidden',{get:()=>h,configurable:true});Object.defineProperty(document,'visibilityState',{get:()=>h?'hidden':'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))})(%s)"
async def main():
    html = open(W + 'index.html', encoding='utf8').read(); en = open(W + 'i18n-en.js', encoding='utf8').read(); sw = open(W + 'sw.js', encoding='utf8').read()
    left = [g for g in GONE if g in html]
    check('gebautes index.html ohne Studio-Reste', not left, left)
    check('Englisch-Wörterbuch ohne Studio-Texte', not [g for g in GONE_EN if g in en], [g for g in GONE_EN if g in en])
    n = len(html.encode()); check('index.html < 2,1 MB und kleiner als v155 (2 099 107 B)', n < 2099107 and n < 2100000, n)
    check('sw.js: Cache 3nps-v156, kein /inst/-Zweig, Weiterleitungsseite bleibt', "'3nps-v156'" in sw and '/inst/' not in sw and "'studio/index.html'" in sw)
    check('Weiterleitungsseite studio/index.html vorhanden', 'url=../' in open(W + 'studio/index.html', encoding='utf8').read())
    check('Studio-Instrumente inst/ entfernt', not os.path.exists(W + 'inst'))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1500); await open_tab(pg, 'looper')
            if w == 1366: check('ab v156', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 156)
            check(f'{w}: Looper da, kein Studio-Knopf', await pg.locator('#foot0').count() == 1 and await pg.locator('.studio-btn, [id^=studiob]').count() == 0)
            if w == 1366:
                await pg.select_option('#loopCountIn', '0')
                await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav'); await pg.wait_for_timeout(3500)
                if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(500)
                d = await pg.evaluate("(()=>{const t=Looper.debug().tracks[0];return [t.state, audioCtx.state, audioCtx.currentTime]})()")
                await pg.wait_for_timeout(600); t2 = await pg.evaluate("audioCtx.currentTime")
                check('Datei geladen, Spur 1 spielt, Ton läuft', d[0] == 'playing' and d[1] == 'running' and t2 > d[2], d)
                # Ton-Wiederaufnahme wie v155
                await pg.wait_for_timeout(1200)   # hookCtx hängt sich im Sekundentakt an
                await pg.evaluate("audioCtx.suspend()"); await pg.wait_for_timeout(900)
                check('Unterbrechung (sichtbar): Ton startet von selbst wieder', await pg.evaluate("audioCtx.state") == 'running', await pg.evaluate("audioCtx.state"))
                await pg.evaluate(HIDE % 'true'); await pg.evaluate("audioCtx.suspend()"); await pg.wait_for_timeout(900)
                check('versteckt: bleibt still', await pg.evaluate("audioCtx.state") == 'suspended', await pg.evaluate("audioCtx.state"))
                await pg.evaluate(HIDE % 'false'); await pg.wait_for_timeout(900)
                check('wieder sichtbar: Ton läuft weiter', await pg.evaluate("audioCtx.state") == 'running', await pg.evaluate("audioCtx.state"))
                await pg.evaluate(HIDE % 'true'); await pg.evaluate("audioCtx.suspend()"); await pg.wait_for_timeout(600)
                await pg.evaluate("window.dispatchEvent(new PointerEvent('pointerdown'))"); await pg.wait_for_timeout(600)
                check('erstes Tippen startet den Ton', await pg.evaluate("audioCtx.state") == 'running', await pg.evaluate("audioCtx.state"))
                await pg.evaluate(HIDE % 'false')
                # Idee speichern/laden
                det = pg.locator('#panel-looper details', has=pg.locator('#ideaName')).first
                if await det.count() and not await det.evaluate('d=>d.open'): await det.locator('summary').first.click()
                await pg.fill('#ideaName', 'Aufgeraeumt'); await pg.click('#ideaSave'); await pg.wait_for_timeout(1500)
                acts = await pg.evaluate("[...document.querySelectorAll('.idea-actions button')].map(b=>b.dataset.act)")
                check('Ideen: Laden · Teilen · Löschen', 'load' in acts and 'share' in acts and 'del' in acts and 'studio' not in acts, acts[:6])
                await pg.evaluate("Looper.stopAll(); Looper.clearAll(); 0"); await pg.wait_for_timeout(300)
                await pg.click('.idea-row:has-text("Aufgeraeumt") [data-act=load]'); await pg.wait_for_timeout(2500)
                st = await pg.inner_text('#loopStatus')
                check('Idee lädt (Spur zurück)', 'Aufgeraeumt' in st and await pg.evaluate("Looper.debug().tracks[0].state") in ('playing', 'stopped', 'paused', 'idle', 'muted') and await pg.evaluate("!!Looper.getSession()"), st)
                # ?load= tut nichts mehr
                await pg.goto(U + 'index.html?load=gibtsnicht'); await pg.wait_for_timeout(2000)
                st = await pg.inner_text('#loopStatus')
                check('?load= wird ignoriert (keine Meldung, Looper normal)', 'Studio' not in st and 'nicht geladen' not in st and await pg.locator('#tab-looper').count() == 1, st)
                # alte Studio-Adresse online
                await pg.goto(U + 'studio/'); await pg.wait_for_timeout(2500)
                check('Studio-Adresse führt online in den Looper', await pg.locator('#tab-looper').count() == 1 and '/studio' not in pg.url, pg.url)
            check(f'{w}: keine Skriptfehler', not errs, errs[:3])
            await ctx.close()
        # offline mit Service Worker (eigener Kontext)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => true)")
        for k in range(60):
            if await pg.evaluate("!!navigator.serviceWorker.controller && caches.keys().then(k=>k.includes('3nps-v156'))"): break
            await pg.wait_for_timeout(500)
        await pg.reload(); await pg.wait_for_timeout(1500)
        cn = await pg.evaluate("caches.keys()")
        check('Service Worker aktiv, Speicher 3nps-v156', await pg.evaluate("!!navigator.serviceWorker.controller") and '3nps-v156' in cn, cn)
        await pg.goto(U + 'studio/'); await pg.wait_for_timeout(2500)
        check('Studio-Adresse mit Service Worker online → Looper', await pg.locator('#tab-looper').count() == 1 and '/studio' not in pg.url, pg.url)
        await ctx.set_offline(True)
        await pg.goto(U + 'studio/'); await pg.wait_for_timeout(3000)
        check('Studio-Adresse offline → Looper', await pg.locator('#tab-looper').count() == 1 and '/studio' not in pg.url, pg.url)
        check('offline: keine Skriptfehler', not errs, errs[:3])
        await ctx.close(); await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
