# 3nps / Loopsmiths – Arbeitsweise für Claude

Nachschlagewerk zum Skill `looper` (ergänzt UEBERGABE.md). **Nie ganz lesen** – `grep -n '^## ' ARBEITSWEISE.md`, dann den nötigen Abschnitt mit `sed -n`.
Aktuelle Regressionsliste und Versionsstand stehen in UEBERGABE.md (Abschnitt 8 bzw. Kopfzeile) – die gelten vor diesem Text.

## Briefing für Arbeits-Agenten
1. Quellen `/home/claude/3nps-src` (entwicklung), Veröffentlichung `/home/claude/3nps-main` (main). Zuerst `UEBERGABE.md` lesen. Testserver `sh test/srv.sh` (Port 8765, `app/www`). Bauen `python3 app/build.py && python3 app-studio/build.py`. Tests nacheinander, Studio mit `bypass_csp=True`. Netz: nur GitHub sicher.
2. Regeln: Looper-Leistung zuerst (Schweres nur bei Bedarf/geöffneter Ansicht, sonst exakt alter Signalweg); IDB nur erweitern; CSP lokal; nur freie Lizenzen + Lizenzdatei; neue Looper-Texte englisch in `app/i18n-en2.js`; Studio-Module `window.X = X`; nie `git add -f app`, Dateien einzeln hinzufügen.
3. Ablauf: pull --rebase → umsetzen → Version +1 (`app/head_app.html`, `app/www/sw.js`, `test/v31export.py`, `test/s1studio.py`, `test/v107round.py`; neuere Tests prüfen „ab vNN“) → bauen → neuer Test `test/vNNname.py` (inkl. „keine Skriptfehler“) + Regressionen → Doku (ANLEITUNG.txt neuer Abschnitt, UEBERGABE.md, Anleitung-Thema in `app/hilfe-daten.js`) → commit (deutsch, Attributionszeilen) + push (bei rejected rebase, neu bauen) → main veröffentlichen, auf `gh run … completed success` warten → knapp melden.
4. Regressionen: immer v146rig, v102ideas, v59lang, v60lang, v31export, s1studio, v107round, v113hilfe; Looper-Funktionen v116looperA, v117looperB, v118signal, v119leistung, v120power; Audio/Leistung s1mem, v100mem (bis zum Ende, lange Zeitgrenze); Studio s2studio, s3studio, s3pitch, v112mst, v121studioC, v122studioD, v123inst, v124trennen; Gesang v63singen, v81vox, v85singen.

## Repository

| Branch | Inhalt |
|---|---|
| `main` | fertige App für GitHub Pages (`index.html`, `sw.js`, `ANLEITUNG.txt`, `hilfe/` Bilder, `studio/`, `drums/`, `drones/`, `inst/`, `stretch/`, `asr/` inkl. `asr/models/spleeter/`) + `stabil/` (v24) |
| `entwicklung` | Quellen `app/`, `app-studio/`, `script.part`, `tabs.js`, Tests `test/`, `UEBERGABE.md`, Konzepte, `wiederherstellen.sh` |
| `modelle` | Whisper- und Spleeter-Modelle + Laufzeit, per GitHub Action geholt |
| `stabil-v24`, `stabil-v24-quellen` | Sicherung der v24 |

## Looper – wichtige Stellen (Stand v124)

- Ideen-IIFE in `looper.js`: Ablagen `cat` idee/loop/backing/team, Filter, Verschieben einzeln/mehrfach (`#ideaSelBtn`, `#ideaBulkTo`); geladene Idee `loaded` → „Aktualisieren“ überschreibt dieselbe id, Spurname `.tsrc` (`Looper.setSrcName`).
- „Im Studio ↗“ je Spur (`#studiob<i>`, speichert nur bei `Looper.changes()`) → `studio/?idea=<id>&from=looper`; Looper-AudioContext wird geschlossen (`hardStop`, BroadcastChannel `3nps-audio`); Rückweg „↩ Looper“ (`Exp.backToLooper`, ≤ 3 Stems) → `../?load=<id>`.
- Hall/Echo je Spur: `FX_ROOMS`, `ensureFxBus`, `setTrackFx`, Session-Feld `fx`, Export über `fxRender`. `AppDB` öffnet nach „connection is closing“ selbst neu.
- v116: „Stimmen“ (YIN, a′ 430–450 Hz), „Ebenen“ (max. 8 Overdub-Ebenen, stumm/löschen/↶), Übe-Tempo 100/90/75/50 % (Signalsmith, Aufnahme gesperrt), „Tasten belegen (Tippen · Halten · Doppelt tippen)“.
- v117: „Amp“ + „▾“ (Gate im Eingangs-Worklet, WaveShaper 4x, Klang, Box, Pegel; aus = alter Weg; Mithören am Limiter vorbei), „Szenen“ (Session-Feld, Wechsel am Loop-Anfang), Pedal „Nächste/Vorherige Szene“, „Amp an / aus“.
- v118/v119: „Signalweg“ (Fluss-Diagramm, Pegel je Station, Limiter-GR, „Leistung: xx %“ per renderCapacity oder Worklet-Schätzung); Drums über ein Misch-Worklet mit vorberechnetem Raumhall, Drone als vorgerenderte Schleife (live bis fertig, `3nps-drone-live=1` erzwingt live), flacher EQ ohne Knoten.
- v120: Reiter „Powerchords“ (`app/powerchords.*`, Skill `powerchord-reiter`): Theorie, „Schritt für Schritt“, Griffbrett mit „Alle Stufen zeigen“/„Alle Lagen“, Akkordfolgen mit Auto-Saite und „▶ Loop starten“ (rendert Backing auf Spur 1), Übungen (`powerchords.progress.v1`).
- v124: Spurknopf „Gesang trennen“ → „Karaoke ✓“; Mitsingen „🎤 Karaoke“; Spleeter 2-Stems (ONNX im Worker, ORT aus `asr/lib`, ~79 MB on demand).
- Spurkopf: `.track-head` bricht um, `.th-left` min 160 px.

## Studio – Aufbau (Details UEBERGABE.md)

Audio blockweise aus `SDB` (16-Bit-Blöcke) in AudioWorklet mit 24 Stereo-Ausgängen; je Spur Sättigung→EQ7→Kompressor→Pan→Fader, Sends Hall/Delay, Master Glue+Limiter; Busse 1–4 und Sidechain nur bei Nutzung. Projekt-JSON mit Undo/Autosicherung; Tempokarte (sprunghafte Tempo-/Taktwechsel an Taktgrenzen, Audio bleibt in Sekunden). v121 Takes/Comping, v122 Effekte Amp/Chorus/Tremolo/Tonhöhenkorrektur, „Quantisieren …“, `.loopsmiths`-Projektdatei, „Akkorde erkennen“ + Akkordspur, v123 Instrumente „E-Bass (echt)“, „Akustikgitarre (echt)“, „E-Piano Wurlitzer (echt)“ (`test/gen_inst.py`, `test/gen_inst2.py`, Velocity-Layer), v124 „Gesang trennen“ an Regionen. Module `window.X = X` (top-level `const` ist kein window-Feld!).

## Gesangstext & Mitsingen

- localStorage `3nps-sing`: `{v:1, f:{fileKey:{name, tok, tr, auto, grid, force, parts, bsig}}, l:{song|part|pass:{tok,txt}}}`; fileKey = `name|round(len/sr*10)`. Wort `{w, b, l, a?, k?, s?, as?}`: `b` Schlag-Index, `l` Zeile, `k` 🔒, `s` Sekunden. Beim Ändern immer `Object.assign(db.f[key]||{}, …)` – sonst gehen `grid/parts/force/bsig` verloren.
- `sing.js`: `merge` (`lcsPairs`), `fillMissing`, `recognize(src, keep)` (Whisper), `outOfOrder`/`fixOrder`, `splitLong`, `ownP`. `singen.js`: `getSrc()` = `view(getSrc0())`, alle Zeilen gleich groß, ruhiges Scrollen (Zeilenanfang bei 30 %). **Vom Nutzer abgelehnt:** Akkordbalken, Pausenbalken, Vergrößern der aktuellen Zeile.
- Typische Fehlerursachen beim Nutzer: Text ohne Zeilenumbrüche eingefügt, Wörter ohne Takt („–“), Wörter in falscher zeitlicher Reihenfolge, Abspielen über Editor-Knöpfe bei pausiertem Looper.

## Stolperfallen

- Playwright: `pg.evaluate("…;window.confirm=m=>{…}")` endet mit einer Funktion → `;0` anhängen. Studio `wait_for_function` nur mit `bypass_csp=True`.
- `Looper._setTrackRaw` setzt kein `baseL` → `se=Looper.getSession(); se.baseL=se.tracks[0].L; Looper.loadSession(se)`.
- **Nie `git add -f app`** – zieht die gitignorten Modelle in `entwicklung`.
- Für `v64asr`/`v91keep` die Modelle aus `/home/claude/3nps-mod/asr/` nach `app/www/asr/` kopieren (`wiederherstellen.sh`).
- Testdateien des Nutzers gehören nach `test/user/` (gitignored).
- Netz: fremde Seiten/PyPI oft gesperrt; GitHub-Klon und Release-Assets per curl gehen, WebFetch zum Lesen.
- `pkill -f` mit zu allgemeinem Muster beendet die eigene Shell; `until pgrep …` kann sich selbst finden.
- `v63singen` 19/20: Reiterliste im Test veraltet (Powerchords fehlt) – Test anpassen. `v85singen` gelegentlich zeitbedingt rot.

## Weitere Regeln und Hinweise

- `sw.js` löscht nur eigene `3nps-…`-Caches; Kits/Drones/Instrumente im Cache `drums-1` (`/drums/`, `/drones/`, `/inst/`), Modelle in `asr-1`, Studio-Seite unter `studio/index.html`. v146: three.js + Strat-Modell in `rig-1` (beim ersten Öffnen von Rig).
- Leistung im Detail: Ketten/Messpunkte/Analyser nur solange genutzt bzw. Ansicht offen (Hall-Sends erst bei > 0 %, Amp nur wenn an); große Funktionen ins Studio oder lazy (Reiter erst beim Öffnen bauen, Modelle on demand mit Rückfrage). Kein Layout-Umbau während Animationen.
- CC-BY-Material: Namensnennung auch sichtbar in der App.
- Englisch: Wörterbuch `window.__EN` in `app/i18n-en2.js`, `T()` übersetzt; neue Einträge am Ende vor `});` anhängen. Lange Lehrtexte `translate=no` wie `hilfe.html`. `v59lang`/`v60lang` prüfen das.
- Das Studio liest/ergänzt `3nps-app` nur (öffnet ohne Version). localStorage ist mit der v24 gemeinsam.
- Wartet ein Agent auf einen anderen: neue Dateien zuerst, gemeinsame Dateien erst nach `until git fetch -q origin && git show origin/entwicklung:app/head_app.html | grep -q 'vNN'; do sleep 60; done`. Stop-Hook „uncommitted changes“, während Agenten arbeiten: nicht dazwischen committen.
- Arbeitsordner `/home/claude/3nps-src`; Testskripte nutzen teils `/home/claude/3nps/test/` (von `wiederherstellen.sh` angelegt). Externe Rohquellen (Samples unter `/home/claude/ext/`, Trennmodell-Archiv) sind nicht im Repo; eingebettet sind nur `app/www/inst/` und `asr/models/spleeter/` bzw. Branch `modelle`.
- github.io ist aus der Sitzung oft nicht erreichbar – Deploy über `gh run list` prüfen.
- Konzepte: `KONZEPT-STUDIO.md`, `KONZEPT-MASTERING.md` (M2–M4 offen), `KONZEPT-GESANG-TRENNEN.md` (umgesetzt v124).
- Spark LIVE: Direct-Monitor aus, wenn Amp/Mithören an. Tom wünscht: gründlich testen, wenig Rückfragen, große Blöcke am Stück.
