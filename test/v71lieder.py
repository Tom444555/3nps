# v71: Ideen und „Lieder mit Text“ aufklappbar; Songdatei + Text speichern, laden (ohne Rückfrage, Text zurück), Text teilen, löschen; v24 sieht den Eintrag als Idee
import asyncio, json, sys
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'; P = 'http://localhost:8790/3nps/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("Hold", 8, 0), ("on", 8.5, 0), ("to", 9, 0), ("the", 9.5, 0), ("nite", 10, 0), ("we", 13, 1), ("were", 13.5, 1), ("young", 14, 1), ("and", 15, 1), ("free", 15.5, 1)]]
KEY = 'ballad_72.wav|420'
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {KEY: {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
LIED = "AppDB.all('ideas').then(a=>a.filter(x=>x.kind==='lied').map(x=>({name:x.name,n:x.tok.length,size:x.wav&&x.wav.size,key:x.singKey,fname:x.fname,choice:x.choice})))"
async def loadfile(pg):
    await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
    for _ in range(60):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        f = await pg.evaluate("[!!document.querySelector('#ideaFold summary h2'), !!document.querySelector('#lsFold summary h2'), document.getElementById('ideaFold').open]")
        check('Ideen und Lieder mit Text als aufklappbare Bereiche', f[0] and f[1], f)
        await pg.evaluate("localStorage.removeItem('3nps-fold-ideaFold')")
        await loadfile(pg)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(700)
        check('Improvisation: Knopf „💾 Lied speichern“ sichtbar', await pg.is_visible('#sgSave'))
        await pg.click('#sgSave'); await pg.wait_for_timeout(600)
        t = await pg.inner_text('#sgSave'); e = await pg.evaluate(LIED)
        check('gespeichert: ganze Datei + 10 Wörter + Schlüssel', len(e) == 1 and e[0]['n'] == 10 and e[0]['size'] > 100000 and e[0]['key'] == KEY and e[0]['fname'] == 'ballad_72.wav', (t, e))
        check('Rückmeldung am Knopf', 'Gespeichert' in t, t)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(400)
        await pg.fill('#lsName', 'Ballade'); await pg.click('#lsSave'); await pg.wait_for_timeout(500)
        e = await pg.evaluate(LIED)
        check('nochmal speichern aktualisiert (kein Doppel), neuer Name', len(e) == 1 and e[0]['name'] == 'Ballade', e)
        rows = await pg.evaluate("[document.querySelectorAll('#lsList .idea-row').length, document.querySelector('#lsList .log-meta').textContent, document.getElementById('lsCount').textContent, [...document.querySelectorAll('#ideaList .idea-name')].map(x=>x.textContent)]")
        check('Liste: Wörter/Zeilen/Länge, Zähler; nicht unter Ideen', rows[0] == 1 and '10 Wörter' in rows[1] and '2 Zeilen' in rows[1] and rows[2] == '1' and 'Ballade' not in rows[3], rows)
        # Text als Datei
        async with pg.expect_download() as dl:
            await pg.click('#lsList [data-act="text"]')
        txt = open(await (await dl.value).path(), encoding='utf8').read()
        check('Text als Datei mit Zeilen', 'Hold on to the nite\nwe were young and free' in txt, txt[:80])
        # neu starten ohne Text auf dem Gerät, Spuren leer → Laden bringt Datei und Text zurück, ohne Rückfrage
        await pg.evaluate("localStorage.removeItem('3nps-sing')"); await pg.reload(); await pg.wait_for_timeout(900)
        check('nach Neustart: Bereich zugeklappt gemerkt?', await pg.evaluate("document.getElementById('lsFold').open"))
        dlg = []
        await pg.click('#lsList [data-act="load"]')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): dlg.append(1); await pg.click('#impOk')
            if 'mit Text' in await pg.inner_text('#lsInfo'): break
        st = await pg.evaluate("[Looper.singSrc(0)&&Looper.singSrc(0).key, Object.values(JSON.parse(localStorage.getItem('3nps-sing')||'{\"f\":{}}').f).map(r=>r.tok.length)]")
        check('Laden: Datei auf Spur 1, Text wiederhergestellt, keine Rückfrage', st[0] == KEY and st[1] == [10] and not dlg, (st, dlg, await pg.inner_text('#lsInfo')))
        await pg.click('#tab-solo'); await pg.wait_for_timeout(700)
        check('Improvisation zeigt den Text', await pg.evaluate("document.querySelectorAll('#sgStrip .sg-w').length") == 10)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        # zweites Laden bei belegter Spur 1 → Spur 2
        await pg.click('#lsList [data-act="load"]')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if 'Spur 2' in await pg.inner_text('#lsInfo'): break
        check('belegte Spur bleibt, Lied kommt auf die nächste freie', 'Spur 2' in await pg.inner_text('#lsInfo'), await pg.inner_text('#lsInfo'))
        # EN
        await pg.evaluate("localStorage.setItem('3nps-lang','en')"); await pg.reload(); await pg.wait_for_timeout(900)
        en = await pg.evaluate("[document.querySelector('#lsFold h2').textContent, document.getElementById('lsSave').textContent, document.querySelector('#lsList .log-meta').textContent]")
        check('Englisch', en[0] == 'Songs with lyrics' and en[1] == 'Save song with lyrics' and 'words' in en[2], en)
        await pg.evaluate("localStorage.setItem('3nps-lang','de')"); await pg.reload(); await pg.wait_for_timeout(900)
        await pg.click('#lsList [data-act="del"]'); await pg.wait_for_timeout(500)
        check('Löschen', await pg.evaluate(LIED) == [] and await pg.evaluate("document.querySelectorAll('#lsList .idea-row').length") == 0)
        check('keine Skriptfehler', not errs, errs)
        await ctx.close()
        # v24 (gleicher Speicher): Eintrag erscheint als Idee und lädt als Audio
        ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); pg = await ctx.new_page(); errs2 = []
        pg.on('pageerror', lambda e: errs2.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.add_init_script(INIT); await pg.goto(P); await pg.wait_for_timeout(900)
        await loadfile(pg); await pg.evaluate("Lieder.save('Ballade')"); await pg.wait_for_timeout(600)
        await pg.goto(P + 'stabil/'); await pg.wait_for_timeout(1200)
        nm = await pg.evaluate("[...document.querySelectorAll('#ideaList .idea-name')].map(x=>x.textContent)")
        check('v24: Lied erscheint als Idee', 'Ballade' in nm, nm)
        await pg.click('#ideaList [data-act="load"]'); await pg.wait_for_timeout(2500)
        s = await pg.inner_text('#loopStatus')
        check('v24: Laden legt die Datei auf Spur 1', 'Spur 1' in s and not errs2, (s, errs2))
        await pg.goto(P); await pg.wait_for_timeout(1000)
        check('zurück in der neuen Fassung: weiter unter „Lieder mit Text“', await pg.evaluate("document.querySelectorAll('#lsList .idea-row').length") == 1)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
