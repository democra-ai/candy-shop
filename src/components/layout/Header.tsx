import { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  User as UserIcon,
  LogOut,
  Sparkles,
  Library,
  Menu,
  X,
  Moon,
  Sun,
  Check,
  Settings,
  Globe,
  Candy,
  Heart,
  Plus,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '../../lib/authClient';
import { hubAuth } from '../../lib/authClient';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../utils/cn';

// Candy-flavor swatches — `id`s stay stable (wired to THEME_COLORS + i18n keys).
const themes = [
  { id: 'rose', name: 'Raspberry', color: '#E11D6B', light: '#FF6FA5' },
  { id: 'violet', name: 'Grape', color: '#7C3AED', light: '#A974FF' },
  { id: 'emerald', name: 'Mint', color: '#18C3A6', light: '#34E2C4' },
  { id: 'amber', name: 'Caramel', color: '#F2A742', light: '#F7C173' },
  { id: 'blue', name: 'Blueberry', color: '#4F6EF2', light: '#8AA0FF' },
  { id: 'indigo', name: 'Cotton Candy', color: '#B06AB3', light: '#D49BD6' },
];

interface NavItem {
  id: string;
  userLabelKey: string;
  icon: LucideIcon;
  action: string;
}

// Mirrors the Sidebar's two-sided nav model (the sole source of truth for routing).
const navItems: NavItem[] = [
  { id: 'candy', userLabelKey: 'nav.candy.user', icon: Candy, action: 'candy' },
  { id: 'craving', userLabelKey: 'nav.craving.user', icon: Heart, action: 'craving' },
  { id: 'post-candy', userLabelKey: 'nav.postCandy.user', icon: Candy, action: 'post-candy' },
  { id: 'post-craving', userLabelKey: 'nav.postCraving.user', icon: Plus, action: 'post-craving' },
  { id: 'man', userLabelKey: 'nav.man.user', icon: BookOpen, action: 'man' },
];

const userNavItems: NavItem[] = [
  { id: 'create', userLabelKey: 'nav.create.user', icon: Sparkles, action: 'create' },
  { id: 'library', userLabelKey: 'nav.library.user', icon: Library, action: 'library' },
];

interface HeaderProps {
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
  onNavCandy,
  onNavCraving,
  onNavPostCraving,
  onNavPostCandy,
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

  // Esc closes the mobile drawer (parity with the old Sidebar drawer semantics).
  useEffect(() => {
    if (!mobileOpen) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mobileOpen]);

  // Active-link detection — copied from the Sidebar's getActiveAction so the
  // top bar highlights the current page the same way the rail used to.
  const getActiveAction = (): string | null => {
    if (location.pathname === '/skills/create') return 'create';
    if (location.pathname === '/skills/library') return 'library';
    if (location.pathname === '/') {
      const params = new URLSearchParams(location.search);
      const tab = params.get('tab');
      const modal = params.get('modal');
      if (modal === 'post-candy') return 'post-candy';
      if (modal === 'post-craving') return 'post-craving';
      if (tab === 'craving') return 'craving';
      return 'candy';
    }
    return null;
  };
  const activeAction = getActiveAction();

  // Single routing switch — same action→callback wiring the Sidebar used.
  const handleNavAction = (action: string) => {
    switch (action) {
      case 'candy': onNavCandy(); break;
      case 'craving': onNavCraving(); break;
      case 'post-craving': onNavPostCraving(); break;
      case 'post-candy': onNavPostCandy(); break;
      case 'find': onNavFind(); break;
      case 'cd': onNavCd(); break;
      case 'man': onNavMan(); break;
      case 'create': navigate('/skills/create'); break;
      case 'library': navigate('/skills/library'); break;
    }
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    await hubAuth.signOut();
    setMobileOpen(false);
    window.location.reload();
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
          {/* Logo + desktop nav */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center hover:opacity-80 transition-opacity"
              aria-label="Go to home page"
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-[26px] leading-none" aria-hidden="true">🍭</span>
                <span className="font-candy font-semibold text-lg tracking-tight text-foreground inline-flex items-center">
                  <span className="text-primary">Candy</span>
                  <span className="ml-0.5"> Shop</span>
                </span>
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeAction === item.action;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavAction(item.action)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5',
                      isActive
                        ? 'text-primary bg-primary/10 font-semibold'
                        : 'text-foreground-secondary hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t(item.userLabelKey)}
                  </button>
                );
              })}
              {user &&
                userNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeAction === item.action;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavAction(item.action)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5',
                        isActive
                          ? 'text-primary bg-primary/10 font-semibold'
                          : 'text-foreground-secondary hover:text-foreground hover:bg-secondary'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t(item.userLabelKey)}
                    </button>
                  );
                })}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Settings Dropdown (theme color + dark mode + language) */}
            <div ref={settingsRef} className="relative hidden md:block">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="p-2 text-foreground-secondary hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                aria-label="Settings"
                aria-expanded={settingsOpen}
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
                  onClick={handleSignOut}
                  className="p-2 text-foreground-secondary hover:text-error rounded-lg transition-colors"
                  title={t('logout')}
                  aria-label={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="candy-btn btn-press hidden md:flex items-center h-9 px-4 rounded-xl text-sm font-semibold"
              >
                {t('login')}
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-foreground-secondary hover:text-foreground rounded-lg transition-colors"
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeAction === item.action;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavAction(item.action)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center gap-2',
                      isActive
                        ? 'text-primary bg-primary/10 font-semibold'
                        : 'text-foreground-secondary hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Icon className="w-4 h-4" /> {t(item.userLabelKey)}
                  </button>
                );
              })}
              {user &&
                userNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeAction === item.action;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavAction(item.action)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center gap-2',
                        isActive
                          ? 'text-primary bg-primary/10 font-semibold'
                          : 'text-foreground-secondary hover:text-foreground hover:bg-secondary'
                      )}
                    >
                      <Icon className="w-4 h-4" /> {t(item.userLabelKey)}
                    </button>
                  );
                })}

              <div className="h-px bg-border my-2" />

              {/* Theme color swatches */}
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

              <div className="h-px bg-border my-2" />

              {user ? (
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2.5 text-sm text-foreground-secondary hover:text-error hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> {t('logout')}
                </button>
              ) : (
                <button
                  onClick={() => { onOpenAuth(); setMobileOpen(false); }}
                  className="candy-btn btn-press w-full h-10 rounded-xl text-sm font-semibold"
                >
                  {t('login')}
                </button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
