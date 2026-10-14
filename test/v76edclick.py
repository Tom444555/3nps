# v76: Metronom im Looper-Editor – an/aus (gemerkt), Klicks auf den Rasterschlägen der Spur, nur solange sie läuft
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        if not await pg.evaluate('!!Looper._ed()'): await pg.click('#edit0'); await pg.wait_for_timeout(500)
        if not await pg.evaluate('!!Looper._ed()'): await pg.click('#edit0'); await pg.wait_for_timeout(500)
        check('Knopf „♩ Metronom“ im Editor neben „Loop verschieben“, aus', await pg.is_visible('#edClick') and await pg.get_attribute('#edClick', 'aria-pressed') == 'false')
        await pg.click('#edClick'); await pg.wait_for_timeout(100)
        check('an und gemerkt', await pg.get_attribute('#edClick', 'aria-pressed') == 'true' and await pg.evaluate("localStorage.getItem('3nps-edclick')") == '1')
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.wait_for_timeout(400)
        # Klicks spionieren: Oszillator-Starts zählen und Zeitpunkt gegen das Raster prüfen
        await pg.evaluate("""(()=>{window.__clk=[];const o=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(t){window.__clk.push([t,this.frequency.value]);return o.apply(this,arguments)}})()""")
        await pg.wait_for_timeout(4000)
        r = await pg.evaluate("""(()=>{const sr=audioCtx.sampleRate,a=Looper._anchor(),L=Looper._ed().L,g=Looper._grid(4).filter(p=>p<L-2),bars=Looper._grid(1).filter(p=>p<L-2);
          return window.__clk.map(([t,f])=>{const pos=((Math.round(t*sr)-a)%L+L)%L;const d=Math.min(...g.map(p=>Math.min(Math.abs(p-pos),L-Math.abs(p-pos))));const bar=bars.some(b=>Math.min(Math.abs(b-pos),L-Math.abs(b-pos))<3);return [d,f,bar]})})()""")
        n = len(r); per = await pg.evaluate("60/parseFloat(document.getElementById('bpm').value)")
        check('klickt auf den Schlägen (±1 Abtastwert)', n >= int(3.5 / per) and all(x[0] <= 1 for x in r), (n, [x[0] for x in r][:6]))
        check('Eins höher (1500 Hz), sonst 1000 Hz', all((x[1] == 1500) == x[2] for x in r) and any(x[2] for x in r), [(x[1], x[2]) for x in r][:6])
        await pg.click('#loopAll'); await pg.wait_for_timeout(400); await pg.evaluate("window.__clk=[]"); await pg.wait_for_timeout(1000)
        check('gestoppt: keine Klicks', await pg.evaluate("window.__clk.length") == 0)
        await pg.click('#edClick'); await pg.click('#loopAll'); await pg.wait_for_timeout(300); await pg.evaluate("window.__clk=[]"); await pg.wait_for_timeout(1000)
        check('aus: keine Klicks', await pg.evaluate("window.__clk.length") == 0)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
