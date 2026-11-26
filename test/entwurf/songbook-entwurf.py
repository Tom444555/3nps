import asyncio
from playwright.async_api import async_playwright
MOCK = r'''
<div style="display:grid;grid-template-columns:340px 1fr;gap:14px;align-items:start">
 <div class="card"><div class="card-head"><h2>Songbook</h2><button type="button" class="toggle-btn">＋ Neues Stück</button></div>
  <input type="search" placeholder="Suchen …" style="width:100%;margin:6px 0 10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:inherit;font:inherit">
  <div id="sbL"></div>
  <p class="caption" style="margin-top:10px">4 Stücke · sortiert nach „zuletzt geübt“</p>
 </div>
 <div class="card"><div class="card-head"><h2>Nachtfahrt</h2><span class="caption">A-Moll · 92 BPM · 4/4</span><button type="button" class="toggle-btn" aria-pressed="true" style="margin-left:auto;font-weight:700;padding:10px 22px">▶ Laden</button></div>
  <p class="caption">„Laden“ stellt Tempo, Tonart, Schlagzeug und Rig-Sound ein und holt die Looper-Idee – ein Knopf, dann spielen.</p>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0">
   <div class="sbk"><b>A-Moll</b><span>Tonart</span></div><div class="sbk"><b>92</b><span>BPM</span></div>
   <div class="sbk"><b>Rock 4/4</b><span>Schlagzeug</span></div><div class="sbk"><b>3 h 40 min</b><span>geübt</span></div></div>
  <h3 style="margin:10px 0 6px">Akkorde &amp; Text</h3>
  <pre style="margin:0;padding:12px;border-radius:10px;background:rgba(0,0,0,.28);font:15px/1.7 ui-monospace,Menlo,monospace;white-space:pre-wrap">Strophe
Am          F           C          G
Die Straße leer, das Radio leise …

Refrain
F           C           G          Am
Wir fahren, bis der Morgen kommt …</pre>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
   <div class="sbk" style="text-align:left"><span>Rig-Sound</span><b style="font-size:16px">Reactor 50 · Crunch warm</b></div>
   <div class="sbk" style="text-align:left"><span>Looper-Idee</span><b style="font-size:16px">„Nachtfahrt Strophe“ · 8 Takte</b></div></div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="toggle-btn" type="button">Bearbeiten</button><button class="toggle-btn" type="button">Tonart ändern ±</button><button class="toggle-btn" type="button">Übezeit zu diesem Stück</button></div>
 </div>
</div>
<style>.sbk{padding:10px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);text-align:center;display:flex;flex-direction:column;gap:2px}.sbk b{font-size:19px}.sbk span{font-size:12px;opacity:.7}
.sbr{display:flex;justify-content:space-between;gap:8px;padding:11px 12px;border-radius:10px;margin-bottom:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}.sbr.on{border-color:#4ade80;box-shadow:0 0 10px rgba(74,222,128,.35)}.sbr small{opacity:.7}</style>'''
ROWS = [('Nachtfahrt','A-Moll · 92 BPM',1),('Blues in E (eigener)','E · 76 BPM · Shuffle',0),('Staub und Sterne','D-Dur · 120 BPM',0),('Übungsstück Dorisch','D-Dorisch · 100 BPM',0)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        pg = await b.new_page(viewport={'width':1366,'height':1024}); pg.on('console', lambda m: print(m.text[:200]) if 'toggle' in m.text else None)
        await pg.goto('http://localhost:8799/index.html'); await pg.wait_for_timeout(2500)
        await pg.evaluate("AppNav.show('uebezeit')"); await pg.wait_for_timeout(1500)
        await pg.evaluate('''([m,rows])=>{const r0=()=>{const e=document.getElementById('uzRoot');return e.className+' '+getComputedStyle(e).display+' '+e.offsetWidth+' '+e.parentElement.offsetWidth};const t=document.getElementById('tab-tonleiter');const n=t.cloneNode(true);n.id='tab-sb';n.textContent='Songbook';document.getElementById('tab-uebezeit').before(n);
          document.querySelectorAll('.subtab[data-area=lernen]').forEach(x=>x.setAttribute('aria-selected','false'));n.setAttribute('aria-selected','true');document.querySelectorAll('.subtab[data-area=lernen]').forEach(x=>{if(x!==n)x.classList.remove('active','on','sel')});console.log(document.getElementById('tab-uebezeit').className, r0());
          const r=document.getElementById('uzRoot');r.style.cssText='display:block;max-width:none;width:100%;grid-template-columns:none';r.parentElement.style.maxWidth='none';r.innerHTML=m;document.getElementById('sbL').innerHTML=rows.map(x=>'<div class="sbr'+(x[2]?' on':'')+'"><b>'+x[0]+'</b><small>'+x[1]+'</small></div>').join('');window.scrollTo(0,0)}''',[MOCK,ROWS])
        await pg.wait_for_timeout(400); await pg.screenshot(path='songbook-entwurf.png'); await b.close()
asyncio.run(main())
