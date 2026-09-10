const CACHE_NAME = 'employee-checkin-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-96.png',
  './favicon.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching Files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // Claim control of all pages
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  console.log('Service Worker: Fetch', event.request.url);
  
  // Handle API requests differently
  if (event.request.url.includes('webhook') || event.request.url.includes('api')) {
    // For API requests, try network first, then show offline message
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If successful, return the response
          return response;
        })
        .catch(() => {
          // If network fails, return a custom offline response
          return new Response(
            JSON.stringify({
              status: 'offline',
              message: 'You are offline. Data will be synced when connection is restored.'
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
        })
    );
  } else {
    // For other requests (HTML, CSS, JS), use cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Return cached version or fetch from network
          return response || fetch(event.request);
        })
        .catch(() => {
          // If both cache and network fail, return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./');
          }
        })
    );
  }
});

// Background Sync - sync offline data when connection is restored
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background Sync', event.tag);
  
  if (event.tag === 'background-sync-checkins') {
    event.waitUntil(syncOfflineCheckins());
  }
});

// Sync offline check-ins
async function syncOfflineCheckins() {
  try {
    // Get all clients (open tabs/windows of the app)
    const clients = await self.clients.matchAll();
    
    clients.forEach(client => {
      // Send message to client to trigger sync
      client.postMessage({
        type: 'SYNC_OFFLINE_DATA'
      });
    });
    
    console.log('Service Worker: Offline data sync initiated');
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
  }
}

// Push notifications (optional - for future enhancements)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push Received');
  
  const options = {
    body: event.data ? event.data.text() : 'Check-in reminder',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'checkin-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'checkin',
        title: 'Check In',
        icon: '/icon-checkin.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-dismiss.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Employee Check-in', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click', event.action);
  
  event.notification.close();
  
  if (event.action === 'checkin') {
    // Open the app with check-in pre-selected
    event.waitUntil(
      clients.openWindow('./?action=in')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

// Message handling from main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'REQUEST_SYNC') {
    // Register background sync
    self.registration.sync.register('background-sync-checkins')
      .then(() => {
        console.log('Service Worker: Background sync registered');
      })
      .catch((error) => {
        console.error('Service Worker: Background sync registration failed', error);
      });
  }
});
