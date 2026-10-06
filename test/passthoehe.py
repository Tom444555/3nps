# „Was passt“-Box: Höhe bleibt beim Mitlaufen und Anhalten gleich (je Breite), Screenshot
import asyncio, sys
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
TAG = sys.argv[1] if len(sys.argv) > 1 else 'x'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def run(p, w, h):
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    ctx = await b.new_context(viewport={'width': w, 'height': h}); await ctx.grant_permissions(['microphone'])
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
    await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if await pg.evaluate("!!Looper._chords(0)"): break
    if not await pg.evaluate("Looper.debug().tracks[0].state === 'playing'"): await pg.click('#loopAll')
    await pg.wait_for_timeout(800)
    hs = set(); tops = set()
    for k in range(60):
        await pg.wait_for_timeout(150)
        r = await pg.evaluate("(() => { const b = document.getElementById('passtBox').getBoundingClientRect(), t = document.querySelector('.tracks').getBoundingClientRect(); return [Math.round(b.height), Math.round(t.top + scrollY)]; })()")
        hs.add(r[0]); tops.add(r[1])
        if k == 5: await (await pg.query_selector('#passtBox')).screenshot(path=O + f'passt_{TAG}_{w}.png')
    await pg.click('#passtHold'); await pg.wait_for_timeout(400)
    n = await pg.evaluate("document.querySelectorAll('#passtPick [data-i]').length")
    for j in range(n):
        await pg.click(f'#passtPick [data-i] >> nth={j}'); await pg.wait_for_timeout(200)
        hs.add(await pg.evaluate("Math.round(document.getElementById('passtBox').getBoundingClientRect().height)"))
    await (await pg.query_selector('#passtBox')).screenshot(path=O + f'passt_{TAG}_{w}_held.png')
    await pg.click('#passtHold'); await pg.wait_for_timeout(600)
    # Loop stoppen → „Gestoppt“
    await pg.click('#loopAll'); await pg.wait_for_timeout(600)
    hs.add(await pg.evaluate("Math.round(document.getElementById('passtBox').getBoundingClientRect().height)"))
    check(f'{w}px: Höhe fest', len(hs) == 1 and len(tops) == 1, f'Höhen {sorted(hs)} · Spuren-Lage {sorted(tops)}')
    check(f'{w}px: keine Fehler', not errs, errs[:2])
    await b.close()
async def main():
    async with async_playwright() as p:
        for w, h in [(1024, 1366), (1366, 1024), (768, 1024), (390, 844)]: await run(p, w, h)
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
