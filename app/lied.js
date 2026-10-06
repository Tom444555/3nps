// ---- Songwriting: Songs aus Looper-Teilen bauen, abspielen, prüfen, Varianten als Versionen, Gesangs-Hilfe ----
// Speicher: Songs (klein) in localStorage „3nps-lieder“, Aufnahmen der Teile in IndexedDB (Store „meta“, Schlüssel „lied-audio:…“)
// – kein neuer Datenbank-Store, damit die stabile Fassung dieselbe Datenbank weiter öffnen kann. Sicherung nimmt beides mit.
(function () {
  const $ = id => document.getElementById(id);
  const panel = $('panel-lied');
  if (!panel || typeof LiedCore === 'undefined') return;
  const C = LiedCore, md = C.md;
  const KEY = '3nps-lieder', MAXV = 40;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const parseName = nm => { const m = /^([A-G]#?)(.*)$/.exec(nm || ''); if (!m) return null; const t = C.CH[m[2]] ? m[2] : ''; return { r: PC[m[1]], t }; };

  // ================= Speicher =================
  let db = load();
  function load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!d || !Array.isArray(d.songs)) d = { active: null, songs: [] };
    d.songs = d.songs.filter(s => s && s.id && Array.isArray(s.versions) && s.versions.length);
    d.songs.forEach(s => { s.cur = Math.max(0, Math.min(s.versions.length - 1, s.cur | 0)); });
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { status('Speichern fehlgeschlagen (Speicher voll?) – sichere wichtige Songs.'); return false; } }
  const song = () => db.songs.find(s => s.id === db.active) || null;
  const ver = () => { const s = song(); return s ? s.versions[s.cur] : null; };
  function newSong(name) {
    const s = { id: C.newId('s'), name: name || 'Song ' + (db.songs.length + 1), created: Date.now(), voice: null, cur: 0,
      versions: [{ n: 1, at: Date.now(), note: 'Start', key: { pc: 0, major: true }, bpm: 90, parts: [], order: [] }] };
    db.songs.push(s); db.active = s.id; save(); return s;
  }
  // neue Version aus Änderung (Variante, Transponieren, manuell gesichert)
  function pushVersion(v, note) {
    const s = song(); if (!s) return;
    const n = C.clone(v); n.n = (s.versions.reduce((a, x) => Math.max(a, x.n || 0), 0) + 1); n.at = Date.now(); n.note = note;
    s.versions = s.versions.slice(0, s.cur + 1).concat([n]);          // ab der aktuellen Version weiter (ältere Abzweige fallen weg wie bei ↶)
    if (s.versions.length > MAXV) s.versions.splice(1, s.versions.length - MAXV);
    s.cur = s.versions.length - 1; save();
  }
  // Audio
  const audioCache = new Map();
  async function putAudio(id, cap) {
    const n = cap.frames, q = x => { const o = new Int16Array(n); for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, x[i])); o[i] = v < 0 ? v * 32768 : v * 32767; } return o; };
    let same = true; for (let i = 0; i < n; i += 7) if (cap.l[i] !== cap.r[i]) { same = false; break; }
    await AppDB.put('meta', { key: 'lied-audio:' + id, sr: cap.sr, n, l: q(cap.l), r: same ? null : q(cap.r) });
    return n * 2 * (same ? 1 : 2);
  }
  async function getBuffer(id) {
    if (audioCache.has(id)) return audioCache.get(id);
    const rec = await AppDB.get('meta', 'lied-audio:' + id); if (!rec) return null;
    const b = audioCtx.createBuffer(2, rec.n, rec.sr), L = b.getChannelData(0), R = b.getChannelData(1);
    for (let i = 0; i < rec.n; i++) L[i] = rec.l[i] / 32768;
    if (rec.r) for (let i = 0; i < rec.n; i++) R[i] = rec.r[i] / 32768; else R.set(L);
    audioCache.set(id, b); while (audioCache.size > 6) audioCache.delete(audioCache.keys().next().value);   // höchstens 6 entpackte Aufnahmen im Speicher
    return b;
  }
  async function dropSongAudio(s) {
    const ids = new Set(); s.versions.forEach(v => v.parts.forEach(p => { if (p.audio) ids.add(p.audio); }));
    // nur löschen, was kein anderer Song nutzt
    db.songs.forEach(o => { if (o !== s) o.versions.forEach(v => v.parts.forEach(p => ids.delete(p.audio))); });
    for (const id of ids) { try { await AppDB.del('meta', 'lied-audio:' + id); } catch (e) {} audioCache.delete(id); }
  }

  // ================= Looper „→ Song“ =================
  const dlg = document.createElement('div');
  dlg.className = 'modal'; dlg.id = 'ldDlg'; dlg.hidden = true; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true');
  dlg.innerHTML = '<div class="modal-card card"><h2>Loop in einen Song übernehmen</h2><div class="ld-cap" id="ldCapInfo"></div>'
    + '<label class="field"><span>Song</span><select id="ldDSong"></select></label>'
    + '<label class="field" id="ldDNewW"><span>Name des neuen Songs</span><input type="text" id="ldDNew" maxlength="60" autocomplete="off"></label>'
    + '<label class="field"><span>Teil</span><select id="ldDType"></select></label>'
    + '<label class="field"><span>Als</span><select id="ldDMode"></select></label>'
    + '<div class="imp-btns"><button class="toggle-btn" id="ldDCancel">Abbrechen</button><button class="toggle-btn active" id="ldDOk">Übernehmen</button></div>'
    + '<p class="pattern-desc">Gespeichert werden der Mix aller Spuren (eine volle Runde), die erkannten Akkorde, Tonart und Tempo. Akkorde kannst du im Reiter Songwriting korrigieren.</p></div>';
  document.body.appendChild(dlg);
  let cap = null;
  Object.entries(C.TYPES).forEach(([k, n]) => $('ldDType').add(new Option(n, k)));
  function fillDlgModes() {
    const sid = $('ldDSong').value, s = db.songs.find(x => x.id === sid), t = $('ldDType').value, m = $('ldDMode');
    $('ldDNewW').hidden = sid !== 'new';
    m.innerHTML = '';
    const v = s ? s.versions[s.cur] : null, cnt = v ? v.parts.filter(p => p.type === t).length : 0;
    m.add(new Option('Neuen Teil anlegen (' + C.TYPES[t] + (cnt ? ' ' + (cnt + 1) : '') + ')', 'new'));
    if (v) v.parts.forEach(p => m.add(new Option('Ersetzt „' + p.name + '“', p.id)));
  }
  // Vorschlag: erster Teil Strophe, dann Refrain, dann Bridge
  function suggestType() {
    const sel = $('ldDSong'), so = sel.value !== 'new' ? db.songs.find(s => s.id === sel.value) : null, v0 = so ? so.versions[so.cur] : null;
    $('ldDType').value = !v0 || !v0.parts.some(p => p.type === 'verse') ? 'verse' : !v0.parts.some(p => p.type === 'chorus') ? 'chorus' : !v0.parts.some(p => p.type === 'bridge') ? 'bridge' : 'other';
  }
  $('ldDSong').addEventListener('change', () => { suggestType(); fillDlgModes(); }); $('ldDType').addEventListener('change', fillDlgModes);
  $('ldDCancel').addEventListener('click', () => { dlg.hidden = true; cap = null; });
  function openCapture() {
    if (typeof Looper === 'undefined' || !Looper.songCapture) return;
    cap = Looper.songCapture();
    if (!cap) { if (window.Looper) { const st = $('loopStatus'); if (st) st.textContent = 'Erst etwas im Looper einspielen oder laden – dann „→ Song“.'; } return; }
    const k = cap.key || (ver() && ver().key) || { pc: 0, major: true };
    const chs = cap.chords.map(c => { const p = parseName(c.name); return p ? C.cname(Object.assign(p, { beats: c.beats }), k) : c.name; });
    $('ldCapInfo').innerHTML = '<b>' + cap.bars + ' Takte</b> · ' + Math.round(cap.bpm) + ' BPM' + (cap.key ? ' · ' + C.keyLabel(cap.key) : '') + '<br>' + (chs.length ? esc(chs.join(' – ')) : '<span class="caption">keine Akkorde erkannt – du kannst sie im Songwriting eintragen</span>');
    const sel = $('ldDSong'); sel.innerHTML = '';
    db.songs.forEach(s => sel.add(new Option(s.name, s.id))); sel.add(new Option('+ Neuer Song …', 'new'));
    sel.value = db.active && db.songs.some(s => s.id === db.active) ? db.active : 'new';
    $('ldDNew').value = 'Song ' + (db.songs.length + 1);
    suggestType(); fillDlgModes(); dlg.hidden = false;
  }
  $('ldDOk').addEventListener('click', async () => {
    if (!cap) return;
    const b = $('ldDOk'); b.disabled = true;
    try {
      let s = $('ldDSong').value === 'new' ? newSong(($('ldDNew').value || '').trim()) : db.songs.find(x => x.id === $('ldDSong').value);
      db.active = s.id;
      const v = s.versions[s.cur], first = !v.parts.length;
      if (first && cap.key) v.key = cap.key;
      if (first) v.bpm = Math.round(cap.bpm * 10) / 10;
      const aid = C.newId('a'); const bytes = await putAudio(aid, cap);
      s.bytes = (s.bytes || 0) + bytes;
      const chords = cap.chords.map(c => { const p = parseName(c.name); return p ? { r: p.r, t: p.t, beats: c.beats } : null; }).filter(Boolean);
      const t = $('ldDType').value, mode = $('ldDMode').value;
      let part;
      if (mode === 'new') {
        const cnt = v.parts.filter(p => p.type === t).length;
        part = { id: C.newId('p'), name: C.TYPES[t] + (cnt ? ' ' + (cnt + 1) : ''), type: t, chords, audio: aid, audioBpm: cap.bpm, audioSig: C.sig(chords), audioBars: cap.bars };
        v.parts.push(part); v.order.push({ p: part.id, reps: 1 });
      } else {
        part = v.parts.find(p => p.id === mode);
        Object.assign(part, { type: t, chords, audio: aid, audioBpm: cap.bpm, audioSig: C.sig(chords), audioBars: cap.bars });
      }
      save(); dlg.hidden = true; cap = null;
      const tempoNote = Math.abs(part.audioBpm - v.bpm) / v.bpm > 0.03 ? ' Achtung: Tempo ' + Math.round(part.audioBpm) + ' statt ' + Math.round(v.bpm) + ' BPM – die Aufnahme wird beim Abspielen angepasst (klingt dann höher/tiefer).' : '';
      const st = $('loopStatus'); if (st) st.textContent = '„' + part.name + '“ in „' + s.name + '“ übernommen.' + tempoNote;
      render();
    } catch (e) { const st = $('loopStatus'); if (st) st.textContent = 'Übernehmen fehlgeschlagen: ' + (e && e.message || e); }
    b.disabled = false;
  });
  // Knopf im Looper
  const row = document.querySelector('#panel-looper .global-row');
  if (row) { const b = document.createElement('button'); b.className = 'toggle-btn'; b.id = 'loopSong'; b.textContent = '→ Song'; b.title = 'Aktuellen Loop als Teil in einen Song übernehmen'; const ex = $('loopExport'); row.insertBefore(b, ex ? ex.nextSibling : null); b.addEventListener('click', openCapture); }

  // ================= Abspielen =================
  let P = null;
  function status(t) { $('ldStatus').textContent = t; }
  let padOut = null, padVoices = [], lastV = null;
  function padRelease(t) { padVoices.forEach(v => { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.18); v.o.forEach(o => o.stop(t + 1.2)); } catch (e) {} }); padVoices = []; }
  function padChord(c, t) {
    padRelease(t); if (!$('ldTP').checked) return;
    if (!padOut) { padOut = audioCtx.createGain(); padOut.gain.value = 0.2; const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; padOut.connect(lp); lp.connect(typeof ensureMasterBus === 'function' ? ensureMasterBus() : audioCtx.destination); }
    const pcs = (C.CH[c.t] || C.CH['']).map(x => md(c.r + x)).slice(0, 4), ctr = lastV ? lastV.reduce((a, b) => a + b, 0) / lastV.length : 60;
    const vs = pcs.map(p => { let m = 48 + p; while (m < ctr - 6) m += 12; while (m > ctr + 6) m -= 12; return Math.max(50, Math.min(72, m)); }); lastV = vs;
    vs.forEach(m => { const f = 440 * Math.pow(2, (m - 69) / 12), g = audioCtx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.22);
      const o = [-7, 6].map(dt => { const x = audioCtx.createOscillator(); x.type = 'sawtooth'; x.frequency.value = f; x.detune.value = dt; x.connect(g); x.start(t); return x; });
      g.connect(padOut); padVoices.push({ g, o }); });
  }
  function onStep(step, t, sd) {
    if (!P) return;
    const per = Rhythm.res() / 4; if (step % per !== 0) return;
    const bd = sd * per;
    if (P.pending) { if (step !== 0) return; P.pending = false; P.ci = 0; P.inChord = 0; change(t, bd); return; }
    P.inChord++;
    if (P.inChord >= P.chords[P.ci].beats) {
      P.inChord = 0; P.ci++;
      if (P.ci >= P.chords.length) {
        if (P.loop) { P.ci = 0; P.pass++; }
        else { const end = t; P.ended = true; padRelease(end); P.srcs.forEach(s => { try { s.stop(end); } catch (e) {} }); setTimeout(() => { if (P && P.ended) stop('Ende.'); }, Math.max(0, (end - audioCtx.currentTime) * 1000) + 60); return; }
      }
      change(t, bd);
    }
    P.events.push({ t, ci: P.ci, inChord: P.inChord, bd }); if (P.events.length > 96) P.events.splice(0, 48);
  }
  function change(t, bd) {
    const c = P.chords[P.ci]; P.cur = c;
    P.events.push({ t, ci: P.ci, inChord: 0, bd }); padChord(c, t);
    if (c.first && $('ldTA').checked) {
      const e = P.entries[c.ei], p = e.p, buf = p.audio && !C.audioStale(p) ? P.bufs[p.audio] : null;
      if (buf) {
        const src = audioCtx.createBufferSource(), g = audioCtx.createGain(); src.buffer = buf;
        src.playbackRate.value = p.audioBpm ? P.v.bpm / p.audioBpm : 1; g.gain.value = 0.9;
        src.connect(g); g.connect(typeof ensureMasterBus === 'function' ? ensureMasterBus() : audioCtx.destination);
        const dur = C.beatsOf(p) * bd; src.start(t); src.stop(t + dur + 0.03);
        P.log.push({ t, dur, rate: src.playbackRate.value, bufDur: buf.duration, part: p.name });
        P.srcs.push(src); if (P.srcs.length > 16) P.srcs.shift();
      }
    }
  }
  async function play(v, opts) {
    opts = opts || {};
    if (P) stop();
    if (typeof Looper !== 'undefined' && Looper.busy && Looper.busy()) {
      if (!play.warned) { play.warned = true; status('Der Looper läuft – tippe nochmal auf ▶, dann stoppe ich ihn und spiele den Song.'); setTimeout(() => { play.warned = false; }, 6000); return false; }
      play.warned = false; Looper.stopAll();
    }
    if (window.Jam && Jam.active && (Jam.active() || Jam.debug())) Jam.stop();
    const fl = C.flat(v).filter(x => x.oi >= (opts.from || 0) && x.oi < (opts.from || 0) + (opts.count || 1e9));
    if (!fl.length || !fl.some(x => x.p.chords.length)) { status('Im Ablauf ist noch nichts zum Abspielen.'); return false; }
    ensureAudio();
    const bufs = {};
    if ($('ldTA').checked) for (const x of fl) if (x.p.audio && !bufs[x.p.audio] && !C.audioStale(x.p)) { try { bufs[x.p.audio] = await getBuffer(x.p.audio); } catch (e) {} }
    const chords = []; fl.forEach((x, ei) => x.p.chords.forEach((c, j) => chords.push({ r: c.r, t: c.t, beats: c.beats, ei, first: j === 0 })));
    const be = $('bpm'); be.value = v.bpm; be.dispatchEvent(new Event('input'));
    lastV = null;
    P = { v, entries: fl, chords, bufs, ci: 0, inChord: 0, pending: true, events: [], srcs: [], log: [], pass: 0, loop: !!opts.loop || (!opts.count && $('ldTL').checked), label: opts.label || '' };
    window.bassChordAt = () => { const c = P && P.cur; if (!c) return null; const iv = C.CH[c.t] || C.CH['']; return { root: c.r, fifth: iv.includes(7) ? 7 : iv.includes(6) ? 6 : 7 }; };
    P.unlisten = Rhythm.addListener(onStep, true);
    if ($('ldTD').checked && !Rhythm.on()) { Rhythm.setOn(true); P.ownDrums = true; }
    P.ownBass = false;
    if ($('ldTB').checked && typeof bassOn !== 'undefined' && !bassOn) { const bb = $('btnBass'); if (bb) { bb.click(); P.ownBass = true; } }
    Rhythm.setJam(true);
    P.watch = setInterval(() => { if (P && typeof Looper !== 'undefined' && Looper.busy && Looper.busy()) stop('Gestoppt, weil der Looper gestartet wurde.'); }, 300);
    $('ldPlay').classList.add('playing'); status(opts.label ? '▶ ' + opts.label : '▶ Song läuft – Improvisation und Quintenzirkel folgen.');
    return true;
  }
  function stop(msg) {
    if (!P) return;
    clearInterval(P.watch);
    try { P.unlisten(); } catch (e) {}
    const t = audioCtx ? audioCtx.currentTime : 0;
    P.srcs.forEach(s => { try { s.stop(t + 0.02); } catch (e) {} });
    const own = P.ownDrums, ob = P.ownBass; P = null;
    audioCache.clear();                             // entpackte Aufnahmen nur während der Wiedergabe im Speicher
    window.bassChordAt = null; Rhythm.setJam(false);
    if (own && Rhythm.on()) Rhythm.setOn(false);
    if (ob && typeof bassOn !== 'undefined' && bassOn) { const bb = $('btnBass'); if (bb) bb.click(); }
    if (audioCtx) padRelease(t);
    $('ldPlay').classList.remove('playing'); status(msg || 'Gestoppt.');
    paintPos();
  }
  function now() {
    if (!P || P.pending || !audioCtx) return null;
    const t = audioCtx.currentTime; let e = null;
    for (let i = P.events.length - 1; i >= 0; i--) if (P.events[i].t <= t) { e = P.events[i]; break; }
    if (!e) return null;
    const c = P.chords[e.ci], ent = P.entries[c.ei];
    let inPart = 0; for (let i = e.ci - 1; i >= 0 && P.chords[i].ei === c.ei; i--) inPart += P.chords[i].beats;
    const frac = Math.min(0.999, Math.max(0, (t - e.t) / e.bd));
    return { ci: e.ci, entry: ent, ei: c.ei, beat: inPart + e.inChord + frac, chord: c };
  }
  let lastEi = -1;
  function paintPos() {
    const n = now();
    if (!n) { $('ldPosL').textContent = P ? 'Startet mit dem nächsten Takt …' : 'Bereit'; $('ldPosP').textContent = ''; $('ldPosC').textContent = ''; if (lastEi !== -1) { panel.querySelectorAll('.ld-blk.on').forEach(b => b.classList.remove('on')); lastEi = -1; } return; }
    const p = n.entry.p, v = P.v;
    $('ldPosL').textContent = 'Spielt'; $('ldPosP').textContent = p.name + (n.entry.rep ? ' (' + (n.entry.rep + 1) + '.)' : '');
    $('ldPosC').textContent = C.cname(n.chord, v.key) + ' · Takt ' + (Math.floor(n.beat / 4) + 1) + '/' + C.beatsOf(p) / 4;
    const key2 = n.entry.oi;
    if (key2 !== lastEi && P.v === ver()) { panel.querySelectorAll('.ld-blk').forEach(b => b.classList.toggle('on', +b.dataset.i === key2)); lastEi = key2; }
  }
  $('ldPlay').addEventListener('click', () => { if (P) stop(); else { const v = ver(); if (v) play(v, { from: 0 }); } });

  // ================= Oberfläche =================
  let selOrd = -1, editPart = null, varCache = null;
  function render() {
    const sel = $('ldSong'); sel.innerHTML = '';
    db.songs.forEach(s => sel.add(new Option(s.name, s.id)));
    if (!db.songs.length) sel.add(new Option('– noch kein Song –', ''));
    const s = song(); if (s) sel.value = s.id;
    ['ldRename', 'ldDel'].forEach(id => { $(id).disabled = !s; });
    const v = ver(), has = !!(v && v.parts.length);
    $('ldEmpty').hidden = has; $('ldMain').hidden = !s;
    ['ldOrderCard', 'ldPartsCard', 'ldTextCard', 'ldCheckCard', 'ldVoiceCard'].forEach(id => { $(id).hidden = !has; });
    if (!s) return;
    const L = C.totals(v);
    $('ldInfo').innerHTML = '<b>' + C.keyLabel(v.key) + '</b> · ' + Math.round(v.bpm) + ' BPM · ' + L.bars + ' Takte · ' + C.mmss(L.secs)
      + ' <span class="ld-tr"><button class="toggle-btn" id="ldTrD" title="Halbton tiefer">♭ −½</button><button class="toggle-btn" id="ldTrU" title="Halbton höher">♯ +½</button></span>'
      + ' <label class="ld-bpm">Tempo <input type="number" id="ldBpm" min="40" max="220" step="1" value="' + Math.round(v.bpm) + '" inputmode="numeric"></label>';
    $('ldTrD').onclick = () => { pushVersion(C.transpose(v, -1), 'Halbton tiefer'); render(); };
    $('ldTrU').onclick = () => { pushVersion(C.transpose(v, 1), 'Halbton höher'); render(); };
    $('ldBpm').onchange = e => { const b = Math.max(40, Math.min(220, Math.round(+e.target.value) || v.bpm)); v.bpm = b; save(); render(); };
    const vs = $('ldVer'); vs.innerHTML = '';
    s.versions.forEach((x, i) => vs.add(new Option('V' + x.n + ' · ' + new Date(x.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' + x.note, i)));
    vs.value = s.cur;
    renderOrder(v); renderParts(v); renderText(v); renderVoice(v);
    $('ldFind').innerHTML = ''; $('ldVar').innerHTML = ''; varCache = null;
  }
  const TCLS = t => 't-' + t;
  function renderOrder(v) {
    const L = C.totals(v);
    $('ldOrderInfo').textContent = v.order.length + ' Abschnitte · ' + C.mmss(L.secs);
    $('ldOrder').innerHTML = v.order.map((o, i) => { const p = C.partById(v, o.p); if (!p) return ''; const bars = C.beatsOf(p) / 4;
      return '<button class="ld-blk ' + TCLS(p.type) + (i === selOrd ? ' sel' : '') + '" data-i="' + i + '" style="flex-grow:' + Math.max(1, bars * o.reps) + '"><b>' + esc(p.name) + '</b><small>' + bars + ' T' + (o.reps > 1 ? ' × ' + o.reps : '') + (p.audio && !C.audioStale(p) ? ' · 🎙' : '') + '</small></button>'; }).join('')
      || '<div class="sf-empty">Ablauf ist leer – unten einen Teil einfügen.</div>';
    $('ldOrdEdit').hidden = selOrd < 0 || selOrd >= v.order.length;
    if (!$('ldOrdEdit').hidden) $('ldReps').textContent = v.order[selOrd].reps;
    const a = $('ldAdd'); a.innerHTML = '<option value="">+ Teil anhängen …</option>' + v.parts.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('');
  }
  function chordChips(p, k) { return p.chords.map(c => '<span class="ld-ch"><b>' + C.cname(c, k) + '</b><small>' + C.roman(c, k) + (c.beats !== 4 ? ' · ' + (c.beats % 4 ? c.beats + ' Schl.' : c.beats / 4 + ' T') : '') + '</small></span>').join(''); }
  function chordText(p, k) { return p.chords.map(c => (C.cname(c, k).replace(/♯/g, '#').replace(/♭/g, 'b').replace('°', 'dim').replace('m7♭5', 'm7b5')) + (c.beats !== 4 ? ':' + String(c.beats / 4).replace('.', ',') : '')).join(' '); }
  function renderParts(v) {
    $('ldParts').innerHTML = v.parts.map(p => {
      const used = v.order.some(o => o.p === p.id), stale = C.audioStale(p);
      const au = p.audio ? (stale ? '<span class="ld-au stale">🎙 Aufnahme passt nicht mehr (stumm)</span>' : '<span class="ld-au">🎙 Aufnahme · ' + Math.round(p.audioBpm || v.bpm) + ' BPM</span>') : '<span class="ld-au none">nur Begleitung</span>';
      return '<div class="ld-part ' + TCLS(p.type) + '" data-id="' + p.id + '"><div class="ld-ph">'
        + '<input class="ld-pname" value="' + esc(p.name) + '" maxlength="40" aria-label="Name des Teils">'
        + '<select class="ld-ptype" aria-label="Art">' + Object.entries(C.TYPES).map(([k, n]) => '<option value="' + k + '"' + (k === p.type ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>'
        + '<span class="ld-pbars">' + C.beatsOf(p) / 4 + ' Takte</span>' + au + '</div>'
        + (editPart === p.id
          ? '<div class="ld-pedit"><input type="text" class="ld-ptext" value="' + esc(chordText(p, v.key)) + '" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Akkorde"><button class="toggle-btn active" data-a="ok">Übernehmen</button><button class="toggle-btn" data-a="cancel">Abbrechen</button><span class="caption">z. B. „Am F C G“, „Am7:2 D7“ (2 Takte), „C:½ G:½“</span></div>'
          : '<div class="ld-pchords" data-a="edit" role="button" tabindex="0" title="Akkorde ändern">' + (chordChips(p, v.key) || '<span class="caption">Akkorde eintragen …</span>') + '</div>')
        + '<div class="ld-pact"><button class="toggle-btn" data-a="play">▶ Teil</button><button class="toggle-btn" data-a="jam">→ Backing Track</button>'
        + (used ? '' : '<button class="toggle-btn" data-a="add">In den Ablauf</button>') + '<button class="toggle-btn" data-a="del">Löschen</button></div></div>';
    }).join('');
  }
  $('ldParts').addEventListener('click', e => {
    const row = e.target.closest('.ld-part'); if (!row) return;
    const v = ver(), p = C.partById(v, row.dataset.id), a = (e.target.closest('[data-a]') || {}).dataset; if (!a || !a.a || !p) return;
    if (a.a === 'edit') { editPart = p.id; renderParts(v); const t = $('ldParts').querySelector('.ld-part[data-id="' + p.id + '"] .ld-ptext'); if (t) t.focus(); return; }
    if (a.a === 'cancel') { editPart = null; renderParts(v); return; }
    if (a.a === 'ok') {
      const txt = row.querySelector('.ld-ptext').value, r = window.Jam && Jam.parse ? Jam.parse(txt) : { seq: [], bad: [txt] };
      if (!r.seq.length) { status('Keine Akkorde erkannt' + (r.bad.length ? ': ' + r.bad.join(' ') : '')); return; }
      p.chords = r.seq.map(c => ({ r: c.r, t: c.t, beats: c.beats })); editPart = null; save(); render();
      status(r.bad.length ? 'Übernommen – nicht verstanden: ' + r.bad.join(' ') : (C.audioStale(p) ? 'Akkorde geändert – die Aufnahme dieses Teils ist jetzt stumm (passt nicht mehr).' : 'Akkorde übernommen.'));
      return;
    }
    if (a.a === 'play') { const oi = v.order.findIndex(o => o.p === p.id); if (oi >= 0) play(v, { from: oi, count: 1, loop: true, label: p.name + ' (Schleife)' }); else play({ key: v.key, bpm: v.bpm, parts: [p], order: [{ p: p.id, reps: 1 }] }, { loop: true, label: p.name + ' (Schleife)' }); return; }
    if (a.a === 'jam') { if (window.Jam) { Jam.load(v.key, 0); Jam.setSeq(chordText(p, v.key)); const t = $('tab-jam'); if (t) t.click(); } return; }
    if (a.a === 'add') { v.order.push({ p: p.id, reps: 1 }); save(); render(); return; }
    if (a.a === 'del') {
      if (row.dataset.arm !== '1') { row.dataset.arm = '1'; e.target.textContent = 'Wirklich löschen?'; setTimeout(() => { if (row.isConnected) { row.dataset.arm = ''; e.target.textContent = 'Löschen'; } }, 2500); return; }
      v.parts = v.parts.filter(x => x !== p); v.order = v.order.filter(o => o.p !== p.id); selOrd = -1; save(); render(); return;
    }
  });
  $('ldParts').addEventListener('change', e => {
    const row = e.target.closest('.ld-part'); if (!row) return;
    const v = ver(), p = C.partById(v, row.dataset.id); if (!p) return;
    if (e.target.classList.contains('ld-pname')) { p.name = e.target.value.trim().slice(0, 40) || p.name; save(); renderOrder(v); }
    if (e.target.classList.contains('ld-ptype')) { p.type = e.target.value; save(); render(); }
  });
  $('ldParts').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('ld-ptext')) { e.preventDefault(); e.target.closest('.ld-part').querySelector('[data-a="ok"]').click(); } });
  $('ldOrder').addEventListener('click', e => { const b = e.target.closest('.ld-blk'); if (!b) return; selOrd = selOrd === +b.dataset.i ? -1 : +b.dataset.i; renderOrder(ver()); });
  $('ldOrdEdit').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const v = ver(), o = v.order, i = selOrd; if (i < 0 || i >= o.length) return;
    const a = b.dataset.a;
    if (a === 'left' && i > 0) { o.splice(i - 1, 0, o.splice(i, 1)[0]); selOrd--; }
    else if (a === 'right' && i < o.length - 1) { o.splice(i + 1, 0, o.splice(i, 1)[0]); selOrd++; }
    else if (a === 'minus') o[i].reps = Math.max(1, o[i].reps - 1);
    else if (a === 'plus') o[i].reps = Math.min(8, o[i].reps + 1);
    else if (a === 'dup') { o.splice(i + 1, 0, Object.assign({}, o[i])); selOrd++; }
    else if (a === 'del') { o.splice(i, 1); selOrd = -1; }
    else if (a === 'playfrom') { play(v, { from: i }); return; }
    save(); render();
  });
  $('ldAdd').addEventListener('change', e => { const id = e.target.value; if (!id) return; const v = ver(); v.order.push({ p: id, reps: 1 }); save(); render(); });
  $('ldSong').addEventListener('change', e => { if (P) stop(); db.active = e.target.value; selOrd = -1; save(); render(); });
  $('ldVer').addEventListener('change', e => { if (P) stop(); const s = song(); s.cur = +e.target.value; save(); render(); status('Version V' + s.versions[s.cur].n + ' geöffnet – Änderungen und Varianten bauen ab hier weiter.'); });
  $('ldVerSave').addEventListener('click', () => { const v = ver(); if (v) { pushVersion(v, 'gesichert'); render(); status('Als neue Version gesichert.'); } });
  $('ldNew').addEventListener('click', () => { newSong(); render(); status('Neuer Song angelegt – übernimm Teile im Looper mit „→ Song“.'); });
  $('ldRename').addEventListener('click', () => {
    const s = song(); if (!s) return; const box = $('ldInfo');
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = s.name; inp.maxLength = 60; inp.className = 'ld-rename'; inp.setAttribute('aria-label', 'Neuer Name');
    box.prepend(inp); inp.focus(); inp.select();
    const done = () => { const n = inp.value.trim(); if (n) { s.name = n.slice(0, 60); save(); } render(); };
    inp.addEventListener('blur', done); inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
  $('ldDel').addEventListener('click', async e => {
    const s = song(); if (!s) return; const b = e.target;
    if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = '„' + s.name + '“ wirklich löschen?'; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Löschen'; }, 3000); return; }
    b.dataset.arm = ''; b.textContent = 'Löschen';
    if (P) stop();
    await dropSongAudio(s); db.songs = db.songs.filter(x => x !== s); db.active = db.songs.length ? db.songs[db.songs.length - 1].id : null; save(); render(); status('Song gelöscht.');
  });

  // ---- Prüfen und Varianten ----
  const ICON = { ok: '✓', tip: '➜', warn: '!', info: 'i' };
  $('ldCheck').addEventListener('click', () => {
    const v = ver(); if (!v) return;
    const F = C.analyse(v).concat(window.LiedText ? LiedText.analyse(v, song().name) : []);
    $('ldFind').innerHTML = F.map(f => '<li class="' + f.lvl + '"><span>' + ICON[f.lvl] + '</span>' + esc(f.text) + '</li>').join('');
    varCache = C.variants(v);
    $('ldVar').innerHTML = varCache.length ? '<div class="ld-varh">Varianten – anhören, dann übernehmen (wird eine neue Version)</div>' + varCache.map((x, i) => '<div class="ld-vc" data-i="' + i + '"><b>' + esc(x.title) + '</b><p>' + esc(x.desc) + '</p><div class="ld-vact"><button class="toggle-btn" data-a="hear">▶ Anhören</button><button class="toggle-btn active" data-a="take">Übernehmen</button></div></div>').join('') : '';
  });
  $('ldVar').addEventListener('click', e => {
    const card = e.target.closest('.ld-vc'), b = e.target.closest('[data-a]'); if (!card || !b || !varCache) return;
    const x = varCache[+card.dataset.i], v = ver(), nv = x.apply(v);
    if (b.dataset.a === 'hear') {
      if (P && P.label === x.title) { stop(); return; }
      // ab dem betroffenen Teil zwei Abschnitte, bei neuen Teilen ab dem ersten neuen
      let from = nv.order.findIndex(o => !v.parts.some(p => p.id === o.p)); if (from < 0 && x.part) from = nv.order.findIndex(o => o.p === x.part);
      from = Math.max(0, from - 1);
      play(nv, { from, count: 3, label: x.title });
    } else { if (P) stop(); pushVersion(nv, x.title); render(); status('„' + x.title + '“ übernommen – neue Version V' + ver().n + '. Mit „Version“ kommst du jederzeit zurück.'); }
  });

  // ---- Gesang ----
  for (let m = 36; m <= 88; m++) { $('ldLo').add(new Option(C.noteName(m, { pc: 0, major: true }), m)); $('ldHi').add(new Option(C.noteName(m, { pc: 0, major: true }), m)); }
  $('ldVoice').add(new Option('eigene Werte', ''));
  C.VOICES.forEach(x => $('ldVoice').add(new Option(x.n + ' (' + C.noteName(x.lo, { pc: 0, major: true }) + '–' + C.noteName(x.hi, { pc: 0, major: true }) + ')', x.id)));
  function voiceOf(s) { return s.voice || { preset: 'bariton', lo: 43, hi: 65 }; }
  function renderVoice(v) {
    const s = song(), vo = voiceOf(s);
    $('ldVoice').value = vo.preset || ''; $('ldLo').value = vo.lo; $('ldHi').value = vo.hi;
    $('ldVoiceInfo').textContent = 'Umfang ' + (vo.hi - vo.lo) + ' Halbtöne';
    const r = C.voiceKey(v, vo.lo, vo.hi);
    if (!r) { $('ldVoiceRes').textContent = 'Höchster Ton muss über dem tiefsten liegen.'; $('ldTargets').innerHTML = ''; return; }
    const W = { gut: 'passt gut', knapp: 'passt knapp', eng: 'wird eng' };
    let h = '<p>In <b>' + r.label + '</b> ' + W[r.now.fit] + ' zu deiner Stimme.</p>';
    if (r.best.d !== 0 && r.best.s > r.now.s + 0.5) h += '<p>Besser liegt <b>' + r.best.label + '</b> (' + (r.best.d > 0 ? '+' : '−') + Math.abs(r.best.d) + (Math.abs(r.best.d) === 1 ? ' Halbton' : ' Halbtöne') + '): ' + W[r.best.fit] + '. <button class="toggle-btn active" id="ldVoiceT">In ' + r.best.label + ' umsetzen</button></p><p class="caption">Auf der Gitarre: ' + (r.best.d > 0 ? 'Kapodaster in Bund ' + r.best.d + ' und gleiche Griffe' : 'Akkorde ' + (-r.best.d) + (r.best.d === -1 ? ' Halbton' : ' Halbtöne') + ' tiefer greifen') + '. Aufnahmen werden dabei stumm (neu einspielen).</p>';
    else h += '<p class="caption">Die Tonart liegt für deinen Umfang schon günstig.</p>';
    h += '<p class="caption">Grundton der Melodie etwa bei <b>' + C.noteName(r.now.tonic, v.key) + '</b> – Strophe eher darunter bis darum, Refrain darüber.</p>';
    $('ldVoiceRes').innerHTML = h;
    const bt = $('ldVoiceT'); if (bt) bt.onclick = () => { pushVersion(C.transpose(v, r.best.d), 'für die Stimme nach ' + r.best.label); render(); };
    $('ldTargets').innerHTML = '<div class="ld-varh">Zieltöne je Akkord in deinem Umfang (Terz hervorgehoben) – darauf landen, dann sitzt die Melodie</div>' + C.targets(v, vo.lo, vo.hi).map(t =>
      '<div class="ld-tg"><b>' + esc(t.name) + '</b>' + t.rows.map(r2 => '<div class="ld-tgr"><span class="ld-tgc">' + r2.chord + '</span>' + r2.notes.map(n => '<span class="ld-tgn' + (n.third ? ' third' : n.root ? ' root' : '') + '" data-m="' + n.m + '">' + n.name + '</span>').join('') + '</div>').join('') + '</div>').join('');
  }
  function setVoice(o) { const s = song(); if (!s) return; s.voice = Object.assign(voiceOf(s), o); save(); renderVoice(ver()); }
  $('ldVoice').addEventListener('change', e => { const x = C.VOICES.find(q => q.id === e.target.value); if (x) setVoice({ preset: x.id, lo: x.lo, hi: x.hi }); else setVoice({ preset: '' }); });
  $('ldLo').addEventListener('change', e => setVoice({ preset: '', lo: +e.target.value }));
  $('ldHi').addEventListener('change', e => setVoice({ preset: '', hi: +e.target.value }));
  $('ldTargets').addEventListener('click', e => { const n = e.target.closest('[data-m]'); if (n && window.Quinten) Quinten.playNote(+n.dataset.m); });
  async function measure(which) {
    const b = $(which === 'lo' ? 'ldMeasLo' : 'ldMeasHi');
    if (typeof Looper === 'undefined' || !Looper.openInput || typeof Pitch === 'undefined') return;
    if (!(await Looper.openInput())) { status('Kein Zugriff auf den Eingang.'); return; }
    const an = Looper.inputAnalyser(); if (!an) return;
    const buf = new Float32Array(an.fftSize), got = []; b.disabled = true;
    status(which === 'lo' ? 'Sing jetzt deinen tiefsten bequemen Ton und halte ihn … (3 s)' : 'Sing jetzt deinen höchsten bequemen Ton und halte ihn … (3 s)');
    const t0 = performance.now();
    await new Promise(res => { const iv = setInterval(() => { an.getFloatTimeDomainData(buf); const r = Pitch.detect(buf, audioCtx.sampleRate, { gate: 0.006, fmin: 60, fmax: 1200 }); if (r && r.conf > 0.85) got.push(r.midi); if (performance.now() - t0 > 3000) { clearInterval(iv); res(); } }, 60); });
    if (Looper.releaseAnalyser) Looper.releaseAnalyser();
    b.disabled = false;
    if (got.length < 6) { status('Kein klarer Ton erkannt – etwas lauter oder näher ans Mikrofon und nochmal.'); return; }
    got.sort((a, c) => a - c); const m = got[Math.floor(got.length / 2)];
    setVoice(which === 'lo' ? { preset: '', lo: m } : { preset: '', hi: m });
    status((which === 'lo' ? 'Tiefster' : 'Höchster') + ' Ton: ' + C.noteName(m, { pc: 0, major: true }) + ' übernommen.');
  }
  $('ldMeasLo').addEventListener('click', () => measure('lo'));
  $('ldMeasHi').addEventListener('click', () => measure('hi'));

  // ================= Text =================
  const X = window.LiedText;
  let saveT = null;
  const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 450); };
  // Eingabefelder: je Teil so viele, wie er (mit eigenem Text) gespielt wird; Refrain & Co. nur einmal, außer es gibt schon mehr Texte
  function textSlots(v) {
    const occ = X.occurrences(v), times = {}, first = [];
    occ.forEach(o => { times[o.p.id] = (times[o.p.id] || 0) + 1; if (!first.includes(o.p)) first.push(o.p); });
    v.parts.forEach(p => { if (!first.includes(p)) first.push(p); });
    const REP = ['chorus', 'pre', 'intro', 'outro', 'solo'], out = [];
    first.forEach(p => {
      const L = p.lyrics || [], filled = L.reduce((a, t, i) => t && t.trim() ? i + 1 : a, 0);
      const n = REP.includes(p.type) ? Math.max(1, filled) : Math.max(1, times[p.id] || 0, filled);
      for (let i = 0; i < n; i++) out.push({ p, n: i, multi: n > 1 });
    });
    return out;
  }
  function gutterHtml(ls) { return ls.map(x => x.empty ? '<div></div>' : '<div><span>' + x.syl + '</span><b class="' + (x.near ? 'near' : x.alone ? 'alone' : '') + '">' + x.letter + (x.near ? '~' : '') + '</b></div>').join('') + '<div></div>'; }
  function statsText(ls, p) {
    const f = ls.filter(x => !x.empty); if (!f.length) return C.beatsOf(p) / 4 + ' Takte';
    return f.length + ' Zeilen · ' + C.beatsOf(p) / 4 + ' Takte · Reim ' + X.scheme(ls) + ' · Silben ' + f.map(x => x.syl).join('/');
  }
  function curLang(v) { const t = []; v.parts.forEach(p => (p.lyrics || []).forEach(x => { if (x) t.push(x); })); return X.lang(t); }
  function renderText(v) {
    if (!X) return;
    $('ldTheme').value = v.theme || '';
    const lg = curLang(v);
    $('ldTexts').innerHTML = textSlots(v).map(sl => {
      const p = sl.p, t = (p.lyrics || [])[sl.n] || '', ls = X.lines(t, lg), rows = Math.max(3, t.split('\n').length + 1);
      const ph = sl.n === 0 ? 'Text für „' + p.name + '“ …' : 'Text beim ' + (sl.n + 1) + '. Mal …';
      return '<div class="ld-tx ' + TCLS(p.type) + '" data-id="' + p.id + '" data-n="' + sl.n + '"><div class="ld-txh"><b>' + esc(p.name) + (sl.multi ? ' · ' + (sl.n + 1) + '. Mal' : '') + '</b>'
        + '<span class="ld-txc">' + esc(X.chordText(p.chords, v.key)) + '</span><span class="ld-txs">' + esc(statsText(ls, p)) + '</span></div>'
        + '<div class="ld-txb"><div class="ld-gut">' + gutterHtml(ls) + '</div><textarea class="ld-txt" rows="' + rows + '" wrap="off" autocapitalize="sentences" placeholder="' + esc(ph) + '" aria-label="Text ' + esc(p.name) + '">' + esc(t) + '</textarea></div></div>';
    }).join('');
  }
  $('ldTexts').addEventListener('input', e => {
    const ta = e.target; if (!ta.classList.contains('ld-txt')) return;
    const box = ta.closest('.ld-tx'), v = ver(), p = C.partById(v, box.dataset.id), n = +box.dataset.n; if (!p) return;
    const L = (p.lyrics || []).slice(); while (L.length < n) L.push(''); L[n] = ta.value;
    while (L.length && !(L[L.length - 1] || '').trim() && L.length > 1) L.pop();
    p.lyrics = L;
    const ls = X.lines(ta.value, curLang(v));
    ta.rows = Math.max(3, ta.value.split('\n').length + 1);
    box.querySelector('.ld-gut').innerHTML = gutterHtml(ls); box.querySelector('.ld-txs').textContent = statsText(ls, p);
    saveSoon();
  });
  $('ldTheme').addEventListener('input', e => { const v = ver(); if (!v) return; v.theme = e.target.value.slice(0, 200); saveSoon(); });
  async function shareFile(file, okMsg) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: file.name }); status(okMsg); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000); status(okMsg);
  }
  $('ldPdf').addEventListener('click', async () => {
    const s = song(), v = ver(); if (!s || !v || !window.LiedPdf) return;
    try {
      const r = LiedPdf.build(X.leadsheet(s, v));
      const nm = (s.name || 'Song').replace(/[\\/:*?"<>|]+/g, ' ').trim() + ' – Leadsheet V' + v.n + '.pdf';
      await shareFile(new File([r.bytes], nm, { type: 'application/pdf' }), 'Leadsheet erstellt (' + r.pages + (r.pages === 1 ? ' Seite' : ' Seiten') + ').');
    } catch (e) { status('Leadsheet fehlgeschlagen: ' + (e && e.message || e)); }
  });

  // ================= Mit Claude (Song-Code) =================
  Object.entries(X ? X.GOALS : {}).forEach(([k, g]) => $('ldGoal').add(new Option(g.n, k)));
  $('ldGoal').value = 'text';
  $('ldGoal').addEventListener('change', e => { $('ldOwn').hidden = e.target.value !== 'eigen'; if (!$('ldOwn').hidden) $('ldOwn').focus(); });
  if (navigator.share) $('ldShare').hidden = false;
  function voiceLabel(s) { const vo = voiceOf(s), pr = C.VOICES.find(x => x.id === vo.preset); return (pr ? pr.n + ' ' : '') + C.noteName(vo.lo, { pc: 0, major: true }) + '–' + C.noteName(vo.hi, { pc: 0, major: true }); }
  function promptText() {
    let s = song(), v = ver();
    if (!s || !v) { s = { name: 'Neuer Song', voice: null }; v = { n: 1, key: { pc: 0, major: true }, bpm: 90, theme: '', parts: [{ id: 'p1', name: 'Strophe', type: 'verse', chords: [], lyrics: [] }, { id: 'p2', name: 'Refrain', type: 'chorus', chords: [], lyrics: [] }], order: [{ p: 'p1', reps: 1 }, { p: 'p2', reps: 1 }] }; }
    return X.prompt(s, v, $('ldGoal').value, $('ldOwn').value, voiceLabel(s));
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok;
  }
  $('ldCopy').addEventListener('click', async () => {
    if ($('ldGoal').value === 'eigen' && !$('ldOwn').value.trim()) { status('Schreib kurz deinen Wunsch an Claude ins Feld.'); $('ldOwn').focus(); return; }
    const t = promptText(); window.__lastPrompt = t;
    status(await copyText(t) ? 'Kopiert – jetzt in einen Chat mit Claude einfügen und senden.' : 'Kopieren ging nicht – nutze „Teilen …“.');
  });
  $('ldShare').addEventListener('click', async () => { const t = promptText(); window.__lastPrompt = t; try { await navigator.share({ text: t, title: (song() || { name: 'Song' }).name }); } catch (e) {} });
  $('ldClip').addEventListener('click', async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { $('ldPaste').value = t; readCode(); } else status('Die Zwischenablage ist leer.'); }
    catch (e) { status('Kein Zugriff auf die Zwischenablage – lange ins Feld tippen und „Einsetzen“ wählen.'); $('ldPaste').focus(); }
  });
  let imp = null;
  function readCode() {
    const base = ver(), r = X.fromCode($('ldPaste').value, base), box = $('ldImRes');
    imp = null;
    if (!r.ok) { box.innerHTML = '<h3>Konnte den Song-Code nicht übernehmen</h3><ul class="err">' + r.errs.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' + (r.warn && r.warn.length ? '<ul class="wrn">' + r.warn.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '') + '<p class="note">Tipp: Claude bitten, „den vollständigen Song-Code im selben Format“ zu schicken.</p>'; return; }
    imp = r;
    const s = song(), d = base ? X.diff(base, r.v, s.name, r.title) : ['Neuer Song mit ' + r.v.parts.length + ' Teilen'];
    box.innerHTML = '<h3>Vorschlag von Claude' + (r.title ? ' – „' + esc(r.title) + '“' : '') + '</h3>'
      + (r.note ? '<p class="note"><b>Notiz:</b> ' + esc(r.note) + '</p>' : '')
      + (d.length ? '<ul>' + d.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p class="note">Keine Änderungen gegenüber der aktuellen Version.</p>')
      + (r.warn.length ? '<ul class="wrn">' + r.warn.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '')
      + '<div class="ld-vact"><button class="toggle-btn" data-a="hear">▶ Anhören</button>' + (base ? '<button class="toggle-btn active" data-a="take"' + (d.length ? '' : ' disabled') + '>Als neue Version übernehmen</button>' : '') + '<button class="toggle-btn" data-a="new">Als neuer Song</button><button class="toggle-btn" data-a="drop">Verwerfen</button></div>';
  }
  $('ldRead').addEventListener('click', readCode);
  $('ldImRes').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || !imp) return; const a = b.dataset.a;
    if (a === 'hear') { if (P && P.label === 'Vorschlag von Claude') { stop(); return; } play(imp.v, { label: 'Vorschlag von Claude' }); return; }
    if (a === 'drop') { imp = null; $('ldImRes').innerHTML = ''; $('ldPaste').value = ''; return; }
    if (P) stop();
    const note = 'Claude: ' + (imp.note || X.GOALS[$('ldGoal').value].n).slice(0, 70);
    if (a === 'take') {
      const s = song(); if (imp.title && imp.title !== s.name) s.name = imp.title.slice(0, 60);
      pushVersion(imp.v, note); status('Übernommen – neue Version V' + ver().n + '. Mit „Version“ kommst du jederzeit zurück.');
    } else {
      const old = song(), s = newSong((imp.title || (old ? old.name + ' (Claude)' : 'Song von Claude')).slice(0, 60));
      if (old && old.voice) s.voice = C.clone(old.voice);
      s.versions[0] = Object.assign(C.clone(imp.v), { n: 1, at: Date.now(), note }); save();
      status('Als neuer Song „' + s.name + '“ angelegt.');
    }
    imp = null; $('ldImRes').innerHTML = ''; $('ldPaste').value = ''; selOrd = -1; render();
  });

  let ui = null;
  document.addEventListener('tabchange', e => {
    clearInterval(ui); ui = null;
    if (e.detail === 'lied') { db = load(); if (P) P.v = P.v; render(); ui = setInterval(paintPos, 120); }
  });
  render();
  // Schnittstelle (Improvisation, Quintenzirkel, Tests)
  window.Lied = {
    active: () => !!P && !P.pending,
    chordInfo: () => {
      const n = now(); if (!n) return null;
      const p = n.entry.p, names = p.chords.map(c => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][c.r] + c.t);
      let a = 0; const segs = p.chords.map((c, i) => { const s2 = { name: names[i], a: a * 1000, e: (a + c.beats) * 1000 }; a += c.beats; return s2; });
      const downs = []; for (let x = 0; x < a; x += 4) downs.push(x * 1000);
      return { tracks: [], track: -3, segs, L: a * 1000, pos: n.beat * 1000, downs, sr: 1000, key: P.v.key, playing: true, jam: true, lied: true };
    },
    nowChord: () => { const n = now(); return n ? { name: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n.chord.r] + n.chord.t } : null; },
    log: () => P ? P.log.slice() : [], grid: () => P ? P.events.filter(e => e.inChord === 0).map(e => e.t) : [],
    db: () => db, song, ver, play, prompt: () => promptText(), readCode, imp: () => imp, stop, openCapture, render, now: () => { const n = now(); return n ? { part: n.entry.p.name, oi: n.entry.oi, chord: n.chord, beat: n.beat } : null; },
    _reload: () => { db = load(); render(); }
  };
})();
