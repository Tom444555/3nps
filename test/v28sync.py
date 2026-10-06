# v28: Aufnahmen im Song taktgenau geplant – Teil ×3 und zweiter Teil mit anderem Tempo:
# Startzeiten = Akkordwechsel im Taktraster, Abstand = Länge des Teils, Dauer × Tempo-Faktor = Länge der Aufnahme
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if await pg.evaluate("!!Looper._chords(0)"): break
        await pg.click('#loopSong'); await pg.wait_for_timeout(200); await pg.click('#ldDOk'); await pg.wait_for_timeout(800)
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        await pg.click('#tab-lied'); await pg.wait_for_timeout(300)
        await pg.click('.ld-blk >> nth=0'); await pg.click('#ldOrdEdit [data-a="plus"]'); await pg.click('#ldOrdEdit [data-a="plus"]')
        await pg.click('#ldPlay'); await pg.wait_for_timeout(200)
        if not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"): await pg.click('#ldPlay')
        await pg.wait_for_timeout(23000)
        log = await pg.evaluate("Lied.log()"); grid = await pg.evaluate("Lied.grid()")
        st = [l['t'] for l in log]
        check('3 Wiederholungen geplant', len(log) >= 3, len(log))
        d = [round((st[i+1] - st[i]) * 1000, 3) for i in range(len(st) - 1)]
        check('Abstand genau eine Teil-Länge (10 000 ms bei 96 BPM)', all(abs(x - 10000) < 0.5 for x in d), d)
        check('Startzeit liegt exakt auf dem Akkordwechsel im Taktraster', all(any(abs(g - s) < 1e-6 for g in grid) for s in st[-2:]))
        check('Dauer passt zur Aufnahme (Tempo gleich, Faktor 1)', all(abs(l['dur'] * l['rate'] - l['bufDur']) < 0.003 and l['rate'] == 1 for l in log), [(round(l['dur'], 4), round(l['bufDur'], 4)) for l in log])
        await pg.click('#ldPlay'); await pg.wait_for_timeout(300)
        # Tempo des Songs auf 120 → Aufnahme schneller abgespielt, Länge passt zum neuen Raster
        await pg.fill('#ldBpm', '120'); await pg.dispatch_event('#ldBpm', 'change'); await pg.wait_for_timeout(200)
        await pg.click('#ldPlay'); await pg.wait_for_timeout(200)
        if not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"): await pg.click('#ldPlay')
        await pg.wait_for_timeout(11000)
        log = await pg.evaluate("Lied.log()"); st = [l['t'] for l in log]
        d = [round((st[i+1] - st[i]) * 1000, 3) for i in range(len(st) - 1)]
        check('Song-Tempo 120: Teil dauert 8 000 ms, Aufnahme × 1,25', len(log) >= 2 and all(abs(x - 8000) < 0.5 for x in d) and all(abs(l['rate'] - 1.25) < 1e-9 and abs(l['dur'] * l['rate'] - l['bufDur']) < 0.003 for l in log), [d, [l['rate'] for l in log]])
        await pg.click('#ldPlay')
        check('Keine Skriptfehler', not errs, errs[:2])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
