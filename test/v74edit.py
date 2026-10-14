# v74: Tempo ±1 (Kopf), Schleife/Mitsingen ±1 %, Wort dazwischen, Zeile fertig (🔒), Rest nachprüfen (+ ↶), Rest mitziehen stoppt an fertigen Zeilen, Akkorde über dem Mitsingen-Text
import asyncio, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
SYL = json.load(open(T + 'sing/silben.json'))
SB = "(s=>{const src=Sing.source(SoloInfo());return Sing.f2b(s*src.sr,src.beats)})"
BS = "(b=>{const src=Sing.source(SoloInfo());return Sing.b2f(b,src.beats)/src.sr})"
TK = "Sing.source(SoloInfo()).tok"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(800)
        # Tempo ±1
        v0 = int(await pg.input_value('#bpm')); await pg.click('#bpmUp'); await pg.click('#bpmUp'); await pg.click('#bpmDn')
        check('Tempo + / − in 1er-Schritten', int(await pg.input_value('#bpm')) == v0 + 1 and (await pg.inner_text('#bpmVal')).strip() == str(v0 + 1), (v0, await pg.input_value('#bpm')))
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', T + 'sing/silben.wav')
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        if await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        # Zeile 0 (Silben 0–5) richtig + Erkennungszeit 0,3 s zu spät; Zeile 1 (6–11) noch auf der Erkennungszeit
        tok = []
        for i, t in enumerate(SYL[:12]):
            tb = await pg.evaluate(SB + "(%f)" % t); ab = await pg.evaluate(SB + "(%f)" % (t + 0.3))
            tok.append({"w": "w%d" % i, "b": round(tb if i < 6 else ab, 3), "a": round(ab, 3), "l": i // 6})
        key = await pg.evaluate("Sing.source(SoloInfo()).id")
        await pg.evaluate("(([k,t])=>{const d={v:1,f:{},l:{}};d.f[k]={name:'silben.wav',tok:t};localStorage.setItem('3nps-sing',JSON.stringify(d));Sing._reload();})(%s)" % json.dumps([key, tok]))
        await pg.wait_for_timeout(400)
        await pg.click('#sgStrip .sg-w[data-i="2"]'); await pg.wait_for_timeout(400)
        # Schleife ±1 %
        await pg.click('#sgFLoop'); await pg.wait_for_timeout(300); await pg.click('#sgFRateDn'); await pg.click('#sgFRateDn'); await pg.wait_for_timeout(700)
        check('Schleifen-Tempo −1 % je Tipp, Schleife läuft mit 98 %', await pg.inner_text('#sgFRateV') == '98 %' and await pg.evaluate("Sing.prec().rate") == 0.98, (await pg.inner_text('#sgFRateV'), await pg.evaluate("Sing.prec().rate")))
        await pg.click('#sgFRate [data-r="1"]'); await pg.click('#sgFStop'); await pg.wait_for_timeout(200)
        # Zeile 0 sperren
        await pg.click('#sgFLock'); await pg.wait_for_timeout(300)
        t1 = await pg.evaluate(TK)
        check('🔒 Zeile fertig: ganze Zeile gesperrt, Anzeige grün', all(t.get('k') for t in t1[:6]) and not any(t.get('k') for t in t1[6:]) and await pg.evaluate("document.querySelectorAll('#sgStrip .sg-w.lk').length") >= 1 and 'freigeben' in await pg.inner_text('#sgFLock'))
        # Rest nachprüfen
        await pg.click('#sgFCheck')
        for _ in range(40):
            await pg.wait_for_timeout(250)
            if 'korrigiert' in await pg.inner_text('#sgFMsg'): break
        t2 = await pg.evaluate(TK); msg = await pg.inner_text('#sgFMsg')
        secs = [await pg.evaluate(BS + "(%f)" % t2[i]['b']) for i in range(12)]
        check('fertige Zeile unverändert', [t['b'] for t in t2[:6]] == [t['b'] for t in t1[:6]])
        check('Rest nachgeprüft: Zeile 2 sitzt auf den Silben (±30 ms)', all(abs(secs[i] - SYL[i]) <= 0.03 for i in range(6, 12)), ([round(secs[i] - SYL[i], 3) for i in range(6, 12)], msg))
        check('Meldung nennt Versatz ~300 ms', '300 ms' in msg or '299 ms' in msg or '301 ms' in msg, msg)
        await pg.click('#sgFUndo'); await pg.wait_for_timeout(300)
        check('↶ nimmt die Nachprüfung zurück', [t['b'] for t in await pg.evaluate(TK)] == [t['b'] for t in t1])
        # Rest mitziehen stoppt an fertigen Zeilen (Feinschritt mit Rest mitziehen an)
        if not await pg.evaluate("document.getElementById('sgRipple').classList.contains('active')"): await pg.click('#sgRipple')
        await pg.evaluate("Sing.focus(SoloFocus.get())"); await pg.wait_for_timeout(200)
        t3 = await pg.evaluate(TK)
        # Zeile 0 freigeben, Zeile 1 sperren, dann Wort 2 nach hinten schieben → 3–5 wandern mit, 6–11 bleiben
        await pg.click('#sgStrip .sg-w[data-i="2"]'); await pg.wait_for_timeout(250)
        await pg.click('#sgFLock'); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{const t=Sing.source(SoloInfo()).tok;t.forEach(x=>{if(x.l===1)x.k=1});})()")
        t3 = await pg.evaluate(TK)
        await pg.click('#sgFNudgeR'); await pg.wait_for_timeout(250)
        t4 = await pg.evaluate(TK)
        check('Rest mitziehen stoppt vor der fertigen Zeile', t4[3]['b'] > t3[3]['b'] and [t['b'] for t in t4[6:]] == [t['b'] for t in t3[6:]], ([round(t4[j]['b'] - t3[j]['b'], 3) for j in range(12)]))
        # Wort dazwischen (Fokusleiste)
        n0 = len(t4); b2, b3 = t4[2]['b'], t4[3]['b']
        await pg.click('#sgFIns'); await pg.wait_for_timeout(250)
        await pg.fill('#sgStrip .sg-inline input', 'neu'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        t5 = await pg.evaluate(TK)
        check('＋ Wort danach: zwischen den beiden, gleiche Zeile', len(t5) == n0 + 1 and t5[3]['w'] == 'neu' and b2 < t5[3]['b'] < b3 and t5[3]['l'] == t5[2]['l'], t5[2:5])
        # auch zwei Wörter dazwischen
        await pg.click('#sgStrip .sg-w[data-i="3"]'); await pg.wait_for_timeout(200)
        await pg.click('#sgFIns'); await pg.fill('#sgStrip .sg-inline input', 'eins zwei'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        t6 = await pg.evaluate(TK); ws = [t['w'] for t in t6[:8]]; bb = [t['b'] for t in t6]
        check('mehrere Wörter dazwischen, Reihenfolge stimmt', ws[2:7] == ['w2', 'neu', 'eins', 'zwei', 'w3'] and all(bb[i] < bb[i + 1] for i in range(len(bb) - 1)), ws)
        # Editor-Karte: ＋ Wort danach
        await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        check('Gesangstext-Karte hat „＋ Wort danach“', await pg.is_visible('#sgInsA'))
        await pg.click('#sgToggle')
        # Mitsingen: Akkorde über dem Text
        await pg.click('#sgFDone'); await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        await pg.evaluate("Looper.seek(0, Sing.b2f(%s[0].b - 2, Sing.source(SoloInfo()).beats) - Sing.source(SoloInfo()).origPos)" % TK)
        await pg.click('#tab-singen'); await pg.wait_for_timeout(1500)
        ch = await pg.evaluate("[...document.querySelectorAll('#sbLine .sb-ch')].map(x=>x.textContent)")
        names = await pg.evaluate("SoloInfo().segs.map(s=>s.name)")
        check('Mitsingen: Akkorde über den Wörtern', len(ch) >= 1 and all(c in names for c in ch) and await pg.evaluate("document.getElementById('sbLine').classList.contains('has-ch')"), (ch, names[:6]))
        await pg.click('#sbSpDn'); await pg.wait_for_timeout(100)
        check('Mitsingen-Tempo −1 %', await pg.inner_text('#sbSpV') == '99 %')
        check('keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
