import asyncio
from playwright.async_api import async_playwright
T='/home/claude/3nps/test/'
CI="(()=>{const c=Looper.chordInfo(); return [c.track, (c.tracks||[]).map(t=>t.has), document.getElementById('panel-solo').innerText.includes('Noch keine Akkorde')]})()"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for live in (False, True):
            ctx=await b.new_context(viewport={'width':1180,'height':820}); pg=await ctx.new_page(); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(600)
            await pg.set_input_files('#file0',T+'stereo/rock_120_2T_st.wav'); await pg.wait_for_timeout(1500)
            if await pg.is_visible('#impOk'): await pg.click('#impOk')
            await pg.wait_for_timeout(5000)
            print('live',live,'nach Datei   ', await pg.evaluate(CI))
            await pg.click('#ideaSave'); await pg.wait_for_timeout(1000)
            await pg.reload(); await pg.wait_for_timeout(800)
            if live: await pg.click('#liveBtn')
            await pg.click('#ideaList .idea-row button'); await pg.wait_for_timeout(6000)
            await pg.click('#tab-solo'); await pg.wait_for_timeout(800)
            print('live',live,'nach Idee    ', await pg.evaluate(CI), await pg.evaluate("[...document.querySelectorAll('#ideaList .idea-row button')].map(b=>b.textContent).join('|')"), errs)
            await ctx.close()
        await b.close()
asyncio.run(main())
