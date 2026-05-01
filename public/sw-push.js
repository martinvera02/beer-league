// ─── SERVICE WORKER PUSH HANDLER ─────────────────────────────────────────────
// Este archivo va en /public/sw-push.js

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Beer League 🍺', body: event.data.text() }
  }

  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: payload.actions || [],
    tag: payload.tag || 'beer-league',
    renotify: true,
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Beer League 🍺', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})