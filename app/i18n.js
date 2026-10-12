// Sprache (v59): Deutsch ist der Quelltext. Nur im EN-Modus läuft hier etwas:
// Ein Beobachter übersetzt neue/geänderte Texte im DOM (Text, title, placeholder, aria-label)
// über das Wörterbuch window.__EN (exakt, sonst Bausteine einzeln). Im DE-Modus passiert nichts.
// Schlüssel 3nps-lang ist neu – die stabile v24 kennt ihn nicht und läuft unverändert.
(function () {
  let lang = 'de';
  try {
    const q = /[?&]lang=(de|en)\b/.exec(location.search);
    lang = q ? q[1] : (localStorage.getItem('3nps-lang') || 'de');
  } catch (e) {}
  if (lang !== 'en') lang = 'de';
  window.__lang = lang;
  window.setAppLang = function (l) {
    try { localStorage.setItem('3nps-lang', l === 'en' ? 'en' : 'de'); } catch (e) {}
    const u = location.href.replace(/([?&])lang=(de|en)&?/, '$1').replace(/[?&]$/, '');
    location.replace(u);
  };
  window.T = s => s;
  if (lang !== 'en') return;
  document.documentElement.lang = 'en';

  const L = '[\\p{L}\\d]';
  let RX = null, MAP = null;
  function build() {
    const D = window.__EN || {};
    MAP = new Map();
    Object.keys(D).forEach(k => {
      MAP.set(k, D[k]);
      const t = k.trim();
      if (t && t !== k && !MAP.has(t)) MAP.set(t, D[k].trim());
    });
    const keys = [...MAP.keys()].filter(k => /[\p{L}]{2}/u.test(k)).sort((a, b) => b.length - a.length);
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    RX = new RegExp(keys.map(k => (/^[\p{L}\d]/u.test(k) ? '(?<!' + L + ')' : '') + esc(k) + (/[\p{L}\d]$/u.test(k) ? '(?!' + L + ')' : '')).join('|'), 'gu');
  }
  const cache = new Map(), done = new Set();
  function tr(s) {
    if (!s || !/[\p{L}]{2}/u.test(s) || done.has(s)) return s;
    let r = cache.get(s);
    if (r !== undefined) return r;
    if (!MAP) build();
    if (s.indexOf('\u00a0') >= 0) { r = tr(s.replace(/\u00a0/g, ' ')); cache.set(s, r); return r; }
    r = MAP.get(s);
    if (r === undefined) for (const [rx, rp] of (window.__EN_PAT || [])) if (rx.test(s)) { r = s.replace(rx, rp); break; }
    if (r === undefined) {
      const t = s.trim();
      if (t !== s && MAP.has(t)) r = s.replace(t, MAP.get(t));
      else r = s.replace(RX, m => MAP.get(m));
    }
    for (const [rx, rp] of (window.__EN_POST || [])) r = r.replace(rx, rp);
    r = r.replace(/„/g, '“').replace(/(^|[^\d,.])1 bars\b/g, '$11 bar').replace(/(^|[^\d,.])1 tracks\b/g, '$11 track').replace(/(\d),(\d)/g, '$1.$2');
    if (cache.size > 6000) { cache.clear(); done.clear(); }
    cache.set(s, r); if (r !== s) done.add(r);
    return r;
  }
  window.__tr = tr; window.T = tr;
  const keep = n => n && n.closest && n.closest('[translate="no"]');

  const ATTR = ['title', 'placeholder', 'aria-label'];
  function doEl(el) {
    if (keep(el)) return;
    for (const a of ATTR) { const v = el.getAttribute(a); if (v) { const n = tr(v); if (n !== v) el.setAttribute(a, n); } }
  }
  function doNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentNode; if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || p.isContentEditable || keep(p))) return;
      const v = n.nodeValue, x = tr(v); if (x !== v) n.nodeValue = x;
    } else if (n.nodeType === 1) {
      if (n.nodeName === 'TEXTAREA') { doEl(n); return; }
      if (n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE' || n.isContentEditable || keep(n)) return;
      doEl(n);
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let c; while ((c = w.nextNode())) {
        if (c.nodeType === 1) { if (c.nodeName === 'SCRIPT' || c.nodeName === 'STYLE' || c.translate === false) continue; doEl(c); }
        else if (c.parentNode && c.parentNode.nodeName === 'TEXTAREA') continue;
        else if (c.parentNode && c.parentNode.translate === false) continue;
        else doNode(c);
      }
    }
  }
  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') doNode(m.target);
      else if (m.type === 'attributes') doEl(m.target);
      else m.addedNodes.forEach(doNode);
    }
  });
  function start() {
    doNode(document.body);
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('DOMContentLoaded', () => { document.title = tr(document.title); });
  // Dialoge des Browsers
  const oc = window.confirm, oa = window.alert, op = window.prompt;
  window.confirm = m => oc.call(window, tr(String(m)));
  window.alert = m => oa.call(window, tr(String(m)));
  window.prompt = (m, d) => op.call(window, tr(String(m)), d);
})();
