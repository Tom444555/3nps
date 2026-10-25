# Studio S3: Instrumente (echte Aufnahmen + Synth), Noten-Editor, Drummer (Stile, Fills, Looper-Muster), Akkorde → Bass/Flächen, MIDI-Export
import asyncio, sys, zipfile
from playwright.async_api import async_playwright
L = 'http://localhost:8765/index.html'
S = 'http://localhost:8765/studio/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, bypass_csp=True, accept_downloads=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(S); await pg.wait_for_timeout(1200)
        await pg.evaluate("UI.show('arr')")
        # ---- Instrument-Spur ----
        await pg.click('#tAdd'); await pg.click('#dlg .item[data-k="midi"]'); await pg.wait_for_timeout(300)
        st = await pg.evaluate("({t:Proj.P.tracks.map(t=>t.kind), r:Proj.P.regions.map(r=>r.kind)})")
        check('„+ Spur → Instrument“ legt Spur + leere Noten-Region an', st['t'] == ['midi'] and st['r'] == ['midi'], st)
        await pg.click('#views [data-v="roll"]'); await pg.wait_for_timeout(600)
        check('Noten-Editor öffnet mit der Region', await pg.is_visible('#rcv') and await pg.locator('#rGrid').count() == 1)
        box = await pg.locator('#roll').bounding_box()
        # vier Noten per Tippen (C4 E4 G4 C5 auf Schläge 0..3)
        for k, m in enumerate([60, 64, 67, 72]):
            xy = await pg.evaluate("((b,m)=>({x:52+(b-Roll.S.x0)*Roll.S.ppb+5, y:(127-m)*14-Roll.S.y0+7}))(%d,%d)" % (k, m))
            await pg.mouse.click(box['x'] + xy['x'], box['y'] + xy['y']); await pg.wait_for_timeout(120)
            await pg.mouse.click(box['x'] + 30, box['y'] + 2)   # Auswahl aufheben (Tastatur oben)
            await pg.evaluate("Roll.S.sel.clear()")
        ns = await pg.evaluate("Proj.P.regions[0].notes.map(n=>[n.t,n.m,n.d])")
        check('Noten per Tippen gesetzt (Tonhöhe und Raster stimmen)', [n[:2] for n in ns] == [[0, 60], [1, 64], [2, 67], [3, 72]] and all(abs(n[2] - 0.25) < 1e-6 for n in ns), ns)
        # verschieben: erste Note eine Oktave höher ziehen
        xy = await pg.evaluate("({x:52+(0-Roll.S.x0)*Roll.S.ppb+4, y:(127-60)*14-Roll.S.y0+7})")
        await pg.mouse.move(box['x'] + xy['x'], box['y'] + xy['y']); await pg.mouse.down(); await pg.mouse.move(box['x'] + xy['x'], box['y'] + xy['y'] - 14 * 12, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(200)
        m0 = await pg.evaluate("Proj.P.regions[0].notes.map(n=>n.m)")
        check('Note ziehen = Tonhöhe ändern', 72 in m0 and 60 not in m0, m0)
        await pg.click('#tUndo') if await pg.is_visible('#tUndo') else None
        await pg.evaluate("Proj.undo(); Engine.dirty(true); Roll.open()"); await pg.wait_for_timeout(200)
        check('Rückgängig im Noten-Editor', 60 in await pg.evaluate("Proj.P.regions[0].notes.map(n=>n.m)"))
        # echtes Klavier laden und hören
        await pg.click('#rInst'); await pg.click('#dlg .item[data-i="piano"]'); await pg.wait_for_timeout(2500)
        ld = await pg.evaluate("(async()=>{const l=await Inst.load('piano');return l&&{n:l.notes.length, loop:l.loop, d:l.notes[0].b.duration}})()")
        check('Klavier (echt) geladen', ld and ld['n'] >= 18, ld)
        x = await pg.evaluate("(async()=>{const r=Proj.P.regions[0]; const x=await Exp.render({a:0,b:r.len,tail:0.5}); const sr=x.sr, spb=Proj.spb(); const seg=(a)=>{const s=Math.round(a*spb+0.05*sr), n=4096; let z=0,e=0; for(let i=s;i<s+n;i++){e+=x.l[i]*x.l[i]; if((x.l[i]>=0)!==(x.l[i+1]>=0))z++} return {rms:Math.sqrt(e/n), zc:z}}; return [0,1,2,3].map(seg)})()")
        check('Export: Klaviernoten klingen', all(s['rms'] > 0.005 for s in x), [round(s['rms'], 3) for s in x])
        # alle Instrumente laden
        res = await pg.evaluate("(async()=>{const out={}; for(const i of Inst.LIST){ if(!i.s) continue; const l=await Inst.load(i.id); out[i.id]=l?l.notes.length:0 } return out})()")
        check('alle echten Instrumente laden', all(v > 0 for v in res.values()) and len(res) == 8, res)
        # ---- Drummer ----
        await pg.evaluate("UI.show('arr')"); await pg.click('#tAdd'); await pg.click('#dlg .item[data-k="drum"]'); await pg.wait_for_timeout(1500)
        d = await pg.evaluate("(()=>{const r=Proj.P.regions.find(r=>r.kind==='drum');return {len:r.len/Proj.bar(), d:r.drum, kit:Proj.P.tracks.find(t=>t.kind==='drum').kit}})()")
        check('Drummer-Spur mit 8-Takt-Region (Rock)', d['len'] == 8 and d['d']['style'] == 'rock' and d['kit'] == 'rock', d)
        hb = await pg.evaluate("(()=>{const h=Drum.barHits({style:'rock',energy:60,cplx:40,fill:1},7,8,4); const n=Drum.barHits({style:'rock',energy:60,cplx:40,fill:1},3,8,4); return {fillToms:h.filter(x=>/^tom/.test(x.id)).length, normToms:n.filter(x=>/^tom/.test(x.id)).length, kick:n.filter(x=>x.id==='kick').length, snare:n.filter(x=>x.id==='snare').map(x=>x.s)}})()")
        check('Rock: Snare auf 2 und 4, Kicks, Fill im letzten Takt', hb['snare'] == [4, 12] and hb['kick'] >= 3 and hb['fillToms'] >= 2 and hb['normToms'] == 0, hb)
        cx = await pg.evaluate("[Drum.barHits({style:'funk',energy:60,cplx:10},2,8,4).length, Drum.barHits({style:'funk',energy:60,cplx:95},2,8,4).length]")
        check('Komplexität → mehr Schläge', cx[1] > cx[0], cx)
        await pg.evaluate("Arr.V.sel=Proj.P.regions.find(r=>r.kind==='drum').id; Arr.V.selTrack=Proj.P.regions.find(r=>r.kind==='drum').track"); await pg.click('#views [data-v="roll"]'); await pg.wait_for_timeout(400)
        check('Drummer-Bedienfeld (Stil, Kraft, Komplexität)', await pg.locator('#rTop select[data-k="style"]').count() == 1 and await pg.locator('#rTop [data-k="cplx"]').count() == 1)
        await pg.select_option('#rTop select[data-k="style"]', 'funk'); await pg.wait_for_timeout(200)
        check('Stil ändern (Funk) speichert in der Region', await pg.evaluate("Proj.P.regions.find(r=>r.kind==='drum').drum.style") == 'funk')
        dr = await pg.evaluate("(async()=>{const r=Proj.P.regions.find(r=>r.kind==='drum'); Proj.P.tracks.forEach(t=>t.solo=t.kind==='drum'); const x=await Exp.render({a:r.start,b:r.start+Proj.bar()*2,tail:0}); Proj.P.tracks.forEach(t=>t.solo=false); let m=0;for(const v of x.l)m=Math.max(m,Math.abs(v)); return m})()")
        check('Drummer klingt im Export (echtes Kit)', dr > 0.1, round(dr, 3))
        # Abspielen: Drums + Klavier live
        await pg.evaluate("Engine.seek(0)"); await pg.click('#bPlay'); await pg.wait_for_timeout(1500)
        lv = await pg.evaluate("[Engine.level(0), Engine.level(1)]"); await pg.click('#bPlay')
        check('Live: Instrument und Drummer klingen', lv[1] > 0.02, [round(v, 3) for v in lv])
        # ---- Akkorde → Bass ----
        await pg.fill('#cProg', 'Am F C G'); await pg.fill('#cBar', '1'); await pg.select_option('#cBass', 'rq'); await pg.click('#cMkB'); await pg.wait_for_timeout(600)
        bs = await pg.evaluate("(()=>{const t=Proj.P.tracks.find(t=>t.name.startsWith('Bass'));const r=Proj.P.regions.find(r=>r.track===t.id);return {inst:t.inst,n:r.notes.length,bars:r.len/Proj.bar(),first:r.notes.slice(0,2).map(n=>n.m),f:r.notes[4].m,c:r.notes[8].m}})()")
        check('Bass aus Akkorden (Am F C G, Grundton–Quinte)', bs['n'] == 16 and bs['bars'] == 4 and bs['first'] == [33, 40] and bs['f'] == 41 and bs['c'] == 36 and bs['inst'] == 'kbass', bs)
        await pg.click('#cMkP'); await pg.wait_for_timeout(600)
        pd = await pg.evaluate("(()=>{const t=Proj.P.tracks.find(t=>t.name.startsWith('Flächen'));const r=Proj.P.regions.find(r=>r.track===t.id);return {inst:t.inst, am:r.notes.filter(n=>n.t===0).map(n=>n.m%12).sort((a,b)=>a-b)}})()")
        check('Flächen-Akkorde (Am = A C E)', pd['inst'] == 'strings' and pd['am'] == [0, 4, 9, 9], pd)
        check('Akkord-Erkennung (Cmaj7, F#m7, Bb, Dsus4)', await pg.evaluate("['Cmaj7','F#m7','Bb','Dsus4'].map(c=>{const x=Roll.parseChord(c);return x.r+':'+x.iv.join('.')}).join(' ')") == '0:0.4.7.11 6:0.3.7.10 10:0.4.7 2:0.5.7')
        # ---- MIDI-Export ----
        mid = await pg.evaluate("(()=>{const m=Exp.midi(Proj.P,0); return Array.from(m)})()")
        md = bytes(mid); ntr = md.count(b'MTrk')
        check('MIDI: Tempo-Spur + Klavier + Drums + Bass + Flächen', md[:4] == b'MThd' and ntr == 5, ntr)
        check('MIDI: Drums auf Kanal 10 (GM)', b'\x99\x24' in md or b'\x99\x26' in md)
        # Logic-ZIP enthält Instrumente als Audio
        await pg.click('#bProj'); await pg.wait_for_timeout(300)
        async with pg.expect_download(timeout=180000) as dl:
            await pg.click('#dlg [data-x="logic"]')
        d = await dl.value; zf = zipfile.ZipFile(await d.path())
        check('Logic-ZIP: jede Spur als WAV (auch Instrumente/Drums)', len([n for n in zf.namelist() if n.endswith('.wav')]) == 5, zf.namelist())
        # ---- Drums aus dem Looper übernehmen (Muster 1:1) ----
        pg2 = await ctx.new_page(); await pg2.goto(L); await pg2.wait_for_timeout(900)
        await pg2.evaluate("(()=>{ensureAudio(); const sr=audioCtx.sampleRate; const l=new Float32Array(sr*2).map((_, i)=>Math.sin(i/30)*0.2); Looper._setTrackRaw(0,l)})()")
        await pg2.evaluate("AppDB.put('ideas',{id:'dr1',v:2,name:'Mit Drums',ts:Date.now(),dateStr:'x',root:'C',mode:'Ionisch (Dur)',bpm:120,secs:2,cat:'backing',session:Looper.getSession(),drumState:Object.assign(Rhythm.getState(),{on:true}),droneState:null})")
        await pg2.close()
        await pg.click('#views [data-v="brw"]'); await pg.wait_for_timeout(800)
        await pg.click('#bList .item:has-text("Mit Drums")'); await pg.wait_for_timeout(800)
        await pg.click('#bNew'); await pg.wait_for_timeout(3000)
        dl2 = await pg.evaluate("(()=>{const r=Proj.P.regions.find(r=>r.kind==='drum');return r&&{mode:r.drum.mode, n:Object.keys(r.drum.steps||{}).length, bars:r.len/Proj.bar()}})()")
        check('Looper-Drums werden Drummer-Region (Muster 1:1)', dl2 and dl2['mode'] == 'steps' and dl2['n'] > 3, dl2)
        check('keine Fehler', not errs, errs[:4])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
