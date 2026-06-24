import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Text3D,
  Center,
  Environment,
  MeshTransmissionMaterial,
} from '@react-three/drei';
import type { Group } from 'three';

/**
 * CandyJelly — open-source reproduction of haoqi.design's glossy "liquid glass"
 * jelly lettering, applied to the word "Candy" and tinted candy-raspberry.
 *
 * Technique (all MIT): three.js + @react-three/fiber + drei's
 * MeshTransmissionMaterial on a runtime-generated Text3D (TextGeometry + bevel)
 * under an HDRI <Environment> for the specular gloss + refraction. No
 * hand-modeled GLTF — letters are extruded from a heavy rounded typeface JSON
 * (Fredoka, instanced at a semibold weight) so the volume reads as gummy.
 *
 * This file is the LAZY chunk: it is imported via React.lazy so all of three.js
 * lands in a separate bundle and never blocks first paint. The flat <span> text
 * is the Suspense fallback.
 */

// The original fredoka-semibold.typeface.json shipped with a scale bug: its
// glyph OUTLINE coords were authored in a ~0–100 space while the advance widths
// (`ha`), resolution (1000) and ascender (1353) were in a 1000-em space — a 10×
// mismatch. TextGeometry normalizes outlines by `resolution`, so glyphs rendered
// ~10× too small while sitting at full advance spacing → tiny letters with huge
// gaps (unreadable). `-fixed` is the same JSON with every outline coordinate
// scaled ×10 so glyph size and advance spacing finally agree.
const FONT_URL = '/fonts/fredoka-semibold-fixed.typeface.json';

// Candy raspberry, sampled from --color-primary (#E11D6B light / #FF6FA5 dark).
// Surface color is pushed bright/saturated; a transmissive surface darkens it
// through thickness, so starting hot keeps the gel a vivid candy pink instead
// of sinking to maroon. The attenuation color is a lighter raspberry (not the
// dark active token) so light staying inside the volume reads pink, not black.
const CANDY_PINK = '#E11D6B'; // brand --color-primary; saturated enough to read on a cream page
const CANDY_PINK_DEEP = '#F0428A'; // attenuation target — a lighter raspberry so deep gel glows, not muddies

interface JellyTextProps {
  text: string;
  size: number;
  /** gentle idle float + tilt so the highlights travel across the surface */
  animate?: boolean;
}

function JellyText({ text, size, animate = true }: JellyTextProps) {
  const group = useRef<Group>(null);

  useFrame((state) => {
    if (!animate || !group.current) return;
    const t = state.clock.getElapsedTime();
    // subtle: a slow yaw wobble + a small vertical bob — keeps gloss hotspots alive
    group.current.rotation.y = Math.sin(t * 0.5) * 0.05;
    group.current.rotation.x = Math.sin(t * 0.4) * 0.025;
    group.current.position.y = Math.sin(t * 0.8) * 0.03 * size;
  });

  return (
    <group ref={group}>
      <Center
        onCentered={(props) => {
          // eslint-disable-next-line no-console
          console.log('[JELLY_DIM3]', JSON.stringify({ w: props.width, h: props.height, d: props.depth }));
        }}
      >
        <Text3D
          font={FONT_URL}
          size={size}
          height={size * 0.14}
          curveSegments={12}
          bevelEnabled
          bevelThickness={size * 0.035}
          bevelSize={size * 0.025}
          bevelOffset={0}
          bevelSegments={6}
        >
          {text}
          <MeshTransmissionMaterial
            // --- transmission / glass core ---
            // ~0.36 (not 1.0): a pure-transmission surface over a near-uniform
            // cream page refracts "nothing" and vanishes. Holding real body keeps
            // a gummy-candy translucency AND writes the candy tint + alpha so the
            // word reads on light or dark. Higher = glassier (haoqi) but fainter
            // on cream; this is the sweet spot for a logo on #FFF8F0.
            transmission={0.44}
            thickness={size * 0.42}
            ior={1.44}
            // --- gloss --- (low roughness + clearcoat = the bright wet hotspots)
            roughness={0.03}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.04}
            reflectivity={0.85}
            envMapIntensity={1.1}
            // --- refraction character (the "jelly" wobble + chromatic edges) ---
            chromaticAberration={0.45}
            anisotropicBlur={0.2}
            distortion={0.08}
            distortionScale={0.2}
            temporalDistortion={0.08}
            // --- candy tint --- (long attenuation so the gel stays bright pink,
            // never sinking to maroon)
            color={CANDY_PINK}
            attenuationColor={CANDY_PINK_DEEP}
            attenuationDistance={size * 4}
            // --- quality (capped for logo-size perf: the buffer re-renders
            // every frame, so 256 keeps 3 always-on logo canvases affordable) ---
            samples={5}
            resolution={256}
            backside
            backsideThickness={size * 0.08}
            backsideResolution={128}
          />
        </Text3D>
      </Center>
    </group>
  );
}

interface CandyJellyProps {
  text?: string;
  /** Text3D world size; tune per placement (logo small, showcase large) */
  size?: number;
  /** camera distance — larger pushes the word smaller in frame */
  zoom?: number;
  className?: string;
  animate?: boolean;
}

export default function CandyJelly({
  text = 'Candy',
  size = 1,
  zoom = 2.75,
  className,
  animate = true,
}: CandyJellyProps) {
  // R3F's <Canvas> measures its container with a ResizeObserver. When the lazy
  // chunk mounts AFTER the surrounding layout has already settled (our case —
  // the logo box is sized before three.js loads), that observer can latch onto
  // the 300x150 default and never re-fire. Nudging a resize on mount forces a
  // correct re-measure so the canvas fills its real (small) logo box.
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'));
    const r1 = requestAnimationFrame(fire);
    const t1 = setTimeout(fire, 120);
    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(t1);
    };
  }, []);

  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, zoom], fov: 28 }}
      resize={{ debounce: 0, scroll: false }}
      style={{ width: '100%', height: '100%', background: 'transparent', pointerEvents: 'none' }}
    >
      <Suspense fallback={null}>
        {/* key light — the bright specular hotspot, top-right like haoqi */}
        <directionalLight position={[4, 5, 6]} intensity={2.2} />
        {/* rim / accent — pink kick from the lower-left so shadowed edges glow */}
        <directionalLight position={[-4, -2, 2]} intensity={0.8} color={CANDY_PINK} />
        {/* small white spec to punch a crisp hotspot */}
        <pointLight position={[2, 3, 4]} intensity={1.8} distance={20} />
        <ambientLight intensity={0.3} />
        <JellyText text={text} size={size} animate={animate} />
        {/* HDRI gives the transmissive material something to refract + the
            broad soft reflections that sell the "glass" read. Kept dim so the
            reflections don't blow the letters out to white on a light page. */}
        <Environment preset="apartment" environmentIntensity={0.55} />
      </Suspense>
    </Canvas>
  );
}
