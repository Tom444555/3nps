// v97 Mastering M1: Lautheitsmessung nach ITU-R BS.1770-4 / EBU R128 (LUFS, LRA, True Peak) und True-Peak-Limiter.
// Reine Funktionen ohne DOM – laufen im Worker (per toString eingebettet) und in Node-Tests. Eigene DSP, kein fremder Code.

function mdKCoeffs(sr) {
  // Vorfilter (Hochregal ~1,68 kHz, +4 dB) und RLB-Hochpass (~38 Hz) für beliebige Abtastrate (bilineare Transformation)
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / sr), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416), a0 = 1 + K / Q + K * K;
  const pb = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], pa = [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / sr); a0 = 1 + K / Q + K * K;
  const ra = [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  return { pb, pa, ra };
}

// Interpolationsfilter für True Peak: 4-fach, ungerade Länge (Nyquist-Filter → Phase 0 = Originalwert), Kaiser-Fenster
function mdTpFilter(taps) {
  const T = taps || 48, N = 4 * T + 1, c = (N - 1) / 2, beta = 8, h = new Float64Array(N);
  const I0 = x => { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; } return s; };
  for (let i = 0; i < N; i++) {
    const x = (i - c) / 4, sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x), r = (i - c) / c;
    h[i] = sinc * I0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / I0(beta);
  }
  // Phasen 1..3 als Koeffizienten über die Originalwerte x[n-T+1 .. n+T]
  const ph = [];
  for (let p = 1; p < 4; p++) {
    const k = []; for (let j = -T + 1; j <= T; j++) { const idx = c + p - 4 * j; k.push(idx >= 0 && idx < N ? h[idx] : 0); }
    let s = 0; k.forEach(v => s += v); ph.push(Float64Array.from(k.map(v => v / s)));   // DC-Verstärkung 1 je Phase
  }
  let S = 1; ph.forEach(k => { let a = 0; k.forEach(v => a += Math.abs(v)); if (a > S) S = a; });   // obere Schranke Zwischenwert/Fenstermaximum
  return { T, ph, S };
}

// True-Peak eines Kanals ab Index a bis e (exklusiv) in out[i-a] (Maximum aus Abtastwert und den 3 Zwischenwerten bis i+1).
// thr: Stellen, deren Fenster sicher unter thr bleibt (Fenstermaximum × S ≤ thr), werden nur grob (Abtastwerte) bestimmt – schnell.
function mdTpRun(x, a, e, F, out, thr) {
  const T = F.T, n = x.length, p1 = F.ph[0], p2 = F.ph[1], p3 = F.ph[2], L2 = 2 * T, B = L2, lim = (thr || 0) / F.S;
  const b0 = Math.floor(Math.max(0, a - T + 1) / B), b1 = Math.floor(Math.min(n - 1, e + T) / B), bm = new Float32Array(b1 - b0 + 1);
  for (let k = b0; k <= b1; k++) { let m = 0; const z = Math.min(n, (k + 1) * B); for (let i = k * B; i < z; i++) { const v = x[i] < 0 ? -x[i] : x[i]; if (v > m) m = v; } bm[k - b0] = m; }
  for (let i = a; i < e; i++) {
    let m = Math.abs(x[i]);
    if (i + 1 < n) { const nx = Math.abs(x[i + 1]); if (nx > m) m = nx; }
    const b = i - T + 1;
    if (lim > 0) { const k1 = Math.floor(Math.max(0, b) / B) - b0, k2 = Math.floor(Math.min(n - 1, i + T) / B) - b0, wm = bm[k1] > bm[k2] ? bm[k1] : bm[k2]; if (wm <= lim) { out[i - a] = m; continue; } }
    let s1 = 0, s2 = 0, s3 = 0;
    if (b >= 0 && b + L2 <= n) for (let j = 0; j < L2; j++) { const v = x[b + j]; s1 += v * p1[j]; s2 += v * p2[j]; s3 += v * p3[j]; }
    else for (let j = 0; j < L2; j++) { const k = b + j; if (k < 0 || k >= n) continue; const v = x[k]; s1 += v * p1[j]; s2 += v * p2[j]; s3 += v * p3[j]; }
    s1 = Math.abs(s1); s2 = Math.abs(s2); s3 = Math.abs(s3);
    if (s1 > m) m = s1; if (s2 > m) m = s2; if (s3 > m) m = s3;
    out[i - a] = m;
  }
}

// Messung: chs = [L, R] oder [M]; liefert I (LUFS), LRA (LU), TP (dBTP), Spitze (dBFS), M/S max, PLR
function mdMeasure(chs, sr, opts) {
  opts = opts || {};
  const K = mdKCoeffs(sr), n = chs[0].length, hop = Math.round(sr / 10), nb = Math.floor(n / hop), sub = new Float64Array(nb);
  for (const x of chs) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, acc = 0, bi = 0, cnt = 0;
    const { pb, pa, ra } = K;
    for (let i = 0; i < n; i++) {
      const v = x[i], y = pb[0] * v + pb[1] * x1 + pb[2] * x2 - pa[0] * y1 - pa[1] * y2; x2 = x1; x1 = v;
      const z = y - 2 * y1 + y2 - ra[0] * z1 - ra[1] * z2; y2 = y1; y1 = y; z2 = z1; z1 = z;
      acc += z * z;
      if (++cnt === hop) { if (bi < nb) sub[bi] += acc; bi++; acc = 0; cnt = 0; }
    }
  }
  const L = e => e > 0 ? -0.691 + 10 * Math.log10(e) : -Infinity;
  const blocks = (w) => { const out = []; let s = 0; for (let i = 0; i < nb; i++) { s += sub[i]; if (i >= w) s -= sub[i - w]; if (i >= w - 1) out.push(s / (w * hop)); } return out; };
  const mom = blocks(4), st = blocks(30);
  // integrierte Lautheit: absolutes (−70) und relatives (−10 LU) Tor
  const g1 = mom.filter(e => L(e) > -70); let I = -Infinity;
  if (g1.length) { const mean = g1.reduce((a, b) => a + b, 0) / g1.length, thr = L(mean) - 10; const g2 = g1.filter(e => L(e) > thr); if (g2.length) I = L(g2.reduce((a, b) => a + b, 0) / g2.length); }
  // LRA (EBU Tech 3342): Kurzzeitwerte, Tore −70 / −20 LU, 10.–95. Perzentil
  let LRA = 0; const s1 = st.filter(e => L(e) > -70);
  if (s1.length) { const mean = s1.reduce((a, b) => a + b, 0) / s1.length, thr = L(mean) - 20; const v = s1.filter(e => L(e) > thr).map(L).sort((a, b) => a - b);
    if (v.length > 1) { const q = p => { const k = (v.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return v[lo] + (v[hi] - v[lo]) * (k - lo); }; LRA = q(0.95) - q(0.10); } }
  const Mmax = mom.length ? L(Math.max(...mom)) : -Infinity, Smax = st.length ? L(Math.max(...st)) : -Infinity;
  // Spitzen
  let sp = 0, tp = 0;
  const F = opts.F || mdTpFilter(), CH = 65536, buf = new Float32Array(CH);
  for (const x of chs) for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); if (a > sp) sp = a; }
  tp = sp;
  if (!opts.noTp) for (const x of chs) for (let a = 0; a < n; a += CH) { const e = Math.min(n, a + CH); mdTpRun(x, a, e, F, buf, tp); for (let i = 0; i < e - a; i++) if (buf[i] > tp) tp = buf[i]; }
  const db = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
  const TP = opts.noTp ? null : db(tp);
  return { I, LRA, TP, SP: db(sp), Mmax, Smax, PLR: TP != null && isFinite(I) ? TP - I : null, secs: n / sr, sr };
}

// True-Peak-Limiter (offline, nicht kausal → keine Verzögerung): Verstärkung gainDb, Decke ceilDb (dBTP).
// Stereo verkoppelt. Vorschau (lookMs) wird als gleitendes Minimum ±L und Mittelwert ±L umgesetzt → Verstärkung
// ist an jeder Stelle ≤ der benötigten; Release exponentiell. Schreibt in outs (Float32Array je Kanal), liefert max. Reduktion.
function mdLimit(chs, sr, gainDb, ceilDb, opts, outs, prog) {
  opts = opts || {};
  const n = chs[0].length, g = Math.pow(10, gainDb / 20), c = Math.pow(10, ceilDb / 20), L = Math.max(1, Math.round(sr * (opts.lookMs || 2) / 1000));
  const relK = 1 - Math.exp(-1 / (sr * (opts.relMs || 80) / 1000)), F = opts.F || mdTpFilter(), CH = 1 << 16, M = 2 * L + 2;
  const W = CH + 2 * M, tpb = new Float32Array(W), tpc = new Float32Array(W), r = new Float32Array(W), a = new Float32Array(W);
  const sc = chs.map(() => new Float32Array(W + 2 * F.T + 2));
  let gPrev = 1, maxRed = 1, dq = new Int32Array(W), sumBuf = new Float64Array(W + 1);
  for (let s = 0; s < n; s += CH) {
    const e = Math.min(n, s + CH), s0 = Math.max(0, s - M), e0 = Math.min(n, e + M), len = e0 - s0;
    // skalierte Ausschnitte mit Rand für das Interpolationsfilter
    const pad = F.T + 1, s1 = Math.max(0, s0 - pad), e1 = Math.min(n, e0 + pad);
    for (let k = 0; k < chs.length; k++) { const x = chs[k], y = sc[k]; for (let i = s1; i < e1; i++) y[i - s1] = x[i] * g; }
    for (let k = 0; k < chs.length; k++) {
      const y = sc[k].subarray(0, e1 - s1);
      mdTpRun(y, s0 - s1, e0 - s1, F, k ? tpc : tpb, c);
      if (k) for (let i = 0; i < len; i++) if (tpc[i] > tpb[i]) tpb[i] = tpc[i];
    }
    for (let i = 0; i < len; i++) r[i] = tpb[i] > c ? c / tpb[i] : 1;
    // gleitendes Minimum über ±L (Index i in [s0,e0))
    let h = 0, t = 0;
    for (let i = 0, j = 0; i < len; i++) {
      while (j < len && j <= i + L) { while (t > h && r[dq[t - 1]] >= r[j]) t--; dq[t++] = j; j++; }
      while (dq[h] < i - L) h++;
      a[i] = r[dq[h]];
    }
    // Mittelwert über ±L → weiche Absenkung, dann Release
    sumBuf[0] = 0; for (let i = 0; i < len; i++) sumBuf[i + 1] = sumBuf[i] + a[i];
    for (let i = s; i < e; i++) {
      const li = i - s0, lo = Math.max(0, li - L), hi = Math.min(len, li + L + 1);
      let g2 = (sumBuf[hi] - sumBuf[lo]) / (hi - lo); if (g2 > a[li]) { /* Rand: nie über dem Minimum der eigenen Stelle */ }
      const rr = r[li]; if (g2 > rr) g2 = rr;
      let gg = gPrev + (1 - gPrev) * relK; if (gg > g2) gg = g2; gPrev = gg; if (gg < maxRed) maxRed = gg;
      for (let k = 0; k < chs.length; k++) outs[k][i] = chs[k][i] * g * gg;
    }
    if (prog) prog(e / n);
  }
  return { maxRedDb: 20 * Math.log10(maxRed) };
}

// Auf Lautheitsziel bringen: Verstärkung + True-Peak-Limiter, so oft nachregeln, bis das Ziel auf 0,1 LU stimmt
function mdNormalize(chs, sr, target, ceilDb, opts, prog) {
  opts = opts || {};
  const F = mdTpFilter(), before = opts.before || mdMeasure(chs, sr, { F }), outs = chs.map(x => new Float32Array(x.length));
  if (!isFinite(before.I)) return { outs: chs.map(x => x.slice()), before, after: before, gainDb: 0, ceil: ceilDb, red: 0, steps: 0 };
  let gain = target - before.I, ceil = ceilDb, after = null, red = 0, steps = 0;
  const P = (a, b) => prog && (f => prog(a + (b - a) * f));
  for (let it = 0; it < 6; it++) {
    steps++;
    red = mdLimit(chs, sr, gain, ceil, { F, lookMs: opts.lookMs, relMs: opts.relMs }, outs, P(it / 6, (it + 0.7) / 6)).maxRedDb;
    after = mdMeasure(outs, sr, { F });
    const dI = target - after.I, over = after.TP - ceilDb;
    if (over > 0.05) ceil -= over + 0.02;                     // Zwischenwerte nach der Regelung: Decke minimal tiefer
    if (Math.abs(dI) <= 0.05 && over <= 0.05) break;
    if (Math.abs(dI) > 0.05) gain += dI * (red < -0.5 ? 1.15 : 1);   // beim Limitieren wirkt mehr Gain weniger stark
    if (gain > 40) { gain = 40; }
  }
  if (prog) prog(1);
  return { outs, before, after, gainDb: gain, ceil, red, steps };
}
