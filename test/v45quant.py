# v45: Quantisieren – unsauber gespielte Spur (Anschläge ±25 ms neben dem 16tel-Raster) wird aufs Raster gezogen, Tonhöhe bleibt, Länge bleibt
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
SLOPPY = """(()=>{const sr=audioCtx.sampleRate, L=Looper.debug().tracks[0].L, x=new Float32Array(L); let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647};
  const six=L/32, offs=[];
  for (let k=0;k<32;k++){ const off=Math.round((rnd()*2-1)*0.025*sr); const st=Math.round(k*six)+off; offs.push(off/sr*1000); if (st<0) continue;
    for (let i=0;i<Math.round(0.11*sr) && st+i<L;i++){ const tt=i/sr; x[st+i]+= (i<88?(rnd()*2-1)*0.5*(1-i/88):0) + 0.45*Math.sin(2*Math.PI*330*tt)*Math.exp(-tt/0.05)*Math.min(1,i/8)*Math.min(1,(Math.round(0.11*sr)-i)/(0.02*sr)); } }   // weich ausklingen (kein Klick am Ende)
  Looper._setTrackRaw(1, x); return offs})()"""
# mittlere Abweichung der erkannten Anschläge vom 16tel-Raster (ms)
DEV = """(()=>{const sr=audioCtx.sampleRate, L=Looper.debug().tracks[1].L, six=L/32, on=Looper._onsets(1); const d=on.map(o=>Math.abs(o-Math.round(o/six)*six)/sr*1000); return [on.length, d.reduce((a,b)=>a+b,0)/Math.max(1,d.length), Math.max(...d)]})()"""
# Tonhöhe im Ausklang eines Tons (Nulldurchgänge), Mittel über alle Töne
PITCH = """(()=>{const sr=audioCtx.sampleRate, x=Looper._mixOf(1).l, on=Looper._onsets(1); const f=[];
  for (const o of on){ const a=o+Math.round(0.02*sr), b=a+Math.round(0.04*sr); if (b>=x.length) continue; let z=0; for(let i=a+1;i<b;i++) if ((x[i-1]<0)!==(x[i]<0)) z++; f.push(z/2/((b-a)/sr)); }
  f.sort((p,q)=>p-q); return f[f.length>>1]})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('3nps-edfull','1')")
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(2500)
        if await pg.evaluate('!!Looper._ed()'): await pg.click('#edClose')
        offs = await pg.evaluate(SLOPPY); await pg.wait_for_timeout(300)
        L = await pg.evaluate("Looper.debug().tracks[1].L")
        d0 = await pg.evaluate(DEV); p0 = await pg.evaluate(PITCH)
        check('Unsaubere Spur: Anschläge erkannt', d0[0] >= 28 and d0[1] > 8, d0)
        await pg.click('#edit1'); await pg.wait_for_timeout(400)
        await pg.select_option('#qGrid', '16'); await pg.fill('#qStr', '100'); await pg.dispatch_event('#qStr', 'input')
        await pg.click('#qAna'); await pg.wait_for_timeout(300)
        q = await pg.evaluate("Looper._q()"); info = await pg.inner_text('#qInfo')
        check('Analyse zeigt Abweichungen', q and q['n'] >= 28 and 'Ø Abweichung' in info, info)
        await pg.screenshot(path='/tmp/claude-0/-home-claude-3nps/2b75d834-bf42-5f15-9202-9ced4b4e2624/scratchpad/q1.png', clip={'x': 0, 'y': 0, 'width': 1180, 'height': 560})
        # Vorher/Nachher hören
        await pg.click('#qHearA'); await pg.wait_for_timeout(500)
        check('Nachher anhören', await pg.evaluate("Looper._ed().loop && document.getElementById('qHearA').getAttribute('aria-pressed')==='true'"))
        await pg.click('#qHearB'); await pg.wait_for_timeout(300)
        check('Vorher anhören', await pg.evaluate("Looper._ed().loop && document.getElementById('qHearB').getAttribute('aria-pressed')==='true'"))
        await pg.click('#qHearB')
        import time; t0 = time.time()
        await pg.click('#qApply'); await pg.wait_for_timeout(500); dt = time.time() - t0
        d1 = await pg.evaluate(DEV); p1 = await pg.evaluate(PITCH)
        check('100 %: Anschläge auf dem Raster', d1[1] < 3.0 and d1[2] < 8, (d0[1], d1))
        STEP = "(()=>{const x=Looper._mixOf(1).l; let m=0; for(let i=1;i<x.length;i++){const d=Math.abs(x[i]-x[i-1]); if(d>m)m=d;} return m})()"
        stp1 = await pg.evaluate(STEP); await pg.click('#edUndo'); await pg.wait_for_timeout(150); stp0 = await pg.evaluate(STEP); await pg.click('#edRedo'); await pg.wait_for_timeout(150)
        check('Kein Knacken an den Abschnittsgrenzen', stp1 <= stp0 * 1.15, (stp0, stp1))
        check('Tonhöhe bleibt', abs(p1 / p0 - 1) < 0.02, (p0, p1))
        check('Länge bleibt gleich', await pg.evaluate("Looper.debug().tracks[1].L") == L)
        check('Rechenzeit vertretbar (< 3 s für 4 s Audio)', dt < 3.5, round(dt, 2))
        # 50 %: ungefähr halbe Abweichung
        await pg.click('#edUndo'); await pg.wait_for_timeout(200)
        await pg.fill('#qStr', '50'); await pg.dispatch_event('#qStr', 'input')
        await pg.click('#qApply'); await pg.wait_for_timeout(500)
        d2 = await pg.evaluate(DEV)
        check('50 %: ungefähr halbe Abweichung', 0.3 * d0[1] < d2[1] < 0.7 * d0[1], (d0[1], d2[1]))
        await pg.click('#edUndo'); await pg.wait_for_timeout(200)
        d3 = await pg.evaluate(DEV)
        check('Rückgängig stellt Original her', abs(d3[1] - d0[1]) < 0.01, (d0[1], d3[1]))
        # Swing: 8tel-Raster mit Swing verschiebt die Zielpunkte der „und“-Achtel
        pts = await pg.evaluate("Looper._qPts(1, 8, 0.5)")
        e8 = L / 16
        check('Swing verschiebt jede zweite Achtel', abs((pts[1] - e8) - 0.5 * e8 / 3) < 2 and abs(pts[2] - 2 * e8) < 2, (pts[1] - e8, pts[2] - 2 * e8))
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
