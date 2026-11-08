# v138: Jammen – „Welche Tonleiter passt?“ (folgt dem Akkord), „Akkordfolgen-Ideen“ (Stil → Folge → Backing Track),
# „Frage & Antwort“ (Wechsel sichtbar, Länge einstellbar, Frage klingt), „Jam aufnehmen“ (Spur 1 Backing, Spur 2 Aufnahme,
# Loop-Länge unverändert), Lazy, keine Sprünge, keine Skriptfehler
import asyncio, sys, re
from playwright.async_api import async_playwright
from nav import tab
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''), flush=True)
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(900)
        check('ab v138', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 138)
        check('Lazy: Jammen-Karten beim Start leer', await pg.evaluate("['jmFit','jmIdeas','jmQa','jmRec'].every(i=>document.getElementById(i).children.length===0)"))
        await pg.evaluate("Jam.state().key={pc:9,major:false}; Jam.setSeq('Am F C G'); 0")
        await tab(pg, 'jam'); await pg.wait_for_timeout(400)
        check('Beim Öffnen gebaut: 4 Karten', await pg.evaluate("['jmFit','jmIdeas','jmQa','jmRec'].every(i=>document.getElementById(i).children.length>0)"))
        f = await pg.evaluate("JamIdeen.fit()")
        check('Tonleiter passt: erster Akkord Am → A Äolisch, Töne auf dem Griffbrett', 'Am' in f['now'] and 'A Äolisch' in f['now'] and f['dots'] >= 50, f)
        await pg.click('[data-fit=penta]'); f2 = await pg.evaluate("JamIdeen.fit()")
        check('Pentatonik: weniger Töne (A Moll-Pentatonik)', 'A Moll-Pentatonik' in f2['now'] and f2['dots'] < f['dots'], f2)
        await pg.click('[data-fit=arp]'); f3 = await pg.evaluate("JamIdeen.fit()")
        check('Akkordtöne: nur A C E', 'Akkordtöne' in f3['now'] and f3['dots'] < f2['dots'] and await pg.evaluate("[...new Set([...document.querySelectorAll('#jmDots text')].map(t=>t.textContent))].sort().join(',')") == 'A,C,E', f3)
        await pg.click('[data-fit=mode]')
        # läuft mit: Anzeige folgt dem klingenden Akkord, Höhe bleibt, wenig DOM-Änderungen
        await pg.evaluate("document.getElementById('bpm').value=150; document.getElementById('bpm').dispatchEvent(new Event('input')); window.__mut=0; new MutationObserver(m=>{__mut+=m.length}).observe(document.getElementById('jmFit'),{subtree:true,childList:true,characterData:true}); 0")
        h0 = await pg.evaluate("document.getElementById('jmFit').getBoundingClientRect().height")
        await pg.evaluate("Jam.start(); 0"); await pg.wait_for_timeout(1500)
        seen = []; good = 0; n = 0
        for i in range(24):
            r = await pg.evaluate("(()=>{const c=Jam.nowChord();return [c&&c.name, document.getElementById('jmFitNow').textContent]})()")
            if r[0]:
                n += 1; good += r[1].startswith('Klingt jetzt' + r[0] + '→') or r[1].startswith('Klingt jetzt' + r[0])
                if r[0] not in seen: seen.append(r[0])
            await pg.wait_for_timeout(230)
        check('Folgt dem Akkord (Am F C G)', len(seen) >= 3 and good >= n - 3, (seen, good, n))
        nx = await pg.inner_text('#jmFitNext')
        check('„Danach“ zeigt den nächsten Akkord', 'Danach' in nx, nx)
        h1 = await pg.evaluate("document.getElementById('jmFit').getBoundingClientRect().height"); mut = await pg.evaluate("__mut")
        check('Kein Springen: Höhe gleich, DOM nur beim Wechsel', abs(h0 - h1) < 1 and mut < 200, (h0, h1, mut))
        f = await pg.evaluate("JamIdeen.fit()")
        await pg.evaluate("Jam.stop(); 0")
        # Akkordfolgen-Ideen
        for st in ['Rock', 'Blues', 'Pop', 'Metal', 'Funk', 'Jazz', 'Ballade']:
            for key in ['9:m', '0:M']:
                await pg.select_option('#jmKey', key); await pg.select_option('#jmStyle', st)
                ok1 = True
                for k in range(4):
                    await pg.click('#jmRoll'); i = await pg.evaluate("JamIdeen.idea()")
                    pr = await pg.evaluate("t=>{const r=Jam.parse(t);return {n:r.seq.length,bad:(r.bad||r.errors||[]).length}}", i['text'])
                    if pr['n'] != len(i['seq']) or pr['bad'] or i['style'] != st: ok1 = False
                check('Ideen %s %s: Folgen gültig' % (st, 'Moll' if key == '9:m' else 'Dur'), ok1, i['text'])
        await pg.select_option('#jmKey', '9:M'); await pg.select_option('#jmStyle', 'Blues'); await pg.click('#jmRoll')
        i = await pg.evaluate("JamIdeen.idea()")
        check('Blues in A-Dur: Septakkorde A7 D7 E7', set(c['t'] for c in i['seq']) == {'7'} and i['text'].startswith('A7'), i['text'])
        chips = await pg.evaluate("[...document.querySelectorAll('#jmIdeaOut .jm-chip')].map(c=>c.textContent)")
        check('Folge als Chips mit Stufen (I7 …)', len(chips) == len(i['seq']) and chips[0].startswith('A7') and 'I' in chips[0], chips[:3])
        await pg.click('#jmUse'); await pg.wait_for_timeout(900)
        r = await pg.evaluate("({act:Jam.active(),key:Jam.state().key,seq:Jam.state().seq.length,bpm:+document.getElementById('bpm').value,style:document.getElementById('jamStyle').selectedOptions[0]&&document.getElementById('jamStyle').selectedOptions[0].textContent})")
        check('▶ Als Backing Track starten: läuft in A-Dur mit der Folge, Tempo 96', r['act'] and r['key'] == {'pc': 9, 'major': True} and r['seq'] == len(i['seq']) and r['bpm'] == 96, r)
        print('  Beat:', r['style'])
        await pg.evaluate("Jam.stop(); 0")
        # Frage & Antwort
        await pg.evaluate("Jam.state().key={pc:9,major:false}; Jam.setSeq('Am F C G'); document.getElementById('bpm').value=160; document.getElementById('bpm').dispatchEvent(new Event('input')); 0")
        await pg.click('[data-qlen="1"]')
        await pg.evaluate("window.__osc=0; const o=AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator=function(){__osc++;return o.call(this)}; 0")
        hq = await pg.evaluate("document.getElementById('jmQaInd').getBoundingClientRect().height")
        await pg.click('#jmQaGo')
        cls = []; oscs = []
        for k in range(32):
            await pg.wait_for_timeout(200)
            c = await pg.evaluate("document.getElementById('jmQaInd').className"); cls.append(c.split(' ')[-1])
        q = await pg.evaluate("JamIdeen.qa()")
        seq = [x for i2, x in enumerate(cls) if x in ('q', 'a') and (i2 == 0 or cls[i2 - 1] != x)]
        check('Frage & Antwort: Wechsel FRAGE ↔ ANTWORT sichtbar', len(seq) >= 3 and all(seq[k] != seq[k + 1] for k in range(len(seq) - 1)), (seq, q and q['phases']))
        check('Frage klingt (Töne in Frage-Blöcken)', q and q['n'] >= 1 and await pg.evaluate("__osc") > 4, (q and q['n'], await pg.evaluate("__osc")))
        hq2 = await pg.evaluate("document.getElementById('jmQaInd').getBoundingClientRect().height")
        check('Anzeige ohne Sprung (feste Höhe), 4 Schlag-Felder bei 1 Takt', abs(hq - hq2) < 1 and await pg.evaluate("document.querySelectorAll('#jmQaInd .jm-beats i').length") == 4, (hq, hq2))
        await pg.click('[data-qlen="2"]'); await pg.wait_for_timeout(1200)
        check('Länge umstellbar (2 Takte → 8 Felder)', await pg.evaluate("document.querySelectorAll('#jmQaInd .jm-beats i').length") == 8)
        await pg.click('#jmQaGo'); await pg.wait_for_timeout(200)
        check('Stopp: Anzeige aus', await pg.evaluate("!JamIdeen.qa() && document.getElementById('jmQaInd').className==='jm-qaind'"))
        await pg.evaluate("Jam.stop(); 0")
        # Jam aufnehmen
        await pg.evaluate("localStorage.setItem('3nps-bars','free'); 0")
        bars_before = await pg.evaluate("document.getElementById('loopBars').value")
        await pg.select_option('#loopCountIn', '0') if await pg.is_visible('#loopCountIn') else None
        await pg.evaluate("document.getElementById('loopCountIn').value='0'; document.getElementById('loopCountIn').dispatchEvent(new Event('change')); Jam.setSeq('Am F C G'); document.getElementById('bpm').value=120; document.getElementById('bpm').dispatchEvent(new Event('input')); 0")
        await pg.click('#jmRecGo'); await pg.wait_for_timeout(2500)
        r = await pg.evaluate("(()=>{const d=Looper.debug();return {L0:d.tracks[0].L/d.sr,st0:d.tracks[0].state,st1:d.tracks[1].state,jam:Jam.active(),btn:document.getElementById('jmRecGo').textContent,bars:document.getElementById('loopBars').value}})()")
        check('Jam aufnehmen: Backing auf Spur 1 (4 Takte à 2 s = 8 s), Spur 2 nimmt auf', abs(r['L0'] - 8) < 0.05 and r['st0'] == 'playing' and r['st1'] == 'recording' and not r['jam'] and 'beenden' in r['btn'], r)
        await pg.wait_for_timeout(7000)
        await pg.click('#jmRecGo')
        for k in range(150):
            if await pg.evaluate("Looper.debug().tracks[1].state") != 'recording': break
            await pg.wait_for_timeout(100)
        r = await pg.evaluate("(()=>{const d=Looper.debug();return {L1:d.tracks[1].L/d.tracks[0].L,st1:d.tracks[1].state,bars:document.getElementById('loopBars').value,pref:localStorage.getItem('3nps-bars'),st:document.getElementById('jmRecSt').textContent,to:!document.getElementById('jmRecTo').hidden}})()")
        check('Beenden: Spur 2 fertig (ganze Runden), Hinweis + „→ Zum Looper“', r['st1'] == 'playing' and abs(r['L1'] - round(r['L1'])) < 0.01 and r['L1'] >= 1 and 'Spur 2' in r['st'] and r['to'], r)
        check('Loop-Länge unverändert (Auswahl und gespeichert)', r['bars'] == bars_before and r['pref'] == 'free', (bars_before, r['bars'], r['pref']))
        await pg.click('#jmRecTo'); await pg.wait_for_timeout(300)
        check('→ Zum Looper', await pg.evaluate("AppNav.current()") == 'looper')
        await tab(pg, 'jam'); await pg.evaluate("Jam.setSeq('Am:½ F:½ C G'); 0"); await pg.click('#jmRecGo'); await pg.wait_for_timeout(300)
        check('Halbe Takte: verständlicher Hinweis statt Aufnahme', 'ganzen Takten' in await pg.inner_text('#jmRecSt'))
        # Hochkant
        await pg.set_viewport_size({'width': 768, 'height': 1024}); await pg.wait_for_timeout(300)
        check('Hochkant: nichts ragt heraus', await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
        await pg.evaluate("Jam.setSeq('Am F C G'); Jam.start(); 0"); hs = set()
        for k in range(14):
            await pg.wait_for_timeout(300); hs.add(round(await pg.evaluate("document.getElementById('jmFit').getBoundingClientRect().height")))
        await pg.evaluate("Jam.stop(); 0")
        check('Hochkant: Karte behält beim Akkordwechsel ihre Höhe', len(hs) == 1, hs)
        await pg.click('#tab-hilfe'); await pg.wait_for_timeout(900)
        check('„?“ aus Backing Track → Anleitung Backing Track', await pg.evaluate("(document.querySelector('#hlToc a.on')||{dataset:{}}).dataset.id") == 'backing')
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
