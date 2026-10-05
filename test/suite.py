#!/usr/bin/env python3
"""Kompletter Ablauftest im Browser. Prüft Schnittpunkte gegen die bekannten Takt-Einsen."""
import asyncio, json, sys, zipfile, io, wave
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
URL = 'http://localhost:8765/index.html'
results = []
def check(name, ok, info=''):
    results.append((name, ok, info)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + info if info else ''))

async def dbg(pg): return await pg.evaluate('Looper.debug()')
async def status(pg): return await pg.inner_text('#loopStatus')
async def load(pg, slot, path, wait=9000, choice=None):
    await pg.set_input_files(f'#file{slot}', path)
    for _ in range(wait // 250):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'):
            if choice:
                await pg.wait_for_timeout(2500)
                await pg.check('#impDlg input[value="part"]'); await pg.select_option('#impFrom', str(choice[0])); await pg.select_option('#impBars', str(choice[1]))
            await pg.click('#impOk'); continue
        st = await status(pg)
        if st.startswith('Spur ') and ('Takt' in st or 'Loop' in st or 'Zeit' in st): return st
    return await status(pg)

def near_downbeat_ms(gt, sec):
    ends = gt['downbeats'] + [gt['beats'][-1] + (gt['beats'][-1] - gt['beats'][-2])]   # auch der Taktstrich nach dem letzten Takt
    return min(abs(d - sec) for d in ends) * 1000

async def drag(pg, frac_from, frac_to):
    await pg.evaluate("document.getElementById('edWave').scrollIntoView({block: 'center'})"); await pg.wait_for_timeout(500)
    box = await pg.locator('#edWave').bounding_box()
    y = box['y'] + box['height'] / 2
    x0 = box['x'] + box['width'] * frac_from
    before = await pg.inner_text('#edInfo')
    under = await pg.evaluate(f"(() => {{ const e = document.elementFromPoint({x0},{y}); return e ? e.tagName + '#' + e.id + '.' + e.className : 'nichts'; }})()")
    await pg.mouse.move(x0, y); await pg.mouse.down()
    await pg.mouse.move(box['x'] + box['width'] * frac_to, y, steps=6); await pg.mouse.up()
    after = await pg.inner_text('#edInfo')
    if before == after: print('   ZIEHEN OHNE WIRKUNG · unter dem Zeiger:', under, '· Box', box, '· Scroll', await pg.evaluate('scrollY'))

async def run(round_no):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(accept_downloads=True, viewport={'width': 1024, 'height': 1366})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.click('#tab-looper')
        await pg.select_option('#loopCountIn', '0')          # erst ohne Vorzähler
        songs = [('corpus', 'rock_97_intro'), ('corpus', 'live_drift_112'), ('corpus', 'pickup_100'), ('valid', 'v_metal_180'), ('corpus', 'funk_96_drift'),
                 ('valid', 'v_reggae_76'), ('valid', 'v_edm_124'), ('corpus', 'ballad_drums_80'), ('valid', 'v_shuffle_120')]
        folder, song = songs[round_no % len(songs)]
        gt = json.load(open(T + f'{folder}/{song}.json'))

        # S1: ganzer Song, freie Länge
        st = await load(pg, 0, T + f'{folder}/{song}.wav')
        d = await dbg(pg); tr = d['tracks'][0]; sr = d['sr']
        check(f'[{song}] Song erkannt', 'Takt erkannt' in st, st[:110])
        if tr['orig']:
            first = tr['orig']['downs'][0] / sr
            err = near_downbeat_ms(gt, first)
            check(f'[{song}] erster Schnitt auf Takt-Eins', err < 30, f'{err:.1f} ms')
            mx = max(near_downbeat_ms(gt, x / sr) for x in tr['orig']['downs'][:-1])
            check(f'[{song}] alle Takt-Einsen des Rasters', mx < 35, f'max. Abweichung {mx:.1f} ms bei {len(tr["orig"]["downs"]) - 1} Takten')
            check(f'[{song}] Tempo', abs(d['bpm'] - gt['bpm']) / gt['bpm'] < 0.01, f"{d['bpm']:.2f} statt {gt['bpm']}")

        # S2: Ausschnitt ab Takt 5, 4 Takte, dann prüfen
        await pg.select_option('#edFrom', '5'); await pg.select_option('#edBars', '4'); await pg.click('#edTake'); await pg.wait_for_timeout(600)
        d = await dbg(pg); tr = d['tracks'][0]
        start = tr['origPos'] / sr; L = tr['L'] / sr
        err = near_downbeat_ms(gt, start); errEnd = near_downbeat_ms(gt, start + L)
        check(f'[{song}] Ausschnitt Start/Ende auf Einsen', err < 30 and errEnd < 30, f'Start {err:.1f} ms, Ende {errEnd:.1f} ms, Länge {L:.3f} s')
        await pg.click('#edCheck'); await pg.wait_for_timeout(3500)
        res = await pg.inner_text('#edCheckRes')
        check(f'[{song}] Prüfung des sauberen Ausschnitts', '⚠' not in res, res.replace('\n', ' | ')[:160])
        await pg.click('#edZoomIn'); await pg.click('#edZoomIn'); zi = await pg.inner_text('#edZoomInfo'); await pg.click('#edZoomSel')
        await pg.click('#edZoomAll')
        Lb = (await dbg(pg))['tracks'][0]['L']
        await pg.click('#edDownR'); await pg.wait_for_timeout(400); p1 = (await dbg(pg))['tracks'][0]['origPos']
        await pg.click('#edDownL'); await pg.wait_for_timeout(400); p2 = (await dbg(pg))['tracks'][0]['origPos']
        beatF = 60 / (await dbg(pg))['bpm'] * sr
        check(f'[{song}] Editor: Zoom und Takt-Eins verschieben', zi != '1×' and p1 is not None and abs(p1 - start * sr - beatF) < beatF * 0.1 and abs(p2 - start * sr) < 3, f'Zoom {zi}, Eins +1 Schlag: {((p1 or 0) / sr - start) * 1000:.0f} ms, zurück: {((p2 or 0) / sr - start) * 1000:.1f} ms')

        # S3: absichtlich falsch schneiden, prüfen, nacharbeiten
        await pg.select_option('#edGrid', 'free')
        for attempt in range(4):
            await drag(pg, 0.0, 0.13); await drag(pg, 1.0, 0.86)
            if not await pg.is_disabled('#edTrim'): break
            await pg.wait_for_timeout(600)
        await pg.click('#edTrim'); await pg.wait_for_timeout(500)
        await pg.click('#edCheck'); await pg.wait_for_timeout(3500)
        res = await pg.inner_text('#edCheckRes')
        check(f'[{song}] Prüfung erkennt schlechten Schnitt', '⚠' in res, res.replace('\n', ' | ')[:160])
        await pg.click('#edFix'); await pg.wait_for_timeout(6000)
        res = await pg.inner_text('#edCheckRes'); st = await status(pg)
        d = await dbg(pg); tr = d['tracks'][0]
        if tr['origPos'] is not None:
            start = tr['origPos'] / sr; L = tr['L'] / sr
            err = near_downbeat_ms(gt, start); errEnd = near_downbeat_ms(gt, start + L)
            check(f'[{song}] Nacharbeiten: wieder auf Einsen', err < 30 and errEnd < 30, f'Start {err:.1f} ms, Ende {errEnd:.1f} ms · {st[:90]}')
        check(f'[{song}] Nach dem Nacharbeiten passt die Prüfung', '⚠' not in res, res.replace('\n', ' | ')[:160])
        await pg.click('#undo0'); await pg.wait_for_timeout(400)
        d2 = await dbg(pg)
        check(f'[{song}] Rückgängig nach Nacharbeiten', abs(d2['tracks'][0]['L'] - tr['L']) > 10, 'Länge wiederhergestellt')

        # S4: Loop-Datei (exakt) und versetzte Loop-Datei
        await pg.click('#edClose')
        lf = ['funk_104_3T', 'rock_120_2T', 'guitar_only_95_4T', 'fast_170_6T', 'pop16_128_5T', 'shuffle_88_2T', 'rock_97_intro_1T', 'ballad_72_1T', 'funk_104_3T'][round_no % 9]
        st = await load(pg, 1, T + f'loops/{lf}.wav')
        lg = json.load(open(T + f'loops/{lf}.json'))
        d = await dbg(pg); tr = d['tracks'][1]
        check(f'[{lf}] als Loop erkannt', 'Loop erkannt' in st and str(lg['bars']) + ' Takt' in st, st[:120])
        check(f'[{lf}] Länge unverändert (passt zu Spur 1)', tr['L'] % d['baseL'] == 0, f"L={tr['L']} base={d['baseL']}")
        of = ['off_rock_120_2T', 'off_funk_104_2T', 'off_guitar_only_95_2T'][round_no % 3]
        # versetzten Loop allein testen: Spuren leeren
        for i in range(3):
            await pg.evaluate(f"document.getElementById('clear{i}').click(); document.getElementById('clear{i}').click();")
        await pg.wait_for_timeout(300)
        st = await load(pg, 2, T + f'loops/{of}.wav')
        check(f'[{of}] Takt 1 an den Anfang gelegt', 'an den Anfang gelegt' in st, st[:130])
        await pg.click('#edCheck'); await pg.wait_for_timeout(3000)
        res = await pg.inner_text('#edCheckRes')
        check(f'[{of}] Prüfung danach', '⚠' not in res, res.replace('\n', ' | ')[:160])

        # S5: Vorzähler 4 Takte vor dem Abspielen
        await pg.click('#edClose')
        await pg.select_option('#loopCountIn', '4'); await pg.check('#loopCountInPlay')
        await pg.click('#loopAll'); await pg.wait_for_timeout(200)       # stoppt
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)       # startet mit Vorzähler
        d = await dbg(pg)
        lead = (d['anchor'] - d['now']) / d['sr']; bar = 240 / d['bpm']
        check('Vorzähler 4 Takte vor Loop-Start', abs(lead - 4 * bar) < 0.25, f'{lead:.2f} s Vorlauf, 4 Takte = {4 * bar:.2f} s')
        lcd = await pg.inner_text('#lcdPos')
        check('LCD zeigt Vorzähler', lcd.startswith('−'), lcd)
        await pg.click('#loopAll'); await pg.wait_for_timeout(200)
        d = await dbg(pg)
        check('Vorzähler lässt sich abbrechen', d['countEnd'] == 0 and all(t['state'] != 'playing' for t in d['tracks']), '')

        # S6: Aufnahme mit 2 Takten Vorzähler (Spur 1 ist leer)
        await pg.select_option('#loopCountIn', '2')
        for i in range(3):
            await pg.evaluate(f"document.getElementById('clear{i}').click(); document.getElementById('clear{i}').click();")
        await pg.select_option('#loopBars', '1')
        await pg.click('#foot0'); await pg.wait_for_timeout(300)
        stt = await pg.get_attribute('#foot0', 'data-state')
        check('Aufnahme wartet im Vorzähler', stt == 'pending', stt)
        bar = 240 / (await dbg(pg))['bpm']
        await pg.wait_for_timeout(int((2 * bar + 1.4 * bar) * 1000))
        d = await dbg(pg)
        check('Nach Vorzähler aufgenommen (1 Takt, Loop läuft)', d['tracks'][0]['state'] == 'playing' and abs(d['tracks'][0]['L'] / d['sr'] - bar) < 0.01, f"{d['tracks'][0]['L'] / d['sr']:.3f} s, 1 Takt = {bar:.3f} s")

        # S7: Drum Designer, Drone-Spur, Pegel
        await pg.click('#drumEditBtn') if await pg.is_hidden('#drumDesigner') else None
        await pg.select_option('#loopDrumStyle', ['funk', 'kc_shuffle', 'bossa', 'gospel_shuffle', 'rumba_blues', 'swamp', 'jump', 'boogie_train', 'train'][round_no % 9])
        await pg.click('.dg-cell[data-i="clap"][data-k="9"]')
        check('Drum Designer: Feld setzen → Eigenes Muster', await pg.input_value('#loopDrumStyle') == 'custom', await pg.input_value('#loopDrumStyle'))
        lv = (await dbg(pg))['level']
        check('Eingangspegel kommt an', lv > 0.0005, f'{lv:.4f}')
        await pg.check('#laneDroneSync')
        await pg.select_option('#laneDroneRoot', 'E'); await pg.select_option('#laneDroneMode', 'Äolisch (Moll)')
        dst = ['v3', 'v4', 'v1', 'v2'][round_no % 4]
        await pg.select_option('#laneDroneStyle', dst); await pg.wait_for_timeout(300)
        await pg.click('#laneDrone'); await pg.wait_for_timeout(1200)
        st = await pg.inner_text('#laneDroneStatus')
        check(f'Drone-Spur ({dst}) an, Tonart E-Moll', (await dbg(pg))['drone'] and 'E Äolisch' in st, st)
        # Editor: Zoom, Springen, Takt-Eins verschieben (auf Spur 1, falls vorhanden)
        d0 = await dbg(pg)

        # S8: Drums im Raster des Loops + Export
        await pg.click('#loopDrums')
        await pg.click('#loopAll'); await pg.wait_for_timeout(200); await pg.click('#loopAll'); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(int(2 * 240 / (await dbg(pg))['bpm'] * 1000))
        d = await dbg(pg); sd = d['drums']['sd']; a = d['anchor'] / d['sr']
        offs = [abs(((t0 - a) / sd) - round((t0 - a) / sd)) * sd * 1000 for t0, st in d['drums']['steps']]
        R = d['drums']['res']; stepok = all(st == round((t0 - a) / sd) % R for t0, st in d['drums']['steps']) if d['baseL'] % round(R * sd * d['sr']) < 50 else True
        check('Drums laufen im Raster des Loops', len(offs) > 8 and max(offs) < 1.0 and stepok, f'{len(offs)} Schritte, max. {max(offs or [0]):.3f} ms neben dem Raster')
        async with pg.expect_download() as dl:
            await pg.click('#loopExport')
        dd = await dl.value; data = open(await dd.path(), 'rb').read()
        z = zipfile.ZipFile(io.BytesIO(data))
        mid = [z.read(n) for n in z.namelist() if n.endswith('.mid')]
        notes = set(mid[0][i + 1] for i in range(len(mid[0]) - 2) if mid[0][i] == 0x99) if mid else set()
        check('Export-ZIP gültig, MIDI-Drums mit Clap', z.testzip() is None and 39 in notes, ', '.join(n.split('/')[-1] for n in z.namelist())[:100] + f' · Noten {sorted(notes)}')
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        check('Drone stoppt mit „Alle stoppen“', not (await dbg(pg))['drone'], '')
        check('Keine Skriptfehler', not errs, '; '.join(errs)[:200])
        await b.close()

async def main():
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    first = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    for r in range(first, first + rounds):
        print(f'\n===== Durchlauf {r + 1} =====')
        await run(r)
    bad = [x for x in results if not x[1]]
    print(f'\nErgebnis: {len(results) - len(bad)}/{len(results)} Prüfungen bestanden')
asyncio.run(main())
