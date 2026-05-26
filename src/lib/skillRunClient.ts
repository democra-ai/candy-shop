// ============================================================
// Skill fast-path invocation client (Worker + tier-aware backend).
// ============================================================
// Calls POST /api/skill/:id/run on the Cloudflare Worker. The Worker
// branches by skill.execution_model:
//   open    → Workers AI (env.AI)
//   managed → 3rd-party LLM via the caller's BYOK key (no Claude Code,
//             no agentic loop — ~1-2s total)
//   tee     → forwarded to TEE CVM with attestation
// Streams server-sent events: start, delta, attestation?, done | error.
// ============================================================

const API_BASE =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  '/api';

export type SkillRunTier = 'open' | 'managed' | 'tee';

export interface SkillRunCallbacks {
  onStart?: (info: { invocationId: string; tier: SkillRunTier; skillId: string }) => void;
  onDelta?: (text: string) => void;
  onAttestation?: (info: { attestationId: string; codeHash: string; provider: string }) => void;
  onDone?: (summary: {
    invocationId: string;
    durationMs: number;
    tier: SkillRunTier;
    inputTokens: number;
    outputTokens: number;
    outputLength: number;
    entitlement: string;
  }) => void;
  onError?: (err: { message: string; tier?: SkillRunTier }) => void;
  /** 402 from the entitlement gate — caller should redirect to checkout. */
  onPaymentRequired?: (info: { reason: string; pricingModel: string; priceAmount: number }) => void;
}

export interface SkillRunParams {
  input: string;
  /** Override LLM model (managed tier). */
  model?: string;
  /** Which provider to dispatch the managed-tier call to. Default 'workers-ai'
   *  (uses Cloudflare's free daily allocation — no BYOK key needed). */
  byokProvider?: BYOKProvider;
}

export async function runSkill(
  skillId: string,
  params: SkillRunParams,
  cb: SkillRunCallbacks = {},
): Promise<void> {
  const r = await fetch(`${API_BASE}/skill/${encodeURIComponent(skillId)}/run`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (r.status === 402) {
    const body = await r.json().catch(() => ({})) as {
      reason?: string; pricingModel?: string; priceAmount?: number;
    };
    cb.onPaymentRequired?.({
      reason: body.reason ?? 'payment_required',
      pricingModel: body.pricingModel ?? 'unknown',
      priceAmount: body.priceAmount ?? 0,
    });
    return;
  }
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => '');
    cb.onError?.({ message: `Skill run failed (${r.status}): ${text.slice(0, 200)}` });
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = 'message';
      let dataStr = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) {
          dataStr = dataStr ? dataStr + '\n' + line.slice(6) : line.slice(6);
        }
      }
      if (!dataStr) continue;

      let parsed: unknown = dataStr;
      try { parsed = JSON.parse(dataStr); } catch { /* keep raw string */ }

      if (event === 'start') cb.onStart?.(parsed as Parameters<NonNullable<typeof cb.onStart>>[0]);
      else if (event === 'delta') cb.onDelta?.(typeof parsed === 'string' ? parsed : dataStr);
      else if (event === 'attestation') cb.onAttestation?.(parsed as Parameters<NonNullable<typeof cb.onAttestation>>[0]);
      else if (event === 'done') cb.onDone?.(parsed as Parameters<NonNullable<typeof cb.onDone>>[0]);
      else if (event === 'error') cb.onError?.(parsed as Parameters<NonNullable<typeof cb.onError>>[0]);
    }
  }
}

// ── BYOK key management ──────────────────────────────────────
export type BYOKProvider = 'workers-ai' | 'anthropic' | 'openai' | 'groq' | 'cerebras' | 'deepseek' | 'zhipu';

export async function listBYOKKeys(): Promise<{ provider: BYOKProvider; label: string | null; updated_at: string }[]> {
  const r = await fetch(`${API_BASE}/user/byok`, { credentials: 'include' });
  if (!r.ok) return [];
  const j = await r.json() as { keys?: { provider: BYOKProvider; label: string | null; updated_at: string }[] };
  return j.keys ?? [];
}

export async function saveBYOKKey(provider: BYOKProvider, apiKey: string, label?: string): Promise<void> {
  const r = await fetch(`${API_BASE}/user/byok`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey, label }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Save BYOK failed (${r.status}): ${t.slice(0, 200)}`);
  }
}

export async function deleteBYOKKey(provider: BYOKProvider): Promise<void> {
  await fetch(`${API_BASE}/user/byok/${provider}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}
