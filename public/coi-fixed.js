/*
 * Self-destructing service worker.
 *
 * This file used to install a COI (Cross-Origin Isolation) service worker
 * to enable SharedArrayBuffer for @webcontainer/api. We no longer use
 * WebContainers, and the old SW was causing reload loops (flash-of-unstyled-
 * content) by calling window.location.reload() on activation.
 *
 * Returning visitors still have the old SW registered in their browsers.
 * The browser auto-updates SWs whenever the script's bytes change, so
 * shipping this self-unregistering version replaces v1 cleanly:
 *
 *   install  -> skipWaiting (take over immediately)
 *   activate -> unregister + claim (no reload, no navigate)
 *   fetch    -> pass-through (don't intercept anything)
 *
 * Safe to delete this file entirely once all returning visitors have loaded
 * the site at least once.
 */

if (typeof window === 'undefined' && typeof self !== 'undefined') {
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

  // Do NOT handle fetch — let the network do its thing.
}
