# Paket „Übezeit“ – Tracking, Import/Export, Themen, Übersicht (Aufträge von Tom am 25.11.2026)

Rahmen wie in `PAKETE-v149-v154.md` Abschnitt „Rahmen“ (gilt unverändert). Musterdateien (erfunden, gleiches Format wie Toms Numbers-Export):
`test/numbers/` (ZIP, CSV, ERWARTET.txt). Toms echte Datei liegt NIE im Repo.

## Aufteilung in zwei Versionen (nacheinander, jede für sich veröffentlicht)
- **Teil A (erste Version): Tracking-Kern.** Neue Seite „Übezeit“ unter „Lernen“ mit Schalter „Üben: An / Aus“ (auch in der Kopfleiste), „Was übe ich?“ (Themen),
  Speicherformat, Import (ZIP/CSV aus Numbers), CSV-Export, „Import entfernen“, Liste „Letzte Einheiten“ mit Ändern/Löschen, einfache Summen
  (Heute · Woche · Monat · Jahr · Gesamt), Kurzfassung in „Technik“ mit Knopf „Ganze Übersicht“; der Verlauf aus v152 zählt die neuen Einheiten mit.
- **Teil B (zweite Version): detaillierte Übersicht.** Alle Kennzahl-Kacheln, Börsenkurs-Verlauf mit 3J/aufsummiert, Balken (Wochentag, Monat, Jahr, Tageszeit),
  Kalender-Raster, „Woran geübt“ je Thema, Feinschliff der Gestaltung wie „Mein Arbeitsbereich“.
Das Speicherformat in Teil A gleich so anlegen, dass Teil B nur noch liest.

Die folgenden Abschnitte sind Toms Wünsche in der Reihenfolge, in der sie kamen:

## Import aus Numbers
Tom führt seit 2023 ein Übungs-Protokoll in Apple Numbers (741 Einheiten, ~1179 Stunden). Numbers exportiert als ZIP mit mehreren CSV; maßgeblich ist die
Tabelle mit der Kopfzeile `Datum und Uhrzeit;Start/Ende;Übungszeit;Übungen` (Trennzeichen `;`, UTF-8, evtl. BOM). Zeilenpaare „Start“ (Übungszeit `!!`) und
„Ende“ (Dauer). Gezählt wird NUR jede „Ende“-Zeile: Zeitpunkt = Ende, Dauer aus Texten wie `1m`, `2h`, `1h 23m`, `15h 15m 0s 0ms`, `0ms`; Datum
`TT.MM.JJJJ, HH:MM`, Tag/Monat auch einstellig. Vierte Spalte = freie Notiz (selten). Es gibt vereinzelt doppelte „Start“-Zeilen – ignorieren.
Andere CSV im ZIP (Pivot, „Blatt 2“) ignorieren (an der Kopfzeile erkennen).
Umsetzung in der Karte „Übe-Verlauf“ (v152): Knopf „Übezeit importieren …“ (≥ 44 px) → Dateiauswahl nimmt die ZIP direkt (im Browser entpacken,
ohne fremde Bibliothek: ZIP-Verzeichnis lesen + `DecompressionStream('deflate-raw')`, auch „stored“) oder eine einzelne CSV. Danach Meldung
„N Einheiten, X Stunden, von … bis … übernommen (M schon vorhanden)“. Erneuter Import darf nichts doppeln (Schlüssel = Ende-Zeitpunkt + Dauer) und nichts
Bestehendes verändern. Speicherung: nur ergänzen – entweder als Einträge im vorhandenen Übungslog mit Herkunfts-Kennzeichen oder in einem neuen
localStorage-Schlüssel (kompakt, ~750 Einträge); entscheide nach dem, was das Übungslog/„Letzte Einheiten“ nicht durcheinanderbringt (importierte Einheiten
sollen im Verlauf „Übezeit“ zählen, haben aber kein Tempo; „Letzte Einheiten“ und Statistik-Kacheln nicht mit 741 Zeilen fluten). „Alles sichern“ muss die
Daten mitnehmen (localStorage `3nps-*`). Dazu „Import entfernen“ (nur die importierten Einheiten, mit Rückfrage). Der Hinweistext der Karte nennt den Import.
Bei großen Zeiträumen (3 Jahre) muss das Diagramm lesbar bleiben („Alles“ je Monat bündeln, wenn nötig). Kein Timer, nichts vor dem Öffnen der Karte.
DATENSCHUTZ: Toms echte Datei liegt nur in /tmp/numbers_in – NICHT ins (öffentliche) Repo legen, keine echten Einträge in Tests, Doku oder Bildern.
Für Tests die erfundenen Musterdateien in test/numbers/ nehmen. Mit der echten Datei (nur in der laufenden Sitzung unter /tmp/numbers_in, falls vorhanden) nur lokal
gegenprüfen: Es müssen 741 Einheiten und 1178 h 37 min herauskommen (nur diese zwei Zahlen dürfen in die Rückmeldung).

## Dazu im selben Paket: Übe-Schalter „Üben: An / Aus“ (Tom: „an und aus Schalter, wo man dann automatisch tracken kann, ich will alles in einem haben“)
Ziel: Tom braucht Numbers nicht mehr – die App zählt die Übezeit selbst, so wie seine Tabelle (Start → Ende → Dauer, optional Notiz).
- Ein Schalter „Üben“ (An = Zeit läuft, Aus = Einheit wird mit Start, Ende, Dauer gespeichert; landet im selben Speicher wie der Import und zählt im Verlauf „Übezeit“).
- Erreichbar, ohne den Looper zu verlassen: kompakter Knopf in der Kopfleiste (z. B. neben „Live“, zeigt bei „An“ die laufende Zeit als hh:mm), NUR wenn
  dabei bei 390 / 820 / 1366 in allen Optiken und Profilen nichts umbricht, verrutscht oder höher wird; sonst an der nächstbesten festen Stelle im Looper.
  Zusätzlich groß in der Karte „Übe-Verlauf“ mit Feld „Notiz“ (optional) und der laufenden Zeit.
- Technik: beim Einschalten nur den Startzeitpunkt in localStorage merken (kein Dauer-Timer nötig; Anzeige höchstens 1×/min bzw. nur wenn sichtbar auffrischen,
  kein Einfluss auf Audio). Läuft über Schließen/Neustart der App weiter. Beim Wiederöffnen mit laufender Zeit: klar anzeigen „läuft seit HH:MM“.
  Vergessenes Ausschalten: Beim Ausschalten nach mehr als 8 Stunden nachfragen und die Endzeit/Dauer korrigieren lassen; Einheiten unter 1 Minute nicht speichern.
- Letzte selbst gezählte Einheit lässt sich löschen/korrigieren (Dauer). „Als CSV exportieren“ im Numbers-Format der Vorlage (gleiche Kopfzeile, Start/Ende-Zeilen),
  damit nichts in der App eingeschlossen ist. Im Profil „Minimal“ bleibt der Schalter nutzbar (er kostet nichts).
- Anleitung-Thema, EN-Texte, Test (Zeit per vorbelegtem Startzeitpunkt bzw. gefälschter Uhr prüfen, nicht real warten).

## Dazu: Übersicht „Übezeit“ wie in Toms Dashboard „Mein Arbeitsbereich“ (Tom: „eine schöne detaillierte Übersicht und Anzeige wie in Mein Arbeitsbereich“)
„Mein Arbeitsbereich“ ist Toms privates Dashboard im iOS-Stil: ruhige Karten mit runden Ecken, oben Kennzahl-Kacheln (großer Wert, kleine Beschriftung,
▲/▼ in Grün/Rot), Verlaufsdiagramme im Börsenkurs-Stil mit Zeitraum-Knöpfen und Hoch/Tief, klare Abschnitte untereinander, am breiten Bildschirm zweispaltig.
Weil das mehr ist als eine Karte, bekommt es eine eigene Seite (Regel: Neues auf eigene Reiter statt Bestehendes überladen): im Bereich „Lernen“ ein neuer
Unterpunkt „Übezeit“ (Chip in der Unterleiste, eigene Panel-ID, wird erst beim ersten Öffnen gebaut; `tabs.js`/`AppNav`, `test/nav.py` ergänzen). Die Karte
„Übe-Verlauf“ in „Technik“ (v152) bleibt als Kurzfassung und bekommt den Knopf „Ganze Übersicht“ dorthin; Schalter, Import und Export sitzen auf der neuen Seite
(Schalter zusätzlich in der Kopfleiste, siehe oben).
Inhalt der Seite, von oben nach unten:
1. Schalter „Üben: An / Aus“ groß mit laufender Zeit und Notiz.
2. Kennzahl-Kacheln: Heute · Diese Woche · Dieser Monat · Dieses Jahr · Gesamt (Stunden) · Ø je Übetag · Übetage · Serie (Tage in Folge, aktuell/beste) ·
   längste Einheit · beste Woche. Wo sinnvoll ▲/▼ zum Vorzeitraum.
3. Verlauf im Börsenkurs-Stil (aus v152 wiederverwenden): Übezeit mit 1W · 1M · 3M · 1J · 3J · Alles, sinnvoll gebündelt (Tag/Woche/Monat), dazu umschaltbar
   „aufsummiert“ (Gesamtstunden über die Zeit).
4. Balken: je Wochentag (Ø), je Monat (letzte 12), je Jahr (Vergleich); Tageszeit (wann wird geübt).
5. Kalender-Raster des laufenden Jahres (je Tag ein Feld, Helligkeit = Minuten), Jahr umschaltbar.
6. Liste „Letzte Einheiten“ (Datum, Dauer, Notiz; importierte gekennzeichnet), seitenweise – nie alle 750 Zeilen auf einmal ins DOM.
7. Unten: „Übezeit importieren …“, „Als CSV exportieren“, „Import entfernen“, Hinweis woher die Zahlen kommen.
Gestaltung: in den Farben/Schriften der gewählten App-Optik (kein eigenes Farbsystem; mit der Optik „iOS“ sieht es am ehesten wie das Dashboard aus), alle
Diagramme als SVG ohne Bibliothek, lesbar in nordic, precise-dark, ios und hellen Optiken; 390 einspaltig, ab ~820 zweispaltig; Bedienelemente ≥ 44 px;
in „Altes iPad“ ohne Schatten/Übergänge, in „Minimal“ Kennzahlen + Schalter + Liste ohne Diagramme. Rechnen nur beim Öffnen bzw. nach Änderung
(741 Einheiten müssen ohne spürbare Wartezeit gehen: gemessen < 50 ms ungedrosselt), keine Timer außer der Minutenanzeige des Schalters bei sichtbarer Seite.
Leerzustand freundlich (Schalter + Import anbieten). Bilder für Tom mit den MUSTERDATEN (nie mit echten): Seite oben/Mitte/unten in 390×844 und 1366×1024,
Optik ios und nordic, nach /tmp/shots/v154_*.png – selbst ansehen und nachbessern, bis es wirklich aufgeräumt und hochwertig wirkt.

## Dazu: „Was übe ich gerade?“ (Tom: „komplettes Tracking wie bisher und zusätzlich die Auswahlmöglichkeit, was ich gerade übe“; CSV-Export ausdrücklich gewünscht)
- Beim Schalter eine Auswahl „Was übe ich?“ (Chips, ≥ 44 px): Vorgaben z. B. Technik · Tonleitern/Pentatonik · Akkorde/Rhythmus · Improvisation · Songs ·
  Looper/Jammen · Gesang · Theorie · Frei; eigene Themen hinzufügen/umbenennen/ausblenden (Liste in localStorage). Auswahl ist freiwillig („ohne Thema“ zählt auch).
- Wird das Thema bei laufender Zeit gewechselt, endet der Abschnitt und ein neuer beginnt nahtlos (gleicher Zeitpunkt), damit die Zeit je Thema stimmt; in der
  Liste erscheinen die Abschnitte als eigene Einheiten. Die freie Notiz bleibt zusätzlich.
- Übersicht: Abschnitt „Woran geübt“ – Zeit je Thema (Balken mit Stunden und Anteil) für den gewählten Zeitraum, dazu Verlauf je Thema wählbar. Importierte
  Numbers-Einheiten haben kein Thema („ohne Thema“; ihre Notiz aus der Spalte „Übungen“ bleibt als Notiz erhalten).
- Thema und Dauer der letzten Einheiten nachträglich änderbar (Liste: antippen → Thema/Notiz/Dauer ändern, löschen mit Rückfrage).
- CSV-Export = vollständiges Protokoll im Numbers-Format der Vorlage: Kopfzeile `Datum und Uhrzeit;Start/Ende;Übungszeit;Übungen`, je Einheit eine „Start“-Zeile
  (`!!`) und eine „Ende“-Zeile mit Dauer (`1h 23m`), in „Übungen“ steht „Thema – Notiz“; `;`-getrennt, UTF-8 mit BOM, über Teilen-Menü/Download.
  Der Export muss sich mit dem eigenen Import wieder verlustfrei einlesen lassen (Test: Export → alles löschen → Import → gleiche Summen, Themen wieder erkannt).
