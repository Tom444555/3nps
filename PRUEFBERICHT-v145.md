# Abschlussmessung v140 → v145 (Leistung)

Stand: 12.11.2026 · reine Messung, keine Änderung an der App · Skript `test/mess/mess.py`, Rohdaten `test/mess/erg-v140.json` / `erg-v145.json`

Vorgehen wie `PRUEFBERICHT-v140.md`: Chromium headless (Software-Rendering), 1366×1024, Service Worker aus.
Beide Stände wurden **in derselben Sitzung auf demselben Rechner** gemessen (v140 = main-Commit 1c5b723, v145 = main 4d60c6d),
weil der Messrechner diesmal etwa doppelt so schnell ist wie am 11.11. – die absoluten Zahlen sind deshalb nicht mit dem alten Bericht
vergleichbar, nur v140 gegen v145 untereinander. Darum zusätzlich „8× gebremst“ (entspricht hier etwa dem alten „4ד).
Mitlaufen = 3 Spuren (c_pop_strum, funk_104_3T, guitar_only_95_4T) + Drums + Drone + „Was passt“ offen, je 15 s.
Zeiten (ms/s, fps) schwanken zwischen zwei Läufen um etwa ±20 %; Zählwerte (Layouts, Änderungen) sind stabil.

## Start (Median aus 5 Starts)

| Wert | v140 | v145 |
|---|---|---|
| index.html roh / gzip | 2,51 / 0,91 MB | 2,04 / 0,59 MB |
| Update-Paket (CORE in sw.js) | 38 Dateien, 8,9 MB | 16 Dateien, 3,5 MB |
| load 1× / 4× | 391 / 1088 ms | 342 / 958 ms |
| lange Aufgaben 1× (Anzahl, Summe) | 2, 154 ms | 1, 105 ms |
| lange Aufgaben 4× (Anzahl, Summe, max) | 9, 782 ms, 203 ms | 10, 742 ms, 165 ms |
| bedienbar 4× (Ende letzte lange Aufgabe) | 2,36 s | 2,21 s |

Start: Download deutlich kleiner (−35 % gzip, Update −60 %), Rechenzeit beim Start nur ~5–12 % besser. Zwischen load (≈1,0 s) und
„bedienbar“ (≈2,2 s) liegen bei 4× weiter ~1,2 s lange Aufgaben nach dem Laden (Drum-/Bass-Vorbereitung) – das ist der nächste Hebel.

## Leerlauf (5 s je Bereich, nichts läuft)

| Bereich | Layouts/s v140 → v145 | Änderungen/s v140 → v145 | Hauptthread ms/s |
|---|---|---|---|
| Looper | 0 → 0 | 4,2 → 4,4 | 11 → 10 |
| CAGED | 8,4 → 0 | 38 → 4 | 19 → 10 |
| Improvisation | 10 → 0 | 85 → 5 | 23 → 9 |
| Jammen | 12,6 → 0 | 17 → 4 | 18 → 7 |
| Mitsingen / Quintenzirkel / Lernen | 0 → 0 | ≈4–5 | 9–15 → 7–10 |

Die Dauerläufer in CAGED, Improvisation und Jammen sind still. Rest ≈4 Änderungen/s in jedem Bereich (unschädlich, nicht weiter verfolgt).

## Mitlaufen je Bereich

| Bereich | Bremse | Hauptthread ms/s | Script ms/s | Layouts/s | Änderungen/s | fps | Bilder >20 ms | >50 ms | lange Aufg. |
|---|---|---|---|---|---|---|---|---|---|
| Looper | 1× | 223 → 154 | 47 → 17 | 88 → 31 | 339 → 183 | 60 → 59 | 0 → 1,0 % | 0 → 0 | 0 → 0 |
| Looper | 4× | 751 → 522 | 165 → 58 | 78 → 28 | 302 → 167 | 54 → 56 | 11,4 → 5,8 % | 0 → 0,6 % | 0 → 0 |
| Looper | 8× | 968 → 929 | 180 → 121 | 60 → 24 | 236 → 145 | 22 → 27 | 85 → 80 % | 25 → 11 % | 118 → 38 |
| Jammen | 1× / 4× | 21→18 / 64→32 | 3 / 9 | 13,6 → 1,7 | 18 → 6 | 60 | 0 | 0 | 0 |
| Mitsingen | 1× / 4× | 14→12 / 38→34 | | 1,6 | 6 | 60 | 0 | 0 | 0 |
| Quintenzirkel | 1× / 4× | 12→11 / 54→41 | | 1,9 | 7 | 60 | 0 | 0 | 0 (im Fenster keine Drone-Neuberechnung) |
| Lernen | 1× / 4× | 18→14 / 54→41 | | 1,6 | 6 | 60 | 0,1 % | 0–0,1 % | 1 (57/262 ms) → 0/1 (149 ms) |

Looper: Script-Zeit −64 %, Layouts −65 %, Änderungen −46 %, Hauptthread −30 % (1× und 4×). Bei 8× ist der Hauptthread in beiden Ständen
voll (Rest = Malen/Zusammensetzen im Software-Rendering), aber lange Aufgaben 118 → 38 und Bilder > 50 ms 25 % → 11 %.
Heap in allen Läufen 31–33 MB, gleichbleibend. Keine Skriptfehler.

## Geräte-Profile (nur v145, Looper mitlaufend)

| Profil | Bremse | Hauptthread ms/s | Layouts/s | Änderungen/s | fps | Bilder >20 ms | >50 ms | lange Aufg. |
|---|---|---|---|---|---|---|---|---|
| Neues iPad | 1× / 4× / 8× | 179 / 667 / 859 | 30 / 27 / 16 | 179 / 161 / 99 | 59 / 50 / 39 | 1,9 / 17,6 / 38 % | 0,1 / 0,4 / 5 % | 0 / 3 / 35 |
| Altes iPad | 1× / 4× / 8× | 72 / 303 / 575 | 13 | 50 | 60 / 60 / 54 | 0 / 0,9 / 9 % | 0 / 0 / 0,7 % | 0 / 0 / 11 |
| Minimal | 1× / 4× / 8× | 24 / 74 / 123 | 3 | 11 | 60 / 60 / 60 | 0 / 0,1 / 0,2 % | 0 | 0 |

„Altes iPad“ braucht etwa 40–55 % der Hauptthread-Zeit von „Neues iPad“, „Minimal“ etwa 13 %. „Automatisch“ wählt headless „Neues iPad“.
Gegenüber v140 (8×: 968 ms/s, 22 fps, 118 lange Aufgaben) läuft „Altes iPad“ bei 8× mit 54 fps und 11 langen Aufgaben, „Minimal“ ohne Ruckler.

## Grenzen

- Nur Chromium headless, kein iPad/Safari; Malen/Zusammensetzen ist auf dem iPad mit Grafikchip vermutlich billiger.
- Ein Lauf je Zelle (Start: 5), Zeiten ±20 %. „Neues iPad“ und „Automatisch“ sind dasselbe Profil; ihre Unterschiede oben zeigen die Streuung.
- Nicht gemessen: 90-s-Lauf, Drone-Neuberechnung (v142: Hall nur einmal), Optiken einzeln, Audio-Aussetzer (headless nicht hörbar).
