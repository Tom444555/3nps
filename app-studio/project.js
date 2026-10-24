// ---------- Studio: Projekt (Daten, Rückgängig, Sichern) ----------
// Projekt = kleine JSON-Struktur; Audio liegt getrennt (SDB). Zeiten in Bildern (Frames) bei der Projekt-Abtastrate,
// MIDI-Noten in Schlägen relativ zum Regionsanfang. Konstantes Tempo je Projekt.
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
  const spb = () => P.sr * 60 / P.bpm;            // Bilder pro Schlag
  const bar = () => spb() * P.sig;
  const f2bar = f => f / bar();
  const snap = (f, g) => { const u = g === 'bar' ? bar() : g === 'beat' ? spb() : g === '16' ? spb() / 4 : 0; return u ? Math.round(f / u) * u : Math.round(f); };
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
      if (x.notes) { const cb = cut / spb(); r2.notes = x.notes.filter(n => n.t >= cb).map(n => Object.assign({}, n, { t: n.t - cb })); x.notes = x.notes.filter(n => n.t < cb).map(n => Object.assign({}, n, { d: Math.min(n.d, cb - n.t) })); }
      if (x.kind === 'drum') r2.barOff = (x.barOff || 0) + cut / bar();
      x.len = cut; x.fo = 0; p.regions.push(r2);
    });
    Engine.dirty(); return r2;
  }
  function duplicate(id) { const r = reg(id); if (!r) return null; const c = JSON.parse(JSON.stringify(r)); c.id = nid('r'); c.start = r.start + r.len; return addRegion(c); }
  function repeat(id, n) { const r = reg(id); if (!r) return; change('regions', p => { for (let i = 1; i <= n; i++) { const c = JSON.parse(JSON.stringify(r)); c.id = nid('r'); c.start = r.start + r.len * i; p.regions.push(c); } }); Engine.dirty(); }
  function delRegion(id) { change('regions', p => { p.regions = p.regions.filter(r => r.id !== id); }); Engine.dirty(); }
  function editRegion(id, fn, opts) { change('regions', p => { const r = p.regions.find(q => q.id === id); if (r) fn(r); }, opts); Engine.dirty(); }
  function editTrack(id, fn, opts) { const i = tIndex(id); change('mix', p => { fn(p.tracks[i]); }, opts); Engine.applyTrack(i, true); }
  function projEnd() { let e = 0; P.regions.forEach(r => { e = Math.max(e, r.start + r.len); }); return e; }
  return {
    get P() { return P; }, COLORS, nid, blank, track, spb, bar, f2bar, snap, change, undo: undoStep, redo: redoStep, canUndo: () => undo.length > 0, canRedo: () => redo.length > 0,
    save, load, set, newProject, list, remove, addTrack, delTrack, addRegion, split, duplicate, repeat, delRegion, editRegion, editTrack, reg, tIndex, projEnd,
    on: fn => listeners.push(fn), emit
  };
})();
