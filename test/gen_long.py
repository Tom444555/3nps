#!/usr/bin/env python3
"""Lange Songs (1:40–3:30) mit Aufbau wie echte Stücke: freies Intro, Gitarre allein, volle Band, Breaks,
Halftime-Teil, nur Schlagzeug, Ausblenden; leichte Temposchwankung, teils MP3. Der Takt „versteckt“ sich,
weil er erst später klar wird oder zwischendurch verschwindet. Ground Truth: Schläge, Einsen, hörbare Takte."""
import numpy as np, json, os, wave, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_hard as G
from scipy.signal import fftconvolve
SR = G.SR
OUT = os.path.dirname(os.path.abspath(__file__)) + '/long'
os.makedirs(OUT, exist_ok=True)

def song(name, bpm, sections, seed, drums='rock', feel='straight', guitar='strum8', prog='pop', drift=0.0, jitter=0.004, mp3=None, reverb=0.35, key=None):
    r = np.random.default_rng(seed)
    key = int(r.integers(0, 12)) if key is None else key
    pr = G.BLUES12 if prog == 'blues' else G.POP4
    # Takte des Rasters (ohne freies Intro)
    bars_list = []
    for typ, n in sections:
        if typ != 'free': bars_list += [typ] * n
    free_bars = sum(n for t, n in sections if t == 'free')
    total = len(bars_list) * 4
    t = 0.6 + free_bars * 4 * 60 / bpm * 1.15
    beats = []
    for b in range(total + 1):
        beats.append(t)
        cur = bpm * (1 + drift * np.sin(2 * np.pi * b / max(1, total) * 1.5 + seed))
        t += 60 / cur
    beats = np.array(beats)
    buf = np.zeros(int((beats[-1] + 4) * SR))
    J = lambda s=1.0: r.normal(0, jitter * s) if jitter else 0.0
    sub = 3 if feel == 'shuffle' else 4
    def at(bi, k, R):
        bb = bi + k // (R // 4); fr = (k % (R // 4)) / (R // 4)
        if feel == 'shuffle' and R == 16 and fr == 0.5: fr = 2 / 3
        bb = min(bb, len(beats) - 2)
        return beats[bb] + (beats[bb + 1] - beats[bb]) * fr
    # freies Intro: lange Akkorde zu unregelmäßigen Zeiten
    if free_bars:
        tt = 0.6
        while tt < beats[0] - 1.0:
            ch = [48 + key, 55 + key, 60 + key, 64 + key]
            for i, m in enumerate(ch): G.add(buf, G.pluck(m, 2.5, 0.35), tt + i * 0.035, 0.12)
            tt += 60 / bpm * (2.0 + 2.5 * r.random())
    Rr, dp = G.DRUMS[drums]
    audible = []
    nbars = len(bars_list)
    for bar, typ in enumerate(bars_list):
        b0 = bar * 4; root = key + pr[bar % len(pr)]
        fade = 1.0
        if typ == 'fade':
            k0 = bars_list.index('fade'); nf = bars_list.count('fade'); fade = max(0.05, 1 - (bar - k0 + 1) / (nf + 1))
        audible.append(typ != 'break')
        if typ == 'break':
            if bar == 0 or bars_list[bar - 1] != 'break':
                G.add(buf, G.KIT['crash'][2][0], beats[b0], 0.8); G.add(buf, G.KIT['kick'][2][0], beats[b0], 0.9)
                for i, m in enumerate([40 + root, 47 + root, 52 + root]): G.add(buf, G.pluck(m, 2.0, 0.5), beats[b0] + i * 0.01, 0.2)
            continue
        use_drums = typ in ('full', 'half', 'drums', 'fade')
        use_gtr = typ in ('full', 'gtr', 'half', 'fade')
        use_bass = typ in ('full', 'half', 'fade')
        if use_drums:
            pat = dp
            if typ == 'half': pat = {'kick': 'X...............', 'snare': '........X.......', 'hhc': 'x.x.x.x.x.x.x.x.'} if Rr == 16 else {'kick': 'X...........', 'snare': '......X.....', 'hhc': 'x..x..x..x..'}
            for inst, s in pat.items():
                for k, v in G.parse(s):
                    vv = v * (1 + r.normal(0, 0.08)); layer = 0 if vv < 0.5 else 1 if vv < 0.86 else 2
                    smp = G.KIT[inst][layer][int(r.integers(0, len(G.KIT[inst][layer])))]
                    G.add(buf, smp, at(b0, k, Rr) + J(), vv * fade * (0.9 if inst in ('hhc', 'ride', 'shaker') else 1.0))
            # Crash auf der Eins am Teilanfang, Fill im letzten Takt vor einem neuen Teil
            if bar == 0 or bars_list[bar - 1] != typ: G.add(buf, G.KIT['crash'][2][0], beats[b0] + J(), 0.75 * fade)
            if bar + 1 < nbars and bars_list[bar + 1] != typ and bars_list[bar + 1] != 'break':
                for k in range(8): G.add(buf, G.KIT['snare'][1 if k % 2 else 2][0], at(b0 + 2, k, 16) + J(), 0.55 * fade)
        if use_gtr:
            ch = [40 + root, 47 + root, 52 + root, 56 + root, 59 + root]
            if guitar == 'strum8':
                for k in range(8):
                    down = k % 2 == 0; acc = 1.25 if k in (2, 6) else 1.0
                    for i, m in enumerate(ch if down else ch[2:]):
                        G.add(buf, G.pluck(m, 0.5 if down else 0.3, 0.55), at(b0, k * 2, 16) + J(1.5) + i * (0.007 if down else -0.005), (0.11 if down else 0.07) * acc * fade)
            elif guitar == 'boogie':
                sixths = [7, 7, 9, 9, 10, 10, 9, 9]
                for beat in range(4):
                    for j, k in enumerate((0, 2)):
                        top = root + 40 + sixths[(beat * 2 + j) % 8]; t0 = at(b0, beat * 3 + k, 12) + J()
                        G.add(buf, G.pluck(40 + root, 0.28, 0.4), t0, 0.22 * (1.15 if j == 0 else 0.9) * fade)
                        G.add(buf, G.pluck(top, 0.28, 0.4), t0 + 0.004, 0.17 * fade)
            elif guitar == 'arp':
                for k in range(8):
                    m = ch[[0, 2, 3, 4, 3, 2, 1, 2][k]]
                    G.add(buf, G.pluck(m, 0.7, 0.5), at(b0, k * 2, 16) + J(1.2), (0.16 if k % 2 == 0 else 0.11) * fade)
        if use_bass:
            if sub == 3: bpos = [(beat * 3, [0, 4, 7, 9][beat]) for beat in range(4)]
            else: bpos = [(0, 0), (6, 0), (8, 7), (12, 5)]
            for k, iv in bpos:
                G.add(buf, G.bass_note(28 + root + iv, 0.35), at(b0, k, 12 if sub == 3 else 16) + J(), 0.55 * (1.15 if k == 0 else 1) * fade)
        if typ in ('full', 'fade') and r.random() < 0.5:
            scale = [0, 3, 5, 7, 10]
            for _ in range(int(r.integers(2, 6))):
                k = int(r.integers(0, Rr)); m = 64 + key + scale[int(r.integers(0, 5))]
                G.add(buf, G.pluck(m, 0.45, 0.7), at(b0, k, Rr) + J(2), 0.12 * fade)
    if reverb:
        wet = fftconvolve(buf, G.room(1.6, 0.35 + reverb * 0.6, r))[:len(buf)]
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
    gt = {'name': name, 'bpm': bpm, 'beats': beats[:-1].tolist(), 'downbeats': beats[:-1][::4].tolist(), 'bars': nbars,
          'audible': audible, 'sections': sections, 'secs': len(buf) / SR, 'first_bar': float(beats[0])}
    json.dump(gt, open(f'{OUT}/{name}.json', 'w'))
    return gt

SPECS = [
    # Intro frei, dann Gitarre allein, Band kommt dazu, Break, Halftime, Band, Ausblenden
    ('L_rock_song_112', 112, [('free', 3), ('gtr', 8), ('full', 16), ('break', 2), ('full', 8), ('half', 8), ('full', 16), ('fade', 8)], 31, dict(drums='rock')),
    ('L_blues_shuffle_96', 96, [('gtr', 12), ('full', 24), ('drums', 4), ('full', 24), ('break', 1), ('full', 12)], 32, dict(drums='texas', feel='shuffle', guitar='boogie', prog='blues')),
    ('L_ballad_live_74', 74, [('free', 2), ('gtr', 8), ('full', 16), ('half', 8), ('full', 8), ('fade', 6)], 33, dict(drums='ballad', guitar='arp', drift=0.012, jitter=0.008, reverb=0.7)),
    ('L_funk_mp3_104', 104, [('drums', 4), ('full', 16), ('break', 2), ('full', 16), ('drums', 2), ('full', 16), ('fade', 8)], 34, dict(drums='funk', mp3='128k')),
    ('L_pop_late_drums_128', 128, [('free', 4), ('gtr', 16), ('full', 32), ('break', 1), ('full', 32), ('fade', 8)], 35, dict(drums='pop16')),
    ('L_acoustic_drift_90', 90, [('gtr', 40), ('fade', 8)], 36, dict(drums='rock', drift=0.01, jitter=0.006)),
]
if __name__ == '__main__':
    only = sys.argv[1:]
    for name, bpm, sec, seed, kw in SPECS:
        if only and not any(o in name for o in only): continue
        g = song(name, bpm, sec, seed, **kw)
        print(f"{name:26s} {bpm:6.1f} BPM  {g['bars']} Takte  {g['secs']:.0f} s")
