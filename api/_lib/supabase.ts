// Server-side Supabase client (lazy initialization)
let _createClient: any = null;
let _client: any = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return !!url && !!key && !url.includes('YOUR_');
}

export async function getSupabaseAdmin() {
  if (_client) return _client;

  if (!_createClient) {
    const mod = await import('@supabase/supabase-js');
    _createClient = mod.createClient;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !key || url.includes('YOUR_')) {
    // Return a mock that returns empty results
    _client = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }), data: [], error: null }), in: () => ({ data: [], error: null }), order: () => ({ data: [], error: null }), data: [], error: null }),
        insert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }), data: null, error: null }),
        update: () => ({ eq: () => ({ data: null, error: null }) }),
        upsert: () => ({ data: null, error: null }),
      }),
      rpc: () => ({ data: null, error: null }),
    };
  } else {
    _client = _createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return _client;
}

// Convenience: backwards-compatible sync export that triggers lazy init on first use
// This won't work for direct property access — callers must use getSupabaseAdmin()
export const supabaseAdmin = null as any; // deprecated — use getSupabaseAdmin()
