# v36: Eingang öffnen robust – Fehler nach Ursache, zweiter Versuch bei „belegt“, Aufnahme-Modul mit Zeitlimit, kein Doppel-Öffnen
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
# Patch: getUserMedia scheitert nach Vorgabe (window.__gumFail = Liste von Fehlernamen, nacheinander), zählt Aufrufe
PATCH = """(()=>{const md=navigator.mediaDevices, orig=md.getUserMedia.bind(md); window.__gumCalls=0;
  md.getUserMedia=function(c){window.__gumCalls++; const f=(window.__gumFail||[]).shift(); if(f){const e=new Error(f); e.name=f; return new Promise((_,rej)=>setTimeout(()=>rej(e),50));} return orig(c);};
  if (window.__hangWorklet && window.AudioWorklet) AudioWorklet.prototype.addModule=function(){return new Promise(()=>{});};})();"""
async def page(b, pre):
    ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(pre + PATCH)
    await pg.goto(U); await pg.wait_for_timeout(500)
    return ctx, pg, errs
async def state(pg):
    return await pg.evaluate("[Looper.debug().mic, document.getElementById('loopMonitor').textContent, document.getElementById('loopMonitor').disabled, (document.getElementById('loopStatus')||{}).textContent||'', window.__gumCalls]")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        allerr = []
        # 1) normal
        ctx, pg, e = await page(b, ''); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
        s = await state(pg); check('Normal: offen', s[0] and s[1] == 'Eingang offen' and not s[2], s); allerr += e; await ctx.close()
        # 2) belegt beim ersten Versuch → zweiter Versuch klappt
        ctx, pg, e = await page(b, "window.__gumFail=['NotReadableError'];"); await pg.click('#loopMonitor'); await pg.wait_for_timeout(2000)
        s = await state(pg); check('Belegt → automatisch nachgefasst', s[0] and s[4] == 2, s); allerr += e; await ctx.close()
        # 3) dauerhaft belegt → klare Meldung, Knopf wieder bedienbar
        ctx, pg, e = await page(b, "window.__gumFail=['NotReadableError','NotReadableError','NotReadableError'];"); await pg.click('#loopMonitor'); await pg.wait_for_timeout(2000)
        s = await state(pg); check('Dauerhaft belegt: Meldung „belegt“', not s[0] and 'belegt' in s[3] and 'Logic' in s[3] and s[1] == 'Eingang öffnen' and not s[2], s[:3] + [s[3][:70]]); allerr += e
        r = await pg.evaluate("PerfView.open(), new Promise(r=>setTimeout(()=>r(document.getElementById('pfNote').textContent),700))")
        check('Ursache im Leistungsfenster', 'NotReadableError' in r, r[:80])
        await pg.evaluate("window.__gumFail=[]"); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
        s = await state(pg); check('Danach erneut tippen: offen', s[0], s); await ctx.close()
        # 4) keine Erlaubnis
        ctx, pg, e = await page(b, "window.__gumFail=['NotAllowedError'];"); await pg.click('#loopMonitor'); await pg.wait_for_timeout(800)
        s = await state(pg); check('Keine Erlaubnis: Meldung, kein zweiter Versuch', not s[0] and 'Kein Zugriff' in s[3] and s[4] == 1 and not s[2], s[:3] + [s[3][:60], s[4]]); allerr += e; await ctx.close()
        # 5) kein Gerät
        ctx, pg, e = await page(b, "window.__gumFail=['NotFoundError','NotFoundError','NotFoundError'];"); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        s = await state(pg); check('Kein Gerät: Meldung Interface', not s[0] and 'Interface' in s[3], s[3][:70]); allerr += e; await ctx.close()
        # 6) Aufnahme-Modul hängt → Ausweichweg nach 4 s, Aufnahme-Pegel kommt an
        ctx, pg, e = await page(b, "window.__hangWorklet=true;"); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        s1 = await state(pg); await pg.wait_for_timeout(4500)
        s = await state(pg); lv = await pg.evaluate("Looper.debug().level")
        check('Modul hängt: erst „Öffne …“, dann offen über Ausweichweg', s1[1] == 'Öffne …' and s1[2] and s[0] and lv > 0, (s1[:3], s[:3], lv)); allerr += e; await ctx.close()
        # 7) Doppeltippen öffnet nur einmal
        ctx, pg, e = await page(b, "window.__hangWorklet=false;")
        await pg.evaluate("document.getElementById('loopMonitor').click(); document.getElementById('loopMonitor').click(); Looper.foot(0)")
        await pg.wait_for_timeout(1500)
        s = await state(pg); check('Doppeltippen + REC: nur ein Öffnen', s[0] and s[4] == 1, s); allerr += e; await ctx.close()
        check('Keine Skriptfehler', not allerr, allerr)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
