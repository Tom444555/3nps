# Studio S3: Instrumente aus VSCO-2 CE (Versilian Studios; „für jeden Zweck“, CC0-Community-Edition) für das Studio.
# Quelle: git clone --depth 1 --filter=blob:none --no-checkout https://github.com/sgossner/VSCO-2-CE /home/claude/ext/vsco
#         git -C /home/claude/ext/vsco checkout HEAD -- "Keys/Upright Piano" "Strings/Violin Section/susVib" "Strings/Cello Section/susvib" \
#            "Brass/Trumpet/sus" "Woodwinds/Flute/susvib" "Keys/Organ" "Strings/Harp" "Percussion/Marimba" "Strings/Solo Contrabass/Pizz" "Brass/F Horn/sus"
# Je Instrument eine FLAC-Datei (Töne hintereinander) + JSON {sr, ch, gain, loop, notes:[{m, c (Cent-Korrektur), s, l, ls, le}]}.
# Tonhöhe wird gemessen (VSCO-Namen liegen teils eine Oktave daneben); gehaltene Töne bekommen eine nahtlose Schleife.
import json, os, re, glob, subprocess, sys, numpy as np
V = '/home/claude/ext/vsco/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../app/www/inst/')
SR = 44100
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
PIANO = {int(a): int(b) for a, b in re.findall(r'(\d{3})=(\d+)', open(V + 'Keys/Upright Piano/MappingChart.txt').read())}
def name_midi(s):
    pm = re.search(r'Player_dyn\d_rr\d_(\d{3})', s)
    if pm: return PIANO.get(int(pm.group(1)))
    m = re.search(r'(?<![A-Za-z])([A-G])(#|b)?(-?\d)(?!\d)', s)
    if not m: return None
    return NOTE[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0) + (int(m.group(3)) + 1) * 12
def rd(p, ch):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64).reshape(-1, ch)
def f0(x):
    # YIN (kumulierte mittlere normierte Differenz), 25–2500 Hz
    W = 4096; x = x[:W * 3]
    if len(x) < W * 3: x = np.concatenate([x, np.zeros(W * 3 - len(x))])
    lo, hi = int(SR / 2500), int(SR / 25)
    fx = np.fft.rfft(x, 4 * W * 2)
    # d(t) = sum (x[j]-x[j+t])^2 über j<W*1.5 → per FFT-Kreuzkorrelation
    N = int(W * 1.5); a = x[:N]; e0 = np.sum(a * a)
    cc = np.fft.irfft(np.fft.rfft(a, 8 * W) .conj() * np.fft.rfft(x, 8 * W))[:hi + 2]
    e = np.array([np.sum(x[t:t + N] ** 2) for t in range(hi + 2)])
    d = e0 + e - 2 * cc; d[0] = 0
    cm = d[1:] * np.arange(1, len(d)) / (np.cumsum(d[1:]) + 1e-12); cm = np.concatenate([[1], cm])
    k = None
    for t in range(lo, hi):
        if cm[t] < 0.12:
            while t + 1 < hi and cm[t + 1] < cm[t]: t += 1
            k = t; break
    if k is None: k = lo + int(np.argmin(cm[lo:hi]))
    a1, b1, c1 = cm[k - 1], cm[k], cm[k + 1]; den = a1 - 2 * b1 + c1; p = k + 0.5 * (a1 - c1) / den if den > 0 else k
    if not (k - 1 <= p <= k + 1): p = k
    return SR / p
def onset(x):
    a = np.abs(x).max(1); return max(0, int(np.argmax(a > a.max() * 0.02)) - int(0.003 * SR))
INST = {
  # id: (Ordner/Muster, Kanäle, Länge s, Schleife (ls, le) oder None, Abstand Halbtöne, Bereich, Ausklang s)
  'piano':   ('Keys/Upright Piano/Player_dyn2_rr1_*.wav', 2, 4.5, None, 4, (21, 108), 0.5),
  'strings': ('Strings/Violin Section/susVib/VlnEns_susVib_*_v2.wav|Strings/Cello Section/susvib/susvib_*_v3_1.wav', 2, 3.2, (1.2, 3.0), 3, (36, 100), 0),
  'brass':   ('Brass/Trumpet/sus/Sum_SHTrumpet_sus_*_v3_rr1.wav|Brass/F Horn/sus/MOHorn_sus_*_v3_1.wav', 1, 3.0, (1.0, 2.8), 3, (34, 86), 0),
  'flute':   ('Woodwinds/Flute/susvib/LDFlute_susvib_*_v1_1.wav', 1, 3.0, (1.0, 2.8), 3, (59, 98), 0),
  'organ':   ('Keys/Organ/Loud/Rode_Man3Open_*.wav', 1, 2.6, (0.8, 2.4), 3, (36, 96), 0),
  'harp':    ('Strings/Harp/KSHarp_*_mf.wav', 1, 3.5, None, 3, (28, 103), 0.4),
  'marimba': ('Percussion/Marimba/Marimba_hit_Outrigger_*_loud_01.wav', 1, 2.0, None, 3, (41, 96), 0.3),
  'kbass':   ('Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_*_v1_rr1.wav', 1, 2.2, None, 3, (24, 60), 0.3),
}
CROSS = 0.35
def make(iid):
    pat, ch, L, loop, step, (lo, hi), tail = INST[iid]
    files = sorted(sum([glob.glob(V + p) for p in pat.split('|')], []))
    raw = []
    for f in files:
        x = rd(f, ch); o = onset(x); x = x[o:]
        if len(x) < SR * 0.5: continue
        mono = x.mean(1); fr = f0(mono[int(0.15 * SR):] if len(mono) > SR else mono)
        raw.append((f, x, 69 + 12 * np.log2(fr / 440) if fr > 0 else np.nan, name_midi(os.path.basename(f))))
    # Oktav-Versatz der Namen je Ordner: Mehrheit der sicher gemessenen Töne entscheidet (einzelne Messungen irren bei tiefen Tönen)
    off = {}
    for f, x, mm, nm in raw:
        if nm is None or not np.isfinite(mm): continue
        k = int(round((mm - nm) / 12)) * 12
        if abs(mm - nm - k) < 0.5: off.setdefault(os.path.dirname(f), []).append(k)
    off = {d: max(set(v), key=v.count) for d, v in off.items()}
    cand = []
    for f, x, mm, nm in raw:
        if 'Player_dyn' in f and nm is not None: best = nm                    # Klavier: Zuordnung laut MappingChart
        elif nm is not None: best = nm + off.get(os.path.dirname(f), 0)
        elif np.isfinite(mm): best = int(round(mm))
        else: continue
        cents = (mm - best) * 100 if np.isfinite(mm) and abs(mm - best) < 0.5 else 0
        if np.isfinite(mm) and abs(mm - best) >= 0.5 and nm is not None: print('  ? ', os.path.basename(f), 'gemessen %.2f, gesetzt %d' % (mm, best))
        cand.append((best, cents, f, x))
    cand.sort(key=lambda c: c[0])
    # gleichmäßig über den Bereich verteilt (je Ton der nächstgelegene Kandidat, keine Dopplungen)
    pick, used = [], set()
    for t in range(lo, hi + 1, step):
        c = min(cand, key=lambda c: abs(c[0] - t))
        if abs(c[0] - t) <= step and c[2] not in used: used.add(c[2]); pick.append(c)
    parts, notes, pos = [], [], 0
    for m, cents, f, x in pick:
        n = int(L * SR); y = x[:n].copy()
        if len(y) < n: y = np.vstack([y, np.zeros((n - len(y), ch))])
        e = {'m': int(m), 'c': round(float(np.clip(cents, -50, 50)), 1)}
        if loop:
            ls, le, c = int(loop[0] * SR), int(loop[1] * SR), int(CROSS * SR)
            w = np.linspace(0, 1, c)[:, None]
            y[le - c:le] = y[le - c:le] * np.sqrt(1 - w) + x[ls - c:ls] * np.sqrt(w)
            y = y[:le]; e['ls'] = round(ls / SR, 5); e['le'] = round(le / SR, 5)
        else:
            ft = int(tail * SR); y[-ft:] *= np.linspace(1, 0, ft)[:, None] ** 2
        rms = np.sqrt(np.mean(y[:int(min(len(y), SR)) ] ** 2)) + 1e-9; y *= 0.18 / rms
        e['s'] = round(pos / SR, 5); e['l'] = round(len(y) / SR, 5)
        notes.append(e); gap = int(0.02 * SR); parts += [y, np.zeros((gap, ch))]; pos += len(y) + gap
    yy = np.vstack(parts); g = min(1.0, 0.99 / np.abs(yy).max()); yy *= g
    os.makedirs(OUT, exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', str(ch), '-i', '-', '-c:a', 'flac', '-compression_level', '12', OUT + iid + '.flac'], input=(yy * 32767).astype('<i2').tobytes(), check=True)
    json.dump({'v': 1, 'sr': SR, 'ch': ch, 'gain': g, 'loop': bool(loop), 'notes': notes}, open(OUT + iid + '.json', 'w'), separators=(',', ':'))
    print(iid, len(notes), 'Töne', [n['m'] for n in notes], '%.2f MB' % (os.path.getsize(OUT + iid + '.flac') / 1048576))
for k in (sys.argv[1:] or INST): make(k)
