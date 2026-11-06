// v130: Werkzeuge zum Kurs – Akkordsymbole lesen (mit Slash-Akkorden), Begriffslexikon (aus dem Text antippbar),
// Landkarte „Was benutze ich wann“, Tonleitern/Tonarten/Stufenakkorde (Dur, Moll, harmonisch Moll, dorisch, lydisch).
// Notenkarte (alle Tonnamen) schaltet window.__pcNotes für jedes Griffbrett im Reiter. Alles erst beim Öffnen gebaut.
(function () {
  const md = x => ((x % 12) + 12) % 12;
  const L0 = s => (window.__lang === 'en' && window.__EN_PCW && window.__EN_PCW[s]) || s;
  const NPC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
  const fam = n => { n = md(n); return n === 0 ? 'f1' : n === 7 ? 'f5' : n === 3 || n === 4 ? 'f3' : n === 5 ? 'f4' : n === 10 || n === 11 ? 'f7' : 'fx'; };
  // ---------- Akkordsymbole ----------
  const LABX = { 0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'b7', 11: '7', 13: 'b9', 14: '9', 15: '#9', 17: '11', 18: '#11', 20: 'b13', 21: '13' };
  const SYM = [   // [Endung(en), Halbtöne, Erklärung]  – längste zuerst prüfen
    [['maj7(9)', 'maj9', 'Δ9'], [0, 4, 7, 11, 14], 'Major 7 mit 9 (Kap. 11)'],
    [['maj7#11', 'maj7(#11)'], [0, 4, 7, 11, 18], 'Major 7 mit #11 – passt auf die 4. Stufe (Kap. 10/14)'],
    [['m7(9)', 'm9', '-9'], [0, 3, 7, 10, 14], 'Moll 7 mit 9 (Kap. 11)'],
    [['m7(11)', 'm11', '-11'], [0, 3, 7, 10, 17], 'Moll 7 mit 11 (Kap. 6)'],
    [['m7b5', 'ø7', 'ø', 'm7(b5)', '-7b5'], [0, 3, 6, 10], 'halbvermindert: Moll mit b5 und kleiner 7 (Kap. 5/7)'],
    [['m(maj7)', 'mmaj7', 'mΔ7', '-maj7'], [0, 3, 7, 11], 'Moll mit großer 7 (Kap. 7)'],
    [['m(add9)', 'madd9'], [0, 3, 7, 14], 'Moll mit 9 dazu, ohne 7 (Kap. 6)'],
    [['m(add11)', 'madd11'], [0, 3, 7, 17], 'Moll mit 11 dazu (Kap. 6)'],
    [['7sus2'], [0, 2, 7, 10], 'kleine 7, statt der Terz die 2 (Kap. 11)'],
    [['7sus4'], [0, 5, 7, 10], 'kleine 7, statt der Terz die 4'],
    [['7(9)', '9'], [0, 4, 7, 10, 14], 'Dur mit kleiner 7 und 9 (Kap. 11)'],
    [['7b9', '7(b9)'], [0, 4, 7, 10, 13], 'Dominante mit b9 – zieht auf Moll (Kap. 11)'],
    [['7#9', '7(#9)'], [0, 4, 7, 10, 15], 'Dominante mit #9 – der Hendrix-Akkord (Kap. 11)'],
    [['7b5', '7(b5)'], [0, 4, 6, 10], 'alterierte Dominante: Quinte tiefer (Kap. 11)'],
    [['7#5', '7(#5)', '+7', 'aug7'], [0, 4, 8, 10], 'alterierte Dominante: Quinte höher (Kap. 11)'],
    [['13'], [0, 4, 7, 10, 21], 'kleine 7 plus 6 = 13 (Kap. 11: „Akkordtöne haben Vorrang“)'],
    [['m13'], [0, 3, 7, 10, 21], 'Moll 7 plus 6 = 13 (Kap. 11)'],
    [['11'], [0, 7, 10, 14, 17], '7 mit 9 und 11 – meist ohne Terz gegriffen'],
    [['6/9', '69'], [0, 4, 7, 9, 14], 'Dur mit 6 und 9, ohne 7'],
    [['maj7', 'M7', 'Δ7', 'Δ', 'j7'], [0, 4, 7, 11], 'Major 7 = große 7 (Kap. 3/7: „7 und Major 7 – echt kaputt“)'],
    [['m7', '-7', 'mi7', 'min7'], [0, 3, 7, 10], 'Moll 7 (Kap. 7)'],
    [['dim7', '°7', 'o7'], [0, 3, 6, 9], 'vollvermindert: nur kleine Terzen (Kap. 5/7)'],
    [['dim', '°', 'o', 'm(b5)', 'mb5'], [0, 3, 6], 'vermindert: Moll mit b5 (Kap. 5)'],
    [['aug', '+', '#5'], [0, 4, 8], 'übermäßig: Dur mit #5'],
    [['add9', '(add9)'], [0, 4, 7, 14], 'Dur mit 9 dazu, ohne 7 (Kap. 6)'],
    [['add11', '(add11)'], [0, 4, 7, 17], 'Dur mit 11 dazu (Kap. 6)'],
    [['sus2'], [0, 2, 7], 'statt der Terz die 2 (Kap. 6)'],
    [['sus4', 'sus'], [0, 5, 7], 'statt der Terz die 4 – „sus“ allein meint meist Sus4 (Kap. 6)'],
    [['m6', '-6'], [0, 3, 7, 9], 'Moll mit 6 („dorisch“, Kap. 11)'],
    [['6'], [0, 4, 7, 9], 'Dur mit 6, ohne 7 (Kap. 11)'],
    [['7'], [0, 4, 7, 10], 'nur „7“ = kleine 7: Dominant 7 (Kap. 3/7)'],
    [['5'], [0, 7], 'Powerchord: 1-5(-8), ohne Terz (Kap. 2)'],
    [['m', '-', 'mi', 'min'], [0, 3, 7], 'Moll: kleine Terz (Kap. 4)'],
    [[''], [0, 4, 7], 'Dur: große Terz (Kap. 4)']
  ];
  const ENDS = []; SYM.forEach(([e, iv, t]) => e.forEach(x => ENDS.push([x, iv, t]))); ENDS.sort((a, b) => b[0].length - a[0].length);
  function parse(sym) {
    const s = String(sym || '').trim().replace(/\s+/g, ''); const m = /^([A-H])(#|b|is|es)?(.*)$/.exec(s); if (!m) return null;
    let rp = md(NPC[m[1]] + (m[2] === '#' || m[2] === 'is' ? 1 : m[2] === 'b' || m[2] === 'es' ? -1 : 0)); let rest = m[3], bass = null;
    const sl = /\/([A-H])(#|b|is|es)?$/.exec(rest); if (sl) { bass = md(NPC[sl[1]] + (sl[2] === '#' || sl[2] === 'is' ? 1 : sl[2] ? -1 : 0)); rest = rest.slice(0, sl.index); }
    const hit = ENDS.find(([e]) => e === rest); if (!hit) return null;
    const rn = window.PcWerk ? PcWerk.rootName(rp) : 'C', name = (m[1] === 'H' ? 'B' : m[1]) + (m[2] === '#' || m[2] === 'is' ? '#' : m[2] ? 'b' : '');
    const sharpen = x => (x.endsWith('b') ? x.slice(0, -1) : x + '#'), sp = n => (n === 15 ? PcWerk.spell(name, 3) : n === 18 ? sharpen(PcWerk.spell(name, 5)) : n === 8 && hit[1].includes(4) ? sharpen(PcWerk.spell(name, 7)) : PcWerk.spell(name, md(n) === 0 && n ? 12 : md(n)));
    const notes = hit[1].map(n => ({ n, lab: LABX[n], ton: window.PcWerk ? sp(n) : '' }));
    return { root: rp, rn: name, iv: hit[1], notes, txt: hit[2], bass, bassName: bass == null ? null : (window.PcWerk ? PcWerk.rootName(bass) : ''), pcs: [...new Set(hit[1].map(n => md(rp + n)).concat(bass == null ? [] : [bass]))].sort((a, b) => a - b) };
  }
  // ---------- Lexikon ----------
  const GL = [
    ['Powerchord', 'Grundton, Quinte und meist die Oktave (1-5-8), ohne Terz – weder Dur noch Moll.', 2],
    ['Intervall', 'Abstand zweier Töne, gezählt als Zahl (1 bis 8, darüber 9, 11, 13).', 3],
    ['Terz', 'Der Ton, der Dur (große Terz, 4 Halbtöne) oder Moll (kleine Terz, 3 Halbtöne) bestimmt.', 3],
    ['Quinte', 'Der fünfte Ton, 7 Halbtöne über dem Grundton. „Die unwichtigste“ – sie füllt nur.', 2],
    ['Tritonus', 'Der Ton zwischen 4 und 5 (b5, #4, #11) – beim Lehrer „Bart Simpson“.', 3],
    ['Oktave', 'Derselbe Ton zwölf Halbtöne höher: die 8 ist die 1.', 2],
    ['Stammton', 'Ein Ton ohne Vorzeichen: A B C D E F G.', 2],
    ['Voicing', 'Wie die Töne eines Akkords verteilt und gegriffen werden (welche Saite, welche Oktave).', 8],
    ['Closed Voicing', 'Alle Akkordtöne liegen innerhalb einer Oktave – auf der Gitarre oft schwer zu greifen.', 8],
    ['Drop 2', 'Aus dem Closed Voicing wird die zweite Note von oben eine Oktave tiefer gelegt.', 8],
    ['Drop 3', 'Aus dem Closed Voicing wird die dritte Note von oben eine Oktave tiefer gelegt.', 8],
    ['Umkehrung', 'Ein anderer Akkordton als der Grundton liegt unten; jeder Ton „geht einen höher“.', 8],
    ['Stimmführung', 'Wohin jeder einzelne Ton beim Akkordwechsel geht – möglichst kleine Schritte.', 8],
    ['Dreiklang', 'Drei Töne eines Akkords: 1-3-5 oder eine Umkehrung davon.', 9],
    ['Arpeggio', 'Die Akkordtöne nacheinander gespielt statt zusammen.', 12],
    ['Barré', 'Der Zeigefinger liegt über mehrere Saiten – wie ein Kapodaster.', 4],
    ['CAGED', 'Die fünf offenen Grundgriffe C, A, G, E, D, die man über das Griffbrett verschiebt.', 4],
    ['Stufe', 'Position eines Akkords in der Tonart (1 bis 7, oft römisch I–VII).', 5],
    ['Stufenakkord', 'Akkord, der aus den Tönen der Tonleiter auf einer Stufe entsteht.', 5],
    ['diatonisch', 'Nur mit den Tönen der Tonart (ohne fremde Töne).', 5],
    ['Tonika', 'Die 1. Stufe – „zu Hause“.', 5],
    ['Subdominante', 'Die 4. Stufe – schwebend.', 5],
    ['Dominante', 'Die 5. Stufe – instabil, will zurück zur 1.', 5],
    ['Leitton', 'Ein Ton einen Halbton unter dem Ziel (in C-Dur das B) – zieht stark.', 5],
    ['Kadenz', 'Folge stabil → schwebend → instabil → stabil, z. B. I-IV-V-I.', 5],
    ['Parallele', 'Moll-Akkord, der mit einem Dur-Akkord zwei Töne teilt (6 zu 1, 2 zu 4, 3 zu 5).', 5],
    ['Sekundärdominante', 'Eine „ausgeliehene“ Dominante, die auf einen anderen Akkord als die 1 zieht.', 5],
    ['Upper Structure', 'Ein Dreiklang, der im oberen Teil eines größeren Akkords steckt (z. B. C-Dur in Am7).', 5],
    ['Sus', '„suspended“: keine Terz, dafür die 2 (Sus2) oder die 4 (Sus4).', 6],
    ['add', 'Ton „dazu“ bei einem Akkord mit Terz: add9, add11.', 6],
    ['Extension', 'Zusatzton über der Oktave: 9, 11, 13.', 6],
    ['Ear Candy', '„Süßigkeit fürs Ohr“: kleiner, schöner Zusatzton oder -part.', 10],
    ['Major 7', 'Große Septime – einen Halbton unter der 8.', 7],
    ['Dominant 7', 'Dur-Akkord mit kleiner 7 – im Symbol nur „7“.', 7],
    ['halbvermindert', 'Moll mit b5 und kleiner 7 (m7b5).', 7],
    ['vollvermindert', 'Nur kleine Terzen übereinander (°7).', 7],
    ['alteriert', 'Bei der Dominante „schiebe ich da Zeugs um“: b9, #9, b5, #5.', 11],
    ['Slash-Akkord', 'Akkord mit anderem Basston, z. B. D/F# = „D über Fis“.', 14],
    ['harmonisch Moll', 'Moll-Tonleiter mit großer 7 – ihre 5. Stufe ist eine Dominante mit b9.', 11],
    ['dorisch', 'Moll mit großer 6 – Am6 klingt „dorisch“.', 11],
    ['lydisch', 'Dur mit #4 (#11) – der Klang der 4. Stufe.', 10],
    ['Modal Interchange', 'Akkorde aus einer verwandten Tonart (z. B. Moll) ausleihen.', 11],
    ['Akkordteppich', 'Begleitung aus gleichmäßig weiterlaufenden Akkordtönen, z. B. Arpeggio mit Delay.', 13],
    ['Hybrid Picking', 'Plektrum plus Finger der Anschlagshand (z. B. Mittelfinger) gleichzeitig.', 13],
    ['Sweeping', 'Plektrum in einer Bewegung über mehrere Saiten ziehen.', 12],
    ['Pull-Off', 'Ton durch Abziehen des Fingers klingen lassen.', 12],
    ['Palm Mute', 'Handballen am Steg dämpft die Saiten.', 2],
    ['Drop D', 'Tiefe E-Saite einen Ganzton tiefer auf D gestimmt.', 15],
    ['Low Interval Limits', 'Tiefe kleine Intervalle (z. B. kleine Terz ganz unten) klingen matschig.', 4]
  ];
  const glossFind = t => GL.find(g => g[0].toLowerCase() === String(t).toLowerCase());
  function wrapTerms(root) {                                // erstes Vorkommen je Absatz antippbar machen (nur Lehrtext)
    const terms = GL.map(g => g[0]).sort((a, b) => b.length - a.length), rx = new RegExp('(^|[^\\wäöüÄÖÜß])(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?=$|[^\\wäöüÄÖÜß])', 'i');
    root.querySelectorAll('.pc-kbody li, .pc-kbody p').forEach(li => { if (li._gl) return; li._gl = true;
      const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT); let n, done = 0; const nodes = []; while ((n = w.nextNode())) nodes.push(n);
      nodes.forEach(t => { if (done >= 2 || t.parentNode.closest('.pc-gl')) return; const m = rx.exec(t.data); if (!m) return; const i = m.index + m[1].length, term = m[2], g = glossFind(term); if (!g) return;
        const after = t.splitText(i), rest = after.splitText(term.length), sp = document.createElement('span'); sp.className = 'pc-gl'; sp.setAttribute('role', 'button'); sp.tabIndex = 0; sp.dataset.gl = g[0]; sp.textContent = after.data; after.replaceWith(sp); done++; }); });
  }
  // ---------- Tonleitern ----------
  const SCALES = [
    ['Dur (ionisch)', [0, 2, 4, 5, 7, 9, 11], '2-2-1-2-2-2-1 – die Grundlage des Kurses (Kap. 5).', false],
    ['natürliches Moll (äolisch)', [0, 2, 3, 5, 7, 8, 10], 'Die Dur-Tonleiter ab der 6. Stufe (Parallele, Kap. 5).', true],
    ['harmonisch Moll', [0, 2, 3, 5, 7, 8, 11], 'Moll mit großer 7 – auf der 5. Stufe entsteht die Dominante mit b9 (Kap. 11).', true],
    ['dorisch', [0, 2, 3, 5, 7, 9, 10], 'Moll mit großer 6 – der Klang von Am6 (Kap. 11).', true],
    ['lydisch', [0, 2, 4, 6, 7, 9, 11], 'Dur mit #4 (#11) – der Klang der 4. Stufe (Kap. 10/14).', true]
  ];
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'], KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'];
  function degreeChords(keyName, sc) {
    const kp = NPC[keyName[0]] + (keyName[1] === 'b' ? -1 : keyName[1] === '#' ? 1 : 0);
    return sc.map((_, i) => { const r = sc[i], t3 = md(sc[(i + 2) % 7] - r), t5 = md(sc[(i + 4) % 7] - r), t7 = md(sc[(i + 6) % 7] - r);
      const q = t3 === 4 && t5 === 7 ? '' : t3 === 3 && t5 === 7 ? 'm' : t3 === 3 && t5 === 6 ? 'm(b5)' : t3 === 4 && t5 === 8 ? '+' : '?';
      const q7 = t3 === 4 && t5 === 7 ? (t7 === 11 ? 'maj7' : '7') : t3 === 3 && t5 === 7 ? (t7 === 10 ? 'm7' : 'm(maj7)') : t3 === 3 && t5 === 6 ? (t7 === 10 ? 'm7b5' : '°7') : t3 === 4 && t5 === 8 ? '+maj7' : '?';
      const rn = window.PcWerk ? PcWerk.spell(keyName, r === 0 ? 0 : r) : ''; return { deg: ROM[i], rn, tri: rn + q, sev: rn + q7 }; });
  }
  // ---------- Landkarte ----------
  const MAP = [
    ['Rock & Metal – Riffs', [[2, 'Powerchord 1-5-8'], [14, 'Dur-Powerchord, Terz im Bass'], [15, 'Drop D, tiefere Stimmung'], [6, 'Sus2 über Powerchord']]],
    ['Pop & Singer-Songwriter', [[9, 'Dreiklänge, kleine Schritte'], [10, 'Ear Candy: 9, 11, Major 7'], [6, 'Sus und add9'], [4, 'CAGED-Griffe']]],
    ['Jazz & Begleitung', [[7, '7er-Akkorde'], [8, 'Drop 2 / Drop 3, Stimmführung'], [11, '7(9), b9, #9'], [5, 'Funktionen: 2-5-1']]],
    ['Blues', [[7, 'Dominant 7 überall'], [11, '#9: Mollterz → Durterz']]],
    ['Solo & Melodie', [[3, 'Intervalle sehen'], [12, 'Dreiklangs-Arpeggios'], [13, 'Septakkord-Arpeggios, Teppich mit Delay']]],
    ['Songs verstehen & schreiben', [[5, 'Stufen und Ersatzakkorde'], [10, 'Was passt auf welche Stufe'], [1, 'Zahlen statt Griffbilder']]]
  ];
  let A = null, host = null;
  function card(id, title, sub) { return '<details class="card pc-sec pc-ktool" id="' + id + '"><summary><h3>' + title + '</h3></summary><p class="caption pc-ktsub" translate="no">' + sub + '</p><div class="pc-sec-b"></div></details>'; }
  function build(h, api) {
    if (host) return; host = h; A = api;
    const box = document.createElement('div'); box.className = 'pc-ktools';
    box.innerHTML = '<div class="pc-row pc-ktoolbar">' + [['pcKT1', 'Akkordsymbole lesen'], ['pcKT2', 'Begriffe (Lexikon)'], ['pcKT3', 'Landkarte: Was benutze ich wann?'], ['pcKT4', 'Tonleitern & Tonarten']].map(([id, t]) => '<button class="toggle-btn" data-ktool="' + id + '">' + L0(t) + '</button>').join('') + '</div>' +
      card('pcKT1', L0('Akkordsymbole lesen'), 'Was bedeuten die Zeichen hinter dem Grundton? Tippe ein Symbol ein oder wähle eines aus der Tabelle.') +
      card('pcKT2', L0('Begriffe (Lexikon)'), 'Fachwörter aus dem Kurs. Im Kurstext sind sie gepunktet unterstrichen – antippen zeigt die Erklärung.') +
      card('pcKT3', L0('Landkarte: Was benutze ich wann?'), '(ergänzt) Übersicht, welches Kapitel für welche Musik am meisten bringt. Kapitel antippen öffnet es.') +
      card('pcKT4', L0('Tonleitern & Tonarten'), 'So viel Tonleiter, wie der Kurs braucht: Dur und seine Stufenakkorde, dazu Moll, harmonisch Moll, dorisch und lydisch.');
    const anchor = h.querySelector('.pc-khome'); anchor.after(box);
    box.querySelectorAll('details.pc-ktool').forEach(d => d.addEventListener('toggle', () => { if (d.open) fill(d); }));
    h.addEventListener('click', onClick);
    const gp = document.createElement('div'); gp.className = 'card pc-glpop'; gp.id = 'pcGlPop'; gp.hidden = true; document.body.appendChild(gp); gp.addEventListener('click', onClick);   // fest unten im Bild (nicht im Reiter-Container)
    new MutationObserver(() => wrapTerms(h)).observe(h, { childList: true, subtree: true }); wrapTerms(h);
  }
  function fill(d) {
    if (d._f) return; d._f = true; const b = d.querySelector('.pc-sec-b');
    if (d.id === 'pcKT1') {
      b.innerHTML = '<div class="pc-row"><input class="pc-symin" id="pcSymIn" type="text" value="D/F#" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Akkordsymbol"><button class="toggle-btn active" data-sym="go">' + L0('Erklären') + '</button><button class="toggle-btn" data-sym="play">' + PcSkin.btn(L0('▶ Anhören')) + '</button></div><div class="pc-symout" translate="no"></div>' +
        '<div class="pc-tbl"><table class="pc-symtab" translate="no"><thead><tr><th>Symbol (Beispiel C)</th><th>Formel</th><th>Bedeutung</th></tr></thead><tbody>' +
        SYM.map(([e, iv, t]) => '<tr data-sym="C' + e[0] + '"><td><b>C' + e.join(' · C') + '</b></td><td>' + iv.map(n => LABX[n]).join(' · ') + '</td><td>' + t + '</td></tr>').join('') +
        '<tr data-sym="D/F#"><td><b>D/F#</b></td><td>Akkord / Basston</td><td>Slash-Akkord: „D über Fis“ – die Terz im Bass (Kap. 14). Hinter dem Schrägstrich steht immer der tiefste Ton.</td></tr></tbody></table></div>';
      symShow();
    }
    if (d.id === 'pcKT2') b.innerHTML = '<div class="pc-glist" translate="no">' + GL.slice().sort((x, y) => x[0].localeCompare(y[0], 'de')).map(([t, x, k]) => '<div class="pc-gli"><b>' + t + '</b> – ' + x + ' <button class="toggle-btn pc-kref" data-kref="' + k + '">' + PcSkin.btn('→ ') + 'Kapitel ' + k + '</button></div>').join('') + '</div>';
    if (d.id === 'pcKT3') b.innerHTML = '<div class="pc-map" translate="no">' + MAP.map(([t, items]) => '<div class="pc-mapc"><h4>' + t + '</h4>' + items.map(([k, x]) => '<button class="toggle-btn pc-kref pc-mapi" data-kref="' + k + '"><b>' + k + '</b><span>' + x + '</span></button>').join('') + '</div>').join('') + '</div>' +
      '<p class="pc-kmerk" translate="no">„Vom Jazz zu Metal über Shreddy-Arpeggios-Zeug, geile Pop-Dreiklänge … ihr habt hier jetzt alles gelernt.“</p><p class="caption" translate="no">Weg durch den Kurs: Powerchord (2) → Intervalle (3) → CAGED (4) → Funktionen (5) → Sus/Add (6) → 7er (7) → Drop 2/3 (8) → Dreiklänge (9) → Ear Candy (10) → 7/9 (11) → Arpeggios (12, 13) → Dur-Powerchord (14) → Drop D (15).</p>';
    if (d.id === 'pcKT4') {
      b.innerHTML = '<div class="pc-row"><div class="seg pc-seg" id="pcScSel">' + SCALES.map((s, i) => '<button class="toggle-btn' + (i ? '' : ' active') + '" data-sc="' + i + '">' + s[0] + '</button>').join('') + '</div></div>' +
        '<div class="pc-scinfo" translate="no"></div><div class="pc-bwrap pc-scb"></div><div class="pc-row"><button class="toggle-btn" data-scplay="1">' + PcSkin.btn(L0('▶ Nacheinander')) + '</button></div>' +
        '<h4>' + L0('Stufenakkorde einer Dur-Tonart') + '</h4><div class="pc-row"><div class="seg pc-seg" id="pcKeySel">' + KEYS.map((k, i) => '<button class="toggle-btn' + (i ? '' : ' active') + '" data-key="' + k + '">' + k + '</button>').join('') + '</div></div><div class="pc-tbl pc-degtab" translate="no"></div>' +
        '<p class="caption" translate="no">Tonart = Grundton + Tonleiter. Merkhilfe des Lehrers (Kap. 10): Zwei Dur-Akkorde nebeneinander gibt es nur auf der 4 und 5. (ergänzt: Moll-, harmonisch-Moll-, dorische und lydische Tonleiter als Übersicht)</p>';
      scShow(0); keyShow('C');
    }
  }
  let SC = 0, KEY = 'C';
  function scShow(i) {
    SC = i; const [n, iv, t, own] = SCALES[i], b = host.querySelector('#pcKT4'); b.querySelectorAll('[data-sc]').forEach(x => x.classList.toggle('active', +x.dataset.sc === i));
    b.querySelector('.pc-scinfo').innerHTML = '<p><b>' + n + '</b> (ab A): ' + iv.map(x => (x === 6 && !iv.includes(5) ? '#4' : LABX[x])).join(' · ') + ' · ' + iv.map(x => (x === 6 && !iv.includes(5) ? 'D#' : PcWerk.spell('A', x))).join(' ') + '</p><p class="caption">' + (own ? '(ergänzt) ' : '') + t + '</p>';
    const marks = iv.concat([12]).map(N => { const p = N ? PcWerk.posBox(0, 5, N) : { s: 0, f: 5 }; return { s: p.s, f: p.f, lab: N === 12 ? '8' : N === 6 && !iv.includes(5) ? '#4' : LABX[N], cls: fam(N) + (N === 0 ? ' root' : '') }; });
    A.board(b.querySelector('.pc-scb'), { marks, from: 3, to: 15, tap: (s, f) => A.playMidi([40, 45, 50, 55, 59, 64][s] + f) });
  }
  function keyShow(k) {
    KEY = k; const b = host.querySelector('#pcKT4'); b.querySelectorAll('[data-key]').forEach(x => x.classList.toggle('active', x.dataset.key === k));
    const rows = degreeChords(k, SCALES[0][1]);
    b.querySelector('.pc-degtab').innerHTML = '<table><thead><tr><th>Stufe</th>' + rows.map(r => '<th>' + r.deg + '</th>').join('') + '</tr></thead><tbody><tr><td>Dreiklang</td>' + rows.map(r => '<td>' + r.tri + '</td>').join('') + '</tr><tr><td>Septakkord</td>' + rows.map(r => '<td>' + r.sev + '</td>').join('') + '</tr></tbody></table>';
  }
  function symShow() {
    const inp = host.querySelector('#pcSymIn'), out = host.querySelector('.pc-symout'); if (!inp) return; const r = parse(inp.value);
    if (!r) { out.innerHTML = '<p class="pc-wfb no">Unbekanntes Symbol. Beispiele: Cmaj7, Am7b5, E7#9, D/F#, Gsus4, Bb6.</p>'; return; }
    out.innerHTML = '<p class="pc-wline"><b>' + inp.value.trim() + '</b></p><p>' + r.txt + (r.bass != null ? ' · Basston: <b>' + r.bassName + '</b> (Slash-Akkord: „' + r.rn + ' über ' + r.bassName + '“)' : '') + '</p>' +
      '<div class="pc-ltones">' + r.notes.map(x => '<span class="pc-ltone ' + fam(x.n) + '"><b>' + x.ton + '</b><small>' + x.lab + '</small></span>').join('') + '</div>';
  }
  function symPlay() { const r = parse(host.querySelector('#pcSymIn').value); if (!r) return; const ms = r.iv.map(n => 48 + r.root + n); if (r.bass != null) ms.unshift(36 + r.bass); A.strumNow(ms); }
  function glShow(t, el) {
    const g = glossFind(t), p = document.getElementById('pcGlPop'); if (!g) return;
    p.innerHTML = '<div class="pc-row"><b>' + g[0] + '</b><button class="toggle-btn" data-glx="1" aria-label="Schließen">✕</button></div><p translate="no">' + g[1] + '</p><button class="toggle-btn pc-kref" data-kref="' + g[2] + '">' + PcSkin.btn('→ ') + 'Kapitel ' + g[2] + '</button>';
    p.hidden = false;
  }
  function onClick(e) {
    const t = e.target.closest('[data-ktool]'); if (t) { const d = host.querySelector('#' + t.dataset.ktool); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const gl = e.target.closest('.pc-gl'); if (gl) { glShow(gl.dataset.gl, gl); return; }
    if (e.target.closest('[data-glx]') || e.target.closest('#pcGlPop .pc-kref')) { document.getElementById('pcGlPop').hidden = true; const r = e.target.closest('#pcGlPop .pc-kref'); if (r) PcKurs.open(+r.dataset.kref); return; }
    const sy = e.target.closest('[data-sym]');
    if (sy) { if (sy.tagName === 'TR') { host.querySelector('#pcSymIn').value = sy.dataset.sym; symShow(); symPlay(); } else if (sy.dataset.sym === 'go') symShow(); else symPlay(); return; }
    const sc = e.target.closest('[data-sc]'); if (sc) { scShow(+sc.dataset.sc); return; }
    if (e.target.closest('[data-scplay]')) { const iv = SCALES[SC][1].concat([12]); A.seqNow(iv.map(n => 45 + n)); return; }
    const k = e.target.closest('[data-key]'); if (k) { keyShow(k.dataset.key); return; }
  }
  document.addEventListener('tabchange', () => { const p = document.getElementById('pcGlPop'); if (p) p.hidden = true; });
  window.PcExtra = { build, parse, GL, degreeChords, SCALES, wrapTerms, sym: v => { const i = host && host.querySelector('#pcSymIn'); if (i) { i.value = v; symShow(); } return parse(v); } };
})();
