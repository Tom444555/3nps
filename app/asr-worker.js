// Texterkennung (v64) im Hintergrund: Whisper (transformers.js + ONNX-Laufzeit), alles aus dem eigenen Ordner asr/ –
// keine fremden Server. Eingang: 16-kHz-Mono-Audio. Ausgang: Wörter mit Start/Ende in Sekunden.
import { pipeline, env } from './lib/transformers.min.js';
env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = new URL('./models/', import.meta.url).href;
env.useBrowserCache = false;   // Zwischenspeicher übernimmt der Service Worker (Speicher „asr-1“) – sonst läge das Modell doppelt auf dem Gerät
env.backends.onnx.wasm.wasmPaths = new URL('./lib/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1; env.backends.onnx.wasm.proxy = false;
let asr = null, asrId = '';
const post = (type, d) => self.postMessage(Object.assign({ type }, d || {}));
self.onmessage = async e => {
  const m = e.data;
  if (m.type !== 'run') return;
  try {
    if (!asr || asrId !== m.model) {
      post('status', { phase: 'load' });
      const seen = {};
      asr = await pipeline('automatic-speech-recognition', m.model, { dtype: 'q8', device: 'wasm',
        session_options: { enableCpuMemArena: false, enableMemPattern: false, executionMode: 'sequential' },
        progress_callback: p => { if (p.status === 'progress' && p.file) { seen[p.file] = p.progress; const v = Object.values(seen); post('progress', { phase: 'load', p: v.reduce((a, b) => a + b, 0) / v.length / 100 }); } } });
      asrId = m.model;
    }
    post('status', { phase: 'run' });
    const opt = { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' };
    if (m.lang && m.lang !== 'auto') opt.language = m.lang;
    let out, mode = 'word';
    try { out = await asr(m.audio, opt); }
    catch (err) { mode = 'segment'; opt.return_timestamps = true; out = await asr(m.audio, opt); }
    const words = [];
    (out.chunks || []).forEach(c => {
      const ts = c.timestamp || [], a = ts[0], b = ts[1] == null ? a + 1 : ts[1], txt = String(c.text || '').trim();
      if (!txt || a == null) return;
      if (mode === 'word') { words.push({ w: txt, a, e: b }); return; }
      const ws = txt.split(/\s+/); ws.forEach((w, i) => words.push({ w, a: a + (b - a) * i / ws.length, e: a + (b - a) * (i + 1) / ws.length }));
    });
    post('done', { words, mode, text: out.text || '' });
  } catch (err) { post('error', { msg: String(err && err.message || err) }); }
};
