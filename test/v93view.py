# v93: Einfügen ohne Zeilenumbrüche teilt automatisch; Mitsingen: Abstand bei Pausen, große Akkorde mit Dauer-Balken, Pausenbalken läuft ab
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
L = [("Hold on to the night", 8), ("we were young and free", 13), ("the river runs so cold", 26), ("and nobody can see", 31)]
TOK = [{"w": w, "b": b0 + k * 0.5 + (1.5 if k >= 3 else 0), "l": l} for l, (txt, b0) in enumerate(L) for k, w in enumerate(txt.split())]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
SEEK = "(b=>{const s=Sing.source(SoloInfo());Looper.seek(0,Sing.b2f(b,s.beats)-s.origPos)})(%f)"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 820})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        for _ in range(40):
            if await pg.evaluate("!!(window.SoloInfo && Sing.source(SoloInfo()))"): break
            await pg.wait_for_timeout(250)
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(400); await pg.click('#tab-singen')
        await pg.evaluate(SEEK % 13.8); await pg.wait_for_timeout(800)
        r = await pg.evaluate("""(()=>{const row=document.querySelector('#sbList .sb-row.cur');const ws=[...row.querySelectorAll('.sb-w')];
          return {pl:ws.map(w=>getComputedStyle(w).paddingLeft), ch:row.querySelectorAll('.sb-ch').length, chf:row.querySelector('.sb-ch')&&parseFloat(getComputedStyle(row.querySelector('.sb-ch')).fontSize), wf:parseFloat(getComputedStyle(row.querySelector('.sb-line')).fontSize),
          cb:ws.filter(w=>w.querySelector('.sb-cb')).length, q:ws.map(w=>{const i=w.querySelector('.sb-cb i');return i?i.style.transform:''}), chon:row.querySelectorAll('.sb-w.chon').length}})()""")
        pls = [float(x[:-2]) for x in r['pl']]
        check('Pause zwischen „young“ und „and“: größerer Abstand, sonst normal', pls[3] > 20 and max(pls[:3] + pls[4:]) < 1, pls)
        check('Akkorde fast so groß wie die Wörter (≥ 85 %)', r['ch'] >= 1 and r['chf'] >= 0.85 * r['wf'], (r['chf'], r['wf']))
        check('v94: keine Akkordbalken mehr, klingender Akkord leuchtet', r['cb'] == 0 and r['chon'] >= 1, (r['cb'], r['chon']))
        g = []
        for bb in (21.0, 23.5):
            await pg.evaluate(SEEK % bb); await pg.wait_for_timeout(700)
            g.append(await pg.evaluate("(()=>{const e=document.querySelector('#sbList .sb-gap.on .sb-gaptrack i');return e?parseFloat(e.style.transform.slice(7)):null})()"))
        check('Pausenbalken sichtbar und läuft herunter', g[0] is not None and g[1] is not None and g[0] > g[1] > 0, g)
        # Einfügen eines Textes ohne Zeilenumbrüche → automatisch geteilt
        await pg.click('#tab-solo'); await pg.wait_for_timeout(300); await pg.click('#sgToggle'); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelectorAll('#sgEdit details.sg-paste').forEach(d=>d.open=true)")
        await pg.fill('#sgText', ' '.join(x for x, _ in L) + ' ' + ' '.join(x for x, _ in L)); await pg.click('#sgTake'); await pg.wait_for_timeout(400)
        r2 = await pg.evaluate("(()=>{const s=Sing.source(SoloInfo());return {l:s.tok.map(t=>t.l), st:document.getElementById('sgStatus').textContent, warn:!!document.getElementById('sgSplit')}})()")
        check('Einfügen ohne Umbrüche: automatisch geteilt, Meldung, keine Warnung mehr', max(r2['l']) >= 3 and max(r2['l'].count(x) for x in set(r2['l'])) <= 10 and 'automatisch' in r2['st'] and not r2['warn'], (r2['l'], r2['st'][-90:]))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
