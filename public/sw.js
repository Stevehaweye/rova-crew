// ROVA Crew — Service Worker
// Handles: push notifications, app shell caching, offline fallback

const CACHE_VERSION = 'rova-v1'
const APP_SHELL = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ─── Install: pre-cache app shell ─────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// ─── Activate: clean up old caches ───────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ─── Fetch: network-first for pages/API, cache-first for static assets ───────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API routes and auth — always network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth')) return

  // Static assets (icons, fonts, images): cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff|woff2|css|js)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline'))
    )
    return
  }
})

// ─── Push Notifications (unchanged from Week 4) ──────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'ROVA Crew', body: event.data.text() }
  }

  const { title = 'ROVA Crew', body = '', url = '/home', icon, badge } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-192.png',
      data: { url },
      tag: url,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/home'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('notificationclose', () => {
  // No-op — notification dismissed
})
