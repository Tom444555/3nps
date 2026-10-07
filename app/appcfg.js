/* ---------- App: Optik umschalten, alles sichern und wiederherstellen ---------- */
const AppCfg = (() => {
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const THEME_BG = { nordic: '#1b1b1d', metal: '#0a0a0b', amp: '#0b0b0b', ice: '#06121c' };
  const themeSel = $('appTheme');

  function applyTheme(v) {
    if (!THEME_BG[v]) v = 'nordic';
    if (v !== 'nordic') root.dataset.theme = v; else delete root.dataset.theme;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', THEME_BG[v]);
    try { localStorage.setItem('3nps-theme', v); } catch (e) {}
    if (themeSel && themeSel.value !== v) themeSel.value = v;
    try { if (typeof Looper !== 'undefined' && Looper.themeChanged) Looper.themeChanged(); } catch (e) {}
    document.dispatchEvent(new CustomEvent('themechange', { detail: v }));
  }
  let cur = 'nordic';
  try { cur = localStorage.getItem('3nps-theme') || 'nordic'; } catch (e) {}
  if (themeSel) { themeSel.value = THEME_BG[cur] ? cur : 'nordic'; themeSel.addEventListener('change', () => applyTheme(themeSel.value)); }
  applyTheme(cur);
  const oBtn = $('optikBtn'), oPop = $('optikPop');
  function optikOpen(on) { if (!oBtn || !oPop) return; oPop.hidden = !on; oBtn.setAttribute('aria-expanded', on ? 'true' : 'false'); }
  if (oBtn && oPop) {
    oBtn.addEventListener('click', e => { e.stopPropagation(); optikOpen(oPop.hidden); });
    oPop.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => optikOpen(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') optikOpen(false); });
    if (themeSel) themeSel.addEventListener('change', () => setTimeout(() => optikOpen(false), 150));
  }

  // ---- Sicherung: eine ZIP-Datei mit sicherung.json und den Audiodaten als Binärteile ----
  const info = $('backupInfo'), say = t => { if (info) info.textContent = t; };
  const STORES = ['sessions', 'ideas', 'meta'];
  const TYPES = { Uint8Array, Int8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array };

  async function pack(v, bins) {
    if (v instanceof Blob) { bins.push(new Uint8Array(await v.arrayBuffer())); return { $bin: bins.length - 1, t: 'Blob', mime: v.type || '' }; }
    if (v instanceof ArrayBuffer) { bins.push(new Uint8Array(v)); return { $bin: bins.length - 1, t: 'ArrayBuffer' }; }
    if (ArrayBuffer.isView(v)) { bins.push(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); return { $bin: bins.length - 1, t: v.constructor.name }; }
    if (Array.isArray(v)) { const a = []; for (const x of v) a.push(await pack(x, bins)); return a; }
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = await pack(v[k], bins); return o; }
    return v;
  }
  function unpack(v, files) {
    if (Array.isArray(v)) return v.map(x => unpack(x, files));
    if (v && typeof v === 'object') {
      if (typeof v.$bin === 'number' && v.t) {
        const u = files['bin/' + v.$bin]; if (!u) throw new Error('Teil ' + v.$bin + ' fehlt');
        const copy = u.slice();                                   // eigener, ausgerichteter Speicher
        if (v.t === 'Blob') return new Blob([copy], { type: v.mime || '' });
        if (v.t === 'ArrayBuffer') return copy.buffer;
        const C = TYPES[v.t] || Uint8Array;
        return new C(copy.buffer, 0, copy.byteLength / (C.BYTES_PER_ELEMENT || 1));
      }
      const o = {}; for (const k of Object.keys(v)) o[k] = unpack(v[k], files); return o;
    }
    return v;
  }
  // Liest ZIP-Dateien ohne Kompression (so schreibt die App sie)
  function readZip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(), out = {};
    let p = 0;
    while (p + 30 <= buf.byteLength && dv.getUint32(p, true) === 0x04034b50) {
      const method = dv.getUint16(p + 8, true), size = dv.getUint32(p + 18, true), nlen = dv.getUint16(p + 26, true), xlen = dv.getUint16(p + 28, true);
      const name = dec.decode(u8.subarray(p + 30, p + 30 + nlen)), start = p + 30 + nlen + xlen;
      if (method !== 0) throw new Error('gepackt');
      out[name] = u8.subarray(start, start + size); p = start + size;
    }
    return out;
  }
  async function offer(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: file.name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }

  async function backup() {
    say('Sichere …');
    await new Promise(r => setTimeout(r, 30));
    const bins = [], db = {}, local = {};
    for (const s of STORES) { let rows = []; try { rows = await AppDB.all(s); } catch (e) {} db[s] = await pack(rows, bins); }
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('3nps-')) local[k] = localStorage.getItem(k); } } catch (e) {}
    const now = new Date();
    const head = { app: 'Looper', format: 1, date: now.toISOString(), local, db };
    const files = [{ name: 'sicherung.json', data: new TextEncoder().encode(JSON.stringify(head)) }];
    bins.forEach((u, i) => files.push({ name: 'bin/' + i, data: u }));
    const zip = Looper._zip(files);
    const stamp = now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('.').reverse().join('-');
    const file = new File([zip], 'Looper-Sicherung ' + stamp + '.zip', { type: 'application/zip' });
    const n = (db.ideas || []).length, m = (db.sessions || []).length;
    say('Sicherung fertig: ' + n + ' Idee' + (n === 1 ? '' : 'n') + ', ' + m + ' Log-Einträge, ' + Object.keys(local).length + ' Einstellungen · ' + (zip.size / 1048576).toFixed(1).replace('.', ',') + ' MB. Im Teilen-Menü „In Dateien sichern“ wählen.');
    await offer(file);
    return { file, zip, head };
  }

  async function restore(file) {
    say('Lade Sicherung …');
    let files, head;
    try {
      files = readZip(await file.arrayBuffer());
      head = JSON.parse(new TextDecoder().decode(files['sicherung.json']));
      if (!head || head.app !== 'Looper' || !head.db) throw new Error('fremd');
    } catch (e) {
      say('Das ist keine Looper-Sicherung (oder sie wurde verändert, z. B. entpackt und neu gepackt).');
      return null;
    }
    let ideas = 0, logs = 0;
    for (const s of STORES) {
      const rows = unpack(head.db[s] || [], files);
      for (const r of rows) { try { await AppDB.put(s, r); if (s === 'ideas') ideas++; if (s === 'sessions') logs++; } catch (e) {} }
    }
    let nset = 0;
    try { Object.entries(head.local || {}).forEach(([k, v]) => { if (k.startsWith('3nps-') && typeof v === 'string') { localStorage.setItem(k, v); nset++; } }); } catch (e) {}
    say('Sicherung geladen: ' + ideas + ' Idee' + (ideas === 1 ? '' : 'n') + ', ' + logs + ' Log-Einträge, ' + nset + ' Einstellungen. Die App startet neu …');
    return { ideas, logs, nset };
  }

  if ($('backupSave')) $('backupSave').addEventListener('click', () => backup().catch(e => say('Sichern fehlgeschlagen: ' + (e && e.message || e))));
  if ($('backupLoad')) $('backupLoad').addEventListener('click', () => $('backupFile').click());
  if ($('backupFile')) $('backupFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = await restore(f).catch(err => { say('Laden fehlgeschlagen: ' + (err && err.message || err)); return null; });
    if (r && !window.__noReload) setTimeout(() => location.reload(), 1600);
  });

  // ---- Mac: als eigene App installieren (Chrome/Edge), Hinweise je nach Browser ----
  const ua = navigator.userAgent;
  const isMac = /Macintosh/.test(ua) && !(navigator.maxTouchPoints > 1);
  const isChromium = /Chrome\/|Chromium\/|Edg\//.test(ua);
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  let deferred = null;
  const instRow = $('installRow'), macHint = $('macHint');
  function macInfo() {
    if (!macHint) return;
    if (!isMac) { macHint.hidden = true; return; }
    macHint.hidden = false;
    if (standalone) macHint.textContent = 'Läuft als Mac-App. ' + (isChromium ? 'Der Eingang kommt hier in Stereo an, wenn das Gerät zwei Kanäle liefert.' : 'Hinweis: Für Stereo-Aufnahme die App in Google Chrome installieren.');
    else if (isChromium) macHint.textContent = deferred ? 'Mac: „Als App installieren“ legt Looper ins Programme-Verzeichnis und ins Dock – mit eigenem Fenster, offline und mit Stereo-Eingang.' : 'Mac: In Chrome oben rechts in der Adressleiste auf das Installieren-Symbol klicken (oder im Chrome-Menü ⋮ „Looper installieren“ bzw. „Seite als App installieren“ wählen).';
    else macHint.textContent = 'Mac: Für Stereo-Aufnahme diese Seite in Google Chrome öffnen und dort installieren. In Safari geht „Ablage → Zum Dock hinzufügen“, Aufnahmen sind dort aber nur mono.';
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (instRow) instRow.hidden = false; macInfo(); });
  window.addEventListener('appinstalled', () => { deferred = null; if (instRow) instRow.hidden = true; if (macHint) { macHint.hidden = false; macHint.textContent = 'Installiert. Looper startet jetzt aus dem Dock oder dem Programme-Ordner.'; } });
  if ($('appInstall')) $('appInstall').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt(); try { await deferred.userChoice; } catch (e) {}
    deferred = null; if (instRow) instRow.hidden = true;
  });
  macInfo();

  return { applyTheme, backup, restore, isMac, standalone };
})();
