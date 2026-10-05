# Langlauf-Test für Drum-Aussetzer: offene Audio-Verbindungen (Leck) und verspätete Schläge bei Hängern der Oberfläche
import asyncio, sys
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
PATCH = r"""
(() => {
  window.__ac = { conn: 0, late: 0, drumStarts: 0 };
  const C = AudioNode.prototype.connect, D = AudioNode.prototype.disconnect;
  AudioNode.prototype.connect = function (d, ...a) { this.__nc = (this.__nc || 0) + 1; window.__ac.conn++; return C.call(this, d, ...a); };
  AudioNode.prototype.disconnect = function (...a) { if (!a.length) { window.__ac.conn -= (this.__nc || 0); this.__nc = 0; } else if (this.__nc) { this.__nc--; window.__ac.conn--; } return D.apply(this, a); };
  const S = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when, ...a) {
    if (this.buffer && this.buffer.duration < 3 && !this.loop) { window.__ac.drumStarts++; if (when && when < this.context.currentTime - 0.002) window.__ac.late++; if (when && Math.abs(when - this.context.currentTime) < 0.0015) window.__ac.late++; }
    return S.call(this, when, ...a);
  };
})();
"""
async def run(port, secs, stalls):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(PATCH)
        await pg.goto(f'http://localhost:{port}/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        for slot, f in [(0, 'stereo/rock_120_2T_st.wav'), (1, 'loops/guitar_only_95_4T.wav')]:
            await pg.set_input_files(f'#file{slot}', T + f)
            for _ in range(60):
                await pg.wait_for_timeout(250)
                if await pg.is_visible('#impDlg'): await pg.click('#impOk')
                if (await pg.inner_text('#loopStatus')).startswith(f'Spur {slot + 1}:'): break
        await pg.select_option('#loopDrumStyle', 'kc_shuffle'); await pg.click('#loopDrums')
        await pg.select_option('#laneDroneStyle', 'v3'); await pg.click('#laneDrone')
        await pg.wait_for_timeout(2000)
        c0 = await pg.evaluate('({...window.__ac})')
        if stalls:   # Hänger der Oberfläche simulieren: alle 1,5 s 240 ms blockiert
            await pg.evaluate("setInterval(() => { const t = performance.now(); while (performance.now() - t < 240) {} }, 1500)")
        await pg.wait_for_timeout(secs * 1000)
        c1 = await pg.evaluate('({...window.__ac})')
        c1['rl'] = await pg.evaluate("(Rhythm.debug().late || 0)")
        await b.close()
        return c0, c1, errs

async def main():
    secs = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    for name, port in [('vorher (v16.1)', 8766), ('nachher', 8765)]:
        c0, c1, errs = await run(port, secs, False)
        grow = c1['conn'] - c0['conn']; hits = c1['drumStarts'] - c0['drumStarts']
        print(f"{name:15s} Leck: offene Verbindungen {c0['conn']} → {c1['conn']} (+{grow} in {secs} s, {grow / max(1, hits):.2f} je Schlag) | Schläge {hits} | Fehler {errs[:1]}")
        c0, c1, errs = await run(port, secs, True)
        hits = c1['drumStarts'] - c0['drumStarts']; late = c1['late'] - c0['late']
        print(f"{name:15s} mit Hängern: zu spät {late} von {hits} Schlägen ({100 * late / max(1, hits):.1f} %) · Zähler im Taktgeber: {c1['rl']}")
asyncio.run(main())
