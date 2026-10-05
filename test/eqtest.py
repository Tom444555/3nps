# 7-Band-EQ: Bedienung, Wirkung auf den Klang, Speichern in Ideen, Export wie gehört, Drums
import asyncio, io, zipfile, struct, base64
import numpy as np
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/'
PATCH = open(T + 'firsthit.py').read().split('PATCH = r"""')[1].split('"""')[0]
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
def hf_share(x, sr, f0=6000):
    f = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; fr = np.fft.rfftfreq(len(x), 1 / sr)
    return float(f[fr > f0].sum() / max(1e-12, f.sum()))
def wav_read(b):
    ch = struct.unpack('<H', b[22:24])[0]; sr = struct.unpack('<I', b[24:28])[0]
    i = b.find(b'data'); n = struct.unpack('<I', b[i + 4:i + 8])[0]
    r = np.frombuffer(b[i + 8:i + 8 + n], dtype=np.uint8).reshape(-1, 3).astype(np.int32)
    v = r[:, 0] | (r[:, 1] << 8) | (r[:, 2] << 16); v = np.where(v & 0x800000, v - 0x1000000, v) / 8388607
    return v.reshape(-1, ch), sr
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(accept_downloads=True, viewport={'width': 1024, 'height': 1366})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(PATCH)
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(700)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.evaluate("localStorage.removeItem('3nps-eq0'); localStorage.removeItem('3nps-eq-drums')")
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        await pg.evaluate("Looper.setTrackEq(0, [0,0,0,0,0,0,0])")
        # 1) Bedienung: aufklappen, Schieber ziehen
        await pg.click('#eqb0'); await pg.wait_for_timeout(200)
        vis = await pg.is_visible('#eqp0 .eq-curve')
        tr = await pg.query_selector('#eqp0 .eq-band[data-i="6"] .eq-track'); bb = await tr.bounding_box()
        await pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); await pg.mouse.down()
        await pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] - 1, steps=6); await pg.mouse.up()
        v = await pg.evaluate('Looper.getTrackEq(0)')
        check('EQ aufklappen und Schieber ziehen', vis and v[6] <= -11.5 and await pg.inner_text('#eqb0') == 'EQ ●', f'Werte {v}, Knopf „{await pg.inner_text("#eqb0")}“')
        # Doppeltippen = 0 dB
        await pg.mouse.dblclick(bb['x'] + bb['width'] / 2, bb['y'] + 10)
        v2 = await pg.evaluate('Looper.getTrackEq(0)')
        check('Doppeltippen setzt das Band auf 0 dB', v2[6] == 0, v2)
        # Vorlage
        await pg.select_option('#eqp0 .eq-pre', 'Höhen weich'); await pg.wait_for_timeout(100)
        v3 = await pg.evaluate('Looper.getTrackEq(0)')
        check('Vorlage „Höhen weich“', v3 == [0, 0, 0, 0, -1.5, -4, -6], v3)
        # 2) Wirkung: Ausgang mitschneiden, flach vs. Höhen −12 dB
        await pg.evaluate("ensureAudio(); ensureMasterBus(); __rec()")
        await pg.evaluate("Looper.setTrackEq(0, [0,0,0,0,0,0,0])"); await pg.wait_for_timeout(2500)
        await pg.evaluate("Looper.setTrackEq(0, [0,0,0,0,0,-12,-12])"); await pg.wait_for_timeout(2500)
        d = await pg.evaluate('__dump()'); x = np.frombuffer(base64.b64decode(d['b64']), dtype=np.float32); sr = d['sr']
        a = x[int(len(x) * 0.1):len(x) // 2 - sr // 4]; c = x[len(x) // 2 + sr // 4:]
        h1, h2 = hf_share(a, sr), hf_share(c, sr)
        check('EQ wirkt hörbar (Höhen −12 dB)', h2 < h1 * 0.3, f'Höhenanteil > 6 kHz: {h1:.4f} → {h2:.4f}')
        # 3) Export wie gehört
        async with pg.expect_download() as dl:
            await pg.click('#loopExport')
        dd = await dl.value; z = zipfile.ZipFile(io.BytesIO(open(await dd.path(), 'rb').read()))
        stem = [n for n in z.namelist() if 'Spur 1' in n][0]; sx, ssr = wav_read(z.read(stem))
        src = np.frombuffer(open(T + 'stereo/rock_120_2T_st.wav', 'rb').read()[44:], dtype=np.int16).reshape(-1, 2) / 32767
        hs, hsrc = hf_share(sx[:, 0], ssr), hf_share(src[:, 0], 22050, 6000)
        check('Logic-Export: Spur mit EQ wie gehört', hs < hsrc * 0.4, f'Höhenanteil Quelle {hsrc:.4f} → Export {hs:.4f}')
        # 4) Drums-EQ
        await pg.click('#drumEqBtn'); await pg.wait_for_timeout(150)
        await pg.select_option('#drumEqPanel .eq-pre', 'Weniger Becken'); await pg.wait_for_timeout(100)
        de = await pg.evaluate('Rhythm.getEq()'); st = await pg.evaluate('Rhythm.getState().eq')
        check('Drum-EQ: Vorlage, im Zustand enthalten', de == [0, 0, 0, 0, -1.5, -4, -6] and st == de and await pg.inner_text('#drumEqBtn') == 'EQ ●', de)
        await pg.click('#loopDrums'); await pg.wait_for_timeout(1500)
        # 5) Idee speichern und laden
        await pg.evaluate("Looper.setTrackEq(0, [3,0,0,0,0,0,-2])")
        await pg.fill('#ideaName', 'EQ-Idee'); await pg.click('#ideaSave'); await pg.wait_for_timeout(1200)
        await pg.evaluate("Looper.setTrackEq(0, [0,0,0,0,0,0,0]); Rhythm.setEq([0,0,0,0,0,0,0])")
        await pg.click('.idea-row [data-act="load"]'); await pg.wait_for_timeout(2000)
        l1 = await pg.evaluate('Looper.getTrackEq(0)'); l2 = await pg.evaluate('Rhythm.getEq()')
        check('Idee: EQ von Spur und Drums wiederhergestellt', l1 == [3, 0, 0, 0, 0, 0, -2] and l2 == [0, 0, 0, 0, -1.5, -4, -6], f'{l1} | {l2}')
        # 6) bleibt nach Neuladen
        await pg.reload(); await pg.wait_for_timeout(800)
        r1 = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-eq0'))"); r2 = await pg.evaluate('Rhythm.getEq()')
        check('EQ bleibt nach Neustart', r1 == l1 and r2 == l2, f'{r1} | {r2}')
        await pg.click('#tab-looper'); await pg.click('#eqb0'); await pg.click('#drumEqBtn'); await pg.wait_for_timeout(300)
        y = await pg.evaluate("document.querySelector('.tracks').getBoundingClientRect().top + scrollY")
        await pg.screenshot(path=O + 'eq_track.png', full_page=True, clip={'x': 0, 'y': y + 380, 'width': 1024, 'height': 420})
        y2 = await pg.evaluate("document.getElementById('drumEqPanel').getBoundingClientRect().top + scrollY")
        await pg.screenshot(path=O + 'eq_drums.png', full_page=True, clip={'x': 0, 'y': y2 - 60, 'width': 1024, 'height': 300})
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'\nErgebnis: {sum(res)}/{len(res)} Prüfungen bestanden')
asyncio.run(main())
