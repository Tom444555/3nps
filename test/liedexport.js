// Prüfskript Song-Export für Logic: node liedexport.js
const fs = require('fs'), cp = require('child_process');
const C = require('../app/lied-core.js'), T = require('../app/lied-text.js'), E = require('../app/lied-export.js');
let ok = 0, n = 0; const check = (name, c, info) => { n++; if (c) ok++; console.log((c ? 'OK    ' : 'FEHLER') + '  ' + name + (info !== undefined ? '  · ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); };
const OUT = process.env.OUT || '/tmp/liedexport';
fs.mkdirSync(OUT, { recursive: true });
const mk = (id, name, type, txt, lyrics, audio) => Object.assign({ id, name, type, chords: T.parseChords(txt).seq, lyrics: lyrics || [], audio: null }, audio || {});
// Aufnahme: 4 Takte bei 96 BPM, ein Klick (Impuls) auf jedem Schlag, Schlag 1 lauter
const SR = 48000, mkRec = (bpm, bars) => { const n = Math.round(bars * 4 * 60 / bpm * SR), l = new Int16Array(n); for (let b = 0; b < bars * 4; b++) { const i = Math.round(b * 60 / bpm * SR); for (let k = 0; k < 40; k++) if (i + k < n) l[i + k] = (b % 4 ? 8000 : 20000) * (1 - k / 40); } return { sr: SR, n, l, r: null }; };
const recs = { a1: mkRec(96, 4), a2: mkRec(90, 4) };
const v = { n: 2, key: { pc: 9, major: false }, bpm: 96, theme: 'Nachtfahrt', parts: [
  mk('v', 'Strophe', 'verse', 'Am F C G', ['Ich fahr durch die Nacht\nund die Straße ist leer', 'Zweite Strophe\nnoch eine Zeile'], { audio: 'a1', audioBpm: 96 }),
  mk('c', 'Refrain', 'chorus', 'F G Am Am', ['Nachtfahrt, nur ich und der Wind'], { audio: 'a2', audioBpm: 90 }),
  mk('b', 'Bridge', 'bridge', 'Dm Em F G:2', [])], order: [{ p: 'v', reps: 1 }, { p: 'c', reps: 1 }, { p: 'v', reps: 1 }, { p: 'c', reps: 2 }, { p: 'b', reps: 1 }, { p: 'c', reps: 1 }] };
v.parts[0].audioSig = C.sig(v.parts[0].chords); v.parts[1].audioSig = C.sig(v.parts[1].chords);
const tl = E.timeline(v);
check('Zeitplan: Starts und Länge', tl.entries.map(e => e.start).join(',') === '0,16,32,48,64,80,100' && tl.beats === 116, tl.entries.map(e => e.label + '@' + e.start).join(' '));
check('Abschnittsnamen: Strophe 1/2, Refrain', tl.entries.map(e => e.label).join('|') === 'Strophe 1|Refrain|Strophe 2|Refrain|Refrain|Bridge|Refrain');
(async () => {
  const drums = []; for (let b = 0; b < 29; b++) for (let s = 0; s < 4; s++) drums.push([b * 1920 + s * 480, s % 2 ? 38 : 36, 100, 240]);
  const r = await E.build({ name: 'Nachtfahrt' }, v, { getRec: id => recs[id], sr: SR, drums, drumsName: 'Rock', pdf: new Uint8Array([37, 80, 68, 70]), voice: 'Bariton' });
  fs.writeFileSync(OUT + '/song.zip', Buffer.from(r.data));
  const list = cp.execSync('cd ' + OUT + ' && rm -rf x && mkdir x && cd x && unzip -q ../song.zip && find . -type f | sort').toString().trim().split('\n');
  check('ZIP entpackbar, alle Dateien', list.length === 8 && list.some(f => f.includes('01 Aufnahmen')) && list.filter(f => f.includes('Teile einzeln')).length === 2 && list.some(f => f.endsWith('.mid')) && list.some(f => f.endsWith('Leadsheet.pdf')) && list.some(f => f.includes('Song-Code')), list);
  const wavf = OUT + '/x/' + list.find(f => f.includes('01 Aufnahmen')).slice(2);
  const info = cp.execSync('ffprobe -v error -show_entries stream=sample_rate,channels,bits_per_raw_sample,duration -of default=nw=1 "' + wavf + '"').toString();
  check('Song-WAV: 48 kHz, Mono, 24 Bit, Länge = 116 Schläge bei 96 BPM + 0,6 s', /sample_rate=48000/.test(info) && /channels=1/.test(info) && /bits_per_raw_sample=24/.test(info) && Math.abs(parseFloat(/duration=([\d.]+)/.exec(info)[1]) - (116 * 0.625 + 0.6)) < 0.01, info.replace(/\n/g, ' '));
  // Klicks an den richtigen Stellen: Takt-Einsen der Strophe bei 0, 2,5 s …; Refrain (90 → 96 BPM gestreckt) ab Schlag 16 = 10 s
  const raw = fs.readFileSync(wavf), data = raw.subarray(44), N = data.length / 3, s24 = i => { let x = data[i * 3] | (data[i * 3 + 1] << 8) | (data[i * 3 + 2] << 16); if (x & 0x800000) x -= 0x1000000; return x / 8388607; };
  const peakNear = t => { let best = 0, at = -1; for (let i = Math.round((t - 0.02) * SR); i < Math.round((t + 0.02) * SR); i++) if (i >= 0 && i < N && Math.abs(s24(i)) > best) { best = Math.abs(s24(i)); at = i; } return { best, ms: (at / SR - t) * 1000 }; };
  const checks = [0, 2.5, 10, 12.5, 20, 30].map(t => peakNear(t));
  check('Aufnahmen liegen taktgenau (±1 ms)', checks.every(c => c.best > 0.5 && Math.abs(c.ms) <= 1), checks.map(c => c.best.toFixed(2) + '@' + c.ms.toFixed(2) + 'ms'));
  const br = peakNear(80 * 0.625 + 0.3);
  check('Bridge ohne Aufnahme bleibt still', br.best < 0.01 && peakNear(82 * 0.625).best < 0.01 && peakNear(100 * 0.625).best > 0.5, [br.best, peakNear(100 * 0.625).best]);
  // MIDI einlesen (eigener kleiner Leser)
  const midf = OUT + '/x/' + list.find(f => f.endsWith('.mid')).slice(2), mb = fs.readFileSync(midf);
  const readMidi = b => { let p = 14; const ntr = b.readUInt16BE(10), tpb = b.readUInt16BE(12), tracks = [];
    for (let k = 0; k < ntr; k++) { if (b.toString('ascii', p, p + 4) !== 'MTrk') throw new Error('MTrk fehlt'); const len = b.readUInt32BE(p + 4); let q = p + 8; const e = q + len, tr = { name: '', tempo: [], marks: [], notes: 0, lyr: [], ks: [], text: [], end: 0 }; let t = 0, rs = 0;
      const vlq = () => { let v = 0, c; do { c = b[q++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
      while (q < e) { t += vlq(); let st = b[q]; if (st & 128) q++; else st = rs;
        if (st === 0xFF) { const ty = b[q++], ln = vlq(), d = b.subarray(q, q + ln); q += ln; const s2 = d.toString('utf8');
          if (ty === 3) tr.name = s2; if (ty === 0x51) tr.tempo.push((d[0] << 16) | (d[1] << 8) | d[2]); if (ty === 6) tr.marks.push(s2); if (ty === 5) tr.lyr.push(s2.trim()); if (ty === 1) tr.text.push(s2); if (ty === 0x59) tr.ks.push([d.readInt8(0), d[1]]); if (ty === 0x2F) tr.end = t; }
        else { rs = st; const hi = st & 0xF0; const d1 = b[q++], d2 = hi === 0xC0 || hi === 0xD0 ? 0 : b[q++]; if (hi === 0x90 && d2 > 0) tr.notes++; } }
      tracks.push(tr); p = e; }
    return { tpb, tracks }; };
  let M = null; try { M = readMidi(mb); } catch (e) { M = { err: e.message }; }
  const tr = M.tracks || [], byName = nm => tr.find(x => x.name.startsWith(nm)) || {};
  check('MIDI: Tempo 96, A-Moll (0 Vorzeichen, Moll), Abschnitts-Marker', M.tpb === 480 && tr[0].tempo[0] === 625000 && tr[0].ks[0] && tr[0].ks[0][0] === 0 && tr[0].ks[0][1] === 1 && tr[0].marks.join('|') === 'Strophe 1|Refrain|Strophe 2|Refrain|Bridge|Refrain', tr[0] && { tempo: tr[0].tempo, ks: tr[0].ks, marks: tr[0].marks });
  check('MIDI: Akkorde (Noten + Namen), Bass, Drums, Text', byName('Akkorde').notes > 60 && byName('Akkorde').text[0] === 'Am' && byName('Bass').notes === 116 && byName('Drums (Rock)').notes === 116 && byName('Text').lyr[0] === 'Ich fahr durch die Nacht', tr.map(x => x.name + ':' + x.notes + (x.lyr.length ? ' / ' + x.lyr.length + ' Textzeilen' : '')));
  check('MIDI: alle Spuren enden bei 116 Schlägen', tr.length >= 5 && tr.every(x => x.end === 116 * 480), tr.map(x => x.end));
  const txt = fs.readFileSync(OUT + '/x/' + list.find(f => f.endsWith('Text.txt')).slice(2), 'utf8');
  check('Text.txt: Abschnitte, Wiederholung ×2, Text', txt.includes('[Strophe 2]') && txt.includes('[Refrain]  F G Am Am ×2') && txt.includes('Zweite Strophe'), txt.slice(0, 200));
  const lies = fs.readFileSync(OUT + '/x/' + list.find(f => f.endsWith('LIES MICH.txt')).slice(2), 'utf8');
  check('Anleitung: Takte der Abschnitte', lies.includes('Takt     1  Strophe 1 (4 T)') && lies.includes('Takt    13  Refrain (8 T)') && lies.includes('Takt    26  Refrain (4 T)'), lies.split('\n').slice(4, 12).join(' | '));
  // Ohne Aufnahmen: nur MIDI & Texte
  const v2 = JSON.parse(JSON.stringify(v)); v2.parts.forEach(p => { p.audio = null; });
  const r2 = await E.build({ name: 'Leer' }, v2, { getRec: () => null });
  check('Ohne Aufnahmen: MIDI, Text, Song-Code, Anleitung', !r2.audio && r2.files.length === 4, r2.files.map(f => f.name));
  // Stereo-Aufnahme → Stereo-WAV
  const st = mkRec(96, 4); st.r = st.l.map(x => -x);
  const r3 = await E.build({ name: 'Stereo' }, v, { getRec: id => id === 'a1' ? st : recs[id], sr: SR });
  check('Stereo-Aufnahme → Stereo-WAV', r3.files[0].data[22] === 2);
  console.log(ok + '/' + n);
})();
