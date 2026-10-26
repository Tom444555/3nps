# v60: Englisch in allen Reitern (DE/EN-Vergleich), Songwriting mit eigenem Song: Oberfläche englisch, eigene Inhalte unverändert
import asyncio, re, json
from playwright.async_api import async_playwright
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info else ''))
TABS=['solo','caged','quinten','jam','lied','singen','hilfe','ueben','griffbrett']
J="""(id)=>{const out=new Set();const r=document.getElementById('panel-'+id);if(!r)return [];const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while((n=w.nextNode())){
 if(n.nodeType===3){const p=n.parentNode;if(p&&/SCRIPT|STYLE|TEXTAREA/.test(p.nodeName))continue;if(p&&p.closest&&p.closest('[translate=no]'))continue;const v=n.nodeValue.trim();if(v)out.add(v);}
 else for(const a of ['title','placeholder','aria-label']){const v=n.getAttribute(a);if(v)out.add('@'+v);}}return [...out];}"""
async def grab(b,q):
  pg=await (await b.new_context(viewport={'width':1180,'height':820})).new_page(); errs=[]
  pg.on('pageerror',lambda e:errs.append(str(e)))
  await pg.goto('http://localhost:8765/index.html'+q); await pg.wait_for_timeout(1200)
  res={}
  for t in TABS:
    await pg.click('#tab-'+t); await pg.wait_for_timeout(700)
    res[t]=set(await pg.evaluate(J,t))
  if False: await pg.click('#tab-'+sys.argv[1]); await pg.wait_for_timeout(500); await pg.screenshot(path='%s%s_%s.png'%('/tmp/claude-0/-home-claude-3nps/9e6f0204-48ae-57a7-a5e4-ec83ab90c972/scratchpad/',sys.argv[1],q[-2:] or 'de'),full_page=True)
  return res,errs
SONG={"active":"s1","songs":[{"id":"s1","name":"Auf der Straße","voice":{"preset":"tenor","lo":48,"hi":69},"cur":0,"versions":[{"n":1,"at":1,"note":"Start","key":{"pc":9,"major":False},"bpm":96,"theme":"Unterwegs",
 "parts":[{"id":"p1","name":"Strophe","type":"verse","chords":[{"r":9,"t":"m","beats":4},{"r":5,"t":"","beats":4},{"r":0,"t":"","beats":4},{"r":7,"t":"","beats":4}],"lyrics":["Ich fahr auf der Straße bis zum Ende\nund die Nacht ist lang"]},
          {"id":"p2","name":"Refrain","type":"chorus","chords":[{"r":5,"t":"","beats":4},{"r":0,"t":"","beats":4},{"r":7,"t":"","beats":4},{"r":9,"t":"m","beats":4}],"lyrics":["Danach kommt nichts mehr\nan der Grenze aus Licht"]}],
 "order":[{"p":"p1","reps":1},{"p":"p2","reps":1},{"p":"p1","reps":1},{"p":"p2","reps":2}]}]}]}
JL="""()=>{const out=new Set();const r=document.getElementById('panel-lied');const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while((n=w.nextNode())){
 if(n.nodeType===3){const p=n.parentNode;if(p&&/SCRIPT|STYLE|TEXTAREA/.test(p.nodeName))continue;if(p.closest('[translate=no]'))continue;const v=n.nodeValue.trim();if(v)out.add(v);}
 else for(const a of ['title','placeholder','aria-label']){const v=n.getAttribute(a);if(v&&!n.closest('[translate=no]'))out.add('@'+v);}}return [...out];}"""

SAME_OK = re.compile(r'^(@?(Swing|Name|Version|Tempo in BPM|Ghost Notes|Feel|Details|Analyzer|Low Cut|High Cut|Bass|Percussion|Rimshot|Pull|Push|Hi-Hat|Snare|Kick|Ride|Standard|Tom [12])|Master\u00ading|Mastering|Master|Original|True Peak|EBU R128 · ITU-R BS\.1770-4|Deezer \(−15 LUFS\)|Apple Music \(−16 LUFS\)|Spotify, YouTube, Amazon, TIDAL \(−14 LUFS\)|LUFS|dBTP|Auto|Blues|Arpeggio|Dominant 7|Major 7|Lick|Licks|Looper|Song|Drums|Bass|BPM|Beat|Loop|Kick|Snare|Clap|Ride|Rim|Shaker|Tom|Designer|Intro|Outro|Solo|Pre-Chorus|Start|Synth|Tempo|@Tempo|Fills|Neutral|Metal|Rock|Punk|Funk|Disco|House|Techno|Samba|Cumbia|Motown|Boogie|Breakbeat|Hip-Hop|Halftime|E-Piano|Position( \d)?|▶ Start|\d+ min|.*(Shuffle|Blues|Bossa|Stomp|Floor|Soul|Drop|Train Beat|12/8|Lo-Fi|·).*|.*\(.*–.*\)|[A-G][♯♭]?(m|maj|sus|add|°|7|9)*.*|[ivIV°]+)$')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        de, e1 = await grab(b, ''); en, e2 = await grab(b, '?lang=en')
        for t in TABS:
            same = sorted(x for x in de[t] & en[t] if re.search(r'[A-Za-zÄÖÜäöüß]{3}', x) and not SAME_OK.match(x))
            um = sorted(x for x in en[t] if re.search(r'[äöüßÄÖÜ]', x))
            check('EN ' + t + ': nichts Deutsches', not same and not um, (same + um)[:8])
        check('Reiter ohne Skriptfehler', not e1 and not e2, e1 + e2)
        pg = await (await b.new_context(viewport={'width': 1180, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('3nps-lieder', %s)" % json.dumps(json.dumps(SONG)))
        await pg.goto('http://localhost:8765/index.html?lang=en'); await pg.wait_for_timeout(1000)
        await pg.click('#tab-lied'); await pg.wait_for_timeout(800)
        await pg.click('#ldCheck'); await pg.wait_for_timeout(600)
        tx = set(await pg.evaluate(JL))
        de2 = sorted(x for x in tx if re.search(r'[äöüßÄÖÜ]|\b(und|der|die|das|ist|nicht|mit|zum|von|wird|oder|ein|eine|Tippe|noch|keine?|erst|dann|hier|im|bei|den|dem|des|sich|zu|du|Teil|Takte?|Mal)\b', x))
        check('Songwriting mit Song: englisch', not de2, de2[:8])
        check('Liedtext unverändert', 'Ich fahr auf der Straße bis zum Ende' in await pg.evaluate("[...document.querySelectorAll('.ld-txt')].map(t=>t.value).join('|')"))
        check('Songname unverändert', await pg.evaluate("document.getElementById('ldSong').selectedOptions[0].textContent") == 'Auf der Straße')
        check('Teilname im Ablauf unverändert', 'Strophe' in await pg.inner_text('#panel-lied'))
        pr = await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('3nps-lieder'));const s=d.songs[0];return LiedText.prompt(s,s.versions[0],'hook','',null)})()")
        check('Claude-Auftrag englisch, Format bleibt', pr.startswith('I am writing') and 'Make the chorus stronger' in pr and '=== 3NPS SONG-CODE v1 ===' in pr and 'Akkorde:' in pr, pr[:80])
        check('Leadsheet/Export: Bausteine englisch', await pg.evaluate("T('/LIES MICH.txt')==='/READ ME.txt' && T(' – Seite ')===' – page ' && T('A-Moll')==='A minor'"))
        check('Songwriting ohne Skriptfehler', not errs, errs)
        await b.close()
    print(f'{ok}/{tot}')
asyncio.run(main())
