# v117: Looper Paket B – Amp-Simulation am Eingang (Gate, Verzerrung 4x, Klang, Box, Pegel), Szenen/Song-Modus, Pedal-Aktionen
import asyncio, sys, os, math, struct, wave
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
WAV = '/tmp/v116_sine110.wav'
if not os.path.exists(WAV):
    sr = 48000; w = wave.open(WAV, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(struct.pack('<h', int(12000 * math.sin(2 * math.pi * 110 * i / sr))) for i in range(sr * 4))); w.close()
# Klirrfaktor (Oberton-Energie / Grundton) per Goertzel, im Browser gerechnet
THD = """window.__thd=(x,f,sr)=>{const n=Math.min(x.length,Math.round(sr*0.5)),o=Math.floor((x.length-n)/2);const g=k=>{const w=2*Math.PI*k*f/sr,c=2*Math.cos(w);let a=0,b=0;for(let i=0;i<n;i++){const s=x[o+i]+c*a-b;b=a;a=s;}return Math.sqrt(a*a+b*b-c*a*b)/n;};
const h1=g(1);let h=0;for(let k=2;k<=9;k++)h+=g(k)**2;return {thd:Math.sqrt(h)/(h1+1e-12),h1};};0"""
PATCH = """window.__starts=[];window.__stops=[];{const S=AudioBufferSourceNode.prototype,o=S.start,p=S.stop;S.start=function(w,off){__starts.push([w||0,off||0,this.buffer?this.buffer.length:0]);return o.apply(this,arguments)};
S.stop=function(w){__stops.push(w||0);return p.apply(this,arguments)};};0"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV, '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, bypass_csp=True); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(900)
        await pg.evaluate("localStorage.removeItem('3nps-amp');localStorage.removeItem('3nps-amp-on');localStorage.removeItem('3nps-pedal-acts');localStorage.setItem('3nps-countin','0');0")
        await pg.reload(); await pg.wait_for_timeout(900)
        check('v117', 'v117' in await pg.inner_text('.brand'))
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        await pg.evaluate(THD)
        # ---------- 1. Amp ----------
        check('Knopf „Amp“ beim Eingang (nach „Stimmen“)', await pg.evaluate("document.getElementById('loopTunerBtn').nextElementSibling.id") == 'loopAmpBtn')
        a = await pg.evaluate("Looper._amp()")
        check('Amp aus: keine Kette aufgebaut', not a['on'] and not a['built'], a)
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
        a = await pg.evaluate("Looper._amp()")
        check('Eingang offen, Amp aus: weiterhin keine Kette (bisheriger Signalweg)', not a['built'], a)
        r = await pg.evaluate("""(async()=>{const sr=audioCtx.sampleRate,x=new Float32Array(sr).map((_,i)=>0.35*Math.sin(2*Math.PI*110*i/sr));
          const c=await Looper.ampRender(x,sr,{type:'clean',drive:0,bass:5,mid:5,treble:5,level:0,gate:-80});
          const l=await Looper.ampRender(x,sr,{type:'lead',drive:6,bass:5,mid:7,treble:5.5,level:-3,gate:-80});
          const k=await Looper.ampRender(x,sr,{type:'crunch',drive:7.5,bass:6,mid:5.5,treble:6,level:-2,gate:-80});
          const lo=await Looper.ampRender(x,sr,{type:'lead',drive:6,bass:5,mid:7,treble:5.5,level:-15,gate:-80});
          return {dry:__thd(x,110,sr),clean:__thd(c,110,sr),lead:__thd(l,110,sr),crunch:__thd(k,110,sr),lo:__thd(lo,110,sr)}})()""")
        check('Offline gemessen: Clean fast unverzerrt (Klirr < 5 %)', r['clean']['thd'] < 0.05, r)
        check('Lead stark verzerrt (Klirr > 30 %), Crunch dazwischen (> 10 %)', r['lead']['thd'] > 0.3 and r['crunch']['thd'] > 0.1, (round(r['lead']['thd'], 3), round(r['crunch']['thd'], 3)))
        check('Pegel-Regler wirkt (−12 dB ≈ Faktor 4)', 3.3 < r['lead']['h1'] / r['lo']['h1'] < 4.7, r['lead']['h1'] / r['lo']['h1'])
        await pg.click('#loopAmpSet'); await pg.wait_for_timeout(150)
        check('Regler aufklappbar (Typ, Gate, Drive, Bass, Mitte, Höhen, Pegel, Mithören)', await pg.is_visible('#ampPanel') and await pg.locator('#ampPanel input[type=range]').count() == 6 and await pg.locator('#ampType option').count() == 3)
        await pg.select_option('#ampPreset', 'lead'); await pg.wait_for_timeout(100)
        st = await pg.evaluate("Looper.ampSettings()")
        check('Voreinstellung „Lead“ setzt Typ/Drive + gespeichert', st['type'] == 'lead' and st['drive'] == 6 and '"lead"' in (await pg.evaluate("localStorage.getItem('3nps-amp')") or ''), st)
        await pg.click('#loopAmpBtn'); await pg.wait_for_timeout(400)
        a = await pg.evaluate("Looper._amp()")
        check('Amp an: Kette mit Gate (Worklet) und WaveShaper 4x aufgebaut', a['on'] and a['built'] and a['gate'] and a['os'] == '4x' and a['n'] >= 13, a)
        check('Knopf zeigt „● Amp“, Zustand gespeichert', '● Amp' in await pg.inner_text('#loopAmpBtn') and await pg.evaluate("localStorage.getItem('3nps-amp-on')") == '1')
        # Aufnahme mit Amp → bearbeitetes Signal im Loop
        async def record(i):
            await pg.click('#foot%d' % i); await pg.wait_for_timeout(2600); await pg.click('#foot%d' % i)
            await pg.wait_for_function("Looper.debug().tracks[%d].L>0" % i, timeout=15000); await pg.wait_for_timeout(500)
            return await pg.evaluate("(()=>{const x=Looper._mixOf(%d).l;return __thd(x,110,audioCtx.sampleRate)})()" % i)
        on = await record(0)
        await pg.click('#loopAmpBtn'); await pg.wait_for_timeout(300)
        a = await pg.evaluate("Looper._amp()")
        check('Amp aus: Kette abgebaut', not a['on'] and not a['built'], a)
        off = await record(1)
        check('Aufnahme mit Amp verzerrt, ohne Amp sauber (Fake-Sinus 110 Hz)', on['thd'] > 0.25 and off['thd'] < 0.05, (round(on['thd'], 3), round(off['thd'], 3)))
        await pg.evaluate("Looper.all()"); await pg.wait_for_timeout(200)
        # ---------- 2. Szenen ----------
        await pg.evaluate("""(sr=>{const a=new Float32Array(sr*2).map((_,i)=>Math.sin(i/20)*0.3);Looper._setTrackRaw(0,a);let se=Looper.getSession();se.baseL=se.tracks[0].L;se.tracks[1]=null;se.tracks[2]=null;Looper.loadSession(se);
          Looper._setTrackRaw(1,new Float32Array(sr*2).fill(0.05));se=Looper.getSession();Looper.loadSession(se);})(%d)""" % sr)
        await pg.wait_for_timeout(400)
        L = await pg.evaluate("Looper.debug().tracks[0].L")
        check('Szenen-Leiste sichtbar, noch leer', await pg.is_visible('#sceneRow') and await pg.locator('#sceneList button').count() == 0)
        await pg.click('#sceneAdd'); await pg.wait_for_timeout(100)
        await pg.click('#stop1'); await pg.evaluate("(()=>{const v=document.getElementById('vol0');v.value=50;v.dispatchEvent(new Event('input'))})()")
        await pg.click('#sceneAdd'); await pg.wait_for_timeout(100)
        sc = await pg.evaluate("Looper.scenes()")
        check('Zwei Szenen gemerkt (Spuren an/aus + Lautstärke)', sc and len(sc['list']) == 2 and sc['list'][0]['t'][1]['on'] and not sc['list'][1]['t'][1]['on'] and sc['list'][1]['t'][0]['vol'] == 50 and sc['cur'] == 1, sc)
        await pg.evaluate(PATCH)
        await pg.click('#sceneList button[data-sc="0"]'); await pg.wait_for_timeout(50)
        s1 = await pg.evaluate("Looper._scene()")
        at = s1['pend'] and s1['pend']['at']
        check('Quantisiert: Wechsel wartet auf den nächsten Loop-Anfang', at and (at - s1['anchor']) % L == 0 and at > s1['now'] and await pg.evaluate("Looper.debug().tracks[1].state") == 'stopped'
              and 'pend' in await pg.get_attribute('#sceneList button[data-sc="0"]', 'class'), s1)
        wait_ms = (at - s1['now']) / sr * 1000 + 250
        await pg.wait_for_timeout(int(wait_ms))
        s2 = await pg.evaluate("Looper._scene()"); starts = await pg.evaluate("__starts")
        hit = [x for x in starts if abs(x[0] - at / sr) < 1e-6 and abs(x[1]) < 1e-6]
        check('Spur 2 startet genau am Loop-Anfang (Abtastgenau, Versatz 0)', len(hit) >= 1 and await pg.evaluate("Looper.debug().tracks[1].state") == 'playing', (at / sr, starts[-3:]))
        check('Danach aktiv: Szene 1, Lautstärke Spur 1 = 90', s2['cur'] == 0 and not s2['pend'] and await pg.input_value('#vol0') == '90' and 'on' in await pg.get_attribute('#sceneList button[data-sc="0"]', 'class'), s2)
        await pg.evaluate("Looper.sceneGo(1)"); s3 = await pg.evaluate("Looper._scene()"); at2 = s3['pend']['at']
        await pg.wait_for_timeout(int((at2 - s3['now']) / sr * 1000 + 300))
        stops = await pg.evaluate("__stops")
        check('Szene 2: Spur 2 endet genau am Loop-Anfang', any(abs(x - at2 / sr) < 1e-6 for x in stops) and await pg.evaluate("Looper.debug().tracks[1].state") == 'stopped' and await pg.input_value('#vol0') == '50', (at2 / sr, stops[-3:]))
        await pg.click('#sceneQ')
        await pg.evaluate("Looper.sceneGo(0)"); await pg.wait_for_timeout(100)
        check('„Wechsel am Loop-Anfang“ aus: sofort', await pg.evaluate("Looper._scene().cur") == 0 and await pg.evaluate("Looper.debug().tracks[1].state") == 'playing' and await pg.evaluate("localStorage.getItem('3nps-scene-q')") == '0')
        # Ebenen in Szenen
        await pg.evaluate("Looper._addLayer(0, new Float32Array(%d*2).fill(0.1))" % sr); await pg.wait_for_timeout(150)
        await pg.click('#sceneUpd')
        await pg.click('#layers0 button[data-ly="1"]'); await pg.wait_for_timeout(150)
        await pg.click('#sceneAdd'); await pg.wait_for_timeout(100)
        await pg.evaluate("Looper.sceneGo(0)"); await pg.wait_for_timeout(150)
        check('Szene schaltet Ebenen (Szene 1: Ebene 2 an)', await pg.evaluate("Looper.layers(0)") == [True, True])
        await pg.evaluate("Looper.sceneGo(2)"); await pg.wait_for_timeout(150)
        check('Szene 3: Ebene 2 stumm', await pg.evaluate("Looper.layers(0)") == [True, False])
        # ---------- 3. Pedal ----------
        await pg.evaluate("document.getElementById('pedalActsBox').open=true")
        opts = await pg.evaluate("[...document.querySelector('select[data-slot=\"foot0\"][data-w=\"tap\"]').options].map(o=>o.value)")
        check('Neue Pedal-Aktionen: Nächste/Vorherige Szene, Amp an/aus', all(x in opts for x in ['sceneNext', 'scenePrev', 'amp']), opts[-4:])
        await pg.select_option('select[data-slot="foot0"][data-w="tap"]', 'sceneNext'); await pg.select_option('select[data-slot="foot0"][data-w="hold"]', 'none')
        await pg.select_option('select[data-slot="foot1"][data-w="tap"]', 'scenePrev'); await pg.select_option('select[data-slot="foot1"][data-w="hold"]', 'none')
        await pg.select_option('select[data-slot="foot2"][data-w="tap"]', 'amp'); await pg.select_option('select[data-slot="foot2"][data-w="hold"]', 'none')
        await pg.focus('#pedalSink')
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(500)
        c1 = await pg.evaluate("Looper._scene().cur")
        await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(500)
        c2 = await pg.evaluate("Looper._scene().cur")
        check('Pedal: Nächste Szene (3 → 1, ringsum), Vorherige Szene (1 → 3)', c1 == 0 and c2 == 2, (c1, c2))
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(600)
        a1 = await pg.evaluate("Looper._amp()")
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(600)
        a2 = await pg.evaluate("Looper._amp()")
        check('Pedal: Amp an / aus', a1['on'] and a1['built'] and not a2['on'] and not a2['built'], (a1, a2))
        await pg.click('#pedalActsReset')
        # ---------- 4. Speichern/Laden mit Idee ----------
        await pg.evaluate("document.getElementById('ideaFold').open=true")
        await pg.fill('#ideaName', 'Szenen-Test'); await pg.click('#ideaSave'); await pg.wait_for_timeout(900)
        db = await pg.evaluate("""(async()=>{const all=await AppDB.all('ideas');const i=all.find(x=>x.name==='Szenen-Test');const s=i&&i.session;return s&&{sc:s.scenes&&s.scenes.list.map(x=>x.name),lys:s.tracks[0].lys?s.tracks[0].lys.length:0,off:s.tracks[0].lys&&s.tracks[0].lys.map(y=>y.off),dl:!!s.tracks[0].dl}})()""")
        check('Idee enthält Szenen + Ebenen einzeln (dl bleibt für ältere Fassungen)', db and db['sc'] and len(db['sc']) == 3 and db['lys'] == 2 and db['off'] == [False, True] and db['dl'], db)
        await pg.reload(); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.getElementById('ideaFold').open=true"); await pg.click('#ideaFilter [data-f="all"]'); await pg.wait_for_timeout(300)
        await pg.click('#ideaList .idea-row:has-text("Szenen-Test") [data-act="load"]'); await pg.wait_for_timeout(1200)
        sc = await pg.evaluate("Looper.scenes()")
        check('Nach Neustart geladen: 3 Szenen, Ebenen wieder einzeln', sc and len(sc['list']) == 3 and await pg.locator('#sceneList button').count() == 3 and await pg.evaluate("Looper.layers(0)") == [True, False], (sc and sc['cur'], await pg.evaluate("Looper.layers(0)")))
        await pg.evaluate("document.getElementById('sceneQ').checked=false;Looper.sceneGo(0)"); await pg.wait_for_timeout(200)
        check('Geladene Szene schaltet wieder (Ebene 2 an, Spur 2 an)', await pg.evaluate("Looper.layers(0)") == [True, True] and await pg.evaluate("Looper.debug().tracks[1].state") == 'playing')
        # Autosicherung trägt Szenen mit
        se = await pg.evaluate("(()=>{const s=Looper.getSession();return s.scenes&&s.scenes.list.length})()")
        check('Sitzung (Autosicherung) enthält Szenen', se == 3, se)
        # Englisch
        await pg.click('#langBtn'); await pg.wait_for_timeout(500)
        check('EN: „+ Scene“, „Switch at loop start“', '+ Scene' in await pg.inner_text('#sceneRow') and 'Switch at loop start' in await pg.inner_text('#sceneRow'), await pg.inner_text('#sceneRow'))
        await pg.click('#langBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate("localStorage.removeItem('3nps-scene-q');localStorage.setItem('3nps-countin','1');0")
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print('%d/%d' % (ok, tot))
asyncio.run(main())
