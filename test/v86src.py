# v86: richtige Quelle im Mitsingen – Ladedialog bietet „Andere Spuren leeren“ (bei vorhandenem Text vorgewählt), Mitsingen zeigt den Text
# der geladenen Datei und scrollt mit; gedehnte Datei → klare Meldung statt Text eines anderen Liedes; Improvisation folgt der neuen Spur
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
A = [{"w": w, "b": 8 + k * 0.5, "l": 0} for k, w in enumerate("alter Text vom ersten Lied".split())]
B = [{"w": "neu%d" % i, "b": 12 + i * 0.75, "l": i // 4} for i in range(16)]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": A}, "silben.wav|420": {"name": "silben.wav", "tok": B}}, "l": {}}))
async def load(pg, f, inp, clear=None):
    dlg = None
    await pg.set_input_files(inp, f)
    for _ in range(100):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'):
            dlg = [await pg.is_visible('#impClearRow'), await pg.is_checked('#impClear')]
            if clear is not None and dlg[0]: await (pg.check('#impClear') if clear else pg.uncheck('#impClear'))
            await pg.click('#impOk')
        st = await pg.inner_text('#loopStatus')
        if 'Takt erkannt' in st or 'Tempo des Loops' in st or 'Loop erkannt' in st: break
    await pg.wait_for_timeout(800); return dlg
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 820})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0')
        d1 = await load(pg, T + 'corpus/ballad_72.wav', '#file0')
        check('erste Datei: kein Leeren-Angebot (keine anderen Spuren)', d1 and d1[0] is False, d1)
        d2 = await load(pg, T + 'sing/silben.wav', '#file1')
        check('zweite Datei mit Text: „Andere Spuren leeren“ angeboten und vorgewählt', d2 == [True, True], d2)
        st = await pg.evaluate("[Looper.trackUsed(0), Looper.singSrc(1) && Looper.singSrc(1).key]")
        check('Spur 1 geleert, Lied ungedehnt auf Spur 2', st == [False, 'silben.wav|420'], st)
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.wait_for_timeout(300)
        check('Improvisation folgt der neuen Spur', await pg.evaluate("SoloInfo().track") == 1)
        await pg.click('#tab-singen')
        await pg.evaluate("(()=>{const s=Looper.singSrc(1);Looper.seek(1,Sing.b2f(11.5,s.beats)-s.origPos)})()"); await pg.wait_for_timeout(600)
        w = await pg.evaluate("document.getElementById('sbLine') && document.getElementById('sbLine').textContent"); y1 = await pg.evaluate("document.getElementById('sbList').style.transform")
        check('Mitsingen zeigt den Text der geladenen Datei', w and 'neu0' in w and 'alter' not in w, w)
        await pg.wait_for_timeout(3500)
        y2 = await pg.evaluate("document.getElementById('sbList').style.transform"); l2 = await pg.evaluate("+document.querySelector('#sbList .sb-row.cur').dataset.l")
        check('Text scrollt beim Abspielen mit', y2 != y1 and l2 >= 1, (y1, y2, l2))
        # dritte Datei ohne Leeren → gedehnt: kein fremder Text, sondern Hinweis
        await pg.click('#tab-looper'); await load(pg, T + 'corpus/ballad_72.wav', '#file0', clear=False)
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.evaluate("Looper.seek(0, 10)"); await pg.click('#tab-singen'); await pg.wait_for_timeout(800)
        info = await pg.evaluate("[document.getElementById('sbLine') && document.getElementById('sbLine').textContent, SoloInfo().track]")
        check('gedehnte Datei ohne Text: Mitsingen bleibt beim laufenden Lied mit Text (nie der alte fremde Text)', info[0] and 'neu' in info[0] and 'alter' not in info[0], info)
        # nur die gedehnte Datei läuft → Hinweis
        await pg.click('#tab-looper'); await pg.click('#clear1'); await pg.wait_for_timeout(200); await pg.click('#clear1'); await pg.wait_for_timeout(300)
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-singen'); await pg.wait_for_timeout(800)
        e = await pg.evaluate("[Looper.trackUsed(1), document.getElementById('sbEmpty').hidden, document.getElementById('sbEmpty').textContent]")
        check('läuft nur eine Datei ohne Text: Hinweis statt fremdem Text', e[1] is False and ('Text mit Zeiten' in e[2] or 'gedehnt' in e[2]), e)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
