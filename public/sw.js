// Service Worker — Sukahideng App PWA
// Strategy: Network First untuk navigasi & JS chunks, Cache First untuk gambar/font

const CACHE_NAME = 'sukahideng-v2'
const STATIC_ASSETS = [
  '/logo.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
]

// Install: cache aset statis
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: hapus cache lama (termasuk sukahideng-v1)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET dan cross-origin
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // Gambar & font → Cache First (jarang berubah, hemat bandwidth)
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // /_next/static/ → Network First (KRITIS: hindari chunk lama setelah deploy)
  // Setiap deploy Next.js menghasilkan hash baru — harus ambil dari network dulu
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request)) // fallback ke cache kalau offline
    )
    return
  }

  // Navigasi & API → Network First, fallback ke cache kalau offline
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache halaman HTML
        if (request.destination === 'document' && response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
