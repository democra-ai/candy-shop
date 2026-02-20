import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Sidebar } from './Sidebar';
import { useLanguage } from '../../contexts/LanguageContext';

const THEME_COLORS: Record<
  string,
  { light: Record<string, string>; dark: Record<string, string> }
> = {
  indigo: {
    light: {
      '--color-primary': '#5E6AD2',
      '--color-primary-hover': '#4F5CC0',
      '--color-primary-active': '#434DB0',
    },
    dark: {
      '--color-primary': '#818CF8',
      '--color-primary-hover': '#A5B4FC',
      '--color-primary-active': '#6366F1',
    },
  },
  blue: {
    light: {
      '--color-primary': '#3B82F6',
      '--color-primary-hover': '#2563EB',
      '--color-primary-active': '#1D4ED8',
    },
    dark: {
      '--color-primary': '#60A5FA',
      '--color-primary-hover': '#93C5FD',
      '--color-primary-active': '#3B82F6',
    },
  },
  emerald: {
    light: {
      '--color-primary': '#10B981',
      '--color-primary-hover': '#059669',
      '--color-primary-active': '#047857',
    },
    dark: {
      '--color-primary': '#34D399',
      '--color-primary-hover': '#6EE7B7',
      '--color-primary-active': '#10B981',
    },
  },
  amber: {
    light: {
      '--color-primary': '#F59E0B',
      '--color-primary-hover': '#D97706',
      '--color-primary-active': '#B45309',
    },
    dark: {
      '--color-primary': '#FBBF24',
      '--color-primary-hover': '#FCD34D',
      '--color-primary-active': '#F59E0B',
    },
  },
  rose: {
    light: {
      '--color-primary': '#D4246A',
      '--color-primary-hover': '#BF1F5F',
      '--color-primary-active': '#A81A54',
    },
    dark: {
      '--color-primary': '#F28BAE',
      '--color-primary-hover': '#F5A0BF',
      '--color-primary-active': '#E8759A',
    },
  },
  violet: {
    light: {
      '--color-primary': '#8B5CF6',
      '--color-primary-hover': '#7C3AED',
      '--color-primary-active': '#6D28D9',
    },
    dark: {
      '--color-primary': '#A78BFA',
      '--color-primary-hover': '#C4B5FD',
      '--color-primary-active': '#8B5CF6',
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
}: LayoutProps) {
  const { t } = useLanguage();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('rose');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const savedColorTheme = localStorage.getItem('colorTheme') || 'rose';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    setCurrentTheme(savedColorTheme);

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    applyThemeColors(savedColorTheme, savedTheme === 'dark' || (!savedTheme && prefersDark));
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
      {/* Subtle mesh gradient background */}
      <div className="fixed inset-0 bg-candy-mesh pointer-events-none" aria-hidden="true" />
      {/* Sprinkle dot pattern */}
      <div className="fixed inset-0 sprinkle-pattern pointer-events-none" aria-hidden="true" />

      <Sidebar
        onOpenAuth={onOpenAuth}
        onOpenCart={onOpenCart}
        user={user}
        cartCount={cartCount}
        onNavFind={onNavFind}
        onNavCd={onNavCd}
        onNavMan={onNavMan}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        currentTheme={currentTheme}
        onChangeTheme={changeTheme}
      />
      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen relative">
        <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-8 md:py-12">{children}</div>
      </main>

      <footer className="lg:pl-64 w-full relative mt-16">
        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="py-10 glass-strong">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-foreground-secondary font-body">
                <span className="text-lg animate-candy-float">🍭</span>
                <p>{t('footer.tagline')}</p>
              </div>
              <div className="flex items-center gap-6 text-xs text-foreground-tertiary font-mono">
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
                  className="hover:text-primary transition-colors duration-200 cursor-pointer px-3 py-2 rounded-lg hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Scroll to top"
                >
                  {t('footer.backToTop')} ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
