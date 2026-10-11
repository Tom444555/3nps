# v50: Anzeige des Eingangsgeräts über „Eingang öffnen“; Zuschneiden-Block über „Bearbeiten“
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('3nps-edfull','0')")
        await pg.goto(U); await pg.wait_for_timeout(600)
        check('Anzeige vor dem Öffnen', (await pg.inner_text('#inDevName')) == 'Kein Eingang offen')
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        nm = await pg.inner_text('#inDevName'); kd = await pg.inner_text('#inDevKind')
        check('Gerätename nach dem Öffnen', nm and nm != 'Kein Eingang offen', nm)
        check('Art/Kanäle angezeigt', 'mono' in kd.lower() or 'stereo' in kd.lower(), kd)
        check('Grüner Punkt an', 'on' in (await pg.get_attribute('#inDev', 'class')))
        box = await pg.locator('#inDev').bounding_box(); mb = await pg.locator('#loopMonitor').bounding_box()
        check('Anzeige liegt über „Eingang offen“', box['y'] + box['height'] <= mb['y'] + 1, (box['y'], mb['y']))
        await pg.locator('.meter-field').screenshot(path='/tmp/claude-0/v50_in.png')
        kinds = await pg.evaluate("""[ 'Spark LIVE', 'USB Audio CODEC', 'iPad Mikrofon', 'AirPods Pro', 'Reactor 50' ].map(x => { const m = document.createElement('x'); return x })""")
        await pg.evaluate("Looper._micDrop()"); await pg.wait_for_timeout(150)
        check('Nach dem Schließen wieder „Kein Eingang offen“', (await pg.inner_text('#inDevName')) == 'Kein Eingang offen')
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(2500)
        if not await pg.evaluate('!!Looper._ed()'): await pg.click('#edit0'); await pg.wait_for_timeout(400)
        yt = (await pg.locator('#edTrim').bounding_box())['y']; ye = (await pg.locator('#edCopy').bounding_box())['y']
        check('Zuschneiden steht über Bearbeiten', yt < ye, (yt, ye))
        await pg.locator('#loopEditor').screenshot(path='/tmp/claude-0/v50_ed.png')
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
