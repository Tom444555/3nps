// Akkord-Grundton über ganze Songs der „hard“-Sammlung (Blues-Schema bzw. Pop-Folge, Grundton je Takt)
const fs = require('fs'), path = require('path');
eval.call(global, fs.readFileSync(path.join(__dirname, 'fft.js'), 'utf8'));
eval.call(global, fs.readFileSync(path.join(__dirname, '../app/chords.js'), 'utf8'));
function readWav(p) { const b = fs.readFileSync(p); let o = 12, sr = 0, ch = 1, data = null;
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); }
    if (id === 'data') { const n = len / 2 / ch; data = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += b.readInt16LE(o + 8 + (i * ch + c) * 2); data[i] = s / ch / 32768; } }
    o += 8 + len + (len & 1); } return { sr, data }; }
function downmix(x, sr) { const f = Math.max(1, Math.floor(sr / 11025)), n = Math.floor(x.length / f), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < f; j++) s += x[i * f + j]; o[i] = s / f; } return { data: o, sr: sr / f }; }
const H = JSON.parse(fs.readFileSync(path.join(__dirname, 'hard_chords.json')));
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let ok = 0, n = 0;
for (const [name, h] of Object.entries(H)) {
  const gt = JSON.parse(fs.readFileSync(path.join(__dirname, 'hard', name + '.json')));
  if (h.guitar === 'slide') continue;
  const w = readWav(path.join(__dirname, 'hard', name + '.wav')), m = downmix(w.data, w.sr);
  const r = chordAnalyse(m.data, m.sr, gt.beats, Object.assign({ loop: false }, JSON.parse(process.env.CO || '{}')));
  let o1 = 0, c1 = 0;
  gt.beats.forEach((b, i) => { const bar = i >> 2; if ((gt.breaks || []).some(([a, l]) => bar >= a && bar < a + l)) return; const root = (h.key + h.prog[bar % h.prog.length] + 4) % 12; /* Gitarre und Bass liegen ab E */ c1++; const p = r.perBeat[i]; if (p !== '–' && N.indexOf(p.replace(/(maj7|m7|m6|sus4|sus2|dim|m|7|6|5)$/, '').replace(/m$/, '')) === root) o1++; });
  ok += o1; n += c1;
  console.log(name.padEnd(24), h.guitar.padEnd(7), 'Grundton', (o1 / c1 * 100).toFixed(0) + '%', ' ', r.segments.slice(0, 8).map(s => s.name + '(' + s.beats + ')').join(' '));
}
console.log(`\nGESAMT Grundton je Schlag ${(ok / n * 100).toFixed(1)}%`);
