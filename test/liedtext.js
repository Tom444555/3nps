// Prüfskript Text & Song-Code: node liedtext.js
const C = require('../app/lied-core.js'), T = require('../app/lied-text.js');
let ok = 0, n = 0; const check = (name, c, info) => { n++; if (c) ok++; console.log((c ? 'OK    ' : 'FEHLER') + '  ' + name + (info !== undefined ? '  · ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); };
// Silben
const S = [['Ich steh am Fenster und seh hinaus', 9], ['Die Liebe ist ein seltsames Spiel', 9], ['Heute Nacht', 3], ['Träume', 2], ['Feuer und Eis', 4], ['[Am]Ich geh [F]allein', 4]];
S.forEach(([l, s]) => check('Silben DE: ' + l, T.syllables(l, 'de') === s, T.syllables(l, 'de')));
const SE = [['I walk alone tonight', 6], ['Love will tear us apart again', 8], ['the time has come', 4], ['I loved you more', 4]];
SE.forEach(([l, s]) => check('Silben EN: ' + l, T.syllables(l, 'en') === s, T.syllables(l, 'en')));
check('Sprache erkannt', T.lang(['I walk alone tonight and you are my love']) === 'en' && T.lang(['Ich steh am Fenster und du bist nicht da']) === 'de');
// Reime
const R = [['Herzen', 'Schmerzen', true], ['Nacht', 'gemacht', true], ['Liebe', 'Triebe', true], ['Wald', 'kalt', true], ['Haus', 'raus', true], ['Sonne', 'Wonne', true], ['Mond', 'Sterne', false], ['Zeit', 'weit', true], ['Tag', 'mag', true]];
R.forEach(([a, b, y]) => check('Reim DE ' + a + '/' + b, (T.rhymeKey(a, 'de') === T.rhymeKey(b, 'de')) === y, T.rhymeKey(a) + ' ' + T.rhymeKey(b)));
const RE = [['night', 'light', true], ['time', 'rhyme', true], ['away', 'today', true], ['heart', 'apart', true], ['love', 'night', false], ['fire', 'desire', true]];
RE.forEach(([a, b, y]) => check('Reim EN ' + a + '/' + b, T.rhymes(T.rhymeKey(a, 'en'), T.rhymeKey(b, 'en'), 'en') === y, T.rhymeKey(a, 'en') + ' ' + T.rhymeKey(b, 'en')));
check('Reimschema ABAB', T.scheme(T.lines('Ich geh durch die Nacht\nund denk an dich\nhab nie daran gedacht\ndu vergisst mich nicht', 'de')) === 'ABAB', T.scheme(T.lines('Ich geh durch die Nacht\nund denk an dich\nhab nie daran gedacht\ndu vergisst mich nicht', 'de')));
check('Reimschema AABB', T.scheme(T.lines('Es ist kalt\nim dunklen Wald\nich bin allein\nim Mondenschein', 'de')) === 'AABB');
// Akkordtext
const r = T.parseChords('Am F C:2 G:½ D7:½ Bbmaj7 F#m7b5 Hm');
check('Akkorde lesen', r.bad.length === 0 && r.seq.length === 8 && r.seq[2].beats === 8 && r.seq[3].beats === 2 && r.seq[5].r === 10 && r.seq[5].t === 'maj7' && r.seq[7].r === 11, r);
const K = { pc: 9, major: false };
check('Akkorde schreiben', T.chordText(r.seq.slice(0, 5), K) === 'Am F C:2 G:½ D7:½', T.chordText(r.seq.slice(0, 5), K));
// Song mit Text
const mk = (id, name, type, txt, lyrics) => ({ id, name, type, chords: T.parseChords(txt).seq, lyrics: lyrics || [], audio: null });
const v = { n: 3, key: { pc: 9, major: false }, bpm: 92, theme: 'Nachtfahrt, Abschied', parts: [
  mk('v', 'Strophe', 'verse', 'Am F C G', ['Ich fahr durch die Nacht\nund die Straße ist leer\nhab an dich gedacht\ndoch du bist nicht mehr', 'Die Lichter der Stadt sie sind so weit weit weg von hier und noch viel weiter\nzweite']),
  mk('c', 'Refrain', 'chorus', 'F G Am Am', ['Nachtfahrt, nur ich und der Wind\nNachtfahrt, bis wir woanders sind']),
  mk('b', 'Bridge', 'bridge', 'Dm Em F G', [])], order: [{ p: 'v', reps: 1 }, { p: 'c', reps: 1 }, { p: 'v', reps: 1 }, { p: 'c', reps: 2 }, { p: 'b', reps: 1 }, { p: 'c', reps: 1 }] };
v.parts[0].audio = 'a1'; v.parts[0].audioSig = C.sig(v.parts[0].chords); v.parts[0].audioBpm = 92;
const occ = T.occurrences(v);
check('Vorkommen gezählt', occ.map(o => o.p.id + o.n).join(' ') === 'v0 c0 v1 c1 c2 b0 c3', occ.map(o => o.p.id + o.n).join(' '));
check('Refrain beim 2. Mal = Text vom 1. Mal', T.lyricsOf(v.parts[1], 2).same && T.lyricsOf(v.parts[1], 2).text.startsWith('Nachtfahrt'));
check('Strophe 3 ohne eigenen Text bleibt leer', T.lyricsOf(v.parts[0], 2).text === '');
const F = T.analyse(v, 'Nachtfahrt'); const ft = F.map(f => f.text).join(' | ');
check('Prüfung: Bridge ohne Text', /Ohne Text: Bridge/.test(ft), ft.slice(0, 200));
check('Prüfung: Silbenzahl Strophe 2', /Strophe“, 2\. Mal: Zeile 1/.test(ft));
check('Prüfung: Titel im Refrain', /Titel steckt im Refrain/.test(ft));
check('Prüfung: Titel fehlt → Tipp', /kommt im Refrain nicht vor/.test(T.analyse(v, 'Sommerregen').map(f => f.text).join(' ')));
// Leadsheet
const ls = T.leadsheet({ name: 'Nachtfahrt' }, v);
check('Leadsheet: Abschnitte', ls.sections.map(s => s.head).join(' / ') === 'Strophe 1 / Refrain / Strophe 2 / Refrain (wie oben) ×2 / Bridge / Refrain (wie oben)', ls.sections.map(s => s.head).join(' / '));
const s0 = ls.sections[0];
check('Leadsheet: Akkorde über den Zeilen verteilt', s0.rows.length === 4 && s0.rows.every(x => x.chords.length === 1) && s0.rows[1].chords[0].n === 'F', s0.rows.map(x => x.chords.map(c => c.n + '@' + c.i)));
check('Leadsheet: Bridge als Taktraster', ls.sections[4].grid.join('|') === 'Dm|Em|F|G');
const inl = T.inlineChords('[Am]Ich geh [F]allein');
check('Akkordmarken im Text', inl.text === 'Ich geh allein' && inl.chords[1].i === 8 && inl.chords[1].n === 'F');
// Song-Code hin und zurück
const code = T.toCode({ name: 'Nachtfahrt' }, v, { voice: 'Bariton' });
const back = T.fromCode('Hier ist der Code:\n```\n' + code + '\n```\nViel Spaß', v);
check('Song-Code: unverändert zurück', back.ok && T.diff(v, back.v, 'Nachtfahrt', back.title).length === 0, back.errs.concat(T.diff(v, back.v)));
check('Song-Code: Aufnahme bleibt gültig', back.v.parts[0].audio === 'a1' && !C.audioStale(back.v.parts[0]));
check('Song-Code: Prompt enthält Aufgabe und Code', /Aufgabe: Schreib den Text weiter/.test(T.prompt({ name: 'X' }, v, 'text')) && T.prompt({ name: 'X' }, v, 'text').includes(T.HEAD));
// Claude ändert etwas
const changed = code.replace('Akkorde: Am F C G', 'Akkorde: Am F C E7').replace('Ablauf: Strophe | Refrain | Strophe | Refrain x2 | Bridge | Refrain', 'Ablauf: Intro | Strophe | Refrain | Strophe | Refrain | Bridge | Refrain x2')
  .replace('## Bridge [Bridge]\nAkkorde: Dm Em F G\nText 1:\n(leer)', '## Bridge [Bridge]\nAkkorde: Dm Em F G:2\nText 1:\nUnd wenn der Morgen kommt\nbin ich schon fort')
  .replace('Notiz:', '## Intro [Intro]\nAkkorde: Am:2\n\nNotiz: Intro ergänzt, Bridge getextet, E7 am Strophenende');
const c2 = T.fromCode(changed, v);
const d = T.diff(v, c2.v, 'Nachtfahrt', c2.title);
check('Änderung erkannt: Akkorde Strophe (Aufnahme stumm)', d.some(x => /„Strophe“: Akkorde Am F C G → Am F C E7 \(Aufnahme wird stumm\)/.test(x)), d);
check('Änderung erkannt: neuer Teil Intro, Ablauf, Bridge-Text', d.some(x => /Neuer Teil „Intro“/.test(x)) && d.some(x => /^Ablauf: Intro/.test(x)) && d.some(x => /„Bridge“: .*Text neu/.test(x)));
check('Notiz gelesen', c2.note === 'Intro ergänzt, Bridge getextet, E7 am Strophenende', c2.note);
check('Aufnahme nach Akkordänderung stumm', C.audioStale(c2.v.parts.find(p => p.name === 'Strophe')));
check('Wiederholung x2 gelesen', c2.v.order[c2.v.order.length - 1].reps === 2);
// Fehler
const bad = T.fromCode(code.replace('Ablauf: Strophe', 'Ablauf: Vers').replace('Akkorde: F G Am Am', 'Akkorde: F G Xm Am'), v);
check('Fehler werden gemeldet', !bad.ok && bad.errs.some(e => /„Vers“ gibt es nicht/.test(e)) && bad.errs.some(e => /Xm/.test(e)), bad.errs);
check('Kein Code → Hinweis', !T.fromCode('Hallo, das ist nur Text', v).ok);
// lockeres Format (Claude schreibt etwas anders)
const loose = T.fromCode('=== 3NPS SONG-CODE v1 ===\nTitel: Neu\nTonart: E Moll\nTempo: 100\nAblauf: Verse, Chorus x2\n\n### Verse\nAkkorde: Em | C | G | D\nText 1: Erste Zeile\nzweite Zeile\n\n### Chorus\nChords: C D Em Em\nLyrics 1:\nHey\n=== ENDE ===', null);
check('Lockeres Format gelesen', loose.ok && loose.v.key.pc === 4 && !loose.v.key.major && loose.v.parts[0].type === 'verse' && loose.v.parts[1].type === 'chorus' && loose.v.parts[0].lyrics[0] === 'Erste Zeile\nzweite Zeile' && loose.v.order[1].reps === 2, loose.errs.concat(loose.warn || []));
// Zufallstexte robust
let crash = 0; for (let i = 0; i < 300; i++) { const s = Array.from({ length: 40 }, () => String.fromCharCode(32 + Math.floor(Math.random() * 400))).join(''); try { T.lines(s + '\n' + s, 'de'); T.syllables(s); T.fromCode(T.HEAD + '\n' + s, v); } catch (e) { crash++; } }
check('300 Zufallstexte ohne Absturz', crash === 0, crash);
// PDF
const P = require('../app/lied-pdf.js');
const long = JSON.parse(JSON.stringify(v)); long.parts[0].lyrics[0] = '[Am]Ich fahr durch die [F]Nacht, die Straße ist leer und der Regen fällt leise auf das Dach über mir\nund die Straße ist leer\nhab an dich gedacht\ndoch du bist nicht mehr';
for (let i = 0; i < 6; i++) long.order.push({ p: 'v', reps: 1 });
long.parts[0].lyrics.push(...Array.from({ length: 8 }, (_, i) => 'Strophe ' + (i + 3) + ' Zeile eins\nZeile zwei mit Ümläuten ÄÖÜß – „Anführung“\nZeile drei\nZeile vier'));
const pdf = P.build(T.leadsheet({ name: 'Nachtfahrt (Test)' }, long));
require('fs').writeFileSync(process.env.OUT || '/tmp/lead.pdf', Buffer.from(pdf.bytes));
check('PDF erzeugt, mehrseitig', pdf.bytes.length > 2000 && pdf.pages >= 2, pdf.pages + ' Seiten, ' + pdf.bytes.length + ' Bytes');
console.log(ok + '/' + n);
