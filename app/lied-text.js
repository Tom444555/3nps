// ---- Songwriting, Text und Song-Code: Silben, Reime, Textprüfung, Leadsheet-Modell, Austausch mit Claude. Ohne Oberfläche, in Node testbar. ----
// Text liegt am Teil: part.lyrics = [Text beim 1. Spielen, beim 2. Spielen, …]; im Text sind Akkordmarken wie „[Am]“ erlaubt.
// Thema/Idee des Songs: version.theme.
const LiedText = (() => {
  const C = (typeof LiedCore !== 'undefined') ? LiedCore : require('./lied-core.js');
  const md = C.md;

  // ================= Akkorde als Text =================
  const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
  function parseChords(text) {
    const out = [], bad = [];
    (text || '').replace(/[|;]|,(?!\d)/g, ' ').split(/\s+/).filter(Boolean).forEach(tok => {
      const m = /^([A-Ha-h])([#♯b♭]?)([^:*]*)(?:[:*]([0-9.,½¼/]+))?$/.exec(tok.trim());
      if (!m) { bad.push(tok); return; }
      const acc = m[2] === '#' || m[2] === '♯' ? 1 : (m[2] === 'b' || m[2] === '♭') ? -1 : 0;
      const t = m[3].replace('♭', 'b').replace(/^min/, 'm').replace(/^-/, 'm').replace('Δ', 'maj7').replace(/^M7$/, 'maj7').replace(/^°$/, 'dim').replace(/^ø$/, 'm7b5').replace(/^m7-5$/, 'm7b5').replace(/^sus$/, 'sus4');
      if (!(t in C.CH)) { bad.push(tok); return; }
      let bars = 1;
      if (m[4]) {
        const s = m[4]; let v = s === '½' ? 0.5 : s === '¼' ? 0.25 : /^\d+\/\d+$/.test(s) ? +s.split('/')[0] / +s.split('/')[1] : parseFloat(s.replace(',', '.'));
        if (!(v > 0 && v <= 16)) { bad.push(tok); return; } bars = v;
      }
      out.push({ r: md(BASE[m[1].toUpperCase()] + acc), t, beats: Math.max(1, Math.round(bars * 4)) });
    });
    return { seq: out, bad };
  }
  const ascii = s => s.replace(/♯/g, '#').replace(/♭/g, 'b').replace('°', 'dim').replace('m7♭5', 'm7b5');
  const barsTxt = b => b === 4 ? '' : ':' + (b % 4 === 0 ? String(b / 4) : b === 2 ? '½' : b === 1 ? '¼' : String(b / 4).replace('.', ','));
  const chordName = (c, k) => ascii(C.cname(c, k));
  const chordText = (cs, k) => cs.map(c => chordName(c, k) + barsTxt(c.beats)).join(' ');

  // ================= Silben und Reime =================
  const EN = new Set(['the', 'and', 'you', 'i', 'my', 'me', 'your', 'is', 'it', 'to', 'of', 'in', 'on', 'we', 'love', 'night', 'heart', 'be', 'all', 'with', 'when', 'what', 'don\'t', 'i\'m', 'can', 'just', 'this', 'that', 'so', 'oh', 'baby', 'will', 'are']);
  const DE = new Set(['der', 'die', 'das', 'und', 'ich', 'du', 'nicht', 'ist', 'ein', 'eine', 'mein', 'dein', 'wir', 'mit', 'auf', 'in', 'zu', 'es', 'sie', 'wie', 'was', 'noch', 'nur', 'mich', 'dich', 'uns', 'den', 'dem', 'bin', 'bist', 'hab', 'kein', 'wenn']);
  const words = s => (stripChords(s).toLowerCase().match(/[a-zäöüßéèàáíóúâêôû']+/g) || []).map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);
  const stripChords = s => String(s || '').replace(/\[[^\]]*\]/g, '');
  function lang(texts) {
    let en = 0, de = 0;
    texts.forEach(t => words(t).forEach(w => { if (EN.has(w)) en++; if (DE.has(w)) de++; if (/[äöüß]/.test(w)) de += 2; }));
    return en > de * 1.3 && en >= 2 ? 'en' : 'de';
  }
  function sylWord(w, lg) {
    if (lg === 'en') {
      w = w.replace(/'/g, '');
      if (w.length <= 3) return Math.max(1, (w.match(/[aeiouy]+/g) || []).length);
      let n = (w.match(/[aeiouy]+/g) || []).length;
      if (/[^aeiouy]e$/.test(w) && !/[^aeiouy]le$/.test(w) && n > 1) n--;
      else if (/[^aeiouytd]ed$/.test(w) && n > 1) n--;
      else if (/[^aeiouysxzcg]es$/.test(w) && n > 1) n--;
      if (/^y[aeiou]/.test(w)) n = Math.max(1, n);
      return Math.max(1, n);
    }
    const n = (w.match(/(aa|ee|oo|ie|ei|ai|au|eu|äu|ey|ay|[aeiouyäöüéèàáíóú])/g) || []).length;
    return Math.max(1, n);
  }
  const syllables = (line, lg) => words(line).reduce((a, w) => a + sylWord(w, lg || 'de'), 0);
  function rhymeKey(word, lg) {
    let w = String(word || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
    if (!w) return null;
    if (lg === 'en') {
      w = w.replace(/([^aeiou])y$/, '$1i').replace(/([^aeiou])y([^aeiou])/g, '$1i$2').replace(/ph/g, 'f').replace(/ck/g, 'k');
      const groups = [...w.matchAll(/[aeiou]+/g)];
      if (!groups.length) return w;
      let g = groups[groups.length - 1];
      if (groups.length > 1 && /[^aeiou]e$/.test(w) && g.index === w.length - 1) g = groups[groups.length - 2];   // stummes e
      else if (groups.length > 1 && /[^aeiou]e[sd]$/.test(w) && g.index === w.length - 2) g = groups[groups.length - 2];
      return w.slice(g.index).replace(/e$/, '').replace(/es$|ed$/, '');
    }
    w = w.replace(/ß/g, 'ss').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/tz/g, 'z').replace(/dt$/, 't').replace(/äu/g, 'eu').replace(/ai/g, 'ei')
      .replace(/ie/g, 'I').replace(/([aeiouäöü])h(?![aeiouäöü])/g, '$1').replace(/aa/g, 'a').replace(/ee/g, 'e').replace(/oo/g, 'o')
      .replace(/d$/, 't').replace(/([aeiouäöüI])b$/, '$1p').replace(/([aeiouäöüIrln])g$/, '$1k').replace(/v/g, 'f');
    const groups = [...w.matchAll(/(ei|eu|au|[aeiouäöüyI])/g)];
    if (!groups.length) return w;
    let i = groups.length - 1;
    // unbetonte Endsilbe (-e, -en, -er, -el, -em, -es) → ab der Silbe davor
    const tail = w.slice(groups[i].index);
    if (i > 0 && groups[i][0] === 'e' && /^e(n|r|l|m|s|nd|rn|ns)?$/.test(tail)) i--;
    return w.slice(groups[i].index);
  }
  const rhymes = (a, b, lg) => !!a && !!b && (a === b || (lg === 'en' && a.length >= 3 && b.length >= 3 && a.slice(-3) === b.slice(-3) && /[aeiou]/.test(a.slice(-3))));
  const vowelsOf = k => (k || '').replace(/[^aeiouäöüyI]/g, '');
  const lastWord = line => { const ws = words(line); return ws.length ? ws[ws.length - 1] : ''; };
  // je Zeile: Silben, Reimbuchstabe (A, B, …), ob der Reim nur unrein (gleiche Vokale) ist
  function lines(text, lg) {
    const L = String(text || '').split('\n'), out = [], keys = [];
    let letter = 0;
    L.forEach(raw => {
      const t = stripChords(raw).trim();
      if (!t) { out.push({ raw, empty: true }); return; }
      const lw = lastWord(t), k = rhymeKey(lw, lg), vk = vowelsOf(k);
      let hit = keys.find(x => rhymes(x.k, k, lg) && x.w !== lw) || keys.find(x => rhymes(x.k, k, lg));
      let near = false;
      if (!hit && vk && k.length > 1) { const h2 = keys.find(x => x.k && x.k.length > 1 && vowelsOf(x.k) === vk); if (h2) { hit = h2; near = true; } }
      const L2 = hit ? hit.L : String.fromCharCode(65 + (letter++ % 26));
      keys.push({ k, w: lw, L: L2 });
      out.push({ raw, text: t, syl: syllables(t, lg), letter: L2, near, word: lw, same: !!(hit && hit.w === lw) });
    });
    // Buchstaben ohne Partner markieren
    const cnt = {}; out.forEach(x => { if (x.letter) cnt[x.letter] = (cnt[x.letter] || 0) + 1; });
    out.forEach(x => { if (x.letter) x.alone = cnt[x.letter] === 1; });
    return out;
  }
  const scheme = ls => ls.filter(x => !x.empty).map(x => x.letter).join('');

  // ================= Text am Ablauf =================
  const REPEATS = new Set(['chorus', 'pre', 'intro', 'outro', 'solo']);
  // Vorkommen jedes Teils im Ablauf: n = wievieltes Mal dieser Teil gespielt wird
  function occurrences(v) {
    const seen = {}; return C.flat(v).map(x => { const n = seen[x.p.id] = (seen[x.p.id] == null ? 0 : seen[x.p.id] + 1); return { p: x.p, oi: x.oi, rep: x.rep, n }; });
  }
  // Text eines Vorkommens: eigener Text, sonst (bei Refrain & Co.) der vom ersten Mal
  function lyricsOf(p, n) {
    const L = p.lyrics || [];
    if (L[n] && L[n].trim()) return { text: L[n], own: true };
    if (n > 0 && REPEATS.has(p.type) && L[0] && L[0].trim()) return { text: L[0], own: false, same: true };
    return { text: '', own: false };
  }
  function allTexts(v) { const t = []; v.parts.forEach(p => (p.lyrics || []).forEach(x => { if (x) t.push(x); })); return t; }
  const hasText = v => allTexts(v).some(x => x.trim());

  // ================= Textprüfung =================
  function analyse(v, title) {
    const F = [], add = (lvl, text, part) => F.push({ lvl, text, part: part || null });
    if (!hasText(v)) { if (v.parts.length) add('tip', 'Noch kein Text. Schreib im Bereich „Text“ erste Zeilen – oder lass dir mit „Mit Claude weiterarbeiten“ helfen.'); return F; }
    const lg = lang(allTexts(v)), occ = occurrences(v);
    // fehlende Texte
    const miss = [];
    occ.forEach(o => { const l = lyricsOf(o.p, o.n); if (!l.text.trim() && o.p.type !== 'solo' && o.p.type !== 'intro' && o.p.type !== 'outro') miss.push(o.p.name + (o.n ? ' (' + (o.n + 1) + '. Mal)' : '')); });
    const uniq = [...new Set(miss)];
    if (uniq.length) add('tip', 'Ohne Text: ' + uniq.slice(0, 5).join(', ') + (uniq.length > 5 ? ' …' : '') + '.');
    else add('ok', 'Jeder gesungene Teil hat Text.');
    // Silben: gleiche Zeile in Strophe 1 und 2 sollte etwa gleich lang sein (gleiche Melodie)
    v.parts.forEach(p => {
      const L = (p.lyrics || []).map(t => lines(t, lg).filter(x => !x.empty));
      if (L.length < 2 || !L[0].length) return;
      for (let n = 1; n < L.length; n++) {
        const bad = []; L[n].forEach((x, i) => { const a = L[0][i]; if (a && Math.abs(a.syl - x.syl) > 2) bad.push(i + 1); });
        if (bad.length) add('tip', '„' + p.name + '“, ' + (n + 1) + '. Mal: Zeile ' + bad.join(', ') + ' hat deutlich mehr oder weniger Silben als beim 1. Mal – auf dieselbe Melodie wird es eng. Kürzen oder Füllwörter ergänzen.', p.id);
        if (L[n].length && L[n].length !== L[0].length) add('info', '„' + p.name + '“: beim ' + (n + 1) + '. Mal ' + L[n].length + ' Zeilen, beim 1. Mal ' + L[0].length + '.', p.id);
      }
    });
    // Dichte und Zeilen je Takt
    v.parts.forEach(p => {
      const t = lyricsOf(p, 0).text; if (!t.trim()) return;
      const ls = lines(t, lg).filter(x => !x.empty), bars = C.beatsOf(p) / 4, syl = ls.reduce((a, x) => a + x.syl, 0);
      if (bars && syl / bars > 11) add('tip', '„' + p.name + '“ ist sehr textreich (' + Math.round(syl / bars) + ' Silben je Takt). Bei ' + Math.round(v.bpm) + ' BPM wird das schnell gesungen – kürzen oder den Teil verlängern.', p.id);
      if (bars && ls.length && bars % ls.length && ls.length % bars) add('info', '„' + p.name + '“: ' + ls.length + ' Zeilen auf ' + bars + ' Takte – teilt sich nicht gleichmäßig. Üblich sind 1, 2 oder 4 Takte je Zeile.', p.id);
      const sch = scheme(lines(t, lg));
      if (ls.length >= 4 && new Set(sch).size === sch.length) add('info', '„' + p.name + '“ reimt sich nirgends (' + sch + '). Gewollt? Ein Reim am Zeilenende (z. B. ABAB oder AABB) macht Text leichter merkbar.', p.id);
    });
    // Titel im Refrain
    const ch = v.parts.find(p => p.type === 'chorus' && lyricsOf(p, 0).text.trim());
    if (ch && title && !/^Song \d+$/.test(title)) {
      const tw = words(title).filter(w => w.length > 2), txt = words(lyricsOf(ch, 0).text).join(' ');
      if (tw.length && !tw.some(w => txt.includes(w))) add('tip', 'Der Songtitel „' + title + '“ kommt im Refrain nicht vor. Meist steht er in der Hook-Zeile – so merkt man sich den Song.', ch.id);
      else if (tw.length) add('ok', 'Der Titel steckt im Refrain.');
    }
    // Refrain-Hook: wiederholte Zeile?
    if (ch) {
      const ls = lines(lyricsOf(ch, 0).text, lg).filter(x => !x.empty), c2 = {};
      ls.forEach(x => { const k = x.text.toLowerCase(); c2[k] = (c2[k] || 0) + 1; });
      if (ls.length >= 4 && !Object.values(c2).some(n => n > 1) && !(title && ls.some(x => x.text.toLowerCase().includes(title.toLowerCase())))) add('info', 'Im Refrain wiederholt sich keine Zeile. Eine wiederkehrende Hook-Zeile (Anfang und Ende des Refrains) bleibt besser hängen.', ch.id);
    }
    return F;
  }

  // ================= Leadsheet-Modell =================
  // Zeile = { text, chords: [{ i (Zeichen), n (Name) }] }; Abschnitt = { head, rows } oder { head, grid } (nur Akkorde)
  function inlineChords(raw) {
    const ch = []; let text = '';
    String(raw).replace(/\[([^\]]*)\]|([^[]+)/g, (m, c, t) => { if (c != null) ch.push({ i: text.length, n: c.trim() }); else text += t; return ''; });
    return { text, chords: ch };
  }
  function gridOf(p, k) {
    const bars = []; let beat = 0;
    p.chords.forEach(c => { const b = Math.floor(beat / 4); (bars[b] = bars[b] || []).push(chordName(c, k)); beat += c.beats; });
    const nb = Math.ceil(beat / 4); for (let i = 0; i < nb; i++) if (!bars[i]) bars[i] = ['%'];
    return bars.map(b => b.join(' '));
  }
  // Akkorde ohne Marken: gleichmäßig über die Zeilen verteilen, am Wortanfang
  function autoRows(text, p, k) {
    const raw = String(text).split('\n'), ls = raw.map(r => r.trim()), idx = ls.map((l, i) => l ? i : -1).filter(i => i >= 0);
    const rows = ls.map(t => ({ text: t, chords: [] }));
    if (!idx.length || !p.chords.length) return rows;
    const B = C.beatsOf(p), span = B / idx.length;
    let beat = 0;
    p.chords.forEach(c => {
      const li = Math.min(idx.length - 1, Math.floor(beat / span + 1e-6)), row = rows[idx[li]], frac = (beat - li * span) / span;
      let pos = Math.round(frac * row.text.length);
      if (pos > 0) { const s = row.text.lastIndexOf(' ', pos); const n2 = row.text.indexOf(' ', pos); pos = s < 0 ? 0 : (n2 >= 0 && n2 - pos < pos - s ? n2 + 1 : s + 1); }
      if (pos >= row.text.length && row.text.length) pos = Math.max(0, row.text.lastIndexOf(' ') + 1);
      row.chords.push({ i: pos, n: chordName(c, k) });
      beat += c.beats;
    });
    return rows;
  }
  function leadsheet(song, v) {
    const k = v.key, occ = occurrences(v), secs = [], cnt = {}, printed = {};
    occ.forEach((o, j) => {
      const p = o.p, l = lyricsOf(p, o.n), prev = secs[secs.length - 1];
      const multi = occ.filter(x => x.p === p).length > 1, tname = !REPEATS.has(p.type) && multi ? p.name + ' ' + (o.n + 1) : p.name;
      // gleicher Teil direkt wiederholt mit gleichem Text → „×2“
      if (prev && prev.pid === p.id && prev.txt === l.text) { prev.times++; prev.head = prev.base + ' ×' + prev.times; return; }
      const s = { pid: p.id, txt: l.text, base: tname, head: tname, times: 1, type: p.type };
      if (!l.text.trim()) s.grid = gridOf(p, k);
      else if (printed[p.id + '|' + l.text]) { s.head = tname + ' (wie oben)'; s.base = s.head; s.same = true; s.grid = null; s.rows = []; }
      else {
        printed[p.id + '|' + l.text] = true;
        s.rows = /\[[^\]]+\]/.test(l.text) ? String(l.text).split('\n').map(r => { const x = inlineChords(r.trim()); return { text: x.text, chords: x.chords }; }) : autoRows(l.text, p, k);
        s.chordLine = chordText(p.chords, k);
      }
      secs.push(s); cnt[p.id] = (cnt[p.id] || 0) + 1;
    });
    const L = C.totals(v), order = v.order.map(o => { const p = C.partById(v, o.p); return p ? p.name + (o.reps > 1 ? ' ×' + o.reps : '') : ''; }).filter(Boolean).join(' – ');
    return { title: song.name, info: C.keyLabel(k).replace(/♯/g, '#').replace(/♭/g, 'b') + ' · ' + Math.round(v.bpm) + ' BPM · ' + C.mmss(L.secs) + ' · Version ' + v.n, theme: v.theme || '', order, sections: secs };
  }

  // ================= Song-Code (Austausch mit Claude) =================
  const HEAD = '=== 3NPS SONG-CODE v1 ===', END = '=== ENDE ===';
  const TNAME = { intro: 'Intro', verse: 'Strophe', pre: 'Pre-Chorus', chorus: 'Refrain', bridge: 'Bridge', solo: 'Solo', outro: 'Outro', other: 'Teil' };
  const TFIND = [['intro', /^intro/i], ['pre', /^pre|vorrefrain|pre-?chorus/i], ['chorus', /^(refrain|chorus|hook|ref)/i], ['verse', /^(strophe|verse|vers)/i], ['bridge', /^(bridge|zwischenteil|mittelteil)/i], ['solo', /^(solo|instrumental)/i], ['outro', /^(outro|schluss|ende)/i], ['other', /^(teil|part|other)/i]];
  const typeOf = s => { s = String(s || '').trim(); for (const [k, re] of TFIND) if (re.test(s)) return k; return null; };
  function labels(v) {
    const used = {}, m = {};
    v.parts.forEach(p => { let n = (p.name || 'Teil').replace(/[\[\]|#]/g, '').trim() || 'Teil'; const base = n; let i = 2; while (used[n.toLowerCase()]) n = base + ' ' + i++; used[n.toLowerCase()] = 1; m[p.id] = n; });
    return m;
  }
  function keyText(k) { return C.keyLabel(k).replace(/♯/g, '#').replace(/♭/g, 'b'); }
  function parseKey(s) {
    const m = /^\s*([A-Ha-h])\s*([#♯b♭]?)\s*-?\s*(dur|moll|major|minor|maj|min|m)?\b/i.exec(String(s || '')); if (!m) return null;
    const pc = md(BASE[m[1].toUpperCase()] + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0));
    const q = (m[3] || '').toLowerCase(); return { pc, major: !(q === 'moll' || q === 'minor' || q === 'min' || q === 'm') };
  }
  const GOALS = {
    feedback: { n: 'Feedback zum ganzen Song', t: 'Gib mir ehrliches, konkretes Feedback zu Aufbau, Akkorden und Text – was trägt, was schwächelt – und mach Verbesserungsvorschläge. Ändere den Song-Code nur dort, wo du dir sicher bist, dass es besser wird.' },
    text: { n: 'Text weiterschreiben', t: 'Schreib den Text weiter: Fülle leere Textstellen (fehlende Strophen, Refrain, Bridge) passend zu Thema, Stimmung und Silbenzahl der vorhandenen Zeilen. Vorhandene Zeilen nur ändern, wenn es nötig ist.' },
    reime: { n: 'Reime und Silben glätten', t: 'Verbessere Reime und Sprachrhythmus: Parallele Zeilen (z. B. Strophe 1 und 2) sollen etwa gleich viele Silben haben, das Reimschema soll sauber sein, Betonungen sollen natürlich auf die Takte fallen. Inhalt und Bilder beibehalten.' },
    hook: { n: 'Refrain stärker machen', t: 'Mach den Refrain stärker: eine einprägsame Hook-Zeile (am besten mit dem Titel), klare Wiederholung. Wenn es hilft, die Akkorde des Refrains so ändern, dass er sich deutlich von der Strophe abhebt.' },
    akkorde: { n: 'Akkorde interessanter', t: 'Mach die Akkorde interessanter (z. B. geliehene Akkorde, Septimen, Sus-Akkorde, bessere Übergänge zwischen den Teilen), aber bleib im Stil und in der Tonart. Text unverändert lassen.' },
    bridge: { n: 'Bridge schreiben', t: 'Schreib eine Bridge (Akkorde und Text), die Kontrast bringt – neue Akkorde, neue Perspektive im Text – und setz sie vor den letzten Refrain in den Ablauf.' },
    eigen: { n: 'Eigener Wunsch …', t: '' }
  };
  function toCode(song, v, opts) {
    opts = opts || {};
    const lab = labels(v), k = v.key, out = [HEAD];
    out.push('Titel: ' + (song && song.name || 'Ohne Titel'));
    out.push('Tonart: ' + keyText(k));
    out.push('Tempo: ' + Math.round(v.bpm));
    out.push('Thema: ' + String(v.theme || '').replace(/\s*\n\s*/g, ' '));
    if (opts.voice) out.push('Stimme: ' + opts.voice);
    out.push('Ablauf: ' + v.order.map(o => lab[o.p] ? lab[o.p] + (o.reps > 1 ? ' x' + o.reps : '') : '').filter(Boolean).join(' | '));
    const occ = occurrences(v), times = {}; occ.forEach(o => { times[o.p.id] = (times[o.p.id] || 0) + 1; });
    v.parts.forEach(p => {
      out.push(''); out.push('## ' + lab[p.id] + ' [' + TNAME[p.type] + ']');
      out.push('Akkorde: ' + chordText(p.chords, k));
      const L = p.lyrics || [], n = Math.max(L.length, REPEATS.has(p.type) ? 1 : (times[p.id] || 1), 1);
      for (let i = 0; i < n; i++) {
        const t = String(L[i] || '').replace(/\s+$/, '');
        if (i > 0 && !t && REPEATS.has(p.type)) continue;
        out.push('Text ' + (i + 1) + ':'); out.push(t || '(leer)');
      }
    });
    out.push(''); out.push('Notiz:'); out.push(END);
    return out.join('\n');
  }
  function prompt(song, v, goal, own, voice) {
    const g = GOALS[goal] || GOALS.feedback, task = goal === 'eigen' ? (own || '').trim() || GOALS.feedback.t : g.t;
    return 'Ich schreibe einen Song mit meiner Gitarren-App „3nps“ und singe ihn selbst.\n\n'
      + 'Aufgabe: ' + task + '\n\n'
      + 'Bitte antworte mit dem vollständigen Song-Code (von „' + HEAD + '“ bis „' + END + '“) in einem Codeblock, damit ich ihn direkt in die App einfügen kann. Erklärungen gern außerhalb des Codeblocks.\n'
      + 'Regeln für den Song-Code:\n'
      + '- Akkorde eines Teils in einer Zeile; ein Akkord = 1 Takt (4/4). „Am:2“ = 2 Takte, „C:½“ = halber Takt. Namen wie C, Am, F#m, Bb, G7, Cmaj7, Am7, Dsus4, Bdim, Bm7b5, Cadd9.\n'
      + '- Jeder Teil beginnt mit „## Name [Typ]“. Typen: Intro, Strophe, Pre-Chorus, Refrain, Bridge, Solo, Outro, Teil. Neue Teile sind erlaubt.\n'
      + '- „Ablauf:“ nennt die Teile genau mit ihren Namen, getrennt durch „|“, Wiederholung direkt hintereinander mit „x2“.\n'
      + '- „Text 1:“ ist der Text beim ersten Spielen des Teils, „Text 2:“ beim zweiten usw. Beim Refrain genügt meist „Text 1“. „(leer)“ = noch kein Text. Akkordwechsel darfst du mit [Am] direkt vor der Silbe markieren.\n'
      + '- Unter „Notiz:“ in einer Zeile kurz zusammenfassen, was du geändert hast.\n\n'
      + toCode(song, v, { voice }) + '\n';
  }
  // Song-Code einlesen; base = bisherige Version (Teile mit gleichem Namen behalten ihre Aufnahme)
  function fromCode(text, base) {
    const errs = [], warn = [];
    let s = String(text || '').replace(/\r/g, '');
    const a = s.search(/=+\s*3NPS\s+SONG-CODE/i);
    if (a < 0) return { ok: false, errs: ['Kein Song-Code gefunden. Er beginnt mit „' + HEAD + '“ – kopiere Claudes Antwort komplett (oder nur den Codeblock).'] };
    s = s.slice(a); s = s.slice(s.indexOf('\n') + 1);
    const e = s.search(/^\s*=+\s*ENDE\s*=*\s*$/m); if (e >= 0) s = s.slice(0, e); else warn.push('Das Ende „' + END + '“ fehlt – gelesen bis zum Schluss.');
    const L = s.split('\n').map(x => x.replace(/^\s*```.*$/, '').replace(/\*\*/g, ''));
    const head = {}, parts = []; let cur = null, txt = null, note = '', inNote = false;
    const flush = () => { if (cur && txt) { cur.texts[txt.n] = txt.lines.join('\n').replace(/^\s+|\s+$/g, ''); } txt = null; };
    for (const raw of L) {
      const line = raw.replace(/\s+$/, '');
      const ph = /^\s*#{2,3}\s*(.+?)\s*(?:\[([^\]]*)\])?\s*$/.exec(line);
      if (ph) { flush(); inNote = false; cur = { label: ph[1].trim(), typ: ph[2] || '', chords: null, texts: [] }; parts.push(cur); continue; }
      const nm = /^\s*Notiz\s*:\s*(.*)$/i.exec(line);
      if (nm) { flush(); inNote = true; note = nm[1].trim(); continue; }
      if (inNote) { if (line.trim() && !note) note = line.trim(); continue; }
      if (!cur) { const hm = /^\s*([A-Za-zÄÖÜäöü]+)\s*:\s*(.*)$/.exec(line); if (hm) head[hm[1].toLowerCase()] = hm[2].trim(); continue; }
      const am = /^\s*(Akkorde|Chords)\s*:\s*(.*)$/i.exec(line);
      if (am && !txt) { cur.chords = am[2]; continue; }
      if (am && txt) { flush(); cur.chords = am[2]; continue; }
      const tm = /^\s*(Text|Lyrics)\s*(\d+)?\s*:\s*(.*)$/i.exec(line);
      if (tm) { flush(); txt = { n: Math.max(0, (+tm[2] || 1) - 1), lines: tm[3].trim() ? [tm[3].trim()] : [] }; continue; }
      if (txt) txt.lines.push(line.trim());
    }
    flush();
    if (!parts.length) return { ok: false, errs: ['Im Song-Code stehen keine Teile („## Name [Typ]“).'] };
    const key = parseKey(head.tonart || head.key) || (base && base.key) || { pc: 0, major: true };
    if (!parseKey(head.tonart || head.key)) warn.push('Tonart nicht erkannt – ' + C.keyLabel(key) + ' übernommen.');
    let bpm = parseFloat(String(head.tempo || head.bpm || '').replace(',', '.'));
    if (!(bpm >= 40 && bpm <= 240)) { bpm = base ? base.bpm : 90; if (head.tempo) warn.push('Tempo nicht erkannt – ' + Math.round(bpm) + ' BPM behalten.'); }
    const baseLab = base ? labels(base) : {}, byLab = {};
    if (base) base.parts.forEach(p => { byLab[baseLab[p.id].toLowerCase()] = p; });
    const v = { key, bpm: Math.round(bpm * 10) / 10, theme: head.thema || head.theme || '', parts: [], order: [] };
    if (/^\(?leer\)?$/i.test(v.theme)) v.theme = '';
    const nameMap = {};
    parts.forEach(pp => {
      const old = byLab[pp.label.toLowerCase()];
      const type = typeOf(pp.typ) || typeOf(pp.label) || (old && old.type) || 'other';
      const r = parseChords(pp.chords || '');
      if (r.bad.length) errs.push('„' + pp.label + '“: Akkorde nicht verstanden: ' + r.bad.join(' '));
      if (!r.seq.length && pp.chords != null && !r.bad.length) warn.push('„' + pp.label + '“ hat keine Akkorde.');
      const chords = r.seq.length ? r.seq : (old ? C.clone(old.chords) : []);
      const lyrics = []; pp.texts.forEach((t, i) => { lyrics[i] = /^\(?leer\)?$/i.test(t || '') ? '' : (t || ''); });
      for (let i = 0; i < lyrics.length; i++) if (lyrics[i] == null) lyrics[i] = '';
      while (lyrics.length && !lyrics[lyrics.length - 1]) lyrics.pop();
      const p = old ? Object.assign(C.clone(old), { name: pp.label, type, chords, lyrics }) : { id: C.newId('p'), name: pp.label, type, chords, lyrics, audio: null };
      if (nameMap[pp.label.toLowerCase()]) { errs.push('Teil „' + pp.label + '“ kommt doppelt vor.'); return; }
      nameMap[pp.label.toLowerCase()] = p; v.parts.push(p);
    });
    // Ablauf
    const ab = String(head.ablauf || head.order || '');
    const items = (ab.includes('|') ? ab.split('|') : ab.split(/[,–→>]/)).map(x => x.trim()).filter(Boolean);
    items.forEach(it => {
      const m = /^(.*?)\s*(?:[x×]\s*(\d+)|\((\d+)\s*[x×]\)|(\d+)\s*[x×])\s*$/i.exec(it), nm2 = (m ? m[1] : it).trim(), reps = m ? +(m[2] || m[3] || m[4]) : 1;
      const p = nameMap[nm2.toLowerCase()];
      if (!p) { errs.push('Ablauf: Teil „' + nm2 + '“ gibt es nicht.'); return; }
      v.order.push({ p: p.id, reps: Math.max(1, Math.min(8, reps || 1)) });
    });
    if (!items.length) { warn.push('Kein Ablauf angegeben – Teile in der Reihenfolge des Codes.'); v.parts.forEach(p => v.order.push({ p: p.id, reps: 1 })); }
    if (!v.order.length && !errs.length) errs.push('Der Ablauf ist leer.');
    return { ok: !errs.length, errs, warn, v, title: (head.titel || head.title || '').trim(), note: note.slice(0, 120) };
  }
  // Was hat sich geändert? (für die Vorschau vor dem Übernehmen)
  function diff(a, b, ta, tb) {
    const out = [], k = b.key;
    if (tb && ta !== tb) out.push('Titel: „' + ta + '“ → „' + tb + '“');
    if (a.key.pc !== b.key.pc || a.key.major !== b.key.major) out.push('Tonart: ' + C.keyLabel(a.key) + ' → ' + C.keyLabel(b.key));
    if (Math.round(a.bpm) !== Math.round(b.bpm)) out.push('Tempo: ' + Math.round(a.bpm) + ' → ' + Math.round(b.bpm) + ' BPM');
    if ((a.theme || '') !== (b.theme || '')) out.push('Thema geändert');
    const lab = labels(a), ord = v => v.order.map(o => (C.partById(v, o.p) || {}).name + (o.reps > 1 ? ' ×' + o.reps : '')).join(' – ');
    if (ord(a) !== ord(b)) out.push('Ablauf: ' + ord(b));
    b.parts.forEach(p => {
      const o = a.parts.find(x => x.id === p.id);
      if (!o) { out.push('Neuer Teil „' + p.name + '“: ' + chordText(p.chords, k) + ((p.lyrics || []).some(x => x) ? ' · mit Text' : '')); return; }
      const ch = [];
      if (o.name !== p.name) ch.push('umbenannt');
      if (o.type !== p.type) ch.push('jetzt ' + TNAME[p.type]);
      if (C.sig(o.chords) !== C.sig(p.chords)) ch.push('Akkorde ' + chordText(o.chords, a.key) + ' → ' + chordText(p.chords, k) + (p.audio ? ' (Aufnahme wird stumm)' : ''));
      const lo = (o.lyrics || []).join('\n§\n').trim(), ln = (p.lyrics || []).join('\n§\n').trim();
      if (lo !== ln) { const cl = (ln.split('\n').filter(x => x.trim() && x !== '§').length) - (lo.split('\n').filter(x => x.trim() && x !== '§').length); ch.push(!lo ? 'Text neu' : 'Text geändert' + (cl ? ' (' + (cl > 0 ? '+' : '') + cl + ' Zeilen)' : '')); }
      if (ch.length) out.push('„' + (lab[o.id] || o.name) + '“: ' + ch.join(', '));
    });
    a.parts.forEach(o => { if (!b.parts.some(p => p.id === o.id)) out.push('Teil „' + o.name + '“ entfernt'); });
    return out;
  }
  return { rhymes, parseChords, chordText, chordName, syllables, rhymeKey, lines, scheme, lang, occurrences, lyricsOf, hasText, analyse, leadsheet, inlineChords, toCode, prompt, fromCode, diff, labels, GOALS, HEAD, END, parseKey, stripChords };
})();
if (typeof window !== 'undefined') window.LiedText = LiedText;
if (typeof module !== 'undefined') module.exports = LiedText;
