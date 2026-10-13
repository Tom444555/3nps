# v64: Texterkennung offline – Modell im Speicher „asr-1“, übersteht App-Updates (Pages-Nachbau Port 8790)
import asyncio, re
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; BASE = 'http://localhost:8790/3nps/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
REG = "navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => true)"
async def load(pg, f):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', f)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if re.match(r'^Spur 1:', await pg.inner_text('#loopStatus')): break
async def run(pg):
    await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
    if not await pg.is_visible('#sgEdit'): await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
    await pg.select_option('#sgLang', 'de'); await pg.evaluate("window.confirm=()=>true")
    await pg.click('#sgAuto')
    for _ in range(400):
        await pg.wait_for_timeout(500)
        r = await pg.evaluate("Sing.rec()")
        if not r['busy']: return r
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); ctx = await b.new_context(service_workers='allow'); pg = await ctx.new_page()
        await pg.goto(BASE); await pg.evaluate(REG); await pg.reload(); await pg.wait_for_timeout(1200)
        await load(pg, T + 'sing/lied_de.wav'); r = await run(pg)
        keys = await pg.evaluate("caches.keys()"); n = await pg.evaluate("caches.open('asr-1').then(c=>c.keys()).then(k=>k.length)")
        check('online: erkannt, Modell im Speicher „asr-1“', 'erkannt' in r['msg'] and n >= 8, (r['msg'][:40], keys, n))
        # App-Update simulieren: neuer Service Worker mit anderer Version → asr-1 muss bleiben
        sw = open('/tmp/claude-0/pages/3nps/sw.js').read(); open('/tmp/claude-0/pages/3nps/sw.js', 'w').write(sw.replace("'3nps-v64'", "'3nps-v64x'"))
        await pg.goto(BASE); await pg.wait_for_timeout(1500); await pg.goto(BASE); await pg.wait_for_timeout(1500)
        keys2 = await pg.evaluate("caches.keys()")
        open('/tmp/claude-0/pages/3nps/sw.js', 'w').write(sw)
        check('Update: alter App-Speicher weg, Modellspeicher bleibt', 'asr-1' in keys2 and '3nps-v64x' in keys2 and '3nps-v64' not in keys2, keys2)
        await ctx.set_offline(True)
        await pg.goto(BASE); await pg.wait_for_timeout(1000)
        await load(pg, T + 'sing/lied_de.wav'); r2 = await run(pg)
        check('offline: Erkennung läuft aus dem Speicher', 'erkannt' in r2['msg'], r2['msg'][:70])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
