# v106: Ideen in Ordner verschieben – einzeln (📁-Auswahl) und mehrere auf einmal
import asyncio, sys
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for vw in [(1024, 1366), (390, 844)]:
            pg = await (await b.new_context(viewport={'width': vw[0], 'height': vw[1]}, bypass_csp=True)).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U); await pg.wait_for_timeout(900)
            sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
            await pg.evaluate("(sr=>{const l=new Float32Array(sr).map((_, i)=>Math.sin(i/20)*0.2); Looper._setTrackRaw(0,l)})(%d)" % sr)
            for k in range(4): await pg.evaluate("AppDB.put('ideas',{id:'a%d',v:2,name:'Alt %d',ts:%d,dateStr:'x',root:'A',mode:'Äolisch (Moll)',bpm:90,secs:1,session:Looper.getSession(),drumState:null,droneState:null})" % (k, k, k + 1))
            await pg.reload(); await pg.wait_for_timeout(900)
            await pg.evaluate("document.getElementById('ideaFold').open=true")
            cats = lambda: pg.evaluate("AppDB.list('ideas', i => [i.id, i.cat||'idee']).then(a=>Object.fromEntries(a))")
            await pg.select_option('.idea-row[data-id="a0"] .idea-move', 'loop'); await pg.wait_for_timeout(500)
            check('%dpx: einzeln verschieben (📁-Auswahl)' % vw[0], (await cats())['a0'] == 'loop')
            check('%dpx: Auswahl ist als Ordner erkennbar' % vw[0], '📁' in await pg.inner_text('.idea-row[data-id="a1"] .idea-move'))
            await pg.click('#ideaSelBtn'); await pg.wait_for_timeout(200)
            check('%dpx: „Mehrere verschieben“ zeigt Häkchen' % vw[0], await pg.locator('.idea-pick').count() == 4 and await pg.is_disabled('#ideaBulkTo [data-c="team"]'))
            await pg.click('.idea-row[data-id="a1"] .idea-name'); await pg.click('.idea-row[data-id="a2"] .idea-pick')
            check('%dpx: 2 ausgewählt' % vw[0], '2' in await pg.inner_text('#ideaSelN'))
            await pg.click('#ideaBulkTo [data-c="team"]'); await pg.wait_for_timeout(700)
            c = await cats()
            check('%dpx: beide nach „Zusammenarbeit“, Rest unverändert' % vw[0], c['a1'] == 'team' and c['a2'] == 'team' and c['a3'] == 'idee' and c['a0'] == 'loop', c)
            check('%dpx: Auswahlmodus beendet' % vw[0], await pg.locator('.idea-pick').count() == 0 and await pg.is_visible('#ideaSelBtn'))
            await pg.click('#ideaSelBtn'); await pg.click('#ideaSelAll'); await pg.click('#ideaBulkTo [data-c="backing"]'); await pg.wait_for_timeout(800)
            check('%dpx: „Alle wählen“ → alle nach Backing Track' % vw[0], set((await cats()).values()) == {'backing'})
            await pg.locator('.idea-row[data-id="a3"] [data-act="load"]').click(); await pg.wait_for_timeout(700)
            check('%dpx: Laden geht danach normal' % vw[0], 'geladen' in await pg.inner_text('#loopStatus'))
            check('%dpx: keine Fehler' % vw[0], not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
