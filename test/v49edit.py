# v49: Editor – ganzen Loop ziehen (verschieben) mit Magnet auf Takt, deutlichere Takte, Undo
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
SIG = "(()=>{const x=Looper._mixOf(0).l; let s=0; for(let i=0;i<x.length;i+=7) s+=x[i]*((i%97)+1); return s})()"
async def drag(pg, x0, dx, y):
    await pg.mouse.move(x0, y); await pg.mouse.down()
    for k in range(1, 9): await pg.mouse.move(x0 + dx * k / 8, y); await pg.wait_for_timeout(30)
    await pg.mouse.up(); await pg.wait_for_timeout(400)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('3nps-edfull','1')")
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(2500)
        if await pg.evaluate('!!Looper._ed()'): await pg.click('#edClose')
        await pg.click('#edit0'); await pg.wait_for_timeout(500)
        check('Knopf „Loop verschieben“ + Magnet da', await pg.is_visible('#edMove') and await pg.is_visible('#edMag'))
        check('Magnet steht auf Takt', await pg.input_value('#edMag') == 'bar')
        await pg.screenshot(path='/tmp/claude-0/v49_ed_bars.png')
        sr = await pg.evaluate("audioCtx.sampleRate"); L = await pg.evaluate("Looper._ed().L")
        bb = await pg.locator('#edWave').bounding_box(); y = bb['y'] + bb['height'] * 0.55
        X = lambda f: bb['x'] + f / L * bb['width']
        sig0 = await pg.evaluate(SIG)
        # ohne Modus: Ziehen bewegt nur Griffe, nicht den Inhalt
        # Modus an, Magnet aus: Verschiebung ≈ gezogene Strecke
        await pg.click('#edMove'); await pg.select_option('#edMag', 'off')
        check('Modus an (Knopf gedrückt)', await pg.get_attribute('#edMove', 'aria-pressed') == 'true')
        x0 = bb['x'] + bb['width'] * 0.37
        m0 = await pg.evaluate("Array.from(Looper._mixOf(0).l)")
        g0 = await pg.evaluate('Looper._grid(1)')
        await drag(pg, x0, 60, y)
        g1 = await pg.evaluate('Looper._grid(1)')
        m1 = await pg.evaluate("Array.from(Looper._mixOf(0).l)")
        # Versatz k bestimmen: m1[i+k] == m0[i]
        import numpy as np
        a = np.array(m0, dtype=np.float32); c = np.array(m1, dtype=np.float32)
        exp = 60 / bb['width'] * L
        best = None
        for k in range(int(exp - sr * 0.1), int(exp + sr * 0.1)):
            if np.abs(np.roll(a, k)[1000:1400] - c[1000:1400]).max() < 1e-6 and np.abs(np.roll(a, k)[40000:40400] - c[40000:40400]).max() < 1e-6: best = k; break
        check('Taktraster bleibt beim Verschieben stehen (Takt 1 fest)', g0 == g1 and abs(g0[0]) < 2, (g0[:3], g1[:3]))
        check('Ganzer Loop nach rechts verschoben (Länge gleich)', best is not None and len(m1) == len(m0), (best, round(exp)))
        await pg.click('#edUndo'); await pg.wait_for_timeout(300)
        check('↶ macht Verschieben rückgängig', abs(await pg.evaluate(SIG) - sig0) < 1e-6)
        # nach links
        await drag(pg, x0, -45, y)
        c = np.array(await pg.evaluate("Array.from(Looper._mixOf(0).l)"), dtype=np.float32); exp = -45 / bb['width'] * L; best = None
        for k in range(int(exp - sr * 0.1), int(exp + sr * 0.1)):
            if np.abs(np.roll(a, k)[1000:1400] - c[1000:1400]).max() < 1e-6 and np.abs(np.roll(a, k)[40000:40400] - c[40000:40400]).max() < 1e-6: best = k; break
        check('… und nach links', best is not None and best < 0, best)
        await pg.click('#edUndo'); await pg.wait_for_timeout(300)
        # Magnet Takt: gegriffener Anschlag landet auf einer Taktlinie
        await pg.select_option('#edMag', 'bar')
        grid = await pg.evaluate("Looper._grid(1)"); ons = await pg.evaluate("Looper._onsets(0)")
        o = min(ons, key=lambda q: abs(q - L * 0.4)); g = min(grid, key=lambda q: abs(q - (o + sr * 0.03)))
        dx = (g - o) / L * bb['width'] + 6   # knapp daneben loslassen → Magnet zieht auf die Linie
        await drag(pg, X(o), dx, y)
        c = np.array(await pg.evaluate("Array.from(Looper._mixOf(0).l)"), dtype=np.float32); best = None
        for k in range(int(g - o - sr * 0.15), int(g - o + sr * 0.15)):
            if np.abs(np.roll(a, k)[1000:1400] - c[1000:1400]).max() < 1e-6 and np.abs(np.roll(a, k)[40000:40400] - c[40000:40400]).max() < 1e-6: best = k; break
        land = (o + best) % L if best is not None else None
        check('Magnet: Anschlag rastet auf Taktlinie ein', land is not None and min(abs(land - q) for q in grid) < 2, (land, round(g)))
        st = await pg.inner_text('#loopStatus'); check('Meldung „verschoben“', 'verschoben' in st, st[:70])
        await pg.click('#edUndo'); await pg.wait_for_timeout(200)
        for _ in range(3): await pg.click('#loopEditor button:has-text("+")')
        await pg.wait_for_timeout(200)
        g0 = await pg.evaluate('Looper._grid(1)')
        await drag(pg, bb['x'] + bb['width'] * 0.5, 80, y)
        g1 = await pg.evaluate('Looper._grid(1)')
        check('Gezoomt: Taktraster bleibt stehen', g0 == g1, (g0[:2], g1[:2]))
        await pg.select_option('#edMag', 'beat')
        await pg.reload(); await pg.wait_for_timeout(500)
        check('Magnet-Wahl gespeichert', await pg.input_value('#edMag') == 'beat')
        await pg.evaluate("localStorage.removeItem('3nps-edmag')")
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
