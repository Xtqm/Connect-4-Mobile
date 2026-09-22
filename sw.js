const CACHE_PREFIX = 'mini-connect4';
const SW_VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `${CACHE_PREFIX}-${SW_VERSION}`;

const APP_SHELL = [
  './',
  './index.html'
];

const STARTUP_DEPENDENCIES = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);

await Promise.all(STARTUP_DEPENDENCIES.map(async (url) => {
  const request = new Request(url, { mode: 'no-cors', cache: 'reload' });
  const response = await fetch(request);
  await cache.put(url, response.clone());
}));
  })().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(`${CACHE_PREFIX}-`) && cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(event.request);
        await cache.put('./index.html', networkResponse.clone());
        return networkResponse;
      } catch {
        const cachedPage = await cache.match('./index.html');
        return cachedPage || Response.error();
      }
    })());
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isStartupDependency = STARTUP_DEPENDENCIES.includes(event.request.url);

  if (!isSameOrigin && !isStartupDependency) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(event.request);
    if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
      await cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  })());
});
