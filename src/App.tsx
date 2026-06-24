import { useState, useEffect, useCallback, useSyncExternalStore, Component, Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import type { User } from './lib/supabaseAuth';
import { supabaseAuth } from './lib/supabaseAuth';
import { Layout } from './components/layout/Layout';
import { Hero, type MarketplaceTab } from './components/home/Hero';
import { SkillsGrid } from './components/home/SkillsGrid';
import { CravingsGrid } from './components/home/CravingsGrid';
import { PostCravingModal } from './components/home/PostCravingModal';
import { PostCandyModal } from './components/home/PostCandyModal';
import { Categories } from './components/home/Categories';
import { ExternalResources } from './components/home/ExternalResources';
import { FAQ } from './components/home/FAQ';
import { MostPopularRail } from './components/home/MostPopularRail';
// EditorPicks intentionally not mounted — its content now lives in the bento Hero
// (featured raspberry cell) and Aisle 1 (MostPopularRail).
import { AuthModal } from './components/auth/AuthModal';
import { AuthCallback } from './components/auth/AuthCallback';
import { CartDrawer } from './components/common/CartDrawer';
import { DocsModal } from './components/common/DocsModal';
import { SkillCreationPage } from './pages/SkillCreationPage';
import { MySkillsLibrary } from './components/skill-creator/MySkillsLibrary';
// SkillExecutor is lazy-loaded so that @opencode-ai/sdk (which ships with a
// default client pointing at http://localhost:4096) is not pulled into the
// initial bundle. That default singleton, when present at page load,
// causes Safari to prompt for Local Network Access permission even on
// visitors who never run a skill. See commit history for full diagnosis.
const SkillExecutor = lazy(() =>
  import('./components/skill-creator/SkillExecutor').then(m => ({ default: m.SkillExecutor }))
);
import { SkillDetailPage } from './pages/SkillDetailPage';
import { CravingDetailPage } from './pages/CravingDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import type { Skill, SkillCategory } from './types/skill-creator';
import { storageUtils } from './utils/storage';
import { SKILLS_DATA } from './data/skillsData';
import { type Skill as StoreSkill } from './data/skillsData';
import type { Craving } from './data/cravingsData';
import { LanguageProvider } from './contexts/LanguageContext';
import { useRealtimeNotifications } from './hooks/api/useRealtimeSkills';
import { usePayment } from './hooks/usePayment';
import { usePaymentRedirect } from './hooks/usePaymentRedirect';

// Cross-surface cart sync signal. Any code that writes the cart to localStorage
// directly (e.g. SkillModal's "Add to bag" fallback when no onToggleCart is
// wired) dispatches this event so the reactive `cart` state — and therefore the
// header badge + Your Bag drawer — update immediately, without a page reload.
export const CART_EVENT = 'candyshop:cart-changed';

// The set of mutually-exclusive overlays. Exactly one (or none) is open at a
// time — see the overlay coordinator in AppContent. Centralizing this prevents
// the modal/drawer stacking the audit flagged (Post Candy + Login + Cart all
// open at once).
export type OverlayKind = 'auth' | 'cart' | 'docs' | 'post-candy' | 'post-craving' | null;

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
  '/run': 'Running Skill — Candy Shop',
  '/dashboard': 'Dashboard — Candy Shop',
  '/settings': 'Settings — Candy Shop',
  '/auth/callback': 'Signing in... — Candy Shop',
};

function usePageTitle() {
  const location = useLocation();
  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] || 'Candy Shop — AI Skills Marketplace';
    document.title = title;
  }, [location.pathname]);
}

// ---------------------------------------------------------------------------
// Home Page (original two-sided marketplace)
// ---------------------------------------------------------------------------
interface HomePageProps {
  user: User | null;
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onOpenAuth: () => void;
  onOpenCart: () => void;
  onOpenDocs: () => void;
  onRunSkill: (skill: StoreSkill) => void;
  onNavCandy: () => void;
  onNavCraving: () => void;
  /** Which overlay (if any) the single coordinator currently has open. */
  overlay: OverlayKind;
  /** Open the Post-Candy modal through the shared coordinator. */
  onOpenPostCandy: () => void;
  /** Open the Post-Craving modal through the shared coordinator. */
  onOpenPostCraving: () => void;
  /** Close whatever overlay is open. */
  onCloseOverlay: () => void;
}

function HomePage({
  user,
  cart,
  onToggleCart,
  onOpenAuth,
  onOpenCart,
  onOpenDocs,
  onRunSkill,
  onNavCandy,
  onNavCraving,
  overlay,
  onOpenPostCandy,
  onOpenPostCraving,
  onCloseOverlay,
}: HomePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: MarketplaceTab = rawTab === 'craving' ? 'craving' : 'candy';

  // Post-Candy / Post-Craving open-ness is owned by the single overlay
  // coordinator in AppContent (so they can never stack with auth / cart /
  // docs). HomePage just reflects that shared value.
  const isPostCravingOpen = overlay === 'post-craving';
  const isPostCandyOpen = overlay === 'post-candy';

  const [candySearch, setCandySearch] = useState('');
  const [candyTagFilter, setCandyTagFilter] = useState<string | null>(null);
  const [cravingSearch, setCravingSearch] = useState('');
  const [cravingTagFilter, setCravingTagFilter] = useState<string | null>(null);

  const [userCravings, setUserCravings] = useState<Craving[]>(() => storageUtils.getUserCravings());
  const [userCandies, setUserCandies] = useState<StoreSkill[]>(() => storageUtils.getUserCandies());

  const setActiveTab = (tab: MarketplaceTab) => {
    setSearchParams(
      tab === 'craving' ? { tab: 'craving' } : {},
      // Switching tab is a within-page filter, not a new destination — replace
      // the entry so it never adds to the browser history stack.
      { replace: true },
    );
    setTimeout(() => {
      const id = tab === 'craving' ? 'cravings-grid' : 'skills-grid';
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleMatchCandy = (tags: string[]) => {
    setCandyTagFilter(tags[0] ?? null);
    setCandySearch('');
    setActiveTab('candy');
  };

  const handleMatchCraving = (tags: string[]) => {
    setCravingTagFilter(tags[0] ?? null);
    setCravingSearch('');
    setActiveTab('craving');
  };

  const handleCategoryScroll = () => {
    document.getElementById('categories-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOpenPostCraving = () => {
    setActiveTab('craving');
    setTimeout(() => onOpenPostCraving(), 100);
  };

  const handleOpenPostCandy = () => {
    setActiveTab('candy');
    setTimeout(() => onOpenPostCandy(), 100);
  };

  const handleSubmitCraving = (craving: Craving) => {
    storageUtils.saveUserCraving(craving);
    setUserCravings(storageUtils.getUserCravings());
    toast.success(`Craving "${craving.title}" posted! Agents will find you.`);
  };

  const handleSubmitCandy = (candy: StoreSkill) => {
    storageUtils.saveUserCandy(candy);
    setUserCandies(storageUtils.getUserCandies());
    toast.success(`Candy "${candy.name}" is live in the marketplace!`);
  };

  return (
    <>
      <Layout
        onOpenAuth={onOpenAuth}
        onOpenCart={onOpenCart}
        user={user}
        cartCount={cart.size}
        onNavFind={() => setActiveTab('candy')}
        onNavCd={handleCategoryScroll}
        onNavMan={onOpenDocs}
        onNavCandy={onNavCandy}
        onNavCraving={onNavCraving}
        onNavPostCraving={handleOpenPostCraving}
        onNavPostCandy={handleOpenPostCandy}
      >
        <Hero
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onPostCraving={handleOpenPostCraving}
          onPostCandy={handleOpenPostCandy}
        />

        {activeTab === 'candy' && (
          <>
            <MostPopularRail onRunSkill={onRunSkill} />
            <Categories
              activeCategory={candyTagFilter}
              onSelectCategory={(tag: string | null) => {
                setCandyTagFilter(tag);
                setCandySearch('');
                document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <SkillsGrid
              searchQuery={candySearch}
              setSearchQuery={setCandySearch}
              tagFilter={candyTagFilter}
              setTagFilter={setCandyTagFilter}
              cart={cart}
              onToggleCart={onToggleCart}
              onRunSkill={onRunSkill}
              onMatchCraving={handleMatchCraving}
              userCandies={userCandies}
              onPostCandy={handleOpenPostCandy}
              onPostCraving={handleOpenPostCraving}
            />
            <ExternalResources />
            <FAQ />
          </>
        )}

        {activeTab === 'craving' && (
          <CravingsGrid
            searchQuery={cravingSearch}
            setSearchQuery={setCravingSearch}
            tagFilter={cravingTagFilter}
            setTagFilter={setCravingTagFilter}
            onMatchCandy={handleMatchCandy}
            onPostCraving={handleOpenPostCraving}
            onPostCandy={handleOpenPostCandy}
            userCravings={userCravings}
          />
        )}
      </Layout>

      <PostCravingModal
        isOpen={isPostCravingOpen}
        onClose={onCloseOverlay}
        onSubmit={handleSubmitCraving}
      />
      <PostCandyModal
        isOpen={isPostCandyOpen}
        onClose={onCloseOverlay}
        onSubmit={handleSubmitCandy}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// App Content
// ---------------------------------------------------------------------------
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  usePageTitle();
  useRealtimeNotifications();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // ── Single overlay coordinator ──────────────────────────────────────────
  // Exactly ONE overlay (auth / cart / docs / post-candy / post-craving) may be
  // open at a time. Opening any overlay implicitly closes whatever was open, so
  // modals + drawers can never stack. Every overlay reads its open-ness from
  // this one value and closes by setting it back to null.
  const [overlay, setOverlay] = useState<OverlayKind>(null);
  const isAuthOpen = overlay === 'auth';
  const isCartOpen = overlay === 'cart';
  const isDocsOpen = overlay === 'docs';
  const closeOverlay = useCallback(() => setOverlay(null), []);

  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<Set<string>>(() => new Set(storageUtils.getCart()));
  const [executingSkill, setExecutingSkill] = useState<Skill | null>(null);

  // Payment integration
  const payment = usePayment(user?.id);

  const updateCart = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setCart((prev) => {
      const next = updater(prev);
      storageUtils.saveCart([...next]);
      return next;
    });
    // Broadcast (outside the updater so it isn't double-fired in StrictMode) so
    // any other surface that read the cart directly — e.g. an open SkillModal's
    // "In bag" toggle — re-syncs from localStorage. The rehydrate it triggers is
    // idempotent against the state we just set.
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  }, []);

  // Re-hydrate the reactive cart whenever ANY surface mutates localStorage —
  // the SkillModal "Add to bag" fallback (no onToggleCart wired), another tab,
  // or our own updateCart broadcast. Without this, adds made through the modal
  // only appeared after a full reload (the badge + drawer read App's `cart`).
  useEffect(() => {
    const rehydrate = () => setCart(new Set(storageUtils.getCart()));
    window.addEventListener(CART_EVENT, rehydrate);
    window.addEventListener('storage', rehydrate);
    return () => {
      window.removeEventListener(CART_EVENT, rehydrate);
      window.removeEventListener('storage', rehydrate);
    };
  }, []);

  // Handle Stripe redirect back: verify session, install skills, clear cart.
  usePaymentRedirect({
    payment,
    onClearCart: () => updateCart(() => new Set()),
  });

  useEffect(() => {
    // Identity comes from the REAL Supabase client now. Data still flows
    // through the worker shim (`supabase`) elsewhere in the app.
    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
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

  const handlePurchase = async () => {
    if (!user) {
      setOverlay('auth');
      return;
    }

    const storeSkills = SKILLS_DATA.filter((skill) => cart.has(skill.id));
    const paidSkills = storeSkills.filter(s => s.price && s.price > 0);
    const freeSkills = storeSkills.filter(s => !s.price || s.price === 0);

    // Install free skills immediately
    const installFreeSkills = () => {
      freeSkills.forEach((storeSkill) => {
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
    };

    if (paidSkills.length > 0 && payment.providers.stripe) {
      // Route paid skills through Stripe checkout
      const result = await payment.startCheckout(paidSkills.map(s => s.id));
      if (result && 'free' in result && result.free) {
        // Server says these are actually free
        installFreeSkills();
        updateCart(() => new Set());
        setOverlay(null);
        navigate('/skills/library');
      }
      // If checkout URL was returned, user is redirected to Stripe.
      // Free skills are installed immediately; paid skills unlock after webhook.
      installFreeSkills();
      // Remove only free skills from cart; paid ones stay until payment completes
      if (freeSkills.length > 0) {
        updateCart((prev) => {
          const next = new Set(prev);
          freeSkills.forEach(s => next.delete(s.id));
          return next;
        });
      }
    } else {
      // No paid skills or Stripe not available — install everything locally
      installFreeSkills();
      // Also install paid skills locally (demo mode without payment server)
      paidSkills.forEach((storeSkill) => {
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
      setOverlay(null);
      navigate('/skills/library');
      if (paidSkills.length > 0) {
        toast.info('Payment server not connected — skills installed in demo mode');
      }
    }
  };

  const handleRunSkill = (storeSkill: StoreSkill) => {
    // Always launch the EXACT skill the user opened. Re-resolve the canonical
    // catalog entry by id so a stale/partial object handed in by any caller can
    // never run a different skill in /run (the cause of "Run React Best
    // Practices → Find Skills loads"). User-posted candies aren't in the catalog,
    // so we fall back to the passed object for them.
    const source = SKILLS_DATA.find((s) => s.id === storeSkill.id) ?? storeSkill;
    const skill: Skill = {
      id: `store-${source.id}`,
      userId: user?.id || 'anonymous',
      name: source.name,
      description: source.description,
      category: source.category as SkillCategory,
      icon: source.icon,
      color: source.color,
      tags: source.tags || [],
      skillMdUrl: source.skillMdUrl,
      format: source.format,
      artifactUrl: source.artifactUrl,
      config: {
        capabilities: [],
        systemPrompt: '',
        parameters: source.config,
        tools: [],
      },
      sourceFiles: [],
      analysisContext: {
        workDomain: [],
        technicalSkills: [],
        experiencePatterns: [],
        keyTopics: [],
        suggestedName: source.name,
        suggestedDescription: source.description,
        suggestedCategory: source.category as SkillCategory,
        suggestedCapabilities: [],
        filesSummary: [],
        confidence: 0,
        systemPrompt: '',
      },
      installCommand: source.installCommand,
      popularity: source.popularity ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      isPublic: true,
      origin: 'store',
    };
    setExecutingSkill(skill);
    navigate('/run');
  };

  const openAuth = useCallback(() => setOverlay('auth'), []);
  const openCart = useCallback(() => setOverlay('cart'), []);
  const openDocs = useCallback(() => setOverlay('docs'), []);
  const openPostCandy = useCallback(() => setOverlay('post-candy'), []);
  const openPostCraving = useCallback(() => setOverlay('post-craving'), []);

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

  const navToCandy = useCallback(() => {
    // Go home and reveal the candy grid. Scrolling makes the action visibly
    // responsive even when we're already on "/" (where navigate('/') alone is a
    // no-op — the cause of the "Find Candy does nothing" report).
    navigate('/');
    setTimeout(() => {
      document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [navigate]);

  const navToCraving = useCallback(() => {
    navigate('/?tab=craving');
    setTimeout(() => {
      document.getElementById('cravings-grid')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [navigate]);

  // Sidebar "Post a Craving" / "Post a Candy" from a NON-home route: go home,
  // then open the matching modal through the shared overlay coordinator. (These
  // were previously no-op navigations — and swapped — so the buttons appeared
  // dead off the home page.)
  const navToPostCraving = useCallback(() => {
    navigate('/?tab=craving');
    setTimeout(() => setOverlay('post-craving'), 120);
  }, [navigate]);

  const navToPostCandy = useCallback(() => {
    navigate('/');
    setTimeout(() => setOverlay('post-candy'), 120);
  }, [navigate]);

  const sharedLayoutProps = {
    onOpenAuth: openAuth,
    onOpenCart: openCart,
    user,
    cartCount: cart.size,
    onNavFind: navToFind,
    onNavCd: navToCd,
    onNavMan: openDocs,
    onNavCandy: navToCandy,
    onNavCraving: navToCraving,
    onNavPostCraving: navToPostCraving,
    onNavPostCandy: navToPostCandy,
  };

  return (
    <>
      <Routes>
        {/* Home — original two-sided marketplace */}
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
              onNavCandy={navToCandy}
              onNavCraving={navToCraving}
              overlay={overlay}
              onOpenPostCandy={openPostCandy}
              onOpenPostCraving={openPostCraving}
              onCloseOverlay={closeOverlay}
            />
          }
        />

        {/* Skill Detail — new page with stars/ratings */}
        <Route
          path="/candy/:id"
          element={
            <Layout {...sharedLayoutProps}>
              <SkillDetailPage
                cart={cart}
                onToggleCart={handleAddToCart}
                onRunSkill={handleRunSkill}
                userId={user?.id}
              />
            </Layout>
          }
        />

        {/* Craving Detail — new page */}
        <Route
          path="/craving/:id"
          element={
            <Layout {...sharedLayoutProps}>
              <CravingDetailPage />
            </Layout>
          }
        />

        {/* Dashboard — new page */}
        <Route
          path="/dashboard"
          element={
            <Layout {...sharedLayoutProps}>
              <DashboardPage user={user} onOpenAuth={openAuth} />
            </Layout>
          }
        />

        {/* Settings — new page */}
        <Route
          path="/settings"
          element={
            <Layout {...sharedLayoutProps}>
              <SettingsPage />
            </Layout>
          }
        />

        {/* Skill Creation */}
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

        {/* My Library */}
        <Route
          path="/skills/library"
          element={
            <Layout {...sharedLayoutProps}>
              <MySkillsLibrary
                onCreateNew={() => navigate('/skills/create')}
                onUseSkill={(skill) => { setExecutingSkill(skill); navigate('/run'); }}
                onBack={() => navigate('/')}
              />
            </Layout>
          }
        />

        {/* Skill Run — full-page agent executor (not a modal, not wrapped in
            the marketing Layout). Runs are live SSE streams, so this route is
            not deep-linkable: a direct visit / refresh with no active skill
            bounces home. */}
        <Route
          path="/run"
          element={
            executingSkill ? (
              <Suspense fallback={null}>
                <SkillExecutor
                  skill={executingSkill}
                  userId={user?.id}
                  onRequireAuth={() => setOverlay('auth')}
                  onPurchase={(skillId) => payment.startCheckout([skillId])}
                  onClose={() => {
                    setExecutingSkill(null);
                    navigate('/');
                  }}
                />
              </Suspense>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AuthModal isOpen={isAuthOpen} onClose={closeOverlay} />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={closeOverlay}
        cartIds={cart}
        onRemove={handleRemoveFromCart}
        onClear={handleClearCart}
        onPurchase={handlePurchase}
        paymentLoading={payment.loading}
        stripeAvailable={payment.providers.stripe}
      />

      <DocsModal isOpen={isDocsOpen} onClose={closeOverlay} />
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
  const Router = BrowserRouter;
  const routerProps = { basename: import.meta.env.BASE_URL };

  return (
    <ErrorBoundary>
      <Router {...routerProps}>
        <LanguageProvider>
          <AppContent />
          <ThemedToaster />
        </LanguageProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
