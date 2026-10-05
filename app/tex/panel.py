import numpy as np
from PIL import Image, ImageDraw, ImageFilter
N = 1024
rng = np.random.default_rng(7)
def noise(beta, seed, aniso=(1, 1), scale=1.0):
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
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2 * (np.pi * s) ** 2 * (fx ** 2 + fy ** 2)))).astype(np.float32)
def lines(count, lmin, lmax, ang_sd, horiz=True, seed=0, width=1):
    r = np.random.default_rng(seed); img = Image.new('F', (N, N), 0); d = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = r.uniform(0, N, 2); L = r.uniform(lmin, lmax)
        a = r.normal(0, ang_sd) + (0 if horiz else np.pi / 2) + (r.choice([0, np.pi / 2]) if not horiz and r.random() < 0.5 else 0)
        v = r.uniform(0.3, 1.0)
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                d.line([x + ox, y + oy, x + ox + L * np.cos(a), y + oy + L * np.sin(a)], fill=v, width=width)
    return np.array(img, np.float32)
# Höhe: gehämmerte Dellen, Bürstung, Kratzer, Lochfraß
H = 0.6 * noise(1.9, 1) + 0.25 * noise(1.3, 2)
brush = noise(1.0, 3, aniso=(0.04, 10))           # feine horizontale Bürstung
H += 0.35 * brush
scr_fine = blur(lines(1400, 6, 60, 0.25, True, 4), 0.5)
scr_big = blur(lines(160, 40, 220, 0.6, False, 5), 0.6)
H -= 0.7 * scr_fine + 0.9 * scr_big
pits = np.clip((noise(0.2, 6) - 2.2) * 3, 0, 1)
H -= 1.2 * pits
# Farbe: dunkles Gunmetal mit Schmutz, Ölfilm, wenigen Rostflecken
g = np.clip(0.5 + 0.22 * noise(1.6, 7), 0, 1)
base = np.array([62, 63, 68], np.float32) * (1 - g)[..., None] + np.array([44, 44, 47], np.float32) * g[..., None]
base *= (1 + 0.06 * brush)[..., None]
grime = np.clip(noise(1.8, 8) * 0.5 + 0.1, 0, 1) ** 1.5
base = base * (1 - 0.35 * grime[..., None]) + np.array([34, 28, 22], np.float32) * 0.35 * grime[..., None]
rmask = np.clip((0.6 * noise(1.6, 9) + 0.4 * noise(1.0, 10) - 1.25) * 1.8, 0, 1)
rmask = np.maximum(rmask, np.clip((noise(0.6, 11) - 2.6) * 2, 0, 1) * 0.8)  # Rostsprenkel
rc = np.array([112, 50, 20], np.float32) * (1 - np.clip(noise(0.9, 12) * .3 + .5, 0, 1))[..., None] + np.array([150, 74, 30], np.float32) * np.clip(noise(0.9, 12) * .3 + .5, 0, 1)[..., None]
base = base * (1 - rmask[..., None]) + rc * rmask[..., None]
H += 0.6 * rmask * (0.5 + 0.5 * noise(0.7, 13))
base += (np.clip(scr_fine + scr_big, 0, 1) * 34 * (1 - rmask))[..., None]   # blanke Kratzer
base *= (1 + 0.05 * noise(0.35, 14))[..., None]
# Licht
Hs = blur(H, 0.7) * 1.6
gx = (np.roll(Hs, -1, 1) - np.roll(Hs, 1, 1)) * 0.5; gy = (np.roll(Hs, -1, 0) - np.roll(Hs, 1, 0)) * 0.5
nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1); nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
Ld = np.array([-0.5, -0.7, 0.55]); Ld /= np.linalg.norm(Ld)
diff = np.clip((nrm * Ld).sum(-1), 0, 1)
Hh = Ld + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
spec = np.clip((nrm * Hh).sum(-1), 0, 1) ** 30
metal = (1 - rmask) * (1 - 0.5 * grime)
col = base * (0.45 + 0.75 * diff)[..., None] + (255 * 0.22 * spec * metal)[..., None]
col *= 0.82
out = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=1, percent=50, threshold=2))
out.save('panel.jpg', quality=80, optimize=True, progressive=True, subsampling=0)
out.resize((512, 512), Image.LANCZOS).save('panel_view.png')
out.crop((200, 200, 712, 712)).save('panel_crop.png')
import os; print(os.path.getsize('panel.jpg'), 'mean', col.mean())
