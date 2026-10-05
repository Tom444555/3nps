# Optik „Verstärker“: Tolex, gebürstetes Alu-Frontblech, schwarzes eloxiertes Blech, Bespannstoff, Schrauben, Kontrolllampe
import sys; sys.path.insert(0, '.')
from texlib import *

def worley(n, cells, seed):
    """F1-Abstand zu zufälligen Punkten, nahtlos (ein Punkt je Zelle)."""
    r = np.random.default_rng(seed); cs = n / cells
    px = (np.arange(cells)[None, :] + r.uniform(0.15, 0.85, (cells, cells))) * cs
    py = (np.arange(cells)[:, None] + r.uniform(0.15, 0.85, (cells, cells))) * cs
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    ci, cj = (yy // cs).astype(int), (xx // cs).astype(int)
    best = np.full((n, n), 1e9, np.float32)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            ii, jj = (ci + di) % cells, (cj + dj) % cells
            qx = px[ii, jj] + np.where(cj + dj < 0, -n, np.where(cj + dj >= cells, n, 0))
            qy = py[ii, jj] + np.where(ci + di < 0, -n, np.where(ci + di >= cells, n, 0))
            best = np.minimum(best, np.hypot(xx - qx, yy - qy))
    return best / cs

# ---------- Tolex (schwarz, genarbt, leichter Glanz) ----------
n = 512
F = worley(n, 64, 61)
H = np.clip(1 - F * 1.35, 0, 1) ** 0.7                       # runde Noppen
H = H + 0.25 * noise(1.3, 62, n=n) * 0.3
base = np.full((n, n, 3), 24, np.float32) * (1 + 0.08 * noise(1.5, 63, n=n))[..., None]
col = shade(H, base, np.full((n, n), 0.55, np.float32), k=3.2, spec_pow=18, spec_amt=0.12, amb=0.55, dif=0.6)
save(col, 'tolex.jpg', q=82)

# ---------- Gebürstetes Aluminium (hell) und schwarz eloxiert ----------
br = 0.8 * noise(1.0, 71, aniso=(14, 0.015)) + 0.35 * noise(0.6, 72, aniso=(20, 0.03))
scr = blur(lines(220, 10, 120, 0.08, 73, 1, base_ang=0.0), 0.4)
Hb = 0.4 * br - 0.3 * scr
lum = 168 + 14 * br - 10 * scr + 5 * noise(2.0, 74)
alu = np.stack([lum * 1.0, lum * 1.01, lum * 1.035], -1)
col = shade(Hb, alu, np.ones((N, N), np.float32), k=1.2, spec_pow=8, spec_amt=0.08, amb=0.82, dif=0.25)
save(col, 'alu.jpg', q=80)
lumd = 34 + 6 * br - 4 * scr + 2 * noise(2.0, 75)
dark = np.stack([lumd, lumd * 1.01, lumd * 1.05], -1)
col = shade(Hb, dark, np.ones((N, N), np.float32), k=1.2, spec_pow=10, spec_amt=0.05, amb=0.85, dif=0.25)
save(col, 'alu-dark.jpg', q=80)

# ---------- Bespannstoff (schwarz mit Silberfaden) ----------
n = 256; P = 4
yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
u, v = (xx % P) / P, (yy % P) / P
over = ((xx // P + yy // P) % 2 == 0)
hor = np.sin(np.pi * v) ** 0.6; ver = np.sin(np.pi * u) ** 0.6
H = np.where(over, hor * 1.0 + ver * 0.6, ver * 1.0 + hor * 0.6)
silver = np.where(over, (yy // P) % 3 == 0, (xx // P) % 3 == 0)
basec = np.where(silver[..., None], np.array([78, 78, 82], np.float32), np.array([18, 18, 20], np.float32))
basec = basec * (0.85 + 0.15 * np.clip(H, 0, 1.4))[..., None] * (1 + 0.06 * noise(1.4, 81, n=n))[..., None]
col = shade(H * 0.6, basec, np.full((n, n), 0.4, np.float32), k=2.0, spec_pow=12, spec_amt=0.1, amb=0.6, dif=0.55)
save(col, 'grille.jpg', q=84)

# ---------- Schraube (Kreuzschlitz, Chrom) ----------
S = 128
yy, xx = (np.mgrid[0:S, 0:S].astype(np.float32) + 0.5 - S / 2) / (S / 2 - 8)
rr = np.hypot(xx, yy)
dome = np.sqrt(np.clip(1 - rr ** 2, 0, 1))
slot = ((np.abs(xx) < 0.11) & (np.abs(yy) < 0.62)) | ((np.abs(yy) < 0.11) & (np.abs(xx) < 0.62))
Hs = dome * 0.6 - slot * 0.5
gx = np.gradient(Hs, axis=1); gy = np.gradient(Hs, axis=0)
nn = np.stack([-gx * 12, -gy * 12, np.ones_like(gx)], -1); nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
L = np.array([-0.5, -0.7, 0.6]); L /= np.linalg.norm(L)
dif = np.clip((nn * L).sum(-1), 0, 1); hh = L + [0, 0, 1]; hh /= np.linalg.norm(hh)
sp = np.clip((nn * hh).sum(-1), 0, 1) ** 40
lumS = 70 + 150 * dif + 160 * sp - slot * 60
img = np.zeros((S, S, 4), np.float32); img[..., 0] = lumS; img[..., 1] = lumS; img[..., 2] = lumS * 1.04
img[..., 3] = np.clip((1 - rr) * (S / 2 - 8), 0, 1) * 255
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA')
sh = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([12, 14, S - 4, S - 2], fill=(0, 0, 0, 170)); sh = sh.filter(ImageFilter.GaussianBlur(4))
out = Image.alpha_composite(sh, im).resize((48, 48), Image.LANCZOS); out.save('screw.png', optimize=True); print('screw.png', os.path.getsize('screw.png'))

# ---------- Kontrolllampe (rotes Juwel im Chromring) ----------
S = 256
yy, xx = (np.mgrid[0:S, 0:S].astype(np.float32) + 0.5 - S / 2) / (S / 2)
rr = np.hypot(xx, yy); ang = np.arctan2(yy, xx)
img = np.zeros((S, S, 4), np.float32)
bezel = (rr > 0.66) & (rr < 0.97)
bl = 120 + 110 * np.cos(ang + 2.3) * 0.6 + 50 * np.cos(rr * 40)
facet = np.floor((ang + np.pi) / (2 * np.pi) * 12) % 2
dome = np.sqrt(np.clip(1 - (rr / 0.66) ** 2, 0, 1))
red = np.stack([150 + 105 * dome + 30 * facet, 10 + 20 * dome * dome, 14 + 16 * dome], -1)
hi = np.exp(-(((xx + 0.22) ** 2 + (yy + 0.25) ** 2) / 0.02)) * 220
red += hi[..., None]
img[..., :3] = np.where(bezel[..., None], np.stack([bl, bl, bl * 1.03], -1), red)
img[..., 3] = np.clip((0.97 - rr) * S / 2, 0, 1) * 255
jw = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA')
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(glow).ellipse([30, 30, S - 30, S - 30], fill=(255, 40, 30, 140)); glow = glow.filter(ImageFilter.GaussianBlur(26))
jw = Image.alpha_composite(glow, jw).resize((96, 96), Image.LANCZOS); jw.save('jewel.png', optimize=True); print('jewel.png', os.path.getsize('jewel.png'))

sheet = Image.new('RGB', (980, 270), (60, 60, 64))
for i, f in enumerate(['tolex.jpg', 'alu.jpg', 'alu-dark.jpg', 'grille.jpg']):
    sheet.paste(Image.open(f).convert('RGB').resize((220, 220)), (10 + i * 230, 10))
sheet.paste(Image.open('screw.png').resize((40, 40)), (930, 20), Image.open('screw.png').resize((40, 40)))
sheet.paste(jw.resize((48, 48)), (926, 90), jw.resize((48, 48)))
sheet.save('amp_sheet.png')
