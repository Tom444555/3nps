// v125: Bereich „Kurs“ im Reiter Powerchords – Lehr-Zusammenfassung „Power Chord Theory“.
// v129: alle 15 Kapitel, Startseite mit Kapitel-Kacheln (Fortschrittsring), einheitlicher Aufbau je Kapitel:
//   Ziel → Schritt-Leiste (Unterkapitel) → Schritte → Griffbilder (großes Griffbrett „Bühne“ mit Zahl/Name/Ton, ▶ Grundton/
//   Nacheinander/Zusammen, Vorschaubilder) → Übungen (Häkchen) → Griff-Quiz mit Trefferzählung → Merke (Zitatkarten) → Querverweise.
// Inhalt wird erst beim Öffnen des Bereichs gebaut (PcKurs.build), Kapitel-Inhalt erst beim Aufklappen.
// Griffe: frets tief→hoch (null = gedämpft), Stimmung tu (Standard E A D G H e), Beschriftung wird aus den Tonhöhen gerechnet.
// Speicher: localStorage „powerchords.progress.v1“, Feld kurs { "<übung>": true, "q-k<n>": {last, best, n} } (nur erweitert).
(function () {
  const MIDI0 = [40, 45, 50, 55, 59, 64], md = x => ((x % 12) + 12) % 12;
  const NPC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pcOf = n => { const m = /^([A-G])(#|b)?/.exec(n); return md(NPC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)); };
  const LAB = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'], NINE = { 1: 'b9', 2: '9', 5: '11', 6: '#11', 9: '13' };
  const SEM = { '1': 0, '8': 0, 'b2': 1, 'b9': 1, '2': 2, '9': 2, 'b3': 3, '#9': 3, '3': 4, '4': 5, '11': 5, 'b5': 6, '#11': 6, '#4': 6, '5': 7, 'b6': 8, 'b13': 8, '6': 9, '13': 9, 'bb7': 9, 'b7': 10, '7': 11 };
  const NAMES = { '1': 'Grundton', '8': 'Oktave', 'b2': 'kl.\nSekunde', '2': 'gr.\nSekunde', 'b3': 'kl.\nTerz', '3': 'gr.\nTerz', '4': 'Quarte', 'b5': 'Tritonus', '#4': 'Tritonus', '5': 'Quinte',
    'b6': 'kl.\nSexte', '6': 'gr.\nSexte', 'b7': 'kl.\nSeptime', '7': 'gr.\nSeptime', 'bb7': 'verm.\nSeptime', '9': 'None', 'b9': 'kl.\nNone', '#9': 'übermäßige\nNone', '11': 'Undezime', '#11': 'übermäßige\nUndezime', '13': 'Tredezime' };
  const fam = l => { const d = SEM[l]; return d === 0 ? 'f1' : d === 7 ? 'f5' : (d === 3 || d === 4) && l !== '#9' ? 'f3' : d === 5 && l === '4' ? 'f4' : d === 10 || d === 11 ? 'f7' : 'fx'; };
  // Griff-Bibliothek (Standardgriffe; jeder Ton per Test gegen die Formel geprüft)
  const CH = {
    E: [0, 2, 2, 1, 0, 0], Em: [0, 2, 2, 0, 0, 0], A: [null, 0, 2, 2, 2, 0], Am: [null, 0, 2, 2, 1, 0], D: [null, null, 0, 2, 3, 2], Dm: [null, null, 0, 2, 3, 1],
    C: [null, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 0, 3], F: [1, 3, 3, 2, 1, 1]
  };
  const TUN = { E: MIDI0, dD: [38, 45, 50, 55, 59, 64], dCis: [37, 45, 50, 55, 59, 64], dC: [36, 45, 50, 55, 59, 64], dB: [35, 45, 50, 55, 59, 64] };
  const SNAME = ['E', 'A', 'D', 'G', 'H', 'e'], LOWN = { 38: 'D', 37: 'Cis', 36: 'C', 35: 'H', 40: 'E' };
  const base = g => (g.tu ? TUN[g.tu] : MIDI0), snOf = g => (g.tu ? [LOWN[TUN[g.tu][0]]].concat(SNAME.slice(1)) : null);
  const K = [];
  // Griff → Marken; g = { n, r?, fr? | mk?, nm?, nine?, s9?, iv?, cap?, arp?, tu? }
  function grip(g) {
    const B = base(g), fr = g.fr || CH[g.n], r = g.r != null ? g.r : g.nm ? 0 : pcOf(g.n);
    if (g.mk) return { r, marks: g.mk.map(([s, f, l]) => ({ s, f, lab: l, cls: g.nm ? 'r5' : l === '1' ? 'r1' : l === '8' ? 'r8' : l === '5' ? 'r5' : 'dx3', midi: B[s] + f })), muted: [] };
    const marks = [], ms = []; let roots = 0;
    fr.forEach((f, s) => { if (f == null) return; ms.push({ s, f, midi: B[s] + f }); });
    ms.slice().sort((a, b) => a.midi - b.midi).forEach(t => {
      const d = md(t.midi - r); let l = g.nine && NINE[d] ? NINE[d] : LAB[d];
      if (g.s9 && d === 3) l = '#9';
      if (d === 0) l = roots++ === 1 ? '8' : '1';
      marks.push({ s: t.s, f: t.f, lab: l, midi: t.midi, cls: l === '1' ? 'r1' : l === '8' ? 'r8' : l === '5' ? 'r5' : 'dx3' });
    });
    return { r, marks, muted: fr.map((f, s) => f == null ? s : -1).filter(s => s >= 0) };
  }
  function range(marks, full, minW) {
    if (full) return [0, 12];
    const fs = marks.map(m => m.f), nz = fs.filter(f => f > 0), mn = nz.length ? Math.min(...nz) : 0, mx = Math.max(...fs);
    const a = mn >= 4 && !fs.includes(0) ? mn - 1 : 0; return [a, Math.max(a + (minW || 4), mx)];
  }
  // Bühne/Quiz: immer 13 Bünde → gleiche Größe, nichts springt
  function fix13(marks) { const fs = marks.map(m => m.f); let a = Math.max(0, Math.min(...fs) - 1); if (Math.max(...fs) > a + 12) a = Math.max(...fs) - 12; return [a, a + 12]; }
  const esc = s => String(s);
  const rootNameOf = (g, q) => { const m = /^([A-G](#|b)?)/.exec(g.n || ''); return m && !g.nm ? m[1] : (window.PcWerk ? PcWerk.rootName(q.r) : 'C'); };
  const spellOf = (g, q, lab) => (window.PcWerk ? PcWerk.spell(rootNameOf(g, q), lab === '8' ? 12 : SEM[lab]) : '');
  const L0 = s => (window.__lang === 'en' && window.__EN_PCW && window.__EN_PCW[s]) || s;
  function subHtml(ci, si, S) {
    let h = '<section class="pc-ksub" id="pcK_' + S.id + '"><h4 translate="no">' + S.t + '</h4><div class="pc-kbody" translate="no">';
    if (S.p) h += '<ol class="pc-ksteps">' + S.p.map(x => '<li>' + x + '</li>').join('') + '</ol>';
    h += '</div>';
    if (S.g && S.g.length) {
      h += '<div class="pc-kstage" data-ks="' + ci + '.' + si + '"><div class="pc-row pc-kstagehead"><b class="pc-kstn" translate="no"></b><span class="caption pc-kstc" translate="no"></span>' +
        '<div class="seg pc-seg pc-klab">' + [['num', 'Zahl'], ['name', 'Name'], ['ton', 'Ton']].map(([v, t]) => '<button class="toggle-btn" data-kl2="' + v + '">' + L0(t) + '</button>').join('') + '</div></div>' +
        '<div class="pc-bwrap pc-kstb"></div><div class="pc-row"><button class="toggle-btn" data-k="sp" data-v="root">' + PcSkin.btn(L0('▶ Grundton')) + '</button><button class="toggle-btn" data-k="sp" data-v="seq">' + PcSkin.btn(L0('▶ Nacheinander')) + '</button><button class="toggle-btn active" data-k="sp" data-v="all">' + PcSkin.btn(L0('▶ Zusammen')) + '</button></div></div>';
      h += '<div class="pc-kgrips">' + S.g.map((g, gi) => '<div class="pc-kgrip" data-kpick="' + ci + '.' + si + '.' + gi + '"><b translate="no">' + esc(g.n) + '</b>' + (g.cap ? '<span class="caption" translate="no">' + g.cap + '</span>' : '') +
        '<div class="pc-bwrap" data-kb="' + ci + '.' + si + '.' + gi + '"></div><button class="toggle-btn" data-k="play" data-kg="' + ci + '.' + si + '.' + gi + '">' + PcSkin.btn(g.arp || g.mk ? '▶ Nacheinander' : '▶ Anhören') + '</button></div>').join('') + '</div>';
    }
    if (S.loop) h += S.loop.map((L, li) => '<div class="pc-row pc-kloop"><b translate="no">' + L.c.join(' – ') + '</b><span class="caption" translate="no">' + (L.t || '') + '</span><button class="toggle-btn active" data-k="loop" data-kl="' + ci + '.' + si + '.' + li + '">' + PcSkin.btn('▶ Loop starten') + '</button></div>').join('');
    h += '<div class="pc-kex"><h5>Übungen</h5>' + S.ex.map((x, xi) => { const id = S.id + '-' + xi, own = x.slice(0, 2) === 'E:';
      return '<label class="check pc-kchk"><input type="checkbox" data-kx="' + id + '"> <span translate="no">' + (own ? '<i>(ergänzt)</i> ' : '') + x.slice(2) + '</span></label>'; }).join('') + '</div>';
    if (S.x && S.x.length) h += '<div class="pc-row pc-krefs"><span class="caption">' + L0('Siehe auch') + '</span>' + S.x.map(n => '<button class="toggle-btn pc-kref" data-kref="' + n + '" translate="no">' + PcSkin.btn('→ ') + 'Kapitel ' + n + ' · ' + K[n - 1].short + '</button>').join('') + '</div>';
    return h + '</section>';
  }
  let A = null, host = null, LABM = 'num';
  const total = () => K.reduce((a, c) => a + c.s.reduce((b, S) => b + S.ex.length, 0), 0);
  function kp() { const P = A.PR(); P.kurs = P.kurs || {}; return P.kurs; }
  const exIds = C => { const ids = []; C.s.forEach(S => S.ex.forEach((x, xi) => ids.push(S.id + '-' + xi))); return ids; };
  function ring(p) { const c = 2 * Math.PI * 17; return '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="17" class="pc-rbg"/><circle cx="22" cy="22" r="17" class="pc-rfg" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 22 22)"/></svg>'; }
  function paintRings() {
    const st = kp(); document.querySelectorAll('#pcKRings .pc-ring').forEach((b, ci) => { const ids = exIds(K[ci]);
      const d = ids.filter(id => st[id] === true).length, p = ids.length ? d / ids.length : 0; b.querySelector('.pc-rsvg').innerHTML = ring(p); b.classList.toggle('done', p >= 1); b.querySelector('.pc-tp').textContent = d + ' / ' + ids.length; });
    document.querySelectorAll('#pcSecKurs .pc-kstep').forEach(b => { const S = K[+b.dataset.c].s[+b.dataset.s], ids = S.ex.map((x, xi) => S.id + '-' + xi); b.classList.toggle('seen', ids.length > 0 && ids.every(id => st[id] === true)); });
  }
  function paintSum() {
    paintRings();
    const st = kp(), n = Object.keys(st).filter(k => st[k] === true).length, t = total();
    const el = document.getElementById('pcKSum'); if (el) el.textContent = n + ' von ' + t + ' Übungen abgehakt';
    const b = document.getElementById('pcKBar'); if (b) b.style.width = (t ? 100 * n / t : 0) + '%';
  }
  // ---------- Bühne: großes Griffbrett je Unterkapitel ----------
  const STG = {};
  function stageMarks(g, q) {
    return q.marks.map(m => { const t = m.lab, nm = g.nm ? t : LABM === 'name' ? (NAMES[t] || t) : LABM === 'ton' ? spellOf(g, q, t) : t;
      return { s: m.s, f: m.f, lab: nm, cls: g.nm ? 'f5' : fam(t) + (t === '1' ? ' root' : '') }; });
  }
  function drawStage(key) {
    const el = host.querySelector('.pc-kstage[data-ks="' + key + '"]'); if (!el) return;
    const [ci, si] = key.split('.').map(Number), S = K[ci].s[si], gi = STG[key] || 0, g = S.g[gi], q = grip(g), B = base(g), [a, b] = fix13(q.marks);
    el.querySelector('.pc-kstn').textContent = g.n; el.querySelector('.pc-kstc').textContent = (g.cap || '').replace(/<[^>]+>/g, '');
    el.querySelectorAll('[data-kl2]').forEach(x => x.classList.toggle('active', x.dataset.kl2 === LABM));
    A.board(el.querySelector('.pc-kstb'), { marks: stageMarks(g, q), muted: q.muted, from: a, to: b, sn: snOf(g), base: B, tap: (s, f) => A.playMidi(B[s] + f) });
    host.querySelectorAll('[data-kpick^="' + key + '."]').forEach(x => x.classList.toggle('sel', +x.dataset.kpick.split('.')[2] === gi));
  }
  // ---------- Griff-Quiz mit Trefferzählung ----------
  const QZ = {};
  const quizGrips = C => { const a = []; C.s.forEach(S => (S.g || []).forEach(g => { if (!g.nm) a.push(g); })); return a; };
  const STAMM = [[0, 0, 'E'], [0, 1, 'F'], [0, 3, 'G'], [0, 5, 'A'], [0, 7, 'B'], [0, 8, 'C'], [0, 10, 'D'], [1, 0, 'A'], [1, 2, 'B'], [1, 3, 'C'], [1, 5, 'D'], [1, 7, 'E'], [1, 8, 'F'], [1, 10, 'G']];
  function quizNew(ci) {
    const z = QZ[ci], C = K[ci], gs = quizGrips(C); z.ans = null; z.fb = '';
    if (!gs.length) { const t = STAMM[Math.floor(Math.random() * STAMM.length)], c = new Set([t[2]]); while (c.size < 4) c.add('ABCDEFG'[Math.floor(Math.random() * 7)]);
      Object.assign(z, { kind: 'nt', g: { n: 'Stammton', nm: true, mk: [[t[0], t[1], t[2]]] }, k: 0, want: t[2], ch: [...c].sort() }); return; }
    const g = gs[Math.floor(Math.random() * gs.length)], q = grip(g), k = Math.floor(Math.random() * q.marks.length), want = q.marks[k].lab, pool = ['1', '3', 'b3', '5', '7', 'b7', '9', '4', '2', 'b5', '6', '8'];
    const c = new Set([want]); q.marks.forEach(m => { if (c.size < 3) c.add(m.lab); }); while (c.size < 4) c.add(pool[Math.floor(Math.random() * pool.length)]);
    Object.assign(z, { kind: 'iv', g, k, want, ch: [...c].sort((x, y) => (SEM[x] - SEM[y]) || x.localeCompare(y)) });
  }
  function quizDraw(ci) {
    const el = host.querySelector('.pc-kquiz[data-kq="' + ci + '"]'); if (!el) return; const z = QZ[ci], st = kp(), best = st['q-k' + (ci + 1)];
    el.querySelector('.pc-kqbest').textContent = best ? L0('Bestes Ergebnis') + ': ' + best.best + ' / 10' : '';
    if (!z) { el.querySelector('.pc-kqb').innerHTML = ''; el.querySelector('.pc-kqbody').innerHTML = '<p class="caption" translate="no">' + (quizGrips(K[ci]).length ? 'Ein Punkt in einem Griff aus diesem Kapitel ist mit „?“ markiert. Welches Intervall ist es? 10 Aufgaben.' : 'Ein Punkt auf der E- oder A-Saite ist mit „?“ markiert. Welcher Stammton ist es (A B C D E F G)? 10 Aufgaben.') + '</p>'; return; }
    const g = z.g, q = grip(g), [a, b] = fix13(q.marks);
    A.board(el.querySelector('.pc-kqb'), { marks: q.marks.map((m, i) => ({ s: m.s, f: m.f, lab: i === z.k ? (z.ans == null ? '?' : (g.nm ? m.lab : m.lab)) : (g.nm ? m.lab : m.lab), cls: i === z.k ? 'fq' : (g.nm ? 'f5' : fam(m.lab) + ' dimq') })), muted: q.muted, from: a, to: b, sn: snOf(g), base: base(g) });
    let h = '<p class="pc-wqp" translate="no">' + (z.kind === 'nt' ? 'Welcher Ton liegt am Punkt „?“' : '<b>' + g.n + '</b>: Welches Intervall liegt am Punkt „?“') + '</p><div class="pc-row">' +
      z.ch.map(c => '<button class="toggle-btn" data-kqa="' + c + '"' + (z.ans != null ? ' disabled' : '') + ' translate="no">' + c + (z.kind === 'iv' ? ' · ' + (NAMES[c] || '').replace('\n', ' ') : '') + '</button>').join('') + '</div>';
    if (z.fb) h += '<p class="pc-wfb ' + (z.ans ? 'ok' : 'no') + '" translate="no">' + z.fb + '</p>';
    h += '<div class="pc-row"><b class="pc-wcnt">' + L0('Aufgabe') + ' ' + (z.i + 1) + ' ' + L0('von') + ' 10 · ' + L0('Treffer') + ': ' + z.hits + '</b>' + (z.ans != null ? '<button class="toggle-btn active" data-kqn="1">' + PcSkin.btn(z.end ? L0('Neue Runde') : L0('Weiter ▶')) + '</button>' : '') + '</div>';
    el.querySelector('.pc-kqbody').innerHTML = h;
  }
  function quizAnswer(ci, c) {
    const z = QZ[ci]; if (!z || z.ans != null) return; const ok = c === z.want; z.ans = ok; if (ok) z.hits++;
    if (z.kind === 'nt') z.fb = (ok ? '✓ Richtig! ' : '✗ ') + 'Das ist ' + z.want + '.';
    else { const q = grip(z.g), m = q.marks[z.k]; z.fb = (ok ? '✓ Richtig! ' : '✗ ') + 'Das ist ' + (NAMES[z.want] || z.want).replace('\n', ' ') + ' (' + z.want + '), Ton ' + spellOf(z.g, q, z.want) + ' – ' + SNAME[m.s] + '-Saite, ' + m.f + '. Bund.'; }
    if (z.i === 9) { const st = kp(), k = 'q-k' + (ci + 1), o = st[k] || {}; st[k] = { last: z.hits, best: Math.max(o.best || 0, z.hits), n: 10 }; A.saveProg(); z.end = true; }
    quizDraw(ci);
  }
  // ---------- v130: Griff-Tabelle je Kapitel ----------
  const tabOf = (g) => (g.fr || CH[g.n]).map(f => f == null ? 'x' : f > 9 ? '(' + f + ')' : String(f)).join('');
  function gripTable(ci) {
    const C = K[ci], rows = []; C.s.forEach((S, si) => (S.g || []).forEach((g, gi) => { if (g.mk) return; rows.push([S, si, g, gi]); }));
    if (!rows.length) return ci === 0 ? '<details class="pc-ktab"><summary><h4>' + L0('Griff-Tabelle') + ' (Stammtöne)</h4></summary><div class="pc-tbl"><table translate="no"><thead><tr><th>Bund</th>' + [0, 1, 3, 5, 7, 8, 10, 12].map(f => '<th>' + f + '</th>').join('') + '</tr></thead><tbody><tr><td>E-Saite</td>' + ['E', 'F', 'G', 'A', 'B', 'C', 'D', 'E'].map(x => '<td>' + x + '</td>').join('') + '</tr></tbody></table><table translate="no"><thead><tr><th>Bund</th>' + [0, 2, 3, 5, 7, 8, 10, 12].map(f => '<th>' + f + '</th>').join('') + '</tr></thead><tbody><tr><td>A-Saite</td>' + ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'].map(x => '<td>' + x + '</td>').join('') + '</tr></tbody></table></div></details>' : '';
    return '<details class="pc-ktab"><summary><h4>' + L0('Griff-Tabelle') + ' (' + rows.length + ')</h4></summary><div class="pc-tbl"><table translate="no"><thead><tr><th>Akkord</th><th>Griff (tief → hoch)</th><th>Formel</th><th>Töne</th><th>Unterkapitel</th></tr></thead><tbody>' +
      rows.map(([S, si, g, gi]) => { const q = grip(g), labs = q.marks.slice().sort((a, b) => a.midi - b.midi);
        return '<tr data-kpick="' + ci + '.' + si + '.' + gi + '"><td><b>' + esc(g.n) + '</b>' + (g.tu ? ' <span class="caption">(' + LOWN[TUN[g.tu][0]] + '-Stimmung)</span>' : '') + '</td><td class="pc-mono">' + tabOf(g) + '</td><td>' + [...new Set(labs.map(m => m.lab === '8' ? '1' : m.lab))].join(' · ') + '</td><td>' + labs.map(m => spellOf(g, q, m.lab)).join(' ') + '</td><td>' + S.t.replace(/^(\d+\.\d+).*/, '$1') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="caption" translate="no">Zeile antippen = Griff auf dem großen Griffbrett zeigen. „x“ = Saite nicht spielen, Zahlen in Klammern = Bund 10 und höher.</p></details>';
  }
  // ---------- Kapitel bauen ----------
  function fillChapter(d) {
    if (d._k) return; d._k = true; const ci = +d.dataset.kc, C = K[ci], st = kp(), body = d.querySelector('.pc-sec-b');
    if (C.w && window.PcWerk) PcWerk.build(body, A, C);                       // v126: Kapitel 3 = Intervall-Werkstatt
    if (C.w && window.PcWerk) body.insertAdjacentHTML('beforeend', '<details class="pc-ktab"><summary><h4>' + L0('Griff-Tabelle') + ' (13)</h4></summary><div class="pc-tbl"><table translate="no"><thead><tr><th>Zahl</th><th>Name</th><th>Halbtöne</th><th>von A</th><th>Lage von A (E-Saite 5. Bund)</th></tr></thead><tbody>' +
      PcWerk.IV.map(([n, num, nm]) => { const p = n ? PcWerk.posBox(0, 5, n) : { s: 0, f: 5 }; return '<tr><td><b>' + num + '</b></td><td>' + nm + '</td><td>' + n + '</td><td>' + PcWerk.spell('A', n) + '</td><td>' + SNAME[p.s] + '-Saite, ' + p.f + '. Bund</td></tr>'; }).join('') + '</tbody></table></div></details>');
    else {
      let h = (C.z ? '<div class="pc-kziel" translate="no"><b>Ziel</b> ' + C.z + '</div>' : '') +
        '<div class="pc-kstepbar">' + C.s.map((S, si) => (si ? '<i class="pc-wsl"></i>' : '') + '<button class="pc-wstep pc-kstep" data-c="' + ci + '" data-s="' + si + '"><span class="pc-wsn"><i>' + (si + 1) + '</i>' + PcSkin.icon('check') + '</span><span class="pc-wsx" translate="no"> ' + S.t.replace(/^\d+\.\d+ /, '') + '</span></button>').join('') + '</div>' +
        C.s.map((S, si) => subHtml(ci, si, S)).join('');
      h += '<div class="pc-kquiz" data-kq="' + ci + '"><div class="pc-row"><h4>' + L0('Quiz zum Kapitel') + '</h4><span class="caption pc-kqbest"></span><button class="toggle-btn active" data-kqs="1">' + PcSkin.btn(L0('▶ Quiz starten')) + '</button></div><div class="pc-bwrap pc-kqb"></div><div class="pc-kqbody"></div></div>';
      h += gripTable(ci);
      const mq = C.s.filter(S => S.m).map(S => [S.m, S.t]);
      if (mq.length || C.mk) h += '<div class="pc-kmerke"><h4>' + L0('Merke') + '</h4><div class="pc-kmgrid" translate="no">' + (C.mk || []).map(t => '<div class="pc-wcard f1">' + t + '<small>Merkkarte · Kapitel ' + (ci + 1) + '</small></div>').join('') +
        mq.map(([t, src]) => '<div class="pc-wcard f3">' + t + '<small>Lehrer · ' + src + '</small></div>').join('') + '</div></div>';
      body.innerHTML = h;
      C.s.forEach((S, si) => { if (S.g && S.g.length) drawStage(ci + '.' + si); });
      quizDraw(ci);
    }
    if ((ci === 5 || ci === 6) && window.PcLive) body.insertAdjacentHTML('afterbegin', '<div class="pc-klive"><button class="toggle-btn" data-klive="1">' + PcSkin.btn('Was spiele ich?') + '</button><div class="card pc-klivebox" hidden></div></div>');   // v128
    d.querySelectorAll('[data-kb]').forEach(el => { const [a, b, c] = el.dataset.kb.split('.').map(Number), g = K[a].s[b].g[c], q = grip(g), [f0, f1] = range(q.marks, g.nm && !g.short);
      A.board(el, { marks: q.marks, muted: q.muted, from: f0, to: f1, mini: true, sn: snOf(g), base: base(g) }); });
    d.querySelectorAll('input[data-kx]').forEach(c => { c.checked = !!st[c.dataset.kx]; });
    paintRings();
  }
  function loopChords(L) {
    return L.c.map(n => { const g = Object.assign({ n }, (L.fr && L.fr[n]) ? { fr: L.fr[n] } : {}, L.tu ? { tu: L.tu } : {}), q = grip(g), lo = q.marks.slice().sort((a, b) => a.midi - b.midi)[0];
      return { name: n, rootPc: q.r, rootString: lo.s, rootFret: lo.f, shapeId: null, tones: q.marks.map(m => ({ s: m.s, f: m.f, midi: m.midi, role: m.lab === '1' ? '1' : m.lab === '8' ? '8' : '5' })) }; });
  }
  function openChapter(n) { const d = document.getElementById('pcKC' + n); if (!d) return; d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function onClick(e) {
    const pick = e.target.closest('[data-kpick]');
    if (pick && !e.target.closest('button')) { const [ci, si, gi] = pick.dataset.kpick.split('.').map(Number); STG[ci + '.' + si] = gi; drawStage(ci + '.' + si); if (pick.tagName === 'TR') { const st = host.querySelector('.pc-kstage[data-ks="' + ci + '.' + si + '"]'); if (st) st.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return; }
    const l2 = e.target.closest('[data-kl2]'); if (l2) { LABM = l2.dataset.kl2; Object.keys(STG).concat([...host.querySelectorAll('.pc-kstage')].map(x => x.dataset.ks)).forEach(k => drawStage(k)); return; }
    const ref = e.target.closest('[data-kref]'); if (ref) { openChapter(+ref.dataset.kref); return; }
    const qs = e.target.closest('[data-kqs]'); if (qs) { const ci = +qs.closest('[data-kq]').dataset.kq; QZ[ci] = { i: 0, hits: 0 }; quizNew(ci); quizDraw(ci); return; }
    const qa = e.target.closest('[data-kqa]'); if (qa) { quizAnswer(+qa.closest('[data-kq]').dataset.kq, qa.dataset.kqa); return; }
    const qn = e.target.closest('[data-kqn]'); if (qn) { const ci = +qn.closest('[data-kq]').dataset.kq, z = QZ[ci]; if (z.end) QZ[ci] = { i: 0, hits: 0 }; else z.i++; quizNew(ci); quizDraw(ci); return; }
    const sb = e.target.closest('.pc-kstep'); if (sb) { const el = document.getElementById('pcK_' + K[+sb.dataset.c].s[+sb.dataset.s].id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const b = e.target.closest('button[data-k]'); if (!b) return;
    if (b.dataset.k === 'sp') { const key = b.closest('.pc-kstage').dataset.ks, [ci, si] = key.split('.').map(Number), g = K[ci].s[si].g[STG[key] || 0], q = grip(g), ms = q.marks.map(m => m.midi).sort((x, y) => x - y);
      if (b.dataset.v === 'root') { const r = q.marks.find(m => m.lab === '1'); A.playMidi(r ? r.midi : ms[0]); } else if (b.dataset.v === 'seq') A.seqNow(g.mk ? q.marks.map(m => m.midi) : ms); else A.strumNow(ms); return; }
    if (b.dataset.k === 'play') { const [a, s, c] = b.dataset.kg.split('.').map(Number), g = K[a].s[s].g[c], q = grip(g);
      const ms = q.marks.map(m => m.midi); if (g.arp || g.mk) A.seqNow(g.mk ? ms : ms.slice().sort((x, y) => x - y)); else A.strumNow(ms); return; }
    if (b.dataset.k === 'loop') { const [a, s, l] = b.dataset.kl.split('.').map(Number), L = K[a].s[s].loop[l], ch = loopChords(L);
      A.begin({ chords: ch, path: 0, keyPc: ch[0].rootPc, keyName: ch[0].name }, { how: 'looper', n: 3, bpm: L.bpm || 70, drums: 'drums', label: 'Kurs · ' + L.c.join(' – ') }); }
  }
  function build(h, api) {
    if (host) return; host = h; A = api;
    h.innerHTML = '<div class="card pc-exhead pc-khome"><h3 class="pc-wt" translate="no">Power Chord Theory – Kurs</h3><div class="pc-row"><b id="pcKSum"></b></div><div class="pc-bar"><i id="pcKBar"></i></div>' +
      '<div class="pc-tiles" id="pcKRings">' + K.map((C, ci) => '<button class="pc-ring pc-tile" data-kring="' + ci + '"><span class="pc-tring"><span class="pc-rsvg"></span><b>' + (ci + 1) + '</b></span><span class="pc-tt"><b translate="no">' + C.short + '</b><span class="pc-td" translate="no">' + (C.d || '') + '</span><span class="pc-tp caption"></span></span></button>').join('') + '</div>' +
      '<p class="caption" translate="no">15 Kapitel, Schritt für Schritt nach den Worten des Lehrers. Tippe eine Kachel an, um das Kapitel zu öffnen. Im Text heißt der Ton H wie beim Lehrer <b>B</b> (das tiefere heißt <b>B-flat</b>); auf dem Griffbrett steht die Saite wie im übrigen Reiter als H. Die Griffbilder zeigen die hohe e-Saite oben; die Zahlen in den Punkten sind die Intervalle.</p></div>' +
      K.map((C, ci) => '<details class="card pc-sec pc-kc" data-kc="' + ci + '" id="pcKC' + (ci + 1) + '"><summary><h3 translate="no">' + C.t + '</h3></summary><div class="pc-sec-b"></div></details>').join('');
    h.addEventListener('click', onClick);
    h.addEventListener('click', e => { const b = e.target.closest('[data-klive]'); if (!b) return; const box = b.nextElementSibling;
      if (!box._c) box._c = PcLive.mount(box); box.hidden = !box.hidden; if (box.hidden) PcLive.stop(); else PcLive.start(box._c); });
    h.addEventListener('click', e => { const r = e.target.closest('[data-kring]'); if (!r) return; openChapter(+r.dataset.kring + 1); });
    h.addEventListener('change', e => { const c = e.target.closest('input[data-kx]'); if (!c) return; const st = kp(); if (c.checked) st[c.dataset.kx] = true; else delete st[c.dataset.kx]; A.saveProg(); paintSum(); });
    h.querySelectorAll('details.pc-kc').forEach(d => { d.addEventListener('toggle', () => { if (d.open) fillChapter(d); }); if (d.open) fillChapter(d); });
    if (window.PcExtra) PcExtra.build(h, A);                                  // v130: Werkzeuge (Akkordsymbole, Lexikon, Landkarte, Tonleitern)
    paintSum();
  }
  // Prüfung für Tests: jede Marke passt zu ihrem Intervall bzw. Notennamen, Intervallmenge = Formel
  function check() {
    const bad = [];
    const all = []; K.forEach(C => C.s.forEach(S => { (S.g || []).forEach(g => all.push(g)); (S.loop || []).forEach(L => L.c.forEach(n => all.push(Object.assign({ n }, L.fr && L.fr[n] ? { fr: L.fr[n] } : {}, L.tu ? { tu: L.tu } : {})))); }));
    all.forEach(g => { const q = grip(g);
      q.marks.forEach(m => { if (g.nm ? md(m.midi) !== pcOf(m.lab) : md(m.midi - q.r) !== SEM[m.lab]) bad.push(g.n + ' ' + m.s + '/' + m.f + ' ' + m.lab); });
      if (g.iv) { const want = g.iv.split(' ').map(x => SEM[x]).sort().join(), got = [...new Set(q.marks.map(m => SEM[m.lab]))].sort().join(); if (want !== got) bad.push(g.n + ' Formel ' + g.iv); } });
    return { n: all.length, bad };
  }
  window.PcKurs = { K, CH, TUN, build, grip, check, total, open: openChapter, quiz: ci => QZ[ci] && { kind: QZ[ci].kind, want: QZ[ci].want, i: QZ[ci].i, hits: QZ[ci].hits, ans: QZ[ci].ans } };
})();

// ===== Kapitel 1 – Einleitung =====
PcKurs.K.push({ t: 'Kapitel 1 – Einleitung', s: [
  { id: 'k1-1', t: '1.1 Worum der Kurs geht', p: [
    'Der Kurs heißt „Power Chord Theory“. Grundgedanke des Lehrers: <b>„Gitarrenakkorde sind nicht kompliziert.“</b>',
    'Du brauchst kein 600-Seiten-Akkordbuch. Du lernst, wie man Akkorde <b>zusammenbaut</b>. Wer weiß, was die Zahlen in A7, B9 oder B13 bedeuten, spielt sie selbst.',
    'Er fängt „bei Null“ an: mit dem Powerchord. Am Ende baust du komplexe Akkorde und „coole Extensions“ (Akkorderweiterungen).',
    '„Wenn ihr bis 13 zählen könnt, ist das alles nicht kompliziert.“',
    'Das hilft in jedem Stil, auch beim Solieren: Du weißt, welche Funktion die gespielte Note im Akkord hat (Quinte, große 7, 9 …).',
    'Start: „Erstmal Spaß haben. 1, 5 und 8. Powerchord.“ Alles baut auf diesem „Energieakkord“ auf.'],
    ex: ['E:Sage laut, worauf der ganze Kurs aufbaut: „1, 5, 8 – Powerchord“. Zähle dann einmal von 1 bis 13.'] },
  { id: 'k1-2', t: '1.2 Sprachregeln: Zahlen, Kreuz, b – und das B', p: [
    'Intervalle sind <b>Zahlen</b>: 1, 2, 3 … Kreuz (Sharp) macht höher, b (Flat) macht tiefer. Er sagt z. B. „Kreuz Elf“ (#11), „b3“, „b7“.',
    '<b>Das B-Problem:</b> Der Lehrer arbeitet nicht mit H. Das musikalische Alphabet hat 7 Buchstaben: <b>A B C D E F G</b>.',
    'Der Ton einen Halbton tiefer als B heißt <b>B-flat</b> – das einzige englische Wort, das du brauchst.',
    'Tiefer gemachte Töne auf Deutsch: D → <b>Des</b>, E → <b>Es</b>, G → <b>Ges</b>, A → <b>As</b>. Das B wird nicht zu „Bes“, sondern zu <b>B-flat</b>.',
    'Warum? So kannst du internationale Noten und Akkordsymbole lesen.'],
    m: 'Merksatz: A B C D E F G – und unter dem B liegt B-flat.',
    ex: ['E:Namen-Übung: Sage laut „A B C D E F G A“ und danach die tiefer gemachten Töne „Des, Es, Ges, As, B-flat“. Geschafft, wenn du nicht mehr über „H“ stolperst.'] }
] });

// ===== Kapitel 2 – Powerchord-Grundlagen =====
PcKurs.K.push({ t: 'Kapitel 2 – Powerchord-Grundlagen', s: [
  { id: 'k2-1', t: '2.1 Was ist ein Powerchord?', p: [
    'Akkorde haben Charakter: Dur fröhlich, Moll traurig, Sus schwebend.',
    'Dem Powerchord fehlt genau der Ton, der den Charakter gibt (die Terz). Er ist <b>neutral</b> – deshalb klingt er gut mit <b>Verzerrung</b>: „Der dritte Ton ist nicht das Salz in der Suppe.“',
    'Griff: <b>Zeigefinger, Ringfinger, kleiner Finger</b> auf der <b>E-, A- und D-Saite</b> (Finger 1, 3, 4).',
    'Die Töne heißen <b>1 (Grundton) – 5 (Quinte) – 8 (wieder der Grundton)</b>, also „1-5-8“ oder „1-5-1“.'],
    m: '„Dass die 8 die 1 ist, ist extremst wichtig.“',
    g: [{ n: 'G5', fr: [3, 5, 5, null, null, null], iv: '1 5', cap: 'Beispiel: Grundton im 3. Bund' }],
    ex: ['E:Greife den Powerchord mit Finger 1, 3, 4 im 3. Bund (G5), schlage ihn an und sage dabei „1 – 5 – 8“. Schiebe ihn in den 5. Bund und wiederhole.'] },
  { id: 'k2-2', t: '2.2 Zählen um den Powerchord herum', p: [
    'Über der 8 kommt die 9, unter der 8 die 7.',
    'Von der Quinte (5) einen Schritt nach unten ist die 4, darunter die 3.',
    'Direkt unter der 8 liegt die <b>große 7</b>, einen Bund tiefer die <b>kleine 7</b>.',
    'Über der 8 liegen die <b>b9</b> (ein Bund) und die <b>9</b> (zwei Bünde).',
    'Es gibt also „zwei Siebenen“ (eine kleine und eine große). Mehr dazu in Kapitel 3.'],
    g: [{ n: 'Um G5 herum', r: 7, mk: [[0, 3, '1'], [1, 2, '3'], [1, 3, '4'], [1, 5, '5'], [2, 3, 'b7'], [2, 4, '7'], [2, 5, '8'], [2, 6, 'b9'], [2, 7, '9']], cap: 'Grundton G auf der E-Saite, 3. Bund' }],
    ex: ['E:Greife G5 (3. Bund). Spiele die 8 und gehe auf der D-Saite einen Bund tiefer (große 7) und noch einen (kleine 7). Dann von der 8 aus hoch: b9, 9. Sage jede Zahl laut.'] },
  { id: 'k2-3', t: '2.3 Noten auf dem Griffbrett: nur die Stammtöne', p: [
    'Du lernst nicht alle Noten, nur die <b>Stammtöne auf der E- und der A-Saite</b> (A B C D E F G).',
    'Regel: <b>Zwischen E–F und B–C gibt es keinen Zwischenton.</b> Überall sonst liegt ein Bund dazwischen.',
    'E-Saite: E (leer), F, G, A, B, C, D, E – Bünde 0, 1, 3, 5, 7, 8, 10, 12 (12. Bund = „zwei Dots“).',
    'A-Saite: A, B, C, D, E, F, G, A – Bünde 0, 2, 3, 5, 7, 8, 10, 12.',
    'Töne dazwischen: entweder der Name darunter mit „-is“ (Kreuz) oder der Name darüber tiefer gemacht (b). Wann was gilt, hängt von der Tonart ab – „darum geht es in dem Kurs überhaupt gar nicht“.',
    'Aufwärts ab F: F, Fis, G, Gis, A, Ais (= B-flat), B, C, Cis, D, Dis, E. Abwärts: E, Es, D, Des, C, B, B-flat, A, As …'],
    m: '„Sagt es fünfmal: E und F, B und C – kein Extraton.“',
    g: [{ n: 'Stammtöne E-Saite', nm: true, mk: [[0, 0, 'E'], [0, 1, 'F'], [0, 3, 'G'], [0, 5, 'A'], [0, 7, 'B'], [0, 8, 'C'], [0, 10, 'D'], [0, 12, 'E']] },
        { n: 'Stammtöne A-Saite', nm: true, mk: [[1, 0, 'A'], [1, 2, 'B'], [1, 3, 'C'], [1, 5, 'D'], [1, 7, 'E'], [1, 8, 'F'], [1, 10, 'G'], [1, 12, 'A']] }],
    ex: ['L:Sage fünfmal laut: „E und F, B und C – kein Extraton.“',
      'L:Sage und spiele die Stammtöne der E- und der A-Saite („wenn ihr das nicht könnt, was macht ihr denn hier?“).',
      'E:Stammtöne-Leiter: Spiele die E-Saite Bund 0-1-3-5-7-8-10-12 und sage E-F-G-A-B-C-D-E, dann die A-Saite 0-2-3-5-7-8-10-12 mit A-B-C-D-E-F-G-A. Langsam, ein Ton pro Schlag. Geschafft, wenn du die Namen ohne Nachzählen weißt.'] },
  { id: 'k2-4', t: '2.4 Töne ableiten mit dem Powerchord', p: [
    'Beim Powerchord liegt der gleiche Ton (1 und 8) auf zwei Saiten. Damit leitest du alle anderen Saiten ab.',
    '<b>D-Saite aus der E-Saite:</b> Ein Ton auf der D-Saite ist die 8. Lege die Powerchord-Form nach unten – der Grundton auf der E-Saite verrät den Namen.',
    'Beispiel des Lehrers: ein willkürlicher Ton auf der D-Saite mit dem kleinen Finger, Powerchord nach unten – du landest auf <b>B-flat</b> (A#).',
    '<b>G-Saite aus der A-Saite:</b> gleiches Prinzip, eine Saite höher.',
    '<b>B-Saite aus der D-Saite:</b> Die B-Saite ist „falsch gestimmt“ (Terz statt Quarte). Deshalb schiebst du den kleinen Finger <b>einen Bund nach oben</b>.',
    '<b>Hohe e-Saite = tiefe E-Saite</b>, nur zwei Oktaven höher.',
    'So musst du nur die Stammtöne der E- und A-Saite lernen und kannst den Rest ableiten.',
    'Nach der 8 wiederholt sich alles: 1 = 8, 2 = 9, 3 = 10, 4 = 11. Darum gibt es Sus2/Sus4, aber auch 9/11 – das kommt in Kapitel 3 und 6.'],
    m: '„Lernt, wie die Töne heißen. Kommuniziert wie Musiker.“ – „Alles basiert auf 1-5-8.“',
    g: [{ n: 'D-Saite → E-Saite', fr: [6, 8, 8, null, null, null], r: 10, iv: '1 5', cap: 'Ton auf der D-Saite, 8. Bund: Grundton E-Saite 6. Bund = B-flat' },
        { n: 'G-Saite → A-Saite', fr: [null, 3, 5, 5, null, null], r: 0, iv: '1 5', cap: 'G-Saite 5. Bund = C (wie A-Saite 3. Bund)' },
        { n: 'B-Saite → D-Saite', fr: [null, null, 3, 5, 6, null], r: 5, iv: '1 5', cap: 'B-Saite: ein Bund mehr – 6. Bund = F' },
        { n: 'e-Saite = E-Saite', nm: true, mk: [[0, 3, 'G'], [5, 3, 'G']], short: true, cap: 'gleicher Bund, gleicher Name' }],
    ex: ['L:Greife einen willkürlichen Ton auf der D-, G- oder B-Saite und leite ihn per Powerchord nach unten ab („Wo lande ich? B-flat oder A#“).',
      'E:Powerchord-Ableitung: Powerchord auf der E-Saite im 3. Bund (G). Der Finger auf der D-Saite im 5. Bund ist auch ein G. Geschafft, wenn du den Ton auf der D-Saite ohne Tabelle nennst.'] }
] });

// ===== Kapitel 3 – Intervalle =====
PcKurs.K.push({ t: 'Kapitel 3 – Intervalle', w: 1, s: [
  { id: 'k3-1', t: '3.1 Namen und Zahlen', p: [
    'Intervalle sind die Zahlen 1 bis 8 – genauso einfach wie A bis G. Es gibt nur sieben verschiedene Zahlen, denn die 8 ist wieder die 1.',
    '<b>Nur einmal gibt es: 1, 4, 5, 8.</b> „Es gibt keine große 5 oder kleine 5.“ Die 1 heißt auch Prime.',
    'Zwischen 4 und 5 liegt der <b>Tritonus</b> – der Lehrer nennt ihn „Bart Simpson“. Er heißt #11, #4 oder b5, aber nie „kleine 5“ oder „große 4“.',
    '<b>Zweimal gibt es (klein und groß): 2, 3, 6, 7.</b> Klein schreibt man mit b, groß ohne Zeichen.',
    'Die ganze Reihe: 1, b2, 2, b3, 3, 4, (Bart Simpson), 5, b6, 6, b7, 7, 8.',
    'Im Powerchord liegen 1, 4, 5, 8 symmetrisch; die 4 liegt unter der 5.',
    'Fachnamen: Prime, Sekunde, Terz, Quarte, Quinte, Tritonus, Sexte, Septime, Oktave. „Wir bleiben bei Zahlen.“'],
    g: [{ n: 'Alle Intervalle von A', r: 9, mk: [[0, 5, '1'], [0, 6, 'b2'], [0, 7, '2'], [0, 8, 'b3'], [1, 4, '3'], [1, 5, '4'], [1, 6, 'b5'], [1, 7, '5'], [1, 8, 'b6'], [2, 4, '6'], [2, 5, 'b7'], [2, 6, '7'], [2, 7, '8']], cap: 'Grundton A auf der E-Saite, 5. Bund' }],
    ex: ['E:Kurz-Quiz „Wie viele Varianten?“: Sage zu jeder Zahl 1 bis 8, ob es sie einmal gibt (1, 4, 5, 8) oder zweimal, klein und groß (2, 3, 6, 7).'] },
  { id: 'k3-2', t: '3.2 Die 7 – Sonderregel bei Akkordsymbolen', p: [
    '<b>Bei Intervallen:</b> b7 = kleine Septime, 7 = große Septime.',
    '<b>Bei Akkordsymbolen:</b> eine einfache „7“ heißt <b>kleine 7</b>. D7 ist also D mit kleiner 7.',
    'Die <b>große 7</b> schreibt man im Akkordsymbol <b>maj7</b>, <b>M7</b> oder mit Dreieck (Δ7).',
    'Warum? Bei „Db7“ wüsste man sonst nicht, ob das b zum D gehört (Des) oder zur 7.'],
    m: '„Wenn es um Intervalle geht: b7 und 7. Wenn es um Akkorde geht: 7 und Major 7. Ich weiß, das ist echt kaputt.“',
    ex: ['E:Sage zu D7, Dmaj7, DM7 und DΔ7, welche 7 gemeint ist (D7 = kleine 7, die anderen drei = große 7).'] },
  { id: 'k3-3', t: '3.3 Intervalle auf dem Griffbrett: die Dur-Tonleiter', p: [
    'Setze den <b>Mittelfinger</b> auf einen Ton der E-Saite, z. B. A im 5. Bund.',
    'E-Saite: Finger 2 und 4. A-Saite: Finger 1, 2, 4. D-Saite: Finger 1, 3, 4. Kurz: 2-4 | 1-2-4 | 1-3-4.',
    'Du landest auf der <b>8</b> – derselbe Ton wie beim Powerchord.',
    'Die Töne heißen 1, 2, 3, 4, 5, 6, 7 (große 7), 8. In der Dur-Tonleiter ist alles „ziemlich groß“.',
    '<b>b2:</b> Wenn du die 2 kennst, liegt die b2 einen Bund darunter. „Sofort sind wir in einer coolen abgedrehten Tonart.“',
    '<b>3 = große Terz</b> („happy“), <b>b3 = kleine Terz</b> (Moll, traurig) – einen Bund unter der 3.',
    'Dann die 4, der Bart Simpson, die 5. Die <b>b6</b> liegt einen Bund unter der 6.',
    'Der Lehrer leitet fast immer <b>von der 8</b> ab und zählt nach unten: 7, b7, 6, b6, 5, Bart Simpson, 4, 3, b3, 2, b2, 1.'],
    g: [{ n: 'Dur-Tonleiter A (eine Oktave)', r: 9, mk: [[0, 5, '1'], [0, 7, '2'], [1, 4, '3'], [1, 5, '4'], [1, 7, '5'], [2, 4, '6'], [2, 6, '7'], [2, 7, '8']], cap: 'Finger 2-4 | 1-2-4 | 1-3-4' },
        { n: 'Die kleinen Varianten', r: 9, mk: [[0, 5, '1'], [0, 6, 'b2'], [1, 3, 'b3'], [2, 3, 'b6'], [2, 5, 'b7'], [2, 7, '8']], cap: 'je ein Bund unter 2, 3, 6, 7' }],
    ex: ['L:Spiele die Dur-Tonleiter über eine Oktave wie oben und sage dabei 1-2-3-4-5-6-7-8 („so dumm es klingt“). Dann ganz langsam noch einmal.',
      'L:Finde zu jedem Ton die kleine Variante: b2 unter der 2, b3 unter der 3, b6 und b7 – immer vom Grundton oder von der 8 aus.',
      'E:Reihe b-Intervalle: Spiele die Tonleiter und zu jedem Ton den Halbton darunter, langsam. Geschafft, wenn du hörst: b3 klingt traurig, 3 klingt fröhlich.'] },
  { id: 'k3-4', t: '3.4 9, 11, 13 – die Oktave darüber', p: [
    'Weil 1 = 8 ist, ist 2 = 9. Eine Oktave höher bekommen aber nur manche Zahlen einen neuen Namen.',
    'Die 3 heißt nie „10“, die 5 bleibt immer 5. Die <b>2 wird zur 9, die 4 zur 11, die 6 zur 13</b> (auch b9, #11, b13).',
    'Grund: <b>1, 3, 5 (und 7) sind Akkordtöne.</b> Die „coolen Noten dazwischen“ (2, 4, 6) heißen 9, 11, 13, wenn sie <b>zusätzlich</b> zum Akkord gespielt werden – das sind die <b>Akkorderweiterungen</b>.',
    'Ausblick: Bei den offenen Akkorden (Kapitel 4) gilt: Wer weiß, wo die 3 ist, findet auch die 4 (Sus4) und die 2 (Sus2).'],
    g: [{ n: '9, 11, 13 über der 8', r: 9, mk: [[0, 5, '1'], [1, 7, '5'], [2, 7, '8'], [3, 4, '9'], [3, 7, '11'], [4, 7, '13']], cap: 'Grundton A, E-Saite 5. Bund' }],
    ex: ['E:Greife A5 (E-Saite 5. Bund) mit der 8 auf der D-Saite und finde darüber die 9, die 11 und die 13. Sage dazu, welche Zahl sie eine Oktave tiefer hätten (2, 4, 6).'] }
] });

// ===== Kapitel 4 – Das CAGED-System =====
Object.assign(PcKurs.CH, { Cmaj7: [null, 3, 2, 0, 0, 0], Dm7: [null, null, 0, 2, 1, 1] });
PcKurs.K.push({ t: 'Kapitel 4 – Das CAGED-System', s: [
  { id: 'k4-1', t: '4.1 Was heißt CAGED?', p: [
    'CAGED steht für die Grundakkorde <b>C, A, G, E, D</b> – „unsere Grundakkordtypen“.',
    'Der Lehrer nennt sie <b>Pfadfinder-Akkorde</b> (offene Akkorde).',
    'Sie sind „ähnlich relevant wie ein Powerchord“: Wenn du verstehst, was in diesen Griffen passiert, „dann wissen wir schon alles“.'],
    g: [{ n: 'C', iv: '1 3 5' }, { n: 'A', iv: '1 3 5' }, { n: 'G', iv: '1 3 5' }, { n: 'E', iv: '1 3 5' }, { n: 'D', iv: '1 3 5' }],
    ex: ['E:Spiele die fünf Pfadfinder-Akkorde C – A – G – E – D nacheinander und sage bei jedem den Grundton.'] },
  { id: 'k4-2', t: '4.2 Das C und der Dreiklang', p: [
    'Greife C-Dur offen. Achte darauf, dass die offenen Saiten frei schwingen.',
    'Der Ton auf der A-Saite ist der <b>Grundton C</b>.',
    'Der nächste Ton ist die <b>Terz E</b> („1, 2, 3 – große Terz“).',
    'Übrig bleibt das <b>G = Quinte</b>.',
    'Das ist ein <b>Dreiklang</b>: Grundton – große Terz – Quinte = Dur. Grundton – kleine Terz – Quinte = Moll.'],
    g: [{ n: 'C', iv: '1 3 5', arp: true, cap: 'Töne von tief nach hoch: 1, 3, 5, 8, 3' }],
    ex: ['E:1-3-5 von C benennen: Zupfe den C-Akkord einzeln von tief nach hoch (Arpeggio) und sage „1, 3, 5, 8, 3“.'] },
  { id: 'k4-3', t: '4.3 Halbtonschritte zählen', p: [
    'Beispiel Grundton <b>F</b>: Bis zur großen Terz sind es <b>4 Halbtonschritte</b> (den Startton zählst du nicht mit).',
    'Von der Terz bis zur Quinte sind es noch <b>3 Halbtonschritte</b>. Dur = <b>4 + 3</b>.',
    '<b>Moll = 3 + 4</b>: „In der Mitte geht eins runter.“',
    'Spielst du die Töne einzeln nacheinander, ist das ein <b>Arpeggio</b>.'],
    g: [{ n: 'F-Dur: 4 + 3', r: 5, mk: [[0, 1, '1'], [0, 5, '3'], [0, 8, '5']], short: true, cap: 'auf der E-Saite gezählt' },
        { n: 'F-Moll: 3 + 4', r: 5, mk: [[0, 1, '1'], [0, 4, 'b3'], [0, 8, '5']], short: true, cap: 'die Mitte einen Bund tiefer' }],
    ex: ['L:Zähle die Halbtonschritte am Beispiel F: große Terz = 4 Halbtonschritte, dann +3 bis zur Quinte. Für Moll: 3 + 4.',
      'L:Spiele die Töne eines Akkords einzeln nacheinander (Arpeggio).'] },
  { id: 'k4-4', t: '4.4 Grundstellung und Umkehrungen', p: [
    '1-3-5 ist die <b>Grundstellung</b>.',
    'Die Reihenfolge ist egal: 3-5-1 oder 5-1-3 ist „trotzdem C-Dur“.',
    '<b>Für die Funktion ist die Reihenfolge irrelevant.</b>'],
    ex: ['E:Zupfe die Töne C, E, G in anderer Reihenfolge (3-5-1, dann 5-1-3) und höre: Es bleibt C-Dur.'] },
  { id: 'k4-5', t: '4.5 Moll ableiten und ein Vorgeschmack: Cmaj7', p: [
    'Dur → Moll: Die Terz <b>einen Halbton tiefer</b> spielen. „Wenn ich weiß, dass die große Terz Dur ist und die kleine Terz Moll … dann weiß ich, wo die kleine Terz ist.“',
    'Im C-Griff ist der Ton auf der B-Saite die <b>8</b> (ein zweites C).',
    'Die 8 um einen Halbton verringern = <b>7</b>: Finger weglassen, die offene B-Saite klingt – das ist <b>Cmaj7</b>.',
    '„Einfach, brauch ich kein bescheuertes Buch für.“',
    'Aus der 8 kann man auch eine 9 machen – das ist nur ein „kleiner Vorgeschmack“, es kommt später.'],
    g: [{ n: 'C', iv: '1 3 5' }, { n: 'Cmaj7', iv: '1 3 5 7', cap: 'Finger von der 8 weg' }],
    ex: ['L:Greife C-Dur und lass den Finger der 8 (B-Saite) weg: Cmaj7.'] },
  { id: 'k4-6', t: '4.6 Das G-Shape', p: [
    'G ist „nichts anderes als was wir eben hatten“: <b>1-3-5-8</b>. Die G-Saite ist der Grundton (die 8).',
    'Auf der B-Saite setzt du keinen Finger – wegen des Halbtonschritts durch die Terz-Stimmung zwischen G- und B-Saite.',
    'Auf der hohen e-Saite greift der kleine Finger das G, „zwei Oktaven höher“.',
    'Abwandeln: Die G-Saite ist die 8. Einen Bund drüber liegt die b9, zwei Bünde drüber die <b>9</b> – „eine wunderschöne 9“.',
    '„Kompliziert war das null.“'],
    g: [{ n: 'G', iv: '1 3 5' }, { n: 'G mit 9', fr: [3, 2, 0, 2, 0, 3], nine: true, iv: '1 3 5 9', cap: 'G-Saite 2. Bund statt leer' }],
    ex: ['E:Greife G, benenne 1-3-5-8, dann lege einen Finger auf die G-Saite im 2. Bund und höre die 9.'] },
  { id: 'k4-7', t: '4.7 E, A, D – die Powerchord-Akkorde', p: [
    'C und G sind vom Griff her verwandt. E, A und D sind es auch.',
    '<b>E-Dur:</b> der E-Powerchord mit offener E-Saite, dazu die Terz G# auf der G-Saite („die erste Note, die anders ist“), oben B (Quinte) und E (Grundton): <b>1-5-8-3-5-1</b>.',
    '<b>A-Dur:</b> der A-Powerchord 1-5-8, darüber die Terz und ganz oben die Quinte: <b>1-5-8-3-5</b>. „Genau derselbe Akkord“ wie E – wegen der B-Saite um eins nach oben verschoben.',
    '<b>D-Dur:</b> Powerchord auf der D-Saite, der kleine Finger <b>einen Bund höher</b> wegen der B-Saite. Oben liegt die Terz: <b>1-5-8-3</b>.'],
    m: '„Immer die drei tiefen Saiten dieser drei Akkorde haben einen Powerchord drin: 1-5-8.“',
    g: [{ n: 'E', iv: '1 3 5' }, { n: 'A', iv: '1 3 5' }, { n: 'D', iv: '1 3 5' }],
    ex: ['E:Greife E, A und D und spiele zuerst nur die drei tiefsten gegriffenen Saiten (den Powerchord), dann den ganzen Akkord. Sage, welcher Ton dazukommt (die Terz).'] },
  { id: 'k4-8', t: '4.8 Moll aus E, A, D', p: [
    '„Wieso brauche ich ein Buch, das mir zeigt, wie ich E-Moll oder D-Moll spiele? Wenn ich verstehe, dass der Unterschied in der Terz liegt.“',
    'In E, A und D gibt es nur <b>eine Terz</b>, der Rest ist 1 und 5. Die große Terz einen Halbton runter = kleine Terz.',
    '<b>E-Moll:</b> Finger der Terz (G-Saite) weg, die offene Saite klingt.',
    '<b>A-Moll:</b> Powerchord 1-5-8 und die Terz einen Halbton tiefer. „Lernt nicht A-Dur und A-Moll getrennt – das ist derselbe Akkord, Unterschied in der Terz.“',
    '<b>D-Moll:</b> Terz einen Halbton runter. <b>Dm7:</b> Zeigefinger flach – „zwei unter meiner 8 = kleine 7“. „Ich leite ihn mir ab.“',
    'G-Moll und C-Moll spielt er nicht offen: Dort steckt die Terz <b>zweimal</b> drin. Eine klein, eine groß klingt „als Schrammelakkord absolut kacke“. Dazu kommen die <b>Low Interval Limits</b>: tiefe kleine Terzen klingen schlecht. „Ich würde keinen G-Moll spielen.“'],
    g: [{ n: 'Em', iv: '1 b3 5' }, { n: 'Am', iv: '1 b3 5' }, { n: 'Dm', iv: '1 b3 5' }, { n: 'Dm7', iv: '1 b3 5 b7', cap: 'Zeigefinger flach' }],
    loop: [{ c: ['E', 'Em', 'A', 'Am', 'D', 'Dm'], bpm: 65, t: 'Dur ↔ Moll, je ein Takt' }],
    ex: ['L:Mache aus E, A und D Moll: die Terz einen Halbton tiefer.',
      'E:Dur↔Moll-Paare: Wechsle E/Em, A/Am, D/Dm, je 4 Schläge Dur und 4 Schläge Moll, etwa 60–70 BPM (Vorschlag). Geschafft, wenn du vorher sagst, welcher Ton sich ändert (die Terz).'] },
  { id: 'k4-9', t: '4.9 Barré: Technik und Prinzip', p: [
    'Viele hören beim Barré auf. Ein F-Barré ist am Anfang schwer, weil die Saiten nah am Sattel hoch liegen.',
    'Der Druck kommt nicht aus dem Quetschen („nicht diesen Schraubstock“), sondern vor allem aus <b>Zug nach hinten</b> mit dem Arm. Der Daumen liegt hinten in der Mitte. „Ich kann den F-Barré ohne Daumen spielen.“',
    '„Bisschen Zug nach hinten, bisschen drücken, dann kriegt ihr das hin.“',
    'Prinzip: Ein Barré ist kein anderer Akkord, sondern ein <b>offener Akkord, bei dem der Zeigefinger den Sattel spielt</b> – wie ein Kapodaster.'],
    m: '„Barré-Akkord ist ein offener Akkord, wo ihr Kapo spielt.“',
    g: [{ n: 'F', iv: '1 3 5', cap: 'E-Form im 1. Bund' }],
    ex: ['L:Barré-Technik: „Zug nach hinten“ statt Quetschen; probiere den F-Barré ohne Daumen.',
      'E:F-Barré-Zug-Übung: F im 1. Bund halten, ohne mit dem Daumen zu pressen, mit Zug nach hinten. 5 Anschläge, 10 Sekunden Pause. Geschafft, wenn alle Saiten klar klingen.'] },
  { id: 'k4-10', t: '4.10 Barré mit E-Form und A-Form', p: [
    '<b>E-Form:</b> Greife E-Dur statt mit 2-3-1 mit den Fingern <b>3-4-2</b>. Der Zeigefinger ist frei und liegt über allen Saiten, z. B. für F oder Fis/Gis.',
    'Moll: wie beim E-Moll den Terz-Finger weg. „Moll und Dur als Barré ist nichts anderes als Moll und Dur vom E, man verschiebt nur.“',
    '<b>A-Form:</b> A-Dur mit dem Zeigefinger als Sattel nach oben schieben. Der Grundton liegt auf der A-Saite.',
    'Damit die tiefe E-Saite nicht mitklingt, tippt der Zeigefinger sie leicht an. „Gewöhnt euch an, dass der Finger leicht an die tiefere Saite geht.“',
    '<b>Moll mit A-Form:</b> Terz einen Halbton tiefer.'],
    m: '„Leit mir die A-Dur-Form ab: vom Powerchord 1-5-8! Hängen wir eine Terz dran. Moll: Terz, mach sie klein.“',
    g: [{ n: 'F', iv: '1 3 5', cap: 'E-Form, 1. Bund' }, { n: 'Fm', fr: [1, 3, 3, 1, 1, 1], iv: '1 b3 5', cap: 'E-Form Moll' },
        { n: 'C', fr: [null, 3, 5, 5, 5, 3], iv: '1 3 5', cap: 'A-Form, 3. Bund' }, { n: 'Cm', fr: [null, 3, 5, 5, 4, 3], iv: '1 b3 5', cap: 'A-Form Moll' }],
    ex: ['L:E-Form umbauen auf die Finger 3-4-2, Zeigefinger frei als Sattel; dann die A-Form verschieben.',
      'L:Saiten-Kontrolle bei der A-Form: alle Saiten einzeln anschlagen und prüfen, dass die tiefe E-Saite nicht mitklingt.',
      'E:Saitenklang-Kontrolle: Nach jedem Barré-Griff alle Saiten einzeln anschlagen und merken, welche nicht klingt. Ziel: keine.'] },
  { id: 'k4-11', t: '4.11 Barré mit D-, C- und G-Form', p: [
    '<b>D-Form:</b> D-Dur mit den Fingern <b>2-4-3</b> greifen, Zeigefinger frei, zwei Bünde höher. Den Grundton greift der Zeigefinger. „Die drei schnell hinzulegen dauert ein bisschen, muss man üben.“',
    '<b>D-Form Moll:</b> große Terz → kleine Terz = ein verschiebbarer Moll-Akkord.',
    'Zusammen: Barré mit Grundton auf der <b>E-Saite</b> (Dur/Moll), auf der <b>A-Saite</b> (Dur/Moll) und auf der <b>D-Saite</b> (Dur „nicht so einfach“, und Moll).',
    '<b>C-Form:</b> Finger umbauen auf <b>4-3-2</b>, Zeigefinger frei, dann verschiebbar. Der Grundton liegt auf der <b>A-Saite</b> („Vorsicht!“). Moll gibt es hier nicht – die Terz kommt zweimal vor.',
    '<b>G-Form:</b> Der Zeigefinger greift D-, G- und B-Saite zwei Bünde tiefer – „nicht ganz so einfach“. „Der Rest ist ein G-Shape.“',
    'Alle fünf Formen lassen sich verschieben, nicht nur E und A. C und G sind als Moll schwierig. „Es gibt nur eine Terz – die kann man einfach nach unten boinken.“',
    'Auch im Barré kannst du abwandeln, z. B. aus der 8 eine 9 machen. „Da muss man nichts Kompliziertes lernen, man muss es spielen lernen.“'],
    g: [{ n: 'E', fr: [null, null, 2, 4, 5, 4], iv: '1 3 5', cap: 'D-Form, Grundton D-Saite 2. Bund' }, { n: 'Em', fr: [null, null, 2, 4, 5, 3], iv: '1 b3 5', cap: 'D-Form Moll' },
        { n: 'D', fr: [null, 5, 4, 2, 3, 2], iv: '1 3 5', cap: 'C-Form, Grundton A-Saite 5. Bund' }, { n: 'A', fr: [5, 4, 2, 2, 2, 5], iv: '1 3 5', cap: 'G-Form, Zeigefinger im 2. Bund' }],
    ex: ['L:D-Form mit den Fingern 2-4-3 und C-Form mit 4-3-2 umbauen, Zeigefinger frei als Sattel, dann verschieben.',
      'E:Wechsle E (D-Form) und Em (D-Form) je 4 Schläge und sage, welcher Finger die Terz greift.'] },
  { id: 'k4-12', t: '4.12 Arpeggios und Ausblick', p: [
    'Kennst du CAGED, kannst du über das ganze Griffbrett spielen. Beispiel: <b>E-Dur mit C-Shape</b> („Shape heißt Form“).',
    'Die Noten hintereinander gespielt sind ein <b>Arpeggio</b> – 1-3-5-8.',
    '„Wenn ich das CAGED-System verstehe, dann sind <b>Arpeggios eine reine Übungssache</b>, keine Verständnissache. Die Form kennt ihr schon.“',
    'Ausblick: Mit dem Powerchord erkennst du 1-5-8, die extra Note ist die Terz. Kennst du die Terz, findest du die kleine Terz, aber auch <b>2 und 4</b>.',
    'Als Nächstes: die Funktionen der Dur- und Moll-Akkorde in einer Tonart (Kapitel 5), danach die Sus-Akkorde mit 2 und 4 (Kapitel 6).'],
    g: [{ n: 'E', fr: [null, 7, 6, 4, 5, 4], iv: '1 3 5', arp: true, cap: 'C-Shape, Grundton A-Saite 7. Bund' }],
    ex: ['L:Spiele die Töne der Formen einzeln nacheinander (Arpeggio), z. B. E-Dur mit C-Shape.',
      'E:Spiele E-Dur als Arpeggio in zwei Formen (offen und C-Shape im 7. Bund) und sage dabei die Zahlen 1-3-5-8.'] }
] });

// ===== Kapitel 5 – Akkordfunktionen =====
Object.assign(PcKurs.CH, { G7: [3, 2, 0, 0, 0, 1], Am7: [null, 0, 2, 0, 1, 0], Bm7b5: [null, 2, 3, 2, 3, null], Em7: [0, 2, 2, 0, 3, 0], Fmaj7: [null, null, 3, 2, 1, 0] });
PcKurs.FO = [null, null, 3, 2, 1, 1];                                  // F offen (xx3211) für Folgen in C
PcKurs.K.push({ t: 'Kapitel 5 – Akkordfunktionen', s: [
  { id: 'k5-1', t: '5.1 Die Dur-Tonleiter und ihre Stufenakkorde', p: [
    'Die Funktionen der Akkorde in einer Dur-Tonleiter helfen später bei Entscheidungen: „mache ich eine Sus4 draus, kann ich Sus2 machen, will ich die 7 vermeiden?“ Das sind die <b>diatonischen Funktionen</b>.',
    'Abstandsformel der Dur-Tonleiter: <b>2-2-1-2-2-2-1</b> (2 = Ganzton, 1 = Halbton). Das Griffmuster kennst du schon (2-4 | 1-2-4 | 1-3-4).',
    'Baust du aus den 7 Tonleitertönen Dreiklänge, entstehen „unweigerlich“ bestimmte Akkorde. Beispiel <b>F-Dur</b> (F G A B-flat C D E): F-Dur, G-Moll, A-Moll, B-flat-Dur, C-Dur, D-Moll und E-Moll mit b5.',
    'Auf der 7. Stufe: „Das B als 5 steht uns nicht zur Verfügung, also B-flat“ – ein <b>verminderter</b> Akkord.',
    'Reihenfolge in <b>jeder</b> Dur-Tonart: <b>Dur, Moll, Moll, Dur, Dur, Moll, vermindert</b>.',
    'In C-Dur: <b>C, Dm, Em, F, G, Am, Bm(b5)</b>.',
    'Warum immer gleich? Die Abstände sind in jeder Tonart gleich; die Halbtonschritte liegen zwischen 3 und 4 und zwischen 7 und 8. Namen ändern sich, <b>Funktionen und Abstände nicht</b>.'],
    g: [{ n: 'C', iv: '1 3 5', cap: 'Stufe 1' }, { n: 'Dm', iv: '1 b3 5', cap: 'Stufe 2' }, { n: 'Em', iv: '1 b3 5', cap: 'Stufe 3' }, { n: 'F', fr: PcKurs.FO, iv: '1 3 5', cap: 'Stufe 4' },
        { n: 'G', iv: '1 3 5', cap: 'Stufe 5' }, { n: 'Am', iv: '1 b3 5', cap: 'Stufe 6' }, { n: 'Bm(b5)', r: 11, fr: [null, 2, 3, 4, 3, null], iv: '1 b3 b5', cap: 'Stufe 7 (vermindert)' }],
    loop: [{ c: ['C', 'Dm', 'Em', 'F', 'G', 'Am'], fr: { F: PcKurs.FO }, bpm: 65, t: 'Stufen 1–6 in C-Dur' }],
    ex: ['E:Stufen-Reihe in C-Dur: C – Dm – Em – F – G – Am, je 2 Schläge, 60–70 BPM (Vorschlag). Geschafft, wenn du die Stufe 1–6 ohne Nachdenken nennst.'] },
  { id: 'k5-2', t: '5.2 Tonika, Subdominante, Dominante', p: [
    'Aus der Schule: <b>Tonika (I), Subdominante (IV), Dominante (V)</b>. Alle drei sind Dur-Akkorde.',
    '<b>I = zu Hause.</b>',
    '<b>IV = schwebend:</b> „ich kann hier bleiben, aber ich muss noch mal hin, aber ich bin noch nicht zu Hause“.',
    '<b>V = instabil, will heim.</b> In C-Dur: C = zu Hause, F = Subdominante, G = Dominante, „will nach Hause zum C“.',
    'Warum zieht die Dominante? G-Dur = G-B-D. Das <b>B ist einen Halbton vom C weg</b> – der <b>Leitton</b>. Das B will hoch zum C, das D will runter zum C.',
    'Spielst du <b>G7</b> (Dominantseptakkord, mit kleiner 7), kommt das F dazu. Es will einen Schritt runter zur Terz E von C. Drei ziehende Töne – „ganz schlimm“.',
    'In einer anderen Tonart hat ein anderer Akkord diesen Zug (in F-Dur z. B. C-Dur).'],
    m: '1 stabil, 4 schwebend („is floaty“), 5 instabil – will auf die Eins fallen.',
    g: [{ n: 'C', iv: '1 3 5' }, { n: 'G', iv: '1 3 5' }, { n: 'G7', iv: '1 3 5 b7', cap: 'kleine 7 (F) dazu' }],
    loop: [{ c: ['C', 'F', 'G', 'C'], fr: { F: PcKurs.FO }, bpm: 70, t: 'I – IV – V – I' }],
    ex: ['L:Hörvergleich: Spiele I, IV, V in C-Dur nacheinander und höre die Wirkung (zu Hause / schwebend / will heim).',
      'E:Dominante hören: C – F – G und dort anhalten, erst dann C. Danach G7 statt G: Der Zug wird noch stärker.'] },
  { id: 'k5-3', t: '5.3 Die Moll-Akkorde = Parallelen', p: [
    'Die drei Moll-Akkorde (Stufe 2, 3, 6) heißen <b>Parallelen</b>.',
    'Die <b>6 ist die Tonikaparallele</b>, „immer eine kleine Terz drunter“: C-Dur hat <b>A-Moll</b> als Parallele.',
    'Die <b>2 ist die Parallele der 4</b>, die <b>3 die Parallele der 5</b>.',
    'Heißt: <b>1 und 6, 4 und 2, 5 und 3</b> haben ähnliche Funktionen und lassen sich austauschen.',
    'Warum? A-C-E enthält schon zwei Drittel von C-Dur. In <b>Am7 (A-C-E-G)</b> bleibt ohne das A genau C-Dur (C-E-G) übrig.',
    'Die Akkorde sind „ineinander verschachtelt“ – der Lehrer nennt das <b>Upper Structure Triad</b>.'],
    m: '„Wenn der Zug im Ohr ist, ich will auf die 1, dann kann ich die 6 nehmen.“',
    g: [{ n: 'Am7', iv: '1 b3 5 b7' }, { n: 'C', iv: '1 3 5' }],
    ex: ['E:Am7 enthält C: Spiele Am7 und dann C und höre, dass die oberen Töne (C, E, G) gleich bleiben.'] },
  { id: 'k5-4', t: '5.4 Ersetzen im Spiel: 6 statt 1, 2 statt 4', p: [
    'Spiele in C-Dur erst <b>I-IV-V-I</b>, dann <b>VI-IV-V-VI</b>: Am – F – G – Am („ich lasse die 1 komplett weg“). Er nennt das scherzhaft <b>„die Maidens“</b>, weil Iron Maiden das oft benutzt.',
    'Eine <b>Kadenz</b> ist: stabil → floaty → instabil → zurück zu stabil (I-IV-V-I).',
    '<b>Sekundärdominanten</b> sind „Dominanten, die wir uns ausleihen“ – später wichtig für Akkorderweiterungen.',
    'Mischformen gehen auch: 6-4-5-1 oder 1-4-5-1. Die bekannte <b>1-6-4-5</b>: „1 ein bisschen länger über 6, ist immer noch nur 1, dann 4-5“.',
    '<b>4 gegen 2 tauschen:</b> statt C-F-G-C spielst du <b>C-Dm-G-C</b>. „Die Funktionen sind gleich.“ „Das ist eigentlich die Standardkadenz.“'],
    loop: [{ c: ['Am', 'F', 'G', 'Am'], fr: { F: PcKurs.FO }, bpm: 75, t: 'VI – IV – V – VI („die Maidens“)' },
           { c: ['C', 'Am', 'F', 'G'], fr: { F: PcKurs.FO }, bpm: 75, t: 'I – VI – IV – V' },
           { c: ['C', 'Dm', 'G', 'C'], bpm: 75, t: 'I – II – V – I' }],
    ex: ['L:Spiele VI-IV-V-VI statt I-IV-V-I („die Maidens“).', 'L:Spiele I-VI-IV-V.', 'L:Spiele I-II-V-I statt I-IV-V-I.',
      'E:I-IV-V-VI-Hörspiel: In C je eine Minute I-IV-V-I, VI-IV-V-VI, I-VI-IV-V und I-II-V-I spielen und dir merken, wo „zu Hause“ liegt.'] },
  { id: 'k5-5', t: '5.5 Jazz und Songwriting', p: [
    'Im <b>Jazz</b> ist nicht I-IV-V Standard, sondern <b>2-5-1</b> (II-V-I), meist mit vierstimmigen Akkorden.',
    'Man kann eine 2-5 auf die nächste 2-5 ziehen lassen – „es hört nie auf und irgendwann muss das auflösen“.',
    'Das kommt daher, dass man die 4 gegen die 2 tauschen kann.'],
    m: 'Songwriting-Tipp: „Ich will nicht auf dem Happy-4 landen – probiert mal die 2. Die 1 – probiert mal die 6, funktioniert meistens.“',
    g: [{ n: 'Dm7', iv: '1 b3 5 b7' }, { n: 'G7', iv: '1 3 5 b7' }, { n: 'Cmaj7', iv: '1 3 5 7' }],
    loop: [{ c: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'], bpm: 70, t: '2 – 5 – 1 in C' }],
    ex: ['L:Songwriting: Statt der „Happy-4“ die 2 probieren, statt der 1 die 6.', 'L:Probiere eine 2-5-1 aus.'] },
  { id: 'k5-6', t: '5.6 Die 3 und die 7', p: [
    'Die <b>3</b> (in C-Dur E-Moll) ist die Parallele zur 5. Sie zieht „ein bisschen, aber nicht so wirklich“.',
    'E-Moll ist der obere Dreiklang von <b>Cmaj7 (C-E-G-B)</b>.',
    'Die <b>7</b> ist der verminderte Akkord, in C-Dur <b>Bm7b5</b> („Moll 7 b5“). Statt einer Quinte hat er eine <b>verminderte Quinte (b5, Bart Simpson)</b> – „keine kleine Quinte“.',
    'Bauanleitung: 1-5-8 + kleine Terz (aus der großen Terz „eine runter“) + die 5 einen Halbton tiefer = <b>Moll-Akkord mit b5</b>.',
    'Funktion: Er hat Dominant-Charakter – „eigentlich ein G7 ohne den Grundton“.',
    '<b>Halbvermindert</b> = 1, kleine Terz, verminderte Quinte, dazu die kleine 7. <b>Vollvermindert</b> hat nur kleine Terzen (mit verminderter Septime) und ist komplett symmetrisch.',
    'In Pop und Rock ist ein Moll7b5 „sehr unwahrscheinlich“. „Man muss das wissen, man muss ihn können, aber funktionsmäßig verwendet man ihn sehr selten.“'],
    g: [{ n: 'Cmaj7', iv: '1 3 5 7' }, { n: 'Bm7b5', iv: '1 b3 b5 b7' }, { n: 'G7', iv: '1 3 5 b7' }],
    ex: ['E:Spiele G7 und danach Bm7b5 und vergleiche: Die Töne B, D, F kommen in beiden vor (G7 ohne Grundton).'] },
  { id: 'k5-7', t: '5.7 Bilanz: was oft und was selten ersetzt wird', p: [
    'I-IV-V-I immer. <b>1 gegen 6:</b> absolut. <b>2 gegen 4:</b> absolut (Standard).',
    'Die 3 seltener, eher nicht als Ersatz für die 5. Die 7 selten.',
    'Berühmte Folge <b>1-5-6-4</b> (<b>Axis of Awesome</b>) – in Folk, Punk, Pop und Rock; es gibt Videos dazu.',
    'Ähnlichkeiten: <b>6 ≈ 1, 2 ≈ 4, 3 ≈ 5</b> (aber mehr 1), <b>7 ≈ 5</b> mit Vorsicht.',
    'Ausblick: Bei der Dominante will er später die kleine 7 weglassen und stattdessen Sus4 oder andere Erweiterungen einsetzen.'],
    loop: [{ c: ['C', 'G', 'Am', 'F'], fr: { F: PcKurs.FO }, bpm: 80, t: '1 – 5 – 6 – 4 (Axis of Awesome)' }],
    ex: ['E:Spiele 1-5-6-4 in C (C – G – Am – F) und danach 6-4-1-5 (Am – F – C – G). Sage, welcher Akkord sich nach „zu Hause“ anfühlt.'] }
] });

// ===== Kapitel 6 – Sus- und Add-Akkorde =====
Object.assign(PcKurs.CH, { Esus4: [0, 2, 2, 2, 0, 0], Asus4: [null, 0, 2, 2, 3, 0], Dsus4: [null, null, 0, 2, 3, 3], Asus2: [null, 0, 2, 2, 0, 0], Dsus2: [null, null, 0, 2, 3, 0],
  Csus4: [null, 3, 3, 0, 1, 1], Gsus4: [3, null, 0, 0, 1, 3], Csus2: [null, 3, 0, 0, 1, 3], Cadd9: [null, 3, 2, 0, 3, 0], Gadd9: [3, 2, 0, 2, 0, 3] });
PcKurs.K.push({ t: 'Kapitel 6 – Sus- und Add-Akkorde', s: [
  { id: 'k6-1', t: '6.1 Was ist Sus?', p: [
    'Bisher: Powerchord, Intervalle und ihre Namen, Tonleiter, CAGED-Akkorde, Stufenakkorde. Jetzt „geht es wirklich ans Eingemachte“.',
    '<b>Sus = suspended</b>, also „schweben“ oder „aussetzen“. Es gibt <b>Sus2</b> und <b>Sus4</b>.',
    'Dur = 1 – große Terz – 5. Moll = 1 – kleine Terz – 5. <b>Sus = keine Terz</b>, „eine andere Art von Dreiklang“.',
    'Sus klingt nicht fröhlich oder traurig, sondern offener – und ist <b>kompatibler mit Verzerrung</b>.',
    '<b>Sus2</b> geht fast überall, „außer auf zwei Akkorden innerhalb der Tonleiter“.',
    '<b>Sus4</b> hat eine klare Funktion: Man nimmt sie gern auf der <b>5 (Dominante)</b>, um den Zug abzuschwächen.'],
    m: 'Schlüsselwort: „Anstatt der Drei“ – da ist eine 2 oder eine 4.',
    g: [{ n: 'A', iv: '1 3 5' }, { n: 'Asus2', iv: '1 2 5' }, { n: 'Asus4', iv: '1 4 5' }],
    ex: ['E:Spiele A, Asus2 und Asus4 nacheinander und sage jeweils die Formel: 1-3-5, 1-2-5, 1-4-5.'] },
  { id: 'k6-2', t: '6.2 Sus4 bauen', p: [
    '„Wenn ihr wisst, wo die 3 ist, dann ist es die 4.“ Ausgangspunkt: Powerchord 1-5-8 plus die 3.',
    'So wie aus Dur ein Moll wurde, machst du ein Sus4: <b>die 3 „killen“ und den kleinen Finger reinlegen</b> – aus der 3 wird eine 4.',
    'Bei <b>Esus4, Asus4, Dsus4</b> geht das ganz einfach, weil die Terz nur einmal vorkommt: die Terz je einen Bund hoch.',
    '<b>Csus4:</b> Im C-Griff gibt es zwei Terzen. Beide müssen gegen die 4 getauscht werden. „Die Terz muss bei einem Sus-Akkord ausgetauscht werden gegen die 4 oder die 2.“',
    '<b>Gsus4:</b> auch zwei Terzen. Meist <b>blockierst du die A-Saite</b> (Finger leicht auflegen). „Anstatt B habe ich C, das ist meine 4.“',
    '<b>Barré:</b> In E-Form und A-Form findest du über der 3 die 4 und setzt dort den Sus4-Finger. Bei der C-Form-Barré „geht das einfach nicht“, bei der G-Form nur mit viel Streckerei.'],
    m: '„Finde die 3, finde die 4.“ – „So spielt man ein Sus: man findet die Drei und tauscht sie aus.“',
    g: [{ n: 'Esus4', iv: '1 4 5' }, { n: 'Asus4', iv: '1 4 5' }, { n: 'Dsus4', iv: '1 4 5' }, { n: 'Csus4', iv: '1 4 5', cap: 'beide Terzen getauscht' },
        { n: 'Gsus4', iv: '1 4 5', cap: 'A-Saite blockiert' }, { n: 'Csus4', fr: [null, 3, 5, 5, 6, 3], iv: '1 4 5', cap: 'A-Form-Barré, 3. Bund' }],
    ex: ['L:Dur → Sus4: Terz-Finger weg, kleinen Finger auf die 4 legen.', 'L:Spiele Esus4, Asus4 und Dsus4 durch.'] },
  { id: 'k6-3', t: '6.3 Sus2 bauen', p: [
    '„Ich habe euch gezeigt, wo die 3 ist, dann wisst ihr doch, wo die 2 ist.“',
    'Beim E-Dur liegt die 2 unter der b3. Auf der G-Saite geht das nicht – es wäre tiefer als die leere Saite.',
    'Wichtige Regel: „In welcher Oktave das ist, ist egal. <b>Solange keine 3 drin ist, aber die 2 oder 4, ist es ein Sus-Akkord.</b>“',
    '<b>Asus2:</b> „Was ist unter der b3? Die 2. Finger weg = Asus2.“',
    '<b>Dsus2:</b> Mittelfinger weg, die leere Saite klingt.',
    'Beispiel aus Songs: Bei Bon Jovi steht im Notentext D, Dsus4, D, Dsus2, D. Das ist „super einfach“.'],
    m: 'Reihenfolge der Töne: 4 – 3 – b3 – 2 (von Sus4 über Dur und Moll zu Sus2, jeweils tiefer).',
    g: [{ n: 'D', iv: '1 3 5' }, { n: 'Dsus4', iv: '1 4 5' }, { n: 'Dsus2', iv: '1 2 5', cap: 'Mittelfinger weg' }, { n: 'Asus2', iv: '1 2 5', cap: 'Finger weg' }],
    loop: [{ c: ['D', 'Dsus4', 'D', 'Dsus2'], bpm: 70, t: 'D – Dsus4 – D – Dsus2' }],
    ex: ['L:Asus2: Finger auf der b3 weg. Dsus2: Mittelfinger weg.', 'L:Wechselmuster D – Dsus4 – D – Dsus2 – D.',
      'E:Dur/Sus2/Sus4-Wechsel auf A, D, E: je 4 Schläge Dur – Sus4 – Dur – Sus2 (beim E nur Sus4), etwa 70 BPM (Vorschlag). Geschafft, wenn du vorher sagst, welcher Finger wandert.'] },
  { id: 'k6-4', t: '6.4 Sus2 als „Ear Candy“ für Verzerrung', p: [
    'Sus2 hat neutralen Charakter, „wunderbar für verzerrte Akkorde“. Zur Würze: „bisschen Zucker drauf“ – <b>Ear Candy</b>.',
    'Statt eines Powerchords: <b>Powerchord + die 2</b>. Beim A: Powerchord auf A und die oberen Saiten offen – „klingt fast nie falsch“. Beim D den Mittelfinger weg = Dsus2. Beim E „macht man das eigentlich nicht“.',
    '<b>Powerchord + Barré der oberen Saiten:</b> „Das ist einfach überall geil.“ Auf der A-Saite einfach, auf der E-Saite schwieriger.',
    'Ohne Strecken: <b>statt 1-5-8 spielst du 1-5-9</b>. Verzerrt „auch geil“.'],
    g: [{ n: 'Asus2', iv: '1 2 5', cap: 'Powerchord A + offene Saiten' }, { n: 'Csus2', fr: [null, 3, 5, 5, 3, 3], iv: '1 2 5', cap: 'Powerchord + Barré oben' },
        { n: 'C 1-5-9', r: 0, fr: [null, 3, 5, 7, null, null], nine: true, iv: '1 5 9', cap: 'statt der 8 die 9' }],
    ex: ['L:Powerchord + 2 mit offenen oberen Saiten auf A und D; Powerchord mit Barré der oberen Saiten.',
      'E:Spiele mit Verzerrung erst C5 (A-Saite 3. Bund), dann Csus2 mit Barré oben, dann 1-5-9. Höre, was die 2 dazugibt.'] },
  { id: 'k6-5', t: '6.5 Auf welchen Stufen geht Sus2?', p: [
    'Überall, wo der Akkord eine (große) 2 hat. In C-Dur: Csus2 geht (D).',
    '<b>E-Moll (Stufe 3)</b> hat keine 2, sondern eine <b>b2</b> (E–F ist ein Halbton). Ein Sus2 wäre dort tonartfremd: „Ihr könnt natürlich Regeln brechen und wild sein“, aber „ihr bleibt dann nicht in der Tonart“.',
    'Stufe 4 (F): die 2 ist G – geht. Stufe 5 (G): A – geht. Stufe 6 (Am): B – „wunderbar“.',
    '<b>Stufe 7 (Bm b5):</b> B–C ist ein Halbton – geht nicht.',
    'Eine b2 bzw. b9 nur „mit sehr viel Vorsicht“.'],
    m: '„Auf der 3 und der 7 darf man die 2 nicht verwenden. Ihr dürft schon, aber ihr seid gewarnt.“',
    ex: ['L:Sus-Tonart-Check: Prüfe für jede Stufe, ob ihre 2 in der Tonart liegt.',
      'E:Stufen-Check in C-Dur: Nenne für C, Dm, Em, F, G, Am, Bm7b5 die 2 (D, E, F, G, A, B, C) und prüfe, ob sie einen Ganzton über dem Grundton liegt. Geschafft, wenn du sagst: „3 und 7 nicht“.'] },
  { id: 'k6-6', t: '6.6 Sus4: die Dominante schwächen', p: [
    'Die 4 hat „wichtigere Positionen“: <b>Sus4 schwächt die Dominantfunktion der 5.</b>',
    'Beispiel C-Dur: Spiele <b>Gsus4 statt G</b>. Das D will aufs C, das B will aufs C – im Gsus4 liegt die 4 (C) schon da. „Ich bin schon auf dem C.“ Der Halbton-Zug ist weg.',
    'Der Sus4 „möchte auf die Dur-Variante von sich selbst“: <b>Gsus4 → G</b>.',
    '<b>Spannung aufbauen:</b> erst mit Sus4 Spannung rausnehmen, dann kommt der Dur-Akkord, und mit der kleinen 7 (G7) „sagt jeder: der muss nach Hause“.',
    'Am häufigsten nimmt man Sus4 genau auf der 5.',
    'Auf der 2 (Dm) hat Sus4 diesen Charakter nicht. Auf der 1 (Csus4): Dur-Charakter weg, „offene Weite“, „monoton, stabil, aber ich geh in die Weite“.'],
    m: '„Ihr seid diejenigen, die sagen, wo es langgeht und was der Zuhörer erwartet.“',
    g: [{ n: 'Gsus4', iv: '1 4 5' }, { n: 'G', iv: '1 3 5' }, { n: 'G7', iv: '1 3 5 b7' }],
    loop: [{ c: ['C', 'Gsus4', 'G', 'G7'], bpm: 70, t: 'Gsus4 → G → G7 → (C)' }, { c: ['C', 'Csus4', 'C', 'Gsus4', 'G', 'C'], bpm: 70, t: 'Dominante abschwächen' }],
    ex: ['L:Höre Gsus4 → G und spiele Gsus4 – G – G7 für Spannung.',
      'E:Dominante abschwächen in C-Dur: C – Csus4 – C – Gsus4 – G – C. Geschafft, wenn du hörst: Gsus4 zieht weniger als G.'] },
  { id: 'k6-7', t: '6.7 Auf welchen Stufen geht Sus4?', p: [
    '<b>Nicht auf der 4. Stufe:</b> Über F liegt als 4 ein B-flat – „den gibt es nicht in C-Dur“. Es klingt, als wärst du plötzlich in F-Dur.',
    'Auf der 4. Stufe wäre die <b>übermäßige Quarte (#4 = #11)</b> richtig. Das ist kein Sus-Akkord, sondern ein „cooler Akkord“: Klang „Sternenhimmel, Weite“, wie bei John Williams (Star Wars) – „ich komm nicht nach Hause, aber ich will ja nicht nach Hause“.',
    'Regelbruch: Eddie Van Halen schiebt auf der 4. Stufe trotzdem Sus4 und Dur hin und her – „irgendwie funktioniert das“.',
    'Zusammenfassung: <b>Sus2</b> ist super für Verzerrung und schwächt Dur/Moll ab. <b>Sus4 auf der 5</b> schwächt die Dominante und zieht auf die Dur-Version der 5. Sus2 auf 3 und 7 vermeiden („haben b2, klingt kacke“).'],
    m: '„Die 4 überall verwenden außer auf der 4. Stufe.“',
    ex: ['L:Sus-Tonart-Check: Prüfe für jede Stufe, ob ihre 4 in der Tonart liegt (in C-Dur fällt F mit B-flat heraus).',
      'E:Spiele in C-Dur Csus4, Dsus4, Gsus4 und dann Fsus4 und höre, warum Fsus4 nach einer anderen Tonart klingt.'] },
  { id: 'k6-8', t: '6.8 Add9 und Add11 – Extensions', p: [
    '<b>Ohne Terz</b> sind 2 und 4 wichtige Akkordtöne: 1-2-5 oder 1-4-5.',
    '<b>Mit Terz</b> hörst du Dur oder Moll. Kommt eine 2 oder 4 dazu, ändert das fast nichts am Charakter. Dann heißen sie <b>9 oder 11</b> – Akkorderweiterungen (Extensions): „außer dass sie schön sind, nicht wirklich irgendwas zu melden“.',
    '<b>Cadd9:</b> Im C-Griff liegt auf der B-Saite ein zweites C. Spiele stattdessen die 2 (D) – „weil ich hier die Terz hab“. „Ändert an meinem C gar nichts, ist immer noch ein C.“',
    '<b>Gadd9:</b> statt eines zweiten G ein A. „Ich nenne es nicht 2, weil ich Terzen drin habe“ – add heißt dazu addieren. „Ich klinge immer noch nach einem Dur-Akkord.“',
    '<b>E-Moll mit 9:</b> Die Moll-Terz bleibt, die 9 kommt oben dazu – „nicht E-Moll2, sondern E-Moll9, weil diese 2 einfach nur eine schöne Note ist“.',
    'Methode: „Gucken, wo die 3 ist, verschieben, gucken wo die 1 ist.“',
    '<b>Vorsicht b9:</b> E unten, F oben = b9 („Oktave und Halbtonschritt“). Sein Arrangierlehrer: „That’s kaka, flat nine party.“ Regel: <b>keine b9, außer sie wird ausdrücklich verlangt.</b>'],
    g: [{ n: 'Cadd9', nine: true, iv: '1 3 5 9', cap: 'B-Saite: D statt C' }, { n: 'Csus2', iv: '1 2 5', cap: 'ohne Terz = Sus' },
        { n: 'Gadd9', nine: true, iv: '1 3 5 9', cap: 'Standardgriff' }, { n: 'Em(add9)', r: 4, fr: [0, 2, 2, 0, 0, 2], nine: true, iv: '1 b3 5 9', cap: 'Standardgriff' }],
    ex: ['L:Spiele C-add9 und G-add9.', 'L:Spiele E-Moll mit 9.',
      'E:Add9 statt Sus: Spiele Cadd9 und Csus2 nacheinander. Geschafft, wenn du hörst: Cadd9 klingt noch nach Dur, Csus2 neutral.'] },
  { id: 'k6-9', t: '6.9 Add9 im Barré', p: [
    'E-Form-Barré: <b>1-5-8 + große Terz, aus der 8 eine 9</b> (nicht b9) = <b>C-add9</b>. „Klingt supergeil, bisschen stressig zu spielen.“',
    '<b>Als Moll:</b> die Terz klein – 1-5-9-kleine Terz, „so viel einfacher“.',
    'Pointe bei The Police („Message in a Bottle“): „Jeder Schlaue müsste sagen: wo sind die Dur-/Moll-Terzen? Das sind keine Neuner, das waren alles Sus2.“'],
    g: [{ n: 'Cadd9', fr: [8, 10, 12, 9, 8, 8], nine: true, iv: '1 3 5 9', cap: 'E-Form, 8. Bund' }, { n: 'Cm(add9)', r: 0, fr: [8, 10, 12, 8, 8, 8], nine: true, iv: '1 b3 5 9', cap: 'E-Form Moll' }],
    ex: ['E:Greife C (E-Form, 8. Bund), mache aus der 8 auf der D-Saite eine 9 und dann die Terz klein. Vergleiche Cadd9 und Cm(add9).'] },
  { id: 'k6-10', t: '6.10 Add11', p: [
    '„Kann ich hier irgendwo eine 11 reinmachen?“ Wird aus der 3 eine 4, ist die Terz weg – dann ist es ein Sus-Akkord. „Ich möchte keinen Sus-Akkord, ich möchte einen Elf.“',
    'Eine 11 mit Terz tief unten wird „ziemlich matschig“. <b>Erweiterungen sind besser verdaulich, wenn sie höher liegen.</b>',
    'Lösung: Die Terz bleibt, die <b>Quinte gibst du auf</b> („ich spare die 5“). Der Zeigefinger ist frei und greift mit einem „bösen Strecker“ zwei Bünde tiefer die 4 (die 11). Die A-Saite blockieren. Am schönsten arpeggiert.',
    'Als Moll: <b>Am(add11)</b> – die Quinte kann weg, „die füllt nur“. Mit kleiner 7 wird es <b>Am7(11)</b>: „klingt super kompliziert, viel einfacher zu spielen als der andere“.'],
    g: [{ n: 'Am7(11)', r: 9, fr: [null, 0, 0, 0, 1, 0], nine: true, iv: '1 b3 5 b7 11', arp: true, cap: 'Standardgriff (offen)' }],
    ex: ['L:Spiele A-Moll 7 11 (Am7(11)).', 'E:Zupfe Am7(11) einzeln von tief nach hoch und sage die Zahlen 1, 11, b7, b3, 5.'] },
  { id: 'k6-11', t: '6.11 Beispiel: Joe Satriani – „Always with me, always with you“', p: [
    '„Ein Meisterwerk des einfachen Liedes, geil arrangiert“: im Grunde <b>I-IV-V-I in B-Dur</b>.',
    'Er schwächt die 4 zur <b>Sus4</b>, nimmt die <b>6 (Moll) statt der 1</b>, dann wieder 4 und Sus4, und ganz am Ende geht er auf die <b>Dominante als Dur</b>.',
    'Statt der 1 spielt er B-Dur mit 11 – „wie wir es eben umgesetzt haben“. Später kommen Fis-Sus4 und Gis-Moll 7 11 („genau den Akkord, den wir eben hatten“).',
    '„Er macht genau das, was ich gesagt habe.“ Aus einer „super billigen 1-4-5-1“ wird eines der meistgeliebten Instrumentals der E-Gitarrenwelt.'],
    m: '„Sus-Akkorde sind keine Scheiße.“',
    ex: ['E:Hör dir „Always with me, always with you“ an und achte darauf, wo statt der 1 die 6 (Moll) kommt und wo eine Sus4 die 4 abschwächt.'] }
] });

// ===== Kapitel 7 – 7er-Akkorde =====
Object.assign(PcKurs.CH, { E7: [0, 2, 0, 1, 0, 0], Amaj7: [null, 0, 2, 1, 2, 0], A7: [null, 0, 2, 0, 2, 0], Dmaj7: [null, null, 0, 2, 2, 2], D7: [null, null, 0, 2, 1, 2],
  Gmaj7: [3, 2, 0, 0, 0, 2], C7: [null, 3, 2, 3, 1, 0] });
PcKurs.AL = { Am7: [5, null, 5, 5, 5, null], D7: [null, 5, 7, 5, 7, 5], Gmaj7: [3, null, 4, 4, 3, null], Cmaj7: [null, 3, 5, 4, 5, 3], 'F#m7b5': [2, null, 2, 2, 1, null], B7: [null, 2, 4, 2, 4, 2], Em7: [0, null, 0, 0, 0, null] };
PcKurs.K.push({ t: 'Kapitel 7 – 7er-Akkorde', s: [
  { id: 'k7-1', t: '7.1 Einstieg: die zwei Siebenen', p: [
    'Rückblick: Barré-Akkorde, Sus und Add. Jetzt geht es um „die Sieben“.',
    'Wiederholung Akkordsymbole: <b>nur die Zahl 7 = kleine 7</b>; die große heißt <b>Major 7 / M7 / Dreieck7</b>. Er sagt in dieser Lektion deshalb immer extra „kleine Sieben“ und „große Sieben“.',
    'Reihenfolge: <b>erst die 7er in offenen Akkorden, dann im Barré</b>. Drop-2- und Drop-3-Voicings und Umkehrungen kommen in der nächsten Lektion – „Barré-Akkorde sind eigentlich schon Drops“.'],
    ex: ['E:Sage zu C7, Cmaj7, CM7 und Cm7, welche 7 drin ist und ob die Terz groß oder klein ist.'] },
  { id: 'k7-2', t: '7.2 Welche 7 gehört auf welche Stufe?', p: [
    'Es geht um die Akkorde in einer Dur-Tonleiter: Dur, Moll, Moll, Dur, Dur, Moll, halbvermindert; Abstände 2-2-1-2-2-2-1.',
    '<b>Halbvermindert:</b> kleine Terz, kleine Terz, dann große Terz – ein Moll-Akkord mit verminderter Quinte, aber kleiner 7. <b>Vollvermindert</b> ist symmetrisch, nur kleine Terzen – „das interessiert jetzt aber nicht“.',
    'In C-Dur zählt er <b>von der 8 rückwärts</b>:',
    '<b>Stufe 1 (C):</b> Der Ton unter der 8 ist nur einen Halbton entfernt (B–C) → große 7 → <b>Cmaj7</b>.',
    '<b>Stufe 2 (D):</b> Unter D liegt C, zwei Halbtöne → kleine 7 → <b>Dm7</b>.',
    '<b>Stufe 3 (E):</b> Unter E liegt D, zwei Halbtöne → kleine 7 → <b>Em7</b>.',
    '<b>Stufe 4 (F):</b> Unter F liegt E, ein Halbton → große 7 → <b>Fmaj7</b>.',
    'Die übrigen Stufen haben eine kleine 7: <b>G7, Am7, Bm7b5</b>.',
    'Leider auswendig: 2-2-1-2-2-2-1; Dur-Moll-Moll-Dur-Dur-Moll-halbvermindert; A bis G; 1 bis 7; 1, 4, 5, 8 rein, 2, 3, 6, 7 groß/klein; Bart Simpson. Vieles andere „könnt ihr euch ableiten – wir sind hier Ableiter, nicht Harmonie-Lerner“.'],
    m: '„Einfach gucken, wo die Halbtonschritte sind: E–F und B–C. Der Ton drüber hat eine große 7. Auf der ersten und vierten Stufe, in jeder Tonart, eine große 7, alle anderen haben eine kleine.“',
    g: [{ n: 'Cmaj7', iv: '1 3 5 7', cap: 'I' }, { n: 'Dm7', iv: '1 b3 5 b7', cap: 'II' }, { n: 'Em7', iv: '1 b3 5 b7', cap: 'III' }, { n: 'Fmaj7', iv: '1 3 5 7', cap: 'IV' },
        { n: 'G7', iv: '1 3 5 b7', cap: 'V' }, { n: 'Am7', iv: '1 b3 5 b7', cap: 'VI' }, { n: 'Bm7b5', iv: '1 b3 b5 b7', cap: 'VII' }],
    loop: [{ c: ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5'], bpm: 60, t: 'Stufen-7er in C-Dur' }],
    ex: ['L:Leite pro Stufe von C-Dur die 7 ab: von der 8 aus rückwärts zählen, auf E–F und B–C achten.',
      'E:Stufen-7er in C-Dur: Cmaj7 – Dm7 – Em7 – Fmaj7 – G7 – Am7 – Bm7b5, je 4 Schläge, 60 BPM (Vorschlag), und sage jeweils den Typ. Geschafft, wenn du vorher weißt, welche Stufe eine große 7 hat.'] },
  { id: 'k7-3', t: '7.3 Offene Akkorde mit 7', p: [
    '„Nicht super relevant … damit könnte man bestimmt 100 Songs spielen, wir machen es trotzdem.“',
    'Grundprinzip: Powerchord 1-5-8. <b>Direkt unter der 8 liegt die große 7, zwei Halbtöne unter der 8 die kleine 7.</b>',
    '<b>E:</b> Die große 7 direkt unter der 8 ist „zu tief, matschig“ (Low Interval Limits). Aus der 8 die kleine 7 = <b>E7</b>: „der ist geil und den kennt man auch“.',
    '<b>A:</b> „Was hier zu tief war, ist jetzt eine Quarte höher und klingt besser.“ <b>Amaj7:</b> 8 → große 7. <b>A7:</b> Finger weg, offene Saite – zwei Halbtöne unter der 8.',
    '<b>D:</b> dasselbe Prinzip – die 8 auf der B-Saite einen Halbton tiefer (Dmaj7) bzw. zwei Halbtöne tiefer (D7).',
    '<b>Moll:</b> <b>Em7</b> mit dem kleinen Finger oben, weil es unten zu matschig wäre. Moll mit großer 7 gibt es auch – „wer braucht’s? Ich nicht“. <b>Am7:</b> Finger weg (offene Saite) oder den kleinen Finger oben auf die kleine 7 – „vielleicht schöner mit der 7 oben“, jetzt vierstimmig. <b>Dm7:</b> 2 Halbtöne unter der 8.',
    '<b>G:</b> Die 8 oben einen Halbton tiefer = <b>Gmaj7</b>, noch einen tiefer = <b>G7</b> („den spielt man relativ früh“).',
    '<b>C:</b> Cmaj7 (Finger auf der B-Saite weg). <b>C7:</b> die kleine 7 mit dem kleinen Finger dazu. „C7 ist automatisch die Dominante, die 5 von F.“',
    'Fazit: „Offene Akkorde abgehakt, … damit geht eben nicht alles.“'],
    g: [{ n: 'E7', iv: '1 3 5 b7' }, { n: 'Amaj7', iv: '1 3 5 7' }, { n: 'A7', iv: '1 3 5 b7' }, { n: 'Dmaj7', iv: '1 3 5 7', cap: 'Standardgriff' }, { n: 'D7', iv: '1 3 5 b7', cap: 'Standardgriff' },
        { n: 'Em7', iv: '1 b3 5 b7' }, { n: 'Am7', iv: '1 b3 5 b7' }, { n: 'Am7', fr: [null, 0, 2, 2, 1, 3], iv: '1 b3 5 b7', cap: '7 oben, vierstimmig' }, { n: 'Dm7', iv: '1 b3 5 b7' },
        { n: 'Gmaj7', iv: '1 3 5 7' }, { n: 'G7', iv: '1 3 5 b7' }, { n: 'Cmaj7', iv: '1 3 5 7' }, { n: 'C7', iv: '1 3 b7', cap: 'ohne Quinte' }],
    ex: ['L:Spiele die offenen Akkorde mit 7 durch Ableiten: E7, Amaj7/A7, Dmaj7/D7, Em7, Am7, Dm7, Gmaj7/G7, Cmaj7/C7.',
      'E:Offene 7er-Paare: je 4 Schläge Maj7 – 7 – Dur, z. B. Cmaj7 ↔ C7, Gmaj7 ↔ G7, Amaj7 ↔ A7, Dmaj7 ↔ D7. Geschafft, wenn du hörst: Maj7 klingt weich, 7 „zieht“.'] },
  { id: 'k7-4', t: '7.4 Die 7 als Terzschichtung – und Tonart erkennen', p: [
    'Die 7 ist eine <b>Terz-Erweiterung</b>: Akkorde bauen sich in Terzen auf.',
    '<b>Major 7</b> = 1, große Terz, kleine Terz, große Terz.',
    '<b>Dominant 7</b> = 1, große Terz, kleine Terz, kleine Terz – das gibt es nur auf der 5. Stufe.',
    '<b>Moll 7</b> = 1, kleine Terz, große Terz, kleine Terz.',
    '„Wir haben drei Dur-Akkorde: 1, 4, 5. <b>1 und 4 haben große 7, nur die 5 ist ein Dur-Akkord mit kleiner 7.</b>“ Der Fachbegriff ist Dominantseptakkord.',
    '<b>Tonart erkennen:</b> Siehst du ein X7-Dur, ist es meist die 5 von etwas: D7 → 5 von G → wahrscheinlich G-Dur. Es7 → 5 von As.',
    'Ausnahmen: Blues (alles Dominant-7), Jazz, Sekundärdominanten. „Ja, aber was ich gesagt hab, stimmt schon.“'],
    ex: ['E:Dominante erkennen: Nenne zu D7, G7, C7, A7, E7 die Tonart (G, C, F, D, A). Geschafft, wenn du „5 von …“ sofort sagst.'] },
  { id: 'k7-5', t: '7.5 7er im Barré: Grundton A-Saite', p: [
    'Barré baust du wie in Kapitel 4. „Die Töne sind irrelevant, es gilt für alles.“',
    '<b>Maj7:</b> 1-5-8 – „hier ist die 8, die Major 7 ist eins drunter“. Finger umsetzen → <b>Cmaj7</b>, ein „typischer Standard-Jazz-Akkord“.',
    '<b>Dominant 7:</b> Die kleine 7 liegt noch einen Halbton darunter; vorne den Finger flach legen → <b>C7</b>.',
    '<b>Moll 7:</b> „sieht aus wie ein A-Moll, nur verschoben“. Statt Dur-Terz die Moll-Terz → <b>Cm7</b>. „Nix Kompliziertes.“',
    '<b>Halbvermindert (m7b5):</b> die Quinte einen Halbton tiefer. Als Barré „total bescheuert“ – greife <b>alle vier Noten</b>: Zeigefinger auf den Grundton, ein Finger einen Bund höher auf der D-Saite, der kleine Finger zwei Saiten höher im selben Bund. Die E-Saite ist nicht dabei.',
    'Töne von tief nach hoch: <b>1, b5, kleine 7, kleine 3</b>.',
    '„Das sind die Akkorde auf der A-Saite, und das sind Drop 2s“ – das ist die nächste Lektion.'],
    g: [{ n: 'Cmaj7', fr: [null, 3, 5, 4, 5, 3], iv: '1 3 5 7' }, { n: 'C7', fr: [null, 3, 5, 3, 5, 3], iv: '1 3 5 b7' },
        { n: 'Cm7', fr: [null, 3, 5, 3, 4, 3], iv: '1 b3 5 b7' }, { n: 'Cm7b5', fr: [null, 3, 4, 3, 4, null], iv: '1 b3 b5 b7', cap: '1, b5, b7, b3' }],
    ex: ['L:Leite die Barré-Reihe aus einem Grundgriff ab (Grundton A-Saite): Dur → Maj7 → 7 → Moll7 → m7b5, „damit man sieht, wie sich was verschiebt“.',
      'E:Ein Grundton, vier Typen: Grundton C (A-Saite 3. Bund): Cmaj7 – C7 – Cm7 – Cm7b5, je 2 Schläge, jeden Typ aus dem vorigen umbauen. Geschafft, wenn du kein Griffbild suchen musst.'] },
  { id: 'k7-6', t: '7.6 7er im Barré: Grundton D-Saite', p: [
    '„Genau dasselbe wie das hier, nur durch den Versatz der B-Saite müssen wir hier einen höher machen.“',
    '<b>D-Shape:</b> Maj7 = aus der 8 die Major 7. Dann wie auf der A-Saite weiter: kleine 7, Moll-Terz, und für halbvermindert die Quinte einen Halbton tiefer.'],
    m: '„Man lernt nicht vier Akkordbilder. Das ist bescheuert. Lernt das Akkordbild und dann die Variation.“',
    g: [{ n: 'Fmaj7', fr: [null, null, 3, 5, 5, 5], iv: '1 3 5 7' }, { n: 'F7', fr: [null, null, 3, 5, 4, 5], iv: '1 3 5 b7' },
        { n: 'Fm7', fr: [null, null, 3, 5, 4, 4], iv: '1 b3 5 b7' }, { n: 'Fm7b5', fr: [null, null, 3, 4, 4, 4], iv: '1 b3 b5 b7' }],
    ex: ['L:Leite die Reihe auf der D-Saite ab: Maj7 → 7 → Moll7 → m7b5, und sieh dir an, wie sich was verschiebt.',
      'E:Spiele die Reihe auf der A-Saite (Grundton C) und direkt danach auf der D-Saite (Grundton F). Sage, welcher Ton sich bei jedem Schritt bewegt.'] },
  { id: 'k7-7', t: '7.7 7er im Barré: Grundton tiefe E-Saite (Drop 3)', p: [
    'Problem: Eine Major 7 auf der tiefen Saite ist matschig.',
    'Lösung: <b>die Quinte weglassen</b> („Sorry Quinte, kein Platz hier“) – sie liegt oben auf der B-Saite schon. Der Zeigefinger liegt auf dem Grundton und blockiert die Saiten, die nicht klingen sollen.',
    'Wirkung: „Das erste Intervall ist Grundton zu Major 7 … sehr viel Freiraum geschaffen.“ Schön gezupft.',
    '<b>Dominant 7:</b> „Da war die 8, dann die große 7, dann die kleine 7.“',
    '<b>Moll 7:</b> große Terz → kleine Terz.',
    '<b>Halbvermindert:</b> Die Quinte muss einen Halbton tiefer – „mit dem kleinen Finger physikalisch nicht möglich“. Also Finger umschichten, dann ist der kleine Finger frei für den Halbton tiefer.',
    'Reihenfolge zum Ableiten: <b>Major 7 → Dominant 7 → m7 → m7b5.</b> A-Saite und hohe e-Saite klingen nicht mit – „sehr klar, weil hier unten Platz ist“.',
    'Der Name dieser Griffe: <b>Drop 3</b> – Erklärung in der nächsten Lektion.',
    'Jazz-Tipp: „Nehmt euch Blue Bossa, Autumn Leaves, All of Me und versucht die Akkorde zu spielen.“'],
    g: [{ n: 'Gmaj7', fr: [3, null, 4, 4, 3, null], iv: '1 3 5 7' }, { n: 'G7', fr: [3, null, 3, 4, 3, null], iv: '1 3 5 b7' },
        { n: 'Gm7', fr: [3, null, 3, 3, 3, null], iv: '1 b3 5 b7', cap: 'alles in einem Bund' }, { n: 'Gm7b5', fr: [3, null, 3, 3, 2, null], iv: '1 b3 b5 b7' }],
    ex: ['L:Leite die Reihe auf der tiefen E-Saite ab: Major 7 → Dominant 7 → m7 → m7b5.', 'L:Nimm dir Jazz-Standards vor: Blue Bossa, Autumn Leaves, All of Me.',
      'E:Spiele Gmaj7 – G7 – Gm7 – Gm7b5 je 2 Schläge und schlage nach jedem Griff die A- und die hohe e-Saite an: Sie müssen still sein.'] },
  { id: 'k7-8', t: '7.8 Anwendung: „Autumn Leaves“', p: [
    '„Mit diesen Akkorden könnt ihr jetzt Jazz-Standards spielen.“',
    'Anfang von Autumn Leaves: <b>Am7 (Grundton E-Saite) – D7 (Grundton A-Saite) – Gmaj7 – Cmaj7 – F#m7b5 – B7 – Em7</b>. B7 ist eine Sekundärdominante.',
    'Man wechselt oft in Quinten oder Quarten. <b>Am7–D7–Gmaj7 = 2-5-1</b>: „451 gibt’s da eigentlich nicht, es gibt 251.“',
    'Weil du nicht im Barré spielst, ist der Zeigefinger frei – so kannst du kleine <b>Basslinien</b> einbauen. „Wenn ihr nur das könnt, könnt ihr bei euren Kollegen auftrumpfen.“',
    'Später kannst du auch die Melodie auf den Akkordtönen mitspielen (Chord-Melody).',
    'Schlussaussage: „Ihr sollt die nicht vom Blatt lernen, <b>ihr sollt sie ableiten können</b>. Ihr sollt wissen, was da passiert.“',
    'Ausblick: nächste Lektion Drop 2 und alle Umkehrungen.'],
    g: ['Am7', 'D7', 'Gmaj7', 'Cmaj7', 'F#m7b5', 'B7', 'Em7'].map(n => ({ n, fr: PcKurs.AL[n], iv: /maj7/.test(n) ? '1 3 5 7' : /m7b5/.test(n) ? '1 b3 b5 b7' : /m7/.test(n) ? '1 b3 5 b7' : '1 3 5 b7' })),
    loop: [{ c: ['Am7', 'D7', 'Gmaj7', 'Cmaj7', 'F#m7b5', 'B7', 'Em7', 'Em7'], fr: PcKurs.AL, bpm: 60, t: 'Anfang, je ein Takt' }],
    ex: ['L:Spiele den Anfang von Autumn Leaves: Am7 – D7 – Gmaj7 – Cmaj7 – F#m7b5 – B7 – Em7.', 'L:Baue mit dem freien Zeigefinger kleine Basslinien ein.',
      'E:Autumn-Leaves-Loop: die Akkorde 4-mal hintereinander, 50–60 BPM (Vorschlag), danach zwischen den Akkorden Grundton und Quinte als Basstöne zupfen.'] }
] });

// ===== Kapitel 8 – Drop 2 und Drop 3 =====
PcKurs.K.push({ t: 'Kapitel 8 – Drop 2 und Drop 3', s: [
  { id: 'k8-1', t: '8.1 Closed Voicings – am Klavier leicht, auf der Gitarre schwer', p: [
    '„Jetzt wird’s hart.“ Thema sind die 7er-Akkorde mit Grundton auf der E-, A- und D-Saite – als <b>Drop 2</b> und <b>Drop 3</b>. Zuerst: Was heißt „Drop“?',
    '<b>Closed Voicing:</b> Die vier Akkordtöne 1, 3, 5, 7 liegen <b>innerhalb einer Oktave</b>. Auf dem Klavier ist das einfach (C-E-G-B), dort sind die gespreizten Griffe das Schwierige.',
    '<b>Auf der Gitarre ist es umgekehrt:</b> Die Saiten sind in Quarten gestimmt und liegen „schon relativ weit auseinander“. Töne, die direkt nebeneinander liegen, sind schwer zu greifen.',
    'Beispiel A: A, große Terz (Cis), Quinte, große 7 in einer Oktave = Amaj7 – geht noch. Verschieben → A7, Terz einen Halbton tiefer → Am7, Quinte auch tiefer → Am7b5.',
    'Die <b>erste Umkehrung</b> closed (Terz im Bass): Das A liegt direkt neben der großen 7 und passt nicht auf dieselbe Saite – „Seht ihr die Problematik?“',
    'Fazit: „Diese Akkorde sind einfach nicht machbar, vor allem hier unten. Für uns sind sie nicht gut.“'],
    g: [{ n: 'Amaj7 closed', r: 9, mk: [[0, 5, '1'], [1, 4, '3'], [1, 7, '5'], [2, 6, '7']], cap: 'vier Töne in einer Oktave (Lage zum Ansehen)' },
        { n: 'Am7b5 closed', r: 9, mk: [[0, 5, '1'], [1, 3, 'b3'], [1, 6, 'b5'], [2, 5, 'b7']], cap: 'Terz, Quinte und 7 je einen Halbton tiefer' }],
    m: '„Für uns sind sie nicht gut.“ – Closed Voicings sind auf der Gitarre schwer, weil die Saiten in Quarten gestimmt sind.',
    ex: ['L:Spiele das Closed Voicing von A (Amaj7, A7, Am7, Am7b5) und spüre die Schwierigkeit.',
      'E:Closed nachrechnen: Schreibe Cmaj7 closed (C E G B) und Am7 closed (A C E G) auf und sage die Zahlen 1-3-5-7 dazu.'] },
  { id: 'k8-2', t: '8.2 Die Technik: Drop 2 und Drop 3', p: [
    'Die Lösung ist eine <b>Arrangement-Technik</b> aus den <b>Bläsersätzen</b> (Trompeten, Posaunen, Saxophone): Die Stimmen sollen weiter auseinander liegen.',
    '„Wir gucken uns das Closed Voicing an … und wir <b>droppen immer von oben</b>.“ Von oben zählen: 1, 2, 3, 4.',
    '<b>Drop 2:</b> Die <b>zweite Note von oben</b> wird eine Oktave tiefer gespielt.',
    'Beispiel: In der dritten Umkehrung (Quinte, 7, Grundton, große Terz) ist die zweite Note von oben der Grundton. Eine Oktave tiefer → Grundton im Bass: „Tausendmal einfacher, und dieses Voicing kennen wir“ – das Cmaj7 aus Kapitel 7.',
    '<b>Drop 3:</b> Genau dasselbe mit der <b>dritten Note von oben</b>. Beim Cmaj7 ist das der Grundton; die anderen Töne rücken je eine Saite tiefer – „wir kommen am selben Akkord an“ (Kapitel 7: Quinte weg, umgeschichtet).',
    'Alle vier Typen – <b>Major 7, Dominant 7, Moll 7, Moll 7b5</b> – entstehen so.',
    'Wo? <b>Drop 2: Grundton A- und D-Saite.</b> Auf der E-Saite wird es „kuttelmuttel“ (matschig), dort eher <b>Drop 3</b>.',
    '<b>Drop 2-and-4</b> (zweite und vierte Note) gibt es auch, ist auf der Gitarre aber extrem schwierig – eher etwas für Bläser.'],
    m: '„… und den haben wir eine Oktave nach unten geschmissen, weil es auf der Gitarre einfach machbarer ist.“',
    g: [{ n: 'Cmaj7', fr: [null, 3, 5, 4, 5, null], iv: '1 3 5 7', cap: 'Drop 2: aus G-B-C-E (closed) wird C-G-B-E' },
        { n: 'Gmaj7', fr: [3, null, 4, 4, 3, null], iv: '1 3 5 7', cap: 'Drop 3: Grundton E-Saite, A-Saite gedämpft' }],
    ex: ['L:Drop 2 ableiten: Closed Voicing hinschreiben, zweite Note von oben eine Oktave runter, umschichten.', 'L:Drop 3 ableiten: dieselbe Rechnung mit der dritten Note von oben.',
      'E:Closed → Drop nachrechnen: Cmaj7 closed C E G B; Drop 2 (G tiefer) = G C E B; Drop 3 (E tiefer) = E C G B. Wiederhole es ohne Gitarre für Am7 (A C E G).'] },
  { id: 'k8-3', t: '8.3 Die Grundstellungen: vier Typen auf E-, A- und D-Saite', p: [
    '„Grundstellung“ heißt: Der Grundton ist der tiefste Ton.',
    '<b>Grundton A-Saite (Drop 2):</b> Major 7; Finger weg (Barré) → kleine 7 = Dominant 7; große Terz → kleine Terz = Moll 7; Quinte → verminderte Quinte, aber <b>nicht als Barré, sondern umgeschichtet</b>. „Das dauert am Anfang ein bisschen.“',
    '<b>Grundton E-Saite (Drop 3):</b> „Dieses Shape wandert runter, der Grundton bleibt gleich.“',
    '<b>Grundton D-Saite:</b> „Dieselben Voicings, nur auf der B-Saite sind sie alle einen Bund höher.“',
    '<b>Lerntipp Major 7 → Moll 7b5:</b> Beim Major 7 sind die Extratöne große 7, große Terz, Quinte. Beim m7b5 sind es b7, b3, b5 – <b>alle drei einen Halbton tiefer</b>. Major 7 greifen, Zeigefinger heben, die drei Töne je einen Bund tiefer schieben.'],
    m: '„Ich mach’s seit 35 Jahren, ihr kriegt es auch hin.“',
    g: [{ n: 'Cmaj7', fr: [null, 3, 5, 4, 5, null], iv: '1 3 5 7', cap: 'A-Saite, Drop 2' }, { n: 'C7', fr: [null, 3, 5, 3, 5, null], iv: '1 3 5 b7', cap: 'A-Saite' },
        { n: 'Cm7', fr: [null, 3, 5, 3, 4, null], iv: '1 b3 5 b7', cap: 'A-Saite' }, { n: 'Cm7b5', fr: [null, 3, 4, 3, 4, null], iv: '1 b3 b5 b7', cap: 'A-Saite, umgeschichtet' },
        { n: 'Gmaj7', fr: [3, null, 4, 4, 3, null], iv: '1 3 5 7', cap: 'E-Saite, Drop 3' }, { n: 'G7', fr: [3, null, 3, 4, 3, null], iv: '1 3 5 b7', cap: 'E-Saite' },
        { n: 'Gm7', fr: [3, null, 3, 3, 3, null], iv: '1 b3 5 b7', cap: 'E-Saite' }, { n: 'Gm7b5', fr: [3, null, 3, 3, 2, null], iv: '1 b3 b5 b7', cap: 'E-Saite' },
        { n: 'Fmaj7', fr: [null, null, 3, 5, 5, 5], iv: '1 3 5 7', cap: 'D-Saite: B-Saite einen Bund höher' }, { n: 'F7', fr: [null, null, 3, 5, 4, 5], iv: '1 3 5 b7', cap: 'D-Saite' },
        { n: 'Fm7', fr: [null, null, 3, 5, 4, 4], iv: '1 b3 5 b7', cap: 'D-Saite' }, { n: 'Fm7b5', fr: [null, null, 3, 4, 4, 4], iv: '1 b3 b5 b7', cap: 'D-Saite' }],
    loop: [{ c: ['Cmaj7', 'C7', 'Cm7', 'Cm7b5'], fr: { Cmaj7: [null, 3, 5, 4, 5, null], C7: [null, 3, 5, 3, 5, null], Cm7: [null, 3, 5, 3, 4, null], Cm7b5: [null, 3, 4, 3, 4, null] }, bpm: 60, t: 'vier Typen, A-Saite' }],
    ex: ['L:Major 7 → m7b5: Major 7 als Barré greifen, Zeigefinger heben, die drei Extratöne je einen Bund tiefer schieben.',
      'E:Drop 2 auf der A-Saite: Cmaj7 – C7 – Cm7 – Cm7b5, je 4 Schläge, 60 BPM (Vorschlag). Geschafft, wenn du nennst, welcher Ton sich jeweils ändert.',
      'E:Drop 3 auf der E-Saite: Gmaj7 – G7 – Gm7 – Gm7b5. Geschafft, wenn du erklärst: Der Grundton bleibt, alle anderen Töne wandern.'] },
  { id: 'k8-4', t: '8.4 Umkehrungen ableiten', p: [
    'Motivation: Nicht ständig zum Grundton springen – den spielt ohnehin der Bass.',
    '„Umkehrung heißt auf gut Deutsch: <b>jeder Ton im Akkord geht einen höher</b>.“ Dreiklang: 1-3-5 → 3-5-1 → 5-1-3.',
    '„Ich muss mir die Stellungen ableiten, weil man sie nicht alle auswendig kennt.“',
    'Methode (A-Saite): „Ich gucke immer, wo der Grundton ist. Jeden Akkordton schiebe ich auf den <b>nächstmöglichen Akkordton</b>.“ Beim Major 7: <b>1 → 3, 3 → 5, 5 → 7, 7 → 1</b>.',
    '<b>Warnung:</b> Eine Stellung ist „uncool“: Liegt das B unten und das C eine Oktave und einen Halbton darüber, entsteht eine <b>b9</b>. „Den lässt man am besten weg, weil der klingt kacke für Major 7.“',
    '<b>Zwei Wege zu üben:</b> (a) dieselbe Akkordart durch alle vier Umkehrungen schieben, (b) in einer Umkehrung alle vier Typen spielen. „Ich glaube, beide sollte man machen.“'],
    m: '„Jeden Akkordton schiebe ich auf den nächstmöglichen Akkordton.“',
    g: [{ n: 'Cmaj7', fr: [null, 3, 5, 4, 5, null], iv: '1 3 5 7', cap: 'Grundstellung: 1 5 7 3' }, { n: 'Cmaj7', fr: [null, 7, 9, 5, 8, null], iv: '1 3 5 7', cap: 'jeder Ton eins weiter: 3 7 1 5' },
        { n: 'Cmaj7', fr: [null, 10, 10, 9, 12, null], iv: '1 3 5 7', cap: 'nächste: 5 1 3 7' }, { n: 'Cmaj7', fr: [null, 14, 14, 12, 13, null], iv: '1 3 5 7', cap: '7 im Bass: B unten, C oben = b9 – meiden' }],
    ex: ['L:Umkehrungen ableiten: jeden Akkordton auf den nächstmöglichen Akkordton schieben (1 → 3, 3 → 5, 5 → 7, 7 → 1).',
      'L:Beide Wege: eine Akkordart durch alle vier Umkehrungen; eine Umkehrung durch alle vier Typen – „auf der Couch, ohne Verstärker“.',
      'E:b9-Reibung hören: Spiele die Stellung mit der 7 im Bass und danach die Grundstellung. Geschafft, wenn du die „Flat-9-Party“ erkennst.'] },
  { id: 'k8-5', t: '8.5 Vom Major 7 zu den anderen drei Typen', p: [
    '<b>Moll 7:</b> Terz einen Halbton runter. „Es hilft zu wissen, wo die Terz ist.“',
    '<b>Moll 7b5:</b> zusätzlich die Quinte einen Halbton tiefer.',
    'In <b>einer</b> Umkehrung der Reihe nach: Major 7 → Dominant 7 (7 tiefer) → Moll 7 (Terz tiefer) → Moll 7b5 (Quinte tiefer) – „da sieht man, wie einzelne Noten sich bewegen“.',
    '4 Typen × 4 Umkehrungen = <b>16 Akkorde</b> – „aber wenn man sich das so ableitet, ist das Auswendiglernen einfacher.“'],
    m: '„Außer dem Grundton geht alles einen Halbton tiefer vom Major 7.“',
    g: [{ n: 'Cmaj7', fr: [null, 7, 9, 5, 8, null], iv: '1 3 5 7', cap: 'Umkehrung mit Terz im Bass' }, { n: 'C7', fr: [null, 7, 8, 5, 8, null], iv: '1 3 5 b7', cap: '7 einen Halbton tiefer' },
        { n: 'Cm7', fr: [null, 6, 8, 5, 8, null], iv: '1 b3 5 b7', cap: 'Terz tiefer' }, { n: 'Cm7b5', fr: [null, 6, 8, 5, 7, null], iv: '1 b3 b5 b7', cap: 'Quinte tiefer' }],
    ex: ['L:„Eine tolle Übung, die kann man auf der Couch machen“: in einer Umkehrung Major 7 → Dominant 7 → Moll 7 → Moll 7b5.',
      'E:Spiele die vier Griffe oben nacheinander und sage bei jedem Wechsel, welcher Ton einen Halbton tiefer geht (7, dann 3, dann 5).'] },
  { id: 'k8-6', t: '8.6 Praxis: Autumn Leaves in einer Lage', p: [
    'Auf der A-Saite bleiben: <b>Am7 – D7 – Gmaj7 – Cmaj7</b>, mit passenden Umkehrungen. „Viel eleganter als dieses Gehüpfe.“',
    '<b>Stimmführung</b> = auf jeder Saite schauen, wohin der Ton geht, sodass man weniger springt – „für eine schöne Begleitung“.',
    'Grundton D-Saite: „Genau dasselbe, nur dass die B-Saite dummerweise verschoben ist.“ Ein Voicing mit Dur-Terz und großer 7 darunter klingt „kacke wegen der b9“ – vermeiden.',
    'Dann jede Lage durchgehen. „Wenn dann ein Bass dabei ist, super geil.“ „Klingt fast so, als könnte ich Jazz spielen.“'],
    m: 'Ziel: „super elegante Akkordverbindungen, nicht dieses blöde Rumspringen.“',
    g: [{ n: 'Am7', fr: [null, 7, 7, 5, 8, null], iv: '1 b3 5 b7' }, { n: 'D7', fr: [null, 5, 7, 5, 7, null], iv: '1 3 5 b7' }, { n: 'Gmaj7', fr: [null, 5, 5, 4, 7, null], iv: '1 3 5 7' }, { n: 'Cmaj7', fr: [null, 3, 5, 4, 5, null], iv: '1 3 5 7' }],
    loop: [{ c: ['Am7', 'D7', 'Gmaj7', 'Cmaj7'], fr: { Am7: [null, 7, 7, 5, 8, null], D7: [null, 5, 7, 5, 7, null], Gmaj7: [null, 5, 5, 4, 7, null], Cmaj7: [null, 3, 5, 4, 5, null] }, bpm: 70, t: '(ergänzt) eine Lösung in einer Lage, Drop 2' }],
    ex: ['L:Autumn Leaves (Am7 – D7 – Gmaj7 – Cmaj7) in möglichst einer Lage spielen.',
      'E:Spiele die vier Griffe oben als Loop und zähle bei jedem Wechsel, wie viele Finger sich bewegen. Geschafft, wenn kein Wechsel mehr als zwei Bünde springt.'] },
  { id: 'k8-7', t: '8.7 Drop 3 – auf der tiefen E-Saite', p: [
    '„Wenn wir das für G machen, haben wir genug Platz da oben“: <b>Gmaj7, G7, Gm7, Gm7b5</b>.',
    'Umkehrungen wie vorher: jeden Akkordton auf den nächsthöheren – 1 → 3, 3 → 5, 5 → 7, 7 → 1.',
    'Griff-Tipp: „Wir machen in Powerchord Theory mit dem <b>1. und 4. Finger</b>, und dann fummeln wir die anderen beiden dazwischen: der kommt auf die kleine 7, der auf die kleine 3.“',
    'Eine Variante mit b9-Reibung: „wieder eine Flat-9-Party, den lassen wir weg.“',
    'Autumn Leaves lässt sich auch aus Drop 3 und Drop 2 gemischt spielen: „Ich musste mir das jetzt zusammenbasteln. Aber es geht.“'],
    g: [{ n: 'Gm7', fr: [3, null, 3, 3, 3, null], iv: '1 b3 5 b7', cap: 'Finger 1 und 4 außen, zwei dazwischen' }, { n: 'G7', fr: [3, null, 3, 4, 3, null], iv: '1 3 5 b7' }],
    ex: ['L:Drop 3 auf der E-Saite: Gmaj7, G7, Gm7, Gm7b5 und ihre Umkehrungen ableiten.', 'E:Greife Gm7 mit Finger 1 und 4 außen und setze die beiden anderen Finger dazwischen. Geschafft, wenn alle vier Töne klingen und A- und hohe e-Saite still sind.'] },
  { id: 'k8-8', t: '8.8 Zusammenfassung und Hausaufgabe', p: [
    '„Ich nehme Closed Voicings, nehme die zweite Note von oben, schmeiß die runter und schichte um (= Drop 2). Oder die dritte Note von oben (= Drop 3).“',
    'Traditionell: <b>Drop 3 mit Grundton E-Saite; Grundton A- und D-Saite sind Drop 2.</b> Vier Akkordtypen in jeweils vier Umkehrungen.',
    'Griffbilder anschauen ist gut, „aber <b>Ableiten bringt mehr. Macht beides.</b>“',
    'Nächste Lektion: Dreiklänge – „so viel einfacher, dass es eigentlich beleidigend ist.“'],
    m: '„Ableiten bringt mehr. Macht beides.“',
    ex: ['L:Hausaufgabe: Nimm eine einfache Folge mit 2–4 Akkorden, schau auf den Bass und „guckt, wie ihr in einer Lage so elegant wie möglich da durchkommt“.'] }
] });

// ===== Kapitel 9 – Dreiklänge und Umkehrungen =====
PcKurs.K.push({ t: 'Kapitel 9 – Dreiklänge und Umkehrungen', s: [
  { id: 'k9-1', t: '9.1 Weniger ist mehr', p: [
    'Nach der langen Drop-Lektion schraubt er die Komplexität „brutal zurück“: <b>Dreiklänge</b> – nur noch jeweils drei Töne der bekannten Akkorde, dazu ihre Umkehrungen auf verschiedenen Saitengruppen.',
    'Warum? „Manchmal spielt man halt nicht alles.“ Ein anderer Gitarrist spielt den vollen Akkord, man selbst spielt einen kleinen Teil.',
    '„Ihr könnt am Shape sehen, dass dieses Shape in diesen Akkord reinpasst. Wenn ihr gut im Puzzlen seid, dann könnt ihr das.“'],
    ex: ['E:Nimm C-Dur offen (x32010) und spiele nur drei benachbarte Saiten davon (A-, D-, G-Saite). Geschafft, wenn du die drei Töne C, E, G nennst.'] },
  { id: 'k9-2', t: '9.2 Dreiklänge aus den CAGED-Griffen herausnehmen', p: [
    '<b>C-Griff:</b> die ersten drei Noten C-E-G auf benachbarten Saiten = Dur-Dreiklang (1-3-5).',
    'Nächste Umkehrung <b>E-G-C</b> = erste Umkehrung – „die Mitte“ des bekannten Griffs.',
    '<b>G-Griff</b> und <b>A-Griff</b> genauso: „5-1-3, also die zweite Umkehrung“. „Das A kommt vom G, wie das D vom C.“',
    'Ein Powerchord allein ist keine Umkehrung – die Terz fehlt.',
    '<b>E-, A-, D-Griff:</b> „Das 1-5-8 bringt uns nichts, also müssen wir auf die Terz.“ Das Dreiklangs-Shape ist der Mittelteil des Akkords, den man kennt.',
    'Haltung: „Ich kann euch jetzt alles als Griffbilder zeigen, aber Leute, ganz ehrlich: guckt euch das an und <b>leitet es ab</b>.“'],
    m: '„Ihr nehmt euch einfach die Akkorde, die ihr kennt, und nehmt die auseinander.“ – drei Töne hintereinander, keine doppelten Töne.',
    g: [{ n: 'C', fr: [null, 3, 2, 0, null, null], iv: '1 3 5', cap: 'aus dem C-Griff: 1-3-5' }, { n: 'C', fr: [null, null, 2, 0, 1, null], iv: '1 3 5', cap: 'Mitte des C-Griffs: 3-5-1' },
        { n: 'G', fr: [3, 2, 0, null, null, null], iv: '1 3 5', cap: 'aus dem G-Griff: 1-3-5' }, { n: 'A', fr: [null, null, 2, 2, 2, null], iv: '1 3 5', cap: 'aus dem A-Griff: 5-1-3' }],
    ex: ['L:Aus C, G, A, D (offene Akkorde) jeweils die drei Töne herausnehmen und als Dreiklang auf benachbarten Saiten greifen – ohne doppelte Töne.',
      'E:Spiele die vier Griffe oben und sage bei jedem, welcher Ton unten liegt (Grundton, Terz oder Quinte).'] },
  { id: 'k9-3', t: '9.3 Umkehrungen in einer Lage', p: [
    'Die Teile nacheinander schieben, „innerhalb einer Lage“.',
    '<b>G-Dur auf der A-Saite</b> „macht mehr Sinn als die leeren Saiten“: 3-5-1, 5-1-3, 1-3-5 – „damit ich wirklich alles greifen muss“.',
    'Ausblick: „Wenn ich die Töne nicht zusammen, sondern nacheinander spiele, ist das eigentlich schon ein <b>Arpeggio</b>.“ (Kapitel 12)'],
    g: [{ n: 'G', fr: [null, 5, 5, 4, null, null], iv: '1 3 5', cap: '5-1-3 (Standardgriff)' }, { n: 'G', fr: [null, 10, 9, 7, null, null], iv: '1 3 5', cap: '1-3-5' }, { n: 'G', fr: [null, 14, 12, 12, null, null], iv: '1 3 5', cap: '3-5-1' }],
    ex: ['L:Umkehrungen 1-3-5 → 3-5-1 → 5-1-3 innerhalb einer Lage schieben.', 'E:Spiele die drei G-Griffe auf A-, D-, G-Saite hoch und runter. Geschafft, wenn du bei jedem Griff den Grundton zeigen kannst.'] },
  { id: 'k9-4', t: '9.4 Moll-Dreiklänge', p: [
    '<b>E-Moll-Griff:</b> „Da ist die Terz, das wird unser erster Akkord.“ „Immer versuchen zu sehen, wo die Töne sind.“',
    '<b>Am-Griff:</b> Muster 1-b3-5. <b>Dm-Griff:</b> wie das verschobene C-Shape, aber oben einen Halbton tiefer.',
    '„Hier ist die Mollterz, da ist die Durterz. Das sind ja alles nur kleine Fitzel von dem Akkord, den ihr schon kennt.“'],
    g: [{ n: 'Em', fr: [null, null, 2, 0, 0, null], iv: '1 b3 5', cap: 'aus dem Em-Griff' }, { n: 'Am', fr: [null, null, 2, 2, 1, null], iv: '1 b3 5', cap: 'aus dem Am-Griff: 5-1-b3' },
        { n: 'Dm', fr: [null, null, null, 2, 3, 1], iv: '1 b3 5', cap: 'aus dem Dm-Griff: 5-1-b3' }, { n: 'Cm', fr: [null, null, null, 5, 4, 3], iv: '1 b3 5', cap: 'G-, B-, e-Saite (Standardgriff)' }],
    ex: ['L:„Eine sehr gute Übung“: durch die Moll-Umkehrungen durchgehen.', 'E:Spiele C-Dur (xxx553) und C-Moll (xxx543) im Wechsel. Geschafft, wenn du hörst, dass nur die Terz einen Bund tiefer liegt.'] },
  { id: 'k9-5', t: '9.5 Beispiel: Am → F und das Fmaj7', p: [
    'Von Am nach F bleiben zwei Töne gleich: A und C sind für F die 3 und die 5.',
    'Der liegen gelassene Ton <b>E</b> ist in Bezug auf F die <b>große 7</b> → <b>Fmaj7</b>.',
    'In C-Dur ist Am die 6 und F die 4. „Auf der 1 und der 4 gibt es eine Major 7“ – also darf das E bleiben.'],
    m: '„Ich weiß es aber, ich kann das steuern.“',
    g: [{ n: 'Am', fr: [null, null, null, 2, 1, 0], iv: '1 b3 5', cap: 'A-C-E' }, { n: 'Fmaj7', fr: [null, null, 3, 2, 1, 0], iv: '1 3 5 7', cap: 'F dazu, E bleibt = große 7' }],
    loop: [{ c: ['Am', 'Fmaj7'], fr: { Am: [null, null, null, 2, 1, 0], Fmaj7: [null, null, 3, 2, 1, 0] }, bpm: 70, t: 'Dreiklang liegen lassen' }],
    ex: ['L:Am → Fmaj7: den Dreiklang liegen lassen und nur einen Ton ändern.'] },
  { id: 'k9-6', t: '9.6 Beispiel: C – G – Am – F mit Dreiklängen', p: [
    'G nicht einfach hochschieben – „nicht elegant, viel zu viel Springerei“ –, sondern <b>das nächste G in der Nähe</b> suchen.',
    'Am → F: nur ein Ton ändert sich.',
    'Man kann die Melodie (Oberstimme) mit dem Akkord mitspielen, oder nur die äußeren Töne.',
    '„Anstatt diese Rumspringerei kann ich wesentlich kleinere Schritte machen. <b>Cooles Arrangement, das nicht im Weg ist vom Sänger, nicht im Weg ist vom Gitarrensolo.</b>“'],
    g: [{ n: 'C', fr: [null, null, null, 5, 5, 3], iv: '1 3 5' }, { n: 'G', fr: [null, null, null, 4, 3, 3], iv: '1 3 5' }, { n: 'Am', fr: [null, null, null, 2, 1, 0], iv: '1 b3 5' }, { n: 'F', fr: [null, null, null, 2, 1, 1], iv: '1 3 5' }],
    loop: [{ c: ['C', 'G', 'Am', 'F'], fr: { C: [null, null, null, 5, 5, 3], G: [null, null, null, 4, 3, 3], Am: [null, null, null, 2, 1, 0], F: [null, null, null, 2, 1, 1] }, bpm: 75, t: 'G-, B-, e-Saite' }],
    ex: ['L:C – G – Am – F mit möglichst kleinen Schritten, die Melodie als Oberstimme.', 'E:Spiele die Folge oben und zähle, wie viele Töne sich je Wechsel bewegen. Geschafft, wenn du es ohne Hinschauen schaffst.'] },
  { id: 'k9-7', t: '9.7 Beispiel: C – Dm – Am – Gsus4', p: [
    'C → Dm: „Irgendein Sprung wird da drin sein, weil die Akkorde direkt nebeneinander sind.“ <b>„Parallelverschiebungen sind nicht so schön.“</b>',
    'G → Gsus4: „Wenn ich weiß, dass das meine Terz ist, wie mache ich dann Sus4? Den haben wir nicht gelernt, müssen wir auch nicht, weil man kann es ja ableiten.“',
    'Überkreuzbewegungen (ein Ton hoch, einer runter) klingen schön.'],
    m: '„Wenig machen. Aber es klingt unheimlich geil. Das macht man mit diesen Dreiklängen.“',
    g: [{ n: 'C', fr: [null, null, null, 5, 5, 3], iv: '1 3 5' }, { n: 'Dm', fr: [null, null, null, 7, 6, 5], iv: '1 b3 5' }, { n: 'Am', fr: [null, null, null, 9, 10, 8], iv: '1 b3 5' }, { n: 'Gsus4', fr: [null, null, null, 7, 8, 8], iv: '1 4 5' }],
    loop: [{ c: ['C', 'Dm', 'Am', 'Gsus4'], fr: { C: [null, null, null, 5, 5, 3], Dm: [null, null, null, 7, 6, 5], Am: [null, null, null, 9, 10, 8], Gsus4: [null, null, null, 7, 8, 8] }, bpm: 70, t: '(ergänzt) eine Möglichkeit' }],
    ex: ['L:C – Dm – Am – Gsus4 spielen und Überkreuzbewegungen suchen.'] },
  { id: 'k9-8', t: '9.8 Umkehrungen auf Saitenpaaren', p: [
    '„Was ihr absolut machen müsst“: die Umkehrungen auf <b>einer Saitengruppe</b> lassen und anschauen, wie sie liegen.',
    'C-Dur auf G-, B-, e-Saite: 1-3-5 → „1 nach oben schmeißen“ → 3-5-1 → 5-1-3 → wieder am Anfang.',
    '„Immer als Ziel <b>den Grundton sehen</b>.“',
    'Moll auf derselben Saitengruppe: 1-b3-5 und 5-1-b3 – „einfach zu spielen … das ist wichtig zu sehen und zu üben“.',
    'Nächste Saitengruppe <b>D-G-B</b> genauso. Die tiefen Saiten sind weniger wichtig, „weil man so tief eigentlich nicht spielt“.'],
    m: '„Es ist Übungssache, das muss man wirklich üben.“',
    g: [{ n: 'C', fr: [null, null, null, 5, 5, 3], iv: '1 3 5', cap: '1-3-5' }, { n: 'C', fr: [null, null, null, 9, 8, 8], iv: '1 3 5', cap: '3-5-1' }, { n: 'C', fr: [null, null, null, 12, 13, 12], iv: '1 3 5', cap: '5-1-3' },
        { n: 'C', fr: [null, null, 10, 9, 8, null], iv: '1 3 5', cap: 'D-, G-, B-Saite' }],
    ex: ['L:Umkehrungen auf den Saitengruppen G-B-e und D-G-B üben, jeweils mit dem Grundton im Blick.', 'E:C-Dur auf G-B-e in allen drei Umkehrungen, je 4 Schläge, 60 BPM (Vorschlag). Geschafft, wenn du bei jedem Griff sagst, welcher Ton unten liegt.'] },
  { id: 'k9-9', t: '9.9 Rock-Anwendung', p: [
    '„Manchmal will man einfach bei den Dreiklängen oder Powerchords bleiben, weil das genug coole Töne sind – vor allem mit ein bisschen Verzerrung.“',
    '„Ich wollte weniger und hab dann das gemacht, einfach nur das, was übrig geblieben ist.“',
    'Nutzen: Man kann <b>vorhersagen</b>, dass es funktioniert – „dass man nicht drei Stunden im Proberaum steht“.'],
    ex: ['L:Auf eigene Rock-Rhythmusparts übertragen: reduzieren, „einfach nur das, was übrig bleibt“.'] }
] });

// ===== Kapitel 10 – Ear Candy =====
PcKurs.K.push({ t: 'Kapitel 10 – „Süßigkeiten für die Ohren“ (Ear Candy)', s: [
  { id: 'k10-1', t: '10.1 Wenig machen, super klingen', p: [
    '„Die geilen, schönen kleinen Parts … <b>Wenig machen, aber super geil klingen.</b>“',
    'Jetzt: <b>auf denselben Tönen bleiben und die Töne anders definieren</b>.',
    '„Der Trick ist zu wissen, ob die funktionieren – <b>ohne es auszuprobieren</b>.“',
    'Was unterscheidet die Stufen? 1 und 4 haben beide eine Major 7 und eine 9, aber <b>die 4 hat eine #11</b>. Die 1 hat Major 7, die 5 eine kleine 7.',
    'Auf der 3 und der 7 vorsichtig: Dort wäre die 9 eine <b>b9</b> – „klingt nicht super geil“.',
    '13er- und 6er-Akkorde behandelt er nicht: „Ihr müsst euch auch Sachen selber zusammenbauen.“'],
    ex: ['E:Sage zu jeder Stufe in C-Dur, ob sie eine Major 7 (1, 4) oder eine kleine 7 hat und auf welcher Stufe die #11 liegt (4).'] },
  { id: 'k10-2', t: '10.2 Die 1 weglassen, die 9 spielen', p: [
    'Situation: Der Rhythmusgitarrist spielt das volle C. Du spielst nur einen Teil.',
    '„Wenn ich weiß, wo die 1, 3, 5 ist, dann weiß ich doch, wo eine Major 7 ist – eine direkt unter der 1.“',
    '„Ich brauche die 1 nicht – das macht dein Bassist, der Keyboarder, der Akustikgitarrist.“',
    '„Ich kille die 1 und steuere die 2 dazu. In dem Fall ist es also eine <b>9</b>.“ – 9, weil die Terz da ist (Kapitel 6).',
    'Die 5 kann auch weg. Dann bleibt 9 – große Terz – große 7; zusammen mit dem C des anderen entsteht <b>Cmaj7(9)</b>.'],
    m: '„Ich kille die 1 und steuere die 2 dazu.“',
    g: [{ n: 'C', fr: [null, null, null, 5, 5, 3], iv: '1 3 5', cap: 'Dreiklang C-E-G' }, { n: 'C mit 9', r: 0, nine: true, fr: [null, null, null, 7, 5, 3], iv: '9 3 5', cap: 'die 1 durch die 9 ersetzt' },
        { n: 'Cmaj7(9) ohne 1', r: 0, nine: true, fr: [null, null, null, 7, 5, 7], iv: '9 3 7', cap: '9 – große Terz – große 7' }],
    ex: ['L:Über einem gespielten C die 1 weglassen und die 2 (= 9) spielen.', 'E:Wechsle zwischen C-E-G (xxx553) und D-E-G (xxx753). Geschafft, wenn der zweite Griff für dich „offener“ klingt und du die 9 benennst.'] },
  { id: 'k10-3', t: '10.3 Zum nächsten Akkord: C → D', p: [
    'Der nächste Akkord ist D-Dur. Zwei Dur-Akkorde nebeneinander „passiert nur an einer Stelle in der Tonart“: Das muss die 4 und die 5 sein – also <b>G-Dur</b>.',
    'Auf der 4 (C) geht die Major 7. Auf der 5 (D)? „<b>Ich würde im Pop-Rock-Kontext die kleine 7 auf der 5 weglassen, es sei denn, es ist bluesig angehaucht.</b>“',
    'Stattdessen „schöne Noten“: auf der 5 lieber <b>9 und 11</b>. „Anstatt der 3 … gehe ich auf die 2 … dann behalte ich zwei Noten und ändere nur eine.“',
    'Aus der 3 die 4 → hier keine Sus4, sondern eine <b>11</b>, weil der Rhythmusgitarrist das D-Dur schon spielt.',
    '„Das kann man wunderschön mit Delays, Chorus, Phasern, da kann man einfach Stimmung machen.“'],
    g: [{ n: 'D', fr: [null, null, null, 7, 7, 5], iv: '1 3 5', cap: 'D-Dreiklang' }, { n: 'D mit 9', r: 2, nine: true, fr: [null, null, null, 7, 5, 5], iv: '1 9 5', cap: 'Terz → 9 (der andere spielt die Terz)' },
        { n: 'D mit 11', r: 2, nine: true, fr: [null, null, null, 7, 8, 5], iv: '1 11 5', cap: 'Terz → 11' }],
    loop: [{ c: ['C', 'D'], fr: { C: [null, null, null, 5, 5, 3], D: [null, null, null, 7, 7, 5] }, bpm: 75, t: '4 – 5 in G-Dur' }],
    ex: ['L:Von C nach D: Stufen erkennen, Major 7 auf der 4, auf der 5 9/11 statt 7.', 'E:Tonartcheck: Zwei Dur-Akkorde nebeneinander = 4 und 5. Nenne die Tonart zu C–D (G), F–G (C) und G–A (D) in unter 10 Sekunden.'] },
  { id: 'k10-4', t: '10.4 Das Prinzip: Was kann ich aufgeben?', p: [
    '„Zu sehen, wo die 1, 3, 5 ist. <b>Was kann ich aufgeben? Die 5 geht als Erstes</b> – sie ist nur für die Dichte.“',
    '„Die 1 ist wichtig, aber die spielt hoffentlich mein Bassist.“ Annahme: Der Akkord ist schon da und du fügst nur coole Sachen hinzu.',
    'Austauschen: die 3 gegen die 2, die 1 gegen die 2, die 5 gegen die 7 oder die 4.'],
    m: '„Die 5 geht als Erstes.“',
    ex: ['E:Nimm C-E-G (xxx553) und tausche nacheinander: 1 → 2, dann 5 → 7. Sage jedes Mal die neuen Zahlen.'] },
  { id: 'k10-5', t: '10.5 Beispiel: 1-5-6-4 in C', p: [
    'C – G – Am – F. Wo man anfängt, hängt davon ab, was der Gesang macht und ob schon eine Gitarre in dem Bereich spielt.',
    'Auf der 1 eine <b>Major 7</b>: aus 5-1-3 wird 5-7-3. Offener und poppiger: aus der 1 eine <b>9</b> machen.',
    'Beim G ein Ton oben = die 9. Derselbe Griff ist ein Am-Shape: Das G ist für A die <b>kleine 7</b> → Am7 (die 6 ist Moll, die kleine 7 passt).',
    '„Zwei Töne kreuzen sich: einer geht runter, einer hoch – schön, wenn in einem Akkord nicht Parallelbewegungen passieren.“',
    'Fazit: „Das funktioniert hundertprozentig, und das war vorher zu sehen, weil ich weiß, auf welchen Stufen was funktioniert.“'],
    g: [{ n: 'Cmaj7 (5-7-3)', r: 0, fr: [null, null, null, 12, 12, 12], iv: '3 5 7', cap: 'aus 5-1-3 wird 5-7-3' }],
    loop: [{ c: ['C', 'G', 'Am', 'F'], fr: { C: [null, null, null, 5, 5, 3], G: [null, null, null, 4, 3, 3], Am: [null, null, null, 2, 1, 0], F: [null, null, null, 2, 1, 1] }, bpm: 75, t: 'Grundlage zum Ausprobieren' }],
    ex: ['L:1-5-6-4 (C-G-Am-F) mit 9, mit Major 7 und mit 11 spielen; beim Am die kleine 7 benutzen.', 'E:Axis in C mit Dreiklängen auf G-B-e (C xxx553, G xxx433, Am xxx210, F xxx211). Geschafft, wenn du bei jedem Akkord den tiefsten Ton nennst.'] },
  { id: 'k10-6', t: '10.6 Wie findet man solche Parts?', p: [
    '„Wir kommen von hinten rum. Wir kommen mit Wissen ran und können ziemlich klar eliminieren, was nicht funktioniert.“',
    'Vorgehen: „Wo bin ich? Wo ist mein Dreiklangs-Shape? <b>Wo ist mein nächstes Dreiklangs-Shape? Was kann ich drin lassen?</b> … Das ist dann die Theorie, und dann probiert es aus.“',
    'Den Akkord „größer und länger“ machen, mit Dynamik spielen: „rein und raus, eine Welle, bisschen Delay drauf“.',
    '„Das sind die magischen Momente in der Musik: wenn sich der Akkord ändert und auf einmal die Sonne aufgeht.“'],
    m: '„Ihr wisst jetzt, warum – ihr könnt es rausfinden und im Vorhinein steuern.“',
    ex: ['L:Vorgehen üben: „Wo ist mein nächstes Dreiklangs-Shape? Was kann ich drin lassen?“', 'L:Einen Akkord „größer und länger“ halten, mit Dynamik-Welle und Delay spielen.'] },
  { id: 'k10-7', t: '10.7 Merkliste und Improvisieren', p: [
    '<b>1 und 4: Major 7; auf der 4 eine #11.</b>',
    '<b>Auf der 1 ist eine 4 in Ordnung, auf der 5 auch.</b> Auf der 5 eher 2 oder 4 statt kleiner 7, „es sei denn, ihr mögt diesen bluesigen Charakter“.',
    '<b>Moll-Akkorde: 2 und 4 gehen</b>, außer auf der 3 – dort nur eine b2, „die ist kacke“. Den 7. Akkord (m7b5) meidet er.',
    'Improvisieren: „Ich stelle mir ganz einfach diese Shapes vor. Dann weiß ich innerhalb des Shapes: wenn ich diesen Ton spiele, spiele ich die 9, … die große 7, hier ist die 5.“',
    '„Das könnt ihr auch. Das ist absolut möglich.“'],
    ex: ['L:Die Merkliste auswendig lernen.', 'L:Beim Improvisieren die Shapes vorstellen und wissen, wo 9, große 7, 5 und kleine 3 liegen.'] }
] });

// ===== Kapitel 11 – 7/9-Akkorde =====
PcKurs.K.push({ t: 'Kapitel 11 – 7/9-Akkorde', s: [
  { id: 'k11-1', t: '11.1 Kurz: 6er-Akkorde', p: [
    '„Wir haben eine Art Akkord vergessen.“ Erst kurz die 6er.',
    '<b>Am7 → Am6:</b> „Hier ist die 7, hier ist die 6.“ <b>D7 → D6:</b> die 7 um einen Halbton verkleinern.',
    '„Wenn ihr wisst, wo die 7 ist, wisst ihr, wo die 6 ist.“ Am6 nennt er „dorisch“, „so Bossa und so Zeug“.',
    '<b>Benennung:</b> Ist die 7 <b>nicht</b> drin, heißt die 6 „6“. Ist die 7 drin und die 6 zusätzlich, heißt sie <b>13</b>. „Die Akkordtöne haben Vorrang.“',
    '„Die 6er und 13er sind seltener … Wenn ihr sie wissen wollt, baut sie euch zusammen.“'],
    m: '„Wenn ihr wisst, wo die 7 ist, wisst ihr, wo die 6 ist.“',
    g: [{ n: 'Am7', iv: '1 b3 5 b7' }, { n: 'Am6', fr: [null, 0, 2, 2, 1, 2], iv: '1 b3 5 6', cap: 'Standardgriff' }, { n: 'D7', iv: '1 3 5 b7' }, { n: 'D6', fr: [null, null, 0, 2, 0, 2], iv: '1 3 5 6', cap: 'Standardgriff' }],
    ex: ['L:Am7 → Am6 und D7 → D6.', 'E:Wechsle Am7 (x02010) und Am6 (x02212) je 4 Schläge, 60 BPM (Vorschlag). Geschafft, wenn du die 6 (Fis) als Ersatz der 7 nennst.'] },
  { id: 'k11-2', t: '11.2 D7 → D7sus2 → D7(9)', p: [
    '7/9-Akkord = Terz (groß oder klein), 7 (klein oder groß) und zusätzlich die 9.',
    'Grundton A-Saite, Dur: 1-5-8, die Terz dazu, aus der 8 die kleine 7 → D7.',
    '„Die 2 ist unter der 3.“ Terz weg, 2 da → <b>keine 3, dafür eine 2 = D7sus2</b>: „Ich habe keine Terz drin, klingt schön schwebend.“',
    'Damit es eine 9 wird, muss die Terz wieder rein. „Die <b>Quinte kann ich rausschmeißen</b> … die unwichtigste.“ Grundton, große Terz, 7, 2: „Wenn die 3 drin ist, nenne ich die 2 <b>9</b>.“',
    '„Die 9 definiert den Akkord nicht, der Akkord ist definiert: ein Dur-Akkord mit einer kleinen 7. Cooler Ton.“'],
    m: '„Wenn die 3 drin ist, nenne ich die 2 9.“',
    g: [{ n: 'D7', iv: '1 3 5 b7' }, { n: 'D7sus2', fr: [null, null, 0, 2, 1, 0], iv: '1 2 5 b7', cap: 'Standardgriff, ohne Terz' }, { n: 'D7(9)', nine: true, fr: [null, 5, 4, 5, 5, null], iv: '1 3 b7 9', cap: 'A-Saite: Quinte raus, Terz rein' }],
    ex: ['L:D7 → D7sus2 → D7(9): Terz weg → 2 (sus2) → Quinte raus, Terz zurück.', 'E:D7sus2 (xx0210) und D7 (xx0212) im Wechsel. Geschafft, wenn du „schwebend“ und „Dur“ heraushörst.'] },
  { id: 'k11-3', t: '11.3 Major 7(9) und das Beispiel von John Mayer', p: [
    'Major 7(9) = 1, große Terz, große 7, 9.',
    'Ein Song von John Mayer: Zeigefinger flach, Grundton anschlagen, den Rest des Akkords anzupfen, auf die Quinte aufhämmern.',
    'Darunter: „Grundton, kleine 7, 6“. „John Mayer müsste man sein.“'],
    g: [{ n: 'Cmaj7(9)', nine: true, fr: [null, 3, 2, 4, 3, null], iv: '1 3 7 9', cap: 'Standardgriff' }],
    ex: ['L:Das Muster spielen: Zeigefinger flach, Grundton, Rest anzupfen, auf die Quinte hämmern.', 'E:Spiele Cmaj7(9) (x3243x) und zupfe die Töne einzeln. Geschafft, wenn du 1, 3, 7, 9 benennst.'] },
  { id: 'k11-4', t: '11.4 Moll 7(9)', p: [
    'Aus D7(9) (1, große Terz, 7, 9): „Dann ziehe ich den Zeigefinger eins tiefer, und dann ist das <b>1, kleine Terz, 7, 9</b> = wunderschöner Moll 7(9).“',
    '„Ich spiele den sehr gern als <b>E-Moll 9 am Ende von Autumn Leaves</b>.“'],
    g: [{ n: 'Dm7(9)', nine: true, fr: [null, 5, 3, 5, 5, null], iv: '1 b3 b7 9', cap: 'Terz einen Bund tiefer' }, { n: 'Em7(9)', nine: true, fr: [null, 7, 5, 7, 7, null], iv: '1 b3 b7 9', cap: 'Ende von Autumn Leaves' }],
    ex: ['L:D7(9) → Zeigefinger eins tiefer → Moll 7(9); E-Moll 9 am Ende von Autumn Leaves.'] },
  { id: 'k11-5', t: '11.5 b9 – der Zug auf Moll', p: [
    'Neben der 9 gibt es im Jazz die <b>b9</b> und die <b>#9</b>.',
    '„Ein Dominant-7-Akkord mit einer <b>b9</b> zieht auf einen <b>Moll-Akkord eine Quinte drunter</b>.“ D7b9 signalisiert: Es geht nach Gm. Er gehört zur 5. Stufe von harmonisch Moll.',
    '2-5-1 in Moll: <b>Am7b5 – D7b9 – Gm</b>.',
    'In einem Metal-Song spielt der Gitarrist im schnellen Arpeggio statt des A die b9: „Das signalisiert super klar, wo er hin will. Das ist die Magie von geilem Arranging.“',
    '<b>Alterierte Dominante:</b> „Alteriert heißt auf gut Deutsch: ich schiebe da Zeugs um“ (D7b5, D7#5 …). D7b9 ist so ein Akkord.'],
    m: '„b9 auf Quinte: tierisch starker Zug.“',
    g: [{ n: 'D7b9', nine: true, fr: [null, 5, 4, 5, 4, null], iv: '1 3 b7 b9', cap: 'Standardgriff' }, { n: 'Am7b5', fr: [null, 0, 1, 0, 1, null], iv: '1 b3 b5 b7', cap: 'Standardgriff' }, { n: 'Gm', fr: [3, 5, 5, 3, 3, 3], iv: '1 b3 5' }],
    loop: [{ c: ['Am7b5', 'D7b9', 'Gm', 'Gm'], fr: { Am7b5: [null, 0, 1, 0, 1, null], D7b9: [null, 5, 4, 5, 4, null], Gm: [3, 5, 5, 3, 3, 3] }, bpm: 70, t: '2-5-1 in G-Moll' }],
    ex: ['L:D7b9 spielen und den Zug auf Moll hören; Am7b5 – D7b9 – Gm.', 'E:Spiele D7(9) und danach D7b9, jeweils gefolgt von Gm. Geschafft, wenn du hörst, welcher stärker nach Gm zieht.'] },
  { id: 'k11-6', t: '11.6 Die #9 – der Hendrix-Akkord', p: [
    '„Wenn ich die 2 kreuze (erhöhe), lande ich auf der b3.“',
    'Mollterz und Durterz zusammen – klingt das nach Dur oder Moll? „Die Antwort ist ganz klar: Dur.“',
    '„Das ist die <b>#9</b>: ein Dur-Akkord mit kleiner 7 und einer kleinen Terz, die ich aber nicht kleine Terz nenne – ich nenne sie #9.“ „Die wichtige Note ist die Durterz.“',
    'Den kennt man: <b>E7#9, der Hendrix-Akkord</b>.',
    'Herkunft Blues: Am7 spielen und von der Mollterz zur Durterz aufhämmern – „genau dieser Charakter von dieser #9, da kommt das her, sehr bluesig“.'],
    m: '„Die Terz hat Priorität.“',
    g: [{ n: 'E7#9', s9: true, fr: [null, 7, 6, 7, 8, null], iv: '1 3 b7 #9', cap: 'Standardgriff (Hendrix)' }, { n: 'Am7 + Aufhämmern', r: 9, mk: [[1, 0, '1'], [4, 1, 'b3'], [4, 2, '3']], cap: 'B-Saite: 1. → 2. Bund' }],
    ex: ['L:E7#9 spielen und Am7 mit Aufhämmern von der Mollterz zur Durterz.', 'E:Spiele E7#9 (x7678x) und nenne G und Gis als #9 und Durterz.'] },
  { id: 'k11-7', t: '11.7 Ableiten: immer bei Major 7 anfangen', p: [
    '„Ich spiele die (Grundton D-Saite) niemals, ich zeige sie euch rein theoretisch. Ich spiele die immer nur auf der A-Saite.“',
    'Methode: „Die einzelnen Töne immer <b>bei Major 7 anfangen</b> und sich rantasten“: 3 wird zur 2 (= 9), 9 → b9, Dur → Moll.',
    'Drop 3 mit Grundton E-Saite: Die 9 kann man oben auf der hohen e-Saite mit dem kleinen Finger dazunehmen – „eher ein Akkord zum Zupfen“.',
    '„Was ich gelernt habe, ist #9: den würde ich in der Hendrix-Variante spielen.“'],
    m: '„Ich kann die Akkorde nicht, ich habe die hier noch nie gespielt, aber ich kann sie mir relativ schnell ableiten.“',
    g: [{ n: 'Amaj7(9)', nine: true, fr: [5, null, 6, 6, 5, 7], iv: '1 3 5 7 9', cap: 'Drop 3 + 9 oben (Standardgriff)' }, { n: 'A7(9)', nine: true, fr: [5, null, 5, 6, 5, 7], iv: '1 3 5 b7 9', cap: '7 einen Halbton tiefer' },
        { n: 'A7#9', s9: true, fr: [5, null, 5, 6, 5, 8], iv: '1 3 5 b7 #9', cap: '9 → #9' }],
    ex: ['L:Ableiten: immer bei Major 7 anfangen, 3 → 2 (9), 9 → b9, Dur → Moll.', 'L:Die oberen vier Saiten mit vier Fingern zupfen (A-Major 7(9)).'] }
] });

// ===== Kapitel 12 – Arpeggios mit Dreiklängen =====
PcKurs.K.push({ t: 'Kapitel 12 – Arpeggios mit Dreiklängen', s: [
  { id: 'k12-1', t: '12.1 Was ist ein Arpeggio?', p: [
    '„Das ist aber kein Kurs zum Thema Arpeggios, weil das überschreitet die Dimension komplett.“',
    'Arpeggio = <b>„die Akkordtöne hintereinander spielen“</b>. „Das muss nicht schnell sein.“',
    'Wer das CAGED-System verstanden hat, dem eröffnen sich „mit ein, zwei kleinen Variationen“ viele Arpeggios.',
    'Ziel: „dass ihr rafft, dass das, was ihr hier im Kurs gelernt habt, <b>anwendbar ist auf mehr als nur Rhythmus-Akkorde</b>“.'],
    ex: ['E:Spiele C-Dur (x32010) einmal als Akkord und einmal Ton für Ton von tief nach hoch. Geschafft, wenn du die Töne 1-3-5-8-3 laut mitzählst.'] },
  { id: 'k12-2', t: '12.2 E-Griff als Dur-Arpeggio', p: [
    '„Wir müssen nur sichergehen, dass wir <b>alle Töne haben und nichts übersprungen haben</b>.“',
    'Im E-Griff fehlt unten für Dur die <b>große Terz</b>: „1, 2, 3, 4, bam, da ist die große Terz.“ Dann alle Noten hintereinander spielen.',
    'Fingersatz ist beim Arpeggio „was anderes“ als beim Akkordgriff.',
    'Extra: Oben die große Terz ein zweites Mal draufsetzen und mit einem Pull-Off abziehen.',
    'Moll genauso. „E-Dur-CAGED-Griff im Barré kann ich jetzt überall.“',
    'Prinzip: Im Barré-Griff fehlt meist genau ein Ton, den man „reinfummeln“ muss.'],
    g: [{ n: 'G', fr: [3, 5, 5, 4, 3, 3], iv: '1 3 5', arp: true, cap: 'E-Griff im 3. Bund' }, { n: 'G5', fr: [3, 5, 5, null, null, null], iv: '1 5', cap: 'ohne Terz: offen, leer' }, { n: 'Gm', fr: [3, 5, 5, 3, 3, 3], iv: '1 b3 5', arp: true, cap: 'Moll' }],
    ex: ['L:Akkordgriff aufschlüsseln: alle Töne nacheinander spielen, prüfen, dass nichts übersprungen ist, die fehlende Terz ergänzen.', 'L:E-Griff als Barré, Dur und Moll; Extra: Terz oben doppelt mit Pull-Off.',
      'E:G-Dur-Barré (355433) Ton für Ton: 1-5-8-3-5-8 und zurück, 60 BPM in Achteln, dann 80. Geschafft, wenn alle Töne sauber klingen.'] },
  { id: 'k12-3', t: '12.3 G-, C- und A-Griff', p: [
    '<b>G-Griff:</b> „der G-Griff verschoben“, hintereinander spielen und die fehlende Note dazunehmen.',
    '<b>C-Griff:</b> „<b>Wir fangen immer beim Grundton an.</b> Ist alles da? 1 3 5 1 3 – genau das will ich von euch. Nur nacheinander.“ Oben kann noch eine 5 drauf, unten eine 5 drunter.',
    '<b>A-Griff:</b> „Da fehlt uns die Terz, und die fummeln wir rein.“ Mit Major 7 muss man „wirklich strecken“.',
    '<b>D-Griff:</b> „Das brauchen wir nicht, weil das dasselbe ist wie der C.“',
    'Moll für A, G und C – beim A-Griff „Vorsicht, sehr großer Strecker“.'],
    g: [{ n: 'A', fr: [5, 4, 2, 2, 2, 5], iv: '1 3 5', arp: true, cap: 'G-Griff verschoben' }, { n: 'C', iv: '1 3 5', arp: true, cap: 'C-Griff: 1 3 5 1 3' }, { n: 'C', fr: [null, 3, 5, 5, 5, 3], iv: '1 3 5', arp: true, cap: 'A-Griff im 3. Bund' }, { n: 'Cm', fr: [null, 3, 5, 5, 4, 3], iv: '1 b3 5', arp: true, cap: 'A-Griff Moll' }],
    ex: ['L:G-, C- und A-Griff als Arpeggio, jeweils auch Moll; A-Moll mit großem Strecker.', 'L:Immer vom Grundton anfangen; vorher prüfen: 1-3-5-1-3.'] },
  { id: 'k12-4', t: '12.4 In Rhythmen üben', p: [
    '„Wenn ihr die übt, tut mir den Gefallen, <b>übt sie in verschiedenen Rhythmen</b>.“',
    '<b>3er-Gruppen:</b> 1-2-3, 1-2-3. Dann <b>4er-Gruppen</b>.',
    'Längere Arpeggios über mehrere Lagen: bis zur Quinte spielen, Zeigefinger auf den nächsten Grundton und das Muster wiederholen. „Relativ simpel, wenn ihr die CAGED-Griffe könnt.“'],
    loop: [{ c: ['C', 'C'], bpm: 60, t: 'Klangteppich zum Mitzählen' }],
    ex: ['L:In 3er-Gruppen (1-2-3) und 4er-Gruppen üben.', 'L:Langes Arpeggio: bis zur Quinte, Zeigefinger auf den nächsten Grundton, Muster wiederholen.',
      'E:C-Dur-Griff (x32010) als Arpeggio in Dreiergruppen, dann Vierergruppen, 50 BPM. Geschafft, wenn du das Mitzählen halten kannst.'] },
  { id: 'k12-5', t: '12.5 Song-Beispiel: 1-6-5-4 in einer Stellung', p: [
    'Ein Song, den er für seinen Unterricht komplett herausgehört hat, zielt auf <b>diatonische Akkorde</b>: „Nur Arpeggios.“',
    'Es beginnt auf E-Dur, und statt auf der Terz zu landen, geht es gleich auf die Quinte. Dann dasselbe auf weiteren Akkorden – „dreimal hintereinander in derselben Stellung“.',
    'Stufen: <b>„die 1, die 6, die 5 … 1-6-5-4“</b> – „ultra billig eigentlich“. In E-Dur ergibt das nach den Stufenakkorden E – C#m – B – A.',
    'Die Pointe: Die Dur-Tonleiter und ihre „Seven Friends“ bieten so viel Material, „dass man das erst mal verstehen und beherrschen muss“.',
    'Seine eigene Variation („Shift“) nutzt dasselbe Konzept: „Manchmal muss es nicht kompliziert sein, wenn man das gut verbindet, rhythmisch interessant macht.“'],
    m: '„Manchmal muss es nicht kompliziert sein.“',
    g: [{ n: 'E', fr: [12, 14, 14, 13, 12, 12], iv: '1 3 5', arp: true }, { n: 'C#m', fr: [9, 11, 11, 9, 9, 9], iv: '1 b3 5', arp: true }, { n: 'B', fr: [7, 9, 9, 8, 7, 7], iv: '1 3 5', arp: true }, { n: 'A', fr: [5, 7, 7, 6, 5, 5], iv: '1 3 5', arp: true }],
    loop: [{ c: ['E', 'C#m', 'B', 'A'], fr: { E: [12, 14, 14, 13, 12, 12], 'C#m': [9, 11, 11, 9, 9, 9], B: [7, 9, 9, 8, 7, 7], A: [5, 7, 7, 6, 5, 5] }, bpm: 70, t: '1 – 6 – 5 – 4 in E' }],
    ex: ['L:Songs analysieren: 1-6-5-4 in einer Stellung, die Terz überspringen.', 'E:Spiele E – C#m – B – A als Arpeggios im E-Griff (Bund 12, 9, 7, 5) zum Loop. Geschafft, wenn du die Stufen 1-6-5-4 dazu nennst.'] }
] });

// ===== Kapitel 13 – Arpeggios mit Septakkorden =====
PcKurs.K.push({ t: 'Kapitel 13 – Arpeggios mit Septakkorden', s: [
  { id: 'k13-1', t: '13.1 Die 7 ins Arpeggio einbauen', p: [
    '„Überlegen, welche 7 da rein muss, und spielen wir die 7 da rein. Wo ist denn die 7? <b>Unter der 8.</b> So einfach ist es.“',
    'Beispiel G-Dur im E-Griff: 1, 3, 5, 8. Major 7 = <b>einen Halbtonschritt runter</b> von der 8.',
    '„Powerchord Major 7. Ich liebe diese Shape. Kann man super coole Sachen mit machen, ohne schreddern zu wollen.“',
    '<b>Kleine 7:</b> 1, 3, 5, kleine 7. <b>Moll:</b> statt der großen die kleine Terz.',
    'Am7 als Arpeggio: „Das ist eigentlich fast die komplette Pentatonik. Fehlt ein Ton.“'],
    m: '„Ihr könnt euch das alles zusammenbauen, ihr braucht keine Griffbilder.“',
    g: [{ n: 'Gmaj7', fr: [3, 5, 4, 4, 3, 3], iv: '1 3 5 7', arp: true, cap: '8 → Major 7' }, { n: 'G7', fr: [3, 5, 3, 4, 3, 3], iv: '1 3 5 b7', arp: true }, { n: 'Gm7', fr: [3, 5, 3, 3, 3, 3], iv: '1 b3 5 b7', arp: true },
        { n: 'Am7', fr: [5, 7, 5, 5, 5, 5], iv: '1 b3 5 b7', arp: true, cap: 'fast die Moll-Pentatonik' }],
    ex: ['L:Dreiklangs-Arpeggio + passende 7 einbauen („unter der 8“) im E-, A-, C- und G-Griff.', 'E:G-Griff 355433: statt der Oktave auf der D-Saite den Ton einen Bund tiefer (Gmaj7), dann zwei Bünde tiefer (G7). Geschafft, wenn du „weich“ und „bluesig“ unterscheidest.'] },
  { id: 'k13-2', t: '13.2 Grundton A-Saite', p: [
    '„Major 7 ist jetzt direkt hier unter meinem Grundton.“ Einfach rüberrollen.',
    'Dominant 7: kleine 7. Moll 7: „kleine 7 bleibt gleich“ – nur die Terz wird kleiner.',
    '<b>Die zentrale Botschaft:</b> „Ihr wisst, wo der Scheiß ist, also könnt ihr es euch zusammenbauen.“',
    'Rezept: „Ihr könnt das CAGED-System, ihr könnt einen Powerchord, dann könnt ihr die Noten nacheinander spielen, dann könnt ihr überlegen: Wo ist die 8? Dann weiß ich, wo die 7 ist.“',
    'Auch 9er und Sus4 gehen: „das muss man üben, das muss man in die Finger kriegen“.'],
    m: '„Einfach wissen, wo der Scheiß ist. Zusammenbauen, hoch und herunterspielen.“',
    g: [{ n: 'Cmaj7', fr: [null, 3, 5, 4, 5, 3], iv: '1 3 5 7', arp: true }, { n: 'C7', fr: [null, 3, 5, 3, 5, 3], iv: '1 3 5 b7', arp: true }, { n: 'Cm7', fr: [null, 3, 5, 3, 4, 3], iv: '1 b3 5 b7', arp: true }],
    ex: ['L:Major 7, Dominant 7 und Moll 7 mit Grundton A-Saite als Arpeggio.', 'E:Spiele Cmaj7 – C7 – Cm7 als Arpeggio und nenne bei jedem Wechsel den Ton, der sich ändert.'] },
  { id: 'k13-3', t: '13.3 Mehr Geschmack: 1-3-5-7-9', p: [
    'Ein bekannter Gitarrist findet das stumpfe Arpeggio „langweilig, hat er auch recht“.',
    'Er spielt „1, 5, 1, 3, 5, … die Major 7, überspringt dann aber die nächste 1 und spielt dann hier die 9“.',
    '„Das ist dann das Flavor, der Geschmack. Total cool: <b>1, 3, 5, Major 7, 9!</b>“ – „Kannst auch als Dominant spielen.“'],
    g: [{ n: 'Cmaj7(9)', r: 0, mk: [[1, 3, '1'], [2, 5, '5'], [3, 5, '8'], [4, 5, '3'], [5, 3, '5'], [5, 7, '7'], [5, 10, '9']], cap: '1-5-8-3-5-7-9, die 1 oben übersprungen' }],
    ex: ['E:Spiele das Muster oben langsam (Achtel, 60 BPM). Geschafft, wenn du die 9 statt der oberen 1 hörst.'] },
  { id: 'k13-4', t: '13.4 So üben: Stufen, Rhythmen, Springen', p: [
    '„Ich würde sie genauso üben, wie ich sie bei Dreiklängen üben würde.“',
    'Die Stufen einer Tonart nacheinander: Dur, Moll, Moll, Dur, Dur, Moll, vermindert. „Ich sehe die Verbindung, ich sehe die Distanzen, ich kriege das ins Ohr.“',
    'Steigerung: überspringend – 1 auf die 3, 2 auf die 4 … Oder eine Standardfolge: Am – G – F – G.',
    'Rhythmen: 3er, 4er, Sechzehntel. Alle Stufen als Septakkord.',
    '<b>Überspringen:</b> statt 1-3-5 „von der 1 auf die 5, dann von der 3 auf die 1“ – „für die Finger echt geile Übungen. Das kann man wunderschön vor dem Fernseher machen.“ Oder in Zweiergruppen rückwärts.'],
    loop: [{ c: ['Am', 'G', 'F', 'G'], fr: { F: [null, null, 3, 2, 1, 1] }, bpm: 60, t: 'Am – G – F – G' }],
    ex: ['L:Die Stufenakkorde einer Tonart (z. B. D-Dur) als Akkord, dann als Arpeggio, dann überspringend (1→3, 2→4 …).', 'L:Am – G – F – G als Arpeggio.', 'L:Rhythmik: 3er, 4er, Sechzehntel; alle Stufen als Septakkord.',
      'L:Überspringen (1→5, 3→1 …) und rückwärts in Zweiergruppen.', 'E:Am7 (x02010) im Überspring-Muster, 60 BPM in Achteln. Geschafft, wenn du 8 Takte ohne Fehler spielst, ohne auf die Hand zu schauen.'] },
  { id: 'k13-5', t: '13.5 Arpeggio als Akkordteppich mit Delay', p: [
    'Mit einem Delay füllt das Echo die Töne auf, die man nicht gespielt hat. „Ich spiele ganz gerade Achtel.“',
    '„Das Geile ist, wenn ich das als Arpeggios mache und vor allem als Arpeggios, wo ich überspringe.“ Auch rückwärts.',
    '„Man hat eine andere Art von <b>Akkordteppich</b>.“ Schredder-Arpeggio ist eine Solo-Geschichte, „aber arrangieren tu ich damit nicht“.',
    '„Man muss ein Arpeggio nicht als Solo-Werkzeug sehen, man kann es auch als <b>Begleitwerkzeug</b> sehen.“'],
    m: '„Was ich euch beigebracht habe in den ganzen Lessons, ist auf Arpeggios anwendbar.“',
    ex: ['L:Mit Delay als Akkordteppich spielen, auch rückwärts und überspringend.', 'L:Hybrid Picking ausprobieren (Plektrum plus Mittelfinger).',
      'E:Delay-Teppich: Arpeggio rückwärts oder überspringend mit Delay (Einstellung nach Gehör), 70 BPM, gerade Achtel. Geschafft, wenn du einen durchgehenden Teppich statt Einzeltöne hörst.'] }
] });

// ===== Kapitel 14 – Andere Powerchords =====
PcKurs.K.push({ t: 'Kapitel 14 – Andere Powerchords: der „Dur-Powerchord“', s: [
  { id: 'k14-1', t: '14.1 1-5-8 – bekannt', p: [
    '„1-5-8 vollkommen bekannt: auf der E-Saite, auf der A-Saite, auf der D-Saite.“',
    'Auf der G-Saite geht er auch – wegen der G→H-Stimmung mit verschobener Form (Kapitel 2).'],
    g: [{ n: 'C5', fr: [null, null, null, 5, 8, 8], iv: '1 5', cap: 'Grundton G-Saite: 5 und 8 je drei Bünde höher' }],
    ex: ['L:1-5-8 auf E-, A- und D-Saite wiederholen; auf der G-Saite probieren.'] },
  { id: 'k14-2', t: '14.2 Der „Dur-Powerchord“ (3-1)', p: [
    '„Es gibt auch einen Akkord, den nenne ich <b>Dur-Powerchord</b> … der kommt von einer Umkehrung.“',
    'Auf der A-Saite: die Oktave weglassen, den kleinen Finger hinlegen und <b>überstrecken</b>. „Das ist aber jetzt nicht der Grundton.“ Es sind die 3 und die 1 vom G – „quasi eine 3-1“.',
    'Nutzen: ein starker Zug auf das C, einen Halbtonschritt höher. Der Bass kann die Umkehrung mitspielen oder den Grundton G.',
    'Warnung: nicht flach greifen – „eine b9-Party ain’t a good party“.',
    'Mit dem Mittelfinger oben noch die Quinte vom G dazu. „Und das Geile ist, weil der nur zwei Töne hat – funktioniert ja wunderbar.“'],
    m: '„Das sind alles Elemente, die kennt ihr jetzt.“',
    g: [{ n: 'G/B', fr: [null, 2, 5, null, null, null], iv: '1 3', cap: 'Dur-Powerchord: 3 unten, 1 oben' }, { n: 'G/B', fr: [null, 2, 5, 7, null, null], iv: '1 3 5', cap: 'mit Quinte oben' }, { n: 'C5', fr: [null, 3, 5, 5, null, null], iv: '1 5', cap: 'Ziel: einen Halbton höher' }],
    loop: [{ c: ['G/B', 'C5'], fr: { 'G/B': [null, 2, 5, null, null, null], C5: [null, 3, 5, 5, null, null] }, bpm: 80, t: 'Zug aufs C' }],
    ex: ['L:Dur-Powerchord (3-1) auf der A-Saite mit überstrecktem kleinen Finger, dann einen Halbton höher zum Ziel.', 'E:Spiele G/B → C5 zum Loop. Geschafft, wenn du den Halbtonschritt im Bass (B → C) hörst.'] },
  { id: 'k14-3', t: '14.3 Terz im Bass: D über Fis', p: [
    '„D-Dur hat ja ein Fis als Terz. Wenn wir die Terz jetzt in den Bass machen … spiele mit dem Zeigefinger hier die 3, wobei ich die A-Saite blockiere: das ist ein <b>D über Fis</b>.“',
    'Als Moll? „Wird nicht wirklich verwendet … weil der nicht eine Funktion hat wie dahin zu ziehen.“',
    '„Also diese Terz im Bass ist sehr beliebt. Mehr bei Dur als bei Moll.“'],
    g: [{ n: 'D', iv: '1 3 5' }, { n: 'D/F#', fr: [2, null, 0, 2, 3, 2], iv: '1 3 5', cap: 'Standardgriff, A-Saite blockiert' }, { n: 'G', iv: '1 3 5' }],
    loop: [{ c: ['D', 'D/F#', 'G', 'G'], fr: { 'D/F#': [2, null, 0, 2, 3, 2] }, bpm: 70, t: 'Basslinie D – Fis – G' }],
    ex: ['L:D über Fis mit dem Zeigefinger, A-Saite blockieren.', 'E:D – D/F# – G, 60 BPM, je 4 Schläge. Geschafft, wenn du die aufsteigende Basslinie D – Fis – G hörst.'] },
  { id: 'k14-4', t: '14.4 Fett und schön: Quinte unten, 9 oben', p: [
    '„Pseudo-Drop-D“: den Zeigefinger überstrecken und unten noch die Quinte mitspielen – „klingt trotzdem wie ein C, nur fetter“.',
    'D- und A-Saiten-Powerchord: „Da packt man eigentlich immer oben die 9 mit rein, weil geil.“ Auf der E-Saite nicht, „da ist zu viel Zeug oben“.',
    'Ohne Terz heißt das Sus2. „Die Sus2 überstreckt geht auch.“',
    'Wenn eine Major 7 Sinn macht (Stufe 1 oder 4): die wunderschöne <b>8 – Major 7 – 1</b>-Bewegung.'],
    g: [{ n: 'C5', fr: [3, 3, 5, 5, null, null], iv: '1 5', cap: 'Quinte unten (überstreckt)' }, { n: 'Fsus2', fr: [null, 3, 3, 5, 6, 3], iv: '1 2 5', cap: 'D-Saiten-Powerchord, 9 oben, Quinte unten' },
        { n: 'C5', fr: [null, 3, 5, 5, null, null], iv: '1 5', cap: '8' }, { n: 'C (8 → 7)', r: 0, fr: [null, 3, 5, 4, null, null], iv: '1 5 7', cap: 'Major 7 statt 8' }],
    ex: ['L:Pseudo-Drop-D: Zeigefinger überstrecken, tiefe Quinte mit.', 'L:9 oben auf D- und A-Saiten-Powerchord; Sus2 überstreckt.', 'L:8 – Major 7 – 1 auf C und F.'] },
  { id: 'k14-5', t: '14.5 Gleiche Töne halten', p: [
    '„Aus der 5 mache ich hier die 4 – sehr cool.“ Von C nach B-flat bleiben die 4 und die 8 liegen, daraus wird ein B-flat-sus2. „<b>Gleiche Töne sind immer geil.</b>“',
    'Aus Versehen entdeckt: Csus2 und oben den kleinen Finger flach – das ergibt Fis und B. „Das B ist für das C die Major 7 … das ist dann mein Fis (#11). Ich bin innerhalb von G-Dur.“ Ergebnis: <b>Major 7, 9, #11</b>.',
    'Zum Schluss: „Zeigefinger strecken, die 9 mit rein. Ihr könnt ein Sus spielen. Der Dur-Powerchord ist immer gut.“'],
    m: '„Gleiche Töne sind immer geil.“',
    g: [{ n: 'Csus4', fr: [null, 3, 3, 5, null, null], iv: '1 4', cap: '1 – 4 – 8' }, { n: 'Bbsus2', fr: [null, 1, 3, 5, null, null], iv: '1 2 5', cap: '4 und 8 des C bleiben liegen' },
        { n: 'Cmaj7(9,#11)', nine: true, fr: [null, 3, 5, 7, 7, 7], iv: '1 5 7 9 #11', cap: 'Csus2 + kleiner Finger flach, ohne Terz' }],
    loop: [{ c: ['Csus4', 'Bbsus2'], fr: { Csus4: [null, 3, 3, 5, null, null], Bbsus2: [null, 1, 3, 5, null, null] }, bpm: 75, t: 'zwei Töne bleiben' }],
    ex: ['L:C-sus → B-flat-sus2: 4 und 8 festhalten.', 'L:Csus2 + flach gelegter kleiner Finger = Major 7, 9, #11.', 'E:Wechsle Csus4 und Bbsus2. Geschafft, wenn du die zwei liegen bleibenden Töne (F und C) benennst.'] }
] });

// ===== Kapitel 15 – Drop D und tiefere Stimmungen =====
PcKurs.K.push({ t: 'Kapitel 15 – Drop D und tiefere Stimmungen', s: [
  { id: 'k15-1', t: '15.1 Drop D stimmen', p: [
    '„Gucken wir uns jetzt mal kurz Drop D an und versuchen da, was wir gelernt haben, anzuwenden.“',
    '„Tiefe E-Saite anhauen und dann runter, bis es stimmt.“ – einen Ganzton tiefer auf D. „Ja, man kann auch ein Stimmgerät nehmen.“',
    '„Um denselben Ton zu spielen, muss ich also zwei Bünde höher greifen.“',
    'Warum Drop D? Der Powerchord geht mit <b>einem Finger</b> (Zeigefinger über drei Saiten). „Das ist ja nur wegen Faulheit.“ Offen klingen die drei Saiten D-A-D.',
    'Damit gehen schnellere Powerchord-Wechsel.'],
    g: [{ n: 'D5', tu: 'dD', fr: [0, 0, 0, null, null, null], iv: '1 5', cap: 'Drop D, offen' }, { n: 'F5', tu: 'dD', fr: [3, 3, 3, null, null, null], iv: '1 5', cap: 'ein Finger, 3. Bund' }, { n: 'G5', tu: 'dD', fr: [5, 5, 5, null, null, null], iv: '1 5' }, { n: 'A5', tu: 'dD', fr: [7, 7, 7, null, null, null], iv: '1 5' }],
    loop: [{ c: ['D5', 'F5', 'G5', 'A5'], tu: 'dD', fr: { D5: [0, 0, 0, null, null, null], F5: [3, 3, 3, null, null, null], G5: [5, 5, 5, null, null, null], A5: [7, 7, 7, null, null, null] }, bpm: 90, t: 'Drop D, ein Finger' }],
    ex: ['L:Tiefe E-Saite auf D stimmen.', 'L:Powerchord mit einem Finger (Zeigefinger) greifen, offen die drei Saiten.',
      'E:D5 – F5 – G5 – A5 in Drop D (Bund 0, 3, 5, 7), 80 BPM, je 4 Schläge. Geschafft, wenn du nur den Zeigefinger verschiebst.'] },
  { id: 'k15-2', t: '15.2 Der fette Powerchord mit Sus2 und Terzen', p: [
    '„Um den super-mega-fetten Powerchord hinzukriegen: … 1-5-8 … und oben schön Sus2 drauf.“',
    'Auf der tiefen Saite ändern sich die Töne (wegen der Stimmung).',
    '„Ich kann auch jetzt <b>Terzen</b> reinbringen, weil die sind nämlich <b>nicht mehr unten matschig</b>, die sind jetzt ziemlich weit weg von meinen fetten Grundtönen.“ (Kapitel 3/4)',
    '„Jetzt kann ich mit dem kleinen Finger einen Moll machen. Ich kann also auf diese Powerchords jetzt die Terzen draufballern.“ Ob Dur- oder Mollterz, entscheidet die Tonart.',
    'Über die dicken Powerchords gehen auch Major 7 und kleine 7. „Absolut super geile Sachen, die mit Standard-Tuning nicht funktionieren.“',
    'Grenze: Die Quinte unten durch Überstrecken (Kapitel 14) geht in Drop D so nicht – „nicht mehr elegant“.'],
    g: [{ n: 'Dsus2', tu: 'dD', fr: [0, 0, 0, null, null, 0], iv: '1 2 5', cap: '1-5-8 + leere e-Saite (9)' }, { n: 'Gm', tu: 'dD', fr: [5, 5, 5, 3, null, null], iv: '1 b3 5', cap: 'Terz oben (eine Möglichkeit)' },
        { n: 'G', tu: 'dD', fr: [5, 5, 5, 4, null, null], iv: '1 3 5', cap: 'Durterz' }],
    ex: ['L:Dsus2 als 1-5-8-9.', 'L:Terzen oben draufsetzen (Dur oder Moll je nach Tonart).', 'L:B-flat → Csus2 und F → G.', 'L:Major 7 und kleine 7 über den dicken Powerchords.',
      'E:Dsus2 (Drop D: D-A-D leer + leere e-Saite). Geschafft, wenn du das E als „9 oder 2“ benennst.'] },
  { id: 'k15-3', t: '15.3 Noch tiefer: nur die tiefe Saite', p: [
    'Manche Songs mussten „tief, brutal“ sein, aber nicht auf D. Die ganze Gitarre verstimmen? „Nee, will ich eigentlich nicht.“',
    'Der Trick: „<b>einfach nur die tiefe Saite</b>“ tiefer stimmen – auf <b>Cis</b>. „Jetzt muss ich auf der tiefen Saite einen Bund höher gehen. Alles andere bleibt komplett gleich.“',
    '„Was ich eben gemacht habe mit dem Sus, funktioniert immer noch wunderbar.“',
    'Song in <b>C</b>: noch einen Halbton tiefer, der Powerchord noch einen Bund höher. Bis <b>B</b> geht es auch – „wenn ich wirklich bescheuert bin“.',
    'Siebensaiter: eine Saite unten dran, „die spielt sich genau wie eine 6-Saite“. Mit Drop A wird es so tief, dass die 9er „nicht mehr funktionieren“.'],
    m: '„Ihr müsst nicht die komplette Gitarre umbauen.“',
    g: [{ n: 'D5', tu: 'dCis', fr: [1, 0, 0, null, null, null], iv: '1 5', cap: 'tiefe Saite auf Cis' }, { n: 'D5', tu: 'dC', fr: [2, 0, 0, null, null, null], iv: '1 5', cap: 'tiefe Saite auf C' }, { n: 'D5', tu: 'dB', fr: [3, 0, 0, null, null, null], iv: '1 5', cap: 'tiefe Saite auf B' }],
    ex: ['L:Tiefe Saite auf Cis oder C stimmen und den Powerchord-Griff anpassen (einen Bund höher bzw. noch einen höher).',
      'E:Stimme die tiefe Saite auf C (Stimmgerät) und spiele D5 mit der tiefen Saite im 2. Bund. Geschafft, wenn der Powerchord klingt wie vorher.'] },
  { id: 'k15-4', t: '15.4 Ende des Kurses', p: [
    '„Ihr habt all das Wissen … vom Jazz zu Metal über Shreddy-Arpeggios-Zeug, geile Pop-Dreiklänge … ihr habt hier jetzt alles gelernt.“',
    '„Wenn Powerchords und CAGED-Akkorde euer Einstieg waren, dann habt ihr hoffentlich Pausen gemacht.“ „<b>Das ist ein Kurs, der sollte euch fast ein Leben lang begleiten.</b>“',
    '„Ihr müsst rausfinden, wo sind denn die Noten … Das sind Sachen, die kommen mit der Zeit.“'],
    m: '„Wenn ihr bis 13 zählen könnt und euch so ein paar Sachen merken könnt, alles, was ich kann, könnt ihr schon lang.“',
    ex: ['E:Wähle aus jedem Teil (Powerchord, CAGED, Drop 2/3, Dreiklänge, Arpeggio, Drop D) einen Griff und spiele alle sechs hintereinander. Geschafft, wenn du bei jedem sagst, warum er so heißt.'] }
] });

// ===== v129: Kapitel-Daten für Startseite und einheitlichen Aufbau (Kurztitel, Kurzbeschreibung, Ziel, Merkkarten, Querverweise) =====
(function () {
  const M = [
    ['Einleitung', 'Worum es geht, Zahlen statt Griffbilder, A B C D E F G und B-flat.', 'Du weißt, worauf der Kurs aufbaut (1-5-8), und liest Ton- und Intervallnamen wie der Lehrer.', ['„Gitarrenakkorde sind nicht kompliziert.“ – Wer bis 13 zählen kann, baut sie sich selbst.']],
    ['Grundlagen', 'Powerchord 1-5-8, Stammtöne, Töne ableiten.', 'Du greifst den Powerchord, kennst die Stammtöne der E- und A-Saite und leitest jeden anderen Ton per Powerchord ab.', ['Zwischen E–F und B–C liegt kein Zwischenton.', 'Die 8 ist die 1 – eine Oktave höher.']],
    ['Intervalle', 'Werkstatt: jedes Intervall sehen, hören, finden.', 'Du findest jedes Intervall von 1 bis 8 auf dem Griffbrett und hörst den Unterschied.', null],
    ['CAGED', 'Fünf offene Griffe, Moll, Barré, Arpeggio.', 'Du kennst die fünf Pfadfinder-Akkorde, machst aus Dur Moll und verschiebst sie als Barré.', ['In E, A und D steckt unten immer ein Powerchord 1-5-8.', 'Dur → Moll: die Terz einen Halbton tiefer.']],
    ['Funktionen', 'Stufenakkorde, Tonika, Subdominante, Dominante.', 'Du kennst die Stufenakkorde einer Dur-Tonart und weißt, welche sich vertreten.', ['Dur, Moll, Moll, Dur, Dur, Moll, vermindert – in jeder Dur-Tonart.', '1 stabil, 4 schwebend, 5 will heim.']],
    ['Sus · Add', 'Sus2, Sus4, add9, add11 – und wo sie passen.', 'Du baust Sus- und Add-Akkorde aus der Terz ab und weißt, auf welchen Stufen sie passen.', ['Keine Terz = Sus. Terz drin = add (9, 11).', 'Sus4 schwächt die Dominante.']],
    ['7er', 'Welche 7 auf welche Stufe, offen und im Barré.', 'Du leitest Major 7, Dominant 7, Moll 7 und Moll 7b5 aus der 8 ab – offen und als Barré.', ['Unter der 8 liegt die große 7, zwei Halbtöne darunter die kleine 7.', 'Große 7 nur auf Stufe 1 und 4.']],
    ['Drop 2/3', 'Closed Voicings spielbar machen, Umkehrungen, Stimmführung.', 'Du leitest Drop-2- und Drop-3-Griffe aus dem Closed Voicing ab und spielst eine Folge in einer Lage.', ['Drop 2: zweite Note von oben eine Oktave tiefer. Drop 3: dritte Note von oben.', 'Drop 3 auf der E-Saite, Drop 2 auf A- und D-Saite.']],
    ['Dreiklänge', 'Drei Töne, Umkehrungen, kleine Schritte.', 'Du nimmst Dreiklänge aus bekannten Griffen heraus und verbindest Akkorde mit kleinen Schritten.', ['Drei Töne hintereinander, keine doppelten, Grundton im Blick.']],
    ['Ear Candy', 'Weniger spielen, 9, 11 und Major 7 gezielt einsetzen.', 'Du weißt vorher, welche Zusatztöne (9, 11, Major 7) auf welcher Stufe funktionieren.', ['Was kann ich aufgeben? Zuerst die 5.', '1 und 4: Major 7; auf der 4 die #11; auf der 5 lieber 9 oder 11 statt 7.']],
    ['7/9-Akkorde', '6er, 7(9), b9, #9 – der Hendrix-Akkord.', 'Du baust 7/9-Akkorde und die alterierten b9/#9 aus dem Major 7 ab.', ['Ohne 7 heißt die 6 „6“, mit 7 heißt sie 13.', 'b9 zieht auf Moll eine Quinte tiefer. #9 = Dur mit kleiner Terz obendrauf.']],
    ['Arpeggios 1', 'Dreiklangs-Arpeggios aus den CAGED-Griffen.', 'Du spielst jeden CAGED-Griff als Arpeggio, ohne Töne zu überspringen, in verschiedenen Rhythmen.', ['Arpeggio = Akkordtöne hintereinander. Immer beim Grundton anfangen.']],
    ['Arpeggios 7', 'Septakkord-Arpeggios, Springen, Akkordteppich.', 'Du baust die 7 (unter der 8) ins Arpeggio ein und nutzt Arpeggios auch als Begleitung.', ['Wo ist die 8? Dann weiß ich, wo die 7 ist.']],
    ['Dur-Powerchord', 'Terz im Bass, Quinte unten, 9 oben.', 'Du spielst den Dur-Powerchord (3-1), Slash-Akkorde mit Terz im Bass und fette Powerchord-Varianten.', ['Terz im Bass zieht – mehr bei Dur als bei Moll.', 'Gleiche Töne halten klingt immer gut.']],
    ['Drop D', 'Drop D, Cis, C, B – nur die tiefe Saite.', 'Du stimmst Drop D, greifst Powerchords mit einem Finger und passt Griffe an tiefere Stimmungen an.', ['Nur die tiefe Saite tiefer: Powerchord-Griff je Halbton einen Bund höher.']]
  ];
  M.forEach(([short, d, z, mk], i) => Object.assign(PcKurs.K[i], { short, d, z }, mk ? { mk } : {}));
  const X = { 'k1-1': [2], 'k2-1': [14], 'k2-4': [3], 'k4-7': [2], 'k4-9': [9, 12], 'k4-12': [12], 'k5-1': [7, 10], 'k5-4': [10], 'k6-4': [14, 15], 'k6-8': [10, 11], 'k7-2': [8, 13], 'k7-5': [8], 'k7-7': [8], 'k7-8': [8, 11],
    'k8-2': [7], 'k8-3': [7], 'k8-6': [7, 11], 'k8-7': [7], 'k9-2': [4, 12], 'k9-5': [7], 'k9-6': [5, 10], 'k10-1': [5, 7], 'k10-2': [6], 'k10-5': [5, 9], 'k11-1': [7], 'k11-2': [6, 7], 'k11-4': [8], 'k11-6': [3],
    'k12-1': [4, 9], 'k12-3': [4], 'k12-5': [5], 'k13-1': [7, 12], 'k13-4': [5, 9], 'k14-1': [2], 'k14-4': [6, 15], 'k14-5': [8, 10], 'k15-2': [3, 14], 'k15-3': [2] };
  PcKurs.K.forEach(C => C.s.forEach(S => { if (X[S.id]) S.x = X[S.id]; }));
})();
