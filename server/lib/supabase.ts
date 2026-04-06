// Server-side Supabase client (uses service role key for admin operations)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isConfigured = !!supabaseUrl && !!supabaseServiceKey;

if (!isConfigured) {
  console.warn(
    '⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
    '   Payment records will not be persisted to database.'
  );
}

// Use a dummy URL when not configured to prevent crash during import.
// Operations will be no-ops (the proxy handles errors gracefully).
export const supabaseAdmin: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    });

export { isConfigured as isSupabaseConfigured };
