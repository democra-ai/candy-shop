import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export function useDownloads() {
  const [isLoading, setIsLoading] = useState(false);

  const trackDownload = useCallback(async (skillId: string) => {
    setIsLoading(true);
    try {
      await supabase.rpc('increment_download', { p_skill_id: skillId });
    } catch {
      // Supabase not available — silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { trackDownload, isLoading };
}
