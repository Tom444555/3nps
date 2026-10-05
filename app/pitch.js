// ---- Tonhöhe erkennen (YIN), für „Mithören“ im Solo Finder ----
// Eingabe: Zeitsignal (Float32Array) und Abtastrate. Rechnet auf halber Rate (schnell genug für das iPad),
// Bereich ca. 70–1400 Hz (tiefes E bis hoch über Bund 20). Ergebnis: { f, midi, cents, conf, rms } oder null.
const Pitch = (() => {
  let work = null, dbuf = null;
  function detect(x, sr, opts) {
    opts = opts || {};
    const half = sr > 30000, s2 = half ? sr / 2 : sr, n0 = half ? x.length >> 1 : x.length;
    if (!work || work.length !== n0) { work = new Float32Array(n0); }
    let mean = 0;
    if (half) for (let i = 0; i < n0; i++) { work[i] = (x[2 * i] + x[2 * i + 1]) * 0.5; mean += work[i]; }
    else for (let i = 0; i < n0; i++) { work[i] = x[i]; mean += work[i]; }
    mean /= n0;
    let e = 0; for (let i = 0; i < n0; i++) { work[i] -= mean; e += work[i] * work[i]; }
    const rms = Math.sqrt(e / n0);
    if (rms < (opts.gate || 0.008)) return null;
    const minLag = Math.max(2, Math.floor(s2 / (opts.fmax || 1400))), maxLag = Math.min(Math.floor(n0 / 2), Math.ceil(s2 / (opts.fmin || 70)));
    const W = n0 - maxLag;
    if (!dbuf || dbuf.length < maxLag + 2) dbuf = new Float32Array(maxLag + 2);
    // Differenzfunktion und kumulativ normierte Differenz (YIN)
    dbuf[0] = 1; let run = 0;
    for (let tau = 1; tau <= maxLag; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const d = work[j] - work[j + tau]; s += d * d; }
      run += s; dbuf[tau] = run > 0 ? s * tau / run : 1;
    }
    const thr = opts.thr || 0.15;
    let tau = -1;
    for (let t = minLag; t < maxLag; t++) {
      if (dbuf[t] < thr) { while (t + 1 < maxLag && dbuf[t + 1] < dbuf[t]) t++; tau = t; break; }
    }
    if (tau < 0) {                                   // kein klares Minimum unter der Schwelle: bestes nehmen, wenn ordentlich
      let b = minLag; for (let t = minLag; t < maxLag; t++) if (dbuf[t] < dbuf[b]) b = t;
      if (dbuf[b] > 0.3) return null; tau = b;
    }
    // parabolische Verfeinerung
    let tt = tau;
    if (tau > 1 && tau < maxLag) { const a = dbuf[tau - 1], b = dbuf[tau], c = dbuf[tau + 1], den = a + c - 2 * b; if (Math.abs(den) > 1e-12) tt = tau + 0.5 * (a - c) / den; }
    const f = s2 / tt, m = 69 + 12 * Math.log2(f / 440), midi = Math.round(m);
    return { f, midi, cents: Math.round((m - midi) * 100), conf: 1 - dbuf[tau], rms };
  }
  return { detect };
})();
if (typeof window !== 'undefined') window.Pitch = Pitch;
if (typeof module !== 'undefined') module.exports = Pitch;
