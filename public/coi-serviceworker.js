/*
 * Self-destructing service worker. See coi-fixed.js for context.
 * Previous version force-navigated all clients on activation,
 * which caused infinite reload loops. Now a clean self-unregister.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.unregister(),
      self.clients.claim(),
    ]).catch(() => {})
  );
});

// Intentionally no fetch handler — pass everything through to network.
