// ============================================================
// Candy Shop Tweaks — discovery registry.
// ============================================================
// codex-plusplus ships a curated default set and discovers more via
// GitHub. We do the same: a small curated seed list plus a GitHub
// topic search ("candy-tweak") for community tweaks. Each candidate
// repo must have a valid candy-tweak.json at its root.
// ============================================================

import type { RegistryTweak } from './types';
import { fetchManifest } from './runtime';

/** Curated, first-party / trusted tweaks shipped by default. */
export const OFFICIAL_TWEAKS: { repo: string; ref?: string }[] = [
  // Seed entries — these are the reference tweaks. They can be empty
  // initially; the GitHub topic search fills the rest.
  { repo: 'democra-ai/candy-tweak-dark-pro' },
  { repo: 'democra-ai/candy-tweak-keyboard' },
];

const GITHUB_TOPIC = 'candy-tweak';

/** Resolve a list of repo refs into RegistryTweak[] (manifest-validated). */
async function resolveRepos(
  repos: { repo: string; ref?: string }[],
  source: 'official' | 'community'
): Promise<RegistryTweak[]> {
  const out: RegistryTweak[] = [];
  await Promise.all(
    repos.map(async ({ repo, ref }) => {
      try {
        const manifest = await fetchManifest(repo, ref ?? 'main');
        out.push({ repo, manifest, source });
      } catch {
        /* skip repos without a valid manifest */
      }
    })
  );
  return out;
}

/** Discover community tweaks via GitHub topic search, ranked by stars. */
async function discoverCommunity(limit = 30): Promise<RegistryTweak[]> {
  try {
    const r = await fetch(
      `https://api.github.com/search/repositories?q=topic:${GITHUB_TOPIC}&sort=stars&order=desc&per_page=${limit}`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!r.ok) return [];
    const j = (await r.json()) as {
      items?: Array<{ full_name: string; stargazers_count: number }>;
    };
    const repos = (j.items ?? []).map((it) => ({ repo: it.full_name }));
    const resolved = await resolveRepos(repos, 'community');
    // attach stars
    const starMap = new Map((j.items ?? []).map((it) => [it.full_name, it.stargazers_count]));
    for (const t of resolved) t.stars = starMap.get(t.repo) ?? 0;
    return resolved.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
  } catch {
    return [];
  }
}

/** Full registry = official (validated) + community (topic search). */
export async function loadRegistry(): Promise<RegistryTweak[]> {
  const [official, community] = await Promise.all([
    resolveRepos(OFFICIAL_TWEAKS, 'official'),
    discoverCommunity(),
  ]);
  // Dedup by repo, official wins.
  const seen = new Set(official.map((t) => t.repo));
  return [...official, ...community.filter((t) => !seen.has(t.repo))];
}
