/* ---------- Rhythmus: realistischeres Drum-Kit, Muster-Vorlagen, Drum-Designer, gemeinsamer Taktgeber ----------
   Ein Schlagzeug für die ganze App: im Looper läuft es im Raster des Loops, sonst frei im eingestellten Tempo.
   Der Bass der Begleitung hängt am selben Taktgeber. */
const Rhythm = (() => {
  const $ = id => document.getElementById(id);
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const INSTR = [
    { id: 'crash', name: 'Becken', midi: 49, pan: -0.28, gain: 0.8 },
    { id: 'ride', name: 'Ride', midi: 51, pan: 0.32, gain: 0.85 },
    { id: 'hho', name: 'HH offen', midi: 46, pan: 0.22, gain: 0.8 },
    { id: 'hhc', name: 'HH zu', midi: 42, pan: 0.22, gain: 0.85 },
    { id: 'hhh', name: 'HH halb', midi: 46, pan: 0.22, gain: 0.8 },
    { id: 'hhp', name: 'HH Fuß', midi: 44, pan: 0.2, gain: 0.8 },
    { id: 'bell', name: 'Ride-Glocke', midi: 53, pan: 0.32, gain: 0.8 },
    { id: 'cowbell', name: 'Kuhglocke', midi: 56, pan: -0.2, gain: 0.75 },
    { id: 'shaker', name: 'Shaker', midi: 70, pan: -0.32, gain: 0.8 },
    { id: 'rim', name: 'Rim', midi: 37, pan: 0.04, gain: 0.85 },
    { id: 'clap', name: 'Clap', midi: 39, pan: 0, gain: 0.8 },
    { id: 'snare', name: 'Snare', midi: 38, pan: 0.04, gain: 1 },
    { id: 'snrim', name: 'Rimshot', midi: 40, pan: 0.04, gain: 0.95 },
    { id: 'tomh', name: 'Tom 1', midi: 48, pan: -0.16, gain: 0.9 },
    { id: 'tomm', name: 'Tom 2', midi: 45, pan: 0.06, gain: 0.9 },
    { id: 'toml', name: 'Stand-Tom', midi: 43, pan: 0.26, gain: 0.95 },
    { id: 'kick', name: 'Kick', midi: 36, pan: 0, gain: 1 }
  ];
  const IDS = INSTR.map(i => i.id);
  const VEL = [0, 0.72, 1, 0.34];                // aus, normal, betont, leise (Ghost)
  const MIDIV = [0, 92, 120, 46];

  // ---- Vorlagen: X betont, x normal, g leise, . aus · 16 = Sechzehntel, 12 = Triolen (Shuffle/12/8) ----
  const P = (group, key, name, res, swing, p) => ({ group, key, name, res, swing, p });
  const PRESETS = [
    P('Blues', 'shuffle_tx', 'Texas Shuffle', 12, 0, { ride: 'X.xX.xX.xX.x', kick: 'X..x..X..x..', snare: '...X.....X..', hhp: '...x.....x..' }),
    P('Blues', 'shuffle_chi', 'Chicago Shuffle', 12, 0, { hhc: 'X.xX.xX.xX.x', kick: 'x..x..x..x..', snare: '..gX.g..gX.g' }),
    P('Blues', 'slow128', 'Slow Blues 12/8', 12, 0, { hhc: 'XxxXxxXxxXxx', kick: 'X.....X....x', snare: '...X.....X..' }),
    P('Blues', 'slowride', 'Slow Blues mit Ride', 12, 0, { ride: 'XxxXxxXxxXxx', kick: 'X.....X.....', snare: '...X.....X.g', hhp: '...x.....x..' }),
    P('Blues', 'halfshuffle', 'Half-Time Shuffle', 12, 0, { hhc: 'X.xX.xX.xX.x', kick: 'X....x...x..', snare: '..g..gX.g..g' }),
    P('Blues', 'boogie', 'Boogie', 12, 0, { ride: 'X.xX.xX.xX.x', kick: 'X..x..X..x..', snare: '...X.....X..', hhp: '...x.....x..' }),
    P('Blues', 'jump', 'Jump Blues (Swing)', 12, 0, { ride: 'X..x.xX..x.x', hhp: '...x.....x..', kick: 'g..g..g..g..', snare: '.......g...g' }),
    P('Blues', 'shuffle16', 'Rock-Shuffle', 16, 100, { kick: 'X.......X.x.....', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' }),
    P('Blues', 'bluesrock', 'Blues-Rock (gerade)', 16, 0, { kick: 'X......xX.x.....', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' }),
    P('Blues', 'train', 'Train Beat', 16, 25, { kick: 'X.......X.......', snare: 'ggxgXgxgggxgXgxg' }),
    P('Blues', 'funkyblues', 'Funky Blues', 16, 20, { kick: 'X..x..x...X..x..', snare: '....X..g.g..X..g', hhc: 'XxxxXxxxXxxxXxxx' }),
    P('Blues', 'bluesballad', 'Blues-Ballade (Rim)', 12, 0, { hhc: 'xggxggxggxgg', rim: '...x.....x..', kick: 'X.....x.....' }),
    P('Blues', 'delta', 'Delta Stomp', 16, 0, { kick: 'X...X...X...X...', clap: '....X.......X...', shaker: 'x.x.x.x.x.x.x.x.' }),
    P('Blues', 'kc_shuffle', 'Kansas City Shuffle', 12, 0, { ride: 'X.xX.xX.xX.x', hhp: '...x.....x..', kick: 'g..g..g..g..', snare: 'g.gX.gg.gX.g' }),
    P('Blues', 'double_shuffle', 'Double Shuffle (Snare)', 12, 0, { hhc: 'X.xX.xX.xX.x', snare: 'x.xX.xx.xX.x', kick: 'X..x..X..x..' }),
    P('Blues', 'gospel_shuffle', 'Gospel-Shuffle', 12, 0, { hhc: 'X.xX.xX.xX.x', kick: 'X..x..X..x.x', snare: '..gX.gg.gX.g', hhp: '...x.....x..' }),
    P('Blues', 'boogie_train', 'Boogie-Train (Snare-Triolen)', 12, 0, { snare: 'XgxXgxXgxXgx', kick: 'X..x..X..x..', crash: 'X...........' }),
    P('Blues', 'rumba_blues', 'Blues-Rumba', 16, 0, { kick: 'X..x..x...x.....', rim: 'x..x..x...x.x...', hhc: 'x.x.x.x.x.x.x.x.', tomh: '..............x.' }),
    P('Blues', 'minor_blues', 'Moll-Blues (laid back)', 16, 30, { kick: 'X.....x...x.....', snare: '....X.......X...', hhc: 'x.gxx.gxx.gxx.gx' }),
    P('Blues', 'swamp', 'Swamp Blues (Toms)', 12, 0, { kick: 'X.....X..x..', toml: 'x..x..x..x..', rim: '...x.....x..', shaker: 'x.xx.xx.xx.x' }),
    P('Blues', 'blues128half', 'Blues 12/8 Halftime', 12, 0, { hhc: 'xxxxxxxxxxxx', kick: 'X.....x.....', snare: '......X.....' }),
    P('Blues', 'stop_time', 'Stop-Time (Akzent auf 1)', 12, 0, { crash: 'X...........', kick: 'X...........', snare: 'X...........', hhp: '...x..x..x..' }),
    P('Rock & Pop', 'rock', 'Rock', 16, 0, { kick: 'X.....x.X.......', snare: '....X.......X...', hhc: 'X.x.X.x.X.x.X.x.' }),
    P('Rock & Pop', 'pop', 'Pop (16tel)', 16, 0, { kick: 'X......xX.x.....', snare: '....X.......X...', hhc: 'XxxxXxxxXxxxXxxx' }),
    P('Rock & Pop', 'halftime', 'Halftime', 16, 0, { kick: 'X.....x...x.....', snare: '........X.......', hhc: 'X.x.x.x.X.x.x.x.' }),
    P('Rock & Pop', 'ballad', 'Ballade', 16, 0, { kick: 'X.........x.....', rim: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' }),
    P('Rock & Pop', 'punk', 'Punk', 16, 0, { kick: 'X...X.x.X...X.x.', snare: '....X.......X...', hhc: 'X.X.X.X.X.X.X.X.' }),
    P('Rock & Pop', 'metal', 'Metal', 16, 0, { kick: 'xxxxxxxxxxxxxxxx', snare: '....X.......X...', crash: 'x...x...x...x...' }),
    P('Rock & Pop', 'indie', 'Indie (Toms)', 16, 0, { kick: 'X.....X.X.......', snare: '....X.......X...', toml: 'x.x.x.x.x.x.x.x.' }),
    P('Rock & Pop', 'ballad68', '6/8-Ballade', 12, 0, { hhc: 'xxxxxxxxxxxx', kick: 'X.....x.....', rim: '...X.....X..' }),
    P('Rock & Pop', 'synthwave', 'Synthwave (80er)', 16, 0, { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.', tomh: '..............x.' }),
    P('Funk & Soul', 'funk', 'Funk', 16, 10, { kick: 'X..x......X..x..', snare: '....X..g.g..X..g', hhc: 'XxxxXxxxXxxxXx.x', hho: '..............x.' }),
    P('Funk & Soul', 'neosoul', 'Neo-Soul (laid back)', 16, 45, { kick: 'X......x..X.....', snare: '....X..g....X.g.', hhc: 'x.x.x.x.x.x.x.x.' }),
    P('Funk & Soul', 'hiphop', 'Hip-Hop', 16, 35, { kick: 'X......x..X.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' }),
    P('Funk & Soul', 'motown', 'Motown', 16, 0, { kick: 'X.....x.X.......', snare: 'x...X...x...X...', shaker: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.' }),
    P('Funk & Soul', 'disco', 'Disco', 16, 0, { kick: 'X...X...X...X...', snare: '....X.......X...', hhc: 'x...x...x...x...', hho: '..x...x...x...x.' }),
    P('Funk & Soul', 'lofi', 'Lo-Fi Hip-Hop', 16, 55, { kick: 'X.......x.X.....', snare: '....X.......X...', hhc: 'x.x.x.x.x.x.x.x.', shaker: '..g...g...g...g.' }),
    P('Funk & Soul', 'breakbeat', 'Breakbeat', 16, 10, { kick: 'X.x.......x.....', snare: '....X..g.g..X..x', hhc: 'x.x.x.x.x.x.x.x.' }),
    P('Latin & Welt', 'bossa', 'Bossa Nova', 16, 0, { kick: 'X..xX..xX..xX..x', rim: 'x..x..x...x..x..', shaker: 'xgxgxgxgxgxgxgxg' }),
    P('Latin & Welt', 'reggae', 'Reggae One Drop', 16, 20, { kick: '........X.......', rim: '........X.......', hhc: 'x.x.x.x.x.x.x.x.' }),
    P('Latin & Welt', 'afro128', 'Afro 12/8', 12, 0, { ride: 'X.x.xx.x.x.x', kick: 'X.....X.....', shaker: 'xggxggxggxgg', toml: '...x.....x..' }),
    P('Latin & Welt', 'samba', 'Samba', 16, 0, { kick: 'X..xX..xX..xX..x', rim: 'x.x..x.x.x..x.x.', shaker: 'xgxgxgxgxgxgxgxg' }),
    P('Latin & Welt', 'cumbia', 'Cumbia', 16, 0, { kick: 'X...X...X...X...', rim: '..x...x...x...x.', shaker: 'x.xxx.xxx.xxx.xx' }),
    P('Elektronisch', 'edm', 'Four on the Floor', 16, 0, { kick: 'X...X...X...X...', clap: '....X.......X...', hho: '..x...x...x...x.', hhc: '.g.g.g.g.g.g.g.g' }),
    P('Elektronisch', 'house', 'House', 16, 0, { kick: 'X...X...X...X...', clap: '....X.......X...', hho: '..x...x...x...x.', shaker: 'xgxgxgxgxgxgxgxg' }),
    P('Elektronisch', 'techno', 'Techno', 16, 0, { kick: 'X...X...X...X...', hho: '..x...x...x...x.', clap: '....x.......x...', rim: '.x..x.x..x...x..' }),
    P('Elektronisch', 'trap', 'Trap (Halftime, schnelle Hats)', 16, 0, { kick: 'X......x..X.....', snare: '........X.......', hhc: 'xxxxxxxxXxxxxxxx', hho: '..............x.' }),
    P('Sonstiges', 'viking', 'Wikinger-Trommeln', 16, 0, { kick: 'X..x..X.X..x..X.', toml: '..x...x...x.X.x.', tomh: '............x...', crash: 'X...............' }),
    P('Sonstiges', 'hats', 'Nur Hi-Hat', 16, 0, { hhc: 'X.x.X.x.X.x.X.x.' }),
    P('Sonstiges', 'quarters', 'Nur Viertel (Rim)', 16, 0, { rim: 'X...x...x...x...' })
  ];
  const byKey = {}; PRESETS.forEach(p => { byKey[p.key] = p; });
  const OLD = { latin: 'bossa', funk: 'funk', rock: 'rock', halftime: 'halftime', hats: 'hats', shuffle: 'shuffle16', hiphop: 'hiphop', disco: 'disco', reggae: 'reggae', metal: 'metal', viking: 'viking', pop: 'pop', ballad: 'ballad' };

  const blank = res => { const o = {}; IDS.forEach(id => { o[id] = new Array(res).fill(0); }); return o; };
  function fromPreset(pr) {
    const o = blank(pr.res);
    Object.entries(pr.p).forEach(([id, s]) => { for (let k = 0; k < pr.res; k++) { const c = s[k]; o[id][k] = c === 'X' ? 2 : c === 'x' ? 1 : c === 'g' ? 3 : 0; } });
    return o;
  }

  // ---- Zustand ----
  let res = 16, pat = null, muted = {}, on = false, bassNeed = false, presetKey = 'rock';
  const styleEl = $('loopDrumStyle'), btn = $('loopDrums'), volEl = $('loopDrumVol'), swingEl = $('drumSwing'), humanEl = $('drumHuman'), fillsEl = $('drumFills'), resEl = $('drumRes'), gridEl = $('drumGrid');
  // Vorlagen-Auswahl mit Gruppen
  styleEl.innerHTML = '';
  let og = null, lastGroup = "";
  PRESETS.forEach(p => { if (p.group !== lastGroup) { og = document.createElement("optgroup"); og.label = p.group; styleEl.appendChild(og); lastGroup = p.group; } og.appendChild(new Option(p.name, p.key)); });
  const ogC = document.createElement('optgroup'); ogC.label = 'Eigene'; ogC.appendChild(new Option('Entwurf (zuletzt bearbeitet)', 'custom')); styleEl.appendChild(ogC);
  // Gespeicherte eigene Muster (bleiben auf dem iPad)
  let user = []; try { user = JSON.parse(pref('3nps-userpatterns', '[]')) || []; } catch (e) { user = []; }
  const ogU = document.createElement('optgroup'); ogU.label = 'Meine Muster'; styleEl.appendChild(ogU);
  function renderUser() {
    ogU.innerHTML = ''; user.forEach(u => ogU.appendChild(new Option(u.name, u.key)));
    ogU.hidden = !user.length;
  }
  renderUser();
  const findUser = k => user.find(u => u.key === k);
  function storeUser() { setPref('3nps-userpatterns', JSON.stringify(user)); }

  function loadState() {
    let k = pref('3nps-drumstyle', 'shuffle_tx'); k = OLD[k] || k;
    let saved = null; try { saved = JSON.parse(pref('3nps-drumpattern2', 'null')); } catch (e) {}
    const uk = findUser(k);
    if (uk) {
      res = uk.res === 12 ? 12 : 16; pat = blank(res);
      IDS.forEach(id => { if (uk.steps[id]) for (let s = 0; s < res; s++) pat[id][s] = uk.steps[id][s] | 0; });
      presetKey = k;
    } else if (k === 'custom' && saved && saved.steps) {
      res = saved.res === 12 ? 12 : 16; pat = blank(res);
      IDS.forEach(id => { if (saved.steps[id]) for (let s = 0; s < res; s++) pat[id][s] = saved.steps[id][s] | 0; });
      presetKey = 'custom';
    } else { presetKey = byKey[k] ? k : 'shuffle_tx'; const pr = byKey[presetKey]; res = pr.res; pat = fromPreset(pr); }
    styleEl.value = presetKey;
    swingEl.value = pref('3nps-swing', String(byKey[presetKey] ? byKey[presetKey].swing : 0));
    humanEl.value = pref('3nps-human', '35');
    fillsEl.value = pref('3nps-fills', '0');
    volEl.value = pref('3nps-drumvol', '70');
  }
  loadState();
  const stepsCopy = () => { const st = {}; IDS.forEach(id => { st[id] = pat[id].slice(); }); return st; };
  // Änderungen: an einem eigenen Muster direkt dort speichern, an einer Vorlage als „Entwurf“
  function saveCustom() {
    const u = findUser(presetKey);
    if (u) { u.res = res; u.steps = stepsCopy(); u.swing = parseInt(swingEl.value); storeUser(); return; }
    presetKey = 'custom'; styleEl.value = 'custom'; setPref('3nps-drumstyle', 'custom');
    setPref('3nps-drumpattern2', JSON.stringify({ res, steps: stepsCopy() }));
    showSaveUi();
  }
  function showSaveUi() {
    const u = findUser(presetKey);
    $('drumDelBtn').hidden = !u;
    $('drumSaveBtn').textContent = u ? 'Als neues Muster speichern' : 'Muster speichern';
    $('drumSaveName').placeholder = u ? 'Name für eine Kopie' : 'Name, z. B. Mein Shuffle';
  }

  // ---- Klang: Kit im Hintergrund erzeugen, Kanäle mit Panorama, Raum, Bus-Kompressor ----
  // Das Kit wird gleich beim Start der App im Hintergrund erzeugt (fest 48 kHz – der Browser rechnet bei Bedarf um).
  // So klingt schon der allererste Schlag richtig; vorher sprangen kurz Ersatzstimmen ein, die knisterten.
  let kit = null, kitRaw = null, kitBusy = false, kitFailed = false, bus = null, wantOn = false;
  let roomOn = true; try { roomOn = localStorage.getItem('3nps-drumroom') !== '0'; } catch (e) {}   // Raumhall der Drums
  // 7-Band-EQ für die Drums
  let drumEq = EQ7.flat();
  try { drumEq = EQ7.norm(JSON.parse(localStorage.getItem('3nps-eq2-drums') || 'null') || JSON.parse(localStorage.getItem('3nps-eq-drums') || 'null')); } catch (e) {}
  const eqBtn = document.getElementById('drumEqBtn'), eqPanel = document.getElementById('drumEqPanel');
  const showEqBtn = () => { const on = !EQ7.isFlat(drumEq); eqBtn.classList.toggle('on', on); eqBtn.textContent = on ? 'EQ ●' : 'EQ'; };
  function setDrumEq(v, fromUi) {
    drumEq = EQ7.norm(v);
    if (bus) bus.eq.set(drumEq, true);
    if (!fromUi) eqUi.set(drumEq);
    try { localStorage.setItem('3nps-eq-drums', JSON.stringify(EQ7.legacy(drumEq))); localStorage.setItem('3nps-eq2-drums', JSON.stringify(drumEq)); } catch (e) {}
    showEqBtn();
  }
  const eqUi = EQ7.widget(eqPanel, { vals: drumEq, presets: EQ7.PRESETS_DRUMS, onChange: v => setDrumEq(v, true), analyser: () => { if (typeof audioCtx === 'undefined' || !audioCtx) return null; return ensureBus().eq.analyser(); } });
  eqBtn.addEventListener('click', () => { eqPanel.hidden = !eqPanel.hidden; eqBtn.setAttribute('aria-expanded', String(!eqPanel.hidden)); eqBtn.classList.toggle('active', !eqPanel.hidden); if (!eqPanel.hidden) eqUi.draw(); });
  showEqBtn();
  const KIT_SR = 48000;
  function kitToBuffers() {
    if (kit || !kitRaw || typeof audioCtx === 'undefined' || !audioCtx) return;
    const k = {};
    Object.entries(kitRaw).forEach(([id, layers]) => { k[id] = layers.map(l => l.map(a => { const b = audioCtx.createBuffer(1, a.length, KIT_SR); b.copyToChannel(a, 0); return b; })); });
    kit = k; kitRaw = null;
    if (wantOn) { wantOn = false; setOn(true); }
  }
  function makeKit() {
    if (kit || kitRaw || kitBusy) { kitToBuffers(); return; }
    kitBusy = true;
    const done = data => { kitRaw = data; kitBusy = false; kitToBuffers(); };
    try {
      const src = synthKit.toString() + '\nonmessage = e => { const r = synthKit(e.data.sr); const tr = []; Object.values(r).forEach(l => l.forEach(v => v.forEach(a => tr.push(a.buffer)))); postMessage(r, tr); };';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
      w.onmessage = e => { done(e.data); w.terminate(); };
      w.onerror = () => { w.terminate(); setTimeout(() => done(synthKit(KIT_SR)), 10); };
      w.postMessage({ sr: KIT_SR });
    } catch (e) { setTimeout(() => done(synthKit(KIT_SR)), 10); }
    setTimeout(() => { if (!kit && !kitRaw) { kitFailed = true; if (wantOn) { wantOn = false; setOn(true); } } }, 4000);
  }
  setTimeout(makeKit, 250);
  function roomIR(sr) {
    const n = Math.round(sr * 0.9), b = audioCtx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, a = 0.12 + 0.6 * Math.min(1, t / 0.4); lp += (Math.random() * 2 - 1 - lp) * (1 - a); d[i] = lp * Math.exp(-t / 0.17); }
      [0.007, 0.011, 0.017, 0.023, 0.031].forEach((t, k) => { d[Math.round(t * sr * (1 + c * 0.07))] += (c ? -1 : 1) * 0.5 / (k + 1); });
    }
    return b;
  }
  function ensureBus() {
    if (bus) return bus;
    ensureAudio(); makeKit();
    const master = audioCtx.createGain(); master.gain.value = parseInt(volEl.value) / 100;
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 2.5; comp.knee.value = 8; comp.attack.value = 0.008; comp.release.value = 0.14;
    const sum = audioCtx.createGain(); sum.gain.value = 0.9;
    const eq = EQ7.chain(audioCtx); eq.set(drumEq);
    sum.connect(comp); comp.connect(master); master.connect(eq.input); eq.output.connect(ensureMasterBus());
    const room = audioCtx.createConvolver(); room.buffer = roomIR(audioCtx.sampleRate);
    const wet = audioCtx.createGain(); wet.gain.value = 0.22; room.connect(wet); wet.connect(sum);
    const ch = {};
    INSTR.forEach(i => {
      const g = audioCtx.createGain(); g.gain.value = i.gain;
      let p = null; try { p = audioCtx.createStereoPanner(); p.pan.value = i.pan; } catch (e) {}
      if (p) { g.connect(p); p.connect(sum); p.connect(room); } else { g.connect(sum); g.connect(room); }
      ch[i.id] = g;
    });
    // Fallback-Stimmen, solange das Kit noch erzeugt wird (erste Sekunde nach dem Start)
    bus = { master, sum, ch, open: null, dryGain: sum, reverbSend: room, room, wet, eq, linked: true };
    if (!roomOn) { try { wet.disconnect(); } catch (e) {} }
    return bus;
  }
  // ---- Raumhall an/aus (aus: Hall-Berechnung entfällt – hilft bei Aussetzern mit kleinem USB-Puffer) ----
  const roomBtn = document.getElementById('drumRoomBtn');
  function setRoom(v) {
    roomOn = !!v;
    try { localStorage.setItem('3nps-drumroom', roomOn ? '1' : '0'); } catch (e) {}
    if (roomBtn) { roomBtn.classList.toggle('active', roomOn); roomBtn.setAttribute('aria-pressed', String(roomOn)); roomBtn.textContent = roomOn ? 'Raum' : 'Raum aus'; }
    if (bus) { try { if (roomOn) bus.wet.connect(bus.sum); else bus.wet.disconnect(); } catch (e) {} }
  }
  if (roomBtn) { roomBtn.addEventListener('click', () => setRoom(!roomOn)); setRoom(roomOn); }
  // ---- v98/v99: echte Schlagzeuge (Aufnahmen, alle CC0) als Option; Synthese bleibt ----
  // Kits: jazz = „Virtuosity Drums“, rock = „Big Rusty Drums“ (Sticks), brush = „Big Rusty Drums“ (Besen)
  const KITS = { synth: 'Synthese', jazz: 'Jazz / Club (echt)', rock: 'Rock (echt)', brush: 'Besen (echt)' };
  const ALIAS = { tomm: 'tomh', snrim: 'snare', hhh: 'hho', bell: 'ride' };   // fehlt ein Instrument im Kit: nächstes passendes
  let kitName = 'synth', kitReal = null, kitRealName = '', realBusy = null, realErr = '';
  try { const k = localStorage.getItem('3nps-drumkit'); kitName = k === 'real' ? 'jazz' : KITS[k] ? k : 'synth'; } catch (e) {}
  let realOn = kitName !== 'synth';
  const kitSel = document.getElementById('drumKitSel');
  const TT = x => (typeof T === 'function' ? T(x) : x);
  if (kitSel) { kitSel.innerHTML = Object.entries(KITS).map(([k, n]) => '<option value="' + k + '">' + TT(n) + '</option>').join(''); }
  function paintKitBtn() {
    if (!kitSel) return;
    kitSel.value = kitName;
    const busyTxt = TT('lädt …'), o = kitSel.querySelector('option[value="' + kitName + '"]');
    kitSel.querySelectorAll('option').forEach(x => { x.textContent = TT(KITS[x.value]) + (x === o && realBusy ? ' – ' + busyTxt : ''); });
    kitSel.classList.toggle('active', realOn && !!kitReal);
    kitSel.title = TT(realErr ? 'Echtes Kit konnte nicht geladen werden – es spielt die Synthese.' : 'Schlagzeug-Klang: Synthese oder echtes Kit (Aufnahmen, einmalig ca. 5 MB je Kit)');
  }
  function loadReal() {
    const want = kitName; if (want === 'synth') return Promise.resolve(null);
    if (kitReal && kitRealName === want) return Promise.resolve(kitReal);
    if (realBusy && realBusy.kit === want) return realBusy;
    if (typeof ensureAudio === 'function') ensureAudio();
    realErr = '';
    const pr = (async () => {
      const [ix, ab] = await Promise.all([fetch('drums/' + want + '.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }), fetch('drums/' + want + '.flac').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })]);
      const all = await audioCtx.decodeAudioData(ab), sr = all.sampleRate, nc = all.numberOfChannels, g = 1 / (ix.gain || 1), K = {};
      const ch = [all.getChannelData(0), all.getChannelData(nc > 1 ? 1 : 0)];
      Object.entries(ix.hits).forEach(([id, layers]) => {
        K[id] = layers.map(row => row.map(([st, len]) => {
          const a = Math.round(st * sr), n = Math.max(1, Math.round(len * sr)), b = audioCtx.createBuffer(2, n, sr);
          for (let c = 0; c < 2; c++) { const d = b.getChannelData(c), src = ch[c]; for (let i = 0; i < n; i++) d[i] = (src[a + i] || 0) * g; }
          return b;
        }));
      });
      if (kitName === want) { kitReal = K; kitRealName = want; }   // nur das gewählte Kit im Speicher halten
      return K;
    })().catch(e => { realErr = String(e && e.message || e); if (kitName === want) { realOn = false; kitName = 'synth'; } return null; })
      .finally(() => { if (realBusy === pr) realBusy = null; paintKitBtn(); });
    pr.kit = want; realBusy = pr; paintKitBtn(); return pr;
  }
  function setKit(k) {
    k = k === true ? 'jazz' : k === false ? 'synth' : KITS[k] ? k : 'synth';
    kitName = k; realOn = k !== 'synth'; if (kitRealName !== k) { kitReal = null; kitRealName = ''; }
    try { localStorage.setItem('3nps-drumkit', k); } catch (e) {}
    if (realOn) loadReal(); paintKitBtn();
    document.dispatchEvent(new CustomEvent('drumkit', { detail: k }));
  }
  if (kitSel) kitSel.addEventListener('change', () => setKit(kitSel.value));
  if (realOn) setTimeout(loadReal, 600);
  paintKitBtn();
  function connectBus(v) {
    if (!bus || bus.linked === v) return;
    try { if (v) bus.eq.output.connect(ensureMasterBus()); else bus.eq.output.disconnect(); bus.linked = v; } catch (e) {}
  }
  function setLite(v) { /* Klang bleibt im Sparmodus unverändert */ }
  function hit(id, t, v) {
    const b = ensureBus(); if (!b.linked) connectBus(true);
    if (id === 'hhc' || id === 'hhp' || id === 'hhh') { if (b.open) { try { b.open.gain.cancelScheduledValues(t); b.open.gain.setTargetAtTime(0, t, 0.012); } catch (e) {} b.open = null; } }
    if (!kit) { // einfache Ersatzstimmen
      if (id === 'kick') playKick(t, b); else if (id === 'snare' || id === 'clap' || id === 'rim') playSnare(t, b); else if (id !== 'crash' && id !== 'tomh' && id !== 'toml') playHihat(t, v > 0.8, b);
      return;
    }
    const real = realOn && kitReal && (kitReal[id] || kitReal[ALIAS[id]]), layers = real || kit[id] || kit[ALIAS[id]]; if (!layers) return;   // echtes Kit, wo vorhanden
    const L = v < 0.5 ? 0 : v < 0.86 ? 1 : 2, arr = layers[L], buf = arr[(Math.random() * arr.length) | 0];
    const s = audioCtx.createBufferSource(); s.buffer = buf;
    s.playbackRate.value = 1 + (Math.random() - 0.5) * 0.012;
    const g = audioCtx.createGain(); g.gain.value = Math.pow(v / [0.4, 0.75, 1][L], 0.9) * (L === 2 ? 1 : 1);
    s.connect(g); g.connect(b.ch[id]); s.start(t);
    vEnd(s, [g]);                                   // nach dem Ausklingen abklemmen (Safari hält sonst alles im Graphen)
    pend.push([t, s]);
    if (id === 'hho' || id === 'hhh') b.open = g;
  }
  // Geplante, noch nicht erklungene Schläge – bei einem Rastersprung (neuer Loop-Anfang) werden sie verworfen
  const pend = [];
  function dropPending(after) {
    for (const [t, s] of pend) if (t > after) { try { s.stop(); } catch (e) {} }
    pend.length = 0;
  }
  let lateHits = 0;

  // ---- Taktgeber ----
  let gridFn = null, freeAnchor = 0, lastG = null, timer = null, nextT = 0, lastAnchor = null, lastRes = 0;
  const AHEAD = 0.3;
  const bpmNow = () => parseFloat(document.getElementById('bpm').value) || 80;
  const barDur = () => 240 / bpmNow();
  const stepDur = () => barDur() / res;
  function grid() {
    const g = gridFn ? gridFn() : null;
    if (g) { lastG = g; return g; }
    if (lastG) { freeAnchor = lastG.anchor; lastG = null; }
    return { anchor: freeAnchor, cycle: 0 };
  }
  const played = [];
  const listeners = [];
  function stepInfo(tm, g) {
    const sd = stepDur(), bd = barDur();
    const cyc = g.cycle ? g.anchor + Math.floor((tm - g.anchor + 1e-6) / g.cycle) * g.cycle : g.anchor;
    const k = Math.round((tm - cyc) / sd);
    const barsPerCycle = g.cycle ? Math.max(1, Math.round(g.cycle / bd)) : 0;
    const cycIdx = g.cycle ? Math.round((cyc - g.anchor) / g.cycle) : 0;
    const bar = (g.cycle ? cycIdx * barsPerCycle : 0) + Math.floor(k / res);
    return { cyc, k, step: ((k % res) + res) % res, bar };
  }
  function firstAfter(g, t) {
    const sd = stepDur();
    const base = g.cycle ? g.anchor + Math.floor((t - g.anchor) / g.cycle) * g.cycle : g.anchor;
    return base + Math.ceil((t - base) / sd - 1e-6) * sd;
  }
  // Fill am Ende jedes n-ten Takts, danach Becken auf der Eins
  function barPattern(bar) {
    const n = parseInt(fillsEl.value) || 0;
    if (!n) return { p: pat, crash: false };
    const isFill = ((bar % n) + n) % n === n - 1, after = bar > 0 && ((bar % n) + n) % n === 0;
    if (!isFill) return { p: pat, crash: after };
    const p = {}; IDS.forEach(id => { p[id] = pat[id].slice(); });
    // v99: Fill-Komplexität bestimmt Länge und Dichte (Snare → Toms, bei viel auch Kick darunter)
    const fc = typeof dr !== 'undefined' ? dr.fcx : 50, beat = res / 4, from = fc < 30 ? 3 * beat : 2 * beat;
    const step = fc < 55 && res === 16 ? 2 : 1;
    for (let s = from; s < res; s++) ['hhc', 'hhh', 'hho', 'ride', 'bell', 'shaker', 'cowbell', 'rim', 'clap', 'snare', 'snrim', 'tomh', 'tomm', 'toml', 'crash'].forEach(id => { p[id][s] = 0; });
    const drums = fc < 40 ? ['snare'] : fc < 70 ? ['snare', 'snare', 'tomh', 'toml'] : ['snare', 'tomh', 'tomm', 'toml'];
    const hits = []; for (let s = from; s < res; s += step) hits.push(s);
    hits.forEach((s, i) => { const seg = Math.min(drums.length - 1, Math.floor(i / hits.length * drums.length)), id = drums[seg]; p[id][s] = (s - from) % beat === 0 ? 2 : 1; });
    if (fc >= 70) for (let s = from; s < res; s += beat / (res === 16 ? 2 : 1.5) | 0) p.kick[s] = 1;
    else p.kick[from] = Math.max(p.kick[from], 1);
    return { p, crash: false };
  }
  // v99: Swing auf Achteln (1/8) oder Sechzehnteln (1/16); Intensität/Dynamik; Feel (Pull = später, Push = früher)
  function swingDelay(step, sw, sd) {
    if (typeof dr !== 'undefined' && dr.swu === 16) return step % 2 === 1 ? sw * sd * 2 / 3 : 0;
    return step % 4 === 2 ? sw * sd * 2 / 3 : step % 2 === 1 ? sw * sd / 3 : 0;
  }
  function drVel(v) {
    if (typeof dr === 'undefined') return v;
    v = 0.75 + (v - 0.75) * (dr.dyn / 50);
    return Math.max(0.05, v * (0.62 + 0.5 * dr.inten / 100));
  }
  const FEEL_IDS = { snare: 1, snrim: 1, rim: 1, clap: 1, hhc: 1, hhh: 1, hho: 1, ride: 1, bell: 1, shaker: 1, cowbell: 1 };
  function drFeel(id) { return typeof dr !== 'undefined' && FEEL_IDS[id] ? -dr.feel / 100 * 0.018 : 0; }
  let lastSd = 0;
  function tick() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime, g = grid(), sd = stepDur();
    // Tempo geändert, Drums laufen frei: Schrittzählung nahtlos fortsetzen (kein Sprung im Muster)
    if (!g.cycle && lastSd && Math.abs(sd - lastSd) > 1e-9 && nextT > now - 0.2 && lastAnchor === g.anchor) {
      const kNext = Math.round((nextT - g.anchor) / lastSd);
      freeAnchor = nextT - kNext * sd; g.anchor = freeAnchor; lastAnchor = freeAnchor;
    }
    lastSd = sd;
    // Rastersprung (neuer Loop-Anfang, anderes Raster): schon geplante Schläge verwerfen und neu ansetzen
    if (lastAnchor !== g.anchor || lastRes !== res || nextT < now - 0.2) {
      const jump = lastAnchor !== null;
      lastAnchor = g.anchor; lastRes = res;
      if (jump && nextT > now) { dropPending(now + 0.012); nextT = firstAfter(g, now + 0.03); }
      else nextT = firstAfter(g, Math.max(now + 0.03, nextT - 0.001));
    }
    while (pend.length && pend[0][0] < now - 0.05) pend.shift();
    const sw = res === 16 ? parseInt(swingEl.value) / 100 : 0, hu = parseInt(humanEl.value) / 100;
    // 0,3 s Vorlauf: kurze Hänger der Oberfläche (Speicher aufräumen, Zeichnen, Laden) verschieben keinen Schlag
    while (nextT < now + AHEAD) {
      const si = stepInfo(nextT, g), step = si.step;
      const delay = swingDelay(step, sw, sd);
      const tt = Math.max(now, nextT + delay);
      if (on) {
        const bp = barPattern(si.bar), beatLen = res / 4;
        IDS.forEach(id => {
          let lv = bp.p[id][step];
          if (bp.crash && step === 0 && (id === 'crash' || id === 'kick')) lv = Math.max(lv === 3 ? 1 : lv, 2);
          if (!lv || muted[id]) return;
          let v = VEL[lv];
          if (lv === 1 && (id === 'hhc' || id === 'hhh' || id === 'ride' || id === 'shaker' || id === 'hho')) v *= step % beatLen === 0 ? 1.08 : (res === 16 && step % 2 ? 0.82 : 0.92);
          v = drVel(v);                                   // v99: Intensität und Dynamik
          v *= 1 + (Math.random() - 0.5) * 0.3 * hu;
          const jt = (Math.random() - 0.5) * 0.012 * hu + drFeel(id);
          if (tt + jt < now) lateHits++;
          hit(id, Math.max(now, tt + jt), Math.min(1.05, Math.max(0.08, v)));
        });
      }
      listeners.forEach(f => { try { f(step, tt, sd, si.bar, pat); } catch (e) {} });
      played.push([nextT, step]); if (played.length > 64) played.splice(0, 32);
      let nx = si.cyc + (si.k + 1) * sd;
      if (g.cycle && nx > si.cyc + g.cycle - sd * 0.5) nx = si.cyc + g.cycle;
      nextT = nx;
    }
  }
  let jamNeed = false;
  function clock() {
    const need = on || bassNeed || jamNeed;
    if (need && !timer) {
      ensureAudio(); ensureBus();
      if (!gridFn || !gridFn()) { if (!lastG) freeAnchor = audioCtx.currentTime + 0.06; }
      lastAnchor = null; nextT = 0;
      timer = setInterval(tick, 25); tick();
    } else if (!need && timer) { clearInterval(timer); timer = null; played.length = 0; }
  }
  function setOn(v) {
    if (v && !kit && !kitFailed) {               // Kit noch nicht fertig: kurz warten statt Ersatzstimmen
      ensureAudio(); makeKit(); kitToBuffers();
      if (!kit) { wantOn = true; btn.classList.add('active'); btn.textContent = 'Drums laden …'; return; }
    }
    if (!v) wantOn = false;
    on = !!v;
    btn.classList.toggle('active', on); btn.textContent = on ? 'Drums an' : 'Drums aus';
    if (on) {                                     // weich einblenden: kein Knacken beim Einschalten
      ensureBus(); const g = bus.master.gain, t0 = audioCtx.currentTime;
      g.cancelScheduledValues(t0); g.setValueAtTime(0, t0); g.linearRampToValueAtTime(parseInt(volEl.value) / 100, t0 + 0.02);
    }
    clock(); paint(); lastLit = -2; startAnim();
    // Ausgeschaltet: Drum-Kanal nach dem Ausklingen vom Ausgang trennen (spart Rechenzeit)
    clearTimeout(setOn.t);
    if (on) connectBus(true); else setOn.t = setTimeout(() => { if (!on) connectBus(false); }, 3000);
    document.dispatchEvent(new CustomEvent('rhythm', { detail: { on } }));
  }
  btn.addEventListener('click', () => setOn(!(on || wantOn)));
  volEl.addEventListener('input', () => { setPref('3nps-drumvol', volEl.value); if (bus) bus.master.gain.setTargetAtTime(parseInt(volEl.value) / 100, audioCtx.currentTime, 0.02); });

  // ---- Designer ----
  const dgPanel = $('drumDesigner'), dgBtn = $('drumEditBtn');
  function buildGrid() {
    const lab = []; for (let s = 0; s < res; s++) lab.push(s % (res / 4) === 0 ? '<i>' + (s / (res / 4) + 1) + '</i>' : '<i></i>');
    let h = '<div class="dg-ruler" aria-hidden="true"><span></span><div class="dg-steps r' + res + '">' + lab.join('') + '</div></div>';
    INSTR.forEach(i => {
      h += '<div class="dg-row" data-i="' + i.id + '"><button class="dg-name" data-mute="' + i.id + '" title="Stummschalten">' + i.name + '</button><div class="dg-steps r' + res + '">';
      for (let k = 0; k < res; k++) h += '<button class="dg-cell" data-i="' + i.id + '" data-k="' + k + '" aria-label="' + i.name + ' Schritt ' + (k + 1) + '"></button>';
      h += '</div></div>';
    });
    gridEl.innerHTML = h; paint();
  }
  function paint() {
    gridEl.querySelectorAll('.dg-cell').forEach(c => { c.dataset.v = pat[c.dataset.i][+c.dataset.k] || 0; });
    gridEl.querySelectorAll('.dg-name').forEach(b => b.classList.toggle('muted', !!muted[b.dataset.mute]));
    resEl.value = String(res);
    swingEl.disabled = res !== 16;
    $('drumSwingVal').textContent = res === 16 ? swingEl.value + ' %' : 'Triolen';
    $('drumHumanVal').textContent = humanEl.value + ' %';
  }
  gridEl.addEventListener('click', e => {
    const c = e.target.closest('.dg-cell');
    if (c) { const a = pat[c.dataset.i], k = +c.dataset.k; a[k] = [1, 2, 3, 0][a[k] | 0]; c.dataset.v = a[k]; saveCustom(); markManual(); if (a[k] && !on) preview1(c.dataset.i, a[k]); return; }
    const m = e.target.closest('.dg-name');
    if (m) { muted[m.dataset.mute] = !muted[m.dataset.mute]; paint(); }
  });
  function markManual() { if (typeof dr === 'undefined') return; dr.manual = true; setPref('3nps-drummer', JSON.stringify(dr)); if (typeof paintDr === 'function') paintDr(); }
  function preview1(id, lv) { ensureAudio(); ensureBus(); hit(id, audioCtx.currentTime + 0.01, VEL[lv]); }
  styleEl.addEventListener('change', () => {
    const v = styleEl.value;
    if (v === 'custom' || findUser(v)) { setPref('3nps-drumstyle', v); loadState(); if (findUser(v)) { swingEl.value = findUser(v).swing || 0; setPref('3nps-swing', swingEl.value); } }
    else { const pr = byKey[v]; presetKey = v; res = pr.res; pat = fromPreset(pr); swingEl.value = pr.swing; setPref('3nps-swing', swingEl.value); setPref('3nps-drumstyle', v); }
    buildGrid(); showSaveUi();
    if (typeof dr !== 'undefined' && v !== 'custom') {   // v99: neuer Stil – Drummer-Stufen auf „Vorlage“
      const bp = basePattern().p; dr.lvC = 4; dr.lvK = 4; dr.seed = 0; dr.cym = 'auto'; dr.tp = 'std'; dr.perc = bp.shaker.some(Boolean) || bp.cowbell.some(Boolean); if (dr.perc) dr.pc = bp.shaker.some(Boolean) ? 'shaker' : 'cowbell';
      dr.cx = 43; applyDrummer(true);
    } else if (typeof paintDr === 'function') paintDr();
  });
  resEl.addEventListener('change', () => {
    const nr = parseInt(resEl.value); if (nr === res) return;
    // Muster umrechnen: Schläge bleiben auf den Schlägen
    const np = blank(nr), bl = res / 4, nbl = nr / 4;
    IDS.forEach(id => { for (let s = 0; s < res; s++) if (pat[id][s]) { const beat = Math.floor(s / bl), frac = (s % bl) / bl, ns = beat * nbl + Math.round(frac * nbl); if (ns < nr && !np[id][ns]) np[id][ns] = pat[id][s]; } });
    res = nr; pat = np; saveCustom(); markManual(); buildGrid();
  });
  swingEl.addEventListener('input', () => { setPref('3nps-swing', swingEl.value); paint(); });
  humanEl.addEventListener('input', () => { setPref('3nps-human', humanEl.value); paint(); });
  fillsEl.addEventListener('change', () => setPref('3nps-fills', fillsEl.value));
  $('drumClear').addEventListener('click', () => { pat = blank(res); saveCustom(); markManual(); paint(); });
  $('drumSaveBtn').addEventListener('click', () => {
    const nameIn = $('drumSaveName'); let name = nameIn.value.trim();
    if (!name) name = T('Mein Muster ') + (user.length + 1);
    const key = 'u_' + Date.now().toString(36);
    user.push({ key, name, res, steps: stepsCopy(), swing: parseInt(swingEl.value) });
    storeUser(); renderUser();
    presetKey = key; styleEl.value = key; setPref('3nps-drumstyle', key);
    nameIn.value = ''; showSaveUi(); nameIn.blur();
    flashNote('„' + name + '“ gespeichert – steht jetzt unter „Meine Muster“.');
  });
  $('drumDelBtn').addEventListener('click', e => {
    const b = e.currentTarget, u = findUser(presetKey); if (!u) return;
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Wirklich löschen?'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Muster löschen'; }, 2500); return; }
    b.dataset.armed = ''; b.textContent = 'Muster löschen';
    user = user.filter(x => x !== u); storeUser(); renderUser();
    setPref('3nps-drumpattern2', JSON.stringify({ res, steps: stepsCopy() }));
    presetKey = 'custom'; styleEl.value = 'custom'; setPref('3nps-drumstyle', 'custom'); showSaveUi();
    flashNote('„' + u.name + '“ gelöscht. Das Muster bleibt als Entwurf erhalten.');
  });
  function flashNote(t) { const n = $('drumNote'); n.textContent = t; n.hidden = false; clearTimeout(flashNote.t); flashNote.t = setTimeout(() => { n.hidden = true; }, 4000); }
  $('drumPreview').addEventListener('click', () => {
    ensureAudio(); ensureBus(); const sd = stepDur(), t0 = audioCtx.currentTime + 0.08;
    for (let k = 0; k < res; k++) IDS.forEach(id => { const lv = pat[id][k]; if (lv && !muted[id]) hit(id, t0 + k * sd, VEL[lv]); });
  });
  function showDesigner(v) { dgPanel.hidden = !v; if (v) setTimeout(startAnim, 0); dgBtn.classList.toggle('active', v); dgBtn.setAttribute('aria-expanded', v ? 'true' : 'false'); setPref('3nps-designer', v ? '1' : '0'); }
  dgBtn.addEventListener('click', () => showDesigner(dgPanel.hidden));
  showDesigner(pref('3nps-designer', '0') === '1');
  buildGrid(); showSaveUi();
  // ================= v99: Drummer (Art Logic „Drummer“) =================
  // Erzeugt das Muster aus dem gewählten Stil und Reglern: Komplexität/Intensität, Muster-Stufen für Becken und Kick/Snare (1–8,
  // Stufe 4 = Vorlage), Fills, Swing, Ghost Notes, Feel, Dynamik, Snare-/Hi-Hat-Spielweise, Percussion, Tempo.
  // „Manuell“ ist das bisherige Raster; wer dort etwas ändert, behält sein Muster, bis ein Drummer-Regler bewegt wird.
  const DR0 = { cx: 50, inten: 60, lvC: 4, lvK: 4, cym: 'auto', perc: false, kick: true, snare: true, fill: 30, fcx: 50, swu: 16, ghost: 25, feel: 0, dyn: 50, sn: 'auto', hh: 'closed', pc: 'shaker', tp: 'std', seed: 0, manual: false };
  let dr = Object.assign({}, DR0); try { dr = Object.assign({}, DR0, JSON.parse(pref('3nps-drummer', 'null')) || {}); } catch (e) {}
  const saveDr = () => setPref('3nps-drummer', JSON.stringify(dr));
  const CYMT = {
    16: [null, 'X...x...x...x...', 'X.g.x.g.x.g.x.g.', 'X.x.x.x.X.x.x.x.', null, 'X.xgx.xgX.xgx.xg', 'XxxxXxxxXxxxXxxx', 'XxxxXxxxXxxxXxox', 'XxxxXxoxXxxxXxox'],
    12: [null, 'X..x..x..x..', 'X.gx.gx.gx.g', 'X.xX.xX.xX.x', null, 'X.xXgxX.xXgx', 'XxxXxxXxxXxx', 'XxxXxxXxxXxo', 'XxxXxoXxxXxo']
  };
  const KT = {
    16: [null, ['X.......X.......', '....X.......X...'], ['X.......X.x.....', '....X.......X...'], ['X.....x.X.......', '....X.......X...'], null,
      ['X.....x.X.x.....', '....X..g....X...'], ['X..x..x.X.x.....', '....X..g.g..X..g'], ['X..x..x...x..x..', '....X..g.g..X.gx'], ['X.xx..x.X.xx..x.', 'g...X.gg.g.gX.gx']],
    12: [null, ['X.....X.....', '...X.....X..'], ['X.....X..x..', '...X.....X..'], ['X..x..X..x..', '...X.....X..'], null,
      ['X..x..X..x.x', '..gX.....X.g'], ['X..x.xX..x..', '..gX.g..gX.g'], ['X.xx..X.xx..', '..gX.gg.gX.g'], ['X.xx.xX.xx.x', 'g.gX.gg.gX.g']]
  };
  const GHOST = { 16: [7, 9, 15, 3, 10, 13, 1, 5, 11, 14], 12: [2, 8, 11, 5, 1, 7] };
  const CYMIDS = ['hhc', 'hhh', 'hho', 'ride', 'bell'];
  const lvOf = c => c === 'X' ? 2 : c === 'x' ? 1 : c === 'g' ? 3 : c === 'o' ? 1 : 0;
  function rnd(seed) { let a = (seed * 2654435761 + 1013904223) >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; }
  function basePattern() {
    if (byKey[presetKey]) return { res: byKey[presetKey].res, p: fromPreset(byKey[presetKey]) };
    const u = findUser(presetKey), src = u ? u : (() => { try { return JSON.parse(pref('3nps-drumpattern2', 'null')); } catch (e) { return null; } })();
    if (src && src.steps) { const r = src.res === 12 ? 12 : 16, p = blank(r); IDS.forEach(id => { if (src.steps[id]) for (let k = 0; k < r; k++) p[id][k] = src.steps[id][k] | 0; }); return { res: r, p }; }
    return { res, p: pat };
  }
  const cymOfBase = p => ['ride', 'hhc', 'hhh', 'hho'].find(id => p[id].some(Boolean)) || '';
  function genPattern() {
    const B = basePattern(), r = B.res, p = {}, rd = rnd(dr.seed * 7919 + r);
    IDS.forEach(id => { p[id] = B.p[id].slice(); });
    // ---- Becken ----
    const bc = cymOfBase(B.p), mode = dr.cym === 'auto' ? (bc === 'ride' ? 'ride' : bc ? 'hh' : 'off') : dr.cym;
    if (mode === 'off') CYMIDS.forEach(id => p[id].fill(0));
    else {
      let src = null;
      if (dr.lvC === 4 && bc) { const row = B.p[bc]; src = row.map(v => v === 2 ? 'X' : v === 1 ? 'x' : v === 3 ? 'g' : '.'); if (bc !== 'hho') B.p.hho.forEach((v, k) => { if (v) src[k] = 'o'; }); }
      else src = (CYMT[r][dr.lvC] || CYMT[r][3]).split('');
      CYMIDS.forEach(id => p[id].fill(0));
      const main = mode === 'ride' ? 'ride' : dr.hh === 'half' ? 'hhh' : 'hhc';
      src.forEach((c, k) => {
        if (c === '.') return;
        if (c === 'o') { p[mode === 'ride' ? 'ride' : 'hho'][k] = 2; return; }
        let id = main;
        if (mode !== 'ride' && dr.hh === 'open' && c === 'X') id = 'hho';
        if (mode === 'ride' && dr.inten >= 80 && c === 'X') id = 'bell';
        p[id][k] = lvOf(c);
      });
    }
    // ---- Kick & Snare ----
    let K = null, S = null;
    if (dr.lvK !== 4 || !B.p.kick.some(Boolean)) { const t = KT[r][dr.lvK === 4 ? 3 : dr.lvK]; K = t[0].split('').map(lvOf); S = t[1].split('').map(lvOf); }
    else { K = B.p.kick.slice(); S = B.p.snare.slice(); if (!S.some(Boolean)) S = null; }
    if (K) {
      // kleine Varianten je „Neu würfeln“ (mehr bei hoher Komplexität)
      if (dr.seed) for (let n = 0; n < 1 + Math.round(dr.cx / 40); n++) { const k = Math.floor(rd() * r); if (k % (r / 4) && !(S && S[k] === 2)) K[k] = K[k] ? (rd() < 0.5 ? 0 : K[k]) : 1; }
      p.kick = K;
    }
    if (S) { p.snare = S.map(v => v); }
    // Tempo: Halftime = Backbeat nur auf 3, Double = Backbeat auf jedem Achtel-„und“
    const beat = r / 4;
    if (dr.tp !== 'std') {
      const sn = p.snare, acc = sn.map(v => v === 2 || v === 1); if (acc.some(Boolean)) {
        for (let k = 0; k < r; k++) if (sn[k] === 2 || sn[k] === 1) sn[k] = 0;
        if (dr.tp === 'half') sn[2 * beat] = 2;
        else for (let b = 0; b < 4; b++) sn[b * beat + beat / 2 | 0] = b % 2 ? 2 : 1;
        if (dr.tp === 'double') for (let b = 0; b < 4; b++) p.kick[b * beat] = Math.max(p.kick[b * beat], 1);
      }
    }
    // Ghost Notes
    const gs = GHOST[r], want = Math.round(dr.ghost / 100 * (r === 16 ? 6 : 4)), order = gs.slice().sort((a, b) => ((a * 31 + dr.seed * 17) % 11) - ((b * 31 + dr.seed * 17) % 11));
    const hadG = p.snare.filter(v => v === 3).length;
    if (dr.ghost < 10 || (dr.lvK !== 4 && dr.ghost < 25)) for (let k = 0; k < r; k++) if (p.snare[k] === 3) p.snare[k] = 0;
    if (dr.snare && dr.ghost >= 10) {
      let n = dr.lvK === 4 ? hadG : p.snare.filter(v => v === 3).length;
      for (const k of order) { if (n >= want) break; const nb = v => v === 2 || v === 1; if (!p.snare[k] && !nb(p.snare[(k + 1) % r]) && !nb(p.snare[(k + r - 1) % r])) { p.snare[k] = 3; n++; } }
    }
    // Snare-Spielweise
    const art = dr.sn === 'auto' ? (dr.inten >= 78 ? 'rimshot' : dr.inten <= 20 ? 'cross' : 'center') : dr.sn;
    if (art === 'rimshot') for (let k = 0; k < r; k++) { if (p.snare[k] === 2) { p.snare[k] = 0; p.snrim[k] = 2; } }
    if (art === 'cross') for (let k = 0; k < r; k++) { if (p.snare[k] === 2 || p.snare[k] === 1) { p.rim[k] = p.snare[k]; p.snare[k] = 0; } }
    if (!dr.kick) p.kick.fill(0);
    if (!dr.snare) { p.snare.fill(0); p.snrim.fill(0); }
    // Percussion
    ['shaker', 'cowbell'].forEach(id => { if (!dr.perc) p[id].fill(0); });
    if (dr.perc) {
      const pc = dr.pc, row = p[pc]; row.fill(0);
      for (let k = 0; k < r; k++) {
        if (pc === 'shaker') row[k] = r === 16 ? (k % 2 ? 3 : (k % 4 ? 1 : 2)) : (k % 3 ? 3 : 1);
        else if (pc === 'cowbell') row[k] = k % beat === 0 ? (k === 0 ? 2 : 1) : (dr.lvC >= 6 && k % beat === beat / 2 ? 3 : 0);
        else if (pc === 'clap') row[k] = (k === beat || k === 3 * beat) ? 2 : 0;
      }
    }
    return { res: r, p };
  }
  function applyDrummer(fromCtl) {
    if (fromCtl) dr.manual = false;
    saveDr();
    if (dr.manual) { paintDr(); return; }
    const g = genPattern(); res = g.res; pat = g.p;
    // Fills/Swing aus den Reglern in die bisherigen Felder (für Speichern, Export, Raster)
    fillsEl.value = String(dr.fill < 5 ? 0 : dr.fill < 40 ? 8 : dr.fill < 75 ? 4 : 2); setPref('3nps-fills', fillsEl.value);
    buildGrid(); paintDr();
  }
  // ---- Bedienelemente ----
  const knobDefs = {
    fill: { min: 0, max: 100, def: 30, get: () => dr.fill, set: v => { dr.fill = v; }, fmt: v => v < 5 ? T('aus') : v + ' %' },
    fcx: { min: 0, max: 100, def: 50, get: () => dr.fcx, set: v => { dr.fcx = v; }, fmt: v => v + ' %' },
    swing: { min: 0, max: 100, def: 0, get: () => parseInt(swingEl.value) || 0, set: v => { swingEl.value = v; setPref('3nps-swing', String(v)); }, fmt: v => v + ' %', regen: false },
    ghost: { min: 0, max: 100, def: 25, get: () => dr.ghost, set: v => { dr.ghost = v; }, fmt: v => v + ' %' },
    feel: { min: -100, max: 100, def: 0, get: () => dr.feel, set: v => { dr.feel = v; }, fmt: v => v === 0 ? T('Mitte') : (v < 0 ? 'Pull ' : 'Push ') + Math.abs(v), regen: false, bi: true },
    dyn: { min: 0, max: 100, def: 50, get: () => dr.dyn, set: v => { dr.dyn = v; }, fmt: v => v + ' %', regen: false },
    human: { min: 0, max: 100, def: 35, get: () => parseInt(humanEl.value) || 0, set: v => { humanEl.value = v; setPref('3nps-human', String(v)); }, fmt: v => v + ' %', regen: false }
  };
  const arc = (a0, a1, r) => { const p = a => [30 + r * Math.sin(a), 30 - r * Math.cos(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (Math.abs(a1 - a0) > Math.PI ? 1 : 0) + ' ' + (a1 > a0 ? 1 : 0) + ' ' + x1.toFixed(2) + ' ' + y1.toFixed(2); };
  const A0 = -0.75 * Math.PI, A1 = 0.75 * Math.PI;
  function paintKnob(el) {
    const d = knobDefs[el.dataset.k], v = d.get(), f = (v - d.min) / (d.max - d.min), a = A0 + f * (A1 - A0), mid = d.bi ? 0 : A0;
    el.querySelector('.kd').setAttribute('d', arc(A0, A1, 24));
    el.querySelector('.ka').setAttribute('d', Math.abs(a - mid) < 0.01 ? '' : arc(Math.min(mid, a), Math.max(mid, a), 24));
    const p = el.querySelector('.kp'); p.setAttribute('x2', (30 + 15 * Math.sin(a)).toFixed(2)); p.setAttribute('y2', (30 - 15 * Math.cos(a)).toFixed(2));
    el.querySelector('b').textContent = d.fmt(v); el.setAttribute('aria-valuenow', String(v)); el.setAttribute('aria-valuemin', String(d.min)); el.setAttribute('aria-valuemax', String(d.max));
  }
  function bindDrag(el, getV, setV, min, max, def, vertical) {
    let st = null, lastT = 0;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('button, select')) return;   // Schalter im Regler (z. B. 1/8 · 1/16)
      const now = performance.now(); if (now - lastT < 350) { setV(def, true); lastT = 0; return; } lastT = now;
      st = { y: e.clientY, x: e.clientX, v: getV(), id: e.pointerId };
      if (vertical) { const tr = el.querySelector('.dr-ftrack').getBoundingClientRect(); if (e.clientY >= tr.top && e.clientY <= tr.bottom) { const v = Math.round(min + (tr.bottom - e.clientY) / tr.height * (max - min)); setV(v, false); st.v = v; } }
      try { el.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return;
      const h = vertical ? el.querySelector('.dr-ftrack').getBoundingClientRect().height : 150, dv = (st.y - e.clientY) / h * (max - min);
      const v = Math.round(Math.max(min, Math.min(max, st.v + dv))); if (v !== getV()) setV(v, false);
    });
    const end = () => { if (st) { st = null; setV(getV(), true); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', e => { const d = /Up|Right/.test(e.key) ? 1 : /Down|Left/.test(e.key) ? -1 : 0; if (!d) return; setV(Math.max(min, Math.min(max, getV() + d * 5)), true); e.preventDefault(); e.stopPropagation(); });
  }
  dgPanel.querySelectorAll('.dr-knob').forEach(el => {
    const d = knobDefs[el.dataset.k];
    bindDrag(el, d.get, (v, done) => { d.set(v); paintKnob(el); if (d.regen === false) { saveDr(); paint(); } else if (done) applyDrummer(true); }, d.min, d.max, d.def, false);
  });
  const faders = { drCx: ['cx', 50], drIn: ['inten', 60] };
  function paintFader(el) { const [k] = faders[el.id], v = dr[k]; el.style.setProperty('--fv', v + '%'); el.setAttribute('aria-valuenow', String(v)); el.querySelector('em').textContent = v; }
  Object.keys(faders).forEach(id => {
    const el = $(id), [k, def] = faders[id];
    bindDrag(el, () => dr[k], (v, done) => {
      dr[k] = v; paintFader(el);
      if (k === 'cx') { const lv = Math.max(1, Math.min(8, 1 + Math.round(v / 100 * 7))); dr.lvC = lv; dr.lvK = lv; paintLv(); }
      if (done) applyDrummer(true); else saveDr();
    }, 0, 100, def, true);
  });
  function lvRow(host, key) {
    let h = '<b class="dr-badge"></b>';
    for (let i = 1; i <= 8; i++) h += '<button class="dr-lvb" data-l="' + i + '" aria-label="' + T('Stufe ') + i + (i === 4 ? ' (' + T('Vorlage') + ')' : '') + '">' + '<i></i>'.repeat(Math.min(4, Math.ceil(i / 2))) + '</button>';
    host.innerHTML = h;
    host.addEventListener('click', e => { const b = e.target.closest('.dr-lvb'); if (!b) return; dr[key] = +b.dataset.l; applyDrummer(true); });
  }
  lvRow($('drLvC'), 'lvC'); lvRow($('drLvK'), 'lvK');
  function paintLv() {
    [['drLvC', 'lvC'], ['drLvK', 'lvK']].forEach(([id, k]) => { const host = $(id); host.querySelector('.dr-badge').textContent = dr[k]; host.querySelectorAll('.dr-lvb').forEach(b => { const l = +b.dataset.l; b.classList.toggle('on', l <= dr[k]); b.classList.toggle('cur', l === dr[k]); }); });
  }
  dgPanel.querySelector('.dr-icons') && dgPanel.querySelectorAll('.dr-ic').forEach(b => b.addEventListener('click', () => {
    const ic = b.dataset.ic, bc = cymOfBase(basePattern().p), cur = dr.cym === 'auto' ? (bc === 'ride' ? 'ride' : bc ? 'hh' : 'off') : dr.cym;
    if (ic === 'hh' || ic === 'ride') dr.cym = cur === ic ? 'off' : ic;
    else if (ic === 'perc') dr.perc = !dr.perc;
    else dr[ic] = !dr[ic];
    applyDrummer(true);
  }));
  $('drRegen').addEventListener('click', () => { dr.seed = (dr.seed || 0) + 1; applyDrummer(true); });
  [['drSn', 'sn'], ['drHh', 'hh'], ['drPc', 'pc'], ['drTp', 'tp']].forEach(([id, k]) => $(id).addEventListener('change', e => { dr[k] = e.target.value; if (k === 'pc') dr.perc = true; applyDrummer(true); }));
  dgPanel.querySelector('.dr-swu').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; dr.swu = +b.dataset.u; saveDr(); paintDr(); });
  function showView(v) {
    dgPanel.querySelectorAll('.dr-tabs button').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    dgPanel.querySelectorAll('.dr-view').forEach(x => { x.hidden = x.dataset.v !== v; });
    setPref('3nps-drview', v); if (v === 'man') paint();
  }
  dgPanel.querySelector('.dr-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showView(b.dataset.v); });
  function paintDr() {
    dgPanel.querySelectorAll('.dr-knob').forEach(paintKnob);
    Object.keys(faders).forEach(id => paintFader($(id)));
    paintLv();
    const bc = cymOfBase(basePattern().p), cur = dr.cym === 'auto' ? (bc === 'ride' ? 'ride' : bc ? 'hh' : 'off') : dr.cym;
    dgPanel.querySelectorAll('.dr-ic').forEach(b => { const ic = b.dataset.ic, on = ic === 'hh' || ic === 'ride' ? cur === ic : ic === 'perc' ? dr.perc : dr[ic]; b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', String(!!on)); });
    dgPanel.querySelectorAll('.dr-swu button').forEach(b => b.classList.toggle('active', +b.dataset.u === dr.swu));
    $('drSn').value = dr.sn; $('drHh').value = dr.hh; $('drPc').value = dr.pc; $('drTp').value = dr.tp;
    $('drStyle').textContent = styleEl.selectedOptions[0] ? styleEl.selectedOptions[0].text : '';
    $('drHint').textContent = dr.manual ? T('Muster von Hand bearbeitet – ein Drummer-Regler übernimmt wieder.') : '';
  }
  showView(pref('3nps-drview', 'main'));
  if (!dr.manual && (byKey[presetKey] || findUser(presetKey))) applyDrummer(false); else paintDr();
  let lastLit = -2;
  function currentStep() { if (!on || !audioCtx) return -1; const now = audioCtx.currentTime; let s = -1; for (const [t, st] of played) if (t <= now) s = st; return s; }
  function paintPlayhead() {
    if (dgPanel.hidden) return;
    const s = currentStep(); if (s === lastLit) return; lastLit = s;
    gridEl.querySelectorAll('.dg-cell.now').forEach(c => c.classList.remove('now'));
    if (s >= 0) gridEl.querySelectorAll('.dg-cell[data-k="' + s + '"]').forEach(c => c.classList.add('now'));
  }
  let animOn = false;
  function anim() {
    paintPlayhead();
    if (on && !dgPanel.hidden && !document.hidden) setTimeout(() => requestAnimationFrame(anim), 33);
    else { animOn = false; lastLit = -2; gridEl.querySelectorAll('.dg-cell.now').forEach(c => c.classList.remove('now')); }
  }
  function startAnim() { if (!animOn && on && !dgPanel.hidden) { animOn = true; anim(); } }

  // ---- Bass der Begleitung am selben Taktgeber: spielt mit der Kick (Grundton/Quinte) ----
  listeners.push((step, t, sd, bar, p) => {
    if (typeof bassOn === 'undefined' || !bassOn || !grooveNodes) return;
    if (!p.kick[step]) return;
    let first = true; for (let s = 0; s < step; s++) if (p.kick[s]) { first = false; break; }
    let nth = 0; for (let s = 0; s < step; s++) if (p.kick[s]) nth++;
    playBassNote(t, first || nth % 2 === 0 ? 'root' : 'fifth', sd * 1000 * (res === 12 ? 1.33 : 1));
  });

  // ---- Song-Erkennung liefert ein Muster ----
  function setDetected(pt, bpm) {
    const pr = P('Eigene', 'detected', 'Aus dem Song (' + Math.round(bpm) + ' BPM)', 16, 0, {});
    const str = arr => { let s = ''; for (let k = 0; k < 16; k++) s += (arr || []).includes(k) ? (k % 4 === 0 ? 'X' : 'x') : '.'; return s; };
    pr.p = { kick: str(pt.kick), snare: str(pt.snare), hhc: str(pt.hihat) };
    byKey.detected = pr;
    let o = styleEl.querySelector('option[value="detected"]');
    if (!o) { o = new Option(pr.name, 'detected'); ogC.insertBefore(o, ogC.firstChild); }
    o.textContent = pr.name;
    styleEl.value = 'detected'; styleEl.dispatchEvent(new Event('change'));
  }

  // ---- MIDI-Export: Ereignisse für n Takte (inkl. Swing, Fills, Stummschaltung) ----
  function midiEvents(bars, PPQ) {
    const ev = [], stepT = PPQ * 4 / res, sw = res === 16 ? parseInt(swingEl.value) / 100 : 0;
    for (let b = 0; b < bars; b++) {
      const bp = barPattern(b);
      for (let s = 0; s < res; s++) {
        const delay = swingDelay(s, sw, stepT);
        const t = Math.round((b * res + s) * stepT + delay);
        INSTR.forEach(i => {
          let lv = bp.p[i.id][s];
          if (bp.crash && s === 0 && (i.id === 'crash' || i.id === 'kick')) lv = Math.max(lv === 3 ? 1 : lv, 2);
          if (lv && !muted[i.id]) ev.push([t, i.midi, MIDIV[lv], Math.round(stepT / 2)]);
        });
      }
    }
    return ev;
  }

  // ---- Die Drum-Spur wandert mit: im Looper unter den Spuren, im Griffbrett (Begleitung) als eigene Karte ----
  const lane = document.querySelector('.lane-drums');
  document.addEventListener('tabchange', e => {
    const home = $(e.detail === 'griffbrett' ? 'beglDrumsHome' : e.detail === 'jam' ? 'jamDrumsHome' : 'loopDrumsHome');
    if (home && lane && lane.parentNode !== home) home.appendChild(lane);
  });

  // Kit früh im Hintergrund erzeugen (sobald Audio einmal angefasst wurde)
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, function once() { window.removeEventListener(ev, once, true); setTimeout(() => { try { ensureAudio(); makeKit(); } catch (e) {} }, 50); }, true));

  function getState() {
    return { on, key: presetKey, name: styleEl.selectedOptions[0] ? styleEl.selectedOptions[0].text : '', res, steps: stepsCopy(), swing: parseInt(swingEl.value),
      human: parseInt(humanEl.value), fills: fillsEl.value, vol: parseInt(volEl.value), muted: Object.assign({}, muted), eq: EQ7.legacy(drumEq), eq2: EQ7.norm(drumEq), dr: Object.assign({}, dr) };
  }
  function setState(st) {
    if (!st || !st.steps) return;
    res = st.res === 12 ? 12 : 16; pat = blank(res);
    IDS.forEach(id => { if (st.steps[id]) for (let k = 0; k < res; k++) pat[id][k] = st.steps[id][k] | 0; });
    if (byKey[st.key] || findUser(st.key)) { presetKey = st.key; styleEl.value = st.key; setPref('3nps-drumstyle', st.key); }
    else { presetKey = 'custom'; styleEl.value = 'custom'; setPref('3nps-drumstyle', 'custom'); setPref('3nps-drumpattern2', JSON.stringify({ res, steps: stepsCopy() })); }
    swingEl.value = st.swing || 0; humanEl.value = st.human != null ? st.human : 35; fillsEl.value = st.fills || '0'; volEl.value = st.vol != null ? st.vol : 70;
    muted = Object.assign({}, st.muted || {});
    if (st.eq2 || st.eq) setDrumEq(st.eq2 || st.eq, false);
    if (st.dr) { dr = Object.assign({}, DR0, st.dr); setPref('3nps-drummer', JSON.stringify(dr)); }
    ['3nps-swing', '3nps-human', '3nps-fills', '3nps-drumvol'].forEach((k, i) => setPref(k, [swingEl, humanEl, fillsEl, volEl][i].value));
    if (bus) bus.master.gain.value = parseInt(volEl.value) / 100;
    buildGrid(); showSaveUi(); paintDr();
    setOn(!!st.on);
  }
  return {
    getState, setState, setLite, setEq: v => setDrumEq(v, false), getEq: () => EQ7.norm(drumEq),
    INSTR, on: () => on, setOn, setRoom, roomOn: () => roomOn, setGrid: fn => { gridFn = fn; },
    setBass: v => { bassNeed = !!v; clock(); },
    // Jam: hält den Taktgeber am Laufen und bekommt jeden Schritt vor dem Bass gemeldet (Akkordwechsel zuerst)
    setJam: v => { jamNeed = !!v; clock(); },
    addListener: (fn, first) => { if (first) listeners.unshift(fn); else listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    free: () => !(gridFn && gridFn()),
    nextBarTime: () => { const g = grid(), bd = barDur(), t = audioCtx.currentTime + 0.15; return g.anchor + Math.ceil((t - g.anchor) / bd) * bd; },
    resync: () => { lastAnchor = null; },
    stepDur, res: () => res, midiEvents, setDetected, name: () => styleEl.selectedOptions[0] ? styleEl.selectedOptions[0].text : '',
    drummer: () => ({ dr: Object.assign({}, dr), pat: stepsCopy(), res, fills: fillsEl.value }),
    setKit, kitMode: () => (realOn && kitReal ? 'real' : 'synth'), kitName: () => (realOn && kitReal ? kitRealName : 'synth'), loadReal,
    debug: () => ({ on, res, steps: played.slice(-24), sd: stepDur(), kit: !!kit, real: !!(realOn && kitReal), preset: presetKey, late: lateHits, pending: pend.length })
  };
})();
