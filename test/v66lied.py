# v66: Gesangsspur in der Improvisation immer sichtbar (auch leer), so hoch wie die Akkordleiste; bei Songs aus dem Songwriting
# Wörter in der Spur ändern/einfügen/löschen → landet im Songtext; Zeilen mit [Am] geschützt
import asyncio, json
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
def song(lyr):
    return {"active": "s1", "songs": [{"id": "s1", "name": "Testlied", "voice": None, "cur": 0, "versions": [{"n": 1, "at": 1, "note": "Start", "key": {"pc": 9, "major": False}, "bpm": 100, "theme": "",
      "parts": [{"id": "p1", "name": "Strophe", "type": "verse", "chords": [{"r": 9, "t": "m", "beats": 4}, {"r": 5, "t": "", "beats": 4}, {"r": 0, "t": "", "beats": 4}, {"r": 7, "t": "", "beats": 4}], "lyrics": [lyr]}],
      "order": [{"p": "p1", "reps": 1}]}]}]}
LY = "Ich singe hier\n\nund [G]dort am Meer"
LYR = "JSON.parse(localStorage.getItem('3nps-lieder')).songs[0].versions[0].parts[0].lyrics[0]"
async def start(pg):
    await pg.click('#tab-lied'); await pg.wait_for_timeout(300); await pg.evaluate("document.getElementById('ldTL').checked=true"); await pg.click('#ldPlay'); await pg.wait_for_timeout(1300)
    await pg.click('#tab-solo'); await pg.wait_for_timeout(700)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        # 1) leerer Songtext: Spur trotzdem da, Wort einfügen schreibt in den Song
        await pg.add_init_script("if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-lieder', %s);}" % json.dumps(json.dumps(song(""))))
        await pg.goto(U); await pg.wait_for_timeout(800); await start(pg)
        h = await pg.evaluate("[!document.getElementById('sgBand').hidden, document.getElementById('sgStrip').offsetHeight, document.getElementById('sfStrip').offsetHeight, (document.querySelector('#sgStrip .sg-hint')||{}).textContent||'']")
        check('ohne Text: Spur sichtbar, gleich hoch, Hinweis', h[0] and h[1] == h[2] and 'einfügen' in h[3], h)
        x = await pg.evaluate("(()=>{const s=document.getElementById('sgStrip'),r=s.getBoundingClientRect(),ci=SoloInfo(),src=Sing.source(ci);return [r.left+src.toCi(4)/ci.L*parseFloat(s.style.width), r.top+86]})()")
        await pg.mouse.click(*x); await pg.wait_for_timeout(250)
        await pg.fill('#sgStrip .sg-inline input', 'Hallo Welt'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        check('Wörter in leere Spur eingefügt → Songtext', await pg.evaluate(LYR) == 'Hallo Welt', await pg.evaluate(LYR))
        check('eingefügte Wörter stehen in der Spur', await pg.evaluate("document.querySelectorAll('#sgStrip .sg-w').length") == 2)
        # 2) Song mit Text, Leerzeile und Akkordmarke
        await pg.evaluate("t=>{const d=JSON.parse(localStorage.getItem('3nps-lieder'));d.songs[0].versions[0].parts[0].lyrics=[t];localStorage.setItem('3nps-lieder',JSON.stringify(d));localStorage.removeItem('3nps-sing');}", LY)
        await pg.reload(); await pg.wait_for_timeout(800); await start(pg)
        await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('3nps-sing'));const r=d.l['s1|p1|0'];r.tok.forEach((t,i)=>t.b=1+i);localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})()")
        await pg.wait_for_timeout(500)
        n = await pg.evaluate("document.querySelectorAll('#sgStrip .sg-w').length")
        check('Songtext in der Spur (Akkordmarke entfernt)', n == 7, n)
        await pg.click('#sgStrip .sg-w[data-i="1"]'); await pg.wait_for_timeout(200)
        await pg.fill('#sgStrip .sg-inline input', 'sing'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        lyr = await pg.evaluate(LYR)
        check('Wort geändert → Songtext, Leerzeile und Akkordzeile unverändert', lyr == "Ich sing hier\n\nund [G]dort am Meer", repr(lyr))
        tm = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-sing')).l['s1|p1|0'].tok.map(t=>t.b)")
        check('Zeiten bleiben erhalten', tm[:3] == [1, 2, 3], tm)
        # Zeile mit Akkordmarke: Änderung wird abgelehnt, Text bleibt
        await pg.click('#sgStrip .sg-w[data-i="4"]'); await pg.wait_for_timeout(200)
        await pg.fill('#sgStrip .sg-inline input', 'hier'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        lyr2 = await pg.evaluate(LYR); w4 = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-sing')).l['s1|p1|0'].tok[4].w")
        check('Akkordzeile geschützt: Songtext unverändert, Wort zurückgesetzt', lyr2 == lyr and w4 == 'dort', (repr(lyr2), w4))
        # Wort löschen in normaler Zeile
        await pg.click('#sgStrip .sg-w[data-i="2"]'); await pg.wait_for_timeout(150); await pg.dispatch_event('#sgStrip .sg-inline .sg-del', 'pointerdown'); await pg.wait_for_timeout(400)
        check('Wort gelöscht → Songtext', await pg.evaluate(LYR) == "Ich sing\n\nund [G]dort am Meer", repr(await pg.evaluate(LYR)))
        # Songwriting zeigt den neuen Text
        await pg.click('#tab-lied'); await pg.wait_for_timeout(500)
        check('Songwriting-Textfeld zeigt den neuen Text', 'Ich sing\n' in await pg.evaluate("[...document.querySelectorAll('.ld-txt')].map(t=>t.value).join('|')"))
        check('keine neue Version angelegt', await pg.evaluate("JSON.parse(localStorage.getItem('3nps-lieder')).songs[0].versions.length") == 1)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
