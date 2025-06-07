// public/sw.js
const CACHE_NAME = 'story-app-v1';
const URLS_TO_CACHE_ON_INSTALL = [
  '/', 
  '/index.html', 
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching App Shell on install');
      return cache.addAll(URLS_TO_CACHE_ON_INSTALL);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
    // Abaikan request non-GET dan dari chrome-extension
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Jika response valid, simpan ke cache
                    if (networkResponse && networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(error => {
                    // Jika network gagal, console log error
                    console.error('[SW] Network fetch failed:', error);
                    // Jika ada di cache, cachedResponse akan digunakan
                });

                // Return data dari cache jika ada, sambil tetap fetch ke network (stale-while-revalidate)
                return cachedResponse || fetchPromise;
            });
        })
    );
});

// Di dalam public/sw.js
self.addEventListener('push', (event) => {
  const title = 'Notifikasi Baru dari Story App';
  const options = {
    body: event.data.text() || 'Ada cerita baru yang menarik untukmu!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});