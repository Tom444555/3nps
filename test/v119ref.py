# v119: Klang-Referenz für Drums und Drone (Pegel + Terzband-Spektrum, beide Kanäle).
# Aufruf ohne Argument: misst die aktuelle App und gibt JSON aus; mit „save“: schreibt test/v119ref.json (Stand vor v119 = v118).
import asyncio, base64, json, sys
import numpy as np
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
SEED = r"""(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();"""
REC = r"""window.__rec2 = function () { const ctx = audioCtx, sp = ctx.createScriptProcessor(4096, 2, 2), L = [], R = [];
  sp.onaudioprocess = e => { L.push(new Float32Array(e.inputBuffer.getChannelData(0))); R.push(new Float32Array(e.inputBuffer.getChannelData(1))); };
  window.masterOut.connect(sp); sp.connect(ctx.destination); window.__r2 = { L, R, sp }; };
window.__stop2 = function () { const r = window.__r2; try { window.masterOut.disconnect(r.sp); r.sp.disconnect(); } catch (e) {}
  const cat = a => { const n = a.reduce((s, c) => s + c.length, 0), o = new Float32Array(n); let p = 0; for (const c of a) { o.set(c, p); p += c.length; } return o; };
  const enc = o => { let s = ''; const u = new Uint8Array(o.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  return { L: enc(cat(r.L)), R: enc(cat(r.R)), sr: audioCtx.sampleRate }; };"""
BANDS = [31.5 * 2 ** (k / 3) for k in range(30)]   # 31,5 Hz … 16 kHz
def analyse(d):
    sr = d['sr']; out = {}
    for ch in ('L', 'R'):
        x = np.frombuffer(base64.b64decode(d[ch]), dtype=np.float32).astype(np.float64)
        n = 8192; win = np.hanning(n); P = None; k = 0
        for i in range(0, len(x) - n, n // 2):
            f = np.abs(np.fft.rfft(x[i:i + n] * win)) ** 2; P = f if P is None else P + f; k += 1
        P /= max(1, k); fr = np.fft.rfftfreq(n, 1 / sr)
        bands = []
        for c in BANDS:
            m = (fr >= c / 2 ** (1 / 6)) & (fr < c * 2 ** (1 / 6)); bands.append(float(10 * np.log10(P[m].sum() + 1e-20)))
        out[ch] = {'rms': float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)), 'peak': float(np.abs(x).max()), 'bands': bands}
    return out
async def capture(p, what):
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = await (await b.new_context(bypass_csp=True)).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(SEED); await pg.add_init_script(REC)
    await pg.goto(U); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.setItem('3nps-limiter','1'); ensureAudio(); const e=document.getElementById('bpm'); e.value='120'; e.dispatchEvent(new Event('input')); 0")
    await pg.wait_for_timeout(500)
    if what == 'drums':
        await pg.evaluate("Rhythm.setOn(true)"); await pg.wait_for_timeout(1500)
        await pg.evaluate("__rec2()"); await pg.wait_for_timeout(12000)
    else:
        await pg.evaluate(f"document.getElementById('droneStyle').value='{what}'; startDrone(); 0"); await pg.wait_for_timeout(16000)
        await pg.evaluate("__rec2()"); await pg.wait_for_timeout(20000)
    d = await pg.evaluate("__stop2()"); await b.close()
    r = analyse(d); r['errs'] = errs[:2]; return r
WHAT = ['drums', 'v1', 'v3', 'v9']
async def main():
    async with async_playwright() as p:
        res = {}
        for w in (sys.argv[2:] if len(sys.argv) > 2 else WHAT): res[w] = await capture(p, w); print(w, round(res[w]['L']['rms'], 2), round(res[w]['R']['rms'], 2), res[w]['errs'], flush=True)
    if len(sys.argv) > 1 and sys.argv[1] == 'save': json.dump(res, open('/home/claude/3nps-src/test/v119ref.json', 'w'), indent=0)
    else: print(json.dumps(res))
asyncio.run(main())
