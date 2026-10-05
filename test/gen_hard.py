#!/usr/bin/env python3
"""Schwierigere, realistischere Testsongs: Blues-Shuffle, Slow Blues 12/8, Solo-Gitarre, Breaks, Rubato,
Live-Schwankungen, MP3-Kompression. Schlagzeug aus dem App-Kit (kit22/), Gitarre additiv gezupft, Raumhall.
Ground Truth: Schläge und Takt-Einsen (JSON neben der WAV)."""
import numpy as np, json, os, wave, sys, subprocess
from scipy.signal import fftconvolve
SR = 22050
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE + '/' + (os.environ.get('CORPUS') or 'hard')
os.makedirs(OUT, exist_ok=True)

KIT = {}
for f in os.listdir(HERE + '/kit22'):
    i, v, q = f[:-4].split('_'); KIT.setdefault(i, {}).setdefault(int(v), []).append(np.fromfile(HERE + '/kit22/' + f, dtype=np.float32))
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)

_cache = {}
def pluck(m, dur, bright=0.5, body=True):
    key = (round(m, 2), round(dur, 2), bright)
    if key in _cache: return _cache[key]
    f = NOTE(m); n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n); pos = 0.13 + 0.1 * (1 - bright)
    for k in range(1, 28):
        fk = f * k * (1 + 0.0004 * k * k)          # leichte Inharmonizität
        if fk > SR / 2.2: break
        a = abs(np.sin(np.pi * k * pos)) / k ** (1.2 - 0.5 * bright)
        out += a * np.sin(2 * np.pi * fk * t) * np.exp(-t * (1.2 + 0.55 * k ** 1.25 * (1.2 - bright)))
    att = min(n, int(0.002 * SR)); out[:att] *= np.linspace(0, 1, att)
    rel = min(n, int(0.03 * SR)); out[-rel:] *= np.linspace(1, 0, rel)
    _cache[key] = out / (np.abs(out).max() + 1e-9)
    return _cache[key]

def bass_note(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = NOTE(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    e = np.exp(-t * 2.5) * np.minimum(1, t / 0.006); r = min(n, int(0.04 * SR)); e[-r:] *= np.linspace(1, 0, r)
    return x * e * 0.5

def add(buf, x, t, g=1.0):
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    m = min(len(x), len(buf) - i)
    if m > 0: buf[i:i + m] += x[:m] * g

def room(sec, decay, r):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = r.normal(size=n) * np.exp(-t / decay)
    ir = np.convolve(ir, np.ones(6) / 6, 'same'); ir[0] = 1.0
    return ir / np.sqrt((ir ** 2).sum())

BLUES12 = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7]
POP4 = [0, 7, 9, 5]

def parse(s):
    return [(k, {'X': 1.0, 'x': 0.75, 'g': 0.35}[c]) for k, c in enumerate(s) if c != '.']

DRUMS = {
    'texas': (12, {'ride': 'X.xX.xX.xX.x', 'kick': 'X..x..X..x..', 'snare': '...X.....X..', 'hhp': '...x.....x..'}),
    'chicago': (12, {'hhc': 'X.xX.xX.xX.x', 'kick': 'x..x..x..x..', 'snare': '..gX.g..gX.g'}),
    'slow128': (12, {'hhc': 'XxxXxxXxxXxx', 'kick': 'X.....X....x', 'snare': '...X.....X..'}),
    'halfshuffle': (12, {'hhc': 'X.xX.xX.xX.x', 'kick': 'X....x...x..', 'snare': '..g..gX.g..g'}),
    'jump': (12, {'ride': 'X..x.xX..x.x', 'hhp': '...x.....x..', 'kick': 'g..g..g..g..', 'snare': '.......g...g'}),
    'rock': (16, {'kick': 'X.....x.X.......', 'snare': '....X.......X...', 'hhc': 'X.x.X.x.X.x.X.x.'}),
    'bluesrock': (16, {'kick': 'X......xX.x.....', 'snare': '....X.......X...', 'hhc': 'X.x.X.x.X.x.X.x.'}),
    'funk': (16, {'kick': 'X..x......X..x..', 'snare': '....X..g.g..X..g', 'hhc': 'XxxxXxxxXxxxXx.x'}),
    'train': (16, {'kick': 'X.......X.......', 'snare': 'ggxgXgxgggxgXgxg'}),
    'ballad': (16, {'kick': 'X.........x.....', 'rim': '....X.......X...', 'hhc': 'x.x.x.x.x.x.x.x.'}),
    'delta': (16, {'kick': 'X...X...X...X...', 'clap': '....X.......X...', 'shaker': 'x.x.x.x.x.x.x.x.'}),
    'pop16': (16, {'kick': 'X......xX.x.....', 'snare': '....X.......X...', 'hhc': 'XxxxXxxxXxxxXxxx'}),
}

def song(name, bpm, bars, seed, feel='straight', drums='rock', guitar='strum8', prog='blues', bass=True, lead=0.5,
         drift=0.0, jitter=0.004, intro_free=0, breaks=(), pickup_beats=0, fade=False, reverb=0.35, mp3=None, lead_in=0.5, drum_gain=1.0, key=None):
    r = np.random.default_rng(seed)
    key = int(r.integers(0, 12)) if key is None else key
    pr = BLUES12 if prog == 'blues' else POP4
    sub = 3 if feel in ('shuffle', '128') else 4
    # Schlagzeiten (mit Drift); Rubato-Intro: freie Akkorde davor
    beats, t = [], lead_in
    if intro_free:
        t += intro_free * 4 * 60 / bpm * (1.1 + 0.2 * r.random())
    t += pickup_beats * 60 / bpm
    total = bars * 4
    for b in range(total + 1):
        beats.append(t)
        cur = bpm * (1 + drift * np.sin(np.pi * b / total) * (1 if seed % 2 else -1))
        t += 60 / cur
    beats = np.array(beats)
    buf = np.zeros(int((beats[-1] + 3) * SR))
    J = lambda s=1.0: r.normal(0, jitter * s) if jitter else 0.0
    def at(bi, k, R):           # Schritt k im Raster R (pro Takt) ab Schlag bi
        bb = bi + k // (R // 4); fr = (k % (R // 4)) / (R // 4)
        if feel == 'shuffle' and R == 16 and fr == 0.5: fr = 2 / 3
        bb = min(bb, len(beats) - 2)
        return beats[bb] + (beats[bb + 1] - beats[bb]) * fr
    in_break = lambda bar: any(a <= bar < a + l for a, l in breaks)
    # Rubato-Intro: lange Akkorde zu unregelmäßigen Zeiten
    if intro_free:
        tt = lead_in
        while tt < beats[0] - pickup_beats * 60 / bpm - 0.5:
            ch = [48 + key, 55 + key, 60 + key, 64 + key]
            for i, m in enumerate(ch): add(buf, pluck(m, 2.5, 0.35), tt + i * 0.03, 0.12)
            tt += 60 / bpm * (2.2 + 2 * r.random())
    # Auftakt: Gitarrenlauf auf den Schlägen vor Takt 1
    for i in range(pickup_beats):
        add(buf, pluck(52 + key + [0, 3, 5, 7][i % 4], 0.4, 0.6), beats[0] - (pickup_beats - i) * 60 / bpm, 0.25)
    R, dp = DRUMS[drums]
    for bar in range(bars):
        b0 = bar * 4
        root = key + pr[bar % len(pr)]
        if in_break(bar):
            if bar == [a for a, l in breaks if a <= bar][0]:
                add(buf, KIT['crash'][2][0], beats[b0], 0.8 * drum_gain); add(buf, KIT['kick'][2][0], beats[b0], 0.9 * drum_gain)
                for i, m in enumerate([40 + root, 47 + root, 52 + root]): add(buf, pluck(m, 2.0, 0.5), beats[b0] + i * 0.01, 0.2)
            continue
        fade_g = 1.0
        if fade: fade_g = min(1.0, (bar + 1) / 3) * min(1.0, (bars - bar) / 3)
        # Schlagzeug
        if drums and drum_gain > 0:
            for inst, s in dp.items():
                for k, v in parse(s):
                    vv = v * (1 + r.normal(0, 0.08)); layer = 0 if vv < 0.5 else 1 if vv < 0.86 else 2
                    smp = KIT[inst][layer][int(r.integers(0, len(KIT[inst][layer])))]
                    add(buf, smp, at(b0, k, R) + J(), vv * drum_gain * fade_g * (0.9 if inst in ('hhc', 'ride', 'shaker') else 1.0))
            if bar % 4 == 0 and bar > 0 and 'crash' not in dp: add(buf, KIT['crash'][1][0], beats[b0] + J(), 0.6 * drum_gain * fade_g)
        # Gitarre
        ch = [40 + root, 47 + root, 52 + root, 56 + root - (1 if prog == 'blues' and False else 0), 59 + root]
        if guitar == 'strum8':
            for k in range(8):
                down = k % 2 == 0; acc = 1.25 if k in (2, 6) else 1.0
                for i, m in enumerate(ch if down else ch[2:]):
                    add(buf, pluck(m, 0.5 if down else 0.3, 0.55), at(b0, k * 2, 16) + J(1.5) + i * (0.007 if down else -0.005), (0.11 if down else 0.07) * acc * fade_g)
        elif guitar == 'strum16':
            for k in range(16):
                if k % 4 in (1,) and k not in (5, 13): continue
                down = k % 2 == 0
                for i, m in enumerate(ch if down else ch[2:]):
                    add(buf, pluck(m, 0.35, 0.6), at(b0, k, 16) + J(1.5) + i * (0.006 if down else -0.004), (0.1 if down else 0.06) * (1.3 if k % 4 == 0 else 1) * fade_g)
        elif guitar == 'boogie':      # Shuffle-Riff: Grundton + Quinte/Sexte/kl. Septime auf „x.x“
            sixths = [7, 7, 9, 9, 10, 10, 9, 9]
            for beat in range(4):
                for j, k in enumerate((0, 2)):
                    top = root + 40 + sixths[(beat * 2 + j) % 8]
                    t0 = at(b0, beat * 3 + k, 12) + J()
                    add(buf, pluck(40 + root, 0.28, 0.4), t0, 0.22 * (1.15 if j == 0 else 0.9) * fade_g)
                    add(buf, pluck(top, 0.28, 0.4), t0 + 0.004, 0.17 * fade_g)
        elif guitar == 'stabs':       # Akkord-Stabs im Shuffle auf 2 und 4 plus „let“
            for k in (3, 5, 9, 11):
                for i, m in enumerate(ch[1:]): add(buf, pluck(m, 0.25, 0.6), at(b0, k, 12) + J() + i * 0.004, (0.13 if k in (3, 9) else 0.08) * fade_g)
        elif guitar == 'arp128':      # Slow Blues: Arpeggio auf allen Triolen
            for k in range(12):
                m = ch[[0, 2, 3, 4, 3, 2][k % 6]]
                add(buf, pluck(m, 0.9, 0.45), at(b0, k, 12) + J(1.2), (0.17 if k % 3 == 0 else 0.11) * (1.2 if k == 0 else 1) * fade_g)
        elif guitar == 'slide':       # langsame Slide-Töne, kaum Anschläge
            for k in (0, 6):
                add(buf, pluck(52 + root + (3 if k else 0), 1.6, 0.3), at(b0, k, 12 if sub == 3 else 16) + J(2), 0.15 * fade_g)
        # Bass
        if bass:
            if sub == 3: bpos = [(beat * 3, [0, 4, 7, 9][beat]) for beat in range(4)]
            else: bpos = [(0, 0), (4, 7), (8, 0), (10, 7), (12, 5)][:4]
            for k, iv in bpos:
                add(buf, bass_note(28 + root + iv, 0.4 if sub == 3 else 0.3), at(b0, k, 12 if sub == 3 else 16) + J(), 0.55 * (1.15 if k == 0 else 1) * fade_g)
        # Melodie-Fetzen (Blues-Licks), nicht taktgebunden betont
        if lead and r.random() < lead:
            scale = [0, 3, 5, 6, 7, 10]
            for _ in range(int(r.integers(2, 6))):
                k = int(r.integers(0, R)); m = 64 + key + scale[int(r.integers(0, 6))]
                add(buf, pluck(m, 0.45, 0.7), at(b0, k, R) + J(2), 0.12 * fade_g)
    # Raum, Summenkompression, Rauschen
    if reverb:
        wet = fftconvolve(buf, room(1.6, 0.35 + reverb * 0.6, r))[:len(buf)]
        buf = buf + wet * reverb * 1.2
    buf = np.tanh(buf / (np.abs(buf).max() + 1e-9) * 1.4) / np.tanh(1.4)
    buf += r.normal(size=len(buf)) * 0.0015
    buf /= np.abs(buf).max() * 1.12
    path = f'{OUT}/{name}.wav'
    w = wave.open(path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((buf * 32767).astype('<i2').tobytes()); w.close()
    if mp3:
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path, '-b:a', mp3, OUT + '/tmp.mp3'], check=True)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', OUT + '/tmp.mp3', '-ar', str(SR), '-ac', '1', path], check=True)
        os.remove(OUT + '/tmp.mp3')
    valid_bars = [b for b in range(bars) if not in_break(b)]
    gt = {'name': name, 'bpm': bpm, 'beats': beats[:-1].tolist(), 'downbeats': beats[:-1][::4].tolist(), 'bars': bars,
          'feel': feel, 'drums': drums, 'guitar': guitar, 'breaks': list(breaks), 'pickup': pickup_beats, 'mp3': bool(mp3)}
    json.dump(gt, open(f'{OUT}/{name}.json', 'w'))
    return gt

SPECS = [
    ('h_texas_shuffle_118', 118, 24, 1, dict(feel='shuffle', drums='texas', guitar='boogie')),
    ('h_chicago_shuffle_96', 96, 24, 2, dict(feel='shuffle', drums='chicago', guitar='stabs', lead=0.7)),
    ('h_slowblues_60', 60, 12, 3, dict(feel='128', drums='slow128', guitar='arp128')),
    ('h_slowblues_54_nodrums', 54, 12, 4, dict(feel='128', drums='slow128', drum_gain=0, guitar='arp128', bass=False)),
    ('h_boogie_solo_132', 132, 12, 5, dict(feel='shuffle', drums='texas', drum_gain=0, guitar='boogie', bass=False, lead=0)),
    ('h_jump_150', 150, 24, 6, dict(feel='shuffle', drums='jump', guitar='stabs')),
    ('h_halfshuffle_82', 82, 16, 7, dict(feel='shuffle', drums='halfshuffle', guitar='stabs', prog='pop')),
    ('h_bluesrock_124', 124, 24, 8, dict(drums='bluesrock', guitar='strum8')),
    ('h_acoustic_100', 100, 16, 9, dict(drums='rock', drum_gain=0, guitar='strum8', prog='pop', bass=False, lead=0)),
    ('h_acoustic16_86', 86, 16, 10, dict(drums='rock', drum_gain=0, guitar='strum16', prog='pop', bass=False, lead=0.3)),
    ('h_breaks_112', 112, 24, 11, dict(drums='rock', guitar='strum8', prog='pop', breaks=((8, 2),))),
    ('h_rubato_90', 90, 16, 12, dict(drums='rock', guitar='strum8', prog='pop', intro_free=3)),
    ('h_live_drift_104', 104, 24, 13, dict(drums='bluesrock', guitar='strum8', drift=0.04, jitter=0.012)),
    ('h_mp3_funk_100', 100, 16, 14, dict(drums='funk', guitar='strum16', prog='pop', mp3='96k')),
    ('h_mp3_shuffle_126', 126, 24, 15, dict(feel='shuffle', drums='chicago', guitar='boogie', mp3='96k')),
    ('h_pickup2_92', 92, 16, 16, dict(drums='rock', guitar='strum8', prog='pop', pickup_beats=2)),
    ('h_train_150', 150, 24, 17, dict(drums='train', guitar='boogie', feel='straight')),
    ('h_ballad_reverb_68', 68, 12, 18, dict(drums='ballad', guitar='strum8', prog='pop', reverb=0.9)),
    ('h_delta_84', 84, 16, 19, dict(drums='delta', guitar='slide', bass=False)),
    ('h_fade_120', 120, 16, 20, dict(drums='pop16', guitar='strum16', prog='pop', fade=True)),
    ('h_slowblues_68_mp3', 68, 12, 21, dict(feel='128', drums='slow128', guitar='arp128', mp3='128k', reverb=0.6)),
    ('h_shuffle_noBass_108', 108, 24, 22, dict(feel='shuffle', drums='texas', guitar='stabs', bass=False)),
    ('h_slowblues_ride_64', 64, 12, 23, dict(feel='128', drums='slow128', guitar='slide')),
    ('h_texas_fast_168', 168, 24, 24, dict(feel='shuffle', drums='texas', guitar='boogie')),
]
if __name__ == '__main__':
    only = sys.argv[1:]
    for name, bpm, bars, seed, kw in SPECS:
        if only and not any(o in name for o in only): continue
        g = song(name, bpm, bars, seed, **kw)
        print(f"{name:26s} {bpm:6.1f} BPM  {g['bars']} Takte")
