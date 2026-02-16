import { Search, ShoppingBag, Check, X, Calendar, Heart, Play, Star, Github } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { SKILLS_DATA, type Skill } from '../../data/skillsData';
import { SkillModal } from '../common/SkillModal';
import { storageUtils } from '../../utils/storage';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVersionMode } from '../../contexts/VersionModeContext';

interface SkillsGridProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tagFilter: string | null;
  setTagFilter: (t: string | null) => void;
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onRunSkill: (skill: Skill) => void;
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, { bg: string; text: string; border: string; solid: string; illustration: string }> = {
    Development: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', solid: 'bg-blue-500', illustration: '/illustrations/development.png' },
    Design: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', solid: 'bg-pink-500', illustration: '/illustrations/design.png' },
    Marketing: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', solid: 'bg-orange-500', illustration: '/illustrations/marketing.png' },
    Productivity: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', solid: 'bg-emerald-500', illustration: '/illustrations/productivity.png' },
    Tools: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', solid: 'bg-violet-500', illustration: '/illustrations/tools.png' },
    Research: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', solid: 'bg-cyan-500', illustration: '/illustrations/research.png' },
    Mobile: { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/20', solid: 'bg-lime-500', illustration: '/illustrations/mobile.png' },
    Writing: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', solid: 'bg-yellow-500', illustration: '/illustrations/writing.png' },
  };
  return colors[category] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20', solid: 'bg-gray-500', illustration: '/illustrations/development.png' };
};

export function SkillsGrid({
  searchQuery,
  setSearchQuery,
  tagFilter,
  setTagFilter,
  cart,
  onToggleCart,
  onRunSkill,
}: SkillsGridProps) {
  const { t } = useLanguage();
  const { mode } = useVersionMode();
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  // Use lazy initializer to load liked skills from storage
  const [likedSkills, setLikedSkills] = useState<Set<string>>(() => new Set(storageUtils.getLikes()));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const ITEMS_PER_LOAD = 12;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  // Track the base visible count - resets when filters change
  const baseVisibleCount = 12;
  // Track additional items loaded beyond base
  const [additionalLoaded, setAdditionalLoaded] = useState(0);

  // Calculate total visible count using useMemo
  const actualVisibleCount = useMemo(() => {
    return baseVisibleCount + additionalLoaded;
  }, [additionalLoaded]);

  // Reset additional loaded count when filters change
  const prevFiltersRef = useRef({ searchQuery, tagFilter });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.searchQuery !== searchQuery || prev.tagFilter !== tagFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdditionalLoaded(0);
      prevFiltersRef.current = { searchQuery, tagFilter };
    }
  }, [searchQuery, tagFilter]);

  // Cmd+K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
           
          setAdditionalLoaded((prev) => prev + ITEMS_PER_LOAD);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLike = (skillId: string) => {
    const isLiked = likedSkills.has(skillId);
    console.log('[Like] Clicked on skill:', skillId);
    console.log('[Like] Currently liked:', isLiked);

    const skillName = SKILLS_DATA.find(s => s.id === skillId)?.name || skillId;
    if (isLiked) {
      storageUtils.removeLike(skillId);
      setLikedSkills((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    } else {
      storageUtils.saveLike(skillId);
      setLikedSkills((prev) => {
        const next = new Set(prev);
        next.add(skillId);
        return next;
      });
      toast.success(`Liked ${skillName}`);
    }
  };

  const filteredSkills = useMemo(() => {
    return SKILLS_DATA
      .filter((skill) => {
        const matchesSearch =
          skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          skill.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesTag = tagFilter ?
          (skill.tags.includes(tagFilter) || skill.category === tagFilter) : true;

        return matchesSearch && matchesTag;
      })
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)); // Sort by popularity
  }, [searchQuery, tagFilter]);

  return (
    <>
      <section className="py-20 bg-background" id="skills-grid">
        <div className="container max-w-7xl mx-auto px-4">
          {/* Section Header & Search */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl font-candy font-bold mb-2 text-foreground">
                {tagFilter ? t('skills.categoryModules', { category: tagFilter }) : t('skills.freshlyBaked')}
              </h2>
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
                <span>$ ls ./inventory</span>
                {tagFilter && (
                  <button
                    onClick={() => setTagFilter(null)}
                    className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    --filter="{tagFilter}" <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="w-full md:w-96 relative group">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('skills.search')}
                  className={cn(
                    'w-full h-10 pl-10 pr-4 bg-background border border-input rounded-lg text-sm font-mono',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    'transition-all placeholder:text-muted-foreground',
                    'shadow-sm hover:shadow-md'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSkills.slice(0, actualVisibleCount).map((skill) => (
              <div
                key={skill.id}
                onClick={() => setSelectedSkill(skill)}
                className={cn(
                  'group bg-card rounded-xl border border-border shadow-card',
                  'hover:shadow-lg hover:border-primary/30 hover:-translate-y-1',
                  'transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer'
                )}
              >
                {/* === Dev Mode: Code-style card === */}
                <div className={cn(
                  'transition-all duration-400',
                  mode === 'dev' ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0 overflow-hidden'
                )}>
                  {/* Top Bar (Traffic Lights + Filename) */}
                  <div
                    className={cn(
                      'h-10 px-4 border-b border-border flex items-center bg-muted/30 relative',
                      'group-hover:bg-muted/50 transition-colors'
                    )}
                  >
                    <div className="flex items-center gap-1.5 absolute left-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                    </div>
                    <div className="mx-auto text-xs font-mono text-muted-foreground font-medium">
                      {skill.id}.ts
                    </div>
                  </div>

                  {/* Code Content */}
                  <div className="p-5 flex-1 font-mono text-sm leading-relaxed relative">
                    {/* Line Numbers */}
                    <div className="absolute left-4 top-5 bottom-5 w-6 text-right text-muted-foreground/40 select-none text-xs flex flex-col gap-1">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                    </div>

                    {/* Syntax Highlighted Text */}
                    <div className="pl-10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-syntax-keyword font-bold">export</span>
                        <span className="text-syntax-variable font-bold">
                          {skill.name.replace(/\s+/g, '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-syntax-keyword">from</span>
                        <span className="text-syntax-string text-xs truncate">
                          "{skill.installCommand.split(' ').pop()}"
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3 border-l-2 border-border pl-3">
                        <span className="text-primary/70 text-[10px] uppercase font-bold tracking-tight bg-primary/5 px-2 rounded">// {skill.category}</span>
                        {skill.tags.map(tag => (
                          <span key={tag} className="text-foreground-secondary text-[10px] uppercase font-bold tracking-tight bg-secondary/30 px-2 rounded">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer Status Bar */}
                  <div
                    className={cn(
                      'h-10 px-4 border-t border-border bg-muted/20 flex items-center justify-between text-xs font-mono text-muted-foreground',
                      'group-hover:bg-muted/30 transition-colors'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>{t('skills.updatedToday')}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Run Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunSkill(skill);
                        }}
                        className="p-2 rounded-md hover:text-green-600 hover:bg-green-500/10 transition-all duration-200 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500/30"
                        title="Run skill"
                        aria-label={`Run ${skill.name}`}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLike(skill.id);
                        }}
                        className="p-2 rounded-md hover:text-destructive hover:bg-destructive/10 transition-all duration-200 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-destructive/30"
                        type="button"
                        aria-label={likedSkills.has(skill.id) ? 'Unlike skill' : 'Like skill'}
                      >
                        <Heart
                          className={cn(
                            'w-3.5 h-3.5 transition-colors pointer-events-none',
                            likedSkills.has(skill.id) ? 'fill-destructive text-destructive' : ''
                          )}
                        />
                      </button>

                      {/* Add Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCart(skill.id);
                        }}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase font-bold tracking-wide transition-all duration-200 border cursor-pointer min-h-[28px] focus:outline-none focus:ring-2 focus:ring-primary/30',
                          cart.has(skill.id)
                            ? 'bg-green-500/10 border-green-500/20 text-green-600 hover:bg-green-500/20'
                            : 'bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-primary'
                        )}
                        aria-label={cart.has(skill.id) ? t('skills.removeFromBag', { name: skill.name }) : t('skills.addToBag', { name: skill.name })}
                      >
                        {cart.has(skill.id) ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>{t('skills.inBag')}</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3 h-3" />
                            <span>{t('skills.add')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* === User Mode: Image+Text card === */}
                <div className={cn(
                  'transition-all duration-400',
                  mode === 'user' ? 'opacity-100 max-h-[600px]' : 'opacity-0 max-h-0 overflow-hidden'
                )}>
                  {/* Illustration banner */}
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={getCategoryColor(skill.category).illustration}
                      alt={skill.category}
                      className="w-full h-full object-cover"
                    />
                    {/* Gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                    {/* Floating icon on illustration */}
                    <div className="absolute bottom-3 left-4 flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${getCategoryColor(skill.category).bg} backdrop-blur-sm border ${getCategoryColor(skill.category).border} flex items-center justify-center text-xl shadow-lg`}>
                        {skill.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-base leading-tight drop-shadow-sm">
                          {skill.name}
                        </h3>
                        <span className={`text-xs font-medium ${getCategoryColor(skill.category).text}`}>
                          {skill.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-3">
                    {/* Popularity row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-medium">{skill.popularity || 0}</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(skill.category).bg} ${getCategoryColor(skill.category).text}`}>
                        {skill.category}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
                      {skill.description}
                    </p>

                    {/* Tags */}
                    {skill.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {skill.tags.map(tag => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium bg-secondary/50 text-foreground-tertiary px-2 py-0.5 rounded-full border border-border/50"
                          >
                            #{tag.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Source Link */}
                    <a
                      href={`https://github.com/${skill.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-4 group/link"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>{skill.repo}</span>
                      <span className="opacity-0 group-hover/link:opacity-100 transition-opacity">→</span>
                    </a>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunSkill(skill);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Run
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLike(skill.id);
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-200 border",
                          likedSkills.has(skill.id)
                            ? "bg-pink-500/10 text-pink-500 border-pink-500/20"
                            : "bg-background text-foreground-tertiary border-border hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <Heart className={cn("w-4 h-4", likedSkills.has(skill.id) ? "fill-current" : "")} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCart(skill.id);
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-200 border",
                          cart.has(skill.id)
                            ? "bg-green-500/10 text-green-500 border-green-500/20"
                            : "bg-background text-foreground-tertiary border-border hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        {cart.has(skill.id) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <ShoppingBag className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Trigger */}
          {actualVisibleCount < filteredSkills.length && (
            <div
              ref={loadMoreRef}
              className="flex justify-center items-center py-8"
            >
              <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <span className="ml-2">{t('skills.loadingMore')}</span>
              </div>
            </div>
          )}

          {filteredSkills.length === 0 && (
            <div className="text-center py-20 text-muted-foreground font-mono">
              {t('skills.noResults', { query: searchQuery })}
            </div>
          )}
        </div>
      </section>

      <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} onRun={onRunSkill} />
    </>
  );
}
