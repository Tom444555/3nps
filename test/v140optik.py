# v140: neue App-Optiken „Präzision Nacht“ (precise-dark) und „iOS“ (ios) – wählbar und gespeichert, data-theme gesetzt,
# Kontrast Haupttext/Grund ≥ 4,5:1, kein seitlicher Überlauf in allen Bereichen (390/820/1366), keine Dauer-Animationen,
# EN-Name, v24-Kompatibilität (3nps-theme = nordic), keine Skriptfehler
import asyncio, os, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
WAV = '/home/claude/3nps/test/chords/c_pop_strum.wav'
VIEWS = ['looper', 'lernen', 'power', 'caged', 'quinten', 'griffbrett', 'ueben', 'hoer', 'spick', 'jam', 'solo', 'lied', 'singen', 'hilfe']
# Kontrast: Textfarbe gegen den tatsächlich sichtbaren Grund (halbtransparente Flächen über die Vorfahren gemischt)
CONTRAST = """(sels)=>{
 const P=s=>{const m=s.match(/[\\d.]+/g);return m?m.map(Number):[0,0,0,0]};
 const rgba=s=>{const v=P(s);return [v[0],v[1],v[2],v.length>3?v[3]:1]};
 const L=c=>{const f=x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])};
 const bgOf=el=>{const layers=[];for(let e=el;e;e=e.parentElement){const c=rgba(getComputedStyle(e).backgroundColor);if(c[3]>0){layers.push(c);if(c[3]>=1)break;}}
   let r=rgba(getComputedStyle(document.documentElement).backgroundColor);if(r[3]<1)r=[0,0,0,1];
   for(let i=layers.length-1;i>=0;i--){const c=layers[i];r=[c[0]*c[3]+r[0]*(1-c[3]),c[1]*c[3]+r[1]*(1-c[3]),c[2]*c[3]+r[2]*(1-c[3]),1];}return r;};
 const out=[];for(const s of sels){const el=[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().width>0&&!e.closest('[hidden]'));if(!el){out.push([s,null]);continue;}
   const cs=getComputedStyle(el),fg=rgba(cs.color),bg=bgOf(el),f=[fg[0]*fg[3]+bg[0]*(1-fg[3]),fg[1]*fg[3]+bg[1]*(1-fg[3]),fg[2]*fg[3]+bg[2]*(1-fg[3])];
   const a=L(f),b=L(bg),cr=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);out.push([s,Math.round(cr*100)/100]);}
 return out;}"""
SAMPLES = ['body', '.card h2', '.card .caption', '.tabs .tab:not([aria-selected="true"])', '.tabs .tab[aria-selected="true"]', '.toggle-btn:not(.active)', '.lcd .v', '.brand']
LOOP_SAMPLES = ['.track .tname, .track-head', '.track button', 'select', '.toggle-btn.active', '.status-line']
ANIM = "document.getAnimations().filter(a=>a.playState==='running'&&a.effect&&a.effect.getTiming().iterations===Infinity).length"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1500)
        check('Version ab v140', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 140)
        opts = await pg.evaluate("[...document.querySelectorAll('#appTheme option')].map(o=>o.value+'='+o.textContent)")
        i = opts.index('precise=Präzision') if 'precise=Präzision' in opts else -9
        check('„Präzision Nacht“ und „iOS“ direkt hinter „Präzision“', opts[i + 1:i + 3] == ['precise-dark=Präzision Nacht', 'ios=iOS'], opts)
        # Standard-Optik: Leerlauf-Animationen als Vergleich
        await open_tab(pg, 'looper'); await pg.wait_for_timeout(600); base_anim = await pg.evaluate(ANIM)
        for th, bgc in [('precise-dark', '#101113'), ('ios', '#161618')]:
            await pg.click('#optikBtn'); await pg.select_option('#appTheme', th); await pg.wait_for_timeout(400)
            st = await pg.evaluate("[document.documentElement.dataset.theme, localStorage.getItem('3nps-theme'), localStorage.getItem('3nps-theme2'), document.querySelector('meta[name=theme-color]').content]")
            check(th + ': data-theme gesetzt, gespeichert, theme-color', st == [th, 'nordic', th, bgc], st)
            await pg.reload(); await pg.wait_for_timeout(1500)
            st = await pg.evaluate("[document.documentElement.dataset.theme, document.getElementById('appTheme').value]")
            check(th + ': nach Neuladen weiter aktiv', st == [th, th], st)
            check(th + ': v24 sieht „nordic“ (3nps-theme), echte Wahl in 3nps-theme2', await pg.evaluate("localStorage.getItem('3nps-theme')==='nordic'&&localStorage.getItem('3nps-theme2')===%r" % th))
            # Looper mit zwei Spuren
            await open_tab(pg, 'looper'); await pg.wait_for_timeout(300)
            if th == 'precise-dark':
                await pg.set_input_files('#file0', WAV); await pg.wait_for_timeout(2500)
                await pg.set_input_files('#file1', WAV); await pg.wait_for_timeout(2500)
            cr = await pg.evaluate(CONTRAST, SAMPLES + LOOP_SAMPLES)
            bad = [c for c in cr if c[1] is not None and c[1] < 4.5]
            check(th + ': Kontrast Text/Grund ≥ 4,5:1 (Stichproben Looper)', not bad and sum(c[1] is not None for c in cr) >= 9, cr)
            await open_tab(pg, 'power'); await pg.wait_for_timeout(500)
            cr = await pg.evaluate(CONTRAST, ['#panel-power h3', '#panel-power .caption', '#panel-power .toggle-btn:not(.active)', '.subtabs .subtab:not([aria-selected="true"])', '.subtabs .subtab[aria-selected="true"]'])
            bad = [c for c in cr if c[1] is not None and c[1] < 4.5]
            check(th + ': Kontrast im Powerchords-Kurs und Unterleiste ≥ 4,5:1', not bad, cr)
            # Leerlauf: keine Dauer-Animationen (nicht mehr als die Standard-Optik)
            await open_tab(pg, 'looper'); await pg.wait_for_timeout(600)
            n = await pg.evaluate(ANIM)
            check(th + ': keine Dauer-Animationen im Leerlauf (%d, Standard %d)' % (n, base_anim), n <= base_anim)
            # keine teuren Filter auf großen Flächen
            fl = await pg.evaluate("""(()=>{const bad=[];document.querySelectorAll('.control-bar,.card,.track,.editor,.lane,.tabs,body,html').forEach(e=>{const c=getComputedStyle(e);if((c.filter&&c.filter!=='none')||(c.backdropFilter&&c.backdropFilter!=='none')||(c.webkitBackdropFilter&&c.webkitBackdropFilter!=='none'))bad.push(e.className)});return bad.slice(0,4)})()""")
            check(th + ': kein filter/backdrop-filter auf Flächen', not fl, fl)
            # Kein seitlicher Überlauf in allen Bereichen bei 390 / 820 / 1366
            for vw, vh in [(390, 844), (820, 1180), (1366, 1024)]:
                await pg.set_viewport_size({'width': vw, 'height': vh}); await pg.wait_for_timeout(250); bad = []
                for v in VIEWS:
                    await open_tab(pg, v); await pg.wait_for_timeout(350)
                    d = await pg.evaluate("document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth")
                    if d > 0: bad.append((v, d))
                    if v == 'hilfe': await open_tab(pg, 'hilfe')
                check('%s %d px: kein seitlicher Überlauf in %d Ansichten' % (th, vw, len(VIEWS)), not bad, bad)
            await pg.set_viewport_size({'width': 1366, 'height': 1024}); await pg.wait_for_timeout(200)
            # Pop-ups Optik / Leistung / Signalweg öffnen sich und nutzen die Optik
            await open_tab(pg, 'looper'); await pg.evaluate("scrollTo(0,0)")
            await pg.click('#optikBtn'); await pg.wait_for_timeout(200)
            o1 = await pg.evaluate("(()=>{const p=document.getElementById('optikPop');return !p.hidden&&getComputedStyle(p).backgroundColor})()")
            await pg.click('#perfBtn'); await pg.wait_for_timeout(300)
            o2 = await pg.evaluate("!document.getElementById('perfPop').hidden"); await pg.click('#perfBtn'); await pg.wait_for_timeout(150)
            await pg.click('#loopSigBtn'); await pg.wait_for_timeout(700)
            o3 = await pg.evaluate("(()=>{const s=document.querySelector('#sigClose');return !!s&&s.getBoundingClientRect().width>0})()")
            if o3: await pg.click('#sigClose')
            check(th + ': Pop-ups Optik, Leistung, Signalweg', bool(o1) and o2 and o3, [o1, o2, o3])
        # Schalter wie iOS (Kippschalter) in Jammen, Häkchen im Kurs bleiben
        await open_tab(pg, 'jam'); await pg.wait_for_timeout(300)
        sw = await pg.evaluate("(()=>{const i=document.getElementById('jamDrums'),r=i.getBoundingClientRect();return [getComputedStyle(i).appearance,Math.round(r.width),Math.round(r.height)]})()")
        check('Kippschalter statt Häkchen-Kästchen', sw[0] == 'none' and sw[1] > sw[2] >= 20, sw)
        # Englisch
        await pg.click('#langBtn'); await pg.wait_for_timeout(500)
        en = await pg.evaluate("[...document.querySelectorAll('#appTheme option')].filter(o=>/precise-dark|ios/.test(o.value)).map(o=>o.textContent)")
        check('EN: „Precision Night“ und „iOS“', en == ['Precision Night', 'iOS'], en)
        await pg.click('#langBtn'); await pg.wait_for_timeout(300)
        # Zurück auf Standard: data-theme entfernt, alte Optik unverändert
        await pg.click('#optikBtn'); await pg.select_option('#appTheme', 'nordic'); await pg.wait_for_timeout(300)
        check('Zurück auf „Nordisch“: data-theme entfernt', await pg.evaluate("!document.documentElement.dataset.theme&&localStorage.getItem('3nps-theme2')==='nordic'"))
        # v24 hat auf „metal“ umgestellt → die gilt, auch wenn 3nps-theme2 noch „ios“ sagt
        await pg.evaluate("localStorage.setItem('3nps-theme2','ios');localStorage.setItem('3nps-theme','metal')"); await pg.reload(); await pg.wait_for_timeout(1200)
        check('v24-Wahl hat Vorrang (3nps-theme = metal)', await pg.evaluate("document.documentElement.dataset.theme") == 'metal')
        await pg.evaluate("localStorage.setItem('3nps-theme2','precise-dark');localStorage.setItem('3nps-theme','nordic')"); await pg.reload(); await pg.wait_for_timeout(1200)
        check('Frühes Setzen vor dem ersten Bild (kein Aufblitzen)', await pg.evaluate("document.documentElement.dataset.theme") == 'precise-dark')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
