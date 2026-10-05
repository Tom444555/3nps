"""Wikinger-/Keltik-Ornamente: Knotenwerk (Über-Unter-Flechtung), Runenbänder, Eckbeschläge.
Alles als Höhenkarte gezeichnet und mit Licht von oben links schattiert."""
import numpy as np, os
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter
D = os.path.dirname(os.path.abspath(__file__))
SS = 4  # Überabtastung

# ---------- Runen (älteres Futhark) als Striche im Feld 6 × 10 ----------
RUNES = {
 'f': [[(1,0),(1,10)], [(1,2),(5,0)], [(1,5),(5,3)]],
 'u': [[(1,10),(1,0),(5,3),(5,10)]],
 'th': [[(1,0),(1,10)], [(1,2.5),(4.6,5),(1,7.5)]],
 'a': [[(1,0),(1,10)], [(1,0),(5,2.5)], [(1,3.5),(5,6)]],
 'r': [[(1,10),(1,0),(4.6,2.5),(1,5),(5,10)]],
 'k': [[(4.5,2),(1.5,5),(4.5,8)]],
 'g': [[(0.5,0),(5.5,10)], [(5.5,0),(0.5,10)]],
 'w': [[(1,10),(1,0),(4.6,2.5),(1,5)]],
 'h': [[(1,0),(1,10)], [(5,0),(5,10)], [(1,3),(5,6)]],
 'n': [[(3,0),(3,10)], [(1,3.5),(5,6.5)]],
 'i': [[(3,0),(3,10)]],
 'j': [[(3,1),(0.8,4),(3,7)], [(3,3),(5.2,6),(3,9)]],
 'ei': [[(3,0),(3,10)], [(3,0),(5,2)], [(3,10),(1,8)]],
 'p': [[(4.6,0),(1,2.5),(1,7.5),(4.6,10)], [(1,2.5),(3,4)], [(1,7.5),(3,6)]],
 'z': [[(3,10),(3,0)], [(3,4),(0.6,0.6)], [(3,4),(5.4,0.6)]],
 's': [[(4.6,0),(1.4,4),(4.6,6),(1.4,10)]],
 't': [[(3,10),(3,0)], [(0.6,3),(3,0),(5.4,3)]],
 'b': [[(1,10),(1,0),(4.6,2.5),(1,5),(4.6,7.5),(1,10)]],
 'e': [[(0.6,10),(0.6,0),(3,3),(5.4,0),(5.4,10)]],
 'm': [[(0.6,10),(0.6,0),(5.4,5)], [(5.4,10),(5.4,0),(0.6,5)]],
 'l': [[(1,10),(1,0),(4.6,3)]],
 'ng': [[(3,2),(5.2,5),(3,8),(0.8,5),(3,2)]],
 'd': [[(0.6,0),(0.6,10),(5.4,0),(5.4,10),(0.6,0)]],
 'o': [[(0.6,10),(4.6,5),(3,2.4),(1.4,5),(5.4,10)]],
}
FUTHARK = ['f','u','th','a','r','k','g','w','h','n','i','j','ei','p','z','s','t','b','e','m','l','ng','d','o']

# ---------- Höhenkarte zeichnen ----------
class Canvas:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.H = np.zeros((h, w), np.float32)     # Höhe
        s.M = np.zeros((h, w), np.float32)     # Bedeckung (für Alpha)
    def _mask(s, draw_fn):
        im = Image.new('L', (s.w * SS, s.h * SS), 0)
        draw_fn(ImageDraw.Draw(im))
        return np.asarray(im.resize((s.w, s.h), Image.BOX), np.float32) / 255
    def paint(s, draw_fn, height, cover=True):
        m = s._mask(draw_fn)
        s.H = s.H * (1 - m) + height * m
        if cover: s.M = np.maximum(s.M, m)
    def begin(s): s.batch = []
    def flush(s, height):
        ops = s.batch; s.batch = None
        def f(d):
            for P, wd, closed in ops:
                d.line(P, fill=255, width=wd, joint='curve')
                if not closed:
                    r = wd / 2
                    for (x, y) in (P[0], P[-1]): d.ellipse([x - r, y - r, x + r, y + r], fill=255)
        s.paint(f, height)
    batch = None
    def stroke(s, pts, width, height, closed=False, cover=True, caps=True):
        if s.batch is not None:
            P = [(x * SS, y * SS) for x, y in pts]
            if closed: P = P + [P[0], P[1]]
            s.batch.append((P, max(1, int(round(width * SS))), closed)); return
        P = [(x * SS, y * SS) for x, y in pts]
        if closed: P = P + [P[0], P[1]]
        def f(d):
            d.line(P, fill=255, width=max(1, int(round(width * SS))), joint='curve')
            r = width * SS / 2
            for (x, y) in (P[0], P[-1]):
                if not closed and caps: d.ellipse([x - r, y - r, x + r, y + r], fill=255)
        s.paint(f, height, cover)
    def strap(s, pts, w, base=0.55, amp=0.35, closed=False, gap=None, groove=True, gh=0.0, caps=True, gap_pts=None):
        """Flechtband: dunkle Fuge, abgeschrägte Kanten, Mittelrille."""
        g = gap if gap is not None else w * 0.32
        s.stroke(gap_pts or pts, w + 2 * g, gh, closed, caps=caps)
        n = 5
        for k in range(n + 1):
            x = 1 - k / (n + 1)
            s.stroke(pts, w * x, base + amp * min(1.0, (1 - x) * 3.2), closed, caps=caps)
        if groove: s.stroke(pts, max(1.0, w * 0.16), base + amp * 0.35, closed, caps=caps)

def shade(H, scale, light=(-0.55, -0.7, 0.55), spec=24, metal=(0.62, 0.6, 0.58)):
    gy, gx = np.gradient(H * scale)
    n = np.dstack([-gx, -gy, np.ones_like(H)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array(light, np.float32); L /= np.linalg.norm(L)
    lam = np.clip((n * L).sum(2), 0, 1)
    hv = L + np.array([0, 0, 1.0]); hv /= np.linalg.norm(hv)
    sp = np.clip((n * hv).sum(2), 0, 1) ** spec
    return lam, sp

def polyline_crossings(strands):
    """Kreuzungen aller Stränge: (s1, i1, s2, i2, Punkt)."""
    segs = []
    for si, (pts, closed) in enumerate(strands):
        n = len(pts)
        for i in range(n if closed else n - 1):
            segs.append((si, i, np.array(pts[i]), np.array(pts[(i + 1) % n])))
    out = []
    for a in range(len(segs)):
        s1, i1, p, p2 = segs[a]
        for b in range(a + 1, len(segs)):
            s2, i2, q, q2 = segs[b]
            if s1 == s2:
                n = len(strands[s1][0])
                if abs(i1 - i2) <= 3 or abs(i1 - i2) >= n - 3: continue
            r, t = p2 - p, q2 - q
            den = r[0] * t[1] - r[1] * t[0]
            if abs(den) < 1e-9: continue
            u = ((q[0] - p[0]) * t[1] - (q[1] - p[1]) * t[0]) / den
            v = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den
            if 0 <= u < 1 and 0 <= v < 1:
                out.append([s1, i1 + u, s2, i2 + v, p + u * r])
    # nahe beieinanderliegende Doppelfunde zusammenfassen
    res = []
    for c in out:
        if all(np.hypot(*(c[4] - d[4])) > 1.0 for d in res): res.append(c)
    return res

def knot(cv, strands, w, base=0.55, amp=0.35, gh=0.0):
    """Zeichnet Stränge mit wechselnder Über-Unter-Flechtung."""
    X = polyline_crossings(strands)
    over = [None] * len(X)
    for si in range(len(strands)):
        mine = sorted([(c[1] if c[0] == si else c[3], k) for k, c in enumerate(X) if si in (c[0], c[2])])
        par = None
        for pos, k in mine:              # Startparität aus schon festgelegten Kreuzungen
            if over[k] is not None:
                par = (over[k] == si) ^ (mine.index((pos, k)) % 2 == 1); break
        if par is None: par = True
        for j, (pos, k) in enumerate(mine):
            if over[k] is None:
                c = X[k]; other = c[2] if c[0] == si else c[0]
                over[k] = si if (par ^ (j % 2 == 1)) else other
    for pts, closed in strands: cv.strap(pts, w, base, amp, closed, gh=gh)
    for k, c in enumerate(X):
        si = over[k]; pos = c[1] if c[0] == si else c[3]
        pts, closed = strands[si]; n = len(pts)
        # Stückchen des oberen Strangs um die Kreuzung neu zeichnen
        seglen = np.mean([np.hypot(*(np.array(pts[(i + 1) % n]) - np.array(pts[i]))) for i in range(min(n - 1, 20))])
        kk = int(np.ceil(2.2 * w / max(seglen, 1e-3))) + 1
        kg = int(np.ceil(1.1 * w / max(seglen, 1e-3))) + 1
        i0 = int(pos)
        ix = lambda r: [(i0 + d) % n if closed else min(max(i0 + d, 0), n - 1) for d in range(-r, r + 2)]
        cv.strap([pts[i] for i in ix(kk)], w, base, amp, False, gh=gh, caps=False, gap_pts=[pts[i] for i in ix(kg)])

def arc(cx, cy, r, a0, a1, n=120):
    t = np.linspace(a0, a1, n)
    return [(cx + r * np.cos(x), cy + r * np.sin(x)) for x in t]

def triquetra(cx, cy, R, ring=True, n=90):
    """Dreipass (Kleeblattknoten) aus drei Bögen von Spitze zu Spitze, optional mit Ring."""
    tips = [np.array([cx + R * np.cos(a), cy - R * np.sin(a)]) for a in np.radians([90, 330, 210])]
    pts = []
    for i in range(3):
        P, Q = tips[i], tips[(i + 1) % 3]
        mid = (P + Q) / 2; out = mid - np.array([cx, cy]); out /= np.linalg.norm(out)
        half = np.linalg.norm(Q - P) / 2
        # Kreismittelpunkt außen, so dass der Bogen 0.38 R über die Mitte hinaus reicht
        dmid = np.linalg.norm(mid - np.array([cx, cy]))
        apex = -0.2 * R
        # Scheitel des Bogens (auf der Achse durch die Mitte) liegt bei dmid + d - rho; d < 0: Bogen größer als ein Halbkreis
        lo, hi = -2 * R, 50 * R
        for _ in range(80):
            d = (lo + hi) / 2
            if dmid + d - np.hypot(d, half) > apex: hi = d
            else: lo = d
        C = mid + out * d; rho = np.hypot(d, half)
        a0 = np.arctan2(P[1] - C[1], P[0] - C[0]); a1 = np.arctan2(Q[1] - C[1], Q[0] - C[0])
        ap = np.arctan2(-out[1], -out[0])                 # Richtung zum Scheitel
        da = (a1 - a0) % (2 * np.pi)                      # gegen den Uhrzeigersinn
        if not ((ap - a0) % (2 * np.pi) < da): da -= 2 * np.pi
        seg = arc(C[0], C[1], rho, a0, a0 + da, n)
        pts += seg[:-1]
    strands = [(pts, True)]
    if ring: strands.append((arc(cx, cy, R * 0.56, 0, 2 * np.pi, 200)[:-1], True))
    return strands

def valknut(cx, cy, R):
    """Drei verschlungene Dreiecke."""
    strands = []
    for k in range(3):
        ox, oy = cx + 0.3 * R * np.cos(np.radians(90 + 120 * k)), cy - 0.3 * R * np.sin(np.radians(90 + 120 * k))
        tri = [(ox + R * 0.66 * np.cos(np.radians(90 + 120 * j)), oy - R * 0.62 * np.sin(np.radians(90 + 120 * j))) for j in range(3)]
        pts = []
        for j in range(3):
            a, b = np.array(tri[j]), np.array(tri[(j + 1) % 3])
            for t in np.linspace(0, 1, 40, endpoint=False): pts.append(tuple(a + (b - a) * t))
        strands.append((pts, True))
    return strands

def rune_strokes(cv, rune, x, y, h, width, height):
    s = h / 10
    for line in RUNES[rune]:
        cv.stroke([(x + px * s, y + py * s) for px, py in line], width, height)

# ---------- 1) Runenband (Gravur-Overlay, waagerecht kachelbar) ----------
def rune_band(path, h=48, word=FUTHARK, reps=2):
    pitch = h * 0.62
    W = int(round(pitch * len(word) * reps / 1)); cv = Canvas(W, h)
    rh = h * 0.56; y0 = (h - rh) / 2
    for r in range(reps):
        for k, rn in enumerate(word):
            x = (r * len(word) + k) * pitch + pitch * 0.5 - rh * 0.3
            rune_strokes(cv, rn, x, y0, rh, h * 0.075, -1.0)
    for yy in (h * 0.1, h * 0.9):
        cv.stroke([(-10, yy), (W + 10, yy)], h * 0.05, -1.0)
    H = gaussian_filter(cv.H, h * 0.012)
    lam, sp = shade(H, h * 0.9)
    flat = shade(np.zeros_like(H), 1)[0]
    d = lam - flat                       # Licht minus ebene Fläche
    depth = np.clip(-H, 0, 1)
    rgba = np.zeros((h, W, 4), np.float32)
    dark = np.clip(depth * 0.75 - d * 0.6, 0, 0.9)
    light = np.clip(d * 1.1, 0, 0.6)
    rgba[..., :3] = np.where(light[..., None] > dark[..., None], 1.0, 0.0) * np.array([1.0, 0.92, 0.82])
    rgba[..., 3] = np.maximum(dark, light)
    Image.fromarray((rgba * 255).astype(np.uint8)).save(path)
    return W

# ---------- 2) Emblem: Dreipass mit Ring, erhaben (für Überschriften und Logo) ----------
def metal_rgba(cv, scale, base_col, rough=0.0, edge_dark=True):
    H = gaussian_filter(cv.H, 0.6)
    lam, sp = shade(H, scale)
    col = np.array(base_col, np.float32)
    rng = np.random.default_rng(3)
    noise = np.asarray(Image.fromarray((rng.random(H.shape) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255 - 0.5
    v = (0.22 + 0.95 * lam)[..., None] * col * (1 + noise[..., None] * rough) + sp[..., None] * 0.55
    v = v * (0.45 + 0.55 * np.clip(H / 0.9, 0, 1))[..., None]   # Fugen dunkel
    a = np.clip(cv.M, 0, 1)
    rgba = np.dstack([np.clip(v, 0, 1), a])
    return Image.fromarray((rgba * 255).astype(np.uint8))

def emblem(path, size=192, col=(0.86, 0.62, 0.36)):
    cv = Canvas(size, size); c = size / 2
    # runder Schild-Grund
    cv.paint(lambda d: d.ellipse([SS * 2, SS * 2, SS * (size - 2), SS * (size - 2)], fill=255), 0.2)
    cv.stroke(arc(c, c, size * 0.455, 0, 2 * np.pi, 240), size * 0.035, 0.75, closed=True)
    knot(cv, triquetra(c, c, size * 0.36), size * 0.07, 0.5, 0.35)
    metal_rgba(cv, size * 0.06, col, 0.25).save(path)

# ---------- 3) Eckbeschlag: L-förmiges Eisenband mit Knoten und Nieten ----------
def corner(path, size=168, col=(0.6, 0.58, 0.56)):
    cv = Canvas(size, size); w = size * 0.2; m = size * 0.04
    L = size - m
    # Bänder (oben und links) mit abgerundeten Enden
    for pts in ([(m + w / 2, m + w / 2), (L - w * 0.5, m + w / 2)], [(m + w / 2, m + w / 2), (m + w / 2, L - w * 0.5)]):
        cv.stroke(pts, w + 4, 0.0); cv.stroke(pts, w, 0.42); cv.stroke(pts, w * 0.8, 0.5)
    # Spitzen der Arme: kleine Lilien-Enden
    for (x, y) in ((L - w * 0.35, m + w / 2), (m + w / 2, L - w * 0.35)):
        cv.paint(lambda d, x=x, y=y: d.ellipse([SS * (x - w * 0.42), SS * (y - w * 0.42), SS * (x + w * 0.42), SS * (y + w * 0.42)], fill=255), 0.5)
    # Knoten in der Ecke
    k = size * 0.34
    cv.paint(lambda d: d.ellipse([SS * (m), SS * (m), SS * (m + 2 * k), SS * (m + 2 * k)], fill=255), 0.0)
    cv.paint(lambda d: d.ellipse([SS * (m + 2), SS * (m + 2), SS * (m + 2 * k - 2), SS * (m + 2 * k - 2)], fill=255), 0.4)
    knot(cv, triquetra(m + k, m + k, k * 0.78), size * 0.045, 0.55, 0.3)
    # Nieten
    for (x, y) in ((L - w * 0.35, m + w / 2), (m + w / 2, L - w * 0.35)):
        for rr, hh in ((0.2, 0.7), (0.15, 0.85), (0.08, 0.95)):
            cv.paint(lambda d, x=x, y=y, rr=rr: d.ellipse([SS * (x - w * rr), SS * (y - w * rr), SS * (x + w * rr), SS * (y + w * rr)], fill=255), hh)
    H0, M0 = cv.H.copy(), cv.M.copy()
    for tag, fx in (('tl', lambda A: A), ('tr', np.fliplr), ('bl', np.flipud), ('br', lambda A: np.flipud(np.fliplr(A)))):
        cv.H, cv.M = np.ascontiguousarray(fx(H0)), np.ascontiguousarray(fx(M0))
        img = metal_rgba(cv, size * 0.05, col, 0.6)
        # leichter Schlagschatten
        a = np.asarray(img)[..., 3].astype(np.float32) / 255
        sh = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(size * 0.02)), np.float32) / 255
        sh = np.roll(np.roll(sh, int(size * 0.015), 0), int(size * 0.015), 1) * 0.7
        base = np.zeros((size, size, 4), np.float32); base[..., 3] = sh
        top = np.asarray(img, np.float32) / 255
        outA = top[..., 3] + base[..., 3] * (1 - top[..., 3])
        outC = (top[..., :3] * top[..., 3:4] + base[..., :3] * base[..., 3:4] * (1 - top[..., 3:4])) / np.maximum(outA[..., None], 1e-6)
        Image.fromarray((np.dstack([outC, outA]) * 255).astype(np.uint8)).save(path.replace('.png', '-' + tag + '.png'))

# ---------- 4) Gravuren in den Rost-Hintergrund ----------
def engrave_background(src, dst):
    global SS
    SS = 2
    img = np.asarray(Image.open(src).convert('RGB'), np.float32) / 255
    N = img.shape[0]; cv = Canvas(N, N)
    inner = []
    cv.begin()
    def wrap_draw(fn):
        for dx in (-N, 0, N):
            for dy in (-N, 0, N): fn(dx, dy)
    # zwei Runenbänder über die ganze Breite (nahtlos)
    for yb in (330, 1420):
        hh = 64; pitch = N / 48
        for dx in (-N, 0, N):
            for k in range(48):
                rn = FUTHARK[(k + (yb // 10)) % 24]
                rune_strokes(cv, rn, dx + k * pitch + pitch / 2 - hh * 0.3, yb - hh / 2, hh, 5.2, -1.0)
            for yy in (yb - hh * 0.85, yb + hh * 0.85):
                cv.stroke([(dx - 5, yy), (dx + N + 5, yy)], 4.5, -1.0)
    cv.flush(-1.0)
    def stamp(Hl, cx, cy):
        h, w = Hl.shape
        ys = (np.arange(h) + int(cy - h / 2)) % N; xs = (np.arange(w) + int(cx - w / 2)) % N
        cv.H[np.ix_(ys, xs)] = np.minimum(cv.H[np.ix_(ys, xs)], Hl)
    # großer Runenschild mit Dreipass
    R = 300; S = 2 * R + 40; sc = Canvas(S, S); c0 = S / 2
    sc.begin()
    sc.stroke(arc(c0, c0, R, 0, 2 * np.pi, 400), 6, -1.0, closed=True)
    sc.stroke(arc(c0, c0, R * 0.8, 0, 2 * np.pi, 400), 5, -1.0, closed=True)
    rh = R * 0.13
    for k in range(24):
        a = 2 * np.pi * k / 24 - np.pi / 2
        rune_strokes(sc, FUTHARK[k], c0 + R * 0.9 * np.cos(a) - rh * 0.3, c0 + R * 0.9 * np.sin(a) - rh / 2, rh, 4.0, -1.0)
    sc.flush(-1.0)
    knot(sc, triquetra(c0, c0, R * 0.62), R * 0.085, -0.55, 0.32, gh=-1.0)
    stamp(sc.H, 1520, 880)
    for (vx, vy, vr) in ((470, 1820, 260), (560, 860, 140)):
        S = int(vr * 1.25) + 30; vc = Canvas(S, S)
        knot(vc, valknut(S / 2, S / 2 + vr * 0.08, vr), vr * 0.06, -0.55, 0.32, gh=-1.0)
        stamp(vc.H, vx, vy)
    # kleine Dreipässe verstreut
    for (tx, ty, tr) in ((1180, 1700, 70), (1900, 1560, 55), (260, 520, 60)):
        S = int(tr * 2.4); tc = Canvas(S, S)
        knot(tc, triquetra(S / 2, S / 2, tr), tr * 0.12, -0.55, 0.32, gh=-1.0)
        stamp(tc.H, tx, ty)
    SS = 4
    H = gaussian_filter(cv.H, 1.6)
    lam, sp = shade(H, 3.0)
    flat = shade(np.zeros_like(H), 1)[0]
    d = (lam - flat)[..., None]
    depth = np.clip(-H, 0, 1)[..., None]
    grime = np.array([0.16, 0.09, 0.05])          # dunkler Rost in den Rillen
    out = img * (1 - depth * 0.62) + grime * depth * 0.62
    out = out + np.clip(d, 0, None) * np.array([1.0, 0.86, 0.7]) * 0.55 - np.clip(-d, 0, None) * 0.5
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(dst, quality=86, optimize=True, progressive=True)

if __name__ == '__main__':
    base = os.path.join(D, 'bg-metal-base.jpg')
    if not os.path.exists(base): os.rename(os.path.join(D, 'bg-metal.jpg'), base)
    engrave_background(base, os.path.join(D, 'bg-metal.jpg'))
    print('Runenband-Breite', rune_band(os.path.join(D, 'runes.png')))
    emblem(os.path.join(D, 'emblem.png'))
    corner(os.path.join(D, 'corner.png'), 132)
    print('fertig')
