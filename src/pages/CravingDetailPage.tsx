import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Flame, Zap, DollarSign, Tag } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { CRAVINGS_DATA } from '../data/cravingsData';
import { SKILLS_DATA } from '../data/skillsData';
import { storageUtils } from '../utils/storage';

export function CravingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const allCravings = useMemo(() => {
    const userCravings = storageUtils.getUserCravings();
    return [...userCravings, ...CRAVINGS_DATA];
  }, []);

  const craving = useMemo(() => allCravings.find((c) => c.id === id), [allCravings, id]);

  if (!craving) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Craving not found</h1>
        <Button onClick={() => navigate('/discover?tab=craving')}>Back to Cravings</Button>
      </div>
    );
  }

  const urgencyConfig = {
    high: { icon: Flame, color: 'text-error', bg: 'bg-error/10', label: 'High' },
    medium: { icon: Zap, color: 'text-warning', bg: 'bg-warning/10', label: 'Medium' },
    low: { icon: Clock, color: 'text-info', bg: 'bg-info/10', label: 'Low' },
  };
  const urgency = urgencyConfig[craving.urgency] || urgencyConfig.medium;
  const UrgencyIcon = urgency.icon;

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
          <div className="flex items-start gap-4">
            <span className="text-4xl">{craving.emoji}</span>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold font-candy">{craving.title}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant={statusColors[craving.status] || 'default'}>
                  {craving.status}
                </Badge>
                <Badge variant="secondary" size="sm">
                  {craving.category}
                </Badge>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Description</h2>
              <p className="text-foreground-secondary leading-relaxed">{craving.description}</p>
            </CardContent>
          </Card>

          {/* Matching Skills */}
          {matchingSkills.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Matching Candies ({matchingSkills.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {matchingSkills.map((skill) => (
                  <Card
                    key={skill.id}
                    variant="interactive"
                    className="p-4"
                    onClick={() => navigate(`/candy/${skill.id}`)}
                  >
                    <CardContent className="p-0 flex items-start gap-3">
                      <span className="text-xl">{skill.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{skill.name}</h3>
                        <p className="text-xs text-foreground-secondary line-clamp-2 mt-1">{skill.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button variant="candy" className="w-full">
                Offer to Build
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/discover')}>
                Find Matching Candy
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Urgency</span>
                  <div className={`flex items-center gap-1 ${urgency.color}`}>
                    <UrgencyIcon className="w-3.5 h-3.5" />
                    {urgency.label}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Budget</span>
                  <span className="font-medium flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {craving.budget}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Posted by</span>
                  <span className="font-medium">{craving.postedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Posted</span>
                  <span className="text-foreground-tertiary">{craving.postedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Matches</span>
                  <span className="font-medium">{craving.matchCount}</span>
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
                      <Badge key={tag} variant="outline" size="sm">{tag}</Badge>
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
