# Optik „Matrix“: schwarzer Grund, gespiegelte grüne Zeichenspalten mit Leuchtspur (nahtlos kachelbar, deterministisch).
# Bewusst dunkel gehalten, damit Text und Bedienelemente darüber gut lesbar bleiben. Kein Bewegtbild – kostet keine Rechenleistung.
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

N = 1024
CW, CH = 16, 16                     # Zellgröße → 64 × 64 Zeichen, kachelt nahtlos
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 14)
GLYPHS = list('0123456789ABCDEFHKMNTXZ:.=*+<>|')
r = np.random.default_rng(1999)

# Jedes Zeichen einmal gespiegelt vorrendern (Graustufen-Maske)
cache = {}
def glyph(ch):
    if ch not in cache:
        im = Image.new('L', (CW, CH), 0); ImageDraw.Draw(im).text((CW / 2, CH / 2), ch, font=FONT, fill=255, anchor='mm')
        cache[ch] = np.array(im.transpose(Image.FLIP_LEFT_RIGHT), np.float32) / 255
    return cache[ch]

g = np.zeros((N, N), np.float32)     # grüne Helligkeit
w = np.zeros((N, N), np.float32)     # weißer Kopf der Spur
rows = N // CH
for col in range(N // CW):
    x0 = col * CW
    for _ in range(r.integers(1, 3)):                     # 1–2 Spuren je Spalte
        head = r.integers(0, rows); length = r.integers(6, 26); peak = r.uniform(0.25, 0.65)
        for k in range(length):
            y0 = ((head - k) % rows) * CH
            a = peak * (1 - k / length) ** 1.6
            m = glyph(GLYPHS[r.integers(len(GLYPHS))]) * a
            for yy in range(CH):
                yr = (y0 + yy) % N
                g[yr, x0:x0 + CW] = np.maximum(g[yr, x0:x0 + CW], m[yy])
                if k == 0: w[yr, x0:x0 + CW] = np.maximum(w[yr, x0:x0 + CW], m[yy] * 0.55)
    # vereinzelte stille Zeichen
    for _ in range(r.integers(0, 4)):
        y0 = r.integers(0, rows) * CH; m = glyph(GLYPHS[r.integers(len(GLYPHS))]) * r.uniform(0.05, 0.14)
        for yy in range(CH):
            yr = (y0 + yy) % N; g[yr, x0:x0 + CW] = np.maximum(g[yr, x0:x0 + CW], m[yy])

# weiches Nachleuchten (nahtlos über FFT-Faltung)
def blur(a, s):
    f = np.fft.fftfreq(N); fx, fy = np.meshgrid(f, f)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2 * (np.pi * s) ** 2 * (fx ** 2 + fy ** 2)))).astype(np.float32)
glow = blur(g, 3.0) * 0.9
lum = np.clip(g * 0.75 + glow, 0, 1.2)
R = np.clip(lum * 20 + w * 150, 0, 255)
G = np.clip(lum * 205 + w * 230 + 4, 0, 255)
B = np.clip(lum * 70 + w * 170 + 2, 0, 255)
img = Image.fromarray(np.dstack([R, G, B]).astype(np.uint8), 'RGB')
img.save('../www/bg-matrix.jpg', quality=78, optimize=True, progressive=True)
img.resize((300, 300)).save('matrix_sheet.png')
print('bg-matrix.jpg', img.size)
