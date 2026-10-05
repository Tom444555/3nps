# v25: Mithören im Solo Finder – Eingang über Testdatei (A C E F F#), Einordnung zu Am in C-Dur
import asyncio
from playwright.async_api import async_playwright
O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=/home/claude/3nps/test/mithoeren.wav'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
        check('Mithören ist aus, kein Eingang offen', not await pg.evaluate("SoloFinder.listen().on") and await pg.evaluate("document.getElementById('sfLive').hidden") and not await pg.evaluate("Looper.debug().mic"))
        await pg.select_option('#sfKeySel', '0:M'); await pg.click('.sf-ch:has-text("Am")'); await pg.click('.sf-sc >> nth=0'); await pg.wait_for_timeout(200)
        await pg.click('#sfListen'); await pg.wait_for_timeout(800)
        check('Einschalten öffnet den Eingang', await pg.evaluate("SoloFinder.listen().on") and await pg.evaluate("Looper.debug().mic"))
        await pg.click('#sfLiveReset')
        seen = []; tags = {}
        for k in range(110):
            await pg.wait_for_timeout(60)
            c = await pg.evaluate("(() => { const l = SoloFinder.listen(); return l.cur ? [l.cur.midi, l.cur.c.txt, document.querySelectorAll('#sfNeck .nk-hit').length] : null; })()")
            if c and (not seen or seen[-1] != c[0]): seen.append(c[0]); tags[c[0]] = (c[1], c[2])
            if k == 30: await pg.screenshot(path=O + 'v25_listen.png', full_page=True)
        order = [57, 60, 64, 65, 66]
        # Reihenfolge zyklisch prüfen (Datei läuft in Schleife)
        idx = [order.index(m) for m in seen if m in order]
        cyc = all((idx[i] + 1) % 5 == idx[i+1] for i in range(len(idx) - 1)) and len(set(idx)) == 5
        check('Erkannte Töne in richtiger Reihenfolge, keine Fehltöne', cyc and all(m in order for m in seen), seen)
        want = {57: 'Grundton', 60: 'Akkordton', 64: 'Akkordton', 65: 'Tonleiter', 66: 'Reibung'}
        got = {m: tags[m][0] for m in tags}
        check('Einordnung: A Grundton, C/E Akkordton, F Tonleiter, F♯ Reibung', all(got.get(m) == w for m, w in want.items()), got)
        check('Ton leuchtet im Griffbild (alle Lagen)', all(tags[m][1] >= 2 for m in tags), {m: tags[m][1] for m in tags})
        st = await pg.evaluate("SoloFinder.listen().st")
        check('Zähler zählt jeden Ton einmal', 4 <= sum(st.values()) <= 12, st)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        check('Nach Reiterwechsel läuft Mithören weiter', await pg.evaluate("SoloFinder.listen().on"))
        await pg.click('#sfListen'); await pg.wait_for_timeout(200)
        check('Ausschalten: Anzeige weg, Looper-Eingang bleibt nutzbar', not await pg.evaluate("SoloFinder.listen().on") and await pg.evaluate("document.getElementById('sfLive').hidden") and await pg.evaluate("Looper.debug().mic"))
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
