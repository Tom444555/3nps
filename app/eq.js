/* ---------- Equalizer (v99, Art „Channel EQ“): für jede Spur und für die Drums ----------
   9 Bänder: Low Cut · Bass-Kuhschwanz · 5 Glocken · Höhen-Kuhschwanz · High Cut. Grafische Kurve mit ziehbaren Punkten
   (waagerecht = Frequenz, senkrecht = Verstärkung), Analyzer, Güte/Steilheit, Ausgang.
   Zustand: { v:2, b:[{on,f,g,q}×9], out, sl (Low-Cut-Steilheit 12/24), sh (High-Cut 12/24) }.
   Alte Werte (Liste mit 7 Verstärkungen, v1) werden übernommen; `legacy()` liefert sie weiterhin zum Speichern für ältere Fassungen. */
const EQ7 = (() => {
  const BANDS = [
    { id: 'hp', type: 'highpass', f: 40, q: 0.71, col: '#a8b2c2', name: 'Low Cut' },
    { id: 'ls', type: 'lowshelf', f: 63, q: 0.71, col: '#ff8a3d', name: 'Bass' },
    { id: 'b1', type: 'peaking', f: 160, q: 1.1, col: '#e3d43a', name: 'Glocke 1' },
    { id: 'b2', type: 'peaking', f: 400, q: 1.1, col: '#8ad94e', name: 'Glocke 2' },
    { id: 'b3', type: 'peaking', f: 1000, q: 1.1, col: '#3ddbb0', name: 'Glocke 3' },
    { id: 'b4', type: 'peaking', f: 2500, q: 1.1, col: '#45b5ff', name: 'Glocke 4' },
    { id: 'b5', type: 'peaking', f: 6300, q: 1.1, col: '#7d8bff', name: 'Glocke 5' },
    { id: 'hs', type: 'highshelf', f: 12000, q: 0.71, col: '#c26bff', name: 'Höhen' },
    { id: 'lp', type: 'lowpass', f: 18000, q: 0.71, col: '#a8b2c2', name: 'High Cut' }
  ];
  const RANGE = 15, FMIN = 20, FMAX = 20000, CUT = i => i === 0 || i === 8, OLD = [1, 2, 3, 4, 5, 6, 7];
  const T = s => (typeof window !== 'undefined' && window.__tr) ? window.__tr(s) : s;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rg = v => Math.round(clamp(+v || 0, -RANGE, RANGE) * 10) / 10;
  function flat() { return { v: 2, b: BANDS.map((b, i) => ({ on: !CUT(i), f: b.f, g: 0, q: b.q })), out: 0, sl: 12, sh: 12 }; }
  function norm(v) {
    const o = flat();
    if (Array.isArray(v)) { OLD.forEach((bi, k) => { o.b[bi].g = rg(v[k]); }); return o; }   // alte 7-Band-Werte
    if (!v || typeof v !== 'object' || !Array.isArray(v.b)) return o;
    o.b.forEach((b, i) => { const s = v.b[i]; if (!s) return; b.on = s.on !== false && (CUT(i) ? !!s.on : true); b.f = clamp(+s.f || BANDS[i].f, FMIN, FMAX); b.g = CUT(i) ? 0 : rg(s.g); b.q = clamp(+s.q || BANDS[i].q, 0.3, 12); });
    o.out = rg(v.out); o.sl = v.sl === 24 ? 24 : 12; o.sh = v.sh === 24 ? 24 : 12;
    return o;
  }
  const isFlat = v => { const s = norm(v); return s.b.every((b, i) => CUT(i) ? !b.on : (!b.on || Math.abs(b.g) < 0.05)) && Math.abs(s.out) < 0.05; };
  const legacy = v => { const s = norm(v); return OLD.map(i => s.b[i].on ? Math.round(s.b[i].g * 2) / 2 : 0); };

  // ---- Filterkette ----
  function chain(ctx) {
    const mk = () => { const f = ctx.createBiquadFilter(); f.type = 'peaking'; f.gain.value = 0; return f; };
    const hpA = mk(), hpB = mk(), mids = [1, 2, 3, 4, 5, 6, 7].map(() => mk()), lpA = mk(), lpB = mk(), out = ctx.createGain();
    const all = [hpA, hpB, ...mids, lpA, lpB];
    for (let i = 0; i < all.length - 1; i++) all[i].connect(all[i + 1]);
    lpB.connect(out);
    let an = null;
    const k = {
      input: hpA, output: out, filters: all,
      set(vals, smooth) {
        const s = norm(vals), t = ctx.currentTime, sm = smooth && ctx.state === 'running';
        const P = (p, v) => { if (sm) p.setTargetAtTime(v, t, 0.015); else p.value = v; };
        const cut = (A, B, type, b, slope) => {
          if (!b.on) { [A, B].forEach(f => { if (f.type !== 'peaking') f.type = 'peaking'; P(f.gain, 0); }); return; }
          const f0 = Math.min(b.f, ctx.sampleRate * 0.45);
          A.type = type; P(A.frequency, f0); P(A.Q, slope === 24 ? 0.54 * b.q / 0.71 : b.q);
          if (slope === 24) { B.type = type; P(B.frequency, f0); P(B.Q, 1.31 * b.q / 0.71); } else { if (B.type !== 'peaking') B.type = 'peaking'; P(B.gain, 0); }
        };
        cut(hpA, hpB, 'highpass', s.b[0], s.sl); cut(lpA, lpB, 'lowpass', s.b[8], s.sh);
        mids.forEach((f, j) => { const b = s.b[j + 1], bd = BANDS[j + 1]; f.type = bd.type; P(f.frequency, Math.min(b.f, ctx.sampleRate * 0.45)); if (bd.type === 'peaking') P(f.Q, b.q); P(f.gain, b.on ? b.g : 0); });
        P(out.gain, Math.pow(10, s.out / 20));
      },
      analyser() { if (!an) { an = ctx.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0.8; out.connect(an); } return an; }
    };
    return k;
  }

  // ---- Frequenzgang (RBJ, wie Web Audio) ----
  function coeffs(type, f0, gain, Q, sr) {
    const A = Math.pow(10, gain / 40), w = 2 * Math.PI * f0 / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q);
    if (type === 'peaking') return [1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A];
    if (type === 'highpass') return [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al];
    if (type === 'lowpass') return [(1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al];
    const a2 = s / 2 * Math.SQRT2, sA = 2 * Math.sqrt(A) * a2;
    if (type === 'lowshelf') return [A * ((A + 1) - (A - 1) * c + sA), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sA), (A + 1) + (A - 1) * c + sA, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sA];
    return [A * ((A + 1) + (A - 1) * c + sA), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sA), (A + 1) - (A - 1) * c + sA, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sA];
  }
  function addResp(out, freqs, sr, C) {
    const [b0, b1, b2, a0, a1, a2] = C;
    for (let k = 0; k < freqs.length; k++) {
      const w = 2 * Math.PI * freqs[k] / sr, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
      const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
      out[k] += 10 * Math.log10(Math.max(1e-12, (nr * nr + ni * ni) / (dr * dr + di * di)));
    }
  }
  function bandResp(s, i, freqs, sr, out) {
    const b = s.b[i], bd = BANDS[i]; if (!b.on) return;
    if (CUT(i)) { const sl = i ? s.sh : s.sl; if (sl === 24) { addResp(out, freqs, sr, coeffs(bd.type, b.f, 0, 0.54 * b.q / 0.71, sr)); addResp(out, freqs, sr, coeffs(bd.type, b.f, 0, 1.31 * b.q / 0.71, sr)); } else addResp(out, freqs, sr, coeffs(bd.type, b.f, 0, b.q, sr)); return; }
    if (Math.abs(b.g) < 0.01) return;
    addResp(out, freqs, sr, coeffs(bd.type, b.f, b.g, bd.type === 'peaking' ? b.q : 0.71, sr));
  }
  function responseDb(vals, freqs, sr) {
    const s = norm(vals), out = new Float32Array(freqs.length);
    s.b.forEach((b, i) => bandResp(s, i, freqs, sr, out));
    for (let k = 0; k < out.length; k++) out[k] += s.out;
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

  // Vorlagen: [Low Cut (Hz oder 0), Bass, Glocke 1–5, Höhen, High Cut (Hz oder 0)]
  const PV = (a, extra) => { const s = flat(); if (a[0]) { s.b[0].on = true; s.b[0].f = a[0]; } OLD.forEach((bi, k) => { s.b[bi].g = a[k + 1]; }); if (a[8]) { s.b[8].on = true; s.b[8].f = a[8]; } return Object.assign(s, extra || {}); };
  const PRESETS_TRACK = {
    'Neutral': flat(),
    'Wärmer': PV([0, 2, 1.5, 0.5, 0, -1, -2, -2.5, 0]),
    'Mehr Biss': PV([60, 0, -1, -1, 1, 3, 2.5, 1, 0]),
    'Weniger Mulm': PV([70, -1, -3, -2, 0, 0.5, 0.5, 0, 0]),
    'Präsenz': PV([50, 0, 0, -1, 0.5, 2.5, 3, 2, 0]),
    'Bass raus (Platz für Bass)': PV([110, -6, -2, -0.5, 0, 0, 0, 0, 0]),
    'Gitarre im Mix': PV([90, 0, -1.5, -2, 0.5, 2, 1, -1, 12000]),
    'Gesang klar': PV([100, 0, -2, -1, 0, 2, 2.5, 2, 0]),
    'Höhen weich': PV([0, 0, 0, 0, 0, -1.5, -4, -6, 14000]),
    'Telefon / Lo-Fi': PV([400, 0, 0, 0, 5, 2, -6, 0, 3200])
  };
  const PRESETS_DRUMS = {
    'Neutral': flat(),
    'Druckvoll': PV([30, 3, 2, -2, -1, 1, 2, 1.5, 0]),
    'Mehr Bauch': PV([0, 4, 3, 0.5, -1, 0, 0, 0, 0]),
    'Weniger Becken': PV([0, 0, 0, 0, 0, -1.5, -4, -6, 0]),
    'Trocken & nah': PV([40, 1, -1, -3, 0, 1.5, 1, -1, 0]),
    'Rock-Kick & Snare': PV([35, 2, -1, -3.5, 0, 2.5, 1.5, 1, 0]),
    'Leise im Hintergrund': PV([0, -2, -1, 0, -1, -2, -3, -3, 0]),
    'Lo-Fi': PV([180, 0, -2, 2, 4, 1, -6, 0, 5000])
  };

  // ---- Bedienfeld ----
  const ICON = ['M3 15 Q8 3 21 3', 'M3 13 H8 L13 6 H21', 'M3 9 L8 9 L12 3 L16 9 L21 9 M3 9 L8 9 L12 15 L16 9', '', '', '', '', 'M3 6 H11 L16 13 H21', 'M3 3 Q16 3 21 15'];
  const fmtF = f => f >= 1000 ? (Math.round(f / 100) / 10).toString().replace('.', ',') + ' kHz' : Math.round(f) + ' Hz';
  function widget(host, opts) {
    let s = norm(opts.vals), sel = 3, anOn = false, raf = 0;
    const presets = opts.presets || PRESETS_TRACK, emit = () => { opts.onChange && opts.onChange(norm(s)); };
    host.classList.add('eq-panel', 'eq2');
    host.innerHTML =
      '<div class="eq2-bands">' + BANDS.map((b, i) => '<button type="button" class="eq2-bt" data-i="' + i + '" style="--bc:' + b.col + '" title="' + T(b.name) + '" aria-label="' + T(b.name) + ' an/aus"><svg viewBox="0 0 24 18" aria-hidden="true"><path d="' + (ICON[i] || ICON[2]) + '"/></svg></button>').join('') + '</div>' +
      '<div class="eq2-graph"><canvas aria-hidden="true"></canvas></div>' +
      '<div class="eq2-ctl">' +
        '<div class="eq2-row"><button type="button" class="toggle-btn eq2-an">' + T('Analyzer') + '</button><select class="eq-pre" aria-label="' + T('EQ-Vorlage') + '"><option value="">' + T('Vorlage …') + '</option>' + Object.keys(presets).map(k => '<option value="' + k + '">' + T(k) + '</option>').join('') + '</select><button type="button" class="toggle-btn eq-flat">' + T('Zurücksetzen') + '</button>' +
        '<label class="eq2-out"><span>' + T('Ausgang') + '</span><input type="range" class="eq2-o" min="-15" max="15" step="0.5" aria-label="' + T('Ausgang') + '"><b class="eq2-ov"></b></label></div>' +
        '<div class="eq2-row eq2-sel"><b class="eq2-name"></b>' +
        '<label><span>' + T('Frequenz') + '</span><input type="range" class="eq2-f" min="0" max="1000" aria-label="' + T('Frequenz') + '"><b class="eq2-fv"></b></label>' +
        '<label class="eq2-gl"><span>' + T('Verstärkung') + '</span><input type="range" class="eq2-g" min="-15" max="15" step="0.5" aria-label="' + T('Verstärkung') + '"><b class="eq2-gv"></b></label>' +
        '<label class="eq2-ql"><span>' + T('Güte (Q)') + '</span><input type="range" class="eq2-q" min="0" max="1000" aria-label="' + T('Güte') + '"><b class="eq2-qv"></b></label>' +
        '<div class="seg eq2-slope" role="group" aria-label="' + T('Steilheit') + '"><button type="button" class="toggle-btn" data-s="12">12 dB/Okt</button><button type="button" class="toggle-btn" data-s="24">24 dB/Okt</button></div></div>' +
      '</div>';
    const cv = host.querySelector('canvas'), $q = c => host.querySelector(c);
    const lf = f => Math.log(f / FMIN) / Math.log(FMAX / FMIN), fl = p => FMIN * Math.pow(FMAX / FMIN, p);
    const geo = () => { const w = cv.clientWidth, h = cv.clientHeight, L = 34, Rr = 30, top = 10, bot = 22; return { w, h, x0: L, x1: w - Rr, y0: top, y1: h - bot }; };
    const X = (G, f) => G.x0 + lf(f) * (G.x1 - G.x0), Y = (G, db) => G.y0 + (1 - (db + RANGE) / (2 * RANGE)) * (G.y1 - G.y0);
    const dotDb = i => CUT(i) ? 0 : s.b[i].g;
    function draw() {
      const dpr = window.devicePixelRatio || 1, G = geo(); if (!G.w || !G.h) return;
      if (cv.width !== Math.round(G.w * dpr) || cv.height !== Math.round(G.h * dpr)) { cv.width = Math.round(G.w * dpr); cv.height = Math.round(G.h * dpr); }
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, G.w, G.h);
      // Hintergrund und Raster
      const bg = c.createLinearGradient(0, 0, 0, G.h); bg.addColorStop(0, '#0b1c33'); bg.addColorStop(1, '#050b16'); c.fillStyle = bg; c.fillRect(0, 0, G.w, G.h);
      c.font = '10px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top';
      [20, 30, 40, 50, 60, 80, 100, 200, 300, 400, 500, 800, 1000, 2000, 3000, 4000, 6000, 8000, 10000, 20000].forEach(f => {
        const x = Math.round(X(G, f)) + 0.5, major = /^(1|2|5)/.test(String(f)) && f !== 30;
        c.strokeStyle = major ? 'rgba(140,180,255,.16)' : 'rgba(140,180,255,.07)'; c.beginPath(); c.moveTo(x, G.y0); c.lineTo(x, G.y1); c.stroke();
        if ([20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].includes(f) || f === 6000) { c.fillStyle = 'rgba(190,210,240,.7)'; c.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), x, G.y1 + 5); }
      });
      c.textAlign = 'right'; c.textBaseline = 'middle';
      for (let d = -15; d <= 15; d += 5) { const y = Math.round(Y(G, d)) + 0.5; c.strokeStyle = d === 0 ? 'rgba(200,220,255,.32)' : 'rgba(140,180,255,.08)'; c.beginPath(); c.moveTo(G.x0, y); c.lineTo(G.x1, y); c.stroke(); c.fillStyle = 'rgba(190,210,240,.6)'; c.fillText(String(Math.abs(d)), G.w - 6, y); }
      // Analyzer
      const an = anOn && opts.analyser && opts.analyser();
      if (an) {
        const buf = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(buf);
        const sr = an.context.sampleRate, nb = buf.length;
        c.beginPath(); c.moveTo(G.x0, G.y1);
        for (let x = G.x0; x <= G.x1; x += 2) {
          const f = fl((x - G.x0) / (G.x1 - G.x0)), k = Math.min(nb - 1, Math.round(f / (sr / 2) * nb));
          let v = -120; for (let j = Math.max(0, k - 2); j <= Math.min(nb - 1, k + 2); j++) v = Math.max(v, buf[j]);
          const y = G.y0 + clamp(-(v + 6) / 84, 0, 1) * (G.y1 - G.y0); c.lineTo(x, y);
        }
        c.lineTo(G.x1, G.y1); c.closePath(); c.fillStyle = 'rgba(80,150,255,.22)'; c.fill();
        c.textAlign = 'left'; c.fillStyle = 'rgba(190,210,240,.5)'; for (let d = 0; d <= 60; d += 15) c.fillText(String(d), 4, G.y0 + d / 84 * (G.y1 - G.y0));
      }
      // Kurve je Band (dünn) und Gesamtkurve
      const n = Math.max(80, Math.round((G.x1 - G.x0) / 2)), freqs = new Float32Array(n);
      for (let k = 0; k < n; k++) freqs[k] = fl(k / (n - 1));
      s.b.forEach((b, i) => {
        if (!b.on || (!CUT(i) && Math.abs(b.g) < 0.05)) return;
        const r = new Float32Array(n); bandResp(s, i, freqs, 48000, r);
        c.beginPath(); for (let k = 0; k < n; k++) { const x = X(G, freqs[k]), y = Y(G, clamp(r[k], -RANGE - 3, RANGE + 3)); k ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.lineTo(G.x1, Y(G, 0)); c.lineTo(G.x0, Y(G, 0)); c.closePath(); c.globalAlpha = i === sel ? 0.3 : 0.12; c.fillStyle = BANDS[i].col; c.fill(); c.globalAlpha = 1;
      });
      const r = responseDb(s, freqs, 48000);
      c.beginPath(); for (let k = 0; k < n; k++) { const x = X(G, freqs[k]), y = Y(G, clamp(r[k], -RANGE - 3, RANGE + 3)); k ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.lineWidth = 2; c.strokeStyle = '#d7e6ff'; c.shadowColor = '#6aa8ff'; c.shadowBlur = 6; c.stroke(); c.shadowBlur = 0;
      // Punkte
      s.b.forEach((b, i) => {
        const x = X(G, b.f), y = Y(G, dotDb(i)), rr = i === sel ? 9 : 7;
        c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2);
        if (b.on) { c.fillStyle = BANDS[i].col; c.globalAlpha = 0.95; c.fill(); c.globalAlpha = 1; } else { c.lineWidth = 1.5; c.strokeStyle = BANDS[i].col; c.globalAlpha = 0.55; c.stroke(); c.globalAlpha = 1; }
        if (i === sel) { c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); }
      });
    }
    const qPos = q => Math.round(Math.log(q / 0.3) / Math.log(40) * 1000), posQ = p => 0.3 * Math.pow(40, p / 1000);
    function show() {
      host.querySelectorAll('.eq2-bt').forEach(bt => { const i = +bt.dataset.i; bt.classList.toggle('on', s.b[i].on); bt.classList.toggle('sel', i === sel); bt.setAttribute('aria-pressed', String(s.b[i].on)); });
      const b = s.b[sel], cut = CUT(sel);
      $q('.eq2-name').textContent = T(BANDS[sel].name) + (b.on ? '' : ' (' + T('aus') + ')'); $q('.eq2-name').style.color = BANDS[sel].col;
      $q('.eq2-f').value = Math.round(lf(b.f) * 1000); $q('.eq2-fv').textContent = fmtF(b.f);
      $q('.eq2-gl').hidden = cut; $q('.eq2-g').value = b.g; $q('.eq2-gv').textContent = (b.g > 0 ? '+' : '') + String(b.g).replace('.', ',') + ' dB';
      $q('.eq2-ql').hidden = !(cut || BANDS[sel].type === 'peaking'); $q('.eq2-q').value = qPos(b.q); $q('.eq2-qv').textContent = String(Math.round(b.q * 100) / 100).replace('.', ',');
      $q('.eq2-slope').hidden = !cut; host.querySelectorAll('.eq2-slope button').forEach(x => x.classList.toggle('active', +x.dataset.s === (sel ? s.sh : s.sl)));
      $q('.eq2-o').value = s.out; $q('.eq2-ov').textContent = (s.out > 0 ? '+' : '') + String(s.out).replace('.', ',') + ' dB';
      $q('.eq2-an').classList.toggle('active', anOn); $q('.eq2-an').hidden = !opts.analyser;
      draw();
    }
    const change = () => { show(); emit(); };
    // Ziehen im Bild
    let drag = null, lastTap = { i: -1, t: 0 };
    const nearest = (e, maxPx) => { const r = cv.getBoundingClientRect(), G = geo(), x = e.clientX - r.left, y = e.clientY - r.top; let best = -1, bd = maxPx; s.b.forEach((b, i) => { const d = Math.hypot(X(G, b.f) - x, (Y(G, dotDb(i)) - y) * 0.6); if (d < bd) { bd = d; best = i; } }); return best; };
    cv.addEventListener('pointerdown', e => {
      let i = nearest(e, 34); if (i < 0) i = nearest(e, 1e9);
      const now = performance.now();
      if (i === lastTap.i && now - lastTap.t < 350) { if (CUT(i)) s.b[i].on = !s.b[i].on; else s.b[i].g = 0; lastTap.i = -1; sel = i; change(); return; }   // doppelt tippen: 0 dB bzw. Cut an/aus
      lastTap = { i, t: now }; sel = i; drag = { i, id: e.pointerId };
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault(); show();
    });
    cv.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const r = cv.getBoundingClientRect(), G = geo(), b = s.b[drag.i];
      b.f = Math.round(fl(clamp((e.clientX - r.left - G.x0) / (G.x1 - G.x0), 0, 1)));
      if (!CUT(drag.i)) b.g = rg(Math.round((RANGE - (e.clientY - r.top - G.y0) / (G.y1 - G.y0) * 2 * RANGE) * 2) / 2);
      if (!b.on) b.on = true;
      lastTap.i = -1; change();
    });
    const end = () => { drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    host.querySelector('.eq2-bands').addEventListener('click', e => { const bt = e.target.closest('.eq2-bt'); if (!bt) return; const i = +bt.dataset.i; if (sel === i || CUT(i)) s.b[i].on = !s.b[i].on; sel = i; change(); });
    $q('.eq2-f').addEventListener('input', e => { s.b[sel].f = Math.round(fl(e.target.value / 1000)); s.b[sel].on = true; change(); });
    $q('.eq2-g').addEventListener('input', e => { s.b[sel].g = rg(e.target.value); s.b[sel].on = true; change(); });
    $q('.eq2-q').addEventListener('input', e => { s.b[sel].q = Math.round(posQ(+e.target.value) * 100) / 100; change(); });
    $q('.eq2-o').addEventListener('input', e => { s.out = rg(e.target.value); change(); });
    host.querySelector('.eq2-slope').addEventListener('click', e => { const bt = e.target.closest('button'); if (!bt) return; if (sel) s.sh = +bt.dataset.s; else s.sl = +bt.dataset.s; change(); });
    $q('.eq-flat').addEventListener('click', () => { s = flat(); $q('.eq-pre').value = ''; change(); });
    $q('.eq-pre').addEventListener('change', e => { const p = presets[e.target.value]; if (p) { s = norm(p); change(); } });
    function loop() { raf = 0; if (!anOn || !host.isConnected || host.offsetParent === null) return; draw(); raf = requestAnimationFrame(loop); }
    $q('.eq2-an').addEventListener('click', () => { anOn = !anOn; show(); if (anOn && !raf) raf = requestAnimationFrame(loop); });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => draw()).observe(cv);
    show();
    return { set(v) { s = norm(v); show(); }, get: () => norm(s), draw: () => { draw(); if (anOn && !raf) raf = requestAnimationFrame(loop); }, select: i => { sel = i; show(); } };
  }

  return { BANDS, chain, widget, render, responseDb, flat, isFlat, norm, legacy, PRESETS_TRACK, PRESETS_DRUMS };
})();
