// ============================================================
// TEE Proxy — Tier 2 Confidential Skill Execution
// ============================================================
//
// Forwards a skill invocation to its TEE endpoint (e.g. Phala CVM),
// receives the result + attestation document, records the attestation,
// and returns both to the caller.
//
// The TEE endpoint is expected to expose:
//   POST {endpoint}/invoke
//   body: { skillId, input, callerId, nonce }
//   returns: { result, attestation: { codeHash, provider, payload, signature } }
//
// We trust the TEE to execute the prompt and never leak it. The
// attestation proves the container running inside the enclave matches
// the published code_hash. Verification chain (Intel TDX / AMD SEV-SNP
// / Phala dstack) is pluggable — MVP records; full verifier is a TODO.
// ============================================================

import crypto from 'crypto';
import { supabaseAdmin } from './supabase.js';
import { verifyAttestation as runVerifier } from './tee-verifier.js';

export interface TeeInvokeRequest {
  skillId: string;
  input: unknown;
  callerId: string;
}

export interface TeeAttestation {
  codeHash: string;
  provider: 'phala' | 'aws-nitro' | 'gcp-cs' | 'azure-cc' | 'oasis';
  payload: Record<string, unknown>;   // raw attestation doc (quote, certs, nonce)
  signature?: string;
  verifiedAt: string;
}

export interface TeeInvokeResponse {
  result: unknown;
  attestation: TeeAttestation;
  attestationId?: string;             // row id in tee_attestations (after recording)
}

export interface TeeSkillConfig {
  id: string;
  tee_provider: string | null;
  tee_endpoint: string | null;
  tee_code_hash: string | null;
}

const TEE_TIMEOUT_MS = Number(process.env.TEE_TIMEOUT_MS || 30000);
const PLATFORM_HMAC_KEY = process.env.TEE_PLATFORM_SIGNING_KEY || '';
// PEM-encoded ed25519 private key (set TEE_PLATFORM_ED25519_KEY to enable).
// Preferred over HMAC for multi-tenant deploys — the CVM only needs the public key.
const PLATFORM_ED25519_PRIV = process.env.TEE_PLATFORM_ED25519_KEY || '';

// Lazy-parse the ed25519 key once
let _ed25519Key: crypto.KeyObject | null = null;
function ed25519Key(): crypto.KeyObject | null {
  if (_ed25519Key) return _ed25519Key;
  if (!PLATFORM_ED25519_PRIV) return null;
  try {
    _ed25519Key = crypto.createPrivateKey({
      key: PLATFORM_ED25519_PRIV.includes('BEGIN') ? PLATFORM_ED25519_PRIV : Buffer.from(PLATFORM_ED25519_PRIV, 'base64'),
      format: PLATFORM_ED25519_PRIV.includes('BEGIN') ? 'pem' : 'der',
      type: 'pkcs8',
    });
    return _ed25519Key;
  } catch (err) {
    console.error('Invalid TEE_PLATFORM_ED25519_KEY:', err);
    return null;
  }
}

// Returns { alg, sig } — alg indicates what the CVM should verify with.
// Preference order: ed25519 > HMAC > unsigned (dev only).
function signPlatformRequest(body: string, nonce: string): { alg: string; sig: string } {
  const key = ed25519Key();
  if (key) {
    const sig = crypto.sign(null, Buffer.from(body + nonce), key);
    return { alg: 'ed25519', sig: sig.toString('base64') };
  }
  if (PLATFORM_HMAC_KEY) {
    return { alg: 'hmac-sha256', sig: crypto.createHmac('sha256', PLATFORM_HMAC_KEY).update(body + nonce).digest('hex') };
  }
  return { alg: 'none', sig: '' };
}

// ── Call the TEE endpoint ──────────────────────────────────

export async function proxyToTEE(
  skill: TeeSkillConfig,
  req: TeeInvokeRequest,
): Promise<TeeInvokeResponse> {
  if (!skill.tee_endpoint) {
    throw new Error(`Skill ${skill.id} has execution_model=tee but no tee_endpoint`);
  }

  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ skillId: skill.id, input: req.input, callerId: req.callerId, nonce });
  const { alg, sig } = signPlatformRequest(body, nonce);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TEE_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(`${skill.tee_endpoint.replace(/\/$/, '')}/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform-Signature': sig,
        'X-Platform-Sig-Alg': alg,
        'X-Nonce': nonce,
      },
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`TEE endpoint returned ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json() as { result: unknown; attestation: TeeAttestation };

  if (!data.attestation || !data.attestation.codeHash) {
    throw new Error('TEE response missing attestation');
  }

  const verdict = await runVerifier({
    attestation: data.attestation,
    expectedCodeHash: skill.tee_code_hash,
    nonce,
  });

  if (!verdict.valid) {
    throw new Error(`TEE attestation rejected (${verdict.strategy}): ${verdict.reasons.join('; ')}`);
  }

  const attestationId = await recordAttestation(skill.id, data.attestation, `platform:${verdict.strategy}`, verdict.valid);
  return { result: data.result, attestation: data.attestation, attestationId };
}

// ── Persist attestation + bump skill.tee_last_verified_at ──

export async function recordAttestation(
  skillId: string,
  attestation: TeeAttestation,
  verifier: string,
  valid: boolean,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('tee_attestations')
    .insert({
      skill_id: skillId,
      code_hash: attestation.codeHash,
      provider: attestation.provider,
      payload: attestation.payload,
      signature: attestation.signature ?? null,
      valid,
      verifier,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to record attestation:', error);
    return '';
  }

  if (valid) {
    await supabaseAdmin
      .from('skills')
      .update({ tee_last_verified_at: new Date().toISOString() })
      .eq('id', skillId);
  }

  return (data as { id: string } | null)?.id ?? '';
}

// Attestation verification lives in ./tee-verifier.ts — pluggable strategies
// selected via TEE_VERIFIER env (local | phala | intel).
export { verifyAttestation as runVerifier } from './tee-verifier.js';
