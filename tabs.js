<script>
(function () {
  // v136: 4 Hauptbereiche (Looper · Lernen · Jammen · Song & Gesang) + Unterleiste mit Chips; Anleitung als „?“-Knopf.
  // Panels/IDs bleiben gleich (panel-…, Chips tragen die alten Knopf-IDs tab-…), Ereignis „tabchange“ wie bisher.
  const $ = id => document.getElementById(id);
  // frühere Reiter (Begleitung, Song, Log) liegen jetzt im Griffbrett
  const OLD = { begleitung: 'griffbrett', song: 'griffbrett', log: 'griffbrett', anleitung: 'hilfe', powerchords: 'power', backing: 'jam', improvisation: 'solo', songwriting: 'lied', mitsingen: 'singen', training: 'ueben', technik: 'griffbrett', 'hoer-training': 'hoer', spickzettel: 'spick' };
  const AREA = { looper: 'looper', lernen: 'lernen', power: 'lernen', caged: 'lernen', quinten: 'lernen', griffbrett: 'lernen', ueben: 'lernen', hoer: 'lernen', spick: 'lernen', jam: 'jammen', solo: 'jammen', lied: 'gesang', singen: 'gesang' };
  const FIRST = { looper: 'looper', lernen: 'lernen', jammen: 'jam', gesang: 'lied' };
  // Anleitung passend zum Bereich/Unterpunkt
  const HELP = { looper: 'aufnehmen', lernen: 'bereiche', power: 'powerchord-kurs', caged: 'caged', quinten: 'quinten', griffbrett: 'technik', ueben: 'training', hoer: 'hoer-training', spick: 'spickzettel', jam: 'backing', solo: 'improvisation', lied: 'songwriting', singen: 'mitsingen' };
  const areaBtns = document.querySelectorAll('.tabs [data-area]'), chips = document.querySelectorAll('#subNav [data-tab]'), sub = $('subNav'), help = $('tab-hilfe');
  const PANELS = ['looper', 'hilfe'].concat([...chips].map(c => c.dataset.tab));
  let last = {}; try { last = JSON.parse(localStorage.getItem('3nps-tab-last') || '{}') || {}; } catch (e) {}
  let cur = null, prev = 'looper';
  const norm = n => { n = OLD[n] || n; if (FIRST[n] && !AREA[n]) n = last[n] || FIRST[n]; return $('panel-' + n) && PANELS.includes(n) ? n : null; };
  function show(name) {
    name = norm(name) || 'looper';
    const area = AREA[name] || null;
    if (name !== 'hilfe') prev = name;
    cur = name;
    areaBtns.forEach(b => b.setAttribute('aria-selected', b.dataset.area === area ? 'true' : 'false'));
    sub.hidden = !area || area === 'looper';
    chips.forEach(c => { const on = c.dataset.tab === name; c.hidden = c.dataset.area !== area; c.classList.toggle('active', on); c.setAttribute('aria-selected', on ? 'true' : 'false'); });
    help.setAttribute('aria-pressed', name === 'hilfe' ? 'true' : 'false');
    PANELS.forEach(p => { const el = $('panel-' + p); if (el) el.hidden = p !== name; });
    if (area && area !== 'looper') { last[area] = name; if (area === 'lernen' && name !== 'lernen') last.tile = name; }
    try { localStorage.setItem('3nps-tab', name); localStorage.setItem('3nps-tab-last', JSON.stringify(last)); } catch (e) {}
    if (!sub.hidden) { const c = sub.querySelector('.active'); if (c) { const l = c.offsetLeft - sub.offsetLeft, r = l + c.offsetWidth; if (l < sub.scrollLeft || r > sub.scrollLeft + sub.clientWidth) sub.scrollLeft = Math.max(0, l - 16); } }   // nur waagerecht, Seite springt nicht
    document.dispatchEvent(new CustomEvent('tabchange', { detail: name }));
  }
  areaBtns.forEach(b => b.addEventListener('click', () => show(b.dataset.area === 'looper' ? 'looper' : (last[b.dataset.area] || FIRST[b.dataset.area]))));
  chips.forEach(c => c.addEventListener('click', () => show(c.dataset.tab)));
  function openHelp(from) {
    from = from || prev; show('hilfe');
    if (window.Hilfe && HELP[from]) Hilfe.go(HELP[from]);
  }
  help.addEventListener('click', () => { if (cur === 'hilfe') show(prev); else openHelp(cur); });
  let start = 'looper';
  const hash = (location.hash || '').slice(1);
  try { start = localStorage.getItem('3nps-tab') || start; } catch (e) {}
  if (norm(hash)) start = hash;
  show(start);
  window.AppNav = { show, openHelp, current: () => cur, area: n => AREA[norm(n) || n] || null, last: () => Object.assign({}, last), AREA, HELP };

  // Status des Metronoms auch in der Tempo-Leiste zeigen
  const src = document.getElementById('statusLine');
  const mirror = document.getElementById('statusMirror');
  const sync = () => { mirror.textContent = src.textContent; };
  new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true });
  sync();
})();
</script>
