// ---------- Studio: Instrumente (Sampler mit echten Aufnahmen + Synthesizer) und Noten-Wiedergabe ----------
const Inst = (() => {
  const LIST = [
    { id: 'piano', name: 'Klavier (echt)', s: 1, rel: 0.35 }, { id: 'epiano', name: 'E-Piano (FM)', rel: 0.5 },
    { id: 'strings', name: 'Streicher (echt)', s: 1, att: 0.12, rel: 0.45 }, { id: 'brass', name: 'Blechbläser (echt)', s: 1, att: 0.05, rel: 0.25 },
    { id: 'flute', name: 'Flöte (echt)', s: 1, att: 0.06, rel: 0.25 }, { id: 'organ', name: 'Orgel (echt)', s: 1, att: 0.02, rel: 0.2 },
    { id: 'harp', name: 'Harfe (echt)', s: 1, rel: 0.6 }, { id: 'marimba', name: 'Marimba (echt)', s: 1, rel: 0.3 },
    { id: 'kbass', name: 'Kontrabass gezupft (echt)', s: 1, rel: 0.15 }, { id: 'sbass', name: 'Synth-Bass', rel: 0.08 },
    { id: 'pad', name: 'Synth-Fläche (Pad)', att: 0.35, rel: 0.9 }, { id: 'lead', name: 'Synth-Lead', att: 0.01, rel: 0.12 },
    { id: 'pluck', name: 'Pluck (Synth)', rel: 0.2 }
  ];
  const BY = Object.fromEntries(LIST.map(i => [i.id, i]));
  const label = id => (BY[id] || BY.epiano).name;
  // ---- Aufnahmen laden (einmal; der Offline-Speicher der App hält sie danach) ----
  const lib = {}, busy = {};
  function load(id) {
    const d = BY[id]; if (!d || !d.s) return Promise.resolve(null);
    if (lib[id]) return Promise.resolve(lib[id]); if (busy[id]) return busy[id];
    busy[id] = (async () => {
      const [ix, ab] = await Promise.all([fetch('../inst/' + id + '.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }), fetch('../inst/' + id + '.flac').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })]);
      const all = await Engine.ac().decodeAudioData(ab), sr = all.sampleRate, nc = all.numberOfChannels, g = 1 / (ix.gain || 1);
      const notes = ix.notes.map(n => {
        const a = Math.round(n.s * sr), len = Math.max(1, Math.round(n.l * sr)), b = Engine.ac().createBuffer(nc, len, sr);
        for (let c = 0; c < nc; c++) { const src = all.getChannelData(c), dst = b.getChannelData(c); for (let i = 0; i < len; i++) dst[i] = src[a + i] * g; }
        return { m: n.m + (n.c || 0) / 100, b, ls: n.ls, le: n.le };
      });
      return (lib[id] = { notes, loop: !!ix.loop });
    })().catch(e => { console.warn('Instrument', id, e); UI.say('Instrument „' + label(id) + '“ konnte nicht geladen werden (offline?) – es klingt ersatzweise ein Synthesizer.'); return null; }).finally(() => { delete busy[id]; });
    return busy[id];
  }
  async function ready(P) { const ids = new Set(P.tracks.filter(t => t.kind === 'midi').map(t => t.inst || 'epiano')); await Promise.all([...ids].map(load)); if (window.Drum) await Drum.ready(P); }
  // ---- eine Note spielen ----
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function voice(c, out, id, m, v, t, dur) {
    const d = BY[id] || BY.epiano, L = d.s && lib[id], vel = Math.max(0.05, Math.min(1, v / 127)), end = t + Math.max(0.03, dur), rel = d.rel || 0.2;
    const g = c.createGain(); g.connect(out); const nodes = [g];
    if (L) {
      let best = L.notes[0]; for (const n of L.notes) if (Math.abs(n.m - m) < Math.abs(best.m - m)) best = n;
      const s = c.createBufferSource(); s.buffer = best.b; s.playbackRate.value = Math.pow(2, (m - best.m) / 12);
      if (L.loop && best.ls != null) { s.loop = true; s.loopStart = best.ls; s.loopEnd = best.le; }
      let last = s;
      if (id === 'piano' || id === 'harp' || id === 'marimba') { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200 + 9000 * vel * vel; s.connect(f); last = f; nodes.push(f); }
      last.connect(g); const att = d.att || 0.003, amp = (0.35 + 0.65 * vel) * 0.9;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + att);
      if (!L.loop) { g.gain.setTargetAtTime(amp * 0.6, t + att, 1.2); }
      g.gain.setTargetAtTime(0, end, rel / 3);
      s.start(t); s.stop(end + rel * 2 + 0.05); nodes.push(s); s.onended = () => nodes.forEach(n => { try { n.disconnect(); } catch (e) {} });
      return { stop: (at) => { try { g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(0, at, 0.02); s.stop(at + 0.1); } catch (e) {} } };
    }
    // Synthesizer (auch Ersatz, wenn Aufnahmen fehlen)
    const f = mtof(m), oscs = [], k = id === 'sbass' || id === 'kbass' ? 'sbass' : id === 'pad' || id === 'strings' || id === 'organ' ? 'pad' : id === 'lead' || id === 'brass' || id === 'flute' ? 'lead' : id === 'pluck' || id === 'harp' || id === 'marimba' ? 'pluck' : 'epiano';
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.connect(g); nodes.push(flt);
    const amp = (0.25 + 0.6 * vel) * 0.35;
    if (k === 'epiano') {
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(); car.frequency.value = f; mod.frequency.value = f * 1; mg.gain.setValueAtTime(f * 2.2 * vel, t); mg.gain.setTargetAtTime(f * 0.3, t, 0.25);
      mod.connect(mg); mg.connect(car.frequency); car.connect(flt); flt.frequency.value = 6000; oscs.push(car, mod);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * 1.4, t + 0.004); g.gain.setTargetAtTime(amp * 0.5, t + 0.004, 0.8);
    } else if (k === 'pad') {
      [-7, 0, 7].forEach(dt => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(flt); oscs.push(o); });
      flt.frequency.value = 1600; flt.Q.value = 0.4; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * 0.55, t + (BY[id].att || 0.35));
    } else if (k === 'lead') {
      const o = c.createOscillator(), o2 = c.createOscillator(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 5; o.connect(flt); o2.connect(flt); oscs.push(o, o2);
      flt.frequency.setValueAtTime(800 + 5000 * vel, t); flt.frequency.setTargetAtTime(1800, t, 0.2); flt.Q.value = 2; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * 0.6, t + 0.01);
    } else if (k === 'sbass') {
      const o = c.createOscillator(), sub = c.createOscillator(); o.type = 'sawtooth'; sub.type = 'sine'; o.frequency.value = f; sub.frequency.value = f; o.connect(flt); const sg = c.createGain(); sg.gain.value = 0.8; sub.connect(sg); sg.connect(g); oscs.push(o, sub); nodes.push(sg);
      flt.frequency.setValueAtTime(300 + 2500 * vel, t); flt.frequency.setTargetAtTime(380, t, 0.12); flt.Q.value = 3; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * 1.2, t + 0.004);
    } else {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(flt); oscs.push(o);
      flt.frequency.setValueAtTime(5000 * vel + 800, t); flt.frequency.setTargetAtTime(f * 1.5, t, 0.08); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, 0.35);
    }
    g.gain.setTargetAtTime(0, end, rel / 3);
    oscs.forEach(o => { o.start(t); o.stop(end + rel * 2 + 0.05); }); oscs[0].onended = () => nodes.concat(oscs).forEach(n => { try { n.disconnect(); } catch (e) {} });
    return { stop: at => { try { g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(0, at, 0.02); oscs.forEach(o => o.stop(at + 0.1)); } catch (e) {} } };
  }
  // ---- Zeitplan: Noten der Regionen im Abschnitt [a, b) ----
  let live = [];
  function notesIn(P, a, b, fn) {
    const spb = P.sr * 60 / P.bpm;
    P.regions.forEach(r => {
      if (r.kind !== 'midi' || r.muted || !r.notes || r.start >= b || r.start + r.len <= a) return;
      const ti = P.tracks.findIndex(t => t.id === r.track); if (ti < 0) return;
      r.notes.forEach(n => { const f = r.start + n.t * spb; if (f < a || f >= b || f >= r.start + r.len) return; const d = Math.min(n.d * spb, r.start + r.len - f); fn(ti, P.tracks[ti], f, n, d); });
    });
  }
  let fresh = true;
  function prod(a, b, ta, ac) {
    const P = Proj.P, G = Engine.graph; if (!P || !G) return; const sr = ac.sampleRate, c = P.cycle, cyc = c && c.on && c.b > c.a;
    // Start mitten in einer langen Note (Fläche, Bass): Note mit der Restlänge nachholen
    if (fresh) { fresh = false; notesIn(P, 0, a, (ti, t, f, n, d) => { const rest = f + d - a; if (rest > sr * 0.1 && G.tr[ti]) live.push(voice(ac, G.tr[ti].inN, t.inst || 'epiano', n.m, n.v || 96, ta, rest / sr)); }); }
    notesIn(P, a, b, (ti, t, f, n, d) => { const n2 = G.tr[ti]; if (!n2) return; let dd = d; if (cyc && f < c.b) dd = Math.min(dd, c.b - f); live.push(voice(ac, n2.inN, t.inst || 'epiano', n.m, n.v || 96, ta + (f - a) / sr, dd / sr)); });
    if (live.length > 400) live = live.slice(-200);
  }
  prod.stop = () => { fresh = true; const ac = Engine.ac(), now = ac.currentTime; live.forEach(v => v.stop(now)); live = []; };
  Sched.add(prod);
  function attach() { const P = Proj.P; if (P) P.tracks.forEach(t => { if (t.kind === 'midi') load(t.inst || 'epiano'); }); }
  function offline(oc, G, P, a, e) { notesIn(P, 0, a, (ti, t, f, n, d) => { const rest = f + d - a; if (rest > oc.sampleRate * 0.1 && G.tr[ti]) voice(oc, G.tr[ti].inN, t.inst || 'epiano', n.m, n.v || 96, 0, rest / oc.sampleRate); }); notesIn(P, a, e, (ti, t, f, n, d) => { if (G.tr[ti]) voice(oc, G.tr[ti].inN, t.inst || 'epiano', n.m, n.v || 96, (f - a) / oc.sampleRate, d / oc.sampleRate); }); if (window.Drum) Drum.offline(oc, G, P, a, e); }
  // Vorhören (Tastatur im Noten-Editor)
  function preview(trackId, m, v) {
    const P = Proj.P, i = Proj.tIndex(trackId), t = P.tracks[i], G = Engine.graph; if (!t) return; Engine.ensure().then(ac => { const G2 = Engine.graph; const out = G2 && G2.tr[i] ? G2.tr[i].inN : ac.destination; voice(ac, out, t.inst || 'epiano', m, v || 100, ac.currentTime + 0.01, 0.4); });
  }
  // ---- MIDI-Export: Noten- und Drum-Spuren ----
  function midiTracks(P, a, PPQ) {
    const spb = P.sr * 60 / P.bpm, tk = f => Math.round((f - a) / spb * PPQ), out = []; let ch = 0;
    P.tracks.forEach((t, i) => {
      if (t.kind === 'midi') { const notes = []; P.regions.filter(r => r.track === t.id && r.kind === 'midi' && !r.muted && r.notes).forEach(r => r.notes.forEach(n => { const f = r.start + n.t * spb; if (f < a || f >= r.start + r.len) return; notes.push({ t: tk(f), m: n.m, v: n.v || 96, d: Math.round(Math.min(n.d * spb, r.start + r.len - f) / spb * PPQ) }); })); if (notes.length) { out.push({ name: t.name, ch, notes }); ch = Math.min(15, ch + 1 === 9 ? 10 : ch + 1); } }
      if (t.kind === 'drum' && window.Drum) { const notes = Drum.midiNotes(P, t, a, PPQ); if (notes.length) out.push({ name: t.name, ch: 9, notes }); }
    });
    return out;
  }
  // ---- Bedienung ----
  function choose(id) {
    const t = Proj.P.tracks[Proj.tIndex(id)];
    UI.dialog('<h2>Instrument · ' + t.name.replace(/</g, '&lt;') + '</h2><div class="plist">' + LIST.map(i => '<div class="item' + (i.id === (t.inst || 'epiano') ? ' a' : '') + '" data-i="' + i.id + '"><div class="ic">' + (i.s ? '🎻' : '🎛') + '</div><div style="flex:1"><b>' + i.name + '</b><small>' + (i.s ? 'Aufnahmen VSCO-2 (Versilian Studios), lädt beim ersten Mal' : 'Synthesizer, sofort da') + '</small></div><button class="btn" data-p="' + i.id + '">▶</button></div>').join('') + '</div><div class="btns"><button class="btn p" data-close>Fertig</button></div>');
    document.getElementById('dlg').onclick = async e => {
      const pb = e.target.closest('[data-p]'); if (pb) { e.stopPropagation(); const k = pb.dataset.p; await load(k); const ac = await Engine.ensure(); [60, 64, 67, 72].forEach((m, j) => voice(ac, ac.destination, k, m - (k.includes('bass') ? 24 : 0), 100, ac.currentTime + 0.05 + j * 0.18, 0.6)); return; }
      const it = e.target.closest('.item'); if (!it) return; const k = it.dataset.i;
      Proj.editTrack(id, x => { x.inst = k; if (/^Instrument/.test(x.name) || LIST.some(l => l.name === x.name)) x.name = BY[k].name.replace(/ \((echt|FM|Synth)\)/, ''); }); load(k); UI.close(); Arr.heads(); UI.inspect();
    };
  }
  function addDefault(trackId) { const r = { id: Proj.nid('r'), track: trackId, kind: 'midi', start: Proj.snap(Engine.curPos(), 'bar'), len: Math.round(Proj.bar() * 4), notes: [], name: 'Noten' }; Proj.addRegion(r); Arr.V.sel = r.id; load('epiano'); }
  return { LIST, label, load, ready, voice, attach, offline, preview, midiTracks, choose, addDefault, notesIn };
})();
window.Inst = Inst;
