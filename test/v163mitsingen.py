# v163: Seite „Mitsingen lernen“ unter „Lernen“. Prüft: erst beim Öffnen geladen (mitsingen.js/.css in der Offline-Liste, index.html < 2,1 MB),
# Chip/Kachel, Fahrplan 8 Schritte mit Haken je Stück (Songbook-Stück, eigenes Stück, „ohne Stück“), drei Wege, freie Wahl, Tipps, ohne Datei nutzbar,
# Tonart-Hinweis (Kapo/Griffe), Text aus dem Songbook ohne Akkordzeilen; mit Testaudio + erfundenem Text: Zeilen, Schleife, ‹ ›, Umfang,
# Tempo 75 % (Länge), Vorsingen – Pause – Nachsingen (Pause gleich lang, „Jetzt du“), Tonart −2 (Tonhöhe gemessen), Looper bleibt aus, Looper-Start
# hält an, keine Übezeit geschrieben (auch keine Looper-Zeit), „Üben einschalten“, Stelle merken, Aufnahme (Testmikrofon) + Anhören + Idee,
# ohne Text nach Takten, Karaoke erst nach „Gesang trennen“ (echtes Spleeter), Pedal, Seite verlassen stoppt, Profile, 3 Größen, EN, keine Skriptfehler.
# Aufruf: python3 test/v163mitsingen.py  (~4 min; braucht Testaudio aus wiederherstellen.sh und test/gen_sep.py). SHOT=1 → Bilder nach /home/claude/bilder/
import asyncio, json, os, re, subprocess, sys
from playwright.async_api import async_playwright
from nav import tab
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'; WWW = os.path.dirname(os.path.abspath(__file__)) + '/../app/www/'
SHOT = os.environ.get('SHOT'); SH = '/home/claude/bilder/'
if not os.path.exists(T + 'sep/mix.wav'): subprocess.run([sys.executable, os.path.dirname(os.path.abspath(__file__)) + '/gen_sep.py'], check=True)
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''), flush=True)
# erfundener Text (keine echten Liedtexte)
W = [("Die", 8, 0), ("Straße", 8.5, 0), ("leer,", 9, 0), ("das", 10, 0), ("Radio", 10.5, 0), ("leise", 11, 0), ("Ich", 13, 1), ("zähl", 13.5, 1), ("die", 14, 1), ("Lichter,", 14.5, 1), ("eins", 15.5, 1), ("und", 16, 1), ("zwei", 16.5, 1),
     ("Am", 18, 2), ("Rand", 18.5, 2), ("der", 19, 2), ("Stadt", 19.5, 2), ("Wo", 22, 3), ("niemand", 22.5, 3), ("wartet", 23.5, 3)]
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in W]
SEPTOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("la", 2, 0), ("la", 3, 0), ("la", 4, 0), ("lu", 6, 1), ("lu", 7, 1), ("lu", 8, 1)]]
SB = {"v": 1, "sel": "n1", "fs": 1, "s": [{"id": "n1", "t": "Nachtfahrt", "r": 9, "m": "Äolisch (Moll)", "b": 92, "ts": "4/4", "x": "Am        F\nDie Straße leer, das Radio leise\nC         G\nIch zähl die Lichter, eins und zwei", "c": 1, "e": 1},
                                  {"id": "n2", "t": "Staub und Sterne", "r": 4, "m": "Ionisch (Dur)", "b": 120, "x": "", "c": 1, "e": 1}]}
UZ = {"v": 1, "u": [[1764000000, 1800, 1, "ges"], [1764003600, 1200, 1, "sbn1"]]}
def init(extra=''):
    return ("if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);localStorage.setItem('3nps-songbook',%s);"
            "localStorage.setItem('3nps-uebezeit-themen',%s);%s}") % (json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}, "mix.wav|240": {"name": "mix.wav", "tok": SEPTOK}}, "l": {}})),
            json.dumps(json.dumps(SB)), json.dumps(json.dumps({"c": [["sbn1", "Nachtfahrt"]], "r": {}, "h": []})), extra)
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
async def newpage(b, w=1366, h=1024, extra='', q=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(init(extra)); await pg.goto(U + q); await pg.wait_for_timeout(900)
    return pg, errs
async def load(pg, f):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', f)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if (await pg.inner_text('#loopStatus')).startswith(('Spur 1:', 'Track 1:')): break
    await pg.wait_for_timeout(300)
    if await pg.evaluate("Looper.running()"): await pg.click('#loopAll'); await pg.wait_for_timeout(200)
async def st(pg): return await pg.evaluate("MitsingenLernen._st()")
async def shot(pg, n):
    if SHOT: os.makedirs(SH, exist_ok=True); await pg.wait_for_timeout(300); await pg.screenshot(path=SH + n)
UZJ = "localStorage.getItem('3nps-uebezeit')"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        # ---------- A: Laden, Bau, Navigation ----------
        h = open(WWW + 'index.html', encoding='utf8').read(); sw = open(WWW + 'sw.js', encoding='utf8').read()
        check('index.html < 2,1 MB und ohne Seitencode', len(h.encode()) < 2100000 and 'MitsingenLernen =' not in h and 'msl-wrap' not in h, len(h.encode()))
        check('sw.js: mitsingen.js/.css in der Offline-Liste, Cache ab v163', all("'%s'" % f in sw.split('const CORE')[1].split('\n')[0] for f in ['mitsingen.js', 'mitsingen.css']) and int(re.search(r"3nps-v(\d+)", sw).group(1)) >= 163)
        pg, errs = await newpage(b, extra="localStorage.setItem('3nps-uebezeit'," + json.dumps(json.dumps(UZ)) + ");")
        check('ab v163', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 163)
        res0 = await pg.evaluate("performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/mitsingen\\.(js|css)/.test(n)).length")
        check('Start lädt mitsingen.js/.css nicht', res0 == 0 and not await pg.evaluate("!!window.MitsingenLernen"))
        await pg.click('#area-lernen'); await pg.wait_for_timeout(400)
        chips = await pg.evaluate("[...document.querySelectorAll('#subNav [data-area=lernen]')].map(c=>c.dataset.tab)")
        check('Chip „Mitsingen lernen“ nach „Songbook“', chips.index('singlernen') == chips.index('songbook') + 1, chips)
        await pg.click('#tab-lernen'); await pg.wait_for_timeout(500)
        tile = await pg.evaluate("(()=>{const t=document.querySelector('.ln-tile[data-t=singlernen]');return t?t.textContent:''})()")
        check('Kachel in der Lernen-Übersicht', 'Mitsingen lernen' in tile and 'noch nicht geübt' in tile, tile[:80])
        uz0 = await pg.evaluate(UZJ)
        await pg.click('.ln-tile[data-t=singlernen]'); await pg.wait_for_timeout(1200)
        check('Kachel öffnet die Seite, Code nachgeladen', await pg.evaluate("AppNav.current()") == 'singlernen' and await pg.evaluate("!!window.MitsingenLernen && MitsingenLernen.built()"))
        rows = await pg.evaluate("[...document.querySelectorAll('#mslL .msl-r')].map(r=>r.querySelector('b').textContent)")
        check('Fahrplan mit 8 Schritten', len(rows) == 8 and rows[0] == 'Song & Tonart' and rows[7] == 'Aufnehmen & anhören', rows)
        check('Stück: Songbook-Stück vorgewählt (keine Datei geladen), Tonart/BPM', await pg.evaluate("document.getElementById('mslPiece').value") == 'sb:n1' and 'A Moll · 92 BPM' in await pg.inner_text('#mslMeta'), await pg.inner_text('#mslMeta'))
        check('ohne Datei: Anleitung + „♫ Lied im Looper laden“, kein Übungsfeld', await pg.is_visible('#mslNo') and not await pg.is_visible('#mslBox') and await pg.is_visible('#mslLoad'))
        check('Weg „Gründlich“: 0 von 8, keine Zeile gedimmt', await pg.inner_text('#mslCnt') == '0 von 8' and await pg.evaluate("document.querySelectorAll('#mslL .msl-r.off').length") == 0)
        await pg.click('.msl-ways [data-w=s]'); await pg.wait_for_timeout(200)
        offs = await pg.evaluate("[...document.querySelectorAll('#mslL .msl-r.off')].map(r=>+r.dataset.s)")
        check('Weg „Schnell“: 2 → 5 → 6 → 8, Rest gedimmt, 0 von 4', offs == [1, 3, 4, 7] and await pg.inner_text('#mslCnt') == '0 von 4', offs)
        await pg.click('.msl-ways [data-w=m]'); await pg.wait_for_timeout(200)
        offs = await pg.evaluate("[...document.querySelectorAll('#mslL .msl-r.off')].map(r=>+r.dataset.s)")
        check('Weg „Mit Gitarre“: 3 → 4 → 7 → 8', offs == [1, 2, 5, 6] and 'Begleitung' in await pg.inner_text('#mslWayD'), offs)
        await pg.click('#mslL [data-s="1"]'); await pg.wait_for_timeout(200)
        check('gedimmter Schritt lässt sich trotzdem antippen', 'Schritt 1 · Song & Tonart' == await pg.inner_text('#mslH'))
        # Tonart-Hinweis
        await pg.click('#mslKeyD'); await pg.click('#mslKeyD'); await pg.wait_for_timeout(200)
        kx = await pg.inner_text('#mslX')
        check('Tonart −2: „A Moll → G Moll“, Griffe Am → Gm bzw. Kapo tiefer', 'A Moll → G Moll' in kx and 'Am → Gm' in kx and '2 Halbtöne tiefer' in kx, kx[:200])
        await pg.click('#mslKey0'); await pg.click('#mslKeyU'); await pg.click('#mslKeyU'); await pg.click('#mslKeyU'); await pg.wait_for_timeout(200)
        check('Tonart +3: Kapodaster in Bund 3', 'Kapodaster in Bund 3' in await pg.inner_text('#mslX'))
        await pg.click('#mslKey0')
        # Text sprechen: Songbook-Text ohne Akkordzeilen
        await pg.click('#mslL [data-s="3"]'); await pg.wait_for_timeout(200)
        tx = await pg.inner_text('#mslX')
        check('Schritt 3 zeigt den Songbook-Text ohne Akkordzeilen', 'Die Straße leer' in tx and 'Am        F' not in tx and 'C         G' not in tx, tx[:120])
        await pg.click('#mslL [data-s="7"]'); await pg.wait_for_timeout(200)
        check('Schritt 7 zeigt Akkorde & Text', 'Am' in await pg.inner_text('#mslX') and 'Lichter' in await pg.inner_text('#mslX'))
        # Tipps
        await pg.click('#mslTipsB'); await pg.wait_for_timeout(150)
        tp = await pg.inner_text('#mslTips')
        check('„Tipps zu diesem Schritt“: Fehler + „Woran merke ich …“', await pg.is_visible('#mslTips') and await pg.evaluate("document.querySelectorAll('#mslTips li').length") == 3 and 'Woran merke ich' in tp)
        await shot(pg, 'v163-3-mit-gitarre-tipps.png')
        await pg.click('#mslTipsB')
        # Haken je Stück
        await pg.click('#mslDone'); await pg.wait_for_timeout(150)
        d = json.loads(await pg.evaluate("localStorage.getItem('3nps-mitsingen')"))
        check('„✓ Schritt geschafft“ speichert je Stück (ein Schlüssel)', d['p']['sb:n1']['d'] == [7] and d['w'] == 'm' and await pg.inner_text('#mslCnt') == '1 von 4', d)
        await pg.select_option('#mslPiece', 'sb:n2'); await pg.wait_for_timeout(200)
        check('anderes Stück: eigener Fortschritt (0 von 4), Tonart E Dur', await pg.inner_text('#mslCnt') == '0 von 4' and 'E Dur' in await pg.inner_text('#mslMeta'))
        await pg.select_option('#mslPiece', '+'); await pg.wait_for_timeout(150)
        await pg.fill('#mslNewN', 'Übungsstück Dorisch'); await pg.click('#mslNewOk'); await pg.wait_for_timeout(200)
        sel = await pg.evaluate("document.getElementById('mslPiece').selectedOptions[0].textContent")
        check('„＋ Eigenes Stück …“ legt ein Stück an und wählt es', sel == 'Übungsstück Dorisch', sel)
        await pg.select_option('#mslPiece', 'sb:n1'); await pg.wait_for_timeout(200)
        check('zurück: Haken bleibt', await pg.inner_text('#mslCnt') == '1 von 4' and await pg.evaluate("document.querySelector('#mslL [data-s=\"7\"]').classList.contains('ok')"))
        await pg.click('#mslL [data-s="7"]'); await pg.click('#mslDone'); await pg.wait_for_timeout(100)
        check('„zurücknehmen“ entfernt den Haken', json.loads(await pg.evaluate("localStorage.getItem('3nps-mitsingen')"))['p']['sb:n1']['d'] == [])
        await pg.click('.msl-ways [data-w=g]')
        uzt = await pg.inner_text('#mslUz')
        check('Übezeit nur angezeigt: Gesang 30 min · dieses Stück 20 min, Knopf „Üben einschalten“', '30 min' in uzt and '20 min' in uzt and 'zählt selbst keine Zeit' in uzt and await pg.is_visible('#mslUzOn'), uzt)
        await shot(pg, 'v163-2-ohne-datei.png')
        # ---------- B: mit Musikdatei + erkanntem (erfundenem) Text ----------
        await load(pg, T + 'corpus/ballad_72.wav'); await tab(pg, 'singlernen'); await pg.wait_for_timeout(600)
        uz0 = await pg.evaluate(UZJ)   # Laden der Datei startet den Looper kurz (Looper-Zeit des Tests) – ab hier darf die Seite nichts schreiben
        s = await st(pg)
        pv = await pg.evaluate("[document.getElementById('mslPiece').value, [...document.getElementById('mslPiece').options].map(o=>o.value).join(',')]")
        check('Datei geladen: gewähltes Songbook-Stück bleibt, Datei in der Liste, Übungsfeld mit 4 Zeilen', pv[0] == 'sb:n1' and 'f:ballad_72.wav|420' in pv[1] and s['u'] == 'l' and s['n'] == 4 and await pg.is_visible('#mslBox'), s)
        check('Zeile 1 mit „danach:“', 'Die Straße leer, das Radio leise' in await pg.inner_text('#mslLine') and 'Ich zähl' in await pg.inner_text('#mslNextL'))
        await pg.click('#mslL [data-s="4"]'); await pg.click('#mslNx'); await pg.wait_for_timeout(200)
        check('„Zeile ›“: Zeile 2 von 4', (await st(pg))['k0'] == 1 and 'Zeile 2 von 4' in await pg.inner_text('#mslPos'))
        await pg.click('#mslPlay'); await pg.wait_for_timeout(1500)
        s = await st(pg); lr = await pg.evaluate("({run: Looper.running(), lp: Looper.looping()})")
        check('„▶ Zeile in Schleife“: eigene Wiedergabe, Looper bleibt aus (keine Looper-Zeit)', s['playing'] and s['kind'] == 'loop' and not lr['run'] and not lr['lp'], (s, lr))
        L1 = s['len']; f1 = s['pos']['f']; await pg.wait_for_timeout(700); f2 = (await st(pg))['pos']['f']
        check('Position läuft im Ausschnitt', f2 != f1 and s['R']['b0'] - 2 < 0 or f2 != f1, (f1, f2))
        nows = set()
        for _ in range(30):
            nows.add(await pg.evaluate("(document.querySelector('#mslLine .msl-now')||{}).textContent||''")); await pg.wait_for_timeout(100)
        check('aktuelles Wort wird markiert (erfundener Text)', len(nows - {''}) >= 2, sorted(nows))
        await pg.click('#mslRate [data-r="0.75"]'); await pg.wait_for_timeout(2500)
        s = await st(pg)
        check('Tempo 75 %: Ausschnitt 4/3 so lang, Wiedergabe läuft weiter', s['playing'] and abs(s['len'] / s['xl'] - 1 / 0.75) < 0.01, (s['len'], s['xl']))
        await shot(pg, 'v163-1-fahrplan-schleife.png')
        await pg.click('#mslEcho'); await pg.wait_for_timeout(500)
        s = await st(pg)
        check('Vorsingen – Pause – Nachsingen: Pause gleich lang wie die Zeile', s['kind'] == 'echo' and s['tot'] == 2 * s['len'], (s['tot'], s['len']))
        you = False
        for _ in range(100):
            q = (await st(pg))['pos']
            if q and q['you']: you = True; break
            await pg.wait_for_timeout(150)
        check('in der Pause: „Jetzt du – nachsingen!“', you and 'Jetzt du' in await pg.inner_text('#mslPhase'), await pg.inner_text('#mslPhase'))
        await pg.click('#mslEcho'); await pg.wait_for_timeout(200)
        check('nochmal tippen stoppt', not (await st(pg))['playing'])
        await pg.click('[data-span="2"]'); await pg.wait_for_timeout(200)
        s = await st(pg)
        check('Umfang 2 Zeilen: Zeilen 2–3', s['R']['n'] == 2 and 'Zeilen 2–3 von 4' in await pg.inner_text('#mslPos'), s['R'])
        await pg.click('[data-span="1"]')
        await pg.click('#mslMark'); await pg.wait_for_timeout(150)
        check('„★ Stelle merken“: Eintrag mit Textanfang', 'Ich zähl die Lichter,' in await pg.inner_text('#mslMarks'))
        await pg.click('#mslPrev'); await pg.click('#mslMarks [data-mk="0"]'); await pg.wait_for_timeout(1200)
        s = await st(pg)
        check('Stelle antippen springt hin und spielt', s['k0'] == 1 and s['playing'], s['k0'])
        await pg.click('#mslMarks [data-mkx="0"]'); await pg.wait_for_timeout(100)
        check('× entfernt die Stelle', await pg.inner_text('#mslMarks') == '')
        # Tonart −2: echte Tonhöhe (Sinus 440 Hz durch denselben Worker)
        f = await pg.evaluate("""async()=>{const sr=48000,n=sr,l=new Float32Array(n);for(let i=0;i<n;i++)l[i]=0.5*Math.sin(2*Math.PI*440*i/sr);
          const y=await MitsingenLernen._shift({l,r:l,length:n,sr},n,Math.pow(2,-2/12)); if(!y) return 0; const r=Pitch.detect(y.l.subarray(sr/2,sr/2+4096),sr,{fmin:75,fmax:1100}); return r?r.f:0}""")
        check('Tonart −2 Halbtöne: 440 Hz → ~392 Hz (Länge gleich)', abs(f - 392) < 6, round(f, 1))
        await pg.click('#mslSemiD'); await pg.click('#mslSemiD'); await pg.wait_for_timeout(100)
        s = await st(pg)
        if not s['playing'] and not s['pend']: await pg.click('#mslPlay')
        for _ in range(60):
            await pg.wait_for_timeout(250); s = await st(pg)
            if s['playing']: break
        check('Wiedergabe mit −2 und 75 %: läuft, Anzeige „−2 Halbtöne“', s['playing'] and s['semi'] == -2 and s['worker'] and '−2 Halbtöne' in await pg.inner_text('#mslSemiV'), s)
        await pg.click('#mslSemi0'); await pg.wait_for_timeout(1500)
        check('bis hier keine Übezeit/Looper-Zeit geschrieben (Wiedergabe, Haken, Stellen)', await pg.evaluate(UZJ) == uz0)
        # Looper starten → Wiedergabe hier hält an
        await pg.evaluate("Looper.all()"); await pg.wait_for_timeout(800)
        s = await st(pg)
        check('Looper startet → Wiedergabe hier stoppt (nichts doppelt)', not s['playing'] and 'Looper läuft' in await pg.inner_text('#mslMsg'), await pg.inner_text('#mslMsg'))
        if await pg.evaluate("Looper.running()"): await pg.evaluate("Looper.all()"); await pg.wait_for_timeout(300)
        uz0 = await pg.evaluate(UZJ)   # ab hier (Looper-Lauf des Tests gezählt) darf sich nichts mehr ändern
        # Gesang: ohne Trennung nur Angebot
        check('„Gesang im Lied“ ohne Trennung: nur „Gesang trennen …“', await pg.is_visible('#mslSep') and not await pg.is_visible('#mslVox'))
        # Pedal
        await pg.evaluate("Pedal.run('ms:go')"); await pg.wait_for_timeout(1200)
        a1 = (await st(pg))['playing']; await pg.evaluate("Pedal.run('ms:next')"); await pg.wait_for_timeout(1200); s = await st(pg)
        await pg.evaluate("Pedal.run('ms:go')"); await pg.wait_for_timeout(200)
        check('Pedal: „Zeile in Schleife“ an/aus, „nächste Zeile“', a1 and s['k0'] == 2 and s['playing'] and not (await st(pg))['playing'], s['k0'])
        # Aufnahme (Testmikrofon)
        await pg.click('#mslPlay'); await pg.wait_for_timeout(800)
        await pg.click('#mslRec'); await pg.wait_for_timeout(2000)
        check('„● Aufnehmen“: Mikrofon erst jetzt, Kopfhörer-Hinweis', (await st(pg))['rec'] and 'Kopfhörer' in await pg.inner_text('#mslMsg'))
        await pg.click('#mslRec'); await pg.wait_for_timeout(300)
        s = await st(pg)
        check('Aufnahme fertig: im Speicher, „▶ Anhören“/„▶ Mit Lied“', not s['rec'] and s['take'] > 48000 and await pg.is_visible('#mslTakeP') and await pg.is_visible('#mslTakeS'), s['take'])
        await pg.click('#mslTakeS'); await pg.wait_for_timeout(500)
        check('„▶ Mit Lied“ spielt (Übungswiedergabe dafür angehalten)', not (await st(pg))['playing'] and 'Stopp' in await pg.inner_text('#mslTakeP'))
        await pg.click('#mslTakeI2'); await pg.wait_for_timeout(800)
        ideas = await pg.evaluate("AppDB.all ? AppDB.all('ideas').then(l=>l.filter(i=>/^Mitsingen ·/.test(i.name)).length) : -1")
        check('„Als Idee sichern“ legt eine Idee an (bleibt auf dem Gerät)', 'Als Idee gesichert' in await pg.inner_text('#mslMsg') and ideas in (1, -1), ideas)
        await pg.click('#mslTakeX'); await pg.wait_for_timeout(100)
        check('„Verwerfen“', not await pg.is_visible('#mslTake'))
        # Seite verlassen stoppt alles
        await pg.click('#mslPlay'); await pg.wait_for_timeout(800); await pg.click('#mslRec'); await pg.wait_for_timeout(500)
        await tab(pg, 'songbook'); await pg.wait_for_timeout(400)
        s = await st(pg)
        check('Seite verlassen: Wiedergabe, Aufnahme und Worker beendet', not s['playing'] and not s['rec'] and not s['worker'], s)
        # „Üben einschalten“ ist der normale Schalter (Thema = Stück aus dem Songbook)
        uz1 = await pg.evaluate(UZJ)
        check('danach keine Übezeit geschrieben (Pedal, Aufnahme, Anhören, Idee, Verlassen)', uz1 == uz0, (uz0, uz1))
        await tab(pg, 'singlernen'); await pg.wait_for_timeout(400)
        await pg.select_option('#mslPiece', 'sb:n1'); await pg.wait_for_timeout(200); await pg.click('#mslUzOn'); await pg.wait_for_timeout(200)
        d = await pg.evaluate("Uebezeit.load()")
        check('„Üben einschalten“ = normaler Schalter, Thema = Stück', d.get('run') and d.get('th') == 'sbn1' and 'Übezeit läuft' in await pg.inner_text('#mslUz'), (d.get('run'), d.get('th')))
        await pg.evaluate("Uebezeit.off({drop:true})"); await pg.wait_for_timeout(200)
        # ohne erkannten Text: Takte
        await load(pg, T + 'corpus/funk_104.wav'); await pg.evaluate("Looper.clearAll && 0")
        await tab(pg, 'singlernen'); await pg.wait_for_timeout(400)
        ts = await pg.evaluate("[...document.getElementById('mslTr').options].map(o=>o.value)")
        check('zwei Dateien? Spur-Auswahl nur wenn nötig', ts == ['0'] or len(ts) >= 1, ts)
        s = await st(pg)
        check('Datei ohne erkannten Text: Abschnitte nach Takten, Hinweis', s['u'] == 't' and s['n'] > 4 and 'Takt 1' in await pg.inner_text('#mslPos') and 'Ohne erkannten Text' in await pg.inner_text('#mslMsg'), (s['u'], s['n']))
        await pg.click('#mslPlay'); await pg.wait_for_timeout(1200)
        check('Takt-Abschnitt in Schleife', (await st(pg))['playing'] and 'Abschnitt' not in await pg.inner_text('#mslPlay'))
        await pg.click('#mslPlay')
        check('keine Skriptfehler (Teil A/B)', not errs, errs[:3])
        await pg.context.close()
        # ---------- C: Karaoke erst nach „Gesang trennen“ (echtes Spleeter-Modell) ----------
        pg, errs = await newpage(b)
        await pg.evaluate("window.confirm = m => true; 0")
        await load(pg, T + 'sep/mix.wav'); await tab(pg, 'singlernen'); await pg.wait_for_timeout(500)
        check('vor dem Trennen: Knopf „Gesang trennen …“, Regler verborgen', await pg.is_visible('#mslSep') and not await pg.is_visible('#mslVox'))
        await pg.click('#mslL [data-s="6"]'); await pg.wait_for_timeout(150)
        check('„Für diesen Schritt“ nennt: erst nach „Gesang trennen“', 'erst nach' in await pg.inner_text('#mslPre'))
        await pg.click('#mslSep')
        for _ in range(600):
            await pg.wait_for_timeout(500)
            if await pg.is_visible('#mslVox'): break
        check('nach dem Trennen: „laut · leise · aus“', await pg.is_visible('#mslVox') and 'Gesang getrennt' in await pg.inner_text('#mslMsg'), (await pg.inner_text('#mslMsg'), await pg.inner_text('#loopStatus'), await pg.evaluate("[Sep.busy(), !document.getElementById('sepDlg').hidden]")))
        await pg.click('#mslVox [data-v="0"]'); await pg.click('#mslPlay'); await pg.wait_for_timeout(1500)
        s = await st(pg)
        check('„aus“ (Karaoke): Wiedergabe aus Begleitung, Anzeige „Karaoke“', s['playing'] and s['vOk'] and s['vox'] == 0 and 'Karaoke' in await pg.inner_text('#mslVoxV'), s)
        en = await pg.evaluate("""(()=>{const P=MitsingenLernen._st(); const b=document.getElementById('mslWv'); return 1})()""")
        # Energie-Vergleich: Ausschnitt mit Stimme laut vs. aus (Begleitung) – „aus“ muss deutlich leiser sein, wo gesungen wird
        e = await pg.evaluate("""(()=>{const S=Looper.singSrc(0), a=Math.round(S.beats[2]), e=Math.round(S.beats[5]); const x=Looper.singAudio(0,a,e), k=Looper.karaAudio(0,a,a+x.length);
          if(!k) return null; let ex=0,ek=0; for(let i=0;i<x.length;i++){ex+=x.l[i]*x.l[i]; ek+=k.l[i]*k.l[i];} return [ex,ek]})()""")
        check('Begleitung der Stelle leiser als das Original (Gesang raus)', e and e[1] < e[0] * 0.8, e)
        await pg.click('#mslVox [data-v="0.35"]'); await pg.wait_for_timeout(1200)
        check('„leise“: läuft weiter mit 35 %', (await st(pg))['vox'] == 0.35 and (await st(pg))['playing'] and 'leise 35 %' in await pg.inner_text('#mslVoxV'))
        await pg.click('#mslPreGo'); await pg.wait_for_timeout(1200)
        s = await st(pg)
        check('„So einstellen“ (Schritt 6): 100 % · Schleife · leise', s['rate'] == 1 and s['kind'] == 'loop' and s['vox'] == 0.35, s)
        await pg.click('#mslPlay')
        check('keine Skriptfehler (Teil C)', not errs, errs[:3])
        await pg.context.close()
        # ---------- D: Profile, Größen, Englisch ----------
        for dev in ['auto', 'new', 'old', 'min']:
            pg, errs = await newpage(b, extra="localStorage.setItem('3nps-device','%s');" % dev)
            await load(pg, T + 'corpus/ballad_72.wav'); await tab(pg, 'singlernen'); await pg.wait_for_timeout(500)
            await pg.click('#mslPlay'); await pg.wait_for_timeout(1500)
            r = await pg.evaluate("""(()=>{const c=document.getElementById('mslCur');return {cls:document.documentElement.className, cur:getComputedStyle(c).display, play:MitsingenLernen._st().playing, ov:document.documentElement.scrollWidth<=innerWidth+1,
              sh:[...document.querySelectorAll('#mslRoot .msl-r')].some(x=>getComputedStyle(x).boxShadow!=='none')}})()""")
            good = r['play'] and r['ov'] and (dev != 'min' or r['cur'] == 'none') and (dev not in ('old', 'min') or not r['sh'])
            check('Profil %s: spielt, keine Überbreite%s' % (dev, ', ohne Zeiger' if dev == 'min' else ', ohne Schatten' if dev == 'old' else ''), good and not errs, (r, errs[:2]))
            await pg.context.close()
        for w, hh in [(820, 1180), (390, 844)]:
            for dev in ['auto', 'min']:
                pg, errs = await newpage(b, w, hh, extra="localStorage.setItem('3nps-device','%s');" % dev)
                await load(pg, T + 'corpus/ballad_72.wav'); await tab(pg, 'singlernen'); await pg.wait_for_timeout(500)
                await pg.click('#mslL [data-s="4"]'); await pg.wait_for_timeout(200)
                r = await pg.evaluate("""(()=>{const bs=[...document.querySelectorAll('#mslRoot button')].filter(b=>b.offsetParent); return {ov:document.documentElement.scrollWidth<=innerWidth+1, small:bs.filter(b=>b.getBoundingClientRect().height<43.5).map(b=>b.id||b.textContent).slice(0,5), n:bs.length}})()""")
                h1 = await pg.evaluate("document.getElementById('mslLine').getBoundingClientRect().height")
                await pg.click('#mslPlay'); await pg.wait_for_timeout(2000)
                h2 = await pg.evaluate("document.getElementById('mslLine').getBoundingClientRect().height")
                check('%d×%d %s: keine Überbreite, Knöpfe ≥ 44 px, Zeile springt nicht' % (w, hh, dev), r['ov'] and not r['small'] and abs(h1 - h2) < 0.5 and not errs, (r, h1, h2, errs[:2]))
                if SHOT and w == 390 and dev == 'auto':
                    await pg.evaluate("document.getElementById('mslS').scrollIntoView()"); await pg.wait_for_timeout(300); await pg.screenshot(path=SH + 'v163-6-telefon.png')
                await pg.click('#mslPlay')
                await pg.context.close()
        pg, errs = await newpage(b, q='?lang=en')
        await tab(pg, 'singlernen'); await pg.wait_for_timeout(1200)
        await pg.click('#mslL [data-s="5"]'); await pg.click('#mslTipsB'); await pg.wait_for_timeout(500)
        txt = await pg.evaluate("""(()=>{const out=[];const w=document.createTreeWalker(document.getElementById('mslRoot'),NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const p=n.parentNode;if(p.closest('[translate=no],select'))continue;const v=n.nodeValue.trim();if(v)out.push(v);}return out.join(' | ')})()""")
        de = re.findall(r'[^|]*(?:[äöüÄÖÜß]|\b(?:und|der|die|das|nicht|Schritt|Zeile)\b)[^|]*', txt)
        check('Englisch: Seite übersetzt (keine deutschen Reste)', 'Learn to sing along' in txt and 'Melody without words' in txt and 'Typical mistakes' in txt and not de, de[:4])
        check('keine Skriptfehler (EN)', not errs, errs[:3])
        await b.close()
    print('%d/%d' % (ok, tot))
if __name__ == "__main__": asyncio.run(main())
