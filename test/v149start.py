# v149: Schnellerer Start – Bass-Proben und Drum-Kit werden nach dem Laden in kurzen Häppchen im Leerlauf in Audio-Puffer übertragen
# (Hall-Puffer mit Rechenpausen). Geprüft: wird fertig; nie während Wiedergabe (Drums an); bei Bedarf sofort fertig („Drums an“,
# erster Bass-Ton) mit denselben Daten (Prüfsumme gleich); keine langen Aufgaben nach dem Laden aus Bass/Kit; keine Skriptfehler.
import asyncio, os, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
# Leerlauf-Rückrufe von Hand ausführen (Warteschlange statt requestIdleCallback)
QUEUE = "window.__q=[];window.requestIdleCallback=f=>{window.__q.push(f);return window.__q.length};"
SUM = "(()=>{let s=0;Object.keys(bassSampleBuffers).sort().forEach(k=>{const d=bassSampleBuffers[k].getChannelData(0);for(let i=0;i<d.length;i+=97)s+=d[i]*(i%7+1)});return Object.keys(bassSampleBuffers).length+':'+s.toFixed(6)})()"
RUNQ = "(()=>{const q=window.__q.splice(0);q.forEach(f=>f({timeRemaining:()=>10,didTimeout:false}));return q.length})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ref = None
        for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U + 'index.html'); await pg.wait_for_timeout(4000)
            if w == 1366: check('ab v149', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 149)
            st = await pg.evaluate("({bass:bassSamplesReady,raw:bassRaw,kit:Rhythm.debug().kit,busy:Looper.busy()})")
            check(f'{w}: Bass-Proben und Kit im Leerlauf fertig', st['bass'] and st['raw'] is None and st['kit'], st)
            check(f'{w}: Looper.busy() ohne Wiedergabe = false', st['busy'] is False)
            if w == 1366:
                ref = await pg.evaluate(SUM)
                check('20 Bass-Proben', ref.startswith('20:'), ref)
                await open_tab(pg, 'looper'); await pg.click('#loopDrums'); await pg.wait_for_timeout(1500)
                check('Drums an → Looper/Rhythmus gilt als beschäftigt', await pg.evaluate("bgBusy()"))
                await pg.click('#loopDrums'); await pg.wait_for_timeout(300)
            check(f'{w}: keine Skriptfehler', not errs, errs[:3])
            await ctx.close()
        # Leerlauf angehalten: nichts wird fertig, bis es gebraucht wird
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); await ctx.add_init_script(QUEUE); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(4000)
        st = await pg.evaluate("({bass:bassSamplesReady,n:bassRaw&&bassRaw.length,kit:Rhythm.debug().kit,q:window.__q.length})")
        check('ohne Leerlauf: Bass/Kit warten (Daten liegen bereit)', not st['bass'] and st['n'] == 20 and not st['kit'] and st['q'] >= 2, st)
        await open_tab(pg, 'looper'); await pg.click('#loopDrums'); await pg.wait_for_timeout(400)
        st = await pg.evaluate("({kit:Rhythm.debug().kit,on:Rhythm.on(),txt:document.getElementById('loopDrums').textContent})")
        check('„Drums an“ macht das Kit sofort fertig (kein „Drums laden …“)', st['kit'] and st['on'] and 'laden' not in st['txt'], st)
        n0 = await pg.evaluate("bassRaw.length"); await pg.evaluate(RUNQ); await pg.evaluate(RUNQ)
        check('während Drums laufen: keine Leerlauf-Häppchen', await pg.evaluate("bassRaw&&bassRaw.length") == n0, n0)
        await pg.click('#loopDrums'); await pg.wait_for_timeout(300)
        check('Bass noch nicht fertig (Leerlauf angehalten)', await pg.evaluate("!bassSamplesReady&&bassRaw.length===20"))
        await pg.evaluate("(()=>{try{playBassNote(audioCtx.currentTime+0.05,'root',400)}catch(e){}})()")   # Griffbrett-Klangweg fehlt hier; zählt nur das Fertigmachen
        check('erster Bass-Ton macht den Rest sofort fertig', await pg.evaluate("bassSamplesReady&&bassRaw===null"))
        s2 = await pg.evaluate(SUM)
        check('Bass-Proben gleich (Häppchen = sofort, Prüfsumme)', s2 == ref, [ref, s2])
        check('keine Skriptfehler (Leerlauf angehalten)', not errs, errs[:3])
        await ctx.close()
        # 4× gedrosselt: keine lange Aufgabe aus Bass/Kit/Hall nach dem Laden
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, service_workers='block')
        await ctx.add_init_script("window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push([e.startTime,e.duration])}).observe({type:'longtask',buffered:true})")
        pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(7000)
        r = await pg.evaluate("(()=>{const l=performance.getEntriesByType('navigation')[0].loadEventEnd;return {load:Math.round(l),nach:window.__lt.filter(x=>x[0]>l+300).map(x=>[Math.round(x[0]),Math.round(x[1])]),kit:Rhythm.debug().kit,bass:bassSamplesReady}})()")
        check('4×: Bass und Kit fertig', r['kit'] and r['bass'], r)
        check('4×: keine lange Aufgabe später als 0,3 s nach „geladen“', not r['nach'], r)
        await ctx.close()
        await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
