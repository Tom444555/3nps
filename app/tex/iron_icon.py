# App-Symbol „Looper“ im Metal-Stil: Chrom-Sägeblatt mit Blitz auf schwarzem Riffelblech
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
def emblem(S, glow=True):
    sc = S / 256
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    cx = cy = S / 2; R1, R0 = 122 * sc, 98 * sc; teeth = 18
    pts = []
    for k in range(teeth):
        a0 = 2 * np.pi * k / teeth; a1 = a0 + 2 * np.pi / teeth * 0.72; a2 = a0 + 2 * np.pi / teeth
        pts += [(cx + R0 * np.cos(a0), cy + R0 * np.sin(a0)), (cx + R1 * np.cos(a1), cy + R1 * np.sin(a1)), (cx + R0 * 0.99 * np.cos(a2), cy + R0 * 0.99 * np.sin(a2))]
    d.polygon(pts, fill=(255, 255, 255, 255))
    a = np.array(img).astype(np.float32)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    rr = np.hypot(xx - cx, yy - cy); ang = np.arctan2(yy - cy, xx - cx)
    rng = np.random.default_rng(3)
    streak = np.interp(ang, np.linspace(-np.pi, np.pi, 720), rng.normal(0, 1, 720)) * 0.05
    lum = 0.55 + 0.3 * np.cos(2 * ang + 0.8) + 0.12 * np.cos(6 * ang) + 0.05 * np.sin(rr / sc * 0.9) + streak
    lum = np.clip(lum, 0.12, 1.0)
    col = np.stack([lum * 228, lum * 231, lum * 238], -1)
    ring = (np.abs(rr - 70 * sc) < 3 * sc).astype(np.float32)
    rim = np.clip(1 - np.abs(rr - 96 * sc) / (2 * sc), 0, 1) * 0.5
    col = col * (1 - 0.6 * ring[..., None]) * (1 - rim[..., None] * 0.6)
    hole = rr < 20 * sc
    for k in range(6):
        aa = 2 * np.pi * k / 6 + 0.26
        hole |= np.hypot(xx - (cx + 50 * sc * np.cos(aa)), yy - (cy + 50 * sc * np.sin(aa))) < 6.5 * sc
    mask = a[..., 3] / 255 * (~hole)
    out = np.zeros((S, S, 4), np.float32); out[..., :3] = col; out[..., 3] = mask * 255
    em = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
    bolt = [(150, 22), (92, 128), (128, 128), (98, 236), (176, 104), (138, 104), (178, 22)]
    bolt = [(x * sc, y * sc) for x, y in bolt]
    bl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); bd = ImageDraw.Draw(bl)
    bd.polygon([(x + 4 * sc, y + 5 * sc) for x, y in bolt], fill=(0, 0, 0, 200))
    bl = bl.filter(ImageFilter.GaussianBlur(4 * sc)); bd = ImageDraw.Draw(bl)
    bd.polygon(bolt, fill=(214, 18, 26, 255))
    # Glanz auf dem Blitz
    hi = Image.new('L', (S, S), 0); hd = ImageDraw.Draw(hi); hd.polygon(bolt, fill=255)
    bl_arr = np.array(bl).astype(np.float32); shine = np.clip(1 - (yy / S) * 1.4, 0, 1) * 0.35 * (np.array(hi) / 255)
    bl_arr[..., :3] += shine[..., None] * 255
    bl = Image.fromarray(np.clip(bl_arr, 0, 255).astype(np.uint8), 'RGBA'); bd = ImageDraw.Draw(bl)
    bd.line(bolt + [bolt[0]], fill=(255, 130, 120, 255), width=max(2, int(3 * sc)))
    return Image.alpha_composite(em, bl)

def icon(S, inset):
    plate = Image.open('panel-iron.jpg').convert('RGB').crop((0, 0, 640, 640)).resize((S, S), Image.LANCZOS)
    p = np.array(plate).astype(np.float32)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    vig = np.clip(1.25 - 1.1 * np.hypot(xx - 0.5, yy - 0.42), 0.25, 1.15)
    p *= vig[..., None] * 1.15
    red = np.exp(-(((xx - 0.5) ** 2 + (yy - 0.5) ** 2) / 0.06)) * 70
    p[..., 0] += red; p[..., 1] += red * 0.08; p[..., 2] += red * 0.06
    base = Image.fromarray(np.clip(p, 0, 255).astype(np.uint8)).convert('RGBA')
    E = int(S * inset)
    em = emblem(E * 2).resize((E, E), Image.LANCZOS)
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sh.alpha_composite(em, ((S - E) // 2 + S // 80, (S - E) // 2 + S // 60))
    sh = Image.fromarray((np.array(sh) * np.array([0, 0, 0, 0.75])).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(S / 70))
    base.alpha_composite(sh); base.alpha_composite(em, ((S - E) // 2, (S - E) // 2))
    return base.convert('RGB')

import os
big = icon(1024, 0.78)
for n, s in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
    big.resize((s, s), Image.LANCZOS).save(n, optimize=True); print(n, os.path.getsize(n))
mask = icon(1024, 0.58)
mask.resize((512, 512), Image.LANCZOS).save('icon-maskable-512.png', optimize=True); print('icon-maskable-512.png', os.path.getsize('icon-maskable-512.png'))
emblem(192).resize((96, 96), Image.LANCZOS).save('emblem-iron.png', optimize=True)
prev = Image.new('RGB', (560, 200), (40, 40, 44)); prev.paste(big.resize((180, 180)), (10, 10)); prev.paste(mask.resize((180, 180)), (200, 10))
prev.paste(big.resize((60, 60)), (400, 10)); prev.save('icon_view.png')
