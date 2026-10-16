#!/bin/sh
# Stellt die Arbeitsumgebung in einer neuen Sitzung wieder her:
#   git clone -b entwicklung https://github.com/Tom444555/3nps.git /home/claude/3nps-src
#   sh /home/claude/3nps-src/wiederherstellen.sh
# Danach liegt alles wie gewohnt unter /home/claude/3nps (Testskripte nutzen diesen Pfad fest).
set -e
SRC=$(cd "$(dirname "$0")" && pwd)
ZIEL=${ZIEL:-/home/claude/3nps}
mkdir -p "$ZIEL"
cp -r "$SRC/app" "$SRC/test" "$SRC/script.part" "$SRC/tabs.js" "$ZIEL/"
cd "$ZIEL/test"
# Ordner für Bildschirmfotos der Tests (fest im Skript hinterlegt)
grep -ho "/tmp/claude-0/[^'\"]*scratchpad/" *.py | sort -u | xargs -r mkdir -p
# Stereo-Testdateien liegen als FLAC im Repo
for f in stereo/*.flac; do ffmpeg -loglevel error -y -i "$f" -map_metadata -1 -fflags +bitexact -flags:a +bitexact "stereo/$(basename "$f" .flac).wav"; done
# Testaudio neu erzeugen (deterministisch, ~1 Minute)
pip install --quiet --break-system-packages numpy scipy playwright 2>/dev/null || true
python3 gen_corpus.py >/dev/null
CORPUS=valid python3 gen_corpus.py valid >/dev/null
python3 gen_hard.py >/dev/null
python3 gen_long.py >/dev/null
python3 gen_chords.py >/dev/null
python3 gen_align.py >/dev/null
python3 gen_keys.py >/dev/null
python3 gen_v25.py >/dev/null
python3 gen_octave.py >/dev/null
python3 gen_octave2.py >/dev/null
python3 gen_octave3.py >/dev/null
OUTC=oktave4 SEED=888 python3 gen_octave3.py >/dev/null
# Texterkennung (v64): Whisper-Modelle und Laufzeit liegen im Branch „modelle“ (per GitHub Action geholt, ~140 MB)
if [ ! -d /home/claude/3nps-mod/asr ]; then git clone -q --depth 1 -b modelle https://github.com/Tom444555/3nps.git /home/claude/3nps-mod; fi
mkdir -p "$ZIEL/app/www/asr/lib" "$ZIEL/app/www/asr/models"
cp /home/claude/3nps-mod/asr/lib/transformers.min.js /home/claude/3nps-mod/asr/lib/ort-wasm-simd-threaded.jsep.* /home/claude/3nps-mod/asr/lib/LICENSE-transformers.txt "$ZIEL/app/www/asr/lib/"
cp -r /home/claude/3nps-mod/asr/models/. "$ZIEL/app/www/asr/models/"
# Testlieder mit Sprache (Musik aus corpus/ballad_72 + Sprache an 4 s und 22 s)
python3 - <<'P'
import numpy as np, scipy.io.wavfile as wf, scipy.signal as ss
T='/home/claude/3nps/test/'
sr, song = wf.read(T+'corpus/ballad_72.wav'); song = song.astype(np.float32); song /= (np.abs(song).max() or 1)
if song.ndim > 1: song = song.mean(1)
for lang in ['de','en']:
    s2, sp = wf.read(T+'sing/sprache_%s.wav'%lang); sp = sp.astype(np.float32); sp /= np.abs(sp).max(); sp = ss.resample_poly(sp, sr, s2)
    mix = song.copy() * 0.5
    for st in [4.0, 22.0]:
        a = int(st*sr); n = min(len(sp), len(mix)-a); mix[a:a+n] += sp[:n]*0.9
    mix /= np.abs(mix).max()*1.05; wf.write(T+'sing/lied_%s.wav'%lang, sr, (mix*32767).astype(np.int16))
P
# v72: Testdatei mit Silben an bekannten Zeiten (für v72prec.py)
python3 "$ZIEL/test/gen_silben.py" || true
python3 "$ZIEL/test/gen_ausklang.py" || true
python3 "$ZIEL/test/gen_lang.py" || true
# App bauen und Testserver starten
python3 "$ZIEL/app/build.py"
sh "$ZIEL/test/srv.sh"
echo "Fertig: $ZIEL · Testserver http://localhost:8765/index.html"
