# Schema 02 — PWA + Full-Screen Game Experience
## Lucineer · Progressive Web App

---

## Overview

Transform Lucineer into an installable, full-screen game that feels native on any device.

| Feature | What It Enables |
|---------|----------------|
| **Web App Manifest** | "Add to Home Screen" / "Install App" prompts |
| **Service Worker** | Offline gameplay, instant load, asset caching |
| **Full-Screen API** | True full-screen mode on desktop and mobile |
| **Install Prompt UI** | Custom in-game install button (not just browser banner) |
| **Splash Screen** | Branded loading screen on launch |
| **App Shortcuts** | Jump directly to Voxel Explorer or LLN Playground |

---

## 1. File Structure

```
public/
├── manifest.json                    ← Web App Manifest
├── sw.js                            ← Service Worker (generated)
├── offline.html                     ← Offline fallback page
├── icons/
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   ├── icon-512x512.png
│   ├── maskable-512x512.png         ← Safe-zone icon for Android
│   └── apple-touch-icon.png        ← iOS Safari
└── screenshots/
    ├── desktop-voxel.png            ← 1280x720 desktop screenshot
    ├── desktop-lln.png
    ├── mobile-voxel.png             ← 390x844 mobile screenshot
    └── mobile-lln.png

src/
├── app/
│   ├── layout.tsx                   ← Add <link> tags + meta
│   └── voxel-explorer/
│       └── page.tsx                 ← Add fullscreen button
├── components/
│   ├── pwa/
│   │   ├── InstallPrompt.tsx        ← Custom install CTA
│   │   ├── FullscreenButton.tsx     ← Fullscreen toggle
│   │   ├── OfflineBanner.tsx        ← "You're offline" notice
│   │   └── UpdatePrompt.tsx        ← "New version available"
│   └── ui/
│       └── (existing shadcn)
├── hooks/
│   ├── useInstallPrompt.ts          ← Wraps beforeinstallprompt
│   ├── useFullscreen.ts             ← Wraps Fullscreen API
│   ├── useOnlineStatus.ts           ← navigator.onLine
│   └── useServiceWorker.ts          ← SW registration + updates
└── lib/
    └── sw-registration.ts           ← SW registration logic
```

---

## 2. Web App Manifest (`public/manifest.json`)

```json
{
  "name": "Lucineer — Chip Explorer",
  "short_name": "Lucineer",
  "description": "Learn how computers work by building them. An educational voxel game for all ages.",
  "start_url": "/voxel-explorer?source=pwa",
  "scope": "/",
  "display": "fullscreen",
  "display_override": ["fullscreen", "standalone", "minimal-ui", "browser"],
  "orientation": "any",
  "background_color": "#0a0a0f",
  "theme_color": "#22c55e",
  "lang": "en",
  "dir": "ltr",
  "categories": ["education", "games"],
  "iarc_rating_id": "e84b072d-71b3-4d3e-86ae-31a8ce4e53b7",

  "icons": [
    { "src": "/icons/icon-72x72.png",    "sizes": "72x72",    "type": "image/png" },
    { "src": "/icons/icon-96x96.png",    "sizes": "96x96",    "type": "image/png" },
    { "src": "/icons/icon-128x128.png",  "sizes": "128x128",  "type": "image/png" },
    { "src": "/icons/icon-144x144.png",  "sizes": "144x144",  "type": "image/png" },
    { "src": "/icons/icon-152x152.png",  "sizes": "152x152",  "type": "image/png" },
    { "src": "/icons/icon-192x192.png",  "sizes": "192x192",  "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-384x384.png",  "sizes": "384x384",  "type": "image/png" },
    { "src": "/icons/icon-512x512.png",  "sizes": "512x512",  "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ],

  "screenshots": [
    {
      "src": "/screenshots/desktop-voxel.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Voxel Chip Explorer — Build chips block by block"
    },
    {
      "src": "/screenshots/desktop-lln.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "LLN Playground — AI-powered learning debates"
    },
    {
      "src": "/screenshots/mobile-voxel.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Voxel Explorer on mobile"
    }
  ],

  "shortcuts": [
    {
      "name": "Voxel Explorer",
      "short_name": "Voxel",
      "description": "Build chips from blocks",
      "url": "/voxel-explorer",
      "icons": [{ "src": "/icons/icon-96x96.png", "sizes": "96x96" }]
    },
    {
      "name": "LLN Playground",
      "short_name": "LLN",
      "description": "AI debate and synthesis",
      "url": "/lln-playground",
      "icons": [{ "src": "/icons/icon-96x96.png", "sizes": "96x96" }]
    },
    {
      "name": "Chip Lab",
      "short_name": "Lab",
      "description": "Design your own chip",
      "url": "/ternaryair/voxel-lab",
      "icons": [{ "src": "/icons/icon-96x96.png", "sizes": "96x96" }]
    }
  ],

  "related_applications": [],
  "prefer_related_applications": false,

  "protocol_handlers": [
    {
      "protocol": "web+lucineer",
      "url": "/share?data=%s"
    }
  ],

  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [{ "name": "media", "accept": ["image/*"] }]
    }
  }
}
```

---

## 3. `src/app/layout.tsx` — Head Tags

```tsx
// Add inside <head> in layout.tsx

<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#22c55e" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Lucineer" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="application-name" content="Lucineer" />
<meta name="msapplication-TileColor" content="#0a0a0f" />
<meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />

{/* Viewport: allow zoom on accessibility, but start locked for game feel */}
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

---

## 4. Service Worker (`public/sw.js`)

```javascript
const CACHE_VERSION = 'lucineer-v1';

// Assets that must be cached immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/voxel-explorer',
  '/lln-playground',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Next.js will add hashed JS/CSS chunks via workbox (see below)
];

// ── Install: precache shell ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache strategies by route ─────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API routes: Network first, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        Response.json({ error: 'offline', status: 503 }, { status: 503 })
      )
    );
    return;
  }

  // Static assets (_next/static): Cache first (immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Game pages: Stale-while-revalidate
  if (
    url.pathname === '/' ||
    url.pathname.startsWith('/voxel-explorer') ||
    url.pathname.startsWith('/lln-playground') ||
    url.pathname.startsWith('/ternaryair')
  ) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Everything else: Network with offline fallback
  event.respondWith(
    fetch(request).catch(() => caches.match('/offline.html'))
  );
});

// ── Background Sync: queue game progress ─────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-game-progress') {
    event.waitUntil(syncGameProgress());
  }
});

async function syncGameProgress() {
  // Read queued progress from IndexedDB and POST to /api/user-actions
  const db = await openProgressDB();
  const pending = await db.getAll('pending-actions');
  for (const action of pending) {
    try {
      await fetch('/api/user-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      await db.delete('pending-actions', action.id);
    } catch {
      break; // stop on network failure, retry next sync
    }
  }
}

// ── Push Notifications (future: lesson reminders) ─
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Lucineer', {
      body: data.body ?? 'Continue your chip adventure!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: data.url ?? '/voxel-explorer' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

---

## 5. Hook: `useFullscreen.ts`

```typescript
// src/hooks/useFullscreen.ts
import { useState, useCallback, useEffect } from 'react';

interface FullscreenState {
  isFullscreen: boolean;
  isSupported: boolean;
  enter: (element?: HTMLElement) => Promise<void>;
  exit: () => Promise<void>;
  toggle: (element?: HTMLElement) => Promise<void>;
}

export function useFullscreen(): FullscreenState {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isSupported =
    typeof document !== 'undefined' &&
    !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled
    );

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement
        )
      );
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const enter = useCallback(async (element?: HTMLElement) => {
    const el = element ?? document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
    else if ((el as any).mozRequestFullScreen) await (el as any).mozRequestFullScreen();
  }, []);

  const exit = useCallback(async () => {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
  }, []);

  const toggle = useCallback(async (element?: HTMLElement) => {
    if (isFullscreen) await exit();
    else await enter(element);
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, isSupported, enter, exit, toggle };
}
```

---

## 6. Hook: `useInstallPrompt.ts`

```typescript
// src/hooks/useInstallPrompt.ts
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptState {
  canInstall: boolean;
  isInstalled: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setIsInstalled(true);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome;
  };

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    install,
  };
}
```

---

## 7. Component: `FullscreenButton.tsx`

```tsx
// src/components/pwa/FullscreenButton.tsx
'use client';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useFullscreen } from '@/hooks/useFullscreen';
import { Button } from '@/components/ui/button';

export function FullscreenButton() {
  const { isFullscreen, isSupported, toggle } = useFullscreen();
  if (!isSupported) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => toggle()}
      title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      className="fixed top-4 right-4 z-50 bg-black/40 backdrop-blur-sm
                 hover:bg-black/60 text-white border border-white/10"
    >
      {isFullscreen ? (
        <Minimize2 className="w-4 h-4" />
      ) : (
        <Maximize2 className="w-4 h-4" />
      )}
    </Button>
  );
}
```

---

## 8. Component: `InstallPrompt.tsx`

```tsx
// src/components/pwa/InstallPrompt.tsx
'use client';
import { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { motion, AnimatePresence } from 'framer-motion';

export function InstallPrompt() {
  const { canInstall, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                   bg-dark-800 border border-green-500/30 rounded-2xl p-4
                   flex items-center gap-4 shadow-2xl max-w-sm w-full mx-4"
      >
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install Lucineer</p>
          <p className="text-xs text-gray-400">Play offline, faster loads</p>
        </div>
        <button
          onClick={async () => {
            const outcome = await install();
            if (outcome !== 'accepted') setDismissed(true);
          }}
          className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500
                     text-white text-xs font-medium transition-colors flex-shrink-0"
        >
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-gray-500 hover:text-gray-300 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## 9. `public/offline.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lucineer — Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0f;
      color: #e5e7eb;
      font-family: system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      text-align: center;
      padding: 2rem;
    }
    .icon { font-size: 4rem; }
    h1 { font-size: 1.5rem; color: #22c55e; }
    p { color: #9ca3af; max-width: 300px; }
    button {
      margin-top: 1rem;
      padding: 0.75rem 2rem;
      background: #16a34a;
      color: white;
      border: none;
      border-radius: 0.75rem;
      cursor: pointer;
      font-size: 1rem;
    }
    button:hover { background: #15803d; }
  </style>
</head>
<body>
  <div class="icon">🔌</div>
  <h1>You're Offline</h1>
  <p>Your internet connection is unavailable. Lucineer needs a connection to load new content.</p>
  <p style="margin-top:0.5rem; color:#6b7280; font-size:0.85rem">
    Previously visited pages may still be available.
  </p>
  <button onclick="window.location.reload()">Try Again</button>
  <script>
    window.addEventListener('online', () => window.location.reload());
  </script>
</body>
</html>
```

---

## 10. Service Worker Registration (`src/lib/sw-registration.ts`)

```typescript
// src/lib/sw-registration.ts
export async function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    // Check for updates on every page load
    registration.update();

    // Notify user when new version is available
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // Dispatch custom event — UpdatePrompt.tsx listens for this
          window.dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    });
  } catch (err) {
    console.warn('Service worker registration failed:', err);
  }
}
```

Call from `src/app/layout.tsx` client component:
```tsx
useEffect(() => { registerServiceWorker(); }, []);
```

---

## 11. Lighthouse PWA Score Targets

| Metric | Target |
|--------|--------|
| Performance | ≥ 90 |
| Accessibility | ≥ 90 |
| Best Practices | ≥ 95 |
| SEO | ≥ 90 |
| PWA (installable) | ✅ Pass |
| PWA (offline) | ✅ Pass |
| PWA (fast loading) | ✅ Pass |

---

## 12. Platform-Specific Notes

| Platform | Behavior |
|----------|----------|
| **Android Chrome** | Full install prompt, icon on home screen, fullscreen works |
| **iOS Safari** | No install prompt (must use "Add to Home Screen" manually); add iOS meta tags |
| **Desktop Chrome/Edge** | Install button in address bar; fullscreen via F11 or button |
| **Desktop Firefox** | Partial PWA support; fullscreen works |
| **Samsung Internet** | Full PWA support |
| **Electron (future)** | Can wrap with Electron for desktop app distribution |
