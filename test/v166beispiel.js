// v166: Inhalt des Beispiel-Songs ohne Browser prüfen – Reim-Prüfung der Text-Werkstatt v164 (kein unbeabsichtigtes „ohne Reim“), Silben je Zeile,
// Akkorde in a-Moll und genau die Vorschläge von „Akkorde nach Stimmung“ mit deren Begründung, Akkordmarken im Text = Akkorde der Teile,
// Song-Code lesbar (Rohfassung + fertig), Rohfassung zeigt die in Schritt 10 genannten Probleme, 11 Schritte mit Inhalt, nichts Fremdes.
// Aufruf: node test/v166beispiel.js  (Ausgabe „OK/FEHLER …“, am Ende n/m)
const path = require('path');
const A = path.join(__dirname, '..', 'app');
const E = require(path.join(A, 'songtext-beispiel.js')), T = require(path.join(A, 'textwerk.js')), X = require(path.join(A, 'lied-text.js'));
global.window = {};
let ok = 0, tot = 0;
const check = (n, c, info) => { tot++; if (c) ok++; console.log((c ? 'OK    ' : 'FEHLER') + '  ' + n + (info !== undefined && info !== '' ? '  · ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); };

const r1 = X.fromCode(E.code(true)), r2 = X.fromCode(E.code(false), r1.v);
check('Song-Code lesbar (Rohfassung und fertig), ohne Warnung', r1.ok && r2.ok && !r1.warn.length && !r2.warn.length, [r1.errs, r2.errs, r1.warn, r2.warn]);
const v = r2.v, key = v.key;
check('Tonart a-Moll, 84 BPM, Ablauf S R S R B Schluss', key.pc === 9 && key.major === false && v.bpm === 84 && v.order.map(o => v.parts.find(p => p.id === o.p).name).join(',') === 'Strophe,Refrain,Strophe,Refrain,Bridge,Schluss-Refrain');
// Reim-Prüfung (fertig)
const want = { Strophe: ['ABAB', 'ABAB'], Refrain: ['AABB'], Bridge: ['ABCB'], 'Schluss-Refrain': ['AABB'] }, got = {}, alone = [], impure = [];
v.parts.forEach(p => { got[p.name] = p.lyrics.map((t, i) => { const r = T.checkText(t, p.name); r.lines.forEach((l, k) => { if (l.alone) alone.push(p.name + ' ' + (i + 1) + ':' + (k + 1)); if (l.lv === 'unrein') impure.push(l.text); }); return r.scheme; }); });
check('Reimschema je Teil wie geplant (Werkstatt-Prüfung)', JSON.stringify(got) === JSON.stringify(want), got);
check('„ohne Reim“ nur Bridge Zeile 1 und 3 (Vorlage XAXA, im Beispiel erklärt)', alone.join(' ') === 'Bridge 1:1 Bridge 1:3', alone);
check('keine unreinen Reime (also nichts zu erklären außer XAXA)', !impure.length, impure);
const hints = []; v.parts.forEach(p => p.lyrics.forEach(t => T.checkText(t, p.name).hints.forEach(h => hints.push(h.text))));
check('fertiger Text ohne Hinweise (Silben, Füllwörter, gleiches Wort, Wiederholung)', !hints.length, hints);
// Silben je Zeile passend zum Raster (Strophe/Refrain 8, Bridge 6)
const syl = []; v.parts.forEach(p => p.lyrics.forEach(t => t.split('\n').forEach(l => { const n = X.syllables(l, 'de'), s = p.type === 'bridge' ? 6 : 8; if (n !== s) syl.push(p.name + ': ' + l + ' = ' + n); })));
check('Silben: Strophe/Refrain je 8, Bridge je 6', !syl.length, syl);
// Rohfassung zeigt die Probleme aus Schritt 10
const rough = {}; r1.v.parts.forEach(p => { rough[p.name] = p.lyrics.map(t => T.checkText(t, p.name)); });
check('Rohfassung: Strophe 1 ABCB, Strophe 2 ABAC + Füllwörter, Bridge ABCD + „9 Silben“', rough.Strophe[0].scheme === 'ABCB' && rough.Strophe[1].scheme === 'ABAC' && rough.Strophe[1].hints.some(h => /halt.*eigentlich/.test(h.text)) && rough.Bridge[0].scheme === 'ABCD' && rough.Bridge[0].hints.some(h => /9 Silben/.test(h.text)));
const s10 = E.step(10);
check('Schritt 10 nennt genau diese Prüf-Ergebnisse', /Strophe 1 <b>ABCB<\/b>/.test(s10) && /Strophe 2 <b>ABAC<\/b>/.test(s10) && /Bridge <b>ABCD<\/b>/.test(s10) && /ABCB<\/b> – Zeile 1 und 3/.test(s10));
// Akkorde: nur Töne/Griffe aus a-Moll (+ E als Dur-Dominante), Akkordmarken = Akkorde der Teile
const names = new Set(); v.parts.forEach(p => p.chords.forEach(c => names.add(X.chordName(c, key))));
check('Akkorde nur Am C G Dm F E (a-Moll, offene Griffe)', [...names].every(n => ['Am', 'C', 'G', 'Dm', 'F', 'E'].includes(n)), [...names]);
const mism = [];
v.parts.forEach(p => { const seq = p.chords.map(c => X.chordName(c, key)); p.lyrics.forEach((t, i) => { const m = (t.match(/\[([^\]]+)\]/g) || []).map(x => x.slice(1, -1)); if (m.join(' ') !== seq.join(' ')) mism.push(p.name + ' ' + (i + 1) + ': ' + m.join(' ') + ' ≠ ' + seq.join(' ')); }); });
check('Akkordmarken im Text = Akkorde des Teils (Wechsel auf der betonten Silbe)', !mism.length, mism);
const beats = v.parts.map(p => p.name + ' ' + p.chords.reduce((a, c) => a + c.beats, 0) / 4);
check('je Teil 8 Takte (4 Zeilen × 2 Takte)', v.parts.every(p => p.chords.reduce((a, c) => a + c.beats, 0) === 32), beats);
// gleiche Logik wie „Akkorde nach Stimmung“ (v164): gewählte Folge steht in den Vorschlägen, Begründung wörtlich übernommen
const s8 = E.step(8), sig = ch => ch.map(c => X.chordName(c, key)).join(' ');
const pm = T.parseMood('Strophe melancholisch, Refrain sehnsüchtig, Bridge Kontrast'), pm2 = T.parseMood('Refrain hoffnungsvoll, Spannung löst sich');
check('Stimmungssätze aus Schritt 8 werden erkannt', pm.sec.verse.mood === 'melancholisch' && pm.sec.chorus.mood === 'sehnsüchtig' && pm.sec.bridge.tens === 'kontrast' && pm2.sec.chorus.mood === 'hoffnungsvoll' && pm2.sec.chorus.tens === 'ab' && !pm.unknown.length && !pm2.unknown.length);
const P = n => v.parts.find(p => p.name === n), first4 = p => sig(p.chords).split(' ').slice(0, 4).join(' ');
const cases = [['Strophe', T.suggest('verse', 'melancholisch', null, key, 4), first4(P('Strophe'))], ['Refrain', T.suggest('chorus', 'sehnsüchtig', null, key, 4), first4(P('Refrain'))],
  ['Bridge', T.suggest('bridge', null, 'kontrast', key, 4), sig(P('Bridge').chords)], ['Schluss', T.suggest('chorus', 'hoffnungsvoll', 'ab', key, 4), 'F G C C']];
const sbad = [];
cases.forEach(([n, sg, want]) => { const hit = sg.list.find(x => x.names.replace(/:\S+/g, '') === want); if (!hit || !s8.includes('„' + hit.why + '“')) sbad.push(n + ': ' + want + ' / ' + sg.list.map(x => x.names).join(' | ')); });
check('Akkordfolgen = Vorschläge von „Akkorde nach Stimmung“ mit wörtlicher Begründung', !sbad.length, sbad);
check('Schluss-Refrain: 1. Hälfte wie Refrain, 2. Hälfte F G C', sig(P('Schluss-Refrain').chords) === 'F C G Am F G C');
// Schritte
const lens = []; for (let n = 1; n <= 11; n++) lens.push(E.step(n).length);
check('11 Schritte, jeder mit Inhalt', E.steps === 11 && lens.every(l => l > 400) && E.step(12) === '', lens);
check('Schritt 2: drei verworfene Titel mit Begründung + gewählter Hook', (E.step(2).match(/stb-x/g) || []).length === 3 && E.step(2).includes('Die erste Bahn zurück'));
check('Schritt 10: 4 Vorher/Nachher mit Begründung', (s10.match(/stb-vn/g) || []).length === 4 && E.VN.every(x => x[5].length > 40));
check('Hook steht im Refrain und (umgedreht) im Schluss-Refrain', /erste Bahn zurück/.test(X.stripChords(P('Refrain').lyrics[0])) && /erste Bahn fährt leer zurück/.test(X.stripChords(P('Schluss-Refrain').lyrics[0])));
const all = E.code(false) + Array.from({ length: 11 }, (_, i) => E.step(i + 1)).join('');
check('keine Marken/Fremdnamen (nur erfundene Inhalte)', !/(Yamaha|Fender|Gibson|Spotify|YouTube|Apple|iPhone|Beatles|Rammstein|Nena|Grönemeyer|Udo|Helene)/i.test(all));
console.log('\n' + ok + '/' + tot);
process.exitCode = ok === tot ? 0 : 1;
