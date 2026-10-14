# v82: LRC exportieren (Zeile + Wortzeiten), wieder laden (gleiche Zeiten), LRC ohne Wortzeiten, Leadsheet-PDF mit Akkorden
import asyncio, json, re
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("Hold", 8, 0), ("on", 8.5, 0), ("to", 9, 0), ("the", 9.5, 0), ("nite", 10, 0), ("we", 13, 1), ("were", 13.5, 1), ("young", 14, 1), ("and", 15, 1), ("free", 15.5, 1)]]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
SECS = "(()=>{const s=Sing.source(SoloInfo());return s.tok.map(t=>[t.w,Sing.b2f(t.b,s.beats)/s.sr,t.l])})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000}, accept_downloads=True)).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(700); await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        s0 = await pg.evaluate(SECS)
        async with pg.expect_download() as dl: await pg.click('#sgLrcOut')
        txt = open(await (await dl.value).path(), encoding='utf8').read(); ls = [l for l in txt.split('\n') if re.match(r'^\[\d\d:', l)]
        m = re.match(r'^\[(\d\d):(\d\d\.\d\d)\]', ls[0]) if ls else None
        check('LRC: zwei Zeilen, Zeilenzeit = erstes Wort, Wortzeiten <..>', len(ls) == 2 and m and abs(int(m.group(1)) * 60 + float(m.group(2)) - s0[0][1]) < 0.01 and ls[0].count('<') == 5 and 'Hold' in ls[0], ls[:2])
        # zurückladen nach Änderung: gleiche Zeiten
        await pg.evaluate("Sing.lrcImport(%s)" % json.dumps("[ti:x]\n[00:01.00]<00:01.00>foo <00:02.00>bar\n")); await pg.wait_for_timeout(200)
        await pg.set_input_files('#sgLrcFile', files=[{'name': 'x.lrc', 'mimeType': 'text/plain', 'buffer': txt.encode()}]); await pg.wait_for_timeout(500)
        s1 = await pg.evaluate(SECS)
        check('LRC wieder geladen: gleiche Wörter, Zeilen, Zeiten (±10 ms)', [x[0] for x in s1] == [x[0] for x in s0] and [x[2] for x in s1] == [x[2] for x in s0] and max(abs(a[1] - c[1]) for a, c in zip(s0, s1)) < 0.011, max(abs(a[1] - c[1]) for a, c in zip(s0, s1)))
        # ohne Wortzeiten
        await pg.evaluate("Sing.lrcImport(%s)" % json.dumps("[ar:X]\n[00:10.00]eins zwei drei\n[00:14.50]vier fünf\n")); await pg.wait_for_timeout(200)
        s2 = await pg.evaluate(SECS)
        check('LRC ohne Wortzeiten: Zeilenanfang genau, Wörter danach verteilt', len(s2) == 5 and abs(s2[0][1] - 10) < 0.01 and abs(s2[3][1] - 14.5) < 0.01 and s2[0][1] < s2[1][1] < s2[2][1] < 14.5 and s2[3][2] == 1, [(x[0], round(x[1], 2)) for x in s2])
        await pg.click('#sgUndo'); await pg.wait_for_timeout(200)
        check('↶ nimmt den LRC-Import zurück', [x[0] for x in await pg.evaluate(SECS)] == [x[0] for x in s1])
        # Leadsheet
        ls2 = await pg.evaluate("Sing.leadsheet()")
        ch = [c['n'] for sc in ls2['sections'] for r in sc['rows'] for c in r['chords']]
        names = await pg.evaluate("SoloInfo().segs.map(s=>s.name)")
        check('Leadsheet: Zeilen mit Akkorden aus der Akkordleiste', len(ls2['sections'][0]['rows']) == 2 and len(ch) >= 1 and all(c in names for c in ch), (ch, ls2['sections'][0]['rows'][0]))
        async with pg.expect_download() as dl2: await pg.click('#sgLead')
        pdf = open(await (await dl2.value).path(), 'rb').read()
        check('Leadsheet als PDF', pdf[:5] == b'%PDF-' and b'Hold on to the nite' in pdf, len(pdf))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
