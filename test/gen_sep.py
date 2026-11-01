#!/usr/bin/env python3
"""v124: Testaudio für „Gesang trennen“ (test/v124trennen.py): synthetische „Stimme“ (Sägezahn-Obertöne mit Vibrato und
Formanten 700/1200/2600 Hz, Töne im Sekundentakt) 0–12 s, danach Sprache (espeak, aus Branch „modelle“ asr/test/sprache_de.wav,
falls vorhanden) + Begleitung (corpus/ballad_72.wav: Gitarre/Bass/Drums, leicht stereo). Schreibt nach /home/claude/3nps/test/sep/:
mix.wav (Stereo), voice.wav und acc.wav (die beiden Anteile, für die Messung), 48 kHz, 16 Bit, 24 s."""
import numpy as np, scipy.io.wavfile as wf, scipy.signal as ss, os
T = '/home/claude/3nps/test/'; O = T + 'sep/'; os.makedirs(O, exist_ok=True)
sr = 48000; D = 24
def load(p):
    r, x = wf.read(p); x = x.astype(np.float32)
    if x.ndim > 1: x = x.mean(1)
    x /= (np.abs(x).max() or 1); return ss.resample_poly(x, sr, r).astype(np.float32)
t = np.arange(sr * D) / sr
f0 = 220 * 2 ** ((np.floor(t) % 5) * 2 / 12) * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t))
ph = 2 * np.pi * np.cumsum(f0) / sr
v = np.zeros_like(t)
for h in range(1, 25):
    fh = f0 * h; a = np.exp(-((fh - 700) / 250) ** 2) + 0.7 * np.exp(-((fh - 1200) / 300) ** 2) + 0.3 * np.exp(-((fh - 2600) / 400) ** 2) + 0.05
    v += a * np.sin(h * ph)
env = (np.sin(np.pi * (t % 1.0)) ** 0.3) * ((t % 4) < 3) * (t < 12)
voice = (v * env).astype(np.float32); voice /= np.abs(voice).max()
for p in ['/home/claude/3nps-mod/asr/test/sprache_de.wav', T + 'sing/sprache_de.wav']:
    if os.path.exists(p):
        sp = load(p); a = int(13 * sr); n = min(len(sp), len(voice) - a); voice[a:a + n] += sp[:n] * 0.9; break
mu = load(T + 'corpus/ballad_72.wav'); mu = np.tile(mu, int(np.ceil(sr * D / len(mu))))[:sr * D]
voice *= 0.45; acc = mu * 0.45
accL, accR = acc * 1.0, np.roll(acc, 24) * 0.9
mixL, mixR = voice + accL, voice + accR
pk = max(np.abs(mixL).max(), np.abs(mixR).max()) / 0.95
q = lambda x: (np.clip(x / pk, -1, 1) * 32767).astype(np.int16)
wf.write(O + 'mix.wav', sr, np.stack([q(mixL), q(mixR)], 1))
wf.write(O + 'voice.wav', sr, np.stack([q(voice), q(voice)], 1))
wf.write(O + 'acc.wav', sr, np.stack([q(accL), q(accR)], 1))
print('Testaudio:', O)
