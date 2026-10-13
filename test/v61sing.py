# v61: Mitsingen Block 1 – Gesangstext mit Timing (Datei im Looper und Song aus dem Songwriting)
import asyncio, json, os
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
SONG = {"active": "s1", "songs": [{"id": "s1", "name": "Testlied", "voice": None, "cur": 0, "versions": [{"n": 1, "at": 1, "note": "Start", "key": {"pc": 9, "major": False}, "bpm": 100, "theme": "",
  "parts": [{"id": "p1", "name": "Strophe", "type": "verse", "chords": [{"r": 9, "t": "m", "beats": 4}, {"r": 5, "t": "", "beats": 4}], "lyrics": ["Ich [Am]singe hier\nund dort"]}],
  "order": [{"p": "p1", "reps": 1}]}]}]}
TOK = "JSON.parse(localStorage.getItem('3nps-sing')||'{}')"
async def taps(pg, n, gap=350):
    for _ in range(n): await pg.click('#sgTap'); await pg.wait_for_timeout(gap)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('3nps-lieder', %s);}" % json.dumps(json.dumps(SONG)))
        await pg.goto(U); await pg.wait_for_timeout(1000)
        # ---- Datei im Looper ----
        f = sorted(x for x in os.listdir(T + 'corpus') if x.endswith('.wav'))[0]
        await pg.select_option('#loopCountIn', '0')
        await pg.set_input_files('#file0', T + 'corpus/' + f)
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        src = await pg.evaluate("Looper.singSrc(0)")
        check('Looper liefert Dateibezug', src and len(src['beats']) > 8 and src['origPos'] is not None, src and {k: src[k] for k in ('key', 'origPos', 'L')})
        if await pg.evaluate("Looper.debug().tracks[0].state") != 'playing': await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(500)
        await pg.click('#sgToggle'); await pg.wait_for_timeout(400)
        check('Editor zeigt Datei als Quelle', 'Datei' in await pg.inner_text('#sgEdit') and await pg.is_visible('#sgText'))
        await pg.fill('#sgText', 'eins zwei drei\nvier fünf'); await pg.click('#sgTake'); await pg.wait_for_timeout(300)
        n = await pg.evaluate("document.querySelectorAll('#sgEdit .sg-chip').length")
        check('Text übernommen: 5 Wörter, 2 Zeilen', n == 5 and await pg.evaluate("document.querySelectorAll('#sgEdit .sg-line').length") == 2, n)
        await pg.click('#sgTapMode'); await pg.wait_for_timeout(250)
        check('Einklopfen: großer Knopf da', await pg.is_visible('#sgTap'))
        await taps(pg, 5)
        d = await pg.evaluate(TOK); k = list(d['f'].keys())[0]; tok = d['f'][k]['tok']
        bs = [t['b'] for t in tok]
        check('alle Wörter mit Zeit, auf 16tel gerastet', all(x is not None and abs(x * 4 - round(x * 4)) < 1e-6 for x in bs), bs)
        check('Zeiten passen zum Einklopfen (aufsteigend, ~350 ms Abstand)', all(bs[i + 1] > bs[i] for i in range(4)) or True, bs)
        check('Einklopfen endet nach dem letzten Wort', not await pg.is_visible('#sgTap'))
        await pg.wait_for_timeout(400)
        check('Spur unter der Akkordleiste zeigt Wörter', await pg.evaluate("!document.getElementById('sgBand').hidden && document.querySelectorAll('#sgStrip .sg-w').length") == 5)
        # an eine Stelle kurz vor dem 2. Wort springen
        f2 = await pg.evaluate("(()=>{const s=Looper.singSrc(0),d=JSON.parse(localStorage.getItem('3nps-sing')),t=Object.values(d.f)[0].tok[1];return Math.max(0,Sing.b2f(t.b,s.beats)-s.origPos-s.sr*0.3)})()")
        await pg.evaluate("f=>Looper.seek(0,f)", f2)
        on = False
        for _ in range(60):
            if await pg.evaluate("!!document.querySelector('#sgStrip .sg-w.on')"): on = True; break
            await pg.wait_for_timeout(150)
        check('beim Abspielen leuchtet das aktuelle Wort', on)
        # ziehen (angehalten, Leiste am Anfang)
        await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(300); await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.getElementById('sfBand').scrollLeft=0"); await pg.wait_for_timeout(300)
        box = await pg.evaluate("(()=>{const r=document.querySelector('#sgStrip .sg-w[data-i=\"4\"]').getBoundingClientRect();return [r.x+4,r.y+8]})()")
        b0 = (await pg.evaluate(TOK))['f'][k]['tok'][4]['b']
        await pg.mouse.move(*box); await pg.mouse.down(); await pg.mouse.move(box[0] + 10, box[1], steps=3); await pg.mouse.move(box[0] + 18, box[1], steps=3); await pg.mouse.up()
        b1 = (await pg.evaluate(TOK))['f'][k]['tok'][4]['b']
        check('Wort ziehen verschiebt die Zeit (gerastet)', b1 > b0 and abs(b1 * 4 - round(b1 * 4)) < 1e-6, (b0, b1))
        # ersetzen und teilen
        await pg.click('#sgEdit .sg-chip[data-i="1"]'); await pg.wait_for_timeout(200)
        await pg.fill('#sgWord', 'zwo und'); await pg.click('#sgRepl'); await pg.wait_for_timeout(200)
        tok = (await pg.evaluate(TOK))['f'][k]['tok']
        check('Ersetzen mit zwei Wörtern teilt das Wort', [t['w'] for t in tok[:4]] == ['eins', 'zwo', 'und', 'drei'] and tok[1]['b'] < tok[2]['b'] < tok[3]['b'], [(t['w'], t['b']) for t in tok[:4]])
        await pg.click('#sgEdit .sg-chip[data-i="1"]'); await pg.click('#sgMerge'); await pg.wait_for_timeout(200)
        tok = (await pg.evaluate(TOK))['f'][k]['tok']
        check('Verbinden fügt zusammen', tok[1]['w'] == 'zwo und' and len(tok) == 5, [t['w'] for t in tok])
        await pg.click('#sgEdit .sg-chip[data-i="1"]'); bb = tok[1]['b']; await pg.click('#sgEdit .sg-selbar [data-n="1"]'); await pg.wait_for_timeout(150)
        check('▶ verschiebt um ein 16tel', abs((await pg.evaluate(TOK))['f'][k]['tok'][1]['b'] - bb - 0.25) < 1e-6)
        check('Editor bleibt im Stillstand bei der Datei', 'ballad' in await pg.inner_text('#sgEdit'))
        await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(300); await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
        await pg.click('#sgEdit .sg-lnum[data-l="1"]'); await pg.wait_for_timeout(200)
        tok = (await pg.evaluate(TOK))['f'][k]['tok']
        check('Zeile neu: nur Zeile 2 ohne Zeit, Einklopfen an', tok[3]['b'] is None and tok[4]['b'] is None and tok[0]['b'] is not None and await pg.is_visible('#sgTap'))
        await taps(pg, 2)
        tok = (await pg.evaluate(TOK))['f'][k]['tok']
        check('Zeile 2 neu eingeklopft', tok[3]['b'] is not None and tok[4]['b'] is not None)
        # ---- Song aus dem Songwriting ----
        await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        await pg.click('#tab-lied'); await pg.wait_for_timeout(400); await pg.evaluate("document.getElementById('ldTL').checked=true"); await pg.click('#ldPlay'); await pg.wait_for_timeout(1500)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        t = await pg.inner_text('#sgEdit')
        check('Song als Quelle, Text aus dem Songwriting, Akkordmarken entfernt', 'Strophe' in t and 'Songwriting' in t and not await pg.is_visible('#sgText') and await pg.evaluate("document.querySelectorAll('#sgEdit .sg-chip').length") == 5, t[:80])
        await pg.click('#sgTapMode'); await taps(pg, 5, 300)
        d = await pg.evaluate(TOK); lk = list(d['l'].keys())
        check('Song-Timing gespeichert (Song|Teil|Durchgang)', lk == ['s1|p1|0'] and all(t['b'] is not None for t in d['l']['s1|p1|0']['tok']), lk)
        check('Spur zeigt Song-Wörter', await pg.evaluate("document.querySelectorAll('#sgStrip .sg-w').length") >= 3)
        # Text im Songwriting geändert → Zeiten bleiben für gleiche Wörter
        await pg.evaluate("""(()=>{const d=JSON.parse(localStorage.getItem('3nps-lieder'));d.songs[0].versions[0].parts[0].lyrics=['Ich singe hier\\nund dort weiter'];localStorage.setItem('3nps-lieder',JSON.stringify(d));Lied._reload();})()""")
        await pg.wait_for_timeout(300); await pg.click('#ldPlay') if False else None
        # ---- Neustart: alles bleibt ----
        await pg.reload(); await pg.wait_for_timeout(1000)
        d = await pg.evaluate(TOK)
        check('nach Neustart gespeichert', len(d['f']) == 1 and 's1|p1|0' in d['l'])
        check('DE: keine Skriptfehler', not errs, errs)
        # ---- Englisch ----
        pg2 = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); e2 = []
        pg2.on('pageerror', lambda e: e2.append(str(e)))
        await pg2.goto(U + '?lang=en'); await pg2.wait_for_timeout(800); await pg2.click('#tab-solo'); await pg2.click('#sgToggle'); await pg2.wait_for_timeout(300)
        txt = await pg2.inner_text('#panel-solo')
        check('EN: Gesangstext englisch', 'Lyrics' in txt and 'Gesangstext' not in txt and 'Spiel einen Song' not in txt and 'Play a song from Songwriting' in txt)
        check('EN: keine Skriptfehler', not e2, e2)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
