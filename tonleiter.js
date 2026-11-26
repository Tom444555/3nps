/* ---------- v158: Tonleiter-Trainer (Lernen › Tonleiter-Trainer) ----------
   Wird erst beim ersten Öffnen der Seite geladen (lernen.js lädt tonleiter.js/.css und den Übezeit-Stil uebezeit-ansicht.css).
   Wiederverwendet: buildPattern() (3nps-Lagen aus dem Grundprogramm, Fingersatz dort), MODES/NOTES, spellPc/modeName (Schreibweise),
   ensureAudio/ensureMasterBus/vEnd (Klick wie clickSound, aber zeitgenau auf der Audio-Uhr), AppDB „sessions“ + refreshLog (Übungslog),
   Uebezeit.load/on/setTopic (Hinweis „Üben einschalten“), Looper.running + Rhythm.nextBarTime (Tempo-Sperre bei laufendem Loop),
   Stil der Seite „Übezeit“ (Karten, Kennzahlen, Verlauf im Börsenkurs-Stil).
   Pentatonik/Blues: 5 Lagen (2 Töne je Saite, Blue Note ♭5 auf der Saite der Quarte), Dur/Moll/Kirchentonleitern: 7 Lagen 3nps.
   Speicher localStorage „3nps-tonleiter“ { v: 1, s: Auswahl, t: Tempo-Treppe, b: { schlüssel: [bpm, ts_s] }, h: [[ts_s, schlüssel, bpm], …] }
   (schlüssel = familie.grundton.lage.übung). Nichts läuft, solange die Seite zu ist: Schließen/Verlassen stoppt und schreibt das Übungslog. */
window.Tonleiter = (() => {
  const KEY = '3nps-tonleiter', $ = id => document.getElementById(id);
  const TT = s => (typeof T === 'function' ? T(s) : s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = x => ((x % 12) + 12) % 12, OPEN = [40, 45, 50, 55, 59, 64];
  // Familien: id, Name, Intervalle, Art (p = Pentatonik 5 Lagen, b = Blues, 3 = 3nps 7 Lagen), Modus-Schlüssel in MODES
  const FAM = [
    ['pmin', 'Moll-Pentatonik', [0, 3, 5, 7, 10], 'p'], ['pmaj', 'Dur-Pentatonik', [0, 2, 4, 7, 9], 'p'], ['blues', 'Blues', [0, 3, 5, 7, 10], 'b'],
    ['ion', 'Dur (Ionisch)', 0, '3', 'Ionisch (Dur)'], ['dor', 'Dorisch', 0, '3', 'Dorisch'], ['phr', 'Phrygisch', 0, '3', 'Phrygisch'], ['lyd', 'Lydisch', 0, '3', 'Lydisch'],
    ['mix', 'Mixolydisch', 0, '3', 'Mixolydisch'], ['aeo', 'Moll (Äolisch)', 0, '3', 'Äolisch (Moll)'], ['loc', 'Lokrisch', 0, '3', 'Lokrisch']];
  const fam = id => FAM.find(f => f[0] === id) || FAM[0];
  const ivOf = f => (f[3] === '3' ? MODES[f[4]] : f[2]);
  const nLagen = f => (f[3] === '3' ? 7 : 5);
  const FORMS = [['ud', 'Auf und ab', 1], ['s3', '3er-Gruppen', 3], ['s4', '4er-Gruppen', 4], ['t', 'Terzen', 2]];
  const NV = [[1, 'Viertel'], [2, 'Achtel'], [3, 'Triolen'], [4, 'Sechzehntel']];
  const STEPS = [2, 4, 5, 8], AUTO = [0, 2, 4, 8], AHEAD = 0.12;
  const MODE_OFF = { ion: 0, dor: 2, phr: 4, lyd: 5, mix: 7, aeo: 9, loc: 11 };

  /* ---------- Muster (reine Rechnung, im Test gegen Handtabellen geprüft) ---------- */
  // 2 Töne je Saite aus aufeinanderfolgenden Pentatonik-Tönen; Lage k beginnt mit der k-ten Stufe auf der tiefen E-Saite (Bund 0–11).
  function boxPattern(root, iv, pos, blue) {
    const offs = [];
    for (let k = 0; k < 5; k++) { const i = (pos + k) % 5; offs.push(iv[i] + (i < pos ? 12 : 0)); }
    const a = OPEN[0] + md(root + offs[0] - OPEN[0]), seq = [];
    for (let i = 0; i < 12; i++) seq.push(a + offs[i % 5] - offs[0] + 12 * Math.floor(i / 5));
    const notes = [];
    for (let s = 0; s < 6; s++) [seq[2 * s], seq[2 * s + 1]].forEach(p => {
      notes.push({ string: s, fret: p - OPEN[s], pitch: p });
      if (blue && md(p - root) === 5) notes.push({ string: s, fret: p + 1 - OPEN[s], pitch: p + 1, blue: true });   // ♭5 direkt nach der Quarte, gleiche Saite
    });
    if (notes.some(n => n.fret < 0)) notes.forEach(n => { n.fret += 12; n.pitch += 12; });   // Lage reicht unter den Sattel → eine Oktave höher
    // Fingersatz: liegt die Lage in 4 Bünden → ein Finger je Bund; sonst je Saite (tiefer Ton 1, Abstand 2 → 3, 3 → 4)
    const fr = notes.map(n => n.fret).filter(f => f > 0), lo = Math.min(...fr), hi = Math.max(...fr);
    notes.forEach(n => {
      if (n.fret === 0) { n.finger = 0; return; }
      if (hi - lo <= 3) { n.finger = n.fret - lo + 1; return; }
      const row = notes.filter(m => m.string === n.string && m.fret > 0), f0 = Math.min(...row.map(m => m.fret));
      n.finger = Math.min(4, n.fret - f0 === 0 ? 1 : n.fret - f0 === 1 ? 2 : n.fret - f0 === 2 ? 3 : 4);
    });
    return notes;
  }
  function pattern(fid, root, lage) {
    const f = fam(fid), pos = Math.max(0, Math.min(nLagen(f), lage) - 1);
    if (f[3] !== '3') return boxPattern(root, f[2], pos, f[3] === 'b');
    const ns = buildPattern(root, MODES[f[4]], pos).map(n => Object.assign({}, n));
    for (let s = 0; s < 6; s++) { const row = ns.filter(n => n.string === s); if (row.some(n => n.fret === 0)) row.forEach(n => { n.finger = Math.min(4, n.fret); }); }   // offene Lage: ein Finger je Bund
    return ns;
  }
  // Übungsformen als Folge von Indizes in die (aufsteigend sortierten) Töne der Lage; ein Durchgang endet vor dem Neubeginn
  function seq(form, n) {
    const o = [];
    if (form === 's3') { for (let i = 0; i <= n - 3; i++) o.push(i, i + 1, i + 2); for (let i = n - 1; i >= 2; i--) o.push(i, i - 1, i - 2); }
    else if (form === 's4') { for (let i = 0; i <= n - 4; i++) o.push(i, i + 1, i + 2, i + 3); for (let i = n - 1; i >= 3; i--) o.push(i, i - 1, i - 2, i - 3); }
    else if (form === 't') { for (let i = 0; i <= n - 3; i++) o.push(i, i + 2); for (let i = n - 1; i >= 2; i--) o.push(i, i - 2); }
    else { for (let i = 0; i < n; i++) o.push(i); for (let i = n - 2; i >= 1; i--) o.push(i); }
    return o;
  }
  const spellKey = (fid, root) => { const f = fam(fid); return f[3] === '3' ? { pc: md(root - MODE_OFF[fid]), major: true } : { pc: root, major: fid === 'pmaj' }; };
  const FL = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  function nn(pc, fid, root) {
    if (fid === 'blues' && md(pc - root) === 6) return FL[md(pc)];
    return window.spellPc ? spellPc(pc, spellKey(fid, root)) : NOTES[md(pc)];
  }
  const rootName = (fid, root) => nn(root, fid, root);
  const scaleName = (fid, root) => rootName(fid, root) + ' ' + TT(fam(fid)[1]);

  /* ---------- Metronom: Raster auf der Audio-Uhr (zeitgenau), Tonfolge + Vorzähler ---------- */
  // o: { t0, bpm(): Tempo, nv: Töne je Schlag, vz: Schläge Vorzähler }; h: { click(t, betont, vorzähler), note(t, i) } – note darf das Tempo ändern (gilt ab dem nächsten Ton)
  function engine(o, h) {
    let k = 0, t = o.t0;
    function pump(now) {
      while (t < now + AHEAD) {
        const nv = o.nv, cin = o.vz * nv;
        if (k % nv === 0) h.click(t, (k / nv) % 4 === 0, k < cin);
        if (k >= cin) h.note(t, k - cin);
        t += 60 / o.bpm() / nv; k++;
      }
    }
    return { pump, slot: () => k, next: () => t };
  }
  function clickAt(t, accent, cin, ctx, dest) {
    ctx = ctx || audioCtx; const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.value = accent ? 1400 : 900;   // wie clickSound (Technik-Metronom)
    g.gain.setValueAtTime(cin ? 0.14 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g); g.connect(dest || ensureMasterBus()); osc.start(t); osc.stop(t + 0.06); vEnd(osc, [g]);
  }

  /* ---------- Speicher ---------- */
  const DEF = () => ({ v: 1, s: null, t: { a: 60, z: 120, st: 4, n: 0, nv: 2, vz: 1 }, b: {}, h: [] });
  let S = DEF();
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.v === 1) { S = Object.assign(DEF(), d); S.t = Object.assign(DEF().t, d.t || {}); S.b = d.b || {}; S.h = Array.isArray(d.h) ? d.h : []; return; } } catch (e) {}
    S = DEF();
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const kOf = (f, r, l, x) => f + '.' + r + '.' + l + '.' + x;
  function fromHeader() {
    const r = typeof rootSel !== 'undefined' ? NOTES.indexOf(rootSel.value) : 9, m = typeof modeSel !== 'undefined' ? modeSel.value : '';
    const f = FAM.find(x => x[4] === m);
    return { f: f ? f[0] : 'pmin', r: r < 0 ? 9 : r, l: 1, x: 'ud', fg: 0 };
  }

  /* ---------- Zustand ---------- */
  let built = false, sel = null, bpm = 60, run = null, msgT = 0, vr = '3M', vm = 'x';
  const dev = () => window.__dev || 'new';
  const locked = () => !!(typeof Looper !== 'undefined' && Looper.running && Looper.running());
  const lockBpm = () => (parseFloat(($('bpm') || {}).value) || 80) * (window.__tempoMul || 1);
  const curBpm = () => (locked() ? lockBpm() : bpm);
  const lagen = () => (sel.l === 'all' ? Array.from({ length: nLagen(fam(sel.f)) }, (_, i) => i + 1) : [sel.l]);
  const best = (l, x) => S.b[kOf(sel.f, sel.r, l, x || sel.x)] || null;
  function exBest() { const ls = lagen(), v = ls.map(l => best(l)); return v.every(Boolean) ? Math.min(...v.map(q => q[0])) : (ls.length === 1 && v[0] ? v[0][0] : 0); }
  function setSel(p, keepBpm) {
    sel = Object.assign({}, sel, p);
    const f = fam(sel.f); if (sel.l !== 'all') sel.l = Math.max(1, Math.min(nLagen(f), +sel.l || 1));
    S.s = sel; if (!keepBpm) { const b = exBest(); bpm = clampB(b ? Math.min(S.t.z, b) : S.t.a); }
    save();
  }
  const clampB = v => Math.max(30, Math.min(240, Math.round(v)));
  function syncDrums() {   // laufen die Drums (frei), folgen sie dem Trainer-Tempo – wie bei „−/+“
    if (locked() || typeof Rhythm === 'undefined' || !(Rhythm.on && Rhythm.on())) return;
    const r = $('bpm'); if (!r || bpm < +r.min || bpm > +r.max || +r.value === bpm) return;
    r.value = bpm; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function say(t) { const m = $('tlMsg'); if (!m) return; m.textContent = t; clearTimeout(msgT); msgT = setTimeout(() => { if (m.textContent === t) m.textContent = ''; }, 6000); }

  /* ---------- Ablauf ---------- */
  function passOf(lage) { const ns = pattern(sel.f, sel.r, lage); return { lage, ns, q: seq(sel.x, ns.length) }; }
  // Ein Lauf: Raster + Tonfolge + Lagenwechsel + Tempo-Treppe; click(t, betont, vorzähler) spielt (live) oder zeichnet auf (Test mit gefälschter Uhr)
  function makeRun(t0, click) {
    const ls = lagen(), r = { t0, ms: Date.now(), li: 0, ls, p: passOf(ls[0]), start: 0, pass: 0, atTempo: 0, rounds: 0, q: [], cur: -1, max: curBpm(), timer: 0, vis: 0, lk: locked(), log: [] };
    r.eng = engine({ t0, bpm: curBpm, nv: S.t.nv, vz: S.t.vz ? 4 : 0 }, {
      click,
      note: (t, i) => {
        let rel = i - r.start;
        if (rel >= r.p.q.length) {                       // Durchgang zu Ende → nächste Lage / Tempo-Treppe
          r.start = i; rel = 0; r.pass++;
          if (r.ls.length > 1) { r.li = (r.li + 1) % r.ls.length; r.p = passOf(r.ls[r.li]); if (r.li === 0) r.rounds++; } else r.rounds++;
          if (r.li === 0) autoStep(r, t);
        }
        if (rel === 0) r.log.push([t, r.pass, r.p.lage, curBpm(), r.p.q.length]);
        r.q.push([t, r.p, rel, r.pass]); if (r.q.length > 400) r.q.shift(); r.max = Math.max(r.max, curBpm());
      }
    });
    return r;
  }
  function start() {
    if (run) return;
    try { if (typeof isPlaying !== 'undefined' && isPlaying && typeof stopPlayback === 'function') stopPlayback(); } catch (e) {}   // Technik-Metronom nicht doppelt
    ensureAudio();
    let t0 = audioCtx.currentTime + 0.12;
    if (locked() && typeof Rhythm !== 'undefined' && Rhythm.nextBarTime) { try { const nb = Rhythm.nextBarTime(); if (nb > audioCtx.currentTime + 0.05) t0 = nb; } catch (e) {} }
    run = makeRun(t0, (t, acc, cin) => { if (run) clickAt(t, acc, cin); });
    syncDrums();
    run.eng.pump(audioCtx.currentTime);
    run.timer = setInterval(() => { if (run) run.eng.pump(audioCtx.currentTime); }, 25);
    frame(); paintRun(); paintHint();
  }
  // Test: derselbe Ablauf mit gefälschter Uhr (keine Töne, kein Übungslog); liefert Klicks und je Durchgang [t, nr, lage, bpm, töne]
  function sim(sec, step) {
    if (run) stop(true);
    const b0 = bpm, clicks = [], r = makeRun(0, (t, acc, cin) => clicks.push([t, acc ? 1 : 0, cin ? 1 : 0]));
    for (let now = 0; now <= sec; now += step || 0.025) r.eng.pump(now);
    const out = { clicks, passes: r.log, bpm }; bpm = b0; return out;
  }
  // nach N Durchgängen (bei „Alle Lagen“: N Runden) automatisch schneller
  function autoStep(r, t) {
    const n = S.t.n; if (!n || r.lk) return;
    r.atTempo++;
    if (r.atTempo < n || bpm >= S.t.z) return;
    r.atTempo = 0; bpm = clampB(Math.min(S.t.z, bpm + S.t.st)); r.pend = [t, bpm];
  }
  function stop(silent) {
    if (!run) return;
    const r = run; run = null;
    clearInterval(r.timer); cancelAnimationFrame(r.vis); clearTimeout(r.vis);
    const sec = (Date.now() - r.ms) / 1000 - (S.t.vz ? 240 / r.max : 0);
    if (sec >= 5) logRun(r, sec);
    if (!silent) { paintBoard(-1); paintRun(); paintHint(); }
  }
  async function logRun(r, sec) {   // wie eine Metronom-Einheit im Übungslog (zählt im Verlauf; liegt sie in „Üben“, nicht doppelt – Uebezeit.merge)
    const f = fam(sel.f), now = Date.now();
    const e = { id: typeof newId === 'function' ? newId() : now.toString(36), ts: now, dateStr: new Date(now).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      root: rootName(sel.f, sel.r), mode: f[1], position: sel.l === 'all' ? 'alle' : sel.l, pattern: 'Trainer · ' + (FORMS.find(x => x[0] === sel.x) || FORMS[0])[1], bpm: Math.round(r.max), durationSec: Math.round(sec), src: 'tl' };
    window.__tlLast = e;
    try { await AppDB.put('sessions', e); if (typeof refreshLog === 'function') refreshLog(); } catch (err) {}
  }
  function done() {   // „geschafft → schneller“: Bestwert speichern (je Lage), dann eine Stufe schneller
    const v = Math.round(curBpm()), ts = Math.round(Date.now() / 1000);
    lagen().forEach(l => { const k = kOf(sel.f, sel.r, l, sel.x), o = S.b[k]; if (!o || v > o[0]) S.b[k] = [v, ts]; S.h.push([ts, k, v]); });
    if (S.h.length > 3000) S.h.splice(0, S.h.length - 3000);
    let txt = TT('Gespeichert:') + ' ' + v + ' BPM';
    if (!locked()) { if (bpm >= S.t.z) txt += ' · ' + TT('Ziel erreicht!'); else { bpm = clampB(Math.min(S.t.z, bpm + S.t.st)); txt += ' → ' + bpm + ' BPM'; } if (run) run.atTempo = 0; syncDrums(); }
    save(); say(txt); paintRun(); paintProg(); paintVerlauf();
  }
  function slower() {
    if (locked()) { say(TT('Der Looper läuft – das Tempo folgt dem Loop.')); return; }
    bpm = clampB(Math.max(30, bpm - S.t.st)); if (run) run.atTempo = 0; syncDrums(); say(TT('Langsamer:') + ' ' + bpm + ' BPM'); paintRun();
  }

  /* ---------- Anzeige im Takt (nur bei offener Seite; Minimal: nur Text, Altes iPad: ohne Übergänge) ---------- */
  function frame() {
    if (!run) return;
    const now = audioCtx.currentTime, q = run.q; let e = null;
    while (q.length && q[0][0] <= now + 0.01) e = q.shift();
    if (run.pend && run.pend[0] <= now) { const v = run.pend[1]; run.pend = null; say(TT('Schneller:') + ' ' + v + ' BPM'); syncDrums(); paintBpm(); }
    if (e) show(e);
    else if (run.cur < 0) { const st = $('tlStat'); const beat = Math.floor((now - run.t0) * curBpm() / 60); if (st && now >= run.t0) { const tx = TT('Vorzähler') + ' ' + Math.min(4, beat + 1) + ' / 4'; if (st.textContent !== tx) st.textContent = tx; } }
    const d = dev(); run.vis = d === 'new' ? requestAnimationFrame(frame) : setTimeout(frame, d === 'min' ? 200 : 50);
  }
  function show(e) {
    const [, p, rel, pass] = e, r = run;
    if (r.shownLage !== p.lage) { r.shownLage = p.lage; paintBoard(-1, p); paintTitle(p.lage); }
    const idx = p.q[rel]; r.cur = idx;
    if (dev() !== 'min') paintBoard(idx, p);
    const st = $('tlStat'), n = p.ns[idx];
    const tx = TT('Durchgang') + ' ' + (pass + 1) + (r.ls.length > 1 ? ' · ' + TT('Lage') + ' ' + p.lage : '') + ' · ' + (rel + 1) + ' / ' + p.q.length + ' · ' + nn(n.pitch, sel.f, sel.r) + ' (' + TT('Saite') + ' ' + (6 - n.string) + ', ' + TT('Bund') + ' ' + n.fret + ')';
    if (st && st.textContent !== tx) st.textContent = tx;
    paintSeq(p, rel);
  }

  /* ---------- Griffbrett (SVG, groß; Grundton hervorgehoben, Finger oder Tonnamen) ---------- */
  let boardKey = '';
  function paintBoard(active, p) {
    const el = $('tlBoard'); if (!el) return;
    p = p || passOf(run && run.shownLage ? run.shownLage : (sel.l === 'all' ? 1 : sel.l));
    const key = [sel.f, sel.r, p.lage, sel.fg].join('|');
    if (key !== boardKey) { boardKey = key; el.innerHTML = boardSvg(p.ns); }
    const on = el.querySelector('.tl-n.on'); if (on && +on.dataset.i !== active) on.classList.remove('on');
    if (active >= 0) { const n = el.querySelector('.tl-n[data-i="' + active + '"]'); if (n) n.classList.add('on'); }
  }
  function boardSvg(ns) {
    const fr = ns.map(n => n.fret), lo0 = Math.min(...fr), hi0 = Math.max(...fr);
    let lo = Math.max(0, lo0 - 1), hi = Math.max(hi0 + 1, lo + 6); if (lo0 === 0) lo = 0;
    const CW = 78, RH = 46, PL = lo === 0 ? 46 : 22, PT = 24, cols = hi - lo, W = PL + cols * CW + 18, H = PT + 5 * RH + 46;
    const xf = f => PL + (f - lo) * CW, xn = f => (f === 0 ? PL - 24 : xf(f) - CW / 2), ys = s => PT + (5 - s) * RH;
    let g = '<rect class="tl-wood" x="' + PL + '" y="' + (PT - 14) + '" width="' + (cols * CW) + '" height="' + (5 * RH + 28) + '" rx="6"/>';
    [3, 5, 7, 9, 15, 17, 19, 21].forEach(f => { if (f > lo && f <= hi) g += '<circle class="tl-inl" cx="' + (xf(f) - CW / 2) + '" cy="' + (PT + 2.5 * RH) + '" r="7"/>'; });
    if (12 > lo && 12 <= hi) g += '<circle class="tl-inl" cx="' + (xf(12) - CW / 2) + '" cy="' + (PT + 1.5 * RH) + '" r="7"/><circle class="tl-inl" cx="' + (xf(12) - CW / 2) + '" cy="' + (PT + 3.5 * RH) + '" r="7"/>';
    for (let f = lo; f <= hi; f++) g += '<line class="' + (f === 0 ? 'tl-nut' : 'tl-fw') + '" x1="' + xf(f) + '" x2="' + xf(f) + '" y1="' + (PT - 14) + '" y2="' + (PT + 5 * RH + 14) + '"/>';
    for (let s = 0; s < 6; s++) g += '<line class="tl-str" style="stroke-width:' + (2.6 - s * 0.32).toFixed(2) + '" x1="' + (lo === 0 ? PL - 40 : PL) + '" x2="' + (PL + cols * CW) + '" y1="' + ys(s) + '" y2="' + ys(s) + '"/>';
    for (let f = lo + 1; f <= hi; f++) g += '<text class="tl-fn" x="' + (xf(f) - CW / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + f + '</text>';
    ns.forEach((n, i) => {
      const root = md(n.pitch - sel.r) === 0, lab = sel.fg ? (n.finger === 0 ? '0' : String(n.finger)) : nn(n.pitch, sel.f, sel.r);
      g += '<g class="tl-n' + (root ? ' root' : '') + (n.blue ? ' blue' : '') + '" data-i="' + i + '"><circle cx="' + xn(n.fret) + '" cy="' + ys(n.string) + '" r="19"/><text x="' + xn(n.fret) + '" y="' + (ys(n.string) + 6) + '" text-anchor="middle">' + esc(lab) + '</text></g>';
    });
    return '<svg class="tl-svg" viewBox="0 0 ' + W + ' ' + H + '" style="min-width:' + Math.round(W * 0.72) + 'px" role="img" aria-label="' + esc(TT('Griffbrett')) + '">' + g + '</svg>';
  }
  function paintTitle(lage) {
    const el = $('tlCap'); if (!el) return;
    const ns = pattern(sel.f, sel.r, lage), fr = ns.map(n => n.fret), first = ns[0];
    el.textContent = scaleName(sel.f, sel.r) + ' · ' + TT('Lage') + ' ' + lage + (sel.l === 'all' ? ' (' + TT('alle Lagen nacheinander') + ')' : '') + ' · ' + TT('Bund') + ' ' + Math.min(...fr) + '–' + Math.max(...fr)
      + ' · ' + TT('Startton') + ' ' + nn(first.pitch, sel.f, sel.r) + ' · ' + ns.length + ' ' + TT('Töne');
  }
  // Tonfolge: Ausschnitt von 16 Tönen um den aktuellen, Gruppen sichtbar getrennt (feste Höhe, nichts springt)
  function paintSeq(p, rel) {
    const el = $('tlSeq'); if (!el) return;
    p = p || passOf(sel.l === 'all' ? 1 : sel.l); rel = rel == null ? -1 : rel;
    const N = Math.max(6, Math.min(18, Math.floor(((el.clientWidth || 600) - 40) / 44))), gs = (FORMS.find(x => x[0] === sel.x) || FORMS[0])[2], a = Math.max(0, Math.min(p.q.length - N, (rel < 0 ? 0 : rel) - 3)), b = Math.min(p.q.length, a + N);
    let h = a > 0 ? '<span class="tl-dots">…</span>' : '';
    for (let i = a; i < b; i++) h += (gs > 1 && i % gs === 0 && i > a ? '<span class="tl-gap"></span>' : '') + '<span class="tl-t' + (i === rel ? ' on' : '') + (md(p.ns[p.q[i]].pitch - sel.r) === 0 ? ' root' : '') + '">' + esc(nn(p.ns[p.q[i]].pitch, sel.f, sel.r)) + '</span>';
    if (b < p.q.length) h += '<span class="tl-dots">…</span>';
    el.innerHTML = h;
  }

  /* ---------- Seite ---------- */
  const seg = (id, items, cur, attr) => '<div class="seg tl-seg" id="' + id + '" role="group">' + items.map(([v, n]) => '<button type="button" class="toggle-btn' + (String(v) === String(cur) ? ' active' : '') + '" data-' + attr + '="' + v + '" aria-pressed="' + (String(v) === String(cur)) + '">' + esc(TT(n)) + '</button>').join('') + '</div>';
  function build() {
    const root = $('tlRoot'); if (!root || built) return; built = true;
    load(); sel = S.s && fam(S.s.f)[0] === S.s.f ? Object.assign(fromHeader(), S.s) : fromHeader(); setSel({});
    root.innerHTML = '<div class="tl-col tl-colA">'
      + '<div class="card uz-card tl-card tl-selc" id="tlSel"><div class="card-head"><h2>' + esc(TT('Tonleiter-Trainer')) + '</h2><button type="button" class="toggle-btn tl-hdr" id="tlHdr"></button></div><div id="tlSelBody"></div></div>'
      + '<div class="card uz-card tl-card tl-metc" id="tlMet"><div class="card-head"><h2>' + esc(TT('Metronom')) + '</h2></div><div id="tlMetBody"></div></div>'
      + '<div class="card uz-card tl-card tl-vc" id="tlVerlauf"><div class="card-head"><h2>' + esc(TT('Verlauf')) + '</h2></div><div id="tlVl"></div></div></div><div class="tl-col tl-colB">'
      + '<div class="card uz-card tl-card tl-boardc" id="tlBoardCard"><div class="card-head"><h2 class="tl-cap" id="tlCap" translate="no"></h2>' + '<div id="tlFg"></div></div>'
      + '<div class="tl-bwrap"><div id="tlBoard"></div></div><div class="tl-seq" id="tlSeq" translate="no"></div>'
      + '<p class="caption tl-leg"><span class="tl-sw root"></span>' + esc(TT('Grundton')) + ' <span class="tl-sw"></span>' + esc(TT('Ton der Tonleiter')) + ' <span class="tl-sw blue"></span>' + esc(TT('Blue Note')) + ' <span class="tl-sw on"></span>' + esc(TT('Aktueller Ton')) + '</p></div>'
      + '<div class="card uz-card tl-card tl-progc" id="tlProg"><div class="card-head"><h2>' + esc(TT('Fortschritt')) + '</h2></div><div id="tlProgBody"></div></div></div>';
    root.addEventListener('click', onClick);
    root.addEventListener('change', e => { if (e.target.id === 'tlRootSel') { stop(); setSel({ r: +e.target.value }); paintAll(); } });
    paintAll();
  }
  function paintSel() {
    const f = fam(sel.f), N = nLagen(f), el = $('tlSelBody'); if (!el) return;
    const roots = NOTES.map((n, i) => '<option value="' + i + '"' + (i === sel.r ? ' selected' : '') + '>' + esc(nn(i, sel.f, i)) + '</option>').join('');
    el.innerHTML = '<div class="tl-lbl">' + esc(TT('Tonleiter')) + '</div>' + seg('tlFam', FAM.map(x => [x[0], x[1]]), sel.f, 'f')
      + '<div class="tl-row"><label class="tl-rsel"><span class="tl-lbl">' + esc(TT('Grundton')) + '</span><select id="tlRootSel">' + roots + '</select></label>'
      + '<div class="tl-lw"><span class="tl-lbl">' + esc(TT(f[3] === '3' ? 'Lage (3 Töne je Saite)' : 'Lage (Pentatonik-Box)')) + '</span>' + seg('tlLage', Array.from({ length: N }, (_, i) => [i + 1, String(i + 1)]).concat([['all', 'Alle']]), sel.l, 'l') + '</div></div>'
      + '<div class="tl-lbl">' + esc(TT('Übung')) + '</div>' + seg('tlForm', FORMS.map(x => [x[0], x[1]]), sel.x, 'x');
    const hb = $('tlHdr'); if (hb) { const h = fromHeader(); hb.textContent = '↺ ' + (window.modeName ? modeName(rootSel.value, modeSel.value) : rootSel.value + ' ' + modeSel.value); hb.title = TT('Tonart der Kopfleiste übernehmen'); hb.hidden = h.f === sel.f && h.r === sel.r; }
    const fg = $('tlFg'); if (fg) fg.innerHTML = seg('tlFgSeg', [[0, 'Töne'], [1, 'Finger']], sel.fg ? 1 : 0, 'fg');
  }
  function paintBpm() {
    const v = Math.round(curBpm()), el = $('tlBpm'); if (el && el.textContent !== String(v)) el.textContent = v;
    const bar = $('tlRamp'); if (bar) { const a = S.t.a, z = S.t.z; bar.style.width = Math.max(0, Math.min(100, (v - a) / Math.max(1, z - a) * 100)).toFixed(1) + '%'; }
    const sm = $('tlSumTx'); if (sm) { const t = S.t; sm.textContent = TT('Start') + ' ' + t.a + ' · ' + TT('Ziel') + ' ' + t.z + ' · +' + t.st + ' · ' + (t.n ? TT('alle') + ' ' + t.n + ' ' + TT('Durchgänge') : TT('per Knopf')) + ' · ' + TT((NV.find(x => x[0] === t.nv) || NV[1])[1]); }
    const zl = $('tlZiel'); if (zl) zl.textContent = TT('Ziel') + ' ' + S.t.z + ' · ' + TT('Bestwert') + ' ' + (exBest() || '–');
  }
  function paintMet() {
    const el = $('tlMetBody'); if (!el) return; const t = S.t;
    const num = (id, v, l) => '<div class="tl-num"><span class="tl-lbl">' + esc(TT(l)) + '</span><div class="tl-nrow"><button type="button" class="toggle-btn" data-n="' + id + '" data-d="-1" aria-label="' + esc(TT(l)) + ' −">−</button><b id="' + id + '">' + v + '</b><button type="button" class="toggle-btn" data-n="' + id + '" data-d="1" aria-label="' + esc(TT(l)) + ' +">+</button></div></div>';
    el.innerHTML = '<div class="tl-top"><button type="button" class="uz-btn tl-go" id="tlGo" aria-pressed="false"></button>'
      + '<div class="tl-tempo"><div><span class="uz-big" id="tlBpm">' + Math.round(curBpm()) + '</span> <span class="tl-unit">BPM</span></div><div class="tl-rampbar"><i id="tlRamp"></i></div><div class="caption" id="tlZiel"></div></div></div>'
      + '<div class="tl-acts"><button type="button" class="toggle-btn tl-done" id="tlDone">' + esc(TT('geschafft → schneller')) + '</button><button type="button" class="toggle-btn" id="tlSlow">' + esc(TT('zu schnell → langsamer')) + '</button></div>'
      + '<p class="caption tl-stat" id="tlStat" translate="no"></p><p class="caption tl-msg" id="tlMsg" role="status" translate="no"></p>'
      + '<details class="tl-set" id="tlSet"' + (t.op ? ' open' : '') + '><summary class="toggle-btn tl-sum"><span>' + esc(TT('Tempo-Treppe')) + '</span> <span class="caption" id="tlSumTx" translate="no"></span></summary><div class="tl-nums">' + num('tlA', t.a, 'Start') + num('tlZ', t.z, 'Ziel') + '</div>'
      + '<div class="tl-lbl">' + esc(TT('Schritt')) + '</div>' + seg('tlSt', STEPS.map(s => [s, '+' + s]), t.st, 'st')
      + '<div class="tl-lbl">' + esc(TT('Automatisch schneller nach … Durchgängen')) + '</div>' + seg('tlAuto', AUTO.map(n => [n, n ? String(n) : 'aus – per Knopf']), t.n, 'au')
      + '<div class="tl-lbl">' + esc(TT('Töne je Klick')) + '</div>' + seg('tlNv', NV, t.nv, 'nv')
      + '<label class="check tl-vz"><input type="checkbox" id="tlVz"' + (t.vz ? ' checked' : '') + '> ' + esc(TT('Vorzähler (1 Takt)')) + '</label></details>'
      + '<div class="tl-uz" id="tlUz"></div>';
    $('tlVz').addEventListener('change', e => { S.t.vz = e.target.checked ? 1 : 0; save(); paintRun(); });
    $('tlSet').addEventListener('toggle', e => { S.t.op = e.target.open ? 1 : 0; save(); });
    paintRun();
  }
  function paintRun() {
    const b = $('tlGo'); if (!b) return;
    b.textContent = run ? '■ ' + TT('Stopp') : '▶ ' + TT('Start'); b.setAttribute('aria-pressed', run ? 'true' : 'false');
    const lk = locked(); ['tlSlow'].forEach(id => { const x = $(id); if (x) x.disabled = lk; });
    if (!run) { const st = $('tlStat'); if (st) st.textContent = lk ? TT('Der Looper läuft – das Tempo folgt dem Loop.') : TT(S.t.vz ? 'Start antippen – erst 4 Klicks Vorzähler, dann mitspielen.' : 'Start antippen und mitspielen.'); }
    paintBpm();
  }
  function paintHint() {
    const el = $('tlUz'); if (!el || !window.Uebezeit) return;
    const d = Uebezeit.load();
    el.innerHTML = d.run ? '<span class="tl-uzon">● ' + esc(TT('Übezeit läuft – zählt mit')) + '</span>'
      : '<span class="caption">' + esc(TT('Jeder Lauf ab 5 s steht im Übungslog. Für die Übezeit:')) + '</span> <button type="button" class="toggle-btn" id="tlUzOn">' + esc(TT('Üben einschalten')) + '</button>';
  }
  const lv = (v, z) => (!v ? 0 : v >= z ? 3 : v >= z * 0.8 ? 2 : 1);
  function next() {   // schwächste Lage zuerst: nie geübt vor langsam, dann kleinste Lage/erste Übung
    const N = nLagen(fam(sel.f)); let bestC = null;
    for (let l = 1; l <= N; l++) FORMS.forEach(([x], xi) => { const b = best(l, x), v = b ? b[0] / S.t.z : 0; if (!bestC || v < bestC.v - 1e-9) bestC = { l, x, xi, v }; });
    return bestC;
  }
  function paintProg() {
    const el = $('tlProgBody'); if (!el) return;
    const N = nLagen(fam(sel.f)), z = S.t.z; let n = 0, ok = 0, last = 0;
    let h = '<div class="tl-grid" style="grid-template-columns:auto repeat(' + FORMS.length + ',minmax(0,1fr))"><span></span>' + FORMS.map(f => '<span class="tl-gh">' + esc(TT(f[1])) + '</span>').join('');
    for (let l = 1; l <= N; l++) {
      h += '<span class="tl-gl">' + esc(TT('Lage')) + ' ' + l + '</span>';
      FORMS.forEach(([x, nm]) => {
        const b = best(l, x), v = b ? b[0] : 0, c = lv(v, z); if (v) { n++; last = Math.max(last, b[1]); } if (c === 3) ok++;
        const cur = sel.l == l && sel.x === x;
        h += '<button type="button" class="tl-cell lv' + c + (cur ? ' cur' : '') + '" data-gl="' + l + '" data-gx="' + x + '" aria-label="' + esc(TT('Lage') + ' ' + l + ' · ' + TT(nm) + ': ' + (v ? v + ' BPM' : TT('noch nicht geübt'))) + '">' + (v || '–') + '</button>';
      });
    }
    h += '</div>';
    const nx = next(), nxt = nx ? TT('Lage') + ' ' + nx.l + ' · ' + TT(FORMS[nx.xi][1]) + ' – ' + (nx.v ? Math.round(nx.v * z) + ' / ' + z + ' BPM' : TT('noch nicht geübt')) : '';
    const tot = N * FORMS.length, eb = exBest();
    el.innerHTML = '<div class="uz-sums tl-kpi"><div class="uz-sum"><div class="uz-sl">' + esc(TT('Diese Übung')) + '</div><div class="uz-sv">' + (eb ? eb + ' BPM' : '–') + '</div></div>'
      + '<div class="uz-sum"><div class="uz-sl">' + esc(TT('Ziel erreicht')) + '</div><div class="uz-sv">' + ok + ' / ' + tot + '</div></div>'
      + '<div class="uz-sum"><div class="uz-sl">' + esc(TT('Geübt')) + '</div><div class="uz-sv">' + n + ' / ' + tot + '</div></div></div>'
      + '<div class="tl-next"><div><div class="tl-lbl">' + esc(TT('Als Nächstes üben')) + '</div><div class="tl-nx" id="tlNext">' + esc(nxt) + '</div></div>'
      + (nx ? '<button type="button" class="toggle-btn" id="tlNextGo" data-gl="' + nx.l + '" data-gx="' + nx.x + '">' + esc(TT('Das üben')) + '</button>' : '') + '</div>'
      + '<div class="tl-gwrap">' + h + '</div><p class="caption">' + esc(TT('Zahl = höchstes Tempo, das du mit „geschafft“ bestätigt hast. Farbe: grau = noch nicht geübt, orange = unter 80 % vom Ziel, gelb = fast, grün = Ziel erreicht. Antippen wählt die Übung.')) + '</p>';
  }
  /* Verlauf im Börsenkurs-Stil (wie Übezeit/Übe-Verlauf): höchstes „geschafft“-Tempo je Tag, Zeitraum-Knöpfe, Hoch/Tief */
  const RANGES = { '1M': 30, '3M': 91, '1J': 365, all: 0 };
  const dShort = t => new Date(t).toLocaleDateString(window.__lang === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit' });
  function vSeries(now) {
    const pre = sel.f + '.' + sel.r + '.', exact = kOf(sel.f, sel.r, sel.l, sel.x);
    const ev = S.h.filter(e => (vm === 'x' ? (sel.l === 'all' ? e[1].startsWith(pre) && e[1].endsWith('.' + sel.x) : e[1] === exact) : e[1].startsWith(pre)));
    const n = RANGES[vr], a = n ? now - n * 864e5 : (ev.length ? ev[0][0] * 1000 : now);
    const day = {}; ev.forEach(e => { const t = e[0] * 1000; if (t < a) return; const d = new Date(t); d.setHours(0, 0, 0, 0); const k = d.getTime(); day[k] = Math.max(day[k] || 0, e[2]); });
    const before = ev.filter(e => e[0] * 1000 < a).reduce((m, e) => Math.max(m, e[2]), 0);
    return { pts: Object.keys(day).map(Number).sort((x, y) => x - y).map(t => ({ t, v: day[t] })), before, a };
  }
  function vSvg(ps, W) {
    const H = W < 500 ? 170 : 200, PL = 6, PR = 48, PT = 10, PB = 24, vals = ps.map(p => p.v), mn = Math.min(...vals), mx = Math.max(...vals);
    const lo = Math.max(0, mn - Math.max(4, (mx - mn) * 0.15)), hi = mx + Math.max(4, (mx - mn) * 0.15), iw = W - PL - PR, ih = H - PT - PB;
    const t0 = ps[0].t, t1 = ps[ps.length - 1].t, x = t => PL + (t1 === t0 ? iw / 2 : (t - t0) / (t1 - t0) * iw), y = v => PT + ih - (v - lo) / (hi - lo) * ih;
    const line = ps.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
    const area = line + ' L' + x(t1).toFixed(1) + ' ' + (PT + ih) + ' L' + x(t0).toFixed(1) + ' ' + (PT + ih) + ' Z';
    const grid = [lo, (lo + hi) / 2, hi].map((v, i) => '<line class="uz-gl' + (i ? '' : ' base') + '" x1="' + PL + '" x2="' + (W - PR + 4) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="uz-ax" x="' + (W - PR + 8) + '" y="' + (y(v) + 4).toFixed(1) + '">' + Math.round(v) + '</text>').join('');
    const ticks = (t1 === t0 ? [t0] : [t0, t1]).map((t, k) => '<text class="uz-ax" x="' + x(t).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (t1 === t0 ? 'middle' : k ? 'end' : 'start') + '">' + esc(dShort(t)) + '</text>').join('');
    const dots = ps.length <= 40 ? ps.map(p => '<circle class="uz-dot" cx="' + x(p.t).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="2.6"/>').join('') : '', L = ps[ps.length - 1];
    return '<svg class="uz-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(TT('Verlauf des Tempos')) + '">' + grid + '<path class="uz-area" d="' + area + '"/><path class="uz-line" d="' + line + '"/>' + dots + '<circle class="uz-end" cx="' + x(L.t).toFixed(1) + '" cy="' + y(L.v).toFixed(1) + '" r="5"/>' + ticks + '</svg>';
  }
  function paintVerlauf() {
    const el = $('tlVl'); if (!el) return;
    if (dev() === 'min') { el.innerHTML = '<p class="caption">' + esc(TT('Im Profil „Minimal“ ohne Diagramm – die Bestwerte stehen im Raster.')) + '</p>'; return; }
    const r = vSeries(Date.now()), ps = r.pts, has = ps.length > 0, L = has ? ps[ps.length - 1].v : 0, ref = r.before || (has ? ps[0].v : 0), d = L - ref;
    const W = Math.max(260, Math.round((el.clientWidth || 600)));
    const hiP = has ? ps.reduce((a, p) => (p.v > a.v ? p : a)) : null, loP = has ? ps.reduce((a, p) => (p.v < a.v ? p : a)) : null;
    const ch = !has ? '' : (ps.length < 2 && !r.before) ? TT('erster Wert') : (d > 0 ? '▲ +' : d < 0 ? '▼ −' : '± ') + Math.abs(d) + ' BPM ' + TT('im Zeitraum');
    el.innerHTML = '<div class="uz-vtop"><div><div class="uz-big">' + (has ? L + ' BPM' : '–') + '</div><div class="uz-chg ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') + '">' + esc(ch) + '</div>'
      + '<div class="caption">' + esc(TT('Höchstes geschafftes Tempo je Tag') + ' · ' + scaleName(sel.f, sel.r)) + '</div></div>'
      + '<div class="uz-vctl">' + seg('tlVm', [['x', 'Diese Übung'], ['s', 'Ganze Tonleiter']], vm, 'vm') + '</div></div>'
      + '<div class="uz-chart">' + (has ? vSvg(ps, W) : '<p class="pattern-desc uz-empty">' + esc(TT('Noch kein „geschafft“ in diesem Zeitraum.')) + '</p>') + '</div>'
      + '<div class="seg uz-vr" role="group">' + Object.keys(RANGES).map(k => '<button type="button" class="toggle-btn' + (vr === k ? ' active' : '') + '" data-vr="' + k + '">' + esc(k === 'all' ? TT('Alles') : k) + '</button>').join('') + '</div>'
      + '<div class="uz-hl"><span><span class="caption">' + esc(TT('Hoch')) + '</span> <b>' + (hiP ? hiP.v + ' BPM · ' + dShort(hiP.t) : '–') + '</b></span><span><span class="caption">' + esc(TT('Tief')) + '</span> <b>' + (loP ? loP.v + ' BPM · ' + dShort(loP.t) : '–') + '</b></span></div>';
  }
  function paintAll() {
    if (!built) return;
    paintSel(); if (!$('tlGo')) paintMet(); else paintRun();
    boardKey = ''; paintBoard(-1); paintTitle(sel.l === 'all' ? 1 : sel.l); paintSeq(); paintProg(); paintVerlauf(); paintHint();
  }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return; const d = b.dataset;
    if (b.id === 'tlGo') { run ? stop() : start(); return; }
    if (b.id === 'tlDone') { done(); return; }
    if (b.id === 'tlSlow') { slower(); return; }
    if (b.id === 'tlUzOn') { if (window.Uebezeit) { if (!Uebezeit.load().th) Uebezeit.setTopic('tl'); Uebezeit.on(); } paintHint(); return; }
    if (b.id === 'tlHdr') { stop(); const h = fromHeader(); setSel({ f: h.f, r: h.r }); paintAll(); return; }
    if (d.fg != null) { sel.fg = +d.fg; S.s = sel; save(); paintSel(); boardKey = ''; paintBoard(run && run.cur >= 0 && dev() !== 'min' ? run.cur : -1); return; }
    if (d.vr) { vr = d.vr; paintVerlauf(); return; }
    if (d.vm) { vm = d.vm; paintVerlauf(); return; }
    if (d.st) { S.t.st = +d.st; save(); paintMet(); return; }
    if (d.au != null) { S.t.n = +d.au; save(); if (run) run.atTempo = 0; paintMet(); return; }
    if (d.nv) { const was = !!run; stop(); S.t.nv = +d.nv; save(); paintMet(); if (was) start(); return; }
    if (d.n) {
      const k = d.n === 'tlA' ? 'a' : 'z', v = clampB(S.t[k] + (+d.d) * 2);
      if (k === 'a') S.t.a = Math.min(v, S.t.z); else S.t.z = Math.max(v, S.t.a);
      save(); $(d.n).textContent = S.t[k]; if (k === 'a' && !run && !exBest()) bpm = S.t.a; if (k === 'z' && bpm > S.t.z && !run) bpm = S.t.z; paintBpm(); paintProg(); return;
    }
    let p = null;
    if (d.f) p = { f: d.f, l: sel.l === 'all' ? 'all' : Math.min(sel.l, nLagen(fam(d.f))) };
    else if (d.l) p = { l: d.l === 'all' ? 'all' : +d.l };
    else if (d.x) p = { x: d.x };
    else if (d.gl) p = { l: +d.gl, x: d.gx };
    if (p) { const was = !!run; stop(); setSel(p); paintAll(); if (was) start(); if (d.gl) { const c = $('tlBoardCard'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); } }
  }
  function open() { build(); paintRun(); paintHint(); }
  function close() { stop(true); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.addEventListener('tabchange', e => { if (e.detail !== 'tonleiter') close(); else if (built) { paintRun(); paintHint(); } });
  return { open, close, start, stop, done, slower, pattern, seq, engine, boxPattern, nn, sim, clickAt, set: p => { stop(); setSel(p); paintAll(); }, state: () => ({ sel: Object.assign({}, sel), bpm, cur: curBpm(), run: !!run, locked: locked(), S: JSON.parse(JSON.stringify(S)), pass: run ? run.pass : 0 }), built: () => built };
})();
