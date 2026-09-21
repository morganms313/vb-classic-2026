// Offline shell: the page opens with no signal and shows the last-seen scores
// (Firestore keeps those in IndexedDB). Site files are network-first with a short
// timeout so updates land quickly; the versioned Firebase SDK is cache-first.
const CACHE = 'vfsc26-v2';
const SDK = 'https://www.gstatic.com/firebasejs/12.3.0';
const SHELL = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/logic.js', 'js/store.js', 'js/firebase-config.js',
  'data/tournament.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png',
];
const SDK_FILES = ['firebase-app.js', 'firebase-firestore.js', 'firebase-auth.js'].map((f) => `${SDK}/${f}`);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    await Promise.allSettled(SDK_FILES.map((u) => c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.href.startsWith(SDK)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetchAndCache(req)));
  } else if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
  }
  // Everything else (Firestore, Google sign-in) goes straight to the network.
});

async function fetchAndCache(req) {
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cached = caches.match(req, { ignoreSearch: true });
  try {
    const res = await Promise.race([
      fetchAndCache(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500)),
    ]);
    return res;
  } catch {
    return (await cached) || (req.mode === 'navigate' ? caches.match('index.html') : Response.error());
  }
}
