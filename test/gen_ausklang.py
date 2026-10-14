# v75: Testdatei mit leisem Ausklang (ballad_72 + 5 s ausklingender Schlussakkord) – darf beim Laden nicht abgeschnitten werden
import wave, numpy as np, os
D = os.path.dirname(os.path.abspath(__file__))
w = wave.open(D + '/corpus/ballad_72.wav'); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
t = np.arange(int(5 * sr)) / sr; tail = (np.sin(2 * np.pi * 220 * t) + 0.5 * np.sin(2 * np.pi * 330 * t)) * 0.05 * np.exp(-t * 0.8)
y = np.concatenate([x, tail]); y = y / np.abs(y).max() * 0.9
o = wave.open(D + '/sing/ausklang.wav', 'w'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((y * 32767).astype(np.int16).tobytes()); o.close()
print(len(y) / sr)
