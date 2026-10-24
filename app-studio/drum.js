// ---------- Studio: Drummer (spielt von selbst, echte Kits aus dem Looper) ----------
// Region r.drum = { mode: 'gen'|'steps', style, energy 0–100, cplx 0–100, fill 0|1, swing 0–60, human 0–100, steps?, res? }
const Drum = (() => {
  const KITS = { rock: 'Rock (echt)', jazz: 'Jazz / Club (echt)', brush: 'Besen (echt)', studio: 'Studio Rock/Metal (echt)', drs: 'Pop/Rock trocken (echt)', vintage: '70er Vintage (echt)', lofi: 'Lo-Fi Retro (echt)', indie: 'Indie/Punk (echt)', perc: 'Cajon & Percussion (echt)', synth: 'Elektronisch (Synthese)' };
  const ALIAS = { tomm: 'tomh', snrim: 'snare', hhh: 'hho', bell: 'ride', clap: 'snare', shaker: 'hhc', cowbell: 'bell' };
  const GM = { kick: 36, snare: 38, snrim: 40, rim: 37, clap: 39, hhc: 42, hhp: 44, hho: 46, hhh: 46, ride: 51, bell: 53, crash: 49, tomh: 48, tomm: 45, toml: 43, cowbell: 56, shaker: 70 };
  const PAN = { kick: 0, snare: 0.04, snrim: 0.04, rim: 0.04, clap: 0, hhc: 0.22, hhp: 0.2, hho: 0.22, hhh: 0.22, ride: 0.32, bell: 0.32, crash: -0.28, tomh: -0.16, tomm: 0.06, toml: 0.26, cowbell: -0.2, shaker: -0.3 };
  // Grundmuster (16tel, 4/4): x = betont, o = normal, . = leise (Geisternote), - = nichts
  const ST = {
    rock:    { name: 'Rock', k: 'x---o---x-o-----', s: '----x-------x---', h: 'o-o-o-o-o-o-o-o-', ride: false },
    pop:     { name: 'Pop', k: 'x-----o-x-------', s: '----x-------x---', h: 'o-o-o-o-o-o-o-o-' },
    funk:    { name: 'Funk', k: 'x--o--o---o--o--', s: '----x--.-.--x--.', h: 'oooooooooooooooo' },
    hiphop:  { name: 'Hip-Hop', k: 'x------ox-o-----', s: '----x-------x---', h: 'o-o-o-o-o-o-o-o-', swing: 25 },
    shuffle: { name: 'Shuffle / Blues', k: 'x-------x-------', s: '----x-------x---', h: 'o-oo-oo-oo-oo-o-', swing: 55 },
    ballad:  { name: 'Ballade', k: 'x-------x-o-----', s: '----x-------x---', h: 'o---o---o---o---' },
    halftime:{ name: 'Halftime', k: 'x-------------o-', s: '--------x-------', h: 'o-o-o-o-o-o-o-o-' },
    disco:   { name: 'Disco / Four-on-the-floor', k: 'x---x---x---x---', s: '----x-------x---', h: '--o---o---o---o-', open: true },
    metal:   { name: 'Metal', k: 'xoxoxoxoxoxoxoxo', s: '----x-------x---', h: 'o---o---o---o---', ride: true },
    punk:    { name: 'Punk', k: 'x-o-x-o-x-o-x-o-', s: '--x---x---x---x-', h: 'o-o-o-o-o-o-o-o-' },
    reggae:  { name: 'Reggae (One Drop)', k: '--------x-------', s: '--------x-------', h: 'o-o-o-o-o-o-o-o-', swing: 30, rim: true },
    bossa:   { name: 'Bossa Nova', k: 'x--ox--ox--ox--o', s: '--x--x----x--x--', h: 'oooooooooooooooo', rim: true },
    jazz:    { name: 'Jazz (Swing)', k: 'x-------x-------', s: '------------.---', h: 'o---o-oo----o-oo', ride: true, swing: 60, foot: true },
    country: { name: 'Country / Train', k: 'x-------x-------', s: '.x.x.x.x.x.x.x.x', h: '----------------' }
  };
  // ---- Kits laden ----
  const kits = {}, busy = {};
  function load(k) {
    if (k === 'synth' || !KITS[k]) return Promise.resolve(null); if (kits[k]) return Promise.resolve(kits[k]); if (busy[k]) return busy[k];
    busy[k] = (async () => {
      const [ix, ab] = await Promise.all([fetch('../drums/' + k + '.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }), fetch('../drums/' + k + '.flac').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })]);
      const ac = Engine.ac(), all = await ac.decodeAudioData(ab), sr = all.sampleRate, nc = all.numberOfChannels, g = 1 / (ix.gain || 1), K = {};
      const ch = [all.getChannelData(0), all.getChannelData(nc > 1 ? 1 : 0)];
      Object.entries(ix.hits).forEach(([id, layers]) => { K[id] = layers.map(row => row.map(([st, len]) => { const a = Math.round(st * sr), n = Math.max(1, Math.round(len * sr)), b = ac.createBuffer(2, n, sr); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c), s = ch[c]; for (let i = 0; i < n; i++) d[i] = (s[a + i] || 0) * g; } return b; })); });
      return (kits[k] = K);
    })().catch(e => { console.warn('Kit', k, e); UI.say('Kit „' + KITS[k] + '“ konnte nicht geladen werden (offline?) – es klingt ersatzweise das elektronische Kit.'); return null; }).finally(() => { delete busy[k]; });
    return busy[k];
  }
  async function ready(P) { await Promise.all([...new Set(P.tracks.filter(t => t.kind === 'drum').map(t => t.kit || 'rock'))].map(load)); }
  // ---- Schlag ----
  let noise = null;
  function nbuf(c) { if (noise && noise.sampleRate === c.sampleRate) return noise; const n = c.sampleRate, b = c.createBuffer(1, n, n), d = b.getChannelData(0); let s = 7; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; } return (noise = b); }
  function hit(c, out, kit, id, t, v) {
    const K = kits[kit], layers = K && (K[id] || K[ALIAS[id]] || (ALIAS[ALIAS[id]] && K[ALIAS[ALIAS[id]]]));
    const p = c.createStereoPanner(); p.pan.value = PAN[id] || 0; p.connect(out); const g = c.createGain(); g.connect(p);
    if (layers) {
      const L = v < 0.5 ? 0 : v < 0.86 ? 1 : 2, arr = layers[Math.min(L, layers.length - 1)], buf = arr[(Math.random() * arr.length) | 0], s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = 1 + (Math.random() - 0.5) * 0.01;
      g.gain.value = Math.pow(v / [0.4, 0.75, 1][L], 0.9); s.connect(g); s.start(t); s.onended = () => { try { g.disconnect(); p.disconnect(); } catch (e) {} };
      return s;
    }
    // elektronisch
    if (id === 'kick') { const o = c.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.connect(g); o.start(t); o.stop(t + 0.42); return o; }
    const s = c.createBufferSource(); s.buffer = nbuf(c); const f = c.createBiquadFilter(); s.connect(f); f.connect(g);
    const tone = id === 'snare' || id === 'snrim' || id === 'clap' || id === 'rim', tom = /^tom/.test(id);
    if (tom) { const o = c.createOscillator(); o.frequency.setValueAtTime(id === 'tomh' ? 220 : id === 'tomm' ? 160 : 110, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.3); const og = c.createGain(); og.gain.setValueAtTime(v * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(og); og.connect(p); o.start(t); o.stop(t + 0.36); f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(v * 0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); }
    else if (tone) { f.type = 'bandpass'; f.frequency.value = id === 'rim' ? 2500 : 1800; f.Q.value = 0.8; g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + (id === 'rim' ? 0.05 : 0.18)); }
    else { f.type = 'highpass'; f.frequency.value = id === 'ride' || id === 'bell' ? 5000 : 7000; const len = id === 'hho' || id === 'hhh' ? 0.3 : id === 'crash' ? 1.4 : id === 'ride' ? 0.6 : 0.05; g.gain.setValueAtTime(v * (id === 'crash' ? 0.5 : 0.3), t); g.gain.exponentialRampToValueAtTime(0.001, t + len); }
    s.start(t, Math.random() * 0.5); s.stop(t + 1.5); s.onended = () => { try { g.disconnect(); p.disconnect(); } catch (e) {} };
    return s;
  }
  // ---- Muster erzeugen (deterministisch je Takt) ----
  function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const VEL = { x: 1, o: 0.78, '.': 0.32 };
  function barHits(d, bi, nBars, sig) {
    const out = [], R = rnd(bi * 7919 + 13 + (d.seed || 0)), N = sig * 4, en = (d.energy != null ? d.energy : 60) / 100, cx = (d.cplx != null ? d.cplx : 40) / 100;
    const add = (s, id, v) => { if (s < N) out.push({ s, id, v: Math.max(0.08, Math.min(1, v)) }); };
    if (d.mode === 'steps' && d.steps) {
      const res = d.res === 12 ? 12 : 16, sc = N / res * (res === 12 ? 4 / 3 : 1);
      Object.entries(d.steps).forEach(([id, arr]) => arr.forEach((v, k) => { if (v) add(Math.round(k * (res === 12 ? N / 12 : N / 16) * 100) / 100, id, [0, 0.35, 0.72, 1][Math.min(3, v)]); }));
      return out;
    }
    const st = ST[d.style] || ST.rock, pat = (p, k) => p[k % 16];
    const isFill = d.fill && bi === nBars - 1 && nBars > 1, fillFrom = isFill ? N - 8 : N;
    const cym = st.ride || en > 0.82 && d.style !== 'ballad' ? 'ride' : 'hhc';
    for (let k = 0; k < N; k++) {
      const kk = k % 16;
      if (k < fillFrom) {
        const kc = pat(st.k, kk); if (kc !== '-') add(k, 'kick', VEL[kc] * (0.75 + 0.25 * en));
        else if (cx > 0.55 && kk % 2 === 0 && R() < (cx - 0.5) * 0.35) add(k, 'kick', 0.55);
        const sc = pat(st.s, kk); if (sc !== '-') add(k, st.rim && sc !== '.' ? 'rim' : 'snare', VEL[sc] * (0.7 + 0.3 * en));
        else if (cx > 0.45 && kk % 2 === 1 && R() < (cx - 0.4) * 0.3) add(k, 'snare', 0.22 + R() * 0.1);   // Geisternoten
        let hc = pat(st.h, kk); if (en > 0.7 && hc === '-' && kk % 2 === 0 && st.h.indexOf('o') >= 0) hc = 'o'; if (cx > 0.7 && hc === '-' && st.h === 'o-o-o-o-o-o-o-o-' && R() < 0.4) hc = '.';
        if (hc !== '-') add(k, st.open && kk % 4 === 2 ? 'hho' : cym, (hc === '.' ? 0.3 : (kk % 4 === 0 ? 0.8 : 0.6)) * (0.6 + 0.4 * en));
        if (st.foot && kk % 8 === 4) add(k, 'hhp', 0.55);
      } else {
        // Fill: Snare/Toms abwärts, dichter bei mehr Komplexität
        const pos = (k - fillFrom) / (N - fillFrom), dense = cx > 0.5 || kk % 2 === 0;
        if (dense) add(k, pos < 0.33 ? 'snare' : pos < 0.55 ? 'tomh' : pos < 0.78 ? 'tomm' : 'toml', 0.6 + 0.35 * pos * en);
        if (kk % 4 === 0) add(k, 'kick', 0.7);
      }
    }
    if (bi === 0 && en > 0.45 && d.crash !== false) add(0, 'crash', 0.75 + 0.2 * en);
    if (isFill === false && d.fill && (bi + 1) % 4 === 0 && cx > 0.5 && bi !== nBars - 1) { add(N - 2, 'snare', 0.7); add(N - 1, 'tomm', 0.75); }
    return out;
  }
  // ---- Zeitplan ----
  function hitsIn(P, a, b, fn) {
    const spb = P.sr * 60 / P.bpm, bar = spb * P.sig, s16 = spb / 4;
    P.regions.forEach(r => {
      if (r.kind !== 'drum' || r.muted || r.start >= b || r.start + r.len <= a) return; const ti = P.tracks.findIndex(t => t.id === r.track); if (ti < 0) return;
      const d = r.drum || {}, sw = (d.swing != null ? d.swing : (ST[d.style] || {}).swing || 0) / 100, hu = (d.human != null ? d.human : 35) / 100, nBars = Math.max(1, Math.round(r.len / bar));
      const b0 = Math.max(0, Math.floor((a - r.start) / bar)), b1 = Math.min(nBars - 1, Math.floor((Math.min(b, r.start + r.len) - r.start - 1) / bar));
      for (let bi = b0; bi <= b1; bi++) {
        const R = rnd(bi * 31 + 7), vol = (d.vol != null ? d.vol : 85) / 100;
        barHits(d, bi + Math.round(r.barOff || 0), nBars + Math.round(r.barOff || 0), P.sig).forEach(h => {
          const odd = Math.floor(h.s) % 2 === 1 && h.s % 1 === 0;
          let f = r.start + bi * bar + h.s * s16 + (odd ? sw * s16 * 0.66 : 0) + (R() - 0.5) * hu * 0.012 * P.sr;
          if (f < a || f >= b || f >= r.start + r.len || f < r.start) return;
          fn(ti, P.tracks[ti], f, h.id, h.v * vol * (1 - hu * 0.15 + R() * hu * 0.3));
        });
      }
    });
  }
  let live = [];
  function prod(a, b, ta, ac) { const P = Proj.P, G = Engine.graph; if (!P || !G) return; hitsIn(P, a, b, (ti, t, f, id, v) => { if (G.tr[ti]) live.push(hit(ac, G.tr[ti].inN, t.kit || 'rock', id, ta + (f - a) / ac.sampleRate, v)); }); if (live.length > 600) live = live.slice(-300); }
  prod.stop = () => { const now = Engine.ac().currentTime; live.forEach(s => { try { s.stop(now + 0.02); } catch (e) {} }); live = []; };
  Sched.add(prod);
  function offline(oc, G, P, a, e) { hitsIn(P, a, e, (ti, t, f, id, v) => { if (G.tr[ti]) hit(oc, G.tr[ti].inN, t.kit || 'rock', id, (f - a) / oc.sampleRate, v); }); }
  function midiNotes(P, t, a, PPQ) { const spb = P.sr * 60 / P.bpm, out = []; const Q = { regions: P.regions.filter(r => r.track === t.id), sr: P.sr, bpm: P.bpm, sig: P.sig, tracks: [t] }; hitsIn(Q, a, Infinity, (ti, tt, f, id, v) => out.push({ t: Math.round((f - a) / spb * PPQ), m: GM[id] || 38, v: Math.max(1, Math.min(127, Math.round(v * 127))), d: Math.round(PPQ / 8) })); return out; }
  // ---- Übernahme aus dem Looper (Muster 1:1) ----
  function fromLooper(q, ds, at, len) {
    if (!ds || !ds.steps) return; let kit = 'rock'; try { kit = localStorage.getItem('3nps-drumkit') || 'rock'; } catch (e) {} if (!KITS[kit]) kit = 'synth';
    const t = Proj.track('drum', 'Drums ' + (ds.name ? '(' + ds.name + ')' : '')); t.kit = kit; if (ds.eq2) t.eq = EQ7.norm(ds.eq2); q.tracks.push(t);
    const bar = Proj.bar(); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'drum', start: at, len: Math.max(bar, Math.round(len / bar) * bar), name: ds.name || 'Drums',
      drum: { mode: 'steps', steps: JSON.parse(JSON.stringify(ds.steps)), res: ds.res, swing: ds.swing || 0, human: ds.human != null ? ds.human : 35, vol: ds.vol != null ? Math.min(100, ds.vol + 15) : 85 } });
    load(kit);
  }
  function addDefault(trackId) { const r = { id: Proj.nid('r'), track: trackId, kind: 'drum', start: Proj.snap(Engine.curPos(), 'bar'), len: Math.round(Proj.bar() * 8), name: 'Rock', drum: { mode: 'gen', style: 'rock', energy: 60, cplx: 40, fill: 1, human: 35, vol: 85 } }; Proj.addRegion(r); Arr.V.sel = r.id; load('rock'); }
  function choose(id) {
    const t = Proj.P.tracks[Proj.tIndex(id)];
    UI.dialog('<h2>Schlagzeug-Kit · ' + t.name.replace(/</g, '&lt;') + '</h2><div class="plist">' + Object.entries(KITS).map(([k, n]) => '<div class="item' + (k === (t.kit || 'rock') ? ' a' : '') + '" data-k="' + k + '"><div class="ic">🥁</div><div style="flex:1"><b>' + n + '</b><small>' + (k === 'synth' ? 'sofort da' : 'dieselben Aufnahmen wie im Looper (drums/LIZENZ.txt)') + '</small></div><button class="btn" data-p="' + k + '">▶</button></div>').join('') + '</div><p class="note">Stil, Lautstärke, Komplexität und Fills stellst du je Region ein: Region doppelt antippen (oder „Bearbeiten“).</p><div class="btns"><button class="btn p" data-close>Fertig</button></div>');
    document.getElementById('dlg').onclick = async e => {
      const pb = e.target.closest('[data-p]'); if (pb) { e.stopPropagation(); const k = pb.dataset.p; await load(k); const ac = await Engine.ensure(), t0 = ac.currentTime + 0.05, sp = 60 / Proj.P.bpm / 2; barHits({ style: 'rock', energy: 70, cplx: 40 }, 1, 4, 4).forEach(h => hit(ac, ac.destination, k, h.id, t0 + h.s * sp / 2, h.v)); return; }
      const it = e.target.closest('.item'); if (!it) return; Proj.editTrack(id, x => { x.kit = it.dataset.k; }); load(it.dataset.k); UI.close(); Arr.heads();
    };
  }
  // Bedienfeld für eine Drummer-Region (im Noten-Bereich)
  function editor(host, r) {
    const d = r.drum || (r.drum = {}), gen = d.mode !== 'steps';
    const sl = (k, n, v, min, max) => '<label class="row" style="min-width:210px">' + n + ' <input type="range" data-k="' + k + '" min="' + (min || 0) + '" max="' + (max || 100) + '" value="' + v + '" style="flex:1"><b data-o="' + k + '" style="width:34px;text-align:right">' + v + '</b></label>';
    host.innerHTML = '<div class="card" style="width:100%"><h2 style="font-size:16px">Drummer · ' + (r.name || '') + '</h2><div class="btns">' +
      (gen ? '<label class="row">Stil <select data-k="style">' + Object.entries(ST).map(([k, s]) => '<option value="' + k + '"' + (k === d.style ? ' selected' : '') + '>' + s.name + '</option>').join('') + '</select></label>' : '<span class="note">Muster aus dem Looper (1:1). </span><button class="btn" data-a="gen">Stattdessen Drummer spielen lassen</button>') +
      sl('vol', 'Lautstärke', d.vol != null ? d.vol : 85) + (gen ? sl('energy', 'Kraft', d.energy != null ? d.energy : 60) + sl('cplx', 'Komplexität', d.cplx != null ? d.cplx : 40) : '') + sl('swing', 'Swing', d.swing != null ? d.swing : ((ST[d.style] || {}).swing || 0), 0, 60) + sl('human', 'Gefühl (menschlich)', d.human != null ? d.human : 35) +
      (gen ? '<label class="row"><input type="checkbox" data-k="fill"' + (d.fill ? ' checked' : '') + '> Fill am Ende</label><label class="row"><input type="checkbox" data-k="crash"' + (d.crash !== false ? ' checked' : '') + '> Becken am Anfang</label><button class="btn" data-a="var">Andere Variante</button>' : '') +
      '</div><p class="note">Tipp: Region teilen (Strophe/Refrain) und je Teil Stil und Kraft ändern – so spielt der Drummer wie ein Mensch, der dem Song folgt.</p></div>';
    host.oninput = host.onchange = e => {
      const el = e.target, k = el.dataset.k; if (!k) return; const v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
      const o = host.querySelector('[data-o="' + k + '"]'); if (o) o.textContent = v;
      if (e.type === 'change') Proj.editRegion(r.id, q => { q.drum = Object.assign({}, q.drum, { [k]: v }); if (k === 'style') q.name = ST[v].name; }); else { r.drum[k] = v; }
      Arr.kick();
    };
    host.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'gen') Proj.editRegion(r.id, q => { q.drum = { mode: 'gen', style: 'rock', energy: 60, cplx: 40, fill: 1, human: 35, vol: 85 }; q.name = 'Rock'; }); if (b.dataset.a === 'var') Proj.editRegion(r.id, q => { q.drum = Object.assign({}, q.drum, { seed: ((q.drum.seed || 0) + 1) % 97 }); }); editor(host, Proj.reg(r.id)); Arr.kick(); };
  }
  return { KITS, ST, load, ready, hit, barHits, offline, midiNotes, fromLooper, addDefault, choose, editor, hitsIn };
})();
window.Drum = Drum;
