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
  let db = load(), ui = { open: false, tapping: false, sel: -1, lineFrom: -1, snap: true };
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
        t.b = o.b; used.add(j); return;
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
      return { kind: 'lied', id, rec: db.l[id], title: n.part.name + (n.pass ? ' · ' + (n.pass + 1) + '. Mal' : ''), tok, editable: false,
        toCi: b => b * 1000, fromCi: f => f / 1000, nowB: n.beat, label: b => (Math.floor(b / 4) + 1) + '.' + (Math.floor(b % 4) + 1), maxB: n.beats, beatMs: () => 60000 / (n.bpm || 100) };
    }
    if (ci.track >= 0 && typeof Looper !== 'undefined' && Looper.singSrc) {
      const s = Looper.singSrc(ci.track); if (!s) return { kind: 'none', why: 'stretch' };
      const rec = db.f[s.key] || null;
      const toCi = b => { const f = b2f(b, s.beats); return f == null ? null : f - s.origPos; };
      const fromCi = f => f2b(f + s.origPos, s.beats);
      const label = b => { const f = b2f(b, s.beats), D = s.downs; let i = 0; while (i + 1 < D.length && D[i + 1] <= f + 2) i++; const bb = f2b(D[i] || 0, s.beats); return (i + 1) + '.' + (Math.floor(b - bb + 1e-6) + 1); };
      return { kind: 'file', id: s.key, rec, name: s.name, title: 'Datei „' + s.name + '“', tok: rec ? rec.tok : [], editable: true, toCi, fromCi,
        nowB: s.pos != null ? fromCi(s.pos) : null, label, L: s.L, track: ci.track, beats: s.beats, sr: s.sr, origPos: s.origPos,
        beatMs: b => (b2f(b + 1, s.beats) - b2f(b, s.beats)) / s.sr * 1000 };
    }
    return null;
  }
  const snapB = b => ui.snap ? Math.round(b * 4) / 4 : Math.round(b * 1000) / 1000;
  const endOf = (tok, i) => { const t = tok[i]; for (let j = i + 1; j < tok.length; j++) if (tok[j].b != null) return Math.min(tok[j].b, t.b + 2); return t.b + 1; };

  // ---- Spur unter der Akkordleiste ----
  let laneSig = '', curSrc = null, lastSrc = null, lastCur = -2;
  function tick(ci) {
    const band = $('sgBand'), strip = $('sgStrip'); if (!band) return;
    const live = source(ci);
    if (live && live.kind !== 'none') lastSrc = live;
    // Editor bleibt nach dem Anhalten bei der zuletzt gespielten Quelle (zum Korrigieren in Ruhe)
    const src = live || (lastSrc ? Object.assign({}, lastSrc, { nowB: null }) : null); curSrc = src;
    if (ui.open) paintEditor(src);
    const has = live && live.tok && live.tok.some(t => t.b != null);
    band.hidden = !has; const lineEl = $('sgLine'); if (lineEl) lineEl.hidden = !has;
    if (band.hidden) { laneSig = ''; lineSig = ''; return; }
    const srcL = live;
    const W = parseFloat($('sfStrip').style.width) || $('sfBand').clientWidth;
    const sig = srcL.id + '|' + W + '|' + ci.L + '|' + ver + '|' + (srcL.kind === 'lied' ? srcL.title : '');
    if (sig !== laneSig) {
      laneSig = sig; lastCur = -2;
      strip.style.width = W + 'px';
      const px = f => f / ci.L * W;
      let h = '';
      srcL.tok.forEach((t, i) => {
        if (t.b == null) return;
        const a = srcL.toCi(t.b), e = srcL.toCi(endOf(srcL.tok, i)); if (a == null || a < -1 || a >= ci.L) return;
        h += '<span class="sg-w' + (i === ui.sel ? ' sel' : '') + '" data-i="' + i + '" style="left:' + px(a).toFixed(1) + 'px;min-width:' + Math.max(6, px(Math.min(ci.L, e) - a) - 2).toFixed(1) + 'px">' + esc(t.w) + '</span>';
      });
      strip.innerHTML = h; lineSig = '';
    }
    band.scrollLeft = $('sfBand').scrollLeft;
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
  let ver = 0; const changed = () => { ver++; save(); laneSig = ''; edSig = ''; };

  // Wort im Band ziehen (Timing verschieben)
  function bindLane() {
    const strip = $('sgStrip'); if (!strip || strip._b) return; strip._b = true;
    let drag = null;
    strip.addEventListener('pointerdown', e => {
      const el = e.target.closest('.sg-w'); if (!el || !curSrc) return;
      const i = +el.dataset.i, W = parseFloat(strip.style.width) || 1;
      drag = { i, x0: e.clientX, b0: curSrc.tok[i].b, W, moved: false }; strip.setPointerCapture(e.pointerId); e.preventDefault();
      select(i);
    });
    strip.addEventListener('pointermove', e => {
      if (!drag || !curSrc) return;
      const dx = e.clientX - drag.x0; if (Math.abs(dx) < 3 && !drag.moved) return; drag.moved = true;
      const ci = window.SoloInfo ? SoloInfo() : null; if (!ci) return;
      const f0 = curSrc.toCi(drag.b0), f = f0 + dx / drag.W * ci.L;
      const nb = snapB(curSrc.fromCi(f)); if (nb === curSrc.tok[drag.i].b) return;
      curSrc.tok[drag.i].b = nb; changed();
    });
    const up = () => { drag = null; };
    strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
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
  function status(m) { const el = $('sgStatus'); if (el) el.textContent = m; }

  // ---- Editor ----
  let edSig = '';
  function select(i) { ui.sel = i; edSig = ''; laneSig = ''; }
  function paintEditor(src) {
    const box = $('sgEdit'); if (!box) return;
    const sig = (src ? src.id + '|' + src.tok.length + '|' + ver : 'none') + '|' + ui.sel + '|' + ui.tapping + '|' + ui.lineFrom + '|' + ui.snap;
    if (sig === edSig) return; edSig = sig;
    if (!src) { box.innerHTML = '<p class="caption">Spiel einen Song aus dem Songwriting oder einen Loop aus einer geladenen Datei ab – dann erscheint hier sein Gesangstext.</p>'; return; }
    if (src.kind === 'none') { box.innerHTML = '<p class="caption">Diese Spur wurde ins Tempo des Loops gedehnt – dafür ist kein Gesangstext möglich. Lade die Datei ohne Anpassung.</p>'; return; }
    let h = '<div class="sg-src"><b translate="no">' + esc(src.title) + '</b>' + (src.kind === 'lied' ? '<span class="caption"> · Text kommt aus dem Songwriting (dort ändern)</span>' : '') + '</div>';
    if (src.kind === 'file') h += '<details class="sg-paste"' + (src.tok.length ? '' : ' open') + '><summary>Text einfügen / ersetzen</summary><textarea id="sgText" rows="5" placeholder="Liedtext hier einfügen – eine Zeile pro gesungener Zeile">' + esc(lines(src.tok).map(l => l.map(t => t.w).join(' ')).join('\n')) + '</textarea><button class="toggle-btn" id="sgTake">Übernehmen</button></details>';
    if (src.tok.length) {
      h += '<div class="sg-tools"><button class="toggle-btn sg-tapbtn' + (ui.tapping ? ' active' : '') + '" id="sgTapMode">' + (ui.tapping ? '■ Einklopfen beenden' : '● Einklopfen') + '</button>'
        + '<label class="check"><input type="checkbox" id="sgSnap"' + (ui.snap ? ' checked' : '') + '> Magnet 16tel</label>'
        + '<span class="caption">' + src.tok.filter(t => t.b != null).length + ' von ' + src.tok.length + ' Wörtern mit Zeit</span></div>';
      if (ui.tapping) h += '<button class="sg-tap" id="sgTap">Tippen = nächstes Wort</button>';
      h += '<p class="sg-status" id="sgStatus">' + (ui.tapping ? 'Abspielen und bei jeder Silbe bzw. jedem Wort auf den großen Knopf tippen.' : 'Wort antippen zum Bearbeiten. In der Spur oben kannst du Wörter ziehen.') + '</p>';
      if (ui.sel >= 0 && src.tok[ui.sel]) {
        const t = src.tok[ui.sel];
        h += '<div class="sg-selbar">' + (src.editable ? '<input type="text" id="sgWord" value="' + esc(t.w) + '" aria-label="Wort"><button class="toggle-btn" id="sgRepl">Ersetzen</button>' : '<b translate="no">' + esc(t.w) + '</b>')
          + '<button class="toggle-btn" data-n="-1" aria-label="früher">◀</button><button class="toggle-btn" data-n="1" aria-label="später">▶</button>'
          + (src.editable ? '<button class="toggle-btn" id="sgMerge">Mit nächstem verbinden</button>' : '')
          + '<button class="toggle-btn" id="sgClear">Zeit löschen</button><span class="caption">' + (t.b != null ? 'Takt ' + src.label(t.b) : 'noch ohne Zeit') + '</span></div>';
      }
      h += '<div class="sg-lines">' + lines(src.tok).map((ln, li) => '<div class="sg-line"><button class="sg-lnum" data-l="' + li + '" title="Zeile neu einklopfen">' + (li + 1) + ' ↻</button>'
        + ln.map(t => '<button class="sg-chip' + (t.b == null ? ' none' : '') + (t.i === ui.sel ? ' sel' : '') + '" data-i="' + t.i + '" translate="no">' + esc(t.w) + '<small>' + (t.b != null ? src.label(t.b) : '–') + '</small></button>').join('') + '</div>').join('') + '</div>';
    }
    box.innerHTML = h;
  }
  function lines(tok) { const out = []; tok.forEach((t, i) => { (out[t.l] = out[t.l] || []).push(Object.assign({ i }, t)); }); return out.filter(Boolean); }

  function bindEditor() {
    const box = $('sgEdit'); if (!box || box._b) return; box._b = true;
    box.addEventListener('click', e => {
      const src = curSrc; if (!src) return;
      const b = e.target.closest('button'); if (!b) return;
      const tok = src.tok;
      if (b.id === 'sgTake') {
        const nt = tokenize($('sgText').value); if (!nt.length) return;
        const rec = db.f[src.id] = { name: src.name, tok: merge(tok, nt) }; src.tok = rec.tok; ui.sel = -1; changed(); return;
      }
      if (b.id === 'sgTapMode') { ui.tapping = !ui.tapping; ui.lineFrom = -1; edSig = ''; laneSig = ''; return; }
      if (b.id === 'sgTap') { tap(); return; }
      if (b.classList.contains('sg-chip')) { select(+b.dataset.i); return; }
      if (b.classList.contains('sg-lnum')) {
        const l = +b.dataset.l, ln = lines(tok)[l]; if (!ln) return;
        ln.forEach(t => { tok[t.i].b = null; }); ui.lineFrom = ln[0].l; ui.tapping = true; changed();
        status('Zeile ' + (l + 1) + ' neu: abspielen und tippen.'); return;
      }
      const i = ui.sel, t = tok[i]; if (!t) return;
      if (b.dataset.n) { if (t.b == null) return; t.b = snapB(t.b + (+b.dataset.n) * (ui.snap ? 0.25 : 0.01)); changed(); return; }
      if (b.id === 'sgClear') { t.b = null; changed(); return; }
      if (b.id === 'sgRepl') {
        const v = ($('sgWord').value || '').trim(); if (!v) return;
        const parts = v.split(/\s+/), nb = endOf(tok, i);
        // mehrere Wörter: Teilen – die Zeit verteilt sich gleichmäßig bis zum nächsten Wort
        const add = parts.map((w, k) => ({ w, l: t.l, b: t.b == null ? null : snapB(t.b + (nb - t.b) * k / parts.length) }));
        tok.splice(i, 1, ...add); changed(); return;
      }
      if (b.id === 'sgMerge') { const n = tok[i + 1]; if (!n || n.l !== t.l) return; t.w = t.w + ' ' + n.w; tok.splice(i + 1, 1); changed(); return; }
    });
    box.addEventListener('change', e => { if (e.target.id === 'sgSnap') { ui.snap = e.target.checked; edSig = ''; } });
  }

  function init() {
    const btn = $('sgToggle'); if (!btn) return;
    btn.addEventListener('click', () => { ui.open = !ui.open; $('sgCard').hidden = !ui.open; btn.classList.toggle('active', ui.open); edSig = ''; if (!ui.open) stopTap(); });
    bindLane(); bindEditor();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // Übersetzung je Zeile (v63)
  function setTr(src, arr) { const rec = src.kind === 'lied' ? db.l[src.id] : db.f[src.id]; if (!rec) return false; rec.tr = arr; changed(); return true; }
  function getTr(src) { const rec = src && (src.kind === 'lied' ? db.l[src.id] : db.f[src.id]); return rec && rec.tr || []; }
  return { tick, tap, tokenize, merge, f2b, b2f, endOf, lines, setTr, getTr, ver: () => ver, source: ci => source(ci), data: () => db, _reload: () => { db = load(); changed(); }, ui: () => ui };
})();
window.Sing = Sing;
