// ---------- Studio: Aufnahme (mit Latenz-Ausgleich, Vorzähler, Ersetzen) ----------
const Rec = (() => {
  const REC_SRC = `
class StudioRec extends AudioWorkletProcessor {
  constructor() { super(); this.on = false; this.from = 0; this.st = true; this.L = new Float32Array(16384); this.R = new Float32Array(16384); this.n = 0; this.pk = 0; this.t = 0;
    this.port.onmessage = e => { const d = e.data; if (d.t === 'start') { this.on = true; this.from = d.from; this.st = d.stereo; this.n = 0; } else if (d.t === 'stop') { this.flush(); this.on = false; this.port.postMessage({ t: 'end' }); } }; }
  flush() { if (!this.n) return; const l = this.L.slice(0, this.n), r = this.st ? this.R.slice(0, this.n) : null; this.port.postMessage({ t: 'data', l, r }, r ? [l.buffer, r.buffer] : [l.buffer]); this.n = 0; }
  process(ins) {
    const i = ins[0]; if (!i || !i[0]) return true; const a = i[0], b = i[1] || i[0];
    for (let k = 0; k < a.length; k++) { const v = Math.max(Math.abs(a[k]), Math.abs(b[k])); if (v > this.pk) this.pk = v; }
    if (++this.t % 6 === 0) { this.port.postMessage({ t: 'lvl', v: this.pk }); this.pk = 0; }
    if (!this.on) return true;
    let s = 0; if (currentFrame < this.from) { s = this.from - currentFrame; if (s >= a.length) return true; }
    for (let k = s; k < a.length; k++) { this.L[this.n] = a[k]; this.R[this.n] = b[k]; if (++this.n === 16384) this.flush(); }
    return true;
  }
}
registerProcessor('studio-rec', StudioRec);`;
  let cyc = null, stream = null, srcN = null, node = null, mon = null, w = null, on = false, pos0 = 0, trackId = null, lvl = 0, pend = Promise.resolve(), cycWas = null, endWait = null;
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  function latMs() {
    const own = parseFloat(pref('3nps-studio-lat', '')); if (isFinite(own)) return own;
    const lp = parseFloat(pref('3nps-latency', '')); if (isFinite(lp)) return lp;     // im Looper eingemessen
    const ac = Engine.ac(); return Math.round(((ac.baseLatency || 0) + (ac.outputLatency || 0)) * 1000 + 15);
  }
  async function openMic() {
    const ac = await Engine.ensure();
    if (stream && stream.getAudioTracks().some(t => t.readyState === 'live')) return ac;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Dieses Gerät erlaubt hier keine Aufnahme. Öffne das Studio über das Icon auf dem Home-Bildschirm.');
    if (navigator.audioSession) { try { navigator.audioSession.type = 'play-and-record'; } catch (e) {} }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: ac.sampleRate } } }); }
    catch (e) { if (e && e.name === 'NotAllowedError') throw new Error('Kein Zugriff aufs Mikrofon. In den Einstellungen erlauben und nochmal tippen.'); stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    if (!node) { await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([REC_SRC], { type: 'application/javascript' }))); node = new AudioWorkletNode(ac, 'studio-rec', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: 'explicit' }); node.port.onmessage = onMsg; }
    if (srcN) try { srcN.disconnect(); } catch (e) {}
    srcN = ac.createMediaStreamSource(stream); srcN.connect(node);
    return ac;
  }
  function onMsg(e) {
    const d = e.data;
    if (d.t === 'lvl') { lvl = Math.max(lvl * 0.8, d.v); return; }
    if (d.t === 'data' && w) { const ww = w; pend = pend.then(() => ww.push(d.l, d.r || d.l)); return; }
    if (d.t === 'end' && endWait) { const f = endWait; endWait = null; f(); }
  }
  function stereo() { return pref('3nps-studio-recst', '0') === '1'; }
  function target() {
    const P = Proj.P; let t = P.tracks.find(x => x.arm && x.kind === 'audio');
    if (!t) { const s = P.tracks[Proj.tIndex(Arr.V.selTrack)]; if (s && s.kind === 'audio' && !P.regions.some(r => r.track === s.id)) t = s; }
    if (!t) { if (P.tracks.length >= Engine.MAXT) throw new Error('Höchstens ' + Engine.MAXT + ' Spuren.'); t = Proj.addTrack('audio', 'Aufnahme ' + (P.tracks.filter(x => /^Aufnahme/.test(x.name)).length + 1)); }
    if (!t.arm) Proj.editTrack(t.id, x => { x.arm = true; }, { noUndo: true });
    Arr.V.selTrack = t.id; Arr.heads(); return t;
  }
  function monitor(onOff) {
    const G = Engine.graph; if (!G || !srcN) return; if (mon) { try { mon.disconnect(); } catch (e) {} mon = null; }
    if (!onOff) return; const i = Proj.tIndex(trackId || (Proj.P.tracks.find(x => x.arm) || {}).id); if (i < 0 || !G.tr[i]) return;
    mon = Engine.ac().createGain(); mon.gain.value = 1; srcN.connect(mon); mon.connect(G.tr[i].inN);
  }
  async function start() {
    if (on) return; const P = Proj.P;
    const ac = await openMic(); const t = target(); trackId = t.id;
    if (Engine.playing) Engine.stop();
    const sr = ac.sampleRate, countIn = Sched.countIn;
    pos0 = Math.round(Engine.curPos());
    // v121: Takes – im Cycle läuft die Aufnahme über alle Durchgänge weiter (Start am Cycle-Anfang); sonst Cycle aus (lineare Aufnahme)
    cyc = P.cycle.on && P.cycle.b > P.cycle.a && takesOn() ? { a: P.cycle.a, b: P.cycle.b } : null;
    cycWas = P.cycle.on; if (cyc) pos0 = cyc.a; else if (P.cycle.on) { P.cycle.on = false; Engine.setCycle(); }
    const bar = Math.max(1, pos0 - Proj.bar2f(Proj.f2bar(pos0) - 1));   // Länge des Takts vor dem Start (Vorzähler)
    w = SDB.writer(t.name + ' · ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), sr, stereo());
    const pre = countIn ? bar : 0;
    await Engine.seek(Math.max(0, pos0 - pre));
    const pr = countIn && pos0 - pre < 0 ? pre - pos0 : 0;    // Vorzähler vor Takt 1: Klick ohne Transport
    on = true; monitor(pref('3nps-studio-mon', '0') === '1');
    if (pr) { const t0 = ac.currentTime + 0.1, sg = TMap.at(P, 0), spb = sg.spb / sr; for (let k = 0; k * spb < pr / sr - 1e-6; k++) Sched.blip(ac, t0 + k * spb, k % sg.sig === 0); await new Promise(r => setTimeout(r, (pr / sr) * 1000 + 100 - 40)); }
    await Engine.play();
    // Transport-Start = Engine.st.t0; Aufnahmebeginn = Zeitpunkt, an dem die Position pos0 erreicht wird
    const startT = Engine.st.t0 + (pos0 - Engine.st.pos0) / sr;
    node.port.postMessage({ t: 'start', from: Math.round(startT * sr), stereo: stereo() });
    UI.say('● Aufnahme auf „' + t.name + '“ …' + (cyc ? ' Takes: jeder Cycle-Durchgang wird ein Take.' : '') + ' (Stopp mit ▶/■ oder ●)'); UI.sync();
  }
  async function stop() {
    if (!on) return; on = false;
    const end = Engine.curPos(); Engine.stop(); monitor(false);
    await new Promise(r => { endWait = r; node.port.postMessage({ t: 'stop' }); setTimeout(r, 600); });
    await pend; const m = await w.done(); w = null;
    const P = Proj.P; if (cycWas && !cyc) { P.cycle.on = true; Engine.setCycle(); }
    const lat = Math.round(latMs() / 1000 * m.sr);
    if (cyc && m.frames - lat >= cyc.b - cyc.a) return takesDone(m, lat);
    const len = Math.min(m.frames - lat, cyc ? m.frames - lat : end - pos0);
    if (len < m.sr * 0.25) { UI.say('Aufnahme zu kurz – verworfen.'); SDB.delAudio(m.id); UI.sync(); return; }
    const a = pos0, b = pos0 + len;
    Proj.change('regions', p => {
      // Ersetzen: was auf dieser Spur im Bereich liegt, wird ausgeschnitten (wie bei Logic)
      const keep = [];
      p.regions.forEach(r => {
        if (r.track !== trackId || r.start >= b || r.start + r.len <= a) { keep.push(r); return; }
        if (r.start < a) { const x = JSON.parse(JSON.stringify(r)); x.len = a - r.start; x.fo = Math.min(x.fo || 0, x.len / 2); keep.push(x); }
        if (r.start + r.len > b) { const x = JSON.parse(JSON.stringify(r)); x.id = Proj.nid('r'); const cut = b - r.start; x.start = b; x.len = r.len - cut; x.fi = 0; if (x.kind === 'audio') x.offset = (r.offset || 0) + cut; keep.push(x); }
      });
      const t = p.tracks[Proj.tIndex(trackId)];
      keep.push({ id: Proj.nid('r'), track: trackId, kind: 'audio', audio: m.id, start: a, offset: lat, len, gain: 0, fi: 64, fo: 256, name: t ? t.name : 'Aufnahme' });
      p.regions = keep;
    });
    Engine.dirty(); Engine.seek(a); UI.say('Aufnahme gespeichert: ' + (Math.round(len / m.sr * 10) / 10).toString().replace('.', ',') + ' s (Latenz-Ausgleich ' + Math.round(latMs()) + ' ms).'); UI.sync(); Arr.kick();
  }
  // v121: Takes aus einer Cycle-Aufnahme – Durchgang k = Bilder [lat + k·L, lat + (k+1)·L) derselben Datei
  function takesDone(m, lat) {
    const a = cyc.a, b = cyc.b, L = b - a, tot = m.frames - lat, full = Math.floor(tot / L), rest = tot - full * L;
    const n = full + (rest >= Math.max(m.sr, L * 0.25) ? 1 : 0);
    let nr = 0;
    Proj.change('regions', p => {
      const t = p.tracks[Proj.tIndex(trackId)];
      // gleicher Bereich schon da (Take-Ordner oder Region genau im Cycle) → weitere Takes in denselben Ordner
      let f = p.regions.find(r => r.track === trackId && r.kind === 'audio' && r.start === a && r.len === L && !(r.offset && r.takes));
      const keep = [];
      p.regions.forEach(r => {
        if (r === f || r.track !== trackId || r.start >= b || r.start + r.len <= a) { keep.push(r); return; }
        if (r.start < a) { const x = JSON.parse(JSON.stringify(r)); x.len = a - r.start; x.fo = Math.min(x.fo || 0, x.len / 2); keep.push(x); }
        if (r.start + r.len > b) { const x = JSON.parse(JSON.stringify(r)); x.id = Proj.nid('r'); const cut = b - r.start; x.start = b; x.len = r.len - cut; x.fi = 0; if (x.kind === 'audio') x.offset = (r.offset || 0) + cut; keep.push(x); }
      });
      if (f && !f.takes) { f.takes = [{ id: Proj.nid('k'), name: 'Take 1', audio: f.audio, offset: f.offset || 0 }]; f.offset = 0; f.tlen = L; f.comp = null; f.fi = 64; f.fo = 256; }
      if (!f) { f = { id: Proj.nid('r'), track: trackId, kind: 'audio', audio: m.id, start: a, offset: 0, len: L, tlen: L, gain: 0, fi: 64, fo: 256, name: t ? t.name : 'Aufnahme', takes: [] }; keep.push(f); }
      const n0 = f.takes.length;
      for (let k = 0; k < n; k++) f.takes.push({ id: Proj.nid('k'), name: 'Take ' + (n0 + k + 1), audio: m.id, offset: lat + k * L, len: k < full ? L : rest, pass: k + 1 });
      // Comp: zuletzt vollständig aufgenommener Take (wie in Logic)
      const lastFull = f.takes[n0 + Math.max(0, full - 1)];
      f.comp = [{ a: 0, b: L, k: lastFull.id }]; f.audio = lastFull.audio; f.name = (t ? t.name : 'Aufnahme') + ' · ' + f.takes.length + ' Takes';
      p.regions = keep; nr = f.takes.length;
      if (t) t.takesOpen = true;
    });
    Engine.dirty(); Engine.seek(a); Arr.heads();
    UI.say('Aufnahme gespeichert: ' + n + ' Take' + (n === 1 ? '' : 's') + ' (insgesamt ' + nr + '). Unter der Spur antippen/wischen, welcher Take wo klingt.'); UI.sync(); Arr.kick();
  }
  const takesOn = () => pref('3nps-studio-takes', '1') === '1';
  function setTakes(v) { setPref('3nps-studio-takes', v ? '1' : '0'); }
  // Einstellungen (aus dem Spur-Dock)
  function settings() {
    UI.dialog('<h2>Aufnahme</h2><div class="fxp"><div class="card"><b>Eingang</b><label><span>Stereo aufnehmen (sonst Mono)</span><input type="checkbox" id="rSt"' + (stereo() ? ' checked' : '') + '></label><label><span>Mithören über das Studio (nur mit Kopfhörer)</span><input type="checkbox" id="rMon"' + (pref('3nps-studio-mon', '0') === '1' ? ' checked' : '') + '></label><label><span>1 Takt Vorzähler</span><input type="checkbox" id="rCi"' + (Sched.countIn ? ' checked' : '') + '></label><label><span>Takes im Cycle (jeder Durchgang ein Take, statt ersetzen)</span><input type="checkbox" id="rTk"' + (takesOn() ? ' checked' : '') + '></label>' +
      '<label><span>Pegel</span><canvas id="rLv" style="width:120px;height:10px;background:#0c0c0e;border-radius:3px"></canvas></label></div>' +
      '<div class="card"><b>Latenz-Ausgleich</b><label><span>Verschiebung</span><b id="rLo">' + Math.round(latMs()) + ' ms</b></label><input type="range" id="rLat" min="0" max="300" step="1" value="' + Math.round(latMs()) + '"><p class="note">Übernommen aus dem Looper („Latenz“), wenn dort eingemessen. Klingt die Aufnahme zu spät, Wert erhöhen.</p><button class="btn" id="rLr">Wie im Looper</button></div></div>' +
      '<p class="note">Aufnehmen: Spur mit „R“ scharf schalten (oder Spur wählen), Abspielposition setzen, ● tippen. Bereits Aufgenommenes in dem Bereich wird ersetzt – ↶ holt es zurück.</p><div class="btns"><button class="btn p" data-close>Fertig</button></div>');
    const $ = id => document.getElementById(id);
    $('rSt').onchange = e => setPref('3nps-studio-recst', e.target.checked ? '1' : '0');
    $('rMon').onchange = e => { setPref('3nps-studio-mon', e.target.checked ? '1' : '0'); if (on) monitor(e.target.checked); };
    $('rCi').onchange = e => { Sched.countIn = e.target.checked; };
    $('rTk').onchange = e => { setTakes(e.target.checked); UI.sync(); };
    $('rLat').oninput = e => { setPref('3nps-studio-lat', e.target.value); $('rLo').textContent = e.target.value + ' ms'; };
    $('rLr').onclick = () => { try { localStorage.removeItem('3nps-studio-lat'); } catch (e) {} $('rLat').value = Math.round(latMs()); $('rLo').textContent = Math.round(latMs()) + ' ms'; };
    openMic().catch(e => UI.say(e.message));
    const cv = $('rLv'); (function draw() { if (!cv.isConnected) return; const g = cv.getContext('2d'), wd = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight; g.fillStyle = lvl > 0.9 ? '#ff5d5d' : '#3ad07a'; g.fillRect(0, 0, wd * Math.min(1, Math.sqrt(lvl)), h); requestAnimationFrame(draw); })();
  }
  return { start, stop, settings, takesOn, setTakes, active: () => on, startPos: () => pos0, track: () => trackId, latMs, get level() { return lvl; } };
})();
window.Rec = Rec;
