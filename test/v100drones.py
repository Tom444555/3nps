# v100: orchestrale Drones IX–XI starten, klingen (Pegel, Grundton im Spektrum), folgen dem Grundton, stoppen sauber
import asyncio, base64, os
import numpy as np
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
OUT = os.environ.get('OUT', '')
PATCH = open(T + 'firsthit.py').read().split('PATCH = r"""')[1].split('"""')[0]
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
def peakf(x, sr, lo, hi):
    f = np.abs(np.fft.rfft(x * np.hanning(len(x)))); fr = np.fft.rfftfreq(len(x), 1 / sr); m = (fr > lo) & (fr < hi)
    return float(fr[m][np.argmax(f[m])])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(PATCH); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.click('#tab-griffbrett'); await pg.select_option('#root', 'A')
        for st, name in [('v9', 'Heldensaga'), ('v10', 'Kathedrale'), ('v11', 'Schlachtfeld')]:
            await pg.select_option('#droneStyle', st)
            await pg.evaluate("ensureAudio(); ensureMasterBus(); __rec()")
            await pg.click('#droneBtn'); await pg.wait_for_timeout(16000 if st != 'v11' else 21000)
            d = await pg.evaluate('__dump()'); x = np.frombuffer(base64.b64decode(d['b64']), dtype=np.float32); sr = d['sr']
            seg = x[int(9 * sr):]
            rms = float(np.sqrt(np.mean(seg ** 2))); pk = float(np.abs(seg).max())
            f0 = peakf(seg, sr, 40, 130)
            ok_f = any(abs(f0 - a) / a < 0.03 for a in (55, 110))   # A1/A2
            status = await pg.inner_text('#droneStatus')
            check('%s: klingt (Pegel %.3f, Spitze %.2f), Grundton A im Bass (%.1f Hz), Status' % (name, rms, pk, f0), rms > 0.01 and pk < 1.0 and ok_f and name.split()[0][:6] in status, status)
            if OUT:
                import subprocess; y = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(sr), '-ac', '1', '-i', '-', '-b:a', '160k', OUT + 'drone-%s.mp3' % st], input=y, check=True)
            if st == 'v11': check('Schlachtfeld: Hornruf mit echtem Horn (Aufnahme geladen)', await pg.evaluate('window.__hornReal||0') >= 1, await pg.evaluate('window.__hornReal||0'))
            await pg.click('#droneBtn'); await pg.wait_for_timeout(1800)
            check('%s: stoppt' % name, 'Aus' in await pg.inner_text('#droneStatus'))
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
