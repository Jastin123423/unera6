const SW_VERSION = 'unera-sw-v2';

const STATIC_CACHE = `static-${SW_VERSION}`;
const MEDIA_CACHE = `media-${SW_VERSION}`;
const API_CACHE = `api-${SW_VERSION}`;

const MAX_MEDIA_ITEMS = 200;
const MAX_API_ITEMS = 50;

const OFFLINE_URL = '/';

const MEDIA_HOSTS = [
  self.location.origin,
  'https://media.unera.social',
];

/* =========================
   INSTALL
========================= */

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
      ])
    )
  );
});

/* =========================
   ACTIVATE
========================= */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => {
          if (
            key !== STATIC_CACHE &&
            key !== MEDIA_CACHE &&
            key !== API_CACHE
          ) {
            return caches.delete(key);
          }
        })
      );

      await self.clients.claim();
    })()
  );
});

/* =========================
   HELPERS
========================= */

function isMediaRequest(request) {
  const url = new URL(request.url);

  const hostAllowed =
    url.origin === self.location.origin ||
    url.origin === 'https://media.unera.social';

  if (!hostAllowed) return false;

  const pathname = url.pathname.toLowerCase();

  return (
    pathname.endsWith('.mp4') ||
    pathname.endsWith('.webm') ||
    pathname.endsWith('.mov') ||
    pathname.endsWith('.mkv') ||

    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.avif') ||

    pathname.endsWith('.mp3') ||
    pathname.endsWith('.wav') ||
    pathname.endsWith('.ogg') ||
    pathname.endsWith('.m4a')
  );
}

function isApiRequest(request) {
  const url = new URL(request.url);

  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/')
  );
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);

  const keys = await cache.keys();

  if (keys.length <= maxItems) return;

  const deleteCount = keys.length - maxItems;

  for (let i = 0; i < deleteCount; i++) {
    await cache.delete(keys[i]);
  }
}

/* =========================
   MEDIA STRATEGIES
========================= */

async function cacheFirstMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);

  const cached = await cache.match(request, {
    ignoreVary: true,
    ignoreSearch: false,
  });

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response && response.ok) {
    cache.put(request, response.clone());
    trimCache(MEDIA_CACHE, MAX_MEDIA_ITEMS);
  }

  return response;
}

async function staleWhileRevalidateMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);

  const cached = await cache.match(request, {
    ignoreVary: true,
    ignoreSearch: false,
  });

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
        trimCache(MEDIA_CACHE, MAX_MEDIA_ITEMS);
      }

      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;

  if (networkResponse) {
    return networkResponse;
  }

  throw new Error('Media fetch failed');
}

/* =========================
   API STRATEGY
========================= */

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);

    if (
      response &&
      response.ok &&
      request.method === 'GET'
    ) {
      cache.put(request, response.clone());

      trimCache(API_CACHE, MAX_API_ITEMS);
    }

    return response;

  } catch (error) {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    throw error;
  }
}

/* =========================
   FETCH
========================= */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  /* =========================
     PAGE NAVIGATION
  ========================= */

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);

        return cache.match(OFFLINE_URL);
      })
    );

    return;
  }

  /* =========================
     MEDIA
  ========================= */

  if (isMediaRequest(request)) {
    const destination = request.destination;

    if (destination === 'video') {
      event.respondWith(
        cacheFirstMedia(request)
      );

      return;
    }

    if (destination === 'image') {
      event.respondWith(
        staleWhileRevalidateMedia(request)
      );

      return;
    }

    event.respondWith(
      staleWhileRevalidateMedia(request)
    );

    return;
  }

  /* =========================
     API
  ========================= */

  if (isApiRequest(request)) {
    event.respondWith(
      networkFirstApi(request)
    );

    return;
  }
});

/* =========================
   PUSH NOTIFICATIONS
========================= */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};

  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'UNERA',
      body: event.data.text(),
    };
  }

  const title = data.title || 'UNERA';

  const options = {
    body:
      data.body ||
      'You have a new notification',

    icon:
      'https://media.unera.social/unera_icon_192x192.png',

    badge:
      'https://media.unera.social/unera_icon_192x192.png',

    image: data.image || undefined,

    vibrate: [200, 100, 200],

    tag:
      data.tag ||
      'unera-notification',

    renotify: true,

    requireInteraction: false,

    data: {
      url: data.url || '/',
      ...data,
    },

    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'close',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

/* =========================
   NOTIFICATION CLICK
========================= */

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification.data?.url || '/';

    event.waitUntil(
      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        .then((clientList) => {

          for (const client of clientList) {
            if ('focus' in client) {
              client.navigate(targetUrl);

              return client.focus();
            }
          }

          if (clients.openWindow) {
            return clients.openWindow(
              targetUrl
            );
          }
        })
    );
  }
);

/* =========================
   MESSAGE CHANNEL
========================= */

self.addEventListener('message', (event) => {
  console.log(
    '[UNERA SW MESSAGE]',
    event.data
  );
});
