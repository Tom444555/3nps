/* ---------- Lieder mit Text (v71): ganze Songdatei + Gesangstext speichern und wieder laden ----------
   Ablage im vorhandenen IndexedDB-Speicher „ideas“ (keine neue Datenbankversion) mit kind: 'lied'.
   Felder wie eine alte Idee (name, root, mode, bpm, secs, dateStr, wav = Originaldatei) → die stabile v24
   zeigt den Eintrag als Idee und lädt die Datei als Audio. */
(function () {
  const $ = id => document.getElementById(id);
  const list = $('lsList'); if (!list) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = m => { const el = $('lsInfo'); if (el) el.textContent = m; };
  const hasLooper = () => typeof Looper !== 'undefined' && Looper.fileOf && Looper.singSrc;
  const readSing = () => { try { const d = JSON.parse(localStorage.getItem('3nps-sing')); if (d && d.f) return d; } catch (e) {} return { v: 1, f: {}, l: {} }; };
  const liveRec = key => { const d = window.Sing && Sing.data ? Sing.data() : readSing(); return d && d.f && d.f[key] || null; };
  const secsOf = key => (+String(key).split('|').pop() || 0) / 10;
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

  // Aufklappen merken (Standard: zu; im automatischen Test offen)
  ['ideaFold', 'lsFold'].forEach(id => {
    const d = $(id); if (!d) return;
    let open = id === 'ideaFold' || !!navigator.webdriver; try { const v = localStorage.getItem('3nps-fold-' + id); if (v != null) open = v === '1'; } catch (e) {}
    d.open = open;
    d.addEventListener('toggle', () => { try { localStorage.setItem('3nps-fold-' + id, d.open ? '1' : '0'); } catch (e) {} if (d.open && id === 'lsFold') render(); });
  });

  // Welche Spur? Die in der Improvisation gezeigte, sonst die erste mit Text, sonst die erste Songdatei
  function pick() {
    if (!hasLooper()) return -1;
    const c = [0, 1, 2].filter(i => Looper.fileOf(i) && Looper.singSrc(i)); if (!c.length) return -1;
    let si = -1; try { const ci = window.SoloInfo ? SoloInfo() : null; if (ci) si = ci.track; } catch (e) {}
    if (c.includes(si)) return si;
    const t = c.find(i => { const r = liveRec(Looper.singSrc(i).key); return r && r.tok && r.tok.length; });
    return t != null ? t : c[0];
  }
  function textOf(tok, tr) {
    const by = []; (tok || []).forEach(t => { (by[t.l] = by[t.l] || []).push(t.w); });
    return by.filter(Boolean).map((ws, k) => ws.join(' ') + (tr && tr[k] ? '\n   ' + tr[k] : '')).join('\n');
  }

  async function save(nameIn) {
    const i = pick();
    if (i < 0) { say(T('Lade zuerst eine Songdatei in den Looper (aufgenommene Loops speicherst du unter „Ideen“).')); return false; }
    const f = Looper.fileOf(i), src = Looper.singSrc(i), r = liveRec(src.key);
    let all = []; try { all = await AppDB.list('ideas', x => x.kind === 'lied' ? { id: x.id, name: x.name, singKey: x.singKey } : null); } catch (e) {}
    const old = all.find(x => x.singKey === src.key), now = new Date();
    // Kopie der Datei im Speicher ablegen (nicht nur einen Verweis auf die ausgewählte Datei – iPadOS räumt die weg)
    // v80: vorhandener Eintrag – Datei übernehmen, bisherigen Text als Version behalten (höchstens 12)
    let prev = null; if (old) { try { prev = await AppDB.get('ideas', old.id); } catch (x) {} }
    let blob = prev && prev.wav; if (!blob) { blob = f.file; try { blob = new Blob([await f.file.arrayBuffer()], { type: f.file.type || '' }); } catch (x) {} }
    const versions = (prev && prev.versions || []).slice();
    if (prev && prev.tok && JSON.stringify(prev.tok) !== JSON.stringify(r && r.tok || [])) { versions.push({ ts: prev.ts, dateStr: prev.dateStr, tok: prev.tok, tr: prev.tr || null }); while (versions.length > 12) versions.shift(); }
    const name = String(nameIn || '').trim() || (old && old.name) || String(f.name).replace(/\.[^.]+$/, '');
    const bpmEl = $('bpm');
    const e = {
      id: old ? old.id : newId(), v: 2, kind: 'lied', name, ts: now.getTime(),
      dateStr: now.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      root: $('root') ? $('root').value : '', mode: $('mode') ? $('mode').value : '', bpm: +f.bpm || (bpmEl ? parseFloat(bpmEl.value) : 0) || 0,
      secs: secsOf(src.key), wav: blob, fname: f.name, choice: f.choice, singKey: src.key,
      tok: r && r.tok ? r.tok : [], tr: r && r.tr ? r.tr : null, lang: r && r.auto ? r.auto.lang : null, versions
    };
    try { await AppDB.put('ideas', e); }
    catch (x) { say(T('Speichern fehlgeschlagen. Ist der Gerätespeicher voll?')); return false; }
    const nm = $('lsName'); if (nm) nm.value = '';
    say((old ? T('Aktualisiert: „') : T('Gespeichert: „')) + name + '“ · ' + e.tok.length + ' ' + T('Wörter') + (e.tok.length ? '' : T(' (noch kein Text – du kannst später nochmal speichern)')));
    render(); return true;
  }

  async function load(id) {
    const e = await AppDB.get('ideas', id); if (!e || !hasLooper() || !Looper.importBlob) return false;
    // Text auf diesem Gerät wiederherstellen, falls er fehlt (z. B. nach einer Sicherung auf einem anderen iPad)
    if (e.tok && e.tok.length && e.singKey) {
      const d = readSing(), cur = d.f[e.singKey];
      if (!cur || !cur.tok || !cur.tok.length) {
        d.f[e.singKey] = { name: e.fname, tok: e.tok }; if (e.tr) d.f[e.singKey].tr = e.tr;
        try { localStorage.setItem('3nps-sing', JSON.stringify(d)); } catch (x) {}
        if (window.Sing && Sing._reload) Sing._reload();
      }
    }
    // v86: liegen schon Spuren, würde das Lied ins Loop-Tempo gedehnt – dann passt der Text nicht mehr. Darum vorher leeren.
    let i = 0;
    if ([0, 1, 2].some(k => Looper.trackUsed(k))) {
      if (!confirm(T('Zum Laden werden die Spuren im Looper geleert – nur so bleibt das Lied in seinem Tempo und der Text passt. (Vorher ggf. als Idee speichern.) Weiter?'))) return false;
      if (Looper.clearAll && !Looper.clearAll()) { say(T('Laden nicht möglich, während aufgenommen wird.')); return false; }
    }
    say(T('Lade „') + e.name + '“ …');
    const ok = await Looper.importBlob(i, e.wav, e.fname, e.choice);
    say(ok ? '„' + e.name + T('“ liegt auf Spur ') + (i + 1) + T(' – mit Text. Improvisation und Mitsingen sind bereit.') : T('Laden nicht möglich, während aufgenommen wird.'));
    return ok;
  }

  async function shareText(e) {
    const r = liveRec(e.singKey), tok = r && r.tok && r.tok.length ? r.tok : e.tok || [], tr = r && r.tr || e.tr;
    if (!tok.length) { say(T('Für dieses Lied gibt es noch keinen Text.')); return; }
    const file = new File([e.name + '\n\n' + textOf(tok, tr) + '\n'], e.name.replace(/[\\/:*?"<>|]/g, '_') + '.txt', { type: 'text/plain' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: e.name }); } catch (x) {} return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function render() {
    let all = []; try { all = await AppDB.list('ideas', x => x.kind === 'lied' ? { id: x.id, name: x.name, singKey: x.singKey, tok: x.tok, secs: x.secs, lang: x.lang, dateStr: x.dateStr, ts: x.ts, nv: (x.versions || []).length } : null); } catch (e) {}
    all.sort((a, b) => b.ts - a.ts);
    const cnt = $('lsCount'); if (cnt) cnt.textContent = all.length ? String(all.length) : '';
    if (!all.length) { list.innerHTML = '<p class="pattern-desc">' + esc(T('Noch keine Lieder. Lade eine Songdatei, bearbeite den Text in der Improvisation und tippe auf „Lied mit Text speichern“.')) + '</p>'; return; }
    list.innerHTML = all.map(e => {
      const r = liveRec(e.singKey), tok = r && r.tok && r.tok.length ? r.tok : e.tok || [], lines = tok.length ? Math.max(...tok.map(t => t.l)) + 1 : 0;
      return '<div class="idea-row" data-id="' + esc(e.id) + '"><div class="idea-main"><div class="idea-name" translate="no">' + esc(e.name) + '</div>'
        + '<div class="log-meta" style="text-align:left">' + tok.length + ' ' + esc(T('Wörter')) + ' · ' + lines + ' ' + esc(T('Zeilen')) + ' · ' + mmss(e.secs || 0) + ' min' + (e.lang ? ' · ' + esc(e.lang.toUpperCase()) : '') + ' · ' + esc(e.dateStr || '') + '</div></div>'
        + '<div class="idea-actions"><button class="toggle-btn" data-act="load">' + esc(T('Laden')) + '</button><button class="toggle-btn" data-act="text">' + esc(T('Text')) + '</button>' + (e.nv ? '<button class="toggle-btn" data-act="vers">' + esc(T('Versionen')) + ' (' + e.nv + ')</button>' : '') + '<button class="toggle-btn" data-act="del">' + esc(T('Löschen')) + '</button></div></div>';
    }).join('');
  }

  list.addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const id = b.closest('.idea-row').dataset.id, act = b.dataset.act;
    if (act === 'load') load(id);
    else if (act === 'text') { const e = await AppDB.get('ideas', id); if (e) shareText(e); }
    else if (act === 'vers') {
      const row = b.closest('.idea-row'), open = row.querySelector('.ls-vers'); if (open) { open.remove(); return; }
      const e = await AppDB.get('ideas', id); if (!e || !e.versions) return;
      const box = document.createElement('div'); box.className = 'ls-vers';
      box.innerHTML = e.versions.map((v, k) => ({ v, k })).reverse().map(({ v, k }) => '<div class="ls-ver"><span>' + esc(v.dateStr || new Date(v.ts).toLocaleString()) + ' · ' + (v.tok || []).length + ' ' + esc(T('Wörter')) + '</span><button class="toggle-btn" data-act="restore" data-k="' + k + '">' + esc(T('zurückholen')) + '</button></div>').join('');
      row.appendChild(box);
    }
    else if (act === 'restore') {
      const e = await AppDB.get('ideas', id), v = e && e.versions && e.versions[+b.dataset.k]; if (!v) return;
      if (!confirm(T('Den Text dieser Version wiederherstellen? Der jetzige Stand wird als Version behalten.'))) return;
      // jetzigen Stand als Version behalten, dann die gewählte Version als aktuellen Text setzen
      const d = readSing(), cur = d.f[e.singKey];
      e.versions.push({ ts: Date.now(), dateStr: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }), tok: cur && cur.tok || e.tok, tr: cur && cur.tr || e.tr || null });
      while (e.versions.length > 12) e.versions.shift();
      e.tok = v.tok; e.tr = v.tr; await AppDB.put('ideas', e);
      d.f[e.singKey] = Object.assign(cur || { name: e.fname }, { tok: JSON.parse(JSON.stringify(v.tok)) }); if (v.tr) d.f[e.singKey].tr = v.tr;
      try { localStorage.setItem('3nps-sing', JSON.stringify(d)); } catch (x) {}
      if (window.Sing && Sing._reload) Sing._reload();
      say(T('Version wiederhergestellt: „') + e.name + '“'); render();
    }
    else if (act === 'del') { const e = await AppDB.get('ideas', id); if (e && confirm('„' + e.name + T('“ löschen? Der Text bleibt auf diesem Gerät erhalten, die gespeicherte Songdatei wird entfernt.'))) { await AppDB.del('ideas', id); say(''); render(); } }
  });
  const sb = $('lsSave'); if (sb) sb.addEventListener('click', () => save($('lsName') ? $('lsName').value : ''));
  // Knopf in der Improvisation
  const sg = $('sgSave');
  if (sg) sg.addEventListener('click', async () => {
    const t0 = sg.textContent; sg.disabled = true;
    const ok = await save('');
    sg.textContent = ok ? T('✓ Gespeichert') : T('Speichern nicht möglich'); setTimeout(() => { sg.textContent = t0; sg.disabled = false; }, 1800);
  });
  setTimeout(render, 300);
  window.Lieder = { save, load, render, textOf, pick };
})();
