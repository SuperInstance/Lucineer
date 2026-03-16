const CACHE_VERSION = 'lucineer-v1';

const PRECACHE_ASSETS = [
  '/',
  '/voxel-explorer',
  '/lln-playground',
  '/mist',
  '/offline.html',
  '/manifest.json',
  '/logo.svg',
];

// ── Install: precache shell ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_ASSETS))
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

  // API routes: network first, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        Response.json({ error: 'offline', status: 503 }, { status: 503 })
      )
    );
    return;
  }

  // Static assets (_next/static): cache first (immutable hashed files)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  // Game pages: stale-while-revalidate
  const gamePaths = ['/', '/voxel-explorer', '/lln-playground', '/mist', '/agent-cells', '/cell-builder'];
  if (gamePaths.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) {
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

  // Everything else: network with offline fallback
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
  try {
    const db = await openDB();
    const tx = db.transaction('pending-actions', 'readonly');
    const store = tx.objectStore('pending-actions');
    const pending = await store.getAll();
    for (const action of pending) {
      try {
        await fetch('/api/user-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action),
        });
        const delTx = db.transaction('pending-actions', 'readwrite');
        delTx.objectStore('pending-actions').delete(action.id);
      } catch {
        break;
      }
    }
  } catch {
    // IndexedDB unavailable, skip sync
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('lucineer-progress', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('pending-actions', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Push Notifications ────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Lucineer', {
      body: data.body ?? 'Continue your chip adventure!',
      icon: '/logo.svg',
      badge: '/logo.svg',
      data: { url: data.url ?? '/voxel-explorer' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
