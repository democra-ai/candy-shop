import { Star, Users, ChevronRight, Sparkles } from 'lucide-react';
import { SKILLS_DATA, crawlerSkillToSkill, type Skill } from '../../data/skillsData';
import { cn } from '../../utils/cn';
import { getCandyEmoji, CANDY_EMOJIS } from '../../utils/candy';
import { useState, useEffect } from 'react';
import { SkillModal } from '../common/SkillModal';
import { listSkills } from '../../lib/skillCrawlerClient';
import { AuditPillCompact, EditorChoiceBadge } from '../common/AuditBadges';

const getCategoryColor = (category: string) => {
  const colors: Record<string, { gradient: string; text: string }> = {
    // Matches SkillsGrid's confectionery palette.
    Development: { gradient: 'from-sky-500/20 to-sky-500/5', text: 'text-sky-500' },
    Design: { gradient: 'from-fuchsia-500/20 to-fuchsia-500/5', text: 'text-fuchsia-500' },
    Marketing: { gradient: 'from-orange-500/20 to-orange-500/5', text: 'text-orange-500' },
    Productivity: { gradient: 'from-teal-500/20 to-teal-500/5', text: 'text-teal-500' },
    Tools: { gradient: 'from-violet-500/20 to-violet-500/5', text: 'text-violet-500' },
    Research: { gradient: 'from-cyan-500/20 to-cyan-500/5', text: 'text-cyan-500' },
    Mobile: { gradient: 'from-lime-500/20 to-lime-500/5', text: 'text-lime-600' },
    Writing: { gradient: 'from-amber-500/20 to-amber-500/5', text: 'text-amber-500' },
  };
  return colors[category] || { gradient: 'from-primary/20 to-primary/5', text: 'text-primary' };
};

function deriveRating(skill: Skill): number {
  if (skill.rating) return skill.rating;
  let hash = 0;
  for (let i = 0; i < skill.name.length; i++) hash = ((hash << 5) - hash + skill.name.charCodeAt(i)) | 0;
  return Math.round((3.5 + (Math.abs(hash) % 15) / 10) * 10) / 10;
}

interface EditorPicksProps {
  onRunSkill: (skill: Skill) => void;
}

export function EditorPicks({ onRunSkill }: EditorPicksProps) {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [crawlerPicks, setCrawlerPicks] = useState<Skill[] | null>(null);

  // Pull Editor's Choice from the live crawler (~1k entries). Falls back
  // to hand-curated SKILLS_DATA if the API errors out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await listSkills({ editorsChoice: true, sort: 'stars', limit: 12 });
        if (cancelled) return;
        const items = r.items.map(crawlerSkillToSkill);
        if (items.length > 0) setCrawlerPicks(items);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackPicks = SKILLS_DATA.filter((s) => s.editorPick).slice(0, 5);
  const editorPicks = (crawlerPicks ?? fallbackPicks).slice(0, 5);

  if (editorPicks.length === 0) return null;

  // First pick is the hero card, rest are smaller
  const heroSkill = editorPicks[0];
  const restSkills = editorPicks.slice(1);

  return (
    <>
      <section className="py-12 bg-background">
        <div className="container max-w-7xl mx-auto px-4">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-candy font-bold text-foreground">Editor's Picks</h2>
                <p className="text-sm text-foreground-tertiary font-mono">Curated by the Candy Shop team</p>
              </div>
            </div>
          </div>

          {/* Featured Layout: Hero + Side Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Hero Card — Large Featured */}
            <button
              onClick={() => setSelectedSkill(heroSkill)}
              className={cn(
                'group relative overflow-hidden rounded-2xl border border-border/50',
                'bg-gradient-to-br', getCategoryColor(heroSkill.category).gradient,
                'p-6 text-left transition-all duration-300',
                'hover:shadow-candy-lg hover:border-primary/30 hover:scale-[1.01]',
                'cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring',
                'min-h-[320px] flex flex-col'
              )}
            >
              {/* Editor badge + audit pill */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <EditorChoiceBadge on={heroSkill.editorPick} reason={heroSkill.editorNote} />
                <AuditPillCompact summary={heroSkill.auditSummary} />
                <span className={cn('text-xs font-medium', getCategoryColor(heroSkill.category).text)}>
                  {heroSkill.category}
                </span>
              </div>

              {/* Icon + Title */}
              <div className="flex items-start gap-4 mb-3">
                <div className="text-5xl shrink-0 animate-candy-float">{getCandyEmoji(heroSkill.id)}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-candy font-bold text-foreground leading-tight mb-1">
                    {heroSkill.name}
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn('w-3.5 h-3.5', s <= Math.round(deriveRating(heroSkill)) ? 'fill-caramel text-caramel' : 'text-foreground-muted')} />
                      ))}
                      <span className="ml-1 text-foreground-secondary font-medium">{deriveRating(heroSkill)}</span>
                    </div>
                    <span className="text-foreground-muted">·</span>
                    <span className="text-foreground-secondary text-xs">{heroSkill.developer || 'Community'}</span>
                  </div>
                </div>
              </div>

              {/* Editor Note */}
              {heroSkill.editorNote && (
                <p className="text-sm text-foreground-secondary italic mb-4 leading-relaxed">
                  "{heroSkill.editorNote}"
                </p>
              )}

              {/* Showcases */}
              {heroSkill.showcases && heroSkill.showcases.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-auto">
                  {heroSkill.showcases.map((sc, i) => (
                    <div
                      key={i}
                      className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/30 p-3 flex flex-col items-center gap-2 text-center group-hover:bg-card/80 transition-colors"
                    >
                      <span className="text-2xl">{sc.emoji || CANDY_EMOJIS[i % CANDY_EMOJIS.length]}</span>
                      <span className="text-[11px] font-medium text-foreground leading-tight line-clamp-2">{sc.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Stats */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
                <div className="flex items-center gap-1 text-xs text-foreground-tertiary">
                  <Users className="w-3 h-3" />
                  {heroSkill.popularity?.toLocaleString()} installs
                </div>
                <span className="text-foreground-muted text-xs">·</span>
                <span className="text-xs text-green-500 font-medium">Open Source</span>
                <span className="text-foreground-muted text-xs">·</span>
                <span className="text-xs text-foreground-tertiary">{heroSkill.version || 'v1.0'}</span>
                <ChevronRight className="w-4 h-4 text-foreground-tertiary ml-auto group-hover:text-primary transition-colors" />
              </div>
            </button>

            {/* Side Cards — Stacked */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {restSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border border-border/50',
                    'bg-gradient-to-br', getCategoryColor(skill.category).gradient,
                    'p-4 text-left transition-all duration-300',
                    'hover:shadow-card-hover hover:border-primary/20 hover:scale-[1.02]',
                    'cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring',
                    'flex flex-col'
                  )}
                >
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <EditorChoiceBadge on={skill.editorPick} reason={skill.editorNote} size="xs" />
                    <AuditPillCompact summary={skill.auditSummary} size="xs" />
                  </div>

                  {/* Icon + Info */}
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-3xl shrink-0">{getCandyEmoji(skill.id)}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-foreground leading-snug font-candy truncate">{skill.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 fill-caramel text-caramel" />
                        <span className="text-[11px] text-foreground-secondary">{deriveRating(skill)}</span>
                        <span className="text-border mx-0.5">·</span>
                        <span className="text-[11px] text-foreground-tertiary">{skill.developer || 'Community'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Showcase mini row */}
                  {skill.showcases && skill.showcases.length > 0 && (
                    <div className="flex gap-1.5 mt-auto pt-2">
                      {skill.showcases.slice(0, 3).map((sc, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-card/50 backdrop-blur-sm rounded-lg border border-border/20 py-1.5 px-1 flex flex-col items-center gap-1"
                        >
                          <span className="text-lg">{sc.emoji || '📋'}</span>
                          <span className="text-[9px] text-foreground-secondary leading-tight text-center line-clamp-1">{sc.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} onRun={onRunSkill} />
    </>
  );
}
