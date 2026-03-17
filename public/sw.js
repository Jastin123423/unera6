// public/sw.js
const CACHE_NAME = 'unera-feed-v1';
const MEDIA_CACHE = 'unera-media-v1';
const API_CACHE = 'unera-api-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/offline.html',
        '/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== MEDIA_CACHE && key !== API_CACHE)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.hostname === 'media.unera.social') {
    event.respondWith(handleMediaRequest(event.request));
    return;
  }
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  if (url.pathname.match(/\.(js|css|woff2?|svg)$/)) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }
  
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }
});

async function handleMediaRequest(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      event.waitUntil(cache.put(request, responseToCache));
    }
    return response;
  } catch (error) {
    return new Response('Media unavailable offline', { status: 408 });
  }
}

async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      event.waitUntil(cache.put(request, responseToCache));
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  const response = await fetch(request);
  if (response.ok) {
    event.waitUntil(cache.put(request, response.clone()));
  }
  return response;
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match('/offline.html');
  
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}
