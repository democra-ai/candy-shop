import { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../utils/cn';

// Candy-flavor theme palette. The `id`s are kept stable (they drive the
// `--color-primary` CSS vars in THEME_COLORS below and map to the `theme.{id}`
// i18n keys), but the display name + swatch are re-skinned to candy flavors.
// Swatch colors match the raspberry-family candy palette so name and color agree.
const themes = [
  { id: 'rose',    name: 'Raspberry',    color: '#E11D6B', light: '#FF6FA5', desc: 'The house flavor' },
  { id: 'violet',  name: 'Grape',        color: '#7C3AED', light: '#A974FF', desc: 'Bold & juicy' },
  { id: 'emerald', name: 'Mint',         color: '#18C3A6', light: '#34E2C4', desc: 'Cool & fresh' },
  { id: 'amber',   name: 'Caramel',      color: '#F2A742', light: '#F7C173', desc: 'Warm & buttery' },
  { id: 'blue',    name: 'Blueberry',    color: '#4F6EF2', light: '#8AA0FF', desc: 'Crisp & tart' },
  { id: 'indigo',  name: 'Cotton Candy', color: '#B06AB3', light: '#D49BD6', desc: 'Soft & sweet' },
];

export function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [currentTheme, setCurrentTheme] = useState(() =>
    localStorage.getItem('colorTheme') || 'rose'
  );

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    // Trigger theme color update
    window.dispatchEvent(new CustomEvent('theme-change'));
  };

  const selectTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem('colorTheme', themeId);
    window.dispatchEvent(new CustomEvent('theme-change'));
    // Directly apply
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    // Candy-flavor primaries — same `id` keys, recolored to the boutique palette
    // so the applied accent matches the swatch shown above.
    const THEME_COLORS: Record<string, Record<string, string>> = {
      rose: { '--color-primary': '#E11D6B', '--color-primary-hover': '#C9165C', '--color-primary-active': '#AE1250' },
      violet: { '--color-primary': '#7C3AED', '--color-primary-hover': '#6D28D9', '--color-primary-active': '#5B21B6' },
      emerald: { '--color-primary': '#18C3A6', '--color-primary-hover': '#129E87', '--color-primary-active': '#0D7E6C' },
      amber: { '--color-primary': '#F2A742', '--color-primary-hover': '#D98B2A', '--color-primary-active': '#B86F1C' },
      blue: { '--color-primary': '#4F6EF2', '--color-primary-hover': '#3B58D9', '--color-primary-active': '#2D45B8' },
      indigo: { '--color-primary': '#B06AB3', '--color-primary-hover': '#9A559D', '--color-primary-active': '#824486' },
    };
    const colors = THEME_COLORS[themeId];
    if (colors) {
      Object.entries(colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-1.5">
        your preferences
      </p>
      <h1 className="text-3xl font-bold font-candy tracking-tight mb-8">Settings</h1>

      {/* Appearance */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-lg font-candy font-bold mb-4">Appearance</h2>

          {/* Dark Mode */}
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-sm">Dark Mode</p>
              <p className="text-xs text-foreground-secondary">Switch between light and dark themes</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                isDarkMode ? 'bg-primary' : 'bg-foreground-muted'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Theme Color */}
          <div className="py-4">
            <p className="font-medium text-sm mb-3">Theme Color</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => selectTheme(theme.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    currentTheme === theme.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-candy-1'
                      : 'border-border hover:border-border-hover hover:shadow-candy-1'
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                    style={{ backgroundColor: isDarkMode ? theme.light : theme.color }}
                  >
                    {currentTheme === theme.id && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{theme.name}</p>
                    <p className="text-xs text-foreground-tertiary">{theme.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Language</h2>
          <div className="flex gap-3">
            <Button
              variant={language === 'en' ? 'default' : 'outline'}
              onClick={() => setLanguage('en')}
              className="flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              English
            </Button>
            <Button
              variant={language === 'zh' ? 'default' : 'outline'}
              onClick={() => setLanguage('zh')}
              className="flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              中文
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
