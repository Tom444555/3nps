# v120: Reiter „Powerchords“ – Prüfliste 2.7 der Vorgabe (powerchord-reiter) plus Üben/Looper, Schritt-für-Schritt, alle Stufen
import asyncio, os, re, json
from playwright.async_api import async_playwright
from nav import tab as open_tab
U = os.environ.get('U', 'http://localhost:8765/index.html')
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
# Vorgabe Abschnitt 3: Grundtöne E-/A-Saite Bund 0–12
TABLE = [('E','A'),('F','A#/Bb'),('F#/Gb','H'),('G','C'),('G#/Ab','C#/Db'),('A','D'),('A#/Bb','D#/Eb'),('H','E'),('C','F'),('C#/Db','F#/Gb'),('D','G'),('D#/Eb','G#/Ab'),('E','A')]
PCN = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'H':11,'B':11}
def pc_of(name):
    m = re.match(r'^([A-H])(#|b)?', name); return (PCN[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)) % 12
# Touch-Ziele und waagrechtes Scrollen im sichtbaren Bereich
JT = """()=>{const p=document.getElementById('panel-power');const bad=[];p.querySelectorAll('button,select,label.check,summary,input[type=range]').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||e.closest('[hidden]'))return;if(e.closest('.pc-chord'))return;
 if(r.height<43.5||(r.width<43.5&&e.tagName!=='SUMMARY'))bad.push((e.id||e.textContent.trim().slice(0,18)||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height));});
 p.querySelectorAll('.pc-chord').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height<43.5)bad.push('chord');});
 const c=[...p.querySelectorAll('.pc-cell')].find(x=>x.getBoundingClientRect().width>0);if(c){const r=c.getBoundingClientRect();if(r.width<43.5||r.height<43.5)bad.push('cell '+Math.round(r.width)+'x'+Math.round(r.height));}
 return bad;}"""
HS = "document.scrollingElement.scrollWidth - innerWidth"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(U); await pg.wait_for_timeout(1300)
        # --- träge: vor dem Öffnen ist der Reiter leer, die Logik aber da ---
        check('Reiter vorhanden, Inhalt erst beim Öffnen', await pg.evaluate("!!document.getElementById('tab-power') && document.getElementById('pcSecTheorie').children.length===0 && !document.getElementById('pcBoard') && !!window.Powerchords"))
        await open_tab(pg, 'power'); await pg.wait_for_timeout(500)
        await pg.click('#pcSubs [data-sec=theorie]'); await pg.wait_for_timeout(300)   # v129: Start ist der Kurs
        check('Theorie, 1-5-8 oben und aufgeklappt', await pg.evaluate("(()=>{const d=document.querySelector('#pcSecTheorie details');return !document.getElementById('pcSecTheorie').hidden && d.id==='pcT1' && d.open && /1-5-8-Theorie/.test(d.querySelector('summary').textContent)})()"))
        check('Theorie wörtlich (Merksatz, Tabs, Spieltechnik)', await pg.evaluate("(()=>{const t=document.getElementById('pcSecTheorie').textContent;return t.includes('„Zwei Bünde höher, eine Saite höher“ gilt, bis die H-Saite im Spiel ist. Dort ein Bund mehr.')&&t.includes('Palm Mute')&&document.querySelectorAll('#pcSecTheorie pre.pc-tab').length>=10&&!!document.querySelector('#pcSecTheorie [translate=no]')})()"))
        # --- 2.7: Grundton-Tabelle = Berechnung (Daten und angezeigte Tabelle) ---
        calc = await pg.evaluate("[...Array(13).keys()].map(f=>[Powerchords.calc({pc:(4+f)%12,s:0,n:2}).f%12===f%12&&Powerchords.calc({pc:(9+f)%12,s:1,n:2}).f%12===f%12, (4+f)%12, (9+f)%12])")
        check('Berechnung: Grundton-Bund = (PC − Leersaite) mod 12', all(c[0] for c in calc))
        check('Tabelle der Vorgabe passt zur Berechnung', all(pc_of(TABLE[f][0].split('/')[0]) == calc[f][1] and pc_of(TABLE[f][1].split('/')[0]) == calc[f][2] for f in range(13)))
        dom = await pg.evaluate("(()=>{const t=[...document.querySelectorAll('#pcT3 table')][0];return [...t.querySelectorAll('tbody tr')].map(r=>[...r.cells].map(c=>c.textContent.trim()))})()")
        check('Angezeigte Tabelle (Theorie 3) = Berechnung', len(dom) == 13 and all(pc_of(r[1]) == calc[int(r[0])][1] and pc_of(r[2]) == calc[int(r[0])][2] for r in dom), dom[:2])
        # --- 2.7: D-Saite 3-Ton: Oktave auf H bei n+3 ---
        d3 = await pg.evaluate("[...Array(12).keys()].map(pc=>{const c=Powerchords.calc({pc,s:2,n:3});const o=c.tones.find(t=>t.role==='8'),q=c.tones.find(t=>t.role==='5');return [o.s,o.f-c.f,q.s,q.f-c.f,o.midi-c.tones[0].midi,q.midi-c.tones[0].midi]})")
        check('D-Saite 3-Ton: Oktave auf H-Saite bei n+3 (für alle Grundtöne)', all(x == [4, 3, 3, 2, 12, 7] for x in d3), d3[:2])
        e3 = await pg.evaluate("[0,1].map(s=>[...Array(12).keys()].every(pc=>{const c=Powerchords.calc({pc,s,n:3});return c.tones[1].f-c.f===2&&c.tones[2].f-c.f===2&&c.tones[2].midi-c.tones[0].midi===12&&c.tones[1].midi-c.tones[0].midi===7}))")
        check('E/A-Saite: 5 und 8 je zwei Bünde höher, echte Quinte/Oktave', all(e3))
        await pg.click('#pcSubs [data-sec=brett]'); await pg.wait_for_timeout(300)
        await pg.click('#pcNotes [data-v="5"]'); await pg.click('#pcStr [data-v="2"]'); await pg.click('#pcN [data-v="3"]'); await pg.wait_for_timeout(200)
        tab = await pg.inner_text('#pcTab')
        check('Griffbrett: F5 auf D-Saite, Tab zeigt H|--6--| (Oktave n+3)', (await pg.inner_text('#pcName')) == 'F5' and 'H|--6--|' in tab and 'G|--5--|' in tab and 'D|--3--|' in tab, tab.split('\n')[:3])
        check('Töne mit Rolle', (await pg.inner_text('#pcTones')).replace('–', '-') == 'F (1) - C (5) - F (8)', await pg.inner_text('#pcTones'))
        # --- 2.7: Umkehrung bei E-Saite aus ---
        await pg.click('#pcStr [data-v="0"]'); await pg.wait_for_timeout(150)
        check('Umkehrung auf der E-Saite ausgegraut mit Hinweis', await pg.evaluate("document.getElementById('pcInv').disabled") and 'nicht möglich' in await pg.inner_text('#pcInvHint'))
        await pg.click('#pcStr [data-v="1"]'); await pg.click('#pcNotes [data-v="2"]'); await pg.click('#pcN [data-v="2"]'); await pg.wait_for_timeout(100)
        check('Umkehrung auf A aktiv', not await pg.evaluate("document.getElementById('pcInv').disabled"))
        await pg.click('#pcInv'); await pg.wait_for_timeout(150)
        inv = await pg.evaluate("Powerchords.calc({pc:2,s:1,n:2,inv:true})")
        check('Umkehrung D5/A: Quinte unten im gleichen Bund, Name als Slash', (await pg.inner_text('#pcName')) == 'D5/A' and [(t['s'], t['f'], t['role']) for t in inv['tones']] == [(0, 5, '5'), (1, 5, '1')])
        check('Umkehrung 3-Ton G5/D: 5-1-5', [(t['s'], t['f'], t['role']) for t in (await pg.evaluate("Powerchords.calc({pc:7,s:2,n:3,inv:true})"))['tones']] == [(1, 5, '5'), (2, 5, '1'), (3, 7, '5')])
        check('Calc ignoriert Umkehrung auf E', await pg.evaluate("Powerchords.calc({pc:7,s:0,n:2,inv:true}).inv===false"))
        await pg.click('#pcInv'); await pg.click('#pcStr [data-v="0"]'); await pg.wait_for_timeout(100)
        # Tippen auf die Grundton-Saite wählt den Grundton
        await pg.evaluate("document.querySelector('#pcBoard .pc-cell[data-s=\"0\"][data-f=\"5\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))"); await pg.wait_for_timeout(150)
        check('Tippen auf E-Saite Bund 5 → A5, Notenknopf synchron', (await pg.inner_text('#pcName')) == 'A5' and await pg.evaluate("document.querySelector('#pcNotes [data-v=\"9\"]').classList.contains('active')"))
        check('Gedämpfte Saiten mit x', await pg.evaluate("document.querySelectorAll('#pcBoard .pc-x').length") == 4)
        await pg.click('#pcLab [data-v=name]'); await pg.wait_for_timeout(100)
        check('Schalter Notennamen: Punkte zeigen A und E', await pg.evaluate("[...document.querySelectorAll('#pcBoard .pc-m text')].map(t=>t.textContent).sort().join()") == 'A,E')
        await pg.click('#pcLab [data-v=num]')
        # --- Alle Stufen / alle Lagen ---
        await pg.click('#pcNotes [data-v="7"]'); await pg.click('#pcAll'); await pg.wait_for_timeout(150)
        st = await pg.evaluate("(()=>{const m=[...document.querySelectorAll('#pcBoard .pc-m')];const lab=m.map(g=>g.querySelector('text').textContent);return {n:m.length,a1:document.querySelectorAll('#pcBoard .pc-m.a1').length,set:[...new Set(lab)].sort()}})()")
        check('Alle Stufen: 6×13 Töne als Stufenzahl, 1 und 5 hervorgehoben', st['n'] == 78 and st['a1'] >= 5 and {'1', '2', '3', '4', '5', '6', '7', 'b3', 'b7'} <= set(st['set']), st)
        check('Stufe stimmt (G: H-Saite Bund 0 = 3, D-Saite Bund 3 = b7)', await pg.evaluate("(()=>{const t=(s,f)=>{const c=document.querySelector('#pcBoard .pc-cell[data-s=\"'+s+'\"][data-f=\"'+f+'\"]');const x=+c.getAttribute('x')+29,y=+c.getAttribute('y')+28;return [...document.querySelectorAll('#pcBoard .pc-m')].find(g=>Math.abs(+g.querySelector('circle').getAttribute('cx')-x)<1&&Math.abs(+g.querySelector('circle').getAttribute('cy')-y)<1).querySelector('text').textContent};return t(4,0)==='3'&&t(2,3)==='b7'&&t(0,3)==='1'&&t(1,5)==='5'})()"))
        await pg.click('#pcPos'); await pg.wait_for_timeout(150)
        pos = await pg.evaluate("[Powerchords.positions(7,2).length, document.querySelectorAll('#pcBoard .pc-pos').length]")
        check('Alle Lagen: jede 1-5-Position als Linie', pos[0] >= 5 and pos[1] == pos[0] + 1, pos)
        pv = await pg.evaluate("Powerchords.positions(7,3).every(P=>{const m=P.map(p=>[40,45,50,55,59,64][p.s]+p.f);return m[1]-m[0]===7&&(m.length<3||m[2]-m[0]===12)})")
        check('Alle Lagen klingen richtig (Quinte 7, Oktave 12 Halbtöne, auch über G–H)', pv)
        await pg.click('#pcAll'); await pg.click('#pcPos')
        # --- 2.7: Schreibweise Kreuz/b ---
        nm = await pg.evaluate("({F:Powerchords.prog('i-bvii-iv',5,'auto',2).chords.map(c=>c.name),E:Powerchords.prog('i-bvii-iv',4,'auto',2).chords.map(c=>c.name),Ev:Powerchords.prog('i-iv-v',4,'auto',2).chords.map(c=>c.name),G:Powerchords.prog('i-biii-iv',7,'auto',2).chords.map(c=>c.name),Fs:Powerchords.prog('i-bvii-iv',6,'auto',2).chords.map(c=>c.name),Bb:Powerchords.calc({pc:10,s:0,n:2}),Fis:Powerchords.calc({pc:6,s:0,n:2})})")
        check('b-Tonart F: F5 Eb5 Bb5', nm['F'] == ['F5', 'Eb5', 'Bb5'], nm['F'])
        check('Kreuz-Tonart E: E5 D5 A5 / E5 A5 H5', nm['E'] == ['E5', 'D5', 'A5'] and nm['Ev'] == ['E5', 'A5', 'H5'], nm['E'] + nm['Ev'])
        check('F#: F#5 E5 H5 · G I–bIII–IV: G5 Bb5 C5', nm['Fs'] == ['F#5', 'E5', 'H5'] and nm['G'] == ['G5', 'Bb5', 'C5'], nm['Fs'] + nm['G'])
        check('Griffbrett: Bb5 = Bb (1) – F (5), F#5 = F# (1) – C# (5)', nm['Bb']['name'] == 'Bb5' and nm['Bb']['fifth'] == 'F' and nm['Fis']['name'] == 'F#5' and nm['Fis']['fifth'] == 'C#')
        check('Notenknöpfe zeigen beide Schreibweisen', await pg.evaluate("[...document.querySelectorAll('#pcNotes button')].map(b=>b.textContent).join(' ')") == 'C C#/Db D D#/Eb E F F#/Gb G G#/Ab A A#/Bb H')
        # --- 2.7: Übergabe, alle Tonarten × Folgen ---
        ho = await pg.evaluate("Powerchords.handoff(Powerchords.prog('i-bvii-iv',9,'auto',3),100,3)")
        check('A I–bVII–IV = A5 G5 D5 (Übergabe)', [c['name'] for c in ho['chords']] == ['A5', 'G5', 'D5'] and [c['rootPc'] for c in ho['chords']] == [9, 7, 2] and ho['bpm'] == 100 and ho['type'] == 'powerchord-progression' and ho['barsPerChord'] == 1)
        allp = await pg.evaluate("""(()=>{const D={I:0,bIII:3,IV:5,V:7,bVI:8,bVII:10},bad=[];let n=0;
          for(const P of Powerchords.data.PROGS)for(let k=0;k<12;k++)for(const n3 of [2,3]){const auto=Powerchords.prog(P.id,k,'auto',n3);
            for(const mode of ['auto',0,1,2]){const r=Powerchords.prog(P.id,k,mode,n3);
              r.chords.forEach((c,i)=>{n++;const want=(k+D[P.degrees[i]])%12;const r1=c.tones.find(t=>t.role==='1'),r5=c.tones.find(t=>t.role==='5'),r8=c.tones.find(t=>t.role==='8');
                if(c.rootPc!==want||r1.midi%12!==want||(r5.midi-r1.midi)!==7||(r8&&r8.midi-r1.midi!==12)||(mode==='auto'&&(c.tones.some(t=>t.f<0||t.f>12)))||(mode!=='auto'&&c.rootString!==mode))bad.push([P.id,k,mode,c.name]);});
              if(mode!=='auto'&&r.chords.every(c=>!c.warn)&&auto.path>r.path)bad.push(['weg',P.id,k,mode,auto.path,r.path]);}}
          return {n,bad:bad.slice(0,5)};})()""")
        check('Alle Tonarten × Folgen × Saiten: richtige Grundtöne, Quinte, Oktave, Auto-Weg minimal', not allp['bad'] and allp['n'] == 4 * 12 * 2 * 4 * 3, allp)
        names = await pg.evaluate("(()=>{const out=[];for(const P of Powerchords.data.PROGS)for(let k=0;k<12;k++)Powerchords.prog(P.id,k,'auto',2).chords.forEach(c=>out.push([c.name,c.rootPc]));return out})()")
        check('Akkordnamen (Buchstabe + Vorzeichen) passen zum Grundton', all(pc_of(n_) == pc and re.match(r'^[A-H](#|b)?5$', n_) for n_, pc in names), [x for x in names if pc_of(x[0]) != x[1]][:4])
        # --- Akkordfolgen-Oberfläche ---
        await pg.click('#pcSubs [data-sec=folgen]'); await pg.wait_for_timeout(200)
        await pg.select_option('#pcKey', '9'); await pg.click('#pcMode [data-v=auto]'); await pg.wait_for_timeout(150)
        check('Folge in A: Anzeige A5 – G5 – D5, Weg und Saiten', (await pg.inner_text('#pcFNames')).replace('–', '-') == 'A5 - G5 - D5' and re.search(r'Weg: \d+ B', await pg.inner_text('#pcPath')) and await pg.evaluate("document.querySelectorAll('#pcChords .pc-chord svg').length") == 3)
        await pg.click('#pcMode [data-v="0"]'); await pg.wait_for_timeout(100)
        check('Feste E-Saite: weite Wege (A5 Bund 5, G5 Bund 3, D5 Bund 10)', 'Weg: 9' in await pg.inner_text('#pcPath') and 'Bund 10' in await pg.inner_text('#pcChords'), await pg.inner_text('#pcPath'))
        await pg.click('#pcMode [data-v=auto]')
        await pg.click('#pcChords .pc-chord:nth-child(2)'); await pg.wait_for_timeout(250)
        check('Akkord antippen → Griffbrett mit G5', not await pg.evaluate("document.getElementById('pcSecBrett').hidden") and (await pg.inner_text('#pcName')) == 'G5')
        # --- Senden an den Looper ---
        await pg.click('#pcSubs [data-sec=folgen]'); await pg.wait_for_timeout(150)
        for _ in range(2): await pg.click('#pcBpmU')
        check('BPM-Stepper +5', await pg.inner_text('#pcBpmV') == '100')
        await pg.click('#pcSend'); await pg.wait_for_timeout(700)
        s = await pg.evaluate("({bpm:+document.getElementById('bpm').value,tab:document.getElementById('tab-looper').getAttribute('aria-selected'),L:Looper._prac().tracks[0].L,sr:audioCtx.sampleRate,busy:Looper.busy(),h:window.__pcHandoff,stat:document.getElementById('loopStatus').textContent})")
        check('An Looper senden: BPM 100, Looper-Reiter, Spur 1 = 3 Takte', s['bpm'] == 100 and s['tab'] == 'true' and s['L'] == 3 * round(4 * 60 / 100 * s['sr']) and s['busy'], {k: s[k] for k in ('bpm', 'tab', 'L', 'busy')})
        check('Übergabe-Daten: Folge, Tonart, Akkorde', s['h']['progressionId'] == 'i-bvii-iv' and s['h']['keyPc'] == 9 and [c['name'] for c in s['h']['chords']] == ['A5', 'G5', 'D5'] and 'A5' in s['stat'])
        # Üben-Anzeige läuft im Powerchords-Reiter mit
        await open_tab(pg, 'power'); await pg.wait_for_timeout(300)
        seen = set(); hl = set()
        for _ in range(26):
            await pg.wait_for_timeout(250)
            v = await pg.evaluate("[(document.getElementById('pcNow')||{}).textContent,[...document.querySelectorAll('#pcChords .pc-chord')].findIndex(b=>b.classList.contains('now')),document.querySelectorAll('#pcPlayBoard .pc-m').length,(document.getElementById('pcNext')||{}).textContent]")
            seen.add((v[0], v[3])); hl.add(v[1])
        check('Üben: „jetzt / als Nächstes“ läuft mit (A5→G5→D5)', ('A5', 'G5') in seen and ('G5', 'D5') in seen, sorted(seen))
        check('Aktueller Akkord in der Liste hervorgehoben', {0, 1} <= hl, hl)
        check('Griff des aktuellen Akkords auf dem Griffbrett', await pg.evaluate("document.querySelectorAll('#pcPlayBoard .pc-m').length") == 2)
        L0 = await pg.evaluate("Looper._prac().tracks[0].L")
        await pg.click('#pcTU'); await pg.wait_for_timeout(600)
        s2 = await pg.evaluate("({bpm:+document.getElementById('bpm').value,L:Looper._prac().tracks[0].L,sr:audioCtx.sampleRate,p:Powerchords.playing()})")
        check('Tempo +5: Loop neu im Tempo 105', s2['bpm'] == 105 and s2['L'] == 3 * round(4 * 60 / 105 * s2['sr']) and s2['L'] != L0 and s2['p']['bpm'] == 105)
        check('Knopf „Spur 2 aufnehmen“ vorhanden', await pg.evaluate("!!document.getElementById('pcRec')"))
        await pg.click('#pcStop'); await pg.wait_for_timeout(400)
        check('Stopp: Looper still, Anzeige weg', not await pg.evaluate("Looper.busy()") and await pg.evaluate("document.getElementById('pcPlay').hidden"))
        # Backing Track (Jam)
        await pg.click('#pcJam'); await pg.wait_for_timeout(2600)
        j = await pg.evaluate("({a:Jam.active(),seq:Jam.state().seq.map(c=>[c.r,c.t,c.beats]),p:Powerchords.playing(),now:(document.getElementById('pcNow')||{}).textContent})")
        check('Als Backing abspielen: Backing Track spielt A5 G5 D5', j['a'] and j['seq'] == [[9, '5', 4], [7, '5', 4], [2, '5', 4]] and j['p']['mode'] == 'jam' and j['now'] in ('A5', 'G5', 'D5'), j)
        await pg.click('#pcStop'); await pg.wait_for_timeout(300)
        check('Backing gestoppt', not await pg.evaluate("Jam.active()"))
        # --- Übungen ---
        await pg.click('#pcSubs [data-sec=uebungen]'); await pg.wait_for_timeout(200)
        check('6 Übungen, Gesamtfortschritt 0 von 6', await pg.evaluate("document.querySelectorAll('.pc-ex').length") == 6 and (await pg.inner_text('#pcExSum')).startswith('0 von 6'))
        await pg.click('#pcEx_ex1 input[type=checkbox]'); await pg.click('#pcEx_ex2 button[data-a=u]'); await pg.click('#pcEx_ex2 button[data-a=u]'); await pg.click('#pcEx_ex2 button[data-a=best]'); await pg.wait_for_timeout(100)
        await pg.click('#pcEx_ex4 button[data-a=go]'); await pg.wait_for_timeout(700)
        e4 = await pg.evaluate("({p:Powerchords.playing(),bpm:+document.getElementById('bpm').value})")
        check('Übung 4 „Mit Looper starten“: E5 E5 D5 A5 bei Start-BPM 70', e4['p'] and e4['p']['names'] == ['E5', 'E5', 'D5', 'A5'] and e4['bpm'] == 70 and e4['p']['ex'] == 'ex4', e4)
        await pg.click('#pcTU'); await pg.wait_for_timeout(500)
        check('Tempo +5 in der Übung wird gemerkt (75)', await pg.evaluate("Powerchords.progress().exercises.ex4.bpm") == 75 and await pg.evaluate("+document.getElementById('bpm').value") == 75)
        await pg.click('#pcStop'); await pg.wait_for_timeout(300)
        r5 = await pg.evaluate("Powerchords.exSeq('ex5').chords.map(c=>c.name+'@'+c.rootString+':'+c.rootFret)")
        check('Übung 5: gleiche Folge einmal E-, einmal A-Saite', r5 == ['A5@0:5', 'G5@0:3', 'D5@0:10', 'A5@1:0', 'G5@1:10', 'D5@1:5'], r5)
        check('Speicher powerchords.progress.v1 (done, bestBpm)', await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('powerchords.progress.v1'));return d.version===1&&d.exercises.ex1.done===true&&d.exercises.ex2.bestBpm===70&&d.exercises.ex3.bestBpm===null&&!!d.updated})()"))
        await pg.reload(); await pg.wait_for_timeout(1200)
        if await pg.evaluate("document.getElementById('panel-power').hidden"): await open_tab(pg, 'power')
        await pg.wait_for_timeout(300)
        check('Nach Neustart: Reiter, Bereich und Fortschritt erhalten', await pg.evaluate("!document.getElementById('pcSecUebungen').hidden") and (await pg.inner_text('#pcExSum')).startswith('1 von 6') and await pg.evaluate("document.querySelector('#pcEx_ex1 input').checked") and 'Bestes Tempo: 70' in await pg.inner_text('#pcEx_ex2'))
        await pg.click('#pcExReset'); await pg.wait_for_timeout(300)
        check('Zurücksetzen (mit Rückfrage)', (await pg.inner_text('#pcExSum')).startswith('0 von 6') and await pg.evaluate("!JSON.parse(localStorage.getItem('powerchords.progress.v1')).exercises.ex1.done"))
        # --- Schritt für Schritt ---
        await pg.click('#pcSubs [data-sec=schritte]'); await pg.wait_for_timeout(200)
        while await pg.evaluate("document.getElementById('pcStPrev').disabled") is False: await pg.click('#pcStPrev')
        a = await pg.evaluate("document.querySelectorAll('#pcStBoard .pc-m').length"); await pg.wait_for_timeout(3600)
        b2 = await pg.evaluate("[...document.querySelectorAll('#pcStBoard .pc-m text')].map(t=>t.textContent).join()")
        check('Schritt 1 animiert: Dur-Tonleiter 1…8 erscheint nacheinander', a == 1 and b2 == '1,2,3,4,5,6,7,8', (a, b2))
        labs = []
        for i in range(5):
            await pg.click('#pcStNext'); await pg.wait_for_timeout(3700 if i == 0 else 1300)
            labs.append(await pg.evaluate("[document.getElementById('pcStT').textContent,[...document.querySelectorAll('#pcStBoard .pc-m')].map(g=>g.getAttribute('class').replace('pc-m ','')+':'+g.querySelector('text').textContent).join()]"))
        check('Schritt 2: Quinte nach 7 Halbtönen', 'r5:5' in labs[0][1], labs[0])
        check('Schritt 4: H-Saite ein Bund mehr (8 bei n+3, × bei n+2)', 'bad:×' in labs[2][1] and 'r8:8' in labs[2][1] and 'H-Saite' in labs[2][0], labs[2])
        check('Schritt 6: Dur/Moll/Powerchord zum Vergleich anhörbar', await pg.evaluate("!document.getElementById('pcStMaj').hidden&&!document.getElementById('pcStMin').hidden") and 'dx3 b3:b3' in labs[4][1])
        await pg.click('#pcStMin'); await pg.wait_for_timeout(100)
        check('Moll-Knopf markiert 1-b3-5-8', await pg.evaluate("[...document.querySelectorAll('#pcStBoard .pc-m text')].map(t=>t.textContent).sort().join()") == '1,5,8,b3')
        await pg.click('#pcStPrev'); await pg.wait_for_timeout(1500)
        c1 = await pg.inner_text('#pcStCap'); await pg.wait_for_timeout(1500); c2 = await pg.inner_text('#pcStCap')
        check('Schritt 5: Form wandert (G5 → A5 …)', c1 != c2 and c1 and c2, (c1, c2))
        # --- Touch-Ziele und Hoch-/Querformat ---
        for vw, vh, tag in [(1180, 820, 'quer'), (820, 1180, 'hoch')]:
            await pg.set_viewport_size({'width': vw, 'height': vh}); await pg.wait_for_timeout(250)
            bad = []; hs = []
            for sec in ['theorie', 'schritte', 'brett', 'folgen', 'uebungen']:
                await pg.click('#pcSubs [data-sec=%s]' % sec); await pg.wait_for_timeout(250)
                if sec == 'brett': await pg.click('#pcAll'); await pg.wait_for_timeout(100)
                bad += [sec + ':' + x for x in await pg.evaluate(JT)]; hs.append(await pg.evaluate(HS))
                if sec == 'brett': await pg.click('#pcAll')
            check('Touch-Ziele ≥ 44 px (' + tag + ')', not bad, bad[:6])
            check('Kein waagrechtes Scrollen (' + tag + ')', max(hs) <= 0, hs)
        # Hell
        await pg.evaluate("document.documentElement.dataset.theme='light'"); await pg.click('#pcSubs [data-sec=brett]'); await pg.wait_for_timeout(200)
        check('Helle Optik: Griffbrett sichtbar', await pg.evaluate("!!document.querySelector('#pcBoard .pc-skin rect[fill^=url]') && getComputedStyle(document.querySelector('#panel-power .card')).backgroundColor!==''"))
        check('Keine Skriptfehler', not errs, errs[:3])
        await ctx.close()
        # --- Englisch: Bedienelemente übersetzt, Theorie bleibt deutsch (translate=no) ---
        c2 = await b.new_context(viewport={'width': 1180, 'height': 820}); pg = await c2.new_page(); e2 = []
        pg.on('pageerror', lambda e: e2.append(str(e)))
        await pg.goto(U + '?lang=en'); await pg.wait_for_timeout(1200); await open_tab(pg, 'power'); await pg.wait_for_timeout(500)
        tx = await pg.evaluate("[document.getElementById('tab-power').textContent,[...document.querySelectorAll('#pcSubs button')].map(b=>b.textContent).join('|')]")
        check('EN: Reiter und Bereiche englisch', tx[0] == 'Power chord course' and 'Theory' in tx[1] and 'Exercises' in tx[1], tx)
        await pg.click('#pcSubs [data-sec=brett]'); await pg.wait_for_timeout(300)
        check('EN: H heißt B, Bedienelemente englisch', 'B' in await pg.inner_text('#pcNotes') and 'Show all degrees' in await pg.inner_text('#pcSecBrett'))
        check('EN ohne Skriptfehler', not e2, e2[:3])
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
