// Songwriting-Logik: Prüfen, Varianten (jede anwendbar, Ergebnis gültig), Transponieren, Gesang
const C = require('../app/lied-core.js');
const ch = (s, k) => s.split(' ').map(x => { const [n, b] = x.split(':'); const m = /^([A-G]#?)(.*)$/.exec(n); return { r: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(m[1]), t: m[2], beats: +(b || 4) }; });
let ok = 0, n = 0; const check = (name, cond, info) => { n++; if (cond) ok++; console.log((cond ? 'OK    ' : 'FEHLER') + '  ' + name + (info !== undefined ? '  · ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); };
function song(key, verse, chorus, order) {
  const v = { key, bpm: 96, parts: [{ id: 'v', name: 'Strophe', type: 'verse', chords: ch(verse), audio: 'a1' }, { id: 'c', name: 'Refrain', type: 'chorus', chords: ch(chorus), audio: null }], order: order.map(p => ({ p, reps: 1 })) };
  v.parts[0].audioSig = C.sig(v.parts[0].chords); return v;
}
// Dur-Pop: Strophe = Refrain → Warnung, Varianten
const a = song({ pc: 0, major: true }, 'C G Am F', 'C G Am F', ['v', 'c', 'v', 'c']);
const fa = C.analyse(a), txt = fa.map(f => f.lvl + ':' + f.text).join('\n');
check('Gleiche Akkorde in Strophe und Refrain → Warnung', fa.some(f => f.lvl === 'warn' && /dieselben Akkorde/.test(f.text)));
check('Länge erkannt (4×4 Takte bei 96 BPM = 0:40, kurz)', /0:40/.test(txt) && fa.some(f => f.lvl === 'info' && /kurz/.test(f.text)));
check('Refrain nur 2× → Tipp', /nur 2×/.test(txt));
check('Strophe endet auf F (IV) – kein Dominant-Lob', !/löst auf/.test(txt));
const va = C.variants(a), ids = va.map(x => x.id);
check('Varianten für Dur-Pop', ['chorusIV', 'turnaround', 'borrowIV', 'colors', 'pre', 'bridge', 'wide'].every(x => ids.includes(x)), ids);
const get = id => va.find(x => x.id === id).apply(a);
check('Refrain auf IV: F C G Am', C.sig(C.partById(get('chorusIV'), 'c').chords) === '5:4 0:4 7:4 9m:4');
check('Strophe mit Dominante: C G Am G7', C.sig(C.partById(get('turnaround'), 'v').chords) === '0:4 7:4 9m:4 77:4');
check('Moll-Subdominante: F → Fm im Refrain', C.sig(C.partById(get('borrowIV'), 'c').chords) === '0:4 7:4 9m:4 5m:4');
const pre = get('pre'); check('Pre-Chorus nur zwischen Strophe und Refrain', pre.order.map(o => C.partById(pre, o.p).type).join(' ') === 'verse pre chorus verse pre chorus', pre.order.map(o => C.partById(pre, o.p).type));
const br = get('bridge'); check('Bridge vor dem letzten Refrain', br.order.map(o => C.partById(br, o.p).type).join(' ') === 'verse chorus verse bridge chorus');
check('Bridge-Akkorde Am Em F G', C.sig(br.parts[br.parts.length - 1].chords) === '9m:4 4m:4 5:4 7:4');
const ru = get('rueckung'); const lastC = C.partById(ru, ru.order[3].p);
check('Rückung: letzter Refrain +2 (D A Bm G)', C.sig(lastC.chords) === '2:4 9:4 11m:4 7:4' && ru.order[1].p === 'c');
check('Refrain breiter: doppelte Längen', C.beatsOf(C.partById(get('wide'), 'c')) === 32);
check('Variante ändert das Original nicht', C.sig(a.parts[1].chords) === '0:4 7:4 9m:4 5:4' && a.order.length === 4);
const col = get('colors'); check('Strophe einfärben: Cmaj7 G7 Am7 Fmaj7', C.sig(C.partById(col, 'v').chords) === '0maj7:4 77:4 9m7:4 5maj7:4');
check('Geänderte Strophe → Aufnahme veraltet', C.audioStale(C.partById(col, 'v')) && !C.audioStale(a.parts[0]));
// Moll mit Kadenz
const b = song({ pc: 9, major: false }, 'Am F C E7', 'Am G F E7', ['v', 'c', 'v', 'c', 'c']);
const fb = C.analyse(b), tb = fb.map(f => f.text).join('\n');
check('Moll: E7 → Am als starker Übergang erkannt', /löst auf/.test(tb), tb.split('\n').filter(x => /löst/.test(x)));
check('Moll: E7 gilt als leitereigen (Dur-Dominante)', /Alle Akkorde gehören zu A-Moll/.test(tb));
const vb = C.variants(b).map(x => x.id);
check('Moll: harmonische Dominante angeboten, wenn Em vorhanden', !vb.includes('harmV'));
const b2 = song({ pc: 9, major: false }, 'Am Em F G', 'C G Am Am', ['v', 'c']);
check('Moll mit Em: Dur-Dominante angeboten', C.variants(b2).some(x => x.id === 'harmV'));
// Fremdakkord
const c3 = song({ pc: 7, major: true }, 'G A# C G', 'C D G G', ['v', 'c', 'v', 'c', 'c']);
check('Fremdakkord B♭ in G-Dur gemeldet (♭III)', C.analyse(c3).some(f => /B♭ \(♭III\)/.test(f.text)), C.analyse(c3).filter(f => /außerhalb/.test(f.text)).map(f => f.text));
// Transponieren
const t = C.transpose(a, -3); check('Transponieren C → A', t.key.pc === 9 && C.sig(t.parts[0].chords) === '9:4 4:4 6m:4 2:4' && C.audioStale(t.parts[0]));
// Gesang
const vk = C.voiceKey(a, 45, 67);
check('Gesang: Bariton-Umfang A2–G4, Empfehlung vorhanden', vk && vk.best && ['gut', 'knapp'].includes(vk.best.fit), vk && vk.best);
const vk2 = C.voiceKey(a, 52, 62);
check('Gesang: enger Umfang (E3–D4, 10 Halbtöne) → „eng“', vk2.best.fit === 'eng', vk2.best);
const tg = C.targets(a, 48, 72);
check('Zieltöne: C-Dur-Akkord im Umfang, Terz markiert', tg[0].rows[0].chord === 'C' && tg[0].rows[0].notes.some(x => x.third && x.name === 'E3') && tg[0].rows[0].notes.every(x => x.m >= 48 && x.m <= 72));
// jede Variante in allen 24 Tonarten anwendbar, Ergebnis gültig (Ablauf verweist auf vorhandene Teile, Längen > 0)
let bad = 0, cnt = 0;
for (let pc = 0; pc < 12; pc++) for (const major of [true, false]) {
  const s0 = song({ pc, major }, 'C G Am F', 'F G C C', ['v', 'c', 'v', 'c', 'c']); const d = pc;
  const s = C.transpose(s0, d); s.key = { pc, major };
  C.variants(s).forEach(x => { cnt++; const r = x.apply(s); const okk = r.order.every(o => C.partById(r, o.p)) && r.parts.every(p => p.chords.every(c => c.beats > 0 && c.r >= 0 && c.r < 12 && C.CH[c.t])) && C.analyse(r).length > 0; if (!okk) { bad++; console.log('ungültig', pc, major, x.id); } });
}
check('Alle Varianten in 24 Tonarten gültig', bad === 0, cnt + ' angewandt');
console.log(`\n${ok}/${n}`); process.exit(ok === n ? 0 : 1);
