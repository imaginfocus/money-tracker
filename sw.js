/* Money Tracker offline support.
   Keeps a copy of the app on the phone so it opens without signal.
   After you upload a changed file, open the app twice to see the update. */
const APP = 'money-tracker-app-v1';
const FONTS = 'money-tracker-fonts-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // The app's own files: show the saved copy straight away, refresh it in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(APP).then(async (cache) => {
        const saved = (await cache.match(request, { ignoreSearch: true })) ||
          (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
        const fresh = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);
        return saved || (await fresh) || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // The fonts: keep them once they have loaded, so the app looks the same offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then(async (cache) => {
        const saved = await cache.match(request);
        const fresh = fetch(request)
          .then((response) => {
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => saved);
        return saved || fresh;
      })
    );
  }
});
