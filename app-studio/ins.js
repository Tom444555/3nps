// ---------- Studio v122: Insert-Effekte je Spur/Bus (Amp, Chorus, Tremolo) und Tonhöhenkorrektur ----------
// Inserts liegen zwischen Spureingang und Sättigung. Sie kommen nur in den Graph, wenn sie eingeschaltet sind –
// ausgeschaltet ist der Signalweg exakt der bisherige. Chorus und Tremolo sind Worklets mit derselben Zeitleiste
// wie die Engine (LFO-Phase hängt an der Projektposition) → Abspielen und Offline-Export klingen gleich.
// Die Tonhöhenkorrektur wird vorberechnet („Anwenden“: YIN-Erkennung wie app/pitch.js, Verschiebung mit
// Signalsmith Stretch); an = die Engine liest die korrigierte Fassung, aus = das Original.
const Ins = (() => {
  const DEF = {
    amp: Object.assign({ on: false }, AmpDSP.AMP_PRESETS.blues),
    cho: { on: false, rate: 0.8, depth: 50, mix: 50 },
    trem: { on: false, rate: 5, depth: 60, sync: false, div: 0.5 },
    pc: { on: false, key: 0, scale: 'dur', str: 100, spd: 20 }
  };
  const KEYS = ['amp', 'cho', 'trem', 'pc'];
  const WSRC = `
class StudioFxT extends AudioWorkletProcessor {
  constructor(o) { super(); const q = o.processorOptions || {}; this.play = false; this.p = 0; this.at = 0; this.cyc = q.cyc && q.cyc.on && q.cyc.b > q.cyc.a ? [q.cyc.a, q.cyc.b] : null; this.end = false; this.segs = q.segs || null; this.si = 0; this.tp = null;
    if (q.play) { this.play = true; this.p = q.play.pos; this.at = q.play.at; this.fresh = true; }
    this.port.onmessage = e => { const d = e.data; if (d.t === 'play') { this.play = true; this.p = d.pos; this.at = d.at; this.fresh = true; } else if (d.t === 'stop') this.play = false; else if (d.t === 'cycle') this.cyc = d.on && d.b > d.a ? [d.a, d.b] : null; else if (d.t === 'end') this.end = true; }; }
  // Projektposition je Abtastwert (wie studio-eng: Start bei at, Cycle-Sprung)
  pos(N) {
    if (!this.tp || this.tp.length !== N) this.tp = new Float64Array(N);
    const tp = this.tp, c = this.cyc;
    if (this.play && this.fresh) { this.fresh = false; if (currentFrame > this.at) { let q = this.p + currentFrame - this.at; if (c && this.p < c[1] && q >= c[1]) q = c[0] + (q - c[0]) % (c[1] - c[0]); this.p = q; this.at = currentFrame; } }
    for (let i = 0; i < N; i++) { if (this.play && currentFrame + i >= this.at) { tp[i] = this.p; const q = this.p + 1; this.p = c && this.p < c[1] && q >= c[1] ? c[0] : q; } else tp[i] = this.p; }
    return tp;
  }
  beat(f) { const S = this.segs; if (!S || !S.length) return 0; let i = this.si; if (i >= S.length) i = S.length - 1; while (i + 1 < S.length && S[i + 1].f <= f) i++; while (i > 0 && S[i].f > f) i--; this.si = i; const s = S[i]; return s.beat + (f - s.f) / s.spb; }
}
class StudioCho extends StudioFxT {
  static get parameterDescriptors() { return [{ name: 'rate', defaultValue: 0.8, automationRate: 'k-rate' }, { name: 'depth', defaultValue: 50, automationRate: 'k-rate' }, { name: 'mix', defaultValue: 50, automationRate: 'k-rate' }]; }
  constructor(o) { super(o); this.L = 4096; this.bl = new Float32Array(this.L); this.br = new Float32Array(this.L); this.w = 0; }
  process(ins, outs, p) {
    if (this.end) return false; const o = outs[0]; if (!o || !o[0]) return true; const N = o[0].length, tp = this.pos(N);
    const x = ins[0], xl = x && x[0], xr = x && (x[1] || x[0]), oL = o[0], oR = o[1] || o[0], M = this.L - 1, sr = sampleRate;
    const base = 0.014 * sr, amt = Math.max(0, Math.min(1, p.depth[0] / 100)) * 0.0045 * sr, m = Math.max(0, Math.min(1, p.mix[0] / 100)), w2 = 2 * Math.PI * Math.max(0, p.rate[0]) / sr;
    const bl = this.bl, br = this.br;
    for (let i = 0; i < N; i++) {
      const a = xl ? xl[i] : 0, b = xr ? xr[i] : 0, w = this.w; bl[w] = a; br[w] = b;
      const ph = w2 * tp[i], dL = base + amt * Math.sin(ph), dR = base + amt * Math.cos(ph);
      const rl = w - dL, il = Math.floor(rl), fl = rl - il, l0 = bl[il & M], l1 = bl[(il + 1) & M];
      const rr = w - dR, ir = Math.floor(rr), fr = rr - ir, r0 = br[ir & M], r1 = br[(ir + 1) & M];
      oL[i] = a * (1 - m) + (l0 + (l1 - l0) * fl) * m; if (oR !== oL) oR[i] = b * (1 - m) + (r0 + (r1 - r0) * fr) * m;
      this.w = (w + 1) & M;
    }
    return true;
  }
}
registerProcessor('studio-cho', StudioCho);
class StudioTrem extends StudioFxT {
  static get parameterDescriptors() { return [{ name: 'rate', defaultValue: 5, automationRate: 'k-rate' }, { name: 'depth', defaultValue: 60, automationRate: 'k-rate' }, { name: 'sync', defaultValue: 0, automationRate: 'k-rate' }, { name: 'div', defaultValue: 0.5, automationRate: 'k-rate' }]; }
  process(ins, outs, p) {
    if (this.end) return false; const o = outs[0]; if (!o || !o[0]) return true; const N = o[0].length, tp = this.pos(N);
    const x = ins[0], xl = x && x[0], xr = x && (x[1] || x[0]), oL = o[0], oR = o[1] || o[0], sr = sampleRate;
    const d = Math.max(0, Math.min(1, p.depth[0] / 100)), sync = p.sync[0] > 0.5 && this.segs, dv = Math.max(1 / 16, p.div[0]), rt = Math.max(0, p.rate[0]), TAU = 2 * Math.PI;
    for (let i = 0; i < N; i++) {
      const ph = sync ? this.beat(tp[i]) / dv : rt * tp[i] / sr, g = 1 - d * (0.5 - 0.5 * Math.cos(TAU * ph));
      oL[i] = (xl ? xl[i] : 0) * g; if (oR !== oL) oR[i] = (xr ? xr[i] : 0) * g;
    }
    return true;
  }
}
registerProcessor('studio-trem', StudioTrem);
`;
  const any = t => { const f = (t && t.fx) || {}; return !!((f.amp && f.amp.on) || (f.cho && f.cho.on) || (f.trem && f.trem.on)); };
  const ampSet = a => { const s = Object.assign({}, DEF.amp, a || {}); if (!AmpDSP.AMP_TYPES[s.type]) s.type = 'crunch'; return s; };
  const segsOf = P => TMap.segs(P).map(s => ({ f: s.f, beat: s.beat, spb: s.spb }));
  // Kette bauen: Eingang → [Amp] → [Chorus] → [Tremolo] → Ausgang (wkOk: Worklet-Modul in diesem Kontext geladen)
  function build(c, t, opts, wkOk) {
    const f = t.fx || {}, n = { amp: null, cho: null, trem: null, wk: [], all: [] };
    n.input = c.createGain(); let last = n.input; n.all.push(n.input);
    if (f.amp && f.amp.on) { const a = AmpDSP.ampChain(c, ampSet(f.amp), wkOk); a.type = ampSet(f.amp).type; last.connect(a.in); last = a.out; n.amp = a; n.all.push(...a.list); }
    const wopt = extra => ({ numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit', processorOptions: Object.assign({ play: opts.play || null, cyc: opts.cyc || null }, extra || {}) });
    if (wkOk && f.cho && f.cho.on) { const w = new AudioWorkletNode(c, 'studio-cho', wopt()); last.connect(w); last = w; n.cho = w; n.wk.push(w); n.all.push(w); }
    if (wkOk && f.trem && f.trem.on) { const w = new AudioWorkletNode(c, 'studio-trem', wopt({ segs: opts.proj ? segsOf(opts.proj) : null })); last.connect(w); last = w; n.trem = w; n.wk.push(w); n.all.push(w); }
    n.output = last;
    return n;
  }
  function apply(n, t, c, smooth) {
    const f = t.fx || {}, now = c.currentTime, P2 = (prm, v) => smooth ? prm.setTargetAtTime(v, now, 0.015) : prm.setValueAtTime(v, now);
    if (n.amp && f.amp) {   // wie ampApply im Looper
      const s = ampSet(f.amp), q = AmpDSP.ampParams(s), a = n.amp;
      if (a.type !== s.type) { a.shp.curve = AmpDSP.ampCurve(s.type); a.type = s.type; }
      P2(a.pre.frequency, q.p.hp); P2(a.drive.gain, q.drive); P2(a.bass.gain, q.bass); P2(a.mid.gain, q.mid); P2(a.tre.gain, q.treble); P2(a.out.gain, q.out);
      if (a.gate) { const g = a.gate.parameters.get('thr'); if (g) g.setValueAtTime(q.gate, now); }
    }
    const set = (w, k, v) => { const pr = w.parameters.get(k); if (pr) pr.setValueAtTime(v, now); };
    if (n.cho && f.cho) { set(n.cho, 'rate', +f.cho.rate || 0); set(n.cho, 'depth', +f.cho.depth || 0); set(n.cho, 'mix', +f.cho.mix || 0); }
    if (n.trem && f.trem) { set(n.trem, 'rate', +f.trem.rate || 0); set(n.trem, 'depth', +f.trem.depth || 0); set(n.trem, 'sync', f.trem.sync ? 1 : 0); set(n.trem, 'div', +f.trem.div || 0.5); }
  }
  function tear(n) { n.all.forEach(x => { try { x.disconnect(); } catch (e) {} }); n.wk.forEach(w => { try { w.port.postMessage({ t: 'end' }); } catch (e) {} }); }

  // ---------- Tonhöhenkorrektur (vorberechnet) ----------
  const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'];
  const SCALES = [['dur', 'Dur'], ['moll', 'Moll'], ['penta', 'Dur-Pentatonik'], ['pentam', 'Moll-Pentatonik'], ['chrom', 'Chromatisch (alle Halbtöne)']];
  const pcSig = pc => JSON.stringify([pc.key, pc.scale, pc.str, pc.spd]);
  const keyFromProject = () => { const m = String((Proj.P && Proj.P.key) || '').match(/^([A-H])([#♯b♭]?)\s*(.*)$/i); if (!m) return null; let r = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 10, H: 11 }[m[1].toUpperCase()]; if (m[2] === '#' || m[2] === '♯') r++; if (m[2] === 'b' || m[2] === '♭') r--; return { key: (r + 12) % 12, scale: /moll/i.test(m[3]) ? 'moll' : 'dur' }; };
  let sw = null, sid = 0; const swWait = {};
  function shift(l, r, tr, tb, sr) {   // Signalsmith mit Transpositionskurve (gleiche Länge)
    return new Promise((res, rej) => {
      if (!sw) { sw = new Worker('../stretch/worker.js'); sw.onmessage = e => { const p = swWait[e.data.id]; if (p) { delete swWait[e.data.id]; p(e.data); } }; }
      const id = ++sid, L = l.slice(), R = r && r !== l ? r.slice() : null;
      swWait[id] = d => d.err ? rej(new Error(d.err)) : res({ l: d.l, r: d.r || d.l });
      sw.postMessage({ id, l: L, r: R, n: L.length, sr, tr, tb }, R ? [L.buffer, R.buffer] : [L.buffer]);
    });
  }
  const pcRegions = tid => Proj.P.regions.filter(r => r.track === tid && r.kind === 'audio' && !(r.takes && r.takes.length));
  const pcFresh = (r, pc) => !!(r.pc && r.pc.src === r.audio && r.pc.o0 <= r.offset && r.pc.o0 + r.pc.n >= r.offset + r.len && r.pc.sig === pcSig(pc));
  async function pcApply(tid, say) {
    const P = Proj.P, t = P.tracks[Proj.tIndex(tid)]; if (!t) return 0; const pc = Object.assign({}, DEF.pc, t.fx.pc || {}), sr = P.sr, rs = pcRegions(tid).filter(r => !pcFresh(r, pc));
    const out = [];
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i]; say && say('Tonhöhenkorrektur: Region ' + (i + 1) + '/' + rs.length + ' – erkenne Töne …');
      const d = await SDB.read(r.audio, r.offset, r.len), mono = new Float32Array(r.len); for (let k = 0; k < r.len; k++) mono[k] = (d.l[k] + d.r[k]) * 0.5;
      const HOP = 512, tr = await Ana.run('pc', { x: mono, sr, o: { key: pc.key, scale: pc.scale, str: pc.str, spd: pc.spd, hop: HOP } }, [mono.buffer]);
      say && say('Tonhöhenkorrektur: Region ' + (i + 1) + '/' + rs.length + ' – verschiebe …');
      const y = await shift(d.l, d.r, tr.tr, HOP, sr);
      const m = await SDB.putAudio((r.name || 'Audio') + ' (Tonhöhe)', sr, y.l, y.r !== y.l ? y.r : null);
      out.push({ id: r.id, pc: { audio: m.id, src: r.audio, o0: r.offset, n: r.len, sig: pcSig(pc), moved: tr.moved } });
    }
    if (out.length) { Proj.change('regions', p => out.forEach(o => { const q = p.regions.find(x => x.id === o.id); if (q) q.pc = o.pc; })); Engine.dirty(); }
    return out.length;
  }
  function pcState(tid, pc) { const rs = pcRegions(tid); const ok = rs.filter(r => pcFresh(r, pc)).length; return { n: rs.length, ok }; }

  // ---------- Bedienung im Effekte-Fenster ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function ensure(f) { KEYS.forEach(k => { f[k] = Object.assign(JSON.parse(JSON.stringify(DEF[k])), f[k] || {}); }); }
  function prune(f) { KEYS.forEach(k => { const x = f[k]; if (!x || x.on) return; if (k === 'pc' ? x.str === DEF.pc.str && x.spd === DEF.pc.spd : JSON.stringify(Object.assign({}, DEF[k], x)) === JSON.stringify(DEF[k])) delete f[k]; }); }
  const sl = (k, n, min, max, step, v, u) => '<label>' + n + ' <b data-io="' + k + '">' + v + (u || '') + '</b></label><input type="range" data-ik="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '" data-u="' + (u || '') + '">';
  const on = (k, n, v) => '<label style="color:var(--ink)"><b>' + n + '</b><input type="checkbox" data-ik="' + k + '.on"' + (v ? ' checked' : '') + '></label>';
  function cards(t, isAudioTrack) {
    const f = t.fx, a = f.amp, c = f.cho, tr = f.trem, pc = f.pc;
    let h = '<div class="card ins-amp">' + on('amp', 'Amp (wie im Looper)', a.on) + '<label>Vorlage <select data-ik="amp.preset"><option value="">–</option>' + Object.keys(AmpDSP.AMP_PRESETS).map(k => '<option value="' + k + '">' + k[0].toUpperCase() + k.slice(1) + '</option>').join('') + '</select></label>' +
      '<label>Typ <select data-ik="amp.type">' + Object.keys(AmpDSP.AMP_TYPES).map(k => '<option value="' + k + '"' + (a.type === k ? ' selected' : '') + '>' + ({ clean: 'Clean', crunch: 'Crunch', lead: 'Lead' }[k] || k) + '</option>').join('') + '</select></label>' +
      sl('amp.gate', 'Gate', -80, -20, 1, a.gate, ' dB') + sl('amp.drive', 'Drive', 0, 10, 0.1, a.drive) + sl('amp.bass', 'Bass', 0, 10, 0.1, a.bass) + sl('amp.mid', 'Mitte', 0, 10, 0.1, a.mid) + sl('amp.treble', 'Höhen', 0, 10, 0.1, a.treble) + sl('amp.level', 'Pegel', -18, 6, 0.5, a.level, ' dB') + '</div>' +
      '<div class="card ins-cho">' + on('cho', 'Chorus', c.on) + sl('cho.rate', 'Rate', 0.05, 5, 0.05, c.rate, ' Hz') + sl('cho.depth', 'Tiefe', 0, 100, 1, c.depth, ' %') + sl('cho.mix', 'Mix', 0, 100, 1, c.mix, ' %') + '</div>' +
      '<div class="card ins-trem">' + on('trem', 'Tremolo', tr.on) + sl('trem.rate', 'Rate', 0.5, 16, 0.1, tr.rate, ' Hz') + sl('trem.depth', 'Tiefe', 0, 100, 1, tr.depth, ' %') +
      '<label>Im Takt <input type="checkbox" data-ik="trem.sync"' + (tr.sync ? ' checked' : '') + '></label><label>Notenwert <select data-ik="trem.div">' + [[2, '1/2'], [1, '1/4'], [0.5, '1/8'], [1 / 3, '1/8 T'], [0.25, '1/16']].map(([v, n]) => '<option value="' + v + '"' + (Math.abs(v - tr.div) < 1e-6 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label><p class="note">„Im Takt“ folgt der Tempokarte (auch Tempowechsel).</p></div>';
    if (isAudioTrack) h += '<div class="card ins-pc">' + on('pc', 'Tonhöhenkorrektur', pc.on) + '<label>Tonart <select data-ik="pc.key">' + NOTE.map((n, i) => '<option value="' + i + '"' + (pc.key === i ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label>Skala <select data-ik="pc.scale">' + SCALES.map(([k, n]) => '<option value="' + k + '"' + (pc.scale === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      sl('pc.str', 'Stärke', 0, 100, 1, pc.str, ' %') + sl('pc.spd', 'Geschwindigkeit', 0, 200, 1, pc.spd, ' ms') + '<div class="btns" style="margin-top:6px"><button class="btn p" data-ia="pcapply">Anwenden</button></div><p class="note" data-io="pcst"></p></div>';
    return h;
  }
  // Fenster verdrahten: f = t.fx (lebendes Objekt), Änderungen sofort hörbar; Ein/Aus baut den Graph neu
  function bind(dlg, t, id, isTrack) {
    const f = t.fx, i = Proj.tIndex(id), apply = () => { if (i >= 0) Engine.applyTrack(i, true); else Engine.applyAll(); };
    const pcSt = () => { const el = dlg.querySelector('[data-io="pcst"]'); if (!el || !isTrack) return; const s = pcState(id, f.pc); el.textContent = !s.n ? 'Keine Audio-Region auf dieser Spur.' : s.ok === s.n ? s.n + ' Region' + (s.n === 1 ? '' : 'en') + ' korrigiert' + (f.pc.on ? ' – zu hören.' : ' (aus: Original zu hören).') : (s.n - s.ok) + ' von ' + s.n + ' Regionen noch nicht korrigiert – „Anwenden“ tippen (passiert sonst beim Schließen).'; };
    const show = () => dlg.querySelectorAll('[data-ik]').forEach(el => { const [a, b] = el.dataset.ik.split('.'); if (b === 'preset') return; const v = f[a][b]; if (el.type === 'checkbox') el.checked = !!v; else { el.value = v; const o = dlg.querySelector('[data-io="' + el.dataset.ik + '"]'); if (o) o.textContent = v + (el.dataset.u || ''); } });
    dlg.addEventListener('input', e => {
      const el = e.target, k = el.dataset.ik; if (!k) return; const [a, b] = k.split('.');
      if (b === 'preset') { const p = AmpDSP.AMP_PRESETS[el.value]; if (p) Object.assign(f.amp, p); f.amp.on = true; el.value = ''; show(); Engine.dirty(true); return; }
      const wasOn = !!f[a].on;
      let v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' && (b === 'type' || b === 'scale') ? el.value : +el.value;
      f[a][b] = v; if (b !== 'on' && a !== 'pc') f[a].on = true;
      show(); pcSt();
      if (a === 'pc') { if (b === 'on') Engine.dirty(); return; }
      if (wasOn !== !!f[a].on) Engine.dirty(true); else apply();
    });
    dlg.addEventListener('click', async e => {
      const b = e.target.closest('[data-ia="pcapply"]'); if (b) { b.disabled = true; try { const n = await pcApply(id, UI.say); if (!f.pc.on) { f.pc.on = true; show(); } Engine.dirty(); UI.say(n ? 'Tonhöhenkorrektur angewendet (' + n + ' Region' + (n === 1 ? '' : 'en') + ').' : 'Schon aktuell.'); } catch (err) { console.error(err); UI.say('Tonhöhenkorrektur: ' + err.message); } b.disabled = false; pcSt(); return; }
      if (e.target.closest('[data-pre="off"]')) { KEYS.forEach(k => { if (f[k]) f[k].on = false; }); show(); }
    });
    pcSt();
    UI.onClose(() => {
      if (isTrack && f.pc && f.pc.on && pcState(id, f.pc).ok < pcState(id, f.pc).n) pcApply(id, UI.say).then(n => { if (n) UI.say('Tonhöhenkorrektur angewendet (' + n + ' Region' + (n === 1 ? '' : 'en') + ').'); }).catch(err => UI.say('Tonhöhenkorrektur: ' + err.message));
      prune(f);
    });
  }
  return { DEF, WSRC, any, build, apply, tear, cards, bind, ensure, prune, pcApply, pcState, pcSig, keyFromProject, shift, SCALES };
})();
window.Ins = Ins;
