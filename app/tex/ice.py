# Optik „Eiswand“: raue, geschichtete Gletscherwand mit Rissen und Raureif, dunkle Eisplatten, Eiszapfen, vereiste Niete, Eiskristall
import sys; sys.path.insert(0, '.')
from texlib import *

def cracks(count, seed, vertical=True, lmin=80, lmax=420, width=2):
    r = np.random.default_rng(seed); img = Image.new('F', (N, N), 0); d = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = r.uniform(0, N, 2); L = r.uniform(lmin, lmax); a = (np.pi / 2 if vertical else 0) + r.normal(0, 0.35)
        pts = [(x, y)]
        for k in range(18):
            a += r.normal(0, 0.28); x += np.cos(a) * L / 18; y += np.sin(a) * L / 18; pts.append((x, y))
        w = max(1, int(r.integers(1, width + 1)))
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                d.line([(px + ox, py + oy) for px, py in pts], fill=float(r.uniform(0.5, 1)), width=w)
                if r.random() < 0.5:   # Abzweigung
                    j = int(r.integers(3, 15)); bx, by = pts[j]; ba = a + r.choice([-1, 1]) * r.uniform(0.6, 1.2)
                    d.line([(bx + ox, by + oy), (bx + ox + np.cos(ba) * L * 0.3, by + oy + np.sin(ba) * L * 0.3)], fill=0.6, width=1)
    return np.array(img, np.float32)

# ---------- 1) Hintergrund: die Eiswand ----------
yy0 = np.mgrid[0:N, 0:N][0].astype(np.float32)
band = noise(1.8, 101, aniso=(0.03, 5)) + 0.6 * noise(1.2, 111, aniso=(0.05, 3))                # waagrechte Jahresschichten
layers = np.sin(yy0 / N * 2 * np.pi * 13 + 0.8 * band) * 0.5 + 0.5
chisel = blur(lines(700, 6, 40, 0.25, 112, 1, base_ang=np.pi / 2), 0.5)                        # senkrechte Hiebspuren
H = 1.2 * band + 0.9 * layers + 0.7 * noise(2.1, 104) + 0.35 * noise(1.0, 113)
crk = blur(cracks(40, 105, True), 0.7) + 0.5 * blur(cracks(26, 106, False, 60, 260, 1), 0.6)
crk = np.clip(crk, 0, 1)
H -= 1.6 * crk + 0.5 * chisel
rime = np.clip((noise(1.5, 107) * 0.7 + noise(0.6, 108) * 0.5 - 0.75) * 1.4, 0, 1)
depth = np.clip(0.45 + 0.35 * (layers - 0.5) + 0.25 * noise(1.8, 110), 0, 1)
deep = np.array([6, 26, 50], np.float32); mid = np.array([34, 96, 140], np.float32); milky = np.array([132, 178, 206], np.float32)
base = np.where(depth[..., None] < 0.5, deep + (mid - deep) * (depth[..., None] / 0.5), mid + (milky - mid) * ((depth[..., None] - 0.5) / 0.5))
glow = np.clip(blur(crk, 2.2) * 1.6, 0, 1)                                                     # Licht im Inneren der Risse
base = base * (1 - 0.5 * crk[..., None]) + np.array([150, 225, 255], np.float32) * (glow - 0.6 * crk)[..., None].clip(0, 1) * 0.8
base += (np.clip(chisel, 0, 1) * 26)[..., None] * np.array([0.8, 0.95, 1.0], np.float32)
base = base * (1 - rime[..., None] * 0.6) + np.array([205, 228, 242], np.float32) * rime[..., None] * 0.6
col = shade(H, base, np.full((N, N), 0.85, np.float32), k=2.6, spec_pow=22, spec_amt=0.42, amb=0.45, dif=0.8, Ld=(-0.25, -0.9, 0.5)) * 0.6
bg = save(col, 'bg-ice.jpg', q=78)

# ---------- 2) Platten: dunkles, klares Eis mit Bruchflächen und Luftblasen ----------
H = 0.9 * noise(2.0, 121) + 0.4 * noise(1.2, 122)
frac = blur(lines(120, 40, 260, 1.0, 123, 1), 0.6) * 0.8 + blur(cracks(18, 124, True, 60, 300, 1), 0.5)
H -= 0.8 * np.clip(frac, 0, 1)
r = np.random.default_rng(125); bub = Image.new('F', (N, N), 0); db = ImageDraw.Draw(bub)
for _ in range(900):
    x, y = r.uniform(0, N, 2); rad = r.choice([1, 1, 1, 2, 2, 3]) * 0.9
    for ox in (-N, 0, N):
        for oy in (-N, 0, N): db.ellipse([x + ox - rad, y + oy - rad, x + ox + rad, y + oy + rad], fill=float(r.uniform(0.4, 1)))
bub = blur(np.array(bub, np.float32), 0.4)
g = np.clip(0.5 + 0.25 * noise(1.5, 126), 0, 1)
base = np.array([10, 24, 40], np.float32) * (1 - g)[..., None] + np.array([22, 46, 68], np.float32) * g[..., None]
base += (np.clip(frac, 0, 1) * 40)[..., None] * np.array([0.7, 0.9, 1.0], np.float32)
base += (np.clip(bub, 0, 1) * 70)[..., None] * np.array([0.8, 0.95, 1.0], np.float32)
frost = np.clip((noise(1.1, 127) - 1.2) * 1.2, 0, 1) * 0.5
base = base * (1 - frost[..., None]) + np.array([120, 150, 172], np.float32) * frost[..., None]
col = shade(H, base, np.full((N, N), 0.8, np.float32), k=2.0, spec_pow=40, spec_amt=0.3, amb=0.55, dif=0.6) * 0.85
pl = save(col, 'panel-ice.jpg', q=80)

# ---------- 3) Eiszapfen-Band ----------
W, Hh = 512, 72
img = Image.new('RGBA', (W, Hh), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 9], fill=(170, 205, 228, 255))
r = np.random.default_rng(131); x = 0
while x < W:
    w = r.uniform(6, 18); L = r.uniform(26, Hh - 4) if r.random() < 0.3 else r.uniform(6, 24)
    cx = x + w / 2
    for ox in (-W, 0, W):
        tip = cx + ox + r.uniform(-2, 2)
        d.polygon([(x + ox, 8), (x + w + ox, 8), (tip, 8 + L)], fill=(150, 200, 232, 215))
        d.polygon([(x + ox + w * 0.18, 8), (x + ox + w * 0.42, 8), (tip, 8 + L * 0.92)], fill=(225, 244, 255, 235))
    x += w * r.uniform(0.7, 1.6)
a = np.array(img).astype(np.float32)
yy, xx = np.mgrid[0:Hh, 0:W].astype(np.float32)
shine = 0.8 + 0.2 * noise(1.0, 132, n=512)[:Hh, :W] * np.exp(-yy / 50)
a[..., :3] *= shine[..., None]; a[..., 0] *= 0.92
a[..., 3] *= np.clip(1.15 - yy / Hh * 0.55, 0, 1)
ic = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(0.6))
ic.save('icicles.png', optimize=True); print('icicles.png', os.path.getsize('icicles.png'))

# ---------- 4) Vereiste Niete ----------
S = 128
yy, xx = (np.mgrid[0:S, 0:S].astype(np.float32) + 0.5 - S / 2) / (S / 2 - 10)
rr = np.hypot(xx, yy); dome = np.sqrt(np.clip(1 - rr ** 2, 0, 1))
gx = np.gradient(dome, axis=1); gy = np.gradient(dome, axis=0)
nn = np.stack([-gx * 14, -gy * 14, np.ones_like(gx)], -1); nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
L = np.array([-0.4, -0.8, 0.5]); L /= np.linalg.norm(L)
dif = np.clip((nn * L).sum(-1), 0, 1); hv = L + [0, 0, 1]; hv /= np.linalg.norm(hv); sp = np.clip((nn * hv).sum(-1), 0, 1) ** 30
fr = np.clip(np.random.default_rng(141).random((S, S)) * 1.6 - 0.9, 0, 1) * (rr > 0.45)
lum = 40 + 90 * dif + 120 * sp
rgb = np.stack([lum * 0.85, lum * 0.95, lum * 1.08], -1)
rgb = rgb * (1 - fr[..., None] * 0.8) + np.array([215, 235, 250]) * fr[..., None] * 0.8
img = np.zeros((S, S, 4), np.float32); img[..., :3] = rgb; img[..., 3] = np.clip((1 - rr) * (S / 2 - 10), 0, 1) * 255
rv = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA')
sh = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([16, 18, S - 6, S - 4], fill=(0, 6, 14, 180)); sh = sh.filter(ImageFilter.GaussianBlur(5))
Image.alpha_composite(sh, rv).resize((48, 48), Image.LANCZOS).save('rivet-ice.png', optimize=True)

# ---------- 5) Emblem: Eiskristall (sechsstrahlig) ----------
S = 384; em = Image.new('RGBA', (S, S), (0, 0, 0, 0)); de = ImageDraw.Draw(em); c = S / 2
for k in range(6):
    a = k * np.pi / 3 - np.pi / 2; ex, ey = c + np.cos(a) * 168, c + np.sin(a) * 168
    de.line([(c, c), (ex, ey)], fill=(225, 244, 255, 255), width=18)
    for f, ln in ((0.42, 62), (0.68, 44), (0.86, 26)):
        bx, by = c + np.cos(a) * 168 * f, c + np.sin(a) * 168 * f
        for sgn in (-1, 1):
            b = a + sgn * np.pi / 3
            de.line([(bx, by), (bx + np.cos(b) * ln, by + np.sin(b) * ln)], fill=(205, 235, 252, 255), width=12)
de.regular_polygon((c, c, 46), 6, rotation=30, fill=(160, 215, 245, 255))
glow = em.filter(ImageFilter.GaussianBlur(14)); ga = np.array(glow).astype(np.float32); ga[..., :3] = [90, 190, 255]; ga[..., 3] *= 0.9
out = Image.alpha_composite(Image.fromarray(ga.astype(np.uint8), 'RGBA'), em)
out.resize((96, 96), Image.LANCZOS).save('emblem-ice.png', optimize=True)

sheet = Image.new('RGB', (980, 300), (50, 54, 60))
sheet.paste(bg.resize((280, 280)), (10, 10)); sheet.paste(pl.resize((280, 280)), (300, 10))
sheet.paste(ic, (600, 10), ic); sheet.paste(ic.crop((0, 0, 380, 72)), (600, 90), ic.crop((0, 0, 380, 72)))
r2 = Image.open('rivet-ice.png'); sheet.paste(r2, (610, 190), r2); e2 = Image.open('emblem-ice.png'); sheet.paste(e2, (700, 180), e2)
sheet.save('ice_sheet.png')
