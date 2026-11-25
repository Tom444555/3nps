// v153: Messbasis für die Takt-Eins. Je Fall: Tempo richtig?, Eins richtig?, um wie viele Schläge daneben.
// Aufruf: node einsmess.js [beat.js] [Sammlung …] [--json=datei]     (ohne Sammlung: corpus valid hard long blues gerade)
// Vergleich zweier Läufe: node einsmess.js --vergleich vorher.json nachher.json
// Gruppen: „Shuffle/Blues“ (feel shuffle/128, style shuffle oder Name mit shuffle/blues/boogie) und „Rest“.
const fs = require('fs'), path = require('path');
const A = process.argv.slice(2);
if (A[0] === '--vergleich') {
  const a = JSON.parse(fs.readFileSync(A[1])), b = JSON.parse(fs.readFileSync(A[2])); let worse = 0, better = 0, same = 0;
  for (const k of Object.keys(a)) { const x = a[k], y = b[k]; if (!y) { console.log('FEHLT', k); worse++; continue; }
    const dT = (y.tempoOk ? 1 : 0) - (x.tempoOk ? 1 : 0), dE = (y.einsOk ? 1 : 0) - (x.einsOk ? 1 : 0);
    if (dT < 0 || dE < 0) { worse++; console.log('SCHLECHTER', k, JSON.stringify(x), '→', JSON.stringify(y)); }
    else if (dT > 0 || dE > 0) { better++; console.log('besser    ', k, `Eins ${x.off} → ${y.off}`, `Tempo ${x.bpm} → ${y.bpm}`); }
    else { same++; if (x.off !== y.off || x.bpm !== y.bpm) console.log('anders    ', k, `Eins ${x.off} → ${y.off}`, `Tempo ${x.bpm} → ${y.bpm}`); } }
  console.log(`besser ${better} · gleich ${same} · schlechter ${worse}`); process.exit(worse ? 1 : 0);
}
const beatFile = A.find(a => a.endsWith('.js')) || '../app/beat.js';
const jsonOut = (A.find(a => a.startsWith('--json=')) || '').slice(7);
const sets = A.filter(a => !a.endsWith('.js') && !a.startsWith('--'));
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
const isBlues = gt => gt.feel ? (gt.feel === 'shuffle' || gt.feel === '128') : (gt.style === 'shuffle' || /shuffle|blues|boogie/i.test(gt.name));
const res = {}, sum = { B: { n: 0, t: 0, e: 0 }, R: { n: 0, t: 0, e: 0 } };
for (const set of (sets.length ? sets : ['corpus', 'valid', 'hard', 'long', 'blues', 'gerade'])) {
  const dir = path.join(__dirname, set);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.wav')).sort()) {
    const jf = path.join(dir, f.replace('.wav', '.json')); if (!fs.existsSync(jf)) continue;
    const gt = JSON.parse(fs.readFileSync(jf)), w = readWav(path.join(dir, f)), m = downmix(w.data, w.sr);
    const r = beatAnalyse(m.data, m.sr), grp = isBlues(gt) ? 'B' : 'R', key = set + '/' + gt.name; sum[grp].n++;
    if (!r) { res[key] = { grp, tempoOk: false, einsOk: false, bpm: 0, off: 'kein Ergebnis' }; continue; }
    const ratio = r.bpm / gt.bpm, tempoOk = Math.abs(ratio - 1) < 0.01;
    const tempo = tempoOk ? 'ok' : Math.abs(ratio - 0.5) < 0.01 ? '½' : Math.abs(ratio - 2) < 0.02 ? '2×' : 'falsch';
    // jede erkannte Eins im Bereich der echten Schläge: Abstand zur nächsten echten Eins in Schlägen (0 = richtig, ±1, 2)
    const bl = 60 / gt.bpm, last = gt.beats[gt.beats.length - 1], cls = {}; let n = 0, first = null;
    const firstGt = gt.first_bar != null ? gt.first_bar : gt.downbeats[0];
    for (const d of r.downbeats) { if (d < firstGt - 0.1 || d > last + 0.1) continue;
      let best = 99; for (const g of gt.downbeats) if (Math.abs(d - g) < Math.abs(best)) best = d - g;
      let o = Math.round(best / bl * 2) / 2; if (Math.abs(best - o * bl) > 0.06 && Number.isInteger(o)) o = 'neben dem Raster'; else if (o === -2) o = 2;
      cls[o] = (cls[o] || 0) + 1; n++; if (first === null) first = o; }
    const mode = Object.keys(cls).sort((p, q) => cls[q] - cls[p])[0], share0 = (cls[0] || 0) / Math.max(1, n);
    // „richtig“: erste Eins stimmt und mindestens 90 % aller Einsen liegen auf echten Einsen (bei halbem Tempo: jede erkannte Eins auf einer echten)
    const einsOk = first === 0 && share0 >= 0.9;
    res[key] = { grp, tempoOk, einsOk, bpm: +r.bpm.toFixed(1), tempo, off: einsOk ? '0' : (mode === '0' ? `erste ${first}, ${Math.round(share0 * 100)} % richtig` : String(mode)), conf: +r.downConf.toFixed(2) };
    if (tempoOk) sum[grp].t++; if (einsOk) sum[grp].e++;
    console.log((grp === 'B' ? 'Shuffle/Blues ' : 'Rest          ') + key.padEnd(36), ('Tempo ' + tempo).padEnd(13), einsOk ? 'Eins ok' : 'Eins FALSCH (Schläge daneben: ' + res[key].off + ')', ' Sicherheit ' + res[key].conf);
  }
}
console.log(`\nShuffle/Blues: Eins ${sum.B.e}/${sum.B.n} · Tempo ${sum.B.t}/${sum.B.n}`);
console.log(`Rest:          Eins ${sum.R.e}/${sum.R.n} · Tempo ${sum.R.t}/${sum.R.n}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(res, null, 1));
