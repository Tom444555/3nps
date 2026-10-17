# v95: ruhiges Mitsingen – Zeilen behalten ihre Höhe, eine Fahrt pro Zeilenwechsel, aktuelle Zeile immer an derselben Stelle, Wortbalken wieder da
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
L = [("Hold on to the night", 4), ("we were young and free", 9), ("the river runs so cold", 20), ("and nobody can see", 25), ("we hold the line", 30)]
TOK = [{"w": w, "b": b0 + k * 0.5, "l": l} for l, (txt, b0) in enumerate(L) for k, w in enumerate(txt.split())]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
SEEK = "(b=>{const s=Sing.source(SoloInfo());Looper.seek(0,Sing.b2f(b,s.beats)-s.origPos)})(%f)"
PROBE = """(()=>{const box=document.getElementById('sbScroll').getBoundingClientRect(),list=document.getElementById('sbList'),cur=list.querySelector('.sb-row.cur');
  return {tr:list.style.transform, l:cur?+cur.dataset.l:-1, top:cur?cur.getBoundingClientRect().top-box.top:null, h:[...list.querySelectorAll('.sb-row')].map(r=>r.offsetHeight), bh:box.height,
  fill:[...list.querySelectorAll('.sb-row.cur .sb-fill')].some(f=>getComputedStyle(f).display!=='none')}})()"""
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
        await pg.evaluate(SEEK % 3.0); await pg.wait_for_timeout(300)
        samples = []
        for _ in range(170):            # ~ 25 s mitlaufen (72 BPM ≈ 0,83 s/Schlag → bis Schlag ~33)
            samples.append(await pg.evaluate(PROBE)); await pg.wait_for_timeout(150)
        lines = [s['l'] for s in samples]
        changes = sum(1 for i in range(1, len(samples)) if samples[i]['tr'] != samples[i - 1]['tr'])
        lchanges = sum(1 for i in range(1, len(lines)) if lines[i] != lines[i - 1])
        check('Zeilen laufen durch (0 → 4)', lines[0] == 0 and max(lines) == 4 and lines == sorted(lines), sorted(set(lines)))
        check('eine Fahrt je Zeilenwechsel (keine Extra-Sprünge in Pausen)', changes == lchanges, (changes, lchanges))
        hs = set(tuple(s['h']) for s in samples)
        check('Zeilenhöhen ändern sich beim Wechsel nicht', len(hs) == 1, list(hs)[:2])
        # nach dem Einschwingen (≥ 0,9 s nach einem Wechsel) steht die aktuelle Zeile immer an derselben Stelle (30 % der Höhe)
        settled = [s['top'] for i, s in enumerate(samples) if i >= 7 and all(samples[j]['tr'] == s['tr'] for j in range(i - 6, i)) and s['l'] > 0]
        check('aktuelle Zeile steht immer an derselben, gut lesbaren Stelle', settled and max(settled) - min(settled) < 3 and 0.2 < settled[0] / samples[0]['bh'] < 0.4, (round(min(settled)), round(max(settled)), round(samples[0]['bh'])))
        check('mitlaufender Balken unter den Wörtern wieder sichtbar', any(s['fill'] for s in samples))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
