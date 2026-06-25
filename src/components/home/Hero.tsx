import { Search, ArrowRight, Sparkles, Candy, HeartHandshake } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { REGISTRY_STATS } from '../../data/skillsData';
import { CRAVINGS_DATA } from '../../data/cravingsData';
import { getFlavor } from '../../utils/candyShells';
import { useIsDark } from '../../hooks/useIsDark';
import { CandyLogo } from '../common/CandyLogo';

export type MarketplaceTab = 'candy' | 'craving';

interface HeroProps {
  activeTab: MarketplaceTab;
  onTabChange: (tab: MarketplaceTab) => void;
  onPostCraving: () => void;
  onPostCandy: () => void;
  // Search front door. The parent binds these to the ACTIVE side's state
  // (candySearch/setCandySearch for candy, cravingSearch/setCravingSearch for
  // craving) — the SAME useState the grid's sticky search uses, so the hero
  // input and the in-aisle input stay mirror-synced on purpose. Do NOT give the
  // hero its own search state to "de-dupe" them.
  searchValue: string;
  onSearchChange: (q: string) => void;
  // Optional q lets a chip click pass its value directly, dodging setState batching.
  onSearchSubmit: (q?: string) => void;
}

const OPEN_CRAVINGS = CRAVINGS_DATA.filter((c) => c.status === 'open').length;

// Example-query chips — REAL search tokens matched against the catalog, so they
// stay literal (not routed through t(); translating them would break the match).
const CANDY_CHIPS = ['pdf', 'code review', 'n8n', 'browser', 'design'];
const CRAVING_CHIPS = ['automation', 'react', 'seo', 'report'];

export function Hero({
  activeTab,
  onTabChange,
  onPostCraving,
  onPostCandy,
  searchValue,
  onSearchChange,
  onSearchSubmit,
}: HeroProps) {
  const { t } = useLanguage();
  const isDark = useIsDark();
  const isCandy = activeTab === 'candy';
  const raspberry = getFlavor('Development', isDark); // brand flavor tokens
  const blueberry = getFlavor('Research', isDark); // craving accent (blue family)
  const accent = isCandy ? raspberry : blueberry;
  const count = (isCandy ? REGISTRY_STATS.totalSkills : OPEN_CRAVINGS).toLocaleString();
  const chips = isCandy ? CANDY_CHIPS : CRAVING_CHIPS;
  const submit = (q?: string) => onSearchSubmit(q ?? searchValue);

  return (
    <section className="relative pt-10 pb-16 lg:pt-14 lg:pb-24 overflow-hidden">
      {/* Page-wide .sprinkle-pattern from Layout shows through here. */}
      <div className="flex flex-col items-center text-center gap-6 relative">
        {/* 1. Glossy jelly "Candy" wordmark — drei MeshTransmissionMaterial on a
            runtime Text3D. KEPT verbatim (perf-throttled; centered flat fallback
            below 639px is load-bearing for mobile). Candy tab only. */}
        {isCandy && (
          <div
            className="w-full flex justify-center select-none -mb-2 sm:-mb-4 px-4"
            aria-hidden="true"
          >
            <CandyLogo
              text="Candy"
              width="min(640px, 100%)"
              height="clamp(120px, 34vw, 220px)"
              size={1}
              zoom={2.7}
              hideWebGLBelow="(max-width: 639px)"
              fallbackClassName="font-candy font-bold text-6xl sm:text-7xl text-primary justify-center"
            />
          </div>
        )}

        {/* 2. One-line value prop + short sub (replaces the old typewriter h1). */}
        <div className="max-w-2xl w-full px-2">
          <h1 className="text-2xl sm:text-3xl lg:text-[38px] font-candy font-bold tracking-tight leading-[1.1] text-balance">
            <span
              className={isCandy ? 'candy-gradient-raspberry-subtle' : ''}
              style={isCandy ? undefined : { color: blueberry.ink }}
            >
              {t(isCandy ? 'hero.searchTitle.candy' : 'hero.searchTitle.craving')}
            </span>
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-foreground-secondary max-w-xl mx-auto font-body">
            {t(isCandy ? 'hero.searchSub.candy' : 'hero.searchSub.craving')}
          </p>
        </div>

        {/* 3. SEARCH CARD — the one loud surface on the page (one-accent rule). */}
        <div className="w-full max-w-2xl flex flex-col items-stretch gap-3 p-4 sm:p-5 bg-card border border-border rounded-3xl shadow-candy-2 dark:shadow-candy-2-dark">
          {/* 3a. Segmented toggle — keeps the two-sided jar model; scopes search
              to whichever side is active (the parent binds the active state). */}
          <div
            role="tablist"
            aria-label={t('hero.tab.candy') + ' / ' + t('hero.tab.craving')}
            className="inline-flex self-center items-center gap-1 p-1 bg-secondary/60 rounded-full border border-border"
          >
            {([
              ['candy', t('hero.tab.candy'), Candy, REGISTRY_STATS.totalSkills],
              ['craving', t('hero.tab.craving'), HeartHandshake, OPEN_CRAVINGS],
            ] as const).map(([id, label, Icon, n]) => {
              const on = activeTab === id;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => onTabChange(id)}
                  className={`flex items-center gap-2 h-9 px-4 rounded-full font-body font-semibold text-sm transition-all duration-200 ease-candy focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    on ? 'text-white shadow-candy-1' : 'text-foreground-secondary hover:text-foreground'
                  }`}
                  style={on ? { backgroundColor: (id === 'candy' ? raspberry : blueberry).base } : undefined}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{label}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                      on ? 'bg-white/20 text-white' : 'bg-secondary text-foreground-tertiary'
                    }`}
                  >
                    {n.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3b. The big input + pressable submit — THE one accent. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="relative flex items-center h-14 bg-background border border-border rounded-2xl transition-all focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/40"
          >
            <Search
              className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-tertiary pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t(isCandy ? 'hero.searchPlaceholder.candy' : 'hero.searchPlaceholder.craving')}
              aria-label={t(isCandy ? 'hero.searchPlaceholder.candy' : 'hero.searchPlaceholder.craving')}
              className="flex-1 h-full bg-transparent pl-14 pr-2 font-mono text-base text-foreground placeholder:text-foreground-tertiary placeholder:text-sm focus:outline-none"
            />
            <button
              type="submit"
              aria-label={t('hero.searchCta')}
              className={`mr-2 h-10 px-3 sm:px-4 flex items-center gap-2 text-white rounded-xl font-body font-bold text-sm cursor-pointer motion-safe:active:translate-y-[2px] transition-transform duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isCandy ? 'candy-btn' : ''
              }`}
              style={
                isCandy
                  ? undefined
                  : { backgroundColor: accent.base, boxShadow: `0 3px 0 ${accent.ink}`, ['--tw-ring-color' as string]: accent.base }
              }
            >
              <Search className="w-4 h-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('hero.searchCta')}</span>
              <ArrowRight className="w-4 h-4 hidden sm:inline" aria-hidden="true" />
            </button>
          </form>

          {/* 3c. Example query chips — teach discoverability; one tap = results. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-mono text-foreground-tertiary mr-1">{t('hero.tryLabel')}</span>
            {chips.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  onSearchChange(q);
                  submit(q);
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full font-mono text-xs bg-secondary/60 border border-transparent text-foreground-secondary hover:text-foreground hover:border-primary/50 transition-all duration-200 ease-candy"
              >
                <Sparkles className="w-3 h-3" style={{ color: accent.base }} aria-hidden="true" />
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* 4. The ONE surviving stat line — catalog total, not a live filtered count. */}
        <p className="text-xs font-mono text-foreground-tertiary">
          {t(isCandy ? 'hero.countHint.candy' : 'hero.countHint.craving', { count })}
        </p>

        {/* 5. Demoted post entry points — quiet text links, not loud candy buttons
            (capability also lives in the grid sticky header + the nav). */}
        <p className="text-sm font-body text-foreground-secondary">
          {t('hero.postPrompt')}{' '}
          <button onClick={onPostCandy} className="font-semibold text-primary hover:underline">
            {t('hero.postCandy')}
          </button>
          <span className="text-border mx-1.5">·</span>
          <button onClick={onPostCraving} className="font-semibold hover:underline" style={{ color: blueberry.base }}>
            {t('hero.postCraving')}
          </button>
        </p>
      </div>
    </section>
  );
}
