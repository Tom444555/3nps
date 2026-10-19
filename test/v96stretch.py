# v96: Verlangsamen mit Signalsmith Stretch (Worker) – Länge, Qualität, Rückfall, Zeile üben 75 %, Editor-Schleife schaltet nahtlos um
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
L = [("Hold on to the night", 4), ("we were young and free", 9), ("the river runs so cold", 20), ("and nobody can see", 25), ("we hold the line", 30)]
TOK = [{"w": w, "b": b0 + k * 0.5, "l": l} for l, (txt, b0) in enumerate(L) for k, w in enumerate(txt.split())]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
SEEK = "(b=>{const s=Sing.source(SoloInfo());Looper.seek(0,Sing.b2f(b,s.beats)-s.origPos)})(%f)"
PROBE = """(()=>{const box=document.getElementById('sbScroll').getBoundingClientRect(),list=document.getElementById('sbList'),cur=list.querySelector('.sb-row.cur');
  return {tr:list.style.transform, l:cur?+cur.dataset.l:-1, top:cur?cur.getBoundingClientRect().top-box.top:null, h:[...list.querySelectorAll('.sb-row')].map(r=>r.offsetHeight), bh:box.height,
  fill:[...list.querySelectorAll('.sb-row.cur .sb-fill')].some(f=>getComputedStyle(f).display!=='none')}})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 820})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        import re as _re; check('Version ≥ v96', int(_re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 96)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        for _ in range(40):
            if await pg.evaluate("!!(window.SoloInfo && Sing.source(SoloInfo()))"): break
            await pg.wait_for_timeout(250)
        # 1) direkt: 8 s Ausschnitt auf 50 % / 75 % / 125 %
        r = await pg.evaluate("""(async()=>{const x=Looper.singAudio(0,48000,48000*9),out=[];
          for(const rate of [0.5,0.75,1.25]){const n=Math.round(x.length/rate),t=performance.now();const y=await Looper.stretchAudioHQ(x,n,false);
            let pk=0,e1=0,e0=0,p0=0;for(let i=0;i<y.length;i++){pk=Math.max(pk,Math.abs(y.l[i]));e1+=y.l[i]*y.l[i];}for(let i=0;i<x.length;i++){e0+=x.l[i]*x.l[i];p0=Math.max(p0,Math.abs(x.l[i]));}
            out.push({rate,len:y.length,n,ms:Math.round(performance.now()-t),ss:window.__ssMs,rms:Math.sqrt(e1/y.length)/Math.sqrt(e0/x.length),pk:pk/p0,stereo:(y.r!==y.l)===(x.r!==x.l)});window.__ssMs=null;}
          return out})()""")
        for o in r:
            check('Dehnung %d %%: richtige Länge, über Signalsmith, Pegel erhalten' % round(o['rate'] * 100),
                  o['len'] == o['n'] and o['ss'] is not None and 0.75 < o['rms'] < 1.3 and o['pk'] < 1.3 and o['stereo'], o)
        # 2) Schleife: Übergang Ende → Anfang ohne Sprung
        j = await pg.evaluate("""(async()=>{const x=Looper.singAudio(0,48000*2,48000*6),n=Math.round(x.length/0.5),y=await Looper.stretchAudioHQ(x,n,true);
          let d=0,dm=0;for(let i=1;i<y.length;i++){dm=Math.max(dm,Math.abs(y.l[i]-y.l[i-1]));} d=Math.abs(y.l[0]-y.l[y.length-1]);return {d,dm}})()""")
        check('Schleife: Naht nicht größer als die üblichen Sprünge im Signal', j['d'] <= j['dm'] * 1.05, j)
        # 3) Rückfall: Worker nicht ladbar → altes Verfahren, gleiche Länge
        f = await pg.evaluate("""(async()=>{const W=window.Worker;window.Worker=function(){throw new Error('x')};
          try{const x=Looper.singAudio(0,0,48000*3);return (await Looper.stretchAudioHQ(x,Math.round(x.length/0.75),false)).length===Math.round(x.length/0.75)}finally{window.Worker=W}})()""")
        check('Rückfall auf altes Verfahren funktioniert (Funktion bleibt erhalten)', f)
        # 4) Mitsingen: Zeile üben mit 75 %
        if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(400); await pg.click('#tab-singen')
        await pg.evaluate(SEEK % 10.0); await pg.wait_for_timeout(400)
        await pg.click('#sbSpeed button[data-s="0.75"]'); await pg.evaluate("window.__ssMs=null")
        await pg.click('#sbLoop')
        for _ in range(40):
            await pg.wait_for_timeout(200)
            if '75 %' in await pg.inner_text('#sbLoopInfo'): break
        info = await pg.inner_text('#sbLoopInfo')
        check('Zeile üben 75 % läuft mit Signalsmith', '75 %' in info and await pg.evaluate("window.__ssMs!=null"), (info, await pg.evaluate("window.__ssMs")))
        await pg.click('#sbLoop'); await pg.wait_for_timeout(300)
        check('Üben beenden', 'Zeile üben' in await pg.inner_text('#sbLoop'))
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
