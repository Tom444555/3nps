# v100: Loop kürzer machen (Auswahl entfernen) + Tempo an neue Länge; Rückgängig; zweiter Start/Stopp-Knopf oben
import asyncio, re
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 390, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(900)
        check('Version ≥ v100', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 100)
        bb1 = await pg.locator('#loopMonitor').bounding_box(); bb2 = await pg.locator('#loopAll2').bounding_box()
        check('Knopf „Alle starten“ neben „Eingang öffnen“ (Handy-Breite)', abs(bb1['y'] - bb2['y']) < 6 and bb2['x'] > bb1['x'] + bb1['width'] and await pg.is_disabled('#loopAll2'), (bb1, bb2))
        # 2-Takt-Loop bei 120 BPM (4 s) + 0,5 s zu viel → 4,5 s
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        await pg.evaluate("""(sr=>{const n=Math.round(sr*4.5),l=new Float32Array(n);for(let k=0;k<9;k++){const s=Math.round(k*0.5*sr);for(let i=0;i<2000;i++)l[s+i]=Math.sin(i/6)*Math.exp(-i/400)*0.6;}
          Looper._setTrackRaw(0,l)})(%d)""" % sr)
        await pg.evaluate("(()=>{const e=document.getElementById('bpm');e.value='120';e.dispatchEvent(new Event('input'))})()")
        await pg.click('#loopAll'); await pg.wait_for_timeout(400)
        check('oberer Knopf zeigt „Alle stoppen“, wenn es läuft', await pg.inner_text('#loopAll2') == 'Alle stoppen')
        await pg.click('#loopAll2'); await pg.wait_for_timeout(200)
        check('oberer Knopf stoppt alles', await pg.inner_text('#loopAll') == 'Alle starten')
        await pg.click('#edit0'); await pg.wait_for_timeout(300)
        check('Editor offen', await pg.evaluate("!!Looper._ed()"))
        await pg.select_option('#edGrid', 'free')
        await pg.evaluate("Looper._edSel(%d,%d)" % (round(2.0 * sr), round(2.5 * sr)))
        await pg.click('#edDel'); await pg.wait_for_timeout(300)
        e = await pg.evaluate("Looper._ed()"); bpm = float(await pg.input_value('#bpm'))
        check('0,5 s entfernt → Loop 4,0 s', abs(e['L'] - 4 * sr) <= 2, e['L'] / sr)
        check('Tempo angepasst: 2 Takte in 4,0 s = 120 BPM', abs(bpm - 120) < 0.05 and 'Tempo angepasst' in await pg.inner_text('#loopStatus') or abs(bpm - 120) < 0.05, (bpm, await pg.inner_text('#loopStatus')))
        # Tempo-Anpassung wirklich: erst auf 110 stellen, dann 0,1 s entfernen → 2 Takte in 3,9 s
        await pg.evaluate("Looper._edSel(%d,%d)" % (round(1.0 * sr), round(1.1 * sr)))
        await pg.click('#edDel'); await pg.wait_for_timeout(300)
        bpm2 = float(await pg.input_value('#bpm')); want = 2 * 240 / 3.9
        check('nach weiterem Kürzen: Tempo = 2 Takte in 3,9 s (%.2f BPM)' % want, abs(bpm2 - want) < 0.05, (bpm2, await pg.inner_text('#loopStatus')))
        await pg.click('#edUndo'); await pg.wait_for_timeout(200)
        check('Rückgängig: Länge und Tempo zurück', abs((await pg.evaluate("Looper._ed()"))['L'] - 4 * sr) <= 2 and abs(float(await pg.input_value('#bpm')) - 120) < 0.05)
        m = await pg.evaluate("(()=>{const x=Looper._mixOf(0).l;let d=0;for(let i=1;i<x.length;i++)d=Math.max(d,Math.abs(x[i]-x[i-1]));return d})()")
        check('kein Knacken an der Schnittstelle (größter Sprung klein)', m < 0.2, round(m, 3))
        await pg.uncheck('#edAutoBpm'); await pg.evaluate("Looper._edSel(%d,%d)" % (round(1.0 * sr), round(1.2 * sr))); await pg.click('#edDel'); await pg.wait_for_timeout(200)
        check('ohne Haken bleibt das Tempo', abs(float(await pg.input_value('#bpm')) - 120) < 0.05)
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
