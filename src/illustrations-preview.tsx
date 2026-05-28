/**
 * Standalone QA preview for the candy illustration system. Not part of the app
 * routes — served directly via /illustrations-preview.html in dev. Renders the
 * logo lockup, all 8 category candies (48 + 96), Pip, the empty-state spots, and
 * sprinkles, on BOTH a white and a dark panel, each labeled, so the set can be
 * screenshotted and critiqued for cohesion.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Fredoka for the wordmark (installed but not yet wired into the app — see
// illustrations/README.md note for the propagation agents).
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import {
  Logo,
  Pip,
  EmptyJar,
  Counter,
  Sprinkles,
  ChocolateBar,
  SwirlLollipop,
  CaramelCube,
  MintDrop,
  ChocolateSquare,
  Gumball,
  WrappedCandy,
  GumdropTwist,
} from './components/illustrations';
import { getFlavor } from './utils/candyShells';

const CATEGORY_SET: Array<{ label: string; category: string; Comp: React.ComponentType<{ size?: number; color?: string }> }> = [
  { label: 'Development · Raspberry', category: 'Development', Comp: ChocolateBar },
  { label: 'Design · Grape', category: 'Design', Comp: SwirlLollipop },
  { label: 'Marketing · Caramel', category: 'Marketing', Comp: CaramelCube },
  { label: 'Productivity · Mint', category: 'Productivity', Comp: MintDrop },
  { label: 'Tools · Chocolate', category: 'Tools', Comp: ChocolateSquare },
  { label: 'Research · Blueberry', category: 'Research', Comp: Gumball },
  { label: 'Mobile · Lemon', category: 'Mobile', Comp: WrappedCandy },
  { label: 'Writing · Bubblegum', category: 'Writing', Comp: GumdropTwist },
];

function Section({ title }: { title: string }) {
  return (
    <div
      style={{
        fontFamily: '"Fira Code", monospace',
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        opacity: 0.55,
        margin: '28px 0 14px',
      }}
    >
      {title}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 120 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>{children}</div>
      <div style={{ fontFamily: '"Inter", sans-serif', fontSize: 10.5, opacity: 0.7, textAlign: 'center', lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

function Panel({ dark }: { dark: boolean }) {
  const bg = dark ? '#140A18' : '#FFFDFB';
  const card = dark ? '#1E1126' : '#FFFFFF';
  const ink = dark ? '#F7ECF4' : '#1F1320';
  const border = dark ? '#3A2640' : '#F1E3EC';
  const shadow = dark
    ? '0 1px 2px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.45)'
    : '0 1px 2px rgba(31,19,32,.04), 0 4px 12px rgba(31,19,32,.05)';

  return (
    <div className={dark ? 'dark' : ''} style={{ background: bg, color: ink, padding: 32, flex: 1, minWidth: 560 }}>
      <div style={{ fontFamily: '"Fredoka","Quicksand",sans-serif', fontWeight: 600, fontSize: 20, marginBottom: 4 }}>
        {dark ? 'Dark panel' : 'Light panel'}
      </div>
      <div style={{ fontFamily: '"Inter",sans-serif', fontSize: 12, opacity: 0.6 }}>
        background {bg} · card {card}
      </div>

      <Section title="Logo lockup" />
      <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
        <Logo size={28} />
        <Logo size={40} />
        <div style={{ color: ink }}><Logo size={32} markOnly /></div>
      </div>

      <Section title="Category candies · 48px" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: card, borderRadius: 16, border: `1px solid ${border}`, padding: 16, boxShadow: shadow }}>
        {CATEGORY_SET.map(({ label, category, Comp }) => {
          const f = getFlavor(category, dark);
          return (
            <Cell key={label} label={label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 14, background: f.tint }}>
                <Comp size={40} color={f.base} />
              </div>
            </Cell>
          );
        })}
      </div>

      <Section title="Category candies · 96px" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: card, borderRadius: 16, border: `1px solid ${border}`, padding: 16, boxShadow: shadow }}>
        {CATEGORY_SET.map(({ label, category, Comp }) => {
          const f = getFlavor(category, dark);
          return (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 120 }}>
              <Comp size={96} color={f.base} />
            </div>
          );
        })}
      </div>

      <Section title="Mascot + spots + chip usage" />
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end', background: card, borderRadius: 16, border: `1px solid ${border}`, padding: 24, boxShadow: shadow }}>
        <Cell label="Pip (mascot)"><Pip size={96} /></Cell>
        <Cell label="EmptyJar"><EmptyJar size={96} color={getFlavor('Research', dark).base} /></Cell>
        <Cell label="Counter"><Counter size={96} color={getFlavor('Caramel', dark).base} /></Cell>
        {/* chip + button mock so the palette is judged in context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          {(['Development', 'Design', 'Mint'] as const).map((c) => {
            const f = getFlavor(c, dark);
            return (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: f.tint, color: f.ink, fontFamily: '"Fira Code",monospace', fontSize: 12, padding: '4px 10px', borderRadius: 999 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: f.base }} />
                {c}
              </span>
            );
          })}
        </div>
      </div>

      <Section title="Sprinkles (decorative, low-opacity)" />
      <div style={{ position: 'relative', background: card, borderRadius: 16, border: `1px solid ${border}`, padding: 24, height: 120, overflow: 'hidden', boxShadow: shadow }}>
        <Sprinkles width={520} color={getFlavor('Raspberry', dark).base} opacity={dark ? 0.3 : 0.22} style={{ position: 'absolute', top: 0, left: 0 }} />
        <div style={{ position: 'relative', fontFamily: '"Fredoka","Quicksand",sans-serif', fontSize: 18, fontWeight: 500 }}>
          Sweet accents, not noise.
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
      <Panel dark={false} />
      <Panel dark={true} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
