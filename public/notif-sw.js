/* ESKAHADE — service worker khusus notifikasi push.
 * Sengaja TANPA handler fetch/cache: aplikasi pernah bermasalah dengan bundle Server Action
 * basi dari service worker lama (/sw.js). File ini hanya menampilkan & membuka notifikasi.
 */
const ICON = '/icon-192x192.png'
const BADGE = '/icon-96x96.png'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

function sameOriginUrl(value, fallback) {
  try {
    const url = new URL(value || fallback, self.location.origin)
    return url.origin === self.location.origin ? url.href : new URL(fallback, self.location.origin).href
  } catch {
    return new URL(fallback, self.location.origin).href
  }
}

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
  const title = typeof data.title === 'string' && data.title ? data.title : 'ESKAHADE'
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: ICON,
    badge: BADGE,
    tag: typeof data.id === 'string' ? data.id : undefined,
    data: { url: sameOriginUrl(data.url, '/'), id: data.id || null },
  }
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options)
    // Segarkan badge bell di tab yang terbuka.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) client.postMessage({ type: 'eskahade-notification' })
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = sameOriginUrl(event.notification.data && event.notification.data.url, '/')
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus()
        if ('navigate' in client) {
          try { await client.navigate(target) } catch { /* tab lain domain/terkunci */ }
        }
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})

// Browser mengganti langganan (kunci kedaluwarsa). Server memindahkan owner yang sesinya aktif.
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : null
    const key = event.oldSubscription && event.oldSubscription.options ? event.oldSubscription.options.applicationServerKey : null
    if (!oldEndpoint || !key) return
    const subscription = event.newSubscription
      || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    await fetch('/api/notifications/devices', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldEndpoint, subscription: subscription.toJSON() }),
    })
  })())
})
