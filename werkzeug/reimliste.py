#!/usr/bin/env python3
"""v164: Reimwörter-Liste für die Text-Werkstatt (app/www/reim/reim-de-1.txt) aus dem „German MFA dictionary v3.0.0“ erzeugen.

Quelle: Montreal Forced Aligner, McAuliffe & Sonderegger (2024), Lizenz CC BY 4.0 (Lizenztext: app/www/reim/LIZENZ-MFA.txt).
  git clone --depth 1 --filter=blob:none --sparse https://github.com/MontrealCorpusTools/mfa-models.git /tmp/mfa
  (oder direkt: raw.githubusercontent.com/MontrealCorpusTools/mfa-models/main/dictionary/german/mfa/german_mfa.dict)
  python3 werkzeug/reimliste.py /pfad/german_mfa.dict

Was das Skript macht (deterministisch):
  - je Wort die Aussprache, die der Schreibung am nächsten ist; Lautschrift vereinheitlicht (tʰ→t, n̩→ən, ʁ in der Silbencoda → ɐ …) und je Laut ein Zeichen (CODE unten)
  - Reimteil = ab dem letzten vollen Vokal (nicht ə/ɐ); endet das Wort auf eine unbetonte Nachsilbe (-ung, -ig, -lich, -heit, -keit …),
    ab dem vollen Vokal davor (Betonung geschätzt – das Wörterbuch hat keine Betonungszeichen)
  - nur Wörter aus a–z/äöüß, 2–14 Buchstaben, höchstens 4 volle Silben, ohne typisch fremde Schreibung (y, q, c ohne h/k, ou, gh)
  - Reihenfolge in der Gruppe: „Gebräuchlichkeit“ geschätzt = wie oft das Wort als Teil anderer Wörter im Wörterbuch vorkommt
    (Herz → Löwenherz, Herzschlag …), dann kürzere Wörter zuerst. Es gibt keine freie Häufigkeitsliste, deshalb diese Schätzung.
Ausgabe: je Zeile „REIMTEIL wort wort …“ (Reimteil in den Zeichen von CODE), Gruppen nach Reimteil sortiert.
"""
import collections, difflib, re, sys
from pathlib import Path

ZIEL = Path(__file__).resolve().parent.parent / 'app' / 'www' / 'reim' / 'reim-de-1.txt'
MAP = {'tʰ': 't', 'kʰ': 'k', 'pʰ': 'p', 'cʰ': 'k', 'c': 'k', 'ɟ': 'ɡ', 'n̩': 'ə n', 'l̩': 'ə l', 'm̩': 'ə m', 'ɲ': 'n'}
CODE = {'a': 'a', 'aː': 'A', 'ɛ': 'e', 'eː': 'E', 'ɪ': 'i', 'iː': 'I', 'ɔ': 'o', 'oː': 'O', 'ʊ': 'u', 'uː': 'U', 'ʏ': 'y', 'yː': 'Y',
        'œ': '8', 'øː': '9', 'aj': '1', 'aw': '2', 'ɔʏ': '3', 'ə': '@', 'ɐ': 'R',
        'b': 'b', 'd': 'd', 'f': 'f', 'ɡ': 'g', 'h': 'h', 'j': 'j', 'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n', 'ŋ': 'N', 'p': 'p', 'pf': 'F',
        's': 's', 'z': 'Z', 't': 't', 'ts': 'T', 'tʃ': 'C', 'v': 'v', 'x': 'x', 'ç': 'x', 'ʃ': 'S', 'ʁ': 'r'}
VOK = {k for k, v in CODE.items() if v in 'aAeEiIoOuUyY89123@R'}
VOLL = VOK - {'ə', 'ɐ'}
UNBETONT = re.compile(r'(ung|ungen|ig|ige|igen|iger|iges|igem|igt|igte|igten|igkeit|igkeiten|lich|liche|lichen|licher|liches|lichem|isch|ische|ischen|ischer|in|innen|nis|nisse|nissen|sam|same|samen|samer|bar|bare|baren|barer|haft|hafte|haften|heit|heiten|keit|keiten|schaft|schaften|ling|linge|lingen|tum|chen|lein)$')

def lautfolge(ph):
    out = []
    for x in ph: out += MAP.get(x, x).split()
    r = []
    for i, x in enumerate(out):
        if x == 'ʁ' and i > 0 and out[i - 1] in VOK and (i + 1 == len(out) or out[i + 1] not in VOK): x = 'ɐ'
        r.append(x)
    return r

def reimteil(w, ph):
    ph = lautfolge(ph)
    if any(x not in CODE for x in ph): return None, 0
    idx = [i for i, x in enumerate(ph) if x in VOLL]
    if not idx: return None, 0
    k = idx[-1]
    m = UNBETONT.search(w)
    if m and len(idx) > 1 and len(w) - len(m.group(1)) >= 2: k = idx[-2]
    return ''.join(CODE[x] for x in ph[k:]), len(idx)

# Mehrere Aussprachen je Wort (auch verschliffene wie „morgen“ = m ɔ ŋ): die nehmen, die der Schreibung am nächsten ist
BUCH = {'aː': 'a', 'eː': 'e', 'iː': 'i', 'oː': 'o', 'uː': 'u', 'yː': 'ü', 'ʏ': 'ü', 'øː': 'ö', 'œ': 'ö', 'ɛ': 'e', 'ɪ': 'i', 'ɔ': 'o', 'ʊ': 'u',
        'aj': 'ei', 'aw': 'au', 'ɔʏ': 'eu', 'ə': 'e', 'ɐ': 'er', 'ʁ': 'r', 'ŋ': 'ng', 'ɡ': 'g', 'ɟ': 'g', 'ʃ': 'sch', 'ç': 'ch', 'x': 'ch',
        'ts': 'z', 'tʃ': 'tsch', 'pf': 'pf', 'n̩': 'en', 'l̩': 'el', 'm̩': 'em', 'z': 's', 'v': 'w'}
def aehnlich(w, ph):
    t = ''.join(BUCH.get(x, x.replace('ʰ', '')) for x in ph)
    return (difflib.SequenceMatcher(None, w, t).ratio(), len(ph))

def main(src):
    V = collections.defaultdict(list)
    for l in open(src, encoding='utf8'):
        p = l.rstrip('\n').split('\t')
        if len(p) < 2: continue
        w, ph = p[0], p[-1].split()
        if re.fullmatch(r'[a-zäöüß]+', w): V[w].append(ph)
    D = {w: max(vs, key=lambda ph: aehnlich(w, ph)) for w, vs in V.items()}
    S = set(D); teil = collections.Counter()
    for w in D:   # Gebräuchlichkeit schätzen: Wort als Ende (×2) oder Anfang eines längeren Wortes
        for i in range(3, len(w) - 2):
            if w[i:] in S: teil[w[i:]] += 2
            if w[:i] in S: teil[w[:i]] += 1
    G = collections.defaultdict(list)
    for w, ph in D.items():
        if not (2 <= len(w) <= 14) or re.search(r'[yq]|c(?![hk])|ou|gh', w): continue
        k, n = reimteil(w, ph)
        if not k or n > 4: continue
        G[k].append(w)
    zeilen = []
    for k in sorted(G):
        ws = sorted(G[k], key=lambda w: (-min(teil[w], 50), len(w), w))
        zeilen.append(k + ' ' + ' '.join(ws))
    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    ZIEL.write_text('\n'.join(zeilen) + '\n', encoding='utf8')
    print(ZIEL, sum(len(v) for v in G.values()), 'Wörter in', len(G), 'Reimgruppen,', ZIEL.stat().st_size, 'Byte')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/home/claude/dl/mfa/de.dict')
