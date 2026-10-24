// ---------- Studio: Speicher ----------
// Eigene Datenbank „3nps-studio“ (Projekte, Audio-Kopf, Audio-Blöcke). Audio liegt als 16-Bit-Blöcke auf dem Gerät,
// nicht im Arbeitsspeicher; gelesen wird nur, was gerade gebraucht wird (kleiner Zwischenspeicher).
// Looper-Daten („3nps-app“) werden nur gelesen – die Datenbank wird nie angelegt oder verändert (außer neuer Ideen).
const SDB = (() => {
  let dbP = null;
  function open() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      const r = indexedDB.open('3nps-studio', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('chunks')) d.createObjectStore('chunks', { keyPath: 'k' });
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbP;
  }
  const tx = async (store, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const get = (s, k) => tx(s, 'readonly', st => st.get(k));
  const put = (s, v) => tx(s, 'readwrite', st => st.put(v));
  const del = (s, k) => tx(s, 'readwrite', st => st.delete(k));
  const all = s => tx(s, 'readonly', st => st.getAll());
  async function delRange(s, lo, hi) { return tx(s, 'readwrite', st => st.delete(IDBKeyRange.bound(lo, hi))); }

  // ---- Looper-Daten (nur lesen) ----
  let lp = null;
  function openLooper() {
    if (lp) return lp;
    lp = new Promise(res => {
      let r; try { r = indexedDB.open('3nps-app'); } catch (e) { res(null); return; }
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) {} };   // gibt es nicht → nicht anlegen
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); lp = null; }; res(d); }; r.onerror = () => res(null);
    }).then(d => { if (!d) lp = null; return d; });   // noch nicht da → beim nächsten Mal neu versuchen
    return lp;
  }
  async function looperList(map) {
    const d = await openLooper(); if (!d || !d.objectStoreNames.contains('ideas')) return [];
    return new Promise(res => {
      const out = [], t = d.transaction('ideas', 'readonly'), c = t.objectStore('ideas').openCursor();
      c.onsuccess = () => { const cur = c.result; if (!cur) return; try { const m = map(cur.value); if (m) out.push(m); } catch (e) {} cur.continue(); };
      t.oncomplete = () => res(out); t.onerror = () => res(out);
    });
  }
  async function looperGet(store, key) {
    const d = await openLooper(); if (!d || !d.objectStoreNames.contains(store)) return null;
    return new Promise(res => { const r = d.transaction(store, 'readonly').objectStore(store).get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  }
  async function looperPut(store, v) {   // nur zum Hinzufügen neuer Ideen („In den Looper“)
    const d = await openLooper(); if (!d || !d.objectStoreNames.contains(store)) throw new Error('Looper-Speicher nicht gefunden – erst einmal den Looper öffnen.');
    return new Promise((res, rej) => { const t = d.transaction(store, 'readwrite'); t.objectStore(store).put(v); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  }

  // ---- Audio: Blöcke zu 65536 Bildern, 16 Bit je Kanal ----
  const CH = 65536;
  const newId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const q16 = (a, o, n) => { const r = new Int16Array(n); for (let i = 0; i < n; i++) { let v = a[o + i]; v = v > 1 ? 1 : v < -1 ? -1 : v; r[i] = v * 32767; } return r; };
  // Schreiber: nimmt Stücke beliebiger Länge an (auch während der Aufnahme), schreibt volle Blöcke sofort
  function writer(name, sr, stereo) {
    const id = newId(); let frames = 0, n = 0, bl = new Float32Array(CH), br = stereo ? new Float32Array(CH) : null, fill = 0;
    const peaks = [], PK = 512; let pmin = 0, pmax = 0, pc = 0, pending = Promise.resolve();
    function flush(len) {
      const k = n++, l = q16(bl, 0, len), r = br ? q16(br, 0, len) : null;
      pending = pending.then(() => put('chunks', { k: id + ':' + String(k).padStart(6, '0'), l, r }));
      bl = new Float32Array(CH); if (br) br = new Float32Array(CH); fill = 0;
    }
    return {
      id,
      push(l, r) {
        for (let i = 0; i < l.length; i++) {
          const a = l[i], b = r ? r[i] : a; bl[fill] = a; if (br) br[fill] = b; fill++;
          const m = Math.max(Math.abs(a), Math.abs(b)) * (a < 0 ? -1 : 1); if (a > pmax) pmax = a; if (a < pmin) pmin = a; if (b > pmax) pmax = b; if (b < pmin) pmin = b;
          if (++pc === PK) { peaks.push(Math.round(pmin * 127), Math.round(pmax * 127)); pmin = pmax = 0; pc = 0; }
          if (fill === CH) flush(CH);
        }
        frames += l.length;
      },
      async done() {
        if (fill) flush(fill); if (pc) peaks.push(Math.round(pmin * 127), Math.round(pmax * 127));
        await pending;
        const meta = { id, name, sr, ch: stereo ? 2 : 1, frames, chunks: n, peaks: Int8Array.from(peaks), pk: PK, ts: Date.now() };
        await put('audio', meta); metaCache.set(id, meta); return meta;
      }
    };
  }
  async function putAudio(name, sr, l, r) {
    const w = writer(name, sr, !!r && r !== l); const S = 1 << 18;
    for (let o = 0; o < l.length; o += S) w.push(l.subarray(o, Math.min(l.length, o + S)), r && r !== l ? r.subarray(o, Math.min(l.length, o + S)) : null);
    return w.done();
  }
  const metaCache = new Map();
  async function meta(id) { if (metaCache.has(id)) return metaCache.get(id); const m = await get('audio', id); if (m) metaCache.set(id, m); return m; }
  // Zwischenspeicher dekodierter Blöcke (höchstens ~48 Blöcke ≈ 25 MB bei Stereo)
  const cache = new Map(), MAXC = 48;
  async function chunk(id, k) {
    const key = id + ':' + String(k).padStart(6, '0');
    if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
    const c = await get('chunks', key); if (!c) return null;
    cache.set(key, c); while (cache.size > MAXC) cache.delete(cache.keys().next().value);
    return c;
  }
  // Bilder [from, from+n) als Float32 (fehlende = Stille)
  async function read(id, from, n) {
    const m = await meta(id), L = new Float32Array(n), R = m && m.ch > 1 ? new Float32Array(n) : null; if (!m) return { l: L, r: L };
    const a = Math.max(0, from), e = Math.min(m.frames, from + n);
    for (let k = Math.floor(a / CH); k * CH < e; k++) {
      const c = await chunk(id, k); if (!c) continue;
      const s0 = Math.max(a, k * CH), s1 = Math.min(e, (k + 1) * CH);
      for (let f = s0; f < s1; f++) { const j = f - k * CH, o = f - from; L[o] = c.l[j] / 32767; if (R) R[o] = c.r[j] / 32767; }
    }
    return { l: L, r: R || L };
  }
  async function delAudio(id) { metaCache.delete(id); await del('audio', id); await delRange('chunks', id + ':', id + ':~'); }
  // Speicher aufräumen: Audio, das kein Projekt mehr benutzt
  async function gc() {
    const ps = await all('projects'), used = new Set();
    ps.forEach(p => (p.regions || []).forEach(r => r.audio && used.add(r.audio)));
    const as = await tx('audio', 'readonly', st => st.getAllKeys());
    for (const id of as || []) if (!used.has(id)) await delAudio(id);
  }
  async function usage() { try { const e = await navigator.storage.estimate(); return e.usage || 0; } catch (e) { return null; } }
  return { open, get, put, del, all, putAudio, writer, meta, read, delAudio, gc, usage, looperList, looperGet, looperPut, CH, newId };
})();
