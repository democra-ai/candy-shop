import { useEffect, useMemo, useState } from 'react';
import { Plus, Boxes } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { REGISTRY_STATS } from '../../data/skillsData';
import { CRAVINGS_DATA } from '../../data/cravingsData';
import { getFlavor } from '../../utils/candyShells';
import { useIsDark } from '../../hooks/useIsDark';

export type MarketplaceTab = 'candy' | 'craving';

interface HeroProps {
  activeTab: MarketplaceTab;
  onTabChange: (tab: MarketplaceTab) => void;
  onPostCraving: () => void;
  onPostCandy: () => void;
}

const TOTAL_CRAVINGS = CRAVINGS_DATA.length;
const OPEN_CRAVINGS = CRAVINGS_DATA.filter((c) => c.status === 'open').length;

export function Hero({ activeTab, onTabChange, onPostCraving, onPostCandy }: HeroProps) {
  const { t, language } = useLanguage();
  const isDark = useIsDark();

  // Candy emoji for the "Find Candy" tab; lollipop mascot for cravings.
  const raspberry = getFlavor('Development', isDark); // brand flavor tokens
  const blueberry = getFlavor('Research', isDark);    // craving accent (blue family)

  const fullText = activeTab === 'candy'
    ? t('hero.tagline')
    : 'Post your craving, get your candy';

  // ── Typewriter: type the headline character-by-character on mount and on tab change.
  // The h1 reserves min-height to prevent layout shift while typing.
  const [displayText, setDisplayText] = useState('');
  useEffect(() => {
    let i = 0;
    setDisplayText('');
    const t = setInterval(() => {
      if (i <= fullText.length) {
        setDisplayText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(t);
      }
    }, 45);
    return () => clearInterval(t);
  }, [fullText, language, activeTab]);

  const urgentCount = useMemo(
    () => CRAVINGS_DATA.filter((c) => c.urgency === 'high' && c.status === 'open').length,
    []
  );

  const isCandy = activeTab === 'candy';
  const accent = isCandy ? raspberry : blueberry;

  return (
    <section className="relative pt-10 pb-16 lg:pt-16 lg:pb-24 overflow-hidden">
      {/* Background candy sprinkles are provided page-wide by the .sprinkle-pattern
          layer in Layout (capsules + dots), which shows through here. */}

      <div className="flex flex-col items-center text-center gap-8 relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border text-primary text-xs font-mono font-medium shadow-candy-1 dark:shadow-candy-1-dark">
          <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
          {REGISTRY_STATS.totalSkills.toLocaleString()} Skills Indexed · {REGISTRY_STATS.totalRepos.toLocaleString()} Repos
        </div>

        {/* Headline — typewriter effect + subtle same-hue raspberry gradient. min-h reserves
            line height so typing in characters doesn't cause vertical layout shift. */}
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-candy font-bold tracking-tight leading-[1.1] min-h-[1.1em]">
            <span className="candy-gradient-raspberry-subtle">{displayText}</span>
            <span
              className="inline-block w-[0.55rem] h-[1em] ml-1 -mb-1 bg-primary/70 animate-pulse rounded-sm align-baseline"
              aria-hidden="true"
            />
          </h1>
          <p className="mt-5 text-lg text-foreground-secondary max-w-xl mx-auto leading-relaxed font-body">
            {isCandy
              ? 'Discover AI skills built by the community. Share yours, or tell us what you need.'
              : 'Browse open requests from users. Fulfill a craving, or add your own to the board.'}
          </p>
        </div>

        {/* === TAB SWITCHER === */}
        <div className="flex items-center gap-1 p-1.5 bg-card rounded-2xl border border-border shadow-candy-1 dark:shadow-candy-1-dark">
          <button
            onClick={() => onTabChange('candy')}
            className={`
              relative flex items-center gap-2.5 px-6 py-3 rounded-xl font-body font-semibold text-sm
              transition-all duration-200 ease-candy focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              ${isCandy
                ? 'bg-primary text-primary-foreground shadow-candy-1 dark:shadow-candy-1-dark'
                : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/60'}
            `}
          >
            <span className="text-xl leading-none" aria-hidden="true">🍭</span>
            <span>Find Candy</span>
            <span className={`
              text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full
              ${isCandy ? 'bg-white/20 text-white' : 'bg-secondary text-foreground-tertiary'}
            `}>
              {REGISTRY_STATS.totalSkills.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => onTabChange('craving')}
            className={`
              relative flex items-center gap-2.5 px-6 py-3 rounded-xl font-body font-semibold text-sm
              transition-all duration-200 ease-candy focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40
              ${!isCandy
                ? 'text-white shadow-candy-1 dark:shadow-candy-1-dark'
                : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/60'}
            `}
            style={!isCandy ? { backgroundColor: blueberry.base } : undefined}
          >
            <span className="text-xl leading-none" aria-hidden="true">🍬</span>
            <span>Find Craving</span>
            <span className={`
              text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full
              ${!isCandy ? 'bg-white/20 text-white' : 'bg-secondary text-foreground-tertiary'}
            `}>
              {OPEN_CRAVINGS}
            </span>
          </button>
        </div>

        {/* Context-aware sub-label */}
        <p className="text-xs font-mono text-foreground-tertiary -mt-4">
          {isCandy
            ? `${REGISTRY_STATS.totalSkills.toLocaleString()} skills · ${REGISTRY_STATS.totalRepos.toLocaleString()} repos · ${(REGISTRY_STATS.totalInstalls / 1e6).toFixed(1)}M total installs`
            : `${OPEN_CRAVINGS} open requests · ${urgentCount} urgent · post candy to fulfill demand`}
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4">
          {/* Primary pressable "candy button" (DESIGN.md §5). Solid offset bottom
              shadow; :active sinks 2px + shorter shadow. For candy we use the
              shared `.candy-btn` (already brand raspberry via --color-primary);
              for cravings we replicate the press with a blueberry offset shadow. */}
          <button
            onClick={() => {
              const id = isCandy ? 'skills-grid' : 'cravings-grid';
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`h-12 px-8 text-white rounded-2xl font-body font-bold text-[15px] flex items-center gap-2.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:translate-y-[2px] transition-transform duration-100 ${isCandy ? 'candy-btn' : ''}`}
            style={
              isCandy
                ? undefined
                : {
                    backgroundColor: accent.base,
                    boxShadow: `0 4px 0 ${accent.ink}`,
                    ['--tw-ring-color' as string]: accent.base,
                  }
            }
          >
            <span className="text-xl leading-none" aria-hidden="true">{isCandy ? '🍭' : '🍬'}</span>
            {isCandy ? 'Browse Candy' : 'Browse Cravings'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onPostCandy}
              className="h-9 px-5 bg-card border border-border text-primary rounded-xl font-body font-semibold text-sm hover:border-primary/50 hover:shadow-candy-1 dark:hover:shadow-candy-1-dark transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-[0.97] focus:outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              Post Candy
            </button>
            <span className="text-border text-sm">or</span>
            <button
              onClick={onPostCraving}
              className="h-9 px-5 bg-card border border-border rounded-xl font-body font-semibold text-sm hover:shadow-candy-1 dark:hover:shadow-candy-1-dark transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-[0.97] focus:outline-none"
              style={{ color: blueberry.base }}
            >
              <Plus className="w-3.5 h-3.5" />
              Post Craving
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-sm font-mono">
          <button
            onClick={() => onTabChange('candy')}
            className={`flex items-center gap-2 transition-colors ${isCandy ? 'text-primary' : 'text-foreground-secondary hover:text-foreground'}`}
          >
            <span className="text-base leading-none" aria-hidden="true">🍭</span>
            <span className="font-bold">{REGISTRY_STATS.totalSkills.toLocaleString()}</span>
            <span className="text-foreground-tertiary">skills</span>
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-foreground-secondary">
            <Boxes className="w-4 h-4 text-foreground-tertiary" />
            <span className="font-bold text-foreground">{REGISTRY_STATS.totalRepos.toLocaleString()}</span>
            <span className="text-foreground-tertiary">repos</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => onTabChange('craving')}
            className={`flex items-center gap-2 transition-colors ${!isCandy ? 'text-primary' : 'text-foreground-secondary hover:text-foreground'}`}
          >
            <span className="text-base leading-none" aria-hidden="true">🍬</span>
            <span className="font-bold">{TOTAL_CRAVINGS}</span>
            <span className="text-foreground-tertiary">cravings</span>
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-foreground-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-bold text-foreground">{urgentCount}</span>
            <span className="text-foreground-tertiary">urgent now</span>
          </div>
        </div>
      </div>
    </section>
  );
}
