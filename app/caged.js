// ---- CAGED: die fünf Akkordformen über das ganze Griffbrett, Arpeggios, Dreiklänge, Tonleiter um die Form ----
// Folgt auf Wunsch dem Loop (bzw. Backing Track / Song): zeigt je Akkord die Form in deiner Lage, die Dreiklänge je
// Saitengruppe und die Töne, die beim Wechsel zum nächsten Akkord liegen bleiben können.
(function () {
  const $ = id => document.getElementById(id);
  const panel = $('panel-caged');
  if (!panel) return;
  const md = x => ((x % 12) + 12) % 12;
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const OPEN = [40, 45, 50, 55, 59, 64];                 // E2 A2 D3 G3 B3 E4 (tief → hoch)
  const SNAME = ['E', 'A', 'D', 'G', 'B', 'e'];
  const FR = 15;
  const IV = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11] };
  const TNAME = { '': 'Dur', m: 'Moll', '7': 'Dominant 7', m7: 'Moll 7', maj7: 'Major 7' };
  const IVN = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  // Formen: Saite des Grundtons (0 = tiefe E) und Bünde je Saite relativ zum Grundton-Bund (null = nicht spielen)
  const SHAPES = {
    C: { rs: 1, t: { '': [null, 0, -1, -3, -2, -3], m: [null, 0, -2, -3, -2, null], '7': [null, 0, -1, 0, -2, -3], m7: [null, 0, -2, 0, -2, null], maj7: [null, 0, -1, -3, -3, -3] } },
    A: { rs: 1, t: { '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0], maj7: [null, 0, 2, 1, 2, 0] } },
    G: { rs: 0, t: { '': [0, -1, -3, -3, -3, 0], m: [0, -2, -3, -3, 0, 0], '7': [0, -1, -3, -3, -3, -2], m7: [0, -2, -3, -3, 0, -2], maj7: [0, -1, -3, -3, -3, -1] } },
    E: { rs: 0, t: { '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], maj7: [0, null, 1, 1, 0, null] } },
    D: { rs: 2, t: { '': [null, null, 0, 2, 3, 2], m: [null, null, 0, 2, 3, 1], '7': [null, null, 0, 2, 1, 2], m7: [null, null, 0, 2, 1, 1], maj7: [null, null, 0, 2, 2, 2] } }
  };
  const ORDER = ['C', 'A', 'G', 'E', 'D'];
  const INV = ['Grundstellung', '1. Umkehrung', '2. Umkehrung'];

  // ---- Einstellungen ----
  const DEF = { root: 0, type: '', shape: 'all', view: 'grip', set: 2, scale: 'penta', pos: -1, label: 'note', follow: true };
  let S = Object.assign({}, DEF);
  try { Object.assign(S, JSON.parse(localStorage.getItem('3nps-caged') || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem('3nps-caged', JSON.stringify(S)); } catch (e) {} };
  let triSel = -1, flats = false, forceInst = null;

  // ---- Theorie ----
  function shapeAt(sh, c) {
    // alle Lagen dieser Form auf dem Griffbrett (0 … FR)
    const d = SHAPES[sh], off = d.t[c.t] || d.t[c.t.startsWith('m') ? 'm' : ''], out = [];
    const f0 = md(c.r - md(OPEN[d.rs]));
    for (const r of [f0 - 12, f0, f0 + 12, f0 + 24]) {
      const fr = off.map(o => o == null ? null : o + r), used = fr.filter(x => x != null);
      if (Math.min(...used) < 0 || Math.max(...used) > FR) continue;
      let lo = Math.min(...used), hi = Math.max(...used);
      if (hi - lo < 3) hi = Math.min(FR, lo + 3);
      out.push({ sh, frets: fr, lo, hi, r });
    }
    return out;
  }
  function allShapes(c) { return ORDER.flatMap(sh => shapeAt(sh, c)).sort((a, b) => a.lo - b.lo || a.hi - b.hi); }
  const chordPcs = c => IV[c.t].map(x => md(c.r + x));
  function triads(c, set) {
    const want = [0, 1, 2].map(i => md(c.r + IV[c.t][i])), out = [];
    for (let a = 0; a <= FR; a++) for (let b = 0; b <= FR; b++) for (let d = 0; d <= FR; d++) {
      const fr = [a, b, d], p = fr.map((f, i) => md(OPEN[set + i] + f));
      if (new Set(p).size !== 3 || !want.every(w => p.includes(w))) continue;
      const nz = fr.filter(f => f > 0); if (nz.length && Math.max(...nz) - Math.min(...nz) > 3) continue;
      if (fr.includes(0) && nz.length && Math.max(...nz) > 4) continue;
      out.push({ set, frets: fr, inv: want.indexOf(p[0]), lo: Math.min(...fr), hi: Math.max(...fr) });
    }
    return out.sort((x, y) => (x.lo + x.hi) - (y.lo + y.hi));
  }
  function scalePcs(c) {
    const minor = c.t === 'm' || c.t === 'm7';
    const iv = S.scale === 'penta' ? (minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]) : (minor ? [0, 2, 3, 5, 7, 8, 10] : c.t === '7' ? [0, 2, 4, 5, 7, 9, 10] : [0, 2, 4, 5, 7, 9, 11]);
    return iv.map(x => md(c.r + x));
  }
  const nn = pc => cur.key && window.spellPc ? spellPc(pc, cur.key) : (flats ? FLAT : SHARP)[md(pc)];
  const cname = c => nn(c.r) + c.t;
  function role(c, pc) {
    const i = md(pc - c.r);
    if (i === 0) return 'r';
    if (i === 3 || i === 4) return 't';
    if (i === 7 || i === 6) return 'f';
    if (i === 10 || i === 11) return 's';
    return 'o';
  }
  // Akkordname aus Looper/Jam/Song → {r, t} in den fünf Arten hier
  function parse(name) {
    const m = /^([A-G]#?)(.*)$/.exec(name || ''); if (!m || PC[m[1]] == null) return null;
    const s = m[2];
    const t = /^maj/.test(s) ? 'maj7' : /^m7|^m9|^m11|^m7b5/.test(s) ? 'm7' : /^m(?!aj)|^dim/.test(s) ? 'm' : /^(7|9|11|13)/.test(s) ? '7' : '';
    return { r: PC[m[1]], t };
  }

  // ---- Quelle: Loop / Backing Track / Song ----
  function info() {
    const L = typeof Looper !== 'undefined' && Looper.chordInfo ? Looper.chordInfo(null) : null;
    if (window.Jam && Jam.active && Jam.active() && !(L && L.playing)) { const j = Jam.chordInfo(); if (j) return j; }
    if (window.Lied && Lied.active && Lied.active() && !(L && L.playing)) { const j = Lied.chordInfo(); if (j) return j; }
    return L && L.segs ? L : null;
  }
  function seqOf(ci) {
    const out = [];
    (ci.segs || []).forEach((s, i) => {
      const c = parse(s.name); if (!c) return;
      const last = out[out.length - 1];
      if (last && last.c.r === c.r && last.c.t === c.t && Math.abs(last.e - s.a) < 2) { last.e = s.e; return; }
      out.push({ i, c, a: s.a, e: s.e, name: s.name });
    });
    return out;
  }

  // ---- Aktueller Zustand ----
  let cur = { c: { r: S.root, t: S.type }, next: null, src: 'manual', seq: [], on: -1 };
  function lageRange() { return S.pos >= 0 ? [S.pos, S.pos + 3] : null; }
  function pickInstance(c) {
    if (forceInst) return forceInst;
    const all = allShapes(c), lr = lageRange();
    if (lr) {
      let best = null, bs = -1;
      all.forEach(x => { const ov = Math.min(x.hi, lr[1]) - Math.max(x.lo, lr[0]); const sc = ov * 10 - Math.abs(x.lo - lr[0]); if (sc > bs) { bs = sc; best = x; } });
      return best;
    }
    if (S.shape === 'all') return null;
    const list = shapeAt(S.shape, c);
    return list[0] || null;
  }
  function region(inst) {
    const lr = lageRange();
    if (lr) return [Math.max(0, lr[0] - (lr[0] ? 1 : 0)), Math.min(FR, lr[1] + 1)];
    if (inst) return [inst.lo, inst.hi];
    return [0, FR];
  }

  // ---- Zeichnen ----
  const W = 780, H = 214, x0 = 44, fw = (W - x0 - 10) / FR, y0 = 20, sh = 27;
  const fx = f => f === 0 ? x0 - 18 : x0 + (f - 0.5) * fw;
  const sy = s => y0 + (5 - s) * sh;
  function frame() {
    let h = '<rect x="' + x0 + '" y="' + (y0 - 8) + '" width="' + (W - x0 - 10) + '" height="' + (sh * 5 + 16) + '" class="nk-board" rx="3"/>';
    for (let f = 0; f <= FR; f++) h += '<line x1="' + (x0 + f * fw) + '" x2="' + (x0 + f * fw) + '" y1="' + (y0 - 8) + '" y2="' + (y0 + sh * 5 + 8) + '" class="' + (f === 0 ? 'nk-nut' : 'nk-fret') + '"/>';
    [3, 5, 7, 9, 15].forEach(f => h += '<circle cx="' + fx(f) + '" cy="' + (y0 + sh * 2.5) + '" r="5" class="nk-dot"/>');
    h += '<circle cx="' + fx(12) + '" cy="' + (y0 + sh * 1.5) + '" r="5" class="nk-dot"/><circle cx="' + fx(12) + '" cy="' + (y0 + sh * 3.5) + '" r="5" class="nk-dot"/>';
    for (let s = 0; s < 6; s++) h += '<line x1="' + (x0 - 2) + '" x2="' + (W - 10) + '" y1="' + sy(s) + '" y2="' + sy(s) + '" class="nk-str" style="stroke-width:' + (0.8 + (5 - s) * 0.35) + '"/>';
    for (let s = 0; s < 6; s++) h += '<text x="8" y="' + (sy(s) + 0.5) + '" class="cg-sn">' + SNAME[s] + '</text>';
    for (let f = 1; f <= FR; f++) h += '<text x="' + fx(f) + '" y="' + (y0 + sh * 5 + 24) + '" class="nk-num cg-fn">' + f + '</text>';
    return h;
  }
  function zone(lo, hi, label, cls) {
    const a = lo === 0 ? x0 - 30 : x0 + (lo - 1) * fw + 2, b = x0 + hi * fw - 2;
    return '<rect x="' + a + '" y="' + (y0 - 12) + '" width="' + (b - a) + '" height="' + (sh * 5 + 24) + '" class="cg-zone ' + (cls || '') + '" rx="7"/>' + (label ? '<text x="' + ((a + b) / 2) + '" y="' + (H - 12) + '" class="cg-zl">' + label + '</text>' : '');
  }
  function dot(c, s, f, extra, common) {
    const m = OPEN[s] + f, pc = md(m), rl = role(c, pc);
    const txt = S.label === 'iv' ? IVN[md(pc - c.r)] : nn(pc);
    return '<g class="cg-n ' + rl + (f === 0 ? ' open' : '') + (extra ? ' ' + extra : '') + (common ? ' common' : '') + '" data-m="' + m + '"><circle cx="' + fx(f) + '" cy="' + sy(s) + '" r="11"/><text x="' + fx(f) + '" y="' + (sy(s) + 0.5) + '">' + txt + '</text></g>';
  }
  let lastNotes = [];          // was „Anspielen“ spielt (MIDI, tief → hoch)
  function render() {
    const c = cur.c, nx = cur.next, nxP = nx ? chordPcs(nx) : [];
    const kk = cur.key; flats = kk ? [5, 10, 3, 8, 1].includes(kk.major ? kk.pc : md(kk.pc + 3)) : [5, 10, 3, 8, 1].includes(c.t.startsWith('m') ? md(c.r + 3) : c.r);
    const isCommon = pc => nx && nxP.includes(pc) && chordPcs(c).includes(pc);
    const inst = pickInstance(c), [ra, rb] = region(inst), lr = lageRange();
    let h = frame(), notes = [];
    const cp = chordPcs(c);
    // Formen-Zonen
    if (!inst && S.shape === 'all') {
      allShapes(c).forEach((x, i) => { h += zone(x.lo, x.hi, x.sh + '-Form', 'z' + (i % 2)); });
    } else if (inst) h += zone(inst.lo, inst.hi, inst.sh + '-Form', 'z0');
    if (lr) h += zone(lr[0], lr[1], '', 'lage');
    const inR = f => f >= ra && f <= rb;
    let explain = '';
    if (S.view === 'grip') {
      const list = inst ? [inst] : allShapes(c);
      const seen = new Set();
      list.forEach(x => x.frets.forEach((f, s) => {
        if (f == null) { if (inst) h += '<text x="' + (x0 - 18) + '" y="' + (sy(s) + 0.5) + '" class="nk-x">×</text>'; return; }
        const k = s + ':' + f; if (seen.has(k)) return; seen.add(k);
        h += dot(c, s, f, '', isCommon(md(OPEN[s] + f)));
      }));
      if (inst) notes = inst.frets.map((f, s) => f == null ? null : OPEN[s] + f).filter(x => x != null);
      explain = inst ? cname(c) + ' in der ' + inst.sh + '-Form ab Bund ' + inst.lo + '. Der Grundton (rot) liegt auf der ' + SNAME[SHAPES[inst.sh].rs] + '-Saite.' + (inst.sh === 'C' || inst.sh === 'G' ? ' Als Barré schwer zu greifen – nimm daraus die Dreiklänge oder das Arpeggio.' : '')
        : 'Alle fünf Formen von ' + cname(c) + ' greifen ineinander: ' + allShapes(c).filter(x => x.lo <= 12).map(x => x.sh).join(' → ') + '. Jede Form teilt sich Töne mit der nächsten – so ist das ganze Griffbrett ein einziger Akkord.';
    } else if (S.view === 'arp' || S.view === 'scale') {
      const pcs = S.view === 'arp' ? cp : scalePcs(c);
      for (let s = 0; s < 6; s++) for (let f = 0; f <= FR; f++) {
        if (!inR(f)) continue;
        const pc = md(OPEN[s] + f); if (!pcs.includes(pc)) continue;
        h += dot(c, s, f, cp.includes(pc) ? '' : 'sc', isCommon(pc));
        notes.push(OPEN[s] + f);
      }
      notes.sort((a, b) => a - b);
      explain = S.view === 'arp' ? 'Arpeggio: die Akkordtöne ' + cp.map(nn).join(' – ') + ' einzeln, von tief nach hoch und zurück. Zieltöne für Soli: auf Grundton oder Terz landen klingt immer „richtig“.'
        : (S.scale === 'penta' ? 'Pentatonik' : 'Tonleiter') + ' rund um die Form – die Akkordtöne sind farbig. Spiel die Tonleiter, aber setze die Betonungen auf die farbigen Töne.';
    } else {
      const all = triads(c, S.set), list = all.filter(t => S.shape === 'all' && !lr ? true : t.lo >= ra - 0 && t.hi <= rb + (lr ? 0 : 1));
      if (triSel >= list.length) triSel = -1;
      list.forEach((t, i) => t.frets.forEach((f, k) => { h += dot(c, t.set + k, f, 'tri' + (i === triSel ? ' sel' : triSel >= 0 ? ' dim' : ''), isCommon(md(OPEN[t.set + k] + f))); }));
      const shown = triSel >= 0 ? list[triSel] : list[0];
      notes = shown ? shown.frets.map((f, k) => OPEN[shown.set + k] + f) : [];
      $('cgTris').innerHTML = list.length ? list.map((t, i) => '<button class="toggle-btn' + (i === triSel ? ' active' : '') + '" data-tri="' + i + '"><small>' + INV[t.inv] + '</small><b>' + t.frets.join('-') + '</b></button>').join('') : '<span class="cg-hint">In diesem Bereich liegt kein Dreiklang auf diesen Saiten – andere Lage oder Saiten wählen.</span>';
      cur.triList = list;
      explain = 'Dreiklänge: nur Grundton, Terz und Quinte auf drei Saiten. Grundstellung = Grundton unten, 1. Umkehrung = Terz unten, 2. Umkehrung = Quinte unten. Klein, schnell, klingt in der Band klarer als volle Griffe.';
    }
    $('cgTris').hidden = S.view !== 'tri';
    $('cgSetBox').hidden = S.view !== 'tri';
    $('cgScaleBox').hidden = S.view !== 'scale';
    if (nx) {
      const com = cp.filter(p => nxP.includes(p));
      explain += ' Nächster Akkord: ' + cname(nx) + (com.length ? ' – gemeinsame Töne ' + com.map(nn).join(', ') + ' (Ring) können liegen bleiben.' : ' – keine gemeinsamen Töne, nächstliegenden Ton suchen.');
    }
    $('cgNeck').innerHTML = h;
    $('cgExplain').textContent = explain;
    lastNotes = notes;
    // Kopf
    $('cgChord').textContent = cname(c);
    $('cgSub').textContent = TNAME[c.t] + ' · ' + cp.map((p, i) => nn(p) + ' (' + IVN[IV[c.t][i]] + ')').join(' ');
    $('cgShapes').querySelectorAll('button').forEach(b => b.classList.toggle('active', inst ? b.dataset.s === inst.sh : b.dataset.s === 'all'));
    $('cgViews').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === S.view));
  }

  // ---- Loop-Leiste und Tabelle ----
  let seqSig = '';
  function renderSeq() {
    const seq = cur.seq, box = $('cgSeq'), card = $('cgLoopCard');
    const show = cur.src !== 'manual' && seq.length;
    box.hidden = !show; card.hidden = !show;
    if (!show) { seqSig = ''; return; }
    const sig = seq.map(x => x.name).join(',') + '|' + S.pos + '|' + cur.inst0 + '|' + flats;
    if (sig !== seqSig) {
      seqSig = sig;
      box.innerHTML = '<span class="lbl">Loop</span>' + seq.map((x, k) => '<button class="cg-sq" data-k="' + k + '">' + cname(x.c) + '</button>').join('');
      // Tabelle: je Akkord (einmal) Form in der Lage und Dreiklänge je Saitengruppe
      const lage = S.pos >= 0 ? S.pos : (cur.inst0 != null ? cur.inst0 : 5), lr = [lage, lage + 3];
      const uniq = []; seq.forEach(x => { if (!uniq.some(u => u.r === x.c.r && u.t === x.c.t)) uniq.push(x.c); });
      let t = '<tr><th>Akkord</th><th>Form (Bund ' + lr[0] + '–' + lr[1] + ')</th>' + [0, 1, 2, 3].map(s => '<th>' + SNAME[s] + '-' + SNAME[s + 1] + '-' + SNAME[s + 2] + '</th>').join('') + '</tr>';
      uniq.forEach(c => {
        let best = null, bs = -1e9;
        allShapes(c).forEach(x => { const sc = (Math.min(x.hi, lr[1]) - Math.max(x.lo, lr[0])) * 10 - Math.abs(x.lo - lr[0]); if (sc > bs) { bs = sc; best = x; } });
        t += '<tr><td><b>' + cname(c) + '</b></td><td>' + (best ? best.sh + '-Form <small>' + best.frets.map(f => f == null ? 'x' : f).join(' ') + '</small>' : '–') + '</td>';
        [0, 1, 2, 3].forEach(s => {
          const tr = triads(c, s).filter(q => q.lo >= lr[0] - 1 && q.hi <= lr[1] + 1).sort((a, b) => Math.abs(a.lo - lr[0]) - Math.abs(b.lo - lr[0]))[0];
          t += '<td>' + (tr ? tr.frets.join('-') + ' <small>' + ['G', '1.', '2.'][tr.inv] + '</small>' : '–') + '</td>';
        });
        t += '</tr>';
      });
      $('cgTable').innerHTML = t;
      $('cgLoopInfo').textContent = 'Lage Bund ' + lr[0] + '–' + lr[1] + (S.pos < 0 ? ' (aus der gewählten Form)' : '') + ' · G = Grundstellung, 1./2. = Umkehrung';
    }
    box.querySelectorAll('.cg-sq').forEach(b => b.classList.toggle('on', +b.dataset.k === cur.on));
  }

  // ---- Aktualisieren (alle 120 ms, solange der Reiter offen ist) ----
  let sig = '';
  function update(force) {
    if (panel.hidden && !force) return;
    let ci = null;
    if (S.follow) ci = info();
    if (ci && ci.segs) {
      const seq = seqOf(ci);
      if (seq.length) {
        let k = -1;
        if (ci.pos != null) k = seq.findIndex(x => ci.pos >= x.a && ci.pos < x.e);
        if (k < 0) k = cur.src === 'loop' && cur.on >= 0 && cur.on < seq.length && cur.seq.length === seq.length ? cur.on : 0;
        let n = -1; for (let j = 1; j <= seq.length; j++) { const q = seq[(k + j) % seq.length]; if (q.c.r !== seq[k].c.r || q.c.t !== seq[k].c.t) { n = (k + j) % seq.length; break; } }
        cur = { c: seq[k].c, next: n >= 0 ? seq[n].c : null, src: 'loop', seq, on: k, inst0: cur.inst0, playing: ci.pos != null, key: ci.key || null };
        $('cgFollowInfo').textContent = ci.pos != null ? (ci.jam ? 'Backing Track läuft' : ci.lied ? 'Song läuft' : 'Loop läuft') : 'Loop steht – Akkord antippen';
      }
    } else {
      cur = { c: { r: S.root, t: S.type }, next: null, src: 'manual', seq: [], on: -1, inst0: cur.inst0 };
      $('cgFollowInfo').textContent = S.follow ? 'kein Loop mit Akkorden' : '';
    }
    $('cgSrcLbl').textContent = cur.src === 'loop' ? (cur.playing ? 'Klingt jetzt' : 'Akkord im Loop') : 'Akkord';
    $('cgRoot').disabled = $('cgType').disabled = cur.src === 'loop';
    const ns = (cur.key ? cur.key.pc + '' + cur.key.major : '') + cur.c.r + cur.c.t + '|' + (cur.next ? cur.next.r + cur.next.t : '') + '|' + JSON.stringify(S) + '|' + triSel;
    if (force || ns !== sig) {
      sig = ns;
      const inst = pickInstance(cur.c); if (inst) cur.inst0 = inst.lo;
      render();
    }
    renderSeq();
  }

  // ---- Klang ----
  function play(list, step) {
    if (!window.Quinten || !list.length) return;
    list.forEach((m, i) => setTimeout(() => Quinten.playNote(m), i * (step || 28)));
  }
  const bpm = () => { const v = parseFloat(($('bpm') || {}).value); return v > 0 ? v : 80; };

  // ---- Üben ----
  let trainT = null, trainKind = '';
  function stopTrain() {
    clearTimeout(trainT); trainT = null; trainKind = ''; forceInst = null;
    $('cgWalk').textContent = '▶ Formen-Wanderung'; $('cgLadder').textContent = '▶ Dreiklang-Leiter';
    $('cgWalk').classList.remove('active'); $('cgLadder').classList.remove('active');
  }
  function walk() {
    if (trainKind === 'walk') { stopTrain(); return; }
    stopTrain(); trainKind = 'walk'; $('cgWalk').textContent = '■ Stopp'; $('cgWalk').classList.add('active');
    S.pos = -1; S.view = 'grip'; syncUi();
    let i = 0;
    const stepFn = () => {
      const list = allShapes(cur.c); if (!list.length) return stopTrain();
      const x = list[i % list.length]; i++;
      S.shape = x.sh; forceInst = x; render(); sig = '';
      // genau diese Lage zeigen (auch die zweite, eine Oktave höher)
      const inst = x; play(inst.frets.map((f, s) => f == null ? null : OPEN[s] + f).filter(m => m != null));
      $('cgTrainInfo').textContent = cname(cur.c) + ': ' + x.sh + '-Form ab Bund ' + x.lo + ' – nächste in einem Takt';
      trainT = setTimeout(stepFn, 4 * 60000 / bpm());
    };
    stepFn();
  }
  function ladder() {
    if (trainKind === 'ladder') { stopTrain(); return; }
    stopTrain(); trainKind = 'ladder'; $('cgLadder').textContent = '■ Stopp'; $('cgLadder').classList.add('active');
    S.view = 'tri'; S.shape = 'all'; S.pos = -1; syncUi(); triSel = 0; update(true);
    let first = true;
    const stepFn = () => {
      const list = cur.triList || []; if (!list.length) return stopTrain();
      if (!first) triSel++; first = false;
      if (triSel < 0 || triSel >= list.length) triSel = 0;
      render();
      const t = list[triSel]; play(t.frets.map((f, k) => OPEN[t.set + k] + f), 18);
      $('cgTrainInfo').textContent = INV[t.inv] + ' · Bünde ' + t.frets.join('-');
      trainT = setTimeout(stepFn, 60000 / bpm());
    };
    stepFn();
  }

  // ---- Bedienung ----
  const rootSel = $('cgRoot');
  SHARP.forEach((n, i) => rootSel.add(new Option(n + (FLAT[i] !== n ? ' / ' + FLAT[i] : ''), i)));
  const posSel = $('cgPos');
  for (let p = 0; p <= 12; p++) posSel.add(new Option('Bund ' + p + '–' + (p + 3) + (p === 0 ? ' (offen)' : ''), p));
  function syncUi() {
    rootSel.value = S.root; $('cgType').value = S.type; $('cgSet').value = S.set; $('cgScale').value = S.scale;
    posSel.value = S.pos; $('cgLabel').value = S.label; $('cgFollow').checked = !!S.follow; save();
  }
  syncUi();
  const ch = () => { save(); update(true); };
  rootSel.addEventListener('change', () => { S.root = +rootSel.value; triSel = -1; ch(); });
  $('cgType').addEventListener('change', e => { S.type = e.target.value; triSel = -1; ch(); });
  $('cgSet').addEventListener('change', e => { S.set = +e.target.value; triSel = -1; ch(); });
  $('cgScale').addEventListener('change', e => { S.scale = e.target.value; ch(); });
  posSel.addEventListener('change', () => { S.pos = +posSel.value; triSel = -1; ch(); });
  $('cgLabel').addEventListener('change', e => { S.label = e.target.value; ch(); });
  $('cgFollow').addEventListener('change', e => { S.follow = e.target.checked; ch(); });
  $('cgShapes').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.shape = b.dataset.s; S.pos = -1; posSel.value = -1; triSel = -1; ch(); if (S.view === 'grip' && S.shape !== 'all') play(lastNotes); });
  $('cgViews').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.view = b.dataset.v; triSel = -1; ch(); });
  $('cgTris').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; triSel = +b.dataset.tri; ch(); play(lastNotes, 18); });
  $('cgSeq').addEventListener('click', e => {
    const b = e.target.closest('.cg-sq'); if (!b) return;
    const x = cur.seq[+b.dataset.k]; if (!x) return;
    // Loop steht: Akkord ansehen; läuft er, folgt die Anzeige weiter dem Loop
    cur.on = +b.dataset.k; cur.c = x.c; sig = ''; render(); renderSeq();
  });
  $('cgNeck').addEventListener('click', e => { const g = e.target.closest('.cg-n'); if (g && window.Quinten) Quinten.playNote(+g.dataset.m); });
  $('cgStrum').addEventListener('click', () => play(lastNotes));
  $('cgArpUp').addEventListener('click', () => { const up = lastNotes.slice(); play(up.concat(up.slice(0, -1).reverse()), 30000 / bpm() / 2); });
  $('cgWalk').addEventListener('click', walk);
  $('cgLadder').addEventListener('click', ladder);

  let timer = null;
  document.addEventListener('tabchange', e => {
    clearInterval(timer); timer = null;
    if (e.detail !== 'caged') { stopTrain(); return; }
    sig = ''; seqSig = ''; update(true);
    timer = setInterval(() => { if (!trainT) update(false); }, 120);
  });
  window.Caged = { debug: () => ({ c: cur.c, next: cur.next, src: cur.src, S: Object.assign({}, S), notes: lastNotes.slice(), inst: pickInstance(cur.c), tris: (cur.triList || []).length }),
    shapes: (r, t) => allShapes({ r, t }), triads: (r, t, s) => triads({ r, t }, s), parse };
})();
