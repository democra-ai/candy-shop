import { Search, FileText, Code2, TrendingUp, Candy, Package } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { SKILLS_DATA, SKILL_CATEGORIES } from '../../data/skillsData';

interface HeroProps {
  onOpenDocs: () => void;
}

const TOTAL_SKILLS = SKILLS_DATA.length;
const TOTAL_CATEGORIES = SKILL_CATEGORIES.length;

export function Hero({ onOpenDocs }: HeroProps) {
  const { t, language } = useLanguage();
  const [displayText, setDisplayText] = useState('');
  const fullText = t('hero.tagline');

  const chartData = useMemo(() => {
    const counts = SKILL_CATEGORIES.map(cat => ({
      name: cat.name,
      count: SKILLS_DATA.filter(s => s.category === cat.name).length,
    }));
    const maxCount = Math.max(...counts.map(c => c.count));
    return counts.map(c => ({
      name: c.name,
      pct: maxCount > 0 ? Math.max(10, (c.count / maxCount) * 100) : 10,
    }));
  }, []);

  useEffect(() => {
    let index = 0;
    const typingSpeed = 50;

    setDisplayText('');

    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setDisplayText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, typingSpeed);

    return () => clearInterval(timer);
  }, [fullText, language]);

  return (
    <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-32 overflow-hidden">
      {/* Floating candy decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <span className="absolute top-20 left-[10%] text-3xl opacity-[0.15] animate-candy-float" style={{ animationDelay: '0s' }}>🍭</span>
        <span className="absolute top-40 right-[15%] text-2xl opacity-[0.12] animate-candy-float" style={{ animationDelay: '1.5s' }}>🍭</span>
        <span className="absolute bottom-20 left-[20%] text-2xl opacity-[0.12] animate-candy-float" style={{ animationDelay: '3s' }}>🍭</span>
        <span className="absolute top-10 right-[30%] text-xl opacity-[0.08] animate-candy-float" style={{ animationDelay: '2s' }}>🍭</span>
        <span className="absolute bottom-32 right-[10%] text-2xl opacity-[0.08] animate-candy-float" style={{ animationDelay: '4s' }}>🍭</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center relative">
        {/* Left Content */}
        <div className="flex flex-col items-start space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-primary/20 text-primary text-xs font-mono font-medium shadow-candy">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
            v2.0.0
          </div>

          <div className="relative">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-candy font-bold tracking-tight leading-[1.1]">
              <span className="candy-gradient-raspberry-gold">{displayText}</span>
              <span className="inline-block w-3 h-10 ml-1 -mb-1 bg-primary/70 animate-pulse rounded-sm"></span>
            </h1>
            <p className="mt-4 text-xl text-foreground-secondary font-mono">
              <span className="text-primary">{'>'} npm install intelligence</span>
            </p>
          </div>

          <p className="text-lg text-foreground-secondary max-w-lg leading-relaxed font-body">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() =>
                document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="h-12 px-7 bg-gradient-to-r from-primary to-primary-hover text-primary-foreground rounded-xl font-body font-semibold hover:shadow-candy-lg transition-all duration-300 flex items-center gap-2 shadow-candy cursor-pointer btn-press focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <Search className="w-4 h-4" />
              {t('hero.browseSkills')}
            </button>
            <button
              onClick={onOpenDocs}
              className="h-12 px-7 glass border border-border/50 text-foreground rounded-xl font-body font-semibold hover:border-primary/30 hover:shadow-warm-lg transition-all duration-300 flex items-center gap-2 cursor-pointer btn-press focus:outline-none focus:ring-2 focus:ring-border"
            >
              <FileText className="w-4 h-4 text-foreground-secondary" />
              {t('hero.docs')}
            </button>
          </div>

          {/* Real stats */}
          <div className="flex items-center gap-6 pt-4">
            <div className="flex items-center gap-2 text-sm font-mono">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-foreground font-bold">{TOTAL_SKILLS}</span>
              <span className="text-foreground-secondary">{t('hero.skillsAvailable') || 'skills'}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2 text-sm font-mono">
              <span className="text-foreground font-bold">{TOTAL_CATEGORIES}</span>
              <span className="text-foreground-secondary">{t('hero.categoriesCount') || 'categories'}</span>
            </div>
          </div>
        </div>

        {/* Right Visuals */}
        <div className="relative lg:ml-auto w-full max-w-lg">
          {/* Main Visual Window */}
          <div className="relative glass rounded-2xl border border-border/50 shadow-glass overflow-hidden">
            {/* Window Header */}
            <div className="h-10 bg-gradient-to-r from-secondary/80 to-secondary/40 border-b border-border/50 flex items-center px-4 justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
              </div>
              <div className="text-xs font-mono text-foreground-secondary">skills.tsx</div>
              <div className="w-12"></div>
            </div>

            {/* Window Content */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm text-foreground-secondary font-mono mb-1">
                    {t('hero.activeSkills')}
                  </div>
                  <div className="text-2xl font-bold font-candy text-primary">{TOTAL_SKILLS} {t('hero.ready')}</div>
                </div>
                <div className="p-2 bg-primary/10 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
              </div>

              {/* Category breakdown chart */}
              <div className="h-32 flex items-end gap-2 justify-between px-2">
                {chartData.map(({ name, pct }) => (
                  <div key={name} className="w-full bg-secondary/50 rounded-t-sm relative group" title={`${name}: ${pct.toFixed(0)}%`}>
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-sm transition-all duration-300 group-hover:from-primary/90 group-hover:to-primary/50"
                      style={{ height: `${pct}%` }}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Floating Code Card */}
          <div className="absolute -bottom-6 -left-6 glass-strong p-4 rounded-xl shadow-candy border border-primary/10 font-mono text-sm max-w-[240px] hidden sm:block animate-candy-float" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-2 text-xs text-foreground-tertiary mb-2">
              <Code2 className="w-3 h-3" />
              <span>skill.ts</span>
            </div>
            <div>
              <span className="text-syntax-keyword">const</span>{' '}
              <span className="text-syntax-variable">ai</span> ={' '}
              <span className="text-syntax-function">await</span>{' '}
              <span className="text-caramel">useSkill</span>();
            </div>
            <div className="text-syntax-comment text-xs mt-1 flex items-center gap-1">
              {t('hero.comment')} <Candy className="w-3 h-3 inline text-primary" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
