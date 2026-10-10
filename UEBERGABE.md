# 3nps Looper – Übergabe (vollständiger Stand)

Stand: **7. Oktober 2026 · Version v44** – live unter https://tom444555.github.io/3nps/ ·
stabile Rückfall-Fassung **v24** unter https://tom444555.github.io/3nps/stabil/

Diese Datei ist das Gedächtnis des Projekts. Alles, was ein neuer Chat wissen muss, steht hier –
bitte bei jeder Veröffentlichung mitpflegen (Abschnitte „Stand“, „Verlauf“, „Tests“, „Offen“).

---

## 1. Start in einem neuen Chat

Dem neuen Chat (Claude Code mit Zugriff auf GitHub `Tom444555/3nps`) als erste Nachricht schreiben:

> Lies die Übergabe im Branch `entwicklung` von Tom444555/3nps (UEBERGABE.md) und stelle die Arbeitsumgebung
> mit `wiederherstellen.sh` her. Danach: …(Aufgabe)…

Der Chat macht dann:

```
git clone -b entwicklung https://github.com/Tom444555/3nps.git /home/claude/3nps-src
sh /home/claude/3nps-src/wiederherstellen.sh        # ~3 Minuten
git clone -b main https://github.com/Tom444555/3nps.git /home/claude/3nps-main   # nur zum Veröffentlichen
```

`wiederherstellen.sh` kopiert Quellen und Tests nach `/home/claude/3nps` (die Testskripte nutzen diesen Pfad fest),
erzeugt alles Testaudio deterministisch neu, baut die App und startet den Testserver auf Port 8765.
Danach als Kurzprüfung: `cd /home/claude/3nps/test && node liedcheck.js && python3 v31export.py`.

## 2. Wer und wofür

- Gitarrist, arbeitet fast nur auf dem **iPad** (Logic Pro für iPad, Mac selten). Interface **Spark LIVE** (USB),
  Fußpedal **M-VAVE Chocolate** (Tastatur-Modus). Singt selbst. Sprache: **Deutsch, einfache Erklärungen**.
- Wünsche an die Arbeit: **Stabilität und Haptik gehen vor** („der jetzige Zustand fühlt sich sehr stabil an“),
  lieber neue Reiter als überladene Ansichten, gründlich testen, große Blöcke am Stück, wenig Rückfragen
  (achtet auf sein Nutzungslimit). Vor größeren neuen Funktionen gern erst kurz Konzept/Feedback, dann bauen.
- Auf dem iPad wird eine neue Version aktiv, wenn man die App **zweimal** öffnet (oben steht „3nps · vNN“).

## 3. Repository und Ablage

| Ort | Inhalt |
|---|---|
| Branch `main` | fertige App für GitHub Pages (`index.html`, `sw.js`, Bilder, `ANLEITUNG.txt`) + Ordner `stabil/` (v24, nie anfassen) |
| Branch `entwicklung` | Quellcode, Tests, Generatoren, diese Übergabe, `wiederherstellen.sh` |
| Branches `stabil-v24`, `stabil-v24-quellen` | Sicherung der stabilen Fassung (Git-Tags lässt der Sitzungs-Proxy nicht zu) |

## 4. Arbeitsablauf

1. Quellen in `/home/claude/3nps/app` (bzw. `script.part`, `tabs.js`) ändern.
2. `python3 app/build.py` → `app/www/index.html` (eine Datei, CSP, eingebettete Schriften) und `preview.html`.
3. Testserver `sh test/srv.sh` (Port 8765), Tests ausführen (Abschnitt 8). **Browser-Tests nacheinander**, nicht parallel –
   Zeit-Tests (`v25jam`, `v25listen`, `v28lied`) schlagen sonst wegen CPU-Last fehl.
4. Version hochzählen: `app/head_app.html` (Marke „3nps · vNN“) **und** `app/www/sw.js` (`CACHE = '3nps-vNN'`).
5. Veröffentlichen: `cp -r /home/claude/3nps/app/www/. /home/claude/3nps-main/`, committen (Autor
   `Claude <noreply@anthropic.com>`, Attributionszeilen aus dem System-Hinweis), pushen, dann
   `gh run list -R Tom444555/3nps -L 1` → „pages build and deployment“ muss `success` sein
   (falls der Runner hängt: leeren Commit nachschieben).
6. Branch `entwicklung` nachziehen: geänderte Dateien nach `/home/claude/3nps-src` kopieren (inkl. `app/www/index.html`,
   neue Tests/Generatoren, diese Datei), committen, pushen.

Stolperfallen: Karten sind im Grundstil senkrechte Flexboxen – für eine Zeile `flex-direction: row` setzen.
Der Testserver stirbt zwischen den Zügen → vor jedem Test `sh test/srv.sh`. `pkill -f` mit zu allgemeinem Muster beendet die eigene Shell → gezielt PIDs beenden.
`raw.githubusercontent.com` und fremde Seiten sind aus der Sitzung gesperrt, PyPI teils auch (z. B. `mido` fehlt) →
eigene kleine Leser/Schreiber verwenden (MIDI-Leser steht in `test/liedexport.js`).

## 5. Die App (Reiter)

Reihenfolge der Reiter (intern `id`): **Looper** (`looper`) · **Quintenzirkel** (`quinten`) · **Improvisation** (`solo`) ·
**Backing Track** (`jam`) · **Songwriting** (`lied`) · **Training** (`ueben`) · **Technik** (`griffbrett`).
IDs `tab-…`/`panel-…`. Begleitung (Drone, Drums, Bass), alter Song-Player und Übungslog sind Karten im Reiter Technik.

- **Kopf-Knöpfe** unter dem Schriftzug: „App-Optik ▾“ (`#optikBtn` → `#optikPop` mit `#appTheme`) und „Leistung ▾“ (`#perfBtn` → `#perfPop`).
  Schließen nach der Wahl, bei Klick daneben, mit Esc und gegenseitig (Ereignis `hdrpop`). Tests klappen vor `select_option` auf.
- **Leistung** (v34, `perf.js`): Rechenlast Bedienung (Verspätung eines 25-ms-Taktgebers), Bildrate, Audio (`renderCapacity` wo vorhanden,
  sonst Rückstand der Eingangsblöcke), Aussetzer (Lücken im Eingangsstrom), Speicher (`Looper.perf()`: Spuren, Rückgängig/160 MB,
  JS-Heap nur in Chrome), Latenz (Track-`latency`, `baseLatency`, `outputLatency`, Summe, eingestellter Ausgleich). Misst nur bei offenem Fenster.
  Schlüssel `3nps-perfwin` (nicht `3nps-perf`!). Zusätzlich Audio-Hänger (Audio-Uhr vs. echte Zeit, Fenster 1 s, > 30 ms), Drums zu spät,
  Abtastrate; ein Wächter (1×/s, nur bei laufenden Drums) gibt nach 3 Hängern/Minute einmal einen Rat in `#loopStatus`.
  v35: **Anheften** (`#pfPin`) hängt das Fenster an `body` (position: fixed, z-index 70), Ziehen an `#pfHead` (Pointer-Events, heftet
  automatisch an), Position/Anheften/**Kompakt** (`#pfCompact`, blendet `.pf-more` aus) in localStorage `3nps-perf`; angeheftet bleibt
  es nach Neustart offen und schließt nicht durch Tipp daneben/Esc/Optik-Knopf; `#pfClose` löst das Anheften. Position vor dem
  Umschalten auf fixed messen (sonst springt es wegen `top: 100%` nach unten).
  „Alles sichern“/„Sicherung laden“ stehen weiter unten im Looper in der Karte „App · Sicherung“.
- **Looper:** 3 Stereo-Spuren, Aufnahme/Overdub per Fußtaster, Rückgängig, Editor (Auswahl, Takt-Eins verschieben, ½/2× Tempo),
  Datei laden (Loop- oder Song-Erkennung mit Takt/Tempo), Drums/Drone, EQ, Sitzungen, Autosicherung, „Für Logic exportieren“
  (Loop), **„→ Song“** (Loop als Teil in einen Song, unten in der Zeile mit „Alle starten“). Spurkopf: Tonart unter „Spur N“,
  rechts klingender + nächster Akkord.
- **„Was passt“-Box** oben in der Looper-Karte über volle Breite (v29: flach, **feste Höhe**, Charakterton neben dem Satz):
  klingender/nächster Akkord, passende Tonleiter mit Tönen, Pentatonik, nächster Wechsel (Zielton, Leittöne), „Anhalten“ mit Akkordwahl.
- **Quintenzirkel:** folgt der erkannten Tonart und dem klingenden Akkord (Looper, Backing Track oder Song).
- **Improvisation** (früher „Solo Finder“): Akkordleiste, Tonarten/Kirchentonleitern/Pentatonik mit Griffbild, Akkordgriffe (CAGED),
  Mithören (YIN) mit Zähler Akkordton/Tonleiter/außerhalb, Ideen-Würfel. Folgt Looper, Backing Track und Song.
- **Backing Track:** Akkordfolge eintippen oder Vorlagen, Drums/Bass folgen den Akkorden, Fläche, Tempo-Trainer.
- **Songwriting:** Songs aus Looper-Teilen (Strophe, Refrain …), Ablauf mit Wiederholungen, Wiedergabe mit Aufnahmen/Drums/Bass/Fläche,
  Akkorde korrigieren, Versionen, „Song prüfen“ + Varianten (anhören/übernehmen), Gesang (Stimmlage, Tonart-Empfehlung, Zieltöne),
  **Text** (je Teil/Durchgang, Silben, Reimschema, `[Am]`-Marken), **Leadsheet-PDF**, **Mit Claude weiterarbeiten** (Song-Code hin und
  zurück, Vorschau der Änderungen, als Version oder neuer Song), **Für Logic exportieren** (ganzer Song).
- **Training:** Tagesübung, Gehörbildung, Licks (+ eigene), Solo-Auswertung.
- **Technik:** Griffbrett/3nps-Skalen, Begleitung, Übungslog.
- Optiken (v34, Reihenfolge der Auswahl): **Klar** `clean` (flach, Graphit, Systemschrift), **Kühl** `ice`, **Nordisch** `nordic`, **Metal** `metal`,
  **Verstärker** `amp`, **Matrix** `matrix` (Zeichenregen als festes Bild `bg-matrix.jpg`, Monospace, Bildschirmzeilen),
  **DJ-Pult** `dj` (`bg-dj.jpg`/`panel-dj.jpg` aus `tex/dj.py`, LED-Kette per CSS-Maske, Fader-Regler), **Hell** `light`, **Präzision** `precise`.
  Helle Optiken (`theme-light.css`): helles Gehäuse, **dunkle Anzeigefenster** (`.track/.editor/.lane/.eq-panel` setzen dort eigene
  `--ink/--muted/--line`), weil Wellenform/Editor/EQ fest auf dunklen Grund zeichnen (`looper.js` 2075/2099, `eq.js`). „Alles sichern“ sichert localStorage `3nps-*` und IndexedDB (sessions, ideas, meta).

## 6. Quellcode

| Datei | Inhalt |
|---|---|
| `script.part` | Grundprogramm (Griffbrett, Skalen, Begleitung, Drone-Grundlage, Übungslog) |
| `tabs.js` | Reiter-Umschaltung (Ereignis `tabchange`), Umleitung alter Reiternamen |
| `app/head_app.html` | Kopf, Reiterleiste, Marke „3nps · vNN“, Platzhalter der Panels |
| `app/looper.js`, `looper.html`, `looper.css` | Looper inkl. Datei-Import (`analyseImport`), Editor, Export, Sitzungen, APIs für andere Reiter |
| `app/beat.js` | Takterkennung: Tempo, Oktav-Prüfungen, Schlagraster, Feinbestimmung (~1 ms), Takt-Eins, freies Intro, `loopAnalyse` |
| `app/chords.js`, `analysis.js` | Akkorderkennung je Schlag; Analyse-Worker (Funktionen werden als Text in den Worker kopiert), Tonart |
| `app/rhythm.js`, `kit.js`, `bass.js`, `drones.js`, `eq.js` | Taktgeber/Drums (+ `midiEvents`), Kit-Synthese, Bass, Drones, 7-Band-EQ |
| `app/appcfg.js` | Optik (inkl. Auf-/Zuklappen des Kopf-Knopfs), Sicherung/Wiederherstellung |
| `app/perf.js` | Leistungsanzeige im Kopf (wird in `build.py` an `appcfg.js` gehängt) |
| `app/theme-*.css` | Optiken metal, amp, ice, clean, matrix, dj, light (hell + präzision) (Nordisch = Grundstil `metal.css`) |
| `app/circle.*` | Quintenzirkel |
| `app/solo.*`, `voicings.js`, `pitch.js` | Improvisation, Akkordgriffe, Tonhöhe (YIN) |
| `app/passt.js`, `passt.css` | „Was passt“-Box |
| `app/jam.*` | Backing Track (`Jam.parse`, `window.bassChordAt`) |
| `app/uebung.*`, `licks.js` | Training |
| `app/lied-core.js` | Songwriting-Logik: Prüfen, Varianten, Transponieren, Gesang (Node-testbar) |
| `app/lied-text.js` | Text: Silben, Reime, Textprüfung, Leadsheet-Modell, Song-Code `toCode/prompt/fromCode/diff` (Node-testbar) |
| `app/lied-pdf.js` | eigener PDF-Schreiber für das Leadsheet (A4, Helvetica/WinAnsi) |
| `app/lied-export.js` | ganzer Song für Logic: `timeline`, `render`, `midi`, `wav24`, `zip`, `build` (Node-testbar) |
| `app/lied.js`, `lied.html`, `lied.css` | Reiter Songwriting, „→ Song“-Dialog, Song-Player |
| `app/build.py` | baut alles zu `app/www/index.html` |
| `app/www/` | `sw.js`, `ANLEITUNG.txt` (Abschnitte 1–32), Bilder/Icons, Manifest |
| `app/tex/*.py` | erzeugen Texturen/Icons der Optiken (`matrix.py` → `www/bg-matrix.jpg`, neue Bilder auch in `sw.js` eintragen) |
| `test/` | Tests, Generatoren, Auswertungen (Abschnitt 8) |

## 7. Technische Eckpunkte und Regeln

- **Kompatibilität mit der stabilen v24 (wichtig):** beide teilen localStorage und IndexedDB. Speicherformate nur erweitern,
  nie ändern; **keine neue DB-Version / kein neuer Store**. `sw.js` löscht nur eigene `3nps-…`-Caches, `/stabil/` bleibt unberührt.
- **Optik-Speicher:** `3nps-theme` enthält nur, was die v24 kennt (nordic/metal/amp/ice; für clean/matrix steht dort „nordic“),
  die echte Wahl in `3nps-theme2`. Diese gilt nur, solange `3nps-theme` dazu passt – stellt man in der v24 um, gilt deren Wahl.
  Gleiche Logik im Frühstart-Skript `EARLY` in `build.py`.
- **Sicherheit/Recht:** CSP ohne fremde Quellen (Test `csptest.py`), keine Server, keine Datenerhebung, Schriften OFL eingebettet,
  keine fremden Samples/Logos.
- **Audio:** gemeinsamer Taktgeber `Rhythm` (`addListener(fn, first)`, `setJam`), Bass folgt Akkorden über `window.bassChordAt`
  (in `build.py` in `playBassNote` eingebaut). Looper, Backing Track und Song schließen sich gegenseitig aus
  (`Looper.busy()/stopAll()`, `Jam.stop()`, `Lied.stop()`). Stereo-Modell `{l, r, length}` (Mono: `r === l`);
  iPadOS liefert über getUserMedia nur Mono (Stereo erst mit nativer Hülle).
- **Audio-Puffer:** `build.py` ersetzt die AudioContext-Optionen: latencyHint `playback` bei `3nps-perf` = lite/stable, sonst `balanced`
  (in `window.__audioHint`). Die 48 kHz aus `script.part` gelten in der App **nicht**; sie läuft mit der Rate des Geräts. Gespeicherte
  Aufnahmen tragen keine Abtastrate – eine feste Rate einzuführen bräuchte eine Formaterweiterung.
- **Latenz-Ausgleich** (v37): `3nps-lat-est` (gemessene Latenz) und `3nps-lat-why` (Puffer|Gerätename). Nur wenn sich `why` ändert und die
  Messung ≥ 10 ms abweicht, wird `3nps-latency` um die Differenz verschoben (Messung schwankt sonst von Start zu Start).
- **Drum-Bus:** Kompressor, EQ7, Faltungshall 0,9 s (`roomIR`). Messung offline: Hall ≈ 4× Rest, kürzerer Hall spart kaum, gerechneter Hall
  nur ~30 % – deshalb abschaltbar statt ersetzt. Vorab einrechnen würde ~50 MB kosten.
- **Eingang öffnen** (v36): `ensureMic()` gibt bei laufendem Öffnen dasselbe Promise zurück (`micOpening`), Knopf zeigt „Öffne …“.
  getUserMedia-Fehler nach `e.name`: NotAllowed → Erlaubnis, NotFound/Overconstrained → Interface, NotReadable/Abort → „belegt“
  (vorher einmal nachfassen mit einfachen Einstellungen). `lastMicError` in `Looper.perf().micErr`. Die Vorschau in `build.py` ersetzt
  den Erlaubnis-Text wörtlich (`old_mic`) – bei Textänderung mitziehen.
- **Looper-APIs:** `chordInfo`, `nowChord`, `seek`, `songCapture`, `focusTrack`, `busy`, `stopAll`, `openInput`, `inputAnalyser`,
  `releaseAnalyser`, `soloData`, `_setTrack`, `_chords`, `debug`. Ereignis `trackkey` bei neuer Tonart.
  `Jam.chordInfo()` und `Lied.chordInfo()` liefern dasselbe Format wie `Looper.chordInfo()`.
- **Songwriting-Daten:** localStorage `3nps-lieder` = `{active, songs:[{id, name, voice:{preset,lo,hi}, cur, versions:[{n, at, note, key:{pc,major},
  bpm, theme, parts:[{id, name, type, chords:[{r,t,beats}], lyrics:[…], audio, audioBpm, audioSig, audioBars}], order:[{p, reps}]}]}]}`,
  höchstens 40 Versionen. Aufnahmen Int16 in IndexedDB `meta`, Schlüssel `lied-audio:<id>`. Aufnahme ist **veraltet/stumm**, sobald
  `sig(chords) !== audioSig`. Wiedergabe: `AudioBufferSource.start(t)` am Akkordwechsel, `playbackRate = Song-BPM / Aufnahme-BPM`.
- **Song-Code** (Austausch mit Claude): Kopf `=== 3NPS SONG-CODE v1 ===`, Felder Titel/Tonart/Tempo/Thema/Stimme/Ablauf, Teile
  `## Name [Typ]` mit `Akkorde:` und `Text N:`, `Notiz:`, Ende `=== ENDE ===`. Teile werden über den Namen zugeordnet → behalten Aufnahmen.
- **Song-Export:** ZIP mit „01 Aufnahmen – ganzer Song“ (WAV 24 Bit, Mono wenn alle Aufnahmen mono), „Teile einzeln“, MIDI
  (Tempo, Tonart, Abschnitts-Marker, Akkorde Kanal 1, Bass Kanal 2, Drums aus `Rhythm.midiEvents`, Liedtext FF 05),
  Leadsheet-PDF, Text, Song-Code, „LIES MICH“ mit Takten der Abschnitte. ZIP als Blob (keine zweite Kopie im Speicher).
- **Takterkennung:** Fluss-Merkmale → Autokorrelation + Vorzug um 115 BPM → Kandidaten metrisch bewertet → Oktav-Prüfungen
  („Backbeat bei 2×“, „halbiert“, „verdoppelt“ – verlangt seit v31 Snare auf den Achteln oder Becken klar auf den Achteln,
  **„Langsam-Prüfung“** seit v31: halbiert Tempi ≥ 108, wenn keine Sechzehntel, im halben Tempo schwächere Achtel 0,45–0,88,
  gerade Schläge betont, kein Backbeat in den Höhen; nicht nach „verdoppelt“, nicht wenn ein Aufnahme-Tempo passt) → DP-Schlagverfolgung
  → freies Intro → gerade/gleitende Gerade → Takt-Eins (Bass, Akkordwechsel, Crash) → `beatRefine` (~1 ms).
  Datei-Import: `analyseImport` (≤ 40 s und gleichmäßig → `loopAnalyse`, sonst Song mit Raster).
- **Tonart:** Chroma + Akkordfolge (`keyFromChords`, `refineKey`). **Abgleich:** `fineAlign` (1-ms-Anschlagkurven, ±60 ms),
  neue Aufnahmen auf Spur 2/3 automatisch (`3nps-autoalign`).
- **Speicher:** Overdubs eingerechnet, Rückgängig ≤ 160 MB, Autosicherung in IndexedDB ≤ 150 MB, Wiederherstellen-Leiste nach Absturz.
- **Anzeige:** `playFrame()` = hörbare Position; „Was passt“-Box mit fester Höhe (iPad 168 px, schmal 240 px, iPhone 236 px) –
  nichts darf beim Mitlaufen springen.

## 8. Tests und erwartete Ergebnisse (v44)

Browser (Playwright, Testserver 8765, **nacheinander**):
`v44edit.py` 15/15 · `v43edit.py` 16/16 · `v40idea.py` 7/7 · `v39back.py` 7/7 (Hintergrund simuliert über document.hidden + _micDrop + hängendes getUserMedia) · `v38live.py` 11/11 · `v41ideasolo.py` (Idee laden → Akkorde für Improvisation, mit/ohne Live; Ausgabe prüfen: Spur 0, has=True) · `v37stall.py` 16/16 (Hänger-Erkennung per absichtlich überlastetem Audio-Modul, Wächter, Schlüssel-Umzug, „Stabil“, Latenz-Nachziehen, Raum) · `v36mic.py` 10/10 (Fehlerfälle beim Öffnen per gepatchtem getUserMedia) · `v35.py` 20/20 (Anheften/Ziehen/Kompakt/Neustart, Kontraste der neuen Optiken) · `v34perf.py` 12/12 · `v34optik.py` 16/16 (Pages-Nachbau Port 8790, prüft Wechsel mit v24) · `v31export.py` 14/14 (prüft Versionsmarke – bei jeder Version anpassen) · `v30text.py` 27/27 (Versionsprüfung seit v34 „ab v30“ numerisch) · `v28lied.py` 34/34 · `v28sync.py` 6/6 · `v27passt.py` 17/17 · `passthoehe.py` 8/8 ·
`v25grips.py` 10/10 · `v25jam.py` 21/21 · `v25listen.py` 9/9 · `v25ueben.py` 28/28 · `v25stress.py` 6/6 · `tempotest.py` 3/3 ·
`v24solo.py` 22/22 · `v22key.py` 7/7 · `v21test.py` 8/8 · `v21tabs.py` 18/18 · `v20test.py` 14/14 · `suite.py` 81/81 · `stereotest.py` 16/16 (Prüfung „Pegel zeigt L/R“ liest einen Zufallsmoment, selten 15/16 – dann wiederholen) ·
`eqtest.py` 9/9 · `restoretest.py` 7/7 · `backuptest.py` 7/7 · `csptest.py` (keine fremden Anfragen) · `rec_fit.py 1` 10/10 ·
`importall.py` 57/63 (bekannt: Eins bei Shuffles) · `synctest.py`, `firsthit.py`, `drone78.py`, `mono_rec.py`, `sesstest.py`, `droptest.py`,
`pedaltest2.py`, `crashtest.py`, `taptest.py` ohne Fehler · `swtest.py` 5/5 (braucht Pages-Nachbau auf Port 8790).

Node:
`liedcheck.js` 26/26 · `liedtext.js` 54/54 · `liedexport.js` 13/13 · `voicingcheck.js` (547 Griffe) · `pitchcheck.js` 292/294 · `lickcheck.js` (384) ·
`precision.js` → Tempo 49/52, Eins 47/52, Schlagfehler Median 1,0 ms · `longeval.js` 6/6 · `sh evalall.sh` (Loops 102/112, 11/11) ·
`oktaveval.js oktave oktave2 oktave3 oktave4 corpus valid hard long` → **264/272** richtige Tempo-Oktave (v30: 237) ·
`keyeval.js` 52/59 · `chordeval.js` Grundton 95,5 %, exakt 91,5 % · `chordsong.js` 82,8 %.

Vergleich mit der stabilen v24 / Vorversion (Pages-Nachbau: `ln -s /home/claude/3nps-main /tmp/claude-0/pages/3nps`, Server Port 8790):
`vergleich.py URL gemeinsam|voll SEKUNDEN SEED` (Zufallsszenario, JSON mit Fehlern, Speicher, Bildzeiten, späten Drum-Schlägen) ·
`aktionen.py URL` (Stocken je Bedienschritt) · `idle.py URL [zu]`. v35 = v24 (gemeinsam, 60 s, Seed 7): keine Fehler, Heap max 23,8 vs 26,4 MB, 0 späte Schläge.
Pages-Nachbau mit neuer Fassung: `/home/claude/3nps-main` nach `/tmp/claude-0/pages/3nps` kopieren, `app/www/.` darüber, Server Port 8790.

Testaudio-Generatoren (alle deterministisch, von `wiederherstellen.sh` aufgerufen): `gen_corpus.py` (corpus, valid), `gen_hard.py`,
`gen_long.py`, `gen_chords.py`, `gen_align.py`, `gen_keys.py`, `gen_v25.py`, `gen_octave.py`, `gen_octave2.py`,
`gen_octave3.py` (oktave3; `OUTC=oktave4 SEED=888` für oktave4 – beide nur Gegenprobe, nicht zum Einstellen verwenden).

## 9. Verlauf (kurz)

| Version | Inhalt |
|---|---|
| v20–v22 | Spurkopf mit Tonart + klingendem/nächstem Akkord, Reiter neu geordnet, Quintenzirkel folgt geladenen/aufgenommenen Spuren |
| v24 | bessere Tonart, Solo Finder – **stabile Fassung** (`/stabil/`) |
| v25 | Akkordgriffe, Mithören, Backing Track (Jam), Training, Tempowechsel ohne Sprung |
| v26–v27 | professionelle Reiternamen, „Was passt“-Box im Looper (oben, volle Breite, Anhalten); Stresstest gegen v24 |
| v28 | Songwriting Schritt 1–2: Song aus Looper-Teilen, Ablauf, Wiedergabe, Versionen, Prüfen/Varianten, Gesang |
| v29 | „Was passt“-Box flacher, feste Höhe, Charakterton neben dem Satz |
| v30 | Songwriting Schritt 3–4: Text (Silben/Reime), Leadsheet-PDF, Song-Code mit Claude |
| v31 | Schritt 5: ganzer Song für Logic (WAV, MIDI mit Abschnitten/Akkorden/Bass/Drums/Text); langsame Dateien nicht mehr doppelt |
| v32 | Optik-Auswahl als eigenes Fenster oben im Looper (vom Nutzer verworfen: zu viel Platz) |
| v33 | Optik als kleiner aufklappbarer Knopf „App-Optik ▾“ im Kopf unter dem Schriftzug |
| v34 | Leistungsanzeige (Rechenlast, Speicher, Latenz), Optiken umbenannt + neu „Klar“ und „Matrix“, Pedal-Fenster für alle Bluetooth-Pedale. Vergleich mit v24: gleichwertig |
| v35 | Leistungsfenster anheftbar, verschiebbar, kompakt; Optiken „DJ-Pult“, „Hell“, „Präzision“ |
| v44 | Editor Block 2: `edApply` (Länge bleibt, 3-ms-Kanten `xfadeEdge`), Kopieren/Ausschneiden/Einfügen (`edClip`, spurübergreifend)/Duplizieren/Stille/Umkehren/Blenden/±3 dB/Normalisieren −1 dBFS; Editor-Undo/Redo (`edUndo`/`edRedo`, `ed.redo`, `applySnap` aus `undoTrack` herausgelöst; Editor-Undo löscht nie die Spur) |
| v43 | Editor Block 1: Vollbild (`.ed-full`, nur bei ✂ = `openEditor(t, true)`, `3nps-edfull`), Wellenform Peak+RMS+Clip+dB, Lineal Takt.Schlag, 16tel-Linien, Zeitachse, Anschläge (`trackOnsets`: Hochton-Flux gegen lokalen Pegel), Raster 16tel/Anschlag/Nulldurchgang, Feinschritte ±1 ms/±1 Abtastwert (`edNudge`), Naht-Blende (`seamFade`, `3nps-edfade`, Standard 5 ms), Auswahl hören (`ed.loop`), Pedal im Vollbild (`Looper.edPedal`). crashtest setzt `3nps-edfull=0` |
| v42 | Helle Optiken ins Grau: „Hell“ kühles Mittelgrau (#aeb3ba/#c9cdd3, Akzent #1f5bb8), „Präzision“ warmes Messgeräte-Grau (#a8a9a2/#c6c7c0) – Override-Block am Ende von `theme-light.css` |
| v41 | **Behoben:** mit „Live“ an wurden geladene Ideen/Dateien nicht analysiert → Improvisation leer. Live hält jetzt nur noch die Analyse nach eigenen Aufnahmen zurück (`finishRec`), Laden wertet immer sofort aus |
| v40 | **Behoben:** „Ideen → Speichern“ baute `sessionMix` (kompletter Mix bis 16× Loop-Länge + WAV) nur für die Sekundenzahl → Speicherspitze, auf dem iPad Absturz der Web-App (Spuren weg, Eingang tot). Jetzt `sessionSecs()` (nur rechnen) |
| v39 | **Behoben (Fehler aus v36):** nach Rückkehr aus dem Hintergrund blieb „Eingang öffnen“ für immer auf „Öffne …“, wenn getUserMedia nicht antwortete. Jetzt `gum()` mit 6-s-Zeitlimit (spät gelieferte Ströme werden gestoppt), zweiter Versuch nach `resume()`, Rückkehr/Tippen öffnet neu (`reopenMic(true)` umgeht die Flacker-Sperre 3×/30 s), Hinweis „tippe einmal“ wenn der Ton nach 1,5 s nicht läuft |
| v38 | Live-Schalter (`#liveBtn`, `window.__live`, `3nps-live`): keine Analyse (`detectTrackKey`/`scheduleChords` → `t.livePend`), keine Autosicherung (`livePendSave`), passt/circle-Ticker pausiert, Anzeige 15 fps ohne Neon; Nachholen beim Ausschalten. Hänger-Protokoll in `perf.js` (Wächter läuft jetzt immer, 1×/s) mit App-Ereignissen aus `window.__appEv` (Aufnahme Ende, Analyse, Sicherung, Eingang offen, Live, Reiter, Drums, Hintergrund). Anlass: Reactor 50 direkt am iPad 2 Hänger/h, über Hub viele → Ursache Hub/Laden |
| v37 | Reactor 50 (USB): Stocken nur mit Drums. Neu: Leistung „Stabil“ (`3nps-perf`=`stable` → latencyHint playback), Drum-„Raum“ an/aus (`3nps-drumroom`), Hänger-Wächter mit Rat, Latenz-Ausgleich zieht bei Geräte-/Pufferwechsel nach. **Behoben:** Leistungsfenster schrieb seit v35 nach `3nps-perf` (Schlüssel der Einstellung „Leistung“) → jetzt `3nps-perfwin`, alter Wert wird umgezogen |
| v36 | Eingang öffnen robuster: Meldung je Ursache, Nachfassen bei „belegt“, Zeitlimit Aufnahme-Modul (4 s → ScriptProcessor), kein Doppel-Öffnen. Anlass: Nutzer meldete „Eingang öffnet nicht“ (in Chromium nicht nachstellbar, WebKit hier nicht installierbar) |

## 10. Bekannte Grenzen

- Takt-Eins bei Shuffles/12-Takt-Blues manchmal zwei Schläge daneben (1 ↔ 3); Editor „◀ / ▶ 1 Schlag“.
- Langsame Funk-/Ride-Grooves mit stark betonten Becken werden teils noch doppelt erkannt (Editor „½ Tempo“).
- Bei stark schwankendem Spiel ist die erste Aufnahme ±10–25 ms in der Länge ungenau.
- Öffnen von Backing Track/Technik ~100 ms (Drum-Spur wandert mit), Ton bleibt pünktlich.
- Mithören erkennt einzelne Töne, keine Akkorde. Silben/Reime sind Heuristik (DE/EN).
- Song-Export bis 10 Minuten; Aufnahmen mit anderem Tempo werden wie beim Abspielen angepasst (Tonhöhe ändert sich).
  Das Logic-Paket ist technisch geprüft (WAV/MIDI/ZIP), aber noch nicht vom Nutzer in Logic geöffnet worden.

## 11. Offen / Ideen (warten auf den Nutzer)

1. **Native Hülle (iPad-App) + AUv3-Plugin für Logic** – gebaut mit GitHub Actions (macOS), TestFlight, später App Store.
   WKWebView mit gebündelter App, Neustart nach Abbruch des Web-Prozesses + Wiederherstellen, Mikrofon-Erlaubnis einmalig,
   AVAudioSession (Puffer, USB-Wechsel), nativer Stereo-Eingang.
   - **Nur der Nutzer kann:** Apple Developer Program (99 €/Jahr), Verträge/Bank/Steuer in App Store Connect, App-Eintrag anlegen,
     API-Schlüssel als GitHub-Secret hinterlegen, EU-Händlerstatus.
   - **Entscheidungen:** Repository öffentlich/privat (bei Verkauf privat), App-Name („Looper“ vermutlich vergeben),
     Preismodell (Kaufpreis / kostenlos + „Pro“ / Trinkgeld).
   - Danach übernimmt Claude: Bau, Signieren, TestFlight, Store-Texte DE/EN, Screenshots, Datenschutz-/Support-Seite, Einreichen.
2. **Text raushören** (auf Wunsch des Nutzers **erst mit der Hülle**): gesungenen Text aus eigenen Aufnahmen erkennen, Wörter mit
   Zeitangaben, Akkordwechsel genau über die Silbe, Ergebnis als `[Am]`-Text ins Songwriting. Mit Hülle: iOS-Spracherkennung
   (schnell, kein Download). Ohne Hülle wäre es Whisper im Browser (Modell 40–75 MB ins eigene Repo legen, damit keine fremden Anfragen).
   Hinweis an den Nutzer: fremde Songtexte sind urheberrechtlich geschützt – nur zum eigenen Üben.
3. Takterkennung weiter verfeinern: Shuffle-Takt-Eins, langsame Funk/Ride-Grooves (Fälle in `oktave3/4`: q22, q44, q48, q56, q62).
4. Frühere Ideen ohne Termin: MIDI-/Tab-Export der Licks, Live-Szenen.
