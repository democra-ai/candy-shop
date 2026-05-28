import { useSyncExternalStore } from 'react';

/**
 * useIsDark — live subscription to the `dark` class on <html>.
 *
 * The `dark` class is set synchronously by the FOUC-prevention script in
 * index.html before first paint, and toggled at runtime by the theme switcher
 * (Sidebar / Header / SettingsPage). This hook reads that class and re-renders
 * any subscriber the moment it flips, via a MutationObserver on the root
 * element's `class` attribute.
 *
 * Used by category-colored surfaces (CandyCard, MostPopularRail, Categories,
 * ShopWindow) to pick the dark-mode card palette so cards become deep-toned
 * with light ink instead of light pastels floating on the dark aubergine bg.
 */
function subscribe(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getSnapshot(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
