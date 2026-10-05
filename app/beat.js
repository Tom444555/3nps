// Takt-Analyse v2: Tempo, Schlagraster (folgt Temposchwankungen) und Takt-Einsen.
// Eingang: Mono-Signal mit ca. 11 kHz. Nutzt fft() aus dem Hauptskript.
function beatAnalyse(x, sr, opts) {
  opts = opts || {};
  const hop = 128, N = 1024, fps = sr / hop;
  const nF = Math.floor((x.length - N) / hop) + 1;
  if (nF < fps * 3) return null;                         // kürzer als ~3 s

  // ---------- 1) Merkmale pro Rahmen: spektraler Fluss (gesamt/tief/hoch) und Chroma ----------
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const binHz = sr / N, b30 = Math.ceil(30 / binHz), b150 = Math.floor(160 / binHz), b2k = Math.floor(2000 / binHz), b5k = Math.min(N / 2 - 1, Math.floor(5000 / binHz));
  const bChLo = Math.ceil(80 / binHz), bChHi = Math.floor(1600 / binHz);
  const pcOfBin = new Int8Array(N / 2);
  for (let b = 1; b < N / 2; b++) { const m = 69 + 12 * Math.log2(b * binHz / 440); pcOfBin[b] = ((Math.round(m) % 12) + 12) % 12; }
  const flux = new Float32Array(nF), fluxLo = new Float32Array(nF), fluxHi = new Float32Array(nF), fluxMid = new Float32Array(nF), hiE = new Float32Array(nF);
  const b3k = Math.floor(3000 / binHz);
  // Bänder für die ausgewogene Anschlagskurve (jedes Band zählt gleich – Snare geht neben der Kick nicht unter)
  const BE = [30, 120, 250, 500, 1000, 2000, 3500, 5500].map(h => Math.min(N / 2 - 1, Math.round(h / binHz)));
  const NB = BE.length - 1, bandOf = new Int8Array(N / 2).fill(-1);
  for (let k = 0; k < NB; k++) for (let b = BE[k]; b < BE[k + 1]; b++) bandOf[b] = k;
  const fluxB = []; for (let k = 0; k < NB; k++) fluxB.push(new Float32Array(nF));
  const chroma = new Float32Array(nF * 12);
  let prev = new Float32Array(N / 2), cur = new Float32Array(N / 2);
  const frame = new Float64Array(N);
  for (let f = 0; f < nF; f++) {
    const st = f * hop;
    for (let i = 0; i < N; i++) frame[i] = x[st + i] * win[i];
    const { re, im } = fft(frame);
    let fa = 0, fl = 0, fh = 0, fm = 0;
    for (let b = b30; b <= b5k; b++) {
      const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      const L = Math.log(1 + 100 * mag);
      cur[b] = L;
      const d = L - prev[b];
      if (d > 0) { fa += d; if (b <= b150) fl += d; else if (b >= b2k) fh += d; else fm += d; if (bandOf[b] >= 0) fluxB[bandOf[b]][f] += d; }
      if (b >= bChLo && b <= bChHi) chroma[f * 12 + pcOfBin[b]] += mag;
      if (b >= b3k) hiE[f] += mag * mag;
    }
    flux[f] = fa; fluxLo[f] = fl; fluxHi[f] = fh; fluxMid[f] = fm;
    const t = prev; prev = cur; cur = t;
  }
  flux[0] = fluxLo[0] = fluxHi[0] = 0;

  // Gleitenden Mittelwert abziehen (nur echte Anschläge bleiben), dann leicht glätten
  function clean(v) {
    const out = new Float32Array(nF), W = Math.max(2, Math.round(fps * 0.2));
    let s = 0;
    for (let f = 0; f < nF + W; f++) {
      if (f < nF) s += v[f];
      if (f - 2 * W - 1 >= 0) s -= v[f - 2 * W - 1];
      const c = f - W; if (c >= 0 && c < nF) out[c] = Math.max(0, v[c] - s / (2 * W + 1));
    }
    const sm = new Float32Array(nF), k = [0.15, 0.5, 1, 0.5, 0.15];
    for (let f = 2; f < nF - 2; f++) { let t = 0; for (let j = -2; j <= 2; j++) t += out[f + j] * k[j + 2]; sm[f] = t; }
    let mx = 0; for (let f = 0; f < nF; f++) if (sm[f] > mx) mx = sm[f];
    if (mx > 0) for (let f = 0; f < nF; f++) sm[f] /= mx;
    return sm;
  }
  const OL = clean(fluxLo), OH = clean(fluxHi), OM = clean(fluxMid);
  // Ausgewogene Anschlagskurve: Bänder einzeln bereinigt und auf gleiche mittlere Stärke gebracht
  const O = (() => {
    const sum = new Float32Array(nF);
    for (let k = 0; k < NB; k++) {
      const v = clean(fluxB[k]); let m = 0, c = 0;
      for (let f = 0; f < nF; f++) if (v[f] > 0.02) { m += v[f]; c++; }
      m = c > nF * 0.01 ? m / c : 0; if (!m) continue;
      for (let f = 0; f < nF; f++) sum[f] += Math.min(4, v[f] / m);
    }
    const all = clean(flux); let ma = 0, ca = 0; for (let f = 0; f < nF; f++) if (all[f] > 0.02) { ma += all[f]; ca++; }
    ma = ca ? ma / ca : 1;
    for (let f = 0; f < nF; f++) sum[f] += 2 * Math.min(4, all[f] / ma);
    let mx = 0; for (let f = 0; f < nF; f++) if (sum[f] > mx) mx = sum[f];
    if (mx > 0) for (let f = 0; f < nF; f++) sum[f] /= mx;
    return sum;
  })();
  let meanO = 0; for (let f = 0; f < nF; f++) meanO += O[f]; meanO /= nF;
  if (meanO <= 1e-6) return null;
  const at = (v, p) => { if (p < 0 || p >= nF - 1) return 0; const i = Math.floor(p), fr = p - i; return v[i] * (1 - fr) + v[i + 1] * fr; };
  const peakAt = (v, p, r) => { let m = 0; for (let q = Math.floor(p - r); q <= Math.ceil(p + r); q++) if (q >= 0 && q < nF && v[q] > m) m = v[q]; return m; };

  // ---------- 2) Tempo-Kandidaten über Autokorrelation ----------
  const minLag = Math.floor(fps * 60 / 240), maxLag = Math.ceil(fps * 60 / 40) * 4 + 4;
  const AC = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1 && lag < nF; lag++) { let s = 0; for (let f = 0; f + lag < nF; f++) s += O[f] * O[f + lag]; AC[lag] = s / (nF - lag); }
  const acAt = p => { const i = Math.floor(p), fr = p - i; return i + 1 >= AC.length ? 0 : AC[i] * (1 - fr) + AC[i + 1] * fr; };
  const sal = bpm => { const p = 60 * fps / bpm; return acAt(p) + 0.5 * acAt(2 * p) + 0.33 * acAt(3 * p) + 0.5 * acAt(4 * p); };
  // Tempo-Vorzug: allgemein um 115 BPM; mit bekanntem Tempo (Klick/Drums beim Aufnehmen) eng darum
  const pC = opts.hintBpm || 115, pW = opts.hintBpm ? (opts.hintStrong ? 0.12 : 0.5) : 1.0;
  const prior = bpm => Math.exp(-0.5 * Math.pow(Math.log2(bpm / pC) / pW, 2));
  const curve = [];
  for (let b = 50; b <= 220; b += 0.5) curve.push([b, sal(b) * prior(b)]);
  const peaks = [];
  for (let i = 1; i < curve.length - 1; i++) if (curve[i][1] >= curve[i - 1][1] && curve[i][1] >= curve[i + 1][1]) peaks.push(curve[i]);
  peaks.sort((a, b) => b[1] - a[1]);
  const cand = new Set();
  peaks.slice(0, 4).forEach(([b]) => [1, 2, 0.5, 1.5, 2 / 3, 0.75, 4 / 3, 3, 1 / 3].forEach(m => { const v = b * m; if (v >= 50 && v <= 220) cand.add(Math.round(v * 2) / 2); }));

  // ---------- 3) Für jeden Kandidaten Periode und Phase genau anpassen und metrisch bewerten ----------
  function fit(p0) {
    let best = { s: -1, p: p0, ph: 0 };
    const tryP = (p, phs) => { for (const ph of phs) { let s = 0, c = 0; for (let t = ph; t < nF - 1; t += p) { s += at(O, t); c++; } s /= Math.max(1, c); if (s > best.s) best = { s, p, ph }; } };
    for (let k = -40; k <= 40; k++) { const p = p0 * (1 + k * 0.0006); const phs = []; for (let ph = 0; ph < p; ph += 1) phs.push(ph); tryP(p, phs); }
    const p1 = best.p, ph1 = best.ph;
    for (let k = -15; k <= 15; k++) { const p = p1 * (1 + k * 0.00006); const phs = []; for (let d = -1; d <= 1; d += 0.125) if (ph1 + d >= 0) phs.push(ph1 + d); tryP(p, phs); }
    return best;
  }
  function metric(g) {
    // mittlere Stärke auf Schlägen, Achteln, Sechzehnteln und das Verhältnis gerade/ungerade Schläge
    let on = 0, off8 = 0, off16 = 0, off3 = 0, ev = 0, od = 0, c = 0, k = 0; const g3 = [0, 0, 0];
    for (let t = g.ph; t + g.p < nF - 1; t += g.p, k++) {
      const v = peakAt(O, t, 1.5); on += v; off8 += peakAt(O, t + g.p / 2, 1.5); off16 += (peakAt(O, t + g.p / 4, 1) + peakAt(O, t + 3 * g.p / 4, 1)) / 2;
      off3 += (peakAt(O, t + g.p / 3, 1.2) + peakAt(O, t + 2 * g.p / 3, 1.2)) / 2;
      if (k % 2) od += v; else ev += v; g3[k % 3] += v; c++;
    }
    c = Math.max(1, c);
    // alt3: Gruppen zu je drei Schlägen ungleich stark → das Raster liegt quer zu den echten Schlägen (Triolen-Fehler)
    return { on: on / c, off8: off8 / c, off16: off16 / c, off3: off3 / c, alt: Math.max(ev, od) / Math.max(1e-6, Math.min(ev, od)), alt3: Math.max(...g3) / Math.max(1e-6, Math.min(...g3)) };
  }
  const scored = [...cand].map(b => { const g = fit(60 * fps / b); const m = metric(g); return { bpm: 60 * fps / g.p, g, m, sal: sal(60 * fps / g.p), prior: prior(60 * fps / g.p) }; });
  // Bewertung: Schlagstärke × Vorzug, Strafe für starkes Gerade/Ungerade-Gefälle (= eigentlich halbes Tempo)
  // und Strafe, wenn Achtel so stark sind wie Schläge (= eigentlich doppeltes Tempo)
  scored.forEach(s => {
    const altPen = s.m.alt > 2.6 ? Math.pow(2.6 / s.m.alt, 1.5) : 1;
    const offRatio = s.m.off8 / Math.max(1e-6, s.m.on);
    const offPen = offRatio > 0.8 ? Math.pow(0.8 / offRatio, 2) : 1;
    const alt3Pen = s.m.alt3 > 1.4 ? Math.pow(1.4 / s.m.alt3, 2) : 1;
    const sub = Math.max(0.25 * s.m.off8 + 0.1 * s.m.off16, 0.3 * s.m.off3);     // gerade oder triolische Unterteilung bestätigt
    const contrast = s.m.on + sub;
    s.score = Math.max(0, contrast) * altPen * alt3Pen * offPen * s.prior;
  });
  scored.sort((a, b) => b.score - a.score);
  let chosen = scored[0];
  // Oktav-Prüfung über die Rollen von Bass (Kick) und Höhen (Snare/Hi-Hat):
  //  doppeltes Tempo  → Bass und Höhen wechseln gemeinsam zwischen geraden/ungeraden Schlägen
  //  halbes Tempo     → auf den Achteln liegt so viel Bass wie auf den Schlägen
  function roles(g) {
    let le = 0, lo = 0, he = 0, ho = 0, l8 = 0, h8 = 0, k = 0;
    for (let t = g.ph; t + g.p < nF - 1; t += g.p, k++) {
      const L = peakAt(OL, t, 1.5), H = peakAt(OH, t, 1.5);
      if (k % 2) { lo += L; ho += H; } else { le += L; he += H; }
      l8 += peakAt(OL, t + g.p / 2, 1.5); h8 += peakAt(OH, t + g.p / 2, 1.5);
    }
    if (le < lo) { [le, lo] = [lo, le]; [he, ho] = [ho, he]; }
    return { aL: (le - lo) / (le + lo + 1e-9), aH: (he - ho) / (he + ho + 1e-9), L8: l8 / (le + lo + 1e-9), H8: h8 / (he + ho + 1e-9) };
  }
  // Backbeat-Probe mit fester Zählung: Kick/Bass auf der einen, Snare (Mitten/Höhen) auf der anderen Schlaggruppe
  function backbeat(g) {
    let le = 0, lo = 0, me = 0, mo = 0, he = 0, ho = 0, k = 0;
    for (let t = g.ph; t + g.p < nF - 1; t += g.p, k++) {
      const L = peakAt(OL, t, 1.5), M = peakAt(OM, t, 1.5), H = peakAt(OH, t, 1.5);
      if (k % 2) { lo += L; mo += M; ho += H; } else { le += L; me += M; he += H; }
    }
    const aL = (le - lo) / (le + lo + 1e-9), aM = (me - mo) / (me + mo + 1e-9), aH = (he - ho) / (he + ho + 1e-9);
    const opp = (aL * aM < -0.005 && aL * aH < -0.005) || Math.abs(aL) < 0.08;
    return { ok: opp && aM * aH > 0 && (Math.abs(aM) > 0.1 || Math.abs(aH) > 0.12), aL, aM, aH };
  }
  if (!opts.forceBpm && chosen.bpm * 2 <= 185 && chosen.m && chosen.m.off8 / Math.max(1e-6, chosen.m.on) >= 0.25 && chosen.m.off8 / Math.max(1e-6, chosen.m.on) <= 0.65) {
    const g2 = fit(chosen.g.p / 2), bb = backbeat(g2);
    if (opts.debug) console.log('  Backbeat bei 2×', JSON.stringify(bb, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
    if (bb.ok) { const m2 = metric(g2); chosen = { bpm: 60 * fps / g2.p, g: g2, m: m2, octave: 'Backbeat' }; }
  }
  if (chosen.octave === 'Backbeat') { /* schon entschieden */ }
  else if (!opts.forceBpm) {
    const r0 = roles(chosen.g);
    if (r0.aL >= 0.25 && r0.aH >= 0.18 && chosen.bpm / 2 >= 50) {
      const g = fit(chosen.g.p * 2); chosen = { bpm: 60 * fps / g.p, g, octave: 'halbiert' };
    } else if (chosen.bpm * 2 <= 220) {
      const g2 = fit(chosen.g.p / 2), r2 = roles(g2);
      // Bass auf den Achteln (Kick zwischen den Schlägen) oder Snare auf den Achteln bei leerem Doppel-Raster
      // …aber nicht, wenn im jetzigen Tempo schon ein klarer Backbeat liegt (Snare auf 2 und 4, Kick synkopiert)
      const bb0 = backbeat(chosen.g);
      if (((r0.L8 > 1.4 && r0.H8 > 0.45) || (r0.H8 > 0.7 && r0.L8 > 0.8 && r2.H8 < 0.4)) && !(opts.keepBB !== false && bb0.ok && Math.abs(bb0.aM) > 0.2)) chosen = { bpm: 60 * fps / g2.p, g: g2, octave: 'verdoppelt' };
      if (opts.debug) console.log('  Oktave', JSON.stringify({ r0, bb0 }, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v), chosen.octave || '');
    }
  } else {                                      // vom Benutzer vorgegeben (½ / 2×)
    const g = fit(60 * fps / opts.forceBpm); chosen = { bpm: 60 * fps / g.p, g };
  }
  const P = chosen.g.p;

  // ---------- 4) Schlagverfolgung (dynamische Programmierung) – folgt kleinen Temposchwankungen ----------
  const alpha = 400, score = new Float32Array(nF), back = new Int32Array(nF).fill(-1);
  const lo = Math.round(P * 0.8), hi = Math.round(P * 1.25);
  for (let f = 0; f < nF; f++) {
    let best = 0, bi = -1;
    for (let d = lo; d <= hi; d++) {
      const q = f - d; if (q < 0) break;
      const v = score[q] - alpha * Math.pow(Math.log(d / P), 2);
      if (v > best || bi < 0) { best = v; bi = q; }
    }
    score[f] = O[f] + (bi >= 0 ? Math.max(0, best) : 0);
    back[f] = bi >= 0 && best > 0 ? bi : -1;
  }
  let end = 0; for (let f = Math.max(0, nF - Math.round(P * 2)); f < nF; f++) if (score[f] > score[end]) end = f;
  let beatsF = []; for (let f = end; f >= 0; f = back[f]) { beatsF.push(f); if (back[f] < 0) break; }
  beatsF.reverse();
  // Vorne fehlende Schläge (Intro, Auftakt) mit der Periode ergänzen
  while (beatsF.length && beatsF[0] - P > -P * 0.3) beatsF.unshift(beatsF[0] - P);
  beatsF = beatsF.filter(f => f >= -P * 0.3);
  // Feinkorrektur jedes Schlags auf das lokale Maximum (±40 ms)
  const rad = Math.round(fps * 0.04);
  let beatsR = beatsF.map(f => { let m = f, mv = -1; for (let q = Math.round(f) - rad; q <= Math.round(f) + rad; q++) if (q >= 0 && q < nF && O[q] > mv) { mv = O[q]; m = q; } return mv > 0.08 ? m : f; });

  // Gegenprobe Schlag vs. Achtel: liegt das Raster auf den Achteln (Synkopen), um einen halben Schlag verschieben
  {
    // Snare und Akkordanschläge (Mitten) liegen fast immer auf dem Schlag; Kick/Bass sind oft synkopiert
    const W = (f) => peakAt(O, f, 1.5) + 1.5 * peakAt(OM, f, 1.5) + 0.3 * peakAt(OL, f, 1.5);
    let on = 0, off = 0;
    beatsR.forEach(f => { on += W(f); off += W(f + P / 2); });
    if (off > on * 1.05) { beatsR = beatsR.map(f => f + P / 2).filter(f => f < nF - 1); beatsF = beatsF.map(f => f + P / 2).filter(f => f < nF - 1); }
  }
  // Gerades Raster per Regression; wenn es gut passt (Studio-Tempo), wird es verwendet
  function regress(arr) {
    const n = arr.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
    arr.forEach((y, i) => { sx += i; sy += y; sxx += i * i; sxy += i * y; });
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
    let r = 0; arr.forEach((y, i) => { r += (y - (a + b * i)) ** 2; });
    return { a, b, rms: Math.sqrt(r / n) };
  }
  let reg = regress(beatsR);
  // Ausreißer entfernen und neu anpassen
  const inl = beatsR.map((y, i) => [i, y]).filter(([i, y]) => Math.abs(y - (reg.a + reg.b * i)) < fps * 0.03);
  if (inl.length > beatsR.length * 0.5) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0; const n = inl.length;
    inl.forEach(([i, y]) => { sx += i; sy += y; sxx += i * i; sxy += i * y; });
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
    let r = 0; beatsR.forEach((y, i) => { r += (y - (a + b * i)) ** 2; });
    reg = { a, b, rms: Math.sqrt(r / beatsR.length) };
  }
  // Freies Intro (Rubato, Geräusche): Wo beginnt der regelmäßige Takt? Je Fenster von 2 Takten zählt, welcher Anteil
  // der Anschlag-Energie auf dem Raster (Schläge und Achtel) liegt. Im freien Intro liegen die Anschläge irgendwo,
  // im Song auf dem Raster. Das Raster je Fenster: robuste Gerade durch die folgenden 16 Schläge.
  {
    const nbR = beatsR.length, pk = [];
    for (let f = 1; f < nF - 1; f++) if (O[f] > 0.04 && O[f] >= O[f - 1] && O[f] > O[f + 1]) pk.push(f);
    const lineFrom = i0 => {
      const idx = [], ys = []; for (let i = i0; i < Math.min(nbR, i0 + 16); i++) { idx.push(i); ys.push(beatsR[i]); }
      if (idx.length < 8) return null;
      let use = idx.map(() => 1), fit = null;
      for (let it = 0; it < 3; it++) {
        let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
        idx.forEach((i, k) => { if (!use[k]) return; sw++; sx += i; sy += ys[k]; sxx += i * i; sxy += i * ys[k]; });
        if (sw < 4) return fit;
        const bb = (sw * sxy - sx * sy) / (sw * sxx - sx * sx || 1), aa = (sy - bb * sx) / sw;
        fit = { a: aa, b: bb }; use = idx.map((i, k) => Math.abs(ys[k] - (aa + bb * i)) < fps * 0.035 ? 1 : 0);
      }
      return fit;
    };
    const ratio = [], energy = [];
    for (let i = 0; i + 8 <= nbR; i++) {
      const L = lineFrom(i); if (!L || !(L.b > P * 0.7 && L.b < P * 1.4)) { ratio.push(0); energy.push(0); continue; }
      const g0 = L.a + L.b * i - L.b / 4, g1 = L.a + L.b * (i + 8) - L.b / 4, half = L.b / 2;
      let on = 0, all = 0;
      for (const f of pk) { if (f < g0) continue; if (f >= g1) break; all += O[f]; const ph = ((f - L.a) % half + half) % half; if (Math.min(ph, half - ph) <= 2.5) on += O[f]; }
      ratio.push(all > 0 ? on / all : 0); energy.push(all);
    }
    if (opts.debug) opts.debugIntro = { ratio: ratio.map(v => +v.toFixed(2)), energy: energy.map(v => +v.toFixed(1)) };
    if (ratio.length > 12) {
      const srt = ratio.slice().sort((p, q) => p - q), medR = srt[srt.length >> 1], es = energy.slice().sort((p, q) => p - q), medE = es[es.length >> 1] || 1e-6;
      const thr = Math.max(0.42, 0.72 * medR), good = i => i < ratio.length && ratio[i] >= thr && energy[i] >= 0.12 * medE;
      let st = 0; while (st < ratio.length && !(good(st) && good(Math.min(ratio.length - 1, st + 4)))) st++;
      // bis zum ersten Schlag vorrücken, der selbst einen hörbaren Anschlag auf dem Raster hat
      if (st > 0 && st < ratio.length) {
        const L = lineFrom(st), lev = beatsR.map(b0 => peakAt(O, b0, 1.5)), lm = lev.slice().sort((p, q) => p - q)[lev.length >> 1] || 1e-6;
        let k = st; while (k < st + 8 && k < nbR && !(peakAt(O, L ? L.a + L.b * k : beatsR[k], 2) >= 0.25 * lm)) k++;
        if (k < st + 8) st = k;
      }
      if (st >= 2 && st < nbR - 16) {
        beatsR = beatsR.slice(st); beatsF = beatsF.slice(st);
        // Gerade ohne das Intro neu anpassen (sonst gilt der Song wegen des Intros als „schwankend“)
        const r2 = robustLine(beatsR.map((_, i) => i), beatsR, beatsR.map(() => 1));
        if (r2) { let q = 0; beatsR.forEach((y, i) => { q += (y - (r2.a + r2.b * i)) ** 2; }); reg = { a: r2.a, b: r2.b, rms: Math.sqrt(q / beatsR.length) }; }
        else reg.a += reg.b * st;
      }
    }
  }
  const steady = reg.rms < fps * 0.018;
  const beats = steady ? beatsR.map((_, i) => reg.a + reg.b * i) : beatsR.map((y, i) => (y + beatsF[i]) / 2 * 0 + y);
  const period = steady ? reg.b : (beats[beats.length - 1] - beats[0]) / Math.max(1, beats.length - 1);

  // ---------- 5) Takt-Eins: Bass/Kick-Anschläge, Akkordwechsel und Betonung ----------
  const nb = beats.length;
  const featLo = beats.map(b => peakAt(OL, b, 2)), featOn = beats.map(b => peakAt(O, b, 2)), featHi = beats.map(b => peakAt(OH, b, 2));
  // Chroma je Schlag (Mittel zwischen zwei Schlägen), Akkordwechsel = Abstand der Halbtakt-Mittel davor/danach
  const chB = beats.map((b, i) => {
    const a = Math.max(0, Math.round(b)), e = Math.min(nF, Math.round(i + 1 < nb ? beats[i + 1] : b + period));
    const v = new Float32Array(12); for (let f = a; f < e; f++) for (let c = 0; c < 12; c++) v[c] += chroma[f * 12 + c];
    let s = 0; for (let c = 0; c < 12; c++) s += v[c] * v[c]; s = Math.sqrt(s) || 1; for (let c = 0; c < 12; c++) v[c] /= s; return v;
  });
  const nov = beats.map((_, i) => {
    if (i < 2 || i + 2 > nb) return 0;
    const A = new Float32Array(12), B = new Float32Array(12);
    for (let c = 0; c < 12; c++) { A[c] = chB[i - 1][c] + chB[i - 2][c]; B[c] = chB[i][c] + chB[i + 1][c]; }
    let d = 0, na = 0, nbb = 0; for (let c = 0; c < 12; c++) { d += A[c] * B[c]; na += A[c] * A[c]; nbb += B[c] * B[c]; }
    return 1 - d / (Math.sqrt(na * nbb) || 1);
  });
  // Akkordwechsel auf Taktebene: 4 Schläge davor gegen 4 danach (Wechsel liegen meist auf der Eins)
  const nov4 = beats.map((_, i) => {
    if (i < 4 || i + 4 > nb) return 0;
    const A = new Float32Array(12), B = new Float32Array(12);
    for (let j = 1; j <= 4; j++) for (let c = 0; c < 12; c++) { A[c] += chB[i - j][c]; B[c] += chB[i + j - 1][c]; }
    let d = 0, na = 0, nbb = 0; for (let c = 0; c < 12; c++) { d += A[c] * B[c]; na += A[c] * A[c]; nbb += B[c] * B[c]; }
    return 1 - d / (Math.sqrt(na * nbb) || 1);
  });
  // Becken (Crash) auf der Eins: Höhen klingen nach dem Schlag lange und deutlich lauter als davor.
  // Hi-Hat/Snare klingen schnell ab, Ride/offene Hi-Hat sind gleichmäßig – nur echte Akzente zählen.
  const hiMean = (a, e) => { a = Math.max(0, Math.round(a)); e = Math.min(nF, Math.round(e)); let v = 0; for (let f = a; f < e; f++) v += hiE[f]; return e > a ? v / (e - a) : 0; };
  const hiMed = (() => { const a = []; for (let f = 0; f < nF; f += 3) a.push(hiE[f]); a.sort((p, q) => p - q); return a[a.length >> 1] || 1e-9; })();
  const crash = beats.map(b => Math.log((hiMean(b + 0.12 * fps, b + 0.42 * fps) + 1e-9) / Math.max(hiMean(b - 0.3 * fps, b - 0.04 * fps), hiMed * 0.5)));
  const crashW = (() => { const s2 = crash.slice().sort((a, b) => a - b), med = s2[s2.length >> 1], mad = s2.map(v => Math.abs(v - med)).sort((a, b) => a - b)[s2.length >> 1] || 0.1;
    return crash.map(v => v > 0.9 ? Math.min(3, Math.max(0, (v - med) / (mad * 1.4826) - 2.5)) : 0); })();       // mind. 2,5-fach lauter und klarer Ausreißer
  const z = arr => { const m = arr.reduce((a, b) => a + b, 0) / arr.length; const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) || 1; return arr.map(v => (v - m) / sd); };
  const zLo = z(featLo), zOn = z(featOn), zNov = z(nov), zHi = z(featHi), zNov4 = z(nov4);
  const W = opts.downW || [0.8, 0.8, 0, -1, 2.5];
  const dsc = [0, 0, 0, 0], dct = [0, 0, 0, 0];
  // Akkordwechsel kommen oft erst kurz nach der Eins (Anschlag auf 2): Folgeschlag mitzählen
  const LG = opts.lagW || [0.8, 0.4];
  const n4 = i => zNov4[i] + LG[0] * (zNov4[i + 1] || 0) - LG[1] * (zNov4[i - 1] || 0);
  const WC = opts.crashW != null ? opts.crashW : 1.5;
  for (let i = 0; i < nb; i++) { const k = i % 4; dsc[k] += W[0] * zLo[i] + W[1] * zNov[i] + W[2] * zOn[i] + W[3] * zHi[i] + W[4] * n4(i) + WC * crashW[i]; dct[k]++; }
  let down = 0; for (let k = 1; k < 4; k++) if (dsc[k] / dct[k] > dsc[down] / dct[down]) down = k;
  if (opts.debug) { const comp = [[], [], [], [], []]; for (let k = 0; k < 4; k++) { const sel = (arr) => { let a = 0, c = 0; for (let i = k; i < nb; i += 4) { a += arr(i); c++; } return +(a / c).toFixed(2); }; comp[0].push(sel(i => zLo[i])); comp[1].push(sel(i => zNov[i])); comp[2].push(sel(i => zOn[i])); comp[3].push(sel(i => zHi[i])); comp[4].push(sel(i => n4(i))); (comp[5] = comp[5] || []).push(sel(i => crashW[i])); } opts.debugDown = { tot: dsc.map((v, k) => +(v / dct[k]).toFixed(2)), lo: comp[0], nov: comp[1], on: comp[2], hi: comp[3], n4: comp[4], crash: comp[5], beat0: beats[0], crashRaw: crash, crashW }; }
  // Sicherheit der Eins: Abstand der besten zur zweitbesten Zählung (in Einheiten der Streuung)
  const avgs = dsc.map((v, k) => v / Math.max(1, dct[k])), srt = avgs.slice().sort((p, q) => q - p);
  const downConf = (srt[0] - srt[1]) / (Math.sqrt(avgs.reduce((p, v) => p + v * v, 0) / 4) || 1);
  if (opts.downShift) down = (down + opts.downShift + 400) % 4;

  // ---------- Ergebnis ----------
  const tSec = f => (f * hop + N / 2) / sr + 0.024;      // geeicht: Anschlag liegt ~24 ms nach der Rahmenmitte
  let beatTimes = beats.map(tSec), fineInfo = null;
  // Feinbestimmung auf ~1 ms: echte Anschlagzeiten im Signal suchen und das Raster daran ausrichten
  if (opts.fine !== false) { const fr = beatRefine(x, sr, beatTimes, steady); if (fr) { beatTimes = fr.times; fineInfo = fr.info; } }
  const downbeats = []; for (let i = down; i < nb; i += 4) downbeats.push(beatTimes[i]);
  // Zuverlässigkeit: Anschläge auf dem Raster gegenüber dem Rest
  let onG = 0; beats.forEach(b => { onG += peakAt(O, b, 1.5); }); onG /= Math.max(1, nb);
  const conf = onG / meanO;
  const beatSec = steady && beatTimes.length > 1 ? (beatTimes[beatTimes.length - 1] - beatTimes[0]) / (beatTimes.length - 1) : period / fps;
  return {
    bpm: 60 / beatSec, beatSec, firstDownbeat: downbeats[0], firstBeat: beatTimes[0], fine: fineInfo,
    beats: beatTimes, downbeats, downIndex: down, downConf, steady, confidence: conf,
    alternatives: scored.slice(0, 3).map(s => Math.round(s.bpm * 10) / 10)
  };
}

// Anschlag-Feinbestimmung: kurze Energiefenster (3 ms) des höhenbetonten Signals, logarithmisch;
// der steilste Anstieg nahe dem Schlag markiert den Beginn des Anschlags. Einzelne Schläge streuen
// (Spieler, Strum, Hall) – darum wird das Raster robust über viele Schläge angepasst:
// gleichmäßiges Tempo → eine Gerade durch alle Anschläge, schwankendes Tempo → gleitend über ±4 Schläge.
function onsetFinder(x, sr) {
  const W = Math.max(2, Math.round(0.003 * sr)), lag = Math.max(1, Math.round(0.006 * sr)), n = x.length;
  const cs = new Float64Array(n + 1); let prev = 0;
  for (let i = 0; i < n; i++) { const y = x[i] - 0.95 * prev; prev = x[i]; cs[i + 1] = cs[i] + y * y; }
  const E = i => (i < W || i > n) ? 0 : (cs[i] - cs[i - W]) / W;
  const samp = []; for (let i = W; i < n; i += 97) samp.push(E(i)); samp.sort((a, b) => a - b);
  const floor = Math.max(1e-12, (samp[samp.length >> 1] || 0) * 0.05);
  // Anschlag in [t − before, t + after]: Zeit (s) und Stärke (log. Anstieg)
  return (t, before, after) => {
    const a = Math.max(W + lag, Math.round((t - before) * sr)), b = Math.min(n, Math.round((t + after) * sr));
    let best = -1e9, bi = -1;
    const D = i => Math.log(E(i) + floor) - Math.log(E(i - lag) + floor);
    for (let i = a; i < b; i++) { const d = D(i); if (d > best) { best = d; bi = i; } }
    if (bi < 0) return null;
    // Der steilste Anstieg liegt bei Akkorden/Strums etwas nach der ersten Saite – das entspricht dem
    // gehörten Schlag (bei Strums ~5–10 ms nach dem ersten Ton). Der Schnitt bleibt trotzdem sauber,
    // weil die 10 ms vor Takt 1 ans Loopende wandern.
    return { t: (bi - W * 0.5) / sr - 0.0017, s: best };
  };
}
// Gewichtete, robuste Gerade t = a + b·i (Ausreißer > max(6 ms, 3·MAD) fliegen raus)
function robustLine(ix, ts, ws) {
  let use = ws.slice(), fit = null;
  for (let it = 0; it < 4; it++) {
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let k = 0; k < ix.length; k++) { const w = use[k]; if (!w) continue; sw += w; sx += w * ix[k]; sy += w * ts[k]; sxx += w * ix[k] * ix[k]; sxy += w * ix[k] * ts[k]; }
    if (sw <= 0) return null;
    const den = sw * sxx - sx * sx;
    const b = Math.abs(den) < 1e-12 ? 0 : (sw * sxy - sx * sy) / den, a = (sy - b * sx) / sw;
    const res = ix.map((i, k) => ts[k] - (a + b * i));
    const act = res.filter((r, k) => ws[k] > 0).map(Math.abs).sort((p, q) => p - q);
    const mad = act.length ? act[act.length >> 1] : 0, thr = Math.max(0.006, 3 * mad);
    use = ws.map((w, k) => Math.abs(res[k]) < thr ? w : 0);
    const inl = use.filter(w => w > 0).length;
    fit = { a, b, mad, inl, n: ws.filter(w => w > 0).length };
  }
  return fit;
}
function beatRefine(x, sr, times, steady) {
  const nb = times.length; if (nb < 4) return null;
  const find = onsetFinder(x, sr);
  const bt = (times[nb - 1] - times[0]) / (nb - 1);
  const before = Math.min(0.05, bt * 0.3), after = Math.min(0.035, bt * 0.22);
  const on = times.map(t => find(t, before, after));
  const ts = on.map((o, i) => o ? o.t : times[i]);
  const ws = on.map(o => o ? Math.max(0, Math.min(1, (o.s - 0.4) / 1.6)) : 0);
  const ix = times.map((_, i) => i);
  if (ws.filter(w => w > 0).length < Math.max(4, nb * 0.3)) return null;
  let out;
  if (steady) {
    const f = robustLine(ix, ts, ws);
    if (!f || f.inl < Math.max(4, nb * 0.3)) return null;
    // Gegenprobe: die feine Gerade darf das grobe Raster nicht mehr als 40 ms verlassen
    const c = robustLine(ix, times, times.map(() => 1));
    if (c && (Math.abs((f.a + f.b * (nb >> 1)) - (c.a + c.b * (nb >> 1))) > 0.04 || Math.abs(f.b / c.b - 1) > 0.004)) return null;
    out = ix.map(i => f.a + f.b * i);
    return { times: out, info: { mode: 'gerade', madMs: f.mad * 1000, inliers: f.inl / nb } };
  }
  // schwankendes Tempo: gleitende Gerade über ±4 Schläge, gestützt durch das grobe Raster
  out = times.slice(); let used = 0;
  for (let i = 0; i < nb; i++) {
    const a = Math.max(0, i - 4), e = Math.min(nb, i + 5);
    const f = robustLine(ix.slice(a, e), ts.slice(a, e), ws.slice(a, e));
    if (f && f.inl >= 4) { const v = f.a + f.b * i; if (Math.abs(v - times[i]) < 0.04) { out[i] = v; used++; } }
  }
  for (let i = 1; i < nb; i++) if (out[i] <= out[i - 1] + bt * 0.5) out[i] = out[i - 1] + bt * 0.5;
  return { times: out, info: { mode: 'gleitend', used: used / nb } };
}

// Loop-Analyse: Datei (oder Spur) als Schleife betrachten. Kurze Loops werden für die Messung
// aneinandergehängt. Ergebnis: ganze Taktzahl, ob die Länge genau passt, Lage von Takt 1 im Loop.
function loopAnalyse(x, sr, opts) {
  const len = x.length, Ls = len / sr;
  if (Ls < 0.6) return null;
  const k = Math.max(2, Math.ceil(16 / Ls));
  const tiled = new Float32Array(len * k);
  for (let i = 0; i < k; i++) tiled.set(x, i * len);
  let r = beatAnalyse(tiled, sr, opts);
  if (!r) return null;
  // Welche Tempo-Oktave ergibt ganze Takte? Erkanntes Tempo bevorzugen.
  let best = null;
  // Bekanntes Tempo als Hinweis: passende Oktave direkt nehmen
  if (opts && opts.hintBpm) for (const m of [1, 2, 0.5]) {
    const bpm = r.bpm * m;
    if (Math.abs(bpm - opts.hintBpm) / opts.hintBpm < 0.04) {
      const barsF = Ls / (240 / bpm), bars = Math.max(1, Math.round(barsF));
      best = { m, bpm, barsF, bars, err: Math.abs(barsF - bars) / bars, sc: 0 };
    }
  }
  if (!best) for (const m of [1, 2, 0.5]) {
    const bpm = r.bpm * m; if (bpm < 45 || bpm > 240) continue;
    const barsF = Ls / (240 / bpm), bars = Math.max(1, Math.round(barsF));
    const err = Math.abs(barsF - bars) / bars;
    const sc = err + (m === 1 ? 0 : 0.012);
    if (!best || sc < best.sc) best = { m, bpm, barsF, bars, err, sc };
  }
  const isLoop = best.err < 0.03;
  // Andere Tempo-Oktave als erkannt: Raster und Takt 1 mit dem korrigierten Tempo neu bestimmen
  if (best.m !== 1) { const r2 = beatAnalyse(tiled, sr, Object.assign({}, opts, { forceBpm: best.bpm })); if (r2) r = r2; }
  // Takt 1 im Loop: zirkulärer Mittelwert der erkannten Einsen modulo Loop-Länge
  const downs = r.downbeats.slice();
  let sx = 0, sy = 0;
  downs.forEach(t => { const a = 2 * Math.PI * ((t % Ls) / Ls) * best.bars; sx += Math.cos(a); sy += Math.sin(a); });
  let ang = Math.atan2(sy, sx); if (ang < 0) ang += 2 * Math.PI;
  const barLen = Ls / best.bars;
  let off = (ang / (2 * Math.PI)) * barLen;                  // Lage von Takt 1 innerhalb eines Takts
  if (off > barLen / 2) off -= barLen;                       // nächstliegend: leicht vor oder nach dem Anfang
  // Loop-Dateien beginnen fast immer auf Takt 1: liegt der Anfang auf einem Schlag, bleibt er Takt 1
  const bs = barLen / 4;
  let onBeat = off % bs; if (onBeat > bs / 2) onBeat -= bs; if (onBeat < -bs / 2) onBeat += bs;
  let startKept = false;
  if (isLoop && Math.abs(onBeat) < 0.035 && !(opts && opts.trustDownbeat)) {
    // Auf ganze Takte genau geschnitten (Export aus einer DAW/Loop-Sammlung): Dateianfang ist exakt Takt 1.
    // Weiche Anschläge (Pads, Hall) wirken sonst ein paar ms „später“ – das darf den Loop nicht verschieben.
    const exact = Math.abs((best.barsF - best.bars) * barLen) < 0.003;
    off = exact && Math.abs(onBeat) < 0.02 ? 0 : onBeat; startKept = true;
  }
  return {
    bpm: isLoop ? 240 * best.bars / Ls : best.bpm, detectedBpm: r.bpm, bars: best.bars, barsF: best.barsF,
    isLoop, lenErrMs: (best.barsF - best.bars) * barLen * 1000, downOffsetSec: off, startKept, confidence: r.confidence,
    beatSec: isLoop ? barLen / 4 : 60 / best.bpm
  };
}
