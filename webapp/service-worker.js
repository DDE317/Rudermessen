// Service Worker - Cache First Strategie
const CACHE_NAME = 'rudermesser-v6';
const VERSION = '5';

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

// Aktivierung - alten Cache sofort löschen und übernehmen
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => {
                    console.log('Lösche alten Cache:', k);
                    return caches.delete(k);
                })
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch - IMMER zuerst aus Cache
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).catch(() => caches.match('./index.html'));
        })
    );
});
