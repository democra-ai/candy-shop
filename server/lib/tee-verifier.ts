// ============================================================
// TEE Attestation Verifier — pluggable strategy
// ============================================================
//
// Strategies (selected via TEE_VERIFIER env var):
//   local  — structural + freshness + codeHash/MRTD/nonce binding (no network)
//   phala  — local checks + remote verification via Phala's service
//   intel  — TODO: full Intel TDX/SGX quote parse + PCK cert chain walk
//
// All strategies share the same local checks. Remote only adds network
// calls on top. Anything that can't be verified locally gets a clear
// `reason` in the result instead of silently passing.
// ============================================================

import type { TeeAttestation } from './tee-proxy.js';
import { verifyTdxQuote } from './tdx-quote-parser.js';

export interface VerifierInput {
  attestation: TeeAttestation;
  expectedCodeHash?: string | null;   // from skills.tee_code_hash
  expectedMrtd?: string | null;       // from skills.tee_mrtd (future)
  nonce?: string;                     // the nonce we sent — must appear in quote user_data
}

export interface VerifierResult {
  valid: boolean;
  strategy: 'local' | 'phala' | 'intel';
  reasons: string[];                   // empty when valid === true
  checks: {
    shape: boolean;
    freshness: boolean;
    codeHash: boolean;
    mrtd: boolean;
    nonceBinding: boolean;
    signature: boolean;                // only set by phala/intel strategies
  };
}

const FRESHNESS_MAX_AGE_MS = Number(process.env.TEE_ATTESTATION_MAX_AGE_MS || 24 * 60 * 60 * 1000);

// ── Entry point ────────────────────────────────────────────

export async function verifyAttestation(input: VerifierInput): Promise<VerifierResult> {
  const strategy = (process.env.TEE_VERIFIER || 'local') as 'local' | 'phala' | 'intel';
  const base = runLocalChecks(input);

  if (strategy === 'local' || !base.valid) {
    return { ...base, strategy: 'local' };
  }

  if (strategy === 'phala') {
    const remote = await runPhalaRemote(input);
    return mergeResults(base, remote, 'phala');
  }

  if (strategy === 'intel') {
    const intel = runIntelTdx(input);
    return mergeResults(base, intel, 'intel');
  }

  return { ...base, strategy: 'local' };
}

// ── Intel TDX structural + nonce-binding verification ───────
// Full DCAP/PCK chain walking still delegates to Phala or an external
// verifier — this extracts & checks what we CAN verify locally.

function runIntelTdx(input: VerifierInput): Partial<VerifierResult> {
  const quoteHex = (input.attestation.payload as Record<string, unknown>)?.quote;
  if (typeof quoteHex !== 'string' || !quoteHex.length) {
    return {
      reasons: ['intel strategy: payload.quote missing or not a hex string'],
      valid: false,
      checks: { shape: true, freshness: true, codeHash: true, mrtd: false, nonceBinding: false, signature: false },
    };
  }

  const verdict = verifyTdxQuote({
    quote: quoteHex,
    nonce: input.nonce ?? '',
    expectedMrtd: input.expectedMrtd ?? null,
  });

  return {
    valid: verdict.valid,
    reasons: verdict.reasons,
    checks: {
      shape: verdict.checks.parsed,
      freshness: true,                                 // local-strategy already checked
      codeHash: true,                                  // local-strategy already checked
      mrtd: verdict.checks.mrtdMatches,
      nonceBinding: verdict.checks.reportDataBindsNonce,
      signature: verdict.checks.signatureVerified,
    },
  };
}

// ── Local structural checks ─────────────────────────────────

function runLocalChecks(input: VerifierInput): VerifierResult {
  const { attestation, expectedCodeHash, expectedMrtd, nonce } = input;
  const reasons: string[] = [];
  const checks = {
    shape: false,
    freshness: false,
    codeHash: false,
    mrtd: true,        // passes when no expected value; overridden below if expected
    nonceBinding: true,
    signature: false,  // local strategy can't verify signature
  };

  // Shape
  if (!attestation || !attestation.codeHash || !attestation.provider ||
      typeof attestation.payload !== 'object' || attestation.payload === null) {
    reasons.push('Malformed attestation (missing codeHash / provider / payload)');
  } else {
    checks.shape = true;
  }

  // Freshness
  if (attestation?.verifiedAt) {
    const age = Date.now() - new Date(attestation.verifiedAt).getTime();
    if (isNaN(age)) {
      reasons.push('verifiedAt is not a valid ISO timestamp');
    } else if (age < -60_000) {
      reasons.push(`verifiedAt is in the future by ${Math.round(-age / 1000)}s`);
    } else if (age > FRESHNESS_MAX_AGE_MS) {
      reasons.push(`attestation is stale (${Math.round(age / 3600_000)}h old)`);
    } else {
      checks.freshness = true;
    }
  } else {
    reasons.push('attestation missing verifiedAt');
  }

  // Code hash match
  if (expectedCodeHash) {
    if (attestation.codeHash === expectedCodeHash) {
      checks.codeHash = true;
    } else {
      reasons.push(`codeHash mismatch: expected ${expectedCodeHash.slice(0, 16)}…, got ${attestation.codeHash?.slice(0, 16)}…`);
    }
  } else {
    // No expected hash registered → trust-on-first-use; don't block, but flag
    checks.codeHash = true;
    reasons.push('warning: skill has no registered code_hash — trusting on first use');
  }

  // MRTD (TDX measurement) match — only enforced if an expected value is registered
  if (expectedMrtd) {
    const mrtd = (attestation.payload as Record<string, unknown>)?.mrtd as string | undefined;
    if (mrtd && mrtd === expectedMrtd) {
      checks.mrtd = true;
    } else {
      checks.mrtd = false;
      reasons.push(`MRTD mismatch: expected ${expectedMrtd.slice(0, 16)}…, got ${mrtd?.slice(0, 16) ?? 'null'}…`);
    }
  }

  // Nonce binding — the TEE must echo our nonce back in user_data
  if (nonce) {
    const echoedNonce = (attestation.payload as Record<string, unknown>)?.nonce as string | undefined;
    if (echoedNonce === nonce) {
      checks.nonceBinding = true;
    } else {
      checks.nonceBinding = false;
      reasons.push(`nonce binding failed: sent ${nonce.slice(0, 8)}…, quote contains ${echoedNonce?.slice(0, 8) ?? 'null'}…`);
    }
  }

  // warnings don't fail the check
  const hardFail = reasons.some((r) => !r.startsWith('warning:'));
  return {
    valid: !hardFail && checks.shape && checks.freshness && checks.codeHash && checks.mrtd && checks.nonceBinding,
    strategy: 'local',
    reasons,
    checks,
  };
}

// ── Phala remote verification ───────────────────────────────
// If PHALA_ATTESTATION_VERIFY_URL is set, POST the attestation and trust
// the service's verdict. This delegates quote signature verification to
// Phala's infrastructure, which walks the Intel PCK cert chain internally.

async function runPhalaRemote(input: VerifierInput): Promise<Partial<VerifierResult>> {
  const verifyUrl = process.env.PHALA_ATTESTATION_VERIFY_URL;
  if (!verifyUrl) {
    return {
      checks: { shape: true, freshness: true, codeHash: true, mrtd: true, nonceBinding: true, signature: false },
      reasons: ['PHALA_ATTESTATION_VERIFY_URL not set — signature not verified remotely'],
      valid: false,
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const resp = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quote: input.attestation.payload,
        signature: input.attestation.signature,
        expectedCodeHash: input.expectedCodeHash ?? undefined,
        nonce: input.nonce,
      }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (!resp.ok) {
      return {
        reasons: [`Phala verify service returned ${resp.status}`],
        valid: false,
        checks: { shape: true, freshness: true, codeHash: true, mrtd: true, nonceBinding: true, signature: false },
      };
    }

    const data = await resp.json() as { valid?: boolean; reason?: string };
    return {
      valid: !!data.valid,
      reasons: data.valid ? [] : [data.reason || 'Phala verify service marked attestation invalid'],
      checks: { shape: true, freshness: true, codeHash: true, mrtd: true, nonceBinding: true, signature: !!data.valid },
    };
  } catch (err) {
    return {
      reasons: [`Phala verify service unreachable: ${err instanceof Error ? err.message : String(err)}`],
      valid: false,
      checks: { shape: true, freshness: true, codeHash: true, mrtd: true, nonceBinding: true, signature: false },
    };
  }
}

function mergeResults(local: VerifierResult, remote: Partial<VerifierResult>, strategy: 'phala' | 'intel'): VerifierResult {
  return {
    strategy,
    valid: local.valid && (remote.valid ?? false),
    reasons: [...local.reasons, ...(remote.reasons ?? [])],
    checks: {
      ...local.checks,
      signature: remote.checks?.signature ?? false,
    },
  };
}
