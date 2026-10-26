// ---------- Studio: Bedienung (Transport, Ansichten, Projekt, Fenster) ----------
const UI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let view = 'arr', closeFn = [];
  function say(t) { $('status').textContent = t + (window.__looperAck && !/✓/.test(t) ? ' · Looper angehalten ✓' : ''); }
  // ---- Fenster ----
  function dialog(html) { closeFn = []; $('dlg').innerHTML = html; $('modal').hidden = false; }
  function close() { $('modal').hidden = true; const f = closeFn; closeFn = []; f.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); $('dlg').innerHTML = ''; }
  $('modal').addEventListener('click', e => { if (e.target === $('modal') || e.target.closest('[data-close]')) close(); });
  function ask(title, val) { return new Promise(res => { dialog('<h2>' + esc(title) + '</h2><input type="text" id="askI" value="' + esc(val || '') + '"><div class="btns"><button class="btn" data-close>Abbrechen</button><button class="btn p" id="askOk">OK</button></div>'); const i = $('askI'); i.focus(); i.select(); let ok = false;
    const done = () => { ok = true; const v = i.value.trim(); close(); res(v || null); }; $('askOk').onclick = done; i.onkeydown = e => { if (e.key === 'Enter') done(); }; closeFn.push(() => { if (!ok) res(null); }); }); }
  function confirm2(text, yes) { return new Promise(res => { dialog('<h2>' + esc(text) + '</h2><div class="btns"><button class="btn" data-close>Abbrechen</button><button class="btn danger" id="cfOk">' + esc(yes || 'Löschen') + '</button></div>'); let ok = false; $('cfOk').onclick = () => { ok = true; close(); res(true); }; closeFn.push(() => { if (!ok) res(false); }); }); }
  // ---- Ansichten ----
  function show(v) {
    view = v; document.querySelectorAll('#views button').forEach(b => b.classList.toggle('a', b.dataset.v === v));
    ['arr', 'mix', 'roll', 'brw'].forEach(k => { $('v-' + k).hidden = k !== v; });
    if (v !== 'brw') Brw.stopPrev();
    if (v === 'arr') { Arr.heads(); Arr.kick(); }
    if (v === 'mix') Mix.render();
    if (v === 'brw') Brw.refresh();
    if (v === 'roll') { if (window.Roll) Roll.open(); else $('rTop').innerHTML = '<span class="note">Noten-Editor: kommt mit den Instrumenten.</span>'; }
    try { localStorage.setItem('3nps-studio-view', v); } catch (e) {}
  }
  $('views').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.v); });
  // ---- Transport ----
  const fmtPos = f => { const P = Proj.P; if (!P) return '1.1.1'; const spb = Proj.spb(), beats = f / spb, bar = Math.floor(beats / P.sig), bt = Math.floor(beats - bar * P.sig), s16 = Math.floor((beats - Math.floor(beats)) * 4); return (bar + 1) + '.' + (bt + 1) + '.' + (s16 + 1); };
  async function togglePlay() { if (window.Rec && Rec.active()) { await Rec.stop(); sync(); return; } if (Engine.playing) Engine.stop(); else { Brw.stopPrev(); await Engine.play(); } sync(); }
  $('bPlay').onclick = togglePlay;
  $('bHome').onclick = () => { Engine.seek(Engine.playing && Engine.curPos() > Proj.bar() / 2 ? 0 : 0); Arr.V.x0 = 0; Arr.kick(); sync(); };
  $('bCyc').onclick = () => { const P = Proj.P; if (!P) return; const c = P.cycle; if (!(c.b > c.a)) { const s = Arr.V.sel && Proj.reg(Arr.V.sel); if (s) { c.a = Proj.snap(s.start, 'bar'); c.b = Math.max(c.a + Proj.bar(), Proj.snap(s.start + s.len, 'bar')); } else { c.a = 0; c.b = Proj.bar() * 4; } c.on = true; } else c.on = !c.on; Engine.setCycle(); Proj.save(); sync(); Arr.kick(); };
  $('bClick').onclick = () => { Sched.click = !Sched.click; sync(); };
  $('bRec').onclick = async () => { if (!window.Rec) { say('Aufnahme ist noch nicht eingebaut.'); return; } try { if (Rec.active()) await Rec.stop(); else await Rec.start(); } catch (e) { say('Aufnahme: ' + e.message); } sync(); };
  $('lBpm').addEventListener('change', e => { const v = Math.max(40, Math.min(240, +e.target.value || 100)); setTempo(v); });
  async function setTempo(v) {
    const P = Proj.P; if (!P || Math.abs(v - P.bpm) < 0.001) { sync(); return; }
    const k = P.bpm / v, audio = P.regions.filter(r => r.kind === 'audio').length;
    // Zeiten in Bildern bleiben am Takt: alles strecken, Audio-Inhalt ändert sich nicht (dafür „Audio ans Tempo anpassen“)
    Proj.change('tempo', q => { q.bpm = Math.round(v * 100) / 100; q.regions.forEach(r => { r.start = Math.round(r.start * k); if (r.kind !== 'audio') r.len = Math.round(r.len * k); }); q.markers.forEach(m => { m.f = Math.round(m.f * k); }); q.cycle.a = Math.round(q.cycle.a * k); q.cycle.b = Math.round(q.cycle.b * k); q.tracks.forEach(t => { ['vol', 'pan'].forEach(a => (t.auto[a] || []).forEach(p => { p.f = Math.round(p.f * k); })); }); });
    Engine.dirty(true); sync(); Arr.kick();
    if (audio) say('Tempo ' + v + ' BPM. Audio-Regionen bleiben in ihrem Tempo – zum Angleichen: Region wählen → „ans Tempo anpassen“.');
  }
  // ---- Anzeige ----
  function sync() {
    const P = Proj.P;
    $('bPlay').classList.toggle('on', Engine.playing); $('bPlay').textContent = Engine.playing ? '■' : '▶';
    $('bRec').classList.toggle('on', !!(window.Rec && Rec.active()));
    $('bCyc').classList.toggle('on', !!(P && P.cycle.on && P.cycle.b > P.cycle.a)); $('bClick').classList.toggle('on', Sched.click);
    if (P) { if (document.activeElement !== $('lBpm')) $('lBpm').value = Math.round(P.bpm * 100) / 100; $('lSig').textContent = P.sig + '/4'; $('lKey').textContent = P.key || '–'; }
    $('tUndo').disabled = !Proj.canUndo(); $('tRedo').disabled = !Proj.canRedo();
    $('lPos').textContent = fmtPos(Engine.curPos()); $('bBack').title = P && P.fromIdea ? 'In die Idee zurückschreiben und im Looper weitermachen' : 'Zurück zum Looper';
    document.title = (P ? P.name + ' · ' : '') + 'Loopsmiths Studio';
  }
  Engine.on('tick', () => { $('lPos').textContent = fmtPos(Engine.curPos()); });
  (function lcd() { if (Engine.playing) $('lPos').textContent = fmtPos(Engine.curPos()); requestAnimationFrame(lcd); })();
  // Last (Hauptthread) und Speicher
  let busy = 0, lastF = performance.now();
  (function mon() { const n = performance.now(), d = n - lastF; lastF = n; busy = busy * 0.95 + (d > 34 ? 1 : 0) * 0.05; requestAnimationFrame(mon); })();
  setInterval(async () => {
    const pc = Math.round(busy * 100), el = $('cLoad'); el.textContent = pc < 3 ? 'ok' : pc + ' %'; el.className = pc > 25 ? 'bad' : pc > 10 ? 'warn' : '';
    try { const u = await SDB.usage(); const m = $('cMem'); m.textContent = Math.round(u / 1048576) + ' MB'; m.className = u > 3e9 ? 'warn' : ''; } catch (e) {}
  }, 2000);
  // ---- Pegel im Dock (alle Spuren + Master), nur sichtbar und beim Abspielen ----
  const mpk = []; let mm = 0, mfr = 0;
  (function meters() {
    requestAnimationFrame(meters); if (++mfr % 3) return;   // ~20 Bilder/s reichen für Pegel
    const cv = $('meterRow'); if (view !== 'arr' || !cv.offsetParent) return; const P = Proj.P; if (!P) return;
    if (!Engine.playing && !mpk.some(v => v > 0.002) && mm < 0.002 && cv.dataset.n == P.tracks.length) return;
    const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); cv.dataset.n = P.tracks.length;
    const n = P.tracks.length + 1, bw = Math.max(4, Math.min(22, (w - 4) / n - 3));
    for (let i = 0; i < n; i++) {
      const isM = i === n - 1, lv = isM ? Engine.masterLevel() : Engine.level(i);
      if (isM) mm = Math.max(mm * 0.86, lv); else mpk[i] = Math.max((mpk[i] || 0) * 0.86, lv);
      const v = isM ? mm : mpk[i], db = 20 * Math.log10(Math.max(1e-5, v)), y = Math.max(0, Math.min(1, (db + 54) / 54)), x = 2 + i * (bw + 3) + (isM ? 6 : 0);
      g.fillStyle = '#0c0c0e'; g.fillRect(x, 0, bw, h - 12); g.fillStyle = db > -1 ? '#ff5d5d' : db > -9 ? '#d6d23a' : '#3ad07a'; g.fillRect(x, (h - 12) * (1 - y), bw, (h - 12) * y);
      g.fillStyle = isM ? '#ececf1' : P.tracks[i].color; g.fillRect(x, h - 8, bw, 4);
    }
  })();
  // ---- Dock: Spur und Region ----
  const snapMode = () => $('tSnap').value;
  function inspect() {
    const P = Proj.P, t = P && Arr.V.selTrack && P.tracks[Proj.tIndex(Arr.V.selTrack)];
    if (!t) { $('dTrackH').textContent = 'Spur'; $('dTrackC').innerHTML = ''; $('dTrackN').textContent = P && P.tracks.length ? 'Spur links antippen zum Auswählen. Doppelt tippen = umbenennen.' : 'Noch leer: oben „Aus dem Looper“ wählen oder „+ Spur“.'; }
    else {
      $('dTrackH').textContent = 'Spur · ' + t.name;
      $('dTrackC').innerHTML = '<button class="btn" data-t="eq">EQ</button><button class="btn" data-t="fx">Effekte</button><button class="btn' + (Arr.V.auto && Arr.V.autoP === 'vol' ? ' on' : '') + '" data-t="auto">Automation Lautst.</button><button class="btn' + (Arr.V.auto && Arr.V.autoP === 'pan' ? ' on' : '') + '" data-t="autop">Automation Pan</button>' + (t.kind === 'audio' && window.Rec ? '<button class="btn" data-t="rec">Aufnahme …</button>' : '') + '<button class="btn" data-t="ren">Umbenennen</button><button class="btn" data-t="col">Farbe</button>' + (t.kind === 'midi' && window.Inst ? '<button class="btn" data-t="inst">Instrument</button>' : '') + (t.kind === 'drum' && window.Drum ? '<button class="btn" data-t="kit">Drummer</button>' : '') + '<button class="btn" data-t="up">↑</button><button class="btn" data-t="dn">↓</button><button class="btn danger" data-t="del">Spur löschen</button>';
      $('dTrackN').textContent = Arr.V.auto ? 'Automation ' + (Arr.V.autoP === 'pan' ? 'Panorama' : 'Lautstärke') + ': in die Spur tippen = Punkt setzen, ziehen = verschieben, doppelt tippen = löschen.' + ((t.auto[Arr.V.autoP] || []).length ? '' : ' Ohne Punkte gilt der Regler im Mischpult.') : (t.vol ? 'Lautstärke ' + (Math.round(t.vol * 10) / 10) + ' dB' : '') + (t.fx.comp.on ? ' · Kompressor' : '') + (t.fx.rev ? ' · Hall ' + t.fx.rev + ' %' : '');
    }
    const r = P && Arr.V.sel && Proj.reg(Arr.V.sel);
    if (!r) { $('dRegH').textContent = 'Region'; $('dRegC').innerHTML = ''; $('dRegN').textContent = 'Region antippen zum Auswählen · ziehen = verschieben · Ränder ziehen = kürzen · obere Ecken = Blende.'; return; }
    const bars = r.len / Proj.bar();
    $('dRegH').textContent = 'Region · ' + (r.name || '') + ' · ' + (Math.round(bars * 100) / 100).toString().replace('.', ',') + ' Takte';
    $('dRegC').innerHTML = '<button class="btn" data-r="g-">Leiser</button><button class="btn" data-r="g+">Lauter</button><button class="btn' + (r.muted ? ' on' : '') + '" data-r="mute">' + (r.muted ? 'Stumm ✓' : 'Stumm') + '</button><button class="btn" data-r="ren">Name</button>' +
      (r.kind === 'audio' ? '<button class="btn" data-r="fit">ans Tempo anpassen</button><button class="btn" data-r="norm">Normalisieren</button>' : '') + (r.kind !== 'audio' ? '<button class="btn" data-r="edit">Bearbeiten</button>' : '') + '<button class="btn" data-r="cyc">Als Cycle</button>';
    $('dRegN').textContent = 'Pegel ' + (r.gain > 0 ? '+' : '') + (r.gain || 0) + ' dB' + (r.fi ? ' · Einblende' : '') + (r.fo ? ' · Ausblende' : '') + ' · Start Takt ' + (Math.round((r.start / Proj.bar() + 1) * 100) / 100).toString().replace('.', ',');
  }
  $('dTrackC').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const id = Arr.V.selTrack, P = Proj.P, i = Proj.tIndex(id); if (i < 0) return; const t = P.tracks[i], a = b.dataset.t;
    if (a === 'eq') Mix.eqDlg(id);
    else if (a === 'fx') Mix.fxDlg(id);
    else if (a === 'auto' || a === 'autop') { const k = a === 'auto' ? 'vol' : 'pan'; Arr.V.auto = !(Arr.V.auto && Arr.V.autoP === k); Arr.V.autoP = k; inspect(); Arr.kick(); }
    else if (a === 'rec') Rec.settings();
    else if (a === 'ren') renameTrack(id);
    else if (a === 'col') { const k = (Proj.COLORS.indexOf(t.color) + 1) % Proj.COLORS.length; Proj.editTrack(id, x => { x.color = Proj.COLORS[k]; }); }
    else if (a === 'inst') Inst.choose(id);
    else if (a === 'kit') Drum.choose(id);
    else if (a === 'up' || a === 'dn') { const j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= P.tracks.length) return; Proj.change('tracks', p => { const [x] = p.tracks.splice(i, 1); p.tracks.splice(j, 0, x); }); Engine.dirty(true); }
    else if (a === 'del') { if (await confirm2('Spur „' + t.name + '“ mit allen Regionen löschen?')) { Proj.delTrack(id); Arr.V.selTrack = null; Arr.V.sel = null; inspect(); say('Spur gelöscht (↶ holt sie zurück).'); } }
    inspect();
  });
  $('dRegC').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const r = Proj.reg(Arr.V.sel); if (!r) return; const a = b.dataset.r;
    if (a === 'g-' || a === 'g+') Proj.editRegion(r.id, q => { q.gain = Math.round(((q.gain || 0) + (a === 'g+' ? 1 : -1)) * 10) / 10; });
    else if (a === 'mute') Proj.editRegion(r.id, q => { q.muted = !q.muted; });
    else if (a === 'ren') { const n = await ask('Name der Region', r.name); if (n) Proj.editRegion(r.id, q => { q.name = n; }); }
    else if (a === 'cyc') { Proj.P.cycle = { on: true, a: r.start, b: r.start + r.len }; Engine.setCycle(); Proj.save(); sync(); }
    else if (a === 'edit') show('roll');
    else if (a === 'norm') { say('Messe …'); const d = await SDB.read(r.audio, r.offset, r.len); let m = 0; for (let k = 0; k < d.l.length; k++) { const x = Math.max(Math.abs(d.l[k]), Math.abs(d.r[k])); if (x > m) m = x; } if (m > 0) { const g = Math.round(20 * Math.log10(0.89 / m) * 10) / 10; Proj.editRegion(r.id, q => { q.gain = g; }); say('Normalisiert: ' + (g > 0 ? '+' : '') + g + ' dB (Spitze −1 dB).'); } }
    else if (a === 'fit') await fitRegion(r);
    inspect(); Arr.kick();
  });
  // Audio-Region auf ganze Takte im Projekttempo bringen (Signalsmith im Hintergrund)
  async function fitRegion(r) {
    const bar = Proj.bar(), bars = r.len / bar, nb = Math.max(1, Math.round(bars * 4) / 4); let target = Math.round(nb * bar);
    const n = await ask('Wie viele Takte soll die Region im Projekttempo lang sein? (jetzt ' + (Math.round(bars * 100) / 100).toString().replace('.', ',') + ')', String(nb).replace('.', ','));
    if (!n) return; const want = +n.replace(',', '.'); if (!(want > 0)) return; target = Math.round(want * bar);
    if (Math.abs(target - r.len) < 32) { say('Passt schon.'); return; }
    say('Passe an … (' + Math.round(r.len / Engine.sr() * 10) / 10 + ' s Audio)');
    const d = await SDB.read(r.audio, r.offset, r.len), y = await Imp.stretch({ l: d.l, r: d.r }, target, Engine.sr());
    if (!y) { say('Anpassen hat nicht geklappt.'); return; }
    const m = await SDB.putAudio((r.name || 'Audio') + ' (angepasst)', Engine.sr(), y.l, y.r !== y.l ? y.r : null);
    Proj.editRegion(r.id, q => { q.audio = m.id; q.offset = 0; q.len = m.frames; q.fi = Math.min(q.fi || 0, m.frames / 2); q.fo = Math.min(q.fo || 0, m.frames / 2); });
    say('Angepasst auf ' + want + ' Takte.');
  }
  async function renameTrack(id) { const t = Proj.P.tracks[Proj.tIndex(id)]; if (!t) return; const n = await ask('Name der Spur', t.name); if (n) Proj.editTrack(id, x => { x.name = n; }); Arr.heads(); inspect(); }
  // ---- Werkzeugleiste ----
  $('tAdd').onclick = () => {
    if (Proj.P.tracks.length >= Engine.MAXT) { say('Höchstens ' + Engine.MAXT + ' Spuren.'); return; }
    dialog('<h2>Neue Spur</h2><div class="plist">' +
      '<div class="item" data-k="audio"><div class="ic">🎙</div><div style="flex:1"><b>Audio</b><small>Für Aufnahmen (Gesang, Gitarre …) oder Audio-Regionen.</small></div></div>' +
      (window.Inst ? '<div class="item" data-k="midi"><div class="ic">🎹</div><div style="flex:1"><b>Instrument (Noten)</b><small>Klavier, Streicher, Bläser, Synthesizer – Noten im Editor.</small></div></div>' : '') +
      (window.Drum ? '<div class="item" data-k="drum"><div class="ic">🥁</div><div style="flex:1"><b>Drummer</b><small>Echtes Schlagzeug, spielt von selbst – Stil und Lautstärke je Region.</small></div></div>' : '') +
      '</div><div class="btns"><button class="btn" data-close>Abbrechen</button></div>');
    $('dlg').querySelector('.plist').onclick = e => { const it = e.target.closest('.item'); if (!it) return; const k = it.dataset.k; close(); const t = Proj.addTrack(k, k === 'audio' ? null : k === 'midi' ? 'Instrument' : 'Drummer'); Arr.V.selTrack = t.id; if (k === 'drum' && window.Drum) Drum.addDefault(t.id); if (k === 'midi' && window.Inst) Inst.addDefault(t.id); inspect(); };
  };
  $('tZo').onclick = () => Arr.zoom(1.5); $('tZi').onclick = () => Arr.zoom(1 / 1.5); $('tZa').onclick = () => Arr.zoomAll();
  $('tTh0').onclick = () => Arr.setTh(Arr.V.th / 1.35); $('tTh1').onclick = () => Arr.setTh(Arr.V.th * 1.35);
  $('tLoop').onclick = () => { Arr.V.loopSel = !Arr.V.loopSel; $('tLoop').classList.toggle('on', Arr.V.loopSel); say(Arr.V.loopSel ? 'Takte loopen: über die Spuren ziehen (rastet auf ganze Takte). Nochmal tippen = aus. ⟲ oben schaltet den Loop an/aus.' : 'Normal bearbeiten.'); };
  try { $('tSnap').value = localStorage.getItem('3nps-studio-snap') || 'beat'; } catch (e) {}
  $('tSnap').onchange = () => { try { localStorage.setItem('3nps-studio-snap', $('tSnap').value); } catch (e) {} };
  $('tSplit').onclick = () => { const r = Arr.V.sel && Proj.reg(Arr.V.sel); if (!r) { say('Erst eine Region antippen, dann die Abspielposition auf die Schnittstelle setzen.'); return; } const at = Engine.curPos(); if (!Proj.split(r.id, at)) say('Die Abspielposition liegt nicht in der Region.'); };
  $('tDup').onclick = () => { const r = Arr.V.sel && Proj.reg(Arr.V.sel); if (!r) return say('Erst eine Region antippen.'); const c = Proj.duplicate(r.id); Arr.V.sel = c.id; inspect(); };
  $('tRep').onclick = () => { const r = Arr.V.sel && Proj.reg(Arr.V.sel); if (!r) return say('Erst eine Region antippen.'); Proj.repeat(r.id, 4); say('4× wiederholt.'); };
  $('tDel').onclick = () => { const r = Arr.V.sel && Proj.reg(Arr.V.sel); if (!r) return say('Erst eine Region antippen.'); Proj.delRegion(r.id); Arr.V.sel = null; inspect(); };
  $('tMk').onclick = async () => { const P = Proj.P, f = Proj.snap(Engine.curPos(), 'bar'), n = await ask('Name des Markers (Takt ' + (Math.round(f / Proj.bar()) + 1) + ')', ['Intro', 'Strophe', 'Refrain', 'Bridge', 'Solo', 'Outro'][Math.min(5, P.markers.length)]); if (!n) return; Proj.change('markers', p => { p.markers = p.markers.filter(m => Math.abs(m.f - f) > 10); p.markers.push({ f, name: n, color: '#8ad94e' }); p.markers.sort((a, b) => a.f - b.f); }); };
  $('tUndo').onclick = () => { if (Proj.undo()) { Engine.dirty(true); say('Rückgängig.'); } sync(); };
  $('tRedo').onclick = () => { if (Proj.redo()) { Engine.dirty(true); say('Wiederholt.'); } sync(); };
  // ---- Projekt-Menü ----
  $('bProj').onclick = projMenu;
  $('bBack').onclick = async () => {
    if (Engine.playing) Engine.stop(); if (window.Rec && Rec.active()) await Rec.stop();
    const b = $('bBack'); b.disabled = true;
    if (!Proj.P.fromIdea) { await Proj.save(); try { await Engine.ac().suspend(); } catch (e) {} location.href = '../'; return; }
    try { const it = await Exp.backToLooper(say); try { await Engine.ac().suspend(); } catch (e) {} setTimeout(() => { location.href = '../?load=' + encodeURIComponent(it.id); }, 300); }
    catch (e) {
      console.error(e); b.disabled = false; say('Zurück in den Looper: ' + e.message);
      dialog('<h2>Nicht gespeichert</h2><p>' + esc(e.message) + '</p><div class="btns">' + (e.muted ? '<button class="btn p" id="bkUnmute">Alle Spuren hörbar machen und speichern</button>' : '') + '<button class="btn" id="bkGo">Ohne Speichern zum Looper</button><button class="btn" data-close>Im Studio bleiben</button></div>');
      if ($('bkUnmute')) $('bkUnmute').onclick = () => { Proj.change('mix', p => p.tracks.forEach(t => { t.mute = false; t.solo = false; })); Proj.P.tracks.forEach((_, i) => Engine.applyTrack(i, true)); Arr.heads(); close(); $('bBack').click(); };
      $('bkGo').onclick = async () => { close(); await Proj.save(); location.href = '../'; };
    }
  };
  async function projMenu() {
    const P = Proj.P, ps = await Proj.list(), usage = await SDB.usage().catch(() => 0);
    dialog('<h2>Projekt</h2><div class="grid2"><div class="card"><b>' + esc(P.name) + '</b><div class="meta">' + P.tracks.length + ' Spuren · ' + P.regions.length + ' Regionen · ' + (Math.round(Proj.projEnd() / P.sr)) + ' s</div>' +
      '<div class="btns"><button class="btn" data-a="ren">Umbenennen</button><button class="btn" data-a="sig">Taktart</button><button class="btn" data-a="key">Tonart</button><button class="btn p" data-a="new">Neues Projekt</button></div></div>' +
      '<div class="card"><b>Exportieren</b><div class="btns"><button class="btn" data-x="mix">Mix (WAV)</button><button class="btn" data-x="mixm">Mix gemastert</button><button class="btn" data-x="stems">Alle Spuren einzeln (ZIP)</button><button class="btn" data-x="logic">Für Logic Pro (ZIP)</button>' + (window.Inst ? '<button class="btn" data-x="midi">MIDI</button>' : '') + '<button class="btn" data-x="looper">In den Looper</button></div>' +
      '<label class="row" style="margin-top:8px">Mastering-Ziel <select id="xTgt"><option value="stream">Streaming −14 LUFS</option><option value="apple">Apple Music −16 LUFS</option><option value="deezer">Deezer −15 LUFS</option><option value="loud">Laut −9 LUFS</option></select></label>' + '<label class="row" style="margin-top:8px"><input type="checkbox" id="xCyc"' + (P.cycle.on && P.cycle.b > P.cycle.a ? ' checked' : '') + '> nur den Cycle-Bereich</label><p class="note">„In den Looper“ legt den Cycle-Bereich (oder die gewählte Region) als neue Idee in die Ablage „Zusammenarbeit“.</p></div></div>' +
      '<h2 style="font-size:15px">Alle Projekte</h2><div class="plist">' + ps.map(p => '<div class="item' + (p.id === P.id ? ' a' : '') + '" data-p="' + p.id + '"><div><b>' + esc(p.name) + '</b><small>' + p.n + ' Spuren · ' + Math.round(p.bpm) + ' BPM · ' + new Date(p.ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) + '</small></div><div class="row">' + (p.id === P.id ? '<span class="note">offen</span>' : '<button class="btn" data-o="' + p.id + '">Öffnen</button>') + '<button class="btn danger" data-d="' + p.id + '">Löschen</button></div></div>').join('') + '</div>' +
      '<p class="note">Studio-Speicher auf diesem Gerät: ' + Math.round(usage / 1048576) + ' MB. Audio, das in keinem Projekt mehr vorkommt, wird beim Löschen eines Projekts freigegeben.</p>' +
      '<div class="btns"><a class="btn" href="../" style="text-decoration:none">← Zurück zum Looper</a><span style="flex:1"></span><button class="btn p" data-close>Schließen</button></div>');
    try { const tg = JSON.parse(localStorage.getItem('3nps-master-target') || 'null') || {}; if (tg.k && tg.k !== 'own') $('xTgt').value = tg.k; } catch (e) {}
    $('xTgt').onchange = e => { try { const tg = JSON.parse(localStorage.getItem('3nps-master-target') || 'null') || {}; tg.k = e.target.value; localStorage.setItem('3nps-master-target', JSON.stringify(tg)); } catch (x) {} };
    $('dlg').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'ren') { const n = await ask('Name des Projekts', P.name); if (n) Proj.change('name', p => { p.name = n; }); sync(); return; }
      if (b.dataset.a === 'new') { const n = await ask('Name des neuen Projekts', 'Neues Projekt'); if (!n) return; if (Engine.playing) Engine.stop(); await Proj.newProject(n); Arr.V.sel = Arr.V.selTrack = null; Arr.zoomAll(); inspect(); sync(); show('brw'); return; }
      if (b.dataset.a === 'sig') { const n = await ask('Schläge pro Takt (z. B. 4, 3 oder 6)', String(P.sig)); const v = Math.round(+n); if (v >= 2 && v <= 12) { Proj.change('tempo', p => { p.sig = v; }); sync(); Arr.kick(); } return; }
      if (b.dataset.a === 'key') { const n = await ask('Tonart (z. B. „A Moll“ oder „G Dur“)', P.key); if (n) { Proj.change('tempo', p => { p.key = n; }); sync(); } return; }
      if (b.dataset.o) { close(); if (Engine.playing) Engine.stop(); await Proj.load(b.dataset.o); Arr.V.sel = Arr.V.selTrack = null; Arr.zoomAll(); inspect(); sync(); say('Geöffnet: ' + Proj.P.name); return; }
      if (b.dataset.d) { const p = ps.find(x => x.id === b.dataset.d); if (!(await confirm2('Projekt „' + p.name + '“ endgültig löschen?'))) return projMenu(); const cur = p.id === P.id; await Proj.remove(p.id); if (cur) { const rest = await Proj.list(); if (rest.length) await Proj.load(rest[0].id); else await Proj.newProject('Neues Projekt'); Arr.zoomAll(); inspect(); sync(); } return projMenu(); }
      if (b.dataset.x) { const k = b.dataset.x, cyc = $('xCyc') && $('xCyc').checked; close(); if (Engine.playing) Engine.stop();
        try { if (k === 'looper') await Exp.toLooper(say); else await Exp.run(k === 'mixm' ? 'mix' : k, { cycle: cyc, master: k === 'mixm' }, say); } catch (err) { console.error(err); say('Export: ' + err.message); } }
    };
  }
  // ---- Tastatur (iPad mit Tastatur) ----
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,select,textarea') || !$('modal').hidden) { if (e.key === 'Escape' && !$('modal').hidden) close(); return; }
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('tRedo') : $('tUndo')).click(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { if (Arr.V.sel) $('tDel').click(); }
    else if (e.key === 'Enter') $('bHome').click();
    else if (e.key.toLowerCase() === 'c' && !e.metaKey) $('bCyc').click();
    else if (e.key.toLowerCase() === 'r' && !e.metaKey) $('bRec').click();
    else if (e.key.toLowerCase() === 'k' && !e.metaKey) $('bClick').click();
    else if (e.key === '1') show('arr'); else if (e.key === '2') show('mix'); else if (e.key === '3') show('roll'); else if (e.key === '4') show('brw');
  });
  Proj.on(w => { sync(); if (view === 'mix' && w !== 'mix') Mix.render(); if (w === 'all' || w === 'regions' || w === 'tracks') inspect(); });
  // Speicher schonen: im Hintergrund anhalten und sichern
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (window.Rec && Rec.active()) return; Proj.save(); } });
  // ---- Start ----
  async function start() {
    try { await SDB.open(); } catch (e) { say('Speicher nicht verfügbar: ' + e.message); return; }
    const q = new URLSearchParams(location.search), idea = q.get('idea');
    let last = null; try { last = localStorage.getItem('3nps-studio-last'); } catch (e) {}
    if (!(last && await Proj.load(last))) { const ps = await Proj.list(); if (ps.length) await Proj.load(ps[0].id); else await Proj.newProject('Mein erstes Projekt'); }
    Arr.heads(); Arr.zoomAll(); inspect(); sync();
    let v = 'arr'; try { v = localStorage.getItem('3nps-studio-view') || 'arr'; } catch (e) {}
    if (idea && q.get('from') === 'looper') {
      // v107: direkt von der Looper-Spur – passendes Projekt öffnen (unverändert seit dem letzten Zurückschreiben) oder neu übernehmen
      history.replaceState(null, '', location.pathname);
      const it = await SDB.looperGet('ideas', idea), ps = (await SDB.all('projects')).filter(p => p.fromIdea === idea).sort((x, y) => y.ts - x.ts);
      if (it && ps.length && ps[0].importTs && ps[0].importTs >= it.ts) { await Proj.load(ps[0].id); const P = Proj.P, used = P.tracks.filter(t => P.regions.some(r => r.track === t.id)); if (used.length && used.every(t => t.mute)) { Proj.change('mix', p => p.tracks.forEach(t => { t.mute = false; })); Engine.dirty(true); } say('Projekt „' + Proj.P.name + '“ geöffnet. „↩ Looper“ bringt es zurück.'); }
      else if (it) {
        try { await Imp.idea(idea, { mode: 'new', bar: 1, reps: 1, fit: false }, say); Proj.change('meta', p => { p.fromIdea = idea; p.importTs = it.ts; }, { noUndo: true }); await Proj.save(); say('„' + it.name + '“ aus dem Looper. Bearbeiten, dann „↩ Looper“.'); }
        catch (e) { say('Übernahme fehlgeschlagen: ' + e.message); }
      }
      Arr.V.sel = Arr.V.selTrack = null; Arr.heads(); Arr.zoomAll(); inspect(); sync(); show('arr'); return;
    }
    if (idea) { Brw.preselect(idea); v = 'brw'; history.replaceState(null, '', location.pathname); }
    else if (!Proj.P.tracks.length) v = 'brw';
    show(v);
    say(idea ? 'Aus dem Looper: wähle, ob es ins offene Projekt oder in ein neues kommt.' : 'Projekt „' + Proj.P.name + '“ geöffnet.');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  return { show, sync, inspect, renameTrack, snapMode, say, dialog, close, onClose: f => closeFn.push(f), ask, confirm: confirm2, start, setTempo, get view() { return view; } };
})();
UI.start();
