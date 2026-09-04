// Service Worker - Cache First Strategie
const CACHE_NAME = 'rudermesser-v3';

const FILES_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Installation - alle Dateien sofort cachen
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(FILES_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Aktivierung - alten Cache sofort löschen
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch - IMMER zuerst aus Cache, kein Netzwerk nötig
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) {
                return cached; // aus Cache laden
            }
            // Nur wenn nicht im Cache: Netzwerk versuchen
            return fetch(event.request).catch(() => {
                return caches.match('./index.html');
            });
        })
    );
});
