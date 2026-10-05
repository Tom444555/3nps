const fs=require('fs');eval.call(global,fs.readFileSync('fft.js','utf8'));eval.call(global,fs.readFileSync('../app/beat.js','utf8'));
function readWav(p){const b=fs.readFileSync(p);let o=12,sr=0,data=null;while(o<b.length){const id=b.toString('ascii',o,o+4),len=b.readUInt32LE(o+4);if(id==='fmt ')sr=b.readUInt32LE(o+12);if(id==='data'){data=new Float32Array(len/2);for(let i=0;i<data.length;i++)data[i]=b.readInt16LE(o+8+i*2)/32768;}o+=8+len+(len&1);}return{sr,data};}
for (const f of process.argv.slice(2)) {
 const w=readWav(f);const m=new Float32Array(Math.floor(w.data.length/2));for(let i=0;i<m.length;i++)m[i]=(w.data[2*i]+w.data[2*i+1])/2; const sr=w.sr/2;
 const r0=loopAnalyse(m,sr); const n=m.length;
 const k=Math.round(-r0.downOffsetSec*sr), kk=((-k%n)+n)%n; const rot=new Float32Array(n); rot.set(m.subarray(kk),0); rot.set(m.subarray(0,kk),n-kk);
 const r1=loopAnalyse(rot,sr);
 // Zusätzlich: verschiedene Drehungen um ganze Schläge prüfen (Takt-1-Stabilität)
 const out=[]; const beat=n/r0.bars/4;
 for (let b=0;b<8;b++){ const s=Math.round(b*beat)%n; const q=new Float32Array(n); q.set(rot.subarray(s),0); q.set(rot.subarray(0,s),n-s); const r=loopAnalyse(q,sr,{trustDownbeat:true}); out.push((r.downOffsetSec*1000).toFixed(0)); }
 console.log(f.split('/').pop(), '| Original:', (r0.downOffsetSec*1000).toFixed(0),'ms | gedreht:', (r1.downOffsetSec*1000).toFixed(0),'ms kept',r1.startKept, '| um b Schläge gedreht → erkannte Eins (ms):', out.join(' '));
}
