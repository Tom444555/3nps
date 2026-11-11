# v143: Looper-Bedienung – Touch-Ziele ≥ 44 px, Aufnahme/Transport ohne Scrollen (iPad quer mit geladenen Spuren und offenem
# „Was passt“, iPad hochkant, Telefon: erste Spur samt REC auf dem ersten Bildschirm), gleiche Spurkopf-Höhe auch für leere Spuren,
# EQ · Hall/Echo · Im Studio · Gesang trennen zu zweit, eine gemeinsame Tonart-Schreibweise („A♭-Dur“ in Spurkopf, Improvisation,
# Jammen), Kopf-Anzeige „Griffbrett“ statt „Tonart“, Startton-Zeile nur noch in Technik. In allen vier Geräte-Profilen
# (Automatisch · Neues iPad · Altes iPad · Minimal) und den Optiken nordic / precise-dark / ios. Englisch, keine Skriptfehler.
import asyncio, os, re
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
T = '/home/claude/3nps/test/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
MEAS = """() => { const q = s => document.querySelector(s), r = e => e.getBoundingClientRect();
  const H = s => [...document.querySelectorAll(s)].filter(e => r(e).width > 0).map(e => Math.round(Math.min(r(e).width, r(e).height)));
  return { vh: innerHeight, foot: [0,1,2].map(i => Math.round(r(q('#foot'+i)).bottom)), stop: [0,1,2].map(i => Math.round(r(q('#stop'+i)).bottom)),
    head: [0,1,2].map(i => Math.round(r(q('.track.t'+(i+1)+' .track-head')).height)),
    ring: [0,1,2].map(i => Math.round(r(q('#ring'+i)).top)),
    hdr: H('#optikBtn,#perfBtn,#liveBtn,#bpmDn,#bpmUp,.tabs .tab'), amp: H('#loopAmpSet,#loopMonitor,#loopTunerBtn,#loopAmpBtn,#loopSigBtn,#loopAll2'),
    miniH: [...document.querySelectorAll('.mini button,.mini .file-mini')].map(e => Math.round(r(e).height)),
    tbtn: H('.track-btns .eq-btn'), sel: H('#loopBars,#loopPractice'), passt: !q('#passtBox').hidden,
    grid: getComputedStyle(q('.track-btns')).gridTemplateColumns.split(' ').length,
    hs: document.documentElement.scrollWidth - document.documentElement.clientWidth } }"""
async def load2(pg):
    await pg.select_option('#loopCountIn', '0')
    for i, f in enumerate(['chords/c_pop_strum', 'loops/funk_104_3T']):
        await pg.set_input_files(f'#file{i}', T + f + '.wav'); await pg.wait_for_timeout(3500)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk'); await pg.wait_for_timeout(500)
    if await pg.is_visible('#edClose'): await pg.click('#edClose'); await pg.wait_for_timeout(300)
    await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(600)
async def run(p, theme, dev, w, h, errs, deep=False):
    b = await p.chromium.launch(args=ARGS)
    ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=(w < 500)); pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
    await pg.add_init_script(f"localStorage.setItem('3nps-theme2','{theme}');localStorage.setItem('3nps-theme','nordic');localStorage.setItem('3nps-device','{dev}');if(!sessionStorage.getItem('v143')){{localStorage.removeItem('3nps-passt-auf');sessionStorage.setItem('v143','1')}}")
    await pg.goto(U); await pg.wait_for_timeout(1600); await open_tab(pg, 'looper')
    tag = f'{theme}/{dev} {w}×{h}:'
    await load2(pg)
    m = await pg.evaluate(MEAS)
    if w > h:   # iPad quer
        check(f'{tag} „Was passt“ offen, REC und Spurknöpfe (■ ↶ ✕ ✂ ♫) aller Spuren ohne Scrollen sichtbar', (m['passt'] or dev == 'min') and max(m['stop']) <= m['vh'] - 8, m)
    elif w > 600:   # iPad hochkant
        check(f'{tag} REC und Spurknöpfe aller Spuren ohne Scrollen sichtbar', max(m['stop']) <= m['vh'], (m['foot'], m['stop'], m['vh']))
    else:
        check(f'{tag} Telefon: erste Spur samt REC auf dem ersten Bildschirm', m['foot'][0] <= m['vh'] - 20, (m['foot'], m['vh']))
    check(f'{tag} Spurkopf, Taktkreis und REC aller Spuren (auch leer) auf gleicher Höhe', len(set(m['head'])) == 1 and max(m['ring']) - min(m['ring']) <= 1 and max(m['foot']) - min(m['foot']) <= 1, (m['head'], m['ring'], m['foot']))
    check(f'{tag} Kopf-Knöpfe, Bereiche, Eingangs-Knöpfe, Auswahlfelder, Spur-Knöpfe ≥ 44 px', min(m['hdr'] + m['amp'] + m['sel'] + m['tbtn']) >= 44 and min(m['miniH']) >= 44, (min(m['hdr']), min(m['amp']), min(m['sel']), min(m['tbtn']), min(m['miniH'])))
    check(f'{tag} EQ · Hall/Echo · Im Studio · Gesang trennen ' + ('zu zweit' if w > 600 else 'untereinander'), m['grid'] == (2 if w > 600 else 1), m['grid'])
    check(f'{tag} kein seitliches Scrollen', m['hs'] <= 0, m['hs'])
    if deep:
        k1 = await pg.inner_text('#key1'); k0 = await pg.inner_text('#key0')
        check('Spurkopf: Tonart als „A♭-Dur“ / „C-Dur“ (gemeinsame Schreibweise)', 'A♭-Dur' in k1 and 'C-Dur' in k0, (k0, k1))
        lab = await pg.evaluate("[Analyzer.label({pc:8,major:true}), keyName({pc:6,major:false}), keyName({pc:10,major:true}), modeName('G#','Ionisch (Dur)'), modeName('F#','Dorisch')]")
        check('keyName/Analyzer.label: A♭-Dur, F♯-Moll, B♭-Dur; Griffbrett A♭ Ionisch, F♯ Dorisch', lab == ['A♭-Dur', 'F♯-Moll', 'B♭-Dur', 'A♭ Ionisch', 'F♯ Dorisch'], lab)
        lcdk = await pg.evaluate("document.getElementById('lcdKey').previousElementSibling.textContent")
        check('Kopf-Anzeige heißt „Griffbrett“ (bezieht sich klar auf den Griffbrett-Trainer)', lcdk == 'Griffbrett', lcdk)
        check('Startton-Zeile nicht mehr im Looper sichtbar', not await pg.is_visible('#caption'))
        await pg.evaluate("rootSel.value='G#';rootSel.dispatchEvent(new Event('change'));0"); await pg.wait_for_timeout(200)
        lk = await pg.inner_text('#lcdKey')
        check('Kopf-Anzeige schreibt G# Ionisch als „A♭ Ionisch“', lk == 'A♭ Ionisch', lk)
        await pg.evaluate("rootSel.value='G';rootSel.dispatchEvent(new Event('change'));0")
        await open_tab(pg, 'solo'); await pg.wait_for_timeout(1200)
        sk = await pg.inner_text('#sfKey'); src = await pg.inner_text('#sfKeySrc')
        check('Improvisation zeigt dieselbe Tonart wie der Spurkopf', sk == 'A♭-Dur' and 'Spur 2' in src, (sk, src))
        await open_tab(pg, 'jam'); await pg.wait_for_timeout(800)
        jo = await pg.evaluate("[...document.getElementById('jamKey').options].map(o=>o.textContent)")
        check('Jammen: Tonarten in derselben Form („A♭-Dur“, „F♯-Moll“, kein „G♯/A♭“)', 'A♭-Dur' in jo and 'F♯-Moll' in jo and not any('/' in x for x in jo), jo[:12])
        await open_tab(pg, 'griffbrett'); await pg.wait_for_timeout(600)
        cap = await pg.inner_text('#caption') if await pg.is_visible('#caption') else ''
        check('Startton-Zeile steht jetzt in Lernen › Technik', cap.startswith('Startton'), cap)
        await open_tab(pg, 'looper'); await pg.wait_for_timeout(300)
        await pg.click('#passtHead'); await pg.wait_for_timeout(300)
        await pg.reload(); await pg.wait_for_timeout(1600); await open_tab(pg, 'looper'); await load2(pg)
        zu = await pg.evaluate("document.getElementById('passtBox').classList.contains('zu') && localStorage.getItem('3nps-passt-auf')==='0'")
        check('„Was passt“ eingeklappt bleibt nach Neustart eingeklappt', zu)
        await pg.click('#langBtn'); await pg.wait_for_timeout(600)
        en = await pg.evaluate("[document.getElementById('lcdKey').previousElementSibling.textContent, document.getElementById('lcdKey').parentNode.title]")
        check('Englisch: „Fretboard“ mit Erklärung', en[0] == 'Fretboard' and en[1].startswith('Key of the fretboard'), en)
        await pg.click('#langBtn'); await pg.wait_for_timeout(300)
        lb = await pg.evaluate("(()=>{const b=document.getElementById('langBtn').getBoundingClientRect();const e=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2+16);return e&&e.id})()")
        check('„EN“: Tippfläche reicht unsichtbar über den kleinen Knopf hinaus (44 px)', lb == 'langBtn', lb)
    await b.close()
async def main():
    errs = []
    async with async_playwright() as p:
        await run(p, 'nordic', 'new', 1366, 1024, errs, deep=True)
        for th in ['nordic', 'precise-dark', 'ios']:
            for dev in ['auto', 'old', 'min']:
                await run(p, th, dev, 1366, 1024, errs)
        for th, dev in [('nordic', 'new'), ('precise-dark', 'old'), ('ios', 'min')]:
            await run(p, th, dev, 820, 1180, errs)
            await run(p, th, dev, 390, 844, errs)
    check('keine Skriptfehler', not errs, errs[:3])
    print(f'\n{ok}/{tot} bestanden')
asyncio.run(main())
