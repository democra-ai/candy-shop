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
      '--color-primary': '#F43F5E',
      '--color-primary-hover': '#E11D48',
      '--color-primary-active': '#BE123C',
    },
    dark: {
      '--color-primary': '#FB7185',
      '--color-primary-hover': '#FDA4AF',
      '--color-primary-active': '#F43F5E',
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
  const [currentTheme, setCurrentTheme] = useState('indigo');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const savedColorTheme = localStorage.getItem('colorTheme') || 'indigo';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    setCurrentTheme(savedColorTheme);

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    applyThemeColors(savedColorTheme, savedTheme === 'dark' || (!savedTheme && prefersDark));
  }, []);

  const applyThemeColors = (themeName: string, isDark: boolean) => {
    const themeColors = THEME_COLORS[themeName] || THEME_COLORS.indigo;
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
    <div className="min-h-screen bg-background">
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
      <main className="lg:pl-64 min-h-screen">
        <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-8 md:py-12">{children}</div>
      </main>

      <footer className="w-full border-t border-border py-6 mt-12 bg-card/50 relative">
        <div className="container max-w-7xl mx-auto px-4 flex items-center justify-between text-xs text-foreground-secondary font-mono">
          <p>{t('footer.tagline')}</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="hover:text-primary transition-colors duration-200 cursor-pointer px-3 py-2 rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Scroll to top"
          >
            {t('footer.backToTop')}
          </button>
        </div>
      </footer>
    </div>
  );
}
