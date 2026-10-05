// ---- Akkordgriffe (CAGED): E-, A-, D-Form als verschiebbare Griffe, C- und G-Form nur offen ----
// Bünde je Saite von tief E nach hoch e, null = nicht anschlagen. Versatz relativ zum Grundton-Bund der Form.
const Voicings = (() => {
  const md = x => ((x % 12) + 12) % 12;
  const OPEN = [40, 45, 50, 55, 59, 64];                 // E2 A2 D3 G3 B3 E4
  const SHAPES = [
    { id: 'E', name: 'E-Form', base: 4, t: {
      '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], maj7: [0, null, 1, 1, 0, null], m7: [0, 2, 0, 0, 0, 0],
      sus4: [0, 2, 2, 2, 0, 0], sus2: [0, 2, 4, 4, null, null], dim: [0, 1, 2, 0, null, null], '5': [0, 2, 2, null, null, null],
      '6': [0, 2, 2, 1, 2, 0], m6: [0, 2, 2, 0, 2, 0], add9: [0, 2, 4, 1, 0, 0], '9': [0, 2, 0, 1, 0, 2], m9: [0, 2, 0, 0, 0, 2],
      m11: [0, 0, 0, 0, 0, 0], m7b5: [0, 1, 0, 0, null, null] } },
    { id: 'A', name: 'A-Form', base: 9, t: {
      '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], maj7: [null, 0, 2, 1, 2, 0], m7: [null, 0, 2, 0, 1, 0],
      sus4: [null, 0, 2, 2, 3, 0], sus2: [null, 0, 2, 2, 0, 0], dim: [null, 0, 1, 2, 1, null], '5': [null, 0, 2, 2, null, null],
      '6': [null, 0, 2, 2, 2, 2], m6: [null, 0, 2, 2, 1, 2], add9: [null, 0, 2, 4, 2, 0], '9': [null, 0, -1, 0, 0, null],
      m9: [null, 0, -2, 0, 0, 0], maj9: [null, 0, -1, 1, 0, null], m11: [null, 0, 0, 0, 1, 0], m7b5: [null, 0, 1, 0, 1, null] } },
    { id: 'D', name: 'D-Form', base: 2, t: {
      '': [null, null, 0, 2, 3, 2], m: [null, null, 0, 2, 3, 1], '7': [null, null, 0, 2, 1, 2], maj7: [null, null, 0, 2, 2, 2], m7: [null, null, 0, 2, 1, 1],
      sus4: [null, null, 0, 2, 3, 3], sus2: [null, null, 0, 2, 3, 0], dim: [null, null, 0, 1, 3, 1], '5': [null, null, 0, 2, 3, null],
      '6': [null, null, 0, 2, 0, 2], m6: [null, null, 0, 2, 0, 1], m7b5: [null, null, 0, 1, 1, 1] } },
    { id: 'C', name: 'C-Form', base: 9, open: true, t: {
      '': [null, 0, -1, -3, -2, -3], '7': [null, 0, -1, 0, -2, -3], maj7: [null, 0, -1, -3, -3, -3], add9: [null, 0, -1, -3, 0, -3] } },
    { id: 'G', name: 'G-Form', base: 4, open: true, t: {
      '': [0, -1, -3, -3, -3, 0], '7': [0, -1, -3, -3, -3, -2], '6': [0, -1, -3, -3, -3, -3] } }
  ];
  const IV = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7],
    dim: [0, 3, 6], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 2, 4, 7], m9: [0, 2, 3, 7, 10], maj9: [0, 2, 4, 7, 11], '9': [0, 2, 4, 7, 10], m11: [0, 3, 5, 7, 10], m7b5: [0, 3, 6, 10] };
  // alle Griffe für Grundton pc (0–11) und Akkordtyp, sortiert: offen zuerst, dann nach Lage
  function forChord(pc, type) {
    const out = [];
    SHAPES.forEach(sh => {
      const off = sh.t[type]; if (!off) return;
      const r0 = md(pc - sh.base);
      for (const r of [r0, r0 + 12]) {
        const fr = off.map(o => o == null ? null : o + r), used = fr.filter(x => x != null);
        if (Math.min(...used) < 0 || Math.max(...used) > 15) continue;
        const pressed = used.filter(x => x > 0), lo = pressed.length ? Math.min(...pressed) : 0, hi = pressed.length ? Math.max(...pressed) : 0;
        if (hi - lo > 4) continue;
        const isOpen = used.includes(0) && hi <= 4;
        if (sh.open && !isOpen) continue;
        if (out.some(v => v.frets.join() === fr.join())) continue;
        out.push({ shape: sh.id, name: isOpen ? 'offen (' + sh.name + ')' : sh.name + ' · Bund ' + lo, frets: fr, pos: isOpen ? 0 : lo, open: isOpen });
        break;
      }
    });
    out.sort((a, b) => (b.open - a.open) || (a.pos - b.pos));
    return out.slice(0, 4);
  }
  // MIDI-Töne eines Griffs (tief → hoch)
  const notes = v => v.frets.map((f, s) => f == null ? null : OPEN[s] + f).filter(x => x != null);
  return { forChord, notes, IV, OPEN };
})();
if (typeof window !== 'undefined') window.Voicings = Voicings;
if (typeof module !== 'undefined') module.exports = Voicings;
