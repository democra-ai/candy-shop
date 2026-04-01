import { supabase } from './supabaseClient';

/**
 * Check if Supabase is properly configured (not a mock client).
 */
export function isSupabaseConnected(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !key) return false;
  if (url.includes('YOUR_') || key.includes('YOUR_')) return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seed skills data into Supabase from the static SKILLS_DATA array.
 * Only runs once per session.
 */
let seeded = false;

export async function seedSkillsIfNeeded(skills: Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  tags: string[];
  installCommand: string;
  repo: string;
  skillMdUrl: string;
  config: Record<string, unknown>;
  popularity: number;
  greeting?: string;
}>) {
  if (seeded || !isSupabaseConnected()) return;
  seeded = true;

  // Check if skills table has data
  const { count } = await supabase
    .from('skills')
    .select('id', { count: 'exact', head: true });

  if (count && count > 0) return; // Already seeded

  // Batch insert in chunks of 100
  const chunks = [];
  for (let i = 0; i < skills.length; i += 100) {
    chunks.push(skills.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const rows = chunk.map((s) => ({
      name: s.name,
      description: s.description,
      category: s.category,
      icon: s.icon,
      color: s.color,
      tags: s.tags,
      install_command: s.installCommand,
      repo: s.repo,
      skill_md_url: s.skillMdUrl,
      config: s.config,
      popularity: s.popularity,
      greeting: s.greeting || null,
      is_public: true,
      status: 'active',
    }));

    try { await supabase.from('skills').insert(rows); } catch {}
  }
}
