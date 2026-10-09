# v38: Live-Schalter (keine Analyse/Sicherung, eingefrorene Anzeigen, Nachholen) + Hänger-Protokoll mit App-Ereignissen
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
HOG = """(async()=>{ensureAudio(); const code='class H extends AudioWorkletProcessor{process(){let x=0;const e=Date.now()+12;while(Date.now()<e)x++;return true}}registerProcessor("hog",H)';
  await audioCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([code],{type:'application/javascript'})));
  window.__hog=new AudioWorkletNode(audioCtx,'hog'); __hog.connect(audioCtx.destination); return true})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(700)
        # Live an → Datei laden: keine Analyse, keine Sicherung
        await pg.click('#liveBtn'); await pg.wait_for_timeout(100)
        r = await pg.evaluate("[window.__live, localStorage.getItem('3nps-live'), document.getElementById('liveBtn').getAttribute('aria-pressed')]")
        check('Live an, gespeichert', r == [True, '1', 'true'], r)
        await pg.evaluate("window.__appEv.length = 0; Looper.autosaveOn(true)")
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(5000)
        evs = await pg.evaluate("window.__appEv.map(e=>e[1])")
        key = await pg.evaluate("Looper.debug().tracks[0].key")
        check('Live: Laden wird sofort ausgewertet, aber nicht gesichert', any(e.startswith('Analyse Spur 1') for e in evs) and 'Sicherung' not in evs and key, (evs, key))
        # eigene Aufnahme im Live-Modus: keine Analyse danach
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
        await pg.evaluate("Looper.foot(1)"); await pg.wait_for_timeout(9000); await pg.evaluate("Looper.foot(1)"); await pg.wait_for_timeout(2500)
        evs = await pg.evaluate("window.__appEv.map(e=>e[1])")
        check('Live: nach Aufnahme keine Analyse', 'Aufnahme Ende Spur 2' in evs and 'Analyse Spur 2' not in evs, evs[-5:])
        await pg.click('#tab-quinten'); await pg.wait_for_timeout(300); await pg.click('#tab-looper')
        # Live aus → nachholen
        await pg.click('#liveBtn'); await pg.wait_for_timeout(5500)
        evs = await pg.evaluate("window.__appEv.map(e=>e[1])")
        key = await pg.evaluate("Looper.debug().tracks[0].key")
        check('Live aus: Analyse + Sicherung nachgeholt', 'Analyse Spur 2' in evs and 'Sicherung' in evs and key, (evs[-6:], key))
        check('Ereignisse protokolliert', 'Live aus' in evs and 'Reiter quinten' in evs, evs[:8])
        # Neustart: Live-Zustand bleibt
        await pg.click('#liveBtn'); await pg.reload(); await pg.wait_for_timeout(600)
        check('Live bleibt nach Neustart', await pg.evaluate("window.__live && document.getElementById('liveBtn').textContent === '● Live'"))
        await pg.click('#liveBtn')
        # Protokoll: Hänger ohne App-Ereignis → „App: nichts“; mit Ereignis → genannt
        await pg.click('#loopDrums'); await pg.wait_for_timeout(500)
        await pg.click('#perfBtn'); await pg.wait_for_timeout(200)
        await pg.evaluate(HOG); await pg.wait_for_timeout(4500)
        log = await pg.inner_text('#pfLog')
        check('Hänger ohne App-Ereignis erkannt', 'App: nichts' in log and 'ohne App-Ereignis' in log, log[:120])
        await pg.evaluate("setInterval(()=>window.__appEvent('Aufnahme Ende Spur 2'), 300)"); await pg.wait_for_timeout(3500)
        log = await pg.inner_text('#pfLog')
        check('Hänger mit App-Ereignis benannt', 'App: Aufnahme Ende Spur 2' in log, log.split('\n')[1][:80])
        await pg.evaluate("__hog.disconnect()")
        await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        await pg.click('#pfCopy'); await pg.wait_for_timeout(200)
        clip = await pg.evaluate("navigator.clipboard.readText()")
        check('Kopieren', clip.startswith('3nps-Looper Hänger-Protokoll') and 'ms' in clip, clip[:60])
        await pg.click('#pfClear')
        check('Leeren', await pg.inner_text('#pfLog') == 'noch keine Hänger')
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
