/* ---------- v155: Übezeit – detaillierte Übersicht (Teil B) ----------
   Liest nur Uebezeit.load() (localStorage „3nps-uebezeit“, Format siehe uebezeit.js). Rechnet nur beim Öffnen der Seite und nach Änderungen
   (paint), kein Timer. Alle Diagramme als SVG in echter Pixelbreite der Karte (Schrift bleibt scharf), Farben aus den Optik-Variablen.
   Profil „Minimal“: nur Kennzahlen (Diagramm-Karten ausgeblendet und nicht gerechnet).
   Zuordnung zu Tagen über das Ende einer Einheit (wie Numbers und v154); Tageszeit verteilt die Minuten von Beginn bis Ende. */
window.UebezeitAnsicht = (() => {
  const U = () => window.Uebezeit, TT = s => (typeof T === 'function' ? T(s) : s), $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SKEY = '3nps-uebezeit-ansicht';
  const RANGES = { '1W': 7, '1M': 30, '3M': 91, '1J': 365, '3J': 1095, all: 0 };
  let st = { r: '1J', m: 'zeit', th: '*', ar: '1J', tr: '1J', yr: 0 };
  try { Object.assign(st, JSON.parse(localStorage.getItem(SKEY) || '{}') || {}); } catch (e) {}
  if (RANGES[st.r] == null) st.r = '1J';
  const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(st)); } catch (e) {} };
  const loc = () => (window.__lang === 'en' ? 'en-GB' : 'de-DE');
  const day0 = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
  const week0 = t => { const d = new Date(day0(t)); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
  const month0 = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
  const addMonths = (t, n) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime(); };
  // gleicher Zeitpunkt im Vormonat/Vorjahr (Tag auf Monatsende begrenzt)
  const shiftM = (t, n) => { const d = new Date(t), y = d.getFullYear(), m = d.getMonth() + n, last = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(d.getDate(), last), d.getHours(), d.getMinutes(), d.getSeconds()).getTime(); };
  const fmtHM = sec => U().fmtHM(sec);
  const fmtH = min => { const h = min / 60; return (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10).toString().replace('.', window.__lang === 'en' ? '.' : ',') + ' h'; };
  const fmtShort = min => min >= 60 ? fmtH(min) : Math.round(min) + ' min';
  const dfmt = (t, o) => new Date(t).toLocaleDateString(loc(), o);
  const dShort = t => dfmt(t, { day: '2-digit', month: '2-digit' }), dLong = t => dfmt(t, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const mName = t => dfmt(t, { month: 'short' }).replace('.', '');
  const ymKey = t => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth(); };
  const dayKey = t => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const minDev = () => document.documentElement.classList.contains('dev-min');

  // Einheiten als { s, e, sec, t, k } (ms), nach Ende sortiert
  const prep = d => d.u.map(u => ({ e: u[0] * 1000, s: (u[0] - u[1]) * 1000, sec: u[1], t: u[3] || '', k: u[2] }));
  const sumIn = (us, a, b, th) => us.reduce((x, u) => x + (u.e >= a && u.e < b && (th == null || th === '*' || u.t === th) ? u.sec : 0), 0);

  /* ---------- Kennzahlen ---------- */
  function kpi(us, now) {
    const D = day0(now), W = week0(now), M = month0(now), Y = new Date(new Date(now).getFullYear(), 0, 1).getTime(), end = now + 1;
    const per = [
      ['Heute', D, end, addDays(D, -1), addDays(now, -1) + 1, 'zu gestern'],
      ['Diese Woche', W, end, addDays(W, -7), addDays(now, -7) + 1, 'zur Vorwoche'],
      ['Dieser Monat', M, end, addMonths(M, -1), shiftM(now, -1) + 1, 'zum Vormonat'],
      ['Dieses Jahr', Y, end, new Date(new Date(now).getFullYear() - 1, 0, 1).getTime(), shiftM(now, -12) + 1, 'zum Vorjahr']
    ].map(p => ({ l: p[0], v: sumIn(us, p[1], p[2]), pv: sumIn(us, p[3], p[4]), c: p[5] }));
    const tot = us.reduce((x, u) => x + u.sec, 0);
    const days = new Map(); us.forEach(u => { if (u.sec > 0) { const k = dayKey(u.e); days.set(k, (days.get(k) || 0) + u.sec); } });
    // Serie: Tage in Folge (aktuell = bis heute oder gestern), beste
    let best = 0, run = 0, prevD = null;
    [...days.keys()].sort((a, b) => a - b).forEach(k => {
      const t = new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100).getTime();
      run = prevD != null && day0(addDays(prevD, 1)) === t ? run + 1 : 1; best = Math.max(best, run); prevD = t;
    });
    let cur = 0, t = D; if (!days.has(dayKey(t))) t = addDays(t, -1);
    while (days.has(dayKey(t))) { cur++; t = addDays(t, -1); }
    const longest = us.reduce((a, u) => (!a || u.sec > a.sec ? u : a), null);
    const wk = new Map(); us.forEach(u => { const k = week0(u.e); wk.set(k, (wk.get(k) || 0) + u.sec); });
    let bw = null; wk.forEach((v, k) => { if (!bw || v > bw.v) bw = { k, v }; });
    return { per, tot, n: us.length, first: us.length ? us[0].e : null, days: days.size, avg: days.size ? tot / days.size : 0, cur, best, longest, bw };
  }
  function chg(v, pv) {
    const d = v - pv;
    if (Math.abs(d) < 60) return { c: '', t: '± 0 min' };
    return { c: d > 0 ? 'up' : 'down', t: (d > 0 ? '▲ ' : '▼ ') + fmtHM(Math.abs(d)) };
  }
  function paintKpi(us, now) {
    const k = kpi(us, now);
    const tile = (val, lbl, sub, cls) => '<div class="uz-sum"><div class="uz-sv">' + esc(val) + '</div><div class="uz-sl">' + esc(lbl) + '</div><div class="uz-chg ' + (cls || '') + '">' + esc(sub || '') + '</div></div>';
    $('uzSums').innerHTML = k.per.map(p => { const c = chg(p.v, p.pv); return tile(fmtHM(p.v), TT(p.l), us.length ? c.t + ' ' + TT(p.c) : '', c.c); }).join('')
      + tile(fmtHM(k.tot), TT('Insgesamt'), k.n ? k.n + ' ' + TT(k.n === 1 ? 'Einheit' : 'Einheiten') : '', 'tot');
    $('uzKpi2').innerHTML = [
      tile(fmtHM(k.avg), TT('Ø je Übetag'), ''),
      tile(String(k.days), TT('Übetage'), k.first ? TT('seit') + ' ' + dLong(k.first) : ''),
      tile(k.cur + ' ' + TT(k.cur === 1 ? 'Tag' : 'Tage'), TT('Serie'), TT('beste') + ': ' + k.best + ' ' + TT(k.best === 1 ? 'Tag' : 'Tage')),
      tile(k.longest ? fmtHM(k.longest.sec) : '–', TT('Längste Einheit'), k.longest ? dLong(k.longest.e) : ''),
      tile(k.bw ? fmtHM(k.bw.v) : '–', TT('Beste Woche'), k.bw ? TT('ab') + ' ' + dLong(k.bw.k) : '')
    ].join('');
    $('uzSumN').textContent = us.length ? TT('Vergleich jeweils bis zum gleichen Zeitpunkt des Vorzeitraums.') : TT('Noch keine Einheiten – Schalter oben einschalten, nachtragen oder unten importieren.');
    return k;
  }

  /* ---------- Verlauf (Börsenkurs-Stil) ---------- */
  function span(us, now, r) {
    const end = addDays(day0(now), 1), n = RANGES[r];
    const first = us.length ? day0(us[0].e) : day0(now);
    const a = n ? addDays(end, -n) : first, days = Math.max(1, Math.round((end - a) / 864e5));
    const bin = days <= 31 ? 'd' : days <= 400 ? 'w' : 'm';
    return { a, end, days, bin, n, pa: n ? addDays(a, -n) : null };
  }
  function series(us, now) {
    const s = span(us, now, st.r), key = s.bin === 'd' ? day0 : s.bin === 'w' ? week0 : month0;
    const nxt = t => s.bin === 'd' ? addDays(t, 1) : s.bin === 'w' ? addDays(t, 7) : addMonths(t, 1);
    const pts = []; for (let t = key(s.a); t < s.end; t = nxt(t)) pts.push({ t, v: 0 });
    const idx = new Map(pts.map((p, i) => [p.t, i])), th = st.th;
    let base = 0, sum = 0, prev = 0;
    us.forEach(u => {
      if (th !== '*' && u.t !== th) return;
      const m = u.sec / 60;
      if (u.e < s.a) base += m;
      if (u.e >= s.a && u.e < s.end) { const i = idx.get(key(u.e)); if (i != null) pts[i].v += m; sum += m; }
      else if (s.pa != null && u.e >= s.pa && u.e < s.a) prev += m;
    });
    if (st.m === 'sum') { let c = base; pts.forEach(p => { c += p.v; p.c = c; }); }
    return { s, pts, sum, prev, base };
  }
  function lineSvg(r, W) {
    const H = W < 500 ? 170 : 210, PL = 6, PR = 52, PT = 10, PB = 24, ps = r.pts, cum = st.m === 'sum';
    const vals = ps.map(p => cum ? p.c : p.v), max = Math.max(1, ...vals), lo = cum ? Math.max(0, Math.min(...vals) - (max - Math.min(...vals)) * 0.08) : 0;
    const hi = max + (max - lo) * 0.08, iw = W - PL - PR, ih = H - PT - PB;
    const x = i => PL + (ps.length < 2 ? iw / 2 : i * iw / (ps.length - 1)), y = v => PT + ih - (v - lo) / (hi - lo || 1) * ih;
    const line = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const area = line + ' L' + x(vals.length - 1).toFixed(1) + ' ' + (PT + ih) + ' L' + x(0).toFixed(1) + ' ' + (PT + ih) + ' Z';
    const grid = [lo, (lo + hi) / 2, hi].map((v, i) => '<line class="uz-gl' + (i ? '' : ' base') + '" x1="' + PL + '" x2="' + (W - PR + 4) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>'
      + '<text class="uz-ax" x="' + (W - PR + 8) + '" y="' + (y(v) + 4).toFixed(1) + '">' + esc(fmtShort(v)) + '</text>').join('');
    const nt = W < 500 ? 3 : 5, ticks = [];
    for (let k = 0; k < nt; k++) {
      const i = Math.round(k * (ps.length - 1) / Math.max(1, nt - 1)), t = ps[i].t;
      const lab = r.s.bin === 'm' ? mName(t) + ' ' + String(new Date(t).getFullYear()).slice(2) : dShort(t);
      ticks.push('<text class="uz-ax" x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (k === 0 ? 'start' : k === nt - 1 ? 'end' : 'middle') + '">' + esc(lab) + '</text>');
    }
    const li = vals.length - 1, dots = ps.length <= 31 && !cum ? vals.map((v, i) => v > 0 ? '<circle class="uz-dot" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.6"/>' : '').join('') : '';
    return '<svg class="uz-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(TT('Verlauf der Übezeit')) + '">' + grid
      + '<path class="uz-area" d="' + area + '"/><path class="uz-line" d="' + line + '"/>' + dots
      + '<circle class="uz-end" cx="' + x(li).toFixed(1) + '" cy="' + y(vals[li]).toFixed(1) + '" r="5"/>' + ticks.join('') + '</svg>';
  }
  function themeOpts(us) {
    const t = U().topics(), used = new Set(us.map(u => u.t));
    const ids = [''].concat(U().DEF.map(x => x[0]), t.c.map(x => x[0])).filter(id => used.has(id));
    return '<option value="*">' + esc(TT('Alle Themen')) + '</option>' + ids.map(id => '<option value="' + esc(id) + '"' + (st.th === id ? ' selected' : '') + '>' + esc(U().tname(id, t)) + '</option>').join('');
  }
  function paintVerlauf(us, now, w) {
    const el = $('uzVl'); if (!el) return;
    const r = series(us, now), cum = st.m === 'sum', W = Math.max(260, w || 600);
    const binL = { d: TT('je Tag'), w: TT('je Woche'), m: TT('je Monat') }[r.s.bin];
    const per = { '1W': TT('7 Tage'), '1M': TT('30 Tage'), '3M': TT('3 Monate'), '1J': TT('12 Monate'), '3J': TT('3 Jahre'), all: TT('seit Beginn') }[st.r];
    let big, ch = '', cls = '';
    if (cum) { const endV = r.pts.length ? r.pts[r.pts.length - 1].c : 0; big = fmtHM(endV * 60); ch = '▲ ' + fmtHM(r.sum * 60) + ' ' + TT('in diesem Zeitraum'); cls = r.sum > 0 ? 'up' : ''; }
    else {
      big = fmtHM(r.sum * 60);
      if (r.s.pa != null) { const d = r.sum - r.prev; if (r.prev <= 0) { ch = r.sum > 0 ? '▲ ' + TT('neu') + ' · ' + TT('vorher nichts eingetragen') : ''; cls = r.sum > 0 ? 'up' : ''; } else { cls = d > 0.5 ? 'up' : d < -0.5 ? 'down' : ''; ch = (d > 0.5 ? '▲ ' : d < -0.5 ? '▼ ' : '± ') + fmtHM(Math.abs(d) * 60) + ' (' + (d >= 0 ? '+' : '−') + Math.round(Math.abs(d) / r.prev * 100) + ' %) ' + TT('zum Vorzeitraum'); } }
    }
    const has = r.pts.some(p => p.v > 0) || (cum && r.base > 0);
    const full = r.s.bin === 'd' || r.pts.length < 2 ? r.pts : r.pts.slice(0, -1);   // laufende Woche/Monat ist noch nicht vollständig → nicht als „Tief“
    const hiP = r.pts.reduce((a, p) => (!a || p.v > a.v ? p : a), null), loP = full.reduce((a, p) => (!a || p.v < a.v ? p : a), null);
    const lab = p => p ? fmtHM(p.v * 60) + ' · ' + (r.s.bin === 'm' ? mName(p.t) + ' ' + new Date(p.t).getFullYear() : (r.s.bin === 'w' ? TT('Woche ab') + ' ' : '') + dShort(p.t)) : '–';
    const avg = r.pts.length ? r.sum / r.pts.length : 0;
    const rb = Object.keys(RANGES).map(k => '<button type="button" class="toggle-btn' + (st.r === k ? ' active' : '') + '" data-vr="' + k + '">' + esc(k === 'all' ? TT('Alles') : k) + '</button>').join('');
    el.innerHTML = '<div class="uz-vtop"><div><div class="uz-big" id="uzVBig">' + esc(big) + '</div><div class="uz-chg ' + cls + '" id="uzVChg">' + esc(ch) + '</div>'
      + '<div class="caption" id="uzVSub">' + esc((cum ? TT('Gesamtstunden') : TT('Übezeit')) + ' · ' + per + ' · ' + binL) + '</div></div>'
      + '<div class="uz-vctl"><div class="seg" role="group" aria-label="' + esc(TT('Darstellung')) + '"><button type="button" class="toggle-btn' + (!cum ? ' active' : '') + '" data-vm="zeit">' + esc(TT('je Zeitraum')) + '</button><button type="button" class="toggle-btn' + (cum ? ' active' : '') + '" data-vm="sum">' + esc(TT('aufsummiert')) + '</button></div>'
      + '<label class="uz-thsel"><span class="sr">' + esc(TT('Thema')) + '</span><select id="uzVTh">' + themeOpts(us) + '</select></label></div></div>'
      + '<div class="uz-chart" id="uzVChart">' + (has ? lineSvg(r, W) : '<p class="pattern-desc uz-empty">' + esc(TT('In diesem Zeitraum ist nichts eingetragen.')) + '</p>') + '</div>'
      + '<div class="seg uz-vr" role="group" aria-label="' + esc(TT('Zeitraum')) + '">' + rb + '</div>'
      + '<div class="uz-hl">' + (cum ? '<span><span class="caption">' + esc(TT('Beginn')) + '</span> <b>' + esc(fmtHM((r.pts[0] ? r.pts[0].c - r.pts[0].v : 0) * 60)) + '</b></span>'
        : '<span><span class="caption">' + esc(TT('Hoch')) + '</span> <b id="uzVHi">' + esc(has ? lab(hiP) : '–') + '</b></span><span><span class="caption">' + esc(TT('Tief')) + '</span> <b id="uzVLo">' + esc(has ? lab(loP) : '–') + '</b></span>'
        + '<span><span class="caption">Ø ' + esc(binL) + '</span> <b id="uzVAvg">' + esc(fmtHM(avg * 60)) + '</b></span>') + '</div>';
  }

  /* ---------- Balken ---------- */
  function bars(items, W, o) {
    o = o || {}; const H = o.h || 150, PT = 18, PB = 20, n = items.length, gap = n > 10 ? 3 : 6;
    const max = Math.max(...items.map(x => x.v)) || 1, bw = (W - gap * (n - 1)) / n, ih = H - PT - PB;
    return '<svg class="uz-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || '') + '">'
      + '<line class="uz-gl base" x1="0" x2="' + W + '" y1="' + (PT + ih) + '" y2="' + (PT + ih) + '"/>'
      + items.map((it, i) => {
        const x = i * (bw + gap), h = it.v > 0 ? Math.max(2, it.v / max * ih) : 0, y = PT + ih - h;
        return '<rect class="uz-bar' + (it.hl ? ' hl' : '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(4, bw / 4).toFixed(1) + '"><title>' + esc(it.l + ': ' + it.t) + '</title></rect>'
          + (it.t && (o.allVals && bw >= 18 || it.v === max) ? '<text class="uz-bv" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle">' + esc(it.t) + '</text>' : '')
          + (it.l && (!o.every || i % o.every === 0) ? '<text class="uz-ax" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle">' + esc(it.l) + '</text>' : '');
      }).join('') + '</svg>';
  }
  const seg = (key, keys, cur) => '<div class="seg uz-rs" role="group">' + keys.map(k => '<button type="button" class="toggle-btn' + (cur === k ? ' active' : '') + '" data-' + key + '="' + k + '">' + esc(k === 'all' ? TT('Alles') : k) + '</button>').join('') + '</div>';
  function rangeA(us, now, r) { const end = addDays(day0(now), 1), n = RANGES[r]; return { a: n ? addDays(end, -n) : (us.length ? day0(us[0].s) : day0(now)), end }; }
  function wann(us, now) {
    const { a, end } = rangeA(us, now, st.ar), wd = new Array(7).fill(0), cnt = new Array(7).fill(0), hr = new Array(12).fill(0);
    for (let t = a; t < end; t = addDays(t, 1)) cnt[(new Date(t).getDay() + 6) % 7]++;
    let tot = 0;
    us.forEach(u => {
      if (u.e < a || u.e >= end) return;
      wd[(new Date(u.e).getDay() + 6) % 7] += u.sec / 60;
      // Minuten auf 2-Stunden-Fenster verteilen (Beginn bis Ende)
      let t = u.s; while (t < u.e) { const d = new Date(t), h = d.getHours(), nx = Math.min(u.e, new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + 1).getTime()); hr[h >> 1] += (nx - t) / 60000; tot += (nx - t) / 60000; t = nx; }
    });
    return { wd: wd.map((v, i) => cnt[i] ? v / cnt[i] : 0), hr: hr.map(v => tot ? v / tot : 0), tot };
  }
  const WDN = () => [1, 2, 3, 4, 5, 6, 0].map(d => new Date(2024, 0, 7 + d).toLocaleDateString(loc(), { weekday: 'short' }).replace('.', '').slice(0, 2));
  function paintWann(us, now, w0) {
    const el = $('uzWn'); if (!el) return; const w = wann(us, now), W = Math.max(240, w0 || 300), wn = WDN();
    const mx = Math.max(...w.wd);
    el.innerHTML = seg('ar', ['3M', '1J', 'all'], st.ar)
      + '<div class="uz-bh">' + esc(TT('Ø je Wochentag')) + '</div>' + bars(w.wd.map((v, i) => ({ v, l: wn[i], t: v > 0 ? Math.round(v) + ' min' : '', hl: v === mx && v > 0 })), W, { allVals: true, label: TT('Ø je Wochentag') })
      + '<div class="uz-bh">' + esc(TT('Tageszeit (Anteil, 2-Stunden-Fenster)')) + '</div>' + bars(w.hr.map((v, i) => ({ v, l: String(i * 2), t: v >= 0.005 ? Math.round(v * 100) + ' %' : '', hl: v === Math.max(...w.hr) && v > 0 })), W, { every: W < 360 ? 2 : 1, allVals: W >= 420, label: TT('Tageszeit') });
  }
  function paintMonate(us, now, w) {
    const el = $('uzMj'); if (!el) return; const W = Math.max(240, w || 300);
    const m0 = month0(now), ms = []; for (let i = 11; i >= 0; i--) ms.push({ t: addMonths(m0, -i), v: 0 });
    const mi = new Map(ms.map((m, i) => [ymKey(m.t), i])), yrs = new Map();
    us.forEach(u => { const i = mi.get(ymKey(u.e)); if (i != null) ms[i].v += u.sec / 60; const y = new Date(u.e).getFullYear(); yrs.set(y, (yrs.get(y) || 0) + u.sec / 60); });
    const cy = new Date(now).getFullYear(), y0 = yrs.size ? Math.min(...yrs.keys()) : cy, ys = []; for (let y = y0; y <= cy; y++) ys.push({ y, v: yrs.get(y) || 0 });
    el.innerHTML = '<div class="uz-bh">' + esc(TT('Je Monat (letzte 12)')) + '</div>' + bars(ms.map((m, i) => ({ v: m.v, l: mName(m.t).slice(0, W < 360 ? 1 : 3), t: m.v > 0 ? fmtH(m.v).replace(' h', '') : '', hl: i === 11 })), W, { allVals: W >= 300, label: TT('Je Monat') })
      + '<div class="uz-bh">' + esc(TT('Je Jahr')) + '</div>' + bars(ys.map(y => ({ v: y.v, l: String(y.y) + (y.y === cy ? '*' : ''), t: y.v > 0 ? fmtH(y.v) : '', hl: y.y === cy })), W, { allVals: true, label: TT('Je Jahr') })
      + '<p class="caption uz-note">' + esc(TT('Werte in Stunden; * = laufendes Jahr bis heute.')) + '</p>';
  }

  /* ---------- Kalender-Raster ---------- */
  function paintKal(us, now, w) {
    const el = $('uzKl'); if (!el) return;
    const cy = new Date(now).getFullYear(), y0 = us.length ? new Date(us[0].e).getFullYear() : cy;
    if (!st.yr || st.yr > cy || st.yr < y0) st.yr = cy;
    const Y = st.yr, dm = new Map(); let ysum = 0;
    us.forEach(u => { if (new Date(u.e).getFullYear() === Y) { const k = dayKey(u.e); dm.set(k, (dm.get(k) || 0) + u.sec / 60); ysum += u.sec / 60; } });
    const W = Math.max(260, w || 600), a = new Date(Y, 0, 1).getTime(), lastD = new Date(Y, 11, 31).getTime();
    const wk0 = week0(a), weeks = Math.round((week0(lastD) - wk0) / (7 * 864e5)) + 1;
    const halves = W < 640 ? 2 : 1, cols = Math.ceil(weeks / halves), LW = 22, cell = Math.min(18, Math.floor((W - LW) / cols)), gap = Math.max(1, Math.round(cell / 7)), sz = cell - gap;
    const lvl = m => m <= 0 ? 0 : m <= 30 ? 1 : m <= 60 ? 2 : m <= 120 ? 3 : 4, bh = 7 * cell + 16;
    let out = '', days = 0;
    const wn = WDN(), MN = Array.from({ length: 12 }, (_, i) => mName(new Date(2024, i, 1).getTime())), p2 = n => (n < 10 ? '0' : '') + n;
    for (let h = 0; h < halves; h++) {
      const oy = h * (bh + 8);
      [0, 2, 4].forEach(r => { out += '<text class="uz-ax" x="0" y="' + (oy + 16 + r * cell + sz - 1) + '">' + esc(wn[r]) + '</text>'; });
      let lastM = -1;
      // ein Datum-Objekt weiterzählen, Wochen-Index aus der Tagesnummer (schnell: 365 Felder ohne Intl je Tag)
      const dd = new Date(Y, 0, 1), off = (dd.getDay() + 6) % 7, rx = Math.max(1, sz / 5).toFixed(1), noP = esc(TT('nicht geübt'));
      for (let i = 0; dd.getFullYear() === Y; i++, dd.setDate(dd.getDate() + 1)) {
        const wi = Math.floor((i + off) / 7); if (Math.floor(wi / cols) !== h) continue;
        const c = wi % cols, r = (i + off) % 7, mo = dd.getMonth(), dn = dd.getDate(), m = dm.get(Y * 10000 + (mo + 1) * 100 + dn) || 0, x = LW + c * cell, y = oy + 16 + r * cell;
        if (m > 0) days++;
        if (mo !== lastM && (dn <= 7 && r === 0 || i === 0)) { out += '<text class="uz-ax" x="' + x + '" y="' + (oy + 11) + '">' + esc(MN[mo]) + '</text>'; lastM = mo; }
        out += '<rect class="uz-c l' + lvl(m) + (dd.getTime() > now ? ' fut' : '') + '" x="' + x + '" y="' + y + '" width="' + sz + '" height="' + sz + '" rx="' + rx + '"><title>' + p2(dn) + '.' + p2(mo + 1) + '.' + Y + ': ' + (m ? fmtHM(m * 60) : noP) + '</title></rect>';
      }
    }
    const H = halves * (bh + 8);
    el.innerHTML = '<div class="uz-kh"><button type="button" class="toggle-btn" data-ky="-1" aria-label="' + esc(TT('Jahr zurück')) + '"' + (Y <= y0 ? ' disabled' : '') + '>‹</button><b class="uz-ky" id="uzKY">' + Y + '</b>'
      + '<button type="button" class="toggle-btn" data-ky="1" aria-label="' + esc(TT('Jahr vor')) + '"' + (Y >= cy ? ' disabled' : '') + '>›</button>'
      + '<span class="caption" id="uzKSum">' + days + ' ' + TT(days === 1 ? 'Übetag' : 'Übetage') + ' · ' + esc(fmtHM(ysum * 60)) + '</span></div>'
      + '<svg class="uz-svg" width="' + (LW + cols * cell) + '" height="' + H + '" viewBox="0 0 ' + (LW + cols * cell) + ' ' + H + '" role="img" aria-label="' + esc(TT('Kalender') + ' ' + Y) + '">' + out + '</svg>'
      + '<div class="uz-leg caption">' + esc(TT('weniger')) + ' ' + [0, 1, 2, 3, 4].map(l => '<i class="uz-c l' + l + '"></i>').join('') + ' ' + esc(TT('mehr')) + '<span class="uz-legx">' + esc(TT('bis 30 min · 1 h · 2 h · mehr')) + '</span></div>';
  }

  /* ---------- Woran geübt ---------- */
  function paintThemen(us, now) {
    const el = $('uzTh'); if (!el) return;
    const { a, end } = rangeA(us, now, st.tr), m = new Map(); let tot = 0;
    us.forEach(u => { if (u.e >= a && u.e < end) { m.set(u.t, (m.get(u.t) || 0) + u.sec); tot += u.sec; } });
    const t = U().topics(), rows = [...m.entries()].sort((x, y) => y[1] - x[1]), mx = rows.length ? rows[0][1] : 1;
    el.innerHTML = seg('tr', ['1M', '3M', '1J', 'all'], st.tr)
      + (rows.length ? '<div class="uz-tl">' + rows.map(([id, v]) => '<button type="button" class="uz-trow' + (st.th === id ? ' on' : '') + '" data-tth="' + esc(id) + '" title="' + esc(TT('Verlauf für dieses Thema zeigen')) + '"><span class="uz-tn">' + esc(U().tname(id, t)) + '</span>'
        + '<span class="uz-tb"><i style="width:' + (v / mx * 100).toFixed(1) + '%"></i></span><span class="uz-tv">' + esc(fmtHM(v)) + ' · ' + Math.round(v / tot * 100) + ' %</span></button>').join('') + '</div>'
        + '<p class="caption uz-note">' + esc(TT('Thema antippen: der Verlauf oben zeigt nur dieses Thema (nochmal antippen = alle). Importierte Numbers-Einheiten stehen unter „ohne Thema“.')) + '</p>'
        : '<p class="pattern-desc uz-empty">' + esc(TT('In diesem Zeitraum ist nichts eingetragen.')) + '</p>');
  }

  /* ---------- Zeichnen ---------- */
  let wired = false, last = null;
  function wire() {
    if (wired) return; const root = $('uzRoot'); if (!root) return; wired = true;
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
      const ds = b.dataset; let hit = true;
      if (ds.vr) st.r = ds.vr; else if (ds.vm) st.m = ds.vm; else if (ds.ar) st.ar = ds.ar; else if (ds.tr) st.tr = ds.tr;
      else if (ds.ky) st.yr = (st.yr || new Date().getFullYear()) + (+ds.ky);
      else if (ds.tth != null) st.th = st.th === ds.tth ? '*' : ds.tth;
      else hit = false;
      if (hit) { save(); paint(); }
    });
    root.addEventListener('change', e => { if (e.target.id === 'uzVTh') { st.th = e.target.value; save(); paint(); } });
    let raf = 0, w0 = 0;
    window.addEventListener('resize', () => {
      const p = $('panel-uebezeit'); if (!p || p.hidden || raf) return;
      raf = requestAnimationFrame(() => { raf = 0; const w = root.clientWidth; if (w !== w0) { w0 = w; paint(); } });
    });
  }
  function paint(d) {
    if (!$('uzSums')) return null;
    d = d || U().load(); wire();
    const t0 = performance.now(), now = Date.now(), us = prep(d);
    // erst alle Breiten lesen, dann schreiben (sonst rechnet der Browser nach jedem Abschnitt das Layout neu)
    const mn = minDev(), cw = id => { const e = $(id); return e ? e.clientWidth : 0; };
    const ws = mn ? null : { vl: cw('uzVl'), wn: cw('uzWn'), mj: cw('uzMj'), kl: cw('uzKl') };
    const k = paintKpi(us, now);
    if (!mn) { paintVerlauf(us, now, ws.vl); paintWann(us, now, ws.wn); paintMonate(us, now, ws.mj); paintKal(us, now, ws.kl); paintThemen(us, now); }
    last = performance.now() - t0;
    return k;
  }
  return { paint, kpi: (d, now) => kpi(prep(d || U().load()), now || Date.now()), ms: () => last, state: () => Object.assign({}, st), _wann: (now) => wann(prep(U().load()), now || Date.now()) };
})();
