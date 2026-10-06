// ---- Songwriting: Musik-Logik ohne Oberfläche (Prüfen, Varianten, Gesang). In Node testbar. ----
// Version = { key: {pc, major}, bpm, parts: [{ id, name, type, chords: [{r, t, beats}], audio, audioSig, audioBpm }], order: [{ p, reps }] }
const LiedCore = (() => {
  const md = x => ((x % 12) + 12) % 12;
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const CH = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 2, 4, 7], m9: [0, 2, 3, 7, 10], maj9: [0, 2, 4, 7, 11], '9': [0, 2, 4, 7, 10], m11: [0, 3, 5, 7, 10], m7b5: [0, 3, 6, 10] };
  const SUF = { dim: '°', m7b5: 'm7♭5' };
  const TYPES = { intro: 'Intro', verse: 'Strophe', pre: 'Pre-Chorus', chorus: 'Refrain', bridge: 'Bridge', solo: 'Solo', outro: 'Outro', other: 'Teil' };
  const flats = k => [5, 10, 3, 8, 1].includes(k.major ? k.pc : md(k.pc + 3));
  const nn = (pc, k) => (k && flats(k) ? FLAT : SHARP)[md(pc)];
  // Akkordname; Akkorde außerhalb der Tonart nach ihrer Stufe schreiben (♭III in G-Dur = B♭, nicht A♯)
  const cname = (c, k) => { const R = k ? roman(c, k) : ''; const tb = R[0] === '♭' ? FLAT : R[0] === '♯' ? SHARP : (k && flats(k) ? FLAT : SHARP); return tb[md(c.r)] + (SUF[c.t] != null ? SUF[c.t] : c.t); };
  const qual = t => /^(m|m7|m6|m9|m11)$/.test(t) ? 'm' : /^(dim|m7b5)$/.test(t) ? 'd' : /^(sus|5)/.test(t) ? '*' : 'M';
  const keyLabel = k => nn(k.pc, k) + (k.major ? '-Dur' : '-Moll');
  const SCALE = k => k.major ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  function roman(c, k) {
    const rel = md(c.r - k.pc), q = qual(c.t), ref = SCALE(k), B = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    let d = ref.indexOf(rel), acc = '';
    if (d < 0) { d = ref.indexOf(md(rel + 1)); acc = '♭'; if (d <= 0) { d = ref.indexOf(md(rel - 1)); acc = '♯'; } }
    if (d < 0) return '?';
    let s = B[d]; if (q === 'm' || q === 'd') s = s.toLowerCase();
    return acc + s + (q === 'd' ? '°' : '') + (/^7$|^9$/.test(c.t) ? '7' : '');
  }
  // diatonisch? (Dur-Dominante in Moll zählt als leitereigen)
  function diatonic(c, k) {
    const sc = SCALE(k).map(x => md(k.pc + x)), pcs = CH[c.t].map(x => md(c.r + x));
    if (pcs.every(p => sc.includes(p))) return true;
    if (!k.major && md(c.r - k.pc) === 7 && qual(c.t) === 'M') return true;
    return false;
  }
  const sig = cs => cs.map(c => c.r + c.t + ':' + c.beats).join(' ');
  const clone = o => JSON.parse(JSON.stringify(o));
  const beatsOf = p => p.chords.reduce((a, c) => a + c.beats, 0);
  const partById = (v, id) => v.parts.find(p => p.id === id);
  const firstOf = (v, type) => v.parts.find(p => p.type === type && p.chords.length);
  let idn = 0; const newId = pfx => pfx + Date.now().toString(36) + (idn++).toString(36) + Math.random().toString(36).slice(2, 5);
  function totals(v) {
    let beats = 0; v.order.forEach(o => { const p = partById(v, o.p); if (p) beats += beatsOf(p) * Math.max(1, o.reps | 0); });
    return { beats, bars: beats / 4, secs: beats * 60 / (v.bpm || 90) };
  }
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  // Abfolge der tatsächlich gespielten Teile (mit Wiederholungen aufgelöst)
  function flat(v) { const out = []; v.order.forEach((o, oi) => { const p = partById(v, o.p); if (p) for (let r = 0; r < Math.max(1, o.reps | 0); r++) out.push({ p, oi, rep: r }); }); return out; }
  const isTonic = (c, k) => c.r === k.pc && (qual(c.t) === (k.major ? 'M' : 'm') || qual(c.t) === '*');
  const isDom = (c, k) => md(c.r - k.pc) === 7 && (qual(c.t) === 'M' || c.t === '5' || (!k.major && qual(c.t) === 'm'));
  const audioStale = p => !!p.audio && p.audioSig !== sig(p.chords);

  // ================= Prüfen =================
  function analyse(v) {
    const k = v.key, F = [], add = (lvl, text, part) => F.push({ lvl, text, part: part || null });
    const L = totals(v), fl = flat(v);
    if (!v.parts.length || !v.order.length) { add('tip', 'Noch kein Ablauf – übernimm einen Teil aus dem Looper (Knopf „→ Song“) und füge ihn hier ein.'); return F; }
    const types = new Set(fl.map(x => x.p.type));
    // Länge
    if (L.secs < 90) add('info', 'Länge ' + mmss(L.secs) + ' – für einen fertigen Song eher kurz (üblich sind etwa 2:30–4:00). Wiederholungen oder weitere Teile verlängern ihn.');
    else if (L.secs > 330) add('tip', 'Länge ' + mmss(L.secs) + ' – recht lang. Prüfe, ob jede Wiederholung etwas Neues bringt.');
    else add('ok', 'Länge ' + mmss(L.secs) + ' – im üblichen Rahmen.');
    // Struktur
    const verse = firstOf(v, 'verse'), chorus = firstOf(v, 'chorus'), bridge = firstOf(v, 'bridge');
    if (!chorus) add('tip', 'Es gibt noch keinen Refrain. Lege einen Teil als „Refrain“ fest – er ist das, was hängen bleibt.');
    else {
      const n = fl.filter(x => x.p.type === 'chorus').length;
      if (n < 3) add('tip', 'Der Refrain kommt nur ' + n + '× vor. Meist kehrt er 3× wieder – das macht ihn zum Wiedererkennungs-Moment.');
      else add('ok', 'Der Refrain kommt ' + n + '× vor.');
    }
    if (fl.length >= 5 && !bridge) add('tip', 'Keine Bridge: Nach dem zweiten Refrain tut ein Teil mit neuen Akkorden gut, bevor der letzte Refrain kommt.');
    // Teil-Längen
    v.parts.forEach(p => {
      const bars = beatsOf(p) / 4;
      if (!p.chords.length) add('warn', '„' + p.name + '“ hat noch keine Akkorde.', p.id);
      else if (![1, 2, 4, 6, 8, 12, 16, 24, 32].includes(bars)) add('info', '„' + p.name + '“ ist ' + String(bars).replace('.', ',') + ' Takte lang – ungewöhnlich. Wenn nicht gewollt, Akkordlängen prüfen.', p.id);
    });
    // Kontrast Strophe/Refrain
    if (verse && chorus) {
      if (sig(verse.chords) === sig(chorus.chords)) add('warn', 'Strophe und Refrain haben genau dieselben Akkorde. Der Refrain sollte sich abheben – siehe Varianten.', chorus.id);
      else {
        if (verse.chords[0].r === chorus.chords[0].r && verse.chords[0].t === chorus.chords[0].t) add('tip', 'Strophe und Refrain beginnen beide mit ' + cname(chorus.chords[0], k) + '. Ein Refrain, der auf der IV oder vi startet, wirkt wie ein Aufbruch.', chorus.id);
        const sv = new Set(verse.chords.map(c => c.r + c.t)), sc = new Set(chorus.chords.map(c => c.r + c.t));
        if ([...sc].every(x => sv.has(x)) && sc.size === sv.size) add('info', 'Strophe und Refrain nutzen dieselben Akkorde in anderer Reihenfolge – funktioniert, den Unterschied macht dann vor allem die Melodie.', chorus.id);
      }
    }
    // Übergänge
    const seen = new Set();
    for (let i = 0; i + 1 < fl.length; i++) {
      const a = fl[i].p, b = fl[i + 1].p; if (a === b || !a.chords.length || !b.chords.length) continue;
      const key2 = a.id + '>' + b.id; if (seen.has(key2)) continue; seen.add(key2);
      const la = a.chords[a.chords.length - 1], fb = b.chords[0];
      if (isDom(la, k) && isTonic(fb, k)) add('ok', '„' + a.name + '“ → „' + b.name + '“: endet auf der Dominante und löst auf – starker Übergang.', b.id);
      else if (isTonic(la, k) && isTonic(fb, k) && b.type === 'chorus') add('tip', '„' + a.name + '“ endet auf ' + cname(la, k) + ' und „' + b.name + '“ beginnt wieder darauf – das wirkt statisch. Ein V-Akkord am Ende zieht in den Refrain hinein.', a.id);
    }
    // Fremdakkorde
    const foreign = []; v.parts.forEach(p => p.chords.forEach(c => { if (!diatonic(c, k)) { const n = cname(c, k) + ' (' + roman(c, k) + ')'; if (!foreign.includes(n)) foreign.push(n); } }));
    if (foreign.length) add('info', 'Akkorde außerhalb von ' + keyLabel(k) + ': ' + foreign.join(', ') + '. Bewusst eingesetzt bringen sie Farbe – sonst Akkord in der Teile-Liste korrigieren.');
    else add('ok', 'Alle Akkorde gehören zu ' + keyLabel(k) + '.');
    // Vielfalt
    const all = new Set(); v.parts.forEach(p => p.chords.forEach(c => all.add(c.r + c.t)));
    if (all.size <= 4 && v.parts.length >= 2) add('tip', 'Der ganze Song kommt mit ' + all.size + ' Akkorden aus. Eine Bridge oder ein geliehener Akkord (z. B. ♭VI oder iv) bringt Abwechslung.');
    // Ende
    const last = fl[fl.length - 1].p, lc = last.chords[last.chords.length - 1];
    if (lc && !isTonic(lc, k)) add('tip', 'Der Song endet auf ' + cname(lc, k) + ' (' + roman(lc, k) + '). Für ein rundes Ende auf der Tonika schließen – z. B. mit einem kurzen Outro.');
    // Aufnahmen
    v.parts.forEach(p => { if (audioStale(p)) add('info', 'Die Aufnahme von „' + p.name + '“ passt nicht mehr zu den geänderten Akkorden und ist stumm. Neu einspielen und mit „→ Song“ ersetzen.', p.id); });
    return F;
  }

  // ================= Varianten =================
  function find(cs, k, rel, q) { return cs.findIndex(c => md(c.r - k.pc) === rel && (!q || qual(c.t) === q)); }
  const mk = (k, rel, t, beats) => ({ r: md(k.pc + rel), t, beats });
  function variants(v) {
    const k = v.key, out = [], verse = firstOf(v, 'verse'), chorus = firstOf(v, 'chorus'), bridge = firstOf(v, 'bridge');
    const V = (id, title, desc, part, fn) => out.push({ id, title, desc, part: part || null, apply: base => { const n = clone(base); fn(n); return n; } });
    if (chorus) {
      const iIV = find(chorus.chords, k, k.major ? 5 : 5), ivi = find(chorus.chords, k, k.major ? 9 : 8);
      if (iIV > 0) V('chorusIV', 'Refrain auf der IV beginnen', 'Die Akkordfolge des Refrains beginnt beim ' + cname(chorus.chords[iIV], k) + ' – gleiche Akkorde, aber der Refrain hebt ab statt „nach Hause“ zu kommen.', chorus.id,
        n => { const p = partById(n, chorus.id); p.chords = p.chords.slice(iIV).concat(p.chords.slice(0, iIV)); });
      else if (ivi > 0) V('chorusVI', 'Refrain auf der vi beginnen', 'Der Refrain startet auf ' + cname(chorus.chords[ivi], k) + ' – emotionaler, leicht melancholischer Einstieg.', chorus.id,
        n => { const p = partById(n, chorus.id); p.chords = p.chords.slice(ivi).concat(p.chords.slice(0, ivi)); });
      else if (iIV < 0 && verse && verse.chords.length && verse.chords[0].r === chorus.chords[0].r) V('chorusIVnew', 'Refrain mit der IV öffnen', 'Der erste Akkord des Refrains wird ' + cname(mk(k, 5, k.major ? '' : 'm', 4), k) + ' – mehr Weite, wenn Strophe und Refrain gleich anfangen.', chorus.id,
        n => { const p = partById(n, chorus.id); p.chords[0] = Object.assign({}, p.chords[0], { r: md(k.pc + 5), t: k.major ? '' : 'm' }); });
    }
    if (verse) {
      const lc = verse.chords[verse.chords.length - 1];
      if (lc && !isDom(lc, k)) V('turnaround', 'Strophe mit der Dominante enden', 'Der letzte Akkord der Strophe wird ' + cname(mk(k, 7, '7', 4), k) + ' – baut Spannung auf und zieht in den nächsten Teil.', verse.id,
        n => { const p = partById(n, verse.id); const c = p.chords[p.chords.length - 1]; if (c.beats >= 8) { c.beats -= 4; p.chords.push(mk(k, 7, '7', 4)); } else p.chords[p.chords.length - 1] = mk(k, 7, '7', c.beats); });
    }
    // geliehener Akkord
    const tgt = chorus || bridge || verse;
    if (tgt) {
      if (k.major) {
        const i4 = find(tgt.chords, k, 5, 'M');
        if (i4 >= 0) V('borrowIV', 'Moll-Subdominante leihen', 'In „' + tgt.name + '“ wird ' + cname(tgt.chords[i4], k) + ' zu ' + cname(mk(k, 5, 'm', 4), k) + ' (iv aus der Moll-Tonart) – ein bittersüßer Moment, typisch für Balladen.', tgt.id,
          n => { const p = partById(n, tgt.id); p.chords[i4].t = 'm'; });
        else V('borrowVI', '♭VI leihen', 'Ein ' + cname(mk(k, 8, '', 4), k) + ' (♭VI) vor dem letzten Akkord von „' + tgt.name + '“ – epischer Rock-Moment.', tgt.id,
          n => { const p = partById(n, tgt.id); const last = p.chords[p.chords.length - 1]; if (last.beats >= 8) { last.beats -= 4; p.chords.splice(p.chords.length - 1, 0, mk(k, 8, '', 4)); } else p.chords.splice(p.chords.length - 1, 0, mk(k, 8, '', 4)); });
      } else {
        const t5 = [chorus, bridge, verse].concat(v.parts).find(p => p && find(p.chords, k, 7, 'm') >= 0), i5 = t5 ? find(t5.chords, k, 7, 'm') : -1;
        if (i5 >= 0) { const tgt = t5; V('harmV', 'Dur-Dominante (harmonisch Moll)', 'In „' + tgt.name + '“ wird ' + cname(tgt.chords[i5], k) + ' zu ' + cname(mk(k, 7, '7', 4), k) + ' – der Leitton zieht stark zurück zur Tonika.', tgt.id,
          n => { const p = partById(n, tgt.id); p.chords[i5].t = '7'; }); }
      }
    }
    // Farben
    if (verse && verse.chords.some(c => c.t === '' || c.t === 'm')) V('colors', 'Strophe einfärben', 'Dreiklänge der Strophe bekommen Septimen (I→maj7, ii/vi→m7, V→7) – weicher, jazziger, ohne die Harmonie zu ändern.', verse.id,
      n => { const p = partById(n, verse.id); p.chords.forEach(c => { const rel = md(c.r - k.pc); if (c.t === '' && (rel === 0 || rel === 5)) c.t = k.major ? 'maj7' : (rel === 0 ? c.t : 'maj7'); else if (c.t === '' && rel === 7) c.t = '7'; else if (c.t === 'm') c.t = 'm7'; }); });
    // Pre-Chorus
    if (chorus && verse && !firstOf(v, 'pre')) V('pre', 'Pre-Chorus einfügen', 'Zwei Takte ' + cname(mk(k, k.major ? 5 : 8, '', 4), k) + ' – ' + cname(mk(k, 7, k.major ? '' : '7', 4), k) + ' vor jedem Refrain bauen Spannung auf.', null,
      n => { const np = { id: newId('p'), name: 'Pre-Chorus', type: 'pre', chords: [mk(k, k.major ? 5 : 8, '', 4), mk(k, 7, k.major ? '' : '7', 4)], audio: null };
          // nur zwischen Strophe und Refrain einfügen
          const out = []; n.order.forEach((o, i) => { const p = partById(n, o.p), prev = i > 0 ? partById(n, n.order[i - 1].p) : null; if (p && p.type === 'chorus' && prev && prev.type === 'verse') out.push({ p: np.id, reps: 1 }); out.push(o); });
          if (out.length === n.order.length) { const i = n.order.findIndex(o => (partById(n, o.p) || {}).type === 'chorus'); out.splice(Math.max(0, i), 0, { p: np.id, reps: 1 }); }
          n.order = out; n.parts.push(np); });
    // Bridge
    if (!bridge && chorus) {
      const prog = k.major ? [[9, 'm'], [4, 'm'], [5, ''], [7, '']] : [[5, 'm'], [3, ''], [10, ''], [7, '7']];
      const nm = prog.map(([r, t]) => cname(mk(k, r, t, 4), k)).join(' – ');
      V('bridge', 'Bridge einfügen', 'Neuer Teil mit ' + nm + ' vor dem letzten Refrain – Kontrast, bevor der Refrain ein letztes Mal kommt.', null,
        n => { const np = { id: newId('p'), name: 'Bridge', type: 'bridge', chords: prog.map(([r, t]) => mk(k, r, t, 4)), audio: null };
          let li = -1; n.order.forEach((o, i) => { const p = partById(n, o.p); if (p && p.type === 'chorus') li = i; });
          n.parts.push(np); if (li > 0) n.order.splice(li, 0, { p: np.id, reps: 1 }); else n.order.push({ p: np.id, reps: 1 }); });
    }
    // Rückung
    if (chorus) {
      let cnt = 0; v.order.forEach(o => { if (o.p === chorus.id) cnt++; });
      if (cnt >= 2) V('rueckung', 'Letzten Refrain einen Ganzton höher', 'Der letzte Refrain wird um 2 Halbtöne gerückt – klassischer Schluss-Schub (auch für die Stimme prüfen).', null,
        n => { const src = partById(n, chorus.id), np = { id: newId('p'), name: src.name + ' ↑', type: 'chorus', chords: src.chords.map(c => Object.assign({}, c, { r: md(c.r + 2) })), audio: null };
          let li = -1; n.order.forEach((o, i) => { if (o.p === chorus.id) li = i; }); n.parts.push(np); n.order[li] = { p: np.id, reps: n.order[li].reps }; });
    }
    // Halftime-Refrain (breiter)
    if (chorus && beatsOf(chorus) <= 32) V('wide', 'Refrain breiter machen', 'Jeder Akkord im Refrain klingt doppelt so lang – der Refrain wirkt größer und lässt der Melodie mehr Raum.', chorus.id,
      n => { const p = partById(n, chorus.id); p.chords.forEach(c => { c.beats *= 2; }); });
    // Outro
    const fl = flat(v);
    if (fl.length) { const lp = fl[fl.length - 1].p, lc = lp.chords[lp.chords.length - 1]; if (lc && !isTonic(lc, k) && !firstOf(v, 'outro')) V('outro', 'Outro auf der Tonika', 'Zwei Takte ' + cname(mk(k, 0, k.major ? '' : 'm', 8), k) + ' am Ende – der Song kommt hörbar an.', null,
      n => { const np = { id: newId('p'), name: 'Outro', type: 'outro', chords: [mk(k, 0, k.major ? '' : 'm', 8)], audio: null }; n.parts.push(np); n.order.push({ p: np.id, reps: 1 }); }); }
    return out;
  }
  function transpose(v, d) {
    const n = clone(v); n.key = { pc: md(n.key.pc + d), major: n.key.major };
    n.parts.forEach(p => { p.chords.forEach(c => { c.r = md(c.r + d); }); });
    return n;
  }

  // ================= Gesang =================
  const VOICES = [
    { id: 'bass', n: 'Bass', lo: 40, hi: 62 }, { id: 'bariton', n: 'Bariton', lo: 43, hi: 65 }, { id: 'tenor', n: 'Tenor', lo: 48, hi: 69 },
    { id: 'alt', n: 'Alt', lo: 53, hi: 74 }, { id: 'mezzo', n: 'Mezzosopran', lo: 57, hi: 77 }, { id: 'sopran', n: 'Sopran', lo: 60, hi: 81 }
  ];
  const noteName = (m, k) => nn(m, k) + (Math.floor(m / 12) - 1);
  // Melodie-Kern typischer Pop-/Rock-Melodien: von der Quinte unter der Tonika bis zur Sexte darüber
  const BAND = [-5, 9];
  function placeTonic(pc, lo, hi) {
    let best = null;
    for (let T = lo - 24; T <= hi + 24; T++) {
      if (md(T) !== md(pc)) continue;
      const a = T + BAND[0], b = T + BAND[1], s = Math.min(a - lo, hi - b);
      if (!best || s > best.s) best = { T, s };
    }
    return best;
  }
  function fit(s) { return s >= 1 ? 'gut' : s >= -1 ? 'knapp' : 'eng'; }
  function voiceKey(v, lo, hi) {
    if (!(hi > lo)) return null;
    const pc = v.key.pc, now = placeTonic(pc, lo, hi);
    // kleinste Verschiebung, die gut passt (bei Gleichstand nach oben – Kapodaster); passt keine gut, die beste
    const cand = []; for (let d = -5; d <= 6; d++) cand.push({ d, p: placeTonic(md(pc + d), lo, hi) });
    const good = cand.filter(x => x.p.s >= 1).sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || b.d - a.d);
    let best = now.s >= 1 ? { d: 0, p: now } : good.length ? good[0] : cand.slice().sort((a, b) => b.p.s - a.p.s || Math.abs(a.d) - Math.abs(b.d))[0];
    const nk = { pc: md(pc + best.d), major: v.key.major };
    return { range: hi - lo, now: { fit: fit(now.s), tonic: now.T, s: now.s }, best: { d: best.d, key: nk, label: keyLabel(nk), tonic: best.p.T, fit: fit(best.p.s), s: best.p.s }, label: keyLabel(v.key) };
  }
  // Zieltöne je Akkord: Akkordtöne im Stimmumfang (Terz hervorgehoben)
  function targets(v, lo, hi) {
    return v.parts.map(p => {
      const seen = new Set(), rows = [];
      p.chords.forEach(c => {
        const key2 = c.r + c.t; if (seen.has(key2)) return; seen.add(key2);
        const iv = CH[c.t] || CH[''], notes = [];
        for (let m = lo; m <= hi; m++) { const rel = md(m - c.r); if (iv.includes(rel)) notes.push({ m, name: noteName(m, v.key), third: rel === 3 || rel === 4, root: rel === 0 }); }
        rows.push({ chord: cname(c, v.key), roman: roman(c, v.key), notes });
      });
      return { part: p.id, name: p.name, rows };
    });
  }
  return { CH, TYPES, VOICES, md, nn, cname, roman, keyLabel, qual, diatonic, sig, clone, beatsOf, totals, mmss, flat, analyse, variants, transpose, voiceKey, targets, noteName, audioStale, newId, partById };
})();
if (typeof window !== 'undefined') window.LiedCore = LiedCore;
if (typeof module !== 'undefined') module.exports = LiedCore;
