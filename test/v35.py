# v35: Leistungsfenster anheften/verschieben/kompakt (bleibt offen, Position gespeichert) + Optiken Hell, Präzision, DJ-Pult
import asyncio, re
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
STATE = "(()=>{const p=document.getElementById('perfPop'),r=p.getBoundingClientRect();return {hidden:p.hidden,pinned:p.classList.contains('pinned'),compact:p.classList.contains('compact'),inBody:p.parentNode===document.body,x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); errs = []
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(700)
        br = await pg.inner_text('.brand'); m = re.search(r'v(\d+)', br)
        check('Version ab v35', bool(m) and int(m.group(1)) >= 35, br)
        await pg.click('#perfBtn'); await pg.wait_for_timeout(200)
        await pg.click('#pfPin'); await pg.wait_for_timeout(150)
        s = await pg.evaluate(STATE)
        check('Angeheftet: eigene Ebene, offen', s['pinned'] and s['inBody'] and not s['hidden'], s)
        # bleibt offen bei Tipp daneben, Esc, anderem Kopf-Knopf
        await pg.mouse.click(1100, 700); await pg.keyboard.press('Escape'); await pg.click('#optikBtn'); await pg.wait_for_timeout(150)
        s = await pg.evaluate(STATE)
        check('Bleibt offen (daneben, Esc, Optik-Knopf)', not s['hidden'], s)
        await pg.mouse.click(1100, 700)
        # ziehen an der Titelzeile
        h = await pg.evaluate("(()=>{const r=document.getElementById('pfHead').getBoundingClientRect();return [r.left+40,r.top+r.height/2]})()")
        await pg.mouse.move(h[0], h[1]); await pg.mouse.down(); await pg.mouse.move(h[0] + 300, h[1] + 250, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(150)
        s2 = await pg.evaluate(STATE)
        check('Verschieben', abs((s2['x'] - s['x']) - 300) <= 2 and abs((s2['y'] - s['y']) - 250) <= 2, (s['x'], s['y'], s2['x'], s2['y']))
        # nicht aus dem Bild schieben
        await pg.mouse.move(s2['x'] + 40, s2['y'] + 12); await pg.mouse.down(); await pg.mouse.move(5000, 5000, steps=4); await pg.mouse.up(); await pg.wait_for_timeout(100)
        s3 = await pg.evaluate(STATE)
        check('Bleibt im Bild', s3['x'] + s3['w'] <= 1180 and s3['y'] <= 820 - 40 and s3['x'] >= 0, s3)
        await pg.mouse.move(s3['x'] + 40, s3['y'] + 12); await pg.mouse.down(); await pg.mouse.move(400, 300, steps=4); await pg.mouse.up()
        # misst weiter, Werte laufen
        await pg.wait_for_timeout(2300)
        v = await pg.evaluate("[document.getElementById('pfCpu').textContent, document.getElementById('pfFps').textContent]")
        check('Misst angeheftet', v[0].endswith('%') and 'Bilder/s' in v[1], v)
        # Kompakt
        hh = s3['h']; await pg.click('#pfCompact'); await pg.wait_for_timeout(150)
        s4 = await pg.evaluate(STATE)
        vis = await pg.evaluate("[...document.querySelectorAll('#perfPop .pf-row')].filter(e=>e.offsetParent).map(e=>e.firstElementChild.textContent)")
        check('Kompakt: nur Kernwerte', s4['compact'] and s4['h'] < hh and vis == ['Bedienung', 'Audio', 'Aussetzer', 'Spuren', 'Eingang → Ohr'], vis)
        # Pedal und Bedienung gehen weiter
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(250)
        check('Pedal mit angeheftetem Fenster', 'Spur 1' in await pg.inner_text('#pedalLast'))
        await pg.click('#tab-jam'); await pg.wait_for_timeout(200)
        check('Reiterwechsel, Fenster bleibt', await pg.evaluate("document.getElementById('panel-jam').hidden===false && !document.getElementById('perfPop').hidden"))
        # Neustart: offen, gleiche Stelle, kompakt
        before = await pg.evaluate(STATE)
        await pg.reload(); await pg.wait_for_timeout(900)
        after = await pg.evaluate(STATE)
        check('Nach Neustart offen an gleicher Stelle', not after['hidden'] and after['pinned'] and after['compact'] and abs(after['x'] - before['x']) <= 1 and abs(after['y'] - before['y']) <= 1, (before, after))
        # Fenster verkleinern → rückt ins Bild
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(300)
        s5 = await pg.evaluate(STATE)
        check('Schmaler Bildschirm: im Bild', s5['x'] >= 0 and s5['x'] + s5['w'] <= 390, s5)
        await pg.set_viewport_size({'width': 1180, 'height': 820})
        # Schließen: löst auch das Anheften
        await pg.click('#pfClose'); await pg.wait_for_timeout(150)
        s6 = await pg.evaluate(STATE)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-perf'))")
        check('Schließen löst Anheften', s6['hidden'] and not s6['pinned'] and not s6['inBody'] and st['pin'] is False, (s6, st))
        await pg.reload(); await pg.wait_for_timeout(600)
        check('Nach Schließen bleibt es zu', await pg.evaluate("document.getElementById('perfPop').hidden"))
        # Ziehen ohne vorher Anheften heftet automatisch an
        await pg.click('#perfBtn'); await pg.wait_for_timeout(150)
        h = await pg.evaluate("(()=>{const r=document.getElementById('pfHead').getBoundingClientRect();return [r.left+40,r.top+r.height/2]})()")
        await pg.mouse.move(h[0], h[1]); await pg.mouse.down(); await pg.mouse.move(h[0] + 200, h[1] + 200, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(100)
        s7 = await pg.evaluate(STATE)
        check('Ziehen heftet an', s7['pinned'] and not s7['hidden'], s7)
        await pg.click('#pfClose')
        # neue Optiken
        names = await pg.evaluate("[...document.querySelectorAll('#appTheme option')].map(o=>o.value+'='+o.textContent)")
        check('Neue Optiken in der Auswahl', names[-3:] == ['dj=DJ-Pult', 'light=Hell', 'precise=Präzision'], names)
        for th, light in [('light', True), ('precise', True), ('dj', False)]:
            await pg.click('#optikBtn'); await pg.select_option('#appTheme', th); await pg.wait_for_timeout(300)
            r = await pg.evaluate("""(()=>{const lum=c=>{const m=c.match(/[\\d.]+/g).map(Number);return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255};
              const cs=getComputedStyle, card=document.querySelector('.looper-card'), tr=document.querySelector('.track');
              return {theme:document.documentElement.dataset.theme, scheme:cs(document.documentElement).colorScheme,
                card:lum(cs(card).backgroundColor||'rgb(0,0,0)'), cardInk:lum(cs(card).color), track:lum(cs(tr).backgroundColor), trackInk:lum(cs(tr.querySelector('.tname')).color)}})()""")
            if light:
                good = r['theme'] == th and r['card'] > 0.8 and r['cardInk'] < 0.25 and r['track'] < 0.15 and r['trackInk'] > 0.8
            else:
                good = r['theme'] == th and r['cardInk'] > 0.8 and r['track'] < 0.1 and r['trackInk'] > 0.8
            check('Optik ' + th + ': Kontraste', good, r)
        await pg.reload(); await pg.wait_for_timeout(500)
        check('DJ bleibt nach Neuladen', await pg.evaluate("document.documentElement.dataset.theme") == 'dj')
        check('Keine Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
