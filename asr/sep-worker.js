// v124: Gesang trennen im Hintergrund – Spleeter 2-Stems (Deezer, MIT) als ONNX (sherpa-onnx, Apache-2.0).
// Laufzeit: dieselbe ONNX-Laufzeit wie die Texterkennung (asr/lib, WASM, 1 Thread). Alles aus dem eigenen Ordner, keine fremden Server.
// Eingang: Stereo 44,1 kHz. Ablauf wie sherpa-onnx (offline-source-separation-spleeter-impl.h): STFT Hann 4096 (periodisch), Sprung 1024,
// ohne Zentrierung; untere 1024 Bins als Betrag in Stücken zu 512 Frames [2, 1, 512, 1024] durch beide Modelle;
// Maske = (v² + ε/2) / (v² + a² + ε) auf das komplexe Spektrum, darüber (> 11 kHz) 0; ISTFT mit Überlappungsaddition.
// Stücke überlappen sich um 64 Frames (Übergang linear). Die Modelle laufen nacheinander (erst Gesang, dann Begleitung) –
// so liegt immer nur eines im Speicher. Ausgang: nur der Gesang (die Begleitung rechnet die Seite als Original − Gesang).
import { AutoModel, Tensor, env } from './lib/transformers.min.js';
env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = new URL('./models/', import.meta.url).href;
env.useBrowserCache = false;   // Zwischenspeicher übernimmt der Service Worker (Speicher „asr-1“), wie bei Whisper
env.backends.onnx.wasm.wasmPaths = new URL('./lib/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1; env.backends.onnx.wasm.proxy = false;
const N = 4096, H = 1024, NB = 1024, T = 512, OV = 64, CORE = T - OV, P0 = N - H, QS = 16384;
const post = (type, d, tr) => self.postMessage(Object.assign({ type }, d || {}), tr || []);
// ---- FFT (komplex, radix 2, an Ort) ----
const LOG = 12, rev = new Uint16Array(N), cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < LOG; b++) r |= ((i >> b) & 1) << (LOG - 1 - b); rev[i] = r; }
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = -Math.sin(2 * Math.PI * i / N); }
function fft(re, im) {
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let s = 0; s < N; s += size) for (let k = 0, t = 0; k < half; k++, t += step) {
      const a = s + k, b = a + half, wr = cosT[t], wi = sinT[t], xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
      re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
    }
  }
}
const win = new Float64Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
const zr = new Float64Array(N), zi = new Float64Array(N);
// Frame f beider Kanäle in einem komplexen FFT (links = Realteil, rechts = Imaginärteil); danach getrennt: L_k, R_k für k < 2049
function frameSpec(L, R, f) {
  const o = f * H - P0;   // Frame-Anfang im Original (vorn P0 Nullen)
  for (let i = 0; i < N; i++) { const p = o + i, ok = p >= 0 && p < L.length; zr[i] = ok ? L[p] * win[i] : 0; zi[i] = ok ? R[p] * win[i] : 0; }
  fft(zr, zi);
}
const sep = (k, out) => {   // Kanäle aus dem gepackten Spektrum: out = [Lr, Li, Rr, Ri]
  const m = (N - k) & (N - 1), ar = zr[k], ai = zi[k], br = zr[m], bi = zi[m];
  out[0] = (ar + br) / 2; out[1] = (ai - bi) / 2; out[2] = (ai + bi) / 2; out[3] = (br - ar) / 2;
};
let cancelled = false;
const warn0 = console.warn; console.warn = (...a) => { if (/Unknown model class|assuming encoder-only/.test(String(a[0]))) return; warn0.apply(console, a); };   // eigenes Modell ohne transformers-Klasse: erwartet
async function loadModel(name, base, span) {
  post('status', { phase: 'load', which: name });
  const seen = {};
  const opts = { dtype: 'fp32', model_file_name: name, device: 'wasm',
    session_options: { enableCpuMemArena: false, enableMemPattern: false, executionMode: 'sequential', graphOptimizationLevel: 'all' },
    progress_callback: p => { if (p.status === 'progress' && p.file) { seen[p.file] = p.progress; const v = Object.values(seen); post('progress', { phase: 'load', which: name, p: base + span * v.reduce((a, b) => a + b, 0) / v.length / 100 }); } } };
  if (self.__gpu) { try { return await AutoModel.from_pretrained('spleeter', Object.assign({}, opts, { device: 'webgpu' })); } catch (e) { post('status', { phase: 'gpu-off', msg: String(e && e.message || e) }); } }
  return await AutoModel.from_pretrained('spleeter', opts);
}
async function runModel(model, x) {
  const t = new Tensor('float32', x, [2, 1, T, NB]);
  const out = await model({ x: t });
  const y = out.y || out[Object.keys(out)[0]];
  return y.data;
}
// Ein Durchgang: Modell über alle Stücke, Verhältnis Ausgang/Eingang je Bin (0…4, 16 Bit) mit Überblendung in Q
async function pass(model, L, R, F, Q, base, span, label) {
  const x = new Float32Array(2 * T * NB), mag = x, tmp = [0, 0, 0, 0];
  const nCh = Math.max(1, Math.ceil(Math.max(1, F - OV) / CORE));
  for (let c = 0, ci = 0; c < F; c += CORE, ci++) {
    if (cancelled) throw new Error('abgebrochen');
    x.fill(0);
    const nf = Math.min(T, F - c);
    for (let j = 0; j < nf; j++) {
      frameSpec(L, R, c + j);
      const oL = j * NB, oR = T * NB + j * NB;
      for (let k = 0; k < NB; k++) { sep(k, tmp); mag[oL + k] = Math.hypot(tmp[0], tmp[1]); mag[oR + k] = Math.hypot(tmp[2], tmp[3]); }
    }
    const y = await runModel(model, x);
    for (let j = 0; j < nf; j++) {   // Übergang: Anfang des Stücks einblenden, Überlappung zum nächsten Stück ausblenden (Summe 1)
      let w = 1;
      if (c > 0 && j < OV) w = (j + 0.5) / OV;
      if (j >= CORE) w = 1 - (j - CORE + 0.5) / OV;
      const f = c + j, q0 = f * 2 * NB;
      for (let ch = 0; ch < 2; ch++) {
        const oi = ch * T * NB + j * NB, oq = q0 + ch * NB;
        for (let k = 0; k < NB; k++) {
          const xi = x[oi + k], r = xi > 1e-9 ? Math.min(3.99, y[oi + k] / xi) : 0;
          const v = Q[oq + k] + Math.round(w * r * QS); Q[oq + k] = v > 65535 ? 65535 : v;
        }
      }
    }
    post('progress', { phase: 'run', which: label, p: base + span * Math.min(1, (ci + 1) / nCh) });
    if (c + CORE >= F) break;
  }
}
self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'cancel') { cancelled = true; return; }
  if (m.type !== 'run') return;
  cancelled = false; self.__gpu = !!m.gpu;
  try {
    const L = m.l, R = m.r || m.l, n = L.length;
    const F = Math.floor((n - 1 + P0) / H) + 1;   // jeder Abtastwert liegt in 4 Frames
    const t0 = performance.now();
    // 1) Gesangsmodell
    let model = await loadModel('vocals', 0, 0.25);
    const Qv = new Uint16Array(F * 2 * NB);
    await pass(model, L, R, F, Qv, 0.25, 0.3, 'vocals');
    await model.dispose(); model = null;
    // 2) Begleitungsmodell
    model = await loadModel('accompaniment', 0.55, 0.15);
    const Qa = new Uint16Array(F * 2 * NB);
    await pass(model, L, R, F, Qa, 0.7, 0.22, 'accompaniment');
    await model.dispose(); model = null;
    // 3) Maske, ISTFT (nur Gesang)
    const vl = new Float32Array(n), vr = m.r ? new Float32Array(n) : null, tmp = [0, 0, 0, 0];
    const VLr = new Float64Array(NB), VLi = new Float64Array(NB), VRr = new Float64Array(NB), VRi = new Float64Array(NB);
    const g = 1 / 1.5 / N;   // Summe der Fenster² (Hann, Sprung N/4) = 1,5; 1/N für die inverse FFT
    for (let f = 0; f < F; f++) {
      if (cancelled) throw new Error('abgebrochen');
      frameSpec(L, R, f);
      const q0 = f * 2 * NB;
      // Gesangsspektrum beider Kanäle: Z = Vl + i·Vr (k < 1024), Rest 0
      for (let k = 0; k < NB; k++) {
        sep(k, tmp);
        const xl = Math.hypot(tmp[0], tmp[1]), xr = Math.hypot(tmp[2], tmp[3]);
        const vL = Qv[q0 + k] / QS * xl, aL = Qa[q0 + k] / QS * xl, vR = Qv[q0 + NB + k] / QS * xr, aR = Qa[q0 + NB + k] / QS * xr;
        const mL = (vL * vL + 5e-11) / (vL * vL + aL * aL + 1e-10), mR = (vR * vR + 5e-11) / (vR * vR + aR * aR + 1e-10);
        VLr[k] = tmp[0] * mL; VLi[k] = tmp[1] * mL; VRr[k] = tmp[2] * mR; VRi[k] = tmp[3] * mR;
      }
      zr.fill(0); zi.fill(0);
      for (let k = 0; k < NB; k++) {
        // Z_k = Vl_k + i Vr_k ; Z_{N-k} = conj(Vl_k) + i conj(Vr_k)
        zr[k] = VLr[k] - VRi[k]; zi[k] = VLi[k] + VRr[k];
        if (k) { const j = N - k; zr[j] = VLr[k] + VRi[k]; zi[j] = -VLi[k] + VRr[k]; }
      }
      // inverse FFT über Konjugation
      for (let i = 0; i < N; i++) zi[i] = -zi[i];
      fft(zr, zi);
      // Überlappungsaddition: Frame f beginnt bei f*H - P0 im Original
      const o = f * H - P0;
      for (let i = 0; i < N; i++) {
        const p = o + i; if (p < 0 || p >= n) continue;
        const w = win[i] * g;
        vl[p] += zr[i] * w; if (vr) vr[p] += -zi[i] * w;
      }
      if (f % 200 === 0) post('progress', { phase: 'mask', p: 0.92 + 0.08 * f / F });
    }
    post('done', { l: vl, r: vr, ms: Math.round(performance.now() - t0), frames: F }, vr ? [vl.buffer, vr.buffer] : [vl.buffer]);
  } catch (err) { post('error', { msg: String(err && err.message || err) }); }
};
