// v96: Signalsmith-Offline-Dehnung prüfen (Tonhöhe bleibt, Einsätze liegen richtig, keine Übersteuerung)
const vm = require('vm'), fs = require('fs'), path = require('path');
const D = path.join(__dirname, '../app/www/stretch/');
globalThis.self = globalThis;
globalThis.importScripts = f => vm.runInThisContext(fs.readFileSync(D + f, 'utf8'));
const { run } = require(D + 'worker.js');
const sr = 48000;
function sig(sec) {   // 220-Hz-Ton, Einsätze (Ton an) bei 0,5 / 1,0 / 1,5 s
  const n = sec * sr, l = new Float32Array(n), r = new Float32Array(n);
  for (const on of [0.5, 1.0, 1.5]) for (let i = 0; i < 0.25 * sr; i++) { const k = Math.round(on * sr) + i; const v = 0.5 * Math.sin(2 * Math.PI * 220 * i / sr) * Math.exp(-i / (0.05 * sr)); l[k] += v; r[k] += v * 0.8; }
  return { l, r };
}
function onsets(x) { const o = []; let armed = true; const w = 128; for (let i = 0; i + w < x.length; i += 32) { let e = 0; for (let j = 0; j < w; j++) e += x[i + j] * x[i + j]; e = Math.sqrt(e / w); if (armed && e > 0.1) { o.push(i / sr); armed = false; } else if (e < 0.01) armed = true; } return o; }
function freq(x, a, b) { let z = 0; for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) z++; return z / ((b - a) / sr); }
(async () => {
  let ok = true; const s = sig(2.2);
  for (const rate of [0.5, 0.75, 1.25]) {
    const n = Math.round(s.l.length / rate), t0 = Date.now(), y = await run(s.l, s.r, n, sr), ms = Date.now() - t0;
    const on = onsets(y.l), want = onsets(s.l).map(t => t / rate);
    let peak = 0; for (const v of y.l) peak = Math.max(peak, Math.abs(v));
    const f = freq(y.l, Math.round((want[0] + 0.01) * sr), Math.round((want[0] + 0.19) * sr));
    const err = on.length === 3 ? Math.max(...on.map((t, i) => Math.abs(t - want[i]) * 1000)) : 999;
    const good = y.l.length === n && on.length === 3 && err < 25 && Math.abs(f - 220) < 8 && peak < 0.8 && y.r.length === n;
    console.log((good ? 'OK ' : 'FEHLER ') + `Tempo ${rate * 100} %: Länge ${y.l.length}/${n}, Einsätze ${on.map(t => t.toFixed(3))} (soll ${want.map(t => t.toFixed(3))}, Abw. ${err.toFixed(1)} ms), Ton ${f.toFixed(1)} Hz, Spitze ${peak.toFixed(2)}, ${ms} ms`);
    ok = ok && good;
  }
  console.log(ok ? 'ALLES OK' : 'FEHLGESCHLAGEN'); process.exit(ok ? 0 : 1);
})();
