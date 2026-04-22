const CACHE_NAME = 'fisica-en-10-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/game.html',
    '/leaderboard.html',
    '/style.css',
    '/main.js',
    '/game.js',
    '/register.js',
    '/leaderboard.js',
    '/manifest.json',
    '/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
