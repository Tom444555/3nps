# v30: Songwriting Schritt 3 + 4 – Text mit Silben/Reimen, Leadsheet-PDF, Song-Code mit Claude hin und zurück
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
CODE = """Klar, hier ist ein Anfang:

```
=== 3NPS SONG-CODE v1 ===
Titel: Nachtfahrt
Tonart: A-Moll
Tempo: 92
Thema: Allein im Auto, Abschied
Ablauf: Strophe | Refrain | Strophe | Refrain x2

## Strophe [Strophe]
Akkorde: Am F C G
Text 1:
Ich fahr durch die Nacht
und die Straße ist leer
hab an dich gedacht
doch du bist nicht mehr
Text 2:
(leer)

## Refrain [Refrain]
Akkorde: F G Am Am
Text 1:
Nachtfahrt, nur ich und der Wind
Nachtfahrt, bis wir woanders sind

Notiz: erster Entwurf
=== ENDE ===
```
Viel Spaß beim Ausprobieren!"""
async def loadloop(pg, f='chords/c_pop_strum.wav'):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + f)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if await pg.evaluate("!!Looper._chords(0)"): break
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, accept_downloads=True)
        await ctx.grant_permissions(['microphone', 'clipboard-read', 'clipboard-write'], origin='http://localhost:8765')
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        check('Version ab v30', any(x in await pg.inner_text('.brand') for x in ('v30', 'v31', 'v32', 'v33')), await pg.inner_text('.brand'))
        await pg.click('#tab-lied'); await pg.wait_for_timeout(200)
        check('Ohne Song: Claude-Karte sichtbar, Text-Karte nicht', await pg.is_visible('#ldAiCard') and not await pg.is_visible('#ldTextCard'))
        # 1) Ohne Song: Vorlage kopieren
        await pg.click('#ldCopy'); await pg.wait_for_timeout(200)
        clip = await pg.evaluate("navigator.clipboard.readText()")
        check('Kopieren: Aufgabe + Regeln + leere Vorlage in der Zwischenablage', 'Aufgabe: Schreib den Text weiter' in clip and '=== 3NPS SONG-CODE v1 ===' in clip and '## Refrain [Refrain]' in clip, clip[:80])
        await pg.select_option('#ldGoal', 'eigen'); await pg.click('#ldCopy'); await pg.wait_for_timeout(100)
        check('Eigener Wunsch: erst Feld ausfüllen', 'Wunsch' in await pg.inner_text('#ldStatus') and await pg.is_visible('#ldOwn'))
        await pg.fill('#ldOwn', 'Schreib einen Song über eine Nachtfahrt'); await pg.click('#ldCopy'); await pg.wait_for_timeout(100)
        check('Eigener Wunsch landet im Prompt', 'Aufgabe: Schreib einen Song über eine Nachtfahrt' in await pg.evaluate("navigator.clipboard.readText()"))
        # 2) Antwort einlesen → neuer Song
        await pg.evaluate("t => navigator.clipboard.writeText(t)", CODE)
        await pg.click('#ldClip'); await pg.wait_for_timeout(300)
        r = await pg.inner_text('#ldImRes')
        check('Aus Zwischenablage eingelesen, Vorschau mit Notiz', 'Nachtfahrt' in r and 'erster Entwurf' in r, r.replace('\n', ' ')[:140])
        check('Ohne Song: nur „Als neuer Song“', not await pg.is_visible('#ldImRes [data-a="take"]') and await pg.is_visible('#ldImRes [data-a="new"]'))
        await pg.click('#ldImRes [data-a="new"]'); await pg.wait_for_timeout(300)
        s = await pg.evaluate("Lied.song()"); v = s['versions'][s['cur']]
        check('Neuer Song „Nachtfahrt“: A-Moll, 92 BPM, 2 Teile, Ablauf 4, Text', s['name'] == 'Nachtfahrt' and v['key'] == {'pc': 9, 'major': False} and v['bpm'] == 92 and len(v['parts']) == 2 and len(v['order']) == 4 and v['parts'][0]['lyrics'][0].startswith('Ich fahr'), [s['name'], v['key'], v['bpm']])
        # 3) Text-Karte
        slots = await pg.evaluate("[...document.querySelectorAll('.ld-tx')].map(x => x.querySelector('.ld-txh b').textContent)")
        check('Textfelder: Strophe 1. + 2. Mal, Refrain einmal', slots == ['Strophe · 1. Mal', 'Strophe · 2. Mal', 'Refrain'], slots)
        gut = await pg.evaluate("[...document.querySelectorAll('.ld-tx')[0].querySelectorAll('.ld-gut div')].map(d => d.textContent).filter(Boolean)")
        check('Silben und Reime je Zeile (Strophe: ABAB)', gut == ['5A', '6B', '5A', '5B'], gut)
        st = await pg.inner_text('.ld-tx >> nth=0 >> .ld-txs')
        check('Kopfzeile: Zeilen, Takte, Reimschema, Silben', 'Reim ABAB' in st and '4 Zeilen' in st, st)
        await pg.click('.ld-tx >> nth=1 >> .ld-txt')
        await pg.keyboard.type('Die Lichter der Stadt\nsind so unendlich weit\nich hab es gewagt\nund es hat keine Zeit')
        await pg.wait_for_timeout(700)
        gut2 = await pg.evaluate("[...document.querySelectorAll('.ld-tx')[1].querySelectorAll('.ld-gut div')].map(d => d.textContent).filter(Boolean)")
        check('Tippen: Anzeige läuft mit', len(gut2) == 4 and gut2[1][-1] == gut2[3][-1], gut2)
        saved = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-lieder')).songs.find(s => s.name === 'Nachtfahrt')")
        sv = saved['versions'][saved['cur']]
        check('Text gespeichert', sv['parts'][0]['lyrics'][1].startswith('Die Lichter der Stadt'))
        await pg.fill('#ldTheme', 'Allein im Auto, Abschied, Morgengrauen'); await pg.wait_for_timeout(600)
        await pg.reload(); await pg.wait_for_timeout(800); await pg.click('#tab-lied'); await pg.wait_for_timeout(300)
        check('Nach Neuladen: Text und Thema noch da', 'Die Lichter der Stadt' in await pg.input_value('.ld-tx >> nth=1 >> .ld-txt') and 'Morgengrauen' in await pg.input_value('#ldTheme'))
        # 4) Prüfen inkl. Text
        await pg.click('#ldCheck'); await pg.wait_for_timeout(200)
        f = await pg.inner_text('#ldFind')
        check('Prüfen enthält Textprüfung (Titel im Refrain)', 'Titel steckt im Refrain' in f, f.replace('\n', ' | ')[:300])
        # 5) Leadsheet-PDF
        async with pg.expect_download() as dl:
            await pg.click('#ldPdf')
        d = await dl.value; path = O + 'v30_lead.pdf'; await d.save_as(path)
        data = open(path, 'rb').read()
        check('Leadsheet als PDF', data[:5] == b'%PDF-' and len(data) > 1500 and d.suggested_filename.startswith('Nachtfahrt'), (d.suggested_filename, len(data)))
        # 6) Song mit Aufnahme: Code exportieren, Claude ändert nur Text → Aufnahme bleibt
        await loadloop(pg)
        await pg.click('#loopSong'); await pg.wait_for_timeout(200); await pg.select_option('#ldDSong', 'new'); await pg.fill('#ldDNew', 'Mit Aufnahme'); await pg.click('#ldDOk'); await pg.wait_for_timeout(800)
        await pg.click('#loopSong'); await pg.wait_for_timeout(200); await pg.click('#ldDOk'); await pg.wait_for_timeout(800)
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        await pg.click('#tab-lied'); await pg.wait_for_timeout(300)
        await pg.click('.ld-tx >> nth=0 >> .ld-txt'); await pg.keyboard.type('Erste Zeile hier\nzweite Zeile dort'); await pg.wait_for_timeout(600)
        await pg.select_option('#ldGoal', 'reime'); await pg.click('#ldCopy'); await pg.wait_for_timeout(100)
        clip = await pg.evaluate("navigator.clipboard.readText()")
        check('Song-Code mit Aufnahme-Song: Text, Akkorde, Stimme', 'Text 1:\nErste Zeile hier' in clip and 'Akkorde: C G Am F' in clip and 'Stimme:' in clip and 'Reime' in clip)
        code = clip[clip.index('=== 3NPS'):]
        newc = code.replace('Erste Zeile hier\nzweite Zeile dort', 'Erste Zeile hier im Licht\nzweite Zeile, ich seh dich nicht').replace('Notiz:', 'Notiz: Reime geglättet')
        await pg.fill('#ldPaste', newc); await pg.click('#ldRead'); await pg.wait_for_timeout(200)
        r = await pg.inner_text('#ldImRes')
        check('Vorschau: nur Text geändert, keine stumme Aufnahme', '„Strophe“: Text geändert' in r and 'stumm' not in r and 'Reime geglättet' in r, r.replace('\n', ' ')[:200])
        await pg.click('#ldImRes [data-a="hear"]'); await pg.wait_for_timeout(250)
        if not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"): await pg.click('#ldImRes [data-a="hear"]'); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(3500)
        lg = await pg.evaluate("Lied.log()")
        check('Anhören spielt den Vorschlag mit Aufnahmen', len(lg) >= 1 and await pg.inner_text('#ldStatus') == '▶ Vorschlag von Claude', (len(lg), await pg.inner_text('#ldStatus')))
        n0 = await pg.evaluate("Lied.song().versions.length")
        await pg.click('#ldImRes [data-a="take"]'); await pg.wait_for_timeout(300)
        s = await pg.evaluate("Lied.song()"); v = s['versions'][s['cur']]
        check('Übernommen als neue Version, Notiz „Claude: …“, Aufnahme gültig', len(s['versions']) == n0 + 1 and v['note'].startswith('Claude: Reime') and v['parts'][0]['audio'] and v['parts'][0]['audioSig'] == ' '.join(f"{c['r']}{c['t']}:{c['beats']}" for c in v['parts'][0]['chords']), v['note'])
        check('Wiedergabe beim Übernehmen gestoppt', not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"))
        # Akkorde per Code geändert → Aufnahme stumm angekündigt
        code = (await pg.evaluate("Lied.prompt()")); code = code[code.index('=== 3NPS'):]
        await pg.fill('#ldPaste', code.replace('Akkorde: C G Am F', 'Akkorde: C G Am F:½ G:½', 1)); await pg.click('#ldRead'); await pg.wait_for_timeout(200)
        check('Akkordänderung: Hinweis „Aufnahme wird stumm“', 'Aufnahme wird stumm' in await pg.inner_text('#ldImRes'))
        await pg.click('#ldImRes [data-a="drop"]')
        # Fehler
        await pg.fill('#ldPaste', code.replace('Ablauf: ', 'Ablauf: Vers | ', 1)); await pg.click('#ldRead'); await pg.wait_for_timeout(200)
        check('Fehlerhafter Code: verständliche Meldung, nichts übernommen', '„Vers“ gibt es nicht' in await pg.inner_text('#ldImRes') and not await pg.is_visible('#ldImRes [data-a="take"]'))
        await pg.fill('#ldPaste', 'Danke, sieht gut aus!'); await pg.click('#ldRead'); await pg.wait_for_timeout(100)
        check('Kein Code: Hinweis', 'Kein Song-Code gefunden' in await pg.inner_text('#ldImRes'))
        # 7) Sicherung enthält Text (localStorage-Schlüssel 3nps-lieder)
        has = await pg.evaluate("Object.keys(localStorage).includes('3nps-lieder') && localStorage.getItem('3nps-lieder').includes('Erste Zeile hier im Licht')")
        check('Text liegt im gesicherten Speicher', has)
        await pg.screenshot(path=O + 'v30_text.png', full_page=False)
        # 8) iPhone: kein seitliches Scrollen
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(400)
        ov = await pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        check('iPhone: Songwriting ohne seitliches Scrollen', ov <= 1, ov)
        await (await pg.query_selector('#ldTextCard')).screenshot(path=O + 'v30_text_phone.png')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
