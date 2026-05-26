# Tier-2 Confidential Skills (TEE)

Candy Shop offers a two-tier privacy model for Skills:

| Tier | `execution_model` | Who can see the prompt? | Who runs it? | Use case |
|-----:|:------------------|:------------------------|:-------------|:---------|
| 0    | `open`            | Anyone (source is public) | User's own client | Free community skills |
| 1    | `managed`         | Platform operators only   | Candy Shop servers | Paid skills, creator IP |
| 2    | `tee`             | **No one**                | TEE (Phala / Nitro / GCP-CS) | High-value skills, compliance-sensitive, B2B |
| —    | `federated`       | Creator only              | Creator's own server | Self-hosted opt-out |

Tier 2 is the "可用而不可见" tier: the skill's system prompt is sealed
inside a Trusted Execution Environment. The platform invokes it like any
other skill, but receives **only the output + an attestation** proving
which code ran.

## What the platform keeps; what the TEE owns

```
 Platform (Vercel + Supabase)            Tier-2 TEE (Phala CVM)
 ┌──────────────────────────┐           ┌────────────────────────────┐
 │ skills table             │  invoke   │  sealed image              │
 │  - id, pricing, tier     │  ────▶    │   skill.json (prompt)      │
 │  - tee_endpoint          │           │   server.js                │
 │  - tee_code_hash         │  ◀────    │  → LLM provider            │
 │ entitlements             │  result + │                            │
 │ tee_attestations (log)   │  attest.  │  emits attestation         │
 └──────────────────────────┘           └────────────────────────────┘
```

The platform never sees the prompt. The TEE never sees billing, entitlements,
or user identity beyond the caller ID passed on each invoke.

## Data model

Migration `004_tee_execution.sql` adds:

- `skills.execution_model` gains `'tee'` as a valid value.
- `skills.tee_provider` — `phala | aws-nitro | gcp-cs | azure-cc | oasis`.
- `skills.tee_endpoint` — HTTPS URL of the CVM.
- `skills.tee_code_hash` — sha256 of deployed image; platform cross-checks on every invoke.
- `skills.tee_attestation_url` — where external verifiers can fetch the raw quote.
- `skills.tee_last_verified_at` — bumped whenever a fresh attestation is recorded.
- `tee_attestations` — append-only audit log: one row per recorded attestation.
- `invocations.tee_attestation_id` — FK to the attestation served during that call.

## Runtime flow

1. User (or agent) calls `POST /api/invoke/:skillId` as usual.
2. The invoke route performs entitlement/payment checks (Stripe, x402, per-call, etc.).
3. If the skill has `execution_model = 'tee'`, the route calls
   `proxyToTEE(skill, input, callerId)`:
   - Signs the body with HMAC-SHA256(`TEE_PLATFORM_SIGNING_KEY`).
   - Sends `POST {tee_endpoint}/invoke`.
   - Receives `{ result, attestation }`.
   - Verifies `attestation.codeHash === skill.tee_code_hash`.
   - Inserts a row into `tee_attestations`.
   - Links it to the `invocations` row via `tee_attestation_id`.
4. Response includes `result` and `attestation`; UI shows the **🛡 TEE Verified** badge,
   click → modal with code hash, provider, timestamp, copy-to-clipboard.

## Deploying a Tier-2 skill

See [`tee-template/README.md`](../tee-template/README.md) for the step-by-step.
Short version:

```bash
cd tee-template
cp skill.example.json skill.json && $EDITOR skill.json   # bake the prompt
docker build -t ghcr.io/you/skill-<id>:v1 .
docker push ghcr.io/you/skill-<id>:v1
phala cvm create --image ghcr.io/you/skill-<id>:v1 \
  --env TEE_PLATFORM_SIGNING_KEY=<same value as platform> \
  --env LLM_API_KEY=sk-...
# Then UPDATE skills SET execution_model='tee', tee_*=... WHERE id=<skill-id>
```

## Pricing

`/api/x402/pricing/:skillId` adds a TEE surcharge to the listed price.
Configured via env:

- `TEE_PRICE_SURCHARGE_BPS` (default `2000` = 20%) — percentage markup in basis points.
- `TEE_PRICE_SURCHARGE_MIN_CENTS` (default `1`) — floor so free skills with
  promotional TEE hosting still charge the CVM cost.

The response splits `basePrice` and `surcharge` so the UI can show both
separately ("Creator: $0.25 · TEE: +$0.05").

## Attestation verifier strategies

Selected via `TEE_VERIFIER` env:

| Strategy | Checks performed                                                                 | Use when |
|:--|:--|:--|
| `local` (default) | shape · freshness · codeHash match · MRTD match (if registered) · nonce binding | Dev, smoke tests, workloads where TEE is in your own infra |
| `phala`           | all of `local`  · remote signature verification via Phala service                | Production with Phala Cloud; set `PHALA_ATTESTATION_VERIFY_URL` |
| `intel`           | all of `phala`  · full Intel TDX/SGX quote parse + PCK cert chain walk           | **Not yet implemented** — tracked in `server/lib/tee-verifier.ts` |

Every strategy rejects attestations that fail nonce binding (the TEE
must echo the nonce we sent back in `payload.nonce`) and stale
attestations (> 24h by default; tune via `TEE_ATTESTATION_MAX_AGE_MS`).

## Smoke test

End-to-end without needing a real Phala CVM — builds the template,
runs it locally, inserts a test skill, invokes through the platform,
and asserts the attestation was recorded and linked:

```bash
./scripts/tee-smoke-test.sh
```

Requires `docker`, `curl`, `jq`, `uuidgen`, and Supabase env vars.

## What's production-ready vs. what's scaffolding

| Concern                     | Status     | Notes |
|-----------------------------|------------|-------|
| Schema + invoke routing     | ✅ ready   | Migration + API branching done |
| TEE proxy + HMAC auth       | ✅ ready   | Swap HMAC → ed25519 for multi-tenant |
| Attestation recording       | ✅ ready   | Append-only log with per-invoke FK |
| Attestation verification    | 🟡 partial | `local` + `phala` strategies work; `intel` full-quote parse TODO |
| CVM deployment template     | ✅ runnable | Real attestation quote call is a TODO in `tee-template/server.js` |
| Creator UI — TEE toggle     | ✅ ready   | Privacy tier selector + endpoint/codeHash fields in `ManualSkillForm` |
| UI badge + attestation modal | ✅ ready   | `TeeVerifiedBadge` on skill detail page |
| Pricing surcharge           | ✅ ready   | Env-configurable |
| Smoke test                  | ✅ ready   | `scripts/tee-smoke-test.sh` |

## Environment variables

Platform (Vercel):

```
TEE_PLATFORM_SIGNING_KEY=<32+ random bytes, shared with each CVM>
TEE_TIMEOUT_MS=30000                       # optional, default 30s
TEE_PRICE_SURCHARGE_BPS=2000               # optional, default 20%
TEE_PRICE_SURCHARGE_MIN_CENTS=1            # optional
```

CVM (per skill):

```
TEE_PROVIDER=phala
TEE_PLATFORM_SIGNING_KEY=<same value as platform>
LLM_API_KEY=<your provider key>
LLM_BASE_URL=https://api.anthropic.com/v1/messages
LLM_MODEL=claude-sonnet-4-6
PORT=8080
```

## Threat model quick-reference

| Adversary                         | Tier 1 protected? | Tier 2 protected? |
|-----------------------------------|:-:|:-:|
| Other users / unauthorized callers | ✅ | ✅ |
| Platform frontend / CDN            | ✅ | ✅ |
| Platform DB read-only leak         | ❌ (prompt in DB) | ✅ (prompt only in sealed image) |
| Platform ops with DB write access  | ❌ | ✅ |
| Cloud provider (Vercel/AWS host)   | ❌ | ✅ (attested TEE) |
| Legal subpoena of platform         | ❌ | ✅ (nothing to hand over) |
| Compromised TEE hardware           | ✅ | ❌ (limits of the tech) |
