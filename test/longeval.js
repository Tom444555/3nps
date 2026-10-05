// Lange Songs: Raster über das ganze Stück, Einsen durch Breaks/Halftime hindurch, Takt 1 nach freiem Intro.
const fs = require('fs'), path = require('path');
eval.call(global, fs.readFileSync(path.join(__dirname, 'fft.js'), 'utf8'));
eval.call(global, fs.readFileSync(path.join(__dirname, process.env.BEAT || '../app/beat.js'), 'utf8'));
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
const dir = path.join(__dirname, 'long'); let okAll = 0, n = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.wav')).sort()) {
  const gt = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.wav', '.json'))));
  const w = readWav(path.join(dir, f)), m = downmix(w.data, w.sr);
  const t0 = Date.now(); const r = beatAnalyse(m.data, m.sr); const ms = Date.now() - t0; n++;
  if (!r) { console.log(gt.name, 'KEIN ERGEBNIS'); continue; }
  const aud = gt.audible;
  const e = [];
  gt.beats.forEach((b, i) => { if (!aud[i >> 2]) return; let best = 9; for (const p of r.beats) if (Math.abs(p - b) < Math.abs(best)) best = p - b; e.push(Math.abs(best) * 1000); });
  const hitB = e.filter(v => v < 30).length / e.length;
  let dHit = 0, dCnt = 0;
  gt.downbeats.forEach((d, i) => { if (!aud[i]) return; dCnt++; if (r.downbeats.some(p => Math.abs(p - d) < 0.05)) dHit++; });
  // Takt 1 der App = erste erkannte Eins; sollte die erste echte Eins sein (nicht im freien Intro)
  const first = r.downbeats[0], t1err = first - gt.first_bar;
  const t1ok = Math.abs(t1err) < 0.05;
  const ok = Math.abs(r.bpm / gt.bpm - 1) < 0.01 && dHit / dCnt > 0.95 && hitB > 0.95 && t1ok;
  if (ok) okAll++;
  console.log(gt.name.padEnd(24), (gt.secs | 0) + ' s', 'Tempo', r.bpm.toFixed(2), '(' + gt.bpm + ')', 'Schläge ' + (hitB * 100).toFixed(0) + '% med ' + pct(e, 0.5).toFixed(1) + ' ms p90 ' + pct(e, 0.9).toFixed(1) + ' ms',
    '· Einsen ' + dHit + '/' + dCnt, '· Takt 1 ' + (t1ok ? 'ok' : 'daneben ' + (t1err * 1000).toFixed(0) + ' ms'), r.steady ? 'gerade' : 'gleitend', ms + ' ms', ok ? 'OK' : 'FEHLER');
}
console.log(`\nLange Songs richtig: ${okAll}/${n}`);
