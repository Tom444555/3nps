# v85: Mitsingen als mitlaufende Liste (aktuelle Zeile groß, Wort eingefärbt, Akkorde groß), Pausen mit Sekunden, Zeile antippen; Dateien bis 10 Minuten
import asyncio, json, re
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
L = [("Hold on to the night", 8), ("we were young and free", 14), ("the river runs so cold", 22), ("and nobody can see", 28), ("now we are coming home", 40), ("under a silver sky", 46)]
TOK = [{"w": w, "b": b0 + k * 0.5, "l": l} for l, (txt, b0) in enumerate(L) for k, w in enumerate(txt.split())]
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
            if await pg.evaluate("!!(window.SoloInfo && Sing.source(SoloInfo()) && Sing.source(SoloInfo()).beats)"): break
            await pg.wait_for_timeout(250)
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-singen'); await pg.evaluate(SEEK % 9.2); await pg.wait_for_timeout(700)
        st = await pg.evaluate("""(()=>{const rows=[...document.querySelectorAll('#sbList .sb-row')],cur=document.querySelector('#sbList .sb-row.cur'),w=cur.querySelector('.sb-w.on'),
          f=x=>parseFloat(getComputedStyle(x).fontSize);return {n:rows.length,cur:+cur.dataset.l,big:f(cur.querySelector('.sb-line')),small:f(rows[3].querySelector('.sb-line')),
          on:w&&w.textContent.replace(/[+-]?\\d+/g,''),col:w&&getComputedStyle(w).color,acc:getComputedStyle(document.documentElement).getPropertyValue('--accent'),
          ch:cur.querySelector('.sb-ch')?f(cur.querySelector('.sb-ch')):0,y:document.getElementById('sbList').style.transform}})()""")
        check('ganzer Text als Liste, alle Zeilen gleich groß (v95: ruhig, aktuelle nur heller)', st['n'] == 6 and st['cur'] == 0 and st['big'] == st['small'] and st['big'] >= 24, st)
        acc = st['acc'].strip().lstrip('#'); rgb = 'rgb(%d, %d, %d)' % tuple(int(acc[i:i + 2], 16) for i in (0, 2, 4)) if len(acc) == 6 else ''
        check('aktuelles Wort eingefärbt (Akzentfarbe)', st['on'] in ('on', 'to', 'the') and st['col'] == rgb, (st['on'], st['col'], st['acc']))
        check('Akkorde gut lesbar (≥ 25 px)', st['ch'] >= 25, st['ch'])
        y0 = st['y']
        await pg.evaluate(SEEK % 22.4); await pg.wait_for_timeout(900)
        st2 = await pg.evaluate("[+document.querySelector('#sbList .sb-row.cur').dataset.l, document.getElementById('sbList').style.transform, document.getElementById('sbLine').closest('.sb-row').dataset.l]")
        check('Text scrollt mit (Zeile 3 in der Mitte, #sbLine = aktuelle Zeile)', st2[0] == 2 and st2[1] != y0 and st2[2] == '2', (y0, st2))
        # Pause zwischen Zeile 4 und 5 (Schlag 30 … 40): Pausenzeile aktiv mit Sekunden, die herunterzählen
        g = await pg.evaluate("[...document.querySelectorAll('#sbList .sb-gap')].map(x=>[x.dataset.g, x.textContent])")
        await pg.evaluate(SEEK % 31.5); await pg.wait_for_timeout(500)
        a = await pg.evaluate("[document.querySelector('#sbList .sb-gap.on') && document.querySelector('#sbList .sb-gap.on').textContent, document.getElementById('sbWait').textContent]")
        await pg.wait_for_timeout(1200)
        c = await pg.evaluate("document.querySelector('#sbList .sb-gap.on') && document.querySelector('#sbList .sb-gap.on').textContent")
        num = lambda s: float(re.search(r'([\d,]+) s', s).group(1).replace(',', '.')) if s and re.search(r'([\d,]+) s', s) else None
        check('Pausen sind zu sehen (mit Länge)', len(g) >= 2 and all('Pause' in x[1] for x in g), g)
        check('in der Pause: Sekunden bis zum Einsatz, zählen herunter', a[0] and 'noch' in a[0] and num(a[0]) and num(c) and 0.8 < num(a[0]) - num(c) < 1.6 and 'Einsatz in' in a[1], (a, c))
        # Zeile antippen = dorthin springen
        await pg.click('#sbList .sb-row[data-l="5"]'); await pg.wait_for_timeout(900)
        check('Zeile antippen springt dorthin', await pg.evaluate("+document.querySelector('#sbList .sb-row.cur').dataset.l") in (4, 5))
        check('keine Skriptfehler', not errs, errs)
        # 10 Minuten: 7:42 lange Datei wird ganz geladen
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 820})).new_page(); await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'sing/lang_462s.wav')
        for _ in range(240):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        ln = await pg.evaluate("(()=>{const s=Looper.singSrc(0);return s?[s.len/s.sr,(s.L+s.origPos)/s.sr]:null})()")
        check('7:42-Datei komplett (früher bei 6:00 abgeschnitten)', ln and ln[0] > 461 and ln[1] > 455, ln)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
