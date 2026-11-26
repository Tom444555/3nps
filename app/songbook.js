/* ---------- v161: Songbook (Lernen › Songbook) ----------
   Wird erst beim ersten Öffnen geladen (lernen.js lädt songbook.css/.js). Links die Liste deiner Stücke (Suche, „＋ Neues Stück“),
   rechts das Stück: Kacheln Tonart · BPM · Schlagzeug · geübt, „Akkorde & Text“, Rig-Sound, Looper-Idee, „▶ Laden“.
   „▶ Laden“ nutzt nur, was die App schon von außen anbietet: Kopfleiste (#root/#mode, #bpm), Schlagzeug-Stil (#loopDrumStyle),
   Idee wie „Laden“ in der Ideen-Liste (LooperIdeas.load, looper.js), Rig-Sound vormerken (Rig.select bzw. „3nps-rig“.p).
   Läuft der Looper oder liegt ein ungespeicherter Loop vor, fragt es vorher. Nichts läuft, solange die Seite zu ist.
   Speicher: localStorage „3nps-songbook“ – EIN Schlüssel, jedes Schreiben ein setItem:
     { v: 1, sel: id, fs: Schriftstufe 0–2, s: [{ id, t: Titel, r: Grundton 0–11, m: Modus (MODES-Schlüssel), b: BPM, ts: Taktart,
       dk: Schlagzeug-Stil ('' = nicht ändern), dn: Name, x: Akkorde & Text, rid/rnm: Rig-Sound (id/Name), rt: Ziel-Gerät, rn: freier Text,
       iid/inm: Looper-Idee (id/Name), n: Notiz, c: angelegt, e: geändert, l: zuletzt geladen (ms) }] }
   Übezeit: Thema „sb<id>“ in „3nps-uebezeit-themen“ (nur erweitert, erst beim Laden bzw. „Übezeit zu diesem Stück“). */
window.Songbook = (() => {
  const KEY = '3nps-songbook', TKEY = '3nps-uebezeit-themen', $ = id => document.getElementById(id);
  const TT = s => (typeof T === 'function' ? T(s) : s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], FL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
  const MODE_OFF = { 'Ionisch (Dur)': 0, 'Dorisch': 2, 'Phrygisch': 4, 'Lydisch': 5, 'Mixolydisch': 7, 'Äolisch (Moll)': 9, 'Lokrisch': 11 };
  const MSHORT = { 'Ionisch (Dur)': 'Dur', 'Äolisch (Moll)': 'Moll' };
  const TSIG = ['4/4', '3/4', '6/8', '12/8'], TGT = { bias: 'BIAS X', reactor: 'Reactor 50', spark: 'Spark LIVE' }, FS = ['klein', 'mittel', 'groß'];
  const md = x => ((x % 12) + 12) % 12;
  let built = false, q = '', phoneSong = false;

  /* ---------- Speicher ---------- */
  const blank = () => ({ v: 1, sel: '', fs: 1, s: [] });
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.s)) return Object.assign(blank(), d); } catch (e) {} return blank(); }
  function store(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { say(TT('Konnte nicht speichern – Speicher voll oder privates Surfen.'), true); return false; }
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const find = (d, id) => d.s.find(x => x.id === id) || null;

  /* ---------- Musik: Tonart, Akkordzeilen, Transponieren ---------- */
  const flatKey = (r, m) => [1, 3, 5, 6, 8, 10].includes(md(r - (MODE_OFF[m] || 0)));   // Dur-Paralleltonart mit ♭-Vorzeichen
  const noteName = (pc, flat) => (flat ? FL : SH)[md(pc)];
  const keyName = s => noteName(s.r, flatKey(s.r, s.m)) + (window.__lang === 'en' ? ' ' : '-') + TT(MSHORT[s.m] || s.m);
  // Ein Akkord: Grundton, Zusatz aus bekannten Bausteinen, optional /Bass. „Ende“, „Die“, „Am Ende“ (ganze Zeile) sind keine Akkordzeilen.
  const CH = /^([A-H])([#b♯♭]?)((?:maj|min|m|M|dim|aug|sus|add|°|ø|\+|-)?(?:[0-9]+|[b#♯♭][0-9]+|sus[0-9]*|add[0-9]+|maj[0-9]*|\([0-9b#♯♭,+]*\))*)(?:\/([A-H])([#b♯♭]?))?$/;
  const DECO = /^(\|+:?|:?\|+|:\|\|?|\|\|?:|-+|\/|%|\.{1,3}|\(?[xX×]\d+\)?|N\.?C\.?)$/;
  const accPc = (n, a) => md(PC[n] + (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0));
  function isChordLine(line) {
    const tok = line.trim().split(/\s+/); if (!line.trim()) return false;
    let n = 0; for (const t of tok) { if (CH.test(t)) n++; else if (!DECO.test(t)) return false; }
    return n > 0;
  }
  function trChord(tok, k, flat) {
    const m = CH.exec(tok); if (!m) return tok;
    return noteName(accPc(m[1], m[2]) + k, flat) + m[3] + (m[4] ? '/' + noteName(accPc(m[4], m[5]) + k, flat) : '');
  }
  // Spalten bleiben erhalten (Akkord steht über derselben Silbe); wird ein Akkord länger, rückt der nächste nur so weit wie nötig.
  function trLine(line, k, flat) {
    let out = '', m; const re = /\S+/g;
    while ((m = re.exec(line))) {
      const t = trChord(m[0], k, flat);
      if (out.length < m.index) out += ' '.repeat(m.index - out.length); else if (out.length) out += ' ';
      out += t;
    }
    return out;
  }
  function transposeText(x, k, flat) { return String(x || '').split('\n').map(l => (isChordLine(l) ? trLine(l, k, flat) : l)).join('\n'); }

  /* ---------- Übezeit ---------- */
  const thId = s => 'sb' + s.id;
  function practice() {   // { thema: [Sekunden, letztes Ende (ms)] }
    const o = {}; if (!window.Uebezeit) return o;
    Uebezeit.load().u.forEach(u => { const a = o[u[3]] || (o[u[3]] = [0, 0]); a[0] += u[1]; a[1] = Math.max(a[1], u[0] * 1000); });
    return o;
  }
  function topicsRaw() { try { const t = JSON.parse(localStorage.getItem(TKEY) || 'null'); if (t) return { c: t.c || [], r: t.r || {}, h: t.h || [] }; } catch (e) {} return { c: [], r: {}, h: [] }; }
  function ensureTopic(s) {   // nur erweitern: eigenes Thema mit dem Titel, ausgeblendet → wieder sichtbar
    const t = topicsRaw(), id = thId(s), c = t.c.find(x => x[0] === id); let ch = false;
    if (!c) { t.c.push([id, s.t]); ch = true; } else if (c[1] !== s.t && !t.r[id]) { c[1] = s.t; ch = true; }
    const hi = t.h.indexOf(id); if (hi >= 0) { t.h.splice(hi, 1); ch = true; }
    if (ch) try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch (e) {}
    return id;
  }
  function renameTopic(s) { const t = topicsRaw(), c = t.c.find(x => x[0] === thId(s)); if (c && c[1] !== s.t) { c[1] = s.t; try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch (e) {} } }
  function hideTopic(s) { const t = topicsRaw(), id = thId(s); if (t.c.some(x => x[0] === id) && !t.h.includes(id)) { t.h.push(id); try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch (e) {} } }
  const fmtHM = sec => (window.Uebezeit ? Uebezeit.fmtHM(sec) : Math.round(sec / 60) + ' min');

  /* ---------- Anzeige ---------- */
  function sorted(d, pr) {
    const key = s => Math.max(s.l || 0, (pr[thId(s)] || [0, 0])[1], s.c || 0);
    return d.s.slice().sort((a, b) => key(b) - key(a));
  }
  function matches(s) {
    if (!q) return true; const w = q.toLowerCase();
    return [s.t, s.x, s.n, keyName(s), s.rn, s.rnm, s.inm].some(v => String(v || '').toLowerCase().includes(w));
  }
  const drumTxt = s => (s.dk ? s.dn || s.dk : '–');
  const rigTxt = s => { const n = s.rn || s.rnm || ''; return n ? n + (s.rt && TGT[s.rt] ? ' · ' + TGT[s.rt] : '') : ''; };
  function build() {
    const r = $('sgbRoot'); if (!r) return;
    if (!built) {
      r.innerHTML = '<div class="sgb-wrap" id="sgbWrap">'
        + '<div class="card sgb-list"><div class="card-head"><h2>Songbook</h2><button type="button" class="toggle-btn sgb-new" id="sgbNew">' + esc(TT('＋ Neues Stück')) + '</button></div>'
        + '<input type="search" id="sgbQ" class="sgb-q" placeholder="' + esc(TT('Suchen …')) + '" autocomplete="off" aria-label="' + esc(TT('Stücke durchsuchen')) + '">'
        + '<div id="sgbL" class="sgb-rows" role="listbox" aria-label="' + esc(TT('Stücke')) + '"></div><p class="caption" id="sgbCnt"></p>'
        + '<div class="sgb-io"><button type="button" class="toggle-btn" id="sgbExp">' + esc(TT('Songbook exportieren')) + '</button><button type="button" class="toggle-btn" id="sgbImp">' + esc(TT('Songbook importieren')) + '</button>'
        + '<input type="file" id="sgbFile" accept=".json,application/json" hidden></div></div>'
        + '<div class="card sgb-song" id="sgbS"></div></div>';
      r.addEventListener('click', onClick);
      $('sgbQ').addEventListener('input', () => { q = $('sgbQ').value.trim(); paintList(); });
      $('sgbFile').addEventListener('change', onImport);
      built = true;
    }
    paint();
  }
  function paint() { paintList(); paintSong(); }
  function paintList() {
    if (!built) return;
    const d = load(), pr = practice(), all = sorted(d, pr), l = all.filter(matches);
    $('sgbL').innerHTML = l.length ? l.map(s => '<button type="button" class="sgb-row' + (s.id === d.sel ? ' on' : '') + '" data-id="' + esc(s.id) + '" role="option" aria-selected="' + (s.id === d.sel) + '">'
      + '<b translate="no">' + esc(s.t) + '</b><small>' + esc(keyName(s) + ' · ' + s.b + ' BPM' + (s.dk ? ' · ' + drumTxt(s) : '')) + '</small></button>').join('')
      : '<p class="pattern-desc">' + esc(all.length ? TT('Nichts gefunden.') : TT('Noch kein Stück – ＋ Neues Stück')) + '</p>';
    $('sgbCnt').textContent = all.length ? all.length + ' ' + TT(all.length === 1 ? 'Stück' : 'Stücke') + ' · ' + TT('sortiert nach „zuletzt geübt“') : '';
  }
  function paintSong() {
    if (!built) return;
    const d = load(), s = find(d, d.sel) || sorted(d, practice())[0] || null, el = $('sgbS');
    $('sgbWrap').classList.toggle('sgb-phsong', !!(s && phoneSong));
    if (!s) {
      el.innerHTML = '<div class="sgb-empty"><p class="sgb-big">📖</p><p>' + esc(TT('Noch kein Stück – ＋ Neues Stück')) + '</p><p class="caption">' + esc(TT('Trage deine Stücke mit Tonart, Tempo, Akkorden und Text ein. „▶ Laden“ stellt dann alles mit einem Knopf ein.')) + '</p>'
        + '<button type="button" class="toggle-btn sgb-new" data-a="new">' + esc(TT('＋ Neues Stück')) + '</button></div>';
      return;
    }
    if (s.id !== d.sel) { d.sel = s.id; store(d); }
    const p = practice()[thId(s)] || [0, 0], rg = rigTxt(s);
    el.innerHTML = '<button type="button" class="toggle-btn sgb-back" data-a="back">' + esc(TT('‹ Zurück')) + '</button>'
      + '<div class="card-head sgb-head"><div class="sgb-tt"><h2 translate="no">' + esc(s.t) + '</h2><span class="caption">' + esc(keyName(s) + ' · ' + s.b + ' BPM · ' + s.ts) + '</span></div>'
      + '<button type="button" class="toggle-btn sgb-load" id="sgbLoad" data-a="load">' + esc(TT('▶ Laden')) + '</button></div>'
      + '<p class="caption">' + esc(TT('„Laden“ stellt Tempo, Tonart, Schlagzeug und Rig-Sound ein und holt die Looper-Idee – ein Knopf, dann spielen.')) + '</p>'
      + '<div class="sgb-msg" id="sgbMsg" role="status" aria-live="polite"></div>'
      + '<div class="sgb-kgrid"><div class="sgb-k"><b>' + esc(keyName(s)) + '</b><span>' + esc(TT('Tonart')) + '</span></div><div class="sgb-k"><b>' + esc(s.b) + '</b><span>BPM</span></div>'
      + '<div class="sgb-k"><b>' + esc(drumTxt(s)) + '</b><span>' + esc(TT('Schlagzeug')) + '</span></div><div class="sgb-k"><b id="sgbGeuebt">' + esc(p[0] ? fmtHM(p[0]) : '–') + '</b><span>' + esc(TT('geübt')) + '</span></div></div>'
      + '<div class="sgb-xh"><h3>' + esc(TT('Akkorde & Text')) + '</h3><div class="seg sgb-fs" role="group" aria-label="' + esc(TT('Schriftgröße')) + '">'
      + FS.map((f, i) => '<button type="button" class="toggle-btn' + (i === d.fs ? ' active' : '') + '" data-fs="' + i + '" aria-label="' + esc(TT('Schrift') + ' ' + TT(f)) + '">' + ['A', 'A', 'A'][i] + '</button>').join('') + '</div></div>'
      + (s.x ? '<pre class="sgb-x sgb-fs' + d.fs + '" id="sgbX" translate="no">' + s.x.split('\n').map(l => (isChordLine(l) ? '<span class="sgb-ch">' + esc(l) + '</span>' : esc(l))).join('\n') + '</pre>'
        : '<p class="pattern-desc sgb-x0">' + esc(TT('Noch keine Akkorde – unter „Bearbeiten“ eintragen. Akkordzeile über die Textzeile schreiben.')) + '</p>')
      + '<div class="sgb-k2"><div class="sgb-k sgb-kl"><span>' + esc(TT('Rig-Sound')) + '</span><b>' + esc(rg || '–') + '</b>' + (rg ? '<button type="button" class="toggle-btn sgb-sm" data-a="rig">' + esc(TT('Im Rig öffnen')) + '</button>' : '') + '</div>'
      + '<div class="sgb-k sgb-kl"><span>' + esc(TT('Looper-Idee')) + '</span><b>' + esc(s.iid ? '„' + (s.inm || '?') + '“' : '–') + '</b></div></div>'
      + (s.n ? '<p class="sgb-note">' + esc(s.n) + '</p>' : '')
      + '<div class="sgb-acts"><button type="button" class="toggle-btn" data-a="edit">' + esc(TT('Bearbeiten')) + '</button>'
      + '<span class="sgb-tr" role="group" aria-label="' + esc(TT('Tonart ändern')) + '"><button type="button" class="toggle-btn" data-a="tr" data-k="-1" aria-label="' + esc(TT('Halbton tiefer')) + '">−</button><span>' + esc(TT('Tonart ändern')) + '</span><button type="button" class="toggle-btn" data-a="tr" data-k="1" aria-label="' + esc(TT('Halbton höher')) + '">+</button></span>'
      + '<button type="button" class="toggle-btn" data-a="uz">' + esc(TT('Übezeit zu diesem Stück')) + '</button></div>';
  }
  let sayT = null;
  function say(txt, warn, html) {
    const m = $('sgbMsg'); if (!m) return;
    m.innerHTML = esc(txt) + (html || ''); m.classList.toggle('warn', !!warn); clearTimeout(sayT);
    if (!html) sayT = setTimeout(() => { if ($('sgbMsg') === m) m.textContent = ''; }, 12000);
  }

  /* ---------- Bedienung ---------- */
  function onClick(e) {
    const row = e.target.closest('.sgb-row');
    if (row) { const d = load(); d.sel = row.dataset.id; store(d); phoneSong = true; paint(); const s = $('sgbS'); if (s && innerWidth < 700 && s.scrollIntoView) window.scrollTo(0, 0); return; }
    const fs = e.target.closest('[data-fs]');
    if (fs) { const d = load(); d.fs = +fs.dataset.fs; store(d); const x = $('sgbX'); if (x) x.className = 'sgb-x sgb-fs' + d.fs; fs.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === fs)); return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'sgbNew') return edit(null);
    if (b.id === 'sgbExp') return exportFile();
    if (b.id === 'sgbImp') return $('sgbFile').click();
    const a = b.dataset.a, d = load(), s = find(d, d.sel);
    if (a === 'new') return edit(null);
    if (a === 'back') { phoneSong = false; paint(); return; }
    if (!s) return;
    if (a === 'edit') return edit(s);
    if (a === 'tr') return transpose(s.id, +b.dataset.k);
    if (a === 'load') return askLoad(s.id);
    if (a === 'rig') { preRig(s); if (window.AppNav) AppNav.show('rig'); return; }
    if (a === 'uz') return toUebezeit(s);
    if (a === 'topic') { if (window.Uebezeit) Uebezeit.setTopic(ensureTopic(s)); say(TT('Übezeit-Thema:') + ' ' + s.t); return; }
    if (a === 'looper') { if (window.AppNav) AppNav.show('looper'); }
  }
  function transpose(id, k) {
    const d = load(), s = find(d, id); if (!s) return;
    const r = md(s.r + k), fl = flatKey(r, s.m);
    s.x = transposeText(s.x, k, fl); s.r = r; s.e = Date.now();
    if (store(d)) { paint(); say(TT('Tonart jetzt') + ' ' + keyName(s) + ' (' + (k > 0 ? '+' : '−') + '1 ' + TT('Halbton') + ')'); }
  }
  function toUebezeit(s) {
    if (!window.Uebezeit) return;
    const id = ensureTopic(s), u = Uebezeit.load();
    if (!u.run) Uebezeit.setTopic(id);   // laufende Einheit behält ihr Thema (umwählen auf der Seite „Übezeit“)
    if (window.AppNav) AppNav.show('uebezeit');
  }
  // Rig-Sound vormerken: Rig geladen → dort wählen; sonst nur die gemerkte Ansicht („3nps-rig“) erweitern, Rig lädt sie beim Öffnen
  function preRig(s) {
    if (!s.rid) return false;
    if (window.Rig && Rig.select) return Rig.select(s.rid, s.rt);
    let v = {}; try { v = JSON.parse(localStorage.getItem('3nps-rig') || '{}') || {}; } catch (e) { v = {}; }
    v.p = s.rid; v.v = 'sounds'; if (TGT[s.rt]) v.t = s.rt;
    try { localStorage.setItem('3nps-rig', JSON.stringify(v)); } catch (e) { return false; }
    return true;
  }

  /* ---------- „▶ Laden“ ---------- */
  const LP = () => (typeof Looper !== 'undefined' ? Looper : null);
  function askLoad(id) {
    const L = LP(), d = load(), s = find(d, id); if (!s) return;
    const rec = !!(L && L.looping && L.looping() && !L.running());
    if (rec) { say(TT('Der Looper nimmt gerade auf – erst die Aufnahme beenden, dann laden.'), true); return; }
    const run = !!(L && L.running && L.running()), dirty = !!(window.LooperIdeas && LooperIdeas.dirty());
    if (!run && !dirty) return doLoad(id);
    sheet('<h2 id="sgbAskH">' + esc(TT('Erst fragen: Looper')) + '</h2>'
      + '<p class="pattern-desc">' + esc(run ? TT('Der Looper läuft gerade.') : '') + ' ' + esc(dirty ? TT('Im Looper liegt ein Loop, der noch nicht als Idee gespeichert ist.') : '') + '</p>'
      + '<p class="pattern-desc">' + esc(s.iid ? TT('„Laden“ stoppt den Looper und ersetzt den Loop durch die Idee') + ' „' + (s.inm || '') + '“.' : TT('„Laden“ stoppt den Looper und ändert Tempo und Tonart; der Loop bleibt liegen.')) + '</p>'
      + '<div class="sgb-askb"><button type="button" class="toggle-btn" data-q="go">' + esc(TT('Trotzdem laden')) + '</button><button type="button" class="toggle-btn" data-q="looper">' + esc(TT('Erst speichern (zum Looper)')) + '</button><button type="button" class="toggle-btn active" data-q="no">' + esc(TT('Abbrechen')) + '</button></div>',
      'sgbAskH', b => { const k = b.dataset.q; if (!k) return; closeSheet(); if (k === 'go') doLoad(id); else if (k === 'looper' && window.AppNav) AppNav.show('looper'); });
  }
  async function doLoad(id) {
    const d = load(), s = find(d, id); if (!s) return;
    const L = LP(), done = [], warn = [];
    if (L && L.running && L.running()) L.stopAll();
    let idea = null;
    if (s.iid) {
      try { idea = window.LooperIdeas ? await LooperIdeas.load(s.iid) : null; } catch (e) { idea = null; warn.push(TT('Die Looper-Idee konnte nicht geladen werden:') + ' ' + (e && e.message || e)); }
      if (idea) done.push(TT('Idee') + ' „' + (idea.name || s.inm) + '“');
      else if (!warn.length) warn.push(TT('Die verknüpfte Looper-Idee') + ' „' + (s.inm || '?') + '“ ' + TT('gibt es nicht mehr – unter „Bearbeiten“ eine andere wählen.'));
    }
    // Tonart der Kopfleiste (wie beim Laden einer Idee)
    try { if (typeof rootSel !== 'undefined' && MODE_OFF[s.m] != null) { rootSel.value = SH[md(s.r)]; modeSel.value = s.m; if (typeof rebuild === 'function') rebuild(); rootSel.dispatchEvent(new Event('change')); done.push(keyName(s)); } } catch (e) {}
    // Tempo: mit Idee gilt deren Tempo (der Loop ist so aufgenommen)
    const be = $('bpm');
    if (idea && idea.bpm && Math.round(idea.bpm) !== Math.round(s.b)) warn.push(TT('Tempo der Idee:') + ' ' + Math.round(idea.bpm * 10) / 10 + ' BPM (' + TT('Stück:') + ' ' + s.b + ')');
    else if (!idea && be) { be.value = Math.max(+be.min || 40, Math.min(+be.max || 200, s.b)); be.dispatchEvent(new Event('input')); done.push(be.value + ' BPM'); }
    // Schlagzeug-Stil (nicht einschalten); bringt die Idee eigene Drums mit, gelten diese
    const st = $('loopDrumStyle');
    if (s.dk && st && !(idea && idea.drums)) {
      if ([...st.options].some(o => o.value === s.dk)) { if (st.value !== s.dk) { st.value = s.dk; st.dispatchEvent(new Event('change')); } done.push(TT('Schlagzeug') + ' ' + drumTxt(s)); }
      else warn.push(TT('Schlagzeug-Stil') + ' „' + drumTxt(s) + '“ ' + TT('gibt es nicht mehr.'));
    }
    if (s.rid && preRig(s)) done.push(TT('Rig-Sound vorgemerkt'));
    // Übezeit: Thema vorschlagen – eine laufende Einheit behält ihr Thema
    let uzHtml = '';
    if (window.Uebezeit) {
      const th = ensureTopic(s), u = Uebezeit.load();
      if (!u.run) { if (u.th !== th) Uebezeit.setTopic(th); done.push(TT('Übezeit-Thema')); }
      else if (u.th !== th) uzHtml = ' <button type="button" class="toggle-btn sgb-sm" data-a="topic">' + esc(TT('Übezeit-Thema auf dieses Stück')) + '</button>';
    }
    s.l = Date.now(); store(d); paintList();
    say((warn.length ? warn.join(' ') + ' ' : '') + TT('Geladen:') + ' ' + done.join(' · ') + '.', !!warn.length, uzHtml + ' <button type="button" class="toggle-btn sgb-sm" data-a="looper">' + esc(TT('Zum Looper')) + '</button>');
    return { done, warn };
  }

  /* ---------- Dialoge ---------- */
  let sheetFn = null;
  function sheet(html, hid, fn) {
    let w = $('sgbAsk');
    if (!w) {
      w = document.createElement('div'); w.id = 'sgbAsk'; w.className = 'sgb-ask'; document.body.appendChild(w);
      w.addEventListener('click', e => { if (e.target === w) { closeSheet(); return; } const b = e.target.closest('button'); if (b && sheetFn) sheetFn(b, e); });
    }
    w.innerHTML = '<div class="sgb-askbox card" role="dialog" aria-modal="true" aria-labelledby="' + hid + '">' + html + '</div>';
    sheetFn = fn; w.hidden = false;
    const f = w.querySelector('input, button'); if (f && innerWidth >= 700) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeSheet() { const w = $('sgbAsk'); if (w) { w.hidden = true; w.innerHTML = ''; } sheetFn = null; }
  const opt = (v, txt, on) => '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + '>' + esc(txt) + '</option>';
  function drumOpts(sel) {
    const st = $('loopDrumStyle'); let h = opt('', TT('– nicht ändern –'), !sel);
    if (!st) return h;
    [...st.children].forEach(c => {
      if (c.tagName === 'OPTGROUP') h += '<optgroup label="' + esc(c.label) + '">' + [...c.children].map(o => opt(o.value, o.textContent, o.value === sel)).join('') + '</optgroup>';
      else if (c.value !== 'custom') h += opt(c.value, c.textContent, c.value === sel);
    });
    return h;
  }
  function edit(s0) {
    const isNew = !s0, cur = $('bpm'), s = s0 ? Object.assign({}, s0) : {
      id: '', t: '', r: typeof rootSel !== 'undefined' ? Math.max(0, SH.indexOf(rootSel.value)) : 9, m: typeof modeSel !== 'undefined' && MODE_OFF[modeSel.value] != null ? modeSel.value : 'Äolisch (Moll)',
      b: Math.round(parseFloat(cur && cur.value) || 90), ts: '4/4', dk: '', x: '', rid: '', rt: '', rn: '', iid: '', n: '' };
    const fl = flatKey(s.r, s.m);
    sheet('<h2 id="sgbEdH">' + esc(isNew ? TT('Neues Stück') : TT('Stück bearbeiten')) + '</h2><div class="sgb-form">'
      + '<label class="field sgb-wide"><span>' + esc(TT('Titel')) + '</span><input type="text" id="sgbFT" maxlength="80" value="' + esc(s.t) + '" autocomplete="off"></label>'
      + '<label class="field"><span>' + esc(TT('Grundton')) + '</span><select id="sgbFR">' + SH.map((n, i) => opt(i, noteName(i, fl), i === s.r)).join('') + '</select></label>'
      + '<label class="field"><span>' + esc(TT('Tonart')) + '</span><select id="sgbFM">' + Object.keys(MODE_OFF).map(m => opt(m, TT(m), m === s.m)).join('') + '</select></label>'
      + '<label class="field"><span>' + esc(TT('Tempo (BPM)')) + '</span><input type="number" id="sgbFB" min="40" max="200" step="1" inputmode="numeric" value="' + esc(s.b) + '"></label>'
      + '<div class="field sgb-fbtn"><span>&nbsp;</span><button type="button" class="toggle-btn" data-f="bpm">' + esc(TT('aktuelles Tempo übernehmen')) + '</button></div>'
      + '<label class="field"><span>' + esc(TT('Taktart')) + '</span><select id="sgbFS">' + TSIG.map(t => opt(t, t, t === s.ts)).join('') + '</select></label>'
      + '<label class="field"><span>' + esc(TT('Schlagzeug')) + '</span><select id="sgbFD">' + drumOpts(s.dk) + '</select></label>'
      + '<label class="field sgb-wide"><span>' + esc(TT('Akkorde & Text')) + ' <small>' + esc(TT('(Akkordzeile über die Textzeile)')) + '</small></span><textarea id="sgbFX" rows="9" spellcheck="false" autocapitalize="off" translate="no">' + esc(s.x) + '</textarea></label>'
      + '<label class="field"><span>' + esc(TT('Rig-Sound')) + '</span><select id="sgbFRig">' + opt('', '–', !s.rid) + (s.rid ? opt(s.rid, s.rnm || s.rid, true) : '') + '</select></label>'
      + '<label class="field"><span>' + esc(TT('Ziel-Gerät')) + '</span><select id="sgbFRt">' + opt('', '–', !s.rt) + Object.keys(TGT).map(k => opt(k, TGT[k], k === s.rt)).join('') + '</select></label>'
      + '<label class="field sgb-wide"><span>' + esc(TT('Rig-Sound als freier Text (optional)')) + '</span><input type="text" id="sgbFRn" maxlength="80" value="' + esc(s.rn) + '" autocomplete="off"></label>'
      + '<label class="field sgb-wide"><span>' + esc(TT('Looper-Idee')) + '</span><select id="sgbFI">' + opt('', '–', !s.iid) + (s.iid ? opt(s.iid, s.inm || s.iid, true) : '') + '</select></label>'
      + '<label class="field sgb-wide"><span>' + esc(TT('Notiz')) + '</span><textarea id="sgbFN" rows="2" maxlength="500">' + esc(s.n) + '</textarea></label>'
      + '</div><p class="sgb-ferr" id="sgbFE" role="alert"></p><div class="sgb-askb">'
      + '<button type="button" class="toggle-btn active" data-f="save">' + esc(TT('Speichern')) + '</button><button type="button" class="toggle-btn" data-f="cancel">' + esc(TT('Abbrechen')) + '</button>'
      + (isNew ? '' : '<button type="button" class="toggle-btn sgb-del" data-f="del">' + esc(TT('Löschen')) + '</button>') + '</div>',
      'sgbEdH', b => {
        const f = b.dataset.f; if (!f) return;
        if (f === 'bpm') { $('sgbFB').value = Math.round(parseFloat(cur && cur.value) || 90); return; }
        if (f === 'cancel') { closeSheet(); return; }
        if (f === 'del') {
          if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = TT('Wirklich löschen?'); b.classList.add('danger'); setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.textContent = TT('Löschen'); b.classList.remove('danger'); } }, 3000); return; }
          const d = load(), i = d.s.findIndex(x => x.id === s.id); if (i < 0) { closeSheet(); return; }
          const [gone] = d.s.splice(i, 1); if (d.sel === gone.id) d.sel = '';
          if (store(d)) { hideTopic(gone); closeSheet(); phoneSong = false; paint(); say(TT('Gelöscht:') + ' ' + gone.t); }
          return;
        }
        if (f === 'save') {
          const t = $('sgbFT').value.trim(), bpm = Math.round(parseFloat($('sgbFB').value));
          if (!t) { $('sgbFE').textContent = TT('Bitte einen Titel eingeben.'); $('sgbFT').focus(); return; }
          if (!(bpm >= 40 && bpm <= 200)) { $('sgbFE').textContent = TT('Tempo bitte zwischen 40 und 200 BPM.'); return; }
          const d = load(), now = Date.now(); let o = isNew ? null : find(d, s.id);
          if (!o) { o = { id: newId(), c: now, l: 0 }; d.s.push(o); }
          const ds = $('sgbFD'), rs = $('sgbFRig'), is = $('sgbFI');
          Object.assign(o, { t, r: +$('sgbFR').value, m: $('sgbFM').value, b: bpm, ts: $('sgbFS').value, dk: ds.value, dn: ds.value ? ds.selectedOptions[0].textContent : '',
            x: $('sgbFX').value.replace(/\r\n?/g, '\n').replace(/\s+$/, ''), rid: rs.value, rnm: rs.value ? rs.selectedOptions[0].textContent : '', rt: $('sgbFRt').value, rn: $('sgbFRn').value.trim(),
            iid: is.value, inm: is.value ? is.selectedOptions[0].textContent : '', n: $('sgbFN').value.trim(), e: now });
          d.sel = o.id;
          if (store(d)) { renameTopic(o); closeSheet(); phoneSong = true; paint(); say(isNew ? TT('Angelegt:') + ' ' + t : TT('Gespeichert.')); }
        }
      });
    $('sgbFR').addEventListener('change', relabel); $('sgbFM').addEventListener('change', relabel);
    function relabel() { const f2 = flatKey(+$('sgbFR').value, $('sgbFM').value); [...$('sgbFR').options].forEach(o => { o.textContent = noteName(+o.value, f2); }); }
    fillRig(s); fillIdeas(s);
  }
  // Rig-Bibliothek: Liste aus dem Rig (lädt dessen Code wie beim Öffnen des Reiters, ohne 3D); eigene Sounds inklusive
  function fillRig(s, n) {
    const el = $('sgbFRig'); if (!el) return;
    if (!window.Rig || !Rig.sounds) { if (window.AppNav && AppNav.loadRig) AppNav.loadRig(); if ((n || 0) < 40) setTimeout(() => fillRig(s, (n || 0) + 1), 150); return; }
    const v = el.value; el.innerHTML = opt('', '–', !v) + Rig.sounds().map(p => opt(p.id, p.name, p.id === v)).join('') + (v && !Rig.sounds().some(p => p.id === v) ? opt(v, (s.rnm || v) + ' (' + TT('fehlt') + ')', true) : '');
  }
  async function fillIdeas(s) {
    let l = []; try { l = typeof AppDB !== 'undefined' ? await AppDB.list('ideas', i => (i.kind === 'lied' ? null : { id: i.id, name: i.name, ts: i.ts })) : []; } catch (e) { l = []; }
    const el = $('sgbFI'); if (!el) return;
    l = l.filter(i => !i.broken).sort((a, b) => b.ts - a.ts); const v = el.value;
    el.innerHTML = opt('', '–', !v) + l.map(i => opt(i.id, i.name, i.id === v)).join('') + (v && !l.some(i => i.id === v) ? opt(v, (s.inm || v) + ' (' + TT('fehlt') + ')', true) : '');
  }

  /* ---------- Sicherung: Export/Import (JSON) ---------- */
  async function exportFile() {
    const d = load(), json = JSON.stringify({ app: '3nps-songbook', v: 1, at: new Date().toISOString(), s: d.s }, null, 1);
    const dt = new Date(), name = 'songbook-' + dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0') + '.json';
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Songbook' }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say(TT('Exportiert:') + ' ' + d.s.length + ' ' + TT(d.s.length === 1 ? 'Stück' : 'Stücke'));
  }
  // Zusammenführen ohne Dubletten: gleiche id → neuere Fassung gewinnt; gleicher Titel + gleicher Text → schon vorhanden
  function merge(list) {
    const d = load(); let add = 0, upd = 0, same = 0;
    (Array.isArray(list) ? list : []).forEach(x => {
      if (!x || typeof x !== 'object' || !x.id || !String(x.t || '').trim()) return;
      const s = { id: String(x.id), t: String(x.t).slice(0, 80), r: md(+x.r || 0), m: MODE_OFF[x.m] != null ? x.m : 'Ionisch (Dur)', b: Math.max(40, Math.min(200, Math.round(+x.b || 90))),
        ts: TSIG.includes(x.ts) ? x.ts : '4/4', dk: String(x.dk || ''), dn: String(x.dn || ''), x: String(x.x || ''), rid: String(x.rid || ''), rnm: String(x.rnm || ''), rt: TGT[x.rt] ? x.rt : '',
        rn: String(x.rn || ''), iid: String(x.iid || ''), inm: String(x.inm || ''), n: String(x.n || ''), c: +x.c || Date.now(), e: +x.e || +x.c || 0, l: +x.l || 0 };
      const o = find(d, s.id);
      if (o) { if ((s.e || 0) > (o.e || 0)) { Object.assign(o, s); upd++; } else same++; return; }
      if (d.s.some(y => y.t === s.t && y.x === s.x)) { same++; return; }
      d.s.push(s); add++;
    });
    return store(d) ? { add, upd, same } : null;
  }
  function onImport() {
    const f = $('sgbFile').files[0]; $('sgbFile').value = ''; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let j = null; try { j = JSON.parse(rd.result); } catch (e) { j = null; }
      const l = j && (Array.isArray(j) ? j : j.app === '3nps-songbook' ? j.s : null);
      if (!l) { say(TT('Das ist keine Songbook-Datei.'), true); return; }
      const r = merge(l); if (!r) return; paint();
      say(TT('Importiert:') + ' ' + r.add + ' ' + TT('neu') + ', ' + r.upd + ' ' + TT('aktualisiert') + ', ' + r.same + ' ' + TT('schon vorhanden'));
    };
    rd.readAsText(f);
  }

  function open() { build(); }
  document.addEventListener('tabchange', e => { if (e.detail !== 'songbook') closeSheet(); else if (built) paint(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && built && window.AppNav && AppNav.current() === 'songbook') paintList(); });
  return { open, built: () => built, load, store, merge, doLoad, askLoad, isChordLine, transposeText, keyName, practice, edit, closeSheet, _flatKey: flatKey };
})();
