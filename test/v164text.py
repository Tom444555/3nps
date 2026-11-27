# v164: Text-Werkstatt unter „Song & Gesang“ › Songwriting › „Text“. Prüft: Logik (node test/v164reime.js: Reimstufen, Silben, Reimwörter,
# Stimmung → Akkorde in 6 Tonarten inkl. Toms Beispiel, Prompt, Einlesen, Baukasten), Bau (erst beim Öffnen geladen, Offline-Liste, Reimliste in
# eigenem Speicher, Lizenz, index.html < 2,1 MB), im Browser mit erfundenem Song: Reime prüfen (farbig, rein/unrein/gleiches Wort, Hinweise),
# Reimwörter (Liste wird erst jetzt geladen, Wort einsetzen = neue Version), Akkorde nach Stimmung (Toms Beispiel, ▶ Anhören, Übernehmen = Version),
# Baukasten (Gerüst, Wort tauschen, Ersetzen = Version), Prompt (alle Felder, Zeile besser formulieren), Einlesen über „Mit Claude weiterarbeiten“
# (Zeilen-Vorschläge, freier Text, Song-Code wie bisher), Version zurück, keine Übezeit, offline (Service Worker), Profile, 3 Größen, EN, keine Skriptfehler.
# Aufruf: python3 test/v164text.py  (~2 min)   SHOT=1 → Bilder nach /home/claude/bilder/v164-*.png
import asyncio, gzip, json, os, re, subprocess
from playwright.async_api import async_playwright
from nav import tab
HERE = os.path.dirname(os.path.abspath(__file__)); WWW = HERE + '/../app/www/'; U = 'http://localhost:8765/index.html'
SHOT = os.environ.get('SHOT'); SH = '/home/claude/bilder/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info)[:300] if info != '' else ''), flush=True)
# erfundener Song (keine echten Liedtexte)
VERSE = '[Am]Die Ampel blinkt im leeren Licht\nder Regen fällt auf meine Tür\nein Bus fährt ab, er wartet nicht\nich frag den Wind, er antwortet mir'
CHORUS = 'Wir fahren durch die Nacht\nwir fahren durch die Nacht\nund irgendwie ist halt die ganze Stadt jetzt eigentlich noch wach\nbis der Morgen lacht'
CH = lambda *rs: [{'r': r, 't': t, 'beats': 4} for (r, t) in rs]
SONG = {'active': 's1', 'songs': [{'id': 's1', 'name': 'Staub und Sterne', 'created': 1764000000000, 'voice': None, 'cur': 0, 'versions': [{'n': 1, 'at': 1764000000000, 'note': 'Start', 'key': {'pc': 0, 'major': True}, 'bpm': 92, 'theme': 'Nachtfahrt durch die leere Stadt',
        'parts': [{'id': 'p1', 'name': 'Strophe', 'type': 'verse', 'chords': CH((9, 'm'), (5, ''), (0, ''), (7, '')), 'lyrics': [VERSE], 'audio': None},
                  {'id': 'p2', 'name': 'Refrain', 'type': 'chorus', 'chords': CH((5, ''), (7, ''), (0, ''), (0, '')) * 2, 'lyrics': [CHORUS], 'audio': None}],
        'order': [{'p': 'p1', 'reps': 1}, {'p': 'p2', 'reps': 1}, {'p': 'p1', 'reps': 1}, {'p': 'p2', 'reps': 1}]}]}]}
UZ = {"v": 1, "u": [[1764000000, 1800, 1, "ges"]]}
def init(extra=''):
    return ("if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-lieder',%s);localStorage.setItem('3nps-uebezeit',%s);%s}"
            % (json.dumps(json.dumps(SONG)), json.dumps(json.dumps(UZ)), extra))
async def newpage(b, w=1366, h=1024, extra='', q='', sw='block'):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, service_workers=sw); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(init(extra)); await pg.goto(U + q); await pg.wait_for_timeout(900)
    return pg, errs
async def waitfor(pg, expr, timeout=8000):
    for _ in range(timeout // 100):
        if await pg.evaluate('!!(' + expr + ')'): return True
        await pg.wait_for_timeout(100)
    raise TimeoutError(expr)
async def openTw(pg):
    await tab(pg, 'lied'); await pg.wait_for_timeout(300)
    await pg.click('#ldTw'); await waitfor(pg, "window.TextWerk && document.querySelector('#twBody')", 8000); await pg.wait_for_timeout(200)
async def shot(pg, n, sel=None):
    if not SHOT: return
    os.makedirs(SH, exist_ok=True); await pg.wait_for_timeout(300)
    if sel: await pg.evaluate("document.querySelector(%s).scrollIntoView({block:'start'})" % json.dumps(sel)); await pg.evaluate("scrollBy(0,-125)"); await pg.wait_for_timeout(200)
    await pg.screenshot(path=SH + n)
ver = lambda pg: pg.evaluate("LiedApi.ver().n")
lyr = lambda pg, pid, n=0: pg.evaluate("(LiedApi.ver().parts.find(p=>p.id==='%s').lyrics||[])[%d]||''" % (pid, n))
async def main():
    # ---------- A: Logik (Node) ----------
    out = subprocess.run(['node', HERE + '/v164reime.js'], capture_output=True, text=True).stdout.strip().split('\n')
    for l in out[:-1]:
        if l.startswith(('OK', 'FEHLER')): check('Logik: ' + l[8:].split('  · ')[0], l.startswith('OK'), l.split('  · ')[1] if '  · ' in l and l.startswith('FEHLER') else '')
    # ---------- B: Bau ----------
    h = open(WWW + 'index.html', encoding='utf8').read(); sw = open(WWW + 'sw.js', encoding='utf8').read()
    check('index.html < 2,1 MB, ohne Werkstatt-Code (nur Knopf + Lader)', len(h.encode()) < 2100000 and 'TextWerk =' not in h and 'tw-sech' not in h and 'id="ldTw"' in h and "'textwerk.js'" in h, len(h.encode()))
    core = sw.split('const CORE')[1].split('\n')[0]
    check('sw.js: textwerk.js/.css in der Offline-Liste, Reimliste in eigenem Speicher (reim-1), Cache ab v164', "'textwerk.js'" in core and "'textwerk.css'" in core and 'reim' not in core and "const REIM = 'reim-1'" in sw and "includes('/reim/')" in sw and int(re.search(r"3nps-v(\d+)", sw).group(1)) >= 164)
    lst = open(WWW + 'reim/reim-de-1.txt', 'rb').read(); gz = len(gzip.compress(lst, 9))
    check('Reimliste: %.2f MB, gepackt %.2f MB, Lizenz CC BY 4.0 + Quelle beiliegend' % (len(lst) / 1e6, gz / 1e6), len(lst) < 2.5e6 and gz < 0.8e6 and 'Attribution 4.0 International' in open(WWW + 'reim/LIZENZ-MFA.txt', encoding='utf8').read() and 'McAuliffe' in open(WWW + 'reim/QUELLE.txt', encoding='utf8').read())
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        # ---------- C: Laden ----------
        pg, errs = await newpage(b)
        check('ab v164', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 164)
        await tab(pg, 'lied'); await pg.wait_for_timeout(400)
        res = lambda: pg.evaluate("performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/textwerk\\.(js|css)|reim-de/.test(n)).map(n=>n.split('/').pop())")
        check('Songwriting lädt textwerk.js/.css und die Reimliste noch nicht', await res() == [] and not await pg.evaluate("!!window.TextWerk"))
        check('Knopf „Text-Werkstatt“ im Bereich „Text“', await pg.is_visible('#ldTextCard #ldTw') and (await pg.inner_text('#ldTw')).strip() == 'Text-Werkstatt')
        await pg.click('#ldTw'); await waitfor(pg, "window.TextWerk && document.querySelector('#twBody')", 8000); await pg.wait_for_timeout(300)
        r = await res()
        check('Antippen lädt textwerk.js/.css (Reimliste noch nicht)', 'textwerk.js' in r and 'textwerk.css' in r and 'reim-de-1.txt' not in r, r)
        # ---------- D: Reime prüfen ----------
        info = await pg.evaluate("""(()=>{const L=[...document.querySelectorAll('#twBody .tw-line')];return {n:L.length, lv:L.map(x=>x.querySelector('.tw-lv').textContent.trim()), let:L.map(x=>x.querySelector('.tw-let').textContent),
           col:L.map(x=>getComputedStyle(x.querySelector('.tw-w')||x).color), hints:[...document.querySelectorAll('#twBody .tw-hints li')].map(x=>x.textContent), sch:[...document.querySelectorAll('#twBody .tw-sech span')].map(x=>x.textContent)}})()""")
        check('Reime prüfen: 8 Zeilen, Schema ABAB / AABA', info['n'] == 8 and info['sch'][0].startswith('Schema ABAB') and info['sch'][1].startswith('Schema AABA'), info['sch'])
        # v165 (Zusatz): Buchstaben links am Text == Schema der Werkstatt für dieselben Zeilen, unrein mit „~“
        gl = await pg.evaluate("[...document.querySelectorAll('.ld-tx')].map(b=>[...b.querySelectorAll('.ld-gut b')].map(x=>x.textContent).join('')).filter(Boolean).slice(0,2)")
        check('ab v165: Buchstaben am Text = Schema der Werkstatt (unrein mit ~)', [g.replace('~', '') for g in gl] == [x.split(' ')[1] for x in info['sch'][:2]] and '~' in gl[0], (gl, info['sch'][:2]))
        check('Stufen sichtbar: rein ↔ 1, ~ unrein ↔ 2, = gleiches Wort ↔ 1, ohne Reim', info['lv'][2] == 'rein ↔ 1' and info['lv'][3] == '~ unrein ↔ 2' and info['lv'][5] == '= gleiches Wort ↔ 1' and info['lv'][6] == 'ohne Reim', info['lv'])
        check('Reimpaare farbig (gleiche Farbe je Buchstabe, Partnerlose grau)', info['col'][0] == info['col'][2] and info['col'][1] == info['col'][3] and info['col'][0] != info['col'][1] and info['col'][6] == 'rgb(138, 138, 138)', info['col'][:4])
        check('Hinweise als ruhige Liste (gleiches Wort, Füllwörter, lange Zeile, Silben), ohne Noten', len(info['hints']) >= 4 and any('Füllwort' in x for x in info['hints']) and any('lang' in x for x in info['hints']) and any('demselben Wort' in x for x in info['hints']) and not any(re.search(r'\bNote\b|/10|Punkte', x) for x in info['hints']), info['hints'])
        await pg.fill('#ldTexts .ld-tx[data-id=p1] textarea', VERSE + '\nund bleib noch wach bis spät'); await pg.wait_for_timeout(700)
        check('Tippen im Text aktualisiert die Prüfung', await pg.evaluate("document.querySelectorAll('#twBody .tw-line').length") == 9)
        await pg.fill('#ldTexts .ld-tx[data-id=p1] textarea', VERSE); await pg.wait_for_timeout(700)
        await shot(pg, 'v164-1-reime.png', '#ldTwBox')
        # ---------- E: Reimwörter ----------
        await pg.click('#twBody .tw-line[data-pid=p1][data-i="1"]'); await pg.wait_for_timeout(200)
        check('Zeile antippen → „Reimwörter zu „Tür““ und „Diese Zeile besser formulieren“', await pg.is_visible('[data-a=l-wort]') and 'Tür' in await pg.inner_text('[data-a=l-wort]') and await pg.is_visible('[data-a=l-prompt]'))
        await pg.click('[data-a=l-wort]'); await waitfor(pg, "document.querySelector('#twWRes .tw-word')", 10000); await pg.wait_for_timeout(200)
        r = await res(); words = await pg.evaluate("[...document.querySelectorAll('#twWRes .tw-word.rein')].map(x=>x.dataset.w)"); un = await pg.evaluate("[...document.querySelectorAll('#twWRes .tw-word.unrein')].map(x=>x.dataset.w)")
        check('Reimwörter: Liste erst jetzt geladen, „Tür“ → für/dafür …, unrein mir/dir/hier', 'reim-de-1.txt' in r and 'für' in words and any(x in un for x in ['mir', 'dir', 'hier']), (words[:6], un[:6]))
        await pg.click('[data-a=w-syl][data-s="1"]'); await pg.wait_for_timeout(200)
        one = await pg.evaluate("[...document.querySelectorAll('#twWRes .tw-word')].map(x=>x.dataset.w)")
        check('Filter „1 Silbe“', one and all(len(re.findall(r'(ie|ei|ai|au|eu|äu|[aeiouäöüy])', w)) == 1 for w in one), one[:8])
        await pg.click('[data-a=w-syl][data-s="0"]'); await pg.wait_for_timeout(200)
        await shot(pg, 'v164-2-reimwoerter.png', '#twBody')
        v0 = await ver(pg)
        await pg.click('#twWRes .tw-word[data-w="für"]'); await pg.wait_for_timeout(300)
        check('Reimwort antippen setzt es in die Zeile (neue Version, Großschreibung, Akkordmarke bleibt)', await ver(pg) == v0 + 1 and (await lyr(pg, 'p1')).split('\n')[1] == 'der Regen fällt auf meine Für' and (await lyr(pg, 'p1')).startswith('[Am]Die Ampel'), await lyr(pg, 'p1'))
        await pg.fill('#twWord', 'Sonnenuntergangsglut'); await pg.click('[data-a=w-go]'); await pg.wait_for_timeout(1200)
        check('Unbekanntes Wort → Reime nach Schreibung', 'nicht in der Liste' in await pg.inner_text('#twWRes') and await pg.evaluate("document.querySelectorAll('#twWRes .tw-word').length") > 3)
        # ---------- F: Akkorde nach Stimmung ----------
        await pg.click('[data-pane=akk]'); await pg.wait_for_timeout(200)
        await pg.fill('#twMood', 'traurig, mit Spannungsabfall danach im Refrain'); await pg.click('[data-a=m-parse]'); await pg.wait_for_timeout(300)
        mi = await pg.inner_text('#twMoodRes'); sel = await pg.evaluate("[...document.querySelectorAll('#twBody select[data-sec]')].map(s=>s.dataset.sec+':'+s.dataset.k+'='+s.value)")
        check('Toms Beispiel: erkannt, Knöpfe gesetzt (Strophe traurig, Refrain traurig + fällt ab)', 'traurig' in mi and 'Spannung fällt ab' in mi and 'Nicht verstanden' not in mi and 'verse:mood=traurig' in sel and 'chorus:mood=traurig' in sel and 'chorus:tens=ab' in sel, (mi, sel))
        progs = await pg.evaluate("[...document.querySelectorAll('#twAkRes .tw-sec')].map(s=>[s.querySelector('b').textContent,[...s.querySelectorAll('.tw-pch')].map(x=>x.textContent)])")
        check('Vorschläge: je Abschnitt 2–3 Folgen in C-Dur über a-Moll, Refrain löst auf Am auf', len(progs) == 2 and all(2 <= len(x[1]) <= 3 for x in progs) and progs[1][0] == 'Refrain' and all(x.endswith('Am') for x in progs[1][1]) and progs[1][1][0] == 'F G Am Am', progs)
        check('Begründung je Folge, Kopf ohne Lücken', await pg.evaluate("[...document.querySelectorAll('#twAkRes .tw-why')].every(x=>x.textContent.length>25)") and 'undefined' not in await pg.inner_text('#twAkRes'))
        await shot(pg, 'v164-3-akkorde.png', '#twBody')
        await pg.click('#twAkRes .tw-sec:nth-child(2) [data-a=m-hear][data-i="0"]'); await pg.wait_for_timeout(1200)
        pl = await pg.evaluate("LiedApi.playing()")
        check('▶ Anhören spielt die Folge über die vorhandene Wiedergabe (mit Fläche)', pl and 'F G Am Am' in pl and await pg.evaluate("document.getElementById('ldTP').checked"), pl)
        await pg.click('#twAkRes .tw-sec:nth-child(2) [data-a=m-hear][data-i="0"]'); await pg.wait_for_timeout(300)
        check('nochmal tippen stoppt', not await pg.evaluate("LiedApi.playing()"))
        v0 = await ver(pg)
        await pg.click('#twAkRes .tw-sec:nth-child(2) [data-a=m-take][data-i="1"]'); await pg.wait_for_timeout(300)
        chn = await pg.evaluate("LiedText.chordText(LiedApi.ver().parts.find(p=>p.id==='p2').chords, LiedApi.ver().key)")
        check('Übernehmen: Refrain „Dm E Am Am“ ×2 (8 Takte bleiben), neue Version, Text bleibt', await ver(pg) == v0 + 1 and chn == 'Dm E Am Am Dm E Am Am' and await lyr(pg, 'p2') == CHORUS and 'Dm E Am Am' in await pg.inner_text('#ldStatus'), chn)
        # ---------- G: Baukasten ----------
        await pg.click('[data-pane=kit]'); await pg.wait_for_timeout(200)
        await pg.select_option('#twKTheme', 'heimweg'); await pg.click('[data-a=k-go]'); await pg.wait_for_timeout(300)
        kl = await pg.evaluate("[...document.querySelectorAll('#twKOut .tw-kl')].map(x=>x.querySelector('.tw-let').textContent+':'+x.querySelector('.tw-tx').textContent)")
        check('Baukasten: Gerüst mit 4 Zeilen im Schema ABAB', len(kl) == 4 and ''.join(x[0] for x in kl) == 'ABAB', kl)
        await pg.evaluate("[...document.querySelectorAll('#twKOut .tw-kw')].find(x=>+x.dataset.wi>0 && /^[A-ZÄÖÜ]/.test(x.textContent) && x.nextElementSibling).click()"); await pg.wait_for_timeout(200)
        alts = await pg.evaluate("[...document.querySelectorAll('#twKAlts .tw-word')].map(x=>x.dataset.w)")
        li = await pg.evaluate("+document.querySelector('#twKOut .tw-kw.on').dataset.li")
        before = await pg.evaluate("document.querySelectorAll('#twKOut .tw-kl .tw-tx')[%d].textContent" % li)
        await pg.click('#twKAlts .tw-word'); await pg.wait_for_timeout(200)
        after = await pg.evaluate("document.querySelectorAll('#twKOut .tw-kl .tw-tx')[%d].textContent" % li)
        check('Wort antippen → Alternativen, Tausch im Gerüst', len(alts) >= 3 and before != after and alts[0] in after, (alts[:5], after))
        await shot(pg, 'v164-4-baukasten.png', '#twBody')
        v0 = await ver(pg)
        await pg.select_option('#twKTo', '0'); await pg.click('[data-a=k-app]'); await pg.wait_for_timeout(300)
        t = await lyr(pg, 'p1')
        check('„Anhängen (neue Version)“: alter Text bleibt, Gerüst dahinter', await ver(pg) == v0 + 1 and t.startswith('[Am]Die Ampel') and t.count('\n') == 7 and after in t)
        # ---------- H: Prompt ----------
        await pg.click('[data-pane=prompt]'); await pg.wait_for_timeout(200)
        await pg.fill('#twPTheme', 'Leere Stadt um drei Uhr'); await pg.fill('#twPMood', 'traurig, am Ende hoffnungsvoll'); await pg.select_option('#twPLang', 'de'); await pg.select_option('#twPPersp', 'wir')
        await pg.select_option('#twPScheme', 'AABB'); await pg.fill('#twPSyl', '7'); await pg.fill('#twPOwn', 'die Ampel blinkt gelb, niemand wartet')
        await pg.uncheck('#twPParts input[value=p1]'); await pg.click('[data-a=p-copy]'); await pg.wait_for_timeout(300)
        pr = await pg.evaluate("window.__lastPrompt||''")
        need = ['Thema: Leere Stadt um drei Uhr', 'Stimmung: traurig, am Ende hoffnungsvoll', 'Sprache des Textes: Deutsch', 'Wir-Perspektive', 'Reimschema je Abschnitt: AABB', 'Silben je Zeile: etwa 7', 'Abschnitte: „Refrain“', 'die Ampel blinkt gelb', '=== 3NPS SONG-CODE v1 ===', 'Antwortformat']
        check('„Prompt kopieren“: alle Felder + Song-Code + Formatvorgabe', all(x in pr for x in need) and 'Kopiert' in await pg.inner_text('#ldStatus') or all(x in pr for x in need), [x for x in need if x not in pr])
        await pg.click('[data-a=p-view]'); await pg.wait_for_timeout(200)
        check('„Prompt ansehen“ zeigt den Text', await pg.is_visible('#twPView') and 'Thema: Leere Stadt' in await pg.input_value('#twPView'))
        await shot(pg, 'v164-5-prompt.png', '#twBody')
        await pg.click('[data-pane=reim]'); await pg.wait_for_timeout(200)
        await pg.click('#twBody .tw-line[data-pid=p1][data-i="2"]'); await pg.click('[data-a=l-prompt]'); await pg.wait_for_timeout(200)
        check('„Diese Zeile besser formulieren“ wählt die Aufgabe im Prompt-Fenster', await pg.input_value('#twPTask') == 'zeile')
        await pg.click('[data-a=p-copy]'); await pg.wait_for_timeout(200); lp = await pg.evaluate("window.__lastPrompt||''")
        check('Zeilen-Prompt: Zeile, Reimpartner, Format „=== 3NPS ZEILEN ===“', 'Zeile: ein Bus fährt ab, er wartet nicht' in lp and 'reimen' in lp and '=== 3NPS ZEILEN ===' in lp, lp[:160])
        # ---------- I: Einlesen über „Mit Claude weiterarbeiten“ ----------
        ans = 'Hier fünf Ideen:\n```\n=== 3NPS ZEILEN ===\nTeil: Strophe\nZeile: ein Bus fährt ab, er wartet nicht\n1. der letzte Bus, er wartet nicht\n2. ein Bus fährt weg und hält mich nicht\n3. der Fahrer winkt und wartet nicht\n4. ein Bus verschwindet ohne Sicht\n5. die Tür geht zu, er wartet nicht\n=== ENDE ===\n```'
        await pg.fill('#ldPaste', ans); await pg.click('#ldRead'); await pg.wait_for_timeout(400)
        li = await pg.evaluate("[...document.querySelectorAll('#ldImRes .tw-alts2 li')].map(x=>x.textContent)")
        check('Einlesen: Zeilen-Vorschläge mit Vorschau (5, Silben)', len(li) == 5 and 'Silben' in li[0] and 'Zeilen-Vorschläge' in await pg.inner_text('#ldImRes'), li[:2])
        await shot(pg, 'v164-6-einfuegen.png', '#ldAiCard')
        v0 = await ver(pg)
        await pg.click('#ldImRes [data-tw-take="2"]'); await pg.wait_for_timeout(300)
        check('„Diese nehmen“ ersetzt die Zeile (neue Version)', await ver(pg) == v0 + 1 and (await lyr(pg, 'p1')).split('\n')[2] == 'der Fahrer winkt und wartet nicht' and await pg.inner_text('#ldImRes') == '')
        free = 'Gern! Hier ein Vorschlag:\n\nStrophe:\nDie Stadt ist still, die Fenster dunkel\nnur ein Hund bellt irgendwo\n\n**Refrain**\nWir fahren los, wir fahren weit\nund nehmen nur die Nacht mit'
        await pg.fill('#ldPaste', free); await pg.click('#ldRead'); await pg.wait_for_timeout(400)
        im = await pg.evaluate("[...document.querySelectorAll('#ldImRes [data-tw-to]')].map(s=>s.options[s.selectedIndex].text)")
        check('Freier Text: als Textvorschlag erkannt, Abschnitte zugeordnet (Einleitungssatz nicht übernehmen)', 'Textvorschlag' in await pg.inner_text('#ldImRes') and im[-2:] == ['Strophe · 1. Mal', 'Refrain'], im)
        v0 = await ver(pg); old_p1 = await lyr(pg, 'p1')
        await pg.select_option('#ldImRes [data-tw-to="0"]', '-1'); await pg.click('#ldImRes [data-tw-free]'); await pg.wait_for_timeout(300)
        check('„Als neue Version übernehmen“: Strophe und Refrain neu', await ver(pg) == v0 + 1 and (await lyr(pg, 'p1')).startswith('Die Stadt ist still') and (await lyr(pg, 'p2')).startswith('Wir fahren los'))
        await pg.fill('#ldPaste', 'Nur eine Zeile ohne alles\nund noch eine'); await pg.click('#ldRead'); await pg.wait_for_timeout(300)
        check('Text ohne Überschriften → ein Block mit Ziel-Auswahl', await pg.evaluate("document.querySelectorAll('#ldImRes [data-tw-to]').length") == 1)
        await pg.click('#ldImRes [data-tw-drop]'); await pg.wait_for_timeout(200)
        await pg.fill('#ldPaste', 'Danke, sieht gut aus!'); await pg.click('#ldRead'); await pg.wait_for_timeout(200)
        check('Ein einzelner Satz bleibt „Kein Song-Code gefunden“ (wie bisher)', 'Kein Song-Code gefunden' in await pg.inner_text('#ldImRes'))
        code = await pg.evaluate("LiedText.toCode(LiedApi.song(), LiedApi.ver()).replace('Tempo: 92','Tempo: 96')")
        await pg.fill('#ldPaste', 'Antwort:\n```\n' + code + '\n```'); await pg.click('#ldRead'); await pg.wait_for_timeout(300)
        check('Song-Code wird wie bisher gelesen (Vorschau „Vorschlag von Claude“)', 'Vorschlag von Claude' in await pg.inner_text('#ldImRes') and 'Tempo: 92 → 96' in await pg.inner_text('#ldImRes'))
        await pg.click('#ldImRes [data-a=drop]')
        # Version zurück
        await pg.click('#swNav [data-sw=song]'); await pg.wait_for_timeout(200)   # v167: Versionen liegen im Bereich „Song“
        await pg.select_option('#ldVer', '0'); await pg.wait_for_timeout(300)
        check('Version V1 zurückholen: Originaltext und -akkorde wieder da', await lyr(pg, 'p1') == VERSE and await lyr(pg, 'p2') == CHORUS and await pg.evaluate("LiedApi.ver().parts[1].chords[0].r") == 5)
        check('keine Übezeit geschrieben', json.loads(await pg.evaluate("localStorage.getItem('3nps-uebezeit')")) == UZ)
        check('keine Skriptfehler (Hauptlauf)', not errs, errs[:3])
        await pg.context.close()
        # ---------- J: offline über den Service Worker ----------
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, service_workers='allow'); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.add_init_script(init())
        await pg.goto(U); await pg.evaluate("navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => true)")
        await pg.reload(); await pg.wait_for_timeout(2500)
        cs = await pg.evaluate("(async()=>{const k=await caches.keys();const r=await caches.open('reim-1');const rk=(await r.keys()).map(x=>x.url.split('/').pop());const a=await caches.open(k.find(x=>x.startsWith('3nps-v')));const ak=(await a.keys()).map(x=>x.url.split('/').pop());return {k,rk,tw:ak.filter(x=>/textwerk/.test(x))}})()")
        check('Service Worker: Reimliste vorab in „reim-1“, textwerk.js/.css im App-Speicher', 'reim-de-1.txt' in cs['rk'] and sorted(cs['tw']) == ['textwerk.css', 'textwerk.js'], cs)
        await ctx.set_offline(True); await pg.reload(); await pg.wait_for_timeout(1200)
        await openTw(pg); await pg.click('[data-pane=wort]'); await pg.fill('#twWord', 'Herz'); await pg.click('[data-a=w-go]')
        await waitfor(pg, "document.querySelector('#twWRes .tw-word')", 8000)
        check('offline: Werkstatt öffnet, Reimwörter zu „Herz“ (schmerz)', 'schmerz' in await pg.evaluate("[...document.querySelectorAll('#twWRes .tw-word')].map(x=>x.dataset.w).join(' ')"))
        check('offline: keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        # ---------- K: Profile, Größen, Englisch ----------
        for dev in ['auto', 'new', 'old', 'min']:
            pg, errs = await newpage(b, extra="localStorage.setItem('3nps-device','%s');" % dev)
            await openTw(pg)
            good = []
            for pn in ['reim', 'wort', 'akk', 'kit', 'prompt']:
                await pg.click('[data-pane=%s]' % pn); await pg.wait_for_timeout(150)
                good.append(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1 && document.querySelector('#twBody').children.length>0"))
            check('Profil %s: alle fünf Ansichten, keine Überbreite' % dev, all(good) and not errs, (good, errs[:2]))
            await pg.context.close()
        for w, hh in [(820, 1180), (390, 844)]:
            pg, errs = await newpage(b, w, hh); await openTw(pg)
            small = []; ov = True
            for pn in ['reim', 'akk', 'kit', 'prompt']:
                await pg.click('[data-pane=%s]' % pn); await pg.wait_for_timeout(150)
                if pn == 'akk': await pg.click('[data-a=m-go]'); await pg.wait_for_timeout(150)
                if pn == 'kit': await pg.click('[data-a=k-go]'); await pg.wait_for_timeout(150)
                r = await pg.evaluate("""(()=>{const bs=[...document.querySelectorAll('#ldTextCard button')].filter(b=>b.offsetParent&&!b.closest('.card-head'));return {ov:document.documentElement.scrollWidth<=innerWidth+1,small:bs.filter(b=>b.getBoundingClientRect().height<43.5).map(b=>b.textContent.slice(0,20)).slice(0,4)}})()""")
                ov = ov and r['ov']; small += r['small']
            check('%d×%d: keine Überbreite, Knöpfe der Werkstatt ≥ 44 px (Kopfzeile wie „Leadsheet (PDF)“)' % (w, hh), ov and not small and not errs, (small[:4], errs[:2]))
            if SHOT and w == 390:
                await pg.click('[data-pane=akk]'); await pg.click('[data-a=m-go]'); await shot(pg, 'v164-7-telefon.png', '#twBody')
            await pg.context.close()
        pg, errs = await newpage(b, q='?lang=en'); await openTw(pg)
        nav = await pg.evaluate("[...document.querySelectorAll('.tw-nav button')].map(x=>x.textContent)")
        check('Englisch: Knopf und Reiter übersetzt, Hinweis „German lyrics“', (await pg.inner_text('#ldTw')).strip() == 'Text workshop' and nav[0] == 'Check rhymes' and 'German lyrics' in await pg.inner_text('.tw-en'), nav)
        check('keine Skriptfehler (EN)', not errs, errs[:3])
        await b.close()
    print('%d/%d' % (ok, tot))
if __name__ == "__main__": asyncio.run(main())
