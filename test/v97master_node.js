// v97 Mastering M1: Messgerät gegen EBU-Fälle (synthetisch) und ffmpeg ebur128, Limiter-Decke, Normalisieren
const vm = require('vm'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../app/master-dsp.js'), 'utf8'));
let ok = 0, tot = 0; const check = (n, c, i) => { tot++; ok += !!c; console.log((c ? 'OK      ' : 'FEHLER  ') + n + (i !== undefined ? '  · ' + JSON.stringify(i) : '')); };
const TD = '/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/m1/'; fs.mkdirSync(TD, { recursive: true });
const sine = (sr, sec, f, dbfs, ph) => { const n = Math.round(sr * sec), a = Math.pow(10, dbfs / 20), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = a * Math.sin(2 * Math.PI * f * i / sr + (ph || 0)); return x; };
const cat = (...a) => { const o = new Float32Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; a.forEach(x => { o.set(x, p); p += x.length; }); return o; };
function wavF32(file, chs, sr) {   // 32-Bit-Float-WAV für ffmpeg
  const n = chs[0].length, nc = chs.length, b = Buffer.alloc(44 + n * nc * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * nc * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(nc, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * nc * 4, 28); b.writeUInt16LE(nc * 4, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * nc * 4, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) b.writeFloatLE(chs[c][i], 44 + (i * nc + c) * 4);
  fs.writeFileSync(file, b);
}
function readWav(file) {   // PCM 16/24 oder Float 32 → Float32 je Kanal
  const b = fs.readFileSync(file); let p = 12, fmt = null, data = null;
  while (p < b.length - 8) { const id = b.toString('ascii', p, p + 4), sz = b.readUInt32LE(p + 4); if (id === 'fmt ') fmt = { tag: (t => t === 0xFFFE ? b.readUInt16LE(p + 32) : t)(b.readUInt16LE(p + 8)), nc: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }; if (id === 'data') { data = [p + 8, sz]; break; } p += 8 + sz + (sz & 1); }
  const bps = fmt.bits / 8, n = Math.floor(data[1] / (bps * fmt.nc)), chs = Array.from({ length: fmt.nc }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.nc; c++) { const o = data[0] + (i * fmt.nc + c) * bps;
    chs[c][i] = fmt.tag === 3 ? b.readFloatLE(o) : fmt.bits === 16 ? b.readInt16LE(o) / 32768 : fmt.bits === 24 ? b.readIntLE(o, 3) / 8388608 : b.readInt32LE(o) / 2147483648; }
  return { chs, sr: fmt.sr };
}
function ff(file) {
  const out = execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).toString();
  return out;
}
function ffm(file) { let s = ''; try { execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { s = e.stderr; }
  return s; }
function ffmeasure(file) {
  const r = require('child_process').spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr, sum = s.slice(s.lastIndexOf('Summary:'));
  const g = re => { const m = sum.match(re); return m ? parseFloat(m[1]) : null; };
  return { I: g(/I:\s+(-?[\d.]+|-inf) LUFS/), LRA: g(/LRA:\s+(-?[\d.]+) LU\n/), TP: g(/Peak:\s+(-?[\d.]+) dBFS/) };
}
const sr = 48000;
// EBU Tech 3341 Fall 1/2: Stereo-Sinus 1 kHz −23 / −33 dBFS → −23,0 / −33,0 LUFS
for (const [db, want] of [[-23, -23], [-33, -33]]) { const x = sine(sr, 20, 1000, db); const m = mdMeasure([x, x], sr); check(`Sinus 1 kHz ${db} dBFS → ${want} LUFS`, Math.abs(m.I - want) <= 0.1, +m.I.toFixed(2)); }
// Fall 3–5 (Tore): 10 s −36, 60 s −23, 10 s −36 → −23,0 ; Fall 5: 20 s −26, 20,1 s −20, 20 s −26 → −23,0
{ const x = cat(sine(sr, 10, 1000, -36), sine(sr, 60, 1000, -23), sine(sr, 10, 1000, -36)); const m = mdMeasure([x, x], sr); check('Tor-Fall −36/−23/−36 → −23,0', Math.abs(m.I + 23) <= 0.1, +m.I.toFixed(2)); }
{ const x = cat(sine(sr, 20, 1000, -26), sine(sr, 20.1, 1000, -20), sine(sr, 20, 1000, -26)); const m = mdMeasure([x, x], sr); check('Tor-Fall −26/−20/−26 → −23,0', Math.abs(m.I + 23) <= 0.1, +m.I.toFixed(2)); }
{ const x = cat(sine(sr, 20, 1000, -72), sine(sr, 20, 1000, -23)); const m = mdMeasure([x, x], sr); check('Absolutes Tor −70: Stille-Anteil zählt nicht', Math.abs(m.I + 23) <= 0.1, +m.I.toFixed(2)); }
// EBU Tech 3342: LRA 20 s −20 / 20 s −30 → 10 LU ; −20/−15 → 5 LU
for (const [a, b, want] of [[-20, -30, 10], [-20, -15, 5]]) { const x = cat(sine(sr, 20, 1000, a), sine(sr, 20, 1000, b)); const m = mdMeasure([x, x], sr); check(`LRA ${a}/${b} → ${want} LU`, Math.abs(m.LRA - want) <= 1, +m.LRA.toFixed(2)); }
// 44,1 kHz
{ const x = sine(44100, 20, 1000, -23); const m = mdMeasure([x, x], 44100); check('44,1 kHz: Sinus −23 dBFS → −23,0 LUFS', Math.abs(m.I + 23) <= 0.1, +m.I.toFixed(2)); }
// True Peak: fs/4 mit 45° Phase (Abtastwerte 3 dB unter der Spitze), hohe Töne nahe Nyquist
for (const [f, ph, db] of [[12000, Math.PI / 4, -6], [12000, Math.PI / 4, 0], [19000, 0.3, -3], [15000, 0.7, -1], [997, 0.1, -0.5]]) {
  const x = sine(sr, 2, f, db, ph); for (let i = 0; i < 480; i++) { x[i] *= i / 480; x[x.length - 1 - i] *= i / 480; } const m = mdMeasure([x, x], sr); check(`True Peak ${f} Hz ${db} dBFS`, Math.abs(m.TP - db) <= 0.2, { TP: +m.TP.toFixed(2), SP: +m.SP.toFixed(2) });
}
// Vergleich mit ffmpeg an Korpus-Dateien
const C = '/home/claude/3nps/test/corpus/', files = fs.readdirSync(C).filter(f => f.endsWith('.wav')).slice(0, 8);
for (const f of files) {
  const { chs, sr: s2 } = readWav(C + f), m = mdMeasure(chs, s2), r = ffmeasure(C + f);
  check(`ffmpeg-Vergleich ${f}`, Math.abs(m.I - r.I) <= 0.1 && Math.abs(m.TP - r.TP) <= 0.2 && Math.abs(m.LRA - r.LRA) <= 1, { me: [+m.I.toFixed(2), +m.TP.toFixed(2), +m.LRA.toFixed(1)], ff: [r.I, r.TP, r.LRA] });
}
// Limiter + Normalisieren: Ziel −14 LUFS / −1 dBTP, auch gegen ffmpeg nachgemessen
// 48-kHz-Fassungen (wie Dateien aus Logic) + harter Breitband-Test (Rauschschläge bis 24 kHz)
const N48 = files.slice(0, 4).map(f => { const o = TD + '48_' + f; require('child_process').spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', C + f, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', o]); return o; });
{ let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1, n = sr * 20, l = new Float32Array(n), r = new Float32Array(n);
  for (let k = 0; k < 80; k++) { const p0 = Math.round(k * 0.25 * sr); for (let i = 0; i < sr * 0.08 && p0 + i < n; i++) { const e = Math.exp(-i / (sr * 0.015)) * 0.9; l[p0 + i] += rnd() * e; r[p0 + i] += rnd() * e; } }
  for (let i = 0; i < n; i++) { const v = 0.2 * Math.sin(2 * Math.PI * 110 * i / sr); l[i] += v; r[i] += v; }
  const o = TD + '48_breitband.wav'; wavF32(o, [l, r], sr); N48.push(o); }
for (const f0 of N48) {
  const f = path.basename(f0), { chs, sr: s2 } = readWav(f0), t0 = Date.now(), res = mdNormalize(chs, s2, -14, -1), ms = Date.now() - t0;
  const out = TD + 'norm_' + f; wavF32(out, res.outs, s2); const r = ffmeasure(out);
  check(`Normalisieren ${f} auf −14 LUFS / −1 dBTP`, Math.abs(res.after.I + 14) <= 0.1 && res.after.TP <= -1 + 0.02 && r.TP <= -1 + 0.2 && Math.abs(r.I + 14) <= 0.15,
    { I: +res.after.I.toFixed(2), TP: +res.after.TP.toFixed(2), ffI: r.I, ffTP: r.TP, red: +res.red.toFixed(1), steps: res.steps, ms });
}
// Null-Test: leise Datei, Ziel = eigene Lautheit, kein Limiter nötig → bitgleich bis auf Rundung
{ const x = sine(sr, 5, 440, -20), m = mdMeasure([x, x], sr), res = mdNormalize([x, x], sr, m.I, -1, { before: m });
  let d = 0; for (let i = 0; i < x.length; i++) d = Math.max(d, Math.abs(res.outs[0][i] - x[i])); check('Null-Test: neutrale Kette verändert nichts', d < 1e-5 && res.red > -0.01, { d, red: res.red }); }
// Laut-Ziel −9 LUFS: Decke hält trotzdem
{ const { chs, sr: s2 } = readWav(C + files[0]), res = mdNormalize(chs, s2, -9, -1); check('Laut (−9 LUFS): Decke −1 dBTP hält', res.after.TP <= -0.98 && Math.abs(res.after.I + 9) <= 0.3, { I: +res.after.I.toFixed(2), TP: +res.after.TP.toFixed(2), red: +res.red.toFixed(1) }); }
console.log(`${ok}/${tot}`); process.exit(ok === tot ? 0 : 1);
