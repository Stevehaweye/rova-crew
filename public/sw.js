// ROVA Crew — Service Worker for Web Push Notifications

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
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-192.png',
      data: { url },
      tag: url, // collapse duplicate notifications for the same URL
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/home'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one matches
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('notificationclose', () => {
  // No-op — notification dismissed
})
