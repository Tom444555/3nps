# v136: Reiter aufgeräumt – 4 Hauptbereiche + Unterleiste (Chips) + „?“ (Anleitung passend zum Bereich), Lernen-Übersicht mit Kacheln,
# letzter Unterpunkt je Bereich gemerkt, alte Sprungziele/Deep-Links, Lazy-Laden unverändert, iPad hochkant ohne Springen, keine Skriptfehler
import asyncio, sys, json, re
from playwright.async_api import async_playwright
from nav import tab
U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''), flush=True)
VIS = "(()=>({cur:AppNav.current(),vis:['looper','lernen','power','caged','quinten','griffbrett','ueben','jam','solo','lied','singen','hilfe'].filter(p=>!document.getElementById('panel-'+p).hidden),area:[...document.querySelectorAll('.tabs [data-area]')].filter(b=>b.getAttribute('aria-selected')==='true').map(b=>b.dataset.area),chips:[...document.querySelectorAll('#subNav [data-tab]')].filter(c=>!c.hidden).map(c=>c.dataset.tab),sub:!document.getElementById('subNav').hidden}))()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U); await pg.wait_for_timeout(900)
        check('ab v136', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 136)
        main_ = await pg.evaluate("[...document.querySelectorAll('.tabs.areas [data-area]')].map(b=>b.textContent.trim())")
        check('Oben genau 4 Hauptbereiche (+ Rig ab v146)', main_[:4] == ['Looper', 'Lernen', 'Jammen', 'Song & Gesang'] and main_[4:] in ([], ['Rig']), main_)
        v = await pg.evaluate(VIS)
        check('Start: Looper allein, ohne Unterleiste', v['cur'] == 'looper' and v['vis'] == ['looper'] and v['area'] == ['looper'] and not v['sub'], v)
        await pg.click('#area-lernen'); await pg.wait_for_timeout(300); v = await pg.evaluate(VIS)
        check('Lernen: Übersicht + 5 Unterpunkte', v['cur'] == 'lernen' and v['chips'][:6] == ['lernen', 'power', 'caged', 'quinten', 'griffbrett', 'ueben'] and v['sub'], v)
        chips = await pg.evaluate("[...document.querySelectorAll('#subNav [data-tab]')].filter(c=>!c.hidden).map(c=>c.textContent)")
        check('Chips heißen wie gewünscht', chips[:6] == ['Übersicht', 'Powerchords-Kurs', 'CAGED', 'Quintenzirkel', 'Technik', 'Training'], chips)
        tiles = await pg.evaluate("[...document.querySelectorAll('#lnTiles .ln-tile')].map(t=>[t.dataset.t,!!t.querySelector('svg'),t.querySelector('.ln-ic').textContent.length>0,t.querySelector('.ln-d').textContent.length>10])")
        check('Übersicht: 5 Kacheln mit Icon, Ring, Kurzbeschreibung', [t[0] for t in tiles][:5] == ['power', 'caged', 'quinten', 'griffbrett', 'ueben'] and all(t[1] and t[2] and t[3] for t in tiles), tiles)
        check('Übersicht: Platz „Heute üben“', 'Heute üben' in await pg.inner_text('#lnToday'))
        await pg.click('#area-jammen'); await pg.wait_for_timeout(300); v = await pg.evaluate(VIS)
        check('Jammen: Backing Track zuerst, Chips Backing Track · Improvisation', v['cur'] == 'jam' and v['chips'] == ['jam', 'solo'] and v['vis'] == ['jam'], v)
        await pg.click('#area-gesang'); await pg.wait_for_timeout(300); v = await pg.evaluate(VIS)
        check('Song & Gesang: Songwriting zuerst, Chips Songwriting · Mitsingen', v['cur'] == 'lied' and v['chips'] == ['lied', 'singen'], v)
        # gemerkter Unterpunkt je Bereich
        await tab(pg, 'solo'); await tab(pg, 'singen'); await tab(pg, 'caged'); await pg.wait_for_timeout(200)
        await pg.click('#area-jammen'); a = await pg.evaluate("AppNav.current()")
        await pg.click('#area-gesang'); g = await pg.evaluate("AppNav.current()")
        await pg.click('#area-lernen'); l = await pg.evaluate("AppNav.current()")
        check('Letzter Unterpunkt je Bereich gemerkt', (a, g, l) == ('solo', 'singen', 'caged'), (a, g, l))
        await pg.reload(); await pg.wait_for_timeout(900)
        check('Nach Neustart: zuletzt offener Unterpunkt', await pg.evaluate("AppNav.current()") == 'caged')
        await pg.click('#area-jammen'); check('Nach Neustart: Merker je Bereich erhalten', await pg.evaluate("AppNav.current()") == 'solo')
        await pg.click('#area-lernen'); await pg.click('#tab-lernen'); await pg.wait_for_timeout(300)
        last = await pg.evaluate("[...document.querySelectorAll('.ln-tile.last')].map(t=>t.dataset.t+'|'+t.textContent)")
        check('Zuletzt benutzte Kachel markiert', len(last) == 1 and last[0].startswith('caged|') and 'Zuletzt' in last[0], last)
        await pg.click('.ln-tile[data-t="quinten"]'); await pg.wait_for_timeout(300)
        check('Kachel öffnet den Unterpunkt', await pg.evaluate("AppNav.current()") == 'quinten' and await pg.get_attribute('#tab-quinten', 'aria-selected') == 'true')
        # „?“ öffnet Hilfe passend zum Bereich
        for t, want in [('solo', 'improvisation'), ('power', 'powerchord-kurs'), ('looper', 'aufnehmen'), ('lernen', 'bereiche'), ('singen', 'mitsingen')]:
            await tab(pg, t); await pg.wait_for_timeout(200); await pg.click('#tab-hilfe'); await pg.wait_for_timeout(1700)
            r = await pg.evaluate("(()=>{const a=document.querySelector('#hlToc a.on');const e=a&&document.getElementById('hl-'+a.dataset.id);return {on:a&&a.dataset.id,top:e&&Math.round(e.getBoundingClientRect().top),hilfe:!document.getElementById('panel-hilfe').hidden}})()")
            check('„?“ aus %s → Anleitung „%s“' % (t, want), r['hilfe'] and r['on'] == want and -5 < r['top'] < 400, r)
            await pg.click('#tab-hilfe'); await pg.wait_for_timeout(200)
            check('nochmals „?“ → zurück zu %s' % t, await pg.evaluate("AppNav.current()") == t)
        # alte Sprungziele: programmatische Klicks auf alte Reiter-Knöpfe und Deep-Links
        await tab(pg, 'looper'); await pg.evaluate("document.getElementById('tab-jam').click()"); v = await pg.evaluate(VIS)
        check('Alter Sprung (tab-jam.click) → Jammen/Backing Track', v['cur'] == 'jam' and v['area'] == ['jammen'] and v['sub'], v)
        await pg.evaluate("document.getElementById('tab-griffbrett').click()"); v = await pg.evaluate(VIS)
        check('Alter Sprung (tab-griffbrett.click) → Lernen/Technik', v['cur'] == 'griffbrett' and v['area'] == ['lernen'], v)
        for h, want in [('#power', 'power'), ('#solo', 'solo'), ('#hilfe', 'hilfe'), ('#begleitung', 'griffbrett'), ('#jammen', 'solo'), ('#gesang', 'singen'), ('#lernen', 'lernen')]:
            pg2 = await ctx.new_page(); e2 = []; pg2.on('pageerror', lambda e: e2.append(str(e)))
            await pg2.goto(U + h); await pg2.wait_for_timeout(700); c = await pg2.evaluate("AppNav.current()")
            check('Deep-Link %s → %s' % (h, want), c == want and not e2, (c, e2)); await pg2.close()
        # Lazy-Laden: Inhalte erst beim Öffnen gebaut
        pg3 = await (await b.new_context(viewport={'width': 1180, 'height': 820})).new_page()
        await pg3.goto(U); await pg3.wait_for_timeout(800)
        lz = await pg3.evaluate("[document.getElementById('lnTiles').children.length, document.getElementById('pcSecTheorie').children.length, document.getElementById('hlMain').children.length]")
        check('Lazy: Übersicht, Powerchords, Anleitung beim Start leer', lz == [0, 0, 0], lz)
        await tab(pg3, 'power'); await pg3.wait_for_timeout(400)
        check('Lazy: Powerchords wird beim Öffnen gebaut', await pg3.evaluate("document.getElementById('pcSecTheorie').children.length>0 || !!document.getElementById('pcBoard') || document.querySelectorAll('#panel-power .card').length>2"))
        await pg3.context.close()
        # Fortschrittsring aus vorhandenen Daten
        pg4 = await (await b.new_context(viewport={'width': 1180, 'height': 820})).new_page()
        await pg4.add_init_script("localStorage.setItem('powerchords.progress.v1', JSON.stringify({kurs:{'k1-1-0':true,'k1-1-1':true,'q-k1':{best:3}}})); localStorage.setItem('3nps-tab','lernen')")
        await pg4.goto(U); await pg4.wait_for_timeout(900)
        pr = await pg4.evaluate("[document.querySelector('.ln-tile[data-t=power] .ln-p').textContent, PcKurs.total(), document.querySelector('.ln-tile[data-t=power] .ln-rfg').getAttribute('stroke-dasharray')]")
        check('Kurs-Ring zeigt erledigte Übungen', pr[0].startswith('2 / %d' % pr[1]) and float(pr[2].split()[0]) > 0, pr)
        await pg4.context.close()
        # iPad hochkant: Leisten passen/scrollen, Seite springt nicht, nichts ragt heraus
        pg5 = await (await b.new_context(viewport={'width': 768, 'height': 1024})).new_page()
        await pg5.goto(U); await pg5.wait_for_timeout(800)
        await pg5.click('#area-lernen'); await pg5.wait_for_timeout(300)
        geo = await pg5.evaluate("(()=>{const s=document.getElementById('subNav'),n=document.querySelector('.tabs.areas');return {ow:document.documentElement.scrollWidth<=innerWidth+1,nh:n.getBoundingClientRect().height,sh:s.getBoundingClientRect().height,one:new Set([...s.querySelectorAll('[data-tab]:not([hidden])')].map(c=>Math.round(c.getBoundingClientRect().top))).size===1,top:Math.round(document.getElementById('panel-lernen').getBoundingClientRect().top)}})()")
        check('Hochkant: nichts ragt heraus, Chips in einer Zeile', geo['ow'] and geo['one'] and geo['nh'] < 70 and geo['sh'] < 50, geo)
        tops = []
        for t in ['power', 'caged', 'quinten', 'griffbrett', 'ueben', 'lernen']:
            await pg5.click('#tab-' + t); await pg5.wait_for_timeout(150)
            tops.append(await pg5.evaluate("Math.round(document.getElementById('panel-" + t + "').getBoundingClientRect().top + scrollY)"))
        check('Hochkant: Inhalt beginnt bei jedem Chip an derselben Stelle (kein Springen)', len(set(tops)) == 1, tops)
        await pg5.set_viewport_size({'width': 390, 'height': 844}); await pg5.wait_for_timeout(300)
        geo = await pg5.evaluate("(()=>{const n=document.querySelector('.tabs.areas');return {ow:document.documentElement.scrollWidth<=innerWidth+1,nh:Math.round(n.getBoundingClientRect().height),help:Math.round(document.getElementById('tab-hilfe').getBoundingClientRect().right)<=innerWidth}})()")
        check('Telefon: Hauptleiste in einer Zeile, „?“ sichtbar, nichts ragt heraus', geo['ow'] and geo['help'] and geo['nh'] < 70, geo)
        await pg5.context.close()
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
