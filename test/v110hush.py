# v110: Studio lässt einen noch laufenden Looper (zweites Fenster) verstummen; „↩ Looper“ bei stummen Spuren erklärt und hilft
import asyncio, sys, re
from playwright.async_api import async_playwright
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, bypass_csp=True); errs = []
        lp = await ctx.new_page(); lp.on('pageerror', lambda e: errs.append(str(e)))
        await lp.goto('http://localhost:8765/index.html'); await lp.wait_for_timeout(900)
        sr = await lp.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        await lp.evaluate("(sr=>{const l=new Float32Array(sr*2).map((_, i)=>Math.sin(i/20)*0.3); Looper._setTrackRaw(0,l); const se=Looper.getSession(); se.baseL=se.tracks[0].L; Looper.loadSession(se)})(%d)" % sr)
        await lp.wait_for_timeout(500)
        check('Looper spielt', await lp.evaluate("audioCtx.state") == 'running' and await lp.evaluate("Looper.getSession() && 1") == 1)
        sp = await ctx.new_page(); sp.on('pageerror', lambda e: errs.append(str(e)))
        await sp.goto('http://localhost:8765/studio/'); await sp.wait_for_timeout(1500)
        check('Studio öffnet → Looper im anderen Fenster verstummt', await lp.evaluate("audioCtx.state") == 'suspended', await lp.evaluate("audioCtx.state"))
        check('Looper sagt warum', 'Studio' in await lp.inner_text('#loopStatus'))
        # stumme Spuren beim Zurückschreiben
        await sp.evaluate("""(async () => { const sr = Engine.sr(), l = new Float32Array(sr * 2).map((_, i) => Math.sin(i / 20) * 0.3); const m = await SDB.putAudio('x', sr, l, null);
          Proj.change('regions', q => { const t = Proj.track('audio', 'X'); t.mute = true; q.tracks.push(t); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: m.id, start: 0, offset: 0, len: m.frames, gain: 0, fi: 0, fo: 0, name: 'x' }); q.fromIdea = 'zz1'; });
          await SDB.looperPut('ideas', { id: 'zz1', v: 2, name: 'Z', ts: 1, dateStr: 'x', root: 'C', mode: 'Ionisch (Dur)', bpm: 100, secs: 1, cat: 'team', session: null, drumState: null, droneState: null }); Engine.dirty(true); UI.show('arr'); })()""")
        await sp.click('#bBack'); await sp.wait_for_timeout(800)
        check('Fenster erklärt: alle Spuren stumm', 'stumm' in await sp.inner_text('#dlg') and await sp.locator('#bkUnmute').count() == 1)
        await sp.click('#bkUnmute'); await sp.wait_for_url(re.compile(r'.*\?load=zz1|.*:8765/(index\.html)?$'), timeout=30000); await sp.wait_for_timeout(2000)
        check('„hörbar machen und speichern“ schreibt zurück und öffnet den Looper', 'Z' in await sp.input_value('#ideaName'), await sp.inner_text('#loopStatus'))
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
