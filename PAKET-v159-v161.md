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
- **Verknüpfungen:** Stück aus dem Songbook wählbar (v161), **Übezeit bleibt getrennt (Tom 26.11. 09:43: „den Übetracker separat lassen, nicht dass die Zeit gedoppelt wird“):**
  die Seite schreibt SELBST KEINE Zeit in `3nps-uebezeit` – gezählt wird nur wie bisher über den Schalter „Üben“ (bzw. Looper-Zeit v160, falls
  die Datei über den Looper läuft; eigene Wiedergabe der Seite darf keine Looper-Einheit auslösen, wenn „Üben“ an ist – nie doppelt). Keine
  eigene Zeitanzeige wie „Heute: 18 min an diesem Stück“ aus einem zweiten Zähler; höchstens die Summe aus der Übezeit ANZEIGEN (nur lesen)
  und ein Hinweis/Knopf „Üben einschalten“, Pedal-Aktionen für „Zeile wiederholen“/„Zeile ›“ wenn einfach (v159-Muster).
- Regeln wie immer: Looper-Leistung unberührt, schweres erst bei geöffneter Seite, alle vier Geräte-Profile, keine echten Liedtexte in Tests/Bildern
  (erfundene Zeilen wie im Beispielbild), Mikrofon nur nach Antippen, Kopfhörer-Hinweis gegen Rückkopplung.
- Test `test/v163mitsingen.py` (Fahrplan/Haken je Stück, drei Wege, ohne Datei nutzbar, Schleife/Tempo/Vorsingen-Pause mit Testaudio, Karaoke nur
  nach Trennen, Aufnahme, Nachladen, Größe, Profile, keine Skriptfehler; v63singen/v81vox/v85singen/v124trennen weiter wie zuvor).

**Freigabe:** Tom am 26.11.2026 09:43: „Mach das genauso“ – v163 wie oben bauen (nach v162), Übezeit getrennt lassen (siehe „Verknüpfungen“).

### v164 – Text-Werkstatt: eigene Songtexte prüfen, Textvorgabe per Prompt, Akkordvorgabe nach Stimmung (Tom, 26.11.2026 10:48)
Toms Worte: „Noch eine Möglichkeit zur eigenen Texterstellung: man gibt einen Text ein und das Programm schaut, ob es sich reimt oder wie man es
besser formulieren könnte. Ein Promptfenster zur Texterstellung, dass man schon eine Textvorgabe bekommt und diese dann nur noch anpassen braucht,
plus die Akkordvorgabe, wenn ich eingebe: traurig mit Spannungsabfall danach im Refrain usw.“ Eigenes Paket NACH v163. (Die Tonhöhen-Linie aus
v163 „Stufe 2“ rückt dadurch auf v165.) Konzept an Tom geschickt am 26.11. 10:50 – vor dem Bau im Chat/hier nachsehen, ob er etwas geändert hat.

**Grenze, ehrlich:** Die App hat keinen Server und keine KI (CSP ohne fremde Quellen, keine Datenerhebung – bleibt so). Frei formulierte
Textvorgaben und „besser formulieren“ auf KI-Niveau gehen deshalb NICHT in der App selbst. Lösung in zwei Teilen:
1. **In der App, offline (Regeln, kein Raten):**
   - **Reim-Prüfung:** Reimschema je Abschnitt (AABB/ABAB/…), reiner/unreiner/kein Reim je Zeilenpaar farbig, Silben je Zeile und Abweichung
     zwischen Zeilen, die zusammengehören, Betonung grob; Wiederholungen, Füllwörter, sehr lange Zeilen als Hinweise. Bestand prüfen und
     erweitern: Songwriting › „Text“ kann schon Silben und Reimschema (`[Am]`-Marken) – NICHT doppelt bauen, dort aufsetzen.
   - **Reimwörter finden:** zu einem Wort Vorschläge (reine und unreine Reime) aus einer deutschen Wortliste mit freier Lizenz, nach Endung/Klang
     sortiert; Liste nur bei Bedarf nachladen (Größe messen, Ziel wenige MB, Lizenzdatei). Englisch nur, wenn günstig machbar – sonst melden.
   - **Akkordvorgabe nach Stimmung:** Eingabe in Worten oder Knöpfen je Abschnitt (z. B. Strophe „traurig“, Refrain „Spannung fällt ab/löst sich“,
     „hoffnungsvoll“, „düster“, „treibend“) → 2–3 Akkordfolgen je Abschnitt in der gewählten Tonart, mit kurzer Begründung (Moll/Dur, Dominante =
     Spannung, Auflösung auf die Tonika, Trugschluss, Subdominante = Öffnen), anhörbar über die vorhandene Wiedergabe, „Übernehmen“ in den Song /
     ins Songbook-Stück. Regelwerk als Datentabelle (Stimmung → Stufenfolgen), deterministisch, in der Doku erklärt. Vorhandenes nutzen:
     Quintenzirkel, „Song prüfen“ + Varianten, Akkorde im Songwriting.
2. **Textvorgabe und Formulierungshilfe über Claude (Prompt-Fenster):** Felder Thema, Stimmung, Sprache, Perspektive, Reimschema, Silben je Zeile
   (aus dem vorhandenen Song/Takt), Abschnitte, eigene Zeilen als Ausgangstext → die App baut daraus einen fertigen Prompt („Kopieren“ / Teilen);
   Tom fügt ihn in Claude ein und holt das Ergebnis über „Einfügen“ zurück – mit Vorschau, als Version (nichts wird überschrieben). Dafür den
   vorhandenen Weg „Mit Claude weiterarbeiten“ (Song-Code hin und zurück, Vorschau, als Version) ERWEITERN statt neu bauen. Gleicher Weg für
   „Diese Zeile besser formulieren“ (markierte Zeile + Reim/Silben-Vorgabe → Prompt). Kein Netzabruf aus der App.
**Ort:** bei „Song & Gesang“ › Songwriting › „Text“ als eigene Karte/Ansicht „Text-Werkstatt“ (dort liegt der Text schon); falls Tom sie unter
„Lernen“ will, als Chip dorthin – vor dem Bau klären, wenn er sich dazu äußert, sonst Songwriting. Code nachgeladen, Offline-Liste.
Regeln wie immer (Leistung, Profile, kleinste Diffs, keine echten Liedtexte in Tests/Bildern – erfundene Zeilen). Test `test/v164text.py`
(Reimschema-Fälle deutsch inkl. unreiner Reime und Umlaute, Silbenzählung, Reimwort-Suche, Stimmung → Akkordfolgen in mehreren Tonarten, Prompt
enthält alle Felder, Einfügen mit Vorschau/Version, Nachladen, Größe, keine Skriptfehler; bestehende Text-/Songwriting-Tests weiter grün).
**Freigabe v164:** Tom am 26.11.2026 10:52: „Ok passt“ – v164 wie oben bauen (Ort: Songwriting › „Text“, Weg über Claude ist in Ordnung).
**Recherche v164 (26.11.2026 11 Uhr, Wortliste und Akkorde):**
- **Wortliste mit Aussprache – Wahl: „German MFA dictionary v3.0.0“** (Montreal Forced Aligner, McAuliffe & Sonderegger 2024), **CC BY 4.0**,
  rund 143.000 Wörter mit Lautschrift (MFA-Lautsatz), Datei: raw.githubusercontent.com/MontrealCorpusTools/mfa-models/main/dictionary/german/mfa/
  „German MFA dictionary v3_0_0.dict“ (Doku: mfa-models.readthedocs.io). Vorteil: Reime nach KLANG statt nach Schreibung (Reimteil = ab letztem
  betonten Vokal bis Ende; rein = gleich, unrein = Vokal gleich/ähnlich, Endkonsonant ähnlich, z. B. ü/i, ö/e, ei/eu). Vorgehen beim Bau:
  einmal im Chat aufbereiten (Skript ins Repo `test/` bzw. `app/werkzeug/`), nach Reimteil gruppieren, auf die häufigsten Wörter kürzen,
  kompakt als JSON/Text (Ziel ≤ 2–3 MB, gzip-freundlich), Lizenzdatei + Nennung in der Anleitung. Für Wörter, die fehlen: Regel-Rückfall
  nach Schreibung (Endung ab letztem Vokal, wie es einfache Reimhelfer machen).
- **Nicht nehmen:** Wiktionary (Reimseiten „Reim:Deutsch:-…“ und Dumps sind CC BY-SA → Weitergabepflicht, nicht in unserer Lizenzliste);
  DeReWo (CC BY-NC, nichtkommerziell → stört App Store); DWDS-Listen (CC BY-ND); npm „reimemonster“ (keine Lizenz angegeben, Wortlisten
  unklarer Herkunft). Zum Kürzen nach Häufigkeit erlaubt: Leipzig Corpora Collection (CC BY) – Lizenz beim Abruf nochmal prüfen.
- **Englisch:** CMU Pronouncing Dictionary (BSD-artig, frei) wäre günstig – nur, wenn Platz bleibt; sonst Tom melden.
- **Akkordvorgabe:** keine fremde Tabelle übernehmen, eigene Datentabelle aus Harmonielehre (Fakten, frei): traurig = Molltonika/vi-Start
  (i–VI–III–VII, vi–IV–I–V, i–iv–V), Spannung = Dominante/V oder v→V (harmonisch Moll), Spannungsabfall/Lösen = V→I bzw. iv→i, Trugschluss
  V→vi als „gebrochene“ Lösung, hoffnungsvoll = Wechsel Moll-Strophe → Dur-Refrain (VI/III/VII), düster = i–bVI–bVII bzw. Halbtonschritte im
  Bass abwärts, treibend = kurze Zweierwechsel (I–bVII, i–bVII), unruhig = I–vi–ii–V ohne Ankommen. Grundsatz in die Doku: Akkorde geben nur
  die Richtung, Tempo, Melodie und Text entscheiden mit.
**Nachtrag v164 + neues Paket v167 (Tom, 26.11.2026 11:01: „Passt mach das so“):**
- **v164 zusätzlich – Text-Baukasten (ohne KI, alle Geräte, offline):** Datentabelle mit Wortfeldern und Zeilenbausteinen je Thema/Stimmung
  (z. B. Abschied, Aufbruch, Nacht, Heimweg, Wut, Hoffnung – alles selbst formuliert), Generator setzt daraus Zeilen nach Reimschema und
  Silbenzahl (Reimwörter aus der MFA-Liste); jedes Wort antippen → Alternativen aus Wortfeld/Reimliste. Ergebnis als Startgerüst mit Vorschau,
  „Übernehmen“ als Version. Ehrlich in der Doku: Baukasten-Entwurf, kein fertiger Text.
- **v167 – Schalter „Lokales Modell“ (eigenes Paket NACH v166):** Text-Werkstatt schickt den fertigen Prompt (gleicher Prompt wie zum Kopieren)
  an ein lokales Modell auf Toms Mac über die OpenAI-kompatible Schnittstelle von LM Studio (Standard http://localhost:1234/v1, Adresse und
  Modellname einstellbar, z. B. Qwen aus dem Offline-Paket), Antwort zurück mit Vorschau, als Version. Standard AUS; Kopieren/Einfügen bleibt
  Rückfall. Ausnahme von der Regel „keine KI in der App“ von Tom freigegeben, aber NUR lokal (localhost bzw. Adresse im eigenen WLAN), nie ein
  fremder Dienst; CSP nur dafür und nur bei eingeschaltetem Schalter erweitern (oder Ausnahme connect-src auf localhost), keine Daten sonst wohin.
  Zu prüfen: Safari/Chrome auf dem Mac von https-Seite → http://localhost (gemischte Inhalte, CORS in LM Studio einschalten); falls Safari blockt:
  App am Mac aus lokalem Ordner starten (Anleitung). iPad → Mac im WLAN nur als Option mit Hinweis. Anleitung in ANLEITUNG.txt + Hilfe:
  LM Studio einrichten, Server starten, CORS an. Test `test/v167lokal.py` mit Ersatz-Server (Antwort im OpenAI-Format), Fehlerfälle (kein
  Server, Zeitüberschreitung, leere Antwort) ohne Absturz, Schalter aus = keinerlei Netzabruf.
- Weg über GitHub (Online-Modell mit Schlüssel) verworfen.

### v165 – Seite „Songtext schreiben“: Leitfaden + Schritt-für-Schritt-Workflow + Ideen-Notizbuch (Tom, 26.11.2026 10:52)
Toms Worte: „Überlege, wie und was man zum Thema Text/Liederstellung noch brauchen könnte, vielleicht noch ein grundsätzlicher Leitfaden dafür und
ein Schritt-für-Schritt-Workflow.“ Eigenes Paket NACH v164 (nutzt dessen Werkzeuge). Die Tonhöhen-Linie (Mitsingen Stufe 2) rückt auf v166.
Konzept an Tom geschickt am 26.11. 10:55 – vor dem Bau nachsehen, ob er etwas geändert/gestrichen hat.
**Aufbau:** eigener Chip „Songtext schreiben“ unter „Lernen“ (gleiches Muster und gleiche Bausteine wie „Mitsingen lernen“ v163: links Fahrplan
mit Haken je Song, rechts der Schritt mit „So geht’s“, „Warum“, „Tipps“, Knopf zum passenden Werkzeug). Code nachgeladen; Fortschritt je Song in
einem localStorage-Schlüssel; Übezeit bleibt getrennt (nichts selbst zählen).
- **Leitfaden (Grundlagen, kurz, eigene Formulierungen, je Thema ein erfundenes Mini-Beispiel):** Aufbau eines Songs und Aufgabe jedes Teils
  (Strophe erzählt, Pre-Chorus hebt an, Refrain = Kernaussage/Hook, Bridge = Wendung); eine Kernaussage je Song; Titel und Hook; zeigen statt
  behaupten (Bilder, Sinne, konkrete Dinge); Perspektive und Zeitform durchhalten; Reimarten und wann unreine Reime besser klingen; Silben und
  Betonung passend zum Takt (betonte Silbe auf betonten Schlag); Kontrast Strophe ↔ Refrain (Länge, Tonhöhe, Dichte); Wiederholung gezielt;
  kürzen; Stimmung ↔ Tonart/Akkorde (Verweis auf die Akkordvorgabe v164).
- **Workflow (Schritte, frei anspringbar):** 1 Idee & Kernsatz (ein Satz: worum geht es?) · 2 Titel/Hook · 3 Stoff sammeln (Wortfeld, Bilder,
  Erinnerungen) · 4 Aufbau festlegen (Vorlagen: Strophe-Refrain, mit Pre-Chorus, mit Bridge, 12-Takt-Blues AAB) · 5 Refrain zuerst schreiben ·
  6 Strophen (jede bringt etwas Neues) · 7 Bridge/Wendung · 8 Stimmung & Akkorde je Abschnitt (→ Akkordvorgabe v164) · 9 Text auf den Takt legen
  und zur Begleitung probesingen (→ Looper/Song, Aufnahme) · 10 Überarbeiten: Reim-Prüfung, laut lesen, kürzen, schwache Zeilen ersetzen
  (→ Text-Werkstatt, Prompt-Fenster v164) · 11 Fertig: Leadsheet-PDF, ins Songbook, „Mitsingen lernen“.
- **Was man noch braucht (in v165 mitbauen, klein halten):** **Ideen-Notizbuch** (Zeilen, Titel, Bilder schnell notieren, Schlagworte, später in
  einen Song ziehen); **Wortfeld-Sammler** zu einem Thema (eigene Liste + Reimwörter aus v164); **Aufbau-Vorlagen** (legt die Abschnitte mit
  Zeilenzahl/Reimschema an); **Checkliste „Ist der Song fertig?“** (Kernaussage klar, Hook im Refrain, jede Strophe neu, singbar, nichts doppelt);
  **Schreibimpulse** (Würfel: Thema × Perspektive × Bild, erfundene Listen). Vorhandenes nutzen statt doppeln: Songwriting (Teile, Ablauf, Text,
  Versionen, Leadsheet-PDF, „Mit Claude weiterarbeiten“), Looper-Ideen für Melodie-Schnipsel, Songbook v161.
- **Als spätere Ideen nur notieren (nicht in v165):** Betonungs-Check Wort gegen Schlag; Melodie-Skizze summen → Töne als Linie; Text in
  zwei Sprachen nebeneinander.
- Regeln: keine echten Liedtexte/-titel als Beispiele (Urheberrecht) – nur erfundene; Leitfaden-Texte selbst formulieren; alle vier Profile;
  englische Texte. Test `test/v165songtext.py` (Fahrplan/Haken je Song, Vorlagen legen Abschnitte korrekt an, Notizbuch speichern/ziehen/löschen,
  Export im Songbook-/Song-Export enthalten oder eigener Export, Nachladen, Größe, keine Skriptfehler).
**Freigabe v165:** Tom am 26.11.2026 10:54: „Bau es genauso“ – v165 wie oben bauen (nach v164), nichts gestrichen.
