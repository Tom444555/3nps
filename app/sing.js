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
  let db = load(), ui = { open: false, tapping: false, sel: -1, lineFrom: -1, snap: true, inline: false, ripple: (() => { try { return localStorage.getItem('3nps-sing-ripple') !== '0'; } catch (e) { return true; } })() };
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
      return { kind: 'lied', id, rec: db.l[id], title: n.part.name + (n.pass ? ' · ' + (n.pass + 1) + '. Mal' : ''), tok, editable: !!n.editable, partId: n.part.id, pass: n.pass, text: n.text,
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
  let laneSig = '', curSrc = null, lastSrc = null, lastCur = -2, syncing = false;
  function tick(ci) {
    const band = $('sgBand'), strip = $('sgStrip'); if (!band) return;
    const live = source(ci);
    if (live && live.kind !== 'none') lastSrc = live;
    // Editor bleibt nach dem Anhalten bei der zuletzt gespielten Quelle (zum Korrigieren in Ruhe)
    const src = live || (lastSrc ? Object.assign({}, lastSrc, { nowB: null }) : null); curSrc = src;
    if (ui.open) paintEditor(src);
    const has = live && live.tok && live.tok.some(t => t.b != null);
    band.hidden = !live || live.kind === 'none'; const lineEl = $('sgLine'); if (lineEl) lineEl.hidden = !has;
    if (band.hidden) { laneSig = ''; lineSig = ''; return; }
    if (lineEl) lineEl.hidden = !has;
    const srcL = live;
    const W = parseFloat($('sfStrip').style.width) || $('sfBand').clientWidth;
    const sig = srcL.id + '|' + W + '|' + ci.L + '|' + ver + '|' + (srcL.kind === 'lied' ? srcL.title : '');
    if (sig !== laneSig && !ui.inline) {
      laneSig = sig; lastCur = -2;
      strip.style.width = W + 'px'; { const hh = $('sfStrip').offsetHeight; if (hh) strip.style.height = hh + 'px'; }
      const px = f => f / ci.L * W;
      let h = '';
      if (!has) h += '<div class="sg-hint">' + esc(srcL.editable ? T('Gesangstext: freie Stelle antippen = Wort einfügen · oder „🎤 Gesangstext“ → erkennen / einfügen / einklopfen') : T('Gesangstext: „🎤 Gesangstext“ → einklopfen')) + '</div>';
      // Raster wie in der Akkordleiste: Takte (kräftig, mit Nummer), Schläge, 16tel (fein) – zum genauen Einrasten
      const downs = ci.downs || [], pts = downs.concat(ci.beats || []).filter(x => x >= 0 && x < ci.L).sort((x, y) => x - y);
      downs.forEach((d, i) => { const e = i + 1 < downs.length ? downs[i + 1] : ci.L; if (i % 2) h += '<div class="sg-barbg" style="left:' + px(d).toFixed(1) + 'px;width:' + px(e - d).toFixed(1) + 'px"></div>'; });
      pts.forEach((x, i) => { const nx = i + 1 < pts.length ? pts[i + 1] : ci.L; for (let k = 1; k < 4; k++) h += '<div class="sg-g16" style="left:' + px(x + (nx - x) * k / 4).toFixed(1) + 'px"></div>'; });
      (ci.beats || []).forEach(x => { h += '<div class="sg-gbeat" style="left:' + px(x).toFixed(1) + 'px"></div>'; });
      downs.forEach((d, i) => { h += '<div class="sg-gbar" style="left:' + px(d).toFixed(1) + 'px"><span>' + (i + 1) + '</span></div>'; });
      // Wörter: auf drei Reihen verteilt, damit sich nichts überdeckt
      const rowEnd = [-1e9, -1e9, -1e9];
      srcL.tok.forEach((t, i) => {
        if (t.b == null) return;
        const a0 = srcL.toCi(t.b), e0 = srcL.toCi(endOf(srcL.tok, i)); if (a0 == null || a0 < -1 || a0 >= ci.L) return;
        const x = px(a0), wTxt = Math.max(px(Math.min(ci.L, e0) - a0) - 2, String(t.w).length * 8.2 + 14);
        let r = rowEnd.findIndex(e => e <= x - 2); if (r < 0) r = rowEnd.indexOf(Math.min(...rowEnd));
        rowEnd[r] = x + wTxt;
        h += '<span class="sg-w r' + r + (i === ui.sel ? ' sel' : '') + '" data-i="' + i + '" style="left:' + x.toFixed(1) + 'px;min-width:' + Math.max(8, px(Math.min(ci.L, e0) - a0) - 2).toFixed(1) + 'px">' + esc(t.w) + '</span>';
      });
      h += '<div class="sg-snap" id="sgSnapLine" hidden><span></span></div><div class="sg-ph" id="sgPh"></div>';
      strip.innerHTML = h; lineSig = '';
    }
    if (!ui.inline && Math.abs(band.scrollLeft - $('sfBand').scrollLeft) > 1) { syncing = true; band.scrollLeft = $('sfBand').scrollLeft; }
    { const ph = $('sgPh'), sp = $('sfPh'); if (ph && sp) { const tr = sp.style.transform, dsp = sp.style.display; if (ph.style.transform !== tr) ph.style.transform = tr; if (ph.style.display !== dsp) ph.style.display = dsp; } }
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
    const strip = $('sgStrip'), band = $('sgBand'); if (!strip || strip._b) return; strip._b = true;
    // Spur und Akkordleiste scrollen gemeinsam (in beide Richtungen)
    band.addEventListener('scroll', () => { if (syncing) { syncing = false; return; } const sb = $('sfBand'); if (Math.abs(sb.scrollLeft - band.scrollLeft) > 1) sb.scrollLeft = band.scrollLeft; });
    let drag = null;
    const ciNow = () => window.SoloInfo ? SoloInfo() : null;
    const posB = (clientX, ci) => { const r = strip.getBoundingClientRect(), W = parseFloat(strip.style.width) || r.width; return curSrc.fromCi((clientX - r.left) / W * ci.L); };
    const guide = (nb, ci) => {
      const g = $('sgSnapLine'); if (!g) return;
      if (nb == null) { g.hidden = true; return; }
      const W = parseFloat(strip.style.width) || 1; g.hidden = false; g.style.left = (curSrc.toCi(nb) / ci.L * W).toFixed(1) + 'px';
      g.firstChild.textContent = T('Takt ') + curSrc.label(nb);
    };
    strip.addEventListener('pointerdown', e => {
      if (!curSrc || ui.inline || e.target.closest('.sg-inline')) return;
      const el = e.target.closest('.sg-w');
      const di = el ? +el.dataset.i : -1, tk = curSrc.tok;
      // Rest mitziehen: alle folgenden Wörter wandern mit (Abstände bleiben); nicht über das Wort davor hinaus
      let prevB = -Infinity; for (let j = di - 1; j >= 0; j--) if (tk[j].b != null) { prevB = tk[j].b; break; }
      drag = { i: di, x0: e.clientX, y0: e.clientY, b0: el ? tk[di].b : null, moved: false, pid: e.pointerId,
        rip: el && ui.ripple ? tk.map((t, j) => j >= di && t.b != null ? t.b : null) : null, prevB };
      if (el) { strip.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    strip.addEventListener('pointermove', e => {
      if (!drag || drag.i < 0 || !curSrc) return;
      const dx = e.clientX - drag.x0; if (Math.abs(dx) < 4 && !drag.moved) return;
      if (!drag.moved) { drag.moved = true; select(drag.i); }
      const ci = ciNow(); if (!ci) return;
      const W = parseFloat(strip.style.width) || 1, f = curSrc.toCi(drag.b0) + dx / W * ci.L;
      let nb = snapB(curSrc.fromCi(f));
      if (drag.rip && nb < drag.prevB) nb = drag.prevB;
      guide(nb, ci);
      if (nb === curSrc.tok[drag.i].b) return;
      if (drag.rip) { const d = nb - drag.b0; drag.rip.forEach((b0, j) => { if (b0 != null) curSrc.tok[j].b = Math.round((b0 + d) * 1000) / 1000; }); }
      else curSrc.tok[drag.i].b = nb;
      changed();
    });
    const up = e => {
      const d = drag; drag = null; guide(null);
      if (d && d.moved && curSrc && !d.rip) reorder(curSrc.tok, d.i);
      if (!d || !curSrc || d.moved || Math.abs(e.clientX - d.x0) > 6 || Math.abs(e.clientY - d.y0) > 10) return;
      if (d.i >= 0) { select(d.i); if (curSrc.editable) inlineEdit(d.i, null); return; }
      if (curSrc.editable && e.target === strip || (e.target.className && /sg-(g16|gbeat|gbar|barbg)/.test(e.target.className))) { const ci = ciNow(); if (ci) inlineEdit(-1, snapB(posB(e.clientX, ci))); }
    };
    strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', () => { drag = null; guide(null); });
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
  function inlineEdit(i, b) {
    const src = curSrc, strip = $('sgStrip'); if (!src || !strip) return;
    const ci = window.SoloInfo ? SoloInfo() : null; if (!ci) return;
    const tok = src.tok, W = parseFloat(strip.style.width) || 1, at = i >= 0 ? tok[i].b : b; if (at == null) return;
    const el = i >= 0 ? strip.querySelector('.sg-w[data-i="' + i + '"]') : null;
    const box = document.createElement('div'); box.className = 'sg-inline';
    box.style.left = Math.max(0, Math.min(W - 230, src.toCi(at) / ci.L * W)).toFixed(1) + 'px';
    box.style.top = el ? el.offsetTop + 'px' : '34px';
    box.innerHTML = '<input type="text" autocapitalize="off" autocomplete="off" spellcheck="false" value="' + (i >= 0 ? esc(tok[i].w) : '') + '" aria-label="' + T('Wort') + '"><button type="button" class="sg-ok" aria-label="OK">✓</button>' + (i >= 0 ? '<button type="button" class="sg-del" aria-label="' + T('Wort löschen') + '">✕</button>' : '');
    ui.inline = true; strip.appendChild(box);
    const inp = box.querySelector('input'); inp.focus(); inp.select();
    let done = false; const snap = tok.map(t => Object.assign({}, t));
    const close = apply => {
      if (done) return; done = true; ui.inline = false;
      const v = apply === 'del' ? '' : inp.value.trim(); box.remove();
      if (apply) {
        if (i >= 0) {
          if (!v) { tok.splice(i, 1); ui.sel = -1; }
          else if (v !== tok[i].w) { const parts = v.split(/\s+/), t = tok[i], nb = endOf(tok, i); tok.splice(i, 1, ...parts.map((w, k) => ({ w, l: t.l, b: t.b == null ? null : snapB(t.b + (nb - t.b) * k / parts.length) }))); }
        } else if (v) {
          // Zeile vom Wort davor übernehmen (sonst vom Wort danach), richtig einsortieren
          let k = tok.findIndex(t => t.b != null && t.b > b); if (k < 0) k = tok.length;
          const l = k > 0 ? tok[k - 1].l : tok[k] ? tok[k].l : 0;
          const parts = v.split(/\s+/), step = ui.snap ? 0.5 : 0.25;
          tok.splice(k, 0, ...parts.map((w, j) => ({ w, l, b: snapB(b + j * step) }))); ui.sel = k;
        }
        changed();
        if (!persist(src)) { const fresh = tokenize(src.text); src.tok.splice(0, src.tok.length, ...merge(snap, fresh)); changed(); }
      }
      laneSig = ''; edSig = '';
    };
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
  function status(m) { const el = $('sgStatus'); if (el) el.textContent = m; }

  // ---- Editor ----
  let edSig = '';
  function select(i) { ui.sel = i; edSig = ''; laneSig = ''; }
  function paintEditor(src) {
    const box = $('sgEdit'); if (!box) return;
    const sig = (src ? src.id + '|' + src.tok.length + '|' + ver : 'none') + '|' + rec.busy + '|' + rec.msg + '|' + Math.round((rec.p || 0) * 50) + '|' + ui.sel + '|' + ui.tapping + '|' + ui.lineFrom + '|' + ui.snap;
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
      if (b.id === 'sgAuto') { recognize(src); return; }
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
      if (b.dataset.n) {
        if (t.b == null) return; const d = (+b.dataset.n) * (ui.snap ? 0.25 : 0.01);
        if (ui.ripple) { let pv = -Infinity; for (let j = i - 1; j >= 0; j--) if (tok[j].b != null) { pv = tok[j].b; break; } if (t.b + d < pv) return; for (let j = i; j < tok.length; j++) if (tok[j].b != null) tok[j].b = Math.round((tok[j].b + d) * 1000) / 1000; }
        else t.b = snapB(t.b + d);
        changed(); return;
      }
      if (b.id === 'sgClear') { t.b = null; changed(); return; }
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
    bindLane(); bindEditor();
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
      out.push({ w, b: snapB(b), l }); n++; prevE = x.e;
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
        db.f[src.id] = { name: src.name, tok, auto: { lang: rec.lang, at: Date.now(), mode: res.mode } }; src.tok = tok; ui.sel = -1; changed();
        say(tok.length + T(' Wörter in ') + (Math.max(0, ...tok.map(t => t.l)) + 1) + T(' Zeilen erkannt (') + Math.round((Date.now() - t0) / 1000) + T(' s). Jetzt ausbessern: Wort antippen → ersetzen, Zeiten ziehen.'), 1);
      }
    } catch (e) {
      say(T('Erkennung fehlgeschlagen: ') + (e && e.message || e));
    } finally { rec.busy = false; if (w) w.terminate(); lsSet('3nps-asr-run', null); edSig = ''; }
  }
  // Übersetzung je Zeile (v63)
  function setTr(src, arr) { const rec = src.kind === 'lied' ? db.l[src.id] : db.f[src.id]; if (!rec) return false; rec.tr = arr; changed(); return true; }
  function getTr(src) { const rec = src && (src.kind === 'lied' ? db.l[src.id] : db.f[src.id]); return rec && rec.tr || []; }
  return { recognize: () => recognize(curSrc), rec: () => Object.assign({}, rec), wordsToTok, tick, tap, tokenize, merge, f2b, b2f, endOf, lines, setTr, getTr, ver: () => ver, source: ci => source(ci), data: () => db, _reload: () => { db = load(); changed(); }, ui: () => ui };
})();
window.Sing = Sing;
