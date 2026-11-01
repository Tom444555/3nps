// ---------- Studio: Projekt (Daten, Rückgängig, Sichern) ----------
// Projekt = kleine JSON-Struktur; Audio liegt getrennt (SDB). Zeiten in Bildern (Frames) bei der Projekt-Abtastrate,
// MIDI-Noten in Schlägen relativ zum Regionsanfang. v121: Tempokarte (TMap) – Grundtempo P.bpm/P.sig + Wechsel P.tempo
// = [{bar, bpm?, sig?}] an Taktgrenzen (sprunghaft); ohne P.tempo = konstantes Tempo wie bisher.
const TMap = (() => {
  const cache = new WeakMap();
  function key(P) { let k = P.sr + '|' + P.bpm + '|' + P.sig; const t = P.tempo; if (t && t.length) for (const m of t) k += '|' + m.bar + ':' + (m.bpm || '') + ':' + (m.sig || ''); return k; }
  function segs(P) {
    const k = key(P), c = cache.get(P); if (c && c.k === k) return c.s;
    const sr = P.sr || 48000, sp = b => sr * 60 / b, out = [{ bar: 0, beat: 0, f: 0, bpm: P.bpm || 100, sig: P.sig || 4 }]; out[0].spb = sp(out[0].bpm);
    const ch = (P.tempo || []).filter(m => m && m.bar > 0).map(m => ({ bar: Math.round(m.bar), bpm: +m.bpm || 0, sig: Math.round(+m.sig || 0) })).sort((a, b) => a.bar - b.bar);
    for (const m of ch) {
      let s = out[out.length - 1];
      if (m.bar > s.bar) { const n = m.bar - s.bar; s = { bar: m.bar, beat: s.beat + n * s.sig, f: s.f + n * s.sig * s.spb, bpm: s.bpm, sig: s.sig }; out.push(s); }
      if (m.bpm >= 20) s.bpm = m.bpm; if (m.sig >= 1) s.sig = m.sig; s.spb = sp(s.bpm);
    }
    cache.set(P, { k, s: out }); return out;
  }
  const byF = (S, f) => { let i = S.length - 1; while (i > 0 && S[i].f > f + 1e-6) i--; return S[i]; };
  const byB = (S, b) => { let i = S.length - 1; while (i > 0 && S[i].beat > b + 1e-9) i--; return S[i]; };
  const byBar = (S, b) => { let i = S.length - 1; while (i > 0 && S[i].bar > b + 1e-9) i--; return S[i]; };
  const f2beat = (P, f) => { const s = byF(segs(P), f); return s.beat + (f - s.f) / s.spb; };
  const beat2f = (P, b) => { const s = byB(segs(P), b); return s.f + (b - s.beat) * s.spb; };
  const f2bar = (P, f) => { const s = byF(segs(P), f); return s.bar + (f - s.f) / (s.spb * s.sig); };
  const bar2f = (P, b) => { const s = byBar(segs(P), b); return s.f + (b - s.bar) * s.sig * s.spb; };
  const at = (P, f) => byF(segs(P), f);
  // Takt/Schlag/16tel an einer Stelle (0-basiert)
  function pos(P, f) { const s = byF(segs(P), f), bt = (f - s.f) / s.spb, bi = Math.floor(bt / s.sig + 1e-9), r = bt - bi * s.sig, b = Math.floor(r + 1e-9); return { bar: s.bar + bi, beat: b, sub: Math.max(0, Math.floor((r - b) * 4 + 1e-6)), sig: s.sig, bpm: s.bpm }; }
  // jeder Schlag in [a, b): fn(Bild, Takt-Eins?, Schlagnummer)
  function beats(P, a, b, fn) { const S = segs(P); for (let k = Math.ceil(f2beat(P, a) - 1e-6), g = 0; g < 100000; k++, g++) { const f = beat2f(P, k); if (f >= b) break; if (f < a) continue; const s = byB(S, k); fn(f, ((k - s.beat) % s.sig + s.sig) % s.sig === 0, k); } }
  // Taktgrenze an/vor/nach f
  const barFloor = (P, f) => bar2f(P, Math.floor(f2bar(P, f) + 1e-6));
  const barCeil = (P, f) => bar2f(P, Math.ceil(f2bar(P, f) - 1e-6));
  // Taktart des Schlags k (für Taktstriche)
  function isBarBeat(P, k) { const s = byB(segs(P), k), m = ((k - s.beat) % s.sig + s.sig) % s.sig; return m < 1e-6 || s.sig - m < 1e-6; }
  const changes = P => segs(P).slice(1);
  return { segs, f2beat, beat2f, f2bar, bar2f, at, pos, beats, barFloor, barCeil, isBarBeat, changes };
})();
window.TMap = TMap;
const Proj = (() => {
  const COLORS = ['#e4f2ff', '#2de2ff', '#ffd27a', '#86a8ff', '#f2c230', '#c26bff', '#8ad94e', '#ff8a3d', '#ff6fa8', '#3ddbb0', '#b8c4d6', '#ffb36b'];
  let P = null, undo = [], redo = [], saveT = null;
  const listeners = [];
  const nid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function blank(name, sr) {
    return { id: nid('p'), v: 1, name: name || 'Neues Projekt', ts: Date.now(), sr, bpm: 100, sig: 4, key: 'C Dur', tracks: [], regions: [], markers: [],
      cycle: { on: false, a: 0, b: 0 }, master: { vol: 0, eq: EQ7.flat(), glue: true, lim: true }, bus: { revSec: 2.4, dlyBeats: 0.75, dlyFb: 35 }, chords: [] };
  }
  function track(kind, name) {
    const n = P.tracks.length;
    const t = { id: nid('t'), kind: kind || 'audio', name: name || ('Spur ' + (n + 1)), color: COLORS[n % COLORS.length], vol: 0, pan: 0, mute: false, solo: false, arm: false,
      eq: EQ7.flat(), fx: { comp: { on: false, th: -18, ratio: 3, att: 10, rel: 120, mk: 0 }, sat: { on: false, drive: 30 }, rev: 0, dly: 0 }, auto: { vol: [], pan: [] } };
    if (kind === 'midi') t.inst = 'epiano';
    if (kind === 'drum') { t.kit = 'rock'; }
    return t;
  }
  const spb = f => TMap.at(P, f || 0).spb;            // Bilder pro Schlag (an der Stelle f, sonst Grundtempo)
  const bar = f => { const s = TMap.at(P, f || 0); return s.spb * s.sig; };
  const f2bar = f => TMap.f2bar(P, f), bar2f = b => Math.round(TMap.bar2f(P, b)), f2beat = f => TMap.f2beat(P, f), beat2f = b => Math.round(TMap.beat2f(P, b));
  const snap = (f, g) => g === 'bar' ? Math.round(TMap.bar2f(P, Math.round(TMap.f2bar(P, f)))) : g === 'beat' ? Math.round(TMap.beat2f(P, Math.round(TMap.f2beat(P, f)))) : g === '16' ? Math.round(TMap.beat2f(P, Math.round(TMap.f2beat(P, f) * 4) / 4)) : Math.round(f);
  // Länge in Bildern, die eine Noten-/Drummer-Region ab start braucht, um gleich viele Schläge zu behalten
  const keepBeats = (r, start) => r.kind === 'audio' ? r.len : Math.max(1, Math.round(TMap.beat2f(P, TMap.f2beat(P, start) + TMap.f2beat(P, r.start + r.len) - TMap.f2beat(P, r.start))) - start);
  // Tempokarte ändern: Noten/Drummer, Marker und Cycle bleiben am Takt, Audio bleibt in Sekunden (opts.audio: Audio-Anfänge wandern mit, Automation auch)
  function retempo(fn, opts) {
    change('tempo', p => {
      const old = { sr: p.sr, bpm: p.bpm, sig: p.sig, tempo: JSON.parse(JSON.stringify(p.tempo || [])) }; fn(p);
      if (p.tempo) { p.tempo = p.tempo.filter(m => m.bar > 0 && (m.bpm || m.sig)).sort((a, b) => a.bar - b.bar); if (!p.tempo.length) delete p.tempo; }
      const mv = f => Math.round(TMap.beat2f(p, TMap.f2beat(old, f))), au = opts && opts.audio;
      p.regions.forEach(r => { if (r.kind === 'audio') { if (au) r.start = Math.max(0, mv(r.start)); return; } const e = mv(r.start + r.len); r.start = Math.max(0, mv(r.start)); r.len = Math.max(1, e - r.start); });
      (p.markers || []).forEach(m => { m.f = mv(m.f); }); if (p.cycle) { p.cycle.a = Math.max(0, mv(p.cycle.a)); p.cycle.b = Math.max(0, mv(p.cycle.b)); }
      if (au) p.tracks.forEach(t => ['vol', 'pan'].forEach(a => ((t.auto || {})[a] || []).forEach(q => { q.f = Math.max(0, mv(q.f)); })));
    });
    Engine.dirty(true);
  }
  // ---- v121: Gruppenbusse ----
  const GMAX = 4;
  function group(k) { return { id: 'g' + k, name: 'Bus ' + k, color: COLORS[(k + 5) % COLORS.length], vol: 0, pan: 0, mute: false, solo: false, eq: EQ7.flat(), fx: { comp: { on: false, th: -18, ratio: 3, att: 10, rel: 120, mk: 0 }, sat: { on: false, drive: 30 }, rev: 0, dly: 0 } }; }
  const chan = id => P && (P.tracks.find(t => t.id === id) || (P.groups || []).find(g => g.id === id));
  function ensureGroup(p, id) { p.groups = p.groups || []; let g = p.groups.find(x => x.id === id); if (!g) { g = group(+id.slice(1)); p.groups.push(g); p.groups.sort((a, b) => a.id.localeCompare(b.id)); } return g; }
  function editChan(id, fn, opts) { if (P.tracks.some(t => t.id === id)) return editTrack(id, fn, opts); change('mix', p => { const g = (p.groups || []).find(x => x.id === id); if (g) fn(g); }, opts); Engine.applyAll(); }
  function emit(what) { listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); }
  function snapshot() { return JSON.stringify(P); }
  function change(what, fn, opts) {
    const before = snapshot();
    fn(P);
    if (!(opts && opts.noUndo)) { undo.push(before); if (undo.length > 60) undo.shift(); redo = []; }
    P.ts = Date.now(); schedSave(); emit(what || 'all');
  }
  function undoStep() { if (!undo.length) return false; redo.push(snapshot()); P = JSON.parse(undo.pop()); Engine.setProject(P); schedSave(); emit('all'); return true; }
  function redoStep() { if (!redo.length) return false; undo.push(snapshot()); P = JSON.parse(redo.pop()); Engine.setProject(P); schedSave(); emit('all'); return true; }
  function schedSave() { clearTimeout(saveT); saveT = setTimeout(save, 800); }
  async function save() { clearTimeout(saveT); if (!P) return; try { await SDB.put('projects', JSON.parse(snapshot())); localStorage.setItem('3nps-studio-last', P.id); } catch (e) { console.warn(e); } }
  async function load(id) { const p = await SDB.get('projects', id); if (!p) return false; set(p); return true; }
  function set(p) { P = p; undo = []; redo = []; Engine.setProject(P); emit('all'); }
  async function newProject(name) { set(blank(name, Engine.sr())); await save(); return P; }
  async function list() { const ps = await SDB.all('projects'); return ps.map(p => ({ id: p.id, name: p.name, ts: p.ts, n: p.tracks.length, bpm: p.bpm })).sort((a, b) => b.ts - a.ts); }
  async function remove(id) { await SDB.del('projects', id); SDB.gc(); }
  // ---- Bearbeiten ----
  const tIndex = id => P.tracks.findIndex(t => t.id === id);
  const reg = id => P.regions.find(r => r.id === id);
  function addTrack(kind, name) { let t; change('tracks', p => { t = track(kind, name); p.tracks.push(t); }); Engine.dirty(true); return t; }
  function delTrack(id) { change('tracks', p => { p.tracks = p.tracks.filter(t => t.id !== id); p.regions = p.regions.filter(r => r.track !== id); }); Engine.dirty(true); }
  function addRegion(r, opts) { r.id = r.id || nid('r'); change('regions', p => { p.regions.push(r); }, opts); Engine.dirty(); return r; }
  function split(id, at) {
    const r = reg(id); if (!r || at <= r.start + 64 || at >= r.start + r.len - 64) return null; let r2;
    change('regions', p => {
      const x = p.regions.find(q => q.id === id), cut = at - x.start;
      r2 = JSON.parse(JSON.stringify(x)); r2.id = nid('r'); r2.start = at; r2.len = x.len - cut; r2.fi = 0;
      if (x.kind === 'audio') r2.offset = x.offset + cut;
      if (x.notes) { const cb = TMap.f2beat(p, at) - TMap.f2beat(p, x.start); r2.notes = x.notes.filter(n => n.t >= cb).map(n => Object.assign({}, n, { t: n.t - cb })); x.notes = x.notes.filter(n => n.t < cb).map(n => Object.assign({}, n, { d: Math.min(n.d, cb - n.t) })); }
      if (x.kind === 'drum') r2.barOff = (x.barOff || 0) + Math.round(TMap.f2bar(p, at) - TMap.f2bar(p, x.start));
      if (x.takes) r2.takes = JSON.parse(JSON.stringify(x.takes));
      x.len = cut; x.fo = 0; p.regions.push(r2);
    });
    Engine.dirty(); return r2;
  }
  function duplicate(id) { const r = reg(id); if (!r) return null; const c = JSON.parse(JSON.stringify(r)); c.id = nid('r'); c.start = r.start + r.len; c.len = keepBeats(r, c.start); return addRegion(c); }
  function repeat(id, n) { const r = reg(id); if (!r) return; change('regions', p => { let s = r.start + r.len; for (let i = 1; i <= n; i++) { const c = JSON.parse(JSON.stringify(r)); c.id = nid('r'); c.start = s; c.len = keepBeats(r, s); s += c.len; p.regions.push(c); } }); Engine.dirty(); }
  function delRegion(id) { change('regions', p => { p.regions = p.regions.filter(r => r.id !== id); }); Engine.dirty(); }
  function editRegion(id, fn, opts) { change('regions', p => { const r = p.regions.find(q => q.id === id); if (r) fn(r); }, opts); Engine.dirty(); }
  function editTrack(id, fn, opts) { const i = tIndex(id); change('mix', p => { fn(p.tracks[i]); }, opts); Engine.applyTrack(i, true); }
  function projEnd() { let e = 0; P.regions.forEach(r => { e = Math.max(e, r.start + r.len); }); return e; }
  return {
    get P() { return P; }, COLORS, nid, blank, track, spb, bar, f2bar, bar2f, f2beat, beat2f, snap, keepBeats, retempo, group, chan, ensureGroup, editChan, GMAX, change, undo: undoStep, redo: redoStep, canUndo: () => undo.length > 0, canRedo: () => redo.length > 0,
    save, load, set, newProject, list, remove, addTrack, delTrack, addRegion, split, duplicate, repeat, delRegion, editRegion, editTrack, reg, tIndex, projEnd,
    on: fn => listeners.push(fn), emit
  };
})();
