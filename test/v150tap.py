# v150: Tap-Tempo – Knopf „Tap“ in der Kopfleiste neben − / + (≥ 44 px, eine Zeile, nichts verrutscht), ab dem 2. Tipp Mittel der
# letzten Abstände (bis 6 Tipps), Pause > 2 s beginnt neu, nur 30–300 BPM, setzt wie − / + (Regler, Anzeige, 'bpmuser'), Anleitung, EN.
import asyncio, os, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
GEO = "(()=>{const t=document.querySelector('.tempo-ctl').getBoundingClientRect(),k=[...document.querySelectorAll('.tempo-ctl > *')].map(e=>e.getBoundingClientRect()),b=document.getElementById('bpmTap').getBoundingClientRect(),u=document.getElementById('bpmUp').getBoundingClientRect();return {w:Math.round(b.width),h:Math.round(b.height),row:Math.abs(b.top-u.top)<1,inside:b.right<=t.right+0.5&&b.left>=u.right,ctlH:Math.round(t.height),slider:Math.round(document.getElementById('bpm').getBoundingClientRect().width),vw:document.documentElement.scrollWidth<=innerWidth}})()"
def expect(ts):   # erwartetes Tempo aus den echten Tipp-Zeiten (wie die App: Neubeginn nach > 2 s, letzte 6, 30–300, Regler 40–200)
    q = []
    for t in ts:
        if q and t - q[-1] > 2000: q = []
        q.append(t); q = q[-6:]
    if len(q) < 2: return None
    v = 60000 * (len(q) - 1) / (q[-1] - q[0])
    return max(40, min(200, round(v))) if 30 <= v <= 300 else None
async def taps(pg, n, ms):
    await pg.evaluate("window.__tt=window.__tt||[];if(!window.__ttOn){window.__ttOn=1;document.getElementById('bpmTap').addEventListener('pointerdown',()=>window.__tt.push(performance.now()),true)}")
    for i in range(n):
        await pg.click('#bpmTap')
        if i < n - 1: await pg.wait_for_timeout(ms)
    await pg.wait_for_timeout(50)
bpm = lambda pg: pg.evaluate("[+document.getElementById('bpm').value, +document.getElementById('bpmVal').textContent]")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
            for th, dev in [('nordic', 'new'), ('precise-dark', 'new'), ('ios', 'new'), ('nordic', 'min')]:
                ctx = await b.new_context(viewport={'width': w, 'height': h})
                await ctx.add_init_script("localStorage.setItem('3nps-theme','%s');localStorage.setItem('3nps-theme2','%s');localStorage.setItem('3nps-device','%s')" % ('nordic' if th == 'nordic' else th, th, dev))
                pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1200)
                if w == 1366 and th == 'nordic' and dev == 'new': check('ab v150', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 150)
                g = await pg.evaluate(GEO)
                check(f'{w} {th} {dev}: „Tap“ ≥ 44 px, in einer Zeile mit − / +, Tempo-Leiste 44 px hoch, kein Querscrollen', g['w'] >= 44 and g['h'] >= 44 and g['row'] and g['inside'] and g['ctlH'] == 44 and g['slider'] >= 90 and g['vw'], g)
                if th == 'nordic' and dev == 'new':
                    await taps(pg, 4, 500); v = await bpm(pg); e = expect(await pg.evaluate("window.__tt"))
                    check(f'{w}: 4 Tipps im Abstand ≈ 0,5 s → Mittel der Abstände (Regler und Anzeige)', 105 <= v[0] <= 124 and abs(v[0] - e) <= 1 and v[0] == v[1], (v, e))
                    if w == 1366:
                        await pg.wait_for_timeout(2300); await taps(pg, 1, 0)
                        check('Pause > 2 s: erster neuer Tipp ändert nichts', (await bpm(pg))[0] == v[0])
                        await pg.wait_for_timeout(750); await taps(pg, 1, 0); v2 = await bpm(pg)
                        e = expect(await pg.evaluate("window.__tt")); check('… zweiter Tipp nach 0,75 s → ≈ 80 BPM', 70 <= v2[0] <= 84 and abs(v2[0] - e) <= 1, (v2, e))
                        await pg.wait_for_timeout(2300); await taps(pg, 8, 330); v3 = await bpm(pg)
                        tt = await pg.evaluate("window.__tt"); e = expect(tt)
                        check('8 Tipps à 0,33 s → Mittel der letzten 6 (≈ 170–180 BPM)', 160 <= v3[0] <= 186 and abs(v3[0] - e) <= 1, (v3, e))
                        await pg.wait_for_timeout(2300); await taps(pg, 3, 120)
                        check('zu schnell (≈ 500 BPM) wird ignoriert', (await bpm(pg))[0] == v3[0])
                        await pg.wait_for_timeout(2300); await taps(pg, 2, 1700); v4 = await bpm(pg)
                        check('35 BPM liegt im Tap-Bereich, Regler-Grenze 40 wie bei „−“', v4[0] == 40, v4)
                        await pg.wait_for_timeout(2300); n = await pg.evaluate("new Promise(r=>{let n=0;const f=()=>n++;document.addEventListener('bpmuser',f);document.getElementById('bpmTap').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));setTimeout(()=>{document.getElementById('bpmTap').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));setTimeout(()=>{document.removeEventListener('bpmuser',f);r(n)},30)},500)})")
                        check('Tap meldet „bpmuser“ wie − / +', n == 1, n)
                        await pg.wait_for_timeout(2300); await pg.focus('#bpmTap'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(50)
                        check('Tastatur (Enter) tippt ebenfalls (≈ 100 BPM)', 90 <= (await bpm(pg))[0] <= 105, await bpm(pg))
                        # Looper: Tempo folgt wie bei „+“
                        await open_tab(pg, 'looper'); await pg.wait_for_timeout(300)
                        b0 = await pg.evaluate("Looper.debug().bpm"); await pg.click('#bpmUp'); await pg.wait_for_timeout(100); b1 = await pg.evaluate("Looper.debug().bpm")
                        await pg.wait_for_timeout(2300); await taps(pg, 3, 600); await pg.wait_for_timeout(100); b2 = await pg.evaluate("Looper.debug().bpm"); r2 = (await bpm(pg))[0]
                        check('Looper übernimmt Tap-Tempo wie „+“', b1 == b0 + 1 and b2 == r2 and 88 <= b2 <= 104, (b0, b1, b2, r2))
                        await open_tab(pg, 'hilfe'); await pg.wait_for_timeout(800)
                        check('Anleitung: Thema „Tap-Tempo“', await pg.locator('#taptempo, [data-id=taptempo]').count() >= 1 or 'Tap-Tempo' in await pg.evaluate("document.getElementById('panel-hilfe').innerText"))
                check(f'{w} {th} {dev}: keine Skriptfehler', not errs, errs[:3])
                await ctx.close()
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page()
        await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500)
        check('EN: Tap-Knopf beschriftet', await pg.get_attribute('#bpmTap', 'aria-label') == 'Tap tempo', await pg.get_attribute('#bpmTap', 'aria-label'))
        await ctx.close(); await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
