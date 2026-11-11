# v142: Geräte-Schalter in „Leistung ▾“ („Automatisch · Neues iPad · Altes iPad · Minimal“), Drone-Hall nur einmal gerechnet,
# Dauerläufer ohne Wiedergabe still. Prüft: Schalter, Speichern (3nps-device), frühe Klassen nach Neustart, „Altes iPad“
# (flach, ≈ 16 Bilder/s, grobe Pegel), „Minimal“ (keine Zeichnung pro Bild, Zahlen + Lämpchen, Signalweg/Hall/Echo/Was passt aus,
# Optik weg), Aufnahme + Overdub in „Minimal“, Zurückschalten stellt alles wieder her, Englisch, keine Skriptfehler.
import asyncio, os, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
T = '/home/claude/3nps/test/'
WAV = T + 'corpus/rock_120.wav'
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV, '--autoplay-policy=no-user-gesture-required']
# zählt Zeichnungen des Taktkreises (fit() holt den Kontext je Bild) und rAF-Aufrufe aus tick()
INSTR = """(()=>{window.__gc={};const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(k,o){if(this.id)window.__gc[this.id]=(window.__gc[this.id]||0)+1;return g.call(this,k,o)};
window.__rt=0;const r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=function(cb){if(cb&&cb.name==='tick')window.__rt++;return r(cb)};})()"""
async def rate(pg, ms=2000):
    await pg.evaluate("window.__gc={};window.__rt=0"); await pg.wait_for_timeout(ms)
    return await pg.evaluate("({ring:(window.__gc.ring0||0)*1000/%d, raf:window.__rt*1000/%d})" % (ms, ms))
async def dev(pg, v):
    await pg.click('#perfBtn'); await pg.wait_for_timeout(250)
    await pg.click('#dev' + {'auto': 'Auto', 'new': 'New', 'old': 'Old', 'min': 'Min'}[v]); await pg.wait_for_timeout(300)
    await pg.click('#pfClose'); await pg.wait_for_timeout(300)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.add_init_script(INSTR)
        await pg.goto(U); await pg.evaluate("localStorage.setItem('3nps-theme2','ios');localStorage.setItem('3nps-theme','nordic');localStorage.removeItem('3nps-device');localStorage.removeItem('3nps-device-auto');0")
        await pg.goto(U); await pg.wait_for_timeout(1500); await open_tab(pg, 'looper')
        check('Version ab v142', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 142)
        await pg.click('#perfBtn'); await pg.wait_for_timeout(300)
        names = await pg.evaluate("[...document.querySelectorAll('#perfPop .dev-b')].map(b=>b.textContent)")
        check('„Leistung ▾“: Gerät „Automatisch · Neues iPad · Altes iPad · Minimal“', names == ['Automatisch', 'Neues iPad', 'Altes iPad', 'Minimal'], names)
        check('Vorgabe „Automatisch“ gedrückt, wirkt wie bisher (Neues iPad)', await pg.evaluate("document.getElementById('devAuto').getAttribute('aria-pressed')==='true' && window.__dev==='new' && !document.documentElement.classList.contains('dev-old')"))
        await pg.wait_for_timeout(5200)
        inf = await pg.inner_text('#devInfo')
        check('Automatisch zeigt, was gewählt wurde (headless flüssig → Neues iPad)', 'Automatisch gewählt: „Neues iPad“' in inf and 'Bildzeit' in inf, inf[:90])
        await pg.click('#pfClose')
        # Spuren laden (laufen danach)
        await pg.select_option('#loopCountIn', '0')
        for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T']):
            await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(3500)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(1500)
        r_new = await rate(pg)
        check('Neues iPad: Taktkreis ≈ 30 Bilder/s wie bisher', 22 <= r_new['ring'] <= 34, r_new)
        await pg.evaluate("Looper.setTrackFx(0,{rev:30,dly:0});0")
        # ---- Altes iPad ----
        await dev(pg, 'old')
        st = await pg.evaluate("(()=>{const c=document.querySelector('.card'),f=document.querySelector('.tm-fill'),cs=getComputedStyle(c),fs=getComputedStyle(f);return {cls:document.documentElement.className,ls:localStorage.getItem('3nps-device'),sh:cs.boxShadow,bgi:getComputedStyle(document.documentElement).backgroundImage,fbg:fs.backgroundImage,tr:getComputedStyle(document.querySelector('.toggle-btn')).transitionDuration,theme:document.documentElement.dataset.theme}})()")
        check('Altes iPad: Klasse dev-old, gespeichert in 3nps-device', 'dev-old' in st['cls'] and 'dev-min' not in st['cls'] and st['ls'] == 'old', st)
        check('Altes iPad: keine Schatten, Texturen, Übergänge; Pegel flach; Optik bleibt', st['sh'] == 'none' and st['bgi'] == 'none' and st['fbg'] == 'none' and st['tr'] in ('0s', '0s, 0s') and st['theme'] == 'ios', st)
        r_old = await rate(pg)
        check('Altes iPad: Anzeige ≈ 16 Bilder/s', 10 <= r_old['ring'] <= 19, r_old)
        lv = await pg.evaluate("[...document.querySelectorAll('.tm-ch')].map(e=>e.style.cssText)")
        check('Altes iPad: Pegel grob (10-%-Stufen)', all(re.fullmatch(r'(--lv: \d*0%; --pk: \d*0%;)?', s) for s in lv), lv[:2])
        check('Altes iPad: Wellenform in einfacher Auflösung', await pg.evaluate("(()=>{const c=document.getElementById('wave0');return c.width===Math.round(c._w)})()"))
        check('Altes iPad: Signalweg und Hall/Echo weiter bedienbar', await pg.evaluate("!document.getElementById('loopSigBtn').disabled && !document.getElementById('fxb0').disabled"))
        # ---- Minimal ----
        await dev(pg, 'min')
        st = await pg.evaluate("(()=>({cls:document.documentElement.className,theme:document.documentElement.dataset.theme||'',ls:localStorage.getItem('3nps-device'),th2:localStorage.getItem('3nps-theme2'),ff:getComputedStyle(document.querySelector('.brand')).fontFamily,ring:getComputedStyle(document.getElementById('ring0')).visibility,rm:getComputedStyle(document.getElementById('ringMin0')).display}))()")
        check('Minimal: Klassen dev-old + dev-min, gespeichert', 'dev-min' in st['cls'] and 'dev-old' in st['cls'] and st['ls'] == 'min', st)
        check('Minimal: ohne Optik (Wahl „iOS“ bleibt gespeichert), Systemschrift', st['theme'] == '' and st['th2'] == 'ios' and 'system-ui' in st['ff'], st)
        check('Minimal: Taktkreis aus, Zahlenanzeige da', st['ring'] == 'hidden' and st['rm'] == 'flex', st)
        r_min = await rate(pg, 2500)
        check('Minimal: keine Zeichnung pro Bild (Taktkreis 0/s, kein rAF aus tick)', r_min['ring'] == 0 and r_min['raf'] == 0, r_min)
        await pg.evaluate("window.__gc={}"); await pg.wait_for_timeout(1500)
        check('Minimal: Wellenform/Editor stehen (nicht neu gezeichnet ohne Bedienung)', await pg.evaluate("!(window.__gc.wave0||0) && !(window.__gc.edWave||0)"), await pg.evaluate("window.__gc"))
        pos = await pg.evaluate("[document.querySelector('#ringMin0 .rm-pos').textContent,document.querySelector('#ringMin0 .rm-lbl').textContent,document.querySelectorAll('#ringMin0 .lamp').length]")
        check('Minimal: Takt.Schlag als Zahl + Lämpchen (Aufnahme, Übersteuern)', re.fullmatch(r'\d+\.\d', pos[0]) and pos[1] == 'Spur 1' and pos[2] == 2, pos)
        await pg.evaluate("window.__m=0;window.__mo=new MutationObserver(l=>{window.__m+=l.length});window.__mo.observe(document.getElementById('panel-looper'),{attributes:true,subtree:true,childList:true,characterData:true})")
        await pg.wait_for_timeout(3000); mut = await pg.evaluate("window.__m/3")
        check('Minimal: kaum DOM-Änderungen beim Mitlaufen (höchstens je Schlag)', mut < 20, round(mut, 1))
        dis = await pg.evaluate("({sig:document.getElementById('loopSigBtn').disabled,sigT:getComputedStyle(document.getElementById('loopSigBtn'),'::after').content,fx:document.getElementById('fxb0').disabled,passt:document.getElementById('passtBox').hidden,fxv:Looper.getTrackFx(0)})")
        check('Minimal: Signalweg + Hall/Echo sichtbar deaktiviert mit „in „Minimal“ aus“', dis['sig'] and dis['fx'] and 'Minimal' in dis['sigT'], dis)
        check('Minimal: „Was passt“ aus, Hall-Einstellung bleibt gespeichert', dis['passt'] and dis['fxv']['rev'] == 30, dis)
        # Aufnahme + Overdub in Minimal (Eingang über das Test-Mikrofon)
        await pg.evaluate("Looper.stopAll(); Looper.clearAll(); 0"); await pg.wait_for_timeout(300)
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
        await pg.select_option('#loopBars', '1') if await pg.evaluate("[...document.getElementById('loopBars').options].some(o=>o.value==='1')") else None
        await pg.click('#foot0'); await pg.wait_for_timeout(300)
        lamp = None
        for k in range(40):
            s0 = await pg.evaluate("Looper.debug().tracks[0].state")
            if s0 == 'recording' and lamp is None:
                await pg.wait_for_timeout(200); lamp = await pg.evaluate("[document.getElementById('ringMin0').classList.contains('rec'),document.querySelector('#ringMin0 .rm-lbl').textContent]")
            if s0 == 'playing': break
            await pg.wait_for_timeout(250)
        if await pg.evaluate("Looper.debug().tracks[0].state") == 'recording': await pg.click('#foot0'); await pg.wait_for_timeout(1500)
        d0 = await pg.evaluate("Looper.debug().tracks[0]")
        check('Minimal: Aufnahme-Lämpchen leuchtet beim Aufnehmen', lamp and lamp[0] and lamp[1].startswith('Aufnahme'), lamp)
        check('Minimal: Aufnahme funktioniert (Spur 1 hat Länge und spielt)', d0['L'] > 0 and d0['state'] == 'playing', d0['state'])
        await pg.click('#foot0'); await pg.wait_for_timeout(1500)
        ov = await pg.evaluate("[Looper.debug().tracks[0].state, document.querySelector('#ringMin0 .rm-lbl').textContent]")
        await pg.click('#foot0'); await pg.wait_for_timeout(800)
        d1 = await pg.evaluate("Looper.debug().tracks[0]")
        check('Minimal: Overdub läuft und endet (Ebene dazu)', ov[0] == 'overdub' and ov[1] == 'Overdub' and d1['layers'] >= 2, (ov, d1['state'], d1['layers']))
        r_min2 = await rate(pg, 1500)
        check('Minimal: auch beim Aufnehmen/Spielen kein rAF aus tick', r_min2['raf'] == 0 and r_min2['ring'] == 0, r_min2)
        # Neustart behält Minimal (frühe Klasse vor dem ersten Bild)
        await pg.reload(); await pg.wait_for_timeout(1200)
        st = await pg.evaluate("[document.documentElement.className, document.documentElement.dataset.theme||'', window.__dev, window.__audioHint]")
        check('Neustart: Minimal bleibt (frühe Klassen, keine Optik), großer Audio-Puffer', 'dev-min' in st[0] and st[1] == '' and st[2] == 'min' and st[3] == 'playback', st)
        # ---- zurück auf Neues iPad: alles wieder da ----
        await open_tab(pg, 'looper')
        for i, f in enumerate(['chords/c_pop_strum']):
            await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(3500)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(500)
        await dev(pg, 'new')
        st = await pg.evaluate("({cls:document.documentElement.className,theme:document.documentElement.dataset.theme||'',sig:document.getElementById('loopSigBtn').disabled,fx:document.getElementById('fxb0').disabled,fxv:Looper.getTrackFx(0),ring:getComputedStyle(document.getElementById('ring0')).visibility,rm:getComputedStyle(document.getElementById('ringMin0')).display})")
        check('Zurück auf Neues iPad: Optik „iOS“ wieder da, Klassen weg', st['theme'] == 'ios' and 'dev-' not in st['cls'], st)
        check('Zurück: Signalweg + Hall/Echo wieder bedienbar, Hall-Wert 30 % erhalten', not st['sig'] and not st['fx'] and st['fxv']['rev'] == 30, st)
        check('Zurück: Taktkreis statt Zahlenanzeige', st['ring'] == 'visible' and st['rm'] == 'none', st)
        r_back = await rate(pg)
        check('Zurück: Taktkreis wieder ≈ 30 Bilder/s', 22 <= r_back['ring'] <= 34, r_back)
        await pg.wait_for_timeout(1500)
        check('Zurück: „Was passt“ erscheint wieder', not await pg.evaluate("document.getElementById('passtBox').hidden"))
        # Drone-Hall nur einmal: zweiter Aufbau nutzt denselben Impuls
        same = await pg.evaluate("(()=>{ensureAudio();ensureReverb();const a=reverbIR,r=reverbNode;reverbNode=null;ensureReverb();const s=reverbIR===a&&reverbNode!==r;reverbNode=r;return s})()")
        check('Drone-Hall: Impuls einmal gerechnet und wiederverwendet', same)
        # Englisch
        p2 = await ctx.new_page(); await p2.goto(U + '?lang=en'); await p2.wait_for_timeout(1500)
        await p2.click('#perfBtn'); await p2.wait_for_timeout(400)
        en = await p2.evaluate("[...document.querySelectorAll('#perfPop .dev-b')].map(b=>b.textContent)")
        check('Englisch: „Automatic · New iPad · Old iPad · Minimal“', en[1:] == ['New iPad', 'Old iPad', 'Minimal'] and en[0] != 'Automatisch', en)
        await p2.close()
        await pg.evaluate("localStorage.removeItem('3nps-device');localStorage.setItem('3nps-theme2','nordic');0")
        check('keine Skriptfehler', not errs, errs[:3])
        print(f'\n{ok}/{tot}')
        await b.close()
asyncio.run(main())
