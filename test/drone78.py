# Neue Drones: starten, laufen, Ausgang hörbar, Tonart wechseln, Knoten nach dem Stoppen aufgeräumt
import asyncio, base64
import numpy as np
from playwright.async_api import async_playwright
PATCH = open('/home/claude/3nps/test/firsthit.py').read().split('PATCH = r"""')[1].split('"""')[0]
CONN = r"""(() => { window.__ac = { conn: 0 }; const C = AudioNode.prototype.connect, D = AudioNode.prototype.disconnect;
  AudioNode.prototype.connect = function (d, ...a) { this.__nc = (this.__nc || 0) + 1; window.__ac.conn++; return C.call(this, d, ...a); };
  AudioNode.prototype.disconnect = function (...a) { if (!a.length) { window.__ac.conn -= (this.__nc || 0); this.__nc = 0; } else if (this.__nc) { this.__nc--; window.__ac.conn--; } return D.apply(this, a); }; })();"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(PATCH); await pg.add_init_script(CONN)
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(600)
        await pg.click('#tab-looper'); await pg.evaluate("ensureAudio(); ensureMasterBus(); __rec()")
        c00 = await pg.evaluate('window.__ac.conn')
        for st in __import__('sys').argv[1:] or ['v7', 'v8']:
            await pg.select_option('#laneDroneStyle', st); await pg.click('#laneDrone'); await pg.wait_for_timeout(9000)
            stat = await pg.inner_text('#laneDroneStatus'); c1 = await pg.evaluate('window.__ac.conn')
            await pg.select_option('#laneDroneRoot', 'D'); await pg.wait_for_timeout(9000)
            c2 = await pg.evaluate('window.__ac.conn')
            await pg.click('#laneDrone'); await pg.wait_for_timeout(2500)
            c3 = await pg.evaluate('window.__ac.conn')
            d = await pg.evaluate('__dump()'); x = np.frombuffer(base64.b64decode(d['b64']), dtype=np.float32)
            await pg.evaluate("window.__chunks.length = 0")
            seg = x[-int(d['sr'] * 16):-int(d['sr'] * 3)] if len(x) > d['sr'] * 20 else x
            rms = float(np.sqrt(np.mean(seg ** 2))); pk = float(np.max(np.abs(seg)))
            print(f"{st}: {stat} | Pegel RMS {rms:.3f}, Spitze {pk:.3f} | Verbindungen an {c1 - c00}, nach 9 s {c2 - c00}, nach Stopp {c3 - c00} | Fehler {errs[:2]}")
        await b.close()
asyncio.run(main())
