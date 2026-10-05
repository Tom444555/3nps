import asyncio, json, os
from playwright.async_api import async_playwright
T='/home/claude/3nps/test/'
async def main():
    files=[(T+'corpus/'+f, 'song') for f in sorted(os.listdir(T+'corpus')) if f.endswith('.wav')]
    files+=[(T+'valid/'+f, 'song') for f in sorted(os.listdir(T+'valid')) if f.endswith('.wav')]
    files+=[(T+'loops/'+f, 'loop') for f in sorted(os.listdir(T+'loops')) if f.endswith('.wav')]
    files+=[(T+'hard/'+f, 'song') for f in sorted(os.listdir(T+'hard')) if f.endswith('.wav')]
    import sys
    if len(sys.argv) > 1: files=[f for f in files if any(a in f[0] for a in sys.argv[1:])]
    ok=0
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg=await b.new_page(viewport={'width':1024,'height':1366}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn','0')
        for path, kind in files:
            await pg.evaluate("for (let i=0;i<3;i++){const b=document.getElementById('clear'+i); b.click(); b.click();}")
            await pg.wait_for_timeout(150)
            await pg.set_input_files('#file0', path)
            st=''
            for _ in range(60):
                await pg.wait_for_timeout(250); st=await pg.inner_text('#loopStatus')
                if await pg.is_visible('#impDlg'): await pg.click('#impOk')
                if st.startswith('Spur 1:'): break
            d=await pg.evaluate('Looper.debug()'); tr=d['tracks'][0]; sr=d['sr']
            gt=json.load(open(path.replace('.wav','.json')))
            isLoop='Loop erkannt' in st
            good = (isLoop == (kind=='loop'))
            info=''
            if kind=='song' and tr['orig']:
                ends=gt['downbeats']+[gt['beats'][-1]+(gt['beats'][-1]-gt['beats'][-2])]
                devs=[min(abs(e-x/sr) for e in ends)*1000 for x in tr['orig']['downs']]
                half = abs(d['bpm']/gt['bpm']-0.5)<0.01
                tol = (60/gt['bpm']*1000*2+40) if half else 40   # bei halbem Tempo liegt jede zweite Eins dazwischen
                mx=max(devs) if not half else max(devs[::2])
                good = good and mx < 40
                info=f"{tr['orig']['bars']} Takte · {d['bpm']:.2f} BPM (soll {gt['bpm']}) · max. Abw. {mx:.1f} ms"
            elif kind=='loop':
                info=f"{st.split('·')[0][7:60]} · {d['bpm']:.2f} BPM"
                good = good and abs(d['bpm']-gt['bpm'])/gt['bpm']<0.006
            ok+=good
            print(('OK    ' if good else 'FEHLER'), os.path.basename(path).ljust(28), ('Loop' if isLoop else 'Song').ljust(5), info)
        print(f'\n{ok}/{len(files)} Dateien richtig eingeordnet und gerastert', '· Skriptfehler:', errs or 'keine')
        await b.close()
asyncio.run(main())
