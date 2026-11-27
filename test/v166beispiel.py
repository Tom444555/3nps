# v166: Durchgehendes Beispiel „von Anfang bis Ende“ in Lernen › „Songtext schreiben“. Prüft: Daten als eigene Datei (erst bei Bedarf geladen,
# Offline-Liste, index.html < 2,1 MB, ab v166), Inhalt (node test/v166beispiel.js: Reim-Prüfung v164 ohne unbeabsichtigtes „ohne Reim“, Silben,
# Akkorde in a-Moll und passend zu „Akkorde nach Stimmung“, Akkordmarken = Akkorde der Teile, Rohfassung zeigt die Probleme aus Schritt 10),
# Karte „So sieht das im Beispiel aus“ je Schritt (1–11, passender Inhalt, bleibt beim Weiterblättern offen), Knopf „Beispiel ansehen“ (alle 11 Schritte,
# „Zu Schritt n ›“), „Beispiel als Song laden“ (neuer Song mit allen Abschnitten, V1 Rohfassung + V2 fertig, Tonart/Tempo/Thema, Kernsatz/Hook/Wortfeld;
# zweites Laden „(2)“, vorhandene Songs unverändert), Reim-Prüfung der Werkstatt am geladenen Song, Checkliste findet den Hook trotz Akkordmarken,
# Sprung ins Songwriting, keine Übezeit, 4 Profile, 3 Größen ≥ 44 px, Englisch, keine Skriptfehler.
# Aufruf: python3 test/v166beispiel.py  (~1 min). SHOT=1 → Bilder nach /home/claude/bilder/v166-*.png
import asyncio, json, os, re, subprocess
from playwright.async_api import async_playwright
from nav import tab
U = 'http://localhost:8765/index.html'; HERE = os.path.dirname(os.path.abspath(__file__)); WWW = HERE + '/../app/www/'
SHOT = os.environ.get('SHOT'); SH = '/home/claude/bilder/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''), flush=True)
def ch(r, t=''): return {"r": r, "t": t, "beats": 4}
NACHT = {"id": "sN", "name": "Nachtfahrt", "created": 1, "voice": None, "cur": 0, "versions": [{"n": 1, "at": 1, "note": "Start", "key": {"pc": 9, "major": False}, "bpm": 92, "theme": "",
    "parts": [{"id": "pv", "name": "Strophe", "type": "verse", "chords": [ch(9, 'm'), ch(5), ch(0), ch(7)], "audio": None, "lyrics": ["Die Straße leer, das Radio leise\nich zähl die Lichter auf der Reise"]}],
    "order": [{"p": "pv", "reps": 1}]}]}
LIED = {"active": "sN", "songs": [NACHT]}
UZ = json.dumps({"v": 1, "u": [[1764000000, 1800, 1, 'ges']]})
def init(extra=''):
    return "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-lieder',%s);localStorage.setItem('3nps-uebezeit',%s);%s}" % (json.dumps(json.dumps(LIED)), json.dumps(UZ), extra)
async def newpage(b, w=1366, h=1024, extra='', q=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(init(extra)); await pg.goto(U + q); await pg.wait_for_timeout(900)
    return pg, errs
async def shot(pg, n):
    if SHOT: os.makedirs(SH, exist_ok=True); await pg.wait_for_timeout(300); await pg.screenshot(path=SH + n)
async def waitfor(pg, js, ms=6000):
    for _ in range(ms // 100):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(100)
    return False
LS = lambda k: "JSON.parse(localStorage.getItem('%s')||'null')" % k
async def step(pg, n): await pg.click('#stxL [data-s="%d"]' % n); await pg.wait_for_timeout(150)
async def open_st(pg): await tab(pg, 'songtext'); await waitfor(pg, "window.Songtext && Songtext.built()")
# erwarteter Inhalt je Schritt (Stichworte aus dem Zwischenstand)
MARK = {1: ['Kernsatz', 'Bäckerei'], 2: ['Gegenverkehr', 'Die erste Bahn zurück'], 3: ['Mehl im Haar', 'riechen'], 4: ['Mit Bridge', 'XAXA'], 5: ['Rohfassung', 'ich fahr hinaus'],
        6: ['Strophe 2', 'die ganze Stadt ist müde so wie ich'], 7: ['ich wart an deinem Bus', 'Schluss-Refrain trägt die Wendung'], 8: ['Akkorde nach Stimmung', 'Dm F C E'],
        9: ['Silben', 'um FÜNF fällt HIN-ter MIR das TOR'], 10: ['vorher', 'Frühstück am Bordsteinrand'], 11: ['Fertiger Text mit Akkorden', 'Schluss-Refrain']}

async def main():
    # ---------- A: Inhalt ohne Browser ----------
    r = subprocess.run(['node', HERE + '/v166beispiel.js'], capture_output=True, text=True)
    last = r.stdout.strip().split('\n')[-1] if r.stdout.strip() else ''
    m = re.match(r'(\d+)/(\d+)', last)
    check('Inhalt (node test/v166beispiel.js): ' + last, m and m.group(1) == m.group(2) and r.returncode == 0, [l for l in r.stdout.split('\n') if l.startswith('FEHLER')][:3] or r.stderr[-300:])
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---------- B: Bau, Laden erst bei Bedarf ----------
        h = open(WWW + 'index.html', encoding='utf8').read(); sw = open(WWW + 'sw.js', encoding='utf8').read()
        check('index.html < 2,1 MB, Beispiel nicht darin', len(h.encode()) < 2100000 and 'SongtextBeispiel' not in h and 'Bordsteinrand' not in h, len(h.encode()))
        check('sw.js: songtext-beispiel.js in der Offline-Liste, Cache ab v166', "'songtext-beispiel.js'" in sw.split('const CORE')[1].split('\n')[0] and int(re.search(r"3nps-v(\d+)", sw).group(1)) >= 166)
        check('Datei liegt in app/www', os.path.getsize(WWW + 'songtext-beispiel.js') > 5000)
        pg, errs = await newpage(b)
        check('ab v166', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 166)
        res = lambda: pg.evaluate("performance.getEntriesByType('resource').map(r=>r.name.split('/').pop()).filter(n=>/songtext-beispiel/.test(n))")
        await open_st(pg)
        check('Seite offen, Beispiel noch nicht geladen', await res() == [] and not await pg.evaluate("!!window.SongtextBeispiel"))
        btn = await pg.evaluate("(()=>{const b=document.getElementById('stxExAll'),c=document.getElementById('stxExB');return b&&c?[b.textContent,c.textContent,b.getBoundingClientRect().height,c.getBoundingClientRect().height]:null})()")
        check('Knöpfe „Beispiel ansehen“ und „So sieht das im Beispiel aus“ (≥ 44 px)', btn and 'Beispiel ansehen' in btn[0] and 'So sieht das im Beispiel aus' in btn[1] and btn[2] >= 44 and btn[3] >= 44, btn)
        # ---------- C: Karte je Schritt ----------
        await step(pg, 1); await pg.click('#stxExB'); await waitfor(pg, "!!window.SongtextBeispiel && !document.getElementById('stxExS').hidden && /Bäckerei/.test(document.getElementById('stxExS').textContent)")
        check('Antippen lädt die Datei einmal und zeigt Schritt 1', await res() == ['songtext-beispiel.js'] and await pg.get_attribute('#stxExB', 'aria-expanded') == 'true')
        bad = []
        for n in range(1, 12):
            await step(pg, n); t = await pg.inner_text('#stxExS')
            if await pg.is_hidden('#stxExS') or not all(k in t for k in MARK[n]): bad.append(n)
            if n == 10 and SHOT: await pg.evaluate("document.getElementById('stxExS').scrollIntoView({block:'start'})"); await shot(pg, 'v166-2-schritt10.png')
            if n == 8 and SHOT: await pg.evaluate("document.getElementById('stxS').scrollIntoView({block:'start'})"); await shot(pg, 'v166-1-schritt8.png')
        check('Karte je Schritt 1–11 mit passendem Zwischenstand, bleibt beim Weiterblättern offen', not bad, bad)
        t11 = await pg.inner_text('#stxExS')
        check('Schritt 11: Checkliste abgehakt + Text mit Akkorden über den Silben + „Beispiel als Song laden“', t11.count('✓') >= 7 and re.search(r'Am\s+C\n\s*Um fünf fällt hinter mir das Tor', t11) is not None and await pg.is_visible('#stxExS [data-a=exSong]'), t11[:160])
        await pg.click('#stxExB'); check('Karte zuklappbar', await pg.is_hidden('#stxExS'))
        # ---------- D: Beispiel ansehen (alle Schritte) ----------
        await pg.click('#stxExAll'); await pg.wait_for_timeout(200)
        secs = await pg.evaluate("[...document.querySelectorAll('#stxExW .stb-sec')].map(s=>s.dataset.ex)")
        check('„Beispiel ansehen“: alle 11 Schritte untereinander', not await pg.is_hidden('#stxExW') and secs == [str(i) for i in range(1, 12)], secs)
        await pg.click('#stxExW [data-a=exStep][data-n="8"]'); await pg.wait_for_timeout(200)
        st = await pg.evaluate("Songtext._st()")
        check('„Zu Schritt 8 ›“ öffnet Schritt 8 mit Beispiel-Karte', st['sel'] == 8 and st['exOpen'] and 'Akkorde nach Stimmung' in await pg.inner_text('#stxExS'), st)
        await pg.click('.stx-nav [data-view=lf]'); hid = await pg.is_hidden('#stxExW'); await pg.click('.stx-nav [data-view=wf]')
        check('Übersicht nur im Workflow sichtbar', hid and not await pg.is_hidden('#stxExW'))
        # ---------- E: Beispiel als Song laden ----------
        before = await pg.evaluate(LS('3nps-lieder'))
        await pg.click('#stxExW [data-a=exSong] >> nth=0'); await pg.wait_for_timeout(300)
        db = await pg.evaluate(LS('3nps-lieder')); s1 = db['songs'][-1]
        v1, v2 = s1['versions'][0], s1['versions'][-1]
        names = [x['name'] for x in v2['parts']]
        check('neuer Song „Beispiel – Die erste Bahn zurück“, vorhandener unverändert', len(db['songs']) == 2 and s1['name'] == 'Beispiel – Die erste Bahn zurück' and db['songs'][0] == before['songs'][0], [x['name'] for x in db['songs']])
        check('alle Abschnitte + Ablauf (6 Teile im Ablauf)', names == ['Strophe', 'Refrain', 'Bridge', 'Schluss-Refrain'] and len(v2['order']) == 6 and [x['type'] for x in v2['parts']] == ['verse', 'chorus', 'bridge', 'chorus'], names)
        check('Tonart a-Moll, 84 BPM, Thema = Kernsatz', v2['key'] == {'pc': 9, 'major': False} and v2['bpm'] == 84 and 'Bäckerei' in v2.get('theme', ''))
        check('Texte: Strophe 1 und 2, Refrain, Bridge, Schluss-Refrain (mit Akkordmarken)', len(v2['parts'][0]['lyrics']) == 2 and v2['parts'][0]['lyrics'][0].startswith('Um [Am]fünf') and 'Bordsteinrand' in v2['parts'][2]['lyrics'][0] and 'zu zweit' in v2['parts'][3]['lyrics'][0])
        check('Versionen: V1 Rohfassung (Vorher-Zeilen), V2 fertig = aktuell', len(s1['versions']) == 2 and s1['cur'] == 1 and 'Rohfassung' in v1['note'] and 'die ganze Stadt ist müde so wie ich' in v1['parts'][0]['lyrics'][0] and 'die ganze Stadt' not in v2['parts'][0]['lyrics'][0], [v1['note'], v2['note']])
        sd = await pg.evaluate(LS('3nps-songtext')); k = 'l:' + s1['id']; pr = sd['p'].get(k, {})
        check('Songtext: Song gewählt, Kernsatz/Hook/Wortfeld eingetragen, keine Haken', sd['cur'] == k and pr.get('h') == 'Die erste Bahn zurück' and 'Bäckerei' in pr.get('k', '') and len(pr['wf']['w']) >= 10 and pr['d'] == [], (sd['cur'], pr.get('h')))
        msg = await pg.inner_text('#stxS .stx-msg')
        check('Meldung mit „Im Songwriting öffnen ›“', 'Angelegt' in msg and await pg.is_visible('#stxS [data-a=exGo]'), msg[:120])
        if SHOT: await pg.evaluate("document.getElementById('stxS').scrollIntoView({block:'start'})")
        await pg.click('#stxExW [data-a=exSong] >> nth=0'); await pg.wait_for_timeout(300)
        db2 = await pg.evaluate(LS('3nps-lieder'))
        check('zweites Laden: „(2)“, erster Beispiel-Song unverändert', len(db2['songs']) == 3 and db2['songs'][2]['name'] == 'Beispiel – Die erste Bahn zurück (2)' and db2['songs'][1] == s1 and db2['songs'][0] == before['songs'][0], [x['name'] for x in db2['songs']])
        # Checkliste findet den Hook trotz Akkordmarken
        await pg.select_option('#stxSong', k); await pg.wait_for_timeout(200); await step(pg, 11)
        check('Checkliste: „Titel/Hook im Refrain: gefunden“, Abschnitte mit Text 5 / 5', 'Titel/Hook im Refrain: gefunden' in (await pg.inner_text('#stxX')) and '5 / 5' in await pg.inner_text('#stxX'), (await pg.inner_text('#stxX'))[:120])
        # Reim-Prüfung der Werkstatt (im Browser) am geladenen Song
        rr = await pg.evaluate("""new Promise(res=>LiedApi.twLoad(()=>{const s=JSON.parse(localStorage.getItem('3nps-lieder')).songs[1], v=s.versions[s.cur], out=[];
            v.parts.forEach(p=>(p.lyrics||[]).forEach((t,i)=>{const r=TextWerk.checkText(t,p.name);out.push([p.name,i,r.scheme,r.lines.filter(l=>l.alone).map(l=>l.text)]);})); res(out);}))""")
        alone = [(x[0], x[3]) for x in rr if x[3]]
        check('Werkstatt „Reime prüfen“: ohne Reim nur Bridge Zeile 1 und 3 (gewollt XAXA)', alone == [('Bridge', ['Heut steig ich früher aus', 'ich wart an deinem Bus'])] and [x[2] for x in rr] == ['ABAB', 'ABAB', 'AABB', 'ABCB', 'AABB'], rr)
        lt = await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('3nps-lieder')).songs[1], v=s.versions[s.cur]; return LiedText.lines(v.parts[0].lyrics[0],'de').map(x=>x.letter||'')})()")
        check('Buchstaben links im Songwriting = Werkstatt-Schema (Strophe 1 ABAB)', ''.join(lt) == 'ABAB', lt)
        # Sprung ins Songwriting
        await pg.select_option('#stxSong', k); await pg.wait_for_timeout(150); await pg.click('#stxExW [data-a=exSong] >> nth=0'); await pg.wait_for_timeout(300)
        await pg.click('#stxS [data-a=exGo]'); await pg.wait_for_timeout(400)
        cur = await pg.evaluate("[AppNav.current(), LiedApi.song() && LiedApi.song().name]")
        check('„Im Songwriting öffnen ›“ zeigt den neuen Beispiel-Song', cur == ['lied', 'Beispiel – Die erste Bahn zurück (3)'], cur)
        if SHOT:
            await pg.evaluate("document.getElementById('ldTextCard') && document.getElementById('ldTextCard').scrollIntoView({block:'start'})"); await shot(pg, 'v166-3-songwriting.png')
        check('Übezeit unverändert (Seite zählt nichts)', await pg.evaluate("localStorage.getItem('3nps-uebezeit')") == UZ)
        check('keine Skriptfehler', not errs, errs[:3])
        await pg.context.close()
        # ---------- F: Profile, Größen, Englisch ----------
        for dev in ['auto', 'new', 'old', 'min']:
            pg, errs = await newpage(b, extra="localStorage.setItem('3nps-device','%s');" % dev)
            await open_st(pg); await step(pg, 9); await pg.click('#stxExB'); await waitfor(pg, "/Silben/.test(document.getElementById('stxExS').textContent)")
            await pg.click('#stxExAll'); await pg.wait_for_timeout(200); await pg.click('#stxExW [data-a=exSong] >> nth=0'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("({ov:document.documentElement.scrollWidth<=innerWidth+1, n:JSON.parse(localStorage.getItem('3nps-lieder')).songs.length})")
            check('Profil %s: Karte, Übersicht, Laden gehen, keine Überbreite, keine Fehler' % dev, r['ov'] and r['n'] == 2 and not errs, (r, errs[:2]))
            await pg.context.close()
        for w, hh in [(1366, 1024), (820, 1180), (390, 844)]:
            pg, errs = await newpage(b, w, hh)
            await open_st(pg); small = []
            await pg.click('#stxExAll'); await waitfor(pg, "document.querySelectorAll('#stxExW .stb-sec').length===11")
            for st in [2, 8, 9, 11]:
                await step(pg, st)
                if not await pg.get_attribute('#stxExB', 'aria-expanded') == 'true': await pg.click('#stxExB')
                await pg.wait_for_timeout(150)
                small += await pg.evaluate("[...document.querySelectorAll('#stxRoot button')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<43.5).map(b=>b.id||b.textContent).slice(0,5)")
            ov = await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            check('%d×%d: keine Überbreite, Bedienelemente ≥ 44 px' % (w, hh), ov and not small and not errs, (small[:5], errs[:2]))
            if SHOT and w == 390:
                await step(pg, 11); await pg.evaluate("document.querySelector('#stxExS .stb-sheet').scrollIntoView({block:'start'})"); await pg.evaluate("scrollBy(0,-60)"); await shot(pg, 'v166-4-telefon.png')
            await pg.context.close()
        pg, errs = await newpage(b, q='?lang=en')
        await open_st(pg); await step(pg, 2)
        ui = [await pg.inner_text('#stxExAll'), await pg.inner_text('#stxExB')]
        await pg.click('#stxExB'); await waitfor(pg, "!!window.SongtextBeispiel"); await pg.wait_for_timeout(150); card = await pg.inner_text('#stxExS')
        await pg.click('#stxExAll'); await pg.wait_for_timeout(200); ov = await pg.inner_text('#stxExW')
        check('Englisch: Knöpfe übersetzt, Hinweis „example song itself is in German“', 'See example' in ui[0] and 'How it looks in the example' in ui[1] and 'in German' in card and 'Example from start to finish' in ov and 'Load example as song' in ov and 'Go to step 1 ›' in ov, ui)
        await pg.click('#stxExW [data-a=exSong] >> nth=0'); await pg.wait_for_timeout(200)
        n = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-lieder')).songs.map(s=>s.name)")
        check('Englisch: Laden legt „Example – …“ an', n[-1] == 'Example – Die erste Bahn zurück', n)
        check('keine Skriptfehler (EN)', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
