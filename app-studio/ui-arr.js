// ---------- Studio: Arrangement (Zeitleiste auf einer Leinwand) ----------
const Arr = (() => {
  const $ = id => document.getElementById(id);
  const cv = $('cv'), lanes = $('lanes'), headsIn = $('headsIn');
  const RH = 34;
  const V = { x0: 0, fpp: 400, y0: 0, th: 64, sel: null, selTrack: null, auto: false, autoP: 'vol' };
  const AR = { vol: [-48, 6, 0.5], pan: [-100, 100, 1] };   // Bereich und Raster je Automationsart
  const metas = new Map();
  let need = true;
  const P = () => Proj.P;
  const kick = () => { need = true; };
  function meta(id) { if (!metas.has(id)) { metas.set(id, null); SDB.meta(id).then(m => { metas.set(id, m); kick(); }); } return metas.get(id); }
  const fx = f => (f - V.x0) / V.fpp, xf = x => V.x0 + x * V.fpp;
  const tY = i => RH + i * V.th - V.y0;
  // ---------- Kopfzeilen der Spuren ----------
  const KIND = { audio: 'Audio', midi: 'Noten', drum: 'Drummer' };
  function heads() {
    const p = P(); if (!p) { headsIn.innerHTML = ''; return; }
    let h = '<div class="ruler-pad">' + p.tracks.length + ' Spuren</div>';
    p.tracks.forEach(t => {
      h += '<div class="th' + (V.selTrack === t.id ? ' sel' : '') + '" data-t="' + t.id + '" style="height:' + V.th + 'px"><div class="c" style="background:' + t.color + '"></div><div class="n"><b>' + esc(t.name) + '</b><small>' + KIND[t.kind] + (t.kind === 'midi' && t.inst && window.Inst ? ' · ' + esc(Inst.label(t.inst)) : '') + (t.kind === 'drum' ? ' · ' + esc(t.kit || '') : '') + '</small></div>' +
        '<div class="ms"><button class="m' + (t.mute ? ' on' : '') + '" data-a="mute" aria-label="Stumm">M</button><button class="s' + (t.solo ? ' on' : '') + '" data-a="solo" aria-label="Solo">S</button>' + (t.kind === 'audio' ? '<button class="r' + (t.arm ? ' on' : '') + '" data-a="arm" aria-label="Aufnahme scharf">R</button>' : '') + '</div></div>';
    });
    headsIn.innerHTML = h; headsIn.style.transform = 'translateY(' + (-V.y0) + 'px)';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  headsIn.addEventListener('click', e => {
    const th = e.target.closest('.th'); if (!th) return; const id = th.dataset.t, b = e.target.closest('button');
    if (b) { const a = b.dataset.a; Proj.editTrack(id, t => { t[a] = !t[a]; if (a === 'arm' && t.arm) Proj.P.tracks.forEach(o => { if (o !== t) o.arm = false; }); }, { noUndo: true }); Proj.P.tracks.forEach((_, i) => Engine.applyTrack(i, true)); heads(); return; }
    selectTrack(id);
  });
  headsIn.addEventListener('dblclick', e => { const th = e.target.closest('.th'); if (th) UI.renameTrack(th.dataset.t); });
  function selectTrack(id) { V.selTrack = id; heads(); UI.inspect(); kick(); }
  // ---------- Zeichnen ----------
  function draw() {
    const p = P(), dpr = window.devicePixelRatio || 1, w = lanes.clientWidth, h = lanes.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.fillStyle = '#141416'; c.fillRect(0, 0, w, h); if (!p) return;
    const bar = Proj.bar(), beat = Proj.spb(), pxBar = bar / V.fpp;
    const every = pxBar < 14 ? 8 : pxBar < 28 ? 4 : pxBar < 60 ? 2 : 1;
    // Spurhintergründe
    p.tracks.forEach((t, i) => { const y = tY(i); if (y > h || y + V.th < RH) return; c.fillStyle = V.selTrack === t.id ? '#1d1d23' : (i % 2 ? '#17171a' : '#151518'); c.fillRect(0, y, w, V.th); c.fillStyle = '#26262c'; c.fillRect(0, y + V.th - 1, w, 1); });
    // Raster
    const b0 = Math.floor(xf(0) / bar), b1 = Math.ceil(xf(w) / bar);
    for (let b = Math.max(0, b0); b <= b1; b++) {
      const x = Math.round(fx(b * bar)) + 0.5;
      if (b % every === 0) { c.fillStyle = '#2a2a31'; c.fillRect(x, RH, 1, h); }
      if (pxBar > 90) for (let k = 1; k < p.sig; k++) { const xb = Math.round(fx(b * bar + k * beat)) + 0.5; c.fillStyle = '#1f1f24'; c.fillRect(xb, RH, 1, h); }
    }
    // Cycle
    const cy = p.cycle; if (cy && cy.b > cy.a) { const a = fx(cy.a), e = fx(cy.b); c.fillStyle = cy.on ? 'rgba(242,194,48,.10)' : 'rgba(255,255,255,.04)'; c.fillRect(a, RH, e - a, h); }
    // Regionen
    p.regions.forEach(r => {
      const ti = Proj.tIndex(r.track); if (ti < 0) return; const t = p.tracks[ti], y = tY(ti) + 5, hh = V.th - 10;
      const x0 = fx(r.start), x1 = fx(r.start + r.len); if (x1 < 0 || x0 > w || y > h || y + hh < RH) return;
      const sel = V.sel === r.id;
      c.globalAlpha = r.muted ? 0.35 : 1;
      c.fillStyle = t.color; roundRect(c, x0, y, Math.max(2, x1 - x0), hh, 5); c.fill();
      c.save(); c.beginPath(); c.rect(Math.max(0, x0), y, Math.min(w, x1) - Math.max(0, x0), hh); c.clip();
      c.fillStyle = 'rgba(0,0,0,.72)'; c.font = '600 10px system-ui'; c.fillText(r.name || '', x0 + 6, y + 11);
      if (r.kind === 'audio') drawWave(c, r, x0, x1, y + 14, hh - 16, w);
      else if (r.kind === 'midi') drawNotes(c, r, x0, y + 14, hh - 16);
      else if (r.kind === 'drum') drawDrum(c, r, x0, x1, y + 14, hh - 16);
      // Blenden
      if (r.fi) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.moveTo(x0, y); c.lineTo(fx(r.start + r.fi), y); c.lineTo(x0, y + hh); c.fill(); }
      if (r.fo) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.moveTo(x1, y); c.lineTo(fx(r.start + r.len - r.fo), y); c.lineTo(x1, y + hh); c.fill(); }
      c.restore(); c.globalAlpha = 1;
      if (sel) { c.lineWidth = 2; c.strokeStyle = '#fff'; roundRect(c, x0 + 1, y + 1, Math.max(2, x1 - x0) - 2, hh - 2, 5); c.stroke();
        c.fillStyle = '#fff'; [[x0 + 7, y + 7], [x1 - 7, y + 7]].forEach(([a, b]) => { c.beginPath(); c.arc(a, b, 4, 0, 7); c.fill(); }); }
    });
    // Automation (ausgewählte Spur)
    if (V.auto && V.selTrack) { const ti = Proj.tIndex(V.selTrack); if (ti >= 0) drawAuto(c, p.tracks[ti], ti, w); }
    // Lineal
    c.fillStyle = '#18181c'; c.fillRect(0, 0, w, RH); c.fillStyle = '#34343b'; c.fillRect(0, RH - 1, w, 1);
    c.font = '11px ui-monospace,Menlo,monospace'; c.fillStyle = '#8f909a';
    for (let b = Math.max(0, b0); b <= b1; b++) if (b % every === 0) c.fillText(String(b + 1), fx(b * bar) + 3, 13);
    if (cy && cy.b > cy.a) { const a = fx(cy.a), e = fx(cy.b); c.fillStyle = cy.on ? 'rgba(242,194,48,.85)' : 'rgba(242,194,48,.3)'; c.fillRect(a, 20, e - a, 12); }
    (p.markers || []).forEach(m => { const x = fx(m.f); if (x < -100 || x > w) return; c.font = '600 10px system-ui'; const tw = c.measureText(m.name).width + 10; c.fillStyle = m.color || '#8ad94e'; roundRect(c, x, 18, tw, 14, 3); c.fill(); c.fillStyle = '#111'; c.fillText(m.name, x + 5, 29); });
    // Abspielposition
    const px = fx(Engine.curPos()); if (px >= 0 && px <= w) { c.fillStyle = '#fff'; c.fillRect(Math.round(px), 0, 2, h); }
    if (window.Rec && Rec.active()) { const a = fx(Rec.startPos()), e = px; c.fillStyle = 'rgba(255,93,93,.35)'; const ti = Proj.tIndex(Rec.track()); if (ti >= 0) c.fillRect(a, tY(ti) + 5, Math.max(0, e - a), V.th - 10); }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function drawWave(c, r, x0, x1, y, h, w) {
    const m = meta(r.audio); if (!m || !m.peaks) return; const pk = m.peaks, PK = m.pk, mid = y + h / 2, gg = Math.pow(10, (r.gain || 0) / 20);
    c.fillStyle = 'rgba(0,0,0,.55)';
    const a = Math.max(0, Math.floor(x0)), b = Math.min(w, Math.ceil(x1));
    for (let x = a; x < b; x++) {
      const f0 = r.offset + (xf(x) - r.start), f1 = f0 + V.fpp; let lo = 0, hi = 0;
      for (let k = Math.max(0, Math.floor(f0 / PK)); k <= Math.floor(f1 / PK) && k * 2 + 1 < pk.length; k++) { if (pk[k * 2] < lo) lo = pk[k * 2]; if (pk[k * 2 + 1] > hi) hi = pk[k * 2 + 1]; }
      const t = Math.max(1, (hi - lo) / 254 * h * gg); c.fillRect(x, mid - (hi / 127) * h / 2 * gg, 1, t);
    }
  }
  function drawNotes(c, r, x0, y, h) {
    const ns = r.notes || []; if (!ns.length) return; let lo = 127, hi = 0; ns.forEach(n => { lo = Math.min(lo, n.m); hi = Math.max(hi, n.m); });
    const span = Math.max(12, hi - lo + 1), spb = Proj.spb(); c.fillStyle = 'rgba(0,0,0,.6)';
    ns.forEach(n => { const x = fx(r.start + n.t * spb), xe = fx(r.start + (n.t + n.d) * spb), yy = y + h - ((n.m - lo + 0.5) / span) * h; c.fillRect(x, yy - 1.5, Math.max(2, xe - x - 1), 3); });
  }
  function drawDrum(c, r, x0, x1, y, h) {
    const spb = Proj.spb(), bar = Proj.bar(), s16 = spb / 4; c.fillStyle = 'rgba(0,0,0,.6)';
    if (!window.Drum || s16 / V.fpp < 1.2) { for (let f = 0, k = 0; f < r.len; f += spb / 2, k++) { const x = fx(r.start + f); if (x < -4 || x > x1) continue; c.fillRect(x, k % 4 === 0 ? y + h * 0.75 : k % 4 === 2 ? y + h * 0.4 : y + h * 0.1, 2, 2); } return; }
    const n = Math.max(1, Math.round(r.len / bar)), row = id => id === 'kick' ? 0.78 : /snare|rim|clap/.test(id) ? 0.48 : /^tom/.test(id) ? 0.62 : 0.15;
    for (let bi = 0; bi < n; bi++) { const xb = fx(r.start + bi * bar); if (xb > x1 || fx(r.start + (bi + 1) * bar) < 0) continue;
      Drum.barHits(r.drum || {}, bi + Math.round(r.barOff || 0), n + Math.round(r.barOff || 0), Proj.P.sig).forEach(q => { const x = fx(r.start + bi * bar + q.s * s16); if (x > x1) return; const sz = 1.5 + q.v * 2.5; c.fillRect(x, y + h * row(q.id) - sz / 2, sz, sz); }); }
  }
  function drawAuto(c, t, ti, w) {
    const k = V.autoP, [lo, hi] = AR[k], pts = (t.auto && t.auto[k]) || [], y = tY(ti), hh = V.th, vy = v => y + 4 + (1 - (v - lo) / (hi - lo)) * (hh - 8), cur = t[k] || 0;
    if (k === 'pan') { c.fillStyle = 'rgba(255,179,107,.25)'; c.fillRect(0, vy(0), w, 1); }
    c.strokeStyle = k === 'pan' ? '#7fd8ff' : '#ffb36b'; c.lineWidth = 2; c.beginPath();
    if (!pts.length) { c.moveTo(0, vy(cur)); c.lineTo(w, vy(cur)); }
    else { c.moveTo(0, vy(pts[0].v)); pts.forEach(q => c.lineTo(fx(q.f), vy(q.v))); c.lineTo(w, vy(pts[pts.length - 1].v)); }
    c.stroke(); c.fillStyle = k === 'pan' ? '#7fd8ff' : '#ffb36b'; pts.forEach(q => { c.beginPath(); c.arc(fx(q.f), vy(q.v), 5, 0, 7); c.fill(); });
    V.autoY = vy; V.autoT = ti;
  }
  // ---------- Bedienung ----------
  const ptrs = new Map(); let drag = null, lastTap = { t: 0, id: null };
  function hit(x, y) {
    const p = P(); if (!p) return null;
    if (y < RH) return { zone: y < 18 ? 'ruler' : 'cycle' };
    const ti = Math.floor((y - RH + V.y0) / V.th), t = p.tracks[ti]; if (!t) return { zone: 'empty' };
    const f = xf(x);
    if (V.auto && t.id === V.selTrack) return { zone: 'auto', t, ti, f };
    for (let i = p.regions.length - 1; i >= 0; i--) {
      const r = p.regions[i]; if (r.track !== t.id || f < r.start || f > r.start + r.len) continue;
      const x0 = fx(r.start), x1 = fx(r.start + r.len), yy = y - tY(ti);
      let part = 'body';
      if (yy < 16 && x - x0 < 16 && V.sel === r.id) part = 'fi'; else if (yy < 16 && x1 - x < 16 && V.sel === r.id) part = 'fo';
      else if (x - x0 < 10) part = 'l'; else if (x1 - x < 10) part = 'r';
      return { zone: 'region', r, t, ti, part, f };
    }
    return { zone: 'lane', t, ti, f };
  }
  lanes.addEventListener('pointerdown', e => {
    const rc = lanes.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    try { lanes.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.set(e.pointerId, { x, y });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { kind: 'pinch', d0: Math.abs(a.x - b.x) || 1, fpp0: V.fpp, fc: xf((a.x + b.x) / 2), cx: (a.x + b.x) / 2 }; return; }
    const h = hit(x, y); if (!h) return;
    const now = performance.now(), dbl = now - lastTap.t < 330 && lastTap.id === (h.r ? h.r.id : h.zone); lastTap = { t: now, id: h.r ? h.r.id : h.zone };
    if (h.zone === 'ruler') { drag = { kind: 'scrub', x }; Engine.seek(Math.max(0, Proj.snap(xf(x), 'beat'))); kick(); return; }
    if (h.zone === 'cycle') { const f = Proj.snap(xf(x), 'bar'), c = Proj.P.cycle; if (dbl || (c.b > c.a && f >= c.a && f <= c.b && !drag)) { drag = { kind: 'cyctap', x, f }; return; } drag = { kind: 'cycle', a: f, x }; return; }
    if (h.zone === 'auto') { autoDown(h, x, y, dbl); return; }
    if (h.zone === 'region') {
      V.sel = h.r.id; if (V.selTrack !== h.t.id) { V.selTrack = h.t.id; heads(); }
      UI.inspect(); kick();
      if (dbl && h.r.kind !== 'audio') { UI.show('roll'); return; }
      drag = { kind: 'reg', part: h.part, id: h.r.id, x, y, f: h.f, orig: JSON.parse(JSON.stringify(h.r)), ti: h.ti, moved: false };
      return;
    }
    if (h.zone === 'lane') { if (V.selTrack !== h.t.id) { V.selTrack = h.t.id; heads(); UI.inspect(); } V.sel = null; UI.inspect(); kick(); }
    drag = { kind: 'pan', x, y, x0: V.x0, y0: V.y0 };
  });
  lanes.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; const rc = lanes.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top; ptrs.set(e.pointerId, { x, y });
    if (!drag) return;
    if (drag.kind === 'pinch' && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.abs(a.x - b.x) || 1; V.fpp = clampF(drag.fpp0 * drag.d0 / d); V.x0 = Math.max(0, drag.fc - drag.cx * V.fpp); kick(); return; }
    if (drag.kind === 'pan') { V.x0 = Math.max(0, drag.x0 - (x - drag.x) * V.fpp); V.y0 = Math.max(0, Math.min(maxY(), drag.y0 - (y - drag.y))); headsIn.style.transform = 'translateY(' + (-V.y0) + 'px)'; kick(); return; }
    if (drag.kind === 'scrub') { Engine.seek(Math.max(0, Proj.snap(xf(x), 'beat'))); kick(); return; }
    if (drag.kind === 'cycle' || drag.kind === 'cyctap') { if (Math.abs(x - drag.x) < 6) return; const a = drag.kind === 'cycle' ? drag.a : Proj.snap(xf(drag.x), 'bar'), b = Proj.snap(xf(x), 'bar'); Proj.P.cycle = { on: true, a: Math.min(a, b), b: Math.max(a, b) }; drag.kind = 'cycle'; drag.a = a; Engine.setCycle(); UI.sync(); kick(); return; }
    if (drag.kind === 'auto') { autoMove(drag, x, y); return; }
    if (drag.kind === 'reg') regMove(drag, x, y);
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    if (drag && drag.kind === 'cyctap') { const c = Proj.P.cycle; c.on = !c.on; Engine.setCycle(); UI.sync(); Proj.save(); kick(); }
    if (drag && drag.kind === 'cycle') Proj.save();
    if (drag && drag.kind === 'reg' && drag.moved) { const r = Proj.reg(drag.id), fin = JSON.parse(JSON.stringify(r)); Object.assign(r, drag.orig); Proj.editRegion(drag.id, q => Object.assign(q, fin)); }
    if (drag && drag.kind === 'auto' && drag.moved) { Proj.save(); }
    if (!ptrs.size) drag = null; kick();
  };
  lanes.addEventListener('pointerup', up); lanes.addEventListener('pointercancel', up);
  lanes.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey) { const rc = lanes.getBoundingClientRect(), fc = xf(e.clientX - rc.left); V.fpp = clampF(V.fpp * Math.exp(e.deltaY / 200)); V.x0 = Math.max(0, fc - (e.clientX - rc.left) * V.fpp); } else { V.x0 = Math.max(0, V.x0 + (e.deltaX || (e.shiftKey ? e.deltaY : 0)) * V.fpp); V.y0 = Math.max(0, Math.min(maxY(), V.y0 + (e.shiftKey ? 0 : e.deltaY))); headsIn.style.transform = 'translateY(' + (-V.y0) + 'px)'; } kick(); }, { passive: false });
  const clampF = f => Math.max(20, Math.min(40000, f));
  const maxY = () => Math.max(0, RH + (P() ? P().tracks.length : 0) * V.th - lanes.clientHeight + 40);
  function regMove(d, x, y) {
    const r = Proj.reg(d.id); if (!r) return; const df = (x - d.x) * V.fpp, o = d.orig, g = UI.snapMode(), sn = f => g === 'off' ? Math.round(f) : Proj.snap(f, g);
    if (Math.abs(x - d.x) + Math.abs(y - d.y) > 4) d.moved = true; if (!d.moved) return;
    if (d.part === 'body') {
      r.start = Math.max(0, sn(o.start + df));
      const ti = Math.max(0, Math.min(P().tracks.length - 1, Math.floor((y - RH + V.y0) / V.th))), t = P().tracks[ti];
      if (t && t.kind === (o.kind === 'audio' ? 'audio' : o.kind === 'drum' ? 'drum' : 'midi')) r.track = t.id;
    } else if (d.part === 'l') {
      let ns = sn(o.start + df); ns = Math.max(o.kind === 'audio' ? o.start - o.offset : 0, Math.min(o.start + o.len - 256, ns));
      const dd = ns - o.start; r.start = ns; r.len = o.len - dd; if (o.kind === 'audio') r.offset = o.offset + dd;
      if (o.notes) { const db = dd / Proj.spb(); r.notes = o.notes.map(n => Object.assign({}, n, { t: n.t - db })).filter(n => n.t + n.d > 0); }
    } else if (d.part === 'r') {
      let ne = sn(o.start + o.len + df); const mx = o.kind === 'audio' && metas.get(o.audio) ? o.start + (metas.get(o.audio).frames - o.offset) : Infinity;
      ne = Math.max(o.start + 256, Math.min(mx, ne)); r.len = ne - o.start;
    } else if (d.part === 'fi') r.fi = Math.max(0, Math.min(r.len / 2, (o.fi || 0) + df));
    else if (d.part === 'fo') r.fo = Math.max(0, Math.min(r.len / 2, (o.fo || 0) - df));
    kick();
  }
  // Automation: Punkte setzen/ziehen, doppelt tippen = löschen
  function autoDown(h, x, y, dbl) {
    const t = h.t, k = V.autoP; if (!t.auto[k]) t.auto[k] = []; const pts = t.auto[k], vy = V.autoY; let best = -1, bd = 14;
    pts.forEach((q, i) => { const dd = Math.hypot(fx(q.f) - x, vy(q.v) - y); if (dd < bd) { bd = dd; best = i; } });
    if (best >= 0 && dbl) { Proj.editTrack(t.id, tt => tt.auto[k].splice(best, 1)); kick(); return; }
    if (best < 0) { const v = valY(h.ti, y); Proj.editTrack(t.id, tt => { tt.auto[k].push({ f: Math.max(0, Math.round(xf(x))), v }); tt.auto[k].sort((a, b) => a.f - b.f); }); best = Proj.P.tracks[h.ti].auto[k].findIndex(q => Math.abs(q.f - Math.round(xf(x))) < 2); }
    drag = { kind: 'auto', ti: h.ti, idx: best, moved: false };
  }
  function valY(ti, y) { const yy = tY(ti), hh = V.th, [lo, hi, st] = AR[V.autoP]; return Math.round(Math.max(lo, Math.min(hi, (1 - (y - yy - 4) / (hh - 8)) * (hi - lo) + lo)) / st) * st; }
  function autoMove(d, x, y) { const t = P().tracks[d.ti], a = t.auto[V.autoP], q = a[d.idx]; if (!q) return; d.moved = true; q.f = Math.max(0, Math.round(xf(x))); q.v = valY(d.ti, y); a.sort((m, n) => m.f - n.f); d.idx = a.indexOf(q); kick(); }
  // ---------- Werkzeuge ----------
  function zoom(k) { const w = lanes.clientWidth, fc = xf(w / 2); V.fpp = clampF(V.fpp * k); V.x0 = Math.max(0, fc - w / 2 * V.fpp); kick(); }
  let fitLater = false;
  function zoomAll() { if (lanes.clientWidth < 60) { fitLater = true; return; } fitLater = false; const e = Math.max(Proj.projEnd(), Proj.bar() * 8); V.fpp = clampF(e / (lanes.clientWidth - 30)); V.x0 = 0; kick(); }
  function follow() { if (!Engine.playing) return; const x = fx(Engine.curPos()), w = lanes.clientWidth; if (x > w * 0.85 || x < 0) { V.x0 = Math.max(0, Engine.curPos() - w * 0.15 * V.fpp); } }
  function loop() { if (fitLater && lanes.clientWidth >= 60) zoomAll(); follow(); if (need || Engine.playing || (window.Rec && Rec.active())) { need = false; draw(); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  window.addEventListener('resize', kick);
  Proj.on(() => { heads(); kick(); });
  return { V, draw, heads, kick, zoom, zoomAll, selectTrack, xf, fx, metas };
})();
