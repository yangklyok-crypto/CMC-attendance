const CACHE_NAME = 'cmc-attendance-v6';
const STATIC_ASSETS = [
    './manifest.json',
    './logo.png',
    './icon-192.png',
    './icon-512.png',
    './icon-96.png',
    './favicon.png'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - delete all old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames.map((name) => {
                        if (name !== CACHE_NAME) {
                            return caches.delete(name);
                        }
                    })
                )
            )
            .then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', (event) => {

    // IMPORTANT:
    // Never intercept POST requests such as attendance webhook submissions
    if (event.request.method !== 'GET') {
        return;
    }

    // Page navigation: always request newest version from network
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(
                    `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>CMC Attendance</title>
                    </head>
                    <body style="font-family:Arial;text-align:center;padding:40px;">
                        <h2>❌ No Internet Connection</h2>
                        <p>Attendance cannot be recorded while offline.</p>
                        <p>Please reconnect to the internet and reload this page.</p>
                    </body>
                    </html>
                    `,
                    {
                        status: 503,
                        headers: {
                            'Content-Type': 'text/html; charset=UTF-8'
                        }
                    }
                );
            })
        );

        return;
    }

    // Static files: network first, cache only as fallback
    event.respondWith(
        fetch(event.request)
            .then((response) => {

                if (
                    response.ok &&
                    new URL(event.request.url).origin === self.location.origin
                ) {
                    const copy = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, copy);
                        });
                }

                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Allow new service worker to activate immediately
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
