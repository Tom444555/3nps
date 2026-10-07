// Tempo-Oktave je Stück (richtig / doppelt / halb) und welche Oktav-Regel gegriffen hat: node oktaveval.js oktave oktave2 oktave3 oktave4 corpus valid hard long  (V=1 zeigt Merkmale, BEAT=… andere beat.js)
const fs=require('fs');eval.call(global,fs.readFileSync('fft.js','utf8'));eval.call(global,fs.readFileSync(process.env.BEAT||'../app/beat.js','utf8'));
function readWav(p){const b=fs.readFileSync(p);let o=12,sr=0,ch=1,data=null;while(o<b.length){const id=b.toString('ascii',o,o+4),len=b.readUInt32LE(o+4);if(id==='fmt '){ch=b.readUInt16LE(o+10);sr=b.readUInt32LE(o+12);}if(id==='data'){const n=len/2/ch;data=new Float32Array(n);for(let i=0;i<n;i++){let s=0;for(let c=0;c<ch;c++)s+=b.readInt16LE(o+8+(i*ch+c)*2);data[i]=s/ch/32768;}}o+=8+len+(len&1);}return{sr,data};}
function downmix(x,sr){const f=Math.max(1,Math.floor(sr/11025)),n=Math.floor(x.length/f),o=new Float32Array(n);for(let i=0;i<n;i++){let s=0;for(let j=0;j<f;j++)s+=x[i*f+j];o[i]=s/f;}return{data:o,sr:sr/f};}
let ok=0,n=0;const L=console.log;
for(const set of process.argv.slice(2))for(const f of fs.readdirSync(set).filter(f=>f.endsWith('.wav')).sort()){const jf=set+'/'+f.replace('.wav','.json');if(!fs.existsSync(jf))continue;const gt=JSON.parse(fs.readFileSync(jf));
 const w=readWav(set+'/'+f),m=downmix(w.data,w.sr);let log=[];console.log=(...a)=>log.push(a.join(' '));const r=beatAnalyse(m.data,m.sr,{debug:true});console.log=L;if(!r)continue;if(process.env.V)L(gt.name,log.join(" | "));
 const q=r.bpm/gt.bpm, st=Math.abs(q-1)<0.03?'ok':Math.abs(q-2)<0.06?'DOPPELT':Math.abs(q-.5)<.03?'HALB':'anders('+q.toFixed(2)+')'; n++; if(st==='ok')ok++;
 const tag=log.filter(l=>/verdoppelt|halbiert|Backbeat bei|Langsam/.test(l)).map(l=>l.includes('verdoppelt')?'VERDOPPELT':l.includes('halbiert')?'HALBIERT':l.includes('Langsam')?'L':'').filter(Boolean);
 if(st!=='ok'||tag.some(t=>t!=='L'))L((set+'/'+gt.name).padEnd(32),gt.bpm,r.bpm.toFixed(1),st,tag.join(','));}
L('ok',ok,'/',n);
