import { lazy, Suspense } from 'react';

/**
 * CandyLogo — lazy boundary for the WebGL jelly word.
 *
 * The actual three.js scene lives in ./CandyJelly and is pulled in via
 * React.lazy(), so the whole three.js stack ships as a SEPARATE chunk and never
 * blocks first paint. Until that chunk resolves (and on any WebGL failure the
 * canvas simply renders nothing visible), the user sees the flat brand-pink
 * "Candy" text — identical to the original logo — as the Suspense fallback.
 *
 * Drop-in replacement for `<span className="text-primary">Candy</span>`.
 */

const CandyJelly = lazy(() => import('./CandyJelly'));

interface CandyLogoProps {
  /** the word to render in jelly (default "Candy") */
  text?: string;
  /** canvas pixel box — sized to sit inline in the logo row */
  width?: number;
  height?: number;
  /** Text3D world size */
  size?: number;
  /** camera distance */
  zoom?: number;
  /** idle float/rotation */
  animate?: boolean;
  /** extra classes for the flat fallback <span> */
  fallbackClassName?: string;
}

export function CandyLogo({
  text = 'Candy',
  width = 132,
  height = 50,
  size = 1,
  zoom = 4.2,
  animate = true,
  fallbackClassName = 'text-primary',
}: CandyLogoProps) {
  return (
    <span
      className="relative inline-block align-middle"
      style={{ width, height }}
      aria-label={text}
      role="img"
    >
      <Suspense
        fallback={
          <span
            className={`absolute inset-0 flex items-center ${fallbackClassName}`}
            aria-hidden="true"
          >
            {text}
          </span>
        }
      >
        <CandyJelly
          text={text}
          size={size}
          zoom={zoom}
          animate={animate}
          className="absolute inset-0"
        />
      </Suspense>
    </span>
  );
}

export default CandyLogo;
