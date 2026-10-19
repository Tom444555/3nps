# v59: Sprache DE | EN – Schalter, Speicherung, Kopf und Looper ohne deutsche Reste, Meldungen, DE-Modus unverändert
import asyncio, re
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
J = """()=>{const out=new Set();const roots=[document.querySelector('header'),document.getElementById('panel-looper'),document.querySelector('[role=tablist]')].filter(Boolean);
 for(const r of roots){const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while((n=w.nextNode())){
  if(n.nodeType===3){const p=n.parentNode;if(p&&/SCRIPT|STYLE/.test(p.nodeName))continue;const v=n.nodeValue.trim();if(v)out.add(v);}
  else for(const a of ['title','placeholder','aria-label']){const v=n.getAttribute(a);if(v)out.add('@'+v);}}}
 return [...out];}"""
OK_SAME = set(['visation', 'Impro', '@Name (optional)', '@Swing', '@Tempo in BPM', 'Improvisation ›', '→ Song'] + 'Looper Live Matrix Metal Mono REC Song Tempo Track Training Drums Drone Fills Designer Swing Audio Backing Bluetooth Bluetooth: CAGED Improvisation writing Neutral Kick Snare Clap Ride Rim Shaker Tom Details Feel Analyzer Percussion Standard Pull Push Bass Rimshot Synth Hip-Hop Halftime Funk Rock Punk Metal Disco House Techno Samba Cumbia Boogie Motown Breakbeat'.split() + ['Ghost Notes', 'Low Cut', 'High Cut', 'Tom 1', 'Tom 2', '@Low Cut', '@High Cut', '@Ghost Notes', '@Feel', '@Bass', '@Percussion', '@Analyzer', '@Snare', '@Hi-Hat', 'Hi-Hat', '@Swing', '@Kick', '@Ride', 'Standard'])
async def texts(b, q):
    ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(U + q); await pg.wait_for_timeout(1500)
    await pg.click('#loopMonitor'); await pg.wait_for_timeout(1200)
    return ctx, pg, set(await pg.evaluate(J)), errs
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        c1, pg, de, e1 = await texts(b, '')
        check('DE: Sprache de, Übersetzer aus', await pg.evaluate("window.__lang==='de' && !window.__tr && document.documentElement.lang==='de'"))
        check('DE: Knopf zeigt EN', await pg.inner_text('#langBtn') == 'EN')
        check('DE: Texte deutsch', 'Eingang offen' in de and 'Alle starten' in de)
        # Umschalten per Knopf → neu laden, gespeichert
        async with pg.expect_navigation(): await pg.click('#langBtn')
        await pg.wait_for_timeout(1500)
        check('Knopf schaltet auf EN und speichert', await pg.evaluate("window.__lang==='en' && localStorage.getItem('3nps-lang')==='en'"))
        check('EN: Knopf zeigt DE', await pg.inner_text('#langBtn') == 'DE')
        await pg.reload(); await pg.wait_for_timeout(1200)
        check('EN bleibt nach Neustart', await pg.evaluate("window.__lang") == 'en')
        check('EN: Reiter übersetzt', await pg.inner_text('#tab-quinten') == 'Circle of fifths', await pg.inner_text('#tab-quinten'))
        async with pg.expect_navigation(): await pg.click('#langBtn')
        await pg.wait_for_timeout(1200)
        check('zurück auf DE', await pg.evaluate("window.__lang==='de' && localStorage.getItem('3nps-lang')==='de'"))
        await c1.close()
        c2, pg, en, e2 = await texts(b, '?lang=en')
        same = sorted(t for t in de & en if re.search(r'[A-Za-zÄÖÜäöüß]{3}', t) and t not in OK_SAME and not re.match(r'^(3nps|Fake|@?(Kick|Snare|Clap|Ride|Rim|Shaker|Tom) )', t)
                      and not re.match(r'^[A-Z][\w\- /]*(Shuffle|Blues|Boogie|Bossa|Breakbeat|Cumbia|Stomp|Disco|Floor|Funk|Halftime|Hip-Hop|House|Lo-Fi|Motown|Soul|Punk|Drop|Rock|Samba|Techno|Train|Beat)?[\w\- /()0-9]*$', t))
        check('EN: Kopf/Looper ohne unübersetzte Texte', not same, same[:12])
        um = sorted(t for t in en if re.search(r'[äöüßÄÖ]', t))
        check('EN: keine Umlaute mehr', not um, um[:8])
        msgs = []
        async def st():
            m = await pg.evaluate("(document.getElementById('loopStatus')||{}).textContent||''")
            if m and (not msgs or msgs[-1] != m): msgs.append(m)
        await pg.evaluate("Looper.foot(0)")
        for _ in range(14): await pg.wait_for_timeout(500); await st()
        await pg.evaluate("Looper.foot(0)")
        for _ in range(14): await pg.wait_for_timeout(500); await st()
        await pg.click('#loopMonitor'); await pg.wait_for_timeout(300); await st()
        check('EN: Meldungen englisch', len(msgs) >= 3 and not any(re.search(r'[äöüß]|\b(Spur|Tippe|läuft|nimmt|und)\b', m) for m in msgs), msgs)
        check('EN: Taktkreis-Text englisch', await pg.evaluate("__tr('Gestoppt')==='Stopped' && __tr('wartet auf Signal')==='waiting for signal'"))
        check('EN: keine Doppelübersetzung', await pg.evaluate("__tr(__tr('Spur 1 läuft. Nochmal tippen für ein Overdub.'))") == 'Track 1 is playing. Tap again for an overdub.')
        check('Keine Skriptfehler', not e1 and not e2, e1 + e2)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
