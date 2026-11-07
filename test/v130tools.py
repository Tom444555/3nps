# v130: Notenkarte (alle Tonnamen, in jedem Griffbrett, gespeichert), Griff-Tabelle je Kapitel, Akkordsymbole lesen (inkl. Slash),
# Begriffslexikon (aus dem Text antippbar), Landkarte, Tonleitern/Tonarten/Stufenakkorde – Töne nachgerechnet, kein Überlauf, EN
import asyncio, os, re
from playwright.async_api import async_playwright
U = os.environ.get('U', 'http://localhost:8765/index.html')
SHOT = os.environ.get('SHOT', '/tmp/v130tools')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--autoplay-policy=no-user-gesture-required']
NPC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11, 'H': 11}
def pcn(n): return (NPC[n[0]] + n[1:].count('#') - n[1:].count('b')) % 12
OVER = """()=>{const h=document.getElementById('pcSecKurs'),R=h.getBoundingClientRect().right,bad=[];h.querySelectorAll('.pc-ktools *').forEach(e=>{if(e.closest('svg')||e.closest('[hidden]')||e.closest('details:not([open])')||e.closest('.pc-tbl'))return;const r=e.getBoundingClientRect();if(!r.width)return;
 if(r.right>R+1)bad.push(e.tagName+'.'+e.className+' '+Math.round(r.right-R));if(/^(P|LI|SPAN|LABEL|H3|H4|B|DIV|BUTTON|TD)$/.test(e.tagName)&&e.scrollWidth>e.clientWidth+1&&!/hidden|auto|scroll/.test(getComputedStyle(e).overflowX)&&e.clientWidth&&!e.closest('.pc-tbl'))bad.push('scroll '+e.tagName+'.'+e.className);});
 document.querySelectorAll('#pcSecKurs .pc-tbl').forEach(t=>{if(t.getBoundingClientRect().right>R+1)bad.push('tbl');});return bad.slice(0,6);}"""
JT = """()=>{const p=document.querySelector('#pcSecKurs .pc-ktools');const bad=[];p.querySelectorAll('button,summary,input').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||e.closest('[hidden]'))return;if(r.height<43.5||(r.width<43.5&&e.tagName!=='SUMMARY'))bad.push((e.textContent.trim().slice(0,14)||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height));});return bad.slice(0,5);}"""
SYMS = {'C': [0, 4, 7], 'Cmaj7': [0, 4, 7, 11], 'Am7b5': [9, 0, 3, 7], 'E7#9': [4, 8, 11, 2, 7], 'Bb6': [10, 2, 5, 7], 'Gsus4': [7, 0, 2], 'F#m7': [6, 9, 1, 4], 'Ebmaj7(9)': [3, 7, 10, 2, 5],
        'C°7': [0, 3, 6, 9], 'Cø': [0, 3, 6, 10], 'A7b9': [9, 1, 4, 7, 10], 'G13': [7, 11, 2, 5, 4], 'Dm(add9)': [2, 5, 9, 4], 'Bbsus2': [10, 0, 5], 'E5': [4, 11], 'Am6': [9, 0, 4, 6], 'D7sus2': [2, 4, 9, 0], 'Cm(maj7)': [0, 3, 7, 11], 'Caug': [0, 4, 8], 'C7#5': [0, 4, 8, 10], 'Fmaj7#11': [5, 9, 0, 4, 11]}
SLASH = {'D/F#': ([2, 6, 9], 6), 'C/E': ([0, 4, 7], 4), 'G/B': ([7, 11, 2], 11), 'Am7/G': ([9, 0, 4, 7], 7)}
SCALES = {0: 'A B C# D E F# G#', 1: 'A B C D E F G', 2: 'A B C D E F G#', 3: 'A B C D E F# G', 4: 'A B C# D# E F# G#'}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1300)
        check('Version ab v130', int(re.search(r'v(\d+)', await pg.inner_text('.brand')).group(1)) >= 130)
        await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        check('Werkzeuge träge: Inhalte erst beim Öffnen', await pg.evaluate("document.querySelectorAll('#pcSecKurs .pc-ktool').length>=4 && [...document.querySelectorAll('#pcSecKurs .pc-ktool .pc-sec-b')].every(x=>!x.children.length)"))
        # Notenkarte
        await pg.click('#pcSubs [data-sec=brett]'); await pg.wait_for_timeout(300)
        n0 = await pg.evaluate("document.querySelectorAll('#pcSecBrett .pc-nn').length")
        await pg.click('#pcNotesBtn'); await pg.wait_for_timeout(200)
        nn = await pg.evaluate("[...document.querySelectorAll('#pcSecBrett svg.pc-board .pc-nn')].map(t=>[+t.dataset.s,+t.dataset.f,t.textContent])")
        M0 = [40, 45, 50, 55, 59, 64]; NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H']
        bad = [x for x in nn if NM[(M0[x[0]] + x[1]) % 12] != x[2]]
        check('Notenkarte: alle Tonnamen auf dem Griffbrett, richtig', n0 == 0 and len(nn) > 60 and not bad, (n0, len(nn), bad[:3]))
        await pg.click('#pcSubs [data-sec=kurs]'); await pg.wait_for_timeout(200)
        await pg.evaluate("document.getElementById('pcKC15').open=true;document.getElementById('pcKC3').open=true"); await pg.wait_for_timeout(600)
        dd = await pg.evaluate("[...document.querySelectorAll('#pcK_k15-1 .pc-kstage .pc-nn')].filter(t=>t.dataset.s==='0').map(t=>[+t.dataset.f,t.textContent])")
        check('Notenkarte in Kurs-Griffbrettern, auch in Drop D (tiefe Saite D)', dd and all(NM[(38 + f) % 12] == t for f, t in dd), dd[:4])
        check('Notenkarte auch in der Werkstatt', await pg.evaluate("document.querySelectorAll('#pcKC3 .pc-wb .pc-nn').length") > 40)
        await pg.reload(); await pg.wait_for_timeout(1300); await pg.click('#tab-power'); await pg.wait_for_timeout(300)
        check('Notenkarte bleibt nach Neustart an', await pg.evaluate("document.getElementById('pcNotesBtn').getAttribute('aria-pressed')==='true' && window.__pcNotes===true"))
        await pg.click('#pcNotesBtn'); await pg.wait_for_timeout(100)
        check('Notenkarte aus: keine Namen', await pg.evaluate("document.querySelectorAll('#panel-power .pc-nn').length===0"))
        # Griff-Tabellen
        await pg.evaluate("document.querySelectorAll('#pcSecKurs details.pc-kc').forEach(d=>d.open=true)"); await pg.wait_for_timeout(1500)
        tb = await pg.evaluate("[...Array(15).keys()].map(i=>{const d=document.getElementById('pcKC'+(i+1)).querySelector('.pc-ktab');return d?d.querySelectorAll('tbody tr').length:0})")
        check('Griff-Tabelle in allen 15 Kapiteln (Kap. 13: %d Griffe)' % tb[12], all(n > 0 for n in tb) and tb[12] >= 7, tb)
        rows = await pg.evaluate("[...document.querySelectorAll('#pcSecKurs tr[data-kpick]')].map(r=>{const [c,s,g]=r.dataset.kpick.split('.').map(Number),G=PcKurs.K[c].s[s].g[g],fr=G.fr||PcKurs.CH[G.n];return [r.cells[1].textContent,fr.map(f=>f==null?'x':f>9?'('+f+')':String(f)).join('')]})")
        check('Griff-Tabellen: Griffschrift = Griff (%d Zeilen)' % len(rows), len(rows) > 150 and all(a == b for a, b in rows))
        await pg.evaluate("document.querySelector('#pcKC8 .pc-ktab').open=true"); await pg.evaluate("document.querySelector('#pcKC8 tr[data-kpick]').scrollIntoView()")
        await pg.click('#pcKC8 tr[data-kpick$=".3"]'); await pg.wait_for_timeout(400)
        check('Tabellenzeile zeigt den Griff auf dem großen Griffbrett', 'Cm7b5' in await pg.evaluate("[...document.querySelectorAll('#pcKC8 .pc-kstn')].map(x=>x.textContent).join('|')"))
        # Akkordsymbole
        res = await pg.evaluate("Object.fromEntries(%s.map(s=>[s,PcExtra.parse(s)]))" % str(list(SYMS) + list(SLASH)))
        bad = [s for s, v in SYMS.items() if not res[s] or sorted(res[s]['pcs']) != sorted(set(v))]
        bad += [s for s, (v, bs) in SLASH.items() if not res[s] or res[s]['bass'] != bs or sorted(res[s]['pcs']) != sorted(set(v + [bs]))]
        bad += [s + ' ' + n['ton'] for s in res for n in res[s]['notes'] if pcn(n['ton']) != (res[s]['root'] + n['n']) % 12]
        check('Akkordsymbole: %d Symbole inkl. Slash nachgerechnet (Töne und Namen)' % len(res), not bad, bad[:4])
        check('Schreibweise: E7#9 = E G# B D G, D/F# Bass F#', [n['ton'] for n in res['E7#9']['notes']] == ['E', 'G#', 'B', 'D', 'G'] and res['D/F#']['bassName'] in ('F#', 'Gb'))
        await pg.click('#pcSecKurs [data-ktool=pcKT1]'); await pg.wait_for_timeout(400)
        await pg.fill('#pcSymIn', 'Am7b5'); await pg.click('#pcKT1 [data-sym=go]'); o = await pg.inner_text('#pcKT1 .pc-symout')
        check('Eingabe erklärt: Am7b5 → halbvermindert, Töne', 'halbvermindert' in o and 'Eb' in o and 'b5' in o, o[:80])
        await pg.evaluate("window.__n=0;const o=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){window.__n++;return o.call(this)};0")
        await pg.click('#pcKT1 tr[data-sym="D/F#"]'); await pg.wait_for_timeout(200)
        check('Tabelle: ≥ 30 Symbole, Slash-Zeile spielt und erklärt', await pg.evaluate("document.querySelectorAll('#pcKT1 tbody tr').length") >= 30 and await pg.evaluate("window.__n") > 0 and 'über' in await pg.inner_text('#pcKT1 .pc-symout'))
        # Lexikon
        await pg.click('#pcSecKurs [data-ktool=pcKT2]'); await pg.wait_for_timeout(300)
        n = await pg.evaluate("[document.querySelectorAll('#pcKT2 .pc-gli').length, document.querySelectorAll('#pcSecKurs .pc-kbody .pc-gl').length]")
        check('Lexikon: ≥ 45 Begriffe, im Kurstext antippbar (%d Stellen)' % n[1], n[0] >= 45 and n[1] >= 40, n)
        await pg.evaluate("document.querySelector('#pcKC8 .pc-kbody .pc-gl').scrollIntoView({block:'center'})"); await pg.click('#pcKC8 .pc-kbody .pc-gl'); await pg.wait_for_timeout(200)
        pop = await pg.evaluate("[!document.getElementById('pcGlPop').hidden, document.getElementById('pcGlPop').textContent]")
        check('Begriff antippen zeigt Erklärung', pop[0] and len(pop[1]) > 30, pop[1][:60])
        await pg.screenshot(path=SHOT + '_lexikon.png')
        await pg.evaluate("document.getElementById('pcKC2').open=false"); await pg.evaluate("[...document.querySelectorAll('#pcKT2 .pc-gli')].find(x=>x.textContent.startsWith('Powerchord')).querySelector('[data-kref]').click()"); await pg.wait_for_timeout(300)
        check('Lexikon → Kapitel öffnen', await pg.evaluate("document.getElementById('pcKC2').open"))
        # Landkarte
        await pg.click('#pcSecKurs [data-ktool=pcKT3]'); await pg.wait_for_timeout(300)
        check('Landkarte: 6 Bereiche mit Kapitel-Knöpfen', await pg.evaluate("document.querySelectorAll('#pcKT3 .pc-mapc').length===6 && document.querySelectorAll('#pcKT3 .pc-mapi').length>=18"))
        await pg.evaluate("document.getElementById('pcKC14').open=false"); await pg.evaluate("document.querySelector('#pcKT3 .pc-mapi[data-kref=\"14\"]').click()"); await pg.wait_for_timeout(300)
        check('Landkarte → Kapitel 14', await pg.evaluate("document.getElementById('pcKC14').open"))
        # Tonleitern
        await pg.click('#pcSecKurs [data-ktool=pcKT4]'); await pg.wait_for_timeout(300)
        sc = []
        for i in range(5):
            await pg.click('#pcKT4 [data-sc="%d"]' % i); t = await pg.inner_text('#pcKT4 .pc-scinfo')
            notes = await pg.evaluate("[...document.querySelectorAll('#pcKT4 .pc-scb .pc-m')].length")
            sc.append((SCALES[i] in t, notes == 8))
        check('Tonleitern: Dur, Moll, harmonisch Moll, dorisch, lydisch – Töne von A stimmen, 8 Punkte', all(a and b for a, b in sc), sc)
        await pg.click('#pcKT4 [data-key=G]'); t = await pg.inner_text('#pcKT4 .pc-degtab')
        check('Stufenakkorde in G: G Am Bm C D Em F#m(b5) / Gmaj7 … F#m7b5', all(x in t for x in ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#m(b5)', 'Gmaj7', 'Am7', 'Bm7', 'Cmaj7', 'D7', 'Em7', 'F#m7b5']), t[:120])
        for vw, vh, nm in [(1366, 1024, 'quer'), (820, 1180, 'hoch'), (390, 844, '390')]:
            await pg.set_viewport_size({'width': vw, 'height': vh}); await pg.wait_for_timeout(400)
            o = await pg.evaluate(OVER); jt = await pg.evaluate(JT) if vw > 400 else []
            check('%s: Werkzeuge ohne Überlauf, Touch ≥ 44 px' % nm, not o and not jt and await pg.evaluate("document.scrollingElement.scrollWidth-innerWidth") <= 1, (o, jt))
            await pg.evaluate("document.getElementById('pcKT1').scrollIntoView()"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT + '_' + nm + '.png')
        check('Keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        c2 = await b.new_context(viewport={'width': 1366, 'height': 1024}); pg = await c2.new_page(); e2 = []
        pg.on('pageerror', lambda e: e2.append(str(e)))
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(1200); await pg.click('#tab-power'); await pg.wait_for_timeout(400)
        t = await pg.evaluate("[document.getElementById('pcNotesBtn').textContent,[...document.querySelectorAll('#pcSecKurs [data-ktool]')].map(b=>b.textContent).join('|')]")
        check('EN: Notenkarte und Werkzeuge englisch', t[0] == 'Note map' and 'Glossary' in t[1] and 'Scales' in t[1], t)
        check('EN ohne Skriptfehler', not e2, e2[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot))
asyncio.run(main())
