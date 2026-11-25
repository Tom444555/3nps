#!/usr/bin/env python3
# v155: erfundene große Musterdatei im Numbers-Format (≈ 750 Einheiten über 3,5 Jahre), deterministisch (fester Zufalls-Startwert).
# NICHT Toms echte Daten – frei ausgedacht, nur für Last- und Darstellungsprüfung.
# Aufruf: python3 test/numbers/gen_gross.py [JJJJ-MM-TT Ende] [Ausgabe.csv]   (ohne Argumente: Ende 20.11.2026 → Gitarre_ueben_gross.csv)
# Als Modul: einheiten(ende_datum) → Liste (start, ende, thema, notiz) mit datetime-Objekten (lokale Zeit, Minuten genau).
import random, sys, os, datetime as dt
THEMEN = ['Technik', 'Tonleitern/Pentatonik', 'Akkorde/Rhythmus', 'Improvisation', 'Songs', 'Looper/Jammen', 'Gesang', 'Theorie', 'Frei']
NOTIZEN = ['Wechselschlag', 'Lage 1–5', 'Barré F', 'Bending sauber', 'Metronom 90', 'Blues in A', 'neuer Song', 'Legato', 'Akkordwechsel']
def einheiten(ende=dt.date(2026, 11, 20), tage=1280, seed=155):
    r = random.Random(seed); out = []
    start = ende - dt.timedelta(days=tage - 1)
    for i in range(tage):
        tag = start + dt.timedelta(days=i)
        p = 0.46 if tag.weekday() < 5 else 0.68          # am Wochenende öfter
        if i > tage - 120: p += 0.08                      # zuletzt etwas fleißiger
        if r.random() > p: continue
        for k in range(2 if r.random() < 0.08 else 1):
            h = r.choice([7, 9, 10, 13, 15, 17, 18, 19, 20, 21]) if k == 0 else r.choice([20, 21, 22])
            s = dt.datetime(tag.year, tag.month, tag.day, h, r.randrange(0, 60))
            dur = r.choice([15, 20, 30, 30, 45, 45, 60, 60, 75, 90, 90, 120, 150])
            e = s + dt.timedelta(minutes=dur)
            if e.date() != tag: e = dt.datetime(tag.year, tag.month, tag.day, 23, 59); s = e - dt.timedelta(minutes=min(dur, 60))
            x = r.random()
            th = r.choice(THEMEN) if x < 0.7 else ''
            nt = r.choice(NOTIZEN) if r.random() < 0.25 else ''
            out.append((s, e, th, nt))
    return out
def fmt(t): return '%02d.%02d.%d, %02d:%02d' % (t.day, t.month, t.year, t.hour, t.minute)
def dauer(m): h, mm = divmod(m, 60); return ' '.join(x for x in [('%dh' % h) if h else '', ('%dm' % mm) if mm else ''] if x) or '0ms'
def csv(us):
    L = ['Datum und Uhrzeit;Start/Ende;Übungszeit;Übungen']
    for s, e, th, nt in us:
        txt = th + (' – ' + nt if nt and th else nt)
        L.append(fmt(s) + ';Start;!!;'); L.append(fmt(e) + ';Ende;' + dauer(int((e - s).total_seconds() // 60)) + ';' + txt)
    return '﻿' + '\n'.join(L) + '\n'
if __name__ == '__main__':
    ende = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date(2026, 11, 20)
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Gitarre_ueben_gross.csv')
    us = einheiten(ende); open(out, 'w', encoding='utf-8').write(csv(us))
    print(out, len(us), 'Einheiten', sum(int((e - s).total_seconds() // 60) for s, e, _, _ in us), 'min')
