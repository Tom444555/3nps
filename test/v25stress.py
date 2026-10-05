# v25 Belastung: Looper mit 3 Spuren + Drums, ständiger Reiterwechsel über alle 6 Reiter, Mithören an/aus,
# Jam 20× starten/stoppen, Griffe/Tonleitern umschalten. Prüft Fehler, späte Drum-Schläge, Speicher, Ruckler,
# und dass der Jam danach noch exakt im Takt wechselt (keine doppelt angemeldeten Taktmeldungen).
import asyncio, random
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def main():
    random.seed(11)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=/home/claude/3nps/test/mithoeren.wav', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T', 'loops/guitar_only_95_4T']):
            await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(4000)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        await pg.evaluate("""() => { window.__ft = []; let last = performance.now(); (function f(t){ window.__ft.push(t - last); last = t; if (window.__ft.length > 6000) window.__ft.splice(0, 3000); requestAnimationFrame(f); })(performance.now());
          window.__lt = 0; try { new PerformanceObserver(l => { window.__lt += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch (e) {} }""")
        await pg.click('#loopDrums')
        heap0 = await pg.evaluate("(gc && gc(), performance.memory.usedJSHeapSize / 1e6)")
        late0 = await pg.evaluate("Rhythm.debug().late")
        tabs = ['looper', 'quinten', 'solo', 'jam', 'ueben', 'griffbrett']
        for k in range(160):
            t = random.choice(tabs); await pg.click('#tab-' + t); await pg.wait_for_timeout(random.choice([40, 80, 150, 300]))
            if t == 'solo':
                a = random.random()
                if a < 0.3: await pg.click('#sfListen')
                elif a < 0.5: await pg.click('#sfNeckMode button[data-m="grip"]')
                elif a < 0.7: await pg.click('#sfNeckMode button[data-m="scale"]')
                elif a < 0.85: await pg.click('.sf-sc >> nth=1')
            if t == 'ueben':
                await pg.click('#ubNav [data-s="%s"]' % random.choice(['tag', 'ohr', 'lick', 'solo']))
        heap1 = await pg.evaluate("(gc && gc(), performance.memory.usedJSHeapSize / 1e6)")
        st = await pg.evaluate("Looper.debug().tracks.map(t => t.state)")
        late1 = await pg.evaluate("Rhythm.debug().late")
        ft = await pg.evaluate("window.__ft.slice().sort((a,b)=>a-b)"); lt = await pg.evaluate("window.__lt")
        p99 = ft[int(len(ft) * 0.99)]
        check('160 Reiterwechsel bei laufendem Looper: Spuren laufen weiter', st == ['playing'] * 3, st)
        check('Keine verspäteten Drum-Schläge', late1 - late0 == 0, late1 - late0)
        check('Speicher stabil', heap1 - heap0 < 12, f'{heap0:.1f} → {heap1:.1f} MB')
        check('Bildrate wie v24 (p99 ≤ 200 ms beim Reiteröffnen)', p99 <= 200, f'Median {ft[len(ft)//2]:.1f} ms · p99 {p99:.1f} ms · lange Tasks {lt}')
        # Jam 20× starten/stoppen (Looper vorher aus)
        await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(400)
        await pg.click('#tab-jam'); await pg.evaluate("Jam.setSeq('Am F C G')")
        await pg.evaluate("(() => { const e = document.getElementById('bpm'); e.value = 120; e.dispatchEvent(new Event('input')); })()")
        for k in range(20):
            await pg.click('#jamPlay'); await pg.wait_for_timeout(random.choice([60, 200, 700])); await pg.click('#jamPlay'); await pg.wait_for_timeout(50)
        await pg.click('#jamPlay'); await pg.wait_for_timeout(500)
        seen = []; t0 = None
        for k in range(48):
            await pg.wait_for_timeout(125)
            n = await pg.evaluate("Jam.nowChord()?.name")
            tt = await pg.evaluate("audioCtx.currentTime")
            if n and (not seen or seen[-1][0] != n): seen.append((n, tt))
        d = [round(seen[i + 1][1] - seen[i][1], 2) for i in range(len(seen) - 1)]
        check('Nach 20× Start/Stopp wechselt der Jam genau jeden Takt (2 s)', len(d) >= 2 and all(1.8 <= x <= 2.2 for x in d[1:]), [s[0] for s in seen] + d)
        await pg.click('#jamPlay')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
