// ---------- Studio: Mischpult ----------
const Mix = (() => {
  const $ = id => document.getElementById(id), host = $('mix');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FR = (() => { const a = new Float32Array(60); for (let i = 0; i < 60; i++) a[i] = 20 * Math.pow(1000, i / 59); return a; })();
  let raf = 0, pk = [], mpk = 0;
  function eqMini(cv, vals) {
    const dpr = devicePixelRatio || 1, w = cv.clientWidth || 100, h = cv.clientHeight || 40; cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    let r; try { r = EQ7.responseDb(vals, FR, Engine.sr()); } catch (e) { return; }
    g.strokeStyle = EQ7.isFlat(vals) ? '#5a6a80' : '#7fd8ff'; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < FR.length; i++) { const x = i / (FR.length - 1) * w, y = h / 2 - Math.max(-18, Math.min(18, r[i])) / 18 * (h / 2 - 3); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  }
  const dbTxt = v => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10).toString().replace('.', ',') + ' dB';
  const fx2 = t => { const f = t.fx || {}; return [['comp', 'Kompressor', f.comp && f.comp.on], ['sat', 'Sättigung', f.sat && f.sat.on], ['rev', 'Hall ' + (f.rev || 0) + ' %', (f.rev || 0) > 0], ['dly', 'Delay ' + (f.dly || 0) + ' %', (f.dly || 0) > 0]]; };
  function render() {
    const P = Proj.P; if (!P) { host.innerHTML = ''; return; }
    let h = '';
    P.tracks.forEach((t, i) => {
      h += '<div class="strip' + (Arr.V.selTrack === t.id ? ' sel' : '') + '" data-t="' + t.id + '"><div class="nm" title="' + esc(t.name) + '"><i style="background:' + t.color + '"></i>' + esc(t.name) + '</div>' +
        '<canvas class="eqm" data-a="eq" title="EQ"></canvas>' + fx2(t).map(([k, n, on]) => '<div class="slot' + (on ? ' on' : '') + '" data-a="fx" data-k="' + k + '">' + n + '</div>').join('') +
        '<input type="range" class="pan" min="-100" max="100" step="1" value="' + (t.pan || 0) + '" data-a="pan" aria-label="Panorama ' + esc(t.name) + '"><div class="db" data-v="pan">' + panTxt(t.pan) + '</div>' +
        '<div class="fz"><input type="range" min="-60" max="6" step="0.5" value="' + (t.vol || 0) + '" data-a="vol" aria-label="Lautstärke ' + esc(t.name) + '"><canvas data-m="' + i + '"></canvas></div>' +
        '<div class="db" data-v="vol">' + dbTxt(t.vol || 0) + '</div><div class="msb"><button class="m' + (t.mute ? ' on' : '') + '" data-a="mute">M</button><button class="s' + (t.solo ? ' on' : '') + '" data-a="solo">S</button></div></div>';
    });
    const m = P.master;
    h += '<div class="strip master" data-t="master"><div class="nm">Master</div><canvas class="eqm" data-a="eq"></canvas>' +
      '<div class="slot' + (m.glue !== false ? ' on' : '') + '" data-a="glue">Bus-Kompressor</div><div class="slot' + (m.lim !== false ? ' on' : '') + '" data-a="lim">Limiter</div>' +
      '<div class="slot" data-a="bus">Hall ' + ((P.bus.revSec || 2.4) + '').replace('.', ',') + ' s · Delay</div>' +
      '<div class="fz"><input type="range" min="-30" max="6" step="0.5" value="' + (m.vol || 0) + '" data-a="vol" aria-label="Master-Lautstärke"><canvas data-m="M"></canvas></div><div class="db" data-v="vol">' + dbTxt(m.vol || 0) + '</div></div>';
    if (!P.tracks.length) h = '<p class="empty">Noch keine Spuren. Hole etwas „Aus dem Looper“ oder tippe im Arrangement auf „+ Spur“.</p>' + h;
    host.innerHTML = h;
    host.querySelectorAll('canvas.eqm').forEach(cv => { const id = cv.closest('.strip').dataset.t; eqMini(cv, id === 'master' ? P.master.eq : P.tracks[Proj.tIndex(id)].eq); });
    pk = P.tracks.map(() => 0); loop();
  }
  const panTxt = p => !p ? 'Mitte' : (p < 0 ? 'L ' : 'R ') + Math.abs(p);
  host.addEventListener('input', e => {
    const el = e.target, s = el.closest('.strip'); if (!s) return; const id = s.dataset.t, a = el.dataset.a, v = +el.value;
    if (id === 'master') { Proj.P.master.vol = v; Engine.applyMaster(); s.querySelector('[data-v=vol]').textContent = dbTxt(v); Proj.change('mix', () => {}, { noUndo: true }); return; }
    const t = Proj.P.tracks[Proj.tIndex(id)]; if (!t) return;
    if (a === 'vol') { t.vol = v; s.querySelector('[data-v=vol]').textContent = dbTxt(v); }
    if (a === 'pan') { t.pan = v; s.querySelector('[data-v=pan]').textContent = panTxt(v); }
    Engine.applyTrack(Proj.tIndex(id), true);
  });
  // Ende einer Fader-Bewegung = ein Rückgängig-Schritt
  host.addEventListener('change', e => { if (e.target.dataset.a === 'vol' || e.target.dataset.a === 'pan') Proj.change('mix', () => {}, {}); });
  host.addEventListener('dblclick', e => { const el = e.target; if (el.type !== 'range') return; el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  host.addEventListener('click', e => {
    const s = e.target.closest('.strip'); if (!s) return; const id = s.dataset.t, el = e.target.closest('[data-a]'), a = el && el.dataset.a;
    if (id !== 'master' && !a) { Arr.selectTrack(id); render(); return; }
    if (!a) return;
    if (id === 'master') {
      if (a === 'eq') return eqDlg('master');
      if (a === 'glue' || a === 'lim') { Proj.change('mix', p => { p.master[a] = p.master[a] === false; }); Engine.applyMaster(); render(); return; }
      if (a === 'bus') return busDlg();
      return;
    }
    if (a === 'eq') return eqDlg(id);
    if (a === 'fx') return fxDlg(id, el.dataset.k);
    if (a === 'mute' || a === 'solo') { Proj.editTrack(id, t => { t[a] = !t[a]; }, { noUndo: true }); Proj.P.tracks.forEach((_, i) => Engine.applyTrack(i, true)); render(); Arr.heads(); }
  });
  // ---- EQ-Fenster (gleicher EQ wie im Looper) ----
  function eqDlg(id) {
    const P = Proj.P, master = id === 'master', t = master ? null : P.tracks[Proj.tIndex(id)];
    UI.dialog('<h2>EQ · ' + esc(master ? 'Master' : t.name) + '</h2><div id="eqHost"></div><div class="btns"><button class="btn p" data-close>Fertig</button></div>');
    const before = JSON.stringify(master ? P.master.eq : t.eq);
    EQ7.widget(document.getElementById('eqHost'), { vals: master ? P.master.eq : t.eq, presets: !master && t.kind === 'drum' ? EQ7.PRESETS_DRUMS : EQ7.PRESETS_TRACK,
      analyser: () => { const G = Engine.graph; if (!G) return null; const n = master ? G.master.mEq : G.tr[Proj.tIndex(id)] && G.tr[Proj.tIndex(id)].eq; return n && n.analyser ? n.analyser() : null; },
      onChange: v => { if (master) { P.master.eq = v; Engine.applyMaster(); } else { t.eq = v; Engine.applyTrack(Proj.tIndex(id), true); } } });
    UI.onClose(() => { const now = JSON.stringify(master ? P.master.eq : t.eq); if (now !== before) { const v = JSON.parse(now); if (master) P.master.eq = JSON.parse(before); else t.eq = JSON.parse(before); Proj.change('mix', p => { if (master) p.master.eq = v; else p.tracks[Proj.tIndex(id)].eq = v; }); } render(); });
  }
  // ---- Effekte je Spur ----
  function fxDlg(id) {
    const i = Proj.tIndex(id), t = Proj.P.tracks[i], f = t.fx, before = JSON.stringify(f);
    const sl = (k, n, min, max, step, v, u) => '<label>' + n + ' <b data-o="' + k + '">' + v + (u || '') + '</b></label><input type="range" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '" data-u="' + (u || '') + '">';
    UI.dialog('<h2>Effekte · ' + esc(t.name) + '</h2><div class="fxp">' +
      '<div class="card"><label style="color:var(--ink)"><b>Kompressor</b><input type="checkbox" data-k="comp.on"' + (f.comp.on ? ' checked' : '') + '></label>' + sl('comp.th', 'Schwelle', -50, 0, 1, f.comp.th, ' dB') + sl('comp.ratio', 'Verhältnis', 1, 20, 0.5, f.comp.ratio, ':1') + sl('comp.att', 'Ansprechzeit', 1, 100, 1, f.comp.att, ' ms') + sl('comp.rel', 'Abklingzeit', 20, 800, 10, f.comp.rel, ' ms') + sl('comp.mk', 'Aufholen', 0, 18, 0.5, f.comp.mk, ' dB') + '</div>' +
      '<div class="card"><label style="color:var(--ink)"><b>Sättigung (Röhre/Band)</b><input type="checkbox" data-k="sat.on"' + (f.sat.on ? ' checked' : '') + '></label>' + sl('sat.drive', 'Stärke', 0, 100, 1, f.sat.drive, ' %') + '</div>' +
      '<div class="card"><b>Sends</b>' + sl('rev', 'Hall', 0, 100, 1, f.rev || 0, ' %') + sl('dly', 'Delay', 0, 100, 1, f.dly || 0, ' %') + '<p class="note">Hall und Delay sind gemeinsame Busse – einstellen beim Master („Hall · Delay“).</p></div>' +
      '</div><div class="btns"><button class="btn" data-pre="vocal">Vorlage Gesang</button><button class="btn" data-pre="git">Vorlage Gitarre</button><button class="btn" data-pre="bass">Vorlage Bass</button><button class="btn" data-pre="drums">Vorlage Drums</button><button class="btn" data-pre="off">Alles aus</button><span style="flex:1"></span><button class="btn p" data-close>Fertig</button></div>');
    const dlg = $('dlg');
    const setK = (k, v) => { const [a, b] = k.split('.'); if (b) f[a][b] = v; else f[a] = v; };
    const show = () => dlg.querySelectorAll('[data-k]').forEach(el => { const [a, b] = el.dataset.k.split('.'), v = b ? f[a][b] : f[a]; if (el.type === 'checkbox') el.checked = !!v; else { el.value = v; const o = dlg.querySelector('[data-o="' + el.dataset.k + '"]'); if (o) o.textContent = v + el.dataset.u; } });
    dlg.addEventListener('input', e => { const el = e.target, k = el.dataset.k; if (!k) return; setK(k, el.type === 'checkbox' ? el.checked : +el.value); if (/^comp\.(?!on)/.test(k)) f.comp.on = true; if (/^sat\.drive/.test(k)) f.sat.on = true; show(); Engine.applyTrack(i, true); });
    const PRE = { vocal: { comp: { on: true, th: -20, ratio: 3, att: 8, rel: 140, mk: 4 }, sat: { on: true, drive: 15 }, rev: 22, dly: 10 }, git: { comp: { on: true, th: -16, ratio: 2.5, att: 15, rel: 160, mk: 2 }, sat: { on: true, drive: 25 }, rev: 15, dly: 0 },
      bass: { comp: { on: true, th: -22, ratio: 4, att: 20, rel: 200, mk: 5 }, sat: { on: true, drive: 30 }, rev: 0, dly: 0 }, drums: { comp: { on: true, th: -14, ratio: 3, att: 25, rel: 100, mk: 3 }, sat: { on: true, drive: 20 }, rev: 10, dly: 0 }, off: { comp: { on: false, th: -18, ratio: 3, att: 10, rel: 120, mk: 0 }, sat: { on: false, drive: 30 }, rev: 0, dly: 0 } };
    dlg.addEventListener('click', e => { const b = e.target.closest('[data-pre]'); if (!b) return; const p = JSON.parse(JSON.stringify(PRE[b.dataset.pre])); Object.assign(f, p); show(); Engine.applyTrack(i, true); });
    UI.onClose(() => { const now = JSON.stringify(f); if (now !== before) { const v = JSON.parse(now); t.fx = JSON.parse(before); Proj.change('mix', p => { p.tracks[i].fx = v; }); Engine.applyTrack(i, true); } render(); });
  }
  function busDlg() {
    const b = Proj.P.bus, before = JSON.stringify(b);
    UI.dialog('<h2>Hall und Delay (gemeinsam für alle Spuren)</h2><div class="fxp"><div class="card"><b>Hall</b><label>Länge <b id="oRv">' + b.revSec + ' s</b></label><input type="range" id="iRv" min="0.4" max="8" step="0.1" value="' + b.revSec + '"></div>' +
      '<div class="card"><b>Delay</b><label>Abstand <select id="iDb"><option value="0.25">1/16</option><option value="0.5">1/8</option><option value="0.75">1/8 punktiert</option><option value="1">1/4</option><option value="1.5">1/4 punktiert</option><option value="2">1/2</option></select></label><label>Wiederholungen <b id="oFb">' + b.dlyFb + ' %</b></label><input type="range" id="iFb" min="0" max="90" step="1" value="' + b.dlyFb + '"></div></div>' +
      '<p class="note">Wie viel Hall/Delay jede Spur bekommt, stellst du im Kanal unter „Hall“ und „Delay“ ein.</p><div class="btns"><button class="btn p" data-close>Fertig</button></div>');
    $('iDb').value = String(b.dlyBeats);
    $('iRv').oninput = e => { b.revSec = +e.target.value; $('oRv').textContent = b.revSec + ' s'; };
    $('iFb').oninput = e => { b.dlyFb = +e.target.value; $('oFb').textContent = b.dlyFb + ' %'; Engine.applyMaster(); };
    $('iDb').onchange = e => { b.dlyBeats = +e.target.value; Engine.applyMaster(); };
    UI.onClose(() => { const now = JSON.stringify(b); if (now !== before) { const v = JSON.parse(now), rv = JSON.parse(before).revSec !== v.revSec; Object.assign(b, JSON.parse(before)); Proj.change('mix', p => { p.bus = v; }); Engine.dirty(rv); } render(); });
  }
  // ---- Pegelanzeigen ----
  function bar(cv, v) {
    const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, w, h);
    const db = 20 * Math.log10(Math.max(1e-5, v)), y = Math.max(0, Math.min(1, (db + 60) / 66));
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#3ad07a'); gr.addColorStop(0.75, '#d6d23a'); gr.addColorStop(0.92, '#ff5d5d'); g.fillStyle = gr; g.fillRect(1, h * (1 - y), w - 2, h * y);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, h * (1 - 60 / 66), w, 1);
  }
  function loop() {
    cancelAnimationFrame(raf); if (document.getElementById('v-mix').hidden) return;
    host.querySelectorAll('canvas[data-m]').forEach(cv => { const k = cv.dataset.m; if (k === 'M') { mpk = Math.max(mpk * 0.88, Engine.masterLevel()); bar(cv, mpk); } else { const i = +k; pk[i] = Math.max((pk[i] || 0) * 0.88, Engine.level(i)); bar(cv, pk[i]); } });
    raf = requestAnimationFrame(loop);
  }
  return { render, eqDlg, fxDlg, eqMini };
})();
