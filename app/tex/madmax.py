import numpy as np
from PIL import Image, ImageDraw, ImageFilter
N = 2048
rng = np.random.default_rng(42)
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)

def noise(beta, seed, scale=1.0, aniso=(1, 1)):
    r = np.random.default_rng(seed)
    f = np.fft.fftfreq(N) * (N / 640) * scale
    fx, fy = np.meshgrid(f, f)
    k = np.sqrt((fx * aniso[0]) ** 2 + (fy * aniso[1]) ** 2); k[0, 0] = 1
    spec = (r.normal(size=(N, N)) + 1j * r.normal(size=(N, N))) / k ** beta
    spec[0, 0] = 0
    n = np.real(np.fft.ifft2(spec)).astype(np.float32)
    return (n - n.mean()) / n.std()

def blur(a, s):
    f = np.fft.fftfreq(N); fx, fy = np.meshgrid(f, f)
    g = np.exp(-2 * (np.pi * s) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g)).astype(np.float32)

def wrapdist(a, b):
    d = np.abs(a - b); return np.minimum(d, N - d)

# ---------- Plattenaufteilung (kachelbar) ----------
rows = [0, 760, 1380]                      # horizontale Nähte (y)
seams_v = {0: [330, 1420], 1: [940, 1880], 2: [180, 1150]}   # senkrechte Nähte je Reihe
row_of = np.zeros((N, N), np.int32)
for i, y0 in enumerate(rows):
    row_of[yy >= y0] = i
dh = np.full((N, N), 1e9, np.float32)
for y0 in rows: dh = np.minimum(dh, wrapdist(yy, y0))
dv = np.full((N, N), 1e9, np.float32)
for r, xs in seams_v.items():
    m = row_of == r
    for x0 in xs:
        d = wrapdist(xx, x0); dv = np.where(m, np.minimum(dv, d), dv)
dseam = np.minimum(dh, dv)
# Plattennummer (für Tönung/Ausrichtung)
plate = np.zeros((N, N), np.int32)
for r, xs in seams_v.items():
    m = row_of == r
    idx = np.zeros((N, N), np.int32)
    for j, x0 in enumerate(sorted(xs)): idx += (xx >= x0)
    idx = idx % len(xs)
    plate = np.where(m, r * 3 + idx, plate)
nplates = plate.max() + 1
ptone = rng.uniform(-1, 1, nplates).astype(np.float32)
pbrush = rng.integers(0, 2, nplates)       # 0 = horizontal, 1 = vertikal gebürstet

# ---------- Höhenkarte ----------
H = np.zeros((N, N), np.float32)
H += 0.9 * noise(2.2, 1)                   # Beulen
H += 0.15 * noise(1.2, 2)
# Nahtfugen
H += 2.6 * (1 - np.exp(-dseam / 26))
H -= 3.4 * np.exp(-(dseam / 3.2) ** 2)
H += 0.8 * np.exp(-((dseam - 7) / 4) ** 2)   # leicht aufgeworfene Kante
# Schweißraupen auf einigen Nähten (horizontal Reihe 1, senkrecht Reihe 2)
bead = np.zeros((N, N), np.float32)
img = Image.new('F', (N, N), 0); dr = ImageDraw.Draw(img)
def blob(cx, cy, rx, ry, v):
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            dr.ellipse([cx - rx + ox, cy - ry + oy, cx + rx + ox, cy + ry + oy], fill=v)
y0 = rows[1]
for x in range(0, N, 5):
    blob(x, y0 + rng.normal(0, 1.6), 12, 8, 1.0)
for x0 in seams_v[2]:
    for y in range(rows[2], N, 5): blob(x0 + rng.normal(0, 1.6), y, 8, 12, 1.0)
bead = blur(np.array(img, np.float32), 1.6)
ripple = 0.5 + 0.5 * np.sin((xx + yy) * 2 * np.pi / 5.0)
bead *= (1 + 0.35 * noise(0.6, 3))
H += 4.2 * bead * (0.85 + 0.25 * ripple)
# Nieten entlang der übrigen Nähte
riv = Image.new('F', (N, N), 0); dr2 = ImageDraw.Draw(riv)
rivets = []
for y0 in (rows[0], rows[2]):
    for x in range(20, N, 64):
        for off in (-16, 16): rivets.append((x, y0 + off))
for r, xs in seams_v.items():
    if r == 2: continue
    ya, yb = rows[r], (rows[r + 1] if r + 1 < len(rows) else N)
    for x0 in xs:
        for y in range(ya + 40, yb - 20, 64):
            for off in (-16, 16): rivets.append((x0 + off, y))
R = 8
k = np.mgrid[-R:R + 1, -R:R + 1]; dome = np.sqrt(np.clip(R * R - (k[0] ** 2 + k[1] ** 2), 0, None)).astype(np.float32)
riv = np.zeros((N, N), np.float32)
for (cx, cy) in rivets:
    ys = (np.arange(-R, R + 1) + int(cy)) % N; xs_ = (np.arange(-R, R + 1) + int(cx)) % N
    riv[np.ix_(ys, xs_)] = np.maximum(riv[np.ix_(ys, xs_)], dome * rng.uniform(0.8, 1.1))
H += 0.75 * riv
rivmask = (riv > 0.1).astype(np.float32)
# Kratzer
scr = Image.new('F', (N, N), 0); ds = ImageDraw.Draw(scr)
for _ in range(520):
    x, y = rng.uniform(0, N, 2); L = rng.uniform(20, 260)
    ang = rng.normal(0, 0.35) + (np.pi / 2 if rng.random() < 0.3 else 0)
    w = 1
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            ds.line([x + ox, y + oy, x + ox + L * np.cos(ang), y + oy + L * np.sin(ang)], fill=rng.uniform(0.4, 1.0), width=w)
scr = blur(np.array(scr, np.float32), 0.6)
H -= 0.9 * scr

# ---------- Rost ----------
big = noise(1.75, 11); mid = noise(1.3, 12); fine = noise(0.55, 13)
near = np.exp(-dseam / 55) + 0.6 * blur(rivmask, 14) * 3
rustv = 0.55 * big + 0.35 * mid + 1.1 * near - 0.15
rust = np.clip((rustv - 0.2) * 1.4, 0, 1) ** 1.1
# Laufspuren nach unten
run = np.zeros_like(rust); acc = np.zeros(N, np.float32)
for y in range(-200, N):
    acc = np.maximum(acc * 0.992, rust[y % N] * 0.9); run[y % N] = acc
drip = np.clip(noise(1.3, 14, aniso=(7, 0.5)) * 0.6 + 0.15, 0, 1)
rust = np.clip(np.maximum(rust, run * 0.55 * drip), 0, 1)
heavy = np.clip((rustv - 0.85) * 1.6, 0, 1)
flake = noise(0.8, 17)
layers_ = np.floor(np.clip(rust * 3 + 0.6 * flake, 0, 4))      # terrassierte Rostschichten
H += 0.9 * blur(layers_, 0.7) * rust + 0.5 * rust * fine + 0.8 * heavy * np.clip(noise(0.9, 15), 0, None)
pits = np.clip((noise(0.25, 16) - 1.9) * 2.5, 0, 1) * (0.3 + rust)
H -= 1.6 * pits

# ---------- Farbe (Albedo) ----------
tone = ptone[plate]
steelA = np.array([92, 92, 96], np.float32); steelB = np.array([64, 62, 63], np.float32)
t = np.clip(0.5 + 0.25 * noise(1.5, 20) + 0.18 * tone, 0, 1)
alb = steelA * (1 - t)[..., None] + steelB * t[..., None]
# Bürstspuren (je Platte horizontal oder vertikal)
bh = noise(1.0, 21, aniso=(0.05, 8)); bv = noise(1.0, 22, aniso=(8, 0.05))
br = np.where(pbrush[plate] == 0, bh, bv)
alb *= (1 + 0.07 * br)[..., None]
# Hitzeanlauf an Schweißnähten (bläulich-gold)
heat = np.exp(-dseam / 22) * (bead > 0.02).astype(np.float32)
heat = blur(np.clip(bead * 3, 0, 1), 10)
alb = alb * (1 - 0.5 * heat[..., None]) + np.array([70, 62, 80], np.float32) * 0.5 * heat[..., None]
# Ölflecken
oil = np.clip(noise(2.0, 23) - 1.5, 0, 1) * 0.35
alb *= (1 - oil)[..., None]
u = np.clip(0.5 + 0.35 * mid, 0, 1)
rc = np.array([120, 52, 20], np.float32) * (1 - u)[..., None] + np.array([176, 88, 34], np.float32) * u[..., None]
rc = rc * (1 - 0.65 * heavy[..., None]) + np.array([62, 26, 13], np.float32) * 0.65 * heavy[..., None]
ochre = np.clip(flake - 0.9, 0, 1) * rust
rc = rc * (1 - 0.5 * ochre[..., None]) + np.array([196, 128, 52], np.float32) * 0.5 * ochre[..., None]
alb = alb * (1 - rust[..., None]) + rc * rust[..., None]
alb = alb + (np.clip(scr, 0, 1) * 70 * (1 - rust))[..., None]          # Kratzer: blankes Metall
grain = noise(0.35, 25)
alb *= (1 + 0.05 * grain)[..., None]
# Wüstenstaub in den Fugen
dust = np.clip(np.exp(-(dseam / 5) ** 2) * 0.7 + 0.25 * np.clip(noise(1.8, 24), 0, 1), 0, 0.8)
alb = alb * (1 - 0.35 * dust[..., None]) + np.array([150, 118, 80], np.float32) * 0.35 * dust[..., None]
alb *= (1 + 0.08 * fine)[..., None]

# ---------- Licht (Normal-Mapping) ----------
Hs = blur(H, 0.8) * 2.2
gx = (np.roll(Hs, -1, 1) - np.roll(Hs, 1, 1)) * 0.5
gy = (np.roll(Hs, -1, 0) - np.roll(Hs, 1, 0)) * 0.5
nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1); nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
Ld = np.array([-0.55, -0.65, 0.52]); Ld /= np.linalg.norm(Ld)
diff = np.clip((nrm * Ld).sum(-1), 0, 1)
Hh = Ld + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
spec = np.clip((nrm * Hh).sum(-1), 0, 1) ** 36
metal = (1 - rust) * (1 - 0.6 * dust) * (1 - oil) + 0.6 * rivmask * (1 - rust)
ao = np.clip(1 + 0.9 * (H - blur(H, 14)) / 3, 0.35, 1.15)
shade = (0.26 + 1.05 * diff) * ao
col = alb * shade[..., None] + (255 * 0.55 * spec * metal)[..., None] * np.array([1.0, 0.97, 0.92])
# Farbstimmung: warm, staubig, kontrastreich, dunkler für Lesbarkeit
col = col * np.array([1.04, 0.98, 0.9])
col = 255 * (np.clip(col / 255, 0, 1) ** 1.12)
col *= 0.72
out = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
out.save('bg-metal.jpg', quality=80, optimize=True, progressive=True, subsampling=0)
out.resize((1024, 1024), Image.LANCZOS).save('mm_view.png')
out.crop((560, 520, 1312, 1272)).save('mm_crop.png')
import os; print(os.path.getsize('bg-metal.jpg'))
