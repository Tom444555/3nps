/* ---------- Speicherung auf dem Gerät (IndexedDB) ---------- */
const AppDB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('3nps-app', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('ideas')) db.createObjectStore('ideas', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      Promise.resolve(fn(s)).then(r => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return {
    all: store => tx(store, 'readonly', s => reqP(s.getAll())),
    put: (store, obj) => tx(store, 'readwrite', s => reqP(s.put(obj))),
    del: (store, id) => tx(store, 'readwrite', s => reqP(s.delete(id))),
    get: (store, id) => tx(store, 'readonly', s => reqP(s.get(id))),
  };
})();

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function refreshLog() {
  try {
    const entries = await AppDB.all('sessions');
    renderLog(entries);
  } catch (e) {
    console.error(e);
    document.getElementById('logList').innerHTML = '<p class="pattern-desc">Verlauf konnte nicht geladen werden. Private Surfen verhindert das Speichern.</p>';
  }
}

async function saveSession(elapsedSec) {
  try {
    await AppDB.put('sessions', {
      id: newId(),
      ts: Date.now(),
      dateStr: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      root: rootSel.value,
      mode: modeSel.value,
      position: parseInt(posSel.value),
      pattern: patternSel.value,
      bpm: parseInt(document.getElementById('bpm').value),
      durationSec: Math.round(elapsedSec)
    });
    refreshLog();
  } catch (e) {
    console.error('Konnte Übungseinheit nicht speichern:', e);
  }
}

async function initDb() {
  try {
    const seeded = await AppDB.get('meta', 'seeded');
    if (!seeded) {
      for (const s of SEED_SESSIONS) await AppDB.put('sessions', Object.assign({ id: newId() }, s));
      await AppDB.put('meta', { key: 'seeded', value: true });
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) { console.error(e); }
  refreshLog();
}
