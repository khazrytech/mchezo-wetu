'use strict';

const CACHE_NAME = 'mchezo-wetu-shell-v2';

// Static, non-personalised assets that are safe to keep offline.
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/app-pwa.js',
  '/mchezo-wetu-logo.svg',
  '/pwa-icon.svg',
  '/pwa-icon-maskable.svg',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png'
];

// Entry pages that can be cached as an offline fallback shell.
const PUBLIC_PAGES = ['/', '/login', '/signup'];

// Account pages must never be stored: they contain private member/admin data.
const PRIVATE_PATHS = ['/dashboard', '/admin', '/admin/dashboard'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Cache each asset independently so a single 404 can never break install.
      Promise.allSettled(
        STATIC_ASSETS.concat(PUBLIC_PAGES).map(asset => cache.add(asset))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('mchezo-wetu-shell-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isPrivatePath(pathname) {
  return PRIVATE_PATHS.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhook/')) {
    return;
  }

  const privatePath = isPrivatePath(url.pathname);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Only cache anonymous entry pages; never persist account pages.
          if (response.ok && !privatePath) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          if (privatePath) {
            return (await caches.match('/offline.html')) || Response.error();
          }
          return (await caches.match(request)) ||
            (await caches.match('/offline.html')) ||
            Response.error();
        })
    );
    return;
  }

  if (privatePath) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
