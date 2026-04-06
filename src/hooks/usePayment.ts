// ============================================================
// usePayment — React hook for skill payment flow
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import {
  createCheckout,
  verifyPayment,
  getEntitlements,
  checkAccess,
  checkPaymentHealth,
  formatPrice,
} from '../lib/payment/payment-client';
import type { Entitlement } from '../lib/payment/types';

interface PaymentState {
  loading: boolean;
  error: string | null;
  checkoutUrl: string | null;
  sessionId: string | null;
}

interface PaymentProviderStatus {
  stripe: boolean;
  x402: boolean;
  checked: boolean;
}

export function usePayment(userId?: string) {
  const [state, setState] = useState<PaymentState>({
    loading: false,
    error: null,
    checkoutUrl: null,
    sessionId: null,
  });

  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [providers, setProviders] = useState<PaymentProviderStatus>({
    stripe: false, x402: false, checked: false,
  });

  // Check payment server availability on mount
  useEffect(() => {
    checkPaymentHealth().then(health => {
      setProviders({
        stripe: health.providers.stripe,
        x402: health.providers.x402,
        checked: true,
      });
    });
  }, []);

  // Load entitlements when userId changes
  useEffect(() => {
    if (!userId) return;
    getEntitlements(userId)
      .then(setEntitlements)
      .catch(() => setEntitlements([]));
  }, [userId]);

  // ── Start Checkout ──────────────────────────────────────

  const startCheckout = useCallback(async (skillIds: string[]) => {
    if (!userId) {
      setState(s => ({ ...s, error: 'Please sign in to purchase' }));
      return null;
    }

    setState({ loading: true, error: null, checkoutUrl: null, sessionId: null });

    try {
      const result = await createCheckout({ skillIds, userId });

      if (result.sessionId === 'free') {
        // All skills are free — no payment needed
        setState({ loading: false, error: null, checkoutUrl: null, sessionId: 'free' });
        return { free: true };
      }

      setState({
        loading: false,
        error: null,
        checkoutUrl: result.checkoutUrl || null,
        sessionId: result.sessionId,
      });

      // Redirect to Stripe checkout
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      setState({ loading: false, error: message, checkoutUrl: null, sessionId: null });
      return null;
    }
  }, [userId]);

  // ── Verify Payment (after redirect back) ────────────────

  const verify = useCallback(async (sessionId: string) => {
    try {
      const result = await verifyPayment(sessionId);
      if (result.paid && userId) {
        // Refresh entitlements
        const updated = await getEntitlements(userId);
        setEntitlements(updated);
      }
      return result;
    } catch {
      return { paid: false, status: 'error', skillIds: [] as string[] };
    }
  }, [userId]);

  // ── Check Access ────────────────────────────────────────

  const hasAccess = useCallback(async (skillId: string): Promise<boolean> => {
    if (!userId) return false;

    // Check local entitlements first
    const local = entitlements.find(e => e.skillId === skillId);
    if (local) {
      if (local.type === 'permanent') return true;
      if (local.type === 'subscription' && local.expiresAt) {
        return new Date(local.expiresAt) > new Date();
      }
      if (local.type === 'per_call' && local.remainingCalls) {
        return local.remainingCalls > 0;
      }
    }

    // Fallback to server check
    try {
      const result = await checkAccess(userId, skillId);
      return result.hasAccess;
    } catch {
      return false;
    }
  }, [userId, entitlements]);

  return {
    ...state,
    providers,
    entitlements,
    startCheckout,
    verify,
    hasAccess,
    formatPrice,
  };
}
