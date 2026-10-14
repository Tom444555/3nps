// ---- Mitsingen (v61): Gesangstext mit genauem Timing ----
// Zeiten stehen in Schlägen (nicht Sekunden), damit sie bei Tempoänderungen synchron bleiben:
//  - geladene Datei im Looper: Schlag-Index der Originaldatei (orig.beats), unabhängig vom geloopten Ausschnitt
//  - Song (Songwriting): Schlag im Teil, je Teil und Durchgang
// Speicher: localStorage 3nps-sing (neu; die stabile v24 kennt ihn nicht)
//   { v: 1, f: { <dateischlüssel>: { name, tok: [{ w, b, l }] } }, l: { <song|teil|durchgang>: { tok: [...] } } }
//   w = Wort, b = Schlag (null = noch ohne Zeit), l = Zeile
const Sing = (() => {
  const $ = id => document.getElementById(id);
  const KEY = '3nps-sing';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let db = load(), ui = { open: false, tapping: false, sel: -1, lineFrom: -1, snap: true, inline: false, dragging: false, ripple: (() => { try { return localStorage.getItem('3nps-sing-ripple') !== '0'; } catch (e) { return true; } })() };
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.v === 1) { d.f = d.f || {}; d.l = d.l || {}; return d; } } catch (e) {}
    return { v: 1, f: {}, l: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  // ---- Text → Wörter (Akkord-Marken [Am] fallen weg) ----
  function tokenize(text) {
    const out = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach(line => {
      const clean = line.replace(/\[[^\]]*\]/g, ' ').trim(); if (!clean) return;
      const l = out.length ? out[out.length - 1].l + 1 : 0;
      clean.split(/\s+/).forEach(w => { if (w) out.push({ w, b: null, l }); });
    });
    return out;
  }
  // neue Wörter übernehmen, vorhandene Zeiten behalten (gleiches Wort in der Nähe)
  function merge(oldT, newT) {
    const used = new Set();
    newT.forEach((t, i) => {
      for (let d = 0; d <= 3; d++) for (const j of [i + d, i - d]) {
        const o = oldT[j]; if (!o || used.has(j) || o.w !== t.w) continue;
        t.b = o.b; if (o.k) t.k = 1; if (o.a != null) t.a = o.a; used.add(j); return;
      }
    });
    return newT;
  }

  // ---- Schlag ↔ Bild (Datei) ----
  function f2b(f, B) {
    const n = B.length; if (n < 2) return null;
    if (f <= B[0]) return (f - B[0]) / (B[1] - B[0]);
    if (f >= B[n - 1]) return n - 1 + (f - B[n - 1]) / (B[n - 1] - B[n - 2]);
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m] <= f) lo = m; else hi = m; }
    return lo + (f - B[lo]) / (B[lo + 1] - B[lo]);
  }
  function b2f(b, B) {
    const n = B.length; if (n < 2) return null;
    if (b <= 0) return B[0] + b * (B[1] - B[0]);
    if (b >= n - 1) return B[n - 1] + (b - n + 1) * (B[n - 1] - B[n - 2]);
    const i = Math.floor(b); return B[i] + (b - i) * (B[i + 1] - B[i]);
  }


  // ---- v75: Raster nach dem Tempo oben ----
  const gridCache = {};
  // gleichmäßiges Raster: Schlag-Index 0 = erster erkannter Schlag (Indizes der gespeicherten Wörter bleiben vergleichbar),
  // Takt 1 = erste erkannte Eins, Abstand aus dem eingestellten Tempo
  function synGrid(g, s) {
    const k = s.key + '|' + g.bpm + '|' + g.anchor + '|' + g.b0, c = gridCache[k]; if (c) return c;
    const per = s.sr * 60 / g.bpm, n = Math.ceil(((s.len || s.beats[s.beats.length - 1]) - g.b0) / per) + 8, beats = [], downs = [];
    for (let i = 0; i < n; i++) beats.push(g.b0 + i * per);
    const off = Math.round((g.anchor - g.b0) / per); for (let i = off % 4; i < n; i += 4) downs.push(g.b0 + i * per);
    return (gridCache[k] = { beats, downs });
  }
  // Tempo oben geändert (von Hand): Raster der laufenden Songdatei danach richten – Wörter behalten ihre Zeit im Lied
  function onTempo() {
    const src = lastSrc; if (!src || src.kind !== 'file' || typeof Looper === 'undefined' || !Looper.singSrc) return;
    const s = Looper.singSrc(src.track); if (!s || s.key !== src.id) return;
    const v = parseFloat(($('bpm') || {}).value); if (!(v > 20)) return;
    let rec = db.f[s.key]; if (!rec) { rec = db.f[s.key] = { name: s.name, tok: [] }; }
    const oldB = rec.grid ? synGrid(rec.grid, s).beats : s.beats;
    const det = s.bpm || 0, same = det && Math.abs(v - det) < 0.05;
    if (same && !rec.grid) return;
    const ng = same ? null : { bpm: v, anchor: s.downs[0] || s.beats[0], b0: s.beats[0] };
    const newB = ng ? synGrid(ng, s).beats : s.beats;
    const conv = b => b == null ? b : Math.round(f2b(b2f(b, oldB), newB) * 1000) / 1000;
    rec.tok.forEach(t => { t.b = conv(t.b); if (t.a != null) t.a = conv(t.a); });
    if (ng) rec.grid = ng; else delete rec.grid;
    const E = envs[s.key]; if (E && E.ready) E.onB = E.on.map(x => f2b(x * E.sr, newB));
    changed(); focusSig = '*'; laneSig = '';
    status(ng ? T('Raster jetzt ') + v + T(' BPM (Tempo oben) – Wörter bleiben an ihrer Stelle im Lied.') : T('Wieder das erkannte Raster.'));
  }
  // v77: Datei wurde (mit anderem Tempo) neu gerastert – Wortzeiten über die Zeit im Lied umrechnen, Tempo merken
  document.addEventListener('origbeats', e => {
    const d = e.detail || {}, rec = db.f[d.key]; if (!rec && !d.forced) return;
    const r = rec || (db.f[d.key] = { name: String(d.key).split('|')[0], tok: [] });
    const oldB = d.oldBeats ? (r.grid && d.oldBeats ? synGrid(r.grid, { key: d.key, sr: d.sr, beats: d.oldBeats, len: 0 }).beats : d.oldBeats) : null;
    const same = oldB && oldB.length === d.newBeats.length && oldB.every((v, i) => Math.abs(v - d.newBeats[i]) < 2);
    if (oldB && !same) { const conv = b => b == null ? b : Math.round(f2b(b2f(b, oldB), d.newBeats) * 1000) / 1000; r.tok.forEach(t => { t.b = conv(t.b); if (t.a != null) t.a = conv(t.a); }); }
    if (oldB) delete r.grid;
    if (d.forced) r.force = d.forced; else delete r.force;
    delete envs[d.key]; changed();
  });
  function resetGrid() { const src = lastSrc; if (!src || src.kind !== 'file') return; const s = Looper.singSrc(src.track); if (!s || !s.bpm) return; const el = $('bpm'); el.value = s.bpm; el.dispatchEvent(new Event('input', { bubbles: true })); onTempo(); }
  setTimeout(() => {
    const el = $('bpm'); if (!el) return; let t = null;
    const user = () => { clearTimeout(t); t = setTimeout(onTempo, 400); };
    el.addEventListener('input', e => { if (e.isTrusted) user(); });
    document.addEventListener('bpmuser', user);
  }, 0);
  // ---- Aktuelle Quelle (passend zur Akkordleiste der Improvisation) ----
  // Liefert: { kind, id, title, tok, editable, toCi(b) → Bild in ci, fromCi(f) → Schlag, nowB, label(b) }
  function source(ci) {
    if (!ci) return null;
    if (ci.lied && window.Lied && Lied.singNow) {
      const n = Lied.singNow(); if (!n) return null;
      const id = n.song + '|' + n.part.id + '|' + n.pass;
      const fresh = tokenize(n.text), rec = db.l[id];
      let tok = rec ? rec.tok : [];
      if (!rec || rec.txt !== n.text) { tok = merge(rec ? rec.tok : [], fresh); db.l[id] = { tok, txt: n.text }; save(); }
      return { kind: 'lied', id, rec: db.l[id], title: n.part.name + (n.pass ? ' · ' + (n.pass + 1) + '. Mal' : ''), tok, editable: !!n.editable, partId: n.part.id, pass: n.pass, text: n.text,
        toCi: b => b * 1000, fromCi: f => f / 1000, nowB: n.beat, label: b => (Math.floor(b / 4) + 1) + '.' + (Math.floor(b % 4) + 1), maxB: n.beats, beatMs: () => 60000 / (n.bpm || 100) };
    }
    if (ci.track >= 0 && typeof Looper !== 'undefined' && Looper.singSrc) {
      const s = Looper.singSrc(ci.track); if (!s) return { kind: 'none', why: 'stretch' };
      const rec = db.f[s.key] || null;
      // v75: eigenes Raster nach dem Tempo oben (gleichmäßig ab Takt 1), sonst das erkannte
      if (rec && rec.grid) { const g = synGrid(rec.grid, s); s.beats = g.beats; s.downs = g.downs; }
      const toCi = b => { const f = b2f(b, s.beats); return f == null ? null : f - s.origPos; };
      const fromCi = f => f2b(f + s.origPos, s.beats);
      const label = b => { const f = b2f(b, s.beats), D = s.downs; let i = 0; while (i + 1 < D.length && D[i + 1] <= f + 2) i++; const bb = f2b(D[i] || 0, s.beats); return (i + 1) + '.' + (Math.floor(b - bb + 1e-6) + 1); };
      return { kind: 'file', id: s.key, rec, name: s.name, title: 'Datei „' + s.name + '“', tok: rec ? rec.tok : [], editable: true, toCi, fromCi,
        nowB: s.pos != null ? fromCi(s.pos) : null, label, L: s.L, track: ci.track, beats: s.beats, downs: s.downs, sr: s.sr, origPos: s.origPos, grid: rec && rec.grid || null, bpmDet: s.bpm, len: s.len,
        beatMs: b => (b2f(b + 1, s.beats) - b2f(b, s.beats)) / s.sr * 1000 };
    }
    return null;
  }
  const snapB = b => ui.snap ? Math.round(b * 4) / 4 : Math.round(b * 1000) / 1000;
  const endOf = (tok, i) => { const t = tok[i]; for (let j = i + 1; j < tok.length; j++) if (tok[j].b != null) return Math.min(tok[j].b, t.b + 2); return t.b + 1; };

  // ---- Spur unter der Akkordleiste ----
  let laneSig = '', curSrc = null, lastSrc = null, lastCur = -2, syncing = false;
  function tick(ci) {
    const band = $('sgBand'), strip = $('sgStrip'); if (!band) return;
    const live = source(ci);
    if (live && live.kind !== 'none') { lastSrc = live; histSeen(live); }
    // Editor bleibt nach dem Anhalten bei der zuletzt gespielten Quelle (zum Korrigieren in Ruhe)
    const src = live || (lastSrc ? Object.assign({}, lastSrc, { nowB: null }) : null); curSrc = src;
    if (ui.open) paintEditor(src);
    const has = live && live.tok && live.tok.some(t => t.b != null);
    { const sv = $('sgSave'); if (sv) { const hv = !(live && live.kind === 'file'); if (sv.hidden !== hv) sv.hidden = hv; } }
    band.hidden = !live || live.kind === 'none'; const lineEl = $('sgLine'); if (lineEl) lineEl.hidden = !has;
    if (band.hidden) { laneSig = ''; lineSig = ''; focusUi(null, ci); return; }
    focusUi(live, ci);
    if (lineEl) lineEl.hidden = !has;
    const srcL = live;
    const own = (loopP && loopP.id === srcL.id) ? loopP : (wordP && wordP.id === srcL.id ? wordP : null);
    if (own) srcL.nowB = own.nowB();
    const W = parseFloat($('sfStrip').style.width) || $('sfBand').clientWidth;
    const fk = fBar(), sig = srcL.id + '|' + W + '|' + ci.L + '|' + ver + '|' + (srcL.kind === 'lied' ? srcL.title : '') + '|' + fk + '|' + !!envOf(srcL);
    if (sig !== laneSig && !ui.inline && !ui.dragging) {
      laneSig = sig; lastCur = -2;
      strip.style.width = W + 'px'; { const hh = $('sfStrip').offsetHeight; if (hh) strip.style.height = hh + 'px'; }
      const px = f => f / ci.L * W;
      let h = '';
      if (!has) h += '<div class="sg-hint">' + esc(srcL.editable ? T('Gesangstext: freie Stelle antippen = Wort einfügen · oder „🎤 Gesangstext“ → erkennen / einfügen / einklopfen') : T('Gesangstext: „🎤 Gesangstext“ → einklopfen')) + '</div>';
      // Raster wie in der Akkordleiste: Takte (kräftig, mit Nummer), Schläge, 16tel (fein) – zum genauen Einrasten
      // v75: eigenes Raster (Tempo oben) → Linien aus dem Raster der Datei, sonst wie die Akkordleiste
      const gB = srcL.grid ? srcL.beats.map(f => f - srcL.origPos).filter(x => x >= 0 && x < ci.L) : null;
      const downs = srcL.grid ? srcL.downs.map(f => f - srcL.origPos).filter(x => x >= 0 && x < ci.L) : ci.downs || [];
      const ciBeats = gB || ci.beats || [], pts = downs.concat(ciBeats).filter(x => x >= 0 && x < ci.L).sort((x, y) => x - y).filter((x, i, a) => !i || x - a[i - 1] > 2);
      downs.forEach((d, i) => { const e = i + 1 < downs.length ? downs[i + 1] : ci.L; if (i % 2) h += '<div class="sg-barbg" style="left:' + px(d).toFixed(1) + 'px;width:' + px(e - d).toFixed(1) + 'px"></div>'; });
      pts.forEach((x, i) => { const nx = i + 1 < pts.length ? pts[i + 1] : ci.L; for (let k = 1; k < 4; k++) h += '<div class="sg-g16" style="left:' + px(x + (nx - x) * k / 4).toFixed(1) + 'px"></div>'; });
      ciBeats.forEach(x => { h += '<div class="sg-gbeat" style="left:' + px(x).toFixed(1) + 'px"></div>'; });
      downs.forEach((d, i) => { h += '<div class="sg-gbar" style="left:' + px(d).toFixed(1) + 'px"><span>' + (i + 1) + '</span></div>'; });
      // Wörter: alle auf einer Ebene; Breite = Zeit bis zum nächsten Wort (langes Wort wird gekürzt, ausgewählt/aktuell ganz sichtbar)
      // v79: Wörter, die (fast) übereinander liegen, als Stapel kennzeichnen: leicht versetzt, orange, Zahl „+n“ am ersten
      const stk = {}; { let g0 = -1, lastX = -1e9, n = 0, prevI = -1;
        srcL.tok.forEach((t, i) => { if (t.b == null) return; const a = srcL.toCi(t.b); if (a == null || a < -1 || a >= ci.L) return; const x = px(a);
          if (prevI >= 0 && x - lastX < 12) { if (g0 < 0) { g0 = prevI; stk[g0] = { lvl: 0, g: g0, first: true }; } n++; stk[i] = { lvl: Math.min(2, n), g: g0 }; stk[g0].cnt = n + 1; }
          else { g0 = -1; n = 0; lastX = x; }
          prevI = i; }); }
      Object.keys(stk).forEach(k => { const v = stk[k]; if (v.first) { const t = srcL.tok[k], a = srcL.toCi(t.b); h += '<b class="sg-stkn" data-i="' + k + '" style="left:' + px(a).toFixed(1) + 'px" title="' + esc(T('Hier liegen mehrere Wörter übereinander – antippen zum Auseinanderziehen')) + '">+' + (v.cnt - 1) + '</b>'; } });
      srcL.tok.forEach((t, i) => {
        if (t.b == null) return;
        const a0 = srcL.toCi(t.b), e0 = srcL.toCi(endOf(srcL.tok, i)); if (a0 == null || a0 < -1 || a0 >= ci.L) return;
        const wpx = Math.max(14, px(Math.min(ci.L, e0) - a0) - 2), sv = stk[i];
        h += '<span class="sg-w' + (i === ui.sel ? ' sel' : '') + (t.k ? ' lk' : '') + (sv ? ' stk' : '') + '"' + (sv && sv.lvl ? ' data-lvl="' + sv.lvl + '"' : '') + ' data-i="' + i + '" style="left:' + px(a0).toFixed(1) + 'px;width:' + wpx.toFixed(1) + 'px;font-size:' + fitFont(t.w, wpx) + 'px">' + esc(t.w) + '</span>';
      });
      // v72: Stimmkurve im Bearbeitungs-Zoom (Takt davor bis Takt danach)
      let envBox = null;
      if (fk != null && envOf(srcL) && downs.length) { const a = downs[Math.max(0, fk - 1)], e = fk + 2 < downs.length ? downs[fk + 2] : ci.L; envBox = [px(a), px(e) - px(a)]; h += '<canvas class="sg-env" id="sgEnv" style="left:' + envBox[0].toFixed(1) + 'px;width:' + envBox[1].toFixed(1) + 'px"></canvas>'; }
      h += '<div class="sg-snap" id="sgSnapLine" hidden><span></span></div><div class="sg-ph" id="sgPh"></div>';
      strip.innerHTML = h; lineSig = ''; strip.classList.toggle('sg-env-on', !!envBox);
      if (envBox) drawEnv(srcL, ci, W);
    }
    if (!ui.inline && Math.abs(band.scrollLeft - $('sfBand').scrollLeft) > 1) { syncing = true; band.scrollLeft = $('sfBand').scrollLeft; }
    if (own) { const ph = $('sgPh'), f = srcL.toCi(srcL.nowB); if (ph && f != null) { ph.style.display = ''; ph.style.transform = 'translateX(' + (f / ci.L * W).toFixed(1) + 'px)'; } }
    else { const ph = $('sgPh'), sp = $('sfPh'); if (ph && sp) { const tr = sp.style.transform, dsp = sp.style.display; if (ph.style.transform !== tr) ph.style.transform = tr; if (ph.style.display !== dsp) ph.style.display = dsp; } }
    // aktuelles Wort
    let cur = -1;
    if (srcL.nowB != null) srcL.tok.forEach((t, i) => { if (t.b != null && srcL.nowB >= t.b - 0.02 && srcL.nowB < endOf(srcL.tok, i)) cur = i; });
    if (cur !== lastCur) { strip.querySelectorAll('.sg-w').forEach(el => el.classList.toggle('on', +el.dataset.i === cur)); lastCur = cur; paintLine(srcL, cur); }
  }
  // Lesezeile: aktuelle (bzw. kommende) Zeile ganz, aktuelles Wort hervorgehoben, nächste Zeile klein
  let lineSig = '';
  function paintLine(src, cur) {
    const el = $('sgLine'); if (!el) return;
    const tok = src.tok; let i = cur;
    if (i < 0 && src.nowB != null) i = tok.findIndex(t => t.b != null && t.b > src.nowB);
    if (i < 0) i = tok.findIndex(t => t.b != null);
    if (i < 0) { el.innerHTML = ''; lineSig = ''; return; }
    const l = tok[i].l, sig = src.id + '|' + l + '|' + cur + '|' + ver;
    if (sig === lineSig) return; lineSig = sig;
    const words = tok.map((t, j) => ({ t, j })).filter(x => x.t.l === l), nx = tok.filter(t => t.l === l + 1).map(t => t.w).join(' ');
    el.innerHTML = '<span class="sg-cur">' + words.map(x => '<span' + (x.j === cur ? ' class="on"' : x.j < cur && cur >= 0 ? ' class="past"' : '') + '>' + esc(x.t.w) + '</span>').join(' ') + '</span>'
      + (nx ? '<span class="sg-next">' + esc(nx) + '</span>' : '');
  }
  // Schriftgröße so, dass das Wort möglichst in seine Breite passt (16 px, in engen Stellen bis 10 px)
  const fitFont = (w, wpx) => Math.max(10, Math.min(16, Math.floor((wpx - 9) / (String(w).length * 0.56 + 0.2))));
  let ver = 0; const changed = () => { ver++; hist(); save(); laneSig = ''; edSig = ''; };
  // ---- v80: Rückgängig / Wiederholen – jeder Stand des Textes der aktuellen Quelle (alle Änderungen laufen über changed) ----
  const H = {};                                     // id → { snap, undo: [], redo: [] }
  const recOf = src => !src ? null : src.kind === 'lied' ? db.l[src.id] : db.f[src.id];
  const stateOf = r => JSON.stringify(r ? { tok: r.tok, grid: r.grid || null } : { tok: [], grid: null });
  function hist() {
    const src = curSrc || lastSrc; if (!src || !src.id || src.kind === 'none') return;
    const h = H[src.id] || (H[src.id] = { snap: null, undo: [], redo: [] }), cur = stateOf(recOf(src));
    if (h.snap != null && h.snap !== cur && !hist.off) { h.undo.push(h.snap); if (h.undo.length > 80) h.undo.shift(); h.redo = []; }
    h.snap = cur;
  }
  function histSeen(src) { if (src && src.id && !H[src.id]) H[src.id] = { snap: stateOf(recOf(src)), undo: [], redo: [] }; }
  function undoRedo(dir) {
    const src = curSrc; if (!src || !src.id) return false; const h = H[src.id]; if (!h) return false;
    const from = dir < 0 ? h.undo : h.redo, to = dir < 0 ? h.redo : h.undo; if (!from.length) return false;
    let r = recOf(src); if (!r) { r = src.kind === 'lied' ? (db.l[src.id] = { tok: [], txt: src.text }) : (db.f[src.id] = { name: src.name, tok: [] }); }
    to.push(stateOf(r)); const st = JSON.parse(from.pop());
    r.tok.splice(0, r.tok.length, ...st.tok); if (st.grid) r.grid = st.grid; else delete r.grid;
    if (src.tok !== r.tok) src.tok = r.tok;
    hist.off = true; changed(); hist.off = false; h.snap = stateOf(r);
    if (src.kind === 'lied') persist(src);
    ui.sel = Math.min(ui.sel, r.tok.length - 1); focusSig = '*';
    status(dir < 0 ? T('Rückgängig gemacht.') : T('Wiederhergestellt.')); return true;
  }
  const canUndo = () => { const s2 = curSrc, h = s2 && H[s2.id]; return !!(h && h.undo.length); }, canRedo = () => { const s2 = curSrc, h = s2 && H[s2.id]; return !!(h && h.redo.length); };
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || (e.key !== 'z' && e.key !== 'Z' && e.key !== 'y')) return;
    if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') && (e.target || {}).id !== 'pedalSink') return;
    const p = document.getElementById('panel-solo'); if (!p || p.hidden) return;
    if (undoRedo(e.key === 'y' || e.shiftKey ? 1 : -1)) e.preventDefault();
  });

  // ---- Bearbeitungs-Zoom (v70): ein Takt breit, „▶ ab hier“, Wörter verteilen, „✓ Fertig“ ----
  const SF = () => window.SoloFocus || null, fBar = () => SF() ? SF().get() : null;
  let focusSrc = null, focusSig = '*';
  // Takt (Index in ci.downs), in dem die Schlagzeit b liegt
  function barOf(src, ci, b) { const a = src.toCi(b), D = ci.downs || []; let i = 0; while (i + 1 < D.length && D[i + 1] <= a + 2) i++; return i; }
  // Schlagbereich eines Taktes in Quellen-Schlägen
  function barRange(src, ci, k) { const D = ci.downs || [], a = D[k] || 0, e = k + 1 < D.length ? D[k + 1] : ci.L; return [src.fromCi(a), src.fromCi(e)]; }
  function focus(k) { if (!SF()) return; const was = !!loopP; if (tapS) tapS = null; focusSrc = curSrc ? curSrc.id : null; SF().set(k); laneSig = ''; if (was) setTimeout(startLoop, 50); }
  function unfocus() { if (SF() && fBar() != null) SF().set(null); focusSrc = null; ui.sel = -1; laneSig = ''; if (typeof stopLoop === 'function') stopLoop(); }
  function focusUi(src, ci) {
    const box = $('sgFocus'); if (!box) return;
    let k = fBar();
    if (k != null && (!src || src.kind === 'none' || src.id !== focusSrc)) { unfocus(); k = null; }
    const sig = k == null ? '' : k + '|' + ((ci && ci.downs) || []).length + '|' + ver + '|' + ui.sel + '|' + ui.mag + '|' + ui.rate + '|' + !!loopP + '|' + (tapS ? tapS.n : -1) + '|' + !!(src && envOf(src)) + '|' + !!undoTok + '|' + ui.click + '|' + (src && src.grid ? src.grid.bpm : 0) + '|' + canUndo() + canRedo();
    if (sig === focusSig) return; focusSig = sig;
    box.hidden = k == null; if (k == null) return;
    $('sgFLbl').textContent = T('Takt ') + (k + 1);
    { const [a, e] = barRange(src, ci, k); $('sgFSpread').disabled = !src.editable && src.kind !== 'lied' || src.tok.filter(t => t.b != null && t.b >= a - 1e-6 && t.b < e - 1e-6).length < 2; }
    $('sgFPrev').disabled = k <= 0; $('sgFNext').disabled = !ci || k >= (ci.downs || []).length - 1;
    // v72: Präzisions-Werkzeuge (Stimme/Hören nur bei Songdateien)
    const file = src.kind === 'file', E = file ? envOf(src) : null;
    if (file && !envs[src.id]) voiceEnv(src);
    box.querySelectorAll('.sg-fileonly').forEach(el => { el.hidden = !file; });
    box.querySelectorAll('#sgFMag button').forEach(b => b.classList.toggle('active', b.dataset.m === ui.mag));
    box.querySelectorAll('#sgFRate button[data-r]').forEach(b => b.classList.toggle('active', +b.dataset.r === ui.rate));
    $('sgFLoop').classList.toggle('active', !!loopP); $('sgFLoop').textContent = loopP ? T('■ Schleife') : T('⟲ Schleife');
    $('sgFAlign').disabled = !E; $('sgFNudgeL').disabled = $('sgFNudgeR').disabled = !(ui.sel >= 0 && src.tok[ui.sel] && src.tok[ui.sel].b != null);
    $('sgFTapStart').classList.toggle('active', !!tapS); $('sgFTapStart').textContent = tapS ? T('✕ Einklopfen abbrechen') : T('● Takt einklopfen');
    $('sgFUndoE').disabled = !canUndo(); $('sgFRedoE').disabled = !canRedo();
    $('sgFClick').classList.toggle('active', ui.click); $('sgFClick').setAttribute('aria-pressed', ui.click ? 'true' : 'false');
    { const gl = $('sgFGridL'), gb = $('sgFGrid'); if (gl) { gl.textContent = file ? (src.grid ? T('Raster: ') + src.grid.bpm + T(' BPM (Tempo oben)') : T('Raster: erkannt') + (src.bpmDet ? ' (' + (Math.round(src.bpmDet * 10) / 10) + ' BPM)' : '')) : ''; gb.hidden = !(file && src.grid); } }
    { const r = Math.round(ui.rate * 100); $('sgFRateV').textContent = r + ' %'; $('sgFRateDn').disabled = r <= 40; $('sgFRateUp').disabled = r >= 100; }
    { const hs = ui.sel >= 0 && src.tok[ui.sel]; $('sgFIns').disabled = !(hs && src.editable && src.tok[ui.sel].b != null); $('sgFLock').disabled = !hs;
      $('sgFLock').textContent = hs && lineLocked(src.tok, src.tok[ui.sel].l) ? T('🔓 Zeile freigeben') : T('🔒 Zeile fertig');
      $('sgFCheck').disabled = !src.tok.some(t => t.k); $('sgFUndo').hidden = !undoTok; }
    const tb = $('sgFTap'); tb.hidden = !tapS;
    if (tapS) { const t = src.tok[tapS.idx[tapS.n]]; tb.textContent = T('Tippen: „') + (t ? t.w : '') + '“ (' + (tapS.n + 1) + '/' + tapS.idx.length + ')'; }
    const ev = $('sgFVoice'); if (ev) ev.textContent = !file ? '' : E ? T('♪ Stimmkurve: Berge = gesungene Silben, Striche oben = Silbenanfänge') : T('♪ Stimmkurve wird berechnet …');
  }
  // ab einem Takt vor dem bearbeiteten Takt abspielen
  function playFrom() {
    const src = curSrc, k = fBar(), ci = window.SoloInfo ? SoloInfo() : null; if (!src || k == null || !ci) return;
    stopLoop(); killP(wordP); wordP = null;
    if (src.kind === 'file' && (ui.click || ui.rate !== 1)) {
      if (typeof Looper !== 'undefined' && Looper.running && Looper.running() && Looper.pauseToggle) Looper.pauseToggle();
      const [a] = barRange(src, ci, Math.max(0, k - 1)), fa = b2f(a, src.beats); wordP = mkPlayer(src, a, f2b(fa + 30 * src.sr, src.beats), false, ui.rate); focusSig = '*'; return;
    }
    if (src.kind === 'file' && typeof Looper !== 'undefined' && Looper.seek) { const D = ci.downs || []; Looper.seek(src.track, D[Math.max(0, k - 1)] || 0); return; }
    if (src.kind === 'lied' && window.Lied && Lied.play && Lied.now) { const n = Lied.now(); if (n) Lied.play(Lied.ver(), { from: n.oi, count: 1, label: src.title }); }
  }
  function stopPlay() {
    if (loopP || wordP) { stopLoop(); killP(wordP); wordP = null; return; }
    if (curSrc && curSrc.kind === 'lied' && window.Lied && Lied.stop) { Lied.stop(); return; }
    if (typeof Looper !== 'undefined' && Looper.running && Looper.running() && Looper.pauseToggle) Looper.pauseToggle();
  }
  // Wörter im Takt gleichmäßig verteilen (auf 16tel), z. B. wenn die Erkennung mehrere auf denselben Punkt gelegt hat
  function spread() {
    const src = curSrc, k = fBar(), ci = window.SoloInfo ? SoloInfo() : null; if (!src || k == null || !ci) return;
    const [a, e] = barRange(src, ci, k), tok = src.tok, idx = [];
    tok.forEach((t, i) => { if (t.b != null && !t.k && t.b >= a - 1e-6 && t.b < e - 1e-6) idx.push(i); });
    if (idx.length < 2) { status(T('In diesem Takt gibt es nichts zu verteilen.')); return; }
    const last = idx[idx.length - 1]; let nextB = Infinity; for (let j = last + 1; j < tok.length; j++) if (tok[j].b != null) { nextB = tok[j].b; break; }
    const from = tok[idx[0]].b, end = Math.min(e, nextB), step = Math.max(0.25, Math.floor((end - from) / idx.length * 4) / 4);
    idx.forEach((i, n) => { tok[i].b = Math.round((from + n * step) * 1000) / 1000; });
    // reicht der Platz nicht, rückt der folgende Text nach (Abstände bleiben)
    const over = tok[last].b + 0.25 - nextB;
    if (over > 1e-6) for (let j = last + 1; j < tok.length; j++) if (tok[j].b != null) tok[j].b = Math.round((tok[j].b + over) * 1000) / 1000;
    changed(); persist(src);
  }
  function bindFocus() {
    const box = $('sgFocus'); if (!box || box._b) return; box._b = true;
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const k = fBar(), ci = window.SoloInfo ? SoloInfo() : null;
      if (b.id === 'sgFDone') unfocus();
      else if (b.id === 'sgFPrev' && k > 0) focus(k - 1);
      else if (b.id === 'sgFNext' && ci && k < (ci.downs || []).length - 1) focus(k + 1);
      else if (b.id === 'sgFPlay') playFrom();
      else if (b.id === 'sgFStop') stopPlay();
      else if (b.id === 'sgFSpread') spread();
      else if (b.dataset.m) { ui.mag = b.dataset.m; lsS('3nps-sing-mag', ui.mag); focusSig = '*'; }
      else if (b.dataset.r) setRate(+b.dataset.r);
      else if (b.id === 'sgFUndoE') undoRedo(-1);
      else if (b.id === 'sgFRedoE') undoRedo(1);
      else if (b.id === 'sgFClick') { ui.click = !ui.click; lsS('3nps-sing-click', ui.click ? '1' : '0'); focusSig = '*'; if (loopP) { const t = tapS; startLoop(); tapS = t; } }
      else if (b.id === 'sgFGrid') resetGrid();
      else if (b.id === 'sgFRateDn') setRate(ui.rate - 0.01);
      else if (b.id === 'sgFRateUp') setRate(ui.rate + 0.01);
      else if (b.id === 'sgFIns') insertAfter();
      else if (b.id === 'sgFLock') toggleLock();
      else if (b.id === 'sgFCheck') recheck();
      else if (b.id === 'sgFUndo') undoRecheck();
      else if (b.id === 'sgFLoop') { if (loopP) stopLoop(); else startLoop(); }
      else if (b.id === 'sgFAlign') { const src = curSrc; if (src && k != null && ci) { const [a, e2] = barRange(src, ci, k), idx = []; src.tok.forEach((t, i) => { if (t.b != null && t.b >= a - 0.5 && t.b < e2) idx.push(i); }); const n = alignIdx(src, idx, 0.3); if (n) { changed(); persist(src); } status(n + T(' Wörter an die Stimme gelegt.')); focusSig = '*'; } }
      else if (b.id === 'sgFNudgeL') nudge(-10);
      else if (b.id === 'sgFNudgeR') nudge(10);
      else if (b.id === 'sgFTapStart') { if (tapS) { tapS = null; focusSig = '*'; } else startTapBar(); }
    });
    const tb = $('sgFTap'); if (tb) tb.addEventListener('pointerdown', e => { e.preventDefault(); tapBar(); });
    document.addEventListener('keydown', e => { if (tapS && (e.code === 'Space' || e.key === ' ') && (!/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') || (e.target || {}).id === 'pedalSink')) { e.preventDefault(); tapBar(); } });
  }

  // ---- Präziser setzen (v72): Stimme sichtbar, Magnet, Hören (Wort halten, Takt-Schleife, langsam), Feinschritte, Takt einklopfen ----
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  ui.mag = lsG('3nps-sing-mag', 'voice'); if (!['grid', 'voice', 'free'].includes(ui.mag)) ui.mag = 'voice';
  ui.click = lsG('3nps-sing-click', '0') === '1'; ui.rate = +lsG('3nps-sing-rate', '1'); if (!(ui.rate >= 0.4 && ui.rate <= 1)) ui.rate = 1;
  // Stimmkurve: Lautstärke im Stimmbereich (250–3500 Hz) alle 10 ms + Silbenanfänge, je Datei einmal berechnet
  const envs = {};
  function biq(type, f, sr) {
    const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + al;
    const b = type === 'hp' ? [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2] : [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: -2 * cs / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
  }
  const run = (q, x) => { const y = q.b0 * x + q.b1 * q.x1 + q.b2 * q.x2 - q.a1 * q.y1 - q.a2 * q.y2; q.x2 = q.x1; q.x1 = x; q.y2 = q.y1; q.y1 = y; return y; };
  function envOf(src) { const e = src && envs[src.id]; return e && e.ready ? e : null; }
  async function voiceEnv(src) {
    if (!src || src.kind !== 'file' || typeof Looper === 'undefined' || !Looper.singAudio) return null;
    if (envs[src.id]) return envs[src.id].p;
    const E = envs[src.id] = { ready: false };
    E.p = (async () => {
      const probe = Looper.singAudio(src.track, 0, 1e4); if (!probe) return null;
      const sr = probe.sr, hop = Math.round(sr * 0.01), CH = sr * 10, fl = [biq('hp', 250, sr), biq('hp', 250, sr), biq('lp', 3500, sr)];
      const dv = []; let acc = 0, n = 0;
      for (let a = 0; ; a += CH) {
        const x = Looper.singAudio(src.track, a, a + CH); if (!x) break;
        for (let i = 0; i < x.length; i++) { let v = (x.l[i] + x.r[i]) * 0.5; v = run(fl[2], run(fl[1], run(fl[0], v))); acc += v * v; if (++n === hop) { dv.push(10 * Math.log10(acc / hop + 1e-10)); acc = 0; n = 0; } }
        if (x.length < CH) break;
        await new Promise(r => setTimeout(r, 0));
      }
      if (dv.length < 10) return null;
      // Bereich: vom Mittelwert (Begleitung) bis zur Spitze – so heben sich die gesungenen Silben ab
      const srt = Float32Array.from(dv).sort(), mx = srt[Math.max(0, srt.length - 1 - (srt.length / 200 | 0))], fl0 = Math.max(mx - 30, srt[srt.length >> 1]), rg = Math.max(6, mx - fl0);
      const e = new Float32Array(dv.length); dv.forEach((v, i) => { e[i] = Math.max(0, Math.min(1, (v - fl0) / rg)); });
      // Silbenanfänge: deutlicher Anstieg (≥ 5 dB in 30 ms), stärkster Punkt des Anstiegs, laut genug, mindestens 90 ms Abstand
      const rise = i => dv[i] - dv[i - 3], on = []; let last = -1e9;
      for (let i = 4; i < dv.length - 3; i++) {
        const d = rise(i); if (d < 5 || e[i + 2] < 0.25 || rise(i + 1) > d || rise(i - 1) >= d || i - last < 9) continue;
        on.push((i - 2) * 0.01); last = i;
      }
      E.sr = sr; E.e = e; E.on = on; E.onB = on.map(s => f2b(s * sr, src.beats)); E.ready = true; laneSig = ''; focusSig = '*';
      return E;
    })().catch(() => null);
    return E.p;
  }
  // Ziel für ein gezogenes/getipptes Wort: Raster, nächster Silbenanfang (Stimme) oder frei
  function placeB(raw, src, tolMs) {
    if (ui.mag === 'voice') {
      const E = envOf(src);
      if (E) {
        const tol = (tolMs || 120) / (src.beatMs ? src.beatMs(raw) : 500); let best = null, bd = tol;
        for (const ob of E.onB) { const d = Math.abs(ob - raw); if (d < bd) { bd = d; best = ob; } }
        if (best != null) return { b: Math.round(best * 1000) / 1000, how: 'voice' };
      }
      return { b: Math.round(raw * 4) / 4, how: 'grid' };
    }
    if (ui.mag === 'free') return { b: Math.round(raw * 1000) / 1000, how: 'free' };
    return { b: snapB(raw), how: 'grid' };
  }
  // Wörter (Indizes, aufsteigend) an die nächsten Silbenanfänge legen; Reihenfolge bleibt, jeder Anfang nur einmal
  function alignIdx(src, idx, tolS) {
    const E = envOf(src); if (!E) return 0; const tok = src.tok; let n = 0, used = new Set();
    idx.forEach((i, k) => {
      const t = tok[i]; if (t.b == null || t.k) return;
      const prevB = (() => { for (let j = i - 1; j >= 0; j--) if (tok[j].b != null) return tok[j].b; return -Infinity; })();
      const nextB = (() => { for (let j = i + 1; j < tok.length; j++) if (tok[j].b != null) return tok[j].b; return Infinity; })();
      const tol = tolS * 1000 / (src.beatMs ? src.beatMs(t.b) : 500); let best = -1, bd = tol;
      E.onB.forEach((ob, j) => { const d = Math.abs(ob - t.b); if (d < bd && !used.has(j) && ob > prevB + 0.06 && ob < nextB - 0.06) { bd = d; best = j; } });
      if (best >= 0) { used.add(best); const nb = Math.round(E.onB[best] * 1000) / 1000; if (nb !== t.b) { t.b = nb; n++; } }
    });
    return n;
  }
  // eigener Player: Takt in Schleife (ein Schlag Anlauf), auch langsam; oder ein einzelnes Wort
  let loopP = null, wordP = null;
  function mkPlayer(src, b0, b1, loop, rate) {
    const f0 = b2f(b0, src.beats), f1 = b2f(b1, src.beats); if (f0 == null || f1 == null) return null;
    const x = Looper.singAudio(src.track, Math.max(0, f0), f1); if (!x) return null;
    const y = rate === 1 ? x : Looper.stretchAudio(x, Math.round(x.length / rate));
    if (ui.click) addClicks(y, src, b0, b1, Math.max(0, f0), rate, x.sr);
    if (typeof ensureAudio === 'function') ensureAudio();
    const ctx = audioCtx, buf = ctx.createBuffer(2, y.length, x.sr); buf.copyToChannel(y.l, 0); buf.copyToChannel(y.r || y.l, 1);
    const node = ctx.createBufferSource(), g = ctx.createGain(); node.buffer = buf; node.loop = loop;
    node.connect(g); g.connect(typeof ensureMasterBus === 'function' ? ensureMasterBus() : ctx.destination);
    const t0 = ctx.currentTime + 0.05, len = y.length, sr = x.sr, fs = Math.max(0, f0); node.start(t0);
    return { node, g, id: src.id, b0, b1, rate,
      nowB: () => { const el = ctx.currentTime - t0 - (ctx.outputLatency || 0); if (el < 0) return b0; const pf = loop ? (el * sr) % len : Math.min(len, el * sr); return f2b(fs + pf * rate, src.beats); } };
  }

  // v75: Metronom – Klicks auf jeden Schlag des Rasters direkt in den Ausschnitt mischen (Eins höher und lauter)
  function addClicks(y, src, b0, b1, fs, rate, sr) {
    const n = Math.round(sr * 0.03), D = src.downs || [], chans = y.r && y.r !== y.l ? [y.l, y.r] : [y.l];
    for (let k = Math.ceil(b0 - 1e-6); k <= Math.floor(b1 + 1e-6); k++) {
      const fk = b2f(k, src.beats); if (fk == null) continue;
      const p0 = Math.round((fk - fs) / rate); if (p0 < 0 || p0 >= y.length) continue;
      const down = D.some(d => Math.abs(d - fk) < sr * 0.02), f = down ? 2400 : 1600, g = down ? 0.7 : 0.45;
      for (let i = 0; i < n && p0 + i < y.length; i++) { const v = Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / (sr * 0.006)) * g; chans.forEach(c => { c[p0 + i] += v; }); }
    }
  }
  const killP = p => { if (p) try { p.node.stop(); p.node.disconnect(); p.g.disconnect(); } catch (e) {} };
  function stopLoop() { killP(loopP); loopP = null; tapS = null; focusSig = '*'; }
  function startLoop() {
    const src = curSrc, k = fBar(), ci = window.SoloInfo ? SoloInfo() : null; if (!src || src.kind !== 'file' || k == null || !ci) return false;
    stopLoop(); killP(wordP); wordP = null;
    if (typeof Looper !== 'undefined' && Looper.running && Looper.running() && Looper.pauseToggle) Looper.pauseToggle();
    const [a, e] = barRange(src, ci, k); loopP = mkPlayer(src, a - 1, e, true, ui.rate); focusSig = '*'; return !!loopP;
  }
  function playWord(i) {
    const src = curSrc; if (!src || src.kind !== 'file') return; const t = src.tok[i]; if (!t || t.b == null) return;
    killP(wordP); if (loopP) stopLoop();
    if (typeof Looper !== 'undefined' && Looper.running && Looper.running() && Looper.pauseToggle) Looper.pauseToggle();
    const e = Math.min(endOf(src.tok, i), t.b + 2);
    wordP = mkPlayer(src, t.b, e, false, ui.rate);
  }
  // Feinschritt: ausgewähltes Wort (bei „Rest mitziehen“ samt folgendem Text) um ms verschieben
  function nudge(ms) {
    const src = curSrc, i = ui.sel; if (!src || i < 0 || !src.tok[i] || src.tok[i].b == null) return;
    const tok = src.tok, d = ms / (src.beatMs ? src.beatMs(tok[i].b) : 500);
    let prevB = -Infinity; for (let j = i - 1; j >= 0; j--) if (tok[j].b != null) { prevB = tok[j].b; break; }
    let nextB = Infinity; if (!ui.ripple) for (let j = i + 1; j < tok.length; j++) if (tok[j].b != null) { nextB = tok[j].b; break; }
    const nb = Math.round(Math.max(prevB + 0.01, Math.min(nextB - 0.01, tok[i].b + d)) * 1000) / 1000, dd = nb - tok[i].b; if (!dd) return;
    if (ui.ripple) for (let j = i; j < tok.length; j++) { if (j > i && tok[j].k) break; if (tok[j].b != null) tok[j].b = Math.round((tok[j].b + dd) * 1000) / 1000; }
    else tok[i].b = nb;
    changed(); persist(src); if (!loopP) playWord(i);
  }

  // ---- v74: Wort dazwischen setzen, fertige Zeilen sperren, Rest anhand der fertigen Zeilen nachprüfen ----
  // neues Wort zwischen dem ausgewählten und dem nächsten (Mitte, nicht gerastet)
  function insertAfter() {
    const src = curSrc, i = ui.sel; if (!src || !src.editable || i < 0 || !src.tok[i] || src.tok[i].b == null) return;
    const tok = src.tok; let nb = null; for (let j = i + 1; j < tok.length; j++) if (tok[j].b != null) { nb = tok[j].b; break; }
    const b = Math.round((nb != null ? (tok[i].b + nb) / 2 : tok[i].b + 0.5) * 1000) / 1000;
    inlineEdit(-1, b, i);
  }
  const lineLocked = (tok, l) => { const w = tok.filter(t => t.l === l && t.b != null); return w.length > 0 && w.every(t => t.k); };
  function toggleLock() {
    const src = curSrc, i = ui.sel; if (!src || i < 0 || !src.tok[i]) return;
    const l = src.tok[i].l, on = !lineLocked(src.tok, l);
    src.tok.forEach(t => { if (t.l === l) { if (on) t.k = 1; else delete t.k; } });
    changed(); persist(src); focusSig = '*';
    status(on ? T('Zeile ') + (l + 1) + T(' ist fertig (🔒) – sie dient als Vorlage und wird nicht mehr automatisch verändert.') : T('Zeile ') + (l + 1) + T(' ist wieder frei.'));
  }
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  let undoTok = null;
  // Rest nachprüfen: aus den fertigen Zeilen lernen (Versatz der Erkennung, Lage zur Silbe, Streuung) und nur ungesperrte Wörter korrigieren
  async function recheck() {
    const src = curSrc; if (!src || src.kind !== 'file') return;
    const tok = src.tok, ref = tok.filter(t => t.k && t.b != null);
    if (!ref.length) { status(T('Markiere zuerst mindestens eine fertige Zeile mit „🔒 Zeile fertig“.')); return; }
    status(T('Prüfe den Rest …')); await voiceEnv(src); const E = envOf(src);
    const ms = b => src.beatMs ? src.beatMs(b) : 500;
    const withA = ref.filter(t => t.a != null), off = median(withA.map(t => t.b - t.a));
    const nearOn = b => { if (!E) return null; let best = null, bd = 0.2 * 1000 / ms(b); for (const ob of E.onB) { const d = Math.abs(ob - b); if (d < bd) { bd = d; best = ob; } } return best; };
    const biasArr = ref.map(t => { const o = nearOn(t.b); return o == null ? null : t.b - o; }).filter(x => x != null), bias = median(biasArr);
    const resid = withA.map(t => Math.abs(t.b - (t.a + off)) * ms(t.b) / 1000).sort((x, y) => x - y);
    const tolS = resid.length ? Math.max(0.12, Math.min(0.4, resid[Math.floor(resid.length * 0.9)] * 1.5 + 0.05)) : 0.25;
    undoTok = tok.map(t => Object.assign({}, t));
    const used = new Set(); let moved = 0, checked = 0;
    for (let i = 0; i < tok.length; i++) {
      const t = tok[i]; if (t.b == null || t.k) continue; checked++;
      let prevB = -Infinity; for (let j = i - 1; j >= 0; j--) if (tok[j].b != null) { prevB = tok[j].b; break; }
      let nextK = Infinity; for (let j = i + 1; j < tok.length; j++) if (tok[j].k && tok[j].b != null) { nextK = tok[j].b; break; }
      const cand = t.a != null ? t.a + off : t.b;
      let nb = cand;
      if (E) { const tol = tolS * 1000 / ms(cand); let bj = -1, bd = tol; E.onB.forEach((ob, j) => { const d = Math.abs(ob - cand); if (d < bd && !used.has(j) && ob + bias > prevB + 0.05 && ob + bias < nextK - 0.05) { bd = d; bj = j; } }); if (bj >= 0) { used.add(bj); nb = E.onB[bj] + bias; } }
      nb = Math.max(prevB + 0.0625, Math.min(nextK - 0.0625, nb)); nb = Math.round(nb * 1000) / 1000;
      if (Math.abs(nb - t.b) > 0.001) { t.b = nb; moved++; }
    }
    changed(); persist(src); focusSig = '*';
    const lines = new Set(ref.map(t => t.l)).size;
    status(checked + T(' Wörter geprüft, ') + moved + T(' korrigiert. Vorlage: ') + lines + T(' Zeile(n)') + (withA.length ? T(', Versatz der Erkennung ') + Math.round(off * ms(0) ) + ' ms' : '') + T('. „↶“ nimmt es zurück.'));
  }
  function undoRecheck() { const src = curSrc; if (!src || !undoTok) return; src.tok.splice(0, src.tok.length, ...undoTok); undoTok = null; changed(); persist(src); focusSig = '*'; status(T('Zurückgenommen.')); }
  function setRate(r) {
    ui.rate = Math.max(0.4, Math.min(1, Math.round(r * 100) / 100)); lsS('3nps-sing-rate', String(ui.rate)); focusSig = '*';
    clearTimeout(setRate.t); if (loopP) setRate.t = setTimeout(() => { const t = tapS; startLoop(); tapS = t; }, 350);
  }
  // Takt neu einklopfen: Takt läuft (langsam) in Schleife, jeder Tipp setzt das nächste Wort dieses Taktes
  let tapS = null;
  function startTapBar() {
    const src = curSrc, k = fBar(), ci = window.SoloInfo ? SoloInfo() : null; if (!src || src.kind !== 'file' || k == null || !ci) return;
    const [a, e] = barRange(src, ci, k), idx = []; src.tok.forEach((t, i) => { if (t.b != null && !t.k && t.b >= a - 1e-6 && t.b < e - 1e-6) idx.push(i); });
    if (!idx.length) { status(T('In diesem Takt stehen keine Wörter.')); return; }
    if (!loopP && !startLoop()) return;
    tapS = { idx, n: 0, a, e, last: -Infinity, pass: -1 }; focusSig = '*';
  }
  function tapBar() {
    const src = curSrc; if (!tapS || !loopP || !src) return;
    const raw = loopP.nowB(); if (raw < tapS.a - 0.6) return;                       // Anlauf: noch nicht
    const p = ui.mag === 'voice' ? placeB(raw, src, 80) : { b: Math.round(raw * 1000) / 1000 };
    const i = tapS.idx[tapS.n]; let b = p.b; if (b <= tapS.last + 0.05) b = Math.round((tapS.last + 0.0625) * 1000) / 1000;
    src.tok[i].b = b; tapS.last = b; tapS.n++; ui.sel = i; changed();
    if (tapS.n >= tapS.idx.length) { tapS = null; persist(src); reorderAll(src.tok); status(T('Takt eingeklopft – hör es dir in der Schleife an.')); }
    focusSig = '*';
  }
  function reorderAll(tok) { const s = tok.map((t, i) => ({ t, i })).sort((x, y) => (x.t.b == null ? 1e9 : x.t.b) - (y.t.b == null ? 1e9 : y.t.b) || x.i - y.i).map(x => x.t); tok.splice(0, tok.length, ...s); changed(); }
  // Stimmkurve in die Spur zeichnen (nur im Bearbeitungs-Zoom: Takt davor bis Takt danach)
  function drawEnv(src, ci, W) {
    const cv = $('sgEnv'), E = envOf(src); if (!cv || !E) return;
    const x0 = parseFloat(cv.style.left), w = parseFloat(cv.style.width), h = cv.parentNode.offsetHeight - 16, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.min(8000, Math.round(w * dpr)); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    const g = cv.getContext('2d'); g.scale(cv.width / w, dpr);
    const css = getComputedStyle(cv), col = css.color || '#3c9';
    const fr = px => (x0 + px) / W * ci.L + src.origPos, idxOf = f => Math.floor(f / E.sr / 0.01);
    g.beginPath(); g.moveTo(0, h);
    for (let px = 0; px <= w; px += 1) { const i0 = idxOf(fr(px)), i1 = Math.max(i0, idxOf(fr(px + 1))); let m = 0; for (let i = i0; i <= i1; i++) if (E.e[i] > m) m = E.e[i]; g.lineTo(px, h - m * (h - 4)); }
    g.lineTo(w, h); g.closePath(); g.globalAlpha = 0.28; g.fillStyle = col; g.fill(); g.globalAlpha = 0.85; g.strokeStyle = col; g.lineWidth = 1; g.stroke();
    // Silbenanfänge als kleine Marken oben
    g.globalAlpha = 1; g.fillStyle = col;
    E.on.forEach(s => { const px = (s * E.sr - src.origPos) / ci.L * W - x0; if (px < -2 || px > w + 2) return; g.fillRect(px - 1, 0, 2, 7); });
  }

  // Wort im Band ziehen (Timing verschieben)
  function bindLane() {
    const strip = $('sgStrip'), band = $('sgBand'); if (!strip || strip._b) return; strip._b = true;
    // Spur und Akkordleiste scrollen gemeinsam (in beide Richtungen)
    const sb = $('sfBand');
    band.addEventListener('scroll', () => { if (syncing) { syncing = false; return; } if (Math.abs(sb.scrollLeft - band.scrollLeft) > 0.5) sb.scrollLeft = band.scrollLeft; });
    // Akkordleiste scrollt (auch weich beim Mitlaufen) → Spur sofort mit, nicht erst beim nächsten Anzeigeschritt
    if (sb) sb.addEventListener('scroll', () => { if (!ui.inline && !band.hidden && Math.abs(band.scrollLeft - sb.scrollLeft) > 0.5) { syncing = true; band.scrollLeft = sb.scrollLeft; } }, { passive: true });
    let drag = null;
    const ciNow = () => window.SoloInfo ? SoloInfo() : null;
    const posB = (clientX, ci) => { const r = strip.getBoundingClientRect(), W = parseFloat(strip.style.width) || r.width; return curSrc.fromCi((clientX - r.left) / W * ci.L); };
    const guide = (nb, ci) => {
      const g = $('sgSnapLine'); if (!g) return;
      if (nb == null) { g.hidden = true; return; }
      const W = parseFloat(strip.style.width) || 1; g.hidden = false; g.style.left = (curSrc.toCi(nb) / ci.L * W).toFixed(1) + 'px';
      g.firstChild.textContent = T('Takt ') + curSrc.label(nb) + (guide.how === 'voice' ? ' ♪' : '');
    };
    strip.addEventListener('pointerdown', e => {
      if (!curSrc || ui.inline || e.target.closest('.sg-inline')) return;
      const sk = e.target.closest('.sg-stkn');
      if (sk) { e.preventDefault(); const ci = ciNow(), i = +sk.dataset.i; if (ci && curSrc.tok[i]) { select(i); focus(barOf(curSrc, ci, curSrc.tok[i].b)); status(T('Mehrere Wörter auf einer Stelle – „⇹ verteilen“ zieht sie auseinander, oder einzeln antippen und ziehen.')); } return; }
      const el = e.target.closest('.sg-w');
      const di = el ? +el.dataset.i : -1, tk = curSrc.tok;
      // Rest mitziehen: alle folgenden Wörter wandern mit (Abstände bleiben); nicht über das Wort davor hinaus
      let prevB = -Infinity; for (let j = di - 1; j >= 0; j--) if (tk[j].b != null) { prevB = tk[j].b; break; }
      drag = { i: di, x0: e.clientX, y0: e.clientY, b0: el ? tk[di].b : null, moved: false, pid: e.pointerId,
        rip: el && ui.ripple ? (() => { let lim = tk.findIndex((t, j) => j > di && t.k); if (lim < 0) lim = tk.length; return tk.map((t, j) => j >= di && j < lim && t.b != null ? t.b : null); })() : null, prevB };
      if (el) { strip.setPointerCapture(e.pointerId); e.preventDefault();
        // gedrückt halten (ohne zu ziehen) = dieses Wort anhören
        if (curSrc.kind === 'file') { const dd = drag; dd.hold = setTimeout(() => { if (drag === dd && !dd.moved) { dd.held = true; select(dd.i); playWord(dd.i); } }, 450); } }
    });
    strip.addEventListener('pointermove', e => {
      if (!drag || drag.i < 0 || !curSrc) return;
      const dx = e.clientX - drag.x0; if (Math.abs(dx) < 4 && !drag.moved) return;
      if (!drag.moved) { drag.moved = true; clearTimeout(drag.hold); select(drag.i); }
      const ci = ciNow(); if (!ci) return;
      const W = parseFloat(strip.style.width) || 1, f = curSrc.toCi(drag.b0) + dx / W * ci.L;
      const pl = placeB(curSrc.fromCi(f), curSrc); let nb = pl.b; guide.how = pl.how;
      if (drag.rip && nb < drag.prevB) nb = drag.prevB;
      guide(nb, ci);
      if (nb === curSrc.tok[drag.i].b) return;
      if (drag.rip) { const d = nb - drag.b0; drag.rip.forEach((b0, j) => { if (b0 != null) curSrc.tok[j].b = Math.round((b0 + d) * 1000) / 1000; }); }
      else curSrc.tok[drag.i].b = nb;
      ui.dragging = true; drag.dirty = true;
      strip.querySelectorAll('.sg-w').forEach(el => { const j = +el.dataset.i, t = curSrc.tok[j]; if (!t || t.b == null) return; const a0 = curSrc.toCi(t.b); el.style.left = (a0 / ci.L * W).toFixed(1) + 'px'; const wp = Math.max(14, (Math.min(ci.L, curSrc.toCi(endOf(curSrc.tok, j))) - a0) / ci.L * W - 2); el.style.width = wp.toFixed(1) + 'px'; el.style.fontSize = fitFont(t.w, wp) + 'px'; });
    });
    const up = e => {
      const d = drag; drag = null; guide(null); ui.dragging = false; if (d) clearTimeout(d.hold);
      if (d && d.held) return;
      if (d && d.dirty && curSrc) { if (!d.rip) reorder(curSrc.tok, d.i); changed(); }
      if (!d || !curSrc || d.moved || Math.abs(e.clientX - d.x0) > 6 || Math.abs(e.clientY - d.y0) > 10) return;
      const ci = ciNow(); if (!ci) return;
      const empty = e.target === strip || (e.target.className && /sg-(g16|gbeat|gbar|barbg)/.test(e.target.className));
      // erstes Antippen: dieser Takt wird breit (Bearbeitungs-Zoom), danach wird bearbeitet
      if (SF() && fBar() == null && (d.i >= 0 || empty)) { if (d.i >= 0) select(d.i); focus(barOf(curSrc, ci, d.i >= 0 ? curSrc.tok[d.i].b : posB(e.clientX, ci))); return; }
      // im Bearbeitungs-Zoom: anderes Wort antippen = auswählen (und anhören), ausgewähltes nochmal = ändern
      if (d.i >= 0 && fBar() != null && ui.sel !== d.i) { select(d.i); if (!loopP) playWord(d.i); return; }
      if (d.i >= 0) { select(d.i); if (curSrc.editable) inlineEdit(d.i, null); return; }
      if (curSrc.editable && empty) inlineEdit(-1, snapB(posB(e.clientX, ci)));
    };
    strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', () => { const d = drag; if (d) clearTimeout(d.hold); drag = null; guide(null); ui.dragging = false; if (d && d.dirty) changed(); });
  }
  // gezogenes Wort in der Reihenfolge an seine neue Zeit setzen (Text bleibt sonst unverändert)
  function reorder(tok, i) {
    const t = tok[i]; if (!t || t.b == null) return;
    const rest = tok.slice(0, i).concat(tok.slice(i + 1));
    let k = rest.findIndex(x => x.b != null && x.b > t.b); if (k < 0) k = rest.length;
    if (k === i) return;
    rest.splice(k, 0, t); tok.splice(0, tok.length, ...rest); ui.sel = k; changed();
  }
  // Wort direkt in der Spur ändern (i ≥ 0) oder an der Stelle b neu einfügen (i = -1).
  // Leer lassen = Wort löschen, mehrere Wörter = teilen (Zeit verteilt bis zum nächsten Wort).
  function inlineEdit(i, b, after) {
    const src = curSrc, strip = $('sgStrip'); if (!src || !strip) return;
    const ci = window.SoloInfo ? SoloInfo() : null; if (!ci) return;
    if (inlineEdit.cur) inlineEdit.cur(true);          // offenes Eingabefeld erst übernehmen
    const tok = src.tok, W = parseFloat(strip.style.width) || 1, at = i >= 0 ? tok[i].b : b; if (at == null) return;
    const el = i >= 0 ? strip.querySelector('.sg-w[data-i="' + i + '"]') : null;
    const box = document.createElement('div'); box.className = 'sg-inline';
    box.style.left = Math.max(0, Math.min(W - 230, src.toCi(at) / ci.L * W)).toFixed(1) + 'px';
    box.style.top = el ? el.offsetTop + 'px' : '34px';
    box.innerHTML = '<input type="text" autocapitalize="off" autocomplete="off" spellcheck="false" value="' + (i >= 0 ? esc(tok[i].w) : '') + '" aria-label="' + T('Wort') + '"><button type="button" class="sg-ok" aria-label="OK">✓</button>' + (i >= 0 ? '<button type="button" class="sg-del" aria-label="' + T('Wort löschen') + '">✕</button>' : '');
    ui.inline = true; strip.appendChild(box);
    const inp = box.querySelector('input'); try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } inp.select();
    let done = false; const snap = tok.map(t => Object.assign({}, t));
    const close = apply => {
      if (done) return; done = true; ui.inline = false; if (inlineEdit.cur === close) inlineEdit.cur = null;
      const v = apply === 'del' ? '' : inp.value.trim(); box.remove();
      if (apply) {
        if (i >= 0) {
          if (!v) { tok.splice(i, 1); ui.sel = -1; }
          else if (v !== tok[i].w) { const parts = v.split(/\s+/), t = tok[i], nb = endOf(tok, i); tok.splice(i, 1, ...parts.map((w, k) => ({ w, l: t.l, b: t.b == null ? null : snapB(t.b + (nb - t.b) * k / parts.length) }))); }
        } else if (v) {
          // Zeile vom Wort davor übernehmen (sonst vom Wort danach), richtig einsortieren
          let k = tok.findIndex(t => t.b != null && t.b > b); if (k < 0) k = tok.length;
          const l = after != null && tok[after] ? tok[after].l : k > 0 ? tok[k - 1].l : tok[k] ? tok[k].l : 0;
          const parts = v.split(/\s+/);
          // zwischen zwei Wörtern: Platz bis zum nächsten gleichmäßig teilen, sonst halbe Schläge
          let nx = null; for (let j = k; j < tok.length; j++) if (tok[j].b != null) { nx = tok[j].b; break; }
          const room = nx != null ? nx - b : Infinity, step = room < parts.length * 0.5 ? room / (parts.length + 0) : (ui.snap ? 0.5 : 0.25);
          tok.splice(k, 0, ...parts.map((w, j) => ({ w, l, b: after != null || room < parts.length * 0.5 ? Math.round((b + j * step) * 1000) / 1000 : snapB(b + j * step) }))); ui.sel = k;
        }
        changed();
        if (!persist(src)) { const fresh = tokenize(src.text); src.tok.splice(0, src.tok.length, ...merge(snap, fresh)); changed(); }
      }
      laneSig = ''; edSig = '';
    };
    inlineEdit.cur = close;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); close(true); } else if (e.key === 'Escape') { e.preventDefault(); close(false); } e.stopPropagation(); });
    inp.addEventListener('blur', () => setTimeout(() => { if (!box.contains(document.activeElement)) close(true); }, 120));
    box.querySelector('.sg-ok').addEventListener('click', () => close(true));
    const del = box.querySelector('.sg-del'); if (del) del.addEventListener('pointerdown', e => { e.preventDefault(); close('del'); });
  }
  // Datei-Text speichern (für Song-Quellen liegt der Text im Songwriting – dort nur die Zeiten)
  function persist(src) {
    if (src.kind === 'file' && !db.f[src.id]) { db.f[src.id] = { name: src.name, tok: src.tok }; save(); }
    if (src.kind !== 'lied' || !window.Lied || !Lied.singSetText) return true;
    // Text aus den Wörtern zurück in den Songtext; Leerzeilen bleiben, Zeilen mit Akkordmarken [Am] werden nicht angefasst
    const orig = String(src.text || '').replace(/\r/g, '').split('\n'), ne = [];
    orig.forEach((ln, i) => { if (ln.replace(/\[[^\]]*\]/g, ' ').trim()) ne.push(i); });
    const byL = {}; src.tok.forEach(t => { (byL[t.l] = byL[t.l] || []).push(t.w); });
    const norm = x => x.replace(/\[[^\]]*\]/g, ' ').trim().split(/\s+/).join(' ');
    let conflict = false;
    ne.forEach((oi, k) => {
      const nl = (byL[k] || []).join(' ');
      if (/\[/.test(orig[oi])) { if (norm(orig[oi]) !== nl) conflict = true; return; }
      orig[oi] = nl;
    });
    Object.keys(byL).map(Number).filter(k => k >= ne.length).sort((x, y) => x - y).forEach(k => orig.push(byL[k].join(' ')));   // neue Zeilen (z. B. leerer Text)
    if (conflict) { status(T('Diese Zeile enthält Akkordmarken wie [Am] – ihren Text bitte im Songwriting ändern.')); return false; }
    const text = orig.filter((ln, i) => !(ne.includes(i) && !ln.trim())).join('\n').replace(/^\n+/, '');
    if (text === src.text) return true;
    if (!Lied.singSetText(src.partId, src.pass, text)) return false;
    src.text = text; if (db.l[src.id]) { db.l[src.id].txt = text; save(); }
    return true;
  }

  // ---- Einklopfen ----
  function tap() {
    const src = curSrc; if (!src || src.nowB == null) { status('Erst abspielen – dann bei jeder Silbe tippen.'); return; }
    const tok = src.tok;
    let i = tok.findIndex((t, j) => t.b == null && (ui.lineFrom < 0 || t.l >= ui.lineFrom));
    if (i < 0) { status('Alle Wörter haben eine Zeit. „Zeile neu“ wählt eine Zeile zum neu Einklopfen.'); stopTap(); return; }
    tok[i].b = snapB(src.nowB);
    ui.sel = i; changed();
    const nx = tok.findIndex((t, j) => j > i && t.b == null);
    status(nx >= 0 ? 'Nächstes Wort: „' + tok[nx].w + '“' : 'Fertig – alle Wörter haben eine Zeit.');
    if (nx < 0) stopTap();
  }
  function stopTap() { ui.tapping = false; ui.lineFrom = -1; edSig = ''; }
  function status(m) { const el = $('sgStatus'); if (el) el.textContent = m; const f = $('sgFMsg'); if (f) f.textContent = m; }

  // ---- Editor ----
  let edSig = '';
  function select(i) { ui.sel = i; edSig = ''; laneSig = ''; }
  function paintEditor(src) {
    const box = $('sgEdit'); if (!box) return;
    if (ui.chipDrag) return;                       // während ein Wort-Chip gezogen wird, nicht neu zeichnen
    const sig = (src ? src.id + '|' + src.tok.length + '|' + ver : 'none') + '|' + !!ui.sort + '|' + canUndo() + canRedo() + '|' + rec.busy + '|' + rec.msg + '|' + Math.round((rec.p || 0) * 50) + '|' + ui.sel + '|' + ui.tapping + '|' + ui.lineFrom + '|' + ui.snap;
    if (sig === edSig) return; edSig = sig;
    if (!src) { box.innerHTML = '<p class="caption">Spiel einen Song aus dem Songwriting oder einen Loop aus einer geladenen Datei ab – dann erscheint hier sein Gesangstext.</p>'; return; }
    if (src.kind === 'none') { box.innerHTML = '<p class="caption">Diese Spur wurde ins Tempo des Loops gedehnt – dafür ist kein Gesangstext möglich. Lade die Datei ohne Anpassung.</p>'; return; }
    let h = '<div class="sg-src"><b translate="no">' + esc(src.title) + '</b>' + (src.kind === 'lied' ? '<span class="caption"> · ' + (src.editable ? 'Text aus dem Songwriting – Änderungen hier landen dort' : 'Variante – Text im Songwriting ändern') + '</span>' : '') + '</div>';
    if (src.kind === 'file') h += '<div class="sg-auto"><button class="toggle-btn' + (rec.busy ? ' active' : '') + '" id="sgAuto"' + (rec.busy ? ' disabled' : '') + '>🤖 Text automatisch erkennen</button>'
      + '<label class="field sg-lang"><span>Erkennung</span><select id="sgModel"><option value="base"' + (rec.model === 'base' ? ' selected' : '') + '>Genau</option><option value="tiny"' + (rec.model === 'tiny' ? ' selected' : '') + '>Sparsam (weniger Speicher)</option></select></label>'
      + '<label class="field sg-lang"><span>Sprache</span><select id="sgLang"><option value="de"' + (rec.lang === 'de' ? ' selected' : '') + '>Deutsch</option><option value="en"' + (rec.lang === 'en' ? ' selected' : '') + '>Englisch</option></select></label>'
      + '<span class="caption" id="sgAutoInfo">' + esc(rec.msg || 'Erkennt den gesungenen Text mit Zeitpunkten – danach nur noch ausbessern. Läuft komplett auf dem Gerät; beim ersten Mal werden etwa 100 MB geladen.') + '</span>'
      + (rec.busy ? '<div class="sg-prog"><i style="width:' + Math.round((rec.p || 0) * 100) + '%"></i></div>' : '') + '</div>';
    if (src.kind === 'file') h += '<details class="sg-paste"' + (src.tok.length ? '' : ' open') + '><summary>Text einfügen / ersetzen</summary><textarea id="sgText" rows="5" placeholder="Liedtext hier einfügen – eine Zeile pro gesungener Zeile">' + esc(lines(src.tok).map(l => l.map(t => t.w).join(' ')).join('\n')) + '</textarea><button class="toggle-btn" id="sgTake">Übernehmen</button></details>';
    if (src.tok.length) {
      h += '<div class="sg-tools"><button class="toggle-btn sg-tapbtn' + (ui.tapping ? ' active' : '') + '" id="sgTapMode">' + (ui.tapping ? '■ Einklopfen beenden' : '● Einklopfen') + '</button>'
        + '<label class="check"><input type="checkbox" id="sgSnap"' + (ui.snap ? ' checked' : '') + '> Magnet 16tel</label>'
        + '<span class="caption">' + src.tok.filter(t => t.b != null).length + ' von ' + src.tok.length + ' Wörtern mit Zeit</span></div>';
      if (ui.tapping) h += '<button class="sg-tap" id="sgTap">Tippen = nächstes Wort</button>';
      h += '<p class="sg-status" id="sgStatus">' + (ui.tapping ? 'Abspielen und bei jeder Silbe bzw. jedem Wort auf den großen Knopf tippen.' : (src.editable ? 'In der Spur oben: Wort ziehen = Zeit verschieben, Wort antippen = ändern (leer = löschen), freie Stelle antippen = Wort einfügen. Hier unten: Wort antippen für Feinschritte.' : 'In der Spur oben: Wort ziehen = Zeit verschieben. Den Text selbst änderst du im Songwriting.')) + '</p>';
      if (ui.sel >= 0 && src.tok[ui.sel]) {
        const t = src.tok[ui.sel];
        h += '<div class="sg-selbar">' + (src.editable ? '<input type="text" id="sgWord" value="' + esc(t.w) + '" aria-label="Wort"><button class="toggle-btn" id="sgRepl">Ersetzen</button>' : '<b translate="no">' + esc(t.w) + '</b>')
          + '<button class="toggle-btn" data-n="-1" aria-label="früher">◀</button><button class="toggle-btn" data-n="1" aria-label="später">▶</button>'
          + (src.editable ? '<button class="toggle-btn" id="sgMerge">Mit nächstem verbinden</button><button class="toggle-btn" id="sgInsA">＋ Wort danach</button><button class="toggle-btn" id="sgSwapL" title="Mit dem Wort davor tauschen">⇠ tauschen</button><button class="toggle-btn" id="sgSwapR" title="Mit dem Wort danach tauschen">tauschen ⇢</button>' : '')
          + '<button class="toggle-btn" id="sgClear">Zeit löschen</button><span class="caption">' + (t.b != null ? 'Takt ' + src.label(t.b) : 'noch ohne Zeit') + '</span></div>';
      }
      h += '<div class="sg-sortbar"><button class="toggle-btn" id="sgUndo"' + (canUndo() ? '' : ' disabled') + ' title="' + T('Rückgängig') + '">↶</button><button class="toggle-btn" id="sgRedo"' + (canRedo() ? '' : ' disabled') + ' title="' + T('Wiederholen') + '">↷</button></div>';
      if (src.editable) h += '<div class="sg-sortbar"><button class="toggle-btn' + (ui.sort ? ' active' : '') + '" id="sgSort" aria-pressed="' + !!ui.sort + '">↕ Wörter umsortieren</button><span class="caption">' + (ui.sort ? T('Wort ziehen und auf ein anderes fallen lassen – die Wörter tauschen ihre Plätze, die Zeiten bleiben.') : '') + '</span></div>';
      h += '<div class="sg-lines' + (ui.sort ? ' sorting' : '') + '">' + lines(src.tok).map((ln, li) => '<div class="sg-line"><button class="sg-lnum" data-l="' + li + '" title="Zeile neu einklopfen">' + (li + 1) + ' ↻</button>'
        + ln.map(t => '<button class="sg-chip' + (t.b == null ? ' none' : '') + (t.i === ui.sel ? ' sel' : '') + '" data-i="' + t.i + '" translate="no">' + esc(t.w) + '<small>' + (t.b != null ? src.label(t.b) : '–') + '</small></button>').join('') + '</div>').join('') + '</div>';
    }
    box.innerHTML = h;
  }
  function lines(tok) { const out = []; tok.forEach((t, i) => { (out[t.l] = out[t.l] || []).push(Object.assign({ i }, t)); }); return out.filter(Boolean); }

  // v79: Wort an eine andere Stelle der Wortfolge setzen – die Zeitplätze bleiben, die Wörter rücken nach
  function moveWord(src, from, to) {
    const tok = src.tok; if (!src.editable || from === to || !tok[from] || !tok[to]) return;
    const snap = tok.map(t => Object.assign({}, t)), ws = tok.map(t => t.w), w = ws.splice(from, 1)[0]; ws.splice(to, 0, w);
    tok.forEach((t, i) => { t.w = ws[i]; }); ui.sel = to; changed();
    if (!persist(src)) { tok.splice(0, tok.length, ...snap); changed(); }
  }
  function bindEditor() {
    const box = $('sgEdit'); if (!box || box._b) return; box._b = true;
    // Ziehen der Wort-Chips (nur im Umsortier-Modus)
    let cd = null;
    box.addEventListener('pointerdown', e => { const c = ui.sort && e.target.closest('.sg-chip'); if (!c) return; cd = { i: +c.dataset.i, x: e.clientX, y: e.clientY, el: c, on: false }; ui.chipDrag = true; try { c.setPointerCapture(e.pointerId); } catch (x) {} });
    box.addEventListener('pointermove', e => {
      if (!cd) return; if (!cd.on && Math.hypot(e.clientX - cd.x, e.clientY - cd.y) < 8) return;
      if (!cd.on) { cd.on = true; cd.el.classList.add('drag'); }
      cd.el.style.transform = 'translate(' + (e.clientX - cd.x) + 'px,' + (e.clientY - cd.y) + 'px)';
      const t = document.elementsFromPoint(e.clientX, e.clientY).find(x => x !== cd.el && x.classList && x.classList.contains('sg-chip'));
      box.querySelectorAll('.sg-chip.drop').forEach(x => { if (x !== t) x.classList.remove('drop'); }); if (t) t.classList.add('drop'); cd.to = t ? +t.dataset.i : null;
    });
    const endDrag = () => { if (!cd) return; const d = cd; cd = null; ui.chipDrag = false; d.el.style.transform = ''; d.el.classList.remove('drag'); box.querySelectorAll('.sg-chip.drop').forEach(x => x.classList.remove('drop'));
      if (d.on) { box._dragged = true; setTimeout(() => { box._dragged = false; }, 300); if (d.to != null && curSrc) moveWord(curSrc, d.i, d.to); edSig = ''; } };
    box.addEventListener('pointerup', endDrag); box.addEventListener('pointercancel', endDrag);
    box.addEventListener('click', e => {
      const src = curSrc; if (!src) return;
      const b = e.target.closest('button'); if (!b) return;
      const tok = src.tok;
      if (b.id === 'sgAuto') { recognize(src); return; }
      if (b.id === 'sgTake') {
        const nt = tokenize($('sgText').value); if (!nt.length) return;
        const rec = db.f[src.id] = { name: src.name, tok: merge(tok, nt) }; src.tok = rec.tok; ui.sel = -1; changed(); return;
      }
      if (b.id === 'sgTapMode') { ui.tapping = !ui.tapping; ui.lineFrom = -1; edSig = ''; laneSig = ''; return; }
      if (b.id === 'sgTap') { tap(); return; }
      if (b.classList.contains('sg-chip')) { if (box._dragged) { box._dragged = false; return; } select(+b.dataset.i); return; }
      if (b.classList.contains('sg-lnum')) {
        const l = +b.dataset.l, ln = lines(tok)[l]; if (!ln) return;
        ln.forEach(t => { tok[t.i].b = null; }); ui.lineFrom = ln[0].l; ui.tapping = true; changed();
        status('Zeile ' + (l + 1) + ' neu: abspielen und tippen.'); return;
      }
      const i = ui.sel, t = tok[i]; if (!t) return;
      if (b.dataset.n) {
        if (t.b == null) return; const d = (+b.dataset.n) * (ui.snap ? 0.25 : 0.01);
        if (ui.ripple) { let pv = -Infinity; for (let j = i - 1; j >= 0; j--) if (tok[j].b != null) { pv = tok[j].b; break; } if (t.b + d < pv) return; for (let j = i; j < tok.length; j++) if (tok[j].b != null) tok[j].b = Math.round((tok[j].b + d) * 1000) / 1000; }
        else t.b = snapB(t.b + d);
        changed(); return;
      }
      if (b.id === 'sgClear') { t.b = null; changed(); return; }
      if (b.id === 'sgInsA') { insertAfter(); return; }
      if (b.id === 'sgUndo') { undoRedo(-1); edSig = ''; return; }
      if (b.id === 'sgRedo') { undoRedo(1); edSig = ''; return; }
      if (b.id === 'sgSort') { ui.sort = !ui.sort; edSig = ''; return; }
      if (b.id === 'sgSwapL' || b.id === 'sgSwapR') { const i = ui.sel, j = i + (b.id === 'sgSwapL' ? -1 : 1); if (i >= 0 && j >= 0 && j < tok.length) { moveWord(src, i, j); } return; }
      if (b.id === 'sgRepl') {
        const v = ($('sgWord').value || '').trim(); if (!v) return;
        const parts = v.split(/\s+/), nb = endOf(tok, i);
        // mehrere Wörter: Teilen – die Zeit verteilt sich gleichmäßig bis zum nächsten Wort
        const add = parts.map((w, k) => ({ w, l: t.l, b: t.b == null ? null : snapB(t.b + (nb - t.b) * k / parts.length) }));
        tok.splice(i, 1, ...add); changed(); persist(src); return;
      }
      if (b.id === 'sgMerge') { const n = tok[i + 1]; if (!n || n.l !== t.l) return; t.w = t.w + ' ' + n.w; tok.splice(i + 1, 1); changed(); persist(src); return; }
    });
    box.addEventListener('change', e => { if (e.target.id === 'sgSnap') { ui.snap = e.target.checked; edSig = ''; } if (e.target.id === 'sgLang') { rec.lang = e.target.value; lsSet('3nps-asr-lang', rec.lang); } if (e.target.id === 'sgModel') { rec.model = e.target.value; lsSet('3nps-asr-model', rec.model); } });
  }

  function init() {
    const btn = $('sgToggle'); if (!btn) return;
    const rb = $('sgRipple');
    if (rb) { const show = () => { rb.classList.toggle('active', ui.ripple); rb.setAttribute('aria-pressed', ui.ripple ? 'true' : 'false'); }; show();
      rb.addEventListener('click', () => { ui.ripple = !ui.ripple; try { localStorage.setItem('3nps-sing-ripple', ui.ripple ? '1' : '0'); } catch (e) {} show(); }); }
    btn.addEventListener('click', () => { ui.open = !ui.open; $('sgCard').hidden = !ui.open; btn.classList.toggle('active', ui.open); edSig = ''; if (!ui.open) stopTap(); });
    bindLane(); bindFocus(); bindEditor();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // ---- Texterkennung (v64): Whisper im Hintergrund-Worker (asr/worker.js), Ergebnis als Wörter mit Schlagzeit ----
  const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }, lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  const MODELS = { base: 'Xenova/whisper-base', tiny: 'Xenova/whisper-tiny' };
  const rec = { busy: false, p: 0, msg: '', lang: lsGet('3nps-asr-lang', window.__lang === 'en' ? 'en' : 'de'), model: lsGet('3nps-asr-model', 'base') };
  if (!MODELS[rec.model]) rec.model = 'base';
  // Absturzerkennung: lief beim letzten Mal eine Erkennung und die Seite wurde neu geladen → zu wenig Speicher
  (() => {
    let run = null; try { run = JSON.parse(lsGet('3nps-asr-run', 'null')); } catch (e) {}
    if (!run || Date.now() - run.at > 15 * 60000) { lsSet('3nps-asr-run', null); return; }
    lsSet('3nps-asr-run', null);
    if (run.model === 'base') { rec.model = 'tiny'; lsSet('3nps-asr-model', 'tiny'); rec.msg = T('Die Erkennung hat das iPad überlastet – ich habe auf „Sparsam“ umgestellt. Lade die Datei neu (deine Spuren holst du über „Wiederherstellen“ zurück) und starte die Erkennung nochmal.'); }
    else rec.msg = T('Die Erkennung braucht für dieses Gerät zu viel Speicher. Schließe andere Apps und versuche es nochmal – oder füge den Text ein und klopfe ihn ein.');
    setTimeout(() => { const st = $('loopStatus'); if (st) st.textContent = rec.msg; }, 1500);
  })();
  const say = (m, p) => { rec.msg = m; if (p != null) rec.p = p; edSig = ''; };
  const JUNK = /untertitel|amara\.org|zdf|swr|copyright|thanks for watching|vielen dank (fürs|für's) zuschauen|subtitles by|♪|^\W+$/i;
  function wordsToTok(words, src) {
    const sr = src.sr, out = []; let l = 0, prevE = null, n = 0, lastText = '', rep = 0;
    words.forEach(x => {
      let w = String(x.w || '').replace(/^[„"“»«(]+|[.,!?;:"“”»«)]+$/g, '').trim();
      if (!w || JUNK.test(x.w) || !(x.e >= x.a)) return;
      rep = w.toLowerCase() === lastText ? rep + 1 : 0; lastText = w.toLowerCase(); if (rep >= 3) return;   // hängende Wiederholungen
      if (prevE != null && (x.a - prevE > 0.9 || n >= 10)) { l++; n = 0; }
      const b = f2b(x.a * sr, src.beats); if (b == null || !isFinite(b)) return;
      let sb = snapB(b); const pv = out[out.length - 1]; if (pv && sb < pv.b + 0.25) sb = Math.round((pv.b + 0.25) * 1000) / 1000;   // nie zwei Wörter auf demselben Punkt
      out.push({ w, b: sb, l, a: Math.round(b * 1000) / 1000 }); n++; prevE = x.e;
      if (/[.!?]$/.test(String(x.w).trim()) && n >= 3) { l++; n = 0; prevE = null; }
    });
    // Zeilen lückenlos nummerieren
    const map = {}; let k = 0; out.forEach(t => { if (map[t.l] == null) map[t.l] = k++; t.l = map[t.l]; });
    return out;
  }
  async function toMono16k(x, sr) {
    const n = x.length, ac = new OfflineAudioContext(1, Math.ceil(n / sr * 16000), 16000);
    const buf = ac.createBuffer(x.r && x.r !== x.l ? 2 : 1, n, sr); buf.copyToChannel(x.l, 0); if (x.r && x.r !== x.l) buf.copyToChannel(x.r, 1);
    const s = ac.createBufferSource(); s.buffer = buf; s.channelCount = 1; s.channelCountMode = 'explicit'; s.channelInterpretation = 'speakers';
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    s.connect(hp); hp.connect(lp); lp.connect(ac.destination); s.start();
    const out = (await ac.startRendering()).getChannelData(0);
    let pk = 0; for (let i = 0; i < out.length; i += 4) { const v = Math.abs(out[i]); if (v > pk) pk = v; }
    if (pk > 0.01) { const g = 0.9 / pk; for (let i = 0; i < out.length; i++) out[i] *= g; }
    return out;
  }
  async function recognize(src) {
    if (rec.busy || !src || src.kind !== 'file' || typeof Looper === 'undefined' || !Looper.singAudio) return;
    if (src.tok.length && !confirm(T('Der vorhandene Text und sein Timing werden durch die Erkennung ersetzt. Weiter?'))) return;
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') { say(T('Dieses Gerät kann die Erkennung nicht ausführen.')); return; }
    const x = Looper.singAudio(src.track, 0, Infinity); if (!x) { say(T('Die Audiodatei ist nicht mehr im Speicher – bitte neu laden.')); return; }
    if (Looper.stopAll) Looper.stopAll();
    rec.busy = true; say(T('Sichere die Spuren …'), 0);
    try { if (Looper.autosaveNow) await Looper.autosaveNow(); } catch (e) {}
    lsSet('3nps-asr-run', JSON.stringify({ model: rec.model, at: Date.now() }));
    say(T('Bereite das Audio vor …'), 0);
    let w = null;
    try {
      const audio = await toMono16k(x, x.sr), secs = audio.length / 16000;
      w = new Worker('asr/worker.js', { type: 'module' });
      const t0 = Date.now(); let tick = null;
      const res = await new Promise((resolve, reject) => {
        w.onerror = e => reject(new Error(e.message || 'Worker'));
        w.onmessage = e => {
          const m = e.data;
          if (m.type === 'progress' && m.phase === 'load') say(T(rec.model === 'base' ? 'Lade das Erkennungsmodell (einmalig ca. 100 MB) … ' : 'Lade das Erkennungsmodell (einmalig ca. 65 MB) … ') + Math.round(m.p * 100) + ' %', m.p * 0.3);
          if (m.type === 'status' && m.phase === 'run') {
            const est = Math.max(20, secs * (rec.model === 'base' ? 0.6 : 0.35)), t1 = Date.now();
            say(T('Höre den Text heraus …'), 0.3);
            tick = setInterval(() => { const f = Math.min(0.97, 0.3 + 0.67 * (Date.now() - t1) / 1000 / est); say(T('Höre den Text heraus … ') + Math.round(f * 100) + ' %', f); }, 700);
          }
          if (m.type === 'done') resolve(m); if (m.type === 'error') reject(new Error(m.msg));
        };
        w.postMessage({ type: 'run', audio, model: MODELS[rec.model], lang: rec.lang }, [audio.buffer]);
      }).finally(() => clearInterval(tick));
      const tok = wordsToTok(res.words, src);
      if (!tok.length) { say(T('Kein Gesang erkannt. Ist der Gesang sehr leise, oder ist die Sprache falsch eingestellt?')); }
      else {
        db.f[src.id] = { name: src.name, tok, auto: { lang: rec.lang, at: Date.now(), mode: res.mode } }; src.tok = tok; ui.sel = -1;
        // v72: Feinabgleich – jedes Wort an den nächsten Silbenanfang (± 0,25 s)
        say(T('Lege die Wörter an die Stimme …'), 0.98);
        let al = 0; try { await voiceEnv(src); al = alignIdx(src, tok.map((t, i) => i), 0.25); } catch (x) {}
        db.f[src.id].auto.aligned = al; changed();
        say((al ? al + T(' Wörter an die Stimme angepasst. ') : '') + tok.length + T(' Wörter in ') + (Math.max(0, ...tok.map(t => t.l)) + 1) + T(' Zeilen erkannt (') + Math.round((Date.now() - t0) / 1000) + T(' s). Jetzt ausbessern: Wort antippen → ersetzen, Zeiten ziehen.'), 1);
      }
    } catch (e) {
      say(T('Erkennung fehlgeschlagen: ') + (e && e.message || e));
    } finally { rec.busy = false; if (w) w.terminate(); lsSet('3nps-asr-run', null); edSig = ''; }
  }
  // Übersetzung je Zeile (v63)
  function setTr(src, arr) { const rec = src.kind === 'lied' ? db.l[src.id] : db.f[src.id]; if (!rec) return false; rec.tr = arr; changed(); return true; }
  function getTr(src) { const rec = src && (src.kind === 'lied' ? db.l[src.id] : db.f[src.id]); return rec && rec.tr || []; }
  return { recognize: () => recognize(curSrc), rec: () => Object.assign({}, rec), wordsToTok, tick, tap, tokenize, merge, f2b, b2f, endOf, lines, setTr, getTr, ver: () => ver, focus: k => focus(k), unfocus, prec: () => { const E = envOf(curSrc); return { env: E ? { n: E.e.length, on: E.on.slice(), onB: E.onB.slice() } : null, loop: !!loopP, rate: loopP ? loopP.rate : null, word: !!wordP, tap: tapS ? { n: tapS.n, of: tapS.idx.length } : null, mag: ui.mag, sel: ui.sel }; }, voiceEnv: () => voiceEnv(curSrc), placeB: r => placeB(r, curSrc), undo: () => undoRedo(-1), redo: () => undoRedo(1), loopNow: () => loopP ? loopP.nowB() : (wordP ? wordP.nowB() : null), onTempo: () => onTempo(), addClicks, recheck: () => recheck(), toggleLock: () => toggleLock(), insertAfter: () => insertAfter(), spread, playFrom, source: ci => source(ci), data: () => db, _reload: () => { db = load(); changed(); }, ui: () => ui };
})();
window.Sing = Sing;
