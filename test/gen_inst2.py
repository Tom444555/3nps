# Studio v123: drei weitere Sampler-Instrumente (gleiches Dateiformat wie gen_inst.py: inst/<id>.flac + .json).
#  ebass  = karoryfer.fashionbass (CC0), je Stützpunkt *_mf_rr1.wav            https://github.com/sfzinstruments/karoryfer.fashionbass
#  guitar = Discord-SFZ-GM-Bank 026 Acoustic Guitar (steel), Martin HD28, Jeff Learman (CC0)   https://github.com/sfzinstruments/Discord-SFZ-GM-Bank
#  wurli  = GregSullivan.E-Pianos Wurlitzer EP200 (CC BY 3.0, Greg Sullivan), Schichten mp (0) und f (1), Tune aus der .sfz   https://github.com/sfzinstruments/GregSullivan.E-Pianos
# Quellen liegen unter /home/claude/ext/ (git clone --depth 1). Tonhöhe wird zusätzlich per YIN gemessen und gemeldet.
import json, os, re, glob, subprocess, sys, numpy as np
E = '/home/claude/ext/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../app/www/inst/')
SR = 44100
NOTE = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
def nm(s):   # gb0 → 18 (C0 = 12, wie die SFZ-Schlüsselzentren der Quelle)
    m = re.match(r'([a-g])(b?)(\d)', s); return NOTE[m.group(1)] + (-1 if m.group(2) else 0) + (int(m.group(3)) + 1) * 12
def rd(p):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
def f0(x):
    W = 4096; x = x[:W * 3]
    if len(x) < W * 3: x = np.concatenate([x, np.zeros(W * 3 - len(x))])
    lo, hi = int(SR / 2500), int(SR / 25); N = int(W * 1.5); a = x[:N]; e0 = np.sum(a * a)
    cc = np.fft.irfft(np.fft.rfft(a, 8 * W).conj() * np.fft.rfft(x, 8 * W))[:hi + 2]
    e = np.array([np.sum(x[t:t + N] ** 2) for t in range(hi + 2)]); d = e0 + e - 2 * cc; d[0] = 0
    cm = d[1:] * np.arange(1, len(d)) / (np.cumsum(d[1:]) + 1e-12); cm = np.concatenate([[1], cm]); k = None
    for t in range(lo, hi):
        if cm[t] < 0.12:
            while t + 1 < hi and cm[t + 1] < cm[t]: t += 1
            k = t; break
    if k is None: k = lo + int(np.argmin(cm[lo:hi]))
    a1, b1, c1 = cm[k - 1], cm[k], cm[k + 1]; den = a1 - 2 * b1 + c1; p = k + 0.5 * (a1 - c1) / den if den > 0 else k
    if not (k - 1 <= p <= k + 1): p = k
    return SR / p
def onset(x):
    a = np.abs(x); return max(0, int(np.argmax(a > a.max() * 0.02)) - int(0.003 * SR))
def sources(iid):   # → [(Schlüsselzentrum, Tune-Cent aus SFZ, Datei, Schicht)]
    out = []
    if iid == 'ebass':
        for f in sorted(glob.glob(E + 'karoryfer.fashionbass/notes/*_mf_rr1.wav')): out.append((nm(os.path.basename(f).split('_')[0]), 0, f, None))
    elif iid == 'guitar':
        for f in sorted(glob.glob(E + 'gm/Discord GM/Melodic/026-Acoustic Guitar (steel)/MartinGM2_*.wav')): out.append((int(re.search(r'MartinGM2_(\d+)', f).group(1)), 0, f, None))
    else:
        t = open(E + 'gregsullivan.e-pianos/Wurlitzer EP200/Wurlitzer EP200.sfz').read()
        for grp in re.split(r'<group>', t)[1:]:
            lay = {'mp': 0, 'f': 1}.get(re.search(r'group_label=(\w+)', grp).group(1))
            if lay is None: continue
            for r in re.findall(r'<region>(.*?)(?=<region>|$)', grp, re.S):
                kc = int(re.search(r'pitch_keycenter=(\d+)', r).group(1)); sm = re.search(r'sample=(\w+)\.\$EXT', r).group(1); tu = re.search(r'tune=(-?\d+)', r)
                out.append((kc, int(tu.group(1)) if tu else 0, E + 'gregsullivan.e-pianos/Wurlitzer EP200/Samples/' + sm + '.flac', lay))
    return out
CFG = {'ebass': (5.0, 0.5), 'guitar': (6.0, 0.8), 'wurli': (4.0, 0.5)}   # Länge s, Ausklang-Fade s
def make(iid):
    L, tail = CFG[iid]; notes, parts, pos = [], [], 0; seen = {}
    for kc, tune, f, lay in sources(iid):
        key = (f, kc, lay)
        if key in seen: continue
        seen[key] = 1
        x = rd(f); x = x[onset(x):]; fr = f0(x[int(0.15 * SR):] if len(x) > SR else x)
        mm = 69 + 12 * np.log2(fr / 440)
        # Korrektur c = tatsächliche Abweichung des Samples vom Schlüsselzentrum (Cent), wie in inst.js (m + c/100).
        # Wurlitzer: SFZ-Tune verschiebt beim Spielen, also ist die Sample-Abweichung -tune. Sonst gemessen (YIN), wenn plausibel (<= 30 ct), sonst 0.
        if iid == 'wurli': c = float(-tune)
        else: c = round(float((mm - kc) * 100), 1) if abs(mm - kc) <= 0.30 else 0.0
        dev = (mm - (kc + c / 100)) * 100
        print('  %-26s kc %3d tune %4d  gemessen %.2f  c %+.1f  Rest %+.0f ct' % (os.path.basename(f), kc, tune, mm, c, dev))
        n = int(L * SR); y = x[:n].copy()
        if len(y) < n: y = np.concatenate([y, np.zeros(n - len(y))])
        ft = int(tail * SR); y[-ft:] *= np.linspace(1, 0, ft) ** 2
        rms = np.sqrt(np.mean(y[:SR] ** 2)) + 1e-9; y *= 0.18 / rms
        e = {'m': int(kc), 'c': round(c, 1)}
        if lay is not None: e['v'] = lay
        e['s'] = round(pos / SR, 5); e['l'] = round(len(y) / SR, 5); notes.append(e)
        parts += [y, np.zeros(int(0.02 * SR))]; pos += len(y) + int(0.02 * SR)
    yy = np.concatenate(parts); g = min(1.0, 0.99 / np.abs(yy).max()); yy *= g
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'flac', '-compression_level', '12', OUT + iid + '.flac'], input=(yy * 32767).astype('<i2').tobytes(), check=True)
    j = {'v': 1, 'sr': SR, 'ch': 1, 'gain': g, 'loop': False, 'notes': notes}
    if iid == 'wurli': j['vel'] = True
    json.dump(j, open(OUT + iid + '.json', 'w'), separators=(',', ':'))
    print(iid, len(notes), 'Töne', '%.2f MB' % (os.path.getsize(OUT + iid + '.flac') / 1048576))
for k in (sys.argv[1:] or CFG): make(k)
