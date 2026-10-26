# v112: Mastering zieht vom Looper ins Studio – Datei messen (gegen ffmpeg), mastern, WAV prüfen, Projekt-Mix als Quelle,
# Looper ohne Reiter, Song-Export „gemastert“ im Looper geht weiter (window.Master)
import asyncio, subprocess, re, sys, os
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; SP = '/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/m1/'; os.makedirs(SP, exist_ok=True)
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
def ff(f):
    s = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = s[s.rfind('Summary:'):]; g = lambda r: float(re.search(r, s).group(1))
    return {'I': g(r'I:\s+(-?[\d.]+) LUFS'), 'TP': g(r'Peak:\s+(-?[\d.]+) dBFS')}
SRC = SP + 'src48.wav'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', T + 'corpus/ballad_drums_80.wav', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', SRC])
async def wait_status(pg, word, n=120):
    for _ in range(n):
        await pg.wait_for_timeout(250)
        if word in await pg.inner_text('#msStatus'): return True
    return False
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, accept_downloads=True, bypass_csp=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(900)
        check('Looper: kein Reiter „Mastering“ mehr', await pg.locator('#tab-master').count() == 0 and await pg.locator('#panel-master').count() == 0)
        check('Looper: Mastering-Rechenteil für den Song-Export bleibt', await pg.evaluate("!!(window.Master && Master.normalize && Master.target)"))
        await pg.goto('http://localhost:8765/studio/'); await pg.wait_for_timeout(1200)
        await pg.click('#views [data-v="mst"]'); await pg.wait_for_timeout(300)
        check('Studio: Ansicht „Mastering“', await pg.is_visible('#panel-master') and await pg.is_visible('#msLoad'))
        opts = await pg.evaluate("[...document.querySelectorAll('#msSrc option')].map(o=>o.value)")
        check('Quellen: Projekt-Mix, Cycle, Datei', opts == ['mix', 'cycle', 'file'], opts)
        await pg.select_option('#msSrc', 'file'); await pg.select_option('#msTarget', 'stream')
        await pg.set_input_files('#msFile', SRC)
        await wait_status(pg, 'Gemessen')
        ref = ff(SRC); bef = await pg.evaluate("Master.cur().before")
        check('Messung = ffmpeg (I ±0,1 LU, TP ±0,2 dB)', abs(bef['I'] - ref['I']) <= 0.1 and abs(bef['TP'] - ref['TP']) <= 0.2, (round(bef['I'], 2), round(bef['TP'], 2), ref))
        await pg.click('#msRun'); await wait_status(pg, 'Fertig')
        async with pg.expect_download(timeout=60000) as dl:
            await pg.click('#msSave')
        f = await (await dl.value).path(); out = ff(f)
        check('gemasterte WAV: −14 LUFS, ≤ −1 dBTP (ffmpeg)', abs(out['I'] + 14) <= 0.3 and out['TP'] <= -0.8, out)
        await pg.click('#msPlay'); await pg.wait_for_timeout(500); pl = await pg.evaluate("Master.playing()")
        await pg.click('#views [data-v="arr"]'); await pg.wait_for_timeout(200)
        check('Vorhören läuft und stoppt beim Ansichtswechsel', pl and not await pg.evaluate("Master.playing()"))
        # Projekt-Mix als Quelle
        await pg.evaluate("""(async () => { const sr = Engine.sr(), n = sr * 6, l = new Float32Array(n); for (let i = 0; i < n; i++) l[i] = Math.sin(i * 2 * Math.PI * 220 / sr) * 0.1 * (1 + Math.sin(i / sr * 3));
          const m = await SDB.putAudio('Ton', sr, l, null); Proj.change('regions', q => { const t = Proj.track('audio', 'Ton'); q.tracks.push(t); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: m.id, start: 0, offset: 0, len: n, gain: 0, fi: 0, fo: 0, name: 'Ton' }); }); Engine.dirty(true); })()""")
        await pg.click('#views [data-v="mst"]'); await pg.select_option('#msSrc', 'mix'); await pg.click('#msLoad'); await wait_status(pg, 'Gemessen')
        c = await pg.evaluate("({n: Master.cur().name, I: Master.cur().before.I, secs: Master.cur().chs[0].length / Master.cur().sr})")
        check('Projekt-Mix gerendert und gemessen', c['I'] < -15 and 6 <= c['secs'] <= 8, c)
        await pg.select_option('#msSrc', 'cycle'); await pg.click('#msLoad'); await pg.wait_for_timeout(500)
        check('Cycle ohne Bereich: klare Meldung', 'Cycle' in await pg.inner_text('#msStatus'))
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
