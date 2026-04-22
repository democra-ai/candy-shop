// ============================================================
// usePaymentRedirect — handles Stripe checkout redirect back
// ============================================================
//
// When Stripe redirects users back after checkout, the URL looks like:
//   /skills/library?payment=success&session_id=cs_xxx  (success)
//   /?payment=cancelled                                (user cancelled)
//
// This hook:
//   1. Detects those query params on any route
//   2. On success: verifies the session, installs purchased skills to
//      local storage, clears the cart, shows a toast, cleans the URL
//   3. On cancel: shows a cancellation toast and cleans the URL
//   4. De-duplicates per session_id (React StrictMode safe)
// ============================================================

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { usePayment } from './usePayment';
import { SKILLS_DATA, type Skill as StoreSkill } from '../data/skillsData';
import { storageUtils } from '../utils/storage';
import type { SkillCategory } from '../types/skill-creator';

type PaymentApi = ReturnType<typeof usePayment>;

interface UsePaymentRedirectOptions {
  payment: PaymentApi;
  onClearCart: () => void;
}

function installPurchasedSkill(storeSkill: StoreSkill) {
  const existing = storageUtils
    .getSkills()
    .find((s) => s.name === storeSkill.name && s.origin === 'store');
  if (existing) return;

  storageUtils.saveSkill({
    name: storeSkill.name,
    description: storeSkill.description,
    category: storeSkill.category as SkillCategory,
    icon: storeSkill.icon,
    color: storeSkill.color,
    tags: storeSkill.tags || [storeSkill.category],
    config: {
      capabilities: [],
      systemPrompt: '',
      parameters: storeSkill.config,
      tools: [],
    },
    origin: 'store',
    status: 'active',
    sourceFiles: [],
    installCommand: storeSkill.installCommand,
  });
}

export function usePaymentRedirect({ payment, onClearCart }: UsePaymentRedirectOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  // Track sessions we've already processed so StrictMode / re-renders
  // don't fire the verify twice.
  const processedRef = useRef<Set<string>>(new Set());
  const cancelHandledRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentStatus = params.get('payment');
    const sessionId = params.get('session_id');

    if (!paymentStatus) return;

    // ── Cancellation ─────────────────────────────────────────
    if (paymentStatus === 'cancelled') {
      if (cancelHandledRef.current) return;
      cancelHandledRef.current = true;

      toast.info('Checkout cancelled — your cart is still here.');

      // Strip the query params, preserve the path
      params.delete('payment');
      const nextSearch = params.toString();
      navigate(
        `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
        { replace: true },
      );
      return;
    }

    // ── Success ──────────────────────────────────────────────
    if (paymentStatus === 'success' && sessionId) {
      if (processedRef.current.has(sessionId)) return;
      processedRef.current.add(sessionId);

      const loadingId = toast.loading('Confirming your purchase...');

      (async () => {
        try {
          const result = await payment.verify(sessionId);

          if (result.paid) {
            // Install each purchased skill locally (mirrors the free-skill flow)
            const purchased = (result.skillIds || [])
              .map((id) => SKILLS_DATA.find((s) => s.id === id))
              .filter((s): s is StoreSkill => !!s);

            purchased.forEach(installPurchasedSkill);
            onClearCart();

            toast.success(
              purchased.length > 0
                ? `Payment successful! Installed ${purchased.length} skill${purchased.length === 1 ? '' : 's'}.`
                : 'Payment successful!',
              { id: loadingId },
            );
          } else {
            toast.error(
              `Payment not completed (status: ${result.status ?? 'unknown'}).`,
              { id: loadingId },
            );
          }
        } catch (err) {
          console.error('[usePaymentRedirect] verify failed:', err);
          toast.error('Could not confirm payment. Please check your email for a receipt.', {
            id: loadingId,
          });
        } finally {
          // Clean up the URL regardless of verify outcome
          params.delete('payment');
          params.delete('session_id');
          const nextSearch = params.toString();
          navigate(
            `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
            { replace: true },
          );
        }
      })();
    }
    // We intentionally depend only on location — payment/onClearCart are
    // stable enough and we re-fire only when the URL actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);
}
