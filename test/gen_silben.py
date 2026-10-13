# v72: Testdatei für die Stimmkurve – ballad_72.wav plus gesangsähnliche Silben (220 Hz mit Obertönen) an bekannten Zeiten
import wave, numpy as np, json
w = wave.open(__import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/corpus/ballad_72.wav'); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
T = [round(10.0 + k * 0.55 + (0.12 if k % 3 == 1 else 0), 3) for k in range(24)]   # 10 s … ~23 s, unregelmäßig
y = x * 0.5
for i, t in enumerate(T):
    n = int(0.3 * sr); tt = np.arange(n) / sr; f0 = 220 * (1 + 0.1 * (i % 4))
    s = sum(np.sin(2 * np.pi * f0 * h * tt) * (1.0 if 2 <= h <= 6 else 0.4) / h ** 0.5 for h in range(1, 12))
    env = np.minimum(1, tt / 0.012) * np.exp(-tt * 4)
    a = int(t * sr); y[a:a + n] += 0.35 * s * env / np.abs(s).max()
y = y / np.abs(y).max() * 0.9
o = wave.open(__import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/sing/silben.wav', 'w'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((y * 32767).astype(np.int16).tobytes()); o.close()
json.dump(T, open(__import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/sing/silben.json', 'w'))
print(len(T), T[:5])
