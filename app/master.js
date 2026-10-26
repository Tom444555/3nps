// v97 Mastering M1: Quelle laden, messen (EBU R128), auf Lautheitsziel bringen (True-Peak-Limiter), A/B gleich laut, WAV 24 Bit.
// Rechnen im Worker (Funktionen aus master-dsp.js), Oberfläche im Reiter „Mastering“. Schnittstelle window.Master auch für den Song-Export.
(function () {
  const $ = id => document.getElementById(id), TT = s => (typeof T === 'function' ? T(s) : s);
  const TARGETS = {
    stream: { I: -14, T: -1, label: 'Streaming −14 LUFS' }, apple: { I: -16, T: -1, label: 'Apple Music −16 LUFS' },
    deezer: { I: -15, T: -1, label: 'Deezer −15 LUFS' }, loud: { I: -9, T: -1, label: 'Laut −9 LUFS' }, own: { I: -14, T: -1, label: 'Eigene Vorgabe' }
  };
  const KEY = '3nps-master-target';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const lsSet = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  function target() {
    const s = lsGet() || {}, k = TARGETS[s.k] ? s.k : 'stream', t = Object.assign({ k }, TARGETS[k]);
    if (k === 'own') { t.I = isFinite(s.I) ? Math.max(-30, Math.min(-6, +s.I)) : -14; t.T = isFinite(s.T) ? Math.max(-6, Math.min(0, +s.T)) : -1; t.label = TT('Eigene Vorgabe') + ' ' + fmt(t.I) + ' LUFS'; }
    else t.label = TT(t.label);
    return t;
  }
  const fmt = (v, d) => v == null || !isFinite(v) ? '–' : (Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toFixed(d == null ? 1 : d).replace('-', '−').replace('.', window.__lang === 'en' ? '.' : ',');

  // ---------- Worker ----------
  let W = null, wid = 0; const wait = {};
  function worker() {
    if (W) return W;
    const src = [mdKCoeffs, mdTpFilter, mdTpRun, mdMeasure, mdLimit, mdNormalize].map(f => f.toString()).join('\n') + `
      onmessage = e => { const d = e.data, id = d.id;
        try {
          if (d.type === 'measure') { postMessage({ id, res: mdMeasure(d.chs, d.sr) }); return; }
          const r = mdNormalize(d.chs, d.sr, d.I, d.T, { before: d.before }, f => postMessage({ id, prog: f }));
          postMessage({ id, res: { before: r.before, after: r.after, gainDb: r.gainDb, red: r.red, steps: r.steps, outs: r.outs } }, r.outs.map(o => o.buffer));
        } catch (err) { postMessage({ id, err: String(err && err.message || err) }); } };`;
    W = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    W.onmessage = e => { const p = wait[e.data.id]; if (!p) return; if (e.data.prog != null) { p.prog && p.prog(e.data.prog); return; } delete wait[e.data.id]; e.data.err ? p.rej(new Error(e.data.err)) : p.res(e.data.res); };
    W.onerror = e => { Object.keys(wait).forEach(k => { wait[k].rej(new Error('Worker')); delete wait[k]; }); W = null; };
    return W;
  }
  function call(msg, prog, transfer) { return new Promise((res, rej) => { const id = ++wid; wait[id] = { res, rej, prog }; worker().postMessage(Object.assign({ id }, msg), transfer || []); }); }
  // chs werden kopiert (die Originale bleiben für den Vergleich)
  const measure = (chs, sr) => { const c = chs.map(x => x.slice()); return call({ type: 'measure', chs: c, sr }, null, c.map(x => x.buffer)); };
  const normalize = (chs, sr, I, Tp, prog, before) => { const c = chs.map(x => x.slice()); return call({ type: 'normalize', chs: c, sr, I, T: Tp, before }, prog, c.map(x => x.buffer)); };
  function reportText(name, r, t) {
    const a = r.before, b = r.after, row = (k, x, y, u) => k.padEnd(24) + (fmt(x) + ' ' + u).padStart(12) + (y === undefined ? '' : (fmt(y) + ' ' + u).padStart(12));
    return [TT('Mastering-Bericht') + ' – ' + name, TT('Ziel: ') + t.label + ' · ' + fmt(t.T) + ' dBTP', '', ''.padEnd(24) + TT('Vorher').padStart(12) + TT('Nachher').padStart(12),
      row(TT('Lautheit (integriert)'), a.I, b.I, 'LUFS'), row(TT('True Peak'), a.TP, b.TP, 'dBTP'), row(TT('Lautheitsumfang (LRA)'), a.LRA, b.LRA, 'LU'),
      row(TT('Kurzzeit max.'), a.Smax, b.Smax, 'LUFS'), row(TT('Dynamik (PLR)'), a.PLR, b.PLR, 'dB'), '',
      TT('Verstärkung ') + fmt(r.gainDb) + ' dB · ' + TT('Begrenzer max. ') + fmt(r.red) + ' dB', TT('Erstellt mit dem 3nps-Übungsprogramm (eigene Messung nach ITU-R BS.1770-4 / EBU R128).')].join('\n');
  }

  // ---------- Oberfläche ----------
  const panel = $('panel-master'); if (!panel) { window.Master = { measure, normalize, target, reportText, TARGETS }; return; }
  let cur = null;   // { name, chs, sr, before, res }
  let play = null;  // { a, b, ga, gb, t0, off }
  const status = m => { $('msStatus').textContent = m; };
  const hint = m => { $('msHint').hidden = !m; $('msHint').textContent = m || ''; };
  const prog = f => { $('msProg').hidden = f == null; $('msBar').style.width = Math.round((f || 0) * 100) + '%'; };
  function paintTarget() {
    const t = target(); $('msTarget').value = t.k; $('msOwnI').hidden = $('msOwnT').hidden = t.k !== 'own';
    if (t.k === 'own') { $('msI').value = t.I; $('msT').value = t.T; }
    $('mvIz').textContent = fmt(t.I) + ' LUFS'; $('mvTz').textContent = '≤ ' + fmt(t.T) + ' dBTP';
    hint(t.I > -14 ? TT('Lauter als −14 LUFS drehen Spotify, YouTube & Co. ohnehin leiser – lohnt sich nur für Club oder CD.') : '');
  }
  function paintVals() {
    const a = cur && cur.before, r = cur && cur.res, b = r && r.after, t = target();
    const set = (id, v, u, cls) => { const el = $(id); el.textContent = v == null || !isFinite(v) ? '–' : fmt(v) + ' ' + u; el.className = cls || ''; };
    set('mvI0', a && a.I, 'LUFS'); set('mvT0', a && a.TP, 'dBTP', a && a.TP > t.T + 0.05 ? 'bad' : ''); set('mvL0', a && a.LRA, 'LU'); set('mvS0', a && a.Smax, 'LUFS'); set('mvP0', a && a.PLR, 'dB');
    set('mvI1', b && b.I, 'LUFS', b ? (Math.abs(b.I - t.I) <= 0.2 ? 'ok' : 'bad') : ''); set('mvT1', b && b.TP, 'dBTP', b ? (b.TP <= t.T + 0.05 ? 'ok' : 'bad') : '');
    set('mvL1', b && b.LRA, 'LU'); set('mvS1', b && b.Smax, 'LUFS'); set('mvP1', b && b.PLR, 'dB'); set('mvR1', r && r.red, 'dB');
    $('msRun').disabled = !cur; $('msSave').disabled = !(r && r.outs); $('msPlay').disabled = !cur; $('msPos').disabled = !cur;
  }
  async function getSource() {
    const v = $('msSrc').value;
    if (v === 'file') return null;   // über Dateiauswahl
    if (window.MasterSource) { const r = await window.MasterSource(v); if (r) return r; }   // v112: Studio liefert Projekt-Mix
    if (v[0] === 't') {
      const i = +v[1], x = typeof Looper !== 'undefined' && Looper.singAudio ? Looper.singAudio(i, 0, 1e12) : null;
      if (!x) throw new Error(TT('Auf dieser Spur liegt keine geladene Datei. Mastering geht mit geladenen Dateien (z. B. aus Logic) – oder „Datei vom iPad …“ wählen.'));
      return { name: TT('Looper Spur ') + (i + 1), chs: x.r && x.r !== x.l ? [x.l.slice(), x.r.slice()] : [x.l.slice()], sr: x.sr };
    }
    const L = window.Lied, s = L && L.song && L.song(), ver = L && L.ver && L.ver();
    if (!s || !ver || !window.LiedExport) throw new Error(TT('Im Songwriting ist noch kein Song.'));
    if (typeof ensureAudio === 'function') ensureAudio();
    const sr = (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.sampleRate) || 48000;
    const a = await LiedExport.render(ver, id => AppDB.get('meta', 'lied-audio:' + id), sr);
    if (!a) throw new Error(TT('Der Song hat noch keine Aufnahmen.'));
    return { name: s.name + ' V' + ver.n, chs: a.R ? [a.L, a.R] : [a.L], sr: a.sr };
  }
  async function load(src) {
    stopPlay(); cur = null; paintVals(); prog(0); status(TT('Messe … ') + src.name);
    const secs = src.chs[0].length / src.sr;
    if (secs > 600) { prog(null); status(TT('Länger als 10 Minuten – das wird für das iPad zu groß.')); return; }
    try {
      const before = await measure(src.chs, src.sr);
      cur = Object.assign(src, { before, res: null }); $('msName').textContent = src.name + ' · ' + fmtTime(secs);
      prog(null); paintVals();
      const t = target(), d = t.I - before.I;
      status(!isFinite(before.I) ? TT('Die Quelle ist (fast) still.') : TT('Gemessen. ') + (Math.abs(d) < 0.3 ? TT('Liegt schon am Ziel.') : (d > 0 ? TT('Für das Ziel ') + fmt(d) + TT(' dB lauter') : TT('Für das Ziel ') + fmt(-d) + TT(' dB leiser'))) + TT(' – jetzt „Mastern“ tippen.'));
    } catch (e) { prog(null); status(TT('Messen fehlgeschlagen: ') + (e && e.message || e)); }
  }
  const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  async function run() {
    if (!cur) return; stopPlay();
    const t = target(), b = $('msRun'); b.disabled = true; prog(0); status(TT('Mastere … (bei langen Songs bis zu einer Minute)'));
    try {
      const t0 = performance.now(), r = await normalize(cur.chs, cur.sr, t.I, t.T, f => prog(f), cur.before);
      cur.res = r; cur.t = t; window.__msMs = Math.round(performance.now() - t0); prog(null); paintVals();
      const a = r.after, okI = Math.abs(a.I - t.I) <= 0.2, okT = a.TP <= t.T + 0.05;
      status((okI && okT ? TT('Fertig: ') : TT('Fertig (Ziel nicht ganz erreicht): ')) + fmt(a.I) + ' LUFS · ' + fmt(a.TP) + ' dBTP. ' + TT('Mit „Master“ / „Original“ vergleichen, dann „WAV speichern“.'));
      if (r.red < -6) hint(TT('Der Begrenzer musste stark arbeiten (') + fmt(r.red) + TT(' dB) – das kann den Klang flacher machen. Ein leiseres Ziel oder ein Mix mit weniger Spitzen klingt oft besser.'));
      else paintTarget();
    } catch (e) { prog(null); status(TT('Mastering fehlgeschlagen: ') + (e && e.message || e)); }
    b.disabled = !cur;
  }
  async function save() {
    if (!cur || !cur.res || !window.LiedExport) return;
    const o = cur.res.outs, t = cur.t || target(), name = String(cur.name).replace(/[\\/:*?"<>|]+/g, ' ').trim() + ' – Master ' + t.label.replace(/[−]/g, '-') + '.wav';
    const f = new File([LiedExport.wav24(o[0], o[1] || null, cur.sr)], name, { type: 'audio/wav' });
    window.__msLast = { name, size: f.size, report: reportText(cur.name, cur.res, t) };
    try {
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); status(TT('Gespeichert/geteilt: ') + name); return; }
    } catch (e) { if (e && e.name === 'AbortError') { status(TT('Abgebrochen.')); return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000); status(TT('Heruntergeladen: ') + name);
  }

  // ---------- A/B ----------
  const ab = () => (panel.querySelector('#msAB .active') || {}).dataset ? panel.querySelector('#msAB .active').dataset.ab : 'a';
  function gains() {
    const r = cur && cur.res, eq = $('msEq').checked && r && isFinite(r.after.I) && isFinite(cur.before.I) ? Math.pow(10, (cur.before.I - r.after.I) / 20) : 1;
    return ab() === 'b' && r ? [0, eq] : [1, 0];
  }
  function stopPlay() {
    if (!play) return; try { play.a.stop(); play.a.disconnect(); if (play.b) { play.b.stop(); play.b.disconnect(); } play.ga.disconnect(); play.gb.disconnect(); } catch (e) {}
    clearInterval(play.iv); play = null; $('msPlay').textContent = '▶';
  }
  function startPlay(off) {
    if (!cur) return; stopPlay();
    if (typeof Looper !== 'undefined' && Looper.stopAll) try { Looper.stopAll(); } catch (e) {}
    if (window.Lied && Lied.stop) try { Lied.stop(); } catch (e) {}
    if (typeof ensureAudio === 'function') ensureAudio();
    const ctx = audioCtx, mk = chs => { const b = ctx.createBuffer(2, chs[0].length, cur.sr); b.copyToChannel(chs[0], 0); b.copyToChannel(chs[1] || chs[0], 1); return b; };
    if (!cur.bufA) cur.bufA = mk(cur.chs);
    if (cur.res && !cur.bufB) cur.bufB = mk(cur.res.outs);
    const a = ctx.createBufferSource(), ga = ctx.createGain(), gb = ctx.createGain(); a.buffer = cur.bufA; a.connect(ga); ga.connect(ctx.destination);
    let b = null; if (cur.bufB) { b = ctx.createBufferSource(); b.buffer = cur.bufB; b.connect(gb); gb.connect(ctx.destination); }
    const [x, y] = gains(); ga.gain.value = x; gb.gain.value = y;
    const t0 = ctx.currentTime + 0.05, dur = cur.bufA.duration; off = Math.max(0, Math.min(dur - 0.1, off || 0));
    a.start(t0, off); if (b) b.start(t0, off);
    play = { a, b, ga, gb, t0, off, dur };
    play.iv = setInterval(() => { const p = off + ctx.currentTime - t0; if (p >= dur) { stopPlay(); $('msPos').value = 0; return; } $('msPos').value = Math.round(p / dur * 1000); }, 200);
    a.onended = () => { if (play && play.a === a) stopPlay(); };
    $('msPlay').textContent = '■';
  }
  function setAB() { if (!play) return; const [x, y] = gains(), t = audioCtx.currentTime; play.ga.gain.setTargetAtTime(x, t, 0.01); play.gb.gain.setTargetAtTime(y, t, 0.01); }

  // ---------- Bedienung ----------
  $('msTarget').addEventListener('change', e => { const s = lsGet() || {}; s.k = e.target.value; lsSet(s); paintTarget(); paintVals(); });
  ['msI', 'msT'].forEach(id => $(id).addEventListener('change', () => { const s = lsGet() || {}; s.k = 'own'; s.I = +$('msI').value; s.T = +$('msT').value; lsSet(s); paintTarget(); paintVals(); }));
  $('msLoad').addEventListener('click', async () => {
    if ($('msSrc').value === 'file') { $('msFile').value = ''; $('msFile').click(); return; }
    try { const s = await getSource(); if (s) await load(s); } catch (e) { status(e.message || String(e)); }
  });
  $('msFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    status(TT('Lese ') + f.name + ' …'); prog(0);
    try {
      if (typeof ensureAudio === 'function') ensureAudio();
      const buf = await audioCtx.decodeAudioData(await f.arrayBuffer()), chs = [];
      for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chs.push(new Float32Array(buf.getChannelData(c)));
      await load({ name: f.name.replace(/\.[a-z0-9]+$/i, ''), chs, sr: buf.sampleRate });
    } catch (err) { prog(null); status(TT('Die Datei ließ sich nicht lesen: ') + (err && err.message || err)); }
  });
  $('msRun').addEventListener('click', run);
  $('msSave').addEventListener('click', save);
  $('msPlay').addEventListener('click', () => { if (play) stopPlay(); else startPlay(($('msPos').value / 1000) * (cur ? cur.chs[0].length / cur.sr : 0)); });
  $('msAB').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; panel.querySelectorAll('#msAB button').forEach(x => x.classList.toggle('active', x === b)); setAB(); });
  $('msEq').addEventListener('change', setAB);
  $('msPos').addEventListener('change', () => { if (play) startPlay(($('msPos').value / 1000) * play.dur); });
  document.addEventListener('tabchange', e => { if (e.detail !== 'master') stopPlay(); else paintTarget(); });
  paintTarget(); paintVals();

  window.Master = { measure, normalize, target, reportText, TARGETS, cur: () => cur, load, run, startPlay, stopPlay, playing: () => !!play };
})();
