/* ---------- v152: Übe-Verlauf als Diagramm (Technik › Übungslog) ----------
   Liest nur die gespeicherten Übungseinheiten (IndexedDB „sessions“: ts, durationSec, bpm – Metronom-Einheiten ab 5 s und
   erledigte Blöcke der Tagesübung). Nichts wird geschätzt: Übezeit = Summe durationSec, Tempo = höchstes BPM je Tag.
   Wird erst beim Öffnen der Karte gebaut, keine Timer; ist sie offen, aktualisiert refreshLog() sie mit. */
window.UebeVerlauf = (() => {
  const TT = s => (typeof T === 'function' ? T(s) : s), $ = id => document.getElementById(id);
  const RANGES = { '1W': 7, '1M': 30, '3M': 91, '1J': 365, 'all': 0 };
  let st = { r: '1M', m: 'zeit' }, built = false, data = null;
  try { const v = JSON.parse(localStorage.getItem('3nps-verlauf') || 'null'); if (v && RANGES[v.r] != null) st.r = v.r; if (v && (v.m === 'zeit' || v.m === 'tempo')) st.m = v.m; } catch (e) {}
  const save = () => { try { localStorage.setItem('3nps-verlauf', JSON.stringify(st)); } catch (e) {} };
  const day0 = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };   // lokal, sommerzeitfest
  const month0 = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };   // v154: „Alles“ über Jahre je Monat
  const week0 = t => { const d = new Date(day0(t)); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
  const fmtN = (v, d) => (Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toFixed(d || 0).replace('.', window.__lang === 'en' ? '.' : ',');
  const fmtMin = m => m >= 120 ? fmtN(m / 60, 1) + ' h' : Math.round(m) + ' min';
  const fmtD = (t, y) => new Date(t).toLocaleDateString(window.__lang === 'en' ? 'en-GB' : 'de-DE', y ? { day: '2-digit', month: '2-digit', year: '2-digit' } : { day: '2-digit', month: '2-digit' });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Zeitraum [a, b) in Tagen; „Alles“ ab dem ersten Eintrag
  function span(es, now) {
    const end = addDays(day0(now), 1), n = RANGES[st.r];
    const first = es.length ? day0(Math.min(...es.map(e => e.ts))) : day0(now);
    const a = n ? addDays(end, -n) : first;
    return { a, b: end, n: n || Math.max(1, Math.round((end - first) / 864e5)), pa: n ? addDays(a, -n) : null };
  }
  function series(es, now) {
    const s = span(es, now), monthly = st.r === 'all' && s.n > 730, weekly = !monthly && (st.r === '3M' || st.r === '1J' || (st.r === 'all' && s.n > 92));
    const key = monthly ? month0 : weekly ? week0 : day0, step = weekly ? 7 : 1, pts = [];
    for (let t = key(s.a); t < s.b; t = monthly ? new Date(new Date(t).getFullYear(), new Date(t).getMonth() + 1, 1).getTime() : addDays(t, step)) pts.push({ t, v: st.m === 'zeit' ? 0 : null });
    const idx = new Map(pts.map((p, i) => [p.t, i]));
    let sum = 0, prev = 0, prevAny = false, last = null, first = null, n = 0;
    es.forEach(e => {
      if (!(e.ts >= 0)) return;
      if (e.ts >= s.a && e.ts < s.b) {
        const i = idx.get(key(e.ts)); if (i == null) return;
        if (st.m === 'zeit') { const m = (+e.durationSec || 0) / 60; pts[i].v += m; sum += m; n++; }
        else if (+e.bpm > 0) { pts[i].v = Math.max(pts[i].v || 0, +e.bpm); n++; }
      } else if (s.pa != null && e.ts >= s.pa && e.ts < s.a) { prevAny = true; if (st.m === 'zeit') prev += (+e.durationSec || 0) / 60; }
    });
    const vals = pts.filter(p => p.v != null && (st.m === 'zeit' || p.v > 0));
    if (st.m === 'tempo' && vals.length) { first = vals[0]; last = vals[vals.length - 1]; }
    return { s, weekly, monthly, pts, vals, sum, prev, prevAny, first, last, n };
  }
  function svg(r) {
    const W = 600, H = 170, P = 6, ps = r.pts, vs = r.vals;
    if (!vs.length) return '';
    const max = Math.max(...vs.map(p => p.v)), min = st.m === 'zeit' ? 0 : Math.min(...vs.map(p => p.v));
    const lo = st.m === 'zeit' ? 0 : Math.max(0, min - Math.max(5, (max - min) * 0.15)), hi = max + Math.max(st.m === 'zeit' ? 1 : 5, (max - lo) * 0.12);
    const x = i => ps.length < 2 ? W / 2 : P + i * (W - 2 * P) / (ps.length - 1), y = v => H - P - (v - lo) / (hi - lo || 1) * (H - 2 * P);
    const pi = new Map(ps.map((p, i) => [p, i]));
    const line = vs.map((p, k) => (k ? 'L' : 'M') + x(pi.get(p)).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
    const area = st.m === 'zeit' ? line + ' L' + x(pi.get(vs[vs.length - 1])).toFixed(1) + ' ' + (H - P) + ' L' + x(pi.get(vs[0])).toFixed(1) + ' ' + (H - P) + ' Z' : '';
    const dot = vs.length === 1 || st.m === 'tempo' ? vs.map(p => '<path d="M' + x(pi.get(p)).toFixed(1) + ' ' + y(p.v).toFixed(1) + 'h0" class="pv-dot" vector-effect="non-scaling-stroke"/>').join('') : '';
    const lp = vs[vs.length - 1];
    return '<svg class="pv-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(TT(st.m === 'zeit' ? 'Übezeit' : 'Tempo')) + '">'
      + '<line x1="0" x2="' + W + '" y1="' + (H - P) + '" y2="' + (H - P) + '" class="pv-base"/>'
      + (area ? '<path d="' + area + '" class="pv-area"/>' : '') + '<path d="' + line + '" class="pv-line" vector-effect="non-scaling-stroke"/>' + dot
      + '<path d="M' + x(pi.get(lp)).toFixed(1) + ' ' + y(lp.v).toFixed(1) + 'h0" class="pv-end" vector-effect="non-scaling-stroke"/></svg>';
  }
  function paint() {
    const body = $('pvBody'); if (!body || !built) return;
    const es = window.Uebezeit ? Uebezeit.merge(data || []) : (data || []), r = series(es, Date.now()), zeit = st.m === 'zeit';
    body.querySelectorAll('[data-pr]').forEach(b => b.classList.toggle('active', b.dataset.pr === st.r));
    body.querySelectorAll('[data-pm]').forEach(b => b.classList.toggle('active', b.dataset.pm === st.m));
    const per = { '1W': TT('7 Tage'), '1M': TT('30 Tage'), '3M': TT('3 Monate'), '1J': TT('12 Monate'), all: TT('seit Beginn') }[st.r];
    let big = '–', chg = '', cls = '', sub = '';
    if (zeit) {
      big = fmtMin(r.sum); sub = TT('Übezeit') + ' · ' + per + (r.monthly ? ' · ' + TT('je Monat') : r.weekly ? ' · ' + TT('je Woche') : ' · ' + TT('je Tag'));
      if (r.s.pa != null) {
        const d = r.sum - r.prev;
        if (!r.prevAny && r.sum > 0) chg = '▲ ' + TT('neu') + ' · ' + TT('vorher nichts eingetragen');
        else if (r.prevAny) { cls = d > 0.5 ? 'up' : d < -0.5 ? 'down' : ''; chg = (d > 0.5 ? '▲ ' : d < -0.5 ? '▼ ' : '± ') + fmtMin(Math.abs(d)) + (r.prev > 0 ? ' (' + (d >= 0 ? '+' : '−') + fmtN(Math.abs(d) / r.prev * 100) + ' %)' : '') + ' · ' + TT('zum Vorzeitraum'); }
      }
    } else if (r.last) {
      big = Math.round(r.last.v) + ' BPM'; sub = TT('höchstes Tempo je Tag') + ' · ' + TT('zuletzt') + ' ' + fmtD(r.last.t);
      const d = r.last.v - r.first.v;
      if (r.vals.length > 1) { cls = d > 0 ? 'up' : d < 0 ? 'down' : ''; chg = (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '± ') + Math.abs(Math.round(d)) + ' BPM · ' + TT('seit') + ' ' + fmtD(r.first.t); }
    }
    const vs = r.vals.filter(p => zeit ? true : p.v > 0);
    const hiP = vs.length ? vs.reduce((a, p) => p.v > a.v ? p : a) : null, loP = vs.length ? vs.reduce((a, p) => p.v < a.v ? p : a) : null;
    const hv = p => p ? (zeit ? fmtMin(p.v) : Math.round(p.v) + ' BPM') + ' · ' + (r.monthly ? TT('Monat') + ' ' + new Date(p.t).toLocaleDateString(window.__lang === 'en' ? 'en-GB' : 'de-DE', { month: '2-digit', year: 'numeric' }) : (r.weekly ? TT('Woche ab') + ' ' : '') + fmtD(p.t)) : '–';
    const empty = !es.length || (zeit ? r.sum <= 0 : !r.last);
    $('pvBig').textContent = empty ? '–' : big; $('pvSub').textContent = sub || per;
    const c = $('pvChg'); c.textContent = empty ? '' : chg; c.className = 'pv-chg ' + cls;
    $('pvHi').textContent = empty ? '–' : hv(hiP); $('pvLo').textContent = empty ? '–' : hv(loP);
    $('pvChart').innerHTML = empty ? '<p class="pattern-desc pv-empty">' + esc(!es.length
      ? TT('Noch keine Übungseinheiten – der Verlauf wächst ab jetzt mit: Metronom im Griffbrett mindestens 5 Sekunden laufen lassen oder Blöcke der Tagesübung erledigen.')
      : TT('In diesem Zeitraum ist nichts eingetragen – anderen Zeitraum wählen.')) + '</p>' : svg(r);
    $('pvAx').innerHTML = empty ? '' : '<span>' + esc(fmtD(r.s.a, st.r === '1J' || st.r === 'all')) + '</span><span>' + esc(TT('heute')) + '</span>';
    $('pvN').textContent = r.n ? r.n + ' ' + TT(r.n === 1 ? 'Einheit' : 'Einheiten') : '';
  }
  function build() {
    const body = $('pvBody'); if (!body || built) return; built = true;
    const rb = Object.keys(RANGES).map(k => '<button type="button" class="toggle-btn" data-pr="' + k + '">' + (k === 'all' ? TT('Alles') : k) + '</button>').join('');
    body.innerHTML = '<div class="pv-top"><div class="pv-head"><div class="pv-big" id="pvBig">–</div><div class="pv-chg" id="pvChg"></div><div class="caption" id="pvSub"></div></div>'
      + '<div class="seg pv-m" role="group" aria-label="' + esc(TT('Wert')) + '"><button type="button" class="toggle-btn" data-pm="zeit">' + esc(TT('Übezeit')) + '</button><button type="button" class="toggle-btn" data-pm="tempo">' + esc(TT('Tempo')) + '</button></div></div>'
      + '<div class="pv-chart" id="pvChart"></div><div class="pv-ax caption" id="pvAx"></div>'
      + '<div class="seg pv-r" role="group" aria-label="' + esc(TT('Zeitraum')) + '">' + rb + '</div>'
      + '<div class="pv-hl"><span><span class="caption">' + esc(TT('Hoch')) + '</span> <b id="pvHi">–</b></span><span><span class="caption">' + esc(TT('Tief')) + '</span> <b id="pvLo">–</b></span><span class="caption" id="pvN"></span></div>'
      + '<p class="caption pv-note">' + esc(TT('Gezählt werden Metronom-Einheiten im Griffbrett (ab 5 s), erledigte Blöcke der Tagesübung und die Übezeit (Schalter „Üben“ und Import) – Looper-Spielen ohne Schalter wird nicht mitgezählt.')) + '</p>'
      + '<button type="button" class="toggle-btn pv-go" id="pvGo">' + esc(TT('Ganze Übersicht')) + ' ›</button>';   // v154: zur Seite „Übezeit“
    body.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'pvGo') { if (window.AppNav) AppNav.show('uebezeit'); return; }
      if (b.dataset.pr) st.r = b.dataset.pr; else if (b.dataset.pm) st.m = b.dataset.pm; else return;
      save(); paint();
    });
  }
  async function load() { try { data = await AppDB.all('sessions'); } catch (e) { data = []; } paint(); }
  const fold = $('pvFold');
  if (fold) fold.addEventListener('toggle', () => { if (fold.open) { build(); load(); } });
  return { update: es => { if (fold && fold.open && built) { data = es; paint(); } }, refresh: () => { if (fold && fold.open && built && data) paint(); }, built: () => built, _state: () => st };
})();
