# v44: Editor Block 2 – Kopieren/Ausschneiden/Einfügen/Duplizieren/Stille/Umkehren/Blenden/dB/Normalisieren, Undo/Redo, Länge bleibt gleich
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
# Kennwerte eines Bereichs: Spitze, RMS, erster/letzter Wert, Länge
M = """((a,b)=>{const m=Looper._mixOf(0), x=m.l; let p=0,q=0; for(let i=a;i<b;i++){const v=Math.abs(x[i]); if(v>p)p=v; q+=x[i]*x[i];} return {p, rms:Math.sqrt(q/Math.max(1,b-a)), L:x.length, s:Array.from(x.slice(a,a+8))}})"""
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
        await pg.click('#edit0'); await pg.wait_for_timeout(400)
        sr = await pg.evaluate("audioCtx.sampleRate"); L0 = await pg.evaluate("Looper._ed().L")
        A, B = int(sr * 0.5), int(sr * 1.0)          # Auswahl 0,5 … 1,0 s
        sel = lambda a, b_: pg.evaluate(f"Looper._edSel({a},{b_})")
        st = lambda a, b_: pg.evaluate(f"{M}({a},{b_})")
        check('Rückgängig im Editor anfangs gesperrt', await pg.evaluate("document.getElementById('edUndo').disabled"))
        await sel(A, B); before = await st(A, B)
        await pg.click('#edCopy'); clip = await pg.evaluate("Looper._edClip().l.length")
        check('Kopieren', clip == B - A and not await pg.evaluate("document.getElementById('edPaste').disabled"), clip)
        await pg.click('#edSilence'); s1 = await st(A + 200, B - 200)
        check('Stille, Länge gleich', s1['p'] < 1e-6 and s1['L'] == L0, s1['p'])
        await pg.click('#edUndo'); s2 = await st(A, B)
        check('Rückgängig stellt her', abs(s2['rms'] - before['rms']) < 1e-6, (s2['rms'], before['rms']))
        await pg.click('#edRedo'); s3 = await st(A + 200, B - 200)
        check('Wiederholen', s3['p'] < 1e-6)
        await pg.click('#edUndo')
        # Einfügen an anderer Stelle (überschreibt), Länge gleich
        C = int(sr * 2.0); await sel(C, C + 10)
        await pg.click('#edPaste'); s4 = await st(C + 300, C + (B - A) - 300); ref = await pg.evaluate(f"{M}({A + 300},{B - 300})")
        check('Einfügen überschreibt ab Anfang-Griff', abs(s4['rms'] - ref['rms']) < 0.02 * ref['rms'] + 1e-4 and s4['L'] == L0, (s4['rms'], ref['rms']))
        await pg.click('#edUndo')
        # Umkehren
        await sel(A, B); await pg.click('#edReverse')
        rv = await pg.evaluate(f"(()=>{{const x=Looper._mixOf(0).l; return [x[{A}+400], x[{B}-1-400]]}})()")
        await pg.click('#edUndo'); org = await pg.evaluate(f"(()=>{{const x=Looper._mixOf(0).l; return [x[{A}+400], x[{B}-1-400]]}})()")
        check('Umkehren', abs(rv[0] - org[1]) < 1e-6 and abs(rv[1] - org[0]) < 1e-6, (rv, org))
        # +3 dB und Normalisieren
        await sel(A, B); await pg.click('#edGainUp'); g = await st(A + 2000, B - 2000); r0 = await pg.evaluate(f"{M}({A + 2000},{B - 2000})")
        await pg.click('#edUndo'); r1 = await st(A + 2000, B - 2000)
        check('+3 dB', abs(g['rms'] / r1['rms'] - 10 ** (3 / 20)) < 0.01, g['rms'] / r1['rms'])
        await pg.click('#edNorm'); n = await st(A, B)
        check('Normalisieren auf −1 dBFS', abs(n['p'] - 10 ** (-1 / 20)) < 0.01, n['p'])
        await pg.click('#edUndo')
        # Ausblenden: Ende der Auswahl still
        await pg.click('#edFadeOut'); fo = await st(B - 200, B)
        check('Ausblenden', fo['p'] < 0.01 * before['p'] + 1e-4, fo['p'])
        await pg.click('#edUndo')
        # Duplizieren
        await sel(A, B); await pg.click('#edDup'); d = await st(B + 300, B + (B - A) - 300); dref = await st(A + 300, B - 300)
        check('Duplizieren', abs(d['rms'] - dref['rms']) < 0.02 * dref['rms'] + 1e-4, (d['rms'], dref['rms']))
        await pg.click('#edUndo')
        # Kanten knacken nicht: Sprung an der Stille-Kante klein
        A2 = int(sr * 0.63)                          # Kante mitten im Ausklang (kein Anschlag)
        await sel(A2, B); await pg.click('#edSilence')
        jump = await pg.evaluate(f"(()=>{{const x=Looper._mixOf(0).l; let m=0; for(let i={A2}-5;i<{A2}+5;i++) m=Math.max(m,Math.abs(x[i+1]-x[i])); return m}})()")
        await pg.click('#edUndo')
        typ = await pg.evaluate(f"(()=>{{const x=Looper._mixOf(0).l; let m=0; for(let i={A2}-5;i<{A2}+5;i++) m=Math.max(m,Math.abs(x[i+1]-x[i])); return m}})()")
        check('Kante ohne Knacken (Sprung nicht größer als im Original)', jump <= typ * 1.05, (jump, typ))
        # Rückgängig bis zum Anfang: Spur bleibt erhalten
        for _ in range(20):
            if await pg.evaluate("document.getElementById('edUndo').disabled"): break
            await pg.click('#edUndo')
        check('Editor-Rückgängig löscht die Spur nie', await pg.evaluate("Looper._ed().L") == L0 and await pg.evaluate("Looper.debug().tracks[0].L") == L0)
        check('Spur spielt weiter', await pg.evaluate("Looper.debug().tracks[0].state") == 'playing')
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
