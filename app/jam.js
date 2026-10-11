// ---- Jam: Akkordfolge eintippen oder aus Vorlagen wählen, Begleitung (Drums, Bass, Fläche) folgt den Akkorden ----
// Läuft auf dem gemeinsamen Taktgeber (Rhythm). Jeder Schritt wird dem Jam vor dem Bass gemeldet, so wechselt
// der Bass genau mit dem Akkord. Tempo-Trainer erhöht das Tempo nach n Durchläufen ohne Sprung im Muster.
(function () {
  const $ = id => document.getElementById(id);
  const panel = $('panel-jam');
  if (!panel || typeof Rhythm === 'undefined') return;
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const md = x => ((x % 12) + 12) % 12;
  const CH = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7],
    dim: [0, 3, 6], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 2, 4, 7], m9: [0, 2, 3, 7, 10], maj9: [0, 2, 4, 7, 11], '9': [0, 2, 4, 7, 10], m11: [0, 3, 5, 7, 10], m7b5: [0, 3, 6, 10] };
  const SUF = { dim: '°', m7b5: 'm7♭5' };
  const SAVE = '3nps-jam';
  // Vorlagen: [Halbtöne über dem Grundton, Typ, Schläge]
  const PRE = {
    maj: [
      ['Pop · I–V–vi–IV', [[0, ''], [7, ''], [9, 'm'], [5, '']]],
      ['50er · I–vi–IV–V', [[0, ''], [9, 'm'], [5, ''], [7, '']]],
      ['Rock · I–IV–V–IV', [[0, ''], [5, ''], [7, ''], [5, '']]],
      ['Mixolydisch · I–♭VII–IV–I', [[0, ''], [10, ''], [5, ''], [0, '']]],
      ['Jazz · ii–V–I', [[2, 'm7'], [7, '7'], [0, 'maj7', 8]]],
      ['Blues 12 Takte', [[0, '7', 16], [5, '7', 8], [0, '7', 8], [7, '7'], [5, '7'], [0, '7'], [7, '7']]],
      ['Folk · I–IV–I–V', [[0, ''], [5, ''], [0, ''], [7, '']]],
      ['Kanon · I–V–vi–iii–IV–I–IV–V', [[0, ''], [7, ''], [9, 'm'], [4, 'm'], [5, ''], [0, ''], [5, ''], [7, '']]],
      ['Schwebend · Imaj7–IVmaj7', [[0, 'maj7', 8], [5, 'maj7', 8]]]
    ],
    min: [
      ['Episch · i–VI–III–VII', [[0, 'm'], [8, ''], [3, ''], [10, '']]],
      ['Rock-Ballade · i–VII–VI–VII', [[0, 'm'], [10, ''], [8, ''], [10, '']]],
      ['Andalusisch · i–VII–VI–V', [[0, 'm'], [10, ''], [8, ''], [7, '']]],
      ['Moll-Blues 12 Takte', [[0, 'm7', 16], [5, 'm7', 8], [0, 'm7', 8], [8, '7'], [7, '7'], [0, 'm7'], [7, '7']]],
      ['Dorisch · i7–IV', [[0, 'm7', 8], [5, '', 8]]],
      ['Pendel · i–iv', [[0, 'm', 8], [5, 'm', 8]]],
      ['Harmonisch · i–iv–V–i', [[0, 'm'], [5, 'm'], [7, '7'], [0, 'm']]],
      ['Metal · i–♭II–i–♭VII', [[0, '5'], [1, '5'], [0, '5'], [10, '5']]]
    ]
  };
  // ---- Zustand ----
  let st = load();
  function load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) {}
    const def = { key: { pc: 9, major: false }, seq: null, pad: true, padVol: 45, padSound: 'pad', drums: true, trainer: { on: false, start: 70, target: 100, step: 4, every: 2 } };
    d = Object.assign(def, d || {}); d.trainer = Object.assign(def.trainer, d.trainer || {});
    if (!Array.isArray(d.seq) || !d.seq.length) d.seq = fromPreset(d.key, d.key.major ? PRE.maj[0][1] : PRE.min[0][1]);
    d.seq = d.seq.filter(c => c && c.r >= 0 && c.r < 12 && CH[c.t] && c.beats > 0);
    return d;
  }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify({ key: st.key, seq: st.seq, pad: st.pad, padVol: st.padVol, padSound: st.padSound, drums: st.drums, trainer: st.trainer })); } catch (e) {} }
  function fromPreset(k, p) { return p.map(([o, t, b]) => ({ r: md(k.pc + o), t, beats: b || 4 })); }
  const flats = k => [5, 10, 3, 8, 1].includes(k.major ? k.pc : md(k.pc + 3));
  const nn = (pc, k) => (flats(k) ? FLAT : SHARP)[md(pc)];
  const cname = (c, k) => nn(c.r, k) + (SUF[c.t] != null ? SUF[c.t] : c.t);
  const qual = t => /^(m|m7|m6|m9|m11)$/.test(t) ? 'm' : /^(dim|m7b5)$/.test(t) ? 'd' : /^(sus|5)/.test(t) ? '*' : 'M';
  function roman(c, k) {
    const rel = md(c.r - k.pc), q = qual(c.t), ref = k.major ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10], B = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    let d = ref.indexOf(rel), acc = '';
    if (d < 0) { d = ref.indexOf(md(rel + 1)); acc = '♭'; if (d <= 0) { d = ref.indexOf(md(rel - 1)); acc = '♯'; } }
    if (d < 0) return '';
    let s = B[d]; if (q === 'm' || q === 'd') s = s.toLowerCase();
    return acc + s + (q === 'd' ? '°' : '');
  }
  // Texteingabe: „Am F C G“, „Am7:2 D7“ (2 Takte), „C:½ G:½“, H = B, ♭/b und ♯/# erlaubt
  function parse(text) {
    const out = [], bad = [];
    (text || '').replace(/[|;]|,(?!\d)/g, ' ').split(/\s+/).filter(Boolean).forEach(tok => {
      const m = /^([A-Ha-h])([#♯b♭]?)([^:*]*)(?:[:*]([0-9.,½¼]+))?$/.exec(tok.trim());
      if (!m) { bad.push(tok); return; }
      const L = m[1].toUpperCase(), base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 }[L];
      const acc = m[2] === '#' || m[2] === '♯' ? 1 : (m[2] === 'b' || m[2] === '♭') ? -1 : 0;
      let t = m[3].replace('♭', 'b').replace(/^min/, 'm').replace(/^-/, 'm').replace('Δ', 'maj7').replace(/^M7$/, 'maj7').replace(/^°$/, 'dim').replace(/^ø$/, 'm7b5').replace(/^m7-5$/, 'm7b5').replace(/^sus$/, 'sus4');
      if (!(t in CH)) { bad.push(tok); return; }
      let bars = 1; if (m[4]) { const v = m[4] === '½' ? 0.5 : m[4] === '¼' ? 0.25 : parseFloat(m[4].replace(',', '.')); if (!(v > 0 && v <= 8)) { bad.push(tok); return; } bars = v; }
      out.push({ r: md(base + acc), t, beats: Math.max(1, Math.round(bars * 4)) });
    });
    return { seq: out, bad };
  }
  const totalBeats = () => st.seq.reduce((a, c) => a + c.beats, 0);

  // ---- Fläche (Pad): weiche Akkorde, Stimmführung nah am vorigen Akkord ----
  let padOut = null, padLp = null, padVoices = [], lastVoicing = null;
  // Synth-Bus: Eingang → Tiefpass → Hochpass → trocken + Stereo-Chorus + Hall + (für Pluck/Arp) tempo-synchrones Echo
  let fx = null;
  function hallIR(sec) {
    const sr = audioCtx.sampleRate, n = Math.round(sr * sec), b = audioCtx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += ((Math.random() * 2 - 1) - lp) * (0.55 - 0.4 * Math.min(1, t / sec)); d[i] = lp * Math.exp(-t / (sec * 0.32)) * Math.min(1, t / 0.012); } }
    return b;
  }
  function padBus() {
    if (!padOut) {
      const ac = audioCtx, master = typeof ensureMasterBus === 'function' ? ensureMasterBus() : ac.destination;
      padOut = ac.createGain(); padOut.gain.value = st.padVol / 100 * 0.5;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.5; padLp = lp;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85; hp.Q.value = 0.6;
      padOut.connect(lp); lp.connect(hp);
      const dry = ac.createGain(); hp.connect(dry); dry.connect(master);
      // Chorus: zwei langsam schwankende Verzögerungen, links und rechts
      const chIn = ac.createGain(), mg = ac.createChannelMerger(2), chOut = ac.createGain(); hp.connect(chIn);
      [[0.011, 0.31, 0], [0.017, 0.43, 1]].forEach(([d, f, ch]) => { const dl = ac.createDelay(0.05); dl.delayTime.value = d; const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = f; lg.gain.value = 0.0028; lfo.connect(lg); lg.connect(dl.delayTime); lfo.start(); chIn.connect(dl); dl.connect(mg, 0, ch); });
      mg.connect(chOut); chOut.connect(master);
      // Hall
      const rvIn = ac.createGain(), rv = ac.createConvolver(), rvOut = ac.createGain(); rv.buffer = hallIR(1.7); hp.connect(rvIn); rvIn.connect(rv); rv.connect(rvOut); rvOut.connect(master);
      // Echo (Punktierte Achtel, Rückkopplung gedämpft), Zeit folgt dem Tempo
      const dlIn = ac.createGain(), dl = ac.createDelay(2), fb = ac.createGain(), dlLp = ac.createBiquadFilter(), dlOut = ac.createGain();
      dlLp.type = 'lowpass'; dlLp.frequency.value = 3200; fb.gain.value = 0.38; hp.connect(dlIn); dlIn.connect(dl); dl.connect(dlLp); dlLp.connect(fb); fb.connect(dl); dlLp.connect(dlOut);
      const pan = ac.createStereoPanner ? ac.createStereoPanner() : null; if (pan) { pan.pan.value = 0.35; dlOut.connect(pan); pan.connect(master); } else dlOut.connect(master);
      fx = { dry, chOut, rvIn, dlIn, dl, rvOut, dlOut };
      applySound(st.padSound, true);
    }
    return padOut;
  }
  // Klangeinstellungen je Sound: Tiefpass, Anteile Chorus / Hall / Echo
  const SOUND_FX = {
    pad:     { lp: 3200, ch: 0.55, rv: 0.35, dl: 0, g: 1.48 },
    warm:    { lp: 1500, ch: 0.35, rv: 0.4,  dl: 0, g: 0.65 },
    strings: { lp: 5200, ch: 0.6,  rv: 0.5,  dl: 0, g: 2.38 },
    organ:   { lp: 6000, ch: 0.7,  rv: 0.25, dl: 0, g: 1.21 },
    epiano:  { lp: 7000, ch: 0.45, rv: 0.3,  dl: 0, g: 0.86 },
    bell:    { lp: 9000, ch: 0.3,  rv: 0.55, dl: 0.18, g: 0.9 },
    pluck:   { lp: 8000, ch: 0.35, rv: 0.3,  dl: 0.32, g: 1.55 },
    arp:     { lp: 8000, ch: 0.3,  rv: 0.28, dl: 0.3, g: 2.08 }
  };
  const padGain = () => st.padVol / 100 * 0.5 * ((SOUND_FX[st.padSound] || SOUND_FX.pad).g || 1);
  function applySound(kind, now) {
    if (!fx) return;
    const p = SOUND_FX[kind] || SOUND_FX.pad, t = audioCtx.currentTime, tc = now ? 0.001 : 0.08;
    padLp.frequency.setTargetAtTime(p.lp, t, tc); fx.chOut.gain.setTargetAtTime(p.ch, t, tc); fx.rvIn.gain.setTargetAtTime(p.rv, t, tc); fx.dlIn.gain.setTargetAtTime(p.dl, t, tc);
    fx.dry.gain.setTargetAtTime(1 - p.ch * 0.35, t, tc);
    padOut.gain.setTargetAtTime(padGain(), t, tc);
    const bpm = parseFloat(document.getElementById('bpm').value) || 90; fx.dl.delayTime.setTargetAtTime(Math.min(1.9, 60 / bpm * 0.75), t, 0.05);
  }
  function voicing(c) {
    const pcs = CH[c.t].map(x => md(c.r + x)).slice(0, 4), center = lastVoicing ? lastVoicing.reduce((a, b) => a + b, 0) / lastVoicing.length : 60;
    const v = pcs.map(p => { let m = 48 + p; while (m < center - 6) m += 12; while (m > center + 6) m -= 12; return Math.max(50, Math.min(72, m)); }).sort((a, b) => a - b);
    lastVoicing = v; return v;
  }
  // Stimme nach dem Ausklingen vom Graphen trennen (Safari hielte sonst alles fest)
  function unhook(v) { if (v.gone) return; v.gone = true; try { v.g.disconnect(); if (v.pn) v.pn.disconnect(); } catch (e) {} }
  function padRelease(t) { padVoices.forEach(v => { try { if (v.strike) { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.25); v.o.forEach(o => { try { o.stop(t + 1.5); } catch (e) {} }); setTimeout(() => unhook(v), 1900); return; } v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.18); v.o.forEach(o => o.stop(t + 1.2)); setTimeout(() => unhook(v), 1600); } catch (e) {} }); padVoices = []; arp = null; }
  // ---- Synth-Klänge (alles mit eigenen Oszillatoren – keine Samples) ----
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function osc(type, f, t, dest, gain, detune) { const o = audioCtx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune; let d = dest; if (gain != null) { const g = audioCtx.createGain(); g.gain.value = gain; o.connect(g); g.connect(dest); } else o.connect(dest); o.start(t); return o; }
  function env(g, t, peak, att, dec, sus) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); if (dec) g.gain.setTargetAtTime(peak * (sus == null ? 0.6 : sus), t + att, dec); }
  // Kleine Bausteine: Stereo-Position je Ton, Filter mit Hüllkurve
  const spread = (k, n) => n > 1 ? (k / (n - 1) - 0.5) * 0.7 : 0;
  function panNode(p) { if (!audioCtx.createStereoPanner) return null; const n = audioCtx.createStereoPanner(); n.pan.value = p; return n; }
  function filt(type, f, q) { const x = audioCtx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q == null ? 0.7 : q; return x; }
  // Gehaltene Akkordklänge (bis zum nächsten Akkord)
  function sustainVoice(kind, m, t, out, k, n) {
    const f = hz(m), g = audioCtx.createGain(), o = [], pn = panNode(spread(k, n)), dest = pn || out;
    if (pn) pn.connect(out);
    if (kind === 'pad') {                 // Analog-Fläche: 3 verstimmte Sägezähne + Sub, Filter öffnet sich langsam, leichtes Filter-Atmen
      const lp = filt('lowpass', 500, 1.1); lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2600, t + 1.2);
      const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain(); lfo.frequency.value = 0.18 + k * 0.03; lg.gain.value = 380; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); o.push(lfo);
      [-14, 0, 13].forEach(dt => o.push(osc('sawtooth', f, t, lp, 0.33, dt)));
      o.push(osc('sine', f / 2, t, lp, 0.35)); lp.connect(g); env(g, t, 0.13, 0.45, 0.9, 0.8);
    } else if (kind === 'warm') {         // rund und dunkel: Dreieck + Sinus, Vibrato, langsames Einblenden
      const vib = audioCtx.createOscillator(), vg = audioCtx.createGain(); vib.frequency.value = 4.6; vg.gain.value = 3; vib.connect(vg); vib.start(t + 0.4); o.push(vib);
      const a = osc('triangle', f, t, g, 0.8), b2 = osc('sine', f, t, g, 0.6, 7), c = osc('sine', f / 2, t, g, 0.45); vg.connect(a.detune); vg.connect(b2.detune);
      o.push(a, b2, c); env(g, t, 0.16, 0.6, 1.5, 0.85);
    } else if (kind === 'strings') {      // Ensemble: 5 Sägezähne gefächert, Hochpass + Tiefpass, verzögertes Vibrato
      const lp = filt('lowpass', 4200, 0.5), hpf = filt('highpass', 220, 0.5); lp.connect(hpf); hpf.connect(g);
      const vib = audioCtx.createOscillator(), vg = audioCtx.createGain(); vib.frequency.value = 5.4; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(7, t + 1.1); vib.connect(vg); vib.start(t); o.push(vib);
      [-16, -7, 0, 8, 17].forEach(dt => { const x = osc('sawtooth', f, t, lp, 0.22, dt); vg.connect(x.detune); o.push(x); });
      env(g, t, 0.1, 0.55, 2.0, 0.9);
    } else if (kind === 'organ') {        // Zugriegel 16′ 8′ 5⅓′ 4′ 2⅔′ 2′, Tastenklick
      [[0.5, 0.55], [1, 0.8], [1.5, 0.45], [2, 0.5], [3, 0.22], [4, 0.18]].forEach(([r, a]) => o.push(osc('sine', f * r, t, g, a * 0.9)));
      const ck = audioCtx.createBufferSource(), cb = audioCtx.createBuffer(1, Math.round(audioCtx.sampleRate * 0.012), audioCtx.sampleRate), cd = cb.getChannelData(0);
      for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cd.length * 0.25)) * 0.35;
      ck.buffer = cb; const cf = filt('bandpass', 2400 + k * 300, 1.2); ck.connect(cf); cf.connect(g); ck.start(t); o.push(ck);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.075, t + 0.008);
    }
    g.connect(dest); return { g, o, pn };
  }
  // Angeschlagene Töne (klingen von selbst aus)
  function strikeVoice(kind, m, t, out, vel, k, n) {
    const f = hz(m), g = audioCtx.createGain(), o = [], v = vel || 1, pn = panNode(spread(k || 0, n || 1)), dest = pn || out;
    if (pn) pn.connect(out);
    if (kind === 'epiano') {              // Rhodes-artig: FM 1:1 mit fallendem Index, „Bark“ bei kräftigem Anschlag, Stereo-Tremolo am Ausgang
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.003); g.gain.setTargetAtTime(0.07 * v, t + 0.003, 0.35); g.gain.setTargetAtTime(0, t + 0.6, 1.4);
      const car = osc('sine', f, t, g), mod = audioCtx.createOscillator(), mg = audioCtx.createGain(); mod.frequency.value = f; mg.gain.setValueAtTime(f * 2.2 * v, t); mg.gain.setTargetAtTime(f * 0.25, t, 0.28); mod.connect(mg); mg.connect(car.frequency); mod.start(t);
      const tine = audioCtx.createOscillator(), tg = audioCtx.createGain(); tine.frequency.value = f * 14; tg.gain.setValueAtTime(0.035 * v, t); tg.gain.setTargetAtTime(0, t, 0.025); tine.connect(tg); tg.connect(g); tine.start(t);
      const trem = audioCtx.createOscillator(), tgm = audioCtx.createGain(); trem.frequency.value = 4.2; tgm.gain.value = 0.18; trem.connect(tgm); if (pn) tgm.connect(pn.pan); trem.start(t);
      o.push(car, mod, tine, trem);
    } else if (kind === 'bell') {         // Glocke: unharmonisches FM (3,5) + Teilton 2,76, langer Ausklang
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.26 * v, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, 1.3);
      const car = osc('sine', f * 2, t, g), mod = audioCtx.createOscillator(), mg = audioCtx.createGain(); mod.frequency.value = f * 7; mg.gain.setValueAtTime(f * 5, t); mg.gain.setTargetAtTime(f * 0.4, t, 0.4); mod.connect(mg); mg.connect(car.frequency); mod.start(t);
      const p2 = audioCtx.createOscillator(), p2g = audioCtx.createGain(); p2.frequency.value = f * 2 * 2.76; p2g.gain.setValueAtTime(0.12 * v, t); p2g.gain.setTargetAtTime(0, t, 0.35); p2.connect(p2g); p2g.connect(g); p2.start(t);
      o.push(car, mod, p2);
    } else {                              // Pluck / Arp: zwei verstimmte Sägezähne (+ Rechteck beim Arp) durch resonantes Filter mit schneller Hüllkurve
      const lp = filt('lowpass', 400, kind === 'arp' ? 5 : 3);
      const top = kind === 'arp' ? 5200 : 4200, dec = kind === 'arp' ? 0.06 : 0.09;
      lp.frequency.setValueAtTime(top * (0.75 + 0.25 * v), t); lp.frequency.setTargetAtTime(380, t + 0.002, dec);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((kind === 'arp' ? 0.17 : 0.2) * v, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, kind === 'arp' ? 0.11 : 0.2);
      o.push(osc('sawtooth', f, t, lp, 0.55, -6), osc('sawtooth', f, t, lp, 0.55, 7));
      if (kind === 'arp') o.push(osc('square', f / 2, t, lp, 0.3));
      lp.connect(g);
    }
    g.connect(dest); const end = t + (kind === 'bell' ? 5 : kind === 'epiano' ? 4.5 : 1); o.forEach(x => { try { x.stop(end); } catch (e) {} });
    const vo = { g, o, pn, strike: true }; padVoices.push(vo);
    setTimeout(() => unhook(vo), (end - audioCtx.currentTime) * 1000 + 300);
    if (padVoices.length > 64) padVoices = padVoices.filter(x => !x.gone);
  }
  const RHYTHMIC = { pluck: 1, arp: 1 }, STRIKE = { epiano: 1, bell: 1 };
  function padChord(c, t) {
    padRelease(t);
    if (!st.pad) return;
    const out = padBus(), kind = st.padSound || 'pad', v = voicing(c);
    applySound(kind);
    if (RHYTHMIC[kind]) { arp = { notes: v, i: 0 }; return; }          // rhythmische Klänge spielt onStep
    if (STRIKE[kind]) { v.forEach((m, k) => strikeVoice(kind, m, t + k * 0.012, out, 0.85 + 0.15 * Math.random(), k, v.length)); return; }
    v.forEach((m, k) => padVoices.push(sustainVoice(kind, m, t, out, k, v.length)));
  }
  let arp = null;
  function arpStep(step, t, sd) {
    const kind = st.padSound; if (!st.pad || !RHYTHMIC[kind] || !arp || !arp.notes.length) return;
    const res = Rhythm.res();
    // Pluck: Achtel (im Shuffle-Raster die geswingte Achtel: Schritt 0 und 2 jeder Triole); Arpeggio: jeder Rasterschritt
    if (kind === 'pluck' && (res === 16 ? step % 2 !== 0 : step % 3 === 1)) return;
    const ns = arp.notes, seq = kind === 'arp' ? ns.concat(ns.map(m => m + 12)) : ns;
    const m = seq[arp.i % seq.length]; arp.i++;
    strikeVoice(kind, m, t, padBus(), step % (res / 4) === 0 ? 1 : 0.72, arp.i % 3, 3);
  }
  // ---- Ablauf am Taktgeber ----
  let run = null;          // { pending, beat, idx, pass, unlisten, ownDrums, events: [{t, idx, beat}] }
  function chordAtIdx(i) { return st.seq[((i % st.seq.length) + st.seq.length) % st.seq.length]; }
  function onStep(step, t, sd) {
    if (!run) return;
    const res = Rhythm.res(), per = res / 4;
    if (step % per !== 0) { if (!run.pending) arpStep(step, t, sd); return; }
    if (run.pending) { if (step !== 0) return; run.pending = false; run.beat = 0; run.idx = 0; run.inChord = 0; run.pass = 0; change(t); arpStep(step, t, sd); return; }
    run.inChord++;
    if (run.inChord >= chordAtIdx(run.idx).beats) {
      run.inChord = 0; run.idx++;
      if (run.idx >= st.seq.length) { run.idx = 0; run.pass++; trainerStep(); }
      change(t);
    }
    run.beat++;
    arpStep(step, t, sd);
    run.events.push({ t, idx: run.idx, inChord: run.inChord, beatDur: sd * per });
    if (run.events.length > 64) run.events.splice(0, 32);
  }
  function change(t) {
    const c = chordAtIdx(run.idx);
    run.cur = c;
    run.events.push({ t, idx: run.idx, inChord: 0, beatDur: Rhythm.stepDur() * Rhythm.res() / 4 });
    padChord(c, t);
  }
  function trainerStep() {
    const tr = st.trainer; if (!tr.on) return;
    const bpmEl = $('bpm'), cur = Math.round(parseFloat(bpmEl.value));
    if (run.pass % Math.max(1, tr.every) !== 0 || cur >= tr.target) return;
    const nb = Math.min(tr.target, cur + Math.max(1, tr.step));
    bpmEl.value = nb; bpmEl.dispatchEvent(new Event('input'));
    run.tempoNote = nb;
  }
  function start() {
    if (run) return;
    if (!st.seq.length) { status('Erst eine Akkordfolge eingeben.'); return; }
    if (typeof Looper !== 'undefined' && Looper.busy && Looper.busy()) { status('Der Looper läuft gerade – stoppe ihn zuerst (oder tippe nochmal auf ▶, dann stoppe ich ihn).'); if (start.warned) { Looper.stopAll(); } start.warned = !start.warned; if (!start.warned) setTimeout(start, 120); return; }
    start.warned = false;
    if (window.Lied && Lied.stop) Lied.stop();          // nur eine Begleitung gleichzeitig
    ensureAudio();
    if (st.trainer.on) { const b = $('bpm'); b.value = st.trainer.start; b.dispatchEvent(new Event('input')); }
    lastVoicing = null;
    run = { pending: true, beat: 0, idx: 0, pass: 0, inChord: 0, events: [], ownDrums: false };
    window.bassChordAt = () => { const c = run && run.cur; if (!c) return null; const iv = CH[c.t]; return { root: c.r, fifth: iv.includes(7) ? 7 : iv.includes(6) ? 6 : 7 }; };
    run.unlisten = Rhythm.addListener(onStep, true);
    if (st.drums && !Rhythm.on()) { Rhythm.setOn(true); run.ownDrums = true; }
    Rhythm.setJam(true);
    paintPlay(); status('Läuft – Improvisation und Quintenzirkel folgen dem Backing Track.');
    watch = setInterval(() => { if (run && typeof Looper !== 'undefined' && Looper.busy && Looper.busy()) { stop(); status('Gestoppt, weil der Looper gestartet wurde.'); } }, 300);
  }
  let watch = null;
  function stop() {
    if (!run) return;
    clearInterval(watch); watch = null;
    try { run.unlisten(); } catch (e) {}
    const own = run.ownDrums; run = null;
    window.bassChordAt = null;
    Rhythm.setJam(false);
    if (own && Rhythm.on()) Rhythm.setOn(false);
    if (audioCtx) padRelease(audioCtx.currentTime);
    paintPlay(); paintSeq(); status('Gestoppt.');
  }
  // aktueller Stand für Anzeige, Solo Finder und Quintenzirkel (in Schlägen; 1 Schlag = 1000 Einheiten)
  function now() {
    if (!run || run.pending || !audioCtx) return null;
    const t = audioCtx.currentTime; let e = null;
    for (let i = run.events.length - 1; i >= 0; i--) if (run.events[i].t <= t) { e = run.events[i]; break; }
    if (!e) return null;
    let beatPos = 0; for (let i = 0; i < e.idx; i++) beatPos += st.seq[i].beats;
    const frac = Math.min(0.999, Math.max(0, (t - e.t) / e.beatDur));
    return { idx: e.idx, pos: (beatPos + e.inChord + frac) * 1000 };
  }

  // ---- Oberfläche ----
  function status(t) { $('jamStatus').textContent = t; }
  function paintPlay() { const b = $('jamPlay'); b.classList.toggle('playing', !!run); b.setAttribute('aria-label', run ? 'Backing Track stoppen' : 'Backing Track starten'); }
  let selIdx = -1;
  function paintSeq() {
    const k = st.key, tot = totalBeats();
    $('jamKey').value = k.pc + ':' + (k.major ? 'M' : 'm');
    // Zeitleiste: 4 Takte je Zeile, jede Spalte ein Schlag; Akkorde, die über eine Zeile laufen, werden geteilt
    const PER = 16, rows = Math.max(1, Math.ceil(tot / PER)), segs = Array.from({ length: rows }, () => []);
    let pos = 0;
    st.seq.forEach((c, i) => {
      let left = c.beats, at = pos, first = true;
      while (left > 0) { const r = Math.floor(at / PER), col = at % PER, n = Math.min(left, PER - col); segs[r].push({ i, c, col, n, first, last: n === left }); at += n; left -= n; first = false; }
      pos += c.beats;
    });
    const lab = c => c.beats % 4 ? c.beats + ' Schl.' : (c.beats / 4) + (c.beats === 4 ? ' Takt' : ' Takte');
    $('jamSeq').innerHTML = tot ? segs.map((row, r) => '<div class="jam-row" data-r="' + r + '">' +
        '<div class="jam-bars">' + [0, 1, 2, 3].map(b => { const n = r * 4 + b + 1; return n <= Math.ceil(tot / 4) ? '<span data-bar="' + n + '">' + n + '</span>' : '<span></span>'; }).join('') + '</div>' +
        '<div class="jam-grid">' + row.map(g => '<button class="jam-c' + (g.i === selIdx ? ' sel' : '') + (g.first ? '' : ' cont') + (g.last ? '' : ' open') + '" data-i="' + g.i + '" style="grid-column:' + (g.col + 1) + ' / span ' + g.n + ';--n:' + g.n + '">' +
          (g.first ? '<b>' + cname(g.c, k) + '</b><small>' + roman(g.c, k) + ' · ' + lab(g.c) + '</small>' : '<b class="dim">' + cname(g.c, k) + '</b><small>weiter</small>') + '</button>').join('') +
        '<i class="jam-head" hidden></i></div></div>').join('')
      : '<div class="sf-empty">Noch keine Akkorde – Vorlage wählen, Akkorde antippen oder eintippen.</div>';
    $('jamLen').textContent = tot ? (tot / 4) + ' Takte' : '';
    $('jamText').value = st.seq.map(c => (cname(c, k) + (c.beats !== 4 ? ':' + (c.beats / 4) : '')).replace(/[♯]/g, '#').replace(/[♭]/g, 'b').replace('°', 'dim')).join(' ');
    $('jamEdit').hidden = selIdx < 0 || selIdx >= st.seq.length;
    // Akkorde der Tonart zum Anhängen
    const iv = k.major ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10], qs = k.major ? ['', 'm', 'm', '', '', 'm', 'dim'] : ['m', 'dim', '', 'm', 'm', '', ''];
    const pal = iv.map((x, i) => ({ r: md(k.pc + x), t: qs[i] }));
    if (!k.major) pal.push({ r: md(k.pc + 7), t: '7' }); else pal.push({ r: md(k.pc + 10), t: '' });
    $('jamPal').innerHTML = pal.map(c => '<button class="sf-ch" data-r="' + c.r + '" data-t="' + c.t + '"><small>' + roman(c, k) + '</small><b>' + cname(c, k) + '</b></button>').join('');
    $('jamPre').innerHTML = '<option value="">Vorlage wählen …</option>' + (k.major ? PRE.maj : PRE.min).map((p, i) => '<option value="' + i + '">' + p[0] + '</option>').join('');
    paintTrainer();
  }
  function paintTrainer() {
    const tr = st.trainer;
    $('jamTr').checked = tr.on; ['start', 'target', 'step', 'every'].forEach(x => { $('jamTr_' + x).value = tr[x]; });
    $('jamTrBox').classList.toggle('off', !tr.on);
  }
  let lastOn = -1;
  let lastHead = null, lastBar = -1;
  function tickUi() {
    const n = now(), i = n ? n.idx : -1;
    if (i !== lastOn) { $('jamSeq').querySelectorAll('.jam-c').forEach(b => b.classList.toggle('on', +b.dataset.i === i)); lastOn = i; }
    // Laufmarke: genaue Position in der Zeitleiste, aktueller Takt hervorgehoben
    const tot = totalBeats();
    if (n && tot) {
      const beat = (n.pos / 1000) % tot, r = Math.floor(beat / 16), col = beat - r * 16, bar = Math.floor(beat / 4) + 1;
      const row = $('jamSeq').querySelector('.jam-row[data-r="' + r + '"]'), head = row && row.querySelector('.jam-head');
      if (lastHead && lastHead !== head) lastHead.hidden = true;
      if (head) { head.hidden = false; head.style.left = (col / 16 * 100) + '%'; lastHead = head; }
      if (bar !== lastBar) { $('jamSeq').querySelectorAll('.jam-bars span').forEach(sp => sp.classList.toggle('on', +sp.dataset.bar === bar)); lastBar = bar; }
    } else if (lastHead) { lastHead.hidden = true; lastHead = null; $('jamSeq').querySelectorAll('.jam-bars span.on').forEach(sp => sp.classList.remove('on')); lastBar = -1; }
    $('jamBpm').textContent = Math.round(parseFloat($('bpm').value));
    $('jamPass').textContent = run && !run.pending ? 'Durchlauf ' + (run.pass + 1) + (st.trainer.on ? ' · Ziel ' + st.trainer.target + ' BPM' : '') : '';
  }
  // Bedienung
  $('jamPlay').addEventListener('click', () => run ? stop() : start());
  $('jamKey').addEventListener('change', e => {
    const [p, m] = e.target.value.split(':'), nk = { pc: +p, major: m === 'M' }, d = md(nk.pc - st.key.pc);
    // Folge mittransponieren, wenn nur der Grundton wechselt; bei Dur↔Moll die passende erste Vorlage
    if (nk.major === st.key.major) st.seq.forEach(c => { c.r = md(c.r + d); });
    else st.seq = fromPreset(nk, nk.major ? PRE.maj[0][1] : PRE.min[0][1]);
    st.key = nk; selIdx = -1; save(); paintSeq();
  });
  $('jamPre').addEventListener('change', e => { if (e.target.value === '') return; const p = (st.key.major ? PRE.maj : PRE.min)[+e.target.value]; st.seq = fromPreset(st.key, p[1]); selIdx = -1; save(); paintSeq(); status('Vorlage „' + p[0] + '“ geladen.'); });
  $('jamPal').addEventListener('click', e => {
    const b = e.target.closest('.sf-ch'); if (!b) return;
    const c = { r: +b.dataset.r, t: b.dataset.t, beats: 4 };
    st.seq.push(c); save(); paintSeq();
    if (window.Quinten && !run) Quinten.play(c.r, CH[c.t]);
  });
  $('jamApply').addEventListener('click', () => {
    const r = parse($('jamText').value);
    if (!r.seq.length) { status('Keine Akkorde erkannt' + (r.bad.length ? ': ' + r.bad.join(' ') : '') + '.'); return; }
    st.seq = r.seq; selIdx = -1; save(); paintSeq();
    status(r.bad.length ? 'Übernommen – nicht verstanden: ' + r.bad.join(' ') : 'Übernommen: ' + r.seq.length + ' Akkorde.');
  });
  $('jamText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('jamApply').click(); } });
  $('jamSeq').addEventListener('click', e => {
    const b = e.target.closest('.jam-c'); if (!b) return;
    const i = +b.dataset.i; selIdx = selIdx === i ? -1 : i; paintSeq();
    const c = st.seq[i]; if (c && window.Quinten && !run) Quinten.play(c.r, CH[c.t]);
  });
  $('jamEdit').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || selIdx < 0) return;
    const c = st.seq[selIdx];
    if (b.dataset.len) c.beats = +b.dataset.len;
    else if (b.dataset.act === 'del') { st.seq.splice(selIdx, 1); selIdx = -1; }
    else if (b.dataset.act === 'left' && selIdx > 0) { st.seq.splice(selIdx - 1, 0, st.seq.splice(selIdx, 1)[0]); selIdx--; }
    else if (b.dataset.act === 'right' && selIdx < st.seq.length - 1) { st.seq.splice(selIdx + 1, 0, st.seq.splice(selIdx, 1)[0]); selIdx++; }
    else if (b.dataset.act === 'dup') { st.seq.splice(selIdx + 1, 0, Object.assign({}, c)); selIdx++; }
    save(); paintSeq();
  });
  $('jamUndo').addEventListener('click', () => { st.seq.pop(); selIdx = -1; save(); paintSeq(); });
  $('jamClear').addEventListener('click', () => { if (run) stop(); st.seq = []; selIdx = -1; save(); paintSeq(); });
  $('jamBpmDown').addEventListener('click', () => { const b = $('bpm'); b.value = Math.max(40, Math.round(parseFloat(b.value)) - 2); b.dispatchEvent(new Event('input')); tickUi(); });
  $('jamBpmUp').addEventListener('click', () => { const b = $('bpm'); b.value = Math.min(200, Math.round(parseFloat(b.value)) + 2); b.dispatchEvent(new Event('input')); tickUi(); });
  $('jamPad').checked = st.pad; $('jamDrums').checked = st.drums; $('jamPadVol').value = st.padVol;
  // Synth-Klang
  const soundEl = $('jamSound'); soundEl.value = st.padSound || 'pad'; if (!soundEl.value) soundEl.value = 'pad';
  soundEl.addEventListener('change', () => { st.padSound = soundEl.value; save(); if (run && run.cur && audioCtx) padChord(run.cur, audioCtx.currentTime + 0.02); });
  // Beat: dieselbe Auswahl wie die Looper-Drums (beide Listen bleiben gleich)
  const jStyle = $('jamStyle'), lStyle = $('loopDrumStyle');
  const syncList = () => { if (!lStyle) return; const v = lStyle.value; jStyle.innerHTML = lStyle.innerHTML; jStyle.value = v; };
  syncList();
  jStyle.addEventListener('pointerdown', syncList); jStyle.addEventListener('focus', syncList);
  jStyle.addEventListener('change', () => { if (!lStyle) return; lStyle.value = jStyle.value; lStyle.dispatchEvent(new Event('change')); });
  if (lStyle) lStyle.addEventListener('change', () => { if (jStyle.value !== lStyle.value) syncList(); });
  $('jamPad').addEventListener('change', e => { st.pad = e.target.checked; save(); if (!st.pad && audioCtx) padRelease(audioCtx.currentTime); else if (run && run.cur) padChord(run.cur, audioCtx.currentTime + 0.02); });
  $('jamDrums').addEventListener('change', e => { st.drums = e.target.checked; save(); if (run) { if (st.drums && !Rhythm.on()) { Rhythm.setOn(true); run.ownDrums = true; } else if (!st.drums && Rhythm.on()) Rhythm.setOn(false); } });
  $('jamPadVol').addEventListener('input', e => { st.padVol = +e.target.value; save(); if (padOut) padOut.gain.setTargetAtTime(padGain(), audioCtx.currentTime, 0.05); });
  $('jamBass').addEventListener('click', () => { const b = $('btnBass'); if (b) b.click(); setTimeout(paintBass, 30); });
  function paintBass() { const on = typeof bassOn !== 'undefined' && bassOn; const b = $('jamBass'); b.classList.toggle('active', on); b.textContent = on ? 'Bass an' : 'Bass aus'; }
  $('jamTr').addEventListener('change', e => { st.trainer.on = e.target.checked; save(); paintTrainer(); });
  ['start', 'target', 'step', 'every'].forEach(x => $('jamTr_' + x).addEventListener('change', e => {
    const lim = { start: [40, 200], target: [40, 200], step: [1, 20], every: [1, 16] }[x];
    st.trainer[x] = Math.max(lim[0], Math.min(lim[1], Math.round(+e.target.value) || lim[0])); e.target.value = st.trainer[x]; save();
  }));
  // Tonart-Auswahl füllen
  const ks = $('jamKey');
  for (let p = 0; p < 12; p++) ks.add(new Option(SHARP[p] + (FLAT[p] !== SHARP[p] ? '/' + FLAT[p] : '') + '-Dur', p + ':M'));
  for (let p = 0; p < 12; p++) ks.add(new Option(SHARP[p] + (FLAT[p] !== SHARP[p] ? '/' + FLAT[p] : '') + '-Moll', p + ':m'));
  let uiTimer = null;
  document.addEventListener('tabchange', e => {
    clearInterval(uiTimer); uiTimer = null;
    if (e.detail === 'jam') { paintSeq(); paintBass(); tickUi(); uiTimer = setInterval(tickUi, 80); }
  });
  paintSeq(); paintPlay();
  // Schnittstelle für Solo Finder, Quintenzirkel und Tests
  window.Jam = {
    active: () => !!run && !run.pending,
    chordInfo: () => {
      if (!run || run.pending) return null;
      const n = now(), names = st.seq.map(c => SHARP[c.r].replace('♯', '#') + c.t);
      let a = 0; const segs = st.seq.map((c, i) => { const s = { name: names[i], a: a * 1000, e: (a + c.beats) * 1000 }; a += c.beats; return s; });
      const downs = []; for (let b = 0; b < a; b += 4) downs.push(b * 1000);
      return { tracks: [], track: -2, segs, L: a * 1000, pos: n ? n.pos : null, downs, sr: 1000, key: { pc: st.key.pc, major: st.key.major }, playing: true, jam: true };
    },
    nowChord: () => { const n = now(); if (!n) return null; const c = st.seq[n.idx]; return c ? { name: SHARP[c.r].replace('♯', '#') + c.t } : null; },
    start, stop, parse, state: () => st, setSeq: (text) => { const r = parse(text); st.seq = r.seq; save(); paintSeq(); return r; },
    // Tonart und Vorlage setzen (Tagesübung): presetIdx aus der Dur- bzw. Moll-Liste
    load: (key, presetIdx) => { if (run) stop(); st.key = { pc: md(key.pc), major: !!key.major }; const list = st.key.major ? PRE.maj : PRE.min; const p = list[Math.max(0, Math.min(list.length - 1, presetIdx | 0))]; st.seq = fromPreset(st.key, p[1]); selIdx = -1; save(); paintSeq(); return p[0]; },
    presets: () => ({ maj: PRE.maj.map(p => p[0]), min: PRE.min.map(p => p[0]) }),
    debug: () => run ? { pending: run.pending, idx: run.idx, pass: run.pass, beat: run.beat, cur: run.cur, ownDrums: run.ownDrums } : null
  };
})();
