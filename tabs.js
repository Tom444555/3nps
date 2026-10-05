<script>
(function () {
  const tabs = document.querySelectorAll('.tab');
  function show(name) {
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      document.getElementById('panel-' + t.dataset.tab).hidden = !on;
    });
    try { localStorage.setItem('3nps-tab', name); } catch (e) {}
    document.dispatchEvent(new CustomEvent('tabchange', { detail: name }));
  }
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
  let start = 'griffbrett';
  const hash = (location.hash || '').slice(1);
  try { start = localStorage.getItem('3nps-tab') || start; } catch (e) {}
  if (document.getElementById('panel-' + hash)) start = hash;
  if (document.getElementById('panel-' + start)) show(start);

  // Status des Metronoms auch in der Tempo-Leiste zeigen
  const src = document.getElementById('statusLine');
  const mirror = document.getElementById('statusMirror');
  const sync = () => { mirror.textContent = src.textContent; };
  new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true });
  sync();
})();
</script>
