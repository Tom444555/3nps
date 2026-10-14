# v81: Gesangsspur dazuladen – Versatz erkannt, Stimmkurve nur aus dem Gesang (genau die Silben), gespeichert und beim nächsten Laden wieder da, entfernen
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
SYL = json.load(open(T + 'sing/silben.json'))
async def load(pg):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'sing/silben.wav')
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
    if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
    await pg.click('#tab-solo'); await pg.wait_for_timeout(700)
async def env(pg):
    await pg.evaluate("Sing.voiceEnv()")
    for _ in range(60):
        e = await pg.evaluate("Sing.prec().env")
        if e: return e
        await pg.wait_for_timeout(250)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(800)
        await load(pg)
        e0 = await env(pg); n0 = len(e0['on'])
        await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        check('Karte: „Gesangsspur dazuladen“', await pg.is_visible('#sgVoxAdd'))
        await pg.set_input_files('#sgVoxFile', T + 'sing/silben_vox.wav')
        for _ in range(40):
            await pg.wait_for_timeout(250)
            if await pg.evaluate("Sing.vox()"): break
        v = await pg.evaluate("Sing.vox()")
        check('Gesangsspur geladen, Versatz ~40 ms erkannt', v and abs(v['off'] / v['sr'] - 0.04) < 0.006, v and round(v['off'] / v['sr'], 4))
        e1 = await env(pg); on = e1['on']
        hit = sum(1 for t in SYL if any(abs(o - t) <= 0.012 for o in on))
        check('Stimmkurve aus der Gesangsspur: genau die Silben, keine Begleit-Anschläge', hit == len(SYL) and len(on) == len(SYL), (hit, len(on), n0))
        check('Karte zeigt Name und Versatz', 'silben_vox.wav' in await pg.inner_text('#sgEdit') and 'ms' in await pg.inner_text('#sgEdit .sg-vox'))
        # Neustart: Gesangsspur kommt aus dem Speicher zurück
        await pg.reload(); await pg.wait_for_timeout(900); await load(pg)
        for _ in range(40):
            await pg.wait_for_timeout(250)
            if await pg.evaluate("Sing.vox()"): break
        check('nach Neustart wieder da (gespeichert)', await pg.evaluate("Sing.vox()") is not None)
        await pg.click('#sgToggle'); await pg.wait_for_timeout(300); await pg.click('#sgVoxDel'); await pg.wait_for_timeout(500)
        check('entfernen', await pg.evaluate("Sing.vox()") is None and await pg.evaluate("AppDB.get('meta','vox:'+Sing.source(SoloInfo()).id).then(r=>!!r)") is False)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
