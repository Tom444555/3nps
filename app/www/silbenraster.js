/* ---------- v167: Silben-Raster (Songwriting › Workflow Schritt 9 und Bereich „Text-Werkstatt“) ----------
   Erst bei Bedarf geladen (songwriting.js). Eine Textzeile wählen → Silben auf die Zählzeiten der Takte (1 e + e 2 e + e …, 4/4) verteilt,
   geschätzte Betonung fett/unterstrichen (gleiche Heuristik wie die Text-Werkstatt v164: LiedText.rhymePart; kurze Füllwörter unbetont),
   Hinweis, wenn betonte Silben neben den Schlag fallen. Silbe antippen, dann leeres Feld antippen oder ◀ ▶ = verschieben (Reihenfolge bleibt).
   Verschobene Lagen in „3nps-sw“ unter r['p:<Song>|<Teil>|<Mal>|<Zeile>'] = { t: Zeile, b: Takte, p: [Lagen] } (nur, solange die Zeile gleich bleibt). */
window.SilbenRaster = (() => {
  const U = {
    h: ['Silben-Raster', 'Syllable grid'],
    intro: ['Zeile wählen: die Silben liegen auf den Zählzeiten der Takte (1 e + e …). Fett = geschätzt betont – betonte Silben gehören auf die Schläge 1 2 3 4. Silbe antippen, dann ein freies Feld oder ◀ ▶ zum Verschieben.',
      'Choose a line: the syllables sit on the counts of the bars (1 e + a …). Bold = estimated stress – stressed syllables belong on beats 1 2 3 4. Tap a syllable, then a free cell or ◀ ▶ to move it.'],
    line: ['Zeile', 'Line'], bars: ['Takte', 'Bars'], left: ['◀ früher', '◀ earlier'], right: ['später ▶', 'later ▶'], fix: ['Betonte auf die Schläge', 'Stresses onto beats'], reset: ['Neu verteilen', 'Redistribute'],
    none: ['Noch kein Text im Song – erst in „Song“ › Text Zeilen schreiben.', 'No lyrics in the song yet – write lines in “Song” › Lyrics first.'], noSong: ['Erst oben einen Song wählen.', 'Choose a song above first.'],
    times: ['. Mal', '. time'], ln: ['Zeile', 'line'],
    ok: ['✓ Alle betonten Silben liegen auf Schlägen.', '✓ All stressed syllables are on beats.'],
    off: ['„%s“ (betont) liegt auf „%c“ von Schlag %b – besser auf einen Schlag.', '“%s” (stressed) is on “%c” of beat %b – better on a beat.'],
    offN: ['%n betonte Silben liegen neben dem Schlag.', '%n stressed syllables are off the beat.'],
    much: ['%n Silben passen nicht gut in %b Takte – Takt dazu (+) oder die Zeile kürzen.', '%n syllables do not fit well into %b bars – add a bar (+) or shorten the line.'],
    pick: ['Silbe „%s“ gewählt – freies Feld antippen oder ◀ ▶.', 'Syllable “%s” selected – tap a free cell or ◀ ▶.'], order: ['Silben bleiben in ihrer Reihenfolge – Feld zwischen den Nachbarn wählen.', 'Syllables keep their order – choose a cell between the neighbours.'],
    lim: ['Grenzen: Silben und Betonung nach der Schreibung geschätzt (wie die Text-Werkstatt: meist Stammsilbe, Endungen -e/-en/-er und Nachsilben wie -ung, -lich unbetont; bei zusammengesetzten Wörtern oft die letzte Stammsilbe; Fremdwörter und Englisch ungenau). 4/4-Takt angenommen; Takte je Zeile = Takte des Abschnitts geteilt durch seine Zeilen (mit − + änderbar).',
      'Limits: syllables and stress estimated from spelling (like the text workshop: mostly the stem syllable; endings -e/-en/-er and suffixes like -ung, -lich unstressed; compounds often get the last stem; loanwords and English are rough). 4/4 assumed; bars per line = bars of the section divided by its lines (change with − +).']
  };
  let X = null, host = null, cur = null, sel = -1, msg = '';
  const u = k => X.tx(U[k]);
  const FN = new Set(['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder', 'aber', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'sich', 'mir', 'dir', 'uns', 'euch', 'in', 'im', 'an', 'am', 'auf', 'aus', 'bei', 'mit', 'von', 'vom', 'zu', 'zum', 'zur', 'für', 'ist', 'bin', 'bist', 'sind', 'war', 'hat', 'hab', 'hast', 'nicht', 'noch', 'nur', 'so', 'wie', 'was', 'wenn', 'dass', 'als', 'ob', 'mein', 'dein', 'sein', 'kein', 'nach', 'vor', 'um', 'durch', 'bis',
    'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'at', 'it', 'is', 'i', 'you', 'my', 'me', 'we', 'be', 'your', 'for', 'with', 'but', 'by', 'as', 'was', 'are', 'am']);
  const VG = /(ie|ei|ai|eu|äu|au|aa|ee|oo|[aeiouyäöüéèàáíóú])/g;
  // Wort → Silben mit Betonung
  function wordSyl(w) {
    const lw = w.toLowerCase(), g = [...lw.matchAll(VG)]; if (!g.length) return [{ t: w, s: false }];
    const n = g.length, cuts = [0];
    for (let k = 0; k < n - 1; k++) {
      const e = g[k].index + g[k][0].length, b = g[k + 1].index, cl = lw.slice(e, b);
      if (!cl.length) { cuts.push(b); continue; }
      const m = cl.match(/sch$|ch$|ck$|ph$|th$|qu$|.$/); cuts.push(cl.length === 1 ? e : b - m[0].length);   // vor den letzten Konsonanten
    }
    const parts = cuts.map((c, i) => w.slice(c, i + 1 < cuts.length ? cuts[i + 1] : w.length));
    let j = 0;
    if (n === 1) j = FN.has(lw.replace(/'/g, '')) ? -1 : 0;
    else { try { const rp = window.LiedText && LiedText.rhymePart ? LiedText.rhymePart(lw) : null; j = rp && rp.n === n ? rp.stressed : 0; } catch (e) { j = 0; } }
    return parts.map((t, i) => ({ t, s: i === j }));
  }
  function sylls(text) {
    const out = []; (String(text || '').replace(/\[[^\]]*\]/g, '').match(/[A-Za-zÄÖÜäöüßéèàáíóúâêôû']+/g) || []).forEach(w => wordSyl(w).forEach((x, i, a) => out.push({ t: x.t + (i < a.length - 1 ? '-' : ''), s: x.s }))); return out;
  }
  // alle Zeilen der aktuellen Version
  function lines() {
    const s = X.song(), v = X.ver(), A = window.LiedApi; if (!s || !v || !A || !A.textSlots) return [];
    const out = [];
    A.textSlots(v).forEach(z => {
      const p = z.p, t = String((p.lyrics || [])[z.n] || ''), ls = t.split('\n'), filled = ls.filter(x => x.replace(/\[[^\]]*\]/g, '').trim()).length;
      const beats = (p.chords || []).reduce((a, c) => a + (+c.beats || 0), 0), bars = Math.max(1, Math.round(beats / 4) || 1);
      let k = 0;
      ls.forEach((x, li) => { const c = x.replace(/\[[^\]]*\]/g, '').trim(); if (!c) return; k++;
        out.push({ key: s.id + '|' + p.id + '|' + z.n + '|' + li, text: c, lab: p.name + (z.multi ? ' · ' + (z.n + 1) + u('times') : '') + ' · ' + u('ln') + ' ' + k, bars: Math.max(1, Math.round(bars / Math.max(1, filled))) }); });
    });
    return out;
  }
  function spread(n, S) {
    const p = [], half = S / 2;
    for (let i = 0; i < n; i++) p.push(n <= half ? Math.round(i * half / n) * 2 : Math.round(i * S / n));
    for (let i = 1; i < n; i++) if (p[i] <= p[i - 1]) p[i] = p[i - 1] + 1;
    return p;
  }
  function state(L) {
    const sy = sylls(L.text), sv = X.D.r['p:' + L.key];
    let b = sv && sv.t === L.text && sv.b ? sv.b : L.bars;
    if (sy.length > b * 16) b = Math.ceil(sy.length / 16);
    const S = b * 16, p = sv && sv.t === L.text && Array.isArray(sv.p) && sv.p.length === sy.length && sv.p.every(x => x < S) ? sv.p.slice() : spread(sy.length, S);
    return { L, sy, b, S, p };
  }
  const save = st => { X.D.r['p:' + st.L.key] = { t: st.L.text, b: st.b, p: st.p }; X.store(); };
  const CNT = ['', 'e', '+', 'e'], CNT_EN = ['', 'e', '+', 'a'];
  const cntOf = i => i % 4 ? (X.EN() ? CNT_EN : CNT)[i % 4] : String((i % 16) / 4 + 1);
  const offs = st => st.sy.map((x, i) => x.s && st.p[i] % 4 ? i : -1).filter(i => i >= 0);
  function paint() {
    if (!host || !host.isConnected) return;
    const esc = X.esc, s = X.song();
    let h = '<div class="sr" translate="no"><h3>' + esc(u('h')) + '</h3><p class="caption">' + esc(u('intro')) + '</p>';
    const ls = s ? lines() : [];
    if (!s || !ls.length) { host.innerHTML = h + '<p class="caption">' + esc(u(s ? 'none' : 'noSong')) + '</p></div>'; cur = null; return; }
    const want = (X.D.r.sel && X.D.r.sel[s.id]) || (cur && cur.L.key), L = ls.find(x => x.key === want) || ls[0];
    if (!cur || cur.L.key !== L.key || cur.L.text !== L.text) { cur = state(L); sel = -1; }
    else { const keep = cur; cur = state(L); if (keep.p.length === cur.p.length && !X.D.r['p:' + L.key]) { cur.p = keep.p; cur.b = keep.b; cur.S = keep.S; } }
    const st = cur, at = {}; st.p.forEach((x, i) => { at[x] = i; });
    h += '<div class="sr-row"><label class="sr-f"><span class="caption">' + esc(u('line')) + '</span><select data-sr="line">' + ls.map(x => '<option value="' + esc(x.key) + '"' + (x.key === L.key ? ' selected' : '') + '>' + esc(x.lab + ': ' + x.text.slice(0, 60)) + '</option>').join('') + '</select></label>'
      + '<span class="sr-bars"><span class="caption">' + esc(u('bars')) + '</span><button type="button" class="toggle-btn" data-sr="b-" aria-label="−1">−</button><b>' + st.b + '</b><button type="button" class="toggle-btn" data-sr="b+" aria-label="+1">+</button></span></div><div class="sr-grid">';
    for (let b = 0; b < st.b; b++) {
      h += '<div class="sr-bar">';
      for (let c = 0; c < 16; c++) {
        const g = b * 16 + c, i = at[g], y = i != null ? st.sy[i] : null;
        h += '<button type="button" class="sr-c' + (c % 4 ? '' : ' beat') + (c ? '' : ' one') + (y ? ' has' : '') + (y && y.s ? ' str' : '') + (y && y.s && c % 4 ? ' off' : '') + (i != null && i === sel ? ' sel' : '') + '" data-c="' + g + '"'
          + ' aria-label="' + esc((b + 1) + '.' + cntOf(c) + (y ? ' ' + y.t : '')) + '"><i>' + esc(cntOf(c)) + '</i><span>' + (y ? esc(y.t) : '') + '</span></button>';
      }
      h += '</div>';
    }
    const o = offs(st), hints = [];
    if (st.sy.length > st.b * 8) hints.push('<li class="warn">' + esc(u('much').replace('%n', st.sy.length).replace('%b', st.b)) + '</li>');
    if (!o.length) hints.push('<li class="ok">' + esc(u('ok')) + '</li>');
    else { hints.push('<li class="warn"><b>' + esc(u('offN').replace('%n', o.length)) + '</b></li>'); o.slice(0, 4).forEach(i => { const g = st.p[i]; hints.push('<li class="warn">' + esc(u('off').replace('%s', st.sy[i].t.replace(/-$/, '')).replace('%c', cntOf(g)).replace('%b', Math.floor((g % 16) / 4) + 1)) + '</li>'); }); }
    if (msg) hints.push('<li>' + esc(msg) + '</li>');
    h += '</div><div class="sr-act"><button type="button" class="toggle-btn" data-sr="left"' + (sel < 0 ? ' disabled' : '') + '>' + esc(u('left')) + '</button><button type="button" class="toggle-btn" data-sr="right"' + (sel < 0 ? ' disabled' : '') + '>' + esc(u('right')) + '</button>'
      + '<button type="button" class="toggle-btn" data-sr="fix"' + (o.length ? '' : ' disabled') + '>' + esc(u('fix')) + '</button><button type="button" class="toggle-btn" data-sr="reset">' + esc(u('reset')) + '</button></div>'
      + '<ul class="sr-hint" role="status">' + hints.join('') + '</ul><p class="sr-lim">' + esc(u('lim')) + '</p></div>';
    host.innerHTML = h;
  }
  function moveTo(i, g) { const st = cur, lo = i > 0 ? st.p[i - 1] : -1, hi = i < st.p.length - 1 ? st.p[i + 1] : st.S; if (g <= lo || g >= hi || g < 0) return false; st.p[i] = g; save(st); return true; }
  function fix() {
    const st = cur;
    for (let pass = 0; pass < 2; pass++) offs(st).forEach(i => { const g = st.p[i], d = Math.floor(g / 4) * 4, up = d + 4; if (!moveTo(i, d) && !moveTo(i, up)) { /* bleibt – Nachbarn im Weg */ } });
  }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled || !cur) return; msg = '';
    const a = b.dataset.sr, st = cur;
    if (b.dataset.c != null) {
      const g = +b.dataset.c, i = st.p.indexOf(g);
      if (i >= 0) { sel = sel === i ? -1 : i; if (sel >= 0) msg = u('pick').replace('%s', st.sy[i].t.replace(/-$/, '')); }
      else if (sel >= 0 && !moveTo(sel, g)) msg = u('order');
      paint(); return;
    }
    if (a === 'left' || a === 'right') { if (sel >= 0 && !moveTo(sel, st.p[sel] + (a === 'left' ? -1 : 1))) msg = u('order'); }
    else if (a === 'fix') fix();
    else if (a === 'reset') { delete X.D.r['p:' + st.L.key]; X.store(); cur = null; sel = -1; }
    else if (a === 'b-' || a === 'b+') {
      const nb = Math.max(1, Math.min(8, st.b + (a === 'b+' ? 1 : -1))); if (nb * 16 < st.sy.length) return;
      X.D.r['p:' + st.L.key] = { t: st.L.text, b: nb, p: spread(st.sy.length, nb * 16) }; X.store(); cur = null; sel = -1;
    }
    paint();
  }
  function onChange(e) {
    const t = e.target; if (t.dataset.sr !== 'line') return; const s = X.song(); if (!s) return;
    if (!X.D.r.sel || typeof X.D.r.sel !== 'object') X.D.r.sel = {}; X.D.r.sel[s.id] = t.value; X.store(); cur = null; sel = -1; msg = ''; paint();
  }
  function render(h, ctx) {
    X = ctx; if (host !== h) { host = h; if (!h.dataset.sr) { h.dataset.sr = '1'; h.addEventListener('click', onClick); h.addEventListener('change', onChange); } }
    paint();
  }
  return { render, refresh: paint, sylls, wordSyl, spread, _st: () => cur ? { key: cur.L.key, text: cur.L.text, b: cur.b, p: cur.p.slice(), sy: cur.sy.map(x => x.t + (x.s ? '*' : '')), off: offs(cur).length, sel } : null };
})();
