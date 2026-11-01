// ---------- Studio: Klang-Engine ----------
// Audio-Regionen werden blockweise (32768 Bilder, an der Zeitleiste ausgerichtet) aus dem Gerätespeicher gelesen und
// an ein AudioWorklet geschickt, das sie je Spur ausgibt. Jede Spur hat eine eigene Kette aus Web-Audio-Knoten
// (Sättigung, EQ, Kompressor, Panorama, Lautstärke, Sends). MIDI/Drums werden im Hauptthread mit Vorlauf geplant.
const WORKLET_SRC = `
class StudioEng extends AudioWorkletProcessor {
  constructor(o) { super(); this.n = o.processorOptions.n; this.ch = []; for (let i = 0; i < this.n; i++) this.ch.push(new Map());
    this.play = false; this.pos = 0; this.at = 0; this.cyc = null; this.tick = 0; this.pk = new Float32Array(this.n);
    const ini = o.processorOptions.init; if (ini) { (ini.chunks || []).forEach(d => { const m = this.ch[d.tr]; if (m) m.set(d.k, d); }); if (ini.play) { this.play = true; this.pos = ini.play.pos; this.at = ini.play.at; } }
    this.port.onmessage = e => { const d = e.data;
      if (d.t === 'chunk') { const m = this.ch[d.tr]; if (m) m.set(d.k, d); }
      else if (d.t === 'drop') d.keys.forEach(k => { const [tr] = k.split(':'); const m = this.ch[+tr]; if (m) m.delete(k); });
      else if (d.t === 'clear') this.ch.forEach(m => m.clear());
      else if (d.t === 'play') { this.play = true; this.pos = d.pos; this.at = d.at; this.fresh = true; }
      else if (d.t === 'stop') this.play = false;
      else if (d.t === 'seek') this.pos = d.pos;
      else if (d.t === 'cycle') this.cyc = d.on ? [d.a, d.b] : null;
      else if (d.t === 'ping') this.port.postMessage({ t: 'pong' }); }; }
  process(ins, outs) {
    const N = 128; if (!this.play || currentFrame + N <= this.at) { if (++this.tick % 8 === 0) this.port.postMessage({ t: 'pos', pos: this.pos, play: false, pk: Array.from(this.pk.fill(0)) }); return true; }
    // v121: Start-Nachricht kam zu spät (Offline-Export, Ruckler) → Position nachziehen, damit alles im Zeitplan bleibt
    if (this.fresh) { this.fresh = false; if (currentFrame > this.at) { let q = this.pos + currentFrame - this.at; if (this.cyc && this.pos < this.cyc[1] && q >= this.cyc[1]) q = this.cyc[0] + (q - this.cyc[0]) % (this.cyc[1] - this.cyc[0]); this.pos = q; this.at = currentFrame; } }
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
registerProcessor('studio-eng', StudioEng);
// v121: Kompressor mit Sidechain (Eingang 0 = Signal, Eingang 1 = Steuersignal). Nur bei gewähltem Sidechain im Graph.
class StudioSC extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'th', defaultValue: -18, automationRate: 'k-rate' }, { name: 'ratio', defaultValue: 3, automationRate: 'k-rate' }, { name: 'att', defaultValue: 10, automationRate: 'k-rate' }, { name: 'rel', defaultValue: 120, automationRate: 'k-rate' }, { name: 'knee', defaultValue: 6, automationRate: 'k-rate' }]; }
  constructor() { super(); this.env = 0; this.gr = 0; this.red = 0; this.n = 0; this.end = false; this.port.onmessage = () => { this.end = true; };
    this.D = Math.round(0.006 * sampleRate); this.bl = new Float32Array(this.D + 1); this.br = new Float32Array(this.D + 1); this.w = 0; }   // 6 ms Vorlauf wie der eingebaute Kompressor (gleiche Laufzeit)
  process(ins, outs, p) {
    if (this.end) return false; const x = ins[0], k = ins[1], o = outs[0]; if (!o || !o[0]) return true; const N = o[0].length;
    const th = p.th[0], ra = Math.max(1, p.ratio[0]), kn = Math.max(0, p.knee[0]), aA = Math.exp(-1 / (Math.max(0.1, p.att[0]) * 0.001 * sampleRate)), aR = Math.exp(-1 / (Math.max(1, p.rel[0]) * 0.001 * sampleRate)), dR = Math.exp(-1 / (0.005 * sampleRate));
    const kL = k && k[0], kR = k && (k[1] || k[0]), xL = x && x[0], xR = x && (x[1] || x[0]), oL = o[0], oR = o[1] || o[0];
    let env = this.env, gr = this.gr, mx = 0;
    for (let i = 0; i < N; i++) {
      const a = kL ? Math.max(kL[i] < 0 ? -kL[i] : kL[i], kR[i] < 0 ? -kR[i] : kR[i]) : 0;
      env = a > env ? a : env * dR;
      const lv = env > 1e-6 ? 20 * Math.log10(env) : -120, ov = lv - th;
      let want = 0; if (ov > kn / 2) want = ov * (1 - 1 / ra); else if (kn > 0 && ov > -kn / 2) want = (1 - 1 / ra) * (ov + kn / 2) * (ov + kn / 2) / (2 * kn);
      gr = want > gr ? want + (gr - want) * aA : want + (gr - want) * aR;
      const g = gr > 0.001 ? Math.pow(10, -gr / 20) : 1; if (gr > mx) mx = gr;
      const L = this.D + 1, rd = (this.w + 1) % L; this.bl[this.w] = xL ? xL[i] : 0; this.br[this.w] = xR ? xR[i] : 0; oL[i] = this.bl[rd] * g; if (oR !== oL) oR[i] = this.br[rd] * g; this.w = rd;
    }
    this.env = env; this.gr = gr; this.red = Math.max(mx, this.red * 0.9);
    if (++this.n % 16 === 0) this.port.postMessage(this.red);
    return true;
  }
}
registerProcessor('studio-sc', StudioSC);`;

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
      await ctx.audioWorklet.addModule(wUrl); SC_OK.add(ctx);
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
  // Kanalzug (Spur oder Gruppenbus): Sättigung → EQ7 → Kompressor (oder Sidechain-Kompressor) → Aufholen → Pan → Fader → Mute
  function strip(c, t) {
    const cp = (t.fx || {}).comp || {}, sc = !!(cp.on && cp.sc) && SC_OK.has(c);
    const inN = c.createGain(), sat = c.createWaveShaper(), eq = EQ7.chain(c), comp = sc ? new AudioWorkletNode(c, 'studio-sc', { numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' }) : c.createDynamicsCompressor(),
      mk = c.createGain(), pan = c.createStereoPanner(), vol = c.createGain(), mute = c.createGain(), sR = c.createGain(), sD = c.createGain(), an = c.createAnalyser();
    an.fftSize = 512; sat.oversample = '2x';
    inN.connect(sat); sat.connect(eq.input); eq.output.connect(comp); comp.connect(mk); mk.connect(pan); pan.connect(vol); vol.connect(mute); mute.connect(an);
    if (sc) { comp.sc = true; comp.port.onmessage = e => { comp.red = e.data; }; }
    return { id: t.id, inN, sat, eq, comp, mk, pan, vol, mute, sR, sD, an };
  }
  const SC_OK = new WeakSet();     // Kontexte, in denen 'studio-sc' geladen ist
  function makeGraph(c, proj, src) {
    const g = { tr: [], grp: [], c };
    const m = proj.master || {};
    const mIn = c.createGain(), mEq = EQ7.chain(c), glue = c.createDynamicsCompressor(), lim = c.createDynamicsCompressor(), mVol = c.createGain(), meter = c.createAnalyser();
    meter.fftSize = 1024; mIn.connect(mEq.input); mEq.output.connect(glue); glue.connect(lim); lim.connect(mVol); mVol.connect(c.destination); mVol.connect(meter);
    g.master = { mIn, mEq, glue, lim, mVol, meter };
    // Busse: Hall und Delay
    const rev = c.createConvolver(); rev.buffer = irBuf(c, (proj.bus && proj.bus.revSec) || 2.4); const revG = c.createGain(); rev.connect(revG); revG.connect(mIn);
    const dly = c.createDelay(4), dfb = c.createGain(), dlp = c.createBiquadFilter(), dG = c.createGain(); dlp.type = 'lowpass'; dlp.frequency.value = 4200;
    dly.connect(dlp); dlp.connect(dfb); dfb.connect(dly); dlp.connect(dG); dG.connect(mIn);
    g.bus = { rev, revG, dly, dfb, dG };
    const sends = n => { n.mute.connect(n.sR); n.sR.connect(rev); n.mute.connect(n.sD); n.sD.connect(dly); };
    // v121: Gruppenbusse – nur gebaut, wenn mindestens eine Spur hineinführt (sonst keine Rechenlast)
    const used = new Set(proj.tracks.map(t => t.out).filter(o => o && o !== 'master'));
    (proj.groups || []).forEach(b => { if (!used.has(b.id)) { g.grp.push(null); return; } const n = strip(c, b); n.mute.connect(mIn); sends(n); g.grp.push(n); });
    const gi = id => (proj.groups || []).findIndex(b => b.id === id);
    proj.tracks.forEach((t, i) => {
      const n = strip(c, t), j = t.out && t.out !== 'master' ? gi(t.out) : -1;
      n.mute.connect(j >= 0 && g.grp[j] ? g.grp[j].inN : mIn); sends(n);
      if (src && i < MAXT) src.connect(n.inN, i, 0);
      g.tr.push(n);
    });
    // v121: Sidechain – Steuersignal nach dem Fader der Quelle (vor Mute: stumm geschaltete Quelle duckt weiter)
    const all = g.tr.concat(g.grp.filter(Boolean)), byId = new Map(all.map(n => [n.id, n]));
    [...proj.tracks, ...(proj.groups || [])].forEach(t => {
      const n = byId.get(t.id), cp = (t.fx || {}).comp || {}; if (!n || !n.comp.sc) return;
      const q = byId.get(cp.sc); if (!q || q === n || (t.out && t.out === cp.sc)) return;   // keine Rückkopplung über den eigenen Bus
      q.vol.connect(n.comp, 0, 1);
    });
    applyAll(g, proj);
    return g;
  }
  const db2g = d => Math.pow(10, d / 20);
  function soloState(proj) {
    const gs = proj.groups || [], any = proj.tracks.some(x => x.solo) || gs.some(x => x.solo);
    return { any, tr: t => !t.mute && (!any || t.solo || gs.some(b => b.id === t.out && b.solo)), grp: b => !b.mute && (!any || b.solo || proj.tracks.some(t => t.out === b.id && t.solo)) };
  }
  function applyChan(g, n, t, on, smooth, autoOk) {
    if (!t || !n) return; const now = g.c.currentTime, P2 = (p, v) => smooth ? p.setTargetAtTime(v, now, 0.02) : p.setValueAtTime(v, now);
    const fx = t.fx || {}, cp = fx.comp || {}, sa = fx.sat || {};
    n.sat.curve = sa.on ? satCurve((sa.drive || 30) / 100) : null;
    n.eq.set(t.eq || EQ7.flat(), smooth);
    const cOn = !!cp.on;
    if (n.comp.sc) { const q = n.comp.parameters; q.get('th').value = cp.th != null ? cp.th : -18; q.get('ratio').value = cp.ratio || 3; q.get('att').value = cp.att || 10; q.get('rel').value = cp.rel || 120; q.get('knee').value = 6; }
    else { n.comp.threshold.value = cOn ? (cp.th != null ? cp.th : -18) : 0; n.comp.ratio.value = cOn ? (cp.ratio || 3) : 1; n.comp.knee.value = cOn ? 6 : 0; n.comp.attack.value = (cp.att || 10) / 1000; n.comp.release.value = (cp.rel || 120) / 1000; }
    P2(n.mk.gain, cOn ? db2g(cp.mk || 0) : 1);
    if (!(autoOk && t.auto && t.auto.pan && t.auto.pan.length && st.playing)) P2(n.pan.pan, (t.pan || 0) / 100);
    if (!(autoOk && t.auto && t.auto.vol && t.auto.vol.length && st.playing)) P2(n.vol.gain, db2g(t.vol != null ? t.vol : 0));
    P2(n.mute.gain, on ? 1 : 0);
    P2(n.sR.gain, (fx.rev || 0) / 100); P2(n.sD.gain, (fx.dly || 0) / 100);
  }
  function applyTrack(g, proj, i, smooth) { const S = soloState(proj), t = proj.tracks[i]; if (!t) return; applyChan(g, g.tr[i], t, S.tr(t), smooth, true); applyGroups(g, proj, smooth, S); }
  function applyGroups(g, proj, smooth, S) { S = S || soloState(proj); (proj.groups || []).forEach((b, j) => { if (g.grp[j]) applyChan(g, g.grp[j], b, S.grp(b), smooth, false); }); }
  function applyMaster(g, proj) {
    const m = proj.master || {}, M = g.master; M.mEq.set(m.eq || EQ7.flat());
    const gl = m.glue !== false; M.glue.threshold.value = gl ? -14 : 0; M.glue.ratio.value = gl ? 2 : 1; M.glue.attack.value = 0.02; M.glue.release.value = 0.2; M.glue.knee.value = 6;
    const li = m.lim !== false; M.lim.threshold.value = li ? -1.5 : 0; M.lim.ratio.value = li ? 20 : 1; M.lim.attack.value = 0.002; M.lim.release.value = 0.08; M.lim.knee.value = 0;
    M.mVol.gain.value = db2g(m.vol || 0);
    const b = proj.bus || {}; g.bus.revG.gain.value = 1; g.bus.dly.delayTime.value = Math.min(3.9, 60 / proj.bpm * (b.dlyBeats || 0.75)); g.bus.dfb.gain.value = (b.dlyFb != null ? b.dlyFb : 35) / 100; g.bus.dG.gain.value = 0.8;
  }
  function applyAll(g, proj) { const S = soloState(proj); proj.tracks.forEach((t, i) => applyChan(g, g.tr[i], t, S.tr(t), false, true)); applyGroups(g, proj, false, S); applyMaster(g, proj); }
  function build() {
    if (!ctx || !node || !P) return;
    if (G) { try { G.tr.concat(G.grp.filter(Boolean)).forEach(n => { n.inN.disconnect(); n.mute.disconnect(); if (n.comp.sc) { n.eq.output.disconnect(); n.comp.disconnect(); n.comp.port.postMessage('end'); } }); G.master.mVol.disconnect(); G.master.mIn.disconnect(); } catch (e) {} try { node.disconnect(); } catch (e) {} }
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
      if (!L) { L = new Float32Array(B); R = new Float32Array(B); }
      const g = db2g(r.gain || 0), fi = r.fi || 0, fo = r.fo || 0;
      if (r.takes && r.takes.length) { await takeData(proj, r, s, e, a, L, R, g, fi, fo); continue; }
      const d = await SDB.read(r.audio, r.offset + (s - r.start), e - s);
      for (let f = s; f < e; f++) {
        let w = g; const p = f - r.start;
        if (fi && p < fi) w *= Math.sin(Math.PI / 2 * p / fi);
        if (fo && p > r.len - fo) w *= Math.sin(Math.PI / 2 * Math.max(0, r.len - p) / fo);
        const j = f - s; L[f - a] += d.l[j] * w; R[f - a] += d.r[j] * w;
      }
    }
    return L ? { l: L, r: R } : null;
  }
  // v121: Take-Ordner – Comp-Abschnitte {a, b, k} in Take-Zeit (= Regionsposition + offset), an Schnitten ~10 ms Überblendung (cos²)
  function compSegs(r) {
    const T = r.tlen || r.len + (r.offset || 0), ids = new Set(r.takes.map(x => x.id));
    let c = (r.comp || []).filter(x => ids.has(x.k) && x.b > x.a).map(x => ({ a: Math.max(0, Math.round(x.a)), b: Math.min(T, Math.round(x.b)), k: x.k })).filter(x => x.b > x.a).sort((x, y) => x.a - y.a);
    if (!r.comp) c = [{ a: 0, b: T, k: r.takes[r.takes.length - 1].id }];
    const out = []; c.forEach(x => { const l = out[out.length - 1]; if (l && l.k === x.k && x.a <= l.b + 1) l.b = Math.max(l.b, x.b); else out.push(Object.assign({}, x)); });
    return out;
  }
  async function takeData(proj, r, s, e, a, L, R, g, fi, fo) {
    const sr = proj.sr || ctx.sampleRate, XF = 2 * Math.round(sr * 0.005), off = r.offset || 0, T = r.tlen || r.len + off, segs = compSegs(r);
    const ta = s - r.start + off, tb = e - r.start + off;          // Take-Zeit dieses Blockabschnitts
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], tk = r.takes.find(x => x.id === sg.k); if (!tk) continue;
      const pv = segs[i - 1], nx = segs[i + 1];
      const hi = sg.a <= 0 ? 0 : Math.floor(Math.min(XF / 2, (sg.b - sg.a) / 2, pv && pv.b >= sg.a - 1 ? (pv.b - pv.a) / 2 : XF / 2));
      const ho = sg.b >= T ? 0 : Math.floor(Math.min(XF / 2, (sg.b - sg.a) / 2, nx && nx.a <= sg.b + 1 ? (nx.b - nx.a) / 2 : XF / 2));
      const x0 = Math.round(Math.max(ta, sg.a - hi)), x1 = Math.round(Math.min(tb, sg.b + ho)); if (x1 <= x0) continue;
      const d = await SDB.read(tk.audio, (tk.offset || 0) + x0, x1 - x0), tg = g * db2g(tk.gain || 0);
      for (let t = x0; t < x1; t++) {
        let w = tg; const p = t - off;
        if (hi && t < sg.a + hi) { const c = Math.cos(Math.PI / 2 * (sg.a + hi - t) / (2 * hi)); w *= c * c; }
        if (ho && t > sg.b - ho) { const c = Math.cos(Math.PI / 2 * (t - (sg.b - ho)) / (2 * ho)); w *= c * c; }
        if (fi && p < fi) w *= Math.sin(Math.PI / 2 * p / fi);
        if (fo && p > r.len - fo) w *= Math.sin(Math.PI / 2 * Math.max(0, r.len - p) / fo);
        const j = t - x0, o = r.start + p - a; L[o] += d.l[j] * w; R[o] += d.r[j] * w;
      }
    }
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
  function groupLevel(j) { const n = G && G.grp[j]; if (!n) return 0; n.an.getFloatTimeDomainData(tbuf); let m = 0; for (let k = 0; k < 512; k += 2) { const v = Math.abs(tbuf[k]); if (v > m) m = v; } return m; }
  function masterLevel() { if (!G) return 0; G.master.meter.getFloatTimeDomainData(mbuf); let m = 0; for (let k = 0; k < 1024; k += 2) { const v = Math.abs(mbuf[k]); if (v > m) m = v; } return m; }
  return {
    ac, ensure, play, stop, seek, curPos, setProject, dirty, setCycle, level, groupLevel, masterLevel, makeGraph, applyTrack: (i, s) => G && applyTrack(G, P, i, s), applyMaster: () => G && applyMaster(G, P),
    applyAll: () => G && applyAll(G, P), compSegs, SC_OK, blockData, B, MAXT, WORKLET_SRC, get graph() { return G; }, get playing() { return st.playing; }, get project() { return P; }, on: (ev, f) => listeners[ev].push(f), sr: () => ac().sampleRate, st
  };
})();
