# v99: neuer EQ (Art Channel EQ) – Übernahme alter Werte, Low Cut mit Steilheit, Güte, Ausgang, Analyzer, Speicherung alt+neu
import asyncio, json
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(600)
        await pg.evaluate("localStorage.setItem('3nps-eq-drums', JSON.stringify([3,0,0,0,0,0,-2])); localStorage.removeItem('3nps-eq2-drums')")
        await pg.reload(); await pg.wait_for_timeout(900)
        e = await pg.evaluate("Rhythm.getEq()")
        check('alte 7-Band-Werte werden übernommen', e['b'][1]['g'] == 3 and e['b'][7]['g'] == -2 and e['b'][1]['f'] == 63, [x['g'] for x in e['b']])
        await pg.click('#drumEqBtn'); await pg.wait_for_timeout(200)
        check('9 Band-Schalter und Grafik sichtbar', await pg.locator('#drumEqPanel .eq2-bt').count() == 9 and await pg.is_visible('#drumEqPanel .eq2-graph canvas'))
        await pg.click('#drumEqPanel .eq2-bt[data-i="0"]'); await pg.click('#drumEqPanel .eq2-slope [data-s="24"]')
        e = await pg.evaluate("Rhythm.getEq()"); r = await pg.evaluate("Array.from(EQ7.responseDb(Rhythm.getEq(), new Float32Array([20, 40, 1000]), 48000))")
        check('Low Cut an, 24 dB/Okt: 20 Hz stark gedämpft, 1 kHz unberührt', e['b'][0]['on'] and e['sl'] == 24 and r[0] < -20 and abs(r[2]) < 0.5, [round(x, 1) for x in r])
        await pg.click('#drumEqPanel .eq2-bt[data-i="4"]')
        await pg.evaluate("(()=>{const q=document.querySelector('#drumEqPanel .eq2-q');q.value=900;q.dispatchEvent(new Event('input'))})()")
        await pg.evaluate("(()=>{const g=document.querySelector('#drumEqPanel .eq2-g');g.value=6;g.dispatchEvent(new Event('input'))})()")
        e = await pg.evaluate("Rhythm.getEq()"); check('Glocke 3: +6 dB mit hoher Güte', e['b'][4]['g'] == 6 and e['b'][4]['q'] > 5, e['b'][4])
        await pg.evaluate("(()=>{const o=document.querySelector('#drumEqPanel .eq2-o');o.value=-3;o.dispatchEvent(new Event('input'))})()")
        r = await pg.evaluate("Array.from(EQ7.responseDb(Rhythm.getEq(), new Float32Array([1000, 300]), 48000))")
        check('Ausgang −3 dB wirkt auf die ganze Kurve', abs(r[1] + 3) < 0.6 and abs(r[0] - 3) < 0.6, [round(x, 1) for x in r])
        await pg.click('#loopDrums'); await pg.click('#drumEqPanel .eq2-an'); await pg.wait_for_timeout(1200)
        check('Analyzer läuft (Knopf aktiv, keine Fehler)', 'active' in await pg.get_attribute('#drumEqPanel .eq2-an', 'class') and not errs)
        await pg.click('#loopDrums')
        leg = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-eq-drums'))"); neu = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-eq2-drums'))")
        check('gespeichert alt (7 Werte) und neu (alle Bänder)', isinstance(leg, list) and len(leg) == 7 and neu['v'] == 2 and neu['sl'] == 24, leg)
        await pg.reload(); await pg.wait_for_timeout(900); e2 = await pg.evaluate("Rhythm.getEq()")
        check('bleibt nach Neustart (Low Cut, Güte, Ausgang)', e2['b'][0]['on'] and e2['out'] == -3 and e2['b'][4]['q'] > 5)
        await pg.click('#drumEqBtn'); await pg.click('#drumEqPanel .eq-flat'); check('Zurücksetzen = flach', await pg.evaluate("EQ7.isFlat(Rhythm.getEq())"))
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
