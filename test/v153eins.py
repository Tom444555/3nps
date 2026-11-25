# v153: Takt-Eins bei Shuffle und 12-Takt-Blues. Die Erkennung (app/beat.js) prüft zwischen Zählzeit 1 und 3 zusätzlich,
# welche Takteinteilung harmonisch „reiner“ ist (ein Akkord je Takt), und tauscht nur bei knapper bisheriger Entscheidung.
# Geprüft IN DER APP (Worker, wie beim Laden einer Datei): ab v153; Shuffle/Blues-Fälle, die vorher zwei Schläge daneben lagen,
# liegen auf der echten Eins; gerade Gegenproben und Auftakt-Fälle unverändert richtig; Tempo unverändert; ohne die Gegenprobe
# (opts.barFit=false) kommt das alte Ergebnis heraus (= der Schalter wirkt nur dort); 3 Größen; keine Skriptfehler.
# Die volle Messung über alle Sammlungen: node test/einsmess.js (Audio aus test/gen_blues.py und den übrigen gen_*.py).
import asyncio, os, json, base64
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/')
T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
# (Datei, Schläge daneben ohne Gegenprobe [alt], Schläge daneben mit [neu])
FAELLE = [('hard/h_mp3_shuffle_126', 2, 0), ('blues/b_chicago_112', 2, 0), ('blues/b_pop_shuffle_108', 2, 0), ('blues3/d_chicago_boogie_142', 2, 0),
          ('hard/h_texas_shuffle_118', 0, 0), ('hard/h_slowblues_60', 0, 0), ('corpus/shuffle_88', 0, 0),
          ('corpus/rock_120', 0, 0), ('corpus/pickup_100', 0, 0), ('gerade/g_funk_108', 0, 0), ('gerade/g_pop16_100_auftakt3', 0, 0), ('gerade/g_rock_128_blues', 0, 0)]
JS = """async ([b64, barFit]) => {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const dv = new DataView(u.buffer); let o = 12, sr = 0, data = null;
  while (o < u.length) { const id = String.fromCharCode(u[o], u[o+1], u[o+2], u[o+3]), len = dv.getUint32(o + 4, true);
    if (id === 'fmt ') sr = dv.getUint32(o + 12, true);
    if (id === 'data') { data = new Float32Array(len / 2); for (let i = 0; i < data.length; i++) data[i] = dv.getInt16(o + 8 + i * 2, true) / 32768; }
    o += 8 + len + (len & 1); }
  const r = await Analyzer.beat([data], sr, barFit ? {} : { barFit: false });
  return { bpm: r.bpm, first: r.firstDownbeat, downs: r.downbeats };
}"""
def daneben(gt, r):
    bl = 60 / gt['bpm']; cls = {}
    for d in r['downs']:
        if d < gt['downbeats'][0] - 0.1 or d > gt['beats'][-1] + 0.1: continue
        best = min((d - g for g in gt['downbeats']), key=abs); k = round(best / bl) % 4
        if abs(best - round(best / bl) * bl) > 0.06: k = 9
        cls[k] = cls.get(k, 0) + 1
    return max(cls, key=cls.get)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for n, (w, h) in enumerate([(1366, 1024), (820, 1180), (390, 844)]):
            pg = await b.new_page(viewport={'width': w, 'height': h}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1500)
            if n == 0:
                check('ab v153', int((await pg.inner_text('.brand')).split('v')[-1].split()[0]) >= 153)
                for f, alt, neu in FAELLE:
                    gt = json.load(open(T + f + '.json')); b64 = base64.b64encode(open(T + f + '.wav', 'rb').read()).decode()
                    r1 = await pg.evaluate(JS, [b64, True]); d1 = daneben(gt, r1)
                    check(f'{f}: Takt-Eins {"richtig" if neu == 0 else str(neu) + " daneben"}', d1 == neu, f'{d1} Schläge daneben')
                    check(f'{f}: Tempo richtig', abs(r1['bpm'] / gt['bpm'] - 1) < 0.01, f"{r1['bpm']:.2f}")
                    if alt != neu or f.startswith('corpus/rock'):
                        r0 = await pg.evaluate(JS, [b64, False]); d0 = daneben(gt, r0)
                        check(f'{f}: ohne Gegenprobe wie bisher ({alt} daneben), Tempo gleich', d0 == alt and abs(r0['bpm'] - r1['bpm']) < 1e-6, f'{d0}')
            else:
                f = 'blues/b_chicago_112'; gt = json.load(open(T + f + '.json')); b64 = base64.b64encode(open(T + f + '.wav', 'rb').read()).decode()
                check(f'{w}×{h}: Shuffle-Eins richtig', daneben(gt, await pg.evaluate(JS, [b64, True])) == 0)
            check(f'{w}×{h}: keine Skriptfehler', not errs, errs[:2])
            await pg.close()
        await b.close()
    print(f'\n{ok}/{tot}')
asyncio.run(main())
