import { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../utils/cn';

const themes = [
  { id: 'indigo', name: 'Indigo', color: '#4F46E5', light: '#818CF8', desc: 'Professional & Modern' },
  { id: 'blue', name: 'Ocean', color: '#3B82F6', light: '#60A5FA', desc: 'Calm & Trustworthy' },
  { id: 'emerald', name: 'Emerald', color: '#10B981', light: '#34D399', desc: 'Fresh & Natural' },
  { id: 'amber', name: 'Sunset', color: '#F59E0B', light: '#FBBF24', desc: 'Warm & Energetic' },
  { id: 'rose', name: 'Rose', color: '#F43F5E', light: '#FB7185', desc: 'Bold & Vibrant' },
  { id: 'violet', name: 'Purple', color: '#8B5CF6', light: '#A78BFA', desc: 'Creative & Elegant' },
];

export function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [currentTheme, setCurrentTheme] = useState(() =>
    localStorage.getItem('colorTheme') || 'indigo'
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
    const THEME_COLORS: Record<string, Record<string, string>> = {
      indigo: { '--color-primary': '#4F46E5', '--color-primary-hover': '#4338CA', '--color-primary-active': '#3730A3' },
      blue: { '--color-primary': '#3B82F6', '--color-primary-hover': '#2563EB', '--color-primary-active': '#1D4ED8' },
      emerald: { '--color-primary': '#10B981', '--color-primary-hover': '#059669', '--color-primary-active': '#047857' },
      amber: { '--color-primary': '#F59E0B', '--color-primary-hover': '#D97706', '--color-primary-active': '#B45309' },
      rose: { '--color-primary': '#F43F5E', '--color-primary-hover': '#E11D48', '--color-primary-active': '#BE123C' },
      violet: { '--color-primary': '#8B5CF6', '--color-primary-hover': '#7C3AED', '--color-primary-active': '#6D28D9' },
    };
    const colors = THEME_COLORS[themeId];
    if (colors) {
      Object.entries(colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold font-candy mb-8">Settings</h1>

      {/* Appearance */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Appearance</h2>

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
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    currentTheme === theme.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-border-hover'
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
