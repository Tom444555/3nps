#!/usr/bin/env python3
"""v153: zusätzliche Fälle für die Takt-Eins. Zwei Sammlungen, beide deterministisch (feste Seeds), gebaut mit gen_hard.song:
  blues/   Shuffle und 12-Takt-Blues (verschiedene Tempi, mit/ohne Bass, Shuffle-Achtel, 12/8, mit Auftakt)
  gerade/  Gegenproben: gerade Rock/Pop/Funk-Grooves, auch mit Auftakt
  blues2/  zweite Shuffle/Blues-Sammlung als Gegenprobe (nach dem ersten Festlegen der Regel erzeugt)
  blues3/, gerade2/  dritte Runde: unabhängige Gegenprobe nach der letzten Regeländerung
Festgelegt VOR der Ursachensuche (nicht auf eine Lösung zugeschnitten). Auswertung: node einsmess.js"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
import gen_hard as G
# zusätzliche Schlagzeug-Muster (nur hier, gen_hard bleibt unverändert)
G.DRUMS.update({
    'shuffle4': (12, {'hhc': 'X.xX.xX.xX.x', 'kick': 'X..X..X..X..', 'snare': '...X.....X..'}),
    'rideshuffle': (12, {'ride': 'X.xX.xX.xX.x', 'kick': 'X.....X.....', 'snare': '...X.....X..'}),
    'slow128b': (12, {'hhc': 'XxxXxxXxxXxx', 'kick': 'X....xX.....', 'snare': '...X.....X..'}),
    'brushes': (12, {'snare': 'g.gX.gg.gX.g', 'kick': 'X.....x.....'}),
})
S, T = dict(feel='shuffle'), dict(feel='128')
BLUES = [
    ('b_texas_100', 100, 24, 101, dict(S, drums='texas', guitar='boogie')),
    ('b_texas_140', 140, 24, 102, dict(S, drums='texas', guitar='stabs')),
    ('b_texas_92_nobass', 92, 24, 103, dict(S, drums='texas', guitar='boogie', bass=False)),
    ('b_chicago_112', 112, 24, 104, dict(S, drums='chicago', guitar='boogie')),
    ('b_chicago_80_nobass', 80, 12, 105, dict(S, drums='chicago', guitar='stabs', bass=False)),
    ('b_chicago_132', 132, 24, 106, dict(S, drums='chicago', guitar='stabs', lead=0.7)),
    ('b_jump_138', 138, 24, 107, dict(S, drums='jump', guitar='boogie')),
    ('b_jump_160', 160, 24, 108, dict(S, drums='jump', guitar='stabs')),
    ('b_half_90_pop', 90, 16, 109, dict(S, drums='halfshuffle', guitar='stabs', prog='pop')),
    ('b_half_74', 74, 12, 110, dict(S, drums='halfshuffle', guitar='boogie')),
    ('b_slow_58', 58, 12, 111, dict(T, drums='slow128', guitar='arp128')),
    ('b_slow_66_slide', 66, 12, 112, dict(T, drums='slow128', guitar='slide')),
    ('b_slow_72_nobass', 72, 12, 113, dict(T, drums='slow128', guitar='arp128', bass=False)),
    ('b_slow_56_slide_nobass', 56, 12, 114, dict(T, drums='slow128', guitar='slide', bass=False)),
    ('b_shuffle4_120', 120, 24, 115, dict(S, drums='shuffle4', guitar='boogie')),
    ('b_shuffle4_104_nobass', 104, 24, 116, dict(S, drums='shuffle4', guitar='stabs', bass=False)),
    ('b_ride_126', 126, 24, 117, dict(S, drums='rideshuffle', guitar='stabs')),
    ('b_ride_96_mp3', 96, 24, 118, dict(S, drums='rideshuffle', guitar='boogie', mp3='96k')),
    ('b_slowb_62', 62, 12, 119, dict(T, drums='slow128b', guitar='arp128')),
    ('b_brush_110', 110, 24, 120, dict(S, drums='brushes', guitar='boogie')),
    ('b_solo_boogie_116', 116, 12, 121, dict(S, drums='texas', drum_gain=0, guitar='boogie', bass=False, lead=0)),
    ('b_texas_152_mp3', 152, 24, 122, dict(S, drums='texas', guitar='boogie', mp3='96k')),
    ('b_chicago_104_auftakt1', 104, 24, 123, dict(S, drums='chicago', guitar='boogie', pickup_beats=1)),
    ('b_texas_124_auftakt3', 124, 24, 124, dict(S, drums='texas', guitar='stabs', pickup_beats=3)),
    ('b_slow_70_slide', 70, 12, 125, dict(T, drums='slow128b', guitar='slide')),
    ('b_pop_shuffle_108', 108, 16, 126, dict(S, drums='texas', guitar='strum8', prog='pop')),
    ('b_strum_shuffle_96', 96, 24, 127, dict(S, drums='chicago', guitar='strum8')),
    ('b_drift_shuffle_112', 112, 24, 128, dict(S, drums='texas', guitar='boogie', drift=0.03, jitter=0.010)),
]
P = dict(prog='pop')
GERADE = [
    ('g_rock_108', 108, 16, 201, dict(P, drums='rock', guitar='strum8')),
    ('g_rock_128_blues', 128, 24, 202, dict(drums='rock', guitar='strum8')),
    ('g_rock_142_auftakt1', 142, 16, 203, dict(P, drums='rock', guitar='strum8', pickup_beats=1)),
    ('g_pop16_116', 116, 16, 204, dict(P, drums='pop16', guitar='strum16')),
    ('g_pop16_100_auftakt3', 100, 16, 205, dict(P, drums='pop16', guitar='strum16', pickup_beats=3)),
    ('g_funk_108', 108, 16, 206, dict(P, drums='funk', guitar='strum16')),
    ('g_funk_92_nobass', 92, 16, 207, dict(P, drums='funk', guitar='strum16b', bass=False)),
    ('g_bluesrock_136', 136, 24, 208, dict(drums='bluesrock', guitar='strum8')),
    ('g_disco_120', 120, 16, 209, dict(P, drums='disco', guitar='strum16b')),
    ('g_punk_176', 176, 24, 210, dict(P, drums='punk', guitar='strum8')),
    ('g_quarters_96', 96, 16, 211, dict(P, drums='quarters', guitar='arp8')),
    ('g_ballad_76', 76, 12, 212, dict(P, drums='ballad', guitar='arp8')),
    ('g_hiphop_88', 88, 16, 213, dict(P, drums='hiphop', guitar='strum16b')),
    ('g_rnb_94', 94, 16, 214, dict(P, drums='rnb', guitar='arp16')),
    ('g_softpop_104', 104, 16, 215, dict(P, drums='softpop', guitar='strum16b')),
    ('g_acoustic_112_auftakt2', 112, 16, 216, dict(P, drums='rock', drum_gain=0, guitar='strum8', bass=False, lead=0, pickup_beats=2)),
    ('g_rock_120_blues_auftakt2', 120, 24, 217, dict(drums='rock', guitar='strum8', pickup_beats=2)),
    ('g_bluesrock_100_nobass', 100, 24, 218, dict(drums='bluesrock', guitar='strum8', bass=False)),
    ('g_ballad16_70', 70, 12, 219, dict(P, drums='ballad16', guitar='arp8')),
    ('g_rock_150_mp3', 150, 24, 220, dict(P, drums='rock', guitar='strum16', mp3='96k')),
]
# blues2: Gegenprobe, erst NACH dem Festlegen der Regel (v153) erzeugt – nicht zum Einstellen verwenden.
BLUES2 = [
    ('c_texas_108', 108, 24, 301, dict(S, drums='texas', guitar='boogie')),
    ('c_texas_132_stabs', 132, 24, 302, dict(S, drums='texas', guitar='stabs')),
    ('c_texas_146_mp3', 146, 24, 303, dict(S, drums='texas', guitar='boogie', mp3='96k')),
    ('c_texas_116_strum', 116, 24, 304, dict(S, drums='texas', guitar='strum8')),
    ('c_chicago_100', 100, 24, 305, dict(S, drums='chicago', guitar='boogie')),
    ('c_chicago_120_mp3', 120, 24, 306, dict(S, drums='chicago', guitar='boogie', mp3='96k')),
    ('c_chicago_90_stabs_nobass', 90, 24, 307, dict(S, drums='chicago', guitar='stabs', bass=False)),
    ('c_chicago_138_strum', 138, 24, 308, dict(S, drums='chicago', guitar='strum8')),
    ('c_ride_112', 112, 24, 309, dict(S, drums='rideshuffle', guitar='boogie')),
    ('c_ride_134_stabs', 134, 24, 310, dict(S, drums='rideshuffle', guitar='stabs')),
    ('c_shuffle4_96', 96, 24, 311, dict(S, drums='shuffle4', guitar='boogie')),
    ('c_shuffle4_128_strum_pop', 128, 16, 312, dict(S, drums='shuffle4', guitar='strum8', prog='pop')),
    ('c_brush_124_stabs', 124, 24, 313, dict(S, drums='brushes', guitar='stabs')),
    ('c_jump_144', 144, 24, 314, dict(S, drums='jump', guitar='boogie')),
    ('c_half_86', 86, 24, 315, dict(S, drums='halfshuffle', guitar='boogie')),
    ('c_slow_60_slide', 60, 12, 316, dict(T, drums='slow128', guitar='slide')),
    ('c_slow_64_arp', 64, 12, 317, dict(T, drums='slow128', guitar='arp128')),
    ('c_slow_52_arp_nobass', 52, 12, 318, dict(T, drums='slow128b', guitar='arp128', bass=False)),
    ('c_slow_74_slide_24', 74, 24, 319, dict(T, drums='slow128b', guitar='slide')),
    ('c_pop_shuffle_100', 100, 16, 320, dict(S, drums='chicago', guitar='strum8', prog='pop')),
    ('c_pop_shuffle_122_nobass', 122, 16, 321, dict(S, drums='texas', guitar='strum8', prog='pop', bass=False)),
    ('c_texas_112_auftakt2', 112, 24, 322, dict(S, drums='texas', guitar='boogie', pickup_beats=2)),
    ('c_solo_boogie_104', 104, 24, 323, dict(S, drums='texas', drum_gain=0, guitar='boogie', bass=False, lead=0)),
    ('c_drift_chicago_108', 108, 24, 324, dict(S, drums='chicago', guitar='boogie', drift=0.02, jitter=0.008)),
]
# blues3 / gerade2: zweite Gegenprobe (nach der letzten Regeländerung erzeugt) – Kombinationen fest durchgezählt, nicht zum Einstellen verwenden.
def _reihe(prefix, seed0, combos, tempi):
    out = []
    for n, (dr, gt, kw) in enumerate(combos):
        bpm = tempi[n % len(tempi)]
        out.append((f'{prefix}_{dr}_{gt}_{bpm}' + ('_nobass' if kw.get('bass') is False else '') + ('_pop' if kw.get('prog') == 'pop' else '') + ('_mp3' if kw.get('mp3') else '') + (f"_auftakt{kw['pickup_beats']}" if kw.get('pickup_beats') else ''),
                    bpm, 12 if kw.get('feel') == '128' else 24 if kw.get('prog') != 'pop' else 16, seed0 + n, dict(kw, drums=dr, guitar=gt)))
    return out
BLUES3 = _reihe('d', 401, [
    ('texas', 'boogie', dict(S)), ('texas', 'stabs', dict(S, bass=False)), ('texas', 'strum8', dict(S, prog='pop')), ('texas', 'boogie', dict(S, pickup_beats=1)),
    ('chicago', 'boogie', dict(S)), ('chicago', 'stabs', dict(S)), ('chicago', 'strum8', dict(S, mp3='96k')), ('chicago', 'boogie', dict(S, bass=False)),
    ('rideshuffle', 'boogie', dict(S, mp3='96k')), ('rideshuffle', 'stabs', dict(S)), ('rideshuffle', 'strum8', dict(S, prog='pop')), ('shuffle4', 'boogie', dict(S)),
    ('shuffle4', 'stabs', dict(S)), ('shuffle4', 'strum8', dict(S, bass=False)), ('brushes', 'boogie', dict(S)), ('brushes', 'strum8', dict(S, prog='pop')),
    ('jump', 'boogie', dict(S)), ('halfshuffle', 'boogie', dict(S)), ('slow128', 'arp128', dict(T)), ('slow128', 'slide', dict(T)),
    ('slow128b', 'arp128', dict(T, bass=False)), ('slow128b', 'slide', dict(T)), ('texas', 'boogie', dict(S, pickup_beats=3, mp3='96k')), ('chicago', 'strum8', dict(S, prog='pop', pickup_beats=2)),
], [94, 106, 118, 130, 142, 154, 88, 100, 112, 124, 136, 148, 98, 110, 122, 134, 146, 84, 56, 62, 68, 76, 128, 104])
GERADE2 = _reihe('e', 501, [
    ('rock', 'strum8', dict()), ('rock', 'strum16', dict(P)), ('rock', 'arp8', dict(P, bass=False)), ('rock', 'strum8', dict(P, pickup_beats=1)),
    ('bluesrock', 'strum8', dict()), ('bluesrock', 'strum16', dict(P, mp3='96k')), ('pop16', 'strum16b', dict(P)), ('pop16', 'arp16', dict(P, pickup_beats=2)),
    ('funk', 'strum16', dict(P)), ('funk', 'strum16b', dict()), ('disco', 'strum8', dict(P)), ('quarters', 'strum8', dict()),
    ('ballad', 'arp8', dict(P)), ('ballad8', 'strum8', dict(P)), ('hiphop', 'arp8', dict(P)), ('rnb', 'strum16b', dict(P)),
    ('softpop', 'arp16', dict(P)), ('punk', 'strum8', dict()), ('rock', 'strum8', dict(bass=False, pickup_beats=3)), ('delta', 'strum8', dict(P)),
], [112, 124, 96, 132, 118, 104, 126, 92, 100, 110, 122, 102, 72, 80, 90, 98, 108, 168, 138, 88])
if __name__ == '__main__':
    only = sys.argv[1:]
    for out, specs in (('blues', BLUES), ('gerade', GERADE), ('blues2', BLUES2), ('blues3', BLUES3), ('gerade2', GERADE2)):
        G.OUT = HERE + '/' + out; os.makedirs(G.OUT, exist_ok=True)
        for name, bpm, bars, seed, kw in specs:
            if only and not any(o in name for o in only): continue
            G._cache.clear()
            g = G.song(name, bpm, bars, seed, **kw)
            print(f"{name:28s} {bpm:6.1f} BPM  {g['bars']} Takte")
