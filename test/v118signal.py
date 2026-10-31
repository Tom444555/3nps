# v118: Looper – Ansicht „Signalweg“ (Fluss-Diagramm mit Live-Pegeln; Analyser nur, solange offen)
import asyncio, os, math, struct, wave, re
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
WAV = '/tmp/v116_sine110.wav'
if not os.path.exists(WAV):
    sr = 48000; w = wave.open(WAV, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(struct.pack('<h', int(12000 * math.sin(2 * math.pi * 110 * i / sr))) for i in range(sr * 4))); w.close()
# Mitschnitt aller Verbindungen zu/von AnalyserNodes (unabhängig vom App-Code)
SPY = """(() => {
  const P = AudioNode.prototype, oc = P.connect, od = P.disconnect; window.__anE = [];
  const isA = n => n instanceof AnalyserNode;
  P.connect = function (d, ...a) { const r = oc.call(this, d, ...a); if (d instanceof AudioNode && (isA(d) || isA(this))) window.__anE.push([this, d]); return r; };
  P.disconnect = function (...a) { const r = od.apply(this, a); const d = a[0];
    window.__anE = window.__anE.filter(([s, t]) => !(s === this && (d === undefined || typeof d === 'number' || d === t))); return r; };
  window.__anLive = () => { const s = new Set(); window.__anE.forEach(([a, b]) => { if (isA(a)) s.add(a); if (isA(b)) s.add(b); }); return s.size; };
})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV, '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, bypass_csp=True); await ctx.grant_permissions(['microphone'])
        await ctx.add_init_script(SPY)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(900)
        await pg.evaluate("localStorage.removeItem('3nps-amp-on');localStorage.setItem('3nps-countin','0');localStorage.setItem('3nps-limiter','1');0")
        await pg.reload(); await pg.wait_for_timeout(900)
        check('v118', 'v118' in await pg.inner_text('.brand'))
        check('Knopf „Signalweg“ nach Amp-„▾“', await pg.evaluate("document.getElementById('loopAmpSet').nextElementSibling.id") == 'loopSigBtn')
        sr = await pg.evaluate("(ensureAudio(), audioCtx.sampleRate)")
        await pg.evaluate("""(sr=>{const a=new Float32Array(sr*2).map((_,i)=>0.4*Math.sin(2*Math.PI*220*i/sr)), c=new Float32Array(sr*2).map((_,i)=>0.25*Math.sin(2*Math.PI*330*i/sr));
          Looper._setTrackRaw(0,a); Looper._setTrackRaw(1,c); const se=Looper.getSession(); se.baseL=se.tracks[0].L; Looper.loadSession(se)})(%d)""" % sr)
        await pg.wait_for_timeout(600)
        st = await pg.evaluate("Looper.debug().tracks.map(t=>t.state)")
        check('Testszenario: Spuren 1+2 laufen', st[0] == 'playing' and st[1] == 'playing', st)
        s = await pg.evaluate("Looper._sig()")
        check('geschlossen: keine Analyser erzeugt/angeschlossen', not s['on'] and s['made'] == 0 and s['n'] == 0 and await pg.evaluate("__anLive()") == 0, (s['made'], await pg.evaluate("__anLive()")))
        # ---------- öffnen (Hochformat) ----------
        await pg.click('#loopSigBtn'); await pg.wait_for_timeout(900)
        s = await pg.evaluate("Looper._sig()")
        check('Ansicht offen mit SVG', await pg.is_visible('#sigDlg') and await pg.locator('#sigWrap svg').count() == 1 and s['on'])
        check('Stationen: Eingang → Spur 1, Spur 2 → Master → Ausgang (kein Amp/Bus/Drums/Drone)', s['groups'] == [['in'], ['t0', 't1'], ['ms'], ['out']], s['groups'])
        check('Eingang geschlossen angezeigt', 'geschlossen' in s['titles'][0][0], s['titles'][0])
        check('Spur zeigt Zustand + Ebenen', 'läuft' in s['titles'][1][0] and '1 Ebene' in s['titles'][1][0], s['titles'][1])
        check('Pegel > 0 bei Wiedergabe (Spur 1 ~40 %, Spur 2 ~25 %, Master, Ausgang)', 0.3 < s['lv'].get('t0', 0) < 0.5 and 0.18 < s['lv'].get('t1', 0) < 0.33 and s['lv'].get('ms', 0) > 0.2 and s['lv'].get('out', 0) > 0.2, s['lv'])
        txt = await pg.text_content('#sgv-t0')
        check('Anzeige in % mit Balken', re.match(r'^\d+ %$', txt) and 25 <= int(txt.split()[0]) <= 50 and float(await pg.get_attribute('#sgb-t0', 'width')) > 10, txt)
        check('Limiter: Gain-Reduktion in dB angezeigt', re.match(r'^GR −?\d+[,.]\d dB$', await pg.text_content('#sgg')) is not None, await pg.text_content('#sgg'))
        check('nur die Abgriffe der Stationen angeschlossen', await pg.evaluate("__anLive()") == s['n'] == 4, (await pg.evaluate("__anLive()"), s['keys']))
        vb = await pg.evaluate("(()=>{const v=document.querySelector('#sigWrap svg').viewBox.baseVal, r=document.querySelector('#sigWrap svg').getBoundingClientRect();return [v.width,v.height,r.width,r.right,innerWidth,document.documentElement.scrollWidth]})()")
        check('Hochformat: von oben nach unten, passt in die Breite', vb[1] > vb[0] and vb[3] <= vb[4] and vb[5] <= vb[4], vb)
        # ---------- Zustand ändern: Hall, Drums, Drone, Amp, Spur stopp ----------
        await pg.evaluate("Looper.setTrackFx(0,{rev:40,dly:0})"); await pg.evaluate("Rhythm.setOn(true)")
        await pg.evaluate("document.querySelector('#laneDrone').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#loopMonitor').click()"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelector('#loopAmpBtn').click()"); await pg.wait_for_timeout(1800)
        s = await pg.evaluate("Looper._sig()")
        check('Kette folgt dem Zustand: Amp, Hall-Bus, Drums+Drone', s['groups'] == [['in'], ['amp'], ['t0', 't1'], ['fx'], ['dr', 'dn'], ['ms'], ['out']], s['groups'])
        check('Amp mit Unterstufen gemessen (Gate, Drive, Klang, Box, Pegel)', all(s['lv'].get(k, 0) > 0.01 for k in ['ag', 'ad', 'ak', 'ab', 'ap']), {k: round(s['lv'].get(k, 0), 3) for k in ['in', 'ag', 'ad', 'ak', 'ab', 'ap']})
        check('Eingang offen, Pegel vom Fake-Mikrofon', 'offen' in s['titles'][0][0] and s['lv'].get('in', 0) > 0.1, (s['titles'][0], s['lv'].get('in')))
        check('Hall-Bus Pegel > 0', s['lv'].get('fx', 0) > 0.005, s['lv'].get('fx'))
        check('Drums und Drone Pegel > 0', s['lv'].get('dr', 0) > 0.005 and s['lv'].get('dn', 0) > 0.0005, (s['lv'].get('dr'), s['lv'].get('dn')))
        check('Amp-Box zeigt Unterstufen im Bild', await pg.locator('#sgv-ad').count() == 1 and await pg.locator('#sgv-ab').count() == 1)
        await pg.evaluate("Looper.stopTrack(1)"); await pg.wait_for_timeout(1300)
        s = await pg.evaluate("Looper._sig()")
        check('gestoppte Spur: „gestoppt“, Pegel fällt', 'gestoppt' in s['titles'][2][1] and s['lv'].get('t1', 0) < 0.05, (s['titles'][2], s['lv'].get('t1')))
        await pg.evaluate("Looper.setTrackFx(0,{rev:0,dly:0})"); await pg.wait_for_timeout(600)
        s = await pg.evaluate("Looper._sig()")
        check('Sends auf 0 → Bus verschwindet aus der Kette', ['fx'] not in s['groups'] and 'fx' not in s['keys'], s['groups'])
        live = await pg.evaluate("__anLive()")
        check('Analyser-Zahl = Stationen mit Messpunkt', live == s['n'], (live, s['keys']))
        # ---------- schließen ----------
        await pg.click('#sigClose'); await pg.wait_for_timeout(300)
        s = await pg.evaluate("Looper._sig()")
        live = await pg.evaluate("__anLive()")
        check('nach Schließen: keine Analyser mehr angeschlossen, Bild leer', not s['on'] and s['n'] == 0 and not s['sink'] and live == 0 and await pg.locator('#sigWrap svg').count() == 0 and not await pg.is_visible('#sigDlg'), (s, live))
        await pg.wait_for_timeout(400)
        check('geschlossen: keine weiteren Analyser erzeugt', (await pg.evaluate("Looper._sig()"))['made'] == s['made'])
        # ---------- Querformat ----------
        await pg.set_viewport_size({'width': 1366, 'height': 1024}); await pg.wait_for_timeout(300)
        await pg.click('#loopSigBtn'); await pg.wait_for_timeout(700)
        vb = await pg.evaluate("(()=>{const v=document.querySelector('#sigWrap svg').viewBox.baseVal, r=document.querySelector('#sigWrap svg').getBoundingClientRect();return [v.width,v.height,r.right,r.bottom,innerWidth,innerHeight,document.documentElement.scrollWidth]})()")
        await pg.evaluate("document.querySelector('#loopAll2').click()"); await pg.wait_for_timeout(700)
        await pg.screenshot(path='/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/v118-quer2.png')
        check('Querformat: von links nach rechts, passt aufs iPad', vb[0] > vb[1] and vb[2] <= vb[4] and vb[3] <= vb[5] and vb[6] <= vb[4], vb)
        await pg.screenshot(path='/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad/v118-quer.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        check('Escape schließt + trennt', not (await pg.evaluate("Looper._sig()"))['on'] and await pg.evaluate("__anLive()") == 0)
        # ---------- Englisch ----------
        await pg.click('#langBtn'); await pg.wait_for_timeout(400)
        await pg.click('#loopSigBtn'); await pg.wait_for_timeout(600)
        t = await pg.text_content('#sigDlg')
        check('EN: Titel und Stationen englisch', 'Signal flow' in t and 'Input' in t and 'Output' in t and 'Eingang' not in t and 'gestoppt' not in t, t[:200].replace('\n', ' | '))
        await pg.click('#sigClose'); await pg.click('#langBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate("Rhythm.setOn(false)"); await pg.evaluate("document.querySelector('#laneDrone').click()")
        check('keine Skriptfehler', not errs, errs[:3])
        print(f'{ok}/{tot}')
        await b.close()
asyncio.run(main())
