# v107: Name der geladenen Idee (Feld + Spur), Aktualisieren statt Doppelt, Spur → Studio → „↩ Looper“ → weiter im Looper
import asyncio, sys, re
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1024, 'height': 1366}, bypass_csp=True)).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(900)
        check('v111', 'v111' in await pg.inner_text('.brand'))
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        await pg.evaluate("(sr=>{const l=new Float32Array(sr*2).map((_, i)=>Math.sin(i/20)*0.3); Looper._setTrackRaw(0,l); Looper._setTrackRaw(1,l.map(v=>v*0.5)); const se=Looper.getSession(); se.baseL=se.tracks[0].L; Looper.loadSession(se)})(%d)" % sr)
        n_ideas = lambda: pg.evaluate("AppDB.list('ideas', i => i.name).then(a=>a.length)")
        await pg.evaluate("document.getElementById('ideaFold').open=true"); await pg.fill('#ideaName', 'Rund'); await pg.click('#ideaSave'); await pg.wait_for_timeout(700)
        check('Name bleibt nach dem Speichern im Feld, Knopf heißt „Aktualisieren“', await pg.input_value('#ideaName') == 'Rund' and 'Aktualisieren' in await pg.inner_text('#ideaSave'))
        await pg.wait_for_timeout(800)
        check('Spur zeigt den Namen', 'Rund' == await pg.inner_text('.track.t1 .tsrc'), await pg.evaluate("[...document.querySelectorAll('.tsrc')].map(e=>e.textContent)"))
        await pg.click('#ideaSave'); await pg.wait_for_timeout(700)
        check('nochmal speichern = aktualisieren (keine Doppelte)', await n_ideas() == 1 and 'Aktualisiert' in await pg.inner_text('#loopStatus'), await pg.inner_text('#loopStatus'))
        await pg.fill('#ideaName', 'Rund 2'); check('Hinweis bei neuem Namen', 'neue Idee' in await pg.inner_text('#ideaHint'))
        await pg.click('#ideaSave'); await pg.wait_for_timeout(700)
        check('anderer Name = neue Idee', await n_ideas() == 2)
        # Laden: Name ins Feld, an die Spur
        await pg.reload(); await pg.wait_for_timeout(900); await pg.evaluate("document.getElementById('ideaFold').open=true")
        await pg.locator('.idea-row', has_text='Rund').filter(has_not_text='Rund 2').locator('[data-act="load"]').click(); await pg.wait_for_timeout(1200)
        check('Laden: Name steht im Speicherfeld', await pg.input_value('#ideaName') == 'Rund')
        ts = await pg.evaluate("[...document.querySelectorAll('.tsrc')].map(e=>e.textContent)"); check('Laden: Spuren zeigen „· Rund“', ts[:2] == ['Rund', 'Rund'], ts)
        check('Knopf „Im Studio ↗“ an jeder Spur', await pg.locator('.studio-btn').count() == 3)
        # Spur → Studio
        await pg.click('#studiob0'); await pg.wait_for_url(re.compile(r'.*/studio/.*'), timeout=10000); await pg.wait_for_timeout(2500)
        P = await pg.evaluate("({n:Proj.P.tracks.length, from:!!Proj.P.fromIdea, name:Proj.P.name, view:UI.view, back:!document.getElementById('bBack').hidden})")
        check('Studio: Projekt direkt aus der Idee (2 Spuren, Arrangement, „↩ Looper“)', P['n'] == 2 and P['from'] and P['name'] == 'Rund' and P['view'] == 'arr' and P['back'], P)
        check('nicht doppelt gespeichert (Idee war unverändert)', await pg.evaluate("SDB.looperList(i=>i.name).then(a=>a.length)") == 2)
        # Drummer dazu, zurück
        await pg.evaluate("(()=>{const t=Proj.addTrack('drum','Drummer'); Drum.addDefault(t.id); const r=Proj.P.regions.find(r=>r.kind==='drum'); Proj.editRegion(r.id,q=>{q.start=0;q.len=Math.round(Proj.bar()*2)})})()")
        await pg.wait_for_timeout(1500)
        await pg.click('#bBack'); await pg.wait_for_url(re.compile(r'.*/index\.html$|.*/3nps/?$|.*:8765/$'), timeout=60000); await pg.wait_for_timeout(2500)
        st = await pg.inner_text('#loopStatus')
        check('Zurück im Looper: Idee geladen', 'Aus dem Studio zurück' in st and 'Rund' in st, st)
        se = await pg.evaluate("(()=>{const s=Looper.getSession(); return s && s.tracks.map(t=>t&&t.L)})()")
        check('Looper hat die Studio-Spuren (3: 2 Audio + Drummer)', se and len([x for x in se if x]) == 3, se)
        check('Name und Spur-Namen bleiben', await pg.input_value('#ideaName') == 'Rund' and 'Rund' == await pg.evaluate("document.querySelector('.tsrc').textContent"))
        # nochmal ins Studio ohne Änderung → dasselbe Projekt (mit Drummer-Spur als Drummer)
        await pg.wait_for_timeout(700); await pg.click('#studiob1'); await pg.wait_for_url(re.compile(r'.*/studio/.*'), timeout=10000); await pg.wait_for_timeout(2000)
        k = await pg.evaluate("Proj.P.tracks.map(t=>t.kind)")
        check('wieder ins Studio: gleiches Projekt, Drummer bleibt bearbeitbar', k == ['audio', 'audio', 'drum'], k)
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
