/* ---------- Looper: 3 synchrone Spuren mit Taktkreisen ---------- */
const Looper = (() => {
  const $ = id => document.getElementById(id);
  const statusEl = $('loopStatus'), infoEl = $('loopInfo'), meterEl = $('loopMeter'), meterR = $('loopMeterR'), threshMark = $('loopThreshMark'), allBtn = $('loopAll');
  const snapEl = $('loopSnap'), countInEl = $('loopCountIn'), latEl = $('loopLatency'), latVal = $('loopLatencyVal');
  const barsEl = $('loopBars'), trigEl = $('loopTrigger'), threshEl = $('loopThresh');

  let sr = 48000;
  let micReady = false, tapNode = null, sinkNode = null, micSource = null, stream = null;
  let baseL = 0;       // Länge des ersten Loops (Frames) – alle Spuren sind Vielfache davon
  let anchor = 0;      // Frame, an dem Phase 0 aller Spuren liegt
  let rec = null;      // {t, kind: first|new|overdub, start, end, chunks, n, layer, armed, Lt}
  let hist = [];       // die letzten Mikrofon-Blöcke, für den Vorlauf beim Signal-Start
  let level = 0, levelL = 0, levelR = 0, rafId = null, peakHold = 0;
  let cap = null;      // Mitschnitt rund um die erste Aufnahme (für das Eintakten)

  function loadPref(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function savePref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  latEl.value = loadPref('3nps-latency', '');
  snapEl.checked = loadPref('3nps-snap', '1') === '1';
  { const v = loadPref('3nps-countin', '1'); countInEl.value = ['0', '1', '2', '4', '8'].includes(v) ? v : '1'; }
  const countPlayEl = $('loopCountInPlay');
  countPlayEl.checked = loadPref('3nps-countin-play', '1') === '1';
  barsEl.value = loadPref('3nps-bars', 'free');
  trigEl.checked = loadPref('3nps-trigger', '0') === '1';
  threshEl.value = loadPref('3nps-thresh', '55');

  const latencyFrames = () => Math.round(parseInt(latEl.value || '0') / 1000 * sr);
  const autoAlignEl = $('loopAutoAlign');
  autoAlignEl.checked = loadPref('3nps-autoalign', '1') === '1';
  autoAlignEl.addEventListener('change', () => savePref('3nps-autoalign', autoAlignEl.checked ? '1' : '0'));
  // Hörbare Position für die Anzeige: der Abtastwert, der gerade aus dem Lautsprecher kommt (Ausgabelatenz herausgerechnet)
  function playFrame() {
    if (!audioCtx) return 0;
    try {
      if (audioCtx.getOutputTimestamp && audioCtx.state === 'running') {
        const ts = audioCtx.getOutputTimestamp();
        if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
          const t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
          if (t <= audioCtx.currentTime + 0.05 && t > audioCtx.currentTime - 0.5) return Math.round(t * sr);
        }
      }
    } catch (e) {}
    return Math.round((audioCtx.currentTime - (audioCtx.outputLatency || 0)) * sr);
  }
  const bpm = () => parseFloat($('bpm').value) || 80;
  const barFrames = () => Math.round(4 * 60 / bpm() * sr);
  const beatFrames = () => 60 / bpm() * sr;
  const nowFrame = () => Math.round(audioCtx.currentTime * sr);
  const mod = (a, n) => ((a % n) + n) % n;
  // Taktlänge passend zur Loop-Länge (vermeidet Rundungsfehler bei krummen Tempi)
  function barOf(L) {
    const bf = barFrames();
    if (!L) return bf;
    const n = Math.round(L / bf);
    return n >= 1 && Math.abs(L / bf - n) < 0.02 ? L / n : bf;
  }
  const selectedBars = () => barsEl.value === 'free' ? 0 : parseInt(barsEl.value);
  const threshold = () => 0.3 * Math.pow(10, -parseInt(threshEl.value) / 33);   // 0 = unempfindlich, 100 = sehr empfindlich
  const toMeter = v => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(v, 1e-6)) + 60) / 60));
  function setStatus(t) { statusEl.textContent = t; }

  const tracks = [0, 1, 2].map(i => ({
    i, layers: [], L: 0, mix: null, src: null, gain: null, state: 'empty', peaks: null, hist: [], key: null, orig: null,
    chB: $('chb' + i), meter: $('tmeter' + i), mL: $('tmeter' + i).querySelector('.tm-ch.l'), mR: $('tmeter' + i).querySelector('.tm-ch.r'), pkL: 0, pkR: 0,
    ring: $('ring' + i), wave: $('wave' + i), foot: $('foot' + i), stopB: $('stop' + i), undoB: $('undo' + i),
    clearB: $('clear' + i), fileIn: $('file' + i), vol: $('vol' + i), editB: $('edit' + i), keyB: $('key' + i),
    ing: $('ing' + i), ingV: $('ingv' + i), volV: $('volv' + i), inGain: 1, chords: null, thC: $('thc' + i), chdB: $('chd' + i), chnB: $('chn' + i), chdName: null
  }));
  // ---- Stereo: jedes Audio-Stück ist { l, r, length } (bei Mono-Quellen zeigen l und r auf dasselbe Feld) ----
  const S = n => ({ l: new Float32Array(n), r: new Float32Array(n), length: n });
  const SP = (l, r) => ({ l, r: r || l, length: l.length });
  const smap = (x, fn) => { const a = fn(x.l, 0); return SP(a, x.r === x.l ? a : fn(x.r, 1)); };
  function monoOf(x) {
    if (!x) return null;
    if (x._m) return x._m;
    if (x.r === x.l) return (x._m = x.l);
    const m = new Float32Array(x.length), a = x.l, b = x.r;
    for (let i = 0; i < m.length; i++) m[i] = (a[i] + b[i]) * 0.5;
    if (x.length <= sr * 30) x._m = m;                 // lange Loops nicht doppelt im Speicher halten
    return m;
  }
  const chans = x => x.r === x.l ? [x.l] : [x.l, x.r];
  // Links und rechts gleich (Mono-Quelle, z. B. der iPad-Eingang) → nur einmal speichern
  const monoIfSame = x => (x && x.r !== x.l && sameData(x)) ? SP(x.l) : x;
  const anyRunning = () => tracks.some(t => t.src);
  const anyContent = () => tracks.some(t => t.L);

  // ---- 7-Band-EQ je Spur (aufklappbar unter den Reglern) ----
  tracks.forEach(t => {
    let v = null; try { v = JSON.parse(loadPref('3nps-eq' + t.i, 'null')); } catch (e) {}
    t.eqVals = EQ7.norm(v); t.eq = null;
    const btn = $('eqb' + t.i), panel = $('eqp' + t.i);
    t.eqBtn = btn;
    t.eqUi = EQ7.widget(panel, { vals: t.eqVals, presets: EQ7.PRESETS_TRACK, onChange: vals => setTrackEq(t, vals, true) });
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); btn.classList.toggle('open', !panel.hidden); if (!panel.hidden) t.eqUi.draw(); });
    showEqBtn(t);
  });
  function showEqBtn(t) { const on = !EQ7.isFlat(t.eqVals); t.eqBtn.classList.toggle('on', on); t.eqBtn.textContent = on ? 'EQ ●' : 'EQ'; }
  function ensureTrackEq(t) {
    if (t.eq) return t.eq;
    t.eq = EQ7.chain(audioCtx); t.eq.output.connect(ensureMasterBus()); t.eq.set(t.eqVals);
    return t.eq;
  }
  function setTrackEq(t, vals, fromUi) {
    t.eqVals = EQ7.norm(vals);
    if (t.eq) t.eq.set(t.eqVals, true);
    if (!fromUi) t.eqUi.set(t.eqVals);
    savePref('3nps-eq' + t.i, JSON.stringify(t.eqVals)); showEqBtn(t); markDirty();
  }

  // ---- Drums: gemeinsames Schlagzeug (rhythm.js) läuft im Raster des Loops ----
  const drumsOnF = () => Rhythm.on();
  Rhythm.setGrid(() => (baseL && anyRunning()) ? { anchor: anchor / sr, cycle: baseL / sr } : null);
  const barDur = () => 240 / bpm();
  function nextBarFrame() { return Math.round(Rhythm.nextBarTime() * sr); }
  const flashBtn = $('loopFlash');
  // Blitz: aus, bei jedem Takt oder bei jedem Schlag
  const FLASH_LABEL = { off: 'Blitz: aus', bar: 'Blitz: jeder Takt', beat: 'Blitz: jeder Schlag' };
  let flashMode = { '1': 'bar', '0': 'off' }[loadPref('3nps-flash', 'bar')] || loadPref('3nps-flash', 'bar');
  if (!FLASH_LABEL[flashMode]) flashMode = 'bar';
  function showFlash() { flashBtn.classList.toggle('active', flashMode !== 'off'); flashBtn.textContent = FLASH_LABEL[flashMode]; }
  flashBtn.addEventListener('click', () => {
    flashMode = flashMode === 'off' ? 'bar' : flashMode === 'bar' ? 'beat' : 'off';
    savePref('3nps-flash', flashMode); showFlash();
  });
  showFlash();

  // ---- Drone als eigene Spur (nutzt die Drone-Klänge des Programms) ----
  const dBtn = $('laneDrone'), dRoot = $('laneDroneRoot'), dMode = $('laneDroneMode'), dStyleSel = $('laneDroneStyle'),
    dVol = $('laneDroneVol'), dSync = $('laneDroneSync'), dStat = $('laneDroneStatus');
  const mainDroneBtn = $('droneBtn'), mainDroneStyle = $('droneStyle'), mainDroneVol = $('droneVolume');
  dRoot.value = loadPref('3nps-ldrone-root', '');
  dMode.value = loadPref('3nps-ldrone-mode', '');
  dSync.checked = loadPref('3nps-ldrone-sync', '0') === '1';
  dStyleSel.value = mainDroneStyle.value; dVol.value = mainDroneVol.value;
  let droneBusy = 0;
  function syncDrone() {
    dBtn.classList.toggle('active', droneOn);
    dBtn.textContent = droneOn ? 'Drone an' : 'Drone aus';
    dStyleSel.value = mainDroneStyle.value; dVol.value = mainDroneVol.value;
    dStat.textContent = (droneOn ? 'Läuft · ' : 'Aus · ') + droneKeyText() + ' · ' + dStyleSel.selectedOptions[0].text;
    $('panel-looper').classList.toggle('drone-live', droneOn);
  }
  function applyDroneKey() {
    window.droneKeyOverride = (dRoot.value || dMode.value) ? { root: dRoot.value || null, mode: dMode.value || null } : null;
    savePref('3nps-ldrone-root', dRoot.value); savePref('3nps-ldrone-mode', dMode.value);
    if (droneOn) updateDroneFreq();
    syncDrone();
  }
  function setDrone(on) {
    if (on === droneOn) return;
    ensureAudio();
    if (on) startDrone(); else stopDrone();
    syncDrone(); kick();
  }
  dBtn.addEventListener('click', () => {
    const t = performance.now();
    if (t - droneBusy < 350) return;          // versehentlichen Doppeltipp abfangen
    droneBusy = t; setDrone(!droneOn);
  });
  dRoot.addEventListener('change', applyDroneKey);
  dMode.addEventListener('change', applyDroneKey);
  dStyleSel.addEventListener('change', () => { mainDroneStyle.value = dStyleSel.value; mainDroneStyle.dispatchEvent(new Event('change')); syncDrone(); });
  dVol.addEventListener('input', () => { mainDroneVol.value = dVol.value; mainDroneVol.dispatchEvent(new Event('input')); });
  dSync.addEventListener('change', () => savePref('3nps-ldrone-sync', dSync.checked ? '1' : '0'));
  $('laneDroneFromTrack').addEventListener('click', () => {
    const t = tracks.find(x => x.key);
    if (!t) { setStatus('Noch keine Tonart erkannt. Tippe in einer Spur auf ✂ → Tonart bestimmen.'); return; }
    dRoot.value = NOTES[t.key.pc]; dMode.value = t.key.major ? 'Ionisch (Dur)' : 'Äolisch (Moll)';
    applyDroneKey();
    setStatus('Drone folgt jetzt der Tonart von Spur ' + (t.i + 1) + ': ' + Analyzer.label(t.key) + '.');
  });
  new MutationObserver(syncDrone).observe(mainDroneBtn, { attributes: true, childList: true });
  mainDroneVol.addEventListener('input', () => { dVol.value = mainDroneVol.value; });
  mainDroneStyle.addEventListener('change', () => { dStyleSel.value = mainDroneStyle.value; syncDrone(); });
  const ornL = $('laneDroneOrn'), ornM = $('pianoShimmer');
  ornL.checked = ornM.checked;
  ornL.addEventListener('change', () => { ornM.checked = ornL.checked; });
  ornM.addEventListener('change', () => { ornL.checked = ornM.checked; });
  $('root').addEventListener('change', syncDrone); $('mode').addEventListener('change', syncDrone);
  function droneFollow(start) { if (dSync.checked) setDrone(start); }
  applyDroneKey();

  // ---- Leistung: „sparsam“ entlastet das iPad (z. B. beim Laden, wenn es warm wird) ----
  const perfEl = $('perfMode');
  perfEl.value = loadPref('3nps-perf', 'auto');
  if (!['auto', 'high', 'lite'].includes(perfEl.value)) perfEl.value = 'auto';
  window.__lite = perfEl.value === 'lite';
  let autoLite = false;
  function applyLite(v, why) {
    window.__lite = v;
    if (typeof Rhythm !== 'undefined') Rhythm.setLite(v);
    document.documentElement.classList.toggle('lite', v);
    $('perfInfo').textContent = v ? 'Sparsam aktiv' + (why ? ' – ' + why : '') + '. Ruhigere Anzeige; der größere Audio-Puffer greift nach dem nächsten Start der App. Der Klang bleibt gleich.'
      : 'Sparsam: ruhigere Anzeige und größerer Audio-Puffer (nach einem Neustart der App) – der Klang bleibt gleich, nur die Verzögerung wird etwas größer.';
    kick();
  }
  perfEl.addEventListener('change', () => { savePref('3nps-perf', perfEl.value); autoLite = false; applyLite(perfEl.value === 'lite'); });
  // Ruckel-Erkennung: viele lange Pausen zwischen den Bildern → automatisch sparsam
  const jank = { last: 0, n: 0, bad: 0, t0: 0 };
  function watchJank(nowMs) {
    if (perfEl.value !== 'auto' || window.__lite) { jank.last = nowMs; jank.t0 = nowMs; jank.n = jank.bad = 0; return; }
    const dt = nowMs - jank.last; jank.last = nowMs;
    if (dt > 400) { jank.t0 = nowMs; jank.n = jank.bad = 0; return; }       // Pause/Tabwechsel nicht zählen
    jank.n++; if (dt > 70) jank.bad++;
    if (nowMs - jank.t0 >= 4000) {
      if (jank.n >= 20 && jank.bad / jank.n >= 0.2) { autoLite = true; applyLite(true, 'automatisch eingeschaltet, weil die Anzeige ruckelte'); setStatus('Das iPad ist gerade ausgelastet – die App läuft jetzt im Sparmodus (Einstellung „Leistung“).'); }
      jank.n = 0; jank.bad = 0; jank.t0 = nowMs;
    }
  }
  setTimeout(() => applyLite(window.__lite), 0);

  // ---- Mikrofon ----
  const monBtn = $('loopMonitor');
  monBtn.addEventListener('click', async () => {
    if (micReady) { setStatus('Der Eingang ist offen. Die Pegelanzeigen neben den Spuren zeigen dein Signal.'); return; }
    if (await ensureMic()) setStatus('Eingang offen: Die Pegelanzeigen neben den Spuren zeigen jetzt dein Signal.');
  });
  async function ensureMic() {
    ensureAudio();
    sr = audioCtx.sampleRate;
    if (micReady) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Dieses Gerät erlaubt hier keine Aufnahme. Öffne die App über das Icon auf dem Home-Bildschirm.');
      return false;
    }
    try {
      if (navigator.audioSession) { try { navigator.audioSession.type = 'play-and-record'; } catch (e) {} }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: audioCtx.sampleRate } } });
    } catch (e) {
      setStatus('Kein Zugriff aufs Mikrofon. Erlaube ihn in den iPad-Einstellungen unter Datenschutz → Mikrofon bzw. für die Website in Safari.');
      return false;
    }
    stream.getAudioTracks().forEach(tr => tr.addEventListener('ended', () => micLost()));
    micSource = audioCtx.createMediaStreamSource(stream);
    sinkNode = audioCtx.createGain(); sinkNode.gain.value = 0;
    let workletOk = false;
    if (audioCtx.audioWorklet && window.AudioWorkletNode) {
      try {
        const code = `class Tap extends AudioWorkletProcessor{constructor(){super();this.a=new Float32Array(2048);this.b=new Float32Array(2048);this.n=0;this.s=0;}
          flush(){this.port.postMessage({f:this.s,l:this.a.slice(0,this.n),r:this.b.slice(0,this.n)});this.n=0;}
          process(inp){const c=inp[0]&&inp[0][0];if(!c){if(this.n)this.flush();return true;}const d=inp[0][1]||c;
          if(this.n===0)this.s=currentFrame;this.a.set(c,this.n);this.b.set(d,this.n);this.n+=c.length;
          if(this.n+c.length>this.a.length)this.flush();return true;}}
          registerProcessor('tap',Tap);`;
        const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
        await audioCtx.audioWorklet.addModule(url);
        tapNode = new AudioWorkletNode(audioCtx, 'tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit', outputChannelCount: [1] });
        tapNode.port.onmessage = e => handleChunk(e.data.f, SP(e.data.l, e.data.r));
        workletOk = true;
      } catch (e) { workletOk = false; }
    }
    if (!workletOk) {
      // Ausweichweg, falls das Aufnahme-Modul nicht lädt
      tapNode = audioCtx.createScriptProcessor(2048, 2, 1);
      tapNode.onaudioprocess = e => { const ib = e.inputBuffer; handleChunk(Math.round(e.playbackTime * sr) - 2048, SP(new Float32Array(ib.getChannelData(0)), new Float32Array(ib.getChannelData(ib.numberOfChannels > 1 ? 1 : 0)))); };
    }
    micSource.connect(tapNode); tapNode.connect(sinkNode); sinkNode.connect(audioCtx.destination);
    if (latEl.value === '') {
      const est = ((audioCtx.baseLatency || 0) + (audioCtx.outputLatency || 0)) * 1000 + 15;
      latEl.value = Math.min(250, Math.max(10, Math.round(est / 5) * 5));
      savePref('3nps-latency', latEl.value);
    }
    latVal.textContent = latEl.value + ' ms';
    micReady = true;
    try { const st = stream.getAudioTracks()[0].getSettings(); inChans = st.channelCount || 0; } catch (e) { inChans = 0; }
    showInChans();
    $('panel-looper').classList.add('mic-on');
    monBtn.classList.add('active'); monBtn.textContent = 'Eingang offen';
    kick();
    return true;
  }

  // iPadOS beendet das Mikrofon z. B. beim Sperren oder App-Wechsel – dann beim nächsten Bedarf neu öffnen
  function micLost(reason) {
    if (!micReady) return;
    micReady = false;
    try { micSource && micSource.disconnect(); tapNode && tapNode.disconnect(); } catch (e) {}
    try { stream && stream.getTracks().forEach(tr => tr.stop()); } catch (e) {}
    micSource = null; tapNode = null; stream = null; stereoSeen = false; showInChans();
    $('panel-looper').classList.remove('mic-on');
    monBtn.classList.remove('active'); monBtn.textContent = 'Eingang öffnen';
    if (rec) cancelRec();
    if (reason === 'device') return;
    setStatus('Der Eingang wurde unterbrochen (z. B. Sperren, Ladekabel, USB-Gerät). Ich öffne ihn neu …');
    // Gleich wieder öffnen (ohne Nachfrage, solange die Erlaubnis gilt); sonst beim nächsten Tippen
    setTimeout(reopenMic, 900);
  }
  const reopenLog = [];
  async function reopenMic() {
    if (micReady || document.hidden) return;
    const now = Date.now(); while (reopenLog.length && now - reopenLog[0] > 30000) reopenLog.shift();
    if (reopenLog.length >= 3) { setStatus('Das Audio-Gerät verbindet sich immer wieder neu. Prüfe Adapter/Kabel, dann „Eingang öffnen“.'); return; }
    reopenLog.push(now);
    try { if (await ensureMic()) { setStatus('Eingang wieder offen – das Audio-Gerät wurde neu verbunden.'); return; } } catch (e) {}
    setStatus('Eingang geschlossen. Tippe auf „Eingang öffnen“ oder REC, um weiterzumachen.');
  }
  // USB-Audio-Gerät oder Ladegerät an-/abgesteckt: Mikrofon neu verbinden, Ton fortsetzen
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      setTimeout(() => {
        if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
        if (micReady && stream && stream.getAudioTracks().some(tr => tr.readyState === 'ended' || tr.muted)) { micLost('device'); setTimeout(reopenMic, 600); }
      }, 500);
    });
  }
  // Ton vom iPad unterbrochen (Audio-Weg gewechselt): sofort wieder starten, notfalls beim nächsten Tippen
  let ctxHooked = false, needResume = false;
  function hookCtx() {
    if (ctxHooked || !audioCtx) return; ctxHooked = true;
    audioCtx.addEventListener('statechange', () => {
      if (audioCtx.state === 'running') { if (needResume) { needResume = false; setStatus('Ton läuft wieder.'); } return; }
      if (document.hidden) return;
      audioCtx.resume().then(() => {}).catch(() => {});
      setTimeout(() => { if (audioCtx.state !== 'running') { needResume = true; setStatus('Der Ton wurde vom iPad unterbrochen (z. B. Ladekabel/USB-Gerät). Tippe einmal auf den Bildschirm, um weiterzumachen.'); } }, 400);
    });
  }
  setInterval(hookCtx, 1000);
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {}); }, true));
  let wasMic = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { wasMic = micReady; return; }
    if (!audioCtx) return;
    if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
    if (micReady && stream && stream.getAudioTracks().every(tr => tr.readyState === 'ended')) micLost();
    else if (!micReady && wasMic) reopenMic();
  });

  // Eingang: Stereo erkennen (unterschiedliche Kanäle) und anzeigen
  let inChans = 0, stereoSeen = false;
  function showInChans() {
    const el = $('inChanInfo'); if (!el) return;
    el.textContent = !micReady ? '' : stereoSeen ? '· Stereo L/R' : inChans >= 2 ? '· mono (beide Kanäle gleich)' : '· mono (Grenze von iPadOS)';
    el.classList.toggle('mono', micReady && !stereoSeen);
    el.title = micReady && !stereoSeen && inChans < 2 ? 'Safari und Web-Apps bekommen auf dem iPad nur einen Eingangskanal. Für echte Stereo-Aufnahmen in einer anderen App aufnehmen und die Datei hier laden.' : '';
    const box = $('loopMeterBox'); if (box) box.classList.toggle('st', micReady && stereoSeen);
  }
  function handleChunk(startFrame, data) {
    let pk = 0, pkR = 0; const L = data.l, R = data.r;
    for (let i = 0; i < L.length; i++) { const a = L[i] < 0 ? -L[i] : L[i]; if (a > pk) pk = a; }
    const pkL = pk;
    if (R !== L) {
      let df = 0;
      for (let i = 0; i < R.length; i++) { const a = R[i] < 0 ? -R[i] : R[i]; if (a > pkR) pkR = a; df += Math.abs(L[i] - R[i]); }
      if (pkR > pk) pk = pkR;
      if (!stereoSeen && df / R.length > 1e-4) { stereoSeen = true; showInChans(); }
    } else pkR = pkL;
    level = Math.max(level * 0.85, pk);
    levelL = Math.max(levelL * 0.85, pkL); levelR = Math.max(levelR * 0.85, pkR);
    const m0 = startFrame - latencyFrames();
    if (cap) {
      cap.list.push({ m0, data });
      if (rec && rec.t === cap.t && rec.armed) while (cap.list.length > 2 && cap.list[0].m0 < m0 - sr) cap.list.shift();
      if (cap.until && m0 + data.length >= cap.until) { const c = cap; cap = null; c.onDone(c); }
    }
    hist.push({ m0, data });
    while (hist.length > 1 && hist[0].m0 < m0 - sr * 0.5) hist.shift();
    if (!rec) { kick(); return; }
    if (rec.armed) {
      const thr = threshold() / rec.t.inGain;
      for (let i = 0; i < data.length; i++) {
        if (Math.abs(L[i]) > thr || Math.abs(R[i]) > thr) { trigger(m0 + i); return; }
      }
      kick(); return;
    }
    consume(m0, data);
  }

  function consume(m0, data) {
    if (!rec || rec.armed) return;
    const from = Math.max(0, rec.start - m0);
    let to = data.length, done = false;
    if (rec.end !== null && m0 + to >= rec.end) { to = Math.max(from, rec.end - m0); done = true; }
    if (to > from) {
      const g = rec.t.inGain;
      {
        const c = S(to - from);
        for (let i = from; i < to; i++) { c.l[i - from] = data.l[i] * g; c.r[i - from] = data.r[i] * g; }
        rec.chunks.push(c); rec.n += to - from;
      }
    }
    if (done) finishRec();
    else kick();
  }

  // Aufnahme startet mit dem ersten Ton über dem Schwellwert (mit 20 ms Vorlauf)
  function trigger(mt) {
    rec.armed = false;
    rec.start = mt - Math.round(0.02 * sr);
    applyAutoEnd();
    setStatus('Signal erkannt – Aufnahme läuft.' + (rec.end === null ? ' Tippe zum Beenden.' : ''));
    const h = hist; hist = [];
    for (const c of h) consume(c.m0, c.data);
    update();
  }

  function joinChunks(chunks, n) {
    const out = S(n); let o = 0;
    for (const c of chunks) { const k = Math.min(c.length, n - o); out.l.set(c.l.subarray(0, k), o); out.r.set(c.r.subarray(0, k), o); o += c.length; if (o >= n) break; }
    return out;
  }

  // ---- Spuren abspielen ----
  // ---- Automatische Sicherung der laufenden Sitzung (nach Absturz oder Neuladen wiederherstellbar) ----
  const AUTO_MAX_MB = 150;
  let autoTimer = null, autoBusy = false, autoReady = false;
  function markDirty() { if (!autoReady) return; clearTimeout(autoTimer); autoTimer = setTimeout(doAutosave, 2500); }
  async function doAutosave() {
    if (typeof AppDB === 'undefined') return;
    if (rec || autoBusy || ed.drag) { markDirty(); return; }
    try {
      autoBusy = true;
      if (!anyContent()) { await AppDB.del('meta', 'autosave'); return; }
      const est = tracks.reduce((a, t) => a + (t.L && t.mix ? t.L * (t.mix.r === t.mix.l ? 1 : 2) * 3 : 0), 0) / 1048576;
      if (est > AUTO_MAX_MB) { if (!doAutosave.told) { doAutosave.told = true; setStatus('Hinweis: Die Spuren sind sehr lang – die automatische Sicherung pausiert. Speichere wichtige Loops unter „Ideen“.'); } return; }
      const sess = getSession();
      const ds = Rhythm.getState(); ds.on = false;
      await AppDB.put('meta', { key: 'autosave', ts: Date.now(), session: sess, drumState: ds, droneState: Object.assign(getDroneState(), { on: false }),
        bpm: bpm(), root: rootSel.value, mode: modeSel.value });
    } catch (e) {} finally { autoBusy = false; }
  }
  function rebuildMix(t) {
    markDirty();
    if (t.layers.length === 1 && t.layers[0].length === t.L) { t.mix = t.layers[0]; t.mix._m = null; }
    else {
      const m = S(t.L);
      t.layers.forEach(ly => { const a = ly.l, b = ly.r; for (let i = 0; i < t.L; i++) { m.l[i] += a[i]; m.r[i] += b[i]; } });
      t.mix = m;
    }
    t.peaks = null;
    if (autoReady || t.hist.length) setTimeout(trimHistory, 0);     // nach der Änderung: Verlauf im Speicherbudget halten
  }
  function startTrack(t) {
    stopSrc(t);
    if (!t.L) return;
    if (!t.buf || t.bufFor !== t.mix || t.buf.length !== t.L) {
      const mono = t.mix.r === t.mix.l;
      t.buf = null; t.bufFor = null;
      const buf = audioCtx.createBuffer(mono ? 1 : 2, t.L, sr);
      buf.copyToChannel(t.mix.l, 0); if (!mono) buf.copyToChannel(t.mix.r, 1);
      t.buf = buf; t.bufFor = t.mix;
    }
    const s = audioCtx.createBufferSource();
    s.buffer = t.buf; s.loop = true;
    t.gain = audioCtx.createGain(); t.gain.gain.value = parseInt(t.vol.value) / 100;
    s.connect(t.gain); t.gain.connect(ensureTrackEq(t).input);
    const now = nowFrame();
    if (anchor > now) s.start(anchor / sr, 0);
    else s.start(audioCtx.currentTime, mod(now - anchor, t.L) / sr);
    t.src = s;
  }
  function stopSrc(t) {
    if (t.src) { try { t.src.stop(); } catch (e) {} t.src.disconnect(); t.src = null; }
    if (t.gain) { const g = t.gain; t.gain = null; setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 50); }
  }

  // ---- Aufnahme ----
  function beginRec(t, kind, start) {
    rec = { t, kind, start, end: null, chunks: [], n: 0, armed: false, Lt: 0,
      bpm0: bpm(), hadRef: countBars() > 0 || drumsOnF() || (typeof isPlaying !== 'undefined' && isPlaying) };
    cap = kind === 'first' ? { t, list: hist.slice(), until: 0, onDone: null } : null;
    t.state = kind === 'overdub' ? 'overdub' : 'recording';
  }
  // Feste Taktzahl gewählt: Aufnahme endet von selbst
  function applyAutoEnd() {
    const nb = selectedBars();
    if (!nb || !rec || rec.kind === 'overdub') return;
    if (rec.kind === 'first') rec.end = rec.start + nb * barFrames();
    else {
      const k = Math.max(1, Math.round(nb * barFrames() / baseL));
      rec.Lt = k * baseL; rec.end = rec.start + rec.Lt;
    }
  }
  function scheduleClick(tm, accent) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.25, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + 0.05);
    o.connect(g); g.connect(ensureMasterBus()); o.start(tm); o.stop(tm + 0.06);
    vEnd(o, [g]);
  }
  // ---- Vorzähler: 1, 2, 4 oder 8 Takte vor Aufnahme bzw. Loop-Start ----
  let countNodes = [], countEnd = 0, countBeats = 0;
  const countBars = () => parseInt(countInEl.value) || 0;
  function cancelCountIn() {
    countNodes.forEach(o => { try { o.stop(); } catch (e) {} });
    countNodes = []; countEnd = 0; countBeats = 0;
  }
  function scheduleCountIn(startFrame, bars) {
    cancelCountIn();
    const bt = beatFrames();
    countBeats = bars * 4; countEnd = startFrame + Math.round(countBeats * bt);
    for (let i = 0; i < countBeats; i++) {
      const tm = (startFrame + i * bt) / sr;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      const bar1 = i % 4 === 0, last = i >= countBeats - 4;
      o.frequency.value = bar1 ? 1600 : (last ? 1150 : 1000);
      g.gain.setValueAtTime(bar1 ? 0.3 : 0.2, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + 0.05);
      o.connect(g); g.connect(ensureMasterBus()); o.start(tm); o.stop(tm + 0.06);
      vEnd(o, [g]);
      countNodes.push(o);
    }
  }
  // Startpunkt für Loop/Aufnahme: mit Drums auf den nächsten Takt, dazu ggf. der Vorzähler
  function startAnchor(kind) {
    const bars = countBars(), use = bars > 0 && (kind === 'rec' || countPlayEl.checked);
    let a = drumsOnF() ? nextBarFrame() : nowFrame() + Math.round(sr * (use ? 0.12 : 0.03));
    if (use) { scheduleCountIn(a, bars); a = countEnd; }
    else cancelCountIn();
    kick();
    return a;
  }

  function startNewRecording(t) {
    const now = nowFrame(), nb = selectedBars();
    const lenTxt = nb ? ' Sie endet nach ' + nb + ' Takt' + (nb === 1 ? '' : 'en') + ' von selbst.' : ' Tippe zum Beenden.';
    if (baseL && !anyRunning()) {
      anchor = trigEl.checked ? (drumsOnF() ? nextBarFrame() : now) : startAnchor('rec');
      tracks.forEach(o => { if (o.L && o !== t) { startTrack(o); o.state = 'playing'; } });
    }
    const kind = baseL ? 'new' : 'first';
    if (trigEl.checked) {
      beginRec(t, kind, Infinity); rec.armed = true; hist = hist.slice(-2);
      setStatus('Spur ' + (t.i + 1) + ' wartet auf dein erstes Signal.' + (nb ? lenTxt : ''));
      return;
    }
    let start = now;
    if (!baseL) start = startAnchor('rec');
    else start = Math.max(now, anchor);
    beginRec(t, kind, start);
    applyAutoEnd();
    const cb = countBars();
    setStatus((start > now + sr * 0.2 ? (cb ? cb + ' Takt' + (cb === 1 ? '' : 'e') + ' Vorzähler – dann nimmt Spur ' + (t.i + 1) + ' auf.' : 'Gleich geht’s los.') : 'Spur ' + (t.i + 1) + ' nimmt auf.') + lenTxt);
  }
  // Beenden per Taster oder Stopp: sofort (bzw. auf den gerade vergangenen Takt/Loopanfang), nie auf ein spätes Ende warten
  function endRec(stopAfter) {
    const now = nowFrame();
    if (rec.armed || now < rec.start) { cancelRec(); setStatus('Abgebrochen.'); return; }
    rec.userEnded = true;
    rec.stopAfter = !!stopAfter;
    if (rec.kind === 'first') {
      let end = now;
      rec.pressEnd = now;
      if (selectedBars() || (snapEl.checked && rec.hadRef)) {
        const bar = barFrames();
        end = rec.start + Math.max(1, Math.round((now - rec.start) / bar)) * bar;
        if (rec.end !== null) end = Math.min(end, rec.end);
      }
      if (end - rec.start < sr * 0.25) { cancelRec(); setStatus('Zu kurz – nochmal aufnehmen.'); return; }
      rec.end = end;
      setStatus(end > now + sr * 0.05 ? 'Spiel bis zum Taktende weiter …' : 'Schließe Aufnahme ab …');
    } else if (rec.kind === 'new') {
      const c = (now - anchor) / baseL, b = anchor + Math.floor(c) * baseL;
      let end = (now - b < baseL * 0.25 && b > rec.start + sr * 0.25) ? b : now;
      if (rec.end !== null) end = Math.min(end, rec.end);
      rec.end = end;
      rec.Lt = Math.max(1, Math.ceil((end - rec.start) / baseL - 1e-6)) * baseL;
      setStatus('Schließe Aufnahme ab …');
    } else {
      rec.end = now;
      setStatus('Schließe Overdub ab …');
    }
    update();
  }
  function finishRec() {
    const r = rec; rec = null; const t = r.t;
    if (r.kind === 'first') {
      t.L = r.end - r.start;
      t.layers = [monoIfSame(joinChunks(r.chunks, t.L))];
      baseL = t.L; anchor = r.end; t.hist = []; t.orig = null; t.origPos = null;
      if (cap && cap.t === t && snapEl.checked) {
        r.provLayer = t.layers[0];
        cap.until = r.end + Math.round(1.5 * sr);
        cap.onDone = c => refineFirst(t, r, c).catch(e => console.warn(e));
      } else cap = null;
    } else if (r.kind === 'new') {
      if (r.Lt) t.L = r.Lt;
      else {
        const c0 = Math.floor((r.start - anchor) / baseL), c1 = Math.floor((r.end - 1 - anchor) / baseL);
        t.L = Math.max(1, c1 - c0 + 1) * baseL;
      }
      const raw = monoIfSame(joinChunks(r.chunks, r.n)), mono = raw.r === raw.l, ly = mono ? SP(new Float32Array(t.L)) : S(t.L);
      for (let j = 0; j < raw.length; j++) { const k = mod(r.start + j - anchor, t.L); ly.l[k] += raw.l[j]; if (!mono) ly.r[k] += raw.r[j]; }
      t.layers = [ly]; t.hist = []; t.orig = null;
    } else {
      // Overdub direkt in die Spur einrechnen: eine neue Fassung statt Schicht + Summe; die alte bleibt fürs Rückgängig
      snapshot(t);
      const raw = monoIfSame(joinChunks(r.chunks, r.n)), base = t.mix, st = base.r !== base.l || raw.r !== raw.l;
      const out = st ? { l: base.l.slice(), r: base.r.slice(), length: t.L } : SP(base.l.slice());
      for (let j = 0; j < raw.length; j++) { const k = mod(r.start + j - anchor, t.L); out.l[k] += raw.l[j]; if (st) out.r[k] += raw.r[j]; }
      t.layers = [out];
    }
    rebuildMix(t);
    const al = r.kind === 'new' ? alignNewTake(t) : '';
    detectTrackKey(t);
    if (r.stopAfter) {
      stopSrc(t); t.state = 'stopped';
      setStatus('Spur ' + (t.i + 1) + ' aufgenommen und gestoppt. Tippe auf Play zum Abspielen.' + al);
    } else {
      startTrack(t);
      t.state = 'playing';
      setStatus(r.kind === 'overdub' ? 'Spur ' + (t.i + 1) + ': Overdub hinzugefügt.' : 'Spur ' + (t.i + 1) + ' läuft. Nochmal tippen für ein Overdub.' + al);
    }
    update();
  }
  // Erste Aufnahme eintakten: Tempo und Takt-Eins aus dem Gespielten bestimmen, Loop auf ganze Takte legen
  async function refineFirst(t, r, c) {
    const pre = Math.round(0.6 * sr), from = r.start - pre, to = c.until, g = t.inGain;
    const xs0 = S(to - from);
    for (const ch of c.list) {
      const a = Math.max(ch.m0, from), b = Math.min(ch.m0 + ch.data.length, to), dl = ch.data.l, dr = ch.data.r;
      for (let i = a; i < b; i++) { xs0.l[i - from] = dl[i - ch.m0] * g; xs0.r[i - from] = dr[i - ch.m0] * g; }
    }
    const xs = monoIfSame(xs0);
    const x = monoOf(xs);
    const stillSame = () => t.layers.length === 1 && t.layers[0] === r.provLayer && !(rec && rec.t === t);
    const rawLen = (r.pressEnd && !selectedBars() ? r.pressEnd : r.end) - r.start;
    const B = r.bpm0, ref = r.hadRef;
    let T = null, startF = r.start, how = '', precise = false;
    if (rawLen / sr >= 3.2) {
      // Analyse nur über das Gespielte plus kurzen Nachlauf; der längere Nachlauf dient nur dem Feinabgleich der Länge
      const aEnd = Math.min(xs.length, r.end + Math.round(0.7 * sr) - from);
      const beat = await Analyzer.beat(chans(xs).map(a => a.subarray(0, aEnd)), sr, { hintBpm: B, hintStrong: ref });
      window.__rf = { beat: beat && { bpm: beat.bpm, conf: beat.confidence, alt: beat.alternatives }, rawLen: rawLen / sr };
      if (!stillSame()) { window.__rf.why = 'changed'; return; }
      if (beat && beat.confidence > 2.2) {
        let cands = [beat.bpm, beat.bpm * 2, beat.bpm / 2].filter(v => v >= 40 && v <= 240);
        if (ref) {
          const best = cands.reduce((a, b) => Math.abs(Math.log(b / B)) < Math.abs(Math.log(a / B)) ? b : a);
          // Zum Klick/zu den Drums gespielt: deren Tempo ist das Raster (kleine Messabweichungen nicht übernehmen)
          T = Math.abs(best / B - 1) < 0.005 ? B : Math.abs(best / B - 1) < 0.04 ? best : B;
        } else {
          // Oktave mit der saubersten ganzen Taktzahl, bei Gleichstand die erkannte
          // dazu die Alternativen der Analyse und die Triolen-Verwandten (×1,5 / ×⅔) – mit etwas Abschlag
          const pen = new Map(cands.map(v => [v, v === beat.bpm ? 0 : 0.12]));
          const addC = (v, p) => { if (v >= 40 && v <= 240 && ![...pen.keys()].some(u => Math.abs(u / v - 1) < 0.01)) pen.set(v, p); };
          (beat.alternatives || []).forEach(a => { addC(a, 0.15); addC(a * 2, 0.2); addC(a / 2, 0.2); });
          addC(beat.bpm * 1.5, 0.2); addC(beat.bpm * 2 / 3, 0.2);
          cands = [...pen.keys()];
          const err = v => { const nb = rawLen / (240 / v * sr); return Math.abs(nb - Math.max(1, Math.round(nb))) + pen.get(v); };
          T = cands.reduce((a, b) => err(b) < err(a) ? b : a);
          // Takt-Eins: erkannte Eins (oder Schlag) nahe am Tastendruck
          const st = pre / sr, bs = 60 / T, near = (arr) => arr.reduce((m, v) => Math.abs(v - st) < Math.abs(m - st) ? v : m, Infinity);
          let d = near(beat.downbeats || []);
          if (!(Math.abs(d - st) < 0.4 * bs)) d = near(beat.beats || []);
          if (Math.abs(d - st) < 0.4 * bs) startF = from + Math.round(d * sr);
          how = ' (Tempo aus deinem Spiel erkannt)';
        }
        // Raster auf ~1 ms genau vermessen (gleichmäßiges Tempo, Tempo direkt aus der Messung): Länge daraus berechnen
        precise = !!(beat.fine && beat.fine.madMs < 4 && beat.steady && [1, 2, 0.5, 1.5, 2 / 3].some(q => Math.abs(T - beat.bpm * q) < 1e-6));
      }
    } else {
      const lp = await Analyzer.loop(chans(t.mix), sr, { hintBpm: B });
      if (!stillSame()) return;
      if (lp && lp.confidence > 2 && (!ref || Math.abs(lp.bpm / B - 1) < 0.04)) { T = lp.bpm; if (!ref) how = ' (Tempo aus deinem Spiel erkannt)'; }
    }
    if (!T) {
      if (ref) return;                                // dem Klick gefolgt: so lassen
      const nb0 = Math.max(1, Math.round(rawLen / barFrames()));
      T = nb0 * 240 / (rawLen / sr); how = ' (Tempo aus der Loop-Länge)';
    }
    const nbars = Math.max(1, Math.round(rawLen / (240 / T * sr)));
    let L2 = Math.round(nbars * 240 / T * sr);
    // Feinabgleich der Länge: Anschläge am Loopanfang und eine Loop-Länge später sollen deckungsgleich sein
    {
      const D = 16, n = Math.floor(x.length / D), e = new Float32Array(n);
      let acc = 0; const sm = Math.max(1, Math.round(0.003 * sr / D));
      for (let i = 1; i < n; i++) { let v = 0; for (let j = i * D; j < i * D + D && j < x.length; j++) { const d = x[j] - x[j - 1]; v += d < 0 ? -d : d; } acc += (v - acc) / sm; e[i] = acc; }
      const base = Math.round(L2 / D), R = Math.round(Math.max(0.035, 0.007 * L2 / sr) * sr / D);
      const s0e = Math.round((startF - from) / D), beatE = Math.round(60 / T * sr / D), w0 = Math.max(0, s0e - (beatE >> 1)), w1 = Math.min(s0e + beatE * 2, n - base - R - 2);
      const ncc = dl => {
        let ab = 0, aa = 0, bb = 0, ma = 0, mb = 0, c = 0;
        for (let i = w0; i < w1; i++) { const j = i + dl; if (j >= n) return -1; ma += e[i]; mb += e[j]; c++; }
        ma /= c; mb /= c;
        for (let i = w0; i < w1; i++) { const a = e[i] - ma, b = e[i + dl] - mb; ab += a * b; aa += a * a; bb += b * b; }
        return ab / Math.sqrt(aa * bb + 1e-12);
      };
      if (!precise && w1 - w0 >= beatE) {
        const v0 = ncc(base);
        let best = 0, bv = v0;
        for (let d = -R; d <= R; d++) { const v = ncc(base + d); if (v > bv + 1e-4) { bv = v; best = d; } }
        // nur echte Spitzen übernehmen: nicht am Rand des Suchbereichs und deutlich besser als ohne Korrektur
        if (bv > 0.45 && best && Math.abs(best) < R - 1 && bv > v0 + 0.02) L2 += best * D;
        if (window.__rf) Object.assign(window.__rf, { fine: best * D / sr, bv });
      }
    }
    if (window.__rf) Object.assign(window.__rf, { T, precise, L2: L2 / sr, startF: (startF - from) / sr, to: (to - from) / sr });
    if (startF - from < Math.round(0.012 * sr) || startF + L2 > to) { if (startF + L2 > to) { if (window.__rf) window.__rf.why = 'short'; return; } }
    // Loop schneiden: Takt 1 an den Anfang, die 10 ms davor ans Ende (sauberer Übergang)
    const s0 = startF - from, preW = Math.min(s0, Math.round(0.01 * sr));
    const seg = smap(xs, a => { const o = new Float32Array(L2); o.set(a.subarray(s0, s0 + L2 - preW), 0); o.set(a.subarray(s0 - preW, s0), L2 - preW); return o; });
    if (!stillSame()) return;
    const Lold = t.L, wasPlaying = !!t.src, now = nowFrame();
    t.layers = [seg]; t.L = L2; baseL = L2; rebuildMix(t);
    setTempo(nbars * 240 / (L2 / sr));
    const barF = L2 / nbars, downs = []; for (let k = 0; k <= nbars; k++) downs.push(Math.round(s0 + k * barF));
    t.orig = { data: xs, name: 'Aufnahme', downs, bars: nbars, bpm: bpm(), barMed: barF, steady: true, conf: 3, loopFile: true, recorded: true };
    t.origPos = s0; t.origBars = nbars;
    if (wasPlaying) {
      const p = mod(now - anchor, Lold), q = mod(p + (r.start - startF), L2);
      anchor = now - q; startTrack(t);
    }
    if (ed.t === t) { ed.s = 0; ed.e = t.L; fillSrc(); edInfo(); }
    detectTrackKey(t);
    setStatus('Spur ' + (t.i + 1) + ' eingetaktet: ' + nbars + ' Takt' + (nbars === 1 ? '' : 'e') + ' · ' + bpmTxt(bpm()) + ' BPM' + how + '.');
    update();
  }
  function cancelRec() {
    cap = null;
    if (!rec) return;
    if (nowFrame() < rec.start || rec.armed) cancelCountIn();
    const t = rec.t; rec = null;
    t.state = t.L ? (t.src ? 'playing' : 'stopped') : 'empty';
    update();
  }
  function clearTrack(t) {
    if (rec && rec.t === t) rec = null;
    if (cap && cap.t === t) cap = null;
    stopSrc(t);
    t.layers = []; t.L = 0; t.mix = null; t.peaks = null; t.state = 'empty'; t.hist = []; t.key = null; t.orig = null; t.origPos = null; t.buf = null; t.bufFor = null;
    clearTimeout(t.chTimer); t.chords = null; showChords(t); showKey();
    if (!anyContent()) baseL = 0;
    markDirty();
    if (ed.t === t) closeEditor();
    showKey();
    update();
  }
  function undoTrack(t) {
    if (rec && rec.t === t) { cancelRec(); setStatus('Aufnahme verworfen.'); return; }
    if (t.hist.length) {
      const sn = t.hist.pop(), os = others(t);
      t.layers = sn.layers; t.L = sn.L; t.origPos = sn.origPos; t.origBars = sn.origBars; rebuildMix(t);
      if (sn.od && t.orig) Object.assign(t.orig, sn.od);
      if (!os.length || os.every(o => o.L % sn.baseL === 0)) baseL = sn.baseL;
      if (t.src) { if (!os.length) anchor = nowFrame(); startTrack(t); }
      if (ed.t === t) { ed.s = 0; ed.e = t.L; ed.lastOp = null; ed.offMs = 0; edInfo(); fillSrc(); }
      detectTrackKey(t);
      setStatus('Spur ' + (t.i + 1) + ': letzter Schritt rückgängig gemacht.');
      update();
    } else if (t.L) { clearTrack(t); setStatus('Spur ' + (t.i + 1) + ' gelöscht.'); }
  }

  // ---- Audiodatei auf eine Spur legen ----
  // Tempo exakt setzen (auch mit Nachkommastelle), Drums und Taktkreis folgen
  function setTempo(v) {
    const el = $('bpm'); el.value = (Math.round(v * 10000) / 10000).toString(); el.dispatchEvent(new Event('input'));
  }
  const bpmTxt = v => (Math.round(v * 10) / 10).toString().replace('.', ',');

  // Gleichmäßige Lautstärke über die ganze Datei (Loop) – Song hat oft Einzählen oder Ausklang
  function evenEnergy(x) {
    const w = Math.max(256, Math.floor(Math.min(1.5 * sr, x.length / 4))), S = Math.floor(x.length / w), r = [];
    if (S < 2) return true;
    for (let k = 0; k < S; k++) { let e = 0; for (let i = k * w; i < (k + 1) * w; i += 4) e += x[i] * x[i]; r.push(Math.sqrt(e / (w / 4))); }
    // letztes Fenster genau am Dateiende
    { let e = 0; for (let i = x.length - w; i < x.length; i += 4) e += x[i] * x[i]; r.push(Math.sqrt(e / (w / 4))); }
    const med = r.slice().sort((a, b) => a - b)[r.length >> 1] || 1e-9;
    return Math.min(...r) / med > 0.25 && r[0] / med > 0.45 && r[r.length - 1] / med > 0.45;
  }
  // Original einer geladenen Datei mit Taktraster (Einsen in Samples, folgt Temposchwankungen)
  function makeOrig(data, name, beatRes, isLoopFile) {
    const toS = t => Math.round(t * sr);
    let downs = (beatRes.downbeats || []).map(toS).filter(v => v >= 0 && v < data.length);
    if (!downs.length) return null;
    const barMed = (() => { if (downs.length < 2) return Math.round(beatRes.beatSec * 4 * sr); const d = []; for (let i = 1; i < downs.length; i++) d.push(downs[i] - downs[i - 1]); d.sort((a, b) => a - b); return d[d.length >> 1]; })();
    // Rasterende: letzte Eins + ein Takt, solange Audio vorhanden
    const last = downs[downs.length - 1];
    if (last + barMed <= data.length + barMed * 0.05) downs.push(Math.min(last + barMed, data.length));
    // Ausklang: leise Takte am Ende abschneiden (unter 15 % der typischen Taktlautstärke)
    const dm = monoOf(data);
    const rmsBar = i => { let e = 0, c = 0; for (let j = downs[i]; j < downs[i + 1]; j += 16) { e += dm[j] * dm[j]; c++; } return Math.sqrt(e / Math.max(1, c)); };
    const br = []; for (let i = 0; i < downs.length - 1; i++) br.push(rmsBar(i));
    const medB = br.slice().sort((a, b) => a - b)[br.length >> 1] || 1e-9;
    // Ausklang: der letzte Takt zählt nur, wenn er noch kräftig klingt (kein Nachhall / Schlussakkord)
    while (downs.length > 2 && br[downs.length - 2] < medB * (downs.length - 2 === br.length - 1 ? 0.4 : 0.15)) { downs.pop(); br.pop(); }
    const bars = downs.length - 1;
    if (bars < 1) return null;
    const beats = (beatRes.beats || []).map(toS).filter(v => v >= 0 && v < data.length);
    return { data, name, downs, beats, bars, bpm: beatRes.bpm, barMed, steady: beatRes.steady, conf: beatRes.confidence, loopFile: !!isLoopFile };
  }

  // Ausschnitt aus dem Original: ab Takt „from“, „nb“ Takte – exakt von Eins zu Eins geschnitten.
  // Schlag 1 liegt genau auf dem Loopanfang, die 10 ms davor ans Loopende (sauberer Übergang).
  function placeExcerpt(t, from, nb) {
    const o = t.orig, os = others(t);
    from = Math.max(1, Math.min(from, o.bars)); nb = Math.max(1, Math.min(nb, o.bars - from + 1));
    const start = o.downs[from - 1], end = o.downs[from - 1 + nb];
    const Ldet = Math.max(1, end - start), pre = Math.min(start, Math.round(sr * 0.01));
    let seg = smap(o.data, a => { const g = new Float32Array(Ldet); g.set(a.subarray(start, Math.min(a.length, start + Ldet - pre)), 0); if (pre) g.set(a.subarray(start - pre, start), Ldet - pre); return g; });
    const exactBpm = 240 * nb / (Ldet / sr);
    const what = nb + ' Takt' + (nb === 1 ? '' : 'e') + (from > 1 ? ' ab Takt ' + from : ' ab Schlag 1') + (from === 1 && nb === o.bars ? (o.loopFile ? ' (Loop-Datei)' : ' (ganze Datei)') : '');
    let L, msg;
    if (!os.length) {
      L = Ldet; baseL = L; setTempo(exactBpm);
      msg = what + ' · ' + bpmTxt(exactBpm) + ' BPM.';
    } else {
      // Takte zählen statt Sekunden: nb Takte der Datei = nb Takte im Tempo des Loops (Tempo-Oktave ½/2× mitbedacht)
      const barF = barOf(baseL);
      const opts = [nb, nb * 2, nb % 2 ? 0 : nb / 2].filter(Boolean).map(k => ({ k, Lb: Math.round(k * barF) }));
      const best = opts.reduce((a, b) => Math.abs(Math.log(b.Lb / Ldet)) < Math.abs(Math.log(a.Lb / Ldet)) ? b : a);
      const Lb = best.Lb, ratio = Lb / Ldet;
      const os2 = os.every(o => o.L % Lb === 0) && Lb < baseL && baseL % Lb === 0;
      L = Lb >= baseL ? Math.ceil(Lb / baseL - 1e-6) * baseL : (os2 ? Lb : baseL);
      if (Math.abs(ratio - 1) <= 0.35) {
        if (Math.abs(ratio - 1) > 0.0005) seg = stretch(seg, Lb);
        seg = padS(seg, L);
        msg = what + (Math.abs(ratio - 1) > 0.002 ? ', ins Tempo des Loops gebracht (' + bpmTxt(exactBpm) + ' → ' + bpmTxt(exactBpm / ratio) + ' BPM, Tonhöhe bleibt)' : ', passt zum Loop') + (L > Lb + 1 ? ' – auf ' + Math.round(L / barF) + ' Takte des Loops aufgefüllt' : '') + '.';
      } else {
        L = Math.max(1, Math.round(Ldet / baseL)) * baseL;
        seg = padS(seg, L);
        msg = what + '. Das Tempo der Datei (' + bpmTxt(exactBpm) + ' BPM) weicht stark vom Loop ab. Nutze „An Loop-Länge anpassen“ oder leere die anderen Spuren.';
      }
    }
    t.origPos = Math.abs(L - Ldet) <= 1 ? start : null;      // Zuordnung Loopanfang → Original (für „Prüfen“)
    t.origBars = nb;
    return { seg, L, msg };
  }

  // Analyse einer geladenen Datei: Loop-Datei (ganze Takte) oder Song mit Taktraster
  async function analyseImport(data, name) {
    const n = data.length, secs = n / sr;
    const beat = await Analyzer.beat(chans(data), sr);
    if (secs <= 40 && (!beat || beat.confidence > 2.5) && evenEnergy(monoOf(data))) {
      const lp = await Analyzer.loop(chans(data), sr);
      // Song-Analyse muss das Tempo bestätigen – bis auf die Oktave
      const sameTempo = lp && (!beat || [1, 2, 0.5].some(q => Math.abs(lp.bpm - beat.bpm * q) / (beat.bpm * q) < 0.012));
      if (lp && lp.isLoop && Math.abs(lp.lenErrMs) < 25 && sameTempo && lp.confidence > 2) {
        const k = Math.round(-lp.downOffsetSec * sr);
        if (Math.abs(k) > sr * 0.003) {           // Takt 1 an den Dateianfang drehen
          const kk = mod(-k, n);
          data = smap(data, a => { const r = new Float32Array(n); r.set(a.subarray(kk), 0); r.set(a.subarray(0, kk), n - kk); return r; });
        }
        const barF = n / lp.bars, downs = [], beats = []; for (let i = 0; i <= lp.bars; i++) downs.push(Math.round(i * barF));
        for (let i = 0; i < lp.bars * 4; i++) beats.push(Math.round(i * barF / 4));
        return { kind: 'loop', lp, orig: { data, name, downs, beats, bars: lp.bars, bpm: lp.bpm, barMed: barF, steady: true, conf: lp.confidence, loopFile: true } };
      }
    }
    if (beat && beat.confidence > 2.5) {
      const o = makeOrig(data, name, beat, false);
      if (o) { if (beat.alternatives && beat.alternatives.length) o.alts = beat.alternatives; return { kind: 'song', beat, orig: o }; }
    }
    return { kind: 'none', data };
  }

  // Vor dem Laden fragen: ganze Datei oder Ausschnitt (Analyse läuft schon im Hintergrund)
  function askImport(t, name, secs, anaP) {
    const dlg = $('impDlg'), from = $('impFrom'), bars = $('impBars'), anaEl = $('impAna');
    $('impTitle').textContent = 'Datei auf Spur ' + (t.i + 1);
    $('impName').textContent = name + ' · ' + Math.floor(secs / 60) + ':' + String(Math.round(secs % 60)).padStart(2, '0') + ' min';
    anaEl.textContent = 'Analysiere Takt und Tempo …'; anaEl.classList.remove('done');
    $('impAllInfo').textContent = 'komplett als Loop';
    dlg.querySelector('input[value="all"]').checked = true;
    let total = 0;
    const fillBars = () => {
      const f = parseInt(from.value) || 1, max = total ? total - f + 1 : 64, prev = bars.value;
      bars.innerHTML = '';
      [1, 2, 4, 8, 16, 32].filter(b => b < max).forEach(b => bars.add(new Option(b + ' Takt' + (b === 1 ? '' : 'e'), String(b))));
      if (total) bars.add(new Option('bis zum Ende (' + max + ')', String(max)));
      bars.value = [...bars.options].some(o => o.value === prev) ? prev : (bars.options.length > 3 ? '8' : bars.options[bars.options.length - 1].value);
    };
    from.innerHTML = '<option value="1">Takt 1</option>'; fillBars();
    from.onchange = () => { dlg.querySelector('input[value="part"]').checked = true; fillBars(); };
    bars.onchange = () => { dlg.querySelector('input[value="part"]').checked = true; };
    anaP.then(a => {
      if (dlg.hidden) return;
      if (a.kind === 'none') { anaEl.textContent = 'Kein klarer Takt erkennbar – Ausschnitt wird nach dem aktuellen Tempo bemessen.'; anaEl.classList.add('done'); return; }
      total = a.orig.bars;
      const st0 = Math.round(a.orig.downs[0] / sr), intro = a.kind === 'song' && st0 >= 2 ? ' · Takt 1 bei ' + Math.floor(st0 / 60) + ':' + String(st0 % 60).padStart(2, '0') + ' (davor freies Intro)' : '';
      anaEl.textContent = (a.kind === 'loop' ? 'Loop erkannt: ' : 'Erkannt: ') + bpmTxt(a.kind === 'loop' ? a.lp.bpm : a.beat.bpm) + ' BPM · ' + total + ' Takte' + intro;
      anaEl.classList.add('done');
      $('impAllInfo').textContent = 'alle ' + total + ' Takte als Loop';
      from.innerHTML = '';
      for (let i = 1; i <= total; i++) from.add(new Option('Takt ' + i, String(i)));
      fillBars();
    });
    dlg.hidden = false;
    setTimeout(() => $('impOk').focus(), 30);
    return new Promise(res => {
      const done = v => { dlg.hidden = true; $('impOk').onclick = $('impCancel').onclick = null; res(v); };
      $('impOk').onclick = () => {
        const mode = dlg.querySelector('input[name="impMode"]:checked').value;
        done(mode === 'all' ? { mode: 'all' } : { mode: 'part', from: parseInt(from.value) || 1, bars: parseInt(bars.value) || 8 });
      };
      $('impCancel').onclick = () => done(null);
    });
  }

  async function importFile(t, file) {
    ensureAudio(); sr = audioCtx.sampleRate;
    setStatus('Lade „' + file.name + '“ …');
    let buf;
    try { buf = await audioCtx.decodeAudioData(await file.arrayBuffer()); }
    catch (e) { setStatus('„' + file.name + '“ kann das iPad nicht öffnen. Wandle die Datei in MP3, WAV oder M4A um.'); return; }
    if (rec && rec.t === t) cancelRec();
    // Stereo bleibt Stereo (Mono-Dateien: beide Seiten gleich). Höchstens 6 Minuten, damit der Speicher reicht.
    const n = Math.min(buf.length, Math.round(buf.sampleRate * 360));
    const l = buf.getChannelData(0).slice(0, n);
    const data = buf.numberOfChannels > 1 ? monoIfSame(SP(l, buf.getChannelData(1).slice(0, n))) : SP(l);
    if (buf.length > n) setStatus('Die Datei ist länger als 6 Minuten – die ersten 6 Minuten werden verwendet.');
    buf = null;
    const secs = n / sr;
    setStatus('Analysiere Takt und Tempo von „' + file.name + '“ …');
    const anaP = analyseImport(data, file.name);
    // Längere Dateien: vorher fragen, wie viel davon in die Spur soll
    let choice = { mode: 'all' };
    if (secs > 20) {
      choice = await askImport(t, file.name, secs, anaP);
      if (!choice) { setStatus('Laden abgebrochen.'); return; }
    }
    const ana = await anaP;
    const os = others(t);
    t.orig = null; t.origPos = null;
    let seg = null, L = 0, msg = '', warn = '';
    if (ana.kind !== 'none') {
      t.orig = ana.orig;
      const o = t.orig, from = choice.mode === 'part' ? Math.min(choice.from, o.bars) : 1;
      const nb = choice.mode === 'part' ? Math.min(choice.bars, o.bars - from + 1) : o.bars;
      const r = placeExcerpt(t, from, nb);
      seg = r.seg; L = r.L;
      if (ana.kind === 'loop') msg = 'Loop erkannt: ' + r.msg + (ana.lp.startKept ? ' Takt 1 = Dateianfang.' : ' Takt 1 wurde an den Anfang gelegt (' + Math.round(ana.lp.downOffsetSec * 1000) + ' ms).');
      else {
        msg = 'Takt erkannt: ' + r.msg + (ana.beat.steady ? '' : ' Das Tempo schwankt leicht, die Takte folgen der Aufnahme.');
        if (ana.beat.confidence < 4) warn = ' Die Erkennung ist unsicher – prüfe Takt 1 im Editor.';
      }
    } else {
      // Kein Takt erkennbar: nach Zeit
      const want = choice.mode === 'part' ? Math.min(n, choice.bars * barFrames()) : n;
      const d0 = choice.mode === 'part' ? Math.min(n - 1, (choice.from - 1) * barFrames()) : 0;
      const part = smap(data, a => a.slice(d0, Math.min(n, d0 + want)));
      if (!os.length) { L = part.length; baseL = L; }
      else L = Math.max(1, Math.round(part.length / baseL)) * baseL;
      seg = padS(part, L);
      msg = 'Kein klarer Takt erkannt, nach Zeit eingesetzt. Schneide den Loop im Editor zu.';
    }
    stopSrc(t);
    t.layers = [seg]; t.L = L; t.hist = []; rebuildMix(t);
    if (os.length && ana.kind !== 'none') { const ms = autoAlign(t, true); if (ms) msg += ' Feinabgleich zu den anderen Spuren: ' + (ms > 0 ? '−' : '+') + Math.abs(Math.round(ms)) + ' ms.'; }
    if (!anyRunning()) anchor = startAnchor();
    startTrack(t); t.state = 'playing';
    setStatus('Spur ' + (t.i + 1) + ': ' + msg + warn);
    update();
    openEditor(t);
    detectTrackKey(t);
  }

  // ---- Fußtaster ----
  async function foot(t) {
    if (rec) {
      if (rec.t === t) {
        if (rec.armed || nowFrame() < rec.start) { cancelRec(); setStatus('Abgebrochen.'); return; }
        if (!rec.userEnded) endRec();
        return;
      }
      if (!rec.userEnded) endRec();
      setStatus('Erst wird Spur ' + (rec.t.i + 1) + ' abgeschlossen, dann tippe erneut.');
      return;
    }
    if (t.state === 'empty') {
      if (!(await ensureMic())) return;
      startNewRecording(t);
    } else if (t.state === 'playing') {
      if (!(await ensureMic())) return;
      beginRec(t, 'overdub', nowFrame());
      setStatus('Spur ' + (t.i + 1) + ': Overdub läuft. Tippe zum Beenden.');
    } else if (t.state === 'stopped') {
      ensureAudio();
      if (!anyRunning()) anchor = startAnchor('play');
      startTrack(t); t.state = 'playing';
      setStatus('Spur ' + (t.i + 1) + ' läuft.');
    }
    update();
  }

  tracks.forEach(t => {
    t.foot.addEventListener('click', () => foot(t));
    t.stopB.addEventListener('click', () => {
      if (rec && rec.t === t) { if (!rec.userEnded) endRec(true); else rec.stopAfter = true; return; }
      if (t.src) { stopSrc(t); t.state = 'stopped'; setStatus('Spur ' + (t.i + 1) + ' gestoppt.'); }
      update();
    });
    t.undoB.addEventListener('click', () => undoTrack(t));
    t.editB.addEventListener('click', () => { if (ed.t === t) closeEditor(); else openEditor(t); });
    t.keyB.addEventListener('click', () => { if (t.key) { Analyzer.apply(t.key); setStatus('Tonart ' + Analyzer.label(t.key) + ' übernommen.'); } });
    let armed = null;
    t.clearB.addEventListener('click', () => {
      if (!armed) {
        t.clearB.classList.add('danger');
        armed = setTimeout(() => { armed = null; t.clearB.classList.remove('danger'); }, 2500);
        setStatus('Nochmal auf ✕ tippen, um Spur ' + (t.i + 1) + ' zu löschen.');
        return;
      }
      clearTimeout(armed); armed = null; t.clearB.classList.remove('danger');
      clearTrack(t); setStatus('Spur ' + (t.i + 1) + ' gelöscht.');
    });
    t.fileIn.addEventListener('change', () => { const f = t.fileIn.files && t.fileIn.files[0]; t.fileIn.value = ''; if (f) importFile(t, f); });
    t.vol.value = loadPref('3nps-vol' + t.i, '90'); t.volV.textContent = t.vol.value;
    t.vol.addEventListener('input', () => { if (t.gain) t.gain.gain.setTargetAtTime(parseInt(t.vol.value) / 100, audioCtx.currentTime, 0.02); t.volV.textContent = t.vol.value; savePref('3nps-vol' + t.i, t.vol.value); markDirty(); });
    const showIng = () => { const db = parseInt(t.ing.value); t.inGain = Math.pow(10, db / 20); t.ingV.textContent = (db > 0 ? '+' : '') + db + ' dB'; };
    t.ing.value = loadPref('3nps-ing' + t.i, '0'); showIng();
    t.ing.addEventListener('input', () => { showIng(); savePref('3nps-ing' + t.i, t.ing.value); kick(); });
  });

  function allStartStop() {
    ensureAudio(); sr = audioCtx.sampleRate;
    if (anyRunning() || rec) {
      if (rec) cancelRec();
      cancelCountIn();
      tracks.forEach(t => { if (t.src) { stopSrc(t); t.state = 'stopped'; } });
      droneFollow(false);
      setStatus('Alle Spuren gestoppt.');
    } else if (anyContent()) {
      anchor = startAnchor('play');
      tracks.forEach(t => { if (t.L) { startTrack(t); t.state = 'playing'; } });
      droneFollow(true);
      setStatus('Alle Spuren laufen.');
    } else {
      setStatus('Noch nichts aufgenommen. Tippe auf den Taster einer Spur.');
    }
    update();
  }
  allBtn.addEventListener('click', allStartStop);
  const masterEl = $('loopMaster'), limBtn = $('loopLimiter');
  masterEl.value = loadPref('3nps-master', '100');
  const showMaster = () => { $('loopMasterV').textContent = masterEl.value + ' %'; const on = loadPref('3nps-limiter', '1') === '1'; limBtn.classList.toggle('active', on); limBtn.textContent = on ? 'Limiter an' : 'Limiter aus'; };
  masterEl.addEventListener('input', () => { savePref('3nps-master', masterEl.value); showMaster(); if (window.applyMasterPrefs && audioCtx) applyMasterPrefs(); });
  limBtn.addEventListener('click', () => { savePref('3nps-limiter', loadPref('3nps-limiter', '1') === '1' ? '0' : '1'); showMaster(); if (audioCtx) { ensureMasterBus(); applyMasterPrefs(); } });
  showMaster();

  latEl.addEventListener('input', () => { latVal.textContent = latEl.value + ' ms'; savePref('3nps-latency', latEl.value); });
  snapEl.addEventListener('change', () => savePref('3nps-snap', snapEl.checked ? '1' : '0'));
  countInEl.addEventListener('change', () => savePref('3nps-countin', countInEl.value));
  countPlayEl.addEventListener('change', () => savePref('3nps-countin-play', countPlayEl.checked ? '1' : '0'));
  barsEl.addEventListener('change', () => { savePref('3nps-bars', barsEl.value); snapEl.closest('label').hidden = barsEl.value !== 'free'; });
  trigEl.addEventListener('change', async () => { savePref('3nps-trigger', trigEl.checked ? '1' : '0'); $('threshRow').hidden = !trigEl.checked; if (trigEl.checked) await ensureMic(); });
  threshEl.addEventListener('input', () => { savePref('3nps-thresh', threshEl.value); kick(); });
  if (latEl.value !== '') latVal.textContent = latEl.value + ' ms';
  snapEl.closest('label').hidden = barsEl.value !== 'free';
  $('threshRow').hidden = !trigEl.checked;

  // ---- Anzeige ----
  const FOOT_LABEL = { empty: 'REC', recording: 'Stopp', overdub: 'Stopp', playing: 'Overdub', stopped: 'Play' };
  function footState(t) {
    if (rec && rec.t === t) { if (rec.armed) return 'armed'; if (nowFrame() < rec.start) return 'pending'; }
    return t.state;
  }
  function update() {
    tracks.forEach(t => {
      const st = footState(t);
      t.foot.dataset.state = st;
      t.foot.closest('.track').dataset.state = st;
      t.foot.querySelector('.lbl').textContent = st === 'armed' ? 'Wartet' : st === 'pending' ? 'Abbruch' : FOOT_LABEL[st];
      t.stopB.disabled = !(t.src || (rec && rec.t === t));
      t.undoB.disabled = !(t.L || (rec && rec.t === t));
      t.clearB.disabled = !(t.L || (rec && rec.t === t));
      t.editB.disabled = !t.L || !!(rec && rec.t === t);
      t.editB.classList.toggle('on', ed.t === t);
      const st2 = !!(t.L && t.mix && t.mix.r !== t.mix.l);
      t.chB.hidden = !t.L; t.chB.textContent = st2 ? 'Stereo' : 'Mono'; t.chB.classList.toggle('st', st2);
      t.chB.title = st2 ? 'Diese Spur ist stereo (links und rechts verschieden)' : 'Diese Spur ist mono (links und rechts gleich)';
    });
    allBtn.textContent = (anyRunning() || rec) ? 'Alle stoppen' : 'Alle starten';
    allBtn.classList.toggle('active', anyRunning());
    $('ideaSave').disabled = !anyContent() || !!rec;
    if (baseL) {
      const secs = baseL / sr, bars = secs / barDur();
      infoEl.textContent = 'Loop ' + (Math.abs(bars - Math.round(bars)) < 0.02 ? Math.round(bars) + ' Takt' + (Math.round(bars) === 1 ? '' : 'e') + ' · ' : '') + secs.toFixed(1).replace('.', ',') + ' s';
    } else infoEl.textContent = 'Kein Loop';
    kick();
  }
  function kick() { if (!rafId) rafId = requestAnimationFrame(tick); }

  let css = null;
  function colors() {
    const c = getComputedStyle(document.documentElement);
    const g = n => c.getPropertyValue(n).trim();
    return { ink: g('--ink'), muted: g('--muted'), line: g('--line'), rec: g('--root-color'), dub: g('--dub'), bg: g('--surface-2'), t: [g('--t1'), g('--t2'), g('--t3')] };
  }
  function fit(cv) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  // Neonfarben für die Taktkreise; der erste Takt bekommt immer eine eigene Farbe
  const NEON = { rec: '#ff2d55', dub: '#ffe14a', bar1: '#ff8a1a', t: ['#e4f2ff', '#2de2ff', '#86a8ff'] };
  // Farben folgen der gewählten Optik (CSS-Variablen)
  function readNeon() {
    const c = getComputedStyle(document.documentElement), g = (n, d) => c.getPropertyValue(n).trim() || d;
    NEON.rec = g('--neon-rec', '#ff2d55'); NEON.dub = g('--neon-dub', '#ffe14a'); NEON.bar1 = g('--neon-bar1', '#ff8a1a');
    NEON.t = [g('--t1', '#e4f2ff'), g('--t2', '#2de2ff'), g('--t3', '#86a8ff')];
    css = null; tracks.forEach(t => { t.mh = 0; });
    if (ed.t) edEl.style.setProperty('--tc', NEON.t[ed.t.i]);
    kick();
  }

  function drawRing(t, C) {
    const f = fit(t.ring); if (!f) return;
    const { ctx, w, h } = f;
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 18, lw = Math.max(7, R * 0.13);
    const now = audioCtx ? playFrame() : 0, tc = NEON.t[t.i];

    // S Segmente, prog = wie viele Segmente gefüllt sind (mit Bruchteil für flüssiges Füllen)
    // perBar = Segmente pro Takt (für die Farbe des ersten Takts), col = Neonfarbe
    function ring(S, prog, perBar, col, dim) {
      const gap = S > 24 ? 0.014 : 0.04;
      ctx.lineCap = 'butt';
      for (let k = 0; k < S; k++) {
        const a0 = -Math.PI / 2 + (k / S) * Math.PI * 2 + gap, a1 = -Math.PI / 2 + ((k + 1) / S) * Math.PI * 2 - gap;
        const first = perBar > 0 && k < perBar;
        const c = first ? NEON.bar1 : col;
        // Grundspur: erster Takt schwach eingefärbt, Rest neutral
        ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1);
        ctx.lineWidth = lw; ctx.strokeStyle = first ? c : C.line; ctx.globalAlpha = first ? 0.22 : 1; ctx.shadowBlur = 0;
        ctx.stroke();
        const frac = Math.max(0, Math.min(1, prog - k));
        if (frac > 0) {
          ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * frac);
          if (!dim && !window.__lite) { // Neon-Schein als breite, transparente Striche
            ctx.strokeStyle = c; ctx.globalAlpha = 0.16; ctx.lineWidth = lw * 2.0; ctx.stroke();
            ctx.globalAlpha = 0.32; ctx.lineWidth = lw * 1.5; ctx.stroke();
          }
          ctx.strokeStyle = c; ctx.globalAlpha = dim ? 0.6 : 1;
          ctx.lineWidth = lw; ctx.stroke();
          if (!dim) { // heller Kern für den Neon-Effekt
            ctx.shadowBlur = 0; ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, lw * 0.22); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    function center(big, small, color, glow) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.font = '600 ' + Math.round(R * 0.4) + 'px ui-monospace, "SF Mono", Menlo, monospace';
      ctx.fillText(big, cx, cy - R * 0.08);
      ctx.shadowBlur = 0;
      ctx.fillStyle = C.muted;
      ctx.font = '600 ' + Math.max(9, Math.round(R * 0.15)) + 'px -apple-system, system-ui, sans-serif';
      ctx.fillText(small.toUpperCase(), cx, cy + R * 0.34);
    }
    function segsFor(L) {
      const beats = L / beatFrames(), bars = beats / 4;
      if (Math.abs(beats - Math.round(beats)) < 0.05 && beats <= 32) return { S: Math.round(beats), perBar: 4 };
      if (Math.abs(bars - Math.round(bars)) < 0.05 && bars <= 64) return { S: Math.round(bars), perBar: 1 };
      return { S: 16, perBar: 0 };
    }
    const LB = t.L || baseL;
    const pos = (fr) => { const bf = barOf(LB), bt = bf / 4; return (Math.floor(fr / bf) + 1) + '.' + (Math.floor(mod(fr, bf) / bt) + 1); };
    // Aufblitzen am Anfang jedes Takts (erster Takt in Magenta)
    function flash(p, col) {
      if (flashMode === 'off' || p < 0) return;
      const bf = barOf(LB), bt = bf / 4;
      const onBar = mod(p, bf) < bt * 0.5;                       // gerade Taktanfang (Schlag 1)
      const since = (flashMode === 'beat' ? mod(p, bt) : mod(p, bf)) / sr;
      const dur = flashMode === 'beat' ? Math.min(0.26, bt / sr * 0.7) : 0.32;
      const fl = 1 - since / dur;
      if (fl <= 0) return;
      const fc = Math.floor(p / bf) === 0 ? NEON.bar1 : col;
      const e = Math.pow(fl, 1.3) * (flashMode === 'beat' && !onBar ? 0.55 : 1);   // Schläge 2–4 etwas schwächer
      // gefüllte Scheibe, breiter Leuchtring, weißer Kern
      ctx.beginPath(); ctx.arc(cx, cy, R - lw * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = fc; ctx.globalAlpha = 0.32 * e; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = fc; ctx.globalAlpha = 0.35 * e; ctx.lineWidth = lw * 2.5; ctx.stroke();
      ctx.globalAlpha = 0.9 * e; ctx.lineWidth = lw * 1.7; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = e; ctx.lineWidth = Math.max(2.5, lw * 0.45); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Vorzähler: Ring füllt sich Schlag für Schlag, Zahl zählt die Takte bzw. im letzten Takt die Schläge herunter
    function countdown(endF, col) {
      const bt = beatFrames(), leftB = (endF - now) / bt;
      const total = countEnd === endF && countBeats ? countBeats : Math.max(4, Math.ceil(leftB));
      const S = Math.min(total, 32), done = (total - leftB) * S / total;
      ring(S, Math.max(0, done), 0, NEON.bar1, false);
      const p = (total - leftB) * bt;                      // Position im Vorzähler (für den Blitz je Schlag)
      if (flashMode !== 'off') {
        const inBeat = mod(p, bt) / sr, fl = 1 - inBeat / 0.2;
        if (fl > 0) { ctx.beginPath(); ctx.arc(cx, cy, R - lw * 0.6, 0, Math.PI * 2); ctx.fillStyle = NEON.bar1; ctx.globalAlpha = 0.22 * fl * fl; ctx.fill(); ctx.globalAlpha = 1; }
      }
      const big = leftB > 4 ? '−' + Math.ceil(leftB / 4) : String(Math.max(1, Math.ceil(leftB)));
      center(big, leftB > 4 ? 'Takte Vorzähler' : 'Vorzähler', NEON.bar1, true);
      void col;
    }
    const isRec = rec && rec.t === t;
    if (isRec && rec.armed) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      ctx.globalAlpha = 0.3 + 0.7 * pulse; ring(4, 4, 0, NEON.rec, false); ctx.globalAlpha = 1;
      center('●', 'wartet auf Signal', NEON.rec, true);
    } else if ((isRec && now < rec.start) || (!isRec && t.src && now < anchor)) {
      countdown(isRec ? rec.start : anchor, isRec ? NEON.rec : tc);
    } else if (isRec && rec.kind === 'first') {
      const el = Math.max(0, now - rec.start), beats = el / beatFrames(), nb = selectedBars();
      if (nb && nb <= 8) ring(nb * 4, beats, 4, NEON.rec, false);
      else {
        const inBar1 = beats < 4;
        ring(4, beats % 4, inBar1 ? 4 : 0, NEON.rec, false);
      }
      flash(el, NEON.rec);
      center(pos(el), nb ? 'Aufnahme · ' + nb + ' Takte' : 'Aufnahme', NEON.rec, true);
    } else if (isRec) {
      const col = rec.kind === 'overdub' ? NEON.dub : NEON.rec;
      const Lr = rec.kind === 'overdub' ? t.L : (rec.Lt || baseL);
      const base = rec.kind === 'new' && rec.Lt ? rec.start : anchor;
      const sg = segsFor(Lr);
      ring(sg.S, mod(now - base, Lr) / Lr * sg.S, sg.perBar, col, false);
      flash(rec.kind === 'overdub' ? mod(now - anchor, t.L) : mod(now - base, Lr), col);
      center(pos(rec.kind === 'overdub' ? mod(now - anchor, t.L) : Math.max(0, now - rec.start)), rec.kind === 'overdub' ? 'Overdub' : 'Aufnahme', col, true);
    } else if (t.L) {
      const sg = segsFor(t.L);
      if (t.src) {
        const p = mod(now - anchor, t.L);
        ring(sg.S, p / t.L * sg.S, sg.perBar, tc, false);
        flash(p, tc);
        center(pos(p), 'Spur ' + (t.i + 1), tc, true);
      } else {
        ring(sg.S, sg.S, sg.perBar, tc, true);
        center('■', 'Gestoppt', C.muted, false);
      }
    } else {
      ring(4, 0, 0, C.line, true);
      center('–', 'Leer', C.muted, false);
    }
  }

  function drawWave(t, C) {
    const f = fit(t.wave); if (!f) return;
    const { ctx, w, h } = f, tc = C.t[t.i], dpr = window.devicePixelRatio || 1;
    if (!t.L || !t.mix) {
      ctx.strokeStyle = C.line; ctx.setLineDash([4, 4]); ctx.strokeRect(0.5, 0.5, w - 1, h - 1); ctx.setLineDash([]);
      return;
    }
    // eine Spalte je Gerätepixel, Spitzen aus den 64er-Blöcken (jeder Abtastwert zählt, nichts wird übersprungen)
    const n = Math.max(1, Math.round(w * dpr));
    if (!t.peaks || t.peaks.length !== n * 2 || t.peaksFor !== t.mix) {
      blockPeaks(t);
      t.peaks = new Float32Array(n * 2); t.peaksFor = t.mix;
      const step = t.L / n;
      for (let x = 0; x < n; x++) { t.peaks[x] = peakRange(t, x * step, (x + 1) * step, 'l') / t.bpMax; t.peaks[n + x] = peakRange(t, x * step, (x + 1) * step, 'r') / t.bpMax; }
    }
    ctx.fillStyle = tc; ctx.globalAlpha = t.src ? 0.22 : 0.1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, w, h, 4) : ctx.rect(0, 0, w, h); ctx.fill();
    ctx.globalAlpha = t.src ? 0.95 : 0.45;
    const cw = 1 / dpr, mid = h / 2, amp = (h - 4) / 2;
    for (let x = 0; x < n; x++) { const up = Math.max(cw * 0.5, t.peaks[x] * amp), dn = Math.max(cw * 0.5, t.peaks[n + x] * amp); ctx.fillRect(x * cw, mid - up, cw, up + dn); }
    ctx.globalAlpha = 1;
    // Raster aus der Erkennung: Takte als Linie, Schläge als kurze Striche oben und unten
    const bt = trackBeats(t), barPx = bt.length > 4 ? (bt[4].f - bt[0].f) / t.L * w : w;
    if (barPx >= 6) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      bt.forEach(b => { if (b.f <= 1 || b.f >= t.L - 1) return; const x = Math.round(b.f / t.L * w * dpr) / dpr;
        if (b.bar) ctx.fillRect(x, 0, cw * Math.max(1, Math.round(dpr)), h);
        else if (barPx >= 40) { ctx.fillRect(x, 0, cw, 4); ctx.fillRect(x, h - 4, cw, 4); } });
    }
    if (t.src) { const ph = mod(playFrame() - anchor, t.L) / t.L; const x = Math.round(ph * w * dpr) / dpr; ctx.fillStyle = C.ink; ctx.fillRect(x - 1, 0, 2, h); }
  }

  let lastDraw = 0;
  const panelEl = $('panel-looper');
  function tick() {
    rafId = null;
    const nowMs = performance.now();
    const visible = !panelEl.hidden && !document.hidden;
    if (visible) watchJank(nowMs);
    if (visible && nowMs - lastDraw >= (window.__lite ? 66 : 33)) {      // höchstens 30 (sparsam 15) Bilder pro Sekunde
      lastDraw = nowMs;
      const C = css || (css = colors());
      tracks.forEach(t => { drawRing(t, C); drawWave(t, C); });
      tracks.forEach(t => {                       // Spurkopf rechts: klingender und kommender Akkord
        const c = t.chords, has = !!(t.src && c && c.L === t.L && c.segs.some(q => q.name !== '–'));
        const i = has ? chordAt(t, mod(playFrame() - anchor, t.L)) : -1;
        const nm = i >= 0 ? c.segs[i].name : null;
        if (nm === t.chdName) return;
        t.chdName = nm; if (!t.thC) return;
        t.thC.hidden = nm == null;
        if (nm == null) return;
        t.chdB.lastChild.textContent = nm; t.chdB.classList.toggle('rest', nm === '–');
        const nx = nextChord(c, i);
        t.chnB.hidden = !nx; if (nx) t.chnB.lastChild.textContent = nx;
      });
      drawEditor(C);
      const bgS = (meterEl.parentNode.clientWidth || 200) + 'px 100%', hot = !!rec && !rec.armed;
      if (stereoSeen) {
        meterEl.style.width = (toMeter(levelL) * 100) + '%';
        meterR.style.width = (toMeter(levelR) * 100) + '%'; meterR.style.backgroundSize = bgS; meterR.classList.toggle('hot', hot);
      } else meterEl.style.width = (toMeter(level) * 100) + '%';
      meterEl.style.backgroundSize = bgS;
      meterEl.classList.toggle('hot', hot);
      threshMark.style.left = (toMeter(threshold()) * 100) + '%';
      const th = toMeter(threshold()) * 100;
      tracks.forEach(t => {
        const live = !!(rec && rec.t === t);
        let lvL, lvR;
        const showPlay = !!(t.src && t.L && t.mix && !live && audioCtx);
        if (showPlay) {
          const g = parseInt(t.vol.value) / 100, now = nowFrame() - Math.round(((audioCtx.outputLatency || 0) + (audioCtx.baseLatency || 0)) * sr);
          const p1 = mod(now - anchor, t.L), win = Math.min(t.L, Math.round(sr / 25)), ml = t.mix.l, mr = t.mix.r;
          let a = 0, b = 0;
          for (let k = 0; k < win; k += 2) { const j = (p1 - k + t.L) % t.L, x = ml[j], y = mr[j]; const ax = x < 0 ? -x : x, ay = y < 0 ? -y : y; if (ax > a) a = ax; if (ay > b) b = ay; }
          t.plL = Math.max((t.plL || 0) * 0.8, a * g); t.plR = Math.max((t.plR || 0) * 0.8, b * g);
          lvL = toMeter(t.plL) * 100; lvR = toMeter(t.plR) * 100;
        } else {
          t.plL = t.plR = 0;
          lvL = toMeter(levelL * t.inGain) * 100; lvR = toMeter(levelR * t.inGain) * 100;
        }
        t.meter.classList.toggle('play', showPlay);
        t.pkL = lvL >= t.pkL ? lvL : Math.max(lvL, t.pkL - 1.2);
        t.pkR = lvR >= t.pkR ? lvR : Math.max(lvR, t.pkR - 1.2);
        t.peakHold = Math.max(t.pkL, t.pkR);
        t.mL.style.setProperty('--lv', lvL.toFixed(1) + '%'); t.mL.style.setProperty('--pk', t.pkL.toFixed(1) + '%');
        t.mR.style.setProperty('--lv', lvR.toFixed(1) + '%'); t.mR.style.setProperty('--pk', t.pkR.toFixed(1) + '%');
        t.meter.style.setProperty('--th', th.toFixed(1) + '%');
        const mh = t.meter.clientHeight; if (mh && mh !== t.mh) { t.mh = mh; t.meter.style.setProperty('--mh', (mh - 6) + 'px'); }
        t.meter.classList.toggle('clip', lvL > 98 || lvR > 98);
        t.meter.closest('.track').classList.toggle('rec-live', live);
        t.meter.classList.toggle('live', live);
        t.meter.classList.toggle('armed', live && rec.armed);
      });
      level *= 0.8; levelL *= 0.8; levelR *= 0.8;
    }
    tracks.forEach(t => { if (t.foot.dataset.state !== footState(t)) update(); });
    const active = anyRunning() || rec || level > 0.001 || tracks.some(t => t.peakHold > 0.5) || ed.drag || countEnd > nowFrame();
    if (active) { if (visible) rafId = requestAnimationFrame(tick); else { rafId = 1; setTimeout(() => { rafId = null; tick(); }, 250); } }
  }
  tracks.forEach(t => { new ResizeObserver(kick).observe(t.ring); new ResizeObserver(kick).observe(t.wave); });
  new ResizeObserver(kick).observe($('edWave')); new ResizeObserver(kick).observe($('edOver'));

  // ---- Spur-Editor: Schneiden, Synchronisieren, Tonart ----
  const ed = { t: null, s: 0, e: 0, drag: null, lastOp: null, offMs: 0, peaks: null, peaksFor: null, peaksW: 0, zoom: 1, v0: 0 };
  const edEl = $('loopEditor'), edCv = $('edWave');
  const others = t => tracks.filter(o => o !== t && o.L);
  // Speicher im Blick: Alles, was nur noch fürs Rückgängig gebraucht wird, darf höchstens HIST_MB belegen
  const HIST_MB = 160;
  function audioBytes(x, seen) { let b = 0; if (!x) return 0; for (const a of [x.l, x.r]) if (a && !seen.has(a.buffer)) { seen.add(a.buffer); b += a.byteLength; } return b; }
  function memState() {
    const cur = new Set(); let curB = 0;
    tracks.forEach(t => { t.layers.forEach(ly => { curB += audioBytes(ly, cur); }); curB += audioBytes(t.mix, cur); if (t.orig) curB += audioBytes(t.orig.data, cur); });
    const seen = new Set(cur); let histB = 0;
    tracks.forEach(t => t.hist.forEach(sn => { sn.layers.forEach(ly => { histB += audioBytes(ly, seen); }); if (sn.od) histB += audioBytes(sn.od.data, seen); }));
    return { curMB: curB / 1048576, histMB: histB / 1048576 };
  }
  function trimHistory() {
    let m = memState(), dropped = 0;
    while (m.histMB > HIST_MB) {
      let oldest = null;
      tracks.forEach(t => { if (t.hist.length && (!oldest || t.hist[0].ts < oldest.hist[0].ts)) oldest = t; });
      if (!oldest) break;
      oldest.hist.shift(); dropped++; m = memState();
    }
    if (dropped && !trimHistory.told) { trimHistory.told = true; setTimeout(() => setStatus('Speicher schonen: ältere Rückgängig-Schritte wurden verworfen (lange Loops brauchen viel Platz).'), 50); }
    return m;
  }
  function snapshot(t) { t.hist.push({ ts: performance.now(), layers: t.layers.slice(), L: t.L, baseL, origPos: t.origPos, origBars: t.origBars, od: t.orig ? { downs: t.orig.downs, bars: t.orig.bars, data: t.orig.data, bpm: t.orig.bpm, barMed: t.orig.barMed } : null }); if (t.hist.length > 25) t.hist.shift(); trimHistory(); }
  // Ein Rückgängig-Schritt pro Aktion; mehrere Verschiebungen hintereinander zählen als einer
  function edSnap(op) { if (!(op === 'nudge' && ed.lastOp === 'nudge')) snapshot(ed.t); ed.lastOp = op; }
  function fmtLen(L) {
    const bars = L / barFrames(), rb = Math.round(bars);
    return (L / sr).toFixed(2).replace('.', ',') + ' s · ' + (Math.abs(bars - rb) < 0.03 ? rb + ' Takt' + (rb === 1 ? '' : 'e') : bars.toFixed(2).replace('.', ',') + ' Takte');
  }
  function openEditor(t) {
    if (!t.L || (rec && rec.t === t)) return;
    ed.t = t; ed.s = 0; ed.e = t.L; ed.lastOp = null; ed.offMs = 0; ed.peaks = null; ed.zoom = 1; ed.v0 = 0; showZoom();
    edEl.hidden = false;
    edEl.style.setProperty('--tc', NEON.t[t.i]);
    $('edTitle').textContent = 'Spur ' + (t.i + 1) + ' bearbeiten';
    showKey(); showEdChords(); fillSrc(); edInfo(); update(); kick();
    try { edEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
  }
  function closeEditor() { ed.t = null; ed.drag = null; edEl.hidden = true; update(); }
  function edInfo() {
    if (!ed.t) return;
    $('edInfo').textContent = 'Auswahl ' + fmtLen(ed.e - ed.s) + ' von ' + fmtLen(ed.t.L);
    $('edOffset').textContent = 'Versatz ' + (ed.offMs > 0 ? '+' : '') + Math.round(ed.offMs) + ' ms';
    $('edTrim').disabled = ed.s === 0 && ed.e === ed.t.L;
  }
  // Takt-Einsen der Spur in Loop-Koordinaten: aus dem erkannten Raster (folgt dem Gespielten), sonst aus dem Tempo
  function trackDowns(t) {
    if (t.orig && t.origPos != null) {
      const d = t.orig.downs.map(x => x - t.origPos).filter(x => x > -2 && x < t.L + 2);
      if (d.length >= 2) {
        const bm = t.orig.barMed || (d[1] - d[0]);
        while (d[0] > bm * 0.5) d.unshift(d[0] - bm);
        while (d[d.length - 1] < t.L - bm * 0.5) d.push(d[d.length - 1] + bm);
        return d;
      }
    }
    const bf = barOf(t.L), d = []; for (let k = 0; k * bf <= t.L + 1; k++) d.push(k * bf);
    if (d[d.length - 1] < t.L - 1) d.push(d[d.length - 1] + bf);
    return d;
  }
  // Schläge der Spur in Loop-Koordinaten: erkannte Schläge der Datei (folgen dem Gespielten), sonst gleichmäßig je Takt
  function trackBeats(t) {
    const key = t.L + '|' + t.origPos + '|' + bpm() + '|' + (t.orig ? t.orig.downs.length + ':' + t.orig.downs[0] : '-');
    if (t._tb && t._tbKey === key && t._tbOrig === t.orig) return t._tb;
    const d = trackDowns(t), out = [];
    const src = t.orig && t.origPos != null && t.orig.beats && t.orig.beats.length > 4 ? t.orig.beats : null;
    let j = 0;
    for (let i = 0; i + 1 < d.length; i++) for (let k = 0; k < 4; k++) {
      let f = d[i] + (d[i + 1] - d[i]) * k / 4;
      if (src && k) {
        const want = f + t.origPos, tol = (d[i + 1] - d[i]) / 16;
        while (j + 1 < src.length && src[j + 1] <= want) j++;
        let bestF = null; for (const q of [src[j], src[j + 1]]) if (q != null && Math.abs(q - want) < tol && (bestF == null || Math.abs(q - want) < Math.abs(bestF - want))) bestF = q;
        if (bestF != null) f = bestF - t.origPos;
      }
      out.push({ f, bar: k === 0 });
    }
    t._tb = out; t._tbKey = key; t._tbOrig = t.orig;
    return out;
  }
  function gridPoints(sub) {
    const d = trackDowns(ed.t), pts = [];
    if (sub === 4) { trackBeats(ed.t).forEach(b => pts.push(b.f)); pts.push(d[d.length - 1]); return pts; }
    for (let i = 0; i + 1 < d.length; i++) for (let k = 0; k < sub; k++) pts.push(d[i] + (d[i + 1] - d[i]) * k / sub);
    pts.push(d[d.length - 1]);
    return pts;
  }
  function snapF(f) {
    const g = $('edGrid').value, L = ed.t.L;
    if (g === 'free') return Math.round(f);
    const pts = gridPoints(g === 'bar' ? 1 : g === 'beat' ? 4 : 8);
    let best = 0, bd = Infinity;
    for (const p of pts) { const q = Math.abs(p - f); if (q < bd) { bd = q; best = p; } }
    return Math.max(0, Math.min(L, Math.round(best)));
  }
  // Passt eine neue Länge nicht zu den anderen Spuren, wird sie auf ein Vielfaches des Loops gerundet
  function fitLength(t, L) {
    const os = others(t);
    if (!os.length) return { L, base: L };
    if (L < baseL && os.every(o => o.L % L === 0)) return { L, base: L };
    return { L: Math.max(1, Math.round(L / baseL)) * baseL, base: baseL };
  }
  function padTo(a, L) { if (a.length === L) return a; const o = new Float32Array(L); o.set(a.subarray(0, Math.min(L, a.length))); return o; }
  const padS = (x, L) => x.length === L ? x : smap(x, a => padTo(a, L));
  function afterEdit(t, restartFromTop) {
    rebuildMix(t);
    if (t.src) { if (restartFromTop && !others(t).length) anchor = nowFrame(); startTrack(t); }
    ed.s = 0; ed.e = t.L; ed.zoom = 1; ed.v0 = 0; showZoom(); edInfo(); update(); kick();
  }

  function trimTo(s0, e0, label) {
    const t = ed.t, len = e0 - s0;
    if (len < sr * 0.1) { setStatus('Die Auswahl ist zu kurz.'); return; }
    const f = fitLength(t, len);
    edSnap('trim');
    t.layers = [smap(t.mix, a => padTo(a.slice(s0, s0 + Math.min(len, f.L)), f.L))];
    t.L = f.L; baseL = f.base;
    if (t.origPos != null) t.origPos += s0;
    afterEdit(t, true);
    setStatus('Spur ' + (t.i + 1) + ' ' + label + ': ' + fmtLen(t.L) + (f.L !== len ? ' (an die anderen Spuren angepasst)' : '') + '.');
    detectTrackKey(t);
  }
  $('edTrim').addEventListener('click', () => ed.t && trimTo(ed.s, ed.e, 'zugeschnitten'));
  $('edHalf').addEventListener('click', () => ed.t && trimTo(0, Math.round(ed.t.L / 2), 'halbiert'));
  $('edDouble').addEventListener('click', () => {
    const t = ed.t; if (!t) return;
    const f = fitLength(t, t.L * 2);
    if (f.L > sr * 360) { setStatus('Verdoppeln geht nicht: Die Spur wäre länger als 6 Minuten (zu viel für den Speicher des iPads).'); return; }
    edSnap('double');
    t.layers = [smap(t.mix, a => { const d = new Float32Array(a.length * 2); d.set(a, 0); d.set(a, a.length); return padTo(d, f.L); })]; t.L = f.L; baseL = f.base;
    afterEdit(t, false);
    setStatus('Spur ' + (t.i + 1) + ' verdoppelt: ' + fmtLen(t.L) + '.');
  });

  // Feinabgleich: Anschläge der Spur auf die der Referenz legen (Kreuzkorrelation, höchstens ±60 ms bzw. 1/8 Schlag).
  // Anschlagkurve: logarithmischer Energieanstieg in 1-ms-Blöcken – Gitarre, Bass und Drums lassen sich so vergleichen,
  // weil nur der Beginn eines Tons zählt, nicht seine Lautstärke oder Länge.
  function alignEnv(x, D) {
    const n = Math.floor(x.length / D), e = new Float32Array(n); let prev = 0;
    for (let i = 0; i < n; i++) { let q = 0; for (let j = i * D, je = j + D; j < je; j++) { const v = x[j], y = v - 0.95 * prev; prev = v; q += y * y; } e[i] = q / D; }
    const so = Float32Array.from(e).sort(), floor = (so[n >> 1] || 0) * 0.05 + 1e-12;
    const lag = Math.max(1, Math.round(0.006 * sr / D)), o = new Float32Array(n);
    for (let i = 0; i < n; i++) { const d = Math.log(e[i] + floor) - Math.log(e[(i - lag + n) % n] + floor); o[i] = d > 0 ? d : 0; }
    const w = Math.max(1, Math.round(0.0015 * sr / D)), sm = new Float32Array(n);
    for (let i = 0; i < n; i++) { let q = 0; for (let k = -w; k <= w; k++) q += o[(i + k + n) % n]; sm[i] = q; }
    return sm;
  }
  function fineAlign(t, refs) {
    const os = (refs || others(t)).filter(o => o !== t && o.L && o.mix); if (!os.length || !t.mix) return null;
    const D = Math.max(8, Math.round(sr / 1000)), et = alignEnv(monoOf(t.mix), D), n = et.length;
    const ref = new Float32Array(n);
    os.forEach(o => { const eo = alignEnv(monoOf(o.mix), D), no = eo.length; for (let i = 0; i < n; i++) ref[i] += eo[i % no]; });
    let mt = 0, mr = 0; for (let i = 0; i < n; i++) { mt += et[i]; mr += ref[i]; } mt /= n; mr /= n;
    let st = 0, sr2 = 0; for (let i = 0; i < n; i++) { st += (et[i] - mt) ** 2; sr2 += (ref[i] - mr) ** 2; }
    const norm = Math.sqrt(st * sr2) || 1;
    const cc = lag => { let c = 0; for (let i = 0; i < n; i++) c += (et[(i + lag + n) % n] - mt) * (ref[i] - mr); return c / norm; };
    const R = Math.max(2, Math.round(Math.min(0.06, 60 / bpm() / 8) * sr / D));
    const v = new Float32Array(2 * R + 1); for (let l = -R; l <= R; l++) v[l + R] = cc(l);
    let best = 0; for (let l = -R; l <= R; l++) if (v[l + R] > v[best + R]) best = l;
    let frac = 0;
    if (best > -R && best < R) { const a = v[best + R - 1], b = v[best + R], c = v[best + R + 1], den = a - 2 * b + c; if (den < 0) frac = Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)); }
    return { lagF: (best + frac) * D, ncc: v[best + R], gain: v[best + R] - v[R], edge: Math.abs(best) >= R - 1 };
  }
  function rotateTrack(t, k) {
    k = Math.round(k); if (!k) return;
    t.layers = t.layers.map(ly => smap(ly, a => { const L = a.length, kk = mod(k, L), o = new Float32Array(L); o.set(a.subarray(L - kk), 0); o.set(a.subarray(0, L - kk), kk); return o; }));
    if (t.origPos != null) t.origPos -= k;
    rebuildMix(t); if (t.src) startTrack(t);
  }
  // Ergebnis prüfen: nur echte, klare Spitzen im Suchbereich (nicht am Rand, deutlich besser als ohne Verschiebung)
  const alignOk = r => r && !r.edge && r.ncc >= 0.25 && r.gain >= 0.02 && Math.abs(r.lagF / sr * 1000) >= 2;
  function autoAlign(t, quiet, refs) {
    const r = fineAlign(t, refs);
    if (!r) { if (!quiet) setStatus('Feinabgleich braucht mindestens eine weitere Spur.'); return null; }
    const ms = r.lagF / sr * 1000;
    if (!alignOk(r)) { if (!quiet) setStatus('Spur ' + (t.i + 1) + ' sitzt schon genau auf den anderen Spuren' + (r.ncc < 0.25 ? ' (kaum gemeinsame Anschläge zum Vergleichen).' : '.')); return 0; }
    if (!quiet) snapshot(t);
    rotateTrack(t, -r.lagF);
    if (ed.t === t) { ed.offMs -= ms; edInfo(); }
    return ms;
  }
  // Neue Aufnahme auf Spur 2/3: automatisch an Spur 1 angleichen (rückgängig machbar)
  function alignNewTake(t) {
    if (!autoAlignEl.checked) return '';
    const refs = tracks[0] !== t && tracks[0].L ? [tracks[0]] : others(t);
    if (!refs.length) return '';
    const r = fineAlign(t, refs);
    if (!alignOk(r)) return '';
    snapshot(t);
    rotateTrack(t, -r.lagF);
    const ms = r.lagF / sr * 1000, who = refs.length === 1 && refs[0] === tracks[0] ? 'Spur 1' : 'die anderen Spuren';
    return ' Timing an ' + who + ' angeglichen (' + (ms > 0 ? Math.round(ms) + ' ms früher' : Math.round(-ms) + ' ms später') + ', ↶ nimmt es zurück).';
  }

  // Verschieben (rotiert den Loop in sich, alle Overdubs mit)
  function rotate(k) {
    const t = ed.t; if (!t) return;
    k = Math.round(k); if (!k) return;
    edSnap('nudge');
    t.layers = t.layers.map(ly => smap(ly, a => {
      const L = a.length, kk = mod(k, L), o = new Float32Array(L);
      o.set(a.subarray(L - kk), 0); o.set(a.subarray(0, L - kk), kk);
      return o;
    }));
    ed.offMs += k / sr * 1000;
    if (t.origPos != null) t.origPos -= k;
    rebuildMix(t); if (t.src) startTrack(t);
    edInfo(); kick();
  }
  edEl.querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.nudge;
    rotate(v === 'beat' ? beatFrames() : v === '-beat' ? -beatFrames() : parseFloat(v) / 1000 * sr);
  }));
  $('edAlign').addEventListener('click', () => {
    const t = ed.t; if (!t) return;
    const ms = autoAlign(t, false);
    if (ms) setStatus('Spur ' + (t.i + 1) + ' fein angeglichen: ' + (ms > 0 ? Math.round(ms) + ' ms früher' : Math.round(-ms) + ' ms später') + ' – die Anschläge liegen jetzt auf denen der anderen Spuren.');
    kick();
  });
  $('edAuto').addEventListener('click', () => {
    const t = ed.t; if (!t) return;
    const x = monoOf(t.mix), win = Math.max(1, Math.round(sr * 0.005)), env = [];
    let max = 0;
    for (let i = 0; i < x.length; i += win) {
      let p = 0; const end = Math.min(x.length, i + win);
      for (let j = i; j < end; j++) { const v = x[j] < 0 ? -x[j] : x[j]; if (v > p) p = v; }
      env.push(p); if (p > max) max = p;
    }
    if (max < 1e-3) { setStatus('Die Spur ist zu leise für Auto-Sync.'); return; }
    let idx = env.findIndex(v => v > max * 0.3);
    while (idx > 0 && env[idx - 1] > max * 0.06) idx--;
    let first = idx <= 0 ? 0 : idx * win - Math.round(sr * 0.008);
    if (first > t.L / 2) first -= t.L;
    if (Math.abs(first) < sr * 0.003) { setStatus('Der erste Ton sitzt schon auf dem Loopanfang.'); return; }
    rotate(-first);
    setStatus('Spur ' + (t.i + 1) + ': erster Ton auf den Loopanfang geschoben (' + Math.round(-first / sr * 1000) + ' ms).');
  });

  // An die Loop-Länge anpassen (strecken/stauchen, Tonhöhe ändert sich dabei leicht)
  // Zeitdehnung ohne Tonhöhenänderung (WSOLA), als Schleife gelesen und geschrieben → nahtloser Loop
  // Stereo: die Schnittpositionen werden aus der Mono-Summe bestimmt und auf beide Kanäle gleich angewendet –
  // so bleiben Stereobild und Phase zwischen links und rechts erhalten.
  function stretch(x, n) {
    if (x && x.l) {
      if (n === x.length) return smap(x, a => a.slice());
      const pos = wsolaPos(monoOf(x), n), a = wsolaApply(x.l, n, pos);
      return SP(a, x.r === x.l ? a : wsolaApply(x.r, n, pos));
    }
    if (n === x.length) return x.slice();
    return wsolaApply(x, n, wsolaPos(x, n));
  }
  const wsolaW = () => sr > 30000 ? 2048 : 1024;
  function wsolaPos(x, n) {
    const m = x.length, W = wsolaW(), Hs = W >> 1, Ha = Hs * m / n, D = W >> 2;
    const X = i => x[((i % m) + m) % m];
    const corr = (a, b, step) => { let s = 0; for (let i = 0; i < Hs; i += step) s += X(a + i) * X(b + i); return s; };
    const frames = Math.ceil(n / Hs), pos = new Int32Array(frames);
    let prev = 0;
    for (let k = 0; k < frames; k++) {
      const nominal = Math.round(k * Ha);
      let p = nominal;
      if (k > 0) {
        const nat = prev + Hs; let best = -Infinity, bd = 0;
        for (let d = -D; d <= D; d += 8) { const c = corr(nat, nominal + d, 4); if (c > best) { best = c; bd = d; } }
        const c0 = bd; best = -Infinity;
        for (let d = c0 - 8; d <= c0 + 8; d++) { const c = corr(nat, nominal + d, 2); if (c > best) { best = c; bd = d; } }
        p = nominal + bd;
      }
      pos[k] = p; prev = p;
    }
    return pos;
  }
  function wsolaApply(x, n, pos) {
    const m = x.length, W = wsolaW(), Hs = W >> 1;
    const win = new Float32Array(W); for (let i = 0; i < W; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / W);
    const out = new Float32Array(n), wsum = new Float32Array(n);
    for (let k = 0; k < pos.length; k++) {
      const o = k * Hs, p = pos[k];
      for (let i = 0; i < W; i++) { const j = (o + i) % n; out[j] += x[(((p + i) % m) + m) % m] * win[i]; wsum[j] += win[i]; }
    }
    for (let i = 0; i < n; i++) if (wsum[i] > 1e-6) out[i] /= wsum[i];
    return out;
  }
  function resample(ly, n) {
    if (ly && ly.l) return smap(ly, a => resample(a, n));
    const o = new Float32Array(n), r = ly.length / n, last = ly.length - 1;
    for (let i = 0; i < n; i++) { const x = i * r, j = Math.floor(x), f = x - j; o[i] = ly[j] * (1 - f) + ly[j < last ? j + 1 : last] * f; }
    return o;
  }
  $('edFit').addEventListener('click', () => {
    const t = ed.t; if (!t) return;
    const os = others(t);
    const unit = os.length ? baseL : barFrames();
    const target = Math.max(1, Math.round(t.L / unit)) * unit, ratio = target / t.L;
    if (Math.abs(ratio - 1) < 0.0005) { setStatus('Die Länge passt bereits genau.'); return; }
    if (Math.abs(ratio - 1) > 0.35) { setStatus('Der Unterschied ist größer als 35 %. Schneide die Spur zuerst ungefähr passend zu.'); return; }
    edSnap('fit');
    t.layers = t.layers.map(ly => stretch(ly, target));
    t.L = target; if (!os.length) baseL = target;
    t.origPos = null;
    afterEdit(t, true);
    setStatus('Spur ' + (t.i + 1) + ' auf ' + fmtLen(target) + ' angepasst – Tempo gedehnt, Tonhöhe bleibt.');
  });

  // Tempo so setzen, dass die Spur genau eine ganze Zahl von Takten lang ist
  $('edTempo').addEventListener('click', () => {
    const t = ed.t; if (!t) return;
    const secs = t.L / sr, cur = bpm();
    let best = null;
    [1, 2, 3, 4, 6, 8, 12, 16].forEach(nb => {
      const b = nb * 240 / secs;
      if (b >= 40 && b <= 200 && (!best || Math.abs(b - cur) < Math.abs(best.b - cur))) best = { nb, b };
    });
    if (!best) { setStatus('Für diese Länge passt kein Tempo zwischen 40 und 200 BPM.'); return; }
    setTempo(best.b);
    setStatus('Tempo ' + bpmTxt(best.b) + ' BPM: Spur ' + (t.i + 1) + ' entspricht ' + best.nb + ' Takt' + (best.nb === 1 ? '' : 'en') + '. Drums und Taktkreis laufen jetzt passend.');
    edInfo(); update(); kick();
  });

  // Taktraster der geladenen Datei mit umrechnen: 2× = jeder Takt wird zu zwei Takten, ½ = zwei Takte werden einer
  function regridOrig(t, factor) {
    const o = t.orig; if (!o) return;
    let d = o.downs;
    if (factor === 2) { const nd = []; for (let i = 0; i < d.length - 1; i++) nd.push(d[i], Math.round((d[i] + d[i + 1]) / 2)); nd.push(d[d.length - 1]); d = nd; }
    else {
      let keep = 0;
      if (t.origPos != null) { let bi = 0, bd = Infinity; d.forEach((x, i) => { const q = Math.abs(x - t.origPos); if (q < bd) { bd = q; bi = i; } }); keep = bi % 2; }
      d = d.filter((_, i) => i % 2 === keep);
    }
    if (d.length < 2) return;
    o.downs = d; o.bars = d.length - 1; o.bpm *= factor; o.barMed = (d[d.length - 1] - d[0]) / o.bars;
    fillSrc();
  }
  $('edTempoHalf').addEventListener('click', () => {
    const v = bpm() / 2; if (v < 40) return;
    setTempo(v); if (ed.t) regridOrig(ed.t, 0.5);
    setStatus('Tempo halbiert: ' + bpmTxt(v) + ' BPM' + (ed.t && ed.t.orig ? ', Taktraster der Datei angepasst (' + ed.t.orig.bars + ' Takte).' : '.')); edInfo(); kick();
  });
  $('edTempoDouble').addEventListener('click', () => {
    const v = bpm() * 2; if (v > 240) return;
    setTempo(v); if (ed.t) regridOrig(ed.t, 2);
    setStatus('Tempo verdoppelt: ' + bpmTxt(v) + ' BPM' + (ed.t && ed.t.orig ? ', Taktraster der Datei angepasst (' + ed.t.orig.bars + ' Takte).' : '.')); edInfo(); kick();
  });

  // ---- Loop prüfen und nacharbeiten ----
  async function checkLoop(t) {
    if (!t || !t.L) return null;
    const ref = t.mix;
    const lp = await Analyzer.loop(chans(t.mix), sr, { hintBpm: bpm() });
    if (t.mix !== ref) return null;                            // inzwischen geändert
    return { lp, click: seamClickS(t.mix) };
  }
  function showCheck(res) {
    const box = $('edCheckRes');
    if (!res || !res.lp || res.lp.confidence < 2) {
      box.innerHTML = '<li class="warn">Kein klarer Takt in dieser Spur erkennbar (zu leise oder ohne Rhythmus).</li>';
      return { ok: false };
    }
    const lp = res.lp, items = [];
    const lenOk = Math.abs(lp.lenErrMs) < 8, offMs = lp.downOffsetSec * 1000, startOk = Math.abs(offMs) < 15, seamOk = res.click < 1;
    items.push([lenOk, 'Länge: ' + lp.bars + ' Takt' + (lp.bars === 1 ? '' : 'e') + (lenOk ? ', genau' : ', ' + (lp.lenErrMs > 0 ? '+' : '') + Math.round(lp.lenErrMs) + ' ms daneben')]);
    items.push([startOk, 'Takt 1: ' + (startOk ? 'liegt am Loopanfang' : 'liegt ' + Math.abs(Math.round(offMs)) + ' ms ' + (offMs > 0 ? 'nach' : 'vor') + ' dem Anfang')]);
    items.push([seamOk, 'Übergang Ende → Anfang: ' + (seamOk ? 'sauber' : 'möglicher Knackser')]);
    items.push([true, 'Tempo im Loop: ' + bpmTxt(lp.bpm) + ' BPM' + (lp.startKept ? ' · Takt 1 = Loopanfang angenommen' : '')]);
    box.innerHTML = items.map(([ok, txt]) => '<li class="' + (ok ? 'ok' : 'warn') + '">' + (ok ? '✓ ' : '⚠ ') + txt + '</li>').join('');
    return { ok: lenOk && startOk && seamOk };
  }
  // Knackser am Übergang: Sprung Ende→Anfang deutlich größer als die Bewegung der Wellenform direkt davor/danach
  function seamClick(x) {
    const n = x.length; if (n < 80) return 0;
    let loc = 0;
    for (let i = 0; i < 32; i++) { loc = Math.max(loc, Math.abs(x[i + 1] - x[i]), Math.abs(x[n - 1 - i] - x[n - 2 - i])); }
    const jump = Math.abs(x[0] - x[n - 1]);
    return jump < 0.01 ? 0 : jump / (3 * Math.max(loc, 1e-4));
  }
  const seamClickS = x => x.r === x.l ? seamClick(x.l) : Math.max(seamClick(x.l), seamClick(x.r));
  function microFade(ly) {
    if (ly && ly.l) return smap(ly, microFade);
    const n = Math.min(Math.round(sr * 0.003), ly.length >> 2), o = ly.slice();
    for (let i = 0; i < n; i++) { const g = i / n; o[i] *= g; o[o.length - 1 - i] *= g; }
    return o;
  }
  $('edCheck').addEventListener('click', async () => {
    const t = ed.t; if (!t) return;
    $('edCheckRes').innerHTML = '<li>Prüfe Takt, Länge und Übergang …</li>';
    const res = await checkLoop(t);
    const v = showCheck(res);
    setStatus(v.ok ? 'Spur ' + (t.i + 1) + ': Loop geprüft, alles passt.' : 'Spur ' + (t.i + 1) + ': Loop geprüft. „Nacharbeiten“ korrigiert die markierten Punkte.');
  });
  $('edFix').addEventListener('click', async () => {
    const t = ed.t; if (!t) return;
    $('edCheckRes').innerHTML = '<li>Analysiere und arbeite nach …</li>';
    const res = await checkLoop(t);
    if (!res || !res.lp || res.lp.confidence < 2) { showCheck(res); setStatus('Nacharbeiten nicht möglich: kein klarer Takt in der Spur.'); return; }
    const lp = res.lp, os = others(t);
    edSnap('fix');
    const steps = [];
    if (t.orig && t.origPos != null) {
      // Aus dem Original neu schneiden: nächste echte Takt-Eins, ganze Takte nach dem Raster der Datei
      const o = t.orig, target = t.origPos;
      let bi = 0, bd = Infinity;
      for (let i = 0; i < o.downs.length - 1; i++) { const d = Math.abs(o.downs[i] - target); if (d < bd) { bd = d; bi = i; } }
      // Taktzahl: Ende der Auswahl ebenfalls auf die nächste Eins
      const endPos = t.origPos + t.L;
      let ei = bi + 1, ed2 = Infinity;
      for (let i = bi + 1; i < o.downs.length; i++) { const d = Math.abs(o.downs[i] - endPos); if (d < ed2) { ed2 = d; ei = i; } }
      const nb = Math.max(1, Math.min(ei - bi, o.bars - bi));
      const r = placeExcerpt(t, bi + 1, nb);
      t.layers = [r.seg]; t.L = r.L;
      steps.push('aus der Datei neu geschnitten: ' + r.msg);
    } else {
      let layers = t.layers, L = t.L;
      const k = Math.round(-lp.downOffsetSec * sr);
      if (Math.abs(k) > sr * 0.003 && !lp.startKept) {
        layers = layers.map(ly => smap(ly, a => { const n = a.length, kk = mod(k, n), o = new Float32Array(n); o.set(a.subarray(n - kk), 0); o.set(a.subarray(0, n - kk), kk); return o; }));
        steps.push('Takt 1 an den Anfang gelegt');
      }
      if (!lp.isLoop) {
        const barF = L / lp.barsF, nb = Math.max(1, Math.floor(lp.barsF + 0.02)), target = Math.min(L, Math.round(nb * barF));
        layers = layers.map(ly => smap(ly, a => a.slice(0, target))); L = target;
        steps.push('auf ' + nb + ' ganze Takt' + (nb === 1 ? '' : 'e') + ' gekürzt');
      }
      const nbBars = Math.max(1, Math.round(lp.barsF));
      if (!os.length) {
        baseL = L; setTempo(240 * nbBars / (L / sr));
        steps.push('Tempo ' + bpmTxt(240 * nbBars / (L / sr)) + ' BPM übernommen');
      } else {
        const T = Math.max(1, Math.round(L / baseL)) * baseL, ratio = T / L;
        if (Math.abs(ratio - 1) > 0.0005 && Math.abs(ratio - 1) <= 0.35) { layers = layers.map(ly => stretch(ly, T)); steps.push('ins Tempo des Loops gedehnt (Tonhöhe bleibt)'); }
        else if (Math.abs(ratio - 1) > 0.35) { layers = layers.map(ly => padS(ly, T)); steps.push('auf Loop-Länge gebracht'); }
        L = T;
      }
      t.layers = layers; t.L = L;
    }
    { // Übergang erst nach dem Neuschnitt bewerten
      const m = S(t.L); t.layers.forEach(ly => { for (let i = 0; i < t.L; i++) { m.l[i] += ly.l[i]; m.r[i] += ly.r[i]; } });
      if (seamClickS(m) >= 1) { t.layers = t.layers.map(microFade); steps.push('Übergang geglättet'); }
    }
    afterEdit(t, true);
    detectTrackKey(t);
    // Ergebnis noch einmal prüfen und anzeigen
    const after = await checkLoop(t);
    const v = showCheck(after);
    setStatus('Spur ' + (t.i + 1) + ' nachgearbeitet: ' + (steps.length ? steps.join(', ') : 'nichts zu ändern') + '.' + (v.ok ? ' Geprüft: passt.' : ''));
  });

  // Tonart
  async function detectTrackKey(t) {
    if (!t.L) return null;
    scheduleChords(t);
    const xl = t.mix.l, xr = t.mix.r; let sum = 0, n = 0;
    for (let i = 0; i < xl.length; i += 16) { const v = (xl[i] + xr[i]) * 0.5; sum += v * v; n++; }
    if (Math.sqrt(sum / Math.max(1, n)) < 0.002) { t.key = null; showKey(); clearTimeout(t.chTimer); t.chords = null; showChords(t); return null; }
    const ref = t.mix;
    const r = await Analyzer.key(chans(ref), sr);
    if (t.mix !== ref) return t.key;            // inzwischen geändert – neues Ergebnis kommt
    t.key = r.error ? null : r;
    t.keyChroma = r.error ? null : { chroma: r.chroma, mix: ref };
    refineKey(t);
    showKey();
    return t.key;
  }
  // Tonart mit der Akkordfolge nachschärfen (Dur/Parallel-Moll, Tonika auf Takt 1, Kadenzen)
  function refineKey(t) {
    const kc = t.keyChroma, cr = t.chordRaw;
    if (!kc || !cr || kc.mix !== t.mix || cr.mix !== t.mix || typeof keyFromChords !== 'function') return false;
    const k = keyFromChords(cr.segs, kc.chroma, { loop: true, down: cr.down });
    if (!k || (t.key && t.key.pc === k.pc && t.key.major === k.major)) return false;
    t.key = Object.assign({}, t.key || {}, { pc: k.pc, major: k.major, score: k.score, byChords: true });
    return true;
  }
  function showKey() {
    tracks.forEach(t => {
      // neue oder geänderte Tonart melden (Quintenzirkel folgt sofort)
      const ks = t.key ? t.key.pc + (t.key.major ? 'M' : 'm') : '';
      if (ks !== (t.keySent || '')) { t.keySent = ks; document.dispatchEvent(new CustomEvent('trackkey', { detail: { track: t.i, key: t.key ? { pc: t.key.pc, major: !!t.key.major } : null } })); }
      t.keyB.hidden = !t.key;
      if (t.key) { t.keyB.innerHTML = '<small>Tonart</small>' + Analyzer.label(t.key).replace('-', ' '); t.keyB.title = 'Tonart ' + Analyzer.label(t.key) + ' für Griffbrett und Drone übernehmen'; }
    });
    if (ed.t) {
      $('edKeyRes').textContent = ed.t.key ? Analyzer.label(ed.t.key) : 'nicht erkannt';
      $('edKeyApply').hidden = !ed.t.key;
    }
  }
  // ---- Akkorde je Spur (im Hintergrund nach jeder Änderung, je Schlag erkannt) ----
  function scheduleChords(t, delay) {
    clearTimeout(t.chTimer);
    t.chTimer = setTimeout(() => { detectTrackChords(t).catch(() => {}); }, delay == null ? 300 : delay);
  }
  async function detectTrackChords(t) {
    if (!t.L || !t.mix) { t.chords = null; showChords(t); return null; }
    const ref = t.mix, bs = trackBeats(t).filter(b => b.f >= 0 && b.f < t.L);
    if (bs.length < 2) { t.chords = null; showChords(t); return null; }
    const down0 = Math.max(0, bs.findIndex(b => b.bar));
    const r = await Analyzer.chords(chans(ref), sr, bs.map(b => b.f / sr), { loop: true, downIndex: down0 });
    if (t.mix !== ref || !t.L) return t.chords;
    t.chords = r && r.segments && r.segments.length ? normChords(r.segments, t.L) : null;
    if (t.chords) t.chords.tune = r.tuneCents;
    t.chordRaw = t.chords ? { segs: r.segments, down: down0, mix: ref } : null;
    if (refineKey(t)) showKey();
    showChords(t); kick();
    return t.chords;
  }
  // Abschnitte auf [0, L) legen: was über das Loopende hinausreicht, beginnt vorn
  function normChords(segs, L) {
    const out = [];
    segs.forEach(q => {
      let a = Math.round(q.start * sr), e = Math.round(q.end * sr);
      if (a >= L) { a -= L; e -= L; }
      if (e > L) { out.push({ name: q.name, a, e: L }); out.push({ name: q.name, a: 0, e: e - L }); } else out.push({ name: q.name, a, e });
    });
    out.sort((p, q) => p.a - q.a);
    const m = [];
    out.forEach(q => { if (q.e - q.a < 1) return; const l = m[m.length - 1]; if (l && l.name === q.name && Math.abs(l.e - q.a) < 4) l.e = q.e; else m.push(Object.assign({}, q)); });
    return { segs: m, L };
  }
  function chordAt(t, f) { const c = t.chords; if (!c) return -1; for (let i = 0; i < c.segs.length; i++) if (f >= c.segs[i].a && f < c.segs[i].e) return i; return -1; }
  // nächster anderer Akkord nach Abschnitt i (über das Loop-Ende hinweg)
  function nextChord(c, i) {
    const n = c.segs.length, cur = c.segs[i].name;
    for (let k = 1; k < n; k++) { const q = c.segs[(i + k) % n].name; if (q !== '–' && q !== cur) return q; }
    return '';
  }
  function showChords(t) {
    t.chdName = undefined;                       // Spurkopf beim nächsten Bild neu setzen
    if (t.thC && !(t.chords && t.chords.L === t.L)) t.thC.hidden = true;
    if (ed.t === t) showEdChords();
  }
  // Im Editor: Akkorde je Takt als Zeile („Am | F | C G | …“)
  function showEdChords() {
    const el = $('edChords'), t = ed.t; if (!el || !t) return;
    const c = t.chords;
    if (!c || c.L !== t.L || !c.segs.some(q => q.name !== '–')) { el.textContent = 'Akkorde: ' + (t.L ? 'werden erkannt …' : '–'); return; }
    const d = trackDowns(t).filter(x => x > -2 && x < t.L - 2), bars = [];
    for (let i = 0; i < d.length; i++) {
      const a = Math.max(0, d[i]), e = i + 1 < d.length ? d[i + 1] : t.L, names = [];
      c.segs.forEach(q => { if (q.e > a + (e - a) * 0.12 && q.a < e - (e - a) * 0.12 && q.name !== '–' && names[names.length - 1] !== q.name) names.push(q.name); });
      bars.push(names.length ? names.join(' ') : '–');
    }
    el.innerHTML = 'Akkorde: <b>' + bars.join('</b> | <b>') + '</b>' + (Math.abs(c.tune || 0) >= 8 ? ' <span class="caption">(Stimmung ' + (c.tune > 0 ? '+' : '') + c.tune + ' Cent)</span>' : '');
  }
  $('edKey').addEventListener('click', async () => {
    if (!ed.t) return;
    $('edKeyRes').textContent = 'analysiere …'; $('edChords').textContent = 'Akkorde: werden erkannt …';
    const k = await detectTrackKey(ed.t);
    clearTimeout(ed.t.chTimer); detectTrackChords(ed.t).catch(() => {});
    if (!k) setStatus('Keine Tonart erkannt. Ist die Spur sehr leise oder nur Rhythmus?');
  });
  $('edKeyApply').addEventListener('click', () => { if (ed.t && ed.t.key) { Analyzer.apply(ed.t.key); setStatus('Tonart ' + Analyzer.label(ed.t.key) + ' übernommen.'); } });
  $('edClose').addEventListener('click', closeEditor);

  // Ausschnitt aus der geladenen Datei wählen
  function fillSrc() {
    const t = ed.t, box = $('edSrc');
    box.hidden = !(t && t.orig);
    if (box.hidden) return;
    const o = t.orig, from = $('edFrom'), prevB = $('edBars').value;
    $('edSrcInfo').textContent = o.name + ' · ' + o.bars + ' Takte · ' + bpmTxt(o.bpm) + ' BPM';
    from.innerHTML = '';
    for (let i = 1; i <= o.bars; i++) from.add(new Option('Takt ' + i, String(i)));
    let cur = 1;
    if (t.origPos != null) { let bd = Infinity; o.downs.forEach((d, i) => { const q = Math.abs(d - t.origPos); if (q < bd && i < o.bars) { bd = q; cur = i + 1; } }); }
    from.value = String(cur);
    refreshBarsOpts(t.origBars ? String(Math.min(t.origBars, o.bars - cur + 1)) : prevB);
  }
  function refreshBarsOpts(prev) {
    const o = ed.t.orig, max = o.bars - parseInt($('edFrom').value) + 1, el = $('edBars');
    el.innerHTML = '';
    [1, 2, 4, 8, 16, 32, 64].filter(b => b < max).forEach(b => el.add(new Option(b + ' Takt' + (b === 1 ? '' : 'e'), String(b))));
    el.add(new Option('Bis zum Ende (' + max + ')', String(max)));
    el.value = prev && [...el.options].some(op => op.value === prev) ? prev : String(max);
  }
  $('edFrom').addEventListener('change', () => refreshBarsOpts($('edBars').value));
  $('edTake').addEventListener('click', () => {
    const t = ed.t; if (!t || !t.orig) return;
    edSnap('excerpt');
    const r = placeExcerpt(t, parseInt($('edFrom').value), parseInt($('edBars').value));
    t.layers = [r.seg]; t.L = r.L;
    afterEdit(t, true);
    setStatus('Spur ' + (t.i + 1) + ': ' + r.msg);
    detectTrackKey(t);
  });
  // Taktraster der Datei um einen Schlag verschieben (falls die Eins falsch erkannt wurde)
  function shiftDowns(dir) {
    const t = ed.t; if (!t || !t.orig) return;
    const o = t.orig, from = parseInt($('edFrom').value) || 1, nb = parseInt($('edBars').value) || 1;
    edSnap('downshift');
    if (o.loopFile && !o.recorded) {
      const n = o.data.length, k = mod(Math.round(dir * o.barMed / 4), n);
      o.data = smap(o.data, a => { const r = new Float32Array(n); r.set(a.subarray(k), 0); r.set(a.subarray(0, k), n - k); return r; });
    } else {
      // auf den nächsten erkannten Schlag davor/danach (so ist der Schritt exakt umkehrbar), sonst ein Viertel des Takts
      const d = o.downs, bt = o.beats && o.beats.length > 8 ? o.beats : null;
      const nearB = x => { let lo = 0, hi = bt.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (bt[m] <= x) lo = m; else hi = m; } return Math.abs(bt[lo] - x) <= Math.abs(bt[hi] - x) ? lo : hi; };
      const nd = d.map((x, i) => {
        if (bt) { const j = nearB(x); if (Math.abs(bt[j] - x) < o.barMed / 16) { const k = j + (dir > 0 ? 1 : -1); if (k >= 0 && k < bt.length) return bt[k]; } }
        const nx = i + 1 < d.length ? d[i + 1] : x + o.barMed, pv = i > 0 ? d[i - 1] : x - o.barMed;
        return Math.round(dir > 0 ? x + (nx - x) / 4 : x - (x - pv) / 4);
      }).filter(x => x >= 0 && x <= o.data.length);
      if (nd.length < 2) return;
      o.downs = nd; o.bars = nd.length - 1;
    }
    const r = placeExcerpt(t, Math.min(from, o.bars), Math.min(nb, o.bars - Math.min(from, o.bars) + 1));
    t.layers = [r.seg]; t.L = r.L;
    afterEdit(t, true); fillSrc();
    setStatus('Spur ' + (t.i + 1) + ': Takt-Eins um einen Schlag ' + (dir > 0 ? 'nach hinten' : 'nach vorn') + ' verschoben – ' + r.msg);
    detectTrackKey(t);
  }
  $('edDownL').addEventListener('click', () => shiftDowns(-1));
  $('edDownR').addEventListener('click', () => shiftDowns(1));
  $('edGrid').addEventListener('change', () => { try { localStorage.setItem('3nps-edgrid', $('edGrid').value); } catch (e) {} });
  try { const g = localStorage.getItem('3nps-edgrid'); if (g) $('edGrid').value = g; } catch (e) {}

  // ---- Zoom, Blättern, Springen ----
  const edOv = $('edOver');
  const span = () => ed.t ? ed.t.L / ed.zoom : 1;
  function clampView() { if (!ed.t) return; ed.zoom = Math.max(1, Math.min(Math.max(256, ed.t.L / 300), ed.zoom)); ed.v0 = Math.max(0, Math.min(ed.t.L - span(), ed.v0)); }
  function showZoom() { $('edZoomInfo').textContent = (ed.zoom || 1) < 10 ? (Math.round((ed.zoom || 1) * 10) / 10).toString().replace('.', ',') + '×' : Math.round(ed.zoom) + '×'; }
  function zoomAt(factor, frame) {
    if (!ed.t) return;
    const old = span(), rel = frame == null ? 0.5 : (frame - ed.v0) / old;
    ed.zoom *= factor; clampView();
    const c = frame == null ? ed.v0 + old / 2 : frame;
    ed.v0 = c - rel * span(); clampView(); showZoom(); kick();
  }
  $('edZoomIn').addEventListener('click', () => zoomAt(2, null));
  $('edZoomOut').addEventListener('click', () => zoomAt(0.5, null));
  $('edZoomAll').addEventListener('click', () => { ed.zoom = 1; ed.v0 = 0; showZoom(); kick(); });
  $('edZoomSel').addEventListener('click', () => {
    if (!ed.t) return;
    const len = Math.max(sr * 0.2, ed.e - ed.s);
    ed.zoom = ed.t.L / (len * 1.15); clampView(); ed.v0 = ed.s - len * 0.075; clampView(); showZoom(); kick();
  });
  // Abspielen ab einer Stelle: alle Spuren springen gemeinsam (bleiben synchron)
  function seekTo(t, f) {
    ensureAudio(); sr = audioCtx.sampleRate;
    if (rec || !t || !t.L) return;
    cancelCountIn();
    anchor = nowFrame() + Math.round(0.02 * sr) - Math.round(mod(f, t.L));
    tracks.forEach(o => { if (o.L && (o.src || o === t)) { startTrack(o); o.state = 'playing'; } });
    update(); kick();
  }
  $('edPlayFrom').addEventListener('click', () => { if (ed.t) { seekTo(ed.t, ed.s); setStatus('Spur ' + (ed.t.i + 1) + ' spielt ab dem Anfang der Auswahl.'); } });
  tracks.forEach(t => t.wave.addEventListener('pointerdown', e => {
    if (!t.L || rec) return;
    const r = t.wave.getBoundingClientRect();
    seekTo(t, (e.clientX - r.left) / r.width * t.L);
  }));

  // Griffe ziehen, oben in der Zeitleiste springen, zwei Finger = zoomen
  function edFrameAt(clientX) {
    const r = edCv.getBoundingClientRect();
    return Math.max(0, Math.min(ed.t.L, ed.v0 + (clientX - r.left) / r.width * span()));
  }
  const edGrip = edCv.parentNode, ptrs = new Map();
  let pinch = null;
  edGrip.addEventListener('pointerdown', e => {
    if (!ed.t) return;
    ptrs.set(e.pointerId, e.clientX);
    try { edGrip.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    if (ptrs.size === 2) {
      ed.drag = null;
      const xs = [...ptrs.values()];
      pinch = { d: Math.max(20, Math.abs(xs[0] - xs[1])), z: ed.zoom, mid: edFrameAt((xs[0] + xs[1]) / 2) };
      return;
    }
    const r = edCv.getBoundingClientRect();
    if (e.clientY - r.top < 20) { ed.drag = 'seek'; seekTo(ed.t, edFrameAt(e.clientX)); return; }
    const f = edFrameAt(e.clientX);
    ed.drag = Math.abs(f - ed.s) <= Math.abs(f - ed.e) ? 's' : 'e';
    edMove(e);
  });
  function edMove(e) {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, e.clientX);
    if (pinch && ptrs.size === 2) {
      const xs = [...ptrs.values()], d = Math.max(20, Math.abs(xs[0] - xs[1]));
      const r = edCv.getBoundingClientRect(), rel = ((xs[0] + xs[1]) / 2 - r.left) / r.width;
      ed.zoom = pinch.z * d / pinch.d; clampView();
      ed.v0 = pinch.mid - rel * span(); clampView(); showZoom(); kick();
      return;
    }
    if (!ed.drag || !ed.t) return;
    if (ed.drag === 'seek') return;
    // am Rand automatisch weiterblättern
    const r = edCv.getBoundingClientRect(), rx = (e.clientX - r.left) / r.width;
    if (ed.zoom > 1 && (rx < 0.04 || rx > 0.96)) { ed.v0 += (rx < 0.04 ? -1 : 1) * span() * 0.03; clampView(); }
    const f = snapF(edFrameAt(e.clientX)), minLen = Math.round(sr * 0.1);
    if (ed.drag === 's') ed.s = Math.max(0, Math.min(f, ed.e - minLen));
    else ed.e = Math.min(ed.t.L, Math.max(f, ed.s + minLen));
    edInfo(); kick();
  }
  const edUp = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) ed.drag = null; };
  edGrip.addEventListener('pointermove', edMove);
  edGrip.addEventListener('pointerup', edUp);
  edGrip.addEventListener('pointercancel', edUp);
  // Übersicht: ziehen = Ausschnitt verschieben
  let ovDrag = false;
  const ovMove = e => { if (!ovDrag || !ed.t) return; const r = edOv.getBoundingClientRect(); ed.v0 = (e.clientX - r.left) / r.width * ed.t.L - span() / 2; clampView(); kick(); };
  edOv.addEventListener('pointerdown', e => { if (!ed.t) return; ovDrag = true; try { edOv.setPointerCapture(e.pointerId); } catch (err) {} ovMove(e); e.preventDefault(); });
  edOv.addEventListener('pointermove', ovMove);
  // Mac: Trackpad/Mausrad – Zusammenziehen (oder ⌘/Strg + Rad) zoomt, seitlich wischen blättert
  edGrip.addEventListener('wheel', e => {
    if (!ed.t) return;
    if (e.ctrlKey || e.metaKey) { zoomAt(Math.exp(-e.deltaY * 0.01), edFrameAt(e.clientX)); e.preventDefault(); return; }
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (dx && ed.zoom > 1) { ed.v0 += dx / Math.max(1, edGrip.clientWidth) * span(); clampView(); kick(); e.preventDefault(); }
  }, { passive: false });
  edOv.addEventListener('pointerup', () => { ovDrag = false; });
  edOv.addEventListener('pointercancel', () => { ovDrag = false; });

  // Spitzenwerte in Blöcken zu 64 Samples (schnelles Zeichnen in jeder Zoomstufe)
  // Spitzenwerte je Kanal in Blöcken zu 64 Samples (links oben, rechts unten gezeichnet)
  function blockPeaks(t) {
    if (t.bp && t.bpFor === t.mix) return t.bp;
    const B = 64, n = Math.ceil(t.L / B), bl = new Float32Array(n), br = new Float32Array(n); let max = 1e-4;
    const L = t.mix.l, R = t.mix.r;
    for (let k = 0; k < n; k++) {
      let p = 0, q = 0; const a = k * B, e = Math.min(t.L, a + B);
      for (let i = a; i < e; i++) { const v = L[i] < 0 ? -L[i] : L[i], w = R[i] < 0 ? -R[i] : R[i]; if (v > p) p = v; if (w > q) q = w; }
      bl[k] = p; br[k] = q; if (p > max) max = p; if (q > max) max = q;
    }
    t.bp = { l: bl, r: br }; t.bpFor = t.mix; t.bpMax = max;
    return t.bp;
  }
  function peakRange(t, a, b, ch) {
    a = Math.max(0, Math.floor(a)); b = Math.min(t.L, Math.ceil(b));
    if (b <= a) return 0;
    if (b - a >= 256) { const bp = blockPeaks(t)[ch || 'l']; let p = 0; for (let k = Math.floor(a / 64); k < Math.ceil(b / 64); k++) if (bp[k] > p) p = bp[k]; return p; }
    const x = t.mix[ch || 'l']; let p = 0; for (let i = a; i < b; i++) { const v = x[i] < 0 ? -x[i] : x[i]; if (v > p) p = v; } return p;
  }
  function drawOverview(t, tc) {
    const f = fit(edOv); if (!f) return;
    const { ctx, w, h } = f; blockPeaks(t);
    ctx.fillStyle = '#08080a'; ctx.fillRect(0, 0, w, h);
    const n = Math.floor(w), st = t.L / n;
    ctx.fillStyle = tc; ctx.globalAlpha = 0.45;
    for (let x = 0; x < n; x++) {
      const pl = peakRange(t, x * st, (x + 1) * st, 'l') / t.bpMax, pr = peakRange(t, x * st, (x + 1) * st, 'r') / t.bpMax, hh = (h - 6) / 2;
      ctx.fillRect(x, h / 2 - Math.max(0.5, pl * hh), 1, Math.max(0.5, pl * hh) + Math.max(0.5, pr * hh));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,138,26,.22)'; ctx.fillRect(ed.s / t.L * w, 0, (ed.e - ed.s) / t.L * w, h);
    const vx = ed.v0 / t.L * w, vw = Math.max(4, span() / t.L * w);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.strokeRect(vx + 0.75, 0.75, vw - 1.5, h - 1.5);
    if (t.src) { const p = mod(playFrame() - anchor, t.L) / t.L * w; ctx.fillStyle = '#fff'; ctx.fillRect(p - 0.5, 0, 1.5, h); }
  }

  function drawEditor(C) {
    const t = ed.t; if (!t || !t.L) return;
    if (ed.e > t.L) ed.e = t.L;
    if (ed.s >= ed.e) ed.s = 0;
    if (!ed.zoom) { ed.zoom = 1; ed.v0 = 0; }
    clampView();
    const f = fit(edCv); if (!f) return;
    const { ctx, w, h } = f, tc = NEON.t[t.i], v0 = ed.v0, sp = span(), X = fr => (fr - v0) / sp * w, dpr = window.devicePixelRatio || 1;
    const hasCh = !!(t.chords && t.chords.L === t.L && t.chords.segs.some(q => q.name !== '–'));
    const top = hasCh ? 36 : 18;                        // Zeitleiste (18 px), darunter die Akkordzeile
    ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(0, 0, w, 18);
    // Raster: erkannte Takte kräftig, erkannte Schläge fein
    const d = trackDowns(t), bts = trackBeats(t);
    ctx.font = '600 10px ui-monospace, Menlo, monospace';
    const barPx = d.length > 1 ? (d[1] - d[0]) / sp * w : w, every = barPx < 22 ? Math.ceil(22 / barPx) : 1;
    if (barPx >= 24) bts.forEach(b => { if (b.bar) return; const xb = X(b.f); if (xb >= 0 && xb <= w) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(Math.round(xb * dpr) / dpr, top, 1, h - top); } });
    for (let i = 0; i < d.length; i++) {
      const x = X(d[i]);
      if (x > w + 2) break;
      if (x < -2 || i % every) continue;
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(Math.round(x * dpr) / dpr, 0, 1, h);
      if (i < d.length - 1) { ctx.fillStyle = C.muted; ctx.fillText(String(i + 1), x + 4, 12); }
    }
    // Akkordzeile: Name am Anfang jedes Akkords, klingender Akkord hervorgehoben
    if (hasCh) {
      ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(0, 18, w, 18);
      const cur = t.src ? chordAt(t, mod(playFrame() - anchor, t.L)) : -1;
      ctx.font = '700 11px ui-monospace, Menlo, monospace';
      t.chords.segs.forEach((q, i) => {
        const xa = X(q.a), xe = X(q.e); if (xe < 0 || xa > w) return;
        if (i === cur) { ctx.fillStyle = tc; ctx.globalAlpha = 0.25; ctx.fillRect(Math.max(0, xa), 18, Math.min(w, xe) - Math.max(0, xa), 18); ctx.globalAlpha = 1; }
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(Math.round(xa * dpr) / dpr, 18, 1, 18);
        if (q.name === '–') return;
        const lab = q.name, room = xe - Math.max(0, xa) - 6;
        if (room < 14) return;
        ctx.fillStyle = i === cur ? '#ffffff' : tc; ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, xa), 18, room + 4, 18); ctx.clip();
        ctx.fillText(lab, Math.max(0, xa) + 4, 31); ctx.restore();
      });
    }
    // Wellenform im sichtbaren Bereich: links oben, rechts unten; stark vergrößert als echte Kurve
    const n = Math.max(1, Math.round(w * dpr)), st = sp / n, cw = 1 / dpr;
    blockPeaks(t);
    const xs = X(ed.s), xe = X(ed.e), mid = (top + h) / 2, amp = (h - top - 8) / 2;
    ctx.fillStyle = tc; ctx.strokeStyle = tc;
    if (st < 1.5) {
      // Abtastwerte als Linie (je Kanal in seiner Hälfte)
      const a0 = Math.max(0, Math.floor(v0) - 1), a1 = Math.min(t.L - 1, Math.ceil(v0 + sp) + 1), sc = amp / Math.max(1e-6, t.bpMax);
      [['l', -1], ['r', 1]].forEach(([ch, dir]) => {
        const xarr = t.mix[ch], yc = mid + dir * amp / 2; ctx.beginPath();
        for (let i = a0; i <= a1; i++) { const x = X(i), y = yc - xarr[i] * sc / 2; if (i === a0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.globalAlpha = 0.9; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.globalAlpha = 0.2; ctx.fillRect(0, yc - 0.5, w, 1);
      });
      ctx.globalAlpha = 0.35; ctx.fillRect(0, mid - 0.5, w, 1);
    } else {
      for (let x = 0; x < n; x++) {
        const cx = x * cw;
        ctx.globalAlpha = (cx >= xs && cx <= xe) ? 0.9 : 0.25;
        const pl = peakRange(t, v0 + x * st, v0 + (x + 1) * st, 'l') / t.bpMax, pr = peakRange(t, v0 + x * st, v0 + (x + 1) * st, 'r') / t.bpMax;
        const up = Math.max(cw * 0.5, pl * amp), dn = Math.max(cw * 0.5, pr * amp);
        ctx.fillRect(cx, mid - up, cw, up + dn);
      }
    }
    ctx.globalAlpha = 1;
    // Außerhalb der Auswahl abdunkeln
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    if (xs > 0) ctx.fillRect(0, top, Math.min(w, xs), h - top);
    if (xe < w) ctx.fillRect(Math.max(0, xe), top, w - Math.max(0, xe), h - top);
    // Griffe
    [[xs, 1], [xe, -1]].forEach(([x, dir]) => {
      if (x < -20 || x > w + 20) return;
      ctx.fillStyle = NEON.bar1; ctx.globalAlpha = 0.3; ctx.fillRect(x - 4, top, 8, h - top); ctx.globalAlpha = 1;
      ctx.fillRect(x - 1.5, top, 3, h - top);
      ctx.beginPath(); ctx.moveTo(x, h - 26); ctx.lineTo(x + 16 * dir, h - 18); ctx.lineTo(x, h - 10); ctx.closePath(); ctx.fill();
    });
    // Abspielposition (hörbar, Ausgabelatenz herausgerechnet)
    if (t.src) { const p = X(mod(playFrame() - anchor, t.L)); if (p >= -2 && p <= w + 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(p - 1, 0, 2, h); ctx.beginPath(); ctx.moveTo(p - 6, 0); ctx.lineTo(p + 6, 0); ctx.lineTo(p, 8); ctx.fill(); } }
    drawOverview(t, tc);
  }


  // ---- Export für Logic Pro: WAV-Spuren + Mix + MIDI (Tempo, Takt, Tonart, Drums) als ZIP ----
  const MODE_OFFSET = { 'Ionisch (Dur)': 0, 'Dorisch': 2, 'Phrygisch': 4, 'Lydisch': 5, 'Mixolydisch': 7, 'Äolisch (Moll)': 9, 'Lokrisch': 11 };
  const SHARPS = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };   // Dur-Tonart → Vorzeichen

  function crc32(u8) {
    let c, crc = 0xFFFFFFFF;
    if (!crc32.t) { crc32.t = new Uint32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc32.t[n] = c >>> 0; } }
    for (let i = 0; i < u8.length; i++) crc = crc32.t[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  // ZIP ohne Kompression (Audio lässt sich kaum packen; so bleibt es schnell)
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cSize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }

  // 24-Bit-WAV in Stereo (2 Kanäle, verschachtelt), optional mit ACID-Block (Tempo, Schläge, Grundton) für DAWs
  function wav24(x, gain, info) {
    if (!x.l) x = SP(x);
    const n = x.length, ch = 2, dataBytes = n * 3 * ch, acid = info ? 8 + 24 : 0;
    const buf = new ArrayBuffer(12 + 24 + acid + 8 + dataBytes), v = new DataView(buf), u = new Uint8Array(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, buf.byteLength - 8, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 3 * ch, true); v.setUint16(32, 3 * ch, true); v.setUint16(34, 24, true);
    let o = 36;
    if (info) {
      w(o, 'acid'); v.setUint32(o + 4, 24, true);
      v.setUint32(o + 8, 0x02 | 0x04, true); v.setUint16(o + 12, 60 + info.rootPc, true); v.setUint16(o + 14, 0x8000, true);
      v.setFloat32(o + 16, 0, true); v.setUint32(o + 20, info.beats, true); v.setUint16(o + 24, 4, true); v.setUint16(o + 26, 4, true);
      v.setFloat32(o + 28, info.bpm, true);
      o += acid;
    }
    w(o, 'data'); v.setUint32(o + 4, dataBytes, true); o += 8;
    const L = x.l, R = x.r;
    for (let i = 0; i < n; i++) {
      let a = L[i] * gain; a = a > 1 ? 1 : a < -1 ? -1 : a;
      let s = Math.round(a * 8388607);
      u[o] = s & 0xFF; u[o + 1] = (s >> 8) & 0xFF; u[o + 2] = (s >> 16) & 0xFF;
      a = R[i] * gain; a = a > 1 ? 1 : a < -1 ? -1 : a;
      s = Math.round(a * 8388607);
      u[o + 3] = s & 0xFF; u[o + 4] = (s >> 8) & 0xFF; u[o + 5] = (s >> 16) & 0xFF; o += 6;
    }
    return u;
  }

  // Standard-MIDI-Datei: Spur 1 = Tempo, 4/4, Tonart, Marker; Spur 2 = Drum-Groove (falls an)
  function midiFile(info) {
    const PPQ = 480, bytes = [];
    const vlq = n => { const a = [n & 0x7F]; while ((n >>= 7)) a.unshift((n & 0x7F) | 0x80); return a; };
    const str = s => Array.from(new TextEncoder().encode(s));
    function track(events, endAt) {    // events: [tick, [bytes], Reihenfolge]
      const out = []; let last = 0;
      events.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
      for (const [t, data] of events) { out.push(...vlq(t - last), ...data); last = t; }
      out.push(...vlq(Math.max(0, (endAt || last) - last)), 0xFF, 0x2F, 0x00);
      return [...str('MTrk'), (out.length >>> 24) & 255, (out.length >>> 16) & 255, (out.length >>> 8) & 255, out.length & 255, ...out];
    }
    const endTick = info.beats * PPQ, mpq = Math.round(60000000 / info.bpm);
    const nameB = str(info.name), keyName = str(info.keyLabel);
    const ch0 = (info.chords || []).find(c => c[0] === 0);
    const firstMark = str(info.keyLabel + (ch0 ? ' · ' + ch0[1] : ''));
    const t0 = [
      [0, [0xFF, 0x03, nameB.length, ...nameB], 0],
      [0, [0xFF, 0x51, 0x03, (mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255], 1],
      [0, [0xFF, 0x58, 0x04, 4, 2, 24, 8], 2],
      [0, [0xFF, 0x59, 0x02, info.sf & 255, info.minor ? 1 : 0], 3],
      [0, [0xFF, 0x06, firstMark.length, ...firstMark], 4],
      [endTick, [0xFF, 0x01, 0x00], 5]
    ];
    // Akkorde als Marker (Logic zeigt sie in der Marker-Spur)
    (info.chords || []).forEach(([tick, name]) => { if (tick > 0 && tick < endTick) { const b = str(name); t0.push([tick, [0xFF, 0x06, b.length, ...b], 4]); } });
    void keyName;
    const tracksOut = [track(t0)];
    if (info.drums) {
      const ev = [], dn = str('Drums (' + info.drumsName + ')');
      ev.push([0, [0xFF, 0x03, dn.length, ...dn], 0]);
      const bars = Math.round(info.beats / 4);
      for (const [t, note, vel, len] of Rhythm.midiEvents(bars, PPQ)) { ev.push([t, [0x99, note, vel], 2]); ev.push([t + len, [0x89, note, 0], 1]); }
      tracksOut.push(track(ev, endTick));
    }
    const hdr = [...str('MThd'), 0, 0, 0, 6, 0, 1, 0, tracksOut.length, (PPQ >> 8) & 255, PPQ & 255];
    return new Uint8Array([...hdr, ...tracksOut.flat()]);
  }

  async function exportLogic() {
    const used = tracks.filter(t => t.L);
    if (!used.length) { setStatus('Noch nichts zum Exportieren. Nimm zuerst einen Loop auf oder lade eine Datei.'); return; }
    if (rec) { setStatus('Beende zuerst die laufende Aufnahme.'); return; }
    setStatus('Erstelle das Logic-Paket …');
    await new Promise(r => setTimeout(r, 30));
    // Gemeinsame Länge: kleinstes gemeinsames Vielfaches der Spurlängen (höchstens 16 Durchläufe)
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    let mult = 1;
    used.forEach(t => { const k = Math.max(1, Math.round(t.L / baseL)); mult = mult * k / gcd(mult, k); });
    mult = Math.min(mult, 16);
    const total = baseL * mult;
    const tempo = bpm(), bar = barOf(baseL), bars = Math.max(1, Math.round(total / bar)), beats = bars * 4;
    const exactBpm = Math.abs(total / bar - bars) < 0.02 ? 60 * sr * beats / total : tempo;
    // Spuren auf Gesamtlänge bringen (mit Pegel), gemeinsamer Schutz vor Übersteuern
    const stems = [];
    for (const t of used) {
      const src = await EQ7.render(t.mix, t.eqVals, sr);          // EQ wie gehört (nahtlos über den Loop-Übergang)
      const g = parseInt(t.vol.value) / 100, out = S(total), ml = src.l, mr = src.r;
      for (let i = 0; i < total; i++) { const j = i % t.L; out.l[i] = ml[j] * g; out.r[i] = mr[j] * g; }
      stems.push({ t, data: out });
    }
    const mix = S(total);
    stems.forEach(s => { for (let i = 0; i < total; i++) { mix.l[i] += s.data.l[i]; mix.r[i] += s.data.r[i]; } });
    const pk = x => { let p = 0; for (let i = 0; i < x.length; i++) { const a = x.l[i] < 0 ? -x.l[i] : x.l[i], b = x.r[i] < 0 ? -x.r[i] : x.r[i]; if (a > p) p = a; if (b > p) p = b; } return p; };
    let peak = pk(mix);
    stems.forEach(s => { peak = Math.max(peak, pk(s.data)); });
    const gain = peak > 0.97 ? 0.97 / peak : 1;
    // Tonart: erkannte Tonart der ersten Spur, sonst die eingestellte Skala
    const k = (used.find(t => t.key) || {}).key;
    let rootPc, minor, keyLabel, majorPc;
    if (k) {
      rootPc = k.pc; minor = !k.major; keyLabel = Analyzer.label(k);
      majorPc = minor ? (rootPc + 3) % 12 : rootPc;
    } else {
      rootPc = NOTES.indexOf(rootSel.value);
      const off = MODE_OFFSET[modeSel.value] || 0;
      minor = modeSel.value.startsWith('Äolisch');
      keyLabel = rootSel.value + ' ' + modeSel.value.replace(/ \(.*\)/, '');
      majorPc = (rootPc - off + 12) % 12;            // Vorzeichen der Stamm-Durtonart
    }
    const sf = SHARPS[majorPc];
    const tempoTxt = (Math.round(exactBpm * 100) / 100).toString().replace('.', ',');
    const safe = s => s.replace(/[\\/:*?"<>|]/g, '_').trim();
    const now = new Date();
    const base = safe(($('ideaName').value || '').trim() || ('Looper ' + now.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')));
    const tag = tempoTxt + ' BPM ' + safe(keyLabel.replace(/ \(.*\)/, ''));
    const info = { bpm: exactBpm, beats, rootPc };
    const files = [];
    stems.forEach((s, j) => files.push({ name: base + '/' + String(j + 1).padStart(2, '0') + ' Spur ' + (s.t.i + 1) + ' - ' + tag + '.wav', data: wav24(s.data, gain, info) }));
    files.push({ name: base + '/00 Mix - ' + tag + '.wav', data: wav24(mix, gain, info) });
    const dStyle = Rhythm.on() ? true : null, dName = Rhythm.name();
    // Akkorde der ersten Spur mit erkannten Akkorden, über die ganze Exportlänge wiederholt
    const ct = used.find(t => t.chords && t.chords.L === t.L && t.chords.segs.some(q => q.name !== '–'));
    const chordMarks = [], ticksPerFrame = exactBpm / 60 / sr * 480;
    if (ct) for (let rp = 0; rp * ct.L < total; rp++) ct.chords.segs.forEach(q => { if (q.name === '–') return; const tk = Math.round((rp * ct.L + q.a) * ticksPerFrame); if (!chordMarks.length || chordMarks[chordMarks.length - 1][1] !== q.name) chordMarks.push([tk, q.name]); });
    files.push({ name: base + '/Tempo und Takt - ' + tag + '.mid', data: midiFile({ bpm: exactBpm, beats, sf, minor, keyLabel, name: base, drums: dStyle, drumsName: dName, chords: chordMarks }) });
    const lies = [
      base, '',
      'Tempo: ' + tempoTxt + ' BPM · Taktart 4/4 · ' + bars + ' Takte · Tonart ' + keyLabel,
      'Alle WAV-Dateien beginnen auf Takt 1 und sind gleich lang (Stereo, 24 Bit, ' + sr + ' Hz).', '',
      'So geht es in Logic Pro (Mac oder iPad):',
      '1. Neues leeres Projekt anlegen.',
      '2. Die MIDI-Datei „Tempo und Takt …“ ins Projekt ziehen. Logic fragt, ob es das Tempo übernehmen soll: Ja.',
      '   (Alternativ das Tempo oben in Logic von Hand auf ' + tempoTxt + ' setzen.)',
      '3. Alle WAV-Dateien gleichzeitig auf Takt 1 ziehen und „Neue Spuren erstellen“ wählen.',
      '   Falls Logic nach Smart Tempo fragt: „Nicht anpassen“ bzw. Projekttempo beibehalten.',
      '4. Mit Cycle (Taste C) auf Takt 1 bis ' + (bars + 1) + ' läuft alles als Loop.',
      dStyle ? '5. Die MIDI-Datei enthält eine Drum-Spur (' + dName + ') für Drummer/Drum Kit Designer.' : null,
      chordMarks.length ? '' : null,
      chordMarks.length ? 'Akkorde (Spur ' + (ct.i + 1) + '): ' + chordMarks.slice(0, 64).map(c => c[1]).join(' – ') + (chordMarks.length > 64 ? ' …' : '') : null,
      chordMarks.length ? 'Sie stehen auch als Marker in der MIDI-Datei (Logic: Marker-Spur einblenden).' : null,
      '', 'Erstellt mit dem 3nps-Übungsprogramm.'
    ].filter(x => x !== null).join('\n');
    files.push({ name: base + '/LIES MICH.txt', data: new TextEncoder().encode(lies) });
    const zip = makeZip(files);
    const file = new File([zip], base + '.zip', { type: 'application/zip' });
    setStatus('Logic-Paket fertig: ' + stems.length + ' Spur' + (stems.length === 1 ? '' : 'en') + ', Mix und MIDI · ' + tempoTxt + ' BPM · ' + bars + ' Takte · ' + (zip.size / 1048576).toFixed(1).replace('.', ',') + ' MB.');
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: base }); } catch (e) {}
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    return { files, zip };
  }
  $('loopExport').addEventListener('click', exportLogic);


  // ---- WAV-Mixdown (Stereo, 24 Bit) ----
  function toWav(x) {
    if (!x.l) x = SP(x);
    let peak = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x.l[i]), b = Math.abs(x.r[i]); if (a > peak) peak = a; if (b > peak) peak = b; }
    const norm = peak > 0.98 ? 0.98 / peak : 1;
    return new Blob([wav24(x, norm, null)], { type: 'audio/wav' });
  }
  function getMix() {
    const used = tracks.filter(t => t.L);
    if (!used.length) return null;
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    let mult = 1;
    used.forEach(t => { const n = Math.round(t.L / baseL); mult = mult * n / gcd(mult, n); });
    mult = Math.min(mult, 16);
    const total = baseL * mult, out = S(total);
    used.forEach(t => { const g = parseInt(t.vol.value) / 100, ml = t.mix.l, mr = t.mix.r; for (let i = 0; i < total; i++) { const j = i % t.L; out.l[i] += ml[j] * g; out.r[i] += mr[j] * g; } });
    return { wav: toWav(out), secs: total / sr };
  }
  // ---- Komplette Session (alle Spuren) für „Ideen“ ----
  // Gespeichert wird 24 Bit je Kanal (enc 'i24'); ein rechter Kanal nur, wenn er sich vom linken unterscheidet.
  // Ältere Ideen (Mono, 16 Bit in „pcm“) bleiben ladbar.
  function enc24(a) {
    const u = new Uint8Array(a.length * 3);
    for (let i = 0, o = 0; i < a.length; i++, o += 3) { let v = a[i]; v = v > 1 ? 1 : v < -1 ? -1 : v; const s = Math.round(v * 8388607); u[o] = s & 255; u[o + 1] = (s >> 8) & 255; u[o + 2] = (s >> 16) & 255; }
    return u;
  }
  function dec24(u, n) {
    const a = new Float32Array(n);
    for (let i = 0, o = 0; i < n; i++, o += 3) { let s = u[o] | (u[o + 1] << 8) | (u[o + 2] << 16); if (s & 0x800000) s -= 0x1000000; a[i] = s / 8388607; }
    return a;
  }
  function sameData(x) {
    if (x.r === x.l) return true;
    const a = x.l, b = x.r; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true;
  }
  function sessTrackData(st) {
    if (st.enc === 'i24') { const l = dec24(st.dl, st.L); return SP(l, st.dr ? dec24(st.dr, st.L) : null); }
    const l = new Float32Array(st.L); for (let j = 0; j < st.L; j++) l[j] = st.pcm[j] / 32767;
    return SP(l, st.pcmR ? Float32Array.from(st.pcmR, v => v / 32767) : null);
  }
  function getSession() {
    const used = tracks.filter(t => t.L); if (!used.length) return null;
    return {
      sr, baseL, stereo: true,
      tracks: tracks.map(t => {
        if (!t.L) return null;
        const m = t.mix, mono = sameData(m);
        const o = { L: t.L, enc: 'i24', dl: enc24(m.l), vol: parseInt(t.vol.value), eq: t.eqVals.slice() };
        if (!mono) o.dr = enc24(m.r);
        return o;
      })
    };
  }
  function sessionMix(sess) {
    const ts = sess.tracks.filter(Boolean); if (!ts.length) return null;
    const gcd = (a, b) => b ? gcd(b, a % b) : a; let mult = 1;
    ts.forEach(t => { const n = Math.max(1, Math.round(t.L / sess.baseL)); mult = mult * n / gcd(mult, n); });
    const total = sess.baseL * Math.min(mult, 16), out = S(total);
    ts.forEach(t => { const g = (t.vol != null ? t.vol : 90) / 100, d = sessTrackData(t); for (let i = 0; i < total; i++) { const j = i % t.L; out.l[i] += d.l[j] * g; out.r[i] += d.r[j] * g; } });
    const keep = sr; sr = sess.sr; const w = toWav(out); sr = keep;
    return { wav: w, secs: total / sess.sr };
  }
  async function sessionMixEq(sess) {
    const ts = sess.tracks.filter(Boolean); if (!ts.length) return null;
    if (ts.every(t => EQ7.isFlat(t.eq))) return sessionMix(sess);
    const gcd = (a, b) => b ? gcd(b, a % b) : a; let mult = 1;
    ts.forEach(t => { const n = Math.max(1, Math.round(t.L / sess.baseL)); mult = mult * n / gcd(mult, n); });
    const total = sess.baseL * Math.min(mult, 16), out = S(total);
    for (const t of ts) {
      const g = (t.vol != null ? t.vol : 90) / 100, d = await EQ7.render(sessTrackData(t), t.eq, sess.sr);
      for (let i = 0; i < total; i++) { const j = i % t.L; out.l[i] += d.l[j] * g; out.r[i] += d.r[j] * g; }
    }
    const keep = sr; sr = sess.sr; const w = toWav(out); sr = keep;
    return { wav: w, secs: total / sess.sr };
  }
  function loadSession(sess) {
    ensureAudio(); sr = audioCtx.sampleRate;
    if (rec) cancelRec();
    cancelCountIn();
    tracks.forEach(t => { stopSrc(t); t.layers = []; t.L = 0; t.mix = null; t.peaks = null; t.state = 'empty'; t.hist = []; t.key = null; t.orig = null; t.origPos = null; clearTimeout(t.chTimer); t.chords = null; showChords(t); });
    if (ed.t) closeEditor();
    const q = sr / sess.sr;
    baseL = Math.round(sess.baseL * q);
    sess.tracks.forEach((st, i) => {
      if (!st) return;
      const t = tracks[i], f = sessTrackData(st);
      const L = Math.max(1, Math.round(st.L / sess.baseL)) * baseL;
      t.layers = [Math.abs(q - 1) < 1e-6 ? f : resample(f, L)]; t.L = L; rebuildMix(t);
      if (st.vol != null) { t.vol.value = st.vol; t.volV.textContent = st.vol; }
      setTrackEq(t, st.eq || EQ7.flat(), false);
    });
    anchor = startAnchor('play');
    tracks.forEach(t => { if (t.L) { startTrack(t); t.state = 'playing'; detectTrackKey(t); } });
    update();
  }
  // Drone-Spur: Einstellungen merken und wiederherstellen
  function getDroneState() {
    return { on: !!droneOn, style: mainDroneStyle.value, root: dRoot.value, mode: dMode.value, vol: parseInt(mainDroneVol.value), orn: $('pianoShimmer').checked };
  }
  function setDroneState(st) {
    if (!st) return;
    if (droneOn) setDrone(false);
    mainDroneStyle.value = st.style || 'v1'; dStyleSel.value = mainDroneStyle.value;
    dRoot.value = st.root || ''; dMode.value = st.mode || '';
    mainDroneVol.value = st.vol != null ? st.vol : 40; dVol.value = mainDroneVol.value;
    $('pianoShimmer').checked = st.orn !== false; $('laneDroneOrn').checked = $('pianoShimmer').checked;
    applyDroneKey();
    if (st.on) setTimeout(() => setDrone(true), droneOn ? 1300 : 50);
    syncDrone();
  }

  function loadSamples(data) {
    ensureAudio(); sr = audioCtx.sampleRate;
    rec = null;
    tracks.forEach(t => { stopSrc(t); t.layers = []; t.L = 0; t.mix = null; t.peaks = null; t.state = 'empty'; t.hist = []; t.key = null; t.orig = null; clearTimeout(t.chTimer); t.chords = null; showChords(t); });
    if (ed.t) closeEditor();
    const t = tracks[0];
    if (!data.l) data = SP(data);
    t.L = data.length; t.layers = [data]; rebuildMix(t);
    baseL = t.L;
    anchor = startAnchor('play');
    startTrack(t); t.state = 'playing';
    update();
    detectTrackKey(t);
  }

  // Position für das LCD (Takt.Schlag)
  function position() {
    if (!audioCtx) return null;
    const now = nowFrame(), bf = barFrames(), bt = beatFrames();
    const fmt = fr => (Math.floor(fr / bf) + 1) + '.' + (Math.floor(mod(fr, bf) / bt) + 1);
    const pend = rec && !rec.armed && now < rec.start ? rec.start : (anyRunning() && now < anchor ? anchor : 0);
    if (pend) { const lb = (pend - now) / beatFrames(); return { text: lb > 4 ? '−' + Math.ceil(lb / 4) : '−0.' + Math.max(1, Math.ceil(lb)), rec: !!rec }; }
    if (rec && !rec.armed && now >= rec.start && rec.kind === 'first') return { text: fmt(now - rec.start), rec: true };
    if (anyRunning()) {
      const L = Math.max(...tracks.filter(t => t.src).map(t => t.L)), b = barOf(L);
      const p = mod(playFrame() - anchor, L);
      return { text: (Math.floor(p / b) + 1) + '.' + (Math.floor(mod(p, b) / (b / 4)) + 1), rec: !!(rec && !rec.armed) };
    }
    return null;
  }

  return {
    getMix, loadSamples, update, position, getSession, sessionMix, sessionMixEq, loadSession, setTrackEq: (i, v) => setTrackEq(tracks[i], v, false), getTrackEq: i => tracks[i].eqVals.slice(), getDroneState, setDroneState,
    isEmpty: () => !anyContent(),
    foot: i => foot(tracks[i]),
    exportLogic: () => exportLogic(),
    _micDrop: () => { if (stream) stream.getAudioTracks()[0].dispatchEvent(new Event('ended')); },
    themeChanged: () => readNeon(), _zip: files => makeZip(files),
    _mem: () => memState(), autosaveNow: () => doAutosave(), autosaveOn: v => { autoReady = v !== false; },
    _stereo: i => { const t = tracks[i]; if (!t || !t.mix) return null; const x = t.mix; let a = 0, b = 0, ab = 0; for (let k = 0; k < x.length; k += 4) { a += x.l[k] * x.l[k]; b += x.r[k] * x.r[k]; ab += x.l[k] * x.r[k]; } const n = Math.ceil(x.length / 4); return { L: t.L, shared: x.r === x.l, rmsL: Math.sqrt(a / n), rmsR: Math.sqrt(b / n), corr: ab / Math.sqrt(a * b + 1e-20), layers: t.layers.map(ly => ly.r === ly.l ? 1 : 2), inInfo: ($('inChanInfo') || {}).textContent, stereoSeen, inChans }; },
    debug: () => ({ mic: micReady, sr, baseL, anchor, now: nowFrame(), countEnd, bpm: bpm(), drums: Object.assign({}, Rhythm.debug(), { on: Rhythm.on() }), level, drone: droneOn, tracks: tracks.map(t => ({ L: t.L, state: t.state, origPos: t.origPos, layers: t.layers.length, orig: t.orig ? { bars: t.orig.bars, downs: t.orig.downs.slice(0, 64), loopFile: t.orig.loopFile, bpm: t.orig.bpm } : null, key: t.key ? Analyzer.label(t.key) : null })) }),
    undo: i => undoTrack(tracks[i]),
    // klingender Akkord der ersten laufenden Spur mit erkannten Akkorden (für den Quintenzirkel)
    // komplette Akkordfolge einer Spur für den Solo Finder (Frames, Taktanfänge, Abspielposition, Tonart)
    chordInfo: want => {
      const ok = t => !!(t.chords && t.chords.L === t.L && t.L && t.chords.segs.some(q => q.name !== '–'));
      const list = tracks.map(t => ({ i: t.i, has: ok(t), playing: !!t.src }));
      let t = want != null && tracks[want] && ok(tracks[want]) ? tracks[want] : tracks.find(q => q.src && ok(q)) || tracks.find(ok);
      if (!t) return { tracks: list, track: -1 };
      const pos = t.src && audioCtx ? mod(playFrame() - anchor, t.L) : null;
      const downs = trackDowns(t).filter(x => x > -2 && x < t.L - 2).map(x => Math.max(0, x));
      return { tracks: list, track: t.i, segs: t.chords.segs.map(q => ({ name: q.name, a: q.a, e: q.e })), L: t.L, pos, downs, sr,
        key: t.key ? { pc: t.key.pc, major: !!t.key.major } : null, playing: !!t.src };
    },
    busy: () => !!rec || tracks.some(t => !!t.src),     // spielt oder nimmt gerade etwas auf (für den Jam)
    stopAll: () => { const b = $('loopAll'); if (b && tracks.some(t => !!t.src) && !rec) b.click(); },
    seek: (i, f) => { const t = tracks[i]; if (t && t.L && !rec) seekTo(t, f); },
    nowChord: () => {
      for (const t of tracks) {
        const c = t.chords; if (!t.src || !c || c.L !== t.L || !c.segs.some(q => q.name !== '–')) continue;
        const i = chordAt(t, mod(playFrame() - anchor, t.L)); if (i < 0) continue;
        return { name: c.segs[i].name, next: nextChord(c, i), track: t.i };
      }
      return null;
    },
    _chords: i => tracks[i].chords ? { segs: tracks[i].chords.segs.map(q => ({ name: q.name, a: q.a, e: q.e })), L: tracks[i].chords.L, tune: tracks[i].chords.tune } : null,
    _detectChords: i => detectTrackChords(tracks[i]).then(() => tracks[i].chords && tracks[i].chords.segs.map(q => q.name)),
    _shift: (i, ms) => rotateTrack(tracks[i], Math.round(ms / 1000 * sr)),
    _align: i => { const r = fineAlign(tracks[i], tracks[0] !== tracks[i] && tracks[0].L ? [tracks[0]] : null); return r && { ms: r.lagF / sr * 1000, ncc: r.ncc, gain: r.gain, edge: r.edge, ok: alignOk(r) }; },
    _alignNew: i => alignNewTake(tracks[i]),
    _beats: i => trackBeats(tracks[i]).map(b => b.f),
    _playFrame: () => ({ play: playFrame(), now: audioCtx ? nowFrame() : 0 }),
    all: allStartStop
  };
})();

/* ---------- Fußpedal (M-VAVE Chocolate im Tastatur-Modus, jede Bluetooth-Tastatur) ---------- */
const Pedal = (() => {
  const $ = id => document.getElementById(id);
  const ACTIONS = [
    { id: 'foot0', label: 'Spur 1', run: () => Looper.foot(0), hold: () => Looper.undo(0) },
    { id: 'foot1', label: 'Spur 2', run: () => Looper.foot(1), hold: () => Looper.undo(1) },
    { id: 'foot2', label: 'Spur 3', run: () => Looper.foot(2), hold: () => Looper.undo(2) },
    { id: 'all', label: 'Alle starten / stoppen', run: () => Looper.all(), hold: null }
  ];
  const PRESETS = {
    a: { foot0: 'ArrowUp', foot1: 'ArrowDown', foot2: 'ArrowLeft', all: 'ArrowRight' },
    b: { foot0: 'PageUp', foot1: 'PageDown', foot2: ' ', all: 'Enter' }
  };
  // Automatisch: Keyboard A und B gleichzeitig (egal, welchen Tastatur-Modus das Pedal gerade hat)
  const AUTO = { ArrowUp: 'foot0', PageUp: 'foot0', ArrowDown: 'foot1', PageDown: 'foot1', ArrowLeft: 'foot2', ' ': 'foot2', ArrowRight: 'all', Enter: 'all' };
  // iPadOS meldet Pfeil-/Bildtasten je nach Version mit eigenen Namen – alles auf die Standardnamen bringen
  const ALIAS = { UIKeyInputUpArrow: 'ArrowUp', UIKeyInputDownArrow: 'ArrowDown', UIKeyInputLeftArrow: 'ArrowLeft', UIKeyInputRightArrow: 'ArrowRight',
    UIKeyInputPageUp: 'PageUp', UIKeyInputPageDown: 'PageDown', UIKeyInputEscape: 'Escape', Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight', Spacebar: ' ' };
  const CODES = { 38: 'ArrowUp', 40: 'ArrowDown', 37: 'ArrowLeft', 39: 'ArrowRight', 33: 'PageUp', 34: 'PageDown', 32: ' ', 13: 'Enter' };
  function normKey(e) {
    let k = e.key;
    if (ALIAS[k]) k = ALIAS[k];
    if (!k || k === 'Unidentified' || k === 'Process') k = CODES[e.keyCode] || (e.code === 'Space' ? ' ' : e.code) || '';
    return k;
  }
  const FALLBACK = { '1': 'foot0', '2': 'foot1', '3': 'foot2' };
  const NAMES = { ArrowUp: 'Pfeil ↑', ArrowDown: 'Pfeil ↓', ArrowLeft: 'Pfeil ←', ArrowRight: 'Pfeil →', PageUp: 'Bild ↑', PageDown: 'Bild ↓', ' ': 'Leertaste', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab' };
  const keyName = k => NAMES[k] || (k.length === 1 ? k.toUpperCase() : k);
  function load(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  const presetEl = $('pedalPreset'), holdEl = $('pedalHold'), lastEl = $('pedalLast'), listEl = $('pedalMap');
  let preset = load('3nps-pedal-preset', 'auto');
  if (!['auto', 'a', 'b', 'custom'].includes(preset)) preset = 'auto';
  let custom = {}; try { custom = JSON.parse(load('3nps-pedal-custom', '{}')) || {}; } catch (e) {}
  holdEl.checked = load('3nps-pedal-hold', '1') === '1';
  presetEl.value = preset;
  let learning = null;
  const map = () => preset === 'custom' ? Object.assign({}, PRESETS.a, custom) : preset === 'auto' ? PRESETS.a : PRESETS[preset];
  const showKeys = id => preset === 'auto' ? keyName(PRESETS.a[id]) + ' / ' + keyName(PRESETS.b[id]) : keyName(map()[id] || '–');

  function render() {
    const m = map();
    listEl.innerHTML = ACTIONS.map(a => `
      <div class="pedal-row">
        <span class="pedal-act">${a.label}</span>
        <kbd>${learning === a.id ? 'Pedal drücken …' : String(showKeys(a.id)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</kbd>
        <button class="toggle-btn" data-learn="${a.id}" ${preset !== 'custom' ? 'hidden' : ''}>${learning === a.id ? 'Abbrechen' : 'Anlernen'}</button>
      </div>`).join('');
  }
  listEl.addEventListener('click', e => {
    const b = e.target.closest('[data-learn]'); if (!b) return;
    learning = learning === b.dataset.learn ? null : b.dataset.learn; render();
    arm();
  });
  presetEl.addEventListener('change', () => { preset = presetEl.value; save('3nps-pedal-preset', preset); learning = null; render(); });
  holdEl.addEventListener('change', () => save('3nps-pedal-hold', holdEl.checked ? '1' : '0'));

  const down = {};
  // iPadOS schickt Pfeil-/Bildtasten nur an die Seite, wenn ein Eingabefeld aktiv ist – sonst scrollt es selbst.
  // Deshalb hält ein unsichtbares Feld den Fokus und nimmt die Pedal-Tasten an.
  const recvEl = $('pedalRecv'), recvStat = $('pedalRecvStat');
  recvEl.checked = load('3nps-pedal-recv', '1') === '1';
  const sink = document.createElement('input');
  sink.type = 'text'; sink.id = 'pedalSink'; sink.tabIndex = -1;
  ['autocomplete', 'autocorrect', 'autocapitalize'].forEach(a => sink.setAttribute(a, 'off'));
  sink.setAttribute('inputmode', 'none'); sink.setAttribute('spellcheck', 'false'); sink.setAttribute('aria-hidden', 'true');
  sink.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;font-size:16px;caret-color:transparent;background:transparent;color:transparent;pointer-events:none;z-index:-1';
  document.body.appendChild(sink);
  sink.addEventListener('input', () => { sink.value = ''; });
  const isField = el => el && el !== sink && el.matches && el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]), select, textarea, [contenteditable="true"]');
  function arm() {
    if (!recvEl.checked) return;
    if (isField(document.activeElement)) return;
    try { sink.focus({ preventScroll: true }); } catch (e) { try { sink.focus(); } catch (e2) {} }
    showRecv();
  }
  function showRecv() {
    const ok = recvEl.checked && document.activeElement === sink;
    recvStat.textContent = !recvEl.checked ? 'aus' : ok ? 'bereit ✓' : 'einmal in die App tippen';
    recvStat.classList.toggle('ok', ok);
  }
  document.addEventListener('click', e => { if (!isField(e.target) && !(e.target.closest && e.target.closest('select, label'))) arm(); }, true);
  document.addEventListener('touchend', e => { if (!isField(e.target) && !(e.target.closest && e.target.closest('select, input, textarea, label'))) arm(); }, true);
  document.addEventListener('change', e => { if (e.target && e.target.matches && e.target.matches('select, input[type="checkbox"], input[type="radio"]')) arm(); }, true);
  sink.addEventListener('focus', showRecv); sink.addEventListener('blur', () => setTimeout(showRecv, 50));
  document.addEventListener('visibilitychange', () => setTimeout(showRecv, 100));
  recvEl.addEventListener('change', () => { save('3nps-pedal-recv', recvEl.checked ? '1' : '0'); if (recvEl.checked) arm(); else sink.blur(); showRecv(); });
  showRecv();

  let flashT = 0;
  window.addEventListener('keydown', e => {
    if (e.target !== sink && e.target.closest && e.target.closest('input[type="text"], textarea')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = normKey(e);
    if (learning) {
      e.preventDefault();
      custom[learning] = key; save('3nps-pedal-custom', JSON.stringify(custom));
      lastEl.textContent = keyName(key);
      learning = null; render(); return;
    }
    const m = map();
    let id = preset === 'auto' ? AUTO[key] : Object.keys(m).find(k => m[k] === key);
    id = id || FALLBACK[key];
    const a = id ? ACTIONS.find(x => x.id === id) : null;
    lastEl.textContent = keyName(key) + (a ? ' → ' + a.label : ' (nicht belegt)');
    lastEl.classList.add('hit'); clearTimeout(flashT); flashT = setTimeout(() => lastEl.classList.remove('hit'), 250);
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return;
    down[key] = { t: performance.now(), a };
    a.run();
  }, true);
  window.addEventListener('keyup', e => {
    const key = normKey(e);
    const d = down[key]; delete down[key];
    if (!d || !holdEl.checked || !d.a.hold) return;
    if (performance.now() - d.t >= 800) d.a.hold();
  });
  render();
  return { render };
})();

/* ---------- LCD in der Kontrollleiste ---------- */
(function () {
  const posEl = document.getElementById('lcdPos'), keyEl = document.getElementById('lcdKey');
  const setKey = () => { keyEl.textContent = rootSel.value + ' ' + modeSel.value.replace(/ \(.*\)/, ''); };
  rootSel.addEventListener('change', setKey); modeSel.addEventListener('change', setKey); setKey();
  setInterval(() => {
    let text = '1.1', recOn = false;
    const p = Looper.position();
    if (p) { text = p.text; recOn = p.rec; }
    else if (isPlaying) {
      const npb = parseInt(document.getElementById('notesPerBeat').value) || 1;
      const beats = Math.max(0, Math.floor((beatCounter - 1) / npb));
      text = (Math.floor(beats / 4) + 1) + '.' + (beats % 4 + 1);
    }
    if (posEl.textContent !== text) posEl.textContent = text;
    posEl.classList.toggle('rec', recOn);
  }, 50);
})();

/* ---------- Ideen-Liste ---------- */
(function () {
  const $ = id => document.getElementById(id);
  const list = $('ideaList'), nameEl = $('ideaName');

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  async function render() {
    let ideas = [];
    try { ideas = await AppDB.all('ideas'); } catch (e) {}
    ideas.sort((a, b) => b.ts - a.ts);
    if (!ideas.length) { list.innerHTML = '<p class="pattern-desc">Noch keine Ideen. Nimm einen Loop auf und tippe auf „Speichern“.</p>'; return; }
    list.innerHTML = ideas.map(i => `
      <div class="idea-row" data-id="${esc(i.id)}">
        <div class="idea-main">
          <div class="idea-name">${esc(i.name)}</div>
          <div class="log-meta" style="text-align:left">${esc(i.root)} ${esc(i.mode)} · ${String(Math.round(i.bpm * 10) / 10).replace('.', ',')} BPM · ${i.session ? i.session.tracks.filter(Boolean).length + ' Spur' + (i.session.tracks.filter(Boolean).length === 1 ? '' : 'en') + ' · ' : ''}${i.drumState ? 'Drums: ' + esc(i.drumState.name) + ' · ' : (i.drums ? 'Drums · ' : '')}${i.droneState ? 'Drone · ' : ''}${(+i.secs || 0).toFixed(1).replace('.', ',')} s · ${esc(i.dateStr)}</div>
        </div>
        <div class="idea-actions">
          <button class="toggle-btn" data-act="load">Laden</button>
          <button class="toggle-btn" data-act="share">Teilen</button>
          <button class="toggle-btn" data-act="del">Löschen</button>
        </div>
      </div>`).join('');
  }

  const withDrums = $('ideaWithDrums'), withDrone = $('ideaWithDrone');
  const pl = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const ps = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  withDrums.checked = pl('3nps-idea-drums', '1') === '1'; withDrone.checked = pl('3nps-idea-drone', '1') === '1';
  withDrums.addEventListener('change', () => ps('3nps-idea-drums', withDrums.checked ? '1' : '0'));
  withDrone.addEventListener('change', () => ps('3nps-idea-drone', withDrone.checked ? '1' : '0'));
  $('ideaSave').addEventListener('click', async () => {
    const sess = Looper.getSession(); if (!sess) return;
    const m = Looper.sessionMix(sess);
    const now = new Date();
    const name = nameEl.value.trim() || ('Idee ' + now.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
    const drumState = withDrums.checked ? Rhythm.getState() : null, droneState = withDrone.checked ? Looper.getDroneState() : null;
    try {
      await AppDB.put('ideas', {
        id: newId(), v: 2, name, ts: now.getTime(),
        dateStr: now.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        root: rootSel.value, mode: modeSel.value, bpm: parseFloat($('bpm').value), secs: m.secs,
        session: sess, drumState, droneState
      });
      nameEl.value = '';
      const n = sess.tracks.filter(Boolean).length;
      $('loopStatus').textContent = 'Gespeichert als „' + name + '“: ' + n + ' Spur' + (n === 1 ? '' : 'en') + (drumState ? ', Drums (' + drumState.name + ')' : '') + (droneState ? ', Drone' : '') + '.';
      render();
    } catch (e) {
      $('loopStatus').textContent = 'Speichern fehlgeschlagen. Ist der Gerätespeicher voll?';
    }
  });

  list.addEventListener('click', async e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const row = btn.closest('.idea-row'); const id = row.dataset.id;
    const idea = await AppDB.get('ideas', id); if (!idea) return;
    const act = btn.dataset.act;
    if (act === 'load') {
      ensureAudio();
      rootSel.value = idea.root; modeSel.value = idea.mode; rebuild();
      rootSel.dispatchEvent(new Event('change'));
      $('bpm').value = idea.bpm; $('bpm').dispatchEvent(new Event('input'));
      if (idea.session) {
        Looper.loadSession(idea.session);
        if (idea.drumState) Rhythm.setState(idea.drumState);
        if (idea.droneState) Looper.setDroneState(idea.droneState);
        const n = idea.session.tracks.filter(Boolean).length;
        $('loopStatus').textContent = '„' + idea.name + '“ geladen: ' + n + ' Spur' + (n === 1 ? '' : 'en') + (idea.drumState ? ', Drums' : '') + (idea.droneState ? ', Drone' : '') + ', Tonart und Tempo.';
      } else {
        const buf = await audioCtx.decodeAudioData(await idea.wav.arrayBuffer());
        const l0 = new Float32Array(buf.getChannelData(0));
        Looper.loadSamples(buf.numberOfChannels > 1 ? { l: l0, r: new Float32Array(buf.getChannelData(1)), length: l0.length } : l0);
        $('loopStatus').textContent = '„' + idea.name + '“ liegt auf Spur 1. Tonart und Tempo sind übernommen.';
      }
    } else if (act === 'share') {
      const wav = idea.wav || (await Looper.sessionMixEq(idea.session)).wav;
      const file = new File([wav], idea.name.replace(/[\\/:*?"<>|]/g, '_') + '.wav', { type: 'audio/wav' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: idea.name }); } catch (err) {}
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } else if (act === 'del') {
      if (btn.dataset.armed !== '1') {
        btn.dataset.armed = '1'; btn.textContent = 'Sicher?'; btn.classList.add('danger');
        setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Löschen'; btn.classList.remove('danger'); }, 2500);
        return;
      }
      await AppDB.del('ideas', id); render();
    }
  });

  render();
  Looper.update();
})();

/* ---------- Nach Absturz oder Neuladen: letzte Sitzung anbieten ---------- */
(() => {
  const $ = id => document.getElementById(id);
  const bar = $('restoreBar'); if (!bar) return;
  let saved = null;
  async function check() {
    try { saved = await AppDB.get('meta', 'autosave'); } catch (e) { saved = null; }
    const n = saved && saved.session ? saved.session.tracks.filter(Boolean).length : 0;
    if (!n || Looper.debug().tracks.some(t => t.L)) { Looper.autosaveOn(true); return; }
    const d = new Date(saved.ts);
    $('restoreText').textContent = 'Letzte Sitzung von ' + d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' gefunden (' + n + ' Spur' + (n === 1 ? '' : 'en') + ').';
    bar.hidden = false;
  }
  $('restoreYes').addEventListener('click', () => {
    if (!saved) return;
    ensureAudio();
    if (saved.root) { rootSel.value = saved.root; modeSel.value = saved.mode; rebuild(); rootSel.dispatchEvent(new Event('change')); }
    if (saved.bpm) { $('bpm').value = saved.bpm; $('bpm').dispatchEvent(new Event('input')); }
    Looper.loadSession(saved.session);
    if (saved.drumState) Rhythm.setState(saved.drumState);
    if (saved.droneState) Looper.setDroneState(saved.droneState);
    bar.hidden = true; Looper.autosaveOn(true);
    $('loopStatus').textContent = 'Letzte Sitzung wiederhergestellt. Drums und Drone sind aus – bei Bedarf wieder einschalten.';
  });
  $('restoreNo').addEventListener('click', async () => { bar.hidden = true; try { await AppDB.del('meta', 'autosave'); } catch (e) {} Looper.autosaveOn(true); });
  setTimeout(check, 600);
})();

