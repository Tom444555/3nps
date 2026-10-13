// Offline-Cache für die 3nps-App. Bei Updates CACHE-Version hochzählen.
const CACHE = '3nps-v71';
const ASR = 'asr-1';   // Name ohne „3nps-“: wird beim Update nicht gelöscht (Version erhöhen, wenn sich das Modell ändert)
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
  // Texterkennung: Modell und Laufzeit (~100 MB) in eigenem Speicher, der App-Updates überlebt; erst laden, wenn gebraucht
  if (url.pathname.includes('/asr/')) {
    e.respondWith(caches.open(ASR).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  // App-Seite: sofort aus dem Speicher (auch ohne oder mit hängendem Internet), neue Fassung im Hintergrund holen –
  // sie gilt beim nächsten Öffnen. Nur beim allerersten Start (noch nichts gespeichert) wird auf das Netz gewartet.
  if (req.mode === 'navigate') {
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); } return r; });
    e.respondWith(caches.match('index.html').then(hit => {
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => caches.match('index.html'));
    }));
    return;
  }
  // Alles andere (Icons, Schriften): Cache zuerst
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
