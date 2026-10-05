// Debug: Kandidaten, Rollen, Wahl für einzelne Dateien. node dbg2.js <ordner> <name...>
const fs = require('fs'), path = require('path');
let src = fs.readFileSync(path.join(__dirname, '../app/beat.js'), 'utf8');
src = src.replace("  let chosen = scored[0];", "  let chosen = scored[0]; if (opts.debug) { console.log('  Kandidaten', scored.slice(0, 6).map(s => s.bpm.toFixed(1) + ' sc' + s.score.toFixed(3) + ' on' + s.m.on.toFixed(2) + ' o8' + s.m.off8.toFixed(2) + ' alt' + s.m.alt.toFixed(2) + ' a3' + (s.m.alt3||0).toFixed(2) + ' o3' + (s.m.off3||0).toFixed(2) + ' pr' + s.prior.toFixed(2)).join(' | ')); }");
src = src.replace("  if (!opts.forceBpm) {\n    const r0 = roles(chosen.g);", "  if (!opts.forceBpm) {\n    const r0 = roles(chosen.g); if (opts.debug) console.log('  Rollen', JSON.stringify(r0, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));");
src = src.replace("  let down = 0; for (let k = 1; k < 4; k++)", "  if (opts.debug) { const parts = [zLo, zNov, zOn, zHi].map(zz => { const a = [0, 0, 0, 0]; for (let i = 0; i < nb; i++) a[i % 4] += zz[i] / dct[i % 4]; return a.map(v => v.toFixed(2)).join('/'); }); console.log('  Eins: Lo', parts[0], 'Nov', parts[1], 'On', parts[2], 'Hi', parts[3], 'Nov4', (() => { const a = [0, 0, 0, 0]; for (let i = 0; i < nb; i++) a[i % 4] += zNov4[i] / dct[i % 4]; return a.map(v => v.toFixed(2)).join('/'); })(), 'Summe', dsc.map((v, k) => (v / dct[k]).toFixed(2)).join('/')); }\n  let down = 0; for (let k = 1; k < 4; k++)");
src = src.replace("  const P = chosen.g.p;", "  const P = chosen.g.p; if (opts.debug) console.log('  gewählt', chosen.bpm.toFixed(2), chosen.octave || '');");
eval.call(global, fs.readFileSync(path.join(__dirname, 'fft.js'), 'utf8'));
eval.call(global, src);
function readWav(p) { const b = fs.readFileSync(p); let o = 12, sr = 0, data = null;
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(o + 12);
    if (id === 'data') { data = new Float32Array(len / 2); for (let i = 0; i < data.length; i++) data[i] = b.readInt16LE(o + 8 + i * 2) / 32768; }
    o += 8 + len + (len & 1); } return { sr, data }; }
function downmix(x, sr) { const f = Math.max(1, Math.floor(sr / 11025)), n = Math.floor(x.length / f), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < f; j++) s += x[i * f + j]; o[i] = s / f; } return { data: o, sr: sr / f }; }
const dir = path.join(__dirname, process.argv[2]);
for (const n of process.argv.slice(3)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.wav') && f.includes(n))) {
  const gt = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.wav', '.json'))));
  const w = readWav(path.join(dir, f)), m = downmix(w.data, w.sr);
  console.log(f, 'Soll', gt.bpm);
  const r = beatAnalyse(m.data, m.sr, { debug: true, downW: (process.env.W || '0.8,0.8,0,-1,2.5').split(',').map(Number) });
  const gd = gt.downbeats; const ph = Math.round(((r.firstDownbeat - gd[0]) / (60 / r.bpm)) % 4 + 8) % 4; console.log('  Ergebnis', r.bpm.toFixed(2), 'Konf', r.confidence.toFixed(2), 'downIdx', r.downIndex, 'Fehler in Schlägen', ph);
}
