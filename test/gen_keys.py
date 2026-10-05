#!/usr/bin/env python3
"""Testloops für die Tonart-Erkennung: typische Dur- und Moll-Kadenzen in allen Tonarten, verschiedene
Instrumente (Strum, Arpeggio, Klavier, verzerrt), mit/ohne Bass/Schlagzeug. Soll-Tonart in der JSON-Datei."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_chords as GC
GC.OUT = os.path.dirname(os.path.abspath(__file__)) + '/keys'
os.makedirs(GC.OUT, exist_ok=True)
N = GC.NAMES
# (Stufe in Halbtönen über dem Grundton, Typ)
MAJ = {
  'I-V-vi-IV': [(0, ''), (7, ''), (9, 'm'), (5, '')],
  'I-IV-V-IV': [(0, ''), (5, ''), (7, ''), (5, '')],
  'I-vi-IV-V': [(0, ''), (9, 'm'), (5, ''), (7, '')],
  'ii-V-I-I': [(2, 'm7'), (7, '7'), (0, 'maj7'), (0, 'maj7')],
  'I-IV-I-V': [(0, ''), (5, ''), (0, ''), (7, '')],
  'I-iii-IV-V': [(0, ''), (4, 'm'), (5, ''), (7, '')],
  'I-bVII-IV-I': [(0, ''), (10, ''), (5, ''), (0, '')],
  'I-ii-IV-V': [(0, ''), (2, 'm'), (5, ''), (7, '7')],
}
MIN = {
  'i-VI-III-VII': [(0, 'm'), (8, ''), (3, ''), (10, '')],
  'i-iv-v-i': [(0, 'm'), (5, 'm'), (7, 'm'), (0, 'm')],
  'i-VII-VI-VII': [(0, 'm'), (10, ''), (8, ''), (10, '')],
  'i-iv-VII-III': [(0, 'm'), (5, 'm'), (10, ''), (3, '')],
  'i-VI-VII-i': [(0, 'm'), (8, ''), (10, ''), (0, 'm')],
  'i-iv-V-i': [(0, 'm'), (5, 'm'), (7, ''), (0, 'm')],
  'i-VII-VI-V': [(0, 'm'), (10, ''), (8, ''), (7, '')],
  'i-III-VII-iv': [(0, 'm'), (3, ''), (10, ''), (5, 'm')],
}
INST = ['strum', 'arp', 'piano', 'dist']
if __name__ == '__main__':
    i = 0
    for mode, progs in (('maj', MAJ), ('min', MIN)):
        for j, (pn, prog) in enumerate(progs.items()):
            for rep in range(3):
                tonic = (j * 5 + rep * 7 + (3 if mode == 'min' else 0)) % 12
                inst = INST[(j + rep) % 4]
                kw = dict(drums=(rep == 1), bass=(rep != 2) or inst == 'dist', reverb=0.3)
                name = f'k_{mode}_{i:02d}'
                bpm = [80, 96, 110, 124, 72][i % 5]
                GC.make(name, [((tonic + s) % 12, t) for s, t in prog], bpm, inst, 100 + i, **kw)
                meta = json.load(open(f'{GC.OUT}/{name}.json'))
                meta.update(key={'pc': tonic, 'major': mode == 'maj'}, prog=pn, inst=inst)
                json.dump(meta, open(f'{GC.OUT}/{name}.json', 'w'))
                i += 1
    print(i, 'Loops')
