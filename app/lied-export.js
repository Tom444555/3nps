// ---- Songwriting, Schritt 5: ganzer Song für Logic Pro (ZIP mit Aufnahmen als WAV, MIDI mit Tempo, Tonart, Abschnitts-Markern,
// Akkorden, Bass, Drums und Text, dazu Leadsheet, Song-Code und Anleitung). Ohne Oberfläche, in Node testbar.
const LiedExport = (() => {
  const C = (typeof LiedCore !== 'undefined') ? LiedCore : require('./lied-core.js');
  const X = (typeof LiedText !== 'undefined') ? LiedText : require('./lied-text.js');
  const md = C.md;
  const SHARPS = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };   // Dur-Grundton → Vorzeichen
  const enc = s => Array.from(new TextEncoder().encode(String(s)));

  // ================= Zeitplan =================
  // Jedes Vorkommen eines Teils mit Startschlag; Akkorde mit Startschlag
  function timeline(v) {
    const occ = X.occurrences(v), out = [], chords = []; let beat = 0;
    occ.forEach((o, j) => {
      const b = C.beatsOf(o.p), multi = occ.filter(x => x.p === o.p).length > 1;
      out.push({ p: o.p, n: o.n, oi: o.oi, start: beat, beats: b, label: o.p.name + (multi && (o.p.type === 'verse' || o.p.type === 'other' || o.p.type === 'bridge') ? ' ' + (o.n + 1) : '') });
      let cb = beat; o.p.chords.forEach(c => { chords.push({ r: c.r, t: c.t, beats: c.beats, start: cb, entry: j }); cb += c.beats; });
      beat += b;
    });
    return { entries: out, chords, beats: beat, secs: beat * 60 / v.bpm };
  }

  // ================= WAV (24 Bit) =================
  function wav24(L, R, sr) {
    const ch = R ? 2 : 1, n = L.length, dataBytes = n * 3 * ch;
    const buf = new ArrayBuffer(44 + dataBytes), v = new DataView(buf), u = new Uint8Array(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, buf.byteLength - 8, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 3 * ch, true); v.setUint16(32, 3 * ch, true); v.setUint16(34, 24, true);
    w(36, 'data'); v.setUint32(40, dataBytes, true);
    let o = 44;
    const put = a => { a = a > 1 ? 1 : a < -1 ? -1 : a; const s = Math.round(a * 8388607); u[o] = s & 255; u[o + 1] = (s >> 8) & 255; u[o + 2] = (s >> 16) & 255; o += 3; };
    for (let i = 0; i < n; i++) { put(L[i]); if (R) put(R[i]); }
    return u;
  }

  // ================= ZIP (ohne Kompression) =================
  function crc32(u8) {
    if (!crc32.t) { crc32.t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc32.t[n] = c >>> 0; } }
    let crc = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) crc = crc32.t[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files, asBlob) {
    const parts = [], central = []; let offset = 0;
    const d = new Date(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = new Uint8Array(enc(f.name)), data = f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cSize = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(e.buffer)];
    if (asBlob) return new Blob(all, { type: 'application/zip' });           // im Browser ohne zweite Kopie im Speicher
    const n = all.reduce((a, b) => a + b.length, 0), out = new Uint8Array(n);
    let p = 0; all.forEach(a => { out.set(a, p); p += a.length; });
    return out;
  }

  // ================= MIDI =================
  const PPQ = 480;
  function midi(song, v, opts) {
    opts = opts || {};
    const tl = timeline(v), k = v.key, T = b => Math.round(b * PPQ), end = T(tl.beats);
    const vlq = n => { const a = [n & 0x7F]; while ((n >>= 7)) a.unshift((n & 0x7F) | 0x80); return a; };
    const meta = (type, bytes) => [0xFF, type, ...vlq(bytes.length), ...bytes];
    function track(name, events) {
      const ev = [[0, meta(0x03, enc(name)), 0]].concat(events), out = []; let last = 0;
      ev.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
      for (const [t, data] of ev) { out.push(...vlq(t - last), ...data); last = t; }
      out.push(...vlq(Math.max(0, end - last)), 0xFF, 0x2F, 0x00);
      return [...enc('MTrk'), (out.length >>> 24) & 255, (out.length >>> 16) & 255, (out.length >>> 8) & 255, out.length & 255, ...out];
    }
    const mpq = Math.round(60000000 / v.bpm), majorPc = k.major ? k.pc : md(k.pc + 3);
    // Spur 1: Tempo, Takt, Tonart, Abschnitte als Marker
    const t0 = [[0, meta(0x51, [(mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255]), 1], [0, meta(0x58, [4, 2, 24, 8]), 2], [0, meta(0x59, [SHARPS[majorPc] & 255, k.major ? 0 : 1]), 3]];
    tl.entries.forEach((e, i) => { const prev = tl.entries[i - 1]; if (prev && prev.p === e.p && prev.label === e.label) return; t0.push([T(e.start), meta(0x06, enc(e.label)), 4]); });
    const tracks = [track(song.name || 'Song', t0)];
    // Akkorde (Kanal 1): Dreiklang/Vierklang um C4, Name als Text
    const ch = [];
    let prevV = null;
    tl.chords.forEach(c => {
      const iv = C.CH[c.t] || C.CH[''], ctr = prevV ? prevV.reduce((a, b) => a + b, 0) / prevV.length : 62;
      const notes = iv.slice(0, 4).map(x => { let m = 48 + md(c.r + x); while (m < ctr - 6) m += 12; while (m > ctr + 6) m -= 12; return Math.max(48, Math.min(76, m)); });
      prevV = notes;
      ch.push([T(c.start), meta(0x01, enc(X.chordName(c, k))), 0]);
      notes.forEach(m => { ch.push([T(c.start), [0x90, m, 72], 2]); ch.push([T(c.start + c.beats) - 1, [0x80, m, 0], 1]); });
    });
    tracks.push(track('Akkorde', ch));
    // Bass (Kanal 2): Grundton auf jedem Schlag, auf Schlag 3 eines langen Akkords die Quinte
    const bs = [];
    tl.chords.forEach(c => {
      const iv = C.CH[c.t] || C.CH[''], root = 28 + md(c.r - 4), fifth = iv.includes(7) ? 7 : iv.includes(6) ? 6 : 7;
      for (let b = 0; b < c.beats; b++) { const m = b % 4 === 2 && c.beats >= 4 ? root + fifth : root; bs.push([T(c.start + b), [0x91, m, b % 4 === 0 ? 96 : 80], 2]); bs.push([T(c.start + b + 0.9), [0x81, m, 0], 1]); }
    });
    tracks.push(track('Bass', bs));
    // Drums (Kanal 10) – Muster des Rhythmus-Teils
    if (opts.drums && opts.drums.length) tracks.push(track('Drums' + (opts.drumsName ? ' (' + opts.drumsName + ')' : ''), opts.drums.flatMap(([t, note, vel, len]) => t < end ? [[t, [0x99, note, vel], 2], [Math.min(end, t + len), [0x89, note, 0], 1]] : [])));
    // Text als Liedtext-Ereignisse (Zeilenanfang wie im Leadsheet gleichmäßig verteilt)
    const ly = [];
    tl.entries.forEach(e => {
      const t = X.lyricsOf(e.p, e.n).text, lines = String(t).split('\n').map(s => X.stripChords(s).trim()).filter(Boolean);
      if (!lines.length) return;
      const span = e.beats / lines.length;
      lines.forEach((s, i) => ly.push([T(e.start + i * span), meta(0x05, enc(s + ' ')), 3]));
    });
    if (ly.length) tracks.push(track('Text', ly));
    const hdr = [...enc('MThd'), 0, 0, 0, 6, 0, 1, 0, tracks.length, (PPQ >> 8) & 255, PPQ & 255];
    return new Uint8Array([...hdr, ...tracks.flat()]);
  }

  // ================= Aufnahmen rendern =================
  // getRec(id) → { sr, n, l: Int16Array, r: Int16Array|null } (oder null); Tempo wie beim Abspielen (Tonhöhe ändert sich mit)
  function place(dstL, dstR, rec, at, durS, rate, fade) {
    const n = rec.n;
    let i = 0;
    for (; i < durS; i++) {
      const sp = i * rate, j = Math.floor(sp); if (j + 1 >= n) break;
      const fr = sp - j, d = at + i; if (d >= dstL.length) break;
      const g = i > durS - fade ? (durS - i) / fade : 1;
      dstL[d] += (rec.l[j] * (1 - fr) + rec.l[j + 1] * fr) / 32768 * g;
      if (dstR) { const rr = rec.r || rec.l; dstR[d] += (rr[j] * (1 - fr) + rr[j + 1] * fr) / 32768 * g; }
    }
    return i;
  }
  async function render(v, getRec, sr) {
    const tl = timeline(v), total = Math.round(tl.secs * sr) + Math.round(0.6 * sr), recs = {};
    const usable = p => p.audio && !C.audioStale(p);
    for (const e of tl.entries) if (usable(e.p) && !(e.p.audio in recs)) recs[e.p.audio] = await getRec(e.p.audio);
    const ids = Object.keys(recs).filter(id => recs[id]);
    if (!ids.length) return null;
    const stereo = ids.some(id => recs[id].r), L = new Float32Array(total), R = stereo ? new Float32Array(total) : null;
    const spb = 60 / v.bpm * sr;
    tl.entries.forEach(e => {
      const rec = usable(e.p) && recs[e.p.audio]; if (!rec) return;
      const rate = (v.bpm / (e.p.audioBpm || v.bpm)) * (rec.sr / sr);
      place(L, R, rec, Math.round(e.start * spb), Math.round(e.beats * spb), rate, Math.round(0.006 * sr));
    });
    // Teile einzeln (je einmal, auf Songtempo)
    const parts = [];
    v.parts.forEach(p => {
      const rec = usable(p) && recs[p.audio]; if (!rec) return;
      const len = Math.round(C.beatsOf(p) * spb), pl = new Float32Array(len), pr = stereo ? new Float32Array(len) : null;
      place(pl, pr, rec, 0, len, (v.bpm / (p.audioBpm || v.bpm)) * (rec.sr / sr), Math.round(0.006 * sr));
      parts.push({ p, L: pl, R: pr });
    });
    // gemeinsamer Schutz vor Übersteuern
    let pk = 0; const scan = a => { if (a) for (let i = 0; i < a.length; i++) { const x = a[i] < 0 ? -a[i] : a[i]; if (x > pk) pk = x; } };
    scan(L); scan(R); parts.forEach(q => { scan(q.L); scan(q.R); });
    const g = pk > 0.97 ? 0.97 / pk : 1;
    if (g < 1) { const sc = a => { if (a) for (let i = 0; i < a.length; i++) a[i] *= g; }; sc(L); sc(R); parts.forEach(q => { sc(q.L); sc(q.R); }); }
    return { L, R, parts, sr, stereo };
  }

  // ================= Paket =================
  const safe = s => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  function lyricsText(song, v) {
    const tl = timeline(v), out = [song.name, C.keyLabel(v.key) + ' · ' + Math.round(v.bpm) + ' BPM', ''];
    if (v.theme) out.push('Thema: ' + v.theme, '');
    let last = null;
    tl.entries.forEach(e => {
      const t = X.lyricsOf(e.p, e.n), txt = String(t.text || '').split('\n').map(s => X.stripChords(s).replace(/\s+$/, '')).join('\n').trim();
      if (last && last.p === e.p && last.txt === txt) { last.times++; out[last.at] = last.head + ' ×' + last.times; return; }
      const head = '[' + e.label + ']  ' + X.chordText(e.p.chords, v.key);
      last = { p: e.p, txt, at: out.length, head, times: 1 };
      out.push(head); if (txt) out.push(txt); out.push('');
    });
    return out.join('\n');
  }
  async function build(song, v, o) {
    o = o || {};
    const tl = timeline(v), k = v.key, tempoTxt = String(Math.round(v.bpm * 100) / 100).replace('.', ','), keyTxt = C.keyLabel(k).replace(/♯/g, '#').replace(/♭/g, 'b');
    const base = safe(song.name || 'Song') + ' V' + v.n, tag = tempoTxt + ' BPM ' + keyTxt, files = [];
    const audio = o.getRec ? await render(v, o.getRec, o.sr || 48000) : null;
    if (audio) {
      files.push({ name: base + '/01 Aufnahmen – ganzer Song – ' + tag + '.wav', data: wav24(audio.L, audio.R, audio.sr) });
      audio.parts.forEach((q, i) => files.push({ name: base + '/Teile einzeln/' + String(i + 1).padStart(2, '0') + ' ' + safe(q.p.name) + ' (' + C.beatsOf(q.p) / 4 + ' Takte) – ' + tag + '.wav', data: wav24(q.L, q.R, audio.sr) }));
    }
    files.push({ name: base + '/02 Tempo, Abschnitte, Akkorde, Bass' + (o.drums && o.drums.length ? ', Drums' : '') + ' – ' + tag + '.mid', data: midi(song, v, o) });
    if (o.pdf) files.push({ name: base + '/03 Leadsheet.pdf', data: o.pdf });
    files.push({ name: base + '/04 Text.txt', data: new Uint8Array(enc(lyricsText(song, v))) });
    files.push({ name: base + '/05 Song-Code (für Claude).txt', data: new Uint8Array(enc(X.toCode(song, v, { voice: o.voice }))) });
    const bars = tl.beats / 4, secs = tl.secs, sections = [];
    tl.entries.forEach((e, i) => { const prev = tl.entries[i - 1]; if (prev && prev.p === e.p && prev.label === e.label) { sections[sections.length - 1].bars += e.beats / 4; return; } sections.push({ label: e.label, bar: e.start / 4 + 1, bars: e.beats / 4 }); });
    const fmtBar = b => String(Math.round(b * 100) / 100).replace('.', ',');
    const lies = [
      song.name + ' – Version ' + v.n, '',
      'Tempo ' + tempoTxt + ' BPM · 4/4 · ' + fmtBar(bars) + ' Takte · ' + C.mmss(secs) + ' · Tonart ' + keyTxt, '',
      'Ablauf (Takt im Logic-Projekt):',
      ...sections.map(s => '  Takt ' + fmtBar(s.bar).padStart(5) + '  ' + s.label + ' (' + fmtBar(s.bars) + ' T)'), '',
      'So geht es in Logic Pro (Mac oder iPad):',
      '1. Neues leeres Projekt anlegen.',
      '2. Die MIDI-Datei „02 Tempo, Abschnitte …“ ins Projekt ziehen. Frage nach dem Tempo mit „Ja“ beantworten.',
      '   Logic legt Spuren für Akkorde, Bass' + (o.drums && o.drums.length ? ', Drums' : '') + ' und Text an und setzt die Abschnitte als Marker.',
      '   Den Spuren passende Instrumente geben (z. B. E-Piano, Bass, Drum Kit). (Tempo sonst von Hand auf ' + tempoTxt + '.)',
      audio ? '3. „01 Aufnahmen – ganzer Song“ auf Takt 1 ziehen – alle Teile liegen schon an der richtigen Stelle.' : '3. (Dieser Song hat noch keine Aufnahmen – nur MIDI.)',
      audio ? '   Falls Logic nach Smart Tempo fragt: Projekttempo beibehalten / nicht anpassen.' : null,
      audio ? '   Im Ordner „Teile einzeln“ liegt jeder Teil einmal, schon im Songtempo – zum Umbauen und Kopieren.' : null,
      '4. Text und Akkorde zum Mitlesen: „03 Leadsheet.pdf“ bzw. „04 Text.txt“.',
      '5. „05 Song-Code“ enthält den ganzen Song zum Weiterarbeiten mit Claude oder zum Wiederherstellen.',
      audio && Object.values(v.parts).some(p => p.audio && p.audioBpm && Math.abs(p.audioBpm / v.bpm - 1) > 0.005) ? '\nHinweis: Aufnahmen mit anderem Tempo wurden wie in der App angepasst (Tonhöhe ändert sich mit).' : null,
      v.parts.some(p => C.audioStale(p)) ? 'Hinweis: Teile mit geänderten Akkorden sind ohne Aufnahme (wie beim Abspielen) – neu einspielen.' : null,
      '', 'Erstellt mit dem 3nps-Übungsprogramm.'
    ].filter(x => x !== null).join('\n');
    files.push({ name: base + '/LIES MICH.txt', data: new Uint8Array(enc(lies)) });
    const data = zip(files, !!o.blob); return { name: base + '.zip', data, size: data.size || data.length, files: o.blob ? files.map(f => ({ name: f.name, size: f.data.length })) : files, audio: !!audio, secs };
  }
  return { timeline, wav24, zip, midi, render, build, lyricsText, PPQ };
})();
if (typeof window !== 'undefined') window.LiedExport = LiedExport;
if (typeof module !== 'undefined') module.exports = LiedExport;
