const CACHE_NAME = 'shopverse-shell-v1';

const SHELL_ASSETS = [
  '/',
  'index.html',
  'styles.css',
  'theme.js',
  'data.js',
  'cart.js',
  'auth.js',
  'auth.html',
  'client.html',
  'admin.html',
  'admin.js',
];

function getPrecacheUrls() {
  const base = self.registration.scope;
  return SHELL_ASSETS.map((asset) => new URL(asset, base).href);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(getPrecacheUrls()))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function isStaticAssetRequest(request) {
  const { pathname } = new URL(request.url);
  return /\.(html|css|js)$/.test(pathname) || pathname.endsWith('/');
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  if (request.mode === 'navigate') {
    const fallback = await cache.match(new URL('index.html', self.registration.scope).href);
    if (fallback) return fallback;
  }

  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!isSameOrigin(request)) return;
  if (!isStaticAssetRequest(request)) return;

  event.respondWith(staleWhileRevalidate(request));
});
