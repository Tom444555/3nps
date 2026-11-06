// v126: Kurs Kapitel 3 als „Intervall-Werkstatt“ – Schritte, Intervall-Knöpfe, Akkord-Baukasten, Merkkarten, Übungs-Quiz.
// Wird erst beim Aufklappen von Kapitel 3 gebaut (PcKurs.fillChapter → PcWerk.build). Ergebnisse: powerchords.progress.v1 → kurs["w-find"|"w-name"|"w-hear"].
(function () {
  const MIDI0 = [40, 45, 50, 55, 59, 64], SN = ['E', 'A', 'D', 'G', 'H', 'e'], MAXF = 24, md = x => ((x % 12) + 12) % 12;
  const IV = [[0, '1', 'Prime'], [1, 'b2', 'kl. Sekunde'], [2, '2', 'gr. Sekunde'], [3, 'b3', 'kl. Terz'], [4, '3', 'gr. Terz'], [5, '4', 'Quarte'], [6, 'b5', 'Tritonus'],
    [7, '5', 'Quinte'], [8, 'b6', 'kl. Sexte'], [9, '6', 'gr. Sexte'], [10, 'b7', 'kl. Septime'], [11, '7', 'gr. Septime'], [12, '8', 'Oktave']];
  const DEG = [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7, 8];
  const longN = N => IV[N][2].replace('kl. ', 'kleine ').replace('gr. ', 'große ');
  const art = (N, cap) => (N === 6 ? (cap ? 'Der' : 'der') : (cap ? 'Die' : 'die'));
  const fam = N => (N % 12 === 0 ? 'f1' : N === 7 ? 'f5' : N === 3 || N === 4 ? 'f3' : N === 5 ? 'f4' : 'fx');
  const L0 = s => (window.__lang === 'en' && window.__EN_PCW && window.__EN_PCW[s]) || s, L = s => PcSkin.btn(L0(s));
  // ---------- Notennamen (Lehrer: A B C D E F G, B-flat = Bb) ----------
  const LET = 'CDEFGAB', LPC = [0, 2, 4, 5, 7, 9, 11];
  const SH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], FL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const ROOT = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const rootName = pc => ROOT[md(pc)];
  function spell(rn, N) {
    const rp = md(LPC[LET.indexOf(rn[0])] + (rn[1] === '#' ? 1 : rn[1] === 'b' ? -1 : 0)), tp = md(rp + N), li = (LET.indexOf(rn[0]) + DEG[N] - 1) % 7;
    const d = md(tp - LPC[li]), acc = d === 0 ? '' : d === 1 ? '#' : d === 11 ? 'b' : null, n = acc == null ? null : LET[li] + acc;
    return n && !/^(Cb|Fb|E#|B#)$/.test(n) ? n : (rn[1] === 'b' ? FL : SH)[tp];
  }
  // ---------- Lagen ----------
  const pit = (s, f) => MIDI0[s] + f;
  function posBox(rs, rf, N) {                                         // Kasten um den Grundton (Bund rf−1 … rf+3), tiefste Saite zuerst
    const tg = pit(rs, rf) + N;
    for (let t = rs; t < 6; t++) { const f = tg - MIDI0[t]; if (f >= Math.max(0, rf - 1) && f <= rf + 3) return { s: t, f }; }
    let best = null; for (let t = rs; t < 6; t++) { const f = tg - MIDI0[t]; if (f >= 0 && f <= MAXF && (!best || Math.abs(f - rf) < Math.abs(best.f - rf))) best = { s: t, f }; }
    return best || { s: rs, f: rf + N };
  }
  function posTwo(rs, rf, N) { if (rs >= 5) return { s: rs, f: rf + N }; const f = pit(rs, rf) + N - MIDI0[rs + 1]; return f >= 0 ? { s: rs + 1, f } : { s: rs, f: rf + N }; }
  // ---------- Akkord-Baukasten (nur Akkordarten aus dem Kurs, Kap. 2/4–7) ----------
  const TY = [
    { k: '5', nm: 'Powerchord', sym: '5', req: [0, 7] },
    { k: 'dur', nm: 'Dur', sym: '', req: [0, 4, 7] },
    { k: 'moll', nm: 'Moll', sym: 'm', req: [0, 3, 7] },
    { k: 'sus2', nm: 'sus2', sym: 'sus2', req: [0, 2, 7] },
    { k: 'sus4', nm: 'sus4', sym: 'sus4', req: [0, 5, 7] },
    { k: 'add9', nm: 'add9', sym: 'add9', req: [0, 2, 4, 7], nine: [2] },
    { k: 'madd9', nm: 'Moll add9', sym: 'm(add9)', req: [0, 2, 3, 7], nine: [2] },
    { k: 'add11', nm: 'add11', sym: 'add11', req: [0, 4, 5], opt: [7], nine: [5] },
    { k: 'madd11', nm: 'Moll add11', sym: 'm(add11)', req: [0, 3, 5], opt: [7], nine: [5] },
    { k: '7', nm: 'Dominant 7', sym: '7', req: [0, 4, 10], opt: [7] },
    { k: 'maj7', nm: 'Major 7', sym: 'maj7', req: [0, 4, 11], opt: [7] },
    { k: 'm7', nm: 'Moll 7', sym: 'm7', req: [0, 3, 10], opt: [7] },
    { k: 'mmaj7', nm: 'Moll mit großer 7', sym: 'm(maj7)', req: [0, 3, 11], opt: [7] },
    { k: 'm7b5', nm: 'halbvermindert', sym: 'm7b5', req: [0, 3, 6, 10] },
    { k: 'dim', nm: 'vermindert', sym: 'm(b5)', req: [0, 3, 6] },
    { k: 'dim7', nm: 'vollvermindert', sym: ' vollvermindert', req: [0, 3, 6, 9] },
    { k: 'maj79', nm: 'Major 7 mit 9', sym: 'maj7(9)', req: [0, 2, 4, 11], opt: [7], nine: [2] },
    { k: 'm711', nm: 'Moll 7 mit 11', sym: 'm7(11)', req: [0, 3, 5, 10], opt: [7], nine: [5] }
  ];
  const tLab = (t, n) => (t.nine && t.nine.includes(n) ? { 2: '9', 5: '11' }[n] : t.k === 'dim7' && n === 9 ? 'bb7' : IV[n][1]);
  const formula = t => { const a = t.req.slice().sort((x, y) => x - y).map(n => tLab(t, n)), o = (t.opt || []).map(n => '(' + tLab(t, n) + ')');
    if (t.k === '5') return '1 · 5 (· 8)'; const all = t.req.concat(t.opt || []).sort((x, y) => x - y); return all.map(n => (t.opt || []).includes(n) ? '(' + tLab(t, n) + ')' : tLab(t, n)).join(' · '); };
  const cname = (t, rn) => (t.k === 'dur' ? rn + '-Dur' : t.k === 'moll' ? rn + '-Moll' : rn + t.sym);
  function chordOf(sel) {
    const P = new Set([...sel].map(n => n % 12)), hit = TY.filter(t => t.req.every(n => P.has(n)) && [...P].every(n => t.req.includes(n) || (t.opt || []).includes(n)));
    if (hit.length) return { t: hit[0], n: hit.length };
    let best = null;
    TY.forEach(t => { const al = t.req.concat(t.opt || []), mi = t.req.filter(n => !P.has(n)), ex = [...P].filter(n => !al.includes(n)), sc = mi.length + ex.length * 1.01;
      if (!best || sc < best.sc - 1e-9) best = { t, mi, ex, sc }; });
    return { t: null, near: best };
  }
  // ---------- Merkkarten (Formulierungen des Lehrers, Kap. 3) ----------
  const CARDS = [
    ['f1', '<b>Nur sieben Zahlen:</b> 1 bis 8, die 8 ist wieder die 1. „Wir bleiben bei Zahlen.“'],
    ['f5', '<b>Nur einmal:</b> 1 · 4 · 5 · 8<br>„Es gibt keine große 5 oder kleine 5.“'],
    ['f3', '<b>Zweimal (klein / groß):</b> 2 · 3 · 6 · 7<br>klein = mit b, groß = ohne Zeichen'],
    ['fx', '<b>Tritonus</b> (b5, #4, #11) zwischen 4 und 5 – „Bart Simpson“. Keine kleine 5, keine große 4.'],
    ['f3', '<b>3 = große Terz</b> („happy“), <b>b3 = kleine Terz</b> (Moll, traurig) – einen Bund unter der 3.'],
    ['fx', '<b>b2</b> einen Bund unter der 2: „Sofort sind wir in einer coolen abgedrehten Tonart.“'],
    ['f1', '<b>Von der 8 ableiten:</b> 7, b7, 6, b6, 5, Bart Simpson, 4, 3, b3, 2, b2, 1.'],
    ['f4', '<b>Die 7 im Akkordsymbol:</b> „7“ = kleine 7, groß = maj7 / M7 / Δ7. „Ich weiß, das ist echt kaputt.“'],
    ['f5', '<b>9 · 11 · 13:</b> eine Oktave höher wird 2 → 9, 4 → 11, 6 → 13 – wenn sie zusätzlich zum Akkord klingen. 3 und 5 werden nie umbenannt.']
  ];
  const STEPS = [[1, '1 Eine Saite'], [2, '2 Abstand = Intervall'], [3, '3 Zwei Saiten'], [4, '4 Powerchord'], [5, '5 Alles zusammen'], [6, '✎ Übungen']];
  const CAP = { 1: 'Grundton auf einer Saite: jeder Bund = 1 Halbton weiter.', 2: 'Der Abstand in Halbtönen ist das Intervall – egal, auf welcher Saite der Ton liegt.',
    3: 'Dasselbe Intervall als Griffform über zwei Saiten. Achtung G→H: dort ein Bund mehr.', 4: 'Powerchord: 1 · 5 · 8 leuchten, die anderen Intervalle liegen drumherum.',
    5: 'Alle Intervalle um den Grundton, in Familienfarben.', 6: 'Tippe auf dem Griffbrett oder wähle eine Antwort. 10 Aufgaben je Runde.' };
  const W = { seen: new Set(), st: 1, rs: 0, rf: 5, n: 4, lab: 'num', multi: false, sel: new Set([0, 4, 7]), q: null };
  let A = null, el = null, C = null;
  const $q = s => el.querySelector(s);
  const effRf = () => (W.st === 1 && W.rf > MAXF - 12 ? W.rf - 12 : W.rf);

  // ---------- Griffbrett ----------
  function labOf(m) {
    const iv = IV[m.N], ton = m.ton;
    if (W.lab === 'name') return iv[2].split(' ');
    if (W.lab === 'ton') return [ton];
    if (W.lab === 'all') return [m.num || iv[1], iv[2].replace('Sekunde', 'Sek.').replace('Septime', 'Sept.'), ton];
    return [m.num || iv[1]];
  }
  function marksFor() {
    const rf = effRf(), rs = W.rs, rn = rootName(pit(rs, rf)), out = [], mk = (N, p, cls, extra) => out.push(Object.assign({ N, s: p.s, f: p.f, ton: spell(rn, N), cls: fam(N) + (cls ? ' ' + cls : '') }, extra || {}));
    let arrow = null, alt = null;
    if (W.st === 6) { const q = W.q; mk(0, { s: rs, f: rf }, 'root');
      if (q && q.kind === 'name') { const p = q.p; out.push({ N: q.N, s: p.s, f: p.f, ton: '?', cls: 'fq', q: true }); }
      if (q && q.ans != null && q.show) mk(q.N, q.show, 'cur'); return { out, arrow, rn }; }
    if (W.multi) { [...W.sel].sort((a, b) => a - b).forEach(N => mk(N, N ? posBox(rs, rf, N) : { s: rs, f: rf }, N ? '' : 'root')); return { out, arrow, rn }; }
    const N = W.n;
    if (W.st <= 3) {
      const p = W.st === 1 ? { s: rs, f: rf + N } : W.st === 2 ? posBox(rs, rf, N) : posTwo(rs, rf, N);
      mk(0, { s: rs, f: rf }, 'root'); if (N) { mk(N, p, 'cur'); arrow = { a: { s: rs, f: rf }, b: p, N }; }
      if (W.st === 2 && N && p.s !== rs && rf + N <= MAXF) mk(N, { s: rs, f: rf + N }, 'ghost2');
      if (W.st === 3 && N) { const as = rs === 3 ? 2 : 3, af = pit(as, rf) + N - MIDI0[as + 1];
        if (as !== rs && af >= 0 && af <= MAXF) { const rn2 = rootName(pit(as, rf)); out.push({ N: 0, s: as, f: rf, ton: rn2, cls: 'f1 alt' }, { N, s: as + 1, f: af, ton: spell(rn2, N), cls: fam(N) + ' alt' }); alt = { s: as, f: rf, d: af - rf }; } }
      return { out, arrow, alt, rn };
    }
    for (let k = 0; k <= 12; k++) { const p = k ? posBox(rs, rf, k) : { s: rs, f: rf }, on = W.st === 5 || k === 0 || k === 7 || k === 12;
      mk(k, p, (on ? '' : 'dim') + (k === 0 ? ' root' : '') + (k === N && k ? ' cur' : '')); }
    return { out, arrow, rn };
  }
  function drawBoard() {
    const { out, arrow, alt, rn } = marksFor(), rf = effRf(), rp = md(pit(W.rs, rf));
    const fs = out.map(m => m.f).concat([rf]); let a = Math.max(0, Math.min(...fs) - 1);   // v127: immer 13 Bünde → Griffbrett springt nicht
    if (Math.max(...fs) > a + 12) a = Math.max(...fs) - 12; a = Math.min(a, MAXF - 12); const b = a + 12;
    const cols = b - a + 1, CW = 56, RH = 56, LM = 30, TM = 8, BM = 24, Wd = LM + cols * CW + 6, H = TM + 6 * RH + BM;
    const X = f => LM + (f - a) * CW + CW / 2, Y = s => TM + (5 - s) * RH + RH / 2;
    let h = '<svg class="pc-wb" viewBox="0 0 ' + Wd + ' ' + H + '" translate="no" role="img" aria-label="Griffbrett"><defs><marker id="pcwAr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="pc-war"/></marker></defs>';
    h += PcSkin.draw({ x: LM, y: TM, w: cols * CW, h: 6 * RH, a, b, CW, sw: s => 1.2 + (5 - s) * 0.45 });   // v127
    for (let f = a; f <= b; f++) { const x = LM + (f - a + 1) * CW; 
      h += '<text class="pc-fn" x="' + X(f) + '" y="' + (H - 7) + '">' + f + '</text>'; }
    for (let s = 0; s < 6; s++) h += '<text class="pc-sn" x="11" y="' + Y(s) + '">' + SN[s] + '</text>';
    const used = new Set(out.map(m => m.s + ':' + m.f));
    if (W.st !== 6) for (let s = 0; s < 6; s++) for (let f = a; f <= b; f++) if (md(pit(s, f)) === rp && !used.has(s + ':' + f)) {
      h += '<g class="pc-wm ghost"><circle cx="' + X(f) + '" cy="' + Y(s) + '" r="17"/><text x="' + X(f) + '" y="' + Y(s) + '">' + (W.lab === 'ton' ? rn : W.lab === 'num' ? (pit(s, f) > pit(W.rs, rf) ? '8' : '1') : 'Prime') + '</text></g>'; }
    if (arrow) { const x1 = X(arrow.a.f), y1 = Y(arrow.a.s), x2 = X(arrow.b.f), y2 = Y(arrow.b.s), L0 = Math.hypot(x2 - x1, y2 - y1) || 1, k1 = 21 / L0, k2 = (L0 - 23) / L0;
      if (L0 > 46) h += '<line class="pc-warl" x1="' + (x1 + (x2 - x1) * k1) + '" y1="' + (y1 + (y2 - y1) * k1) + '" x2="' + (x1 + (x2 - x1) * k2) + '" y2="' + (y1 + (y2 - y1) * k2) + '" marker-end="url(#pcwAr)"/>';
      const my = Math.min(y1, y2) - 33 < TM + 6 ? Math.max(y1, y2) + 33 : Math.min(y1, y2) - 33;
      h += '<text class="pc-wht ' + fam(arrow.N) + '" x="' + (x1 + x2) / 2 + '" y="' + my + '">+' + arrow.N + ' Halbtöne</text>'; }
    if (alt) h += '<text class="pc-wht alt" x="' + X(alt.f) + '" y="' + (Y(alt.s + 1) - 26) + '">G→H: ein Bund mehr</text>';
    out.forEach(m => { const ls = m.q ? ['?'] : labOf(m), r = W.lab === 'all' ? 22 : 20, fsz = ls.length > 2 ? 8.5 : ls.length > 1 ? 9.5 : (ls[0].length > 3 ? 10 : 13);
      h += (/ghost|dim/.test(m.cls) ? '' : PcSkin.shadow(X(m.f), Y(m.s), r)) + '<g class="pc-wm ' + m.cls + '" data-n="' + m.N + '" data-s="' + m.s + '" data-f="' + m.f + '"><circle cx="' + X(m.f) + '" cy="' + Y(m.s) + '" r="' + r + '"/><text x="' + X(m.f) + '" y="' + Y(m.s) + '" style="font-size:' + fsz + 'px">' +
        ls.map((t, i) => '<tspan x="' + X(m.f) + '" dy="' + (i ? '1.1em' : (-(ls.length - 1) * 0.55) + 'em') + '">' + t + '</tspan>').join('') + '</text></g>'; });
    for (let s = 0; s < 6; s++) for (let f = a; f <= b; f++) h += '<rect class="pc-cell" data-s="' + s + '" data-f="' + f + '" x="' + (LM + (f - a) * CW) + '" y="' + (TM + (5 - s) * RH) + '" width="' + CW + '" height="' + RH + '"/>';
    $q('.pc-wbw').innerHTML = h + '</svg>';
  }
  // ---------- Info / Baukasten ----------
  function info() {
    const rf = effRf(), rn = rootName(pit(W.rs, rf));
    if (W.multi) {
      const r = chordOf(W.sel); let h;
      if (r.t) h = '<div class="pc-wch"><b class="pc-wbig" data-ch="' + r.t.k + '">' + cname(r.t, rn) + '</b><span class="pc-wsub">' + (r.t.k === '5' ? 'Powerchord' : r.t.nm) + '</span></div><p class="pc-wform">' + r.t.nm + ' = ' + formula(r.t) + '</p>';
      else { const nb = r.near, parts = nb.mi.map(n => 'noch die ' + tLab(nb.t, n) + ' dazu').concat(nb.ex.map(n => 'ohne die ' + IV[n][1]));
        h = '<div class="pc-wch"><b class="pc-wbig none" data-ch="">kein gängiger Akkord</b></div><p class="pc-wform" data-near="' + nb.t.k + '">' + parts.join(' und ') + ' → ' + cname(nb.t, rn) + '</p>'; }
      $q('.pc-winfo').innerHTML = h; return;
    }
    if (W.st === 6) { $q('.pc-winfo').innerHTML = ''; return; }
    const N = W.n, p = W.st === 1 ? { s: W.rs, f: rf + N } : W.st === 3 ? posTwo(W.rs, rf, N) : posBox(W.rs, rf, N), ton = spell(rn, N);
    let tip = N + (N === 1 ? ' Halbton = 1 Bund' : ' Halbtöne = ' + N + ' Bünde') + ' weiter';
    if (p.s === W.rs) tip += N ? ' auf derselben Saite.' : '.'; else { const k = p.s - W.rs, d = p.f - rf, ad = Math.abs(d);
      tip += '. Griffig: ' + (k === 1 ? 'eine Saite' : k === 2 ? 'zwei Saiten' : k + ' Saiten') + ' höher, ' + (d === 0 ? 'im gleichen Bund' : (ad === 1 ? 'einen Bund ' : ad + ' Bünde ') + (d < 0 ? 'vor' : 'hinter') + ' dem Grundton') + (W.rs <= 3 && p.s >= 4 ? ' (über G→H ein Bund mehr)' : '') + '.'; }
    $q('.pc-winfo').innerHTML = '<p class="pc-wline"><b class="c-f1">' + rn + '</b> → <b class="c-' + fam(N) + '">' + ton + '</b> = <b class="c-' + fam(N) + '">' + longN(N) + ' (' + IV[N][1] + ')</b></p><p class="caption">' + tip + '</p>';
  }
  function paintIv() {
    el.querySelectorAll('[data-w=iv]').forEach(b => { const n = +b.dataset.n, on = W.multi ? W.sel.has(n) : n === W.n; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    W.seen.add(W.st); el.querySelectorAll('[data-w=st]').forEach(b => { const v = +b.dataset.v; b.classList.toggle('active', v === W.st); b.classList.toggle('seen', v !== W.st && W.seen.has(v)); });
    el.querySelectorAll('.pc-wsl').forEach((l, i) => l.classList.toggle('on', W.seen.has(i + 1) && W.seen.has(i + 2)));
    el.querySelectorAll('[data-w=lab]').forEach(b => b.classList.toggle('active', b.dataset.v === W.lab));
    $q('[data-w=multi]').classList.toggle('active', W.multi); $q('[data-w=multi]').setAttribute('aria-pressed', W.multi ? 'true' : 'false');
    $q('.pc-wsingle').hidden = W.multi || W.st === 6; $q('.pc-wmulti').hidden = !W.multi || W.st === 6; $q('.pc-wq').hidden = W.st !== 6; $q('.pc-wivs').hidden = W.st === 6;
    $q('.pc-wcap').textContent = CAP[W.st]; $q('.pc-wstrip').hidden = W.st !== 1 || W.multi;
  }
  function paint() { paintIv(); drawBoard(); info(); paintStrip(); if (W.st === 6) paintQuiz(); }
  function paintStrip() {
    if (W.st !== 1) return; const rf = effRf(), rn = rootName(pit(W.rs, rf));
    $q('.pc-wstrip .pc-wtiles').innerHTML = IV.map(([N, num, nm]) => '<button class="pc-wtile ' + fam(N) + (N === W.n ? ' active' : '') + '" data-w="iv" data-n="' + N + '"><b>' + num + '</b><span>' + nm.replace('Sekunde', 'Sek.').replace('Septime', 'Sept.') + '</span><span translate="no">' + spell(rn, N) + ' · ' + (rf + N) + '</span></button>').join('');
  }
  // ---------- Klang ----------
  const rootM = () => pit(W.rs, effRf());
  function play(kind) {
    const r = rootM(), N = W.n, p = W.st === 1 ? { s: W.rs, f: effRf() + N } : W.st === 3 ? posTwo(W.rs, effRf(), N) : posBox(W.rs, effRf(), N), m = pit(p.s, p.f);
    if (kind === 'root') A.playMidi(r); else if (kind === 'seq') A.seqNow([r, m]); else A.strumNow([r, m]);
  }
  function chordMidis(sel) {
    const r = chordOf(sel), t = r.t, rf = effRf();
    return [...sel].sort((a, b) => a - b).map(N => { const p = N ? posBox(W.rs, rf, N) : { s: W.rs, f: rf }; return pit(p.s, p.f) + (t && t.nine && t.nine.includes(N % 12) ? 12 : 0); });
  }
  // ---------- Quiz ----------
  const rnd = n => Math.floor(Math.random() * n);
  function kp() { const P = A.PR(); P.kurs = P.kurs || {}; return P.kurs; }
  function newTask() {
    const q = W.q; q.ans = null; q.show = null; q.fb = '';
    W.rs = rnd(2); W.rf = rnd(10) + 1;
    if (q.kind === 'find') q.N = 1 + rnd(12);
    else if (q.kind === 'name') { q.N = 1 + rnd(12); q.p = posBox(W.rs, W.rf, q.N); const c = new Set([q.N]); while (c.size < 4) c.add(1 + rnd(12)); q.ch = [...c].sort(() => Math.random() - 0.5); }
    else { const pool = q.i < 5 ? [0, 7, 12] : [0, 3, 4, 5, 7, 12]; q.N = pool[rnd(pool.length)]; q.ch = pool; setTimeout(hearNow, 150); }
  }
  function hearNow() { const q = W.q; if (!q) return; const r = pit(W.rs, W.rf), p = q.N ? posBox(W.rs, W.rf, q.N) : { s: W.rs, f: W.rf }; A.seqNow([r, pit(p.s, p.f)]); }
  function startQuiz(kind) { W.q = { kind, i: 0, hits: 0 }; newTask(); paint(); }
  function answer(ok, fb, show) {
    const q = W.q; if (q.ans != null) return; q.ans = ok; q.fb = (ok ? '✓ Richtig! ' : '✗ ') + fb; q.show = show; if (ok) q.hits++;
    if (q.i === 9) { const st = kp(), k = 'w-' + q.kind, o = st[k] || {}; st[k] = { last: q.hits, best: Math.max(o.best || 0, q.hits), n: 10 }; A.saveProg(); q.end = true; }
    paint();
  }
  function onTap(s, f) {
    if (W.st !== 6) { if (W.multi || W.st !== 6) { W.rs = s; W.rf = f; } paint(); return; }
    const q = W.q; if (!q || q.kind !== 'find' || q.ans != null) return;
    const rm = pit(W.rs, W.rf), d = pit(s, f) - rm, rn = rootName(rm), ok = md(d) === md(q.N) && (q.N !== 12 || d !== 0), tn = spell(rn, md(d)), cp = posBox(W.rs, W.rf, q.N);
    if (ok) answer(true, SN[s] + '-Saite, ' + f + '. Bund = ' + spell(rn, q.N), { s, f });
    else answer(false, 'Das ist ' + tn + (d === 0 ? ' (der Grundton)' : ' (' + longN(md(d)) + ')') + '. ' + art(q.N, true) + ' ' + longN(q.N) + ' liegt ' + q.N + ' Halbtöne über ' + rn + ', z. B. ' + SN[cp.s] + '-Saite, ' + cp.f + '. Bund = ' + spell(rn, q.N) + '.', cp);
  }
  function paintQuiz() {
    const q = W.q, box = $q('.pc-wqbody'), st = kp(), best = k => (st['w-' + k] ? L('Bestes Ergebnis') + ': ' + st['w-' + k].best + ' / 10' : '');
    el.querySelectorAll('[data-w=quiz]').forEach(b => { b.classList.toggle('active', !!q && q.kind === b.dataset.v); const c = b.querySelector('small'); if (c) c.textContent = best(b.dataset.v); });
    if (!q) { box.innerHTML = '<p class="caption" translate="no">Wähle eine Übung: „Finde die …“ (Bund tippen), „Wie heißt das?“ (Namen wählen) oder „Hör-Quiz“ (erst 1, 5, 8, dann mehr).</p>'; return; }
    const rn = rootName(pit(W.rs, W.rf)), where = rn + ' (' + SN[W.rs] + '-Saite, ' + W.rf + '. Bund)';
    let h = '<p class="pc-wqp" translate="no">' + (q.kind === 'find' ? 'Grundton ' + where + '. Tippe den Bund, auf dem ' + art(q.N) + ' <b>' + longN(q.N) + ' (' + IV[q.N][1] + ')</b> liegt.' :
      q.kind === 'name' ? 'Grundton ' + where + '. Wie heißt das Intervall am Punkt „?“' : 'Grundton ' + where + '. Hör hin: Grundton, dann der zweite Ton. Welches Intervall?') + '</p>';
    if (q.kind !== 'find') h += '<div class="pc-row pc-wqa">' + q.ch.map(N => '<button class="toggle-btn" data-w="qa" data-n="' + N + '"' + (q.ans != null ? ' disabled' : '') + '>' + IV[N][1] + ' · ' + L(IV[N][2]) + '</button>').join('') + (q.kind === 'hear' ? '<button class="toggle-btn" data-w="again">' + L('▶ Nochmal hören') + '</button>' : '') + '</div>';
    if (q.fb) h += '<p class="pc-wfb ' + (q.ans ? 'ok' : 'no') + '" translate="no">' + q.fb + '</p>';
    h += '<div class="pc-row"><b class="pc-wcnt">' + L('Aufgabe') + ' ' + (q.i + 1) + ' ' + L('von') + ' 10 · ' + L('Treffer') + ': ' + q.hits + '</b>' + (q.ans != null ? '<button class="toggle-btn active" data-w="next">' + (q.end ? L('Neue Runde') : L('Weiter ▶')) + '</button>' : '') + '</div>';
    if (q.end) h += '<p class="pc-wfb ok" translate="no">Ergebnis: ' + q.hits + ' von 10 – gespeichert.</p>';
    box.innerHTML = h;
  }
  function onClick(e) {
    const b = e.target.closest('[data-w]'); if (b) e.stopPropagation(); if (!b) { const c = e.target.closest('.pc-cell'); if (c) onTap(+c.dataset.s, +c.dataset.f); return; }
    const w = b.dataset.w, n = +b.dataset.n;
    if (w === 'st') { W.st = +b.dataset.v; if (W.st === 6) { W.multi = false; if (!W.q) { /* Übungsauswahl */ } } paint(); return; }
    if (w === 'iv') { if (W.multi) { if (W.sel.has(n)) W.sel.delete(n); else W.sel.add(n); } else W.n = n; paint(); if (!W.multi) play('seq'); return; }
    if (w === 'lab') { W.lab = b.dataset.v; paint(); return; }
    if (w === 'multi') { W.multi = !W.multi; if (W.st === 6) W.st = 5; paint(); return; }
    if (w === 'play') { play(b.dataset.v); return; }
    if (w === 'step') { W.n = Math.max(0, Math.min(12, W.n + (+b.dataset.v))); paint(); play('seq'); return; }
    if (w === 'chord') { A.strumNow(chordMidis(W.sel)); return; }
    if (w === 'live') { if (W.live) { W.live.scrollIntoView({ behavior: 'smooth', block: 'center' }); PcLive.start(W.live); } return; }
    if (w === 'quiz') { startQuiz(b.dataset.v); return; }
    if (w === 'again') { hearNow(); return; }
    if (w === 'qa') { const q = W.q, rn = rootName(pit(W.rs, W.rf)), ok = n === q.N;
      answer(ok, rn + ' → ' + spell(rn, q.N) + ': ' + q.N + ' Halbtöne = ' + longN(q.N) + ' (' + IV[q.N][1] + ')' + (ok ? '' : ', nicht ' + longN(n) + '.'), q.kind === 'name' ? q.p : (q.N ? posBox(W.rs, W.rf, q.N) : null)); return; }
    if (w === 'next') { const q = W.q; if (q.end) { startQuiz(q.kind); return; } q.i++; newTask(); paint(); }
  }
  function build(host, api, chapter) {
    A = api; C = chapter; el = host;
    const ivb = cls => IV.map(([N, num, nm]) => '<button class="toggle-btn pc-wiv ' + fam(N) + '" data-w="iv" data-n="' + N + '" aria-pressed="false"><b>' + num + '</b><span> ' + L(nm) + '</span></button>').join('');
    host.innerHTML = '<div class="pc-w"><h3 class="pc-wt" translate="no">3 · Intervalle – Werkstatt</h3><p class="caption" translate="no">Immer nur ein Intervall auf einmal. Tippe einen Bund, um den Grundton zu ändern.</p>' +
      '<div class="pc-wsteps">' + STEPS.map(([v, t]) => { const m = /^(\S+) (.*)$/.exec(L0(t)); return (v > 1 ? '<i class="pc-wsl"></i>' : '') + '<button class="pc-wstep" data-w="st" data-v="' + v + '"><span class="pc-wsn"><i>' + (v === 6 ? PcSkin.icon('pencil') : m[1]) + '</i>' + PcSkin.icon('check') + '</span><span class="pc-wsx"> ' + m[2] + '</span></button>'; }).join('') + '</div>' +
      '<div class="pc-wivs"><div class="pc-row pc-wivrow">' + ivb() + '</div><div class="pc-row"><button class="toggle-btn" data-w="multi" aria-pressed="false">' + '<span class="pc-wbox">' + PcSkin.icon('box') + PcSkin.icon('boxon') + '</span>' + L0('☐ Mehrere wählen').replace(/^☐ /, '') + '</button><span class="caption">' + L('Akkord-Baukasten: Intervalle ankreuzen, der Akkord erscheint.') + '</span></div></div>' +
      '<div class="pc-wgrid"><div class="card pc-wleft"><div class="pc-row pc-wlabh"><span class="caption">' + L('Beschriftung') + '</span><div class="seg pc-seg">' +
      [['num', 'Zahl'], ['name', 'Name'], ['ton', 'Ton'], ['all', 'Alles']].map(([v, t]) => '<button class="toggle-btn" data-w="lab" data-v="' + v + '">' + L(t) + '</button>').join('') + '</div></div>' +
      '<p class="caption pc-wcap" translate="no"></p><div class="pc-wbw"></div><div class="pc-winfo" translate="no"></div>' +
      '<div class="pc-row pc-wsingle"><button class="toggle-btn" data-w="play" data-v="root">' + L('▶ Grundton') + '</button><button class="toggle-btn" data-w="play" data-v="seq">' + L('▶ Nacheinander') + '</button><button class="toggle-btn" data-w="play" data-v="both">' + L('▶ Zusammen') + '</button><button class="toggle-btn" data-w="step" data-v="-1">' + L('◀ kleiner') + '</button><button class="toggle-btn" data-w="step" data-v="1">' + L('größer ▶') + '</button></div>' +
      '<div class="pc-row pc-wmulti" hidden><button class="toggle-btn active" data-w="chord">' + L('▶ Akkord anhören') + '</button><button class="toggle-btn" data-w="live">' + L('Was spiele ich?') + '</button></div>' +
      '<div class="pc-wq" hidden><div class="pc-row">' + [['find', 'Finde die …'], ['name', 'Wie heißt das?'], ['hear', 'Hör-Quiz']].map(([v, t]) => '<button class="toggle-btn pc-wqb" data-w="quiz" data-v="' + v + '"><span>' + L(t) + '</span><small></small></button>').join('') + '</div><div class="pc-wqbody"></div></div>' +
      '<div class="pc-row pc-wleg">' + [['f1', 'Prime / Oktave'], ['f5', 'Quinte'], ['f3', 'Terzen'], ['f4', 'Quarte'], ['fx', 'Sekunden · Sexten · Septimen · Tritonus']].map(([c, t]) => '<span class="pc-wlg ' + c + '">' + L(t) + '</span>').join('') + '</div></div>' +
      '<div class="pc-wright"><div class="card pc-wlive"></div><div class="card"><h4>' + L('Merkkarten des Lehrers') + '</h4><div class="pc-wcards" translate="no">' + CARDS.map(([c, t]) => '<div class="pc-wcard ' + c + '">' + t + '<small>Merkkarte · Lehrer, Kapitel 3</small></div>').join('') + '</div></div>' +
      '<div class="card pc-wkex"><h4>' + L('Übungen aus dem Kurs') + '</h4>' + C.s.map(S => '<section class="pc-ksub" id="pcK_' + S.id + '"><h5 translate="no">' + S.t + '</h5><div class="pc-kbody" translate="no"></div><div class="pc-kex">' +
        S.ex.map((x, xi) => '<label class="check pc-kchk"><input type="checkbox" data-kx="' + S.id + '-' + xi + '"> <span translate="no">' + (x.slice(0, 2) === 'E:' ? '<i>(ergänzt)</i> ' : '') + x.slice(2) + '</span></label>').join('') + '</div></section>').join('') + '</div></div></div>' +
      '<div class="card pc-wstrip"><b translate="no">Vorschau Schritt 1 · Eine Saite: jeder Bund = 1 Halbton weiter</b><div class="pc-wtiles"></div></div></div>';
    host.addEventListener('click', onClick);
    if (window.PcLive) W.live = PcLive.mount($q('.pc-wlive'));                                   // v128: „Was spiele ich?“
    paint();
  }
  window.PcWerk = { build, chordOf, spell, posBox, posTwo, TY, IV, formula, cname, rootName, state: () => ({ st: W.st, rs: W.rs, rf: W.rf, n: W.n, lab: W.lab, multi: W.multi, sel: [...W.sel], q: W.q && { kind: W.q.kind, i: W.q.i, hits: W.q.hits, N: W.q.N, ans: W.q.ans } }),
    set: o => { Object.assign(W, o); if (o.sel) W.sel = new Set(o.sel); if (el) paint(); } };
})();
