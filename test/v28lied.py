# v28: Songwriting – Teile aus dem Looper, Ablauf, Abspielen, Akkorde ändern, Prüfen, Varianten/Versionen, Gesang,
# Sicherung, Zusammenspiel mit Looper/Backing Track/Improvisation, stabile v24 öffnet die Datenbank weiter
import asyncio, zipfile, io, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def loadloop(pg, f='chords/c_pop_strum.wav'):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + f)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if await pg.evaluate("!!Looper._chords(0)"): break
async def capture(pg, typ, mode='new', song=None):
    await pg.click('#tab-looper'); await pg.click('#loopSong'); await pg.wait_for_timeout(200)
    if song: await pg.select_option('#ldDSong', song)
    await pg.select_option('#ldDType', typ); await pg.select_option('#ldDMode', mode); await pg.click('#ldDOk'); await pg.wait_for_timeout(700)
    return await pg.inner_text('#loopStatus')
async def playstart(pg, sel='#ldPlay'):
    await pg.click(sel); await pg.wait_for_timeout(250)
    if not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"): await pg.click(sel); await pg.wait_for_timeout(250)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, accept_downloads=True); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t => t.textContent)")
        check('Reiter Songwriting zwischen Backing Track und Training', tabs == ['Looper', 'Quintenzirkel', 'Improvisation', 'Backing Track', 'Songwriting', 'Training', 'Technik'], tabs)
        await pg.click('#tab-lied'); await pg.wait_for_timeout(200)
        check('Ohne Song: Anleitung sichtbar', await pg.is_visible('#ldEmpty') and 'Looper' in await pg.inner_text('#ldEmpty'))
        # 1) Strophe aus dem Looper
        await loadloop(pg)
        await pg.click('#loopSong'); await pg.wait_for_timeout(200)
        ci = await pg.inner_text('#ldCapInfo')
        check('„→ Song“ zeigt Takte, Tempo, Tonart, Akkorde', '4 Takte' in ci and '96 BPM' in ci and 'C-Dur' in ci and 'C – G – Am – F' in ci, ci.replace('\n', ' '))
        check('Vorschlag: neuer Song, Teil = Strophe', await pg.evaluate("[document.getElementById('ldDSong').value, document.getElementById('ldDType').value]") == ['new', 'verse'])
        await pg.fill('#ldDNew', 'Testlied'); await pg.click('#ldDOk'); await pg.wait_for_timeout(800)
        st = await pg.inner_text('#loopStatus')
        check('Übernommen, Rückmeldung im Looper', 'Strophe' in st and 'Testlied' in st, st)
        au = await pg.evaluate("AppDB.all('meta').then(a => a.filter(r => String(r.key).startsWith('lied-audio:')).map(r => [r.n, r.sr, !!r.r]))")
        check('Aufnahme in der Datenbank (eine volle Runde, 10 s)', len(au) == 1 and abs(au[0][0] / au[0][1] - 10.0) < 0.05, au)
        # 2) Refrain: gleiche Aufnahme, Vorschlag Refrain
        await pg.click('#loopSong'); await pg.wait_for_timeout(200)
        check('Zweiter Teil: Vorschlag Refrain, Song vorausgewählt', await pg.evaluate("document.getElementById('ldDType').value") == 'chorus' and await pg.evaluate("document.getElementById('ldDSong').selectedOptions[0].text") == 'Testlied')
        await pg.click('#ldDOk'); await pg.wait_for_timeout(800)
        await pg.click('#tab-lied'); await pg.wait_for_timeout(300)
        v = await pg.evaluate("Lied.ver()")
        check('Song: 2 Teile, Ablauf Strophe → Refrain, C-Dur, 96 BPM', [p['type'] for p in v['parts']] == ['verse', 'chorus'] and len(v['order']) == 2 and v['key'] == {'pc': 0, 'major': True} and v['bpm'] == 96, [p['name'] for p in v['parts']])
        # Akkorde des Refrains ändern
        await pg.click('.ld-part >> nth=1 >> .ld-pchords'); await pg.fill('.ld-ptext', 'F G C C'); await pg.click('.ld-part >> nth=1 >> [data-a="ok"]'); await pg.wait_for_timeout(200)
        v = await pg.evaluate("Lied.ver()")
        check('Refrain-Akkorde geändert: F G C C', [(c['r'], c['t']) for c in v['parts'][1]['chords']] == [(5, ''), (7, ''), (0, ''), (0, '')])
        check('Geänderter Teil: Aufnahme als „passt nicht mehr“ markiert', 'passt nicht mehr' in await pg.inner_text('.ld-part >> nth=1'))
        # Ablauf: Strophe, Refrain, Strophe, Refrain ×2
        await pg.select_option('#ldAdd', v['parts'][0]['id']); await pg.select_option('#ldAdd', v['parts'][1]['id'])
        await pg.click('.ld-blk >> nth=3'); await pg.click('#ldOrdEdit [data-a="plus"]')
        v = await pg.evaluate("Lied.ver()")
        check('Ablauf: S R S R×2', [(o['p'] == v['parts'][0]['id'], o['reps']) for o in v['order']] == [(True, 1), (False, 1), (True, 1), (False, 2)])
        info = await pg.inner_text('#ldInfo')
        check('Länge 20 Takte = 0:50', '20 Takte' in info and '0:50' in info, info.replace('\n', ' '))
        # Abspielen: Teile und Akkorde laufen durch, Bass folgt
        await pg.evaluate("(() => { window.__bass = []; const _p = window.playBassNote; window.playBassNote = function (t) { const o = window.bassChordAt ? window.bassChordAt(t) : null; window.__bass.push(o ? o.root : null); return _p.apply(this, arguments); }; })()")
        await playstart(pg)
        seen = []
        for k in range(44):
            await pg.wait_for_timeout(250)
            n = await pg.evaluate("(() => { const n = Lied.now(); return n ? n.part + ':' + n.chord.r : null; })()")
            if n and (not seen or seen[-1] != n): seen.append(n)
            if k == 20: await pg.screenshot(path=O + 'v28_lied.png', full_page=True)
        exp = ['Strophe:0', 'Strophe:7', 'Strophe:9', 'Strophe:5', 'Refrain:5', 'Refrain:7', 'Refrain:0']
        check('Song spielt: Strophe C G Am F → Refrain F', seen[:5] == exp[:5], seen[:8])
        bass = await pg.evaluate("window.__bass.filter(x => x !== null)")
        check('Bass folgt den Song-Akkorden', set(bass) <= {0, 7, 9, 5} and len(bass) >= 8, sorted(set(bass)))
        check('Ablauf-Block leuchtet mit', await pg.evaluate("!!document.querySelector('.ld-blk.on')"))
        # Improvisation folgt
        await pg.click('#tab-solo'); await pg.wait_for_timeout(500)
        check('Improvisation zeigt die Song-Akkorde, Tonart „aus dem Song“', await pg.inner_text('#sfKeySrc') == 'aus dem Song' and len(await pg.evaluate("[...document.querySelectorAll('#sfStrip .sf-seg')]")) >= 3)
        await pg.click('#tab-lied')
        # Looper startet → Song stoppt
        await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(700)
        check('Looper gestartet: Song stoppt', not await pg.evaluate("!!Lied.now()") and not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"))
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        # Backing Track startet → Song stoppt
        await pg.click('#tab-lied'); await playstart(pg); await pg.wait_for_timeout(2600)
        await pg.click('#tab-jam'); await pg.click('#jamPlay'); await pg.wait_for_timeout(400)
        check('Backing Track gestartet: Song stoppt', not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"))
        await pg.click('#jamPlay'); await pg.wait_for_timeout(300)
        # Prüfen und Varianten
        await pg.click('#tab-lied'); await pg.click('#ldCheck'); await pg.wait_for_timeout(200)
        fi = await pg.inner_text('#ldFind')
        check('Prüfen: Rückmeldungen (Länge, Refrain, Bridge …)', '0:50' in fi and 'Refrain' in fi, fi[:160].replace('\n', ' | '))
        vt = await pg.evaluate("[...document.querySelectorAll('.ld-vc b')].map(b => b.textContent)")
        check('Varianten angeboten', len(vt) >= 4, vt)
        n0 = await pg.evaluate("Lied.song().versions.length")
        await pg.click('.ld-vc:has-text("Bridge einfügen") [data-a="hear"]'); await pg.wait_for_timeout(300)
        if not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"): await pg.click('.ld-vc:has-text("Bridge einfügen") [data-a="hear"]'); await pg.wait_for_timeout(300)
        check('Variante anhören spielt, ohne den Song zu ändern', await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')") and await pg.evaluate("Lied.song().versions.length") == n0 and 'Bridge' in await pg.inner_text('#ldStatus'))
        await pg.click('.ld-vc:has-text("Bridge einfügen") [data-a="take"]'); await pg.wait_for_timeout(300)
        v = await pg.evaluate("Lied.ver()")
        check('Übernehmen: neue Version mit Bridge vor dem letzten Refrain', await pg.evaluate("Lied.song().versions.length") == n0 + 1 and [next(p['type'] for p in v['parts'] if p['id'] == o['p']) for o in v['order']] == ['verse', 'chorus', 'verse', 'bridge', 'chorus'], v['note'])
        await pg.select_option('#ldVer', str(n0 - 1)); await pg.wait_for_timeout(200)
        check('Zurück zur vorigen Version: ohne Bridge', len((await pg.evaluate("Lied.ver()"))['order']) == 4)
        await pg.select_option('#ldVer', str(n0)); await pg.wait_for_timeout(200)
        # Transponieren
        await pg.click('#ldTrU'); await pg.wait_for_timeout(200)
        v = await pg.evaluate("Lied.ver()")
        check('Halbton höher: C♯-/D♭-Dur, neue Version, Aufnahmen stumm', v['key']['pc'] == 1 and 'Halbton' in v['note'] and await pg.evaluate("document.querySelectorAll('.ld-au.stale').length") == 2)
        await pg.select_option('#ldVer', str(n0)); await pg.wait_for_timeout(200)
        # Gesang
        await pg.select_option('#ldVoice', 'tenor'); await pg.wait_for_timeout(200)
        vr = await pg.inner_text('#ldVoiceRes'); tg = await pg.evaluate("document.querySelectorAll('.ld-tgn').length")
        check('Gesang: Bewertung der Tonart und Zieltöne', ('passt' in vr or 'eng' in vr) and tg > 20, vr[:120].replace('\n', ' '))
        await pg.select_option('#ldVoice', 'bass'); await pg.wait_for_timeout(200)
        vr2 = await pg.inner_text('#ldVoiceRes')
        bt = await pg.is_visible('#ldVoiceT')
        if bt:
            await pg.click('#ldVoiceT'); await pg.wait_for_timeout(200)
            check('Bass-Stimme: Empfehlung umsetzen → neue Version in anderer Tonart', (await pg.evaluate("Lied.ver()"))['key']['pc'] != 0 and 'Stimme' in (await pg.evaluate("Lied.ver()"))['note'], vr2[:100])
        else: check('Bass-Stimme: Tonart passt bereits', 'günstig' in vr2, vr2[:100])
        # Speichern / Neuladen
        await pg.reload(); await pg.wait_for_timeout(900); await pg.click('#tab-lied'); await pg.wait_for_timeout(300)
        check('Nach Neustart: Song, Versionen, Stimmlage erhalten', await pg.evaluate("Lied.song().name") == 'Testlied' and await pg.evaluate("Lied.song().versions.length") >= n0 + 2 and await pg.evaluate("Lied.song().voice.preset") == 'bass')
        # Sicherung enthält Song und Aufnahme
        await pg.click('#tab-looper'); await pg.wait_for_timeout(200)
        async with pg.expect_download() as dl:
            await pg.click('#backupSave')
        d = await dl.value; z = zipfile.ZipFile(io.BytesIO(open(await d.path(), 'rb').read())); head = json.loads(z.read('sicherung.json'))
        check('Sicherung enthält Song und Aufnahme', '3nps-lieder' in head['local'] and any(str(r.get('key', '')).startswith('lied-audio:') for r in head['db']['meta']))
        # Zweiter Song, dann löschen → Aufnahme weg
        await loadloop(pg); await capture(pg, 'verse', 'new', 'new'); await pg.click('#tab-lied'); await pg.wait_for_timeout(200)
        n_au = await pg.evaluate("AppDB.all('meta').then(a => a.filter(r => String(r.key).startsWith('lied-audio:')).length)")
        await pg.click('#ldDel'); await pg.click('#ldDel'); await pg.wait_for_timeout(500)
        n_au2 = await pg.evaluate("AppDB.all('meta').then(a => a.filter(r => String(r.key).startsWith('lied-audio:')).length)")
        check('Song löschen entfernt nur seine Aufnahme', n_au2 == n_au - 1 and await pg.evaluate("Lied.song().name") == 'Testlied', f'{n_au} → {n_au2}')
        # Teil abspielen (Schleife) und stoppen
        await pg.click('.ld-part >> nth=0 >> [data-a="play"]'); await pg.wait_for_timeout(300)
        if not await pg.evaluate("document.getElementById('ldPlay').classList.contains('playing')"): await pg.click('.ld-part >> nth=0 >> [data-a="play"]'); await pg.wait_for_timeout(300)
        check('Teil einzeln in Schleife', 'Schleife' in await pg.inner_text('#ldStatus'))
        await pg.click('#ldPlay'); await pg.wait_for_timeout(200)
        # Breiten
        for w_, h_ in ((390, 844), (768, 1024), (1366, 1024)):
            await pg.set_viewport_size({'width': w_, 'height': h_}); await pg.wait_for_timeout(300)
            r = await pg.evaluate("(() => { const t=[...document.querySelectorAll('.tab')]; return [new Set(t.map(x=>Math.round(x.getBoundingClientRect().top))).size, t.every(x => x.scrollWidth <= x.clientWidth + 1), document.documentElement.scrollWidth]; })()")
            check(f'{w_} px: Reiter lesbar, kein seitliches Scrollen', r[1] and r[2] <= w_ and (r[0] == 1 or w_ < 560), r)
        await pg.screenshot(path=O + 'v28_lied_schmal.png', full_page=False)
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
