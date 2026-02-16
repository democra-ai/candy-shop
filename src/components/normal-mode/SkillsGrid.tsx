import { Search, Heart, ShoppingBag, Check, Play, Star, Github } from 'lucide-react';
import { useState, useMemo } from 'react';
import { SKILLS_DATA, type Skill } from '../../data/skillsData';
import { SkillModal } from '../common/SkillModal';
import { storageUtils } from '../../utils/storage';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';

interface NormalSkillsGridProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: string | null;
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onRunSkill: (skill: Skill) => void;
}

export function NormalSkillsGrid({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  cart,
  onToggleCart,
  onRunSkill,
}: NormalSkillsGridProps) {
  const { t } = useLanguage();
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [likedSkills, setLikedSkills] = useState<Set<string>>(() => new Set(storageUtils.getLikes()));

  const handleLike = (skillId: string) => {
    const isLiked = likedSkills.has(skillId);
    const skillName = SKILLS_DATA.find((s) => s.id === skillId)?.name || skillId;

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
    return SKILLS_DATA.filter((skill) => {
      const matchesSearch =
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter ? skill.category === categoryFilter : true;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }, [searchQuery, categoryFilter]);

  // Use same colors as Pro Mode for consistency
  const getCategoryColor = (category: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; solid: string; hex: string }> = {
      'Knowledge': {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/20',
        solid: 'bg-blue-500',
        hex: '#3b82f6',
      },
      'Analysis': {
        bg: 'bg-violet-500/10',
        text: 'text-violet-400',
        border: 'border-violet-500/20',
        solid: 'bg-violet-500',
        hex: '#8b5cf6',
      },
      'Development': {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/20',
        solid: 'bg-orange-500',
        hex: '#f97316',
      },
      'Design': {
        bg: 'bg-pink-500/10',
        text: 'text-pink-400',
        border: 'border-pink-500/20',
        solid: 'bg-pink-500',
        hex: '#ec4899',
      },
      'Marketing': {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/20',
        solid: 'bg-red-500',
        hex: '#ef4444',
      },
      'Productivity': {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        solid: 'bg-amber-500',
        hex: '#f59e0b',
      },
      'Tools': {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
        solid: 'bg-emerald-500',
        hex: '#10b981',
      },
      'Research': {
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/20',
        solid: 'bg-cyan-500',
        hex: '#06b6d4',
      },
      'Mobile': {
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-400',
        border: 'border-indigo-500/20',
        solid: 'bg-indigo-500',
        hex: '#6366f1',
      },
      'Writing': {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/20',
        solid: 'bg-rose-500',
        hex: '#f43f5e',
      },
      'Creative': {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/20',
        solid: 'bg-purple-500',
        hex: '#a855f7',
      },
      'Developer': {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/20',
        solid: 'bg-green-500',
        hex: '#22c55e',
      },
      'Communication': {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/20',
        solid: 'bg-rose-500',
        hex: '#f43f5e',
      },
      'Analytics': {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        solid: 'bg-amber-500',
        hex: '#f59e0b',
      },
    };
    return colors[category] || {
      bg: 'bg-gray-500/10',
      text: 'text-gray-400',
      border: 'border-gray-500/20',
      solid: 'bg-gray-500',
      hex: '#6b7280',
    };
  };

  return (
    <>
      <section id="skills" className="py-12 bg-background">
        <div className="container max-w-7xl mx-auto px-4">
          {/* Section Header & Search - Consistent with Pro Mode */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1.5 text-foreground">
                {categoryFilter ? `${categoryFilter} Skills` : 'Discover Skills'}
              </h2>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span>Browse {filteredSkills.length} available skills</span>
              </div>
            </div>

            <div className="w-full md:w-72 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('skills.search') || 'Search skills...'}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Skills Grid - Visual Cards with gradient backgrounds */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => {
              const colors = getCategoryColor(skill.category);
              return (
                <div
                  key={skill.id}
                  className="group relative rounded-xl border border-border hover:border-primary/50 overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, var(--color-card) 55%, ${colors.hex}12 100%)`,
                  }}
                  onClick={() => setSelectedSkill(skill)}
                >
                  {/* Visual top bar - transitioning from code style to colorful */}
                  <div className={`h-2 ${colors.solid} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                  </div>

                  <div className="p-4">
                    {/* Header with icon and category */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-11 h-11 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center text-xl flex-shrink-0 transition-all group-hover:scale-110`}>
                        {skill.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {skill.name}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {skill.category}
                        </span>
                      </div>

                      {/* Popularity indicator */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-medium">{skill.popularity || 0}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                      {skill.description}
                    </p>

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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunSkill(skill);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-all duration-200"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Try Now
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLike(skill.id);
                        }}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          likedSkills.has(skill.id)
                            ? 'bg-pink-500/10 text-pink-500'
                            : 'bg-secondary text-muted-foreground hover:bg-pink-500/10 hover:text-pink-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${likedSkills.has(skill.id) ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCart(skill.id);
                        }}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          cart.has(skill.id)
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-secondary text-muted-foreground hover:bg-green-500/10 hover:text-green-500'
                        }`}
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
              );
            })}
          </div>

          {/* Empty state */}
          {filteredSkills.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
                <Search className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-base">
                {t('skills.noResults') || 'No skills found'}
              </p>
              <p className="text-muted-foreground/60 text-sm mt-1.5">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </section>

      <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} onRun={onRunSkill} />
    </>
  );
}
