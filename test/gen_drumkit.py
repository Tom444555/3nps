# v99: echte Schlagzeug-Kits bauen (alle CC0): je Kit eine Datei app/www/drums/<kit>.flac (Stereo 48 kHz 16 Bit, alle Schläge
# hintereinander) + <kit>.json (Start/Länge in s je Instrument × 3 Stärken × 2 Varianten).
#   jazz  – „Virtuosity Drums“ (sfzinstruments/virtuosity_drums): Club-/Jazz-Kit, Mittel-Mikrofon + Nahmikros
#   rock  – „Big Rusty Drums“ (sfzinstruments/karoryfer.big-rusty-drums): großes Rock-Kit mit Sticks
#   brush – „Big Rusty Drums“ mit Besen
#   Kuhglocke in allen Kits aus „Swirly Drums“ (sfzinstruments/karoryfer.swirly-drums)
# Quellen ohne Inhalte klonen: git clone --depth 1 --filter=blob:none --no-checkout https://github.com/sfzinstruments/<name> /home/claude/ext/<name>
# Das Skript checkt nur die benötigten Dateien aus. Pegel je Stärke an die Synthese angeglichen (test/drumref.json, RMS der ersten 200 ms).
import json, os, re, subprocess, sys, numpy as np
EXT = '/home/claude/ext/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../app/www/drums/')
REF = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'drumref.json')))
SR, KITG = 48000, 0.6
V, R, W = 'virtuosity_drums', 'karoryfer.big-rusty-drums', 'karoryfer.swirly-drums'
MAXS = {'kick': 0.7, 'snare': 0.7, 'snrim': 0.8, 'rim': 0.35, 'tomh': 1.0, 'tomm': 1.1, 'toml': 1.2, 'hhc': 0.35, 'hhh': 0.7, 'hho': 1.1, 'hhp': 0.35,
        'crash': 2.2, 'ride': 1.5, 'bell': 1.4, 'cowbell': 0.5}
FR = (0.4, 0.7, 0.97)   # gewählte Stärken als Anteil der vorhandenen Stufen
# Eintrag: (Repo, Ordner, Dateiname-Muster mit {v}/{r}, Nahmikro (Ordner-Ersetzung, Faktor) oder None)
COW = (W, 'Samples/cowbell', 'cowbell_vl{v}_rr{r}', None)
KITS = {
 'jazz': {
  'kick': (V, 'Samples/mid/kick', 'mid_kick_snon_vl{v}_rr{r}', ([('/mid/', '/kickmic/'), ('mid_', 'kickmic_')], 0.55)),
  'snare': (V, 'Samples/mid/snare', 'mid_snare_center_vl{v}', ([('/mid/', '/snaremic/'), ('mid_', 'snaremic_')], 0.45)),
  'snrim': (V, 'Samples/mid/snare', 'mid_snare_rimshot_vl{v}', ([('/mid/', '/snaremic/'), ('mid_', 'snaremic_')], 0.45)),
  'rim': (V, 'Samples/mid/snare', 'mid_snare_crossstick_vl{v}', ([('/mid/', '/snaremic/'), ('mid_', 'snaremic_')], 0.4)),
  'tomh': (V, 'Samples/mid/htom', 'mid_htom_center_vl{v}', None),
  'toml': (V, 'Samples/mid/ltom', 'mid_ltom_center_vl{v}', None),
  'hhc': (V, 'Samples/mid/hh', 'mid_hh_closed_vl{v}_rr{r}', None),
  'hhh': (V, 'Samples/mid/hh', 'mid_hh_half_vl{v}_rr{r}', None),
  'hho': (V, 'Samples/mid/hh', 'mid_hh_open_vl{v}_rr{r}', None),
  'hhp': (V, 'Samples/mid/hh', 'mid_hh_pedal_vl{v}_rr{r}', None),
  'crash': (V, 'Samples/mid/crash', 'mid_crash_crash_vl{v}_rr{r}', None),
  'ride': (V, 'Samples/mid/ride', 'mid_ride_ride_vl{v}_rr{r}', None),
  'bell': (V, 'Samples/mid/ride', 'mid_ride_bell_vl{v}_rr{r}', None),
  'cowbell': COW },
 'rock': {
  'kick': (R, 'Samples/kick_24/kick/oh', 'k_vl{v}_rr{r}', ([('/oh/', '/kick/')], 0.7)),
  'snare': (R, 'Samples/snare_14/center/oh', 'sn_center_vl{v}_rr{r}', ([('/oh/', '/top/')], 0.55)),
  'snrim': (R, 'Samples/snare_14/rimshot/oh', 'sn_rims_vl{v}_rr{r}', ([('/oh/', '/top/')], 0.55)),
  'rim': (R, 'Samples/snare_14/sidestick/oh', 'sn_ss_vl{v}_rr{r}', ([('/oh/', '/top/')], 0.55)),
  'tomh': (R, 'Samples/tom_14/center/oh', 't14_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.55)),
  'tomm': (R, 'Samples/tom_15/center/oh', 't15_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.55)),
  'toml': (R, 'Samples/tom_18/center/oh', 't18_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.55)),
  'hhc': (R, 'Samples/hihat_14/cl/oh', 'ht_cl_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.35)),
  'hhh': (R, 'Samples/hihat_14/ho/oh', 'ht_ho_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.35)),
  'hho': (R, 'Samples/hihat_14/open/oh', 'ht_open_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.35)),
  'hhp': (R, 'Samples/hihat_14/chik/oh', 'ht_chik_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.35)),
  'crash': (R, 'Samples/crash_17/cr/oh', 'cr_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.3)),
  'ride': (R, 'Samples/ride_22/rd/oh', 'rd_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.3)),
  'bell': (R, 'Samples/ride_22/bl/oh', 'rd_bl_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.3)),
  'cowbell': COW },
 'brush': {
  'kick': (R, 'Samples/kick_24/kick/oh', 'k_vl{v}_rr{r}', ([('/oh/', '/kick/')], 0.7)),
  'snare': (R, 'Samples/snare_14/brush/oh', 'sn_b_vl{v}_rr{r}', ([('/oh/', '/top/')], 0.55)),
  'rim': (R, 'Samples/snare_14/sidestick/oh', 'sn_ss_vl{v}_rr{r}', ([('/oh/', '/top/')], 0.55)),
  'tomh': (R, 'Samples/tom_14/brush/oh', 't14_b_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.55)),
  'tomm': (R, 'Samples/tom_15/brush/oh', 't15_b_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.55)),
  'toml': (R, 'Samples/tom_18/brush/oh', 't18_b_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.55)),
  'hhc': (R, 'Samples/hihat_14/cl_brush/oh', 'ht_cl_b_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.35)),
  'hhh': (R, 'Samples/hihat_14/ho_brush/oh', 'ht_ho_b_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.35)),
  'hho': (R, 'Samples/hihat_14/open_brush/oh', 'ht_open_b_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.35)),
  'hhp': (R, 'Samples/hihat_14/chik/oh', 'ht_chik_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.35)),
  'crash': (R, 'Samples/crash_17/brush/oh', 'cr_b_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.3)),
  'ride': (R, 'Samples/ride_22/brush/oh', 'rd_b_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.3)),
  'bell': (R, 'Samples/ride_22/bl/oh', 'rd_bl_vl{v}_rr{r}', ([('/oh/', '/cl/')], 0.3)),
  'cowbell': COW },
}
ONE = {'crash', 'hho'}
def cpath(f, close):
    d, n = f.rsplit('/', 1)
    for a, b in close[0]: d = d.replace(a.rstrip('/'), b.rstrip('/')) if a.startswith('/') else d; n = n.replace(a, b, 1) if not a.startswith('/') else n
    return d + '/' + n   # nur eine Variante (lange Ausklänge, spart Platz)
_tree = {}
def tree(repo):
    if repo not in _tree: _tree[repo] = subprocess.run(['git', '-C', EXT + repo, 'ls-tree', '-r', '--name-only', 'HEAD'], capture_output=True, text=True, check=True).stdout.split('\n')
    return _tree[repo]
def pick(id, spec):
    repo, d, pat, close = spec
    rx = re.compile('^' + re.escape(d) + '/' + re.escape(pat).replace(r'\{v\}', r'(\d+)').replace(r'\{r\}', r'(\d+)') + r'\.(flac|wav)$')
    files = {}
    for f in tree(repo):
        m = rx.match(f)
        if m: files.setdefault(int(m.group(1)), {})[int(m.group(2)) if '{r}' in pat else 1] = f
    lv = sorted(files)
    if not lv: sys.exit('keine Dateien: %s %s %s' % (repo, d, pat))
    out = []
    for fr in FR:
        k = min(len(lv) - 1, max(0, round(fr * (len(lv) - 1))))
        rr = files[lv[k]]
        if len(rr) >= 2 and '{r}' in pat: row = [rr[x] for x in sorted(rr)[:2]]
        else: row = [rr[min(rr)]] + ([files[lv[k - 1]][min(files[lv[k - 1]])]] if k > 0 else [])
        out.append(row[:1] if id in ONE else row[:2])
    return out
def rd(p):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)
def hit(id, spec, f):
    repo, d, pat, close = spec
    x = rd(EXT + repo + '/' + f)
    if close:
        c = rd(EXT + repo + '/' + cpath(f, close)); n = min(len(x), len(c)); x = x[:n] + c[:n].mean(1, keepdims=True) * close[1]
    a = np.abs(x).max(1); pk = a.max(); on = int(np.argmax(a > pk * 0.02)); on = max(0, on - int(0.0015 * SR))
    x = x[on:on + int(MAXS[id] * SR)].copy()
    fl = min(len(x), int(0.25 * SR if MAXS[id] > 0.8 else 0.06 * SR)); x[-fl:] *= np.linspace(1, 0, fl)[:, None] ** 2
    return x
def need(kits):   # alle benötigten Dateien auschecken (nur diese)
    by = {}
    for kit in kits:
        for id, spec in KITS[kit].items():
            for row in pick(id, spec):
                for f in row:
                    by.setdefault(spec[0], set()).add(f)
                    if spec[3]: by[spec[0]].add(cpath(f, spec[3]))
    for repo, fs in by.items():
        miss = [f for f in sorted(fs) if not os.path.exists(EXT + repo + '/' + f)]
        for i in range(0, len(miss), 200): subprocess.run(['git', '-C', EXT + repo, 'checkout', 'HEAD', '--'] + miss[i:i + 200], check=True, capture_output=True)
def build(kit):
    idx, parts, pos = {}, [], 0
    gap = np.zeros((int(0.02 * SR), 2))
    for id, spec in KITS[kit].items():
        idx[id] = []
        for L, files in enumerate(pick(id, spec)):
            hs = [hit(id, spec, f) for f in files]
            rms = np.mean([np.sqrt(np.mean(h[:int(0.2 * SR)].mean(1) ** 2)) for h in hs]); g = REF[id][L][0] / max(rms, 1e-9) * KITG
            hs = [h * g for h in hs]
            row = []
            for h in hs: row.append([round(pos / SR, 5), round(len(h) / SR, 5)]); parts += [h, gap]; pos += len(h) + len(gap)
            idx[id].append(row)
    y = np.concatenate(parts); pk = np.abs(y).max(); gain = min(1.0, 0.99 / pk); y = y * gain
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'flac', '-compression_level', '12', OUT + kit + '.flac'], input=pcm, check=True)
    json.dump({'v': 2, 'sr': SR, 'gain': float(gain), 'hits': idx}, open(OUT + kit + '.json', 'w'), separators=(',', ':'))
    print('%-6s %5.1f s  %.2f MB  %s' % (kit, len(y) / SR, os.path.getsize(OUT + kit + '.flac') / 1048576, ' '.join(idx)))
if __name__ == '__main__':
    kits = sys.argv[1:] or list(KITS)
    os.makedirs(OUT, exist_ok=True); need(kits)
    for k in kits: build(k)
