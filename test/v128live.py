# v128: „Was spiele ich?“ – synthetische Gitarrenakkorde (Obertöne, Inharmonie, auch verzerrt) für alle 18 Akkordarten,
# alle Grundtöne, Grundstellung und Umkehrung; Live-Weg über Fake-Eingang; Übung „Spiel den Akkord“; Abbau.
import asyncio, os, re
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '/tmp/v128live')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream']
FAKE = """(()=>{const ctx=new AudioContext();window.__fk={ctx,streams:[],src:null};
navigator.mediaDevices.getUserMedia=async()=>{const d=ctx.createMediaStreamDestination();window.__fk.dest=d;window.__fk.streams.push(d.stream);if(window.__fk.src)window.__fk.src.connect(d);return d.stream;};
navigator.mediaDevices.enumerateDevices=async()=>[{kind:'audioinput',deviceId:'fake',label:'Fake',groupId:'g'}];
window.__fkPlay=(arr,sr)=>{const f=window.__fk;try{f.src&&f.src.stop()}catch(e){}const b=f.ctx.createBuffer(1,arr.length,sr);b.copyToChannel(arr,0);const s=f.ctx.createBufferSource();s.buffer=b;s.loop=true;s.loopStart=0.3;s.loopEnd=arr.length/sr;if(f.dest)s.connect(f.dest);s.start();f.src=s;};})();"""
SYN = """window.__syn=(ms,sr,len,dist)=>{const x=new Float32Array(len);let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 ms.forEach((m,si)=>{const f=440*Math.pow(2,(m-69)/12)*Math.pow(2,(rnd()-.5)*6/1200),B=0.00008,t0=Math.floor(si*0.012*sr);
  for(let h=1;h<=12;h++){const fh=h*f*Math.sqrt(1+B*h*h);if(fh>sr/2-200)break;const a=(1/h)*Math.exp(-h*0.06),ph=rnd()*6.283,dk=0.6+0.35*h,w=2*Math.PI*fh/sr;
   for(let i=t0;i<len;i++){const t=(i-t0)/sr;x[i]+=a*Math.exp(-t*dk)*Math.min(1,t*400)*Math.sin(ph+w*(i-t0));}}});
 let mx=0;for(let i=0;i<len;i++)mx=Math.max(mx,Math.abs(x[i]));for(let i=0;i<len;i++){let v=x[i]/mx;if(dist)v=Math.tanh(3*v)/Math.tanh(3);x[i]=v*0.3;}return x;};
window.__voice=(t,R,inv)=>{const ivs=t.req.concat(t.opt||[]).map(n=>n%12).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
 let ms=ivs.map(n=>R+((t.nine||[]).includes(n)?n+12:n));ms.push(R+12);if(t.k!=='5'&&ivs.length<4)ms.push(R+ivs[1]+12);
 if(inv){const lo=Math.min(...ms.filter(m=>m%12!==R%12));ms=ms.map(m=>m%12===R%12&&m<lo?m+12:m);}ms.sort((a,b)=>a-b);return {ms,bass:ms[0]%12,set:ivs.map(n=>(R+n)%12).sort((a,b)=>a-b)};};0"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); await ctx.add_init_script(FAKE); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1400)
        check('Version ab v128', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 128)
        await pg.evaluate(SYN)
        # --- Erkennung allein: 18 Arten × 12 Grundtöne × Grundstellung/Umkehrung × sauber/verzerrt ---
        r = await pg.evaluate("""(()=>{const sr=48000,N=16384,o={n:0,set:0,name:0,bad:[],per:{}};
          PcWerk.TY.forEach(t=>{for(let r=0;r<12;r++)for(const inv of [0,1])for(const dist of [0,1]){if(inv&&t.k==='5')continue;const R=40+((r-4+12)%12),v=__voice(t,R,inv),x=__syn(v.ms,sr,Math.round(sr*0.8),dist).subarray(Math.round(sr*0.3),Math.round(sr*0.3)+N);
            const d=PcLive.detect(x,sr);o.n++;const pt=o.per[t.k]=o.per[t.k]||[0,0];pt[1]++;
            if(d.t){const ds=d.t.req.concat(d.t.opt||[]).map(n=>(d.r+n)%12).filter((q,i,a)=>a.indexOf(q)===i).sort((a,b)=>a-b),hit=ds.join()===v.set.join()&&d.bass===v.bass;
              if(hit){o.set++;pt[0]++;}if(d.t.k===t.k&&d.r===r%12)o.name++;if(!hit&&o.bad.length<6)o.bad.push(t.k+' r'+r+(inv?' inv':'')+(dist?' dist':'')+' → '+PcLive.chordName(d.t,d.r,d.bass));}}});return o;})()""")
        rate = r['set'] / r['n']
        print('  Trefferquote (Töne + Bass): %d/%d = %.1f %% · gleicher Name: %d · je Art: %s' % (r['set'], r['n'], 100 * rate, r['name'], {k: '%d/%d' % tuple(v) for k, v in r['per'].items()}))
        check('Erkennung synthetischer Akkorde ≥ 90 %% (%.1f %%)' % (100 * rate), rate >= 0.9, r['bad'])
        check('Jede der 18 Arten mindestens zu 75 % erkannt', all(v[0] / v[1] >= 0.75 for v in r['per'].values()), {k: v for k, v in r['per'].items() if v[0] / v[1] < 0.75})
        # --- Live über Fake-Eingang (Werkstatt-Karte) ---
        await pg.click('#tab-power'); await pg.wait_for_timeout(300); await pg.click('#pcSubs [data-sec=kurs]'); await pg.wait_for_timeout(300)
        check('Vor „Zuhören“: kein Eingang, kein Analyser', await pg.evaluate("(()=>{const d=PcLive.debug();return !d.listening&&!d.an&&window.__fk.streams.length===0})()"))
        await pg.evaluate("document.getElementById('pcKC3').open=true"); await pg.wait_for_timeout(400)
        await pg.evaluate("__fkPlay(__syn(__voice(PcWerk.TY.find(t=>t.k==='m7'),45,0).ms,48000,48000*3,0),48000)")
        await pg.click('#pcKC3 .pc-wlive [data-l=listen]'); await pg.wait_for_timeout(2200)
        d = await pg.evaluate("PcLive.debug()"); nm = await pg.inner_text('#pcKC3 .pc-lname')
        check('Live: Am7 über den Eingang erkannt, Formel und Töne', d['listening'] and nm == 'Am7' and '1 · b3 · (5) · b7' in await pg.inner_text('#pcKC3 .pc-lform') and await pg.evaluate("document.querySelectorAll('#pcKC3 .pc-ltone').length") == 4, (d, nm))
        check('Pegelanzeige „hört zu“', await pg.evaluate("document.querySelectorAll('#pcKC3 .pc-lvl i.on').length") >= 2 and 'hört zu' in await pg.inner_text('#pcKC3 .pc-lst'))
        await pg.evaluate("document.querySelector('#pcKC3 .pc-wlive').scrollIntoView()"); await pg.screenshot(path=SHOT + '_karte.png')
        hits = 0; tried = []
        for i, k in enumerate(['5', 'dur', 'moll', 'sus2', 'sus4', 'add9', 'madd9', 'add11', 'madd11', '7', 'maj7', 'm7', 'mmaj7', 'm7b5', 'dim', 'dim7', 'maj79', 'm711']):
            R = 40 + (i * 5) % 12; inv = i % 3 == 2 and k != '5'
            v = await pg.evaluate("(()=>{const v=__voice(PcWerk.TY.find(t=>t.k==='%s'),%d,%d);__fkPlay(__syn(v.ms,48000,48000*3,%d),48000);return v})()" % (k, R, 1 if inv else 0, i % 2))
            await pg.wait_for_timeout(1500)
            s = await pg.evaluate("PcLive.debug().shown")
            ds = await pg.evaluate("(()=>{const s=PcLive.debug().shown;if(!s)return null;const t=PcWerk.TY.find(x=>x.k===s.k);return t.req.concat(t.opt||[]).map(n=>(s.r+n)%12).filter((q,i,a)=>a.indexOf(q)===i).sort((a,b)=>a-b)})()")
            h = s and ds == v['set'] and s['bass'] == v['bass']; hits += bool(h); tried.append((k, s and s['name'], 'ok' if h else 'x'))
        print('  Live-Trefferquote: %d/18 · %s' % (hits, tried))
        check('Live über Fake-Eingang: ≥ 15 von 18 Arten (auch Umkehrung/verzerrt)', hits >= 15, [t for t in tried if t[2] == 'x'])
        check('Umkehrung als Slash-Akkord angezeigt', any('/' in (t[1] or '') for t in tried))
        # --- Übung „Spiel den Akkord“ ---
        async def game(k, play):
            await pg.evaluate("PcLive._game('%s',0)" % k)
            await pg.evaluate("__fkPlay(__syn(__voice(PcWerk.TY.find(t=>t.k==='%s'),48,0).ms,48000,48000*3,0),48000)" % play); await pg.wait_for_timeout(1500)
            return await pg.inner_text('#pcKC3 .pc-lfb')
        f1 = await game('maj7', '7'); f2 = await game('dur', '5'); f3 = await game('maj7', 'maj7')
        check('Spiel den Akkord: „b7 statt 7“, „Terz fehlt“, ✓', 'b7 statt 7' in f1 and 'Terz fehlt' in f2 and f3.startswith('✓ Richtig! Cmaj7'), (f1, f2, f3))
        await pg.click('#pcKC3 .pc-wlive [data-l=game]'); await pg.wait_for_timeout(200)
        gt = await pg.inner_text('#pcKC3 .pc-lgame'); check('Knopf „Spiel den Akkord“ nennt einen Akkord', 'Spiel:' in gt, gt)
        # --- Abbau ---
        await pg.click('#pcKC3 .pc-wlive [data-l=listen]'); await pg.wait_for_timeout(300)
        d = await pg.evaluate("[PcLive.debug(),window.__fk.streams.map(s=>s.getTracks().map(t=>t.readyState).join()).join('|')]")
        check('Stopp: Analyser, Timer und selbst geöffneter Eingang abgebaut', not d[0]['listening'] and not d[0]['an'] and not d[0]['ex'] and not d[0]['opened'] and 'live' not in d[1], d)
        await pg.click('#pcKC3 .pc-wlive [data-l=listen]'); await pg.wait_for_timeout(600)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(400)
        check('Reiterwechsel baut ab', not (await pg.evaluate("PcLive.debug()"))['listening'])
        await pg.click('#tab-power'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.getElementById('pcKC7').open=true;document.getElementById('pcKC6').open=true"); await pg.wait_for_timeout(400)
        await pg.click('#pcKC7 [data-klive]'); await pg.wait_for_timeout(1500)
        dd = await pg.evaluate("[PcLive.debug(), document.querySelector('#pcKC7 .pc-klivebox').hidden, !!document.querySelector('#pcKC7 .pc-klivebox .pc-live')]")
        check('Kurs Kapitel 7: eigener Knopf „Was spiele ich?“ hört zu', dd[0]['listening'] and await pg.evaluate("!!document.querySelector('#pcKC6 [data-klive]')"), dd)
        await pg.evaluate("document.getElementById('pcKC7').open=false"); await pg.wait_for_timeout(500)
        dd = await pg.evaluate("[PcLive.debug().listening, document.getElementById('pcKC7').open, !!document.querySelector('#pcKC7 .pc-live').offsetParent]")
        check('Kapitel zugeklappt → abgebaut', not dd[0], dd)
        await pg.click('#pcKC3 [data-w=multi]'); await pg.click('#pcKC3 [data-w=live]'); await pg.wait_for_timeout(800)
        check('Akkord-Baukasten: Knopf „Was spiele ich?“ startet', (await pg.evaluate("PcLive.debug()"))['listening'])
        await pg.evaluate("PcLive.stop()")
        for vw, vh, nm in [(820, 1180, 'hoch'), (390, 844, '390')]:
            await pg.set_viewport_size({'width': vw, 'height': vh}); await pg.wait_for_timeout(300)
            o = await pg.evaluate("(()=>{const c=document.querySelector('#pcKC3 .pc-wlive'),R=document.getElementById('pcSecKurs').getBoundingClientRect().right;return [...c.querySelectorAll('*')].filter(e=>!e.closest('svg')&&e.getBoundingClientRect().right>R+1).length})()")
            check('%s: Karte läuft nicht über' % nm, o == 0)
            await pg.evaluate("document.querySelector('#pcKC3 .pc-wlive').scrollIntoView()"); await pg.screenshot(path=SHOT + '_' + nm + '.png')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
