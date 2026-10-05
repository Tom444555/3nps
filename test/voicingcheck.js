// Prüft alle Griffe: nur Akkordtöne, Grundton und Terz enthalten, tiefster Ton = Grundton, spielbar (Spanne ≤ 4), mindestens ein Griff je Akkord
const V = require('../app/voicings.js');
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let bad = 0, total = 0, none = [];
for (const t of Object.keys(V.IV)) for (let pc = 0; pc < 12; pc++) {
  const vs = V.forChord(pc, t), iv = V.IV[t], tones = iv.map(x => (pc + x) % 12);
  if (!vs.length) none.push(N[pc] + t);
  vs.forEach(v => {
    total++;
    const m = V.notes(v), pcs = m.map(x => x % 12), errs = [];
    if (pcs.some(p => !tones.includes(p))) errs.push('fremder Ton');
    if (!pcs.includes(pc)) errs.push('kein Grundton');
    const third = iv.find(x => x === 3 || x === 4); if (third != null && !pcs.includes((pc + third) % 12)) errs.push('keine Terz');
    if (Math.min(...m) % 12 !== pc) errs.push('Bass nicht Grundton');
    if (m.length < 3 && t !== '5') errs.push('zu wenig Töne');
    if (errs.length) { bad++; console.log(N[pc] + t, v.name, v.frets.map(f => f == null ? 'x' : f).join(' '), errs.join(', ')); }
  });
}
const ex = (pc, t) => V.forChord(pc, t).map(v => v.name + ': ' + v.frets.map(f => f == null ? 'x' : f).join('')).join(' | ');
console.log('C:', ex(0, '')); console.log('G:', ex(7, '')); console.log('Am:', ex(9, 'm')); console.log('F#m7:', ex(6, 'm7')); console.log('Bb7:', ex(10, '7'));
console.log(`\nGriffe: ${total}, fehlerhaft: ${bad}, Akkorde ohne Griff: ${none.length ? none.join(' ') : 'keine'}`);
process.exit(bad || none.length ? 1 : 0);
