import { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { REGISTRY_STATS } from '../../data/skillsData';
import { CRAVINGS_DATA } from '../../data/cravingsData';

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
  const [displayText, setDisplayText] = useState('');

  const fullText = activeTab === 'candy'
    ? t('hero.tagline')
    : 'Post your craving, get your candy';

  useEffect(() => {
    let index = 0;
    setDisplayText('');
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setDisplayText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 45);
    return () => clearInterval(timer);
  }, [fullText, language, activeTab]);

  const urgentCount = useMemo(
    () => CRAVINGS_DATA.filter((c) => c.urgency === 'high' && c.status === 'open').length,
    []
  );

  const tabPill = (active: boolean) =>
    `relative flex items-center gap-2.5 px-6 py-3 rounded-2xl font-body font-bold text-sm ` +
    `transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ` +
    (active
      ? 'bg-candy-gradient text-white candy-gloss shadow-candy-lg'
      : 'text-foreground-secondary hover:text-foreground');

  return (
    <section className="relative pt-12 pb-16 lg:pt-20 lg:pb-24 overflow-hidden">
      {/* Atmosphere: glossy conic candy orb + sugar mesh + grain */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-candy-conic blur-[120px] opacity-25 animate-spin-slow" />
        <div className="absolute inset-0 bg-candy-mesh" />
        <div className="absolute inset-0 candy-grain" />
        <span className="absolute top-20 left-[7%] text-4xl opacity-20 animate-candy-float" style={{ animationDelay: '0s' }}>🍭</span>
        <span className="absolute top-36 right-[11%] text-3xl opacity-[0.16] animate-candy-float" style={{ animationDelay: '1.5s' }}>🍬</span>
        <span className="absolute bottom-16 left-[16%] text-3xl opacity-[0.14] animate-candy-float" style={{ animationDelay: '3s' }}>🧁</span>
        <span className="absolute top-10 right-[26%] text-2xl opacity-[0.10] animate-candy-float" style={{ animationDelay: '2s' }}>🫧</span>
        <span className="absolute bottom-24 right-[8%] text-3xl opacity-[0.12] animate-candy-float" style={{ animationDelay: '4s' }}>🍩</span>
      </div>

      <div className="flex flex-col items-center text-center gap-7 relative">
        {/* Badge — gumdrop */}
        <div className="gumdrop inline-flex items-center gap-2 px-4 py-1.5 text-xs font-mono font-bold">
          <span className="flex h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
          {REGISTRY_STATS.totalSkills.toLocaleString()} Skills · {REGISTRY_STATS.totalRepos.toLocaleString()} Repos · live
        </div>

        {/* Headline — glossy candy gradient with a sheen sweep */}
        <div className="max-w-3xl">
          <h1 className="relative text-5xl sm:text-6xl lg:text-7xl font-candy font-bold tracking-tight leading-[1.05]">
            <span className="bg-candy-gradient bg-clip-text text-transparent">{displayText || ' '}</span>
            <span className="inline-block w-3 h-[0.9em] ml-1 -mb-1 align-middle bg-primary animate-pulse rounded-[3px]" />
            <span className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="absolute inset-y-0 w-1/3 bg-white/30 blur-md animate-sheen" />
            </span>
          </h1>
          <p className="mt-5 text-lg text-foreground-secondary max-w-xl mx-auto leading-relaxed font-body">
            {activeTab === 'candy'
              ? 'Discover AI skills built by the community. Share yours, or tell us what you need.'
              : 'Browse open requests from users. Fulfill a craving, or add your own to the board.'}
          </p>
        </div>

        {/* === TAB SWITCHER — sticker === */}
        <div className="sticker flex items-center gap-1 p-1.5 bg-card !rounded-2xl">
          <button onClick={() => onTabChange('candy')} className={tabPill(activeTab === 'candy')}>
            <span className="text-xl leading-none">🍬</span>
            <span>Find Candy</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'candy' ? 'bg-white/25 text-white' : 'bg-secondary text-foreground-tertiary'}`}>
              {REGISTRY_STATS.totalSkills.toLocaleString()}
            </span>
          </button>
          <button onClick={() => onTabChange('craving')} className={tabPill(activeTab === 'craving')}>
            <span className="text-xl leading-none">😋</span>
            <span>Find Craving</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'craving' ? 'bg-white/25 text-white' : 'bg-secondary text-foreground-tertiary'}`}>
              {OPEN_CRAVINGS}
            </span>
          </button>
        </div>

        {/* Context-aware sub-label */}
        <p className="text-xs font-mono text-foreground-tertiary -mt-3">
          {activeTab === 'candy'
            ? `${REGISTRY_STATS.totalSkills.toLocaleString()} skills · ${REGISTRY_STATS.totalRepos.toLocaleString()} repos · ${(REGISTRY_STATS.totalInstalls / 1e6).toFixed(1)}M total installs`
            : `${OPEN_CRAVINGS} open requests · ${urgentCount} urgent · post candy to fulfill demand`}
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => {
              const id = activeTab === 'candy' ? 'skills-grid' : 'cravings-grid';
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="sticker candy-gloss h-12 px-9 bg-candy-gradient text-white !rounded-2xl font-body font-bold flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {activeTab === 'candy' ? '🍬 Browse Candy' : '😋 Browse Cravings'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onPostCandy}
              className="sticker h-9 px-5 bg-card text-primary !rounded-xl font-body font-bold text-sm flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="w-3.5 h-3.5" />
              Post Candy
            </button>
            <span className="text-foreground-tertiary text-sm font-mono">or</span>
            <button
              onClick={onPostCraving}
              className="sticker h-9 px-5 bg-card text-grape !rounded-xl font-body font-bold text-sm flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="w-3.5 h-3.5" />
              Post Craving
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-5 pt-2 text-sm font-mono">
          <button
            onClick={() => onTabChange('candy')}
            className={`flex items-center gap-2 transition-colors ${activeTab === 'candy' ? 'text-primary' : 'text-foreground-secondary hover:text-foreground'}`}
          >
            <span className="text-base">🍬</span>
            <span className="font-bold">{REGISTRY_STATS.totalSkills.toLocaleString()}</span>
            <span className="text-foreground-tertiary">skills</span>
          </button>
          <span className="w-1.5 h-1.5 rounded-full bg-border" />
          <div className="flex items-center gap-2 text-foreground-secondary">
            <span className="text-base">🏗️</span>
            <span className="font-bold text-foreground">{REGISTRY_STATS.totalRepos.toLocaleString()}</span>
            <span className="text-foreground-tertiary">repos</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-border" />
          <button
            onClick={() => onTabChange('craving')}
            className={`flex items-center gap-2 transition-colors ${activeTab === 'craving' ? 'text-primary' : 'text-foreground-secondary hover:text-foreground'}`}
          >
            <span className="text-base">😋</span>
            <span className="font-bold">{TOTAL_CRAVINGS}</span>
            <span className="text-foreground-tertiary">cravings</span>
          </button>
          <span className="w-1.5 h-1.5 rounded-full bg-border" />
          <div className="flex items-center gap-2 text-foreground-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="font-bold text-foreground">{urgentCount}</span>
            <span className="text-foreground-tertiary">urgent now</span>
          </div>
        </div>
      </div>
    </section>
  );
}
