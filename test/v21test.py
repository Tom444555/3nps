# v21: Spurkopf – Tonart unter „Spur 1“, rechts klingender und kommender Akkord; keine Akkordleiste mehr
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def load(pg, i, path, wait=60):
    await pg.set_input_files(f'#file{i}', path)
    for _ in range(wait):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        st = await pg.inner_text('#loopStatus')
        if st.startswith(f'Spur {i + 1}:'): return st
    return await pg.inner_text('#loopStatus')
# was im Ring von Spur 1 als Text gezeichnet wird (fillText mitschreiben)
SPY = "(() => { const f = CanvasRenderingContext2D.prototype.fillText; window.__ring = []; CanvasRenderingContext2D.prototype.fillText = function (txt, x, y) { if (this.canvas.id === 'ring0') { window.__ring.push(String(txt)); if (window.__ring.length > 12) window.__ring.shift(); } return f.apply(this, arguments); }; })()"
LAST = "window.__ring.slice(-3)"
BADGE = "(() => { const w = document.getElementById('thc0'), e = document.getElementById('chd0'), n = document.getElementById('chn0'), k = document.getElementById('key0'), nm = document.querySelector('.track.t1 .tname'); const kr = k.getBoundingClientRect(), er = e.getBoundingClientRect(), nr = n.getBoundingClientRect(), tr = nm.getBoundingClientRect(); return { vis: !w.hidden && e.offsetWidth > 0, txt: e.querySelector('b').textContent, nxt: n.hidden ? '' : n.querySelector('b').textContent, keyUnder: !k.hidden && kr.top >= tr.bottom - 1 && Math.abs(kr.left - tr.left) < 30, right: nr.left >= er.right - 1 && er.left > kr.right, bar: !!document.getElementById('chords0') }; })()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(600)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await load(pg, 0, T + 'chords/c_pop_strum.wav')
        for _ in range(40):
            await pg.wait_for_timeout(250)
            if await pg.evaluate('Looper._chords(0)'): break
        await pg.evaluate(SPY)
        if await pg.evaluate("Looper.debug().tracks[0].state === 'playing'"): await pg.click('#loopAll')
        await pg.wait_for_timeout(400)
        b0 = await pg.evaluate(BADGE)
        check('Gestoppt: kein Akkordfeld', not b0['vis'], b0)
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        if not await pg.evaluate("Looper.debug().tracks[0].state === 'playing'"): await pg.click('#loopAll')
        ok = 0; seen = set(); shots = 0; nxok = 0; lay = 0
        order = ['C', 'G', 'Am', 'F']
        for k in range(40):
            await pg.wait_for_timeout(250)
            bd = await pg.evaluate(BADGE)
            if bd['vis'] and bd['txt'] in order: ok += 1; seen.add(bd['txt'])
            if bd['vis'] and bd['txt'] in order and bd['nxt'] == order[(order.index(bd['txt']) + 1) % 4]: nxok += 1
            if bd['vis'] and bd['keyUnder'] and bd['right']: lay += 1
            if shots < 2 and k in (6, 22):
                yt = await pg.evaluate("document.querySelector('.tracks').getBoundingClientRect().top + scrollY")
                await pg.screenshot(path=O + f'v21_spur{shots}.png', full_page=True, clip={'x': 0, 'y': yt, 'width': 1024, 'height': 420}); shots += 1
        check('Spurkopf zeigt den klingenden Akkord (alle 4)', seen == set(order) and ok >= 34, f'{sorted(seen)} · {ok}/40')
        check('Daneben der kommende Akkord', nxok >= 34, nxok)
        check('Tonart unter „Spur 1“, Akkorde rechts daneben', lay >= 34, lay)
        check('Keine Akkordleiste mehr unter der Wellenform', not bd['bar'])
        check('Ring unverändert („SPUR 1“)', 'SPUR 1' in await pg.evaluate(LAST))
        for th in ['metal', 'amp', 'ice']:
            await pg.evaluate(f"document.documentElement.dataset.theme = '{th}'"); await pg.wait_for_timeout(400)
        await pg.click('#loopAll'); await pg.wait_for_timeout(400)
        check('Nach Stopp verschwindet das Akkordfeld', not (await pg.evaluate(BADGE))['vis'])
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
