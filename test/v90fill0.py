# v90: „Takte ergänzen“ auch wenn noch KEIN Wort einen Takt hat (Text auf die Stimm-Einsätze), Knopf auch direkt bei der Wortliste
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
SYL = json.load(open(T + 'sing/silben.json'))
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'sing/silben.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        tok = [{"w": "w%d" % i, "b": None, "l": i // 6} for i in range(24)]
        key = await pg.evaluate("Sing.source(SoloInfo()).id")
        await pg.evaluate("(([k,t])=>{const d={v:1,f:{},l:{}};d.f[k]={name:'silben.wav',tok:t};localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%s)" % json.dumps([key, tok]))
        await pg.click('#sgToggle'); await pg.wait_for_timeout(500)
        check('Knopf oben in der Karte und bei der Wortliste, obwohl kein Wort einen Takt hat', await pg.is_visible('#sgFill') and await pg.is_visible('#sgFill2'))
        await pg.click('#sgFill2')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.evaluate("Sing.source(SoloInfo()).tok.every(t=>t.b!=null)"): break
        secs = await pg.evaluate("(()=>{const s=Sing.source(SoloInfo());return s.tok.map(t=>t.b==null?null:Sing.b2f(t.b,s.beats)/s.sr)})()")
        check('alle Wörter haben einen Takt, in Reihenfolge', all(x is not None for x in secs) and all(secs[i] < secs[i + 1] for i in range(23)), secs[:4])
        hit = sum(1 for x, y in zip(secs, SYL) if x is not None and abs(x - y) < 0.06)
        check('Wörter liegen auf den Silbenanfängen (≥ 20 von 24 auf ±60 ms)', hit >= 20, f'{hit}/24 · ' + str([round(x, 2) for x in secs[:6]]))
        check('Knöpfe danach weg', not await pg.is_visible('#sgFill') and not await pg.is_visible('#sgFill2'))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
