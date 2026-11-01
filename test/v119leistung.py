# v119: Drums und Drone sparsamer (Worklet-Stimmen + vorberechneter Raumhall, Drone als vorgerechnete Schleife, EQ ohne Leerlauf-Filter)
# und Signalweg-Anzeige „Leistung“ mit Anteilen je Station. Klangvergleich gegen test/v119ref.json (Stand v118, aus v119ref.py save),
# Lastvergleich A/B gegen den v118-Stand aus Git (eigener Server auf Port 8767), Messung per CDP WebAudio.getRealtimeData.
import asyncio, base64, json, os, statistics, subprocess, math, struct, wave
import numpy as np
from playwright.async_api import async_playwright
T = '/home/claude/3nps-src/test/'; U = 'http://localhost:8765/index.html'; UOLD = 'http://localhost:8767/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''), flush=True)
REF = json.load(open(T + 'v119ref.json'))
exec(open(T + 'v119ref.py').read().split('async def capture')[0].split('import numpy as np')[1].replace('from playwright.async_api import async_playwright', ''))   # SEED, REC, BANDS, analyse
WAV = '/tmp/v116_sine110.wav'
if not os.path.exists(WAV):
    sr = 48000; w = wave.open(WAV, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(struct.pack('<h', int(12000 * math.sin(2 * math.pi * 110 * i / sr))) for i in range(sr * 4))); w.close()

def old_server():
    d = '/tmp/v119_old'
    if not os.path.exists(d + '/index.html'):
        os.makedirs(d, exist_ok=True)
        for f in os.listdir('/home/claude/3nps-src/app/www'):
            if f != 'index.html' and not os.path.exists(d + '/' + f): os.symlink('/home/claude/3nps-src/app/www/' + f, d + '/' + f)
        html = subprocess.run(['git', '-C', '/home/claude/3nps-src', 'show', '63e2248:app/www/index.html'], capture_output=True, check=True).stdout
        open(d + '/index.html', 'wb').write(html)
    if subprocess.run(['curl', '-s', '-o', '/dev/null', UOLD]).returncode != 0:
        subprocess.Popen(['setsid', 'python3', '-m', 'http.server', '8767'], cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import time; time.sleep(1.2)

def cmp_bands(ref, new, tol_max, tol_mean):
    out = []
    for ch in 'LR':
        a, b = ref[ch]['bands'], new[ch]['bands']; mx = max(a)
        d = [y - x for x, y in zip(a, b) if x > mx - 45]
        out.append((max(abs(v) for v in d), statistics.mean(abs(v) for v in d)))
    pw = lambda r: 10 * math.log10(10 ** (r['L']['rms'] / 10) + 10 ** (r['R']['rms'] / 10))
    dr = pw(new) - pw(ref)
    good = all(m <= tol_max and a <= tol_mean for m, a in out)
    return good, round(dr, 2), [(round(m, 1), round(a, 2)) for m, a in out]

async def load_run(p, url, what, init=''):
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = await b.new_context(bypass_csp=True); pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    if init: await pg.add_init_script(init)
    cdp = await ctx.new_cdp_session(pg); ids = []; cdp.on('WebAudio.contextCreated', lambda e: ids.append(e['context'])); await cdp.send('WebAudio.enable')
    await pg.goto(url); await pg.wait_for_timeout(1200)
    await pg.evaluate("ensureAudio(); const e=document.getElementById('bpm'); e.value='120'; e.dispatchEvent(new Event('input')); 0"); await pg.wait_for_timeout(700)
    cid = [c['contextId'] for c in ids if c['contextType'] == 'realtime'][-1]
    async def cap():
        await pg.wait_for_timeout(1200); v = []
        for _ in range(40): v.append((await cdp.send('WebAudio.getRealtimeData', {'contextId': cid}))['realtimeData']['renderCapacity']); await pg.wait_for_timeout(100)
        return statistics.median(v) * 1000
    r0 = await cap()
    if what == 'drums': await pg.evaluate("Rhythm.setOn(true)"); await pg.wait_for_timeout(5500)
    else:
        await pg.evaluate("document.getElementById('droneStyle').value='v1'; startDrone(); 0"); await pg.wait_for_timeout(3000)
        for _ in range(40):
            if await pg.evaluate("typeof DroneLoop!=='undefined' && DroneLoop.state().loop"): break
            await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(3000)
    r1 = await cap(); await b.close()
    return r1 - r0, errs

async def capture(p, what, init=''):
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = await (await b.new_context(bypass_csp=True)).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(SEED); await pg.add_init_script(REC)
    if init: await pg.add_init_script(init)
    await pg.goto(U); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.setItem('3nps-limiter','1'); ensureAudio(); const e=document.getElementById('bpm'); e.value='120'; e.dispatchEvent(new Event('input')); 0")
    await pg.wait_for_timeout(500); extra = {}
    if what == 'drums':
        await pg.evaluate("Rhythm.setOn(true)"); await pg.wait_for_timeout(1500)
        await pg.evaluate("__rec2()"); await pg.wait_for_timeout(12000); extra['eng'] = await pg.evaluate("Rhythm.engine()")
    else:
        await pg.evaluate(f"document.getElementById('droneStyle').value='{what}'; startDrone(); 0"); await pg.wait_for_timeout(16000)
        extra['st'] = await pg.evaluate("DroneLoop.state()")
        await pg.evaluate("__rec2()"); await pg.wait_for_timeout(20000)
    d = await pg.evaluate("__stop2()"); await b.close()
    r = analyse(d); r['errs'] = errs[:2]; r.update(extra); return r

SEED2 = r"""(() => { let a = 1; const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Math.random = f; window.__reseed = s => { a = s; }; })();"""
async def drone_same(p, st):
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = await (await b.new_context(bypass_csp=True)).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(SEED2); await pg.goto(U); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.setItem('3nps-drone-live','1'); ensureAudio(); const e=document.getElementById('bpm'); e.value='120'; e.dispatchEvent(new Event('input')); 0")
    await pg.wait_for_timeout(500)
    W = await pg.evaluate(f"DroneLoop._warm('{st}')"); bd = 2.0; W = math.ceil(W / bd) * bd; L = 32.0
    await pg.evaluate(f"""(()=>{{document.getElementById('droneStyle').value='{st}'; NordDrones._clear(); __reseed(777); startDrone();
      const sp=audioCtx.createScriptProcessor(4096,2,2), A=[], B=[]; sp.onaudioprocess=e=>{{A.push(new Float32Array(e.inputBuffer.getChannelData(0)));B.push(new Float32Array(e.inputBuffer.getChannelData(1)));}};
      droneNodes.master.connect(sp); sp.connect(audioCtx.destination); window.__lv={{A,B,sp,vol:parseInt(document.getElementById('droneVolume').value)/100}};}})()""")
    await pg.wait_for_timeout(int((W + L + 1) * 1000))
    res = await pg.evaluate(f"""(async()=>{{const r=window.__lv; r.sp.disconnect(); stopDrone();
      const cat=a=>{{const n=a.reduce((s,c)=>s+c.length,0),o=new Float32Array(n);let p=0;for(const c of a){{o.set(c,p);p+=c.length;}}return o;}};
      const Lv=cat(r.A), Rv=cat(r.B); await new Promise(z=>setTimeout(z,1500)); NordDrones._clear(); __reseed(777); const R=await DroneLoop._render('{st}');
      const sr=audioCtx.sampleRate, x=Math.round(2.2*sr), n=Math.round(({L}-2.4)*sr), a=Math.round(({W})*sr);
      const enc=o=>{{let s='';const u=new Uint8Array(o.buffer);for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);}};
      const sc=v=>v.map(q=>q/r.vol);
      return {{live:{{L:enc(sc(Lv.slice(a+x,a+x+n))),R:enc(sc(Rv.slice(a+x,a+x+n))),sr}}, loop:{{L:enc(R.buf.getChannelData(0).slice(x,x+n)),R:enc(R.buf.getChannelData(1).slice(x,x+n)),sr}}, len:Lv.length/sr}};}})()""")
    await b.close()
    lv, lp = analyse(res['live']), analyse(res['loop'])
    g, dr, dv = cmp_bands(lv, lp, 14.0, 1.2)   # v1: Zierklänge per setTimeout liegen live minimal anders → einzelne Bänder
    return {'good': g and not errs, 'dr': dr, 'info': (dr, dv, round(res['len'], 1), errs[:1])}

SPY = """(() => { window.__lm = { made: 0, live: 0 }; const W = window.AudioWorkletNode; if (!W) return;
  window.AudioWorkletNode = function (c, name, o) { const n = new W(c, name, o); if (name === 'loadmeter') { window.__lm.made++; window.__lm.live++; const d = n.disconnect.bind(n); n.disconnect = (...a) => { if (!a.length) window.__lm.live--; return d(...a); }; } return n; };
  window.AudioWorkletNode.prototype = W.prototype; })()"""

async def main():
    old_server()
    async with async_playwright() as p:
        # ---------- 1) Signalweg: Leistung + Anteile ----------
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV, '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, bypass_csp=True); await ctx.grant_permissions(['microphone'])
        await ctx.add_init_script(SPY)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        cdp = await ctx.new_cdp_session(pg); ids = []; cdp.on('WebAudio.contextCreated', lambda e: ids.append(e['context'])); await cdp.send('WebAudio.enable')
        await pg.goto(U); await pg.wait_for_timeout(900)
        await pg.evaluate("localStorage.removeItem('3nps-amp-on');localStorage.setItem('3nps-countin','0');localStorage.setItem('3nps-limiter','1');0")
        await pg.reload(); await pg.wait_for_timeout(1000)
        check('ab v119', int(__import__('re').search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 119)
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        # EQ: flach = keine Filter in der Kette, Klang bitgleich; ein Band an = 1 Filter
        eq = await pg.evaluate("""(async()=>{const k=EQ7.chain(audioCtx); k.set(EQ7.flat()); const a0=k.active(); const v=EQ7.flat(); v.b[3].g=4; k.set(v); const a1=k.active(); v.b[3].g=0; k.set(v); const a2=k.active();
          const sr=48000, oc=new OfflineAudioContext(1, sr, sr), c2=EQ7.chain(oc); c2.set(EQ7.flat()); const bf=oc.createBuffer(1, sr, sr), d=bf.getChannelData(0); for(let i=0;i<sr;i++) d[i]=Math.sin(i*0.05)*0.5+Math.sin(i*0.31)*0.2;
          const s=oc.createBufferSource(); s.buffer=bf; s.connect(c2.input); c2.output.connect(oc.destination); s.start(); const o=(await oc.startRendering()).getChannelData(0); let m=0; for(let i=0;i<sr;i++) m=Math.max(m,Math.abs(o[i]-d[i]));
          return [a0,a1,a2,m]})()""")
        check('EQ flach: 0 Filter aktiv, 1 Band an: 1 Filter, wieder 0 dB: 0; flach klingt bitgleich', eq[0] == 0 and eq[1] == 1 and eq[2] == 0 and eq[3] < 1e-6, eq)
        await pg.evaluate("""(sr=>{const a=new Float32Array(sr*2).map((_,i)=>0.4*Math.sin(2*Math.PI*220*i/sr)), c=new Float32Array(sr*2).map((_,i)=>0.25*Math.sin(2*Math.PI*330*i/sr));
          Looper._setTrackRaw(0,a); Looper._setTrackRaw(1,c); const se=Looper.getSession(); se.baseL=se.tracks[0].L; Looper.loadSession(se)})(%d)""" % sr)
        await pg.evaluate("Rhythm.setOn(true)"); await pg.evaluate("document.getElementById('laneDrone').click()"); await pg.wait_for_timeout(1500)
        await pg.click('#loopSigBtn'); await pg.wait_for_timeout(2600)
        s = await pg.evaluate("Looper._sig()")
        val = await pg.inner_text('#sigPerfVal'); src = await pg.inner_text('#sigPerfSrc')
        check('Anzeige „Leistung“ mit Zahl und Herkunft', val.strip().endswith('%') and val.strip()[:-1].strip().isdigit() and src in ('gemessen', 'geschätzt', 'geschätzt (Modell)'), (val, src))
        check('Chrome ohne renderCapacity: Mess-Worklet läuft („geschätzt“)', s['meter']['node'] and src == 'geschätzt', (s['meter'], src))
        sh = s['share']; act = {k: v for k, v in sh.items() if v > 0}
        check('Anteile je Station summieren ~100 %', 97 <= sum(sh.values()) <= 103 and len(act) >= 4, sh)
        lbl = await pg.evaluate("[...document.querySelectorAll('#sigWrap [id^=sgl-]')].map(e=>e.id.slice(4)+':'+e.textContent)")
        check('Anteil steht an den aktiven Stationen (Spuren, Drums, Drone, Master)', all(any(x.startswith(k + ':') and x.endswith('%') for x in lbl) for k in ('t0', 't1', 'dr', 'dn', 'ms')), lbl)
        cid = [c['contextId'] for c in ids if c['contextType'] == 'realtime'][-1]
        est = []; cd = []
        for _ in range(6):
            await pg.wait_for_timeout(1000); est.append((await pg.evaluate("Looper._sig()"))['load'])
            cd.append((await cdp.send('WebAudio.getRealtimeData', {'contextId': cid}))['realtimeData']['renderCapacity'])
        e1, c1 = statistics.median(est), statistics.median(cd)
        check('Schätzung passt zur Messung des Browsers (CDP renderCapacity)', abs(e1 - c1) <= max(0.04, 0.6 * c1), (round(e1, 3), round(c1, 3)))
        cls = [await pg.evaluate(f"Looper._sigLoad({v})") for v in (0.3, 0.75, 0.95)]
        check('Balken: grün / gelb ab 70 % / rot ab 90 %', cls[0][0] == '' and cls[1][0] == 'warn' and cls[2][0] == 'hot' and cls[2][1] == '95 %', cls)
        await pg.screenshot(path='/tmp/v119-signal.png')
        await pg.click('#sigClose'); await pg.wait_for_timeout(400)
        s2 = await pg.evaluate("Looper._sig()"); lm = await pg.evaluate("window.__lm")
        check('nach Schließen: keine Messung aktiv (Mess-Worklet getrennt)', not s2['meter']['node'] and not s2['meter']['rc'] and lm['live'] == 0 and lm['made'] >= 1, (s2['meter'], lm))
        await pg.wait_for_timeout(2500)
        check('geschlossen: kein neues Mess-Worklet', (await pg.evaluate("window.__lm"))['made'] == lm['made'])
        # Drone: Tonart ändern → sofort live, danach wieder Schleife; Aus
        for _ in range(30):
            if await pg.evaluate("DroneLoop.state().loop"): break
            await pg.wait_for_timeout(500)
        l0 = await pg.evaluate("DroneLoop.state()")
        await pg.select_option('#laneDroneRoot', 'D'); await pg.wait_for_timeout(300)
        l1 = await pg.evaluate("DroneLoop.state()")
        for _ in range(40):
            if await pg.evaluate("DroneLoop.state().loop"): break
            await pg.wait_for_timeout(500)
        l2 = await pg.evaluate("DroneLoop.state()")
        check('Drone: Schleife → Tonart ändern: sofort live, dann neue Schleife', l0['loop'] and not l1['loop'] and l2['loop'] and l2['renders'] > l0['renders'], (l0['mode'], l1['mode'], l2['mode'], l2['renders']))
        seam = await pg.evaluate("""(()=>{const b=DroneLoop._buf(); if(!b) return null; const d=b.getChannelData(0), w=Math.round(b.sampleRate*0.05), n=d.length; const rms=(a,s)=>{let e=0;for(let i=0;i<w;i++){const v=a[(s+i)%n];e+=v*v}return Math.sqrt(e/w)+1e-9};
          const j=[]; for(let s=0;s+2*w<n;s+=w) j.push(Math.abs(20*Math.log10(rms(d,s+w)/rms(d,s)))); j.sort((a,b)=>a-b); const wrap=Math.abs(20*Math.log10(rms(d,0)/rms(d,n-w)));
          let mx=0; for(let i=1;i<n;i++) mx=Math.max(mx,Math.abs(d[i]-d[i-1])); const jump=Math.abs(d[0]-d[n-1]); return [wrap, j[Math.floor(j.length*0.99)], jump, mx, b.duration]})()""")
        check('Schleifen-Naht ohne Sprung (Pegel und Abtastwert wie innerhalb der Schleife)', seam and seam[0] <= max(1.5, seam[1] * 1.5) and seam[2] <= seam[3], seam)
        await pg.evaluate("document.getElementById('laneDrone').click()"); await pg.wait_for_timeout(1800)
        check('Drone aus: Schleife gestoppt, Status aus', not (await pg.evaluate("DroneLoop.state()"))['on'] and not await pg.evaluate("droneOn") and 'Aus' in await pg.inner_text('#droneStatus'))
        await pg.click('#langBtn'); await pg.wait_for_timeout(400); await pg.click('#loopSigBtn'); await pg.wait_for_timeout(1500)
        t = await pg.text_content('#sigDlg')
        check('EN: „Load“, „estimated“', 'Load' in t and 'estimated' in t and 'Leistung' not in t and 'geschätzt' not in t, t[:160].replace('\n', ' | '))
        await pg.click('#sigClose'); await pg.click('#langBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate("Rhythm.setOn(false)")
        check('keine Skriptfehler (Ansicht, Drone, Drums)', not errs, errs[:3])
        await b.close()

        # ---------- 2) Klangvergleich gegen v118 ----------
        r = await capture(p, 'drums')
        g, dr, dv = cmp_bands(REF['drums'], r, 2.5, 0.4)
        check('Drums (Worklet + Hall-Puffer): Pegel und Spektrum wie v118', g and abs(dr) <= 0.5 and r['eng']['worklet'] and r['eng']['wk']['synth']['tails'] and not r['errs'], (dr, dv, r['eng']))
        r = await capture(p, 'drums', 'window.__drumNodes=1')
        g, dr, dv = cmp_bands(REF['drums'], r, 2.5, 0.4)
        check('Drums ohne Worklet (Knoten-Weg mit Hall-Puffern): wie v118', g and abs(dr) <= 0.5 and not r['eng']['worklet'] and not r['errs'], (dr, dv))
        # Drone: gleicher Zufall für live und Schleife → gleiche Zeitachse; live (vor dem Master abgegriffen) gegen Schleifen-Puffer
        for st in ('v1', 'v3', 'v9'):
            r = await drone_same(p, st)
            check(f'Drone {st}: Schleife klingt wie live (Pegel, Terzbänder, gleiche Zeitachse)', r['good'] and abs(r['dr']) <= 1.0, r['info'])
        # ---------- 3) Rechenlast A/B gegen v118 (gleiche Messung, abwechselnd) ----------
        for what, lim in (('drums', 0.6), ('drone', 0.5)):
            A = []; B = []
            for _ in range(2):
                a, e1 = await load_run(p, UOLD, what); n, e2 = await load_run(p, U, what); A.append(a); B.append(n)
            ma, mb = statistics.median(A), statistics.median(B)
            check(f'{what}: Audio-Last neu deutlich niedriger als v118 (≤ {int(lim * 100)} %)', mb <= lim * ma, f'{ma:.1f} → {mb:.1f} ms/s')
    print(f'{ok}/{tot}')
asyncio.run(main())
