import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Package, Star, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  OFFICIAL_COLLECTIONS,
  COMMUNITY_CATEGORIES,
  AWESOME_REPO_URL,
  TOTAL_OFFICIAL_SKILLS,
  type OfficialCollection,
} from '../../data/officialCollections';
import { cn } from '../../utils/cn';

function CollectionCard({ collection }: { collection: OfficialCollection }) {
  return (
    <a
      href={collection.repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <Card variant="interactive" className="h-full p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
        <CardContent className="p-0">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={cn(
              'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg shrink-0',
              collection.color
            )}>
              <span className="drop-shadow">{collection.icon}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                  {collection.name}
                </h3>
                <ExternalLink className="w-3 h-3 text-foreground-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" size="sm">{collection.org}</Badge>
                <span className="text-xs text-foreground-tertiary flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {collection.skillCount} skills
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-foreground-secondary line-clamp-2 mt-2.5 leading-relaxed">
            {collection.description}
          </p>

          {/* Featured skills */}
          {collection.featured && collection.featured.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {collection.featured.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary text-foreground-tertiary"
                >
                  {skill}
                </span>
              ))}
              {collection.featured.length > 3 && (
                <span className="text-[10px] text-foreground-tertiary self-center">
                  +{collection.featured.length - 3}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </a>
  );
}

interface OfficialCollectionsProps {
  /** compact mode shows fewer items with expand button */
  compact?: boolean;
}

export function OfficialCollections({ compact = false }: OfficialCollectionsProps) {
  const [expanded, setExpanded] = useState(false);

  // In compact mode, show top collections; expanded shows all
  const visibleCollections = compact && !expanded
    ? OFFICIAL_COLLECTIONS.filter(c =>
        ['anthropic', 'openai', 'microsoft', 'vercel', 'google-gemini', 'huggingface',
         'cloudflare', 'expo', 'trail-of-bits', 'figma', 'gstack', 'firecrawl'].includes(c.id)
      )
    : OFFICIAL_COLLECTIONS;

  // Deduplicate stripe which appears in two sections
  const seen = new Set<string>();
  const deduped = visibleCollections.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return (
    <section className="py-12 bg-background">
      <div className="container max-w-7xl mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-candy font-bold text-foreground">
                Official Skill Collections
              </h2>
              <p className="text-sm text-foreground-tertiary font-mono">
                {TOTAL_OFFICIAL_SKILLS}+ skills from {OFFICIAL_COLLECTIONS.length} organizations
              </p>
            </div>
          </div>
          <a
            href={AWESOME_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            awesome-agent-skills
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Source attribution */}
        <div className="mb-6 flex items-center gap-2 text-xs text-foreground-tertiary">
          <span>Curated from</span>
          <a
            href={AWESOME_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
          >
            VoltAgent/awesome-agent-skills
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="hidden sm:inline">
            — compatible with Claude Code, Codex, Gemini CLI, Cursor, Copilot, and more
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {deduped.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>

        {/* Expand / Collapse for compact mode */}
        {compact && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-foreground-secondary hover:text-foreground bg-secondary hover:bg-secondary/80 transition-all"
            >
              {expanded ? (
                <>Show Less <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Show All {OFFICIAL_COLLECTIONS.length} Collections <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          </div>
        )}

        {/* Community categories */}
        <div className="mt-10">
          <h3 className="text-lg font-candy font-semibold text-foreground mb-4 flex items-center gap-2">
            Community Skills
            <Badge variant="secondary" size="sm">open source</Badge>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {COMMUNITY_CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`${AWESOME_REPO_URL}#${cat.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card variant="interactive" className="p-3 text-center hover:shadow-md transition-all">
                  <CardContent className="p-0">
                    <span className="text-2xl block mb-1">{cat.icon}</span>
                    <div className="text-xs font-medium text-foreground truncate">{cat.name}</div>
                    <div className="text-[10px] text-foreground-tertiary mt-0.5">{cat.count} skills</div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>

        {/* CTA to full repo */}
        <div className="mt-8 text-center">
          <a
            href={AWESOME_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            Browse all 1,060+ skills on GitHub
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
