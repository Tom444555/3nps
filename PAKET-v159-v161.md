# Pakete v159–v161 (Auftrag von Tom, 26.11.2026 07:37: „Das passt erstmal so, mach fertig“)

Rahmen wie in `PAKETE-v149-v154.md` Abschnitt „Rahmen“ (Lesen, Bauen, Tests, Doku, Veröffentlichen, Abbruchregel) – verbindlich.
Ausgangsstand: v158 live. Reihenfolge fest: v159 → v160 → v161, jede Version einzeln bauen, testen, veröffentlichen (entwicklung + main),
UEBERGABE.md pflegen. Platz: `app/www/index.html` ist nur ~57 KB unter der 2,1-MB-Grenze – Neues in eigene, nachgeladene Dateien.
Toms spätere Zusatzwünsche stehen ganz unten unter „Nachträge“ (vor jedem Paket nachsehen).

## v159 – Pedal-Bedienung für „Tap“ und Tonleiter-Trainer
Tom nutzt das Fußpedal M-VAVE Chocolate (Tastatur-Modus). Bestand: `Pedal` in `app/looper.js` (Belegung je Taster: Tippen / Gedrückt halten /
Doppelt tippen, Aktionsliste `ACT_NAME`, Speicher `3nps-pedal-acts`), Tap-Tempo v150, Tonleiter-Trainer v158 (`tonleiter.js`, lädt erst beim Öffnen).
1. Neue wählbare Pedal-Aktion **„Tap (Tempo)“**: jeder Tritt wirkt wie ein Tipp auf den Knopf „Tap“ (gleiche Logik, gleiche Sperren wie der Knopf).
2. Neue wählbare Pedal-Aktionen für den **Tonleiter-Trainer**: mindestens „Trainer: Start / Stopp“ und „Trainer: Weiter“ (nächste Lage bzw.
   nächste Übung/Stufe – das, was in der Seite der „Weiter“-Schritt ist; vorher im Code nachsehen, was sinnvoll ist). Wirken nur, wenn die Seite
   „Tonleiter-Trainer“ offen ist; sonst tun sie nichts (kein Laden von tonleiter.js durch das Pedal, kein Fehler).
3. **Standard-Belegung bleibt unverändert** (Schalter statt Zwang): die neuen Aktionen sind nur in den Auswahllisten wählbar. Gespeicherte
   Belegungen von Toms Geräten müssen unverändert weiter funktionieren (unbekannte/alte Werte nicht verlieren).
4. Sinnvolle Bequemlichkeit, falls ohne Risiko machbar: Ist die Seite „Tonleiter-Trainer“ offen, steht in der Seite ein kurzer Hinweis, welche
   Pedal-Aktionen es gibt und wo man sie belegt. Kein Umbelegen von selbst.
5. Looper-Signalweg nicht anfassen; Pedal-Erkennung (Halten/Doppelt) nicht verändern. Englische Texte in `i18n-en2.js`.
Test `test/v159pedal.py`: Aktionen in den Listen, Tap per Tastendruck ändert das Tempo wie der Knopf, Trainer-Aktionen wirken nur bei offener
Seite, alte gespeicherte Belegung bleibt, Standard unverändert, keine Skriptfehler, alle vier Geräte-Profile.

## v160 – Looper-Zeit zählt in die Übezeit
Von Tom bestätigte Regel: **Gezählt wird nur, wenn der Schalter „Üben“ AUS ist und der Looper läuft – nie doppelt.**
- „Looper läuft“ = Wiedergabe oder Aufnahme läuft (auch Mitlaufen mit Schlagzeug/Drone im Looper – im Code prüfen, was „running“ sauber abbildet).
- Läuft der Looper und „Üben“ ist aus: eine Looper-Einheit beginnt; sie endet beim Stopp. Schaltet Tom währenddessen „Üben“ AN: Looper-Einheit
  endet in diesem Moment (ab da zählt nur der Schalter). Schaltet er „Üben“ AUS, während der Looper läuft: ab da beginnt eine Looper-Einheit.
- Kurze Stücke nicht als Kleinkram: Einheiten unter 60 s verwerfen; Pausen bis 2 min zwischen zwei Looper-Läufen zur selben Einheit
  zusammenfassen (Dauer = Summe der Laufzeiten, nicht die Pause). Werte als Konstanten, in der Doku nennen.
- Herkunft „Looper“ an der Einheit (Format `3nps-uebezeit` nur erweitern, siehe Verlauf v154/v157 und `PAKET-UEBEZEIT.md`); Thema wählbar wie
  bei anderen Einheiten (Vorgabe: ein Thema „Looper“ bzw. das zuletzt gewählte – im Bestand nachsehen, was passt), in Liste, Übersicht,
  „Woran geübt“, CSV-Export sichtbar/enthalten; Export → leer → Import ergibt dieselben Summen.
- **Schalter statt Zwang:** auf der Seite „Übezeit“ ein Schalter „Looper-Zeit mitzählen: An / Aus“. Vorgabe **An** (Tom hat es beauftragt).
- Absturz-/Neulade-sicher wie der Schalter „Üben“: keine Minute verlieren, keine doppelt; jede Änderung ein Schreibvorgang. App im Hintergrund /
  geschlossen bei laufendem Looper: Einheit endet beim letzten sicheren Zeitpunkt (nicht bis zum nächsten Öffnen weiterzählen).
- **Leistung:** nichts im Audio-Pfad; nur an Start/Stopp hängen und höchstens ein seltener Zwischenstand (z. B. alle 30–60 s). Kein Zeichnen.
- Hinweistext in der Karte „Übe-Verlauf“ („Looper-Spielen ohne Schalter wird nicht mitgezählt“) und Anleitung anpassen.
Test `test/v160looperzeit.py`: alle Übergänge oben (mit gestellter Uhr), nie Überlappung mit „Üben“-Einheiten, <60 s verworfen, Zusammenfassen,
Neuladen mitten im Lauf, Schalter Aus zählt nichts, Rundlauf Export/Import, v154uebezeit/v155uebersicht/v157aufteilen weiter grün.
Audio-nahe Stelle berührt (Start/Stopp-Haken) → auch `v119leistung` und `v100mem` laufen lassen.

## v161 – Songbook (Konzept von Tom am 26.11. freigegeben, Beispielbild: `test/entwurf/songbook-entwurf.py` erzeugt es aus dem Bau)
Eigene Seite **„Songbook“ unter „Lernen“** (eigener Chip + Kachel in der Übersicht; Code/Stil in `songbook.js`/`songbook.css`, laden erst beim
Öffnen, in die Offline-Liste von `sw.js`). Aufbau wie im Beispielbild:
- **Links Liste** der Stücke: Suche, „＋ Neues Stück“, je Zeile Titel + Tonart · Tempo; sortiert nach „zuletzt geübt“/zuletzt geladen; das
  gewählte Stück leuchtet (in „Altes iPad“/„Minimal“ ohne Schein). Hochkant/Telefon: Liste oben, Stück darunter bzw. Liste → Stück mit „‹ Zurück“.
- **Rechts das Stück:** Titel, Kacheln Tonart · BPM · Schlagzeug · „geübt“, „Akkorde & Text“ (freier Text, feste Schriftbreite, Akkordzeile über
  Textzeile; gut lesbar am Notenständer, Schriftgröße in 2–3 Stufen umschaltbar), Rig-Sound, Looper-Idee, Knöpfe „Bearbeiten“, „Tonart ändern ±“
  (transponiert die Akkordzeilen und die Tonart halbtonweise; Akkord-Erkennung vorsichtig: nur Zeilen, die ganz aus Akkorden bestehen),
  „Übezeit zu diesem Stück“.
- **„▶ Laden“** (ein Knopf): setzt Tempo, Tonart/Modus der Kopfleiste, Taktart und Schlagzeug-Stil, merkt den Rig-Sound vor bzw. zeigt ihn an und
  lädt die verknüpfte Looper-Idee. **Sicherheit:** Läuft der Looper oder liegt ein ungespeicherter Loop vor, erst fragen (nichts überschreiben
  ohne Rückfrage); gibt es eine verknüpfte Idee nicht mehr, sauber melden. Vorhandene Funktionen zum Setzen/Laden wiederverwenden (Ideen in
  IndexedDB `3nps-app` Store `ideas`, Rig-Bibliothek in `app/www/rig/`) – erst nachsehen, was sich sicher von außen aufrufen lässt; was nicht
  sicher geht, als Anzeige + Sprung-Knopf lösen („Im Rig öffnen“) und in der Rückmeldung nennen.
- **Bearbeiten:** Titel, Tonart, Tempo (auch „aktuelles Tempo übernehmen“), Taktart, Schlagzeug, Akkorde & Text, Rig-Sound (Auswahl aus der
  Rig-Bibliothek oder freier Text), Looper-Idee (Auswahl aus gespeicherten Ideen), Notiz; Löschen mit Rückfrage.
- **Übezeit:** Jedes Stück kann ein Thema der Übezeit sein (Themen-Speicher `3nps-uebezeit-themen` nur erweitern). „geübt“ = Summe der Einheiten
  mit diesem Thema. „Übezeit zu diesem Stück“ springt zur Seite „Übezeit“ mit diesem Thema; beim „Laden“ wird das Stück als „Was übe ich?“
  vorgeschlagen/gesetzt, ohne eine laufende Einheit zu verfälschen (laufende Einheit behält ihr Thema, außer Tom wählt um).
- **Speicher:** localStorage `3nps-songbook` (ein Schlüssel, jedes Schreiben atomar; keine neue IndexedDB-Version, kein neuer Store).
  Sicherung: „Songbook exportieren/importieren“ (JSON-Datei über Teilen/Dateiauswahl), Import fügt zusammen ohne Dubletten.
- Leerer Zustand freundlich („Noch kein Stück – ＋ Neues Stück“), kein Beispielinhalt mit echten Liedtexten (Urheberrecht): Tests/Bilder nur mit
  erfundenen Stücken wie im Beispielbild („Nachtfahrt“, „Blues in E (eigener)“, „Staub und Sterne“, „Übungsstück Dorisch“).
- Anleitung („?“-Thema, nachgeladen), ANLEITUNG.txt, englische Texte. Alle vier Geräte-Profile; iPad quer/hochkant, Telefon.
Test `test/v161songbook.py`: Anlegen/Bearbeiten/Löschen, Suche, Sortierung, Transponieren (inkl. Zeilen mit Text bleiben unverändert), Laden setzt
Tempo/Tonart/Schlagzeug, Rückfrage bei laufendem Looper, fehlende Idee, Übezeit-Summe je Stück, Export/Import-Rundlauf, Nachladen erst beim
Öffnen, Offline-Liste, Größe index.html, keine Skriptfehler.

## Rückmeldung je Version (max. 15 Zeilen)
Was ist für Tom anders und wo (Knopfnamen in „…“), Testergebnis, Grenzen (nur Chromium), 2–4 Bilder mit erfundenen Daten unter
`/home/claude/bilder/vNN-*.png` (Pfad nennen), Stand von main (Commit, Pages-Lauf „success“).

## Nachträge
### v162 – Gitarren aus druckwerk als Modellanzeige im Reiter „Rig“ (Tom, 26.11.2026 08:12: „Übernimm mal noch aus Druckwerk die Schecter, Strat und Gibson als Modellanzeige“)
Eigenes Paket NACH v161 (nicht in v159–v161 mischen). Bestand: Reiter „Rig“ (v146, `app/www/rig/`, three.js lokal, lädt erst beim Öffnen) zeigt
schon 3D-Gitarren: Strat aus druckwerk (alter Auftrag 2026-11-11_stratocaster), Schecter und Les Paul Studio als einfache eigene Modelle.
Gewünscht: die aktuellen, detailreichen druckwerk-Modelle als Anzeige übernehmen.
- Quelle: öffentliches Lager Tom444555/druckwerk (main): Schecter = `modelle/gitarre_rundum.py` + `gitarre_rundum_daten.json` (Projekte
  schecter190/schecter370, vier Farben grau/weinrot/schwarz/silber, gerundete Deckenkante), Strat = Stratocaster 190/240 mit Details
  (`gitarre_farben.py … --details 1`, cremeweiß, Ahornhals, 22 Bünde). Stand und Baubefehle: Block oben in druckwerk `UEBERGABE.md`.
- Für die Anzeige: Modell je Farbe als ein Netz exportieren (GLB oder das Format, das der Rig-Reiter schon lädt), Druck-Hilfen weglassen
  (Steckwirbel-Löcher, Saitenlöcher, Zapfen, Stützen), Netze vereinfachen (Ziel je Gitarre deutlich unter 1 MB, flüssig auf altem iPad;
  Profile „Altes iPad“/„Minimal“ wie bisher im Rig). Dateien nur unter `app/www/rig/`, nachgeladen, Offline-Liste `sw.js`; index.html wächst nicht.
- **Gibson / Les Paul:** In druckwerk gibt es dafür KEIN eigenes Modell – die Les-Paul-Dateien liegen im privaten Lager druckwerk-modelle und sind
  fremde Modelle (Lizenz ungeklärt) → dürfen NICHT in die öffentliche App. Deshalb: das eigene Les-Paul-Studio-Modell des Rig-Reiters behalten und
  nach derselben Machart wie Schecter/Strat verfeinern (gewölbte Decke, Binding, Humbucker, Regler, Brücke), ohne Schriftzug/Logo. Tom ist informiert.
- Keine Marken-Schriftzüge/Logos auf den Modellen; Namen im Rig wie bisher (vor App Store ohnehin zu prüfen, siehe UEBERGABE „Offen“).
- Test `test/v162modelle.py` (lädt erst beim Öffnen, drei Modelle sichtbar, Dateigrößen, Profile, keine Skriptfehler, v146rig weiter grün);
  Vorher/Nachher-Bilder je Gitarre.

### v163 – Seite „Mitsingen lernen“ unter „Lernen“ (Tom, 26.11.2026 09:34)
Toms Worte: „Schritt-für-Schritt-Anleitung zum Mitsingen auf einen Song – wie geht man das an, wie übt man was am besten; verschiedene Wege
recherchieren, Aufbau überlegen. Dann als Reiter in Lernen. Vielleicht die Möglichkeit, wenn man eine Musikdatei lädt, damit üben zu können.
Arbeite gründlich.“ Eigenes Paket NACH v162. Beispielbild (an Tom geschickt): `test/entwurf/mitsingen-entwurf.py`. Vor dem Bau im Chat nachsehen,
ob Tom am Konzept etwas geändert hat (steht dann hier darunter).

**Recherche (26.11., Gesangslehrer- und Gitarren-Quellen; Kern in eigenen Worten):** Fast alle Wege trennen die Schichten und setzen sie erst am
Ende zusammen: Text allein (lesen/sprechen) → Rhythmus (Text im Takt sprechen, klatschen) → Melodie ohne Text (summen, ein Vokal) → alles
zusammen; abschnittsweise, schwierige Stelle einzeln; nicht alles in einer Sitzung. Nachsingen nach Gehör: Zeile hören – nachsingen – anhängen;
Karaoke erst, wenn es mit Original sitzt. Tonart an die Stimme anpassen (Kapo/transponieren) statt sich zu quälen. Töne treffen lässt sich üben;
sich aufnehmen und anhören ist der wichtigste Abgleich, je Durchgang nur auf EINE Sache achten. Singen + Gitarre: Gitarrenpart erst
automatisieren, dann dazu summen, dann Text, Anschlag anfangs vereinfachen (nur Akkordwechsel), zuletzt mit Metronom/Drums.
Quellen: dummies.com (Steps for singing a new song; Recording yourself and singing along), 30daysinger.com (How to choose & work on a song;
Pitch matching), bonedo.de (Crashkurs Gesang – Richtiges Songerarbeiten), musical-u.com (Learn to sing in tune), guitarworld.com / musicradar.com /
stringkick.com (Singen und Gitarre spielen). Keine Texte daraus übernehmen – alles selbst formulieren.

**Bestand nutzen, nichts doppelt bauen:** „Song & Gesang“ hat schon Mitsingen (`singen.js`, `sing.js`: Datei laden, Text erkennen mit Whisper,
Wörter im Takt, „🎤 Karaoke“ über „Gesang trennen“/Spleeter), Stimmlage/Tonart-Empfehlung/Zieltöne im Songwriting, Mithören der Tonhöhe (YIN) im
Solo-Bereich, Zeitdehnung (Test `v96stretch`), Looper-Datei laden mit Takt/Tempo. Zuerst sichten, was davon von außen sicher aufrufbar ist. Von Tom
früher ABGELEHNT in der Mitsing-Ansicht: Akkordbalken, Pausenbalken, Vergrößern der aktuellen Zeile – nicht wieder einführen.

**Aufbau (wie im Beispielbild):** eigener Chip „Mitsingen lernen“ + Kachel; Code/Stil nachgeladen (`mitsingen.js/.css`), Offline-Liste.
- Links der **Fahrplan in 8 Schritten** mit Haken je Stück (Fortschritt je Stück gespeichert, localStorage `3nps-mitsingen`, ein Schlüssel):
  1 Song & Tonart (passt es zur Stimme?) · 2 Hören & gliedern (Abschnitte, Atemstellen) · 3 Text sprechen · 4 Text im Takt sprechen ·
  5 Melodie ohne Text (summen/„na“) Zeile für Zeile · 6 Mit Text mitsingen: Original → Original leiser → Karaoke · 7 Mit Gitarre: summen →
  sprechen → singen, Anschlag erst vereinfacht · 8 Aufnehmen & anhören, schwierige Stellen merken und zurück in die Schleife.
- **Drei Wege** (Umschalter): „Gründlich“ (alle 8), „Schnell“ (2 → 5 → 6 → 8, für Lieder, die man schon gut im Ohr hat), „Mit Gitarre“
  (Gitarre zuerst sicher, dann 3 → 4 → 7 → 8). Schritte lassen sich immer frei antippen – der Fahrplan führt, sperrt nicht.
- Rechts der **Schritt**: „So geht’s“ (2–3 Sätze), „Warum“, Richtzeit, „Tipps zu diesem Schritt“ (aufklappbar: typische Fehler, woran man merkt,
  dass es sitzt), „✓ Schritt geschafft“. Ohne geladene Datei funktioniert die Seite als reine Anleitung mit Checkliste (auch für eigene Stücke).
- **Üben mit Musikdatei** (wenn eine Datei geladen ist – dieselbe wie im Mitsingen/Looper, kein zweiter Ladeweg, wenn vermeidbar): Zeile/Abschnitt
  in **Schleife** (Grenzen aus dem erkannten Text bzw. von Hand setzen), „‹ Zeile“/„Zeile ›“, **Tempo** 50–100 % ohne Tonhöhenänderung,
  **Vorsingen – Pause – Nachsingen** (Zeile läuft, dann gleich lange Pause mit Klick zum Nachsingen), **Gesang im Lied laut ↔ leise ↔ Karaoke**
  (nur wenn „Gesang trennen“ gelaufen ist; sonst Knopf, der das anbietet – 79-MB-Modell nie ungefragt laden), **● Aufnehmen** und direkt
  anhören (Aufnahme nur im Speicher/als Idee, nichts verlässt das Gerät), „schwierige Stelle merken“ (Liste je Stück, Sprung zurück).
- **Tonart für die Stimme:** Transponieren der Datei in Halbtönen NUR, wenn es im Bestand eine brauchbare Tonhöhen-Verschiebung gibt; sonst in
  v163 als Empfehlung lösen („2 Halbtöne tiefer → Kapo/Griffe: …“ + vorhandene Tonart-Empfehlung nutzen) und als offenen Punkt melden.
- **Tonhöhen-Rückmeldung** (eigene Stimme über Mikro als Linie; Zielmelodie aus der getrennten Gesangsspur): als **Stufe 2 (v164)** vorsehen,
  nur bauen, wenn es sauber und ohne Leistungsverlust geht; in v163 höchstens „Ton halten/treffen“ mit dem vorhandenen Mithören für einen
  Vergleichston. Ehrlich melden, was nicht belastbar ist (Erkennung bei Gitarre im Raum, Kopfhörer nötig).
- **Verknüpfungen:** Stück aus dem Songbook wählbar (v161), Zeit zählt als Thema des Stücks bzw. „Gesang“ in die Übezeit (keine Doppelzählung –
  Regeln v154/v160), Pedal-Aktionen für „Zeile wiederholen“/„Zeile ›“ wenn einfach (v159-Muster).
- Regeln wie immer: Looper-Leistung unberührt, schweres erst bei geöffneter Seite, alle vier Geräte-Profile, keine echten Liedtexte in Tests/Bildern
  (erfundene Zeilen wie im Beispielbild), Mikrofon nur nach Antippen, Kopfhörer-Hinweis gegen Rückkopplung.
- Test `test/v163mitsingen.py` (Fahrplan/Haken je Stück, drei Wege, ohne Datei nutzbar, Schleife/Tempo/Vorsingen-Pause mit Testaudio, Karaoke nur
  nach Trennen, Aufnahme, Nachladen, Größe, Profile, keine Skriptfehler; v63singen/v81vox/v85singen/v124trennen weiter wie zuvor).
