# v144: Feinschliff Design – Schrift- und Radius-Stufen im Looper (CSS-Variablen), Kartentitel größer als Text, ein Aktiv-Stil
# über Bereich → Unterpunkt → Kurs-Abschnitt, „Blitz: jeder Takt“ und gedrückte Spurknöpfe in „Präzision Nacht“/„iOS“ lesbar
# (kein Orange), Platzhalter in Optik-Grau, Spurknöpfe ■ ↶ ✕ ✂ ♫ ≥ 44 px (auch 820 px und Telefon), „Was passt“ auf 820 px ohne
# abgeschnittene Texte (feste Höhe, REC und Spurknöpfe weiter ohne Scrollen), Mitsingen ohne Lied mit Leerzustand und zwei
# Wegen zum Lied, deutsche Kurs-Überschrift. Optiken nordic / precise-dark / ios, Geräte-Profile Neu/Alt/Minimal. Englisch, keine Skriptfehler.
import asyncio, os
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
MEAS = """() => { const q = s => document.querySelector(s), r = e => e.getBoundingClientRect(), P = q('#panel-looper');
  const vis = e => { const b = r(e); return b.width > 0 && b.height > 0; };
  const fs = new Set(), rad = new Set();
  [...P.querySelectorAll('*')].filter(vis).forEach(e => { const s = getComputedStyle(e);
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) fs.add(parseFloat(s.fontSize).toFixed(1));
    const rr = parseFloat(s.borderTopLeftRadius); if (rr > 4.5 && rr < 100 && !s.borderTopLeftRadius.includes('%') && !e.closest('.seg')) rad.add(rr); });
  const mini = [...document.querySelectorAll('.tracks .mini > *')].filter(vis).map(e => Math.round(Math.min(r(e).width, r(e).height)));
  const pb = q('#passtBox'), cut = pb.hidden ? ['versteckt'] : [...pb.querySelectorAll('*')].filter(vis).filter(e => { const s = getComputedStyle(e);
    return (e.scrollWidth > e.clientWidth + 1 && s.overflowX !== 'auto' && s.overflowX !== 'visible') || (e.scrollHeight > e.clientHeight + 1 && s.overflow === 'hidden' && !e.matches('.passt-b,.passt-notes,.passt-pick')); })
    .map(e => (e.id || e.className) + ':' + e.textContent.trim().slice(0, 24));
  const bodyFs = parseFloat(getComputedStyle(q('#panel-looper .pattern-desc') || P).fontSize);
  return { vh: innerHeight, foot: [0,1,2].map(i => Math.round(r(q('#foot'+i)).bottom)), stop: [0,1,2].map(i => Math.round(r(q('#stop'+i)).bottom)),
    fs: [...fs].sort((a, b) => a - b), rad: [...rad].sort((a, b) => a - b), mini, cut, passtH: pb.hidden ? 0 : Math.round(r(q('.passt-b')).height),
    h2: parseFloat(getComputedStyle(q('.looper-card h2')).fontSize), bodyFs,
    hs: document.documentElement.scrollWidth - document.documentElement.clientWidth } }"""
# Kontrast Text/Hintergrund eines Knopfs (Hintergrund mit Alpha über der ersten deckenden Fläche darunter)
CON = """sel => { const e = document.querySelector(sel); const P = c => { const m = c.match(/[\\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  let base = [0, 0, 0]; for (let a = e.parentElement; a; a = a.parentElement) { const c = P(getComputedStyle(a).backgroundColor); if (c[3] >= .99) { base = c; break; } }
  const s = getComputedStyle(e), bg = P(s.backgroundColor), mix = [0, 1, 2].map(i => bg[i] * bg[3] + base[i] * (1 - bg[3])), fg = P(s.color);
  const l1 = L(fg), l2 = L(mix); return { ratio: Math.round((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) * 100) / 100, img: s.backgroundImage.slice(0, 50) }; }"""
NAV = """() => { const st = e => { const s = getComputedStyle(e); return [s.backgroundColor, s.backgroundImage.slice(0, 60), s.color].join(' | '); };
  return [st(document.querySelector('.tabs .tab[aria-selected="true"]')), st(document.querySelector('.subtabs .subtab[aria-selected="true"]')), st(document.querySelector('#pcSubs .toggle-btn.active'))]; }"""
async def load2(pg):
    await pg.select_option('#loopCountIn', '0')
    for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T']):
        await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(3500)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(500)
    if await pg.is_visible('#edClose'): await pg.click('#edClose'); await pg.wait_for_timeout(300)
    await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(1500)
async def run(p, theme, dev, w, h, errs, deep=False):
    b = await p.chromium.launch(args=ARGS)
    ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=(w < 500)); pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
    await pg.add_init_script(f"localStorage.setItem('3nps-theme2','{theme}');localStorage.setItem('3nps-theme','nordic');localStorage.setItem('3nps-device','{dev}');localStorage.setItem('3nps-ringe','klein');if(!sessionStorage.getItem('v144')){{localStorage.removeItem('3nps-passt-auf');sessionStorage.setItem('v144','1')}}")
    await pg.goto(U); await pg.wait_for_timeout(1600)
    tag = f'{theme}/{dev} {w}×{h}:'
    # Mitsingen ohne Lied
    await open_tab(pg, 'singen'); await pg.wait_for_timeout(700)
    e = await pg.evaluate("(()=>{const q=s=>document.getElementById(s),r=q('sbEmptyBox').getBoundingClientRect(),c=q('panel-singen').querySelector('.sb-card').getBoundingClientRect();return {stage:q('sbStage').hidden,box:!q('sbEmptyBox').hidden&&r.height>200,mid:Math.abs((r.left+r.right)/2-(c.left+c.right)/2),h:q('sbEmptyBox').querySelector('.sb-e-h').textContent,fs:parseFloat(getComputedStyle(q('sbEmpty')).fontSize),bt:[...q('sbEmptyBox').querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().height))}})()")
    check(f'{tag} Mitsingen ohne Lied: keine leere Bühne, Hinweis groß und mittig mit zwei Knöpfen (≥ 44 px)', e['stage'] and e['box'] and e['mid'] < 4 and e['h'] == 'Noch kein Text zum Mitsingen' and e['fs'] >= 14 and len(e['bt']) == 2 and min(e['bt']) >= 44, e)
    if deep:
        await pg.click('#sbGoText'); await pg.wait_for_timeout(500)
        check('Leerzustand „Gesangstext anlegen“ öffnet die Improvisation', await pg.is_visible('#panel-solo'))
        await open_tab(pg, 'singen'); await pg.wait_for_timeout(400)
        await pg.click('#sbGoSongs'); await pg.wait_for_timeout(600)
        check('Leerzustand „Lieder mit Text“ öffnet den Looper mit aufgeklappter Liste', await pg.is_visible('#panel-looper') and await pg.evaluate("document.getElementById('lsFold').open"))
        await pg.evaluate("document.getElementById('lsFold').open=false")
        # Kurs: deutsche Überschrift, Kachel „Ohrenschmaus“, Aktiv-Stil über drei Ebenen gleich
        await open_tab(pg, 'power'); await pg.wait_for_timeout(1000)
        kt = await pg.evaluate("[document.querySelector('#pcSecKurs .pc-wt').textContent, [...document.querySelectorAll('#pcKRings .pc-tt > b')].map(b=>b.textContent)]")
        check('Kurs-Überschrift „Powerchords-Kurs“, Kachel „Ohrenschmaus“ statt „Ear Candy“', kt[0] == 'Powerchords-Kurs' and 'Ohrenschmaus' in kt[1] and 'Ear Candy' not in kt[1], (kt[0], kt[1][9:10]))
        cap = await pg.evaluate("[...document.querySelectorAll('#pcSecKurs p.caption')].map(p=>p.textContent).join(' ')")
        check('Kursname „Power Chord Theory“ bleibt als Quelle genannt', 'Power Chord Theory' in cap)
    if dev != 'min':
        await open_tab(pg, 'power'); await pg.wait_for_timeout(900)
        nv = await pg.evaluate(NAV)
        check(f'{tag} ein Aktiv-Stil für Bereich, Unterpunkt und Kurs-Abschnitt', nv[0] == nv[1] == nv[2], nv)
        mk = await pg.evaluate("(()=>{const s=getComputedStyle(document.getElementById('subNav'));return s.webkitMaskImage||s.maskImage})()")
        check(f'{tag} Chipzeile blendet am rechten Rand aus (Altes iPad: ohne Maske)', ('gradient' in mk) == (dev != 'old'), mk[:40])
    else:
        bi = await pg.evaluate("(()=>{const t=document.querySelector('.tabs .tab[aria-selected=\"true\"]');return getComputedStyle(t).backgroundImage})()")
        check(f'{tag} Minimal: Bereichsreiter ohne Verlauf (flach)', bi == 'none', bi)
    # Looper mit zwei Spuren
    await open_tab(pg, 'looper'); await load2(pg)
    m = await pg.evaluate(MEAS)
    check(f'{tag} Spurknöpfe ■ ↶ ✕ ✂ ♫ aller Spuren ≥ 44 × 44 px', len(m['mini']) == 15 and min(m['mini']) >= 44, (min(m['mini']), len(m['mini'])))
    if w >= 700:
        check(f'{tag} Taktkreise „Klein“: REC und Spurknöpfe aller Spuren ohne Scrollen sichtbar', max(m['stop']) <= m['vh'] - 8, (m['foot'], m['stop'], m['vh']))
    else:
        check(f'{tag} Telefon: erste Spur samt REC auf dem ersten Bildschirm', m['foot'][0] <= m['vh'] - 20, (m['foot'], m['vh']))
    if dev != 'min':
        check(f'{tag} „Was passt“: kein Text abgeschnitten („…“)', not m['cut'], m['cut'][:4])
        if 700 <= w <= 860: check(f'{tag} „Was passt“ feste Höhe 132 px', m['passtH'] == 132, m['passtH'])
    if dev == 'new':
        check(f'{tag} Looper: höchstens 8 Schriftgrößen (vorher 23–26)', len(m['fs']) <= 8, m['fs'])
        check(f'{tag} Looper: höchstens 5 Radien (ohne Pegel-Kleinteile/Pillen; vorher 11–15)', len(m['rad']) <= 5, m['rad'])
        check(f'{tag} Kartentitel größer als der Text', m['h2'] > m['bodyFs'], (m['h2'], m['bodyFs']))
    check(f'{tag} kein seitliches Scrollen', m['hs'] <= 0, m['hs'])
    if theme in ('ios', 'precise-dark') and dev == 'new':
        await pg.evaluate("(()=>{const b=document.getElementById('loopFlash');if(!b.classList.contains('active'))b.click();})()")
        await pg.click('#edit0'); await pg.wait_for_timeout(500)
        fl = await pg.evaluate(CON, '#loopFlash'); ed = await pg.evaluate(CON, '#edit0')
        check(f'{tag} „Blitz: jeder Takt“ aktiv lesbar (≥ 4,5:1, kein Orange-Verlauf)', fl['ratio'] >= 4.5 and 'gradient' not in fl['img'] or theme == 'precise-dark' and fl['ratio'] >= 4.5 and '255, 171' not in fl['img'], fl)
        check(f'{tag} gedrückter Spurknopf ✂ in der Optik (≥ 4,5:1, kein Orange-Verlauf)', ed['ratio'] >= 4.5 and '255, 171' not in ed['img'], ed)
        if await pg.is_visible('#edClose'): await pg.click('#edClose')
        ph = await pg.evaluate("[getComputedStyle(document.getElementById('lsName'),'::placeholder').color, getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()]")
        check(f'{tag} Platzhalter in Optik-Grau statt Browser-Grau', ph[0] != 'rgb(117, 117, 117)', ph)
    await b.close()
RING = "()=>{const g=s=>document.querySelector(s).getBoundingClientRect();return {ring:[0,1,2].map(i=>Math.round(g('#ring'+i).width)),cw:document.getElementById('ring0').width,foot:[0,1,2].map(i=>Math.round(g('#foot'+i).bottom)),stop:Math.round(g('#stop0').bottom),klein:document.documentElement.classList.contains('ring-klein'),btn:[...document.querySelectorAll('#ringSeg button')].map(b=>b.textContent+(b.classList.contains('active')?'*':'')),vis:getComputedStyle(document.getElementById('ring0')).visibility}}"
async def rings(p, errs):
    # Vorgabe „Groß“ = Größe wie v142 (1366×1024: Kreis 274 px); „Klein“ = kompakt (174 px), REC ohne Scrollen
    b = await p.chromium.launch(args=ARGS); pg = await b.new_page(viewport={'width': 1366, 'height': 1024})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script("if(!sessionStorage.getItem('r')){localStorage.removeItem('3nps-ringe');localStorage.setItem('3nps-device','new');sessionStorage.setItem('r','1')}")
    await pg.goto(U); await pg.wait_for_timeout(1500); await open_tab(pg, 'looper'); await load2(pg)
    g = await pg.evaluate(RING)
    check('Taktkreise: Vorgabe „Groß“ – Kreis wie v142 (274 px), Schalter zeigt „Groß“', not g['klein'] and min(g['ring']) == 274 and g['btn'] == ['Groß*', 'Klein'], g)
    if not await pg.evaluate("Looper.running()"): await pg.click('#loopAll')
    await pg.wait_for_timeout(600); f1 = (await pg.evaluate(RING))['foot']; await pg.wait_for_timeout(900); f2 = (await pg.evaluate(RING))['foot']
    check('Groß: beim Mitlaufen springt nichts (REC-Unterkante fest)', f1 == f2, (f1, f2))
    await pg.click('#optikBtn'); await pg.wait_for_timeout(300)
    await pg.click('#ringSeg [data-r="klein"]'); await pg.wait_for_timeout(700)
    k = await pg.evaluate(RING)
    check('Umschalten auf „Klein“ während der Wiedergabe: Kreis 174 px, Leinwand neu aufgebaut, REC ohne Scrollen', k['klein'] and min(k['ring']) == 174 and k['cw'] == 174 and max(k['foot']) <= 1024 - 8 and k['stop'] <= 1016, k)
    await pg.wait_for_timeout(900); k2 = await pg.evaluate(RING)
    check('Klein: beim Mitlaufen springt nichts', k2['foot'] == k['foot'], (k['foot'], k2['foot']))
    check('Gespeichert in 3nps-ringe', await pg.evaluate("localStorage.getItem('3nps-ringe')") == 'klein')
    await pg.reload(); await pg.wait_for_timeout(1500)
    rk = await pg.evaluate("[document.documentElement.classList.contains('ring-klein'), [...document.querySelectorAll('#ringSeg button')].map(b=>b.classList.contains('active'))]")
    check('Neuladen merkt „Klein“ (Klasse schon vor dem ersten Bild gesetzt)', rk == [True, [False, True]], rk)
    await pg.click('#optikBtn'); await pg.wait_for_timeout(300); await pg.click('#ringSeg [data-r="gross"]'); await pg.wait_for_timeout(500)
    check('Zurück auf „Groß“', await pg.evaluate("!document.documentElement.classList.contains('ring-klein') && localStorage.getItem('3nps-ringe')==='gross'"))
    await pg.click('#langBtn'); await pg.wait_for_timeout(500)
    en = await pg.evaluate("[document.querySelector('.ring-opt-l').textContent, ...[...document.querySelectorAll('#ringSeg button')].map(b=>b.textContent)]")
    check('Englisch: „Beat rings: Large · Small“', en == ['Beat rings', 'Large', 'Small'], en)
    await pg.click('#langBtn'); await b.close()
    # Minimal: weiterhin keine Kreise, in beiden Stellungen
    for rv in ['gross', 'klein']:
        b = await p.chromium.launch(args=ARGS); pg = await b.new_page(viewport={'width': 1366, 'height': 1024})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(f"localStorage.setItem('3nps-device','min');localStorage.setItem('3nps-ringe','{rv}')")
        await pg.goto(U); await pg.wait_for_timeout(1500); await open_tab(pg, 'looper')
        v = await pg.evaluate("[getComputedStyle(document.getElementById('ring0')).visibility, getComputedStyle(document.getElementById('ringMin0')).display]")
        check(f'Minimal ({rv}): keine Taktkreise, Zahl statt Kreis', v == ['hidden', 'flex'], v)
        await b.close()
async def lang(p, errs):
    b = await p.chromium.launch(args=ARGS); pg = await b.new_page(viewport={'width': 1366, 'height': 1024})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(U); await pg.wait_for_timeout(1500); await pg.click('#langBtn'); await pg.wait_for_timeout(600)
    await open_tab(pg, 'singen'); await pg.wait_for_timeout(600)
    en = await pg.evaluate("[document.querySelector('.sb-e-h').textContent, document.getElementById('sbGoText').textContent, document.getElementById('sbGoSongs').textContent]")
    check('Englisch: Leerzustand Mitsingen übersetzt', en == ['No lyrics to sing along yet', 'Add lyrics', 'Songs with lyrics'], en)
    await open_tab(pg, 'power'); await pg.wait_for_timeout(900)
    kt = await pg.evaluate("document.querySelector('#pcSecKurs .pc-wt').textContent")
    check('Englisch: Kurs-Überschrift übersetzt', kt != 'Powerchords-Kurs' and 'Power' in kt, kt)
    await pg.click('#langBtn'); await b.close()
async def main():
    errs = []
    async with async_playwright() as p:
        await run(p, 'nordic', 'new', 1366, 1024, errs, deep=True)
        for th in ['nordic', 'precise-dark', 'ios']:
            for w, h in [(1366, 1024), (820, 1180), (390, 844)]:
                if not (th == 'nordic' and w == 1366): await run(p, th, 'new', w, h, errs)
        await run(p, 'precise-dark', 'old', 820, 1180, errs)
        await run(p, 'ios', 'min', 820, 1180, errs)
        await rings(p, errs)
        await lang(p, errs)
    check('keine Skriptfehler', not errs, errs[:3])
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
