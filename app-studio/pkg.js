// ---------- Studio v122: Projekt als Datei teilen / importieren (.loopsmiths = ZIP) ----------
// Inhalt: loopsmiths.json (Format, Version, Audio-Liste, Instrument-/Kit-Verweise), project.json, audio/<id>.wav (16 Bit,
// genau die gespeicherten Blöcke → bitgenau). Geschrieben und gelesen Block für Block (65536 Bilder), mit Fortschritt.
// ZIP ohne Kompression (Audio lässt sich kaum packen), Daten-CRC je Datei wird beim Lesen geprüft.
const Pkg = (() => {
  const FORMAT = 'loopsmiths-project', VER = 1;
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crcUp = (c, d) => { for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return c; };
  // Audio, auf das ein Projekt verweist (Regionen, Takes, Original vor dem Quantisieren, Tonhöhenkorrektur)
  function audioIds(P) { const s = new Set(); (P.regions || []).forEach(r => { if (r.audio) s.add(r.audio); (r.takes || []).forEach(t => t.audio && s.add(t.audio)); if (r.qz && r.qz.audio) s.add(r.qz.audio); if (r.pc && r.pc.audio) s.add(r.pc.audio); }); return [...s]; }
  function wavHead(sr, ch, frames) {
    const n = frames * ch * 2, v = new DataView(new ArrayBuffer(44)), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n, true);
    return new Uint8Array(v.buffer);
  }
  // ---------- Schreiben ----------
  async function build(P, prog) {
    const ids = audioIds(P), metas = [];
    for (const id of ids) { const m = await SDB.meta(id); if (m) metas.push(m); }
    const total = metas.reduce((s, m) => s + m.frames, 0) || 1; let done = 0;
    const files = [];   // {name, blob, crc, size}
    const addSmall = (name, u8) => files.push({ name, blob: new Blob([u8]), crc: (crcUp(0xFFFFFFFF, u8) ^ 0xFFFFFFFF) >>> 0, size: u8.length });
    const inst = [...new Set(P.tracks.filter(t => t.kind === 'midi' && t.inst).map(t => t.inst))], kits = [...new Set(P.tracks.filter(t => t.kind === 'drum').map(t => t.kit || 'rock'))];
    const man = { format: FORMAT, v: VER, app: (document.querySelector('meta[name=version]') || {}).content || 'v122', created: new Date().toISOString(), name: P.name, sr: P.sr,
      audio: metas.map(m => ({ id: m.id, name: m.name, file: 'audio/' + m.id + '.wav', sr: m.sr, ch: m.ch, frames: m.frames })), inst, kits };
    addSmall('loopsmiths.json', enc.encode(JSON.stringify(man, null, 1)));
    addSmall('project.json', enc.encode(JSON.stringify(P)));
    for (const m of metas) {
      const head = wavHead(m.sr, m.ch, m.frames), parts = [head]; let c = crcUp(0xFFFFFFFF, head), size = head.length;
      for (let k = 0; k < m.chunks; k++) {
        const ck = await SDB.rawChunk(m.id, k), n = ck ? ck.l.length : Math.min(SDB.CH, m.frames - k * SDB.CH), u = new Uint8Array(n * m.ch * 2), dv = new DataView(u.buffer);
        if (ck) for (let i = 0, o = 0; i < n; i++) { dv.setInt16(o, ck.l[i], true); o += 2; if (m.ch > 1) { dv.setInt16(o, ck.r ? ck.r[i] : ck.l[i], true); o += 2; } }
        c = crcUp(c, u); size += u.length; parts.push(u); done += n; if (prog) prog(done / total);
        if (k % 8 === 7) await new Promise(r => setTimeout(r, 0));   // Bildschirm bleibt bedienbar
      }
      files.push({ name: 'audio/' + m.id + '.wav', blob: new Blob(parts), crc: (c ^ 0xFFFFFFFF) >>> 0, size });
    }
    // ZIP (gespeichert, ohne Kompression)
    const out = [], cen = []; let off = 0;
    files.forEach(f => {
      const nm = enc.encode(f.name), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, f.crc, true); h.setUint32(18, f.size, true); h.setUint32(22, f.size, true); h.setUint16(26, nm.length, true);
      out.push(new Uint8Array(h.buffer), nm, f.blob);
      const z = new DataView(new ArrayBuffer(46)); z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true); z.setUint32(16, f.crc, true); z.setUint32(20, f.size, true); z.setUint32(24, f.size, true); z.setUint16(28, nm.length, true); z.setUint32(42, off, true);
      cen.push(new Uint8Array(z.buffer), nm); off += 30 + nm.length + f.size;
    });
    if (off > 0xFFFFFFF0) throw new Error('Projekt zu groß für eine Datei (über 4 GB).');
    const cs = cen.reduce((s, x) => s + x.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...out, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  async function share(say) {
    const P = Proj.P; await Proj.save();
    const blob = await build(P, f => say('Packe das Projekt … ' + Math.round(f * 100) + ' %'));
    window.__lastPkg = { size: blob.size, name: Exp.safe(P.name) + '.loopsmiths' };
    const file = new File([blob], Exp.safe(P.name) + '.loopsmiths', { type: 'application/zip' });
    return Exp.share(file, say);
  }
  // ---------- Lesen ----------
  const rd = async (blob, a, n) => new Uint8Array(await blob.slice(a, a + n).arrayBuffer());
  async function dir(blob) {
    const tail = Math.min(blob.size, 65557), t = await rd(blob, blob.size - tail, tail), v = new DataView(t.buffer); let e = -1;
    for (let i = t.length - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('Keine Loopsmiths-Projektdatei (ZIP-Verzeichnis fehlt).');
    const n = v.getUint16(e + 10, true), cs = v.getUint32(e + 12, true), co = v.getUint32(e + 16, true), c = await rd(blob, co, cs), cv = new DataView(c.buffer), dec = new TextDecoder(), out = {};
    for (let p = 0, k = 0; k < n; k++) {
      if (cv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt.');
      const meth = cv.getUint16(p + 10, true), crc = cv.getUint32(p + 16, true), size = cv.getUint32(p + 24, true), nl = cv.getUint16(p + 28, true), xl = cv.getUint16(p + 30, true), cl = cv.getUint16(p + 32, true), lo = cv.getUint32(p + 42, true);
      const name = dec.decode(c.subarray(p + 46, p + 46 + nl)); out[name] = { meth, crc, size, lo }; p += 46 + nl + xl + cl;
    }
    for (const k in out) { const f = out[k], h = await rd(blob, f.lo, 30), hv = new DataView(h.buffer); f.data = f.lo + 30 + hv.getUint16(26, true) + hv.getUint16(28, true); }
    return out;
  }
  async function text(blob, f) { if (!f) return null; if (f.meth !== 0) throw new Error('Gepackte Einträge werden nicht unterstützt.'); return new TextDecoder().decode(await rd(blob, f.data, f.size)); }
  async function readWav(blob, f, a, prog) {   // → neues Audio (16 Bit direkt in die DB), CRC geprüft
    if (!f || f.meth !== 0) throw new Error('Audio fehlt in der Datei: ' + a.file);
    const h = await rd(blob, f.data, Math.min(f.size, 4096)), v = new DataView(h.buffer); let p = 12, ch = a.ch, sr = a.sr, d0 = -1, dn = 0, bits = 16, crc = crcUp(0xFFFFFFFF, h.subarray(0, 0));
    while (p + 8 <= h.length) { const id = String.fromCharCode(h[p], h[p + 1], h[p + 2], h[p + 3]), sz = v.getUint32(p + 4, true); if (id === 'fmt ') { ch = v.getUint16(p + 10, true); sr = v.getUint32(p + 12, true); bits = v.getUint16(p + 22, true); } if (id === 'data') { d0 = p + 8; dn = sz; break; } p += 8 + sz + (sz & 1); }
    if (d0 < 0 || bits !== 16) throw new Error('Audio-Format nicht lesbar: ' + a.file);
    crc = crcUp(crc, h.subarray(0, d0));
    const frames = Math.floor(dn / (2 * ch)), w = SDB.rawWriter(a.name || 'Audio', sr, ch > 1), CH = SDB.CH;
    for (let k = 0; k * CH < frames; k++) {
      const n = Math.min(CH, frames - k * CH), u = await rd(blob, f.data + d0 + k * CH * ch * 2, n * ch * 2), dv = new DataView(u.buffer), l = new Int16Array(n), r = ch > 1 ? new Int16Array(n) : null;
      crc = crcUp(crc, u);
      for (let i = 0, o = 0; i < n; i++) { l[i] = dv.getInt16(o, true); o += 2; if (r) { r[i] = dv.getInt16(o, true); o += 2; } }
      await w.push(l, r); if (prog) prog(n);
    }
    const tail = f.size - d0 - frames * ch * 2; if (tail > 0) crc = crcUp(crc, await rd(blob, f.data + d0 + frames * ch * 2, tail));
    if (((crc ^ 0xFFFFFFFF) >>> 0) !== f.crc) throw new Error('Prüfsumme stimmt nicht (Datei beschädigt): ' + a.file);
    return w.done();
  }
  // Importieren: neues Projekt mit neuen IDs (Projekt, Spuren, Regionen, Audio); Verweise werden umgeschrieben
  async function load(blob, say) {
    const D = await dir(blob), man = JSON.parse((await text(blob, D['loopsmiths.json'])) || 'null');
    if (!man || man.format !== FORMAT) throw new Error('Keine Loopsmiths-Projektdatei.');
    if (!(man.v <= VER)) throw new Error('Die Datei kommt aus einer neueren Studio-Version (Format ' + man.v + '). Bitte erst das Studio aktualisieren (App zweimal öffnen).');
    const P = JSON.parse(await text(blob, D['project.json'])); if (!P || !Array.isArray(P.tracks) || !Array.isArray(P.regions)) throw new Error('project.json fehlt oder ist beschädigt.');
    if (P.v > 1) throw new Error('Projektformat ' + P.v + ' ist neuer als dieses Studio.');
    const total = (man.audio || []).reduce((s, a) => s + a.frames, 0) || 1; let done = 0; const amap = {};
    for (const a of man.audio || []) { const m = await readWav(blob, D[a.file], a, n => { done += n; say && say('Importiere Audio … ' + Math.round(done / total * 100) + ' %'); }); amap[a.id] = m.id; }
    const tmap = {}; P.tracks.forEach(t => { tmap[t.id] = Proj.nid('t'); });
    const A = id => id && (amap[id] || id);
    P.tracks.forEach(t => { t.id = tmap[t.id]; const cp = t.fx && t.fx.comp; if (cp && cp.sc && tmap[cp.sc]) cp.sc = tmap[cp.sc]; });
    (P.groups || []).forEach(g => { const cp = g.fx && g.fx.comp; if (cp && cp.sc && tmap[cp.sc]) cp.sc = tmap[cp.sc]; });
    P.regions.forEach(r => { r.id = Proj.nid('r'); r.track = tmap[r.track] || r.track; if (r.audio) r.audio = A(r.audio); (r.takes || []).forEach(t => { t.audio = A(t.audio); }); if (r.qz) r.qz.audio = A(r.qz.audio); if (r.pc) { r.pc.audio = A(r.pc.audio); r.pc.src = A(r.pc.src); } });
    const missing = (man.inst || []).filter(i => window.Inst && Inst.LIST && !Inst.LIST.some(x => x.id === i));   // unbekannte Instrumente klingen ersatzweise als E-Piano
    P.id = Proj.nid('p'); P.ts = Date.now(); delete P.fromIdea; delete P.importTs;
    const names = new Set((await Proj.list()).map(p => p.name)); if (names.has(P.name)) P.name = P.name + ' (importiert)';
    await SDB.put('projects', P);
    if (Engine.playing) Engine.stop(); await Proj.load(P.id);
    window.__lastImport = { id: P.id, audio: Object.keys(amap).length, missing };
    return P;
  }
  function pick(say) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.loopsmiths,.zip,application/zip'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = async () => { const f = inp.files && inp.files[0]; inp.remove(); if (!f) return; try { say('Lese „' + f.name + '“ …'); const P = await load(f, say); Arr.V.sel = Arr.V.selTrack = null; Arr.heads(); Arr.zoomAll(); UI.inspect(); UI.sync(); say('Importiert: „' + P.name + '“ (' + P.tracks.length + ' Spuren, ' + P.regions.length + ' Regionen).'); } catch (e) { console.error(e); say('Import: ' + e.message); } };
    inp.click();
  }
  return { build, share, load, pick, dir, audioIds, FORMAT, VER };
})();
window.Pkg = Pkg;
