/**
 * AGRIMETS — Service Worker  v2
 * Strategy : Network-first for all app files.
 * FIX      : Added install-time cache so offline fallback actually works.
 *            PWABuilder requires a real offline fallback to generate APK.
 */

const CACHE_NAME = 'agrimets-shell-v1';

// Core files cached at install — minimum needed for offline fallback
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './swipe.js',
  './telegram.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: cache shell files immediately ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_FILES);
    })
  );
  // Activate immediately without waiting
  self.skipWaiting();
});

// ── ACTIVATE: take control + delete ALL old caches ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      // Take control of all open tabs immediately
      clients.claim(),
      // Delete old caches (keep only current CACHE_NAME)
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
    ])
  );
});

// ── FETCH: network-first, cache fallback if offline ──
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Only intercept same-origin requests (our app files)
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request, {
      cache: 'no-store',          // Force fresh from network
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma'       : 'no-cache',
      }
    })
    .then((networkResponse) => {
      // Update cache with fresh response in background
      const clone = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return networkResponse;
    })
    .catch(() => {
      // Network failed (offline) → serve from cache
      return caches.match(e.request).then(cached => {
        if (cached) return cached;
        // Last resort: return cached index.html for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
