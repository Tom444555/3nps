import asyncio
from playwright.async_api import async_playwright
STEPS=[('1','Song & Tonart','Passt das Lied zu deiner Stimme?',2),('2','Hören & gliedern','Abschnitte und Atemstellen',2),('3','Text sprechen','erst lesen, dann frei',2),('4','Text im Takt','sprechen zur Aufnahme, 75 %',1),('5','Melodie ohne Text','summen, Zeile für Zeile',0),('6','Mit Text mitsingen','Original → leiser → Karaoke',0),('7','Mit Gitarre','summen → sprechen → singen',0),('8','Aufnehmen & anhören','schwierige Stellen merken',0)]
MOCK = r'''
<div style="display:grid;grid-template-columns:330px 1fr;gap:14px;align-items:start">
 <div class="card"><div class="card-head"><h2>Mitsingen lernen</h2><span class="caption">3 von 8</span></div>
  <p class="caption" style="margin:2px 0 10px">Stück: <b style="color:inherit">Nachtfahrt</b> · A-Moll · 92 BPM</p>
  <div id="msL"></div>
  <div style="display:flex;gap:6px;margin-top:10px"><button class="toggle-btn" type="button" aria-pressed="true">Weg: Gründlich</button><button class="toggle-btn" type="button">Schnell</button><button class="toggle-btn" type="button">Mit Gitarre</button></div>
 </div>
 <div class="card"><div class="card-head"><h2>Schritt 4 · Text im Takt sprechen</h2><span class="caption">ca. 10 min</span></div>
  <p style="margin:6px 0 4px;line-height:1.5"><b>So geht’s:</b> Lass die Zeile langsam laufen und <b>sprich</b> den Text genau im Rhythmus mit – noch nicht singen. Sitzt eine Zeile dreimal hintereinander, nimm die nächste dazu.</p>
  <p class="caption" style="margin:0 0 12px">Warum: Text und Rhythmus sind dann automatisch – beim Singen bleibt der Kopf frei für die Töne.</p>
  <div style="padding:12px;border-radius:12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12)">
   <div style="display:flex;justify-content:space-between;font-size:13px;opacity:.75"><span>Strophe 1 · Zeile 2 von 4</span><span>0:21 – 0:27</span></div>
   <div style="position:relative;height:54px;margin:8px 0;border-radius:8px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.16) 0 2px,transparent 2px 5px);overflow:hidden">
     <div style="position:absolute;left:31%;width:17%;top:0;bottom:0;background:rgba(74,222,128,.28);border-left:3px solid #4ade80;border-right:3px solid #4ade80"></div>
     <div style="position:absolute;left:38%;top:0;bottom:0;width:2px;background:#fff"></div></div>
   <div style="font:600 24px/1.4 inherit;text-align:center;margin:10px 0 2px">Die Straße leer, das <span style="color:#4ade80">Radio</span> leise …</div>
   <div style="text-align:center;font-size:14px;opacity:.6;margin-bottom:10px">danach: Ich zähl die Lichter, eins und zwei …</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
    <button class="toggle-btn" type="button" style="padding:10px 22px;font-weight:700" aria-pressed="true">▶ Zeile in Schleife</button>
    <button class="toggle-btn" type="button">‹ Zeile</button><button class="toggle-btn" type="button">Zeile ›</button>
    <button class="toggle-btn" type="button">Vorsingen – Pause – Nachsingen</button><button class="toggle-btn" type="button">● Aufnehmen</button></div>
   <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">
    <div class="sbk"><b>75 %</b><span>Tempo (Tonhöhe bleibt)</span></div><div class="sbk"><b>Original 100 %</b><span>Gesang im Lied: laut ↔ Karaoke</span></div><div class="sbk"><b>−2 Halbtöne</b><span>Tonart für deine Stimme</span></div></div>
  </div>
  <div style="display:flex;gap:8px;margin-top:12px;align-items:center"><button class="toggle-btn" type="button" style="padding:10px 18px;font-weight:700">✓ Schritt geschafft</button><button class="toggle-btn" type="button">Tipps zu diesem Schritt</button><span class="caption" style="margin-left:auto">Heute: 18 min an diesem Stück</span></div>
 </div>
</div>
<style>.sbk{padding:10px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);text-align:center;display:flex;flex-direction:column;gap:2px}.sbk b{font-size:17px}.sbk span{font-size:12px;opacity:.7}
.msr{display:flex;gap:10px;align-items:center;padding:9px 11px;border-radius:10px;margin-bottom:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}.msr i{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;background:rgba(255,255,255,.1)}.msr.ok i{background:#4ade80;color:#06210f}.msr.on{border-color:#4ade80;box-shadow:0 0 10px rgba(74,222,128,.35)}.msr small{display:block;opacity:.65;font-size:12px}</style>'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        pg = await b.new_page(viewport={'width':1366,'height':1024})
        await pg.goto('http://localhost:8799/index.html'); await pg.wait_for_timeout(2500)
        await pg.evaluate("AppNav.show('uebezeit')"); await pg.wait_for_timeout(1500)
        await pg.evaluate('''([m,rows])=>{const t=document.getElementById('tab-tonleiter');const n=t.cloneNode(true);n.id='tab-ms';n.textContent='Mitsingen lernen';document.getElementById('tab-uebezeit').before(n);
          document.querySelectorAll('.subtab[data-area=lernen]').forEach(x=>x.setAttribute('aria-selected','false'));n.setAttribute('aria-selected','true');
          const r=document.getElementById('uzRoot');r.style.cssText='display:block;max-width:none;width:100%;grid-template-columns:none';r.innerHTML=m;
          document.getElementById('msL').innerHTML=rows.map(x=>'<div class="msr'+(x[3]==2?' ok':x[3]==1?' on':'')+'"><i>'+(x[3]==2?'✓':x[0])+'</i><div><b>'+x[1]+'</b><small>'+x[2]+'</small></div></div>').join('');window.scrollTo(0,0)}''',[MOCK,STEPS])
        await pg.wait_for_timeout(400); await pg.screenshot(path='mitsingen-entwurf.png'); await b.close()
asyncio.run(main())
