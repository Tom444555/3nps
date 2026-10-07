# v31: ganzer Song für Logic (ZIP) aus dem Songwriting + langsame Dateien werden nicht mehr mit doppeltem Tempo geladen
import asyncio, zipfile, io, struct, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def loadfile(pg, f, track=0):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files(f'#file{track}', f)
    txt = ''
    for _ in range(120):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'):
            a = await pg.inner_text('#impAna')
            if 'Analysiere' not in a: txt = a; await pg.click('#impOk')
        if await pg.evaluate(f"Looper.debug().tracks[{track}].state === 'playing'"): break
    return txt
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, accept_downloads=True); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        check('Version v35', 'v35' in await pg.inner_text('.brand'))
        # 1) Langsame Dateien: Tempo nicht doppelt
        for f, want in [('oktave/o_arp8_66.wav', 66), ('oktave/o_strum16_70.wav', 70), ('oktave2/p_softpop_61.wav', 61), ('long/L_ballad_live_74.wav', 74)]:
            await pg.evaluate("Looper.stopAll && Looper.stopAll()")
            a = await loadfile(pg, T + f)
            bpm = await pg.evaluate("Math.round(parseFloat(document.getElementById('bpm').value))")
            check(f'Langsame Datei {f.split("/")[1]}: {want} BPM erkannt (nicht doppelt)', abs(bpm - want) <= 1, (a.replace('\n', ' '), bpm))
            await pg.click('#tab-looper'); await pg.click('#clear0') if await pg.is_visible('#clear0') else None
        await pg.reload(); await pg.wait_for_timeout(800)
        a = await loadfile(pg, T + 'oktave/o_rock_140.wav')
        check('Schnelle Datei bleibt schnell (140)', abs(await pg.evaluate("Math.round(parseFloat(document.getElementById('bpm').value))") - 140) <= 1, a)
        await pg.reload(); await pg.wait_for_timeout(800)
        # 2) Song mit zwei Aufnahmen
        await loadfile(pg, T + 'chords/c_pop_strum.wav')
        await pg.click('#loopSong'); await pg.wait_for_timeout(200); await pg.fill('#ldDNew', 'Exporttest'); await pg.click('#ldDOk'); await pg.wait_for_timeout(800)
        await pg.click('#loopSong'); await pg.wait_for_timeout(200); await pg.click('#ldDOk'); await pg.wait_for_timeout(800)
        await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        await pg.click('#tab-lied'); await pg.wait_for_timeout(300)
        v = await pg.evaluate("Lied.ver()")
        await pg.select_option('#ldAdd', v['parts'][0]['id']); await pg.select_option('#ldAdd', v['parts'][1]['id'])
        await pg.click('.ld-tx >> nth=0 >> .ld-txt'); await pg.keyboard.type('Erste Zeile hier\nzweite Zeile dort'); await pg.wait_for_timeout(600)
        check('Knopf „Für Logic exportieren“ im Songwriting', await pg.is_visible('#ldExport'))
        async with pg.expect_download(timeout=60000) as dl:
            await pg.click('#ldExport')
        d = await dl.value; path = O + 'v31_export.zip'; await d.save_as(path)
        z = zipfile.ZipFile(path); names = z.namelist()
        check('ZIP: Song-WAV, Teile, MIDI, Leadsheet, Text, Song-Code, Anleitung', d.suggested_filename == 'Exporttest V1.zip' and any('01 Aufnahmen' in n for n in names) and sum('Teile einzeln' in n for n in names) == 2 and any(n.endswith('.mid') for n in names) and any(n.endswith('Leadsheet.pdf') for n in names) and any('Song-Code' in n for n in names) and any('LIES MICH' in n for n in names), names)
        w = z.read([n for n in names if '01 Aufnahmen' in n][0])
        ch, sr, bits = struct.unpack('<H', w[22:24])[0], struct.unpack('<I', w[24:28])[0], struct.unpack('<H', w[34:36])[0]
        secs = struct.unpack('<I', w[40:44])[0] / (3 * ch) / sr
        L = await pg.evaluate("(() => { const v = Lied.ver(), t = LiedCore.totals(v); return t.secs; })()")
        check('Song-WAV: 24 Bit, Länge = Song + 0,6 s', bits == 24 and abs(secs - (L + 0.6)) < 0.01, (ch, sr, bits, round(secs, 3), round(L, 3)))
        # Lautstärke: in jedem Abschnitt Signal
        import array
        def lvl(t0, t1):
            mx = 0
            for i in range(int(t0 * sr), int(t1 * sr), 97):
                o = 44 + i * 3 * ch; x = int.from_bytes(w[o:o + 3], 'little', signed=True); mx = max(mx, abs(x))
            return mx / 8388607
        seg = L / 4
        check('Aufnahmen in allen vier Abschnitten hörbar', all(lvl(k * seg + 0.2, (k + 1) * seg - 0.2) > 0.05 for k in range(4)), [round(lvl(k * seg + 0.2, (k + 1) * seg - 0.2), 2) for k in range(4)])
        mid = z.read([n for n in names if n.endswith('.mid')][0])
        check('MIDI: Kopf, 480 Ticks, Tempo-Spur + Akkorde + Bass (+ Drums, Text)', mid[:4] == b'MThd' and struct.unpack('>H', mid[12:14])[0] == 480 and struct.unpack('>H', mid[10:12])[0] >= 4 and b'Akkorde' in mid and b'Bass' in mid and b'Strophe' in mid and b'Erste Zeile hier' in mid, struct.unpack('>H', mid[10:12])[0])
        lies = z.read([n for n in names if 'LIES MICH' in n][0]).decode()
        check('Anleitung mit Takten der Abschnitte', 'Takt     1  Strophe' in lies and 'Logic' in lies, lies.split('\n')[4:9])
        st = await pg.inner_text('#ldStatus')
        check('Rückmeldung mit Größe', 'Logic-Paket fertig' in st and 'MB' in st, st)
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
