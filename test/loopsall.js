const fs=require('fs');eval.call(global,fs.readFileSync('fft.js','utf8'));eval.call(global,fs.readFileSync('../app/beat.js','utf8'));
function readWav(p){const b=fs.readFileSync(p);let o=12,sr=0,data=null;while(o<b.length){const id=b.toString('ascii',o,o+4),len=b.readUInt32LE(o+4);if(id==='fmt ')sr=b.readUInt32LE(o+12);if(id==='data'){data=new Float32Array(len/2);for(let i=0;i<data.length;i++)data[i]=b.readInt16LE(o+8+i*2)/32768;}o+=8+len+(len&1);}return{sr,data};}
let ok=0,okOct=0,n=0; for (const set of ['corpus','valid']) for (const f of fs.readdirSync(set).filter(f=>f.endsWith('.json'))) { const g=JSON.parse(fs.readFileSync(set+'/'+f)); const w=readWav(set+'/'+f.replace('.json','.wav'));
 for (const nb of [2,4]) for (const sh of [0, 0.5]) { const bt=60/g.bpm; const a=Math.round((g.downbeats[2]+sh*bt)*w.sr), e=Math.round((g.downbeats[2+nb]+sh*bt)*w.sr); const x=w.data.subarray(a,e); const m=new Float32Array(Math.floor(x.length/2)); for(let i=0;i<m.length;i++)m[i]=(x[2*i]+x[2*i+1])/2;
  const r=loopAnalyse(m,w.sr/2); n++; const L=x.length/w.sr, barL=L/nb, exp=-sh*bt;
  const offOk = r && Math.min(...[-1,0,1].map(k=>Math.abs(r.downOffsetSec-(exp+k*barL))))<0.03;
  const exB = 240*nb/L; /* Tempo des Ausschnitts (bei Drift-Songs nicht das Durchschnittstempo) */ const bpmOk = r && Math.abs(r.bpm-exB)/exB<0.005, octOk = r && [0.5,2].some(q=>Math.abs(r.bpm-exB*q)/(exB*q)<0.005);
  // Takt 1 bei halber Oktave: halbe Taktlänge als Toleranz
  const offOkOct = r && Math.min(...[-2,-1,0,1,2].map(k=>Math.abs(r.downOffsetSec-(exp+k*barL/2))))<0.03;
  if (bpmOk && offOk) ok++; else if (octOk && offOkOct) okOct++; else console.log('  daneben:',g.name,nb,'T, Versatz',sh,'→',r?r.bars+' T '+r.bpm.toFixed(1)+' BPM Eins '+(r.downOffsetSec*1000).toFixed(0)+'ms (soll '+(exp*1000).toFixed(0)+')':'-'); } }
console.log(`Loops: ${ok}/${n} genau richtig · ${okOct} nur Tempo-Oktave (½/2×) · ${n-ok-okOct} falsch`);
