# Looper – Übergabe für die nächste Sitzung

Stand: 6. Oktober 2026 · Version **v27** ist live unter https://tom444555.github.io/3nps/ · stabile Rückfall-Fassung **v24** unter https://tom444555.github.io/3nps/stabil/
Repository: `Tom444555/3nps` · Branch `main` = fertige App (GitHub Pages, inkl. Ordner `stabil/`) · Branch `entwicklung` = dieser Quellcode.
Sicherungen: Branch `stabil-v24` (App) und `stabil-v24-quellen` (Quellen) – Git-Tags lässt die Verbindung der Sitzung nicht zu.

## So geht es in einem neuen Chat weiter

Dem neuen Chat schreiben:

> Lies die Übergabe im Branch `entwicklung` von Tom444555/3nps (UEBERGABE.md) und stelle die Arbeitsumgebung mit `wiederherstellen.sh` her. Dann: …

Die Sitzung klont dann `git clone -b entwicklung https://github.com/Tom444555/3nps.git /home/claude/3nps-src`
und führt `sh /home/claude/3nps-src/wiederherstellen.sh` aus (legt alles nach `/home/claude/3nps`, erzeugt das
Testaudio neu, baut die App, startet den Testserver auf Port 8765).

## Wer und wofür

- Gitarrist, arbeitet nur auf dem **iPad** (Logic Pro für iPad, Mac nur selten). Interface: **Spark LIVE** über USB,
  Fußpedal **M-VAVE Chocolate** (Tastatur-Modus). Sprache: Deutsch, einfache Erklärungen.
- Achtet auf sein Claude-Nutzungslimit: gebündelt arbeiten, wenig Rückfragen, große Blöcke am Stück.

## Aufbau des Quellcodes

| Datei | Inhalt |
|---|---|
| `script.part` | Grundprogramm (Griffbrett, Skalen, Begleitung, Drone-Grundlage, Übungslog); Bass wird über `bass.js` erzeugt |
| `app/looper.js` | Looper: 3 Stereo-Spuren, Aufnahme, Overdub, Editor, Export für Logic, Sitzungen, Autosicherung, Akkorde im Spurkopf, Abgleich |
| `app/jam.js`, `jam.html`, `jam.css` | Jam: Akkordfolge, Begleitung (Drums, Bass folgt Akkorden über `window.bassChordAt`, Fläche), Tempo-Trainer |
| `app/uebung.js`, `uebung.html`, `uebung.css` | Üben: Tagesübung, Gehörbildung, Licks + eigene Licks, Solo-Auswertung |
| `app/voicings.js`, `pitch.js`, `licks.js` | Akkordgriffe (CAGED), Tonhöhenerkennung (YIN), Lick-Bibliothek – je auch in Node prüfbar |
| `app/passt.js`, `passt.css` | „Was passt“-Box oben in der Looper-Karte (vor `.looper-top`), volle Breite, nutzt `SoloFinder.quick()`; bleibt nach dem ersten Einblenden stehen (kein Seitensprung beim Start/Stopp) |
| `app/solo.js`, `solo.html`, `solo.css` | Solo Finder (Reiter „Solo Finder“): Akkordleiste, Tonart, mögliche Akkorde/Färbungen, Tonleitern mit Griffbild, nächster Wechsel, Ideen-Würfel |
| `app/circle.js`, `circle.html`, `circle.css` | Quintenzirkel (Reiter „Quintenzirkel“): Tonart wählen, Akkorde anhören, ins Griffbrett übernehmen, klingender Looper-Akkord |
| `app/beat.js` | Takterkennung: Tempo, Schlagraster, Feinbestimmung (~1 ms), Takt-Eins, freies Intro, Loop-Analyse |
| `app/chords.js` | Akkorderkennung je Schlag (HPSS, Stimmung, Chroma, Vorlagen, Viterbi) |
| `app/analysis.js` | Analyse-Worker (Tonart, Takt, Loop, Akkorde) – Funktionen werden als Text in den Worker kopiert |
| `app/bass.js` | Bass-Synthese (gezupfte Saite), läuft im Worker beim Start |
| `app/rhythm.js`, `kit.js` | Drums (Kit wird im Worker synthetisiert), Drum Designer, Bass der Begleitung |
| `app/drones.js` | Drone-Klänge v1–v8 |
| `app/eq.js` | 7-Band-EQ (Spuren, Drums, Export) |
| `app/appcfg.js` | Optik (nordic, metal, amp, ice), Sicherung/Wiederherstellung, Mac-Hinweise |
| `app/*.css`, `looper.html`, `head_app.html` | Oberfläche, vier Optiken |
| `app/build.py` | baut `app/www/index.html` (alles in einer Datei, CSP, eingebettete Schriften) und `preview.html` |
| `app/tex/*.py` | erzeugen die Texturen/Icons der Optiken |
| `tabs.js` | Reiter-Umschaltung (Ereignis `tabchange`) |
| `test/` | Tests (Playwright/Chromium) und Auswertungen (Node) |

## Arbeitsablauf

1. Quellen in `/home/claude/3nps/app` bzw. `script.part` ändern.
2. `python3 app/build.py` → `app/www/`.
3. Testserver: `sh test/srv.sh` (Port 8765). Tests ausführen (siehe unten).
4. Version hochzählen: `head_app.html` (Marke „3nps · vXX“) und `app/www/sw.js` (`CACHE = '3nps-vXX'`).
5. Veröffentlichen: Repo `main` klonen, `app/www/*` hineinkopieren, committen (Autor „Claude <noreply@anthropic.com>“
   mit den Attributionszeilen), pushen, GitHub-Actions-Lauf „pages build and deployment“ prüfen.
   Danach den Branch `entwicklung` mit den Quellen aktualisieren (diese Datei mitpflegen).
6. Auf dem iPad: App zweimal öffnen, dann ist die neue Version aktiv.

## Tests und erwartete Ergebnisse (v27)

- Browser: `v27passt.py` 17/17 („Was passt“-Box oben, Anhalten, Akkordwahl) · `v25grips.py` 10/10 · `v25jam.py` 21/21 · `v25listen.py` 9/9 · `v25ueben.py` 28/28 · `v25stress.py` 6/6 · `tempotest.py` 3/3 ·
  `swtest.py` 5/5 (Haupt- und stabile Fassung, braucht Pages-Nachbau auf Port 8790) · `tabcost.py` (Öffnen der Reiter, Vergleich mit v24) ·
  `v24solo.py` 22/22 (Solo Finder) · `v22key.py` 7/7 (Zirkel folgt Spur-Tonart) · `v21test.py` 8/8 (Spurkopf) · `v21tabs.py` 18/18 (Reiter, Quintenzirkel) · `v20test.py` 14/14 · `suite.py` 81/81 · `stereotest.py` 16/16 · `eqtest.py` 9/9 · `restoretest.py` 7/7 ·
  `backuptest.py` 7/7 · `csptest.py` (keine fremden Anfragen) · `crashtest.py`, `taptest.py` (Speicher stabil) ·
  `rec_fit.py 1` 10/10 · `importall.py` 57/63 (bekannte Fälle: Eins bei Shuffles) · `synctest.py`, `firsthit.py`,
  `drone78.py`, `mono_rec.py`, `sesstest.py`, `droptest.py`, `pedaltest2.py` ohne Fehler.
  `glitchtest.py` vergleicht mit einer alten Version auf Port 8766 (optional).
- Takterkennung (Node): `node precision.js` → Tempo 49/52, Eins 47/52, Schlagfehler Median 1,0 ms ·
  `node longeval.js` → 5/6 (Ballade 74 BPM wird als 148 erkannt) · `sh evalall.sh` (Loops 102/112 + 11/11).
- Prüfskripte (Node): `node voicingcheck.js` (547 Griffe fehlerfrei) · `node pitchcheck.js` (292/294) · `node lickcheck.js` (384 Platzierungen fehlerfrei)
- Tonart (Node): `node keyeval.js` → bisher (nur Chroma) 36/59, neu (Chroma + Akkordfolge) 52/59; Korpus `test/keys` aus `gen_keys.py`.
- Akkorde (Node): `node chordeval.js` → Grundton 95,5 %, exakt 91,5 % · `node chordsong.js` → 82,8 % (Riffs ohne Terz schwerer).

## Technische Eckpunkte

- **Reiter (v26):** Looper (links, Start) · Quintenzirkel · Improvisation · Backing Track · Training · Technik (Leiste: so viele Spalten wie Reiter, Handy 3×2).
  Nur die Beschriftungen sind neu; intern heißen sie weiter `solo`, `jam`, `ueben`, `griffbrett` (IDs `tab-…`/`panel-…`, Tests, gespeicherter Reiter). Begleitung (Drone, Drums, Bass), Song und
  Übungslog sind Karten im Griffbrett (Zwischenüberschriften `.sub-head`). `tabs.js` leitet alte gespeicherte Reiter
  (`begleitung`, `song`, `log`) aufs Griffbrett um; die Drum-Spur wandert bei `tabchange` = `griffbrett` in `#beglDrumsHome`.
- **Spurkopf (v22):** links Name + Tonart (`.th-left`), rechts `#thc0–2` mit klingendem (`#chd`) und nächstem Akkord (`#chn`),
  nur beim Abspielen, aktualisiert in `tick()`. Die Akkordleiste unter der Wellenform gibt es nicht mehr (Editor zeigt Akkorde je Takt).
  `Looper.nowChord()` liefert den klingenden Akkord auch, wenn der Looper-Reiter nicht sichtbar ist (Quintenzirkel).
- **Tonart (v24):** `Analyzer.key` liefert jetzt auch die Chroma; nach der Akkorderkennung schärft `refineKey(t)` die Tonart
  mit `keyFromChords()` (analysis.js) nach: Diatonik-Passung, Dauer der Tonika, Akkord auf Takt 1, Kadenz, V7→I,
  Dur-Dominante in Moll, 6er-Akkorde auch als Moll-7 eine kleine Terz tiefer. Song-Player nutzt noch die reine Chroma.
- **Solo Finder:** liest `Looper.chordInfo(spur)` (Abschnitte in Frames, Taktanfänge, Position, Tonart) und springt mit
  `Looper.seek()`; Akkord-/Tonklang über `Quinten.play(root, intervalle)` / `Quinten.playNote(midi)`.
  Tonleiter-Wahl: Kirchentonleiter (bzw. HM/Phrygisch-Dominant/Melodisch Moll) auf dem Akkordgrundton, die alle
  Akkordtöne enthält und die meisten Töne mit der Tonart teilt; dazu Pentatoniken, Blues, Akkordtöne, „mutig“.
- **Stabile Fassung:** `main/stabil/` = unveränderte v24 mit Speicher `stabil-v24`; die Hauptfassung (`app/www/sw.js`) löscht nur
  eigene `3nps-…`-Speicher und lässt `/stabil/` aus. Beide teilen localStorage/IndexedDB → Speicherformate nur erweitern, nie ändern.
  Beim Veröffentlichen `app/www/*` nach `main` kopieren (der Ordner `stabil/` bleibt unberührt).
- **Rhythmus (v25):** Tempowechsel bei frei laufenden Drums setzt die Schrittzählung nahtlos fort (vorher Sprung im Muster).
  Neu: `Rhythm.setJam`, `Rhythm.addListener(fn, first)` (Jam wird vor dem Bass gemeldet), Drum-Spur wandert auch in den Jam.
- **Jam:** zählt Schläge über die Taktmeldungen, setzt `window.bassChordAt` (in build.py in `playBassNote` eingebaut).
  Looper hat Vorrang (`Looper.busy()`, `Looper.stopAll()`). `Jam.chordInfo()` hat dasselbe Format wie `Looper.chordInfo()`.
- **Mithören:** `Looper.inputAnalyser()` hängt einen Analyser an denselben Eingang (kein zweiter Mikrofonzugriff), bleibt nach
  Neuverbindung angeschlossen. YIN auf halber Rate, alle 60 ms, nur bei offenem Solo Finder.
- **Solo-Auswertung:** `Looper.soloData(i)`; Tonhöhe alle 10 ms, Anschläge über 1-ms-Energie (genau `sr/1000` Samples je ms),
  Raster aus den Schlägen der Akkord-Spur. Test legt das Solo mit `Looper._setTrack()` direkt in die Spur (Datei-Import
  passt Loops ans Tempo an und verschiebt minimal).
- **Quintenzirkel:** SVG, englische Tonnamen wie im übrigen Programm (B = H), Schreibweise je Tonart (E♯ in F♯-Dur usw.);
  liest den klingenden Akkord über `Looper.nowChord()`; folgt dem Ereignis `trackkey`
  (aus `showKey()` in looper.js, sobald sich die erkannte Tonart einer Spur ändert) und jeder Änderung von Grundton/Modus; `window.Quinten` für Tests.

- **Stereo-Modell:** Audio-Stücke sind `{l, r, length}`; Mono-Quellen teilen ein Feld (`r === l`). iPadOS liefert über
  getUserMedia nur Mono – Stereo-Aufnahme geht dort erst mit nativer Hülle.
- **Speicher:** Overdubs werden in eine Fassung eingerechnet, Rückgängig-Verlauf höchstens 160 MB, Autosicherung in
  IndexedDB (bis 150 MB), Wiederherstellen-Leiste nach Absturz.
- **Takterkennung:** grobe Analyse (Fluss-Merkmale, Autokorrelation, DP-Schlagverfolgung) → `beatRefine` misst Anschläge
  (log. Energieanstieg, 3-ms-Fenster) und legt robuste Geraden (gerade/gleitend) → freies Intro über den Anteil
  der Anschlag-Energie auf dem Raster → Takt-Eins (Bass, Akkordwechsel, Crash-Becken). Exakt geschnittene Loop-Dateien
  bleiben unverändert.
- **Abgleich:** `fineAlign` korreliert 1-ms-Anschlagkurven (log. Anstieg), ±60 ms bzw. 1/32; neue Aufnahmen auf Spur 2/3
  automatisch (Einstellung `3nps-autoalign`), rückgängig über ↶.
- **Anzeige:** `playFrame()` = hörbare Position (`getOutputTimestamp`), Wellenform in Gerätepixeln, erkanntes Raster.
- **Sicherheit:** CSP ohne fremde Quellen, Schriften eingebettet (OFL), keine Server, keine Datenerhebung.
- **Rechtliches:** keine fremden Samples mehr (Bass selbst erzeugt), Schriften OFL, keine fremden Logos.

## Bekannte Grenzen

- Takt-Eins bei Shuffles/12/8-Blues manchmal einen Schlag daneben (Editor: „◀ / ▶ 1 Schlag“).
- Langsame Balladen mit Achteln können doppelt so schnell erkannt werden („½ Tempo“).
- Bei stark schwankendem Spiel ist die erste Aufnahme ±10–25 ms in der Länge ungenau.

## Vergleichstests gegen die stabile v24

- `vergleich.py URL gemeinsam|voll SEKUNDEN SEED` – gleiches Zufallsszenario (Overdubs, Rückgängig, Editor, Reiter, Tempo, Optik,
  Drum-/Drone-Wechsel; „voll“ zusätzlich Backing Track, Training, Mithören, Anhalten). Ausgabe: JSON (Fehler, Speicher, Bildzeiten,
  lange Tasks, späte Drum-Schläge, Tempo des Audio-Takts).
- `aktionen.py URL` – Stocken je Bedienschritt (Summe der Bildzeit über 33 ms). `idle.py URL [zu]` – 60 s nur Abspielen.
- Stabile v24 lokal: `3nps-main` unter Port 8790 bereitstellen (`…/3nps/stabil/index.html`).

## Bekannte Grenzen (v25)

- Öffnen der Reiter Jam/Griffbrett dauert ~100 ms (die Drum-Spur wandert mit) – wie in v24 beim Griffbrett; Ton bleibt pünktlich.
- Mithören erkennt einzelne Töne, keine Akkorde; bei Doppelgriffen gewinnt der deutlichere Ton.

## Nächste Schritte (warten auf den Nutzer)

1. **Native Hülle (iPad-App) + AUv3-Plugin für Logic**, gebaut mit GitHub Actions (macOS), verteilt über TestFlight,
   später App Store. Hülle: WKWebView mit gebündelter App, Neustart nach Abbruch des Web-Prozesses + Wiederherstellen,
   Mikrofon-Erlaubnis einmalig, AVAudioSession (Puffer, USB-Wechsel), später nativer Stereo-Eingang.
2. **Entscheidungen des Nutzers:** Repository öffentlich oder privat (bei Verkauf privat empfohlen) · App-Name
   („Looper“ ist im App Store vermutlich vergeben) · Preismodell (Kaufpreis, kostenlos + „Pro“ als In-App-Kauf,
   Trinkgeld per In-App-Kauf) · EU-Händlerstatus (bei Einnahmen: Name/Adresse öffentlich).
3. **Nur der Nutzer kann:** Apple Developer Program (99 €/Jahr), Verträge/Bank/Steuer in App Store Connect,
   App-Eintrag einmal anlegen, API-Schlüssel erstellen und als GitHub-Secret hinterlegen, Händlerstatus angeben.
4. Danach übernimmt Claude: Bau, Signieren, TestFlight, Store-Texte (DE/EN), Screenshots, Datenschutz-/Support-Seite,
   Einreichen, Updates.
