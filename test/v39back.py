# v39: Zurück aus dem Hintergrund – Eingang öffnet wieder, Wiedergabe läuft weiter, hängende Mikrofon-Anfrage blockiert nicht mehr
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
PATCH = """(()=>{let hidden=false; Object.defineProperty(document,'hidden',{get:()=>hidden,configurable:true});
  Object.defineProperty(document,'visibilityState',{get:()=>hidden?'hidden':'visible',configurable:true});
  window.__setHidden=v=>{hidden=v; document.dispatchEvent(new Event('visibilitychange'));};
  const md=navigator.mediaDevices, orig=md.getUserMedia.bind(md); window.__gumCalls=0;
  md.getUserMedia=function(c){window.__gumCalls++; if(window.__gumHang){window.__gumHang--; return new Promise(()=>{});} return orig(c);};})();"""
ST = "[Looper.debug().mic, document.getElementById('loopMonitor').textContent, document.getElementById('loopMonitor').disabled, audioCtx.state, Looper.debug().tracks[0].state, window.__gumCalls]"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(PATCH)
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(2000)
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        s = await pg.evaluate(ST); check('Vorher: Eingang offen, Datei spielt', s[0] and s[4] == 'playing', s)
        # Hintergrund: iPadOS beendet Mikrofon und hält den Ton an
        await pg.evaluate("__setHidden(true); audioCtx.suspend(); Looper._micDrop()"); await pg.wait_for_timeout(1500)
        # Zurück; erste Mikrofon-Anfrage bekommt keine Antwort
        await pg.evaluate("window.__gumHang=1; __setHidden(false)"); await pg.wait_for_timeout(9000)
        s = await pg.evaluate(ST)
        check('Eine hängende Anfrage: öffnet beim zweiten Versuch selbst', s[0] and not s[2], s)
        await pg.evaluate("__setHidden(true); Looper._micDrop()"); await pg.wait_for_timeout(1200)
        await pg.evaluate("window.__gumHang=9; __setHidden(false)"); await pg.wait_for_timeout(14500)
        s = await pg.evaluate(ST); stt = await pg.inner_text('#loopStatus')
        check('Alles hängt: Knopf wieder frei + Meldung', not s[0] and not s[2] and s[1] == 'Eingang öffnen' and 'nicht freigegeben' in stt, (s, stt[:60]))
        await pg.evaluate("window.__gumHang=0; audioCtx.suspend()"); await pg.wait_for_timeout(300)
        await pg.mouse.click(600, 500); await pg.wait_for_timeout(2500)
        s = await pg.evaluate(ST)
        check('Erstes Tippen: Ton läuft, Eingang wieder offen, Datei spielt', s[0] and s[3] == 'running' and s[4] == 'playing', s)
        pos1 = await pg.evaluate("Looper.position() && Looper.position().text"); await pg.wait_for_timeout(1200)
        pos2 = await pg.evaluate("Looper.position() && Looper.position().text")
        check('Wiedergabe läuft weiter', pos1 != pos2, (pos1, pos2))
        # zweiter Durchgang ohne Hänger: öffnet von selbst
        await pg.evaluate("__setHidden(true); Looper._micDrop()"); await pg.wait_for_timeout(1200)
        await pg.evaluate("__setHidden(false)"); await pg.wait_for_timeout(2500)
        s = await pg.evaluate(ST); check('Normal zurück: Eingang öffnet von selbst', s[0] and not s[2], s)
        st = await pg.inner_text('#loopStatus')
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
