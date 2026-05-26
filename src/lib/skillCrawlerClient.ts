// ============================================================
// Client for skill-crawler worker.
// ============================================================
// Source-of-truth: https://skill-crawler.tao-shen.workers.dev
// 15,000+ SKILL.md entries crawled from skills.sh sitemap + audited
// by Gen Agent Trust Hub / Socket / Snyk.
// ============================================================

const CRAWLER_BASE =
  (import.meta.env.VITE_SKILL_CRAWLER_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://skill-crawler.tao-shen.workers.dev';

export interface AuditSummary {
  pass: number;
  warn: number;
  fail: number;
  max_risk: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
}

export interface CrawlerSkill {
  id: string;
  source: 'github' | 'gitlab';
  owner: string;
  repo: string;
  branch: string;
  path: string;
  raw_url: string;
  html_url: string;
  skill_name: string | null;
  description: string | null;
  category: string | null;
  author_login: string | null;
  author_avatar_url: string | null;
  author_html_url: string | null;
  stars: number;
  forks: number;
  license: string | null;
  topics_json: string | null;
  last_commit_at: number | null;
  editors_choice: 0 | 1;
  editors_choice_reason:
    | 'seed_repo'
    | 'official_org'
    | 'star_threshold'
    | 'skills_sh_curated'
    | 'manual'
    | null;
  first_seen_at: number;
  updated_at: number;
  audit_summary?: AuditSummary | null;
}

export interface CrawlerAudit {
  provider: string;
  provider_slug: string;
  status: 'pass' | 'warn' | 'fail';
  risk_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  summary: string | null;
  audited_at: number;
  categories_json: string | null;
  source_url: string | null;
}

export interface CrawlerSkillDetail extends CrawlerSkill {
  audits: CrawlerAudit[];
  content_sha256: string;
  content_bytes: number;
  topics_json: string | null;
  default_branch: string | null;
  last_commit_sha: string | null;
}

export interface ListSkillsParams {
  /** 'stars' (default), 'recent', 'name' */
  sort?: 'stars' | 'recent' | 'name';
  limit?: number;
  offset?: number;
  /** If true, only Editor's Choice entries. */
  editorsChoice?: boolean;
  /** Full-text search (matches name, description, owner, repo). */
  q?: string;
}

export interface ListSkillsResponse {
  items: CrawlerSkill[];
  sort: string;
  limit: number;
  offset: number;
  editorsChoice: boolean;
  q?: string;
}

/** Paginated list of skills, optionally filtered. */
export async function listSkills(params: ListSkillsParams = {}): Promise<ListSkillsResponse> {
  const u = new URL(`${CRAWLER_BASE}/api/skills`);
  if (params.sort) u.searchParams.set('sort', params.sort);
  if (params.limit) u.searchParams.set('limit', String(params.limit));
  if (params.offset) u.searchParams.set('offset', String(params.offset));
  if (params.editorsChoice) u.searchParams.set('editors_choice', '1');
  if (params.q) u.searchParams.set('q', params.q);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`skill-crawler list failed: HTTP ${r.status}`);
  return await r.json();
}

/** Full metadata for one skill, including all audit entries. */
export async function getSkill(id: string): Promise<CrawlerSkillDetail | null> {
  const r = await fetch(`${CRAWLER_BASE}/api/skills/${encodeURIComponent(id)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`skill-crawler get failed: HTTP ${r.status}`);
  return await r.json();
}

/** Raw SKILL.md content (markdown text) from R2. */
export async function getSkillContent(id: string): Promise<string | null> {
  const r = await fetch(`${CRAWLER_BASE}/api/skills/${encodeURIComponent(id)}/content`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`skill-crawler content failed: HTTP ${r.status}`);
  return await r.text();
}

/** Provider display config used by audit badges. */
export const AUDIT_PROVIDERS = [
  { slug: 'agent-trust-hub', label: 'Gen', tone: 'gen' },
  { slug: 'socket', label: 'Socket', tone: 'socket' },
  { slug: 'snyk', label: 'Snyk', tone: 'snyk' },
] as const;
