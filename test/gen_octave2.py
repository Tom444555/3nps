#!/usr/bin/env python3
"""Zweiter, unabhängiger Oktav-Korpus (andere Seeds/Tempi) zur Gegenprobe der Regeln. CORPUS=oktave2"""
import os, sys
os.environ['CORPUS'] = 'oktave2'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_hard as G
P = dict(prog='pop')
NOD = dict(drums='rock', drum_gain=0)
SPECS = [
    ('p_arp8_58', 58, 8, 201, dict(**NOD, guitar='arp8', bass=True, lead=0.3, **P)),
    ('p_arp8_63', 63, 8, 202, dict(**NOD, guitar='arp8', bass=False, lead=0, reverb=0.8, mp3='128k', **P)),
    ('p_arp8_71', 71, 10, 203, dict(**NOD, guitar='arp8', bass=False, lead=0.5, **P)),
    ('p_arp8_77', 77, 10, 204, dict(**NOD, guitar='arp8', bass=True, lead=0, jitter=0.01, **P)),
    ('p_arp16_65', 65, 8, 205, dict(**NOD, guitar='arp16', bass=True, lead=0, **P)),
    ('p_arp16_78', 78, 10, 206, dict(**NOD, guitar='arp16', bass=False, lead=0.4, mp3='96k', **P)),
    ('p_strum16_62', 62, 8, 207, dict(**NOD, guitar='strum16', bass=False, lead=0, **P)),
    ('p_strum16_67', 67, 8, 208, dict(**NOD, guitar='strum16', bass=True, lead=0, reverb=0.6, **P)),
    ('p_strum16_75', 75, 10, 209, dict(**NOD, guitar='strum16', bass=False, lead=0.3, **P)),
    ('p_strum16b_64', 64, 8, 210, dict(**NOD, guitar='strum16b', bass=False, lead=0, **P)),
    ('p_strum16b_70', 70, 10, 211, dict(**NOD, guitar='strum16b', bass=True, lead=0, mp3='128k', **P)),
    ('p_strum8_58', 58, 8, 212, dict(**NOD, guitar='strum8', bass=False, lead=0, **P)),
    ('p_strum8_80', 80, 10, 213, dict(**NOD, guitar='strum8', bass=True, lead=0, **P)),
    ('p_softpop_61', 61, 8, 214, dict(drums='softpop', guitar='arp8', reverb=0.7, **P)),
    ('p_softpop_73', 73, 10, 215, dict(drums='softpop', guitar='strum16', **P)),
    ('p_ballad_rim_64', 64, 8, 216, dict(drums='ballad', guitar='arp16', reverb=0.8, **P)),
    ('p_ballad_rim_78', 78, 10, 217, dict(drums='ballad', guitar='strum8', **P)),
    ('p_ballad8_71', 71, 10, 218, dict(drums='ballad8', guitar='arp8', mp3='128k', **P)),
    ('p_ballad16_67', 67, 8, 219, dict(drums='ballad16', guitar='strum16', **P)),
    ('p_rnb_71', 71, 10, 220, dict(drums='rnb', guitar='arp16', **P)),
    ('p_hiphop_76', 76, 10, 221, dict(drums='hiphop', guitar='arp8', **P)),
    ('p_tamb_70', 70, 10, 222, dict(drums='tamb', guitar='arp8', **P)),
    ('p_quarters_66', 66, 8, 223, dict(drums='quarters', guitar='strum8', **P)),
    # Gegenprobe schnell/mittel
    ('p_strum8_112', 112, 16, 224, dict(**NOD, guitar='strum8', bass=False, lead=0, **P)),
    ('p_strum8_126', 126, 16, 225, dict(**NOD, guitar='strum8', bass=True, lead=0.3, **P)),
    ('p_strum8_144', 144, 16, 226, dict(**NOD, guitar='strum8', bass=False, lead=0, mp3='128k', **P)),
    ('p_strum16_110', 110, 16, 227, dict(**NOD, guitar='strum16', bass=False, lead=0, **P)),
    ('p_arp8_116', 116, 16, 228, dict(**NOD, guitar='arp8', bass=True, lead=0, **P)),
    ('p_arp8_132', 132, 16, 229, dict(**NOD, guitar='arp8', bass=False, lead=0, **P)),
    ('p_disco_118', 118, 16, 230, dict(drums='disco', guitar='strum16', **P)),
    ('p_disco_126', 126, 16, 231, dict(drums='disco', guitar='strum8', mp3='128k', **P)),
    ('p_punk_168', 168, 24, 232, dict(drums='punk', guitar='strum8', **P)),
    ('p_punk_184', 184, 24, 233, dict(drums='punk', guitar='strum8', **P)),
    ('p_quarters_120', 120, 16, 234, dict(drums='quarters', guitar='strum8', **P)),
    ('p_quarters_138', 138, 16, 235, dict(drums='quarters', guitar='arp8', **P)),
    ('p_rock_112', 112, 16, 236, dict(drums='rock', guitar='strum16', **P)),
    ('p_rock_150', 150, 16, 237, dict(drums='rock', guitar='strum8', reverb=0.6, **P)),
    ('p_ballad8_116', 116, 16, 238, dict(drums='ballad8', guitar='arp8', **P)),
    ('p_softpop_120', 120, 16, 239, dict(drums='softpop', guitar='strum8', **P)),
    ('p_tamb_112', 112, 16, 240, dict(drums='tamb', guitar='strum16', **P)),
    ('p_shuffle_132', 132, 16, 241, dict(feel='shuffle', drums='chicago', guitar='boogie')),
    ('p_boogie_solo_120', 120, 16, 242, dict(feel='shuffle', drums='texas', drum_gain=0, guitar='boogie', bass=False, lead=0)),
]
if __name__ == '__main__':
    for name, bpm, bars, seed, kw in SPECS:
        g = G.song(name, bpm, bars, seed, **kw)
    print(len(SPECS), 'Stücke')
