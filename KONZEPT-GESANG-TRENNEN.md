# Konzept: Gesang in der App abtrennen (Stand 19.10.2026, App v98) – wartet auf Toms OK

## Ziel

Die Gesangsspur, die heute aus Moises kommt (Gesangstext-Editor, `vox` in `sing.js`), direkt in der App erzeugen –
offline, ohne fremden Dienst. Nebenbei entsteht die Begleitung ohne Gesang („Karaoke“) fürs Mitsingen.

## Verfahren

- **Spleeter 2-Stems** (Deezer, MIT-Lizenz) als ONNX aus sherpa-onnx (Apache-2.0):
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/source-separation-models/sherpa-onnx-spleeter-2stems.tar.bz2`
  → `vocals.onnx` + `accompaniment.onnx`, Eingang `x` = Betragsspektrum `[2 Kanäle, Stücke, 512 Frames, 1024 Bins]`, Ausgang gleich.
- Ablauf: auf 44,1 kHz umrechnen → STFT (Hann 4096, Sprung 1024) → untere 1024 Bins in Stücken zu 512 Frames (≈ 11,9 s, mit Überlappung)
  durch beide Modelle → Maske = v² / (v² + a²) aufs volle Spektrum → ISTFT → zurück auf die Abtastrate des Liedes.
- Laufzeit: die vorhandene ONNX-Laufzeit aus `asr/` (WASM, wie Whisper), im Worker, Stück für Stück.

## Gemessen (hier, 1 CPU-Kern, nativ)

| | Wert |
|---|---|
| Modellgröße | 2 × 37,5 MB (fp32) = 75 MB Download (einmalig, eigener Cache wie Whisper) |
| Rechenzeit | 0,25 s je 12-s-Stück und Modell → **2,7 s je Minute Lied** |
| Speicher | Modell ~160 MB, Spitze ~280 MB je Modell bei stückweiser Rechnung |

Erwartung im Browser auf dem iPad (WASM 3–5× langsamer als nativ): **etwa 10–15 s je Minute**, ein 4-Minuten-Lied ≈ 1 Minute.
Speicher ist das Risiko: beide Modelle nacheinander laden und wieder freigeben, sonst droht auf älteren iPads der Abbruch des Web-Prozesses.

## Bedienung (Vorschlag)

- Im Gesangstext-Editor neben „Gesangsspur laden (Moises)“: **„Gesang herauslösen (in der App)“** mit Fortschrittsbalken.
  Ergebnis wird gespeichert wie eine Moises-Spur – alles Weitere (Stimmkurve, Einrasten, Zeiten erkennen) bleibt gleich.
- Beim ersten Mal Hinweis: „lädt einmalig 75 MB“.
- Optional im Mitsingen: Schalter **„ohne Originalgesang“** (spielt die Begleitung).

## Phasen

- **D1 – Testseite:** Messen auf Toms iPad (Zeit, Speicher, Absturz?) mit einem eigenen Lied; Qualität vorher/nachher anhören.
- **D2 – Einbau** in Editor (+ optional Mitsingen), Tests wie bei Whisper (`v64asr`-Art), Modelle über Branch `modelle` bereitstellen.

## Fragen an Tom

1. Ist der einmalige Download von 75 MB in Ordnung? (Mit halber Genauigkeit wären es ~38 MB – Qualität müsste ich prüfen.)
2. Zuerst die Testseite auf dem iPad ausprobieren (empfohlen), oder gleich einbauen?
3. Soll es die Begleitung ohne Gesang zum Mitsingen auch geben?
