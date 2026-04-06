// ============================================================
// Payment API Routes — Stripe Checkout + Session Verification
// ============================================================

import { Router, type Request, type Response } from 'express';
import {
  createStripeCheckout,
  verifyStripeSession,
  isStripeConfigured,
} from '../lib/stripe-provider.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const paymentRouter = Router();

// ── POST /api/payment/checkout ──────────────────────────────
// Creates a Stripe checkout session for the given skill IDs.

paymentRouter.post('/checkout', async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Stripe is not configured on this server' });
      return;
    }

    const { skillIds, userId, successUrl, cancelUrl } = req.body;

    if (!skillIds?.length || !userId) {
      res.status(400).json({ error: 'skillIds and userId are required' });
      return;
    }

    // Fetch skill pricing from DB
    const { data: skills, error } = await supabaseAdmin
      .from('skills')
      .select('id, name, description, price_amount, price_currency, pricing_model, icon')
      .in('id', skillIds);

    if (error || !skills?.length) {
      res.status(404).json({ error: 'Skills not found' });
      return;
    }

    const items = skills
      .filter(s => s.pricing_model !== 'free' && s.price_amount > 0)
      .map(s => ({
        skillId: s.id,
        name: s.name,
        description: s.description || `AI Skill: ${s.name}`,
        amount: s.price_amount,
        currency: s.price_currency || 'usd',
      }));

    if (items.length === 0) {
      // All selected skills are free — no payment needed
      res.json({ free: true, skillIds });
      return;
    }

    const origin = req.headers.origin || 'http://localhost:5173';
    const result = await createStripeCheckout({
      userId,
      items,
      successUrl: successUrl || `${origin}/skills/library?payment=success`,
      cancelUrl: cancelUrl || `${origin}/?payment=cancelled`,
    });

    res.json({
      provider: 'stripe',
      sessionId: result.sessionId,
      checkoutUrl: result.checkoutUrl,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── GET /api/payment/verify/:sessionId ──────────────────────
// Verifies a Stripe checkout session status.

paymentRouter.get('/verify/:sessionId', async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Stripe is not configured' });
      return;
    }

    const { sessionId } = req.params;
    const result = await verifyStripeSession(sessionId);

    res.json({
      paid: result.paid,
      status: result.status,
      skillIds: result.skillIds,
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Failed to verify session' });
  }
});

// ── GET /api/payment/entitlements/:userId ────────────────────
// Returns all entitlements for a user.

paymentRouter.get('/entitlements/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('entitlements')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch entitlements' });
      return;
    }

    res.json({ entitlements: data || [] });
  } catch (err) {
    console.error('Entitlements error:', err);
    res.status(500).json({ error: 'Failed to fetch entitlements' });
  }
});

// ── GET /api/payment/purchases/:userId ──────────────────────
// Returns purchase history for a user.

paymentRouter.get('/purchases/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('purchases')
      .select('*, skills(name, icon, category)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch purchases' });
      return;
    }

    res.json({ purchases: data || [] });
  } catch (err) {
    console.error('Purchases error:', err);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// ── GET /api/payment/check/:userId/:skillId ─────────────────
// Quick check: does the user have access to this skill?

paymentRouter.get('/check/:userId/:skillId', async (req: Request, res: Response) => {
  try {
    const { userId, skillId } = req.params;

    // Check if skill is free
    const { data: skill } = await supabaseAdmin
      .from('skills')
      .select('pricing_model, price_amount')
      .eq('id', skillId)
      .single();

    if (!skill || skill.pricing_model === 'free' || skill.price_amount === 0) {
      res.json({ hasAccess: true, reason: 'free' });
      return;
    }

    // Check entitlement
    const { data: result } = await supabaseAdmin
      .rpc('check_entitlement', { p_user_id: userId, p_skill_id: skillId });

    res.json({ hasAccess: !!result, reason: result ? 'purchased' : 'payment_required' });
  } catch (err) {
    console.error('Check error:', err);
    res.status(500).json({ error: 'Failed to check access' });
  }
});
