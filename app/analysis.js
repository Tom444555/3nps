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
            postMessage({ id, pc: k.pc, major: k.major, score: k.score, energy: r.energy / Math.max(1, data.length) });
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
    return run('key', channels, sr, (d, r) => { const c = chromaMono(d, r), k = detectKeyFromChroma(c.chroma); return { pc: k.pc, major: k.major, score: k.score, energy: c.energy / Math.max(1, d.length) }; });
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
