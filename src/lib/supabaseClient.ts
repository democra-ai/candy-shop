
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isSupabaseConfigured = supabaseUrl && supabaseAnonKey

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials missing. App running in demo mode (auth disabled).')
}

// Mock client for when credentials are missing
const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    signInWithOAuth: async () => ({ error: new Error('Supabase not configured. Auth is disabled.') }),
    signOut: async () => ({ error: null }),
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (mockClient as any)
