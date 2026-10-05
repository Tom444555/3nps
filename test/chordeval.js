// Bewertung der Akkorderkennung je Schlag: Grundton, Dur/Moll-Ebene, exakter Typ
const fs = require('fs'), path = require('path');
eval.call(global, fs.readFileSync(path.join(__dirname, 'fft.js'), 'utf8'));
eval.call(global, fs.readFileSync(path.join(__dirname, '../app/chords.js'), 'utf8'));
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
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const parse = l => { const m = /^([A-G]#?)(.*)$/.exec(l); return { r: NAMES.indexOf(m[1]), t: m[2] }; };
const mm = t => ({ '': 'maj', '7': 'maj', 'maj7': 'maj', 'm': 'min', 'm7': 'min', 'dim': 'min', '5': 'maj', 'sus4': 'sus', 'sus2': 'sus', '6': 'maj', 'm6': 'min' }[t]);
let R = 0, MM = 0, EX = 0, N = 0;
const dir = path.join(__dirname, 'chords');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.wav')).sort()) {
  const gt = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.wav', '.json'))));
  const w = readWav(path.join(dir, f)), m = downmix(w.data, w.sr);
  const bt = 60 / gt.bpm, beats = gt.labels.map((_, i) => i * bt);
  const t0 = Date.now(); const r = chordAnalyse(m.data, m.sr, beats, Object.assign({ loop: true }, JSON.parse(process.env.CO || '{}'))); const ms = Date.now() - t0;
  let r1 = 0, m1 = 0, e1 = 0;
  gt.labels.forEach((l, i) => { const g = parse(l), p = r.perBeat[i] === '–' ? { r: -1, t: null } : parse(r.perBeat[i]);
    if (p.r === g.r) { r1++; if (mm(p.t) === mm(g.t) || (g.t === '5' && (p.t === '' || p.t === 'm'))) m1++; if (p.t === g.t) e1++; } });
  const nb = gt.labels.length; R += r1; MM += m1; EX += e1; N += nb;
  const sum = r.segments.map(s => s.name + (s.beats !== 4 ? '(' + s.beats + ')' : '')).join(' ');
  const gsum = []; gt.labels.forEach((l, i) => { if (!i || l !== gt.labels[i - 1]) gsum.push(l); });
  console.log(gt.name.padEnd(18), 'Grundton', (r1 / nb * 100).toFixed(0).padStart(3) + '%', 'Dur/Moll', (m1 / nb * 100).toFixed(0).padStart(3) + '%', 'exakt', (e1 / nb * 100).toFixed(0).padStart(3) + '%', ' Soll:', gsum.join(' '), ' Ist:', sum, '·', r.tuneCents + ' ct', ms + 'ms');
}
console.log(`\nGESAMT Grundton ${(R / N * 100).toFixed(1)}% · Dur/Moll ${(MM / N * 100).toFixed(1)}% · exakt ${(EX / N * 100).toFixed(1)}%`);
