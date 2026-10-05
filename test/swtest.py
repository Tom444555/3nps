# Haupt- und stabile Fassung nebeneinander: getrennte Offline-Speicher, keine gegenseitige Löschung, beide offline nutzbar
import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8790/3nps/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
REG = "navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => true)"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(); pg = await ctx.new_page()
        await pg.goto(BASE); await pg.evaluate(REG); await pg.reload(); await pg.wait_for_timeout(1500)
        k1 = await pg.evaluate("caches.keys()")
        await pg.goto(BASE + 'stabil/'); await pg.evaluate(REG); await pg.reload(); await pg.wait_for_timeout(1500)
        k2 = await pg.evaluate("caches.keys()")
        check('Stabile Fassung: eigener Speicher, Hauptspeicher bleibt', 'stabil-v24' in k2 and any(k.startswith('3nps-') for k in k2), k2)
        check('Stabile Fassung zeigt „v24 stabil“', 'v24 stabil' in await pg.inner_text('.brand'))
        await pg.goto(BASE); await pg.wait_for_timeout(1200)
        k3 = await pg.evaluate("caches.keys()")
        check('Hauptfassung löscht den stabilen Speicher nicht', 'stabil-v24' in k3, k3)
        await ctx.set_offline(True)
        await pg.goto(BASE); await pg.wait_for_timeout(800)
        t1 = await pg.title(); br1 = await pg.inner_text('.brand')
        await pg.goto(BASE + 'stabil/'); await pg.wait_for_timeout(800)
        t2 = await pg.title(); br2 = await pg.inner_text('.brand')
        check('Offline: Hauptfassung startet als Hauptfassung', t1 == 'Looper' and 'stabil' not in br1, br1)
        check('Offline: stabile Fassung startet als stabile', t2 == 'Looper stabil' and 'stabil' in br2, br2)
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
