// v136: Bereich „Lernen“ – Übersicht mit Kacheln (Icon, Kurzbeschreibung, Fortschrittsring aus vorhandenen Daten).
// Wird erst beim Öffnen gebaut (tabchange „lernen“); liest nur vorhandene Speicher, schreibt nichts Neues außer über AppNav.
// v137: „Heute üben“ (10-Minuten-Plan, „▶ Los“ mit Timer, Tages-Serie), „Weiter, wo du warst“, Kacheln Hör-Training + Spickzettel.
// Neuer Schlüssel localStorage „3nps-lernen“ { serie, last, where: { t, sec, k, s, ub, m } }.
(function () {
  const $ = id => document.getElementById(id), panel = $('panel-lernen'); if (!panel) return;
  const TT = x => (typeof T === 'function' ? T(x) : x);
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const TILES = [
    { t: 'power', ic: '🎸', n: 'Powerchords-Kurs', d: '15 Kapitel · Werkstatt · Hör-Training · Begleit-Tracks' },
    { t: 'caged', ic: '◈', n: 'CAGED', d: '5 Griffformen über das ganze Griffbrett' },
    { t: 'quinten', ic: '◎', n: 'Quintenzirkel', d: 'Tonarten, Vorzeichen, verwandte Akkorde' },
    { t: 'griffbrett', ic: '▦', n: 'Technik', d: 'Griffbrett, 3nps-Muster, Begleitung, Übungslog' },
    { t: 'ueben', ic: '⏱', n: 'Training', d: 'Tagesübung, Gehörbildung, Licks, Solo-Auswertung' },
    { t: 'hoer', ic: '👂', n: 'Hör-Training', d: 'Intervalle, Akkorde, Tonleitern mit Ampel' },
    { t: 'spick', ic: '📋', n: 'Spickzettel', d: 'Intervalle, Griffformen, Quintenzirkel, Akkordsymbole' }
  ];
  const NAME = {}; TILES.forEach(x => { NAME[x.t] = x.n; });
  let L = jget('3nps-lernen', {}) || {}; L.where = L.where || null;
  const lsave = () => { try { localStorage.setItem('3nps-lernen', JSON.stringify(L)); } catch (e) {} };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const yesterday = () => ymd(new Date(Date.now() - 864e5));
  const serie = () => (L.last === today() || L.last === yesterday()) ? (L.serie || 0) : 0;
  function ring(p) { const c = 2 * Math.PI * 16; return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" class="ln-rbg"/>' + (p > 0 ? '<circle cx="20" cy="20" r="16" class="ln-rfg" stroke-dasharray="' + (c * Math.min(1, p)).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 20 20)"/>' : '') + '</svg>'; }
  // Fortschritt je Kachel: { p: 0…1, txt }
  function prog(t) {
    if (t === 'power') {
      const k = (jget('powerchords.progress.v1', {}) || {}).kurs || {}, tot = window.PcKurs && PcKurs.total ? PcKurs.total() : 0;
      const d = Object.keys(k).filter(x => k[x] === true).length;
      return tot ? { p: d / tot, txt: d + ' / ' + tot + ' ' + TT('Übungen') } : { p: 0, txt: '' };
    }
    if (t === 'ueben') {
      const d = jget('3nps-uebung', null), n = d && d.date === today() ? Object.keys(d.done || {}).length : 0;
      return { p: n / 4, txt: n + ' / 4 ' + TT('Blöcke heute') };
    }
    if (t === 'griffbrett') return { p: 0, txt: '', async: true };
    if (t === 'hoer') {
      const h = jget('3nps-hoer', {}) || {}; let ok = 0, n = 0;
      ['iv', 'ch', 'sc'].forEach(m => Object.values(h[m] || {}).forEach(c => { ok += c[0]; n += c[1]; }));
      return { p: n ? ok / n : 0, txt: n ? Math.round(ok / n * 100) + ' % ' + TT('Treffer') + ' (' + n + ')' : TT('noch nicht geübt') };
    }
    if (t === 'spick') return { p: 0, txt: TT('zum Nachschlagen') };
    return { p: 0, txt: TT('frei üben') };
  }
  function tile(T0, lastT) {
    const g = prog(T0.t);
    return '<button class="ln-tile' + (T0.t === lastT ? ' last' : '') + '" data-t="' + T0.t + '"><span class="ln-top"><span class="ln-ic" aria-hidden="true">' + T0.ic + '</span><span class="ln-ring">' + ring(g.p) + '</span></span>' +
      '<span class="ln-n">' + T0.n + '</span><span class="ln-d">' + T0.d + '</span><span class="ln-p">' + g.txt + '</span>' +
      (T0.t === lastT ? '<span class="ln-last">● ' + (L.where && L.where.t === T0.t && whereDetail() ? TT('Zuletzt') + ': ' + whereDetail() : TT('Zuletzt geöffnet')) + '</span>' : '') + '</button>';
  }
  // Technik: Übungsminuten der letzten 7 Tage aus dem Übungslog (Ziel 60 Min)
  async function technik() {
    const el = panel.querySelector('.ln-tile[data-t="griffbrett"]'); if (!el || typeof AppDB === 'undefined') return;
    try {
      const since = Date.now() - 7 * 864e5, all = await AppDB.all('sessions');
      const min = Math.round(all.filter(s => s.ts >= since).reduce((a, s) => a + (s.durationSec || 0), 0) / 60);
      el.querySelector('.ln-ring').innerHTML = ring(min / 60); el.querySelector('.ln-p').textContent = min + ' ' + TT('Min in 7 Tagen');
    } catch (e) {}
  }
  // ---- „Weiter, wo du warst“: Stelle merken (nur zuhören, fremde Module bleiben unverändert) ----
  const SECN = { theorie: 'Theorie', schritte: 'Schritt für Schritt', brett: 'Griffbrett', folgen: 'Akkordfolgen', uebungen: 'Übungen', kurs: 'Kurs' };
  const UBN = { tag: 'Tagesübung', ohr: 'Gehörbildung', lick: 'Licks', solo: 'Solo-Auswertung' };
  const HMN = { iv: 'Intervalle', ch: 'Akkorde', sc: 'Tonleitern' };
  function whereDetail() {
    const w = L.where; if (!w) return '';
    if (w.t === 'power' && w.k) return TT('Kap.') + ' ' + w.k + (w.s != null ? ' · ' + TT('Schritt') + ' ' + (w.s + 1) : '');
    if (w.t === 'power' && w.sec) return TT(SECN[w.sec] || w.sec);
    if (w.t === 'ueben' && w.ub) return TT(UBN[w.ub] || w.ub);
    if (w.t === 'hoer' && w.m) return TT(HMN[w.m] || '');
    return '';
  }
  function setWhere(w) { L.where = w; lsave(); }
  document.addEventListener('tabchange', e => { const n = e.detail; if (window.AppNav && AppNav.area(n) === 'lernen' && n !== 'lernen' && (!L.where || L.where.t !== n)) setWhere({ t: n }); });
  document.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details.pc-kc') && d.open) setWhere({ t: 'power', sec: 'kurs', k: +d.dataset.kc + 1 }); }, true);
  document.addEventListener('click', e => {
    const st = e.target.closest && e.target.closest('#pcSecKurs .pc-kstep'); if (st) { setWhere({ t: 'power', sec: 'kurs', k: +st.dataset.c + 1, s: +st.dataset.s }); return; }
    const sb = e.target.closest && e.target.closest('#pcSubs button'); if (sb) { const v = sb.dataset.sec || sb.dataset.v; if (v !== 'kurs' || !(L.where && L.where.t === 'power' && L.where.k)) setWhere({ t: 'power', sec: v }); return; }
    const ub = e.target.closest && e.target.closest('#ubNav button'); if (ub && ub.dataset.s) setWhere({ t: 'ueben', ub: ub.dataset.s });
  }, true);
  document.addEventListener('lernenwo', e => setWhere(e.detail));
  function resume(w) {
    w = w || L.where; if (!w || !window.AppNav) return;
    AppNav.show(w.t);
    if (w.t === 'power' && window.Powerchords) setTimeout(() => {
      Powerchords.showSec(w.sec || 'kurs');
      if (w.k && window.PcKurs) { PcKurs.open(w.k, w.s != null);
        if (w.s != null) setTimeout(() => { const S0 = PcKurs.K[w.k - 1] && PcKurs.K[w.k - 1].s[w.s], el = S0 && document.getElementById('pcK_' + S0.id); if (!el) return;
          const bar = document.querySelector('.control-bar'), off = bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().height : 0;   // nicht unter die feste Kopfleiste
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off - 12, behavior: 'instant' }); }, 600); }
    }, 30);
    if (w.t === 'ueben' && w.ub && window.Ueben) Ueben.showSec(w.ub);
    if (w.t === 'hoer' && w.m && window.Hoer) Hoer.setMode(w.m);
  }
  // ---- Heute üben: 3 Min Technik · 4 Min aktuelles Kurs-Kapitel · 3 Min Hör-Training ----
  function kursKap() {
    if (L.where && L.where.t === 'power' && L.where.k) return L.where.k;
    const k = (jget('powerchords.progress.v1', {}) || {}).kurs || {};
    if (window.PcKurs) for (let ci = 0; ci < PcKurs.K.length; ci++) { const ids = []; PcKurs.K[ci].s.forEach(S0 => S0.ex.forEach((x, xi) => ids.push(S0.id + '-' + xi))); if (ids.some(id => k[id] !== true)) return ci + 1; }
    return 1;
  }
  function plan() { const k = kursKap(); return [{ t: 'griffbrett', min: 3, n: TT('Technik') }, { t: 'power', min: 4, n: TT('Kurs Kap.') + ' ' + k, w: { t: 'power', sec: 'kurs', k } }, { t: 'hoer', min: 3, n: TT('Hör-Training') }]; }
  let R = null;
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function runBar() {
    let b = $('lnRun'); if (!b) { b = document.createElement('div'); b.id = 'lnRun'; b.className = 'ln-run'; b.setAttribute('role', 'status'); document.body.appendChild(b);
      b.addEventListener('click', e => { const x = e.target.closest('[data-run]'); if (!x || !R) return; const v = x.dataset.run;
        if (v === 'pause') { R.pause = !R.pause; if (!R.pause) R.end = Date.now() + R.left * 1000; paintRun(); } else if (v === 'next') step(R.i + 1); else if (v === 'stop') stopRun(); }); }
    return b;
  }
  function paintRun() {
    const b = runBar(), st = R.p[R.i];
    b.innerHTML = '<span class="ln-rs"><small>' + TT('Heute üben') + ' · ' + (R.i + 1) + '/' + R.p.length + '</small><b>' + st.n + '</b></span><span class="ln-rt" id="lnRunT">' + fmt(R.left) + '</span>' +
      '<button class="toggle-btn" data-run="pause" aria-label="' + (R.pause ? TT('Weiter') : TT('Pause')) + '">' + (R.pause ? '▶' : '⏸') + '</button><button class="toggle-btn active" data-run="next">' + (R.i + 1 < R.p.length ? TT('Weiter ▸') : TT('Fertig ✓')) + '</button><button class="toggle-btn" data-run="stop" aria-label="' + TT('Abbrechen') + '">✕</button>';
  }
  function step(i) {
    if (!R) return; if (i >= R.p.length) { finish(); return; }
    R.i = i; R.left = R.p[i].min * 60; R.end = Date.now() + R.left * 1000; R.pause = false;
    if (i > 0 && window.Quinten) Quinten.playNote(84);
    paintRun(); const st = R.p[i]; if (st.w) resume(st.w); else if (window.AppNav) AppNav.show(st.t);
  }
  function tick() {
    if (!R || R.pause) return; const left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000));
    if (left !== R.left) { R.left = left; const t = $('lnRunT'); if (t) t.textContent = fmt(left); }
    if (left <= 0) step(R.i + 1);
  }
  function start() { if (R) return; R = { p: plan(), i: 0 }; R.iv = setInterval(tick, 250); step(0); }
  function stopRun() { if (!R) return; clearInterval(R.iv); R = null; const b = $('lnRun'); if (b) b.remove(); if (!panel.hidden) today0(); }
  function finish() {
    const d = today(); if (L.last !== d) { L.serie = L.last === yesterday() ? (L.serie || 0) + 1 : 1; L.last = d; lsave(); }
    clearInterval(R.iv); R.iv = null; if (window.Quinten) { Quinten.playNote(84); setTimeout(() => Quinten.playNote(88), 180); }
    const b = runBar(); b.innerHTML = '<span class="ln-rs"><small>' + TT('Heute üben') + '</small><b>' + TT('Geschafft!') + ' ' + TT('Serie') + ': ' + serie() + ' ' + TT(serie() === 1 ? 'Tag' : 'Tage') + '</b></span><button class="toggle-btn" data-run="stop">✕</button>';
    setTimeout(() => { if (R && !R.iv) stopRun(); }, 5000);
  }
  function today0() {
    const p = plan(), sr = serie(), w = L.where && NAME[L.where.t] ? L.where : null;
    $('lnToday').innerHTML = '<span class="ln-tt"><b>' + TT('Heute üben') + ' · 10 Min</b><span class="caption">' + p.map(x => x.min + ' Min ' + x.n).join(' · ') + '</span></span>' +
      '<span class="ln-acts"><button class="toggle-btn active" id="lnGo">' + TT('▶ Los') + '</button>' +
      (w ? '<button class="toggle-btn" id="lnResume">' + TT('↩ Weiter:') + ' ' + TT(NAME[w.t]) + (whereDetail() ? ' · ' + whereDetail() : '') + '</button>' : '') + '</span>' +
      '<span class="ln-serie">' + TT('Serie') + ': ' + sr + ' ' + TT(sr === 1 ? 'Tag' : 'Tage') + (L.last === today() ? ' ✓' : '') + '</span>';
  }
  function build() {
    const N = window.AppNav ? AppNav.last() : {};
    today0();
    $('lnTiles').innerHTML = TILES.map(x => tile(x, N.tile)).join('');
    technik();
  }
  panel.addEventListener('click', e => {
    const t = e.target.closest('.ln-tile'); if (t && window.AppNav) { AppNav.show(t.dataset.t); return; }
    if (e.target.closest('#lnGo')) { start(); return; }
    if (e.target.closest('#lnResume')) resume();
  });
  document.addEventListener('tabchange', e => { if (e.detail === 'lernen') build(); });
  if (!panel.hidden) build();
  window.Lernen = { build, prog, plan, start, stop: stopRun, _shift: s => { if (R && R.end) R.end -= s * 1000; }, step: i => step(i), run: () => R && { i: R.i, left: R.left, pause: !!R.pause, n: R.p.length }, where: () => L.where && Object.assign({}, L.where), resume, serie, _L: () => JSON.parse(JSON.stringify(L)) };
})();
