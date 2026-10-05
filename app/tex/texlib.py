# Gemeinsame Werkzeuge für die Texturen
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

