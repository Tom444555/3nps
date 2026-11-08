// v138: Jammen-Ideen im Backing Track – „Welche Tonleiter passt?“ (Griffbrett folgt dem Akkord), „Akkordfolgen-Ideen“
// (Tonart + Stil → Folge → „▶ Als Backing Track starten“), „Frage & Antwort“ (App spielt n Takte, du antwortest n Takte)
// und „Jam aufnehmen“ (Backing als Spur 1 in den Looper, Improvisation auf Spur 2 – die Loop-Länge-Einstellung bleibt unberührt, v135).
// Alles wird erst beim Öffnen des Backing Tracks gebaut; Anzeige-Takt nur bei offenem Reiter; Änderungen nur beim Akkordwechsel.
// Speicher: localStorage „3nps-jammen“ (neu) { fit, len, key, style }.
(function () {
  const $ = id => document.getElementById(id), panel = $('panel-jam'); if (!panel || !$('jmFit')) return;
  const TT = x => (typeof T === 'function' ? T(x) : x);
  const md = x => ((x % 12) + 12) % 12;
  const NN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const SCN = { ion: 'Ionisch', dor: 'Dorisch', phr: 'Phrygisch', lyd: 'Lydisch', mix: 'Mixolydisch', aeo: 'Äolisch', loc: 'Lokrisch', pmaj: 'Dur-Pentatonik', pmin: 'Moll-Pentatonik',
    blues: 'Blues-Tonleiter', dblues: 'Dur-Blues', hm: 'Harmonisch Moll', pd: 'Phrygisch-Dominant', mel: 'Melodisch Moll', arp: 'Akkordtöne' };
  let S = (function () { try { return JSON.parse(localStorage.getItem('3nps-jammen') || 'null') || {}; } catch (e) { return {}; } })();
  S.fit = S.fit || 'mode'; S.len = S.len || 2; S.style = S.style || 'Rock';
  const save = () => { try { localStorage.setItem('3nps-jammen', JSON.stringify(S)); } catch (e) {} };
  const bpm = () => parseFloat(($('bpm') || {}).value) || 80;
  const cname = c => NN[c.r] + c.t;
  const SH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const pc = c => window.SoloFinder ? SoloFinder.parseChord(SH[c.r] + c.t) : null;   // Solo Finder kennt nur Kreuz-Namen

  // ================= Welche Tonleiter passt? =================
  const FR = 15, W = 820, H = 150, X0 = 34, SY = 20, SG = 22;
  const fx = f => f === 0 ? X0 - 16 : X0 + (f - 0.5) * ((W - X0 - 10) / FR);
  const sy = s => SY + (5 - s) * SG;                    // s = 0 tiefe E-Saite … 5 hohe e-Saite (unten tief)
  const OPEN = [40, 45, 50, 55, 59, 64];
  function neckBase() {
    let h = '<rect x="' + X0 + '" y="' + (SY - 8) + '" width="' + (W - X0 - 10) + '" height="' + (5 * SG + 16) + '" class="jm-board"/>';
    for (let f = 0; f <= FR; f++) { const x = X0 + f * ((W - X0 - 10) / FR); h += '<line x1="' + x + '" y1="' + (SY - 8) + '" x2="' + x + '" y2="' + (SY + 5 * SG + 8) + '" class="' + (f ? 'jm-fret' : 'jm-nut') + '"/>'; }
    [3, 5, 7, 9, 15].forEach(f => { h += '<circle cx="' + fx(f) + '" cy="' + (SY + 2.5 * SG) + '" r="4" class="jm-inl"/>'; });
    h += '<circle cx="' + fx(12) + '" cy="' + (SY + 1.5 * SG) + '" r="4" class="jm-inl"/><circle cx="' + fx(12) + '" cy="' + (SY + 3.5 * SG) + '" r="4" class="jm-inl"/>';
    for (let s = 0; s < 6; s++) h += '<line x1="' + X0 + '" y1="' + sy(s) + '" x2="' + (W - 10) + '" y2="' + sy(s) + '" class="jm-str" stroke-width="' + (1.8 - s * 0.2).toFixed(1) + '"/>';
    for (let f = 1; f <= FR; f++) if ([3, 5, 7, 9, 12, 15].includes(f)) h += '<text x="' + fx(f) + '" y="' + (H - 2) + '" class="jm-fn">' + f + '</text>';
    return h;
  }
  function neckDots(sug, c) {
    if (!sug) return '';
    const ct = c ? c.iv.map(x => md(c.r + x)) : [], root = c ? c.r : sug.root; let h = '';
    for (let s = 0; s < 6; s++) for (let f = 0; f <= FR; f++) {
      const pc = md(OPEN[s] + f); if (!sug.pcs.includes(pc)) continue;
      const cls = pc === root ? 'root' : sug.ch === pc ? 'char' : ct.includes(pc) ? 'ct' : 'sc';
      h += '<g class="jm-d ' + cls + '"><circle cx="' + fx(f) + '" cy="' + sy(s) + '" r="9"/><text x="' + fx(f) + '" y="' + (sy(s) + 3.5) + '">' + NN[pc] + '</text></g>';
    }
    return h;
  }
  function pick(c, key) {
    if (!c || !window.SoloFinder) return null;
    const L = SoloFinder.suggestions(c.r, c.t, key.pc, key.major);
    if (S.fit === 'penta') return L.find(x => x.tag === 'Pentatonik') || L[0];
    if (S.fit === 'arp') return L.find(x => x.id === 'arp') || L[0];
    return L[0];
  }
  const sname = s => s ? (s.id === 'arp' ? TT('Akkordtöne') : NN[s.root] + ' ' + TT(SCN[s.id] || s.id)) : '–';
  function source() {
    const J = window.Jam; if (!J) return null;
    const st = J.state(), key = st.key, seq = st.seq; if (!seq.length) return null;
    let i = 0, live = false;
    if (J.active()) { const ci = J.chordInfo(); if (ci && ci.pos != null) { const k = ci.segs.findIndex(g => ci.pos >= g.a && ci.pos < g.e); if (k >= 0) { i = k; live = true; } } }
    return { key, c: seq[i], n: seq[(i + 1) % seq.length], live, i };
  }
  let fitKey = '';
  function paintFit(force) {
    const src = source(); if (!src) return;
    const k = src.i + '|' + cname(src.c) + '|' + src.key.pc + src.key.major + '|' + S.fit + '|' + src.live;
    if (k === fitKey && !force) return; fitKey = k;
    const c = pc(src.c), n = pc(src.n), s = pick(c, src.key), sn = pick(n, src.key);
    $('jmFitNow').innerHTML = '<span class="lbl">' + TT(src.live ? 'Klingt jetzt' : 'Erster Akkord') + '</span><b translate="no">' + cname(src.c) + '</b><span class="jm-arrow">→</span><b class="jm-sc" translate="no">' + sname(s) + '</b>';
    $('jmFitTones').innerHTML = s ? '<span class="lbl">' + TT('Töne') + '</span><span translate="no">' + s.pcs.map(p => p === (c && c.r) ? '<b>' + NN[p] + '</b>' : NN[p]).join(' ') + '</span>' + (s.ch != null ? ' · ' + TT('Charakterton') + ' <b translate="no">' + NN[s.ch] + '</b>' : '') : '';
    $('jmFitNext').innerHTML = '<span class="lbl">' + TT('Danach') + '</span><b translate="no">' + cname(src.n) + '</b> <span class="caption" translate="no">' + sname(sn) + '</span>';
    $('jmDots').innerHTML = neckDots(s, c);
  }
  function buildFit() {
    $('jmFit').innerHTML = '<div class="card-head"><h2>' + TT('Welche Tonleiter passt?') + '</h2><span class="seg" id="jmFitSeg">' +
      [['mode', 'Tonleiter'], ['penta', 'Pentatonik'], ['arp', 'Akkordtöne']].map(([v, t]) => '<button class="toggle-btn' + (S.fit === v ? ' active' : '') + '" data-fit="' + v + '">' + TT(t) + '</button>').join('') + '</span></div>' +
      '<div class="jm-fitrow"><span id="jmFitNow"></span><span id="jmFitTones" class="jm-tones"></span><span id="jmFitNext" class="jm-next"></span></div>' +
      '<div class="jm-neckwrap"><svg class="jm-neck" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" aria-label="' + TT('Griffbrett mit passenden Tönen') + '">' + neckBase() + '<g id="jmDots"></g></svg></div>' +
      '<span class="sf-leg"><i class="root"></i>' + TT('Grundton') + ' <i class="ct"></i>' + TT('Akkordton') + ' <i class="char"></i>' + TT('Charakterton') + ' <i class="sc"></i>' + TT('Tonleiter') + '</span>';
    $('jmFit').addEventListener('click', e => { const b = e.target.closest('[data-fit]'); if (!b) return; S.fit = b.dataset.fit; save(); $('jmFit').querySelectorAll('[data-fit]').forEach(x => x.classList.toggle('active', x === b)); paintFit(true); });
    paintFit(true);
  }

  // ================= Akkordfolgen-Ideen =================
  // Stufen: [Halbtöne über Tonika, Typ, Schläge]; je Stil mehrere Muster für Dur (M) und Moll (m)
  const ST = {
    Rock: { bpm: 112, M: [[[0, ''], [5, ''], [7, ''], [5, '']], [[0, ''], [10, ''], [5, ''], [0, '']], [[0, ''], [7, ''], [5, ''], [0, '']], [[0, '5'], [3, '5'], [5, '5'], [0, '5']]],
      m: [[[0, 'm'], [10, ''], [8, ''], [10, '']], [[0, 'm'], [5, 'm'], [10, ''], [0, 'm']], [[0, 'm'], [8, ''], [3, ''], [10, '']]] },
    Blues: { bpm: 96, M: [[[0, '7', 16], [5, '7', 8], [0, '7', 8], [7, '7'], [5, '7'], [0, '7'], [7, '7']], [[0, '7'], [5, '7'], [0, '7', 8], [5, '7', 8], [0, '7', 8], [7, '7'], [5, '7'], [0, '7'], [7, '7']]],
      m: [[[0, 'm7', 16], [5, 'm7', 8], [0, 'm7', 8], [8, '7'], [7, '7'], [0, 'm7'], [7, '7']]] },
    Pop: { bpm: 100, M: [[[0, ''], [7, ''], [9, 'm'], [5, '']], [[9, 'm'], [5, ''], [0, ''], [7, '']], [[0, ''], [9, 'm'], [5, ''], [7, '']], [[5, ''], [0, ''], [7, ''], [9, 'm']]],
      m: [[[0, 'm'], [8, ''], [3, ''], [10, '']], [[0, 'm'], [5, 'm'], [8, ''], [10, '']]] },
    Metal: { bpm: 140, M: [[[0, '5'], [10, '5'], [5, '5'], [0, '5']], [[0, '5'], [3, '5'], [5, '5'], [3, '5']]],
      m: [[[0, '5'], [1, '5'], [0, '5'], [10, '5']], [[0, '5'], [8, '5'], [10, '5'], [0, '5']], [[0, '5'], [3, '5'], [5, '5'], [8, '5']], [[0, '5'], [6, '5'], [5, '5'], [3, '5']]] },
    Funk: { bpm: 104, M: [[[0, '9', 8], [5, '9', 8]], [[0, '7', 8], [10, '', 4], [5, '', 4]], [[2, 'm7'], [7, '9'], [2, 'm7'], [7, '9']]],
      m: [[[0, 'm7', 8], [5, '9', 8]], [[0, 'm9', 8], [10, '', 4], [5, '', 4]], [[0, 'm7'], [3, ''], [5, '7'], [0, 'm7']]] },
    Jazz: { bpm: 120, M: [[[2, 'm7'], [7, '7'], [0, 'maj7', 8]], [[0, 'maj7'], [9, 'm7'], [2, 'm7'], [7, '7']], [[4, 'm7'], [9, '7'], [2, 'm7'], [7, '7']]],
      m: [[[2, 'm7b5'], [7, '7'], [0, 'm7', 8]], [[0, 'm7'], [5, 'm7'], [10, '7'], [3, 'maj7']]] },
    Ballade: { bpm: 72, M: [[[0, 'maj7'], [5, 'maj7'], [9, 'm7'], [7, 'sus4']], [[0, ''], [4, 'm'], [5, ''], [7, '']], [[0, 'add9'], [7, ''], [9, 'm7'], [5, 'maj7']]],
      m: [[[0, 'm'], [10, ''], [8, 'maj7'], [7, 'sus4']], [[0, 'm9'], [8, 'maj7'], [3, ''], [10, '']]] }
  };
  const DRUM = { Rock: /rock/i, Blues: /shuffle|blues/i, Pop: /pop/i, Metal: /metal|double|punk/i, Funk: /funk/i, Jazz: /swing|jazz/i, Ballade: /ballad|ballade|soul/i };
  let idea = null;
  function makeIdea() {
    const key = S.key || (window.Jam ? (k => ({ pc: k.pc, major: k.major }))(Jam.state().key) : { pc: 9, major: false });
    const pat = ST[S.style][key.major ? 'M' : 'm'], last = idea && idea.pat;
    let p; do { p = pat[Math.floor(Math.random() * pat.length)]; } while (pat.length > 1 && p === last);
    idea = { pat: p, key, style: S.style, seq: p.map(([o, t, b]) => ({ r: md(key.pc + o), t, beats: b || 4 })) };
    paintIdea();
  }
  const ROM = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];
  const roman = (o, t) => { const r = ROM[o]; return /^m(?!aj)|dim|m7b5/.test(t) ? r.toLowerCase() + (t === 'dim' ? '°' : t === 'm7b5' ? 'ø' : '') : r; };
  const ideaText = () => idea.seq.map(c => cname(c) + (c.beats !== 4 ? ':' + (c.beats / 4) : '')).join(' ');
  function paintIdea() {
    const box = $('jmIdeaOut'); if (!idea) { box.innerHTML = '<p class="caption">' + TT('Tonart und Stil wählen, dann „🎲 Folge erzeugen“.') + '</p>'; return; }
    box.innerHTML = '<div class="jm-chips" translate="no">' + idea.seq.map((c, i) => '<span class="jm-chip"><b>' + cname(c) + '</b><small>' + roman(idea.pat[i][0], c.t) + (c.beats !== 4 ? ' · ' + (c.beats / 4) + ' T' : '') + '</small></span>').join('') + '</div>';
  }
  function startIdea() {
    if (!idea || !window.Jam) return;
    const st = Jam.state(); Jam.stop(); st.key = { pc: idea.key.pc, major: idea.key.major }; Jam.setSeq(ideaText());
    const ks = $('jamKey'); if (ks) ks.value = idea.key.pc + ':' + (idea.key.major ? 'M' : 'm');
    const b = $('bpm'); if (b) { b.value = ST[idea.style].bpm; b.dispatchEvent(new Event('input')); }
    const js = $('jamStyle'), rx = DRUM[idea.style];
    if (js && rx) { js.dispatchEvent(new Event('focus')); const op = [...js.options].find(o => rx.test(o.textContent) || rx.test(o.value)); if (op && js.value !== op.value) { js.value = op.value; js.dispatchEvent(new Event('change')); } }
    Jam.start(); fitKey = ''; paintFit(true);
  }
  function buildIdeas() {
    const k = S.key || (window.Jam ? Jam.state().key : { pc: 9, major: false });
    let opts = ''; for (let p = 0; p < 12; p++) opts += '<option value="' + p + ':M">' + NN[p] + '-Dur</option>'; for (let p = 0; p < 12; p++) opts += '<option value="' + p + ':m">' + NN[p] + '-Moll</option>';
    $('jmIdeas').innerHTML = '<h2>' + TT('Akkordfolgen-Ideen') + '</h2>' +
      '<div class="jm-irow"><label class="field"><span>' + TT('Tonart') + '</span><select id="jmKey" aria-label="' + TT('Tonart') + '">' + opts + '</select></label>' +
      '<label class="field"><span>' + TT('Stil') + '</span><select id="jmStyle" aria-label="' + TT('Stil') + '">' + Object.keys(ST).map(s => '<option value="' + s + '">' + TT(s) + '</option>').join('') + '</select></label></div>' +
      '<div class="jm-out" id="jmIdeaOut"></div>' +
      '<div class="jm-irow"><button class="toggle-btn" id="jmRoll">' + TT('🎲 Folge erzeugen') + '</button><button class="toggle-btn active" id="jmUse">' + TT('▶ Als Backing Track starten') + '</button></div>';
    $('jmKey').value = k.pc + ':' + (k.major ? 'M' : 'm'); $('jmStyle').value = S.style;
    $('jmKey').addEventListener('change', e => { const [p, q] = e.target.value.split(':'); S.key = { pc: +p, major: q === 'M' }; save(); if (idea) makeIdea(); });
    $('jmStyle').addEventListener('change', e => { S.style = e.target.value; save(); idea = null; makeIdea(); });
    $('jmRoll').addEventListener('click', makeIdea);
    $('jmUse').addEventListener('click', () => { if (!idea) makeIdea(); startIdea(); });
    paintIdea();
  }

  // ================= Frage & Antwort =================
  let QA = null;
  function tone(m, t, d, out) {
    const ac = audioCtx, f = 440 * Math.pow(2, (m - 69) / 12), g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.008); g.gain.setTargetAtTime(0.0001, t + d * 0.85, 0.05);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; g.connect(lp); lp.connect(out);
    [['triangle', 0.8], ['sawtooth', 0.12]].forEach(([ty, a]) => { const o = ac.createOscillator(), og = ac.createGain(); o.type = ty; o.frequency.value = f; og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.4); });
  }
  const CELLS = [[1, 1], [0.5, 0.5, 1], [1, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [1.5, 0.5], [0.75, 0.25, 1], [2]];
  function phrase(fromBeat, beats, b0, t0, bd) {
    // Pentatonik der Tonart (passt über den ganzen Loop), Lage um A3–E5; Ende auf dem Grundton
    const k = Jam.state().key, base = k.major ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10], pool = [];
    for (let m = 55; m <= 76; m++) if (base.includes(md(m - k.pc))) pool.push(m);
    let i = Math.floor(pool.length / 2), x = 0; const notes = [], len = beats - 1;
    while (x < len) { const cell = CELLS[Math.floor(Math.random() * CELLS.length)]; for (const d of cell) { if (x >= len) break; const dd = Math.min(d, len - x); if (Math.random() > 0.15) notes.push([x, dd, pool[i]]); x += dd; i = Math.max(0, Math.min(pool.length - 1, i + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)])); } }
    if (notes.length) { const lastN = notes[notes.length - 1], r = pool.reduce((a, m) => md(m - k.pc) === 0 && Math.abs(m - lastN[2]) < Math.abs(a - lastN[2]) ? m : a, pool[0]); lastN[2] = r; }
    const out = (typeof ensureMasterBus === 'function' ? ensureMasterBus() : null) || audioCtx.destination, now = audioCtx.currentTime;
    notes.forEach(([bx, d, m]) => { const t = t0 + (b0 + bx - fromBeat) * bd; if (t >= now - 0.005) tone(m, Math.max(t, now + 0.005), d * bd * 0.95, out); });
    return notes.length;
  }
  function qaTick() {
    if (!QA) return;
    if (!window.Jam || !Jam.active()) { if (QA.started && Date.now() - QA.started > 1500) qaStop(); return; }
    const ci = Jam.chordInfo(); if (!ci || ci.pos == null) return;
    if (QA.last != null && ci.pos < QA.last - 500) QA.wraps++;
    QA.last = ci.pos;
    const beat = (QA.wraps * ci.L + ci.pos) / 1000 - QA.off, len = S.len, blk = Math.floor(beat / (len * 4));
    if (beat < 0) return;
    const phase = blk % 2 === 0 ? 'q' : 'a', inBlk = beat - blk * len * 4;
    if (blk !== QA.blk) { QA.blk = blk; if (phase === 'q') { const bd = 60 / bpm(); QA.n += phrase(beat, len * 4, blk * len * 4, audioCtx.currentTime, bd) ? 1 : 0; } QA.phases.push(phase); }
    const b = Math.floor(inBlk);
    if (phase !== QA.ph || b !== QA.b) { QA.ph = phase; QA.b = b; paintQa(); }
  }
  function paintQa() {
    const box = $('jmQaInd'); if (!box) return;
    if (!QA) { box.className = 'jm-qaind'; box.innerHTML = '<b>' + TT('Aus') + '</b><span class="caption">' + TT('Die App spielt eine Frage, du antwortest – im Wechsel.') + '</span>'; $('jmQaGo').textContent = TT('▶ Frage & Antwort'); $('jmQaGo').classList.remove('playing'); return; }
    const n = S.len * 4, q = QA.ph === 'q';
    box.className = 'jm-qaind ' + (QA.ph ? (q ? 'q' : 'a') : '');
    box.innerHTML = '<b>' + (QA.ph ? (q ? TT('FRAGE · hör zu') : TT('ANTWORT · du spielst')) : TT('Gleich geht’s los …')) + '</b><span class="jm-beats">' + Array.from({ length: n }, (_, i) => '<i' + (QA.ph && i <= QA.b ? ' class="on"' : '') + '></i>').join('') + '</span>';
    $('jmQaGo').textContent = TT('■ Stopp'); $('jmQaGo').classList.add('playing');
  }
  function qaStart() {
    if (!window.Jam) return; ensureAudio();
    if (!Jam.active()) Jam.start();
    QA = { wraps: 0, last: null, blk: -1, ph: null, b: -1, n: 0, phases: [], started: Date.now(), off: 0 };
    // ab dem nächsten vollen Takt zählen (läuft der Track schon, nicht mitten im Takt beginnen)
    const ci = Jam.chordInfo(); if (ci && ci.pos != null) { QA.last = ci.pos; QA.off = Math.ceil(ci.pos / 4000) * 4; }
    clearInterval(QA.iv); QA.iv = setInterval(qaTick, 40); paintQa();
  }
  function qaStop() { if (!QA) return; clearInterval(QA.iv); QA = null; paintQa(); }
  function buildQa() {
    $('jmQa').innerHTML = '<div class="card-head"><h2>' + TT('Frage & Antwort') + '</h2><span class="seg" id="jmQaLen">' + [1, 2, 4].map(n => '<button class="toggle-btn' + (S.len === n ? ' active' : '') + '" data-qlen="' + n + '">' + n + ' ' + TT(n === 1 ? 'Takt' : 'Takte') + '</button>').join('') + '</span></div>' +
      '<div class="jm-qaind" id="jmQaInd"></div>' +
      '<div class="jm-irow"><button class="toggle-btn active" id="jmQaGo"></button><span class="caption">' + TT('Die Frage nutzt die Pentatonik der Tonart. Deine Antwort darf sie aufgreifen, verändern oder beantworten.') + '</span></div>';
    $('jmQa').addEventListener('click', e => { const l = e.target.closest('[data-qlen]'); if (l) { S.len = +l.dataset.qlen; save(); $('jmQa').querySelectorAll('[data-qlen]').forEach(x => x.classList.toggle('active', x === l)); if (QA) { QA.blk = -1; QA.off = Math.ceil(((QA.wraps * (Jam.chordInfo() || { L: 0 }).L) + (QA.last || 0)) / 4000) * 4; } return; }
      if (e.target.closest('#jmQaGo')) { if (QA) qaStop(); else qaStart(); } });
    paintQa();
  }

  // ================= Jam aufnehmen =================
  let R = null;
  function voicing(c) { const p = pc(c), iv = p ? p.iv : [0, 4, 7], b = 40 + md(c.r - 4); return [b].concat(iv.map(x => b + 12 + x)).map(m => ({ midi: m })); }
  function recStatus(t) { const el = $('jmRecSt'); if (el) el.textContent = t; }
  function paintRec() {
    const b = $('jmRecGo'); if (!b) return;
    b.textContent = R ? TT('■ Aufnahme beenden') : TT('⏺ Jam aufnehmen'); b.classList.toggle('rec', !!R);
    $('jmRecTo').hidden = !(R === null && paintRec.done);
  }
  async function recStart() {
    if (!window.Jam || typeof Looper === 'undefined' || !window.Powerchords) return;
    const seq = Jam.state().seq.slice();
    if (!seq.length) { recStatus(TT('Erst eine Akkordfolge eingeben.')); return; }
    if (seq.some(c => c.beats % 4)) { recStatus(TT('„Jam aufnehmen“ geht mit ganzen Takten – bitte halbe Takte in der Folge auf 1 Takt stellen.')); return; }
    if (!Looper.isEmpty() && !confirm(TT('Im Looper sind schon Aufnahmen. Durch Backing Track + Jam ersetzen?'))) return;
    qaStop(); Jam.stop(); ensureAudio();
    const tempo = Math.round(bpm()), bars = seq.reduce((a, c) => a + c.beats / 4, 0);
    const data = Powerchords.renderBacking(seq.map(c => ({ tones: voicing(c), bars: c.beats / 4, rootPc: c.r })), tempo, { drums: 'drums', style: 'pad', bass: true });
    Looper.loadSamples(data);
    try { Looper.setSrcName('Backing Track ' + seq.map(cname).join(' ')); } catch (e) {}
    // Loop-Länge wird NICHT angefasst (v135): Spur 1 gibt die Länge vor, Spur 2 nimmt bis zum Stopp auf (auf ganze Runden aufgerundet)
    R = { bars, at: Date.now() }; paintRec.done = false; paintRec();
    await Looper.foot(1);
    recStatus(TT('Backing Track liegt auf Spur 1, Spur 2 nimmt auf – spiel los! Zum Beenden „■ Aufnahme beenden“.'));
  }
  function recStop() {
    if (!R) return; try { Looper.foot(1); } catch (e) {}
    R = null; paintRec.done = true; paintRec();
    recStatus(TT('Fertig – deine Improvisation liegt im Looper auf Spur 2 (Backing auf Spur 1).'));
  }
  function buildRec() {
    $('jmRec').innerHTML = '<div class="card-head"><h2>' + TT('Jam aufnehmen') + '</h2></div>' +
      '<div class="jm-irow"><button class="toggle-btn active" id="jmRecGo"></button><button class="toggle-btn" id="jmRecTo" hidden>' + TT('→ Zum Looper') + '</button><span class="caption" id="jmRecSt">' +
      TT('Legt den Backing Track als Spur 1 in den Looper und nimmt deine Improvisation direkt auf Spur 2 auf. Deine Loop-Länge bleibt, wie sie ist.') + '</span></div>';
    $('jmRecGo').addEventListener('click', () => { if (R) recStop(); else recStart(); });
    $('jmRecTo').addEventListener('click', () => { if (window.AppNav) AppNav.show('looper'); });
    paintRec();
  }

  // ================= Aufbau / Takt =================
  let built = false, ui = null;
  function build() { if (built) return; built = true; buildFit(); buildIdeas(); buildQa(); buildRec(); }
  document.addEventListener('tabchange', e => {
    clearInterval(ui); ui = null;
    if (e.detail !== 'jam') return;
    build(); fitKey = ''; paintFit(true); paintQa();
    ui = setInterval(() => { paintFit(false); if (R && Looper.debug().tracks[1].state !== 'recording' && Looper.debug().tracks[1].L > 0 && Date.now() - R.at > 1500) { R = null; paintRec.done = true; paintRec(); recStatus(TT('Fertig – deine Improvisation liegt im Looper auf Spur 2 (Backing auf Spur 1).')); } }, 120);
  });
  window.JamIdeen = { build, makeIdea, idea: () => idea && { style: idea.style, key: idea.key, text: ideaText(), seq: idea.seq.map(c => Object.assign({}, c)) }, startIdea, qaStart, qaStop, qa: () => QA && { ph: QA.ph, b: QA.b, blk: QA.blk, n: QA.n, phases: QA.phases.slice() }, recStart, recStop, rec: () => R && Object.assign({}, R), fit: () => ({ now: ($('jmFitNow') || {}).textContent, dots: document.querySelectorAll('#jmDots .jm-d').length }), ST, S: () => Object.assign({}, S) };
})();
