// Genauigkeit der Takterkennung in Millisekunden (nicht nur „innerhalb 50 ms“).
// Aufruf: node precision.js [beat.js] [corpus …]
const fs = require('fs'), path = require('path');
const beatFile = process.argv[2] && process.argv[2].endsWith('.js') ? process.argv[2] : '../app/beat.js';
const sets = process.argv.slice(2).filter(a => !a.endsWith('.js'));
eval.call(global, fs.readFileSync(path.join(__dirname, 'fft.js'), 'utf8'));
eval.call(global, fs.readFileSync(path.resolve(__dirname, beatFile), 'utf8'));
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
const pct = (a, q) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const all = { tempo: 0, down: 0, n: 0, errs: [], bias: [], dErr: [] };
for (const set of (sets.length ? sets : ['corpus', 'valid', 'hard'])) {
  const dir = path.join(__dirname, set);
  let tOk = 0, dOk = 0, n = 0; const errsSet = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.wav')).sort()) {
    const jf = path.join(dir, f.replace('.wav', '.json')); if (!fs.existsSync(jf)) continue;
    const gt = JSON.parse(fs.readFileSync(jf)); const w = readWav(path.join(dir, f)), m = downmix(w.data, w.sr);
    const t0 = Date.now(); const r = beatAnalyse(m.data, m.sr); const ms = Date.now() - t0; n++;
    if (!r) { console.log(gt.name.padEnd(24), 'KEIN ERGEBNIS'); continue; }
    const terr = (r.bpm - gt.bpm) / gt.bpm;
    // jede echte Schlagzeit nach dem ersten erkannten Schlag → nächster erkannter Schlag
    const e = [];
    for (const b of gt.beats) { if (b < r.beats[0] - 0.1 || b > r.beats[r.beats.length - 1] + 0.1) continue; let best = 9; for (const p of r.beats) if (Math.abs(p - b) < Math.abs(best)) best = p - b; if (Math.abs(best) < 0.25 * 60 / gt.bpm) e.push(best * 1000); }
    const hitShare = e.length / Math.max(1, gt.beats.filter(b => b >= r.beats[0] - 0.1).length);
    const ae = e.map(Math.abs), med = pct(ae, 0.5), p90 = pct(ae, 0.9), bias = e.reduce((a, b) => a + b, 0) / Math.max(1, e.length);
    const dErr = Math.min(...gt.downbeats.map(d => Math.abs(d - r.firstDownbeat)));
    const downOk = dErr < 0.05 && r.downbeats.every(d => gt.downbeats.some(g => Math.abs(g - d) < 0.06) || d > gt.beats[gt.beats.length - 1] - 0.1 || d < gt.downbeats[0] - 0.1);
    if (Math.abs(terr) < 0.01) tOk++; if (downOk) dOk++; errsSet.push(...ae); all.errs.push(...ae); all.bias.push(bias);
    console.log(gt.name.padEnd(24), String(gt.bpm).padEnd(6), r.bpm.toFixed(2).padEnd(8), (terr * 100).toFixed(2).padStart(6) + '%',
      ' Schlag med ' + med.toFixed(1).padStart(5) + 'ms p90 ' + p90.toFixed(1).padStart(5) + 'ms bias ' + bias.toFixed(1).padStart(6) + 'ms getroffen ' + (hitShare * 100).toFixed(0).padStart(3) + '%',
      ' Eins ' + (downOk ? 'ok ' : 'FALSCH') + ' ' + (dErr * 1000).toFixed(0).padStart(4) + 'ms', ms + 'ms');
  }
  all.tempo += tOk; all.down += dOk; all.n += n;
  console.log(`== ${set}: Tempo ${tOk}/${n} · Eins ${dOk}/${n} · Schlagfehler median ${pct(errsSet, 0.5).toFixed(1)} ms, p90 ${pct(errsSet, 0.9).toFixed(1)} ms\n`);
}
console.log(`GESAMT Tempo ${all.tempo}/${all.n} · Eins ${all.down}/${all.n} · Schlagfehler median ${pct(all.errs, 0.5).toFixed(1)} ms, p90 ${pct(all.errs, 0.9).toFixed(1)} ms, p99 ${pct(all.errs, 0.99).toFixed(1)} ms`);
