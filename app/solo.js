// ---- Solo Finder: was passt über den gerade klingenden Akkord? ----
// Oben die Akkordfolge des Loops (klingender Akkord eingerahmt), darunter Tonart, mögliche Akkorde,
// passende Tonleitern (Kirchentonleitern, Pentatonik, Blues, Akkordtöne) mit Griffbild, Wechsel zum
// nächsten Akkord (gemeinsame Töne, Leittöne) und ein Ideen-Würfel.
(function () {
  const $ = id => document.getElementById(id);
  const panel = $('panel-solo');
  if (!panel) return;
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const md = x => ((x % 12) + 12) % 12;
  const CH = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7],
    dim: [0, 3, 6], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 2, 4, 7], m9: [0, 2, 3, 7, 10], maj9: [0, 2, 4, 7, 11], '9': [0, 2, 4, 7, 10], m11: [0, 3, 5, 7, 10], m7b5: [0, 3, 6, 10] };
  const SUF = { dim: '°', m7b5: 'm7♭5' };
  const SC = {
    ion: { n: 'Ionisch', iv: [0, 2, 4, 5, 7, 9, 11], ch: 11, mood: 'Hell und klar – Dur pur. Die große Septime ist der Charakterton.', mode: 'Ionisch (Dur)' },
    dor: { n: 'Dorisch', iv: [0, 2, 3, 5, 7, 9, 10], ch: 9, mood: 'Moll mit Licht: funky, Santana, Jazz. Die große Sexte macht den Unterschied.', mode: 'Dorisch' },
    phr: { n: 'Phrygisch', iv: [0, 1, 3, 5, 7, 8, 10], ch: 1, mood: 'Dunkel, spanisch, Metal. Die kleine Sekunde direkt über dem Grundton.', mode: 'Phrygisch' },
    lyd: { n: 'Lydisch', iv: [0, 2, 4, 6, 7, 9, 11], ch: 6, mood: 'Schwebend, filmisch, verträumt (Satriani, Vai). Die übermäßige Quarte glitzert.', mode: 'Lydisch' },
    mix: { n: 'Mixolydisch', iv: [0, 2, 4, 5, 7, 9, 10], ch: 10, mood: 'Rock, Blues-Rock, Country. Dur mit kleiner Septime – lässig.', mode: 'Mixolydisch' },
    aeo: { n: 'Äolisch', iv: [0, 2, 3, 5, 7, 8, 10], ch: 8, mood: 'Natürliches Moll: traurig, episch, Rockballade. Die kleine Sexte färbt.', mode: 'Äolisch (Moll)' },
    loc: { n: 'Lokrisch', iv: [0, 1, 3, 5, 6, 8, 10], ch: 6, mood: 'Instabil, verminderter Klang – will sich auflösen.', mode: 'Lokrisch' },
    pmaj: { n: 'Dur-Pentatonik', iv: [0, 2, 4, 7, 9], mood: 'Singend und offen: Country, Southern Rock, Melodien zum Mitsingen.' },
    pmin: { n: 'Moll-Pentatonik', iv: [0, 3, 5, 7, 10], mood: 'Der Rock-Standard: sicher, kraftvoll, perfekt für Bendings.' },
    blues: { n: 'Blues-Tonleiter', iv: [0, 3, 5, 6, 7, 10], ch: 6, mood: 'Moll-Pentatonik plus Blue Note (♭5) – dreckig, nur kurz berühren.' },
    dblues: { n: 'Dur-Blues', iv: [0, 2, 3, 4, 7, 9], ch: 3, mood: 'Dur-Pentatonik plus kleine Terz – B.B. King, Allman Brothers. Kleine Terz zur großen hochziehen.' },
    hm: { n: 'Harmonisch Moll', iv: [0, 2, 3, 5, 7, 8, 11], ch: 11, mood: 'Klassisch und dramatisch, neoklassischer Metal. Der Leitton zieht zum Grundton.' },
    pd: { n: 'Phrygisch-Dominant', iv: [0, 1, 4, 5, 7, 8, 10], ch: 1, mood: 'Orientalisch, Flamenco, Malmsteen – passt auf die Dur-Dominante in Moll.' },
    mel: { n: 'Melodisch Moll', iv: [0, 2, 3, 5, 7, 9, 11], ch: 11, mood: 'Jazzig-elegant: Moll mit großer Sexte und Septime.' },
    arp: { n: 'Akkordtöne', iv: null, mood: 'Zieltöne: Phrasen hier enden lassen – dann klingt alles „richtig“.' }
  };
  const MODES = ['ion', 'dor', 'phr', 'lyd', 'mix', 'aeo', 'loc'];
  const MAJ = [0, 2, 4, 5, 7, 9, 11];
  const IVN = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const IVLONG = ['Grundton', 'kleine Sekunde', 'große Sekunde', 'kleine Terz', 'große Terz', 'Quarte', 'übermäßige Quarte / ♭5', 'Quinte', 'kleine Sexte', 'große Sexte', 'kleine Septime', 'große Septime'];

  let state = { track: null, follow: true, focus: null, keyOv: 'auto', scale: null, idea: 0, sig: '', neck: 'scale', gripC: null, gripI: 0, ctx: null };
  // ---- Hilfen ----
  function parseChord(name) {
    const m = /^([A-G]#?)(.*)$/.exec(name || ''); if (!m) return null;
    const t = CH[m[2]] ? m[2] : '';
    return { r: PC[m[1]], t, iv: CH[t] };
  }
  const parentMajor = k => k.major ? k.pc : md(k.pc + 3);
  const flats = k => [5, 10, 3, 8, 1].includes(parentMajor(k));
  const nn = (pc, k) => (k && flats(k) ? FLAT : SHARP)[md(pc)];
  const chordName = (c, k) => nn(c.r, k) + (SUF[c.t] != null ? SUF[c.t] : c.t);
  const keyLabel = k => nn(k.pc, k) + (k.major ? '-Dur' : '-Moll');
  const qual = t => /^(m|m7|m6|m9|m11)$/.test(t) ? 'm' : /^(dim|m7b5)$/.test(t) ? 'd' : /^(sus|5)/.test(t) ? '*' : 'M';
  const keyPcs = k => MAJ.map(x => md(parentMajor(k) + x));
  // Stufe des Akkords in der Tonart (römisch), bei Fremdakkorden mit ♭/♯
  function roman(c, k) {
    const rel = md(c.r - k.pc), q = qual(c.t);
    const ref = k.major ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
    const base = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    let d = ref.indexOf(rel), acc = '';
    if (d < 0) { d = ref.indexOf(md(rel + 1)); acc = '♭'; if (d <= 0) { d = ref.indexOf(md(rel - 1)); acc = '♯'; } }
    if (d < 0) return '?';
    let s = base[d]; if (q === 'm' || q === 'd') s = s.toLowerCase();
    return acc + s + (q === 'd' ? '°' : '') + (/7/.test(c.t) && c.t !== 'm7b5' ? '7' : '');
  }
  function func(c, k) {
    const rel = md(c.r - k.pc);
    if (rel === 0) return 'Tonika';
    if (rel === 7 || rel === 11 || (rel === 10 && !k.major)) return 'Dominante';
    if (rel === 5 || rel === 2) return 'Subdominante';
    if (k.major ? rel === 9 || rel === 4 : rel === 3 || rel === 8) return 'Tonika-Vertreter';
    return '';
  }

  // ---- Tonleitern zum Akkord ----
  function suggestions(c, k) {
    const kp = keyPcs(k), ct = c.iv.map(x => md(c.r + x)), out = [];
    const inKey = p => kp.includes(p);
    const add = (id, root, tag, why) => {
      const sc = SC[id], iv = sc.iv || c.iv, pcs = iv.map(x => md(root + x));
      if (out.some(o => o.id === id && o.root === root)) return;
      out.push({ id, root, tag, why, pcs, iv, outside: pcs.filter(p => !inKey(p)), ch: sc.ch != null ? md(root + sc.ch) : null });
    };
    // 1) Kirchentonleiter (oder Moll-Variante) auf dem Akkordgrundton, die alle Akkordtöne enthält und am besten zur Tonart passt
    const cand = MODES.concat(['hm', 'pd', 'mel']).map(id => {
      const pcs = SC[id].iv.map(x => md(c.r + x));
      if (!ct.every(p => pcs.includes(p))) return null;
      const fit = pcs.filter(inKey).length;
      return { id, fit, pref: MODES.includes(id) ? 0.5 : 0 };
    }).filter(Boolean).sort((a, b) => (b.fit + b.pref) - (a.fit + a.pref));
    if (cand.length) {
      const best = cand[0];
      add(best.id, c.r, best.fit === 7 ? 'Passt genau' : 'Beste Wahl', best.fit === 7 ? 'Alle Töne gehören zur Tonart – die Kirchentonleiter dieser Stufe.' : 'Der Akkord liegt außerhalb der Tonart – diese Tonleiter verbindet beides.');
    }
    // 2) Pentatonik über den Akkord
    const q = qual(c.t);
    const pid = q === 'm' || q === 'd' ? 'pmin' : q === 'M' ? 'pmaj' : (inKey(md(c.r + 3)) ? 'pmin' : 'pmaj');
    add(pid, c.r, 'Pentatonik', 'Fünf Töne, kein „falscher“ – über genau diesen Akkord.');
    // 3) Pentatonik der Tonart (über den ganzen Loop)
    add(k.major ? 'pmaj' : 'pmin', k.pc, 'Ganzer Loop', 'Läuft über alle Akkorde der Tonart' + (k.major ? ' (gleiche Töne wie die Moll-Pentatonik von ' + nn(k.pc + 9, k) + ')' : '') + '.');
    // 4) Blues
    add(k.major ? 'dblues' : 'blues', k.pc, 'Blues', k.major ? 'Dur-Blues der Tonart – mit der kleinen Terz als Würze.' : 'Blues-Tonleiter der Tonart – die ♭5 nur im Vorbeigehen.');
    // 5) Akkordtöne
    add('arp', c.r, 'Zieltöne', 'Diese Töne klingen auf jeder Zählzeit – ideal für Phrasenenden und Bendings.');
    // 6) Spannung: Dur-Dominante in Moll
    if (!k.major && md(c.r - k.pc) === 7 && q === 'M') { add('pd', c.r, 'Spannung', 'Die Dur-Dominante zieht zurück zur Tonika – Phrygisch-Dominant betont das.'); add('hm', k.pc, 'Spannung', 'Harmonisch Moll der Tonart: der Leitton ' + nn(k.pc + 11, k) + ' führt nach ' + nn(k.pc, k) + '.'); }
    // 7) Mutig: nächstbeste Kirchentonleiter mit genau einem Ton außerhalb der Tonart
    const bold = cand.find((x, i) => i > 0 && MODES.includes(x.id) && x.fit === 6);
    if (bold) add(bold.id, c.r, 'Mutig', 'Ein Ton außerhalb der Tonart – bewusst eingesetzt klingt er frisch statt falsch.');
    return out;
  }
  // Färbungen des Akkords, deren Zusatztöne in der passenden Tonleiter liegen
  function colorings(c, scalePcs) {
    const q = qual(c.t), opts = q === 'M' ? ['maj7', '7', '6', 'add9', 'maj9', '9', 'sus2', 'sus4'] : q === 'm' ? ['m7', 'm6', 'm9', 'm11', 'sus2', 'sus4'] : q === 'd' ? ['m7b5', 'dim'] : ['sus2', 'sus4', '', 'm'];
    return opts.filter(t => t !== c.t && CH[t].every(x => scalePcs.includes(md(c.r + x)))).slice(0, 5).map(t => ({ r: c.r, t, iv: CH[t] }));
  }
  // diatonische Akkorde der Tonart
  function diatonic(k) {
    const iv = k.major ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
    const qs = k.major ? ['', 'm', 'm', '', '', 'm', 'dim'] : ['m', 'dim', '', 'm', 'm', '', ''];
    const list = iv.map((x, i) => ({ r: md(k.pc + x), t: qs[i], iv: CH[qs[i]] }));
    if (!k.major) list.push({ r: md(k.pc + 7), t: '7', iv: CH['7'], extra: 'harm.' });
    return list;
  }
  const NEXT = { maj: { 0: [5, 7, 9], 2: [7], 4: [9, 5], 5: [7, 0, 2], 7: [0, 9], 9: [5, 2, 7], 11: [0] }, min: { 0: [5, 8, 10], 2: [7], 3: [8, 5], 5: [7, 0, 10], 7: [0, 8], 8: [10, 5, 3], 10: [0, 3] } };

  // ---- Daten aus Looper / Griffbrett ----
  function boardKey() {
    if (typeof rootSel === 'undefined') return { pc: 9, major: false };
    const pc = PC[rootSel.value] != null ? PC[rootSel.value] : 0, m = modeSel.value;
    const off = { 'Ionisch (Dur)': 0, 'Dorisch': 2, 'Phrygisch': 4, 'Lydisch': 5, 'Mixolydisch': 7, 'Äolisch (Moll)': 9, 'Lokrisch': 11 }[m] || 0;
    if (m === 'Äolisch (Moll)') return { pc, major: false };
    if (m === 'Dorisch' || m === 'Phrygisch') return { pc, major: false };
    return { pc: md(pc - off), major: true };
  }
  function info() {
    const L = typeof Looper !== 'undefined' && Looper.chordInfo ? Looper.chordInfo(state.track) : { tracks: [], track: -1 };
    // Läuft der Jam (und kein Loop), zeigt der Solo Finder dessen Akkordfolge
    if (window.Jam && Jam.active() && !(L && L.playing)) { const j = Jam.chordInfo(); if (j) { j.tracks = L.tracks || []; return j; } }
    if (window.Lied && Lied.active() && !(L && L.playing)) { const j = Lied.chordInfo(); if (j) { j.tracks = L.tracks || []; return j; } }
    return L;
  }
  function currentKey(ci) {
    if (state.keyOv !== 'auto') { const [p, m] = state.keyOv.split(':'); return { k: { pc: +p, major: m === 'M' }, src: 'manuell' }; }
    if (ci && ci.key) return { k: ci.key, src: ci.lied ? 'aus dem Song' : ci.jam ? 'aus dem Backing Track' : 'erkannt in Spur ' + (ci.track + 1) };
    return { k: boardKey(), src: 'vom Griffbrett' };
  }
  const segAt = (ci, f) => { if (!ci.segs) return -1; for (let i = 0; i < ci.segs.length; i++) if (f >= ci.segs[i].a && f < ci.segs[i].e) return i; return -1; };

  // ---- Akkordleiste ----
  let bandSig = '', lastOn = -1;
  function renderBand(ci, k) {
    const band = $('sfBand'), strip = $('sfStrip');
    if (!ci.segs) {
      if (bandSig !== 'none') { strip.innerHTML = '<div class="sf-empty">Noch keine Akkorde – lade im Looper eine Datei oder spiel etwas ein. Bis dahin: Tonart wählen und unten einen Akkord antippen.</div>'; strip.style.width = ''; bandSig = 'none'; }
      $('sfHead').hidden = true; return;
    }
    const sig = ci.track + '|' + ci.L + '|' + ci.segs.map(s => s.name + s.a).join(',') + '|' + ci.downs.join(',') + '|' + k.pc + k.major + '|' + band.clientWidth;
    if (sig === bandSig) return;
    bandSig = sig;
    const bars = Math.max(1, ci.downs.length);
    const W = Math.max(band.clientWidth - 2, bars * 92), px = f => f / ci.L * W;
    strip.style.width = W + 'px';
    let h = '';
    ci.downs.forEach((d, i) => { h += '<div class="sf-bar" style="left:' + px(d).toFixed(1) + 'px"><span>' + (i + 1) + '</span></div>'; });
    ci.segs.forEach((s, i) => {
      const c = parseChord(s.name), w = px(s.e - s.a);
      if (!c) { h += '<div class="sf-seg rest" data-i="' + i + '" style="left:' + px(s.a).toFixed(1) + 'px;width:' + w.toFixed(1) + 'px"></div>'; return; }
      h += '<button class="sf-seg' + (w < 54 ? ' tight' : '') + '" data-i="' + i + '" style="left:' + px(s.a).toFixed(1) + 'px;width:' + w.toFixed(1) + 'px"><b>' + chordName(c, k) + '</b><small>' + roman(c, k) + '</small></button>';
    });
    h += '<div class="sf-ph" id="sfPh"></div>';
    strip.innerHTML = h; lastOn = -2;          // neu aufgebaut: Einrahmung beim nächsten Bild neu setzen
    $('sfHead').hidden = false;
  }
  function tickBand(ci) {
    const ph = $('sfPh'); if (!ph || !ci.segs) return -1;
    const W = parseFloat($('sfStrip').style.width) || 1;
    const i = ci.pos != null ? segAt(ci, ci.pos) : -1;
    ph.style.display = ci.pos != null ? '' : 'none';
    if (ci.pos != null) {
      const x = ci.pos / ci.L * W; ph.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      const band = $('sfBand');
      if (x < band.scrollLeft + 40 || x > band.scrollLeft + band.clientWidth - 80) band.scrollLeft = Math.max(0, x - band.clientWidth * 0.3);
    }
    if (i !== lastOn) {
      const segs = $('sfStrip').querySelectorAll('.sf-seg');
      segs.forEach(b => b.classList.toggle('on', +b.dataset.i === i));
      lastOn = i;
    }
    return i;
  }

  // ---- Fokus-Bereiche ----
  function chordBtn(c, k, cls, extra) {
    return '<button class="sf-ch ' + (cls || '') + '" data-r="' + c.r + '" data-t="' + c.t + '"><small>' + (extra || roman(c, k)) + '</small><b>' + chordName(c, k) + '</b></button>';
  }
  function renderFocus(ci, k, keySrc) {
    const f = state.focus;
    // Tonart
    $('sfKey').textContent = keyLabel(k);
    $('sfKeySrc').textContent = keySrc;
    $('sfKeyNotes').textContent = keyPcs(k).map(p => p).sort((a, b) => md(a - k.pc) - md(b - k.pc)).map(p => nn(p, k)).join(' ');
    const c = f ? f.c : null;
    if (!c) { $('sfNow').innerHTML = ''; return; }
    $('sfNow').innerHTML = '<span class="sf-now-l">' + (f.live ? 'Klingt jetzt' : 'Ausgewählt') + '</span><b>' + chordName(c, k) + '</b><span class="sf-now-r">' + roman(c, k) + (func(c, k) ? ' · ' + func(c, k) : '') + '</span><span class="sf-now-t">Akkordtöne: ' + c.iv.map(x => nn(c.r + x, k) + '<sub>' + IVN[x % 12] + '</sub>').join(' ') + '</span>';
    // mögliche Akkorde
    const dia = diatonic(k), inLoop = new Set((ci.segs || []).map(s => s.name).filter(n => n !== '–').map(n => { const p = parseChord(n); return p ? p.r + '|' + qual(p.t) : ''; }));
    const nx = (NEXT[k.major ? 'maj' : 'min'][md(c.r - k.pc)] || []).map(x => md(k.pc + x));
    $('sfDia').innerHTML = dia.map(d => {
      const cls = [(d.r === c.r && qual(d.t) === qual(c.t)) ? 'cur' : '', nx.includes(d.r) && !d.extra ? 'nx' : '', inLoop.has(d.r + '|' + qual(d.t)) ? 'loop' : ''].join(' ');
      return chordBtn(d, k, cls, roman(d, k) + (d.extra ? ' ' + d.extra : ''));
    }).join('');
    $('sfDiaNote').innerHTML = (nx.length ? '<span class="sf-tag nx">oft danach</span> ' : '') + '<span class="sf-tag loop">im Loop</span> <span class="sf-tag cur">aktuell</span>';
    // Tonleitern
    const sugg = suggestions(c, k);
    if (!state.scale || !sugg.some(s => s.id + s.root === state.scale)) state.scale = sugg.length ? sugg[0].id + sugg[0].root : null;
    const prim = sugg[0];
    $('sfScaleTitle').textContent = 'Was passt über ' + chordName(c, k);
    $('sfScales').innerHTML = sugg.map(s => {
      const sc = SC[s.id], ct = c.iv.map(x => md(c.r + x));
      const notes = s.iv.map(x => { const p = md(s.root + x); const cls = [p === c.r ? 'root' : '', ct.includes(p) ? 'ct' : '', p === s.ch ? 'char' : '', s.outside.includes(p) ? 'out' : ''].join(' '); return '<span class="sf-n ' + cls + '">' + nn(p, k) + '</span>'; }).join('');
      const chTxt = s.ch != null ? '<span class="sf-char">Charakterton <b>' + nn(s.ch, k) + '</b> (' + IVLONG[md(s.ch - s.root)] + ')</span>' : '';
      const outTxt = s.outside.length ? '<span class="sf-outt">Reibung mit der Tonart: <b>' + s.outside.map(p => nn(p, k)).join(', ') + '</b></span>' : '';
      const sel = state.scale === s.id + s.root ? ' sel' : '';
      return '<div class="sf-sc' + sel + '" data-key="' + s.id + s.root + '" role="button" tabindex="0"><div class="sf-sc-h"><b>' + nn(s.root, k) + ' ' + sc.n + '</b><span class="sf-tag t-' + s.tag.replace(/\W/g, '') + '">' + s.tag + '</span></div>'
        + '<div class="sf-notes">' + notes + '</div><p>' + s.why + ' ' + sc.mood + '</p>' + chTxt + outTxt
        + (sc.mode ? '<button class="toggle-btn sf-apply" data-root="' + s.root + '" data-mode="' + sc.mode + '">Ins Griffbrett</button>' : '') + '</div>';
    }).join('');
    const cur = sugg.find(s => s.id + s.root === state.scale) || prim;
    state.ctx = { s: cur, c, k };
    drawNeck();
    // Färbungen
    const col = colorings(c, prim ? prim.pcs : keyPcs(k));
    $('sfColors').innerHTML = col.length ? col.map(x => chordBtn(x, k, 'col', '')).join('') : '<span class="sf-muted">–</span>';
    renderMove(ci, c, k, f, prim);
  }
  // nächster Wechsel: gemeinsame Töne, Halbton-Leittöne
  function renderMove(ci, c, k, f, prim) {
    let nxt = null;
    if (ci.segs && f.seg != null) {
      const n = ci.segs.length;
      for (let s = 1; s < n; s++) { const q = ci.segs[(f.seg + s) % n]; const p = parseChord(q.name); if (p && !(p.r === c.r && p.t === c.t)) { nxt = p; break; } }
    }
    const box = $('sfMove');
    if (!nxt) { box.innerHTML = '<p class="sf-muted">Tippe in der Leiste oder unter „Mögliche Akkorde“ auf einen Akkord – hier steht dann, wie du in den nächsten hineinführst.</p>'; state.next = null; return; }
    state.next = nxt;
    const a = c.iv.map(x => md(c.r + x)), b = nxt.iv.map(x => md(nxt.r + x));
    const common = a.filter(p => b.includes(p));
    const src = prim ? prim.pcs : a, lead = [];
    b.forEach(p => src.forEach(q => { if (md(p - q) === 1 || md(q - p) === 1) if (!b.includes(q)) lead.push(nn(q, k) + '→' + nn(p, k)); }));
    const third = nxt.iv.includes(4) ? 4 : nxt.iv.includes(3) ? 3 : null;
    box.innerHTML = '<div class="sf-mv"><span class="sf-mv-a">' + chordName(c, k) + '</span><span class="sf-arrow">→</span><span class="sf-mv-b">' + chordName(nxt, k) + '</span></div>'
      + '<ul><li><b>Gemeinsame Töne:</b> ' + (common.length ? common.map(p => nn(p, k)).join(', ') + ' – einfach liegen lassen, der Akkord wechselt darunter.' : 'keine – hier lohnt ein klarer Zielton.') + '</li>'
      + (lead.length ? '<li><b>Leittöne (Halbton):</b> ' + [...new Set(lead)].slice(0, 4).join(' · ') + ' – auf der Eins des neuen Akkords auflösen.</li>' : '')
      + (third != null ? '<li><b>Zielton:</b> die Terz von ' + chordName(nxt, k) + ' ist <b>' + nn(nxt.r + third, k) + '</b> – genau beim Wechsel landen.</li>' : '') + '</ul>';
  }
  // ---- Griffbild über das ganze Griffbrett (0–15) ----
  const OPEN = [64, 59, 55, 50, 45, 40], FR = 15;
  function renderNeck(s, c, k) {
    const svg = $('sfNeck'); if (!s) { svg.innerHTML = ''; return; }
    const g = neckFrame(), { W, H, y0, sh, fx } = g; let h = g.h;
    const ct = c.iv.map(x => md(c.r + x));
    for (let st = 0; st < 6; st++) for (let f = 0; f <= FR; f++) {
      const m = OPEN[st] + f, p = md(m);
      if (!s.pcs.includes(p)) continue;
      const cls = p === s.root ? 'root' : p === s.ch ? 'char' : ct.includes(p) ? 'ct' : s.outside.includes(p) ? 'out' : 'sc';
      h += '<g class="nk-n ' + cls + '" data-m="' + m + '"><circle cx="' + fx(f) + '" cy="' + (y0 + st * sh) + '" r="11"/><text x="' + fx(f) + '" y="' + (y0 + st * sh + 0.5) + '">' + nn(p, k) + '</text></g>';
    }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = h;
    $('sfNeckTitle').textContent = 'Griffbild: ' + nn(s.root, k) + ' ' + SC[s.id].n;
  }

  // ---- Griffbild: Tonleiter oder Akkordgriffe ----
  function drawNeck() {
    const x = state.ctx; if (!x) return;
    const grip = state.neck === 'grip' && typeof Voicings !== 'undefined';
    $('sfNeckMode').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.m === (grip ? 'grip' : 'scale')));
    $('sfGrips').hidden = !grip;
    $('sfNeck').closest('.sf-neckwrap').classList.toggle('grip', grip);
    if (grip) renderGrip(state.gripC || x.c, x.k); else renderNeck(x.s, x.c, x.k);
    if (L.on) drawHit();
  }
  function neckFrame() {
    const W = 760, H = 168, x0 = 34, fw = (W - x0 - 8) / FR, y0 = 18, sh = (H - y0 - 22) / 5;
    const fx = fr => fr === 0 ? x0 - 15 : x0 + (fr - 0.5) * fw;
    let h = '<rect x="' + x0 + '" y="' + (y0 - 6) + '" width="' + (W - x0 - 8) + '" height="' + (sh * 5 + 12) + '" class="nk-board" rx="3"/>';
    for (let f = 0; f <= FR; f++) h += '<line x1="' + (x0 + f * fw) + '" x2="' + (x0 + f * fw) + '" y1="' + (y0 - 6) + '" y2="' + (y0 + sh * 5 + 6) + '" class="' + (f === 0 ? 'nk-nut' : 'nk-fret') + '"/>';
    [3, 5, 7, 9, 15].forEach(f => h += '<circle cx="' + fx(f) + '" cy="' + (y0 + sh * 2.5) + '" r="4" class="nk-dot"/>');
    h += '<circle cx="' + fx(12) + '" cy="' + (y0 + sh * 1.5) + '" r="4" class="nk-dot"/><circle cx="' + fx(12) + '" cy="' + (y0 + sh * 3.5) + '" r="4" class="nk-dot"/>';
    for (let st = 0; st < 6; st++) h += '<line x1="' + (x0 - 2) + '" x2="' + (W - 8) + '" y1="' + (y0 + st * sh) + '" y2="' + (y0 + st * sh) + '" class="nk-str" style="stroke-width:' + (0.8 + st * 0.35) + '"/>';
    [1, 3, 5, 7, 9, 12, 15].forEach(f => h += '<text x="' + fx(f) + '" y="' + (H - 4) + '" class="nk-num">' + f + '</text>');
    return { W, H, x0, fw, y0, sh, fx, h };
  }
  function renderGrip(c, k) {
    const svg = $('sfNeck'), vs = Voicings.forChord(c.r, CH[c.t] ? c.t : '');
    if (state.gripI >= vs.length) state.gripI = 0;
    const v = vs[state.gripI], g = neckFrame(); let h = g.h;
    $('sfNeckTitle').textContent = 'Griff: ' + chordName(c, k) + (v ? ' · ' + v.name : '');
    if (v) {
      const fr = v.frets.filter(f => f != null && f > 0), lo = Math.min(...fr), hi = Math.max(...fr);
      if (fr.length && !v.open) h += '<rect x="' + (g.x0 + (lo - 1) * g.fw + 2) + '" y="' + (g.y0 - 9) + '" width="' + ((hi - lo + 1) * g.fw - 4) + '" height="' + (g.sh * 5 + 18) + '" class="nk-zone" rx="6"/>';
      v.frets.forEach((f, s) => {
        const st = 5 - s, y = g.y0 + st * g.sh;
        if (f == null) { h += '<text x="' + (g.x0 - 15) + '" y="' + (y + 0.5) + '" class="nk-x">×</text>'; return; }
        const m = Voicings.OPEN[s] + f, p = md(m), rel = md(p - c.r);
        const cls = rel === 0 ? 'root' : (rel === 3 || rel === 4) ? 'ct third' : 'ct';
        h += '<g class="nk-n ' + cls + (f === 0 ? ' open' : '') + '" data-m="' + m + '"><circle cx="' + g.fx(f) + '" cy="' + y + '" r="11"/><text x="' + g.fx(f) + '" y="' + (y + 0.5) + '">' + nn(p, k) + '</text></g>';
      });
    }
    svg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
    svg.innerHTML = h;
    $('sfGrips').innerHTML = vs.map((x, i) => '<button class="toggle-btn' + (i === state.gripI ? ' active' : '') + '" data-g="' + i + '">' + x.name + '</button>').join('')
      + (v ? '<button class="toggle-btn sf-strum" data-strum="1">▶ Anschlagen</button>' : '<span class="sf-muted">Für diesen Akkord gibt es keinen Griff.</span>');
    state.voicing = v || null;
  }
  function strum() {
    const v = state.voicing; if (!v || !window.Quinten) return;
    Voicings.notes(v).forEach((m, i) => setTimeout(() => Quinten.playNote(m), i * 28));
  }
  // ---- Mithören: gespielten Ton erkennen, im Griffbild zeigen und einordnen ----
  const L = { on: false, timer: null, buf: null, last: -1, cnt: 0, quiet: 0, cur: null, st: { ct: 0, sc: 0, out: 0 } };
  function classify(midi) {
    const x = state.ctx; if (!x) return null;
    const p = md(midi), ct = x.c.iv.map(i => md(x.c.r + i));
    if (p === x.c.r) return { cls: 'root', txt: 'Grundton', k: 'ct' };
    if (ct.includes(p)) return { cls: 'ct', txt: 'Akkordton', k: 'ct' };
    const sp = state.neck === 'scale' && x.s ? x.s.pcs : keyPcs(x.k);
    if (sp.includes(p)) return { cls: 'sc', txt: 'Tonleiter', k: 'sc' };
    return { cls: 'out', txt: 'Reibung', k: 'out' };
  }
  function drawHit() {
    const svg = $('sfNeck'), old = svg.querySelector('#sfHit'); if (old) old.remove();
    if (!L.on || !L.cur) return;
    const g = neckFrame(), OP = [64, 59, 55, 50, 45, 40];
    let h = '';
    OP.forEach((o, st) => { const f = L.cur.midi - o; if (f < 0 || f > FR) return; h += '<circle cx="' + g.fx(f) + '" cy="' + (g.y0 + st * g.sh) + '" r="15" class="nk-hit ' + L.cur.c.cls + '"/>'; });
    const gg = document.createElementNS('http://www.w3.org/2000/svg', 'g'); gg.id = 'sfHit'; gg.innerHTML = h; svg.appendChild(gg);
  }
  function showLive() {
    const n = L.cur, k = state.k;
    $('sfLiveNote').textContent = n ? nn(n.midi, k) + (Math.floor(n.midi / 12) - 1) : '–';
    $('sfLiveCents').textContent = n ? (n.cents > 0 ? '+' : '') + n.cents + ' ct' : '';
    const tg = $('sfLiveTag'); tg.className = 'sf-live-tag' + (n ? ' ' + n.c.cls : ''); tg.textContent = n ? n.c.txt : (L.msg || 'Spiel etwas …');
    const t = L.st.ct + L.st.sc + L.st.out, pc = v => t ? Math.round(v / t * 100) + ' %' : '–';
    $('sfLiveStats').innerHTML = '<span>Gezählt <b>' + t + '</b></span><span class="ct">Akkordton <b>' + pc(L.st.ct) + '</b></span><span class="sc">Tonleiter <b>' + pc(L.st.sc) + '</b></span><span class="out">Reibung <b>' + pc(L.st.out) + '</b></span>';
    drawHit();
  }
  function listenTick() {
    if (!L.on || panel.hidden) return;
    const an = typeof Looper !== 'undefined' && Looper.inputAnalyser ? Looper.inputAnalyser() : null;
    if (!an) { if (L.msg !== 'Eingang geschlossen – tippe nochmal auf „Mithören“.') { L.msg = 'Eingang geschlossen – tippe nochmal auf „Mithören“.'; L.cur = null; showLive(); } return; }
    if (!L.buf || L.buf.length !== an.fftSize) L.buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(L.buf);
    const r = Pitch.detect(L.buf, audioCtx.sampleRate, { gate: 0.005 });
    if (r && r.conf > 0.8 && r.midi >= 38 && r.midi <= 90) {
      L.quiet = 0;
      if (r.midi === L.last) L.cnt++; else { L.last = r.midi; L.cnt = 1; }
      if (L.cnt === 2) {                               // zwei gleiche Messungen hintereinander: neuer Ton
        const c = classify(r.midi); if (!c) return;
        L.st[c.k]++; L.cur = { midi: r.midi, cents: r.cents, c }; L.msg = ''; showLive();
      } else if (L.cnt > 2 && L.cur && L.cur.midi === r.midi) { L.cur.cents = r.cents; $('sfLiveCents').textContent = (r.cents > 0 ? '+' : '') + r.cents + ' ct'; }
    } else if (++L.quiet >= 6) {                         // ca. 0,4 s Ruhe: Anzeige leeren, gleicher Ton zählt wieder neu
      L.last = -1; L.cnt = 0; if (L.cur) { L.cur = null; showLive(); }
    }
  }
  function listenRun() { clearInterval(L.timer); L.timer = null; if (L.on && !panel.hidden) L.timer = setInterval(listenTick, 60); }
  async function setListen(v) {
    const b = $('sfListen');
    if (v) {
      if (typeof Looper === 'undefined' || !Looper.openInput || typeof Pitch === 'undefined') return;
      b.disabled = true; L.msg = 'Eingang wird geöffnet …'; $('sfLive').hidden = false; showLive();
      let ok = false; try { ok = await Looper.openInput(); } catch (e) { ok = false; }
      b.disabled = false;
      if (!ok) { L.on = false; L.msg = 'Kein Zugriff auf den Eingang – erlaube das Mikrofon und tippe nochmal.'; showLive(); b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); return; }
      L.on = true; L.msg = ''; L.cur = null;
    } else {
      L.on = false; L.cur = null;
      if (typeof Looper !== 'undefined' && Looper.releaseAnalyser) Looper.releaseAnalyser();
    }
    b.classList.toggle('active', L.on); b.setAttribute('aria-pressed', L.on ? 'true' : 'false');
    $('sfLive').hidden = !L.on; showLive(); listenRun();
  }
  $('sfListen').addEventListener('click', () => setListen(!L.on));
  $('sfLiveReset').addEventListener('click', () => { L.st = { ct: 0, sc: 0, out: 0 }; showLive(); });
  document.addEventListener('tabchange', () => setTimeout(listenRun, 0));

  // ---- Ideen-Würfel ----
  function idea() {
    const f = state.focus, k = state.k; if (!f || !k) return;
    const c = f.c, nx = state.next, s = suggestions(c, k)[0];
    const ctN = c.iv.map(x => nn(c.r + x, k)).join(', ');
    const chN = s && s.ch != null ? nn(s.ch, k) : nn(c.r + 7, k);
    const t3 = nx ? nn(nx.r + (nx.iv.includes(4) ? 4 : nx.iv.includes(3) ? 3 : 7), k) : null;
    const L = [
      t3 ? 'Lande genau beim Wechsel zu ' + chordName(nx, k) + ' auf ' + t3 + ' – der Terz des neuen Akkords.' : 'Beende jede Phrase auf einem Akkordton: ' + ctN + '.',
      'Zwei Takte nur Akkordtöne (' + ctN + '), dann einmal den Charakterton ' + chN + ' als Farbe.',
      'Erfinde ein Motiv aus drei Tönen, wiederhole es – und verschiebe es dann eine Terz höher.',
      'Frage und Antwort: einen Takt spielen, einen Takt Pause. Die Pause gehört zum Solo.',
      'Nur eine Saite: spiele ' + (s ? nn(s.root, k) + ' ' + SC[s.id].n : 'die Tonleiter') + ' nur auf der G-Saite – zwingt zu Slides und Melodie.',
      'Zuerst Rhythmus: ein einziger Ton, aber ein spannender Rhythmus. Erst danach kommen weitere Töne dazu.',
      'Ziehe (Bending) einen Ganzton hoch zu ' + nn(c.r, k) + ' oder ' + nn(c.r + c.iv[1], k) + ' – klingt nach Gesang.',
      'Beginne Phrasen auf Zählzeit 2 oder auf „und“ statt auf der Eins.',
      'Spiele eine Phrase und wiederhole sie unverändert über den nächsten Akkord – hör, wie sie sich umfärbt.',
      'Doppelgriffe: zwei Töne aus der Tonleiter im Abstand einer Terz, langsam durch die Lage.',
      'Rutsche (Slide) in jeden Zielton einen Halbton von unten.',
      'Spiele in einer neuen Lage: höher als Bund 12 oder in der offenen Lage.',
      'Pentatonik spielen, aber einen Ton durch den Charakterton ' + chN + ' ersetzen.',
      'Wenig Töne, viel Vibrato: höchstens vier Töne pro Takt.',
      'Arpeggio aufwärts, Tonleiter abwärts – und wieder zurück.'
    ];
    state.idea = (state.idea + 1 + Math.floor(Math.random() * (L.length - 1))) % L.length;
    $('sfIdea').textContent = L[state.idea];
  }

  // ---- Ablauf ----
  function update(force) {
    if (panel.hidden && !force) return;
    const ci = info(), { k, src } = currentKey(ci);
    state.k = k;
    // Spur-Auswahl
    $('sfTracks').querySelectorAll('button').forEach(b => {
      const i = b.dataset.t === 'auto' ? null : +b.dataset.t;
      b.classList.toggle('active', (state.track == null && i == null) || state.track === i);
      if (i != null) b.disabled = !(ci.tracks[i] && ci.tracks[i].has);
    });
    renderBand(ci, k);
    const on = tickBand(ci);
    // Fokus: klingender Akkord (wenn „folgen“), sonst gewählter
    let f = state.focus;
    if (state.follow && on >= 0 && ci.segs) { const c = parseChord(ci.segs[on].name); if (c) f = { c, seg: on, live: true }; }
    else if (f && f.live) f = Object.assign({}, f, { live: false });
    if (!f) {
      if (ci.segs) { const i = ci.segs.findIndex(s => parseChord(s.name)); if (i >= 0) f = { c: parseChord(ci.segs[i].name), seg: i, live: false }; }
      if (!f) f = { c: diatonic(k)[0], seg: null, live: false };
    }
    state.focus = f;
    const sig = f.c.r + f.c.t + '|' + f.seg + '|' + f.live + '|' + k.pc + k.major + '|' + src + '|' + state.scale + '|' + (ci.segs ? ci.segs.length + ci.track : '-');
    if (sig !== state.sig || force) { state.sig = sig; renderFocus(ci, k, src); }
  }
  // Bedienung
  $('sfStrip').addEventListener('click', e => {
    const b = e.target.closest('.sf-seg'); if (!b || b.classList.contains('rest')) return;
    const ci = info(), i = +b.dataset.i, s = ci.segs && ci.segs[i]; if (!s) return;
    const c = parseChord(s.name);
    if (ci.playing && !ci.jam) { Looper.seek(ci.track, s.a + 1); }
    else { state.focus = { c, seg: i, live: false }; if (window.Quinten) Quinten.play(c.r, c.iv); }
    state.neck = 'grip'; state.gripC = null; state.gripI = 0;
    update(true);
  });
  panel.addEventListener('click', e => {
    const b = e.target.closest('.sf-ch');
    if (b) {
      const c = { r: +b.dataset.r, t: b.dataset.t, iv: CH[b.dataset.t] };
      if (window.Quinten) Quinten.play(c.r, c.iv);
      state.neck = 'grip'; state.gripI = 0;
      if (!b.classList.contains('col')) { state.gripC = null; state.follow = false; $('sfFollow').checked = false; state.focus = { c, seg: null, live: false }; update(true); }
      else { state.gripC = c; drawNeck(); }
      b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 250);
      return;
    }
    const ap = e.target.closest('.sf-apply');
    if (ap) {
      rootSel.value = NOTES[+ap.dataset.root]; modeSel.value = ap.dataset.mode; rootSel.dispatchEvent(new Event('change'));
      ap.textContent = '✓ Im Griffbrett'; return;
    }
    const sc = e.target.closest('.sf-sc');
    if (sc) { state.scale = sc.dataset.key; state.neck = 'scale'; state.gripC = null; update(true); return; }
    const nm = e.target.closest('#sfNeckMode button');
    if (nm) { state.neck = nm.dataset.m; state.gripC = null; drawNeck(); return; }
    const gb = e.target.closest('#sfGrips button');
    if (gb) { if (gb.dataset.strum) strum(); else { state.gripI = +gb.dataset.g; drawNeck(); strum(); } return; }
    const n = e.target.closest('.nk-n');
    if (n && window.Quinten) Quinten.playNote(+n.dataset.m);
  });
  $('sfFollow').addEventListener('change', e => { state.follow = e.target.checked; update(true); });
  $('sfTracks').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; state.track = b.dataset.t === 'auto' ? null : +b.dataset.t; bandSig = ''; update(true); });
  // Tonart-Auswahl
  const ks = $('sfKeySel');
  ks.add(new Option('Automatisch', 'auto'));
  for (let p = 0; p < 12; p++) ks.add(new Option(SHARP[p] + (FLAT[p] !== SHARP[p] ? '/' + FLAT[p] : '') + '-Dur', p + ':M'));
  for (let p = 0; p < 12; p++) ks.add(new Option(SHARP[p] + (FLAT[p] !== SHARP[p] ? '/' + FLAT[p] : '') + '-Moll', p + ':m'));
  ks.addEventListener('change', () => { state.keyOv = ks.value; bandSig = ''; update(true); });
  $('sfDice').addEventListener('click', idea);
  let timer = null;
  document.addEventListener('tabchange', e => {
    clearInterval(timer); timer = null;
    if (e.detail !== 'solo') return;
    bandSig = ''; update(true); if (!$('sfIdea').textContent) idea();
    timer = setInterval(() => update(false), 100);
  });
  window.addEventListener('resize', () => { if (!panel.hidden) { bandSig = ''; update(true); } });
  // für die „Was passt“-Box im Looper: gleiche Logik wie hier, nur kompakt
  function quick(name, k) {
    const c = parseChord(name); if (!c) return null;
    const sg = suggestions(c, k), best = sg[0], pent = sg.find(x => x.id === 'pmin' || x.id === 'pmaj');
    return { c, chord: chordName(c, k), roman: roman(c, k), func: func(c, k), best, pent, sugg: sg, scaleName: id => SC[id].n, mood: id => SC[id].mood,
      ivLong: x => IVLONG[md(x)], keyLabel: keyLabel(k), keyNotes: keyPcs(k), nn: p => nn(p, k), ct: c.iv.map(x => md(c.r + x)) };
  }
  window.SoloFinder = { quick, parseChord, state: () => state, drawNeck, listen: () => ({ on: L.on, cur: L.cur, st: Object.assign({}, L.st) }), setListen, suggestions: (r, t, pc, major) => suggestions({ r, t, iv: CH[t] }, { pc, major }), roman: (r, t, pc, major) => roman({ r, t, iv: CH[t] }, { pc, major }), update };
})();
