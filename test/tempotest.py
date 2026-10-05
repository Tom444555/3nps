# Tempo ändern bei laufenden Drums (frei): Muster läuft ohne Sprung weiter, Abstände wechseln sauber
import asyncio
from playwright.async_api import async_playwright
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def run(pg, style, newbpm):
    await pg.evaluate(f"(() => {{ const s = document.getElementById('loopDrumStyle'); if (s) {{ s.value = '{style}'; s.dispatchEvent(new Event('change')); }} }})()")
    await pg.evaluate("(() => { const e=document.getElementById('bpm'); e.value=80; e.dispatchEvent(new Event('input')); })()")
    await pg.wait_for_timeout(2000)
    await pg.evaluate("window.__st=[]; window.__t0=audioCtx.currentTime+0.35; clearInterval(window.__iv); window.__iv=setInterval(()=>{ Rhythm.debug().steps.forEach(x=>{ if(x[0]>window.__t0 && (!window.__st.length||x[0]>window.__st[window.__st.length-1][0]+1e-4)) window.__st.push([x[0],x[1]]); }); },40)")
    await pg.wait_for_timeout(1000)
    await pg.evaluate(f"(() => {{ const e=document.getElementById('bpm'); e.value={newbpm}; e.dispatchEvent(new Event('input')); }})()")
    await pg.wait_for_timeout(1500)
    st = await pg.evaluate("window.__st"); r = await pg.evaluate("Rhythm.res()")
    seq = [s for t, s in st]; br = [(seq[i], seq[i+1]) for i in range(len(seq)-1) if (seq[i]+1) % r != seq[i+1]]
    d = [st[i+1][0]-st[i][0] for i in range(len(st)-1)]
    sd0, sd1 = 240/80/r, 240/newbpm/r
    odd = [round(x, 3) for x in d if not (abs(x-sd0) < 0.002 or abs(x-sd1) < 0.002)]
    bpmv = await pg.evaluate("document.getElementById('bpm').value")
    return br, odd, f'{len(seq)} · res {r} · bpm {bpmv}'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg = await b.new_page()
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-griffbrett'); await pg.evaluate("ensureAudio(); Rhythm.setOn(true)")
        for _ in range(20):
            await pg.wait_for_timeout(250)
            if await pg.evaluate("Rhythm.on()"): break
        for style, nb in [('shuffle_tx', 97), ('bluesrock', 120), ('bluesrock', 64)]:
            br, odd, n = await run(pg, style, nb)
            check(f'{style}: 80 → {nb} BPM ohne Sprung', not br and len(odd) <= 1, f'Brüche {br} · Zwischenabstände {odd} · {n} Schritte')
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
