// Gewichte für die Takt-Eins durchprobieren: node downw.js "w1,w2,w3,w4,w5" ...
const fs = require('fs'), path = require('path');
eval.call(global, fs.readFileSync('fft.js', 'utf8')); eval.call(global, fs.readFileSync('../app/beat.js', 'utf8'));
function readWav(p) { const b = fs.readFileSync(p); let o = 12, sr = 0, data = null; while (o < b.length) { const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4); if (id === 'fmt ') sr = b.readUInt32LE(o + 12); if (id === 'data') { data = new Float32Array(len / 2); for (let i = 0; i < data.length; i++) data[i] = b.readInt16LE(o + 8 + i * 2) / 32768; } o += 8 + len + (len & 1); } return { sr, data }; }
const files = [];
for (const set of ['corpus', 'valid', 'hard']) for (const f of fs.readdirSync(set).filter(f => f.endsWith('.wav'))) {
  const gt = JSON.parse(fs.readFileSync(path.join(set, f.replace('.wav', '.json')))); const w = readWav(path.join(set, f));
  const m = new Float32Array(Math.floor(w.data.length / 2)); for (let i = 0; i < m.length; i++) m[i] = (w.data[2 * i] + w.data[2 * i + 1]) / 2;
  files.push({ name: f, gt, m, sr: w.sr / 2 });
}
for (const ws of process.argv.slice(2)) {
  const W = ws.split(',').map(Number); let ok = 0, n = 0; const bad = [];
  for (const F of files) {
    const r = beatAnalyse(F.m, F.sr, { downW: W.slice(0, 5), lagW: W.length > 5 ? W.slice(5) : [0.5, 0.3] }); if (!r) continue;
    if (Math.abs(r.bpm - F.gt.bpm) / F.gt.bpm > 0.03) continue;    // nur Stücke mit richtigem Tempo
    n++; const e = Math.min(...F.gt.downbeats.map(d => Math.abs(d - r.firstDownbeat)));
    if (e < 0.05) ok++; else bad.push(F.name.replace('.wav', ''));
  }
  console.log(ws, ok + '/' + n, bad.join(' '));
}
