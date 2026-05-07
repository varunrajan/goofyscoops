const CACHE = 'goofyscoops-v1'
const SHELL = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Always go network-first for Supabase and auth
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/auth')) {
    e.respondWith(fetch(request))
    return
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(request).then(cached => cached ?? fetch(request).then(res => {
      if (res.ok && request.method === 'GET') {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(request, clone))
      }
      return res
    })).catch(() => caches.match('/offline'))
  )
})

// Push notification listener (scaffolding for medication reminders)
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'GoofyScoops', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.url ? { url: data.url } : {},
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (e.notification.data?.url) {
    e.waitUntil(clients.openWindow(e.notification.data.url))
  }
})
