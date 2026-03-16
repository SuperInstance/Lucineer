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

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Notify any listeners that a new version is ready
          window.dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    });
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
  }
}
