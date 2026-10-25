// ---------- Studio: Übernahme aus dem Looper ----------
const Imp = (() => {
  const dec24 = (u, n) => { const a = new Float32Array(n); for (let i = 0, o = 0; i < n; i++, o += 3) { let s = u[o] | (u[o + 1] << 8) | (u[o + 2] << 16); if (s & 0x800000) s -= 0x1000000; a[i] = s / 8388607; } return a; };
  function trackData(st) {
    if (st.enc === 'i24') { const l = dec24(st.dl, st.L); return { l, r: st.dr ? dec24(st.dr, st.L) : l }; }
    const l = new Float32Array(st.L); for (let j = 0; j < st.L; j++) l[j] = st.pcm[j] / 32767;
    return { l, r: st.pcmR ? Float32Array.from(st.pcmR, v => v / 32767) : l };
  }
  async function resample(x, from, to) {
    if (from === to) return x;
    const n = Math.round(x.l.length * to / from), oc = new OfflineAudioContext(2, n, to), b = oc.createBuffer(2, x.l.length, from);
    b.copyToChannel(x.l, 0); b.copyToChannel(x.r || x.l, 1);
    const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start(0);
    const o = await oc.startRendering(); return { l: o.getChannelData(0).slice(), r: o.getChannelData(1).slice() };
  }
  // Zeitdehnung ohne Tonhöhe (Signalsmith Stretch, wie im Looper)
  let sw = null, sid = 0; const swWait = {};
  function stretch(x, n, sr) {
    return new Promise(res => {
      try {
        if (!sw) { sw = new Worker('../stretch/worker.js'); sw.onmessage = e => { const p = swWait[e.data.id]; if (p) { delete swWait[e.data.id]; p(e.data); } }; }
        const id = ++sid, L = x.l.slice(), R = x.r && x.r !== x.l ? x.r.slice() : null;
        const tm = setTimeout(() => { delete swWait[id]; res(null); }, 20000 + x.l.length / sr * 3000);
        swWait[id] = d => { clearTimeout(tm); res(d.err ? null : { l: d.l, r: d.r || d.l }); };
        sw.postMessage({ id, l: L, r: R, n, sr }, R ? [L.buffer, R.buffer] : [L.buffer]);
      } catch (e) { res(null); }
    });
  }
  // ---- Liste aller Quellen ----
  const CAT = { idee: 'Idee', loop: 'Loop', backing: 'Backing', team: 'Zusammenarbeit' };
  async function sources() {
    const out = await SDB.looperList(i => {
      if (i.kind === 'lied') return { src: 'lied', id: i.id, name: i.name, ts: i.ts, bpm: i.bpm, secs: i.secs, words: (i.tok || []).length, cat: 'lied', key: (i.root || '') + ' ' + (i.mode || '') };
      return { src: 'idea', id: i.id, name: i.name, ts: i.ts, bpm: i.bpm, secs: i.secs, n: i.session ? i.session.tracks.filter(Boolean).length : (i.wav ? 1 : 0), cat: CAT[i.cat] ? i.cat : 'idee', drums: !!i.drumState, drumName: i.drumState && i.drumState.name, key: (i.root || '') + ' ' + (i.mode || '') };
    });
    let songs = null; try { songs = JSON.parse(localStorage.getItem('3nps-lieder') || 'null'); } catch (e) {}
    (songs && songs.songs || []).forEach(s => { const v = s.versions && s.versions[s.cur != null ? s.cur : s.versions.length - 1]; if (!v) return; out.push({ src: 'song', id: s.id, name: s.name, ts: v.at || 0, bpm: v.bpm, cat: 'song', parts: v.parts.length, key: window.LiedCore ? LiedCore.keyLabel(v.key) : '', vn: v.n }); });
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  // ---- Idee/Loop/Backing übernehmen ----
  // opts: { mode: 'new'|'into', bar (1-basiert), reps, fit (Tempo angleichen) }
  async function idea(id, opts, say) {
    const it = await SDB.looperGet('ideas', id); if (!it) throw new Error('Nicht gefunden.');
    say = say || (() => {});
    let p = Proj.P; const sr = Engine.sr();
    if (opts.mode === 'new' || !p) { p = await Proj.newProject(it.name); Proj.change('tempo', q => { q.bpm = Math.round((it.bpm || 100) * 100) / 100; q.key = (it.root || 'C') + ' ' + shortMode(it.mode); }); }
    const at = Math.round(((opts.bar || 1) - 1) * Proj.bar()), reps = Math.max(1, opts.reps || 1);
    const ratio = (it.bpm && opts.fit !== false) ? Proj.P.bpm / it.bpm : 1;
    const tracks = []; let maxLen = 0;
    if (it.session) {
      const ss = it.session, ts = ss.tracks.map((t, i) => t ? { t, i } : null).filter(Boolean);
      for (const { t, i } of ts) {
        say('Übernehme Spur ' + (i + 1) + ' …');
        let x = await resample(trackData(t), ss.sr, sr);
        if (Math.abs(ratio - 1) > 0.002) { const y = await stretch(x, Math.round(x.l.length / ratio), sr); if (y) x = y; }
        const m = await SDB.putAudio(it.name + ' · Spur ' + (i + 1), sr, x.l, x.r !== x.l ? x.r : null);
        tracks.push({ m, vol: t.vol != null ? 20 * Math.log10(Math.max(0.01, t.vol / 90)) : 0, eq: t.eq2 || t.eq, fx: t.fx, name: 'Spur ' + (i + 1) }); maxLen = Math.max(maxLen, m.frames);
      }
    } else if (it.wav) {
      const buf = await Engine.ac().decodeAudioData(await it.wav.arrayBuffer()); let x = { l: buf.getChannelData(0).slice(), r: buf.numberOfChannels > 1 ? buf.getChannelData(1).slice() : null }; x.r = x.r || x.l;
      x = await resample(x, buf.sampleRate, sr); const m = await SDB.putAudio(it.name, sr, x.l, x.r !== x.l ? x.r : null); tracks.push({ m, vol: 0, name: it.name }); maxLen = m.frames;
    }
    Proj.change('regions', q => {
      tracks.forEach(tk => {
        let t = q.tracks.find(o => o.kind === 'audio' && o.src === it.id + ':' + tk.name);
        if (!t) { t = Proj.track('audio', (opts.mode === 'new' ? '' : it.name + ' · ') + tk.name); t.src = it.id + ':' + tk.name; t.vol = Math.round(tk.vol * 10) / 10; if (tk.eq) t.eq = EQ7.norm(tk.eq); if (tk.fx) { t.fx.rev = tk.fx.rev || 0; t.fx.dly = tk.fx.dly || 0; } q.tracks.push(t); }
        const L = tk.m.frames, n = Math.max(1, Math.round(maxLen / L)) * reps;   // kürzere Loops füllen die Länge der längsten Spur
        for (let k = 0; k < n; k++) q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: tk.m.id, start: at + k * L, offset: 0, len: L, gain: 0, fi: 0, fo: 0, name: it.name });
      });
      if (it.drumState && it.drumState.on !== false && window.Drum && opts.drums !== false) Drum.fromLooper(q, it.drumState, at, maxLen * reps);
    });
    Engine.dirty(true); say('„' + it.name + '“ übernommen: ' + tracks.length + ' Spur' + (tracks.length === 1 ? '' : 'en') + (reps > 1 ? ' ×' + reps : '') + (Math.abs(ratio - 1) > 0.002 ? ' · ins Projekttempo gebracht' : '') + '.');
  }
  const shortMode = m => /Moll|Äolisch/.test(m || '') ? 'Moll' : /Dur|Ionisch/.test(m || '') ? 'Dur' : (m || '').split(' ')[0];
  // ---- Lied mit Text (Mitsingen) ----
  async function lied(id, opts, say) {
    const it = await SDB.looperGet('ideas', id); if (!it || !it.wav) throw new Error('Keine Audiodatei gespeichert.');
    say = say || (() => {});
    if (opts.mode === 'new' || !Proj.P) { await Proj.newProject(it.name); Proj.change('tempo', q => { q.bpm = Math.round((it.bpm || 100) * 100) / 100; q.key = (it.root || 'C') + ' ' + shortMode(it.mode); }); }
    say('Lese „' + it.name + '“ …'); const sr = Engine.sr();
    const buf = await Engine.ac().decodeAudioData(await it.wav.arrayBuffer());
    let x = { l: buf.getChannelData(0), r: buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0) };
    if (buf.sampleRate !== sr) x = await resample({ l: x.l.slice(), r: x.r.slice() }, buf.sampleRate, sr);
    const m = await SDB.putAudio(it.name, sr, x.l, x.r !== x.l ? x.r : null);
    const at = Math.round(((opts.bar || 1) - 1) * Proj.bar());
    Proj.change('regions', q => { const t = Proj.track('audio', it.name); q.tracks.push(t); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: m.id, start: at, offset: 0, len: m.frames, gain: 0, fi: 0, fo: 0, name: it.name }); if (it.tok && it.tok.length) q.lyrics = (it.tok || []).map(w => w.w).join(' '); });
    Engine.dirty(true); say('„' + it.name + '“ übernommen.');
  }
  // ---- Song aus dem Songwriting: Aufnahmen, Ablauf als Marker, Akkorde ----
  async function song(id, opts, say) {
    let db = null; try { db = JSON.parse(localStorage.getItem('3nps-lieder') || 'null'); } catch (e) {}
    const s = db && db.songs.find(x => x.id === id); if (!s) throw new Error('Song nicht gefunden.');
    const v = s.versions[s.cur != null ? s.cur : s.versions.length - 1]; say = say || (() => {});
    if (opts.mode === 'new' || !Proj.P) { await Proj.newProject(s.name); }
    Proj.change('tempo', q => { q.bpm = v.bpm; q.key = LiedCore.keyLabel(v.key); });
    const sr = Engine.sr(), at = Math.round(((opts.bar || 1) - 1) * Proj.bar()), spb = Proj.spb();
    say('Rechne die Aufnahmen des Songs …');
    const a = await LiedExport.render(v, rid => SDB.looperGet('meta', 'lied-audio:' + rid), sr);
    let m = null; if (a) m = await SDB.putAudio(s.name + ' · Aufnahmen', sr, a.L, a.R);
    const tl = LiedExport.timeline(v);
    const COL = { verse: '#8ad94e', chorus: '#f2c230', bridge: '#c26bff', intro: '#9ab', outro: '#9ab', pre: '#3ddbb0', other: '#b8c4d6' };
    Proj.change('regions', q => {
      if (m) { const t = Proj.track('audio', 'Aufnahmen (Songwriting)'); q.tracks.push(t); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: m.id, start: at, offset: 0, len: m.frames, gain: 0, fi: 0, fo: 0, name: s.name }); }
      let last = null; q.markers = (opts.mode === 'new' ? [] : q.markers || []);
      tl.entries.forEach(e => { if (last && last.label === e.label) return; q.markers.push({ f: at + Math.round(e.start * spb), name: e.label, color: COL[e.p.type] || '#8ad94e' }); last = e; });
      q.chords = tl.chords.map(c => ({ b: (at / spb) + c.start, beats: c.beats, name: LiedCore.cname ? LiedCore.cname(c.r, c.t) : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][c.r] + c.t, r: c.r, t: c.t }));
      q.lyrics = LiedExport.lyricsText(s, v);
    });
    Engine.dirty(true); say('Song „' + s.name + '“ übernommen: ' + (m ? 'Aufnahmen, ' : '') + tl.entries.length + ' Teile als Marker, ' + tl.chords.length + ' Akkorde.');
  }
  return { sources, idea, lied, song, resample, stretch, trackData };
})();
