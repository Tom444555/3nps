# v21: drei Reiter (Looper | Griffbrett | Quintenzirkel), Begleitung/Song/Log im Griffbrett, Quintenzirkel
import asyncio
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; O = '/tmp/claude-0/-home-claude/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t => t.textContent)")
        check('Reiter, Looper links', tabs == ['Looper', 'Quintenzirkel', 'Solo Finder', 'Griffbrett'], tabs)
        check('Start im Looper', await pg.is_visible('#panel-looper'))
        await pg.click('#tab-griffbrett'); await pg.wait_for_timeout(400)
        ids = ['fretboard', 'droneBtn', 'btnBass', 'beglDrumsHome', 'audioFile', 'logList', 'statToday']
        inside = await pg.evaluate("ids => ids.map(i => !!document.querySelector('#panel-griffbrett #' + i))", ids)
        check('Griffbrett enthält Begleitung, Song und Log', all(inside), dict(zip(ids, inside)))
        lane = await pg.evaluate("!!document.querySelector('#beglDrumsHome .lane-drums')")
        check('Drum-Spur wandert ins Griffbrett', lane)
        await pg.screenshot(path=O + 'v21_griff.png', full_page=True)
        await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        check('Drum-Spur zurück im Looper', await pg.evaluate("!!document.querySelector('#loopDrumsHome .lane-drums')"))
        # alter gespeicherter Reiter → Griffbrett
        await pg.evaluate("localStorage.setItem('3nps-tab', 'begleitung')"); await pg.reload(); await pg.wait_for_timeout(800)
        check('Gespeicherter alter Reiter „Begleitung“ öffnet Griffbrett', await pg.is_visible('#panel-griffbrett'))
        # Quintenzirkel
        await pg.select_option('#root', 'D'); await pg.select_option('#mode', 'Ionisch (Dur)')
        await pg.click('#tab-quinten'); await pg.wait_for_timeout(400)
        i = await pg.evaluate('Quinten.info()')
        check('Zirkel übernimmt Tonart vom Griffbrett (D-Dur)', await pg.inner_text('#qzKey') == 'D-Dur' and i['acc'] == 2, await pg.inner_text('#qzAcc'))
        check('D-Dur: Tonleiter und Akkorde', i['notes'] == ['D','E','F♯','G','A','B','C♯'] and [c['name'] for c in i['chords']] == ['D','Em','F♯m','G','A','Bm','C♯°'], [c['name'] for c in i['chords']])
        check('Stufen im Zirkel markiert (7)', await pg.evaluate("document.querySelectorAll('.qz-seg.in').length") == 7)
        await pg.click('.qz-seg.qz-maj[data-k=\"10\"]'); await pg.wait_for_timeout(200)
        i = await pg.evaluate('Quinten.info()')
        check('Antippen: B♭-Dur (2 ♭, B♭ C D E♭ F G A)', await pg.inner_text('#qzKey') == 'B♭-Dur' and i['notes'] == ['B♭','C','D','E♭','F','G','A'], i['notes'])
        await pg.click('.qz-seg.qz-min[data-k=\"6\"]'); await pg.wait_for_timeout(200)
        i = await pg.evaluate('Quinten.info()')
        check('Moll-Ring: D♯-Moll (6 ♯)', await pg.inner_text('#qzKey') == 'D♯-Moll' and i['acc'] == 6 and i['notes'][0] == 'D♯' and i['notes'][6] == 'C♯', i['notes'])
        await pg.click('.qz-seg.qz-min[data-k=\"1\"]'); await pg.wait_for_timeout(200)
        i = await pg.evaluate('Quinten.info()')
        check('E-Moll: Akkorde i ii° III iv v VI VII', [c['name'] for c in i['chords']] == ['Em','F♯°','G','Am','Bm','C','D'], [c['name'] for c in i['chords']])
        await pg.click('.qz-ch[data-i=\"3\"]'); await pg.wait_for_timeout(200)
        await pg.click('#qzApply'); await pg.wait_for_timeout(300)
        rm = await pg.evaluate("[rootSel.value, modeSel.value]")
        check('Ins Griffbrett übernehmen: E Äolisch', rm == ['E', 'Äolisch (Moll)'], rm)
        check('Knopf zeigt „Im Griffbrett“', 'Im Griffbrett' in await pg.inner_text('#qzApply'))
        pc = await pg.evaluate("['Am','C#m7','F','Bdim','A#maj7','G#m'].map(n => Quinten.parseChord(n))")
        check('Looper-Akkorde werden im Zirkel gefunden', [(q['ring'], q['k']) for q in pc] == [('min',0),('min',4),('maj',11),('dim',0),('maj',10),('min',5)], pc)
        # klingender Akkord aus dem Looper
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        await pg.set_input_files('#file0', T + 'chords/c_pop_strum.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if await pg.evaluate("!document.getElementById('thc0').hidden"): break
        await pg.click('#tab-quinten'); hits = 0; seenQ = set()
        for k in range(16):
            await pg.wait_for_timeout(250)
            a = await pg.evaluate("[(Looper.nowChord() || {}).name, document.querySelector('.qz-c3').textContent, document.querySelector('.qz-live').getAttribute('d')]")
            if a[0] and a[1].endswith(a[0].replace('#', '♯')) and a[2]: hits += 1; seenQ.add(a[0])
            if k == 8: await pg.screenshot(path=O + 'v21_quinten.png', full_page=False)
        check('Klingender Looper-Akkord leuchtet im Zirkel (wechselt mit)', hits >= 13 and len(seenQ) >= 3, f'{hits} · {sorted(seenQ)}')
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(300)
        ow = await pg.evaluate("document.documentElement.scrollWidth")
        check('Schmal (iPhone): kein seitliches Scrollen', ow <= 390, ow)
        await pg.screenshot(path=O + 'v21_quinten_schmal.png', full_page=True)
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{sum(res)}/{len(res)}')
asyncio.run(main())
