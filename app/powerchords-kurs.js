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
      '<p class="caption" translate="no">Kurs „Power Chord Theory“, Kapitel 1–7, Schritt für Schritt nach den Worten des Lehrers. Im Text heißt der Ton H wie beim Lehrer <b>B</b> (das tiefere heißt <b>B-flat</b>); auf dem Griffbrett steht die Saite wie im übrigen Reiter als H. Die Griffbilder zeigen die hohe e-Saite oben; die Zahlen in den Punkten sind die Intervalle.</p></div>' +
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

// ===== Kapitel 4 – Das CAGED-System =====
Object.assign(PcKurs.CH, { Cmaj7: [null, 3, 2, 0, 0, 0], Dm7: [null, null, 0, 2, 1, 1] });
PcKurs.K.push({ t: 'Kapitel 4 – Das CAGED-System', s: [
  { id: 'k4-1', t: '4.1 Was heißt CAGED?', p: [
    'CAGED steht für die Grundakkorde <b>C, A, G, E, D</b> – „unsere Grundakkordtypen“.',
    'Der Lehrer nennt sie <b>Pfadfinder-Akkorde</b> (offene Akkorde).',
    'Sie sind „ähnlich relevant wie ein Powerchord“: Wenn du verstehst, was in diesen Griffen passiert, „dann wissen wir schon alles“.'],
    g: [{ n: 'C', iv: '1 3 5' }, { n: 'A', iv: '1 3 5' }, { n: 'G', iv: '1 3 5' }, { n: 'E', iv: '1 3 5' }, { n: 'D', iv: '1 3 5' }],
    ex: ['E:Spiele die fünf Pfadfinder-Akkorde C – A – G – E – D nacheinander und sage bei jedem den Grundton.'] },
  { id: 'k4-2', t: '4.2 Das C und der Dreiklang', p: [
    'Greife C-Dur offen. Achte darauf, dass die offenen Saiten frei schwingen.',
    'Der Ton auf der A-Saite ist der <b>Grundton C</b>.',
    'Der nächste Ton ist die <b>Terz E</b> („1, 2, 3 – große Terz“).',
    'Übrig bleibt das <b>G = Quinte</b>.',
    'Das ist ein <b>Dreiklang</b>: Grundton – große Terz – Quinte = Dur. Grundton – kleine Terz – Quinte = Moll.'],
    g: [{ n: 'C', iv: '1 3 5', arp: true, cap: 'Töne von tief nach hoch: 1, 3, 5, 8, 3' }],
    ex: ['E:1-3-5 von C benennen: Zupfe den C-Akkord einzeln von tief nach hoch (Arpeggio) und sage „1, 3, 5, 8, 3“.'] },
  { id: 'k4-3', t: '4.3 Halbtonschritte zählen', p: [
    'Beispiel Grundton <b>F</b>: Bis zur großen Terz sind es <b>4 Halbtonschritte</b> (den Startton zählst du nicht mit).',
    'Von der Terz bis zur Quinte sind es noch <b>3 Halbtonschritte</b>. Dur = <b>4 + 3</b>.',
    '<b>Moll = 3 + 4</b>: „In der Mitte geht eins runter.“',
    'Spielst du die Töne einzeln nacheinander, ist das ein <b>Arpeggio</b>.'],
    g: [{ n: 'F-Dur: 4 + 3', r: 5, mk: [[0, 1, '1'], [0, 5, '3'], [0, 8, '5']], short: true, cap: 'auf der E-Saite gezählt' },
        { n: 'F-Moll: 3 + 4', r: 5, mk: [[0, 1, '1'], [0, 4, 'b3'], [0, 8, '5']], short: true, cap: 'die Mitte einen Bund tiefer' }],
    ex: ['L:Zähle die Halbtonschritte am Beispiel F: große Terz = 4 Halbtonschritte, dann +3 bis zur Quinte. Für Moll: 3 + 4.',
      'L:Spiele die Töne eines Akkords einzeln nacheinander (Arpeggio).'] },
  { id: 'k4-4', t: '4.4 Grundstellung und Umkehrungen', p: [
    '1-3-5 ist die <b>Grundstellung</b>.',
    'Die Reihenfolge ist egal: 3-5-1 oder 5-1-3 ist „trotzdem C-Dur“.',
    '<b>Für die Funktion ist die Reihenfolge irrelevant.</b>'],
    ex: ['E:Zupfe die Töne C, E, G in anderer Reihenfolge (3-5-1, dann 5-1-3) und höre: Es bleibt C-Dur.'] },
  { id: 'k4-5', t: '4.5 Moll ableiten und ein Vorgeschmack: Cmaj7', p: [
    'Dur → Moll: Die Terz <b>einen Halbton tiefer</b> spielen. „Wenn ich weiß, dass die große Terz Dur ist und die kleine Terz Moll … dann weiß ich, wo die kleine Terz ist.“',
    'Im C-Griff ist der Ton auf der B-Saite die <b>8</b> (ein zweites C).',
    'Die 8 um einen Halbton verringern = <b>7</b>: Finger weglassen, die offene B-Saite klingt – das ist <b>Cmaj7</b>.',
    '„Einfach, brauch ich kein bescheuertes Buch für.“',
    'Aus der 8 kann man auch eine 9 machen – das ist nur ein „kleiner Vorgeschmack“, es kommt später.'],
    g: [{ n: 'C', iv: '1 3 5' }, { n: 'Cmaj7', iv: '1 3 5 7', cap: 'Finger von der 8 weg' }],
    ex: ['L:Greife C-Dur und lass den Finger der 8 (B-Saite) weg: Cmaj7.'] },
  { id: 'k4-6', t: '4.6 Das G-Shape', p: [
    'G ist „nichts anderes als was wir eben hatten“: <b>1-3-5-8</b>. Die G-Saite ist der Grundton (die 8).',
    'Auf der B-Saite setzt du keinen Finger – wegen des Halbtonschritts durch die Terz-Stimmung zwischen G- und B-Saite.',
    'Auf der hohen e-Saite greift der kleine Finger das G, „zwei Oktaven höher“.',
    'Abwandeln: Die G-Saite ist die 8. Einen Bund drüber liegt die b9, zwei Bünde drüber die <b>9</b> – „eine wunderschöne 9“.',
    '„Kompliziert war das null.“'],
    g: [{ n: 'G', iv: '1 3 5' }, { n: 'G mit 9', fr: [3, 2, 0, 2, 0, 3], nine: true, iv: '1 3 5 9', cap: 'G-Saite 2. Bund statt leer' }],
    ex: ['E:Greife G, benenne 1-3-5-8, dann lege einen Finger auf die G-Saite im 2. Bund und höre die 9.'] },
  { id: 'k4-7', t: '4.7 E, A, D – die Powerchord-Akkorde', p: [
    'C und G sind vom Griff her verwandt. E, A und D sind es auch.',
    '<b>E-Dur:</b> der E-Powerchord mit offener E-Saite, dazu die Terz G# auf der G-Saite („die erste Note, die anders ist“), oben B (Quinte) und E (Grundton): <b>1-5-8-3-5-1</b>.',
    '<b>A-Dur:</b> der A-Powerchord 1-5-8, darüber die Terz und ganz oben die Quinte: <b>1-5-8-3-5</b>. „Genau derselbe Akkord“ wie E – wegen der B-Saite um eins nach oben verschoben.',
    '<b>D-Dur:</b> Powerchord auf der D-Saite, der kleine Finger <b>einen Bund höher</b> wegen der B-Saite. Oben liegt die Terz: <b>1-5-8-3</b>.'],
    m: '„Immer die drei tiefen Saiten dieser drei Akkorde haben einen Powerchord drin: 1-5-8.“',
    g: [{ n: 'E', iv: '1 3 5' }, { n: 'A', iv: '1 3 5' }, { n: 'D', iv: '1 3 5' }],
    ex: ['E:Greife E, A und D und spiele zuerst nur die drei tiefsten gegriffenen Saiten (den Powerchord), dann den ganzen Akkord. Sage, welcher Ton dazukommt (die Terz).'] },
  { id: 'k4-8', t: '4.8 Moll aus E, A, D', p: [
    '„Wieso brauche ich ein Buch, das mir zeigt, wie ich E-Moll oder D-Moll spiele? Wenn ich verstehe, dass der Unterschied in der Terz liegt.“',
    'In E, A und D gibt es nur <b>eine Terz</b>, der Rest ist 1 und 5. Die große Terz einen Halbton runter = kleine Terz.',
    '<b>E-Moll:</b> Finger der Terz (G-Saite) weg, die offene Saite klingt.',
    '<b>A-Moll:</b> Powerchord 1-5-8 und die Terz einen Halbton tiefer. „Lernt nicht A-Dur und A-Moll getrennt – das ist derselbe Akkord, Unterschied in der Terz.“',
    '<b>D-Moll:</b> Terz einen Halbton runter. <b>Dm7:</b> Zeigefinger flach – „zwei unter meiner 8 = kleine 7“. „Ich leite ihn mir ab.“',
    'G-Moll und C-Moll spielt er nicht offen: Dort steckt die Terz <b>zweimal</b> drin. Eine klein, eine groß klingt „als Schrammelakkord absolut kacke“. Dazu kommen die <b>Low Interval Limits</b>: tiefe kleine Terzen klingen schlecht. „Ich würde keinen G-Moll spielen.“'],
    g: [{ n: 'Em', iv: '1 b3 5' }, { n: 'Am', iv: '1 b3 5' }, { n: 'Dm', iv: '1 b3 5' }, { n: 'Dm7', iv: '1 b3 5 b7', cap: 'Zeigefinger flach' }],
    loop: [{ c: ['E', 'Em', 'A', 'Am', 'D', 'Dm'], bpm: 65, t: 'Dur ↔ Moll, je ein Takt' }],
    ex: ['L:Mache aus E, A und D Moll: die Terz einen Halbton tiefer.',
      'E:Dur↔Moll-Paare: Wechsle E/Em, A/Am, D/Dm, je 4 Schläge Dur und 4 Schläge Moll, etwa 60–70 BPM (Vorschlag). Geschafft, wenn du vorher sagst, welcher Ton sich ändert (die Terz).'] },
  { id: 'k4-9', t: '4.9 Barré: Technik und Prinzip', p: [
    'Viele hören beim Barré auf. Ein F-Barré ist am Anfang schwer, weil die Saiten nah am Sattel hoch liegen.',
    'Der Druck kommt nicht aus dem Quetschen („nicht diesen Schraubstock“), sondern vor allem aus <b>Zug nach hinten</b> mit dem Arm. Der Daumen liegt hinten in der Mitte. „Ich kann den F-Barré ohne Daumen spielen.“',
    '„Bisschen Zug nach hinten, bisschen drücken, dann kriegt ihr das hin.“',
    'Prinzip: Ein Barré ist kein anderer Akkord, sondern ein <b>offener Akkord, bei dem der Zeigefinger den Sattel spielt</b> – wie ein Kapodaster.'],
    m: '„Barré-Akkord ist ein offener Akkord, wo ihr Kapo spielt.“',
    g: [{ n: 'F', iv: '1 3 5', cap: 'E-Form im 1. Bund' }],
    ex: ['L:Barré-Technik: „Zug nach hinten“ statt Quetschen; probiere den F-Barré ohne Daumen.',
      'E:F-Barré-Zug-Übung: F im 1. Bund halten, ohne mit dem Daumen zu pressen, mit Zug nach hinten. 5 Anschläge, 10 Sekunden Pause. Geschafft, wenn alle Saiten klar klingen.'] },
  { id: 'k4-10', t: '4.10 Barré mit E-Form und A-Form', p: [
    '<b>E-Form:</b> Greife E-Dur statt mit 2-3-1 mit den Fingern <b>3-4-2</b>. Der Zeigefinger ist frei und liegt über allen Saiten, z. B. für F oder Fis/Gis.',
    'Moll: wie beim E-Moll den Terz-Finger weg. „Moll und Dur als Barré ist nichts anderes als Moll und Dur vom E, man verschiebt nur.“',
    '<b>A-Form:</b> A-Dur mit dem Zeigefinger als Sattel nach oben schieben. Der Grundton liegt auf der A-Saite.',
    'Damit die tiefe E-Saite nicht mitklingt, tippt der Zeigefinger sie leicht an. „Gewöhnt euch an, dass der Finger leicht an die tiefere Saite geht.“',
    '<b>Moll mit A-Form:</b> Terz einen Halbton tiefer.'],
    m: '„Leit mir die A-Dur-Form ab: vom Powerchord 1-5-8! Hängen wir eine Terz dran. Moll: Terz, mach sie klein.“',
    g: [{ n: 'F', iv: '1 3 5', cap: 'E-Form, 1. Bund' }, { n: 'Fm', fr: [1, 3, 3, 1, 1, 1], iv: '1 b3 5', cap: 'E-Form Moll' },
        { n: 'C', fr: [null, 3, 5, 5, 5, 3], iv: '1 3 5', cap: 'A-Form, 3. Bund' }, { n: 'Cm', fr: [null, 3, 5, 5, 4, 3], iv: '1 b3 5', cap: 'A-Form Moll' }],
    ex: ['L:E-Form umbauen auf die Finger 3-4-2, Zeigefinger frei als Sattel; dann die A-Form verschieben.',
      'L:Saiten-Kontrolle bei der A-Form: alle Saiten einzeln anschlagen und prüfen, dass die tiefe E-Saite nicht mitklingt.',
      'E:Saitenklang-Kontrolle: Nach jedem Barré-Griff alle Saiten einzeln anschlagen und merken, welche nicht klingt. Ziel: keine.'] },
  { id: 'k4-11', t: '4.11 Barré mit D-, C- und G-Form', p: [
    '<b>D-Form:</b> D-Dur mit den Fingern <b>2-4-3</b> greifen, Zeigefinger frei, zwei Bünde höher. Den Grundton greift der Zeigefinger. „Die drei schnell hinzulegen dauert ein bisschen, muss man üben.“',
    '<b>D-Form Moll:</b> große Terz → kleine Terz = ein verschiebbarer Moll-Akkord.',
    'Zusammen: Barré mit Grundton auf der <b>E-Saite</b> (Dur/Moll), auf der <b>A-Saite</b> (Dur/Moll) und auf der <b>D-Saite</b> (Dur „nicht so einfach“, und Moll).',
    '<b>C-Form:</b> Finger umbauen auf <b>4-3-2</b>, Zeigefinger frei, dann verschiebbar. Der Grundton liegt auf der <b>A-Saite</b> („Vorsicht!“). Moll gibt es hier nicht – die Terz kommt zweimal vor.',
    '<b>G-Form:</b> Der Zeigefinger greift D-, G- und B-Saite zwei Bünde tiefer – „nicht ganz so einfach“. „Der Rest ist ein G-Shape.“',
    'Alle fünf Formen lassen sich verschieben, nicht nur E und A. C und G sind als Moll schwierig. „Es gibt nur eine Terz – die kann man einfach nach unten boinken.“',
    'Auch im Barré kannst du abwandeln, z. B. aus der 8 eine 9 machen. „Da muss man nichts Kompliziertes lernen, man muss es spielen lernen.“'],
    g: [{ n: 'E', fr: [null, null, 2, 4, 5, 4], iv: '1 3 5', cap: 'D-Form, Grundton D-Saite 2. Bund' }, { n: 'Em', fr: [null, null, 2, 4, 5, 3], iv: '1 b3 5', cap: 'D-Form Moll' },
        { n: 'D', fr: [null, 5, 4, 2, 3, 2], iv: '1 3 5', cap: 'C-Form, Grundton A-Saite 5. Bund' }, { n: 'A', fr: [5, 4, 2, 2, 2, 5], iv: '1 3 5', cap: 'G-Form, Zeigefinger im 2. Bund' }],
    ex: ['L:D-Form mit den Fingern 2-4-3 und C-Form mit 4-3-2 umbauen, Zeigefinger frei als Sattel, dann verschieben.',
      'E:Wechsle E (D-Form) und Em (D-Form) je 4 Schläge und sage, welcher Finger die Terz greift.'] },
  { id: 'k4-12', t: '4.12 Arpeggios und Ausblick', p: [
    'Kennst du CAGED, kannst du über das ganze Griffbrett spielen. Beispiel: <b>E-Dur mit C-Shape</b> („Shape heißt Form“).',
    'Die Noten hintereinander gespielt sind ein <b>Arpeggio</b> – 1-3-5-8.',
    '„Wenn ich das CAGED-System verstehe, dann sind <b>Arpeggios eine reine Übungssache</b>, keine Verständnissache. Die Form kennt ihr schon.“',
    'Ausblick: Mit dem Powerchord erkennst du 1-5-8, die extra Note ist die Terz. Kennst du die Terz, findest du die kleine Terz, aber auch <b>2 und 4</b>.',
    'Als Nächstes: die Funktionen der Dur- und Moll-Akkorde in einer Tonart (Kapitel 5), danach die Sus-Akkorde mit 2 und 4 (Kapitel 6).'],
    g: [{ n: 'E', fr: [null, 7, 6, 4, 5, 4], iv: '1 3 5', arp: true, cap: 'C-Shape, Grundton A-Saite 7. Bund' }],
    ex: ['L:Spiele die Töne der Formen einzeln nacheinander (Arpeggio), z. B. E-Dur mit C-Shape.',
      'E:Spiele E-Dur als Arpeggio in zwei Formen (offen und C-Shape im 7. Bund) und sage dabei die Zahlen 1-3-5-8.'] }
] });

// ===== Kapitel 5 – Akkordfunktionen =====
Object.assign(PcKurs.CH, { G7: [3, 2, 0, 0, 0, 1], Am7: [null, 0, 2, 0, 1, 0], Bm7b5: [null, 2, 3, 2, 3, null], Em7: [0, 2, 2, 0, 3, 0], Fmaj7: [null, null, 3, 2, 1, 0] });
PcKurs.FO = [null, null, 3, 2, 1, 1];                                  // F offen (xx3211) für Folgen in C
PcKurs.K.push({ t: 'Kapitel 5 – Akkordfunktionen', s: [
  { id: 'k5-1', t: '5.1 Die Dur-Tonleiter und ihre Stufenakkorde', p: [
    'Die Funktionen der Akkorde in einer Dur-Tonleiter helfen später bei Entscheidungen: „mache ich eine Sus4 draus, kann ich Sus2 machen, will ich die 7 vermeiden?“ Das sind die <b>diatonischen Funktionen</b>.',
    'Abstandsformel der Dur-Tonleiter: <b>2-2-1-2-2-2-1</b> (2 = Ganzton, 1 = Halbton). Das Griffmuster kennst du schon (2-4 | 1-2-4 | 1-3-4).',
    'Baust du aus den 7 Tonleitertönen Dreiklänge, entstehen „unweigerlich“ bestimmte Akkorde. Beispiel <b>F-Dur</b> (F G A B-flat C D E): F-Dur, G-Moll, A-Moll, B-flat-Dur, C-Dur, D-Moll und E-Moll mit b5.',
    'Auf der 7. Stufe: „Das B als 5 steht uns nicht zur Verfügung, also B-flat“ – ein <b>verminderter</b> Akkord.',
    'Reihenfolge in <b>jeder</b> Dur-Tonart: <b>Dur, Moll, Moll, Dur, Dur, Moll, vermindert</b>.',
    'In C-Dur: <b>C, Dm, Em, F, G, Am, Bm(b5)</b>.',
    'Warum immer gleich? Die Abstände sind in jeder Tonart gleich; die Halbtonschritte liegen zwischen 3 und 4 und zwischen 7 und 8. Namen ändern sich, <b>Funktionen und Abstände nicht</b>.'],
    g: [{ n: 'C', iv: '1 3 5', cap: 'Stufe 1' }, { n: 'Dm', iv: '1 b3 5', cap: 'Stufe 2' }, { n: 'Em', iv: '1 b3 5', cap: 'Stufe 3' }, { n: 'F', fr: PcKurs.FO, iv: '1 3 5', cap: 'Stufe 4' },
        { n: 'G', iv: '1 3 5', cap: 'Stufe 5' }, { n: 'Am', iv: '1 b3 5', cap: 'Stufe 6' }, { n: 'Bm(b5)', r: 11, fr: [null, 2, 3, 4, 3, null], iv: '1 b3 b5', cap: 'Stufe 7 (vermindert)' }],
    loop: [{ c: ['C', 'Dm', 'Em', 'F', 'G', 'Am'], fr: { F: PcKurs.FO }, bpm: 65, t: 'Stufen 1–6 in C-Dur' }],
    ex: ['E:Stufen-Reihe in C-Dur: C – Dm – Em – F – G – Am, je 2 Schläge, 60–70 BPM (Vorschlag). Geschafft, wenn du die Stufe 1–6 ohne Nachdenken nennst.'] },
  { id: 'k5-2', t: '5.2 Tonika, Subdominante, Dominante', p: [
    'Aus der Schule: <b>Tonika (I), Subdominante (IV), Dominante (V)</b>. Alle drei sind Dur-Akkorde.',
    '<b>I = zu Hause.</b>',
    '<b>IV = schwebend:</b> „ich kann hier bleiben, aber ich muss noch mal hin, aber ich bin noch nicht zu Hause“.',
    '<b>V = instabil, will heim.</b> In C-Dur: C = zu Hause, F = Subdominante, G = Dominante, „will nach Hause zum C“.',
    'Warum zieht die Dominante? G-Dur = G-B-D. Das <b>B ist einen Halbton vom C weg</b> – der <b>Leitton</b>. Das B will hoch zum C, das D will runter zum C.',
    'Spielst du <b>G7</b> (Dominantseptakkord, mit kleiner 7), kommt das F dazu. Es will einen Schritt runter zur Terz E von C. Drei ziehende Töne – „ganz schlimm“.',
    'In einer anderen Tonart hat ein anderer Akkord diesen Zug (in F-Dur z. B. C-Dur).'],
    m: '1 stabil, 4 schwebend („is floaty“), 5 instabil – will auf die Eins fallen.',
    g: [{ n: 'C', iv: '1 3 5' }, { n: 'G', iv: '1 3 5' }, { n: 'G7', iv: '1 3 5 b7', cap: 'kleine 7 (F) dazu' }],
    loop: [{ c: ['C', 'F', 'G', 'C'], fr: { F: PcKurs.FO }, bpm: 70, t: 'I – IV – V – I' }],
    ex: ['L:Hörvergleich: Spiele I, IV, V in C-Dur nacheinander und höre die Wirkung (zu Hause / schwebend / will heim).',
      'E:Dominante hören: C – F – G und dort anhalten, erst dann C. Danach G7 statt G: Der Zug wird noch stärker.'] },
  { id: 'k5-3', t: '5.3 Die Moll-Akkorde = Parallelen', p: [
    'Die drei Moll-Akkorde (Stufe 2, 3, 6) heißen <b>Parallelen</b>.',
    'Die <b>6 ist die Tonikaparallele</b>, „immer eine kleine Terz drunter“: C-Dur hat <b>A-Moll</b> als Parallele.',
    'Die <b>2 ist die Parallele der 4</b>, die <b>3 die Parallele der 5</b>.',
    'Heißt: <b>1 und 6, 4 und 2, 5 und 3</b> haben ähnliche Funktionen und lassen sich austauschen.',
    'Warum? A-C-E enthält schon zwei Drittel von C-Dur. In <b>Am7 (A-C-E-G)</b> bleibt ohne das A genau C-Dur (C-E-G) übrig.',
    'Die Akkorde sind „ineinander verschachtelt“ – der Lehrer nennt das <b>Upper Structure Triad</b>.'],
    m: '„Wenn der Zug im Ohr ist, ich will auf die 1, dann kann ich die 6 nehmen.“',
    g: [{ n: 'Am7', iv: '1 b3 5 b7' }, { n: 'C', iv: '1 3 5' }],
    ex: ['E:Am7 enthält C: Spiele Am7 und dann C und höre, dass die oberen Töne (C, E, G) gleich bleiben.'] },
  { id: 'k5-4', t: '5.4 Ersetzen im Spiel: 6 statt 1, 2 statt 4', p: [
    'Spiele in C-Dur erst <b>I-IV-V-I</b>, dann <b>VI-IV-V-VI</b>: Am – F – G – Am („ich lasse die 1 komplett weg“). Er nennt das scherzhaft <b>„die Maidens“</b>, weil Iron Maiden das oft benutzt.',
    'Eine <b>Kadenz</b> ist: stabil → floaty → instabil → zurück zu stabil (I-IV-V-I).',
    '<b>Sekundärdominanten</b> sind „Dominanten, die wir uns ausleihen“ – später wichtig für Akkorderweiterungen.',
    'Mischformen gehen auch: 6-4-5-1 oder 1-4-5-1. Die bekannte <b>1-6-4-5</b>: „1 ein bisschen länger über 6, ist immer noch nur 1, dann 4-5“.',
    '<b>4 gegen 2 tauschen:</b> statt C-F-G-C spielst du <b>C-Dm-G-C</b>. „Die Funktionen sind gleich.“ „Das ist eigentlich die Standardkadenz.“'],
    loop: [{ c: ['Am', 'F', 'G', 'Am'], fr: { F: PcKurs.FO }, bpm: 75, t: 'VI – IV – V – VI („die Maidens“)' },
           { c: ['C', 'Am', 'F', 'G'], fr: { F: PcKurs.FO }, bpm: 75, t: 'I – VI – IV – V' },
           { c: ['C', 'Dm', 'G', 'C'], bpm: 75, t: 'I – II – V – I' }],
    ex: ['L:Spiele VI-IV-V-VI statt I-IV-V-I („die Maidens“).', 'L:Spiele I-VI-IV-V.', 'L:Spiele I-II-V-I statt I-IV-V-I.',
      'E:I-IV-V-VI-Hörspiel: In C je eine Minute I-IV-V-I, VI-IV-V-VI, I-VI-IV-V und I-II-V-I spielen und dir merken, wo „zu Hause“ liegt.'] },
  { id: 'k5-5', t: '5.5 Jazz und Songwriting', p: [
    'Im <b>Jazz</b> ist nicht I-IV-V Standard, sondern <b>2-5-1</b> (II-V-I), meist mit vierstimmigen Akkorden.',
    'Man kann eine 2-5 auf die nächste 2-5 ziehen lassen – „es hört nie auf und irgendwann muss das auflösen“.',
    'Das kommt daher, dass man die 4 gegen die 2 tauschen kann.'],
    m: 'Songwriting-Tipp: „Ich will nicht auf dem Happy-4 landen – probiert mal die 2. Die 1 – probiert mal die 6, funktioniert meistens.“',
    g: [{ n: 'Dm7', iv: '1 b3 5 b7' }, { n: 'G7', iv: '1 3 5 b7' }, { n: 'Cmaj7', iv: '1 3 5 7' }],
    loop: [{ c: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'], bpm: 70, t: '2 – 5 – 1 in C' }],
    ex: ['L:Songwriting: Statt der „Happy-4“ die 2 probieren, statt der 1 die 6.', 'L:Probiere eine 2-5-1 aus.'] },
  { id: 'k5-6', t: '5.6 Die 3 und die 7', p: [
    'Die <b>3</b> (in C-Dur E-Moll) ist die Parallele zur 5. Sie zieht „ein bisschen, aber nicht so wirklich“.',
    'E-Moll ist der obere Dreiklang von <b>Cmaj7 (C-E-G-B)</b>.',
    'Die <b>7</b> ist der verminderte Akkord, in C-Dur <b>Bm7b5</b> („Moll 7 b5“). Statt einer Quinte hat er eine <b>verminderte Quinte (b5, Bart Simpson)</b> – „keine kleine Quinte“.',
    'Bauanleitung: 1-5-8 + kleine Terz (aus der großen Terz „eine runter“) + die 5 einen Halbton tiefer = <b>Moll-Akkord mit b5</b>.',
    'Funktion: Er hat Dominant-Charakter – „eigentlich ein G7 ohne den Grundton“.',
    '<b>Halbvermindert</b> = 1, kleine Terz, verminderte Quinte, dazu die kleine 7. <b>Vollvermindert</b> hat nur kleine Terzen (mit verminderter Septime) und ist komplett symmetrisch.',
    'In Pop und Rock ist ein Moll7b5 „sehr unwahrscheinlich“. „Man muss das wissen, man muss ihn können, aber funktionsmäßig verwendet man ihn sehr selten.“'],
    g: [{ n: 'Cmaj7', iv: '1 3 5 7' }, { n: 'Bm7b5', iv: '1 b3 b5 b7' }, { n: 'G7', iv: '1 3 5 b7' }],
    ex: ['E:Spiele G7 und danach Bm7b5 und vergleiche: Die Töne B, D, F kommen in beiden vor (G7 ohne Grundton).'] },
  { id: 'k5-7', t: '5.7 Bilanz: was oft und was selten ersetzt wird', p: [
    'I-IV-V-I immer. <b>1 gegen 6:</b> absolut. <b>2 gegen 4:</b> absolut (Standard).',
    'Die 3 seltener, eher nicht als Ersatz für die 5. Die 7 selten.',
    'Berühmte Folge <b>1-5-6-4</b> (<b>Axis of Awesome</b>) – in Folk, Punk, Pop und Rock; es gibt Videos dazu.',
    'Ähnlichkeiten: <b>6 ≈ 1, 2 ≈ 4, 3 ≈ 5</b> (aber mehr 1), <b>7 ≈ 5</b> mit Vorsicht.',
    'Ausblick: Bei der Dominante will er später die kleine 7 weglassen und stattdessen Sus4 oder andere Erweiterungen einsetzen.'],
    loop: [{ c: ['C', 'G', 'Am', 'F'], fr: { F: PcKurs.FO }, bpm: 80, t: '1 – 5 – 6 – 4 (Axis of Awesome)' }],
    ex: ['E:Spiele 1-5-6-4 in C (C – G – Am – F) und danach 6-4-1-5 (Am – F – C – G). Sage, welcher Akkord sich nach „zu Hause“ anfühlt.'] }
] });

// ===== Kapitel 6 – Sus- und Add-Akkorde =====
Object.assign(PcKurs.CH, { Esus4: [0, 2, 2, 2, 0, 0], Asus4: [null, 0, 2, 2, 3, 0], Dsus4: [null, null, 0, 2, 3, 3], Asus2: [null, 0, 2, 2, 0, 0], Dsus2: [null, null, 0, 2, 3, 0],
  Csus4: [null, 3, 3, 0, 1, 1], Gsus4: [3, null, 0, 0, 1, 3], Csus2: [null, 3, 0, 0, 1, 3], Cadd9: [null, 3, 2, 0, 3, 0], Gadd9: [3, 2, 0, 2, 0, 3] });
PcKurs.K.push({ t: 'Kapitel 6 – Sus- und Add-Akkorde', s: [
  { id: 'k6-1', t: '6.1 Was ist Sus?', p: [
    'Bisher: Powerchord, Intervalle und ihre Namen, Tonleiter, CAGED-Akkorde, Stufenakkorde. Jetzt „geht es wirklich ans Eingemachte“.',
    '<b>Sus = suspended</b>, also „schweben“ oder „aussetzen“. Es gibt <b>Sus2</b> und <b>Sus4</b>.',
    'Dur = 1 – große Terz – 5. Moll = 1 – kleine Terz – 5. <b>Sus = keine Terz</b>, „eine andere Art von Dreiklang“.',
    'Sus klingt nicht fröhlich oder traurig, sondern offener – und ist <b>kompatibler mit Verzerrung</b>.',
    '<b>Sus2</b> geht fast überall, „außer auf zwei Akkorden innerhalb der Tonleiter“.',
    '<b>Sus4</b> hat eine klare Funktion: Man nimmt sie gern auf der <b>5 (Dominante)</b>, um den Zug abzuschwächen.'],
    m: 'Schlüsselwort: „Anstatt der Drei“ – da ist eine 2 oder eine 4.',
    g: [{ n: 'A', iv: '1 3 5' }, { n: 'Asus2', iv: '1 2 5' }, { n: 'Asus4', iv: '1 4 5' }],
    ex: ['E:Spiele A, Asus2 und Asus4 nacheinander und sage jeweils die Formel: 1-3-5, 1-2-5, 1-4-5.'] },
  { id: 'k6-2', t: '6.2 Sus4 bauen', p: [
    '„Wenn ihr wisst, wo die 3 ist, dann ist es die 4.“ Ausgangspunkt: Powerchord 1-5-8 plus die 3.',
    'So wie aus Dur ein Moll wurde, machst du ein Sus4: <b>die 3 „killen“ und den kleinen Finger reinlegen</b> – aus der 3 wird eine 4.',
    'Bei <b>Esus4, Asus4, Dsus4</b> geht das ganz einfach, weil die Terz nur einmal vorkommt: die Terz je einen Bund hoch.',
    '<b>Csus4:</b> Im C-Griff gibt es zwei Terzen. Beide müssen gegen die 4 getauscht werden. „Die Terz muss bei einem Sus-Akkord ausgetauscht werden gegen die 4 oder die 2.“',
    '<b>Gsus4:</b> auch zwei Terzen. Meist <b>blockierst du die A-Saite</b> (Finger leicht auflegen). „Anstatt B habe ich C, das ist meine 4.“',
    '<b>Barré:</b> In E-Form und A-Form findest du über der 3 die 4 und setzt dort den Sus4-Finger. Bei der C-Form-Barré „geht das einfach nicht“, bei der G-Form nur mit viel Streckerei.'],
    m: '„Finde die 3, finde die 4.“ – „So spielt man ein Sus: man findet die Drei und tauscht sie aus.“',
    g: [{ n: 'Esus4', iv: '1 4 5' }, { n: 'Asus4', iv: '1 4 5' }, { n: 'Dsus4', iv: '1 4 5' }, { n: 'Csus4', iv: '1 4 5', cap: 'beide Terzen getauscht' },
        { n: 'Gsus4', iv: '1 4 5', cap: 'A-Saite blockiert' }, { n: 'Csus4', fr: [null, 3, 5, 5, 6, 3], iv: '1 4 5', cap: 'A-Form-Barré, 3. Bund' }],
    ex: ['L:Dur → Sus4: Terz-Finger weg, kleinen Finger auf die 4 legen.', 'L:Spiele Esus4, Asus4 und Dsus4 durch.'] },
  { id: 'k6-3', t: '6.3 Sus2 bauen', p: [
    '„Ich habe euch gezeigt, wo die 3 ist, dann wisst ihr doch, wo die 2 ist.“',
    'Beim E-Dur liegt die 2 unter der b3. Auf der G-Saite geht das nicht – es wäre tiefer als die leere Saite.',
    'Wichtige Regel: „In welcher Oktave das ist, ist egal. <b>Solange keine 3 drin ist, aber die 2 oder 4, ist es ein Sus-Akkord.</b>“',
    '<b>Asus2:</b> „Was ist unter der b3? Die 2. Finger weg = Asus2.“',
    '<b>Dsus2:</b> Mittelfinger weg, die leere Saite klingt.',
    'Beispiel aus Songs: Bei Bon Jovi steht im Notentext D, Dsus4, D, Dsus2, D. Das ist „super einfach“.'],
    m: 'Reihenfolge der Töne: 4 – 3 – b3 – 2 (von Sus4 über Dur und Moll zu Sus2, jeweils tiefer).',
    g: [{ n: 'D', iv: '1 3 5' }, { n: 'Dsus4', iv: '1 4 5' }, { n: 'Dsus2', iv: '1 2 5', cap: 'Mittelfinger weg' }, { n: 'Asus2', iv: '1 2 5', cap: 'Finger weg' }],
    loop: [{ c: ['D', 'Dsus4', 'D', 'Dsus2'], bpm: 70, t: 'D – Dsus4 – D – Dsus2' }],
    ex: ['L:Asus2: Finger auf der b3 weg. Dsus2: Mittelfinger weg.', 'L:Wechselmuster D – Dsus4 – D – Dsus2 – D.',
      'E:Dur/Sus2/Sus4-Wechsel auf A, D, E: je 4 Schläge Dur – Sus4 – Dur – Sus2 (beim E nur Sus4), etwa 70 BPM (Vorschlag). Geschafft, wenn du vorher sagst, welcher Finger wandert.'] },
  { id: 'k6-4', t: '6.4 Sus2 als „Ear Candy“ für Verzerrung', p: [
    'Sus2 hat neutralen Charakter, „wunderbar für verzerrte Akkorde“. Zur Würze: „bisschen Zucker drauf“ – <b>Ear Candy</b>.',
    'Statt eines Powerchords: <b>Powerchord + die 2</b>. Beim A: Powerchord auf A und die oberen Saiten offen – „klingt fast nie falsch“. Beim D den Mittelfinger weg = Dsus2. Beim E „macht man das eigentlich nicht“.',
    '<b>Powerchord + Barré der oberen Saiten:</b> „Das ist einfach überall geil.“ Auf der A-Saite einfach, auf der E-Saite schwieriger.',
    'Ohne Strecken: <b>statt 1-5-8 spielst du 1-5-9</b>. Verzerrt „auch geil“.'],
    g: [{ n: 'Asus2', iv: '1 2 5', cap: 'Powerchord A + offene Saiten' }, { n: 'Csus2', fr: [null, 3, 5, 5, 3, 3], iv: '1 2 5', cap: 'Powerchord + Barré oben' },
        { n: 'C 1-5-9', r: 0, fr: [null, 3, 5, 7, null, null], nine: true, iv: '1 5 9', cap: 'statt der 8 die 9' }],
    ex: ['L:Powerchord + 2 mit offenen oberen Saiten auf A und D; Powerchord mit Barré der oberen Saiten.',
      'E:Spiele mit Verzerrung erst C5 (A-Saite 3. Bund), dann Csus2 mit Barré oben, dann 1-5-9. Höre, was die 2 dazugibt.'] },
  { id: 'k6-5', t: '6.5 Auf welchen Stufen geht Sus2?', p: [
    'Überall, wo der Akkord eine (große) 2 hat. In C-Dur: Csus2 geht (D).',
    '<b>E-Moll (Stufe 3)</b> hat keine 2, sondern eine <b>b2</b> (E–F ist ein Halbton). Ein Sus2 wäre dort tonartfremd: „Ihr könnt natürlich Regeln brechen und wild sein“, aber „ihr bleibt dann nicht in der Tonart“.',
    'Stufe 4 (F): die 2 ist G – geht. Stufe 5 (G): A – geht. Stufe 6 (Am): B – „wunderbar“.',
    '<b>Stufe 7 (Bm b5):</b> B–C ist ein Halbton – geht nicht.',
    'Eine b2 bzw. b9 nur „mit sehr viel Vorsicht“.'],
    m: '„Auf der 3 und der 7 darf man die 2 nicht verwenden. Ihr dürft schon, aber ihr seid gewarnt.“',
    ex: ['L:Sus-Tonart-Check: Prüfe für jede Stufe, ob ihre 2 in der Tonart liegt.',
      'E:Stufen-Check in C-Dur: Nenne für C, Dm, Em, F, G, Am, Bm7b5 die 2 (D, E, F, G, A, B, C) und prüfe, ob sie einen Ganzton über dem Grundton liegt. Geschafft, wenn du sagst: „3 und 7 nicht“.'] },
  { id: 'k6-6', t: '6.6 Sus4: die Dominante schwächen', p: [
    'Die 4 hat „wichtigere Positionen“: <b>Sus4 schwächt die Dominantfunktion der 5.</b>',
    'Beispiel C-Dur: Spiele <b>Gsus4 statt G</b>. Das D will aufs C, das B will aufs C – im Gsus4 liegt die 4 (C) schon da. „Ich bin schon auf dem C.“ Der Halbton-Zug ist weg.',
    'Der Sus4 „möchte auf die Dur-Variante von sich selbst“: <b>Gsus4 → G</b>.',
    '<b>Spannung aufbauen:</b> erst mit Sus4 Spannung rausnehmen, dann kommt der Dur-Akkord, und mit der kleinen 7 (G7) „sagt jeder: der muss nach Hause“.',
    'Am häufigsten nimmt man Sus4 genau auf der 5.',
    'Auf der 2 (Dm) hat Sus4 diesen Charakter nicht. Auf der 1 (Csus4): Dur-Charakter weg, „offene Weite“, „monoton, stabil, aber ich geh in die Weite“.'],
    m: '„Ihr seid diejenigen, die sagen, wo es langgeht und was der Zuhörer erwartet.“',
    g: [{ n: 'Gsus4', iv: '1 4 5' }, { n: 'G', iv: '1 3 5' }, { n: 'G7', iv: '1 3 5 b7' }],
    loop: [{ c: ['C', 'Gsus4', 'G', 'G7'], bpm: 70, t: 'Gsus4 → G → G7 → (C)' }, { c: ['C', 'Csus4', 'C', 'Gsus4', 'G', 'C'], bpm: 70, t: 'Dominante abschwächen' }],
    ex: ['L:Höre Gsus4 → G und spiele Gsus4 – G – G7 für Spannung.',
      'E:Dominante abschwächen in C-Dur: C – Csus4 – C – Gsus4 – G – C. Geschafft, wenn du hörst: Gsus4 zieht weniger als G.'] },
  { id: 'k6-7', t: '6.7 Auf welchen Stufen geht Sus4?', p: [
    '<b>Nicht auf der 4. Stufe:</b> Über F liegt als 4 ein B-flat – „den gibt es nicht in C-Dur“. Es klingt, als wärst du plötzlich in F-Dur.',
    'Auf der 4. Stufe wäre die <b>übermäßige Quarte (#4 = #11)</b> richtig. Das ist kein Sus-Akkord, sondern ein „cooler Akkord“: Klang „Sternenhimmel, Weite“, wie bei John Williams (Star Wars) – „ich komm nicht nach Hause, aber ich will ja nicht nach Hause“.',
    'Regelbruch: Eddie Van Halen schiebt auf der 4. Stufe trotzdem Sus4 und Dur hin und her – „irgendwie funktioniert das“.',
    'Zusammenfassung: <b>Sus2</b> ist super für Verzerrung und schwächt Dur/Moll ab. <b>Sus4 auf der 5</b> schwächt die Dominante und zieht auf die Dur-Version der 5. Sus2 auf 3 und 7 vermeiden („haben b2, klingt kacke“).'],
    m: '„Die 4 überall verwenden außer auf der 4. Stufe.“',
    ex: ['L:Sus-Tonart-Check: Prüfe für jede Stufe, ob ihre 4 in der Tonart liegt (in C-Dur fällt F mit B-flat heraus).',
      'E:Spiele in C-Dur Csus4, Dsus4, Gsus4 und dann Fsus4 und höre, warum Fsus4 nach einer anderen Tonart klingt.'] },
  { id: 'k6-8', t: '6.8 Add9 und Add11 – Extensions', p: [
    '<b>Ohne Terz</b> sind 2 und 4 wichtige Akkordtöne: 1-2-5 oder 1-4-5.',
    '<b>Mit Terz</b> hörst du Dur oder Moll. Kommt eine 2 oder 4 dazu, ändert das fast nichts am Charakter. Dann heißen sie <b>9 oder 11</b> – Akkorderweiterungen (Extensions): „außer dass sie schön sind, nicht wirklich irgendwas zu melden“.',
    '<b>Cadd9:</b> Im C-Griff liegt auf der B-Saite ein zweites C. Spiele stattdessen die 2 (D) – „weil ich hier die Terz hab“. „Ändert an meinem C gar nichts, ist immer noch ein C.“',
    '<b>Gadd9:</b> statt eines zweiten G ein A. „Ich nenne es nicht 2, weil ich Terzen drin habe“ – add heißt dazu addieren. „Ich klinge immer noch nach einem Dur-Akkord.“',
    '<b>E-Moll mit 9:</b> Die Moll-Terz bleibt, die 9 kommt oben dazu – „nicht E-Moll2, sondern E-Moll9, weil diese 2 einfach nur eine schöne Note ist“.',
    'Methode: „Gucken, wo die 3 ist, verschieben, gucken wo die 1 ist.“',
    '<b>Vorsicht b9:</b> E unten, F oben = b9 („Oktave und Halbtonschritt“). Sein Arrangierlehrer: „That’s kaka, flat nine party.“ Regel: <b>keine b9, außer sie wird ausdrücklich verlangt.</b>'],
    g: [{ n: 'Cadd9', nine: true, iv: '1 3 5 9', cap: 'B-Saite: D statt C' }, { n: 'Csus2', iv: '1 2 5', cap: 'ohne Terz = Sus' },
        { n: 'Gadd9', nine: true, iv: '1 3 5 9', cap: 'Standardgriff' }, { n: 'Em(add9)', r: 4, fr: [0, 2, 2, 0, 0, 2], nine: true, iv: '1 b3 5 9', cap: 'Standardgriff' }],
    ex: ['L:Spiele C-add9 und G-add9.', 'L:Spiele E-Moll mit 9.',
      'E:Add9 statt Sus: Spiele Cadd9 und Csus2 nacheinander. Geschafft, wenn du hörst: Cadd9 klingt noch nach Dur, Csus2 neutral.'] },
  { id: 'k6-9', t: '6.9 Add9 im Barré', p: [
    'E-Form-Barré: <b>1-5-8 + große Terz, aus der 8 eine 9</b> (nicht b9) = <b>C-add9</b>. „Klingt supergeil, bisschen stressig zu spielen.“',
    '<b>Als Moll:</b> die Terz klein – 1-5-9-kleine Terz, „so viel einfacher“.',
    'Pointe bei The Police („Message in a Bottle“): „Jeder Schlaue müsste sagen: wo sind die Dur-/Moll-Terzen? Das sind keine Neuner, das waren alles Sus2.“'],
    g: [{ n: 'Cadd9', fr: [8, 10, 12, 9, 8, 8], nine: true, iv: '1 3 5 9', cap: 'E-Form, 8. Bund' }, { n: 'Cm(add9)', r: 0, fr: [8, 10, 12, 8, 8, 8], nine: true, iv: '1 b3 5 9', cap: 'E-Form Moll' }],
    ex: ['E:Greife C (E-Form, 8. Bund), mache aus der 8 auf der D-Saite eine 9 und dann die Terz klein. Vergleiche Cadd9 und Cm(add9).'] },
  { id: 'k6-10', t: '6.10 Add11', p: [
    '„Kann ich hier irgendwo eine 11 reinmachen?“ Wird aus der 3 eine 4, ist die Terz weg – dann ist es ein Sus-Akkord. „Ich möchte keinen Sus-Akkord, ich möchte einen Elf.“',
    'Eine 11 mit Terz tief unten wird „ziemlich matschig“. <b>Erweiterungen sind besser verdaulich, wenn sie höher liegen.</b>',
    'Lösung: Die Terz bleibt, die <b>Quinte gibst du auf</b> („ich spare die 5“). Der Zeigefinger ist frei und greift mit einem „bösen Strecker“ zwei Bünde tiefer die 4 (die 11). Die A-Saite blockieren. Am schönsten arpeggiert.',
    'Als Moll: <b>Am(add11)</b> – die Quinte kann weg, „die füllt nur“. Mit kleiner 7 wird es <b>Am7(11)</b>: „klingt super kompliziert, viel einfacher zu spielen als der andere“.'],
    g: [{ n: 'Am7(11)', r: 9, fr: [null, 0, 0, 0, 1, 0], nine: true, iv: '1 b3 5 b7 11', arp: true, cap: 'Standardgriff (offen)' }],
    ex: ['L:Spiele A-Moll 7 11 (Am7(11)).', 'E:Zupfe Am7(11) einzeln von tief nach hoch und sage die Zahlen 1, 11, b7, b3, 5.'] },
  { id: 'k6-11', t: '6.11 Beispiel: Joe Satriani – „Always with me, always with you“', p: [
    '„Ein Meisterwerk des einfachen Liedes, geil arrangiert“: im Grunde <b>I-IV-V-I in B-Dur</b>.',
    'Er schwächt die 4 zur <b>Sus4</b>, nimmt die <b>6 (Moll) statt der 1</b>, dann wieder 4 und Sus4, und ganz am Ende geht er auf die <b>Dominante als Dur</b>.',
    'Statt der 1 spielt er B-Dur mit 11 – „wie wir es eben umgesetzt haben“. Später kommen Fis-Sus4 und Gis-Moll 7 11 („genau den Akkord, den wir eben hatten“).',
    '„Er macht genau das, was ich gesagt habe.“ Aus einer „super billigen 1-4-5-1“ wird eines der meistgeliebten Instrumentals der E-Gitarrenwelt.'],
    m: '„Sus-Akkorde sind keine Scheiße.“',
    ex: ['E:Hör dir „Always with me, always with you“ an und achte darauf, wo statt der 1 die 6 (Moll) kommt und wo eine Sus4 die 4 abschwächt.'] }
] });

// ===== Kapitel 7 – 7er-Akkorde =====
Object.assign(PcKurs.CH, { E7: [0, 2, 0, 1, 0, 0], Amaj7: [null, 0, 2, 1, 2, 0], A7: [null, 0, 2, 0, 2, 0], Dmaj7: [null, null, 0, 2, 2, 2], D7: [null, null, 0, 2, 1, 2],
  Gmaj7: [3, 2, 0, 0, 0, 2], C7: [null, 3, 2, 3, 1, 0] });
PcKurs.AL = { Am7: [5, null, 5, 5, 5, null], D7: [null, 5, 7, 5, 7, 5], Gmaj7: [3, null, 4, 4, 3, null], Cmaj7: [null, 3, 5, 4, 5, 3], 'F#m7b5': [2, null, 2, 2, 1, null], B7: [null, 2, 4, 2, 4, 2], Em7: [0, null, 0, 0, 0, null] };
PcKurs.K.push({ t: 'Kapitel 7 – 7er-Akkorde', s: [
  { id: 'k7-1', t: '7.1 Einstieg: die zwei Siebenen', p: [
    'Rückblick: Barré-Akkorde, Sus und Add. Jetzt geht es um „die Sieben“.',
    'Wiederholung Akkordsymbole: <b>nur die Zahl 7 = kleine 7</b>; die große heißt <b>Major 7 / M7 / Dreieck7</b>. Er sagt in dieser Lektion deshalb immer extra „kleine Sieben“ und „große Sieben“.',
    'Reihenfolge: <b>erst die 7er in offenen Akkorden, dann im Barré</b>. Drop-2- und Drop-3-Voicings und Umkehrungen kommen in der nächsten Lektion – „Barré-Akkorde sind eigentlich schon Drops“.'],
    ex: ['E:Sage zu C7, Cmaj7, CM7 und Cm7, welche 7 drin ist und ob die Terz groß oder klein ist.'] },
  { id: 'k7-2', t: '7.2 Welche 7 gehört auf welche Stufe?', p: [
    'Es geht um die Akkorde in einer Dur-Tonleiter: Dur, Moll, Moll, Dur, Dur, Moll, halbvermindert; Abstände 2-2-1-2-2-2-1.',
    '<b>Halbvermindert:</b> kleine Terz, kleine Terz, dann große Terz – ein Moll-Akkord mit verminderter Quinte, aber kleiner 7. <b>Vollvermindert</b> ist symmetrisch, nur kleine Terzen – „das interessiert jetzt aber nicht“.',
    'In C-Dur zählt er <b>von der 8 rückwärts</b>:',
    '<b>Stufe 1 (C):</b> Der Ton unter der 8 ist nur einen Halbton entfernt (B–C) → große 7 → <b>Cmaj7</b>.',
    '<b>Stufe 2 (D):</b> Unter D liegt C, zwei Halbtöne → kleine 7 → <b>Dm7</b>.',
    '<b>Stufe 3 (E):</b> Unter E liegt D, zwei Halbtöne → kleine 7 → <b>Em7</b>.',
    '<b>Stufe 4 (F):</b> Unter F liegt E, ein Halbton → große 7 → <b>Fmaj7</b>.',
    'Die übrigen Stufen haben eine kleine 7: <b>G7, Am7, Bm7b5</b>.',
    'Leider auswendig: 2-2-1-2-2-2-1; Dur-Moll-Moll-Dur-Dur-Moll-halbvermindert; A bis G; 1 bis 7; 1, 4, 5, 8 rein, 2, 3, 6, 7 groß/klein; Bart Simpson. Vieles andere „könnt ihr euch ableiten – wir sind hier Ableiter, nicht Harmonie-Lerner“.'],
    m: '„Einfach gucken, wo die Halbtonschritte sind: E–F und B–C. Der Ton drüber hat eine große 7. Auf der ersten und vierten Stufe, in jeder Tonart, eine große 7, alle anderen haben eine kleine.“',
    g: [{ n: 'Cmaj7', iv: '1 3 5 7', cap: 'I' }, { n: 'Dm7', iv: '1 b3 5 b7', cap: 'II' }, { n: 'Em7', iv: '1 b3 5 b7', cap: 'III' }, { n: 'Fmaj7', iv: '1 3 5 7', cap: 'IV' },
        { n: 'G7', iv: '1 3 5 b7', cap: 'V' }, { n: 'Am7', iv: '1 b3 5 b7', cap: 'VI' }, { n: 'Bm7b5', iv: '1 b3 b5 b7', cap: 'VII' }],
    loop: [{ c: ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5'], bpm: 60, t: 'Stufen-7er in C-Dur' }],
    ex: ['L:Leite pro Stufe von C-Dur die 7 ab: von der 8 aus rückwärts zählen, auf E–F und B–C achten.',
      'E:Stufen-7er in C-Dur: Cmaj7 – Dm7 – Em7 – Fmaj7 – G7 – Am7 – Bm7b5, je 4 Schläge, 60 BPM (Vorschlag), und sage jeweils den Typ. Geschafft, wenn du vorher weißt, welche Stufe eine große 7 hat.'] },
  { id: 'k7-3', t: '7.3 Offene Akkorde mit 7', p: [
    '„Nicht super relevant … damit könnte man bestimmt 100 Songs spielen, wir machen es trotzdem.“',
    'Grundprinzip: Powerchord 1-5-8. <b>Direkt unter der 8 liegt die große 7, zwei Halbtöne unter der 8 die kleine 7.</b>',
    '<b>E:</b> Die große 7 direkt unter der 8 ist „zu tief, matschig“ (Low Interval Limits). Aus der 8 die kleine 7 = <b>E7</b>: „der ist geil und den kennt man auch“.',
    '<b>A:</b> „Was hier zu tief war, ist jetzt eine Quarte höher und klingt besser.“ <b>Amaj7:</b> 8 → große 7. <b>A7:</b> Finger weg, offene Saite – zwei Halbtöne unter der 8.',
    '<b>D:</b> dasselbe Prinzip – die 8 auf der B-Saite einen Halbton tiefer (Dmaj7) bzw. zwei Halbtöne tiefer (D7).',
    '<b>Moll:</b> <b>Em7</b> mit dem kleinen Finger oben, weil es unten zu matschig wäre. Moll mit großer 7 gibt es auch – „wer braucht’s? Ich nicht“. <b>Am7:</b> Finger weg (offene Saite) oder den kleinen Finger oben auf die kleine 7 – „vielleicht schöner mit der 7 oben“, jetzt vierstimmig. <b>Dm7:</b> 2 Halbtöne unter der 8.',
    '<b>G:</b> Die 8 oben einen Halbton tiefer = <b>Gmaj7</b>, noch einen tiefer = <b>G7</b> („den spielt man relativ früh“).',
    '<b>C:</b> Cmaj7 (Finger auf der B-Saite weg). <b>C7:</b> die kleine 7 mit dem kleinen Finger dazu. „C7 ist automatisch die Dominante, die 5 von F.“',
    'Fazit: „Offene Akkorde abgehakt, … damit geht eben nicht alles.“'],
    g: [{ n: 'E7', iv: '1 3 5 b7' }, { n: 'Amaj7', iv: '1 3 5 7' }, { n: 'A7', iv: '1 3 5 b7' }, { n: 'Dmaj7', iv: '1 3 5 7', cap: 'Standardgriff' }, { n: 'D7', iv: '1 3 5 b7', cap: 'Standardgriff' },
        { n: 'Em7', iv: '1 b3 5 b7' }, { n: 'Am7', iv: '1 b3 5 b7' }, { n: 'Am7', fr: [null, 0, 2, 2, 1, 3], iv: '1 b3 5 b7', cap: '7 oben, vierstimmig' }, { n: 'Dm7', iv: '1 b3 5 b7' },
        { n: 'Gmaj7', iv: '1 3 5 7' }, { n: 'G7', iv: '1 3 5 b7' }, { n: 'Cmaj7', iv: '1 3 5 7' }, { n: 'C7', iv: '1 3 b7', cap: 'ohne Quinte' }],
    ex: ['L:Spiele die offenen Akkorde mit 7 durch Ableiten: E7, Amaj7/A7, Dmaj7/D7, Em7, Am7, Dm7, Gmaj7/G7, Cmaj7/C7.',
      'E:Offene 7er-Paare: je 4 Schläge Maj7 – 7 – Dur, z. B. Cmaj7 ↔ C7, Gmaj7 ↔ G7, Amaj7 ↔ A7, Dmaj7 ↔ D7. Geschafft, wenn du hörst: Maj7 klingt weich, 7 „zieht“.'] },
  { id: 'k7-4', t: '7.4 Die 7 als Terzschichtung – und Tonart erkennen', p: [
    'Die 7 ist eine <b>Terz-Erweiterung</b>: Akkorde bauen sich in Terzen auf.',
    '<b>Major 7</b> = 1, große Terz, kleine Terz, große Terz.',
    '<b>Dominant 7</b> = 1, große Terz, kleine Terz, kleine Terz – das gibt es nur auf der 5. Stufe.',
    '<b>Moll 7</b> = 1, kleine Terz, große Terz, kleine Terz.',
    '„Wir haben drei Dur-Akkorde: 1, 4, 5. <b>1 und 4 haben große 7, nur die 5 ist ein Dur-Akkord mit kleiner 7.</b>“ Der Fachbegriff ist Dominantseptakkord.',
    '<b>Tonart erkennen:</b> Siehst du ein X7-Dur, ist es meist die 5 von etwas: D7 → 5 von G → wahrscheinlich G-Dur. Es7 → 5 von As.',
    'Ausnahmen: Blues (alles Dominant-7), Jazz, Sekundärdominanten. „Ja, aber was ich gesagt hab, stimmt schon.“'],
    ex: ['E:Dominante erkennen: Nenne zu D7, G7, C7, A7, E7 die Tonart (G, C, F, D, A). Geschafft, wenn du „5 von …“ sofort sagst.'] },
  { id: 'k7-5', t: '7.5 7er im Barré: Grundton A-Saite', p: [
    'Barré baust du wie in Kapitel 4. „Die Töne sind irrelevant, es gilt für alles.“',
    '<b>Maj7:</b> 1-5-8 – „hier ist die 8, die Major 7 ist eins drunter“. Finger umsetzen → <b>Cmaj7</b>, ein „typischer Standard-Jazz-Akkord“.',
    '<b>Dominant 7:</b> Die kleine 7 liegt noch einen Halbton darunter; vorne den Finger flach legen → <b>C7</b>.',
    '<b>Moll 7:</b> „sieht aus wie ein A-Moll, nur verschoben“. Statt Dur-Terz die Moll-Terz → <b>Cm7</b>. „Nix Kompliziertes.“',
    '<b>Halbvermindert (m7b5):</b> die Quinte einen Halbton tiefer. Als Barré „total bescheuert“ – greife <b>alle vier Noten</b>: Zeigefinger auf den Grundton, ein Finger einen Bund höher auf der D-Saite, der kleine Finger zwei Saiten höher im selben Bund. Die E-Saite ist nicht dabei.',
    'Töne von tief nach hoch: <b>1, b5, kleine 7, kleine 3</b>.',
    '„Das sind die Akkorde auf der A-Saite, und das sind Drop 2s“ – das ist die nächste Lektion.'],
    g: [{ n: 'Cmaj7', fr: [null, 3, 5, 4, 5, 3], iv: '1 3 5 7' }, { n: 'C7', fr: [null, 3, 5, 3, 5, 3], iv: '1 3 5 b7' },
        { n: 'Cm7', fr: [null, 3, 5, 3, 4, 3], iv: '1 b3 5 b7' }, { n: 'Cm7b5', fr: [null, 3, 4, 3, 4, null], iv: '1 b3 b5 b7', cap: '1, b5, b7, b3' }],
    ex: ['L:Leite die Barré-Reihe aus einem Grundgriff ab (Grundton A-Saite): Dur → Maj7 → 7 → Moll7 → m7b5, „damit man sieht, wie sich was verschiebt“.',
      'E:Ein Grundton, vier Typen: Grundton C (A-Saite 3. Bund): Cmaj7 – C7 – Cm7 – Cm7b5, je 2 Schläge, jeden Typ aus dem vorigen umbauen. Geschafft, wenn du kein Griffbild suchen musst.'] },
  { id: 'k7-6', t: '7.6 7er im Barré: Grundton D-Saite', p: [
    '„Genau dasselbe wie das hier, nur durch den Versatz der B-Saite müssen wir hier einen höher machen.“',
    '<b>D-Shape:</b> Maj7 = aus der 8 die Major 7. Dann wie auf der A-Saite weiter: kleine 7, Moll-Terz, und für halbvermindert die Quinte einen Halbton tiefer.'],
    m: '„Man lernt nicht vier Akkordbilder. Das ist bescheuert. Lernt das Akkordbild und dann die Variation.“',
    g: [{ n: 'Fmaj7', fr: [null, null, 3, 5, 5, 5], iv: '1 3 5 7' }, { n: 'F7', fr: [null, null, 3, 5, 4, 5], iv: '1 3 5 b7' },
        { n: 'Fm7', fr: [null, null, 3, 5, 4, 4], iv: '1 b3 5 b7' }, { n: 'Fm7b5', fr: [null, null, 3, 4, 4, 4], iv: '1 b3 b5 b7' }],
    ex: ['L:Leite die Reihe auf der D-Saite ab: Maj7 → 7 → Moll7 → m7b5, und sieh dir an, wie sich was verschiebt.',
      'E:Spiele die Reihe auf der A-Saite (Grundton C) und direkt danach auf der D-Saite (Grundton F). Sage, welcher Ton sich bei jedem Schritt bewegt.'] },
  { id: 'k7-7', t: '7.7 7er im Barré: Grundton tiefe E-Saite (Drop 3)', p: [
    'Problem: Eine Major 7 auf der tiefen Saite ist matschig.',
    'Lösung: <b>die Quinte weglassen</b> („Sorry Quinte, kein Platz hier“) – sie liegt oben auf der B-Saite schon. Der Zeigefinger liegt auf dem Grundton und blockiert die Saiten, die nicht klingen sollen.',
    'Wirkung: „Das erste Intervall ist Grundton zu Major 7 … sehr viel Freiraum geschaffen.“ Schön gezupft.',
    '<b>Dominant 7:</b> „Da war die 8, dann die große 7, dann die kleine 7.“',
    '<b>Moll 7:</b> große Terz → kleine Terz.',
    '<b>Halbvermindert:</b> Die Quinte muss einen Halbton tiefer – „mit dem kleinen Finger physikalisch nicht möglich“. Also Finger umschichten, dann ist der kleine Finger frei für den Halbton tiefer.',
    'Reihenfolge zum Ableiten: <b>Major 7 → Dominant 7 → m7 → m7b5.</b> A-Saite und hohe e-Saite klingen nicht mit – „sehr klar, weil hier unten Platz ist“.',
    'Der Name dieser Griffe: <b>Drop 3</b> – Erklärung in der nächsten Lektion.',
    'Jazz-Tipp: „Nehmt euch Blue Bossa, Autumn Leaves, All of Me und versucht die Akkorde zu spielen.“'],
    g: [{ n: 'Gmaj7', fr: [3, null, 4, 4, 3, null], iv: '1 3 5 7' }, { n: 'G7', fr: [3, null, 3, 4, 3, null], iv: '1 3 5 b7' },
        { n: 'Gm7', fr: [3, null, 3, 3, 3, null], iv: '1 b3 5 b7', cap: 'alles in einem Bund' }, { n: 'Gm7b5', fr: [3, null, 3, 3, 2, null], iv: '1 b3 b5 b7' }],
    ex: ['L:Leite die Reihe auf der tiefen E-Saite ab: Major 7 → Dominant 7 → m7 → m7b5.', 'L:Nimm dir Jazz-Standards vor: Blue Bossa, Autumn Leaves, All of Me.',
      'E:Spiele Gmaj7 – G7 – Gm7 – Gm7b5 je 2 Schläge und schlage nach jedem Griff die A- und die hohe e-Saite an: Sie müssen still sein.'] },
  { id: 'k7-8', t: '7.8 Anwendung: „Autumn Leaves“', p: [
    '„Mit diesen Akkorden könnt ihr jetzt Jazz-Standards spielen.“',
    'Anfang von Autumn Leaves: <b>Am7 (Grundton E-Saite) – D7 (Grundton A-Saite) – Gmaj7 – Cmaj7 – F#m7b5 – B7 – Em7</b>. B7 ist eine Sekundärdominante.',
    'Man wechselt oft in Quinten oder Quarten. <b>Am7–D7–Gmaj7 = 2-5-1</b>: „451 gibt’s da eigentlich nicht, es gibt 251.“',
    'Weil du nicht im Barré spielst, ist der Zeigefinger frei – so kannst du kleine <b>Basslinien</b> einbauen. „Wenn ihr nur das könnt, könnt ihr bei euren Kollegen auftrumpfen.“',
    'Später kannst du auch die Melodie auf den Akkordtönen mitspielen (Chord-Melody).',
    'Schlussaussage: „Ihr sollt die nicht vom Blatt lernen, <b>ihr sollt sie ableiten können</b>. Ihr sollt wissen, was da passiert.“',
    'Ausblick: nächste Lektion Drop 2 und alle Umkehrungen.'],
    g: ['Am7', 'D7', 'Gmaj7', 'Cmaj7', 'F#m7b5', 'B7', 'Em7'].map(n => ({ n, fr: PcKurs.AL[n], iv: /maj7/.test(n) ? '1 3 5 7' : /m7b5/.test(n) ? '1 b3 b5 b7' : /m7/.test(n) ? '1 b3 5 b7' : '1 3 5 b7' })),
    loop: [{ c: ['Am7', 'D7', 'Gmaj7', 'Cmaj7', 'F#m7b5', 'B7', 'Em7', 'Em7'], fr: PcKurs.AL, bpm: 60, t: 'Anfang, je ein Takt' }],
    ex: ['L:Spiele den Anfang von Autumn Leaves: Am7 – D7 – Gmaj7 – Cmaj7 – F#m7b5 – B7 – Em7.', 'L:Baue mit dem freien Zeigefinger kleine Basslinien ein.',
      'E:Autumn-Leaves-Loop: die Akkorde 4-mal hintereinander, 50–60 BPM (Vorschlag), danach zwischen den Akkorden Grundton und Quinte als Basstöne zupfen.'] }
] });
