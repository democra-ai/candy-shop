import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface SupabaseCraving {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  category: string;
  tags: string[];
  budget: string;
  urgency: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'fulfilled';
  emoji: string;
  match_count: number;
  posted_by: string;
  created_at: string;
  updated_at: string;
}

interface UseCravingsOptions {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useSupabaseCravings(options: UseCravingsOptions = {}) {
  const [data, setData] = useState<SupabaseCraving[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [count, setCount] = useState(0);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('cravings')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (options.status) {
        query = query.eq('status', options.status);
      }

      if (options.search) {
        query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 9) - 1);
      }

      const { data: cravings, error: err, count: total } = await query;

      if (err) throw err;
      setData(cravings || []);
      setCount(total || 0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch cravings'));
    } finally {
      setIsLoading(false);
    }
  }, [options.status, options.search, options.limit, options.offset]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, count, refetch: fetch };
}

export function useCreateCraving() {
  const [isLoading, setIsLoading] = useState(false);

  const create = async (craving: Partial<SupabaseCraving>) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cravings')
        .insert(craving)
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
