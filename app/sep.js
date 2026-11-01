// ---- v124: Gesang trennen (Spleeter 2-Stems im Worker asr/sep-worker.js) – gemeinsam für Looper und Studio ----
// Nichts wird geladen, bevor jemand „Gesang trennen“ antippt: kein Worker, keine Laufzeit, kein Modell.
// Ablauf: Rückfrage beim ersten Mal (Download ~79 MB, danach im Speicher „asr-1“ wie die Whisper-Modelle) → auf 44,1 kHz →
// Worker (Gesangsmodell, dann Begleitungsmodell, Maske, ISTFT) → Gesang zurück auf die Abtastrate → Begleitung = Original − Gesang.
// Fortschritt in einem eigenen Fenster mit „Abbrechen“ (beendet den Worker sofort, Speicher wird frei).
const Sep = (() => {
  const T0 = s => (typeof T === 'function' ? T(s) : s);
  const SIZE_MB = 79, KEY = '3nps-sep-have', SR = 44100;
  const base = () => (/\/studio\//.test(location.pathname) ? '../' : '') + 'asr/';
  let job = null;
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  async function have() {
    if (ls(KEY) === '1') return true;
    try { if (!window.caches) return false; const c = await caches.open('asr-1'), u = new URL(base() + 'models/spleeter/onnx/', location.href).href; return !!((await c.match(u + 'vocals.onnx')) && (await c.match(u + 'accompaniment.onnx'))); } catch (e) { return false; }
  }
  async function resample(x, from, to) {
    if (from === to) return { l: x.l.slice(), r: x.r && x.r !== x.l ? x.r.slice() : null };
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, st = x.r && x.r !== x.l;
    const n = Math.max(1, Math.round(x.l.length * to / from)), oc = new OAC(st ? 2 : 1, n, to), b = oc.createBuffer(st ? 2 : 1, x.l.length, from);
    b.copyToChannel(x.l, 0); if (st) b.copyToChannel(x.r, 1);
    const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start(0);
    const o = await oc.startRendering(); return { l: o.getChannelData(0).slice(), r: st ? o.getChannelData(1).slice() : null };
  }
  // ---- Fortschrittsfenster ----
  function ui(title) {
    let d = document.getElementById('sepDlg');
    if (!d) {
      d = document.createElement('div'); d.id = 'sepDlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
      d.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:16px';
      d.innerHTML = '<div style="width:min(440px,100%);background:var(--surf,#1d1f24);color:var(--ink,#eee);border:1px solid var(--line,#444);border-radius:12px;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.5)">'
        + '<b id="sepTitle" style="display:block;font-size:16px;margin-bottom:6px"></b><p id="sepTxt" style="margin:0 0 10px;font-size:13px;opacity:.85;min-height:2.6em"></p>'
        + '<div style="height:10px;border-radius:5px;background:rgba(127,127,127,.25);overflow:hidden"><div id="sepBar" style="height:100%;width:0;background:var(--acc,#e8b04a);transition:width .25s"></div></div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span id="sepPct" style="font-variant-numeric:tabular-nums;font-size:13px">0 %</span><button class="toggle-btn btn" id="sepStop" type="button">' + T0('Abbrechen') + '</button></div></div>';
      document.body.appendChild(d);
    }
    d.hidden = false; d.style.display = 'flex';
    document.getElementById('sepTitle').textContent = title || T0('Gesang trennen');
    const set = (p, txt) => { if (p != null) { const v = Math.max(0, Math.min(1, p)); document.getElementById('sepBar').style.width = (v * 100).toFixed(1) + '%'; document.getElementById('sepPct').textContent = Math.floor(v * 100) + ' %'; } if (txt != null) document.getElementById('sepTxt').textContent = txt; };
    set(0, T0('Bereite vor …'));
    return { set, close: () => { d.hidden = true; d.style.display = 'none'; }, stop: document.getElementById('sepStop') };
  }
  // ---- Trennen: x = { l, r } (r darf fehlen/gleich l sein) bei Abtastrate sr → { voc: {l, r}, acc: {l, r}, ms } oder null (abgebrochen/abgelehnt)
  async function run(x, sr, opts) {
    opts = opts || {};
    if (job) throw new Error(T0('Es wird schon getrennt.'));
    const secs = x.l.length / sr;
    if (!(await have()) && !opts.noAsk) {
      if (!confirm(T0('Gesang trennen lädt beim ersten Mal einmalig etwa ') + SIZE_MB + T0(' MB (zwei Modelle). Danach geht es auch ohne Internet. Jetzt laden?'))) return null;
    }
    const u = ui(opts.title), t0 = performance.now();
    let cancelled = false, w = null;
    job = { cancel: () => { cancelled = true; try { w && w.terminate(); } catch (e) {} } };
    u.stop.onclick = () => job && job.cancel();
    try {
      u.set(0.01, T0('Rechne auf 44,1 kHz um …'));
      const x44 = await resample(x, sr, SR);
      if (cancelled) return null;
      const res = await new Promise((resolve, reject) => {
        w = new Worker(base() + 'sep-worker.js', { type: 'module' });
        job.reject = reject;
        const prevCancel = job.cancel; job.cancel = () => { prevCancel(); reject(new Error('abgebrochen')); };
        w.onerror = e => reject(new Error(e.message || T0('Der Hintergrund-Rechner ist abgestürzt (zu wenig Speicher?).')));
        w.onmessage = e => {
          const m = e.data;
          if (m.type === 'progress') {
            const txt = m.phase === 'load' ? T0('Lade Modell ') + (m.which === 'vocals' ? T0('„Gesang“') : T0('„Begleitung“')) + ' …'
              : m.phase === 'run' ? (m.which === 'vocals' ? T0('Suche den Gesang …') : T0('Suche die Begleitung …'))
              : T0('Setze die Spuren zusammen …');
            u.set(m.p, txt);
          } else if (m.type === 'status' && m.phase === 'load') u.set(null, T0('Lade Modell ') + (m.which === 'vocals' ? T0('„Gesang“') : T0('„Begleitung“')) + ' …');
          else if (m.type === 'done') resolve(m);
          else if (m.type === 'error') reject(new Error(m.msg));
        };
        let gpu = false; try { gpu = ls('3nps-sep-gpu') === '1' && !!navigator.gpu; } catch (e) {}
        w.postMessage({ type: 'run', l: x44.l, r: x44.r, gpu }, x44.r ? [x44.l.buffer, x44.r.buffer] : [x44.l.buffer]);
      });
      try { w.terminate(); } catch (e) {} w = null;
      ls(KEY, '1');
      if (cancelled) return null;
      u.set(0.97, T0('Setze die Spuren zusammen …'));
      // Gesang zurück auf die Abtastrate des Liedes; Begleitung = Original − Gesang (zusammen wieder genau das Original)
      const v = await resample({ l: res.l, r: res.r }, SR, sr), n = x.l.length;
      const xr = x.r && x.r !== x.l ? x.r : null;
      const vl = new Float32Array(n), al = new Float32Array(n); vl.set(v.l.subarray(0, Math.min(n, v.l.length)));
      for (let i = 0; i < n; i++) al[i] = x.l[i] - vl[i];
      let vr = vl, ar = al;
      if (xr) { vr = new Float32Array(n); const s = v.r || v.l; vr.set(s.subarray(0, Math.min(n, s.length))); ar = new Float32Array(n); for (let i = 0; i < n; i++) ar[i] = xr[i] - vr[i]; }
      u.set(1, T0('Fertig.'));
      return { voc: { l: vl, r: vr }, acc: { l: al, r: ar }, ms: Math.round(performance.now() - t0), workerMs: res.ms };
    } catch (err) {
      if (cancelled || /abgebrochen/.test(String(err && err.message))) return null;
      throw err;
    } finally {
      try { w && w.terminate(); } catch (e) {}
      job = null; setTimeout(() => u.close(), 250);
    }
  }
  // WAV (16 Bit, Mono oder Stereo) – für Ideen und die Gesangsspur im Editor
  function wav(x, sr) {
    const st = x.r && x.r !== x.l, ch = st ? 2 : 1, n = x.l.length, buf = new ArrayBuffer(44 + n * ch * 2), dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); wr(8, 'WAVE'); wr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const pcm = new Int16Array(buf, 44), q = v => { v = v > 1 ? 1 : v < -1 ? -1 : v; return Math.round(v * 32767); };
    if (st) for (let i = 0, o = 0; i < n; i++, o += 2) { pcm[o] = q(x.l[i]); pcm[o + 1] = q(x.r[i]); } else for (let i = 0; i < n; i++) pcm[i] = q(x.l[i]);
    return new Blob([buf], { type: 'audio/wav' });
  }
  return { run, have, wav, busy: () => !!job, cancel: () => job && job.cancel(), SIZE_MB };
})();
window.Sep = Sep;
