# v161: Songbook (Lernen › Songbook) – Liste + Stück, „▶ Laden“, Bearbeiten, Transponieren, Übezeit je Stück, Export/Import.
# Nur erfundene Stücke („Nachtfahrt“, „Blues in E (eigener)“, „Staub und Sterne“, „Übungsstück Dorisch“) – keine echten Liedtexte.
# SHOT=1 → /home/claude/bilder/v161-*.png (iPad quer, Bearbeiten, Rückfrage beim Laden, Telefon)
import asyncio, os, re, json, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/'); SHOT = os.environ.get('SHOT')
WWW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'www') + '/'
BILD = '/home/claude/bilder/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))

NACHT = 'Strophe\nAm          F           C          G\nDie Straße leer, das Radio leise …\n\nRefrain\nF           C           G          Am\nWir fahren, bis der Morgen kommt …'
SONGS = [
    {'id': 'n1', 't': 'Nachtfahrt', 'r': 9, 'm': 'Äolisch (Moll)', 'b': 92, 'ts': '4/4', 'dk': 'rock', 'dn': 'Rock', 'x': NACHT, 'rid': 'blues', 'rnm': 'Blues Crunch', 'rt': 'reactor', 'c': 4000, 'e': 4000, 'l': 0},
    {'id': 'b2', 't': 'Blues in E (eigener)', 'r': 4, 'm': 'Mixolydisch', 'b': 76, 'ts': '12/8', 'dk': 'shuffle_tx', 'dn': 'Texas Shuffle', 'x': 'E7 | A7 | E7 | E7\nA7 | A7 | E7 | E7\nB7 | A7 | E7 | B7', 'c': 3000, 'e': 3000},
    {'id': 's3', 't': 'Staub und Sterne', 'r': 2, 'm': 'Ionisch (Dur)', 'b': 120, 'ts': '4/4', 'dk': 'pop', 'dn': 'Pop (16tel)', 'x': 'Intro\nD    G    A    D\nStaub auf der Straße, Sterne im Blick', 'c': 2000, 'e': 2000},
    {'id': 'd4', 't': 'Übungsstück Dorisch', 'r': 2, 'm': 'Dorisch', 'b': 100, 'ts': '4/4', 'dk': '', 'x': 'Dm7        G7\nDm7        G7   (x2)', 'c': 1000, 'e': 1000},
]

async def ctxpage(b, w=1366, h=1024, init=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
    if init: await ctx.add_init_script("if(!sessionStorage.getItem('i')){sessionStorage.setItem('i',1);" + init + "}")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    return ctx, pg, errs
async def ready(pg):
    for _ in range(100):
        if await pg.evaluate("!!window.Songbook && Songbook.built() && !!document.getElementById('sgbNew')"): return True
        await pg.wait_for_timeout(50)
    return False
async def seed(pg, songs=SONGS):
    await pg.evaluate("s => { localStorage.setItem('3nps-songbook', JSON.stringify({ v: 1, sel: '', fs: 1, s })); Songbook.open(); }", songs)
async def rows(pg): return await pg.evaluate("[...document.querySelectorAll('.sgb-row')].map(r => r.dataset.id)")
async def msg(pg): return await pg.inner_text('#sgbMsg')

async def main():
    os.makedirs(BILD, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        h = open(WWW + 'index.html', encoding='utf8').read()
        check('index.html < 2,1 MB', len(h.encode()) < 2100000, len(h.encode()))
        check('Songbook-Code nicht in index.html, eigene Dateien', 'window.Songbook = ' not in h and os.path.exists(WWW + 'songbook.js') and os.path.exists(WWW + 'songbook.css'))
        sw = open(WWW + 'sw.js', encoding='utf8').read()
        check('sw.js: songbook.js/.css in der Offline-Liste, Cache ab v161', all("'%s'" % f in sw.split('const CORE')[1].split('\n')[0] for f in ['songbook.js', 'songbook.css']) and int(re.search(r"'3nps-v(\d+)'", sw).group(1)) >= 161)
        hd = open(WWW + 'hilfe-daten.js', encoding='utf8').read()
        check('Anleitung: Thema „songbook“', "id: 'songbook'" in hd)
        en = open(WWW + 'i18n-en.js', encoding='utf8').read()
        check('Englische Texte vorhanden', all(k in en for k in ['"＋ Neues Stück"', '"Übezeit zu diesem Stück"', '"Tonart ändern"', '"Trotzdem laden"']))

        ctx, pg, errs = await ctxpage(b, init="localStorage.setItem('3nps-tab','looper');")
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1200)
        check('ab v161', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 161)
        check('Start: Songbook nicht geladen', await pg.evaluate("!window.Songbook && ![...document.scripts].some(s => /songbook/.test(s.src)) && !document.querySelector('link[href=\"songbook.css\"]')"))
        check('Chip „Songbook“ unter Lernen vor „Übezeit“', await pg.evaluate("(() => { const c = [...document.querySelectorAll('#subNav [data-area=lernen]')].map(x => x.dataset.tab); return c.indexOf('songbook') >= 0 && c.indexOf('songbook') < c.indexOf('uebezeit') && c.slice(c.indexOf('songbook') + 1, c.indexOf('uebezeit')).every(x => x === 'singlernen'); })()"))
        await open_tab(pg, 'lernen'); await pg.wait_for_timeout(300)
        check('Kachel „Songbook“ in der Übersicht', await pg.evaluate("!!document.querySelector('.ln-tile[data-t=songbook]')"))
        await pg.click('.ln-tile[data-t=songbook]')
        check('Öffnen lädt songbook.js/.css nach', await ready(pg) and await pg.evaluate("!!document.querySelector('link[href=\"songbook.css\"]')"))
        check('Leerer Zustand freundlich', 'Noch kein Stück' in await pg.inner_text('#sgbS'))

        # ---------- Anlegen über den Dialog ----------
        await pg.click('#sgbNew'); await pg.wait_for_timeout(200)
        check('Dialog „Neues Stück“ offen', await pg.is_visible('#sgbAsk .sgb-askbox'))
        await pg.click('[data-f=save]'); await pg.wait_for_timeout(100)
        check('Ohne Titel: Hinweis, nichts gespeichert', 'Titel' in await pg.inner_text('#sgbFE') and await pg.evaluate("Songbook.load().s.length") == 0)
        await pg.fill('#sgbFT', 'Nachtfahrt'); await pg.select_option('#sgbFR', '9'); await pg.select_option('#sgbFM', 'Äolisch (Moll)')
        await pg.evaluate("const b = document.getElementById('bpm'); b.value = 92; b.dispatchEvent(new Event('input'))")
        await pg.fill('#sgbFB', '60'); await pg.click('[data-f=bpm]')
        check('„aktuelles Tempo übernehmen“', await pg.input_value('#sgbFB') == '92')
        await pg.select_option('#sgbFD', 'rock'); await pg.fill('#sgbFX', NACHT)
        for _ in range(40):
            if await pg.evaluate("document.querySelectorAll('#sgbFRig option').length > 2"): break
            await pg.wait_for_timeout(100)
        rig_opts = await pg.evaluate("[...document.querySelectorAll('#sgbFRig option')].map(o => o.value)")
        check('Rig-Bibliothek in der Auswahl (Rig-Code nachgeladen, ohne 3D)', 'blues' in rig_opts and await pg.evaluate("!!window.Rig && !Rig.three()"), rig_opts)
        await pg.select_option('#sgbFRig', 'blues'); await pg.select_option('#sgbFRt', 'reactor')
        if SHOT: await pg.evaluate("document.getElementById('sgbFE').textContent = ''"); await pg.screenshot(path=BILD + 'v161-bearbeiten.png')
        await pg.click('[data-f=save]'); await pg.wait_for_timeout(200)
        d = await pg.evaluate("Songbook.load()")
        s0 = d['s'][0] if d['s'] else {}
        check('Angelegt und gespeichert (ein Schlüssel)', len(d['s']) == 1 and s0.get('t') == 'Nachtfahrt' and s0.get('b') == 92 and s0.get('r') == 9 and s0.get('dk') == 'rock' and s0.get('rid') == 'blues' and s0.get('rt') == 'reactor', s0)
        tx = await pg.inner_text('#sgbS')
        check('Stück angezeigt mit Kacheln', all(k in tx for k in ['A-Moll', '92', 'Rock', 'Blues Crunch · Reactor 50']))
        # Bearbeiten: Titel ändern
        await pg.click('#sgbS [data-a=edit]'); await pg.wait_for_timeout(200)
        await pg.fill('#sgbFT', 'Nachtfahrt 2'); await pg.click('[data-f=save]'); await pg.wait_for_timeout(150)
        check('Bearbeiten ändert denselben Eintrag', await pg.evaluate("Songbook.load().s.map(s => s.t)") == ['Nachtfahrt 2'])
        # Löschen mit Rückfrage
        await pg.click('#sgbS [data-a=edit]'); await pg.wait_for_timeout(150)
        await pg.click('[data-f=del]'); await pg.wait_for_timeout(100)
        check('Löschen: erst Rückfrage', await pg.evaluate("Songbook.load().s.length") == 1 and 'Wirklich' in await pg.inner_text('[data-f=del]'))
        await pg.click('[data-f=del]'); await pg.wait_for_timeout(150)
        check('Löschen: zweites Tippen löscht', await pg.evaluate("Songbook.load().s.length") == 0 and not await pg.is_visible('#sgbAsk .sgb-askbox'))

        # ---------- Liste, Suche, Sortierung ----------
        await seed(pg)
        check('Sortierung ohne Übe-/Ladezeit: zuletzt angelegt zuerst', await rows(pg) == ['n1', 'b2', 's3', 'd4'], await rows(pg))
        await pg.evaluate("""() => { const d = JSON.parse(localStorage.getItem('3nps-uebezeit') || 'null') || { v: 1, run: null, th: '', nt: '', u: [] };
            const e = Math.floor(Date.now() / 60000) * 60; d.u.push([e - 86400, 3600, 2, 'sbs3', ''], [e - 7200, 1800, 2, 'sbs3', ''], [e - 3 * 86400, 1200, 0, 'sbd4', '']); localStorage.setItem('3nps-uebezeit', JSON.stringify(d)); Songbook.open(); }""")
        check('Sortierung nach „zuletzt geübt“', await rows(pg) == ['s3', 'd4', 'n1', 'b2'], await rows(pg))
        await pg.click('.sgb-row[data-id=s3]'); await pg.wait_for_timeout(100)
        check('„geübt“ = Summe der Einheiten mit diesem Thema (1 h 30 min)', (await pg.inner_text('#sgbGeuebt')).replace('\n', ' ') == '1 h 30 min', await pg.inner_text('#sgbGeuebt'))
        check('Gewähltes Stück leuchtet', await pg.evaluate("document.querySelector('.sgb-row.on').dataset.id") == 's3' and await pg.evaluate("getComputedStyle(document.querySelector('.sgb-row.on')).boxShadow") != 'none')
        await pg.fill('#sgbQ', 'dorisch'); await pg.wait_for_timeout(100)
        check('Suche (Titel/Tonart)', await rows(pg) == ['d4'], await rows(pg))
        await pg.fill('#sgbQ', 'radio leise'); await pg.wait_for_timeout(100)
        check('Suche im Text', await rows(pg) == ['n1'], await rows(pg))
        await pg.fill('#sgbQ', 'gibtsnicht'); await pg.wait_for_timeout(100)
        check('Suche ohne Treffer: Hinweis', 'Nichts gefunden' in await pg.inner_text('#sgbL'))
        await pg.fill('#sgbQ', ''); await pg.wait_for_timeout(100)

        # ---------- Akkordzeilen und Transponieren ----------
        cl = await pg.evaluate("['Am          F           C          G', 'Die Straße leer, das Radio leise …', 'Am Ende', 'Strophe', 'E7 | A7 | E7 | E7', 'Dm7        G7   (x2)', 'C/G  F#m7b5  Bbmaj7  Dsus4  Eadd9', 'Ende', 'A', ''].map(Songbook.isChordLine)")
        check('Akkordzeilen-Erkennung vorsichtig (nur ganze Akkordzeilen)', cl == [True, False, False, False, True, True, True, False, True, False], cl)
        tr = await pg.evaluate("Songbook.transposeText('Am          F           C          G\\nDie Straße leer, das Radio leise …\\nAm Ende des Tages', 2, false)")
        check('Transponieren +2: Akkorde in derselben Spalte, Textzeilen unverändert', tr == 'Bm          G           D          A\nDie Straße leer, das Radio leise …\nAm Ende des Tages', tr)
        tr2 = await pg.evaluate("Songbook.transposeText('C/G F#m7b5 Bbmaj7 | Dsus4', 1, true)")
        check('Transponieren +1 mit ♭-Tonart: Bass, Zusätze, Trennstriche', tr2 == 'Db/Ab Gm7b5 Bmaj7 | Ebsus4', tr2)
        tr3 = await pg.evaluate("Songbook.transposeText('C  C#  C', 1, false)")
        check('Längerer Akkord rückt den nächsten nur so weit wie nötig', tr3 == 'C# D   C#', tr3)
        await pg.click('.sgb-row[data-id=n1]'); await pg.wait_for_timeout(100)
        await pg.click('#sgbS [data-a=tr][data-k="1"]'); await pg.wait_for_timeout(100)
        s = await pg.evaluate("Songbook.load().s.find(s => s.id === 'n1')")
        check('„Tonart ändern +“: A-Moll → Bb-Moll, Akkordzeilen mit ♭', s['r'] == 10 and 'Bbm         Gb          Db         Ab' in s['x'] and 'Die Straße leer, das Radio leise …' in s['x'] and 'Bb-Moll' in await pg.inner_text('#sgbS'), s['x'][:60])
        await pg.click('#sgbS [data-a=tr][data-k="-1"]'); await pg.wait_for_timeout(100)
        check('„Tonart ändern −“ zurück: Text wieder wie vorher', await pg.evaluate("Songbook.load().s.find(s => s.id === 'n1').x") == NACHT)
        await pg.click('#sgbS [data-fs="2"]'); await pg.wait_for_timeout(50)
        fs = await pg.evaluate("[getComputedStyle(document.getElementById('sgbX')).fontSize, Songbook.load().fs]")
        check('Schriftgröße umschaltbar und gemerkt', fs == ['25px', 2], fs)
        await pg.click('#sgbS [data-fs="1"]')

        # ---------- „▶ Laden“ ----------
        await pg.evaluate("rootSel.value = 'G'; modeSel.value = 'Ionisch (Dur)'; rebuild(); rootSel.dispatchEvent(new Event('change')); const b = document.getElementById('bpm'); b.value = 80; b.dispatchEvent(new Event('input')); const st = document.getElementById('loopDrumStyle'); st.value = 'funk'; st.dispatchEvent(new Event('change')); localStorage.removeItem('3nps-rig')")
        await pg.click('#sgbLoad'); await pg.wait_for_timeout(400)
        st = await pg.evaluate("({ bpm: document.getElementById('bpm').value, root: rootSel.value, mode: modeSel.value, drum: document.getElementById('loopDrumStyle').value, on: Rhythm.on(), rig: JSON.parse(localStorage.getItem('3nps-rig') || '{}'), th: Uebezeit.load().th, topic: Uebezeit.topics().c.find(c => c[0] === 'sbn1') })")
        check('Laden setzt Tempo 92, Tonart A Äolisch, Schlagzeug-Stil Rock (Drums bleiben aus)', st['bpm'] == '92' and st['root'] == 'A' and st['mode'] == 'Äolisch (Moll)' and st['drum'] == 'rock' and not st['on'], st)
        check('Laden merkt den Rig-Sound vor (Blues Crunch, Reactor 50)', st['rig'].get('p') == 'blues' and st['rig'].get('t') == 'reactor', st['rig'])
        check('Laden: Stück als Übezeit-Thema (nichts lief)', st['th'] == 'sbn1' and st['topic'] and st['topic'][1] == 'Nachtfahrt', st)
        check('Laden: Meldung + „Zum Looper“', 'Geladen' in await msg(pg) and await pg.is_visible('#sgbMsg [data-a=looper]'), await msg(pg))
        check('Kopfleiste zeigt das Tempo', '92' in await pg.inner_text('.control-bar'))
        check('Zuletzt geladen steht oben in der Liste', (await rows(pg))[0] == 'n1', await rows(pg))
        # Rig geladen → Auswahl direkt im Rig
        await pg.evaluate("Rig.select('funk', 'bias')")
        await pg.click('#sgbS [data-a=rig]'); await pg.wait_for_timeout(500)
        rs = await pg.evaluate("[AppNav.current(), Rig.state().p, Rig.state().t]")
        check('„Im Rig öffnen“ springt ins Rig mit diesem Sound', rs == ['rig', 'blues', 'reactor'], rs)
        await open_tab(pg, 'songbook'); await pg.wait_for_timeout(200)

        # Laufende Übezeit behält ihr Thema
        await pg.evaluate("Uebezeit.setTopic('tech'); Uebezeit.on()")
        await pg.click('.sgb-row[data-id=b2]'); await pg.click('#sgbLoad'); await pg.wait_for_timeout(400)
        u = await pg.evaluate("({ th: Uebezeit.load().th, run: !!Uebezeit.load().run })")
        check('Laufende Übezeit-Einheit behält ihr Thema, Knopf zum Umwählen', u['th'] == 'tech' and u['run'] and await pg.is_visible('#sgbMsg [data-a=topic]'), u)
        await pg.click('#sgbMsg [data-a=topic]'); await pg.wait_for_timeout(100)
        check('„Übezeit-Thema auf dieses Stück“ wählt um', await pg.evaluate("Uebezeit.load().th") == 'sbb2')
        await pg.evaluate("Uebezeit.off({ drop: true })")
        check('Laden: Shuffle-Stil, 76 BPM, E Mixolydisch', await pg.evaluate("[document.getElementById('bpm').value, rootSel.value, modeSel.value, document.getElementById('loopDrumStyle').value]") == ['76', 'E', 'Mixolydisch', 'shuffle_tx'])

        # Rückfrage bei laufendem Looper / ungespeichertem Loop
        await pg.evaluate("""() => { ensureAudio(); const sr = audioCtx.sampleRate, n = Math.round(sr * 2.5), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.sin(i / sr * 2 * Math.PI * 220) * 0.2 * Math.exp(-(i % (sr / 2)) / sr * 8); Looper.loadSamples(a); }""")
        await pg.wait_for_timeout(800)
        lr = await pg.evaluate("[Looper.running(), LooperIdeas.dirty()]")
        await pg.click('.sgb-row[data-id=s3]'); await pg.click('#sgbLoad'); await pg.wait_for_timeout(300)
        check('Looper läuft (Testloop, ungespeichert) → Rückfrage statt Laden', lr == [True, True] and await pg.is_visible('#sgbAsk .sgb-askbox') and await pg.evaluate("document.getElementById('bpm').value") == '76', lr)
        if SHOT:
            await pg.screenshot(path=BILD + 'v161-rueckfrage.png')
        await pg.click('#sgbAsk [data-q=no]'); await pg.wait_for_timeout(200)
        check('„Abbrechen“: nichts geändert, Looper läuft weiter', await pg.evaluate("[document.getElementById('bpm').value, Looper.running(), Looper.hasLoop()]") == ['76', True, True])
        await pg.click('#sgbLoad'); await pg.wait_for_timeout(200); await pg.click('#sgbAsk [data-q=go]'); await pg.wait_for_timeout(500)
        check('„Trotzdem laden“: Looper gestoppt, Tempo 120, Loop bleibt (keine Idee verknüpft)', await pg.evaluate("[document.getElementById('bpm').value, Looper.running(), Looper.hasLoop()]") == ['120', False, True])
        await pg.click('#sgbLoad'); await pg.wait_for_timeout(300)
        check('Gestoppt, aber ungespeichert → wieder Rückfrage', await pg.is_visible('#sgbAsk .sgb-askbox'))
        await pg.click('#sgbAsk [data-q=no]'); await pg.wait_for_timeout(100)

        # Idee speichern, verknüpfen, laden
        await pg.evaluate("rootSel.value = 'D'; modeSel.value = 'Dorisch'; rebuild(); rootSel.dispatchEvent(new Event('change')); const b = document.getElementById('bpm'); b.value = 100; b.dispatchEvent(new Event('input'))")
        await pg.evaluate("(() => { const n = document.getElementById('ideaName'); n.value = 'Dorisch Loop A'; n.dispatchEvent(new Event('input')); document.getElementById('ideaSave').click(); })()"); await pg.wait_for_timeout(800)
        iid = await pg.evaluate("(async () => (await AppDB.list('ideas', i => ({ id: i.id, name: i.name }))).find(i => i.name === 'Dorisch Loop A'))()")
        check('Testidee gespeichert, Loop gilt nicht mehr als ungespeichert', bool(iid) and not await pg.evaluate("LooperIdeas.dirty()"), iid)
        await pg.click('.sgb-row[data-id=d4]'); await pg.click('#sgbS [data-a=edit]'); await pg.wait_for_timeout(400)
        for _ in range(30):
            if await pg.evaluate("[...document.querySelectorAll('#sgbFI option')].some(o => o.textContent === 'Dorisch Loop A')"): break
            await pg.wait_for_timeout(100)
        await pg.select_option('#sgbFI', iid['id']); await pg.click('[data-f=save]'); await pg.wait_for_timeout(200)
        check('Looper-Idee verknüpft und angezeigt', '„Dorisch Loop A“' in await pg.inner_text('#sgbS'))
        await pg.evaluate("Looper.debug().tracks; Looper.loadSamples(new Float32Array(48000).map((_, i) => Math.sin(i / 20) * 0.1))"); await pg.wait_for_timeout(300)
        await pg.evaluate("Looper.stopAll()"); await pg.wait_for_timeout(200)
        await pg.click('#sgbLoad'); await pg.wait_for_timeout(300)
        asked = await pg.is_visible('#sgbAsk .sgb-askbox')
        if asked: await pg.click('#sgbAsk [data-q=go]')
        await pg.wait_for_timeout(1200)
        ls = await pg.evaluate("[document.getElementById('loopStatus').textContent, document.getElementById('ideaName').value, rootSel.value, modeSel.value, document.getElementById('bpm').value, LooperIdeas.dirty()]")
        check('Laden mit Idee: erst Rückfrage (neuer ungespeicherter Loop), dann Idee wie „Laden“ der Liste', asked and 'Dorisch Loop A' in ls[0] and ls[1] == 'Dorisch Loop A' and ls[2:5] == ['D', 'Dorisch', '100'] and ls[5] is False, ls)
        # Fehlende Idee
        await pg.evaluate("(async () => { const d = Songbook.load(); d.s.find(s => s.id === 'd4').iid = 'weg123'; d.s.find(s => s.id === 'd4').inm = 'Alte Idee'; Songbook.store(d); Songbook.open(); })()")
        await pg.evaluate("const b = document.getElementById('bpm'); b.value = 80; b.dispatchEvent(new Event('input'))")
        await pg.click('#sgbLoad'); await pg.wait_for_timeout(300)
        if await pg.is_visible('#sgbAsk .sgb-askbox'): await pg.click('#sgbAsk [data-q=go]')   # Tempo geändert → Loop gilt als geändert
        await pg.wait_for_timeout(500)
        m = await msg(pg)
        check('Fehlende Idee sauber gemeldet, Tempo/Tonart trotzdem gesetzt', 'gibt es nicht mehr' in m and 'Alte Idee' in m and await pg.evaluate("document.getElementById('bpm').value") == '100' and 'warn' in await pg.get_attribute('#sgbMsg', 'class'), m)

        # „Übezeit zu diesem Stück“
        await pg.click('.sgb-row[data-id=s3]'); await pg.click('#sgbS [data-a=uz]'); await pg.wait_for_timeout(500)
        check('„Übezeit zu diesem Stück“ → Seite Übezeit mit diesem Thema', await pg.evaluate("[AppNav.current(), Uebezeit.load().th, Uebezeit.tname('sbs3')]") == ['uebezeit', 'sbs3', 'Staub und Sterne'])
        await open_tab(pg, 'songbook'); await pg.wait_for_timeout(200)

        # ---------- Export / Import ----------
        before = await pg.evaluate("Songbook.load().s")
        async with pg.expect_download() as dl:
            await pg.click('#sgbExp')
        path = await (await dl.value).path(); j = json.load(open(path, encoding='utf8'))
        check('Export: JSON mit allen Stücken', j.get('app') == '3nps-songbook' and len(j['s']) == 4, len(j.get('s', [])))
        await pg.evaluate("localStorage.removeItem('3nps-songbook'); Songbook.open()")
        await pg.set_input_files('#sgbFile', path); await pg.wait_for_timeout(400)
        after = await pg.evaluate("Songbook.load().s")
        am = {x['id']: x for x in after}
        diff = [(x['id'], k) for x in before for k in x if am.get(x['id'], {}).get(k) != x[k]]
        check('Import: Rundlauf gleich (alle Felder)', len(after) == len(before) and not diff, (diff[:4], await msg(pg)))
        await pg.set_input_files('#sgbFile', path); await pg.wait_for_timeout(400)
        check('Import zweimal: keine Dubletten', await pg.evaluate("Songbook.load().s.length") == 4 and '0 neu' in await msg(pg) and '4 schon vorhanden' in await msg(pg), await msg(pg))
        r = await pg.evaluate("Songbook.merge([{ id: 'x9', t: 'Nachtfahrt', x: Songbook.load().s.find(s => s.id === 'n1').x }, { id: 'n1', t: 'Nachtfahrt (neu)', r: 9, m: 'Äolisch (Moll)', b: 95, e: Date.now() + 1000 }, { id: 'z1', t: 'Neues Stück aus Datei', b: 300 }, { t: 'ohne id' }])")
        check('Zusammenführen: gleicher Inhalt übersprungen, neuere Fassung gewinnt, Tempo begrenzt', r == {'add': 1, 'upd': 1, 'same': 1} and await pg.evaluate("[Songbook.load().s.find(s => s.id === 'n1').t, Songbook.load().s.find(s => s.id === 'z1').b]") == ['Nachtfahrt (neu)', 200], r)
        await pg.set_input_files('#sgbFile', files=[{'name': 'x.json', 'mimeType': 'application/json', 'buffer': b'{"a":1}'}]); await pg.wait_for_timeout(300)
        check('Fremde Datei: klare Meldung', 'keine Songbook-Datei' in await msg(pg))
        await open_tab(pg, 'lernen'); await pg.wait_for_timeout(300)
        check('Übersicht: Kachel zählt die Stücke', '5 Stücke' in await pg.inner_text('.ln-tile[data-t=songbook]'), await pg.inner_text('.ln-tile[data-t=songbook]'))
        await open_tab(pg, 'songbook'); await pg.wait_for_timeout(200)
        await pg.click('#sgbS [data-a=edit]'); await pg.wait_for_timeout(100); await pg.evaluate("AppNav.show('looper')"); await pg.wait_for_timeout(100)
        check('Verlassen der Seite schließt einen offenen Dialog', not await pg.is_visible('#sgbAsk .sgb-askbox'))
        check('Keine Skriptfehler (iPad quer)', not errs, errs[:3])
        await ctx.close()

        # ---------- Layouts, Profile, Optiken, Englisch ----------
        S2 = [dict(x, iid='bild1', inm='Nachtfahrt Strophe') if x['id'] == 'n1' else x for x in SONGS]   # nur Anzeige
        uz = {'v': 1, 'run': None, 'th': '', 'nt': '', 'u': [[1795600000, 7800, 2, 'sbn1', ''], [1795680000, 5400, 2, 'sbn1', '']]}
        seed_js = "localStorage.setItem('3nps-tab','songbook');localStorage.setItem('3nps-songbook'," + json.dumps(json.dumps({'v': 1, 'sel': 'n1', 'fs': 1, 's': S2})) + ");localStorage.setItem('3nps-uebezeit'," + json.dumps(json.dumps(uz)) + ");"
        for (w, hh, name) in [(1366, 1024, 'quer'), (820, 1180, 'hochkant'), (390, 844, 'telefon')]:
            ctx, pg, errs = await ctxpage(b, w, hh, seed_js + "localStorage.setItem('3nps-theme','nordic');localStorage.setItem('3nps-theme2','nordic');")
            await pg.goto(U + 'index.html'); await ready(pg); await pg.wait_for_timeout(500)
            box = await pg.evaluate("(() => { const a = document.querySelector('.sgb-list').getBoundingClientRect(), b = document.querySelector('.sgb-song').getBoundingClientRect(); return { lw: a.width, lh: a.height, sx: b.x, sy: b.y, ab: a.bottom, ar: a.right, sw: b.width, sh: b.height, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()")
            if name == 'quer':
                check('1366×1024: links Liste, rechts Stück', box['sx'] >= box['ar'] and box['sy'] < 400 and not box['over'], box)
                if SHOT: await pg.screenshot(path=BILD + 'v161-liste-stueck.png')
            elif name == 'hochkant':
                check('820×1180: Liste oben, Stück darunter', box['sy'] >= box['ab'] and box['lh'] < 560 and not box['over'], box)
            else:
                check('390×844: erst nur die Liste', box['sh'] == 0 and box['lh'] > 0 and not box['over'], box)
                await pg.click('.sgb-row[data-id=b2]'); await pg.wait_for_timeout(200)
                v = await pg.evaluate("[document.querySelector('.sgb-list').offsetHeight, document.querySelector('.sgb-song').offsetHeight, document.querySelector('.sgb-back').offsetHeight, document.documentElement.scrollWidth <= innerWidth + 1]")
                check('390×844: Antippen → Stück mit „‹ Zurück“', v[0] == 0 and v[1] > 0 and v[2] >= 44 and v[3], v)
                if SHOT: await pg.screenshot(path=BILD + 'v161-telefon.png')
                await pg.click('.sgb-back'); await pg.wait_for_timeout(100)
                check('390×844: „‹ Zurück“ → Liste', await pg.evaluate("document.querySelector('.sgb-list').offsetHeight > 0 && document.querySelector('.sgb-song').offsetHeight === 0"))
            small = await pg.evaluate("[...document.querySelectorAll('#sgbRoot button')].filter(b => b.offsetWidth && (b.offsetHeight < 44 || b.offsetWidth < 44)).map(b => b.textContent.trim() + ' ' + b.offsetWidth + 'x' + b.offsetHeight)")
            check(name + ': Bedienelemente ≥ 44 px', not small, small[:4])
            check(name + ': keine Skriptfehler', not errs, errs[:3])
            await ctx.close()
        for dev in ['new', 'old', 'min', 'auto']:
            for th in (['nordic', 'ios', 'precise-dark'] if dev == 'new' else ['nordic']):
                ctx, pg, errs = await ctxpage(b, 1366, 1024, seed_js + "localStorage.setItem('3nps-theme','nordic');localStorage.setItem('3nps-theme2','%s');localStorage.setItem('3nps-device','%s');" % (th, dev))
                await pg.goto(U + 'index.html'); r0 = await ready(pg); await pg.wait_for_timeout(300)
                sh = await pg.evaluate("getComputedStyle(document.querySelector('.sgb-row.on')).boxShadow")
                vis = await pg.evaluate("document.querySelector('.sgb-x').offsetHeight > 100 && getComputedStyle(document.querySelector('.sgb-ch')).color !== getComputedStyle(document.querySelector('.sgb-x')).color")
                if dev in ('old', 'min'): check('Profil %s: kein Schein' % dev, r0 and sh == 'none' and vis, sh)
                else: check('Profil %s / Optik %s: Schein + lesbar' % (dev, th), r0 and sh != 'none' and vis, sh)
                check('Profil %s / Optik %s: keine Skriptfehler' % (dev, th), not errs, errs[:3])
                await ctx.close()
        ctx, pg, errs = await ctxpage(b, 1366, 1024, seed_js + "localStorage.setItem('3nps-lang','en');")
        await pg.goto(U + 'index.html?lang=en'); await ready(pg); await pg.wait_for_timeout(300)
        t = await pg.inner_text('#sgbRoot')
        check('Englisch: Seite übersetzt', all(k in t for k in ['New piece', 'Load', 'Edit', 'Change key', 'Practice time for this piece', 'Chords & lyrics', 'A minor']) and 'Bearbeiten' not in t, t[:300])
        await pg.click('#sgbNew'); await pg.wait_for_timeout(200)
        t = await pg.inner_text('#sgbAsk')
        check('Englisch: Dialog übersetzt', all(k in t for k in ['Title', 'Tempo (BPM)', 'Use current tempo', 'Drums', 'Save', 'Cancel']) and 'Speichern' not in t, t[:300])
        check('Englisch: keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        await b.close()
    print('%d/%d OK' % (ok, tot))
asyncio.run(main())
