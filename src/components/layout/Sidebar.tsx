import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Grid3X3,
  BookOpen,
  Plus,
  Library,
  ShoppingBag,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Moon,
  Sun,
  Palette,
  Check,
  ChevronDown,
  Sparkles,
  Home,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { cn } from '../../utils/cn';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVersionMode } from '../../contexts/VersionModeContext';

interface SidebarProps {
  onOpenAuth: () => void;
  onOpenCart: () => void;
  user: SupabaseUser | null;
  cartCount: number;
  onNavFind: () => void;
  onNavCd: () => void;
  onNavMan: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  currentTheme: string;
  onChangeTheme: (theme: string) => void;
}

const navItems = [
  { id: 'find', labelKey: 'nav.find', userLabelKey: 'nav.find.user', icon: Search, action: 'find' },
  { id: 'cd', labelKey: 'nav.cd', userLabelKey: 'nav.cd.user', icon: Grid3X3, action: 'cd' },
  { id: 'man', labelKey: 'nav.man', userLabelKey: 'nav.man.user', icon: BookOpen, action: 'man' },
];

const userNavItems = [
  { id: 'create', labelKey: 'nav.create', userLabelKey: 'nav.create.user', icon: Plus, action: 'create' },
  { id: 'library', labelKey: 'nav.library', userLabelKey: 'nav.library.user', icon: Library, action: 'library' },
];

// 主题配置
const themes = [
  {
    id: 'indigo',
    name: 'Indigo',
    color: '#5E6AD2',
    light: '#818CF8',
    description: 'Professional & Modern',
  },
  {
    id: 'blue',
    name: 'Ocean',
    color: '#3B82F6',
    light: '#60A5FA',
    description: 'Calm & Trustworthy',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    color: '#10B981',
    light: '#34D399',
    description: 'Fresh & Natural',
  },
  {
    id: 'amber',
    name: 'Sunset',
    color: '#F59E0B',
    light: '#FBBF24',
    description: 'Warm & Energetic',
  },
  { id: 'rose', name: 'Rose', color: '#F43F5E', light: '#FB7185', description: 'Bold & Vibrant' },
  {
    id: 'violet',
    name: 'Purple',
    color: '#8B5CF6',
    light: '#A78BFA',
    description: 'Creative & Elegant',
  },
];

// Tauri titleBarStyle: "Overlay" provides the native drag region

export function Sidebar({
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
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { mode, toggleMode } = useVersionMode();

  // Determine which nav item is active based on current route
  const getActiveAction = (): string | null => {
    if (location.pathname === '/skills/create') return 'create';
    if (location.pathname === '/skills/library') return 'library';
    if (location.pathname === '/') return null; // home page - no specific nav item
    return null;
  };
  const activeAction = getActiveAction();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  // 点击外部关闭主题选择器
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-theme-panel]')) {
        setShowThemeSelector(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavAction = (action: string) => {
    switch (action) {
      case 'find':
        onNavFind();
        break;
      case 'cd':
        onNavCd();
        break;
      case 'man':
        onNavMan();
        break;
      case 'create':
        navigate('/skills/create');
        break;
      case 'library':
        navigate('/skills/library');
        break;
    }
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleThemeChange = (themeId: string) => {
    onChangeTheme(themeId);
    setShowThemeSelector(false);
    setMobileOpen(false);
  };

  const NavButton = ({ item }: { item: (typeof navItems)[0] }) => {
    const isActive = activeAction === item.action;
    const label = mode === 'user' ? t(item.userLabelKey) : t(item.labelKey);
    return (
      <button
        onClick={() => handleNavAction(item.action)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
          'text-sm font-mono transition-all duration-200 cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-primary/30',
          isActive
            ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/20 shadow-sm'
            : 'hover:bg-secondary/70 hover:text-foreground border border-transparent',
          collapsed ? 'justify-center' : 'justify-start'
        )}
        title={collapsed ? label : undefined}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
      >
        <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-primary' : 'text-foreground-secondary')} />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  };

  const themeSelector = (
    <div data-theme-panel className="relative">
      <button
        onClick={() => setShowThemeSelector(!showThemeSelector)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
          'text-sm font-mono transition-all duration-200 cursor-pointer',
          'hover:bg-secondary',
          'focus:outline-none focus:ring-2 focus:ring-primary/30',
          collapsed ? 'justify-center' : 'justify-between'
        )}
        title={collapsed ? t('theme') : undefined}
        aria-label="Select theme"
        aria-expanded={showThemeSelector}
      >
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <Palette className="w-5 h-5 text-foreground-secondary" />
          {!collapsed && <span className="font-body">{t('theme')}</span>}
        </div>
        {!collapsed && (
          <ChevronDown
            className={cn(
              'w-4 h-4 text-foreground-secondary transition-transform',
              showThemeSelector && 'rotate-180'
            )}
          />
        )}
      </button>

      {/* 主题选择下拉菜单 */}
      {showThemeSelector && (
        <div
          className={cn(
            'absolute bottom-full mb-2 left-0 right-0',
            'bg-card border border-border rounded-lg shadow-lg',
            'py-2 z-50 animate-fade-in',
            collapsed ? 'w-48' : 'w-full'
          )}
          style={collapsed ? { left: '50%', transform: 'translateX(-50%)' } : {}}
        >
          <div className="px-3 py-1.5 text-xs font-mono text-foreground-secondary uppercase tracking-wider">
            {t('chooseTheme')}
          </div>
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2',
                'hover:bg-secondary transition-colors',
                currentTheme === theme.id && 'bg-secondary/50'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                  currentTheme === theme.id ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-border hover:scale-105'
                )}
                style={{ backgroundColor: isDarkMode ? theme.light : theme.color }}
              >
                {currentTheme === theme.id && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground">{t(`theme.${theme.id}`)}</div>
                {!collapsed && (
                  <div className="text-xs text-foreground-secondary">{t(`theme.${theme.id}.desc`)}</div>
                )}
              </div>
              {currentTheme === theme.id && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const sidebarContent = (
    <>
      {/* macOS Title Bar Spacer */}
      <div className="h-11 flex-shrink-0" aria-hidden="true" />

      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 border-b border-border',
          'py-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-lg px-1 "
            aria-label="Go to home page"
          >
            <span className="text-2xl leading-none animate-candy-float" aria-hidden="true">🍭</span>
            <span className="font-bold text-lg font-candy candy-gradient-text">~/Skills</span>
          </button>
        )}
        {collapsed && <span className="text-2xl leading-none animate-candy-float">🍭</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}

        {user && (
          <>
            <div className={cn('pt-4 pb-2', collapsed ? 'px-2' : 'px-3')}>
              {!collapsed && (
                <span className="text-xs font-mono text-foreground-secondary uppercase tracking-wider">
                  Library
                </span>
              )}
            </div>
            {userNavItems.map((item) => (
              <NavButton key={item.id} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom Section */}
      <div
        className={cn(
          'border-t border-border px-3 py-4 space-y-2',
          collapsed ? 'items-center' : ''
        )}
      >
        {/* Theme Selector */}
        {themeSelector}

        {/* Light/Dark Mode Toggle */}
        <button
          onClick={onToggleTheme}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-sm font-mono transition-all duration-200',
            'hover:bg-secondary',
            collapsed ? 'justify-center' : 'justify-start'
          )}
          title={collapsed ? (isDarkMode ? t('lightMode') : t('darkMode')) : undefined}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-foreground-secondary" />
          ) : (
            <Moon className="w-5 h-5 text-foreground-secondary" />
          )}
          {!collapsed && <span>{isDarkMode ? t('lightMode') : t('darkMode')}</span>}
        </button>

        {/* Language Toggle */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-sm font-mono transition-all duration-200',
            'hover:bg-secondary',
            collapsed ? 'justify-center' : 'justify-start'
          )}
          title={collapsed ? t('language') : undefined}
        >
          <span className="w-5 h-5 flex items-center justify-center text-foreground-secondary text-xs font-bold">
            {language === 'en' ? '中' : 'EN'}
          </span>
          {!collapsed && <span>{t('language')}</span>}
        </button>

        {/* Cart */}
        <button
          onClick={onOpenCart}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-sm font-mono transition-all duration-200',
            'hover:bg-secondary',
            collapsed ? 'justify-center' : 'justify-start'
          )}
          title={collapsed ? t('cart') : undefined}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-foreground-secondary" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          {!collapsed && <span>{t('cart')}</span>}
        </button>

        {/* User Section */}
        {user ? (
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg',
              'bg-secondary/50 border border-border',
              collapsed ? 'justify-center' : ''
            )}
          >
            {/* Avatar */}
            {(() => {
              const avatarUrl =
                user.user_metadata?.avatar_url ||
                user.user_metadata?.picture ||
                user.identities?.[0]?.identity_data?.avatar_url;

              if (avatarUrl) {
                return (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border border-border flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                );
              }
              return (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
              );
            })()}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    user.email?.split('@')[0] ||
                    'Agent'}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleSignOut}
                className="p-1.5 text-foreground-secondary hover:text-error hover:bg-error/10 rounded-full transition-colors"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
              'text-sm font-mono transition-all duration-200',
              'bg-primary text-primary-foreground hover:bg-primary-hover',
              collapsed ? 'justify-center' : 'justify-start'
            )}
            title={collapsed ? t('login') : undefined}
          >
            <User className="w-5 h-5" />
            {!collapsed && <span>{t('login')}</span>}
          </button>
        )}

        {/* Mode Switcher - Dev/User */}
        <button
          onClick={toggleMode}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
            'text-sm font-body font-semibold transition-all duration-200',
            'bg-gradient-to-r from-primary/10 via-caramel/10 to-mint/10',
            'hover:from-primary/15 hover:via-caramel/15 hover:to-mint/15',
            'border border-primary/20 hover:border-primary/30',
            'btn-press',
            collapsed ? 'justify-center' : 'justify-start'
          )}
          title={collapsed ? (mode === 'dev' ? 'Switch to User Mode' : 'Switch to Dev Mode') : undefined}
        >
          {mode === 'dev' ? (
            <Home className="w-5 h-5 text-primary" />
          ) : (
            <Sparkles className="w-5 h-5 text-primary" />
          )}
          {!collapsed && (
            <span className="text-primary">
              {mode === 'dev' ? 'User Mode' : 'Dev Mode'}
            </span>
          )}
        </button>

        {/* Collapse Toggle - Desktop */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-sm font-mono transition-all duration-200',
            'hover:bg-secondary',
            collapsed ? 'justify-center' : 'justify-start'
          )}
          title={collapsed ? t('expand') : t('collapse')}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 text-foreground-secondary" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 text-foreground-secondary" />
              <span className="text-foreground-secondary">{t('collapse')}</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 glass border-b border-border/50 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className={cn(
            'p-2 rounded-lg ',
            'hover:bg-secondary transition-colors duration-200 cursor-pointer',
            'min-w-[40px] min-h-[40px] flex items-center justify-center',
            'focus:outline-none focus:ring-2 focus:ring-primary/30'
          )}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity "
        >
          <span className="text-xl leading-none animate-candy-float">🍭</span>
          <span className="font-bold text-base font-candy">Candy Shop</span>
        </button>

        <button
          onClick={onOpenCart}
          className="p-2 rounded-lg hover:bg-secondary transition-colors duration-200 relative min-w-[40px] min-h-[40px] flex items-center justify-center "
          aria-label={`Cart (${cartCount} items)`}
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 flex flex-col w-72 glass-strong border-r border-border/50',
          'transform transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2.5 rounded-lg hover:bg-secondary transition-colors duration-200 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="pt-12">
          {sidebarContent}
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-30',
          'glass-strong border-r border-border/50 transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
