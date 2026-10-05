# Looper – Übergabe für die nächste Sitzung

Stand: 5. Oktober 2026 · Version **v20** ist live unter https://tom444555.github.io/3nps/
Repository: `Tom444555/3nps` · Branch `main` = fertige App (GitHub Pages) · Branch `entwicklung` = dieser Quellcode.

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
| `app/looper.js` | Looper: 3 Stereo-Spuren, Aufnahme, Overdub, Editor, Export für Logic, Sitzungen, Autosicherung, Akkordleiste, Abgleich |
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

## Tests und erwartete Ergebnisse (v20)

- Browser: `v20test.py` 16/16 · `suite.py` 81/81 · `stereotest.py` 16/16 · `eqtest.py` 9/9 · `restoretest.py` 7/7 ·
  `backuptest.py` 7/7 · `csptest.py` (keine fremden Anfragen) · `crashtest.py`, `taptest.py` (Speicher stabil) ·
  `rec_fit.py 1` 10/10 · `importall.py` 57/63 (bekannte Fälle: Eins bei Shuffles) · `synctest.py`, `firsthit.py`,
  `drone78.py`, `mono_rec.py`, `sesstest.py`, `droptest.py`, `pedaltest2.py` ohne Fehler.
  `glitchtest.py` vergleicht mit einer alten Version auf Port 8766 (optional).
- Takterkennung (Node): `node precision.js` → Tempo 49/52, Eins 47/52, Schlagfehler Median 1,0 ms ·
  `node longeval.js` → 5/6 (Ballade 74 BPM wird als 148 erkannt) · `sh evalall.sh` (Loops 102/112 + 11/11).
- Akkorde (Node): `node chordeval.js` → Grundton 95,5 %, exakt 91,5 % · `node chordsong.js` → 82,8 % (Riffs ohne Terz schwerer).

## Technische Eckpunkte

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
