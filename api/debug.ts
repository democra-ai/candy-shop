// GET /api/debug — Debug endpoint to test _lib imports
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const results: Record<string, string> = {};

  // Test 1: basic response
  results.basic = 'ok';

  // Test 2: import cors
  try {
    const { cors } = await import('./_lib/cors');
    results.cors_import = 'ok';
  } catch (e: any) {
    results.cors_import = `FAIL: ${e.message}`;
  }

  // Test 3: import supabase
  try {
    const { supabaseAdmin, isSupabaseConfigured } = await import('./_lib/supabase');
    results.supabase_import = 'ok';
    results.supabase_configured = String(isSupabaseConfigured);
  } catch (e: any) {
    results.supabase_import = `FAIL: ${e.message}`;
  }

  // Test 4: import stripe-provider
  try {
    const { isStripeConfigured } = await import('./_lib/stripe-provider');
    results.stripe_import = 'ok';
    results.stripe_configured = String(isStripeConfigured());
  } catch (e: any) {
    results.stripe_import = `FAIL: ${e.message}`;
  }

  // Test 5: import x402-provider
  try {
    const { isX402Configured } = await import('./_lib/x402-provider');
    results.x402_import = 'ok';
    results.x402_configured = String(isX402Configured());
  } catch (e: any) {
    results.x402_import = `FAIL: ${e.message}`;
  }

  return res.json(results);
}
