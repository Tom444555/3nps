# v134: Akkordleiste (Improvisieren/Mitsingen) – lange Blöcke: Name klebt links und rechts am sichtbaren Rand,
# rechts „→ nächster Akkord“ und „noch n Takte“; nichts springt; Text nur bei Takt-/Blockwechsel.
import asyncio, re
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
GEO = """(()=>{const b=document.getElementById('sfBand').getBoundingClientRect(),on=document.querySelector('#sfStrip .sf-seg.on');if(!on)return null;
 const l=on.querySelector('.sf-sl'),r=on.querySelector('.sf-sr');if(!l)return {long:false,name:on.querySelector('b').textContent};const L=l.getBoundingClientRect(),R=r.getBoundingClientRect(),S=on.getBoundingClientRect();
 return {long:true,name:l.querySelector('b').textContent,rname:r.querySelector('b').textContent,nx:r.querySelector('.sf-nx').textContent,cd:r.querySelector('.sf-cd').textContent,
  lIn:L.left>=b.left-1&&L.right<=b.right+1,rIn:R.left>=b.left-1&&R.right<=b.right+1,segL:S.left<b.left-1,segR:S.right>b.right+1,lx:Math.round(L.left-b.left),rx:Math.round(b.right-R.right),bh:Math.round(b.height),sh:Math.round(S.height)}})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e) + ' @' + (e.stack or '')[:300]))
        await pg.goto(U); await pg.wait_for_timeout(600)
        check('Version ab v134', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 134)
        await pg.evaluate("document.getElementById('bpm').value = 160; document.getElementById('bpm').dispatchEvent(new Event('input'))")
        await pg.evaluate("Jam.setSeq('Cm:8 G:2 Eb F')")
        await pg.click('#tab-jam'); await pg.evaluate("Jam.start()"); await pg.wait_for_timeout(800)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#sfZoom [data-z=\"2\"]').click()"); await pg.wait_for_timeout(500)
        segs = await pg.evaluate("[...document.querySelectorAll('#sfStrip .sf-seg')].map(s=>[s.classList.contains('long'),s.querySelector('b').textContent,(s.querySelector('.sf-nx')||{}).textContent||''])")
        check('Langer Block (Cm, 8 Takte) hat Name links/rechts und „→ G“', segs[0][0] and segs[0][2] == '→ G', segs[:3])
        check('Letzter Block zeigt den ersten als nächsten (Schleife)', segs[-1][2] in ('→ Cm', ''), segs[-1])
        samples = []; texts = set(); hs = set()
        for k in range(70):
            await pg.wait_for_timeout(100)
            g = await pg.evaluate(GEO)
            if g and g.get('long') and g['name'] == 'Cm': samples.append(g); texts.add(g['cd']); hs.add((g['bh'], g['sh']))
        cut = [s for s in samples if s['segL'] or s['segR']]
        print('  Stichproben im langen Block: %d, davon Block über den Rand hinaus: %d · Countdown: %s' % (len(samples), len(cut), sorted(texts)))
        check('Block reicht über den sichtbaren Rand hinaus (Fall vom iPad)', len(cut) >= 5, len(cut))
        check('Name links und „→ G“ rechts bleiben dabei immer sichtbar', all(s['lIn'] and s['rIn'] for s in cut), [s for s in cut if not (s['lIn'] and s['rIn'])][:2])
        check('Links-Name klebt am linken Rand, wenn der Blockanfang draußen ist', all(s['lx'] <= 2 for s in cut if s['segL']) and any(s['segL'] for s in cut), [(s['lx'], s['segL']) for s in cut][:6])
        check('Rechts-Name klebt am rechten Rand, wenn das Blockende draußen ist', all(s['rx'] <= 2 for s in cut if s['segR']) and any(s['segR'] for s in cut), [(s['rx'], s['segR']) for s in cut][:6])
        nums = sorted({int(re.search(r'\d+', t).group()) for t in texts if re.search(r'\d+', t)})
        check('Countdown „noch n Takte“ zählt herunter (höchstens 8, mehrere Stufen)', all(t.startswith('noch ') for t in texts) and len(nums) >= 4 and max(nums) <= 8, sorted(texts))
        check('Nichts springt: Leisten- und Blockhöhe bleiben gleich', len(hs) == 1, hs)
        # Mehrlast: Countdown-Text ändert sich nur beim Taktwechsel
        n = await pg.evaluate("""new Promise(res=>{let c=0;const el=()=>document.querySelector('#sfStrip .sf-seg.on .sf-cd');const mo=new MutationObserver(m=>{c+=m.length});
          mo.observe(document.getElementById('sfStrip'),{subtree:true,childList:true,characterData:true});setTimeout(()=>{mo.disconnect();res(c)},3000)})""")
        check('In 3 s (8 Takte bei 160 BPM) nur wenige DOM-Änderungen (Text beim Takt-/Blockwechsel)', n <= 24, n)
        await pg.screenshot(path='/tmp/v134leiste.png')
        # kurze Blöcke unverändert
        await pg.evaluate("Jam.setSeq('C Am F G')"); await pg.wait_for_timeout(800)
        await pg.evaluate("document.querySelector('#sfZoom [data-z=\"6\"]').click()"); await pg.wait_for_timeout(500)
        sh = await pg.evaluate("[...document.querySelectorAll('#sfStrip .sf-seg')].map(s=>s.classList.contains('long'))")
        check('Kurze Blöcke bleiben wie bisher (kein Doppel-Name)', sh and not any(sh), sh)
        await pg.evaluate("localStorage.setItem('3nps-sf-zoom','6')")
        # EN
        await pg.evaluate("Jam.stop()")
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(800)
        await pg.evaluate("Jam.setSeq('Cm:8 G:2 Eb F')"); await pg.click('#tab-jam'); await pg.evaluate("Jam.start()"); await pg.wait_for_timeout(600)
        await pg.click('#tab-solo'); await pg.wait_for_timeout(1200)
        g = await pg.evaluate(GEO)
        check('EN: Countdown „n bars“', g and g.get('long') and re.match(r'^\d+ bars?( left)?$', g['cd'] or ''), g)
        await pg.evaluate("Jam.stop()")
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'\n{ok}/{tot}')
asyncio.run(main())
