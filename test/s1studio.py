# Studio S1: Übernahme aus dem Looper, Abspielen (blockweise), Bearbeiten, Mischpult, Export, In den Looper, Speicher
import asyncio, re, sys
from playwright.async_api import async_playwright
L = 'http://localhost:8765/index.html'
S = 'http://localhost:8765/studio/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
MK = """(async ([sr, bpm, n, secs, cat, id, name]) => {
  const L = Math.round(sr * secs), tr = [];
  for (let k = 0; k < n; k++) { const l = new Uint8Array(L * 3), r = new Uint8Array(L * 3), f = 110 * (k + 1);
    for (let i = 0; i < L; i++) { const t = i / sr, beat = (t * bpm / 60) % 1, env = Math.exp(-beat * 6); const v = Math.round(Math.sin(2 * Math.PI * f * t) * 0.3 * env * 8388607), w = Math.round(Math.sin(2 * Math.PI * f * 1.5 * t) * 0.2 * env * 8388607);
      l[i*3] = v & 255; l[i*3+1] = (v >> 8) & 255; l[i*3+2] = (v >> 16) & 255; r[i*3] = w & 255; r[i*3+1] = (w >> 8) & 255; r[i*3+2] = (w >> 16) & 255; }
    tr.push({ L, enc: 'i24', dl: l, dr: r, vol: 90, eq: [0,0,0,0,0,0,0] }); }
  await AppDB.put('ideas', { id, v: 2, name, ts: Date.now(), dateStr: 'heute', root: 'A', mode: 'Äolisch (Moll)', bpm, secs, cat, session: { sr, baseL: L, stereo: true, tracks: tr }, drumState: null, droneState: null });
})"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, accept_downloads=True, bypass_csp=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        await pg.goto(L); await pg.wait_for_timeout(900)
        check('Looper v106', 'v106' in await pg.inner_text('.brand'))
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        # 4 Takte bei 100 BPM = 9,6 s, 3 Spuren; dazu ein Loop mit 2 Takten bei 120 BPM
        await pg.evaluate(MK, [sr, 100, 3, 9.6, 'idee', 'idA', 'Testidee'])
        await pg.evaluate(MK, [sr, 120, 1, 4.0, 'loop', 'idB', 'Kurzer Loop'])
        await pg.evaluate("document.getElementById('ideaFold').open=true"); await pg.reload(); await pg.wait_for_timeout(900)
        await pg.evaluate("document.getElementById('ideaFold').open=true")
        check('Looper: Knopf „Studio“ an jeder Idee', await pg.locator('#ideaList [data-act="studio"]').count() >= 2)
        await pg.locator('.idea-row[data-id="idA"] [data-act="studio"]').click()
        await pg.wait_for_url(re.compile(r'.*/studio/.*'), timeout=8000); await pg.wait_for_timeout(1500)
        check('Studio öffnet (eigene Seite)', 'Loopsmiths' in await pg.inner_text('.brand'), await pg.title())
        check('„Aus dem Looper“ zeigt die Idee vorgewählt', await pg.locator('#v-brw:not([hidden]) .item.a').count() == 1 and 'Testidee' in await pg.inner_text('#bPrev'))
        check('Vorschau mit 3 Wellenformen', await pg.locator('#bTr canvas').count() == 3)
        await pg.click('#bNew'); await pg.wait_for_function("Proj.P && Proj.P.tracks.length===3 && UI.view==='arr'", timeout=20000)
        P = await pg.evaluate("({n:Proj.P.tracks.length, r:Proj.P.regions.length, bpm:Proj.P.bpm, key:Proj.P.key, len:Proj.P.regions[0].len, name:Proj.P.name})")
        check('Neues Projekt: 3 Spuren, Tempo und Tonart übernommen', P['n'] == 3 and P['bpm'] == 100 and P['key'] == 'A Moll', P)
        check('Regionenlänge = 4 Takte', abs(P['len'] - round(sr * 9.6)) < 4, P['len'])
        # Loop dazu, ins Projekttempo (120 → 100 BPM), ab Takt 5, ×2
        await pg.click('#views [data-v="brw"]'); await pg.wait_for_timeout(600)
        await pg.click('#bList .item:has-text("Kurzer Loop")'); await pg.wait_for_timeout(700)
        check('Vorschlag „ab Takt 5“', await pg.input_value('#bBar') == '5', await pg.input_value('#bBar'))
        check('Tempo angleichen vorgeschlagen', await pg.is_checked('#bFit'))
        await pg.select_option('#bReps', '2'); await pg.click('#bInto')
        await pg.wait_for_function("Proj.P.tracks.length===4", timeout=30000); await pg.wait_for_timeout(300)
        R = await pg.evaluate("(()=>{const t=Proj.P.tracks[3];const rs=Proj.P.regions.filter(r=>r.track===t.id);return {n:rs.length,len:rs[0].len,start:rs[0].start,bar:Proj.bar()}})()")
        check('Loop: 2 Regionen ab Takt 5', R['n'] == 2 and abs(R['start'] - 4 * R['bar']) < 2, R)
        check('Loop ins Tempo gebracht (2 Takte bei 100 BPM)', abs(R['len'] - 2 * R['bar']) < sr * 0.02, (R['len'], 2 * R['bar']))
        # Abspielen
        await pg.click('#bPlay'); await pg.wait_for_timeout(1500)
        st = await pg.evaluate("({pos:Engine.curPos(), lv:[0,1,2,3].map(i=>Engine.level(i)), m:Engine.masterLevel(), play:Engine.playing, lcd:document.getElementById('lPos').textContent})")
        check('Abspielen läuft, Position wandert', st['play'] and st['pos'] > sr * 0.8, st)
        check('Ton auf den Spuren (Pegel)', max(st['lv'][:3]) > 0.01 and st['m'] > 0.01, st)
        await pg.click('#bPlay'); await pg.wait_for_timeout(200)
        # Bearbeiten: auswählen, teilen, duplizieren, rückgängig
        await pg.evaluate("Arr.V.sel=Proj.P.regions[0].id; Arr.V.selTrack=Proj.P.regions[0].track; UI.inspect(); Engine.seek(Proj.bar()*2)"); await pg.wait_for_timeout(200)
        n0 = await pg.evaluate("Proj.P.regions.length")
        await pg.evaluate("document.getElementById('tSplit').click()"); n1 = await pg.evaluate("Proj.P.regions.length")
        check('Teilen an der Abspielposition', n1 == n0 + 1)
        await pg.click('#tUndo'); n2 = await pg.evaluate("Proj.P.regions.length"); await pg.click('#tRedo'); n3 = await pg.evaluate("Proj.P.regions.length")
        check('Rückgängig / Wiederholen', n2 == n0 and n3 == n1, (n0, n1, n2, n3))
        # Ziehen einer Region mit dem Finger (Maus)
        box = await pg.locator('#lanes').bounding_box()
        x0 = await pg.evaluate("Arr.fx(Proj.P.regions[1].start + Proj.P.regions[1].len/2)"); y0 = 34 + 64 * 1.5
        s0 = await pg.evaluate("Proj.P.regions[1].start")
        await pg.mouse.move(box['x'] + x0, box['y'] + y0); await pg.mouse.down(); await pg.mouse.move(box['x'] + x0 + 60, box['y'] + y0, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(200)
        s1 = await pg.evaluate("Proj.P.regions[1].start")
        check('Region verschieben (rastet auf Schlag)', s1 != s0 and abs((s1 / await pg.evaluate("Proj.spb()")) - round(s1 / await pg.evaluate("Proj.spb()"))) < 1e-6, (s0, s1))
        # Mischpult
        await pg.click('#views [data-v="mix"]'); await pg.wait_for_timeout(400)
        check('Mischpult: 4 Kanäle + Master', await pg.locator('#mix .strip').count() == 5)
        await pg.evaluate("(()=>{const el=document.querySelector('#mix .strip [data-a=vol]');el.value=-6;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))})()"); await pg.wait_for_timeout(300)
        g = await pg.evaluate("({v:Proj.P.tracks[0].vol, g:Engine.graph.tr[0].vol.gain.value})")
        check('Fader wirkt (−6 dB)', g['v'] == -6 and abs(g['g'] - 0.501) < 0.02, g)
        await pg.click('#mix .strip >> nth=0 >> .slot[data-k="comp"]'); await pg.wait_for_timeout(200)
        await pg.click('#dlg [data-pre="vocal"]'); await pg.click('#dlg [data-close]'); await pg.wait_for_timeout(200)
        fx = await pg.evaluate("({c:Proj.P.tracks[0].fx.comp.on, r:Proj.P.tracks[0].fx.rev, th:Engine.graph.tr[0].comp.threshold.value})")
        check('Effekte: Vorlage Gesang (Kompressor, Hall)', fx['c'] and fx['r'] == 22 and fx['th'] < -10, fx)
        await pg.click('#mix .strip >> nth=0 >> canvas.eqm'); await pg.wait_for_timeout(300)
        check('EQ-Fenster (EQ wie im Looper)', await pg.locator('#dlg .eq2-bands .eq2-bt').count() == 9)
        await pg.select_option('#dlg .eq-pre', index=2); await pg.click('#dlg [data-close]'); await pg.wait_for_timeout(200)
        check('EQ-Vorlage gespeichert', not await pg.evaluate("EQ7.isFlat(Proj.P.tracks[0].eq)"))
        # Export: Mix
        await pg.click('#bProj'); await pg.wait_for_timeout(300)
        async with pg.expect_download(timeout=60000) as dl:
            await pg.click('#dlg [data-x="mix"]')
        d = await dl.value; mix = await pg.evaluate("window.__lastMix")
        endF = await pg.evaluate("Proj.projEnd()")
        check('Mix-WAV: Name mit Tempo', d.suggested_filename.endswith('100 BPM.wav'), d.suggested_filename)
        check('Mix: Länge = Projekt + Ausklang, Ton vorhanden', abs(mix['n'] - (endF + 1.5 * sr)) < 4 and mix['peak'] > 0.05, (mix, endF))
        await pg.click('#bProj'); await pg.wait_for_timeout(300)
        async with pg.expect_download(timeout=120000) as dl:
            await pg.click('#dlg [data-x="logic"]')
        d = await dl.value; z = await pg.evaluate("window.__lastZip")
        check('Logic-ZIP: Mix + 4 Spuren + MIDI + Anleitung', z['n'] == 7 and any(n.endswith('.mid') for n in z['names']), z['names'])
        import zipfile; zp = await d.path(); zf = zipfile.ZipFile(zp); bad = zf.testzip()
        check('ZIP lässt sich öffnen', bad is None and len(zf.namelist()) == 7)
        mid = [n for n in zf.namelist() if n.endswith('.mid')][0]; md = zf.read(mid)
        check('MIDI mit Tempo 100 BPM', md[:4] == b'MThd' and (b'\xff\x51\x03' + (600000).to_bytes(3, 'big')) in md)
        await pg.click('#bProj'); await pg.wait_for_timeout(300)
        async with pg.expect_download(timeout=120000) as dl:
            await pg.click('#dlg [data-x="mixm"]')
        d = await dl.value; mm = await pg.evaluate("window.__lastMaster")
        check('Mix gemastert (−14 LUFS)', mm and abs(mm['I'] + 14) < 0.6 and mm['TP'] <= -0.9, mm)
        # In den Looper: Cycle Takt 1–5
        await pg.evaluate("Proj.P.cycle={on:true,a:0,b:Proj.bar()*4}; Engine.setCycle()")
        await pg.click('#bProj'); await pg.wait_for_timeout(300); await pg.click('#dlg [data-x="looper"]')
        await pg.wait_for_function("/Looper gespeichert/.test(document.getElementById('status').textContent)", timeout=30000)
        # Neustart: Projekt bleibt
        await pg.reload(); await pg.wait_for_timeout(1500)
        P2 = await pg.evaluate("({n:Proj.P.tracks.length, v:Proj.P.tracks[0].vol, rev:Proj.P.tracks[0].fx.rev})")
        check('Nach Neustart: Projekt wieder da', P2['n'] == 4 and P2['v'] == -6 and P2['rev'] == 22, P2)
        await pg.click('#bProj'); await pg.wait_for_timeout(300)
        await pg.click('#dlg a[href="../"]'); await pg.wait_for_timeout(1500)
        ids = await pg.evaluate("AppDB.list('ideas', i => ({n:i.name, c:i.cat, s:i.secs, t:i.session&&i.session.tracks.length}))")
        st = [i for i in ids if i['c'] == 'team']
        check('Im Looper: neue Idee in „Zusammenarbeit“ (4 Takte)', len(st) == 1 and abs(st[0]['s'] - 9.6) < 0.01 and st[0]['t'] == 1, st)
        await pg.evaluate("document.getElementById('ideaFold').open=true"); await pg.click('#ideaFilter [data-f="all"]'); await pg.wait_for_timeout(300)
        await pg.locator('.idea-row', has_text='Takt 1–4').locator('[data-act="load"]').click(); await pg.wait_for_timeout(900)
        check('Looper lädt die Studio-Idee', 'geladen' in await pg.inner_text('#loopStatus'), await pg.inner_text('#loopStatus'))
        check('keine Fehler', not errs, errs[:5])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
