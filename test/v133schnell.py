# v133: „Akkordsymbole lesen“ mit Griff-Fenster (klebt oben, Zahl/Name/Ton, Slash-Bass markiert, nichts springt) und
# schnelleres „Was spiele ich?“: Anschlag → vorläufig (blass) → bestätigt. Latenz und Genauigkeit vorher/nachher:
# 1) Ablauf-Simulation über dasselbe Signal (vorher = alter Ablauf: alle 120 ms 16384er-Fenster, 4 × gleich),
# 2) live über Fake-Eingang gegen die alte index.html (aus Git, per Route ausgeliefert).
import asyncio, os, re, subprocess, statistics
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/index.html')
OLD = os.environ.get('OLD', 'c7f9f43')          # v132
SHOT = os.environ.get('SHOT', '/tmp/v133schnell')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'v128live.py')).read()
def block(name):
    i = src.index(name + ' = """') + len(name) + 6; return src[i:src.index('"""', i)]
FAKE, SYN = block('FAKE'), block('SYN')
ARGS = ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream']
BENCH = r"""
window.__case=(t,r,inv,dist,pt,pr,sr)=>{const T0=1.0,len=Math.round(sr*2.0),o=Math.round(T0*sr);
 const v=__voice(t,40+((r-4+12)%12),inv),pv=__voice(pt,40+((pr-4+12)%12),0),a=__syn(pv.ms,sr,len,dist),n=__syn(v.ms,sr,len-o,dist),x=new Float32Array(len);
 for(let i=0;i<len;i++){x[i]=a[i]*(i<o?1:Math.exp(-(i-o)/sr/0.03));if(i>=o)x[i]+=n[i-o];}return {x,v,T0};};
window.__legacy=(x,sr,ph)=>{const N=16384,h=Math.round(0.12*sr),out=[];let hist=[],shown='';const b=new Float32Array(N);
 for(let p=Math.round(ph*sr)+h;p<=x.length;p+=h){const a=Math.max(0,p-N);b.fill(0);b.set(x.subarray(a,p),N-(p-a));const r=PcLive.detect(b,sr);
  const key=r.quiet||!r.t?'':r.r+':'+r.t.k+':'+r.bass;hist.push(key);if(hist.length>4)hist.shift();
  if(key&&hist.length===4&&hist.every(k=>k===key)&&key!==shown){shown=key;out.push({t:p/sr,k:r.t.k,r:r.r,bass:r.bass,pre:false});}}return out;};
window.__bench=(step)=>{const sr=48000,TY=PcWerk.TY,res={new:{n:0,first:0,fin:0,lat:[],ms:0,steps:0,pre:0,preOk:0,conf:0,latc:[]},old:{n:0,first:0,fin:0,lat:[],conf:0,latc:[]}};
 const setOf=e=>{const t=TY.find(x=>x.k===e.k);return t.req.concat(t.opt||[]).map(n=>(e.r+n)%12).filter((q,i,a)=>a.indexOf(q)===i).sort((a,b)=>a-b).join()};
 let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 TY.forEach(t=>{for(let r=0;r<12;r+=step)for(const inv of [0,1])for(const dist of [0,1]){if(inv&&t.k==='5')continue;
  const pt=TY[Math.floor(rnd()*TY.length)],pr=Math.floor(rnd()*12);if(pt===t&&pr===r)continue;
  const c=__case(t,r,inv,dist,pt,pr,sr),want=c.v.set.join(),good=e=>!!e&&setOf(e)===want&&e.bass===c.v.bass,ph=rnd()*0.12;
  const t0=performance.now(),evN=PcLive.simulate(c.x,sr,0.02,ph/6);res.new.ms+=performance.now()-t0;res.new.steps+=100;
  for(const [nm,ev] of [['new',evN],['old',__legacy(c.x,sr,ph)]]){const R=res[nm];R.n++;
   const af=ev.filter(e=>e.t>c.T0),f=af[0];if(f){R.lat.push(f.t-c.T0);if(good(f))R.first++;if(f.pre){R.pre=(R.pre||0)+1;if(good(f))R.preOk=(R.preOk||0)+1;}}
   const fc=af.find(e=>!e.pre);if(fc){R.latc.push(fc.t-c.T0);if(good(fc))R.conf++;}
   if(good(af.filter(e=>e.t<=c.T0+0.9).pop()))R.fin++;}}});
 const q=(a,p)=>{a=a.slice().sort((x,y)=>x-y);return a.length?Math.round(1000*a[Math.min(a.length-1,Math.floor(a.length*p))]):null};
 for(const k of ['new','old']){const R=res[k];R.med=q(R.lat,0.5);R.p90=q(R.lat,0.9);R.medc=q(R.latc,0.5);R.shown=R.lat.length;delete R.lat;delete R.latc;}return res;};0"""
LIVE = r"""(async(seq)=>{const out=[];const name=()=>{const d=PcLive.debug();return d.shown?d.shown.name+(d.shown.pre?'~':''):''};
 for(const [k,R] of seq){const before=name(),v=__voice(PcWerk.TY.find(t=>t.k===k),R,0),x=__syn(v.ms,48000,48000*2,0),t0=performance.now();__fkPlay(x,48000);
  let t1=null,nm='';while(performance.now()-t0<1500){await new Promise(r=>requestAnimationFrame(r));const n=name();if(n&&n!==before&&t1==null){t1=performance.now();nm=n;}}
  out.push([k,t1==null?null:Math.round(t1-t0),nm,name()]);}return out;})"""
SEQ = "[['moll',45],['7',43],['maj7',48],['dur',40],['m7',50],['sus4',45],['dur',43],['moll',52],['7',45],['maj7',41]]"
async def live(pg):
    await pg.click('#tab-power'); await pg.wait_for_timeout(300); await pg.click('#pcSubs [data-sec=kurs]'); await pg.wait_for_timeout(300)
    await pg.evaluate("document.getElementById('pcKC3').open=true"); await pg.wait_for_timeout(400)
    await pg.evaluate("__fkPlay(__syn(__voice(PcWerk.TY.find(t=>t.k==='5'),40,0).ms,48000,48000*2,0),48000)")
    await pg.click('#pcKC3 .pc-wlive [data-l=listen]'); await pg.wait_for_timeout(1500)
    return await pg.evaluate(LIVE + "(" + SEQ + ")")
async def main():
    old_html = subprocess.run(['git', 'show', OLD + ':app/www/index.html'], capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__))).stdout
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, service_workers='block'); await ctx.add_init_script(FAKE); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1400)
        check('Version ab v133', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 133)
        await pg.evaluate(SYN)
        # ---------- 1) Griff-Fenster ----------
        await pg.click('#tab-power'); await pg.wait_for_timeout(300); await pg.click('#pcSecKurs [data-ktool=pcKT1]'); await pg.wait_for_timeout(700)
        w = await pg.evaluate("(()=>{const w=document.querySelector('#pcKT1 .pc-symwin'),b=document.querySelector('#pcKT1 .pc-sec-b');return [!!w, b.firstElementChild===w, w.querySelectorAll('.pc-m').length, w.querySelector('.pc-symwn').textContent, getComputedStyle(w).position, !!w.querySelector('.pc-board')]})()")
        check('Fenster oben in „Akkordsymbole lesen“, Palisander-Griffbrett mit Griff (D/F#)', w[0] and w[1] and w[2] >= 4 and w[3] == 'D/F#' and w[4] == 'sticky' and w[5], w)
        bass = await pg.evaluate("(()=>{const m=[...document.querySelectorAll('#pcKT1 .pc-symwin .pc-m')];const b=m.filter(x=>x.classList.contains('bass'));return [b.length, b[0]&&b[0].textContent, (document.querySelector('#pcKT1 .pc-symwt').textContent)]})()")
        check('Slash-Ton im Bass markiert (D/F#: Fis tiefste Saite, gestrichelter Ring, Text „Bass: F#“)', bass[0] == 1 and bass[1] == '3' and 'Bass: F#' in bass[2] and bass[2].split(':')[1].strip().startswith('2'), bass)
        # alle Symbole der Tabelle × 4 Grundtöne: Griff nachrechnen
        bad = await pg.evaluate("""(()=>{const bad=[],O=[40,45,50,55,59,64];const rows=[...document.querySelectorAll('#pcKT1 tbody tr')].map(r=>r.dataset.sym);let n=0;
          for(const s0 of rows)for(const R of ['C','E','G#','Bb']){const s=s0.replace(/^C/,R).replace(/^D\\//,R+'/');const r=PcExtra.parse(s.startsWith(R+'/')?s0:s);if(!r){bad.push(s+' ?');continue;}const v=PcExtra.voicing(r);n++;
            const pcs=new Set(r.iv.map(i=>(r.root+i)%12)),need=[...pcs].filter(pc=>!(r.iv.length>=4&&r.iv.includes(7)&&pc===(r.root+7)%12)),got=v.marks.map(m=>(O[m.s]+m.f)%12),low=v.marks.slice().sort((a,b)=>a.s-b.s)[0];
            const fz=v.marks.filter(m=>m.f>0).map(m=>m.f),span=fz.length?Math.max(...fz)-Math.min(...fz):0;
            if(need.some(pc=>!got.includes(pc))||got.some(pc=>!pcs.has(pc)&&pc!==r.bass)||(O[low.s]+low.f)%12!==(r.bass!=null?r.bass:r.root)||span>3||v.marks.some(m=>m.f<v.from&&m.f>0||m.f>v.to))bad.push(s+' '+v.marks.map(m=>m.s+':'+m.f).join(' '));}
          return [n,bad];})()""")
        check('Griffe nachgerechnet: %d Symbole (Tabelle × 4 Grundtöne): alle Akkordtöne (Quinte bei 4+ Tönen frei), Bass unten, Spanne ≤ 4 Bünde' % bad[0], not bad[1], bad[1][:5])
        # live beim Tippen, ohne Springen
        geo = "(()=>{const w=document.querySelector('#pcKT1 .pc-symwin').getBoundingClientRect(),t=document.querySelector('#pcKT1 .pc-symtab').getBoundingClientRect();return [Math.round(w.height),Math.round(t.top-w.top)]})()"
        g0 = await pg.evaluate(geo)
        await pg.fill('#pcSymIn', ''); await pg.type('#pcSymIn', 'Am7', delay=30); await pg.wait_for_timeout(150)
        n1 = await pg.inner_text('#pcKT1 .pc-symwn'); g1 = await pg.evaluate(geo)
        await pg.type('#pcSymIn', 'b5x', delay=30); await pg.wait_for_timeout(150); n2 = await pg.inner_text('#pcKT1 .pc-symwn'); g2 = await pg.evaluate(geo)
        check('Fenster folgt dem Eintippen live (Am7), Unbekanntes behält den letzten Griff', n1 == 'Am7' and n2 == 'Am7b5', (n1, n2))
        labs = {}
        for m in ['num', 'name', 'ton']:
            await pg.fill('#pcSymIn', 'D/F#'); await pg.dispatch_event('#pcSymIn', 'input'); await pg.click('#pcKT1 [data-wl=%s]' % m); await pg.wait_for_timeout(120)
            labs[m] = await pg.evaluate("[...document.querySelectorAll('#pcKT1 .pc-symwin .pc-m text')].map(t=>t.textContent).join(',')"); labs[m + 'g'] = await pg.evaluate(geo)
        check('Zahl / Name / Ton schalten die Beschriftung', '1' in labs['num'].split(',') and 'Grundton' in labs['name'] and 'F#' in labs['ton'].split(',') and 'D' in labs['ton'].split(','), labs)
        gs = [g0, g1, g2, labs['numg'], labs['nameg'], labs['tong']]
        check('Nichts springt: Fensterhöhe und Abstand zur Tabelle bleiben gleich', len(set(tuple(x) for x in gs)) == 1, gs)
        await pg.click('#pcKT1 [data-wl=num]')
        await pg.evaluate("document.querySelector('#pcKT1 tbody tr:nth-child(25)').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
        await pg.click('#pcKT1 tbody tr:nth-child(25)'); await pg.wait_for_timeout(200)
        st = await pg.evaluate("(()=>{const w=document.querySelector('#pcKT1 .pc-symwin').getBoundingClientRect(),c=document.querySelector('.control-bar').getBoundingClientRect(),r=document.querySelector('#pcKT1 tbody tr:nth-child(25)');return [Math.round(w.top),Math.round(c.bottom),Math.round(w.height),document.querySelector('#pcKT1 .pc-symwn').textContent,r.dataset.sym]})()")
        check('Beim Scrollen bleibt das Fenster kompakt oben sichtbar (unter der Kopfleiste) und zeigt die angetippte Zeile', abs(st[0] - st[1]) <= 2 and st[2] <= 190 and st[3] == st[4], st)
        await pg.screenshot(path=SHOT + '_fenster.png')
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(300)
        o = await pg.evaluate("(()=>{const w=document.querySelector('#pcKT1 .pc-symwin'),R=document.getElementById('pcSecKurs').getBoundingClientRect().right,c=document.querySelector('.control-bar').getBoundingClientRect();w.scrollIntoView();return [[...w.querySelectorAll('*')].filter(e=>!e.closest('svg')&&e.getBoundingClientRect().right>R+1).length, Math.round(w.getBoundingClientRect().height), document.documentElement.scrollWidth<=window.innerWidth]})()")
        await pg.evaluate("document.querySelector('#pcKT1 tbody tr:nth-child(10)').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
        o2 = await pg.evaluate("(()=>{const w=document.querySelector('#pcKT1 .pc-symwin').getBoundingClientRect(),c=document.querySelector('.control-bar').getBoundingClientRect();return [Math.round(w.top),Math.round(c.bottom)]})()")
        check('390 px: nichts läuft über, Fenster ≤ 160 px und klebt unter der Kopfleiste', o[0] == 0 and o[1] <= 160 and o[2] and abs(o2[0] - o2[1]) <= 2, (o, o2))
        await pg.screenshot(path=SHOT + '_390.png')
        await pg.set_viewport_size({'width': 1366, 'height': 1024}); await pg.wait_for_timeout(300)
        # ---------- 2) Erkennung: Simulation vorher/nachher ----------
        await pg.evaluate(BENCH)
        r = await pg.evaluate("__bench(2)")
        N, O = r['new'], r['old']
        print('  Simulation (%d Akkordwechsel, 26 Arten, 6 Grundtöne, Grundstellung/Umkehrung, sauber/verzerrt):' % N['n'])
        print('    vorher:  erste Anzeige Median %s ms (90 %%: %s ms), richtig %d/%d = %.1f %%; nach 0,9 s richtig %.1f %%' % (O['med'], O['p90'], O['first'], O['n'], 100 * O['first'] / O['n'], 100 * O['fin'] / O['n']))
        print('    nachher: erste Anzeige Median %s ms (90 %%: %s ms), richtig %.1f %% (vorläufig %d, davon richtig %.1f %%);' % (N['med'], N['p90'], 100 * N['first'] / N['n'], N['pre'], 100 * N['preOk'] / max(1, N['pre'])))
        print('             erste bestätigte Anzeige Median %s ms, richtig %d/%d = %.1f %%; nach 0,9 s richtig %.1f %%' % (N['medc'], N['conf'], N['n'], 100 * N['conf'] / N['n'], 100 * N['fin'] / N['n']))
        print('    Rechenzeit je 20-ms-Schritt im Mittel: %.2f ms' % (N['ms'] / N['steps']))
        check('Simulation: erste Anzeige nach dem Anschlag im Median < 150 ms (vorher %s ms)' % O['med'], N['med'] < 150, N['med'])
        check('Simulation: bestätigte Anzeige mindestens so oft richtig wie die alte Anzeige und deutlich früher', N['conf'] >= O['first'] and N['medc'] < O['med'] / 2, (N['conf'], O['first'], N['medc']))
        check('Simulation: vorläufige Anzeige zu ≥ 90 % richtig', N['preOk'] >= 0.9 * N['pre'], (N['preOk'], N['pre']))
        check('Simulation: Endergebnis mindestens so genau wie vorher', N['fin'] >= O['fin'], (N['fin'], O['fin']))
        check('Rechenzeit je Schritt im Mittel < 2 ms (Looper-Leistung)', N['ms'] / N['steps'] < 2, round(N['ms'] / N['steps'], 2))
        # ---------- 3) Live über Fake-Eingang: nachher ----------
        ln = await live(pg)
        lat = [x[1] for x in ln if x[1] is not None]
        names = await pg.evaluate("(s=>s.map(([k,R])=>PcWerk.cname(PcWerk.TY.find(t=>t.k===k),PcWerk.rootName(R%12))))(" + SEQ + ")")
        hitsN = sum(1 for x, nm in zip(ln, names) if x[3].rstrip('~') == nm)
        print('  Live nachher: %s' % [(x[0], x[1], x[2]) for x in ln])
        log = await pg.evaluate("PcLive.log().map(e=>e.pre)")
        check('Live: vorläufige (blasse) und bestätigte Anzeige kommen vor', True in log and False in log, log[-8:])
        await pg.evaluate("PcLive.stop()")
        check('Stopp baut Timer und Eingang ab', not (await pg.evaluate("PcLive.debug().listening")))
        check('Keine Skriptfehler (neu)', not errs, errs[:3])
        # ---------- 4) Live: vorher (alte index.html aus Git) ----------
        ctx2 = await b.new_context(viewport={'width': 1366, 'height': 1024}, service_workers='block'); await ctx2.add_init_script(FAKE); pg2 = await ctx2.new_page()
        await pg2.route(re.compile(r'.*/index\.html(\?.*)?$'), lambda route: asyncio.ensure_future(route.fulfill(status=200, content_type='text/html; charset=utf-8', body=old_html)))
        await pg2.goto(U); await pg2.wait_for_timeout(1400); await pg2.evaluate(SYN)
        vo = await pg2.inner_text('.brand'); lo = await live(pg2)
        lato = [x[1] for x in lo if x[1] is not None]
        hitsO = sum(1 for x, nm in zip(lo, names) if x[3].rstrip('~') == nm)
        print('  Live vorher (%s): %s' % (vo.strip(), [(x[0], x[1], x[2]) for x in lo]))
        mN = statistics.median(lat) if lat else 9999; mO = statistics.median(lato) if lato else 9999
        print('  Live Anschlag → Anzeige (Median): vorher %s ms (%d/10 richtig nach 1,5 s), nachher %s ms (%d/10 richtig nach 1,5 s)' % (mO, hitsO, mN, hitsN))
        check('Live: Anschlag → Anzeige deutlich schneller (nachher %s ms, vorher %s ms)' % (mN, mO), len(lat) == 10 and mN < 200 and mN < mO / 2, (lat, lato))
        check('Live: mindestens so viele richtig wie vorher (%d/10 gegen %d/10)' % (hitsN, hitsO), hitsN >= hitsO and hitsN >= 9)
        await ctx2.close()
        # ---------- EN ----------
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(1200); await pg.click('#tab-power'); await pg.wait_for_timeout(300)
        await pg.click('#pcSecKurs [data-ktool=pcKT1]'); await pg.wait_for_timeout(500)
        t = await pg.evaluate("[...document.querySelectorAll('#pcKT1 [data-wl]')].map(b=>b.textContent).join('|')")
        check('EN: Zahl/Name/Ton englisch, Wort „provisional“ vorhanden', t == 'Number|Name|Note' and (await pg.evaluate("window.__EN_PCW['vorläufig']")) == 'provisional', t)
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
