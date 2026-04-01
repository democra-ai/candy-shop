import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface Rating {
  id: string;
  user_id: string;
  skill_id: string;
  score: number;
  comment: string;
  created_at: string;
}

export function useRatings(skillId: string) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [userRating, setUserRating] = useState<Rating | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!skillId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('skill_id', skillId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRatings(data || []);

      if (data && data.length > 0) {
        const avg = data.reduce((sum: number, r: Rating) => sum + r.score, 0) / data.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
    } catch {
      // Supabase not available, use defaults
    } finally {
      setIsLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const rate = async (userId: string, score: number, comment: string = '') => {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .upsert(
          { user_id: userId, skill_id: skillId, score, comment, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,skill_id' }
        )
        .select()
        .single();

      if (error) throw error;

      setUserRating(data);
      try { await supabase.rpc('refresh_avg_rating', { p_skill_id: skillId }); } catch {}
      await fetch();

      return data;
    } catch (err) {
      console.error('Rating failed:', err);
      throw err;
    }
  };

  return { ratings, avgRating, userRating, rate, isLoading, refetch: fetch };
}
