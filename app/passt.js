// ---- „Was passt“-Box im Looper: kompakt unter der Spur, die gerade aufnimmt (sonst unter der nächsten freien) ----
// Sichtbar nur, solange ein Loop mit erkannten Akkorden läuft. Zugeklappt: eine Zeile (Akkord + beste Tonleiter),
// aufgeklappt: Töne der Tonleiter, Pentatonik und Zielton für den nächsten Akkord. Antippen von „›“ öffnet die Improvisation.
(function () {
  const $ = id => document.getElementById(id);
  const host = document.querySelector('#panel-looper .tracks');
  if (!host || typeof Looper === 'undefined' || !Looper.chordInfo) return;
  const KEY = '3nps-passt-auf';
  let open = true; try { open = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  const box = document.createElement('div');
  box.className = 'passt'; box.id = 'passtBox'; box.hidden = true;
  box.innerHTML = '<div class="passt-h" role="button" tabindex="0" aria-expanded="true" id="passtHead">'
    + '<span class="passt-l">Was passt</span><b class="passt-ch" id="passtCh"></b><span class="passt-r" id="passtRom"></span>'
    + '<span class="passt-sc" id="passtSc"></span><span class="passt-tg" aria-hidden="true">▾</span>'
    + '<button class="passt-go" id="passtGo" title="In der Improvisation öffnen" aria-label="In der Improvisation öffnen">›</button></div>'
    + '<div class="passt-b" id="passtBody"><div class="passt-notes" id="passtNotes"></div><div class="passt-x" id="passtX"></div></div>';
  host.appendChild(box);
  function setOpen(v) {
    open = v; try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
    box.classList.toggle('zu', !open); $('passtHead').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  setOpen(open);
  $('passtHead').addEventListener('click', e => { if (e.target.closest('#passtGo')) return; setOpen(!open); });
  $('passtHead').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } });
  $('passtGo').addEventListener('click', () => { const t = $('tab-solo'); if (t) t.click(); });

  const panel = $('panel-looper');
  let sig = '', col = -1;
  function nextName(ci, i) {
    const n = ci.segs.length, cur = ci.segs[i].name;
    for (let k = 1; k < n; k++) { const q = ci.segs[(i + k) % n].name; if (q !== '–' && q !== cur) return q; }
    return '';
  }
  function tick() {
    if (panel.hidden || document.hidden || !window.SoloFinder || !SoloFinder.quick) return;
    const ci = Looper.chordInfo(null);
    let show = !!(ci && ci.segs && ci.playing && ci.pos != null);
    let i = -1;
    if (show) { for (let q = 0; q < ci.segs.length; q++) if (ci.pos >= ci.segs[q].a && ci.pos < ci.segs[q].e) { i = q; break; } }
    if (show && (i < 0 || ci.segs[i].name === '–')) show = false;
    if (!show) { if (!box.hidden) { box.hidden = true; sig = ''; } return; }
    const ft = Looper.focusTrack ? Looper.focusTrack() : { i: 0, rec: false };
    if (ft.i !== col) { col = ft.i; box.style.setProperty('--passt-col', String(col + 1)); }
    box.classList.toggle('rec', !!ft.rec);
    const k = ci.key || { pc: 0, major: true }, name = ci.segs[i].name, nx = nextName(ci, i);
    const s = name + '|' + nx + '|' + k.pc + k.major;
    box.hidden = false;
    if (s === sig) return;
    sig = s;
    const q = SoloFinder.quick(name, k); if (!q || !q.best) { box.hidden = true; return; }
    const b = q.best;
    $('passtCh').textContent = q.chord;
    $('passtRom').textContent = q.roman;
    $('passtSc').textContent = q.nn(b.root) + ' ' + q.scaleName(b.id);
    $('passtNotes').innerHTML = b.iv.map(x => {
      const p = (b.root + x) % 12, cls = [p === q.c.r ? 'root' : '', q.ct.includes(p) ? 'ct' : '', p === b.ch ? 'char' : '', b.outside.includes(p) ? 'out' : ''].join(' ');
      return '<span class="passt-n ' + cls + '">' + q.nn(p) + '</span>';
    }).join('');
    let x = '';
    if (q.pent) x += '<span><i>Pentatonik</i> ' + q.pent.iv.map(v => q.nn(q.pent.root + v)).join(' ') + '</span>';
    if (nx) {
      const n2 = SoloFinder.parseChord(nx);
      if (n2) { const third = n2.iv.includes(4) ? 4 : n2.iv.includes(3) ? 3 : 7, q2 = SoloFinder.quick(nx, k); x += '<span><i>→ ' + (q2 ? q2.chord : nx) + '</i> Ziel <b>' + q.nn(n2.r + third) + '</b></span>'; }
    }
    $('passtX').innerHTML = x;
  }
  setInterval(tick, 120);
  window.PasstBox = { tick, state: () => ({ hidden: box.hidden, open, col, chord: $('passtCh').textContent, scale: $('passtSc').textContent }) };
})();
