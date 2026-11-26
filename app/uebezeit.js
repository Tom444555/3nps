/* ---------- v154: Übezeit (Teil A: Tracking-Kern) ----------
   Schalter „Üben: An / Aus“ (Kopfleiste + Seite „Lernen › Übezeit“), „Was übe ich?“ (Themen), Import aus Numbers (ZIP/CSV),
   CSV-Export im Numbers-Format, „Import entfernen“, Liste „Letzte Einheiten“ (Ändern/Löschen), Summen.
   Speicher: localStorage „3nps-uebezeit“ – EIN Schlüssel für Laufzustand und Einheiten, damit jedes Schreiben atomar ist
   (Ausschalten = Einheit dazu + Laufzustand weg in einem setItem; ein Absturz verliert und doppelt nichts).
   Format v1 (Teil B liest nur):
     { v: 1, run: null | { s: Start (ms) }, th: gewähltes Thema ('' = ohne), nt: Notiz,
       u: [[ende_s, dauer_s, herkunft (0 = selbst gezählt, 1 = Import, 2 = nachgetragen), thema, notiz], …] }
   v157: optional u[5] = Kennzeichen einer Aufteilung (Abschnitte einer Einheit, nahtlos; aufteilen/aufheben in uebezeit-ansicht.js).
   v155: Export kennzeichnet Herkunft 0/2 in „Übungen“ mit „[App]“ bzw. „[nachgetragen]“, der Import stellt sie wieder her.   – nach Ende sortiert, Minutengenau
   v160: Herkunft 3 = Looper-Zeit (Export „[Looper]“). Zusätzlich lp: null | { s: Beginn, a: Summe abgeschlossener Läufe (ms), r: Beginn des
   laufenden Laufs | null, l: letzter sicherer Zeitpunkt } (ms) und lz: 0 = „Looper-Zeit mitzählen“ aus (fehlt = an).
   Themen: „3nps-uebezeit-themen“ { c: [[id, name], …] eigene, r: { id: neuer Name }, h: [ausgeblendete ids] }.
   Beim Start: nur Kopfknopf (ein getItem); die Seite wird erst beim ersten Öffnen gebaut. Keine Timer außer der Minutenanzeige bei laufender Zeit. */
window.Uebezeit = (() => {
  const KEY = '3nps-uebezeit', TKEY = '3nps-uebezeit-themen', H8 = 8 * 3600e3;
  const TT = s => (typeof T === 'function' ? T(s) : s), $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEF = [['tech', 'Technik'], ['tl', 'Tonleitern/Pentatonik'], ['ak', 'Akkorde/Rhythmus'], ['imp', 'Improvisation'], ['song', 'Songs'],
    ['loop', 'Looper/Jammen'], ['ges', 'Gesang'], ['th', 'Theorie'], ['frei', 'Frei']];
  const blank = () => ({ v: 1, run: null, th: '', nt: '', u: [] });
  // immer frisch lesen (zweites Fenster, „Sicherung laden“) und gleich wieder schreiben
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.u)) return Object.assign(blank(), d); } catch (e) {}
    return blank();
  }
  function store(d) {
    d.u.sort((a, b) => a[0] - b[0]);
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { say(TT('Konnte nicht speichern – Speicher voll oder privates Surfen.'), true); return false; }
  }
  function topics() { try { const t = JSON.parse(localStorage.getItem(TKEY) || 'null'); if (t) return { c: t.c || [], r: t.r || {}, h: t.h || [] }; } catch (e) {} return { c: [], r: {}, h: [] }; }
  const tsave = t => { try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch (e) {} };
  function tname(id, t) {
    if (!id) return TT('ohne Thema');
    t = t || topics();
    if (t.r[id]) return t.r[id];
    const c = t.c.find(x => x[0] === id); if (c) return c[1];
    const d = DEF.find(x => x[0] === id); return d ? TT(d[1]) : id;
  }
  const tlist = t => DEF.map(x => x[0]).concat(t.c.map(x => x[0]));
  // Minuten-Raster wie in Numbers: Start und Ende auf volle Minuten, damit Export → Import dieselben Schlüssel ergibt
  const minR = ms => Math.round(ms / 60000) * 60;
  function unitFrom(s, e, d0) {
    if (e - s < 60000) return null;   // unter 1 Minute wird nicht gespeichert
    const b = minR(e), dur = Math.max(1, Math.round((e - s) / 60000)) * 60;   // Dauer auf ganze Minuten, Ende auf volle Minute (Start = Ende − Dauer)
    return [b, dur, 0, d0.th || '', (d0.nt || '').trim()];
  }

  /* ---------- Formate ---------- */
  const p2 = n => String(n).padStart(2, '0');
  const fmtHM = sec => { const m = Math.round(sec / 60), h = Math.floor(m / 60); return h ? h + ' h ' + p2(m % 60) + ' min' : m + ' min'; };
  const clock = ms => { const m = Math.floor(ms / 60000); return Math.floor(m / 60) + ':' + p2(m % 60); };
  const hhmm = t => { const d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const loc = () => (window.__lang === 'en' ? 'en-GB' : 'de-DE');
  const dday = t => new Date(t).toLocaleDateString(loc(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const numDate = t => { const d = new Date(t); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const ymd = t => { const d = new Date(t); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const at = (date, time) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''), h = /^(\d{1,2}):(\d{2})/.exec(time || ''); if (!m || !h) return null; return new Date(+m[1], +m[2] - 1, +m[3], +h[1], +h[2]).getTime(); };
  const durTxt = sec => { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.round(sec % 60); const o = []; if (h) o.push(h + 'h'); if (m) o.push(m + 'm'); if (s) o.push(s + 's'); return o.join(' ') || '0ms'; };

  /* ---------- Schalter ---------- */
  let tick = null, lastE = 0;
  function on() {
    const d = load(); if (d.run) return true;
    const now = Date.now(); lpClose(d, now); const lu = lpEnd(d);   // v160: Looper-Einheit endet jetzt, ab hier zählt nur der Schalter
    d.run = { s: now };
    const ok = store(d); lpSched(d); if (lu) changed(); else paintAll(); return ok;
  }
  // Ausschalten: Einheit schreiben und Laufzustand löschen – in einem Schreibvorgang. opt.end/opt.dur korrigieren (Nachfrage > 8 h).
  function off(opt) {
    opt = opt || {};
    const d = load(); if (!d.run) return null;
    const now = Date.now(), s = d.run.s;
    if (now - s > H8 && !opt.ok && !opt.drop) { ask8(s, now); return 'ask'; }
    let e = opt.dur != null ? s + opt.dur * 1000 : now;
    const u = opt.drop ? null : unitFrom(s, e, d);
    if (u) { d.u.push(u); lastE = u[0]; }
    d.run = null; d.nt = '';
    if (lzOn(d) && looping()) d.lp = { s: now, a: 0, r: now, l: now };   // v160: läuft der Looper, beginnt ab jetzt eine Looper-Einheit
    if (!store(d)) return null;
    lpSched(d);
    say(u ? TT('Gespeichert:') + ' ' + fmtHM(u[1]) + (u[3] ? ' · ' + tname(u[3]) : '') : opt.drop ? TT('Verworfen.') : TT('Unter 1 Minute – nicht gespeichert.'));
    changed(); return u;
  }
  const toggle = () => (load().run ? off() : on());
  // Thema wählen; läuft die Zeit, endet der Abschnitt jetzt und der nächste beginnt am selben Zeitpunkt (ein Schreibvorgang)
  function setTopic(id) {
    const d = load(); id = id || '';
    if (d.th === id) return;
    if (d.run) {
      const now = Date.now();
      if (now - d.run.s >= 60000) { const u = unitFrom(d.run.s, now, d); if (u) { d.u.push(u); d.run.s = now; } }
    }
    d.th = id; store(d); changed();
  }
  function setNote(v) { const d = load(); d.nt = String(v || '').slice(0, 300); store(d); }

  /* ---------- v160: Looper-Zeit – zählt nur, wenn „Üben“ aus ist und der Looper läuft (Wiedergabe/Aufnahme); nie doppelt ----------
     Hängt nur am Ereignis „looperrun“ (Start/Stopp aus looper.js update()), an Sichtbarkeit/Schließen und einem Zwischenstand alle 30 s.
     Kürzer als 1 min wird verworfen; Pausen bis 2 min gehören zur selben Einheit (Dauer = Summe der Laufzeiten). App im Hintergrund,
     geschlossen oder abgestürzt: der Lauf endet beim letzten sicheren Zeitpunkt (Zwischenstand bzw. Schließen). Jede Änderung = ein setItem. */
  const LP_MIN = 60e3, LP_GAP = 120e3, LP_TICK = 30e3, LP_LOST = 90e3, LP_TH = 'loop';
  let lpT = null;
  const lzOn = d => d.lz !== 0;
  const looping = () => !document.hidden && typeof Looper !== 'undefined' && !!(Looper.looping && Looper.looping());
  function lpClose(d, now) { const p = d.lp; if (p && p.r != null) { p.a += Math.max(0, now - p.r); p.r = null; p.l = now; } }
  function lpEnd(d) {   // Einheit (ab 1 min) übernehmen und Laufzustand löschen – im selben Schreibvorgang wie der Aufrufer
    const p = d.lp; d.lp = null;
    if (!p || p.a < LP_MIN) return null;
    const u = [minR(p.l), Math.max(1, Math.round(p.a / 60000)) * 60, 3, LP_TH, '']; d.u.push(u); return u;
  }
  function lpSync(boot) {
    const d = load(), now = Date.now(), want = lzOn(d) && !d.run && looping();
    let p = d.lp, ch = false, u = null;
    if (p && p.r != null && (boot === true || now - p.l > LP_LOST)) { p.a += Math.max(0, p.l - p.r); p.r = null; ch = true; }   // App war weg: Ende beim letzten sicheren Zeitpunkt
    if (p && p.r != null && !want) { lpClose(d, now); ch = true; }
    if (p && p.r == null && (d.run || !lzOn(d) || now - p.l > LP_GAP)) { u = lpEnd(d); p = null; ch = true; }
    if (want) {
      if (!p) { d.lp = { s: now, a: 0, r: now, l: now }; ch = true; }
      else if (p.r == null) { p.r = now; p.l = now; ch = true; }   // Pause ≤ 2 min: dieselbe Einheit
      else if (now - p.l >= LP_TICK - 2000) { p.l = now; ch = true; }   // Zwischenstand
    }
    if (ch) store(d);
    lpSched(d);
    if (u) changed(); else if (ch && built) paintLz(d);
    return d.lp;
  }
  function lpSched(d) {
    clearTimeout(lpT); lpT = null; const p = d.lp; if (!p) { if (built) paintLz(d); return; }
    lpT = setTimeout(lpSync, p.r != null ? LP_TICK : Math.max(1000, p.l + LP_GAP - Date.now() + 500));
  }
  function setLz(v) {
    const d = load(), now = Date.now(); let u = null;
    if (v) delete d.lz; else { lpClose(d, now); u = lpEnd(d); d.lz = 0; }
    store(d);
    if (v) lpSync(); else lpSched(d);
    if (u) changed(); else if (built) paintLz(load());
  }
  function paintLz(d) {
    const b = $('uzLz'); if (!b) return; const on = lzOn(d), p = d.lp;
    b.textContent = TT(on ? 'Looper-Zeit mitzählen: An' : 'Looper-Zeit mitzählen: Aus'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const run = p && p.r != null, sec = p ? (p.a + (run ? Date.now() - p.r : 0)) / 1000 : 0;
    $('uzLzTx').textContent = !on ? TT('Looper-Spielen wird nicht gezählt.')
      : p ? (run ? '● ' + TT('Looper läuft – zählt mit') : TT('Looper pausiert – läuft er innerhalb von 2 min weiter, zählt es zur selben Einheit')) + ' · ' + TT('seit') + ' ' + hhmm(p.s) + ' · ' + Math.floor(sec / 60) + ' min'
      : TT('Zählt, wenn der Looper läuft und „Üben“ aus ist (ab 1 min; Pausen bis 2 min gehören zur selben Einheit).');
  }

  // Kopfknopf + Anzeige; Auffrischen höchstens 1×/min und nur bei sichtbarer Seite
  function paintHdr(d) {
    const b = $('uebenBtn'); if (!b) return;
    const run = d.run, txt = run ? '● ' + clock(Date.now() - run.s) : TT('Üben');
    if (b.textContent !== txt) b.textContent = txt;
    b.setAttribute('aria-pressed', run ? 'true' : 'false');
    b.title = run ? TT('Üben läuft seit') + ' ' + hhmm(run.s) + ' – ' + TT('antippen zum Ausschalten') : TT('Üben: An / Aus – zählt deine Übezeit');
  }
  function paintAll() {
    const d = load();
    paintHdr(d); if (built) { paintRun(d); paintLz(d); }
    clearTimeout(tick); tick = null;
    if (d.run && !document.hidden) tick = setTimeout(paintAll, 60000 - (Date.now() - d.run.s) % 60000 + 50);
  }

  /* ---------- Import (ZIP/CSV aus Numbers) ---------- */
  async function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf), out = [];
    let p = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { p = i; break; }
    if (p < 0) throw new Error('zip');
    const n = dv.getUint16(p + 10, true); let c = dv.getUint32(p + 16, true);
    const utf = new TextDecoder('utf-8');
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(c, true) !== 0x02014b50) break;
      const meth = dv.getUint16(c + 10, true), csz = dv.getUint32(c + 20, true), nl = dv.getUint16(c + 28, true), xl = dv.getUint16(c + 30, true), cl = dv.getUint16(c + 32, true), lo = dv.getUint32(c + 42, true);
      const name = utf.decode(u8.subarray(c + 46, c + 46 + nl)); c += 46 + nl + xl + cl;
      if (!/\.csv$/i.test(name) || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
      const st = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u8.subarray(st, st + csz);
      let data;
      if (meth === 0) data = raw;
      else if (meth === 8 && typeof DecompressionStream === 'function') data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else continue;
      out.push({ name, text: utf.decode(data) });
    }
    return out;
  }
  function csvRows(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ';') { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  const isLog = r => r && r.length >= 3 && /start\/ende/i.test(r[1] || '') && /übungszeit/i.test(r[2] || '');
  function parseDur(s) {
    let t = 0, any = false;
    String(s).replace(/(\d+(?:[.,]\d+)?)\s*(ms|h|m|s)\b/g, (_, v, u) => { any = true; t += parseFloat(v.replace(',', '.')) * { h: 3600, m: 60, s: 1, ms: 0.001 }[u]; });
    return any ? Math.round(t) : null;
  }
  function parseDate(s) {
    const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s+(\d{1,2}):(\d{2})/.exec(s || ''); if (!m) return null;
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3], t = new Date(y, +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
    return isNaN(t) ? null : t;
  }
  // „Thema – Notiz“ (eigener Export) → Thema wiedererkennen, sonst alles als Notiz
  function splitNote(txt, t) {
    txt = (txt || '').trim(); if (!txt) return ['', ''];
    const names = new Map();
    tlist(t).forEach(id => { names.set(tname(id, t).toLowerCase(), id); const d = DEF.find(x => x[0] === id); if (d) { names.set(d[1].toLowerCase(), id); if (window.__EN && __EN[d[1]]) names.set(__EN[d[1]].toLowerCase(), id); } });
    const i = txt.indexOf(' – '), head = (i >= 0 ? txt.slice(0, i) : txt).trim().toLowerCase();
    if (names.has(head)) return [names.get(head), i >= 0 ? txt.slice(i + 3).trim() : ''];
    return ['', txt];
  }
  function parseLog(rows, t) {
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r || (r[1] || '').trim() !== 'Ende') continue;
      const e = parseDate(r[0]), d = parseDur(r[2]);
      if (e == null || d == null) continue;
      const mk = /\s*\[(App|nachgetragen|Looper)\]\s*$/.exec(r[3] || ''), txt = mk ? (r[3] || '').slice(0, mk.index) : r[3];
      const [th, nt] = splitNote(txt, t);
      out.push([Math.round(e / 1000), d, mk ? (mk[1] === 'App' ? 0 : mk[1] === 'Looper' ? 3 : 2) : 1, th, nt]);
    }
    return out;
  }
  async function importFile(file) {
    const buf = await file.arrayBuffer(), u8 = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    let files;
    if (u8[0] === 0x50 && u8[1] === 0x4b) files = await unzip(buf);
    else files = [{ name: file.name, text: new TextDecoder('utf-8').decode(buf) }];
    const t = topics(); let units = [];
    files.forEach(f => { const rows = csvRows(f.text); if (isLog(rows[0])) units = units.concat(parseLog(rows, t)); });
    if (!units.length) return { err: TT('Keine Übungs-Tabelle gefunden (Kopfzeile „Datum und Uhrzeit;Start/Ende;Übungszeit;Übungen“).') };
    const d = load(), have = new Set(d.u.map(x => x[0] + '|' + x[1]));
    let n = 0, dup = 0, sec = 0, a = Infinity, b = -Infinity;
    units.forEach(u => {
      const k = u[0] + '|' + u[1];   // Herkunft zählt nicht zum Schlüssel
      if (have.has(k)) { dup++; return; }
      have.add(k); d.u.push(u); n++; sec += u[1]; a = Math.min(a, u[0]); b = Math.max(b, u[0]);
    });
    if (n && !store(d)) return { err: TT('Konnte nicht speichern – Speicher voll oder privates Surfen.') };
    changed();
    return { n, dup, sec, a: a * 1000, b: b * 1000 };
  }
  function importMsg(r) {
    if (r.err) return r.err;
    const f = t => new Date(t).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' });
    return (r.n ? r.n + ' ' + TT(r.n === 1 ? 'Einheit' : 'Einheiten') + ', ' + fmtHM(r.sec) + ', ' + TT('von') + ' ' + f(r.a) + ' ' + TT('bis') + ' ' + f(r.b) + ' ' + TT('übernommen')
      : TT('Nichts Neues übernommen')) + ' (' + r.dup + ' ' + TT('schon vorhanden') + ').';
  }
  function removeImport() {
    const d = load(), n = d.u.length; d.u = d.u.filter(x => x[2] !== 1);
    const k = n - d.u.length; if (k) { store(d); changed(); } return k;
  }

  /* ---------- Export (Numbers-Format) ---------- */
  function csv() {
    const d = load(), t = topics(), q = v => /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const L = ['Datum und Uhrzeit;Start/Ende;Übungszeit;Übungen'];
    d.u.forEach(u => {
      const e = u[0] * 1000, mk = u[2] === 0 ? '[App]' : u[2] === 2 ? '[nachgetragen]' : u[2] === 3 ? '[Looper]' : '';
      let txt = u[3] ? tname(u[3], t) + (u[4] ? ' – ' + u[4] : '') : (u[4] || '');
      if (mk) txt = txt ? txt + ' ' + mk : mk;
      L.push(numDate(e - u[1] * 1000) + ';Start;!!;');
      L.push(numDate(e) + ';Ende;' + durTxt(u[1]) + ';' + q(txt));
    });
    return '﻿' + L.join('\n') + '\n';
  }
  async function exportCsv() {
    const d = new Date(), name = 'Uebezeit-' + d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '.csv';
    const file = new File([csv()], name, { type: 'text/csv' });
    window.__uzLastExport = file;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }

  /* ---------- Summen + Zusammenführen für den Verlauf (v152) ---------- */
  function sums(d, now) {
    const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    const day = t0.getTime(), wk = new Date(t0); wk.setDate(wk.getDate() - (wk.getDay() + 6) % 7);
    const mo = new Date(t0.getFullYear(), t0.getMonth(), 1).getTime(), yr = new Date(t0.getFullYear(), 0, 1).getTime();
    const r = { heute: 0, woche: 0, monat: 0, jahr: 0, gesamt: 0, n: d.u.length, first: d.u.length ? d.u[0][0] * 1000 : null };
    d.u.forEach(u => { const e = u[0] * 1000, s = u[1]; r.gesamt += s; if (e >= yr) r.jahr += s; if (e >= mo) r.monat += s; if (e >= wk.getTime()) r.woche += s; if (e >= day) r.heute += s; });
    return r;
  }
  // Übezeit-Einheiten als Einträge wie im Übungslog (ts = Ende, kein Tempo). Metronom-Einheiten, die in einer
  // selbst gezählten Übezeit liegen, zählen dort schon – ihre Zeit wird nicht doppelt gerechnet (Tempo bleibt).
  function merge(sessions) {
    const d = load(); if (!d.u.length) return sessions || [];
    const iv = d.u.filter(u => u[2] === 0 || u[2] === 3).map(u => [u[0] * 1000 - u[1] * 1000 - 60000, u[0] * 1000 + 60000]);
    const inside = ts => iv.some(x => ts >= x[0] && ts <= x[1]);
    const out = (sessions || []).map(s => (+s.durationSec > 0 && inside(s.ts) ? Object.assign({}, s, { durationSec: 0 }) : s));
    d.u.forEach(u => out.push({ ts: u[0] * 1000, durationSec: u[1], uz: 1 }));
    return out;
  }

  /* ---------- Seite „Übezeit“ (erst beim ersten Öffnen) ---------- */
  let built = false, page = 0, editIdx = null, msgT = null;
  const PER = 12;
  function say(txt, bad) {
    const m = $('uzMsg'); if (!m) return;
    m.textContent = txt; m.classList.toggle('bad', !!bad);
    clearTimeout(msgT); msgT = setTimeout(() => { if (m.textContent === txt) m.textContent = ''; }, 9000);
  }
  function build() {
    const root = $('uzRoot'); if (!root || built) return; built = true;
    if (window.UebezeitAnsicht || document.querySelector('link[href="uebezeit-ansicht.css"]')) root.classList.add('uz-css'); else loadViz();
    const card = (cls, id, h, body) => '<div class="card uz-card ' + cls + '"' + (id ? ' id="' + id + '"' : '') + '><div class="card-head"><h2>' + esc(TT(h)) + '</h2></div>' + body + '</div>';
    root.innerHTML =
      '<div class="card uz-card uz-sw"><div class="card-head"><h2>' + esc(TT('Übezeit')) + '</h2><button type="button" class="toggle-btn uz-addb" id="uzAddBtn">＋ ' + esc(TT('Einheit nachtragen')) + '</button></div>'
      + '<div class="uz-top"><button type="button" class="uz-btn" id="uzBtn" aria-pressed="false">' + esc(TT('Üben: Aus')) + '</button>'
      + '<div class="uz-now"><div class="uz-time" id="uzTime">0:00</div><div class="caption" id="uzSince"></div></div></div>'
      + '<div class="uz-lbl">' + esc(TT('Was übe ich?')) + '</div><div class="uz-chips" id="uzChips"></div>'
      + '<div class="uz-edit" id="uzEdit" hidden></div>'
      + '<label class="field uz-note"><span>' + esc(TT('Notiz (optional)')) + '</span><input type="text" id="uzNote" maxlength="300" autocomplete="off" placeholder="' + esc(TT('z. B. Pentatonik Lage 1')) + '"></label>'
      + '<p class="caption uz-msg" id="uzMsg" role="status"></p>'
      + '<div class="uz-lz"><button type="button" class="toggle-btn" id="uzLz" aria-pressed="true"></button><span class="caption" id="uzLzTx"></span></div></div>'
      // v155: Übersicht (Kacheln, Verlauf, Balken, Kalender, Themen) – gezeichnet von uebezeit-ansicht.js
      + card('uz-kpic', 'uzKpiCard', 'Überblick', '<div class="uz-sums" id="uzSums"></div><div class="uz-sums uz-kpi2" id="uzKpi2"></div><p class="caption" id="uzSumN"></p>')
      + card('uz-viz uz-full', 'uzVerlauf', 'Verlauf', '<div id="uzVl"></div>')
      + card('uz-viz', 'uzWann', 'Wann geübt', '<div id="uzWn"></div>')
      + card('uz-viz', 'uzMonate', 'Monate und Jahre', '<div id="uzMj"></div>')
      + card('uz-viz uz-full', 'uzKal', 'Kalender', '<div id="uzKl"></div>')
      + card('uz-viz uz-full', 'uzThemen', 'Woran geübt', '<div id="uzTh"></div>')
      + '<div class="card uz-card uz-full" id="uzListCard"><div class="card-head"><h2>' + esc(TT('Letzte Einheiten')) + '</h2></div><div class="uz-list" id="uzList"></div>'
      + '<div class="uz-pg" id="uzPg"><button type="button" class="toggle-btn" id="uzNewer">‹ ' + esc(TT('Neuere')) + '</button><span class="caption" id="uzPgN"></span><button type="button" class="toggle-btn" id="uzOlder">' + esc(TT('Ältere')) + ' ›</button></div></div>'
      + '<div class="card uz-card uz-full" id="uzDaten"><div class="card-head"><h2>' + esc(TT('Daten')) + '</h2></div><div class="uz-data">'
      + '<button type="button" class="toggle-btn" id="uzImp">' + esc(TT('Übezeit importieren …')) + '</button><input type="file" id="uzFile" accept=".zip,.csv,text/csv,application/zip" hidden>'
      + '<button type="button" class="toggle-btn" id="uzExp">' + esc(TT('Als CSV exportieren')) + '</button>'
      + '<button type="button" class="toggle-btn" id="uzRm">' + esc(TT('Import entfernen')) + '</button></div>'
      + '<p class="caption uz-msg" id="uzDataMsg" role="status"></p>'
      + '<p class="caption">' + esc(TT('Import: die ZIP-Datei aus Numbers („Exportieren › CSV“) direkt wählen oder eine einzelne CSV. Gezählt wird jede „Ende“-Zeile; schon vorhandene Einheiten werden nicht doppelt übernommen. Der Export hat dasselbe Format und lässt sich hier wieder einlesen. „Alles sichern“ im Looper nimmt die Übezeit mit.')) + '</p></div>';
    $('uzAddBtn').addEventListener('click', () => addForm());
    $('uzBtn').addEventListener('click', toggle);
    $('uzLz').addEventListener('click', () => setLz(!lzOn(load())));
    $('uzNote').addEventListener('input', e => setNote(e.target.value));
    $('uzChips').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.th != null) setTopic(b.dataset.th);
      else if (b.id === 'uzThEdit') { const ed = $('uzEdit'); ed.hidden = !ed.hidden; paintEdit(); paintChips(); if (!ed.hidden) { const i = $('uzThNew'); if (i) i.focus(); } }
    });
    $('uzEdit').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const t = topics();
      if (b.id === 'uzThAdd') {
        const v = ($('uzThNew').value || '').trim().slice(0, 40); if (!v) return;
        const id = 'c' + Date.now().toString(36); t.c.push([id, v]); tsave(t); $('uzThNew').value = ''; paintEdit(); paintChips();
      } else if (b.dataset.hide) { const id = b.dataset.hide, i = t.h.indexOf(id); if (i >= 0) t.h.splice(i, 1); else t.h.push(id); tsave(t); paintEdit(); paintChips(); }
    });
    $('uzEdit').addEventListener('change', e => {
      const i = e.target.closest('input[data-ren]'); if (!i) return; const t = topics(), id = i.dataset.ren, v = i.value.trim().slice(0, 40);
      const c = t.c.find(x => x[0] === id);
      if (c) { if (v) c[1] = v; } else if (v && v !== TT((DEF.find(x => x[0] === id) || [])[1])) t.r[id] = v; else delete t.r[id];
      tsave(t); paintChips(); paintList();
    });
    $('uzNewer').addEventListener('click', () => { page = Math.max(0, page - 1); editIdx = null; paintList(); });
    $('uzOlder').addEventListener('click', () => { page++; editIdx = null; paintList(); });
    $('uzList').addEventListener('click', e => {
      const row = e.target.closest('[data-i]'), b = e.target.closest('button');
      if (b && b.dataset.act) { listAct(b.dataset.act); return; }
      if (b && b.dataset.split) { split(+b.dataset.split); return; }
      if (row && !e.target.closest('.uz-ed')) { const i = +row.dataset.i; editIdx = editIdx === i ? null : i; paintList(); }
    });
    $('uzImp').addEventListener('click', () => $('uzFile').click());
    $('uzFile').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      const m = $('uzDataMsg'); m.textContent = TT('Lese …');
      let r; try { r = await importFile(f); } catch (err) { r = { err: TT('Datei konnte nicht gelesen werden.') }; }
      m.textContent = importMsg(r); m.classList.toggle('bad', !!r.err); window.__uzLastImport = r;
    });
    $('uzExp').addEventListener('click', () => { exportCsv(); $('uzDataMsg').textContent = TT('CSV erstellt') + ' (' + load().u.length + ' ' + TT('Einheiten') + ').'; });
    $('uzRm').addEventListener('click', () => {
      const im = load().u.filter(x => x[2] === 1), n = im.length;
      if (!n) { $('uzDataMsg').textContent = TT('Keine importierten Einheiten vorhanden.'); return; }
      const f = t => new Date(t * 1000).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' });
      if (!confirm(TT('Importierte Einheiten entfernen?') + '\n' + n + ' ' + TT(n === 1 ? 'Einheit' : 'Einheiten') + ', ' + fmtHM(im.reduce((a, x) => a + x[1], 0)) + ', ' + TT('von') + ' ' + f(im[0][0]) + ' ' + TT('bis') + ' ' + f(im[n - 1][0]) + '.\n' + TT('Selbst gezählte und nachgetragene Einheiten bleiben.'))) return;
      $('uzDataMsg').textContent = removeImport() + ' ' + TT('importierte Einheiten entfernt.');
    });
    // gezeichnet wird danach im tabchange-Handler (einmal)
  }
  function paintRun(d) {
    const b = $('uzBtn'); if (!b) return;
    b.textContent = TT(d.run ? 'Üben: An' : 'Üben: Aus'); b.setAttribute('aria-pressed', d.run ? 'true' : 'false');
    $('uzTime').textContent = d.run ? clock(Date.now() - d.run.s) : '0:00';
    $('uzTime').classList.toggle('on', !!d.run);
    const sd = new Date(d.run ? d.run.s : 0), today = new Date().toDateString() === sd.toDateString();
    $('uzSince').textContent = d.run ? TT('läuft seit') + ' ' + (today ? '' : dday(d.run.s) + ' ') + hhmm(d.run.s) + (d.th ? ' · ' + tname(d.th) : '')
      : TT('Antippen, wenn du anfängst – die Zeit läuft auch bei geschlossener App weiter.');
    const n = $('uzNote'); if (n && document.activeElement !== n && n.value !== d.nt) n.value = d.nt || '';
  }
  function paintChips() {
    const el = $('uzChips'); if (!el) return; const d = load(), t = topics();
    const ids = [''].concat(tlist(t).filter(id => !t.h.includes(id) || id === d.th));
    el.innerHTML = ids.map(id => '<button type="button" class="toggle-btn' + (id === d.th ? ' active' : '') + '" data-th="' + esc(id) + '" aria-pressed="' + (id === d.th) + '">' + esc(tname(id, t)) + '</button>').join('')
      + '<button type="button" class="toggle-btn uz-thedit" id="uzThEdit" aria-expanded="' + !$('uzEdit').hidden + '">' + esc(TT('Themen …')) + '</button>';
  }
  function paintEdit() {
    const el = $('uzEdit'); if (!el || el.hidden) return; const t = topics();
    el.innerHTML = '<div class="uz-erow"><input type="text" id="uzThNew" maxlength="40" placeholder="' + esc(TT('Neues Thema')) + '" autocomplete="off"><button type="button" class="toggle-btn" id="uzThAdd">' + esc(TT('Hinzufügen')) + '</button></div>'
      + tlist(t).map(id => '<div class="uz-erow' + (t.h.includes(id) ? ' off' : '') + '"><input type="text" data-ren="' + esc(id) + '" value="' + esc(tname(id, t)) + '" maxlength="40" aria-label="' + esc(TT('Umbenennen')) + '">'
        + '<button type="button" class="toggle-btn" data-hide="' + esc(id) + '">' + esc(TT(t.h.includes(id) ? 'Thema einblenden' : 'Thema ausblenden')) + '</button></div>').join('');
  }
  // v155: Übersicht (uebezeit-ansicht.js/.css) erst beim ersten Öffnen laden – Start und index.html bleiben schlank
  let vizLoading = false;
  function loadViz() {
    if (vizLoading || window.UebezeitAnsicht) return; vizLoading = true;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'uebezeit-ansicht.css'; document.head.appendChild(l);
    l.addEventListener('load', () => { const r = $('uzRoot'); if (r) r.classList.add('uz-css'); });
    l.addEventListener('error', () => { const r = $('uzRoot'); if (r) r.classList.add('uz-css'); });
    const sc = document.createElement('script'); sc.src = 'uebezeit-ansicht.js';
    sc.onload = () => paintViz();
    sc.onerror = () => { vizLoading = false; };
    l.onload = l.onerror = () => document.head.appendChild(sc);   // erst Stil, dann Code
  }
  // v157: „Zeit aufteilen“ / „Aufteilung aufheben“ – Dialog und Rechnung in uebezeit-ansicht.js (nachgeladen)
  const split = (i, un, n) => { if (window.UebezeitAnsicht) return un ? UebezeitAnsicht.unsplit(i) : UebezeitAnsicht.splitForm(i); loadViz(); if ((n || 0) < 30) setTimeout(() => split(i, un, (n || 0) + 1), 200); };
  const paintViz = () => { if (!built) return; if (window.UebezeitAnsicht) UebezeitAnsicht.paint(load()); else loadViz(); };
  function paintSums() {
    if (window.UebezeitAnsicht) return;   // Kacheln mit ▲/▼ zeichnet uebezeit-ansicht.js (paintViz)   // v155: Kacheln mit ▲/▼ zeichnet uebezeit-ansicht.js (paintViz)
    const el = $('uzSums'); if (!el) return; const d = load(), s = sums(d, Date.now());
    el.innerHTML = [['Heute', s.heute], ['Diese Woche', s.woche], ['Dieser Monat', s.monat], ['Dieses Jahr', s.jahr], ['Insgesamt', s.gesamt]]
      .map(x => '<div class="uz-sum"><div class="uz-sv">' + esc(fmtHM(x[1])) + '</div><div class="caption">' + esc(TT(x[0])) + '</div></div>').join('');
    $('uzSumN').textContent = s.n ? s.n + ' ' + TT(s.n === 1 ? 'Einheit' : 'Einheiten') + ' · ' + TT('seit') + ' ' + new Date(s.first).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  }
  function paintList() {
    const el = $('uzList'); if (!el) return; const d = load(), t = topics(), N = d.u.length, pages = Math.max(1, Math.ceil(N / PER));
    page = Math.min(page, pages - 1);
    const from = N - 1 - page * PER, rows = [];
    for (let i = from; i > from - PER && i >= 0; i--) {
      const u = d.u[i], e = u[0] * 1000, s = e - u[1] * 1000;
      rows.push('<div class="uz-row' + (editIdx === i ? ' open' : '') + '" data-i="' + i + '" role="button" tabindex="0"><div class="uz-r1"><span class="uz-rd">' + esc(dday(e)) + '</span><b class="uz-rdur">' + esc(fmtHM(u[1])) + '</b>' + (u[0] === lastE && !u[5] && editIdx !== i ? '<button type="button" class="toggle-btn uz-splh" data-split="' + i + '">' + esc(TT('Zeit aufteilen')) + '</button>' : '') + '</div>'
        + '<div class="uz-r2 caption"><span>' + hhmm(s) + '–' + hhmm(e) + '</span>' + (u[3] ? '<span class="uz-tag">' + esc(tname(u[3], t)) + '</span>' : '') + (u[2] === 1 ? '<span class="uz-imp">' + esc(TT('Import')) + '</span>' : u[2] === 2 ? '<span class="uz-imp">' + esc(TT('nachgetragen')) + '</span>' : u[2] === 3 ? '<span class="uz-imp">' + esc(TT('Looper')) + '</span>' : '')
        + (u[5] ? '<span class="uz-imp">' + esc(TT('aufgeteilt')) + '</span>' : '') + (u[4] ? '<span class="uz-rn">' + esc(u[4]) + '</span>' : '') + '</div>'
        + (editIdx === i ? editor(u, t) : '') + '</div>');
    }
    el.innerHTML = rows.length ? rows.join('') : '<p class="pattern-desc uz-empty">' + esc(TT('Noch keine Einheiten. Tippe oben „Üben“, wenn du anfängst – oder importiere dein Protokoll aus Numbers (unten).')) + '</p>';
    $('uzPg').hidden = pages < 2; $('uzPgN').textContent = (page + 1) + ' / ' + pages;
    $('uzNewer').disabled = page === 0; $('uzOlder').disabled = page >= pages - 1;
  }
  function editor(u, t) {
    const ids = [''].concat(tlist(t)), m = Math.round(u[1] / 60), st = (u[0] - u[1]) * 1000;
    return '<div class="uz-ed"><label class="field"><span>' + esc(TT('Datum')) + '</span><input type="date" id="uzEdDate" value="' + ymd(st) + '" max="' + ymd(Date.now()) + '"></label>'
      + '<label class="field"><span>' + esc(TT('Beginn')) + '</span><input type="time" id="uzEdTime" value="' + hhmm(st) + '"></label>'
      + '<label class="field"><span>' + esc(TT('Thema')) + '</span><select id="uzEdTh">' + ids.map(id => '<option value="' + esc(id) + '"' + (id === u[3] ? ' selected' : '') + '>' + esc(tname(id, t)) + '</option>').join('') + '</select></label>'
      + '<label class="field"><span>' + esc(TT('Dauer (Minuten)')) + '</span><input type="number" id="uzEdDur" min="0" max="1440" step="1" value="' + m + '" inputmode="numeric"></label>'
      + '<label class="field uz-edn"><span>' + esc(TT('Notiz')) + '</span><input type="text" id="uzEdNote" maxlength="300" value="' + esc(u[4]) + '"></label>'
      + '<div class="uz-edb"><button type="button" class="toggle-btn active" data-act="save">' + esc(TT('Speichern')) + '</button><button type="button" class="toggle-btn" data-act="cancel">' + esc(TT('Abbrechen')) + '</button><button type="button" class="toggle-btn uz-del" data-act="del">' + esc(TT('Löschen')) + '</button><button type="button" class="toggle-btn" data-act="split">' + esc(TT(u[5] ? 'Aufteilung ändern' : 'Zeit aufteilen')) + '</button>' + (u[5] ? '<button type="button" class="toggle-btn" data-act="unsplit">' + esc(TT('Aufteilung aufheben')) + '</button>' : '') + '</div></div>';
  }
  // Ändern: Start bleibt, Ende = Start + neue Dauer
  function editUnit(i, ch) {
    const d = load(), u = d.u[i]; if (!u) return false;
    if (ch.del) d.u.splice(i, 1);
    else {
      if (ch.th != null) u[3] = ch.th; if (ch.nt != null) u[4] = String(ch.nt).trim().slice(0, 300);
      if (ch.min != null && ch.min >= 0) { const s = u[0] - u[1]; u[1] = Math.round(ch.min) * 60; u[0] = s + u[1]; }
      if (ch.start != null && !isNaN(ch.start)) { const e = minR(ch.start) + u[1]; if (e * 1000 <= Date.now() + 60000) u[0] = e; }   // v155: Datum/Beginn ändern (nicht in die Zukunft)
    }
    const ok = store(d); changed(); return ok;
  }
  function listAct(a) {
    const i = editIdx; if (i == null) return;
    if (a === 'cancel') { editIdx = null; paintList(); return; }
    if (a === 'split') { editIdx = null; paintList(); split(i); return; }
    if (a === 'unsplit') { editIdx = null; split(i, 1); return; }
    if (a === 'del') { if (!confirm(TT('Diese Einheit löschen?'))) return; editIdx = null; editUnit(i, { del: true }); say(TT('Einheit gelöscht.')); return; }
    const min = parseFloat($('uzEdDur').value), st = at($('uzEdDate').value, $('uzEdTime').value);
    editIdx = null; editUnit(i, { th: $('uzEdTh').value, nt: $('uzEdNote').value, min: isNaN(min) ? null : min, start: st });
  }
  /* ---------- v155: Einheit nachtragen ----------
     f = { date: 'JJJJ-MM-TT', from: 'HH:MM'|'', to: 'HH:MM'|'', h, m, th, nt }. Beginn+Ende ODER Dauer (mit Beginn oder Ende; ohne Uhrzeit ab 12:00
     bzw. bis jetzt, wenn das in der Zukunft läge). Ergebnis { err } | { overlap: n, s, e } | { ok: Einheit }. force = Überschneidung bestätigt. */
  function addUnit(f, force) {
    const now = Date.now(), dur = ((+f.h || 0) * 60 + (+f.m || 0)) * 60000;
    let s = f.from ? at(f.date, f.from) : null, e = f.to ? at(f.date, f.to) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) return { err: TT('Bitte ein Datum wählen.') };
    if (s != null && e != null) { if (e <= s) return { err: TT('Das Ende muss nach dem Beginn liegen.') }; }
    else if (dur > 0) {
      if (s != null) e = s + dur; else if (e != null) s = e - dur;
      else { s = at(f.date, '12:00'); e = s + dur; if (e > now) { e = now; s = now - dur; } }
    } else return { err: TT('Beginn und Ende oder eine Dauer angeben.') };
    if (e - s <= 0) return { err: TT('Die Dauer muss größer als 0 sein.') };
    if (e - s > 24 * 3600e3) return { err: TT('Höchstens 24 Stunden je Einheit.') };
    if (e > now + 60000) return { err: TT('Die Einheit liegt in der Zukunft.') };
    const a = minR(s), b = Math.max(minR(e), a + 60), d = load();
    const ov = d.u.filter(u => u[0] - u[1] < b && u[0] > a).length + (d.run && d.run.s / 1000 < b ? 1 : 0);
    if (ov && !force) return { overlap: ov, s: a * 1000, e: b * 1000 };
    const u = [b, b - a, 2, f.th || '', String(f.nt || '').trim().slice(0, 300)];
    d.u.push(u); if (!store(d)) return { err: TT('Konnte nicht speichern – Speicher voll oder privates Surfen.') };
    changed(); return { ok: u };
  }
  function addForm() {
    let w = $('uzAdd');
    if (!w) { w = document.createElement('div'); w.id = 'uzAdd'; w.className = 'uz-ask'; document.body.appendChild(w); }
    const t = topics(), d = load(), ids = [''].concat(tlist(t).filter(id => !t.h.includes(id)));
    let th = d.th || '';
    w.innerHTML = '<div class="uz-askbox uz-addbox card" role="dialog" aria-modal="true" aria-labelledby="uzAddH"><h2 id="uzAddH">' + esc(TT('Einheit nachtragen')) + '</h2>'
      + '<p class="caption">' + esc(TT('Beginn und Ende – oder nur die Dauer. Eines reicht.')) + '</p>'
      + '<div class="uz-addg"><label class="field uz-addd"><span>' + esc(TT('Datum')) + '</span><input type="date" id="uzAdDate" value="' + ymd(Date.now()) + '" max="' + ymd(Date.now()) + '"></label>'
      + '<label class="field"><span>' + esc(TT('Beginn')) + '</span><input type="time" id="uzAdFrom"></label>'
      + '<label class="field"><span>' + esc(TT('Ende')) + '</span><input type="time" id="uzAdTo"></label>'
      + '<label class="field"><span>' + esc(TT('Dauer: Stunden')) + '</span><input type="number" id="uzAdH" min="0" max="24" inputmode="numeric" placeholder="0"></label>'
      + '<label class="field"><span>' + esc(TT('Minuten')) + '</span><input type="number" id="uzAdM" min="0" max="59" inputmode="numeric" placeholder="0"></label></div>'
      + '<div class="uz-lbl">' + esc(TT('Thema')) + '</div><div class="uz-chips uz-addch" id="uzAdTh">' + ids.map(id => '<button type="button" class="toggle-btn' + (id === th ? ' active' : '') + '" data-fth="' + esc(id) + '">' + esc(tname(id, t)) + '</button>').join('') + '</div>'
      + '<label class="field"><span>' + esc(TT('Notiz')) + '</span><input type="text" id="uzAdNote" maxlength="300" autocomplete="off"></label>'
      + '<p class="caption uz-msg bad" id="uzAdErr" role="alert"></p>'
      + '<div class="uz-edb"><button type="button" class="toggle-btn active" data-a="save">' + esc(TT('Speichern')) + '</button><button type="button" class="toggle-btn" data-a="cancel">' + esc(TT('Abbrechen')) + '</button></div></div>';
    w.hidden = false;
    const val = () => ({ date: $('uzAdDate').value, from: $('uzAdFrom').value, to: $('uzAdTo').value, h: $('uzAdH').value, m: $('uzAdM').value, th, nt: $('uzAdNote').value });
    w.onclick = e => {
      const c = e.target.closest('[data-fth]');
      if (c) { th = c.dataset.fth; w.querySelectorAll('[data-fth]').forEach(b => b.classList.toggle('active', b === c)); return; }
      const b = e.target.closest('button[data-a]'); if (!b && e.target !== w) return;
      if (!b || b.dataset.a === 'cancel') { w.hidden = true; return; }
      let r = addUnit(val());
      if (r.overlap) {
        const f2 = t2 => new Date(t2).toLocaleString(loc(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        if (!confirm(TT('Überschneidet sich mit') + ' ' + r.overlap + ' ' + TT(r.overlap === 1 ? 'vorhandenen Einheit' : 'vorhandenen Einheiten') + ' (' + f2(r.s) + '–' + hhmm(r.e) + ').\n' + TT('Trotzdem speichern? Die Zeit zählt dann doppelt.'))) { $('uzAdErr').textContent = TT('Nicht gespeichert – Zeiten anpassen.'); return; }
        r = addUnit(val(), true);
      }
      if (r.err) { $('uzAdErr').textContent = r.err; return; }
      w.hidden = true; say(TT('Nachgetragen:') + ' ' + fmtHM(r.ok[1]) + ' · ' + dday(r.ok[0] * 1000));
    };
    const i = $('uzAdFrom'); if (i) i.focus();
  }
  // Nachfrage bei vergessenem Ausschalten (> 8 h): Dauer korrigieren, verwerfen oder weiterlaufen lassen
  function ask8(s, now) {
    let w = $('uzAsk');
    if (!w) { w = document.createElement('div'); w.id = 'uzAsk'; w.className = 'uz-ask'; document.body.appendChild(w); }
    const m = Math.round((now - s) / 60000);
    w.innerHTML = '<div class="uz-askbox card" role="dialog" aria-modal="true" aria-labelledby="uzAskH"><h2 id="uzAskH">' + esc(TT('Wirklich so lange geübt?')) + '</h2>'
      + '<p class="pattern-desc">' + esc(TT('Die Zeit läuft seit') + ' ' + dday(s) + ' ' + hhmm(s) + ' (' + fmtHM(m * 60) + '). ' + TT('Vielleicht wurde das Ausschalten vergessen – trage die echte Dauer ein.')) + '</p>'
      + '<div class="uz-askf"><label class="field"><span>' + esc(TT('Stunden')) + '</span><input type="number" id="uzAskH1" min="0" max="48" value="' + Math.floor(m / 60) + '" inputmode="numeric"></label>'
      + '<label class="field"><span>' + esc(TT('Minuten')) + '</span><input type="number" id="uzAskM1" min="0" max="59" value="' + (m % 60) + '" inputmode="numeric"></label></div>'
      + '<div class="uz-edb"><button type="button" class="toggle-btn active" data-a="ok">' + esc(TT('Speichern')) + '</button><button type="button" class="toggle-btn" data-a="drop">' + esc(TT('Verwerfen')) + '</button><button type="button" class="toggle-btn" data-a="keep">' + esc(TT('Weiterlaufen')) + '</button></div></div>';
    w.hidden = false;
    w.onclick = e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const a = b.dataset.a; w.hidden = true;
      if (a === 'ok') { const h = parseFloat($('uzAskH1').value) || 0, mi = parseFloat($('uzAskM1').value) || 0; off({ ok: true, dur: Math.max(0, Math.min(now - s, (h * 60 + mi) * 60000) / 1000) }); }
      else if (a === 'drop') off({ drop: true });
    };
  }
  function changed() {
    paintAll();
    if (built) { paintChips(); paintSums(); paintList(); paintViz(); }
    if (window.UebeVerlauf && UebeVerlauf.refresh) UebeVerlauf.refresh();
  }
  // Kopfknopf verdrahten (das ist alles, was beim Start passiert)
  function init() {
    const b = $('uebenBtn'); if (b) b.addEventListener('click', toggle);
    paintAll();
    document.addEventListener('visibilitychange', paintAll);
    // v160: Looper-Zeit – Start/Stopp, Hintergrund/zurück, Schließen (letzter sicherer Zeitpunkt), Neustart
    document.addEventListener('looperrun', () => lpSync());
    document.addEventListener('visibilitychange', () => lpSync());
    window.addEventListener('pagehide', () => { const d = load(); if (d.lp && d.lp.r != null) { lpClose(d, Date.now()); store(d); } });
    lpSync(true);
    document.addEventListener('tabchange', e => { if (e.detail === 'uebezeit') { build(); paintAll(); paintChips(); paintSums(); paintList(); paintViz(); } });
    window.addEventListener('storage', e => { if (e.key === KEY || e.key === TKEY) changed(); });
  }
  if ($('uebenBtn')) init(); else document.addEventListener('DOMContentLoaded', init);   // Kopf steht schon im DOM → sofort, damit tabchange beim Start ankommt
  return { save: d => { const ok = store(d); changed(); return ok; }, tlist, lastE: () => lastE, on, off, toggle, setTopic, setNote, load, importFile, importMsg, removeImport, csv, exportCsv, merge, sums, topics, tname, setLz, _lp: lpSync, LP: { MIN: LP_MIN, GAP: LP_GAP, TICK: LP_TICK, LOST: LP_LOST }, editUnit, addUnit, addForm, fmtHM, dday, hhmm, esc, built: () => built, KEY, DEF, _parse: { csvRows, parseDur, parseDate, unzip } };
})();
