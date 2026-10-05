// ---- Lick-Bibliothek: Töne als [Saite (0 = tiefes E … 5 = hohes e), Bund relativ zum Grundton-Bund auf der E-Saite,
// Länge in Achteln, Technik] – b = Bending (Ganzton), h = Hammer-on, p = Pull-off, s = Slide, v = Vibrato.
// base: 'min' = Grundton ist die Moll-Tonika (in Dur: die Parallele), 'maj' = Dur-Tonika. Wird in jede Tonart versetzt.
const Licks = (() => {
  const SCALE = {
    pmin: { n: 'Moll-Pentatonik', iv: [0, 3, 5, 7, 10] }, blues: { n: 'Blues-Tonleiter', iv: [0, 3, 5, 6, 7, 10] },
    pmaj: { n: 'Dur-Pentatonik', iv: [0, 2, 4, 7, 9] }, dblues: { n: 'Dur-Blues', iv: [0, 2, 3, 4, 7, 9] },
    dor: { n: 'Dorisch', iv: [0, 2, 3, 5, 7, 9, 10] }, mix: { n: 'Mixolydisch', iv: [0, 2, 4, 5, 7, 9, 10] },
    aeo: { n: 'Äolisch', iv: [0, 2, 3, 5, 7, 8, 10] }, amin: { n: 'Moll-Arpeggio', iv: [0, 3, 7] }, amaj: { n: 'Dur-Arpeggio', iv: [0, 4, 7] },
    hm: { n: 'Harmonisch Moll', iv: [0, 2, 3, 5, 7, 8, 11] }
  };
  const L = [
    { id: 'rock1', name: 'Rock-Opener', scale: 'pmin', base: 'min', tip: 'Der Klassiker: von oben abwärts, Bending auf der G-Saite zur Quinte, Vibrato auf dem Grundton.',
      n: [[5, 3, 1], [5, 0, 1], [4, 3, 1], [4, 0, 1], [3, 2, 2, 'b'], [3, 0, 1], [2, 2, 3, 'v']] },
    { id: 'rock2', name: 'Bending-Ruf', scale: 'pmin', base: 'min', tip: 'Ruf und Antwort: das Bending stellt die Frage, der Abgang zum Grundton antwortet.',
      n: [[3, 2, 2, 'b'], [4, 3, 1], [4, 0, 1], [3, 2, 1], [3, 0, 1], [2, 2, 3, 'v']] },
    { id: 'rock3', name: 'Absteigende Dreier', scale: 'pmin', base: 'min', tip: 'Dreiergruppen über gerade Achtel – verschiebt den Akzent und klingt nach mehr Tempo, als es ist.',
      n: [[5, 3, 1], [5, 0, 1], [4, 3, 1], [5, 0, 1], [4, 3, 1], [4, 0, 1], [4, 3, 1], [4, 0, 1], [3, 2, 1], [4, 0, 1], [3, 2, 1], [3, 0, 2, 'v']] },
    { id: 'rock4', name: 'Tiefer Riff-Lauf', scale: 'pmin', base: 'min', tip: 'Für tiefe Lagen: Hammer-ons auf den Basssaiten, endet auf der Oktave.',
      n: [[0, 0, 1], [0, 3, 1, 'h'], [1, 0, 1], [1, 2, 1, 'h'], [2, 0, 1], [2, 2, 3, 'v']] },
    { id: 'blues1', name: 'Blue-Note-Slide', scale: 'blues', base: 'min', tip: 'Die ♭5 nur im Vorbeigehen: Quarte – ♭5 – Quinte, dann sicher landen.',
      n: [[1, 0, 1], [1, 1, 1, 'h'], [1, 2, 1], [2, 0, 1], [2, 2, 3, 'v']] },
    { id: 'blues2', name: 'Texas-Abgang', scale: 'blues', base: 'min', tip: 'SRV-Stil: schnell von oben, die Blue Note auf der G-Saite gezogen, Vibrato zum Schluss.',
      n: [[5, 3, 1], [5, 0, 1], [4, 3, 1], [4, 0, 1], [3, 3, 1, 'p'], [3, 2, 1], [3, 0, 1], [2, 2, 3, 'v']] },
    { id: 'blues3', name: 'Blues-Ruf', scale: 'blues', base: 'min', tip: 'Auf einer Saite hoch zur ♭5 und wieder runter – klagend, wie gesungen.',
      n: [[3, 0, 1], [3, 2, 1], [3, 3, 1], [3, 2, 1, 'p'], [3, 0, 1], [2, 2, 3, 'v']] },
    { id: 'maj1', name: 'Country-Lauf', scale: 'pmaj', base: 'maj', tip: 'Fröhlich aufwärts mit Hammer-on zur Terz – passt über jeden Dur-Akkord der Tonart.',
      n: [[2, -1, 1], [2, 2, 1], [3, -1, 1], [3, 1, 1, 'h'], [4, 0, 1], [4, 2, 1], [5, 0, 2, 'v']] },
    { id: 'maj2', name: 'Süßes Bending', scale: 'pmaj', base: 'maj', tip: 'Von der Sekunde zur Terz ziehen – der typische „Sweet Spot“ des Dur-Solos.',
      n: [[3, -1, 2, 'b'], [4, 0, 1], [3, 1, 1], [3, -1, 1], [2, 2, 3, 'v']] },
    { id: 'maj3', name: 'Allman-Lick', scale: 'dblues', base: 'maj', tip: 'Kleine Terz zur großen hochhämmern – Dur-Blues in einem Griff.',
      n: [[3, 0, 1], [3, 1, 1, 'h'], [4, 0, 1], [4, 2, 1], [5, 0, 2, 'v']] },
    { id: 'dor1', name: 'Santana-Sexte', scale: 'dor', base: 'min', tip: 'Die große Sexte macht Moll hell. Passt über den Moll-Grundakkord, wenn die Tonart dorisch klingt.',
      n: [[3, 0, 1], [3, 2, 1], [4, 0, 1], [4, 2, 2], [4, 3, 1], [5, 0, 3, 'v']] },
    { id: 'mix1', name: 'Mixolydischer Haken', scale: 'mix', base: 'maj', tip: 'Die kleine Septime gibt den Rock-Dreh – stark über Dur-Akkorde mit 7.',
      n: [[3, 1, 1], [3, 2, 1], [4, 0, 1], [4, 2, 1], [4, 3, 2], [5, 0, 3, 'v']] },
    { id: 'aeo1', name: 'Sexten-Melodie', scale: 'aeo', base: 'min', tip: 'Die kleine Sexte klingt traurig-episch – lange halten, dann über die Quarte heim.',
      n: [[4, 1, 2, 'v'], [4, 0, 1], [3, 2, 1], [3, 0, 1], [2, 4, 1], [2, 2, 3, 'v']] },
    { id: 'hm1', name: 'Neoklassischer Leitton', scale: 'hm', base: 'min', tip: 'Der Leitton einen Halbton unter dem Grundton – zieht unwiderstehlich heim.',
      n: [[2, 2, 1], [2, 1, 1], [2, 2, 1], [3, 0, 1], [3, 2, 1], [4, 0, 1], [4, 1, 1], [3, 2, 1], [2, 1, 1], [2, 2, 3, 'v']] },
    { id: 'arp1', name: 'Moll-Arpeggio', scale: 'amin', base: 'min', tip: 'Nur Akkordtöne über zwei Oktaven – ideal, um die Zieltöne zu finden.',
      n: [[0, 0, 1], [0, 3, 1], [1, 2, 1], [2, 2, 1], [3, 0, 1], [4, 0, 1], [5, 0, 2, 'v']] },
    { id: 'arp2', name: 'Dur-Arpeggio', scale: 'amaj', base: 'maj', tip: 'Grundton, Terz, Quinte – aufwärts geht es auch als Sweep.',
      n: [[0, 0, 1], [1, -1, 1], [1, 2, 1], [2, 2, 1], [3, 1, 1], [4, 0, 1], [5, 0, 2, 'v']] }
  ];
  const OPEN = [40, 45, 50, 55, 59, 64];
  const md = x => ((x % 12) + 12) % 12;
  // Lick in die Tonart setzen: Grundton-Bund auf der E-Saite so wählen, dass alles zwischen Bund 0 und 15 liegt
  function place(lick, key) {
    const root = lick.base === 'min' ? (key.major ? md(key.pc + 9) : key.pc) : (key.major ? key.pc : md(key.pc + 3));
    const offs = lick.n.map(x => x[1]), lo = Math.min(...offs), hi = Math.max(...offs);
    let rf = md(root - 4);
    if (rf + lo < 0) rf += 12;
    if (rf + hi > 15 && rf - 12 + lo >= 0) rf -= 12;
    if (rf + lo < 1 && rf + 12 + hi <= 15 && lo < 0) rf += 12;
    const notes = lick.n.map(([s, o, d, tech]) => ({ s, f: rf + o, d, tech: tech || '', midi: OPEN[s] + rf + o }));
    return { root, rf, notes, ok: notes.every(x => x.f >= 0 && x.f <= 15) };
  }
  return { list: L, SCALE, place, OPEN };
})();
if (typeof window !== 'undefined') window.Licks = Licks;
if (typeof module !== 'undefined') module.exports = Licks;
