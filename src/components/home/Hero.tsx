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

  return (
    <section className="relative pt-10 pb-16 lg:pt-16 lg:pb-24 overflow-hidden">
      {/* Floating candy decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <span className="absolute top-16 left-[8%] text-3xl opacity-[0.12] animate-candy-float" style={{ animationDelay: '0s' }}>🍭</span>
        <span className="absolute top-32 right-[12%] text-2xl opacity-[0.10] animate-candy-float" style={{ animationDelay: '1.5s' }}>🍬</span>
        <span className="absolute bottom-16 left-[18%] text-2xl opacity-[0.10] animate-candy-float" style={{ animationDelay: '3s' }}>🧁</span>
        <span className="absolute top-8 right-[28%] text-xl opacity-[0.07] animate-candy-float" style={{ animationDelay: '2s' }}>🍫</span>
        <span className="absolute bottom-24 right-[8%] text-2xl opacity-[0.07] animate-candy-float" style={{ animationDelay: '4s' }}>🍰</span>
      </div>

      <div className="flex flex-col items-center text-center gap-8 relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-primary/20 text-primary text-xs font-mono font-medium shadow-candy">
          <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          {REGISTRY_STATS.totalSkills.toLocaleString()} Skills Indexed · {REGISTRY_STATS.totalRepos.toLocaleString()} Repos
        </div>

        {/* Headline */}
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-candy font-bold tracking-tight leading-[1.1]">
            <span className="candy-gradient-raspberry-gold">{displayText}</span>
            <span className="inline-block w-3 h-10 ml-1 -mb-1 bg-primary/70 animate-pulse rounded-sm" />
          </h1>
          <p className="mt-5 text-lg text-foreground-secondary max-w-xl mx-auto leading-relaxed font-body">
            {activeTab === 'candy'
              ? 'Discover AI skills built by the community. Share yours, or tell us what you need.'
              : 'Browse open requests from users. Fulfill a craving, or add your own to the board.'}
          </p>
        </div>

        {/* === TAB SWITCHER === */}
        <div className="flex items-center gap-1 p-1.5 glass rounded-2xl border border-border/50 shadow-warm">
          <button
            onClick={() => onTabChange('candy')}
            className={`
              relative flex items-center gap-2.5 px-6 py-3 rounded-xl font-body font-semibold text-sm
              transition-all duration-300 btn-press focus:outline-none focus:ring-2 focus:ring-rose-500/30
              ${activeTab === 'candy'
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_4px_20px_rgba(244,63,94,0.35)]'
                : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/50'}
            `}
          >
            <span className="text-xl leading-none">🍬</span>
            <span>Find Candy</span>
            <span className={`
              text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full
              ${activeTab === 'candy' ? 'bg-white/20 text-white' : 'bg-secondary text-foreground-tertiary'}
            `}>
              {REGISTRY_STATS.totalSkills.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => onTabChange('craving')}
            className={`
              relative flex items-center gap-2.5 px-6 py-3 rounded-xl font-body font-semibold text-sm
              transition-all duration-300 btn-press focus:outline-none focus:ring-2 focus:ring-blue-500/30
              ${activeTab === 'craving'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_4px_20px_rgba(59,130,246,0.35)]'
                : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/50'}
            `}
          >
            <span className="text-xl leading-none">😋</span>
            <span>Find Craving</span>
            <span className={`
              text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full
              ${activeTab === 'craving' ? 'bg-white/20 text-white' : 'bg-secondary text-foreground-tertiary'}
            `}>
              {OPEN_CRAVINGS}
            </span>
          </button>
        </div>

        {/* Context-aware sub-label */}
        <p className="text-xs font-mono text-foreground-tertiary -mt-4">
          {activeTab === 'candy'
            ? `${REGISTRY_STATS.totalSkills.toLocaleString()} skills · ${REGISTRY_STATS.totalRepos.toLocaleString()} repos · ${(REGISTRY_STATS.totalInstalls / 1e6).toFixed(1)}M total installs`
            : `${OPEN_CRAVINGS} open requests · ${urgentCount} urgent · post candy to fulfill demand`}
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => {
              const id = activeTab === 'candy' ? 'skills-grid' : 'cravings-grid';
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`h-11 px-8 text-white rounded-xl font-body font-semibold transition-all duration-300 flex items-center gap-2 cursor-pointer btn-press focus:outline-none ${
              activeTab === 'candy'
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_4px_20px_rgba(244,63,94,0.35)] hover:shadow-[0_6px_28px_rgba(244,63,94,0.45)]'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_4px_20px_rgba(59,130,246,0.35)] hover:shadow-[0_6px_28px_rgba(59,130,246,0.45)]'
            }`}
          >
            {activeTab === 'candy' ? '🍬 Browse Candy' : '😋 Browse Cravings'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onPostCandy}
              className="h-9 px-5 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-xl font-body font-semibold text-sm hover:bg-rose-500/20 hover:border-rose-500/50 transition-all duration-200 flex items-center gap-1.5 cursor-pointer btn-press focus:outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              Post Candy
            </button>
            <span className="text-border text-sm">or</span>
            <button
              onClick={onPostCraving}
              className="h-9 px-5 bg-blue-500/10 border border-blue-500/30 text-blue-500 rounded-xl font-body font-semibold text-sm hover:bg-blue-500/20 hover:border-blue-500/50 transition-all duration-200 flex items-center gap-1.5 cursor-pointer btn-press focus:outline-none"
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
            className={`flex items-center gap-2 transition-colors ${activeTab === 'candy' ? 'text-primary' : 'text-foreground-secondary hover:text-foreground'}`}
          >
            <span className="text-base">🍬</span>
            <span className="font-bold">{REGISTRY_STATS.totalSkills.toLocaleString()}</span>
            <span className="text-foreground-tertiary">skills</span>
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-foreground-secondary">
            <span className="text-base">🏗️</span>
            <span className="font-bold text-foreground">{REGISTRY_STATS.totalRepos.toLocaleString()}</span>
            <span className="text-foreground-tertiary">repos</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => onTabChange('craving')}
            className={`flex items-center gap-2 transition-colors ${activeTab === 'craving' ? 'text-primary' : 'text-foreground-secondary hover:text-foreground'}`}
          >
            <span className="text-base">😋</span>
            <span className="font-bold">{TOTAL_CRAVINGS}</span>
            <span className="text-foreground-tertiary">cravings</span>
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-foreground-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-foreground">{urgentCount}</span>
            <span className="text-foreground-tertiary">urgent now</span>
          </div>
        </div>
      </div>
    </section>
  );
}
