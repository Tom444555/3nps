# v102: Ablagen beim Speichern (Idee, Reiner Loop, Backing Track, Zusammenarbeit), Filter, Verschieben, alte Ideen = „Idee“
import asyncio, re
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1024, 'height': 1366})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(900)
        check('Version ≥ v102', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 102)
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        await pg.evaluate("(sr=>{const l=new Float32Array(sr*2);for(let i=0;i<l.length;i++)l[i]=Math.sin(i/20)*0.2;Looper._setTrackRaw(0,l)})(%d)" % sr)
        # alte Idee ohne Ablage (wie aus v101)
        await pg.evaluate("AppDB.put('ideas',{id:'alt1',v:2,name:'Alte Idee',ts:1,dateStr:'01.01.26',root:'A',mode:'Äolisch (Moll)',bpm:90,secs:2,session:Looper.getSession(),drumState:null,droneState:null})")
        await pg.evaluate("document.getElementById('ideaFold').open=true")
        for cat, name in [('loop', 'Mein Loop'), ('backing', 'Mein Backing'), ('team', 'Für Claude'), ('idee', 'Neue Idee')]:
            await pg.click('#ideaCat [data-c="%s"]' % cat)
            if cat == 'loop': check('„Reiner Loop“ schaltet Drums und Drone aus', not await pg.is_checked('#ideaWithDrums') and not await pg.is_checked('#ideaWithDrone'))
            if cat == 'backing': check('„Backing Track“ schaltet Drums und Drone ein', await pg.is_checked('#ideaWithDrums') and await pg.is_checked('#ideaWithDrone'))
            await pg.fill('#ideaName', name); await pg.click('#ideaSave'); await pg.wait_for_timeout(700)
        cats = await pg.evaluate("AppDB.list('ideas', i => ({n: i.name, c: i.cat || null}))")
        m = {x['n']: x['c'] for x in cats}
        check('Ablage gespeichert', m.get('Mein Loop') == 'loop' and m.get('Mein Backing') == 'backing' and m.get('Für Claude') == 'team' and m.get('Neue Idee') == 'idee', m)
        rows = lambda: pg.evaluate("[...document.querySelectorAll('#ideaList .idea-row .idea-name span[translate]')].map(e=>e.textContent)")
        await pg.click('#ideaFilter [data-f="idee"]'); await pg.wait_for_timeout(400); r = await rows()
        check('Filter „Ideen“: neue + alte Idee (ohne Ablage)', sorted(r) == ['Alte Idee', 'Neue Idee'], r)
        await pg.click('#ideaFilter [data-f="backing"]'); await pg.wait_for_timeout(400); r = await rows(); check('Filter „Backing Tracks“', r == ['Mein Backing'], r)
        check('Filter zeigt Anzahl', 'Backing Tracks 1' in await pg.inner_text('#ideaFilter'), await pg.inner_text('#ideaFilter'))
        await pg.select_option('#ideaList .idea-row .idea-move', 'team'); await pg.wait_for_timeout(500)
        r = await rows(); await pg.click('#ideaFilter [data-f="team"]'); await pg.wait_for_timeout(400); r2 = await rows()
        check('Verschieben: Backing → Zusammenarbeit', r == [] and sorted(r2) == ['Für Claude', 'Mein Backing'], (r, r2))
        await pg.reload(); await pg.wait_for_timeout(900)
        check('Filter und Ablage bleiben nach Neustart', 'active' in await pg.get_attribute('#ideaFilter [data-f="team"]', 'class') and 'active' in await pg.get_attribute('#ideaCat [data-c="idee"]', 'class'))
        await pg.evaluate("document.getElementById('ideaFold').open=true"); await pg.click('#ideaFilter [data-f="all"]')
        await pg.click('#ideaList .idea-row [data-act="load"]'); await pg.wait_for_timeout(800)
        check('Laden funktioniert weiter', 'geladen' in await pg.inner_text('#loopStatus'), await pg.inner_text('#loopStatus'))
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
