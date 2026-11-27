import asyncio
from playwright.async_api import async_playwright
BAR = r'''<div id="swBar" style="margin:0 0 12px">
<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
 <div style="flex:1;font-size:13px;opacity:.75">Stand des Songs:</div>
 <div style="display:flex;gap:8px">
  <div class="swk"><b>7/11</b><span>Workflow</span></div><div class="swk"><b>4/6</b><span>Abschnitte mit Text</span></div><div class="swk"><b>✓</b><span>Akkorde</span></div><div class="swk"><b>Entwurf</b><span>Stand</span></div></div>
</div>
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
 <button class="toggle-btn" type="button" aria-pressed="true" style="padding:12px 0;font-weight:700">Song</button>
 <button class="toggle-btn" type="button" style="padding:12px 0">Text-Werkstatt</button>
 <button class="toggle-btn" type="button" style="padding:12px 0">Workflow</button>
 <button class="toggle-btn" type="button" style="padding:12px 0">Leitfaden &amp; Beispiel</button>
 <button class="toggle-btn" type="button" style="padding:12px 0">Ideen</button></div>
<p class="caption" style="margin:8px 2px 0">„Song“ = Ablauf, Teile, Text, Prüfen, Gesang, Mit Claude (wie bisher). Die anderen Bereiche arbeiten immer mit dem Song oben.</p>
</div><style>.swk{min-width:84px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);text-align:center;display:flex;flex-direction:column}.swk b{font-size:17px}.swk span{font-size:11px;opacity:.7}</style>'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        pg = await b.new_page(viewport={'width':1366,'height':1024})
        await pg.goto('http://localhost:8799/index.html'); await pg.wait_for_timeout(2500)
        await pg.evaluate("AppNav.show('lied')"); await pg.wait_for_timeout(1800)
        ok = await pg.evaluate('''(bar)=>{const box=[...document.querySelectorAll('b,h3,strong,div')].find(e=>e.textContent.trim()=='So entsteht ein Song');if(!box)return 'kein Kasten';const kasten=box.closest('details,div.ld-intro,div')||box;let k=box;while(k.parentElement&&!k.parentElement.classList.contains('card')&&!/So entsteht/.test(k.parentElement.firstElementChild?.textContent||'x')===false)k=k.parentElement;
const card=box.closest('.card');const intro=[...card.children].find(c=>/So entsteht ein Song/.test(c.textContent)&&!c.querySelector('select'));if(intro){intro.insertAdjacentHTML('beforebegin',bar);intro.style.display='none'}else card.insertAdjacentHTML('beforeend',bar);
const sel=card.querySelector('select');if(sel){const o=document.createElement('option');o.textContent='Nachtfahrt · A-Moll · 92 BPM';sel.prepend(o);sel.selectedIndex=0}
[...card.querySelectorAll('*')].filter(e=>e.children.length==0&&e.textContent.trim()=='Bereit').forEach(e=>e.style.display='none');
          const st=document.getElementById('tab-songtext')||[...document.querySelectorAll('.subtab')].find(e=>/Songtext/.test(e.textContent)); 
          window.scrollTo(0,0);return 'ok'}''', BAR)
        print(ok); await pg.wait_for_timeout(400); await pg.screenshot(path='songwriting-entwurf.png'); await b.close()
asyncio.run(main())
