#!/bin/sh
# Gesamtbewertung der Takterkennung (nur Zusammenfassungen)
cd "$(dirname "$0")"
for c in corpus valid hard; do printf "%-7s " $c; CORPUS=$c node evaluate.js ../app/beat.js fft.js | tail -1; done
node evalloops.js | tail -1
node loopsall.js | tail -1
sed 's/\[.corpus., *.valid.\]/["hard"]/' loopsall.js > /tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/loopshard.js
cp /tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/loopshard.js ./_loopshard.js; printf "hard-"; node _loopshard.js | tail -1; rm -f _loopshard.js
