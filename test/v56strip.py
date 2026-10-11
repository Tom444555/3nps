# v56: Improvisation – Akkordleiste zeigt höchstens 6 Takte und scrollt mit; Wechsel etwas früher; MIDI-Marker mit ♭ als b
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.evaluate("document.getElementById('bpm').value = 120; document.getElementById('bpm').dispatchEvent(new Event('input'))")
        await pg.evaluate("Jam.setSeq('C Am F G Em Am Dm G C F Bb G')")
        await pg.click('#tab-jam'); await pg.evaluate("Jam.start()"); await pg.wait_for_timeout(1500)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        w = await pg.evaluate("[parseFloat(document.getElementById('sfStrip').style.width), document.getElementById('sfBand').clientWidth]")
        check('12 Takte: Leiste doppelt so breit wie sichtbar (6 Takte im Blick)', abs(w[0] / w[1] - 2) < 0.05, w)
        segw = await pg.evaluate("document.querySelector('#sfStrip .sf-seg').getBoundingClientRect().width")
        check('Akkordfeld breit genug zum Lesen', segw > 120, round(segw))
        names = await pg.evaluate("[...document.querySelectorAll('#sfStrip .sf-seg b')].map(x=>x.textContent)")
        check('B♭ statt A♯', 'B♭' in names, names)
        seen = set(); ahead = 0; n = 0
        for k in range(80):
            await pg.wait_for_timeout(120)
            r = await pg.evaluate("(()=>{const b=document.getElementById('sfBand'), ph=document.getElementById('sfPh'); const x=new DOMMatrix(getComputedStyle(ph).transform).m41; const on=document.querySelector('#sfStrip .sf-seg.on'); return [b.scrollLeft, x, b.clientWidth, on? on.offsetLeft: -1]})()")
            seen.add(round(r[0] / 50)); n += 1
            if r[1] < r[0] - 2 or r[1] > r[0] + r[2] + 2: ahead += 1
        check('Leiste scrollt mit (mehrere Positionen)', len(seen) >= 2, sorted(seen))
        check('Abspielstrich bleibt sichtbar', ahead <= 3, ahead)
        # früherer Wechsel: kurz vor Taktende ist schon der nächste Akkord markiert
        got = await pg.evaluate("""new Promise(res => { const t0 = performance.now(); const iv = setInterval(() => { const ci = Jam.chordInfo(); if (!ci) return; const p = ci.pos % 4000; if (p > 3780 && p < 3990) { const on = document.querySelector('#sfStrip .sf-seg.on'); const idx = on ? +on.dataset.i : -1; clearInterval(iv); res([idx, Math.floor(ci.pos / 4000)]); } if (performance.now() - t0 > 6000) { clearInterval(iv); res(null); } }, 10); })""")
        check('Nächster Akkord schon kurz vor dem Takt markiert', got and got[0] == (got[1] + 1) % 12, got)
        await pg.evaluate("Jam.stop()")
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
