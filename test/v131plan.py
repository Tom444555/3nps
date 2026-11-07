# v131: Akkord-Baukasten mit 6er/13er/alterierten Akkorden (Tabelle), Hör-Training mit Ampel, Übungsplan mit Tempo-Stufen und
# Selbstkontrolle je Kapitel, Technik-Vorübungen, Stimmungen (Drop D/Cis/C/H) – Griffbilder schalten um; Speicher, kein Überlauf, EN
import asyncio, os, re
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '/tmp/v131plan')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--autoplay-policy=no-user-gesture-required']
OVER = """()=>{const h=document.getElementById('pcSecKurs'),R=h.getBoundingClientRect().right,bad=[];h.querySelectorAll('*').forEach(e=>{if(e.closest('svg')||e.closest('[hidden]')||e.closest('.pc-tbl')||e.closest('details:not([open])'))return;const r=e.getBoundingClientRect();if(!r.width)return;
 if(r.right>R+1)bad.push(e.tagName+'.'+e.className+' '+Math.round(r.right-R));});return bad.slice(0,6);}"""
JT = """()=>{const p=document.getElementById('pcSecKurs');const bad=[];p.querySelectorAll('.pc-ktools button,.pc-ktools summary,.pc-kplan button,.pc-kplan label.check,.pc-wtab summary').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||e.closest('[hidden]'))return;if(r.height<43.5||(r.width<43.5&&e.tagName!=='SUMMARY'))bad.push((e.textContent.trim().slice(0,14))+' '+Math.round(r.width)+'x'+Math.round(r.height));});return bad.slice(0,5);}"""
EARIV = {'dur': [0, 4, 7], 'moll': [0, 3, 7], 'maj7': [0, 4, 7, 11], '7': [0, 4, 7, 10], '9': [0, 4, 10, 2], 'b9': [0, 4, 10, 1], 's9': [0, 4, 10, 3]}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1300)
        check('Version ab v131', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 131)
        await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        # Akkord-Baukasten-Tabelle
        await pg.evaluate("document.getElementById('pcKC3').open=true"); await pg.wait_for_timeout(500)
        await pg.click('#pcKC3 [data-w=multi]'); await pg.evaluate("PcWerk.set({rs:0,rf:5})"); await pg.evaluate("document.querySelector('#pcKC3 .pc-wtab').open=true")
        n = await pg.evaluate("[document.querySelectorAll('#pcKC3 .pc-wtab tr[data-w=tysel]').length, document.querySelectorAll('#pcKC3 .pc-wtab .pc-wtg').length]")
        check('Akkord-Tabelle: 26 Arten in 5 Gruppen', n == [26, 5], n)
        want = {'6': 'A6', 'm6': 'Am6', '13': 'A13', '79': 'A7(9)', '7b9': 'A7b9', '7s9': 'A7#9', '7b5': 'A7b5', '7s5': 'A7#5'}
        got = {}
        for k in want:
            await pg.evaluate("document.querySelector('#pcKC3 tr[data-k=\"%s\"]').click()" % k); await pg.wait_for_timeout(60)
            got[k] = await pg.evaluate("[document.querySelector('#pcKC3 .pc-wbig').textContent,document.querySelector('#pcKC3 .pc-wform').textContent,[...document.querySelectorAll('#pcKC3 .pc-wm[data-n]:not(.ghost)')].map(g=>+g.dataset.n).sort((a,b)=>a-b)]")
        check('6er, 13er, alterierte: Name und Formel', all(got[k][0] == v for k, v in want.items()) and '13' in got['13'][1] and 'b9' in got['7b9'][1] and '#9' in got['7s9'][1] and '#5' in got['7s5'][1], {k: got[k][:2] for k in got})
        tones = await pg.evaluate("Object.fromEntries(PcWerk.TY.map(t=>[t.k,t.req.concat(t.opt||[])]))")
        A = 9; EXP = {'6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '13': [0, 4, 9, 10, 7, 2], '7b9': [0, 1, 4, 10, 7], '7s9': [0, 3, 4, 10, 7], '7b5': [0, 4, 6, 10], '7s5': [0, 4, 8, 10], '79': [0, 2, 4, 10, 7]}
        check('Neue Formeln stimmen (Halbtöne)', all(sorted(tones[k]) == sorted(v) for k, v in EXP.items()), {k: tones[k] for k in EXP})
        await pg.click('#pcKC3 [data-w=multi]')
        # Hör-Training
        await pg.click('#pcSecKurs [data-ktool=pcKT5]'); await pg.wait_for_timeout(300)
        vo = await pg.evaluate("Object.fromEntries(PcPlan.EAR.map(e=>[e[0],PcPlan.earVoicing(e[0],60)]))")
        bad = [k for k, v in EARIV.items() if sorted(set((m - 60) % 12 for m in vo[k])) != sorted(set(x % 12 for x in v))]
        sus = sorted(set((m - 60) % 12 for m in vo['sus']))
        check('Hör-Training: 8 Arten, Klänge nachgerechnet (Dur, Moll, sus, Maj7, 7, 9, b9, #9)', len(vo) == 8 and not bad and sus in ([0, 2, 7], [0, 5, 7]), (bad, sus))
        await pg.evaluate("window.__n=0;const o=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){window.__n++;return o.call(this)};0")
        await pg.click('#pcKT5 [data-ear=start]'); await pg.wait_for_timeout(300)
        for i in range(10):
            q = await pg.evaluate("PcPlan._ear()")
            await pg.click('#pcKT5 [data-ea="%s"]' % (q['k'] if i else ('dur' if q['k'] != 'dur' else 'moll')))
            if i < 9: await pg.click('#pcKT5 [data-ear=next]'); await pg.wait_for_timeout(150)
        cnt = await pg.inner_text('#pcKT5 .pc-wcnt'); st = await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1')).kurs")
        tries = sum(v[1] for v in st.get('ear', {}).values()); hits = sum(v[0] for v in st.get('ear', {}).values())
        check('Hör-Training: Trefferzählung, gespeichert, Akkorde klingen', 'Aufgabe 10 von 10 · Treffer: 9' in cnt and tries == 10 and hits == 9 and st.get('ear-best', {}).get('best') == 9 and await pg.evaluate("window.__n") > 20, (cnt, tries, hits))
        amp = await pg.evaluate("[...document.querySelectorAll('#pcKT5 .pc-amp')].map(a=>a.className)")
        check('Ampel für 8 Arten (grau/grün/gelb/rot)', len(amp) == 8 and all(re.search('grau|gruen|gelb|rot', a) for a in amp), amp)
        # Übungsplan
        await pg.evaluate("document.getElementById('pcKC8').open=true;document.getElementById('pcKC1').open=true"); await pg.wait_for_timeout(600)
        pl = await pg.evaluate("[...Array(15).keys()].map(i=>{const d=document.getElementById('pcKC'+(i+1));return d.open?!!d.querySelector('.pc-kplan [data-pbpm=\"100\"]'):null})")
        await pg.evaluate("document.querySelector('#pcKC8 .pc-kplan').scrollIntoView()")
        await pg.click('#pcKC8 [data-pbpm="80"]'); await pg.click('#pcKC8 [data-pself="1"]'); await pg.wait_for_timeout(150)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1')).kurs['plan-k8']")
        check('Übungsplan: Tempo-Stufen 60–100, Selbstkontrolle, gespeichert', pl[0] and pl[7] and st and st['bpm'] == 80 and st['ch'][1] is True, (pl, st))
        check('Planwerte zählen nicht als Häkchen', re.match(r'0 von \d+', await pg.inner_text('#pcKSum')) is not None, await pg.inner_text('#pcKSum'))
        # Technik
        await pg.click('#pcSecKurs [data-ktool=pcKT6]'); await pg.wait_for_timeout(300)
        n = await pg.evaluate("document.querySelectorAll('#pcKT6 input[data-tv]').length")
        await pg.click('#pcKT6 input[data-tv="1"]'); await pg.click('#pcKT6 [data-tvloop]'); await pg.wait_for_timeout(500)
        pl = await pg.evaluate("Powerchords.playing()"); tv = await pg.evaluate("JSON.parse(localStorage.getItem('powerchords.progress.v1')).kurs['tv-1']")
        check('Technik-Vorübungen: 8 Übungen (ergänzt), abhaken, Loop', n == 8 and tv and tv['done'] and pl and pl['names'] == ['E5'], (n, tv, pl))
        await pg.evaluate("Powerchords.stop()")
        # Stimmungen
        await pg.click('#pcSecKurs [data-ktool=pcKT7]'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.getElementById('pcKC2').open=true"); await pg.wait_for_timeout(400)
        g0 = await pg.evaluate("[...document.querySelectorAll('#pcK_k2-1 .pc-kstage .pc-m')].length")
        await pg.click('#pcKT7 [data-tune=dD]'); await pg.wait_for_timeout(500)
        r = await pg.evaluate("(()=>{const st=document.querySelector('#pcK_k2-1 .pc-kstage');return [[...st.querySelectorAll('.pc-sn')].map(x=>x.textContent).join(''),[...document.querySelectorAll('#pcKC2 tr[data-kpick]')].map(t=>t.cells[1].textContent)[0], PcKurs.check().bad.length, PcKurs.tuning()]})()")
        check('Drop D: Griffbilder umgestellt (tiefe Saite D, G5 = 555), alle Töne weiter richtig', r[0] == 'DADGHe' and r[1] == '555xxx' and r[2] == 0 and r[3] == 'dD', r)
        tg = await pg.evaluate("Object.fromEntries(PcPlan.TUNES.filter(t=>t[0]!=='E').map(t=>[t[0],[t[2],PcPlan.tuneGrips(t[2])]]))")
        PC = {'D5': 2, 'E5': 4, 'F5': 5, 'G5': 7, 'A5': 9, 'C5': 0}
        bad = [(k, g['n']) for k, (low, gs) in tg.items() for g in gs if g['fr'][0] < 0 or sorted({(low + g['fr'][0]) % 12, (45 + g['fr'][1]) % 12, (50 + g['fr'][2]) % 12}) != sorted({PC[g['n']], (PC[g['n']] + 7) % 12}) or (low + g['fr'][0]) % 12 != PC[g['n']]]
        check('Konkrete Griffe für Drop D, Cis, C, H nachgerechnet', not bad and tg['dD'][1][0]['fr'][:3] == [0, 0, 0] and tg['dCis'][1][0]['fr'][:3] == [1, 0, 0] and tg['dC'][1][0]['fr'][:3] == [2, 0, 0], bad)
        await pg.click('#pcKT7 [data-tune=dC]'); await pg.wait_for_timeout(400)
        check('Drop C: Tabelle mit Griffen, tiefe Saite C', 'tiefe Saite C' in await pg.inner_text('#pcKT7') or 'Tiefe Saite: C' in await pg.inner_text('#pcKT7'), (await pg.inner_text('#pcKT7'))[:120])
        await pg.reload(); await pg.wait_for_timeout(1300); await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        check('Stimmung bleibt nach Neustart', await pg.evaluate("PcKurs.tuning()") == 'dC')
        await pg.evaluate("PcKurs.setTuning('E')")
        check('Zurück auf Standard', await pg.evaluate("PcKurs.tuning()") == 'E')
        await pg.click('#pcSecKurs [data-ktool=pcKT5]'); await pg.click('#pcSecKurs [data-ktool=pcKT6]'); await pg.click('#pcSecKurs [data-ktool=pcKT7]')
        await pg.evaluate("document.getElementById('pcKC8').open=true"); await pg.wait_for_timeout(500)
        for vw, vh, nm in [(1366, 1024, 'quer'), (820, 1180, 'hoch'), (390, 844, '390')]:
            await pg.set_viewport_size({'width': vw, 'height': vh}); await pg.wait_for_timeout(400)
            o = await pg.evaluate(OVER); jt = await pg.evaluate(JT) if vw > 400 else []
            check('%s: kein Überlauf, Touch ≥ 44 px' % nm, not o and not jt and await pg.evaluate("document.scrollingElement.scrollWidth-innerWidth") <= 1, (o, jt))
            await pg.evaluate("document.getElementById('pcKT5').scrollIntoView()"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT + '_' + nm + '.png')
        check('Keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        c2 = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await c2.new_page(); e2 = []
        pg.on('pageerror', lambda e: e2.append(str(e)))
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(1200); await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        t = await pg.evaluate("[...document.querySelectorAll('#pcSecKurs [data-ktool]')].map(b=>b.textContent).join('|')")
        check('EN: Werkzeuge englisch', 'Ear training' in t and 'Technique' in t and 'Tunings' in t, t)
        check('EN ohne Skriptfehler', not e2, e2[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
