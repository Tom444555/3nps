# Studio S3: Stimmung der echten Instrumente – jede Note gerendert, Grundton per YIN gemessen (±35 Cent). Kontrabass erst ab A1: beim tiefen E ist der Grundton so schwach, dass YIN die Oktave misst.
import asyncio, sys, numpy as np
from playwright.async_api import async_playwright
S = 'http://localhost:8765/studio/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
def f0(x, sr):
    W = 2048; N = 2048; hi = int(sr / 25); x = np.asarray(x, dtype=np.float64)
    d = np.array([np.sum((x[:N] - x[t:t + N]) ** 2) for t in range(hi)]); cm = np.ones(hi); cm[1:] = d[1:] * np.arange(1, hi) / (np.cumsum(d[1:]) + 1e-12)
    lo = int(sr / 2000); k = None
    for t in range(lo, hi - 1):
        if cm[t] < 0.15:
            while t + 1 < hi - 1 and cm[t + 1] < cm[t]: t += 1
            k = t; break
    if k is None: k = lo + int(np.argmin(cm[lo:hi - 1]))
    a, b, c = cm[k - 1], cm[k], cm[k + 1]; den = a - 2 * b + c; p = k + 0.5 * (a - c) / den if den > 0 else k
    return sr / p
TESTS = {'piano': [36, 48, 57, 60, 67, 72, 79], 'strings': [43, 55, 62, 69, 76], 'brass': [41, 50, 58, 65, 72], 'flute': [62, 69, 76, 84], 'organ': [43, 55, 64, 72],
         'harp': [40, 52, 60, 67, 76], 'marimba': [48, 60, 67, 74], 'kbass': [33, 38, 43, 47, 52]}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(bypass_csp=True)).new_page()
        await pg.goto(S); await pg.wait_for_timeout(1200)
        for iid, ms in TESTS.items():
            r = await pg.evaluate("""(async ([id, ms]) => { await Inst.load(id); const sr = Engine.sr(), out = [];
              for (const m of ms) { const oc = new OfflineAudioContext(1, sr * 1.2, sr); Inst.voice(oc, oc.destination, id, m, 100, 0, 1.1); const b = await oc.startRendering(); out.push(Array.from(b.getChannelData(0).slice(Math.round(sr * 0.35), Math.round(sr * 0.35) + 6000))); }
              return { sr, out }; })""", [iid, ms])
            bad = []
            for m, x in zip(ms, r['out']):
                f = f0(x, r['sr']); want = 440 * 2 ** ((m - 69) / 12); cents = 1200 * np.log2(f / want)
                if abs(cents) > 35: bad.append((m, round(f, 1), round(want, 1), int(cents)))
            check('Stimmung %s (%d Töne)' % (iid, len(ms)), not bad, bad)
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
