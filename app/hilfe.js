// v113: Reiter „Anleitung“ – Inhalt aus hilfe-daten.js, erst beim Öffnen gebaut; Suche nach Begriffen (auch ohne Umlaute/Groß-Klein)
(function () {
  const $ = id => document.getElementById(id), panel = $('panel-hilfe'); if (!panel || typeof HILFE === 'undefined') return;
  const TT = x => (typeof T === 'function' ? T(x) : x);
  const fold = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[„“"'.,:;!?()…·→↗↩]/g, ' ');
  const strip = h => String(h).replace(/<[^>]+>/g, '');
  const all = []; HILFE.forEach(g => g.items.forEach(it => { it.g = g.g; it.txt = strip([it.t].concat(it.p || [], it.s || [], it.tip || []).join(' ')); it.idx = fold(it.t + ' ' + it.k + ' ' + it.txt); it.tf = fold(it.t + ' ' + it.k); all.push(it); }));
  let built = false;
  function build() {
    if (built) return; built = true;
    $('hlToc').innerHTML = HILFE.map(g => '<h4>' + g.g + '</h4>' + g.items.map(it => '<a href="#hl-' + it.id + '" data-id="' + it.id + '">' + it.t + '</a>').join('')).join('');
    $('hlMain').innerHTML = HILFE.map(g => '<div class="hl-group">' + g.g + '</div>' + g.items.map(it =>
      '<article class="card hl-topic" id="hl-' + it.id + '"><h3>' + it.t + '</h3>' +
      (it.p ? it.p.map(x => '<p>' + x + '</p>').join('') : '') +
      (it.img ? '<img class="hl-img" loading="lazy" decoding="async" src="hilfe/' + it.img + '.jpg" alt="Bild: ' + it.t + '">' : '') +
      (it.s ? '<h5>Schritt für Schritt</h5><ol>' + it.s.map(x => '<li>' + x + '</li>').join('') + '</ol>' : '') +
      (it.tip ? '<h5>Gut zu wissen</h5><ul class="tip">' + it.tip.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '') + '</article>').join('')).join('');
    $('hlCount').textContent = all.length + TT(' Themen');
    $('hlEn').hidden = window.__lang !== 'en';
  }
  function go(id) {
    build(); const el = $('hl-' + id); if (!el) return;
    const bar = document.querySelector('.control-bar'), off = bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().height : 0;   // feste Kopfleiste nicht über die Überschrift legen
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off - 12, behavior: 'smooth' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600);
    panel.querySelectorAll('.hl-toc a').forEach(a => a.classList.toggle('on', a.dataset.id === id));
    try { localStorage.setItem('3nps-hilfe-last', id); } catch (e) {}
  }
  // Suche: alle Wörter müssen vorkommen; Treffer im Titel/Stichwort zählen mehr
  function search(q) {
    const w = fold(q).split(/\s+/).filter(x => x.length > 1); if (!w.length) return [];
    return all.map(it => { let sc = 0; for (const x of w) { if (!it.idx.includes(x)) return null; sc += it.tf.includes(x) ? 10 : 1; if (fold(it.t).includes(x)) sc += 10; } return { it, sc }; }).filter(Boolean).sort((a, b) => b.sc - a.sc).map(r => r.it);
  }
  function snippet(it, q) {
    const w = fold(q).split(/\s+/).filter(x => x.length > 1), f = fold(it.txt); let i = -1; for (const x of w) { i = f.indexOf(x); if (i >= 0) break; }
    const a = Math.max(0, i - 40), s = (a ? '… ' : '') + it.txt.slice(a, a + 130) + (a + 130 < it.txt.length ? ' …' : '');
    return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function showRes() {
    const q = $('hlQ').value.trim(), box = $('hlRes'); $('hlX').hidden = !q;
    if (!q) { box.hidden = true; return; }
    const r = search(q); box.hidden = false;
    box.innerHTML = r.length ? r.slice(0, 12).map(it => '<button class="hl-hit" data-id="' + it.id + '"><b translate="no">' + it.t + '</b><small translate="no">' + it.g + ' · ' + snippet(it, q) + '</small></button>').join('') : '<p class="hl-none">' + TT('Nichts gefunden. Andere Wörter probieren, z. B. „Aufnahme“, „Takt“, „Export“.') + '</p>';
  }
  $('hlQ').addEventListener('input', showRes);
  $('hlQ').addEventListener('keydown', e => { if (e.key === 'Enter') { const r = search($('hlQ').value); if (r.length) { go(r[0].id); $('hlQ').blur(); } } });
  $('hlX').addEventListener('click', () => { $('hlQ').value = ''; showRes(); });
  $('hlRes').addEventListener('click', e => { const b = e.target.closest('.hl-hit'); if (b) go(b.dataset.id); });
  $('hlToc').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); go(a.dataset.id); });
  $('hlMain').addEventListener('click', e => { const im = e.target.closest('.hl-img'); if (im) im.classList.toggle('big'); });
  document.addEventListener('tabchange', e => { if (e.detail === 'hilfe') build(); });
  if (!panel.hidden) build();
  window.Hilfe = { go, search, build, count: () => all.length };
})();
