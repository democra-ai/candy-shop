import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Download, Play, Copy, Check, ExternalLink, Tag, MessageSquare, Zap, Shield, GitFork, Cloud, Link2, BadgeCheck, Workflow, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StarRating } from '../components/ui/StarRating';
import { LineageBadge, PricingBadge, ExecutionModelBadge, ManifestVisibilityBadge } from '../components/common/LineageBadge';
import { CandyCard } from '../components/home/CandyCard';
import { SKILLS_DATA, getFormat } from '../data/skillsData';
import type { Skill as StoreSkill } from '../data/skillsData';
import { getRuntime } from '../lib/runtimes/registry';
import { useStars } from '../hooks/api/useStars';
import { useRatings } from '../hooks/api/useRatings';
import { useDownloads } from '../hooks/api/useDownloads';
import { useIsDark } from '../hooks/useIsDark';
import { getFlavor } from '../utils/candyShells';
import { getCandyEmoji } from '../utils/candy';
import { toast } from 'sonner';

interface SkillDetailPageProps {
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onRunSkill: (skill: StoreSkill) => void;
  userId?: string;
}

// ── n8n workflow node parsing ──────────────────────────────────────────────
interface N8nNode { name: string; type: string }

/** Extract a tidy {name,type} list from an n8n workflow JSON payload. n8n
 *  exports put nodes under `.nodes`; we tolerate a bare array too. Node `type`
 *  is like "n8n-nodes-base.httpRequest" — we keep the last dotted segment. */
function parseN8nNodes(json: unknown): N8nNode[] {
  const raw =
    json && typeof json === 'object' && Array.isArray((json as { nodes?: unknown[] }).nodes)
      ? (json as { nodes: unknown[] }).nodes
      : Array.isArray(json)
        ? (json as unknown[])
        : [];
  return raw
    .map((n) => {
      const o = (n ?? {}) as Record<string, unknown>;
      const type = typeof o.type === 'string' ? o.type : 'unknown';
      return {
        name: typeof o.name === 'string' ? o.name : 'Unnamed node',
        type: type.split('.').pop() || type,
      };
    })
    .filter((n) => n.name);
}

/**
 * FormatDetailSection — the format-aware body for non-claude items.
 *
 * Claude skills keep the existing SKILL.md / install view (rendered by the
 * parent). For other formats this renders an appropriate section:
 *   - n8n       → fetch the workflow JSON and list its nodes + "Import to n8n"
 *   - langgraph → graph/repo link + "run with LangGraph" note
 *   - dify      → DSL outline + "Import to Dify"
 *   - workflow  → generic steps
 * All share the same identity header (label + importHint + docs + artifact).
 * Phase 1 keeps parsing light — if the artifact can't be parsed we still show
 * the format identity, importHint, docsUrl, and an "Open artifact" link.
 */
function FormatDetailSection({ skill, accent }: { skill: StoreSkill; accent: { base: string; tint: string; ink: string } }) {
  const format = getFormat(skill);
  const runtime = getRuntime(format);
  const artifactUrl = skill.artifactUrl;

  // n8n: best-effort fetch + parse of the workflow JSON node list.
  const [n8nNodes, setN8nNodes] = useState<N8nNode[] | null>(null);
  const [n8nState, setN8nState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  useEffect(() => {
    if (format !== 'n8n' || !artifactUrl) return;
    let cancelled = false;
    setN8nState('loading');
    fetch(artifactUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (cancelled) return;
        const nodes = parseN8nNodes(json);
        setN8nNodes(nodes);
        setN8nState('loaded');
      })
      .catch(() => {
        if (!cancelled) setN8nState('error');
      });
    return () => { cancelled = true; };
  }, [format, artifactUrl]);

  const eyebrow =
    format === 'n8n' ? 'Workflow'
    : format === 'dify' ? 'Dify app'
    : format === 'langgraph' ? 'Graph'
    : format === 'dynamic-worker' ? 'Worker module'
    : 'Workflow';

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary">{eyebrow}</p>

        {/* Format identity band — flavor tint + label + import hint */}
        <div
          className="rounded-2xl p-4 border flex items-start gap-3"
          style={{ backgroundColor: accent.tint, color: accent.ink, borderColor: accent.base }}
        >
          <span
            className="grid place-items-center w-10 h-10 rounded-xl shrink-0 text-white"
            style={{ backgroundColor: accent.base }}
            aria-hidden="true"
          >
            <Workflow className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="font-candy font-semibold text-base leading-tight">{runtime.label}</div>
            {runtime.importHint && (
              <p className="text-sm mt-0.5 leading-snug opacity-90">{runtime.importHint}</p>
            )}
          </div>
        </div>

        {/* n8n — node list parsed from the workflow JSON */}
        {format === 'n8n' && (
          <div>
            <h3 className="text-sm font-candy font-bold mb-2">Workflow nodes</h3>
            {n8nState === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-foreground-tertiary py-3 font-mono">
                <Loader2 className="w-4 h-4 animate-spin" /> reading workflow…
              </div>
            )}
            {n8nState === 'error' && (
              <div className="flex items-center gap-2 text-sm text-foreground-tertiary py-3 font-mono">
                <AlertCircle className="w-4 h-4" /> Couldn’t parse the workflow — open the artifact below.
              </div>
            )}
            {n8nState === 'loaded' && n8nNodes && n8nNodes.length > 0 && (
              <ol className="space-y-1.5">
                {n8nNodes.map((node, i) => (
                  <li
                    key={`${node.name}-${i}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary border border-border"
                  >
                    <span className="grid place-items-center w-6 h-6 rounded-lg text-[11px] font-mono font-bold shrink-0 tabular-nums"
                      style={{ backgroundColor: accent.tint, color: accent.ink }}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-body text-foreground truncate flex-1 min-w-0">{node.name}</span>
                    <span className="text-[11px] font-mono text-foreground-tertiary shrink-0">{node.type}</span>
                  </li>
                ))}
              </ol>
            )}
            {n8nState === 'loaded' && n8nNodes && n8nNodes.length === 0 && (
              <p className="text-sm text-foreground-tertiary font-mono py-3">No nodes found in this workflow.</p>
            )}
          </div>
        )}

        {/* langgraph — graph/repo pointer + run note */}
        {format === 'langgraph' && (
          <div className="space-y-2 text-sm text-foreground-secondary leading-relaxed font-body">
            <p>
              This is a <strong>LangGraph</strong> graph. Clone the repo / file below and run it with the
              LangGraph Python runtime (<code className="font-mono text-mint">langgraph dev</code> or
              your own entrypoint).
            </p>
          </div>
        )}

        {/* dify — DSL outline + import note */}
        {format === 'dify' && (
          <div className="space-y-2 text-sm text-foreground-secondary leading-relaxed font-body">
            <p>
              This is a <strong>Dify</strong> app exported as a DSL (YAML). Import the DSL below into your
              Dify workspace via <span className="font-mono text-mint">Studio → Import DSL</span> to get the
              full app, model config, and prompt chain.
            </p>
          </div>
        )}

        {/* workflow — generic steps */}
        {format === 'workflow' && (
          <div className="space-y-2 text-sm text-foreground-secondary leading-relaxed font-body">
            <p>
              This is a generic automation workflow. Open the artifact below for the full step definition;
              in-platform execution is coming soon.
            </p>
          </div>
        )}

        {/* dynamic-worker — self-contained Worker module run via Worker Loader */}
        {format === 'dynamic-worker' && (
          <div className="space-y-2 text-sm text-foreground-secondary leading-relaxed font-body">
            <p>
              This is a self-contained Cloudflare <strong>Worker module</strong> (a default
              <code className="font-mono text-mint"> fetch</code> export). Open it and hit Run to load it on the
              fly via the <span className="font-mono text-mint">Worker Loader</span> (<code className="font-mono text-mint">env.LOADER</code>)
              in an isolated child Worker with no network egress — or download the
              <code className="font-mono text-mint"> .js</code> and load it from your own Worker.
            </p>
          </div>
        )}

        {/* Shared CTAs — open artifact + docs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {artifactUrl && (
            <a
              href={artifactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 h-10 rounded-2xl text-sm font-body font-semibold text-white transition-transform duration-150 ease-candy active:scale-95"
              style={{ backgroundColor: accent.base }}
            >
              <ExternalLink className="w-4 h-4" />
              {format === 'n8n' ? 'Import to n8n' : format === 'dify' ? 'Import to Dify' : 'Open artifact'}
            </a>
          )}
          {runtime.docsUrl && (
            <a
              href={runtime.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 h-10 rounded-2xl text-sm font-body font-medium bg-card border border-border text-foreground-secondary hover:text-foreground hover:border-border-hover transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              {runtime.label} docs
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SkillDetailPage({ cart, onToggleCart, onRunSkill, userId }: SkillDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isDark = useIsDark();
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
        <h1 className="text-2xl font-candy font-bold mb-4">Skill not found</h1>
        <Button onClick={() => navigate('/discover')} className="rounded-2xl px-5">Back to Discover</Button>
      </div>
    );
  }

  const flavor = getFlavor(skill.category, isDark);
  const emoji = getCandyEmoji(skill.id);

  // ── Multi-format: resolve format + runtime so the detail body, badges, and
  //    sidebar can render format-aware content. claude-skill is the default.
  const format = getFormat(skill);
  const runtime = getRuntime(format);
  const isClaudeSkill = format === 'claude-skill';
  const formatFlavor = getFlavor(runtime.accentFlavor, isDark);

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
          {/* Hero band — subtle flavor tint + illustration (DESIGN.md §2/§4) */}
          <div
            className="rounded-3xl p-6 md:p-7 border border-border"
            style={{ backgroundColor: flavor.tint, color: flavor.ink }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-3xl shrink-0 bg-card shadow-candy-1 text-5xl leading-none"
                aria-hidden="true"
              >
                {emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium uppercase tracking-widest"
                    style={{ backgroundColor: flavor.base, color: flavor.tint }}
                  >
                    {skill.category}
                  </span>
                  {!isClaudeSkill && (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-widest border"
                      style={{ backgroundColor: formatFlavor.tint, color: formatFlavor.ink, borderColor: formatFlavor.base }}
                      title={runtime.label}
                    >
                      {runtime.shortLabel}
                    </span>
                  )}
                </div>
                <h1
                  className="text-2xl sm:text-3xl md:text-4xl font-candy font-bold tracking-tight leading-[1.1] mt-2"
                  style={{ color: flavor.ink }}
                >
                  {skill.name}
                </h1>
                <div className="flex items-center gap-3 mt-3 flex-wrap font-mono text-[11px]" style={{ color: flavor.ink }}>
                  <span className="opacity-90"><StarRating value={avgRating} readonly size="sm" showValue count={ratings.length} /></span>
                  <span className="flex items-center gap-1 opacity-80">
                    <Star className="w-3 h-3" /> {starCount}
                  </span>
                  <span className="flex items-center gap-1 opacity-80">
                    <Download className="w-3 h-3" /> {(skill.popularity ?? 0).toLocaleString()}
                  </span>
                </div>
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
            <Card className="border-warning/20 bg-warning/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-warning mt-0.5 shrink-0" />
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
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">Overview</p>
                  <h2 className="text-xl font-candy font-bold mb-3">About this candy</h2>
                  <p className="text-foreground-secondary leading-relaxed">{skill.description}</p>
                </CardContent>
              </Card>

              {/* Install (claude-skill) — non-claude formats get a format-aware
                  section (node list / DSL outline / repo + import CTA) instead. */}
              {isClaudeSkill ? (
                <>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">Get it</p>
                      <h2 className="text-xl font-candy font-bold mb-3">Quick Install</h2>
                      <div className="bg-secondary border border-border rounded-xl p-4 flex items-center justify-between gap-3 font-mono text-sm">
                        <code className="text-foreground truncate">{skill.installCommand}</code>
                        <button
                          onClick={handleCopy}
                          className="flex-shrink-0 p-2 hover:bg-backgroundTertiary rounded-lg transition-colors"
                          aria-label="Copy install command"
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
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">Setup</p>
                        <h2 className="text-xl font-candy font-bold mb-3">Claude Desktop Config</h2>
                        <pre className="bg-secondary border border-border rounded-xl p-4 text-xs overflow-x-auto font-mono text-foreground">
                          {JSON.stringify(skill.config, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <FormatDetailSection skill={skill} accent={formatFlavor} />
              )}

              {/* Related */}
              {relatedSkills.length > 0 && (
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">More in {skill.category}</p>
                  <h2 className="text-xl font-candy font-bold mb-4">Related Skills</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {relatedSkills.map((related, i) => (
                      <CandyCard
                        key={related.id}
                        skill={related}
                        index={i}
                        isInCart={cart.has(related.id)}
                        onSelect={() => navigate(`/candy/${related.id}`)}
                        onRun={() => onRunSkill(related)}
                        onToggleCart={() => onToggleCart(related.id)}
                      />
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
                  <h2 className="text-xl font-candy font-bold mb-3">Rate this Skill</h2>
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
                          <span className="text-xs text-foreground-tertiary font-mono">
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
                className={skill.executionModel === 'managed'
                  ? 'w-full rounded-2xl bg-warning hover:bg-warning/90 text-white shadow-candy-1'
                  : 'w-full rounded-2xl'}
                onClick={() => onRunSkill(skill)}
              >
                {!isClaudeSkill ? <Workflow className="w-4 h-4" /> : skill.executionModel === 'managed' ? <Zap className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                {!isClaudeSkill
                  ? `Open ${runtime.label}`
                  : skill.executionModel === 'managed'
                    ? (skill.price ? `Invoke ($${(skill.price / 100).toFixed(2)}/call)` : 'Invoke Skill')
                    : 'Run Skill'}
              </Button>
              <Button
                variant={inCart ? 'secondary' : 'outline'}
                className="w-full rounded-2xl"
                onClick={() => onToggleCart(skill.id)}
              >
                <Download className="w-4 h-4" />
                {inCart ? 'Remove from Bag' : 'Add to Bag'}
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-2xl"
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
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary">Details</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Category</span>
                  <Badge variant="secondary" size="sm">{skill.category}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Format</span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border"
                    style={{ backgroundColor: formatFlavor.tint, color: formatFlavor.ink, borderColor: formatFlavor.base }}
                  >
                    {runtime.label}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Rating</span>
                  <StarRating value={avgRating} readonly size="sm" showValue />
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Stars</span>
                  <span className="font-mono font-medium">{starCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Installs</span>
                  <span className="font-mono font-medium">{(skill.popularity ?? 0).toLocaleString()}</span>
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
                    <Badge variant="default" size="sm" className="gap-1"><BadgeCheck className="w-3 h-3" /> Canonical</Badge>
                  </div>
                )}
                {skill.executionModel && skill.executionModel !== 'open' && (
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">Execution</span>
                    <span className="text-xs font-medium inline-flex items-center gap-1">
                      {skill.executionModel === 'managed'
                        ? <><Cloud className="w-3 h-3" /> Managed</>
                        : <><Link2 className="w-3 h-3" /> Federated</>}
                    </span>
                  </div>
                )}
                {skill.pricingModel && skill.pricingModel !== 'free' && (
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">Pricing</span>
                    <span className="text-xs font-mono font-medium text-warning">
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
