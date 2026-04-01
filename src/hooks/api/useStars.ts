import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { storageUtils } from '../../utils/storage';

/**
 * Star system that uses Supabase when available, falls back to localStorage.
 */
export function useStars(skillId: string, userId?: string) {
  const [isStarred, setIsStarred] = useState(false);
  const [starCount, setStarCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Check initial state
  useEffect(() => {
    if (!skillId) return;

    // Always check localStorage as fallback
    setIsStarred(storageUtils.isLiked(skillId));

    // Try Supabase if user is authenticated
    if (userId) {
      (async () => {
        try {
          const { data } = await supabase
            .from('stars')
            .select('id')
            .eq('user_id', userId)
            .eq('skill_id', skillId)
            .maybeSingle();
          if (data) setIsStarred(true);
        } catch {}
      })();

      (async () => {
        try {
          const { count } = await supabase
            .from('stars')
            .select('id', { count: 'exact' })
            .eq('skill_id', skillId);
          if (count !== null) setStarCount(count);
        } catch {}
      })();
    }
  }, [skillId, userId]);

  const toggleStar = useCallback(async () => {
    if (!skillId) return;
    setIsLoading(true);

    try {
      if (isStarred) {
        // Unstar
        storageUtils.removeLike(skillId);
        setIsStarred(false);
        setStarCount((c) => Math.max(0, c - 1));

        if (userId) {
          await supabase
            .from('stars')
            .delete()
            .eq('user_id', userId)
            .eq('skill_id', skillId);

          try { await supabase.rpc('refresh_star_count', { p_skill_id: skillId }); } catch {}
        }
      } else {
        // Star
        storageUtils.saveLike(skillId);
        setIsStarred(true);
        setStarCount((c) => c + 1);

        if (userId) {
          await supabase
            .from('stars')
            .insert({ user_id: userId, skill_id: skillId });

          try { await supabase.rpc('refresh_star_count', { p_skill_id: skillId }); } catch {}
        }
      }
    } catch (err) {
      console.error('Star toggle failed:', err);
      // Revert on error
      setIsStarred(!isStarred);
    } finally {
      setIsLoading(false);
    }
  }, [skillId, userId, isStarred]);

  return { isStarred, starCount, toggleStar, isLoading };
}
