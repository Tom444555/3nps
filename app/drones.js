/* ---------- Drone-Stile III und IV ----------
   III „Nordmeer – Wikinger“: Tagelharpa-Bordun, tiefer Männerchor (Formanten), Wind, Brandung, Kriegstrommeln, Horn.
   IV  „Nordlicht – Eis & Glas“: schwebende Flächen, gläserne Glocken aus der Skala, eisiger Wind, weiter Raum.
   Beide folgen Grundton und Modus (auch der Drone-Spur im Looper) und laufen über den gemeinsamen Ausgang. */
const NordDrones = (() => {
  let irCache = {};
  function hallIR(sec, decay, bright) {
    const key = sec + '|' + decay + '|' + bright;
    if (irCache[key]) return irCache[key];
    const sr = audioCtx.sampleRate, n = Math.round(sr * sec), b = audioCtx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, a = Math.min(0.985, bright + (1 - bright) * t / sec);   // wird mit der Zeit dunkler
        lp += (Math.random() * 2 - 1 - lp) * (1 - a);
        d[i] = lp * Math.pow(1 - i / n, decay) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    // Normalisieren auf angenehme Lautheit
    let e = 0; for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i += 4) e += d[i] * d[i]; }
    const g = 0.6 / Math.sqrt(e / (n / 2) * sec * 40 + 1e-9);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= g; }
    irCache[key] = b; return b;
  }
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const sr = audioCtx.sampleRate, n = sr * 6; noiseBuf = audioCtx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {             // rosa Rauschen (Paul Kellet), nahtlos
      const d = noiseBuf.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
      const f = Math.round(sr * 0.25); for (let i = 0; i < f; i++) { const g = i / f; d[n - f + i] = d[n - f + i] * (1 - g) + d[i] * g; }
    }
    return noiseBuf;
  }
  const ac = () => audioCtx;
  // Klänge, die zeitgesteuert entstehen (Trommel, Horn, Glocke, Harfe, Vogel …), sammeln ihre Knoten
  // und werden nach dem Ausklingen vom Graphen getrennt – sonst sammeln sich in Safari über Stunden Tausende an.
  let vNodes = null;
  const tr = n => { if (vNodes) vNodes.push(n); return n; };
  function voice(fn) {
    const prev = vNodes, mine = []; vNodes = mine;
    try { fn(); } finally {
      vNodes = prev;
      const srcs = mine.filter(n => typeof n.start === 'function');
      if (srcs.length) {
        let left = srcs.length;
        const done = () => { if (--left > 0) return; mine.forEach(n => { try { n.disconnect(); } catch (e) {} }); };
        srcs.forEach(x => { try { x.addEventListener('ended', done, { once: true }); } catch (e) { x.onended = done; } });
      }
    }
  }
  const T = (fn, ms) => setTimeout(() => voice(fn), ms);
  function osc(type, f, det) { const o = tr(ac().createOscillator()); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; return o; }
  function gain(v) { const g = tr(ac().createGain()); g.gain.value = v; return g; }
  function filt(type, f, q) { const b = tr(ac().createBiquadFilter()); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; }
  function lfo(rate, depth, target, type) { const o = osc(type || 'sine', rate), g = gain(depth); o.connect(g); g.connect(target); o.start(); return o; }
  function pan(v) { try { const p = tr(ac().createStereoPanner()); p.pan.value = v; return p; } catch (e) { return gain(1); } }
  function noiseSrc(offset) { const s = tr(ac().createBufferSource()); s.buffer = noise(); s.loop = true; s.start(ac().currentTime, offset || 0); return s; }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const orn = () => { const el = document.getElementById('pianoShimmer'); return !el || el.checked; };
  const bpm = () => parseFloat(document.getElementById('bpm').value) || 80;
  function scaleMidis(lo, hi) {
    const k = keyMidiNotes(), ov = window.droneKeyOverride || null;
    const iv = MODES[ov && ov.mode ? ov.mode : modeSel.value], root = k.root % 12, out = [];
    for (let m = lo; m <= hi; m++) { const pc = ((m - root) % 12 + 12) % 12; if (iv.includes(pc)) out.push(m); }
    return out;
  }
  function setStatus(txt) { const s = document.getElementById('droneStatus'); if (s) s.textContent = txt; }
  function btnOn(v) { const b = document.getElementById('droneBtn'); b.textContent = v ? '■' : '▶'; b.classList.toggle('playing', v); }

  // ===================== III Nordmeer – Wikinger =====================
  function startV3() {
    ensureAudio();
    const vol = parseInt(document.getElementById('droneVolume').value) / 100, t0 = ac().currentTime, k = keyMidiNotes();
    const master = gain(0); master.connect(ensureMasterBus());
    master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(vol, t0 + 3.5);
    const hall = ac().createConvolver(); hall.buffer = hallIR(4.6, 2.2, 0.35);
    const wet = gain(0.55); hall.connect(wet); wet.connect(master);
    const dry = gain(0.8); dry.connect(master);
    const send = (node, amt) => { const s = gain(amt); node.connect(s); s.connect(hall); };
    const N = { master, voices: [], stops: [], timers: [] };

    // 1) Tagelharpa-Bordun: Sägezähne durch Korpus-Filter, langsam atmend
    const body = filt('lowpass', 950, 0.8), res = filt('peaking', 290, 1.2); res.gain.value = 5;
    const bodyG = gain(0.16); body.connect(res); res.connect(bodyG); bodyG.connect(dry); send(bodyG, 0.5);
    N.stops.push(lfo(0.07, 260, body.frequency), lfo(0.11, 0.05, bodyG.gain));
    [['root', -5], ['root', 5], ['fifth', -3], ['fifth', 4], ['root8', 0]].forEach(([role, det]) => {
      const o = osc('sawtooth', hz(k[role]), det), g = gain(role === 'root8' ? 0.35 : 0.5);
      o.connect(g); g.connect(body); o.start(); N.voices.push({ o, role });
    });
    // 2) Tiefer Männerchor: „o“ ↔ „a“, Vibrato, als Ensemble
    const chorus = gain(0.11), f1 = filt('bandpass', 450, 6), f2 = filt('bandpass', 800, 8), f3 = filt('bandpass', 2700, 10);
    const g1 = gain(1), g2 = gain(0.55), g3 = gain(0.18), choirOut = gain(1);
    chorus.connect(f1); chorus.connect(f2); chorus.connect(f3); f1.connect(g1); f2.connect(g2); f3.connect(g3);
    [g1, g2, g3].forEach(g => g.connect(choirOut)); choirOut.connect(dry); send(choirOut, 0.9);
    N.stops.push(lfo(1 / 17, 130, f1.frequency), lfo(1 / 17, 260, f2.frequency), lfo(1 / 23, 0.05, choirOut.gain));
    [['root', -8], ['root', 6], ['root8', -4], ['root8', 9], ['fifth', 0]].forEach(([role, det], i) => {
      const o = osc('sawtooth', hz(k[role]), det), g = gain(role === 'fifth' ? 0.4 : 0.8);
      N.stops.push(lfo(4.6 + i * 0.37, 4, o.detune));
      o.connect(g); g.connect(chorus); o.start(); N.voices.push({ o, role });
    });
    // 3) Sub
    const sub = osc('sine', hz(k.sub)), subG = gain(0.13); sub.connect(subG); subG.connect(dry); sub.start(); N.voices.push({ o: sub, role: 'sub' });
    // 4) Wind: Böen und Pfeifen, wandert im Stereobild
    const wsrc = noiseSrc(1.3), wbp = filt('bandpass', 700, 1.1), wg = gain(0.0), wp = pan(0);
    wsrc.connect(wbp); wbp.connect(wg); wg.connect(wp); wp.connect(dry); send(wp, 0.3);
    N.stops.push(wsrc, lfo(0.05, 380, wbp.frequency), lfo(0.13, 160, wbp.frequency), lfo(0.031, 0.8, wp.pan || wg.gain));
    const whis = filt('bandpass', 1400, 14), whG = gain(0.0); wsrc.connect(whis); whis.connect(whG); whG.connect(wp);
    N.stops.push(lfo(0.027, 520, whis.frequency));
    // 5) Brandung: langsame Wellen mit Gischt
    const sea = noiseSrc(3.1), seaLp = filt('lowpass', 520, 0.6), seaG = gain(0.02), seaP = pan(-0.2);
    const foam = filt('highpass', 2600, 0.6), foamG = gain(0);
    sea.connect(seaLp); seaLp.connect(seaG); seaG.connect(seaP); seaP.connect(dry); send(seaP, 0.25);
    sea.connect(foam); foam.connect(foamG); foamG.connect(seaP);
    N.stops.push(sea);
    function wave() {
      const t = ac().currentTime + 0.05, up = 2.2 + Math.random() * 1.5, down = 3.5 + Math.random() * 2.5, peak = 0.16 + Math.random() * 0.1;
      seaG.gain.cancelScheduledValues(t); seaG.gain.setTargetAtTime(peak, t, up / 3); seaG.gain.setTargetAtTime(0.03, t + up, down / 3);
      foamG.gain.cancelScheduledValues(t); foamG.gain.setTargetAtTime(0.06, t + up * 0.8, 0.4); foamG.gain.setTargetAtTime(0, t + up + 0.6, 0.9);
      seaLp.frequency.setTargetAtTime(380 + Math.random() * 400, t, 2);
      N.timers.push(T(wave, (up + down) * 1000 * (0.8 + Math.random() * 0.4)));
    }
    function gust() {
      const t = ac().currentTime + 0.05, a = 0.06 + Math.random() * 0.12, d = 2 + Math.random() * 4;
      wg.gain.setTargetAtTime(a, t, d / 3); wg.gain.setTargetAtTime(0.025, t + d, d / 2);
      whG.gain.setTargetAtTime(Math.random() < 0.35 ? 0.02 : 0.0, t, 1.2);
      N.timers.push(T(gust, (d * 1.6 + Math.random() * 3) * 1000));
    }
    wave(); gust();
    // 6) Kriegstrommeln (Verzierungen): „DUM . . . | DUM . DUM .“ im Tempo, auf den Takt
    function drum(t, big) {
      const o = osc('sine', big ? 92 : 120), g = gain(0), sk = noiseSrc(Math.random() * 4), lp = filt('lowpass', big ? 520 : 900, 0.7), sg = gain(0);
      o.frequency.setValueAtTime(big ? 92 : 120, t); o.frequency.exponentialRampToValueAtTime(big ? 46 : 70, t + 0.25);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(big ? 0.55 : 0.28, t + 0.006); g.gain.setTargetAtTime(0, t + 0.01, big ? 0.32 : 0.16);
      sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(big ? 0.25 : 0.12, t + 0.003); sg.gain.setTargetAtTime(0, t + 0.004, 0.05);
      o.connect(g); sk.connect(lp); lp.connect(sg); [g, sg].forEach(x => { x.connect(dry); send(x, 0.7); });
      o.start(t); o.stop(t + 2.2); sk.stop(t + 0.4);
    }
    let nextBar = 0, barN = 0;
    function drums() {
      if (!N.alive) return;
      const now = ac().currentTime, bd = 240 / bpm(), bt = bd / 4;
      if (!nextBar) nextBar = typeof Rhythm !== 'undefined' ? Rhythm.nextBarTime() : now + 0.2;
      while (nextBar < now + 0.3) {
        if (orn()) {
          if (barN % 2 === 0) drum(nextBar, true);
          else { drum(nextBar, true); drum(nextBar + 2 * bt, false); drum(nextBar + 3 * bt, true); }
        }
        nextBar += bd; barN++;
      }
      N.timers.push(T(drums, 120));
    }
    // 7) Horn (Lure) ab und zu, auf Grundton oder Quinte
    function horn() {
      if (!N.alive) return;
      if (orn()) {
        const t = ac().currentTime + 0.1, kk = keyMidiNotes(), m = Math.random() < 0.6 ? kk.root8 : kk.fifth;
        const o = osc('sawtooth', hz(m)), o2 = osc('sawtooth', hz(m), 7), lp = filt('lowpass', 1100, 1.5), g = gain(0), p = pan((Math.random() - 0.5) * 0.8);
        o.detune.setValueAtTime(-40, t); o.detune.linearRampToValueAtTime(0, t + 0.6);
        lfo(5.2, 6, o.detune).stop(t + 5.6);
        lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1500, t + 1.4); lp.frequency.linearRampToValueAtTime(700, t + 5);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 1.4); g.gain.setValueAtTime(0.09, t + 3.2); g.gain.linearRampToValueAtTime(0, t + 5.4);
        [o, o2].forEach(x => { x.connect(lp); x.start(t); x.stop(t + 5.6); }); lp.connect(g); g.connect(p); p.connect(dry); send(p, 1.2);
      }
      N.timers.push(T(horn, (24 + Math.random() * 18) * 1000));
    }
    N.alive = true;
    N.timers.push(T(drums, 600), T(horn, 9000));
    N.retune = () => { const kk = keyMidiNotes(), t = ac().currentTime; N.voices.forEach(v => v.o.frequency.setTargetAtTime(hz(kk[v.role]), t, 0.4)); };
    return N;
  }

  // ===================== IV Nordlicht – Eis & Glas =====================
  function startV4() {
    ensureAudio();
    const vol = parseInt(document.getElementById('droneVolume').value) / 100, t0 = ac().currentTime, k = keyMidiNotes();
    const master = gain(0); master.connect(ensureMasterBus());
    master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(vol, t0 + 4);
    const hall = ac().createConvolver(); hall.buffer = hallIR(6.5, 1.6, 0.15);
    const wet = gain(0.75); hall.connect(wet); wet.connect(master);
    const dry = gain(0.6); dry.connect(master);
    const send = (node, amt) => { const s = gain(amt); node.connect(s); s.connect(hall); };
    const N = { master, voices: [], stops: [], timers: [], alive: true };
    // Fläche: weiche Teiltöne, je Ton zwei leicht verstimmte Stimmen mit eigenem Atem
    const real = new Float32Array([0, 1, 0.42, 0.2, 0.11, 0.06, 0.035, 0.02]), imag = new Float32Array(real.length);
    const wave = ac().createPeriodicWave(real, imag);
    const padLp = filt('lowpass', 2400, 0.5), padG = gain(0.075);
    padLp.connect(padG); padG.connect(dry); send(padG, 1);
    N.stops.push(lfo(0.045, 900, padLp.frequency));
    const roles = [['root8', 0], ['fifthUp', 0], ['third8', 0], ['root16', 0]];
    const roleMidi = (kk, r) => r === 'root8' ? kk.root8 : r === 'fifthUp' ? kk.fifth + 12 : r === 'third8' ? kk.pianoChord[1] : kk.root8 + 12;
    roles.forEach(([r], i) => [-7, 7].forEach(det => {
      const o = ac().createOscillator(); o.setPeriodicWave(wave); o.frequency.value = hz(roleMidi(k, r)); o.detune.value = det;
      const g = gain(0.5), p = pan(det < 0 ? -0.45 : 0.45);
      N.stops.push(lfo(0.05 + i * 0.013 + (det > 0 ? 0.007 : 0), 0.35, g.gain));
      o.connect(g); g.connect(p); p.connect(padLp); o.start(); N.voices.push({ o, r });
    }));
    const sub = osc('sine', hz(k.sub + 12)), subG = gain(0.07); sub.connect(subG); subG.connect(dry); sub.start(); N.voices.push({ o: sub, r: 'sub' });
    // Eisiger Wind, hoch und leise
    const ws = noiseSrc(2.2), wbp = filt('bandpass', 3600, 0.9), whp = filt('highpass', 1800, 0.5), wg = gain(0.035), wp = pan(0);
    ws.connect(wbp); wbp.connect(whp); whp.connect(wg); wg.connect(wp); wp.connect(dry); send(wp, 0.5);
    N.stops.push(ws, lfo(0.037, 1500, wbp.frequency), lfo(0.023, 0.02, wg.gain));
    // Glasglocken (FM), Töne aus der Skala, mal einzeln, mal als kleines Arpeggio
    function bell(t, m, amp) {
      const f = hz(m), car = osc('sine', f), mod = osc('sine', f * 3.51), mg = gain(0), g = gain(0), p = pan((Math.random() - 0.5) * 1.4);
      mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.6);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 1.3);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(p); p.connect(dry); send(p, 1.4);
      const p2 = osc('sine', f * 2.756), g2 = gain(0); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(amp * 0.25, t + 0.003); g2.gain.setTargetAtTime(0, t + 0.005, 0.4);
      p2.connect(g2); g2.connect(p);
      [car, mod, p2].forEach(o => { o.start(t); o.stop(t + 6); });
    }
    function bells() {
      if (!N.alive) return;
      const notes = scaleMidis(72, 93), t = ac().currentTime + 0.05;
      if (notes.length) {
        if (Math.random() < (orn() ? 0.35 : 0.15)) { const st = Math.floor(Math.random() * Math.max(1, notes.length - 6)); [0, 2, 4].forEach((d, i) => bell(t + i * 0.18, notes[Math.min(notes.length - 1, st + d)], 0.05)); }
        else bell(t, notes[Math.floor(Math.random() * notes.length)], 0.045 + Math.random() * 0.03);
      }
      N.timers.push(T(bells, (orn() ? 1.6 + Math.random() * 3 : 4 + Math.random() * 5) * 1000));
    }
    N.timers.push(T(bells, 1500));
    N.retune = () => { const kk = keyMidiNotes(), t = ac().currentTime; N.voices.forEach(v => v.o.frequency.setTargetAtTime(v.r === 'sub' ? hz(kk.sub + 12) : hz(roleMidi(kk, v.r)), t, 0.6)); };
    return N;
  }

  // ===================== V Elbenküste – Meer & Chor =====================
  function startV5() {
    ensureAudio();
    const vol = parseInt(document.getElementById('droneVolume').value) / 100, t0 = ac().currentTime, k = keyMidiNotes();
    const master = gain(0); master.connect(ensureMasterBus());
    master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(vol, t0 + 5);
    const hall = ac().createConvolver(); hall.buffer = hallIR(5.5, 1.8, 0.2);
    const wet = gain(0.7); hall.connect(wet); wet.connect(master);
    const dry = gain(0.7); dry.connect(master);
    const send = (node, amt) => { const s = gain(amt); node.connect(s); s.connect(hall); };
    const N = { master, voices: [], stops: [], timers: [], alive: true };
    // Streicher-Fläche: weich, breit, langsam atmend
    const str = filt('lowpass', 1100, 0.6), strG = gain(0.07); str.connect(strG); strG.connect(dry); send(strG, 0.9);
    N.stops.push(lfo(0.06, 300, str.frequency), lfo(0.041, 0.025, strG.gain));
    [['root', -6, -0.5], ['root', 6, 0.5], ['fifth', -4, -0.3], ['fifth', 5, 0.3], ['root8', 0, 0]].forEach(([role, det, pn]) => {
      const o = osc('sawtooth', hz(k[role]), det), g = gain(role === 'root8' ? 0.5 : 0.7), pp = pan(pn);
      N.stops.push(lfo(0.17 + Math.random() * 0.1, 3, o.detune));
      o.connect(g); g.connect(pp); pp.connect(str); o.start(); N.voices.push({ o, role });
    });
    // Heller Chor („aah“ ↔ „ooh“), eine Oktave höher, wie aus der Ferne
    const ch = gain(0.05), c1 = filt('bandpass', 800, 7), c2 = filt('bandpass', 1150, 9), c3 = filt('bandpass', 2900, 12);
    const cg1 = gain(1), cg2 = gain(0.6), cg3 = gain(0.2), cOut = gain(1), cp = pan(0);
    ch.connect(c1); ch.connect(c2); ch.connect(c3); c1.connect(cg1); c2.connect(cg2); c3.connect(cg3);
    [cg1, cg2, cg3].forEach(g => g.connect(cOut)); cOut.connect(cp); cp.connect(dry); send(cp, 1.4);
    N.stops.push(lfo(1 / 19, 260, c1.frequency), lfo(1 / 19, 380, c2.frequency), lfo(1 / 29, 0.6, cp.pan || cOut.gain), lfo(1 / 13, 0.4, cOut.gain));
    [['root8', -7], ['root8', 8], ['fifth8', -5], ['fifth8', 6], ['root16', 0]].forEach(([role, det], i) => {
      const m = role === 'fifth8' ? k.fifth + 12 : role === 'root16' ? k.root8 + 12 : k.root8;
      const o = osc('sawtooth', hz(m), det), g = gain(0.6);
      N.stops.push(lfo(5.1 + i * 0.29, 5, o.detune));
      o.connect(g); g.connect(ch); o.start(); N.voices.push({ o, role });
    });
    const sub = osc('sine', hz(k.sub + 12)), subG = gain(0.08); sub.connect(subG); subG.connect(dry); sub.start(); N.voices.push({ o: sub, role: 'subUp' });
    // Meeresrauschen: tiefe Dünung, brechende Welle, zurücklaufendes Zischen – abwechselnd links und rechts
    const sea = noiseSrc(0.7), lowLp = filt('lowpass', 380, 0.5), lowG = gain(0.04), crash = filt('bandpass', 1400, 0.5), crashG = gain(0), hiss = filt('highpass', 3200, 0.5), hissG = gain(0), sp = pan(0);
    sea.connect(lowLp); lowLp.connect(lowG); lowG.connect(sp);
    sea.connect(crash); crash.connect(crashG); crashG.connect(sp);
    sea.connect(hiss); hiss.connect(hissG); hissG.connect(sp);
    sp.connect(dry); send(sp, 0.35); N.stops.push(sea);
    let side = 1;
    function wave() {
      if (!N.alive) return;
      const t = ac().currentTime + 0.05, rise = 3 + Math.random() * 2, fall = 4 + Math.random() * 3, pk = 0.11 + Math.random() * 0.06;
      side = -side; if (sp.pan) sp.pan.setTargetAtTime(side * (0.2 + Math.random() * 0.35), t, 2);
      lowG.gain.setTargetAtTime(pk, t, rise / 3); lowG.gain.setTargetAtTime(0.03, t + rise, fall / 3);
      crashG.gain.setTargetAtTime(0, t, 0.2); crashG.gain.setTargetAtTime(pk * 0.5, t + rise * 0.85, 0.35); crashG.gain.setTargetAtTime(0, t + rise + 0.8, 1.2);
      hissG.gain.setTargetAtTime(pk * 0.28, t + rise + 0.4, 0.6); hissG.gain.setTargetAtTime(0, t + rise + 1.6, fall / 3);
      crash.frequency.setTargetAtTime(900 + Math.random() * 900, t, 1.5);
      N.timers.push(T(wave, (rise + fall) * 1000 * (0.85 + Math.random() * 0.3)));
    }
    wave();
    // Harfe (Verzierungen): kleine Arpeggios aus der Skala
    function harp(t, m, amp) {
      const f = hz(m), g = gain(0), p = pan((Math.random() - 0.5) * 1.2);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.004); g.gain.setTargetAtTime(0, t + 0.006, 0.9);
      [[1, 1], [2, 0.35], [3, 0.12], [4, 0.05]].forEach(([h, a]) => { const o = osc('sine', f * h), og = gain(a); o.connect(og); og.connect(g); o.start(t); o.stop(t + 4.5); });
      g.connect(p); p.connect(dry); send(p, 1.1);
    }
    function harps() {
      if (!N.alive) return;
      if (orn()) {
        const notes = scaleMidis(60, 86), t = ac().currentTime + 0.05;
        if (notes.length > 6) {
          const st = Math.floor(Math.random() * (notes.length - 6)), up = Math.random() < 0.7, n = 4 + Math.floor(Math.random() * 4);
          for (let i = 0; i < n; i++) harp(t + i * (0.16 + Math.random() * 0.05), notes[Math.min(notes.length - 1, st + (up ? i : n - 1 - i) * (Math.random() < 0.5 ? 1 : 2))], 0.05);
        }
      }
      N.timers.push(T(harps, (9 + Math.random() * 12) * 1000));
    }
    N.timers.push(T(harps, 4000));
    const roleMidi = (kk, r) => r === 'fifth8' ? kk.fifth + 12 : r === 'root16' ? kk.root8 + 12 : r === 'subUp' ? kk.sub + 12 : kk[r];
    N.retune = () => { const kk = keyMidiNotes(), t = ac().currentTime; N.voices.forEach(v => v.o.frequency.setTargetAtTime(hz(roleMidi(kk, v.role)), t, 0.6)); };
    return N;
  }

  // ===================== VI Waldesruh – Elbenwald =====================
  function startV6() {
    ensureAudio();
    const vol = parseInt(document.getElementById('droneVolume').value) / 100, t0 = ac().currentTime, k = keyMidiNotes();
    const master = gain(0); master.connect(ensureMasterBus());
    master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(vol, t0 + 5);
    const hall = ac().createConvolver(); hall.buffer = hallIR(3.6, 2.4, 0.25);      // Wald: kürzer, weicher Raum
    const wet = gain(0.5); hall.connect(wet); wet.connect(master);
    const dry = gain(0.75); dry.connect(master);
    const send = (node, amt) => { const s = gain(amt); node.connect(s); s.connect(hall); };
    const N = { master, voices: [], stops: [], timers: [], alive: true };
    // Warme Fläche: tiefe Streicher und weiches Horn
    const lp = filt('lowpass', 750, 0.7), padG = gain(0.085); lp.connect(padG); padG.connect(dry); send(padG, 0.7);
    N.stops.push(lfo(0.05, 180, lp.frequency), lfo(0.033, 0.02, padG.gain));
    [['sub', 0, 0.6], ['root', -5, 0.8], ['root', 5, 0.8], ['fifth', 0, 0.6], ['third', -3, 0.35]].forEach(([role, det, a]) => {
      const m = role === 'third' ? k.pianoChord[1] - 12 : k[role];
      const o = osc(role === 'sub' ? 'triangle' : 'sawtooth', hz(m), det), g = gain(a);
      o.connect(g); g.connect(lp); o.start(); N.voices.push({ o, role });
    });
    // Blätterrauschen im Wind
    const lv = noiseSrc(2.9), lbp = filt('bandpass', 4200, 0.6), lg = gain(0.012), lpan = pan(0);
    lv.connect(lbp); lbp.connect(lg); lg.connect(lpan); lpan.connect(dry); send(lpan, 0.3);
    N.stops.push(lv, lfo(0.07, 1200, lbp.frequency), lfo(0.023, 0.7, lpan.pan || lg.gain));
    function breeze() {
      if (!N.alive) return;
      const t = ac().currentTime + 0.05, a = 0.012 + Math.random() * 0.03, d = 2.5 + Math.random() * 4;
      lg.gain.setTargetAtTime(a, t, d / 3); lg.gain.setTargetAtTime(0.01, t + d, d / 2);
      N.timers.push(T(breeze, (d * 1.5 + Math.random() * 4) * 1000));
    }
    breeze();
    // Bach: leises Plätschern (Rauschen) und Bläschen
    const br = noiseSrc(4.4), brLp = filt('bandpass', 700, 0.8), brG = gain(0.018), brP = pan(-0.45);
    br.connect(brLp); brLp.connect(brG); brG.connect(brP); brP.connect(dry); send(brP, 0.25);
    N.stops.push(br, lfo(0.31, 220, brLp.frequency), lfo(0.53, 0.006, brG.gain));
    let nextBub = 0;
    function bubbles() {
      if (!N.alive) return;
      const now = ac().currentTime; if (!nextBub) nextBub = now + 0.1;
      while (nextBub < now + 0.25) {
        const t = nextBub, f = 380 + Math.random() * 900, o = osc('sine', f), g = gain(0), d = 0.012 + Math.random() * 0.03;
        o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.6 + Math.random()), t + d);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.012, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(brP); o.start(t); o.stop(t + d + 0.02);
        nextBub += 0.03 + Math.random() * 0.12;
      }
      N.timers.push(T(bubbles, 120));
    }
    bubbles();
    // Vögel: verschiedene Arten – Triller, Pfiffe, Rufpaare – an wechselnden Plätzen
    function chirp(t, f0, f1, d, amp, p) {
      const o = osc('sine', f0), g = gain(0), m = osc('sine', 30 + Math.random() * 40), mg = gain(f0 * 0.04);
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + d * 0.15); g.gain.setTargetAtTime(0, t + d * 0.6, d * 0.25);
      m.connect(mg); mg.connect(o.frequency);
      o.connect(g); g.connect(p); o.start(t); m.start(t); o.stop(t + d + 0.1); m.stop(t + d + 0.1);
    }
    const birdBus = gain(1); birdBus.connect(dry); send(birdBus, 0.8);
    function bird() {
      if (!N.alive) return;
      const t = ac().currentTime + 0.05, p = pan((Math.random() - 0.5) * 1.6); p.connect(birdBus);
      const dist = 0.4 + Math.random() * 0.6, amp = 0.02 * dist, kind = Math.random();
      if (kind < 0.35) {                       // Triller
        const f = 3200 + Math.random() * 2500, n = 5 + Math.floor(Math.random() * 9), sp = 0.045 + Math.random() * 0.03;
        for (let i = 0; i < n; i++) chirp(t + i * sp, f * (1 + 0.04 * Math.sin(i)), f * 1.25, sp * 0.8, amp, p);
      } else if (kind < 0.65) {                // Pfiff, fallend oder steigend
        const f = 2200 + Math.random() * 1800, up = Math.random() < 0.5;
        chirp(t, f, up ? f * 1.5 : f * 0.7, 0.25 + Math.random() * 0.25, amp * 1.1, p);
        if (Math.random() < 0.6) chirp(t + 0.45, up ? f * 1.1 : f * 0.8, up ? f * 1.6 : f * 0.6, 0.22, amp, p);
      } else if (kind < 0.85) {                // Ruf-Paar (Kuckuck-ähnlich, tief)
        const f = 900 + Math.random() * 400;
        chirp(t, f * 1.26, f * 1.2, 0.22, amp * 0.9, p); chirp(t + 0.38, f, f * 0.95, 0.3, amp * 0.9, p);
      } else {                                  // schnelles Zwitschern
        for (let i = 0; i < 4; i++) { const f = 4000 + Math.random() * 3000; chirp(t + i * 0.09 + Math.random() * 0.03, f, f * (0.7 + Math.random() * 0.6), 0.06, amp * 0.8, p); }
      }
      N.timers.push(T(bird, (2 + Math.random() * 6) * 1000));
    }
    N.timers.push(T(bird, 1800));
    // Flöte (Verzierungen): ruhige pentatonische Phrasen, gehaucht, mit verzögertem Vibrato
    function flute(t, m, d) {
      const f = hz(m), o = osc('sine', f), o2 = osc('sine', f * 2), g = gain(0), g2 = gain(0.12), vib = osc('sine', 5.2), vg = gain(0);
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + d * 0.6);
      vib.connect(vg); vg.connect(o.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.08); g.gain.setValueAtTime(0.045, t + d - 0.12); g.gain.linearRampToValueAtTime(0, t + d);
      const br = noiseSrc(Math.random() * 5), bf = filt('bandpass', f * 2, 2), bg = gain(0);
      bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.02, t + 0.03); bg.gain.setTargetAtTime(0.004, t + 0.08, 0.1); bg.gain.linearRampToValueAtTime(0, t + d);
      br.connect(bf); bf.connect(bg); bg.connect(fl);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(fl);
      [o, o2, vib].forEach(x => { x.start(t); x.stop(t + d + 0.05); }); br.stop(t + d + 0.05);
    }
    const fl = pan(0.15); fl.connect(dry); send(fl, 1.0);
    function phrase() {
      if (!N.alive) return;
      if (orn()) {
        const all = scaleMidis(74, 91), kk = keyMidiNotes(), root = kk.root % 12;
        const iv = MODES[(window.droneKeyOverride && window.droneKeyOverride.mode) || modeSel.value];
        const penta = all.filter(m => [0, iv[1], iv[2], iv[4], iv[5]].includes(((m - root) % 12 + 12) % 12));
        if (penta.length > 3) {
          let i = Math.floor(Math.random() * (penta.length - 3)), t = ac().currentTime + 0.1;
          const n = 3 + Math.floor(Math.random() * 4), bt = 60 / bpm();
          for (let j = 0; j < n; j++) {
            const d = bt * (j === n - 1 ? 2 + Math.random() * 1.5 : [0.5, 1, 1, 1.5][Math.floor(Math.random() * 4)]);
            flute(t, penta[i], d); t += d;
            i = Math.max(0, Math.min(penta.length - 1, i + [-1, 1, 1, -2, 2][Math.floor(Math.random() * 5)]));
          }
          if (Math.random() < 0.5) flute(t, penta.find(m => ((m - root) % 12 + 12) % 12 === 0) || penta[0], bt * 3);
        }
      }
      N.timers.push(T(phrase, (14 + Math.random() * 14) * 1000));
    }
    N.timers.push(T(phrase, 6000));
    const roleMidi = (kk, r) => r === 'third' ? kk.pianoChord[1] - 12 : kk[r];
    N.retune = () => { const kk = keyMidiNotes(), t = ac().currentTime; N.voices.forEach(v => v.o.frequency.setTargetAtTime(hz(roleMidi(kk, v.role)), t, 0.6)); };
    return N;
  }


  // ===================== VII Nachtbrandung – Küste & warme Fläche =====================
  // Warme, langsam atmende Fläche vorn, das Meer im Hintergrund – echt stereo: links und rechts brechen
  // die Wellen unabhängig voneinander, beim Zurücklaufen rasselt Kies. Verzierung: einzelne E-Piano-Töne mit Echo.
  function startV7() {
    ensureAudio();
    const vol = parseInt(document.getElementById('droneVolume').value) / 100, t0 = ac().currentTime, k = keyMidiNotes();
    const master = gain(0); master.connect(ensureMasterBus());
    master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(vol, t0 + 6);
    const hall = tr(ac().createConvolver()); hall.buffer = hallIR(4.8, 2.0, 0.25);
    const wet = gain(0.55); hall.connect(wet); wet.connect(master);
    const dry = gain(0.75); dry.connect(master);
    const send = (node, amt) => { const s = gain(amt); node.connect(s); s.connect(hall); };
    const N = { master, voices: [], stops: [], timers: [], alive: true };
    const third8 = kk => { const ov = window.droneKeyOverride || null, iv = MODES[ov && ov.mode ? ov.mode : modeSel.value]; return kk.root8 + (iv ? iv[2] : 4); };
    const roleM = (kk, r) => r === 'third8' ? third8(kk) : kk[r];
    // 1) Warme Fläche
    const padF = filt('lowpass', 760, 0.7), padG = gain(0.075); padF.connect(padG); padG.connect(dry); send(padG, 0.8);
    N.stops.push(lfo(0.031, 280, padF.frequency), lfo(0.047, 0.018, padG.gain));
    [['sub', 0, 0, 'sine', 0.55], ['root', -5, -0.55, 'triangle', 0.8], ['root', 5, 0.55, 'triangle', 0.8], ['fifth', -3, -0.3, 'triangle', 0.55],
     ['fifth', 4, 0.3, 'triangle', 0.55], ['third8', 0, 0.15, 'triangle', 0.22], ['root8', -9, -0.8, 'sawtooth', 0.14], ['root8', 9, 0.8, 'sawtooth', 0.14]]
      .forEach(([role, det, pn, type, a]) => {
        const o = osc(type, hz(roleM(k, role)), det), g = gain(a), pp = pan(pn);
        N.stops.push(lfo(0.11 + Math.random() * 0.08, 2.5, o.detune));
        o.connect(g); g.connect(pp); pp.connect(padF); o.start(); N.voices.push({ o, role });
      });
    // 2) Meer im Hintergrund: zwei unabhängige Brandungen (links/rechts) mit Kies beim Zurücklaufen
    const seaBus = gain(0.85); seaBus.connect(dry); send(seaBus, 0.3);
    function shore(side) {
      const src = noiseSrc(side < 0 ? 0.4 : 2.9), p = pan(side * 0.72);
      const swell = filt('lowpass', 320, 0.5), swellG = gain(0.035), brk = filt('bandpass', 1100, 0.45), brkG = gain(0), back = filt('highpass', 2600, 0.5), backG = gain(0);
      src.connect(swell); swell.connect(swellG); swellG.connect(p);
      src.connect(brk); brk.connect(brkG); brkG.connect(p);
      src.connect(back); back.connect(backG); backG.connect(p);
      const gsrc = noiseSrc(side < 0 ? 4.1 : 1.3), gbp = filt('bandpass', 4800, 1.2), am = gain(0.5), gG = gain(0), chop = osc('square', 17 + Math.random() * 9), chopG = gain(0.5);
      chop.connect(chopG); chopG.connect(am.gain); chop.start();
      gsrc.connect(gbp); gbp.connect(am); am.connect(gG); gG.connect(p);
      p.connect(seaBus); N.stops.push(src, gsrc, chop);
      function wave() {
        if (!N.alive) return;
        const t = ac().currentTime + 0.05, rise = 4 + Math.random() * 3, fall = 5 + Math.random() * 3, pk = 0.09 + Math.random() * 0.05;
        swellG.gain.setTargetAtTime(pk, t, rise / 3); swellG.gain.setTargetAtTime(0.025, t + rise, fall / 3);
        brkG.gain.setTargetAtTime(0, t, 0.2); brkG.gain.setTargetAtTime(pk * 0.42, t + rise * 0.88, 0.3); brkG.gain.setTargetAtTime(0, t + rise + 0.9, 1.3);
        backG.gain.setTargetAtTime(pk * 0.22, t + rise + 0.5, 0.7); backG.gain.setTargetAtTime(0, t + rise + 1.8, fall / 3);
        gG.gain.setTargetAtTime(pk * 0.18, t + rise + 0.9, 0.5); gG.gain.setTargetAtTime(0, t + rise + 2.6, 0.9);
        brk.frequency.setTargetAtTime(800 + Math.random() * 800, t, 1.5);
        N.timers.push(T(wave, (rise + fall) * 1000 * (0.85 + Math.random() * 0.3)));
      }
      N.timers.push(T(wave, side < 0 ? 200 : 3600 + Math.random() * 2000));
    }
    shore(-1); shore(1);
    // 3) Verzierung: E-Piano-Töne (FM) mit Ping-Pong-Echo im Tempo
    const dl = tr(ac().createDelay(2)), dr = tr(ac().createDelay(2)), fb = gain(0.38), dlp = filt('lowpass', 2600, 0.5), pl = pan(-0.7), pr = pan(0.7), echoIn = gain(1), echoOut = gain(0.55);
    const setDelay = () => { const q = 60 / bpm() * 0.75; dl.delayTime.value = Math.min(1.9, q); dr.delayTime.value = Math.min(1.9, q); };
    setDelay();
    echoIn.connect(dl); dl.connect(pl); dl.connect(dr); dr.connect(pr); dr.connect(dlp); dlp.connect(fb); fb.connect(dl);
    pl.connect(echoOut); pr.connect(echoOut); echoOut.connect(dry); send(echoOut, 0.6);
    function ep(t, m, amp) {
      const f = hz(m), car = osc('sine', f), mod = osc('sine', f * 14.0), mg = gain(0), car2 = osc('sine', f * 2.0), g = gain(0), g2 = gain(0.12), p = pan((Math.random() - 0.5) * 0.8);
      mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.006); g.gain.setTargetAtTime(0, t + 0.01, 1.4);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g); car2.connect(g2); g2.connect(g); g.connect(p); p.connect(dry); g.connect(echoIn); send(p, 0.9);
      [car, mod, car2].forEach(o => { o.start(t); o.stop(t + 6); });
    }
    function keys() {
      if (!N.alive) return;
      setDelay();
      if (orn()) {
        const notes = scaleMidis(60, 81), t = ac().currentTime + 0.05;
        if (notes.length) {
          const a = notes[Math.floor(Math.random() * notes.length)];
          ep(t, a, 0.05);
          if (Math.random() < 0.45) { const b = notes[Math.min(notes.length - 1, notes.indexOf(a) + 2)]; ep(t + 60 / bpm(), b, 0.04); }
        }
      }
      N.timers.push(T(keys, (orn() ? 3.5 + Math.random() * 5 : 9 + Math.random() * 6) * 1000));
    }
    N.timers.push(T(keys, 3000));
    N.retune = () => { const kk = keyMidiNotes(), t = ac().currentTime; N.voices.forEach(v => v.o.frequency.setTargetAtTime(hz(roleM(kk, v.role)), t, 0.6)); };
    return N;
  }

  // ===================== VIII Maschinenhalle – Stahl & Takt =====================
  // Große Stahlhalle: Netzbrummen, Turbine, singende Stahlrohre auf Grundton und Quinte, im Tempo
  // stampft eine Presse, Ventile zischen, das Förderband tickt. Ab und zu rasselt eine Kette, ein ferner Schlag hallt nach.
  function metalIR(sec) {
    const key = 'metal|' + sec;
    if (irCache[key]) return irCache[key];
    const sr = audioCtx.sampleRate, n = Math.round(sr * sec), b = audioCtx.createBuffer(2, n, sr);
    const modes = [[173, 1.6], [241, 1.9], [389, 1.3], [517, 1.7], [733, 1.1], [1013, 0.9], [1597, 0.7], [2311, 0.5]];
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, a = Math.min(0.97, 0.3 + 0.7 * t / sec);
        lp += (Math.random() * 2 - 1 - lp) * (1 - a);
        let v = lp * Math.pow(1 - i / n, 1.7);
        if (t < 0.09 && Math.random() < 0.004) v += (Math.random() - 0.5) * 1.4 * (1 - t / 0.09);   // frühe Reflexionen von Stahlwänden
        for (const [f, dcy] of modes) v += 0.018 * Math.sin(2 * Math.PI * f * (1 + c * 0.003) * t) * Math.exp(-t / dcy) * (t < 0.01 ? t / 0.01 : 1);
        d[i] = v * (t < 0.006 ? t / 0.006 : 1);
      }
    }
    let e = 0; for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i += 4) e += d[i] * d[i]; }
    const g = 0.6 / Math.sqrt(e / (n / 2) * sec * 40 + 1e-9);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= g; }
    irCache[key] = b; return b;
  }
  function mkBuf(sec, fn) {
    const sr = audioCtx.sampleRate, n = Math.round(sr * sec), b = audioCtx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let st = {}; for (let i = 0; i < n; i++) d[i] = fn(i / sr, st);
    return b;
  }
  function startV8() {
    ensureAudio();
    const vol = parseInt(document.getElementById('droneVolume').value) / 100, t0 = ac().currentTime, k = keyMidiNotes();
    const master = gain(0); master.connect(ensureMasterBus());
    master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(vol, t0 + 4);
    const hall = tr(ac().createConvolver()); hall.buffer = metalIR(3.6);
    const wet = gain(0.8); hall.connect(wet); wet.connect(master);
    const dry = gain(0.6); dry.connect(master);
    const send = (node, amt) => { const s = gain(amt); node.connect(s); s.connect(hall); };
    const N = { master, voices: [], stops: [], timers: [], alive: true };
    // 1) Netzbrummen (50 Hz mit Obertönen), leise und leicht schwankend
    const hum = gain(0.018); hum.connect(dry); send(hum, 0.2);
    [[50, 1], [100, 0.6], [150, 0.35], [250, 0.12]].forEach(([f, a]) => { const o = osc('sine', f), g = gain(a); o.connect(g); g.connect(hum); o.start(); N.stops.push(o); });
    N.stops.push(lfo(0.13, 0.006, hum.gain));
    // 2) Turbine: tiefe Säge auf dem Grundton, Tiefpass zieht langsam auf und zu; dazu ein heller Pfeifton (Oktaven über dem Grundton)
    const tf = filt('lowpass', 240, 2.5), tg = gain(0.06); tf.connect(tg); tg.connect(dry); send(tg, 0.4);
    N.stops.push(lfo(0.045, 150, tf.frequency));
    [['sub', -4], ['sub', 4], ['root', 0]].forEach(([role, det]) => { const o = osc('sawtooth', hz(k[role]), det); o.connect(tf); o.start(); N.voices.push({ o, role }); N.stops.push(lfo(0.07 + Math.random() * 0.05, 4, o.detune)); });
    const whine = osc('sine', hz(k.root8 + 24)), wg = gain(0.006), wp = pan(0.3); whine.connect(wg); wg.connect(wp); wp.connect(dry); send(wp, 0.8); whine.start();
    N.voices.push({ o: whine, role: 'w24' }); N.stops.push(lfo(0.09, 9, whine.detune), lfo(0.031, 0.005, wg.gain));
    // 3) Singende Stahlrohre: gefiltertes Rauschen auf Grundton, Quinte und Oktave, schwillt langsam
    const pipes = [];
    [['root8', -0.6, 0.9], ['fifth', 0.5, 0.7], ['root8', 0.1, 0.5, 12]].forEach(([role, pn, a, up]) => {
      const src = noiseSrc(Math.random() * 5), bp = filt('bandpass', hz(k[role] + (up || 0)), 60), g = gain(0), p = pan(pn);
      src.connect(bp); bp.connect(g); g.connect(p); p.connect(dry); send(p, 1.2);
      N.stops.push(src, lfo(0.021 + Math.random() * 0.02, 0.5 * a, g.gain));
      g.gain.setValueAtTime(0.55 * a, t0);
      pipes.push({ bp, role, up: up || 0 });
    });
    // 4) Klänge für den Maschinentakt einmal vorberechnen (spart Rechenzeit auf dem iPad)
    const R = Math.random;
    const metalF = hz(k.root8 + 12);
    const clank = mkBuf(1.4, (t, s) => { let v = 0; [[1, 0.5, 0.9], [1.47, 0.35, 0.6], [2.09, 0.25, 0.45], [2.83, 0.18, 0.35], [3.98, 0.1, 0.25]].forEach(([m, a, d]) => { v += a * Math.sin(2 * Math.PI * metalF * m * t) * Math.exp(-t / d); }); s.n = (s.n || 0) * 0.6 + (R() * 2 - 1) * 0.4; return (v * 0.6 + s.n * Math.exp(-t / 0.012) * 0.8) * (t < 0.0015 ? t / 0.0015 : 1); });
    const thud = mkBuf(0.6, (t, s) => { s.ph = (s.ph || 0) + 2 * Math.PI * (38 + 70 * Math.exp(-t / 0.04)) / audioCtx.sampleRate; return Math.sin(s.ph) * Math.exp(-t / 0.18) * (t < 0.002 ? t / 0.002 : 1) + (R() * 2 - 1) * Math.exp(-t / 0.006) * 0.3; });
    const valve = mkBuf(0.45, (t, s) => { const w = R() * 2 - 1; s.h = 0.85 * ((s.h || 0) + w - (s.w || 0)); s.w = w; return s.h * (t < 0.008 ? t / 0.008 : Math.exp(-(t - 0.008) / 0.12)) * 0.5; });
    const tick = mkBuf(0.08, (t) => (Math.sin(2 * Math.PI * 3150 * t) * 0.6 + Math.sin(2 * Math.PI * 5210 * t) * 0.4) * Math.exp(-t / 0.012));
    const link = mkBuf(0.07, (t) => (Math.sin(2 * Math.PI * 2440 * t) * 0.5 + Math.sin(2 * Math.PI * 4390 * t) * 0.35 + (R() * 2 - 1) * 0.3) * Math.exp(-t / 0.01));
    function play(buf, t, amp, pn, wetAmt, rate) {
      const s = tr(ac().createBufferSource()); s.buffer = buf; if (rate) s.playbackRate.value = rate;
      const g = gain(amp), p = pan(pn); s.connect(g); g.connect(p); p.connect(dry); send(p, wetAmt); s.start(t);
    }
    // 5) Maschinentakt im Tempo des Loops: Presse auf der Eins, Ventile auf 2 und 4, Förderband in Achteln
    let nextBar = 0;
    function machine() {
      if (!N.alive) return;
      const now = ac().currentTime, bd = 240 / bpm(), bt = bd / 4;
      if (!nextBar || nextBar < now - 1) nextBar = typeof Rhythm !== 'undefined' ? Rhythm.nextBarTime() : now + 0.2;
      while (nextBar < now + 0.35) {
        const t = nextBar, full = orn();
        play(thud, t, 0.5, 0, 0.5); play(clank, t + 0.004, 0.16, -0.2, 1.1, 1 + (R() - 0.5) * 0.01);
        if (full) {
          play(valve, t + bt, 0.22, -0.5, 0.6); play(valve, t + 3 * bt, 0.22, 0.5, 0.6);
          for (let i = 0; i < 8; i++) play(tick, t + i * bt / 2, i % 2 ? 0.035 : 0.06, 0.6, 0.4, 1 + (R() - 0.5) * 0.04);
          if (R() < 0.35) play(clank, t + 2 * bt + 0.01, 0.08, 0.45, 1.2, 0.84);
        } else play(tick, t + 2 * bt, 0.05, 0.5, 0.5);
        nextBar += bd;
      }
      N.timers.push(T(machine, 120));
    }
    N.timers.push(T(machine, 400));
    // 6) Ereignisse: Kette, ferner Schlag, Dampfstoß
    function events() {
      if (!N.alive) return;
      const t = ac().currentTime + 0.05, r = R();
      if (r < 0.4) { let tt = t; const pn = (R() - 0.5) * 1.6, n = 10 + Math.floor(R() * 14); for (let i = 0; i < n; i++) { play(link, tt, 0.05 + R() * 0.05, pn + (R() - 0.5) * 0.2, 1, 0.8 + R() * 0.5); tt += 0.03 + R() * 0.05; } }
      else if (r < 0.7) { play(thud, t, 0.35, (R() - 0.5) * 1.4, 2.2, 0.8); play(clank, t + 0.01, 0.12, (R() - 0.5) * 1.4, 2.5, 0.62 + R() * 0.2); }
      else { const src = noiseSrc(R() * 5), hp = filt('highpass', 1800, 0.7), g = gain(0), p = pan((R() - 0.5) * 1.6), d = 1.4 + R() * 1.6;
        hp.frequency.setValueAtTime(1200, t); hp.frequency.linearRampToValueAtTime(3800, t + d);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.08); g.gain.setTargetAtTime(0, t + d * 0.6, d / 4);
        src.connect(hp); hp.connect(g); g.connect(p); p.connect(dry); send(p, 1.3); src.stop(t + d + 1.2); }
      N.timers.push(T(events, (orn() ? 5 + R() * 8 : 12 + R() * 10) * 1000));
    }
    N.timers.push(T(events, 2500));
    N.retune = () => {
      const kk = keyMidiNotes(), t = ac().currentTime;
      N.voices.forEach(v => v.o.frequency.setTargetAtTime(v.role === 'w24' ? hz(kk.root8 + 24) : hz(kk[v.role]), t, 0.8));
      pipes.forEach(pp => pp.bp.frequency.setTargetAtTime(hz(kk[pp.role] + pp.up), t, 0.8));
    };
    return N;
  }

  const NAMES = { v3: 'Nordmeer – Wikinger', v4: 'Nordlicht – Eis & Glas', v5: 'Elbenküste – Meer & Chor', v6: 'Waldesruh – Elbenwald', v7: 'Nachtbrandung – Küste & Fläche', v8: 'Maschinenhalle – Stahl & Takt' };
  const STARTS = { v3: () => startV3(), v4: () => startV4(), v5: () => startV5(), v6: () => startV6(), v7: () => startV7(), v8: () => startV8() };
  let cur = null;
  function start(style) {
    if (cur) stop(true);
    const prevV = vNodes; vNodes = [];
    try { cur = (STARTS[style] || STARTS.v4)(); } finally { if (cur) cur.all = vNodes; vNodes = prevV; }
    cur.style = style;
    droneNodes = cur; droneOn = true;
    btnOn(true);
    setStatus('An — ' + droneKeyText() + ' (' + NAMES[style] + ')');
  }
  function stop(quiet) {
    const N = cur; if (!N) return;
    cur = null; N.alive = false;
    N.timers.forEach(clearTimeout);
    const t = ac().currentTime;
    N.master.gain.cancelScheduledValues(t); N.master.gain.setValueAtTime(N.master.gain.value, t); N.master.gain.linearRampToValueAtTime(0, t + 1.2);
    setTimeout(() => { N.voices.forEach(v => { try { v.o.stop(); } catch (e) {} }); N.stops.forEach(o => { try { o.stop(); } catch (e) {} }); try { N.master.disconnect(); } catch (e) {} (N.all || []).forEach(n => { try { n.disconnect(); } catch (e) {} }); }, 1400);
    if (!quiet) { droneNodes = null; droneOn = false; btnOn(false); setStatus('Aus'); }
  }
  function retune() { if (cur && cur.retune) { cur.retune(); setStatus('An — ' + droneKeyText() + ' (' + NAMES[cur.style] + ')'); } }
  return { start, stop, retune, has: st => !!STARTS[st] };
})();
