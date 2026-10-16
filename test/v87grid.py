# v87: Text bleibt bei geändertem Schlagraster an seiner Zeit (Sekunden gemerkt); alter Text ohne Sekunden lässt sich per „Text umrechnen“ (Tempo von damals) retten
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
SYL = json.load(open(T + 'sing/silben.json'))
SECS = "(()=>{const s=Looper.singSrc(0),r=JSON.parse(localStorage.getItem('3nps-sing')).f[s.key];return r.tok.map(t=>Sing.b2f(t.b,s.beats)/s.sr)})()"
async def load(pg, bpm=None):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'sing/silben.wav')
    for _ in range(100):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'):
            for _ in range(40):
                if 'BPM' in await pg.inner_text('#impAna'): break
                await pg.wait_for_timeout(200)
            await pg.fill('#impBpm', str(bpm) if bpm else ''); await pg.click('#impOk')
        if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
    if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
    await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(800)
        # 1) Text im 108er-Raster anlegen (wie mit altem Tempo), dann mit automatischem Tempo (72) wieder laden
        await load(pg, 108)
        tok = await pg.evaluate("(S=>{const s=Looper.singSrc(0);return S.slice(0,8).map((x,i)=>({w:'w'+i,b:Math.round(Sing.f2b(x*s.sr,s.beats)*1000)/1000,l:i>>2}))})(%s)" % json.dumps(SYL))
        key = await pg.evaluate("Looper.singSrc(0).key")
        await pg.evaluate("(([k,t])=>{const d=JSON.parse(localStorage.getItem('3nps-sing')||'{\"v\":1,\"f\":{},\"l\":{}}');d.f[k]=Object.assign(d.f[k]||{name:'silben.wav'},{tok:t});localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%s)" % json.dumps([key, tok]))
        await pg.wait_for_timeout(500)
        await pg.click('#sgStrip .sg-w[data-i="0"]'); await pg.wait_for_timeout(200); await pg.click('#sgFNudgeR'); await pg.click('#sgFNudgeL'); await pg.wait_for_timeout(300)   # löst Speichern aus
        s0 = await pg.evaluate(SECS)
        await pg.evaluate("(k=>{const d=JSON.parse(localStorage.getItem('3nps-sing'));delete d.f[k].force;localStorage.setItem('3nps-sing',JSON.stringify(d));})(%s)" % json.dumps(key))
        await pg.reload(); await pg.wait_for_timeout(900); await load(pg)
        bpm = await pg.evaluate("Looper.debug().tracks[0].orig.bpm"); s1 = await pg.evaluate(SECS)
        check('anderes Raster (72 statt 108): Wörter bleiben an ihrer Zeit im Lied (±5 ms)', abs(bpm - 72) < 1 and max(abs(a - c) for a, c in zip(s0, s1)) < 0.005, (round(bpm, 1), max(abs(a - c) for a, c in zip(s0, s1))))
        # 2) alter Text ohne Sekunden (Schläge im 108er-Raster) → „Text umrechnen“ mit 108
        old = await pg.evaluate("(S=>{const s=Looper.singSrc(0),per=s.sr*60/108,b0=s.beats[0];return S.slice(0,8).map((x,i)=>({w:'w'+i,b:Math.round((x*s.sr-b0)/per*1000)/1000,l:i>>2}))})(%s)" % json.dumps(SYL))
        await pg.evaluate("(([k,t])=>{const d=JSON.parse(localStorage.getItem('3nps-sing'));d.f[k]={name:'silben.wav',tok:t};localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%s)" % json.dumps([key, old]))
        await pg.wait_for_timeout(400); s2 = await pg.evaluate(SECS)
        await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        await pg.click('text=Text passt nicht mehr zum Lied'); await pg.fill('#sgOldBpm', '108'); await pg.click('#sgRegrid'); await pg.wait_for_timeout(400)
        s3 = await pg.evaluate(SECS)
        check('alter Text verrutscht, „Text umrechnen“ (108) bringt ihn zurück (±30 ms)', max(abs(a - c) for a, c in zip(s2, SYL)) > 1 and max(abs(a - c) for a, c in zip(s3, SYL)) < 0.03, (round(max(abs(a - c) for a, c in zip(s2, SYL)), 2), round(max(abs(a - c) for a, c in zip(s3, SYL)), 3)))
        await pg.click('#sgUndo'); await pg.wait_for_timeout(300)
        check('↶ nimmt das Umrechnen zurück', max(abs(a - c) for a, c in zip(await pg.evaluate(SECS), s2)) < 0.005)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
