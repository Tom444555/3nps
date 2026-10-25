# v105: Hall und Echo je Spur im Looper (Bedienung, Klang live, Export kreisförmig, Speichern in Ideen, Übernahme ins Studio)
import asyncio, sys, struct
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
ENERGY = """(async () => { const se = Looper.getSession(); se.baseL = se.baseL || se.tracks[0].L; const r = await Looper.sessionMixEq(se); const ab = await r.wav.arrayBuffer(), v = new DataView(ab);
  let o = 12; while (o < ab.byteLength && String.fromCharCode(v.getUint8(o), v.getUint8(o+1), v.getUint8(o+2), v.getUint8(o+3)) !== 'data') o += 8 + v.getUint32(o + 4, true);
  const bits = v.getUint16(34, true), ch = v.getUint16(22, true), sr = v.getUint32(24, true), bps = bits / 8, n = (v.getUint32(o + 4, true)) / (bps * ch); o += 8;
  const at = s => { const p = o + s * bps * ch; return bits === 16 ? v.getInt16(p, true) / 32768 : ((v.getUint8(p) | (v.getUint8(p+1) << 8) | (v.getInt8(p+2) << 16)) / 8388608); };
  const rms = (a, b) => { const i0 = Math.round(a * n), i1 = Math.round(b * n); let e = 0; for (let i = i0; i < i1; i++) { const x = at(i); e += x * x; } return Math.sqrt(e / (i1 - i0)); };
  return { late: rms(0.3, 0.95), early: rms(0.0, 0.025), n, sr }; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, bypass_csp=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(900)
        check('Version ≥ v105', int(__import__('re').search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 105)
        check('Knopf „Hall/Echo“ an allen 3 Spuren', await pg.locator('.fx-btn').count() == 3)
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        # Spur 1: kurzer Klick am Anfang eines 2-s-Loops
        await pg.evaluate("(sr=>{const l=new Float32Array(sr*2); for(let i=0;i<400;i++) l[i]=Math.sin(i/3)*0.8*(1-i/400); Looper._setTrackRaw(0,l)})(%d)" % sr)
        e0 = await pg.evaluate(ENERGY)
        check('ohne Hall: nach dem Klick Stille', e0['late'] < 1e-4, e0)
        await pg.click('#fxb0'); await pg.wait_for_timeout(200)
        check('Bedienfeld öffnet (Hall, Echo, Raum, Abstand, Wiederholungen)', await pg.is_visible('#fxp0') and await pg.locator('#fxp0 select').count() == 2 and await pg.locator('#fxp0 input[type=range]').count() == 3)
        await pg.evaluate("(()=>{const el=document.querySelector('#fxp0 .fx-rev'); el.value=40; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}))})()")
        check('Knopf zeigt „an“', '●' in await pg.inner_text('#fxb0') and await pg.evaluate("Looper.getTrackFx(0).rev") == 40)
        e1 = await pg.evaluate(ENERGY)
        check('Export mit Hall: Ausklang hörbar', e1['late'] > 0.002, e1)
        check('Hall kreisförmig: Loop-Anfang bekommt den Ausklang (nahtlos)', e1['early'] > e0['early'] * 0.9, (e0['early'], e1['early']))
        await pg.evaluate("Looper.setTrackFx(0,{rev:0,dly:50})"); await pg.select_option('#fxp0 .fx-note', '1')
        e2 = await pg.evaluate(ENERGY)
        check('Echo (1/4) im Export', e2['late'] > 0.002 and await pg.evaluate("Looper.fxBus().note") == 1, e2)
        await pg.evaluate("Looper.setTrackFx(0,{rev:60,dly:0})")
        # Speichern in Ideen + Neustart
        await pg.evaluate("document.getElementById('ideaFold').open=true"); await pg.fill('#ideaName', 'Mit Hall'); await pg.click('#ideaSave'); await pg.wait_for_timeout(800)
        fx = await pg.evaluate("AppDB.list('ideas', i => i.name==='Mit Hall' ? i.session.tracks[0].fx : null).then(a=>a.filter(Boolean)[0])")
        check('Idee speichert Hall/Echo der Spur', fx == {'rev': 60, 'dly': 0}, fx)
        await pg.reload(); await pg.wait_for_timeout(1000)
        check('Einstellung bleibt nach Neustart', await pg.evaluate("Looper.getTrackFx(0)") == {'rev': 60, 'dly': 0} and await pg.evaluate("Looper.fxBus().note") == 1)
        await pg.evaluate("Looper.setTrackFx(0,{rev:0,dly:0})")
        await pg.evaluate("document.getElementById('ideaFold').open=true"); await pg.locator('.idea-row', has_text='Mit Hall').locator('[data-act="load"]').click(); await pg.wait_for_timeout(900)
        check('Idee laden stellt Hall wieder ein', await pg.evaluate("Looper.getTrackFx(0).rev") == 60)
        # Studio übernimmt den Hall-Anteil
        await pg.goto('http://localhost:8765/studio/'); await pg.wait_for_timeout(1200)
        await pg.evaluate("UI.show('brw')"); await pg.wait_for_timeout(700); await pg.click('#bList .item:has-text("Mit Hall")'); await pg.wait_for_timeout(600); await pg.click('#bNew'); await pg.wait_for_timeout(3000)
        check('Studio übernimmt Hall-Anteil der Spur', await pg.evaluate("Proj.P.tracks[0].fx.rev") == 60)
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
