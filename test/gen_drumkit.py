# v98: echtes Schlagzeug – kleines Paket aus „Virtuosity Drums“ (sfzinstruments, CC0) bauen.
# Quelle: git clone --filter=blob:none --no-checkout https://github.com/sfzinstruments/virtuosity_drums /home/claude/ext/virtuosity_drums
# und die nötigen Dateien auschecken (Liste: KIT unten). Ergebnis: app/www/drums/kit.flac (Stereo 48 kHz 16 Bit, alle Schläge
# hintereinander) + kit.json (Startzeit/Länge in Sekunden je Instrument × 3 Stärken × Varianten).
# Mischung: Mittel-Mikrofon (Stereo) + Nahmikrofon für Kick/Snare/Rim; Pegel je Stärke an die bisherige Synthese angeglichen.
import json, os, subprocess, numpy as np
S = '/home/claude/ext/virtuosity_drums/Samples/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../app/www/drums/')
REF = json.load(open('/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/synthref.json')) if os.path.exists('/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/synthref.json') else None
SR = 48000
KITG = 0.6
KIT = {
 'kick':  [[f'kick/{{m}}_kick_snon_vl{v}_rr{r}.flac' for r in (1, 2)] for v in (2, 3, 4)],
 'snare': [[f'snare/{{m}}_snare_center_vl{v}.flac' for v in p] for p in ((10, 11), (22, 23), (34, 35))],
 'rim':   [[f'snare/{{m}}_snare_crossstick_vl{v}.flac' for v in p] for p in ((5, 6), (10, 11), (15, 16))],
 'tomh':  [[f'htom/{{m}}_htom_center_vl{v}.flac' for v in p] for p in ((5, 6), (10, 11), (15, 16))],
 'toml':  [[f'ltom/{{m}}_ltom_center_vl{v}.flac' for v in p] for p in ((5, 6), (10, 11), (15, 16))],
 'hhc':   [[f'hh/{{m}}_hh_closed_vl{v}_rr{r}.flac' for r in (1, 2)] for v in (2, 3, 4)],
 'hho':   [[f'hh/{{m}}_hh_open_vl{v}_rr1.flac'] for v in (2, 3, 4)],
 'hhp':   [[f'hh/{{m}}_hh_pedal_vl{v}_rr{r}.flac' for r in (1, 2)] for v in (1, 2, 3)],
 'crash': [[f'crash/{{m}}_crash_crash_vl{v}_rr1.flac'] for v in (1, 2, 3)],
 'ride':  [[f'ride/{{m}}_ride_ride_vl{v}_rr{r}.flac' for r in (1, 2)] for v in (1, 2, 3)],
}
MAXS = {'kick': 0.7, 'snare': 0.7, 'rim': 0.35, 'tomh': 1.0, 'toml': 1.1, 'hhc': 0.35, 'hho': 1.1, 'hhp': 0.35, 'crash': 2.2, 'ride': 1.5}
CLOSE = {'kick': ('kickmic', 0.55), 'snare': ('snaremic', 0.45), 'rim': ('snaremic', 0.4)}
def rd(p):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)
def hit(id, f):
    x = rd(S + 'mid/' + f.format(m='mid'))
    if id in CLOSE:
        m, g = CLOSE[id]; c = rd(S + m + '/' + f.format(m=m)); n = min(len(x), len(c)); x = x[:n] + c[:n].mean(1, keepdims=True) * g
    a = np.abs(x).max(1); pk = a.max(); on = int(np.argmax(a > pk * 0.02)); on = max(0, on - int(0.0015 * SR))   # Einsatz, 1,5 ms Vorlauf
    x = x[on:on + int(MAXS[id] * SR)]
    fl = min(len(x), int(0.25 * SR if MAXS[id] > 0.8 else 0.06 * SR)); x[-fl:] *= np.linspace(1, 0, fl)[:, None] ** 2
    return x
idx, parts, pos = {}, [], 0.0
gap = np.zeros((int(0.02 * SR), 2))
for id, layers in KIT.items():
    idx[id] = []
    for L, files in enumerate(layers):
        hs = [hit(id, f) for f in files]
        if REF:   # Pegel wie die bisherige Synthese (RMS der ersten 200 ms, Mittelsignal)
            rms = np.mean([np.sqrt(np.mean(h[:int(0.2 * SR)].mean(1) ** 2)) for h in hs]); g = REF[id][L][0] / max(rms, 1e-9)
            hs = [h * g * KITG for h in hs]   # KITG: ganzes Kit gleich leiser – Balance bleibt, Spitzen ≤ ~2
            hp = max(np.abs(h).max() for h in hs)
            print(id, L, 'Spitze %.2f' % hp)
        row = []
        for h in hs:
            row.append([round(pos / SR, 5), round(len(h) / SR, 5)]); parts += [h, gap]; pos += len(h) + len(gap)
        idx[id].append(row)
y = np.concatenate(parts); pk = np.abs(y).max()
if pk > 0.99: y *= 0.99 / pk; print('global gain', 0.99 / pk)
os.makedirs(OUT, exist_ok=True)
pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'flac', '-compression_level', '12', OUT + 'kit.flac'], input=pcm, check=True)
json.dump({'v': 1, 'sr': SR, 'gain': float(min(1, 0.99 / pk)), 'hits': idx}, open(OUT + 'kit.json', 'w'), separators=(',', ':'))
print('Länge %.1f s, %.2f MB' % (len(y) / SR, os.path.getsize(OUT + 'kit.flac') / 1048576))
