// ---------- Studio: Noten-Editor (Piano-Roll), Drummer-Bedienfeld, Akkorde → Bass/Flächen ----------
const Roll = (() => {
  const $ = id => document.getElementById(id), cv = $('rcv'), box = $('roll'), top = $('rTop'), dock = $('rDock');
  const KW = 52, NH = 14, NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], BLACK = [1, 3, 6, 8, 10];
  const S = { rid: null, ppb: 90, x0: 0, y0: 0, grid: 0.25, len: 0.25, sel: new Set(), vel: 96, step: false, cur: 0 };
  try { S.grid = +localStorage.getItem('3nps-studio-rgrid') || 0.25; } catch (e) {}
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reg = () => S.rid && Proj.reg(S.rid);
  const beats = r => r.len / Proj.spb();
  const bx = b => KW + (b - S.x0) * S.ppb, xb = x => (x - KW) / S.ppb + S.x0;
  const my = m => (127 - m) * NH - S.y0, ym = y => 127 - Math.floor((y + S.y0) / NH);
  const nm = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
  let need = true; const kick = () => { need = true; };
  // ---------- öffnen ----------
  function open() {
    const P = Proj.P; let r = Arr.V.sel && Proj.reg(Arr.V.sel);
    if (!r || r.kind === 'audio') { const t = P.tracks[Proj.tIndex(Arr.V.selTrack)]; r = t && P.regions.find(q => q.track === t.id && q.kind !== 'audio'); }
    S.rid = r ? r.id : null; S.sel.clear();
    if (!r) {
      const t = P.tracks[Proj.tIndex(Arr.V.selTrack)];
      top.innerHTML = '<span class="note">' + (t && t.kind === 'midi' ? 'Diese Spur hat noch keine Noten-Region.' : t && t.kind === 'drum' ? 'Diese Spur hat noch keine Drummer-Region.' : 'Wähle im Arrangement eine Noten- oder Drummer-Region (oder lege mit „+ Spur“ ein Instrument an).') + '</span>' +
        (t && t.kind === 'midi' ? '<button class="btn p" id="rNewR">Noten-Region ab Abspielposition</button>' : t && t.kind === 'drum' ? '<button class="btn p" id="rNewD">Drummer-Region ab Abspielposition</button>' : '');
      if ($('rNewR')) $('rNewR').onclick = () => { Inst.addDefault(t.id); open(); };
      if ($('rNewD')) $('rNewD').onclick = () => { Drum.addDefault(t.id); open(); };
      box.hidden = true; chordDock(); return;
    }
    if (r.kind === 'drum') { box.hidden = true; top.innerHTML = ''; Drum.editor(top, r); chordDock(); return; }
    box.hidden = false; toolbar(); chordDock();
    // auf die Noten scrollen
    const ns = r.notes || []; let mid = 60; if (ns.length) mid = Math.round(ns.reduce((s, n) => s + n.m, 0) / ns.length);
    requestAnimationFrame(() => { S.y0 = Math.max(0, (127 - mid) * NH - box.clientHeight / 2); S.x0 = 0; S.ppb = Math.max(24, Math.min(160, (box.clientWidth - KW - 20) / Math.max(4, beats(r)))); kick(); });
  }
  const GRIDS = [[1, '1/4'], [0.5, '1/8'], [1 / 3, '1/8 T'], [0.25, '1/16'], [0.125, '1/32']];
  function toolbar() {
    const r = reg(), t = Proj.P.tracks[Proj.tIndex(r.track)];
    top.innerHTML = '<b style="font-size:13px">' + esc(t.name) + ' · ' + esc(r.name || 'Noten') + '</b><span class="note">' + (window.Inst ? esc(Inst.label(t.inst)) : '') + '</span>' +
      '<label class="row">Raster <select id="rGrid">' + GRIDS.map(([v, n]) => '<option value="' + v + '"' + (Math.abs(v - S.grid) < 1e-6 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<button class="btn" id="rQ">Quantisieren</button><button class="btn" id="rTm">−12</button><button class="btn" id="rT1">−1</button><button class="btn" id="rT2">+1</button><button class="btn" id="rTp">+12</button>' +
      '<button class="btn" id="rAll">Alle</button><button class="btn" id="rDel">Löschen</button>' +
      '<label class="row">Anschlag <input type="range" id="rVel" min="1" max="127" value="' + S.vel + '" style="width:110px"><b id="rVo">' + S.vel + '</b></label>' +
      '<button class="btn' + (S.step ? ' on' : '') + '" id="rStep" title="Tasten links tippen = Note an der Cursor-Position eintragen">Schritt-Eingabe</button><button class="btn" id="rInst">Instrument</button>';
    $('rGrid').onchange = e => { S.grid = +e.target.value; S.len = S.grid; try { localStorage.setItem('3nps-studio-rgrid', S.grid); } catch (x) {} kick(); };
    $('rQ').onclick = () => edit(r => { (r.notes || []).forEach(n => { if (S.sel.size && !S.sel.has(n)) return; n.t = Math.max(0, Math.round(n.t / S.grid) * S.grid); }); }, 'Quantisiert.');
    [['rTm', -12], ['rT1', -1], ['rT2', 1], ['rTp', 12]].forEach(([id, d]) => { $(id).onclick = () => edit(r => { (r.notes || []).forEach((n, i) => { if (S.sel.size && !S.selIdx.has(i)) return; n.m = Math.max(0, Math.min(127, n.m + d)); }); }); });
    $('rAll').onclick = () => { const r = reg(); S.sel = new Set(r.notes || []); syncSel(); kick(); };
    $('rDel').onclick = () => { if (!S.sel.size) return UI.say('Erst Noten antippen (oder „Alle“).'); edit(r => { const idx = S.selIdx; r.notes = r.notes.filter((n, i) => !idx.has(i)); }); S.sel.clear(); };
    $('rVel').oninput = e => { S.vel = +e.target.value; $('rVo').textContent = S.vel; const r = reg(); if (S.sel.size) { (r.notes || []).forEach(n => { if (S.sel.has(n)) n.v = S.vel; }); kick(); } };
    $('rVel').onchange = () => { if (S.sel.size) edit(() => {}); };
    $('rStep').onclick = () => { S.step = !S.step; $('rStep').classList.toggle('on', S.step); UI.say(S.step ? 'Schritt-Eingabe: Tasten links tippen trägt Noten ein (Länge = Raster).' : 'Schritt-Eingabe aus.'); };
    $('rInst').onclick = () => Inst.choose(r.track);
  }
  // Auswahl über Index halten (Rückgängig ersetzt die Objekte)
  function syncSel() { const r = reg(); S.selIdx = new Set(); (r && r.notes || []).forEach((n, i) => { if (S.sel.has(n)) S.selIdx.add(i); }); }
  function edit(fn, msg) {
    const r = reg(); if (!r) return; syncSel(); const keep = S.selIdx;
    Proj.editRegion(r.id, q => { q.notes = q.notes || []; fn(q); q.notes.sort((a, b) => a.t - b.t || a.m - b.m); });
    const r2 = reg(); S.sel = new Set((r2.notes || []).filter((n, i) => keep.has(i))); if (msg) UI.say(msg); kick();
  }
  // ---------- zeichnen ----------
  function draw() {
    const r = reg(), dpr = devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight; if (!w || box.hidden) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#141416'; c.fillRect(0, 0, w, h); if (!r) return;
    const P = Proj.P, nb = beats(r), t = P.tracks[Proj.tIndex(r.track)];
    const m0 = Math.max(0, ym(h)), m1 = Math.min(127, ym(0));
    for (let m = m0; m <= m1; m++) { const y = my(m); c.fillStyle = BLACK.includes(m % 12) ? '#18181c' : '#1c1c21'; c.fillRect(KW, y, w - KW, NH); if (m % 12 === 0) { c.fillStyle = '#2c2c34'; c.fillRect(KW, y + NH - 1, w - KW, 1); } }
    // Raster
    for (let b = Math.floor(S.x0 / S.grid) * S.grid; bx(b) < w; b += S.grid) { const x = Math.round(bx(b)) + 0.5; if (x < KW) continue; const isBar = Math.abs(b / P.sig - Math.round(b / P.sig)) < 1e-6, isBeat = Math.abs(b - Math.round(b)) < 1e-6; c.fillStyle = isBar ? '#3a3a44' : isBeat ? '#2a2a31' : '#1f1f25'; c.fillRect(x, 0, 1, h); }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(bx(nb), 0, w, h);   // hinter dem Regionsende
    // Akkorde des Projekts als Band
    (P.chords || []).forEach(ch => { const rb = r.start / Proj.spb(), a = bx(ch.b - rb), e = bx(ch.b - rb + ch.beats); if (e < KW || a > w) return; c.fillStyle = 'rgba(138,217,78,.12)'; c.fillRect(Math.max(KW, a), 0, e - a - 1, 14); c.fillStyle = '#8ad94e'; c.font = '600 10px system-ui'; c.fillText(ch.name, Math.max(KW, a) + 3, 11); });
    // Noten
    (r.notes || []).forEach(n => { const x = bx(n.t), xe = bx(n.t + n.d), y = my(n.m); if (xe < KW || x > w || y + NH < 0 || y > h) return; const sel = S.sel.has(n);
      c.globalAlpha = 0.45 + 0.55 * (n.v || 96) / 127; c.fillStyle = sel ? '#fff' : t.color; c.fillRect(Math.max(KW, x) + 0.5, y + 1, Math.max(3, xe - Math.max(KW, x) - 1), NH - 2); c.globalAlpha = 1;
      if (xe - x > 26 && NH >= 12) { c.fillStyle = 'rgba(0,0,0,.7)'; c.font = '9px system-ui'; c.fillText(nm(n.m), Math.max(KW, x) + 3, y + NH - 4); } });
    // Abspielposition / Cursor
    const pb = (Engine.curPos() - r.start) / Proj.spb(); if (pb >= 0 && pb <= nb) { c.fillStyle = '#fff'; c.fillRect(bx(pb), 0, 2, h); }
    if (S.step) { c.fillStyle = '#ffb36b'; c.fillRect(bx(S.cur), 0, 2, h); }
    // Tastatur
    for (let m = m0; m <= m1; m++) { const y = my(m), bl = BLACK.includes(m % 12); c.fillStyle = bl ? '#26262c' : '#d8d8de'; c.fillRect(0, y, KW, NH - 1); if (m % 12 === 0) { c.fillStyle = '#555'; c.font = '9px system-ui'; c.fillText(nm(m), 4, y + NH - 3); } }
    c.fillStyle = '#34343b'; c.fillRect(KW, 0, 1, h);
  }
  // ---------- bedienen ----------
  const ptrs = new Map(); let drag = null, lastTap = { t: 0, n: null };
  function hitNote(x, y) { const r = reg(); if (!r) return null; const b = xb(x), m = ym(y); const ns = r.notes || []; for (let i = ns.length - 1; i >= 0; i--) { const n = ns[i]; if (n.m === m && b >= n.t && b <= n.t + n.d) return { n, edge: bx(n.t + n.d) - x < 9 }; } return null; }
  box.addEventListener('pointerdown', e => {
    const r = reg(); if (!r) return; const rc = box.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top; try { box.setPointerCapture(e.pointerId); } catch (x2) {}
    ptrs.set(e.pointerId, { x, y }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { kind: 'pinch', d0: Math.abs(a.x - b.x) || 1, p0: S.ppb, bc: xb((a.x + b.x) / 2), cx: (a.x + b.x) / 2 }; return; }
    if (x < KW) { const m = ym(y); Inst.preview(r.track, m, S.vel); if (S.step) { edit(q => { q.notes.push({ t: S.cur, d: S.grid, m, v: S.vel }); }); S.cur += S.grid; } drag = { kind: 'keys', m }; return; }
    const h = hitNote(x, y), now = performance.now();
    if (h) {
      if (now - lastTap.t < 330 && lastTap.n === h.n) { const i = r.notes.indexOf(h.n); edit(q => { q.notes.splice(i, 1); }); S.sel.clear(); lastTap = { t: 0 }; return; }
      lastTap = { t: now, n: h.n };
      if (!S.sel.has(h.n)) { S.sel = new Set([h.n]); } S.vel = h.n.v || 96; if ($('rVel')) { $('rVel').value = S.vel; $('rVo').textContent = S.vel; }
      Inst.preview(r.track, h.n.m, h.n.v); syncSel();
      drag = { kind: h.edge ? 'len' : 'move', x, y, b0: xb(x), m0: ym(y), orig: [...S.sel].map(n => ({ n, t: n.t, m: n.m, d: n.d })), moved: false }; kick(); return;
    }
    drag = { kind: 'empty', x, y, x0: S.x0, y0: S.y0, moved: false };
  });
  box.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !drag) return; const rc = box.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top; ptrs.set(e.pointerId, { x, y });
    if (drag.kind === 'pinch' && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.abs(a.x - b.x) || 1; S.ppb = Math.max(12, Math.min(400, drag.p0 * d / drag.d0)); S.x0 = Math.max(0, drag.bc - (drag.cx - KW) / S.ppb); kick(); return; }
    if (drag.kind === 'keys') { const m = ym(y); if (m !== drag.m) { drag.m = m; Inst.preview(reg().track, m, S.vel); } return; }
    if (Math.abs(x - drag.x) + Math.abs(y - drag.y) > 5) drag.moved = true; if (!drag.moved) return;
    if (drag.kind === 'empty') { S.x0 = Math.max(0, drag.x0 - (x - drag.x) / S.ppb); S.y0 = Math.max(0, Math.min(128 * NH - box.clientHeight, drag.y0 - (y - drag.y))); kick(); return; }
    const db = Math.round((xb(x) - drag.b0) / S.grid) * S.grid, dm = ym(y) - drag.m0;
    if (drag.kind === 'move') drag.orig.forEach(o => { o.n.t = Math.max(0, o.t + db); o.n.m = Math.max(0, Math.min(127, o.m + dm)); });
    else drag.orig.forEach(o => { o.n.d = Math.max(S.grid / 2, o.d + db); S.len = o.n.d; });
    if (drag.kind === 'move' && dm !== drag.lastDm) { drag.lastDm = dm; Inst.preview(reg().track, drag.orig[0].n.m, S.vel); }
    kick();
  });
  const up = e => {
    ptrs.delete(e.pointerId); const d = drag; if (ptrs.size) return; drag = null; if (!d) return; const r = reg(); if (!r) return;
    if ((d.kind === 'move' || d.kind === 'len') && d.moved) { const fin = d.orig.map(o => ({ t: o.n.t, m: o.n.m, d: o.n.d })); d.orig.forEach(o => { o.n.t = o.t; o.n.m = o.m; o.n.d = o.d; }); syncSel(); const idx = [...S.selIdx]; edit(q => { idx.forEach((i, k) => Object.assign(q.notes[i], fin[k] || {})); }); }
    if (d.kind === 'empty' && !d.moved) {
      const rc = box.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top, b = Math.floor(xb(x) / S.grid) * S.grid, m = ym(y);
      if (S.sel.size) { S.sel.clear(); kick(); return; }
      if (b < 0 || b >= beats(r)) return; edit(q => { q.notes.push({ t: b, d: S.len || S.grid, m, v: S.vel }); }); S.cur = b + (S.len || S.grid); Inst.preview(r.track, m, S.vel);
    }
    kick();
  };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey) { S.ppb = Math.max(12, Math.min(400, S.ppb * Math.exp(-e.deltaY / 200))); } else { S.x0 = Math.max(0, S.x0 + (e.deltaX || (e.shiftKey ? e.deltaY : 0)) / S.ppb); if (!e.shiftKey) S.y0 = Math.max(0, Math.min(128 * NH - box.clientHeight, S.y0 + e.deltaY)); } kick(); }, { passive: false });
  // ---------- Akkorde → Bass / Flächen / Arpeggio ----------
  const QUAL = [[/^(maj7|M7|Δ)/, [0, 4, 7, 11]], [/^(m7|min7|-7)/, [0, 3, 7, 10]], [/^(m7b5|ø)/, [0, 3, 6, 10]], [/^dim/, [0, 3, 6]], [/^aug|^\+/, [0, 4, 8]], [/^sus2/, [0, 2, 7]], [/^sus4?/, [0, 5, 7]], [/^7/, [0, 4, 7, 10]], [/^(m|min|-)/, [0, 3, 7]], [/^/, [0, 4, 7]]];
  function parseChord(s) { const m = String(s).trim().match(/^([A-Ha-h])(#|b|♯|♭)?(.*)$/); if (!m) return null; let r = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 }[m[1].toUpperCase()]; if (m[2] === '#' || m[2] === '♯') r++; if (m[2] === 'b' || m[2] === '♭') r--; r = (r + 12) % 12; const q = QUAL.find(([re]) => re.test(m[3]))[1]; return { r, iv: q, name: s.trim() }; }
  function progFromProject() { const P = Proj.P; if (!P.chords || !P.chords.length) return ''; let out = [], bar = P.sig; P.chords.forEach(c => { out.push(c.name + (Math.abs(c.beats - bar) > 0.01 ? ':' + (c.beats / bar).toString().replace('.', ',') : '')); }); return out.join(' '); }
  function chordDock() {
    const P = Proj.P, fromSong = !!(P.chords && P.chords.length);
    let saved = ''; try { saved = localStorage.getItem('3nps-studio-prog') || ''; } catch (e) {}
    dock.innerHTML = '<b style="font-size:12px;color:var(--mut)">AKKORDE →</b><input type="text" id="cProg" style="flex:1;min-width:220px" placeholder="z. B. Am F C G (je 1 Takt; „C:2“ = 2 Takte)" value="' + esc(fromSong ? progFromProject() : saved) + '">' +
      '<label class="row">ab Takt <input type="number" id="cBar" min="1" value="' + (fromSong ? Math.round(P.chords[0].b / P.sig) + 1 : Math.max(1, Math.round(Engine.curPos() / Proj.bar()) + 1)) + '" style="width:60px"></label>' +
      '<label class="row">Bass <select id="cBass"><option value="whole">Grundton lang</option><option value="eighth">Achtel</option><option value="rq" selected>Grundton–Quinte</option><option value="walk">Laufend</option></select></label>' +
      '<button class="btn" id="cMkB">Bass erzeugen</button><button class="btn" id="cMkP">Flächen erzeugen</button><button class="btn" id="cMkA">Arpeggio erzeugen</button>' + (fromSong ? '<span class="note">Akkorde aus dem Song übernommen.</span>' : '');
    $('cMkB').onclick = () => gen('bass'); $('cMkP').onclick = () => gen('pad'); $('cMkA').onclick = () => gen('arp');
  }
  function gen(kind) {
    const P = Proj.P, txt = $('cProg').value.trim(); if (!txt) return UI.say('Erst Akkorde eintragen, z. B. „Am F C G“.');
    try { localStorage.setItem('3nps-studio-prog', txt); } catch (e) {}
    const seq = []; let bad = [];
    txt.split(/[\s|,]+/).filter(Boolean).forEach(tok => { const [c, l] = tok.split(':'); const ch = parseChord(c); if (!ch) { bad.push(c); return; } seq.push({ ch, bars: l ? +l.replace(',', '.') || 1 : 1 }); });
    if (bad.length) return UI.say('Nicht erkannt: ' + bad.join(', '));
    if (P.tracks.length >= Engine.MAXT) return UI.say('Höchstens ' + Engine.MAXT + ' Spuren.');
    const sig = P.sig, notes = []; let b = 0;
    const style = $('cBass').value;
    seq.forEach(({ ch, bars }, i) => {
      const L = bars * sig, root = 36 + ch.r - (ch.r > 7 ? 12 : 0), next = seq[(i + 1) % seq.length].ch;
      if (kind === 'bass') {
        if (style === 'whole') notes.push({ t: b, d: L - 0.05, m: root, v: 100 });
        else if (style === 'eighth') for (let k = 0; k < L * 2; k++) notes.push({ t: b + k / 2, d: 0.45, m: root, v: k % 2 ? 82 : 100 });
        else if (style === 'rq') for (let k = 0; k < L; k++) notes.push({ t: b + k, d: 0.9, m: k % 2 ? root + 7 : root, v: k % sig ? 86 : 104 });
        else { const tgt = 36 + next.r - (next.r > 7 ? 12 : 0); for (let k = 0; k < L; k++) { const last = k === L - 1, m = k === 0 ? root : last ? tgt + (tgt > root ? -1 : 1) : root + [0, ch.iv[1], 7, ch.iv[1]][k % 4]; notes.push({ t: b + k, d: 0.9, m, v: k ? 88 : 104 }); } }
      } else if (kind === 'pad') { const base = 60 + ch.r - (ch.r > 5 ? 12 : 0); ch.iv.forEach(iv => notes.push({ t: b, d: L - 0.05, m: base + iv, v: 80 })); notes.push({ t: b, d: L - 0.05, m: base - 12, v: 70 }); }
      else { const base = 60 + ch.r - (ch.r > 5 ? 12 : 0), tones = ch.iv.concat([12]); for (let k = 0; k < L * 2; k++) notes.push({ t: b + k / 2, d: 0.48, m: base + tones[[0, 1, 2, 3, 2, 1][k % 6] % tones.length], v: k % 2 ? 76 : 92 }); }
      b += L;
    });
    const at = Math.round((Math.max(1, +$('cBar').value || 1) - 1) * Proj.bar()), name = kind === 'bass' ? 'Bass' : kind === 'pad' ? 'Flächen' : 'Arpeggio';
    let tid; Proj.change('tracks', p => { const t = Proj.track('midi', name + ' (aus Akkorden)'); t.inst = kind === 'bass' ? 'kbass' : kind === 'pad' ? 'strings' : 'harp'; if (kind === 'pad') t.vol = -6; tid = t.id; p.tracks.push(t); p.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'midi', start: at, len: Math.round(b * Proj.spb()), notes, name: txt.slice(0, 40) }); });
    Engine.dirty(true); Inst.load(kind === 'bass' ? 'kbass' : kind === 'pad' ? 'strings' : 'harp'); Arr.V.selTrack = tid; Arr.V.sel = Proj.P.regions[Proj.P.regions.length - 1].id; Arr.heads(); open();
    UI.say(name + ' erzeugt: ' + notes.length + ' Noten über ' + Math.round(b / sig) + ' Takte (Instrument änderbar).');
  }
  (function loop() { if (!$('v-roll').hidden && (need || Engine.playing)) { need = false; draw(); } requestAnimationFrame(loop); })();
  window.addEventListener('resize', kick);
  Proj.on(w => { if (!$('v-roll').hidden && w !== 'mix') { if (S.rid && !Proj.reg(S.rid)) open(); kick(); } });
  return { open, kick, parseChord, S, gen };
})();
window.Roll = Roll;
