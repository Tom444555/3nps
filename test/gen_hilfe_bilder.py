# v113: Bilder für den Reiter „Anleitung“ – echte Bildschirmfotos der App mit Beispieldaten (iPad quer), als JPEG nach app/www/hilfe/
import asyncio, os, subprocess, sys
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../app/www/hilfe/'); TMP = '/tmp/hilfe_png/'
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
U = 'http://localhost:8765/'
def jpg(name, w=1100):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', TMP + name + '.png', '-vf', "scale='min(%d,iw)':-2" % w, '-q:v', '5', OUT + name + '.jpg'], check=True)
async def shot(loc, name, w=1100):
    await loc.screenshot(path=TMP + name + '.png'); jpg(name, w)
async def load(pg, i, f):
    await pg.set_input_files('#file%d' % i, f)
    for _ in range(160):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if ('Spur %d' % (i + 1)) in (await pg.inner_text('#loopStatus')) and 'Lese' not in await pg.inner_text('#loopStatus'): break
    await pg.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 820}, device_scale_factor=1.5, bypass_csp=True, permissions=['microphone'])
        pg = await ctx.new_page()
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1200)
        await pg.select_option('#loopCountIn', '0')
        await load(pg, 0, T + 'chords/c_blues_7.wav'); await load(pg, 1, T + 'corpus/funk_104.wav')
        await pg.click('#loopAll'); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('.tracks').scrollIntoView({block:'start'}); window.scrollBy(0,-170)"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=TMP + 'looper.png'); jpg('looper')
        await shot(pg.locator('.track.t1'), 'spur', 520)
        await pg.click('#fxb0'); await pg.click('#eqb0'); await pg.wait_for_timeout(400)
        await shot(pg.locator('#trackEqHost'), 'eq-hall')
        await pg.click('#fxb0'); await pg.click('#eqb0')
        if True:
            wp0 = await pg.evaluate("""(()=>{const e=document.querySelector('.passt'); if(!e||!e.offsetHeight) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.left-4,y:r.top-4,width:r.width+8,height:r.height+8}})()""")
            if wp0: await pg.wait_for_timeout(300); await pg.screenshot(path=TMP + 'waspasst.png', clip=wp0); jpg('waspasst')
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        # Drums
        # Drum- und Drone-Zeile: nächster Vorfahre, der breit, aber nicht hoch ist; beide Zeilen zusammen
        await pg.evaluate("document.getElementById('drumKitSel').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
        box = await pg.evaluate("""(()=>{const up=el=>{let e=el;while(e.parentElement&&!(e.offsetWidth>700&&e.offsetHeight<160))e=e.parentElement;return e.getBoundingClientRect()};
          const a=document.getElementById('drumKitSel').closest('.lane').getBoundingClientRect(), b=document.querySelector('.lane-drone').getBoundingClientRect(); const t=Math.min(a.top,b.top)-6, bo=Math.max(a.bottom,b.bottom)+6; return {x:Math.min(a.left,b.left)-6,y:t,width:Math.max(a.width,b.width)+12,height:bo-t}})()""")
        await pg.screenshot(path=TMP + 'drums.png', clip=box); jpg('drums')
        wp = await pg.evaluate("""(()=>{const e=document.querySelector('.passt')||document.getElementById('passt'); if(!e) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.left-4,y:r.top-4,width:r.width+8,height:r.height+8}})()""")
        # Ideen
        await pg.evaluate("document.getElementById('ideaFold').open=true"); await pg.fill('#ideaName', 'Blues in A'); await pg.click('#ideaSave'); await pg.wait_for_timeout(800)
        await pg.locator('#ideaFold').scroll_into_view_if_needed(); await shot(pg.locator('#ideaFold'), 'ideen')
        # Editor
        await pg.evaluate("document.querySelector('.track.t1').scrollIntoView({block:'center'})"); await pg.click('#edit0'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=TMP + 'editor.png'); jpg('editor')
        await pg.keyboard.press('Escape'); await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1500)
        for tab, name in [('solo', 'improvisation'), ('caged', 'caged'), ('quinten', 'quintenzirkel'), ('jam', 'backing'), ('lied', 'songwriting'), ('singen', 'mitsingen'), ('ueben', 'training'), ('griffbrett', 'technik')]:
            if await pg.locator('#tab-' + tab).count() == 0: continue
            await pg.click('#tab-' + tab); await pg.wait_for_timeout(1200); await pg.evaluate('window.scrollTo(0,0)')
            await pg.screenshot(path=TMP + name + '.png'); jpg(name)
        # Studio
        await pg.goto(U + 'studio/'); await pg.wait_for_timeout(1500)
        await pg.evaluate("UI.show('brw')"); await pg.wait_for_timeout(800)
        if await pg.locator('#bList .item').count(): await pg.click('#bList .item >> nth=0'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=TMP + 'st-looper.png'); jpg('st-looper')
        if await pg.locator('#bNew').count(): await pg.click('#bNew'); await pg.wait_for_timeout(4000)
        await pg.evaluate("UI.show('roll'); document.getElementById('cProg').value='Am D E Am'; Roll.gen('bass')"); await pg.wait_for_timeout(800)
        await pg.screenshot(path=TMP + 'st-noten.png'); jpg('st-noten')
        await pg.evaluate("UI.show('arr')"); await pg.click('#tAdd'); await pg.click('#dlg .item[data-k=\"drum\"]'); await pg.wait_for_timeout(1500)
        await pg.evaluate("Proj.P.cycle={on:true,a:0,b:Proj.bar()*2}; Engine.setCycle(); Arr.zoomAll(); Arr.V.sel=Proj.P.regions[0].id; Arr.V.selTrack=Proj.P.regions[0].track; UI.inspect(); UI.sync()"); await pg.wait_for_timeout(800)
        await pg.screenshot(path=TMP + 'st-arr.png'); jpg('st-arr')
        await pg.evaluate("UI.show('mix')"); await pg.wait_for_timeout(700); await pg.screenshot(path=TMP + 'st-mix.png'); jpg('st-mix')
        await pg.evaluate("UI.show('mst')"); await pg.wait_for_timeout(500); await pg.select_option('#msSrc', 'mix'); await pg.click('#msLoad')
        for _ in range(60):
            await pg.wait_for_timeout(300)
            if 'Gemessen' in await pg.inner_text('#msStatus'): break
        await pg.click('#msRun')
        for _ in range(80):
            await pg.wait_for_timeout(300)
            if 'Fertig' in await pg.inner_text('#msStatus'): break
        await pg.screenshot(path=TMP + 'st-mastering.png'); jpg('st-mastering')
        await b.close()
    print(sorted(os.listdir(OUT)))
asyncio.run(main())
