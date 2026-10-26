# v100: Speicher beim wiederholten Laden langer Dateien (Nutzer: App hing nach längerem Testen mit vielen geladenen Dateien)
# Lädt 3 × 4-min-Lieder (48 kHz Stereo) abwechselnd in Spur 1/2 – 12 Ladevorgänge, dazwischen Mitsingen/Improvisation/Mastering öffnen,
# misst nach jeder Runde den Speicher des Seitenprozesses (nach erzwungener Speicherbereinigung).
import asyncio, subprocess, sys, os, re, threading, time
from playwright.async_api import async_playwright
SP = '/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/stress/'
U = 'http://localhost:8765/index.html'
ROUNDS = int(os.environ.get('ROUNDS', '12'))
def rss_mb():
    out = subprocess.run(['ps', '-eo', 'rss,args'], capture_output=True, text=True).stdout
    return max([int(l.split()[0]) for l in out.splitlines()[1:] if '--type=renderer' in l] or [0]) / 1024
PEAK = [0]
def poll():
    while True:
        PEAK[0] = max(PEAK[0], rss_mb()); time.sleep(0.1)
threading.Thread(target=poll, daemon=True).start()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(1000)
        await pg.select_option('#loopCountIn', '0')
        await pg.evaluate("window.__lt=0;new PerformanceObserver(l=>l.getEntries().forEach(e=>{window.__lt=Math.max(window.__lt,e.duration)})).observe({entryTypes:['longtask']})")
        cdp = await pg.context.new_cdp_session(pg)
        res = []
        for k in range(ROUNDS):
            tr = k % 2; f = SP + 'song%d.wav' % (k % 3 + 1)
            await pg.click('#tab-looper')
            await pg.set_input_files('#file%d' % tr, f)
            for _ in range(240):
                await pg.wait_for_timeout(250)
                if await pg.is_visible('#impDlg'):
                    if os.environ.get('KEEP') and await pg.is_visible('#impClear'): await pg.set_checked('#impClear', False)
                    await pg.click('#impOk')
                st = await pg.inner_text('#loopStatus')
                if st.startswith('Spur %d:' % (tr + 1)): break
            for tab in ['solo', 'singen', 'looper']:
                await pg.click('#tab-' + tab); await pg.wait_for_timeout(600)
            await pg.evaluate("window.gc && gc()"); await pg.wait_for_timeout(500); await pg.evaluate("window.gc && gc()")
            h = await cdp.send('Runtime.getHeapUsage')
            m = rss_mb(); res.append(m); lt = await pg.evaluate('window.__lt'); await pg.evaluate('window.__lt=0'); pk = PEAK[0]; PEAK[0] = 0
            print('Runde %2d: Spur %d  RSS %6.0f MB  Spitze %6.0f MB  längste Blockade %5.0f ms' % (k + 1, tr + 1, m, pk, lt), flush=True)
        grow = res[-1] - res[3]
        print('Zuwachs Runde 4 → %d: %.0f MB' % (ROUNDS, grow))
        print('FEHLER' if grow > 150 else 'OK', 'Speicher bleibt stabil beim wiederholten Laden')
        print('Skriptfehler:', errs[:3])
        await b.close()
asyncio.run(main())
