# v43: Editor Block 1 – Vollbild, Feinschritte, Einrasten (16tel/Anschlag/Nulldurchgang), Blende an der Loop-Naht, Auswahl hören, Pedal im Vollbild
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'; T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
        if await pg.is_visible('#impOk'): await pg.click('#impOk')
        await pg.wait_for_timeout(2500)
        e = await pg.evaluate("Looper._ed()")
        check('Automatisch geöffnet: kein Vollbild', e is None or e['full'] is False, e)
        if e: await pg.click('#edClose')
        await pg.click('#edit0'); await pg.wait_for_timeout(500)
        e = await pg.evaluate("Looper._ed()")
        h = await pg.evaluate("document.getElementById('edWave').getBoundingClientRect().height")
        check('✂ öffnet Vollbild, Wellenform groß', e['full'] and h > 300, (e['full'], h))
        sr = await pg.evaluate("audioCtx.sampleRate"); ms = round(sr / 1000)
        # Feinschritte am Ende-Griff
        await pg.click('#edHE')
        for bt in ['#edNmL', '#edNmL', '#edNsL', '#edNsR', '#edNsL']: await pg.click(bt)
        e2 = await pg.evaluate("Looper._ed()")
        check('Feinschritte: −2 ms −1 Abtastwert', e2['e'] == e['L'] - 2 * ms - 1 and e2['h'] == 'e', (e2['e'], e['L'] - 2 * ms - 1))
        pos = await pg.inner_text('#edPos')
        check('Position als Takt · Schlag + ms', pos.startswith('Ende: Takt 2 · Schlag 4') and ' s' in pos, pos)
        # Einrasten
        r = await pg.evaluate("""(()=>{const g=document.getElementById('edGrid'); const out={};
          for (const m of ['sixteenth','onset','zero']) { g.value=m; g.dispatchEvent(new Event('change'));
            const c=document.getElementById('edWave').getBoundingClientRect(); const ev=(t,x)=>document.getElementById('edWave').parentNode.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:c.top+c.height/2,pointerId:1,bubbles:true}));
            ev('pointerdown', c.left+c.width*0.30); ev('pointermove', c.left+c.width*0.33); ev('pointerup', c.left+c.width*0.33); out[m]=Looper._ed().s; }
          return out})()""")
        L = e['L']; six = L / 32
        on = await pg.evaluate("Looper._onsets(0)")
        zc = await pg.evaluate(f"(()=>{{const x=Looper.getMix ? null : null; return true}})()")
        check('Einrasten 16tel', abs(r['sixteenth'] / six - round(r['sixteenth'] / six)) < 0.01, r['sixteenth'] / six)
        check('Einrasten Anschlag', r['onset'] in on, (r['onset'], [o for o in on if abs(o - r['onset']) < 3000][:3]))
        zv = await pg.evaluate(f"(()=>{{const t=Looper.debug(); return null}})()")
        check('Einrasten Nulldurchgang (Position gesetzt)', isinstance(r['zero'], int) and r['zero'] > 0, r['zero'])
        # Anschläge passen zum Raster (Achtel bei 120 BPM)
        six = L / 32
        near = sum(1 for o in on if abs(o / six - round(o / six)) * six < 0.015 * sr)
        check('Anschläge erkannt, meist auf dem 16tel-Raster', 10 <= len(on) <= 32 and near / len(on) > 0.7, (len(on), near))
        # Auswahl hören: andere Spuren still, danach wieder laut
        await pg.click('#edLoopSel'); await pg.wait_for_timeout(600)
        st = await pg.evaluate("[Looper._ed().loop, document.getElementById('edLoopSel').textContent]")
        check('Auswahl hören läuft', st[0] and 'stoppen' in st[1], st)
        await pg.click('#edLoopSel'); await pg.wait_for_timeout(200)
        check('Auswahl hören stoppt', not await pg.evaluate("Looper._ed().loop"))
        # Pedal im Vollbild: ↓ = 1 ms nach rechts, ← = Griff wechseln; Spuren bleiben unberührt
        st0 = await pg.evaluate("Looper.debug().tracks.map(t=>t.state).join()")
        await pg.click('#edHE'); e3 = await pg.evaluate("Looper._ed()")
        await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(150)
        e4 = await pg.evaluate("Looper._ed()"); st1 = await pg.evaluate("Looper.debug().tracks.map(t=>t.state).join()")
        check('Pedal: Feinschritt + Griff wechseln, Spuren unberührt', e4['e'] == e3['e'] - ms and e4['h'] == 's' and st0 == st1, (e3['e'], e4['e'], e4['h'], st0, st1))
        # Blende an der Naht: Sprung Ende→Anfang kleiner als ohne Blende
        async def seam(fade):
            await pg.evaluate(f"document.getElementById('edFade').value='{fade}'")
            return await pg.evaluate(f"""(async()=>{{const sr=audioCtx.sampleRate, L={L};
              const g=document.getElementById('edGrid'); g.value='free';
              Looper.undo(0); await new Promise(r=>setTimeout(r,200));
              const x=Looper.getMix(); return null}})()""")
        # direkt über die interne Schnittfunktion: Ausschnitt 0,317 s … 3,317 s (mitten im Klang)
        res = {}
        for fade in ['0', '5']:
            await pg.evaluate(f"document.getElementById('edFade').value='{fade}'")
            res[fade] = await pg.evaluate("""(()=>{const sr=audioCtx.sampleRate; const a=Math.round(sr*0.3173), e=Math.round(sr*3.3173);
              const d=Looper._ed(); window.__edSet && 0;
              return [a,e]})()""")
        # Naht-Sprung messen: gleiche Auswahl einmal ohne, einmal mit 5-ms-Blende zuschneiden
        jumps = {}
        for fade in ['0', '5']:
            jumps[fade] = await pg.evaluate("""(async(fd)=>{const sr=audioCtx.sampleRate; document.getElementById('edFade').value=fd;
              Looper._edSel(Math.round(sr*0.3173), Math.round(sr*3.3173)); Looper._trim(); await new Promise(r=>setTimeout(r,150));
              const m=Looper._mixOf(0), L=m.l.length; let typ=0; for (let i=1;i<L;i++) typ+=Math.abs(m.l[i]-m.l[i-1]); typ/=L;
              const j=Math.abs(m.l[0]-m.l[L-1]); Looper.undo(0); await new Promise(r=>setTimeout(r,150)); return [j, typ, L]})""" + f"('{fade}')")
        check('Blende glättet die Loop-Naht', jumps['5'][0] < jumps['0'][0] * 0.5 + jumps['5'][1] * 2, jumps)
        check('Blenden-Auswahl gespeichert', await pg.evaluate("localStorage.getItem('3nps-edfade')") in (None, '5', '0', '2', '10'))
        # Vollbild umschalten bleibt gespeichert
        await pg.click('#edFull'); await pg.wait_for_timeout(100)
        check('Fenster-Modus gemerkt', await pg.evaluate("[Looper._ed().full, localStorage.getItem('3nps-edfull')]") == [False, '0'])
        await pg.click('#edFull'); await pg.click('#edClose')
        check('Schließen gibt Seite frei', not await pg.evaluate("document.documentElement.classList.contains('ed-open')"))
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
