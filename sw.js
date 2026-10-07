// Offline-Cache für die 3nps-App. Bei Updates CACHE-Version hochzählen.
const CACHE = '3nps-v36';
const CORE = ['./', 'index.html', 'bg-metal.jpg', 'panel.jpg', 'panel-dark.jpg', 'runes.png', 'emblem.png', 'corner-tl.png', 'corner-tr.png', 'corner-bl.png', 'corner-br.png', 'bg-iron.jpg', 'panel-iron.jpg', 'stud-iron.png', 'studs-iron.png', 'emblem-iron.png', 'tolex.jpg', 'alu.jpg', 'alu-dark.jpg', 'grille.jpg', 'screw.png', 'jewel.png', 'bg-ice.jpg', 'panel-ice.jpg', 'icicles.png', 'rivet-ice.png', 'emblem-ice.png', 'bg-matrix.jpg', 'bg-dj.jpg', 'panel-dj.jpg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('3nps-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/stabil/')) return;   // stabile Fassung hat ihren eigenen Speicher
  // App-Seite: erst Netz (für Updates), sonst Cache
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // Alles andere (Icons, Schriften): Cache zuerst
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
