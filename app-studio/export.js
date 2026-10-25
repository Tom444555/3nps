// ---------- Studio: Abmischen, Export, In den Looper ----------
const Exp = (() => {
  // Offline rechnen: gleicher Graph wie beim Abspielen, Audio-Blöcke werden zwischendurch nachgeladen (suspend/resume)
  async function render(opts, prog) {
    const P = Proj.P, sr = P.sr || Engine.sr(), B = Engine.B;
    const a = Math.max(0, Math.round(opts.a || 0)), e = Math.round(opts.b || Proj.projEnd()) + Math.round((opts.tail != null ? opts.tail : 1.5) * sr), n = Math.max(1, e - a);
    if (n > sr * 60 * 12) throw new Error('Länger als 12 Minuten – bitte einen Bereich (Cycle) wählen.');
    const proj = JSON.parse(JSON.stringify(P)); proj.cycle = { on: false, a: 0, b: 0 };
    if (opts.only) { const set = new Set([].concat(opts.only)); proj.tracks.forEach(t => { t.solo = set.has(t.id); if (set.has(t.id)) t.mute = false; }); }
    if (opts.noMaster) { proj.master.glue = false; proj.master.lim = false; }
    if (window.Inst) await Inst.ready(proj);
    const oc = new OfflineAudioContext(2, n, sr);
    const url = URL.createObjectURL(new Blob([Engine.WORKLET_SRC], { type: 'application/javascript' }));
    await oc.audioWorklet.addModule(url);
    const node = new AudioWorkletNode(oc, 'studio-eng', { numberOfInputs: 0, numberOfOutputs: Engine.MAXT, outputChannelCount: new Array(Engine.MAXT).fill(2), processorOptions: { n: Engine.MAXT } });
    const G = Engine.makeGraph(oc, proj, node);
    if (window.Inst) Inst.offline(oc, G, proj, a, e);
    if (window.Sched) Sched.offlineAuto(oc, G, proj, a);
    const sent = new Set();
    async function feedTo(pos) {
      for (let ti = 0; ti < Math.min(Engine.MAXT, proj.tracks.length); ti++) {
        if (proj.tracks[ti].kind !== 'audio') continue;
        for (let k = Math.floor(Math.max(0, pos - B) / B); k * B < Math.min(e, pos + 3 * B); k++) {
          const key = ti + ':' + k; if (sent.has(key)) continue; sent.add(key);
          const d = await Engine.blockData(proj, ti, k); if (d) node.port.postMessage({ t: 'chunk', tr: ti, k: key, at: k * B, len: B, l: d.l, r: d.r }, [d.l.buffer, d.r.buffer]);
        }
      }
      const drop = []; for (const key of sent) { const k = +key.split(':')[1]; if ((k + 1) * B < pos - B) { drop.push(key); } } if (drop.length) node.port.postMessage({ t: 'drop', keys: drop });
    }
    await feedTo(a);
    node.port.postMessage({ t: 'play', pos: a, at: 0 });
    const step = B / sr;
    for (let t = step; t < n / sr; t += step) oc.suspend(t).then(async () => { await feedTo(a + Math.round(t * sr)); if (prog) prog(t / (n / sr)); oc.resume(); });
    const buf = await oc.startRendering(); URL.revokeObjectURL(url);
    return { l: buf.getChannelData(0), r: buf.getChannelData(1), sr };
  }
  // ---- Dateien ----
  function wav24(L, R, sr) {
    const ch = R ? 2 : 1, n = L.length, buf = new ArrayBuffer(44 + n * 3 * ch), v = new DataView(buf), u = new Uint8Array(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, buf.byteLength - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 3 * ch, true); v.setUint16(32, 3 * ch, true); v.setUint16(34, 24, true); w(36, 'data'); v.setUint32(40, n * 3 * ch, true);
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { let x = (c ? R : L)[i]; x = x > 1 ? 1 : x < -1 ? -1 : x; const s = Math.round(x * 8388607); u[o++] = s & 255; u[o++] = (s >> 8) & 255; u[o++] = (s >> 16) & 255; }
    return new Uint8Array(buf);
  }
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), d = f.data, c = crc32(d), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, d);
      const z = new DataView(new ArrayBuffer(46)); z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true); z.setUint32(16, c, true); z.setUint32(20, d.length, true); z.setUint32(24, d.length, true); z.setUint16(28, name.length, true); z.setUint32(42, off, true);
      cen.push(new Uint8Array(z.buffer), name); off += 30 + name.length + d.length;
    });
    const cs = cen.reduce((s, x) => s + x.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  // MIDI Format 1: Tempo/Taktart/Marker + je Noten-/Drum-Spur
  function midi(P, a) {
    const PPQ = 480, spb = Proj.spb(), enc = new TextEncoder();
    const vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
    const trk = evs => { evs.sort((x, y) => x[0] - y[0] || x[2] - y[2]); let t = 0; const out = []; evs.forEach(([tt, bytes]) => { out.push(...vlq(Math.max(0, tt - t)), ...bytes); t = tt; }); out.push(0, 0xFF, 0x2F, 0); return [0x4D, 0x54, 0x72, 0x6B, out.length >>> 24 & 255, out.length >>> 16 & 255, out.length >>> 8 & 255, out.length & 255, ...out]; };
    const txt = (type, s) => { const b = enc.encode(s); return [0xFF, type, ...vlq(b.length), ...b]; };
    const tk = f => Math.round((f - a) / spb * PPQ);
    const us = Math.round(60000000 / P.bpm), meta = [[0, [0xFF, 0x51, 3, us >> 16 & 255, us >> 8 & 255, us & 255], 0], [0, [0xFF, 0x58, 4, P.sig, 2, 24, 8], 0], [0, txt(3, P.name), 0]];
    (P.markers || []).forEach(m => { if (m.f >= a) meta.push([tk(m.f), txt(6, m.name), 1]); });
    const tracks = [trk(meta)];
    if (window.Inst) Inst.midiTracks(P, a, PPQ).forEach(t => { const evs = [[0, txt(3, t.name), 0]]; t.notes.forEach(n => { evs.push([n.t, [0x90 | t.ch, n.m, n.v], 2], [n.t + Math.max(1, n.d), [0x80 | t.ch, n.m, 0], 1]); }); tracks.push(trk(evs)); });
    const head = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, PPQ >> 8, PPQ & 255];
    return new Uint8Array([].concat(head, ...tracks));
  }
  const safe = s => String(s || 'Projekt').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  async function share(file, say) {
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); say('Gespeichert/geteilt: ' + file.name); return; } } catch (e) { if (e && e.name === 'AbortError') { say('Abgebrochen.'); return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); say('Heruntergeladen: ' + file.name);
  }
  // Mastering wie im Looper-Reiter (eigene DSP, im Hintergrund)
  let mw = null, mid = 0; const mwait = {};
  function master(L, R, sr, I, T) {
    if (!mw) { const src = [mdKCoeffs, mdTpFilter, mdTpRun, mdMeasure, mdLimit, mdNormalize].map(f => f.toString()).join('\n') + '\nonmessage=e=>{const d=e.data;try{const r=mdNormalize(d.chs,d.sr,d.I,d.T,{});postMessage({id:d.id,outs:r.outs,after:r.after,before:r.before},r.outs.map(o=>o.buffer));}catch(err){postMessage({id:d.id,err:String(err)})}}';
      mw = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))); mw.onmessage = e => { const p = mwait[e.data.id]; if (p) { delete mwait[e.data.id]; p(e.data); } }; }
    return new Promise((res, rej) => { const id = ++mid, a = L.slice(), b = R.slice(); mwait[id] = d => d.err ? rej(new Error(d.err)) : res(d); mw.postMessage({ id, chs: [a, b], sr, I, T }, [a.buffer, b.buffer]); });
  }
  function masterTarget() { try { const s = JSON.parse(localStorage.getItem('3nps-master-target') || 'null') || {}; const M = { stream: [-14, -1], apple: [-16, -1], deezer: [-15, -1], loud: [-9, -1] }; if (s.k === 'own') return [s.I || -14, s.T || -1]; return M[s.k] || M.stream; } catch (e) { return [-14, -1]; } }
  async function run(kind, opts, say) {
    const P = Proj.P, sr = P.sr, range = opts.cycle && P.cycle.b > P.cycle.a ? { a: P.cycle.a, b: P.cycle.b, tail: 0 } : { a: 0, b: Proj.projEnd() };
    const tag = Math.round(P.bpm * 100) / 100 + ' BPM', base = safe(P.name);
    const pr = f => say('Rechne … ' + Math.round(f * 100) + ' %');
    if (kind === 'mix') {
      let x = await render(range, pr), name = base + ' – Mix – ' + tag + '.wav';
      if (opts.master) { const [I, T] = masterTarget(); say('Mastere …'); const r = await master(x.l, x.r, sr, I, T); x = { l: r.outs[0], r: r.outs[1] }; name = base + ' – Master ' + I + ' LUFS – ' + tag + '.wav'; window.__lastMaster = r.after; }
      window.__lastMix = { n: x.l.length, peak: x.l.reduce((m, v) => Math.max(m, Math.abs(v)), 0) };
      return share(new File([wav24(x.l, x.r, sr)], name, { type: 'audio/wav' }), say);
    }
    if (kind === 'stems' || kind === 'logic') {
      const files = [], used = P.tracks.filter(t => P.regions.some(r => r.track === t.id));
      for (let i = 0; i < used.length; i++) { const t = used[i]; say('Spur ' + (i + 1) + '/' + used.length + ': ' + t.name + ' …'); const x = await render(Object.assign({}, range, { only: t.id, noMaster: true, tail: range.tail != null ? range.tail : 0.5 }), null); files.push({ name: base + '/' + String(i + 1).padStart(2, '0') + ' ' + safe(t.name) + ' – ' + tag + '.wav', data: wav24(x.l, x.r, sr) }); }
      if (kind === 'logic') {
        say('Mix …'); const x = await render(range, pr); files.unshift({ name: base + '/00 Mix – ' + tag + '.wav', data: wav24(x.l, x.r, sr) });
        files.push({ name: base + '/Tempo, Marker, Noten – ' + tag + '.mid', data: midi(P, range.a) });
        const lies = [P.name, 'Tempo ' + tag + ' · ' + P.sig + '/4 · Tonart ' + P.key, '', 'So geht es in Logic Pro:', '1. Neues leeres Projekt.', '2. Zuerst die MIDI-Datei auf Takt 1 ziehen und „Tempo übernehmen“ bestätigen (oder Tempo von Hand: ' + tag + ').',
          '3. Alle WAV-Dateien zusammen markieren und auf Takt 1 ziehen – jede liegt dann auf einer eigenen Spur, alle beginnen auf Takt 1.', '   Falls Logic nach Smart Tempo fragt: Projekttempo beibehalten.', '4. „00 Mix“ ist alles zusammen – nur zum Vergleichen (sonst doppelt laut).', '', 'Erstellt mit Loopsmiths Studio.'].join('\n');
        files.push({ name: base + '/LIES MICH.txt', data: new TextEncoder().encode(lies) });
      }
      const z = zip(files); window.__lastZip = { n: files.length, names: files.map(f => f.name), size: z.size };
      return share(new File([z], base + (kind === 'logic' ? ' – Logic' : ' – Spuren') + '.zip', { type: 'application/zip' }), say);
    }
    if (kind === 'midi') return share(new File([midi(P, range.a)], base + ' – ' + tag + '.mid', { type: 'audio/midi' }), say);
  }
  // Bereich (Cycle oder ausgewählte Region) als neue Idee in den Looper
  async function toLooper(say) {
    const P = Proj.P, sel = Arr.V.sel && Proj.reg(Arr.V.sel);
    const range = P.cycle.on && P.cycle.b > P.cycle.a ? { a: P.cycle.a, b: P.cycle.b } : sel ? { a: sel.start, b: sel.start + sel.len } : null;
    if (!range) throw new Error('Erst einen Bereich wählen: Cycle (oben im Lineal ziehen) oder eine Region antippen.');
    say('Rechne den Bereich …');
    const x = await render(Object.assign({}, range, { tail: 0 }), null), L = x.l.length;
    const enc24 = a => { const u = new Uint8Array(a.length * 3); for (let i = 0, o = 0; i < a.length; i++, o += 3) { let v = a[i]; v = v > 1 ? 1 : v < -1 ? -1 : v; const s = Math.round(v * 8388607); u[o] = s & 255; u[o + 1] = (s >> 8) & 255; u[o + 2] = (s >> 16) & 255; } return u; };
    const now = new Date(), [root, ...mode] = (P.key || 'C Dur').split(' ');
    const name = P.name + ' · Takt ' + (Math.round(range.a / Proj.bar()) + 1) + '–' + Math.round(range.b / Proj.bar());
    await SDB.looperPut('ideas', { id: 'st' + Date.now().toString(36), v: 2, name, ts: now.getTime(), dateStr: now.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      root: root || 'C', mode: /Moll/.test(mode.join(' ')) ? 'Äolisch (Moll)' : 'Ionisch (Dur)', bpm: P.bpm, secs: L / x.sr, cat: 'team',
      session: { sr: x.sr, baseL: L, stereo: true, tracks: [{ L, enc: 'i24', dl: enc24(x.l), dr: enc24(x.r), vol: 90, eq: [0, 0, 0, 0, 0, 0, 0] }] }, drumState: null, droneState: null });
    say('Im Looper gespeichert als „' + name + '“ (Ablage Zusammenarbeit).');
    return name;
  }
  // v107: Zurück in den Looper – Projekt (oder Cycle) als bis zu 3 Spuren in dieselbe Idee schreiben, dann den Looper öffnen
  async function backToLooper(say) {
    const P = Proj.P, id = P.fromIdea; if (!id) throw new Error('Dieses Projekt kommt nicht aus dem Looper.');
    const bar = Proj.bar(), cyc = P.cycle.on && P.cycle.b > P.cycle.a;
    const a = cyc ? P.cycle.a : 0, b = cyc ? P.cycle.b : Math.max(bar, Math.ceil((Proj.projEnd() - 64) / bar) * bar);
    const used = P.tracks.filter(t => !t.mute && P.regions.some(r => r.track === t.id && !r.muted && r.start < b && r.start + r.len > a));
    if (!used.length) throw new Error('Im Bereich ist nichts zu hören.');
    const groups = used.length <= 3 ? used.map(t => [t]) : [[used[0]], [used[1]], used.slice(2)];
    const enc24 = x => { const u = new Uint8Array(x.length * 3); for (let i = 0, o = 0; i < x.length; i++, o += 3) { let v = x[i]; v = v > 1 ? 1 : v < -1 ? -1 : v; const s = Math.round(v * 8388607); u[o] = s & 255; u[o + 1] = (s >> 8) & 255; u[o + 2] = (s >> 16) & 255; } return u; };
    const tracks = []; let sr = P.sr, L = 0;
    for (let k = 0; k < groups.length; k++) {
      say('Rechne Spur ' + (k + 1) + ' von ' + groups.length + ' für den Looper …');
      const x = await render({ a, b, tail: 0, noMaster: true, only: groups[k].map(t => t.id) }, null); sr = x.sr; L = x.l.length;
      tracks.push({ L, enc: 'i24', dl: enc24(x.l), dr: enc24(x.r), vol: 100, eq: [0, 0, 0, 0, 0, 0, 0], fx: { rev: 0, dly: 0 } });
    }
    while (tracks.length < 3) tracks.push(null);
    const old = await SDB.looperGet('ideas', id), now = new Date(), [root, ...md] = (P.key || 'C Dur').split(' ');
    const idea = Object.assign({ id, v: 2, cat: 'team', droneState: null }, old || {}, {
      name: (old && old.name) || P.name, ts: now.getTime(), dateStr: now.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      bpm: P.bpm, secs: L / sr, session: { sr, baseL: L, stereo: true, tracks }, drumState: P.tracks.some(t => t.kind === 'drum') ? null : (old && old.drumState) || null });
    if (root && /Moll|Dur/.test(md.join(' '))) { idea.root = root; idea.mode = /Moll/.test(md.join(' ')) ? 'Äolisch (Moll)' : 'Ionisch (Dur)'; }
    await SDB.looperPut('ideas', idea);
    Proj.change('meta', p => { p.importTs = idea.ts; }, { noUndo: true }); await Proj.save();
    say('In den Looper geschrieben (' + groups.length + ' Spur' + (groups.length === 1 ? '' : 'en') + ', ' + Math.round((b - a) / bar) + ' Takte). Öffne den Looper …');
    window.__backDone = { n: groups.length, bars: Math.round((b - a) / bar), id };
    return idea;
  }
  return { render, run, wav24, zip, midi, toLooper, master, backToLooper };
})();
