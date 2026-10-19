// 3nps: Zeitdehnung ohne Tonhöhenänderung mit Signalsmith Stretch (MIT-Lizenz, siehe LIZENZ.txt), offline im Worker.
// Nachricht: {id, l, r, n, sr} → Antwort {id, l, r} (Länge n) oder {id, err}
importScripts('SignalsmithStretch.js');
let modP = null;
const mod = () => modP || (modP = self.SignalsmithStretchWasm());
const mem = M => (M.exports ? M.exports.memory.buffer : M.HEAP8.buffer);

async function run(L, R, n, sr) {
  const M = await mod(), chans = R ? 2 : 1, m = L.length, rate = m / n;
  M._presetDefault(chans, sr); M._reset();
  // Verzögerung des Verfahrens (in Ausgabe-Samples): Eingangslatenz (gedehnt) + Ausgangslatenz
  const delay = Math.round(M._inputLatency() / rate + M._outputLatency());
  const OUT = 4096, IN = Math.ceil(OUT * Math.max(1, rate)) + 2, CH = Math.max(OUT, IN);
  let ptr = M._setBuffers(chans, CH);
  const total = n + delay, oL = new Float32Array(n), oR = R ? new Float32Array(n) : null;
  let produced = 0, consumed = 0;
  while (produced < total) {
    const outN = Math.min(OUT, total - produced);
    const inEnd = Math.round((produced + outN) * rate), inN = inEnd - consumed;
    const heap = new Float32Array(mem(M), ptr, CH * chans * 2);   // Speicher kann wachsen → jedes Mal neu ansehen
    for (let c = 0; c < chans; c++) {
      const src = c ? R : L, off = c * CH;
      for (let i = 0; i < inN; i++) { const k = consumed + i; heap[off + i] = k < m ? src[k] : 0; }
    }
    M._process(inN, outN);
    const h2 = new Float32Array(mem(M), ptr, CH * chans * 2);
    for (let i = 0; i < outN; i++) {
      const j = produced + i - delay; if (j < 0 || j >= n) continue;
      oL[j] = h2[chans * CH + i]; if (oR) oR[j] = h2[chans * CH + CH + i];
    }
    produced += outN; consumed = inEnd;
  }
  return { l: oL, r: oR };
}
self.onmessage = async e => {
  const { id, l, r, n, sr } = e.data;
  try { const o = await run(l, r, n, sr); self.postMessage({ id, l: o.l, r: o.r }, o.r ? [o.l.buffer, o.r.buffer] : [o.l.buffer]); }
  catch (err) { self.postMessage({ id, err: String(err && err.message || err) }); }
};
if (typeof module === 'object') module.exports = { run };
