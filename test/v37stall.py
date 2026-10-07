# v37: Leistungsfenster erkennt Audio-Hänger (Audio-Uhr bleibt hinter der echten Zeit) und zeigt Abtastrate + späte Drum-Schläge
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
# Absichtliche Überlast: ein Audio-Modul, das je Block ~12 ms rechnet (Budget bei 128 Frames/48 kHz: 2,7 ms)
HOG = """(async()=>{ensureAudio(); const code='class H extends AudioWorkletProcessor{process(){const t=currentTime;let x=0;const e=Date.now()+12;while(Date.now()<e)x++;return true}}registerProcessor("hog",H)';
  await audioCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([code],{type:'application/javascript'})));
  window.__hog=new AudioWorkletNode(audioCtx,'hog'); __hog.connect(audioCtx.destination); return true})()"""
VAL = "['pfStall','pfLate','pfRate','pfNote'].map(i=>document.getElementById(i).textContent)"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        errs = []
        # normal: Drums laufen, keine Hänger
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.click('#playBtn'); await pg.wait_for_timeout(400)
        await pg.click('#perfBtn'); await pg.wait_for_timeout(5200)
        v = await pg.evaluate(VAL)
        check('Normal: 0 Hänger, 0 späte Schläge', v[0] == '0' and v[1] == '0', v[:3])
        check('Abtastrate angezeigt', 'kHz' in v[2], v[2])
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        v = await pg.evaluate(VAL)
        check('Mit Eingang: Rate App/Gerät', 'kHz' in v[2], v[2])
        await pg.close()
        # Überlast: Hänger werden gezählt und erklärt
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.click('#playBtn'); await pg.wait_for_timeout(300)
        await pg.click('#perfBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate(HOG); await pg.wait_for_timeout(5500)
        v = await pg.evaluate(VAL)
        check('Überlast: Hänger erkannt', v[0] not in ('0', '–', 'Audio aus') and '×' in v[0], v[0])
        check('Überlast: Hinweis erklärt es', 'Audio-Hänger' in v[3], v[3][:90])
        await pg.evaluate("__hog.disconnect()"); await pg.close()
        # Überlast mit laufenden Drums, Fenster zu: Wächter gibt einen Rat
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.click('#loopDrums'); await pg.wait_for_timeout(800)
        await pg.evaluate(HOG); await pg.wait_for_timeout(6500)
        st = await pg.inner_text('#loopStatus')
        check('Wächter rät zu „Stabil“/„Raum“', 'Stabil' in st and 'Raum' in st, st[:90])
        await pg.evaluate("__hog.disconnect()"); await pg.close()
        # Schlüssel-Konflikt v35/v36: Fensterzustand stand in 3nps-perf → wird umgezogen, Einstellung repariert
        ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-perf', JSON.stringify({pin:true,compact:true,x:300,y:200}));}")
        await pg.goto(U); await pg.wait_for_timeout(800)
        r = await pg.evaluate("[localStorage.getItem('3nps-perf'), JSON.parse(localStorage.getItem('3nps-perfwin')||'{}').x, document.getElementById('perfMode').value, !document.getElementById('perfPop').hidden]")
        check('Alter Fensterzustand umgezogen, Einstellung repariert', r[0] == 'auto' and r[1] == 300 and r[3], r)
        # Einstellung „Stabil“: bleibt beim Anheften erhalten, Puffer-Hinweis, nach Neustart großer Puffer
        await pg.select_option('#perfMode', 'stable'); await pg.wait_for_timeout(100)
        await pg.click('#pfCompact'); await pg.click('#pfCompact'); await pg.wait_for_timeout(100)
        check('„Stabil“ bleibt trotz Fenster-Bedienung', await pg.evaluate("localStorage.getItem('3nps-perf')") == 'stable')
        await pg.click('#loopDrums'); await pg.wait_for_timeout(400)
        await pg.select_option('#perfMode', 'high'); await pg.wait_for_timeout(100); await pg.select_option('#perfMode', 'stable'); await pg.wait_for_timeout(100)
        check('Hinweis: gilt nach Neustart', 'nächsten Start' in await pg.inner_text('#loopStatus'))
        await pg.reload(); await pg.wait_for_timeout(600); await pg.click('#loopDrums'); await pg.wait_for_timeout(400)
        r = await pg.evaluate("[window.__audioHint, document.getElementById('perfMode').value, (document.getElementById('perfInfo')||{}).textContent]")
        check('Nach Neustart: großer Puffer aktiv', r[0] == 'playback' and r[1] == 'stable' and 'Stabil' in r[2], r[:2])
        await pg.click('#loopDrums')
        # Latenz-Ausgleich folgt einem Geräte-/Pufferwechsel um die Differenz
        est = await pg.evaluate("Math.round(((audioCtx.baseLatency||0)+(audioCtx.outputLatency||0))*1000+15)")
        await pg.evaluate(f"localStorage.setItem('3nps-lat-est', String({est} - 40)); localStorage.setItem('3nps-lat-why', 'balanced|Spark LIVE'); document.getElementById('loopLatency').value = '100'; localStorage.setItem('3nps-latency','100')")
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(2600)
        r = await pg.evaluate("[document.getElementById('loopLatency').value, localStorage.getItem('3nps-lat-est'), document.getElementById('loopStatus').textContent]")
        check('Ausgleich um +40 ms verschoben', r[0] == '140' and r[1] == str(est) and 'angepasst' in r[2], r)
        await ctx.close()
        # gleiches Gerät: Ausgleich bleibt unangetastet
        ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(500); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        v1 = await pg.evaluate("document.getElementById('loopLatency').value")
        await pg.evaluate("document.getElementById('loopLatency').value='120'; localStorage.setItem('3nps-latency','120')")
        await pg.reload(); await pg.wait_for_timeout(500); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        v2 = await pg.evaluate("document.getElementById('loopLatency').value")
        check('Gleiches Gerät: eigene Einstellung bleibt', v2 == '120', (v1, v2))
        # Raumhall an/aus
        await pg.click('#loopDrums'); await pg.wait_for_timeout(500)
        await pg.click('#drumRoomBtn'); await pg.wait_for_timeout(100)
        r = await pg.evaluate("[Rhythm.roomOn(), localStorage.getItem('3nps-drumroom'), document.getElementById('drumRoomBtn').textContent]")
        check('Raum aus', r == [False, '0', 'Raum aus'], r)
        await pg.reload(); await pg.wait_for_timeout(500); await pg.click('#loopDrums'); await pg.wait_for_timeout(600)
        r = await pg.evaluate("[Rhythm.roomOn(), Rhythm.debug().late]")
        check('Raum aus bleibt nach Neustart, Drums laufen', r[0] is False and r[1] == 0, r)
        await pg.click('#drumRoomBtn'); await pg.wait_for_timeout(100)
        check('Raum wieder an', await pg.evaluate("Rhythm.roomOn()") is True)
        await ctx.close()
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
