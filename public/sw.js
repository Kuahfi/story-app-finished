// public/sw.js (Versi Debugging)
const CACHE_NAME = 'story-app-v3'; // Naikkan versi cache untuk memicu update
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
          if (cacheName !== CACHE_NAME && cacheName.startsWith('story-app')) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return;
    }
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error('[SW] Network fetch failed:', error);
                });
                return cachedResponse || fetchPromise;
            });
        })
    );
});

self.addEventListener('push', (event) => {
  console.log('[SW-DEBUG] ==> PUSH EVENT HANDLER STARTED.');

  let notificationData = {
    title: 'Notifikasi Baru (Default)',
    options: {
      body: 'Ini adalah notifikasi tes manual.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png'
    }
  };

  try {
    if (event.data) {
        console.log('[SW-DEBUG] Event has data. Trying to parse JSON.');
        const payload = event.data.json();
        notificationData.title = payload.title;
        notificationData.options = payload.options;
        notificationData.options.icon = notificationData.options.icon || '/icons/icon-192x192.png';
        notificationData.options.badge = notificationData.options.badge || '/icons/icon-192x192.png';
        console.log('[SW-DEBUG] JSON parsed successfully.');
    } else {
        console.log('[SW-DEBUG] Event has no data. Using default notification.');
    }
  } catch (e) {
    console.error('[SW-DEBUG] Error parsing JSON, using default notification.', e);
  }

  const title = notificationData.title;
  const options = notificationData.options;

  console.log('[SW-DEBUG] Preparing to show notification with title:', title);

  // Ini bagian paling penting. Kita akan lihat apakah promise ini rejected.
  const notificationPromise = self.registration.showNotification(title, options);
  
  event.waitUntil(
    notificationPromise
      .then(() => {
        console.log('[SW-DEBUG] ==> showNotification() promise was resolved. Notification should have been shown.');
      })
      .catch((err) => {
        console.error('[SW-DEBUG] ==> showNotification() promise was REJECTED. THIS IS THE ERROR:', err);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received.');
  event.notification.close();
  event.waitUntil(
    clients.openWindow(self.location.origin)
  );
});