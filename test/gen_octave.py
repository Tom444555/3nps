#!/usr/bin/env python3
"""Oktav-Korpus: viele langsame bis mittlere Stücke mit dichten Becken/Anschlägen (Sechzehntel, Achtel-Arpeggios,
Schlaggitarre), dazu schnelle Stücke als Gegenprobe (dürfen nicht halbiert werden). Tempo = Viertel, wie notiert.
CORPUS=oktave python3 gen_octave.py"""
import os, sys
os.environ.setdefault('CORPUS', 'oktave')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_hard as G
P = dict(prog='pop')
SPECS = [
    # langsam, dichte Hi-Hats (16tel)
    ('o_hiphop_72', 72, 12, 101, dict(drums='hiphop', guitar='arp8', **P)),
    ('o_hiphop_84', 84, 12, 102, dict(drums='hiphop', guitar='strum8', mp3='128k', **P)),
    ('o_hiphop_92', 92, 12, 103, dict(drums='hiphop', guitar='slide', lead=0.8, **P)),
    ('o_rnb_66', 66, 10, 104, dict(drums='rnb', guitar='arp8', reverb=0.6, **P)),
    ('o_rnb_78', 78, 12, 105, dict(drums='rnb', guitar='strum16', **P)),
    ('o_pop16_70', 70, 10, 106, dict(drums='pop16', guitar='arp8', **P)),
    ('o_pop16_88', 88, 12, 107, dict(drums='pop16', guitar='strum16', mp3='96k', **P)),
    ('o_pop16_96', 96, 16, 108, dict(drums='pop16', guitar='strum8', **P)),
    ('o_ballad16_62', 62, 8, 109, dict(drums='ballad16', guitar='arp16', reverb=0.8, **P)),
    ('o_ballad16_74', 74, 10, 110, dict(drums='ballad16', guitar='arp8', reverb=0.7, drift=0.02, jitter=0.008, **P)),
    ('o_tamb_80', 80, 12, 111, dict(drums='tamb', guitar='strum16', **P)),
    ('o_tamb_94', 94, 12, 112, dict(drums='tamb', guitar='strum8', mp3='128k', **P)),
    ('o_ride16_86', 86, 12, 113, dict(drums='ride16', guitar='arp8', **P)),
    ('o_softpop_68', 68, 10, 114, dict(drums='softpop', guitar='arp16', reverb=0.6, **P)),
    ('o_softpop_82', 82, 12, 115, dict(drums='softpop', guitar='strum16b', **P)),
    # langsam, Achtel-Becken
    ('o_ballad8_60', 60, 8, 116, dict(drums='ballad8', guitar='arp8', reverb=0.8, **P)),
    ('o_ballad8_68', 68, 10, 117, dict(drums='ballad8', guitar='strum8', reverb=0.6, **P)),
    ('o_ballad8_76', 76, 10, 118, dict(drums='ballad8', guitar='arp16', drift=0.03, jitter=0.01, **P)),
    ('o_ballad_rim_72', 72, 10, 119, dict(drums='ballad', guitar='arp8', reverb=0.7, mp3='128k', **P)),
    ('o_rock8_84', 84, 12, 120, dict(drums='rock', guitar='strum8', **P)),
    # nur Gitarre / ohne Schlagzeug
    ('o_strum16_70', 70, 10, 121, dict(drums='rock', drum_gain=0, guitar='strum16', bass=False, lead=0, **P)),
    ('o_strum16_86', 86, 12, 122, dict(drums='rock', drum_gain=0, guitar='strum16', bass=False, lead=0, reverb=0.5, **P)),
    ('o_strum16b_76', 76, 10, 123, dict(drums='rock', drum_gain=0, guitar='strum16b', bass=False, lead=0, **P)),
    ('o_strum16b_92', 92, 12, 124, dict(drums='rock', drum_gain=0, guitar='strum16b', bass=True, lead=0.3, mp3='128k', **P)),
    ('o_strum8_64', 64, 8, 125, dict(drums='rock', drum_gain=0, guitar='strum8', bass=False, lead=0, **P)),
    ('o_strum8_72', 72, 10, 126, dict(drums='rock', drum_gain=0, guitar='strum8', bass=True, lead=0.4, jitter=0.01, drift=0.02, **P)),
    ('o_arp8_66', 66, 8, 127, dict(drums='rock', drum_gain=0, guitar='arp8', bass=False, lead=0, reverb=0.7, **P)),
    ('o_arp8_80', 80, 10, 128, dict(drums='rock', drum_gain=0, guitar='arp8', bass=True, lead=0, **P)),
    ('o_arp16_60', 60, 8, 129, dict(drums='rock', drum_gain=0, guitar='arp16', bass=False, lead=0, reverb=0.6, **P)),
    ('o_arp16_72', 72, 10, 130, dict(drums='rock', drum_gain=0, guitar='arp16', bass=False, lead=0, **P)),
    ('o_arp16_84', 84, 12, 131, dict(drums='rock', drum_gain=0, guitar='arp16', bass=True, lead=0, mp3='96k', **P)),
    # Gegenprobe: mittel und schnell (darf nicht halbiert werden)
    ('o_rock_120', 120, 16, 132, dict(drums='rock', guitar='strum8', **P)),
    ('o_rock_140', 140, 16, 133, dict(drums='rock', guitar='strum8', mp3='128k', **P)),
    ('o_rock_160', 160, 24, 134, dict(drums='rock', guitar='strum8', **P)),
    ('o_rock_176', 176, 24, 135, dict(drums='bluesrock', guitar='strum8', **P)),
    ('o_pop16_118', 118, 16, 136, dict(drums='pop16', guitar='strum16', **P)),
    ('o_pop16_128', 128, 16, 137, dict(drums='pop16', guitar='strum8', **P)),
    ('o_funk_108', 108, 16, 138, dict(drums='funk', guitar='strum16', **P)),
    ('o_strum8_118', 118, 16, 139, dict(drums='rock', drum_gain=0, guitar='strum8', bass=False, lead=0, **P)),
    ('o_strum8_136', 136, 16, 140, dict(drums='rock', drum_gain=0, guitar='strum8', bass=True, lead=0, **P)),
    ('o_tamb_124', 124, 16, 141, dict(drums='tamb', guitar='strum8', **P)),
    ('o_ballad8_104', 104, 12, 142, dict(drums='ballad8', guitar='strum8', **P)),
    ('o_shuffle_150', 150, 24, 143, dict(feel='shuffle', drums='texas', guitar='boogie')),
    ('o_hiphop_100', 100, 12, 144, dict(drums='hiphop', guitar='strum8', **P)),
]
if __name__ == '__main__':
    only = sys.argv[1:]
    for name, bpm, bars, seed, kw in SPECS:
        if only and not any(o in name for o in only): continue
        g = G.song(name, bpm, bars, seed, **kw)
        print(f"{name:22s} {bpm:6.1f} BPM  {g['bars']} Takte")
