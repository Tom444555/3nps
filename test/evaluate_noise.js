// Bewertet eine Takt-Analyse-Funktion gegen die Testsammlung.
// Aufruf: node evaluate.js <datei-mit-beatAnalyse.js> [fft-datei]
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, process.env.CORPUS || 'corpus');
for (const f of process.argv.slice(2)) eval.call(global, fs.readFileSync(f, 'utf8'));

function readWav(p) {
  const b = fs.readFileSync(p); let o = 12, sr = 0, data = null;
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(o + 12);
    if (id === 'data') { data = new Float32Array(len / 2); for (let i = 0; i < data.length; i++) data[i] = b.readInt16LE(o + 8 + i * 2) / 32768; }
    o += 8 + len + (len & 1); }
  return { sr, data };
}
function downmix(x, sr) { const f = Math.max(1, Math.floor(sr / 11025)), n = Math.floor(x.length / f), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < f; j++) s += x[i * f + j]; o[i] = s / f; } return { data: o, sr: sr / f }; }

const rows = []; let okT = 0, okD = 0, okG = 0, n = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.wav')).sort()) {
  const gt = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.wav', '.json'))));
  const w = readWav(path.join(dir, f)); { let seed=7; const R=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-0.5;}; const g=parseFloat(process.env.GAIN||'1'), nz=parseFloat(process.env.NOISE||'0'); for(let i=0;i<w.data.length;i++) w.data[i]=w.data[i]*g+R()*nz; } const m = downmix(w.data, w.sr);
  const t0 = Date.now(); const r = beatAnalyse(m.data, m.sr); const ms = Date.now() - t0;
  n++;
  if (!r) { rows.push([gt.name, gt.bpm, '-', '-', 'KEIN ERGEBNIS']); continue; }
  const terr = (r.bpm - gt.bpm) / gt.bpm, tOk = Math.abs(terr) < 0.01;
  // Takt 1: liegt die erste erkannte Eins auf einer echten Eins?
  const dErr = Math.min(...gt.downbeats.map(d => Math.abs(d - r.firstDownbeat)));
  const dOk = dErr < 0.05;
  // Raster: echte Einsen durch Vorhersage getroffen (über das ganze Stück)
  let hit = 0, cnt = 0;
  const pred = r.downbeats || (() => { const a = []; for (let t = r.firstDownbeat; t < gt.beats[gt.beats.length - 1] + 0.1; t += r.beatSec * 4) a.push(t); return a; })();
  for (const d of gt.downbeats) { if (d < r.firstDownbeat - 0.05) continue; cnt++; if (pred.some(p => Math.abs(p - d) < 0.05)) hit++; }
  const g = cnt ? hit / cnt : 0;
  if (tOk) okT++; if (dOk) okD++; if (g > 0.9) okG++;
  rows.push([gt.name, gt.bpm.toFixed(1), r.bpm.toFixed(2), (terr * 100).toFixed(2) + '%', (dErr * 1000).toFixed(0) + 'ms', (g * 100).toFixed(0) + '%', (r.confidence || 0).toFixed(2), ms + 'ms']);
}
console.log(['Stück', 'Soll', 'Ist', 'Tempo', 'Takt1', 'Raster', 'Konf', 'Zeit'].map((s, i) => s.padEnd(i ? 9 : 20)).join(''));
rows.forEach(r => console.log(r.map((s, i) => String(s).padEnd(i ? 9 : 20)).join('')));
console.log(`\nTempo richtig (<1%): ${okT}/${n} · Takt 1 richtig: ${okD}/${n} · Raster >90%: ${okG}/${n}`);
