// ---- Üben: Tagesübung, Gehörbildung, Licks (mit eigenen Licks), Solo-Auswertung ----
(function () {
  const $ = id => document.getElementById(id);
  const panel = $('panel-ueben');
  if (!panel) return;
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const md = x => ((x % 12) + 12) % 12;
  const pget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const pset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const CH = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 2, 4, 7], m9: [0, 2, 3, 7, 10], maj9: [0, 2, 4, 7, 11], '9': [0, 2, 4, 7, 10], m11: [0, 3, 5, 7, 10], m7b5: [0, 3, 6, 10] };
  const MODES = [
    { n: 'Ionisch (Dur)', iv: [0, 2, 4, 5, 7, 9, 11], ch: 11, minor: false }, { n: 'Dorisch', iv: [0, 2, 3, 5, 7, 9, 10], ch: 9, minor: true },
    { n: 'Phrygisch', iv: [0, 1, 3, 5, 7, 8, 10], ch: 1, minor: true }, { n: 'Lydisch', iv: [0, 2, 4, 6, 7, 9, 11], ch: 6, minor: false },
    { n: 'Mixolydisch', iv: [0, 2, 4, 5, 7, 9, 10], ch: 10, minor: false }, { n: 'Äolisch (Moll)', iv: [0, 2, 3, 5, 7, 8, 10], ch: 8, minor: true },
    { n: 'Lokrisch', iv: [0, 1, 3, 5, 6, 8, 10], ch: 6, minor: true }
  ];
  const IVLONG = ['Grundton', 'kleine Sekunde', 'große Sekunde', 'kleine Terz', 'große Terz', 'Quarte', 'Tritonus', 'Quinte', 'kleine Sexte', 'große Sexte', 'kleine Septime', 'große Septime', 'Oktave'];
  const flatsFor = (pc, major) => [5, 10, 3, 8, 1].includes(major ? pc : md(pc + 3));
  const nn = (pc, k) => (k && flatsFor(k.pc, k.major) ? FLAT : SHARP)[md(pc)];
  const keyLabel = k => nn(k.pc, k) + (k.major ? '-Dur' : '-Moll');
  const play = (r, iv) => { if (window.Quinten) Quinten.play(r, iv); };
  const note = m => { if (window.Quinten) Quinten.playNote(m); };
  function boardKey() {
    if (typeof rootSel === 'undefined') return { pc: 9, major: false };
    const pc = NOTES.indexOf(rootSel.value), m = modeSel.value;
    if (/Äolisch|Dorisch|Phrygisch|Lokrisch/.test(m)) return { pc, major: false };
    return { pc, major: true };
  }
  // ---- Unterteilung ----
  let sec = 'tag';
  function showSec(s) {
    sec = s;
    $('ubNav').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.s === s));
    panel.querySelectorAll('.ub-sec').forEach(d => { d.hidden = d.dataset.s !== s; });
    if (s === 'tag') renderDay();
    if (s === 'lick') renderLick();
    if (s === 'solo') soloHint();
  }
  $('ubNav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showSec(b.dataset.s); });

  // ================= Tagesübung =================
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  let day = pget('3nps-uebung', null);
  function dayState() { if (!day || day.date !== today()) { day = { date: today(), roll: 0, done: {} }; pset('3nps-uebung', day); } return day; }
  function plan() {
    const d = dayState(), seed = d.date.split('-').reduce((a, x) => a * 131 + +x, 7) + d.roll * 7919, R = rng(seed);
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const root = Math.floor(R() * 12), mi = Math.floor(R() * 7), mode = MODES[mi], pos = 1 + Math.floor(R() * 7);
    const pat = pick([['updown', 'Rauf & Runter'], ['seq3', '3er-Sequenz'], ['thirds', 'Terzsprünge']]);
    const k = { pc: mode.minor ? root : root, major: !mode.minor };
    const bpm = 60 + Math.floor(R() * 7) * 5;
    const lick = pick((window.Licks ? Licks.list : []).filter(l => l.base === (mode.minor ? 'min' : 'maj')));
    const pres = window.Jam ? Jam.presets() : { maj: ['Pop'], min: ['Episch'] };
    const pIdx = Math.floor(R() * (mode.minor ? pres.min.length : pres.maj.length));
    const task = pick(['Lande bei jedem Akkordwechsel auf der Terz des neuen Akkords.', 'Spiel nur vier Töne pro Takt – dafür mit Vibrato und Bendings.', 'Frage und Antwort: einen Takt spielen, einen Takt Pause.', 'Beginne jede Phrase auf Zählzeit 2.', 'Bleib eine Minute nur auf zwei Saiten.', 'Wiederhole ein Motiv über alle Akkorde und hör, wie es sich färbt.']);
    const ear = pick([['int1', 'Intervalle – leicht'], ['int2', 'Intervalle – alle'], ['chd', 'Akkordtypen'], [mode.minor ? 'degm' : 'degM', mode.minor ? 'Stufen in Moll' : 'Stufen in Dur']]);
    const nm = nn(root, k);
    return {
      key: k, root, mode, nm,
      blocks: [
        { id: 'griff', min: 4, title: 'Griffbrett aufwärmen', text: nm + ' ' + mode.n + ', Position ' + pos + ', ' + pat[1] + ', ' + bpm + ' BPM.', btn: 'Im Griffbrett öffnen',
          go: () => { rootSel.value = NOTES[root]; modeSel.value = mode.n; posSel.value = String(pos); patternSel.value = pat[0]; rootSel.dispatchEvent(new Event('change')); patternSel.dispatchEvent(new Event('change')); const b = $('bpm'); b.value = bpm; b.dispatchEvent(new Event('input')); $('tab-griffbrett').click(); } },
        { id: 'lick', min: 3, title: 'Lick des Tages', text: lick ? '„' + lick.name + '“ (' + Licks.SCALE[lick.scale].n + ') in ' + keyLabel(k) + ' – erst langsam, dann im Tempo, dann eigene Varianten.' : 'Ein Lick aus der Bibliothek.', btn: 'Lick zeigen',
          go: () => { lickKey = k.pc + ':' + (k.major ? 'M' : 'm'); lickId = lick ? lick.id : null; showSec('lick'); } },
        { id: 'jam', min: 5, title: 'Solo über einen Jam', text: (mode.minor ? pres.min : pres.maj)[pIdx] + ' in ' + keyLabel(k) + '. Aufgabe: ' + task, btn: 'Jam vorbereiten',
          go: () => { if (window.Jam) Jam.load(k, pIdx); $('tab-jam').click(); } },
        { id: 'ohr', min: 3, title: 'Gehörbildung', text: ear[1] + ': zehn Aufgaben, Ziel acht richtig.', btn: 'Gehörbildung starten',
          go: () => { $('ubEarMode').value = ear[0]; showSec('ohr'); earNew(); } }
      ]
    };
  }
  let timer = { id: null, left: 0, iv: null, block: null };
  function renderDay() {
    const p = plan(), d = dayState();
    $('ubDayTitle').textContent = 'Tagesübung · ' + new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    $('ubDayKey').innerHTML = 'Tonart des Tages: <b>' + p.nm + ' ' + p.mode.n + '</b> · Charakterton <b>' + nn(p.root + p.mode.ch, p.key) + '</b> · ca. ' + p.blocks.reduce((a, b) => a + b.min, 0) + ' Minuten';
    const nDone = p.blocks.filter(b => d.done[b.id]).length;
    $('ubProgBar').style.width = (nDone / p.blocks.length * 100) + '%';
    $('ubBlocks').innerHTML = p.blocks.map((b, i) => {
      const run = timer.id === b.id, done = !!d.done[b.id];
      const left = run ? timer.left : b.min * 60;
      return '<div class="ub-block' + (done ? ' done' : '') + (run ? ' run' : '') + '" data-id="' + b.id + '"><div class="ub-bh"><span class="ub-num">' + (done ? '✓' : i + 1) + '</span><b>' + b.title + '</b><span class="ub-min">' + b.min + ' min</span></div>'
        + '<p>' + b.text + '</p><div class="ub-bact"><button class="toggle-btn" data-go="' + b.id + '">' + b.btn + '</button>'
        + '<button class="toggle-btn ub-timer' + (run ? ' active' : '') + '" data-timer="' + b.id + '">' + (run ? (timer.iv ? '⏸ ' : '▶ ') : '⏱ ') + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + '</button>'
        + '<button class="toggle-btn" data-done="' + b.id + '">' + (done ? 'Erledigt ✓' : 'Als erledigt markieren') + '</button></div></div>';
    }).join('');
    renderDay.plan = p;
  }
  function finishBlock(id, sec) {
    const d = dayState(); d.done[id] = true; pset('3nps-uebung', d);
    const p = renderDay.plan || plan(), b = p.blocks.find(x => x.id === id);
    // im Übungslog eintragen (gleiches Format wie die Griffbrett-Einheiten)
    if (typeof AppDB !== 'undefined' && sec > 0) {
      AppDB.put('sessions', { id: newId(), ts: Date.now(), dateStr: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        root: NOTES[p.root], mode: p.mode.n, position: '–', pattern: 'Tagesübung · ' + (b ? b.title : id), bpm: Math.round(parseFloat($('bpm').value)), durationSec: Math.round(sec) })
        .then(() => { if (typeof refreshLog === 'function') refreshLog(); }).catch(() => {});
    }
    renderDay();
  }
  function timerTick() {
    timer.left--; timer.elapsed++;
    if (timer.left <= 0) {
      const id = timer.id, el = timer.elapsed; clearInterval(timer.iv); timer = { id: null, left: 0, iv: null };
      note(76); setTimeout(() => note(81), 180);
      finishBlock(id, el); return;
    }
    const b = panel.querySelector('[data-timer="' + timer.id + '"]');
    if (b) b.textContent = '⏸ ' + Math.floor(timer.left / 60) + ':' + String(timer.left % 60).padStart(2, '0');
  }
  $('ubBlocks').addEventListener('click', e => {
    const p = renderDay.plan || plan();
    const g = e.target.closest('[data-go]'); if (g) { const b = p.blocks.find(x => x.id === g.dataset.go); if (b) b.go(); return; }
    const t = e.target.closest('[data-timer]');
    if (t) {
      const id = t.dataset.timer, b = p.blocks.find(x => x.id === id);
      if (timer.id === id) { if (timer.iv) { clearInterval(timer.iv); timer.iv = null; } else timer.iv = setInterval(timerTick, 1000); }
      else { clearInterval(timer.iv); timer = { id, left: b.min * 60, elapsed: 0, iv: setInterval(timerTick, 1000) }; }
      renderDay(); return;
    }
    const dn = e.target.closest('[data-done]');
    if (dn) { const d = dayState(), id = dn.dataset.done; if (d.done[id]) { delete d.done[id]; pset('3nps-uebung', d); renderDay(); } else { if (timer.id === id) { const el = timer.elapsed; clearInterval(timer.iv); timer = { id: null, left: 0, iv: null }; finishBlock(id, el); } else finishBlock(id, 0); } }
  });
  $('ubReroll').addEventListener('click', () => { const d = dayState(); d.roll++; d.done = {}; pset('3nps-uebung', d); clearInterval(timer.iv); timer = { id: null, left: 0, iv: null }; renderDay(); });

  // ================= Gehörbildung =================
  const EAR = {
    int1: { q: 'Welches Intervall? (aufwärts gespielt)', opts: [3, 4, 5, 7, 12], name: x => IVLONG[x] },
    int2: { q: 'Welches Intervall? (aufwärts gespielt)', opts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], name: x => IVLONG[x] },
    chd: { q: 'Welcher Akkordtyp?', opts: ['', 'm', '7', 'maj7', 'm7', 'dim', 'sus4'], name: x => ({ '': 'Dur', m: 'Moll', '7': 'Dominant-7', maj7: 'Major-7', m7: 'Moll-7', dim: 'vermindert', sus4: 'sus4' }[x]) },
    degM: { q: 'Erst die Tonika, dann: welche Stufe?', opts: [0, 1, 2, 3, 4, 5, 6], name: x => ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'][x] },
    degm: { q: 'Erst die Tonika, dann: welche Stufe?', opts: [0, 1, 2, 3, 4, 5, 6], name: x => ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'][x] }
  };
  let ear = null, earSt = pget('3nps-gehoer', { best: {} });
  let earScore = { ok: 0, n: 0, streak: 0 };
  function earPlay() {
    if (!ear) return;
    const q = ear, m = q.mode;                      // Aufgabe festhalten (Moduswechsel während des Abspielens)
    if (m === 'int1' || m === 'int2') { note(q.base); setTimeout(() => note(q.base + q.ans), 650); }
    else if (m === 'chd') play(q.root, CH[q.ans]);
    else {
      const maj = m === 'degM', iv = maj ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10], qs = maj ? ['', 'm', 'm', '', '', 'm', 'dim'] : ['m', 'dim', '', 'm', 'm', '', ''];
      play(q.root, CH[qs[0]]); setTimeout(() => play(md(q.root + iv[q.ans]), CH[qs[q.ans]]), 1100);
    }
  }
  function earNew() {
    const m = $('ubEarMode').value, E = EAR[m];
    let ans; do { ans = E.opts[Math.floor(Math.random() * E.opts.length)]; } while (ear && ear.mode === m && ans === ear.ans && E.opts.length > 2 && Math.random() < 0.7);
    ear = { mode: m, ans, base: 48 + Math.floor(Math.random() * 12), root: Math.floor(Math.random() * 12), answered: false };
    $('ubEarQ').textContent = E.q;
    $('ubEarAns').innerHTML = E.opts.map(o => '<button class="toggle-btn" data-a="' + o + '">' + E.name(o) + '</button>').join('');
    earPlay(); earPaint();
  }
  function earPaint() {
    const m = $('ubEarMode').value, best = earSt.best[m] || 0;
    $('ubEarScore').innerHTML = 'Richtig <b>' + earScore.ok + '/' + earScore.n + '</b> · Serie <b>' + earScore.streak + '</b> · Beste Serie (' + $('ubEarMode').selectedOptions[0].text + ') <b>' + best + '</b>';
  }
  $('ubEarAns').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || !ear || ear.answered) return;
    const E = EAR[ear.mode], val = typeof E.opts[0] === 'number' ? +b.dataset.a : b.dataset.a, ok = val === ear.ans;
    ear.answered = true; earScore.n++;
    if (ok) { earScore.ok++; earScore.streak++; if (earScore.streak > (earSt.best[ear.mode] || 0)) { earSt.best[ear.mode] = earScore.streak; pset('3nps-gehoer', earSt); } }
    else earScore.streak = 0;
    $('ubEarAns').querySelectorAll('[data-a]').forEach(x => { const v = typeof E.opts[0] === 'number' ? +x.dataset.a : x.dataset.a; x.classList.toggle('right', v === ear.ans); if (x === b && !ok) x.classList.add('wrong'); });
    $('ubEarQ').textContent = ok ? 'Richtig! Weiter geht’s …' : 'Leider nicht – richtig ist „' + E.name(ear.ans) + '“. Hör nochmal hin.';
    earPaint();
    if (ok) setTimeout(() => { if (ear && ear.answered && sec === 'ohr' && !panel.hidden) earNew(); }, 1100); else setTimeout(earPlay, 400);
  });
  $('ubEarNew').addEventListener('click', earNew);
  $('ubEarAgain').addEventListener('click', earPlay);
  $('ubEarMode').addEventListener('change', () => { earScore = { ok: 0, n: 0, streak: 0 }; ear = null; $('ubEarAns').innerHTML = ''; $('ubEarQ').textContent = 'Tippe auf „Neue Aufgabe“ und hör genau hin.'; earPaint(); });

  // ================= Licks =================
  let lickKey = 'auto', lickId = null, own = pget('3nps-licks', []), rec = null;
  const lickK = () => { if (lickKey === 'auto') return boardKey(); const [p, m] = lickKey.split(':'); return { pc: +p, major: m === 'M' }; };
  function allLicks() {
    return (window.Licks ? Licks.list : []).concat(own.map(o => ({ id: o.id, name: o.name, own: true, scale: null, base: o.key.major ? 'maj' : 'min', tip: 'Dein eigener Lick (aufgenommen in ' + keyLabel(o.key) + ').', o })));
  }
  function placeOwn(o, k) {
    // eigene Licks: um den Abstand der Tonarten verschieben (Dur/Moll wie beim Aufnehmen über die Parallele)
    const from = o.key.major ? o.key.pc : md(o.key.pc + 3), to = k.major ? k.pc : md(k.pc + 3);
    let d = md(to - from); if (d > 6) d -= 12;
    let fr = o.notes.map(n => n[1] + d);
    if (Math.min(...fr) < 0) fr = fr.map(f => f + 12);
    if (Math.max(...fr) > 15) fr = fr.map(f => f - 12);
    if (Math.min(...fr) < 0) fr = o.notes.map(n => n[1]);
    return { root: k.major ? k.pc : k.pc, notes: o.notes.map((n, i) => ({ s: n[0], f: fr[i], d: n[2] || 1, tech: '', midi: Licks.OPEN[n[0]] + fr[i] })) };
  }
  function current() {
    const L = allLicks(), l = L.find(x => x.id === lickId) || L[0]; if (!l) return null;
    const k = lickK(), pl = l.own ? placeOwn(l.o, k) : Licks.place(l, k);
    return { l, k, pl };
  }
  function renderLick() {
    if (!window.Licks) return;
    const ks = $('ubLickKey');
    if (!ks.options.length) {
      ks.add(new Option('wie im Griffbrett', 'auto'));
      for (let p = 0; p < 12; p++) ks.add(new Option(SHARP[p] + (FLAT[p] !== SHARP[p] ? '/' + FLAT[p] : '') + '-Dur', p + ':M'));
      for (let p = 0; p < 12; p++) ks.add(new Option(SHARP[p] + (FLAT[p] !== SHARP[p] ? '/' + FLAT[p] : '') + '-Moll', p + ':m'));
    }
    ks.value = lickKey;
    const L = allLicks(), sel = $('ubLickSel');
    const groups = {}; L.forEach(l => { const g = l.own ? 'Eigene Licks' : Licks.SCALE[l.scale].n; (groups[g] = groups[g] || []).push(l); });
    sel.innerHTML = Object.entries(groups).map(([g, ls]) => '<optgroup label="' + g + '">' + ls.map(l => '<option value="' + l.id + '">' + l.name.replace(/[<>&"]/g, '') + '</option>').join('') + '</optgroup>').join('');
    const c = current(); if (!c) return;
    lickId = c.l.id; sel.value = lickId;
    const rootName = nn(c.pl.root !== undefined ? c.pl.root : c.k.pc, c.k);
    $('ubLickInfo').innerHTML = rec ? '<b>Aufnahme:</b> ' + rec.notes.length + ' Töne' : '<b>' + c.l.name.replace(/[<>&"]/g, '') + '</b>' + (c.l.scale ? ' · ' + rootName + ' ' + Licks.SCALE[c.l.scale].n : '') + ' · in ' + keyLabel(c.k) + '<br><span>' + c.l.tip + '</span>';
    $('ubDel').hidden = !c.l.own || !!rec;
    drawTab(rec ? recNotes() : c.pl.notes, c.k);
    drawLickNeck(rec ? recNotes() : c.pl.notes, c.k, rec ? null : (c.pl.root != null ? c.pl.root : null));
  }
  const recNotes = () => rec.notes.map(([s, f, d]) => ({ s, f, d, tech: '', midi: Licks.OPEN[s] + f }));
  function drawTab(notes, k) {
    const svg = $('ubTab'), W = Math.max(600, 60 + notes.reduce((a, n) => a + n.d, 0) * 34 + 30), H = 120, y0 = 20, sh = 16;
    let h = '';
    ['e', 'B', 'G', 'D', 'A', 'E'].forEach((s, i) => { h += '<line x1="30" x2="' + (W - 10) + '" y1="' + (y0 + i * sh) + '" y2="' + (y0 + i * sh) + '" class="tb-l"/><text x="14" y="' + (y0 + i * sh + 4) + '" class="tb-s">' + s + '</text>'; });
    let x = 52;
    notes.forEach((n, i) => {
      const y = y0 + (5 - n.s) * sh;
      h += '<rect x="' + (x - 11) + '" y="' + (y - 8) + '" width="22" height="16" class="tb-bg"/><text x="' + x + '" y="' + (y + 4.5) + '" class="tb-f">' + n.f + '</text>';
      const T = { b: '↗', h: 'h', p: 'p', s: '/', v: '~' }[n.tech];
      if (T) h += '<text x="' + (x + 13) + '" y="' + (y - 7) + '" class="tb-t">' + T + '</text>';
      h += '<text x="' + x + '" y="' + (H - 6) + '" class="tb-n">' + nn(n.midi, k) + '</text>';
      x += n.d * 34;
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.minWidth = W + 'px'; svg.innerHTML = h;
  }
  const FR = 15;
  function drawLickNeck(notes, k, root) {
    const svg = $('ubLickNeck'), W = 760, H = 168, x0 = 34, fw = (W - x0 - 8) / FR, y0 = 18, sh = (H - y0 - 22) / 5;
    const fx = f => f === 0 ? x0 - 15 : x0 + (f - 0.5) * fw;
    let h = '<rect x="' + x0 + '" y="' + (y0 - 6) + '" width="' + (W - x0 - 8) + '" height="' + (sh * 5 + 12) + '" class="nk-board" rx="3"/>';
    for (let f = 0; f <= FR; f++) h += '<line x1="' + (x0 + f * fw) + '" x2="' + (x0 + f * fw) + '" y1="' + (y0 - 6) + '" y2="' + (y0 + sh * 5 + 6) + '" class="' + (f === 0 ? 'nk-nut' : 'nk-fret') + '"/>';
    [3, 5, 7, 9, 15].forEach(f => h += '<circle cx="' + fx(f) + '" cy="' + (y0 + sh * 2.5) + '" r="4" class="nk-dot"/>');
    h += '<circle cx="' + fx(12) + '" cy="' + (y0 + sh * 1.5) + '" r="4" class="nk-dot"/><circle cx="' + fx(12) + '" cy="' + (y0 + sh * 3.5) + '" r="4" class="nk-dot"/>';
    for (let st = 0; st < 6; st++) h += '<line x1="' + (x0 - 2) + '" x2="' + (W - 8) + '" y1="' + (y0 + st * sh) + '" y2="' + (y0 + st * sh) + '" class="nk-str" style="stroke-width:' + (0.8 + st * 0.35) + '"/>';
    [1, 3, 5, 7, 9, 12, 15].forEach(f => h += '<text x="' + fx(f) + '" y="' + (H - 4) + '" class="nk-num">' + f + '</text>');
    if (rec) for (let s = 0; s < 6; s++) for (let f = 0; f <= FR; f++) h += '<rect class="nk-tap" data-s="' + s + '" data-f="' + f + '" x="' + (fx(f) - fw / 2) + '" y="' + (y0 + (5 - s) * sh - sh / 2) + '" width="' + fw + '" height="' + sh + '"/>';
    const seen = {};
    notes.forEach((n, i) => {
      const key = n.s + '/' + n.f, cx = fx(n.f), cy = y0 + (5 - n.s) * sh;
      const cls = root != null && md(n.midi) === md(root) ? 'root' : 'ct';
      if (!seen[key]) h += '<g class="nk-n ' + cls + '" data-m="' + n.midi + '"><circle cx="' + cx + '" cy="' + cy + '" r="11"/><text x="' + cx + '" y="' + (cy + 0.5) + '">' + nn(n.midi, k) + '</text></g>';
      seen[key] = (seen[key] || []).concat(i + 1);
    });
    Object.entries(seen).forEach(([key, nums]) => { const [s, f] = key.split('/').map(Number); h += '<text x="' + (fx(f) + 13) + '" y="' + (y0 + (5 - s) * sh - 9) + '" class="nk-ord">' + nums.slice(0, 3).join(',') + '</text>'; });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = h;
  }
  let playT = [];
  function playLick() {
    playT.forEach(clearTimeout); playT = [];
    const c = current(); if (!c) return;
    const notes = rec ? recNotes() : c.pl.notes, e8 = 30 / Math.max(40, parseFloat($('bpm').value) || 80) * ($('ubLickSlow').checked ? 2 : 1);
    let t = 0; const b = $('ubLickPlay'); b.classList.add('playing');
    notes.forEach(n => {
      playT.push(setTimeout(() => { note(n.midi); if (n.tech === 'b') playT.push(setTimeout(() => note(n.midi + 2), e8 * 400)); }, t * 1000));
      t += n.d * e8;
    });
    playT.push(setTimeout(() => b.classList.remove('playing'), t * 1000 + 200));
  }
  $('ubLickPlay').addEventListener('click', () => { if ($('ubLickPlay').classList.contains('playing')) { playT.forEach(clearTimeout); playT = []; $('ubLickPlay').classList.remove('playing'); } else playLick(); });
  $('ubLickKey').addEventListener('change', e => { lickKey = e.target.value; renderLick(); });
  $('ubLickSel').addEventListener('change', e => { lickId = e.target.value; renderLick(); });
  $('ubLickNeck').addEventListener('click', e => {
    const t = e.target.closest('.nk-tap');
    if (t && rec) { const s = +t.dataset.s, f = +t.dataset.f; rec.notes.push([s, f, rec.len]); note(Licks.OPEN[s] + f); renderLick(); return; }
    const n = e.target.closest('.nk-n'); if (n) note(+n.dataset.m);
  });
  $('ubRec').addEventListener('click', () => { rec = { notes: [], len: 1, key: lickK() }; $('ubRecBar').hidden = false; $('ubRec').hidden = true; $('ubRecName').value = ''; renderLick(); });
  $('ubRecBar').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b || !rec) return;
    const a = b.dataset.r;
    if (a === 'len') { rec.len = rec.len === 1 ? 2 : rec.len === 2 ? 4 : 1; b.textContent = 'Länge: ' + ({ 1: '♪', 2: '♩', 4: '𝅗𝅥' }[rec.len]); return; }
    if (a === 'undo') { rec.notes.pop(); renderLick(); return; }
    if (a === 'cancel') { rec = null; }
    if (a === 'save') {
      if (rec.notes.length < 2) { $('ubRecInfo').textContent = 'Mindestens zwei Töne antippen.'; return; }
      const name = ($('ubRecName').value || '').trim() || 'Mein Lick ' + (own.length + 1);
      const o = { id: 'own' + Date.now().toString(36), name: name.slice(0, 40), key: rec.key, notes: rec.notes };
      own.push(o); pset('3nps-licks', own); lickId = o.id; rec = null;
    }
    $('ubRecBar').hidden = true; $('ubRec').hidden = false; renderLick();
  });
  $('ubDel').addEventListener('click', () => { const c = current(); if (!c || !c.l.own) return; own = own.filter(o => o.id !== c.l.id); pset('3nps-licks', own); lickId = null; renderLick(); });

  // ================= Solo-Auswertung =================
  function soloHint() {
    const t = $('ubSoloHint');
    if (typeof Looper === 'undefined' || !Looper.soloData) return;
    const s = Looper.soloData(+$('ubSoloTr').value);
    t.textContent = s ? 'Bereit: ' + ($('ubSoloTr').selectedOptions[0].text) + ' (' + (s.L / s.sr).toFixed(1) + ' s). Tippe auf „Auswerten“.' : 'Nimm im Looper Akkorde auf einer Spur auf (oder lade einen Loop) und spiel dein Solo auf einer anderen Spur ein. Dann hier auswerten.';
  }
  $('ubSoloTr').addEventListener('change', soloHint);
  let busy = false;
  async function analyse() {
    if (busy) return;
    const si = +$('ubSoloTr').value, S = Looper.soloData(si);
    if (!S) { soloHint(); $('ubSoloHint').textContent = 'Auf dieser Spur ist noch nichts aufgenommen.'; return; }
    let ciIdx = $('ubChordTr').value === 'auto' ? null : +$('ubChordTr').value;
    if (ciIdx == null) { const ci = Looper.chordInfo(null); ciIdx = ci && ci.track >= 0 && ci.track !== si ? ci.track : [0, 1, 2].find(i => i !== si && (Looper.chordInfo(i) || {}).track === i); }
    const CI = ciIdx != null ? Looper.chordInfo(ciIdx) : null;
    if (!CI || CI.track !== ciIdx || !CI.segs) { $('ubSoloHint').textContent = 'Keine Spur mit erkannten Akkorden gefunden – lade oder nimm erst die Begleitung auf.'; return; }
    busy = true; $('ubAnalyse').disabled = true; $('ubSoloRes').hidden = true;
    const sr = S.sr, n = S.L, x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = S.r === S.l ? S.l[i] : (S.l[i] + S.r[i]) * 0.5;
    const hop = Math.round(sr * 0.01), win = sr > 30000 ? 2048 : 1024, frames = Math.max(0, Math.floor((n - win) / hop));
    const pm = new Int16Array(frames).fill(-1);
    for (let f0 = 0; f0 < frames; f0 += 120) {
      for (let f = f0; f < Math.min(frames, f0 + 120); f++) {
        const r = Pitch.detect(x.subarray(f * hop, f * hop + win), sr, { gate: 0.01, fmin: 75 });
        if (r && r.conf > 0.8 && r.midi >= 38 && r.midi <= 92) pm[f] = r.midi;
      }
      $('ubSoloHint').textContent = 'Werte aus … ' + Math.round(Math.min(1, (f0 + 120) / frames) * 100) + ' %';
      await new Promise(r => setTimeout(r, 0));
    }
    // Lautstärke in 1-ms-Schritten für genaue Anschläge
    const spm = sr / 1000, ne = Math.floor(n / spm) - 1, le = new Float32Array(ne);   // genau 1 ms je Wert (auch bei 44,1 kHz)
    for (let i = 0; i < ne; i++) { const a = Math.round(i * spm), b = Math.round((i + 1) * spm); let s = 0; for (let j = a; j < b; j++) { const v = x[j]; s += v * v; } le[i] = 10 * Math.log10(s / (b - a) + 1e-10); }
    // Töne: gleiche Tonhöhe über mindestens 4 Messungen (Lücken bis 2 erlaubt)
    const notes = [];
    for (let f = 0; f < frames;) {
      if (pm[f] < 0) { f++; continue; }
      const m = pm[f]; let e = f, gap = 0;
      for (let g = f + 1; g < frames; g++) { if (pm[g] === m) { e = g; gap = 0; } else if (++gap > 2) break; }
      if (e - f + 1 >= 4) {
        const t0 = (f * hop + win * 0.5) / sr;
        // Anschlag: stärkster Energieanstieg kurz vor der Tonhöhe
        let best = -1, bi = -1; const a = Math.max(5, Math.round((t0 - 0.06) * 1000)), b = Math.min(ne - 1, Math.round((t0 + 0.02) * 1000));
        for (let i = a; i <= b; i++) { const d = le[i] - le[i - 5]; if (d > best) { best = d; bi = i; } }
        const on = best > 6 ? (bi - 3) / 1000 : (f * hop) / sr;
        notes.push({ m, on, end: (e * hop + win * 0.5) / sr, attack: best > 6 });
      }
      f = e + 1;
    }
    const key = CI.key || boardKey(), kp = (key.major ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]).map(v => md(key.pc + v));
    const chordAt = t => { const f = ((Math.round(t * sr) % CI.L) + CI.L) % CI.L; const s = CI.segs.find(q => f >= q.a && f < q.e); return s ? s.name : null; };
    const parse = nm => { const mm = /^([A-G]#?)(.*)$/.exec(nm || ''); if (!mm) return null; const r = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(mm[1]); const iv = CH[mm[2]] || CH['']; return { r, iv, pcs: iv.map(v => md(r + v)) }; };
    const cat = (m, t) => { const c = parse(chordAt(t + 0.03)), p = md(m); if (c && p === c.r) return 'root'; if (c && c.pcs.includes(p)) return 'ct'; return kp.includes(p) ? 'sc' : 'out'; };
    notes.forEach((q, i) => { q.cat = cat(q.m, q.on); const nx = notes[i + 1]; q.phraseEnd = !nx || nx.on - q.end > 0.25; });
    // Zieltöne beim Akkordwechsel
    let tHit = 0, tN = 0;
    const reps = Math.ceil(n / CI.L);
    for (let r = 0; r < reps; r++) CI.segs.forEach((s, i) => {
      if (i === 0 && r === 0) return;
      const tc = (r * CI.L + s.a) / sr; if (tc >= n / sr) return;
      const q = notes.find(z => z.on >= tc - 0.12 && z.on <= tc + 0.25); if (!q) return;
      const c = parse(s.name); if (!c) return;
      tN++; if (c.pcs.includes(md(q.m))) tHit++;
    });
    // Timing gegen das Raster der Spur
    // Raster aus den Schlägen der Begleitung (Akkord-Spur), über die Länge des Solos wiederholt
    const CB = Looper.soloData(ciIdx) || S, sub = +$('ubGrid').value, B = CB.beats.slice().sort((a, b) => a - b), grid = [];
    for (let rp = -1; rp <= Math.ceil(n / CB.L); rp++) {
      for (let i = 0; i + 1 < B.length; i++) for (let k = 0; k < sub; k++) grid.push((rp * CB.L + B[i] + (B[i + 1] - B[i]) * k / sub) / sr);
      if (B.length) grid.push((rp * CB.L + B[B.length - 1]) / sr);
    }
    const devs = notes.filter(q => q.attack).map(q => { let best = 1e9; grid.forEach(g => { const d = (q.on - g) * 1000; if (Math.abs(d) < Math.abs(best)) best = d; }); return best; }).filter(d => Math.abs(d) < 200);
    const med = a => { if (!a.length) return 0; const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
    const mdv = med(devs), spread = med(devs.map(d => Math.abs(d - mdv))), tight = devs.length ? devs.filter(d => Math.abs(d) <= 20).length / devs.length : 0;
    const cnt = c => notes.filter(q => q.cat === c).length, N = notes.length;
    const pe = notes.filter(q => q.phraseEnd), peOk = pe.filter(q => q.cat === 'root' || q.cat === 'ct').length;
    const lo = N ? Math.min(...notes.map(q => q.m)) : 0, hi = N ? Math.max(...notes.map(q => q.m)) : 0;
    const res = { N, ct: N ? (cnt('root') + cnt('ct')) / N : 0, sc: N ? cnt('sc') / N : 0, out: N ? cnt('out') / N : 0, phrases: pe.length, phraseOk: pe.length ? peOk / pe.length : 0,
      targets: tN, targetHit: tHit, timing: { median: Math.round(mdv), spread: Math.round(spread), tight, n: devs.length }, range: [lo, hi], notes, key };
    renderSolo(res, CI, S);
    busy = false; $('ubAnalyse').disabled = false;
    $('ubSoloHint').textContent = 'Ausgewertet: ' + $('ubSoloTr').selectedOptions[0].text + ' gegen die Akkorde von Spur ' + (ciIdx + 1) + ' in ' + keyLabel(key) + '.';
    window.__soloRes = res;
    return res;
  }
  const pct = v => Math.round(v * 100) + ' %';
  function renderSolo(r, CI, S) {
    const k = r.key, t = r.timing, mn = m => nn(m, k) + (Math.floor(m / 12) - 1);
    const tile = (v, l, cls) => '<div class="ub-tile ' + (cls || '') + '"><b>' + v + '</b><span>' + l + '</span></div>';
    $('ubTiles').innerHTML = tile(r.N, 'Töne') + tile(pct(r.ct), 'Akkordtöne', 'ct') + tile(pct(r.out), 'Reibung', 'out')
      + tile(r.phrases ? pct(r.phraseOk) : '–', 'Phrasenenden auf Akkordton (' + r.phrases + ')', 'ct')
      + tile(r.targets ? r.targetHit + '/' + r.targets : '–', 'Zieltöne beim Wechsel')
      + tile(t.n ? (t.median > 0 ? '+' : '') + t.median + ' ms' : '–', t.n ? (Math.abs(t.median) <= 8 ? 'Timing: genau' : t.median < 0 ? 'Timing: eher vorgezogen' : 'Timing: eher hinterher') : 'Timing')
      + tile(t.n ? pct(t.tight) : '–', 'Anschläge ±20 ms') + tile(r.N ? mn(r.range[0]) + '–' + mn(r.range[1]) : '–', 'Tonumfang');
    // Verlauf: Akkorde oben, Töne nach Tonhöhe
    const dur = S.L / S.sr, W = Math.max(700, dur * 60), H = 170, top = 26, lo0 = r.N ? Math.min(...r.notes.map(q => q.m)) : 55, hi0 = r.N ? Math.max(...r.notes.map(q => q.m)) : 70, pad = Math.max(3, (12 - (hi0 - lo0)) / 2), lo = lo0 - pad, hi = hi0 + pad;
    const X = s => 10 + s / dur * (W - 20), Y = m => top + 10 + (hi - m) / (hi - lo) * (H - top - 22);
    let h = '';
    const reps = Math.ceil(S.L / CI.L);
    for (let rp = 0; rp < reps; rp++) CI.segs.forEach(s => { const a = (rp * CI.L + s.a) / S.sr, e = Math.min(dur, (rp * CI.L + s.e) / S.sr); if (a >= dur) return; h += '<rect x="' + X(a) + '" y="2" width="' + Math.max(1, X(e) - X(a) - 2) + '" height="20" rx="4" class="tl-ch"/><text x="' + (X(a) + 5) + '" y="16" class="tl-cn">' + (s.name === '–' ? '' : s.name.replace('#', '♯')) + '</text>'; });
    r.notes.forEach(q => { h += '<rect x="' + X(q.on) + '" y="' + (Y(q.m) - 3) + '" width="' + Math.max(3, X(q.end) - X(q.on)) + '" height="6" rx="3" class="tl-n ' + q.cat + '"/>'; if (q.phraseEnd) h += '<circle cx="' + X(q.end) + '" cy="' + Y(q.m) + '" r="6" class="tl-pe ' + q.cat + '"/>'; });
    const svg = $('ubSoloTl'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.minWidth = Math.min(W, 1400) + 'px'; svg.innerHTML = h;
    // Tipps
    const tips = [];
    if (!r.N) tips.push('Keine klaren Töne gefunden – war die Spur sehr leise oder stark verzerrt? Etwas mehr Pegel hilft.');
    else {
      if (r.phraseOk < 0.5 && r.phrases >= 3) tips.push('Nur ' + pct(r.phraseOk) + ' deiner Phrasen enden auf einem Akkordton. Plane das Ende: Grundton oder Terz des klingenden Akkords.');
      else if (r.phrases >= 3) tips.push('Stark: ' + pct(r.phraseOk) + ' der Phrasen landen auf Akkordtönen – genau so klingt ein Solo „zu Hause“.');
      if (r.targets >= 2 && r.targetHit / r.targets < 0.5) tips.push('Bei den Akkordwechseln triffst du ' + r.targetHit + ' von ' + r.targets + ' Zieltönen. Übe, auf der Eins des neuen Akkords seine Terz zu spielen (Solo Finder → „Nächster Wechsel“).');
      if (r.out > 0.2) tips.push(pct(r.out) + ' Reibungstöne – bewusst eingesetzt gut, sonst hilft die Pentatonik der Tonart als sicherer Rahmen.');
      if (t.n >= 6) {
        if (Math.abs(t.median) > 15) tips.push('Du spielst im Schnitt ' + Math.abs(t.median) + ' ms ' + (t.median < 0 ? 'vor' : 'hinter') + ' dem Schlag. ' + (t.median < 0 ? 'Entspann dich in den Groove, lass den Ton kommen.' : 'Leicht hinter dem Schlag kann lässig klingen – wenn gewollt, prima.'));
        if (t.spread > 18) tips.push('Die Anschläge streuen um ±' + t.spread + ' ms. Übe dieselbe Phrase mit dem Tempo-Trainer im Jam langsamer.');
        if (t.tight >= 0.7) tips.push(pct(t.tight) + ' deiner Anschläge sitzen auf ±20 ms – sehr sauberes Timing.');
      }
      if (r.range[1] - r.range[0] < 10 && r.N >= 8) tips.push('Dein Tonumfang ist eng (' + (r.range[1] - r.range[0]) + ' Halbtöne). Probier, eine Phrase eine Oktave höher zu wiederholen.');
    }
    $('ubTips').innerHTML = tips.map(x => '<li>' + x + '</li>').join('');
    $('ubSoloRes').hidden = false;
  }
  $('ubAnalyse').addEventListener('click', () => { analyse().catch(e => { busy = false; $('ubAnalyse').disabled = false; $('ubSoloHint').textContent = 'Auswertung fehlgeschlagen: ' + e.message; }); });

  document.addEventListener('tabchange', e => { if (e.detail === 'ueben') showSec(sec); else if (rec) { /* Aufnahme bleibt bestehen */ } });
  window.Ueben = { plan, renderDay, showSec, analyse, earNew, ear: () => ear, earScore: () => earScore, current, own: () => own, finishBlock };
})();
