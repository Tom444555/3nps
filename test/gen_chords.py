#!/usr/bin/env python3
"""Testloops für die Akkorderkennung: Gitarre (Strum, Arpeggio), Klavier, verzerrte Gitarre (Powerchords
und Dreiklänge), mit/ohne Bass und Schlagzeug, verstimmt (±25 Cent), Hall. Ground Truth je Schlag."""
import numpy as np, json, os, wave, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_hard as G
from scipy.signal import fftconvolve, butter, lfilter
SR = 22050
OUT = os.path.dirname(os.path.abspath(__file__)) + '/chords'
os.makedirs(OUT, exist_ok=True)
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
TYPES = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
         'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'dim': [0, 3, 6], '5': [0, 7]}

def voicing(root_pc, typ, low=40, high=67, n=5):
    """Gitarrennahe Lage: Grundton unten (E2..), dann Akkordtöne aufwärts, 4–6 Töne."""
    iv = TYPES[typ]
    r = low + ((root_pc - low) % 12)
    if r > low + 7: r -= 12
    if r < low: r += 12
    notes = [r]; k = 1; base = r
    while len(notes) < n:
        cand = base + iv[k % len(iv)] + 12 * (k // len(iv))
        if cand > high: break
        if cand > notes[-1]: notes.append(cand)
        k += 1
    if typ == '5': notes = [r, r + 7, r + 12] + ([r + 19] if r + 19 <= high else [])
    return notes

def piano(m, dur, tune):
    f = 440 * 2 ** ((m - 69 + tune) / 12); n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for k in range(1, 12):
        if f * k > SR / 2.3: break
        x += np.sin(2 * np.pi * f * k * np.sqrt(1 + 0.0004 * k * k) * t) / k ** 1.4 * np.exp(-t * (0.8 + 0.5 * k))
    x *= np.minimum(1, t / 0.004); r = min(n, int(0.05 * SR)); x[-r:] *= np.linspace(1, 0, r)
    return x * 0.3

def dist(x, drive=6.0):
    b, a = butter(2, 3500 / (SR / 2))
    return lfilter(b, a, np.tanh(x * drive)) * 0.5

def make(name, prog, bpm, inst, seed, per_bar=1, bass=True, drums=False, tune=0.0, reverb=0.3, bars_rep=1):
    """prog: Liste (root_pc, typ), je Eintrag ein Takt (per_bar=1) oder ein halber Takt (per_bar=2)."""
    r = np.random.default_rng(seed)
    beat = 60 / bpm; seq = prog * bars_rep
    nbeats = int(len(seq) * 4 / per_bar); L = nbeats * beat
    buf = np.zeros(int(L * SR) + SR * 3)
    labels = []
    for i, (rt, typ) in enumerate(seq):
        b0 = i * 4 // per_bar; nb = 4 // per_bar
        labels += [NAMES[rt] + typ] * nb
        notes = voicing(rt, typ, 40 if inst != 'piano' else 48, 67 if inst != 'piano' else 76)
        t0 = b0 * beat
        if inst == 'strum':
            for k in range(nb * 2):
                down = k % 2 == 0; ns = notes if down else notes[2:]
                for j, m in enumerate(ns if down else ns[::-1]):
                    G.add(buf, G.pluck(m + tune, 0.5 if down else 0.3, 0.55), t0 + k * beat / 2 + j * 0.008 + r.normal(0, 0.003), 0.12 if down else 0.07)
        elif inst == 'arp':
            for k in range(nb * 2):
                m = notes[[0, 2, 1, 3, 2, 4, 3, 1][k % 8] % len(notes)]
                G.add(buf, G.pluck(m + tune, 0.9, 0.45), t0 + k * beat / 2 + r.normal(0, 0.003), 0.16)
        elif inst == 'piano':
            for k in range(nb):
                for j, m in enumerate(notes): G.add(buf, piano(m, beat * 1.4, tune), t0 + k * beat + r.normal(0, 0.002), 0.8 if k == 0 else 0.5)
        elif inst == 'dist':
            seg = np.zeros(int(nb * beat * SR) + SR)
            for k in range(nb * 2):
                for j, m in enumerate(notes[:4]):
                    G.add(seg, G.pluck(m + tune, beat * 0.55, 0.7), k * beat / 2 + j * 0.003, 0.25)
            G.add(buf, dist(seg), t0, 0.5)
        if bass:
            br = 28 + ((rt - 28) % 12)
            for k, iv in ((0, 0), (2, 7 if typ not in ('dim',) else 6)):
                if k < nb: G.add(buf, G.bass_note(br + iv + tune, beat * 0.9), t0 + k * beat, 0.5)
    if drums:
        for b in range(nbeats):
            G.add(buf, G.KIT['hhc'][1][0], b * beat, 0.5); G.add(buf, G.KIT['hhc'][0][0], b * beat + beat / 2, 0.4)
            if b % 2 == 0: G.add(buf, G.KIT['kick'][2][0], b * beat, 0.9)
            else: G.add(buf, G.KIT['snare'][2][0], b * beat, 0.8)
    if reverb:
        buf = buf + fftconvolve(buf, G.room(1.2, 0.3 + reverb * 0.5, r))[:len(buf)] * reverb
    # Loop: Nachklang an den Anfang falten, auf exakte Länge schneiden
    n = int(round(L * SR)); y = buf[:n].copy(); tail = buf[n:]; y[:len(tail)] += tail[:n]
    y = y / (np.abs(y).max() + 1e-9) * 0.85
    w = wave.open(f'{OUT}/{name}.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype('<i2').tobytes()); w.close()
    json.dump({'name': name, 'bpm': bpm, 'beats': nbeats, 'labels': labels, 'len': n / SR}, open(f'{OUT}/{name}.json', 'w'))

E, F, Fs, G_, A, B, C, D = 4, 5, 6, 7, 9, 11, 0, 2
SPECS = [
    ('c_pop_strum', [(C, ''), (G_, ''), (A, 'm'), (F, '')], 96, 'strum', 1, {}),
    ('c_pop_drums', [(G_, ''), (D, ''), (E, 'm'), (C, '')], 120, 'strum', 2, dict(drums=True)),
    ('c_minor_arp', [(A, 'm'), (F, ''), (C, ''), (G_, '')], 80, 'arp', 3, {}),
    ('c_jazz_piano', [(D, 'm7'), (G_, '7'), (C, 'maj7'), (A, '7')], 100, 'piano', 4, {}),
    ('c_blues_7', [(A, '7'), (D, '7'), (A, '7'), (E, '7')], 90, 'strum', 5, dict(drums=True)),
    ('c_power_dist', [(E, '5'), (G_, '5'), (A, '5'), (C, '5')], 140, 'dist', 6, dict(drums=True)),
    ('c_sus_strum', [(D, 'sus4'), (D, ''), (A, 'sus2'), (A, '')], 104, 'strum', 7, {}),
    ('c_detuned_flat', [(E, 'm'), (C, ''), (G_, ''), (D, '')], 92, 'strum', 8, dict(tune=-0.25)),
    ('c_detuned_sharp', [(F, ''), (B - 1, ''), (C, ''), (F, '')], 110, 'piano', 9, dict(tune=0.2)),
    ('c_half_bar', [(C, ''), (A, 'm'), (F, ''), (G_, ''), (C, ''), (E, 'm'), (F, ''), (G_, '7')], 84, 'piano', 10, dict(per_bar=2)),
    ('c_dist_triads', [(E, 'm'), (C, ''), (D, ''), (B, 'm')], 128, 'dist', 11, dict(drums=True)),
    ('c_dim_piano', [(C, ''), (Fs, 'dim'), (G_, ''), (E, 'm7')], 76, 'piano', 12, {}),
    ('c_nobass_arp', [(D, ''), (B, 'm'), (G_, ''), (A, '')], 70, 'arp', 13, dict(bass=False)),
    ('c_minor_drums', [(D, 'm'), (A - 1, ''), (B - 1, ''), (C, '')], 132, 'strum', 14, dict(drums=True, reverb=0.6)),
]
if __name__ == '__main__':
    for name, prog, bpm, inst, seed, kw in SPECS:
        make(name, prog, bpm, inst, seed, **kw)
        print(name, bpm, inst, ' '.join(NAMES[r] + t for r, t in prog))
