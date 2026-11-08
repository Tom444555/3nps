// v136: Bereich „Lernen“ – Übersicht mit Kacheln (Icon, Kurzbeschreibung, Fortschrittsring aus vorhandenen Daten).
// Wird erst beim Öffnen gebaut (tabchange „lernen“); liest nur vorhandene Speicher, schreibt nichts Neues außer über AppNav.
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
    { t: 'ueben', ic: '⏱', n: 'Training', d: 'Tagesübung, Gehörbildung, Licks, Solo-Auswertung' }
  ];
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
    return { p: 0, txt: TT('frei üben') };
  }
  function tile(T0, lastT) {
    const g = prog(T0.t);
    return '<button class="ln-tile' + (T0.t === lastT ? ' last' : '') + '" data-t="' + T0.t + '"><span class="ln-top"><span class="ln-ic" aria-hidden="true">' + T0.ic + '</span><span class="ln-ring">' + ring(g.p) + '</span></span>' +
      '<span class="ln-n">' + T0.n + '</span><span class="ln-d">' + T0.d + '</span><span class="ln-p">' + g.txt + '</span>' +
      (T0.t === lastT ? '<span class="ln-last">● ' + TT('Zuletzt geöffnet') + '</span>' : '') + '</button>';
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
  function today0() {
    $('lnToday').innerHTML = '<span class="ln-tt"><b>' + TT('Heute üben') + '</b><span class="caption">' + TT('Tagesübung mit Tonart des Tages, Lick und Gehörbildung') + '</span></span>' +
      '<button class="toggle-btn active" id="lnTodayGo">' + TT('▶ Zur Tagesübung') + '</button>';
  }
  function build() {
    const L = window.AppNav ? AppNav.last() : {};
    today0();
    $('lnTiles').innerHTML = TILES.map(x => tile(x, L.tile)).join('');
    technik();
  }
  panel.addEventListener('click', e => {
    const t = e.target.closest('.ln-tile'); if (t && window.AppNav) { AppNav.show(t.dataset.t); return; }
    if (e.target.closest('#lnTodayGo') && window.AppNav) AppNav.show('ueben');
  });
  document.addEventListener('tabchange', e => { if (e.detail === 'lernen') build(); });
  if (!panel.hidden) build();
  window.Lernen = { build, prog };
})();
