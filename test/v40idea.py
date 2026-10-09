# v40: Idee speichern ohne Speicherspitze – kein kompletter Mix mehr, Spuren/Eingang/Wiedergabe bleiben unberührt
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ST = "[Looper.debug().mic, Looper.debug().tracks.map(t=>t.state+':'+t.L).join(' '), audioCtx.state, Looper.position() && Looper.position().text]"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(1500); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
        await pg.evaluate("Looper._setTrack(1, new Float32Array(1).fill(0.1)); Looper.foot(1); window.__mixCalls=0; const o=Looper.sessionMix; Looper.sessionMix=function(){window.__mixCalls++; return o.apply(this, arguments)}; 0")
        await pg.wait_for_timeout(600)
        before = await pg.evaluate(ST); n0 = await pg.evaluate("document.querySelectorAll('#ideaList .idea-row').length")
        t = await pg.evaluate("(async()=>{const t0=performance.now(); document.getElementById('ideaSave').click(); await new Promise(r=>setTimeout(r,1500)); return performance.now()-t0})()")
        after = await pg.evaluate(ST); n1 = await pg.evaluate("document.querySelectorAll('#ideaList .idea-row').length")
        calls = await pg.evaluate("window.__mixCalls")
        check('Kein kompletter Mix beim Speichern', calls == 0, calls)
        check('Idee gespeichert', n1 == n0 + 1, (n0, n1))
        check('Spuren, Eingang, Ton unverändert', before[0] == after[0] == True and before[1] == after[1] and after[2] == 'running', (before, after))
        secs = await pg.evaluate("(async()=>{const l=await AppDB.all('ideas'); const i=l.sort((a,b)=>b.ts-a.ts)[0]; return [i.secs, Looper.sessionSecs(i.session), Looper.sessionMix(i.session).secs]})()")
        check('Länge wie bisher', abs(secs[0] - secs[2]) < 1e-6 and secs[0] > 0, secs)
        p1 = await pg.evaluate("Looper.position().text"); await pg.wait_for_timeout(900); p2 = await pg.evaluate("Looper.position().text")
        check('Wiedergabe läuft weiter', p1 != p2, (p1, p2))
        # Idee wieder laden: Spuren da
        await pg.click('#ideaList .idea-row button'); await pg.wait_for_timeout(1500)
        check('Idee lädt wieder', 'playing' in (await pg.evaluate(ST))[1] or 'stopped' in (await pg.evaluate(ST))[1])
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
