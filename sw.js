// Retirement worker: the tournament is over. Replaces the old offline worker on phones
// that visited, deletes its cached copy of the site, unregisters itself, and reloads
// open tabs so they show the thank-you page.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })());
});
