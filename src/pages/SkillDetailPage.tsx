import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Download, Play, Copy, Check, ExternalLink, Tag, MessageSquare, Zap, Shield, GitFork } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StarRating } from '../components/ui/StarRating';
import { LineageBadge, PricingBadge, ExecutionModelBadge, ManifestVisibilityBadge } from '../components/common/LineageBadge';
import { SKILLS_DATA } from '../data/skillsData';
import type { Skill as StoreSkill } from '../data/skillsData';
import { useStars } from '../hooks/api/useStars';
import { useRatings } from '../hooks/api/useRatings';
import { useDownloads } from '../hooks/api/useDownloads';
import { toast } from 'sonner';

interface SkillDetailPageProps {
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onRunSkill: (skill: StoreSkill) => void;
  userId?: string;
}

export function SkillDetailPage({ cart, onToggleCart, onRunSkill, userId }: SkillDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'ratings'>('about');

  const skill = useMemo(() => SKILLS_DATA.find((s) => s.id === id), [id]);

  // Social hooks
  const { isStarred, starCount, toggleStar } = useStars(id || '', userId);
  const { ratings, avgRating, rate } = useRatings(id || '');
  const { trackDownload } = useDownloads();

  if (!skill) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Skill not found</h1>
        <Button onClick={() => navigate('/discover')}>Back to Discover</Button>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(skill.installCommand);
    setCopied(true);
    toast.success('Install command copied!');
    trackDownload(skill.id);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRate = async (score: number) => {
    if (!userId) {
      toast.error('Sign in to rate skills');
      return;
    }
    try {
      await rate(userId, score);
      toast.success('Rating submitted!');
    } catch {
      toast.error('Failed to submit rating');
    }
  };

  const inCart = cart.has(skill.id);
  const relatedSkills = SKILLS_DATA
    .filter((s) => s.category === skill.category && s.id !== skill.id)
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <span className="text-4xl">{skill.icon}</span>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold font-candy">{skill.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge>{skill.category}</Badge>
                <StarRating value={avgRating} readonly size="sm" showValue count={ratings.length} />
                <span className="text-xs text-foreground-tertiary flex items-center gap-1">
                  <Star className="w-3 h-3" /> {starCount}
                </span>
                <span className="text-xs text-foreground-tertiary flex items-center gap-1">
                  <Download className="w-3 h-3" /> {(skill.popularity ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Lineage & Provenance */}
          {(skill.lineage || skill.executionModel || skill.pricingModel) && (
            <div className="flex flex-wrap items-center gap-2">
              <LineageBadge lineage={skill.lineage} />
              <PricingBadge pricingModel={skill.pricingModel} price={skill.price} />
              <ExecutionModelBadge model={skill.executionModel} />
              <ManifestVisibilityBadge visibility={skill.manifestVisibility} />
            </div>
          )}

          {/* Execution Rights Notice */}
          {skill.executionModel === 'managed' && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Execution Rights Model</h3>
                    <p className="text-xs text-foreground-secondary leading-relaxed">
                      This skill sells <strong>execution rights</strong>, not source files. The manifest is visible, but runtime execution requires an active entitlement.
                      Supports both Stripe (human) and x402 protocol (agent) payments.
                    </p>
                    {skill.lineage?.originalAuthor && skill.lineage.type !== 'original' && (
                      <p className="text-xs text-foreground-tertiary mt-1.5 flex items-center gap-1">
                        <GitFork className="w-3 h-3" />
                        Derived from <strong>{skill.lineage.originalAuthor}</strong> — revenue shared with original creator
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            <button
              onClick={() => setActiveTab('about')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'about'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-secondary hover:text-foreground'
              }`}
            >
              About
            </button>
            <button
              onClick={() => setActiveTab('ratings')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'ratings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-secondary hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Reviews ({ratings.length})
            </button>
          </div>

          {activeTab === 'about' && (
            <>
              {/* Description */}
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold mb-3">About</h2>
                  <p className="text-foreground-secondary leading-relaxed">{skill.description}</p>
                </CardContent>
              </Card>

              {/* Install */}
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold mb-3">Quick Install</h2>
                  <div className="bg-backgroundSecondary rounded-lg p-4 flex items-center justify-between gap-3 font-mono text-sm">
                    <code className="text-foreground truncate">{skill.installCommand}</code>
                    <button
                      onClick={handleCopy}
                      className="flex-shrink-0 p-2 hover:bg-secondary rounded transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-foreground-secondary" />}
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Config */}
              {skill.config && Object.keys(skill.config).length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h2 className="text-lg font-semibold mb-3">Claude Desktop Config</h2>
                    <pre className="bg-backgroundSecondary rounded-lg p-4 text-xs overflow-x-auto font-mono">
                      {JSON.stringify(skill.config, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Related */}
              {relatedSkills.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Related Skills</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {relatedSkills.map((related) => (
                      <Card
                        key={related.id}
                        variant="interactive"
                        className="p-4"
                        onClick={() => navigate(`/candy/${related.id}`)}
                      >
                        <CardContent className="p-0 flex items-start gap-3">
                          <span className="text-xl">{related.icon}</span>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{related.name}</h3>
                            <p className="text-xs text-foreground-secondary line-clamp-2 mt-1">{related.description}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'ratings' && (
            <div className="space-y-6">
              {/* Rate this skill */}
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold mb-3">Rate this Skill</h2>
                  <StarRating value={0} onChange={handleRate} size="lg" />
                </CardContent>
              </Card>

              {/* Ratings list */}
              {ratings.length === 0 ? (
                <div className="text-center py-12 text-foreground-secondary">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 text-foreground-muted" />
                  <p>No reviews yet. Be the first to rate this skill!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ratings.map((r) => (
                    <Card key={r.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3 mb-2">
                          <StarRating value={r.score} readonly size="sm" />
                          <span className="text-xs text-foreground-tertiary">
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {r.comment && (
                          <p className="text-sm text-foreground-secondary">{r.comment}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button
                className={skill.executionModel === 'managed' ? 'w-full bg-amber-500 hover:bg-amber-600 text-white' : 'w-full'}
                onClick={() => onRunSkill(skill)}
              >
                {skill.executionModel === 'managed' ? <Zap className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {skill.executionModel === 'managed'
                  ? (skill.price ? `Invoke ($${(skill.price / 100).toFixed(2)}/call)` : 'Invoke Skill')
                  : 'Run Skill'}
              </Button>
              <Button
                variant={inCart ? 'secondary' : 'outline'}
                className="w-full"
                onClick={() => onToggleCart(skill.id)}
              >
                <Download className="w-4 h-4" />
                {inCart ? 'Remove from Bag' : 'Add to Bag'}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={toggleStar}
              >
                <Star className={`w-4 h-4 ${isStarred ? 'fill-warning text-warning' : ''}`} />
                {isStarred ? 'Starred' : 'Star'} ({starCount})
              </Button>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">Details</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Category</span>
                  <Badge variant="secondary" size="sm">{skill.category}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Rating</span>
                  <StarRating value={avgRating} readonly size="sm" showValue />
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Stars</span>
                  <span className="font-medium">{starCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Installs</span>
                  <span className="font-medium">{(skill.popularity ?? 0).toLocaleString()}</span>
                </div>
                {skill.lineage && (
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">Lineage</span>
                    <LineageBadge lineage={skill.lineage} size="xs" showCanonical={false} />
                  </div>
                )}
                {skill.lineage?.canonical && (
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">Status</span>
                    <Badge variant="secondary" size="sm" className="bg-rose-500/10 text-rose-500 border-rose-500/20">★ Canonical</Badge>
                  </div>
                )}
                {skill.executionModel && skill.executionModel !== 'open' && (
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">Execution</span>
                    <span className="text-xs font-medium">{skill.executionModel === 'managed' ? '☁ Managed' : '🔗 Federated'}</span>
                  </div>
                )}
                {skill.pricingModel && skill.pricingModel !== 'free' && (
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">Pricing</span>
                    <span className="text-xs font-medium text-amber-500">
                      {skill.price ? `$${(skill.price / 100).toFixed(2)}` : ''} / {skill.pricingModel === 'per_call' ? 'call' : skill.pricingModel}
                    </span>
                  </div>
                )}
                {skill.repo && (
                  <a
                    href={`https://github.com/${skill.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Source
                  </a>
                )}
                {skill.skillMdUrl && (
                  <a
                    href={skill.skillMdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    SKILL.md Documentation
                  </a>
                )}
              </div>

              {/* Tags */}
              {skill.tags && skill.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-sm text-foreground-secondary mb-2">
                    <Tag className="w-3.5 h-3.5" />
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.tags.map((tag) => (
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
