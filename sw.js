// Offline-Cache für die 3nps-App. Bei Updates CACHE-Version hochzählen.
const CACHE = '3nps-v112';
const ASR = 'asr-1';
const DRUMS = 'drums-1';   // echtes Kit (v98): eigener Speicher, überlebt Updates (Version erhöhen, wenn sich kit.flac ändert)   // Name ohne „3nps-“: wird beim Update nicht gelöscht (Version erhöhen, wenn sich das Modell ändert)
const CORE = ['./', 'index.html', 'stretch/worker.js', 'stretch/SignalsmithStretch.js', 'bg-metal.jpg', 'panel.jpg', 'panel-dark.jpg', 'runes.png', 'emblem.png', 'corner-tl.png', 'corner-tr.png', 'corner-bl.png', 'corner-br.png', 'bg-iron.jpg', 'panel-iron.jpg', 'stud-iron.png', 'studs-iron.png', 'emblem-iron.png', 'tolex.jpg', 'alu.jpg', 'alu-dark.jpg', 'grille.jpg', 'screw.png', 'jewel.png', 'bg-ice.jpg', 'panel-ice.jpg', 'icicles.png', 'rivet-ice.png', 'emblem-ice.png', 'bg-matrix.jpg', 'bg-dj.jpg', 'panel-dj.jpg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'studio/index.html', 'studio/manifest.webmanifest'];

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
  if (url.pathname.includes('/drums/') || url.pathname.includes('/drones/') || url.pathname.includes('/inst/')) {   // /inst/: Studio-Instrumente (v104)
    e.respondWith(caches.open(DRUMS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  if (url.pathname.includes('/asr/')) {
    e.respondWith(caches.open(ASR).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  // App-Seite: sofort aus dem Speicher (auch ohne oder mit hängendem Internet), neue Fassung im Hintergrund holen –
  // sie gilt beim nächsten Öffnen. Nur beim allerersten Start (noch nichts gespeichert) wird auf das Netz gewartet.
  if (req.mode === 'navigate') {
    const page = url.pathname.includes('/studio/') ? 'studio/index.html' : 'index.html';   // Studio ist eine eigene Seite
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(page, copy)); } return r; });
    e.respondWith(caches.open(CACHE).then(c => c.match(page)).then(hit => {
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => caches.open(CACHE).then(c => c.match(page)));
    }));
    return;
  }
  // Alles andere (Icons, Schriften): Cache zuerst
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
