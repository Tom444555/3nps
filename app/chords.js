// Akkorderkennung für Loops und Songs (läuft im Analyse-Worker).
// Ablauf: Spektrum (4096er-FFT) → harmonischer Anteil (Medianfilter trennt Schlagzeug ab) → Stimmung schätzen
// (Gitarre/Aufnahme leicht verstimmt) → Chroma (Mitten) und Bass-Chroma je Schlag → Vergleich mit Akkordvorlagen
// inkl. Obertönen → Glättung über die Schläge (Viterbi): Wechsel bevorzugt auf Takt- und Halbtaktgrenzen.
// x: Mono ~11–12 kHz, beats: Schlagzeiten (s) im Loop, opts.loop: Signal ist eine Schleife (Ende → Anfang).
const CHORD_TYPES = [
  ['', [0, 4, 7], 0], ['m', [0, 3, 7], 0], ['7', [0, 4, 7, 10], 0.025], ['maj7', [0, 4, 7, 11], 0.03], ['m7', [0, 3, 7, 10], 0.025],
  ['sus4', [0, 5, 7], 0.035], ['sus2', [0, 2, 7], 0.035], ['dim', [0, 3, 6], 0.045], ['5', [0, 7], 0.01],
  ['6', [0, 4, 7, 9], 0.02], ['m6', [0, 3, 7, 9], 0.04]
];
function chordAnalyse(x, sr, beats, opts) {
  opts = opts || {};
  const n = x.length, loop = opts.loop !== false, nb = beats.length;
  if (n < sr * 0.5 || nb < 1) return null;
  const M = 4096, H = n / sr > 90 ? 2048 : n / sr > 40 ? 1024 : 512;
  const win = new Float64Array(M); for (let i = 0; i < M; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / M);
  const bz = sr / M, kLo = Math.ceil(38 / bz), kHi = Math.min(M / 2 - 2, Math.floor((opts.midHi || 2100) / bz)), K = kHi - kLo + 1;
  // Rahmen: Mitte bei c = f·H; Schleife → am Ende vom Anfang weiterlesen
  const nF = Math.max(1, Math.ceil(n / H));
  const S = new Float32Array(nF * K), fr = new Float64Array(M);
  const at = j => loop ? x[((j % n) + n) % n] : (j >= 0 && j < n ? x[j] : 0);
  for (let f = 0; f < nF; f++) {
    const st = f * H - M / 2;
    for (let i = 0; i < M; i++) fr[i] = at(st + i) * win[i];
    const { re, im } = fft(fr);
    for (let k = 0; k < K; k++) { const b = k + kLo; S[f * K + k] = Math.log(1 + (opts.comp || 1) * Math.sqrt(re[b] * re[b] + im[b] * im[b])); }
  }
  // Harmonisch/perkussiv trennen: Median über die Zeit (Töne halten) gegen Median über die Frequenz (Schläge sind breit)
  // schneller Median kleiner Fenster (Einfügesortierung in einem festen Puffer)
  const scr = new Float32Array(32);
  const medOf = (cnt) => { for (let i = 1; i < cnt; i++) { const v = scr[i]; let j = i - 1; while (j >= 0 && scr[j] > v) { scr[j + 1] = scr[j]; j--; } scr[j + 1] = v; } return scr[cnt >> 1]; };
  const Hm = new Float32Array(nF * K), tw = Math.min(nF, 9), fw = 13, th = tw >> 1, fh = fw >> 1;
  for (let f = 0; f < nF; f++) {
    const rows = []; for (let d = -th; d <= th; d++) rows.push((loop ? ((f + d) % nF + nF) % nF : Math.max(0, Math.min(nF - 1, f + d))) * K);
    const base = f * K;
    for (let k = 0; k < K; k++) {
      for (let d = 0; d < rows.length; d++) scr[d] = S[rows[d] + k];
      const h = medOf(rows.length);
      let c = 0; for (let d = -fh; d <= fh; d++) { const kk = k + d < 0 ? 0 : k + d >= K ? K - 1 : k + d; scr[c++] = S[base + kk]; }
      const pp = medOf(c), m = h * h / (h * h + pp * pp + 1e-9);
      Hm[base + k] = S[base + k] * m;
    }
  }
  // Stimmung: Lage der Spektralspitzen relativ zum 440-Hz-Raster (Kreis-Mittel der Cent-Abweichung)
  let cx = 0, cy = 0;
  for (let f = 0; f < nF; f++) for (let k = 1; k < K - 1; k++) {
    const v = Hm[f * K + k]; if (v <= Hm[f * K + k - 1] || v <= Hm[f * K + k + 1]) continue;
    const a = Hm[f * K + k - 1], c = Hm[f * K + k + 1], d = 0.5 * (a - c) / (a - 2 * v + c || 1e-9);
    const freq = (k + kLo + d) * bz; if (freq < 100) continue;
    const m = 69 + 12 * Math.log2(freq / 440), ph = 2 * Math.PI * (m - Math.round(m));
    cx += v * Math.cos(ph); cy += v * Math.sin(ph);
  }
  const tune = Math.atan2(cy, cx) / (2 * Math.PI);          // in Halbtönen (−0,5 … +0,5)
  // Bin → Tonklasse mit Gewicht (nur nahe der Halbtonmitte), getrennt Bass (bis 220 Hz) und Mitten (110–2100 Hz)
  const pcB = new Int8Array(K), wB = new Float32Array(K), isBass = new Uint8Array(K), isMid = new Uint8Array(K);
  for (let k = 0; k < K; k++) {
    const f = (k + kLo) * bz, m = 69 + 12 * Math.log2(f / 440) - tune, r = Math.round(m), dev = Math.abs(m - r);
    pcB[k] = ((r % 12) + 12) % 12; wB[k] = Math.max(0, 1 - dev / 0.45) ** 2;
    isBass[k] = f < (opts.bassHi || 150) ? 1 : 0; isMid[k] = f >= (opts.midLo || 110) ? 1 : 0;
  }
  // Chroma je Rahmen
  const chM = new Float32Array(nF * 12), chB = new Float32Array(nF * 12), en = new Float32Array(nF);
  for (let f = 0; f < nF; f++) {
    for (let k = 0; k < K; k++) {
      const v = Hm[f * K + k] * wB[k]; if (!v) continue;
      if (isMid[k]) chM[f * 12 + pcB[k]] += v;
      if (isBass[k]) chB[f * 12 + pcB[k]] += v;
      en[f] += S[f * K + k];
    }
  }
  const enMed = (() => { const a = Array.from(en).sort((p, q) => p - q); return a[a.length >> 1] || 1e-9; })();
  // Je Schlag mitteln (Rahmenmitte im Schlag); Schläge aus einem kurzen Loop wiederholen sich – sie bleiben getrennt
  const Ls = n / sr, seg = beats.map((b, i) => [b, i + 1 < nb ? beats[i + 1] : (loop ? beats[0] + Ls : Ls)]);
  const beatCh = seg.map(([a, e]) => {
    const vm = new Float32Array(12), vb = new Float32Array(12); let c = 0, ee = 0;
    const f0 = Math.ceil(a * sr / H), f1 = Math.max(f0 + 1, Math.ceil(e * sr / H));
    for (let ff = f0; ff < f1; ff++) { const f = ((ff % nF) + nF) % nF; for (let p = 0; p < 12; p++) { vm[p] += chM[f * 12 + p]; vb[p] += chB[f * 12 + p]; } ee += en[f]; c++; }
    return { m: vm, b: vb, e: ee / Math.max(1, c) };
  });
  // Vorlagen mit Obertönen (Oktave, Quinte, Terz der Obertonreihe)
  const HARM = opts.harm || [[0, 1], [0, 0.55], [7, 0.4], [0, 0.3], [4, 0.2], [7, 0.15]];
  const temps = [];
  const TYPES = opts.extraTypes ? CHORD_TYPES.concat(opts.extraTypes) : CHORD_TYPES;
  for (let r = 0; r < 12; r++) for (const [suf, iv, pen] of TYPES) {
    const t = new Float32Array(12);
    iv.forEach((q, j) => HARM.forEach(([h, a]) => { t[(r + q + h) % 12] += a * (j === 0 ? 1.1 : (q === 10 || q === 11) ? 0.85 : 1); }));
    let s = 0; for (let p = 0; p < 12; p++) s += t[p] * t[p]; s = Math.sqrt(s); for (let p = 0; p < 12; p++) t[p] /= s;
    temps.push({ r, suf, iv, pen, t });
  }
  const NS = temps.length + 1;                                   // letzter Zustand: kein Akkord (Stille/Geräusch)
  const norm = v => { let s = 0; for (let p = 0; p < 12; p++) s += v[p] * v[p]; s = Math.sqrt(s) || 1; return Array.from(v, q => q / s); };
  // Pearson: Mittelwert abziehen – volle Vorlagen (Septakkorde) passen sonst zu jedem verschmierten Chroma
  const PEAR = opts.pearson !== false;
  const center = v => { const m = v.reduce((a, b) => a + b, 0) / 12; const c = v.map(q => q - m); let s = 0; c.forEach(q => { s += q * q; }); s = Math.sqrt(s) || 1; return c.map(q => q / s); };
  if (PEAR) temps.forEach(T => { T.tc = center(Array.from(T.t)); });
  const emis = beatCh.map(bc => {
    const out = new Float32Array(NS), m = PEAR ? center(Array.from(bc.m)) : norm(bc.m), b = norm(bc.b);
    const quiet = bc.e < enMed * 0.25;
    for (let s = 0; s < temps.length; s++) {
      const T = temps[s], tt = PEAR ? T.tc : T.t; let d = 0; for (let p = 0; p < 12; p++) d += m[p] * tt[p];
      // Bass auf dem Grundton stützt den Akkord, Bass auf einem fremden Ton schwächt ihn leicht
      let bs = b[T.r]; let inC = 0; T.iv.forEach(q => { inC = Math.max(inC, b[(T.r + q) % 12]); });
      out[s] = d - T.pen * (opts.penK || 3) + (opts.bassK != null ? opts.bassK : 0.12) * bs + 0.04 * inC - (quiet ? 0.3 : 0);
    }
    out[NS - 1] = quiet ? 0.75 : 0.35;
    return out;
  });
  if (opts.debug) opts.debugTop = emis.map((e, i) => Array.from(e).map((v, q) => [v, q]).sort((a, b) => b[0] - a[0]).slice(0, 4).map(([v, q]) => (q === NS - 1 ? 'N' : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][temps[q].r] + temps[q].suf) + ':' + v.toFixed(3)).join(' ') + ' | m ' + Array.from(beatCh[i].m, v => v.toFixed(0)).join(',') + ' | b ' + Array.from(beatCh[i].b, v => v.toFixed(0)).join(','));
  // Viterbi über die Schläge: Wechsel kosten etwas, auf der Eins am wenigsten
  const beatsPerBar = opts.beatsPerBar || 4, down0 = opts.downIndex || 0;
  const cost = i => { const k = ((i - down0) % beatsPerBar + beatsPerBar) % beatsPerBar; return k === 0 ? 0.05 : k === beatsPerBar / 2 ? 0.1 : 0.16; };
  let score = Float32Array.from(emis[0]); const back = [];
  for (let i = 1; i < nb; i++) {
    let bi = 0; for (let s = 1; s < NS; s++) if (score[s] > score[bi]) bi = s;
    const c = cost(i), nx = new Float32Array(NS), bk = new Int16Array(NS);
    for (let s = 0; s < NS; s++) { const stay = score[s], sw = score[bi] - c; if (stay >= sw) { nx[s] = stay + emis[i][s]; bk[s] = s; } else { nx[s] = sw + emis[i][s]; bk[s] = bi; } }
    score = nx; back.push(bk);
  }
  let s = 0; for (let q = 1; q < NS; q++) if (score[q] > score[s]) s = q;
  const path = new Array(nb); path[nb - 1] = s;
  for (let i = nb - 1; i > 0; i--) { s = back[i - 1][s]; path[i - 1] = s; }
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const lab = q => q === NS - 1 ? null : temps[q];
  const perBeat = path.map(q => { const T = lab(q); return T ? { name: NOTE[T.r] + T.suf, root: T.r, type: T.suf } : null; });
  // Abschnitte zusammenfassen
  const segs = [];
  perBeat.forEach((c, i) => {
    const nm = c ? c.name : '–';
    if (segs.length && segs[segs.length - 1].name === nm) { segs[segs.length - 1].end = seg[i][1]; segs[segs.length - 1].beats++; }
    else segs.push({ name: nm, root: c ? c.root : -1, type: c ? c.type : null, start: seg[i][0], end: seg[i][1], beat: i, beats: 1 });
  });
  // Schleife: gleicher Akkord am Ende und Anfang gehört zusammen (nur für die Anzeige getrennt lassen)
  return { segments: segs, perBeat: perBeat.map(c => c ? c.name : '–'), tuneCents: Math.round(tune * 100) };
}
