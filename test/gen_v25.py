#!/usr/bin/env python3
"""Testaudio für v25: mithoeren.wav (A C E F F# mit Pausen, als „Mikrofon“) und solo_test.wav (Solo über C G Am F, +20 ms)."""
import numpy as np, wave, os
D = os.path.dirname(os.path.abspath(__file__))
def write(name, y, sr):
    w = wave.open(os.path.join(D, name), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((y * 32767).astype('<i2').tobytes()); w.close()
sr = 48000; rng = np.random.default_rng(3); out = []
for m in [57, 60, 64, 65, 66]:
    f = 440 * 2 ** ((m - 69) / 12); n = int(0.7 * sr); t = np.arange(n) / sr
    x = sum(np.sin(2 * np.pi * f * k * t + k) / k ** 1.1 for k in range(1, 9)) * np.exp(-t * 2.5) * 0.25 * np.minimum(1, t / 0.003)
    out.append(x); out.append(rng.normal(0, 0.0008, int(0.5 * sr)))
y = np.concatenate(out); write('mithoeren.wav', y / np.abs(y).max() * 0.6, sr)
y = np.zeros(int(10.0 * sr)); E = 0.3125
for m, t0, d in [(64,0,1),(67,E,1),(69,2*E,1),(67,3*E,1),(72,4*E,2),(71,2.5,1),(74,2.5+E,1),(66,2.5+2*E,1),(67,2.5+3*E,2),(65,5.0,1),(64,5+E,1),(62,5+2*E,1.0),(69,6.25,1),(72,6.25+E,1.6),(69,7.5,1),(65,7.5+E,1),(67,7.5+2*E,1),(70,7.5+3*E,1),(69,7.5+4*E,2.5)]:
    f = 440 * 2 ** ((m - 69) / 12); n = int(d * E * sr * 0.95); t = np.arange(n) / sr
    x = sum(np.sin(2 * np.pi * f * k * t + k) / k ** 1.2 for k in range(1, 9)) * np.exp(-t * 2.0) * 0.22 * np.minimum(1, t / 0.002); x[-200:] *= np.linspace(1, 0, 200)
    i0 = int((t0 + 0.020) * sr); y[i0:i0 + n] += x[:len(y) - i0]
write('solo_test.wav', y / np.abs(y).max() * 0.7, sr)
