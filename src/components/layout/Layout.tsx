import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import type { User } from '../../lib/supabaseClient';
import { Sidebar } from './Sidebar';
import { useLanguage } from '../../contexts/LanguageContext';

// Candy-flavor primaries. `id` keys are stable (Raspberry=rose, Grape=violet,
// Mint=emerald, Caramel=amber, Blueberry=blue, Cotton Candy=indigo); the hues
// are the boutique palette so the live accent matches the swatch in the picker.
const THEME_COLORS: Record<
  string,
  { light: Record<string, string>; dark: Record<string, string> }
> = {
  // Cotton Candy
  indigo: {
    light: {
      '--color-primary': '#B06AB3',
      '--color-primary-hover': '#9A559D',
      '--color-primary-active': '#824486',
    },
    dark: {
      '--color-primary': '#D49BD6',
      '--color-primary-hover': '#E0B4E2',
      '--color-primary-active': '#C285C4',
    },
  },
  // Blueberry
  blue: {
    light: {
      '--color-primary': '#4F6EF2',
      '--color-primary-hover': '#3B58D9',
      '--color-primary-active': '#2D45B8',
    },
    dark: {
      '--color-primary': '#8AA0FF',
      '--color-primary-hover': '#A6B7FF',
      '--color-primary-active': '#6E87F2',
    },
  },
  // Mint
  emerald: {
    light: {
      '--color-primary': '#18C3A6',
      '--color-primary-hover': '#129E87',
      '--color-primary-active': '#0D7E6C',
    },
    dark: {
      '--color-primary': '#34E2C4',
      '--color-primary-hover': '#5CEBD2',
      '--color-primary-active': '#22C9AC',
    },
  },
  // Caramel
  amber: {
    light: {
      '--color-primary': '#F2A742',
      '--color-primary-hover': '#D98B2A',
      '--color-primary-active': '#B86F1C',
    },
    dark: {
      '--color-primary': '#F7C173',
      '--color-primary-hover': '#FAD295',
      '--color-primary-active': '#EBAE55',
    },
  },
  // Raspberry — the house flavor
  rose: {
    light: {
      '--color-primary': '#E11D6B',
      '--color-primary-hover': '#C9165C',
      '--color-primary-active': '#AE1250',
    },
    dark: {
      '--color-primary': '#FF6FA5',
      '--color-primary-hover': '#FF85B4',
      '--color-primary-active': '#F25492',
    },
  },
  // Grape
  violet: {
    light: {
      '--color-primary': '#7C3AED',
      '--color-primary-hover': '#6D28D9',
      '--color-primary-active': '#5B21B6',
    },
    dark: {
      '--color-primary': '#A974FF',
      '--color-primary-hover': '#BC93FF',
      '--color-primary-active': '#9659F2',
    },
  },
};

interface LayoutProps {
  children: React.ReactNode;
  onOpenAuth: () => void;
  onOpenCart: () => void;
  user: User | null;
  cartCount: number;
  onNavFind: () => void;
  onNavCd: () => void;
  onNavMan: () => void;
  onNavCandy: () => void;
  onNavCraving: () => void;
  onNavPostCraving: () => void;
  onNavPostCandy: () => void;
}

export function Layout({
  children,
  onOpenAuth,
  onOpenCart,
  user,
  cartCount,
  onNavFind,
  onNavCd,
  onNavMan,
  onNavCandy,
  onNavCraving,
  onNavPostCraving,
  onNavPostCandy,
}: LayoutProps) {
  const { t } = useLanguage();
  // Read the theme state synchronously from <html class="dark"> (set by the
  // inline FOUC-prevention script in index.html before first paint).
  // Using useState's lazy initializer avoids the false→true flip that used
  // to cause a flicker on first mount.
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof localStorage === 'undefined') return 'rose';
    return localStorage.getItem('colorTheme') || 'rose';
  });

  useEffect(() => {
    // Apply CSS color vars for the resolved theme. The `dark` class was
    // already applied by the inline script in index.html; we only need to
    // push the per-theme CSS variables here.
    applyThemeColors(currentTheme, isDarkMode);
    // Intentionally only on mount — toggleTheme + changeTheme keep things in sync after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyThemeColors = (themeName: string, isDark: boolean) => {
    const themeColors = THEME_COLORS[themeName] || THEME_COLORS.rose;
    const colors = isDark ? themeColors.dark : themeColors.light;

    Object.entries(colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  };

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    applyThemeColors(currentTheme, newMode);
  };

  const changeTheme = (themeName: string) => {
    setCurrentTheme(themeName);
    localStorage.setItem('colorTheme', themeName);
    applyThemeColors(themeName, isDarkMode);
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Subtle mesh gradient background — promoted to its own compositor layer
          (translateZ) so the fixed backdrop doesn't repaint as content scrolls. */}
      <div
        className="fixed inset-0 bg-candy-mesh pointer-events-none"
        aria-hidden="true"
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
      />
      {/* Sprinkle dot pattern — same stable-layer treatment. */}
      <div
        className="fixed inset-0 sprinkle-pattern pointer-events-none"
        aria-hidden="true"
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
      />

      <Sidebar
        onOpenAuth={onOpenAuth}
        onOpenCart={onOpenCart}
        user={user}
        cartCount={cartCount}
        onNavFind={onNavFind}
        onNavCd={onNavCd}
        onNavMan={onNavMan}
        onNavCandy={onNavCandy}
        onNavCraving={onNavCraving}
        onNavPostCraving={onNavPostCraving}
        onNavPostCandy={onNavPostCandy}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        currentTheme={currentTheme}
        onChangeTheme={changeTheme}
      />
      {/* `min-h` reserves enough height that short pages (e.g. a filtered grid
          with few results, or an empty craving tab) don't leave a dark void
          above the footer — but it stops short of a full viewport so it never
          INTRODUCES a void on tall pages. The outer wrapper carries the
          full-page `min-h-screen` background. */}
      <main className="lg:pl-64 pt-14 min-h-[60vh] relative">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 md:pt-6 md:pb-12">{children}</div>
      </main>

      <footer className="lg:pl-64 w-full relative">
        {/* Clean hairline divider — single-hue, no rainbow candy-tape (DESIGN.md §5) */}
        <div className="h-px w-full bg-border" aria-hidden />
        <div className="py-10 glass-strong">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-foreground-secondary font-body">
                <span className="text-xl leading-none" aria-hidden="true">🍭</span>
                <p className="font-candy font-bold text-foreground">{t('footer.tagline')}</p>
                <span className="text-foreground-tertiary font-mono text-[11px] hidden md:inline">
                  · handmade in small batches
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-foreground-tertiary font-mono">
                <a
                  href="https://github.com/anthropics/claude-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors duration-200"
                >
                  GitHub
                </a>
                <a
                  href="https://github.com/ClaudioHQ/awesome-claude-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors duration-200"
                >
                  Community
                </a>
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors duration-200 cursor-pointer px-3 py-2 rounded-lg hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Scroll to top"
                >
                  {t('footer.backToTop')} <ArrowUp className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
