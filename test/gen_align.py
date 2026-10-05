#!/usr/bin/env python3
"""Testloops für den automatischen Abgleich (v20): Spur 1 Drums+Bass, Gitarre mit bekanntem Versatz, Fläche ohne Anschläge."""
import numpy as np, wave, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_hard as G
SR = 22050; bpm = 120; beat = 0.5; bars = 2; L = int(bars * 4 * beat * SR)
OUT = os.path.dirname(os.path.abspath(__file__)) + '/align/'
os.makedirs(OUT, exist_ok=True)
def wr(name, y):
    y = y / (np.abs(y).max() + 1e-9) * 0.8
    w = wave.open(OUT + name, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype('<i2').tobytes()); w.close()
def loopify(buf):
    y = buf[:L].copy(); t = buf[L:]; y[:len(t)] += t[:L]; return y
r = np.random.default_rng(5)
a = np.zeros(L + SR * 2)
for b in range(bars * 4):
    G.add(a, G.KIT['hhc'][1][0], b * beat, 0.5); G.add(a, G.KIT['hhc'][0][0], b * beat + beat / 2, 0.4)
    G.add(a, (G.KIT['kick'] if b % 2 == 0 else G.KIT['snare'])[2][0], b * beat, 0.9)
    G.add(a, G.bass_note(33 if b < 4 else 31, 0.4), b * beat, 0.5)
wr('drums_bass_120.wav', loopify(a))
for name, off in (('gtr_120_late27.wav', 0.027), ('gtr_120_early18.wav', -0.018), ('gtr_120_tight.wav', 0.0)):
    g = np.zeros(L + SR * 2)
    for k in range(bars * 8):
        root = 45 if k < 8 else 43; ch = [root, root + 7, root + 12, root + 16, root + 19]
        down = k % 2 == 0
        for j, m in enumerate(ch if down else ch[2:]): G.add(g, G.pluck(m, 0.4, 0.55), (k * beat / 2 + off + j * 0.006 + r.normal(0, 0.003)) % (L / SR), 0.12 if down else 0.07)
    wr(name, loopify(g))
t = np.arange(L) / SR; pad = sum(np.sin(2 * np.pi * f * t) for f in (110, 138.6, 164.8)) * 0.3 * (0.6 + 0.4 * np.sin(2 * np.pi * t / 4))
wr('pad_120.wav', pad)
print('align: 5 Dateien')
