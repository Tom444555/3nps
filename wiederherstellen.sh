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
# App bauen und Testserver starten
python3 "$ZIEL/app/build.py"
sh "$ZIEL/test/srv.sh"
echo "Fertig: $ZIEL · Testserver http://localhost:8765/index.html"
