/* ---------- 7-Band-Equalizer: für jede Spur und für die Drums ----------
   Bänder 63 Hz (Kuhschwanz) · 160 · 400 · 1k · 2,5k · 6,3k (Glocke) · 12 kHz (Kuhschwanz), je ±12 dB.
   Die Kurve wird direkt aus den Filterformeln berechnet (wie die Biquad-Filter des Browsers). */
const EQ7 = (() => {
  const BANDS = [
    { f: 63, type: 'lowshelf', label: '63' }, { f: 160, type: 'peaking', label: '160' }, { f: 400, type: 'peaking', label: '400' },
    { f: 1000, type: 'peaking', label: '1k' }, { f: 2500, type: 'peaking', label: '2,5k' }, { f: 6300, type: 'peaking', label: '6,3k' },
    { f: 12000, type: 'highshelf', label: '12k' }
  ];
  const Q = 1.1, RANGE = 12;
  const flat = () => [0, 0, 0, 0, 0, 0, 0];
  const isFlat = v => !v || v.every(x => Math.abs(x) < 0.05);
  const clampV = v => Math.max(-RANGE, Math.min(RANGE, Math.round(v * 2) / 2));
  function norm(v) { const o = flat(); if (Array.isArray(v)) for (let i = 0; i < 7; i++) o[i] = clampV(+v[i] || 0); return o; }

  // Filterkette im Audio-Graphen
  function chain(ctx) {
    const filters = BANDS.map(b => { const f = ctx.createBiquadFilter(); f.type = b.type; f.frequency.value = b.f; if (b.type === 'peaking') f.Q.value = Q; f.gain.value = 0; return f; });
    for (let i = 0; i < 6; i++) filters[i].connect(filters[i + 1]);
    return {
      input: filters[0], output: filters[6], filters,
      set(vals, smooth) {
        const t = ctx.currentTime;
        filters.forEach((f, i) => { const g = vals ? +vals[i] || 0 : 0; if (smooth && ctx.state === 'running') f.gain.setTargetAtTime(g, t, 0.015); else f.gain.value = g; });
      }
    };
  }

  // Betrag des Frequenzgangs (RBJ-Formeln, wie im Web-Audio-Standard)
  function coeffs(type, f0, gain, sr) {
    const A = Math.pow(10, gain / 40), w = 2 * Math.PI * f0 / sr, c = Math.cos(w), s = Math.sin(w);
    if (type === 'peaking') { const al = s / (2 * Q); return [1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A]; }
    const al = s / 2 * Math.SQRT2, sA = 2 * Math.sqrt(A) * al;
    if (type === 'lowshelf') return [A * ((A + 1) - (A - 1) * c + sA), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sA), (A + 1) + (A - 1) * c + sA, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sA];
    return [A * ((A + 1) + (A - 1) * c + sA), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sA), (A + 1) - (A - 1) * c + sA, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sA];
  }
  function responseDb(vals, freqs, sr) {
    const out = new Float32Array(freqs.length);
    BANDS.forEach((b, i) => {
      const g = vals[i]; if (Math.abs(g) < 0.01) return;
      const [b0, b1, b2, a0, a1, a2] = coeffs(b.type, b.f, g, sr);
      for (let k = 0; k < freqs.length; k++) {
        const w = 2 * Math.PI * freqs[k] / sr, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
        const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
        out[k] += 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
      }
    });
    return out;
  }

  // Für den Export: Stereo-Audio offline durch dieselbe Kette rechnen (mit Vorlauf, damit der Loop-Anfang stimmt)
  async function render(x, vals, sr) {
    if (isFlat(vals) || !x || !x.length) return x;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return x;
    const pre = Math.min(x.length, Math.round(sr * 0.3)), n = x.length + pre;
    const oc = new OAC(2, n, sr), b = oc.createBuffer(2, n, sr);
    [x.l, x.r].forEach((ch, c) => { const d = b.getChannelData(c); d.set(ch.subarray(x.length - pre), 0); d.set(ch, pre); });
    const s = oc.createBufferSource(); s.buffer = b;
    const k = chain(oc); k.set(vals); s.connect(k.input); k.output.connect(oc.destination); s.start(0);
    const out = await oc.startRendering();
    return { l: out.getChannelData(0).slice(pre), r: out.getChannelData(1).slice(pre), length: x.length };
  }

  const PRESETS_TRACK = {
    'Neutral': flat(),
    'Wärmer': [2, 1.5, 0.5, 0, -1, -2, -2.5],
    'Mehr Biss': [0, -1, -1, 1, 3, 2.5, 1],
    'Weniger Mulm': [-1, -3, -2, 0, 0.5, 0.5, 0],
    'Präsenz': [0, 0, -1, 0.5, 2.5, 3, 2],
    'Bass raus (Platz für Bass)': [-9, -4, -0.5, 0, 0, 0, 0],
    'Höhen weich': [0, 0, 0, 0, -1.5, -4, -6],
    'Telefon / Lo-Fi': [-12, -8, 0, 4, 2, -8, -12]
  };
  const PRESETS_DRUMS = {
    'Neutral': flat(),
    'Druckvoll': [3, 2, -2, -1, 1, 2, 1.5],
    'Mehr Bauch': [4, 3, 0.5, -1, 0, 0, 0],
    'Weniger Becken': [0, 0, 0, 0, -1.5, -4, -6],
    'Trocken & nah': [1, -1, -3, 0, 1.5, 1, -1],
    'Leise im Hintergrund': [-2, -1, 0, -1, -2, -3, -3],
    'Lo-Fi': [-8, -2, 2, 4, 1, -6, -12]
  };

  // ---- Bedienfeld: Kurve, 7 Schieber, Vorlagen, 0 dB ----
  function widget(host, opts) {
    let vals = norm(opts.vals);
    const presets = opts.presets || PRESETS_TRACK;
    host.classList.add('eq-panel');
    host.innerHTML = '<div class="eq-top"><select class="eq-pre" aria-label="EQ-Vorlage"><option value="">Vorlage …</option>' +
      Object.keys(presets).map(k => '<option>' + k + '</option>').join('') + '</select><button type="button" class="toggle-btn eq-flat">0 dB</button></div>' +
      '<canvas class="eq-curve" aria-hidden="true"></canvas><div class="eq-bands">' +
      BANDS.map((b, i) => '<div class="eq-band" data-i="' + i + '"><div class="eq-track" role="slider" tabindex="0" aria-label="' + b.label + ' Hz" aria-valuemin="-12" aria-valuemax="12"><div class="eq-mid"></div><div class="eq-fill"></div><div class="eq-knob"></div></div><b class="eq-val">0</b><span class="eq-f">' + b.label + '</span></div>').join('') + '</div>';
    const cv = host.querySelector('.eq-curve'), bandsEl = [...host.querySelectorAll('.eq-band')];
    const emit = () => { opts.onChange && opts.onChange(vals.slice()); };
    function draw() {
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const col = getComputedStyle(host).getPropertyValue('--tc').trim() || '#7fd8ff';
      const fx = f => Math.log(f / 20) / Math.log(20000 / 20) * w, dy = db => h / 2 - db / (RANGE * 1.15) * (h / 2);
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      [100, 1000, 10000].forEach(f => { ctx.beginPath(); ctx.moveTo(fx(f) + 0.5, 0); ctx.lineTo(fx(f) + 0.5, h); ctx.stroke(); });
      [-6, 6].forEach(d => { ctx.beginPath(); ctx.moveTo(0, dy(d) + 0.5); ctx.lineTo(w, dy(d) + 0.5); ctx.stroke(); });
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(0, dy(0) + 0.5); ctx.lineTo(w, dy(0) + 0.5); ctx.stroke();
      const n = Math.max(40, Math.round(w / 3)), freqs = new Float32Array(n);
      for (let k = 0; k < n; k++) freqs[k] = 20 * Math.pow(1000, k / (n - 1));
      const r = responseDb(vals, freqs, 48000);
      ctx.beginPath(); for (let k = 0; k < n; k++) { const x = k / (n - 1) * w, y = dy(Math.max(-RANGE * 1.1, Math.min(RANGE * 1.1, r[k]))); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.lineTo(w, dy(0)); ctx.lineTo(0, dy(0)); ctx.closePath(); ctx.globalAlpha = 0.14; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
    }
    function show() {
      bandsEl.forEach((el, i) => {
        const v = vals[i], p = (v + RANGE) / (2 * RANGE) * 100;
        el.style.setProperty('--p', p.toFixed(1) + '%');
        el.querySelector('.eq-val').textContent = (v > 0 ? '+' : '') + String(v).replace('.', ',');
        el.classList.toggle('pos', v > 0.05); el.classList.toggle('neg', v < -0.05);
        el.querySelector('.eq-track').setAttribute('aria-valuenow', String(v));
      });
      draw();
    }
    let lastTap = { i: -1, t: 0 };
    bandsEl.forEach((el, i) => {
      const tr = el.querySelector('.eq-track');
      const fromY = e => { const r = tr.getBoundingClientRect(); return clampV(((r.bottom - e.clientY) / r.height) * 2 * RANGE - RANGE); };
      tr.addEventListener('pointerdown', e => {
        const now = performance.now();
        if (lastTap.i === i && now - lastTap.t < 400) { vals[i] = 0; show(); emit(); lastTap.i = -1; return; }   // doppelt tippen = 0 dB
        lastTap = { i, t: now };
        try { tr.setPointerCapture(e.pointerId); } catch (err) {}
        tr.dataset.drag = '1'; vals[i] = fromY(e); show(); emit(); e.preventDefault();
      });
      tr.addEventListener('pointermove', e => { if (tr.dataset.drag !== '1') return; const v = fromY(e); if (v !== vals[i]) { vals[i] = v; show(); emit(); } });
      const end = () => { tr.dataset.drag = ''; };
      tr.addEventListener('pointerup', end); tr.addEventListener('pointercancel', end);
      tr.addEventListener('dblclick', e => { vals[i] = 0; show(); emit(); e.preventDefault(); });
      tr.addEventListener('keydown', e => {
        const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.5 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.5 : 0;
        if (!d) return; vals[i] = clampV(vals[i] + d); show(); emit(); e.preventDefault(); e.stopPropagation();
      });
    });
    host.querySelector('.eq-flat').addEventListener('click', () => { vals = flat(); host.querySelector('.eq-pre').value = ''; show(); emit(); });
    host.querySelector('.eq-pre').addEventListener('change', e => { const p = presets[e.target.value]; if (p) { vals = norm(p); show(); emit(); } });
    show();
    return { set(v) { vals = norm(v); show(); }, get: () => vals.slice(), draw };
  }

  return { BANDS, chain, widget, render, responseDb, flat, isFlat, norm, PRESETS_TRACK, PRESETS_DRUMS };
})();
