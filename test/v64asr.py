# v64: Texterkennung – Testlied (Musik + Sprache an 4 s und 22 s) laden, erkennen, Wörter/Zeilen/Zeiten prüfen, ausbessern, offline, Englisch
import asyncio, json, re, time
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'; U = 'http://localhost:8765/index.html'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))
DE = 'ich fahre auf der straße bis zum ende und die nacht ist lang danach kommt nichts mehr an der grenze aus licht'.split()
async def load(pg, f):
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', f)
    for _ in range(80):
        await pg.wait_for_timeout(250)
        if await pg.is_visible('#impDlg'): await pg.click('#impOk')
        if re.match(r'^(Spur|Track) 1:', await pg.inner_text('#loopStatus')): break
async def run(pg, lang):
    await pg.click('#tab-solo'); await pg.wait_for_timeout(300)
    if not await pg.is_visible('#sgEdit'): await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
    await pg.select_option('#sgLang', lang)
    await pg.evaluate("window.confirm=()=>true")
    t = time.time(); await pg.click('#sgAuto')
    for _ in range(600):
        await pg.wait_for_timeout(500)
        r = await pg.evaluate("Sing.rec()")
        if not r['busy'] and time.time() - t > 2: break
    return r, time.time() - t
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); pg = await ctx.new_page(); errs = []; foreign = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        ctx.on('request', lambda r: foreign.append(r.url) if not r.url.startswith(('http://localhost:8765', 'blob:', 'data:')) else None)
        await pg.goto(U); await pg.wait_for_timeout(800)
        await load(pg, T + 'sing/lied_de.wav')
        await pg.click('#tab-solo'); await pg.click('#sgToggle'); await pg.wait_for_timeout(300)
        check('Knopf „Text automatisch erkennen“ bei Datei', await pg.is_visible('#sgAuto') and await pg.is_visible('#sgLang'))
        r, dt = await run(pg, 'de')
        d = await pg.evaluate("JSON.parse(localStorage.getItem('3nps-sing'))")
        rec = list(d['f'].values())[0] if d and d.get('f') else {'tok': []}
        tok = rec['tok']; words = [t['w'].lower() for t in tok]
        hit = sum(1 for w in DE if w in words)
        check('Erkennung fertig ohne Fehler', 'erkannt' in r['msg'] and not errs, (r['msg'][:90], f'{dt:.0f} s'))
        check('Wörter erkannt (≥ 70 % des Textes, beide Stellen)', hit >= 0.7 * len(DE) and len(tok) >= 25, f'{hit}/{len(DE)} · {len(tok)} Wörter · ' + ' '.join(words[:12]))
        # Zeitpunkte: Wörter liegen bei den gesprochenen Stellen (4–12 s und 22–30 s)
        secs = await pg.evaluate("(t)=>{const s=Looper.singSrc(0);return t.map(x=>Sing.b2f(x.b,s.beats)/s.sr)}", tok)
        inwin = sum(1 for x in secs if 3.5 <= x <= 12.8 or 21.5 <= x <= 30.8)
        check('Zeitpunkte an den richtigen Stellen', inwin >= 0.9 * len(secs) and min(secs) < 5 and any(21.5 <= x <= 23.5 for x in secs), [round(x, 1) for x in secs[:6]] + ['…'] + [round(x, 1) for x in secs[-4:]])
        first2 = [x for x in secs if x > 20]
        check('Einsatz der 2. Stelle genau (±0,4 s)', first2 and abs(first2[0] - 22.0) <= 0.4, first2[:1])
        nl = max(t['l'] for t in tok) + 1
        check('in Zeilen aufgeteilt (Pause trennt)', 2 <= nl <= 8 and any(t['l'] > 0 for t in tok if secs[tok.index(t)] > 20), nl)
        al = await pg.evaluate("Object.values(Sing.data().f).map(r=>r.auto&&r.auto.aligned)[0]")
        offg = sum(1 for t in tok if abs(t['b'] * 4 - round(t['b'] * 4)) > 1e-6)
        check('auf 16tel gerastet, außer an die Stimme angepasste Wörter (v72)', offg <= (al or 0) and all(tok[i]['b'] < tok[i + 1]['b'] for i in range(len(tok) - 1)), (offg, al))
        check('keine fremden Anfragen', not foreign, foreign[:3])
        # ausbessern: Wort ersetzen bleibt möglich
        await pg.click('#sgEdit .sg-chip[data-i="0"]'); await pg.fill('#sgWord', 'Ich'); await pg.click('#sgRepl'); await pg.wait_for_timeout(200)
        check('Ausbessern danach möglich', (await pg.evaluate("JSON.parse(localStorage.getItem('3nps-sing'))"))['f'][list(d['f'].keys())[0]]['tok'][0]['w'] == 'Ich')
        caches = await pg.evaluate("caches.keys()")
        # Spur und Mitsingen zeigen den Text
        await pg.click('#tab-looper'); await pg.click('#loopAll'); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{const s=Looper.singSrc(0);Looper.seek(0, 3.6*s.sr - s.origPos)})()")
        await pg.click('#tab-singen'); await pg.wait_for_timeout(900)
        check('Mitsingen zeigt den erkannten Text', len(await pg.inner_text('#sbLine')) > 5, await pg.inner_text('#sbLine'))
        check('keine Skriptfehler', not errs, errs[:3])
        # Englisch, zweiter Lauf: Modell kommt jetzt aus dem Speicher
        pg2 = await ctx.new_page(); e2 = []; pg2.on('pageerror', lambda e: e2.append(str(e)))
        await pg2.goto(U + '?lang=en'); await pg2.wait_for_timeout(800); await load(pg2, T + 'sing/lied_en.wav')
        await pg2.click('#tab-solo'); await pg2.click('#sgToggle'); await pg2.wait_for_timeout(300)
        check('EN: Knopf englisch', 'Detect lyrics' in await pg2.inner_text('#sgEdit'))
        r2, dt2 = await run(pg2, 'en')
        d2 = await pg2.evaluate("JSON.parse(localStorage.getItem('3nps-sing'))"); k2 = [k for k in d2['f'] if 'lied_en' in k]
        w2 = [t['w'].lower() for t in d2['f'][k2[0]]['tok']] if k2 else []
        check('EN: englischer Gesang erkannt', sum(1 for w in 'take my hand and sing along with me'.split() if w in w2) >= 6, (r2['msg'][:60], ' '.join(w2[:14]), f'{dt2:.0f} s'))
        check('EN: keine Skriptfehler', not e2, e2[:3])
        # Sparsam-Stufe
        pg3 = await ctx.new_page(); e3 = []; pg3.on('pageerror', lambda e: e3.append(str(e)))
        await pg3.goto(U); await pg3.wait_for_timeout(800); await load(pg3, T + 'sing/lied_de.wav')
        await pg3.click('#tab-solo'); await pg3.wait_for_timeout(300)
        if not await pg3.is_visible('#sgEdit'): await pg3.click('#sgToggle'); await pg3.wait_for_timeout(300)
        await pg3.select_option('#sgModel', 'tiny')
        r3, dt3 = await run(pg3, 'de')
        d3 = await pg3.evaluate("JSON.parse(localStorage.getItem('3nps-sing'))"); k3 = [k for k in d3['f'] if 'lied_de' in k]
        w3 = [t['w'].lower() for t in d3['f'][k3[0]]['tok']] if k3 else []
        check('Sparsam: erkennt mit kleinem Modell', 'erkannt' in r3['msg'] and sum(1 for w in DE if w in w3) >= 0.5 * len(DE), (r3['msg'][:50], ' '.join(w3[:10]), f'{dt3:.0f} s'))
        check('Stufe gemerkt', await pg3.evaluate("localStorage.getItem('3nps-asr-model')") == 'tiny')
        # Absturz simulieren: Merker „läuft“ steht beim Neustart noch da → auf Sparsam umstellen und Bescheid geben
        await pg3.evaluate("localStorage.setItem('3nps-asr-model','base');localStorage.setItem('3nps-asr-run',JSON.stringify({model:'base',at:Date.now()}))")
        await pg3.reload(); await pg3.wait_for_timeout(2200)
        st = await pg3.inner_text('#loopStatus')
        check('nach Absturz: auf Sparsam umgestellt, Hinweis', await pg3.evaluate("localStorage.getItem('3nps-asr-model')") == 'tiny' and 'Sparsam' in st and await pg3.evaluate("localStorage.getItem('3nps-asr-run')") is None, st[:80])
        check('Sparsam: keine Skriptfehler', not e3, e3[:3])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
