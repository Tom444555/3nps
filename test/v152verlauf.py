# v152: Übe-Verlauf als Diagramm (Technik › Übungslog, Karte „Übe-Verlauf“). Liest nur AppDB „sessions“ (ts, durationSec, bpm).
# Geprüft: zu = nicht gebaut (keine Elemente, kein Lesen); Leerzustand mit Hinweis; mit vorbelegten Einheiten: Summe, ▲/▼ zum
# Vorzeitraum, Hoch/Tief, Zeitraum-Knöpfe (1W · 1M · 3M · 1J · Alles, ab 3M je Woche), Tempo = höchstes BPM je Tag, SVG-Linie;
# neue Einheit bei offener Karte zieht mit; Knöpfe ≥ 44 px; Optiken/Minimal lesbar; Looper unberührt; EN; 3 Größen; keine Skriptfehler.
import asyncio, os, re, json, time
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
# Testdaten relativ zu „heute“ (lokale Mitternacht + 10 Uhr): Tag k vor heute → (Minuten, BPM)
DAYS = {0: (20, 120), 1: (10, 118), 3: (30, 115), 6: (5, 110), 8: (15, 108), 10: (25, 104), 13: (40, 100), 40: (12, 96), 100: (8, 90)}
SEED = """(async(days)=>{const all=await AppDB.all('sessions');for(const s of all)await AppDB.del('sessions',s.id);
const d0=new Date();d0.setHours(10,0,0,0);for(const [k,[m,b]] of Object.entries(days)){const d=new Date(d0);d.setDate(d.getDate()-(+k));
await AppDB.put('sessions',{id:'t'+k+'a',ts:d.getTime(),dateStr:'',root:'G',mode:'ionian',position:1,pattern:'3nps',bpm:b-6,durationSec:Math.round(m*60/2)});
await AppDB.put('sessions',{id:'t'+k+'b',ts:d.getTime()+600000,dateStr:'',root:'G',mode:'ionian',position:1,pattern:'3nps',bpm:b,durationSec:m*60-Math.round(m*60/2)});}
await refreshLog();return (await AppDB.all('sessions')).length})"""
CLEAR = "(async()=>{const all=await AppDB.all('sessions');for(const s of all)await AppDB.del('sessions',s.id);await refreshLog();return 0})()"
ST = "({big:document.getElementById('pvBig').textContent,chg:document.getElementById('pvChg').textContent,cls:document.getElementById('pvChg').className,hi:document.getElementById('pvHi').textContent,lo:document.getElementById('pvLo').textContent,sub:document.getElementById('pvSub').textContent,svg:!!document.querySelector('#pvChart svg .pv-line'),empty:(document.querySelector('.pv-empty')||{}).textContent||'',ax:document.getElementById('pvAx').textContent,n:document.getElementById('pvN').textContent})"
async def pick(pg, sel):
    await pg.click(sel); await pg.wait_for_timeout(150); return await pg.evaluate(ST)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h})
            await ctx.add_init_script("window.__idb=0;const _g=IDBObjectStore.prototype.getAll;IDBObjectStore.prototype.getAll=function(){if(window.__pvWatch)window.__idb++;return _g.apply(this,arguments)}")
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1500)
            if w == 1366: check('ab v152', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 152)
            await pg.evaluate(CLEAR)
            await open_tab(pg, 'griffbrett'); await pg.wait_for_timeout(500)
            st = await pg.evaluate("({card:!!document.getElementById('pvFold'),open:document.getElementById('pvFold').open,built:UebeVerlauf.built(),kids:document.getElementById('pvBody').children.length,h:Math.round(document.querySelector('#pvFold>summary').getBoundingClientRect().height)})")
            check(f'{w}: Karte „Übe-Verlauf“ im Übungslog, zu und nicht gebaut', st['card'] and not st['open'] and not st['built'] and st['kids'] == 0, st)
            check(f'{w}: Kopf der Karte ≥ 44 px', st['h'] >= 44, st['h'])
            await pg.evaluate("window.__pvWatch=1;window.__idb=0"); await pg.wait_for_timeout(1000)
            check(f'{w}: zu → liest nichts', await pg.evaluate("window.__idb") == 0)
            await pg.click('#pvFold>summary'); await pg.wait_for_timeout(600)
            check(f'{w}: Öffnen liest die Einheiten einmal', await pg.evaluate("window.__idb") == 1, await pg.evaluate("window.__idb"))
            e = await pg.evaluate(ST)
            check(f'{w}: Leerzustand mit Hinweis „wächst ab jetzt“', e['big'] == '–' and 'ab jetzt' in e['empty'] and not e['svg'], e)
            if w == 1366: await pg.screenshot(path='/tmp/shots/v152_1366_leer.png') if os.environ.get('SHOT') else None
            n = await pg.evaluate(SEED + "(" + json.dumps({str(k): v for k, v in DAYS.items()}) + ")")
            check(f'{w}: Testdaten eingetragen, offene Karte zieht mit', n == 18 and (await pg.evaluate(ST))['svg'], n)
            await pg.click('#pvBody [data-pm=zeit]')
            r = await pick(pg, '#pvBody [data-pr="1W"]')
            # 1W: Tage 0..6 → 20+10+30+5 = 65 min; Vorzeitraum Tage 7..13 → 15+25+40 = 80 → ▼ 15 min (−19 %)
            check(f'{w}: 1W Übezeit = 65 min, ▼ 15 min (−19 %) zum Vorzeitraum', r['big'] == '65 min' and r['chg'].startswith('▼ 15 min') and '19 %' in r['chg'] and 'down' in r['cls'], r)
            check(f'{w}: 1W Hoch 30 min (vor 3 Tagen), Tief 0 min, je Tag', r['hi'].startswith('30 min') and r['lo'].startswith('0 min') and 'je Tag' in r['sub'] and r['svg'], r)
            r = await pick(pg, '#pvBody [data-pr="1M"]')
            check(f'{w}: 1M = 145 min (2,4 h), ▲ neu (Vorzeitraum leer bis auf Tag 40 → ▲)', r['big'] == '2,4 h' and r['chg'].startswith('▲') and 'up' in r['cls'], r)
            r = await pick(pg, '#pvBody [data-pr="3M"]')
            check(f'{w}: 3M je Woche, 157 min', 'je Woche' in r['sub'] and r['big'] == '2,6 h' and 'Woche ab' in r['hi'], r)
            r = await pick(pg, '#pvBody [data-pr="all"]')
            check(f'{w}: Alles = 165 min, kein Vorzeitraum', r['big'] == '2,8 h' and r['chg'] == '', r)
            r = await pick(pg, '#pvBody [data-pr="1J"]')
            check(f'{w}: 1J = 165 min, 18 Einheiten', r['big'] == '2,8 h' and r['n'].startswith('18'), r)
            r = await pick(pg, '#pvBody [data-pm=tempo]'); r = await pick(pg, '#pvBody [data-pr="1M"]')
            check(f'{w}: Tempo 1M: zuletzt 120 BPM, ▲ 20 BPM seit Tag 13, Hoch 120 / Tief 100', r['big'] == '120 BPM' and r['chg'].startswith('▲ 20 BPM') and r['hi'].startswith('120 BPM') and r['lo'].startswith('100 BPM'), r)
            r = await pick(pg, '#pvBody [data-pr="1W"]')
            check(f'{w}: Tempo 1W: ▲ 10 BPM (110 → 120)', r['chg'].startswith('▲ 10 BPM'), r)
            sz = await pg.evaluate("[...document.querySelectorAll('#pvBody button')].map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})")
            check(f'{w}: alle Knöpfe ≥ 44 px', all(x >= 44 and y >= 44 for x, y in sz), sz)
            check(f'{w}: nichts ragt seitlich heraus', await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"))
            await pg.click('#pvBody [data-pm=zeit]'); await pg.click('#pvBody [data-pr="1M"]')
            if w == 1366:
                # neue Einheit über den normalen Weg (saveSession) → Karte zieht mit
                await pg.evaluate("saveSession(300)"); await pg.wait_for_timeout(500)
                check('neue Einheit (5 min) erscheint sofort', (await pg.evaluate(ST))['big'] == '2,5 h', await pg.evaluate(ST))
                check('Zustand gemerkt (3nps-verlauf)', json.loads(await pg.evaluate("localStorage.getItem('3nps-verlauf')")) == {'r': '1M', 'm': 'zeit'})
                check('Looper unberührt (keine Spur, Drums aus)', await pg.evaluate("!Rhythm.on()&&!Looper.busy()"))
            check(f'{w}: keine Skriptfehler', not errs, errs[:3])
            await ctx.close()
        # Optiken und Minimal: Werte lesbar (Kontrast Zahl/Hintergrund), Linie sichtbar
        for th, dev in [('precise-dark', 'new'), ('ios', 'new'), ('nordic', 'min')]:
            ctx = await b.new_context(viewport={'width': 1366, 'height': 1024})
            await ctx.add_init_script("localStorage.setItem('3nps-theme','%s');localStorage.setItem('3nps-theme2','%s');localStorage.setItem('3nps-device','%s')" % ('nordic' if th == 'nordic' else th, th, dev))
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1200); await pg.evaluate(SEED + "(" + json.dumps({str(k): v for k, v in DAYS.items()}) + ")")
            await open_tab(pg, 'griffbrett'); await pg.click('#pvFold>summary'); await pg.wait_for_timeout(500)
            v = await pg.evaluate("(()=>{const s=getComputedStyle(document.getElementById('pvBig')),l=document.querySelector('#pvChart .pv-line');return {c:s.color,sz:s.fontSize,line:l?getComputedStyle(l).stroke:null,big:document.getElementById('pvBig').textContent}})()")
            check(f'{th}/{dev}: großer Wert und Linie sichtbar', v['big'] != '–' and v['line'] not in (None, 'none') and float(v['sz'][:-2]) >= 28, v)
            check(f'{th}/{dev}: keine Skriptfehler', not errs, errs[:3])
            if os.environ.get('SHOT'): await pg.locator('#pvCard').screenshot(path=f'/tmp/shots/v152_1366_{th}_{dev}.png')
            await ctx.close()
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page()
        await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500); await open_tab(pg, 'griffbrett'); await pg.click('#pvFold>summary'); await pg.wait_for_timeout(500)
        t = await pg.evaluate("[document.querySelector('#pvFold summary h2').textContent,document.querySelector('#pvBody [data-pm=zeit]').textContent,document.querySelector('#pvBody [data-pr=all]').textContent]")
        check('EN: Karte übersetzt', t == ['Practice history', 'Practice time', 'All'], t)
        await pg.evaluate(CLEAR); await ctx.close(); await b.close()
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
