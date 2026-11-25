# v151: Mastering als eingeklappte Karte „Mastering“ im Looper (Oberfläche aus master.html erst beim Öffnen, master.js mount).
# Geprüft: zu = keine Oberfläche, kein Worker, keine Audio-Knoten; offen ohne Laden ebenso; „Minimal“ ausgeblendet; Looper-Mix und Datei
# messen, mastern (Pegelprüfung: eigene Nachmessung des Ergebnisses ≈ −14 LUFS, True Peak ≤ −1 dBTP), Vorher/Nachher hören, WAV-Export,
# Anleitung, EN, 3 Größen, keine Skriptfehler.
import asyncio, os, re, struct
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/')
T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
SPY = """window.__wk=0;(function(){const W=window.Worker;window.Worker=function(a,b){window.__wk++;return new W(a,b)};window.Worker.prototype=W.prototype;
window.__ac=0;const P=BaseAudioContext.prototype;Object.getOwnPropertyNames(P).filter(k=>k.startsWith('create')).forEach(k=>{const f=P[k];P[k]=function(){if(!(typeof OfflineAudioContext!=='undefined'&&this instanceof OfflineAudioContext))window.__ac++;return f.apply(this,arguments)}});})();"""
CNT = "({wk:window.__wk,ac:window.__ac})"
async def wait_status(pg, words, ms=60000):
    for _ in range(ms // 250):
        s = await pg.inner_text('#msStatus')
        if any(w in s for w in words): return s
        await pg.wait_for_timeout(250)
    return await pg.inner_text('#msStatus')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True); await ctx.add_init_script(SPY)
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U + 'index.html'); await pg.wait_for_timeout(5000); await open_tab(pg, 'looper')
            if w == 1366: check('ab v151', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 151)
            st = await pg.evaluate("({card:!!document.getElementById('msFold'),open:document.getElementById('msFold').open,ui:!!document.getElementById('msRun'),m:Master.mounted(),h:Math.round(document.querySelector('#msFold > summary').getBoundingClientRect().height),vis:document.getElementById('msFoldCard').offsetHeight>0})")
            check(f'{w}: Karte „Mastering“ da und zu, Oberfläche noch nicht aufgebaut', st['card'] and st['vis'] and not st['open'] and not st['ui'] and not st['m'], st)
            check(f'{w}: Kopf der Karte ≥ 44 px', st['h'] >= 44, st['h'])
            c0 = await pg.evaluate(CNT); await pg.wait_for_timeout(1500); c1 = await pg.evaluate(CNT)
            await pg.click('#msFold > summary'); await pg.wait_for_timeout(1500); c2 = await pg.evaluate(CNT)
            ui = await pg.evaluate("({ui:!!document.getElementById('msRun'),m:Master.mounted(),src:document.getElementById('msSrc').value,btn:document.getElementById('msSave').textContent})")
            check(f'{w}: zu → kein Worker, keine Audio-Knoten', c1 == c0, (c0, c1))
            check(f'{w}: öffnen baut nur die Oberfläche (kein Worker, keine Audio-Knoten)', c2 == c1 and ui['ui'] and ui['m'], (c1, c2, ui))
            check(f'{w}: Quelle „Looper-Mix“ vorgewählt, Knopf „Als WAV exportieren“', ui['src'] == 'mix' and ui['btn'] == 'Als WAV exportieren', ui)
            ov = await pg.evaluate("document.documentElement.scrollWidth<=innerWidth")
            check(f'{w}: nichts ragt seitlich heraus', ov)
            if w == 1366:
                await pg.click('#msLoad'); s = await wait_status(pg, ['noch nichts', 'Gemessen'], 8000)
                check('leerer Looper: Hinweis statt Fehler', 'noch nichts aufgenommen' in s, s)
                await pg.select_option('#loopCountIn', '0')
                await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav'); await pg.wait_for_timeout(3500)
                if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(800)
                await pg.wait_for_timeout(2000); cw = await pg.evaluate(CNT)
                await pg.click('#msLoad'); s = await wait_status(pg, ['Gemessen', 'fehlgeschlagen', 'still'])
                check('Looper-Mix laden & messen', 'Gemessen' in s, s)
                cw2 = await pg.evaluate(CNT); check('„Laden & messen“ startet genau einen Mess-Worker', cw2['wk'] == cw['wk'] + 1, (cw, cw2))
                await pg.click('#msRun'); s = await wait_status(pg, ['Fertig', 'fehlgeschlagen'], 120000)
                r = await pg.evaluate("(async()=>{const c=Master.cur(),r=c.res,m=await Master.measure(r.outs,c.sr);const rms=a=>{let e=0;for(let i=0;i<a.length;i++)e+=a[i]*a[i];return Math.sqrt(e/a.length)};let pk=0;r.outs.forEach(o=>{for(let i=0;i<o.length;i++)pk=Math.max(pk,Math.abs(o[i]))});return {I:m.I,TP:m.TP,before:c.before.I,gain:r.gainDb,rr:20*Math.log10(rms(r.outs[0])/rms(c.chs[0])),pk:20*Math.log10(pk),n:r.outs[0].length===c.chs[0].length}})()")
                check('Mastern fertig', s.startswith('Fertig'), s)
                check('Pegelprüfung: Nachmessung ≈ −14 LUFS (± 0,5), True Peak ≤ −1 dBTP, Abtastspitze < −1 dBFS', abs(r['I'] + 14) <= 0.5 and r['TP'] <= -0.95 and r['pk'] < -0.95, r)
                check('Pegelprüfung: Lautheitsänderung = RMS-Änderung (± 1,5 dB), gleiche Länge', abs((r['I'] - r['before']) - r['rr']) <= 1.5 and r['n'], r)
                await pg.click('#msPlay'); await pg.wait_for_timeout(600); await pg.click('#msAB [data-ab=b]'); await pg.wait_for_timeout(400)
                check('Vorher/Nachher: spielt, „Master“ umschaltbar', await pg.evaluate("Master.playing()") and await pg.evaluate("document.querySelector('#msAB [data-ab=b]').classList.contains('active')"))
                await pg.click('#msFold > summary'); await pg.wait_for_timeout(300)
                check('Karte zu → Vorhören stoppt', not await pg.evaluate("Master.playing()"))
                await pg.click('#msFold > summary'); await pg.wait_for_timeout(300)
                async with pg.expect_download() as dl: await pg.click('#msSave')
                d = await dl.value; path = await d.path(); data = open(path, 'rb').read()
                ch, sr, bits = struct.unpack('<H', data[22:24])[0], struct.unpack('<I', data[24:28])[0], struct.unpack('<H', data[34:36])[0]
                check('„Als WAV exportieren“: WAV 24 Bit Stereo, Name mit „Master“', data[:4] == b'RIFF' and bits == 24 and ch == 2 and 'Master' in d.suggested_filename and d.suggested_filename.endswith('.wav'), (d.suggested_filename, ch, sr, bits, len(data)))
                # Datei als Quelle
                await pg.select_option('#msSrc', 'file'); await pg.set_input_files('#msFile', T + 'loops/funk_104_3T.wav'); s = await wait_status(pg, ['Gemessen', 'fehlgeschlagen', 'nicht lesen'])
                check('„Datei laden …“ misst', 'Gemessen' in s and 'funk' in await pg.inner_text('#msName'), s)
                await open_tab(pg, 'hilfe'); await pg.wait_for_timeout(800); await pg.fill('#hlQ', 'mastering'); await pg.wait_for_timeout(200)
                check('Anleitung: Suche „mastering“ findet das Thema', await pg.evaluate("(document.querySelector('.hl-hit')||{dataset:{}}).dataset.id") == 'mastering')
            check(f'{w}: keine Skriptfehler', not errs, errs[:3])
            await ctx.close()
        # Minimal: ausgeblendet, nichts aufgebaut
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); await ctx.add_init_script("localStorage.setItem('3nps-device','min')")
        pg = await ctx.new_page(); await pg.goto(U + 'index.html'); await pg.wait_for_timeout(2000); await open_tab(pg, 'looper')
        check('„Minimal“: Karte ausgeblendet, nichts aufgebaut', await pg.evaluate("document.getElementById('msFoldCard').offsetHeight===0&&!Master.mounted()"))
        await ctx.close()
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page()
        await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500); await open_tab(pg, 'looper'); await pg.click('#msFold > summary'); await pg.wait_for_timeout(600)
        t = await pg.evaluate("[document.querySelector('#msFold .fold-n').textContent,document.getElementById('msSave').textContent,document.querySelector('#msSrc option[value=mix]').textContent]")
        check('EN: Karte übersetzt', t == ['louder and finished for Spotify & co.', 'Export as WAV', 'Looper mix (all tracks, without drums/drone)'], t)
        await ctx.close(); await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
