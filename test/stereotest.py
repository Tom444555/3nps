import asyncio, io, zipfile, struct, wave
import numpy as np
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
res = []
def check(name, ok, info=''):
    res.append(ok); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info else ''))

def wav_info(b):
    ch = struct.unpack('<H', b[22:24])[0]; sr = struct.unpack('<I', b[24:28])[0]; bits = struct.unpack('<H', b[34:36])[0]
    i = b.find(b'data'); n = struct.unpack('<I', b[i + 4:i + 8])[0]; raw = np.frombuffer(b[i + 8:i + 8 + n], dtype=np.uint8)
    if bits == 24:
        r = raw.reshape(-1, 3).astype(np.int32); v = r[:, 0] | (r[:, 1] << 8) | (r[:, 2] << 16); v = np.where(v & 0x800000, v - 0x1000000, v) / 8388607
    else:
        v = np.frombuffer(raw.tobytes(), dtype=np.int16) / 32767
    v = v.reshape(-1, ch)
    return ch, sr, bits, v

def corr(x):
    return float((x[:, 0] * x[:, 1]).sum() / np.sqrt((x[:, 0] ** 2).sum() * (x[:, 1] ** 2).sum() + 1e-20))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
                                          '--use-file-for-fake-audio-capture=' + T + 'stereo/mic_st.wav', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(accept_downloads=True, viewport={'width': 1024, 'height': 1366})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        st = lambda i: pg.evaluate(f'Looper._stereo({i})')
        async def load(slot, path):
            await pg.set_input_files(f'#file{slot}', path)
            for _ in range(80):
                await pg.wait_for_timeout(250)
                if await pg.is_visible('#impDlg'): await pg.click('#impOk')
                if (await pg.inner_text('#loopStatus')).startswith(f'Spur {slot + 1}:'): return

        # Referenz: Korrelation der Quelldatei
        with wave.open(T + 'stereo/rock_120_2T_st.wav') as w: src = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2) / 32767
        c0 = corr(src); ratio0 = np.sqrt((src[:, 1] ** 2).mean() / (src[:, 0] ** 2).mean())
        print(f'Quelle: Korrelation {c0:.3f}, R/L {ratio0:.3f}')

        # 1) Stereo-Datei laden
        await load(0, T + 'stereo/rock_120_2T_st.wav')
        s0 = await st(0)
        check('Stereo-Datei: beide Kanäle getrennt geladen', s0 and not s0['shared'] and abs(s0['corr'] - c0) < 0.05 and abs(s0['rmsR'] / s0['rmsL'] - ratio0) < 0.05,
              f"Korrelation {s0['corr']:.3f}, R/L {s0['rmsR'] / s0['rmsL']:.3f}")
        await pg.wait_for_timeout(600)
        mv = await pg.evaluate("[document.getElementById('chb0').textContent, document.getElementById('tmeter0').classList.contains('play'), ...[...document.querySelectorAll('#tmeter0 .tm-ch')].map(e => parseFloat(e.style.getPropertyValue('--lv')))]")
        check('Spur 1 zeigt „Stereo“, Pegel zeigt L/R der Wiedergabe', mv[0] == 'Stereo' and mv[1] and mv[2] > 20 and mv[3] > 20 and abs(mv[2] - mv[3]) > 0.5, mv)
        # 2) Mono-Datei bleibt mono (spart Speicher), Stereo-Datei anderer Tempi wird gekoppelt gedehnt
        await load(1, T + 'loops/guitar_only_95_4T.wav')
        s1 = await st(1)
        check('Mono-Datei: ein Kanal, auf beide Seiten verteilt', s1 and s1['shared'] and (await pg.inner_text('#chb1')).lower() == 'mono', s1 and s1['layers'])
        await load(2, T + 'stereo/funk_104_3T_st.wav')
        s2 = await st(2)
        with wave.open(T + 'stereo/funk_104_3T_st.wav') as w: src2 = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2) / 32767
        c2 = corr(src2)
        check('Stereo-Datei ins Tempo gedehnt: Stereobild bleibt', s2 and not s2['shared'] and abs(s2['corr'] - c2) < 0.08, f"Korrelation {s2['corr']:.3f} (Quelle {c2:.3f}) · {await pg.inner_text('#loopStatus')}"[:200])

        # 3) Editor-Funktionen auf Stereo-Spur 1
        await pg.click('#edit0'); await pg.wait_for_timeout(300)
        before = await st(0)
        await pg.click('#edDouble'); await pg.wait_for_timeout(400); a = await st(0)
        check('Editor „verdoppeln“ bleibt stereo', not a['shared'] and abs(a['corr'] - before['corr']) < 0.02 and a['L'] >= before['L'], f"L {before['L']} → {a['L']}, Korrelation {a['corr']:.3f}")
        await pg.click('#edUndo') if await pg.is_visible('#edUndo') else None
        await pg.wait_for_timeout(300)
        await pg.click('#edCheck'); await pg.wait_for_timeout(3000)
        await pg.click('#edFix'); await pg.wait_for_timeout(3500); a = await st(0)
        check('Nacharbeiten bleibt stereo', not a['shared'] and abs(a['corr'] - c0) < 0.06, f"Korrelation {a['corr']:.3f} · " + (await pg.inner_text('#edCheckRes')).replace('\n', ' | ')[:120])
        await pg.click('#edClose')

        # 4) Logic-Export: zweikanalige 24-Bit-WAVs
        async with pg.expect_download() as dl:
            await pg.click('#loopExport')
        dd = await dl.value; z = zipfile.ZipFile(io.BytesIO(open(await dd.path(), 'rb').read()))
        wavs = [n for n in z.namelist() if n.endswith('.wav')]
        infos = {n.split('/')[-1]: wav_info(z.read(n)) for n in wavs}
        allst = all(v[0] == 2 and v[2] == 24 for v in infos.values())
        sp1 = [v for k, v in infos.items() if 'Spur 1' in k][0]
        cS = corr(sp1[3])
        check('Export: alle WAVs Stereo, 24 Bit', allst and len(wavs) == 4, ', '.join(f"{k[:14]}…: {v[0]} Kan./{v[2]} Bit" for k, v in infos.items()))
        check('Export: Spur 1 behält links/rechts', abs(cS - c0) < 0.06, f'Korrelation {cS:.3f}')

        # 5) Idee speichern und wieder laden
        k0 = [await st(i) for i in range(3)]
        await pg.fill('#ideaName', 'Stereo-Idee'); await pg.click('#ideaSave'); await pg.wait_for_timeout(1500)
        for i in range(3): await pg.evaluate(f"document.getElementById('clear{i}').click(); document.getElementById('clear{i}').click();")
        await pg.wait_for_timeout(300)
        await pg.click('.idea-row [data-act="load"]'); await pg.wait_for_timeout(2500)
        k1 = [await st(i) for i in range(3)]
        ok = all(a and b and a['L'] == b['L'] and a['shared'] == b['shared'] and abs(a['corr'] - b['corr']) < 0.002 and abs(a['rmsL'] - b['rmsL']) < 0.002 * max(a['rmsL'], 1e-3) + 1e-4 for a, b in zip(k0, k1))
        check('Idee: Stereo-Spuren nach Speichern/Laden gleich (24 Bit)', ok, ' | '.join(f"{b['L']} {'mono' if b['shared'] else 'stereo'} k={b['corr']:.3f}" for b in k1 if b))
        # Teilen-Datei: Stereo-WAV
        wav = await pg.evaluate("""async () => { const ideas = await AppDB.all('ideas'); const m = Looper.sessionMix(ideas[0].session); const b = new Uint8Array(await m.wav.arrayBuffer()); return Array.from(b.slice(0, 64)); }""")
        wb = bytes(wav)
        check('Teilen: Mix als Stereo-WAV', struct.unpack('<H', wb[22:24])[0] == 2, f"{struct.unpack('<H', wb[22:24])[0]} Kanäle, {struct.unpack('<H', wb[34:36])[0]} Bit")
        # Alte Mono-Idee (v2 mit 16-Bit pcm) bleibt ladbar
        old = await pg.evaluate("""async () => {
            const n = 44100, pcm = new Int16Array(n); for (let i = 0; i < n; i++) pcm[i] = Math.round(Math.sin(i / 20) * 8000);
            Looper.loadSession({ sr: 44100, baseL: n, tracks: [{ L: n, pcm, vol: 80 }, null, null] });
            await new Promise(r => setTimeout(r, 400)); return Looper._stereo(0); }""")
        check('Alte Mono-Idee lädt weiter', old and old['shared'] and old['rmsL'] > 0.1, old and f"L {old['L']}, rms {old['rmsL']:.3f}")

        # Ältere Idee als WAV (v1) in Stereo
        await pg.evaluate("""async () => { const w = Looper.sessionMix((await AppDB.all('ideas'))[0].session).wav;
            await AppDB.put('ideas', { id: 'oldwav', name: 'Alte WAV-Idee', ts: 1, dateStr: '01.01.26', root: 'G', mode: 'Ionisch (Dur)', bpm: 120, secs: 4, wav: w }); }""")
        await pg.evaluate("document.querySelector('#ideaSave') && null")
        await pg.fill('#ideaName', ''); await pg.click('#ideaSave'); await pg.wait_for_timeout(1200)   # Liste neu zeichnen
        await pg.click('.idea-row[data-id="oldwav"] [data-act="load"]'); await pg.wait_for_timeout(2000)
        ow = await st(0)
        check('Alte WAV-Idee lädt in Stereo', ow and not ow['shared'] and ow['corr'] < 0.95, ow and f"Korrelation {ow['corr']:.3f} · {await pg.inner_text('#loopStatus')}"[:120])

        # 6) Stereo-Aufnahme über den Eingang
        for i in range(3): await pg.evaluate(f"document.getElementById('clear{i}').click(); document.getElementById('clear{i}').click();")
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
        s = await pg.evaluate('Looper._stereo(0) || null')
        info = await pg.inner_text('#inChanInfo')
        dbg = await pg.evaluate("({ seen: document.getElementById('loopMeterBox').classList.contains('st') })")
        print('Eingang:', repr(info), dbg)
        await pg.select_option('#loopBars', '2')
        await pg.click('#foot0'); await pg.wait_for_timeout(300)
        bpm = (await pg.evaluate('Looper.debug()'))['bpm']
        await pg.wait_for_timeout(int((2 * 240 / bpm + 1.5) * 1000))
        r = await st(0)
        check('Aufnahme vom Stereo-Eingang bleibt stereo', r and not r['shared'] and r['corr'] < 0.9 and r['rmsR'] > 0.01, r and f"Korrelation {r['corr']:.3f}, L {r['rmsL']:.3f} R {r['rmsR']:.3f}, Anzeige „{info}“")
        check('Anzeige zeigt Stereo-Eingang', 'Stereo' in info and dbg['seen'], info)
        # Overdub auf Spur 1
        await pg.click('#foot0'); await pg.wait_for_timeout(int((2 * 240 / bpm + 1.0) * 1000)); await pg.click('#foot0'); await pg.wait_for_timeout(int((240 / bpm) * 1000))
        r2 = await st(0)
        check('Overdub stereo', r2 and len(r2['layers']) >= 1 and not r2['shared'], r2 and f"Schichten {r2['layers']}, Korrelation {r2['corr']:.3f}")
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'\nErgebnis: {sum(res)}/{len(res)} Prüfungen bestanden')
asyncio.run(main())
