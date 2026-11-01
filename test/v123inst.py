# v123 Studio: drei neue Sampler-Instrumente (E-Bass, Akustikgitarre, E-Piano Wurlitzer) – laden, Grundfrequenz (±20 Cent), Anschlagschichten, Lizenz/Namensnennung, keine Skriptfehler
import asyncio, sys, numpy as np
from playwright.async_api import async_playwright
S = 'http://localhost:8765/studio/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
def f0(x, sr):
    N = 2048; hi = int(sr / 25); x = np.asarray(x, dtype=np.float64)
    d = np.array([np.sum((x[:N] - x[t:t + N]) ** 2) for t in range(hi)]); cm = np.ones(hi); cm[1:] = d[1:] * np.arange(1, hi) / (np.cumsum(d[1:]) + 1e-12)
    lo = int(sr / 2000); k = None
    for t in range(lo, hi - 1):
        if cm[t] < 0.15:
            while t + 1 < hi - 1 and cm[t + 1] < cm[t]: t += 1
            k = t; break
    if k is None: k = lo + int(np.argmin(cm[lo:hi - 1]))
    a, b, c = cm[k - 1], cm[k], cm[k + 1]; den = a - 2 * b + c; p = k + 0.5 * (a - c) / den if den > 0 else k
    return sr / p
TESTS = [('ebass', [33, 43, 52], [100]), ('guitar', [45, 57, 69], [100]), ('wurli', [40, 55, 67], [100, 50])]
LIC = open('/home/claude/3nps-src/app/www/inst/LIZENZ.txt', encoding='utf-8').read()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(bypass_csp=True)).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(S); await pg.wait_for_timeout(1200)
        ids = await pg.evaluate("Inst.LIST.map(i => i.id)")
        check('Alle drei in der Instrumentenliste', all(i in ids for i in ('ebass', 'guitar', 'wurli')), ids)
        for iid, ms, vs in TESTS:
            n = await pg.evaluate("(async id => { const l = await Inst.load(id); return l ? { n: l.notes.length, vel: l.vel, v: l.notes.map(x => x.v) } : null })", iid)
            check('%s lädt' % iid, n is not None and n['n'] > 0, n and n['n'])
            for v in vs:
                r = await pg.evaluate("""(async ([id, ms, v]) => { const sr = Engine.sr(), out = [];
                  for (const m of ms) { const oc = new OfflineAudioContext(1, sr * 1.2, sr); Inst.voice(oc, oc.destination, id, m, v, 0, 1.1); const b = await oc.startRendering(); const d = b.getChannelData(0); out.push(Array.from(d.slice(Math.round(sr * 0.3), Math.round(sr * 0.3) + 4096))); }
                  return { sr, out }; })""", [iid, ms, v])
                bad = []; rms = []
                for m, x in zip(ms, r['out']):
                    f = f0(x, r['sr']); want = 440 * 2 ** ((m - 69) / 12); cents = 1200 * np.log2(f / want); rms.append(float(np.sqrt(np.mean(np.square(x)))))
                    if abs(cents) > 20: bad.append((m, round(f, 1), round(want, 1), int(cents)))
                check('Grundfrequenz %s (Anschlag %d, %d Töne, ±20 ct)' % (iid, v, len(ms)), not bad and min(rms) > 1e-4, bad or ['%.4f' % q for q in rms])
        w = await pg.evaluate("Inst.load('wurli').then(l => ({ vel: l.vel, a: l.notes.filter(x => x.v === 0).length, b: l.notes.filter(x => x.v === 1).length }))")
        check('Wurlitzer: zwei Anschlagschichten (mp/f)', w['vel'] and w['a'] == 12 and w['b'] == 12, w)
        a = await pg.evaluate("""(async () => { const sr = Engine.sr(), res = []; for (const v of [40, 110]) { const oc = new OfflineAudioContext(1, sr, sr); Inst.voice(oc, oc.destination, 'wurli', 60, v, 0, 0.8); const d = (await oc.startRendering()).getChannelData(0); let s = 0; for (let i = 0; i < 20000; i++) s += d[i] * d[i]; res.push(s); } return res; })()""")
        check('Wurlitzer: härterer Anschlag ist lauter', a[1] > a[0] * 1.3, a)
        # Auswahlfenster: Namen + Namensnennung sichtbar
        await pg.evaluate("Proj.newProject('T').then ? 0 : 0")
        txt = await pg.evaluate("""(async () => { await Proj.newProject('Inst'); let tid; Proj.change('tracks', p => { const t = Proj.track('midi', 'Instrument 1'); tid = t.id; p.tracks.push(t); }); Inst.choose(tid); return document.getElementById('dlg').innerText; })()""")
        check('Auswahl zeigt E-Bass, Akustikgitarre, Wurlitzer', all(s in txt for s in ('E-Bass (echt)', 'Akustikgitarre (echt)', 'E-Piano Wurlitzer (echt)')))
        check('Auswahl nennt Greg Sullivan (sullivang.net), CC BY 3.0', 'Greg Sullivan (sullivang.net), CC BY 3.0' in txt)
        check('LIZENZ.txt: Quellen, Lizenzen, Autor', all(s in LIC for s in ('karoryfer.fashionbass', 'Discord-SFZ-GM-Bank', 'GregSullivan.E-Pianos', 'Greg Sullivan (sullivang.net), CC BY 3.0', 'CC0', 'Jeff Learman')))
        # Instrument wählen und Notenspur abspielen: kein Fehler
        r = await pg.evaluate("""(async () => { const tid = Proj.P.tracks[Proj.P.tracks.length - 1].id; document.getElementById('dlg').querySelector('[data-i="wurli"]').click(); await new Promise(r => setTimeout(r, 1500));
          const t = Proj.P.tracks.find(x => x.id === tid); return { inst: t.inst, name: t.name }; })()""")
        check('Wählen setzt Instrument und Spurnamen', r['inst'] == 'wurli' and r['name'] == 'E-Piano Wurlitzer', r)
        sz = sum(__import__('os').path.getsize('/home/claude/3nps-src/app/www/inst/%s.flac' % i) for i in ('ebass', 'guitar', 'wurli')) / 1048576
        check('Gesamtgröße der drei < 15 MB', sz < 15, '%.1f MB' % sz)
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
