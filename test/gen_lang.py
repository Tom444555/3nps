# v85: 7:42 langes Testlied (ballad_72 elfmal hintereinander) – früher bei 6 Minuten abgeschnitten
import wave, numpy as np, os
D = os.path.dirname(os.path.abspath(__file__))
w = wave.open(D + '/corpus/ballad_72.wav'); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16)
o = wave.open(D + '/sing/lang_462s.wav', 'w'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes(np.tile(x, 11).tobytes()); o.close()
print(len(x) * 11 / sr)
