# v75: Lieder komplett (Ausklang bleibt), Metronom beim Bearbeiten, Raster nach dem Tempo oben (Wörter behalten ihre Zeit), ↺ erkanntes Raster
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
SYL = json.load(open(T + 'sing/silben.json'))
SB = "(s=>{const src=Sing.source(SoloInfo());return Sing.f2b(s*src.sr,src.beats)})"
SECS = "Sing.source(SoloInfo()).tok.map(t=>{const src=Sing.source(SoloInfo());return Sing.b2f(t.b,src.beats)/src.sr})"
async def load(pg, f):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', f)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
    if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(800)
        # 1) komplett laden: Ausklang bleibt
        await load(pg, T + 'sing/ausklang.wav')
        c = await pg.evaluate("(()=>{const s=Looper.singSrc(0);return [s.L, s.origPos, s.len, s.sr]})()")
        check('ganze Datei bis zum Schluss geladen (hörbarer Ausklang nicht abgeschnitten)', c[1] + c[0] >= c[2] - 0.5 * c[3], c)
        # 2) Metronom: Klicks auf jedem Schlag, Eins lauter
        r = await pg.evaluate("""(()=>{const sr=1000,y={l:new Float32Array(4000),length:4000};y.r=y.l;const src={beats:[0,500,1000,1500,2000,2500,3000,3500],downs:[0,2000]};
          Sing.addClicks(y,src,0,7,0,1,sr);const at=p=>Math.max(...Array.from(y.l.slice(p,p+20)).map(Math.abs));return [0,500,1000,1500,2000,250].map(at)})()""")
        check('Metronom: Klick auf jedem Schlag, Eins lauter, dazwischen still', all(v > 0.2 for v in r[:5]) and r[0] > r[1] and r[4] > r[3] and r[5] < 0.01, [round(v, 2) for v in r])
        await load(pg, T + 'sing/silben.wav')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        tok = []
        for i, t in enumerate(SYL[:8]):
            tok.append({"w": "w%d" % i, "b": round(await pg.evaluate(SB + "(%f)" % t), 3), "l": i // 4})
        key = await pg.evaluate("Sing.source(SoloInfo()).id")
        await pg.evaluate("(([k,t])=>{const d={v:1,f:{},l:{}};d.f[k]={name:'silben.wav',tok:t};localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%s)" % json.dumps([key, tok]))
        await pg.wait_for_timeout(400)
        await pg.click('#sgStrip .sg-w[data-i="1"]'); await pg.wait_for_timeout(400)
        check('Metronom-Knopf da, aus', await pg.is_visible('#sgFClick') and not await pg.evaluate("document.getElementById('sgFClick').classList.contains('active')"))
        await pg.click('#sgFClick'); await pg.wait_for_timeout(150)
        check('Metronom an und gemerkt', await pg.evaluate("document.getElementById('sgFClick').classList.contains('active') && localStorage.getItem('3nps-sing-click')==='1'"))
        await pg.click('#sgFPlay'); await pg.wait_for_timeout(500)
        q = await pg.evaluate("[Sing.prec().word, Looper.running(), Sing.loopNow()]")
        check('▶ ab hier mit Metronom: eigener Player läuft, Looper steht', q[0] and not q[1] and q[2] is not None, q)
        await pg.click('#sgFStop'); await pg.wait_for_timeout(200)
        # 3) Tempo oben +1 → Raster folgt, Wörter behalten ihre Zeit
        s0 = await pg.evaluate(SECS); det = await pg.evaluate("Sing.source(SoloInfo()).bpmDet"); v0 = round(float(await pg.input_value('#bpm')))
        await pg.click('#bpmUp'); await pg.wait_for_timeout(900)
        g = await pg.evaluate("(()=>{const s=Sing.source(SoloInfo());return [s.grid&&s.grid.bpm, (s.beats[5]-s.beats[4])/s.sr]})()")
        s1 = await pg.evaluate(SECS)
        check('Tempo oben +1: Raster folgt dem eingestellten Tempo', g[0] == v0 + 1 and abs(g[1] - 60 / (v0 + 1)) < 0.001, (det, v0, g))
        check('Wörter bleiben an ihrer Stelle im Lied (±1 ms)', max(abs(a - c) for a, c in zip(s0, s1)) < 0.001, max(abs(a - c) for a, c in zip(s0, s1)))
        lbl = await pg.inner_text('#sgFGridL')
        check('Anzeige „Raster: … BPM (Tempo oben)“ und ↺', str(v0 + 1) in lbl and 'Tempo oben' in lbl and await pg.is_visible('#sgFGrid'), lbl)
        lines = await pg.evaluate("document.querySelectorAll('#sgStrip .sg-gbeat').length")
        check('Spurraster aus dem neuen Tempo gezeichnet', lines > 4, lines)
        # Nachprüfen läuft mit dem neuen Raster (gesperrte Zeile bleibt)
        await pg.click('#sgFLock'); await pg.click('#sgFCheck')
        for _ in range(30):
            await pg.wait_for_timeout(200)
            if 'korrigiert' in await pg.inner_text('#sgFMsg'): break
        s2 = await pg.evaluate(SECS)
        check('Nachprüfung mit neuem Raster: Wörter bleiben auf ihren Silben', all(abs(s2[i] - SYL[i]) < 0.03 for i in range(8)), [round(s2[i] - SYL[i], 3) for i in range(8)])
        # Raster per Tempo zurück auf erkannt
        await pg.click('#sgFGrid'); await pg.wait_for_timeout(900)
        s3 = await pg.evaluate(SECS)
        check('↺ erkanntes Raster: zurück, Wörter unverändert', await pg.evaluate("Sing.source(SoloInfo()).grid") is None and max(abs(a - c) for a, c in zip(s2, s3)) < 0.001)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
