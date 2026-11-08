// v137: Lernen → „Hör-Training“ (Intervalle auf/ab/zusammen, Akkorde aus dem Kurs-Hör-Training, Tonleitern) mit Ampel und
// gespeicherter Trefferzählung (localStorage „3nps-hoer“, neu) und „Spickzettel“ (Intervalle, Griffformen, Quintenzirkel,
// Akkordsymbole; druckfreundlich). Beides wird erst beim Öffnen gebaut (tabchange „hoer“ / „spick“).
(function () {
  const $ = id => document.getElementById(id), TT = x => (typeof T === 'function' ? T(x) : x);
  const ph = $('panel-hoer'), ps = $('panel-spick'); if (!ph || !ps) return;
  const KEY = '3nps-hoer';
  let S = (function () { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } })();
  S.iv = S.iv || {}; S.ch = S.ch || {}; S.sc = S.sc || {}; S.best = S.best || {}; S.mode = S.mode || 'iv'; S.dir = S.dir || 'up';
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const IV = ['kleine Sekunde', 'große Sekunde', 'kleine Terz', 'große Terz', 'Quarte', 'Tritonus', 'Quinte', 'kleine Sexte', 'große Sexte', 'kleine Septime', 'große Septime', 'Oktave'];
  const CH0 = [['dur', 'Dur', [0, 4, 7]], ['moll', 'Moll', [0, 3, 7]], ['maj7', 'Maj7', [0, 4, 7, 11]], ['7', '7', [0, 4, 7, 10]]];
  const SC = [['dur', 'Dur', [0, 2, 4, 5, 7, 9, 11, 12]], ['moll', 'Moll', [0, 2, 3, 5, 7, 8, 10, 12]], ['pdur', 'Dur-Pentatonik', [0, 2, 4, 7, 9, 12]], ['pmoll', 'Moll-Pentatonik', [0, 3, 5, 7, 10, 12]],
    ['dor', 'Dorisch', [0, 2, 3, 5, 7, 9, 10, 12]], ['phr', 'Phrygisch', [0, 1, 3, 5, 7, 8, 10, 12]], ['lyd', 'Lydisch', [0, 2, 4, 6, 7, 9, 11, 12]], ['mix', 'Mixolydisch', [0, 2, 4, 5, 7, 9, 10, 12]], ['lok', 'Lokrisch', [0, 1, 3, 5, 6, 8, 10, 12]]];
  const chords = () => (window.PcPlan && PcPlan.EAR) || CH0;   // vorhandenes Kurs-Hör-Training (Dur, Moll, sus, Maj7, 7, 9, b9, #9)
  const items = m => m === 'iv' ? IV.map((n, i) => [String(i + 1), n]) : m === 'ch' ? chords().map(x => [x[0], x[1]]) : SC.map(x => [x[0], x[1]]);
  const ampel = st => window.PcPlan ? PcPlan.ampel(st) : (!st || st[1] < 3 ? 'grau' : st[0] / st[1] >= 0.8 ? 'gruen' : st[0] / st[1] >= 0.5 ? 'gelb' : 'rot');
  let Q = null, timers = [];
  const note = m => { if (window.Quinten) Quinten.playNote(m); };
  function stopSound() { timers.forEach(clearTimeout); timers = []; }
  function at(ms, f) { timers.push(setTimeout(f, ms)); }
  function play() {
    if (!Q) return; stopSound(); const q = Q;
    if (q.m === 'iv') { const a = q.base, b = q.base + +q.k; if (q.dir === 'up') { note(a); at(700, () => note(b)); } else if (q.dir === 'down') { note(b); at(700, () => note(a)); } else { note(a); note(b); } }
    else if (q.m === 'ch') { const ms = window.PcPlan && PcPlan.earVoicing ? PcPlan.earVoicing(q.k, q.base) : [q.base - 12].concat(CH0.find(x => x[0] === q.k)[2].map(n => q.base + n)); ms.forEach((m, i) => at(i * 28, () => note(m))); }
    else { SC.find(x => x[0] === q.k)[2].forEach((n, i) => at(i * 320, () => note(q.base + n))); }
  }
  function newTask() {
    const it = items(Q.m); Q.k = it[Math.floor(Math.random() * it.length)][0];
    Q.base = Q.m === 'iv' ? 55 + Math.floor(Math.random() * 10) : Q.m === 'ch' ? 52 + Math.floor(Math.random() * 8) : 52 + Math.floor(Math.random() * 10);
    Q.ans = null; Q.fb = ''; setTimeout(play, 120);
  }
  function draw() {
    const m = S.mode, st = S[m], it = items(m);
    let h = '<div class="hr-amp">' + it.map(([k, n]) => { const s = st[k]; return '<span class="hr-a ' + ampel(s) + '"><i></i><b>' + n + '</b><small>' + (s ? s[0] + '/' + s[1] : '–') + '</small></span>'; }).join('') + '</div>' +
      '<p class="caption">' + TT('Ampel: grün ab 80 %, gelb ab 50 %, rot darunter (ab 3 Versuchen).') + (S.best[m] != null ? ' ' + TT('Beste Runde') + ': ' + S.best[m] + '/10' : '') + '</p>';
    if (!Q) h += '<div class="hr-row"><button class="toggle-btn active" data-hr="start">' + TT('▶ Runde starten') + '</button></div>';
    else {
      h += '<div class="hr-row"><button class="toggle-btn" data-hr="again">' + TT('▶ Nochmal hören') + '</button><b class="hr-cnt">' + TT('Aufgabe') + ' ' + (Q.i + 1) + ' ' + TT('von') + ' 10 · ' + TT('Treffer') + ': ' + Q.hits + '</b></div>' +
        '<div class="hr-row hr-opts">' + it.map(([k, n]) => '<button class="toggle-btn' + (Q.ans != null && k === Q.k ? ' active' : '') + '" data-ha="' + k + '"' + (Q.ans != null ? ' disabled' : '') + '>' + n + '</button>').join('') + '</div>' +
        '<div class="hr-row hr-fbrow"><span class="hr-fb ' + (Q.ans ? 'ok' : Q.ans === false ? 'no' : '') + '">' + (Q.fb || '') + '</span>' + (Q.ans != null ? '<button class="toggle-btn active" data-hr="next">' + (Q.end ? TT('Neue Runde') : TT('Weiter ▶')) + '</button>' : '') + '</div>';
    }
    $('hrBody').innerHTML = h;
    ph.querySelectorAll('[data-hm]').forEach(b => b.classList.toggle('active', b.dataset.hm === m));
    ph.querySelectorAll('[data-hd]').forEach(b => b.classList.toggle('active', b.dataset.hd === S.dir));
    $('hrDir').style.visibility = m === 'iv' ? 'visible' : 'hidden';      // Platz bleibt → nichts springt
  }
  function answer(k) {
    if (!Q || Q.ans != null) return; const ok = k === Q.k, st = S[Q.m], c = st[Q.k] = st[Q.k] || [0, 0];
    c[1]++; if (ok) { c[0]++; Q.hits++; }
    const name = items(Q.m).find(x => x[0] === Q.k)[1];
    Q.ans = ok; Q.fb = (ok ? '✓ ' + TT('Richtig!') + ' ' : '✗ ' + TT('Das war') + ' ') + name + '.';
    if (Q.i === 9) { Q.end = true; S.best[Q.m] = Math.max(S.best[Q.m] || 0, Q.hits); S.last = { m: Q.m, hits: Q.hits, at: Date.now() }; }
    save(); draw();
  }
  let built = false;
  function build() {
    if (built) return; built = true;
    ph.addEventListener('click', e => {
      const hm = e.target.closest('[data-hm]'); if (hm) { setMode(hm.dataset.hm); return; }
      const hd = e.target.closest('[data-hd]'); if (hd) { S.dir = hd.dataset.hd; save(); if (Q && Q.m === 'iv') { Q.dir = S.dir; } draw(); return; }
      const ha = e.target.closest('[data-ha]'); if (ha) { answer(ha.dataset.ha); return; }
      const hr = e.target.closest('[data-hr]'); if (!hr) return; const v = hr.dataset.hr;
      if (v === 'start') { Q = { m: S.mode, dir: S.dir, i: 0, hits: 0 }; newTask(); draw(); }
      else if (v === 'again') play();
      else if (v === 'next') { if (Q.end) Q = { m: S.mode, dir: S.dir, i: 0, hits: 0 }; else Q.i++; newTask(); draw(); }
    });
    draw();
  }
  function setMode(m) { if (!['iv', 'ch', 'sc'].includes(m)) return; S.mode = m; save(); Q = null; stopSound(); if (built) draw(); document.dispatchEvent(new CustomEvent('lernenwo', { detail: { t: 'hoer', m } })); }

  // ---------------- Spickzettel ----------------
  const NN = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const ST = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7', '8'];
  const KEYS = [['C', 'Am', '–'], ['G', 'Em', '1♯'], ['D', 'Bm', '2♯'], ['A', 'F#m', '3♯'], ['E', 'C#m', '4♯'], ['B (H)', 'G#m', '5♯'], ['F# / Gb', 'D#m / Ebm', '6♯ / 6♭'],
    ['Db', 'Bbm', '5♭'], ['Ab', 'Fm', '4♭'], ['Eb', 'Cm', '3♭'], ['Bb', 'Gm', '2♭'], ['F', 'Dm', '1♭']];
  const SYM = [['C', '1 3 5', 'Dur'], ['Cm', '1 b3 5', 'Moll'], ['C5', '1 5', 'Powerchord'], ['Csus2', '1 2 5', ''], ['Csus4', '1 4 5', ''], ['C6', '1 3 5 6', ''], ['Cm6', '1 b3 5 6', ''],
    ['C7', '1 3 5 b7', 'Dominant-7'], ['Cmaj7', '1 3 5 7', 'Major-7 (auch CΔ)'], ['Cm7', '1 b3 5 b7', 'Moll-7'], ['Cm7b5', '1 b3 b5 b7', 'halbvermindert (Cø)'], ['Cdim', '1 b3 b5', 'vermindert (C°)'],
    ['Cdim7', '1 b3 b5 bb7', ''], ['Caug', '1 3 #5', 'übermäßig (C+)'], ['Cadd9', '1 3 5 9', 'ohne 7'], ['C9', '1 3 5 b7 9', ''], ['Cmaj9', '1 3 5 7 9', ''], ['C7#9', '1 3 5 b7 #9', '„Hendrix-Akkord“'], ['C/E', 'C mit E im Bass', 'Slash-Akkord']];
  const PC = [['E-Saite (1-5)', '35xxxx', 'G5 – Grundton tiefe E-Saite, 3. Bund'], ['A-Saite (1-5)', 'x35xxx', 'C5 – Grundton A-Saite, 3. Bund'], ['D-Saite (1-5)', 'xx57xx', 'G5 – Grundton D-Saite, 5. Bund'],
    ['E-Saite mit Oktave (1-5-8)', '355xxx', 'G5 mit Oktave'], ['A-Saite mit Oktave (1-5-8)', 'x355xx', 'C5 mit Oktave'], ['Quinte im Bass (5-1)', '33xxxx', 'C5/G – Quinte unten'], ['Drop D', '000xxx', 'D5 – ein Finger über drei Saiten']];
  const CAGED = [['C-Form', 'x32010', 'Grundton A-Saite (Ringfinger)'], ['A-Form', 'x02220', 'Grundton A-Saite (leer/Zeigefinger)'], ['G-Form', '320003', 'Grundton tiefe E-Saite (Mittelfinger)'],
    ['E-Form', '022100', 'Grundton tiefe E-Saite (Barré)'], ['D-Form', 'xx0232', 'Grundton D-Saite']];
  const tbl = (head, rows) => '<table class="sp-t" translate="no"><thead><tr>' + head.map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(x => '<td>' + x + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  let sBuilt = false;
  function buildSpick() {
    if (sBuilt) return; sBuilt = true;
    const ivRows = [['0', 'Prime', '1', 'C']].concat(IV.map((n, i) => [String(i + 1), n, ST[i + 1], NN[(i + 1) % 12]]));
    $('spBody').innerHTML =
      '<section class="sp-s"><h3>' + TT('Intervalle') + '</h3>' + tbl(['HT', 'Name', 'Stufe', 'von C'], ivRows) + '</section>' +
      '<section class="sp-s"><h3>' + TT('Powerchord-Formen') + '</h3>' + tbl(['Form', 'Tab (tief → hoch)', 'Hinweis'], PC.map(r => ['<b>' + r[0] + '</b>', '<code>' + r[1] + '</code>', r[2]])) +
      '<h3>' + TT('CAGED-Formen (offen, C-Dur-Familie)') + '</h3>' + tbl(['Form', 'Tab', 'Grundton'], CAGED.map(r => ['<b>' + r[0] + '</b>', '<code>' + r[1] + '</code>', r[2]])) +
      '<p class="caption" translate="no">Formen verschieben: die leeren Saiten werden zum Barré (Zeigefinger). Reihenfolge den Hals hinauf: C → A → G → E → D → C …</p></section>' +
      '<section class="sp-s"><h3>' + TT('Quintenzirkel') + '</h3>' + tbl(['Dur', 'Moll (parallel)', 'Vorzeichen'], KEYS) +
      '<p class="caption" translate="no">Im Uhrzeigersinn je eine Quinte höher (+1♯), gegen den Uhrzeigersinn eine Quarte (+1♭). Akkorde einer Dur-Tonart: I ii iii IV V vi vii° (z. B. C Dm Em F G Am B°).</p></section>' +
      '<section class="sp-s"><h3>' + TT('Akkordsymbole') + '</h3>' + tbl(['Symbol', 'Töne (Stufen)', 'Name'], SYM.map(r => ['<b>' + r[0] + '</b>', r[1], r[2]])) + '</section>';
  }
  ps.addEventListener('click', e => {
    if (!e.target.closest('#spPrint')) return;
    document.documentElement.classList.add('print-spick');
    const off = () => { document.documentElement.classList.remove('print-spick'); window.removeEventListener('afterprint', off); };
    window.addEventListener('afterprint', off); try { window.print(); } catch (x) {} setTimeout(off, 60000);
  });
  document.addEventListener('tabchange', e => { if (e.detail === 'hoer') build(); else { stopSound(); } if (e.detail === 'spick') buildSpick(); });
  window.Hoer = { build, setMode, answer, task: () => Q && { m: Q.m, k: Q.k, dir: Q.dir, i: Q.i, hits: Q.hits, ans: Q.ans }, stats: () => JSON.parse(JSON.stringify(S)), buildSpick };
})();
