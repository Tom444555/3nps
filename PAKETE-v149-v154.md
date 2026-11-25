# Pakete v149–v154 (Auftrag von Tom am 25.11.2026: „Mach alles fertig“)

Ausgangsstand: v148 live (Studio entfernt). Ein Paket = eine Version = eine Veröffentlichung, streng nacheinander.
Offen und NICHT Teil dieser Pakete: Songbook und Tonleiter-Trainer (Konzept erst mit Tom klären).

## Rahmen (gilt für jedes Paket)
- Quellen `/home/claude/3nps-src` (Branch entwicklung), Veröffentlichung `/home/claude/3nps-main` (main). `UEBERGABE.md` und `ARBEITSWEISE.md`
  nie ganz lesen: `grep -n '^## '`, dann Kopfzeile, Abschnitt 8 (Tests) und Abschnitt 11 „Als Nächstes“ gezielt mit `sed -n`. Quellcode mit `grep -n` suchen,
  nur betroffene Funktionen lesen (`looper.js` nie ganz). Testausgaben `| tail -3`.
- Bauen NUR `python3 app/build.py` (nie `app-studio/build.py`). Testserver `sh test/srv.sh` vor jedem Testlauf. Playwright-Tests nacheinander,
  Navigation über `test/nav.py`. Pages-Nachbau `sh test/pages.sh`. Testaudio liegt unter `/home/claude/3nps/test/` (fehlt es: `sh wiederherstellen.sh`).
- Regeln: Looper-Leistung und Stabilität zuerst; Klang und Timing bestehender Funktionen bleiben gleich; nichts springt beim Mitlaufen (feste Höhen);
  Schweres nur bei Bedarf/geöffneter Ansicht; kleinste Diffs, nichts nebenbei umbauen; localStorage/IndexedDB nur erweitern (kein neuer Store, keine
  neue DB-Version); CSP lokal, keine fremden Quellen; neue Texte auch englisch in `app/i18n-en2.js`; alles muss in den vier Geräte-Profilen
  (Automatisch · Neues iPad · Altes iPad · Minimal) und in den Optiken nordic, precise-dark, ios funktionieren; Bedienelemente ≥ 44 px;
  Gewohntes bleibt Standard, Neues ist zusätzlich.
- Ablauf: `git pull --rebase origin entwicklung` → umsetzen → Version +1 (`app/head_app.html`, `app/www/sw.js` CACHE, `test/v31export.py`) → bauen →
  neuer Test `test/vNNname.py` (inkl. „ab vNN“ und „keine Skriptfehler“, 1366×1024, 820×1180, 390×844) → Regressionen → Screenshots der geänderten
  Stelle selbst ansehen und nach `/tmp/shots/vNN_*.png` legen (2–4 Stück, für Tom) → Doku (`app/www/ANLEITUNG.txt` neuer Abschnitt, Thema in
  `app/hilfe-daten.js` bei neuer Funktion, `UEBERGABE.md`: Kopfzeile, Verlaufszeile nach der letzten, Testliste, „Als Nächstes“) → Commit entwicklung
  (deutsch; Dateien einzeln hinzufügen, nie `git add -f app`) + Push → main: `cd /home/claude/3nps-main && git pull --rebase && cp -r /home/claude/3nps-src/app/www/. ./`,
  commit, push, warten bis `gh run list -R Tom444555/3nps -b main -L 1` „completed success“ zeigt und
  `git show origin/main:index.html | grep -o '3nps · v[0-9]*'` die neue Version nennt.
- Commit-Ende (beide Branches):
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01MK1eRjSS7zQ5Z5kcwzfHFk
- Regressionen (alle, nacheinander): neuer Test, v148ohnestudio v146rig v147spark v102ideas v59lang v60lang v31export v113hilfe v116looperA v117looperB
  v118signal v120power v127look v134leiste v136reiter v137lernen v138jammen v140optik v141zeichnen v142geraet v143bedienung v144design v35 v34perf
  v63singen v81vox v85singen v124trennen; bei Audio-/Start-/Leistungs-Änderungen zusätzlich v119leistung (~15 min), v100mem, v145start (`OLD=<main-Commit der Vorversion>`, vorher `sh test/pages.sh`).
  Bekannt rot schon vor v149 (nicht reparieren, nur nicht verschlechtern): v119leistung „Drone v1: Schleife klingt wie live“, v145start „Update nordic offline“.
  Alles andere muss grün sein, sonst nicht veröffentlichen.
- Geht ein Paket nicht sauber (Tests rot, Wirkung nicht nachweisbar, Risiko für den Looper): NICHT veröffentlichen, Stand als Branch `vNN-entwurf` pushen,
  in UEBERGABE „Als Nächstes“ beschreiben und das ehrlich melden.
- Rückmeldung je Paket höchstens 15 Zeilen: was für Tom anders ist und wo (Knopfnamen in „…“), Vorher/Nachher-Zahlen, Testergebnis (Anzahl grün, was rot),
  Pfade der Bilder, Grenzen, live-Nachweis. Keine Rohdaten.

## v149 – Schnellerer Start
Messung (PRUEFBERICHT-v145.md): 4× gedrosselt liegen zwischen „geladen“ (~1,0 s) und „bedienbar“ (~2,2 s) lange Aufgaben nach dem Laden; vermutet
`ensureAudio` → `loadBassSamples`, `buildTails`/`rhythm.js`, `kitToBuffers`. Erst mit einem Profil belegen (CDP-Profiler oder Zeitmarken), was die langen
Aufgaben wirklich sind. Dann das Belegte aus dem Start nehmen: erst bei erstem Bedarf oder in Leerlauf-Häppchen (kurze Stücke, nie während Aufnahme/Wiedergabe),
so dass der erste Drum-/Bass-Einsatz pünktlich und klanggleich bleibt (v118signal, v119leistung). Vorher/Nachher mit `python3 test/mess/mess.py <URL> <Name> start`
(v148 = main-Stand auf eigenem Port). Ziel: „bedienbar“ gedrosselt deutlich früher; ist der Gewinn < 10 %, nicht veröffentlichen, sondern melden.

## v150 – Tap-Tempo
Knopf „Tap“ beim Tempo in der Kopfleiste (≥ 44 px, verschiebt nichts): ab dem 2. Tipp Tempo aus dem Mittel der letzten Tipps (bis 6, Pause > 2 s beginnt neu,
30–300 BPM), setzt das Tempo genau so wie die vorhandenen „−/+“-Knöpfe (gleiche Funktion aufrufen, gleiche Sperren bei geladenen Loops). Wenn das Fußpedal
über Tastatur-Tasten angebunden ist und eine freie Taste sauber passt, optional eine Taste dafür – sonst weglassen. Anleitung-Thema, EN-Text, Test.

## v151 – Mastering als Karte im Looper
Seit v148 ist das Mastering-Fenster weg (lag seit v112 im Studio: `app-studio/mst.js`, Kern `app/master.js` = `window.Master`, wird weiter gebaut; vor v112
gab es Mastering im Looper – siehe Git-Verlauf und `KONZEPT-MASTERING.md`). Mastering M1 als eingeklappte Karte „Mastering“ im Looper beim Export zurückholen:
Quelle aktueller Loop-/Song-Mix oder „Datei laden …“, Ziel-Lautheit (z. B. Streaming −14 LUFS), Vorhören Vorher/Nachher, „Als WAV exportieren“.
Code und Oberfläche erst beim Öffnen der Karte aufbauen, kein Einfluss auf den Signalweg solange sie zu ist; in „Minimal“ ausgeblendet. Anleitung-Thema
`mastering` wieder aufnehmen (+ `test/v113hilfe.py` Suche „Mastering“). Test inkl. Pegelprüfung des Ergebnisses.

## v152 – Übe-Verlauf als Diagramm
Aus den vorhandenen Übungsdaten (Übungslog / Training / „Heute üben“; erst nachsehen, was wo in localStorage liegt) einen Verlauf im Börsenkurs-Stil:
großer aktueller Wert, ▲/▼-Veränderung zum Vorzeitraum, Zeitraum-Knöpfe (1W · 1M · 3M · 1J · Alles), Hoch/Tief, Linie als SVG. Mindestens „Übezeit je Tag/Woche“,
dazu „Tempo“ wo Daten da sind. Nur lesen, bestehende Speicherformate nicht ändern (fehlt etwas, nur ein neues Feld/neuer Schlüssel). Ort: dort, wo das
Übungslog heute steht, als eigene Karte; wird erst beim Öffnen gebaut, keine Timer. Leerzustand mit Hinweis. Test mit vorbelegten Daten.

## v153 – Takt-Eins bei Shuffle und 12-Takt-Blues
Bekannte Grenze (UEBERGABE Abschnitt 10): Takt-Eins liegt bei Shuffles/Blues manchmal zwei Schläge daneben (1 ↔ 3). Mit dem Testkorpus
(`test/gen_*.py`, Auswertungen `liedcheck.js`, `chordeval.js` u. a.; ggf. eigene Shuffle-/Blues-Fälle erzeugen) erst die Trefferquote vorher messen, dann die
Entscheidung 1 ↔ 3 verbessern (z. B. Akkordwechsel-/Bass-Gewicht auf der Eins). Veröffentlichen NUR, wenn Shuffle/Blues besser wird und KEIN anderer
Korpus-Fall schlechter (Zahlen vorher/nachher in die Rückmeldung). Sonst nichts ändern und das Ergebnis der Untersuchung in UEBERGABE notieren.

## v154 – Aufräumen nach dem Studio (zuletzt)
Ganz entfernen, was seit v148 niemand mehr erreicht: im Looper `goStudio`, Ereignis `looper-studio`, Rückweg `?load=`, `3nps-to-studio`,
`__studioHold`/`__looperClosed` und der BroadcastChannel-Teil – jeweils NUR, wenn nachweislich ausschließlich vom Studio genutzt (sonst stehen lassen und notieren);
`.studio-btn`-CSS, Studio-Texte in `app/i18n-en2.js`, Studio-Zweige in `sep.js`/`sw.js` (`/inst/`, `/studio/`-Seite); `app/www/inst/` (20 MB) aus entwicklung und main;
`app-studio/` und die reinen Studio-Tests (`s1studio s2studio s3studio s3pitch s1mem v107round v112mst v121studioC v122studioD v123inst` u. ä.) aus entwicklung;
`wiederherstellen.sh`/`test/pages.sh`/ARBEITSWEISE-Briefing anpassen. Bleiben: `app/www/studio/index.html` (Weiterleitung), `master.js`, Konzept-Dateien,
IndexedDB `3nps-studio` auf den Geräten (nicht anfassen). Auf main die gelöschten Dateien mit `git rm` entfernen. In UEBERGABE den Rückweg nennen
(letzter Commit mit Studio: entwicklung 5090348, main f0f2f99).
