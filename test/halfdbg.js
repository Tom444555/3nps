const fs=require('fs');eval.call(global,fs.readFileSync('fft.js','utf8'));
let src=fs.readFileSync('../app/beat.js','utf8');
src=src.replace("    if (off > on * 1.05) {","    if (opts && opts.dbg) opts.dbg.push(['on',on.toFixed(2),'off',off.toFixed(2),'P',P.toFixed(2),'beats',beatsR.length, 'erste Schläge', beatsR.slice(0,4).map(f=>((f*128+512)/sr+0.024).toFixed(3)).join(',')]);\n    if (off > on * 1.05) {");
eval.call(global,src);
function readWav(p){const b=fs.readFileSync(p);let o=12,sr=0,data=null;while(o<b.length){const id=b.toString('ascii',o,o+4),len=b.readUInt32LE(o+4);if(id==='fmt ')sr=b.readUInt32LE(o+12);if(id==='data'){data=new Float32Array(len/2);for(let i=0;i<data.length;i++)data[i]=b.readInt16LE(o+8+i*2)/32768;}o+=8+len+(len&1);}return{sr,data};}
const w=readWav('loops/off_funk_104_2T.wav');const m=new Float32Array(Math.floor(w.data.length/2));for(let i=0;i<m.length;i++)m[i]=(w.data[2*i]+w.data[2*i+1])/2; const sr=w.sr/2;
const r0=loopAnalyse(m,sr); const n=m.length; const k=Math.round(-r0.downOffsetSec*sr), kk=((-k%n)+n)%n; const rot=new Float32Array(n); rot.set(m.subarray(kk),0); rot.set(m.subarray(0,kk),n-kk);
const dbg=[]; const r=loopAnalyse(rot,sr,{trustDownbeat:true, dbg}); console.log(dbg.map(d=>d.join(' ')).join('\n')); console.log('Eins', (r.downOffsetSec*1000).toFixed(0),'ms; Schlagdauer', (r.beatSec*1000).toFixed(0));
