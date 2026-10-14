# v77: Tempo vorgeben – Import-Dialog (Vorschläge ⅔/1,5×/½/2×), Neuanalyse mit dem Tempo, Wortzeiten bleiben, Tempo je Datei gemerkt, leeren = wieder automatisch, Editor „Raster neu berechnen“
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
SYL = json.load(open(T + 'sing/silben.json'))
SECS = "(()=>{const s=Looper.singSrc(0),d=JSON.parse(localStorage.getItem('3nps-sing')).f[s.key];return d.tok.map(t=>Sing.b2f(t.b,s.beats)/s.sr)})()"
async def load(pg, bpm=None, clear=False):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'sing/silben.wav')
    alts = None; pre = None
    for _ in range(100):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'):
            for _ in range(40):
                if 'BPM' in await pg.inner_text('#impAna'): break
                await pg.wait_for_timeout(200)
            alts = await pg.evaluate("[...document.querySelectorAll('#impBpmAlt button')].map(b=>+b.dataset.b)"); pre = await pg.input_value('#impBpm')
            if bpm: await pg.fill('#impBpm', str(bpm))
            if clear: await pg.fill('#impBpm', '')
            await pg.click('#impOk')
        if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
    if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
    return alts, pre
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 1000}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(800)
        alts, pre = await load(pg)
        det = await pg.evaluate("Looper.debug().tracks[0].orig.bpm")
        check('Dialog zeigt Vorschläge ⅔, 1,5×, ½, 2×', alts and any(abs(a - det * 1.5) < 0.2 for a in alts) and any(abs(a - det * 2 / 3) < 0.2 for a in alts), (det, alts))
        # Text anlegen (Wörter auf den Silben), Zeiten merken
        tok = await pg.evaluate("(S=>{const s=Looper.singSrc(0);return S.slice(0,8).map((x,i)=>({w:'w'+i,b:Math.round(Sing.f2b(x*s.sr,s.beats)*1000)/1000,l:0}))})(%s)" % json.dumps(SYL))
        key = await pg.evaluate("Looper.singSrc(0).key")
        await pg.evaluate("(([k,t])=>{const d={v:1,f:{},l:{}};d.f[k]={name:'silben.wav',tok:t};localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%s)" % json.dumps([key, tok]))
        s0 = await pg.evaluate(SECS)
        # mit 1,5× Tempo neu laden
        want = round(det * 1.5, 1)
        await load(pg, bpm=want)
        o = await pg.evaluate("(()=>{const o=Looper.debug().tracks[0].orig, s=Looper.singSrc(0);return [o.bpm, (s.beats[9]-s.beats[8])/s.sr, s.key]})()")
        s1 = await pg.evaluate(SECS)
        check('Neuanalyse mit vorgegebenem Tempo (Schlagabstand passt)', abs(o[0] - want) / want < 0.01 and abs(o[1] - 60 / want) < 0.01, (o, want))
        check('Wortzeiten im Lied unverändert (±2 ms)', max(abs(a - c) for a, c in zip(s0, s1)) < 0.002, max(abs(a - c) for a, c in zip(s0, s1)))
        check('Tempo für diese Datei gemerkt', abs(await pg.evaluate("JSON.parse(localStorage.getItem('3nps-sing')).f[%s].force" % json.dumps(key)) - want) < 0.01)
        # neue Seite: Datei wieder laden → Dialog ist vorbelegt, Raster wieder mit dem gemerkten Tempo
        await pg.reload(); await pg.wait_for_timeout(900)
        _, pre2 = await load(pg)
        o2 = await pg.evaluate("Looper.debug().tracks[0].orig.bpm"); s2 = await pg.evaluate(SECS)
        check('Wiederladen: Tempo vorbelegt und benutzt, Text passt', pre2 and abs(float(pre2) - want) < 0.05 and abs(o2 - want) / want < 0.01 and max(abs(a - c) for a, c in zip(s0, s2)) < 0.002, (pre2, o2))
        # Feld leeren → wieder automatisch
        await load(pg, clear=True)
        o3 = await pg.evaluate("Looper.debug().tracks[0].orig.bpm"); s3 = await pg.evaluate(SECS)
        check('Feld geleert: wieder erkanntes Tempo, Text passt, nicht mehr gemerkt', abs(o3 - det) < 0.5 and max(abs(a - c) for a, c in zip(s0, s3)) < 0.002 and await pg.evaluate("JSON.parse(localStorage.getItem('3nps-sing')).f[%s].force" % json.dumps(key)) is None, (o3, det))
        # Editor: Raster neu berechnen
        if not await pg.evaluate('!!Looper._ed()'): await pg.click('#edit0'); await pg.wait_for_timeout(500)
        if not await pg.evaluate('!!Looper._ed()'): await pg.click('#edit0'); await pg.wait_for_timeout(500)
        await pg.fill('#edReBpm', str(want)); await pg.click('#edReGrid')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        o4 = await pg.evaluate("Looper.debug().tracks[0].orig.bpm"); s4 = await pg.evaluate(SECS)
        check('Editor „Raster neu berechnen“: neues Tempo, Text passt', abs(o4 - want) / want < 0.01 and max(abs(a - c) for a, c in zip(s0, s4)) < 0.002, o4)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
