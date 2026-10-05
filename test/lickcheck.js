// Jeder Ton jedes Licks liegt in seiner Tonleiter, in allen 24 Tonarten zwischen Bund 0 und 15, und der Lick endet auf einem Akkordton
const K = require('../app/licks.js');
let bad = 0, n = 0;
K.list.forEach(l => {
  const iv = K.SCALE[l.scale].iv;
  for (let pc = 0; pc < 12; pc++) for (const major of [true, false]) {
    n++;
    const p = K.place(l, { pc, major }), errs = [];
    if (!p.ok) errs.push('außerhalb Bund 0–15');
    p.notes.forEach(x => { const rel = ((x.midi - p.root) % 12 + 12) % 12; if (!iv.includes(rel)) errs.push('Ton ' + x.s + '/' + x.f + ' nicht in ' + l.scale); });
    const last = p.notes[p.notes.length - 1], rl = ((last.midi - p.root) % 12 + 12) % 12;
    if (![0, 3, 4, 7].includes(rl)) errs.push('endet nicht auf Akkordton (' + rl + ')');
    const span = Math.max(...p.notes.map(x => x.f)) - Math.min(...p.notes.map(x => x.f));
    if (span > 5) errs.push('Spanne ' + span);
    if (errs.length) { bad++; if (bad < 15) console.log(l.id, pc, major ? 'Dur' : 'Moll', [...new Set(errs)].join(', ')); }
  }
});
console.log(`Licks ${K.list.length} · Platzierungen ${n} · fehlerhaft ${bad}`);
process.exit(bad ? 1 : 0);
