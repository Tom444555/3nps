# Eintakten einer frei aufgenommenen ersten Spur: Datei als Mikrofon einspielen, frei REC/Stopp drücken
import asyncio, json, sys, random
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
CASES = [('corpus', 'rock_120', 4), ('corpus', 'funk_104', 4), ('valid', 'v_reggae_76', 2), ('hard', 'h_texas_shuffle_118', 4), ('hard', 'h_acoustic_100', 4),
         ('hard', 'h_slowblues_60', 2), ('corpus', 'guitar_only_95', 4), ('hard', 'h_bluesrock_124', 8), ('valid', 'v_edm_124', 4), ('hard', 'h_chicago_shuffle_96', 4)]
async def one(p, folder, name, bars, ref):
    gt = json.load(open(T + f'{folder}/{name}.json'))
    b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', f'--use-file-for-fake-audio-capture={T}{folder}/{name}.wav', '--autoplay-policy=no-user-gesture-required'])
    pg = await b.new_page(viewport={'width': 1024, 'height': 1366}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
    await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0'); await pg.select_option('#loopBars', 'free')
    await pg.evaluate("document.getElementById('loopSnap').checked = true")
    await pg.click('#loopMonitor'); await pg.wait_for_timeout(2500 + random.randint(0, 900))
    bar = 240 / gt['bpm']
    await pg.click('#foot0'); await pg.wait_for_timeout(int((bars * bar + random.uniform(-0.12, 0.12)) * 1000)); await pg.click('#foot0')
    await pg.wait_for_timeout(3500)
    d = await pg.evaluate('Looper.debug()'); st = await pg.inner_text('#loopStatus')
    rf = await pg.evaluate('window.__rf || null')
    L = d['tracks'][0]['L'] / d['sr']; nb = round(L / (240 / d['bpm']))
    okT = min(abs(d['bpm'] / gt['bpm'] * q - 1) for q in (1, 0.5, 2)) < 0.012
    okL = abs(L - bars * bar) < 0.03 or abs(L - bars * bar / 2) < 0.03 or abs(L - bars * bar * 2) < 0.03
    print(f"{name:22s} soll {gt['bpm']:6.1f} BPM {bars} T | ist {d['bpm']:7.2f} BPM, Loop {L:6.3f} s = {nb} T (soll {bars * bar:6.3f}) {'OK' if okT and okL else 'FEHLER'} · {st[:70]} {errs[:1]}" + ('' if okT and okL else f' RF={rf}'))
    await b.close()
    return okT and okL
async def main():
    random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
    async with async_playwright() as p:
        ok = 0
        for c in CASES: ok += await one(p, *c, False)
        print(f'Eingetaktet: {ok}/{len(CASES)}')
asyncio.run(main())
