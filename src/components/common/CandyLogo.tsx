import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/**
 * CandyLogo — lazy + deferred boundary for the WebGL jelly word.
 *
 * The actual three.js scene lives in ./CandyJelly and is pulled in via
 * React.lazy(), so the whole three.js stack ships as a SEPARATE chunk and never
 * blocks first paint. On top of that lazy boundary we GATE the mount itself:
 * the heavy chunk is only requested once the logo is in (or near) the viewport
 * — or after the first user interaction — whichever comes first. Until then the
 * user sees the flat brand-pink "Candy" wordmark, which is also the Suspense
 * fallback while the chunk resolves and the canvas warms up. Net effect: first
 * paint and idle are cheap (no 967KB chunk, no WebGL context) and the glossy
 * upgrade streams in only when it can actually be seen.
 *
 * Drop-in replacement for `<span className="text-primary">Candy</span>`.
 */

const CandyJelly = lazy(() => import('./CandyJelly'));

interface CandyLogoProps {
  /** the word to render in jelly (default "Candy") */
  text?: string;
  /** canvas pixel box — a number (px) or any CSS length (e.g. "min(640px,100%)") */
  width?: number | string;
  height?: number | string;
  /** Text3D world size */
  size?: number;
  /** camera distance */
  zoom?: number;
  /** idle float/rotation */
  animate?: boolean;
  /** extra classes for the flat fallback <span> */
  fallbackClassName?: string;
  /**
   * A media query (e.g. "(max-width: 639px)") below which the WebGL word is
   * NOT mounted at all — only the crisp flat wordmark renders. Used so narrow
   * phones never get the croppable 3D canvas (legibility) and never pay the
   * WebGL cost. Omit to always allow WebGL once in view.
   */
  hideWebGLBelow?: string;
}

/** Live subscription to a media query, SSR-safe. */
function useMediaQuery(query: string | undefined): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!query || typeof window === 'undefined' || !window.matchMedia) {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => {
      if (!query || typeof window === 'undefined' || !window.matchMedia) return false;
      return window.matchMedia(query).matches;
    },
    () => false
  );
}

/** Flat brand-pink wordmark — first paint, Suspense fallback, and the
 *  permanent render on narrow viewports (where the 3D word would crop). */
function FlatWordmark({
  text,
  fallbackClassName,
}: {
  text: string;
  fallbackClassName: string;
}) {
  return (
    <span
      className={`absolute inset-0 flex items-center ${fallbackClassName}`}
      aria-hidden="true"
    >
      {text}
    </span>
  );
}

/**
 * useDeferredMount — returns true once the element is near the viewport OR the
 * user has interacted with the page, so we can defer pulling the WebGL chunk
 * until it's actually worth the cost. Honors no-IntersectionObserver
 * environments by mounting on first interaction / a short timeout fallback.
 */
function useDeferredMount(ref: React.RefObject<HTMLElement | null>): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const arm = () => {
      if (!cancelled) setReady(true);
    };

    // 1) In-view: load a little before it scrolls in (rootMargin) so the
    //    upgrade is ready by the time the user can see it.
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              arm();
              observer?.disconnect();
              break;
            }
          }
        },
        { rootMargin: '200px 0px', threshold: 0.01 }
      );
      observer.observe(el);
    } else {
      // No IO support: don't block the upgrade forever.
      arm();
    }

    // 2) First interaction: a user who scrolls/points/keys has signalled intent
    //    and the device is awake — fine to warm up the canvas even if the logo
    //    box hasn't crossed the IO threshold yet.
    const onInteract = () => arm();
    const interactOpts = { once: true, passive: true } as const;
    window.addEventListener('pointerdown', onInteract, interactOpts);
    window.addEventListener('keydown', onInteract, interactOpts);
    window.addEventListener('scroll', onInteract, interactOpts);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      window.removeEventListener('scroll', onInteract);
    };
  }, [ref, ready]);

  return ready;
}

export function CandyLogo({
  text = 'Candy',
  width = 132,
  height = 50,
  size = 1,
  zoom = 4.2,
  animate = true,
  fallbackClassName = 'text-primary',
  hideWebGLBelow,
}: CandyLogoProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const inView = useDeferredMount(hostRef);
  // On narrow viewports (matches hideWebGLBelow) we never mount the 3D canvas —
  // only the flat wordmark, which is crisp and uncroppable. Re-evaluates live
  // on resize/orientation so rotating a phone upgrades/downgrades correctly.
  const suppressWebGL = useMediaQuery(hideWebGLBelow);
  const mountWebGL = inView && !suppressWebGL;

  return (
    <span
      ref={hostRef}
      className="relative inline-block align-middle max-w-full"
      style={{ width, height }}
      aria-label={text}
      role="img"
    >
      {/* Flat wordmark is always present underneath: it's the cheap first paint,
          the visible content until the WebGL upgrade is mounted + warm, and the
          permanent render on narrow viewports (suppressWebGL). */}
      <FlatWordmark text={text} fallbackClassName={fallbackClassName} />

      {mountWebGL && (
        <Suspense fallback={null}>
          <CandyJelly
            text={text}
            size={size}
            zoom={zoom}
            animate={animate}
            className="absolute inset-0"
          />
        </Suspense>
      )}
    </span>
  );
}

export default CandyLogo;
