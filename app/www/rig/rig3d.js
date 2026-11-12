/* v146 Rig – 3D-Ansicht der Gitarren (three.js r160, MIT, lokal in rig/three/).
   Wird von rig.js erst geladen, wenn „Gitarren“ mit 3D sichtbar ist (nie im Profil „Minimal“).
   Gezeichnet wird nur bei Änderungen (Regler, Drehen/Zoomen, Größe) – keine Animationsschleife; verborgen wird gar nicht gezeichnet.
   Strat: Modell aus Toms druckwerk-Auftrag (rig/strat.glb, erst bei Wahl der Strat geladen). Schecter (T-Style) und Les Paul Studio: prozedural.
   opt.low („Altes iPad“): Pixelverhältnis 1, keine Umgebungsspiegelung, kein Klarlack (MeshStandardMaterial), kleinere Texturen. */
import * as THREE from './three/three.module.min.js';
import {GLTFLoader} from './three/GLTFLoader.js';
import {OrbitControls} from './three/OrbitControls.js';
import {RoomEnvironment} from './three/RoomEnvironment.js';
import {SVGLoader} from './three/SVGLoader.js';
import {RoundedBoxGeometry} from './three/RoundedBoxGeometry.js';
const BASE=new URL('./',import.meta.url).href;
export function create(box,opt){opt=opt||{};const low=!!opt.low;let alive=true,shown=true;
const R=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:low?'low-power':'default'});R.setPixelRatio(low?1:Math.min(2,devicePixelRatio));R.outputColorSpace=THREE.SRGBColorSpace;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;
box.appendChild(R.domElement);R.domElement.style.cssText="width:100%;height:100%;display:block;border-radius:12px";
const scene=new THREE.Scene();let pm=null,envT=null;
if(!low){pm=new THREE.PMREMGenerator(R);const re=new RoomEnvironment();envT=pm.fromScene(re,0.04).texture;scene.environment=envT;re.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()})}
else scene.add(new THREE.AmbientLight(0xffffff,1.1));
scene.add(new THREE.HemisphereLight(0xffffff,0x332211,low?0.9:0.5));const dl=new THREE.DirectionalLight(0xffffff,low?2.2:1.6);dl.position.set(-60,40,160);scene.add(dl);
// Altes iPad: ohne Klarlack und ohne Umgebungsspiegelung (Metall dann matter, sonst wäre es schwarz)
const CC=['clearcoat','clearcoatRoughness'];
const lowO=o=>{o=Object.assign({},o);CC.forEach(k=>delete o[k]);if(o.metalness>.45)o.metalness=.45;if(o.roughness!==undefined&&o.roughness<.35)o.roughness=.35;delete o.envMapIntensity;return o};
const PHYS=o=>low?new THREE.MeshStandardMaterial(lowO(o)):new THREE.MeshPhysicalMaterial(o);
const STD=o=>low?new THREE.MeshStandardMaterial(lowO(o)):new THREE.MeshStandardMaterial(o);
const TEX=low?512:1024;
const cam=new THREE.PerspectiveCamera(28,1,1,3000);
const ctl=new OrbitControls(cam,R.domElement);ctl.target.set(0,96,6);cam.position.set(18,40,400);ctl.update();
const draw=()=>{if(alive&&shown&&box.clientWidth&&box.clientHeight){R.render(scene,cam);api.frames++}};ctl.addEventListener('change',draw);
function size(){if(!alive)return;const w=box.clientWidth,h=box.clientHeight;if(!w||!h)return;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();draw()}
const ro=new ResizeObserver(size);ro.observe(box);
const G3={};let curT=null;
/* ---------- Strat aus druckwerk ---------- */
const MAT={
 korpus:PHYS({vertexColors:true,roughness:.32,clearcoat:1,clearcoatRoughness:.06}),
 weiss:STD({color:0xf3efe4,roughness:.45}),
 hals:PHYS({color:0xe0b673,roughness:.45,clearcoat:.7,clearcoatRoughness:.15}),
 metall:STD({color:0xe6e9ee,metalness:1,roughness:.22})};
let stratLoading=false,last=null;
function loadStrat(){if(stratLoading||G3.strat)return;stratLoading=true;
 new GLTFLoader().load(BASE+'strat.glb',g=>{if(!alive)return;g.scene.traverse(o=>{if(o.isMesh){const k=Object.keys(MAT).find(n=>(o.name+" "+(o.parent&&o.parent.name)).toLowerCase().includes(n));if(k){o.material=MAT[k];if(k!=="korpus")o.geometry.deleteAttribute('color');else{const c=o.geometry.getAttribute('color');if(c){const n=c.count,f=new Float32Array(n*3);for(let i=0;i<n;i++){f[i*3]=Math.pow(c.getX(i),2.2);f[i*3+1]=Math.pow(c.getY(i),2.2);f[i*3+2]=Math.pow(c.getZ(i),2.2)}o.geometry.setAttribute('color',new THREE.BufferAttribute(f,3))}}}o.geometry.computeVertexNormals()}});
  G3.strat={grp:g.scene};g.scene.visible=false;scene.add(g.scene);if(last)api.update(last[0],last[1]);if(opt.onload)opt.onload('strat')},undefined,e=>{stratLoading=false;if(opt.onerror)opt.onerror(e)});}
/* ---------- Eigene Modelle (Schecter T-Style, Les Paul Studio) ---------- */
const k=0.26,X=x=>(x-180)*k,Y=y=>(768-y)*k,TOPZ=13;
function shapeFrom(d){const data=new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);return SVGLoader.createShapes(data.paths[0])}
function extr(d,depth,bevel,mats){const g=new THREE.ExtrudeGeometry(shapeFrom(d),{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel*2.6,bevelSegments:3,curveSegments:24});
  g.translate(-180,-768,0);g.scale(k,-k,-1);g.translate(0,0,depth+bevel);g.computeVertexNormals();return new THREE.Mesh(g,mats)}
function texBurst(cols,flame){const c=document.createElement('canvas');c.width=c.height=TEX;const x=c.getContext('2d');const gr=x.createRadialGradient(TEX/2,TEX*.586,TEX*.04,TEX/2,TEX*.547,TEX*.605);cols.forEach(([o,cl])=>gr.addColorStop(o,cl));x.fillStyle=gr;x.fillRect(0,0,TEX,TEX);
  if(flame){x.globalAlpha=.16;for(let i=0;i<260;i++){const y0=Math.random()*1024;x.strokeStyle=i%2?'#ffd9a0':'#3a0000';x.lineWidth=2+Math.random()*6;x.beginPath();for(let xx=0;xx<=1024;xx+=16){const yy=y0+Math.sin(xx/70+i)*18+Math.sin(xx/23+i*1.7)*6;xx?x.lineTo(xx,yy):x.moveTo(xx,yy)}x.stroke()}x.globalAlpha=1}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t}
function uvXY(g){g.computeBoundingBox();const b=g.boundingBox,p=g.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)-b.min.x)/(b.max.x-b.min.x);uv[i*2+1]=(p.getY(i)-b.min.y)/(b.max.y-b.min.y)}g.setAttribute('uv',new THREE.BufferAttribute(uv,2))}
const M=(c,o={})=>PHYS(Object.assign({color:c,roughness:.4,envMapIntensity:.35},o));
const CHROME=STD({color:0xe6e9ee,metalness:1,roughness:.2});
const GOLDK=STD({color:0xd9a441,metalness:.9,roughness:.25});
function bx(w,h,d,mat,x,y,z,rz=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.z=rz;return m}
function cyl(r,h,mat,x,y,z,seg=28){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);return m}
function buildProc(G){const T=G.T,grp=new THREE.Group();const lp=T==="gibson";
  // Korpus
  if(lp){const top=M(0xffffff,{map:texBurst([[0,'#f3c06a'],[.35,'#d9662a'],[.65,'#8e1410'],[.88,'#3a0405'],[1,'#1a0203']],true),clearcoat:1,clearcoatRoughness:.05,roughness:.3});
    const side=M(0x3a1208,{clearcoat:1,clearcoatRoughness:.1});const b=extr(G.body,11,1.2,[top,side]);uvXY(b.geometry);grp.add(b)}
  else{const b=extr(G.body,11,1.0,[M(0x3f3f3d,{roughness:.55,clearcoat:.25,clearcoatRoughness:.4}),M(0x2a2a29,{roughness:.6})]);grp.add(b)}
  // Hals + Griffbrett
  const nw0=G.nw0,nw1=G.nw1,jointY=470;const neck=`M${180-nw0},${G.nutY} L${180+nw0},${G.nutY} L${180+nw1},${jointY} L${180-nw1},${jointY} Z`;
  const nk=extr(neck,5,.6,M(lp?0x4a1f10:0xc79a5e,{clearcoat:.6}));nk.position.z=2;grp.add(nk);
  const fbd=`M${180-nw0},${G.nutY} L${180+nw0},${G.nutY} L${180+nw1},${G.fbEnd} L${180-nw1},${G.fbEnd} Z`;
  const fb=extr(fbd,1.6,0,M(lp?0x3a2416:0x1b1410,{roughness:.7}));fb.position.z=TOPZ+.6-1.6+1.4;grp.add(fb);const FZ=TOPZ+2.0;
  const fretY=n=>G.nutY+520*(1-Math.pow(2,-n/12)),nwY=y=>{const t=(y-G.nutY)/(G.fbEnd-G.nutY);return nw0+t*(nw1-nw0)};
  for(let n=1;n<=G.nFrets;n++){const y=fretY(n);grp.add(bx(2*nwY(y)*k,.35,.45,CHROME,0,Y(y),FZ+.2))}
  const INL=lp?0xefe9dc:0xd8d8d8;[3,5,7,9,12,15,17,19,21].filter(n=>n<=G.nFrets).forEach(n=>{const y=(fretY(n-1)+fretY(n))/2;(n===12?[-8,8]:[0]).forEach(dx=>grp.add(cyl(3.2*k,.1,STD({color:INL,roughness:.3}),dx*k,Y(y),FZ+.02)))});
  grp.add(bx(44*k,1.2,1.6,M(0xefe8d6),0,Y(G.nutY),FZ+.6));
  // Kopfplatte
  const hs=extr(G.hs,3.5,.4,STD({color:lp?0x0d0d0d:0x2e2e2d,roughness:.5,side:THREE.DoubleSide,envMapIntensity:.25}));hs.geometry.computeVertexNormals();hs.position.z=TOPZ-6;grp.add(hs);
  G.posts.forEach(([x,y,side])=>{grp.add(cyl(1.2,3,CHROME,X(x),Y(y),TOPZ-1));const bxp=lp?x+side*22:x-24;grp.add(bx(Math.abs(bxp-x)*k,1.2,1.2,CHROME,X((x+bxp)/2),Y(y),TOPZ-2.5));grp.add(bx(2.6,3,1.2,lp?M(0xf3eedd):CHROME,X(bxp),Y(y),TOPZ-2.5))});
  // Pickups
  const BOB={};const ringM=M(lp?0xece2c8:0x111111,{roughness:.5});
  const NICK=STD({color:0xd7dadf,metalness:1,roughness:.32}),DARK=new THREE.MeshBasicMaterial({color:0x222222});
  Object.entries(G.PY).forEach(([id,y])=>{const yc=Y(y);
    // Rahmen (leicht konisch) + 4 Schrauben + 2 Höhenschrauben
    const ring=new THREE.Mesh(new RoundedBoxGeometry(94*k,52*k,1.3,3,.7),ringM);ring.position.set(0,yc,TOPZ+.65);grp.add(ring);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>grp.add(cyl(.42,.3,NICK,sx*11.3,yc+sy*5.6,TOPZ+1.35,12)));
    [-1,1].forEach(sx=>grp.add(cyl(.55,.3,NICK,sx*11.6,yc,TOPZ+1.35,12)));
    BOB[id]=[];
    [0,1].forEach(c=>{const yy=Y(y-19+c*19+9);const mat=PHYS({color:0x050505,envMapIntensity:.3,roughness:.55,clearcoat:.15,clearcoatRoughness:.4,emissive:0x000000});
      const b=new THREE.Mesh(new RoundedBoxGeometry(80*k,17.5*k,2.4,4,.55),mat);b.position.set(0,yy,TOPZ+2.4);grp.add(b);BOB[id].push(b);
      for(let i=0;i<6;i++){const px=X(180-25+i*10);
        if(c===0){grp.add(cyl(.78,.5,NICK,px,yy,TOPZ+3.62,16));grp.add(bx(1.25,.16,.08,DARK,px,yy,TOPZ+3.9,Math.PI/2*((i%2)?.15:-.1)))}
        else grp.add(cyl(.72,.25,NICK,px,yy,TOPZ+3.55,16))}})});
  // Brücke
  if(lp){grp.add(bx(84*k,10*k,2.6,CHROME,0,Y(G.bridgeY),TOPZ+1.3));for(let i=0;i<6;i++)grp.add(bx(1.4,2,1,CHROME,X(180-27+i*10.4+3),Y(G.bridgeY),TOPZ+2.9));
    const sb=new THREE.Mesh(new THREE.CapsuleGeometry(1.6,88*k-3.2,6,16),CHROME);sb.rotation.z=Math.PI/2;sb.position.set(0,Y(G.bridgeY+30),TOPZ+1.8);grp.add(sb)}
  else{const bm=M(0x161616,{metalness:.6,roughness:.35});grp.add(bx(80*k,40*k,1,bm,0,Y(G.bridgeY+6),TOPZ+.5));for(let i=0;i<6;i++)grp.add(bx(9*k,16*k,1.6,bm,X(180-34+i*11.6+4.5),Y(G.bridgeY),TOPZ+1.6))}
  // Saiten
  const endY=lp?G.bridgeY+30:G.bridgeY;const SM=STD({color:0xdadada,metalness:1,roughness:.3});
  for(let i=0;i<6;i++){const a=new THREE.Vector3(X(180-17+i*6.8),Y(G.nutY),FZ+1.4),b=new THREE.Vector3(X(180-28+i*11.2),Y(endY),TOPZ+3.2);const L=a.distanceTo(b);const s=new THREE.Mesh(new THREE.CylinderGeometry(.09+(5-i)*.025,.09+(5-i)*.025,L,6),SM);s.position.copy(a).add(b).multiplyScalar(.5);s.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());grp.add(s)}
  // Elektronik
  if(!lp){const pl=bx(114*k,30*k,.8,M(0x1d1d1d,{metalness:.5,roughness:.35}),X(255),Y(672),TOPZ+.4,-42*Math.PI/180);grp.add(pl)}
  G.KP.forEach(([x,y])=>{if(lp){grp.add(cyl(3.6,1,GOLDK,X(x),Y(y),TOPZ+.5));grp.add(cyl(3.0,3.4,GOLDK,X(x),Y(y),TOPZ+2.6))}else{grp.add(cyl(3.3,3,M(0x0c0c0c,{roughness:.3,clearcoat:1}),X(x),Y(y),TOPZ+2.3))}});
  grp.add(cyl(lp?3.4:2.4,.6,lp?M(0xefe6cf):CHROME,X(G.SWP[0]),Y(G.SWP[1]),TOPZ+.4));
  grp.add(cyl(1.8,1.2,CHROME,X(G.J[0]),Y(G.J[1]),TOPZ+.4));
  grp.visible=false;scene.add(grp);return {grp,BOB}}
/* ---------- Overlays ---------- */
const dyn=new THREE.Group();scene.add(dyn);
function sprite(txt,col,scale){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='700 34px -apple-system,sans-serif';const w=Math.min(250,x.measureText(txt).width+28);
 x.fillStyle='rgba(0,0,0,.78)';x.beginPath();x.roundRect((256-w)/2,6,w,52,26);x.fill();x.strokeStyle=col;x.lineWidth=4;x.stroke();x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,128,33);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(scale*4,scale,1);s.renderOrder=20;return s}
function numSprite(n,col){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#000';x.beginPath();x.arc(32,32,28,0,7);x.fill();x.strokeStyle=col;x.lineWidth=5;x.stroke();x.fillStyle='#fff';x.font='800 34px -apple-system,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(n,32,34);
 const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(2.2,2.2,1);s.renderOrder=21;return s}
function glowTex(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,170,40,1)');g.addColorStop(.5,'rgba(255,130,0,.35)');g.addColorStop(1,'rgba(255,120,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
const GT=glowTex();
const colOf=mv=>mv<=0?new THREE.Color('#5a5a5e'):new THREE.Color().setHSL(Math.max(8,40-mv/30)/360,1,Math.min(.62,.45+mv/4000));
const top=(o,r=10)=>{o.renderOrder=r;o.material.depthTest=false;o.material.transparent=true;return o};
function tube(pts,z,mv,lab,leg){const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],p[1],z+(p[2]||0))));const on=mv>0;
 dyn.add(top(new THREE.Mesh(new THREE.TubeGeometry(curve,40,on?Math.min(.55,.18+mv/1600):.12,8,false),new THREE.MeshBasicMaterial({color:colOf(mv),opacity:on?1:.55})),12));
 if(on&&lab){const L=leg.find(l=>l.t===lab);if(L){const p=curve.getPoint(.5);const s=numSprite(L.n,'#'+colOf(mv).getHexString());s.position.set(p.x,p.y,p.z+.8);dyn.add(s)}}}
function knobOverlay(list,z){list.forEach(([x,y,l,v])=>{const ang=(150-v/10*300)*Math.PI/180;
  const ring=new THREE.Mesh(new THREE.RingGeometry(2.6,3.05,40,1,-Math.PI*1.33+Math.PI/2,Math.PI*2.66*(v/10)),new THREE.MeshBasicMaterial({color:0xffd60a,side:THREE.DoubleSide}));ring.position.set(x,y,z);dyn.add(top(ring,13));
  const ptr=new THREE.Mesh(new THREE.BoxGeometry(.4,2.2,.2),new THREE.MeshBasicMaterial({color:0xff9f0a}));ptr.geometry.translate(0,1.1,0);ptr.position.set(x,y,z+.05);ptr.rotation.z=ang;dyn.add(top(ptr,14));
  const s=sprite(`${l} ${String(v).replace('.',',')}`,'#ffd60a',2.0);s.position.set(x+5,y-2.8,z+.6);dyn.add(s)})}
const PU={N:{x:-.5,y:61.4,a:0},M:{x:-.5,y:49.8,a:0},B:{x:-.3,y:40.6,a:-8}};
const SK={vol:[10.5,35.0],tone1:[18.0,30.8],tone2:[24.5,25.2]},SSW=[18.6,39.9],SJK=[17.6,21.6],SD=new THREE.Vector2(-.42,.91).normalize();
const NAME={N:'Neck',M:'Middle',B:'Bridge'};
function updStrat(S){const st=S.st,Z=12.6;
  S.act.forEach(a=>{const p=PU[a.id];const on=a.on;const g=new THREE.Group();g.position.set(p.x,p.y,10.9);g.rotation.z=p.a*Math.PI/180;
    if(on)g.add(top(new THREE.Mesh(new THREE.PlaneGeometry(26,13),new THREE.MeshBasicMaterial({map:GT,blending:THREE.AdditiveBlending,opacity:Math.max(.3,a.vol/10)})),9));
    g.add(top(new THREE.Mesh(new THREE.BoxGeometry(14.6,3.0,.3),new THREE.MeshBasicMaterial({color:on?0xff9f0a:0x8e8e93,opacity:on?.85:.25})),10));
    for(let i=0;i<6;i++){const d=new THREE.Mesh(new THREE.CircleGeometry(.42,16),new THREE.MeshBasicMaterial({color:on?0x5a3500:0x666666,opacity:.9}));d.position.set(-4.8+i*1.92,0,.2);g.add(top(d,11))}
    const s=sprite(NAME[a.id],on?'#ff9f0a':'#666',2.6);s.position.set(-12.5,0,.5);g.add(s);dyn.add(g)});
  knobOverlay([['vol','Vol'],['tone1','T1'],['tone2','T2']].map(([kk,l])=>[SK[kk][0],SK[kk][1],l,st[kk]??10]),12.4);
  const kp=Number(st.pos)||3;const sp=new THREE.Vector2(...SSW).addScaledVector(SD,(kp-3)*1.15);{const ball=new THREE.Mesh(new THREE.SphereGeometry(.85,20,12),new THREE.MeshBasicMaterial({color:0xff9f0a}));ball.position.set(sp.x,sp.y,14.2);dyn.add(top(ball,15))}
  const ss=sprite('Stellung '+kp,'#ff9f0a',2.0);ss.position.set(sp.x+5.2,sp.y+1.6,14.5);dyn.add(ss);
  if(S.showW){const lv=S.lv,leg=S.leg;
    S.act.forEach(a=>{const p=PU[a.id],an=p.a*Math.PI/180,e=[p.x+7.6*Math.cos(an),p.y+7.6*Math.sin(an)];tube([[e[0],e[1]],[e[0]+4,(e[1]+SSW[1])/2,.6],SSW],Z,lv.pu[a.id]||0,NAME[a.id]+' → Schalter',leg)});
    tube([SSW,[13.8,38.6,.6],SK.vol],Z,lv.sw,'Schalter → Volume',leg);tube([SK.vol,[12.5,27,.6],SJK],Z,lv.out,'Volume → Buchse',leg);
    [['N','tone1'],['M','tone2']].forEach(([id,k2])=>{const mv=(lv.pu[id]||0)>0&&(st[k2]??10)<10?lv.pu[id]*(1-st[k2]/10)*.6:0;tube([SSW,[(SSW[0]+SK[k2][0])/2+2,(SSW[1]+SK[k2][1])/2,.4],SK[k2]],Z,mv,null,leg)})}}
function updProc(S,P,G){const st=S.st,lp=S.gw==="gibson",Z=TOPZ+4.5;
  S.act.forEach(a=>{const B=P.BOB[a.id];if(!B)return;const y=G.PY[a.id];
    B.forEach((b,c)=>{const on=a.on&&a.coils[c];const split=a.on&&!a.coils[c];b.material.emissive.set(on?0xff7a00:0x000000);b.material.emissiveIntensity=on?.03+.05*a.vol/10:0;
      if(on||split){const w=80*k/2+.5,h=17.5*k/2+.45,r=.8,sh=new THREE.Shape();sh.moveTo(-w+r,-h);sh.lineTo(w-r,-h);sh.quadraticCurveTo(w,-h,w,-h+r);sh.lineTo(w,h-r);sh.quadraticCurveTo(w,h,w-r,h);sh.lineTo(-w+r,h);sh.quadraticCurveTo(-w,h,-w,h-r);sh.lineTo(-w,-h+r);sh.quadraticCurveTo(-w,-h,-w+r,-h);
        const hole=new THREE.Path();const w2=w-.45,h2=h-.45;hole.moveTo(-w2,-h2);hole.lineTo(w2,-h2);hole.lineTo(w2,h2);hole.lineTo(-w2,h2);hole.lineTo(-w2,-h2);sh.holes.push(hole);
        const o=new THREE.Mesh(new THREE.ShapeGeometry(sh,6),new THREE.MeshBasicMaterial({color:on?0xff9f0a:0x64d2ff,opacity:on?Math.max(.55,a.vol/10):.9}));o.position.set(b.position.x,b.position.y,TOPZ+3.7);dyn.add(top(o,12))}});
    if(a.on){const gl=new THREE.Mesh(new THREE.PlaneGeometry(44,24),new THREE.MeshBasicMaterial({map:GT,blending:THREE.AdditiveBlending,opacity:Math.max(.2,a.vol/10)*.45}));gl.position.set(0,Y(y),TOPZ+1.4);gl.renderOrder=1;gl.material.transparent=true;gl.material.depthWrite=false;dyn.add(gl)}
    const s=sprite(NAME[a.id]+(a.on?(a.coils[1]?' · 2 Spulen':' · 1 Spule'):''),a.on?'#ff9f0a':'#666',2.6);s.position.set(-24,Y(y),TOPZ+4);dyn.add(s)});
  const kl=lp?[['vol1','V1'],['vol2','V2'],['tone1','T1'],['tone2','T2']]:[['vol','Vol'],['tone','Tone']];
  knobOverlay(kl.map(([kk,l],i)=>[X(G.KP[i][0]),Y(G.KP[i][1]),l,st[kk]??10]),TOPZ+(lp?4.4:3.9));
  // Schalterhebel
  const idx=S.posIdx,ang=[-28,0,28][idx]*(lp?1:-1)*Math.PI/180;const sx=X(G.SWP[0]),sy=Y(G.SWP[1]);
  const lev=new THREE.Group();lev.position.set(sx,sy,TOPZ+.8);const rod=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,5.5,10),new THREE.MeshBasicMaterial({color:0xdddddd}));rod.position.y=2.75;lev.add(top(rod,14));
  const tip=new THREE.Mesh(new THREE.SphereGeometry(1.1,16,10),new THREE.MeshBasicMaterial({color:0xff9f0a}));tip.position.y=5.6;lev.add(top(tip,15));lev.rotation.x=-.5;lev.rotation.z=ang;dyn.add(lev);
  const ss=sprite(S.posLabel,'#ff9f0a',2.0);ss.position.set(sx+(lp?7:-8),sy+5,TOPZ+6);dyn.add(ss);
  if(S.showW){const lv=S.lv,leg=S.leg;const PE=id=>[X(180+44),Y(G.PY[id])];
    if(lp){[['N',0,2,'Volume Neck → Toggle',-1],['B',1,3,'Volume Bridge → Toggle',1]].forEach(([id,vi,ti,lab,sg])=>{const a=S.act.find(q=>q.id===id);const raw=lv.raw[id]||0;const V=[X(G.KP[vi][0]),Y(G.KP[vi][1])],Tn=[X(G.KP[ti][0]),Y(G.KP[ti][1])];const t=id==="N"?st.tone1:st.tone2;
      tube([PE(id),[PE(id)[0]+6,(PE(id)[1]+V[1])/2,.6],V],Z,raw,NAME[id]+' → Volume',leg);tube([V,[(V[0]+Tn[0])/2+1.5,(V[1]+Tn[1])/2,.4],Tn],Z,raw>0&&t<10?raw*(1-t/10)*.6:0,null,leg);
      tube([V,[V[0]-12-sg*4,(V[1]+sy)/2-4,.8],[sx,sy]],Z,lv.pu[id]||0,lab,leg)});
      tube([[sx,sy],[-30,Y(560),.8],[-26,Y(700),.8],[0,Y(752),.8],[X(G.J[0]),Y(G.J[1])]],Z,lv.out,'Toggle → Buchse',leg)}
    else{S.act.forEach(a=>tube([PE(a.id),[PE(a.id)[0]+3,(PE(a.id)[1]+sy)/2,.6],[sx,sy]],Z,lv.pu[a.id]||0,NAME[a.id]+' → Schalter',leg));
      const V=[X(G.KP[0][0]),Y(G.KP[0][1])],Tn=[X(G.KP[1][0]),Y(G.KP[1][1])];
      tube([[sx,sy],[(sx+V[0])/2,(sy+V[1])/2+1,.5],V],Z,lv.sw,'Schalter → Volume',leg);tube([V,[V[0]+8,(V[1]+Y(G.J[1]))/2,.6],[X(G.J[0]),Y(G.J[1])]],Z,lv.out,'Volume → Buchse',leg);
      tube([V,[(V[0]+Tn[0])/2+1,(V[1]+Tn[1])/2,.4],Tn],Z,lv.sw>0&&st.tone<10?lv.sw*(1-st.tone/10)*.6:0,null,leg)}}}
function clearDyn(){dyn.traverse(o=>{if(o.geometry&&!o.isSprite)o.geometry.dispose();const m=o.material;if(m){if(m.map&&m.map!==GT)m.map.dispose();m.dispose()}});dyn.clear()}
const api={frames:0,low,
 update(S,G){if(!alive||!S)return;last=[S,G];clearDyn();
  let P=null;if(S.gw==="strat"){if(!G3.strat){loadStrat();Object.values(G3).forEach(o=>o.grp.visible=false);draw();return}}else{if(!G3[S.gw]&&G&&G.T===S.gw)G3[S.gw]=buildProc(G);P=G3[S.gw]}
  Object.entries(G3).forEach(([t,o])=>o.grp.visible=t===S.gw);
  if(curT!==S.gw){curT=S.gw;api.reset()}
  if(S.gw==="strat")updStrat(S);else if(P)updProc(S,P,G);draw()},
 ready(gw){return !!G3[gw]},
 reset(){ctl.target.set(0,96,6);cam.position.set(18,40,400);ctl.update();draw()},
 body(){ctl.target.set(4,44,8);cam.position.set(10,20,150);ctl.update();draw()},
 show(on){shown=!!on;if(shown)size()},
 info(){return {pr:R.getPixelRatio(),env:!!scene.environment,cc:(()=>{let n=0;scene.traverse(o=>{if(o.material&&o.material.isMeshPhysicalMaterial)n++});return n})(),geo:R.info.memory.geometries,tex:R.info.memory.textures,calls:R.info.render.calls,models:Object.keys(G3).filter(k=>G3[k]),strat:!!G3.strat}},
 dispose(){if(!alive)return;alive=false;ro.disconnect();ctl.dispose();clearDyn();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();const m=o.material;if(m)(Array.isArray(m)?m:[m]).forEach(x=>{if(x.map)x.map.dispose();x.dispose()})});GT.dispose();if(envT)envT.dispose();if(pm)pm.dispose();R.dispose();R.forceContextLoss();R.domElement.remove()}};
return api}
