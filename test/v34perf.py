import re
# v34: Leistungsanzeige im Kopf (Rechenlast, Arbeitsspeicher, Latenz) + Pedal-Fenster allgemein + Kopf-Knöpfe schließen sich gegenseitig
import asyncio
from playwright.async_api import async_playwright
O = '/tmp/claude-0/-home-claude-3nps/2ba96aef-49c7-541d-8e92-473a90edb2fb/scratchpad/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        errs = []
        for name, w, h in [('ipad', 1180, 820), ('iphone', 390, 844)]:
            pg = await b.new_page(viewport={'width': w, 'height': h}); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
            if name == 'ipad':
                _br = await pg.inner_text('.brand'); _m = re.search(r'v(\d+)', _br)
                check('Version ab v34', bool(_m) and int(_m.group(1)) >= 34, _br)
                check('Leistung zu: misst nicht', await pg.evaluate("document.getElementById('perfPop').hidden"))
                await pg.click('#perfBtn'); await pg.wait_for_timeout(2600)
                v = await pg.evaluate("['pfCpu','pfFps','pfMemCur','pfMemHist','pfHeap','pfLatBase','pfLatIn','pfAud'].map(i=>document.getElementById(i).textContent)")
                check('Werte ohne Eingang', v[0].endswith('%') and 'Bilder/s' in v[1] and v[2].endswith('MB') and '/ 160 MB' in v[3] and v[6] == 'Eingang zu', v)
                h0 = await pg.evaluate("document.getElementById('perfPop').getBoundingClientRect().height")
                # Eingang öffnen → Eingangswerte
                await pg.click('#perfBtn'); await pg.click('#tab-looper'); await pg.click('#loopMonitor'); await pg.wait_for_timeout(1500)
                await pg.click('#perfBtn'); await pg.wait_for_timeout(2600)
                v = await pg.evaluate("['pfAud','pfGaps','pfLatIn','pfLatSum','pfLatComp'].map(i=>document.getElementById(i).textContent)")
                check('Werte mit Eingang', v[0] != 'Eingang zu' and v[1].isdigit() and v[2] != 'Eingang zu' and v[3] != '–' and v[4].endswith('ms'), v)
                h1 = await pg.evaluate("document.getElementById('perfPop').getBoundingClientRect().height")
                check('Fenster springt nicht', abs(h0 - h1) < 1, (h0, h1))
                await pg.screenshot(path=O + 'v34_perf_ipad.png')
                # gegenseitig schließen
                await pg.click('#optikBtn'); await pg.wait_for_timeout(100)
                st = await pg.evaluate("[document.getElementById('perfPop').hidden, document.getElementById('optikPop').hidden]")
                check('Optik schließt Leistung', st == [True, False], st)
                await pg.click('#perfBtn'); await pg.wait_for_timeout(100)
                st = await pg.evaluate("[document.getElementById('perfPop').hidden, document.getElementById('optikPop').hidden]")
                check('Leistung schließt Optik', st == [False, True], st)
                await pg.mouse.click(w - 20, h - 20); await pg.wait_for_timeout(100)
                check('Klick daneben schließt', await pg.evaluate("document.getElementById('perfPop').hidden"))
                # Pedal arbeitet weiter, auch mit offenem Fenster
                await pg.click('#perfBtn'); await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(300)
                last = await pg.inner_text('#pedalLast')
                check('Pedal bei offener Anzeige', 'Spur 1' in last, last)
                # Pedal-Fenster allgemein + Bluetooth-Hinweis
                t = await pg.evaluate("[...document.querySelectorAll('#pedalPreset option')].map(o=>o.value+':'+o.textContent).join('|') + ' ## ' + document.querySelector('.pedal-bt').textContent")
                check('Pedal-Texte allgemein', 'Automatisch (Pfeiltasten' in t and 'Bluetooth' in t and 'AirTurn' in t and 'auto:' in t and 'custom:' in t, t[:120])
            else:
                await pg.click('#perfBtn'); await pg.wait_for_timeout(1200)
                r = await pg.evaluate("(()=>{const r=document.getElementById('perfPop').getBoundingClientRect();return [r.left, r.right, innerWidth]})()")
                check('iPhone: Fenster passt in die Breite', r[0] >= 0 and r[1] <= r[2], r)
                await pg.screenshot(path=O + 'v34_perf_iphone.png')
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
