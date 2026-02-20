import { useState, useEffect, useCallback, useSyncExternalStore, Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { Layout } from './components/layout/Layout';
import { Hero } from './components/home/Hero';
import { SkillsGrid } from './components/home/SkillsGrid';
import { Categories } from './components/home/Categories';
import { ExternalResources } from './components/home/ExternalResources';
import { FAQ } from './components/home/FAQ';
import { AuthModal } from './components/auth/AuthModal';
import { AuthCallback } from './components/auth/AuthCallback';
import { CartDrawer } from './components/common/CartDrawer';
import { DocsModal } from './components/common/DocsModal';
import { SkillCreationPage } from './pages/SkillCreationPage';
import { MySkillsLibrary } from './components/skill-creator/MySkillsLibrary';
import { SkillExecutor } from './components/skill-creator/SkillExecutor';
import type { Skill, SkillCategory } from './types/skill-creator';
import { storageUtils } from './utils/storage';
import { SKILLS_DATA } from './data/skillsData';
import { type Skill as StoreSkill } from './data/skillsData';
import { toast } from 'sonner';
import { LanguageProvider } from './contexts/LanguageContext';
import { VersionModeProvider } from './contexts/VersionModeContext';

// ---------------------------------------------------------------------------
// Error Boundary — prevents blank screen on unhandled errors
// ---------------------------------------------------------------------------
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#0f0b15',
          color: '#f5f0fa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#a097ad', marginBottom: '1.5rem', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = import.meta.env.BASE_URL || '/';
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#e91e8c',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Page title management
// ---------------------------------------------------------------------------
const PAGE_TITLES: Record<string, string> = {
  '/': 'Candy Shop — AI Skills Marketplace',
  '/skills/create': 'Create Skill — Candy Shop',
  '/skills/library': 'My Library — Candy Shop',
  '/auth/callback': 'Signing in... — Candy Shop',
};

function usePageTitle() {
  const location = useLocation();
  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] || 'Candy Shop — AI Skills Marketplace';
    document.title = title;
  }, [location.pathname]);
}

interface HomePageProps {
  user: User | null;
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onOpenAuth: () => void;
  onOpenCart: () => void;
  onOpenDocs: () => void;
  onRunSkill: (skill: StoreSkill) => void;
}

function HomePage({
  user,
  cart,
  onToggleCart,
  onOpenAuth,
  onOpenCart,
  onOpenDocs,
  onRunSkill,
}: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const handleSearchFocus = () => {
    document.getElementById('search-input')?.focus();
    document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCategoryScroll = () => {
    document.getElementById('categories-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Layout
      onOpenAuth={onOpenAuth}
      onOpenCart={onOpenCart}
      user={user}
      cartCount={cart.size}
      onNavFind={handleSearchFocus}
      onNavCd={handleCategoryScroll}
      onNavMan={onOpenDocs}
    >
      <Hero onOpenDocs={onOpenDocs} />
      <Categories
        activeCategory={tagFilter}
        onSelectCategory={(tag: string | null) => {
          setTagFilter(tag);
          setSearchQuery('');
          document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      <SkillsGrid
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        cart={cart}
        onToggleCart={onToggleCart}
        onRunSkill={onRunSkill}
      />
      <ExternalResources />
      <FAQ />
    </Layout>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  usePageTitle(); // Update document.title on route change

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<Set<string>>(() => new Set(storageUtils.getCart()));
  const [executingSkill, setExecutingSkill] = useState<Skill | null>(null);

  // Persist cart to localStorage whenever it changes
  const updateCart = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setCart((prev) => {
      const next = updater(prev);
      storageUtils.saveCart([...next]);
      return next;
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: User } | null } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAddToCart = (id: string) => {
    const skill = SKILLS_DATA.find(s => s.id === id);
    const name = skill?.name || id;
    updateCart((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info(`Removed ${name} from bag`);
      } else {
        next.add(id);
        toast.success(`Added ${name} to bag`);
      }
      return next;
    });
  };

  const handleRemoveFromCart = (id: string) => {
    updateCart((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleClearCart = () => updateCart(() => new Set());

  const handlePurchase = () => {
    // Check if user is logged in
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    // Convert store skills to user skills
    const storeSkills = SKILLS_DATA.filter((skill) => cart.has(skill.id));

    storeSkills.forEach((storeSkill) => {
      // Check if already owned
      const existing = storageUtils
        .getSkills()
        .find((s) => s.name === storeSkill.name && s.origin === 'store');

      if (!existing) {
        storageUtils.saveSkill({
          name: storeSkill.name,
          description: storeSkill.description,
          category: storeSkill.category as SkillCategory,
          icon: storeSkill.icon,
          color: storeSkill.color,
          tags: storeSkill.tags || [storeSkill.category],
          config: {
            capabilities: [],
            systemPrompt: '',
            parameters: storeSkill.config,
            tools: [],
          },
          origin: 'store',
          status: 'active',
          sourceFiles: [],
          installCommand: storeSkill.installCommand,
        });
      }
    });

    updateCart(() => new Set());
    setIsCartOpen(false);
    navigate('/skills/library');
  };

  const handleRunSkill = (storeSkill: StoreSkill) => {
    // Convert store skill to Skill format for executor
    // CRITICAL: skillMdUrl must be passed through so SkillExecutor can
    // fetch the real SKILL.md instructions from GitHub
    const skill: Skill = {
      id: `store-${storeSkill.id}`,
      userId: user?.id || 'anonymous',
      name: storeSkill.name,
      description: storeSkill.description,
      category: storeSkill.category as SkillCategory,
      icon: storeSkill.icon,
      color: storeSkill.color,
      tags: storeSkill.tags || [],
      skillMdUrl: storeSkill.skillMdUrl, // ← Critical: enables SKILL.md fetch
      config: {
        capabilities: [],
        systemPrompt: '',
        parameters: storeSkill.config,
        tools: [],
      },
      sourceFiles: [],
      analysisContext: {
        workDomain: [],
        technicalSkills: [],
        experiencePatterns: [],
        keyTopics: [],
        suggestedName: storeSkill.name,
        suggestedDescription: storeSkill.description,
        suggestedCategory: storeSkill.category as SkillCategory,
        suggestedCapabilities: [],
        filesSummary: [],
        confidence: 0,
        systemPrompt: '',
      },
      installCommand: storeSkill.installCommand,
      popularity: storeSkill.popularity ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      isPublic: true,
      origin: 'store',
    };
    setExecutingSkill(skill);
  };

  const openAuth = useCallback(() => setIsAuthOpen(true), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const openDocs = useCallback(() => setIsDocsOpen(true), []);

  const navToFind = useCallback(() => {
    navigate('/');
    setTimeout(() => {
      document.getElementById('search-input')?.focus();
      document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [navigate]);

  const navToCd = useCallback(() => {
    navigate('/');
    setTimeout(() => {
      document.getElementById('categories-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [navigate]);

  const sharedLayoutProps = {
    onOpenAuth: openAuth,
    onOpenCart: openCart,
    user,
    cartCount: cart.size,
    onNavFind: navToFind,
    onNavCd: navToCd,
    onNavMan: openDocs,
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              user={user}
              cart={cart}
              onToggleCart={handleAddToCart}
              onOpenAuth={openAuth}
              onOpenCart={openCart}
              onOpenDocs={openDocs}
              onRunSkill={handleRunSkill}
            />
          }
        />
        <Route
          path="/skills/create"
          element={
            <Layout {...sharedLayoutProps}>
              <SkillCreationPage
                onComplete={() => {
                  navigate('/skills/library');
                }}
                onCancel={() => navigate('/')}
              />
            </Layout>
          }
        />
        <Route
          path="/skills/library"
          element={
            <Layout {...sharedLayoutProps}>
              <MySkillsLibrary
                onCreateNew={() => navigate('/skills/create')}
                onUseSkill={(skill) => setExecutingSkill(skill)}
                onBack={() => navigate('/')}
              />
            </Layout>
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartIds={cart}
        onRemove={handleRemoveFromCart}
        onClear={handleClearCart}
        onPurchase={handlePurchase}
      />

      <DocsModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />

      {executingSkill && (
        <SkillExecutor skill={executingSkill} onClose={() => setExecutingSkill(null)} />
      )}
    </>
  );
}

// Subscribe to dark mode class changes so Toast theme stays in sync
const subscribeDarkMode = (cb: () => void) => {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const getDarkModeSnapshot = () => document.documentElement.classList.contains('dark');

function ThemedToaster() {
  const isDark = useSyncExternalStore(subscribeDarkMode, getDarkModeSnapshot);
  return (
    <Toaster
      position="bottom-right"
      theme={isDark ? 'dark' : 'light'}
      toastOptions={{
        style: {
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-foreground)',
        },
      }}
    />
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <VersionModeProvider>
          <LanguageProvider>
            <AppContent />
            <ThemedToaster />
          </LanguageProvider>
        </VersionModeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
