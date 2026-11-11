# v141: Looper zeichnet sparsam – Wellenformen (Spur, Editor, Übersicht) aus dem Zwischenspeicher, Abspielstrich pro Bild,
# zwischengespeichertes Bild = frisch gezeichnetes Bild, Bedienung (Zoom) macht den Speicher ungültig,
# Pegel ohne erzwungenes Layout (Layouts/s, Änderungen/s), Pegel laufen weiter, keine Skriptfehler
import asyncio, os
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--autoplay-policy=no-user-gesture-required']
T = '/home/claude/3nps/test/'
SNAP = "()=>['edWave','edOver','wave0','wave1'].map(id=>{const c=document.getElementById(id);return c&&c.width?c.toDataURL():''})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(1500); await open_tab(pg, 'looper')
        await pg.select_option('#loopCountIn', '0')
        for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T']):
            await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(3500)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(1500)
        ids = await pg.evaluate("[...document.querySelectorAll('#panel-looper canvas')].map(c=>c.id).filter(Boolean)")
        check('Editor und Spuren sichtbar', await pg.is_visible('#edWave') and 'wave0' in ids, ids[:8])
        # Messung beim Mitlaufen: Layouts/s und Änderungen an den Pegeln
        cdp = await ctx.new_cdp_session(pg); await cdp.send('Performance.enable')
        met = lambda m: {x['name']: x['value'] for x in m['metrics']}
        await pg.evaluate("window.__m=0;window.__mo=new MutationObserver(l=>{window.__m+=l.length});window.__mo.observe(document.getElementById('panel-looper'),{attributes:true,subtree:true,childList:true,characterData:true})")
        m0 = met(await cdp.send('Performance.getMetrics')); await pg.wait_for_timeout(5000); m1 = met(await cdp.send('Performance.getMetrics'))
        lay = (m1['LayoutCount'] - m0['LayoutCount']) / 5; mut = await pg.evaluate("window.__m/5")
        check('Layouts pro Sekunde beim Mitlaufen klar unter v140 (85/s)', lay < 55, round(lay, 1))
        check('DOM-Änderungen pro Sekunde klar unter v140 (333/s)', mut < 250, round(mut, 1))
        st = await pg.evaluate("[...document.querySelectorAll('.tm-ch')].map(e=>e.style.cssText)")
        check('Spur-Pegel laufen (Wert gesetzt)', any('--lv' in s and '--lv: 0.0%' not in s for s in st), st[:2])
        check('Pegel-Höhe aus dem ResizeObserver gesetzt (--mh)', await pg.evaluate("[...document.querySelectorAll('.tmeter')].every(e=>/px/.test(e.style.getPropertyValue('--mh')))"))
        check('Zwischenspeicher für Editor, Übersicht und Spurwelle angelegt', await pg.evaluate("['edWave','edOver','wave0'].every(id=>{const c=document.getElementById(id)._cache;return c&&c.key})"))
        # Bild aus dem Speicher = frisch gezeichnet (Uhr für die Anzeige eingefroren → Abspielstrich steht, Audio läuft weiter)
        await pg.evaluate("(()=>{const t=audioCtx.currentTime;Object.defineProperty(audioCtx,'currentTime',{configurable:true,get:()=>t})})()"); await pg.wait_for_timeout(700)
        a = await pg.evaluate(SNAP)
        await pg.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Shift'}))"); await pg.wait_for_timeout(400)
        b2 = await pg.evaluate(SNAP)
        check('Editor: Bild aus dem Speicher gleicht frisch gezeichnetem', a[0] and a[0] == b2[0])
        check('Übersicht: Bild aus dem Speicher gleicht frisch gezeichnetem', a[1] and a[1] == b2[1])
        check('Spurwellen: Bild aus dem Speicher gleicht frisch gezeichnetem', a[2] and a[2] == b2[2] and a[3] == b2[3])
        # Bedienung macht den Speicher ungültig: Hineinzoomen ändert das Bild sofort
        await pg.click('#edZoomIn'); await pg.wait_for_timeout(400)
        c = await pg.evaluate(SNAP)
        check('Hineinzoomen zeichnet den Editor neu', c[0] != b2[0])
        await pg.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Shift'}))"); await pg.wait_for_timeout(400)
        d = await pg.evaluate(SNAP)
        check('nach dem Zoomen: Speicher gleicht frischem Bild', c[0] == d[0])
        await pg.click('#edZoomAll'); await pg.wait_for_timeout(400)
        e = await pg.evaluate(SNAP)
        check('„Alles“ stellt das Ausgangsbild wieder her', e[0] == b2[0])
        await pg.evaluate("delete audioCtx.currentTime"); await pg.wait_for_timeout(600)
        f = await pg.evaluate(SNAP)
        check('nach Fortsetzen läuft der Abspielstrich weiter', f[0] != e[0])
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
