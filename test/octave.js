const fs=require('fs');
eval.call(global, fs.readFileSync('fft.js','utf8'));
let src=fs.readFileSync('../app/beat.js','utf8');
// Merkmale für ein vorgegebenes Tempo ausgeben
src=src.replace("  const P = chosen.g.p;", `  const P = chosen.g.p;
  if (opts.probe) { for (const b of opts.probe) { const g = fit(60*fps/b); let le=0,lo=0,he=0,ho=0,l8=0,h8=0,k=0;
      for (let t=g.ph; t+g.p<nF-1; t+=g.p, k++) { const L=peakAt(OL,t,1.5), H=peakAt(OH,t,1.5); if(k%2){lo+=L;ho+=H;}else{le+=L;he+=H;} l8+=peakAt(OL,t+g.p/2,1.5); h8+=peakAt(OH,t+g.p/2,1.5); }
      const flip = le<lo; if(flip){[le,lo]=[lo,le];[he,ho]=[ho,he];}
      const aL=(le-lo)/(le+lo+1e-9), aH=(he-ho)/(he+ho+1e-9), Rh=h8/((he+ho)/2*2/k*k/2+1e-9), Rl=l8/((le+lo)+1e-9);
      opts.out.push([b, 'aL', aL.toFixed(2), 'aH', aH.toFixed(2), 'H8/H', (h8/(he+ho+1e-9)).toFixed(2), 'L8/L', (l8/(le+lo+1e-9)).toFixed(2)].join(' ')); } }`);
eval.call(global, src);
function readWav(p){const b=fs.readFileSync(p);let o=12,sr=0,data=null;while(o<b.length){const id=b.toString('ascii',o,o+4),len=b.readUInt32LE(o+4);if(id==='fmt ')sr=b.readUInt32LE(o+12);if(id==='data'){data=new Float32Array(len/2);for(let i=0;i<data.length;i++)data[i]=b.readInt16LE(o+8+i*2)/32768;}o+=8+len+(len&1);}return{sr,data};}
const CD=process.env.CORPUS||'corpus'; for (const f of fs.readdirSync(CD).filter(f=>f.endsWith('.json')).sort()) {
  const gt=JSON.parse(fs.readFileSync(CD+'/'+f)); const w=readWav(CD+'/'+f.replace('.json','.wav'));
  const n=Math.floor(w.data.length/2), m=new Float32Array(n); for(let i=0;i<n;i++) m[i]=(w.data[2*i]+w.data[2*i+1])/2;
  const out=[]; beatAnalyse(m, w.sr/2, {probe:[gt.bpm/2, gt.bpm, gt.bpm*2].filter(b=>b>=45&&b<=240), out});
  console.log('== '+gt.name); out.forEach(l=>console.log('   '+l));
}
