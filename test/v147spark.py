# v147: Rig › Sounds mit Ziel „Spark LIVE“ wie in der Spark-App: 7 feste Plätze GATE · COMP/WAH · DRIVE · AMP · MOD/EQ · DELAY · REVERB,
# Amp-Regler GAIN · BASS · MIDDLE · TREBLE · VOLUME + OFF, nur Modellnamen aus Toms Screenshot, Prompt/Stichpunkte mit denselben Namen,
# BIAS X/Reactor unverändert, nichts springt, EN, keine Skriptfehler.  Aufruf: python3 test/v147spark.py  (SHOT=<Ordner> → v147_spark.png)
import asyncio, os, re, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html'); SHOT = os.environ.get('SHOT', '')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info)[:300] if info else ''))
IGN = ('AudioContext was not allowed', 'GPU stall', 'GL Driver Message', 'WebGL')
MODELS = {'Noise Gate', 'LA Comp', 'Booster', 'AD Clean', 'Guitar EQ', 'Digital Delay', 'Ambient'}
SLOTS = "[...document.querySelectorAll('#rg-chain .rg-spi')].map(e=>({l:e.querySelector('.rg-spl').textContent,m:e.querySelector('.rg-spm').textContent,off:e.classList.contains('rg-off'),b:e.dataset.b??null,k:[...e.querySelectorAll('.rg-kn')].map(k=>k.textContent)}))"
async def until(pg, js, t=10000):
    for _ in range(int(t / 100)):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(100)
    raise TimeoutError(js)
async def setrange(pg, sel, v):
    await pg.evaluate("([s,v])=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))}", [sel, v])

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ('de', 'en'):
            ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, device_scale_factor=2 if lang == 'de' else 1)
            await ctx.add_init_script("if(!sessionStorage.getItem('x')){localStorage.clear();sessionStorage.setItem('x','1')}")
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and not any(x in m.text for x in IGN) else None)
            await pg.goto(U + ('?lang=en' if lang == 'en' else '')); await pg.wait_for_timeout(900)
            await open_tab(pg, 'rig'); await until(pg, '!!window.Rig'); await pg.wait_for_timeout(300)
            if lang == 'en':
                await pg.click('#rg-tSeg [data-t=spark]'); await pg.wait_for_timeout(200)
                pr = await pg.inner_text('#rg-prompt')
                check('EN: Spark-Stichpunkte englisch', 'Spark app settings:' in pr and 'pick the closest model in the Spark app' in pr, pr[-400:])
                check('EN: keine Skriptfehler', not errs, errs[:3]); await ctx.close(); continue
            check('ab v147', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 147)
            bias_pr = await pg.inner_text('#rg-prompt')
            top0 = await pg.evaluate("Math.round(document.getElementById('rg-prompt').getBoundingClientRect().top+scrollY)")
            await pg.click('#rg-tSeg [data-t=spark]'); await pg.wait_for_timeout(200)
            s = await pg.evaluate(SLOTS)
            check('Spark: 7 feste Plätze in App-Reihenfolge', [x['l'] for x in s] == ['GATE', 'COMP/WAH', 'DRIVE', 'AMP', 'MOD/EQ', 'DELAY', 'REVERB'], [x['l'] for x in s])
            check('Clean Funk: GATE/DRIVE leer + ausgegraut, MOD/DELAY aus, COMP/AMP/REVERB an', [x['off'] for x in s] == [True, False, True, False, True, True, False] and s[0]['b'] is None and s[2]['b'] is None, [(x['l'], x['off'], x['b']) for x in s])
            check('Clean Funk: LA Comp, AD Clean (Clean-Amp), Room Reverb ohne erfundenen Namen', s[1]['m'] == 'LA Comp' and s[3]['m'] == 'AD Clean' and s[6]['m'] == 'Room Reverb', [x['m'] for x in s])
            check('AMP-Regler GAIN · BASS · MIDDLE · TREBLE · VOLUME mit Vorlagenwerten (Master→VOLUME)', s[3]['k'] == ['3GAIN', '4BASS', '6MIDDLE', '7TREBLE', '6VOLUME'], s[3]['k'])
            geo = await pg.evaluate("(()=>{const r=e=>e.getBoundingClientRect();const a=r(document.querySelector('.rg-spamp .rg-sped')),g=r(document.querySelector('.rg-spi .rg-sped'));const line=getComputedStyle(document.querySelector('.rg-sp'),'::before');return {aw:a.width,gw:g.width,line:line.backgroundColor}})()")
            check('Amp in der Mitte breiter, rote Linie', geo['aw'] > 2 * geo['gw'] and geo['line'] == 'rgb(229, 38, 47)', geo)
            ed = await pg.evaluate("[...document.querySelectorAll('#rg-ed .rg-sl > span > span')].map(e=>e.textContent)")
            check('Bearbeiten: Amp-Regler mit Spark-Namen, kein Presence/Master', ed == ['GAIN', 'BASS', 'MIDDLE', 'TREBLE', 'VOLUME'] and await pg.inner_text('#rg-edOn') == 'ON', ed)
            pr = await pg.inner_text('#rg-prompt')
            check('Prompt: Spark-Kette mit Plätzen, Modellvorschlag und Spark-Reglern', 'Spark LIVE chain (GATE · COMP/WAH · DRIVE · AMP · MOD/EQ · DELAY · REVERB):' in pr and '- GATE: OFF' in pr and 'AMP: Clean American (Twin-Style) → Spark: AD Clean (GAIN 3/10, BASS 4/10, MIDDLE 6/10, TREBLE 7/10, VOLUME 6/10)' in pr and 'Presence' not in pr and 'Master' not in pr and 'Open Back' not in pr, pr[:700])
            check('Stichpunkte: Spark-App einstellen', 'Spark-App einstellen:\n• GATE: OFF\n• COMP/WAH: LA Comp\n• DRIVE: OFF\n• AMP: AD Clean · GAIN 3 · BASS 4 · MIDDLE 6 · TREBLE 7 · VOLUME 6\n• MOD/EQ: OFF\n• DELAY: OFF\n• REVERB: ähnlichstes Modell in der Spark-App wählen' in pr, pr[-600:])
            await setrange(pg, '#rg-ed input[data-k=Master]', '8')
            pr = await pg.inner_text('#rg-prompt'); s = await pg.evaluate(SLOTS)
            check('VOLUME 8 → Amp-Platz, Prompt (VOLUME 8/10) und Stichpunkte', 'VOLUME 8/10' in pr and 'VOLUME 8\n' in pr and s[3]['k'][4] == '8VOLUME', s[3]['k'])
            await pg.click('#rg-edOn'); await pg.wait_for_timeout(80)
            o = await pg.evaluate("({sw:document.querySelector('.rg-spamp .rg-spoff').classList.contains('on'),off:document.querySelector('.rg-spamp').classList.contains('rg-off'),t:document.getElementById('rg-edOn').textContent})")
            pr = await pg.inner_text('#rg-prompt')
            check('Amp OFF-Schalter: an, Platz ausgegraut, Prompt „AMP: OFF“', o['sw'] and o['off'] and o['t'] == 'OFF' and '- AMP: OFF' in pr and '• AMP: OFF' in pr, o)
            await pg.click('#rg-edOn')
            await pg.click('#rg-chain .rg-spi[data-b="5"]'); await pg.wait_for_timeout(80)   # Hall (Index 5) antippen
            check('Platz antippen wählt den Block (REVERB)', (await pg.inner_text('#rg-edName')).startswith('REVERB: Room Reverb'), await pg.inner_text('#rg-edName'))
            tops = []
            for pre in ['blues', 'rock', 'metal', 'amb', 'lead', 'funk']:
                await pg.click('[data-p=%s]' % pre); await pg.wait_for_timeout(80)
                s = await pg.evaluate(SLOTS)
                bad = [x['m'] for x in s if x['m'] not in MODELS and x['m'] != '–' and x['m'] not in (await pg.evaluate("Rig.state().chain"))]
                check('%s: nur Screenshot-Modelle oder Vorlagenname' % pre, not bad, [x['m'] for x in s])
                if pre == 'metal': check('Modern High-Gain: Noise Gate, Booster (Tight Boost), Hi-Gain-Amp ohne Namen', s[0]['m'] == 'Noise Gate' and s[2]['m'] == 'Booster' and s[3]['m'] != 'AD Clean' and 'AMP: ähnlichstes Modell in der Spark-App wählen' in await pg.inner_text('#rg-prompt'), [x['m'] for x in s])
                if pre == 'amb': check('Ambient Clean: REVERB → Ambient, Stereo bleibt', s[6]['m'] == 'Ambient' and 'STEREO: run' in await pg.inner_text('#rg-prompt'), [x['m'] for x in s])
                tops.append(await pg.evaluate("Math.round(document.getElementById('rg-prompt').getBoundingClientRect().top+scrollY)"))
            check('Sounds wechseln (Spark): Prompt-Karte springt nicht, gleiche Lage wie bei BIAS X', len(set(tops)) == 1 and tops[0] == top0, (top0, tops))
            hs = []
            await pg.click('[data-p=funk]')
            for t in ['spark', 'bias', 'reactor', 'spark']:
                await pg.click('#rg-tSeg [data-t=%s]' % t); await pg.wait_for_timeout(100)
                hs.append(await pg.evaluate("[document.getElementById('rg-chain'),document.getElementById('rg-prompt')].map(e=>Math.round(e.getBoundingClientRect().height)).join()"))
            check('Zielwechsel: Kette und Prompt-Feld gleich hoch', len(set(hs)) == 1, hs)
            await pg.click('#rg-tSeg [data-t=bias]'); await pg.wait_for_timeout(100)
            n = await pg.evaluate("document.querySelectorAll('#rg-chain .rg-blk').length")
            check('BIAS X unverändert (6 Blöcke, Presence/Master, gleicher Prompt)', n == 6 and await pg.inner_text('#rg-prompt') == bias_pr, n)
            await pg.click('[data-p=funk]')
            # ---------- Reactor 50 (Ergänzung v147): Kacheln Gate · Comp · Drive · Mod · Wah · EQ · Amp · Delay · Reverb ----------
            RX = "[...document.querySelectorAll('#rg-chain .rg-rxi')].map(e=>({t:e.querySelector('.rg-rxt').textContent.replace('STEREO','').trim(),m:e.querySelector('.rg-rxm').textContent,off:e.classList.contains('rg-off'),b:e.dataset.b??null,k:[...e.querySelectorAll('.rg-kn')].map(k=>k.textContent)}))"
            RXM = MODELS_RX = {'Noise Gate', 'Opto Comp', 'grünes Drive-Modell', 'Analog Chorus', 'Wah', 'EQ7', '80s Crunch', 'Analog Delay', 'Studio-Reverb-Modell'}
            await pg.click('[data-p=funk]'); await pg.click('#rg-tSeg [data-t=reactor]'); await pg.wait_for_timeout(150)
            r = await pg.evaluate(RX)
            check('Reactor: 9 Kacheln in App-Reihenfolge', [x['t'] for x in r] == ['Gate', 'Comp', 'Drive', 'Mod', 'Wah', 'EQ', 'Amp', 'Delay', 'Reverb'] and await pg.evaluate("document.querySelectorAll('#rg-chain .rg-rxl').length") == 8, [x['t'] for x in r])
            check('Reactor: Wah/EQ standardmäßig aus (Wah, EQ7), Gate/Drive leer', r[4]['m'] == 'Wah' and r[5]['m'] == 'EQ7' and r[4]['off'] and r[5]['off'] and r[4]['b'] is None and r[0]['b'] is None and r[2]['b'] is None, r[:6])
            check('Reactor Amp: GAIN · BASS · MIDDLE · TREBLE · MASTER (Vorlagenwerte, kein Presence)', r[6]['k'] == ['3GAIN', '4BASS', '6MIDDLE', '7TREBLE', '6MASTER'], r[6]['k'])
            check('Reactor Mod als Chorus: E.LEVEL · RATE · DEPTH · TONE (Mix→E.LEVEL), Analog Chorus', r[3]['k'] == ['3E.LEVEL', '3RATE', '3DEPTH', '5TONE'] and r[3]['m'] == 'Analog Chorus', r[3])
            check('Reactor: Opto Comp, Studio-Reverb-Modell (abgeschnittener Name umschrieben)', r[1]['m'] == 'Opto Comp' and r[8]['m'] == 'Studio-Reverb-Modell', [x['m'] for x in r])
            check('Reactor-Hinweis: Regler in App und am Verstärker, 0–10 = Reglerweg', 'Regler gibt es in der Reactor-App und am Verstärker; Werte 0–10 entsprechen dem Reglerweg.' in await pg.inner_text('#rg-gNote'))
            await pg.click('#rg-chain .rg-rxamp'); await pg.wait_for_timeout(80)
            ed = await pg.evaluate("[...document.querySelectorAll('#rg-ed .rg-sl > span > span')].map(e=>e.textContent)")
            await setrange(pg, '#rg-ed input[data-k=Master]', '9'); pr = await pg.inner_text('#rg-prompt')
            check('Reactor Bearbeiten/Prompt: MASTER 9, Spark-Namen nicht', ed == ['GAIN', 'BASS', 'MIDDLE', 'TREBLE', 'MASTER'] and 'MASTER 9/10' in pr and '• Amp: ähnlichstes Modell in der Reactor-App wählen · GAIN 3 · BASS 4 · MIDDLE 6 · TREBLE 7 · MASTER 9' in pr and 'VOLUME' not in pr and 'Presence' not in pr, (ed, pr[-500:]))
            await pg.click('#rg-chain .rg-rxi[data-b="3"]'); await pg.wait_for_timeout(80)
            ed = await pg.evaluate("[...document.querySelectorAll('#rg-ed .rg-sl > span > span')].map(e=>e.textContent)")
            await pg.click('#rg-edOn'); await setrange(pg, '#rg-ed input[data-k=Mix]', '7'); pr = await pg.inner_text('#rg-prompt')
            check('Reactor Mod bearbeiten: E.LEVEL 7 → Prompt', ed == ['E.LEVEL', 'RATE', 'DEPTH', 'TONE'] and 'E.LEVEL 7/10' in pr, ed)
            for pre in ['blues', 'rock', 'metal', 'amb', 'lead']:
                await pg.click('[data-p=%s]' % pre); await pg.wait_for_timeout(80)
                r = await pg.evaluate(RX); ch = await pg.evaluate("Rig.state().chain")
                bad = [x['m'] for x in r if x['m'] not in RXM and x['m'] != '–' and x['m'] not in ch]
                check('Reactor %s: nur Screenshot-Modelle oder Vorlagenname' % pre, not bad, [x['m'] for x in r])
                if pre == 'lead': check('Singing Lead: grünes Drive-Modell, 80s Crunch', r[2]['m'] == 'grünes Drive-Modell' and r[6]['m'] == '80s Crunch', [x['m'] for x in r])
                if pre == 'rock': check('Classic Rock: Analog Delay', r[7]['m'] == 'Analog Delay', [x['m'] for x in r])
            pr = await pg.inner_text('#rg-prompt')
            check('Reactor-Prompt englisch (green drive model, kein deutsches Modellwort)', '→ Reactor: green drive model' in pr and 'grünes' not in pr.split('Reactor-App einstellen:')[0], pr[:600])
            if SHOT:
                await pg.click('[data-p=lead]'); await pg.wait_for_timeout(100)
                await pg.evaluate("scrollTo(0, document.getElementById('rg-tSeg').getBoundingClientRect().top + scrollY - 150)"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=SHOT + '/v147_reactor.png')
            await pg.click('#rg-tSeg [data-t=spark]'); await pg.wait_for_timeout(200)
            if SHOT:
                await pg.evaluate("scrollTo(0, document.getElementById('rg-tSeg').getBoundingClientRect().top + scrollY - 150)"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=SHOT + '/v147_spark.png')
            check('keine Skriptfehler', not errs, errs[:3])
            await ctx.close()
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
