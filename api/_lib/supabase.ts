// Server-side Supabase client (uses service role key for admin operations)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isConfigured = !!supabaseUrl && !!supabaseServiceKey;

export const supabaseAdmin: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    });

export { isConfigured as isSupabaseConfigured };
