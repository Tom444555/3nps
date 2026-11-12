# v145: Schlanker Start und Studio – Schriften/Englisch als eigene Dateien, Anleitung erst beim Öffnen, Optik-Bilder im eigenen Speicher,
# Studio-Name/Optik/Telefon-Leiste. Teil A gegen den Testserver (8765), Teil B gegen den Pages-Nachbau (vorher: sh test/pages.sh, Port 8790),
# Teil C Update von der Vorgänger-Fassung (main-Commit OLD) auf den aktuellen Bau mit jeder Optik (eigener Server 8792).
import asyncio, json, os, re, shutil, subprocess, sys, time
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav import tab as open_tab
SRC = '/home/claude/3nps-src'; MAIN = '/home/claude/3nps-main'; WWW = SRC + '/app/www/'
U = 'http://localhost:8765/'; PB = 'http://localhost:8790/3nps/'
OLD = os.environ.get('OLD', '33cc36f')   # main-Commit v144
THEMES = ['nordic', 'metal', 'amp', 'ice', 'clean', 'matrix', 'dj', 'light', 'precise', 'precise-dark', 'ios']
FONTS = {'nordic': ['Uncial Antiqua'], 'metal': ['Metal Mania', 'Black Ops One'], 'amp': ['Russo One', 'Michroma'], 'ice': ['Cinzel']}
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info)[:300] if info != '' else ''), flush=True)
def theme_init(th):
    return "try{if(!sessionStorage.getItem('__t')){sessionStorage.setItem('__t','1');localStorage.setItem('3nps-theme','%s');localStorage.setItem('3nps-theme2','%s')}}catch(e){}" % (th if th in ('nordic', 'metal', 'amp', 'ice') else 'nordic', th)
# Zeitpunkte: erstes Bild mit Inhalt und Ende des Schriftladens (font-display:block → vor dem Laden unsichtbar, nie eine falsche Schrift)
FONTWATCH = "window.__fl=[];document.fonts&&document.fonts.addEventListener('loadingdone',e=>e.fontfaces.forEach(f=>window.__fl.push([f.family,performance.now()])));"
REG = "navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => true)"
async def set_theme(pg, th):   # wie die Auswahl unter „App-Optik ▾“
    await pg.evaluate("(v)=>{const s=document.getElementById('appTheme');s.value=v;s.dispatchEvent(new Event('change'))}", th)
async def errs_of(pg):
    E = []; pg.on('pageerror', lambda e: E.append(str(e))); return E

async def part_a(p):
    h = open(WWW + 'index.html', encoding='utf8').read()
    check('index.html: keine eingebetteten Schriften, kein Wörterbuch, Anleitung als Funktion', 'base64' not in h and 'window.__EN = {' not in h and 'function __hilfeDaten()' in h, len(h.encode()))
    check('index.html deutlich kleiner (< 2,1 MB statt 2,55 MB)', len(h.encode()) < 2100000, len(h.encode()))
    check('Alle Optik-Schriften mit font-display:block (unsichtbar statt Ersatzschrift)', h.count('font-display:block') == 6 and 'font-display:swap' not in h)
    check('Schriften und Wörterbuch liegen als Dateien bereit', all(os.path.getsize(WWW + 'fonts/' + f) > 10000 for f in ['uncial.woff', 'metalmania.woff', 'blackopsone.woff', 'russoone.woff', 'michroma.woff', 'cinzel700.woff']) and os.path.getsize(WWW + 'i18n-en.js') > 150000)
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    # DE: kein Englisch, nur die Schrift der Optik
    for th in ['nordic', 'metal', 'amp', 'ice', 'ios']:
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); E = await errs_of(pg)
        await pg.add_init_script(theme_init(th)); await pg.add_init_script(FONTWATCH)
        req = []; pg.on('request', lambda r: req.append(r.url.split('/')[-1]))
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("(()=>{const f=performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint');return {en:typeof window.__EN,fcp:f?f.startTime:0,fl:window.__fl,st:[...document.fonts].filter(x=>x.status!=='unloaded').map(x=>x.family+':'+x.status),pre:[...document.querySelectorAll('link[rel=preload]')].map(l=>l.href.split('/').pop())}})()")
        woff = sorted(x for x in req if x.endswith('.woff'))
        want = FONTS.get(th, [])
        check('%s: lädt nur die eigenen Schriften %s, kein Englisch' % (th, want or '(keine)'), r['en'] == 'undefined' and 'i18n-en.js' not in req and sorted(f.split(':')[0] for f in r['st']) == sorted(want) and all(s.endswith(':loaded') for s in r['st']), (woff, r['st']))
        late = [f for f, t in r['fl'] if t > r['fcp'] + 100]   # font-display:block: bis dahin unsichtbar statt falscher Schrift, höchstens ~1–6 Bilder
        check('%s: Schrift spätestens 100 ms nach dem ersten Bild da, nie eine Ersatzschrift (kein Aufblitzen)' % th, not late and len(r['pre']) == len(want), (r['fcp'], r['fl'], r['pre']))
        check('%s: keine Skriptfehler' % th, not E, E[:2])
        await ctx.close()
    # EN: Wörterbuch wird synchron nachgeladen
    ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); E = await errs_of(pg)
    await pg.goto(U + 'index.html?lang=en'); await pg.wait_for_timeout(1500)
    r = await pg.evaluate("[Object.keys(window.__EN||{}).length, document.getElementById('perfBtn') ? document.getElementById('perfBtn').textContent : '', document.documentElement.lang, !!window.__EN_PCW]")
    check('EN: Wörterbuch geladen, Oberfläche englisch', r[0] > 2000 and 'Performance' in r[1] and r[2] == 'en' and r[3], r)
    await pg.evaluate("localStorage.setItem('3nps-lang','en')"); await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1200)
    r2 = await pg.evaluate("[Object.keys(window.__EN||{}).length, document.getElementById('perfBtn').textContent]")
    await pg.evaluate("setAppLang('de')"); await pg.wait_for_timeout(1500)
    r3 = await pg.evaluate("[typeof window.__EN, document.getElementById('perfBtn').textContent]")
    check('EN gespeichert → Englisch, zurück auf DE → kein Wörterbuch', r2[0] > 2000 and 'Performance' in r2[1] and r3[0] == 'undefined' and 'Leistung' in r3[1], (r2, r3))
    check('EN: keine Skriptfehler', not E, E[:2])
    await ctx.close()
    # Anleitung: erst beim Öffnen gebaut, Suche und Sprung aus einem Reiter
    ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); E = await errs_of(pg)
    await pg.goto(U + 'index.html'); await pg.wait_for_timeout(1200)
    n0 = await pg.evaluate("document.querySelectorAll('.hl-topic').length")
    await open_tab(pg, 'hilfe'); await pg.wait_for_timeout(400)
    n1 = await pg.evaluate("[document.querySelectorAll('.hl-topic').length, Hilfe.count(), document.getElementById('hlCount').textContent]")
    await pg.fill('#hlQ', 'drone'); await pg.wait_for_timeout(200)
    hits = await pg.evaluate("document.querySelectorAll('#hlRes .hl-hit').length")
    check('Anleitung: vorher nicht gebaut, beim Öffnen alle Themen, Suche findet', n0 == 0 and n1[0] == n1[1] and n1[0] > 50 and hits > 0, (n0, n1, hits))
    await ctx.close()
    # Optik-Bilder werden nach dem Start in „optik-1“ gelegt (nur die der gewählten Optik)
    ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page()
    await pg.add_init_script(theme_init('ice')); await pg.goto(U + 'index.html'); await pg.wait_for_timeout(4500)
    k = await pg.evaluate("caches.open('optik-1').then(c=>c.keys()).then(k=>k.map(r=>r.url.split('/').pop()).sort())")
    check('Nach dem Start: Bilder der gewählten Optik (ice) im Optik-Speicher, sonst keine', k == sorted(json.loads(re.search(r'window.__OPTIK_IMG=(\{.*?\});', h).group(1))['ice']), k)
    await ctx.close()
    # Studio: Name wie im Looper, Optik übernommen, Telefon ohne Überlauf
    ver = re.search(r'3nps · (v\d+)', h).group(1)
    for w, hh in [(390, 844), (820, 1180), (1366, 1024)]:
        ctx = await b.new_context(viewport={'width': w, 'height': hh}); pg = await ctx.new_page(); E = await errs_of(pg)
        await pg.add_init_script(theme_init('ios'))
        await pg.goto(U + 'studio/'); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""(()=>{const v=document.getElementById('views'),bs=[...v.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
          return {doc:document.documentElement.scrollWidth-document.documentElement.clientWidth, v:v.scrollWidth-v.clientWidth,
            inside:bs.every(r=>r.left>=0&&r.right<=innerWidth+0.5), cut:[...v.querySelectorAll('button')].filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent),
            brand:document.querySelector('.brand').textContent, lt:document.documentElement.dataset.lt, acc:getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(), tit:document.title}})()""")
        check('Studio %d: Ansichtsleiste ohne Überlauf, alle Ansichten sichtbar und lesbar' % w, r['doc'] <= 0 and r['v'] <= 0 and r['inside'] and not r['cut'], r)
        if w == 390:
            check('Studio: Name „Studio 3nps · %s“, Akzent der Looper-Optik (iOS)' % ver, r['brand'].startswith('Studio') and ver in r['brand'] and r['lt'] == 'ios' and r['acc'] == '#0a84ff' and 'Loopsmiths' in r['tit'], r)
            await pg.click('#views [data-v=brw]'); await pg.wait_for_timeout(300)
            hint = await pg.inner_text('#bPrev .empty')
            check('Studio Telefon: Hinweis zeigt nach oben (Liste steht darüber)', hint.startswith('Oben'), hint)
            await pg.screenshot(path='/tmp/claude-0/v145/studio_390.png')
        if w == 1366:
            await pg.click('#views [data-v=brw]'); await pg.wait_for_timeout(300)
            check('Studio breit: Hinweis „Links …“', (await pg.inner_text('#bPrev .empty')).startswith('Links'))
            await pg.screenshot(path='/tmp/claude-0/v145/studio_1366.png')
        check('Studio %d: keine Skriptfehler' % w, not E, E[:2])
        await ctx.close()
    for th, fam in [('nordic', 'Uncial Antiqua'), ('metal', 'Metal Mania')]:
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page()
        await pg.add_init_script(theme_init(th)); await pg.goto(U + 'studio/'); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("[getComputedStyle(document.querySelector('.brand')).fontFamily, [...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)]")
        check('Studio %s: Namensschrift der Optik' % th, fam in r[0] and fam in r[1], r)
        await ctx.close()
    ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page()
    await pg.add_init_script("localStorage.setItem('3nps-device','min');" + theme_init('metal')); await pg.goto(U + 'studio/'); await pg.wait_for_timeout(1000)
    check('Studio bei „Minimal“: schlicht ohne Optik', await pg.evaluate("!document.documentElement.dataset.lt"))
    await ctx.close(); await b.close()

async def part_b(p):
    sw = open(WWW + 'sw.js', encoding='utf8').read()
    core = eval(re.search(r"const CORE = (\[.*?\]);", sw).group(1)); oi = eval(re.search(r"const OPTIK_IMG = (\[.*?\]);", sw).group(1))
    size = sum(os.path.getsize(WWW + f) for f in core)
    check('Vorab-Speicher ohne Optik-Bilder, mit Schriften und Wörterbuch (%.1f MB statt 9,0 MB)' % (size / 1e6), not set(core) & set(oi) and 'fonts/metalmania.woff' in core and 'i18n-en.js' in core and size < 6e6, size)
    b = await p.chromium.launch(); ctx = await b.new_context(service_workers='allow', viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); E = await errs_of(pg)
    await pg.add_init_script(theme_init('amp'))
    await pg.goto(PB); await pg.evaluate(REG); await pg.reload(); await pg.wait_for_timeout(4500)
    keys = await pg.evaluate("caches.keys()")
    ok1 = await pg.evaluate("caches.open('optik-1').then(c=>c.keys()).then(k=>k.map(r=>r.url.split('/').pop()).sort())")
    check('Pages: App-Speicher + Optik-Speicher mit den Bildern der gewählten Optik (amp)', any(k.startswith('3nps-v') for k in keys) and sorted(ok1) == sorted(['alu-dark.jpg', 'alu.jpg', 'grille.jpg', 'jewel.png', 'screw.png', 'tolex.jpg']), (keys, ok1))
    # online auf ice wechseln (Bilder kommen dazu), dann offline zwischen amp/ice/metal/nordic wechseln
    await set_theme(pg, 'ice'); await pg.wait_for_timeout(2500)
    ok2 = await pg.evaluate("caches.open('optik-1').then(c=>c.keys()).then(k=>k.length)")
    check('Umschalten auf ice legt dessen Bilder dazu', ok2 == 11, ok2)
    await ctx.set_offline(True)
    await pg.reload(); await pg.wait_for_timeout(1200)
    for th in ['amp', 'ice', 'metal', 'precise-dark', 'nordic']:
        await set_theme(pg, th); await pg.wait_for_timeout(900)
        fam = FONTS.get(th, [])
        r = await pg.evaluate("(fams)=>Promise.all(fams.map(f=>document.fonts.load('20px \"'+f+'\"'))).then(()=>fams.map(f=>document.fonts.check('20px \"'+f+'\"')))", fam)
        imgs = json.loads(re.search(r'window.__OPTIK_IMG=(\{.*?\});', open(WWW + 'index.html', encoding='utf8').read()).group(1)).get(th, [])
        got = await pg.evaluate("(L)=>Promise.all(L.map(f=>fetch(f).then(r=>r.ok,()=>false)))", imgs)
        if th in ('amp', 'ice', 'precise-dark'):
            check('offline Optik %s: Schrift und Bilder da' % th, all(r) and all(got), (r, got))
        else:
            check('offline Optik %s (nie gewählt): Schrift da, Bilder fehlen erwartungsgemäß' % th, all(r) and (not imgs or not any(got)), (r, got))
    await pg.goto(PB + '?lang=en'); await pg.wait_for_timeout(1200)
    en = await pg.evaluate("[typeof window.__EN, document.getElementById('perfBtn').textContent]")
    check('offline: Englisch aus dem Speicher', en[0] == 'object' and 'Performance' in en[1], en)
    await pg.goto(PB + 'studio/'); await pg.wait_for_timeout(1200)
    check('offline: Studio startet', 'Studio' in await pg.evaluate("document.querySelector('.brand').textContent"))
    check('Pages: keine Skriptfehler', not E, E[:2])
    await b.close()

def up_dirs():
    base = '/tmp/claude-0/v145/up'; shutil.rmtree(base, ignore_errors=True); os.makedirs(base)
    old = base + '/old/3nps'; os.makedirs(old)
    subprocess.run('git -C %s archive %s | tar -x -C %s' % (MAIN, OLD, old), shell=True, check=True)
    new = base + '/new/3nps'
    shutil.copytree(old, new, symlinks=True)
    for f in os.listdir(WWW):
        if f == 'asr': continue
        s = WWW + f
        (shutil.copytree(s, new + '/' + f, dirs_exist_ok=True) if os.path.isdir(s) else shutil.copy(s, new + '/' + f))
    os.symlink(base + '/old', base + '/cur')
    subprocess.run('pkill -f "http.server 8792"', shell=True)
    # --directory mit dem Link „cur“: jede Anfrage folgt dem Link neu (Umschalten alt → neu = Update auf dem Server)
    subprocess.Popen('exec python3 -m http.server 8792 --directory %s/cur' % base, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    time.sleep(1)
    return base
def switch(base, to):
    os.remove(base + '/cur'); os.symlink(base + '/' + to, base + '/cur')

async def part_c(p):
    base = up_dirs(); UP = 'http://localhost:8792/3nps/'
    newver = re.search(r'3nps · (v\d+)', open(WWW + 'index.html', encoding='utf8').read()).group(1)
    oldver = re.search(r'3nps · (v\d+)', subprocess.run('git -C %s show %s:index.html' % (MAIN, OLD), shell=True, capture_output=True, text=True).stdout).group(1)   # v146: Vorgänger-Version aus OLD (nicht fest v144)
    imgs_all = json.loads(re.search(r'window.__OPTIK_IMG=(\{.*?\});', open(WWW + 'index.html', encoding='utf8').read()).group(1))
    b = await p.chromium.launch()
    for th in THEMES:
        switch(base, 'old')
        ctx = await b.new_context(service_workers='allow', viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); E = await errs_of(pg)
        await pg.add_init_script(theme_init(th)); await pg.add_init_script(FONTWATCH)
        await pg.goto(UP); await pg.evaluate(REG); await pg.reload(); await pg.wait_for_timeout(1500)
        v0 = (await pg.inner_text('.brand')).lower()
        switch(base, 'new')
        await pg.goto(UP); await pg.wait_for_timeout(2500)      # 1. Öffnen: alte Fassung, neue lädt im Hintergrund
        v1 = (await pg.inner_text('.brand')).lower()
        bad = []; pg.on('requestfailed', lambda r: bad.append(r.url)); pg.on('response', lambda r: r.status >= 400 and bad.append(str(r.status) + ' ' + r.url))
        await ctx.set_offline(True)                               # 2. Öffnen ohne Netz: alles muss aus dem Speicher kommen
        await pg.goto(UP); await pg.wait_for_timeout(1500)
        v2 = (await pg.inner_text('.brand')).lower()
        r = await pg.evaluate("(()=>{const f=performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint');return {fcp:f?f.startTime:0,fl:window.__fl,th:document.documentElement.dataset.theme||'nordic'}})()")
        imgs = imgs_all.get(th, [])
        got = await pg.evaluate("(L)=>Promise.all(L.map(f=>fetch(f).then(r=>r.ok,()=>false)))", imgs)
        bg = await pg.evaluate("getComputedStyle(document.documentElement).backgroundImage")
        keys = await pg.evaluate("caches.keys()")
        late = [f for f, t in r['fl'] if t > r['fcp'] + 100]   # font-display:block: bis dahin unsichtbar statt falscher Schrift, höchstens ~1–6 Bilder
        want = FONTS.get(th, [])
        loaded = sorted(set(f for f, t in r['fl']))
        check('Update %s: %s → 1. Öffnen alt → 2. Öffnen (offline) %s, Optik bleibt' % (th, oldver, newver), oldver in v0 and oldver in v1 and newver in v2 and r['th'] == th, (v0, v1, v2, r['th']))
        check('Update %s offline: Schrift ≤ 100 ms nach dem ersten Bild, Hintergrund-Bilder aus dem Speicher, keine Fehlanfragen' % th,
              not late and loaded == sorted(want) and all(got) and not bad and 'optik-1' in keys and not any(k.startswith('3nps-' + oldver) for k in keys),
              (r['fcp'], r['fl'], got, bad[:3], bg[:60], keys))
        check('Update %s: keine Skriptfehler' % th, not E, E[:2])
        await ctx.close()
    await b.close()

async def main():
    parts = sys.argv[1:] or ['a', 'b', 'c']
    async with async_playwright() as p:
        if 'a' in parts: await part_a(p)
        if 'b' in parts: await part_b(p)
        if 'c' in parts: await part_c(p)
    print(f'{ok}/{tot}')
asyncio.run(main())
