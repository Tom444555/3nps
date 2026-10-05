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
  const flux = new Float32Array(nF), fluxLo = new Float32Array(nF), fluxHi = new Float32Array(nF), fluxMid = new Float32Array(nF);
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
      if (d > 0) { fa += d; if (b <= b150) fl += d; else if (b >= b2k) fh += d; else fm += d; }
      if (b >= bChLo && b <= bChHi) chroma[f * 12 + pcOfBin[b]] += mag;
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
  const O = clean(flux), OL = clean(fluxLo), OH = clean(fluxHi), OM = clean(fluxMid);
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
  peaks.slice(0, 4).forEach(([b]) => [1, 2, 0.5, 1.5, 2 / 3, 0.75, 4 / 3].forEach(m => { const v = b * m; if (v >= 50 && v <= 220) cand.add(Math.round(v * 2) / 2); }));

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
    let on = 0, off8 = 0, off16 = 0, ev = 0, od = 0, c = 0, k = 0;
    for (let t = g.ph; t + g.p < nF - 1; t += g.p, k++) {
      const v = peakAt(O, t, 1.5); on += v; off8 += peakAt(O, t + g.p / 2, 1.5); off16 += (peakAt(O, t + g.p / 4, 1) + peakAt(O, t + 3 * g.p / 4, 1)) / 2;
      if (k % 2) od += v; else ev += v; c++;
    }
    c = Math.max(1, c);
    return { on: on / c, off8: off8 / c, off16: off16 / c, alt: Math.max(ev, od) / Math.max(1e-6, Math.min(ev, od)) };
  }
  const scored = [...cand].map(b => { const g = fit(60 * fps / b); const m = metric(g); return { bpm: 60 * fps / g.p, g, m, sal: sal(60 * fps / g.p), prior: prior(60 * fps / g.p) }; });
  // Bewertung: Schlagstärke × Vorzug, Strafe für starkes Gerade/Ungerade-Gefälle (= eigentlich halbes Tempo)
  // und Strafe, wenn Achtel so stark sind wie Schläge (= eigentlich doppeltes Tempo)
  scored.forEach(s => {
    const altPen = s.m.alt > 2.6 ? Math.pow(2.6 / s.m.alt, 1.5) : 1;
    const offRatio = s.m.off8 / Math.max(1e-6, s.m.on);
    const offPen = offRatio > 0.8 ? Math.pow(0.8 / offRatio, 2) : 1;
    const contrast = s.m.on + 0.25 * s.m.off8 + 0.1 * s.m.off16;   // Schläge zählen, passende Unterteilungen bestätigen
    s.score = Math.max(0, contrast) * altPen * offPen * s.prior;
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
  if (!opts.forceBpm) {
    const r0 = roles(chosen.g);
    if (r0.aL >= 0.25 && r0.aH >= 0.18 && chosen.bpm / 2 >= 50) {
      const g = fit(chosen.g.p * 2); chosen = { bpm: 60 * fps / g.p, g, octave: 'halbiert' };
    } else if (chosen.bpm * 2 <= 220) {
      const g2 = fit(chosen.g.p / 2), r2 = roles(g2);
      // Bass auf den Achteln (Kick zwischen den Schlägen) oder Snare auf den Achteln bei leerem Doppel-Raster
      if ((r0.L8 > 1.4 && r0.H8 > 0.45) || (r0.H8 > 0.7 && r0.L8 > 0.8 && r2.H8 < 0.4)) chosen = { bpm: 60 * fps / g2.p, g: g2, octave: 'verdoppelt' };
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
  const z = arr => { const m = arr.reduce((a, b) => a + b, 0) / arr.length; const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) || 1; return arr.map(v => (v - m) / sd); };
  const zLo = z(featLo), zOn = z(featOn), zNov = z(nov), zHi = z(featHi);
  const dsc = [0, 0, 0, 0], dct = [0, 0, 0, 0];
  for (let i = 0; i < nb; i++) { const k = i % 4; dsc[k] += 1.0 * zLo[i] + 1.4 * zNov[i] + 0.4 * zOn[i] - 0.3 * zHi[i]; dct[k]++; }
  let down = 0; for (let k = 1; k < 4; k++) if (dsc[k] / dct[k] > dsc[down] / dct[down]) down = k;
  if (opts.downShift) down = (down + opts.downShift + 400) % 4;

  // ---------- Ergebnis ----------
  const tSec = f => (f * hop + N / 2) / sr + 0.024;      // geeicht: Anschlag liegt ~24 ms nach der Rahmenmitte
  const beatTimes = beats.map(tSec);
  const downbeats = []; for (let i = down; i < nb; i += 4) downbeats.push(beatTimes[i]);
  // Zuverlässigkeit: Anschläge auf dem Raster gegenüber dem Rest
  let onG = 0; beats.forEach(b => { onG += peakAt(O, b, 1.5); }); onG /= Math.max(1, nb);
  const conf = onG / meanO;
  return {
    bpm: 60 / (period / fps), beatSec: period / fps, firstDownbeat: downbeats[0], firstBeat: beatTimes[0],
    beats: beatTimes, downbeats, downIndex: down, steady, confidence: conf,
    alternatives: scored.slice(0, 3).map(s => Math.round(s.bpm * 10) / 10)
  };
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
  if (isLoop && Math.abs(onBeat) < 0.035 && !(opts && opts.trustDownbeat)) { off = onBeat; startKept = true; }
  return {
    bpm: isLoop ? 240 * best.bars / Ls : best.bpm, detectedBpm: r.bpm, bars: best.bars, barsF: best.barsF,
    isLoop, lenErrMs: (best.barsF - best.bars) * barLen * 1000, downOffsetSec: off, startKept, confidence: r.confidence,
    beatSec: isLoop ? barLen / 4 : 60 / best.bpm
  };
}
