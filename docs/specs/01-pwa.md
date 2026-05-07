# Spec: Progressive Web App (PWA)

**Priority:** Now  
**Branch:** `feature/pwa`  
**Depends on:** nothing — self-contained  

---

## Goal

Make GoofyScoops installable on iOS and Android home screens, work reliably with intermittent connectivity (walks with patchy signal), and lay the groundwork for push notifications needed by the medication reminder feature.

---

## Scope

| In | Out |
|---|---|
| Web app manifest | Native app store submission |
| Service worker with offline support | Background sync (defer to medication reminders spec) |
| App icons from dog-avatar.png | New icon artwork |
| iOS meta tags | Siri / widgets |
| In-app install prompt banner | OS-level install prompt customization |
| Push notification permission scaffolding | Sending actual notifications (defer to medication reminders spec) |

---

## 1. Icons

Generate the following from `public/dog-avatar.png` using sharp (already available via Next.js) or a one-time script:

| File | Size | Purpose |
|---|---|---|
| `public/icons/icon-192.png` | 192×192 | Android home screen |
| `public/icons/icon-512.png` | 512×512 | Android splash screen |
| `public/icons/icon-maskable-192.png` | 192×192 | Android adaptive icon (safe zone crop) |
| `public/icons/icon-maskable-512.png` | 512×512 | Android adaptive icon large |
| `public/icons/apple-touch-icon.png` | 180×180 | iOS home screen |
| `public/favicon-32.png` | 32×32 | Browser tab |
| `public/favicon-16.png` | 16×16 | Browser tab small |

For maskable icons: the dog avatar should be centered within a `#F5D6C0` (peach) background with ~20% safe-zone padding on all sides so the OS circular/squircle crop doesn't clip the dog.

Generate with a script at `scripts/generate-icons.mjs`:

```js
import sharp from 'sharp'

const source = 'public/dog-avatar.png'
const bg = { r: 245, g: 214, b: 192, alpha: 1 } // #F5D6C0

const icons = [
  { file: 'public/icons/icon-192.png', size: 192, maskable: false },
  { file: 'public/icons/icon-512.png', size: 512, maskable: false },
  { file: 'public/icons/icon-maskable-192.png', size: 192, maskable: true },
  { file: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
  { file: 'public/icons/apple-touch-icon.png', size: 180, maskable: true },
  { file: 'public/favicon-32.png', size: 32, maskable: false },
  { file: 'public/favicon-16.png', size: 16, maskable: false },
]

for (const { file, size, maskable } of icons) {
  const padding = maskable ? Math.round(size * 0.2) : 0
  const inner = size - padding * 2
  await sharp(source)
    .resize(inner, inner)
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: bg })
    .toFile(file)
}
```

Run once: `node scripts/generate-icons.mjs`

---

## 2. Web app manifest

Create `public/manifest.json`:

```json
{
  "name": "GoofyScoops",
  "short_name": "GoofyScoops",
  "description": "Dog care tracker for the whole household",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F5D6C0",
  "theme_color": "#00A896",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [],
  "categories": ["health", "lifestyle"],
  "lang": "en"
}
```

---

## 3. Next.js metadata

Update `src/app/layout.tsx` to add manifest, iOS meta tags, and theme color via the Next.js `metadata` export and `Viewport` export:

```ts
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'GoofyScoops',
  description: 'Dog care tracker for the whole household',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GoofyScoops',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#00A896',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}
```

---

## 4. Service worker

Use a manual service worker — do not use `next-pwa`, which has known compatibility issues with Next.js App Router and Tailwind v4.

### 4a. Register the service worker

Create `public/sw.js` (the service worker itself — see 4b).

Register it from a client component. Create `src/components/ServiceWorkerRegistrar.tsx`:

```tsx
'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])
  return null
}
```

Add `<ServiceWorkerRegistrar />` to the root layout inside the `<body>`.

### 4b. Service worker (`public/sw.js`)

Use a cache-first strategy for the app shell, network-first for API/Supabase calls:

```js
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
```

### 4c. Offline fallback page

Create `src/app/offline/page.tsx` — a simple full-screen message using existing design tokens:

```tsx
import DogAvatar from '@/components/DogAvatar'

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-4 text-center">
      <DogAvatar size={80} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">You're offline</h1>
        <p className="text-sm text-foreground/60">
          GoofyScoops needs a connection to sync.<br />
          Come back when you've got signal.
        </p>
      </div>
    </div>
  )
}
```

---

## 5. Install prompt banner

Show a dismissable "Add to Home Screen" banner on the dashboard for users who haven't installed the app yet. Don't show it on iOS Safari (the prompt API isn't supported — iOS users install via the Share menu, which we handle with the apple meta tags above).

Create `src/components/InstallPrompt.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  return (
    <div className="bg-white rounded-2xl px-4 py-3 border border-[#E8DCC8] flex items-center gap-3">
      <p className="text-xs font-medium text-foreground flex-1">
        Add GoofyScoops to your home screen
      </p>
      <button
        onClick={async () => {
          await prompt.prompt()
          const { outcome } = await prompt.userChoice
          if (outcome === 'accepted' || outcome === 'dismissed') setDismissed(true)
        }}
        className="bg-goofy-teal text-white text-xs font-bold px-4 py-2 rounded-full shrink-0 active:scale-[0.98] transition-all"
      >
        Install
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-sm text-foreground/60 hover:text-foreground/80 transition-colors leading-none shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
```

Add `<InstallPrompt />` near the top of the dashboard page (`src/app/page.tsx`), inside the main container, below the greeting row.

---

## 6. Push notification permission

Scaffold the permission request for later use by the medication reminders feature. Do not trigger this automatically — it should only be requested from the Settings page when the user enables a reminder.

Create `src/lib/notifications.ts`:

```ts
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}
```

Do not wire this up to any UI yet — the medication reminders spec will define the Settings UI that calls it.

---

## 7. Files changed / created

```
public/
  manifest.json                         ← new
  sw.js                                 ← new
  icons/
    icon-192.png                        ← generated
    icon-512.png                        ← generated
    icon-maskable-192.png               ← generated
    icon-maskable-512.png               ← generated
    apple-touch-icon.png                ← generated
  favicon-32.png                        ← generated
  favicon-16.png                        ← generated
scripts/
  generate-icons.mjs                    ← new (run once, do not commit output to git if already present)
src/
  app/
    layout.tsx                          ← add metadata, viewport exports, ServiceWorkerRegistrar
    offline/
      page.tsx                          ← new
  components/
    ServiceWorkerRegistrar.tsx          ← new
    InstallPrompt.tsx                   ← new
  lib/
    notifications.ts                    ← new
```

---

## 8. Testing checklist

- [ ] Lighthouse PWA audit scores 100 (run in Chrome DevTools > Lighthouse)
- [ ] App installs successfully on Android Chrome via the install banner
- [ ] App installs on iOS Safari via Share > Add to Home Screen
- [ ] Installed app opens in standalone mode (no browser chrome)
- [ ] App shell loads on offline (airplane mode after first visit)
- [ ] Offline page shown when navigating to uncached route with no connection
- [ ] Supabase requests are not cached (network-first confirmed)
- [ ] Install banner does not appear if app is already installed
- [ ] `src/lib/notifications.ts` exports are available for import (no runtime errors)

---

## Notes for Cursor

- Do not use `next-pwa` — it has known issues with App Router and Tailwind v4. Use the manual service worker approach described here.
- The service worker lives in `public/sw.js`, not in `src/` — Next.js does not process files in public through its compiler.
- Run `node scripts/generate-icons.mjs` before testing. The `sharp` package is already a Next.js dependency and does not need to be installed separately.
- All new UI (install banner, offline page) must use existing design tokens from `src/app/globals.css`. Do not introduce new colors or hardcoded hex values outside of what is already documented in `docs/design-system/README.md`.
