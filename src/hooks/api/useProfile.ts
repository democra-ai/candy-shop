import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  namespace: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    async function fetch() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        setProfile(data);
      } catch {
        // Profile table might not exist yet
      } finally {
        setIsLoading(false);
      }
    }

    fetch();
  }, [userId]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert(
          { id: userId, ...updates, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      return data;
    } catch (err) {
      console.error('Profile update failed:', err);
      throw err;
    }
  };

  return { profile, isLoading, updateProfile };
}
