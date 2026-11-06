// v128: „Was spiele ich?“ – Live-Akkorderkennung im Reiter Powerchords (Werkstatt, Kurs Kap. 6/7).
// Eingang: Looper-Eingang (Looper.openInput/inputAnalyser, wie Stimmgerät/Gesang). Eigener AnalyserNode (16384) hängt nur während
// „Zuhören“ am Eingangs-Analyser; Abbau bei Stopp, Reiter-/Bereichswechsel oder wenn die Karte nicht mehr sichtbar ist.
// Erkennung: FFT → Spitzen (parabolisch) → Obertöne abziehen → Chroma + Bass → Vorlagen = dieselben 18 Akkordarten wie der
// Akkord-Baukasten (PcWerk.TY). Anzeige erst, wenn ~0,4 s dasselbe Ergebnis kommt. chords.js (Datei-Import, im Worker) bleibt unverändert.
(function () {
  const md = x => ((x % 12) + 12) % 12, N = 16384;
  const L0 = s => (window.__lang === 'en' && window.__EN_PCW && window.__EN_PCW[s]) || s;
  const L = s => (window.PcSkin ? PcSkin.btn(L0(s)) : L0(s));
  const fam = n => (n % 12 === 0 ? 'f1' : n === 7 ? 'f5' : n === 3 || n === 4 ? 'f3' : n === 5 ? 'f4' : 'fx');
  // ---------- FFT (radix 2, in-place) ----------
  let win = null, re = null, im = null;
  function fftMag(x) {
    const n = x.length; if (!win || win.length !== n) { win = new Float32Array(n); for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); re = new Float64Array(n); im = new Float64Array(n); }
    for (let i = 0; i < n; i++) { re[i] = x[i] * win[i]; im[i] = 0; }
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
    const m = new Float32Array(n / 2); for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]); return m;
  }
  // ---------- Analyse eines Rahmens ----------
  function analyze(x, sr) {
    let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i]; const rms = Math.sqrt(e / x.length);
    if (rms < 0.002) return { rms, quiet: true };
    const m = fftMag(x), bz = sr / x.length, k0 = Math.ceil(70 / bz), k1 = Math.min(m.length - 2, Math.floor(1800 / bz));
    let mx = 0; for (let k = k0; k <= k1; k++) if (m[k] > mx) mx = m[k];
    const pk = [];
    for (let k = k0; k <= k1; k++) {
      const v = m[k]; if (v < mx * 0.04 || v < m[k - 1] || v < m[k + 1]) continue;
      const a = Math.log(m[k - 1] + 1e-12), b = Math.log(v + 1e-12), c = Math.log(m[k + 1] + 1e-12), d = 0.5 * (a - c) / (a - 2 * b + c || 1e-12);
      const f = (k + d) * bz, p = 69 + 12 * Math.log2(f / 440), r = Math.round(p);
      if (Math.abs(p - r) > 0.35) continue; pk.push({ f, w: v, m: r });
    }
    pk.sort((p, q) => p.f - q.f);
    for (let i = 0; i < pk.length; i++) for (let j = 0; j < i; j++) {                 // Obertöne tieferer Töne abziehen (h = 2…8)
      const r = pk[i].f / pk[j].f, h = Math.round(r); if (h < 2 || h > 8 || Math.abs(r - h) > 0.018 * h) continue;
      pk[i].w = Math.max(0, pk[i].w - pk[j].w * 0.9 / h);
    }
    const ch = new Float64Array(12); let wm = 0; pk.forEach(p => { if (p.w > wm) wm = p.w; });
    pk.forEach(p => { if (p.w > wm * 0.08) ch[md(p.m)] += p.w * (p.f < 140 ? 1.3 : 1); });
    const bass = pk.find(p => p.w > wm * 0.22 && p.f < 340);
    return { rms, ch, bass: bass ? md(bass.m) : null, top: wm };
  }
  function match(ch, bass) {
    const TY = window.PcWerk ? PcWerk.TY : []; let nrm = 0; for (let i = 0; i < 12; i++) nrm += ch[i] * ch[i]; nrm = Math.sqrt(nrm) || 1;
    const c = Array.from(ch, v => v / nrm), cm = Math.max(...c), res = [];
    TY.forEach(t => { const T = new Float64Array(12); t.req.forEach(n => { T[n % 12] = 1; }); (t.opt || []).forEach(n => { T[n % 12] = 0.6; });
      let tn = 0; for (let i = 0; i < 12; i++) tn += T[i] * T[i]; tn = Math.sqrt(tn);
      for (let r = 0; r < 12; r++) { let s = 0; for (let i = 0; i < 12; i++) s += c[md(r + i)] * T[i]; s /= tn;
        t.req.forEach(n => { if (c[md(r + n)] < cm * 0.12) s -= 0.15; });
        if (r === bass) s += 0.06; res.push({ t, r, s }); } });
    res.sort((a, b) => b.s - a.s); const b0 = res[0], b1 = res.find(x => x.t !== b0.t || x.r !== b0.r);
    return b0 ? { t: b0.t, r: b0.r, s: b0.s, margin: b0.s - (b1 ? b1.s : 0) } : null;
  }
  function detect(x, sr) { const a = analyze(x, sr); if (a.quiet) return { rms: a.rms, quiet: true }; const mm = match(a.ch, a.bass); return Object.assign({ rms: a.rms, bass: a.bass }, mm); }
  // ---------- Anzeige ----------
  const W = window.PcWerk;
  function chordName(t, r, bass) { const rn = PcWerk.rootName(r); let n = PcWerk.cname(t, rn); if (bass != null && bass !== r) n += '/' + PcWerk.spell(rn, md(bass - r)); return n; }
  function tonesOf(t, r) { const rn = PcWerk.rootName(r); return t.req.concat(t.opt || []).map(n => n % 12).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
    .map(n => ({ n, ton: PcWerk.spell(rn, n), lab: (t.nine && t.nine.includes(n)) ? { 2: '9', 5: '11' }[n] : t.k === 'dim7' && n === 9 ? 'bb7' : PcWerk.IV[n][1], opt: (t.opt || []).includes(n) })); }
  const S = { card: null, an: null, timer: null, opened: false, buf: null, hist: [], shown: null, game: null, busy: false };
  function cardHtml() {
    return '<div class="pc-live"><div class="pc-row pc-lhead"><h4>' + L0('Was spiele ich?') + '</h4><span class="pc-lvl" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="pc-lst">' + L0('aus') + '</span></div>' +
      '<div class="pc-lname" translate="no">–</div><div class="pc-lform" translate="no"></div><div class="pc-ltones" translate="no"></div><div class="pc-lbass" translate="no"></div>' +
      '<div class="pc-row"><button class="toggle-btn active" data-l="listen">' + L('Zuhören') + '</button><button class="toggle-btn" data-l="game">' + L('Spiel den Akkord') + '</button></div>' +
      '<div class="pc-lgame" translate="no"></div></div>';
  }
  function mount(host) {
    host.innerHTML = cardHtml(); const c = host.firstChild;
    c.addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; e.stopPropagation();
      if (b.dataset.l === 'listen') { if (S.timer && S.card === c) stop(); else start(c); }
      if (b.dataset.l === 'game') newGame(c); });
    return c;
  }
  const $c = s => S.card && S.card.querySelector(s);
  function paintState(txt) { const e = $c('.pc-lst'); if (e) e.textContent = L0(txt); const b = $c('[data-l=listen]'); if (b) b.innerHTML = L(S.timer ? 'Stopp' : 'Zuhören'); }
  async function start(card) {
    if (S.busy) return; if (S.timer) stop(); S.card = card; S.busy = true;
    try {
      if (typeof Looper === 'undefined' || !Looper.openInput) { paintState('kein Eingang'); return; }
      let ex = Looper.inputAnalyser(); if (!ex) { const ok = await Looper.openInput(); if (!ok) { paintState('kein Zugriff auf den Eingang'); return; } S.opened = true; ex = Looper.inputAnalyser(); }
      if (!ex) { paintState('kein Eingang'); return; }
      S.ex = ex; S.an = ex.context.createAnalyser(); S.an.fftSize = N; S.an.smoothingTimeConstant = 0; ex.connect(S.an);
      S.buf = new Float32Array(N); S.hist = []; S.shown = null; S.timer = setInterval(tick, 120); paintState('hört zu');
    } finally { S.busy = false; }
  }
  function stop() {
    clearInterval(S.timer); S.timer = null;
    if (S.an) { try { S.ex.disconnect(S.an); } catch (e) {} try { S.an.disconnect(); } catch (e) {} S.an = null; }
    if (S.ex) { try { Looper.releaseAnalyser(); } catch (e) {} S.ex = null; }
    if (S.opened) { try { Looper.closeInput(); } catch (e) {} S.opened = false; }
    S.buf = null; S.hist = [];
    if (S.card) { paintState('aus'); S.card.querySelectorAll('.pc-lvl i').forEach(i => i.classList.remove('on')); }
  }
  function tick() {
    const c = S.card; if (!c || !c.isConnected || !c.offsetParent || c.closest('details:not([open]), [hidden]') || !S.an) { stop(); return; }   // Karte unsichtbar (Bereich/Kapitel zu, anderer Reiter) → abbauen
    S.an.getFloatTimeDomainData(S.buf); const r = detect(S.buf, S.an.context.sampleRate);
    const lv = Math.max(0, Math.min(5, Math.round((20 * Math.log10(r.rms + 1e-9) + 60) / 8)));
    c.querySelectorAll('.pc-lvl i').forEach((i, k) => i.classList.toggle('on', k < lv));
    const key = r.quiet || !r.t ? '' : r.r + ':' + r.t.k + ':' + r.bass;
    S.hist.push({ key, r }); if (S.hist.length > 4) S.hist.shift();
    if (key && S.hist.length === 4 && S.hist.every(h => h.key === key)) {   // ~0,4 s stabil
      const avg = S.hist.reduce((a, h) => a + h.r.s, 0) / 4, mg = Math.min(...S.hist.map(h => h.r.margin)), sure = avg > 0.86 && mg > 0.03;
      show(r, sure); if (S.game) judge(r);
    }
  }
  function show(r, sure) {
    const t = r.t; S.shown = { k: t.k, r: r.r, bass: r.bass, name: chordName(t, r.r, r.bass), sure };
    $c('.pc-lname').textContent = S.shown.name;
    $c('.pc-lform').textContent = (t.k === '5' ? 'Powerchord' : t.nm) + ' · ' + L0('Formel') + ' ' + PcWerk.formula(t);
    $c('.pc-ltones').innerHTML = tonesOf(t, r.r).map(x => '<span class="pc-ltone ' + fam(x.n) + (x.opt ? ' opt' : '') + '"><b>' + x.ton + '</b><small>' + x.lab + '</small></span>').join('');
    $c('.pc-lbass').innerHTML = 'Bass: ' + (r.bass != null ? PcWerk.spell(PcWerk.rootName(r.r), md(r.bass - r.r)) + (r.bass !== r.r ? ' (' + L0('Umkehrung') + ')' : '') : '–') + ' · <span class="' + (sure ? 'ok' : 'no') + '">' + L0(sure ? 'sicher erkannt' : 'unsicher') + '</span>';
  }
  // ---------- Übung „Spiel den Akkord“ ----------
  const GAME = ['5', 'dur', 'moll', 'sus2', 'sus4', '7', 'maj7', 'm7', 'add9', 'm7b5'], ROOTS = [0, 2, 4, 5, 7, 9, 11];
  function newGame(card) {
    const t = PcWerk.TY.find(x => x.k === GAME[Math.floor(Math.random() * GAME.length)]), r = ROOTS[Math.floor(Math.random() * ROOTS.length)];
    S.game = { t, r, done: false }; if (!S.timer || S.card !== card) start(card); else S.card = card;
    card.querySelector('.pc-lgame').innerHTML = '<p class="pc-lgt">' + L0('Spiel') + ': <b>' + PcWerk.cname(t, PcWerk.rootName(r)) + '</b> <span class="caption">(' + PcWerk.formula(t) + ')</span></p><p class="pc-lfb"></p>';
  }
  function feedback(target, got) {
    const tr = target.r, T = new Set(target.t.req.map(n => n % 12)), D = new Set(got.t.req.concat(got.t.opt || []).map(n => md(got.r + n - tr)));
    if (got.r === tr && got.t.k === target.t.k) return { ok: true, txt: '✓ Richtig! ' + PcWerk.cname(target.t, PcWerk.rootName(tr)) };
    const lab = n => PcWerk.IV[n][1], miss = [...T].filter(n => !D.has(n) && !(target.t.opt || []).includes(n)), ext = [...D].filter(n => !T.has(n) && !(target.t.opt || []).includes(n));
    let txt;
    if ((miss.includes(3) || miss.includes(4)) && !ext.some(n => n === 3 || n === 4)) txt = 'Terz fehlt';
    else if (miss.length === 1 && ext.length === 1) txt = lab(ext[0]) + ' statt ' + lab(miss[0]);
    else { const p = []; if (miss.length) p.push(miss.map(lab).join(', ') + (miss.length > 1 ? ' fehlen' : ' fehlt')); if (ext.length) p.push(ext.map(lab).join(', ') + ' zu viel'); txt = p.join(' · ') || 'anderer Akkord'; }
    if (!D.has(0)) txt = 'Grundton ' + PcWerk.rootName(tr) + ' fehlt' + (txt ? ' · ' + txt : '');
    return { ok: false, txt: '✗ ' + txt + ' (erkannt: ' + chordName(got.t, got.r, got.bass) + ')' };
  }
  function judge(r) { const g = S.game; if (!g || g.done) return; const f = feedback(g, r); const e = $c('.pc-lfb'); if (e) { e.textContent = f.txt; e.className = 'pc-lfb ' + (f.ok ? 'ok' : 'no'); } if (f.ok) g.done = true; }
  document.addEventListener('tabchange', e => { if (e.detail !== 'power' && S.timer) stop(); });
  window.PcLive = { mount, start, stop, detect, analyze, match, feedback, chordName, debug: () => ({ listening: !!S.timer, an: !!S.an, ex: !!S.ex, opened: S.opened, shown: S.shown, game: S.game && { k: S.game.t.k, r: S.game.r } }), _game: (k, r) => { S.game = { t: PcWerk.TY.find(x => x.k === k), r, done: false }; if (S.card) S.card.querySelector('.pc-lgame').innerHTML = '<p class="pc-lfb"></p>'; } };
})();
