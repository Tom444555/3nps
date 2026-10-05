#!/bin/sh
# Testserver sicherstellen (stirbt zwischen den Zügen)
curl -s -o /dev/null http://localhost:8765/index.html || (cd /home/claude/3nps/app/www && setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 &)
sleep 1
