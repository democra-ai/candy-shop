import { useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { isSupabaseConnected } from '../../lib/dataProvider';
import { toast } from 'sonner';

/**
 * Subscribe to real-time skill/craving inserts.
 * Shows a toast notification when new items are added.
 */
export function useRealtimeNotifications() {
  useEffect(() => {
    if (!isSupabaseConnected()) return;

    const channel = supabase
      .channel('public-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'skills' },
        (payload) => {
          const name = (payload.new as { name?: string })?.name || 'New skill';
          toast.info(`New candy just dropped: ${name}`, {
            duration: 4000,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cravings' },
        (payload) => {
          const title = (payload.new as { title?: string })?.title || 'New craving';
          toast.info(`New craving posted: ${title}`, {
            duration: 4000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
