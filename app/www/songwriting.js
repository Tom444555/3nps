/* ---------- v167: Song & Gesang › Songwriting – eine Songauswahl für alles ----------
   Erst beim ersten Öffnen des Songwritings geladen (lied.js swLoad). Ändert nichts an den bisherigen Karten, ergänzt nur:
   – Leiste der Bereiche „Song“ (alle bisherigen Karten) · „Text-Werkstatt“ (textwerk.js) · „Workflow“ · „Leitfaden & Beispiel“ · „Ideen“ (songtext.js);
     gewählter Bereich wird gemerkt, Bereiche laden ihren Code erst beim ersten Öffnen. Alte Wege (Reiter „songtext“) leitet tabs.js hierher (__swWant).
   – Stand-Kacheln des Songs (Workflow n/11 aus „3nps-songtext“, Abschnitte mit Text, Akkorde, Stand Idee/Entwurf/fertig = Feld „stand“ im Song).
   – Songliste (Stand, Workflow, zuletzt geändert, Tonart; Filter nach Stand) und „Ins Songbook übernehmen“ (wie Workflow-Schritt 11).
   – Summ-Idee je Abschnitt in der Karte „Text“: Mikrofon nur nach Antippen (Weg wie „Mitsingen lernen“ v163), mono 16 kHz, höchstens 30 s,
     IndexedDB „3nps-app“, Store „meta“, Schlüssel „lied-hum:<Song-id>:<Teil-id>“ (keine neue DB-Version, kein neuer Store) → in „Alles sichern“ enthalten.
   – Silben-Raster (silbenraster.js, erst bei Bedarf) für Workflow-Schritt 9 und den Bereich „Text-Werkstatt“.
   Speicher: localStorage „3nps-sw“ { v:1, a: Bereich, f: Filter der Songliste, h: { 'Song:Teil': { s: Sekunden, at } }, m: { Song-id: zuletzt geändert }, r: Raster } */
window.SW = (() => {
  const KEY = '3nps-sw', STK = '3nps-songtext', $ = id => document.getElementById(id);
  const EN = () => window.__lang === 'en';
  const tx = a => Array.isArray(a) ? (EN() && a[1] ? a[1] : a[0]) : String(a == null ? '' : a);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LA = () => window.LiedApi || null, LC = () => window.LiedCore || null;
  const U = {
    st: { idee: ['Idee', 'Idea'], entwurf: ['Entwurf', 'Draft'], fertig: ['fertig', 'finished'] },
    all: ['Alle', 'All'], listH: ['Songliste', 'Song list'], none: ['Noch keine Songs – oben „+ Neuer Song“.', 'No songs yet – tap “+ New song” above.'], noHit: ['Kein Song mit diesem Stand.', 'No song with this status.'],
    wf: ['Workflow', 'Workflow'], ch: ['geändert', 'changed'], parts: ['Abschnitte', 'sections'],
    noSong: ['Erst einen Song wählen oder anlegen.', 'Choose or create a song first.'], noParts: ['Der Song hat noch keine Abschnitte – erst Teile anlegen (Looper „→ Song“ oder Workflow Schritt 4).', 'The song has no sections yet – add parts first (Looper “→ Song” or workflow step 4).'],
    stSet: ['Stand des Songs: ', 'Song status: '], loadFail: ['Konnte nicht geladen werden – bitte einmal mit Internet öffnen.', 'Could not be loaded – please open once while online.'],
    hum: ['● Idee summen', '● Hum an idea'], humStop: ['■ Stopp', '■ Stop'], humDel: ['Löschen', 'Delete'], humPlay: ['▶', '▶'],
    humHp: ['Summ-Idee: Kopfhörer auf, dann summen oder singen (höchstens 30 s). Nichts verlässt das Gerät.', 'Hum idea: put on headphones, then hum or sing (max. 30 s). Nothing leaves the device.'],
    humOk: ['Summ-Idee gespeichert: %s – %t s.', 'Hum idea saved: %s – %t s.'], humShort: ['Aufnahme zu kurz – nichts gespeichert.', 'Recording too short – nothing saved.'],
    humMic: ['Kein Zugriff aufs Mikrofon – in den Einstellungen erlauben.', 'No microphone access – allow it in the settings.'], humFail: ['Summ-Idee konnte nicht gespeichert werden (Speicher voll?).', 'Could not save the hum idea (storage full?).'],
    humDelQ: ['Summ-Idee zu „%s“ löschen?', 'Delete the hum idea for “%s”?'], humGone: ['Summ-Idee nicht gefunden.', 'Hum idea not found.'], humMax: ['30 s erreicht – Aufnahme beendet.', '30 s reached – recording stopped.'],
    humT: ['Summ-Idee zu „%s“', 'Hum idea for “%s”']
  };
  const u = k => tx(U[k]);
  const AREAS = ['song', 'tw', 'wf', 'lf', 'nb'], ST_AREAS = ['wf', 'lf', 'nb'], STS = ['idee', 'entwurf', 'fertig'];
  const HELPS = { song: 'songwriting', tw: 'text-werkstatt', wf: 'songtext-schreiben', lf: 'songtext-schreiben', nb: 'songtext-schreiben' };
  const MAXS = 30, HSR = 16000;
  function load() {
    const b = { v: 1, a: 'song', f: '', h: {}, m: {}, r: {} };
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && typeof d === 'object') { Object.assign(b, d); ['h', 'm', 'r'].forEach(k => { if (!b[k] || typeof b[k] !== 'object') b[k] = {}; }); } } catch (e) {}
    return b;
  }
  let D = load(), sT = 0;
  function store() { clearTimeout(sT); sT = 0; try { localStorage.setItem(KEY, JSON.stringify(D)); return true; } catch (e) { return false; } }
  const storeSoon = () => { clearTimeout(sT); sT = setTimeout(store, 600); };
  const panel = $('panel-lied');
  const song = () => { const A = LA(); try { return A && A.song ? A.song() : null; } catch (e) { return null; } };
  const ver = () => { const A = LA(); try { return A && A.ver ? A.ver() : null; } catch (e) { return null; } };
  const songs = () => { const A = LA(); try { return A && A.songs ? A.songs() : []; } catch (e) { return []; } };
  const say = t => { const A = LA(); if (A && A.status) A.status(t); };

  /* ---------- Nachladen ---------- */
  const css = h => new Promise(r => { if (document.querySelector('link[href="' + h + '"]')) return r(); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; l.onload = l.onerror = r; document.head.appendChild(l); });
  const jsQ = {};
  function js(src, ok, cb) {
    if (ok()) { cb(); return; }
    const q = jsQ[src] || (jsQ[src] = { cbs: [], busy: false }); q.cbs.push(cb); if (q.busy) return; q.busy = true;
    const sc = document.createElement('script'); sc.src = src;
    sc.onload = () => { q.busy = false; const c = q.cbs; q.cbs = []; if (ok()) c.forEach(f => f()); };
    sc.onerror = () => { q.busy = false; q.cbs = []; sc.remove(); say(src + ': ' + u('loadFail')); };
    document.head.appendChild(sc);
  }
  // „Songtext schreiben“ (v165/v166) – nutzt die Fahrplan-Klassen aus mitsingen.css
  function stLoad(cb) {
    if (window.Songtext) { cb(); return; }
    Promise.all([css('mitsingen.css'), css('songtext.css')]).then(() => js('songtext.js', () => !!window.Songtext, cb));
  }

  /* ---------- Bereiche ---------- */
  function mark(a) {
    if (!AREAS.includes(a)) a = 'song';
    D.a = a; store(); panel.dataset.sw = a;
    document.querySelectorAll('#swNav [data-sw]').forEach(b => { const on = b.dataset.sw === a; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    if (window.AppNav && AppNav.HELP) AppNav.HELP.lied = HELPS[a];   // „?“ öffnet das passende Thema
  }
  function area(a, cb) {
    mark(a); a = D.a;
    if (a === 'tw') { const A = LA(); if (A && A.twLoad) A.twLoad(() => { const box = $('ldTwBox'); if (box && window.TextWerk) TextWerk.open(box); raster($('swRasterTw')); if (cb) cb(); }); return; }
    if (ST_AREAS.includes(a)) { stLoad(() => { if (D.a === a) Songtext.show(a); if (cb) cb(); }); return; }
    if (cb) cb();
  }
  $('swNav').addEventListener('click', e => {
    const b = e.target.closest('[data-sw]'); if (!b) return;
    area(b.dataset.sw);
    const bar = $('swBar'); if (bar && bar.getBoundingClientRect().top < 0 && bar.scrollIntoView) bar.scrollIntoView({ block: 'start' });
  });

  /* ---------- Stand-Kacheln ---------- */
  function wfDone(id) { try { const d = JSON.parse(localStorage.getItem(STK) || 'null'), p = d && d.p ? d.p['l:' + id] : null; return p && Array.isArray(p.d) ? p.d.length : 0; } catch (e) { return 0; } }
  const stOf = s => STS.includes(s && s.stand) ? s.stand : 'idee';
  const stName = k => tx(U.st[k] || U.st.idee);
  const withText = v => v.parts.filter(p => (p.lyrics || []).some(x => String(x || '').trim())).length;
  function tiles() {
    const s = song(), v = s ? ver() : null;
    $('swKw').textContent = s ? wfDone(s.id) + '/11' : '–';
    $('swKt').textContent = v ? withText(v) + '/' + v.parts.length : '–';
    $('swKa').textContent = v && v.parts.some(p => p.chords && p.chords.length) ? '✓' : '–';
    $('swKsV').textContent = s ? stName(stOf(s)) : '–';
    const k = $('swKs'); k.disabled = !s; k.dataset.st = s ? stOf(s) : '';
    ['swSb', 'swListB'].forEach(id => { const b = $(id); if (b) b.disabled = id === 'swSb' ? !s : !songs().length; });
  }
  $('swKs').addEventListener('click', () => {
    const s = song(), A = LA(); if (!s || !A) return;
    s.stand = STS[(STS.indexOf(stOf(s)) + 1) % STS.length]; D.m[s.id] = Date.now(); store(); A.save();
    tiles(); if (!$('swList').hidden) paintList(); say(u('stSet') + stName(s.stand));
  });

  /* ---------- Songliste ---------- */
  const fmtD = t => { if (!t) return '–'; const d = new Date(t); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getFullYear()).slice(2); };
  function changed(s) {
    let t = D.m[s.id] || 0; (s.versions || []).forEach(v => { if (v.at > t) t = v.at; });
    try { const d = JSON.parse(localStorage.getItem(STK) || 'null'), p = d && d.p ? d.p['l:' + s.id] : null; if (p && p.e > t) t = p.e; } catch (e) {}
    return t || s.created || 0;
  }
  function paintList() {
    const L = $('swList'), C = LC(), ss = songs(), cur = song(), f = STS.includes(D.f) ? D.f : '';
    const rows = ss.filter(s => !f || stOf(s) === f).map(s => ({ s, t: changed(s) })).sort((a, b) => b.t - a.t);
    L.innerHTML = '<div class="sw-lh"><b>' + esc(u('listH')) + '</b><span class="caption">' + ss.length + '</span><div class="sw-lf" role="group">'
      + ['', ...STS].map(k => '<button type="button" class="toggle-btn' + (k === f ? ' active' : '') + '" data-f="' + k + '" aria-pressed="' + (k === f) + '">' + esc(k ? stName(k) : u('all')) + (k ? ' <small>' + ss.filter(s => stOf(s) === k).length + '</small>' : '') + '</button>').join('') + '</div></div>'
      + (!ss.length ? '<p class="caption">' + esc(u('none')) + '</p>' : !rows.length ? '<p class="caption">' + esc(u('noHit')) + '</p>'
        : '<div class="sw-rows" role="list">' + rows.map(({ s, t }) => {
          const v = s.versions[s.cur] || s.versions[s.versions.length - 1], key = v && C && C.keyLabel ? C.keyLabel(v.key) : '';
          return '<button type="button" role="listitem" class="sw-row' + (cur && cur.id === s.id ? ' on' : '') + '" data-id="' + esc(s.id) + '"><span class="sw-rn" translate="no">' + esc(s.name) + '</span>'
            + '<span class="sw-badge st-' + stOf(s) + '">' + esc(stName(stOf(s))) + '</span><span class="sw-rm">' + esc(u('wf')) + ' ' + wfDone(s.id) + '/11 · ' + esc(key) + ' · ' + (v ? v.parts.length : 0) + ' ' + esc(u('parts')) + ' · ' + esc(u('ch')) + ' ' + fmtD(t) + '</span></button>';
        }).join('') + '</div>');
  }
  $('swListB').addEventListener('click', () => {
    const L = $('swList'), on = L.hidden; L.hidden = !on; const b = $('swListB'); b.setAttribute('aria-expanded', String(on)); b.classList.toggle('active', on);
    if (on) paintList();
  });
  $('swList').addEventListener('click', e => {
    const f = e.target.closest('[data-f]'); if (f) { D.f = f.dataset.f; store(); paintList(); return; }
    const r = e.target.closest('.sw-row'); if (!r) return;
    const sel = $('ldSong'); if (!sel) return;
    sel.value = r.dataset.id; sel.dispatchEvent(new Event('change', { bubbles: true }));   // gleicher Weg wie die Songauswahl oben
    $('swList').hidden = true; $('swListB').setAttribute('aria-expanded', 'false'); $('swListB').classList.remove('active');
  });

  /* ---------- Ins Songbook übernehmen (gleiche Funktion wie Workflow-Schritt 11) ---------- */
  $('swSb').addEventListener('click', () => {
    const s = song(), v = ver(); if (!s) { say(u('noSong')); return; } if (!v || !v.parts.length) { say(u('noParts')); return; }
    stLoad(() => Songtext.go('songbook'));
  });

  // zuletzt geändert: Eingaben im Songwriting (Text, Thema, Tempo …) merken
  panel.addEventListener('input', () => { const s = song(); if (s) { D.m[s.id] = Date.now(); storeSoon(); } }, true);
  panel.addEventListener('change', e => { if (e.target && e.target.id === 'ldSong') return; const s = song(); if (s) { D.m[s.id] = Date.now(); storeSoon(); } }, true);

  /* ---------- Summ-Idee je Abschnitt (Karte „Text“) ---------- */
  let R = null, Pl = null, rT = 0;
  const hk = (sid, pid) => sid + ':' + pid;
  const fmtS = x => (Math.round(x * 10) / 10).toString().replace('.', EN() ? '.' : ',');
  function hums() {
    const s = song(); if (!s) return;
    document.querySelectorAll('#ldTexts .ld-tx[data-n="0"]').forEach(box => {
      const pid = box.dataset.id, h = D.h[hk(s.id, pid)], head = box.querySelector('.ld-txh'); if (!head) return;
      let w = head.querySelector('.sw-hum'); if (!w) { w = document.createElement('span'); w.className = 'sw-hum'; head.appendChild(w); }
      const recNow = R && R.sid === s.id && R.pid === pid, playNow = Pl && Pl.k === hk(s.id, pid);
      const html = recNow ? '<button type="button" class="toggle-btn sw-hb rec" data-h="stop">' + esc(u('humStop')) + ' · ' + fmtS(R.n / R.sr) + ' s</button>'
        : h ? '<button type="button" class="toggle-btn sw-hb" data-h="play" aria-label="' + esc(tx(U.humT).replace('%s', box.querySelector('.ld-txh b') ? box.querySelector('.ld-txh b').textContent : '')) + '">' + (playNow ? '■' : '▶') + ' ' + fmtS(h.s) + ' s</button><button type="button" class="toggle-btn sw-hb" data-h="del">' + esc(u('humDel')) + '</button>'
        : '<button type="button" class="toggle-btn sw-hb" data-h="rec"' + (R ? ' disabled' : '') + '>' + esc(u('hum')) + '</button>';
      if (w.dataset.h !== html) { w.innerHTML = html; w.dataset.h = html; }
    });
  }
  const partName = pid => { const v = ver(), p = v && v.parts.find(x => x.id === pid); return p ? p.name : ''; };
  async function recStart(pid) {
    const s = song(); if (R || !s) return; stopPlay();
    if (typeof Looper === 'undefined' || !Looper.openInput) { say(u('humMic')); return; }
    say(u('humHp'));
    let ok = false; try { ok = await Looper.openInput(); } catch (e) { ok = false; }
    const an = ok && Looper.inputAnalyser(); if (!an) { say(u('humMic')); return; }
    const ctx = audioCtx, sp = ctx.createScriptProcessor(4096, 1, 1), z = ctx.createGain(); z.gain.value = 0;
    an.connect(sp); sp.connect(z); z.connect(ctx.destination);
    R = { sid: s.id, pid, sp, z, an, ch: [], n: 0, sr: ctx.sampleRate, max: ctx.sampleRate * MAXS };
    sp.onaudioprocess = e => { const r = R; if (!r) return; const d = e.inputBuffer.getChannelData(0); r.ch.push(new Float32Array(d)); r.n += d.length; if (r.n >= r.max) recStop(false, true); };
    rT = setInterval(hums, 250); hums();
  }
  // mono, 16 kHz (Mittelwert je Zielprobe = einfacher Tiefpass), 16 Bit – 30 s ≈ 0,9 MB
  function down(l, sr) {
    const q = sr / HSR, n = Math.floor(l.length / q), o = new Int16Array(n);
    for (let i = 0; i < n; i++) { const a = Math.floor(i * q), b = Math.max(a + 1, Math.floor((i + 1) * q)); let m = 0; for (let j = a; j < b; j++) m += l[j]; m /= (b - a); m = Math.max(-1, Math.min(1, m)); o[i] = m < 0 ? m * 32768 : m * 32767; }
    return o;
  }
  async function recStop(drop, max) {
    const r = R; if (!r) return; R = null; clearInterval(rT); rT = 0;
    try { r.sp.onaudioprocess = null; r.an.disconnect(r.sp); r.sp.disconnect(); r.z.disconnect(); } catch (e) {}
    try { Looper.releaseAnalyser(); } catch (e) {}
    if (drop) { hums(); return; }
    if (r.n < r.sr * 0.5) { say(u('humShort')); hums(); return; }
    const l = new Float32Array(Math.min(r.n, r.max)); let o = 0; for (const c of r.ch) { if (o >= l.length) break; l.set(c.subarray(0, l.length - o), o); o += c.length; }
    const pcm = down(l, r.sr), sec = pcm.length / HSR;
    try { await AppDB.put('meta', { key: 'lied-hum:' + hk(r.sid, r.pid), sr: HSR, n: pcm.length, l: pcm, at: Date.now() }); }
    catch (e) { say(u('humFail')); hums(); return; }
    D.h[hk(r.sid, r.pid)] = { s: Math.round(sec * 10) / 10, at: Date.now() }; D.m[r.sid] = Date.now(); store();
    say((max ? u('humMax') + ' ' : '') + u('humOk').replace('%s', partName(r.pid)).replace('%t', fmtS(sec))); hums();
  }
  function stopPlay() { if (Pl) { try { Pl.src.onended = null; Pl.src.stop(); Pl.src.disconnect(); } catch (e) {} Pl = null; hums(); } }
  async function play(k) {
    if (Pl && Pl.k === k) { stopPlay(); return; } stopPlay();
    let rec = null; try { rec = await AppDB.get('meta', 'lied-hum:' + k); } catch (e) {}
    if (!rec || !rec.l) { say(u('humGone')); return; }
    if (typeof ensureAudio === 'function') ensureAudio();
    const ctx = audioCtx, sr = ctx.sampleRate, q = rec.sr / sr, n = Math.floor(rec.n / q), b = ctx.createBuffer(1, Math.max(1, n), sr), d = b.getChannelData(0), x = rec.l;
    for (let i = 0; i < n; i++) { const p = i * q, a = Math.floor(p), f = p - a; d[i] = ((x[a] || 0) * (1 - f) + (x[a + 1] || 0) * f) / 32768; }   // zurück auf die Rate des Geräts (linear)
    const src = ctx.createBufferSource(); src.buffer = b;
    src.connect(typeof ensureMasterBus === 'function' ? ensureMasterBus() : ctx.destination);
    src.onended = () => { if (Pl && Pl.src === src) { Pl = null; hums(); } };
    Pl = { k, src }; src.start(); hums();
  }
  $('ldTexts').addEventListener('click', e => {
    const b = e.target.closest('[data-h]'); if (!b || b.disabled) return;
    const s = song(), box = b.closest('.ld-tx'); if (!s || !box) return;
    const pid = box.dataset.id, k = hk(s.id, pid);
    if (b.dataset.h === 'rec') recStart(pid);
    else if (b.dataset.h === 'stop') recStop();
    else if (b.dataset.h === 'play') play(k);
    else if (b.dataset.h === 'del') {
      if (!confirm(tx(U.humDelQ).replace('%s', partName(pid)))) return;
      if (Pl && Pl.k === k) stopPlay();
      AppDB.del('meta', 'lied-hum:' + k).catch(() => {}); delete D.h[k]; store(); hums();
    }
  });
  // Summ-Ideen gelöschter Songs aufräumen (nur Index + eigener Schlüssel; Aufnahmen der Teile bleiben Sache von lied.js)
  function sweep() {
    const ids = new Set(songs().map(s => s.id)); let n = 0;
    Object.keys(D.h).forEach(k => { if (!ids.has(k.split(':')[0])) { delete D.h[k]; n++; if (typeof AppDB !== 'undefined') AppDB.del('meta', 'lied-hum:' + k).catch(() => {}); } });
    if (n) store();
  }

  /* ---------- Silben-Raster (silbenraster.js, erst bei Bedarf) ---------- */
  function raster(host) { if (!host) return; js('silbenraster.js', () => !!window.SilbenRaster, () => SilbenRaster.render(host, { D, store, song, ver, esc, tx, EN })); }

  /* ---------- Nachziehen ---------- */
  function onRender() {
    tiles(); sweep(); hums();
    if (!$('swList').hidden) paintList();
    if (ST_AREAS.includes(D.a) && window.Songtext) Songtext.sync();
    if (D.a === 'tw' && window.SilbenRaster) SilbenRaster.refresh();
  }
  // Wechsel von Song, Version oder Inhalt aus „Songtext schreiben“ (Vorlage, Notiz, Beispiel) → Songwriting oben neu zeichnen
  (() => {
    const A = LA(); if (!A) return; let t = 0;
    ['select', 'newSong', 'pushVersion'].forEach(f => { const o = A[f]; if (typeof o !== 'function') return; A[f] = function () { const r = o.apply(this, arguments); clearTimeout(t); t = setTimeout(() => { if (window.AppNav && AppNav.current() === 'lied') A.render(); }, 0); return r; }; });
  })();
  function open() {
    const w = window.__swWant; window.__swWant = null;
    area(w || D.a || 'song');
    tiles(); hums();
  }
  document.addEventListener('tabchange', e => {
    if (e.detail === 'lied') { D = load(); open(); }
    else { if (sT) store(); if (R) recStop(); stopPlay(); }
  });
  if (window.AppNav && AppNav.current() === 'lied') open();
  return { area, mark, open, onRender, raster, tiles, paintList, _st: () => ({ a: D.a, rec: !!R, play: !!Pl, h: Object.assign({}, D.h), f: D.f }), _stop: () => recStop() };
})();
