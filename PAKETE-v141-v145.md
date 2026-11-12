# Rahmen für die Pakete v141–v145 (3nps Looper) – gilt für jedes Paket

## Umgebung
- Quellen `/home/claude/3nps-src` (entwicklung), Veröffentlichung `/home/claude/3nps-main` (main). `UEBERGABE.md`/`ARBEITSWEISE.md` nur abschnittsweise lesen.
- **Prüfbericht mit allen Befunden, Messwerten, Ursachen (Datei/Funktion): `/tmp/claude-0/pruef/BERICHT.md`** – zuerst den zum Paket gehörenden Teil lesen. Messskripte der Prüfung liegen in `/tmp/claude-0/pruef/` (wiederverwenden für Vorher/Nachher), Bilder in `/tmp/claude-0/pruef/shots/`.
- Testserver `sh test/srv.sh` (Port 8765; vor jedem Lauf neu aufrufen). Bauen `python3 app/build.py && python3 app-studio/build.py`. Playwright-Tests NACHEINANDER. `test/nav.py` für die Navigation. Pages-Nachbau bei Bedarf `sh test/pages.sh`.
- Netz: nur GitHub. Push-Rechte vorhanden.

## Feste Regeln
- Looper-Leistung und Stabilität zuerst; Klang/Timing darf sich nicht ändern; nichts darf beim Mitlaufen springen (feste Höhen).
- Nur das Nötige ändern, kleinste Diffs. IndexedDB/localStorage nur erweitern (v24-kompatibel). CSP lokal, keine fremden Quellen.
- Neue Looper-Texte auch englisch in `app/i18n-en2.js` (v59lang/v60lang prüfen das).
- Nie `git add -f app`; Dateien einzeln hinzufügen.

## Ablauf je Paket
1. `git pull --rebase origin entwicklung`. Vorher-Messung bzw. Vorher-Bilder festhalten.
2. Umsetzen. Nachher messen/ansehen (Screenshots 1366×1024, 820×1180, 390×844 selbst mit Read prüfen; Optiken nordic, precise-dark, ios).
3. Version +1: `app/head_app.html`, `app/www/sw.js`, `test/v31export.py`, `test/s1studio.py`, `test/v107round.py`. Bauen.
4. Neuer Test `test/vNNname.py` (inkl. „keine Skriptfehler“). Regressionen nacheinander: v102ideas v59lang v60lang v31export s1studio v107round v113hilfe v116looperA v117looperB v118signal v120power v135aufnahme v136reiter v137lernen v138jammen v140optik v21tabs v25jam; bei Audio-/Zeichen-Änderungen zusätzlich v34perf v35 v63singen v81vox v85singen s1mem v100mem v124trennen; bei Studio-Änderungen s2studio s3studio v121studioC v122studioD. (`v119leistung` „Schätzung passt zur Messung“ weicht bekannt ab.) Alte Tests, die nur wegen bewusst geänderter Oberfläche rot werden, anpassen – echte Fehler beheben.
5. Doku: `app/www/ANLEITUNG.txt` neuer Abschnitt (zuletzt 123), `UEBERGABE.md` (Kopf „Stand“, Verlaufszeile, Tests, „Als Nächstes“), ggf. Thema in `app/hilfe-daten.js` (+ `test/v113hilfe.py`).
6. Commit auf entwicklung (deutsch), am Ende die Zeilen:
   Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01MK1eRhUBz3gHgPwNk9oMB8
   Push (bei rejected: pull --rebase, fremde Änderung ansehen, neu bauen).
7. main: `cd /home/claude/3nps-main && git pull --rebase`, nur geänderte/neue Dateien aus `app/www/` kopieren (nicht `asr/`), committen, pushen, warten bis `gh run list -R Tom444555/3nps -b main -L 1 --json headSha,status,conclusion` den eigenen Commit mit success zeigt.
8. Rückmeldung max. 15 Zeilen: Version, was sich für Tom ändert (Knopfnamen in „…“), Vorher/Nachher-Zahlen, Tests x/y, Grenzen/Offenes.

## Die Pakete
### v141 – Looper zeichnet sparsam
- Pegelanzeigen in `looper.js › tick()`: kein erzwungenes Layout mehr pro Bild (Maße einmal/bei Größenänderung merken, nur schreiben wenn sich der Wert ändert, transform/Canvas statt Layout-Eigenschaften).
- `drawEditor()`/`drawOverview()`: Wellenform nur bei Änderung zeichnen (zwischengespeichert), der Abspielstrich als eigene, billige Ebene.
- Übrige vermeidbare DOM-Änderungen im Takt (Bericht: 333 Änderungen/s, 85 Layouts/s) so weit senken, wie es ohne Risiko geht.
- Ziel: gedrosselt 4× deutlich weniger lange Aufgaben und Bilder > 50 ms; ungedrosselt Script-ms/s und Layouts/s klar runter. Aussehen unverändert (Bildvergleich vorher/nachher).

### v142 – Drone, Dauerläufer und Geräte-Schalter „Altes iPad / Neues iPad“
- Drone: Hall nur einmal berechnen/zwischenspeichern (`drones.js › render()`/`ensureReverb`), keine lange Aufgabe alle ~80 s; Klang gleich.
- Dauerläufer ohne Wiedergabe abstellen: CAGED (8 Layouts/s), Improvisation (84 Änderungen/s), Mitsingen-Bildschleife im Stillstand; Schleifen nur bei sichtbarem Reiter.
- **Neu, Wunsch von Tom:** In „Leistung ▾“ eine klare Umschaltung des Geräte-Profils, z. B. Segment „Gerät: Automatisch · Neues iPad · Altes iPad“ (gespeichert in localStorage `3nps-…`, v24 stört es nicht). Zuerst ansehen, was die vorhandenen Schalter „Sparsam“, „Stabil – großer Audio-Puffer“ und „Live“ schon tun, und darauf aufbauen statt doppeln (das Profil setzt/umfasst sie sinnvoll).
  „Altes iPad“ = ganz alte Geräte sollen flüssig laufen: Anzeigen mit niedriger Bildrate (z. B. 15–20/s, Pegel grob), keine Schatten/Glühen/Texturen/Verläufe/Masken (flache Flächen per Klasse am `<html>`, gilt für alle Optiken), keine Übergangs-Animationen, großer Audio-Puffer/`latencyHint: 'playback'`, teure Extras nur auf Wunsch (Live-Analyse, Akkord-Mitlauf, Signalweg-Messpunkte, Hall-Sends, Drone immer vorgerendert), Wellenform in geringerer Auflösung, Reiter erst beim Öffnen bauen. Der Klang der Spuren selbst bleibt unverändert.
  „Neues iPad“ = volle Darstellung wie bisher. „Automatisch“ = vorsichtige Erkennung (z. B. `hardwareConcurrency`, `deviceMemory`, kurze Startmessung der Bildzeiten) mit Anzeige, was gewählt wurde; Vorgabe für bestehende Nutzer darf das bisherige Verhalten nicht verschlechtern.
  Messen: Looper-Mitlauf mit 4× und 6× CPU-Drosselung im Profil „Altes iPad“ gegen „Neues iPad“.

### v143 – Looper-Bedienung
- Touch-Ziele im Looper ≥ 44 px (Kopf-Knöpfe „App-Optik ▾“/„Leistung ▾“/„Live“, „▾“ am Amp, Spurknöpfe …), ohne dass das Layout höher springt als nötig.
- Aufnahme/Transport je Spur auf iPad quer mit geladenen Spuren ohne Scrollen erreichbar (z. B. Block „Was passt“ kompakter/einklappbar gemerkt, Spurkopf straffen, Aufnahme-Leiste nach oben oder klebend) – auf dem Telefon ist mindestens die erste Spur samt Aufnahme-Knopf schnell erreichbar. Lösung wählen, die am wenigsten umwirft; Tom mag es clean.
- Tonart-Schreibweise einheitlich (eine gemeinsame Funktion: gleiche Vorzeichenwahl ♯/♭ und gleiche Form „A♭-Dur“ in Spurkopf, Improvisation, Kopfzeile, Jammen); die Kopfzeile soll nicht einer anderen Tonart widersprechen, ohne dass klar ist, worauf sie sich bezieht.

### v144 – Feinschliff Design
- Reste in den Optiken „Präzision Nacht“ und „iOS“ (aktiver Knopf „Blitz: jeder Takt“ unlesbar, orange Sonderknöpfe, alles Weitere aus dem Bericht).
- Schriftgrößen- und Radius-Stufen im Looper auf wenige feste Stufen zusammenführen (per CSS-Variablen), klarere Überschriften-Hierarchie, einheitlicher Aktiv-Stil über die drei Navigationsebenen.
- „Mitsingen“ ohne Lied: ordentlicher Leerzustand (Hinweis groß und mittig, Knopf zum Laden).
- Englische Reste in deutschen Texten (z. B. „Power Chord Theory“, „Ear Candy“) – nur wo es kein Eigenname/Kurstitel ist.

### v145 – Schlanker Start und Studio
- Schriften der Optiken (350 KB Base64) und Englisch-Wörterbuch (172 KB) nur laden, wenn gebraucht (eigene Dateien, in `sw.js` gecacht, offline weiter nutzbar; kein Aufblitzen falscher Schrift bei der gewählten Optik).
- Lernmodule/Hilfe-Daten erst beim Öffnen aufbauen, soweit ohne Risiko.
- `sw.js`: Hintergrundbilder nur der gewählten Optik vorab laden, übrige bei Wahl (offline trotzdem sicher: beim Umschalten laden + cachen; große Bilder ggf. verlustarm verkleinern).
- Studio: Ansichtsleiste auf dem Telefon ohne Überlauf; Benennung/Erscheinung an den Looper annähern, soweit klein machbar (kein Umbau).
