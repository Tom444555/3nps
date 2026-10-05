const fs=require('fs'),path=require('path');
eval.call(global, fs.readFileSync('fft.js','utf8'));
let src=fs.readFileSync('../app/beat.js','utf8');
src=src.replace("scored.sort((a, b) => b.score - a.score);","scored.sort((a, b) => b.score - a.score); if (opts.debug) opts.debug.push(...scored.map(s=>[s.bpm.toFixed(1), s.score.toFixed(4), 'on',s.m.on.toFixed(3),'o8',s.m.off8.toFixed(3),'o16',s.m.off16.toFixed(3),'alt',s.m.alt.toFixed(2),'pr',s.prior.toFixed(2)].join(' ')));");
eval.call(global, src);
function readWav(p){const b=fs.readFileSync(p);let o=12,sr=0,data=null;while(o<b.length){const id=b.toString('ascii',o,o+4),len=b.readUInt32LE(o+4);if(id==='fmt ')sr=b.readUInt32LE(o+12);if(id==='data'){data=new Float32Array(len/2);for(let i=0;i<data.length;i++)data[i]=b.readInt16LE(o+8+i*2)/32768;}o+=8+len+(len&1);}return{sr,data};}
function dm(x,sr){const f=2,n=Math.floor(x.length/f),o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=(x[2*i]+x[2*i+1])/2;return{data:o,sr:sr/f};}
const signed=[];
for (const name of process.argv.slice(2)) {
  const gt=JSON.parse(fs.readFileSync('corpus/'+name+'.json'));const w=readWav('corpus/'+name+'.wav'),m=dm(w.data,w.sr);
  const dbg=[]; const r=beatAnalyse(m.data,m.sr,{debug:dbg});
  console.log('==',name,gt.bpm,'->',r.bpm.toFixed(2)); dbg.slice(0,8).forEach(l=>console.log('  ',l));
}
// systematischer Versatz über alle
for (const f of fs.readdirSync('corpus').filter(f=>f.endsWith('.json'))) { const gt=JSON.parse(fs.readFileSync('corpus/'+f)); const w=readWav('corpus/'+f.replace('.json','.wav')),m=dm(w.data,w.sr); const r=beatAnalyse(m.data,m.sr);
  const errs=gt.beats.map(b=>{let best=1e9;for(const e of r.beats){if(Math.abs(e-b)<Math.abs(best))best=e-b;}return best;}).filter(e=>Math.abs(e)<0.06);
  const med=errs.sort((a,b)=>a-b)[Math.floor(errs.length/2)]; signed.push([gt.name,(med*1000).toFixed(1)]); }
console.log(signed.map(s=>s.join(':')).join('  '));
