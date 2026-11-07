// v128: „Was spiele ich?“ – Live-Akkorderkennung im Reiter Powerchords (Werkstatt, Kurs Kap. 6/7).
// Eingang: Looper-Eingang (Looper.openInput/inputAnalyser, wie Stimmgerät/Gesang). Eigener AnalyserNode (16384) hängt nur während
// „Zuhören“ am Eingangs-Analyser; Abbau bei Stopp, Reiter-/Bereichswechsel oder wenn die Karte nicht mehr sichtbar ist.
// Erkennung: FFT → Spitzen (parabolisch) → Obertöne abziehen → Chroma + Bass → Vorlagen = dieselben 18 Akkordarten wie der
// Akkord-Baukasten (PcWerk.TY). v133: Anschlag → nach 120 ms vorläufig (blass), nach 170 ms bestätigt (voll); kurze Fenster per Ton-Vorlagen (analyzeShort). chords.js (Datei-Import, im Worker) bleibt unverändert.
(function () {
  const md = x => ((x % 12) + 12) % 12, N = 16384;
  const L0 = s => (window.__lang === 'en' && window.__EN_PCW && window.__EN_PCW[s]) || s;
  const L = s => (window.PcSkin ? PcSkin.btn(L0(s)) : L0(s));
  const fam = n => (n % 12 === 0 ? 'f1' : n === 7 ? 'f5' : n === 3 || n === 4 ? 'f3' : n === 5 ? 'f4' : 'fx');
  // ---------- FFT (radix 2, in-place) ----------
  let win = null, wl = 0, re = null, im = null;
  function fftMag(x, L) {                                   // v133: L < n = nur die ersten L Werte (Hann über L), Rest Nullen
    const n = x.length; L = L || n; if (!re || re.length !== n) { re = new Float64Array(n); im = new Float64Array(n); }
    if (!win || wl !== L) { win = new Float32Array(L); wl = L; for (let i = 0; i < L; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / L); }
    for (let i = 0; i < n; i++) { re[i] = i < L ? x[i] * win[i] : 0; im[i] = 0; }
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
    const m = new Float32Array(n / 2); for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]); return m;
  }
  // ---------- Analyse eines Rahmens ----------
  function analyze(x, sr, L) {
    L = L || x.length; let e = 0; for (let i = 0; i < L; i++) e += x[i] * x[i]; const rms = Math.sqrt(e / L);
    if (rms < 0.002) return { rms, quiet: true };
    const m = fftMag(x, L), bz = sr / x.length, k0 = Math.ceil(70 / bz), k1 = Math.min(m.length - 2, Math.floor(1800 / bz));
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
  // v133: kurze Fenster (Werte seit dem Anschlag, < 0,25 s): die Spitzen tiefer Töne verschmelzen dort. Darum wird das Spektrum
  // als Summe von Ton-Vorlagen E2…C6 erklärt (je 12 Obertöne mit leichter Inharmonie, geformt wie die Hann-Hauptkeule dieses
  // Fensters), nicht-negativ angepasst (multiplikativ, KL, 60 Schritte). Ergebnis: Stärke je Ton → Chroma + tiefster Ton als Bass.
  let DIC = null;
  function dict(sr, n, L) {
    const key = sr + ':' + n + ':' + L; if (DIC && DIC.key === key) return DIC;
    const bz = sr / n, k0 = Math.ceil(65 / bz), k1 = Math.floor(3000 / bz), P0 = 40, P1 = 84, notes = [], R = 2.5 * sr / L;
    const lobe = d => { const x = Math.abs(d) * L / sr; if (x < 1e-6) return 1; if (Math.abs(x - 1) < 1e-6) return 0.5; return Math.abs(Math.sin(Math.PI * x) / (Math.PI * x) / (1 - x * x)); };
    for (let p = P0; p <= P1; p++) { const f0 = 440 * Math.pow(2, (p - 69) / 12), acc = new Map();
      for (let h = 1; h <= 12; h++) { const f = h * f0 * Math.sqrt(1 + 0.0001 * h * h); if (f > 3000) break; const a = 1 / Math.pow(h, 0.8);
        for (let k = Math.max(k0, Math.ceil((f - R) / bz)); k <= Math.min(k1, Math.floor((f + R) / bz)); k++) acc.set(k, (acc.get(k) || 0) + a * lobe(k * bz - f)); }
      let sum = 0; acc.forEach(v => { sum += v; }); const ks = Int32Array.from(acc.keys()), vs = Float32Array.from(acc.values(), v => v / sum); notes.push({ p, ks, vs }); }
    DIC = { key, k0, k1, notes }; return DIC;
  }
  function analyzeShort(x, sr, L) {
    let e = 0; for (let i = 0; i < L; i++) e += x[i] * x[i]; const rms = Math.sqrt(e / L);
    if (rms < 0.002) return { rms, quiet: true };
    const m = fftMag(x, L), D = dict(sr, x.length, L), { k0, k1, notes } = D, nb = k1 - k0 + 1, V = new Float32Array(nb), Y = new Float32Array(nb);
    let vm = 0; for (let k = 0; k < nb; k++) { V[k] = m[k + k0]; if (V[k] > vm) vm = V[k]; } for (let k = 0; k < nb; k++) V[k] = V[k] / vm + 1e-4;
    const H = new Float32Array(notes.length).fill(0.05);
    for (let it = 0; it < 60; it++) {
      Y.fill(1e-9); notes.forEach((q, i) => { const h = H[i]; if (h < 1e-7) return; for (let j = 0; j < q.ks.length; j++) Y[q.ks[j] - k0] += h * q.vs[j]; });
      notes.forEach((q, i) => { let g = 0; for (let j = 0; j < q.ks.length; j++) { const k = q.ks[j] - k0; g += q.vs[j] * V[k] / Y[k]; } H[i] *= g; });
    }
    let hm = 0; H.forEach(v => { if (v > hm) hm = v; }); const ch = new Float64Array(12); let bass = null;
    const ghost = i => [-2, -1, 1, 2].some(d => H[i + d] > H[i] * 2.5);        // Nebenkeule eines starken Nachbartons
    notes.forEach((q, i) => { if (H[i] <= hm * 0.08 || ghost(i)) return; ch[md(q.p)] += H[i]; if (bass == null && H[i] > hm * CFG.bt && q.p <= 64) bass = md(q.p); });
    return { rms, ch, bass, top: hm };
  }
  const PRIOR = { '6': -0.03, 'm6': -0.03, '13': -0.02, '7b5': -0.02, '7s5': -0.02 };   // v131: seltene Arten (Kap. 11: „seltener“) nur bei klarem Signal
  function match(ch, bass) {
    const TY = window.PcWerk ? PcWerk.TY : []; let nrm = 0; for (let i = 0; i < 12; i++) nrm += ch[i] * ch[i]; nrm = Math.sqrt(nrm) || 1;
    const c = Array.from(ch, v => v / nrm), cm = Math.max(...c), res = [];
    TY.forEach(t => { const T = new Float64Array(12); t.req.forEach(n => { T[n % 12] = 1; }); (t.opt || []).forEach(n => { T[n % 12] = 0.6; });
      let tn = 0; for (let i = 0; i < 12; i++) tn += T[i] * T[i]; tn = Math.sqrt(tn);
      for (let r = 0; r < 12; r++) { let s = 0; for (let i = 0; i < 12; i++) s += c[md(r + i)] * T[i]; s /= tn;
        t.req.forEach(n => { if (c[md(r + n)] < cm * 0.12) s -= 0.15; });
        if (r === bass) s += 0.06; s += PRIOR[t.k] || 0; res.push({ t, r, s }); } });
    res.sort((a, b) => b.s - a.s); const b0 = res[0], b1 = res.find(x => x.t !== b0.t || x.r !== b0.r);
    return b0 ? { t: b0.t, r: b0.r, s: b0.s, margin: b0.s - (b1 ? b1.s : 0) } : null;
  }
  function detect(x, sr, L) { const a = L && L < x.length ? analyzeShort(x, sr, L) : analyze(x, sr, L); if (a.quiet) return { rms: a.rms, quiet: true }; const mm = match(a.ch, a.bass); return Object.assign({ rms: a.rms, bass: a.bass }, mm); }
  // ---------- v133: schneller Ablauf – Anschlag erkennen, sofort vorläufig auswerten (blass), dann bestätigen (voll) ----------
  // Jeder Schritt (20 ms) misst nur die Energie der letzten 1024 Werte. Anschlag = Energie > 4 × Ruhepegel der letzten Schritte.
  // Ab 120 ms nach dem Anschlag: Auswertung nur der Werte seit dem Anschlag (Nullen dahinter, Ton-Vorlagen) → vorläufig, nur bei
  // klarem Ergebnis; ab 170 ms bestätigt, wenn das Spitzen-Verfahren über dieselben Werte dasselbe sagt (Messung v133: 85/100/110 ms
  // waren ungenauer; Bestätigung ohne zweite Meinung 97 % statt 99,8 %).
  // Danach alle 120 ms wie bisher, immer nur über Werte seit dem Anschlag; Wechsel ohne neuen Anschlag erst nach 3 gleichen Ergebnissen.
  const CFG = { p1: 0.12, p2: 0.17, th: 0.9, mg: 0.03, bt: 0.5, or: 2.5 }, STEP = 0.12;
  let seg = null;
  const keyOf = r => (r.quiet || !r.t ? '' : r.r + ':' + r.t.k + ':' + r.bass);
  function fsmNew() { return { eh: [], on: -1e12, st: 0, last: -1e12, hist: [], shown: null }; }
  function segDetect(buf, sr, from) { if (from <= 0) return detect(buf, sr); if (!seg || seg.length !== buf.length) seg = new Float32Array(buf.length); seg.set(buf.subarray(from)); return detect(seg, sr, buf.length - from); }
  function second(buf, sr, from) {          // zweite Meinung (Spitzen-Verfahren) über dieselben Werte – direkt nach segDetect aufrufen
    if (from <= 0) return null; const a = analyze(seg, sr, buf.length - from); if (a.quiet) return ''; const m = match(a.ch, a.bass); return m ? m.r + ':' + m.t.k + ':' + a.bass : ''; }
  function emit(st, r, pre, sure) { st.shown = { key: keyOf(r), pre }; return { r, pre, sure }; }
  function proc(st, buf, sr, now) {          // now = Nummer des letzten Werts im Puffer (in Samples) → { r, pre, sure } oder null
    const n = buf.length; let e = 0, er = 0; for (let i = n - 1024; i < n; i++) { const d = buf[i] - buf[i - 1]; e += d * d; er += buf[i] * buf[i]; } e /= 1024; er /= 1024;
    const base = st.eh.length ? Math.min(...st.eh) : e; st.eh.push(e); if (st.eh.length > 4) st.eh.shift();   // Energie der 1. Differenz: betont den Anschlag
    if (er > 3.6e-5 && e > base * CFG.or && now - st.on > 0.12 * sr) {     // Anschlag: genaue Lage per 128er-Blöcken
      const B = 128, from = n - 3072, be = []; let mx = 0;
      for (let k = from; k < n; k += B) { let q = 0; for (let i = k; i < k + B; i++) { const d = buf[i] - buf[i - 1]; q += d * d; } q /= B; be.push(q); if (q > mx) mx = q; }
      let k0 = be.findIndex(v => v > Math.max(base * CFG.or, mx * 0.3)); if (k0 < 0) k0 = be.length - 1;
      st.on = now - n + 1 + from + k0 * B; st.st = 1; st.hist = [];
    }
    const since = now - st.on;
    if (st.st === 1 && since < CFG.p2 * sr) { if (since < CFG.p1 * sr) return null;             // vorläufig: ab 120 ms je Schritt versuchen, bis es klar ist
      const r = segDetect(buf, sr, n - since); if (!r.t || r.s < CFG.th || r.margin < CFG.mg) return null; st.st = 2; return emit(st, r, true, false); }
    if (st.st === 1) st.st = 2;
    if (st.st === 2) { if (since < CFG.p2 * sr) return null; st.st = 3; st.last = now; const r = segDetect(buf, sr, n - since); if (!r.t) return null;
      const k = keyOf(r), sure = r.s > 0.86 && r.margin > 0.03, k2 = second(buf, sr, n - since); st.hist = [{ k, r }];
      return emit(st, r, k2 !== k, sure); }                                  // bestätigt, wenn beide Verfahren dasselbe sagen
    if (now - st.last < STEP * sr) return null; st.last = now;
    const fr = since < n ? n - since : 0, r = segDetect(buf, sr, fr), k = keyOf(r); if (!k) return null;
    if (fr > 0 && second(buf, sr, fr) !== k) { st.hist.push({ k: '?' + k, r }); if (st.hist.length > 4) st.hist.shift(); return null; }
    st.hist.push({ k, r }); if (st.hist.length > 4) st.hist.shift();
    let c = 0; for (let i = st.hist.length - 1; i >= 0 && st.hist[i].k === k; i--) c++;
    const H = st.hist.slice(-c), sure = H.reduce((a, h) => a + h.r.s, 0) / c > 0.86 && Math.min(...H.map(h => h.r.margin)) > 0.03, sh = st.shown;
    if (sh && sh.key === k) return sh.pre && c >= 2 ? emit(st, r, false, sure) : null;
    return c >= (sh && !sh.pre ? 3 : 2) ? emit(st, r, false, sure) : null;
  }
  // Ganzer Ablauf offline über ein Signal (Test/Messung): Schritte wie live, Puffer = letzte N Werte.
  function simulate(x, sr, hop, ph) { const st = fsmNew(), out = [], b = new Float32Array(N), h = Math.round((hop || 0.02) * sr);
    for (let p = h + Math.round((ph || 0) * sr); p <= x.length; p += h) { const a = Math.max(0, p - N); b.fill(0); b.set(x.subarray(a, p), N - (p - a)); const ev = proc(st, b, sr, p - 1); if (ev) out.push({ t: p / sr, name: chordName(ev.r.t, ev.r.r, ev.r.bass), k: ev.r.t.k, r: ev.r.r, bass: ev.r.bass, pre: ev.pre, sure: ev.sure }); }
    return out; }
  // ---------- Anzeige ----------
  const W = window.PcWerk;
  function chordName(t, r, bass) { const rn = PcWerk.rootName(r); let n = PcWerk.cname(t, rn); if (bass != null && bass !== r) n += '/' + PcWerk.spell(rn, md(bass - r)); return n; }
  function tonesOf(t, r) { const rn = PcWerk.rootName(r); return t.req.concat(t.opt || []).map(n => n % 12).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
    .map(n => ({ n, ton: PcWerk.spell(rn, n), lab: (t.nine && t.nine.includes(n)) ? { 1: 'b9', 2: '9', 3: '#9', 5: '11', 9: '13' }[n] : t.k === 'dim7' && n === 9 ? 'bb7' : t.k === '7s5' && n === 8 ? '#5' : PcWerk.IV[n][1], opt: (t.opt || []).includes(n) })); }
  const S = { card: null, an: null, timer: null, opened: false, buf: null, fsm: null, lv: -1, log: [], shown: null, game: null, busy: false };
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
      S.buf = new Float32Array(N); S.fsm = fsmNew(); S.lv = -1; S.shown = null; S.timer = setInterval(tick, 20); paintState('hört zu');
    } finally { S.busy = false; }
  }
  function stop() {
    clearInterval(S.timer); S.timer = null;
    if (S.an) { try { S.ex.disconnect(S.an); } catch (e) {} try { S.an.disconnect(); } catch (e) {} S.an = null; }
    if (S.ex) { try { Looper.releaseAnalyser(); } catch (e) {} S.ex = null; }
    if (S.opened) { try { Looper.closeInput(); } catch (e) {} S.opened = false; }
    S.buf = null; S.fsm = null;
    if (S.card) { paintState('aus'); S.card.querySelectorAll('.pc-lvl i').forEach(i => i.classList.remove('on')); }
  }
  function tick() {
    const c = S.card; if (!c || !c.isConnected || !c.offsetParent || c.closest('details:not([open]), [hidden]') || !S.an) { stop(); return; }   // Karte unsichtbar (Bereich/Kapitel zu, anderer Reiter) → abbauen
    const ctx = S.an.context, sr = ctx.sampleRate; S.an.getFloatTimeDomainData(S.buf);
    const ev = proc(S.fsm, S.buf, sr, Math.round(ctx.currentTime * sr));
    let e = 0; for (let i = N - 2048; i < N; i++) e += S.buf[i] * S.buf[i];
    const lv = Math.max(0, Math.min(5, Math.round((20 * Math.log10(Math.sqrt(e / 2048) + 1e-9) + 60) / 8)));
    if (lv !== S.lv) { S.lv = lv; c.querySelectorAll('.pc-lvl i').forEach((i, k) => i.classList.toggle('on', k < lv)); }
    if (ev) { show(ev.r, ev.sure, ev.pre); S.log.push({ t: performance.now(), name: S.shown.name, pre: ev.pre }); if (S.log.length > 30) S.log.shift(); if (S.game && !ev.pre) judge(ev.r); }
  }
  function show(r, sure, pre) {
    const t = r.t; S.shown = { k: t.k, r: r.r, bass: r.bass, name: chordName(t, r.r, r.bass), sure, pre: !!pre };
    S.card.classList.toggle('pre', !!pre);
    $c('.pc-lname').textContent = S.shown.name;
    $c('.pc-lform').textContent = (t.k === '5' ? 'Powerchord' : t.nm) + ' · ' + L0('Formel') + ' ' + PcWerk.formula(t);
    $c('.pc-ltones').innerHTML = tonesOf(t, r.r).map(x => '<span class="pc-ltone ' + fam(x.n) + (x.opt ? ' opt' : '') + '"><b>' + x.ton + '</b><small>' + x.lab + '</small></span>').join('');
    $c('.pc-lbass').innerHTML = 'Bass: ' + (r.bass != null ? PcWerk.spell(PcWerk.rootName(r.r), md(r.bass - r.r)) + (r.bass !== r.r ? ' (' + L0('Umkehrung') + ')' : '') : '–') + ' · <span class="' + (sure ? 'ok' : 'no') + '">' + L0(pre ? 'vorläufig' : sure ? 'sicher erkannt' : 'unsicher') + '</span>';
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
  window.PcLive = { mount, start, stop, detect, analyze, match, simulate, cfg: o => Object.assign(CFG, o || {}), log: () => S.log.slice(), feedback, chordName, debug: () => ({ listening: !!S.timer, an: !!S.an, ex: !!S.ex, opened: S.opened, shown: S.shown, game: S.game && { k: S.game.t.k, r: S.game.r } }), _game: (k, r) => { S.game = { t: PcWerk.TY.find(x => x.k === k), r, done: false }; if (S.card) S.card.querySelector('.pc-lgame').innerHTML = '<p class="pc-lfb"></p>'; } };
})();
