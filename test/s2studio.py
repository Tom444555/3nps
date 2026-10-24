# Studio S2: Aufnahme (Latenz-Ausgleich, Ersetzen), Automation Lautstärke/Panorama (live und im Export), Effekte im Export
import asyncio, sys
from playwright.async_api import async_playwright
S = 'http://localhost:8765/studio/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
TONE = """(async ([secs, amp]) => { const sr = Engine.sr(), n = Math.round(sr * secs), w = SDB.writer('Ton', sr, true), B = 65536;
  for (let a = 0; a < n; a += B) { const m = Math.min(B, n - a), l = new Float32Array(m); for (let i = 0; i < m; i++) l[i] = Math.sin((a + i) * 2 * Math.PI * 220 / sr) * amp; w.push(l, l); }
  const meta = await w.done(); let tid;
  Proj.change('regions', q => { const t = Proj.track('audio', 'Ton'); tid = t.id; q.tracks.push(t); q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: meta.id, start: 0, offset: 0, len: meta.frames, gain: 0, fi: 0, fo: 0, name: 'Ton' }); });
  Engine.dirty(true); UI.show('arr'); Arr.heads(); return tid; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, bypass_csp=True, accept_downloads=True, permissions=['microphone'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(S); await pg.wait_for_timeout(1200)
        sr = await pg.evaluate("Engine.sr()")
        tid = await pg.evaluate(TONE, [8, 0.3])
        # ---- Aufnahme ----
        await pg.evaluate("localStorage.setItem('3nps-studio-lat','0'); Arr.V.selTrack=null; Engine.seek(Proj.bar())")
        await pg.click('#bRec'); await pg.wait_for_timeout(2600)
        act = await pg.evaluate("Rec.active()"); await pg.click('#bRec'); await pg.wait_for_timeout(1500)
        R = await pg.evaluate("(()=>{const t=Proj.P.tracks.find(t=>t.name.startsWith('Aufnahme'));const r=t&&Proj.P.regions.find(r=>r.track===t.id);return t&&{t:t.name,arm:t.arm,r,bar:Proj.bar()}})()")
        check('Aufnahme läuft und legt Spur „Aufnahme 1“ an', act and R and R['arm'], R and R['t'])
        check('Region ab Takt 2, ~2,5 s lang', R and abs(R['r']['start'] - R['bar']) < 2 and 1.8 * sr < R['r']['len'] < 3.2 * sr, R and (R['r']['start'], R['r']['len'] / sr))
        lv = await pg.evaluate("(async()=>{const r=Proj.P.regions.find(r=>r.name.startsWith('Aufnahme'));const d=await SDB.read(r.audio,r.offset,r.len);let m=0;for(const v of d.l)m=Math.max(m,Math.abs(v));return m})()")
        check('Aufnahme enthält Ton (Test-Mikrofon)', lv > 0.01, round(lv, 3))
        # Latenz-Ausgleich 80 ms
        await pg.evaluate("localStorage.setItem('3nps-studio-lat','80'); Engine.seek(Proj.bar()*1.5)")
        await pg.click('#bRec'); await pg.wait_for_timeout(1800); await pg.click('#bRec'); await pg.wait_for_timeout(1500)
        rs = await pg.evaluate("(()=>{const t=Proj.P.tracks.find(t=>t.name.startsWith('Aufnahme'));return Proj.P.regions.filter(r=>r.track===t.id).sort((a,b)=>a.start-b.start).map(r=>({s:r.start,l:r.len,o:r.offset,a:r.audio}))})()")
        bar = await pg.evaluate("Proj.bar()")
        last = [r for r in rs if abs(r['s'] - 1.5 * bar) < 2]
        check('Latenz-Ausgleich: Anfang um 80 ms gekürzt', last and abs(last[0]['o'] - round(0.08 * sr)) <= 1, last)
        check('Ersetzen: alte Aufnahme an der Stelle ausgeschnitten', len(rs) >= 2 and all(rs[i]['s'] + rs[i]['l'] <= rs[i + 1]['s'] + 1 for i in range(len(rs) - 1)), [(round(r['s'] / bar, 2), round(r['l'] / bar, 2)) for r in rs])
        n0 = len(rs); await pg.click('#tUndo'); n1 = await pg.evaluate("(()=>{const t=Proj.P.tracks.find(t=>t.name.startsWith('Aufnahme'));return Proj.P.regions.filter(r=>r.track===t.id).length})()")
        check('Rückgängig holt die vorige Aufnahme zurück', n1 == 1, (n0, n1)); await pg.click('#tRedo')
        await pg.evaluate("Arr.V.selTrack=Proj.P.tracks[1].id; UI.inspect()"); await pg.click('#dTrackC [data-t="rec"]'); await pg.wait_for_timeout(500)
        check('Aufnahme-Einstellungen (Latenz, Stereo, Vorzähler)', await pg.locator('#rLat').count() == 1 and await pg.input_value('#rLat') == '80')
        await pg.click('#dlg [data-close]')
        # ---- Automation Lautstärke: 0 dB → −48 dB über Takt 1–3 ----
        await pg.evaluate("[1,2].forEach(()=>{}); Proj.P.tracks.slice(1).forEach(t=>{t.mute=true}); Proj.P.tracks.forEach((_, i)=>Engine.applyTrack(i))")
        await pg.evaluate("Arr.V.selTrack=Proj.P.tracks[0].id; UI.inspect()"); await pg.click('#dTrackC [data-t="auto"]')
        box = await pg.locator('#lanes').bounding_box()
        y = lambda v: 34 + 4 + (1 - (v + 48) / 54) * (64 - 8)
        for f, v in [(0.5, 0), (2.5, -48)]:
            x = await pg.evaluate("Arr.fx(Proj.bar()*%s)" % f); await pg.mouse.click(box['x'] + x, box['y'] + y(v)); await pg.wait_for_timeout(350)
        pts = await pg.evaluate("Proj.P.tracks[0].auto.vol")
        check('Automationspunkte per Tippen gesetzt', len(pts) == 2 and pts[0]['v'] >= -1 and pts[1]['v'] <= -46, pts)
        await pg.evaluate("Engine.seek(0)"); await pg.click('#bPlay'); await pg.wait_for_timeout(500)
        g0 = await pg.evaluate("Engine.graph.tr[0].vol.gain.value"); await pg.wait_for_timeout(4200)
        g1 = await pg.evaluate("Engine.graph.tr[0].vol.gain.value"); await pg.click('#bPlay')
        check('Lautstärke folgt der Automation beim Abspielen', g0 > 0.8 and g1 < 0.05, (round(g0, 3), round(g1, 4)))
        # ---- Pan-Automation ----
        await pg.click('#dTrackC [data-t="autop"]')
        await pg.evaluate("Proj.editTrack(Proj.P.tracks[0].id, t => { t.auto.pan = [{f:0,v:-100},{f:Proj.bar()*4,v:100}] })")
        await pg.evaluate("Engine.seek(Proj.bar()*3.5)"); await pg.click('#bPlay'); await pg.wait_for_timeout(500)
        pn = await pg.evaluate("Engine.graph.tr[0].pan.pan.value"); await pg.click('#bPlay')
        check('Panorama folgt der Automation', pn > 0.6, round(pn, 3))
        check('Panorama-Automation wird gezeichnet (eigene Farbe)', await pg.evaluate("Arr.V.auto && Arr.V.autoP==='pan'"))
        # ---- Export: Automation und Kompressor im Mix ----
        await pg.evaluate("Proj.editTrack(Proj.P.tracks[0].id, t => { t.auto.pan = [] })")
        m = await pg.evaluate("""(async()=>{const x=await Exp.render({a:0,b:Proj.bar()*4,tail:0}); const sr=x.sr, rms=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=x.l[i]*x.l[i];return Math.sqrt(s/(b-a))}; const bar=Proj.bar();
          return {a:rms(Math.round(bar*0.1),Math.round(bar*0.4)), b:rms(Math.round(bar*2.6),Math.round(bar*3.4))}})()""")
        check('Export: Automation wirkt (Takt 1 laut, Takt 3 leise)', m['a'] > 0.05 and m['b'] < m['a'] * 0.02, m)
        await pg.evaluate("Proj.editTrack(Proj.P.tracks[0].id, t => { t.auto.vol = []; t.fx.comp = {on:true, th:-40, ratio:20, att:1, rel:50, mk:0} })")
        m2 = await pg.evaluate("""(async()=>{const x=await Exp.render({a:0,b:Proj.bar()*2,tail:0,noMaster:true}); let s=0, n=0; for(let i=20000;i<x.l.length;i++){s+=x.l[i]*x.l[i];n++} return Math.sqrt(s/n)})()""")
        check('Export: Kompressor wirkt', m2 < m['a'] * 0.5, (round(m2, 4), round(m['a'], 4)))
        check('keine Fehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
