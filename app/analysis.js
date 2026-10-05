/* ---------- Tonart-Analyse im Hintergrund (Web Worker) ---------- */
// Chroma aus einem Mono-Signal (bereits heruntergerechnet)
function chromaMono(x, sr) {
  const frameSize = 4096, hop = 2048;
  const maxSamples = Math.min(x.length, sr * 90);
  const chroma = new Array(12).fill(0);
  const win = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (frameSize - 1));
  const frame = new Float64Array(frameSize);
  let energy = 0;
  // kurze Loops: mindestens einen Frame auswerten (mit Nullen aufgefüllt)
  const last = Math.max(0, maxSamples - frameSize);
  for (let start = 0; start <= last; start += hop) {
    for (let i = 0; i < frameSize; i++) frame[i] = (x[start + i] || 0) * win[i];
    const { re, im } = fft(frame);
    for (let bin = 1; bin < frameSize / 2; bin++) {
      const freq = bin * sr / frameSize;
      if (freq < 60 || freq > 1500) continue;
      const mag = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
      energy += mag;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += mag;
    }
    if (maxSamples < frameSize) break;
  }
  return { chroma, energy };
}

const Analyzer = (() => {
  let worker = null, seq = 0;
  const pending = {};
  function makeWorker() {
    try {
      const src = 'const CHORD_TYPES = ' + JSON.stringify(CHORD_TYPES) + ';\n' + [fft, pearsonCorrelate, detectKeyFromChroma, chromaMono, beatAnalyse, onsetFinder, robustLine, beatRefine, loopAnalyse, chordAnalyse].map(f => f.toString()).join('\n') + `
        onmessage = e => {
          const { id, data, sr, type, opts } = e.data;
          try {
            if (type === 'beat') { postMessage({ id, beat: beatAnalyse(data, sr, opts) }); return; }
            if (type === 'loop') { postMessage({ id, beat: loopAnalyse(data, sr, opts) }); return; }
            if (type === 'chords') { postMessage({ id, chords: chordAnalyse(data, sr, opts.beats, opts) }); return; }
            const r = chromaMono(data, sr);
            const k = detectKeyFromChroma(r.chroma);
            postMessage({ id, pc: k.pc, major: k.major, score: k.score, chroma: r.chroma, energy: r.energy / Math.max(1, data.length) });
          } catch (err) { postMessage({ id, error: String(err) }); }
        };`;
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
      w.onmessage = e => { const p = pending[e.data.id]; delete pending[e.data.id]; if (p) p(e.data); };
      w.onerror = () => { worker = false; };
      return w;
    } catch (e) { return false; }
  }
  // channels: Array von Float32Array, sr: Abtastrate → mono, ca. 11–12 kHz
  function downmix(channels, sr) {
    const f = Math.max(1, Math.floor(sr / 11025));
    const n = Math.floor(channels[0].length / f), out = new Float32Array(n), nc = channels.length;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let c = 0; c < nc; c++) { const ch = channels[c]; for (let j = 0; j < f; j++) s += ch[i * f + j]; }
      out[i] = s / (f * nc);
    }
    return { data: out, sr: sr / f };
  }
  function run(type, channels, sr, local, opts) {
    const m = downmix(channels, sr);
    if (worker === null) worker = makeWorker();
    return new Promise(resolve => {
      if (worker) {
        const id = ++seq;
        pending[id] = resolve;
        worker.postMessage({ id, data: m.data, sr: m.sr, type, opts: opts || {} }, [m.data.buffer]);
        setTimeout(() => { if (pending[id]) { delete pending[id]; resolve({ error: 'timeout' }); } }, 30000);
      } else {
        setTimeout(() => { try { resolve(local(m.data, m.sr)); } catch (err) { resolve({ error: String(err) }); } }, 30);
      }
    });
  }
  function key(channels, sr) {
    return run('key', channels, sr, (d, r) => { const c = chromaMono(d, r), k = detectKeyFromChroma(c.chroma); return { pc: k.pc, major: k.major, score: k.score, chroma: c.chroma, energy: c.energy / Math.max(1, d.length) }; });
  }
  // Song: Tempo, Schläge und Takt-Einsen (Zeiten in Sekunden)
  async function beat(channels, sr, opts) {
    const r = await run('beat', channels, sr, (d, r2) => ({ beat: beatAnalyse(d, r2, opts) }), opts);
    return r && r.beat ? r.beat : null;
  }
  // Loop: ganze Takte? exaktes Tempo, Lage von Takt 1
  async function loop(channels, sr, opts) {
    const r = await run('loop', channels, sr, (d, r2) => ({ beat: loopAnalyse(d, r2, opts) }), opts);
    return r && r.beat ? r.beat : null;
  }
  // Akkorde je Schlag (beats in Sekunden), Ergebnis: Abschnitte mit Name, Start/Ende (s), Schlägen
  async function chords(channels, sr, beats, opts) {
    const o = Object.assign({ loop: true }, opts || {}, { beats });
    const r = await run('chords', channels, sr, (d, r2) => ({ chords: chordAnalyse(d, r2, beats, o) }), o);
    return r && r.chords ? r.chords : null;
  }
  const label = r => NOTES[r.pc] + (r.major ? '-Dur' : '-Moll');
  const short = r => NOTES[r.pc] + (r.major ? '' : 'm');
  function apply(r) {
    rootSel.value = NOTES[r.pc];
    modeSel.value = r.major ? 'Ionisch (Dur)' : 'Äolisch (Moll)';
    rootSel.dispatchEvent(new Event('change'));   // baut Griffbild, Drone und LCD neu
  }
  return { key, beat, loop, chords, label, short, apply };
})();

// ---- Tonart aus Akkordfolge + Chroma (löst vor allem Dur/Parallel-Moll sicherer auf) ----
// segs: [{ name, root, type, beats, beat }], chroma: 12 Werte (ganzes Stück), opts.loop: Schleife (erster Akkord = Takt 1)
function keyFromChords(segs, chroma, opts) {
  opts = opts || {};
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const corr = (x, y) => { const n = 12; let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n;
    let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { const p = x[i] - mx, q = y[i] - my; a += p * q; b += p * p; c += q * q; } return a / (Math.sqrt(b * c) || 1); };
  const qual = t => t == null ? null : /^(m|m7|m6|m9|m11)$/.test(t) ? 'm' : /^dim/.test(t) ? 'd' : /^(sus|5)/.test(t) ? '*' : 'M';
  // erlaubte Stufen je Tonart: Halbtonabstand → Qualität (Gewicht)
  const DIA = {
    M: { 0: { M: 1 }, 2: { m: 1, M: 0.2 }, 4: { m: 1, M: 0.2 }, 5: { M: 1, m: 0.3 }, 7: { M: 1 }, 9: { m: 1, M: 0.2 }, 11: { d: 1 }, 10: { M: 0.5 }, 8: { M: 0.3 }, 6: { d: 0.5 } },
    m: { 0: { m: 1 }, 2: { d: 1, m: 0.3 }, 3: { M: 1 }, 5: { m: 1, M: 0.5 }, 7: { m: 1, M: 1 }, 8: { M: 1 }, 10: { M: 1 }, 11: { d: 0.6 } }
  };
  const P = Object.assign({ first: 0.5, res: 0.3 }, opts.P || {});
  // 6er-Akkord = Moll-7-Akkord eine kleine Terz tiefer (B6 = G#m7): beide Deutungen zulassen
  const ch = [];
  (segs || []).forEach(s => {
    if (!(s.root >= 0) || s.name === '–') return;
    if (s.type === '6') { ch.push(Object.assign({}, s, { beats: (s.beats || 1) * 0.5 })); ch.push(Object.assign({}, s, { root: (s.root + 9) % 12, type: 'm7', beats: (s.beats || 1) * 0.5, alias: true })); }
    else ch.push(s);
  });
  const tot = ch.reduce((a, s) => a + (s.beats || 1), 0);
  const real = ch.filter(s => !s.alias);
  const nbt = real.reduce((a, s) => Math.max(a, (s.beat || 0) + (s.beats || 1)), 0);
  const down = opts.down != null ? opts.down : (real.length ? Math.min(...real.map(s => s.beat || 0)) : 0);
  const covers = b => s => { const a = s.beat || 0, n = Math.round((s.beats || 1) * (s.alias || s.type === '6' ? 2 : 1)); return (b >= a && b < a + n) || (b + nbt >= a && b + nbt < a + n); };
  const firsts = ch.filter(covers(down)), lasts = ch.filter(covers((down - 1 + nbt) % Math.max(1, nbt)));
  // Folge in Zeitreihenfolge (für V7 → I)
  const order = real.slice().sort((a, b) => (a.beat || 0) - (b.beat || 0));
  const res = [];
  for (let t = 0; t < 12; t++) for (const mode of ['M', 'm']) {
    const rot = []; for (let i = 0; i < 12; i++) rot.push(chroma ? chroma[(t + i) % 12] : 0);
    const kk = chroma ? corr(rot, mode === 'M' ? MAJ : MIN) : 0;
    let fit = 0, tonic = 0, dom = 0;
    ch.forEach(s => {
      const rel = ((s.root - t) % 12 + 12) % 12, q = qual(s.type), w = s.beats || 1, d = DIA[mode][rel];
      let f = -1;
      if (d) f = q === '*' ? Math.max(d.M || 0, d.m || 0) : (d[q] != null ? d[q] : -0.6);
      if (mode === 'M' && q === 'M' && /^7/.test(s.type || '') && (rel === 2 || rel === 4 || rel === 9)) f = Math.max(f, 0.5);
      fit += w * f;
      if (rel === 0 && (q === mode || q === '*' || (mode === 'M' && q === 'M'))) tonic += w;
      if (mode === 'm' && rel === 7 && q === 'M') dom += w;   // Dur-Dominante (harmonisch Moll)
    });
    let sc = 0.6 * kk;
    if (tot) {
      sc += fit / tot + 0.7 * tonic / tot + 0.25 * dom / tot;
      const isT = s => ((s.root - t) % 12 + 12) % 12 === 0 && (qual(s.type) === mode || qual(s.type) === '*');
      if (opts.loop !== false && firsts.some(isT)) sc += P.first;
      const lr = lasts.map(s => ((s.root - t) % 12 + 12) % 12);
      if (lr.some(r => r === 7 || (r === 5 && mode === 'M') || (r === 10 && mode === 'm'))) sc += 0.1;
      if (lasts.some(isT)) sc += 0.12;
      // Dominantseptakkord löst auf die Tonika auf (auch über das Loop-Ende hinweg)
      for (let i = 0; i < order.length; i++) {
        const a = order[i], b = order[(i + 1) % order.length];
        if (a !== b && /^7/.test(a.type || '') && ((a.root - t) % 12 + 12) % 12 === 7 && isT(b)) { sc += P.res; break; }
      }
    }
    res.push({ pc: t, major: mode === 'M', score: sc, kk });
  }
  res.sort((a, b) => b.score - a.score);
  return Object.assign({}, res[0], { margin: res[0].score - res[1].score, alt: res[1] });
}
