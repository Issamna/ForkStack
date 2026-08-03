// Minimal, network-only service worker.
//
// It exists for one reason: Chrome will not offer a real install (a WebAPK with
// its own launcher icon, no address bar) unless the page registers a service
// worker with a fetch handler. Without it you only get a bookmark shortcut that
// opens in a browser tab.
//
// It deliberately caches nothing. Offline support would mean cache
// invalidation, and a stale bundle talking to a live API is a worse failure
// than simply not working without a signal. Every request goes to the network,
// exactly as it would with no worker at all.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop anything a previous version of this file may have cached, so
      // enabling caching later can never resurrect a stale bundle.
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Pass through untouched. respondWith is required for Chrome to count this
  // as a real fetch handler.
  event.respondWith(fetch(event.request));
});
