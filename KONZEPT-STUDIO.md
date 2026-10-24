# Konzept: Loopsmiths Studio – eigene App neben dem Looper (Stand 24.10.2026, Looper v102) – wartet auf Toms OK

## Ziel

Ein Tonstudio für das iPad, das Ideen, Loops, Backing Tracks und Songs aus dem Looper **ohne Export** übernimmt,
zu einem fertigen Stück arrangiert, mischt, mastert und exportiert. **Der Looper wird dadurch nicht langsamer** –
das Studio ist eine eigene Web-App mit eigenem Symbol.

## Grundregeln (Leistung zuerst)

1. **Getrennte App** unter `https://tom444555.github.io/3nps/studio/` (eigener Ordner `studio/` im Branch `main`,
   eigenes `manifest`, eigener Service Worker-Bereich). Der Looper lädt keine Zeile Studio-Code.
2. **Gemeinsamer Speicher, nur lesen:** gleiche Adresse → gleiche IndexedDB `3nps-app`. Das Studio **liest** `ideas`
   (mit Ablage `cat`: idee/loop/backing/team) und Lieder (`kind:'lied'`), schreibt aber **nie** in Looper-Einträge.
   Eigene Projekte in einer **neuen Datenbank** `3nps-studio` (darf eigene Stores haben, berührt v24/Looper nicht).
3. **Nur eine App gleichzeitig:** Wechsel über Knöpfe „Im Studio öffnen“ / „Im Looper öffnen“ (Seitenwechsel,
   die andere App wird dabei geschlossen) – sonst teilen sich beide den Arbeitsspeicher.
4. **Audio liegt auf dem Gerät, nicht im Arbeitsspeicher:** Jede Aufnahme/Region wird als komprimierte Datei
   (FLAC/Opus) in `3nps-studio` abgelegt. Abgespielt wird stückweise (Streaming in Blöcken von ~2 s über einen
   AudioWorklet-Puffer); nur sichtbare/abspielende Bereiche sind dekodiert. Wellenformen als kleine Übersichtsdaten.
   Ziel: **16–24 Stereo-Spuren**, Arbeitsspeicher unter ~400 MB.
5. **Rechnen im Hintergrund:** Effekte in einem gemeinsamen AudioWorklet (eigene DSP wie beim Mastering),
   Zeitdehnung (Signalsmith), Mixdown/Export im Worker. Lastanzeige oben („Last 23 % · Speicher 310 MB“);
   bei Überlast friert das Studio Spuren automatisch ein (vorgerendert, Effekte aus).

## Ansichten (siehe Entwürfe studio-1 … studio-4)

- **Arrangement:** Spuren mit Regionen auf der Zeitleiste, Marker (Intro, Strophe, Refrain …), Cycle-Bereich,
  Schneiden, Blenden, Verschieben mit Einrasten, Tempo und Taktart, Spur-Effekte unten. „Zurück in den Looper“ übergibt
  einen Bereich als neue Idee.
- **Mischpult:** Kanalzüge mit EQ (der neue Channel EQ), Effekt-Plätze (Kompressor, Hall, Delay, De-Esser, Sättigung),
  Panorama, Fader, Pegel, Mute/Solo, Hall-Bus, Summe mit Glue-Kompressor und Limiter → Mastering (vorhandene DSP).
- **Aus dem Looper:** Liste nach Ablagen (Alle, Ideen, Loops, Backing, Zusammenarbeit, Songs), Vorschau mit Spuren,
  „Ins Projekt ab Takt …“ oder „Als neue Spuren“. Songs aus dem Songwriting: Ablauf → Marker, Akkorde → Bass/Akkord-MIDI,
  Text mit Zeiten → Gesangsspur-Hilfe.
- **Noten:** Klavierrolle mit Akkordzeile und Anschlag, Instrumente aus freien Aufnahmen (Bass, Orchester aus VSCO-2,
  CC0), Drummer auf der Zeitleiste (je Teil eigene Einstellungen, echte Kits aus dem Looper).

## Stufen (je eine Version mit Tests, wie gewohnt)

- **S1 – Grundlage (größter Nutzen):** App-Gerüst, gemeinsamer Speicher lesen, „Aus dem Looper“, Arrangement mit
  Audio-Regionen (verschieben, schneiden, blenden), Mischpult mit Lautstärke/Pan/EQ/Mute/Solo, Streaming-Wiedergabe,
  Export WAV + Einzelspuren + Paket für Logic, Knopf „Im Studio öffnen“ im Looper.
- **S2 – Aufnehmen & Effekte:** Aufnahme auf Spuren (Stereo-Eingang, Latenzausgleich wie im Looper), Punch-In,
  Effekte je Spur, Busse, Automation (Lautstärke/Pan/Effekt), Summen-Mastering.
- **S3 – MIDI & Instrumente:** Klavierrolle, Bass/Keys/Orchester-Sampler, Drummer-Regionen, MIDI-Export.
- **S4 – später:** iPad-Hülle (nativ) für weniger Latenz und mehr Speicher; Gesang abtrennen (Konzept D).

## Messlatten (Tests)

- Looper unverändert schnell (Start, Speicher wie v102 ±5 %).
- Studio mit 16 Stereo-Spuren à 4 min: Arbeitsspeicher < 450 MB, keine Aussetzer (Playwright + Lastmessung),
  längste Blockade < 100 ms.
- Übernahme aus dem Looper: Tempo/Takt/Tonart identisch, Spuren sample-genau auf Takt 1.
- Export: WAV gültig, Lautheit wie gemessen, Logic-Paket wie bisher.

## Grenzen

Keine AUv3-/Drittanbieter-Plugins (Web-App), Stereo-Eingang statt Mehrkanal, Spurenzahl durch Safari begrenzt,
Instrumente/Effekte eigene Entwicklung (nicht auf Logic-Niveau bei Klangbibliothek und Spezialwerkzeugen).
