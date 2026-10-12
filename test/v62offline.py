# v62: Start ohne Internet – sofort aus dem Speicher, auch wenn das Netz hängt; Updates kommen beim nächsten Öffnen
import asyncio, sys, time
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8791/3nps/'
import os
HANG = '/tmp/claude-0/pages/HANG'
IDX = '/tmp/claude-0/pages/3nps/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
REG = "navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => true)"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(service_workers='allow'); pg = await ctx.new_page()
        await pg.goto(BASE); await pg.evaluate(REG); await pg.reload(); await pg.wait_for_timeout(1500)
        v = await pg.inner_text('.brand')
        check('online gestartet, Speicher angelegt', 'v62' in v and any(k.startswith('3nps-v62') for k in await pg.evaluate('caches.keys()')), v)
        # 1) richtig offline
        await ctx.set_offline(True)
        t = time.time(); await pg.goto(BASE); await pg.wait_for_selector('.brand'); dt = time.time() - t
        check('offline: startet aus dem Speicher', 'v62' in await pg.inner_text('.brand'), f'{dt:.1f} s')
        await ctx.set_offline(False)
        # 2) Internet hängt (WLAN ohne Verbindung): Seitenanfrage antwortet 20 s lang nicht
        # 3) Update: neue Fassung auf dem Server → 1. Öffnen alt (sofort), 2. Öffnen neu
        src = open(IDX, encoding='utf8').read(); open(IDX, 'w', encoding='utf8').write(src.replace('3nps · v62', '3nps · v62x'))
        await pg.goto(BASE); await pg.wait_for_timeout(1500); a1 = await pg.inner_text('.brand')
        await pg.goto(BASE); await pg.wait_for_timeout(800); a2 = await pg.inner_text('.brand')
        open(IDX, 'w', encoding='utf8').write(src)
        check('Update kommt beim zweiten Öffnen an', 'v62x' not in a1 and 'v62x' in a2, (a1, a2))
        open(HANG, 'w').close()
        try:
            t = time.time(); await pg.goto(BASE, wait_until='domcontentloaded', timeout=15000); await pg.wait_for_selector('.brand', timeout=15000); dt = time.time() - t
            check('hängendes Internet: startet trotzdem sofort (< 3 s)', dt < 3 and 'v62' in await pg.inner_text('.brand'), f'{dt:.1f} s')
        except Exception as e:
            check('hängendes Internet: startet trotzdem sofort (< 3 s)', False, str(e)[:80])
        finally:
            os.remove(HANG)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
