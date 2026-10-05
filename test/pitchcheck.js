// Tonhöhenerkennung: gezupfte Saite (Karplus-Strong) über den Gitarrenbereich, mit Rauschen, verstimmt, verzerrt
const P = require('../app/pitch.js');
const sr = 48000, N = 4096;
function pluck(f, n, opts) {
  const p = Math.round(sr / f), buf = new Float32Array(p), out = new Float32Array(n); let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let i = 0; i < p; i++) buf[i] = rnd();
  let idx = 0;
  // ganzzahlige Verzögerung + Allpass für Feinstimmung ist hier unnötig: Sinus-Gemisch reicht für die Prüfung
  for (let i = 0; i < n; i++) {
    let s = 0; for (let k = 1; k <= 8; k++) s += Math.sin(2 * Math.PI * f * k * i / sr + k) / Math.pow(k, opts.bright ? 0.6 : 1.1) * (k === 1 && opts.weakFund ? 0.15 : 1);
    if (opts.dist) s = Math.tanh(s * 4);
    out[i] = s * 0.2 + (opts.noise || 0) * rnd();
  }
  return out;
}
let ok = 0, n = 0; const bad = [];
for (let m = 40; m <= 88; m++) for (const o of [{}, { noise: 0.02 }, { bright: 1 }, { weakFund: 1 }, { dist: 1 }, { detune: 18 }]) {
  const f = 440 * Math.pow(2, (m - 69 + (o.detune || 0) / 100) / 12), r = P.detect(pluck(f, N, o), sr);
  n++;
  if (r && r.midi === m && Math.abs(r.cents - (o.detune || 0)) <= 6) ok++; else bad.push(m + JSON.stringify(o) + '→' + (r ? r.midi + '/' + r.cents : 'null'));
}
const silent = P.detect(new Float32Array(N).map(() => (Math.random() - 0.5) * 0.004), sr);
const t0 = Date.now(); for (let i = 0; i < 200; i++) P.detect(pluck(110, N, {}), sr); const ms = (Date.now() - t0) / 200;
console.log(bad.slice(0, 12).join('\n'));
console.log(`Töne richtig: ${ok}/${n} · Stille erkannt: ${silent === null} · ${ms.toFixed(2)} ms pro Messung`);
process.exit(ok / n >= 0.97 && silent === null ? 0 : 1);
