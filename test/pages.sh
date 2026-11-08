#!/bin/sh
# v139: Pages-Nachbau wie GitHub Pages unter http://localhost:8790/3nps/ (main + aktueller Bau aus app/www darüber, inkl. Modelle)
# und optional der „hängende“ Server auf Port 8791 (v62offline: Datei /tmp/claude-0/pages/HANG = Netz hängt).
# Aufruf: sh test/pages.sh          (neu aufbauen + Server starten)
#         sh test/pages.sh server    (nur Server sicherstellen)
P=/tmp/claude-0/pages; SRC=/home/claude/3nps-src; MAIN=/home/claude/3nps-main
if [ "$1" != "server" ]; then
  [ -d "$MAIN" ] || git clone -q -b main https://github.com/Tom444555/3nps.git "$MAIN"
  rm -rf "$P/3nps" && mkdir -p "$P/3nps"
  cp -r "$MAIN/." "$P/3nps/" && rm -rf "$P/3nps/.git"
  cp -r "$SRC/app/www/." "$P/3nps/"
  [ -d /home/claude/3nps-mod/asr/models ] && cp -r /home/claude/3nps-mod/asr/models/. "$P/3nps/asr/models/"
fi
curl -s -o /dev/null http://localhost:8790/3nps/index.html || (cd "$P" && setsid nohup python3 -m http.server 8790 >/dev/null 2>&1 &)
curl -s -o /dev/null --max-time 2 http://localhost:8791/3nps/index.html || (setsid nohup python3 "$SRC/test/hangsrv.py" "$P" 8791 >/dev/null 2>&1 &)
sleep 1
