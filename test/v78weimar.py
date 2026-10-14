# v78 (nur lokal, Datei des Nutzers liegt nicht im Repository): Weimar – „Von Wölfen und Ratten“, Moises 135 BPM; vorher 90 erkannt
import asyncio, os
from playwright.async_api import async_playwright
F = '/home/claude/3nps/test/user/weimar.mp3'
async def main():
    if not os.path.exists(F): print('übersprungen (Datei fehlt)'); return
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg = await (await b.new_context()).new_page()
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.select_option('#loopCountIn', '0'); await pg.set_input_files('#file0', F)
        for _ in range(200):
            await pg.wait_for_timeout(300)
            if await pg.is_visible('#impDlg') and 'BPM' in await pg.inner_text('#impAna'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        r = await pg.evaluate("(()=>{const o=Looper.debug().tracks[0].orig, s=Looper.singSrc(0);return [o.bpm, o.downs[0]/s.sr, s.L/s.sr, s.len/s.sr, s.origPos/s.sr]})()")
        ok = abs(r[0] - 135) < 1.5 and r[4] <= 1.45 and r[4] + r[2] >= r[3] - 3.0     # Datei: 1,4 s Stille vorn, 2,8 s hinten
        print(('OK    ' if ok else 'FEHLER') + '  135 BPM erkannt, ganze Datei (Intro und Schluss) im Loop  · ', [round(x, 2) for x in r])
        await b.close()
asyncio.run(main())
