/* ---------- v146: Reiter „Rig“ – Sounds (Signalkette, BIAS-X-Prompt) und Gitarren (Schaltung, Zeichnung, 3D) ----------
   Wird erst beim ersten Öffnen des Reiters geladen (tabs.js › Rig-Lader: rig/rig.css + rig/rig.js). Baut sein Markup selbst in
   #panel-rig, alle IDs mit „rg-“, SVG-Verläufe mit „rgs-“ (keine Kollision mit der App). Looper/Audio werden nicht angefasst.
   3D (three.js r160, rig/three/) lädt rig3d.js erst, wenn „Gitarren“ mit 3D sichtbar ist – nie im Profil „Minimal“;
   „Altes iPad“: 3D mit Pixelverhältnis 1, ohne Umgebungsspiegelung/Klarlack, Zeichnung ohne SVG-Filter.
   Gezeichnet wird nur bei Änderungen. Reiter verlassen → 3D hält an; nach 2 min verborgen wird es ganz freigegeben.
   localStorage: 3nps-rig-mine (eigene Sounds, Liste wie die Vorlagen), 3nps-rig {v, g, t, p, gw, d3, w} (letzte Ansicht). */
(function () {
'use strict';
const host = document.getElementById('panel-rig');
if (!host || window.Rig) return;
const T = s => (typeof window.T === 'function' ? window.T(s) : s);
const $ = id => document.getElementById('rg-' + id);
const KM = '3nps-rig-mine', KS = '3nps-rig';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dev = () => window.__dev || 'new';

host.innerHTML = `
<div class="card rg-head">
  <div class="rg-top"><h2>Rig</h2>
    <div class="seg rg-main" id="rg-mainSeg"><button class="toggle-btn active" data-v="sounds">Sounds</button><button class="toggle-btn" data-v="guit">Gitarren</button></div></div>
  <p class="pattern-desc">Sounds für BIAS X, Reactor 50 und Spark LIVE · Signalkette und Gitarren-Schaltung</p>
</div>
<div class="rg-view" id="rg-v_sounds">
  <div class="card">
    <div class="rg-lbl">Gitarre</div><div class="rg-chips" id="rg-gChips"></div>
    <div class="rg-lbl">Ziel-Gerät</div>
    <div class="seg rg-seg" id="rg-tSeg"><button class="toggle-btn active" data-t="bias">BIAS X (Mac)</button><button class="toggle-btn" data-t="reactor">Reactor 50</button><button class="toggle-btn" data-t="spark">Spark LIVE</button></div>
    <div class="rg-lbl">Sound-Bibliothek</div><div class="rg-chips" id="rg-pChips"></div>
  </div>
  <div class="card">
    <div class="card-head"><h2 id="rg-pTitle">–</h2><span class="rg-badge" id="rg-gName"></span></div>
    <p class="pattern-desc rg-desc" id="rg-pDesc"></p>
    <div class="rg-lbl">An der Gitarre</div>
    <div class="rg-gset" id="rg-gSet"></div>
    <div class="rg-hint rg-gnote" id="rg-gNote"></div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Signalkette</h2><span class="rg-hint">antippen zum Einstellen</span></div>
    <div class="rg-chain" id="rg-chain"></div>
    <div class="rg-edhead"><b id="rg-edName">–</b><span class="rg-row"><button class="toggle-btn" id="rg-edSt">Stereo</button><button class="toggle-btn" id="rg-edOn">An</button></span></div>
    <div class="rg-ed" id="rg-ed"></div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Prompt</h2><span class="rg-badge" id="rg-prT"></span></div>
    <pre class="rg-pre" id="rg-prompt" translate="no"></pre>
    <div class="rg-row rg-wrap"><button class="toggle-btn active" id="rg-copy">Prompt kopieren</button><button class="toggle-btn" id="rg-save">Als eigenen Sound sichern</button><button class="toggle-btn" id="rg-reset">Zurücksetzen</button><button class="toggle-btn" id="rg-del">Eigenen Sound löschen</button></div>
    <div class="rg-hint">Englischer Prompt für BIAS X, darunter Stichpunkte zur Gitarre. Stereo-Effekte sind gekennzeichnet. Für Reactor und Spark zeigt die Kette, wo welcher Regler stehen soll.</div>
  </div>
</div>
<div class="rg-view" id="rg-v_guit" hidden>
  <div class="card"><div class="rg-lbl">Gitarre</div><div class="rg-chips" id="rg-g2Chips"></div></div>
  <div class="card rg-stagecard">
    <div class="rg-vbar"><button class="toggle-btn" id="rg-v3Body">Korpus</button><button class="toggle-btn" id="rg-v3All">Ganz</button><button class="toggle-btn" id="rg-v3Tog">3D-Modell</button><button class="toggle-btn active" id="rg-wTog">Verkabelung: AN</button></div>
    <div class="rg-stage" id="rg-stage"><svg id="rg-body" viewBox="0 0 360 805" preserveAspectRatio="xMidYMid meet"></svg><div class="rg-v3d" id="rg-v3d" hidden></div><div class="rg-v3msg" id="rg-v3msg" hidden></div></div>
    <div class="rg-hint" id="rg-v3Hint"></div>
    <div class="rg-leg" id="rg-wLeg"></div>
  </div>
  <div class="rg-grid2">
    <div class="card">
      <h2>Pickup-Wahlschalter</h2>
      <div class="rg-pos" id="rg-posBtns"></div>
      <div class="rg-split" id="rg-splitWrap"><button class="toggle-btn" id="rg-splitBtn"></button></div>
      <div class="rg-ed rg-poted" id="rg-potEd"></div>
    </div>
    <div class="card">
      <h2>Was passiert gerade</h2>
      <div class="rg-char" id="rg-charBox"></div>
      <svg id="rg-curve" class="rg-curve" viewBox="0 0 320 140"></svg>
      <div class="rg-hint">Vereinfachte Klangkurve (Pickup + Kabel + Poti): Höhe und Lage der Resonanzspitze bestimmen, wie hell es klingt.</div>
    </div>
  </div>
  <div class="card"><h2>Erklärung</h2><ul class="rg-expl" id="rg-expl" translate="no"></ul></div>
  <div class="card"><h2>Verkabelung</h2><svg id="rg-wiring" class="rg-wiring" viewBox="0 0 380 300"></svg><div class="rg-hint rg-wtxt" id="rg-wireTxt" translate="no"></div></div>
</div>
<div class="rg-toast" id="rg-toast" role="status"></div>`;

let toastT = 0;
const toast = t => { const e = $('toast'); e.textContent = T(t); e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1600); };

//==DATA
/* ---------- Gitarren ---------- */
const G={
 schecter:{name:"Schecter PT Apocalypse",short:"Schecter",type:"hh",
   pickups:[{id:"N",name:"Neck",kind:"hb"},{id:"B",name:"Bridge",kind:"hb"}],
   positions:[{k:"B",l:"Bridge",on:["B"]},{k:"NB",l:"Beide",on:["N","B"]},{k:"N",l:"Neck",on:["N"]}],
   pots:[["vol","Volume"],["tone","Tone"]],split:true,cap:47,
   wire:"2 Humbucker (Schecter USA Apocalypse), 3-Weg-Schalter, 1 × Volume, 1 × Tone mit Zug-/Druck-Schalter für Coil-Split. Gezogen: Von jedem Humbucker spielt nur noch eine Spule (Single-Coil-Klang). Bitte am eigenen Instrument kurz prüfen – Ausstattung kann je nach Baujahr abweichen."},
 strat:{name:"Stratocaster ’95",short:"Strat ’95",type:"sss",
   pickups:[{id:"N",name:"Neck",kind:"sc"},{id:"M",name:"Middle",kind:"sc",rw:true},{id:"B",name:"Bridge",kind:"sc"}],
   positions:[{k:"1",l:"1 Bridge",on:["B"]},{k:"2",l:"2 B+M",on:["B","M"]},{k:"3",l:"3 Middle",on:["M"]},{k:"4",l:"4 M+N",on:["M","N"]},{k:"5",l:"5 Neck",on:["N"]}],
   pots:[["vol","Volume"],["tone1","Tone Neck"],["tone2","Tone Middle"]],split:false,cap:47,
   wire:"3 Single Coils, 5-Weg-Schalter, Master-Volume, Tone 1 für den Hals-Pickup, Tone 2 für den Mittel-Pickup – der Steg-Pickup hat keine Tonblende (klassische Schaltung). Der mittlere Pickup ist gegensinnig gewickelt und gepolt: In Stellung 2 und 4 heben sich Brummgeräusche auf."},
 gibson:{name:"Gibson Les Paul Studio",short:"LP Studio",type:"hh",
   pickups:[{id:"N",name:"Neck",kind:"hb"},{id:"B",name:"Bridge",kind:"hb"}],
   positions:[{k:"B",l:"Treble",on:["B"]},{k:"NB",l:"Mitte",on:["N","B"]},{k:"N",l:"Rhythm",on:["N"]}],
   pots:[["vol1","Vol Neck"],["vol2","Vol Bridge"],["tone1","Tone Neck"],["tone2","Tone Bridge"]],split:false,cap:22,
   wire:"Les Paul Studio: 2 Humbucker, 3-Weg-Toggle (Rhythm/Treble), je Pickup eigenes Volume und Tone (klassische 50s/Modern-Schaltung, Tone-Kondensatoren je 22 nF). In Mittelstellung mischst du die Pickups über ihre Volume-Regler. Je nach Baujahr können Push/Pull-Potis für Coil-Split verbaut sein – sag Bescheid, dann ergänze ich das."}
};
const GK=Object.keys(G);

/* ---------- Sound-Bibliothek ---------- */
const P=[
 {id:"funk",en:"tight, percussive, lots of attack – compressed rhythm guitar",name:"Clean Funk",desc:"Knackig, perkussiv, viel Attack – Rhythmusgitarre mit Kompressor.",
  g:{schecter:{pos:"NB",split:true,vol:10,tone:8},strat:{pos:"4",vol:10,tone1:9,tone2:10},gibson:{pos:"NB",vol1:8,vol2:10,tone1:7,tone2:9}},
  chain:[["comp","Compressor",{Sustain:5,Level:6,Attack:7}],["amp","Clean American (Twin-Style)",{Gain:3,Bass:4,Mid:6,Treble:7,Presence:6,Master:6},"clean"],["cab","2×12 Open Back",{Mic:"Dyn 57",Pos:4,Room:2}],["mod","Chorus",{Rate:3,Depth:3,Mix:3},0,0],["dly","Delay",{Time:3,Fdbk:2,Mix:2},0,0],["rev","Room Reverb",{Decay:3,Tone:6,Mix:2}]]},
 {id:"blues",en:"light breakup that cleans up with picking dynamics and the volume knob",name:"Blues Crunch",desc:"Leicht angezerrt, reagiert auf Anschlag und Volume-Poti.",
  g:{schecter:{pos:"N",split:true,vol:8,tone:7},strat:{pos:"5",vol:9,tone1:7,tone2:10},gibson:{pos:"N",vol1:8,vol2:8,tone1:6,tone2:8}},
  chain:[["drv","Overdrive (Tube-Screamer-Style)",{Drive:3,Tone:5,Level:7}],["amp","Tweed Bassman-Style",{Gain:5,Bass:5,Mid:7,Treble:6,Presence:5,Master:6},"crunch"],["cab","4×10 Open Back",{Mic:"Ribbon",Pos:5,Room:3}],["mod","Tremolo",{Rate:4,Depth:3,Mix:5},0,0],["dly","Slapback",{Time:2,Fdbk:1,Mix:2}],["rev","Spring Reverb",{Decay:4,Tone:5,Mix:3}]]},
 {id:"rock",en:"70s classic rock: punchy mids and bite from a British amp",name:"Classic Rock",desc:"70er-Jahre-Rock: Mitten, Biss, britischer Amp.",
  g:{schecter:{pos:"B",split:false,vol:10,tone:8},strat:{pos:"1",vol:10,tone1:10,tone2:10},gibson:{pos:"B",vol1:10,vol2:10,tone1:8,tone2:8}},
  chain:[["drv","Boost",{Drive:2,Tone:6,Level:7}],["amp","British Plexi-Style",{Gain:7,Bass:5,Mid:8,Treble:6,Presence:6,Master:7},"drive"],["cab","4×12 Greenback",{Mic:"Dyn 57",Pos:4,Room:2}],["mod","Phaser",{Rate:3,Depth:4,Mix:4},0,0],["dly","Analog Delay",{Time:4,Fdbk:3,Mix:2}],["rev","Hall",{Decay:4,Tone:5,Mix:2}]]},
 {id:"metal",en:"tight modern high gain with controlled lows for riffing",name:"Modern High-Gain",desc:"Tight, viel Gain, enge Bässe – für Riffs mit der Schecter.",
  g:{schecter:{pos:"B",split:false,vol:10,tone:10},strat:{pos:"1",vol:10,tone1:10,tone2:10},gibson:{pos:"B",vol1:10,vol2:10,tone1:10,tone2:10}},
  chain:[["gate","Noise Gate",{Thresh:6,Release:3,Depth:8}],["drv","Tight Boost",{Drive:0,Tone:6,Level:8}],["amp","Modern Hi-Gain (5150/Rectifier-Style)",{Gain:7,Bass:6,Mid:4,Treble:7,Presence:7,Master:6},"hi"],["cab","4×12 V30",{Mic:"Dyn 57 + Ribbon",Pos:3,Room:1}],["dly","Delay",{Time:4,Fdbk:2,Mix:1},0,0],["rev","Room",{Decay:2,Tone:5,Mix:1}]]},
 {id:"amb",en:"wide ambient clean: stereo chorus, ping-pong delay, big reverb",name:"Ambient Clean (Stereo)",desc:"Weite Flächen: Stereo-Chorus, Ping-Pong-Delay, großer Hall.",
  g:{schecter:{pos:"N",split:true,vol:9,tone:6},strat:{pos:"4",vol:9,tone1:6,tone2:8},gibson:{pos:"N",vol1:9,vol2:9,tone1:5,tone2:8}},
  chain:[["comp","Compressor",{Sustain:4,Level:6,Attack:4}],["amp","Clean American (Twin-Style)",{Gain:2,Bass:5,Mid:5,Treble:6,Presence:5,Master:6},"clean"],["cab","2×12 Open Back",{Mic:"Condenser",Pos:5,Room:4}],["mod","Chorus",{Rate:2,Depth:5,Mix:4},1,1],["dly","Ping-Pong Delay",{Time:6,Fdbk:5,Mix:4},1,1],["rev","Shimmer/Hall",{Decay:8,Tone:6,Mix:5},1,1]]},
 {id:"lead",en:"singing lead with sustain, forward mids and trailing delay",name:"Singing Lead",desc:"Solo mit Sustain, Mitten nach vorn, Delay hinterher.",
  g:{schecter:{pos:"N",split:false,vol:10,tone:7},strat:{pos:"5",vol:10,tone1:6,tone2:10},gibson:{pos:"N",vol1:10,vol2:10,tone1:6,tone2:8}},
  chain:[["drv","Overdrive",{Drive:4,Tone:6,Level:6}],["amp","Hot-Rod British",{Gain:6,Bass:5,Mid:8,Treble:6,Presence:5,Master:7},"drive"],["cab","4×12 V30",{Mic:"Dyn 57",Pos:4,Room:3}],["mod","Chorus",{Rate:2,Depth:2,Mix:2},0,0],["dly","Stereo Delay",{Time:5,Fdbk:4,Mix:3},1,1],["rev","Plate",{Decay:5,Tone:6,Mix:3},1]]}
];
const TYPE={gate:"Gate",comp:"Kompressor",drv:"Drive",amp:"Amp",cab:"Box/IR",mod:"Modulation",dly:"Delay",rev:"Hall"};
const EN={gate:"noise gate",comp:"compressor",drv:"drive pedal",amp:"amp",cab:"cabinet",mod:"modulation",dly:"delay",rev:"reverb"};
//==KNOB
function knob(v,size,col){const a=-135+(Math.max(0,Math.min(10,v))/10)*270,r=size/2-3,c=size/2;
  const arc=(a0,a1)=>{const p=x=>[c+r*Math.sin(x*Math.PI/180),c-r*Math.cos(x*Math.PI/180)];const [x0,y0]=p(a0),[x1,y1]=p(a1);return `M${x0} ${y0}A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${x1} ${y1}`};
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="${arc(-135,135)}" stroke="#48484a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="${arc(-135,a)}" stroke="${col||"var(--acc)"}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="${c}" cy="${c}" r="${r-5}" fill="#111"/><line x1="${c}" y1="${c}" x2="${c+(r-7)*Math.sin(a*Math.PI/180)}" y2="${c-(r-7)*Math.cos(a*Math.PI/180)}" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`}
const fmtK=v=>typeof v==="number"?(Math.round(v*10)/10).toString().replace(".",","):v;

/* ---------- Ziel-Anpassung (Reactor/Spark: Amp-Regler am Gerät) ---------- */
function tgtNote(){return tSel==="bias"?"BIAS X: Werte gelten für die Regler im Plugin (0–10). Stereo-Blöcke im Stereo-Pfad betreiben."
 :tSel==="reactor"?"Reactor 50: Amp-Regler am Verstärker wie gezeigt, Effekte in der App. Werte 0–10 = Reglerstellung (12 Uhr = 5). Modellnamen in der App können abweichen – ähnlichsten Amp wählen."
 :"Spark LIVE: Amp-Block und Effekte in der Spark-App; Stereo-Effekte nur über Kopfhörer/Stereo-Ausgang hörbar."}

//==PROMPT
function prompt(){const g=G[gSel],gs=cur.g[gSel]||{},pos=(g.positions.find(p=>p.k===gs.pos)||g.positions[0]);
  const on=cur.chain.filter(c=>c.on);const amp=on.find(c=>c.type==="amp");
  const st=on.filter(c=>c.st).map(c=>EN[c.type]);
  const lvl=v=>v<=2?"very low":v<=4?"low":v<=6?"medium":v<=8?"high":"very high";
  const nm=c=>c.name.toLowerCase().includes(EN[c.type].split(" ")[0])?c.name:c.name+" "+EN[c.type];const desc=c=>{const ks=Object.entries(c.k).map(([n,v])=>typeof v==="number"?`${n} ${fmtK(v)}/10`:`${n}: ${v}`).join(", ");return `- ${c.st?"[STEREO] ":""}${nm(c)} (${ks})`};
  const pu=pos.on.map(id=>g.pickups.find(p=>p.id===id)).map(p=>p.name.toLowerCase()).join(" + ");
  const kind=g.split&&gs.split?"coil-split (single-coil sound)":g.type==="sss"?"single-coil":"humbucker";
  let t=`Create a "${cur.name}" guitar tone for a ${g.name} (${pu} ${kind}${pos.on.length>1?" pickups":" pickup"}).\n`+
  `Character: ${cur.en||cur.desc}\n`+(amp?`Amp: ${amp.name}, gain ${lvl(amp.k.Gain)}, mids ${lvl(amp.k.Mid)}.\n`:"")+
  `Signal chain in this order:\n${on.map(desc).join("\n")}\n`+
  (st.length?`STEREO: run the ${st.join(", ")} in stereo with a wide image; everything before stays mono.\n`:`Mono signal path, no stereo effects.\n`)+
  `Output level around -12 dB peak, no clipping.`;
  if(tSel!=="bias")t=`(${tSel==="reactor"?"Reactor 50 – amp knobs on the amp, effects in the app":"Spark LIVE app"})\n`+t;
  const de=[`• ${T("Schalter")}: ${T(pos.l)}`].concat(g.pots.map(([k,l])=>`• ${l}: ${fmtK(gs[k]??10)}`)).concat(g.split?[`• Coil-Split: ${T(gs.split?"Tone-Poti ziehen":"gedrückt (Humbucker)")}`]:[]);
  return t+"\n\n"+T("Gitarre einstellen:")+"\n"+de.join("\n");
}

//==STATE
/* ---------- Gitarren-Schaltung ---------- */
let gw="schecter",st2=null;
function defaultState(k){const g=G[k];const s={pos:g.positions[Math.min(1,g.positions.length-1)].k,split:false};g.pots.forEach(([p])=>s[p]=10);if(k==="strat")s.pos="2";return s}
st2=defaultState(gw);
function active(){const g=G[gw];const pos=g.positions.find(p=>p.k===st2.pos)||g.positions[0];
  return g.pickups.map(p=>{const on=pos.on.includes(p.id);let coils=p.kind==="hb"?[on,on&&!(g.split&&st2.split)]:[on];
    let vol=gw==="gibson"?(p.id==="N"?st2.vol1:st2.vol2):st2.vol;
    let tone=gw==="gibson"?(p.id==="N"?st2.tone1:st2.tone2):gw==="strat"?(p.id==="N"?st2.tone1:p.id==="M"?st2.tone2:10):st2.tone;
    return {p,on,coils,vol:vol??10,tone:tone??10}})}
function model(){const A=active().filter(a=>a.on);const g=G[gw];
  if(!A.length)return {f:0,q:0,out:0,hum:0};
  // Induktivität (H) grob: Single 2.6, Humbucker seriell 4.4, Split 2.2
  const Lp=a=>a.p.kind==="hb"?(a.coils[1]?4.4:2.2):2.6;
  let L=A.length>1?1/A.reduce((t,a)=>t+1/Lp(a),0):Lp(A[0]);
  const C=650e-12;let f=1/(2*Math.PI*Math.sqrt(L*C));
  const vol=Math.max(...A.map(a=>a.vol)),tone=Math.min(...A.map(a=>a.tone));
  // Tone runter: Spitze sinkt & flacher; Volume runter: Höhen gehen etwas verloren
  const tf=0.35+0.65*Math.pow(tone/10,1.6);f*=tf;f*=1+(1-vol/10)*0.15;
  let q=2.6*Math.pow(tone/10,1.3)+0.6;if(vol<10)q*=0.75+0.25*vol/10;
  const outBase=A.reduce((t,a)=>t+(a.p.kind==="hb"&&a.coils[1]?1:0.65),0)/A.length*(A.length>1?0.85:1);
  const out=outBase*vol/10;
  const hum=A.some(a=>a.p.kind==="hb"&&a.coils[1])||(gw==="strat"&&A.length===2)?0:1;
  return {f,q,out,hum,L}}
let showW=true,LEG=[],view3d=true,GEO=null;
function levels(){const g=G[gw],A=active();const base=a=>a.p.kind==="hb"?(a.coils[1]?(gw==="schecter"?560:450):230):(a.p.id==="M"?190:a.p.id==="B"?230:200);
  const raw={},pu={};A.forEach(a=>{raw[a.p.id]=a.on?base(a):0;pu[a.p.id]=gw==="gibson"?raw[a.p.id]*a.vol/10:raw[a.p.id]});
  const act=A.filter(a=>a.on);const sw=act.length?act.reduce((t,a)=>t+pu[a.p.id],0)/act.length*(act.length>1?0.9:1):0;
  const out=gw==="gibson"?sw:sw*st2.vol/10;return {raw,pu,sw,out,load:gw==="strat"?200:330}}
//==SVG
const SHORT={vol:"Vol",tone:"Tone",tone1:"T1",tone2:"T2",vol1:"V1",vol2:"V2"};
function guitarSVG(g,A,M){
 const T=gw; // schecter | strat | gibson
 const cx=180,nutY=126,scale=520,bridgeY=nutY+scale;
 const fretY=n=>nutY+scale*(1-Math.pow(2,-n/12));
 const nFrets=T==="gibson"?22:T==="strat"?21:22,fbEnd=fretY(nFrets)+8;
 const nw=y=>{const t=(y-nutY)/(fbEnd-nutY);return 21+t*6}; // halbe Halsbreite
 const font='font-family="-apple-system,BlinkMacSystemFont,sans-serif"';
 let s=`<defs>
 <linearGradient id="rgs-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbfb"/><stop offset=".45" stop-color="#a9adb3"/><stop offset=".55" stop-color="#7d8188"/><stop offset="1" stop-color="#e8eaee"/></linearGradient>
 <linearGradient id="rgs-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#c9952e"/><stop offset="1" stop-color="#f3d27a"/></linearGradient>
 <linearGradient id="rgs-rose" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#24140a"/><stop offset=".5" stop-color="#3d2414"/><stop offset="1" stop-color="#22120a"/></linearGradient>
 <linearGradient id="rgs-maple" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9954f"/><stop offset=".5" stop-color="#e9c789"/><stop offset="1" stop-color="#c38d48"/></linearGradient>
 <radialGradient id="rgs-burstS" cx=".5" cy=".62" r=".62"><stop offset="0" stop-color="#f6b443"/><stop offset=".45" stop-color="#d77a22"/><stop offset=".7" stop-color="#7a2a0c"/><stop offset=".88" stop-color="#2a0d04"/><stop offset="1" stop-color="#120502"/></radialGradient>
 <radialGradient id="rgs-burstG" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="#f3c06a"/><stop offset=".4" stop-color="#d9662a"/><stop offset=".72" stop-color="#8e1410"/><stop offset=".92" stop-color="#3a0405"/><stop offset="1" stop-color="#1a0203"/></radialGradient>
 <linearGradient id="rgs-greyS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b5b58"/><stop offset=".5" stop-color="#3b3b39"/><stop offset="1" stop-color="#252524"/></linearGradient>
 <radialGradient id="rgs-shine" cx=".35" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
 <radialGradient id="rgs-glow"><stop offset="0" stop-color="#ffb340" stop-opacity=".95"/><stop offset=".55" stop-color="#ff8a00" stop-opacity=".35"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></radialGradient>
 <radialGradient id="rgs-kWhite" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#ece7d8"/><stop offset="1" stop-color="#b9b29f"/></radialGradient>
 <radialGradient id="rgs-kGold" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff3c4"/><stop offset=".6" stop-color="#d6a23c"/><stop offset="1" stop-color="#7a5513"/></radialGradient>
 <radialGradient id="rgs-kBlack" cx=".4" cy=".3" r=".75"><stop offset="0" stop-color="#6a6a6a"/><stop offset=".55" stop-color="#1c1c1c"/><stop offset="1" stop-color="#050505"/></radialGradient>
 <filter id="rgs-flame" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.11" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 .85  0 0 0 0 .6  0 0 0 .55 -.18"/><feComposite in2="SourceGraphic" operator="in"/></filter>
 <filter id="rgs-satin" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .08 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
 <filter id="rgs-sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity=".55"/></filter>
 <filter id="rgs-sh2" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-opacity=".6"/></filter>
 </defs>`;
 /* ---- Korpus ---- */
 const BODY={
  strat:"M207,445 C214,445 221,428 225,408 C229,386 240,368 258,365 C278,362 292,380 289,408 C286,434 274,456 274,480 C274,508 300,526 310,572 C322,632 312,708 266,742 C230,766 130,766 94,742 C48,708 38,632 50,572 C60,526 86,508 86,480 C86,452 68,420 72,380 C76,346 96,330 115,334 C134,339 137,368 137,398 C137,424 145,445 153,445 Z",
  gibson:"M153,445 C136,434 108,428 90,440 C66,456 62,494 68,522 C72,548 50,582 46,632 C40,716 104,768 180,768 C256,768 320,716 314,632 C310,584 290,554 292,526 C294,500 304,474 294,454 C285,438 268,436 258,447 C250,456 246,470 234,476 C224,481 213,474 207,445 Z",
  schecter:"M153,445 C130,436 98,432 86,456 C76,478 78,520 74,560 C68,610 60,660 68,700 C78,748 126,764 180,764 C234,764 284,750 292,704 C298,668 290,620 286,580 C282,540 284,500 284,470 C284,448 272,440 257,442 C243,444 235,462 223,470 C215,470 210,458 207,445 Z"};
 const FILL={strat:"url(#rgs-burstS)",gibson:"url(#rgs-burstG)",schecter:"url(#rgs-greyS)"}[T];
 s+=`<path d="${BODY[T]}" fill="${FILL}" filter="url(#rgs-sh)"/>`;
 if(T==="gibson")s+=`<path d="${BODY[T]}" fill="#000" filter="url(#rgs-flame)" opacity=".75"/><path d="${BODY[T]}" fill="none" stroke="#3a0a06" stroke-width="2"/>`;
 if(T==="schecter")s+=`<path d="${BODY[T]}" fill="#000" filter="url(#rgs-satin)"/><path d="${BODY[T]}" fill="none" stroke="#6a5a48" stroke-width="1.2" opacity=".7"/>`;
 if(T==="strat")s+=`<path d="${BODY[T]}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
 s+=`<path d="${BODY[T]}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="10" style="filter:blur(4px)" clip-path="url(#rgs-bc)"/><clipPath id="rgs-bc"><path d="${BODY[T]}"/></clipPath>`;
 if(T==="gibson")s+=`<path d="M180,500 C120,500 90,560 92,640 C94,710 140,742 180,742 C220,742 266,710 268,640 C270,560 240,500 180,500 Z" fill="#fff" opacity=".07"/>`;
 s+=`<path d="${BODY[T]}" fill="url(#rgs-shine)"/>`;
 /* ---- Schlagbrett ---- */
 if(T==="strat")s+=`<path d="M150,445 C122,445 110,470 104,505 C96,560 88,620 112,668 C134,708 190,712 215,700 C240,735 285,727 293,690 C299,655 286,620 277,590 C267,545 252,480 234,457 C224,447 212,445 207,445 Z" fill="#f3efe4" stroke="#cfc8b6" stroke-width="2.5" filter="url(#rgs-sh2)"/>`+
   [[118,470],[103,560],[112,662],[180,706],[250,722],[288,680],[272,590],[238,470],[180,452]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.2" fill="url(#rgs-chrome)" stroke="#999" stroke-width=".4"/>`).join("");

 /* ---- Hals ---- */
 const fb=T==="strat"?"url(#rgs-maple)":"url(#rgs-rose)";
 s+=`<path d="M${cx-21},${nutY} L${cx+21},${nutY} L${cx+nw(fbEnd)},${fbEnd} L${cx-nw(fbEnd)},${fbEnd} Z" fill="${fb}" filter="url(#rgs-sh2)"/>`;
 if(T==="gibson")s+=`<path d="M${cx-21},${nutY} L${cx-nw(fbEnd)},${fbEnd} M${cx+21},${nutY} L${cx+nw(fbEnd)},${fbEnd}" stroke="#efe6cf" stroke-width="1.6"/>`;
 for(let n=1;n<=nFrets;n++){const y=fretY(n),w=nw(y);s+=`<line x1="${cx-w}" x2="${cx+w}" y1="${y}" y2="${y}" stroke="url(#rgs-chrome)" stroke-width="1.6"/>`}
 const dot=n=>{const y=(fretY(n-1)+fretY(n))/2;return n===12||n===24?`<circle cx="${cx-8}" cy="${y}" r="3.2" fill="${T==="strat"?"#1b1b1b":"#efe9dc"}"/><circle cx="${cx+8}" cy="${y}" r="3.2" fill="${T==="strat"?"#1b1b1b":"#efe9dc"}"/>`:`<circle cx="${cx}" cy="${y}" r="3.2" fill="${T==="strat"?"#1b1b1b":"#efe9dc"}"/>`};
 [3,5,7,9,12,15,17,19,21].filter(n=>n<=nFrets).forEach(n=>s+=dot(n));
 /* ---- Kopfplatte (generisch) ---- */
 const HS={
  strat:`M${cx+22},${nutY} C${cx+20},90 ${cx+14},40 ${cx+10},20 C${cx+6},6 ${cx-6},4 ${cx-20},8 L${cx-46},14 C${cx-58},17 ${cx-58},30 ${cx-52},40 L${cx-44},74 L${cx-37},100 C${cx-33},${nutY-8} ${cx-28},${nutY} ${cx-22},${nutY} Z`,
  schecter:`M${cx+22},${nutY} L${cx+14},16 L${cx-8},4 L${cx-54},10 L${cx-52},40 L${cx-44},74 L${cx-37},100 C${cx-33},${nutY-8} ${cx-28},${nutY} ${cx-22},${nutY} Z`,
  gibson:`M${cx-22},${nutY} C${cx-30},104 ${cx-42},70 ${cx-40},30 L${cx-34},6 C${cx-12},12 ${cx+12},12 ${cx+34},6 L${cx+40},30 C${cx+42},70 ${cx+30},104 ${cx+22},${nutY} Z`};
 const hsFill=T==="strat"?"url(#rgs-maple)":"#111";
 s+=`<path d="${HS[T]}" fill="${hsFill}" stroke="${T==="strat"?"#a8773a":"#6a6a6a"}" stroke-width="1.2" filter="url(#rgs-sh)"/>`;
 if(T==="gibson")s+=`<path d="M${cx-8},16 L${cx},11 L${cx+8},16 L${cx},22 Z" fill="#efe9dc" opacity=".85"/>`;
 // Mechaniken
 const posts=[];if(T==="gibson"){[0,1,2].forEach(i=>{const y=34+i*30;posts.push([cx-26,y,-1],[cx+26,y,1])})}
 else{for(let i=0;i<6;i++){posts.push([cx-38+i*5.2,24+i*17,-1])}}
 posts.forEach(([x,y,side])=>{const bx=T==="gibson"?x+side*22:x-24;s+=`<rect x="${Math.min(x,bx)}" y="${y-2.5}" width="${Math.abs(bx-x)}" height="5" fill="url(#rgs-chrome)"/><rect x="${bx-(T==="gibson"?(side>0?0:10):10)}" y="${y-6}" width="10" height="12" rx="4" fill="${T==="gibson"?"url(#rgs-kWhite)":"url(#rgs-chrome)"}" stroke="#777" stroke-width=".5"/><circle cx="${x}" cy="${y}" r="4.6" fill="url(#rgs-chrome)" stroke="#666" stroke-width=".6"/><circle cx="${x}" cy="${y}" r="1.6" fill="#555"/>`});
 if(T==="strat")s+=`<rect x="${cx-8}" y="46" width="12" height="5" rx="2" fill="url(#rgs-chrome)"/>`;
 s+=`<rect x="${cx-22}" y="${nutY-4}" width="44" height="5" rx="1" fill="#efe8d6"/>`;
 /* ---- Pickups ---- */
 const isS=T==="strat";const PY=isS?{N:fbEnd+28,M:fbEnd+76,B:bridgeY-32}:{N:fbEnd+30,B:bridgeY-38};
 A.forEach(a=>{const y=PY[a.p.id];if(a.on)s+=`<ellipse cx="${cx}" cy="${y}" rx="${70+25*a.vol/10}" ry="${30+10*a.vol/10}" fill="url(#rgs-glow)" opacity="${Math.max(.25,a.vol/10)}"/>`});
 A.forEach(a=>{const y=PY[a.p.id];
  if(a.p.kind==="sc"){const tilt=a.p.id==="B"?-9:0;
   s+=`<g transform="rotate(${tilt} ${cx} ${y})"><rect x="${cx-40}" y="${y-10.5}" width="80" height="21" rx="10.5" fill="#f4f0e3" stroke="${a.on?"#ff9f0a":"#c9c2ad"}" stroke-width="${a.on?2.5:1}" filter="url(#rgs-sh2)"/>`+
     [0,1,2,3,4,5].map(i=>`<circle cx="${cx-25+i*10}" cy="${y}" r="3" fill="${a.on?"#ff9f0a":"url(#rgs-chrome)"}" stroke="#777" stroke-width=".4"/>`).join("")+`</g>`;}
  else{const ring=T==="gibson"?"#ece2c8":"#111";s+=`<rect x="${cx-47}" y="${y-26}" width="94" height="52" rx="6" fill="${ring}" filter="url(#rgs-sh2)"/>`;
   [0,1].forEach(c=>{const on=a.coils[c],yy=y-19+c*19;s+=`<rect x="${cx-40}" y="${yy}" width="80" height="18" rx="3" fill="${T==="gibson"?"#1a1a1a":"#0e0e0e"}" stroke="${on?"#ff9f0a":"#333"}" stroke-width="${on?2.4:1}"/>`;
    if(on)s+=`<rect x="${cx-40}" y="${yy}" width="80" height="18" rx="3" fill="#ff9f0a" opacity=".28"/>`;
    s+=[0,1,2,3,4,5].map(i=>{const px=cx-25+i*10,py=yy+9;return c===0?`<circle cx="${px}" cy="${py}" r="3" fill="url(#rgs-chrome)"/><line x1="${px-2.2}" y1="${py}" x2="${px+2.2}" y2="${py}" stroke="#444" stroke-width=".8"/>`:`<circle cx="${px}" cy="${py}" r="2.8" fill="url(#rgs-chrome)"/>`}).join("")});
   s+=[[-43,-22],[43,-22],[-43,22],[43,22]].map(([dx,dy])=>`<circle cx="${cx+dx}" cy="${y+dy}" r="1.8" fill="url(#rgs-chrome)"/>`).join("")}
  const lab=a.p.name+(a.p.kind==="hb"&&a.on?(a.coils[1]?" · 2 Spulen":" · 1 Spule"):"")+(a.p.rw?" · RW/RP":"");
  const lw=lab.length*6.1+12;s+=`<g ${font}><rect x="${cx-50-lw}" y="${y-10}" width="${lw}" height="20" rx="10" fill="${a.on?"#ff9f0a":"rgba(0,0,0,.6)"}"/><text x="${cx-56}" y="${y+4}" text-anchor="end" font-size="11" font-weight="600" fill="${a.on?"#000":"#ddd"}">${lab}</text></g>`});
 /* ---- Brücke ---- */
 if(T==="strat"){s+=`<rect x="${cx-38}" y="${bridgeY-12}" width="76" height="34" rx="3" fill="url(#rgs-chrome)" filter="url(#rgs-sh2)"/>`+[0,1,2,3,4,5].map(i=>`<rect x="${cx-33+i*11.4}" y="${bridgeY-8}" width="9" height="${14+(i%2)*2}" rx="1.5" fill="#d9dce0" stroke="#888" stroke-width=".5"/>`).join("")+[0,1,2,3,4,5].map(i=>`<circle cx="${cx-30+i*12}" cy="${bridgeY+16}" r="1.6" fill="#777"/>`).join("")+`<line x1="${cx+36}" y1="${bridgeY+10}" x2="${cx+62}" y2="${bridgeY+30}" stroke="url(#rgs-chrome)" stroke-width="3" stroke-linecap="round"/>`}
 else if(T==="gibson"){s+=`<rect x="${cx-42}" y="${bridgeY-5}" width="84" height="10" rx="5" fill="url(#rgs-chrome)" filter="url(#rgs-sh2)"/>`+[0,1,2,3,4,5].map(i=>`<rect x="${cx-27+i*10.4}" y="${bridgeY-4}" width="6" height="8" fill="#c8ccd2" stroke="#777" stroke-width=".4"/>`).join("")+`<rect x="${cx-44}" y="${bridgeY+24}" width="88" height="12" rx="6" fill="url(#rgs-chrome)" filter="url(#rgs-sh2)"/>`}
 else{s+=`<rect x="${cx-40}" y="${bridgeY-14}" width="80" height="40" rx="3" fill="#161616" stroke="#4a4a4a" filter="url(#rgs-sh2)"/>`+[0,1,2,3,4,5].map(i=>`<circle cx="${cx-28+i*11.2}" cy="${bridgeY+19}" r="2" fill="#000" stroke="#555" stroke-width=".5"/>`).join("")+[0,1,2,3,4,5].map(i=>`<rect x="${cx-34+i*11.6}" y="${bridgeY-8}" width="9" height="16" rx="1.5" fill="#2a2a2a" stroke="#666" stroke-width=".6"/>`).join("")}
 /* ---- Saiten ---- */
 const endY=T==="gibson"?bridgeY+30:bridgeY;
 for(let i=0;i<6;i++){const xn=cx-17+i*6.8,xb=cx-28+i*11.2;const p=posts[T==="gibson"?[4,2,0,1,3,5][i]:5-i];
  s+=`<line x1="${p[0]}" y1="${p[1]}" x2="${xn}" y2="${nutY}" stroke="#e7e7e7" stroke-width="${0.5+(5-i)*0.18}" opacity=".9"/><line x1="${xn}" y1="${nutY}" x2="${xb}" y2="${endY}" stroke="${i<3?"#d8c49a":"#e7e7e7"}" stroke-width="${0.5+(5-i)*0.18}" opacity=".95"/>`}
 /* ---- Verkabelung (Röntgenblick) ---- */
 if(showW){const LV=levels();const SW={strat:[250,598],gibson:[104,474],schecter:[224,641]}[T];const JK={strat:[296,700],gibson:[314,705],schecter:[292,728]}[T];
  const KPw={strat:[[234,650],[252,682],[262,714]],gibson:[[240,666],[278,650],[250,708],[288,692]],schecter:[[249,665],[273,687]]}[T];
  const col=mv=>mv<=0?"#5a5a5e":`hsl(${Math.max(8,40-mv/30)},100%,${Math.min(62,45+mv/40)}%)`;
  const wd=mv=>mv<=0?1.1:Math.min(3.6,1.3+mv/220);let nr=0;LEG=[];
  const W=(x1,y1,x2,y2,mv,bend,lab)=>{const mx=(x1+x2)/2+(bend||0),my=(y1+y2)/2;const on=mv>0;
    let r=`<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="${wd(mv)+2.4}" stroke-linecap="round"/><path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="${col(mv)}" stroke-width="${wd(mv)}" stroke-linecap="round" ${on?"":'stroke-dasharray="3 4"'}/>`;
    if(on&&lab!==false){nr++;const bx=(x1+2*mx+x2)/4,by=(y1+2*my+y2)/4;LEG.push({n:nr,t:lab,mv,c:col(mv)});
      r+=`<circle cx="${bx}" cy="${by}" r="7" fill="#000" stroke="${col(mv)}" stroke-width="1.6"/><text x="${bx}" y="${by+3.3}" text-anchor="middle" ${font} font-size="9" font-weight="800" fill="#fff">${nr}</text>`}
    return r};
  // Fräsungen andeuten
  s+=`<g opacity=".5">`+A.map(a=>{const y=PY[a.p.id];return a.p.kind==="hb"?`<rect x="${cx-45}" y="${y-24}" width="90" height="48" rx="5" fill="none" stroke="#9ad" stroke-width="1" stroke-dasharray="3 3"/>`:`<rect x="${cx-42}" y="${y-12}" width="84" height="24" rx="11" fill="none" stroke="#9ad" stroke-width="1" stroke-dasharray="3 3"/>`}).join("")+
    `<path d="M${Math.min(...KPw.map(k=>k[0]))-20},${Math.min(...KPw.map(k=>k[1]))-20} h${Math.max(...KPw.map(k=>k[0]))-Math.min(...KPw.map(k=>k[0]))+40} v${Math.max(...KPw.map(k=>k[1]))-Math.min(...KPw.map(k=>k[1]))+40} h-${Math.max(...KPw.map(k=>k[0]))-Math.min(...KPw.map(k=>k[0]))+40} Z" fill="none" stroke="#9ad" stroke-width="1" stroke-dasharray="3 3" rx="10"/></g>`;
  // Pickups -> Schalter bzw. Volume
  A.forEach(a=>{const y=PY[a.p.id];const mv=LV.pu[a.p.id];
    if(T==="gibson"){const vi=a.p.id==="N"?0:1,[vx,vy]=KPw[vi],[tx,ty]=KPw[vi+2];s+=W(cx+44,y,vx,vy,LV.raw[a.p.id],30,a.p.name+" → Volume")+W(vx,vy,tx,ty,LV.raw[a.p.id]>0&&(a.p.id==="N"?st2.tone1:st2.tone2)<10?LV.raw[a.p.id]*(1-(a.p.id==="N"?st2.tone1:st2.tone2)/10)*.6:0,8,false)+W(vx,vy,SW[0],SW[1],mv,a.p.id==="N"?-30:-75,(a.p.id==="N"?"Volume Neck":"Volume Bridge")+" → Toggle")}
    else s+=W(cx+(a.p.kind==="sc"?40:44),y,SW[0],SW[1],mv,22,a.p.name+" → Schalter")});
  if(T==="gibson")s+=W(SW[0],SW[1],JK[0],JK[1],LV.out,90,"Toggle → Buchse");
  else{const [vx,vy]=KPw[0];s+=W(SW[0],SW[1],vx,vy,LV.sw,-14,"Schalter → Volume")+W(vx,vy,JK[0],JK[1],LV.out,10,"Volume → Buchse");
    if(T==="strat"){[["N",1,"tone1"],["M",2,"tone2"]].forEach(([id,i,k])=>{const mv=LV.pu[id]>0&&st2[k]<10?LV.pu[id]*(1-st2[k]/10)*.6:0;s+=W(SW[0],SW[1],KPw[i][0],KPw[i][1],mv,18,false)})}
    else{const mv=LV.sw>0&&st2.tone<10?LV.sw*(1-st2.tone/10)*.6:0;s+=W(vx,vy,KPw[1][0],KPw[1][1],mv,6,false)}}
  s+=`<circle cx="${SW[0]}" cy="${SW[1]}" r="4" fill="${LV.sw>0?"#ff9f0a":"#666"}"/>`;
 }
 /* ---- Regler ---- */
 const KP={strat:[[234,650],[252,682],[262,714]],gibson:[[240,666],[278,650],[250,708],[288,692]],schecter:[[249,665],[273,687]]}[T];
 const kf={strat:"url(#rgs-kWhite)",gibson:"url(#rgs-kGold)",schecter:"url(#rgs-kBlack)"}[T];
 if(T==="schecter")s+=`<g transform="rotate(42 255 672)"><rect x="198" y="657" width="114" height="30" rx="15" fill="#1d1d1d" stroke="#555" filter="url(#rgs-sh2)"/></g>`;
 g.pots.forEach(([k,l],i)=>{const [x,y]=KP[i],v=st2[k]??10,ang=-150+v/10*300;
  s+=`<g filter="url(#rgs-sh2)"><circle cx="${x}" cy="${y}" r="13" fill="${kf}" stroke="${T==="schecter"?"#000":"#8c8572"}" stroke-width=".8"/>${T==="strat"?`<circle cx="${x}" cy="${y}" r="8.5" fill="none" stroke="#cfc8b4" stroke-width="1"/>`:""}<line x1="${x}" y1="${y}" x2="${x+11*Math.sin(ang*Math.PI/180)}" y2="${y-11*Math.cos(ang*Math.PI/180)}" stroke="${T==="schecter"?"#e5e5e5":"#222"}" stroke-width="2" stroke-linecap="round"/></g>`+
  `<text x="${x}" y="${y+24}" text-anchor="middle" ${font} font-size="8.5" font-weight="700" fill="#fff" stroke="#000" stroke-width="2.6" paint-order="stroke">${(SHORT[k]||l)} ${fmtK(v)}</text>`});
 /* ---- Wahlschalter ---- */
 const idx=g.positions.findIndex(p=>p.k===st2.pos),n=g.positions.length;
 if(T==="strat"){const x0=250,y0=598,ang=-35;const t=n>1?idx/(n-1):0;
  s+=`<g transform="rotate(${ang} ${x0} ${y0})"><rect x="${x0-4}" y="${y0-26}" width="8" height="52" rx="4" fill="#222"/><rect x="${x0-7}" y="${y0-34+t*52}" width="14" height="16" rx="6" fill="url(#rgs-kWhite)" stroke="#999" stroke-width=".6" filter="url(#rgs-sh2)"/></g>`}
 else{const [x0,y0]=T==="gibson"?[104,474]:[224,641];const ang=[-28,0,28][idx]*(T==="gibson"?1:-1);
  s+=`<circle cx="${x0}" cy="${y0}" r="${T==="gibson"?13:9}" fill="${T==="gibson"?"#efe6cf":"url(#rgs-chrome)"}" filter="url(#rgs-sh2)"/><circle cx="${x0}" cy="${y0}" r="5" fill="url(#rgs-chrome)"/><g transform="rotate(${ang} ${x0} ${y0})"><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0-20}" stroke="url(#rgs-chrome)" stroke-width="3"/><circle cx="${x0}" cy="${y0-22}" r="5" fill="${T==="gibson"?"url(#rgs-kWhite)":"url(#rgs-kBlack)"}" stroke="#666" stroke-width=".5"/></g>`;
  if(T==="gibson")s+=`<text x="${x0}" y="${y0+26}" text-anchor="middle" ${font} font-size="8" fill="#efe6cf">RHYTHM · TREBLE</text>`}
 /* ---- Buchse & Gurtpins ---- */
 const J={strat:[296,700],gibson:[314,705],schecter:[292,728]}[T];
 s+=`<ellipse cx="${J[0]}" cy="${J[1]}" rx="7" ry="10" fill="url(#rgs-chrome)" filter="url(#rgs-sh2)"/><circle cx="${J[0]}" cy="${J[1]}" r="3" fill="#111"/>`;
 s+=`<circle cx="180" cy="${T==="gibson"?770:T==="strat"?768:764}" r="4" fill="url(#rgs-chrome)"/>`;
 GEO={T,body:BODY[T],hs:HS[T],nutY,fbEnd,bridgeY,nFrets,PY,KP,J,posts,SWP:{strat:[250,598],gibson:[104,474],schecter:[224,641]}[T],nw0:21,nw1:nw(fbEnd)};
 s+=`<text x="180" y="796" text-anchor="middle" ${font} font-size="12" fill="#fff" opacity=".85">${M.out?"An der Buchse ca. "+Math.round(levels().out)+" mV · "+(levels().out/levels().load).toFixed(1).replace(".",",")+" µA":"stumm"}</text>`;
 return s}

function wiringSVG(){const g=G[gw],A=active(),T=gw;const ON="#ff9f0a",OFF="#4a4a4c",GN="#8e8e93";
 const F='font-family="-apple-system,BlinkMacSystemFont,sans-serif"';
 const wire=(pts,on,op)=>`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${on?ON:OFF}" stroke-width="${on?3:2}" stroke-linejoin="round" opacity="${op??1}"/>`;
 const txt=(x,y,t,o={})=>`<text x="${x}" y="${y}" ${F} font-size="${o.s||10}" font-weight="${o.w||600}" fill="${o.c||"#ddd"}" text-anchor="${o.a||"middle"}">${t}</text>`;
 const coil=(x,y,on)=>{let d=`M${x},${y}`;for(let i=0;i<4;i++)d+=` a5,6 0 1,1 10,0`;return `<path d="${d}" fill="none" stroke="${on?ON:OFF}" stroke-width="${on?3:2}"/>`+(on?`<path d="${d}" fill="none" stroke="${ON}" stroke-width="8" opacity=".25"/>`:"")};
 const gnd=(x,y)=>`<line x1="${x}" y1="${y}" x2="${x}" y2="${y+6}" stroke="${GN}" stroke-width="1.6"/><line x1="${x-8}" y1="${y+6}" x2="${x+8}" y2="${y+6}" stroke="${GN}" stroke-width="1.6"/><line x1="${x-5}" y1="${y+10}" x2="${x+5}" y2="${y+10}" stroke="${GN}" stroke-width="1.6"/><line x1="${x-2}" y1="${y+14}" x2="${x+2}" y2="${y+14}" stroke="${GN}" stroke-width="1.6"/>`;
 const pot=(x,y,lab,v,on)=>{let d=`M${x-22},${y}`;for(let i=0;i<6;i++)d+=` l3.6,${i%2?7:-7} l3.6,${i%2?-7:7}`;const wx=x-22+44*v/10;
   return `<path d="${d}" fill="none" stroke="${on?ON:OFF}" stroke-width="2"/><polygon points="${wx},${y-9} ${wx-4},${y-16} ${wx+4},${y-16}" fill="${on?ON:"#bbb"}"/>`+txt(x,y+20,`${lab} ${fmtK(v)}`,{s:9.5})};
 const cap=(x,y,on,op,lab)=>`<line x1="${x-9}" y1="${y}" x2="${x+9}" y2="${y}" stroke="${on?ON:OFF}" stroke-width="2.4" opacity="${op}"/><line x1="${x-9}" y1="${y+6}" x2="${x+9}" y2="${y+6}" stroke="${on?ON:OFF}" stroke-width="2.4" opacity="${op}"/>`+txt(x+14,y+6,lab,{s:8.5,a:"start",c:"#aaa",w:500});
 const jack=(x,y,on)=>`<circle cx="${x}" cy="${y}" r="13" fill="#1c1c1e" stroke="${on?ON:OFF}" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="4" fill="${on?ON:"#666"}"/>`+txt(x,y+28,"Buchse",{s:9.5});
 const dot=(x,y,on)=>`<circle cx="${x}" cy="${y}" r="3" fill="${on?ON:OFF}"/>`;
 let s="";const outOn=A.some(a=>a.on);
 const byId=id=>A.find(a=>a.p.id===id);
 if(T==="strat"){const Y={N:40,M:100,B:160};const vol=st2.vol;
  s+=`<line x1="10" y1="30" x2="10" y2="262" stroke="${GN}" stroke-width="1.6"/><line x1="10" y1="262" x2="350" y2="262" stroke="${GN}" stroke-width="1.6"/>`+gnd(350,262);
  ["N","M","B"].forEach(id=>{const a=byId(id),y=Y[id];s+=`<line x1="10" y1="${y}" x2="22" y2="${y}" stroke="${GN}" stroke-width="1.6"/>`+coil(22,y,a.on)+txt(42,y-12,a.p.name+(a.p.rw?" (RW/RP)":""),{s:9.5,c:a.on?"#fff":"#888"})+wire([[62,y],[170,y]],a.on)+dot(170,y,a.on)});
  // Tone-Zweige
  [["N","tone1",112],["M","tone2",142]].forEach(([id,k,x])=>{const a=byId(id),v=st2[k],act=a.on&&v<10;s+=dot(x,Y[id],a.on)+wire([[x,Y[id]],[x,200]],act,act?1:.6)+`<g transform="rotate(90 ${x} 212)">${pot(x,212,"",v,act).replace(/<text[^>]*>[^<]*<\/text>/,"")}</g>`+txt(x+(id==="N"?-18:18),215,(id==="N"?"T1 ":"T2 ")+fmtK(v),{s:9,a:id==="N"?"end":"start"})+cap(x,238,act,act?Math.max(.35,1-v/10):.6,"")+wire([[x,244],[x,262]],false)});
  s+=txt(127,256,"47 nF",{s:8.5,c:"#aaa",w:500});
  // Schalter
  s+=`<rect x="166" y="22" width="34" height="156" rx="8" fill="none" stroke="#636366" stroke-width="1.4" stroke-dasharray="4 3"/>`+txt(183,16,"5-Weg",{s:9.5});
  const act=g.positions.find(p=>p.k===st2.pos).on;act.forEach(id=>{s+=wire([[170,Y[id]],[194,100]],true)});
  s+=dot(194,100,outOn)+wire([[194,100],[248,100]],outOn)+`<g transform="translate(0,0)">${pot(270,100,"Vol",vol,outOn&&vol>0)}</g>`+wire([[270,84],[270,74],[300,74],[300,100],[322,100]],outOn&&vol>0)+jack(336,100,outOn&&vol>0)+wire([[292,100],[292,130],[292,262]],false);
 }
 else if(T==="gibson"){const Y={N:55,B:175};
  s+=`<line x1="10" y1="40" x2="10" y2="262" stroke="${GN}" stroke-width="1.6"/><line x1="10" y1="262" x2="360" y2="262" stroke="${GN}" stroke-width="1.6"/>`+gnd(360,262);
  ["N","B"].forEach(id=>{const a=byId(id),y=Y[id],v=id==="N"?st2.vol1:st2.vol2,t=id==="N"?st2.tone1:st2.tone2;const on=a.on;
   s+=`<line x1="10" y1="${y}" x2="20" y2="${y}" stroke="${GN}" stroke-width="1.6"/>`+coil(20,y,on)+coil(60,y,on)+txt(60,y-14,a.p.name+" · Humbucker",{s:9.5,c:on?"#fff":"#888"})+
   wire([[100,y],[120,y]],on)+pot(142,y,id==="N"?"V1":"V2",v,on)+wire([[142,y-16],[142,y-24],[178,y-24],[178,y],[262,y]],on&&v>0)+
   dot(205,y,on)+wire([[205,y],[205,y+22]],on&&t<10,on&&t<10?1:.6)+`<g transform="rotate(90 205 ${y+34})">${pot(205,y+34,"",t,on&&t<10).replace(/<text[^>]*>[^<]*<\/text>/,"")}</g>`+txt(222,y+38,(id==="N"?"T1 ":"T2 ")+fmtK(t),{s:9,a:"start"})+cap(205,y+62,on&&t<10,on&&t<10?Math.max(.35,1-t/10):.6,"22 nF")+(id==="N"?"":wire([[205,y+68],[205,262]],false))});
  s+=wire([[205,55+68],[205,140],[10,140]],false);
  s+=`<rect x="258" y="40" width="34" height="150" rx="8" fill="none" stroke="#636366" stroke-width="1.4" stroke-dasharray="4 3"/>`+txt(275,34,"Toggle",{s:9.5});
  const act=g.positions.find(p=>p.k===st2.pos).on;act.forEach(id=>s+=wire([[262,Y[id]],[288,115]],true));["N","B"].forEach(id=>s+=dot(262,Y[id],act.includes(id)));
  const o=act.some(id=>(id==="N"?st2.vol1:st2.vol2)>0);s+=dot(288,115,o)+wire([[288,115],[323,115]],o)+jack(338,115,o);
 }
 else{const Y={N:55,B:160};const sp=st2.split;
  s+=`<line x1="10" y1="40" x2="10" y2="262" stroke="${GN}" stroke-width="1.6"/><line x1="10" y1="262" x2="360" y2="262" stroke="${GN}" stroke-width="1.6"/>`+gnd(360,262);
  ["N","B"].forEach(id=>{const a=byId(id),y=Y[id];const on=a.on;
   s+=`<line x1="10" y1="${y}" x2="20" y2="${y}" stroke="${GN}" stroke-width="1.6"/>`+coil(20,y,on&&!sp)+coil(60,y,on)+txt(60,y-14,a.p.name+(sp?" · Split (1 Spule)":" · Humbucker"),{s:9.5,c:on?"#fff":"#888"});
   // Split: Verbindungspunkt zwischen den Spulen gegen Masse
   s+=dot(60,y,false)+`<polyline points="60,${y} 60,${y+22} 36,${y+22}" fill="none" stroke="${sp?"#64d2ff":"#3a3a3c"}" stroke-width="2" stroke-dasharray="${sp?"0":"3 3"}"/><line x1="36" y1="${y+22}" x2="10" y2="${y+22}" stroke="${sp?"#64d2ff":"#3a3a3c"}" stroke-width="2"/>`+txt(40,y+34,sp?"Split: Spule kurzgeschlossen":"Split offen",{s:8.5,a:"start",c:sp?"#64d2ff":"#777",w:500});
   s+=wire([[100,y],[166,y]],on)+dot(166,y,on)});
  s+=`<rect x="162" y="38" width="34" height="140" rx="8" fill="none" stroke="#636366" stroke-width="1.4" stroke-dasharray="4 3"/>`+txt(179,32,"3-Weg",{s:9.5});
  const act=g.positions.find(p=>p.k===st2.pos).on;act.forEach(id=>s+=wire([[166,Y[id]],[192,108]],true));
  const vol=st2.vol,t=st2.tone,o=outOn&&vol>0;
  s+=dot(192,108,outOn)+wire([[192,108],[226,108]],outOn)+pot(248,108,"Vol",vol,o)+wire([[248,92],[248,82],[290,82],[290,108],[322,108]],o)+jack(336,108,o);
  s+=dot(290,108,o)+wire([[290,108],[290,170]],o&&t<10,o&&t<10?1:.6)+`<g transform="rotate(90 290 182)">${pot(290,182,"",t,o&&t<10).replace(/<text[^>]*>[^<]*<\/text>/,"")}</g>`+txt(306,186,"Tone "+fmtK(t),{s:9,a:"start"})+cap(290,214,o&&t<10,o&&t<10?Math.max(.35,1-t/10):.6,"47 nF")+wire([[290,220],[290,262]],false);
 }
 s+=txt(10,284,"Orange = Signal fließt · Blau = Coil-Split · Grau = Masse/aus",{s:8.5,a:"start",c:"#8e8e93",w:500})+txt(10,296,"Je kräftiger der Kondensator, desto mehr Höhen werden abgeleitet",{s:8.5,a:"start",c:"#8e8e93",w:500});
 return s}

//==CURVE
function drawCurve(){const M=model();const W=320,H=140,x0=30,y0=118;let s=`<line x1="${x0}" y1="${y0}" x2="${W-6}" y2="${y0}" stroke="#48484a"/><line x1="${x0}" y1="10" x2="${x0}" y2="${y0}" stroke="#48484a"/>`;
  const fx=f=>x0+(Math.log10(f)-Math.log10(80))/(Math.log10(12000)-Math.log10(80))*(W-x0-10);
  [100,500,1000,5000,10000].forEach(f=>s+=`<line x1="${fx(f)}" x2="${fx(f)}" y1="${y0}" y2="${y0+4}" stroke="#666"/><text x="${fx(f)}" y="${y0+15}" fill="#8e8e93" font-size="9" text-anchor="middle">${f>=1000?f/1000+"k":f}</text>`);
  if(M.out){let d="";for(let i=0;i<=120;i++){const f=80*Math.pow(12000/80,i/120);const r=f/M.f;const mag=1/Math.sqrt(Math.pow(1-r*r,2)+Math.pow(r/M.q,2));const db=20*Math.log10(mag*M.out+1e-6);const y=Math.max(12,Math.min(y0,y0-40-db*4.2));d+=(i?"L":"M")+fx(f).toFixed(1)+" "+y.toFixed(1)}
    s+=`<path d="${d}" fill="none" stroke="var(--acc)" stroke-width="2.4"/><circle cx="${fx(M.f)}" cy="16" r="0"/><text x="${Math.min(W-40,fx(M.f))}" y="14" fill="#ffd60a" font-size="10" text-anchor="middle">▲ ${(Math.round(M.f/100)/10).toString().replace(".",",")} kHz</text>`}
  s+=`<text x="${x0}" y="10" fill="#8e8e93" font-size="9">Pegel</text><text x="${W-8}" y="${y0-4}" fill="#8e8e93" font-size="9" text-anchor="end">Hz</text>`;
  $("curve").innerHTML=s}


/* ---------- Zustand (eigene Sounds + letzte Ansicht) ---------- */
let mine = []; try { mine = JSON.parse(localStorage.getItem(KM) || '[]') || []; } catch (e) { mine = []; }
let saved = {}; try { saved = JSON.parse(localStorage.getItem(KS) || '{}') || {}; } catch (e) { saved = {}; }
let gSel = G[saved.g] ? saved.g : 'schecter', tSel = /^(bias|reactor|spark)$/.test(saved.t) ? saved.t : 'bias', pSel = P[0].id, cur = null, blkSel = 2;
let viewSel = saved.v === 'guit' ? 'guit' : 'sounds';
const allP = () => P.concat(mine);
const clone = o => JSON.parse(JSON.stringify(o));
function persist() { try { localStorage.setItem(KS, JSON.stringify({ v: viewSel, g: gSel, t: tSel, p: pSel, gw, d3: view3d ? 1 : 0, w: showW ? 1 : 0 })); } catch (e) {} }
function load(id) {
  const p = allP().find(x => x.id === id) || P[0]; pSel = p.id;
  // Vorlagen: [Typ, Name, Regler, An, Stereo] bzw. beim Amp [Typ, Name, Regler, Stil]; eigene Sounds: [Typ, Name, Regler, Stil, An, Stereo]
  const blk = c => { const sty = typeof c[3] === 'string'; return { type: c[0], name: c[1], k: clone(c[2]), style: sty ? c[3] : '', on: (sty ? c[4] : c[3]) === undefined ? 1 : (sty ? c[4] : c[3]), st: (sty ? c[5] : c[4]) ? 1 : 0 }; };
  cur = { name: p.name, desc: p.desc, en: p.en, g: clone(p.g), chain: p.chain.map(blk) };
  blkSel = Math.max(0, cur.chain.findIndex(c => c.type === 'amp')); render(); persist();
}

/* ---------- Render: Sounds (in Teilen, damit Schieberegler beim Ziehen nicht neu gebaut werden) ---------- */
const chip = (on, attr, html) => `<button class="toggle-btn${on ? ' active' : ''}" ${attr}>${html}</button>`;
function renderChain() {
  $('chain').innerHTML = cur.chain.map((c, i) => `${i ? '<span class="rg-arrow">›</span>' : ''}<div class="rg-blk${c.type === 'amp' ? ' rg-amp' : ''}${c.on ? '' : ' rg-off'}${i === blkSel ? ' rg-sel' : ''}" data-b="${i}" role="button" tabindex="0">${c.st ? '<span class="rg-st">STEREO</span>' : ''}<div class="rg-t">${TYPE[c.type]}</div><div class="rg-n">${esc(c.name)}</div><div class="rg-knobs">${Object.entries(c.k).map(([n, v]) => `<div class="rg-kn">${typeof v === 'number' ? knob(v, 40) : '<div class="rg-kv">' + esc(v) + '</div>'}${typeof v === 'number' ? `<b>${fmtK(v)}</b>` : '<b>&nbsp;</b>'}${n}</div>`).join('')}</div></div>`).join('');
}
function renderPrompt() { $('prompt').textContent = prompt(); }
function renderEdHead() {
  const c = cur.chain[blkSel]; $('edName').textContent = `${TYPE[c.type]}: ${c.name}`;
  $('edOn').textContent = c.on ? 'An' : 'Aus'; $('edOn').classList.toggle('active', !!c.on);
  $('edSt').classList.toggle('active', !!c.st);
}
function renderEd() {
  const c = cur.chain[blkSel]; renderEdHead();
  $('ed').innerHTML = Object.entries(c.k).filter(([, v]) => typeof v === 'number').map(([n, v]) => `<label class="rg-sl"><span><span>${n}</span><b>${fmtK(v)}</b></span><input type="range" min="0" max="10" step="0.5" value="${v}" data-k="${esc(n)}"></label>`).join('');
}
function renderGuitarSet() {
  const g = G[gSel], gs = cur.g[gSel] || {}; $('gName').textContent = g.name;
  const posL = (g.positions.find(p => p.k === gs.pos) || g.positions[0]);
  $('gSet').innerHTML = `<div class="rg-sw3">${g.positions.map(p => `<span class="${p.k === posL.k ? 'on' : ''}">${esc(p.l)}</span>`).join('')}</div>` +
    g.pots.map(([k, l]) => `<div class="rg-gk">${knob(gs[k] ?? 10, 48, '#ffd60a')}<b>${fmtK(gs[k] ?? 10)}</b>${l}</div>`).join('') +
    (g.split ? `<div class="rg-gk"><div class="rg-pill${gs.split ? ' on' : ''}">${gs.split ? 'gezogen' : 'gedrückt'}</div>Coil-Split</div>` : '');
  $('gNote').textContent = `Schalter: ${posL.l}` + (g.split ? ` · Tone-Poti ${gs.split ? 'herausziehen (Single-Coil)' : 'gedrückt lassen (Humbucker)'}` : '') + ` · ${tgtNote()}`;
}
function render() {
  $('gChips').innerHTML = GK.map(k => chip(k === gSel, `data-g="${k}"`, esc(G[k].short))).join('');
  $('pChips').innerHTML = allP().map(p => chip(p.id === pSel, `data-p="${p.id}"`, (p.mine ? '<span class="rg-mine">★</span>' : '') + esc(p.name))).join('');
  $('pTitle').textContent = cur.name; $('pDesc').textContent = cur.desc;
  $('tSeg').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.t === tSel));
  $('prT').textContent = tSel === 'bias' ? 'BIAS X' : tSel === 'reactor' ? 'Reactor 50' : 'Spark LIVE';
  $('del').hidden = !String(pSel).startsWith('m');
  renderGuitarSet(); renderChain(); renderEd(); renderPrompt();
}

/* ---------- Bedienung Sounds ---------- */
host.addEventListener('click', e => {
  const m = e.target.closest('#rg-mainSeg button'); if (m) { setView(m.dataset.v); return; }
  const g = e.target.closest('[data-g]'); if (g) { gSel = g.dataset.g; render(); persist(); return; }
  const p = e.target.closest('[data-p]'); if (p) { load(p.dataset.p); return; }
  const t = e.target.closest('[data-t]'); if (t) { tSel = t.dataset.t; render(); persist(); return; }
  const b = e.target.closest('[data-b]'); if (b) { blkSel = +b.dataset.b; renderChain(); renderEd(); return; }
  const g2 = e.target.closest('[data-g2]'); if (g2) { if (gw !== g2.dataset.g2) { gw = g2.dataset.g2; st2 = defaultState(gw); persist(); } renderG(); return; }
  const ps = e.target.closest('[data-pos]'); if (ps) { st2.pos = ps.dataset.pos; renderG(); return; }
});
$('ed').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  const v = Number(e.target.value); cur.chain[blkSel].k[k] = v;
  const lb = e.target.parentNode.querySelector('b'); if (lb) lb.textContent = fmtK(v);
  renderChain(); renderPrompt();
});
$('edOn').onclick = () => { const c = cur.chain[blkSel]; c.on = c.on ? 0 : 1; renderChain(); renderEdHead(); renderPrompt(); };
$('edSt').onclick = () => { const c = cur.chain[blkSel]; c.st = c.st ? 0 : 1; renderChain(); renderEdHead(); renderPrompt(); };
$('reset').onclick = () => load(pSel);
$('copy').onclick = async () => {
  const txt = prompt();
  try { await navigator.clipboard.writeText(txt); toast('Prompt kopiert'); }
  catch (e) { const r = document.createRange(); r.selectNodeContents($('prompt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Markiert – jetzt kopieren'); }
};
const saveMine = () => { try { localStorage.setItem(KM, JSON.stringify(mine)); return true; } catch (e) { toast('Speicher voll – nicht gesichert'); return false; } };
$('save').onclick = () => {
  const name = (cur.name.replace(/ \(eigen.*\)$/, '') + ' (eigen ' + (mine.length + 1) + ')');
  const p = { id: 'm' + Date.now(), mine: 1, name, desc: cur.desc, en: cur.en, g: clone(cur.g), chain: cur.chain.map(c => [c.type, c.name, clone(c.k), c.style, c.on, c.st]) };
  mine.push(p); if (saveMine()) { load(p.id); toast(T('Gesichert: ') + name); } else mine.pop();
};
$('del').onclick = () => {
  const i = mine.findIndex(x => x.id === pSel); if (i < 0) return;
  if (!confirm(T('Eigenen Sound löschen?') + '\n' + mine[i].name)) return;
  mine.splice(i, 1); saveMine(); load(P[0].id);
};

/* ---------- Gitarren ---------- */
gw = G[saved.gw] ? saved.gw : gw; st2 = defaultState(gw);
if (saved.d3 === 0) view3d = false;
if (saved.w === 0) showW = false;
function renderG() {
  const g = G[gw];
  $('g2Chips').innerHTML = GK.map(k => chip(k === gw, `data-g2="${k}"`, esc(G[k].short))).join('');
  $('posBtns').innerHTML = g.positions.map(p => chip(p.k === st2.pos, `data-pos="${p.k}"`, esc(p.l))).join('');
  $('splitWrap').classList.toggle('rg-none', !g.split);
  $('splitBtn').textContent = st2.split ? 'Coil-Split: AN (Tone-Poti gezogen)' : 'Coil-Split: AUS (Humbucker)';
  $('splitBtn').classList.toggle('rg-blue', !!st2.split);
  if ($('potEd').dataset.g !== gw) {
    $('potEd').dataset.g = gw;
    $('potEd').innerHTML = g.pots.map(([k, l]) => `<label class="rg-sl"><span><span>${l}</span><b id="rg-pv_${k}">${fmtK(st2[k])}</b></span><input type="range" min="0" max="10" step="0.5" value="${st2[k]}" data-pot="${k}"></label>`).join('');
  }
  drawBody(); drawCurve();
}
$('splitBtn').onclick = () => { st2.split = !st2.split; renderG(); };
$('potEd').addEventListener('input', e => { const k = e.target.dataset.pot; if (!k) return; st2[k] = Number(e.target.value); $('pv_' + k).textContent = fmtK(st2[k]); drawBody(); drawCurve(); });
$('wTog').onclick = () => { showW = !showW; persist(); drawBody(); };
$('v3Tog').onclick = () => { view3d = !view3d; persist(); drawBody(); };
$('v3Body').onclick = () => { if (v3) v3.body(); };
$('v3All').onclick = () => { if (v3) v3.reset(); };

// „Altes iPad“/„Minimal“: Zeichnung ohne SVG-Filter (Schatten, Maserung, Unschärfe kosten auf alten Geräten viel)
function lowSvg(s) {
  return s.replace(/<path[^>]*filter="url\(#rgs-(?:flame|satin)\)"[^>]*\/>/g, '').replace(/<path[^>]*filter:blur\(4px\)[^>]*\/>/g, '').replace(/ filter="url\(#rgs-\w+\)"/g, '');
}
const legRow = (l, lv) => `<div class="rg-legr"><span class="rg-legn" style="border-color:${l.c}">${l.n}</span><span class="rg-legt">${esc(l.t)}</span><b style="color:${l.c}">${Math.round(l.mv)} mV</b><span class="rg-legu">${(l.mv / lv.load).toFixed(1).replace('.', ',')} µA</span></div>`;
function state3d() {
  const g = G[gw], i = Math.max(0, g.positions.findIndex(p => p.k === st2.pos));
  return { gw, st: st2, act: active().map(a => ({ id: a.p.id, on: a.on, vol: a.vol, coils: a.coils })), lv: levels(), showW, leg: LEG.slice(), posIdx: i, posLabel: g.positions[i].l };
}
function drawBody() {
  const g = G[gw], A = active(); const M = model(); LEG = [];
  let svg = guitarSVG(g, A, M); if (dev() !== 'new') svg = lowSvg(svg);
  const can3d = dev() !== 'min', use3d = view3d && can3d;
  if (use3d) need3d();
  const ok3d = use3d && !!v3;
  $('body').style.display = ok3d ? 'none' : '';
  if (!ok3d) $('body').innerHTML = svg;
  $('v3d').hidden = !ok3d;
  $('v3msg').hidden = !(use3d && !v3);
  $('v3msg').textContent = v3err ? T('3D-Modell nicht verfügbar – Zeichnung') : T('3D-Modell wird geladen …');
  $('v3Body').disabled = $('v3All').disabled = !ok3d;
  $('v3Tog').textContent = view3d && can3d ? '3D-Modell' : 'Zeichnung'; $('v3Tog').classList.toggle('rg-blue', view3d && can3d);
  $('v3Tog').disabled = !can3d;
  $('v3Hint').textContent = !can3d ? 'Profil „Minimal“: nur die Zeichnung, das 3D-Modell wird nicht geladen.' : ok3d ? 'Strat: dein Modell aus druckwerk · Schecter und Les Paul: eigene 3D-Modelle. Mit einem Finger drehen, mit zwei zoomen.' : 'Zeichnung · „Zeichnung“ antippen für das 3D-Modell.';
  $('wTog').textContent = 'Verkabelung: ' + (showW ? 'AN' : 'AUS'); $('wTog').classList.toggle('active', showW);
  if (ok3d) { v3.show(visible); v3.update(state3d(), GEO); }
  $('wiring').innerHTML = wiringSVG(); const lv = levels();
  $('wLeg').innerHTML = showW ? LEG.map(l => legRow(l, lv)).join('') + `<div class="rg-hint">Werte sind Richtwerte beim kräftigen Anschlag (Spitzenspannung). Der Strom ist winzig, weil die Potis und der Amp-Eingang hochohmig sind – deshalb klingen lange Kabel dumpfer.</div>` : '';
  // Kennzahlen
  const br = M.f ? Math.round(M.f / 100) / 10 : 0;
  $('charBox').innerHTML = [['Pegel ca.', Math.round(lv.out) + ' mV'], ['Resonanz', br ? br.toString().replace('.', ',') + ' kHz' : '–'], ['Brummen', M.out ? (M.hum ? 'ja' : 'nein') : '–'], ['Charakter', !M.out ? '–' : M.f > 4200 ? 'hell' : M.f > 2800 ? 'ausgewogen' : 'warm']].map(([a, b]) => `<div><b>${b}</b>${a}</div>`).join('');
  // Erklärung
  const L = []; const A2 = A.filter(a => a.on);
  L.push(`<b>Aktiv:</b> ${A2.map(a => a.p.name + (a.p.kind === 'hb' ? (a.coils[1] ? ' (beide Spulen in Reihe)' : ' (nur eine Spule)') : '')).join(' + ') || 'kein Pickup'}.`);
  if (A2.length > 1) L.push(gw === 'strat' ? 'Zwei Single Coils parallel: weniger Ausgang, hohler „Quack“-Klang. Weil der Mittel-Pickup gegensinnig gewickelt ist, heben sich Brummgeräusche auf.' : 'Beide Pickups parallel: offener, etwas leiser als ein einzelner Humbucker, gut für Clean und Rhythmus.');
  if (g.split) L.push(st2.split ? 'Coil-Split: Jeweils eine Spule wird kurzgeschlossen → schlanker, heller, weniger Ausgang, aber Brummen wie bei einem Single Coil.' : 'Humbucker: zwei Spulen in Reihe, gegenphasig gewickelt → mehr Ausgang, mehr Mitten, kein Brummen.');
  const vols = A2.map(a => a.vol), tones = A2.map(a => a.tone);
  if (vols.some(v => v < 10)) L.push('Volume zurückgedreht: weniger Pegel → der Amp zerrt weniger. Gleichzeitig gehen etwas Höhen verloren, weil das Poti mit der Kabelkapazität einen Filter bildet.');
  if (tones.some(v => v < 10)) L.push(`Tone zurückgedreht: Der Kondensator (${g.cap} nF) leitet Höhen gegen Masse ab → die Resonanzspitze wird tiefer und flacher, der Klang wärmer. Ganz zu (0) klingt es wie „Woman Tone“.`);
  if (gw === 'strat' && A2.some(a => a.p.id === 'B')) L.push('Der Steg-Pickup hat bei dieser Schaltung keine Tonblende – in Stellung 1 wirkt kein Tone-Regler.');
  if (gw === 'gibson' && st2.pos === 'NB') L.push('Mittelstellung: Mit den beiden Volume-Reglern mischst du Hals und Steg. Einen ganz zudrehen kann bei dieser Schaltung beide stumm machen.');
  $('expl').innerHTML = L.map(x => `<li>${x}</li>`).join('');
  $('wireTxt').textContent = g.wire;
}

/* ---------- 3D: erst bei Bedarf laden, verborgen anhalten, nach 2 min verborgen freigeben ---------- */
let v3 = null, v3load = null, v3err = null, v3dev = null, visible = false, freeT = 0;
function need3d() {
  if (v3 || v3load || v3err) return;
  const d = dev(); if (d === 'min') return;
  v3dev = d;
  v3load = import(new URL('rig3d.js', BASE).href).then(m => {
    v3load = null;
    if (dev() !== v3dev) { if (viewSel === 'guit' && visible) drawBody(); return; }
    v3 = m.create($('v3d'), { low: d === 'old', onload: () => { if (viewSel === 'guit') drawBody(); }, onerror: e => console.warn('Rig: Strat-Modell nicht geladen', e) });
    v3.show(visible && viewSel === 'guit');
    if (viewSel === 'guit') drawBody();
  }).catch(e => { v3load = null; v3err = e; console.warn('Rig: 3D nicht verfügbar', e); if (viewSel === 'guit') drawBody(); });
}
function free3d() { if (v3) { v3.dispose(); v3 = null; } $('v3d').hidden = true; }
document.addEventListener('devchange', () => {
  free3d();   // neues Profil → 3D mit passenden Einstellungen neu aufbauen (bzw. in „Minimal“ gar nicht)
  if (visible && viewSel === 'guit') drawBody();
});

function setView(v) {
  viewSel = v === 'guit' ? 'guit' : 'sounds';
  $('mainSeg').querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.v === viewSel));
  $('v_sounds').hidden = viewSel !== 'sounds'; $('v_guit').hidden = viewSel !== 'guit';
  if (v3) v3.show(visible && viewSel === 'guit');
  if (viewSel === 'guit') renderG();
  persist();
}
function show() {
  visible = true; clearTimeout(freeT);
  setView(viewSel);
}
function hide() {
  visible = false;
  if (v3) { v3.show(false); clearTimeout(freeT); freeT = setTimeout(() => { if (!visible) free3d(); }, 120000); }
}
const BASE = (document.currentScript && document.currentScript.src) || new URL('rig/rig.js', location.href).href;
document.addEventListener('tabchange', e => { if (e.detail === 'rig') show(); else if (visible) hide(); });

load(saved.p && allP().some(x => x.id === saved.p) ? saved.p : P[0].id);
window.Rig = {
  show, hide, setView, view: () => viewSel,
  state: () => ({ view: viewSel, g: gSel, t: tSel, p: pSel, gw, st: Object.assign({}, st2), view3d, showW, mine: mine.length, prompt: prompt(), lv: levels(), model: model() }),
  three: () => v3, threeInfo: () => (v3 ? v3.info() : null), _free3d: free3d,
};
if (window.AppNav && AppNav.current() === 'rig') show();
})();
