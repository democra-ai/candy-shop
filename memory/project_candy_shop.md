---
name: project-candy-shop
description: Candy Shop architecture — 3-tier privacy AI skill marketplace, mid Cloudflare migration. cloudflare-migration branch.
metadata:
  type: project
---

**Candy Shop** is a marketplace for AI skills where each skill has a privacy tier:

- **Tier 0 `open`** — source visible, platform runs prompt on Workers AI (`env.AI`).
- **Tier 1 `managed`** — prompt sealed in DB. Platform calls 3rd-party LLM. If caller has BYOK key, the call uses their key so the upstream provider sees the prompt but never the caller's identity (anonymized at the edge). Otherwise uses the platform key.
- **Tier 2 `tee`** — prompt sealed inside a TEE CVM (Phala etc.). Platform proxies, verifies attestation, logs it.

**Why:** the goal is "skill usable but invisible" — let creators monetize prompts without leaking them.

**How to apply:** new features must consider all three tiers. Stripe + x402 entitlement checks gate ALL tiers identically — only the dispatch step differs.

## Architecture (mid-migration)

Active branch: `cloudflare-migration`. Goal is to move OFF Vercel/Supabase ONTO Cloudflare Worker + D1 + KV.

**Live production URL:** `https://candy-shop-cf.pages.dev` (root returns 200, serves the SPA). ⚠️ The preview alias `https://cloudflare-migration.candy-shop-cf.pages.dev` is DEAD — it 404s on every path, so any verification/QA/Playwright script pointed at it silently tests a 404 page. Always target `https://candy-shop-cf.pages.dev`.

- **Worker (`worker/src/index.ts`)** — Hono on Cloudflare. Owns auth (cookie+KV), D1, Stripe checkout+webhook, entitlements, BYOK keys (AES-GCM via env.BYOK_ENC_KEY), TEE proxy, fast skill invocation. **Use this as the source of truth for any new server logic.**
- **Vercel `/api/*` (`api/`)** — legacy Supabase-backed routes (invoke, skills/upsert, x402). Being phased out. Don't add features here; mirror to Worker instead.
- **D1 migrations** in `worker/migrations/`. Latest is `0004_skill_tiers.sql` (adds execution_model, system_prompt, tee_*, byok keys table, invocations log).
- **Skill invocation hot path:** `POST /api/skill/:id/run` (Worker). SSE: start / delta / attestation? / done | error. Replaces the heavy `/api/cc/run` + `/api/oc/run` agentic sandbox for end-user invocation (those remain for the *creation* flow inside SkillExecutor).
- **Front-end skill detail page** uses `RunSkillPanel` + `src/lib/skillRunClient.ts` for the fast path.

## Known measurement

[[latency-baseline]] — Claude Code sandbox `cc/run` for a trivial input was **14.5s** (system prompt of 36k tokens + GLM-air TTFT). Replaced by direct LLM call on `/api/skill/:id/run`, expected ~1-2s.

## Pending work

See in-repo task list; key remaining items:
- Apply migration 0004 to remote D1 (`wrangler d1 migrations apply candy-shop-db --remote`)
- Set `BYOK_ENC_KEY` Worker secret
- Deploy worker
- Verify Stripe webhook → entitlement → invoke check still wires correctly with the new fast path
- Remove or proxy the legacy Vercel `/api/invoke/[skillId]` once Worker route is live
