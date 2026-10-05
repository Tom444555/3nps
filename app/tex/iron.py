# Metal-Optik: Riffelblech (Platten), schwarzer zerkratzter Stahl (Hintergrund), Pyramiden-Nieten, Nietenband, Sägeblatt-Emblem
import numpy as np, os
from PIL import Image, ImageDraw, ImageFilter
N = 1024

def noise(beta, seed, aniso=(1, 1), scale=1.0, n=N):
    r = np.random.default_rng(seed)
    f = np.fft.fftfreq(n) * (n / 640) * scale
    fx, fy = np.meshgrid(f, f)
    k = np.sqrt((fx * aniso[0]) ** 2 + (fy * aniso[1]) ** 2); k[0, 0] = 1
    spec = (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n))) / k ** beta
    spec[0, 0] = 0
    a = np.real(np.fft.ifft2(spec)).astype(np.float32)
    return (a - a.mean()) / a.std()

def blur(a, s):
    n = a.shape[0]; f = np.fft.fftfreq(n); fx, fy = np.meshgrid(f, f)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2 * (np.pi * s) ** 2 * (fx ** 2 + fy ** 2)))).astype(np.float32)

def lines(count, lmin, lmax, ang_sd, seed=0, width=1, base_ang=None):
    r = np.random.default_rng(seed); img = Image.new('F', (N, N), 0); d = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = r.uniform(0, N, 2); L = r.uniform(lmin, lmax)
        a = (r.uniform(0, np.pi) if base_ang is None else base_ang) + r.normal(0, ang_sd)
        v = r.uniform(0.3, 1.0)
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                d.line([x + ox, y + oy, x + ox + L * np.cos(a), y + oy + L * np.sin(a)], fill=v, width=width)
    return np.array(img, np.float32)

def shade(H, base, metal, k=2.6, spec_pow=30, spec_amt=0.3, amb=0.32, dif=0.95, Ld=(-0.5, -0.7, 0.55)):
    Hs = blur(H, 0.9) * k
    gx = (np.roll(Hs, -1, 1) - np.roll(Hs, 1, 1)) * 0.5; gy = (np.roll(Hs, -1, 0) - np.roll(Hs, 1, 0)) * 0.5
    nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1); nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    Ld = np.array(Ld, float); Ld /= np.linalg.norm(Ld)
    diff = np.clip((nrm * Ld).sum(-1), 0, 1)
    Hh = Ld + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
    spec = np.clip((nrm * Hh).sum(-1), 0, 1) ** spec_pow
    return base * (amb + dif * diff)[..., None] + (255 * spec_amt * spec * metal)[..., None]

def save(col, name, q=80):
    out = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=1, percent=50, threshold=2))
    out.save(name, quality=q, optimize=True, progressive=True, subsampling=0)
    print(name, os.path.getsize(name), 'mittel', round(float(col.mean()), 1))
    return out

# ---------- 1) Riffelblech ----------
P = 64                                   # Zellgröße (1024 = 16 Zellen → nahtlos)
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
ci, cj = (yy // P).astype(int), (xx // P).astype(int)
u = (xx % P) - P / 2 + 0.5; v = (yy % P) - P / 2 + 0.5
sgn = np.where((ci + cj) % 2 == 0, 1.0, -1.0)
c, s = np.cos(np.pi / 4), np.sin(np.pi / 4)
ru = c * u + sgn * s * v; rv = -sgn * s * u + c * v
half = P * 0.34; w = P * 0.085
d = np.sqrt(np.maximum(np.abs(ru) - half, 0) ** 2 + rv ** 2)
bump = np.clip((w - d) / w, 0, 1); bump = bump ** 0.6 * (1 - 0.25 * (np.abs(ru) / (half + w)) ** 2)
H = 2.2 * bump + 0.5 * noise(2.0, 31) + 0.22 * noise(1.2, 32)
scr = blur(lines(900, 8, 90, 0.5, 33), 0.5) + blur(lines(90, 60, 260, 0.35, 34, 1, base_ang=0.5), 0.6)
H -= 0.55 * scr
grime = np.clip(noise(1.8, 35) * 0.5 + 0.25, 0, 1) ** 1.4 * (1 - bump)       # Dreck in den Vertiefungen
g = np.clip(0.5 + 0.2 * noise(1.5, 36), 0, 1)
base = np.array([40, 41, 45], np.float32) * (1 - g)[..., None] + np.array([22, 22, 25], np.float32) * g[..., None]
wear = np.clip(bump * (0.55 + 0.45 * noise(1.4, 37)), 0, 1)                   # blank gelaufene Rauten
base = base * (1 - 0.6 * wear[..., None]) + np.array([92, 94, 100], np.float32) * 0.6 * wear[..., None]
base = base * (1 - 0.45 * grime[..., None]) + np.array([18, 12, 10], np.float32) * 0.45 * grime[..., None]
rmask = np.clip((0.6 * noise(1.6, 38) + 0.4 * noise(1.0, 39) - 1.55) * 1.6, 0, 1) * (1 - 0.6 * bump)
rc = np.array([92, 34, 16], np.float32)
base = base * (1 - rmask[..., None]) + rc * rmask[..., None]
base += (np.clip(scr, 0, 1) * 30 * (1 - rmask))[..., None]
metal = (1 - rmask) * (0.4 + 0.6 * wear)
col = shade(H, base, metal, spec_amt=0.34) * 0.72
pl = save(col, 'panel-iron.jpg')
pl.resize((512, 512), Image.LANCZOS).save('panel_iron_view.png')

# ---------- 2) Hintergrund: schwarzer, zerschundener Stahl mit dunkelrotem Schmutz ----------
H = 1.0 * noise(2.1, 41) + 0.4 * noise(1.4, 42) + 0.3 * noise(1.0, 43, aniso=(0.05, 10))
claws = np.zeros((N, N), np.float32)
r = np.random.default_rng(44)
im = Image.new('F', (N, N), 0); dr = ImageDraw.Draw(im)
for _ in range(9):                                   # Kratzspuren in Dreiergruppen
    x, y = r.uniform(0, N, 2); a = r.uniform(-1.2, -0.4); L = r.uniform(120, 260)
    for k in range(3):
        ox, oy = -np.sin(a) * k * 11, np.cos(a) * k * 11
        for tx in (-N, 0, N):
            for ty in (-N, 0, N):
                pts = [(x + ox + tx + t * L * np.cos(a) + 3 * np.sin(t * 6), y + oy + ty + t * L * np.sin(a)) for t in np.linspace(0, 1, 24)]
                dr.line(pts, fill=1.0, width=3)
claws = blur(np.array(im, np.float32), 0.8)
fine = blur(lines(1600, 6, 70, 0.4, 45), 0.5)
H -= 1.4 * claws + 0.6 * fine
g = np.clip(0.5 + 0.25 * noise(1.6, 46), 0, 1)
base = np.array([30, 30, 33], np.float32) * (1 - g)[..., None] + np.array([12, 12, 14], np.float32) * g[..., None]
redg = np.clip(noise(1.7, 47) * 0.6 - 0.1, 0, 1) ** 1.3
base = base * (1 - 0.5 * redg[..., None]) + np.array([60, 12, 10], np.float32) * 0.5 * redg[..., None]
rmask = np.clip((noise(1.3, 48) - 1.7) * 1.5, 0, 1)
base = base * (1 - rmask[..., None]) + np.array([80, 30, 14], np.float32) * rmask[..., None]
base += (np.clip(claws * 1.3 + fine, 0, 1) * 46 * (1 - rmask))[..., None]
col = shade(H, base, (1 - rmask) * 0.8, spec_amt=0.22, amb=0.3) * 0.8
bg = save(col, 'bg-iron.jpg', q=78)
bg.resize((512, 512), Image.LANCZOS).save('bg_iron_view.png')

# ---------- 3) Pyramiden-Niete (Ecken) ----------
def stud(S=128, pad=10):
    a = np.zeros((S, S, 4), np.float32)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) + 0.5
    cx = cy = S / 2; h = S / 2 - pad
    u, v = (xx - cx) / h, (yy - cy) / h
    inside = (np.abs(u) <= 1) & (np.abs(v) <= 1)
    # Facetten: oben, unten, links, rechts (Licht von oben links)
    face = np.where(np.abs(u) > np.abs(v), np.where(u < 0, 2, 3), np.where(v < 0, 0, 1))
    shades = np.array([0.95, 0.28, 0.75, 0.42])
    lvl = shades[face]
    t = 1 - np.maximum(np.abs(u), np.abs(v))           # 0 am Rand, 1 an der Spitze
    lvl = lvl * (0.75 + 0.35 * t)
    rng2 = np.random.default_rng(5); grain = blur(np.pad(rng2.normal(size=(S, S)).astype(np.float32), 0), 0.0) if False else 0
    chrome = np.stack([lvl * 235, lvl * 238, lvl * 245], -1)
    edge = np.clip(1 - np.abs(np.abs(u) - np.abs(v)) * h / 1.2, 0, 1) * 0.35   # Grate
    chrome += (edge * 255)[..., None] * (face[..., None] != 1)
    sp = np.exp(-(((u + 0.3) ** 2 + (v + 0.3) ** 2) / 0.06)) * 255 * 0.42
    chrome += sp[..., None]
    a[..., :3] = np.clip(chrome, 0, 255); a[..., 3] = inside * 255
    img = Image.fromarray(a.astype(np.uint8), 'RGBA')
    # Schatten nach unten rechts
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    sd.rectangle([pad + 5, pad + 7, S - pad + 5, S - pad + 7], fill=(0, 0, 0, 200))
    sh = sh.filter(ImageFilter.GaussianBlur(5))
    out = Image.alpha_composite(sh, img)
    return out
st = stud()
st.resize((68, 68), Image.LANCZOS).save('stud-iron.png', optimize=True)
print('stud-iron.png', os.path.getsize('stud-iron.png'))

# ---------- 4) Nietenband (Leder mit Pyramiden-Nieten) für unter der Kontrollleiste ----------
TW, TH = 64, 34
lea = np.clip(0.5 + 0.18 * noise(1.2, 51, n=256)[:TH * 2, :TW * 2], 0, 1)
leather = np.stack([22 + 10 * lea, 18 + 8 * lea, 17 + 8 * lea], -1)
band = Image.fromarray(leather.astype(np.uint8)).convert('RGBA')
sm = stud(96, 6).resize((44, 44), Image.LANCZOS)
band.alpha_composite(sm, (int(TW - 22), int(TH - 22)))
dd = ImageDraw.Draw(band)
dd.line([(0, 3), (TW * 2, 3)], fill=(70, 70, 76, 255), width=1); dd.line([(0, TH * 2 - 4), (TW * 2, TH * 2 - 4)], fill=(70, 70, 76, 255), width=1)  # Naht
for x in range(0, TW * 2, 8):
    dd.line([(x, 6), (x + 4, 6)], fill=(88, 84, 80, 255)); dd.line([(x, TH * 2 - 7), (x + 4, TH * 2 - 7)], fill=(88, 84, 80, 255))
band.save('studs-iron.png', optimize=True)
print('studs-iron.png', os.path.getsize('studs-iron.png'))

# ---------- 5) Emblem: Sägeblatt mit Blitz (eigener Entwurf) ----------
S = 256; img = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
cx = cy = S / 2; R1, R0 = 122, 98; teeth = 18
pts = []
for k in range(teeth):
    a0 = 2 * np.pi * k / teeth; a1 = a0 + 2 * np.pi / teeth * 0.72; a2 = a0 + 2 * np.pi / teeth
    pts += [(cx + R0 * np.cos(a0), cy + R0 * np.sin(a0)), (cx + R1 * np.cos(a1), cy + R1 * np.sin(a1)), (cx + R0 * np.cos(a2) * 0.99, cy + R0 * np.sin(a2) * 0.99)]
d.polygon(pts, fill=(255, 255, 255, 255))
blade = np.array(img).astype(np.float32)
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
rr = np.hypot(xx - cx, yy - cy); ang = np.arctan2(yy - cy, xx - cx)
# Chrom: radiale Bürstung + Lichtbänder
lum = 0.55 + 0.3 * np.cos(2 * ang + 0.8) + 0.12 * np.cos(6 * ang) + 0.05 * np.sin(rr * 0.9)
lum = np.clip(lum, 0.15, 1.0)
col = np.stack([lum * 225, lum * 228, lum * 236], -1)
mask = blade[..., 3] / 255
ring = (np.abs(rr - 70) < 3).astype(np.float32)
col = col * (1 - 0.6 * ring[..., None])
hole = rr < 20
for k in range(6):                                      # Entlastungslöcher
    a = 2 * np.pi * k / 6 + 0.26
    hole |= np.hypot(xx - (cx + 50 * np.cos(a)), yy - (cy + 50 * np.sin(a))) < 6.5
mask = mask * (~hole)
out = np.zeros((S, S, 4), np.float32); out[..., :3] = col; out[..., 3] = mask * 255
em = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
# Blitz in Blutrot mit heller Kante
bolt = [(150, 22), (92, 128), (128, 128), (98, 236), (176, 104), (138, 104), (178, 22)]
bl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); bd = ImageDraw.Draw(bl)
bd.polygon([(x + 4, y + 5) for x, y in bolt], fill=(0, 0, 0, 190))
bl = bl.filter(ImageFilter.GaussianBlur(4)); bd = ImageDraw.Draw(bl)
bd.polygon(bolt, fill=(214, 18, 26, 255))
bd.line(bolt + [bolt[0]], fill=(255, 120, 110, 255), width=3)
em = Image.alpha_composite(em, bl)
glow = em.filter(ImageFilter.GaussianBlur(3))
em.resize((96, 96), Image.LANCZOS).save('emblem-iron.png', optimize=True)
print('emblem-iron.png', os.path.getsize('emblem-iron.png'))
# Übersicht
sheet = Image.new('RGBA', (900, 300), (20, 20, 22, 255))
sheet.paste(pl.resize((280, 280)), (10, 10)); sheet.paste(bg.resize((280, 280)), (300, 10))
sheet.alpha_composite(st.resize((90, 90)), (600, 20)); sheet.alpha_composite(em.resize((160, 160)), (720, 10))
sheet.alpha_composite(band.resize((128, 68)), (600, 200)); sheet.alpha_composite(band.resize((128, 68)), (728, 200))
sheet.save('iron_sheet.png')
