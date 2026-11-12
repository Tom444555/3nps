# Prüfbericht „3nps Looper“ v140 – Leistung und Design

Stand: 11.11.2026 · reine Prüfung, keine Änderung an Quellen · Messskripte und Rohdaten in `/tmp/claude-0/pruef/`, Bilder in `/tmp/claude-0/pruef/shots/`

## 1. Kurzfazit

- Ohne Drosselung läuft die App überall flüssig: 59–60 fps, praktisch keine langen Aufgaben, kein Speicherleck (Heap über 90 s gleich bei 6,0 MB). Leerlauf ist sauber, und verdeckte Reiter zeichnen nicht weiter.
- **Der größte Hebel ist der Looper-Reiter beim Mitlaufen.** Bei 4× CPU-Drosselung (grobe Näherung an ein älteres iPad) ist der Hauptthread zu 93 % belegt. Das ergibt 27 fps, 19 % der Bilder dauern über 50 ms, und es gab 161 lange Aufgaben in 20 s. Die Ursache sind zwei Stellen in `looper.js › tick()`: Pegelanzeigen, die jedes Bild Stil schreiben und dann Layout lesen, und `drawEditor()`, das die ganze Wellenform 30× pro Sekunde neu zeichnet.
- Zweiter Leistungspunkt: Die Drone-Schleife baut beim Neuberechnen auf dem Hauptthread einen 6-s-Hall (`ensureReverb`). Das gibt alle ~80 s eine lange Aufgabe von 121 ms, bei 4× Drosselung 604 ms. Die Drums planen nur 300 ms voraus, deshalb besteht hier ein Aussetzer-Risiko (nicht nachgewiesen).
- Design: Die neuen Bereiche (Lernen, Powerchords-Kurs) sind sauber und haben 44-px-Ziele. Der Looper selbst ist der Altbestand. Dort sind 105 von 108 Bedienelementen kleiner als 44 px, es gibt 26 Schriftgrößen, und auf dem iPad quer liegen REC/Overdub mit geladenen Spuren unter dem ersten Bildschirm.
- Optiken: „iOS“ macht den aktiven Knopf „Blitz: jeder Takt“ unlesbar (blau auf orange). Die orangen Sonderknöpfe (`#loopFlash`, `.export-btn`, `.mini button.on`) greifen in keiner neuen Optik.

## 2. Leistung

### 2.1 Messwerte

Umgebung: Playwright/Chromium headless, Software-Rendering, 1366×1024. Mitlaufen = 3 Spuren (c_pop_strum, funk_104_3T, guitar_only_95_4T) + Drums + Drone + „Was passt“ offen, je 20 s.

**Start** (`start.py`, `startprof.py`)

| Wert | 1× | 4× gedrosselt |
|---|---|---|
| index.html | 2,51 MB roh / 0,91 MB gzip | |
| davon JS | 1,75 MB (gzip 557 KB), 16 Blöcke | |
| davon CSS | 637 KB (gzip 324 KB), davon **350 KB Base64-Schriften** (Metal Mania 164 KB, Black Ops One 51, Uncial 45, Cinzel 35, Michroma 29, Russo One 26) | |
| DOMContentLoaded / load | 1158 / 1309 ms | 1610 / 1840 ms |
| lange Aufgaben beim Start | 3, Summe 716 ms, max 373 ms | 14, Summe 1612 ms, max 279 ms |
| bedienbar (Ende letzter langer Aufgabe) | ≈ 1,3 s | ≈ 3,6 s |
| Klick „Lernen“ bis Antwort | 16 ms | 31 ms |
| DOM-Elemente nach Start | 3513 (Looper-Panel 1901) | |

Startprofil: 489 ms „(program)“ (HTML/CSS parsen, Stil), dazu JS nur ~100 ms. `ensureAudio` lädt schon beim Start Bass-Samples und Drum-Hallfahnen (`loadBassSamples`, `buildTails`/`rhythm.js`, `kitToBuffers`, zusammen ≈ 80 ms).

Größte JS-Blöcke, die immer geparst werden: looper 319 KB, powerchords 307 KB (Oberfläche wird schon lazy gebaut, der Code aber immer geladen), caged 231 KB, eq 179 KB, **Englisch-Wörterbuch 172 KB** (wird nur bei EN gebraucht), song/Songwriting 126 KB, hilfe-daten 88 KB.

**Leerlauf** (`idle.py`, 5 s je Reiter, ohne Wiedergabe)

- Immer aktiv: 9 Intervalle (looper.js:475/524/546/935/990/2359, looper.js:4411 Takt-Anzeige 50 ms, perf.js:198, passt.js:144 120 ms). Sie sind billig: 0 Layouts/s im Looper.
- Daueränderungen ohne Grund: `paintSep` (looper.js:546) setzt alle 700 ms `aria-pressed`/class an 3 versteckten Knöpfen (4 Mutationen/s). Unschädlich.
- Reiterabhängig: CAGED 8,4 Layouts/s + 38 Mutationen/s (caged.js:360, `update(false)` alle 120 ms, schreibt cgFollowInfo/cgSrcLbl/cgSeq neu). Improvisation 10 Layouts/s + 84 Mutationen/s (solo.js:585). Jammen 12,6 Layouts/s (jam.js:422 `tickUi` 80 ms, jamBpm). Mitsingen rAF 60/s auch ohne Wiedergabe (singen.js:67 `frame`, ~5 ms/s).
- Verdeckte Reiter: Alle Reiter-Timer werden beim Wechsel beendet (geprüft). Der Looper-`tick` läuft verdeckt mit 4 Hz weiter, ohne zu zeichnen. Keine Dauer-Animationen (`getAnimations()` leer).

**Mitlaufen je Reiter** (`mitlauf.py`)

| Reiter | Drossel | Hauptthread ms/s | Script | Layout/s | Style/s | Mut./s | fps | Bilder >20 ms | >50 ms | lange Aufg. (max) |
|---|---|---|---|---|---|---|---|---|---|---|
| Looper | 1× | 376 | 92 | 85,5 | 145 | 333 | 59 | 1,4 % | 0,2 % | 0 |
| Looper | **4×** | **931** | 219 | 43 | 71 | 177 | **27** | **59 %** | **19 %** | **161 (193 ms)** |
| Jammen | 1× / 4× | 50 / 220 | 11 / 45 | 14 | 14 | 18 | 60 / 60 | 0 | 0 | 0 |
| Mitsingen | 1× / 4× | 31 / 164 | 13 / 66 | 1,6 | 1,6 | 6 | 60 / 60 | 0 | 0 | 0 |
| Quintenzirkel | 1× / 4× | 37 / 144 | 16 / 66 | 2 | 2 | 7 | 60 / 58 | 0,2 % / 0,1 % | 0,1 % | **1 (121 / 604 ms)** = Drone-Neuberechnung |
| Lernen | 1× | 28 | 10 | 1,6 | 1,6 | 6 | 60 | 0 | 0 | 0 |
| Looper 90 s | 1× | 403 | 96 | 84 | 144 | 330 | 59 | 1,8 % | 0,2 % | 2 (115 ms) |

Heap: 5,9–7,3 MB in allen Läufen, über 90 s 6,0 → 6,0 MB, also kein Leck. Audio-Uhr: höchstens ein Rückstand > 30 ms in allen Läufen (headless, wenig aussagekräftig). renderCapacity 3–8 %.

Trace Looper 1× (5 s, `trace.py`): Commit 230 ms/s, Paint 341×/s (60 ms/s), UpdateLayoutTree 112×/s, Layout 72×/s. Der hohe Commit-Anteil kommt wahrscheinlich vom Software-Compositing in headless (6 Canvas mit `will-change: transform`). Auf dem iPad mit GPU fällt er vermutlich geringer aus (**unsicher**).

**Optiken** (Looper-Reiter mitlaufend, 1×, 15 s)

| Optik | Hauptthread ms/s | Script | Layout/s | Style/s | „Rest“ (Paint/Commit) | fps |
|---|---|---|---|---|---|---|
| nordic | 373 | 88 | 88 | 147 | 236 | 59 |
| amp | 368 | 88 | 87 | 147 | 228 | 59 |
| dj | 369 | 93 | 88 | 149 | 229 | 60 |
| matrix | **444** | 110 | 86 | 146 | **276** | 59 |
| precise-dark | **338** | 78 | 83 | 143 | 217 | 60 |
| ios | 397 | 96 | 81 | 142 | 252 | 60 |

Alle Optiken liegen innerhalb von ±10 %, nur matrix ist +19 % (Maske `repeating-linear-gradient` in theme-dj/matrix, Leuchteffekte). Auf sichtbaren Looper-Flächen gibt es kein `backdrop-filter`, `filter`, `background-attachment: fixed` und keine Dauer-Animation. `backdrop-filter` steckt nur in `.modal` (looper.css:241) und gilt nur, solange ein Dialog offen ist. Nordic/amp haben 22 Elemente mit vielschichtigen Schatten, die beim Mitlaufen aber nicht neu gezeichnet werden. **Die Optik ist kein Leistungsthema. Das Neuzeichnen im Looper ist es.**

**Speicher/Cache** (`sw.js`): CORE lädt 38 Dateien vorab, ≈ 8,9 MB, davon 2,9 MB Hintergrundbilder aller Optiken (bg-metal.jpg allein 1,17 MB, bg-ice 0,32 MB …), egal welche Optik genutzt wird. Dazu kommt studio/index.html mit 0,46 MB. ASR (218 MB), Drums (29 MB) und Instrumente (20 MB) werden richtig erst bei Bedarf in eigene Speicher geladen. v100mem.py habe ich aus Zeitgründen nicht laufen lassen, Ersatz ist der 90-s-Heaptest oben.

### 2.2 Befunde nach Wirkung

**L1 – Pegelanzeigen erzwingen Layout in jedem Bild (Layout-Thrashing)** · Wirkung hoch
- Was: Pro gezeichnetem Bild schreibt `tick()` je Spur `--lv/--pk/--th` per `style.setProperty` (6 Schreibzugriffe) und liest danach `t.meter.clientHeight`. Das erzwingt pro Spur eine synchrone Layout-Berechnung, dazu kommt `meterEl.parentNode.clientWidth`.
- Beleg: 85 Layouts/s und 145 Stilberechnungen/s bei 30 Zeichnungen/s. 320 der 333 Mutationen/s gehen auf `.tm-ch`. **Versuch im Browser** (ohne Quelländerung, Init-Skript): Höhe gecacht → Layouts 85 → 31/s. Ohne Stil-Schreiben der Pegel (`patch_meterstyle.js`) bei 4×: lange Aufgaben 161 → 38, Bilder > 50 ms 19 % → 4,7 %, fps 27 → 37.
- Ursache: `app/looper.js › tick()` (Zeilen ~2185–2205, Schleife `tracks.forEach(t => { … t.mL.style.setProperty('--lv' …); const mh = t.meter.clientHeight; … })`).
- Vorschlag: Erst alles lesen, dann alles schreiben. `mh` nur im vorhandenen ResizeObserver messen. Pegel nur schreiben, wenn sich der gerundete Wert ändert (z. B. ganze %). Besser noch: Pegel als `transform: scaleY()` auf `.tm-fill` statt `height: calc(var(--lv))` (Compositor statt Layout) oder alle Pegel in einem Canvas.
- Aufwand: klein–mittel · Risiko für den Looper: gering (nur Anzeige) · Gewinn: ca. ⅔ weniger Layout/Stil im Looper, deutlich weniger Ruckeln bei schwacher CPU.

**L2 – `drawEditor()` zeichnet die komplette Wellenform 30× pro Sekunde neu** · Wirkung hoch
- Was: Der Spur-Editor ist nach dem Laden offen. Jedes Bild läuft über alle Pixelspalten (`peakRange`/`rmsRange` via `wrapMax`-Closures, Raster, Akkordzeile, `fillText`), obwohl sich nur der Abspielstrich bewegt. `drawOverview` macht dasselbe für die Übersicht.
- Beleg: Profil 1×: `drawEditor` inkl. 44 ms/s, `fillRect` 19 ms/s. Versuch 4× mit ausgeblendetem Editor: Script 219 → 145 ms/s, lange Aufgaben 161 → 42, Bilder > 50 ms 19 % → 5,9 %.
- Ursache: `app/looper.js › drawEditor()` (ab Z. 3349), `drawOverview()` (Z. 3332), Aufruf in `tick()`.
- Vorschlag: Wellenform, Raster und Akkordzeile in eine Offscreen-Canvas rendern, nur neu bei Zoom/Ausschnitt/Schnitt/Größe/Spur. Pro Bild nur Offscreen kopieren (`drawImage`) und den Abspielstrich (oder ein absolut positioniertes 2-px-Element mit `transform`) zeichnen. Dasselbe gilt für `drawOverview` und `drawWave`.
- Aufwand: mittel · Risiko: gering bis mittel (Editor-Interaktion beim Ziehen/Zoomen muss den Cache ungültig machen) · Gewinn: ≈ 70 ms/s Script bei 4×.

**L3 – Drone-Neuberechnung blockiert den Hauptthread (Hall-Impuls)** · Wirkung mittel, Risiko hoch
- Was: `drones.js › tick()` → `cycle('refresh')` → `render()` baut alle ~2,6 Durchläufe (≈ 80 s) eine neue Variante. Darin erzeugt `ensureReverb()` (script.part:309) jedes Mal einen neuen 6-s-Stereo-Impuls (2 × 288 000 Samples `Math.random`/`Math.pow` + `onePoleLowpass`) synchron auf dem Hauptthread, weil der Offline-Kontext keinen Hall mitbringt.
- Beleg: lange Aufgabe 121 ms (1×) bzw. **604 ms (4×)** im Quintenzirkel-Lauf. Profil: `ensureReverb` 4,8 ms/s Selbstzeit im Mittel, `startDroneV1`/`render`/`cycle` 5,7 ms/s. Im 90-s-Looper-Lauf 2 lange Aufgaben (max 115 ms).
- Ursache: `script.part › ensureReverb()`, aufgerufen in `drones.js › render()` (Z. 863 ff.).
- Vorschlag: Den Impuls einmal berechnen und den Float32-Puffer im Speicher halten (pro Abtastrate). Im Offline-Kontext dann nur `createBuffer` + `copyToChannel`. Alternativ in einen Worker auslagern. Drums planen nur `AHEAD = 0.3` s voraus (rhythm.js:477), ein 600-ms-Block könnte also Schläge verspäten. Das ist **nicht nachgewiesen**, weil headless die Drum-Ausgabe nicht prüfbar ist.
- Aufwand: klein · Risiko: gering (Klang identisch, wenn derselbe Puffer benutzt wird; Zufallsrauschen bleibt pro Sitzung fest) · Gewinn: keine 100–600-ms-Hänger mehr alle ~80 s.

**L4 – Start: 2,5 MB in einer Datei, davon 350 KB Schriften und 172 KB Englisch immer dabei** · Wirkung mittel (nur beim Start)
- Beleg: gzip 910 KB, bedienbar nach 1,3 s (1×) bzw. 3,6 s (4×), 489 ms Parsen/Stil.
- Vorschlag: (a) Die sechs Optik-Schriften als eigene .woff2-Dateien statt Base64 in CSS. Sie laden dann nur bei der Optik, die sie braucht, und Base64 + woff (nicht woff2) ist ≈ 1,6× größer. (b) `i18n-en.js`/`i18n-en2.js` nur bei EN nachladen. (c) Code von Powerchords-Kurs (307 KB), CAGED (231 KB), Songwriting (126 KB), Hilfe-Daten (88 KB) erst beim ersten Öffnen laden. Die Bau-Logik ist bei Powerchords schon lazy, der Code aber nicht. (d) Optik-CSS nur für die aktive Optik.
- Aufwand: mittel (build.py, SW-Liste) · Risiko für den Looper: keins · Gewinn: ca. 40 % weniger Start-Bytes, geschätzt 1–1,5 s schneller bedienbar bei 4× (**Schätzung**, nicht gemessen).

**L5 – Service Worker lädt 2,9 MB Optik-Bilder aller Optiken vorab** · Wirkung klein
- Vorschlag: Nur die Bilder der Standard-Optik in CORE, andere „Cache zuerst“ beim ersten Gebrauch (der Fetch-Handler kann das schon). Aufwand klein, Risiko: Offline-Wechsel auf eine nie benutzte Optik zeigt keine Bilder.

**L6 – Kleine Dauerläufer in einzelnen Reitern** · Wirkung klein
- CAGED 8 Layouts/s im Leerlauf (caged.js:360), Improvisation 84 Mutationen/s (solo.js:585, u. a. `toggle-btn`, `sfPlay`), Jammen `jamBpm` 12,6/s (jam.js:422), Mitsingen rAF ohne Wiedergabe (singen.js:67, setzt jedes Bild `playEl.textContent`). Vorschlag: nur schreiben, wenn sich der Wert ändert. Bei Mitsingen ohne laufende Wiedergabe den rAF anhalten. Aufwand klein, Risiko keins.

**L7 – Pegel/Ringe: Canvas-Größe in jedem Bild per `clientWidth/clientHeight` prüfen (`fit()`)** · Wirkung klein
- `fit()` (looper.js:1970) liest pro Canvas und Bild die Größe. Ohne vorherige Schreibzugriffe ist das billig, nach L1 aber ein Thrashing-Kandidat. Größe im vorhandenen ResizeObserver merken.

Nicht neu gemeldet: Die `v119leistung`-Abweichung „Schätzung passt zur Messung“.

## 3. Design

Bilder: `shots/<optik>_<ansicht>_<breite>.png` (nordic vollständig, precise-dark/ios für Looper, Pop-ups, Lernen, Kurs, Jammen, Mitsingen, Quintenzirkel), Studio: `shots/studio_*_<breite>.png`. Automatische Prüfungen: `audit_<optik>.json` (Skript `audit.js`).

**D1 – iPad quer: Aufnahme/Overdub liegt unter dem ersten Bildschirm, sobald Spuren geladen sind** · hoch
- Wo: Looper, 1366×1024. Leer liegt REC bei y≈868 (sichtbar). Mit Spuren schieben „Was passt“ (≈170 px), die Tonart-/Akkordköpfe der Spuren und der Ring die REC/Overdub-Knöpfe auf y > 1024. Telefon 390: Auf dem ersten Bildschirm ist keine Spur zu sehen. Der Kopf mit LCD braucht 340 px, die ganze Looper-Seite ist 7300 px hoch.
- Beleg: `nordic_looper-spuren_1366.png`, `ios_looper-spuren_1366.png`, `nordic_looper-spuren_390.png`, `nordic_looper-spuren-ganz_1366.png` (4443 px Seite)
- Vorschlag: „Was passt“ standardmäßig einklappen oder unter die Spuren schieben. Ring bei Querformat kleiner (Höhe an `100dvh` koppeln). Oder eine feste Transportleiste unten im Daumenbereich (REC/Overdub/Stopp je Spur + Alle starten).
- Aufwand: mittel

**D2 – Optik „iOS“: aktiver Knopf „Blitz: jeder Takt“ unlesbar (hellblau auf orange)** · hoch
- Wo: Looper-Leiste unter Drone. `#loopFlash.active` (looper.css:144) setzt das orange Verlaufsbild per ID-Selektor, die Optik setzt nur die Textfarbe (rgb 100,176,255). Rechnerisch ≈ 1,3:1. Precise-dark: hell-pfirsich auf orange ≈ 1,3–1,5:1. Dasselbe Muster gilt für `.export-btn` (mit `!important`) und `.mini button.on`: Sie bleiben in allen Optiken orange.
- Beleg: `ios_looper-blitzleiste_1366.png`, `precise-dark_looper-blitzleiste_1366.png`
- Vorschlag: In theme-ios/theme-precise-dark `#loopFlash.active`, `.export-btn`, `.mini button.on` überschreiben, oder die Knöpfe auf die gemeinsamen Klassen (aktiver Toggle/Primärknopf) umstellen.
- Aufwand: klein

**D3 – Touch-Ziele im Looper und Kopf zu klein** · hoch (iPad-Bedienung mit Gitarre)
- Beleg (automatisch, 1366): Looper leer 105 von 108 Bedienelementen < 44 px, 69 < 32 px, 25 < 24 px. Kopf: App-Optik/Leistung/Live 22 px hoch, „EN“ 28×18, Amp-„▾“ 34×17, Spurknöpfe ■ ↶ × ✂ ♫ 58×32, EQ/Hall/Studio/Gesang 308×27, Tempo ± 32×32, Bereichsreiter 36 px, Schieberegler 16 px. Gegenbeispiel Powerchords-Kurs: 0 von 51 unter 44 px. Mitsingen 14/15, Jammen 38/51, CAGED 24/24 unter 44 px.
- Beleg: `nordic_looper-leer_1366.png`, `nordic_looper-spuren_820.png`, Liste in `audit_nordic.json` (`touch.smallest`)
- Vorschlag: eine Mindesthöhe `--hit: 44px` für `.toggle-btn`, Kopf-Knöpfe und Spurknöpfe. Schieberegler mit größerem Daumen (≥ 28 px) und `touch-action`.
- Aufwand: mittel (Layout wird höher, deshalb zusammen mit D1 lösen)

**D4 – Tonarten widersprechen sich zwischen Ansichten (G# vs. A♭, globale Tonart vs. Spur)** · mittel
- Wo: Spur 2 zeigt „G# Dur“ (Spurkopf). Improvisation zeigt für dieselbe Spur „A♭-Dur erkannt in Spur 2“. „Was passt“/Akkorde schreiben E♭5/A♭5. Gleichzeitig steht im Kopf-LCD dauerhaft „G Ionisch“ plus Zeile „Startton: G (Stufe 1) – Ionisch (Dur)“, in Jammen „A-Moll“. Das sind drei Tonarten auf einem Bildschirm.
- Beleg: `nordic_looper-spuren_1366.png` (G# Dur / Eb5), `nordic_improvisation_390.png` (A♭-Dur), `nordic_jammen_1366.png` (G Ionisch im Kopf, A-Moll im Jam)
- Vorschlag: Spurkopf-Tonart auch über `spellPc` schreiben. Klar machen, dass die Kopf-Tonart die des Griffbrett-Trainers ist (beschriften oder nur in Lernen/Technik zeigen). Die Zeile „Startton …“ aus dem Kopf in den Technik-Reiter verschieben.
- Aufwand: klein

**D5 – Mitsingen: großer leerer Bereich ohne Erklärung** · mittel
- Wo: Song & Gesang › Mitsingen bei geladener, gedehnter Spur. ≈ 600 px leere Bühne mit 4 Punkten, der Hinweis („… dafür gibt es keinen Gesangstext. Lade es mit ‚Andere Spuren vorher leeren‘“) steht klein in Mono-Schrift ganz unten.
- Beleg: `nordic_mitsingen_820.png`
- Vorschlag: Leerer Zustand mittig mit Symbol, einem Satz und einem Knopf zum Handeln (z. B. „Datei neu laden“ / „Zur Improvisation“). Bühne erst zeigen, wenn Text da ist (Code `sbEmpty`/`sbStage` gibt es schon).
- Aufwand: klein

**D6 – Uneinheitliches Schriftbild: 26 Schriftgrößen im Looper, Überschriften kleiner als Text** · mittel
- Beleg (automatisch): Looper mit Spuren 26 verschiedene font-size-Werte (8,32 … 41,6 px; 96× 12,8 px), Improvisation 23, 12 verschiedene Radien (7 px ×120, 6 px ×41, 9, 8, 2, 3, 5, 1 px). Alle H2 sind 13,76 px, also kaum größer als Fließtext 12,8 px. In Technik gibt es zusätzlich H2 mit 11,52 px. Kurs-Überschrift H3 16,8 px, Kapitelnamen 16 px. Die Zierschrift (Uncial/Cinzel) für Kartentitel ist bei „Begleitung“, „Akkordfolge“, „Mitsingen“ schwer lesbar.
- Beleg: `nordic_jammen_1366.png`, `nordic_mitsingen_820.png`, `audit_nordic.json` (`fontsizes`, `radii`)
- Vorschlag: Stufenleiter mit 5–6 Größen (11/13/15/18/24/32) und 3 Radien als CSS-Variablen. Die Zierschrift nur für den Markennamen, Kartentitel in der Textschrift.
- Aufwand: mittel (viele Dateien, aber rein CSS)

**D7 – Drei Navigationsebenen mit drei verschiedenen „aktiv“-Stilen** · mittel
- Wo: Lernen › Powerchords-Kurs. Bereich (grau gefüllt) → Chip (gold) → Kurs-Unterreiter (grün). Dazu kommt „Notenkarte“ als vierte Zeile. Auf 820 px ist die Chipzeile abgeschnitten („Sp…“), ohne Hinweis, dass man scrollen kann.
- Beleg: `nordic_kurs_1366.png`, `nordic_lernen_820.png`, `ios_kurs_820.png`
- Vorschlag: ein einheitlicher Aktiv-Stil je Ebene, Kurs-Unterreiter als Segment in der Akzentfarbe der Optik. Chipzeile mit Ausblendverlauf am Rand oder umbrechen lassen.
- Aufwand: klein

**D8 – Studio wirkt wie eine andere App** · mittel
- Wo: Studio. Name „Loopsmiths Studio · s3“ statt „Looper 3nps“, flacher iOS-Look ohne Optiken, eigene Tonart (C Dur, 100 BPM) unabhängig vom Looper. Telefon: Ansichtsleiste läuft 40 px über („Aus dem Lo…“, `scrollWidth − clientWidth = 40`), Hinweis „Links etwas auswählen“, obwohl die Liste darüber steht. Alle 20–30 Bedienelemente < 44 px.
- Beleg: `studio_arrangement_1366.png`, `studio_start_390.png`
- Vorschlag: Namen vereinheitlichen. Studio mindestens die Akzentfarbe/Schrift der gewählten Optik übernehmen lassen (`3nps-theme2` lesen). Ansichtsleiste auf dem Telefon scrollbar/umbrechend.
- Aufwand: klein (Name, Überlauf) bis mittel (Optik)

**D9 – Deutsch/Englisch-Mischung und Symbol-Mischung** · klein
- Englisch in deutscher Oberfläche: „Power Chord Theory – Kurs“, „Ear Candy“, „Drop 2/3“, „Closed Voicings“, „Backing Track“, „Mono“, „Overdub“, „Limiter“, „Signalweg“ vs. „Live“. Teils als Fachbegriffe vertretbar, die Kursüberschrift aber nicht.
- Symbole: Lernen-Kacheln mischen Emoji (🎸 ⏱ 👂 📋) mit Unicode-Zeichen (◈ ◎ ▦). Im Looper sind 18 Knöpfe mit Emoji und 0 mit SVG. Emoji sehen auf iPad, Mac und Chromium unterschiedlich aus.
- Beleg: `nordic_kurs_1366.png`, `nordic_lernen_820.png`
- Vorschlag: einheitlicher SVG-Iconsatz (die Kurs-Kacheln nutzen schon SVG-Ringe). Kursüberschrift „Powerchord-Kurs“.
- Aufwand: klein–mittel

**D10 – Kontrast: Platzhalter und Mini-Beschriftungen** · klein
- Platzhalter (`#ideaName`, `#lsName`, `#ldPaste`, `#sbTrText`) nutzen das Browser-Grau #757575. Auf #121214 ergibt das ≈ 4,0:1 (< 4,5), in iOS auf halbtransparentem Grau noch weniger. Mini-Beschriftungen „AKKORD/DANACH“ im Spurkopf mit 8,3 px: iOS 2,8:1, precise-dark 3,0:1. Gesperrte Knöpfe (opacity .4) sind ausgenommen.
- Hinweis: Die automatische Prüfung meldet in nordic viele Knöpfe mit 1,02:1. Das sind **Fehlalarme**, denn Verlaufsknöpfe mit dunkler Schrift auf Gold sind lesbar (nachgeprüft).
- Beleg: `audit_ios.json`/`audit_precise-dark.json` (`contrast.worst`), `ios_looper-spuren_1366.png`
- Vorschlag: `::placeholder { color: var(--muted) }` je Optik, Mini-Labels ≥ 10 px und mindestens `--muted`.
- Aufwand: klein

**D11 – Spur 3 (leer) sitzt anders als belegte Spuren** · klein
- Belegte Spuren haben einen Kopf mit Tonart/Akkord, die leere nicht. Dadurch stehen Ring und REC in Spur 3 ≈ 25 px höher bzw. tiefer als nebenan.
- Beleg: `nordic_looper-spuren_1366.png`, `nordic_looper-spuren_820.png`
- Vorschlag: Kopfhöhe reservieren (`min-height`). Aufwand klein.

**D12 – Kopfzeile „Startton …“ liegt über dem Runen-Fries** · klein
- Graue Mono-Schrift auf der Runen-Textur ist in nordic kaum lesbar und hat für Looper/Jammen keine Bedeutung.
- Beleg: `nordic_lernen_820.png`, `nordic_mitsingen_820.png`. Zusammen mit D4 lösen.

**iPad-spezifisch (Code-Blick)**
- Gut: `viewport-fit=cover` und safe-area in Kopf (`head_app.html:43`) und Dialogen (`looper.css:382`). `apple-mobile-web-app-capable`, Statusleiste `black-translucent`, Manifest mit maskierbarem Icon. `:hover` nur als Zierde, nie zur Bedienung nötig.
- `100vh` an 4 Stellen (hilfe.css:10, looper.css:594/595, metal.css:13): In Safari mit eingeblendeter Leiste zu hoch. `100dvh` mit `100vh`-Rückfall empfohlen (klein). In der PWA ohne Leiste meist unkritisch.
- Manifest `theme_color` #0a0a0b, Meta-Tag #1b1b1d: kleiner Farbsprung beim Start (kosmetisch).
- Tastatur verdeckt Eingaben: im Chromium nicht prüfbar. Textfelder (Jam-Akkorde, Songwriting, Gesangstext) liegen mittig/unten, deshalb auf echtem iPad testen (**offen**).
- Seitliches Scrollen: auf keiner Ansicht in 390/820/1366 (`hscroll = 0`). Griffbretter und Tabellen scrollen in eigenen Containern. Einzige Ausnahme: Studio auf dem Telefon (+40 px).

## 4. Vorschlag Arbeitspakete

1. **v141 – Looper-Zeichnen sparsam** (L1 + L2 + L7): Pegel ohne Layout-Lesen, nur bei Änderung schreiben. Editor/Übersicht/Wellen als Offscreen-Cache, pro Bild nur Abspielstrich. Messziel bei 4×: Bilder > 50 ms < 3 %, lange Aufgaben < 20 in 20 s. *Grund: oberste Regel Looper-Leistung, größter gemessener Hebel, nur Anzeige betroffen.*
2. **v142 – Drone-Hall einmal rechnen + Dauerläufer** (L3 + L6): Impuls-Puffer cachen, Reiter-Timer nur bei Änderung schreiben, Mitsingen-rAF anhalten. *Grund: klein, entfernt den einzigen echten Hänger während der Wiedergabe.*
3. **v143 – Looper-Bedienung im Daumenbereich** (D1 + D3 + D11 + D4/D12): 44-px-Ziele, Transport sichtbar ohne Scrollen auf iPad quer/hochkant, „Was passt“ einklappbar/unten, Tonart-Schreibweise einheitlich, Startton-Zeile weg aus dem Kopf. *Grund: nach v141, weil Größen- und Layoutänderungen dann gleich mitgemessen werden können.*
4. **v144 – Optiken und Einheitlichkeit** (D2 + D6 + D7 + D9 + D10): Sonderknöpfe in iOS/precise-dark, Schrift- und Radius-Stufen als Variablen, einheitliche Aktiv-Stile, Platzhalter-Kontrast, Mitsingen-Leerzustand (D5). *Grund: rein CSS/Text, geringes Risiko.*
5. **v145 – Start schlanker** (L4 + L5 + D8-Name/Überlauf): Schriften als Dateien, EN-Wörterbuch und große Lernmodule nachladen, SW-CORE nur Standard-Optik, Studio-Name und Telefon-Leiste. *Grund: nur Startzeit betroffen, Bau/SW-Änderung braucht eigenen Offline-Test.*

## 5. Nicht ändern / schon gut

- Leerlauf ist sauber: verdeckte Reiter beenden ihre Timer, keine Dauer-Animationen, Looper-`tick` zeichnet verdeckt nicht.
- Lazy-Bau der Lernmodule (Powerchords-Panel 20 Elemente bis zum Öffnen), Hilfe-Bilder und ASR/Drums/Instrumente in eigenen Caches.
- Kein Speicherleck (Heap 90 s konstant), keine Skriptfehler in allen Läufen.
- Kein seitliches Scrollen auf iPad/Telefon. Safe-area und PWA-Grundlagen sind korrekt.
- Powerchords-Kurs und Lernen-Übersicht: 44-px-Ziele, klare Kacheln. Das ist der Maßstab für den Rest.
- precise-dark ist im Looper-Mitlauf die sparsamste Optik (−10 %). Die Optiken insgesamt sind kein Leistungsproblem, deshalb nicht aus Leistungsgründen umbauen.
- Signalweg-Dialog: übersichtlich und informativ (`nordic_pop-signalweg_820.png`).

## 6. Grenzen der Prüfung

- Nur Chromium headless mit Software-Rendering, kein echtes iPad/Safari/WebKit. Paint/Commit-Kosten (≈ 230 ms/s) sind auf GPU-Geräten vermutlich deutlich kleiner.
- CPU-Drosselung 4× ist eine grobe Näherung: Sie bremst JS/Layout gleichmäßig, nicht aber GPU, Audio-Thread oder Speicherbandbreite.
- Audio-Aussetzer sind headless nicht hörbar. Gemessen wurde nur Audio-Uhr vs. Echtzeit und renderCapacity. Ob L3 hörbare Drum-Aussetzer erzeugt, ist **unbelegt**.
- Die „Gewinn“-Zahlen zu L1/L2 stammen aus Simulationen per Init-Skript (Pegel-Stil abgeschaltet, Editor ausgeblendet). Eine echte Umsetzung erreicht sie nur ungefähr.
- Kontrast automatisch nur gegen Hintergrundfarben. Bei Verlaufs-/Bildgründen sind die Werte unzuverlässig (gekennzeichnet) und wurden per Bild nachgeprüft.
- Bildschirmtastatur, Pedal-Bedienung, Mikrofon mit echtem Eingang und v100mem (lange Dateien) wurden nicht geprüft.
- Screenshots im Telefonformat mit `is_mobile`, iPad-Formate nur mit `has_touch` (kein echtes iPadOS-Layout-Verhalten).
