# Palisander-Griffbrett, fein: viele dünne gerade Längslinien, Poren als kurze dunkle Striche, nur leichte breite Farbwellen. Kachelbar (FFT-periodisch).
import sys, numpy as np
from PIL import Image
H, W = 384, 1536
rng = np.random.default_rng(11)
fx = np.fft.fftfreq(W)[None, :]; fy = np.fft.fftfreq(H)[:, None]
def fn(sx, sy, seed):
    n = np.random.default_rng(seed).standard_normal((H, W))
    o = np.fft.ifft2(np.fft.fft2(n) * np.exp(-2 * np.pi**2 * ((fx * sx)**2 + (fy * sy)**2))).real
    return (o - o.mean()) / o.std()
broad = fn(500, 60, 2)            # leichte breite Farbwellen
lines1 = fn(260, 0.45, 3)         # sehr dünne, dichte Längslinien
lines2 = fn(140, 0.9, 4)
lines3 = fn(380, 2.2, 5)
t = 0.5 + 0.05 * broad + 0.10 * lines1 + 0.07 * lines2 + 0.06 * lines3
pts = (rng.random((H, W)) > 0.9975).astype(float) * (0.5 + rng.random((H, W)))
k = np.exp(-2 * np.pi**2 * ((fx * 3.2)**2 + (fy * 0.35)**2))
pores = np.fft.ifft2(np.fft.fft2(pts) * k).real; pores = np.clip(pores / np.percentile(pores[pores > 0], 99.5), 0, 1)
c0 = np.array([34, 18, 13.]); c1 = np.array([70, 36, 24.]); c2 = np.array([102, 54, 36.])
t3 = np.clip(t, 0, 1)[..., None]
img = np.where(t3 < 0.5, c0 + (c1 - c0) * (t3 / 0.5), c1 + (c2 - c1) * ((t3 - 0.5) / 0.5))
img = img + fn(400, 40, 8)[..., None] * np.array([4, 1.2, 1.5])
img = img * (1 - 0.6 * pores[..., None])
img = np.clip(img, 0, 255).astype(np.uint8)
Image.fromarray(img).save(sys.argv[1], quality=int(sys.argv[2]) if len(sys.argv) > 2 else 80, optimize=True, progressive=True)
