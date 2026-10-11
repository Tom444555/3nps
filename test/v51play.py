# v51: Improvisation – Pause/Weiter für den ganzen Loop (Stelle bleibt, Drums halten mit an)
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('3nps-edfull','0')")
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
        check('Knopf da, ohne Loop gesperrt', await pg.is_visible('#sfPlay') and await pg.is_disabled('#sfPlay'))
        await pg.click('#tab-looper')
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(2500)
        if await pg.evaluate('!!Looper._ed()'): await pg.click('#edClose')
        await pg.click('#loopDrums'); await pg.wait_for_timeout(300)
        if not await pg.evaluate('Looper.running()'): await pg.click('#loopAll')
        await pg.wait_for_timeout(1200)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(400)
        check('Läuft: Knopf zeigt Pause', 'Pause' in await pg.inner_text('#sfPlay'), await pg.inner_text('#sfPlay'))
        await pg.click('#sfPlay'); await pg.wait_for_timeout(150)
        st = await pg.evaluate("[Looper.running(), Rhythm.on(), Looper.debug().tracks[0].state, Looper.debug().anchor, audioCtx.currentTime*audioCtx.sampleRate, Looper.debug().tracks[0].L]")
        pos0 = (st[4] - st[3]) % st[5]
        check('Pause: Spuren und Drums stehen', not st[0] and not st[1] and st[2] == 'stopped', st[:3])
        check('Knopf zeigt Weiter', 'Weiter' in await pg.inner_text('#sfPlay'))
        await pg.wait_for_timeout(1300)
        await pg.click('#sfPlay'); await pg.wait_for_timeout(150)
        st = await pg.evaluate("[Looper.running(), Rhythm.on(), Looper.debug().tracks[0].state, Looper.debug().anchor, audioCtx.currentTime*audioCtx.sampleRate, Looper.debug().tracks[0].L, audioCtx.sampleRate]")
        pos1 = (st[4] - st[3]) % st[5]
        check('Weiter: Spuren und Drums laufen', st[0] and st[1] and st[2] == 'playing', st[:3])
        dd = abs(pos1 - pos0); d = min(dd, st[5] - dd) / st[6]
        check('… an derselben Stelle (nicht von vorn)', d < 0.35, round(d, 3))
        check('Drone bleibt aus (lief vorher nicht)', not await pg.evaluate("Looper.debug().drone"))
        # Drone an → Pause → Weiter: Drone läuft wieder
        await pg.click('#tab-looper'); await pg.evaluate("document.getElementById('laneDrone').click()"); await pg.wait_for_timeout(300)
        d1 = await pg.evaluate("Looper.debug().drone")
        await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
        await pg.click('#sfPlay'); await pg.wait_for_timeout(200); d2 = await pg.evaluate("Looper.debug().drone")
        await pg.click('#sfPlay'); await pg.wait_for_timeout(200); d3 = await pg.evaluate("Looper.debug().drone")
        check('Drone an: Pause hält ihn an, Weiter startet ihn wieder', d1 and not d2 and d3, (d1, d2, d3))
        check('Knopf zeigt wieder Pause', 'Pause' in await pg.inner_text('#sfPlay'))
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
