# v63: Reiter Mitsingen – Anzeige, Einzähler, Schlagpunkte, Zeile üben (100/75 %), Mikrofon-Rückmeldung, Übersetzung, Englisch
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
TOK = [{"w": w, "b": b, "l": l} for (w, b, l) in [("Hold", 8, 0), ("on", 8.5, 0), ("to", 9, 0), ("the", 9.5, 0), ("night", 10, 0), ("we", 13, 1), ("were", 13.5, 1), ("young", 14, 1), ("and", 15, 1), ("free", 15.5, 1)]]
INIT = "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-sing',%s);}" % json.dumps(json.dumps({"v": 1, "f": {"ballad_72.wav|420": {"name": "ballad_72.wav", "tok": TOK}}, "l": {}}))
async def load(pg):
    await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'corpus/ballad_72.wav')
    for _ in range(60):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if (await pg.inner_text('#loopStatus')).startswith(('Spur 1:', 'Track 1:')): break
async def seekB(pg, b):
    await pg.evaluate("b=>{const s=Looper.singSrc(0);Looper.seek(0, Sing.b2f(b,s.beats)-s.origPos)}", b)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT); await pg.goto(U); await pg.wait_for_timeout(800)
        tabs = await pg.evaluate("[...document.querySelectorAll('[role=tab]')].map(t=>t.textContent.trim())")
        check('Reiter „Mitsingen“ nach Songwriting', tabs == ['Looper', 'Improvisation', 'CAGED', 'Quintenzirkel', 'Backing Track', 'Songwriting', 'Mitsingen', 'Mastering', 'Training', 'Technik'], tabs)
        await pg.click('#tab-singen'); await pg.wait_for_timeout(300)
        check('ohne Quelle: Hinweis', await pg.is_visible('#sbEmpty'))
        await pg.click('#tab-looper'); await load(pg)
        if await pg.evaluate("Looper.debug().tracks[0].state") != 'playing': await pg.click('#loopAll')
        await pg.click('#tab-singen'); await seekB(pg, 5.6); await pg.wait_for_timeout(400)
        check('Zeile groß angezeigt, nächste klein', (await pg.evaluate("[...document.getElementById('sbLine').querySelectorAll('.sb-w')].map(w=>[...w.childNodes].filter(n=>!(n.classList&&n.classList.contains('sb-ch'))).map(n=>n.textContent).join('')).join(' ').replace(/[+-]?\\d+/g,'').replace(/\\s+/g,' ').trim()")) == 'Hold on to the night' and await pg.inner_text('#sbNext') == 'we were young and free', (await pg.evaluate("[...document.getElementById('sbLine').querySelectorAll('.sb-w')].map(w=>[...w.childNodes].filter(n=>!(n.classList&&n.classList.contains('sb-ch'))).map(n=>n.textContent).join('')).join(' ').replace(/[+-]?\\d+/g,'').replace(/\\s+/g,' ').trim()")))
        cnts = set()
        for _ in range(40):
            cnts.add(await pg.inner_text('#sbCount')); await pg.wait_for_timeout(50)
        check('Einzähler vor dem Einsatz (3 – 2 – 1)', {'2', '1'} <= cnts, sorted(cnts))
        dots = await pg.evaluate("[...document.querySelectorAll('#sbDots i.on')].length")
        check('Schlagpunkt leuchtet', dots == 1)
        await seekB(pg, 8.2); await pg.wait_for_timeout(250)
        ps = await pg.evaluate("[...document.querySelectorAll('#sbLine .sb-fill')].map(e=>{const m=/scaleX\\(([\\d.]+)\\)/.exec(e.style.transform);return m?+m[1]:0})")
        check('aktuelles Wort füllt sich anteilig', 0 < ps[0] <= 1 and ps[2] == 0, ps)
        # Zeile üben
        await pg.click('#sbLoop'); await pg.wait_for_timeout(1500)
        d = await pg.evaluate("Singen.debug()")
        check('Zeile üben: eigener Player, Looper angehalten', d['player'] and await pg.evaluate("Looper.debug().tracks[0].state") != 'playing', d)
        line0 = (await pg.evaluate("[...document.getElementById('sbLine').querySelectorAll('.sb-w')].map(w=>[...w.childNodes].filter(n=>!(n.classList&&n.classList.contains('sb-ch'))).map(n=>n.textContent).join('')).join(' ').replace(/[+-]?\\d+/g,'').replace(/\\s+/g,' ').trim()"))
        check('Übungszeile = aktuelle Zeile', line0 == 'Hold on to the night', line0)
        await pg.click('#sbSpeed [data-s="0.75"]'); await pg.wait_for_timeout(2500)
        d2 = await pg.evaluate("Singen.debug()")
        check('75 %: Player neu mit gedehnter Zeile', d2['player'] and d2['speed'] == 0.75 and '75 %' in await pg.inner_text('#sbSrc'), await pg.inner_text('#sbSrc'))
        await pg.click('#sbNextL'); await pg.wait_for_timeout(2500)
        dd = await pg.evaluate("Singen.debug()"); ln = (await pg.evaluate("[...document.getElementById('sbLine').querySelectorAll('.sb-w')].map(w=>[...w.childNodes].filter(n=>!(n.classList&&n.classList.contains('sb-ch'))).map(n=>n.textContent).join('')).join(' ').replace(/[+-]?\\d+/g,'').replace(/\\s+/g,' ').trim()"))
        check('Zeile ▶ übt die nächste Zeile', dd['line'] == 1 and ln == 'we were young and free', (dd['line'], ln, await pg.inner_text('#sbLoopInfo')))
        # Mikrofon (Testgerät piept regelmäßig)
        await pg.click('#sbMic'); got = {}
        for _ in range(40):
            await pg.wait_for_timeout(250); got = (await pg.evaluate("Singen.debug()"))['res']
            if got: break
        check('Timing prüfen: Einsätze werden Wörtern zugeordnet', len(got) >= 1, got)
        check('Auswertung je Zeile angezeigt', 'genau' in await pg.inner_text('#sbScore') and 'ms' in await pg.inner_text('#sbScore'), await pg.inner_text('#sbScore'))
        check('Markierung am Wort', await pg.evaluate("document.querySelectorAll('#sbLine .sb-d').length") >= 1)
        # Übersetzung
        await pg.click('.sb-tredit summary'); await pg.wait_for_timeout(200)
        await pg.fill('#sbTrText', 'Halte die Nacht fest\nwir waren jung und frei'); await pg.click('#sbTrSave'); await pg.wait_for_timeout(400)
        check('Übersetzung unter der Zeile', await pg.inner_text('#sbTr') == 'wir waren jung und frei', await pg.inner_text('#sbTr'))
        await pg.uncheck('#sbTrOn'); await pg.wait_for_timeout(200)
        check('Übersetzung abschaltbar', await pg.inner_text('#sbTr') == '')
        await pg.check('#sbTrOn')
        await pg.click('#sbTrClaude'); await pg.wait_for_timeout(300)
        it = await pg.inner_text('#sbTrInfo')
        check('Auftrag für Claude (kopiert oder im Feld)', 'Kopiert' in it or 'Übersetze diesen Liedtext' in await pg.input_value('#sbTrText'), it)
        # Reiter verlassen → Player und Mikrofon aus
        await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        d3 = await pg.evaluate("Singen.debug()")
        check('Reiter verlassen: Übung und Mikrofon aus', not d3['player'] and not d3['mic'], d3)
        check('keine Skriptfehler', not errs, errs)
        # Englisch
        pg2 = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); e2 = []
        pg2.on('pageerror', lambda e: e2.append(str(e)))
        await pg2.goto(U + '?lang=en'); await pg2.wait_for_timeout(800); await pg2.click('#tab-singen'); await pg2.wait_for_timeout(300)
        t = await pg2.inner_text('#panel-singen')
        check('EN: Reiter englisch', await pg2.inner_text('#tab-singen') == 'Sing along' and 'Practise line' in t and 'Check timing' in t and 'Übersetzung' not in t, await pg2.inner_text('#tab-singen'))
        check('EN: keine Skriptfehler', not e2, e2)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
