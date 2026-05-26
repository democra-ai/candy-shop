-- ============================================================
-- Candy Shop — Skill tier columns (D1)
-- ============================================================
-- Adds the 3-tier privacy model + the data the fast invocation
-- path (/api/skill/:id/run) needs. Mirrors the relevant columns
-- of Supabase migration 004_tee_execution.sql in D1's dialect.
--
-- Tiers
--   open     — Tier 0: source visible to everyone, platform runs it
--   managed  — Tier 1: prompt sealed in DB, platform calls LLM
--                       optionally with the caller's BYOK key,
--                       so the upstream LLM sees the prompt
--                       but never the caller's identity.
--   tee      — Tier 2: prompt sealed inside a TEE CVM. Platform
--                       proxies and records attestations.
-- ============================================================

ALTER TABLE skills ADD COLUMN execution_model TEXT
  NOT NULL DEFAULT 'open'
  CHECK (execution_model IN ('open','managed','tee','federated'));

ALTER TABLE skills ADD COLUMN system_prompt   TEXT;   -- managed/tee skills bake the prompt
ALTER TABLE skills ADD COLUMN default_model   TEXT;   -- e.g. 'anthropic:claude-haiku-4-5'
ALTER TABLE skills ADD COLUMN tee_provider    TEXT;
ALTER TABLE skills ADD COLUMN tee_endpoint    TEXT;
ALTER TABLE skills ADD COLUMN tee_code_hash   TEXT;
ALTER TABLE skills ADD COLUMN tee_last_verified_at TEXT;
ALTER TABLE skills ADD COLUMN allowed_providers   TEXT DEFAULT '[]'; -- JSON array of provider ids tier-1 BYOK accepts

CREATE INDEX IF NOT EXISTS skills_exec_idx ON skills (execution_model);

-- ── BYOK keys per user × provider ─────────────────────────────
-- Stores AES-GCM ciphertext of the user's API key. Key material
-- never leaves the Worker. Encryption uses env.BYOK_ENC_KEY.
CREATE TABLE IF NOT EXISTS user_byok_keys (
  user_id    TEXT NOT NULL,
  provider   TEXT NOT NULL,                 -- 'anthropic' | 'openai' | 'groq' | 'cerebras' | ...
  ciphertext TEXT NOT NULL,                 -- base64 of (iv || ct)
  label      TEXT,                          -- "personal", "work", etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, provider)
);

-- ── invocations — append-only log used by entitlement consumption
CREATE TABLE IF NOT EXISTS invocations (
  id              TEXT PRIMARY KEY,
  skill_id        TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  caller_id       TEXT NOT NULL,
  caller_type     TEXT NOT NULL DEFAULT 'user' CHECK (caller_type IN ('user','agent')),
  provider        TEXT NOT NULL DEFAULT 'free' CHECK (provider IN ('free','stripe','x402','byok')),
  amount          INTEGER NOT NULL DEFAULT 0,
  tier            TEXT NOT NULL DEFAULT 'open' CHECK (tier IN ('open','managed','tee')),
  duration_ms     INTEGER,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  tee_attestation TEXT,                     -- JSON when tier='tee'
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS invocations_skill_idx  ON invocations (skill_id);
CREATE INDEX IF NOT EXISTS invocations_caller_idx ON invocations (caller_id);

-- ── tee_attestations — verifiable attestation audit log ───────
CREATE TABLE IF NOT EXISTS tee_attestations (
  id          TEXT PRIMARY KEY,
  skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  provider    TEXT NOT NULL,
  payload     TEXT NOT NULL,                -- JSON
  signature   TEXT,
  valid       INTEGER NOT NULL DEFAULT 0,   -- bool
  verifier    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS tee_att_skill_idx ON tee_attestations (skill_id);
