# v97: Mastering M1 – Reiter, Datei messen (gegen ffmpeg), auf −14 LUFS / −1 dBTP bringen, WAV 24 Bit speichern (nachgemessen),
# A/B gleich laut, Ziele, Looper-Spur als Quelle, Song-Export „gemastert“
import asyncio, json, subprocess, re, struct
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'; SP = '/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/m1/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
def ff(f):
    s = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = s[s.rfind('Summary:'):]; g = lambda r: float(re.search(r, s).group(1))
    return {'I': g(r'I:\s+(-?[\d.]+) LUFS'), 'TP': g(r'Peak:\s+(-?[\d.]+) dBFS'), 'LRA': g(r'LRA:\s+(-?[\d.]+) LU\n')}
SRC = SP + 'src48.wav'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', T + 'corpus/ballad_drums_80.wav', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', SRC])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 860}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(900)
        check('Version ≥ v97', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 97)
        await pg.click('#tab-master'); await pg.wait_for_timeout(300)
        check('Reiter Mastering sichtbar', await pg.is_visible('#panel-master') and await pg.is_visible('#msLoad'))
        await pg.select_option('#msTarget', 'stream')
        await pg.set_input_files('#msFile', SRC)
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if 'Gemessen' in await pg.inner_text('#msStatus'): break
        ref = ff(SRC); bef = await pg.evaluate("Master.cur().before")
        check('Messung = ffmpeg (I ±0,1 LU, TP ±0,2 dB, LRA ±1 LU)', abs(bef['I'] - ref['I']) <= 0.1 and abs(bef['TP'] - ref['TP']) <= 0.2 and abs(bef['LRA'] - ref['LRA']) <= 1, (round(bef['I'], 2), round(bef['TP'], 2), round(bef['LRA'], 1), ref))
        check('Werte in der Tabelle (deutsch, Komma)', 'LUFS' in await pg.inner_text('#mvI0') and ',' in await pg.inner_text('#mvI0'), await pg.inner_text('#mvI0'))
        await pg.click('#msRun')
        for _ in range(200):
            await pg.wait_for_timeout(250)
            if 'Fertig' in await pg.inner_text('#msStatus'): break
        aft = await pg.evaluate("(()=>{const r=Master.cur().res;return {I:r.after.I,TP:r.after.TP,red:r.red,ms:window.__msMs}})()")
        check('Master: −14 LUFS (±0,1) und ≤ −1 dBTP', abs(aft['I'] + 14) <= 0.1 and aft['TP'] <= -0.95, aft)
        check('Tabelle „Nachher“ grün', 'ok' in await pg.get_attribute('#mvI1', 'class') and 'ok' in await pg.get_attribute('#mvT1', 'class'))
        async with pg.expect_download() as dl: await pg.click('#msSave')
        d = await dl.value; out = SP + 'master_out.wav'; await d.save_as(out)
        hdr = open(out, 'rb').read(44); bits = struct.unpack('<H', hdr[34:36])[0]; r = ff(out)
        check('WAV 24 Bit gespeichert, nachgemessen mit ffmpeg: −14 LUFS / ≤ −0,8 dBTP', bits == 24 and abs(r['I'] + 14) <= 0.15 and r['TP'] <= -0.8, (bits, r, d.suggested_filename))
        # A/B gleich laut
        await pg.click('#msPlay'); await pg.wait_for_timeout(400)
        g1 = await pg.evaluate("Master.playing()")
        await pg.click('#msAB [data-ab="b"]'); await pg.wait_for_timeout(300)
        gb = await pg.evaluate("(()=>{const c=Master.cur();return Math.pow(10,(c.before.I-c.res.after.I)/20)})()")
        check('A/B: spielt, Master beim Vergleich auf Original-Lautheit gedreht', g1 and gb < 1, round(gb, 3))
        await pg.click('#msPlay'); check('Stopp', not await pg.evaluate("Master.playing()"))
        # Ziele
        await pg.select_option('#msTarget', 'apple'); check('Apple Music: Ziel −16 LUFS', '16' in await pg.inner_text('#mvIz'))
        await pg.select_option('#msTarget', 'loud'); check('Laut: Hinweis „drehen leiser“', await pg.is_visible('#msHint'))
        await pg.select_option('#msTarget', 'own'); await pg.fill('#msI', '-12'); await pg.dispatch_event('#msI', 'change')
        check('Eigene Vorgabe −12 gespeichert', json.loads(await pg.evaluate("localStorage.getItem('3nps-master-target')"))['I'] == -12)
        await pg.select_option('#msTarget', 'stream')
        # Looper-Spur als Quelle
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        await pg.click('#tab-master'); await pg.select_option('#msSrc', 't0'); await pg.click('#msLoad')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if 'Gemessen' in await pg.inner_text('#msStatus'): break
        rb = ff(T + 'corpus/ballad_72.wav'); lb = await pg.evaluate("Master.cur().before.I")
        check('Looper Spur 1 als Quelle gemessen', abs(lb - rb['I']) <= 0.2, (round(lb, 2), rb['I']))
        await pg.select_option('#msSrc', 't2'); await pg.click('#msLoad'); await pg.wait_for_timeout(400)
        check('leere Spur: verständlicher Hinweis', 'keine geladene Datei' in await pg.inner_text('#msStatus'), await pg.inner_text('#msStatus'))
        # Song-Export „gemastert“ (LiedExport.build mit Master-Hook)
        res = await pg.evaluate("""(async()=>{const n=48000*8,l=new Int16Array(n);for(let i=0;i<n;i++)l[i]=Math.round(12000*Math.sin(2*Math.PI*220*i/48000)*(0.6+0.4*Math.sin(i/9000)));
          const v={n:1,bpm:120,key:{pc:0,major:true},parts:[{id:'p1',name:'Strophe',type:'verse',chords:[{r:0,t:'',beats:16}],audio:'a1',audioSig:'0:16',audioBpm:120,lyrics:['la la']}],order:[{p:'p1',reps:1}]};
          const t=Master.target();const r=await LiedExport.build({name:'Test'},v,{getRec:async()=>({l,sr:48000}),sr:48000,master:async(L,R,sr)=>{const q=await Master.normalize(R?[L,R]:[L],sr,t.I,t.T);window.__lm=q.after;return {L:q.outs[0],R:q.outs[1]||null,label:t.label,report:Master.reportText('Test',q,t)}}});
          return {files:r.files.map(f=>f.name),I:window.__lm.I,TP:window.__lm.TP,t:t.I}})()""")
        check('Song-Export: gemasterte Fassung + Bericht im Paket, Ziel erreicht', any('gemastert' in f for f in res['files']) and any('Mastering-Bericht' in f for f in res['files']) and abs(res['I'] - res['t']) <= 0.15 and res['TP'] <= -0.95, (res['I'], res['TP'], [f for f in res['files'] if 'master' in f.lower()]))
        await pg.click('#tab-lied'); check('Songwriting: Schalter „gemastert“ beim Export', await pg.locator('#ldTM').count() == 1)
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
