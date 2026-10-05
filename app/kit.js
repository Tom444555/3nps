// Drum-Kit-Synthese (läuft im Hintergrund-Worker). Erzeugt je Instrument 3 Anschlagstärken × 2 Varianten
// mit physikalisch angelehnten Modellen: Fellmoden mit Tonhöhenabfall, Teppich-Rauschen, Becken aus
// unharmonischen Teiltönen plus gefiltertem Rauschen. Ergebnis: Float32Arrays (mono) je Variante.
function synthKit(sr) {
  // --- Hilfen ---
  function rng(seed) { let a = (seed * 2654435761) >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; }
  const N = sec => Math.round(sec * sr);
  function noise(n, r) { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = r() * 2 - 1; return o; }
  function biquad(x, type, f, q, gainDb) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * (q || 0.707));
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { const A = Math.pow(10, (gainDb || 0) / 40); b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    const o = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    for (let i = 0; i < x.length; i++) { const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; o[i] = y; }
    return o;
  }
  const chain = (x, ...fs) => fs.reduce((a, f) => biquad(a, ...f), x);
  function env(n, attack, taus, amps) {   // Anstieg + Summe von Exponentialabklingen (multiplikativ, schnell)
    const o = new Float32Array(n), na = Math.max(1, N(attack));
    for (let k = 0; k < taus.length; k++) { const d = Math.exp(-1 / (sr * taus[k])); let v = amps[k]; for (let i = 0; i < n; i++) { o[i] += v; v *= d; } }
    for (let i = 0; i < na && i < n; i++) o[i] *= Math.sin(0.5 * Math.PI * i / na);
    return o;
  }
  const mulAdd = (dst, src, g, e) => { for (let i = 0; i < dst.length && i < src.length; i++) dst[i] += src[i] * g * (e ? e[i] : 1); return dst; };
  // Fellmoden: Frequenzverhältnisse, Amplituden, Abklingzeiten, Tonhöhenabfall nach dem Anschlag
  function modes(n, f0, ratios, amps, taus, glide, glideTau, r, attack) {
    const o = new Float32Array(n), na = Math.max(1, N(attack || 0.0008)), gd = Math.exp(-1 / (sr * glideTau));
    for (let k = 0; k < ratios.length; k++) {
      const d = Math.exp(-1 / (sr * taus[k])), base = 2 * Math.PI * f0 * ratios[k] / sr;
      let c = 1, sn = 0, a = amps[k], g = glide, cw = 1, sw = 0;
      { const ph = r() * 0.3; c = Math.cos(ph); sn = Math.sin(ph); }
      const lim = Math.min(n, N(taus[k] * 9));
      for (let i = 0; i < lim; i++) {
        if ((i & 15) === 0) { const w = base * (1 + g); cw = Math.cos(w); sw = Math.sin(w); }
        const c2 = c * cw - sn * sw; sn = c * sw + sn * cw; c = c2;
        o[i] += a * sn * (i < na ? i / na : 1);
        a *= d; g *= gd;
      }
    }
    return o;
  }
  function partials(n, list, r) {   // [freq, amp, tau] – gedämpfte Sinusschwingung per Rekursion
    const o = new Float32Array(n);
    for (const [f, a, tau] of list) {
      const w = 2 * Math.PI * f / sr, R = Math.exp(-1 / (sr * tau)), k1 = 2 * R * Math.cos(w), k2 = R * R;
      const ph = r() * 6.283, lim = Math.min(n, N(tau * 7));
      let y1 = a * Math.sin(ph - w) / R, y2 = a * Math.sin(ph - 2 * w) / (R * R);
      for (let i = 0; i < lim; i++) { const y = k1 * y1 - k2 * y2; o[i] += y; y2 = y1; y1 = y; }
    }
    return o;
  }
  function norm(x, peak) { let m = 1e-9; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v; } const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
  function fadeTail(x, sec) { const n = Math.min(x.length, N(sec)); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; }
  function sat(x, drive) { const d = Math.tanh(drive); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / d; return x; }

  // v: 0 leise, 1 mittel, 2 hart · rr: Variante
  const V = {
    kick(v, r) {
      const n = N(0.75), hard = [0.55, 0.8, 1][v];
      const body = modes(n, 47 + 2 * r(), [1, 1.6, 2.28], [1, 0.22, 0.08], [0.2 + 0.04 * hard, 0.05, 0.03], 0.95 + 0.5 * hard, 0.03, r, 0.0006);
      const beater = chain(noise(N(0.04), r), ['bp', 3200 + 900 * hard, 0.9]);
      const thud = chain(noise(N(0.05), r), ['lp', 900, 0.7]);
      mulAdd(body, beater, 0.35 * hard, env(beater.length, 0.0003, [0.0035], [1]));
      mulAdd(body, thud, 0.45, env(thud.length, 0.0005, [0.009], [1]));
      sat(body, 1.15 + hard * 0.35);
      return fadeTail(norm(body, 0.95), 0.08);
    },
    snare(v, r) {
      const n = N(0.6), hard = [0.45, 0.78, 1][v], f0 = 182 * (1 + (r() - 0.5) * 0.03);
      const head = modes(n, f0, [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.16], [1, 0.62, 0.45, 0.36, 0.3, 0.2, 0.15], [0.15, 0.085, 0.065, 0.055, 0.048, 0.04, 0.035], 0.07, 0.012, r);
      let w = chain(noise(n, r), ['hp', 1700, 0.7], ['hp', 1700, 0.7], ['pk', 5200, 0.9, 5], ['lp', 6000 + 7000 * hard, 0.7]);
      const we = env(n, 0.0015, [0.03, 0.15], [1, 0.42 + 0.2 * hard]);
      const he = env(n, 0, [0.07], [1]);
      for (let i = 0; i < n; i++) we[i] *= 0.65 + 0.35 * he[i];
      const out = new Float32Array(n);
      mulAdd(out, head, 0.65);
      mulAdd(out, w, 0.55 + 0.25 * hard, we);
      const stick = chain(noise(N(0.02), r), ['bp', 3000, 1.2]);
      mulAdd(out, stick, 0.7 * hard * hard, env(stick.length, 0.0002, [0.0025], [1]));
      if (v === 0) return fadeTail(norm(chain(out, ['lp', 4500, 0.7]), 0.85), 0.1);
      sat(out, 1.1 + hard * 0.45);
      return fadeTail(norm(out, 0.9), 0.1);
    },
    rim(v, r) {
      const n = N(0.28), hard = [0.5, 0.8, 1][v];
      const o = partials(n, [[520 * (1 + r() * 0.02), 1, 0.045], [1150, 0.62, 0.03], [1720, 0.42, 0.02], [2900, 0.3, 0.012], [190, 0.3, 0.05]], r);
      const c = chain(noise(N(0.02), r), ['bp', 2600, 1.4]);
      mulAdd(o, c, 0.9 * hard, env(c.length, 0.0001, [0.0018], [1]));
      return fadeTail(norm(o, 0.75), 0.05);
    },
    clap(v, r) {
      const n = N(0.5), o = new Float32Array(n), src = chain(noise(n, r), ['bp', 1250, 1.3], ['pk', 2600, 1, 4]);
      const e = new Float32Array(n);
      [0, 0.0095, 0.019, 0.031].forEach((d, k) => { const s0 = N(d + r() * 0.002); for (let i = s0; i < n; i++) e[i] += (k === 3 ? 1 : 0.75) * Math.exp(-(i - s0) / sr / (k === 3 ? 0.11 : 0.006)); });
      mulAdd(o, src, 1, e);
      return fadeTail(norm(o, [0.55, 0.7, 0.8][v]), 0.08);
    },
    tomh(v, r) { return tom(v, r, 148, 0.45); },
    toml(v, r) { return tom(v, r, 94, 0.7); },
    hhc(v, r) { return hat(v, r, 'c'); },
    hho(v, r) { return hat(v, r, 'o'); },
    hhp(v, r) {
      const n = N(0.22), o = new Float32Array(n);
      const lo = chain(noise(n, r), ['bp', 1300, 1.1]), hi = chain(noise(n, r), ['hp', 7000, 0.7]);
      mulAdd(o, lo, 0.8, env(n, 0.0008, [0.011], [1]));
      mulAdd(o, hi, 0.5, env(n, 0.0005, [0.02, 0.06], [1, 0.15]));
      return fadeTail(norm(o, [0.3, 0.4, 0.48][v]), 0.04);
    },
    shaker(v, r) {
      const n = N(0.3), o = chain(noise(n, r), ['bp', 6200, 0.8], ['hp', 3500, 0.7]);
      const e = env(n, 0.012 + r() * 0.006, [0.035, 0.09], [1, 0.12]);
      for (let i = 0; i < n; i++) e[i] *= 0.8 + 0.2 * r();
      for (let i = 0; i < n; i++) o[i] *= e[i];
      return fadeTail(norm(o, [0.22, 0.3, 0.36][v]), 0.05);
    },
    ride(v, r) {
      const n = N(3.2), hard = [0.5, 0.8, 1][v], P = [];
      // dichte Wolke unharmonischer Teiltöne (Becken), wenige etwas stärkere „Glocken“-Töne
      for (let k = 0; k < 70; k++) { const f = 350 * Math.pow(26, r()); P.push([f, 0.022 / Math.sqrt(f / 1000 + 0.3), 0.7 + r() * 1.8]); }
      [520, 1240, 2180].forEach(f => P.push([f * (1 + (r() - 0.5) * 0.04), 0.03, 1.6]));
      const o = partials(n, P, r);
      const wash = chain(noise(n, r), ['hp', 2800, 0.6], ['bp', 5500, 0.45]);
      const we = env(n, 0.004, [0.25, 1.6], [0.5, 0.6]);
      for (let i = 0; i < n; i++) we[i] *= 1 + 0.12 * Math.sin(2 * Math.PI * 5.3 * i / sr);
      mulAdd(o, wash, 0.5 + 0.5 * hard, we);
      const tick = chain(noise(N(0.03), r), ['bp', 5200, 0.9]);
      mulAdd(o, tick, 0.9 * hard, env(tick.length, 0.0001, [0.004], [1]));
      return fadeTail(norm(o, [0.3, 0.4, 0.48][v]), 0.4);
    },
    crash(v, r) {
      const n = N(3.4), hard = [0.6, 0.85, 1][v], o = new Float32Array(n);
      const bright = chain(noise(n, r), ['hp', 4500, 0.6], ['pk', 8500, 0.7, 4]);
      const dark = chain(noise(n, r), ['bp', 3600, 0.5], ['lp', 7500, 0.7]);
      mulAdd(o, bright, 0.9 * hard, env(n, 0.002, [0.06, 0.55], [0.6, 0.6]));
      mulAdd(o, dark, 0.8, env(n, 0.012, [1.4], [1]));
      const P = []; for (let k = 0; k < 40; k++) P.push([1500 + r() * 7500, 0.03, 0.5 + r() * 1.3]);
      mulAdd(o, partials(n, P, r), 1);
      return fadeTail(norm(o, [0.4, 0.5, 0.56][v]), 0.6);
    }
  };
  function tom(v, r, f0, len) {
    const n = N(len + 0.6), hard = [0.5, 0.8, 1][v];
    const o = modes(n, f0 * (1 + (r() - 0.5) * 0.02), [1, 1.5, 1.98, 2.44], [1, 0.35, 0.18, 0.1], [len * 0.62, len * 0.25, 0.1, 0.07], 0.12 + 0.08 * hard, 0.045, r);
    const st = chain(noise(N(0.03), r), ['bp', 2100, 1]);
    mulAdd(o, st, 0.4 * hard, env(st.length, 0.0002, [0.004], [1]));
    const sk = chain(noise(N(0.08), r), ['lp', 900, 0.7]);
    mulAdd(o, sk, 0.25, env(sk.length, 0.0005, [0.03], [1]));
    sat(o, 1.12);
    return fadeTail(norm(o, 0.85), 0.12);
  }
  function hat(v, r, kind) {
    const open = kind === 'o', n = N(open ? 1.3 : 0.26), hard = [0.5, 0.8, 1][v];
    const base = noise(n, r), o = new Float32Array(n);
    const hp = chain(base, ['hp', 6500 - 1200 * (1 - hard), 0.7], ['hp', 6500 - 1200 * (1 - hard), 0.7]);
    let res = new Float32Array(n);
    [7100, 8900, 10400, 12600].forEach(f => mulAdd(res, biquad(hp, 'bp', f * (1 + (r() - 0.5) * 0.03), 3), 0.5));
    const P = []; for (let k = 0; k < 24; k++) P.push([4200 + r() * 10500, 0.04 / (1 + k * 0.05), open ? 0.25 + r() * 0.3 : 0.03 + r() * 0.03]);
    const ring = partials(n, P, r);
    const e = open ? env(n, 0.001, [0.05, 0.42], [0.5, 0.65]) : env(n, 0.0004, [0.016, 0.06], [1, 0.14]);
    if (open) for (let i = 0; i < n; i++) e[i] *= 1 + 0.12 * Math.sin(2 * Math.PI * 7 * i / sr);
    mulAdd(o, hp, 0.45, e); mulAdd(o, res, 0.9, e); mulAdd(o, ring, 1, e);
    let out = hard < 0.9 ? biquad(o, 'lp', 8000 + 6000 * hard, 0.7) : o;
    return fadeTail(norm(out, (open ? [0.3, 0.38, 0.45] : [0.26, 0.34, 0.42])[v]), open ? 0.2 : 0.03);
  }
  const out = {};
  const names = Object.keys(V);
  names.forEach((id, k) => {
    const rrN = (id === 'ride' || id === 'crash') ? 1 : 2;
    out[id] = [0, 1, 2].map(v => { const a = []; for (let q = 0; q < rrN; q++) a.push(V[id](v, rng(1000 * k + 97 * v + 13 * q + 7))); return a; });
  });
  return out;
}
