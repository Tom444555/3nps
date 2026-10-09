// ---- „Was passt“ im Looper: oben in der Looper-Karte über die volle Breite (zwischen Titel und Loop-Länge) ----
// Sichtbar, solange ein Loop mit erkannten Akkorden läuft. Links groß der klingende und der nächste Akkord,
// Mitte die genau passende Tonleiter mit Beschreibung, rechts Pentatonik und der nächste Wechsel.
// „Anhalten“ friert die Anzeige ein (zum Nachlesen); dann lässt sich jeder Akkord des Loops antippen.
(function () {
  const $ = id => document.getElementById(id);
  const card = document.querySelector('#panel-looper .looper-card');
  const top = card && card.querySelector('.looper-top');
  if (!card || !top || typeof Looper === 'undefined' || !Looper.chordInfo) return;
  const KEY = '3nps-passt-auf';
  let open = true; try { open = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  const md = x => ((x % 12) + 12) % 12;
  const box = document.createElement('div');
  box.className = 'passt'; box.id = 'passtBox'; box.hidden = true;
  box.innerHTML =
    '<div class="passt-h">'
    + '<button class="passt-tgl" id="passtHead" aria-expanded="true"><span class="passt-l">Was passt</span><span class="passt-tg" aria-hidden="true">▾</span></button>'
    + '<span class="passt-hs" id="passtHs"></span>'
    + '<div class="passt-pick" id="passtPick" hidden></div>'
    + '<span class="passt-sp"></span>'
    + '<button class="toggle-btn passt-hold" id="passtHold" aria-pressed="false">⏸ Anhalten</button>'
    + '<button class="toggle-btn passt-go" id="passtGo" title="In der Improvisation öffnen">Improvisation ›</button></div>'
    + '<div class="passt-b">'
    +   '<div class="passt-now"><span class="passt-cap" id="passtCap">Klingt jetzt</span>'
    +     '<div class="passt-chr"><b class="passt-ch" id="passtCh"></b><div class="passt-chi"><span class="passt-rom" id="passtRom"></span><span class="passt-ct" id="passtCt"></span></div></div>'
    +     '<span class="passt-nx" id="passtNx"></span></div>'
    +   '<div class="passt-sc"><div class="passt-sch"><b id="passtSc"></b><span class="passt-o" id="passtOut"></span><span class="sf-tag" id="passtTag"></span></div>'
    +     '<div class="passt-notes" id="passtNotes"></div>'
    +     '<div class="passt-dr"><p class="passt-d" id="passtDesc"></p><div class="passt-c" id="passtChar"></div></div></div>'
    +   '<div class="passt-mv" id="passtMv"></div>'
    + '</div>';
  card.insertBefore(box, top);
  const hold = { on: false, i: -1 };
  function setOpen(v) {
    open = v; try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
    box.classList.toggle('zu', !open); $('passtHead').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  setOpen(open);
  $('passtHead').addEventListener('click', () => setOpen(!open));
  $('passtGo').addEventListener('click', () => { const t = $('tab-solo'); if (t) t.click(); });
  $('passtHold').addEventListener('click', () => {
    hold.on = !hold.on; hold.i = hold.on ? lastI : -1;
    const b = $('passtHold'); b.classList.toggle('active', hold.on); b.setAttribute('aria-pressed', hold.on ? 'true' : 'false');
    b.textContent = hold.on ? '▶ Weiter mitlaufen' : '⏸ Anhalten';
    if (hold.on && !open) setOpen(true);
    sig = ''; tick();
  });
  $('passtPick').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    hold.i = +b.dataset.i; sig = ''; tick();
    const q = lastCI && SoloFinder.quick(lastCI.segs[hold.i].name, lastCI.key || { pc: 0, major: true });
    if (q && window.Quinten) Quinten.play(q.c.r, q.c.iv);
  });

  const panel = $('panel-looper');
  let sig = '', lastI = -1, lastCI = null, pickSig = '', shownOnce = false;
  function nextIdx(ci, i) {
    const n = ci.segs.length, cur = ci.segs[i].name;
    for (let k = 1; k < n; k++) { const j = (i + k) % n, q = ci.segs[j].name; if (q !== '–' && q !== cur) return j; }
    return -1;
  }
  function tick() {
    if (panel.hidden || document.hidden || !window.SoloFinder || !SoloFinder.quick) return;
    const ci = Looper.chordInfo(null);
    const live = !!(ci && ci.segs && ci.playing && ci.pos != null);
    let i = -1;
    if (live) { for (let q = 0; q < ci.segs.length; q++) if (ci.pos >= ci.segs[q].a && ci.pos < ci.segs[q].e) { i = q; break; } }
    // Einmal eingeblendet, bleibt die Box stehen, solange eine Spur Akkorde hat – auch bei gestopptem Loop
    // (sonst rutscht beim Start/Stopp jedes Mal die ganze Seite und es ruckelt)
    const has = !!(ci && ci.segs);
    if (!has) { shownOnce = false; if (!box.hidden) { box.hidden = true; sig = ''; } if (hold.on) $('passtHold').click(); return; }
    if (live && i >= 0 && ci.segs[i].name !== '–') shownOnce = true;
    if (!shownOnce && !hold.on) { if (!box.hidden) { box.hidden = true; sig = ''; } return; }
    box.classList.toggle('stop', !live && !hold.on);
    lastCI = ci;
    if (i >= 0 && ci.segs[i].name !== '–') lastI = i;
    let shown = hold.on ? (hold.i >= 0 && hold.i < ci.segs.length ? hold.i : lastI) : i;
    if (shown < 0 || ci.segs[shown].name === '–') shown = ci.segs.findIndex(s => s.name !== '–');
    if (shown < 0) { box.hidden = true; return; }
    box.hidden = false;
    box.classList.toggle('held', hold.on);
    const ft = Looper.focusTrack ? Looper.focusTrack() : { rec: false };
    box.classList.toggle('rec', !!ft.rec);
    const k = ci.key || { pc: 0, major: true };
    // Akkordwahl beim Anhalten
    const ps = hold.on + '|' + ci.segs.map(s => s.name).join(',') + '|' + shown;
    if (ps !== pickSig) {
      pickSig = ps; const pk = $('passtPick'); pk.hidden = !hold.on;
      if (hold.on) {
        const seen = new Set();
        pk.innerHTML = '<span class="passt-l">Akkord wählen</span>' + ci.segs.map((s, j) => {
          if (s.name === '–' || seen.has(s.name)) return ''; seen.add(s.name);
          const q = SoloFinder.quick(s.name, k);
          return '<button class="toggle-btn' + (ci.segs[shown].name === s.name ? ' active' : '') + '" data-i="' + j + '">' + (q ? q.chord : s.name) + '</button>';
        }).join('');
      }
    }
    const nj = nextIdx(ci, shown), name = ci.segs[shown].name, nx = nj >= 0 ? ci.segs[nj].name : '';
    const stopped = !live && !hold.on;
    const s = name + '|' + nx + '|' + k.pc + k.major + '|' + hold.on + '|' + stopped;
    if (s === sig) return;
    sig = s;
    const q = SoloFinder.quick(name, k); if (!q || !q.best) { box.hidden = true; return; }
    const b = q.best;
    $('passtCap').textContent = hold.on ? 'Angehalten' : stopped ? 'Gestoppt' : 'Klingt jetzt';
    $('passtCh').textContent = q.chord;
    $('passtRom').textContent = q.roman + (q.func ? ' · ' + q.func : '');
    $('passtCt').innerHTML = 'Akkordtöne <b>' + q.ct.map(p => q.nn(p)).join(' ') + '</b>';
    $('passtHs').innerHTML = '<b>' + q.chord + '</b> → ' + q.nn(b.root) + ' ' + q.scaleName(b.id) + ' · Tonart ' + q.keyLabel;
    $('passtSc').textContent = q.nn(b.root) + ' ' + q.scaleName(b.id);
    $('passtTag').textContent = b.tag;
    $('passtNotes').innerHTML = b.iv.map(x => {
      const p = md(b.root + x), cls = [p === q.c.r ? 'root' : '', q.ct.includes(p) ? 'ct' : '', p === b.ch ? 'char' : '', b.outside.includes(p) ? 'out' : ''].join(' ');
      return '<span class="passt-n ' + cls + '">' + q.nn(p) + '</span>';
    }).join('');
    // Satz (Klang) mit dem Charakterton daneben; Reibung kurz in der Kopfzeile der Tonleiter
    // der Satz über den Charakterton steht schon im Kästchen daneben → im Text weglassen
    const ivn = b.ch != null ? q.ivLong(b.ch - b.root).replace(/ \/ .*/, '') : '';
    let mood = q.mood(b.id) || b.why;
    if (ivn) { const parts = mood.split(/(?<=\.)\s+/); if (parts.length > 1 && /charakterton|unterschied|färbt|glitzert/i.test(parts[parts.length - 1]) || parts.length > 1 && parts[parts.length - 1].includes(ivn)) mood = parts.slice(0, -1).join(' '); }
    $('passtDesc').textContent = mood;
    $('passtDesc').title = b.why + ' ' + q.mood(b.id);
    $('passtChar').innerHTML = b.ch != null ? '<span class="passt-l">Charakterton</span><b class="y">' + q.nn(b.ch) + '</b><small>' + q.ivLong(b.ch - b.root).replace(/ \/ .*/, '') + '</small>' : '';
    $('passtChar').hidden = b.ch == null;
    $('passtOut').innerHTML = b.outside.length ? 'Reibung <b class="o">' + b.outside.map(p => q.nn(p)).join(', ') + '</b>' : '';
    // rechts: Pentatonik + nächster Wechsel
    let mv = '';
    if (q.pent) mv += '<div class="passt-row"><span class="passt-l">Pentatonik</span><span class="passt-ln"><b>' + q.nn(q.pent.root) + ' ' + q.scaleName(q.pent.id) + '</b> <span class="passt-pn">' + q.pent.iv.map(v => q.nn(q.pent.root + v)).join(' ') + '</span></span></div>';
    if (nx) {
      const n2 = SoloFinder.parseChord(nx), q2 = SoloFinder.quick(nx, k);
      if (n2 && q2) {
        const b2 = n2.iv.map(x => md(n2.r + x)), common = q.ct.filter(p => b2.includes(p)), lead = [];
        b2.forEach(p => b.pcs.forEach(o => { if ((md(p - o) === 1 || md(o - p) === 1) && !b2.includes(o)) lead.push(q.nn(o) + '→' + q.nn(p)); }));
        const third = n2.iv.includes(4) ? 4 : n2.iv.includes(3) ? 3 : 7;
        $('passtNx').innerHTML = 'Danach <b>' + q2.chord + '</b>';
        const l2 = (common.length ? 'Liegen lassen <b>' + common.map(p => q.nn(p)).join(', ') + '</b>' : '') + (common.length && lead.length ? ' · ' : '') + (lead.length ? 'Leitton <b>' + [...new Set(lead)].slice(0, 2).join(' · ') + '</b>' : '');
        mv += '<div class="passt-row"><span class="passt-l">Nächster Wechsel → ' + q2.chord + '</span>'
          + '<span class="passt-ln">Zielton <b class="g">' + q.nn(n2.r + third) + '</b> (Terz) genau beim Wechsel</span>'
          + '<span class="passt-ln">' + (l2 || '&nbsp;') + '</span></div>';
      }
    } else $('passtNx').textContent = '\u00a0';
    $('passtMv').innerHTML = mv;
  }
  setInterval(() => { if (!window.__live) tick(); }, 120);
  window.PasstBox = { tick, hold: () => hold.on, state: () => ({ hidden: box.hidden, open, held: hold.on, chord: $('passtCh').textContent, scale: $('passtSc').textContent }) };
})();
