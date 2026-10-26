// ---------- Studio: Klang-Engine ----------
// Audio-Regionen werden blockweise (32768 Bilder, an der Zeitleiste ausgerichtet) aus dem Gerätespeicher gelesen und
// an ein AudioWorklet geschickt, das sie je Spur ausgibt. Jede Spur hat eine eigene Kette aus Web-Audio-Knoten
// (Sättigung, EQ, Kompressor, Panorama, Lautstärke, Sends). MIDI/Drums werden im Hauptthread mit Vorlauf geplant.
const WORKLET_SRC = `
class StudioEng extends AudioWorkletProcessor {
  constructor(o) { super(); this.n = o.processorOptions.n; this.ch = []; for (let i = 0; i < this.n; i++) this.ch.push(new Map());
    this.play = false; this.pos = 0; this.at = 0; this.cyc = null; this.tick = 0; this.pk = new Float32Array(this.n);
    this.port.onmessage = e => { const d = e.data;
      if (d.t === 'chunk') { const m = this.ch[d.tr]; if (m) m.set(d.k, d); }
      else if (d.t === 'drop') d.keys.forEach(k => { const [tr] = k.split(':'); const m = this.ch[+tr]; if (m) m.delete(k); });
      else if (d.t === 'clear') this.ch.forEach(m => m.clear());
      else if (d.t === 'play') { this.play = true; this.pos = d.pos; this.at = d.at; }
      else if (d.t === 'stop') this.play = false;
      else if (d.t === 'seek') this.pos = d.pos;
      else if (d.t === 'cycle') this.cyc = d.on ? [d.a, d.b] : null; }; }
  process(ins, outs) {
    const N = 128; if (!this.play || currentFrame + N <= this.at) { if (++this.tick % 8 === 0) this.port.postMessage({ t: 'pos', pos: this.pos, play: false, pk: Array.from(this.pk.fill(0)) }); return true; }
    let i0 = Math.max(0, this.at - currentFrame), p = this.pos;
    // Abschnitte innerhalb des Blocks (Cycle-Sprung)
    const segs = []; let i = i0;
    while (i < N) { let len = N - i; if (this.cyc && p < this.cyc[1]) len = Math.min(len, this.cyc[1] - p); segs.push([i, p, len]); i += len; p += len; if (this.cyc && p >= this.cyc[1]) p = this.cyc[0]; }
    this.pos = p;
    for (let t = 0; t < this.n; t++) {
      const o = outs[t]; if (!o || !o[0]) continue; const L = o[0], R = o[1] || o[0]; let pk = this.pk[t];
      for (const [s0, f0, len] of segs) for (const c of this.ch[t].values()) {
        const a = Math.max(f0, c.at), b = Math.min(f0 + len, c.at + c.len); if (b <= a) continue;
        const cl = c.l, cr = c.r || c.l;
        for (let f = a; f < b; f++) { const x = cl[f - c.at], y = cr[f - c.at], j = s0 + f - f0; L[j] += x; R[j] += y; const m = x > 0 ? x : -x; if (m > pk) pk = m; }
      }
      this.pk[t] = pk;
    }
    if (++this.tick % 8 === 0) { this.port.postMessage({ t: 'pos', pos: this.pos, cf: currentFrame, play: true, pk: Array.from(this.pk) }); this.pk.fill(0); }
    return true;
  }
}
registerProcessor('studio-eng', StudioEng);`;

const Engine = (() => {
  const B = 32768, MAXT = 24;
  let ctx = null, node = null, P = null, G = null, wUrl = null;
  const st = { playing: false, pos: 0, pos0: 0, t0: 0, pk: new Float32Array(MAXT), lastMsg: 0 };
  const sent = new Map();           // 'tr:k' → Version
  let ver = 1, feeding = false, timer = null;
  const listeners = { tick: [] };
  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
      ctx.onstatechange = () => {};
    }
    return ctx;
  }
  async function ensure() {
    ac(); if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
    if (!node) {
      wUrl = wUrl || URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(wUrl);
      node = new AudioWorkletNode(ctx, 'studio-eng', { numberOfInputs: 0, numberOfOutputs: MAXT, outputChannelCount: new Array(MAXT).fill(2), processorOptions: { n: MAXT } });
      node.port.onmessage = e => { const d = e.data; if (d.t === 'pos') { st.wpos = d.pos; if (d.cf) st.wcf = d.cf; st.lastMsg = ctx.currentTime; d.pk.forEach((v, i) => { st.pk[i] = Math.max(st.pk[i] * 0.85, v); }); } };
      if (P) build();
    }
    return ctx;
  }
  // ---------- Graph ----------
  function satCurve(drive) { const n = 2048, c = new Float32Array(n), k = 1 + drive * 8; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
  function irBuf(c, sec) {
    const sr = c.sampleRate, n = Math.round(sr * sec), b = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0, s = 1234567 + ch * 999; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; const w = s / 1073741823.5 - 1; const t = i / sr; lp += (w - lp) * (0.9 - 0.6 * t / sec); d[i] = lp * Math.pow(1 - i / n, 2.2) * (t < 0.01 ? t / 0.01 : 1) * 0.5; } }
    return b;
  }
  function makeGraph(c, proj, src) {
    const g = { tr: [], c };
    const m = proj.master || {};
    const mIn = c.createGain(), mEq = EQ7.chain(c), glue = c.createDynamicsCompressor(), lim = c.createDynamicsCompressor(), mVol = c.createGain(), meter = c.createAnalyser();
    meter.fftSize = 1024; mIn.connect(mEq.input); mEq.output.connect(glue); glue.connect(lim); lim.connect(mVol); mVol.connect(c.destination); mVol.connect(meter);
    g.master = { mIn, mEq, glue, lim, mVol, meter };
    // Busse: Hall und Delay
    const rev = c.createConvolver(); rev.buffer = irBuf(c, (proj.bus && proj.bus.revSec) || 2.4); const revG = c.createGain(); rev.connect(revG); revG.connect(mIn);
    const dly = c.createDelay(4), dfb = c.createGain(), dlp = c.createBiquadFilter(), dG = c.createGain(); dlp.type = 'lowpass'; dlp.frequency.value = 4200;
    dly.connect(dlp); dlp.connect(dfb); dfb.connect(dly); dlp.connect(dG); dG.connect(mIn);
    g.bus = { rev, revG, dly, dfb, dG };
    proj.tracks.forEach((t, i) => {
      const inN = c.createGain(), sat = c.createWaveShaper(), eq = EQ7.chain(c), comp = c.createDynamicsCompressor(), mk = c.createGain(), pan = c.createStereoPanner(), vol = c.createGain(), mute = c.createGain(), sR = c.createGain(), sD = c.createGain(), an = c.createAnalyser();
      an.fftSize = 512; sat.oversample = '2x';
      inN.connect(sat); sat.connect(eq.input); eq.output.connect(comp); comp.connect(mk); mk.connect(pan); pan.connect(vol); vol.connect(mute); mute.connect(mIn); mute.connect(an);
      mute.connect(sR); sR.connect(rev); mute.connect(sD); sD.connect(dly);
      if (src && i < MAXT) src.connect(inN, i, 0);
      g.tr.push({ id: t.id, inN, sat, eq, comp, mk, pan, vol, mute, sR, sD, an });
    });
    applyAll(g, proj);
    return g;
  }
  const db2g = d => Math.pow(10, d / 20);
  function applyTrack(g, proj, i, smooth) {
    const t = proj.tracks[i], n = g.tr[i]; if (!t || !n) return; const now = g.c.currentTime, P2 = (p, v) => smooth ? p.setTargetAtTime(v, now, 0.02) : p.setValueAtTime(v, now);
    const fx = t.fx || {}, cp = fx.comp || {}, sa = fx.sat || {};
    n.sat.curve = sa.on ? satCurve((sa.drive || 30) / 100) : null;
    n.eq.set(t.eq || EQ7.flat(), smooth);
    const on = !!cp.on; n.comp.threshold.value = on ? (cp.th != null ? cp.th : -18) : 0; n.comp.ratio.value = on ? (cp.ratio || 3) : 1; n.comp.knee.value = on ? 6 : 0;
    n.comp.attack.value = (cp.att || 10) / 1000; n.comp.release.value = (cp.rel || 120) / 1000;
    P2(n.mk.gain, on ? db2g(cp.mk || 0) : 1);
    if (!(t.auto && t.auto.pan && t.auto.pan.length && st.playing)) P2(n.pan.pan, (t.pan || 0) / 100);
    if (!(t.auto && t.auto.vol && t.auto.vol.length && st.playing)) P2(n.vol.gain, db2g(t.vol != null ? t.vol : 0));
    const anySolo = proj.tracks.some(x => x.solo); P2(n.mute.gain, t.mute || (anySolo && !t.solo) ? 0 : 1);
    P2(n.sR.gain, (fx.rev || 0) / 100); P2(n.sD.gain, (fx.dly || 0) / 100);
  }
  function applyMaster(g, proj) {
    const m = proj.master || {}, M = g.master; M.mEq.set(m.eq || EQ7.flat());
    const gl = m.glue !== false; M.glue.threshold.value = gl ? -14 : 0; M.glue.ratio.value = gl ? 2 : 1; M.glue.attack.value = 0.02; M.glue.release.value = 0.2; M.glue.knee.value = 6;
    const li = m.lim !== false; M.lim.threshold.value = li ? -1.5 : 0; M.lim.ratio.value = li ? 20 : 1; M.lim.attack.value = 0.002; M.lim.release.value = 0.08; M.lim.knee.value = 0;
    M.mVol.gain.value = db2g(m.vol || 0);
    const b = proj.bus || {}; g.bus.revG.gain.value = 1; g.bus.dly.delayTime.value = Math.min(3.9, 60 / proj.bpm * (b.dlyBeats || 0.75)); g.bus.dfb.gain.value = (b.dlyFb != null ? b.dlyFb : 35) / 100; g.bus.dG.gain.value = 0.8;
  }
  function applyAll(g, proj) { proj.tracks.forEach((t, i) => applyTrack(g, proj, i)); applyMaster(g, proj); }
  function build() {
    if (!ctx || !node || !P) return;
    if (G) { try { G.tr.forEach(n => { n.inN.disconnect(); n.mute.disconnect(); }); G.master.mVol.disconnect(); G.master.mIn.disconnect(); } catch (e) {} try { node.disconnect(); } catch (e) {} }
    G = makeGraph(ctx, P, node);
    if (window.Inst) Inst.attach(G);
  }
  // ---------- Feeder ----------
  const regEnd = r => r.start + r.len;
  async function blockData(proj, ti, k) {
    const t = proj.tracks[ti], a = k * B, b = a + B; let L = null, R = null;
    for (const r of proj.regions) {
      if (r.track !== t.id || r.kind !== 'audio' || r.muted) continue;
      const s = Math.max(a, r.start), e = Math.min(b, regEnd(r)); if (e <= s) continue;
      const d = await SDB.read(r.audio, r.offset + (s - r.start), e - s);
      if (!L) { L = new Float32Array(B); R = new Float32Array(B); }
      const g = db2g(r.gain || 0), fi = r.fi || 0, fo = r.fo || 0;
      for (let f = s; f < e; f++) {
        let w = g; const p = f - r.start;
        if (fi && p < fi) w *= Math.sin(Math.PI / 2 * p / fi);
        if (fo && p > r.len - fo) w *= Math.sin(Math.PI / 2 * Math.max(0, r.len - p) / fo);
        const j = f - s; L[f - a] += d.l[j] * w; R[f - a] += d.r[j] * w;
      }
    }
    return L ? { l: L, r: R } : null;
  }
  function wanted(pos, ahead) {
    const sr = ctx.sampleRate, out = new Set(), cyc = P.cycle && P.cycle.on && P.cycle.b > P.cycle.a ? P.cycle : null;
    let p = pos, left = Math.round(ahead * sr);
    // zurückliegender Block bleibt
    out.add(Math.floor(Math.max(0, pos - 2048) / B));
    for (let guard = 0; left > 0 && guard < 50; guard++) {
      let end = p + left; if (cyc && p < cyc.b) end = Math.min(end, cyc.b);
      if (end <= p) break;
      for (let k = Math.floor(p / B); k * B < end; k++) out.add(k);
      left -= end - p; p = end; if (cyc && p >= cyc.b) p = cyc.a;
    }
    if (cyc && cyc.b - cyc.a < sr * 90) for (let k = Math.floor(cyc.a / B); k * B < cyc.b; k++) out.add(k);   // kurzer Cycle: ganz behalten
    return out;
  }
  async function feed(quick) {
    if (feeding || !P || !node) return; feeding = true;
    try {
      const pos = curPos(), ks = [...wanted(pos, quick ? 0.6 : st.playing ? 4 : 1.5)].sort((a, b) => a - b), keep = new Set(), nt = Math.min(MAXT, P.tracks.length);
      // Block für Block, alle Spuren gleichzeitig lesen (der nächste Block zuerst)
      for (const k of ks) {
        const v0 = ver, jobs = [];
        for (let ti = 0; ti < nt; ti++) {
          if (P.tracks[ti].kind !== 'audio') continue;
          const key = ti + ':' + k; keep.add(key);
          if (sent.get(key) === ver) continue;
          jobs.push(quick ? blockData(P, ti, k).then(d => ({ key, ti, d })) : { key, ti });
        }
        if (!jobs.length) continue;
        let res;
        if (quick) res = await Promise.all(jobs);           // beim Start: alles gleichzeitig (schneller Start)
        else { res = []; for (const j of jobs) { j.d = await blockData(P, j.ti, k); res.push(j); if (v0 !== ver) break; } }   // sonst nacheinander (Bildschirm bleibt flüssig)
        if (v0 !== ver) break;
        res.forEach(({ key, ti, d }) => {
          if (d) node.port.postMessage({ t: 'chunk', tr: ti, k: key, at: k * B, len: B, l: d.l, r: d.r }, [d.l.buffer, d.r.buffer]);
          else node.port.postMessage({ t: 'drop', keys: [key] });
          sent.set(key, ver);
        });
      }
      if (!quick) { const drop = []; for (const key of sent.keys()) if (!keep.has(key)) { drop.push(key); sent.delete(key); } if (drop.length) node.port.postMessage({ t: 'drop', keys: drop }); }
    } finally { feeding = false; }
  }
  // Nach Änderungen: neu laden (Version erhöhen); der Worklet-Inhalt wird blockweise ersetzt
  function dirty(rebuild) { ver++; if (rebuild) build(); else if (G) applyAll(G, P); feed(); }
  // ---------- Transport ----------
  function curPos() {
    if (!st.playing || !ctx) return st.pos;
    let p = st.pos0 + Math.max(0, ctx.currentTime - st.t0) * ctx.sampleRate;
    const c = P && P.cycle; if (c && c.on && c.b > c.a && p >= c.b) p = c.a + ((p - c.a) % (c.b - c.a));
    return Math.round(p);
  }
  let bc = null; try { bc = new BroadcastChannel('3nps-audio'); bc.onmessage = e => { if (e.data === 'looper-stopped') { window.__looperAck = true; if (window.UI && UI.say) UI.say('Looper im Hintergrund angehalten ✓'); } }; } catch (e) {}
  const hush = () => { try { bc && bc.postMessage('studio'); } catch (e) {} };   // v110: Looper (falls er noch läuft) verstummen lassen
  hush();
  async function play() {
    await ensure(); if (st.playing) return;
    hush();
    await feed(true);
    const at = ctx.currentTime + 0.12; st.t0 = at; st.pos0 = st.pos; st.playing = true;
    node.port.postMessage({ t: 'cycle', on: !!(P.cycle && P.cycle.on && P.cycle.b > P.cycle.a), a: P.cycle ? P.cycle.a : 0, b: P.cycle ? P.cycle.b : 0 });
    node.port.postMessage({ t: 'play', pos: st.pos, at: Math.round(at * ctx.sampleRate) });
    if (window.Sched) Sched.start(st.pos, at);
    clearInterval(timer); timer = setInterval(() => { feed(); listeners.tick.forEach(f => f()); }, 90);
  }
  function stop() {
    if (!st.playing) return; st.pos = curPos(); st.playing = false; node && node.port.postMessage({ t: 'stop' });
    if (window.Sched) Sched.stop(); clearInterval(timer); timer = null; listeners.tick.forEach(f => f());
    if (G) applyAll(G, P);
  }
  async function seek(pos) {
    const was = st.playing; if (was) stop();
    st.pos = Math.max(0, Math.round(pos)); if (node) node.port.postMessage({ t: 'seek', pos: st.pos });
    if (was) await play(); else { feed(); listeners.tick.forEach(f => f()); }
  }
  function setCycle() { if (node && P) node.port.postMessage({ t: 'cycle', on: !!(P.cycle && P.cycle.on && P.cycle.b > P.cycle.a), a: P.cycle ? P.cycle.a : 0, b: P.cycle ? P.cycle.b : 0 }); if (st.playing && window.Sched) Sched.resync(); feed(); }
  function setProject(p) { stop(); P = p; st.pos = 0; sent.clear(); ver++; if (node) { node.port.postMessage({ t: 'clear' }); build(); } }
  // Pegel: Spur (Analyser, nach Fader) – Spitze 0…1
  const tbuf = new Float32Array(512);
  function level(i) { if (!G || !G.tr[i]) return 0; G.tr[i].an.getFloatTimeDomainData(tbuf); let m = 0; for (let k = 0; k < 512; k += 2) { const v = Math.abs(tbuf[k]); if (v > m) m = v; } return m; }
  const mbuf = new Float32Array(1024);
  function masterLevel() { if (!G) return 0; G.master.meter.getFloatTimeDomainData(mbuf); let m = 0; for (let k = 0; k < 1024; k += 2) { const v = Math.abs(mbuf[k]); if (v > m) m = v; } return m; }
  return {
    ac, ensure, play, stop, seek, curPos, setProject, dirty, setCycle, level, masterLevel, makeGraph, applyTrack: (i, s) => G && applyTrack(G, P, i, s), applyMaster: () => G && applyMaster(G, P),
    blockData, B, MAXT, WORKLET_SRC, get graph() { return G; }, get playing() { return st.playing; }, get project() { return P; }, on: (ev, f) => listeners[ev].push(f), sr: () => ac().sampleRate, st
  };
})();
