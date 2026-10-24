# v101: echtes Horn für den Drone „Schlachtfeld“ – Aufnahmen aus VSCO-2 CE (Versilian Studios, CC0), F-Horn gehalten, lauteste Stufe.
# Quelle: git clone --depth 1 --filter=blob:none --no-checkout https://github.com/sgossner/VSCO-2-CE /home/claude/ext/vsco
#         git -C /home/claude/ext/vsco checkout HEAD -- "Brass/F Horn/sus"
# Bearbeitung „Kriegshorn“: kräftig angeblasen, etwas angezerrt (rau), Mitten betont, Höhen gedämpft; je Ton 5 s.
import json, os, subprocess, numpy as np
D = '/home/claude/ext/vsco/Brass/F Horn/sus/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../app/www/drones/')
SR = 48000
PICK = ['D#1_v3', 'G1_v3', 'D2_v4', 'F2_v3', 'A2_v3', 'C3_v4', 'D4_v1']
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(n): name = n.split('_')[0]; p = NOTE[name[0]] + (1 if '#' in name else 0); return p + (int(name[-1]) + 2) * 12   # VSCO benennt eine Oktave tiefer (gemessen: kein Grundton bei der Namenshöhe)
def rd(p):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-af', 'highpass=f=30,equalizer=f=1100:t=q:w=1.2:g=4,lowpass=f=5200', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
parts, idx, pos = [], [], 0
for k in PICK:
    x = rd(D + 'MOHorn_sus_%s_1.wav' % k)
    a = np.abs(x); on = max(0, int(np.argmax(a > a.max() * 0.03)) - int(0.004 * SR))
    x = x[on:on + 5 * SR]
    x = x / np.abs(x).max()
    x = np.tanh(x * 2.2) / np.tanh(2.2)            # rau, wie ein hart angeblasenes Naturhorn
    fl = int(0.4 * SR); x[-fl:] *= np.linspace(1, 0, fl) ** 2
    rms = np.sqrt(np.mean(x[:2 * SR] ** 2)); x *= 0.25 / rms
    idx.append({'m': midi(k), 's': round(pos / SR, 5), 'l': round(len(x) / SR, 5)})
    parts += [x, np.zeros(int(0.05 * SR))]; pos += len(x) + int(0.05 * SR)
y = np.concatenate(parts); g = min(1.0, 0.99 / np.abs(y).max()); y *= g
os.makedirs(OUT, exist_ok=True)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'flac', '-compression_level', '12', OUT + 'horn.flac'], input=(y * 32767).astype('<i2').tobytes(), check=True)
json.dump({'v': 1, 'sr': SR, 'gain': g, 'notes': idx}, open(OUT + 'horn.json', 'w'), separators=(',', ':'))
print(idx, '%.2f MB' % (os.path.getsize(OUT + 'horn.flac') / 1048576))
