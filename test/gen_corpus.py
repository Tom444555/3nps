#!/usr/bin/env python3
"""Erzeugt realistische Testsongs mit bekannten Schlägen/Takt-Einsen (Ground Truth)."""
import numpy as np, json, os, wave
SR = 22050
OUT = os.path.dirname(os.path.abspath(__file__)) + '/' + (os.environ.get('CORPUS') or 'corpus')
os.makedirs(OUT, exist_ok=True)

def env(n, a, d):
    t = np.arange(n) / SR
    e = np.exp(-t * d)
    k = int(a * SR)
    if k > 0: e[:k] *= np.linspace(0, 1, k)
    return e

def kick(r):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = r.normal(size=n) * np.exp(-t * 400) * 0.3
    return (np.sin(ph) * np.exp(-t * 9) + click) * 0.9

def snare(r):
    n = int(0.25 * SR); t = np.arange(n) / SR
    nz = r.normal(size=n)
    nz = np.convolve(nz, [1, -0.6], 'same')
    return (nz * np.exp(-t * 18) * 0.45 + np.sin(2 * np.pi * 185 * t) * np.exp(-t * 25) * 0.5)

def hat(r, open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR
    nz = r.normal(size=n); nz = nz - np.convolve(nz, np.ones(4) / 4, 'same')
    return nz * np.exp(-t * (9 if open_ else 60)) * 0.22

def pluck(freq, dur, r, bright=0.5):
    n = int(dur * SR); N = max(2, int(SR / freq))
    buf = r.uniform(-1, 1, N); out = np.zeros(n)
    idx = 0
    for i in range(n):
        out[i] = buf[idx]
        nx = (idx + 1) % N
        buf[idx] = 0.497 * (buf[idx] + buf[nx]) * (1 if bright > 0.4 else 0.995)
        idx = nx
    return out

def saw_bass(freq, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = 2 * ((t * freq) % 1) - 1
    # einfacher Tiefpass
    y = np.zeros(n); a = 0.08
    for i in range(1, n): y[i] = y[i - 1] + a * (x[i] - y[i - 1])
    return y * env(n, 0.005, 3) * 0.6

def pad(freqs, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) for f in freqs)
    e = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15)
    return s * e * 0.08

def add(buf, x, t):
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    m = min(len(x), len(buf) - i)
    if m > 0: buf[i:i + m] += x[:m]

NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
PROGS = [[0, 7, 9, 5], [0, 5, 7, 5], [9, 5, 0, 7], [0, 9, 5, 7], [0, 3, 5, 10]]

def song(name, bpm, bars, style, seed, intro_bars=0, pickup=0.0, drift=0.0, jitter=0.0, swing=0.0, lead=True, drums=True, chord_every=1, lead_in=0.0, key=None):
    r = np.random.default_rng(seed)
    key = int(r.integers(0, 12)) if key is None else key
    prog = PROGS[seed % len(PROGS)]
    total_bars = intro_bars + bars
    # Schlagzeiten mit leichter Tempoänderung (drift = relative Änderung über das Stück)
    beats = []
    t = lead_in + pickup
    for b in range(total_bars * 4):
        frac = b / (total_bars * 4)
        cur = bpm * (1 + drift * (frac - 0.5) * 2)
        beats.append(t)
        t += 60 / cur
    beats.append(t)
    beats = np.array(beats)
    length = beats[-1] + 2.0
    buf = np.zeros(int(length * SR))
    J = lambda: r.normal(0, jitter) if jitter else 0.0
    def at(bi, frac=0.0):
        b0 = beats[bi]; b1 = beats[bi + 1]
        if swing and abs(frac - 0.5) < 1e-6: frac = 0.5 + swing * 0.5 * 0.33
        return b0 + (b1 - b0) * frac + J()
    K, S = kick(r), snare(r)
    for bar in range(total_bars):
        b0 = bar * 4
        chord_root = key + prog[(bar // chord_every) % 4]
        minor = prog[(bar // chord_every) % 4] in (9, 2, 4)
        third = 3 if minor else 4
        chord = [48 + chord_root, 48 + chord_root + 7, 60 + chord_root, 60 + chord_root + third, 60 + chord_root + 7]
        in_intro = bar < intro_bars
        # Akkorde: Gitarren-Anschläge
        if style in ('rock', 'pop', 'halftime', 'funk', 'shuffle', 'guitar', 'edm', 'reggae', 'metal', 'finger'):
            pattern = [0, 1, 1.5, 2, 3, 3.5] if style != 'halftime' else [0, 2, 2.5]
            if style == 'guitar': pattern = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
            if style == 'edm': pattern = [0, 0.75, 1.5, 2.5, 3.25]
            if style == 'reggae': pattern = [0.5, 1.5, 2.5, 3.5]
            if style == 'metal': pattern = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
            if style == 'finger': pattern = [i * 0.25 for i in range(16)]
            for p in pattern:
                bi = b0 + int(p); fr = p - int(p)
                down = fr == 0
                if style == 'finger':
                    m = chord[[0, 3, 2, 4][int(p * 4) % 4]] + (12 if int(p * 4) % 4 else 0)
                    add(buf, pluck(NOTE(m), 0.6, r) * (0.22 if fr == 0 else 0.13), at(bi, fr))
                    continue
                for k, m in enumerate(chord):
                    add(buf, pluck(NOTE(m), 0.9 if down else 0.5, r) * (0.18 if down else 0.11) * (1.3 if p == 0 else 1), at(bi, fr) + k * 0.006 * (1 if down else -1))
        else:  # ballad / pads
            add(buf, pad([NOTE(m) for m in chord[2:]], (beats[b0 + 4] - beats[b0])), beats[b0])
            for p in (0, 1, 2, 3):
                add(buf, pluck(NOTE(chord[p % len(chord)] + 12), 0.8, r) * 0.12, at(b0 + p))
        # Bass
        if not in_intro or style == 'ballad':
            if style == 'funk': bpos = [0, 0.75, 1.5, 2.5, 3.25]
            elif style == 'halftime': bpos = [0, 2.5]
            else: bpos = [0, 1, 2, 3] if style != 'ballad' else [0, 2]
            for i, p in enumerate(bpos):
                bi = b0 + int(p); fr = p - int(p)
                m = 36 + chord_root + (7 if i % 3 == 2 else 0)
                add(buf, saw_bass(NOTE(m), 0.35 if style != 'ballad' else 1.2) * (1.15 if p == 0 else 0.9), at(bi, fr))
        # Schlagzeug
        if drums and not in_intro:
            if style in ('rock', 'pop', 'shuffle', 'guitar'):
                kicks, snares = [0, 2, 2.5] if style != 'pop' else [0, 1.75, 2.5], [1, 3]
                hats = [i * 0.5 for i in range(8)] if style != 'pop' else [i * 0.25 for i in range(16)]
            elif style == 'edm':
                kicks, snares, hats = [0, 1, 2, 3], [1, 3], [0.5, 1.5, 2.5, 3.5]
            elif style == 'reggae':
                kicks, snares, hats = [2], [2], [i * 0.5 for i in range(8)]
            elif style == 'metal':
                kicks, snares, hats = [i * 0.25 for i in range(16)], [1, 3], [0, 1, 2, 3]
            elif style == 'halftime':
                kicks, snares, hats = [0, 1.75], [2], [i * 0.5 for i in range(8)]
            elif style == 'funk':
                kicks, snares, hats = [0, 0.75, 2.5], [1, 3, 3.75], [i * 0.25 for i in range(16)]
            else:
                kicks, snares, hats = [0], [], [0, 1, 2, 3]
            for p in kicks: add(buf, K * (1.0 if p == 0 else 0.85), at(b0 + int(p), p - int(p)))
            for p in snares: add(buf, S * (0.6 if p % 1 else 1.0), at(b0 + int(p), p - int(p)))
            for p in hats: add(buf, hat(r, open_=(p == 3.5)) * (1.0 if p % 1 == 0 else 0.7), at(b0 + int(p), p - int(p)))
            if bar % 4 == 0: add(buf, hat(r, True) * 2.5, at(b0))   # Becken auf Takt 1 jeder Phrase
        # Melodie (nicht taktgebunden betont)
        if lead and not in_intro and r.random() < 0.8:
            scale = [0, 2, 4, 5, 7, 9, 11]
            for p in sorted(r.choice(np.arange(0, 4, 0.5), size=int(r.integers(2, 5)), replace=False)):
                m = 72 + key + scale[int(r.integers(0, 7))]
                n = int(0.35 * SR); tt = np.arange(n) / SR
                add(buf, np.sin(2 * np.pi * NOTE(m) * tt + 0.3 * np.sin(2 * np.pi * 5.5 * tt)) * env(n, 0.02, 4) * 0.12, at(b0 + int(p), p - int(p)))
    # Auftakt (Pickup): Gitarre schlägt auf Schlag 4 vor Takt 1 an
    if pickup > 0:
        add(buf, pluck(NOTE(60 + key + prog[0]), 0.5, r) * 0.2, beats[0] - pickup)
    buf += r.normal(size=len(buf)) * 0.002
    buf /= np.abs(buf).max() * 1.15
    gt = {'name': name, 'bpm': bpm, 'beats': beats[:-1].tolist(), 'downbeats': beats[:-1][::4].tolist(),
          'first_bar_after_intro': float(beats[intro_bars * 4]), 'style': style, 'drift': drift, 'bars': total_bars}
    w = wave.open(f'{OUT}/{name}.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((buf * 32767).astype('<i2').tobytes()); w.close()
    json.dump(gt, open(f'{OUT}/{name}.json', 'w'))
    return gt

VALID = [
    ('v_edm_124', 124, 16, 'edm', 101, {'lead_in': 0.7}),
    ('v_edm_128_intro', 128, 16, 'edm', 102, {'intro_bars': 4}),
    ('v_reggae_76', 76, 12, 'reggae', 103, {}),
    ('v_metal_180', 180, 24, 'metal', 104, {}),
    ('v_finger_84', 84, 12, 'finger', 105, {'drums': False, 'lead': False}),
    ('v_rock_110', 110, 16, 'rock', 106, {'jitter': 0.007, 'drift': 0.008}),
    ('v_pop_92_pickup', 92, 16, 'pop', 107, {'pickup': 0.65, 'lead_in': 0.2}),
    ('v_shuffle_120', 120, 16, 'shuffle', 108, {'swing': 1.0}),
    ('v_guitar_76', 76, 12, 'guitar', 109, {'drums': False, 'chord_every': 2}),
    ('v_funk_115', 115, 16, 'funk', 110, {'jitter': 0.006}),
    ('v_ballad_60', 60, 10, 'ballad', 111, {'drums': True}),
    ('v_rock_135_intro', 135, 20, 'rock', 112, {'intro_bars': 2, 'lead_in': 1.6}),
]
if __name__ == '__main__':
    import sys
    specs = VALID if 'valid' in sys.argv else [
        ('rock_120', 120, 16, 'rock', 1, {}),
        ('rock_97_intro', 97.3, 16, 'rock', 2, {'intro_bars': 2, 'lead_in': 0.4}),
        ('pop16_128', 128, 16, 'pop', 3, {'lead_in': 1.1}),
        ('halftime_140', 140, 16, 'halftime', 4, {}),
        ('funk_104', 104, 16, 'funk', 5, {'jitter': 0.006}),
        ('shuffle_88', 88, 12, 'shuffle', 6, {'swing': 1.0}),
        ('ballad_72', 72, 12, 'ballad', 7, {'drums': False, 'chord_every': 1}),
        ('guitar_only_95', 95, 12, 'guitar', 8, {'drums': False, 'lead': False}),
        ('live_drift_112', 112, 24, 'rock', 9, {'drift': 0.015, 'jitter': 0.008}),
        ('pickup_100', 100, 16, 'rock', 10, {'pickup': 0.6, 'lead_in': 0.3}),
        ('fast_170', 170, 24, 'rock', 11, {}),
        ('slow_66', 66, 10, 'pop', 12, {}),
        ('guitar_only_132', 132, 16, 'guitar', 13, {'drums': False, 'lead': True, 'chord_every': 2}),
        ('ballad_drums_80', 80, 12, 'ballad', 14, {'drums': True}),
        ('rock_150_intro4', 150, 20, 'rock', 15, {'intro_bars': 4}),
        ('funk_96_drift', 96, 16, 'funk', 16, {'drift': 0.01, 'jitter': 0.005}),
    ][:]
    for name, bpm, bars, style, seed, kw in specs:
        g = song(name, bpm, bars, style, seed, **kw)
        print(f"{name:20s} {bpm:6.1f} BPM  {g['bars']} Takte  {len(g['beats'])} Schläge")
