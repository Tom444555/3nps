# v46: Backing Track – Beat-Auswahl (gleich wie Looper-Drums), neue Beats, Synth-Klänge (alle hörbar, keine späten Schläge)
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
TAP = """(()=>{ensureAudio(); const an=audioCtx.createAnalyser(); an.fftSize=2048; ensureMasterBus().connect(an); window.__an=an; window.__lvl=()=>{const d=new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let q=0; for(const v of d) q+=v*v; return Math.sqrt(q/d.length)}; return true})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.click('#tab-jam'); await pg.wait_for_timeout(300)
        opts = await pg.evaluate("[...document.getElementById('jamStyle').options].map(o=>o.value)")
        check('Beat-Auswahl im Backing Track mit neuen Beats', all(k in opts for k in ['house', 'techno', 'trap', 'lofi', 'synthwave', 'breakbeat', 'samba', 'cumbia', 'ballad68', 'rock']), len(opts))
        await pg.select_option('#jamStyle', 'house'); await pg.wait_for_timeout(150)
        check('Beat-Auswahl stellt Looper-Drums mit um', await pg.evaluate("document.getElementById('loopDrumStyle').value") == 'house')
        await pg.select_option('#loopDrumStyle', 'funk'); await pg.wait_for_timeout(150)
        check('Umgekehrt auch', await pg.evaluate("document.getElementById('jamStyle').value") == 'funk')
        await pg.evaluate(TAP)
        # Synth allein (Drums aus, Bass aus) – jeder Klang muss hörbar sein
        if await pg.is_checked('#jamDrums'): await pg.click('#jamDrums')
        if (await pg.inner_text('#jamBass')).strip() != 'Bass aus': await pg.click('#jamBass')
        if not await pg.is_checked('#jamPad'): await pg.click('#jamPad')
        await pg.click('#jamPlay'); await pg.wait_for_timeout(2600)
        lv = {}
        for snd in ['pad', 'warm', 'strings', 'organ', 'epiano', 'bell', 'pluck', 'arp']:
            await pg.select_option('#jamSound', snd); await pg.wait_for_timeout(1300)
            m = 0
            for _ in range(8): m = max(m, await pg.evaluate("__lvl()")); await pg.wait_for_timeout(90)
            lv[snd] = round(m, 4)
        check('Alle Synth-Klänge hörbar', all(v > 0.004 for v in lv.values()), lv)
        check('Klang wird gespeichert', await pg.evaluate("JSON.parse(localStorage.getItem('3nps-jam')||'{}').padSound") == 'arp')
        await pg.click('#jamPlay'); await pg.wait_for_timeout(400)
        # Mit Drums: neue Beats spielen ohne späte Schläge, Arpeggio dazu
        await pg.click('#jamDrums')
        late0 = await pg.evaluate("Rhythm.debug().late")
        await pg.click('#jamPlay'); await pg.wait_for_timeout(500)
        for k in ['house', 'techno', 'trap', 'lofi', 'synthwave', 'breakbeat', 'samba', 'cumbia', 'ballad68']:
            await pg.select_option('#jamStyle', k); await pg.wait_for_timeout(900)
        late = await pg.evaluate("Rhythm.debug().late") - late0
        steps = await pg.evaluate("Rhythm.debug().steps.length")
        check('Neue Beats laufen, keine späten Schläge', late == 0 and steps > 0, (late, steps))
        await pg.click('#jamPlay')
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
