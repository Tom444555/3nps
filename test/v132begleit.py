# v132: Begleit-Tracks aus der App (Bass Grundton/Terz/Slash, Fläche, Arpeggio mit Delay, Drums) – startbar aus den Kapiteln
import asyncio, os, re
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '/tmp/v132begleit')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--autoplay-policy=no-user-gesture-required']
G = """(x,f,sr)=>{let s1=0,s2=0;const w=2*Math.cos(2*Math.PI*f/sr);for(let i=0;i<x.length;i++){const s0=x[i]+w*s1-s2;s2=s1;s1=s0;}return Math.sqrt(s1*s1+s2*s2-w*s1*s2)/x.length}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1300)
        check('Version ab v132', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 132)
        await pg.evaluate("window.__G=" + G + ";0")
        C = "[{s:1,f:3,midi:48},{s:2,f:2,midi:52},{s:3,f:0,midi:55},{s:4,f:1,midi:60},{s:5,f:0,midi:64}]"
        r = await pg.evaluate("""(()=>{const sr=audioCtx?audioCtx.sampleRate:48000,R=(o,ch)=>Powerchords.renderBacking(ch||[{tones:%s,rootPc:0}],80,o);
          const root=R({style:'none',drums:'none',bass:'root'}),third=R({style:'none',drums:'none',bass:'third'}),slash=R({style:'none',drums:'none',bass:'root'},[{tones:%s,rootPc:0,bassPc:6}]);
          const f=m=>440*Math.pow(2,(m-69)/12);
          return {root:[__G(root,f(36),sr),__G(root,f(28),sr)],third:[__G(third,f(28),sr),__G(third,f(36),sr)],slash:[__G(slash,f(30),sr),__G(slash,f(36),sr)]}})()""" % (C, C))
        check('Bass Grundton (C), Terz (E) und Slash-Bass (F#) liegen auf dem richtigen Ton', r['root'][0] > 5 * r['root'][1] and r['third'][0] > 5 * r['third'][1] and r['slash'][0] > 5 * r['slash'][1], r)
        a = await pg.evaluate("""(()=>{const sr=audioCtx?audioCtx.sampleRate:48000,ch=[{tones:%s,rootPc:0}];const t0=performance.now();const wet=Powerchords.renderBacking(ch.concat(ch,ch,ch),80,{style:'arp',drums:'none'});const dt=performance.now()-t0;
          const dry=Powerchords.renderBacking(ch,80,{style:'arp',drums:'none',delay:false}),sil=Powerchords.renderBacking(ch,80,{style:'none',drums:'none'});
          const bf=dry.length,win=Math.round(bf/64),env=[];for(let i=0;i<64;i++){let e=0;for(let j=i*win;j<(i+1)*win;j++)e+=dry[j]*dry[j];env.push(e)}
          let on=0;for(let i=1;i<64;i++)if(env[i]>env[i-1]*1.3&&env[i]>Math.max(...env)*0.05)on++;
          const en=x=>x.reduce((s,v)=>s+v*v,0);const w1=wet.subarray(0,bf);
          const gap=(x)=>{let e=0;const q=Math.round(bf/16);for(let j=Math.round(bf*0.75/8*1.5);j<Math.round(bf*0.75/8*1.5)+q;j++)e+=x[j]*x[j];return e};
          const late=x=>{let a=0,t=0;const sl=bf/8;for(let k=0;k<8;k++){const s0=Math.round(k*sl);for(let j=0;j<Math.floor(sl)-1;j++){const v=x[s0+j]*x[s0+j];t+=v;if(j>sl*0.6)a+=v;}}return a/t};
          return {dt,on,silent:sil.every(v=>v===0),wetE:late(w1),dryE:late(dry),len:wet.length}})()""" % C)
        check('Arpeggio: einzelne Töne in Achteln (≈ 8 Einsätze je Takt)', 6 <= a['on'] <= 10, a['on'])
        check('Delay füllt nach (mehr Nachklang zwischen den Tönen als ohne Delay)', a['wetE'] > a['dryE'] * 1.1, (a['wetE'], a['dryE']))
        check('Ohne Stil, Bass und Drums: Stille', a['silent'])
        check('Rechnen schnell (4 Takte < 1,5 s) – Looper unberührt, alles vorab berechnet', a['dt'] < 1500, round(a['dt']))
        await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelectorAll('#pcSecKurs details.pc-kc').forEach(d=>d.open=true)"); await pg.wait_for_timeout(1500)
        bts = await pg.evaluate("[...document.querySelectorAll('#pcSecKurs [data-k=bt]')].map(b=>b.dataset.kt)")
        check('Begleit-Tracks in den Kapiteln (≥ 11, u. a. Kap. 5, 8, 9, 10, 11, 12, 13, 14, 15)', len(bts) >= 11 and {int(x.split('.')[0]) + 1 for x in bts} >= {5, 8, 9, 10, 11, 12, 13, 14, 15}, bts)
        okn = 0; names = []
        for k in bts:
            await pg.evaluate("document.querySelector('#pcSecKurs [data-kt=\"%s\"]').click()" % k); await pg.wait_for_timeout(300)
            pl = await pg.evaluate("Powerchords.playing()"); okn += bool(pl and pl['mode'] == 'looper' and len(pl['names']) >= 2); names.append(pl and pl['names'])
        await pg.evaluate("Powerchords.stop()")
        check('Jeder Begleit-Track startet im Looper (Spur 1)', okn == len(bts), names)
        check('Alle Begleit-Akkorde nachgerechnet', not (await pg.evaluate("PcKurs.check()"))['bad'])
        await pg.evaluate("document.querySelector('#pcK_k14-3 .pc-kbts').scrollIntoView()"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT + '_kap14.png')
        for vw, vh, nm in [(820, 1180, 'hoch'), (390, 844, '390')]:
            await pg.set_viewport_size({'width': vw, 'height': vh}); await pg.wait_for_timeout(300)
            o = await pg.evaluate("(()=>{const R=document.getElementById('pcSecKurs').getBoundingClientRect().right;return [...document.querySelectorAll('#pcSecKurs .pc-kbts *')].filter(e=>e.getBoundingClientRect().right>R+1).length})()")
            jt = await pg.evaluate("[...document.querySelectorAll('#pcSecKurs .pc-kbts button')].filter(b=>{const r=b.getBoundingClientRect();return r.width&&(r.height<43.5||r.width<43.5)}).length")
            check('%s: Begleit-Tracks ohne Überlauf, Touch ≥ 44 px' % nm, o == 0 and jt == 0, (o, jt))
        check('Keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        c2 = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await c2.new_page(); e2 = []
        pg.on('pageerror', lambda e: e2.append(str(e)))
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(1200); await pg.click('#tab-power'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.getElementById('pcKC14').open=true"); await pg.wait_for_timeout(500)
        t = await pg.evaluate("[document.querySelector('#pcKC14 .pc-kbts h5').textContent, document.querySelector('#pcKC14 [data-k=bt]').textContent]")
        check('EN: Begleit-Tracks englisch', t[0] == 'Backing tracks' and 'Backing track' in t[1], t)
        check('EN ohne Skriptfehler', not e2, e2[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
