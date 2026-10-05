const fs=require('fs');
eval.call(global, fs.readFileSync('fft.js','utf8')); eval.call(global, fs.readFileSync('../app/beat.js','utf8'));
function readWav(p){const b=fs.readFileSync(p);let o=12,sr=0,data=null;while(o<b.length){const id=b.toString('ascii',o,o+4),len=b.readUInt32LE(o+4);if(id==='fmt ')sr=b.readUInt32LE(o+12);if(id==='data'){data=new Float32Array(len/2);for(let i=0;i<data.length;i++)data[i]=b.readInt16LE(o+8+i*2)/32768;}o+=8+len+(len&1);}return{sr,data};}
let ok=0,n=0;
for (const f of fs.readdirSync('loops').filter(f=>f.endsWith('.json')).sort()) {
  const gt=JSON.parse(fs.readFileSync('loops/'+f)); const w=readWav('loops/'+f.replace('.json','.wav'));
  const m=new Float32Array(Math.floor(w.data.length/2)); for(let i=0;i<m.length;i++) m[i]=(w.data[2*i]+w.data[2*i+1])/2;
  const r=loopAnalyse(m, w.sr/2); n++;
  const exp = gt.expectOff || 0, barL = gt.len / gt.bars; const offErr = Math.min(...[-1,0,1].map(k => Math.abs(r ? r.downOffsetSec - (exp + k*barL) : 9)));
  const good = r && r.isLoop && r.bars===gt.bars && offErr<0.03 && Math.abs(r.bpm-gt.bpm)/gt.bpm<0.005;
  if (good) ok++;
  console.log(f.padEnd(26), 'Soll', gt.bars,'T', gt.bpm, '| Ist', r? [r.bars+'T', r.bpm.toFixed(2)+' BPM', 'Loop:'+r.isLoop, 'Längenfehler '+r.lenErrMs.toFixed(1)+'ms', 'Takt1 '+(r.downOffsetSec*1000).toFixed(1)+'ms'].join(' '):'-', good?'OK':'FEHLER');
}
console.log(`\nLoops richtig: ${ok}/${n}`);
