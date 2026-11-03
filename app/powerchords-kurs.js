// v125: Bereich „Kurs“ im Reiter Powerchords – Lehr-Zusammenfassung „Power Chord Theory“ (Kapitel 1–7).
// Inhalt wird erst beim Öffnen des Bereichs gebaut (PcKurs.build), Kapitel-Inhalt erst beim Aufklappen.
// Griffe: frets E→e (null = gedämpft), Beschriftung wird aus den Tonhöhen gerechnet (kein Griff von Hand beschriftet).
// Häkchen: localStorage „powerchords.progress.v1“, Feld kurs { "<id>": true } (nur erweitert).
(function () {
  const MIDI0 = [40, 45, 50, 55, 59, 64], md = x => ((x % 12) + 12) % 12;
  const NPC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pcOf = n => { const m = /^([A-G])(#|b)?/.exec(n); return md(NPC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)); };
  const LAB = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'], NINE = { 1: 'b9', 2: '9', 5: '11', 9: '13' };
  const SEM = { '1': 0, '8': 0, 'b2': 1, 'b9': 1, '2': 2, '9': 2, 'b3': 3, '3': 4, '4': 5, '11': 5, 'b5': 6, '#11': 6, '#4': 6, '5': 7, 'b6': 8, 'b13': 8, '6': 9, '13': 9, 'b7': 10, '7': 11 };
  // Griff-Bibliothek (Standardgriffe; jeder Ton per Test gegen die Formel geprüft)
  const CH = {
    E: [0, 2, 2, 1, 0, 0], Em: [0, 2, 2, 0, 0, 0], A: [null, 0, 2, 2, 2, 0], Am: [null, 0, 2, 2, 1, 0], D: [null, null, 0, 2, 3, 2], Dm: [null, null, 0, 2, 3, 1],
    C: [null, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 0, 3], F: [1, 3, 3, 2, 1, 1]
  };
  const K = [];
  // Griff → Marken; g = { n, r?, fr? | mk?, nm?, nine?, iv?, cap?, arp? }
  function grip(g) {
    const fr = g.fr || CH[g.n], r = g.r != null ? g.r : g.nm ? 0 : pcOf(g.n);
    if (g.mk) return { r, marks: g.mk.map(([s, f, l]) => ({ s, f, lab: l, cls: g.nm ? 'r5' : l === '1' ? 'r1' : l === '8' ? 'r8' : l === '5' ? 'r5' : 'dx3', midi: MIDI0[s] + f })), muted: [] };
    const marks = [], ms = []; let roots = 0;
    fr.forEach((f, s) => { if (f == null) return; ms.push({ s, f, midi: MIDI0[s] + f }); });
    ms.slice().sort((a, b) => a.midi - b.midi).forEach(t => {
      const d = md(t.midi - r); let l = g.nine && NINE[d] ? NINE[d] : LAB[d];
      if (d === 0) l = roots++ === 1 ? '8' : '1';
      marks.push({ s: t.s, f: t.f, lab: l, midi: t.midi, cls: l === '1' ? 'r1' : l === '8' ? 'r8' : l === '5' ? 'r5' : 'dx3' });
    });
    return { r, marks, muted: fr.map((f, s) => f == null ? s : -1).filter(s => s >= 0) };
  }
  function range(marks, full) {
    if (full) return [0, 12];
    const fs = marks.map(m => m.f), nz = fs.filter(f => f > 0), mn = nz.length ? Math.min(...nz) : 0, mx = Math.max(...fs);
    const a = mn >= 4 && !fs.includes(0) ? mn - 1 : 0; return [a, Math.max(a + 4, mx)];
  }
  const esc = s => String(s);
  function subHtml(ci, si, S) {
    let h = '<section class="pc-ksub" id="pcK_' + S.id + '"><h4 translate="no">' + S.t + '</h4><div class="pc-kbody" translate="no">';
    if (S.p) h += '<ol class="pc-ksteps">' + S.p.map(x => '<li>' + x + '</li>').join('') + '</ol>';
    if (S.m) h += '<p class="pc-kmerk">' + S.m + '</p>';
    h += '</div>';
    if (S.g) h += '<div class="pc-kgrips">' + S.g.map((g, gi) => '<div class="pc-kgrip"><b translate="no">' + esc(g.n) + '</b>' + (g.cap ? '<span class="caption" translate="no">' + g.cap + '</span>' : '') +
      '<div class="pc-bwrap" data-kb="' + ci + '.' + si + '.' + gi + '"></div><button class="toggle-btn" data-k="play" data-kg="' + ci + '.' + si + '.' + gi + '">' + (g.arp || g.mk ? '▶ Nacheinander' : '▶ Anhören') + '</button></div>').join('') + '</div>';
    if (S.loop) h += S.loop.map((L, li) => '<div class="pc-row pc-kloop"><b translate="no">' + L.c.join(' – ') + '</b><span class="caption" translate="no">' + (L.t || '') + '</span><button class="toggle-btn active" data-k="loop" data-kl="' + ci + '.' + si + '.' + li + '">▶ Loop starten</button></div>').join('');
    h += '<div class="pc-kex"><h5>Übungen</h5>' + S.ex.map((x, xi) => { const id = S.id + '-' + xi, own = x.slice(0, 2) === 'E:';
      return '<label class="check pc-kchk"><input type="checkbox" data-kx="' + id + '"> <span translate="no">' + (own ? '<i>(ergänzt)</i> ' : '') + x.slice(2) + '</span></label>'; }).join('') + '</div>';
    return h + '</section>';
  }
  let A = null, host = null;
  const total = () => K.reduce((a, c) => a + c.s.reduce((b, S) => b + S.ex.length, 0), 0);
  function kp() { const P = A.PR(); P.kurs = P.kurs || {}; return P.kurs; }
  function paintSum() {
    const st = kp(), n = Object.keys(st).filter(k => st[k]).length, t = total();
    const el = document.getElementById('pcKSum'); if (el) el.textContent = n + ' von ' + t + ' Übungen abgehakt';
    const b = document.getElementById('pcKBar'); if (b) b.style.width = (t ? 100 * n / t : 0) + '%';
  }
  function fillChapter(d) {
    if (d._k) return; d._k = true; const ci = +d.dataset.kc, C = K[ci], st = kp();
    d.querySelector('.pc-sec-b').innerHTML = (C.i ? '<p class="caption" translate="no">' + C.i + '</p>' : '') + C.s.map((S, si) => subHtml(ci, si, S)).join('');
    d.querySelectorAll('[data-kb]').forEach(el => { const [a, b, c] = el.dataset.kb.split('.').map(Number), g = K[a].s[b].g[c], q = grip(g), [f0, f1] = range(q.marks, g.nm && !g.short);
      A.board(el, { marks: q.marks, muted: q.muted, from: f0, to: f1, mini: true }); });
    d.querySelectorAll('input[data-kx]').forEach(c => { c.checked = !!st[c.dataset.kx]; });
  }
  function loopChords(L) {
    return L.c.map(n => { const g = Object.assign({ n }, (L.fr && L.fr[n]) ? { fr: L.fr[n] } : {}), q = grip(g), lo = q.marks.slice().sort((a, b) => a.midi - b.midi)[0];
      return { name: n, rootPc: q.r, rootString: lo.s, rootFret: lo.f, shapeId: null, tones: q.marks.map(m => ({ s: m.s, f: m.f, midi: m.midi, role: m.lab === '1' ? '1' : m.lab === '8' ? '8' : '5' })) }; });
  }
  function onClick(e) {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    if (b.dataset.k === 'play') { const [a, s, c] = b.dataset.kg.split('.').map(Number), g = K[a].s[s].g[c], q = grip(g);
      const ms = q.marks.map(m => m.midi); if (g.arp || g.mk) A.seqNow(g.mk ? ms : ms.slice().sort((x, y) => x - y)); else A.strumNow(ms); return; }
    if (b.dataset.k === 'loop') { const [a, s, l] = b.dataset.kl.split('.').map(Number), L = K[a].s[s].loop[l], ch = loopChords(L);
      A.begin({ chords: ch, path: 0, keyPc: ch[0].rootPc, keyName: ch[0].name }, { how: 'looper', n: 3, bpm: L.bpm || 70, drums: 'drums', label: 'Kurs · ' + L.c.join(' – ') }); }
  }
  function build(h, api) {
    if (host) return; host = h; A = api;
    h.innerHTML = '<div class="card pc-exhead"><div class="pc-row"><b id="pcKSum"></b></div><div class="pc-bar"><i id="pcKBar"></i></div>' +
      '<p class="caption" translate="no">Kurs „Power Chord Theory“, Kapitel 1–7, Schritt für Schritt nach den Worten des Lehrers. Im Kurs heißt der Ton H wie beim Lehrer <b>B</b> (das tiefere heißt <b>B-flat</b>). Die Griffbilder zeigen die hohe e-Saite oben; die Zahlen in den Punkten sind die Intervalle.</p></div>' +
      K.map((C, ci) => '<details class="card pc-sec pc-kc" data-kc="' + ci + '" id="pcKC' + (ci + 1) + '"' + (ci === 0 ? ' open' : '') + '><summary><h3 translate="no">' + C.t + '</h3></summary><div class="pc-sec-b"></div></details>').join('');
    h.addEventListener('click', onClick);
    h.addEventListener('change', e => { const c = e.target.closest('input[data-kx]'); if (!c) return; const st = kp(); if (c.checked) st[c.dataset.kx] = true; else delete st[c.dataset.kx]; A.saveProg(); paintSum(); });
    h.querySelectorAll('details.pc-kc').forEach(d => { d.addEventListener('toggle', () => { if (d.open) fillChapter(d); }); if (d.open) fillChapter(d); });
    paintSum();
  }
  // Prüfung für Tests: jede Marke passt zu ihrem Intervall bzw. Notennamen, Intervallmenge = Formel
  function check() {
    const bad = [];
    const all = []; K.forEach(C => C.s.forEach(S => { (S.g || []).forEach(g => all.push(g)); (S.loop || []).forEach(L => L.c.forEach(n => all.push(Object.assign({ n }, L.fr && L.fr[n] ? { fr: L.fr[n] } : {})))); }));
    all.forEach(g => { const q = grip(g);
      q.marks.forEach(m => { if (g.nm ? md(m.midi) !== pcOf(m.lab) : md(m.midi - q.r) !== SEM[m.lab]) bad.push(g.n + ' ' + m.s + '/' + m.f + ' ' + m.lab); });
      if (g.iv) { const want = g.iv.split(' ').map(x => SEM[x]).sort().join(), got = [...new Set(q.marks.map(m => SEM[m.lab]))].sort().join(); if (want !== got) bad.push(g.n + ' Formel ' + g.iv); } });
    return { n: all.length, bad };
  }
  window.PcKurs = { K, CH, build, grip, check, total };
})();

// ===== Kapitel 1 – Einleitung =====
PcKurs.K.push({ t: 'Kapitel 1 – Einleitung', s: [
  { id: 'k1-1', t: '1.1 Worum der Kurs geht', p: [
    'Der Kurs heißt „Power Chord Theory“. Grundgedanke des Lehrers: <b>„Gitarrenakkorde sind nicht kompliziert.“</b>',
    'Du brauchst kein 600-Seiten-Akkordbuch. Du lernst, wie man Akkorde <b>zusammenbaut</b>. Wer weiß, was die Zahlen in A7, B9 oder B13 bedeuten, spielt sie selbst.',
    'Er fängt „bei Null“ an: mit dem Powerchord. Am Ende baust du komplexe Akkorde und „coole Extensions“ (Akkorderweiterungen).',
    '„Wenn ihr bis 13 zählen könnt, ist das alles nicht kompliziert.“',
    'Das hilft in jedem Stil, auch beim Solieren: Du weißt, welche Funktion die gespielte Note im Akkord hat (Quinte, große 7, 9 …).',
    'Start: „Erstmal Spaß haben. 1, 5 und 8. Powerchord.“ Alles baut auf diesem „Energieakkord“ auf.'],
    ex: ['E:Sage laut, worauf der ganze Kurs aufbaut: „1, 5, 8 – Powerchord“. Zähle dann einmal von 1 bis 13.'] },
  { id: 'k1-2', t: '1.2 Sprachregeln: Zahlen, Kreuz, b – und das B', p: [
    'Intervalle sind <b>Zahlen</b>: 1, 2, 3 … Kreuz (Sharp) macht höher, b (Flat) macht tiefer. Er sagt z. B. „Kreuz Elf“ (#11), „b3“, „b7“.',
    '<b>Das B-Problem:</b> Der Lehrer arbeitet nicht mit H. Das musikalische Alphabet hat 7 Buchstaben: <b>A B C D E F G</b>.',
    'Der Ton einen Halbton tiefer als B heißt <b>B-flat</b> – das einzige englische Wort, das du brauchst.',
    'Tiefer gemachte Töne auf Deutsch: D → <b>Des</b>, E → <b>Es</b>, G → <b>Ges</b>, A → <b>As</b>. Das B wird nicht zu „Bes“, sondern zu <b>B-flat</b>.',
    'Warum? So kannst du internationale Noten und Akkordsymbole lesen.'],
    m: 'Merksatz: A B C D E F G – und unter dem B liegt B-flat.',
    ex: ['E:Namen-Übung: Sage laut „A B C D E F G A“ und danach die tiefer gemachten Töne „Des, Es, Ges, As, B-flat“. Geschafft, wenn du nicht mehr über „H“ stolperst.'] }
] });

// ===== Kapitel 2 – Powerchord-Grundlagen =====
PcKurs.K.push({ t: 'Kapitel 2 – Powerchord-Grundlagen', s: [
  { id: 'k2-1', t: '2.1 Was ist ein Powerchord?', p: [
    'Akkorde haben Charakter: Dur fröhlich, Moll traurig, Sus schwebend.',
    'Dem Powerchord fehlt genau der Ton, der den Charakter gibt (die Terz). Er ist <b>neutral</b> – deshalb klingt er gut mit <b>Verzerrung</b>: „Der dritte Ton ist nicht das Salz in der Suppe.“',
    'Griff: <b>Zeigefinger, Ringfinger, kleiner Finger</b> auf der <b>E-, A- und D-Saite</b> (Finger 1, 3, 4).',
    'Die Töne heißen <b>1 (Grundton) – 5 (Quinte) – 8 (wieder der Grundton)</b>, also „1-5-8“ oder „1-5-1“.'],
    m: '„Dass die 8 die 1 ist, ist extremst wichtig.“',
    g: [{ n: 'G5', fr: [3, 5, 5, null, null, null], iv: '1 5', cap: 'Beispiel: Grundton im 3. Bund' }],
    ex: ['E:Greife den Powerchord mit Finger 1, 3, 4 im 3. Bund (G5), schlage ihn an und sage dabei „1 – 5 – 8“. Schiebe ihn in den 5. Bund und wiederhole.'] },
  { id: 'k2-2', t: '2.2 Zählen um den Powerchord herum', p: [
    'Über der 8 kommt die 9, unter der 8 die 7.',
    'Von der Quinte (5) einen Schritt nach unten ist die 4, darunter die 3.',
    'Direkt unter der 8 liegt die <b>große 7</b>, einen Bund tiefer die <b>kleine 7</b>.',
    'Über der 8 liegen die <b>b9</b> (ein Bund) und die <b>9</b> (zwei Bünde).',
    'Es gibt also „zwei Siebenen“ (eine kleine und eine große). Mehr dazu in Kapitel 3.'],
    g: [{ n: 'Um G5 herum', r: 7, mk: [[0, 3, '1'], [1, 2, '3'], [1, 3, '4'], [1, 5, '5'], [2, 3, 'b7'], [2, 4, '7'], [2, 5, '8'], [2, 6, 'b9'], [2, 7, '9']], cap: 'Grundton G auf der E-Saite, 3. Bund' }],
    ex: ['E:Greife G5 (3. Bund). Spiele die 8 und gehe auf der D-Saite einen Bund tiefer (große 7) und noch einen (kleine 7). Dann von der 8 aus hoch: b9, 9. Sage jede Zahl laut.'] },
  { id: 'k2-3', t: '2.3 Noten auf dem Griffbrett: nur die Stammtöne', p: [
    'Du lernst nicht alle Noten, nur die <b>Stammtöne auf der E- und der A-Saite</b> (A B C D E F G).',
    'Regel: <b>Zwischen E–F und B–C gibt es keinen Zwischenton.</b> Überall sonst liegt ein Bund dazwischen.',
    'E-Saite: E (leer), F, G, A, B, C, D, E – Bünde 0, 1, 3, 5, 7, 8, 10, 12 (12. Bund = „zwei Dots“).',
    'A-Saite: A, B, C, D, E, F, G, A – Bünde 0, 2, 3, 5, 7, 8, 10, 12.',
    'Töne dazwischen: entweder der Name darunter mit „-is“ (Kreuz) oder der Name darüber tiefer gemacht (b). Wann was gilt, hängt von der Tonart ab – „darum geht es in dem Kurs überhaupt gar nicht“.',
    'Aufwärts ab F: F, Fis, G, Gis, A, Ais (= B-flat), B, C, Cis, D, Dis, E. Abwärts: E, Es, D, Des, C, B, B-flat, A, As …'],
    m: '„Sagt es fünfmal: E und F, B und C – kein Extraton.“',
    g: [{ n: 'Stammtöne E-Saite', nm: true, mk: [[0, 0, 'E'], [0, 1, 'F'], [0, 3, 'G'], [0, 5, 'A'], [0, 7, 'B'], [0, 8, 'C'], [0, 10, 'D'], [0, 12, 'E']] },
        { n: 'Stammtöne A-Saite', nm: true, mk: [[1, 0, 'A'], [1, 2, 'B'], [1, 3, 'C'], [1, 5, 'D'], [1, 7, 'E'], [1, 8, 'F'], [1, 10, 'G'], [1, 12, 'A']] }],
    ex: ['L:Sage fünfmal laut: „E und F, B und C – kein Extraton.“',
      'L:Sage und spiele die Stammtöne der E- und der A-Saite („wenn ihr das nicht könnt, was macht ihr denn hier?“).',
      'E:Stammtöne-Leiter: Spiele die E-Saite Bund 0-1-3-5-7-8-10-12 und sage E-F-G-A-B-C-D-E, dann die A-Saite 0-2-3-5-7-8-10-12 mit A-B-C-D-E-F-G-A. Langsam, ein Ton pro Schlag. Geschafft, wenn du die Namen ohne Nachzählen weißt.'] },
  { id: 'k2-4', t: '2.4 Töne ableiten mit dem Powerchord', p: [
    'Beim Powerchord liegt der gleiche Ton (1 und 8) auf zwei Saiten. Damit leitest du alle anderen Saiten ab.',
    '<b>D-Saite aus der E-Saite:</b> Ein Ton auf der D-Saite ist die 8. Lege die Powerchord-Form nach unten – der Grundton auf der E-Saite verrät den Namen.',
    'Beispiel des Lehrers: ein willkürlicher Ton auf der D-Saite mit dem kleinen Finger, Powerchord nach unten – du landest auf <b>B-flat</b> (A#).',
    '<b>G-Saite aus der A-Saite:</b> gleiches Prinzip, eine Saite höher.',
    '<b>B-Saite aus der D-Saite:</b> Die B-Saite ist „falsch gestimmt“ (Terz statt Quarte). Deshalb schiebst du den kleinen Finger <b>einen Bund nach oben</b>.',
    '<b>Hohe e-Saite = tiefe E-Saite</b>, nur zwei Oktaven höher.',
    'So musst du nur die Stammtöne der E- und A-Saite lernen und kannst den Rest ableiten.',
    'Nach der 8 wiederholt sich alles: 1 = 8, 2 = 9, 3 = 10, 4 = 11. Darum gibt es Sus2/Sus4, aber auch 9/11 – das kommt in Kapitel 3 und 6.'],
    m: '„Lernt, wie die Töne heißen. Kommuniziert wie Musiker.“ – „Alles basiert auf 1-5-8.“',
    g: [{ n: 'D-Saite → E-Saite', fr: [6, 8, 8, null, null, null], r: 10, iv: '1 5', cap: 'Ton auf der D-Saite, 8. Bund: Grundton E-Saite 6. Bund = B-flat' },
        { n: 'G-Saite → A-Saite', fr: [null, 3, 5, 5, null, null], r: 0, iv: '1 5', cap: 'G-Saite 5. Bund = C (wie A-Saite 3. Bund)' },
        { n: 'B-Saite → D-Saite', fr: [null, null, 3, 5, 6, null], r: 5, iv: '1 5', cap: 'B-Saite: ein Bund mehr – 6. Bund = F' },
        { n: 'e-Saite = E-Saite', nm: true, mk: [[0, 3, 'G'], [5, 3, 'G']], short: true, cap: 'gleicher Bund, gleicher Name' }],
    ex: ['L:Greife einen willkürlichen Ton auf der D-, G- oder B-Saite und leite ihn per Powerchord nach unten ab („Wo lande ich? B-flat oder A#“).',
      'E:Powerchord-Ableitung: Powerchord auf der E-Saite im 3. Bund (G). Der Finger auf der D-Saite im 5. Bund ist auch ein G. Geschafft, wenn du den Ton auf der D-Saite ohne Tabelle nennst.'] }
] });

// ===== Kapitel 3 – Intervalle =====
PcKurs.K.push({ t: 'Kapitel 3 – Intervalle', s: [
  { id: 'k3-1', t: '3.1 Namen und Zahlen', p: [
    'Intervalle sind die Zahlen 1 bis 8 – genauso einfach wie A bis G. Es gibt nur sieben verschiedene Zahlen, denn die 8 ist wieder die 1.',
    '<b>Nur einmal gibt es: 1, 4, 5, 8.</b> „Es gibt keine große 5 oder kleine 5.“ Die 1 heißt auch Prime.',
    'Zwischen 4 und 5 liegt der <b>Tritonus</b> – der Lehrer nennt ihn „Bart Simpson“. Er heißt #11, #4 oder b5, aber nie „kleine 5“ oder „große 4“.',
    '<b>Zweimal gibt es (klein und groß): 2, 3, 6, 7.</b> Klein schreibt man mit b, groß ohne Zeichen.',
    'Die ganze Reihe: 1, b2, 2, b3, 3, 4, (Bart Simpson), 5, b6, 6, b7, 7, 8.',
    'Im Powerchord liegen 1, 4, 5, 8 symmetrisch; die 4 liegt unter der 5.',
    'Fachnamen: Prime, Sekunde, Terz, Quarte, Quinte, Tritonus, Sexte, Septime, Oktave. „Wir bleiben bei Zahlen.“'],
    g: [{ n: 'Alle Intervalle von A', r: 9, mk: [[0, 5, '1'], [0, 6, 'b2'], [0, 7, '2'], [0, 8, 'b3'], [1, 4, '3'], [1, 5, '4'], [1, 6, 'b5'], [1, 7, '5'], [1, 8, 'b6'], [2, 4, '6'], [2, 5, 'b7'], [2, 6, '7'], [2, 7, '8']], cap: 'Grundton A auf der E-Saite, 5. Bund' }],
    ex: ['E:Kurz-Quiz „Wie viele Varianten?“: Sage zu jeder Zahl 1 bis 8, ob es sie einmal gibt (1, 4, 5, 8) oder zweimal, klein und groß (2, 3, 6, 7).'] },
  { id: 'k3-2', t: '3.2 Die 7 – Sonderregel bei Akkordsymbolen', p: [
    '<b>Bei Intervallen:</b> b7 = kleine Septime, 7 = große Septime.',
    '<b>Bei Akkordsymbolen:</b> eine einfache „7“ heißt <b>kleine 7</b>. D7 ist also D mit kleiner 7.',
    'Die <b>große 7</b> schreibt man im Akkordsymbol <b>maj7</b>, <b>M7</b> oder mit Dreieck (Δ7).',
    'Warum? Bei „Db7“ wüsste man sonst nicht, ob das b zum D gehört (Des) oder zur 7.'],
    m: '„Wenn es um Intervalle geht: b7 und 7. Wenn es um Akkorde geht: 7 und Major 7. Ich weiß, das ist echt kaputt.“',
    ex: ['E:Sage zu D7, Dmaj7, DM7 und DΔ7, welche 7 gemeint ist (D7 = kleine 7, die anderen drei = große 7).'] },
  { id: 'k3-3', t: '3.3 Intervalle auf dem Griffbrett: die Dur-Tonleiter', p: [
    'Setze den <b>Mittelfinger</b> auf einen Ton der E-Saite, z. B. A im 5. Bund.',
    'E-Saite: Finger 2 und 4. A-Saite: Finger 1, 2, 4. D-Saite: Finger 1, 3, 4. Kurz: 2-4 | 1-2-4 | 1-3-4.',
    'Du landest auf der <b>8</b> – derselbe Ton wie beim Powerchord.',
    'Die Töne heißen 1, 2, 3, 4, 5, 6, 7 (große 7), 8. In der Dur-Tonleiter ist alles „ziemlich groß“.',
    '<b>b2:</b> Wenn du die 2 kennst, liegt die b2 einen Bund darunter. „Sofort sind wir in einer coolen abgedrehten Tonart.“',
    '<b>3 = große Terz</b> („happy“), <b>b3 = kleine Terz</b> (Moll, traurig) – einen Bund unter der 3.',
    'Dann die 4, der Bart Simpson, die 5. Die <b>b6</b> liegt einen Bund unter der 6.',
    'Der Lehrer leitet fast immer <b>von der 8</b> ab und zählt nach unten: 7, b7, 6, b6, 5, Bart Simpson, 4, 3, b3, 2, b2, 1.'],
    g: [{ n: 'Dur-Tonleiter A (eine Oktave)', r: 9, mk: [[0, 5, '1'], [0, 7, '2'], [1, 4, '3'], [1, 5, '4'], [1, 7, '5'], [2, 4, '6'], [2, 6, '7'], [2, 7, '8']], cap: 'Finger 2-4 | 1-2-4 | 1-3-4' },
        { n: 'Die kleinen Varianten', r: 9, mk: [[0, 5, '1'], [0, 6, 'b2'], [1, 3, 'b3'], [2, 3, 'b6'], [2, 5, 'b7'], [2, 7, '8']], cap: 'je ein Bund unter 2, 3, 6, 7' }],
    ex: ['L:Spiele die Dur-Tonleiter über eine Oktave wie oben und sage dabei 1-2-3-4-5-6-7-8 („so dumm es klingt“). Dann ganz langsam noch einmal.',
      'L:Finde zu jedem Ton die kleine Variante: b2 unter der 2, b3 unter der 3, b6 und b7 – immer vom Grundton oder von der 8 aus.',
      'E:Reihe b-Intervalle: Spiele die Tonleiter und zu jedem Ton den Halbton darunter, langsam. Geschafft, wenn du hörst: b3 klingt traurig, 3 klingt fröhlich.'] },
  { id: 'k3-4', t: '3.4 9, 11, 13 – die Oktave darüber', p: [
    'Weil 1 = 8 ist, ist 2 = 9. Eine Oktave höher bekommen aber nur manche Zahlen einen neuen Namen.',
    'Die 3 heißt nie „10“, die 5 bleibt immer 5. Die <b>2 wird zur 9, die 4 zur 11, die 6 zur 13</b> (auch b9, #11, b13).',
    'Grund: <b>1, 3, 5 (und 7) sind Akkordtöne.</b> Die „coolen Noten dazwischen“ (2, 4, 6) heißen 9, 11, 13, wenn sie <b>zusätzlich</b> zum Akkord gespielt werden – das sind die <b>Akkorderweiterungen</b>.',
    'Ausblick: Bei den offenen Akkorden (Kapitel 4) gilt: Wer weiß, wo die 3 ist, findet auch die 4 (Sus4) und die 2 (Sus2).'],
    g: [{ n: '9, 11, 13 über der 8', r: 9, mk: [[0, 5, '1'], [1, 7, '5'], [2, 7, '8'], [3, 4, '9'], [3, 7, '11'], [4, 7, '13']], cap: 'Grundton A, E-Saite 5. Bund' }],
    ex: ['E:Greife A5 (E-Saite 5. Bund) mit der 8 auf der D-Saite und finde darüber die 9, die 11 und die 13. Sage dazu, welche Zahl sie eine Oktave tiefer hätten (2, 4, 6).'] }
] });
