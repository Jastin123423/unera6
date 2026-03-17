// public/sw.js - Complete Service Worker with Push Notifications (No Firebase)
const CACHE_NAME = 'unera-feed-v1';
const MEDIA_CACHE = 'unera-media-v1';
const API_CACHE = 'unera-api-v1';
const DYNAMIC_CACHE = 'unera-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/index.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(keys => {
        return Promise.all(
          keys.filter(key => 
            key !== CACHE_NAME && 
            key !== MEDIA_CACHE && 
            key !== API_CACHE &&
            key !== DYNAMIC_CACHE
          ).map(key => caches.delete(key))
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// ==================== PUSH NOTIFICATIONS ====================
// Using your own backend - NO FIREBASE

self.addEventListener('push', (event) => {
  console.log('📨 Push notification received:', event);
  
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('Failed to parse push data:', e);
    data = {
      title: 'UNERA Social',
      body: 'You have a new notification',
      icon: 'https://media.unera.social/e6fdc17a-b364-436d-8da8-3a96dc98c251.png',
      badge: 'https://media.unera.social/e6fdc17a-b364-436d-8da8-3a96dc98c251.png',
      vibrate: [200, 100, 200],
      data: {
        url: 'https://unera.social',
        timestamp: Date.now()
      }
    };
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || 'https://media.unera.social/e6fdc17a-b364-436d-8da8-3a96dc98c251.png',
    badge: data.badge || 'https://media.unera.social/e6fdc17a-b364-436d-8da8-3a96dc98c251.png',
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || { url: 'https://unera.social' },
    actions: data.actions || [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    tag: data.tag || 'notification',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    timestamp: data.timestamp || Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'UNERA Social',
      options
    )
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || 'https://unera.social';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed:', event);
  // You can track notification dismissals here
});

// ==================== PUSH SUBSCRIPTION MANAGEMENT ====================

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('🔄 Push subscription changed:', event);
  
  event.waitUntil(
    // Get new subscription
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    }).then((newSubscription) => {
      // Send new subscription to your server
      return fetch('https://unera.social/api/push/resubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('unera_token')}`
        },
        body: JSON.stringify({
          oldEndpoint: event.oldSubscription?.endpoint,
          newSubscription: newSubscription
        })
      });
    })
  );
});

// ==================== FETCH HANDLING ====================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle media.unera.social requests
  if (url.hostname === 'media.unera.social') {
    event.respondWith(handleMediaRequest(event.request));
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // Handle static assets
  if (url.pathname.match(/\.(js|css|woff2?|svg)$/)) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }
  
  // Handle navigation (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }
  
  // Default: network first, then cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for future offline use
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Media: Cache first, never network (for cached media)
async function handleMediaRequest(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    console.log('📸 Media from cache:', request.url);
    return cached;
  }
  
  try {
    console.log('📸 Media from network:', request.url);
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      event.waitUntil(cache.put(request, responseToCache));
    }
    return response;
  } catch (error) {
    console.log('❌ Media fetch failed:', request.url);
    return new Response('Media unavailable offline', { 
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// API: Network first, fallback to cache
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    console.log('🌐 API from network:', request.url);
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      // Cache API responses for 5 minutes
      event.waitUntil(cache.put(request, responseToCache));
    }
    return response;
  } catch (error) {
    console.log('📦 API from cache:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ 
      error: 'Offline',
      message: 'You are offline. Please check your connection.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Static assets: Cache first
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

// Navigation: Stale-while-revalidate with offline fallback
async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match('/offline.html');
  
  try {
    // Try network first
    console.log('🌐 Navigation from network:', request.url);
    const response = await fetch(request);
    
    // Cache the page for future offline use
    if (response.ok) {
      const responseClone = response.clone();
      event.waitUntil(cache.put(request, responseClone));
    }
    
    return response;
  } catch (error) {
    // Offline - show cached offline page
    console.log('📦 Navigation from cache (offline):', request.url);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ==================== BACKGROUND SYNC ====================

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncOfflinePosts());
  }
  
  if (event.tag === 'sync-reactions') {
    event.waitUntil(syncOfflineReactions());
  }
});

async function syncOfflinePosts() {
  try {
    const db = await openOfflineDB();
    const offlinePosts = await db.getAll('offline-posts');
    
    for (const post of offlinePosts) {
      await fetch('https://unera.social/api/posts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('unera_token')}`
        },
        body: JSON.stringify(post)
      });
      
      await db.delete('offline-posts', post.id);
    }
    
    console.log('✅ Offline posts synced');
  } catch (error) {
    console.error('❌ Failed to sync offline posts:', error);
  }
}

async function syncOfflineReactions() {
  try {
    const db = await openOfflineDB();
    const offlineReactions = await db.getAll('offline-reactions');
    
    for (const reaction of offlineReactions) {
      await fetch(`https://unera.social/api/posts/${reaction.postId}/react`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('unera_token')}`
        },
        body: JSON.stringify(reaction)
      });
      
      await db.delete('offline-reactions', reaction.id);
    }
    
    console.log('✅ Offline reactions synced');
  } catch (error) {
    console.error('❌ Failed to sync offline reactions:', error);
  }
}

// Simple IndexedDB wrapper for offline storage
async function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('unera-offline', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-posts')) {
        db.createObjectStore('offline-posts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline-reactions')) {
        db.createObjectStore('offline-reactions', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== PERIODIC BACKGROUND SYNC ====================

// Check for updates periodically (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('🔄 Periodic sync:', event.tag);
  
  if (event.tag === 'update-feed') {
    event.waitUntil(updateFeedInBackground());
  }
});

async function updateFeedInBackground() {
  try {
    const token = await getTokenFromClient();
    const response = await fetch('https://unera.social/api/feed?limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const feed = await response.json();
    
    // Cache new posts
    const cache = await caches.open(API_CACHE);
    await cache.put('/api/feed', new Response(JSON.stringify(feed)));
    
    // Show notification if there are new posts
    if (feed.length > 0) {
      self.registration.showNotification('UNERA Feed Updated', {
        body: `${feed.length} new posts available`,
        icon: 'https://media.unera.social/e6fdc17a-b364-436d-8da8-3a96dc98c251.png',
        badge: 'https://media.unera.social/e6fdc17a-b364-436d-8da8-3a96dc98c251.png',
        tag: 'feed-update'
      });
    }
  } catch (error) {
    console.error('Failed to update feed in background:', error);
  }
}

// Helper to get token from client
async function getTokenFromClient() {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    if (client.type === 'window') {
      // You can implement message passing to get token
      // For now, return empty - your API should handle unauthenticated requests gracefully
      return '';
    }
  }
  return '';
}
