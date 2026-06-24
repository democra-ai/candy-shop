// ============================================================
// REAL Supabase client — AUTH / IDENTITY ONLY.
// ============================================================
// This is the genuine @supabase/supabase-js SDK pointed at the real
// Supabase project. It owns the logged-in user's identity:
// OAuth sign-in (Google / GitHub), the PKCE redirect handoff, session
// persistence and refresh, and sign-out.
//
// Data access (.from(), .rpc(), realtime) still goes through the
// Cloudflare-worker shim in ./supabaseClient. Only auth moved here.
//
// OAuth flow:
//   AuthModal → supabaseAuth.auth.signInWithOAuth({ provider, redirectTo })
//            → provider login → Supabase /auth/v1/callback
//            → app /auth/callback (PKCE code in URL)
//            → detectSessionInUrl auto-exchanges the code for a session
//            → AuthCallback reads supabaseAuth.auth.getSession() → '/'.
//
// The logged-in app user (user.id, user.email, user.user_metadata.*)
// is now the REAL Supabase user.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { User, Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surface a clear message rather than letting createClient throw a
  // cryptic error deep in the SDK.
  console.error(
    '[supabaseAuth] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Real Supabase auth will not work.'
  );
}

export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'pkce',
  },
});

// Re-export the real Supabase identity types so call sites that hold the
// logged-in user import them from here instead of the worker shim.
export type { User, Session };
