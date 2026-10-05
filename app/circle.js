// ---- Quintenzirkel: Dur außen, Moll in der Mitte, verminderte Akkorde innen ----
// Antippen wählt die Tonart und spielt den Akkord; die sieben Akkorde der Tonart sind hervorgehoben.
// Der klingende Akkord des Loopers leuchtet mit, „Ins Griffbrett übernehmen“ setzt Grundton und Modus.
(function () {
  const $ = id => document.getElementById(id);
  const panel = $('panel-quinten'), svg = $('qzSvg');
  if (!panel || !svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  // Position k im Zirkel (0 = C oben, im Uhrzeigersinn Quinten)
  const MAJ = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  const MAJ_ALT = { 6: 'G♭' };
  const MIN = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'D♯m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
  const MIN_ALT = { 6: 'E♭m' };
  const DIM = ['B°', 'F♯°', 'C♯°', 'G♯°', 'D♯°', 'A♯°', 'E♯°', 'C°', 'G°', 'D°', 'A°', 'E°'];
  const SHARPS = ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯'], FLATS = ['B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'];
  const LET = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], LPC = [0, 2, 4, 5, 7, 9, 11];
  const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  const kOfMajorPc = pc => (((pc % 12) + 12) % 12) * 7 % 12;
  const pcOfK = k => (k * 7) % 12;

  // Tonnamen wie im übrigen Programm (englisch: B = H), Vorzeichen passend zur Tonart
  function spell(letterIdx, pc) {
    let d = ((pc - LPC[letterIdx]) % 12 + 12) % 12; if (d > 6) d -= 12;
    return LET[letterIdx] + ACC[d];
  }
  const letterOf = name => LET.indexOf(name[0]);
  const minRoot = k => MIN[k].slice(0, -1);
  const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  // sel = { k, minor }
  function keyInfo(sel) {
    const tonicName = sel.minor ? minRoot(sel.k) : MAJ[sel.k];
    const tonicPc = sel.minor ? (pcOfK(sel.k) + 9) % 12 : pcOfK(sel.k);
    const li = letterOf(tonicName), iv = sel.minor ? SCALE.minor : SCALE.major;
    const notes = iv.map((x, i) => spell((li + i) % 7, (tonicPc + x) % 12));
    const qual = sel.minor ? ['m', 'dim', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', 'dim'];
    const rom = sel.minor ? ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] : ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const chords = notes.map((n, i) => ({ name: n + (qual[i] === 'm' ? 'm' : qual[i] === 'dim' ? '°' : ''), rom: rom[i], pc: (tonicPc + iv[i]) % 12, q: qual[i] }));
    const acc = sel.k === 0 ? 0 : sel.k <= 6 ? sel.k : sel.k - 12;
    return { tonicName, tonicPc, notes, chords, acc };
  }
  function accText(acc) {
    if (!acc) return 'keine Vorzeichen';
    const n = Math.abs(acc), list = (acc > 0 ? SHARPS : FLATS).slice(0, n);
    return n + (acc > 0 ? ' ♯' : ' ♭') + ' (' + list.join(', ') + ')';
  }
  const keyLabel = sel => sel.minor ? minRoot(sel.k) + '-Moll' : MAJ[sel.k] + '-Dur';

  // ---- Zeichnen ----
  const C = 200, RING = { maj: [148, 196], min: [104, 148], dim: [70, 104] };
  function arc(r0, r1, k) {
    const a0 = (k * 30 - 105) * Math.PI / 180, a1 = (k * 30 - 75) * Math.PI / 180;
    const p = (r, a) => (C + r * Math.cos(a)).toFixed(2) + ' ' + (C + r * Math.sin(a)).toFixed(2);
    return 'M' + p(r1, a0) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + p(r1, a1) + 'L' + p(r0, a1) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + p(r0, a0) + 'Z';
  }
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const a in attrs) e.setAttribute(a, attrs[a]); if (parent) parent.appendChild(e); return e; }
  const segs = { maj: [], min: [], dim: [] };
  ['maj', 'min', 'dim'].forEach(ring => {
    const [r0, r1] = RING[ring], rm = (r0 + r1) / 2;
    for (let k = 0; k < 12; k++) {
      const g = el('g', { class: 'qz-seg qz-' + ring, 'data-ring': ring, 'data-k': k, role: 'button', tabindex: ring === 'dim' ? -1 : 0 }, svg);
      el('path', { d: arc(r0, r1, k) }, g);
      const a = (k * 30 - 90) * Math.PI / 180, x = C + rm * Math.cos(a), y = C + rm * Math.sin(a);
      const name = ring === 'maj' ? MAJ[k] : ring === 'min' ? MIN[k] : DIM[k];
      const alt = ring === 'maj' ? MAJ_ALT[k] : ring === 'min' ? MIN_ALT[k] : null;
      const t = el('text', { x: x.toFixed(1), y: (y + (alt ? -4 : 0) - (ring === 'dim' ? 0 : 3)).toFixed(1), class: 'qz-name' }, g); t.textContent = name;
      if (alt) { const t2 = el('text', { x: x.toFixed(1), y: (y + 9).toFixed(1), class: 'qz-alt' }, g); t2.textContent = alt; }
      const r = el('text', { x: x.toFixed(1), y: (y + (alt ? 20 : ring === 'dim' ? 12 : 13)).toFixed(1), class: 'qz-rom' }, g);
      g.label = name + (alt ? ' / ' + alt : ''); g.rom = r;
      g.setAttribute('aria-label', ring === 'maj' ? name + '-Dur' : ring === 'min' ? name.slice(0, -1) + '-Moll' : name + ' vermindert');
      segs[ring].push(g);
    }
  });
  const live = el('path', { class: 'qz-live', d: '' }, svg);
  const mark = el('path', { class: 'qz-mark', d: '' }, svg);
  const cTitle = el('text', { x: C, y: C - 10, class: 'qz-c1' }, svg);
  const cSub = el('text', { x: C, y: C + 12, class: 'qz-c2' }, svg);
  const cLive = el('text', { x: C, y: C + 32, class: 'qz-c3' }, svg);

  let sel = { k: 1, minor: false }, liveKey = null;
  function render() {
    const info = keyInfo(sel), k = sel.k, n = i => (k + i + 12) % 12;
    // Rollen im Zirkel (Stufen der gewählten Tonart)
    const roles = sel.minor
      ? { maj: { [n(-1)]: 'VI', [k]: 'III', [n(1)]: 'VII' }, min: { [n(-1)]: 'iv', [k]: 'i', [n(1)]: 'v' }, dim: { [k]: 'ii°' } }
      : { maj: { [n(-1)]: 'IV', [k]: 'I', [n(1)]: 'V' }, min: { [n(-1)]: 'ii', [k]: 'vi', [n(1)]: 'iii' }, dim: { [k]: 'vii°' } };
    ['maj', 'min', 'dim'].forEach(ring => segs[ring].forEach((g, i) => {
      const r = roles[ring][i];
      g.classList.toggle('in', !!r);
      g.classList.toggle('sel', i === k && ((ring === 'maj' && !sel.minor) || (ring === 'min' && sel.minor)));
      g.rom.textContent = r || '';
    }));
    cTitle.textContent = keyLabel(sel);
    cSub.textContent = accText(info.acc).replace(/ \(.*\)/, '');
    $('qzKey').textContent = keyLabel(sel);
    $('qzAcc').textContent = accText(info.acc);
    $('qzScale').textContent = info.notes.join('  ');
    $('qzChords').innerHTML = info.chords.map((c, i) => '<button class="qz-ch' + (c.q === 'dim' ? ' dim' : '') + '" data-i="' + i + '"><small>' + c.rom + '</small>' + c.name + '</button>').join('');
    const par = sel.minor ? MAJ[k] + '-Dur' : minRoot(k) + '-Moll';
    const sub = sel.minor ? minRoot(n(-1)) + '-Moll' : MAJ[n(-1)] + '-Dur';
    const dom = sel.minor ? minRoot(n(1)) + '-Moll' : MAJ[n(1)] + '-Dur';
    $('qzRel').innerHTML = 'Parallele <b>' + par + '</b> · Subdominante <b>' + sub + '</b> · Dominante <b>' + dom + '</b>';
    const gk = boardKey();
    const same = gk && gk.k === sel.k && gk.minor === sel.minor && !gk.mode;
    $('qzApply').disabled = !!same;
    $('qzApply').textContent = same ? '✓ Im Griffbrett' : 'Ins Griffbrett übernehmen';
    showBoard(gk); renderChord._cur = null;
    $('qzChords').querySelectorAll('.qz-ch').forEach(b => b.addEventListener('click', () => {
      const c = info.chords[+b.dataset.i]; playChord(c.pc, c.q); flashBtn(b);
    }));
  }
  function flashBtn(b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 260); }

  // ---- Tonart des Griffbretts ----
  const MODE_OFF = { 'Ionisch (Dur)': 0, 'Dorisch': 2, 'Phrygisch': 4, 'Lydisch': 5, 'Mixolydisch': 7, 'Äolisch (Moll)': 9, 'Lokrisch': 11 };
  function boardKey() {
    if (typeof rootSel === 'undefined' || typeof NOTES === 'undefined') return null;
    const pc = NOTES.indexOf(rootSel.value), m = modeSel.value, off = MODE_OFF[m];
    if (pc < 0 || off == null) return null;
    if (m === 'Äolisch (Moll)') return { k: kOfMajorPc(pc + 3), minor: true };
    return { k: kOfMajorPc(pc - off), minor: false, mode: off ? m : null, root: rootSel.value };
  }
  function showBoard(gk) {
    const t = $('qzBoard');
    if (!gk) { t.textContent = ''; mark.style.display = 'none'; return; }
    mark.style.display = '';
    const [r0, r1] = gk.minor ? RING.min : RING.maj; mark.setAttribute('d', arc(r0 + 3, r1 - 3, gk.k));
    t.innerHTML = 'Griffbrett: <b>' + (gk.mode ? gk.root.replace('#', '♯') + ' ' + gk.mode + '</b> (Töne von ' + MAJ[gk.k] + '-Dur)' : keyLabel(gk) + '</b>');
  }
  function select(s2, play) {
    sel = s2; render();
    if (play) { const info = keyInfo(sel); playChord(info.tonicPc, sel.minor ? 'm' : ''); }
  }
  svg.addEventListener('click', e => {
    const g = e.target.closest('.qz-seg'); if (!g) return;
    const k = +g.dataset.k, ring = g.dataset.ring;
    if (ring === 'dim') { playChord((pcOfK(k) + 11) % 12, 'dim'); g.classList.add('hit'); setTimeout(() => g.classList.remove('hit'), 260); return; }
    select({ k, minor: ring === 'min' }, true);
  });
  svg.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.qz-seg')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  $('qzApply').addEventListener('click', () => {
    const info = keyInfo(sel);
    rootSel.value = NOTES[info.tonicPc]; modeSel.value = sel.minor ? 'Äolisch (Moll)' : 'Ionisch (Dur)';
    rootSel.dispatchEvent(new Event('change'));
    render();
  });
  $('qzSync').addEventListener('click', () => { const gk = boardKey(); if (gk) select({ k: gk.k, minor: gk.minor }, false); });

  // ---- Akkord anspielen (kurz angeschlagen, über den Master-Bus) ----
  function playChord(rootPc, q) {
    try {
      ensureAudio(); const ac = audioCtx, out = (typeof ensureMasterBus === 'function' ? ensureMasterBus() : null) || ac.destination;
      const iv = q === 'm' ? [0, 3, 7, 12, 15] : q === 'dim' ? [0, 3, 6, 12] : [0, 4, 7, 12, 16];
      const base = 40 + ((rootPc - 4 + 12) % 12);                 // Grundton zwischen E2 und D#3
      const t0 = ac.currentTime + 0.02;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t0); lp.frequency.exponentialRampToValueAtTime(900, t0 + 1.4); lp.Q.value = 0.7;
      const bus = ac.createGain(); bus.gain.value = 0.22; lp.connect(bus); bus.connect(out);
      [-12].concat(iv).forEach((x, i) => {
        const f = 440 * Math.pow(2, (base + 12 + x - 69) / 12), t = t0 + i * 0.022;
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(i === 0 ? 0.32 : 0.22, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        ['triangle', 'sawtooth'].forEach((type, j) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = j ? 4 : -3; const og = ac.createGain(); og.gain.value = j ? 0.18 : 0.8; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.9); });
        g.connect(lp);
      });
      setTimeout(() => { try { bus.disconnect(); } catch (e) {} }, 2300);
    } catch (e) {}
  }

  // ---- klingender Akkord aus dem Looper ----
  function parseChord(name) {
    const m = /^([A-G]#?)(.*)$/.exec(name || ''); if (!m) return null;
    const pc = NOTES.indexOf(m[1]), suf = m[2]; if (pc < 0) return null;
    if (/^dim/.test(suf)) return { ring: 'dim', k: kOfMajorPc(pc + 1) };
    if (/^m(?!aj)/.test(suf)) return { ring: 'min', k: kOfMajorPc(pc + 3) };
    return { ring: 'maj', k: kOfMajorPc(pc) };
  }
  function renderChord() {
    const b = document.querySelector('.chdbadge:not([hidden]) b'), name = b ? b.textContent : '';
    if (name === renderChord._cur) return; renderChord._cur = name;
    const p = name && name !== '–' ? parseChord(name) : null;
    if (!p) { live.setAttribute('d', ''); cLive.textContent = ''; return; }
    const [r0, r1] = RING[p.ring]; live.setAttribute('d', arc(r0 - 1, r1 + 1, p.k));
    cLive.textContent = '♪ ' + name.replace('#', '♯');
  }
  let timer = null;
  function onTab(name) {
    clearInterval(timer); timer = null;
    if (name !== 'quinten') return;
    const gk = boardKey(); if (gk) select({ k: gk.k, minor: gk.minor }, false); else render();
    renderChord._cur = null; renderChord(); timer = setInterval(renderChord, 120);
  }
  document.addEventListener('tabchange', e => onTab(e.detail));
  if (typeof rootSel !== 'undefined') { rootSel.addEventListener('change', () => { if (!panel.hidden) render(); }); modeSel.addEventListener('change', () => { if (!panel.hidden) render(); }); }
  render();
  window.Quinten = { select: (k, minor) => select({ k, minor: !!minor }, false), sel: () => Object.assign({}, sel), info: () => keyInfo(sel), parseChord };
})();
