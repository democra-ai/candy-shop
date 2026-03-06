import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, User as UserIcon, LogOut, Plus, Library, Menu, X, Moon, Sun, Check, Settings, Globe } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../utils/cn';

const themes = [
  { id: 'indigo', name: 'Indigo', color: '#6366F1', light: '#818CF8' },
  { id: 'blue', name: 'Ocean', color: '#3B82F6', light: '#60A5FA' },
  { id: 'emerald', name: 'Emerald', color: '#10B981', light: '#34D399' },
  { id: 'amber', name: 'Sunset', color: '#F59E0B', light: '#FBBF24' },
  { id: 'rose', name: 'Rose', color: '#F43F5E', light: '#FB7185' },
  { id: 'violet', name: 'Purple', color: '#8B5CF6', light: '#A78BFA' },
];

interface HeaderProps {
  onOpenAuth: () => void;
  onOpenCart: () => void;
  user: User | null;
  cartCount: number;
  onNavFind: () => void;
  onNavCd: () => void;
  onNavMan: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  currentTheme: string;
  onChangeTheme: (theme: string) => void;
}

export function Header({
  onOpenAuth,
  onOpenCart,
  user,
  cartCount,
  onNavFind,
  onNavCd,
  onNavMan,
  isDarkMode,
  onToggleTheme,
  currentTheme,
  onChangeTheme,
}: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { label: t('nav.find.user'), action: onNavFind },
    { label: t('nav.cd.user'), action: onNavCd },
    { label: t('nav.man.user'), action: onNavMan },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <span className="font-candy font-bold text-foreground text-lg">🍭 Candy Shop</span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="px-3 py-2 text-sm text-foreground-secondary hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
                >
                  {link.label}
                </button>
              ))}
              {user && (
                <>
                  <button
                    onClick={() => navigate('/skills/create')}
                    className={cn(
                      'px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5',
                      location.pathname === '/skills/create'
                        ? 'text-primary bg-primary/10'
                        : 'text-foreground-secondary hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('nav.create.user')}
                  </button>
                  <button
                    onClick={() => navigate('/skills/library')}
                    className={cn(
                      'px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5',
                      location.pathname === '/skills/library'
                        ? 'text-primary bg-primary/10'
                        : 'text-foreground-secondary hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Library className="w-3.5 h-3.5" />
                    {t('nav.library.user')}
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Settings Dropdown */}
            <div ref={settingsRef} className="relative hidden md:block">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="p-2 text-foreground-secondary hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-4.5 h-4.5" />
              </button>

              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg py-2 animate-fade-in z-50">
                  {/* Theme Colors */}
                  <div className="px-3 py-1.5 text-xs font-medium text-foreground-tertiary uppercase tracking-wider">
                    {t('chooseTheme')}
                  </div>
                  <div className="px-3 py-2 flex gap-2">
                    {themes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => onChangeTheme(theme.id)}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                          currentTheme === theme.id
                            ? 'border-foreground scale-110'
                            : 'border-transparent hover:scale-110'
                        )}
                        style={{ backgroundColor: isDarkMode ? theme.light : theme.color }}
                        title={t(`theme.${theme.id}`)}
                      >
                        {currentTheme === theme.id && <Check className="w-3 h-3 text-white" />}
                      </button>
                    ))}
                  </div>

                  <div className="h-px bg-border my-1" />

                  {/* Dark Mode */}
                  <button
                    onClick={onToggleTheme}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{isDarkMode ? t('lightMode') : t('darkMode')}</span>
                  </button>

                  {/* Language */}
                  <button
                    onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{language === 'en' ? '中文' : 'English'}</span>
                  </button>

                </div>
              )}
            </div>

            {/* Cart */}
            <button
              onClick={onOpenCart}
              className="p-2 text-foreground-secondary hover:text-foreground hover:bg-secondary rounded-lg transition-colors relative"
              aria-label={`${t('cart')} (${cartCount})`}
            >
              <ShoppingBag className="w-4.5 h-4.5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Auth */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Avatar"
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-foreground-secondary" />
                  )}
                  <span className="text-sm text-foreground">
                    {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                  </span>
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="p-2 text-foreground-secondary hover:text-error rounded-lg transition-colors"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="hidden md:flex items-center h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                {t('login')}
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-foreground-secondary hover:text-foreground rounded-lg transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background animate-fade-in">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => { link.action(); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-foreground-secondary hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  {link.label}
                </button>
              ))}
              {user && (
                <>
                  <button
                    onClick={() => { navigate('/skills/create'); setMobileOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-foreground-secondary hover:text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> {t('nav.create.user')}
                  </button>
                  <button
                    onClick={() => { navigate('/skills/library'); setMobileOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-foreground-secondary hover:text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Library className="w-4 h-4" /> {t('nav.library.user')}
                  </button>
                </>
              )}

              <div className="h-px bg-border my-2" />

              <button
                onClick={onToggleTheme}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground-secondary hover:text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDarkMode ? t('lightMode') : t('darkMode')}
              </button>

              <button
                onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground-secondary hover:text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {language === 'en' ? '中文' : 'English'}
              </button>

              {!user && (
                <>
                  <div className="h-px bg-border my-2" />
                  <button
                    onClick={() => { onOpenAuth(); setMobileOpen(false); }}
                    className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                  >
                    {t('login')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
