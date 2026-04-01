import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface SupabaseSkill {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  tags: string[];
  install_command: string;
  repo: string;
  skill_md_url: string;
  config: Record<string, unknown>;
  greeting: string | null;
  popularity: number;
  download_count: number;
  star_count: number;
  avg_rating: number;
  status: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface UseSkillsOptions {
  category?: string;
  search?: string;
  sortBy?: 'popularity' | 'recent' | 'stars' | 'rating';
  limit?: number;
  offset?: number;
}

export function useSupabaseSkills(options: UseSkillsOptions = {}) {
  const [data, setData] = useState<SupabaseSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [count, setCount] = useState(0);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('skills')
        .select('*', { count: 'exact' })
        .eq('is_public', true)
        .eq('status', 'active');

      if (options.category) {
        query = query.eq('category', options.category);
      }

      if (options.search) {
        query = query.textSearch('fts', options.search, { type: 'websearch' });
      }

      switch (options.sortBy) {
        case 'stars':
          query = query.order('star_count', { ascending: false });
          break;
        case 'rating':
          query = query.order('avg_rating', { ascending: false });
          break;
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('popularity', { ascending: false });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 12) - 1);
      }

      const { data: skills, error: err, count: total } = await query;

      if (err) throw err;
      setData(skills || []);
      setCount(total || 0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch skills'));
    } finally {
      setIsLoading(false);
    }
  }, [options.category, options.search, options.sortBy, options.limit, options.offset]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, count, refetch: fetch };
}

export function useSupabaseSkill(id: string | undefined) {
  const [data, setData] = useState<SupabaseSkill | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    async function fetch() {
      setIsLoading(true);
      try {
        const { data: skill, error: err } = await supabase
          .from('skills')
          .select('*')
          .eq('id', id)
          .single();

        if (err) throw err;
        setData(skill);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch skill'));
      } finally {
        setIsLoading(false);
      }
    }

    fetch();
  }, [id]);

  return { data, isLoading, error };
}

export function useCreateSkill() {
  const [isLoading, setIsLoading] = useState(false);

  const create = async (skill: Partial<SupabaseSkill>) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('skills')
        .insert(skill)
        .select()
        .single();

      if (error) throw error;
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  return { create, isLoading };
}
