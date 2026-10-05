# Erster Drum-Schlag: Ausgang mitschneiden und Ersatzstimmen zählen
# Szenario A: Drums sind das allererste, was angetippt wird. B: Drums erst nach 4 s.
import asyncio, sys, json, base64
import numpy as np
from playwright.async_api import async_playwright
O = '/tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/'
PATCH = r"""
window.__fb = 0;
window.addEventListener('load', () => {
  ['playKick', 'playSnare', 'playHihat'].forEach(n => { const f = window[n]; if (typeof f === 'function') window[n] = function () { window.__fb++; return f.apply(this, arguments); }; });
});
window.__rec = function () {
  const ctx = audioCtx, sp = ctx.createScriptProcessor(2048, 2, 2), chunks = [];
  sp.onaudioprocess = e => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
  window.masterOut.connect(sp); sp.connect(ctx.destination);
  window.__chunks = chunks; window.__recT0 = ctx.currentTime;
};
window.__dump = function () { const n = window.__chunks.reduce((a, c) => a + c.length, 0), o = new Float32Array(n); let p = 0; for (const c of window.__chunks) { o.set(c, p); p += c.length; }
  let s = ''; const u = new Uint8Array(o.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return { b64: btoa(s), sr: audioCtx.sampleRate }; };
"""
async def scen(p, wait_first, tag):
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(PATCH)
    await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(600)
    if wait_first:
        await pg.click('#tab-looper'); await pg.wait_for_timeout(4000)
    else:
        await pg.evaluate("document.getElementById('tab-looper').click()")
    await pg.evaluate("ensureAudio(); ensureMasterBus(); __rec()")
    await pg.select_option('#loopDrumStyle', 'rock')
    await pg.evaluate("document.getElementById('drumHuman').value = 0")
    await pg.click('#loopDrums'); await pg.wait_for_timeout(5200)
    d = await pg.evaluate('__dump()'); fb = await pg.evaluate('window.__fb'); dbg = await pg.evaluate('Rhythm.debug()')
    await b.close()
    x = np.frombuffer(base64.b64decode(d['b64']), dtype=np.float32); sr = d['sr']
    np.save(O + f'fh_{tag}.npy', x)
    # Schläge finden (Hüllkurve), ersten Takt mit zweitem vergleichen
    on = np.flatnonzero(np.abs(x) > 0.02)
    if not len(on): print(tag, 'kein Ton', errs); return
    s0 = on[0]; bar = int(round(240 / 80 * sr))
    def hf(seg):   # Anteil hoher Frequenzen (> 9 kHz) am ganzen Signal
        f = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; fr = np.fft.rfftfreq(len(seg), 1 / sr)
        return float(f[fr > 9000].sum() / max(1e-12, f.sum()))
    w = int(0.05 * sr)
    first, later = x[s0:s0 + w], x[s0 + bar:s0 + bar + w]
    jump = lambda a: float(np.max(np.abs(np.diff(a))))
    print(f"{tag}: Ersatzstimmen {fb} | erster Schlag nach {s0 / sr:.3f} s | Spitze erster {np.max(np.abs(first)):.3f} vs. Takt 2 {np.max(np.abs(later)):.3f} | Höhenanteil {hf(first):.4f} vs. {hf(later):.4f} | größter Sprung {jump(first):.3f} vs. {jump(later):.3f} | spät {dbg.get('late')} | Fehler {errs[:1]}")
async def main():
    async with async_playwright() as p:
        import sys
        for k in range(int(sys.argv[1]) if len(sys.argv) > 1 else 1):
            await scen(p, False, f'A_sofort{k}')
            await scen(p, True, f'B_spaeter{k}')
asyncio.run(main())
