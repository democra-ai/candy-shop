import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Flame, Zap, DollarSign, Tag } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { CandyCard } from '../components/home/CandyCard';
import { CRAVINGS_DATA } from '../data/cravingsData';
import { SKILLS_DATA } from '../data/skillsData';
import { storageUtils } from '../utils/storage';
import { useIsDark } from '../hooks/useIsDark';
import { getFlavor } from '../utils/candyShells';
import { getCandyEmoji } from '../utils/candy';

export function CravingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isDark = useIsDark();

  const allCravings = useMemo(() => {
    const userCravings = storageUtils.getUserCravings();
    return [...userCravings, ...CRAVINGS_DATA];
  }, []);

  const craving = useMemo(() => allCravings.find((c) => c.id === id), [allCravings, id]);

  if (!craving) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-candy font-bold mb-4">Craving not found</h1>
        <Button onClick={() => navigate('/discover?tab=craving')} className="rounded-2xl px-5">Back to Cravings</Button>
      </div>
    );
  }

  const flavor = getFlavor(craving.category, isDark);
  const emoji = getCandyEmoji(craving.id);

  // Urgency uses semantic tokens: high = error, medium = warning, low = info.
  const urgencyConfig = {
    high: { icon: Flame, badge: 'error' as const, label: 'High urgency' },
    medium: { icon: Zap, badge: 'warning' as const, label: 'Medium urgency' },
    low: { icon: Clock, badge: 'info' as const, label: 'Low urgency' },
  };
  const urgency = urgencyConfig[craving.urgency] || urgencyConfig.medium;
  const UrgencyIcon = urgency.icon;
  const urgencyBadgeClass = {
    error: 'bg-error/10 text-error',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
  }[urgency.badge];

  const matchingSkills = SKILLS_DATA.filter((skill) =>
    craving.tags.some((tag) =>
      skill.tags?.some((st) => st.toLowerCase().includes(tag.toLowerCase())) ||
      skill.category.toLowerCase().includes(tag.toLowerCase())
    )
  ).slice(0, 6);

  const statusColors = {
    open: 'success',
    'in-progress': 'warning',
    fulfilled: 'default',
  } as const;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero band — subtle flavor tint + illustration (DESIGN.md §2/§4) */}
          <div
            className="rounded-3xl p-6 md:p-7 border border-border"
            style={{ backgroundColor: flavor.tint, color: flavor.ink }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-3xl shrink-0 bg-card shadow-candy-1"
                aria-hidden="true"
              >
                <span className="text-5xl leading-none">{emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium uppercase tracking-widest"
                  style={{ backgroundColor: flavor.base, color: flavor.tint }}
                >
                  {craving.category}
                </span>
                <h1
                  className="text-2xl sm:text-3xl md:text-4xl font-candy font-bold tracking-tight leading-[1.1] mt-2"
                  style={{ color: flavor.ink }}
                >
                  {craving.title}
                </h1>
              </div>
            </div>
            {/* Status + urgency + budget badges */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Badge variant={statusColors[craving.status] || 'default'} size="sm" className="font-mono">
                {craving.status}
              </Badge>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${urgencyBadgeClass}`}>
                <UrgencyIcon className="w-3 h-3" />
                {urgency.label}
              </span>
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-card border border-border"
                style={{ color: flavor.ink }}
              >
                <DollarSign className="w-3 h-3" />
                {craving.budget}
              </span>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">The ask</p>
              <h2 className="text-xl font-candy font-bold mb-3">Description</h2>
              <p className="text-foreground-secondary leading-relaxed">{craving.description}</p>
            </CardContent>
          </Card>

          {/* Matching Skills */}
          {matchingSkills.length > 0 && (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">Could satisfy this</p>
              <h2 className="text-xl font-candy font-bold mb-4">Matching Candies ({matchingSkills.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {matchingSkills.map((skill, i) => (
                  <CandyCard
                    key={skill.id}
                    skill={skill}
                    index={i}
                    onSelect={() => navigate(`/candy/${skill.id}`)}
                    onRun={() => navigate(`/candy/${skill.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button variant="candy" className="w-full rounded-2xl">
                Offer to Build
              </Button>
              <Button variant="outline" className="w-full rounded-2xl" onClick={() => navigate('/discover')}>
                Find Matching Candy
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Urgency</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${urgencyBadgeClass}`}>
                    <UrgencyIcon className="w-3 h-3" />
                    {urgency.label.replace(' urgency', '')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Budget</span>
                  <span className="font-mono font-medium flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {craving.budget}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Posted by</span>
                  <span className="font-mono font-medium">{craving.postedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Posted</span>
                  <span className="text-foreground-tertiary font-mono">{craving.postedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Matches</span>
                  <span className="font-mono font-medium">{craving.matchCount}</span>
                </div>
              </div>

              {craving.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-sm text-foreground-secondary mb-2">
                    <Tag className="w-3.5 h-3.5" />
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {craving.tags.map((tag) => (
                      <Badge key={tag} variant="outline" size="sm" className="font-mono">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
