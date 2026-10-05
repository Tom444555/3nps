// Bewertung der Tonart-Erkennung: nur Chroma (bisher) gegen Chroma + Akkordfolge (neu)
const fs = require('fs'), path = require('path');
eval.call(global, fs.readFileSync(path.join(__dirname, 'fft.js'), 'utf8'));
eval.call(global, fs.readFileSync(path.join(__dirname, '../app/chords.js'), 'utf8'));
const an = fs.readFileSync(path.join(__dirname, '../app/analysis.js'), 'utf8');
eval.call(global, an.slice(0, an.indexOf('const Analyzer')) + an.slice(an.indexOf('// ---- Tonart aus Akkordfolge')));
const sp = fs.readFileSync(path.join(__dirname, '../script.part'), 'utf8');
const grab = n => { const a = sp.indexOf('function ' + n); return sp.slice(a, sp.indexOf('\n}\n', a) + 3); };
eval.call(global, grab('pearsonCorrelate') + grab('detectKeyFromChroma'));
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
const lab = k => NAMES[k.pc] + (k.major ? '' : 'm');
let O = 0, Nw = 0, N = 0, rel = 0;
const dirs = (process.argv[2] || 'keys,chords').split(',');
for (const dn of dirs) {
  const dir = path.join(__dirname, dn);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.wav')).sort()) {
    const gt = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.wav', '.json'))));
    let truth = gt.key;
    if (!truth) { const KEYS = { c_pop_strum: [0, 1], c_pop_drums: [7, 1], c_minor_arp: [9, 0], c_jazz_piano: [0, 1], c_detuned_flat: [4, 0], c_detuned_sharp: [5, 1], c_half_bar: [0, 1], c_dist_triads: [4, 0], c_dim_piano: [0, 1], c_nobass_arp: [2, 1], c_minor_drums: [2, 0] }[gt.name]; if (!KEYS) continue; truth = { pc: KEYS[0], major: !!KEYS[1] }; }
    const w = readWav(path.join(dir, f)), m = downmix(w.data, w.sr);
    const c = chromaMono(m.data, m.sr), old = detectKeyFromChroma(c.chroma);
    const bt = 60 / gt.bpm, beats = gt.labels.map((_, i) => i * bt);
    const r = chordAnalyse(m.data, m.sr, beats, { loop: true, downIndex: 0 });
    const nw = keyFromChords(r.segments, c.chroma, { loop: true });
    const ok = k => k.pc === truth.pc && k.major === truth.major;
    O += ok(old); Nw += ok(nw); N++;
    if (!ok(nw) && ((truth.major && nw.pc === (truth.pc + 9) % 12 && !nw.major) || (!truth.major && nw.pc === (truth.pc + 3) % 12 && nw.major))) rel++;
    if (!ok(nw) || !ok(old) || process.env.V) console.log(gt.name.padEnd(16), 'Soll', lab(truth).padEnd(4), 'bisher', lab(old).padEnd(4) + (ok(old) ? '✓' : '✗'), ' neu', lab(nw).padEnd(4) + (ok(nw) ? '✓' : '✗'), 'Abstand', nw.margin.toFixed(2), ' ', gt.prog || '', '·', r.segments.map(s => s.name).join(' '));
  }
}
console.log(`\nTonart richtig: bisher ${O}/${N} · neu ${Nw}/${N} (davon Parallel-Verwechslungen neu: ${rel})`);
