# v167: „Songtext schreiben“ ins Songwriting zusammengelegt + vier Ergänzungen. Prüft: Bau/Nachladen (index.html < 2,1 MB, songwriting.js/.css,
# silbenraster.js in der Offline-Liste, erst beim Öffnen geladen), Leiste mit 5 Bereichen (Code je Bereich erst beim ersten Öffnen, Bereich gemerkt),
# EINE Songauswahl wirkt überall (Workflow, Text-Werkstatt, Raster), Weiterleitung aller alten Wege (Route/Hash/gemerkter Reiter/Kachel-Merker/Hilfe/
# Knopf „Text-Werkstatt“/Sprünge aus dem Workflow), Datenübernahme v165/v166 („3nps-songtext“), Stand + Songliste (Filter, Auswahl), Summ-Idee je
# Abschnitt mit Fake-Mikrofon (aufnehmen/abspielen/löschen, IndexedDB „meta“, 16 kHz, in „Alles sichern“), Silben-Raster (Silben, Betonung, Hinweise,
# Verschieben, Takte, gemerkt), „Ins Songbook übernehmen“ (Rückfrage beim Aktualisieren), Profile, 3 Größen, EN, Übezeit unverändert, keine Skriptfehler.
# Aufruf: python3 test/v167songwriting.py  (~3 min). SHOT=1 → Bilder nach /home/claude/bilder/v167-*.png
import asyncio, json, os, re
from playwright.async_api import async_playwright
from nav import tab
U = 'http://localhost:8765/index.html'; WWW = os.path.dirname(os.path.abspath(__file__)) + '/../app/www/'
SHOT = os.environ.get('SHOT'); SH = '/home/claude/bilder/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''), flush=True)
# erfundene Songs (keine echten Liedtexte)
def ch(r, t=''): return {"r": r, "t": t, "beats": 4}
NACHT = {"id": "sN", "name": "Nachtfahrt", "created": 1, "voice": None, "cur": 0, "versions": [{"n": 1, "at": 1764200000000, "note": "Start", "key": {"pc": 9, "major": False}, "bpm": 92, "theme": "",
    "parts": [{"id": "pv", "name": "Strophe", "type": "verse", "chords": [ch(9, 'm'), ch(5), ch(0), ch(7)], "audio": None, "lyrics": ["Die Straße leer, das Radio leise\nich zähl die Lichter auf der Reise"]},
              {"id": "pc", "name": "Refrain", "type": "chorus", "chords": [ch(5), ch(0), ch(7), ch(9, 'm')], "audio": None, "lyrics": ["Nachtfahrt, nur der Motor singt\nNachtfahrt, bis der Morgen klingt"]},
              {"id": "pb", "name": "Bridge", "type": "bridge", "chords": [ch(2, 'm'), ch(4)], "audio": None, "lyrics": []}],
    "order": [{"p": "pv", "reps": 1}, {"p": "pc", "reps": 1}, {"p": "pb", "reps": 1}, {"p": "pc", "reps": 1}]}]}
LEER = {"id": "sL", "name": "Staub und Sterne", "created": 2, "voice": None, "cur": 0, "versions": [{"n": 1, "at": 1764100000000, "note": "Start", "key": {"pc": 7, "major": True}, "bpm": 100, "parts": [], "order": []}]}
KAFFEE = {"id": "sK", "name": "Kaffee kalt", "created": 3, "voice": None, "cur": 0, "stand": "entwurf", "versions": [{"n": 1, "at": 1764000000000, "note": "Start", "key": {"pc": 2, "major": True}, "bpm": 76,
    "parts": [{"id": "k1", "name": "Strophe", "type": "verse", "chords": [ch(2), ch(7), ch(9), ch(2)], "audio": None, "lyrics": ["Der Becher steht seit gestern da"]}], "order": [{"p": "k1", "reps": 2}]}]}
LIED = {"active": "sN", "songs": [NACHT, LEER, KAFFEE]}
# Stand von v165/v166 auf Toms Gerät (Haken je Song, Kernsatz, Wortfeld, Notizen, „ohne Song“, Bereich Leitfaden)
ST = {"v": 1, "cur": "l:sN", "view": "lf", "p": {"l:sN": {"n": "Nachtfahrt", "d": [1, 2, 3], "s": 3, "k": "Eine Fahrt durch die Nacht, die nichts klärt.", "h": "Nachtfahrt", "wf": {"t": "Nacht", "w": ["Tankstelle", "Funkloch"]}, "c": [], "e": 1764210000000},
      "_": {"n": "", "d": [1], "s": 1, "k": "Allgemeiner Kern", "h": "", "wf": {"t": "", "w": []}, "c": [], "e": 1}},
      "n": [{"id": "n1", "x": "Kreidestriche, halb vom Regen weg", "k": "b", "g": ["stadt"], "at": 1764000000000}, {"id": "n2", "x": "Der Bahnsteig gähnt", "k": "z", "g": [], "at": 1764000100000}]}
UZ = json.dumps({"v": 1, "u": [[1764000000, 1800, 1, "ges"]]})
def init(extra='', lied=None, st=ST):
    return "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-lieder',%s);localStorage.setItem('3nps-songtext',%s);localStorage.setItem('3nps-uebezeit',%s);%s}" % (
        json.dumps(json.dumps(lied or LIED)), json.dumps(json.dumps(st)), json.dumps(UZ), extra)
async def newpage(b, w=1366, h=1024, extra='', q='', lied=None):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True, permissions=['microphone']); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script("window.__gum=0;try{const o=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=c=>{window.__gum++;return o(c)}}catch(e){}")
    await pg.add_init_script(init(extra, lied)); await pg.goto(U + q); await pg.wait_for_timeout(900)
    return pg, errs
async def shot(pg, n, sel=None):
    if not SHOT: return
    os.makedirs(SH, exist_ok=True); await pg.wait_for_timeout(300)
    if sel: await pg.evaluate("document.querySelector(%s).scrollIntoView({block:'start'})" % json.dumps(sel)); await pg.evaluate("scrollBy(0,-110)"); await pg.wait_for_timeout(250)
    await pg.screenshot(path=SH + n)
async def waitfor(pg, js, ms=8000):
    for _ in range(ms // 100):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(100)
    return False
LS = lambda k: "JSON.parse(localStorage.getItem('%s')||'null')" % k
SWA = "document.getElementById('panel-lied').dataset.sw"
async def area(pg, a): await pg.click('#swNav [data-sw=%s]' % a); await pg.wait_for_timeout(250)
async def lied(pg): await tab(pg, 'lied'); await waitfor(pg, "!!window.SW"); await pg.wait_for_timeout(250)
async def song(pg, sid): return await pg.evaluate("(" + LS('3nps-lieder') + ").songs.find(s=>s.id==='%s')" % sid)
res = lambda pg: pg.evaluate("performance.getEntriesByType('resource').map(r=>r.name.split('/').pop().split('?')[0]).filter(n=>/songwriting\\.|silbenraster|songtext\\.|textwerk\\.|mitsingen\\./.test(n))")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        # ---------- A: Bau, Nachladen ----------
        h = open(WWW + 'index.html', encoding='utf8').read(); sw = open(WWW + 'sw.js', encoding='utf8').read()
        check('index.html < 2,1 MB, ohne Bereichs-Code', len(h.encode()) < 2100000 and 'window.SW =' not in h and 'window.SilbenRaster' not in h and 'window.Songtext =' not in h, len(h.encode()))
        core = sw.split('const CORE')[1].split('\n')[0]
        check('sw.js: songwriting.js/.css + silbenraster.js offline, Cache ab v167', all("'%s'" % f in core for f in ['songwriting.js', 'songwriting.css', 'silbenraster.js', 'songtext.js', 'songtext.css', 'songtext-beispiel.js']) and int(re.search(r"3nps-v(\d+)", sw).group(1)) >= 167)
        pg, errs = await newpage(b)
        check('ab v167', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 167)
        check('Start lädt nichts davon', await res(pg) == [] and not await pg.evaluate("!!window.SW"))
        # ---------- B: Leiste, Bereiche ----------
        await lied(pg)
        r = await res(pg)
        check('Songwriting öffnen lädt songwriting.js/.css, sonst nichts', 'songwriting.js' in r and 'songwriting.css' in r and not any(x in r for x in ['songtext.js', 'textwerk.js', 'silbenraster.js']), r)
        nav = await pg.evaluate("[...document.querySelectorAll('#swNav [data-sw]')].map(b=>b.textContent)")
        check('Leiste: Song · Text-Werkstatt · Workflow · Leitfaden & Beispiel · Ideen', nav == ['Song', 'Text-Werkstatt', 'Workflow', 'Leitfaden & Beispiel', 'Ideen'], nav)
        check('Bereich „Song“: alle bisherigen Karten sichtbar, Leiste unter der Songauswahl', await pg.evaluate(SWA) == 'song' and all([await pg.is_visible(x) for x in ['#ldOrderCard', '#ldPartsCard', '#ldTextCard', '#ldCheckCard', '#ldVoiceCard', '#ldAiCard', '#ldMain']])
              and await pg.evaluate("document.getElementById('swBar').getBoundingClientRect().top > document.getElementById('ldSong').getBoundingClientRect().bottom"))
        kt = [await pg.inner_text(x) for x in ['#swKw', '#swKt', '#swKa', '#swKsV']]
        check('Stand-Kacheln: Workflow 3/11 (aus v165), Abschnitte mit Text 2/3, Akkorde ✓, Stand Idee', kt == ['3/11', '2/3', '✓', 'Idee'], kt)
        if SHOT: await shot(pg, 'v167-1-songwriting.png')
        await area(pg, 'wf'); await waitfor(pg, "!!(window.Songtext && Songtext.built())")
        r = await res(pg)
        check('„Workflow“ lädt songtext.js + mitsingen.css (Werkstatt noch nicht), Song-Karten weg', 'songtext.js' in r and 'mitsingen.css' in r and 'textwerk.js' not in r and not await pg.is_visible('#ldOrderCard') and not await pg.is_visible('#ldMain') and await pg.is_visible('#stxWf') and await pg.is_visible('#swBar'), r)
        check('eigene Songwahl und innere Leiste von „Songtext schreiben“ ausgeblendet', not await pg.is_visible('#stxSong') and not await pg.is_visible('.stx-nav'))
        # ---------- E: Datenübernahme v165/v166 ----------
        st = await pg.evaluate("Songtext._st()")
        check('Daten v165: Haken des Songs (3 von 11), letzter Schritt 3, Kernsatz/Wortfeld da', await pg.inner_text('#stxCnt') == '3 von 11' and st['sel'] == 3 and st['cur'] == 'l:sN' and 'Tankstelle' in await pg.inner_text('#stxX'), st)
        await pg.click('#stxL [data-s="1"]'); await pg.wait_for_timeout(150)
        check('Kernsatz aus v165 im Schritt 1', 'Eine Fahrt durch die Nacht' in await pg.input_value('#stxKern'))
        await area(pg, 'nb')
        check('„Ideen“: Notizbuch mit den 2 alten Notizen + Schreibimpulse', await pg.evaluate("document.querySelectorAll('#stxNbL .stx-ni').length") == 2 and await pg.is_visible('.stx-impc') and await pg.is_visible('#stxNb'))
        await area(pg, 'lf')
        check('„Leitfaden & Beispiel“: 11 Themen + „📖 Beispiel ansehen“ + „Beispiel als Song laden“', await pg.evaluate("document.querySelectorAll('#stxLf .stx-th').length") == 11 and await pg.is_visible('#stxLf [data-a=exAllLf]') and await pg.is_visible('#stxLf [data-a=exSong]'))
        await pg.click('#stxLf [data-a=exAllLf]'); await waitfor(pg, "document.querySelectorAll('#stxExW .stb-sec').length==11")
        check('Beispiel im Leitfaden: alle 11 Schritte unter dem Leitfaden', await pg.is_visible('#stxExW') and await pg.evaluate("document.getElementById('stxLf').nextElementSibling.id") == 'stxExW')
        await pg.click('#stxLf [data-a=exAllLf]'); await pg.wait_for_timeout(100)
        d = await pg.evaluate(LS('3nps-songtext'))
        check('Speicher „3nps-songtext“ unverändert weiterverwendet (alte Einträge, auch „ohne Song“, da)', d['p']['l:sN']['d'] == [1, 2, 3] and d['p']['_']['k'] == 'Allgemeiner Kern' and len(d['n']) == 2)
        await area(pg, 'tw'); await waitfor(pg, "!!(window.TextWerk && document.querySelector('#twBody') && window.SilbenRaster)")
        r = await res(pg)
        check('„Text-Werkstatt“ lädt textwerk.js + silbenraster.js; Text und „Mit Claude“ bleiben daneben', 'textwerk.js' in r and 'silbenraster.js' in r and await pg.is_visible('#ldTwBox') and await pg.is_visible('#ldTextCard') and await pg.is_visible('#ldAiCard') and not await pg.is_visible('#ldOrderCard'), r)
        await area(pg, 'nb'); await pg.reload(); await pg.wait_for_timeout(900); await lied(pg); await waitfor(pg, "!!(window.Songtext && Songtext.built())")
        check('gewählter Bereich wird gemerkt (nach Neuladen „Ideen“)', await pg.evaluate(SWA) == 'nb' and await pg.is_visible('#stxNb') and (await pg.evaluate(LS('3nps-sw')))['a'] == 'nb')
        check('„?“ öffnet passendes Thema (Ideen → songtext-schreiben, Song → songwriting)', await pg.evaluate("AppNav.HELP.lied") == 'songtext-schreiben')
        # ---------- C: eine Songauswahl für alles ----------
        await area(pg, 'wf'); await pg.select_option('#ldSong', 'sK'); await pg.wait_for_timeout(350)
        st = await pg.evaluate("Songtext._st()")
        check('Songwechsel oben → Workflow zeigt den neuen Song (0 von 11, Meta)', st['cur'] == 'l:sK' and await pg.inner_text('#stxCnt') == '0 von 11' and '1 Abschnitte' in await pg.inner_text('#stxMeta'), (st['cur'], await pg.inner_text('#stxMeta')))
        await pg.click('#stxL [data-s="6"]'); await pg.click('#stxDone'); await pg.wait_for_timeout(200)
        d = await pg.evaluate(LS('3nps-songtext'))
        check('Haken bleiben an der Song-Id (sK: 6, sN: 1 2 3)', d['p']['l:sK']['d'] == [6] and d['p']['l:sN']['d'] == [1, 2, 3] and await pg.inner_text('#swKw') == '1/11', await pg.inner_text('#swKw'))
        await area(pg, 'tw'); await pg.wait_for_timeout(300)
        rs = await pg.evaluate("SilbenRaster._st()")
        check('Text-Werkstatt + Raster arbeiten mit demselben Song', 'Becher' in await pg.inner_text('#twBody') and rs and rs['key'].startswith('sK|'), rs and rs['key'])
        await pg.select_option('#ldSong', 'sN'); await pg.wait_for_timeout(400)
        rs = await pg.evaluate("SilbenRaster._st()")
        check('…und ziehen beim Wechsel mit (Nachtfahrt)', 'Radio' in await pg.inner_text('#twBody') and rs['key'].startswith('sN|'), rs['key'])
        # ---------- D: Weiterleitung alter Wege ----------
        await pg.click('#swNav [data-sw=song]'); await pg.click('#ldTw'); await pg.wait_for_timeout(300)
        check('Knopf „Text-Werkstatt“ in der Karte „Text“ springt in den Bereich', await pg.evaluate(SWA) == 'tw' and await pg.is_visible('#twBody'))
        await tab(pg, 'looper'); await pg.evaluate("AppNav.show('songtext')"); await waitfor(pg, "!!(window.Songtext && Songtext.built())"); await pg.wait_for_timeout(200)
        check('alte Route „songtext“ → Songwriting › Workflow', await pg.evaluate("AppNav.current()") == 'lied' and await pg.evaluate(SWA) == 'wf' and await pg.is_visible('#stxWf'))
        await pg.click('#stxL [data-s="8"]'); await pg.click('#stxTools [data-go="tw:akk"]'); await waitfor(pg, "!!document.querySelector('#ldTwBox [data-pane=akk].active')")
        check('Workflow-Sprung „Text-Werkstatt: Akkorde nach Stimmung“ → Bereich Text-Werkstatt, Reiter richtig', await pg.evaluate(SWA) == 'tw' and await pg.evaluate("!!document.querySelector('#ldTwBox [data-pane=akk].active')"))
        await area(pg, 'wf'); await pg.click('#stxL [data-s="5"]'); await pg.click('#stxTools [data-go=text]'); await pg.wait_for_timeout(400)
        check('Workflow-Sprung „Text im Songwriting“ → Bereich Song, Karte Text', await pg.evaluate(SWA) == 'song' and await pg.is_visible('#ldTextCard'))
        await area(pg, 'wf'); await pg.click('#stxL [data-s="11"]'); await pg.click('#stxTools [data-go=singlernen]'); await pg.wait_for_timeout(1200)
        check('Sprung „Mitsingen lernen“ bleibt', await pg.evaluate("AppNav.current()") == 'singlernen')
        mjs = open(WWW + 'mitsingen.js', encoding='utf8').read() + open(WWW + 'songbook.js', encoding='utf8').read() + open(WWW + 'hilfe-daten.js', encoding='utf8').read()
        check('keine Sprünge mehr auf den alten Reiter (Mitsingen lernen, Songbook, Hilfe)', "show('songtext')" not in mjs and 'Lernen › „Songtext schreiben“' not in mjs)
        await pg.context.close()
        for nm, ex, q in [('gemerkter Reiter „songtext“ (Tom)', "localStorage.setItem('3nps-tab','songtext');localStorage.setItem('3nps-tab-last',JSON.stringify({lernen:'songtext',tile:'songtext',gesang:'lied'}));", ''), ('Adresse #songtext', '', '#songtext')]:
            pg, errs = await newpage(b, extra=ex, q=q); await waitfor(pg, "!!(window.Songtext && Songtext.built())")
            okk = await pg.evaluate("AppNav.current()") == 'lied' and await pg.evaluate(SWA) == 'wf'
            await pg.click('#area-lernen'); await pg.wait_for_timeout(300)
            check(nm + ' → Songwriting › Workflow; „Lernen“ zeigt danach die Übersicht', okk and await pg.evaluate("AppNav.current()") == 'lernen' and not errs, (await pg.evaluate("AppNav.current()"), errs[:2]))
            await pg.context.close()
        # ---------- F: Stand + Songliste ----------
        pg, errs = await newpage(b); await lied(pg); await area(pg, 'song')
        await pg.click('#swKs'); await pg.wait_for_timeout(150); a1 = await pg.inner_text('#swKsV'); await pg.click('#swKs'); await pg.wait_for_timeout(150); a2 = await pg.inner_text('#swKsV')
        check('Stand antippen: Idee → Entwurf → fertig, im Song gespeichert', a1 == 'Entwurf' and a2 == 'fertig' and (await song(pg, 'sN'))['stand'] == 'fertig', (a1, a2))
        await pg.click('#swListB'); await pg.wait_for_timeout(200)
        rows = await pg.evaluate("[...document.querySelectorAll('#swList .sw-row')].map(r=>r.textContent)")
        check('Songliste: alle Songs mit Stand, Workflow, Tonart, zuletzt geändert', len(rows) == 3 and any('Nachtfahrt' in x and 'fertig' in x and 'Workflow 3/11' in x and 'geändert' in x for x in rows) and any('Kaffee kalt' in x and 'Entwurf' in x for x in rows), rows)
        check('Songliste nennt die Tonart (a-Moll / D-Dur)', any('Nachtfahrt' in x and re.search(r'(?i)a.?moll|am\b', x) for x in rows) and any('Kaffee' in x and re.search(r'(?i)d.?dur|\bD\b', x) for x in rows), rows)
        if SHOT: await shot(pg, 'v167-2-songliste.png')
        await pg.click('#swList [data-f=entwurf]'); await pg.wait_for_timeout(150)
        rows = await pg.evaluate("[...document.querySelectorAll('#swList .sw-row')].map(r=>r.dataset.id)")
        check('Filter „Entwurf“ zeigt nur Kaffee kalt', rows == ['sK'], rows)
        await pg.click('#swList .sw-row[data-id=sK]'); await pg.wait_for_timeout(300)
        check('Antippen wählt den Song oben (und klappt zu)', await pg.evaluate("document.getElementById('ldSong').value") == 'sK' and await pg.is_hidden('#swList') and await pg.inner_text('#swKsV') == 'Entwurf')
        check('Filter gemerkt', (await pg.evaluate(LS('3nps-sw')))['f'] == 'entwurf')
        # ---------- I: Ins Songbook übernehmen ----------
        await pg.select_option('#ldSong', 'sN'); await pg.wait_for_timeout(200)
        await pg.click('#swSb'); ok_sb = await waitfor(pg, "(()=>{const d=JSON.parse(localStorage.getItem('3nps-songbook')||'null');return !!(d&&d.s&&d.s.some(x=>x.id==='ltsN'))})()"); await pg.wait_for_timeout(300)
        sb = await pg.evaluate(LS('3nps-songbook')); it = [x for x in sb['s'] if x['id'] == 'ltsN'][0]
        check('„Ins Songbook übernehmen“ neben der Songauswahl: Stück mit Titel, Tempo, Akkorden, gewählt', ok_sb and await pg.evaluate("AppNav.current()") == 'songbook' and it['t'] == 'Nachtfahrt' and it['b'] == 92 and 'Am' in it['x'] and sb['sel'] == 'ltsN')
        await pg.evaluate("window.__q='';window.confirm=m=>{window.__q=m;return false};0"); await lied(pg); await pg.click('#swSb'); await pg.wait_for_timeout(1500)
        check('zweites Mal: gleiche Rückfrage wie Schritt 11, kein zweites Stück', 'schon im Songbook' in await pg.evaluate("window.__q") and len([x for x in (await pg.evaluate(LS('3nps-songbook')))['s'] if x['id'] == 'ltsN']) == 1)
        await lied(pg); await pg.select_option('#ldSong', 'sL'); await pg.wait_for_timeout(200); await pg.click('#swSb'); await pg.wait_for_timeout(300)
        check('Song ohne Abschnitte: Hinweis statt Sprung', await pg.evaluate("AppNav.current()") == 'lied' and 'keine Abschnitte' in await pg.inner_text('#ldStatus'))
        await pg.select_option('#ldSong', 'sN'); await pg.wait_for_timeout(200)
        # ---------- G: Summ-Idee (Fake-Mikrofon) ----------
        hb = await pg.evaluate("[...document.querySelectorAll('#ldTexts .ld-tx')].map(b=>b.dataset.id+':'+b.dataset.n+':'+((b.querySelector('.sw-hum')||{}).textContent||''))")
        check('„● Idee summen“ je Abschnitt in der Karte „Text“ (einmal je Abschnitt)', hb == ['pv:0:● Idee summen', 'pc:0:● Idee summen', 'pb:0:● Idee summen'], hb)
        check('vor dem Antippen kein Mikrofon-Zugriff', await pg.evaluate("window.__gum") == 0)
        await pg.click('#ldTexts .ld-tx[data-id=pv] [data-h=rec]'); okr = await waitfor(pg, "SW._st().rec", 5000)
        hint = await pg.inner_text('#ldStatus')
        await pg.wait_for_timeout(1600)
        check('Aufnahme läuft (Mikrofon erst jetzt): Kopfhörer-Hinweis, Knopf „■ Stopp · s“', okr and await pg.evaluate("window.__gum") >= 1 and 'Kopfhörer' in hint and 'Stopp' in await pg.inner_text('#ldTexts .ld-tx[data-id=pv] .sw-hum'), hint)
        await pg.click('#ldTexts .ld-tx[data-id=pv] [data-h=stop]'); await pg.wait_for_timeout(500)
        rec = await pg.evaluate("AppDB.get('meta','lied-hum:sN:pv').then(r=>r?{sr:r.sr,n:r.n,t:r.l.constructor.name,b:r.l.byteLength}:null)")
        idx = (await pg.evaluate(LS('3nps-sw')))['h']
        check('gespeichert in IndexedDB „meta“ (lied-hum:sN:pv), 16 kHz, 16 Bit, Index in „3nps-sw“', rec and rec['sr'] == 16000 and rec['t'] == 'Int16Array' and 1.0 * 16000 < rec['n'] < 3.5 * 16000 and 'sN:pv' in idx and idx['sN:pv']['s'] > 1, (rec, idx))
        check('nach dem Stopp: Mikrofon wieder frei, Meldung, „▶ … s“ + „Löschen“', not await pg.evaluate("SW._st().rec") and 'gespeichert' in await pg.inner_text('#ldStatus') and await pg.is_visible('#ldTexts .ld-tx[data-id=pv] [data-h=play]') and await pg.is_visible('#ldTexts .ld-tx[data-id=pv] [data-h=del]'))
        await pg.click('#ldTexts .ld-tx[data-id=pv] [data-h=play]'); await pg.wait_for_timeout(300)
        pl = await pg.evaluate("SW._st().play"); pt = await pg.inner_text('#ldTexts .ld-tx[data-id=pv] [data-h=play]')
        await pg.click('#ldTexts .ld-tx[data-id=pv] [data-h=play]'); await pg.wait_for_timeout(150)
        check('▶ spielt ab (■ während des Abspielens), nochmal = Stopp', pl and pt.startswith('■') and not await pg.evaluate("SW._st().play"), pt)
        bk = await pg.evaluate("AppDB.all('meta').then(a=>a.map(x=>x.key))")
        check('„Alles sichern“ nimmt die Summ-Idee mit (ganzer Store „meta“ + Schlüssel „3nps-sw“)', 'lied-hum:sN:pv' in bk and await pg.evaluate("Object.keys(localStorage).includes('3nps-sw')"))
        await pg.evaluate("localStorage.removeItem('x')"); await pg.reload(); await pg.wait_for_timeout(900); await lied(pg); await area(pg, 'song')
        check('nach Neuladen weiter da', await pg.is_visible('#ldTexts .ld-tx[data-id=pv] [data-h=play]'))
        if SHOT: await shot(pg, 'v167-5-summidee.png', '#ldTextCard')
        await pg.evaluate("window.confirm=()=>false;0"); await pg.click('#ldTexts .ld-tx[data-id=pv] [data-h=del]'); await pg.wait_for_timeout(200)
        k1 = await pg.evaluate("AppDB.get('meta','lied-hum:sN:pv').then(r=>!!r)")
        await pg.evaluate("window.__q='';window.confirm=m=>{window.__q=m;return true};0"); await pg.click('#ldTexts .ld-tx[data-id=pv] [data-h=del]'); await pg.wait_for_timeout(300)
        k2 = await pg.evaluate("AppDB.get('meta','lied-hum:sN:pv').then(r=>!!r)")
        check('Löschen nur nach Rückfrage, dann aus IndexedDB und Index weg', k1 and not k2 and 'Strophe' in await pg.evaluate("window.__q") and 'sN:pv' not in (await pg.evaluate(LS('3nps-sw')))['h'] and await pg.is_visible('#ldTexts .ld-tx[data-id=pv] [data-h=rec]'))
        await pg.click('#ldTexts .ld-tx[data-id=pc] [data-h=rec]'); await waitfor(pg, "SW._st().rec", 5000); await pg.wait_for_timeout(200); await pg.click('#ldTexts .ld-tx[data-id=pc] [data-h=stop]'); await pg.wait_for_timeout(300)
        check('zu kurze Aufnahme (< 0,5 s) wird nicht gespeichert', 'zu kurz' in await pg.inner_text('#ldStatus') and not await pg.evaluate("AppDB.get('meta','lied-hum:sN:pc').then(r=>!!r)"))
        swjs = open(WWW + 'songwriting.js', encoding='utf8').read()
        check('Länge begrenzt (30 s → ≈ 0,9 MB), kein neuer Store/keine neue DB-Version', 'MAXS = 30' in swjs and 'HSR = 16000' in swjs and 'indexedDB.open' not in swjs and 'createObjectStore' not in swjs)
        # ---------- H: Silben-Raster ----------
        sy = await pg.evaluate("new Promise(r=>SW.raster(document.createElement('div'))||setTimeout(()=>r(SilbenRaster.sylls('Die Straße leer, das Radio leise')),600))")
        check('Silben + Betonung: Die Stra-ße leer das Ra-di-o lei-se (betont: Stra, leer, Ra, lei)', [x['t'] + ('*' if x['s'] else '') for x in sy] == ['Die', 'Stra-*', 'ße', 'leer*', 'das', 'Ra-*', 'di-', 'o', 'lei-*', 'se'], [x['t'] + ('*' if x['s'] else '') for x in sy])
        sy2 = await pg.evaluate("SilbenRaster.sylls('Erinnerung verlassen').map(x=>x.t+(x.s?'*':''))")
        check('Vorsilben/Endungen unbetont: E-rin-ne-rung → rin, ver-las-sen → las', sy2 == ['E-', 'rin-*', 'ne-', 'rung', 'ver-', 'las-*', 'sen'], sy2)
        sy3 = await pg.evaluate("['Erde','gehen','Morgen','verlor','Lichter'].map(w=>SilbenRaster.sylls(w).map(x=>x.t+(x.s?'*':'')).join(''))")
        check('keine Vorsilbe bei Erde/gehen; Morgen, verlor, Lichter', sy3 == ['Er-*de', 'ge-*hen', 'Mor-*gen', 'ver-lor*', 'Lich-*ter'], sy3)
        await area(pg, 'wf'); await pg.click('#stxL [data-s="9"]'); await waitfor(pg, "!!document.querySelector('#stxRaster .sr-c')")
        rs = await pg.evaluate("SilbenRaster._st()"); cells = await pg.evaluate("document.querySelectorAll('#stxRaster .sr-c').length")
        check('Workflow Schritt 9: Raster mit 2 Takten (4 Takte Strophe / 2 Zeilen) = 32 Felder, 10 Silben', rs['b'] == 2 and cells == 32 and len(rs['p']) == 10 and rs['key'] == 'sN|pv|0|0', (rs['b'], cells, rs['key']))
        lab = await pg.evaluate("[...document.querySelectorAll('#stxRaster .sr-bar')[0].querySelectorAll('.sr-c i')].slice(0,8).map(x=>x.textContent).join(' ')")
        check('Zählzeiten 1 e + e 2 e + e …', lab == '1 e + e 2 e + e', lab)
        await pg.select_option('#stxRaster select', 'sN|pc|0|0'); await pg.wait_for_timeout(200)
        rs = await pg.evaluate("SilbenRaster._st()"); hint = await pg.inner_text('#stxRaster .sr-hint')
        check('Zeile wählen: Refrain Zeile 1, Hinweis bei betonten Silben neben dem Schlag', rs['text'].startswith('Nachtfahrt, nur') and (('neben dem Schlag' in hint) == (rs['off'] > 0)), (rs['sy'], rs['p'], hint[:120]))
        # verschieben per Tippen
        await pg.click('#stxRaster .sr-c[data-c="%d"]' % rs['p'][1]); await pg.wait_for_timeout(100)
        tgt = rs['p'][1] + 1 if rs['p'][1] + 1 < rs['p'][2] else rs['p'][1] - 1
        await pg.click('#stxRaster .sr-c[data-c="%d"]' % tgt); await pg.wait_for_timeout(150)
        rs2 = await pg.evaluate("SilbenRaster._st()")
        check('Silbe antippen + freies Feld → verschoben (gemerkt in „3nps-sw“)', rs2['p'][1] == tgt and (await pg.evaluate(LS('3nps-sw')))['r']['p:sN|pc|0|0']['p'][1] == tgt, (rs['p'][:3], rs2['p'][:3]))
        await pg.click('#stxRaster .sr-c[data-c="%d"]' % rs2['p'][0]); await pg.click('#stxRaster .sr-c[data-c="%d"]' % (rs2['p'][2] + 1)); await pg.wait_for_timeout(150)
        check('Reihenfolge bleibt (Feld hinter dem Nachbarn → Hinweis, nicht verschoben)', (await pg.evaluate("SilbenRaster._st()"))['p'][0] == rs2['p'][0] and 'Reihenfolge' in await pg.inner_text('#stxRaster .sr-hint'))
        await pg.click('#stxRaster [data-sr=right]'); await pg.wait_for_timeout(100)
        check('▶ verschiebt die gewählte Silbe um 1/16', (await pg.evaluate("SilbenRaster._st()"))['p'][0] == rs2['p'][0] + 1)
        await pg.evaluate("(()=>{const D=JSON.parse(localStorage.getItem('3nps-sw'));D.r['p:sN|pc|0|0']={t:'Nachtfahrt, nur der Motor singt',b:2,p:[1,3,5,7,9,11,13]};localStorage.setItem('3nps-sw',JSON.stringify(D));})()")
        await tab(pg, 'looper'); await lied(pg); await waitfor(pg, "!!document.querySelector('#stxRaster .sr-c')"); await pg.select_option('#stxRaster select', 'sN|pc|0|0'); await pg.wait_for_timeout(200)
        rs = await pg.evaluate("SilbenRaster._st()")
        check('alles neben dem Schlag → Hinweis mit Anzahl', rs['off'] >= 3 and 'betonte Silben liegen neben dem Schlag' in await pg.inner_text('#stxRaster .sr-hint'), (rs['off'], rs['sy']))
        if SHOT: await shot(pg, 'v167-4-silbenraster.png', '#stxRaster')
        await pg.click('#stxRaster [data-sr=fix]'); await pg.wait_for_timeout(150)
        rs = await pg.evaluate("SilbenRaster._st()")
        check('„Betonte auf die Schläge“ → keine betonte Silbe mehr daneben, ✓-Meldung', rs['off'] == 0 and 'Alle betonten Silben liegen auf Schlägen' in await pg.inner_text('#stxRaster .sr-hint'), rs['p'])
        await pg.click('#stxRaster [data-sr="b+"]'); await pg.wait_for_timeout(150)
        check('Takte +1 → 3 Takte (48 Felder), neu verteilt', (await pg.evaluate("SilbenRaster._st()"))['b'] == 3 and await pg.evaluate("document.querySelectorAll('#stxRaster .sr-c').length") == 48)
        check('Grenzen werden genannt', 'Grenzen' in await pg.inner_text('#stxRaster .sr-lim'))
        await area(pg, 'tw'); await pg.wait_for_timeout(300)
        check('Raster auch im Bereich „Text-Werkstatt“', await pg.is_visible('#swRasterTw .sr') and await pg.evaluate("document.querySelectorAll('#swRasterTw .sr-c').length") >= 16)
        if SHOT: await area(pg, 'wf'); await pg.click('#stxL [data-s="4"]'); await shot(pg, 'v167-3-workflow.png')
        check('Übezeit unverändert (nichts gezählt)', await pg.evaluate("localStorage.getItem('3nps-uebezeit')") == UZ)
        check('keine Skriptfehler', not errs, errs[:3])
        await pg.context.close()
        # ---------- J: Profile, Größen, Englisch ----------
        for dev in ['auto', 'new', 'old', 'min']:
            pg, errs = await newpage(b, extra="localStorage.setItem('3nps-device','%s');" % dev); await lied(pg)
            for a in ['tw', 'wf', 'lf', 'nb', 'song']: await area(pg, a)
            await waitfor(pg, "!!(window.Songtext && Songtext.built() && window.TextWerk && window.SilbenRaster)")
            check('Profil %s: alle Bereiche öffnen, Song-Karten wieder da, keine Fehler' % dev, await pg.is_visible('#ldPartsCard') and not errs, errs[:2])
            await pg.context.close()
        for w, hh in [(1366, 1024), (820, 1180), (390, 844)]:
            for dev in ['auto', 'min']:
                pg, errs = await newpage(b, w, hh, extra="localStorage.setItem('3nps-device','%s');" % dev); await lied(pg)
                small = []; ov = True
                await pg.click('#swListB'); await pg.wait_for_timeout(150)
                for a in ['song', 'tw', 'wf']:
                    await area(pg, a); await pg.wait_for_timeout(300)
                    if a == 'wf': await waitfor(pg, "!!(window.Songtext&&Songtext.built())"); await pg.click('#stxL [data-s="9"]'); await waitfor(pg, "!!document.querySelector('#stxRaster .sr-c')")
                    small += await pg.evaluate("[...document.querySelectorAll('#swBar button, #swList button, .ld-topbtn button, .sw-hum button, .sr button, .sr select')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<43.5).map(b=>b.id||b.textContent).slice(0,5)")
                    ov = ov and await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
                nv = await pg.evaluate("(()=>{const n=document.getElementById('swNav'),b=[...n.children];return {fit:b.every(x=>x.getBoundingClientRect().height<70), scroll:n.scrollWidth>n.clientWidth+1}})()")
                check('%d×%d %s: keine Überbreite, Bedienelemente ≥ 44 px, Leiste einzeilig%s' % (w, hh, dev, ' (waagrecht scrollbar)' if w < 500 else ''), ov and not small and nv['fit'] and not errs, (small[:5], nv, errs[:2]))
                if SHOT and w == 390 and dev == 'auto':
                    await area(pg, 'song'); await pg.click('#swListB'); await pg.evaluate("window.scrollTo(0,0)"); await pg.evaluate("document.getElementById('ldSong').scrollIntoView({block:'start'});scrollBy(0,-60)"); await shot(pg, 'v167-6-telefon.png')
                await pg.context.close()
        pg, errs = await newpage(b, q='?lang=en'); await lied(pg)
        nav = await pg.inner_text('#swNav'); kt = await pg.inner_text('#swBar'); hb = await pg.inner_text('#ldTexts .ld-tx[data-id=pv] .sw-hum')
        await pg.click('#swListB'); lt = await pg.inner_text('#swList')
        check('Englisch: Leiste, Kacheln, Songliste, Summ-Knopf', 'Text workshop' in nav and 'Guide & example' in nav and 'Ideas' in nav and 'Song status' in kt and 'Sections with lyrics' in kt and 'Hum an idea' in hb and 'Song list' in lt and 'changed' in lt and 'Add to songbook' in await pg.inner_text('#swSb'), (nav, hb))
        await area(pg, 'wf'); await waitfor(pg, "!!(window.Songtext&&Songtext.built())"); await pg.click('#stxL [data-s="9"]'); await waitfor(pg, "!!document.querySelector('#stxRaster .sr-c')")
        check('Englisch: Silben-Raster', 'Syllable grid' in await pg.inner_text('#stxRaster') and await pg.evaluate("[...document.querySelectorAll('#stxRaster .sr-bar')[0].querySelectorAll('.sr-c i')].slice(0,4).map(x=>x.textContent).join(' ')") == '1 e + a')
        check('keine Skriptfehler (EN)', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
