// v120: Reiter „Powerchords“ (1-5-8-Theorie). Alles wird erst beim ersten Öffnen gebaut (keine Last für den Looper).
// Bereiche: Theorie · Schritt für Schritt · Griffbrett · Akkordfolgen · Übungen. Üben: Backing (Powerchord-Klang + Drums/Klick)
// wird als Loop gerendert und auf Spur 1 des Loopers gelegt – läuft also im Looper-Takt, Spur 2/3 bleiben zum Aufnehmen.
// „Als Backing abspielen“ nutzt den Backing Track (Jam). Fortschritt: localStorage „powerchords.progress.v1“.
(function () {
  const $ = id => document.getElementById(id), panel = $('panel-power'); if (!panel) return;
  const TT = x => (typeof T === 'function' ? T(x) : x);
  const md = x => ((x % 12) + 12) % 12;
  const en = () => window.__lang === 'en';
  // ---------- Daten (Vorgabe 2.5) ----------
  const OPEN = [4, 9, 2, 7, 11, 4], MIDI0 = [40, 45, 50, 55, 59, 64], SNAME = ['E', 'A', 'D', 'G', 'H', 'e'];
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const FLATKEY = [1, 3, 5, 8, 10];          // Db, Eb, F, Ab, Bb mit b; sonst Kreuze (F#/Gb → F#)
  const tn = (so, f, r) => ({ so, f, r });
  const SHAPES = {
    'e-2': [tn(0, 0, '1'), tn(1, 2, '5')], 'e-3': [tn(0, 0, '1'), tn(1, 2, '5'), tn(2, 2, '8')],
    'a-2': [tn(0, 0, '1'), tn(1, 2, '5')], 'a-3': [tn(0, 0, '1'), tn(1, 2, '5'), tn(2, 2, '8')],
    'd-2': [tn(0, 0, '1'), tn(1, 2, '5')], 'd-3': [tn(0, 0, '1'), tn(1, 2, '5'), tn(2, 3, '8')],        // Oktave auf H: n+3
    'a-2-inv': [tn(-1, 0, '5'), tn(0, 0, '1')], 'a-3-inv': [tn(-1, 0, '5'), tn(0, 0, '1'), tn(1, 2, '5')],
    'd-2-inv': [tn(-1, 0, '5'), tn(0, 0, '1')], 'd-3-inv': [tn(-1, 0, '5'), tn(0, 0, '1'), tn(1, 2, '5')]
  };
  const DEG = { I: 0, bIII: 3, IV: 5, V: 7, bVI: 8, bVII: 10 }, DSTEP = { I: 0, bIII: 2, IV: 3, V: 4, bVI: 5, bVII: 6 };
  const PROGS = [
    { id: 'i-bvii-iv', name: 'I – bVII – IV', label: 'Rock-Klassiker', degrees: ['I', 'bVII', 'IV'], scaleHint: 'Moll-Pentatonik' },
    { id: 'i-biii-iv', name: 'I – bIII – IV', label: 'Hard-Rock', degrees: ['I', 'bIII', 'IV'], scaleHint: 'Moll-Pentatonik' },
    { id: 'i-bvi-bvii', name: 'I – bVI – bVII', label: 'Episch / Dunkel', degrees: ['I', 'bVI', 'bVII'], scaleHint: 'Moll-Pentatonik' },
    { id: 'i-iv-v', name: 'I – IV – V', label: 'Grundlagen', degrees: ['I', 'IV', 'V'], scaleHint: 'Moll- oder Dur-Pentatonik (bluesig bzw. hell)' }
  ];
  const EXS = [
    { id: 'ex1', title: 'E-Saite, 2-Ton verschieben', bpmStart: 60, bpmTarget: 100, d: '<b>E-Saite, 2-Ton:</b> Form bewegen E5 – G5 – A5 – D5 (Bund 0, 3, 5, 10). Pro Akkord vier Viertel, sauber abdämpfen.', seq: [[4, 0], [7, 0], [9, 0], [2, 0]], n: 2 },
    { id: 'ex2', title: 'A-Saite, 3-Ton verschieben', bpmStart: 60, bpmTarget: 100, d: '<b>A-Saite, 3-Ton:</b> Form bewegen A5 – C5 – D5 – E5 (Bund 0, 3, 5, 7). Pro Akkord vier Viertel, Dämpfsaiten sind still.', seq: [[9, 1], [0, 1], [2, 1], [4, 1]], n: 3 },
    { id: 'ex3', title: 'Grundtöne benennen', bpmStart: 40, bpmTarget: 70, d: '<b>Grundtöne benennen:</b> Zufälligen Bund wählen, Akkordnamen laut sagen, dann greifen (E- und A-Saite, siehe Tabelle).', rnd: true, n: 2, drums: 'click' },
    { id: 'ex4', title: 'Palm Mute-Achtel', bpmStart: 70, bpmTarget: 120, progression: 'i-bvii-iv', key: 'E', d: '<b>Palm Mute-Achtel:</b> Auf E5 acht Achtel pro Takt, dann I – bVII – IV in E mit Palm Mute.', n: 2, pm: true, pre: [4] },
    { id: 'ex5', title: 'Gleiche Folge, kurze Wege', bpmStart: 70, bpmTarget: 110, progression: 'i-bvii-iv', key: 'A', d: '<b>Gleiche Folge, kurze Wege:</b> I – bVII – IV in A, einmal mit Grundton auf der E-Saite, einmal auf der A-Saite. Wegvergleich beachten.', n: 3, twice: [0, 1] },
    { id: 'ex6', title: 'Abwechslung & Dynamik', bpmStart: 80, bpmTarget: 130, progression: 'i-biii-iv', key: 'E', d: '<b>Abwechslung &amp; Dynamik:</b> I – bIII – IV in E mit Abschlägen, mit Pausen und lautem/leisem Wechsel (Akzent auf Zählzeit 1). Anschließend Moll-Pentatonik-Lick dazu.', n: 2, dyn: true }
  ];
  const KEYPC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11, B: 11 };
  // ---------- Schreibweise ----------
  const LET = 'CDEFGAB', LPC = [0, 2, 4, 5, 7, 9, 11];
  const keyName = pc => (FLATKEY.includes(md(pc)) ? FLAT : SHARP)[md(pc)];
  function spellAt(pc, li) {
    li = ((li % 7) + 7) % 7; const d = md(pc - LPC[li]), acc = d === 0 ? '' : d === 1 ? '#' : d === 11 ? 'b' : null;
    if (acc == null) return null; const n = LET[li] + acc; return /^(Cb|Fb|E#|B#)$/.test(n) ? null : n;
  }
  // Ton über einen Stufen-Buchstabenabstand vom Bezugston schreiben (bIII von G = Bb, nicht A#); sonst Kreuz/b nach Tonart
  const spellRel = (pc, ref, steps, flat) => spellAt(pc, LET.indexOf(ref[0]) + steps) || (flat ? FLAT : SHARP)[md(pc)];
  const disp = n => n === 'B' ? (en() ? 'B' : 'H') : n;             // intern englische Buchstaben, Anzeige deutsch: H
  const sname = s => s === 4 && en() ? 'B' : SNAME[s];
  const pcLabel = pc => { const a = disp(SHARP[pc]), b = disp(FLAT[pc]); return a === b ? a : a + '/' + b; };
  const shapeId = (s, n, inv) => 'ead'[s] + '-' + n + (inv ? '-inv' : '');
  const maxOff = (s, n, inv) => Math.max(...SHAPES[shapeId(s, n, inv)].map(t => t.f));

  // ---------- Berechnung (Vorgabe 2.6) ----------
  function calc(o) {
    const s = Math.max(0, Math.min(2, o.s | 0)), n = o.n === 3 ? 3 : 2, inv = !!o.inv && s > 0, id = shapeId(s, n, inv), sh = SHAPES[id], pc = md(o.pc);
    let f = md(pc - OPEN[s]), warn = '';
    if (f === 0 && o.hi) f = 12;
    const mx = Math.max(...sh.map(t => t.f));
    if (f + mx > 12 && !(o.hi && f === 12)) { if (f - 12 >= 0) f -= 12; else warn = 'Ein Ton liegt über Bund 12 – auf einer anderen Saite liegt der Griff bequemer.'; }
    const flat = FLATKEY.includes(pc), rn = keyName(pc), fifth = spellRel(pc + 7, rn, 4, flat);
    const tones = sh.map(t => ({ s: s + t.so, f: f + t.f, role: t.r, name: t.r === '5' ? fifth : rn, midi: MIDI0[s + t.so] + f + t.f }));
    const used = new Set(tones.map(t => t.s)), muted = [0, 1, 2, 3, 4, 5].filter(i => !used.has(i));
    return { id, s, f, n, inv, pc, rn, fifth, name: disp(rn) + '5' + (inv ? '/' + disp(fifth) : ''), tones, muted, warn, maxF: Math.max(12, ...tones.map(t => t.f)) };
  }
  function tabText(c) {
    const by = {}; c.tones.forEach(t => { by[t.s] = t; }); const lo = Math.min(...c.tones.map(t => t.s));
    const ROLE = { '1': 'Grundton', '5': 'Quinte', '8': 'Oktave' };
    return [5, 4, 3, 2, 1, 0].map(s => {
      const t = by[s]; let cell = '-----', note = '';
      if (t) { const v = String(t.f); cell = v.length > 1 ? '-' + v + '--' : '--' + v + '--'; const off = t.f - c.f;
        note = '   ' + (c.inv && t.role === '5' ? (t.s < c.s ? 'Quinte darunter' : 'Quinte darüber') : ROLE[t.role]) + ' (' + (off ? 'n+' + off : 'n') + ')'; }
      else if (s < lo) { cell = '--x--'; note = '   gedämpft'; }
      return sname(s) + '|' + cell + '|' + note;
    }).join('\n');
  }
  const toneLine = c => c.tones.slice().sort((a, b) => a.midi - b.midi).map(t => disp(t.name) + ' (' + t.role + ')').join(' – ');
  // Optionen eines Akkords auf den erlaubten Saiten (alle Töne in Bund 0–12)
  function options(pc, n, strings) {
    const out = [];
    strings.forEach(s => { const f0 = md(pc - OPEN[s]); (f0 === 0 ? [0, 12] : [f0]).forEach(f => { if (f + maxOff(s, n, false) <= 12) out.push({ s, f }); }); });
    return out;
  }
  // Saite „Auto“: kürzester Gesamtweg (Summe der Bundwechsel), bei Gleichstand tiefere Lage
  function place(list, mode, n) {
    const all = mode === 'auto' || mode == null ? [0, 1, 2] : [mode | 0];
    const opts = list.map(c => { const st = c.s != null ? [c.s] : all; let o = options(c.pc, n, st); if (!o.length) { const s = st[0]; o = [{ s, f: md(c.pc - OPEN[s]), warn: true }]; } return o; });
    const cost = [], back = [];
    opts.forEach((os, i) => {
      cost[i] = []; back[i] = [];
      os.forEach((o, j) => {
        if (!i) { cost[i][j] = o.f * 0.01; back[i][j] = -1; return; }
        let best = Infinity, bk = 0; opts[i - 1].forEach((p, k) => { const v = cost[i - 1][k] + Math.abs(o.f - p.f) + o.f * 0.01; if (v < best - 1e-9) { best = v; bk = k; } });
        cost[i][j] = best; back[i][j] = bk;
      });
    });
    let j = 0, L = opts.length - 1; if (L < 0) return { chords: [], path: 0 };
    cost[L].forEach((v, k) => { if (v < cost[L][j]) j = k; });
    const pick = []; for (let i = L; i >= 0; i--) { pick[i] = opts[i][j]; j = back[i][j]; }
    let path = 0;
    const chords = list.map((c, i) => {
      const p = pick[i]; if (i) path += Math.abs(p.f - pick[i - 1].f);
      const cc = calc({ pc: c.pc, s: p.s, n, hi: p.f === 12 });
      return Object.assign({}, c, { name: disp(c.rn || cc.rn) + '5', rootPc: md(c.pc), shapeId: cc.id, rootString: p.s, rootFret: cc.f, tones: cc.tones, warn: !!p.warn || !!cc.warn });
    });
    return { chords, path };
  }
  function prog(pid, keyPc, mode, n) {
    const P = PROGS.find(p => p.id === pid) || PROGS[0], kn = keyName(keyPc), kf = FLATKEY.includes(md(keyPc));
    const list = P.degrees.map(d => { const pc = md(keyPc + DEG[d]); return { degree: d, pc, rn: spellRel(pc, kn, DSTEP[d], kf) }; });
    return Object.assign(place(list, mode, n), { prog: P, keyPc: md(keyPc), keyName: disp(kn) });
  }
  function handoff(r, bpm, n) {
    return { type: 'powerchord-progression', progressionId: r.prog ? r.prog.id : null, keyPc: r.keyPc, keyName: r.keyName, bpm, timeSignature: '4/4', barsPerChord: 1, loop: true, toneCount: n,
      chords: r.chords.map(c => ({ degree: c.degree || null, name: c.name, rootPc: c.rootPc, shapeId: c.shapeId, rootString: c.rootString, rootFret: c.rootFret })) };
  }

  // ---------- Klang ----------
  function out() { ensureAudio(); return (typeof ensureMasterBus === 'function' ? ensureMasterBus() : null) || audioCtx.destination; }
  function playMidi(m, dt) {
    try {
      const o0 = out(), ac = audioCtx, t = ac.currentTime + 0.01 + (dt || 0), f = 440 * Math.pow(2, (m - 69) / 12);
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; g.connect(lp); lp.connect(o0);
      ['triangle', 'sawtooth'].forEach((type, j) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const og = ac.createGain(); og.gain.value = j ? 0.2 : 0.8; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.5); });
      setTimeout(() => { try { lp.disconnect(); } catch (e) {} }, 1800 + (dt || 0) * 1000);
    } catch (e) {}
  }
  const strumNow = ms => ms.slice().sort((a, b) => a - b).forEach((m, k) => playMidi(m, k * 0.028));
  const seqNow = ms => ms.forEach((m, k) => playMidi(m, k * 0.38));

  // Backing rendern: Powerchord (2 leicht verstimmte Sägezähne je Ton, Verzerrung, Tiefpass), Achtel-Abschläge, Drums oder Klick
  function renderBacking(chords, bpm, o) {
    o = o || {}; const sr = typeof audioCtx !== 'undefined' && audioCtx ? audioCtx.sampleRate : 48000, bf = Math.round(4 * 60 / bpm * sr), beat = bf / 4;
    const bars = chords.reduce((a, c) => a + (c.bars || 1), 0), N = bars * bf, buf = new Float32Array(N);
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
    function strum(s0, dur, ms, amp, pm) {
      s0 = Math.round(s0); const n = Math.min(N - s0, Math.round(dur * sr)); if (n <= 0) return;
      const fr = []; ms.forEach(m => { const f = 440 * Math.pow(2, (m - 69) / 12); fr.push(f, f * 1.0045); });
      const ph = fr.map(() => Math.random()), tau = (pm ? 0.075 : 0.5) * sr, cut = pm ? 0.09 : 0.25, rel = Math.round(0.012 * sr), lag = Math.round(0.007 * sr);
      let y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) {
        let x = 0;
        for (let k = 0; k < fr.length; k++) { if (i < (k >> 1) * lag) continue; ph[k] += fr[k] / sr; if (ph[k] >= 1) ph[k] -= 1; x += 2 * ph[k] - 1; }
        x = Math.tanh(x * 0.9) * 0.8;
        y1 += cut * (x - y1); y2 += cut * (y1 - y2);
        const env = Math.min(1, i / (0.003 * sr)) * Math.exp(-i / tau) * (i > n - rel ? (n - i) / rel : 1);
        buf[s0 + i] += y2 * env * amp;
      }
    }
    function drum(s0, kind, acc) {
      s0 = Math.round(s0); const len = Math.round((kind === 'k' ? 0.28 : kind === 's' ? 0.18 : kind === 'h' ? 0.05 : 0.03) * sr), n = Math.min(N - s0, len); let ph = 0, hp = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr; let v = 0;
        if (kind === 'k') { ph += (48 + 95 * Math.exp(-t * 28)) / sr; v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 11) * 0.9; }
        else if (kind === 's') { ph += 185 / sr; const nz = rnd(); v = (Math.sin(2 * Math.PI * ph) * 0.35 * Math.exp(-t * 30) + nz * 0.5 * Math.exp(-t * 18)) * 0.7; }
        else if (kind === 'h') { const nz = rnd(); hp = nz - last; last = nz; v = hp * 0.18 * Math.exp(-t * 70); }
        else { ph += (acc ? 1600 : 1100) / sr; v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 90) * 0.55; }
        buf[s0 + i] += v * (acc ? 1 : 0.8);
      }
    }
    let b0 = 0;
    chords.forEach(c => {
      const ms = c.tones.map(t => t.midi);
      for (let b = 0; b < (c.bars || 1); b++) {
        const bs = (b0 + b) * bf;
        for (let e = 0; e < 8; e++) {
          if (o.dyn && (e === 6 || e === 7)) continue;                         // Pause am Taktende (Dynamik-Übung)
          const open = !o.pm && e === 0, amp = o.dyn ? (e === 0 ? 1 : 0.42) : (e % 2 ? 0.55 : e === 0 ? 0.95 : 0.75);
          strum(bs + e * beat / 2, open ? beat * 0.98 : beat * 0.47, ms, amp * 0.3, !open);
        }
        if (o.drums === 'click') for (let q = 0; q < 4; q++) drum(bs + q * beat, 'c', q === 0);
        else if (o.drums !== 'none') { for (let q = 0; q < 4; q++) drum(bs + q * beat, q % 2 ? 's' : 'k', q === 0); for (let e = 0; e < 8; e++) drum(bs + e * beat / 2, 'h', e % 2 === 0); }
      }
      b0 += c.bars || 1;
    });
    let pk = 0; for (let i = 0; i < N; i++) { const a = Math.abs(buf[i]); if (a > pk) pk = a; }
    if (pk > 0) { const g = 0.6 / pk; for (let i = 0; i < N; i++) buf[i] *= g; }
    return buf;
  }

  // ---------- Speicher ----------
  const PKEY = 'powerchords.progress.v1', UKEY = 'powerchords.ui.v1';
  function loadProg() {
    let d = null; try { d = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) {}
    if (!d || typeof d !== 'object') d = {}; d.version = 1; d.exercises = d.exercises || {};
    EXS.forEach(x => { const e = d.exercises[x.id] = Object.assign({ done: false, bestBpm: null }, d.exercises[x.id] || {}); if (!(e.bpm >= 40)) e.bpm = x.bpmStart; });
    return d;
  }
  let PR = loadProg();
  function saveProg() { PR.updated = new Date().toISOString(); try { localStorage.setItem(PKEY, JSON.stringify(PR)); } catch (e) {} }
  let U = (function () { let d = null; try { d = JSON.parse(localStorage.getItem(UKEY) || 'null'); } catch (e) {} d = d || {};
    return { sec: d.sec || 'theorie', b: Object.assign({ pc: 7, s: 0, n: 2, inv: false, hi: false, lab: 'num', all: false, pos: false }, d.b || {}),
      f: Object.assign({ prog: 'i-bvii-iv', key: 4, mode: 'auto', n: 2, bpm: 90, drums: 'drums' }, d.f || {}), step: d.step | 0 }; })();
  function saveUi() { try { localStorage.setItem(UKEY, JSON.stringify(U)); } catch (e) {} }


  // ---------- v127: Griffbrett-Look (Palisander, Bundstäbchen mit Verlauf/Glanz/Schatten, umsponnene D/A/E, Knochensattel, Perlmutt, Vignette) ----------
  // Ohne SVG-Filter: Schatten sind versetzte dunkle Linien/Kreise (billig auf dem iPad). Eindeutige IDs je Griffbrett (versteckte Bereiche brechen sonst url(#…)).
  window.PcSkin = window.PcSkin || (function () {
    let uid = 0;
    function draw(o) {
      const u = 'pcs' + (++uid), RH = o.h / 6, CW = o.CW, a = o.a, b = o.b, mini = !!o.mini, x0 = o.x, y0 = o.y, W = o.w, H = o.h;
      const X = f => x0 + (f - a) * CW + CW / 2, Y = s => y0 + (5 - s) * RH + RH / 2, tw = H * 4;
      let h = '<defs><pattern id="' + u + 'w" patternUnits="userSpaceOnUse" x="' + x0 + '" y="' + y0 + '" width="' + tw + '" height="' + H + '"><image href="img/palisander.jpg" width="' + tw + '" height="' + H + '" preserveAspectRatio="none"/></pattern>' +
        '<linearGradient id="' + u + 'f" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#5e5b55"/><stop offset=".35" stop-color="#d8d4cc"/><stop offset=".5" stop-color="#fbf9f4"/><stop offset=".7" stop-color="#a9a59d"/><stop offset="1" stop-color="#4a4742"/></linearGradient>' +
        '<linearGradient id="' + u + 'n" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#cdbf9e"/><stop offset=".45" stop-color="#f6efdf"/><stop offset="1" stop-color="#bfae88"/></linearGradient>' +
        '<radialGradient id="' + u + 'p" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e9e6dc"/><stop offset=".8" stop-color="#b9c3c4"/><stop offset="1" stop-color="#8f9a9c"/></radialGradient>' +
        '<linearGradient id="' + u + 'v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".1" stop-color="#000" stop-opacity="0"/><stop offset=".9" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>' +
        '<linearGradient id="' + u + 'h" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".05" stop-color="#000" stop-opacity="0"/><stop offset=".95" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>';
      h += '<g class="pc-skin"><rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" fill="#3a2016"/><rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" fill="url(#' + u + 'w)"/>';
      const ir = mini ? 3.2 : 6;
      for (let f = Math.max(1, a); f <= b; f++) {
        const cy = [3, 5, 7, 9, 15, 17, 19, 21].includes(f) ? [y0 + 3 * RH] : f === 12 || f === 24 ? [y0 + 2 * RH, y0 + 4 * RH] : [];
        cy.forEach(c => { h += '<circle cx="' + (X(f) + .8) + '" cy="' + (c + 1.2) + '" r="' + ir + '" fill="#000" opacity=".35"/><circle cx="' + X(f) + '" cy="' + c + '" r="' + ir + '" fill="url(#' + u + 'p)"/>'; });
      }
      h += '<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" fill="url(#' + u + 'v)"/><rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" fill="url(#' + u + 'h)"/>';
      const fw = mini ? 2.4 : 4.2;
      for (let f = a; f <= b; f++) { const x = x0 + (f - a + 1) * CW;
        if (f === 0) { const nw = mini ? 5 : 9; h += '<rect x="' + (x - nw / 2 + 2) + '" y="' + y0 + '" width="' + nw + '" height="' + H + '" fill="#000" opacity=".35"/><rect x="' + (x - nw / 2) + '" y="' + (y0 - 1) + '" width="' + nw + '" height="' + (H + 2) + '" rx="1.5" fill="url(#' + u + 'n)"/>'; continue; }
        h += '<rect x="' + (x + fw / 2) + '" y="' + y0 + '" width="' + (fw * .9) + '" height="' + H + '" fill="#000" opacity=".32"/><rect x="' + (x - fw / 2) + '" y="' + y0 + '" width="' + fw + '" height="' + H + '" fill="url(#' + u + 'f)"/>' +
          '<line x1="' + (x - fw * .08) + '" y1="' + y0 + '" x2="' + (x - fw * .08) + '" y2="' + (y0 + H) + '" stroke="#fff" stroke-opacity=".75" stroke-width="' + (mini ? .4 : .7) + '"/>'; }
      for (let s = 0; s < 6; s++) { const y = Y(s), w = o.sw(s), x1 = x0, x2 = x0 + W, wound = s <= 2;
        h += '<line x1="' + x1 + '" y1="' + (y + w * .9 + 1.2) + '" x2="' + x2 + '" y2="' + (y + w * .9 + 1.2) + '" stroke="#000" stroke-opacity=".38" stroke-width="' + (w + .6) + '"/>' +
          '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + (wound ? '#a39c90' : '#cfccc5') + '" stroke-width="' + w + '"/>' +
          (wound ? '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#efeae0" stroke-width="' + w + '" stroke-dasharray="' + (mini ? '.5 .9' : '.8 1.3') + '"/>' : '') +
          '<line x1="' + x1 + '" y1="' + (y - w * .22) + '" x2="' + x2 + '" y2="' + (y - w * .22) + '" stroke="#fff" stroke-opacity=".55" stroke-width="' + Math.max(.3, w * .25) + '"/>'; }
      return h + '</g>';
    }
    const shadow = (cx, cy, r) => '<circle class="pc-msh" cx="' + (cx + r * .1) + '" cy="' + (cy + r * .16) + '" r="' + r + '" fill="#000" opacity=".38"/>';
    const P = { play: '<path d="M5 3.5v13l11-6.5z"/>', back: '<path d="M13 4l-7 6 7 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
      next: '<path d="M7 4l7 6-7 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>', check: '<path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
      pencil: '<path d="M4 16l1-4 8-8 3 3-8 8zM12 5l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>', box: '<rect x="3.5" y="3.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>',
      boxon: '<rect x="3.5" y="3.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 10.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' };
    const icon = n => '<svg class="pc-ic" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">' + P[n] + '</svg>';
    // Text mit ▶/◀/☐/✎ → schlichtes SVG-Symbol + Text (keine Emoji-Darstellung auf dem iPad)
    const btn = t => String(t).replace(/^▶ /, icon('play')).replace(/^◀ /, icon('back')).replace(/ ▶$/, icon('next')).replace(/^☐ /, icon('box')).replace(/^✎ /, icon('pencil'));
    return { draw, shadow, icon, btn };
  })();
  // ---------- Griffbrett (SVG) ----------
  const DEGL = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  function board(el, c) {
    const a = c.from || 0, b = c.to != null ? c.to : 12, cols = b - a + 1, mini = !!c.mini;
    const CW = mini ? 40 : 58, RH = mini ? 26 : 56, LM = mini ? 20 : 40, TM = 6, BM = mini ? 18 : 24, W = LM + cols * CW + 4, H = TM + 6 * RH + BM;
    const X = f => LM + (f - a) * CW + CW / 2, Y = s => TM + (5 - s) * RH + RH / 2, R = mini ? 10 : 18;
    const muted = new Set(c.muted || []);
    let h = '<svg class="pc-board' + (mini ? ' mini' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Griffbrett">';
    h += PcSkin.draw({ x: LM, y: TM, w: cols * CW, h: 6 * RH, a, b, CW, mini, sw: s => mini ? 1 + (5 - s) * 0.25 : 1.2 + (5 - s) * 0.45 });   // v127
    for (let s = 0; s < 6; s++) {
      h += '<text class="pc-sn" x="' + (mini ? 7 : 11) + '" y="' + Y(s) + '">' + sname(s) + '</text>';
      if (muted.has(s)) h += '<text class="pc-x" x="' + (mini ? 16 : 30) + '" y="' + Y(s) + '">x</text>';
    }
    for (let f = a; f <= b; f++) h += '<text class="pc-fn" x="' + X(f) + '" y="' + (H - (mini ? 5 : 7)) + '">' + f + '</text>';
    (c.lines || []).forEach(L => { h += '<polyline class="pc-pos' + (L.on ? ' on' : '') + '" points="' + L.pts.map(p => X(p.f) + ',' + Y(p.s)).join(' ') + '"/>'; });
    if (c.tap) for (let s = 0; s < 6; s++) for (let f = a; f <= b; f++) h += '<rect class="pc-cell" data-s="' + s + '" data-f="' + f + '" x="' + (LM + (f - a) * CW) + '" y="' + (TM + (5 - s) * RH) + '" width="' + CW + '" height="' + RH + '"/>';
    (c.marks || []).forEach(m => {
      if (m.f < a || m.f > b) return;
      h += (/ghost|bad/.test(m.cls || '') ? '' : PcSkin.shadow(X(m.f), Y(m.s), m.small ? R * 0.72 : R)) + '<g class="pc-m ' + (m.cls || '') + '"><circle cx="' + X(m.f) + '" cy="' + Y(m.s) + '" r="' + (m.small ? R * 0.72 : R) + '"/>' + (m.lab != null ? '<text x="' + X(m.f) + '" y="' + Y(m.s) + '">' + m.lab + '</text>' : '') + '</g>';
    });
    el.innerHTML = h + '</svg>';
    el._tapFn = c.tap || null;
    if (c.tap && !el._pcTap) { el._pcTap = true; el.addEventListener('click', e => { const r = e.target.closest && e.target.closest('[data-f]'); if (r && el._tapFn) el._tapFn(+r.dataset.s, +r.dataset.f); }); }
  }
  const tapPlay = (s, f) => playMidi(MIDI0[s] + f);
  // alle Lagen von 1-5(-8) für einen Grundton (aus den Tonhöhen gerechnet, gilt auch über G–H)
  function positions(pc, n) {
    const out = [];
    for (let rs = 0; rs < 5; rs++) {
      const f0 = md(pc - OPEN[rs]);
      [f0, f0 + 12].forEach(rf => {
        if (rf > 12) return;
        const pts = [{ s: rs, f: rf, role: '1' }], f5 = rf + 7 - (MIDI0[rs + 1] - MIDI0[rs]);
        pts.push({ s: rs + 1, f: f5, role: '5' });
        if (n === 3 && rs + 2 <= 5) pts.push({ s: rs + 2, f: rf + 12 - (MIDI0[rs + 2] - MIDI0[rs]), role: '8' });
        if (pts.every(p => p.f >= 0 && p.f <= 12)) out.push(pts);
      });
    }
    return out;
  }
  function chordMarks(c, lab) {
    return c.tones.map(t => ({ s: t.s, f: t.f, lab: lab === 'name' ? disp(t.name) : t.role, cls: t.role === '1' ? 'r1' : t.role === '8' ? 'r8' : 'r5' }));
  }

  // ---------- Aufbau (erst beim ersten Öffnen) ----------
  let built = false;
  const segHtml = (id, items, cur, aria) => '<div class="seg pc-seg" id="' + id + '" role="group" aria-label="' + aria + '">' + items.map(([v, l]) => '<button class="toggle-btn' + (String(v) === String(cur) ? ' active' : '') + '" data-v="' + v + '">' + l + '</button>').join('') + '</div>';
  function setSeg(id, v) { const g = $(id); if (g) g.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === String(v))); }
  function onSeg(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) fn(b.dataset.v); }); }
  function build() {
    if (built) return; built = true;
    $('pcSecTheorie').appendChild($('pcTheoryTpl').content.cloneNode(true));
    const pe = panel.querySelector('.pc-en'); if (pe) pe.hidden = !en();
    buildSteps(); buildBoard(); buildProg(); buildEx();
    onSeg('pcSubs', v => showSec(v));
    showSec(U.sec);
  }
  function showSec(v) {
    if (!['theorie', 'schritte', 'brett', 'folgen', 'uebungen', 'kurs'].includes(v)) v = 'theorie';
    U.sec = v; saveUi(); setSeg('pcSubs', v); panel.querySelectorAll('#pcSubs button').forEach(b => b.setAttribute('aria-selected', b.dataset.v === v ? 'true' : 'false'));
    panel.querySelectorAll('.pc-sec-wrap').forEach(w => { w.hidden = w.dataset.sec !== v; });
    if (v === 'schritte') stepShow(); else stepStop();
    if (v === 'brett') renderBoard();
    if (v === 'kurs' && window.PcKurs) PcKurs.build($('pcSecKurs'), { board, playMidi, strumNow, seqNow, begin, PR: () => PR, saveProg });   // v125: Kurs erst beim Öffnen
  }
  // Unter-Reiter-Knöpfe tragen data-sec, onSeg liest data-v → beides setzen
  panel.querySelectorAll('#pcSubs button').forEach(b => { b.dataset.v = b.dataset.sec; });

  // ===== Schritt für Schritt =====
  const STEPS = [
    { t: '1 · Dur-Tonleiter abzählen', p: 'Spiel auf der tiefen E-Saite die Dur-Tonleiter ab E: Bund 0, 2, 4, 5, 7, 9, 11, 12. Jeder Ton bekommt seine Nummer 1 bis 8. Die 8 ist wieder E, eine Oktave höher. Für den Powerchord brauchst du nur <b>1, 5 und 8</b>.',
      frames: () => { const F = [0, 2, 4, 5, 7, 9, 11, 12], fr = []; for (let k = 1; k <= 8; k++) fr.push(F.slice(0, k).map((f, i) => ({ s: 0, f, lab: String(i + 1), cls: i === 0 ? 'r1' : i === 4 ? 'r5' : i === 7 ? 'r8' : 'dx2' }))); return fr; }, play: () => seqNow([40, 42, 44, 45, 47, 49, 51, 52]) },
    { t: '2 · Quinte = 7 Halbtöne', p: 'Von der 1 aus zählst du <b>7 Bünde</b> (= 7 Halbtöne) weiter: dort liegt die Quinte (5). Auf der E-Saite: E (Bund 0) → H (Bund 7). Das gilt für jeden Grundton.',
      frames: () => { const fr = []; for (let k = 0; k <= 7; k++) { const m = [{ s: 0, f: 0, lab: '1', cls: 'r1' }]; for (let j = 1; j <= k; j++) m.push(j === 7 ? { s: 0, f: 7, lab: '5', cls: 'r5' } : { s: 0, f: j, lab: String(j), cls: 'dx', small: true }); fr.push(m); } return fr; }, play: () => { seqNow([40, 47]); setTimeout(() => strumNow([40, 47]), 900); } },
    { t: '3 · Zwei Bünde höher, eine Saite höher', p: 'Die Quinte von G (E-Saite Bund 3) läge auf derselben Saite in Bund 10 – weit weg. Derselbe Ton liegt eine Saite höher: <b>A-Saite Bund 5</b>, also zwei Bünde über dem Grundton. Die Oktave (8) liegt noch eine Saite höher im gleichen Bund: D-Saite Bund 5. Das ist G5.',
      frames: () => { const g = { s: 0, f: 10, lab: '5', cls: 'ghost' }, a = [{ s: 0, f: 3, lab: '1', cls: 'r1' }, g]; return [a, a.concat({ s: 1, f: 5, lab: '5', cls: 'r5' }), a.concat({ s: 1, f: 5, lab: '5', cls: 'r5' }, { s: 2, f: 5, lab: '8', cls: 'r8' })]; },
      lines: [{ pts: [{ s: 0, f: 10 }, { s: 1, f: 5 }] }], play: () => { seqNow([43, 50, 50, 55]); setTimeout(() => strumNow([43, 50, 55]), 1700); } },
    { t: '4 · Sonderfall H-Saite: ein Bund mehr', p: 'Zwischen G- und H-Saite liegt nur eine große Terz (4 Halbtöne) statt einer Quarte (5). Liegt der Grundton auf der D-Saite (hier F, Bund 3), rutscht die Oktave auf der H-Saite <b>einen Bund weiter: n+3</b> (Bund 6), nicht n+2.',
      frames: () => { const a = [{ s: 2, f: 3, lab: '1', cls: 'r1' }, { s: 3, f: 5, lab: '5', cls: 'r5' }]; return [a, a.concat({ s: 4, f: 5, lab: '×', cls: 'bad' }), a.concat({ s: 4, f: 5, lab: '×', cls: 'bad' }, { s: 4, f: 6, lab: '8', cls: 'r8' })]; }, play: () => strumNow([53, 60, 65]) },
    { t: '5 · Form verschieben', p: 'Die Griffform bleibt gleich, du schiebst sie nur am Hals entlang. Der Grundton (1) bestimmt den Namen.', loop: true,
      frames: () => [[0, 3], [0, 5], [0, 7], [0, 8], [1, 3], [1, 5], [1, 7]].map(([s, f]) => { const c = calc({ pc: md(OPEN[s] + f), s, n: 3, hi: f === 12 }); const m = chordMarks(c, 'num'); m.cap = c.name; m.c = c; return m; }),
      play: fr => fr && fr.c && strumNow(fr.c.tones.map(t => t.midi)) },
    { t: '6 · Die 3 weglassen: neutral', p: 'Die Terz macht einen Akkord zu Dur (3, große Terz) oder Moll (b3, kleine Terz). Der Powerchord lässt sie weg – darum passt er zu beiden. Hör dir den Unterschied an: G-Dur, G-Moll und G5.',
      frames: () => [[{ s: 0, f: 3, lab: '1', cls: 'r1' }, { s: 1, f: 5, lab: '5', cls: 'r5' }, { s: 2, f: 5, lab: '8', cls: 'r8' }, { s: 3, f: 4, lab: '3', cls: 'dx3' }, { s: 3, f: 3, lab: 'b3', cls: 'dx3 b3' }]], third: true, play: () => strumNow([43, 50, 55]) }
  ];
  let stepT = null, stepFr = null;
  function buildSteps() {
    $('pcSecSchritte').innerHTML = '<div class="card pc-steps"><div class="pc-row pc-stephead"><button class="toggle-btn" id="pcStPrev">◀ Zurück</button><span class="pc-stepnum" id="pcStNum"></span><button class="toggle-btn" id="pcStNext">Weiter ▶</button></div>' +
      '<h3 id="pcStT" translate="no"></h3><p id="pcStP" translate="no"></p><div class="pc-row" id="pcStBtns"><button class="toggle-btn active" id="pcStPlay">▶ Anhören</button><button class="toggle-btn" id="pcStMaj" hidden>Dur (1-3-5)</button><button class="toggle-btn" id="pcStMin" hidden>Moll (1-b3-5)</button><button class="toggle-btn" id="pcStPow" hidden>Powerchord (1-5-8)</button><span class="pc-cap" id="pcStCap"></span></div>' +
      '<div class="pc-bwrap" id="pcStBoard"></div><p class="caption">Tippe auf einen Punkt, um den Ton zu hören.</p></div>';
    $('pcStPrev').addEventListener('click', () => { U.step = Math.max(0, U.step - 1); saveUi(); stepShow(); });
    $('pcStNext').addEventListener('click', () => { U.step = Math.min(STEPS.length - 1, U.step + 1); saveUi(); stepShow(); });
    $('pcStPlay').addEventListener('click', () => STEPS[U.step].play(stepFr));
    const third = (ms, on) => { strumNow(ms); stepDraw(STEPS[U.step].frames()[0].filter(m => on.includes(m.lab))); };
    $('pcStMaj').addEventListener('click', () => third([43, 50, 55, 59], ['1', '5', '8', '3']));
    $('pcStMin').addEventListener('click', () => third([43, 50, 55, 58], ['1', '5', '8', 'b3']));
    $('pcStPow').addEventListener('click', () => third([43, 50, 55], ['1', '5', '8']));
  }
  function stepDraw(m) { stepFr = m; const S = STEPS[U.step]; board($('pcStBoard'), { marks: m, lines: S.lines, tap: tapPlay }); $('pcStCap').textContent = m.cap || ''; }
  function stepStop() { clearInterval(stepT); stepT = null; }
  function stepShow() {
    if (!$('pcStBoard')) return; stepStop();
    U.step = Math.max(0, Math.min(STEPS.length - 1, U.step | 0));
    const S = STEPS[U.step], fr = S.frames();
    $('pcStNum').textContent = 'Schritt ' + (U.step + 1) + ' von ' + STEPS.length;
    $('pcStT').textContent = S.t; $('pcStP').innerHTML = S.p;
    $('pcStPrev').disabled = U.step === 0; $('pcStNext').disabled = U.step === STEPS.length - 1;
    ['pcStMaj', 'pcStMin', 'pcStPow'].forEach(id => { $(id).hidden = !S.third; });
    let k = 0; stepDraw(fr[0]);
    if (fr.length > 1) stepT = setInterval(() => {                       // Animation: Töne erscheinen nacheinander (Schritt 5: Form wandert)
      if (panel.hidden || $('pcSecSchritte').hidden) { stepStop(); return; }
      k++; if (k >= fr.length) { if (!S.loop) { stepStop(); return; } k = 0; }
      stepDraw(fr[k]);
    }, S.loop ? 1400 : 420);
  }

  // ===== Griffbrett =====
  function buildBoard() {
    const notes = []; for (let pc = 0; pc < 12; pc++) notes.push([pc, pcLabel(pc)]);
    $('pcSecBrett').innerHTML = '<div class="card pc-brett"><div class="pc-top"><div class="pc-chordbox"><span class="lbl">Powerchord</span><b id="pcName" translate="no"></b><span class="pc-tones" id="pcTones" translate="no"></span></div>' +
      '<div class="pc-ctl">' + segHtml('pcStr', [[0, 'E-Saite'], [1, 'A-Saite'], [2, 'D-Saite']], U.b.s, 'Saite für den Grundton') + segHtml('pcN', [[2, '2-Ton'], [3, '3-Ton']], U.b.n, 'Töne') +
      '<label class="check pc-inv"><input type="checkbox" id="pcInv"> Umkehrung (Quinte unten)</label><span class="pc-hint" id="pcInvHint"></span></div></div>' +
      '<div class="pc-notes" id="pcNotes" role="group" aria-label="Grundton wählen">' + notes.map(([v, l]) => '<button class="toggle-btn" data-v="' + v + '" translate="no">' + l + '</button>').join('') + '</div>' +
      '<div class="pc-row pc-opts">' + segHtml('pcLab', [['num', 'Ziffern'], ['name', 'Notennamen']], U.b.lab, 'Beschriftung') +
      '<label class="check"><input type="checkbox" id="pcAll"> Alle Stufen zeigen</label><label class="check"><input type="checkbox" id="pcPos"> Alle Lagen</label>' +
      '<button class="toggle-btn" id="pcAlt">Andere Lage</button><button class="toggle-btn" id="pcHi" hidden>Bund 0 ↔ 12</button><button class="toggle-btn active" id="pcListen">▶ Anhören</button></div>' +
      '<div class="pc-bwrap" id="pcBoard"></div><p class="pc-warn" id="pcWarn" hidden></p>' +
      '<p class="caption">Tippe auf die Grundton-Saite, um den Grundton zu wählen. Jeder andere Punkt spielt seinen Ton.</p>' +
      '<div class="pc-legend" id="pcLegend"></div><pre class="pc-tab" id="pcTab" translate="no"></pre></div>';
    onSeg('pcStr', v => { U.b.s = +v; U.b.hi = false; renderBoard(); });
    onSeg('pcN', v => { U.b.n = +v; renderBoard(); });
    onSeg('pcLab', v => { U.b.lab = v; renderBoard(); });
    onSeg('pcNotes', v => { U.b.pc = +v; U.b.hi = false; renderBoard(); });
    $('pcInv').addEventListener('change', e => { U.b.inv = e.target.checked; renderBoard(); });
    $('pcAll').addEventListener('change', e => { U.b.all = e.target.checked; renderBoard(); });
    $('pcPos').addEventListener('change', e => { U.b.pos = e.target.checked; renderBoard(); });
    $('pcHi').addEventListener('click', () => { U.b.hi = !U.b.hi; renderBoard(); });
    // Alternative Lage: derselbe Akkord auf der nächsten Saite (E → A → D → E)
    $('pcAlt').addEventListener('click', () => { U.b.s = (U.b.s + 1) % 3; U.b.hi = false; renderBoard(); });
    $('pcListen').addEventListener('click', () => strumNow(calc(U.b).tones.map(t => t.midi)));
  }
  function renderBoard() {
    if (!$('pcBoard')) return; saveUi();
    const b = U.b, c = calc(b);
    setSeg('pcStr', b.s); setSeg('pcN', b.n); setSeg('pcLab', b.lab); setSeg('pcNotes', b.pc);
    const inv = $('pcInv'); inv.disabled = b.s === 0; inv.checked = b.inv && b.s > 0; inv.closest('label').classList.toggle('off', b.s === 0);
    $('pcInvHint').textContent = b.s === 0 ? 'Auf der E-Saite nicht möglich' : '';
    $('pcAll').checked = b.all; $('pcPos').checked = b.pos;
    $('pcHi').hidden = !(c.f === 0 || c.f === 12);
    $('pcName').textContent = c.name; $('pcTones').textContent = toneLine(c); $('pcTab').textContent = tabText(c);
    $('pcWarn').hidden = !c.warn; $('pcWarn').textContent = c.warn;
    let marks = [], lines = [];
    if (b.all) {                                                     // jeder Ton als Stufe zum Grundton (Dur-Zählweise), 1-5-8 farbig
      for (let s = 0; s < 6; s++) for (let f = 0; f <= 12; f++) {
        const iv = md(OPEN[s] + f - c.pc), name = disp(spellRel(OPEN[s] + f, c.rn, [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6][iv], FLATKEY.includes(c.pc)));
        marks.push({ s, f, lab: b.lab === 'name' ? name : DEGL[iv], cls: iv === 0 ? 'a1' : iv === 7 ? 'a5' : 'dx', small: iv !== 0 && iv !== 7 });
      }
    }
    if (b.pos) positions(c.pc, c.n).forEach(P => {
      lines.push({ pts: P });
      if (!b.all) P.forEach(p => marks.push({ s: p.s, f: p.f, lab: b.lab === 'name' ? disp(p.role === '5' ? c.fifth : c.rn) : p.role, cls: 'p' + p.role, small: true }));
    });
    lines.push({ pts: c.tones.slice().sort((x, y) => x.s - y.s), on: true });
    marks = marks.filter(m => !c.tones.some(t => t.s === m.s && t.f === m.f)).concat(chordMarks(c, b.lab));
    board($('pcBoard'), { marks, lines, muted: c.muted, to: c.maxF, tap: (s, f) => {
      if (s === b.s) { U.b.pc = md(OPEN[s] + f); U.b.hi = f === 12; renderBoard(); }
      tapPlay(s, f);
    } });
    $('pcLegend').innerHTML = '<span class="pc-lg r1">1 Grundton</span><span class="pc-lg r5">5 Quinte</span>' + (c.n === 3 ? '<span class="pc-lg r8">8 Oktave</span>' : '') + (b.all ? '<span class="pc-lg dx">andere Stufen (Dur-Zählweise)</span>' : '') + (c.muted.length ? '<span class="pc-lg">x = Saite abdämpfen</span>' : '');
  }
  function goBoard(ch, n) { U.b.pc = ch.rootPc; U.b.s = ch.rootString; U.b.n = n; U.b.inv = false; U.b.hi = ch.rootFret === 12; showSec('brett'); window.scrollTo({ top: panel.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' }); }

  // ===== Akkordfolgen =====
  let cur = null;   // letzte Berechnung der Folge
  function buildProg() {
    const keys = []; for (let pc = 0; pc < 12; pc++) keys.push('<option value="' + pc + '">' + pcLabel(pc) + '</option>');
    $('pcSecFolgen').innerHTML = '<div class="card pc-folgen"><div class="pc-row pc-fsel">' +
      '<label class="field"><span>Folge</span><select id="pcProg" aria-label="Folge">' + PROGS.map(p => '<option value="' + p.id + '">' + p.name + ' · ' + p.label + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Tonart (Grundton)</span><select id="pcKey" aria-label="Tonart">' + keys.join('') + '</select></label>' +
      '<div class="field"><span>Griff-Saite</span>' + segHtml('pcMode', [['auto', 'Auto'], [0, 'E'], [1, 'A'], [2, 'D']], U.f.mode, 'Griff-Saite') + '</div>' +
      '<div class="field"><span>Töne</span>' + segHtml('pcFN', [[2, '2-Ton'], [3, '3-Ton']], U.f.n, 'Töne') + '</div></div>' +
      '<div class="pc-row pc-fsel"><div class="field"><span>Tempo</span><div class="pc-bpm"><button class="toggle-btn" id="pcBpmD" aria-label="Tempo −5">−5</button><b id="pcBpmV"></b><span class="caption">BPM</span><button class="toggle-btn" id="pcBpmU" aria-label="Tempo +5">+5</button><input type="range" id="pcBpm" min="40" max="200" step="1" aria-label="Tempo"></div></div>' +
      '<label class="field"><span>Begleitung</span><select id="pcDrums" aria-label="Begleitung"><option value="drums">Drums</option><option value="click">Klick</option><option value="none">nur Akkorde</option></select></label></div>' +
      '<div class="pc-fnames" id="pcFNames" translate="no"></div><div class="pc-path" id="pcPath"></div>' +
      '<div class="pc-row pc-acts"><button class="toggle-btn active" id="pcGo">▶ Loop starten</button><button class="toggle-btn" id="pcSend">An Looper senden</button><button class="toggle-btn" id="pcJam">Als Backing abspielen</button></div>' +
      '<p class="caption">„Loop starten“ legt die Folge mit Powerchord-Klang und Drums auf Spur 1 des Loopers – Spur 2 und 3 bleiben frei zum Aufnehmen. Tippe einen Akkord an, um ihn im Griffbrett zu sehen.</p>' +
      '<div class="pc-chords" id="pcChords"></div></div>';
    $('pcSecFolgen').appendChild($('pcProgTpl').content.cloneNode(true));
    $('pcProg').value = U.f.prog; $('pcKey').value = U.f.key; $('pcDrums').value = U.f.drums;
    $('pcProg').addEventListener('change', e => { U.f.prog = e.target.value; renderProg(); });
    $('pcKey').addEventListener('change', e => { U.f.key = +e.target.value; renderProg(); });
    $('pcDrums').addEventListener('change', e => { U.f.drums = e.target.value; saveUi(); });
    onSeg('pcMode', v => { U.f.mode = v === 'auto' ? 'auto' : +v; renderProg(); });
    onSeg('pcFN', v => { U.f.n = +v; renderProg(); });
    const setB = v => { U.f.bpm = Math.max(40, Math.min(200, Math.round(v))); paintBpm(); saveUi(); };
    $('pcBpm').addEventListener('input', e => setB(+e.target.value));
    $('pcBpmD').addEventListener('click', () => setB(U.f.bpm - 5)); $('pcBpmU').addEventListener('click', () => setB(U.f.bpm + 5));
    $('pcChords').addEventListener('click', e => { const el = e.target.closest('[data-i]'); if (el && cur) goBoard(cur.chords[+el.dataset.i], U.f.n); });
    $('pcGo').addEventListener('click', () => startProg('loop'));
    $('pcSend').addEventListener('click', () => startProg('send'));
    $('pcJam').addEventListener('click', () => startProg('jam'));
    paintBpm(); renderProg();
  }
  function paintBpm() { if (!$('pcBpmV')) return; $('pcBpmV').textContent = U.f.bpm; $('pcBpm').value = U.f.bpm; }
  function renderProg() {
    if (!$('pcChords')) return; saveUi();
    setSeg('pcMode', U.f.mode); setSeg('pcFN', U.f.n);
    cur = prog(U.f.prog, U.f.key, U.f.mode, U.f.n);
    $('pcFNames').textContent = cur.chords.map(c => c.name).join(' – ');
    $('pcPath').textContent = (U.f.mode === 'auto' ? 'Auto: ' + cur.chords.map(c => c.name + ' auf ' + sname(c.rootString) + '-Saite').join(', ') + ' · ' : '') + 'Weg: ' + cur.path + (cur.path === 1 ? ' Bund' : ' Bünde');
    $('pcChords').innerHTML = cur.chords.map((c, i) => '<button class="pc-chord" data-i="' + i + '"><span class="pc-deg" translate="no">' + c.degree + '</span><b translate="no">' + c.name + '</b><span class="pc-where">' + sname(c.rootString) + '-Saite · Bund ' + c.rootFret + (c.warn ? ' ⚠' : '') + '</span><span class="pc-mini"></span></button>').join('');
    cur.chords.forEach((c, i) => { const el = $('pcChords').querySelectorAll('.pc-mini')[i], fs = c.tones.map(t => t.f), a = Math.max(0, Math.min(...fs) - 1); board(el, { mini: true, from: a, to: Math.max(a + 4, Math.max(...fs)), marks: chordMarks(c, 'num'), muted: [0, 1, 2, 3, 4, 5].filter(s => !c.tones.some(t => t.s === s)) }); });
    paintNow(true);
  }

  // ===== Übungen =====
  function exSeq(x) {
    if (x.rnd) {                                                     // Übung 3: vier zufällige Grundtöne auf E- und A-Saite
      const out = []; for (let i = 0; i < 4; i++) { const s = Math.random() < 0.5 ? 0 : 1, f = Math.floor(Math.random() * 12); out.push({ pc: md(OPEN[s] + f), s, rn: keyName(md(OPEN[s] + f)) }); }
      return place(out, 'auto', x.n);
    }
    if (x.seq) return place(x.seq.map(([pc, s]) => ({ pc, s, rn: keyName(pc) })), 'auto', x.n);
    const p = prog(x.progression, KEYPC[x.key], 'auto', x.n);
    if (x.pre) { const pre = place(x.pre.map(pc => ({ pc, rn: keyName(pc), degree: 'I' })), 'auto', x.n); p.chords = pre.chords.concat(p.chords); }
    if (x.twice) { const a = [], P = PROGS.find(q => q.id === x.progression), kp = KEYPC[x.key], kn = keyName(kp);
      x.twice.forEach(s => P.degrees.forEach(d => { const pc = md(kp + DEG[d]); a.push({ degree: d, pc, s, rn: spellRel(pc, kn, DSTEP[d], false) }); }));
      const r = place(a, 'auto', x.n); p.chords = r.chords; p.path = r.path; }
    return p;
  }
  function buildEx() {
    $('pcSecUebungen').innerHTML = '<div class="card pc-exhead"><div class="pc-row"><b id="pcExSum"></b><button class="toggle-btn" id="pcExReset">Zurücksetzen</button></div><div class="pc-bar"><i id="pcExBar"></i></div>' +
      '<p class="caption">Ein Häkchen setzt du, wenn du die Übung beim Zieltempo drei Mal fehlerfrei und sauber gespielt hast. Erhöhe in 5er-Schritten.</p></div><div id="pcExList"></div>';
    $('pcExReset').addEventListener('click', () => { if (!confirm(TT('Fortschritt aller Übungen zurücksetzen?'))) return; const kk = PR.kurs; try { localStorage.removeItem(PKEY); } catch (e) {} PR = loadProg(); if (kk) PR.kurs = kk; saveProg(); renderEx(); });
    $('pcExList').addEventListener('click', e => {
      const b = e.target.closest('button[data-a]'); if (!b) return; const x = EXS.find(q => q.id === b.dataset.x), st = PR.exercises[x.id];
      if (b.dataset.a === 'go') { startEx(x); return; }
      if (b.dataset.a === 'd') st.bpm = Math.max(40, st.bpm - 5);
      if (b.dataset.a === 'u') st.bpm = Math.min(200, st.bpm + 5);
      if (b.dataset.a === 'best') st.bestBpm = Math.max(st.bestBpm || 0, st.bpm);
      saveProg(); renderEx();
      if ((b.dataset.a === 'd' || b.dataset.a === 'u') && play && play.ex === x.id) retempo(st.bpm);
    });
    $('pcExList').addEventListener('change', e => { const c = e.target.closest('input[data-x]'); if (!c) return; PR.exercises[c.dataset.x].done = c.checked; saveProg(); renderEx(); });
    renderEx();
  }
  function renderEx() {
    if (!$('pcExList')) return;
    const done = EXS.filter(x => PR.exercises[x.id].done).length;
    $('pcExSum').textContent = done + ' von ' + EXS.length + ' geschafft'; $('pcExBar').style.width = (100 * done / EXS.length) + '%';
    $('pcExList').innerHTML = EXS.map((x, i) => { const st = PR.exercises[x.id];
      return '<div class="card pc-ex' + (st.done ? ' done' : '') + (play && play.ex === x.id ? ' now' : '') + '" id="pcEx_' + x.id + '"><div class="pc-row"><span class="pc-exn">' + (i + 1) + '</span><h3 translate="no">' + x.title + '</h3>' +
        '<label class="check pc-done"><input type="checkbox" data-x="' + x.id + '"' + (st.done ? ' checked' : '') + '> geschafft</label></div>' +
        '<p translate="no">' + x.d + '</p><div class="pc-row pc-exctl"><span class="caption">Start ' + x.bpmStart + ' → Ziel ' + x.bpmTarget + ' BPM</span>' +
        '<span class="pc-bpm"><button class="toggle-btn" data-a="d" data-x="' + x.id + '" aria-label="Tempo −5">−5</button><b>' + st.bpm + '</b><span class="caption">BPM</span><button class="toggle-btn" data-a="u" data-x="' + x.id + '" aria-label="Tempo +5">Tempo +5</button></span>' +
        '<button class="toggle-btn active" data-a="go" data-x="' + x.id + '">▶ Mit Looper starten</button><button class="toggle-btn" data-a="best" data-x="' + x.id + '">Tempo geschafft</button>' +
        '<span class="caption pc-best">' + (st.bestBpm ? 'Bestes Tempo: ' + st.bestBpm + ' BPM' : 'Noch kein Tempo gemerkt') + '</span></div></div>'; }).join('');
  }

  // ===== Üben: Loop im Looper oder Backing Track, Anzeige „jetzt / als Nächstes“ =====
  let play = null, ownL = 0, poll = null;
  function setBpm(v) { const el = $('bpm'); if (!el) return; el.value = v; el.dispatchEvent(new Event('input')); }
  function looperForeign() {
    try { const tr = Looper._prac().tracks; return tr.some((t, i) => t.L && !(i === 0 && t.L === ownL)); } catch (e) { return false; }
  }
  function stopAll(quiet) {
    if (!play) return;
    const p = play; play = null; clearInterval(poll); poll = null;
    try { if (p.mode === 'jam') { if (window.Jam) Jam.stop(); } else if (typeof Looper !== 'undefined') Looper.stopAll(); } catch (e) {}
    paintPlay(); paintNow(true); renderEx();
  }
  // r = { chords, path, prog?, keyPc?, keyName? }
  function begin(r, o) {
    const n = o.n, bpm = Math.max(40, Math.min(200, o.bpm | 0)), bars = r.chords.length;
    const pay = handoff(r, bpm, n);
    if (o.how === 'jam') {
      if (!window.Jam) return false;
      if (play && play.mode === 'looper') stopAll(true);
      try { if (typeof Looper !== 'undefined' && Looper.busy()) Looper.stopAll(); } catch (e) {}
      const st = Jam.state(); st.key = { pc: r.keyPc != null ? r.keyPc : r.chords[0].rootPc, major: false };
      Jam.setSeq(r.chords.map(c => c.name + ':1').join(' '));
      setBpm(bpm); Jam.stop(); Jam.start();
      play = { mode: 'jam', r, n, bpm, ex: o.ex || null, label: o.label, hide: !!o.hide, pay, idx: -1 };
    } else {
      if (typeof Looper === 'undefined' || !Looper.loadSamples) return false;
      if (looperForeign() && !confirm(TT('Im Looper sind schon Aufnahmen. Durch den Übe-Loop ersetzen?'))) return false;
      if (play && play.mode === 'jam') stopAll(true);
      try { if (window.Jam && Jam.debug && Jam.debug()) Jam.stop(); } catch (e) {}
      setBpm(bpm); ensureAudio();
      const data = renderBacking(r.chords.map(c => ({ tones: c.tones, bars: 1 })), bpm, { drums: o.drums, pm: o.pm, dyn: o.dyn });
      Looper.loadSamples(data); ownL = data.length;
      try { Looper.setSrcName('Powerchords ' + r.chords.map(c => c.name).join(' ')); } catch (e) {}
      const bs = $('loopBars'); if (bs && [...bs.options].some(op => op.value === String(bars))) { bs.value = String(bars); bs.dispatchEvent(new Event('change')); }
      const ls = $('loopStatus'); if (ls) ls.textContent = TT('Powerchords: ') + r.chords.map(c => c.name).join(' – ') + ' · ' + bpm + ' BPM';
      play = { mode: 'looper', r, n, bpm, ex: o.ex || null, label: o.label, hide: !!o.hide, pay, idx: -1, o };
    }
    window.__pcHandoff = pay;
    try { document.dispatchEvent(new CustomEvent('powerchords-handoff', { detail: pay })); } catch (e) {}
    clearInterval(poll); poll = setInterval(tick, 90);
    paintPlay(); renderEx();
    return true;
  }
  function startProg(how) {
    const r = cur || prog(U.f.prog, U.f.key, U.f.mode, U.f.n);
    const ok = begin(r, { how: how === 'jam' ? 'jam' : 'looper', n: U.f.n, bpm: U.f.bpm, drums: U.f.drums, label: r.prog.name + ' in ' + r.keyName });
    if (ok && how === 'send') { const t = $('tab-looper'); if (t) t.click(); }
  }
  function startEx(x) {
    const st = PR.exercises[x.id], r = exSeq(x);
    begin(r, { how: 'looper', n: x.n, bpm: st.bpm, drums: x.drums || 'drums', pm: x.pm, dyn: x.dyn, ex: x.id, label: 'Übung ' + (EXS.indexOf(x) + 1) + ' · ' + x.title, hide: !!x.rnd });
  }
  function retempo(v) {
    if (!play) return; v = Math.max(40, Math.min(200, v));
    if (play.ex) { PR.exercises[play.ex].bpm = v; saveProg(); renderEx(); }
    if (play.mode === 'jam') { play.bpm = v; setBpm(v); play.pay.bpm = v; paintPlay(); return; }
    const p = play; begin(p.r, Object.assign({}, p.o || {}, { how: 'looper', n: p.n, bpm: v, ex: p.ex, label: p.label, hide: p.hide }));
  }
  function nowIdx() {
    if (!play) return null;
    if (play.mode === 'jam') {
      if (!window.Jam) return null;
      if (!Jam.active()) return Jam.debug && Jam.debug() ? { idx: -1, beat: -1 } : null;
      const ci = Jam.chordInfo(); if (!ci || ci.pos == null) return { idx: -1, beat: -1 };
      const i = ci.segs.findIndex(s => ci.pos >= s.a && ci.pos < s.e); return { idx: Math.max(0, i), beat: Math.floor(ci.pos / 1000) % 4 };
    }
    if (typeof Looper === 'undefined' || !Looper.busy()) return null;
    try { const tr = Looper._prac().tracks; if (!tr[0] || tr[0].L !== ownL) return null; } catch (e) {}
    const ps = Looper.position(); if (!ps || !ps.text) return { idx: -1, beat: -1 };
    const m = /^(\d+)\.(\d+)$/.exec(ps.text); if (!m) return { idx: -1, beat: -1 };
    return { idx: Math.min(play.r.chords.length - 1, (+m[1] - 1)), beat: +m[2] - 1 };
  }
  let lastKey = '', hid = 0;
  function tick() {
    if (!play) return;
    if (panel.hidden && ++hid % 11) return;                       // anderer Reiter: nur selten nachsehen
    const n = nowIdx();
    if (!n) { stopAll(true); return; }
    if (panel.hidden) return;
    const k = n.idx + ':' + n.beat; if (k === lastKey) return; lastKey = k;
    play.idx = n.idx; paintNow(false, n);
  }
  function paintPlay() {
    const el = $('pcPlay'); if (!el || !built) return;
    if (!play) { el.hidden = true; el.innerHTML = ''; lastKey = ''; return; }
    el.hidden = false;
    el.innerHTML = '<div class="pc-row pc-playhead"><span class="caption" translate="no">' + (play.label || '') + '</span><span class="caption">' + (play.mode === 'jam' ? 'Backing Track' : 'Loop im Looper (Spur 1)') + '</span></div>' +
      '<div class="pc-nowrow"><div class="pc-now"><span class="lbl">jetzt</span><b id="pcNow" translate="no">–</b><span class="pc-where" id="pcNowW"></span></div><div class="pc-next"><span class="lbl">als Nächstes</span><b id="pcNext" translate="no">–</b></div>' +
      '<div class="pc-beats" id="pcBeats"><i></i><i></i><i></i><i></i></div></div>' +
      '<div class="pc-bwrap" id="pcPlayBoard"></div>' +
      '<div class="pc-row pc-acts"><button class="toggle-btn" id="pcStop">■ Stopp</button><button class="toggle-btn" id="pcTD" aria-label="Tempo −5">−5</button><b class="pc-pbpm">' + play.bpm + ' BPM</b><button class="toggle-btn" id="pcTU">Tempo +5</button>' +
      (play.mode === 'looper' ? '<button class="toggle-btn" id="pcRec">● Spur 2 aufnehmen</button><button class="toggle-btn" id="pcToL">Zum Looper</button>' : '') + '</div>';
    $('pcStop').addEventListener('click', () => stopAll());
    $('pcTD').addEventListener('click', () => retempo(play.bpm - 5)); $('pcTU').addEventListener('click', () => retempo(play.bpm + 5));
    if ($('pcRec')) $('pcRec').addEventListener('click', () => { try { Looper.foot(1); } catch (e) {} });
    if ($('pcToL')) $('pcToL').addEventListener('click', () => { const t = $('tab-looper'); if (t) t.click(); });
    lastKey = ''; paintNow(false, { idx: -1, beat: -1 });
  }
  function paintNow(onlyList, n) {
    if (!built) return;
    const pid = play && play.r === cur ? play.idx : -1;
    document.querySelectorAll('#pcChords .pc-chord').forEach((b, i) => b.classList.toggle('now', pid === i));
    if (onlyList || !play || !$('pcNow')) return;
    const ch = play.r.chords, i = n && n.idx >= 0 ? n.idx : -1, c = i >= 0 ? ch[i] : null, nx = ch[(i + 1) % ch.length];
    const hideName = play.hide && n && n.beat < 2;                    // Übung 3: Name erst ab Zählzeit 3
    $('pcNow').textContent = c ? (hideName ? '?' : c.name) : '…';
    $('pcNowW').textContent = c ? sname(c.rootString) + '-Saite · Bund ' + c.rootFret : 'Einzählen …';
    $('pcNext').textContent = i >= 0 ? (play.hide ? '?' : nx.name) : ch[0].name;
    document.querySelectorAll('#pcBeats i').forEach((d, k) => d.classList.toggle('on', n && k === n.beat));
    const show = c || ch[0];
    board($('pcPlayBoard'), { marks: chordMarks(show, U.b.lab), muted: [0, 1, 2, 3, 4, 5].filter(s => !show.tones.some(t => t.s === s)), tap: tapPlay });
  }

  document.addEventListener('tabchange', e => {
    if (e.detail === 'power') { build(); if (play && !poll) poll = setInterval(tick, 90); paintPlay(); }
    else stepStop();
  });
  if (!panel.hidden) build();

  // Schnittstelle für Tests und andere Reiter
  window.Powerchords = { calc, prog, place, positions, keyName, spellRel, handoff, tabText, toneLine, renderBacking, options,
    data: { SHAPES, PROGS, EXS, OPEN, DEG }, progress: () => JSON.parse(JSON.stringify(PR)), kurs: () => Object.assign({}, PR.kurs || {}), ui: () => JSON.parse(JSON.stringify(U)),
    build, showSec, startProg, startEx: id => startEx(EXS.find(x => x.id === id)), stop: () => stopAll(), retempo: v => retempo(v), playing: () => play ? { mode: play.mode, bpm: play.bpm, idx: play.idx, ex: play.ex, names: play.r.chords.map(c => c.name), L: ownL } : null,
    exSeq: id => exSeq(EXS.find(x => x.id === id)) };
})();
