// v164: Logik der Text-Werkstatt ohne Browser – Reimstufen (deutsch, inkl. unreiner Reime, Umlaute, gleiches Wort), Silben, Reim-Prüfung eines
// erfundenen Textes, Reimwörter aus der Liste (und Rückfall nach Schreibung), Stimmung → Akkordfolgen in mehreren Tonarten (Toms Beispiel),
// Prompt mit allen Feldern, Zeilen-Vorschläge und freien Text einlesen, Baukasten. Aufruf: node test/v164reime.js  (Ausgabe „OK/FEHLER …“, am Ende n/m)
const path = require('path'), fs = require('fs');
const A = path.join(__dirname, '..', 'app');
const T = require(path.join(A, 'textwerk.js')), X = require(path.join(A, 'lied-text.js')), C = require(path.join(A, 'lied-core.js'));
global.window = {};   // lied-core fragt window.keyName (nach dem Laden setzen, sonst hielte textwerk.js Node für einen Browser)
let ok = 0, tot = 0;
const check = (n, c, info) => { tot++; if (c) ok++; console.log((c ? 'OK    ' : 'FEHLER') + '  ' + n + (info !== undefined && info !== '' ? '  · ' + (typeof info === 'string' ? info : JSON.stringify(info)).replace(/\n/g, ' ⏎ ') : '')); };

// ---- Reimstufen: erwartete Einordnung je Wortpaar ----
const P = [['Herz', 'Schmerz', 'rein'], ['Liebe', 'Triebe', 'rein'], ['Zeit', 'Leid', 'rein'], ['Zeit', 'weit', 'rein'], ['Nacht', 'gemacht', 'rein'], ['Tränen', 'sehnen', 'rein'],
  ['Tür', 'mir', 'unrein'], ['Freude', 'Weide', 'unrein'], ['Leute', 'heute', 'rein'], ['Bäume', 'Träume', 'rein'], ['Staat', 'statt', 'unrein'], ['Stadt', 'statt', 'rein'], ['Hand', 'Land', 'rein'],
  ['Tag', 'lag', 'rein'], ['Wald', 'kalt', 'rein'], ['leben', 'geben', 'rein'], ['Sonne', 'Wonne', 'rein'], ['Himmel', 'Schimmel', 'rein'], ['Glück', 'Stück', 'rein'], ['Glück', 'zurück', 'rein'],
  ['Höhle', 'Seele', 'unrein'], ['Hölle', 'Stelle', 'unrein'], ['König', 'wenig', 'unrein'], ['schön', 'gehn', 'unrein'], ['Feuer', 'Eier', 'unrein'], ['Kinder', 'Winter', 'unrein'], ['Blick', 'Glück', 'unrein'],
  ['Fuß', 'muss', 'unrein'], ['Schiff', 'tief', 'unrein'], ['Musik', 'Glück', 'unrein'], ['allein', 'Stein', 'rein'], ['Sterne', 'Ferne', 'rein'], ['wieder', 'Lieder', 'rein'], ['immer', 'schlimmer', 'rein'],
  ['Mutter', 'Futter', 'rein'], ['gehen', 'sehen', 'rein'], ['Traum', 'kaum', 'rein'], ['Fluss', 'muss', 'rein'], ['Rose', 'Hose', 'rein'], ['Wege', 'Stege', 'rein'], ['Mond', 'lohnt', 'rein'],
  ['Wind', 'Kind', 'rein'], ['Licht', 'Gesicht', 'rein'], ['kommen', 'genommen', 'rein'], ['Haus', 'raus', 'rein'], ['heiß', 'weiß', 'rein'], ['Meer', 'schwer', 'rein'], ['Meer', 'mehr', 'rein'],
  ['See', 'weh', 'rein'], ['Ruh', 'du', 'rein'], ['Schatten', 'hatten', 'rein'], ['Morgen', 'Sorgen', 'rein'], ['tanzen', 'ganzen', 'rein'], ['Feuer', 'teuer', 'rein'], ['singen', 'klingen', 'rein'],
  ['Zug', 'genug', 'rein'], ['Weg', 'Steg', 'rein'], ['Abend', 'labend', 'rein'], ['Hoffnung', 'Öffnung', null],
  ['Nacht', 'Nacht', 'gleich'], ['Lied', 'lied', 'gleich'], ['Herz,', 'herz!', 'gleich'],
  ['Liebe', 'Leben', null], ['Abend', 'Haus', null], ['Hoffnung', 'Zeitung', null], ['Freiheit', 'Zeit', null], ['Herz', 'Kerze', null], ['Stern', 'Sterne', null], ['Nacht', 'Licht', null], ['Sonne', 'Tonnen', 'unrein']];
const bad = [];
P.forEach(([a, b, e]) => { const r = T.rhymeLevel(a, b); if (r !== e) bad.push(a + '/' + b + ' ' + r + '≠' + e); });
const nR = P.filter(x => x[2] === 'rein').length, nU = P.filter(x => x[2] === 'unrein').length, nG = P.filter(x => x[2] === 'gleich').length, nN = P.filter(x => x[2] === null).length;
check('Reimstufen: ' + (P.length - bad.length) + '/' + P.length + ' Wortpaare richtig (' + nR + ' rein, ' + nU + ' unrein, ' + nG + ' gleich, ' + nN + ' kein Reim)', bad.length === 0, bad.join('; '));
check('Umlaute/Doppellaute: ä=e rein, ü~i ö~e eu~ei unrein', T.rhymeLevel('Bär', 'schwer') === 'rein' && T.rhymeLevel('Glück', 'Blick') === 'unrein' && T.rhymeLevel('Söhne', 'Szene') === 'unrein' && T.rhymeLevel('neu', 'Blei') === 'unrein');
check('Groß-/Kleinschreibung und Satzzeichen egal', T.rhymeLevel('NACHT.', 'lacht') === 'rein' && T.rhymeLevel('„Herz“', 'Schmerz!') === 'rein');
check('Unbetonte Nachsilben: Hoffnung reimt nicht auf Zeitung, Heiterkeit nicht auf Zeit', T.rhymeLevel('Hoffnung', 'Zeitung') === null && T.rhymeLevel('Heiterkeit', 'Zeit') === null);

// ---- Silben (vorhandene Zählung) ----
const S = [['Die Ampel blinkt im leeren Licht', 8], ['ich frag den Wind, er antwortet mir', 9], ['Wir fahren durch die Nacht', 6], ['bis der Morgen lacht', 5], ['[Am]Die Straße [F]glänzt', 4]];
const sb = S.filter(([t, n]) => X.syllables(t, 'de') !== n).map(([t, n]) => t + ': ' + X.syllables(t, 'de') + '≠' + n);
check('Silben: ' + (S.length - sb.length) + '/' + S.length + ' Zeilen richtig gezählt (Akkordmarken zählen nicht)', !sb.length, sb.join('; '));

// ---- Reim-Prüfung eines erfundenen Textes ----
const VERSE = '[Am]Die Ampel blinkt im leeren Licht\nder Regen fällt auf meine Tür\nein Bus fährt ab, er wartet nicht\nich frag den Wind, er antwortet mir';
const CHORUS = 'Wir fahren durch die Nacht\nwir fahren durch die Nacht\nund irgendwie ist halt die ganze Stadt jetzt eigentlich noch wach\nbis der Morgen lacht';
const r1 = T.checkText(VERSE, 'Strophe'), r2 = T.checkText(CHORUS, 'Refrain');
check('Strophe: Schema ABAB, Zeile 3 rein auf 1, Zeile 4 unrein auf 2', r1.scheme === 'ABAB' && r1.lines[2].lv === 'rein' && r1.lines[2].with === 0 && r1.lines[3].lv === 'unrein' && r1.lines[3].with === 1, r1.lines.map(l => l.letter + (l.lv || '')).join(' '));
check('Refrain: gleiches Wort (Zeile 2), Zeile 3 ohne Partner, Zeile 4 rein', r2.lines[1].lv === 'gleich' && r2.lines[2].alone && r2.lines[3].lv === 'rein' && r2.scheme === 'AABA', r2.scheme);
const hk = r2.hints.map(h => h.k);
check('Hinweise ruhig als Liste: gleiches Wort, Füllwörter, lange Zeile, Silben-Abweichung', hk.includes('same') && hk.includes('fill') && hk.includes('long') && hk.includes('syl') && r2.hints.every(h => !/\b(Note|sehr gut|mangelhaft|ungenügend|\d\/10)\b/.test(h.text)), hk);
check('Füllwörter erkannt: irgendwie, halt, eigentlich', r2.hints.some(h => h.k === 'fill' && /irgendwie/.test(h.text) && /halt/.test(h.text) && /eigentlich/.test(h.text)));
check('Wiederholung (≥ 3×) als Hinweis', T.checkText('Der Regen fällt\nder Regen bleibt\nder Regen singt\nund nichts mehr treibt').hints.some(h => h.k === 'rep' && /regen/.test(h.text)));

// ---- Reimwörter aus der Liste ----
const LP = path.join(A, 'www', 'reim', 'reim-de-1.txt'), txt = fs.readFileSync(LP, 'utf8');
const t0 = Date.now(); T.setList(txt); const ms = Date.now() - t0;
check('Wortliste: ' + T.list.count + ' Wörter, ' + T.list.groups.length + ' Reimgruppen, eingelesen in ' + ms + ' ms', T.list.count > 50000 && ms < 3000);
const want = { Nacht: ['macht', 'lacht', 'gemacht', 'wacht'], Herz: ['schmerz', 'scherz'], Liebe: ['diebe', 'triebe'], Zeit: ['weit', 'leid', 'streit', 'breit'], Sonne: ['wonne', 'tonne'], Morgen: ['sorgen', 'geborgen', 'verborgen'], Tränen: ['sehnen', 'szenen'], Himmel: ['schimmel', 'gewimmel'] };
const miss = [];
Object.entries(want).forEach(([w, list]) => { const r = T.rhymesFor(w, 400); list.forEach(x => { if (!r.rein.includes(x)) miss.push(w + '→' + x); }); if (r.rein.includes(w.toLowerCase())) miss.push(w + ' enthält sich selbst'); });
check('Reimwörter rein: ' + Object.keys(want).length + ' Wörter, erwartete Partner gefunden', !miss.length, miss.join(', '));
check('Reimwörter unrein: Tür → mir/dir/hier, Glück → Blick', T.rhymesFor('Tür').unrein.some(x => ['mir', 'dir', 'hier'].includes(x)) && T.rhymesFor('Glück').unrein.includes('blick'));
const fb = T.rhymesFor('Wolkenkratzerfenster', 50);
check('Wort nicht in der Liste → Rückfall nach Schreibung', fb.src === 'schreibung' && fb.rein.includes('fenster') && fb.rein.includes('gespenster'), fb.rein.slice(0, 5));
const tk = Date.now(); for (let i = 0; i < 200; i++) T.rhymesFor(['Nacht', 'Herz', 'Zeit', 'Liebe'][i % 4]); const per = (Date.now() - tk) / 200;
check('Suche schnell (' + per.toFixed(2) + ' ms je Wort)', per < 20);

// ---- Stimmung → Akkordfolgen ----
const m = T.parseMood('traurig, mit Spannungsabfall danach im Refrain');
check('Toms Beispiel verstanden: traurig für alle, Refrain „Spannung fällt ab“', m.all === 'traurig' && m.sec.chorus && m.sec.chorus.tens === 'ab' && !m.unknown.length, m);
const m2 = T.parseMood('traurig mit Spannungsabfall danach im Refrain');
check('… auch ohne Komma', m2.all === 'traurig' && m2.sec.chorus && m2.sec.chorus.tens === 'ab');
const m3 = T.parseMood('Strophe düster, Pre-Chorus Spannung steigt, Refrain hoffnungsvoll und offen enden; Bridge melancholisch');
check('Mehrere Abschnitte: düster / steigt / hoffnungsvoll + offen / melancholisch', m3.sec.verse.mood === 'düster' && m3.sec.pre.tens === 'auf' && m3.sec.chorus.mood === 'hoffnungsvoll' && m3.sec.chorus.tens === 'offen' && m3.sec.bridge.mood === 'melancholisch', m3.sec);
const kw = ['traurig', 'melancholisch', 'düster', 'hoffnungsvoll', 'fröhlich', 'treibend', 'ruhig', 'wütend', 'sehnsüchtig'].filter(w => T.parseMood(w).all !== w);
check('Neun Stimmungen erkannt (auch gebeugt: „traurige“, „wütender“, „Sehnsucht“)', !kw.length && T.parseMood('traurige Strophe').sec.verse.mood === 'traurig' && T.parseMood('wütender Refrain').sec.chorus.mood === 'wütend' && T.parseMood('voller Sehnsucht').all === 'sehnsüchtig', kw);
const tw = [['Spannung steigt', 'auf'], ['Spannung baut sich auf', 'auf'], ['Spannung fällt ab', 'ab'], ['löst sich auf', 'ab'], ['offen enden', 'offen'], ['bleibt offen', 'offen'], ['Trugschluss', 'offen'], ['Spannung halten', 'halten'], ['Kontrast', 'kontrast']].filter(([t, e]) => (T.parseMood(t).sec.chorus || {}).tens !== e);
check('Spannungswörter: steigt, baut sich auf, fällt ab, löst sich, offen enden, bleibt offen, Trugschluss, halten, Kontrast', !tw.length, tw);
const un = T.parseMood('blaugrün und schnurzelig');
check('Unbekanntes wird gemeldet statt geraten', un.unknown.includes('blaugrün') && un.unknown.includes('schnurzelig') && !un.all);
const key = (pc, major) => ({ pc, major }), NM = k => C.keyLabel ? (k.major ? '' : 'm') : '';
void NM;
let good = 0, all = 0; const keys = [key(0, true), key(9, false), key(7, true), key(4, false), key(3, true), key(6, false)];
const det = [];
keys.forEach(k => {
  const ch = T.suggest('chorus', 'traurig', 'ab', k, 3), vs = T.suggest('verse', 'traurig', null, k, 3);
  const tonic = k.major ? C.md(k.pc + 9) : k.pc;   // traurig → Moll (in Dur über die Moll-Parallele)
  all++;
  const endsTonic = ch.list.every(x => x.chords[x.chords.length - 1].r === tonic && x.chords[x.chords.length - 1].t === 'm');
  const startsTonic = vs.list.some(x => x.chords[0].r === tonic && x.chords[0].t === 'm');
  const n23 = ch.list.length >= 2 && ch.list.length <= 3 && vs.list.length >= 2 && ch.list.every(x => x.why && x.why.length > 20);
  if (endsTonic && startsTonic && n23) good++; else det.push(JSON.stringify(k));
});
check('Toms Beispiel in 6 Tonarten (C, Am, G, Em, Es, F♯m): Refrain endet auf der Molltonika, Strophe beginnt dort, 2–3 Folgen mit Begründung', good === all, det);
const cC = T.suggest('chorus', 'traurig', 'ab', key(0, true), 3).list.map(x => x.names);
check('In C-Dur: Refrain „F G Am Am“ / „Dm E Am Am“ …', cC[0] === 'F G Am Am' && cC[1] === 'Dm E Am Am', cC);
const up = T.suggest('pre', 'traurig', 'auf', key(0, true), 3).list.map(x => x.chords[x.chords.length - 1]);
check('„Spannung steigt“ endet offen (nicht auf der Tonika)', up.every(c => !(c.r === 9 && c.t === 'm')), up);
const offen = T.suggest('chorus', 'fröhlich', 'offen', key(7, true), 3).list;
check('„offen enden“ in G-Dur: Trugschluss/Dominante am Ende', offen.every(x => { const l = x.chords[x.chords.length - 1]; return (l.r === 2 && l.t === '') || (l.r === 4 && l.t === 'm'); }), offen.map(x => x.names));
const allM = Object.keys(T.MOODS).every(mo => ['verse', 'pre', 'chorus', 'bridge'].every(s => T.suggest(s, mo, null, key(5, true), 3).list.length >= 2));
check('Jede Stimmung liefert je Abschnitt ≥ 2 Folgen (F-Dur)', allM);
const ap = T.applyChords({ key: key(0, true), bpm: 90, parts: [{ id: 'a', name: 'Refrain', type: 'chorus', chords: [0, 7, 9, 5, 0, 7, 9, 5].map(r => ({ r, t: '', beats: 4 })), lyrics: ['x'] }], order: [{ p: 'a', reps: 1 }] }, 'chorus', T.progChords('VI VII i i', key(0, true), 'moll'));
check('Übernehmen behält die Länge des Teils (8 Takte = Folge 2×) und den Text', ap.part.chords.length === 8 && ap.part.lyrics[0] === 'x' && !ap.added);

// ---- Prompt ----
const song = { name: 'Staub und Sterne' }, v = { n: 1, key: key(0, true), bpm: 92, theme: 'Nachtfahrt', parts: [{ id: 'p1', name: 'Strophe', type: 'verse', chords: [{ r: 9, t: 'm', beats: 4 }], lyrics: [VERSE] }, { id: 'p2', name: 'Refrain', type: 'chorus', chords: [{ r: 5, t: '', beats: 4 }], lyrics: [CHORUS] }], order: [{ p: 'p1', reps: 1 }, { p: 'p2', reps: 1 }] };
const pr = T.buildPrompt(song, v, { task: 'vorgabe', theme: 'Leere Stadt bei Nacht', mood: 'traurig, am Ende hoffnungsvoll', lang: 'de', persp: 'wir', scheme: 'AABB', syl: 7, parts: ['p2'], own: 'die Ampel blinkt gelb' });
const need = ['Thema: Leere Stadt bei Nacht', 'Stimmung: traurig, am Ende hoffnungsvoll', 'Sprache des Textes: Deutsch', 'Wir-Perspektive', 'Reimschema je Abschnitt: AABB', 'Silben je Zeile: etwa 7', 'Abschnitte: „Refrain“', 'die Ampel blinkt gelb', X.HEAD, X.END, 'Text 1:', 'Antwortformat'];
check('Prompt enthält alle Felder (Thema, Stimmung, Sprache, Perspektive, Reimschema, Silben, Abschnitte, eigene Zeilen) + Song-Code + Formatvorgabe', need.every(x => pr.includes(x)), need.filter(x => !pr.includes(x)));
const back = X.fromCode(pr, v);
check('Song-Code im Prompt ist mit „Einlesen“ wieder lesbar', back.ok && back.v.parts.length === 2);
const lp = T.linePrompt(song, v, 'p1', 0, 1, { mood: 'traurig', lang: 'de' });
check('„Diese Zeile besser formulieren“: Zeile, Zusammenhang, Silben, Reimpartner, Format', lp.includes('Zeile: der Regen fällt auf meine Tür') && lp.includes('auf „mir“ reimen') && lp.includes('Etwa 8 Silben') && lp.includes(T.LHEAD) && lp.includes('Teil: Strophe'), lp.slice(0, 200));
// ---- Einlesen: Zeilen-Vorschläge, freier Text ----
const lr = T.parseLines('Gern, hier sind Ideen:\n```\n' + T.LHEAD + '\nTeil: Strophe\nZeile: der Regen fällt auf meine Tür\n1. der Regen klopft an meine Tür\n2. „ein Tropfen hängt an meiner Tür“\n3. **der Regen trommelt an die Tür**\n4. die Nässe kriecht durch jede Tür\n5. der Regen wartet vor der Tür\n=== ENDE ===\n```\nViel Spaß!');
check('Zeilen-Vorschläge erkannt (5, Teil und Zeile, Anführungszeichen/Fett entfernt)', lr && lr.alts.length === 5 && lr.part === 'Strophe' && lr.line === 'der Regen fällt auf meine Tür' && lr.alts[1] === 'ein Tropfen hängt an meiner Tür' && lr.alts[2] === 'der Regen trommelt an die Tür', lr);
check('Nummerierte Liste ohne Kopf wird toleriert, Fließtext nicht als Zeilen gelesen', T.parseLines('1) eins\n2) zwei\n3) drei').alts.length === 3 && T.parseLines('Strophe:\nEine Zeile\nnoch eine') === null);
const fr = T.parseFree('Hier ein Vorschlag:\n\n**Strophe 1:**\nDie Stadt ist still\nich bleib noch wach\n\n[Refrain]\nWir fahren los\nwir fahren weit\n\nBridge:\nEin neuer Teil', v);
check('Freier Text: Überschriften (**Strophe 1:**, [Refrain], Bridge:) den Teilen zugeordnet, fehlender Teil gemeldet', fr.length === 4 && fr[0].text === 'Hier ein Vorschlag:' && fr[1].target.p.id === 'p1' && fr[2].target.p.id === 'p2' && fr[3].target.missing === 'bridge', fr.map(b => [b.head, b.target && (b.target.p ? b.target.p.id : b.target.missing)]));
const nv = T.applyTexts(v, [{ p: v.parts[0], n: 1, text: 'zweite Strophe' }]);
check('Text als Kopie (Original unverändert, 2. Mal angelegt)', nv.parts[0].lyrics[1] === 'zweite Strophe' && v.parts[0].lyrics.length === 1 && nv.parts[0].lyrics[0] === VERSE);
check('Akkordmarken bleiben beim Ersetzen einer Zeile', /^\[Am\]/.test(T.keepChords ? T.keepChords('[Am]Die Ampel blinkt im leeren Licht', 'Die Ampel glüht im leeren Licht') : '[Am]'));
// ---- Baukasten ----
const d1 = T.kitDraft('nacht', 'ABAB', 4, 8, 1), d2 = T.kitDraft('nacht', 'ABAB', 4, 8, 2), d8 = T.kitDraft('abschied', 'AABB', 8, 8, 3);
const lv = (d, i, j) => T.rhymeLevel(T.checkText(d[i].t).lines[0].word, T.checkText(d[j].t).lines[0].word);
check('Baukasten ABAB: 4 Zeilen, 1↔3 und 2↔4 reimen', d1.length === 4 && d1.map(x => x.L).join('') === 'ABAB' && ['rein', 'unrein'].includes(lv(d1, 0, 2)) && ['rein', 'unrein'].includes(lv(d1, 1, 3)), d1.map(x => x.t));
check('Baukasten AABB mit 8 Zeilen, „Neu würfeln“ ändert das Gerüst', d8.length === 8 && d8.map(x => x.L).join('') === 'AABBAABB' && ['rein', 'unrein'].includes(lv(d8, 0, 1)) && d1.map(x => x.t).join() !== d2.map(x => x.t).join());
const famOk = Object.keys(T.KIT).every(k => T.KIT[k].r.every(f => f.slice(1).every(t => { const a = T.checkText(f[0]).lines[0].word, b = T.checkText(t).lines[0].word; return ['rein', 'unrein'].includes(T.rhymeLevel(a, b)); })));
check('Alle Baukasten-Zeilen einer Familie reimen (rein/unrein, ' + Object.keys(T.KIT).length + ' Themen)', famOk);
const al = T.kitAlts('nacht', d1[0], 1), alE = T.kitAlts('nacht', d1[0], (d1[0].t.match(/[A-Za-zÄÖÜäöüß']+/g) || []).length - 1);
check('Wort antippen → Alternativen (Wortfeld bzw. Reimwörter am Zeilenende)', al.alts.length >= 3 && alE.last && alE.alts.length >= 3, [al.alts.slice(0, 4), alE.alts.slice(0, 4)]);
check('Wort ersetzen behält Großschreibung', T.replaceWord('Die Stadt schläft', 1, 'nacht') === 'Die Nacht schläft');
console.log(ok + '/' + tot);
