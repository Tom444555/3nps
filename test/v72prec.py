# v72: präziser setzen – Stimmkurve/Silbenanfänge, Magnet „Stimme“, ♪ an Stimme, Feinschritt 10 ms, Takt-Schleife (auch 50 %), Wort halten = anhören, Takt einklopfen
import asyncio, json, re
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
SYL = json.load(open(T + 'sing/silben.json'))
SB = "(s=>{const src=Sing.source(SoloInfo());return Sing.f2b(s*src.sr,src.beats)})"          # Sekunde → Schlag
BS = "(b=>{const src=Sing.source(SoloInfo());return Sing.b2f(b,src.beats)/src.sr})"            # Schlag → Sekunde
TK = "Sing.source(SoloInfo()).tok"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'sing/silben.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        # Text: 12 Wörter je 0,15 s hinter den Silben 0…11
        bs = [await pg.evaluate(SB + "(%f)" % (t + 0.15)) for t in SYL[:12]]
        tok = [{"w": "w%d" % i, "b": round(x, 3), "l": i // 6} for i, x in enumerate(bs)]
        key = await pg.evaluate("Sing.source(SoloInfo()).id")
        await pg.evaluate("(([k,t])=>{const d={v:1,f:{},l:{}};d.f[k]={name:'silben.wav',tok:t};localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%s)" % json.dumps([key, tok]))
        await pg.wait_for_timeout(400)
        await pg.click('#sgStrip .sg-w[data-i="0"]'); await pg.wait_for_timeout(300)
        for _ in range(60):
            if await pg.evaluate("!!Sing.prec().env"): break
            await pg.wait_for_timeout(250)
        pr = await pg.evaluate("Sing.prec()")
        on = pr['env']['on'] if pr['env'] else []
        hit = sum(1 for t in SYL if any(abs(o - t) <= 0.03 for o in on))
        check('Stimmkurve berechnet, Silbenanfänge gefunden (±30 ms)', hit >= len(SYL) - 2, (hit, len(SYL), len(on)))
        await pg.wait_for_timeout(300)
        cv = await pg.evaluate("(()=>{const c=document.getElementById('sgEnv');return c?[c.width,parseFloat(c.style.width),c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)]:null})()")
        check('Kurve in der Spur gezeichnet (Bearbeitungs-Zoom)', cv and cv[0] > 100 and cv[2], cv)
        check('Standard: Einrasten an der Stimme, Bedienleiste vollständig', pr['mag'] == 'voice' and all([await pg.is_visible(s) for s in ['#sgFLoop', '#sgFRate', '#sgFMag', '#sgFNudgeL', '#sgFAlign', '#sgFTapStart']]))
        # Magnet: 80 ms neben einer Silbe → genau auf die Silbe; Raster → 16tel
        r = await pg.evaluate("Sing.placeB(%s(%f))" % (SB, SYL[3] + 0.08)); sec = await pg.evaluate(BS + "(%f)" % r['b'])
        check('Magnet „Stimme“ zieht auf den Silbenanfang', r['how'] == 'voice' and abs(sec - SYL[3]) <= 0.03, (r, round(sec, 3), SYL[3]))
        await pg.click('#sgFMag [data-m="grid"]'); r2 = await pg.evaluate("Sing.placeB(%s(%f))" % (SB, SYL[3] + 0.08))
        check('Raster rastet auf 16tel', r2['how'] == 'grid' and abs(r2['b'] * 4 - round(r2['b'] * 4)) < 1e-9, r2)
        await pg.click('#sgFMag [data-m="voice"]')
        # Ziehen mit Magnet: Einrast-Linie zeigt ♪, Wort landet auf einem Silbenanfang
        k1 = await pg.evaluate("SoloFocus.get()")
        box = await pg.evaluate("(()=>{const r=document.querySelector('#sgStrip .sg-w[data-i=\"1\"]').getBoundingClientRect();return [r.x+5,r.y+12]})()")
        await pg.mouse.move(*box); await pg.mouse.down(); await pg.mouse.move(box[0] - 8, box[1], steps=3); await pg.mouse.move(box[0] - 14, box[1], steps=3)
        gl = await pg.evaluate("document.getElementById('sgSnapLine').textContent"); await pg.mouse.up(); await pg.wait_for_timeout(300)
        b1 = (await pg.evaluate(TK))[1]['b']; onb = pr['env']['onB']
        check('Ziehen rastet an der Stimme ein (♪)', '♪' in gl and any(abs(b1 - x) < 0.002 for x in onb), (gl, b1))
        # ♪ an Stimme für den Takt
        await pg.evaluate("localStorage.setItem('3nps-sing-ripple','0')"); await pg.click('#sgRipple') if await pg.evaluate("document.getElementById('sgRipple').classList.contains('active')") else None
        await pg.click('#sgFAlign'); await pg.wait_for_timeout(300)
        tk = await pg.evaluate(TK)
        inbar = await pg.evaluate("(()=>{const ci=SoloInfo(),src=Sing.source(ci),k=SoloFocus.get(),D=ci.downs,a=src.fromCi(D[k]),e=src.fromCi(k+1<D.length?D[k+1]:ci.L);return src.tok.map((t,i)=>t.b>=a-0.5&&t.b<e?i:-1).filter(i=>i>=0)})()")
        secs = [await pg.evaluate(BS + "(%f)" % tk[i]['b']) for i in inbar]
        good = sum(1 for i, s in zip(inbar, secs) if abs(s - SYL[i]) <= 0.03)
        check('♪ an Stimme: Wörter des Taktes sitzen auf ihren Silben', len(inbar) >= 2 and good >= len(inbar) - 1, (inbar, [round(s - SYL[i], 3) for i, s in zip(inbar, secs)]))
        # Feinschritt 10 ms (einzeln)
        sel = inbar[0]; await pg.evaluate("Sing.focus(SoloFocus.get())"); await pg.wait_for_timeout(200)
        await pg.click('#sgStrip .sg-w[data-i="%d"]' % sel); await pg.wait_for_timeout(250)
        s0 = await pg.evaluate(BS + "(%s[%d].b)" % (TK, sel)); n0 = (await pg.evaluate(TK))[sel + 1]['b']
        await pg.click('#sgFNudgeR'); await pg.click('#sgFNudgeR'); await pg.wait_for_timeout(250)
        s1 = await pg.evaluate(BS + "(%s[%d].b)" % (TK, sel)); n1 = (await pg.evaluate(TK))[sel + 1]['b']
        check('2 × „10 ms ▶“ = 20 ms später, Rest bleibt (Rest mitziehen aus)', abs((s1 - s0) - 0.02) < 0.003 and n1 == n0, (round(s1 - s0, 4), n0, n1))
        check('Antippen eines anderen Wortes: auswählen + anhören, kein Eingabefeld', await pg.evaluate("Sing.prec().sel") == sel and not await pg.query_selector('#sgStrip .sg-inline'))
        # Wort gedrückt halten = anhören
        bx = await pg.evaluate("(()=>{const r=document.querySelector('#sgStrip .sg-w[data-i=\"%d\"]').getBoundingClientRect();return [r.x+5,r.y+12]})()" % (sel + 1))
        await pg.evaluate("Sing.focus(SoloFocus.get())"); await pg.wait_for_timeout(200)
        await pg.mouse.move(*bx); await pg.mouse.down(); await pg.wait_for_timeout(650); w = await pg.evaluate("Sing.prec().word"); await pg.mouse.up(); await pg.wait_for_timeout(200)
        check('gedrückt halten spielt das Wort, öffnet nichts', w and not await pg.query_selector('#sgStrip .sg-inline'), w)
        # Takt-Schleife, 50 %
        await pg.click('#sgFLoop'); await pg.wait_for_timeout(700)
        q = await pg.evaluate("[Sing.prec().loop, Looper.running(), Sing.loopNow(), document.getElementById('sgPh').style.display, (()=>{const ci=SoloInfo(),src=Sing.source(ci),k=SoloFocus.get(),D=ci.downs;return [src.fromCi(D[k])-1, src.fromCi(k+1<D.length?D[k+1]:ci.L)]})()]")
        check('⟲ Schleife spielt den Takt (mit Anlauf), Looper steht, Strich läuft', q[0] and not q[1] and q[4][0] - 0.01 <= q[2] <= q[4][1] + 0.01 and q[3] != 'none', q)
        a = await pg.evaluate("Sing.loopNow()"); await pg.wait_for_timeout(500); c = await pg.evaluate("Sing.loopNow()")
        await pg.click('#sgFRate [data-r="0.5"]'); await pg.wait_for_timeout(300)
        a2 = await pg.evaluate("Sing.loopNow()"); await pg.wait_for_timeout(500); c2 = await pg.evaluate("Sing.loopNow()")
        check('50 %: Schleife läuft halb so schnell', await pg.evaluate("Sing.prec().rate") == 0.5 and 0.35 < (c2 - a2) / max(1e-6, c - a) < 0.65, (round(c - a, 3), round(c2 - a2, 3)))
        # Takt einklopfen (bei 50 %): Seite tippt genau, wenn die Schleife die Silbe erreicht
        await pg.click('#sgFTapStart'); await pg.wait_for_timeout(200)
        tp = await pg.evaluate("Sing.prec().tap"); idx = inbar
        tgt = [await pg.evaluate(SB + "(%f)" % SYL[i]) for i in idx]
        done = await pg.evaluate("""(t=>new Promise(res=>{let n=0;const tb=document.getElementById('sgFTap'),t0=performance.now();const f=()=>{const now=Sing.loopNow();if(n<t.length&&now!=null&&now>=t[n]&&now<t[n]+0.3){tb.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));n++}if(n>=t.length||performance.now()-t0>20000)return res(n);requestAnimationFrame(f)};f()}))(%s)""" % json.dumps(tgt))
        await pg.wait_for_timeout(300)
        tk = await pg.evaluate(TK); secs = [await pg.evaluate(BS + "(%f)" % tk[i]['b']) for i in idx]
        check('Takt einklopfen: alle Wörter gesetzt, auf ihren Silben (±40 ms)', tp and done == len(idx) and await pg.evaluate("Sing.prec().tap") is None and all(abs(s - SYL[i]) <= 0.04 for i, s in zip(idx, secs)), (tp, done, [round(s - SYL[i], 3) for i, s in zip(idx, secs)]))
        await pg.click('#sgFStop'); await pg.wait_for_timeout(200)
        check('■ beendet die Schleife', not await pg.evaluate("Sing.prec().loop"))
        await pg.click('#sgFDone'); await pg.wait_for_timeout(300)
        check('✓ Fertig: Kurve weg', not await pg.query_selector('#sgEnv'))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
