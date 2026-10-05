// Experiment: Feinbestimmung der Anschlagzeiten (Varianten gegen die Ground Truth)
const fs = require('fs'), path = require('path');
eval.call(global, fs.readFileSync(path.join(__dirname, 'fft.js'), 'utf8'));
eval.call(global, fs.readFileSync(path.join(__dirname, '../app/beat.js'), 'utf8'));
function readWav(p) {
  const b = fs.readFileSync(p); let o = 12, sr = 0, ch = 1, data = null;
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); }
    if (id === 'data') { const n = len / 2 / ch; data = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += b.readInt16LE(o + 8 + (i * ch + c) * 2); data[i] = s / ch / 32768; } }
    o += 8 + len + (len & 1); }
  return { sr, data };
}
function downmix(x, sr) { const f = Math.max(1, Math.floor(sr / 11025)), n = Math.floor(x.length / f), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < f; j++) s += x[i * f + j]; o[i] = s / f; } return { data: o, sr: sr / f }; }
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// Variante: Energie der (hochpass-betonten) Differenz in kurzen Fenstern, log, Anstieg über „lag“
function makeRefiner(x, sr, P) {
  const W = Math.max(2, Math.round(P.win * sr)), lag = Math.max(1, Math.round(P.lag * sr));
  const n = x.length, e = new Float32Array(n);
  // hochpass: y = x - a*x[-1]
  let prev = 0; for (let i = 0; i < n; i++) { const y = x[i] - P.pre * prev; prev = x[i]; e[i] = y * y; }
  // laufende Summe (nachlaufendes Fenster)
  const cs = new Float64Array(n + 1); for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + e[i];
  const E = i => (i < W || i > n) ? 0 : (cs[i] - cs[i - W]) / W;
  // globale Untergrenze: Median der Energie
  const samp = []; for (let i = W; i < n; i += 97) samp.push(E(i)); samp.sort((a, b) => a - b);
  const floor = Math.max(1e-10, samp[samp.length >> 1] * P.floor);
  return t => {
    const a = Math.max(W + lag, Math.round((t - P.before) * sr)), b = Math.min(n, Math.round((t + P.after) * sr));
    let best = -1e9, bi = -1;
    for (let i = a; i < b; i++) { const d = Math.log(E(i) + floor) - Math.log(E(i - lag) + floor); if (d > best) { best = d; bi = i; } }
    if (bi < 0) return { t, s: 0 };
    return { t: (bi - W * P.wk) / sr + P.off, s: best };
  };
}

const variants = [];
for (const win of [0.001, 0.002, 0.003]) for (const lag of [0.003, 0.006]) for (const pre of [0, 0.95]) for (const wk of [0.5, 1])
  variants.push({ win, lag, pre, wk, floor: 0.05, before: 0.05, after: 0.035, off: 0 });
const res = variants.map(() => ({ errs: { corpus: [], valid: [], hard: [] } }));
const coarse = { corpus: [], valid: [], hard: [] };
for (const set of ['corpus', 'valid', 'hard']) {
  const dir = path.join(__dirname, set);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.wav')).sort()) {
    const gt = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.wav', '.json'))));
    const w = readWav(path.join(dir, f)), m = downmix(w.data, w.sr);
    const r = beatAnalyse(m.data, m.sr); if (!r) continue;
    // Paare (erkannter Schlag, echter Schlag)
    const pairs = [];
    for (const p of r.beats) { let best = null; for (const b of gt.beats) if (best === null || Math.abs(b - p) < Math.abs(best - p)) best = b; if (Math.abs(best - p) < 0.06) pairs.push([p, best]); }
    pairs.forEach(([p, b]) => coarse[set].push((p - b) * 1000));
    variants.forEach((P, vi) => {
      const ref = makeRefiner(m.data, m.sr, P);
      pairs.forEach(([p, b]) => { const q = ref(p); res[vi].errs[set].push((q.t - b) * 1000); });
    });
  }
}
const summ = a => { const ab = a.map(Math.abs); const bias = a.reduce((x, y) => x + y, 0) / a.length; return `bias ${bias.toFixed(1).padStart(6)} med ${pct(ab, 0.5).toFixed(1).padStart(5)} p90 ${pct(ab, 0.9).toFixed(1).padStart(5)}`; };
console.log('grob      ', Object.entries(coarse).map(([k, a]) => k + ': ' + summ(a)).join(' | '));
variants.forEach((P, vi) => {
  // Fehler nach Abzug eines gemeinsamen Bias (über corpus+valid bestimmt) – zählt die Streuung und die Bias-Differenz zu „hard“
  const cv = res[vi].errs.corpus.concat(res[vi].errs.valid); const b = pct(cv, 0.5);
  const adj = k => res[vi].errs[k].map(v => v - b);
  const sc = pct(adj('hard').map(Math.abs), 0.5) + pct(cv.map(v => Math.abs(v - b)), 0.5);
  P.sc = sc; P.b = b; P.line = `${JSON.stringify({ win: P.win, lag: P.lag, pre: P.pre, wk: P.wk })} off ${(-b).toFixed(1)}ms → ` + ['corpus', 'valid', 'hard'].map(k => k + ': ' + summ(adj(k))).join(' | ');
});
variants.sort((a, b) => a.sc - b.sc).slice(0, 10).forEach(P => console.log(P.sc.toFixed(2), P.line));
