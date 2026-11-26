# Paket v158 – Tonleiter-Trainer (Auftrag von Tom, 26.11.2026: „…und dann den Tonleitertrainer“)

Rahmen wie in `PAKETE-v149-v154.md` Abschnitt „Rahmen“. Tom hat am 25.11. folgendes Kurzkonzept bekommen und am 26.11. den Bau beauftragt:
„Geführtes Üben von Pentatonik, 3nps und Kirchentonleitern in allen Lagen mit Metronom, das das Tempo schrittweise steigert, und einem Fortschritt je
Tonleiter, der in die Übezeit mitzählt.“ Tom spielt Gitarre, beschäftigt sich mit Pentatonik und Kirchentonleitern, übt fast nur am iPad.

## Zuerst: Bestand sichten (nichts doppelt bauen)
Die App hat unter „Lernen“ schon viel: Griffbrett mit Tonart/Modus und Muster („52 Töne im Muster“), CAGED, Improvisation, Technik (3nps-Übungen?, Metronom,
Übungslog, „Heute üben“/Tagesübung), Training, Hör-Training, Spickzettel, Übezeit. Vor dem Bauen gezielt nachsehen (UEBERGABE Abschnitt 5, `grep`), was davon
Tonleitern/Lagen/Metronom/Tempo-Steigerung schon kann, und darauf AUFBAUEN: Griffbrett-Zeichnung, Tonleiter-/Lagen-Berechnung, Metronom-Klick und Übungslog
wiederverwenden statt neu schreiben. In der Rückmeldung nennen, was wiederverwendet wurde und was es vorher schon gab.

## Was der Trainer können soll (eine Seite „Tonleiter-Trainer“ unter „Lernen“, eigener Chip; Regel: Neues auf eigene Reiter)
1. **Auswahl**: Tonleiter-Familie (Pentatonik Moll/Dur, Blues, Dur/Moll und die Kirchentonleitern Ionisch … Lokrisch als 3nps), Grundton, Lage
   (Pentatonik 5 Lagen, 3nps 7 Lagen) oder „alle Lagen nacheinander“. Vorgabe: übernimmt Tonart/Modus der Kopfleiste („G Ionisch“), änderbar.
2. **Anzeige**: Griffbrett mit dem Muster der aktuellen Lage (Grundtöne hervorgehoben, Fingersatz/Reihenfolge erkennbar), groß genug fürs iPad auf dem
   Notenständer; bei 390 px lesbar (waagrecht scrollbar ist ok).
3. **Übungsformen**: auf/ab, dazu mindestens Sequenz in 3er- und 4er-Gruppen und Terzen; die aktuelle Übung wird als Tonfolge angezeigt und beim Mitlaufen
   Ton für Ton auf dem Griffbrett markiert (im Profil „Altes iPad“ ohne Übergänge, in „Minimal“ nur Metronom + Text, keine bewegte Markierung).
4. **Metronom mit Tempo-Treppe**: Start-BPM, Ziel-BPM, Schritt (+2/+4/+5/+8 BPM), Steigerung nach N Durchgängen automatisch ODER per Knopf „geschafft → schneller“
   / „zu schnell → langsamer“; Notenwert (Viertel, Achtel, Triolen, Sechzehntel) pro Klick. Vorzähler. Start/Stopp groß (≥ 44 px), mit Fußpedal bedienbar,
   falls die vorhandene Pedal-Belegung eine passende Aktion hat (sonst weglassen und melden).
5. **Fortschritt**: je Tonleiter × Lage × Übungsform das höchste sauber geschaffte Tempo (das der Nutzer mit „geschafft“ bestätigt hat) mit Datum; Übersicht als
   Raster (Lagen × Übungsformen, Farbe = Tempo relativ zum Ziel) und „Verlauf“ des Tempos im Börsenkurs-Stil (v152/v155 wiederverwenden). Vorschlag
   „Als Nächstes üben“ (schwächste Lage zuerst).
6. **Übezeit**: Jeder Trainer-Lauf ab 5 s wird wie eine Metronom-Einheit ins vorhandene Übungslog geschrieben (mit Tonleiter, Lage, BPM) – das zählt im Verlauf
   bereits mit und wird bei laufendem Schalter „Üben“ nicht doppelt gezählt (so in v154 gelöst; im Test belegen). Läuft der Schalter „Üben“ nicht, einen
   dezenten Hinweis mit Knopf „Üben einschalten“ zeigen, nichts automatisch einschalten. Läuft er, das Thema nicht ungefragt ändern.
## Technik
- Code und Stil erst beim Öffnen der Seite nachladen (wie `uebezeit-ansicht.js`); `index.html` liegt knapp unter der 2,1-MB-Grenze aus v145start. Offline
  vorab gespeichert (sw.js CORE).
- Metronom: den vorhandenen Klick/Takt-Motor benutzen, den Signalweg des Loopers nicht verändern; läuft der Looper, gilt dessen Tempo-Sperre wie bei „−/+“.
  Timing des Klicks über die Audio-Uhr, nicht über setTimeout allein. Wird Audio-Code angefasst: zusätzlich v118signal, v120power, v119leistung, v100mem.
- Speicher: localStorage `3nps-…` (kompakt, nur ergänzen), in „Alles sichern“ enthalten. EN-Texte in `app/i18n-en2.js`, Anleitung-Thema, ANLEITUNG-Abschnitt.
- Test `test/v158tonleiter.py`: Tonfolgen gegen selbst nachgerechnete Muster (z. B. A-Moll-Pentatonik Lage 1, G-Dur 3nps Lage 1, Dorisch), Lagenwechsel,
  Übungsformen, Tempo-Treppe (Zeit über gefälschte Uhr), „geschafft“ speichert Bestwert, Raster/Verlauf, Übungslog-Eintrag ohne Doppelzählung, Profile,
  drei Größen, EN, keine Skriptfehler; Klick-Abstände mit OfflineAudioContext oder Zeitmarken prüfen (±5 ms).
- Regressionen laut Rahmen inkl. v149start (Start darf nicht langsamer werden), v145start, v137lernen/v136reiter (neuer Chip), v154/v155/v157-Tests.
- Bilder nach /tmp/shots/v158_*.png: Seite oben (Auswahl + Griffbrett + Metronom) und Fortschritt, 390×844 und 1366×1024, Optik ios und nordic – selbst kritisch
  ansehen und nachbessern, bis es aufgeräumt und im Stil der Seite „Übezeit“ wirkt.
- **Platz in index.html:** Nach v157 ist `app/www/index.html` 2 096 994 Byte groß, die Grenze aus `v145start` liegt bei 2,1 MB (~3 KB Luft). Die Grenze NICHT anheben.
  Der Trainer selbst gehört in nachgeladene Dateien; für Chip, Kachel und Einhängepunkt in `index.html` vorher Platz schaffen, indem ein selten gebrauchter,
  klar abgegrenzter Block ebenfalls erst bei Bedarf geladen wird (Kandidaten prüfen und den risikoärmsten nehmen; Looper-Kern und alles Audio-Nahe bleiben
  in index.html). Größe vorher/nachher nennen; Ziel: danach mindestens 20 KB Luft.
- Stand bei Auftragserteilung: v157 live (Knopf „Üben“ mittig/leuchtend, „Zeit aufteilen“). Regressionsliste um `v157aufteilen` ergänzen.
