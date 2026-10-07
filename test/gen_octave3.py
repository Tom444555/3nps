#!/usr/bin/env python3
"""Dritter Oktav-Korpus, zufällig zusammengestellt (Stil, Tempo, Hall, MP3, Schwankung) – reine Gegenprobe. CORPUS=oktave3"""
import os, sys, numpy as np
os.environ['CORPUS'] = os.environ.get('OUTC', 'oktave3')   # oktave4: OUTC=oktave4 SEED=888
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_hard as G
SEED = int(os.environ.get('SEED', '777'))
r = np.random.default_rng(SEED)
GTR = ['arp8', 'arp16', 'strum8', 'strum16', 'strum16b']
DR = ['none', 'none', 'ballad', 'ballad8', 'ballad16', 'softpop', 'rnb', 'hiphop', 'tamb', 'pop16', 'rock', 'quarters', 'disco', 'ride16', 'funk']
SPECS = []
for i in range(64):
    slow = i % 2 == 0
    bpm = int(r.integers(55, 82)) if slow else int(r.integers(100, 160))
    d = DR[int(r.integers(0, len(DR)))]
    kw = dict(guitar=GTR[int(r.integers(0, len(GTR)))], prog='pop' if r.random() < 0.8 else 'blues', lead=float(r.choice([0, 0.3, 0.6])),
              bass=bool(r.random() < 0.6), reverb=float(r.choice([0.2, 0.4, 0.7, 0.9])), jitter=float(r.choice([0.003, 0.006, 0.01])))
    if d == 'none': kw.update(drums='rock', drum_gain=0)
    else: kw.update(drums=d, drum_gain=float(r.choice([0.6, 1.0, 1.0])))
    if r.random() < 0.35: kw['mp3'] = str(r.choice(['96k', '128k']))
    if r.random() < 0.25: kw['drift'] = float(r.choice([0.01, 0.02]))
    SPECS.append((f'q{i:02d}_{d}_{kw["guitar"]}_{bpm}', bpm, max(8, int(bpm / 7.5)), (300 if SEED == 777 else 900) + i, kw))
if __name__ == '__main__':
    for name, bpm, bars, seed, kw in SPECS: G.song(name, bpm, bars, seed, **kw)
    print(len(SPECS), 'Stücke')
