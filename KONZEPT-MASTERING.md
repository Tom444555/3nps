# Konzept: Professionelles Mastering im Looper (Stand 19.10.2026, App v95)

## Auftrag (Prompt für den Chat, der das baut)

> Lies `UEBERGABE.md` und diese Datei im Branch `entwicklung` von Tom444555/3nps (Skill „looper“), stelle die Umgebung her.
> Baue in die 3nps-Looper-App ein **professionelles Mastering** nach dem Konzept unten, in den Phasen M1–M4,
> jede Phase als eigene Version mit Tests und Veröffentlichung. Regeln: Stabilität zuerst, kompatibel zur v24
> (keine neue DB-Version, kein neuer Store; neue localStorage-Schlüssel sind erlaubt), keine fremden Server,
> eigene DSP (kein fremder Code ohne passende Lizenz), alles läuft offline auf dem iPad.
> Erkläre Tom am Ende jeder Phase in einfachem Deutsch, was neu ist und wo er es findet.
> Prüfe Messwerte gegen ffmpeg (`ebur128`, `loudnorm`) und die EBU-Testsignale; Messfehler LUFS ≤ 0,1 LU, True Peak ≤ 0,2 dB.

## Ziel

Ein fertiger Stereo-Mix (Looper-Session, Song aus dem Songwriting oder eine geladene Datei, z. B. aus Logic) wird in der App
so gemastert, dass er auf Spotify/YouTube/Apple Music professionell klingt: richtige Lautheit, keine Übersteuerung,
ausgewogener Klang, Druck und Breite – mit einem **Assistenten** für schnelle Ergebnisse und einer **Profi-Ansicht** zum Feinstellen.

## Lautheitsziele (2026)

| Ziel | Integrierte Lautheit | True Peak |
|---|---|---|
| Spotify, YouTube, Amazon Music, TIDAL, SoundCloud | −14 LUFS | −1 dBTP (Spotify empfiehlt beim Hochladen −2 dBTP bei lauten Mastern) |
| Apple Music | −16 LUFS | −1 dBTP |
| Deezer | −15 LUFS | −1 dBTP |
| „Laut“ (Club/CD) | −9 … −10 LUFS | −1 dBTP |
| Eigene Vorgabe | frei | frei |

Lautere Master werden von den Diensten nur leiser gedreht – deshalb Standard −14 LUFS / −1 dBTP und Hinweis, wenn lauter gewünscht wird.
Normen: ITU-R BS.1770-4 (K-Gewichtung, Gating, True Peak mit 4× Überabtastung), EBU R128, EBU Tech 3341 (Messgerät-Testsignale), Tech 3342 (LRA), AES TD1004/TD1008 (Streaming).

## Signalkette (in dieser Reihenfolge)

1. **Analyse** (vor und nach): integrierte/kurzzeitige/momentane Lautheit, True Peak, LRA, Crest-Faktor (PLR), Spektralbalance
   (1/3-Oktaven, geglättet) gegen Genre-Zielkurven, Stereo-Korrelation und Breite je Band, Tiefen-Mono-Prüfung, DC-Versatz, Clipping-Stellen.
2. **Aufräumen:** DC entfernen, Subsonic-Hochpass 20–30 Hz (Steilheit wählbar), optional Mono unter ~120 Hz.
3. **Klang-EQ:** parametrischer EQ (Glocken/Shelves, Biquad, minimalphasig); **Match-EQ** gegen Zielkurve oder Referenz-Song
   (geglättet, auf ±3 dB begrenzt, Stärke regelbar).
4. **Multiband-Kompressor:** 3–4 Bänder, Linkwitz-Riley-Weichen (24 dB/Okt.), je Band Schwelle/Ratio/Attack/Release/Gain, Band solo.
5. **Glue-Kompressor** (Bus): RMS-Detektor, Attack 10–30 ms, Auto-Release, Ratio 1,5–2:1, Ziel 1–2 dB Reduktion, Sidechain-Hochpass.
6. **Sättigung/Wärme:** sanfter Band-/Röhren-Waveshaper mit 4× Überabtastung, Mischregler.
7. **Stereo:** M/S-Breite je Band (Tiefen mono, Höhen breiter), M/S-EQ; Korrelationswarnung.
8. **Limiter:** True-Peak-Brickwall mit Lookahead (1,5–5 ms), Erkennung mit 4× Überabtastung, weiche Release-Kurve, Decke −1 dBTP;
   Eingangsverstärkung wird automatisch so gesetzt, dass das Lautheitsziel erreicht wird.
9. **Dither:** TPDF (optional Noise Shaping) nur bei 16-Bit-Ausgabe.
10. **Ausgabe:** WAV 24 Bit (Standard) / 16 Bit, gleiche Abtastrate wie die Quelle; Bericht (vorher/nachher-Werte) als Text.

## Bedienung

- Neue Karte/Reiter **„Mastering“**: Quelle wählen (Looper-Mixdown, Song, Datei, aus „Lieder mit Text“).
- **Assistent:** Analyse → Genre/Ziel (Rock, Pop, Akustik, Metal, Elektronik, Sprache) → Vorschlag für alle Stufen →
  5 Makro-Regler: **Lautheit, Druck, Wärme, Höhen/Luft, Breite**.
- **Profi-Ansicht:** jede Stufe mit Ein/Aus, Parametern, Gain-Reduction-Anzeige.
- **A/B mit Lautheitsausgleich** (Original und Master gleich laut vergleichen – sonst klingt „lauter“ immer „besser“), Bypass je Stufe.
- **Referenz-Song** laden: Spektrum und Lautheit angleichen.
- Messinstrumente: LUFS M/S/I, True Peak, LRA, Gain-Reduction je Stufe, Spektrum vorher/nachher, Korrelation, Goniometer.
- Voreinstellungen speichern (`3nps-master-presets`), Einstellungen je Song/Datei (`3nps-master-<key>`).
- Ergebnis: Herunterladen/Teilen als WAV, „Für Logic exportieren“ bekommt Option „gemastert“.

## Technische Umsetzung im Browser

- **Eigene DSP in JavaScript** (Float32Array, blockweise), ein Code für zwei Wege:
  - **Vorhören in Echtzeit:** `AudioWorkletProcessor` (Kette ohne teure Teile oder mit 2× statt 4× Überabtastung, wenn das iPad zu langsam ist; Last über `perf.js` messen).
  - **Endgültiges Rechnen:** im **Web Worker** offline (UI bleibt bedienbar, Fortschrittsbalken), volle Qualität.
- `DynamicsCompressorNode` **nicht** verwenden (keine Kontrolle über Detektor/Knie, unterschiedlich in Safari/Chrome).
- Lautheitsmessung nach BS.1770-4 selbst schreiben (K-Filter-Koeffizienten für beliebige Abtastrate berechnen, 400-ms-Blöcke mit 75 % Überlappung, absolutes −70 LUFS- und relatives −10 LU-Gate).
- True Peak: 4× Überabtastung mit Polyphasen-FIR (48 Taps je Phase reichen für ≤ 0,2 dB).
- Speicher: Lieder bis 10 min Stereo 48 kHz ≈ 230 MB Float32 – blockweise verarbeiten, nicht alles doppelt halten.
- Bestehendes nutzen: `ensureMasterBus()` (script.part, Air-Shelf + Sättigung + Limiter-Schalter `3nps-limiter`), `EQ7` (eq.js),
  `lied-export.js` (`render`, `wav24`), `Looper.singAudio`/Spurdaten, `perf.js` für Lastmessung.
- Vorbild für den Match-Ansatz: das Open-Source-Projekt „matchering“ (Referenz-basiertes Mastering) – nur als Ideengeber, keinen Code übernehmen.

## Phasen (M1 erledigt in v97)

- **M1 – Messen und Lautheit (zuerst, größter Nutzen):** LUFS/TP/LRA-Messer, True-Peak-Limiter, „auf Ziel normalisieren“ beim
  Song-Export und für geladene Dateien, Bericht. Tests gegen EBU Tech 3341/3342-Signale und ffmpeg.
- **M2 – Kette und Assistent:** EQ, Glue-Kompressor, Sättigung, Limiter, Makro-Regler, Voreinstellungen, A/B mit Lautheitsausgleich, Echtzeit-Vorhören.
- **M3 – Profi:** Multiband, M/S und Breite je Band, Match-EQ mit Referenz-Song, Genre-Zielkurven, Goniometer.
- **M4 – Einbindung:** Looper-Mixdown → Mastering, Songwriting-Export „gemastert“, Dither/16 Bit, Speichern je Song.

## Tests

- Node: Messgerät gegen EBU-Testsignale (1 kHz Sinus −23 dBFS → −23,0 LUFS; Tech-3341-Fälle 1–9, True-Peak-Fälle 15–23),
  Vergleich mit `ffmpeg -af ebur128=peak=true` an Korpus-Dateien; Limiter: nach 4× Überabtastung nie über der Decke;
  Null-Test bei neutraler Kette; Phasenlage der Weichen (Summe flach ±0,1 dB).
- Playwright: Bedienung, A/B, Export (WAV gültig, Werte im Bericht = Messung), Leistung (Worker blockiert UI nicht).
- Hörprobe: Testmix aus `test/corpus` und ein Song mit Gesang; vorher/nachher an Tom schicken.

## Grenzen / offen

- Echtzeit-Vorhören mit voller Kette auf älteren iPads evtl. zu schwer → automatische Qualitätsstufe.
- „KI-Mastering“ wie bei Online-Diensten ist nicht geplant; der Assistent arbeitet mit Analyse + Regeln + Referenz.
