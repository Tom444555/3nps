// Offline-Cache für die 3nps-App. Bei Updates CACHE-Version hochzählen.
const CACHE = '3nps-v147';
const ASR = 'asr-1';
const DRUMS = 'drums-1';   // echtes Kit (v98): eigener Speicher, überlebt Updates (Version erhöhen, wenn sich kit.flac ändert)   // Name ohne „3nps-“: wird beim Update nicht gelöscht (Version erhöhen, wenn sich das Modell ändert)
// v145: Schriften und Englisch-Wörterbuch als eigene Dateien (klein, offline immer da); Optik-Bilder nicht mehr hier, siehe OPTIK.
// './' fehlt bewusst: Seitenaufrufe holen immer den Eintrag 'index.html' (spart ≈ 2 MB je Update).
const CORE = ['index.html', 'stretch/worker.js', 'stretch/SignalsmithStretch.js', 'fonts/uncial.woff', 'fonts/metalmania.woff', 'fonts/blackopsone.woff', 'fonts/russoone.woff', 'fonts/michroma.woff', 'fonts/cinzel700.woff', 'i18n-en.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'studio/index.html', 'studio/manifest.webmanifest'];
// v145: Optik-Bilder (≈ 2,9 MB) in eigenem Speicher, der App-Updates überlebt. Die Seite legt die Bilder der gewählten Optik nach dem Start
// hinein (AppCfg › warmOptik), die übrigen kommen beim Umschalten dazu. Beim ersten Update werden die Bilder aus dem alten App-Speicher
// übernommen (ohne Netz), damit offline nichts fehlt. Ändert sich ein Bild: Namen erhöhen (optik-2).
const OPTIK = 'optik-1';
const OPTIK_IMG = ['bg-metal.jpg', 'panel.jpg', 'panel-dark.jpg', 'runes.png', 'emblem.png', 'corner-tl.png', 'corner-tr.png', 'corner-bl.png', 'corner-br.png', 'bg-iron.jpg', 'panel-iron.jpg', 'stud-iron.png', 'studs-iron.png', 'emblem-iron.png', 'tolex.jpg', 'alu.jpg', 'alu-dark.jpg', 'grille.jpg', 'screw.png', 'jewel.png', 'bg-ice.jpg', 'panel-ice.jpg', 'icicles.png', 'rivet-ice.png', 'emblem-ice.png', 'bg-matrix.jpg', 'bg-dj.jpg', 'panel-dj.jpg'];
// v146 Rig: nichts davon in der Erst-Installation. three.js + Strat-Modell (≈ 2,6 MB) beim ersten Öffnen in eigenem Speicher, der
// Updates überlebt (Namen erhöhen, wenn sich dort etwas ändert). Rig-Code (rig.js/rig.css/rig3d.js) liegt im App-Speicher; wer Rig schon
// benutzt hat, bekommt die neue Fassung beim Update gleich mit (sonst ginge Rig nach einem Update erst wieder mit Internet).
const RIG = 'rig-1';
const RIG_CODE = ['rig/rig.js', 'rig/rig.css', 'rig/rig3d.js'];
const isRigLib = url => url.origin === self.location.origin && (url.pathname.includes('/rig/three/') || url.pathname.endsWith('/rig/strat.glb'));
function keepRig(c) {
  return caches.keys().then(keys => keys.filter(k => k.startsWith('3nps-') && k !== CACHE).reduce((p, k) => p.then(r => r || caches.open(k).then(o => o.match(new URL('rig/rig.js', self.registration.scope).href))), Promise.resolve(null)))
    .then(used => used ? c.addAll(RIG_CODE.map(u => new Request(u, { cache: 'reload' }))) : null).catch(() => {});
}
function isOptik(url) { const f = url.pathname.slice(url.pathname.lastIndexOf('/') + 1); return url.origin === self.location.origin && OPTIK_IMG.includes(f) && !url.pathname.includes('/studio/'); }
// Bilder aus früheren App-Speichern (bis v144 lagen alle Optik-Bilder dort) in OPTIK übernehmen – kein Netz nötig
function keepOptik() {
  return caches.open(OPTIK).then(o => caches.keys().then(keys => Promise.all(OPTIK_IMG.map(f => {
    const u = new URL(f, self.registration.scope).href;
    return o.match(u).then(hit => hit || keys.filter(k => k.startsWith('3nps-')).reduce((p, k) => p.then(r => r || caches.open(k).then(c => c.match(u))), Promise.resolve(null))
      .then(r => r ? o.put(u, r) : null));
  })))).catch(() => {});
}

self.addEventListener('install', e => {
  // v145: am Browser-Zwischenspeicher vorbei laden – sonst kann beim Update noch die alte index.html in den neuen Speicher geraten
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))).then(() => keepRig(c))).then(keepOptik).then(() => self.skipWaiting()));
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
  if (isOptik(url)) {   // v145: Optik-Bilder – Speicher zuerst, sonst laden und merken
    e.respondWith(caches.open(OPTIK).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  if (isRigLib(url)) {   // v146: three.js + Strat-Modell – Speicher zuerst, sonst laden und merken
    e.respondWith(caches.open(RIG).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
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
