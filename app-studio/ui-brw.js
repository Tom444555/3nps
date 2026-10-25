// ---------- Studio: „Aus dem Looper“ (Ideen, Loops, Backing Tracks, Zusammenarbeit, Mitsingen, Songs) ----------
const Brw = (() => {
  const $ = id => document.getElementById(id);
  const F = [['all', 'Alle'], ['idee', 'Ideen'], ['loop', 'Loops'], ['backing', 'Backing Tracks'], ['team', 'Zusammenarbeit'], ['lied', 'Mitsingen'], ['song', 'Songs']];
  const ICON = { idee: '💡', loop: '🔁', backing: '🎸', team: '🤝', lied: '🎤', song: '📝' };
  const NAME = { idee: 'Idee', loop: 'Loop', backing: 'Backing Track', team: 'Zusammenarbeit', lied: 'Mitsingen', song: 'Song' };
  let filt = 'all', list = [], cur = null, want = null, prevSrc = null, prevBuf = null;
  try { filt = localStorage.getItem('3nps-studio-filt') || 'all'; } catch (e) {}
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const date = ts => ts ? new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  function seg() { $('bFilt').innerHTML = F.map(([k, n]) => '<button data-f="' + k + '"' + (k === filt ? ' class="a"' : '') + '>' + n + '</button>').join(''); }
  $('bFilt').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; filt = b.dataset.f; try { localStorage.setItem('3nps-studio-filt', filt); } catch (x) {} seg(); render(); });
  async function refresh() {
    seg(); $('bList').innerHTML = '<p class="empty">Lese den Looper …</p>';
    try { list = await Imp.sources(); } catch (e) { list = []; $('bList').innerHTML = '<p class="empty">Looper-Speicher nicht lesbar: ' + esc(e.message) + '</p>'; return; }
    render();
    if (want) { const it = list.find(x => x.id === want); want = null; if (it) select(it); }
  }
  function render() {
    const L = list.filter(x => filt === 'all' || x.cat === filt);
    if (!L.length) { $('bList').innerHTML = '<p class="empty">' + (list.length ? 'In dieser Ablage ist noch nichts.' : 'Im Looper ist noch nichts gespeichert. Speichere dort eine Idee („Idee speichern“) – sie erscheint dann hier.') + '</p>'; return; }
    $('bList').innerHTML = L.map(x => '<div class="item' + (cur && cur.id === x.id ? ' a' : '') + '" data-id="' + esc(x.id) + '"><div class="ic">' + (ICON[x.cat] || '💡') + '</div><div style="flex:1;min-width:0"><b>' + esc(x.name) + '</b>' +
      '<small>' + [NAME[x.cat], x.bpm ? Math.round(x.bpm * 10) / 10 + ' BPM' : '', x.secs ? mmss(x.secs) : '', x.n ? x.n + ' Spur' + (x.n === 1 ? '' : 'en') : '', x.parts ? x.parts + ' Teile' : '', date(x.ts)].filter(Boolean).join(' · ') + '</small></div></div>').join('');
  }
  $('bList').addEventListener('click', e => { const it = e.target.closest('.item'); if (!it) return; const x = list.find(q => q.id === it.dataset.id); if (x) select(x); });
  async function select(x) {
    stopPrev(); cur = x; render();
    const P = Proj.P, hasP = P && (P.tracks.length || P.regions.length), nextBar = P ? Math.max(1, Math.ceil(Proj.projEnd() / Proj.bar()) + 1) : 1;
    const fit = x.bpm && P && hasP && Math.abs(P.bpm - x.bpm) > 0.05;
    $('bPrev').innerHTML = '<div class="card"><h2>' + esc(x.name) + '</h2><div class="meta">' + [NAME[x.cat], x.bpm ? Math.round(x.bpm * 100) / 100 + ' BPM' : '', x.key && x.key.trim() ? esc(x.key) : '', x.secs ? mmss(x.secs) : '', x.drums ? 'mit Drums' : '', date(x.ts)].filter(Boolean).join(' · ') + '</div>' +
      '<div id="bTr"><p class="note">Lade Vorschau …</p></div>' +
      '<div class="btns"><button class="btn" id="bPl">▶ Anhören</button></div></div>' +
      '<div class="card"><h2 style="font-size:15px">Übernehmen</h2>' +
      '<div class="btns"><label class="row">ab Takt <input type="number" id="bBar" min="1" value="' + (hasP ? nextBar : 1) + '" style="width:70px"></label>' +
      (x.src === 'idea' ? '<label class="row">Wiederholen <select id="bReps">' + [1, 2, 4, 8].map(n => '<option' + (n === (x.cat === 'loop' || x.cat === 'backing' ? 4 : 1) ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' : '') +
      (x.src === 'idea' && x.bpm ? '<label class="row"><input type="checkbox" id="bFit"' + (fit ? ' checked' : '') + '> ins Projekttempo bringen' + (fit ? ' (' + Math.round(x.bpm * 10) / 10 + ' → ' + Math.round(P.bpm * 10) / 10 + ' BPM)' : '') + '</label>' : '') + '</div>' +
      '<div class="btns">' + (hasP ? '<button class="btn p" id="bInto">Ins Projekt „' + esc(P.name) + '“</button>' : '') + '<button class="btn' + (hasP ? '' : ' p') + '" id="bNew">Als neues Projekt</button></div>' +
      '<p class="note">Die Spuren werden in den Studio-Speicher kopiert. Im Looper bleibt alles, wie es ist.' + (x.src === 'song' ? ' Vom Song kommen die Aufnahmen, der Ablauf (als Marker), die Akkorde und der Text.' : '') + '</p></div>';
    $('bPl').onclick = () => prevSrc ? stopPrev() : playPrev(x);
    $('bNew').onclick = () => take(x, 'new');
    if ($('bInto')) $('bInto').onclick = () => take(x, 'into');
    try { await drawTracks(x); } catch (e) { $('bTr').innerHTML = '<p class="note">Keine Vorschau: ' + esc(e.message) + '</p>'; }
  }
  // Wellenformen je Spur (aus den Looper-Daten, nur zum Ansehen)
  async function drawTracks(x) {
    const box = $('bTr'); prevBuf = null;
    if (x.src === 'song') { box.innerHTML = '<p class="note">' + (x.parts || 0) + ' Teile · Tonart ' + esc(x.key) + ' · Version ' + (x.vn || 1) + '</p>'; return; }
    const it = await SDB.looperGet('ideas', x.id); if (!it || cur !== x) return;
    const chans = [];
    if (it.session) it.session.tracks.forEach((t, i) => { if (t) chans.push({ name: 'Spur ' + (i + 1), d: Imp.trackData(t), sr: it.session.sr }); });
    else if (it.wav) { const b = await Engine.ac().decodeAudioData(await it.wav.arrayBuffer()); chans.push({ name: x.cat === 'lied' ? 'Aufnahme' : 'Audio', d: { l: b.getChannelData(0), r: b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0) }, sr: b.sampleRate }); }
    if (cur !== x) return;
    box.innerHTML = chans.map((c, i) => '<div class="trk"><span>' + esc(c.name) + '</span><canvas data-i="' + i + '"></canvas></div>').join('') + (it.drumState ? '<p class="note">+ Drums aus dem Looper (' + esc(it.drumState.name || 'Rhythmus') + ')' + (window.Drum ? ' – werden als Drummer-Spur übernommen.' : '') + '</p>' : '');
    const col = ['#e4f2ff', '#2de2ff', '#86a8ff', '#ffd27a', '#c26bff', '#8ad94e'];
    box.querySelectorAll('canvas').forEach((cv, i) => {
      const c = chans[i], dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr;
      const g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#101014'; g.fillRect(0, 0, w, h); g.fillStyle = col[i % col.length];
      const a = c.d.l, n = a.length, st = n / w;
      for (let px = 0; px < w; px++) { let m = 0; for (let k = Math.floor(px * st), e = Math.floor((px + 1) * st); k < e; k += 8) { const v = Math.abs(a[k]); if (v > m) m = v; } const hh = Math.max(1, m * h * 0.9); g.fillRect(px, (h - hh) / 2, 1, hh); }
    });
    // Vorschau-Mischung (alle Spuren zusammen)
    if (chans.length) { const sr = chans[0].sr, n = Math.max(...chans.map(c => c.d.l.length)), b = Engine.ac().createBuffer(2, n, sr), L = b.getChannelData(0), R = b.getChannelData(1), k = 1 / Math.sqrt(chans.length);
      chans.forEach(c => { for (let j = 0; j < c.d.l.length; j++) { L[j] += c.d.l[j] * k; R[j] += c.d.r[j] * k; } }); prevBuf = b; }
  }
  async function playPrev(x) {
    if (!prevBuf) { UI.say('Für ' + (x.src === 'song' ? 'Songs' : 'diesen Eintrag') + ' gibt es keine Hörprobe.'); return; }
    if (Engine.playing) Engine.stop();
    const ac = Engine.ac(); await ac.resume(); const s = ac.createBufferSource(); s.buffer = prevBuf; s.loop = x.cat !== 'lied'; s.connect(ac.destination); s.start(); prevSrc = s;
    s.onended = () => { if (prevSrc === s) { prevSrc = null; if ($('bPl')) $('bPl').textContent = '▶ Anhören'; } };
    $('bPl').textContent = '■ Stopp';
  }
  function stopPrev() { if (prevSrc) { try { prevSrc.stop(); } catch (e) {} prevSrc = null; } if ($('bPl')) $('bPl').textContent = '▶ Anhören'; }
  async function take(x, mode) {
    stopPrev(); if (Engine.playing) Engine.stop();
    const opts = { mode, bar: Math.max(1, +($('bBar') && $('bBar').value) || 1), reps: +($('bReps') ? $('bReps').value : 1), fit: $('bFit') ? $('bFit').checked : false };
    if (mode === 'new') opts.bar = 1;
    if (mode === 'new' && x.src === 'idea') opts.fit = false;
    const btns = $('bPrev').querySelectorAll('button'); btns.forEach(b => b.disabled = true);
    try {
      if (Proj.P && mode === 'into' && x.src === 'idea') { const it = list.find(q => q.id === x.id); if (it && it.n && Proj.P.tracks.length + it.n > Engine.MAXT) throw new Error('Mehr als ' + Engine.MAXT + ' Spuren gehen nicht. Erst Spuren löschen oder ein neues Projekt nehmen.'); }
      await (x.src === 'song' ? Imp.song : x.src === 'lied' ? Imp.lied : Imp.idea)(x.id, opts, UI.say);
      if (x.src === 'idea' && mode === 'new') { const it = await SDB.looperGet('ideas', x.id); Proj.change('meta', p => { p.fromIdea = x.id; p.importTs = it ? it.ts : Date.now(); }, { noUndo: true }); await Proj.save(); }
      Arr.heads(); Arr.zoomAll(); UI.show('arr'); UI.sync();
    } catch (e) { console.error(e); UI.say('Übernahme fehlgeschlagen: ' + e.message); }
    finally { btns.forEach(b => b.disabled = false); }
  }
  return { refresh, stopPrev, preselect: id => { want = id; }, get list() { return list; } };
})();
