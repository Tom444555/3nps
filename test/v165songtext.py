# v165: Seite „Songtext schreiben“ unter „Lernen“. Prüft: erst beim Öffnen geladen (songtext.js/.css in der Offline-Liste, index.html < 2,1 MB),
# Chip/Kachel, Workflow 11 Schritte mit Haken je Song (Songwriting-Song, „ohne Song“), Helfer (Kernsatz → Thema mit Rückfrage, Titel/Hook, Wortfeld mit
# Reimwörtern aus v164 – Liste erst bei Bedarf), Aufbau-Vorlagen (leerer Song: direkt; Song mit Text: neue Version, alter Text unverändert; ohne Song:
# neuer Song; Blues AAB; Hinweis im Textfeld), Sprünge (Text-Werkstatt mit richtigem Reiter und Song, Text, Leadsheet, Looper, Songbook, Mitsingen lernen),
# Checkliste, Leitfaden (11 Themen, aufklappbar), Notizbuch (notieren, Schlagworte, Suche, Filter, „In Song …“ als neue Version, neuer Song aus Titel,
# Löschen mit Rückfrage), Export/Import-Rundlauf ohne Doppeltes, Schreibimpulse, keine Übezeit, Profile, 3 Größen, EN, keine Skriptfehler.
# Aufruf: python3 test/v165songtext.py  (~2 min). SHOT=1 → Bilder nach /home/claude/bilder/v165-*.png
import asyncio, json, os, re, tempfile
from playwright.async_api import async_playwright
from nav import tab
U = 'http://localhost:8765/index.html'; WWW = os.path.dirname(os.path.abspath(__file__)) + '/../app/www/'
SHOT = os.environ.get('SHOT'); SH = '/home/claude/bilder/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''), flush=True)
# erfundene Songs (keine echten Liedtexte)
def ch(r, t=''): return {"r": r, "t": t, "beats": 4}
NACHT = {"id": "sN", "name": "Nachtfahrt", "created": 1, "voice": None, "cur": 0, "versions": [{"n": 1, "at": 1, "note": "Start", "key": {"pc": 9, "major": False}, "bpm": 92, "theme": "",
    "parts": [{"id": "pv", "name": "Strophe", "type": "verse", "chords": [ch(9, 'm'), ch(5), ch(0), ch(7)], "audio": None, "lyrics": ["Die Straße leer, das Radio leise\nich zähl die Lichter auf der Reise"]},
              {"id": "pc", "name": "Refrain", "type": "chorus", "chords": [ch(5), ch(0), ch(7), ch(9, 'm')], "audio": None, "lyrics": ["Nachtfahrt, nur der Motor singt\nNachtfahrt, bis der Morgen klingt"]}],
    "order": [{"p": "pv", "reps": 1}, {"p": "pc", "reps": 1}, {"p": "pv", "reps": 1}, {"p": "pc", "reps": 1}]}]}
LEER = {"id": "sL", "name": "Staub und Sterne", "created": 2, "voice": None, "cur": 0, "versions": [{"n": 1, "at": 2, "note": "Start", "key": {"pc": 7, "major": True}, "bpm": 100, "parts": [], "order": []}]}
LIED = {"active": "sN", "songs": [NACHT, LEER]}
def init(extra=''):
    return "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-lieder',%s);%s}" % (json.dumps(json.dumps(LIED)), extra)
async def newpage(b, w=1366, h=1024, extra='', q=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True); pg = await ctx.new_page(); errs = []
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
async def song(pg, sid): return await pg.evaluate("(" + LS('3nps-lieder') + ").songs.find(s=>s.id==='%s')" % sid)
async def step(pg, n): await pg.click('#stxL [data-s="%d"]' % n); await pg.wait_for_timeout(150)
async def pick(pg, k): await pg.select_option('#stxSong', k); await pg.wait_for_timeout(200)
async def back(pg): await tab(pg, 'songtext'); await pg.wait_for_timeout(300)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---------- A: Bau, Laden, Navigation ----------
        h = open(WWW + 'index.html', encoding='utf8').read(); sw = open(WWW + 'sw.js', encoding='utf8').read()
        check('index.html < 2,1 MB, ohne Seitencode', len(h.encode()) < 2100000 and 'window.Songtext =' not in h and 'stx-wrap' not in h, len(h.encode()))
        check('sw.js: songtext.js/.css in der Offline-Liste, Cache ab v165', all("'%s'" % f in sw.split('const CORE')[1].split('\n')[0] for f in ['songtext.js', 'songtext.css']) and int(re.search(r"3nps-v(\d+)", sw).group(1)) >= 165)
        pg, errs = await newpage(b, extra="localStorage.setItem('3nps-uebezeit',JSON.stringify({v:1,u:[[1764000000,1800,1,'ges']]}));")
        check('ab v165', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 165)
        res = lambda: pg.evaluate("performance.getEntriesByType('resource').map(r=>r.name.split('/').pop()).filter(n=>/songtext\\.|textwerk\\.|reim-de|mitsingen\\./.test(n))")
        check('Start lädt songtext.js/.css nicht', await res() == [] and not await pg.evaluate("!!window.Songtext"))
        await pg.click('#area-lernen'); await pg.wait_for_timeout(300)
        chips = await pg.evaluate("[...document.querySelectorAll('#subNav [data-area=lernen]')].map(c=>c.dataset.tab)")
        check('Chip „Songtext schreiben“ nach „Mitsingen lernen“', chips.index('songtext') == chips.index('singlernen') + 1 and await pg.inner_text('#tab-songtext') == 'Songtext schreiben', chips)
        await pg.click('#tab-lernen'); await pg.wait_for_timeout(400)
        tile = await pg.evaluate("(()=>{const t=document.querySelector('.ln-tile[data-t=songtext]');return t?t.textContent:''})()")
        check('Kachel in der Übersicht', 'Songtext schreiben' in tile and 'noch nichts geschrieben' in tile, tile[:90])
        uz0 = await pg.evaluate("localStorage.getItem('3nps-uebezeit')")
        await pg.click('.ln-tile[data-t=songtext]'); await waitfor(pg, "window.Songtext && Songtext.built()")
        r = await res()
        check('Kachel öffnet die Seite; songtext + mitsingen.css nachgeladen, Werkstatt/Reimliste nicht', await pg.evaluate("AppNav.current()") == 'songtext' and 'songtext.js' in r and 'songtext.css' in r and 'mitsingen.css' in r and 'mitsingen.js' not in r and 'textwerk.js' not in r, r)
        rows = await pg.evaluate("[...document.querySelectorAll('#stxL .msl-r')].map(r=>r.querySelector('b').textContent)")
        check('Workflow: 11 Schritte in der Fahrplan-Optik (msl-r)', len(rows) == 11 and rows[0] == 'Idee & Kernsatz' and rows[3] == 'Aufbau festlegen' and rows[10] == 'Fertig', rows)
        check('Bereiche Workflow · Leitfaden · Ideen-Notizbuch', await pg.evaluate("[...document.querySelectorAll('.stx-nav [data-view]')].map(b=>b.textContent).join('|')") == 'Workflow|Leitfaden|Ideen-Notizbuch')
        opts = await pg.evaluate("[...document.querySelectorAll('#stxSong option')].map(o=>o.textContent)")
        check('Song-Auswahl: ohne Song, Songs aus dem Songwriting, „＋ Neuer Song …“', opts[0].startswith('– ohne Song') and 'Nachtfahrt' in opts and 'Staub und Sterne' in opts and opts[-1].startswith('＋'), opts)
        check('Schritt 1: So geht’s, Warum, Werkzeug-Knopf', (await pg.inner_text('#stxH')) == 'Schritt 1 · Idee & Kernsatz' and 'So geht’s' in await pg.inner_text('#stxSo') and (await pg.inner_text('#stxWhy')).startswith('Warum:') and await pg.is_visible('#stxTools [data-go=nb]'))
        await pg.click('#stxTipsB'); await pg.wait_for_timeout(100)
        check('Tipps aufklappbar', await pg.is_visible('#stxTips') and 'Woran merke ich' in await pg.inner_text('#stxTips'))
        # ---------- B: ohne Song, Kernsatz, Schreibimpuls ----------
        await pg.fill('#stxKern', 'Er merkt beim Umzug, wie lange er schon allein wohnt.'); await pg.click('#stxDone'); await pg.wait_for_timeout(500)
        d = await pg.evaluate(LS('3nps-songtext'))
        check('ohne Song: Haken + Kernsatz gespeichert („_“)', d['p']['_']['d'] == [1] and 'Umzug' in d['p']['_']['k'] and await pg.inner_text('#stxCnt') == '1 von 11', d['p'].get('_'))
        await pg.click('#stxX [data-a=dice]'); await pg.wait_for_timeout(100)
        dz = await pg.inner_text('#stxDice')
        check('Schreibimpuls: Thema × Perspektive × Bild', 'Thema' in dz and 'Perspektive' in dz and 'Bild' in dz, dz.replace('\n', ' ')[:80])
        await pg.click('#stxDice [data-a=diceSave]'); await pg.wait_for_timeout(100)
        check('Impuls als Idee notiert', (await pg.evaluate(LS('3nps-songtext')))['n'][0]['k'] == 'i')
        await step(pg, 8); await pg.click('#stxTools [data-go="tw:akk"]'); await pg.wait_for_timeout(200)
        check('ohne Song: Werkzeug-Sprung bleibt hier mit Hinweis', await pg.evaluate("AppNav.current()") == 'songtext' and 'Wähle zuerst' in await pg.inner_text('#stxWf .stx-msg'))
        # ---------- C: Haken je Song ----------
        await pick(pg, 'l:sN')
        check('Song gewählt: eigener Fortschritt, Meta mit Abschnitten', await pg.inner_text('#stxCnt') == '0 von 11' and '2 Abschnitte' in await pg.inner_text('#stxMeta'), await pg.inner_text('#stxMeta'))
        await step(pg, 2); await pg.click('#stxDone'); await step(pg, 5); await pg.click('#stxDone'); await pg.wait_for_timeout(200)
        await pick(pg, '_'); c0 = await pg.inner_text('#stxCnt'); await pick(pg, 'l:sN')
        d = await pg.evaluate(LS('3nps-songtext'))
        check('Haken je Song getrennt (Nachtfahrt 2+5, ohne Song 1), letzter Schritt gemerkt', d['p']['l:sN']['d'] == [2, 5] and d['p']['_']['d'] == [1] and c0 == '1 von 11' and await pg.inner_text('#stxCnt') == '2 von 11' and (await pg.inner_text('#stxH')).startswith('Schritt 5'), (d['p']['l:sN']['d'], c0))
        # Kernsatz als Thema (Rückfrage, wenn schon eins da)
        await step(pg, 1); await pg.fill('#stxKern', 'Eine Fahrt durch die Nacht, die nichts klärt.'); await pg.click('#stxX [data-a=kern2]'); await pg.wait_for_timeout(200)
        th = (await song(pg, 'sN'))['versions'][0]['theme']
        await pg.fill('#stxKern', 'Neuer Kern'); await pg.evaluate("window.confirm=()=>false;0"); await pg.click('#stxX [data-a=kern2]'); await pg.wait_for_timeout(200)
        th2 = (await song(pg, 'sN'))['versions'][0]['theme']
        check('Kernsatz → Thema im Song; vorhandenes Thema nur nach Rückfrage', th.startswith('Eine Fahrt') and th2 == th, (th, th2))
        # Titel/Hook
        await step(pg, 2); await pg.fill('#stxHook', 'Nachtfahrt'); await pg.click('#stxX [data-a=hook2nb]'); await pg.wait_for_timeout(200)
        check('Titel/Hook gespeichert und als Titel-Notiz im Notizbuch', (await pg.evaluate(LS('3nps-songtext')))['p']['l:sN']['h'] == 'Nachtfahrt' and await pg.evaluate("(" + LS('3nps-songtext') + ").n[0].k") == 't')
        # ---------- D: Wortfeld + Reimwörter (Liste erst jetzt) ----------
        await step(pg, 3); await pg.fill('#stxWfT', 'Nacht, Straße'); await pg.fill('#stxWfIn', 'Kartons, Echo im Flur, Nacht'); await pg.press('#stxWfIn', 'Enter'); await pg.wait_for_timeout(200)
        w = await pg.evaluate("[...document.querySelectorAll('#stxWfL [data-a=wfRh]')].map(b=>b.textContent)")
        check('Wortfeld: Komma trennt, Thema gespeichert', w == ['Kartons', 'Echo im Flur', 'Nacht'] and (await pg.evaluate(LS('3nps-songtext')))['p']['l:sN']['wf']['t'] == 'Nacht, Straße', w)
        check('Reimliste noch nicht geladen', 'reim-de-1.txt' not in await res())
        await pg.click('#stxWfL [data-w="Nacht"][data-a=wfRh]'); ok1 = await waitfor(pg, "document.querySelectorAll('#stxRh [data-a=wfTake]').length>3", 10000)
        rw = await pg.evaluate("[...document.querySelectorAll('#stxRh [data-a=wfTake]')].map(b=>b.textContent)")
        check('Wort antippen: Reimwörter aus der Liste (v164) nachgeladen', ok1 and 'reim-de-1.txt' in await res() and any(x in rw for x in ['macht', 'acht', 'gemacht', 'lacht', 'pracht', 'wacht']), rw[:8])
        await pg.click('#stxRh [data-a=wfTake]:not([disabled])'); await pg.wait_for_timeout(200)
        w2 = (await pg.evaluate(LS('3nps-songtext')))['p']['l:sN']['wf']['w']
        check('Reimwort antippen nimmt es ins Wortfeld (Liste bleibt offen, Wort abgehakt)', len(w2) == 4 and w2[3] in rw and await pg.evaluate("document.querySelectorAll('#stxRh [data-a=wfTake][disabled]').length") == 1, w2)
        await pg.click('#stxWfL [data-w="Kartons"][data-a=wfDel]'); await pg.wait_for_timeout(100)
        check('Wort entfernen', 'Kartons' not in (await pg.evaluate(LS('3nps-songtext')))['p']['l:sN']['wf']['w'])
        if SHOT: await pg.fill('#stxWfIn', 'kalter Kaffee, Regen am Fenster, Funkloch, Tankstellenlicht'); await pg.press('#stxWfIn', 'Enter'); await waitfor(pg, "document.querySelectorAll('#stxRh [data-a=wfTake]').length>3"); await shot(pg, 'v165-1-workflow-wortfeld.png')
        # ---------- E: Aufbau-Vorlagen ----------
        await pick(pg, 'l:sL'); await step(pg, 4)
        check('leerer Song: Knopf „Abschnitte im Song anlegen“', (await pg.inner_text('#stxTplGo')) == 'Abschnitte im Song anlegen')
        await pg.click('#stxX [data-tpl=pre]'); await pg.wait_for_timeout(100)
        prev = await pg.inner_text('#stxX .stx-prev')
        check('Vorschau Pre-Chorus: Zeilen/Reim/Akkorde in G-Dur', 'Pre-Chorus · 2 Zeilen · Reim AA' in prev and 'Strophe · 4 Zeilen · Reim ABAB · G D Em C' in prev, prev.replace('\n', ' | '))
        if SHOT: await shot(pg, 'v165-4-vorlagen.png')
        await pg.click('#stxTplGo'); await pg.wait_for_timeout(300)
        s = await song(pg, 'sL'); v = s['versions'][-1]
        check('leerer Song: 3 Abschnitte direkt angelegt (keine neue Version), Ablauf S P R S P R R', len(s['versions']) == 1 and [p['name'] for p in v['parts']] == ['Strophe', 'Pre-Chorus', 'Refrain'] and len(v['order']) == 7 and [p['type'] for p in v['parts']] == ['verse', 'pre', 'chorus'], [p['name'] for p in v['parts']])
        check('Abschnitte mit Zeilen/Reimschema und Platzhalter-Akkorden', v['parts'][0]['plan'] == {'n': 4, 'r': 'ABAB'} and v['parts'][1]['plan'] == {'n': 2, 'r': 'AA'} and len(v['parts'][0]['chords']) == 8 and v['parts'][0]['chords'][0] == {'r': 7, 't': '', 'beats': 4}, v['parts'][0])
        check('Meldung nennt Song und Version', 'Angelegt: 3 Abschnitte' in await pg.inner_text('#stxWf .stx-msg') and 'Staub und Sterne' in await pg.inner_text('#stxWf .stx-msg'))
        old = (await song(pg, 'sN'))['versions']
        await pick(pg, 'l:sN'); await step(pg, 4)
        check('Song mit Text: Knopf „Als neue Version anlegen“', (await pg.inner_text('#stxTplGo')) == 'Als neue Version anlegen')
        await pg.click('#stxX [data-tpl=vr]'); await pg.click('#stxTplGo'); await pg.wait_for_timeout(300)
        s = await song(pg, 'sN')
        check('Song mit Text: neue Version V2 mit Vorlage, V1 samt Text unverändert', len(s['versions']) == 2 and s['versions'][0] == old[0] and s['cur'] == 1 and [p['name'] for p in s['versions'][1]['parts']] == ['Strophe', 'Refrain'] and s['versions'][1]['note'].startswith('Vorlage') and s['versions'][1]['parts'][0]['chords'][0]['t'] == 'm', s['versions'][1]['note'])
        await pick(pg, '_'); await step(pg, 4); await pg.click('#stxX [data-tpl=blues]'); await pg.fill('#stxTplN', 'Montagsblues'); await pg.click('#stxTplGo'); await pg.wait_for_timeout(300)
        db = await pg.evaluate(LS('3nps-lieder')); nb = db['songs'][-1]; v = nb['versions'][0]
        check('ohne Song: neuer Song „Montagsblues“ mit 12-Takt-Blues (AAB, 3 Strophen, I7 IV7 V7)', nb['name'] == 'Montagsblues' and len(v['parts']) == 1 and v['parts'][0]['plan'] == {'n': 3, 'r': 'AAB'} and len(v['parts'][0]['chords']) == 12 and len(v['order']) == 3 and [c['t'] for c in v['parts'][0]['chords']].count('7') == 12, [p['name'] for p in v['parts']])
        d = await pg.evaluate(LS('3nps-songtext'))
        check('…und ist gleich gewählt, Kernsatz von „ohne Song“ mitgenommen', d['cur'] == 'l:' + nb['id'] and 'Umzug' in d['p']['l:' + nb['id']]['k'] and await pg.evaluate("document.getElementById('stxSong').value") == 'l:' + nb['id'])
        # Hinweis im Textfeld des Songwritings
        await pick(pg, 'l:sL'); await step(pg, 5); await pg.click('#stxTools [data-go=text]'); await pg.wait_for_timeout(400)
        ph = await pg.evaluate("[...document.querySelectorAll('#ldTexts .ld-txt')].map(t=>t.placeholder)")
        check('Sprung „Text im Songwriting“: richtiger Song, Textfeld nennt Zeilen und Reim', await pg.evaluate("AppNav.current()") == 'lied' and await pg.evaluate("document.getElementById('ldSong').value") == 'sL' and any('(4 Zeilen · Reim ABAB)' in x for x in ph) and any('(2 Zeilen · Reim AA)' in x for x in ph), ph[:3])
        # ---------- F: Sprünge in die Text-Werkstatt ----------
        await back(pg); await pick(pg, 'l:sN'); await step(pg, 8); await pg.click('#stxTools [data-go="tw:akk"]')
        okw = await waitfor(pg, "window.TextWerk && !document.getElementById('ldTwBox').hidden && !!document.querySelector('#ldTwBox [data-pane=akk].active')", 8000)
        check('Schritt 8 → Text-Werkstatt „Akkorde nach Stimmung“ mit dem gewählten Song', okw and await pg.evaluate("AppNav.current()") == 'lied' and await pg.evaluate("document.getElementById('ldSong').value") == 'sN')
        await back(pg); await step(pg, 10); await pg.click('#stxTools [data-go="tw:prompt"]'); await pg.wait_for_timeout(500)
        check('Schritt 10 → „Prompt für Claude“ (Werkstatt bleibt offen, Reiter gewechselt)', await pg.evaluate("!!document.querySelector('#ldTwBox [data-pane=prompt].active') && !document.getElementById('ldTwBox').hidden"))
        await back(pg); await pg.click('#stxTools [data-go="tw:reim"]'); await pg.wait_for_timeout(500)
        check('Schritt 10 → „Reime prüfen“', await pg.evaluate("!!document.querySelector('#ldTwBox [data-pane=reim].active')"))
        await back(pg); await step(pg, 9); await pg.click('#stxTools [data-go=looper]'); await pg.wait_for_timeout(300)
        check('Schritt 9 → Looper', await pg.evaluate("AppNav.current()") == 'looper' and not await pg.evaluate("Looper.running && Looper.running()"))
        await back(pg); await pick(pg, 'l:sL'); await step(pg, 11); await pg.click('#stxTools [data-go=pdf]'); await pg.wait_for_timeout(300)
        check('Schritt 11 → „Leadsheet (PDF)“ hervorgehoben, richtiger Song', await pg.evaluate("document.getElementById('ldPdf').classList.contains('stx-flash') && document.getElementById('ldSong').value==='sL'"))
        # Song ohne Abschnitte → Hinweis statt Sprung
        await back(pg); await pg.select_option('#stxSong', '+'); await pg.fill('#stxNewN', 'Skizze'); await pg.click('#stxNewOk'); await pg.wait_for_timeout(200)
        sk = (await pg.evaluate(LS('3nps-lieder')))['songs'][-1]
        check('„＋ Neuer Song …“ legt Song im Songwriting an und wählt ihn', sk['name'] == 'Skizze' and await pg.evaluate("document.getElementById('stxSong').value") == 'l:' + sk['id'])
        await step(pg, 10); await pg.click('#stxTools [data-go="tw:reim"]'); await pg.wait_for_timeout(200)
        check('Song ohne Abschnitte: bleibt hier, Hinweis + „Zu Schritt 4“', await pg.evaluate("AppNav.current()") == 'songtext' and 'keine Abschnitte' in await pg.inner_text('#stxWf .stx-msg') and await pg.is_visible('#stxWf .stx-msg [data-a=to4]'))
        await pg.click('#stxWf .stx-msg [data-a=to4]'); await pg.wait_for_timeout(100)
        check('„Zu Schritt 4“ springt zu den Vorlagen', (await pg.inner_text('#stxH')).startswith('Schritt 4'))
        # Songbook + Mitsingen lernen
        await pick(pg, 'l:sN'); await step(pg, 11); await pg.click('#stxTools [data-go=songbook]')
        oks = await waitfor(pg, "(()=>{const d=JSON.parse(localStorage.getItem('3nps-songbook')||'null');return d&&d.s&&d.s.some(x=>x.id==='ltsN')})()", 8000); await pg.wait_for_timeout(300)
        sb = await pg.evaluate(LS('3nps-songbook')); it = [x for x in sb['s'] if x['id'] == 'ltsN'][0]
        check('→ Songbook: Stück mit Titel, Tonart, Tempo, Akkorden und Text (aktuelle Version), gewählt', oks and await pg.evaluate("AppNav.current()") == 'songbook' and it['t'] == 'Nachtfahrt' and it['b'] == 92 and sb['sel'] == 'ltsN' and '[Strophe' in it['x'] and 'Am' in it['x'], it['x'][:80])
        await pg.evaluate("window.confirm=()=>false;0"); await back(pg); await pg.click('#stxTools [data-go=songbook]'); await pg.wait_for_timeout(1200)
        check('schon im Songbook: nur mit Rückfrage aktualisieren, kein zweites Stück', len([x for x in (await pg.evaluate(LS('3nps-songbook')))['s'] if x['id'] == 'ltsN']) == 1)
        await back(pg); await pg.click('#stxTools [data-go=singlernen]'); await pg.wait_for_timeout(1500)
        check('→ Mitsingen lernen mit diesem Song (über das Songbook) vorgewählt', await pg.evaluate("AppNav.current()") == 'singlernen' and await pg.evaluate("(document.getElementById('mslPiece')||{}).value") == 'sb:ltsN')
        # Checkliste
        await back(pg); await pg.evaluate("(()=>{const s=LiedApi.songs().find(x=>x.id==='sN');s.cur=0;LiedApi.save()})()"); await step(pg, 11)
        auto = await pg.inner_text('#stxX .stx-auto')
        check('Checkliste: Hook im Refrain erkannt, Abschnitte mit Text gezählt', 'Titel/Hook im Refrain: gefunden' in auto and 'Abschnitte mit Text: 2 / 3' in auto, auto)
        for i in range(7): await pg.click('#stxX [data-ck="%d"]' % i)
        await pg.wait_for_timeout(100)
        check('Checkliste: 7 Punkte, gespeichert, „Alles abgehakt“', (await pg.evaluate(LS('3nps-songtext')))['p']['l:sN']['c'] == list(range(7)) and await pg.is_visible('#stxX .stx-allok'))
        # ---------- G: Leitfaden ----------
        await pg.click('.stx-nav [data-view=lf]'); await pg.wait_for_timeout(200)
        th = await pg.evaluate("[...document.querySelectorAll('#stxLf .stx-th span')].map(x=>x.textContent)")
        check('Leitfaden: 11 Themen, zugeklappt', len(th) == 11 and th[0] == '1. Aufbau eines Songs' and th[10] == '11. Stimmung, Tonart und Akkorde' and await pg.evaluate("document.querySelectorAll('#stxLf .stx-tb:not([hidden])').length") == 0, th)
        await pg.click('#stxLf [data-g="3"]'); await pg.wait_for_timeout(100)
        t3 = await pg.inner_text('#stxG3')
        check('Thema aufklappen: Text + erfundenes Beispiel (Statt/Besser)', 'Zwei Teller im Schrank' in t3 and 'Statt' in t3 and await pg.get_attribute('#stxLf [data-g="3"]', 'aria-expanded') == 'true')
        if SHOT: await pg.click('#stxLf [data-g="5"]'); await shot(pg, 'v165-2-leitfaden.png'); await pg.click('#stxLf [data-g="5"]')
        await pg.click('#stxLf [data-a=lfAll]'); await pg.wait_for_timeout(100)
        check('„Alle aufklappen“; jedes Thema mit Beispiel', await pg.evaluate("document.querySelectorAll('#stxLf .stx-tb:not([hidden]) .stx-ex').length") == 11)
        await pg.click('#stxLf [data-go="tw:akk"]'); await pg.wait_for_timeout(500)
        check('Leitfaden-Knopf „Akkorde nach Stimmung“ springt in die Werkstatt', await pg.evaluate("AppNav.current()") == 'lied' and await pg.evaluate("!!document.querySelector('#ldTwBox [data-pane=akk].active')"))
        await back(pg)
        check('Seite merkt den Bereich (Leitfaden)', await pg.is_visible('#stxLf') and not await pg.is_visible('#stxWf'))
        # ---------- H: Ideen-Notizbuch ----------
        await pg.click('.stx-nav [data-view=nb]'); await pg.wait_for_timeout(200)
        n0 = len((await pg.evaluate(LS('3nps-songtext')))['n'])
        await pg.click('#stxNbK [data-nk=z]'); await pg.fill('#stxNbX', 'Der Bahnsteig gähnt, die Uhr zählt mit'); await pg.fill('#stxNbG', 'bahnhof, nacht'); await pg.click('#stxNbAdd')
        await pg.click('#stxNbK [data-nk=b]'); await pg.fill('#stxNbX', 'Kreidestriche, halb vom Regen weg #stadt'); await pg.click('#stxNbAdd')
        await pg.click('#stxNbK [data-nk=t]'); await pg.fill('#stxNbX', 'Alles wie nie'); await pg.click('#stxNbAdd'); await pg.wait_for_timeout(200)
        d = await pg.evaluate(LS('3nps-songtext'))
        check('Notieren: 3 Einträge mit Art und Schlagworten (auch #im Text)', len(d['n']) == n0 + 3 and d['n'][2]['k'] == 'z' and d['n'][2]['g'] == ['bahnhof', 'nacht'] and d['n'][1]['g'] == ['stadt'] and d['n'][0]['k'] == 't', [(x['k'], x['g']) for x in d['n'][:3]])
        cnt = lambda: pg.evaluate("document.querySelectorAll('#stxNbL .stx-ni').length")
        await pg.fill('#stxNbQ', 'regen'); await pg.wait_for_timeout(100); c1 = await cnt()
        await pg.fill('#stxNbQ', ''); await pg.click('#stxNbT [data-tag=bahnhof]'); await pg.wait_for_timeout(100); c2 = await cnt(); q = await pg.input_value('#stxNbQ')
        await pg.fill('#stxNbQ', ''); await pg.click('#stxNbF [data-nf=t]'); await pg.wait_for_timeout(100); c3 = await cnt()
        await pg.click('#stxNbF [data-nf=""]'); await pg.wait_for_timeout(100)
        check('Suche (Text), Schlagwort-Chip, Filter „Titel“', c1 == 1 and c2 == 1 and q == '#bahnhof' and c3 == 2, (c1, c2, q, c3))
        if SHOT: await pg.click('.stx-impc [data-a=dice]'); await shot(pg, 'v165-3-notizbuch.png')
        # In Song übernehmen (Zeile an Refrain von Nachtfahrt V1 … aktuell V2 mit Vorlage → neueste Version nehmen)
        ver0 = await song(pg, 'sN')
        zid = d['n'][2]['id']
        await pg.click('#stxNbL [data-id="%s"][data-a=nbTake]' % zid); await pg.wait_for_timeout(100)
        await pg.select_option('#stxTkS', 'sL'); await pg.wait_for_timeout(100)
        popts = await pg.evaluate("[...document.querySelectorAll('#stxTkP option')].map(o=>o.textContent)")
        ri = str([i for i, x in enumerate(popts) if x.startswith('Refrain')][0])
        await pg.select_option('#stxTkP', ri); await pg.click('#stxNbL [data-a=tkGo]'); await pg.wait_for_timeout(300)
        s = await song(pg, 'sL'); rf = [p for p in s['versions'][-1]['parts'] if p['type'] == 'chorus'][0]
        check('„In Song …“: Abschnitte des Songs wählbar, hängt als neue Version an', any('Refrain' in x and 'leer' in x for x in popts) and len(s['versions']) == 2 and rf['lyrics'][0] == 'Der Bahnsteig gähnt, die Uhr zählt mit' and s['versions'][-1]['note'] == 'Notiz übernommen' and not any(p.get('lyrics') for p in s['versions'][0]['parts']), popts)
        await pg.click('#stxNbL [data-id="%s"][data-a=nbTake]' % zid); await pg.select_option('#stxTkS', 'sL'); await pg.wait_for_timeout(100); await pg.select_option('#stxTkP', ri); await pg.click('#stxNbL [data-a=tkGo]'); await pg.wait_for_timeout(300)
        s = await song(pg, 'sL'); rf = [p for p in s['versions'][-1]['parts'] if p['type'] == 'chorus'][0]
        check('zweites Mal: wird angehängt (nichts überschrieben), vorige Version bleibt', rf['lyrics'][0].count('Der Bahnsteig') == 2 and len(s['versions']) == 3 and [p for p in s['versions'][1]['parts'] if p['type'] == 'chorus'][0]['lyrics'][0].count('Bahnsteig') == 1, rf['lyrics'])
        check('Songwriting zeigt den Ziel-Song (aktiv)', (await pg.evaluate(LS('3nps-lieder')))['active'] == 'sL')
        tid = d['n'][0]['id']; await pg.click('#stxNbL [data-id="%s"][data-a=nbTake]' % tid); await pg.wait_for_timeout(100); await pg.click('#stxNbL [data-a=tkNew]'); await pg.wait_for_timeout(200)
        check('Titel-Notiz: „Neuer Song mit diesem Titel“', (await pg.evaluate(LS('3nps-lieder')))['songs'][-1]['name'] == 'Alles wie nie')
        await pg.evaluate("window.confirm=()=>false;0"); await pg.click('#stxNbL [data-id="%s"][data-a=nbDel]' % tid); await pg.wait_for_timeout(100); k1 = len((await pg.evaluate(LS('3nps-songtext')))['n'])
        await pg.evaluate("window.__q='';window.confirm=m=>{window.__q=m;return true};0"); await pg.click('#stxNbL [data-id="%s"][data-a=nbDel]' % tid); await pg.wait_for_timeout(100); k2 = len((await pg.evaluate(LS('3nps-songtext')))['n'])
        check('Löschen nur nach Rückfrage (Abbrechen behält)', k1 == n0 + 3 and k2 == n0 + 2 and 'Alles wie nie' in await pg.evaluate("window.__q"), (k1, k2))
        # Export / Import-Rundlauf
        async with pg.expect_download() as dl: await pg.click('#stxExp')
        path = await (await dl.value).path(); j = json.load(open(path, encoding='utf8'))
        check('Export: JSON „3nps-songtext“ mit Notizen und Songs (Kernsatz, Wortfeld, Haken)', j['app'] == '3nps-songtext' and len(j['n']) == n0 + 2 and 'l:sN' in j['p'] and len(j['p']['l:sN']['wf']['w']) >= 3, (len(j['n']), list(j['p'])[:3]))
        await pg.evaluate("localStorage.removeItem('3nps-songtext')"); await tab(pg, 'lernen'); await back(pg)
        await pg.click('.stx-nav [data-view=nb]'); await pg.wait_for_timeout(100)
        check('nach Löschen des Speichers leer', await cnt() == 0)
        await pg.set_input_files('#stxFile', path); await pg.wait_for_timeout(500)
        d2 = await pg.evaluate(LS('3nps-songtext'))
        check('Import: alles zurück (Notizen, Haken, Wortfeld, Kernsatz)', len(d2['n']) == n0 + 2 and d2['p']['l:sN']['d'] == [2, 5] and d2['p']['l:sN']['wf']['w'] == j['p']['l:sN']['wf']['w'] and await cnt() == n0 + 2 and 'Importiert:' in await pg.inner_text('#stxNb .stx-msg'), await pg.inner_text('#stxNb .stx-msg'))
        await pg.set_input_files('#stxFile', path); await pg.wait_for_timeout(500)
        check('zweiter Import: nichts doppelt', len((await pg.evaluate(LS('3nps-songtext')))['n']) == n0 + 2 and '0 neu' in await pg.inner_text('#stxNb .stx-msg'), await pg.inner_text('#stxNb .stx-msg'))
        bad = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False); bad.write('{"app":"3nps-songbook","s":[]}'); bad.close()
        await pg.set_input_files('#stxFile', bad.name); await pg.wait_for_timeout(400)
        check('fremde Datei wird abgelehnt', 'keine Notizbuch-Datei' in await pg.inner_text('#stxNb .stx-msg'))
        check('„Alles sichern“ nimmt den Schlüssel mit (3nps-…)', await pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('3nps-')).includes('3nps-songtext')"))
        await pg.click('.stx-impc [data-a=dice]'); await pg.click('#stxDiceS'); await pg.wait_for_timeout(100)
        check('Schreibimpulse im Notizbuch: würfeln + als Idee notieren', len((await pg.evaluate(LS('3nps-songtext')))['n']) == n0 + 3 and await cnt() == n0 + 3)
        # ---------- I: Kachel, Übezeit, Fehler ----------
        await tab(pg, 'lernen'); await pg.wait_for_timeout(300)
        tile = await pg.evaluate("document.querySelector('.ln-tile[data-t=songtext]').textContent")
        check('Kachel zeigt Schritte des zuletzt gewählten Songs', '/ 11 Schritte' in tile or 'Notiz' in tile, tile[:90])
        check('keine Übezeit geschrieben', await pg.evaluate("localStorage.getItem('3nps-uebezeit')") == uz0)
        check('keine Skriptfehler', not errs, errs[:3])
        await pg.context.close()
        # ---------- J: Profile, Größen, Englisch ----------
        for dev in ['auto', 'new', 'old', 'min']:
            pg, errs = await newpage(b, extra="localStorage.setItem('3nps-device','%s');" % dev)
            await tab(pg, 'songtext'); await waitfor(pg, "window.Songtext && Songtext.built()"); await pick(pg, 'l:sN'); await step(pg, 4)
            await pg.click('#stxTplGo'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("({ov:document.documentElement.scrollWidth<=innerWidth+1, v:JSON.parse(localStorage.getItem('3nps-lieder')).songs[0].versions.length})")
            check('Profil %s: Vorlage geht, keine Überbreite, keine Fehler' % dev, r['ov'] and r['v'] == 2 and not errs, (r, errs[:2]))
            await pg.context.close()
        for w, hh in [(820, 1180), (390, 844)]:
            for dev in ['auto', 'min']:
                pg, errs = await newpage(b, w, hh, extra="localStorage.setItem('3nps-device','%s');localStorage.setItem('3nps-songtext',JSON.stringify({v:1,cur:'l:sN',view:'wf',p:{},n:[{id:'a',x:'Erfundene Zeile',k:'z',g:['test'],at:1}]}));" % dev)
                await tab(pg, 'songtext'); await waitfor(pg, "window.Songtext && Songtext.built()")
                small = []
                for v in ['wf', 'lf', 'nb']:
                    await pg.click('.stx-nav [data-view=%s]' % v); await pg.wait_for_timeout(150)
                    if v == 'wf':
                        for st in [3, 4, 11]:
                            await step(pg, st)
                            small += await pg.evaluate("[...document.querySelectorAll('#stxRoot button')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<43.5).map(b=>b.id||b.textContent).slice(0,5)")
                    if v == 'lf': await pg.click('#stxLf [data-g="0"]')
                    if v == 'nb': await pg.click('#stxNbL [data-a=nbTake]')
                    small += await pg.evaluate("[...document.querySelectorAll('#stxRoot button, #stxRoot select, #stxRoot input:not([type=file])')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<43.5).map(b=>b.id||b.textContent).slice(0,5)")
                ov = await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
                check('%d×%d %s: keine Überbreite, Bedienelemente ≥ 44 px' % (w, hh, dev), ov and not small and not errs, (small[:5], errs[:2]))
                if SHOT and w == 390 and dev == 'auto':
                    await pg.click('.stx-nav [data-view=wf]'); await step(pg, 4); await pg.evaluate("document.getElementById('stxS').scrollIntoView()"); await shot(pg, 'v165-5-telefon.png')
                await pg.context.close()
        pg, errs = await newpage(b, q='?lang=en')
        await tab(pg, 'songtext'); await waitfor(pg, "window.Songtext && Songtext.built()"); await step(pg, 4); await pg.click('#stxTipsB'); await pg.wait_for_timeout(300)
        txt = await pg.inner_text('#stxRoot')
        await pg.click('.stx-nav [data-view=lf]'); await pg.click('#stxLf [data-a=lfAll]'); await pg.wait_for_timeout(200); txt2 = await pg.inner_text('#stxLf')
        de = re.findall(r'[^\n]*(?:\b(?:und|der|die|das|nicht|Schritt|Zeile|Strophe)\b)[^\n]*', (txt + '\n' + txt2).replace('Staub und Sterne', ''))
        check('Englisch: Seite englisch (Workflow + Leitfaden)', 'Write lyrics' in txt and 'Set the structure' in txt and 'How do I know it works?' in txt and 'Show, don’t tell' in txt2 and not de, de[:4])
        check('Englisch: Chip übersetzt', await pg.inner_text('#tab-songtext') == 'Write lyrics')
        check('keine Skriptfehler (EN)', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
