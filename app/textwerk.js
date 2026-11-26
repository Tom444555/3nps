/* v164: Text-Werkstatt (Songwriting › „Text“). Wird erst beim ersten Antippen von „Text-Werkstatt“ geladen (lied.js lädt textwerk.css/.js).
   Alles offline mit Regeln und Tabellen – keine KI, kein Netzabruf außer der eigenen Reimliste (reim/reim-de-1.txt, CC BY 4.0, erst bei „Reimwörter“).
   Teile: Reime prüfen (Schreibung → Reimteil ab dem geschätzt betonten Vokal; rein / unrein / gleiches Wort), Reimwörter (MFA-Wörterbuch nach Klang),
   Akkorde nach Stimmung (Datentabelle Stimmung/Spannung → Stufenfolgen), Baukasten (eigene Zeilen je Thema), Prompt für Claude
   (Rückweg über „Mit Claude weiterarbeiten“ › Einlesen: Song-Code, Zeilen-Vorschläge oder freier Text → Vorschau → neue Version).
   Logik ist ohne Oberfläche in Node testbar (module.exports). Schreibt nichts in die Übezeit. */
(function () {
  const W = typeof window !== 'undefined' ? window : null;
  const C = W ? W.LiedCore : require('./lied-core.js');
  const X = W ? W.LiedText : require('./lied-text.js');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ================= Reime nach Schreibung =================
  // Wort → Lautzeichen: Vokal = { v: Qualität, l: 'L' lang | 'S' kurz | '?' unbekannt }, Konsonant = Zeichen.
  // Qualitäten: a e i o u y(ü) 8(ö) 1(ei/ai) 2(au) 3(eu/äu); ä zählt wie e.
  const VQ = 'aeiouy8123';
  function sounds(word) {
    let w = String(word || '').toLowerCase().replace(/ß/g, 'Q').replace(/[^a-zäöüQ]/g, '');
    if (!w) return [];
    w = w.replace(/ph/g, 'f').replace(/th/g, 't').replace(/qu/g, 'kw').replace(/chs/g, 'ks').replace(/x/g, 'ks').replace(/dt/g, 'tt').replace(/ck/g, 'kk').replace(/tz/g, 'zz')
      .replace(/sch/g, 'S').replace(/ch/g, 'H').replace(/ng/g, 'N').replace(/v/g, 'f').replace(/y/g, 'ü').replace(/c/g, 'k');
    const out = []; let i = 0;
    const V = (v, l, n) => { out.push({ v, l }); i += n; };
    while (i < w.length) {
      const r = w.slice(i);
      if (/^ieh/.test(r)) V('i', 'L', 3);
      else if (/^(ie|ih)/.test(r)) V('i', 'L', 2);
      else if (/^(äu|eu)/.test(r)) V('3', 'L', 2);
      else if (/^(ei|ai|ey|ay)/.test(r)) V('1', 'L', 2);
      else if (/^au/.test(r)) V('2', 'L', 2);
      else if (/^(aa|ah(?![aeiouäöü]))/.test(r)) V('a', 'L', 2);
      else if (/^(ee|eh(?![aeiouäöü])|äh(?![aeiouäöü]))/.test(r)) V('e', 'L', 2);
      else if (/^(oo|oh(?![aeiouäöü]))/.test(r)) V('o', 'L', 2);
      else if (/^uh(?![aeiouäöü])/.test(r)) V('u', 'L', 2);
      else if (/^üh(?![aeiouäöü])/.test(r)) V('y', 'L', 2);
      else if (/^öh(?![aeiouäöü])/.test(r)) V('8', 'L', 2);
      else if (/^[aeiouäöü]/.test(r)) V({ ä: 'e', ü: 'y', ö: '8' }[r[0]] || r[0], '?', 1);
      else if (r[0] === 'Q') { const p = out[out.length - 1]; if (isV(p)) p.l = 'L'; out.push('s'); i++; }   // ß nur nach langem Vokal oder Doppellaut
      else { out.push(r[0]); i++; }
    }
    // Länge aus der Schreibung: Doppelkonsonant (ss, ck, tz, dt …) → kurz; ein Konsonant + Vokal → lang; sonst unbekannt (Mond/Hand)
    for (let k = 0; k < out.length; k++) {
      const t = out[k]; if (typeof t !== 'object' || t.l !== '?') continue;
      const a = out[k + 1], b = out[k + 2];
      if (a == null) continue;
      if (typeof a === 'string' && a === b) t.l = 'S';
      else if (typeof a === 'string' && b && typeof b === 'object') t.l = 'L';
    }
    // Auslautverhärtung (b/d/g am Ende oder vor Konsonant), -ig → -ich, Doppelkonsonanten zusammenziehen
    for (let k = 0; k < out.length; k++) {
      const t = out[k], n = out[k + 1];
      if (typeof t === 'string' && 'bdg'.includes(t) && (n == null || typeof n === 'string') && !(t === 'g' && n === 'g')) {
        const p = out[k - 1];
        out[k] = (t === 'g' && n == null && p && typeof p === 'object' && p.v === 'i' && k >= 2) ? 'H' : { b: 'p', d: 't', g: 'k' }[t];
      }
    }
    const res = [];
    out.forEach(t => { const p = res[res.length - 1]; if (typeof t === 'string' && p === t) return; res.push(t); });
    return res;
  }
  const isV = t => t && typeof t === 'object';
  const UNSTR = /(ung|ungen|ig|ige|igen|iger|iges|igem|igt|igte|igten|igkeit|lich|liche|lichen|licher|liches|lichem|isch|ische|ischen|ischer|in|innen|nis|nisse|nissen|sam|same|samen|samer|bar|bare|baren|barer|haft|hafte|haften|heit|heiten|keit|keiten|schaft|schaften|ling|linge|lingen|tum|chen|lein)$/;
  // Reimteil: ab dem (geschätzt) betonten Vokal. Unbetonte Endsilbe (-e, -en, -er, -el …) und Nachsilben (-ung, -lich, -heit …) überspringen.
  function rhymePart(word) {
    const s = sounds(word), vi = []; s.forEach((t, k) => { if (isV(t)) vi.push(k); });
    if (!vi.length) return null;
    let j = vi.length - 1;
    const tail = () => s.slice(vi[j] + 1).join('');
    if (j > 0 && s[vi[j]].v === 'e' && s[vi[j]].l !== 'L' && /^(|n|r|l|m|s|nt|rn|ns|ln|rs|st|t|rt|nd)$/.test(tail())) j--;
    const w = String(word || '').toLowerCase().replace(/[^a-zäöüß]/g, ''), m = UNSTR.exec(w);
    if (m && j > 0 && !/allein$/.test(w) && w.length - m[1].length >= 2 && !/^(ei|ai|eu|äu|au|ie)$/.test(w.charAt(w.length - m[1].length - 1) + m[1].charAt(0))) {
      const vInSuffix = (m[1].match(/(ie|ei|ai|eu|äu|au|[aeiouäöü])/g) || []).length;   // Vokale der Nachsilbe
      const fromEnd = vi.length - 1 - j;
      if (fromEnd < vInSuffix) j = Math.max(0, vi.length - 1 - vInSuffix);
    }
    return { s: s.slice(vi[j]), stressed: j, n: vi.length };
  }
  const vlen = (a, b) => a === b || a === '?' || b === '?';
  const FOLD = { y: 'i', 8: 'e', 3: '1' };
  const CLS = c => /[mnN]/.test(c) ? 'N' : /[ptkbdg]/.test(c) ? 'T' : /[szS]/.test(c) ? 'S' : /[fw]/.test(c) ? 'F' : c;
  function nearSeq(p) {
    let s = p.s.map(t => isV(t) ? (FOLD[t.v] || t.v) : CLS(t)).join('');
    s = s.replace(/eN$/, 'e').replace(/er$/, 'a');
    return s;
  }
  // Vergleich zweier Wörter: 'gleich' | 'rein' | 'unrein' | null
  function rhymeLevel(a, b) {
    const na = String(a || '').toLowerCase().replace(/[^a-zäöüß]/g, ''), nb = String(b || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
    if (!na || !nb) return null;
    if (na === nb) return 'gleich';
    const pa = rhymePart(na), pb = rhymePart(nb); if (!pa || !pb) return null;
    if (pa.s.length === pb.s.length && pa.s.every((t, k) => { const u = pb.s[k]; return isV(t) ? isV(u) && t.v === u.v && vlen(t.l, u.l) : t === u; })) return 'rein';
    const fa = isV(pa.s[0]) ? (FOLD[pa.s[0].v] || pa.s[0].v) : '', fb = isV(pb.s[0]) ? (FOLD[pb.s[0].v] || pb.s[0].v) : '';
    if (fa && fa === fb && nearSeq(pa) === nearSeq(pb)) return 'unrein';
    return null;
  }
  const RANK = { gleich: 3, rein: 2, unrein: 1 };

  // ================= Reim-Prüfung eines Textes =================
  const FILL = new Set(['halt', 'eben', 'irgendwie', 'eigentlich', 'einfach', 'wirklich', 'ziemlich', 'quasi', 'sozusagen', 'gewissermaßen', 'echt', 'total', 'eh', 'irgendwo', 'irgendwann', 'nunmal', 'sowieso', 'bisschen']);
  const STOP = new Set(['der', 'die', 'das', 'und', 'ich', 'du', 'nicht', 'ist', 'ein', 'eine', 'einen', 'einem', 'einer', 'mein', 'meine', 'dein', 'deine', 'wir', 'mit', 'auf', 'in', 'zu', 'es', 'sie', 'er', 'wie', 'was', 'noch', 'nur', 'mich', 'dich', 'uns', 'den', 'dem', 'des', 'bin', 'bist', 'hab', 'habe', 'kein', 'keine', 'wenn', 'dann', 'so', 'ja', 'im', 'am', 'an', 'von', 'vom', 'für', 'aus', 'bei', 'nach', 'mir', 'dir', 'sich', 'hat', 'war', 'wird', 'sind', 'auch', 'aber', 'oder', 'doch', 'schon', 'da', 'hier', 'wo', 'als', 'ob', 'um', 'bis', 'nie', 'immer', 'mal', 'man', 'the', 'and', 'you', 'to', 'of', 'oh']);
  const words = s => (X.stripChords(s).toLowerCase().match(/[a-zäöüß']+/g) || []).map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);
  const lastWord = line => { const m = X.stripChords(line).match(/[A-Za-zÄÖÜäöüß']+/g); return m ? m[m.length - 1].replace(/^'+|'+$/g, '') : ''; };
  // Text eines Abschnitts → Zeilen mit Silben, Reimbuchstabe, Stufe zum Partner; dazu ruhige Hinweise
  function checkText(text, name) {
    const raw = String(text || '').split('\n'), L = [];
    raw.forEach((r, i) => { const t = X.stripChords(r).trim(); if (t) L.push({ i, raw: r, text: t, word: lastWord(t), syl: X.syllables(t, 'de') }); });
    let next = 0;
    L.forEach((x, k) => {
      let best = null;
      for (let j = k - 1; j >= 0; j--) { const lv = rhymeLevel(L[j].word, x.word); if (lv && (!best || RANK[lv] > RANK[best.lv])) best = { j, lv }; }
      if (best) { x.letter = L[best.j].letter; x.lv = best.lv; x.with = best.j; L[best.j].has = true; if (!L[best.j].lv) L[best.j].lvp = best.lv; }
      else x.letter = String.fromCharCode(65 + (next++ % 26));
    });
    L.forEach(x => { x.alone = !x.lv && !x.has; });
    const hints = [], nm = name ? '„' + name + '“: ' : '';
    if (L.length >= 3) {
      const ss = L.map(x => x.syl).sort((a, b) => a - b), med = ss[Math.floor(ss.length / 2)];
      L.forEach((x, k) => { if (Math.abs(x.syl - med) >= 3) hints.push({ k: 'syl', line: k, text: nm + 'Zeile ' + (k + 1) + ' hat ' + x.syl + ' Silben, die anderen meist ' + med + ' – auf dieselbe Melodie wird es ' + (x.syl > med ? 'eng' : 'dünn') + '.' }); });
    }
    L.forEach((x, k) => { if (x.lv && x.lv !== 'gleich' && Math.abs(x.syl - L[x.with].syl) >= 3 && !hints.some(h => h.line === k)) hints.push({ k: 'syl', line: k, text: nm + 'Zeile ' + (k + 1) + ' (' + x.syl + ' Silben) und ihr Reimpartner Zeile ' + (x.with + 1) + ' (' + L[x.with].syl + ') sind unterschiedlich lang.' }); });
    L.forEach((x, k) => { if (x.lv === 'gleich') hints.push({ k: 'same', line: k, text: nm + 'Zeile ' + (k + 1) + ' endet mit demselben Wort wie Zeile ' + (x.with + 1) + ' („' + x.word + '“) – das ist kein Reim, als Hook aber manchmal gewollt.' }); });
    L.forEach((x, k) => { if (x.syl > 14) hints.push({ k: 'long', line: k, text: nm + 'Zeile ' + (k + 1) + ' ist lang (' + x.syl + ' Silben) – vielleicht in zwei Zeilen teilen.' }); });
    L.forEach((x, k) => { const f = words(x.text).filter(w => FILL.has(w)); if (f.length) hints.push({ k: 'fill', line: k, text: nm + 'Zeile ' + (k + 1) + ': „' + [...new Set(f)].join('“, „') + '“ – Füllwort? Oft trägt die Zeile auch ohne.' }); });
    const cnt = {}, lines = {}; L.forEach(x => { lines[x.text.toLowerCase()] = (lines[x.text.toLowerCase()] || 0) + 1; });
    L.forEach(x => { if (lines[x.text.toLowerCase()] > 1) return; words(x.text).forEach(w => { if (w.length >= 4 && !STOP.has(w) && !FILL.has(w)) cnt[w] = (cnt[w] || 0) + 1; }); });
    Object.entries(cnt).filter(e => e[1] >= 3).forEach(([w, n]) => hints.push({ k: 'rep', text: nm + '„' + w + '“ kommt ' + n + '-mal vor – gewollt (Hook) oder lieber Abwechslung?' }));
    const sch = L.map(x => x.letter).join('');
    return { lines: L, scheme: sch, hints };
  }

  // ================= Reimwörter (Liste nach Klang) =================
  const LIST_URL = 'reim/reim-de-1.txt';
  let LIST = null, listP = null;
  const PFOLD = { Y: 'I', y: 'i', 9: 'E', 8: 'e', 3: '1' };
  const PCLS = c => /[mnN]/.test(c) ? 'N' : /[ptkbdg]/.test(c) ? 'T' : /[sZSTC]/.test(c) ? 'S' : /[fvF]/.test(c) ? 'F' : c;
  function pNear(k) {
    let s = k.split('').map(c => PFOLD[c] || c).map(c => /[AEIOU]/.test(c) ? c.toLowerCase() : /[aeiou12@R]/.test(c) ? c : PCLS(c)).join('');
    s = s.replace(/@N$/, '@').replace(/@R$|R$/, 'a');
    return s;
  }
  function parseList(txt) {
    const groups = [], byWord = new Map(), near = new Map();
    String(txt).split('\n').forEach(line => {
      const sp = line.indexOf(' '); if (sp < 1) return;
      const k = line.slice(0, sp), ws = line.slice(sp + 1).split(' ').filter(Boolean), gi = groups.length;
      groups.push({ k, ws }); ws.forEach(w => { if (!byWord.has(w)) byWord.set(w, gi); });
      const nk = pNear(k); if (!near.has(nk)) near.set(nk, []); near.get(nk).push(gi);
    });
    return { groups, byWord, near, spell: null, count: byWord.size };
  }
  function setList(txt) { LIST = parseList(txt); return LIST; }
  function loadList() {
    if (LIST) return Promise.resolve(LIST);
    if (!listP) listP = fetch(LIST_URL).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(setList).catch(e => { listP = null; throw e; });
    return listP;
  }
  // Wörter, die nicht in der Liste stehen: Rückfall nach Schreibung (einmal alle Wörter nach Reimteil der Schreibung ordnen)
  function spellKey(w) { const p = rhymePart(w); return p ? p.s.map(t => isV(t) ? t.v + (t.l === 'L' ? ':' : '') : t).join('') : ''; }
  function rhymesFor(word, max) {
    max = max || 400;
    const w = String(word || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
    if (!w || !LIST) return { word: w, rein: [], unrein: [], src: LIST ? 'leer' : 'keine-liste' };
    const gi = LIST.byWord.get(w);
    if (gi != null) {
      const comp = (a, b) => a.length - b.length >= 3 && a.endsWith(b);   // Zusammensetzung (Löwenherz zu Herz) = gleiches Wort, kein Reim
      const g = LIST.groups[gi], rein = g.ws.filter(x => x !== w && !comp(x, w) && !comp(w, x)).slice(0, max), unrein = [];
      // nähere Gruppen zuerst (gleicher Vokal, nur Länge/Endkonsonant anders), dann gerundete Vokale (ü/i, ö/e, eu/ei); je Gruppe die gebräuchlicheren zuerst
      const v0 = g.k.charAt(0).toLowerCase(), cand = [];
      (LIST.near.get(pNear(g.k)) || []).forEach(j => { if (j === gi) return; const gj = LIST.groups[j], d = gj.k.charAt(0).toLowerCase() === v0 ? 0 : 1; gj.ws.forEach((x, r) => { if (x !== w) cand.push({ x, s: d * 1000 + r }); }); });
      cand.sort((a, b) => a.s - b.s).forEach(c => { if (unrein.length < max) unrein.push(c.x); });
      return { word: w, rein, unrein, src: 'liste' };
    }
    if (!LIST.spell) { const m = new Map(); LIST.groups.forEach(g => g.ws.forEach(x => { const k = spellKey(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); })); LIST.spell = m; }
    const rein = (LIST.spell.get(spellKey(w)) || []).filter(x => x !== w && !(x.length - w.length >= 3 && x.endsWith(w))).slice(0, max);
    return { word: w, rein, unrein: [], src: 'schreibung' };
  }

  // ================= Akkorde nach Stimmung =================
  // Stufen: dur = Dur-Tonleiter der Tonika, moll = natürliches Moll; Großbuchstabe = Dur, klein = Moll, b/# = Halbton, Zusatz 7/maj7/5/sus4 möglich.
  // Moll-Folgen in einem Dur-Song laufen über die Moll-Parallele (C-Dur → a-Moll), Dur-Folgen in einem Moll-Song über die Dur-Parallele.
  const GEN = {
    moll: {
      start: [['i VI III VII', 'Beginnt auf der Molltonika, dann ohne Druck über VI und III weiter – nach innen gekehrt, aber fließend.'], ['i VII VI VII', 'Absteigend vom Grundton und zurück – wirkt wie ein Seufzer.'], ['i iv v i', 'Nur Mollfarben, keine helle Dominante – gedeckt und schwer.']],
      auf: [['iv v VI VII', 'Die Bässe steigen Stufe für Stufe – Spannung baut sich auf, ohne laut zu werden.'], ['iv VI VII V', 'Endet auf der Dur-Dominante V (harmonisches Moll) – will deutlich zur Tonika.'], ['VI VII VI VII', 'Pendelt zwischen VI und VII, ohne anzukommen – hält die Erwartung hoch.']],
      ab: [['VI VII i i', 'VI und VII führen von oben zurück auf die Molltonika – die Spannung fällt ab, danach Ruhe.'], ['iv V i i', 'iv → V → i: die stärkste Auflösung in Moll (Dur-Dominante), danach bleibt der Grundton liegen.'], ['VI iv V i', 'Weich hinein über VI und iv, über die Dominante sicher nach Hause.']],
      offen: [['i VII VI V', 'Andalusische Kadenz: Treppe abwärts bis zur Dur-Dominante – bleibt offen, dramatisch.'], ['i iv VI V', 'Endet auf V – der Teil bleibt offen und zieht in den nächsten.'], ['VI VII V V', 'Endet lange auf der Dominante – die Frage bleibt stehen.']],
      kontrast: [['VI III VII iv', 'Beginnt nicht auf der Tonika – neuer Blickwinkel mit Dur-Farben im Moll.'], ['iv VI III V', 'Startet auf der Subdominante (öffnet) und endet auf V – führt zurück in den Refrain.'], ['III VII iv V', 'Von der Dur-Parallele aus – heller Kontrast, am Ende wieder Spannung.']],
      halten: [['i i VI VI', 'Zwei Akkorde, je zwei Takte – die Stimmung bleibt stehen, Platz für den Text.'], ['i VI i VI', 'Ruhiger Wechsel Tonika – VI, nichts drängt.']]
    },
    dur: {
      start: [['I V vi IV', 'Die meistgespielte Pop-Folge: stabil, vertraut, mit einem Moll-Akkord als Farbe.'], ['I vi IV V', 'Klassische Folge über vi – rund und offen für eine Melodie.'], ['I IV I V', 'Tonika und Subdominante, die Dominante am Ende führt zurück – schlicht und klar.']],
      auf: [['ii IV V V', 'Von ii über IV zur Dominante, die zwei Takte stehen bleibt – zieht nach vorn in den Refrain.'], ['IV V vi V', 'Steigt über IV–V nach vi und endet auf V – Spannung kurz vor dem Ziel.'], ['vi IV V V', 'Beginnt in Moll und endet offen auf V – baut Erwartung auf.']],
      ab: [['IV V I I', 'Kadenz IV → V → I: die Spannung löst sich ganz auf die Tonika.'], ['ii V I I', 'ii → V → I: die runde Auflösung aus dem Jazz und Pop.'], ['IV iv I I', 'Mit der geliehenen Moll-Subdominante iv: weich, etwas wehmütig gelöst.']],
      offen: [['I IV V vi', 'Trugschluss: V geht nicht zur Tonika, sondern nach vi – überraschend, unvollendet.'], ['I IV vi V', 'Endet auf der Dominante – der Teil bleibt offen.'], ['vi IV I V', 'Beginnt in Moll, endet auf V – ohne anzukommen.']],
      kontrast: [['vi iii IV V', 'Beginnt auf vi und steigt über iii zu IV–V – neuer Weg, am Ende Spannung.'], ['bVI bVII I I', 'Geliehen aus Moll: bVI–bVII–I bringen Kontrast und eine starke Rückkehr.'], ['IV vi IV V', 'Bleibt um die Subdominante – öffnet, bevor V zurückführt.']],
      halten: [['I I IV IV', 'Zwei Akkorde, je zwei Takte – ruhig, viel Platz für den Text.'], ['I IV I IV', 'Gleichmäßiges Pendeln – nichts drängt.']]
    }
  };
  const MOODS = {
    traurig: { m: 'moll', w: /^(traurig|trauer|trist|wein|träne|verlust|verloren|kummer|leid)/, x: { start: [['i v VI iv', 'Nur Mollstufen ohne helle Dominante – schwer und gedeckt.']] } },
    melancholisch: { m: 'moll', w: /^(melanchol|wehmut|wehmüt|nachdenklich|bittersüß|nostalg|schwermüt)/, x: { start: [['vi IV I V', 'Pop-Folge, die auf Moll (vi) beginnt – bittersüß, halb hell, halb dunkel.', 'dur'], ['i III VII iv', 'Moll mit Dur-Parallele III – Erinnerung mit Licht und Schatten.']] } },
    'düster': { m: 'moll', w: /^(düster|dunkel|dunkl|finster|bedroh|unheimlich|bedrück|bedrohlich)/, x: { start: [['i bII i bII', 'Halbton über dem Grundton (♭II, phrygisch): dunkel und bedrohlich.'], ['i VI iv v', 'Gedeckte Mollstufen, keine helle Dominante.']], offen: [['i bII VII V', '♭II und die Dur-Dominante – düster und unaufgelöst.']] } },
    hoffnungsvoll: { m: 'dur', w: /^(hoffnung|hoffnungsvoll|zuversicht|aufbruch|optimist|licht|heller|hell$)/, x: { start: [['vi IV I V', 'Beginnt dunkel (vi) und endet hell auf I–V – wie Licht am Ende.']], ab: [['VI VII III III', 'Dur-Ziel im Moll: VI–VII führen zur Dur-Parallele III – das Dunkle hellt auf.', 'moll']] } },
    'fröhlich': { m: 'dur', w: /^(fröhlich|froh|heiter|glücklich|gute laune|beschwingt|lustig|ausgelassen|sommer|freude|freudig)/, x: { start: [['I IV V IV', 'Nur Dur-Hauptstufen – hell, direkt, zum Mitklatschen.'], ['I V IV V', 'Dur-Pendel zwischen V und IV – leicht und schwungvoll.']] } },
    treibend: { m: 'dur', w: /^(treibend|treibt|schnell|energ|drive|rockig|vorwärts|getrieben|groov|druckvoll)/, x: { start: [['I bVII I bVII', 'Kurze Zweierwechsel mit ♭VII – rockig, schiebt nach vorn.'], ['i VII i VII', 'Zweierwechsel in Moll (i–VII) – treibend und kantig.', 'moll']], auf: [['IV V IV V', 'Schneller Wechsel IV–V ohne Ankommen – der Druck steigt.']] } },
    ruhig: { m: 'dur', w: /^(ruhig|sanft|entspann|leise|gelassen|still|friedlich|verträumt|träumerisch|schwebend|zart)/, x: { start: [['Imaj7 IVmaj7 Imaj7 IVmaj7', 'Zwei weiche Septakkorde im Wechsel – ruhig, schwebend.'], ['im7 ivm7 im7 ivm7', 'Moll-Septakkorde im Wechsel – gedämpft und ruhig.', 'moll']], halten: [['Imaj7 Imaj7 IVmaj7 IVmaj7', 'Lange Septakkorde – nichts drängt.']] } },
    'wütend': { m: 'moll', w: /^(wütend|wut|zorn|aggress|hart|wild|rebell|sauer)/, x: { start: [['i5 VI5 VII5 i5', 'Powerchords Grundton – ♭VI – ♭VII: hart und direkt.'], ['i5 bII5 i5 VII5', 'Powerchords mit Halbtonschritt nach oben – aggressiv, eng.']], auf: [['iv5 V5 iv5 V5', 'Powerchords im Wechsel iv–V – die Wut staut sich.']] } },
    'sehnsüchtig': { m: 'dur', w: /^(sehnsucht|sehnsüchtig|verlang|vermiss|fernweh|heimweh|sehnen)/, x: { start: [['I iii IV iv', 'Dur mit geliehener Moll-Subdominante iv: Sehnsucht, ein Stich Wehmut.'], ['IV I V vi', 'Beginnt auf IV (offen) und endet auf vi – Sehnen ohne Ankommen.']] } }
  };
  const TENS = { auf: 'Spannung steigt', ab: 'Spannung fällt ab / löst sich', offen: 'endet offen', halten: 'bleibt gleich', kontrast: 'Kontrast' };
  const TENS_RX = [
    ['ab', /spannungsabfall|spannung (fällt|fallt|nimmt ab|löst sich|lässt nach|raus)|fällt ab|fallt ab|löst sich|lösen|auflös|auflösung|entspann|nachlass|lässt nach|ankommen|kommt an/],
    ['auf', /spannungsaufbau|spannung (steigt|baut sich auf|nimmt zu|rauf|aufbauen|steigern)|baut sich auf|steigt|steigend|steiger|aufbau|crescendo|mehr spannung/],
    ['offen', /offen enden|offenes ende|endet offen|bleibt offen|unaufgelöst|ohne auflösung|trugschluss|offen\b/],
    ['halten', /spannung halten|hält die spannung|gleichbleibend|konstant/],
    ['kontrast', /kontrast|überraschend|ganz anders/]
  ];
  const SEC_RX = [['pre', /pre-?chorus|prechorus|vorrefrain|überleitung|\bpre\b/], ['chorus', /refrain|chorus|hook|kehrvers/], ['verse', /strophe|strophen|\bvers\b|verse/], ['bridge', /bridge|zwischenteil|mittelteil/]];
  const SEC_DEF = { verse: 'start', pre: 'auf', chorus: 'start', bridge: 'kontrast' };
  const SEC_N = { verse: 'Strophe', pre: 'Pre-Chorus', chorus: 'Refrain', bridge: 'Bridge' };
  const FILLER = /^(mit|im|in|der|die|das|den|dem|und|danach|dann|ein|eine|einem|einer|einen|sehr|etwas|eher|bisschen|ganz|soll|sollte|sein|ist|wird|werden|es|am|zum|zur|ab|sich|so|wie|aber|vom|von|bis|nach|mehr|weniger|leicht|richtig|klingen|klingt|wirken|wirkt|stimmung|gefühl|song|lied|teil|teile|akkorde|akkord|bitte|ich|will|möchte|gern|gerne|später|anschließend|sowie|beim|auch|noch|nur|zum schluss|schluss|am ende|ende|dort|da|hin|her|spannung|eine|stück|art|richtung|etwa|mal|total|komplett|eigentlich)$/;
  // Freier Text → { all: Stimmung, sec: { verse: { mood, tens } … }, found: [...], unknown: [...], notes: [...] }
  function parseMood(text) {
    const res = { all: null, sec: {}, found: [], unknown: [], notes: [] };
    const clauses = String(text || '').toLowerCase().replace(/[„“"()]/g, ' ').split(/[,;.!?\n]+/);
    clauses.forEach(cl => {
      const segs = cl.split(/\b(?:mit|danach|dann|und|aber|später|anschließend|sowie)\b/).map(s => s.trim()).filter(Boolean);
      const info = segs.map(sg => {
        let rest = ' ' + sg + ' ';
        const o = { sec: null, mood: null, tens: null };
        for (const [k, rx] of SEC_RX) { if (rx.test(rest)) { o.sec = k; rest = rest.replace(rx, ' '); break; } }
        for (const [k, rx] of TENS_RX) { const m = rx.exec(rest); if (m) { o.tens = k; res.found.push('„' + m[0].trim() + '“ → ' + TENS[k]); rest = rest.replace(m[0], ' '); break; } }
        rest.split(/\s+/).filter(Boolean).forEach(w => {
          const mk = Object.keys(MOODS).find(k => MOODS[k].w.test(w));
          if (mk) { if (!o.mood) { o.mood = mk; res.found.push('„' + w + '“ → ' + mk); } }
          else if (!FILLER.test(w) && w.length > 1 && !/^\d+$/.test(w)) res.unknown.push(w);
        });
        return o;
      });
      // Abschnitt ohne eigene Wörter übernimmt das Segment davor („mit Spannungsabfall danach im Refrain“)
      info.forEach((o, k) => {
        if (o.sec && !o.mood && !o.tens && k > 0 && !info[k - 1].sec && (info[k - 1].mood || info[k - 1].tens)) { const p = info[k - 1]; o.mood = p.mood; o.tens = p.tens; p.mood = p.tens = null; p.used = true; }
      });
      info.forEach(o => {
        if (o.sec) { const s = res.sec[o.sec] = res.sec[o.sec] || {}; if (o.mood) s.mood = o.mood; if (o.tens) s.tens = o.tens; }
        else {
          if (o.mood && !res.all) res.all = o.mood;
          if (o.tens) { const s = res.sec.chorus = res.sec.chorus || {}; if (!s.tens) { s.tens = o.tens; res.notes.push('„' + TENS[o.tens] + '“ ohne Abschnitt – gilt für den Refrain.'); } }
        }
      });
    });
    res.unknown = [...new Set(res.unknown)];
    return res;
  }
  const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], RN = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
  // eine Stufe („bVI“, „iv“, „Imaj7“, „i5“) → Akkord { r, t, beats }
  function degree(tok, tonic, mode) {
    const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(tok); if (!m) return null;
    const n = RN[m[2].toUpperCase()], sc = mode === 'moll' ? MIN : MAJ, minor = m[2] === m[2].toLowerCase();
    let r = C.md(tonic + sc[n] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0));
    let t = m[3] || '';
    if (t === '5' || t === 'sus4' || t === 'sus2') { /* Powerchord / sus unabhängig von Groß/klein */ }
    else if (minor) t = t === 'm7' || t === '7' ? 'm7' : 'm';
    else t = t === 'maj7' ? 'maj7' : t === '7' ? '7' : '';
    if (t === 'm' && m[3] === 'm7') t = 'm7';
    return { r, t, beats: 4 };
  }
  function tonicFor(key, mode) { return mode === 'moll' ? (key.major ? C.md(key.pc + 9) : key.pc) : (key.major ? key.pc : C.md(key.pc + 3)); }
  function progChords(deg, key, mode) { const tn = tonicFor(key, mode); return deg.split(/\s+/).map(d => degree(d, tn, mode)).filter(Boolean); }
  const NOTE = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];
  function modeName(key, mode) { const tn = tonicFor(key, mode); return mode === 'moll' ? NOTE[tn].toLowerCase() + '-Moll' : NOTE[tn] + '-Dur'; }
  // Vorschläge für einen Abschnitt: Stimmung + Spannung → 2–3 Folgen in der Tonart des Songs
  function suggest(sec, mood, tens, key, n) {
    n = n || 3; const tag = tens || SEC_DEF[sec] || 'start', M = MOODS[mood] || null, mode = M ? M.m : (key.major ? 'dur' : 'moll');
    const pool = [];
    if (M && M.x[tag]) M.x[tag].forEach(p => pool.push({ d: p[0], why: p[1], mode: p[2] || mode }));
    GEN[mode][tag].forEach(p => pool.push({ d: p[0], why: p[1], mode }));
    const out = [], seen = new Set();
    pool.forEach(p => { if (out.length >= n) return; const ch = progChords(p.d, key, p.mode), sig = C.sig(ch); if (seen.has(sig) || !ch.length) return; seen.add(sig); out.push(Object.assign(p, { chords: ch, names: X.chordText(ch, key), via: modeName(key, p.mode) })); });
    return { sec, mood, tag, mode, list: out };
  }

  // ================= Text-Baukasten (eigene Zeilen, keine fremden Texte) =================
  // Je Thema: Wortfelder (f) und Zeilen in Reimfamilien (r: [[Zeile, Zeile, …], …]). Alles selbst formuliert.
  const KIT = {
    abschied: { n: 'Abschied', f: ['Koffer', 'Bahnsteig', 'Tür', 'Brief', 'Schlüssel', 'Zimmer', 'Jacke', 'Foto', 'Winter', 'Fenster', 'Morgen', 'Stille', 'Straße', 'Blick', 'Hand', 'Spur', 'Zug', 'Weg'],
      r: [['Ich trag die Kisten vor das Haus', 'die letzte Lampe geht jetzt aus', 'ein Brief, ein Bild, ein trockener Strauß'],
          ['Dein Schlüssel liegt noch auf dem Tisch', 'der Kaffee wird schon kalt, das Brot nicht mehr frisch', 'ich lösch die Kreide-Zeilen weg mit einem Wisch'],
          ['Wir haben uns nichts mehr gesagt', 'nur noch das Wetter, nur noch, wie spät es ist, gefragt', 'die Uhr am Bahnhof hat geklagt', 'bis endlich einer „Mach es gut“ gewagt'],
          ['Der Zug fährt an, ich bleib noch stehn', 'ich will dein Winken nicht mehr sehn', 'die Schienen glänzen, als wär nichts geschehn', 'und keiner von uns beiden wird sich drehn'],
          ['Ein Foto rutscht aus deinem Buch', 'ein Sommer, den ich nicht mehr such', 'zwei Tassen und ein altes Tuch', 'ein halber Satz, ein leiser Fluch']] },
    aufbruch: { n: 'Aufbruch', f: ['Straße', 'Morgen', 'Horizont', 'Karte', 'Wind', 'Motor', 'Grenze', 'Ziel', 'Himmel', 'Brücke', 'Licht', 'Rucksack', 'Spur', 'Küste', 'Weite', 'Tag'],
      r: [['Ich pack den Rucksack über Nacht', 'hab endlich einen Plan gemacht', 'der Morgen hat mich wachgelacht', 'ich hab zu lang nur nachgedacht'],
          ['Die Straße zieht sich bis ans Meer', 'der Tank ist voll, das Herz nicht schwer', 'ich schau nicht mehr zurück, nicht mehr', 'die Karte liegt im Handschuhfach quer'],
          ['Der Wind steht gut, wir fahren los', 'die Welt ist klein, der Himmel groß', 'ein Lied im Radio, endlos'],
          ['Ich lass die alte Stadt zurück', 'und nehm nur mit ein kleines Stück', 'ich such nicht mehr das große Glück', 'ich such den nächsten Augenblick'],
          ['Wo die Brücke endet, fängt es an', 'ich weiß nicht wo, ich weiß nicht wann', 'ich hab zu lang gewartet, und dann', 'muss jemand gehen – ich bin dran']] },
    nacht: { n: 'Nacht', f: ['Stadt', 'Laterne', 'Neon', 'Regen', 'Mond', 'Dach', 'Taxi', 'Bar', 'Fenster', 'Schatten', 'Sterne', 'Straße', 'Rauch', 'Uhr', 'Kreuzung', 'Brücke'],
      r: [['Die Stadt schläft unter grauem Licht', 'die Ampel blinkt, sie wartet nicht', 'ein Taxi fährt, ich seh dein Gesicht', 'im nassen Glas, und dann zerbricht'],
          ['Ich lauf allein durch diese Nacht', 'hab an die alten Zeiten gedacht', 'die Neonschrift hat leise gelacht', 'wer hat mich bloß um den Schlaf gebracht'],
          ['Der Regen spielt auf jedem Dach', 'ich lieg im dunklen Zimmer wach', 'und zähl die Tropfen nach', 'die Nacht wird lang und ich werd schwach'],
          ['Am Kiosk brennt noch rotes Licht', 'ein Mann, der mit sich selber spricht', 'die Zeitung von morgen, Bericht um Bericht', 'und irgendwer hält sein Versprechen nicht'],
          ['Die Sterne hängen tief und kalt', 'die Straßenbahn macht einmal Halt', 'ich fühl mich jung und manchmal alt', 'die Stunde zwischen drei und vier verhallt']] },
    heimweg: { n: 'Heimweg', f: ['Weg', 'Haus', 'Laterne', 'Ecke', 'Treppe', 'Garten', 'Zaun', 'Feld', 'Bus', 'Dorf', 'Licht', 'Tor', 'Abend', 'Küche', 'Hund', 'Brücke'],
      r: [['Die letzte Kurve vor dem Haus', 'ich zieh die nassen Schuhe aus', 'die Katze schaut zum Fenster raus'],
          ['Ich kenn den Weg, ich kenn den Stein', 'den Zaun, den Hund, den Abendschein', 'ich bin nicht reich, ich bin nicht fein', 'doch hier darf ich einfach sein'],
          ['Der Bus hält an der alten Linde', 'wo ich die Kinderschrift noch finde', 'im Holz, im Moos, in grauer Rinde', 'ich steig hier aus und spür den Winde'],
          ['Der Abend riecht nach frischem Heu', 'die Brücke knarrt, die Bank ist neu', 'ich war nicht immer treu', 'doch dieser Weg bleibt mir getreu'],
          ['Die Treppe knarrt bei Stufe drei', 'die Katze schleicht an mir vorbei', 'ich bin zurück, ich bin dabei', 'und endlich fühl ich mich frei']] },
    wut: { n: 'Wut', f: ['Faust', 'Feuer', 'Wand', 'Stimme', 'Lärm', 'Glas', 'Tür', 'Funke', 'Sturm', 'Asche', 'Lunte', 'Puls', 'Beton', 'Gitter', 'Scherben', 'Donner'],
      r: [['Ich hab genug von deinem Spiel', 'du nimmst dir alles, gibst nicht viel', 'du redest laut und hast kein Ziel', 'ich bin nicht länger dein Ventil'],
          ['Ich schlag die Tür, die Wände beben', 'ich will nicht mehr nach deinen Regeln leben', 'ich hab dir alles schon gegeben', 'ich hab den Schlüssel längst zurückgegeben'],
          ['Die Funken fliegen, Glas zerspringt', 'ein Lied, das niemand für dich singt', 'ein Ton, der in den Ohren klingt', 'bis endlich etwas in mir ringt'],
          ['Ich bin kein Hund an deiner Leine', 'ich geh ab heute ganz alleine', 'ich zähl die Scherben und die Steine'],
          ['Der Puls schlägt hart in meinem Hals', 'ich glaub dir nicht, ich glaub dir keinesfalls', 'du drehst die Worte jedenfalls']] },
    hoffnung: { n: 'Hoffnung', f: ['Licht', 'Morgen', 'Sonne', 'Funke', 'Fenster', 'Brücke', 'Weg', 'Frühling', 'Himmel', 'Hand', 'Stimme', 'Garten', 'Saat', 'Feuer', 'Spur', 'Tag'],
      r: [['Es wird schon hell, ich seh es kommen', 'der Nebel hat sich fortgenommen', 'ich bin dem Dunkel fast entkommen', 'hab meine Angst mit in den Fluss genommen'],
          ['Ein kleiner Funke reicht für heut', 'ich hab den Weg noch nie bereut', 'die Saat ist leise ausgestreut', 'und irgendwann hat sie mich gefreut'],
          ['Ich halt mich fest an deiner Hand', 'wir bauen Türme aus nassem Sand', 'das Meer kommt nah, doch hält der Rand', 'wir finden schon das feste Land'],
          ['Der Frühling klopft ans Fensterglas', 'er riecht nach Regen und nach Gras', 'ich weiß nicht mehr, was ich vergaß', 'ich weiß nur, dass ich lachen kann – und das'],
          ['Morgen ist ein neuer Tag', 'egal was gestern schwer auf mir lag', 'ich nehm mir, was ich tragen mag', 'und geh weiter, Schlag für Schlag']] }
  };
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  // Startgerüst: Zeilen aus den Reimfamilien des Themas nach Reimschema und Silbenzahl
  function kitDraft(theme, scheme, nLines, syl, seed) {
    const T = KIT[theme] || KIT.nacht, R = rng((seed || 1) + theme.length * 7), used = new Set();
    const fams = T.r.map((f, i) => ({ i, lines: f.map(t => ({ t, s: X.syllables(t, 'de') })) })).sort(() => R() - 0.5);
    let fi = 0;
    const take = (fam, k) => {
      const c = fam.lines.filter(x => !used.has(x.t)).sort((a, b) => Math.abs(a.s - syl) - Math.abs(b.s - syl) || R() - 0.5).slice(0, k);
      c.forEach(x => used.add(x.t)); return c.sort((a, b) => fam.lines.indexOf(a) - fam.lines.indexOf(b));
    };
    const blocks = Math.max(1, Math.round((nLines || 4) / 4)), out = [];
    const sch = /^(AABB|ABAB|ABCB|AAAA)$/.test(scheme) ? scheme : 'ABAB';
    for (let b = 0; b < blocks; b++) {
      const map = {}, need = {}; sch.split('').forEach(L => { need[L] = (need[L] || 0) + 1; });
      Object.keys(need).forEach(L => { const fam = fams[fi++ % fams.length]; map[L] = { fam, list: take(fam, need[L]) }; });
      const ptr = {}; sch.split('').forEach(L => { const m = map[L], k = ptr[L] = (ptr[L] || 0); ptr[L]++; const x = m.list[k] || m.list[0] || { t: '…', s: 0 }; out.push({ t: x.t, s: x.s, L, fam: m.fam.i }); });
    }
    if (out[0]) out[0].t = out[0].t.charAt(0).toUpperCase() + out[0].t.slice(1);
    return out;
  }
  // Alternativen für ein Wort im Gerüst: am Zeilenende Reimwörter (Liste, sonst Familie), sonst Wörter aus dem Wortfeld mit gleicher Silbenzahl
  function kitAlts(theme, line, wi) {
    const T = KIT[theme] || KIT.nacht, ws = line.t.match(/[A-Za-zÄÖÜäöüß']+/g) || [], w = ws[wi] || '', last = wi === ws.length - 1, out = [];
    if (last) {
      const fam = T.r[line.fam] || []; fam.forEach(t => { const lw = lastWord(t); if (lw && lw.toLowerCase() !== w.toLowerCase() && !out.includes(lw)) out.push(lw); });
      if (LIST) rhymesFor(w, 40).rein.forEach(x => { if (!out.includes(x)) out.push(x); });
    } else if (/^[A-ZÄÖÜ]/.test(w) && wi > 0) {   // Wortfeld = Nomen: nur für groß geschriebene Wörter (nicht am Zeilenanfang)
      const s = X.syllables(w, 'de'); T.f.forEach(x => { if (x.toLowerCase() !== w.toLowerCase() && X.syllables(x, 'de') === s) out.push(x); });
      if (out.length < 4) T.f.forEach(x => { if (!out.includes(x) && x.toLowerCase() !== w.toLowerCase()) out.push(x); });
    }
    return { word: w, last, alts: out.slice(0, 24) };
  }
  function replaceWord(text, wi, nw) { let k = -1; return text.replace(/[A-Za-zÄÖÜäöüß']+/g, m => (++k === wi ? (/^[A-ZÄÖÜ]/.test(m) ? nw.charAt(0).toUpperCase() + nw.slice(1) : nw) : m)); }

  // ================= Prompt für Claude =================
  const PERSP = { ich: 'Ich-Perspektive', du: 'Du-Perspektive (jemand wird angesprochen)', wir: 'Wir-Perspektive', er: 'Er-/Sie-Perspektive (erzählt über jemanden)', erz: 'erzählend von außen' };
  function lineCount(p) { const t = (p.lyrics || [])[0] || ''; const n = t.split('\n').filter(x => X.stripChords(x).trim()).length; if (n) return n; const bars = C.beatsOf(p) / 4; return Math.max(2, Math.min(8, bars >= 8 ? bars / 2 : bars || 4)); }
  function songSyl(v) { const s = []; v.parts.forEach(p => (p.lyrics || []).forEach(t => String(t || '').split('\n').forEach(l => { if (X.stripChords(l).trim()) s.push(X.syllables(l, 'de')); }))); if (!s.length) return 8; s.sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
  // f = { task: 'vorgabe'|'ueberarbeiten', theme, mood, lang, persp, scheme, syl, parts: [ids], own }
  function buildPrompt(song, v, f) {
    const lab = X.labels(v), sel = v.parts.filter(p => (f.parts || []).includes(p.id));
    const secs = (sel.length ? sel : v.parts).map(p => '„' + lab[p.id] + '“ (' + lineCount(p) + ' Zeilen, ' + C.beatsOf(p) / 4 + ' Takte)').join(', ');
    const task = f.task === 'ueberarbeiten'
      ? 'Überarbeite meinen vorhandenen Text in diesen Abschnitten: bessere Bilder, sauberere Reime, natürlicher Sprachrhythmus. Inhalt und starke Zeilen behalten; schwache Zeilen ersetzen.'
      : 'Schreib mir eine Textvorgabe für diese Abschnitte, die ich danach selbst anpasse. Leere Abschnitte füllen; vorhandene Zeilen nur ändern, wenn es dem Reim oder der Silbenzahl dient.';
    const L = [];
    L.push('Ich schreibe einen Song mit meiner Gitarren-App „3nps“ und singe ihn selbst.', '', 'Aufgabe: ' + task, '', 'Vorgaben:');
    L.push('- Abschnitte: ' + secs);
    L.push('- Thema: ' + (String(f.theme || '').trim() || '(frei – schlag eins vor, das zur Stimmung passt)'));
    L.push('- Stimmung: ' + (String(f.mood || '').trim() || '(frei)'));
    L.push('- Sprache des Textes: ' + (f.lang === 'en' ? 'Englisch' : 'Deutsch'));
    L.push('- Perspektive: ' + (PERSP[f.persp] || PERSP.ich));
    L.push('- Reimschema je Abschnitt: ' + (f.scheme === 'frei' ? 'frei (Reime erlaubt, aber kein festes Schema)' : (f.scheme || 'ABAB') + ' – Endreime, reine Reime bevorzugt, unreine nur sparsam'));
    L.push('- Silben je Zeile: etwa ' + (f.syl || 8) + ' (±1); Zeilen, die sich entsprechen (z. B. Strophe 1 und 2), gleich lang; Betonungen natürlich auf die Schläge');
    if (String(f.own || '').trim()) { L.push('- Eigene Zeilen/Bilder, die vorkommen sollen (gern umformulieren, aber Sinn behalten):'); String(f.own).trim().split('\n').forEach(x => { if (x.trim()) L.push('  ' + x.trim()); }); }
    L.push('- Keine Zeilen aus bekannten Liedern übernehmen, alles neu formulieren; konkrete Bilder statt allgemeiner Gefühlswörter, wenig Klischees.');
    L.push('', 'Antwortformat: Bitte antworte mit dem vollständigen Song-Code (von „' + X.HEAD + '“ bis „' + X.END + '“) in einem Codeblock, damit ich ihn direkt in die App einfügen kann. Ändere nur die Zeilen unter „Text 1:“, „Text 2:“ … der genannten Abschnitte; Titel, Tonart, Tempo, Ablauf und Akkorde bleiben, wie sie sind. Akkordwechsel darfst du mit [Am] direkt vor der Silbe markieren. „(leer)“ = noch kein Text. Unter „Notiz:“ in einer Zeile zusammenfassen, was du gemacht hast. Erklärungen gern außerhalb des Codeblocks.', '');
    L.push(X.toCode(song, v));
    return L.join('\n') + '\n';
  }
  const LHEAD = '=== 3NPS ZEILEN ===';
  // „Diese Zeile besser formulieren“: Zeile + Zusammenhang + Reim/Silben-Vorgabe
  function linePrompt(song, v, partId, n, lineIdx, f) {
    const p = C.partById(v, partId); if (!p) return '';
    const txt = (p.lyrics || [])[n] || '', all = txt.split('\n'), line = all[lineIdx] || '', ck = checkText(txt), li = ck.lines.find(x => x.i === lineIdx), lab = X.labels(v);
    const partner = li && li.lv && li.lv !== 'gleich' ? ck.lines[li.with] : (li ? ck.lines.find(x => x.with != null && ck.lines[x.with] === li) : null);
    const L = ['Ich schreibe einen Song mit meiner Gitarren-App „3nps“ und singe ihn selbst. Bitte formuliere diese eine Zeile besser – 5 Vorschläge.', ''];
    L.push('Zeile: „' + X.stripChords(line).trim() + '“');
    L.push('Abschnitt „' + lab[p.id] + '“, ganzer Text (als Zusammenhang):'); all.forEach(x => { if (x.trim()) L.push('  ' + X.stripChords(x).trim()); });
    L.push('', 'Vorgaben:');
    L.push('- Sinn und Bild ungefähr behalten, aber natürlicher, singbarer, konkreter.');
    L.push('- Etwa ' + (li ? li.syl : (f && f.syl) || 8) + ' Silben (±1), Betonungen natürlich.');
    if (partner) L.push('- Das Zeilenende soll auf „' + partner.word + '“ reimen (Zeile „' + partner.text + '“), reiner Reim bevorzugt.');
    else L.push('- Das Zeilenende darf sich ändern; wenn möglich ein Reim zu einer anderen Zeile des Abschnitts.');
    if (f && String(f.mood || '').trim()) L.push('- Stimmung: ' + String(f.mood).trim());
    L.push('- Sprache: ' + (f && f.lang === 'en' ? 'Englisch' : 'Deutsch') + '; keine Zeilen aus bekannten Liedern.');
    L.push('', 'Antworte bitte genau in diesem Format in einem Codeblock (die App liest es ein):', LHEAD, 'Teil: ' + lab[p.id] + (n ? ' | Text ' + (n + 1) : ''), 'Zeile: ' + X.stripChords(line).trim(), '1. …', '2. …', '3. …', '4. …', '5. …', X.END);
    return L.join('\n') + '\n';
  }
  // Rückweg 1: Zeilen-Vorschläge („=== 3NPS ZEILEN ===“), tolerant auch als nummerierte Liste
  function parseLines(text) {
    const s = String(text || '').replace(/\r/g, ''), a = s.indexOf(LHEAD);
    let body = a >= 0 ? s.slice(a + LHEAD.length) : s;
    const e = body.search(/^\s*=+\s*ENDE\s*=*\s*$/m); if (e >= 0) body = body.slice(0, e);
    const head = {}, alts = [];
    body.split('\n').forEach(l => {
      const x = l.replace(/^\s*```.*$/, '').replace(/\*\*/g, '').trim(); if (!x) return;
      const hm = /^(Teil|Zeile)\s*:\s*(.*)$/i.exec(x); if (hm) { head[hm[1].toLowerCase()] = hm[2].trim(); return; }
      const nm = /^(\d+)[.)]\s*(.+)$/.exec(x); if (nm) alts.push(nm[2].replace(/^[„"“]|[“"”]$/g, '').trim());
    });
    if (a < 0 && alts.length < 2) return null;
    if (!alts.length) return null;
    const pm = /^(.*?)(?:\s*\|\s*Text\s*(\d+))?$/i.exec(head.teil || '');
    return { part: pm ? pm[1].trim() : '', n: pm && pm[2] ? +pm[2] - 1 : 0, line: head.zeile || '', alts: alts.slice(0, 10), marked: a >= 0 };
  }
  // Rückweg 2: freier Text → Abschnitte (Überschriften wie „Strophe 1:“, „[Refrain]“, „## Bridge“, „**Refrain**“), sonst alles in einen Ziel-Abschnitt
  function parseFree(text, v) {
    const s = String(text || '').replace(/\r/g, '').replace(/^\s*```.*$/gm, '');
    const lab = X.labels(v), byLab = {}; v.parts.forEach(p => { byLab[lab[p.id].toLowerCase()] = p; });
    const blocks = []; let cur = null;
    const findPart = (h) => {
      const t = h.toLowerCase().replace(/[*#\[\]:]/g, '').trim(); if (byLab[t]) return { p: byLab[t], n: 0 };
      const m = /^(.*?)\s*(\d+)?\s*$/.exec(t), base = m[1].trim(), num = m[2] ? +m[2] : 0;
      if (byLab[base]) return { p: byLab[base], n: num ? num - 1 : 0 };
      const TF = [['pre', /^(pre|vorrefrain|pre-?chorus)/], ['chorus', /^(refrain|chorus|hook)/], ['verse', /^(strophe|verse|vers)/], ['bridge', /^(bridge|zwischenteil|mittelteil)/], ['intro', /^intro/], ['outro', /^(outro|schluss)/]];
      const tf = TF.find(x => x[1].test(base)); if (!tf) return null;
      const ps = v.parts.filter(p => p.type === tf[0]); if (!ps.length) return { missing: tf[0], label: h.replace(/[*#\[\]:]/g, '').trim() };
      if (tf[0] === 'verse' && num) { // „Strophe 2“: zweite Strophe = zweites Mal derselben Strophe oder zweiter Strophen-Teil
        if (ps.length >= num) return { p: ps[num - 1], n: 0 }; return { p: ps[0], n: num - 1 };
      }
      return { p: ps[0], n: 0 };
    };
    s.split('\n').forEach(l => {
      const x = l.trim();
      const hm = /^(?:#{1,3}\s*|\*\*|\[)?\s*((?:strophe|verse|vers|refrain|chorus|hook|pre-?chorus|vorrefrain|bridge|zwischenteil|mittelteil|intro|outro|schluss)[^\]:*]{0,14})\s*[\]:*]*\s*$/i.exec(x);
      if (hm || (x && byLab[x.toLowerCase().replace(/[*#\[\]:]/g, '').trim()] && x.length < 30 && /[:\]#*]/.test(x))) {
        cur = { head: hm ? hm[1].trim() : x, target: findPart(hm ? hm[1] : x), lines: [] }; blocks.push(cur); return;
      }
      if (!cur) { cur = { head: '', target: null, lines: [] }; blocks.push(cur); }
      cur.lines.push(l.replace(/\s+$/, ''));
    });
    blocks.forEach(b => { while (b.lines.length && !b.lines[0].trim()) b.lines.shift(); while (b.lines.length && !b.lines[b.lines.length - 1].trim()) b.lines.pop(); b.text = b.lines.join('\n'); });
    return blocks.filter(b => b.text.trim() && !/^(notiz|erklärung|hinweis)/i.test(b.head));
  }
  // Text-Vorschlag als neue Version (Kopie): Ziele { p, n } bekommen den Text
  function applyTexts(v, items) {
    const nv = C.clone(v);
    items.forEach(it => { const p = nv.parts.find(x => x.id === it.p.id); if (!p) return; const L = (p.lyrics || []).slice(); while (L.length < it.n) L.push(''); L[it.n] = it.text; p.lyrics = L; });
    return nv;
  }
  function applyChords(v, type, chords, name) {
    const nv = C.clone(v); let p = nv.parts.find(x => x.type === type), added = false;
    if (!p) { p = { id: C.newId('p'), name: name || C.TYPES[type] || 'Teil', type, chords: [], lyrics: [], audio: null }; nv.parts.push(p); nv.order.push({ p: p.id, reps: 1 }); added = true; }
    const oldBars = C.beatsOf(p) / 4, n = chords.length; let reps = 1;
    if (oldBars > n && oldBars % n === 0) reps = oldBars / n;
    const seq = []; for (let r = 0; r < reps; r++) chords.forEach(c => seq.push({ r: c.r, t: c.t, beats: 4 }));
    p.chords = seq; return { v: nv, part: p, added };
  }

  const API = { sounds, rhymePart, rhymeLevel, checkText, parseList, setList, loadList, rhymesFor, pNear, MOODS, GEN, TENS, SEC_N, parseMood, suggest, progChords, degree, modeName, KIT, kitDraft, kitAlts, replaceWord, buildPrompt, linePrompt, parseLines, parseFree, applyTexts, applyChords, songSyl, lineCount, LHEAD, esc, get list() { return LIST; } };
  if (!W) { module.exports = API; return; }
  W.TextWerk = API;

  // ================= Oberfläche =================
  const $ = id => document.getElementById(id), LA = () => W.LiedApi;
  const TT = x => (typeof W.T === 'function' ? W.T(x) : x);
  const ST = { pane: 'reim', sel: null, word: '', sylF: 0, moodText: '', secSet: {}, kit: { theme: 'nacht', scheme: 'ABAB', n: 4, syl: 0, seed: 1, lines: null, pick: null }, lastLine: null, prompt: { task: 'vorgabe', lang: 'de', persp: 'ich', scheme: 'ABAB', parts: null, own: '' } };
  let root = null, tReim = null;
  const PANES = [['reim', 'Reime prüfen'], ['wort', 'Reimwörter'], ['akk', 'Akkorde nach Stimmung'], ['kit', 'Baukasten'], ['prompt', 'Prompt für Claude']];
  const btn = (a, t, cls, extra) => '<button class="toggle-btn' + (cls ? ' ' + cls : '') + '" data-a="' + a + '"' + (extra || '') + '>' + t + '</button>';
  function slots() { const A = LA(), v = A && A.ver(); return v ? A.textSlots(v) : []; }
  function slotName(sl) { return sl.p.name + (sl.multi ? ' · ' + (sl.n + 1) + '. Mal' : ''); }
  function open(box) {
    root = box; box.hidden = false;
    if (!box.dataset.tw) {
      box.dataset.tw = '1';
      box.innerHTML = '<div class="tw">'
        + (W.__lang === 'en' ? '<p class="tw-en">The text workshop works with German lyrics (rhyme check, rhyme words, word kit, chord reasons and the prompt are in German). Claude understands the German prompt – choose “Englisch” as language for English lyrics.</p>' : '')
        + '<div class="tw-nav">' + PANES.map(p => '<button class="toggle-btn" data-pane="' + p[0] + '">' + p[1] + '</button>').join('') + '</div>'
        + '<div class="tw-body" id="twBody" translate="no"></div></div>';
      box.addEventListener('click', onClick); box.addEventListener('change', onChange); box.addEventListener('input', onInput);
      const tx = $('ldTexts'); if (tx) tx.addEventListener('input', () => { if (ST.pane === 'reim' && root && !root.hidden) { clearTimeout(tReim); tReim = setTimeout(paneReim, 350); } });
    }
    show(ST.pane);
  }
  function show(p) {
    ST.pane = p; if (!root) return;
    root.querySelectorAll('[data-pane]').forEach(b => b.classList.toggle('active', b.dataset.pane === p));
    ({ reim: paneReim, wort: paneWort, akk: paneAkk, kit: paneKit, prompt: panePrompt })[p]();
  }
  function refresh() { if (root && !root.hidden) show(ST.pane); }
  const body = () => $('twBody');
  function status(t) { const A = LA(); if (A) A.status(t); }

  // ---------- Reime prüfen ----------
  function markLine(x) {
    const t = x.text, w = x.word, k = w ? t.lastIndexOf(w) : -1;
    const cls = 'tw-w tw-c' + ((x.letter.charCodeAt(0) - 65) % 6) + (x.alone ? ' tw-alone' : '');
    return k < 0 ? esc(t) : esc(t.slice(0, k)) + '<b class="' + cls + '">' + esc(w) + '</b>' + esc(t.slice(k + w.length));
  }
  const LV = { rein: 'rein', unrein: '~ unrein', gleich: '= gleiches Wort' };
  function paneReim() {
    const b = body(); if (!b) return;
    const sl = slots().filter(x => String((x.p.lyrics || [])[x.n] || '').trim());
    if (!sl.length) { b.innerHTML = '<p class="tw-note">Noch kein Text. Schreib oben im Bereich „Text“ ein paar Zeilen – hier siehst du dann Reime, Silben und Hinweise. Oder bau dir im „Baukasten“ ein Startgerüst.</p>'; return; }
    const hints = []; let html = '<p class="tw-note">Farbe = Reimpaar (gleicher Buchstabe). <b>rein</b> = gleicher Klang ab dem betonten Vokal · <b>~ unrein</b> = ähnlich (ü/i, ö/e, eu/ei, lang/kurz, verwandte Endkonsonanten) · <b>= gleiches Wort</b> · grau = ohne Partner. Zeile antippen für Reimwörter oder „besser formulieren“. Diese Prüfung ist genauer als die Buchstaben links neben dem Text (die bleiben wie bisher).</p>';
    sl.forEach(x => {
      const txt = x.p.lyrics[x.n], r = checkText(txt, slotName(x));
      r.hints.forEach(h => hints.push(h));
      html += '<div class="tw-sec"><div class="tw-sech"><b>' + esc(slotName(x)) + '</b><span>Schema ' + esc(r.scheme) + ' · Silben ' + r.lines.map(l => l.syl).join('/') + '</span></div>';
      r.lines.forEach((l, k) => {
        const on = ST.sel && ST.sel.pid === x.p.id && ST.sel.n === x.n && ST.sel.i === l.i;
        html += '<button class="tw-line' + (on ? ' on' : '') + '" data-a="line" data-pid="' + x.p.id + '" data-n="' + x.n + '" data-i="' + l.i + '"><span class="tw-syl">' + l.syl + '</span><span class="tw-let tw-c' + ((l.letter.charCodeAt(0) - 65) % 6) + (l.alone ? ' tw-alone' : '') + '">' + l.letter + '</span><span class="tw-tx">' + markLine(l) + '</span><span class="tw-lv">' + (l.lv ? LV[l.lv] + ' ↔ ' + (l.with + 1) : l.alone ? 'ohne Reim' : '') + '</span></button>';
        if (on) html += '<div class="tw-act">' + btn('l-wort', 'Reimwörter zu „' + esc(l.word) + '“') + btn('l-prompt', 'Diese Zeile besser formulieren') + '</div>';
      });
      html += '</div>';
    });
    html += '<h4 class="tw-h">Hinweise</h4>' + (hints.length ? '<ul class="tw-hints">' + hints.map(h => '<li>' + esc(h.text) + '</li>').join('') + '</ul>' : '<p class="tw-note">Keine Auffälligkeiten.</p>');
    html += '<p class="tw-note tw-small">Grenzen: Reime nach der Schreibung, die Betonung wird geschätzt (meist erste Stammsilbe; Nachsilben wie -ung, -lich, -heit gelten als unbetont). Fremdwörter, Namen und Dialekt können falsch eingeordnet werden – dein Ohr entscheidet.</p>';
    b.innerHTML = html;
  }
  // ---------- Reimwörter ----------
  function paneWort() {
    const b = body(); if (!b) return;
    b.innerHTML = '<div class="tw-row"><label class="field"><span>Wort</span><input type="text" id="twWord" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(ST.word) + '" placeholder="z. B. Nacht"></label>' + btn('w-go', 'Reimwörter', 'active') + '</div>'
      + '<div class="tw-row tw-chips" id="twSylF">' + [[0, 'alle'], [1, '1 Silbe'], [2, '2 Silben'], [3, '3+ Silben']].map(x => '<button class="toggle-btn' + (ST.sylF === x[0] ? ' active' : '') + '" data-a="w-syl" data-s="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>'
      + (ST.sel ? '<p class="tw-note" id="twCtx">Antippen setzt das Wort in Zeile „' + esc(ST.sel.text) + '“ statt „' + esc(ST.sel.word) + '“ ein (als neue Version).</p>' : '<p class="tw-note" id="twCtx">Antippen kopiert das Wort. Tipp: Unter „Reime prüfen“ eine Zeile antippen – dann setzt ein Antippen das Wort direkt dort ein.</p>')
      + '<div id="twWRes"></div><p class="tw-note tw-small">Wortliste: „German MFA dictionary v3.0.0“ (McAuliffe &amp; Sonderegger 2024, Montreal Forced Aligner), CC BY 4.0, gekürzt auf rund 110 000 Wörter – gruppiert nach Klang, häufig gebrauchte zuerst (geschätzt). Wird beim ersten Mal geladen (≈ 0,4 MB), danach offline.</p>';
    if (ST.word) findWords();
  }
  function findWords() {
    const out = $('twWRes'); if (!out) return;
    const w = ST.word.trim(); if (!w) { out.innerHTML = ''; return; }
    out.innerHTML = '<p class="tw-note">Lade die Wortliste …</p>';
    loadList().then(() => {
      if (!$('twWRes')) return;
      const r = rhymesFor(w, 600), f = x => { const n = X.syllables(x, 'de'); return !ST.sylF || (ST.sylF === 3 ? n >= 3 : n === ST.sylF); };
      const chips = (arr, cls) => arr.filter(f).slice(0, 120).map(x => '<button class="tw-word ' + cls + '" data-a="w-pick" data-w="' + esc(x) + '">' + esc(x) + '</button>').join('');
      const re = chips(r.rein, 'rein'), un = chips(r.unrein, 'unrein');
      $('twWRes').innerHTML = (r.src === 'schreibung' ? '<p class="tw-note">„' + esc(w) + '“ steht nicht in der Liste – Reime nach der Schreibung gesucht.</p>' : '')
        + '<h4 class="tw-h">Rein</h4>' + (re ? '<div class="tw-words">' + re + '</div>' : '<p class="tw-note">Keine reinen Reime gefunden.</p>')
        + (r.src === 'liste' ? '<h4 class="tw-h">Unrein (ähnlicher Klang)</h4>' + (un ? '<div class="tw-words">' + un + '</div>' : '<p class="tw-note">Keine.</p>') : '');
    }).catch(() => { if ($('twWRes')) $('twWRes').innerHTML = '<p class="tw-note">Die Wortliste konnte nicht geladen werden – bitte einmal mit Internet öffnen, danach geht es offline.</p>'; });
  }
  function keepChords(oldRaw, nt) {
    const marks = []; let plain = ''; String(oldRaw).replace(/\[[^\]]*\]|[^[]+/g, m => { if (m[0] === '[' && m.endsWith(']')) marks.push({ c: m, at: plain.length }); else plain += m; return m; });
    if (!marks.length) return nt;
    const L = plain.length || 1; let out = nt, shift = 0;
    marks.forEach(m => { let pos = Math.min(nt.length, Math.round(m.at / L * nt.length)); while (pos > 0 && /\S/.test(nt[pos - 1])) pos--; out = out.slice(0, pos + shift) + m.c + out.slice(pos + shift); shift += m.c.length; });
    return out;
  }
  function setLine(pid, n, i, newText, note) {
    const A = LA(), v = A.ver(), p = C.partById(v, pid); if (!p) return false;
    const L = String((p.lyrics || [])[n] || '').split('\n'); if (i >= L.length) return false;
    L[i] = keepChords(L[i], newText);
    const nv = applyTexts(v, [{ p, n, text: L.join('\n') }]);
    A.pushVersion(nv, note.slice(0, 70)); A.render(); return true;
  }
  // ---------- Akkorde nach Stimmung ----------
  function secTypes() { const A = LA(), v = A && A.ver(), t = []; if (v) v.parts.forEach(p => { if (SEC_N[p.type] && !t.includes(p.type)) t.push(p.type); }); return t.length ? t : ['verse', 'chorus']; }
  const MOPT = () => '<option value="">–</option>' + Object.keys(MOODS).map(k => '<option value="' + k + '">' + k + '</option>').join('');
  const TOPT = () => '<option value="">üblich</option>' + Object.keys(TENS).map(k => '<option value="' + k + '">' + TENS[k] + '</option>').join('');
  function paneAkk() {
    const b = body(); if (!b) return; const A = LA(), v = A.ver();
    let h = '<div class="tw-row"><label class="field tw-grow"><span>Wie soll es klingen?</span><input type="text" id="twMood" autocomplete="off" value="' + esc(ST.moodText) + '" placeholder="z. B. traurig, mit Spannungsabfall danach im Refrain"></label>' + btn('m-parse', 'Verstehen', 'active') + '</div><div id="twMoodRes"></div>';
    h += '<div class="tw-secs">' + secTypes().map(t => { const s = ST.secSet[t] || {}; return '<div class="tw-srow"><b>' + SEC_N[t] + '</b><label class="field"><span>Stimmung</span><select data-sec="' + t + '" data-k="mood">' + MOPT() + '</select></label><label class="field"><span>Spannung</span><select data-sec="' + t + '" data-k="tens">' + TOPT() + '</select></label></div>'; }).join('') + '</div>';
    h += '<div class="tw-row">' + btn('m-go', 'Vorschläge', 'active') + '<span class="tw-note">Tonart des Songs: <b>' + esc(C.keyLabel(v.key)) + '</b> – Moll-Stimmungen laufen in einem Dur-Song über die Moll-Parallele.</span></div><div id="twAkRes"></div>';
    h += '<p class="tw-note tw-small">Regelwerk: Moll/Dur gibt die Farbe, die Dominante (V) baut Spannung auf, die Auflösung V→I bzw. iv→i lässt sie abfallen, der Trugschluss (V→vi) löst nur halb, die Subdominante (IV/iv) öffnet. Akkorde geben nur die Richtung – Tempo, Melodie und Text entscheiden mit.</p>';
    b.innerHTML = h;
    b.querySelectorAll('select[data-sec]').forEach(sel => { const s = ST.secSet[sel.dataset.sec] || {}; sel.value = s[sel.dataset.k] || ''; });
    if (ST.moodRes) moodInfo(ST.moodRes);
    if (ST.akShown) akkShow();
  }
  function moodInfo(r) {
    const el = $('twMoodRes'); if (!el) return;
    el.innerHTML = (r.found.length ? '<p class="tw-note">Erkannt: ' + esc(r.found.join(' · ')) + '</p>' : '<p class="tw-note">Keine Stimmung erkannt.</p>')
      + (r.notes.length ? '<p class="tw-note">' + esc(r.notes.join(' ')) + '</p>' : '')
      + (r.unknown.length ? '<p class="tw-note tw-unk">Nicht verstanden: ' + esc(r.unknown.join(', ')) + '. Bekannt sind: ' + Object.keys(MOODS).join(', ') + '; Spannung: steigt, fällt ab / löst sich, offen enden, bleibt gleich, Kontrast; Abschnitte: Strophe, Pre-Chorus, Refrain, Bridge.</p>' : '');
  }
  function parseInto() {
    const r = parseMood(ST.moodText); ST.moodRes = r; ST.secSet = {};
    secTypes().concat(Object.keys(r.sec)).forEach(t => { if (!SEC_N[t]) return; const s = r.sec[t] || {}; ST.secSet[t] = { mood: s.mood || r.all || '', tens: s.tens || '' }; });
    return r;
  }
  function akkShow() {
    const el = $('twAkRes'); if (!el) return; ST.akShown = true;
    const v = LA().ver(), out = [];
    secTypes().forEach(t => {
      const s = ST.secSet[t] || {}, sg = suggest(t, s.mood || null, s.tens || null, v.key, 3);
      out.push('<div class="tw-sec"><div class="tw-sech"><b>' + SEC_N[t] + '</b><span>' + esc((s.mood || 'ohne Stimmung') + ' · ' + (s.tens ? TENS[s.tens] : TENS[SEC_DEF[t]] ? 'üblich (' + TENS[SEC_DEF[t]] + ')' : 'üblich')) + '</span></div>'
        + sg.list.map((x, i) => '<div class="tw-prog"><div class="tw-pch" translate="no">' + esc(x.names) + '</div><div class="tw-pdeg">' + esc(x.d) + ' · ' + esc(x.via) + '</div><div class="tw-why">' + esc(x.why) + '</div><div class="tw-pact">' + btn('m-hear', '▶ Anhören', '', ' data-t="' + t + '" data-i="' + i + '"') + btn('m-take', 'Übernehmen', '', ' data-t="' + t + '" data-i="' + i + '"') + '</div></div>').join('') + '</div>');
    });
    el.innerHTML = out.join('');
  }
  function akkGet(t, i) { const s = ST.secSet[t] || {}; return suggest(t, s.mood || null, s.tens || null, LA().ver().key, 3).list[+i]; }
  // ---------- Baukasten ----------
  function paneKit() {
    const b = body(); if (!b) return; const K = ST.kit, v = LA().ver(); if (!K.syl) K.syl = songSyl(v);
    let h = '<p class="tw-note">Baut aus selbst geschriebenen Zeilen je Thema ein Startgerüst nach Reimschema und Silbenzahl. Das ist ein Baukasten-Entwurf, kein fertiger Text – Wörter antippen und austauschen, dann übernehmen und weiterschreiben.</p>';
    h += '<div class="tw-row"><label class="field"><span>Thema</span><select id="twKTheme">' + Object.keys(KIT).map(k => '<option value="' + k + '">' + KIT[k].n + '</option>').join('') + '</select></label>'
      + '<label class="field"><span>Reimschema</span><select id="twKScheme"><option>ABAB</option><option>AABB</option><option>ABCB</option></select></label>'
      + '<label class="field"><span>Zeilen</span><select id="twKN"><option value="4">4</option><option value="8">8</option></select></label>'
      + '<label class="field"><span>Silben</span><input type="number" id="twKSyl" min="4" max="16" value="' + K.syl + '" inputmode="numeric"></label>'
      + btn('k-go', K.lines ? 'Neu würfeln' : 'Gerüst bauen', 'active') + '</div><div id="twKOut"></div>';
    b.innerHTML = h; $('twKTheme').value = K.theme; $('twKScheme').value = K.scheme; $('twKN').value = String(K.n);
    kitShow();
  }
  function kitShow() {
    const el = $('twKOut'), K = ST.kit; if (!el) return;
    if (!K.lines) { el.innerHTML = ''; return; }
    let h = '<div class="tw-sec">' + K.lines.map((l, li) => { let k = -1; const ws = l.t.replace(/[A-Za-zÄÖÜäöüß']+/g, m => { k++; return '<button class="tw-kw' + (K.pick && K.pick.li === li && K.pick.wi === k ? ' on' : '') + '" data-a="k-word" data-li="' + li + '" data-wi="' + k + '">' + esc(m) + '</button>'; });
      return '<div class="tw-kl"><span class="tw-syl">' + X.syllables(l.t, 'de') + '</span><span class="tw-let tw-c' + ((l.L.charCodeAt(0) - 65) % 6) + '">' + l.L + '</span><span class="tw-tx">' + ws + '</span></div>' + (K.pick && K.pick.li === li ? '<div class="tw-alts" id="twKAlts"></div>' : ''); }).join('') + '</div>';
    const sl = slots();
    h += '<div class="tw-row"><label class="field"><span>Übernehmen nach</span><select id="twKTo">' + sl.map((x, i) => '<option value="' + i + '">' + esc(slotName(x)) + '</option>').join('') + '</select></label>' + btn('k-rep', 'Ersetzen (neue Version)') + btn('k-app', 'Anhängen (neue Version)') + '</div>';
    el.innerHTML = h;
    if (K.pick) kitAltsShow();
  }
  function kitAltsShow() {
    const el = $('twKAlts'), K = ST.kit; if (!el || !K.pick) return;
    const r = kitAlts(K.theme, K.lines[K.pick.li], K.pick.wi);
    el.innerHTML = (r.alts.length ? r.alts.map(a => '<button class="tw-word" data-a="k-alt" data-w="' + esc(a) + '">' + esc(a) + '</button>').join('') : '<span class="tw-note">Vorschläge gibt es für Nomen und das Reimwort am Zeilenende – alles andere nach dem Übernehmen direkt im Text ändern.</span>')
      + (r.last && !list() ? ' <button class="toggle-btn" data-a="k-more">Mehr Reimwörter laden</button>' : '');
  }
  const list = () => LIST;
  // ---------- Prompt für Claude ----------
  function panePrompt() {
    const b = body(); if (!b) return; const A = LA(), v = A.ver(), P = ST.prompt, sl = A.textSlots(v);
    if (P.sid !== A.song().id) { P.sid = A.song().id; P.theme = v.theme || ''; P.parts = null; P.syl = 0; }
    if (!P.syl) P.syl = songSyl(v);
    if (!P.parts) P.parts = v.parts.filter(p => SEC_N[p.type]).map(p => p.id);
    const line = ST.sel;
    let h = '<div class="tw-row"><label class="field tw-grow"><span>Aufgabe</span><select id="twPTask"><option value="vorgabe">Textvorgabe schreiben (zum Anpassen)</option><option value="ueberarbeiten">Meinen Text überarbeiten</option><option value="zeile"' + (line ? '' : ' disabled') + '>Ausgewählte Zeile besser formulieren' + (line ? ': „' + esc(line.text.slice(0, 30)) + (line.text.length > 30 ? '…' : '') + '“' : ' (erst unter „Reime prüfen“ eine Zeile antippen)') + '</option></select></label></div>';
    h += '<div class="tw-grid">'
      + '<label class="field"><span>Thema</span><input type="text" id="twPTheme" maxlength="200" value="' + esc(P.theme) + '" placeholder="Worum geht es?"></label>'
      + '<label class="field"><span>Stimmung</span><input type="text" id="twPMood" maxlength="120" value="' + esc(P.mood == null ? ST.moodText : P.mood) + '" placeholder="z. B. traurig, am Ende hoffnungsvoll"></label>'
      + '<label class="field"><span>Sprache</span><select id="twPLang"><option value="de">Deutsch</option><option value="en">Englisch</option></select></label>'
      + '<label class="field"><span>Perspektive</span><select id="twPPersp">' + Object.keys(PERSP).map(k => '<option value="' + k + '">' + PERSP[k].replace(/ \(.*\)$/, '') + '</option>').join('') + '</select></label>'
      + '<label class="field"><span>Reimschema</span><select id="twPScheme"><option>ABAB</option><option>AABB</option><option>ABCB</option><option value="frei">frei</option></select></label>'
      + '<label class="field"><span>Silben je Zeile</span><input type="number" id="twPSyl" min="3" max="20" value="' + P.syl + '" inputmode="numeric"></label></div>';
    h += '<div class="tw-row tw-chips" id="twPParts"><span class="tw-note">Abschnitte:</span>' + v.parts.map(p => '<label class="check"><input type="checkbox" value="' + p.id + '"' + (P.parts.includes(p.id) ? ' checked' : '') + '> <span translate="no">' + esc(p.name) + '</span></label>').join('') + '</div>';
    h += '<label class="field"><span>Eigene Zeilen / Bilder, die vorkommen sollen</span><textarea class="ld-area" id="twPOwn" rows="2" placeholder="z. B. „die Ampel blinkt gelb, niemand wartet“">' + esc(P.own) + '</textarea></label>';
    h += '<div class="tw-row">' + btn('p-copy', 'Prompt kopieren', 'active') + (navigator.share ? btn('p-share', 'Teilen …') : '') + btn('p-view', 'Prompt ansehen') + '</div><textarea class="ld-area" id="twPView" rows="8" readonly hidden></textarea>';
    h += '<h4 class="tw-h">Antwort zurückholen</h4><p class="tw-note">Claudes Antwort kopieren, dann hier einfügen – die App erkennt Song-Code, Zeilen-Vorschläge oder freien Text und zeigt bei „Mit Claude weiterarbeiten“ eine Vorschau. Übernommen wird immer als neue Version (mit „Version“ kommst du zurück).</p>'
      + '<div class="tw-row">' + btn('p-clip', 'Aus Zwischenablage einfügen', 'active') + btn('p-goto', 'Zum Einfügen-Feld ↓') + '</div>';
    b.innerHTML = h;
    $('twPTask').value = line && P.task === 'zeile' ? 'zeile' : (P.task === 'zeile' ? 'vorgabe' : P.task); $('twPLang').value = P.lang; $('twPPersp').value = P.persp; $('twPScheme').value = P.scheme;
  }
  function readPromptForm() {
    const P = ST.prompt; if (!$('twPTask')) return P;
    P.task = $('twPTask').value; P.theme = $('twPTheme').value; P.mood = $('twPMood').value; P.lang = $('twPLang').value; P.persp = $('twPPersp').value; P.scheme = $('twPScheme').value;
    P.syl = Math.max(3, Math.min(20, Math.round(+$('twPSyl').value) || 8)); P.own = $('twPOwn').value; P.parts = [...root.querySelectorAll('#twPParts input:checked')].map(x => x.value);
    return P;
  }
  function promptNow() {
    const A = LA(), s = A.song(), v = A.ver(), P = readPromptForm();
    if (P.task === 'zeile' && ST.sel) { ST.lastLine = Object.assign({}, ST.sel); return linePrompt(s, v, ST.sel.pid, ST.sel.n, ST.sel.i, P); }
    return buildPrompt(s, v, P);
  }

  // ---------- Ereignisse ----------
  async function onClick(e) {
    const pb = e.target.closest('[data-pane]'); if (pb) { show(pb.dataset.pane); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, A = LA();
    if (a === 'line') {
      const pid = b.dataset.pid, n = +b.dataset.n, i = +b.dataset.i, p = C.partById(A.ver(), pid), raw = String((p.lyrics || [])[n] || '').split('\n')[i] || '', t = X.stripChords(raw).trim();
      ST.sel = (ST.sel && ST.sel.pid === pid && ST.sel.n === n && ST.sel.i === i) ? null : { pid, n, i, text: t, word: lastWord(t) };
      paneReim(); return;
    }
    if (a === 'l-wort') { ST.word = ST.sel.word; show('wort'); return; }
    if (a === 'l-prompt') { ST.prompt.task = 'zeile'; show('prompt'); return; }
    if (a === 'w-go') { ST.word = $('twWord').value; findWords(); return; }
    if (a === 'w-syl') { ST.sylF = +b.dataset.s; root.querySelectorAll('[data-a=w-syl]').forEach(x => x.classList.toggle('active', x === b)); findWords(); return; }
    if (a === 'w-pick') {
      const w = b.dataset.w;
      if (ST.sel) {
        const s0 = ST.sel, nw = /^[A-ZÄÖÜ]/.test(s0.word) ? w.charAt(0).toUpperCase() + w.slice(1) : w, k = s0.text.lastIndexOf(s0.word), nt = s0.text.slice(0, k) + nw + s0.text.slice(k + s0.word.length);
        if (setLine(s0.pid, s0.n, s0.i, nt, 'Reimwort: ' + s0.word + ' → ' + nw)) { status('„' + nw + '“ eingesetzt – neue Version V' + A.ver().n + '. Mit „Version“ kommst du zurück.'); ST.sel = Object.assign(s0, { text: nt, word: nw }); paneWort(); }
      } else status(await A.copyText(w) ? '„' + w + '“ kopiert.' : '„' + w + '“');
      return;
    }
    if (a === 'm-parse') { ST.moodText = $('twMood').value; const r = parseInto(); paneAkk(); moodInfo(r); akkShow(); return; }
    if (a === 'm-go') { if ($('twMood') && $('twMood').value !== ST.moodText) { ST.moodText = $('twMood').value; parseInto(); paneAkk(); } akkShow(); return; }
    if (a === 'm-hear') {
      const t = b.dataset.t, x = akkGet(t, b.dataset.i), v = A.ver(), lbl = 'Vorschlag ' + SEC_N[t] + ': ' + x.names;
      if (A.playing() === lbl) { A.stop(); return; }
      if (!$('ldTP').checked) { $('ldTP').checked = true; }
      A.play({ key: v.key, bpm: v.bpm, theme: '', parts: [{ id: 'twprev', name: SEC_N[t], type: t, chords: x.chords.map(c => Object.assign({}, c)), lyrics: [], audio: null }], order: [{ p: 'twprev', reps: 1 }] }, { label: lbl });
      return;
    }
    if (a === 'm-take') {
      const t = b.dataset.t, x = akkGet(t, b.dataset.i), s = ST.secSet[t] || {}, r = applyChords(A.ver(), t, x.chords, SEC_N[t]);
      if (A.playing()) A.stop();
      A.pushVersion(r.v, ('Akkorde ' + SEC_N[t] + ': ' + x.names + (s.mood ? ' (' + s.mood + ')' : '')).slice(0, 70)); A.render();
      status((r.added ? 'Neuer Teil „' + r.part.name + '“ am Ende des Ablaufs, ' : '„' + r.part.name + '“: ') + x.names + ' übernommen – neue Version V' + A.ver().n + '. Mit „Version“ kommst du zurück.');
      return;
    }
    if (a === 'k-go') { const K = ST.kit; K.theme = $('twKTheme').value; K.scheme = $('twKScheme').value; K.n = +$('twKN').value; K.syl = Math.max(4, Math.min(16, Math.round(+$('twKSyl').value) || 8)); K.seed = K.lines ? K.seed + 1 : K.seed; K.lines = kitDraft(K.theme, K.scheme, K.n, K.syl, K.seed); K.pick = null; paneKit(); return; }
    if (a === 'k-word') { const K = ST.kit, li = +b.dataset.li, wi = +b.dataset.wi; K.pick = K.pick && K.pick.li === li && K.pick.wi === wi ? null : { li, wi }; kitShow(); return; }
    if (a === 'k-alt') { const K = ST.kit; K.lines[K.pick.li].t = replaceWord(K.lines[K.pick.li].t, K.pick.wi, b.dataset.w); K.pick = null; kitShow(); return; }
    if (a === 'k-more') { loadList().then(kitAltsShow).catch(() => status('Die Wortliste konnte nicht geladen werden – bitte einmal mit Internet öffnen.')); return; }
    if (a === 'k-rep' || a === 'k-app') {
      const K = ST.kit, sl = slots()[+$('twKTo').value]; if (!sl || !K.lines) return;
      const old = String((sl.p.lyrics || [])[sl.n] || '').replace(/\s+$/, ''), draft = K.lines.map(l => l.t).join('\n');
      const text = a === 'k-app' && old.trim() ? old + '\n' + draft : draft;
      A.pushVersion(applyTexts(A.ver(), [{ p: sl.p, n: sl.n, text }]), ('Baukasten ' + KIT[K.theme].n + ' → ' + slotName(sl)).slice(0, 70)); A.render();
      status('Gerüst in „' + slotName(sl) + '“ ' + (a === 'k-app' ? 'angehängt' : 'eingesetzt') + ' – neue Version V' + A.ver().n + '. Mit „Version“ kommst du zurück.');
      return;
    }
    if (a === 'p-copy') { const t = promptNow(); W.__lastPrompt = t; status(await A.copyText(t) ? 'Prompt kopiert – jetzt in einen Chat mit Claude einfügen und senden.' : 'Kopieren ging nicht – nutze „Teilen …“ oder „Prompt ansehen“.'); return; }
    if (a === 'p-share') { const t = promptNow(); W.__lastPrompt = t; try { await navigator.share({ text: t, title: (A.song() || { name: 'Song' }).name }); } catch (err) {} return; }
    if (a === 'p-view') { const t = promptNow(), ta = $('twPView'); W.__lastPrompt = t; ta.value = t; ta.hidden = !ta.hidden; return; }
    if (a === 'p-clip') {
      try { const t = await navigator.clipboard.readText(); if (!t) { status('Die Zwischenablage ist leer.'); return; } $('ldPaste').value = t; A.readCode(); $('ldImRes').scrollIntoView({ block: 'nearest' }); }
      catch (err) { status('Kein Zugriff auf die Zwischenablage – unten bei „Mit Claude weiterarbeiten“ lange ins Feld tippen, „Einsetzen“ und „Einlesen“.'); $('ldPaste').focus(); }
      return;
    }
    if (a === 'p-goto') { $('ldPaste').scrollIntoView({ block: 'center' }); $('ldPaste').focus(); return; }
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset && t.dataset.sec) { const s = ST.secSet[t.dataset.sec] = ST.secSet[t.dataset.sec] || {}; s[t.dataset.k] = t.value; if (ST.akShown) akkShow(); return; }
    if (t.id && t.id.startsWith('twP')) readPromptForm();
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === 'twMood') ST.moodText = t.value;
    if (t.id === 'twWord') ST.word = t.value;
    if (t.id && t.id.startsWith('twP') && t.id !== 'twPView') readPromptForm();
  }
  if (W.document) document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'twWord') { ST.word = e.target.value; findWords(); } if (e.key === 'Enter' && e.target && e.target.id === 'twMood') { e.preventDefault(); const b = root && root.querySelector('[data-a=m-parse]'); if (b) b.click(); } });

  // ---------- Einlesen bei „Mit Claude weiterarbeiten“ (kein Song-Code) ----------
  let pend = null;
  function readOther(text, box) {
    const A = LA(), v = A.ver(); if (!v) return false;
    const lab = X.labels(v), lr = parseLines(text);
    if (lr) {
      let tgt = null;
      const byLab = {}; v.parts.forEach(p => { byLab[lab[p.id].toLowerCase()] = p; });
      const p0 = byLab[(lr.part || '').toLowerCase()] || (ST.lastLine && C.partById(v, ST.lastLine.pid)) || (ST.sel && C.partById(v, ST.sel.pid));
      if (p0) {
        const n0 = lr.part && byLab[lr.part.toLowerCase()] ? lr.n : (ST.lastLine || ST.sel).n, L = String((p0.lyrics || [])[n0] || '').split('\n');
        let i0 = L.findIndex(x => X.stripChords(x).trim() && X.stripChords(x).trim() === lr.line.trim());
        if (i0 < 0 && ST.lastLine && ST.lastLine.pid === p0.id) i0 = ST.lastLine.i;
        if (i0 >= 0) tgt = { pid: p0.id, n: n0, i: i0, old: X.stripChords(L[i0]).trim() };
      }
      pend = { kind: 'lines', tgt, alts: lr.alts };
      box.innerHTML = '<h3>Zeilen-Vorschläge von Claude</h3>' + (tgt ? '<p class="note">Für „' + esc(lab[tgt.pid] || '') + '“, Zeile „' + esc(tgt.old) + '“ – antippen übernimmt als neue Version (Akkordmarken bleiben).</p>' : '<p class="note">Die Zeile wurde im Song nicht gefunden – unter „Text-Werkstatt“ › „Reime prüfen“ die Zeile antippen und nochmal „Einlesen“.</p>')
        + '<ul class="tw-alts2">' + lr.alts.map((x, i) => '<li><span>' + esc(x) + ' <small>(' + X.syllables(x, 'de') + ' Silben)</small></span>' + (tgt ? '<button class="toggle-btn" data-tw-take="' + i + '">Diese nehmen</button>' : '') + '</li>').join('') + '</ul>'
        + '<div class="ld-vact"><button class="toggle-btn" data-tw-drop="1">Verwerfen</button></div>';
      return true;
    }
    const bl = parseFree(text, v); if (!bl.length || bl.reduce((n, b0) => n + b0.text.split('\n').filter(x => x.trim()).length, 0) < 2) return false;
    const sl = A.textSlots(v), selIdx = ST.sel ? sl.findIndex(x => x.p.id === ST.sel.pid && x.n === ST.sel.n) : -1;
    const items = bl.map(b0 => { let k = -1; if (b0.target && b0.target.p) k = sl.findIndex(x => x.p.id === b0.target.p.id && x.n === b0.target.n); if (k < 0 && b0.target && b0.target.p) k = sl.findIndex(x => x.p.id === b0.target.p.id); return { head: b0.head, text: b0.text, k, missing: b0.target && b0.target.missing }; });
    if (items.length === 1 && items[0].k < 0) items[0].k = selIdx >= 0 ? selIdx : 0;
    pend = { kind: 'free', items };
    box.innerHTML = '<h3>Textvorschlag (freier Text)</h3><p class="note">Kein Song-Code gefunden – der Text wird als Vorschlag gelesen. Ziel je Abschnitt prüfen, dann als neue Version übernehmen.</p>'
      + items.map((it, j) => '<div class="tw-imp"><label class="field"><span>' + esc(it.head || 'Text') + (it.missing ? ' (Teil fehlt im Song)' : '') + ' →</span><select data-tw-to="' + j + '"><option value="-1">nicht übernehmen</option>' + sl.map((x, i) => '<option value="' + i + '"' + (i === it.k ? ' selected' : '') + '>' + esc(slotName(x)) + '</option>').join('') + '</select></label><pre translate="no">' + esc(it.text) + '</pre></div>').join('')
      + '<div class="ld-vact"><button class="toggle-btn active" data-tw-free="1">Als neue Version übernehmen</button><button class="toggle-btn" data-tw-drop="1">Verwerfen</button></div>';
    return true;
  }
  if (W.document) document.addEventListener('click', e => {
    const b = e.target.closest('[data-tw-take],[data-tw-drop],[data-tw-free]'); if (!b || !pend) return; const A = LA(), box = $('ldImRes');
    if (b.dataset.twDrop) { pend = null; box.innerHTML = ''; $('ldPaste').value = ''; return; }
    if (b.dataset.twTake != null && pend.kind === 'lines' && pend.tgt) {
      const t = pend.tgt, nt = pend.alts[+b.dataset.twTake];
      if (setLine(t.pid, t.n, t.i, nt, 'Claude: Zeile „' + t.old.slice(0, 40) + '“ neu')) status('Zeile übernommen – neue Version V' + A.ver().n + '. Mit „Version“ kommst du zurück.');
      pend = null; box.innerHTML = ''; $('ldPaste').value = ''; if (ST.sel) ST.sel = null; refresh(); return;
    }
    if (b.dataset.twFree && pend.kind === 'free') {
      const sl = A.textSlots(A.ver()), it = [];
      box.querySelectorAll('[data-tw-to]').forEach(sel => { const k = +sel.value, x = pend.items[+sel.dataset.twTo]; if (k >= 0 && sl[k]) it.push({ p: sl[k].p, n: sl[k].n, text: x.text }); });
      if (!it.length) { status('Nichts ausgewählt.'); return; }
      A.pushVersion(applyTexts(A.ver(), it), 'Claude: Textvorschlag (' + it.length + (it.length === 1 ? ' Abschnitt)' : ' Abschnitte)')); A.render();
      status('Text übernommen – neue Version V' + A.ver().n + '. Mit „Version“ kommst du zurück.');
      pend = null; box.innerHTML = ''; $('ldPaste').value = ''; return;
    }
  });
  Object.assign(API, { open, refresh, readOther, _st: () => ST, keepChords });
})();
